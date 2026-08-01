import json
from pydantic import BaseModel, ValidationError

class AiParsedData(BaseModel):
    is_financial: bool
    suggested_account_creation: list[dict]

try:
    data = {"is_financial": True, "suggested_account_creation": [{"foo": "bar"}]}
    AiParsedData(**data)
    print("Success")
except Exception as e:
    print(type(e).__name__, repr(str(e)))

