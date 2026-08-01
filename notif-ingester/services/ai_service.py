import json
import os
import logging
from google import genai
from models.phone_hook import PhoneHookMessage
from models.pending_ingestion import AiParsedData
from models.transaction_vector import TransactionVector
from typing import List, Tuple

RUNBOOK_SYNTHESIS_PROMPT = """
You are a personal finance assistant. Your job is to maintain the user's transaction classification rules runbook (RUNBOOK.md).

Here is the current content of RUNBOOK.md:
---
{current_runbook}
---

The user has manually corrected an AI classification. Here is the context of the correction:
- Raw Notification: {raw_msg}
- AI Proposed Classification: {ai_parsed}
- User Corrected Classification: {user_confirmed}
- User's Explanation/Reason (Why): {user_why}

Please update the RUNBOOK.md content to incorporate the user's correction and explanation.
Rules:
1. Do not lose any existing general rules or instructions.
2. If this is a specific vendor rule, add or update the entry in Section 2 (Explicit Vendor & Category Mappings) table.
3. If it's a general guideline or rule, add it under Section 3 (Unconsidered Feedback / Future Rules) or update Section 1. Crucial: Phrase these rules using suggestion/recommendation words like "should", "suggest", "recommend", or "prefer" (e.g. "GCash transfers containing X should be categorized under Y") rather than absolute commands.
4. Keep the document highly structured, clean, and in Markdown. Do not duplicate rules.
5. Return ONLY the new, complete RUNBOOK.md content. Do not include markdown code block syntax (like ```markdown) or any explanation outside the document.
"""

CLASSIFICATION_PROMPT = """
You are a personal finance assistant. Classify this notification as a financial transaction.

User Runbook (Explicit Rules):
{runbook_content}

Notification: {raw_msg}
Source App / Sender: {app_name}
Full payload: {raw_payload}

Similar past transactions (for context):
{similar_context}

Available accounts:
{accounts}

Return ONLY valid JSON matching this schema:
{{
  "is_financial": boolean (true if this notification represents an actual financial transaction such as a charge, fee, cash withdrawal, transfer, debit, deposit, bill payment, etc. false if it is a general/non-financial notification, marketing promo, security alert, password reset, login notification, OTP code, etc.),
  "vendor": string (null if not financial),
  "amount": number (positive, null if not financial),
  "transaction_type": "Expense"|"Income"|"Transfer"|"Journal" (null if not financial),
  "debit_account_id": string (account id from the list above, null if not financial),
  "credit_account_id": string (account id from the list above, null if not financial),
  "suggested_account_creation": [{{"type": "Cash"|"Bank"|"CreditCard"|"Investment"|"Asset"|"Liability"|"Equity"|"Income"|"Expense"|"Adjustment", "account_group": "string", "name": "string", "description": "string", "reason": "string (Explain the financial purpose of this account AND why you chose this specific name and group. NEVER mention that it is because an account is missing or not found. Focus purely on what financial activity this account tracks and why it is named this way, e.g., 'To track dining expenses under the Food group'.)"}}] (empty array if no accounts need to be created, or if not financial),
  "notes": string,
  "confidence": number (0.0-1.0),
  "recipient_account_number": string (recipient/card/account number if mentioned in the message, null if not financial),
  "recipient_account_name": string (recipient name if mentioned in the message, null if not financial),
  "sender_account_number": string (sender account/card/wallet number if mentioned in the message, null if not financial),
  "sender_account_name": string (sender name if mentioned in the message, null if not financial),
  "application": string (name of the app or SMS sender, e.g. BPI, GCash),
  "why": string (brief explanation of why this transaction was classified this way, including which rules, keywords, or vector context matches were used. Do NOT include raw UUIDs in this explanation.)
}}

Rules:
- Apply the User Runbook rules ABOVE everything else.
- For transaction_type: "Expense" means money leaving the user's personal accounts (e.g. purchases, payments to external parties for services/goods). "Income" means money entering the user's personal accounts (e.g. salary, deposits from external parties). "Transfer" means money moving between Asset, Liability, Bank, or Investment accounts. This includes moving money between the user's own accounts (e.g. Bank to Bank, Bank to EWallet/Asset, paying a Credit Card) AND receiving/sending money that affects a Liability/Receivable (e.g. receiving a loan payment from someone else).
- For Expense: debit = expense account, credit = source bank/cash account
- For Income: debit = bank account, credit = income account
- Entries must balance (debit amount positive, credit amount negative)
- CRITICAL: "Vendor" can mean a business OR an individual person (e.g. for GCash/bank transfers, the recipient's or sender's name is the Vendor). If the person or business matches an "Existing Vendor", prefer the existing name exactly.
- CRITICAL: DO NOT hallucinate account IDs. Use exact account IDs from the accounts list. If no appropriate account exists for the transaction (i.e. Asset not found or Expense/Income not available), set the debit/credit account ID to null and provide a `suggested_account_creation`.
- CRITICAL for `suggested_account_creation` reason: Focus ONLY on the functional, financial purpose of the account AND explain why you chose this specific name and group for it (e.g., "To categorize online shopping expenses, placing it under General Merchandise"). NEVER say "because it doesn't exist", "no appropriate account was found", or "because no specific account is available". Assume the user just wants to know what this account is FOR and WHY it is named this way.
- In the 'why' explanation field, do NOT include any raw UUIDs/IDs (e.g., account IDs like '018f3a3d-...'). Refer to accounts by their human-readable names instead.
"""

