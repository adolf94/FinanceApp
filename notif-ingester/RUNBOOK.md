# Transaction Classification Runbook

This document contains explicit rules and guidelines for how the AI should classify incoming notifications. 
The AI reads this document during classification. Explicit rules here **override** the vector similarity context.

## 1. General Rules
- **Transfers**: Any notification explicitly stating money was moved between two of the user's own accounts should be classified as a `Transfer`.
- **Double Entry**: Ensure that `debit_account_id` and `credit_account_id` always balance correctly. 
  - For **Expenses**: Debit the Expense account, Credit the Asset (Bank/Cash) account.
  - For **Income**: Debit the Asset (Bank/Cash) account, Credit the Income account.
  - For **Transfers**: Debit the receiving Asset account, Credit the sending Asset account.
- **No Raw UUIDs in Explanations**: Do NOT include raw database/account UUIDs in the `why` explanation text. Refer to accounts by their human-readable names instead.

## 2. Explicit Vendor & Category Mappings
*(Add your specific vendors here to force the AI to categorize them exactly)*

| Keywords in Notification | Vendor | Category | Transaction Type |
| :--- | :--- | :--- | :--- |
| `7-ELEV` , `7-Eleven` | 7-Eleven | Food & Dining | Expense |
| `Meralco` | Meralco | Bills & Utilities | Expense |
| `Payroll`, `Salary` | Employer | Salary | Income |
| `GCash` (if moving from Bank) | GCash | Transfer | Transfer |

## 3. Unconsidered Feedback / Future Rules
*(This section tracks feedback or corrections from the user that have not yet been formalized into the tables above. The AI should still attempt to apply these.)*

- *No unconsidered feedback currently.*

## 4. Vector Embeddings & Manual Overrides
*(Reference for how this Runbook interacts with the AI and Vector Service)*

- **Vector Context:** The `ai_service` automatically fetches the top 3 similar past transactions (via `vector_service`) and injects them as context for the AI.
- **Runbook Precedence:** The explicit rules and vendor mappings in this Runbook **always take precedence** over the historical vector context. 
- **When to update this Runbook vs Manual Embedding:** 
  - If a vendor constantly changes its naming format but means the same thing, add a keyword rule to **Section 2** here.
  - If the AI is categorizing an obscure vendor wrong because there is no past vector data, you can either manually correct the transaction (which creates a new vector embedding for future matching) OR add an explicit rule here if you want it hardcoded immediately.
