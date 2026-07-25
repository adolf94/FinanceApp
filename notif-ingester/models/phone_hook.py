from datetime import datetime, timezone
from pydantic import BaseModel, Field
from uuid_extensions import uuid7

class PhoneHookMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid7()))
    user_id: str = "default"
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    action: str
    raw_payload: dict
    raw_msg: str
    status: str = "received"
    month_key: str
    partition_key: str
    ttl: int = Field(default=60 * 24 * 60 * 60, alias="_ttl")

    class Config:
        populate_by_name = True