IS_FINANCIAL_PROMPT = """
You are a personal finance assistant. Determine if this notification represents a financial transaction.
A financial transaction is anything involving movement of money (e.g., payments, expenses, income, transfers, withdrawals, bills).
General notifications, security alerts, login OTPs, promotional messages, etc., are NOT financial transactions.

Notification: {raw_msg}
Source App / Sender: {app_name}

Return ONLY a boolean matching this JSON schema:
{{
  "is_financial": boolean
}}
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
        
        # Group accounts dynamically by the actual accountType property
        groups = {}
        for acc in accounts:
            acc_type = acc.get('accountType') or 'Other'
            groups.setdefault(acc_type, []).append(acc)
            
        sections = []
        for type_name, acc_list in groups.items():
            type_name_lower = type_name.lower()
            
            # Determine header/label names dynamically based on the account type value
            if 'expense' in type_name_lower:
                header = "Expense\nid | Category | Name | Description"
            elif 'income' in type_name_lower:
                header = "Income\nid | Category | Name | Description"
            elif 'creditcard' in type_name_lower or 'credit card' in type_name_lower:
                header = "Credit Card\nid | Group | Name | Description"
            elif 'asset' in type_name_lower:
                header = "Asset\nid | Group | Name | Description"
            else:
                header = f"{type_name}\nid | Group | Name | Description"
                
            lines = []
            for acc in acc_list:
                acc_id = acc.get('id') or ''
                name = acc.get('name') or ''
                desc = acc.get('description') or ''
                group_info = acc.get('accountGroupName') or acc.get('accountGroupId') or "N/A"
                lines.append(f"{acc_id} | {group_info} | {name} | {desc}")
                
            sections.append(f"{header}\n" + "\n".join(lines))
            
        return "\n\n".join(sections)

    async def generate_account_description_async(self, account_name: str, account_type: str, group_name: str, accounts: list[dict], context: str = "", ai_debug: bool = False) -> str:
        """
        Generates a unique and unambiguous description for a new or existing account.
        """
        formatted_accounts = self._format_accounts(accounts)
        
        context_section = f"\nCurrent Description: {context}\n" if context else ""
        
        prompt = f"""
You are a financial AI assistant. Your task is to generate a short, unambiguous description for a financial account to help another AI correctly classify transactions into it in the future.

Account Name: {account_name}
Account Type: {account_type}
Account Group: {group_name}{context_section}

Here are the existing accounts in the system:
{formatted_accounts}

