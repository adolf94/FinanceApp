import httpx
import os
from models.pending_ingestion import PendingIngestion

class FinanceApiService:
    def __init__(self):
        self.base_url = os.environ.get("FINANCE_API_URL", "http://localhost:7071/api")

    async def get_accounts_async(self) -> list[dict]:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/accounts")
            if r.status_code == 200:
                return r.json()
            return []

    async def create_transaction_async(self, ingestion: PendingIngestion) -> dict:
        parsed = ingestion.user_confirmed if ingestion.user_confirmed else ingestion.ai_parsed.model_dump()
        
        body = {
            "date": ingestion.received_at.isoformat(),
            "note": parsed.get("notes", ingestion.raw_msg),
            "vendor": parsed.get("vendor"),
            "type": parsed.get("transaction_type", "Expense"),
            "entries": [
                {"accountId": parsed.get("debit_account_id"),  "amount":  parsed.get("amount")},
                {"accountId": parsed.get("credit_account_id"), "amount": -parsed.get("amount")}
            ]
        }
        
        async with httpx.AsyncClient() as client:
            r = await client.post(f"{self.base_url}/transactions", json=body)
            r.raise_for_status()
            return r.json()
