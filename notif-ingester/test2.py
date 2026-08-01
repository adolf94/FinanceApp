from pydantic import BaseModel
from typing import Optional, List

class AiParsedData(BaseModel):
    is_financial: Optional[bool] = True
    suggested_account_creation: Optional[List[dict]] = None

try:
    AiParsedData(**{"is_financial": True, "suggested_account_creation": [{"foo": "bar"}]})
    print("Success")
except Exception as e:
    print(repr(str(e)))