Please write a 1-2 sentence description for this account that clearly distinguishes it from the existing accounts. If there are similar accounts, explain exactly what THIS account should be used for vs the others.
Return ONLY the description text, nothing else. Don't include redundant text such as the name and type and group. 
"""
        try:
            from google.genai import types

            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                )
            )
            
            if ai_debug or os.environ.get("PROMPT_DEBUG", "").lower() == "true":
                os.makedirs("debug_prompts", exist_ok=True)
                import uuid
                file_path = os.path.join("debug_prompts", f"desc_{uuid.uuid4().hex[:8]}.txt")
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write("=== PROMPT ===\n")
                    f.write(prompt)
                    f.write("\n\n=== RESPONSE ===\n")
                    f.write(response.text)

            return response.text.strip()
        except Exception as e:
            import logging
            logging.error(f"Error generating description: {e}")
            return f"{account_name} ({account_type} - {group_name})"

    def get_default_runbook_content(self) -> str:
        # Load the runbook from the root of the project
        runbook_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "RUNBOOK.md")
        try:
            with open(runbook_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            return "No runbook rules available."

    async def is_financial_transaction_async(self, hook: PhoneHookMessage) -> bool:
        pkg = hook.raw_payload.get("notif_pkg") or hook.raw_payload.get("sms_sender") or ""
        app_name = pkg
        if pkg:
            pkg_lower = pkg.lower()
            if "gcash" in pkg_lower:
                app_name = "GCash"
            elif "indivara" in pkg_lower:
                app_name = "BPI / indivara (Vybe)"
            elif "bpi" in pkg_lower:
                app_name = "BPI"
            elif "maya" in pkg_lower:
                app_name = "Maya"
            else:
                app_name = pkg.split('.')[-1] if '.' in pkg else pkg

        prompt = IS_FINANCIAL_PROMPT.format(
            raw_msg=hook.raw_msg,
            app_name=app_name
        )

        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            
            data = json.loads(response.text)
            return data.get("is_financial", True) # Default to true if ambiguous
        except Exception as e:
            logging.error(f"Error checking if financial transaction: {e}")
            return True # If it fails, default to true to let the full flow handle it


    async def classify_async(
        self,
        hook: PhoneHookMessage,
        similar_vectors: List[Tuple[TransactionVector, float]],
        accounts: list[dict],
        runbook_content: str
    ) -> AiParsedData:
        
        context = self._build_context(similar_vectors)
        accounts_text = self._format_accounts(accounts)

        # Resolve a clean app name from the hook data
        pkg = hook.raw_payload.get("notif_pkg") or hook.raw_payload.get("sms_sender") or ""
        app_name = pkg
        if pkg:
            pkg_lower = pkg.lower()
            if "gcash" in pkg_lower:
                app_name = "GCash"
            elif "indivara" in pkg_lower:
                app_name = "BPI / indivara (Vybe)"
            elif "bpi" in pkg_lower:
                app_name = "BPI"
            elif "maya" in pkg_lower:
                app_name = "Maya"
            else:
                app_name = pkg.split('.')[-1] if '.' in pkg else pkg

        prompt = CLASSIFICATION_PROMPT.format(
            runbook_content=runbook_content,
            raw_msg=hook.raw_msg,
            app_name=app_name,
            raw_payload=json.dumps(hook.raw_payload, indent=2),
            similar_context=context,
            accounts=accounts_text
        )

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )

        if os.environ.get("PROMPT_DEBUG", "").lower() == "true":
            os.makedirs("debug_prompts", exist_ok=True)
            import uuid
            file_path = os.path.join("debug_prompts", f"classify_{uuid.uuid4().hex[:8]}.txt")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("=== PROMPT ===\n")
                f.write(prompt)
                f.write("\n\n=== RESPONSE ===\n")
                f.write(response.text)
        
        data = json.loads(response.text)
        
        # Fallback for application field
        if not data.get("application"):
            data["application"] = app_name
            
        return AiParsedData(**data)

    async def update_runbook_with_feedback_async(
        self,
        raw_msg: str,
        ai_parsed: dict,
        user_confirmed: dict,
        user_why: str,
        current_runbook: str
    ) -> str:
        prompt = RUNBOOK_SYNTHESIS_PROMPT.format(
            current_runbook=current_runbook,
            raw_msg=raw_msg,
            ai_parsed=json.dumps(ai_parsed, indent=2),
            user_confirmed=json.dumps(user_confirmed, indent=2),
            user_why=user_why
        )

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        if os.environ.get("PROMPT_DEBUG", "").lower() == "true":
            os.makedirs("debug_prompts", exist_ok=True)
            import uuid
            file_path = os.path.join("debug_prompts", f"runbook_{uuid.uuid4().hex[:8]}.txt")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write("=== PROMPT ===\n")
                f.write(prompt)
                f.write("\n\n=== RESPONSE ===\n")
                f.write(response.text)
        
        updated_runbook = response.text.strip()
        
        if updated_runbook.startswith("```markdown"):
            updated_runbook = updated_runbook[11:]
        elif updated_runbook.startswith("```"):
            updated_runbook = updated_runbook[3:]
            
        if updated_runbook.endswith("```"):
            updated_runbook = updated_runbook[:-3]
            
        updated_runbook = updated_runbook.strip()
            
        return updated_runbook
