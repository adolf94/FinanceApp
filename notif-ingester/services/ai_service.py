import json
import os
from google import genai
from models.phone_hook import PhoneHookMessage
from models.pending_ingestion import AiParsedData
from models.transaction_vector import TransactionVector
from typing import List, Tuple

CLASSIFICATION_PROMPT = """
You are a personal finance assistant. Classify this notification as a financial transaction.

User Runbook (Explicit Rules):
{runbook_content}

Notification: {raw_msg}
Full payload: {raw_payload}

Similar past transactions (for context):
{similar_context}

Available accounts:
{accounts}

Return ONLY valid JSON matching this schema:
{{
  "vendor": string,
  "amount": number (positive),
  "transaction_type": "Expense"|"Income"|"Transfer"|"Journal",
  "debit_account_id": string (account id from the list above),
  "credit_account_id": string (account id from the list above),
  "category": string,
  "notes": string,
  "confidence": number (0.0-1.0)
}}

Rules:
- Apply the User Runbook rules ABOVE everything else.
- For Expense: debit = expense account, credit = source bank/cash account
- For Income: debit = bank account, credit = income account
- Entries must balance (debit amount positive, credit amount negative)
- Use exact account IDs from the accounts list
"""

class AiService:
    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY", "")
        self.client = genai.Client(api_key=api_key)

    def _build_context(self, similar_vectors: List[Tuple[TransactionVector, float]]) -> str:
        if not similar_vectors:
            return "No previous similar transactions found."
        
        context_parts = []
        for vec, score in similar_vectors:
            context_parts.append(
                f"Vendor: {vec.vendor}, Category: {vec.category}, "
                f"Debit Acc: {vec.debit_account_id}, Credit Acc: {vec.credit_account_id} "
                f"(Similarity: {score:.2f})"
            )
        return "\n".join(context_parts)

    def _format_accounts(self, accounts: list[dict]) -> str:
        if not accounts:
            return "No accounts available."
        
        lines = []
        for acc in accounts:
            lines.append(f"ID: {acc.get('id')} | Name: {acc.get('name')} | Type: {acc.get('accountType')}")
        return "\n".join(lines)

    def _get_runbook_content(self) -> str:
        # Load the runbook from the root of the project
        runbook_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "RUNBOOK.md")
        try:
            with open(runbook_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            return "No runbook rules available."

    async def classify_async(
        self,
        hook: PhoneHookMessage,
        similar_vectors: List[Tuple[TransactionVector, float]],
        accounts: list[dict]
    ) -> AiParsedData:
        
        context = self._build_context(similar_vectors)
        accounts_text = self._format_accounts(accounts)
        runbook_content = self._get_runbook_content()

        prompt = CLASSIFICATION_PROMPT.format(
            runbook_content=runbook_content,
            raw_msg=hook.raw_msg,
            raw_payload=json.dumps(hook.raw_payload, indent=2),
            similar_context=context,
            accounts=accounts_text
        )

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )
        
        data = json.loads(response.text)
        return AiParsedData(**data)
