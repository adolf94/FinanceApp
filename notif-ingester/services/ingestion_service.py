import os
import logging
from models.phone_hook import PhoneHookMessage
from models.pending_ingestion import PendingIngestion
from models.transaction_vector import TransactionVector
from repositories.ingestion_repository import IIngestionRepository
from services.embedding_service import EmbeddingService
from services.vector_service import VectorService
from services.ai_service import AiService
from services.finance_api_service import FinanceApiService

class IngestionService:
    def __init__(
        self,
        ingestion_repo: IIngestionRepository,
        embedding_service: EmbeddingService,
        vector_service: VectorService,
        ai_service: AiService,
        finance_api_service: FinanceApiService
    ):
        self._repo = ingestion_repo
        self._embedding_service = embedding_service
        self._vector_service = vector_service
        self._ai_service = ai_service
        self._finance_api_service = finance_api_service
        self._auto_confirm_threshold = float(os.environ.get("AUTO_CONFIRM_THRESHOLD", "0.92"))

    @property
    def ingestion_repo(self) -> IIngestionRepository:
        return self._repo

    async def process_hook_async(self, hook: PhoneHookMessage) -> PendingIngestion:
        logging.info("[process_hook_async] Starting...")
        
        # 0. Quick AI check if it's a financial transaction
        logging.info("[process_hook_async] 0. Checking if financial transaction...")
        from models.pending_ingestion import AiParsedData
        
        is_financial = await self._ai_service.is_financial_transaction_async(hook)
        if not is_financial:
            logging.info("[process_hook_async] Not a financial transaction. Skipping heavy extraction.")
            # Create a basic AiParsedData with is_financial=False
            ai_parsed = AiParsedData(is_financial=False)
            
            ingestion = PendingIngestion(
                user_id=hook.user_id,
                hook_id=hook.id,
                received_at=hook.received_at,
                raw_payload=hook.raw_payload,
                raw_msg=hook.raw_msg,
                ai_parsed=ai_parsed,
                similarity_score=0.0,
                top_matches=[],
                month_key=hook.month_key,
                partition_key=hook.partition_key
            )
            ingestion.status = "NonFinancial"
            ingestion.ttl = 7 * 24 * 60 * 60  # 7 days
            return await self._repo.add_async(ingestion)

        # 1. Embed raw_msg
        logging.info("[process_hook_async] 1. Embedding raw msg...")
        query_embedding = await self._embedding_service.embed_async(hook.raw_msg)
        
        # 2. Find similar past transactions
        logging.info("[process_hook_async] 2. Finding similar transactions...")
        similar_vectors = await self._vector_service.find_similar_async(
            query_embedding, hook.user_id, top_k=3
        )
        top_score = similar_vectors[0][1] if similar_vectors else 0.0

        # 3. Fetch accounts and runbook
        logging.info("[process_hook_async] 3. Fetching accounts...")
        accounts = await self._finance_api_service.get_accounts_async(hook.user_id)
        
        logging.info("[process_hook_async] 3b. Fetching runbook...")
        runbook_content = await self._finance_api_service.get_runbook_content_async(hook.user_id)
        if not runbook_content:
            runbook_content = self._ai_service.get_default_runbook_content()

        # 4. Classify via LLM
        logging.info("[process_hook_async] 4. Classifying via LLM...")
        ai_parsed = await self._ai_service.classify_async(hook, similar_vectors, accounts, runbook_content)
        
        # 4.5 Automatically map vendor from lookups
        lookups = [
            getattr(ai_parsed, 'recipient_account_name', None),
            getattr(ai_parsed, 'recipient_account_number', None),
            getattr(ai_parsed, 'sender_account_name', None),
            getattr(ai_parsed, 'sender_account_number', None),
            getattr(ai_parsed, 'vendor', None),
            getattr(ai_parsed, 'application', None)
        ]
        matched_vendor = await self._finance_api_service.search_vendors_by_lookups_async(hook.user_id, lookups)
        if matched_vendor:
            ai_parsed.vendor = matched_vendor
            ai_parsed.vendor_matched = True
        else:
            if ai_parsed.confidence and ai_parsed.confidence >= self._auto_confirm_threshold and ai_parsed.debit_account_id and ai_parsed.credit_account_id and ai_parsed.vendor:
                await self._finance_api_service.ensure_vendor_and_lookups_async(hook.user_id, ai_parsed.vendor, lookups)
                ai_parsed.vendor_matched = True
            else:
                ai_parsed.vendor_matched = False

        # 5. Create PendingIngestion
        ingestion = PendingIngestion(
            user_id=hook.user_id,
            hook_id=hook.id,
            received_at=hook.received_at,
            raw_payload=hook.raw_payload,
            raw_msg=hook.raw_msg,
            ai_parsed=ai_parsed,
            similarity_score=top_score,
            top_matches=[{
                "vendor": v.vendor, 
                "category": v.category,
                "score": score
            } for v, score in similar_vectors],
            month_key=hook.month_key,
            partition_key=hook.partition_key
        )

        # 6. Auto-confirm logic
        if ai_parsed.is_financial is False:
            ingestion.status = "NonFinancial"
            ingestion.ttl = 7 * 24 * 60 * 60  # 7 days
        elif top_score >= self._auto_confirm_threshold and ai_parsed.transaction_type:
            try:
                ai_parsed.is_auto_confirmed = True
                tx = await self._finance_api_service.create_transaction_async(ingestion)
                ingestion.status = "AutoConfirmed"
                ingestion.transaction_id = tx["id"]
                
                # Embed and learn immediately
                await self.embed_and_learn_async(ingestion)
            except Exception as e:
                # If auto-confirm fails, fallback to Pending
                ingestion.status = "Pending"
                ingestion.notes = f"Auto-confirm failed: {str(e)}"
        else:
            ingestion.status = "Pending"

        # 7. Save
        return await self._repo.add_async(ingestion)

    async def reclassify_ingestion_async(self, ingestion_id: str, user_id: str) -> PendingIngestion:
        """Re-run AI classification on an existing PendingIngestion."""
        ingestion = await self._repo.get_by_id_async(ingestion_id, user_id)
        if not ingestion:
            raise ValueError("Ingestion not found")

        # 1. Re-embed raw_msg
        query_embedding = await self._embedding_service.embed_async(ingestion.raw_msg)

        # 2. Find similar past transactions
        similar_vectors = await self._vector_service.find_similar_async(
            query_embedding, user_id, top_k=3
        )
        top_score = similar_vectors[0][1] if similar_vectors else 0.0

        # 3. Fetch accounts and runbook
        accounts = await self._finance_api_service.get_accounts_async(user_id)
        runbook_content = await self._finance_api_service.get_runbook_content_async(user_id)
        if not runbook_content:
            runbook_content = self._ai_service.get_default_runbook_content()

        # 4. Re-classify via LLM
        # Build a minimal hook-like object for classification
        from types import SimpleNamespace
        hook_like = SimpleNamespace(
            raw_msg=ingestion.raw_msg,
            raw_payload=ingestion.raw_payload,
            user_id=user_id
        )
        ai_parsed = await self._ai_service.classify_async(hook_like, similar_vectors, accounts, runbook_content)

        # 4.5 Automatically map vendor from lookups
        lookups = [
            getattr(ai_parsed, 'recipient_account_name', None),
            getattr(ai_parsed, 'recipient_account_number', None),
            getattr(ai_parsed, 'sender_account_name', None),
            getattr(ai_parsed, 'sender_account_number', None),
            getattr(ai_parsed, 'vendor', None),
            getattr(ai_parsed, 'application', None)
        ]
        matched_vendor = await self._finance_api_service.search_vendors_by_lookups_async(user_id, lookups)
        if matched_vendor:
            ai_parsed.vendor = matched_vendor
            ai_parsed.vendor_matched = True
        else:
            if ai_parsed.confidence and ai_parsed.confidence >= self._auto_confirm_threshold and ai_parsed.debit_account_id and ai_parsed.credit_account_id and ai_parsed.vendor:
                await self._finance_api_service.ensure_vendor_and_lookups_async(user_id, ai_parsed.vendor, lookups)
                ai_parsed.vendor_matched = True
            else:
                ai_parsed.vendor_matched = False

        # 5. Update ingestion with new classification
        ingestion.ai_parsed = ai_parsed
        ingestion.similarity_score = top_score
        ingestion.top_matches = [{
            "vendor": v.vendor,
            "category": v.category,
            "score": score
        } for v, score in similar_vectors]
        ingestion.status = "Pending"

        await self._repo.update_async(ingestion)
        return ingestion

    async def learn_ingestion_async(self, ingestion_id: str, user_id: str, user_confirmed: dict = None) -> PendingIngestion:
        ingestion = await self._repo.get_by_id_async(ingestion_id, user_id)
        if not ingestion:
            raise ValueError("Ingestion not found")
            
        if user_confirmed:
            ingestion.user_confirmed = user_confirmed
        
        # AI in the loop to update the runbook based on response, transaction data, notification etc.
        user_why = user_confirmed.get("user_why") if user_confirmed else None
        if user_why:
            try:
                logging.info(f"[confirm_ingestion_async] Running AI Runbook synthesis for user feedback...")
                # Fetch current runbook
                current_runbook = await self._finance_api_service.get_runbook_content_async(user_id)
                if not current_runbook:
                    current_runbook = self._ai_service.get_default_runbook_content()
                
                # Synthesize new runbook
                updated_runbook = await self._ai_service.update_runbook_with_feedback_async(
                    raw_msg=ingestion.raw_msg,
                    ai_parsed=ingestion.ai_parsed.model_dump(),
                    user_confirmed=user_confirmed,
                    user_why=user_why,
                    current_runbook=current_runbook
                )
                
                # Save updated runbook to Cosmos DB
                await self._finance_api_service.save_runbook_content_async(user_id, updated_runbook)
            except Exception as e:
                logging.error(f"Failed to update runbook with AI feedback: {e}")

        # Learn from it
        await self.embed_and_learn_async(ingestion)
        
        # Update ingestion
        await self._repo.update_async(ingestion)
        return ingestion

    async def embed_and_learn_async(self, ingestion: PendingIngestion) -> None:
        parsed = ingestion.user_confirmed if ingestion.user_confirmed else ingestion.ai_parsed.model_dump()
        
        vendor = parsed.get("vendor", "")
        category = parsed.get("category", "")
        tx_type = parsed.get("transaction_type", "")
        
        # Fetch accounts to resolve human-readable names for embedding
        debit_id = parsed.get("debit_account_id")
        credit_id = parsed.get("credit_account_id")
        accounts = await self._finance_api_service.get_specific_accounts_async(ingestion.user_id, [debit_id, credit_id])
        
        debit_name = ""
        credit_name = ""
        for acc in accounts:
            if acc.get("id") == debit_id:
                debit_name = f"{acc.get('accountGroupName', '')} {acc.get('name', '')}"
            if acc.get("id") == credit_id:
                credit_name = f"{acc.get('accountGroupName', '')} {acc.get('name', '')}"
        
        details = [
            vendor,
            tx_type,
            debit_name,
            credit_name,
            parsed.get("recipient_account_name", ""),
            parsed.get("recipient_account_number", ""),
            parsed.get("sender_account_name", ""),
            parsed.get("sender_account_number", ""),
            parsed.get("application", "")
        ]
        
        # Filter out empty strings and join
        embed_text = " ".join([d for d in details if d and str(d).strip()])
        
        embedding = await self._embedding_service.embed_async(embed_text)
        
        vector = TransactionVector(
            user_id=ingestion.user_id,
            transaction_id=ingestion.transaction_id or "",
            vendor=vendor,
            category=category,
            debit_account_id=parsed.get("debit_account_id", ""),
            credit_account_id=parsed.get("credit_account_id", ""),
            embed_text=embed_text,
            embedding=embedding
        )
        
        await self._vector_service.upsert_async(vector)

    async def generate_account_description_async(self, user_id: str, account_name: str, account_type: str, group_name: str, context: str = "") -> str:
        accounts = await self._finance_api_service.get_accounts_async(user_id)
        return await self._ai_service.generate_account_description_async(account_name, account_type, group_name, accounts, context)
