from abc import ABC, abstractmethod
from typing import Optional
from azure.cosmos.aio import CosmosClient
from models.pending_ingestion import PendingIngestion
import os

class IIngestionRepository(ABC):
    @abstractmethod
    async def add_async(self, ingestion: PendingIngestion) -> PendingIngestion:
        pass

    @abstractmethod
    async def get_by_id_async(self, id: str, user_id: str) -> Optional[PendingIngestion]:
        pass

    @abstractmethod
    async def update_async(self, ingestion: PendingIngestion) -> None:
        pass

class CosmosIngestionRepository(IIngestionRepository):
    def __init__(self):
        self.endpoint = os.environ.get("CosmosConnectionString", "")
        self.client = CosmosClient.from_connection_string(self.endpoint)
        self.db_name = os.environ.get("COSMOS_DB", "FinanceDb")
        self.container_name = "PendingIngestions"

    async def _get_container(self):
        db = self.client.get_database_client(self.db_name)
        return db.get_container_client(self.container_name)

    async def add_async(self, ingestion: PendingIngestion) -> PendingIngestion:
        container = await self._get_container()
        await container.upsert_item(ingestion.model_dump(by_alias=True))
        return ingestion

    async def get_by_id_async(self, id: str, user_id: str) -> Optional[PendingIngestion]:
        container = await self._get_container()
        try:
            item = await container.read_item(item=id, partition_key=user_id)
            return PendingIngestion(**item)
        except Exception:
            return None

    async def update_async(self, ingestion: PendingIngestion) -> None:
        container = await self._get_container()
        await container.upsert_item(ingestion.model_dump(by_alias=True))
