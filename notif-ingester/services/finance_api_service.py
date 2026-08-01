import os
from azure.cosmos.aio import CosmosClient
from models.pending_ingestion import PendingIngestion
from uuid_extensions import uuid7

class FinanceApiService:
    def __init__(self):
        self.endpoint = os.environ.get("CosmosConnectionString", "")
        self.client = CosmosClient.from_connection_string(self.endpoint) if self.endpoint else None
        self.db_name = os.environ.get("COSMOS_DB", "FinanceDb")

    async def get_accounts_async(self, user_id: str) -> list[dict]:
        if not self.client:
            return []
            
        db = self.client.get_database_client(self.db_name)
        container = db.get_container_client("Accounts")
        
        query = "SELECT * FROM c"
        items = container.query_items(
            query=query,
            partition_key=user_id
        )
        accounts = []
        async for item in items:
            accounts.append({
                "id": item.get("id"),
                "name": item.get("Name", item.get("name")),
                "accountType": item.get("AccountType", item.get("accountType")),
                "accountGroupId": item.get("AccountGroupId", item.get("accountGroupId")),
            })
        return accounts

    async def create_transaction_async(self, ingestion: PendingIngestion) -> dict:
        parsed = ingestion.user_confirmed if ingestion.user_confirmed else ingestion.ai_parsed.model_dump()
        
        if not self.client:
            raise RuntimeError("Cosmos DB client not initialized")
            
        db = self.client.get_database_client(self.db_name)
        container = db.get_container_client("Transactions")
        
        tx_id = str(uuid7())
        user_id = ingestion.user_id
        
        tx_doc = {
            "id": tx_id,
            "UserId": user_id,
            "Date": ingestion.received_at.isoformat(),
            "Note": parsed.get("notes", ingestion.raw_msg),
            "Vendor": parsed.get("vendor"),
            "Type": parsed.get("transaction_type", "Expense"),
            "Discriminator": "Transaction"
        }
        await container.upsert_item(tx_doc)

        debit_entry = {
            "id": str(uuid7()),
            "UserId": user_id,
            "TransactionId": tx_id,
            "AccountId": parsed.get("debit_account_id"),
            "Amount": float(parsed.get("amount")),
            "Discriminator": "LedgerEntry"
        }
        await container.upsert_item(debit_entry)
        
        credit_entry = {
            "id": str(uuid7()),
            "UserId": user_id,
            "TransactionId": tx_id,
            "AccountId": parsed.get("credit_account_id"),
            "Amount": -float(parsed.get("amount")),
            "Discriminator": "LedgerEntry"
        }
        await container.upsert_item(credit_entry)
        
        return {"id": tx_id}
