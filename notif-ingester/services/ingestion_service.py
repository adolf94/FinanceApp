import os
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

    async def process_hook_async(self, hook: PhoneHookMessage) -> PendingIngestion:
        # 1. Embed raw_msg
        query_embedding = await self._embedding_service.embed_async(hook.raw_msg)
        
        # 2. Find similar past transactions
        similar_vectors = await self._vector_service.find_similar_async(
            query_embedding, hook.user_id, top_k=3
        )
        top_score = similar_vectors[0][1] if similar_vectors else 0.0

        # 3. Fetch accounts
        accounts = await self._finance_api_service.get_accounts_async()

        # 4. Classify via LLM
        ai_parsed = await self._ai_service.classify_async(hook, similar_vectors, accounts)

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
        if top_score >= self._auto_confirm_threshold and ai_parsed.transaction_type:
            try:
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

    async def confirm_ingestion_async(self, ingestion_id: str, user_id: str) -> PendingIngestion:
        ingestion = await self._repo.get_by_id_async(ingestion_id, user_id)
        if not ingestion:
            raise ValueError("Ingestion not found")
            
        if ingestion.status in ["Confirmed", "AutoConfirmed"]:
            return ingestion
            
        # Create transaction
        tx = await self._finance_api_service.create_transaction_async(ingestion)
        ingestion.status = "Confirmed"
        ingestion.transaction_id = tx["id"]
        
        # Learn from it
        await self.embed_and_learn_async(ingestion)
        
        # Update ingestion
        await self._repo.update_async(ingestion)
        return ingestion

    async def embed_and_learn_async(self, ingestion: PendingIngestion) -> None:
        parsed = ingestion.user_confirmed if ingestion.user_confirmed else ingestion.ai_parsed.model_dump()
        
        vendor = parsed.get("vendor", "")
        category = parsed.get("category", "")
        embed_text = f"{vendor} {category} {parsed.get('transaction_type', '')}"
        
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
