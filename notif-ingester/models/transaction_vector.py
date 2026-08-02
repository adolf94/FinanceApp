# Source: Python (Original)
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from uuid_extensions import uuid7
from typing import List

class TransactionVector(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid7()))
    user_id: str = Field(default="default", alias="UserId")
    transaction_id: str
    vendor: str
    category: str
    summary: str = ""
    debit_account_id: str
    credit_account_id: str
    embed_text: str
    embedding: List[float]
    confirmed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    partition_key: str = "default"

    class Config:
        populate_by_name = True
