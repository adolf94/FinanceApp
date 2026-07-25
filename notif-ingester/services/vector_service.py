import numpy as np
from typing import List, Tuple
from models.transaction_vector import TransactionVector
from repositories.vector_repository import IVectorRepository

class VectorService:
    def __init__(self, vector_repo: IVectorRepository):
        self._repo = vector_repo

    async def find_similar_async(
        self, query_embedding: List[float], user_id: str, top_k: int = 3
    ) -> List[Tuple[TransactionVector, float]]:
        
        all_vectors = await self._repo.get_all_by_user_async(user_id)
        if not all_vectors:
            return []

        query = np.array(query_embedding)
        query_norm = np.linalg.norm(query)
        if query_norm == 0:
            return []

        results = []
        for vec in all_vectors:
            stored = np.array(vec.embedding)
            stored_norm = np.linalg.norm(stored)
            if stored_norm == 0:
                continue
                
            score = float(np.dot(query, stored) / (query_norm * stored_norm))
            results.append((vec, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    async def upsert_async(self, vector: TransactionVector) -> None:
        await self._repo.upsert_async(vector)
