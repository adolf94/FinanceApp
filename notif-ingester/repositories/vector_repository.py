from abc import ABC, abstractmethod
from typing import List
from azure.cosmos.aio import CosmosClient
from models.transaction_vector import TransactionVector
import os

class IVectorRepository(ABC):
    @abstractmethod
    async def get_all_by_user_async(self, user_id: str) -> List[TransactionVector]:
        pass

    @abstractmethod
    async def upsert_async(self, vector: TransactionVector) -> None:
        pass

class CosmosVectorRepository(IVectorRepository):
    def __init__(self):
        self.endpoint = os.environ.get("CosmosConnectionString", "")
        self.client = CosmosClient.from_connection_string(self.endpoint)
        self.db_name = os.environ.get("COSMOS_DB", "FinanceDb")
        self.container_name = "TransactionVectors"

    async def _get_container(self):
        db = self.client.get_database_client(self.db_name)
        return db.get_container_client(self.container_name)

    async def get_all_by_user_async(self, user_id: str) -> List[TransactionVector]:
        container = await self._get_container()
        query = "SELECT * FROM c WHERE c.user_id = @user_id"
        parameters = [{"name": "@user_id", "value": user_id}]
        
        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key="default"
        )
        
        results = []
        async for item in items:
            results.append(TransactionVector(**item))
        return results

    async def upsert_async(self, vector: TransactionVector) -> None:
        container = await self._get_container()
        await container.upsert_item(vector.model_dump(by_alias=True))
