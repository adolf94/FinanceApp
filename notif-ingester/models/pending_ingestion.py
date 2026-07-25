from datetime import datetime, timezone
from pydantic import BaseModel, Field
from uuid_extensions import uuid7
from typing import Optional, List, Dict, Any

class AiParsedData(BaseModel):
    vendor: Optional[str] = None
    amount: Optional[float] = None
    transaction_type: Optional[str] = None
    debit_account_id: Optional[str] = None
    credit_account_id: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    confidence: Optional[float] = None

class PendingIngestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid7()))
    user_id: str = "default"
    hook_id: str
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    raw_payload: dict
    raw_msg: str
    ai_parsed: AiParsedData
    user_confirmed: Dict[str, Any] = Field(default_factory=dict)
    similarity_score: float = 0.0
    top_matches: List[dict] = Field(default_factory=list)
    status: str = "Pending"
    transaction_id: Optional[str] = None
    month_key: str
    partition_key: str
