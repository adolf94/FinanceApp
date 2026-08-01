# Source: c/Models/LedgerEntry.cs
from pydantic import BaseModel, Field

class LedgerEntry(BaseModel):
    id: str = Field(alias="Id")
    user_id: str = Field(alias="UserId")
    transaction_id: str = Field(alias="TransactionId")
    account_id: str = Field(alias="AccountId")
    amount: float = Field(alias="Amount")

    class Config:
        populate_by_name = True
