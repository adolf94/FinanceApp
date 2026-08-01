# Source: c/Models/Vendor.cs
from pydantic import BaseModel, Field

class Vendor(BaseModel):
    id: str = Field(alias="Id")
    user_id: str = Field(alias="UserId")
    name: str = Field(alias="Name")

    class Config:
        populate_by_name = True
