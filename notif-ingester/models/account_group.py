# Source: c/Models/AccountGroup.cs
from pydantic import BaseModel, Field
from models.enums import AccountType

class AccountGroup(BaseModel):
    id: str = Field(alias="Id")
    user_id: str = Field(alias="UserId")
    name: str = Field(alias="Name")
    account_type: AccountType = Field(alias="AccountType")

    class Config:
        populate_by_name = True
