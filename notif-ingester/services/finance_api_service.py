import os
from azure.cosmos.aio import CosmosClient
from models.pending_ingestion import PendingIngestion
from uuid_extensions import uuid7

class FinanceApiService:
    def __init__(self):
        self.endpoint = os.environ.get("CosmosConnectionString", "")
        self.client = CosmosClient.from_connection_string(self.endpoint) if self.endpoint else None
        self.db_name = os.environ.get("COSMOS_DB", "FinanceDb")

    async def get_accounts_async(self, user_id: str) -> list[dict]:
        if not self.client:
            return []
            
        db = self.client.get_database_client(self.db_name)
        
        # Fetch account groups to map Group ID to Group Name
        group_map = {}
        try:
            groups_container = db.get_container_client("AccountGroups")
            groups_query = "SELECT * FROM c"
            groups_items = groups_container.query_items(
                query=groups_query,
                partition_key=user_id
            )
            async for item in groups_items:
                g_id = item.get("id")
                g_name = item.get("Name", item.get("name"))
                if g_id and g_name:
                    group_map[g_id] = g_name
        except Exception as e:
            # Fallback gracefully if AccountGroups container fails
            import logging
            logging.warning(f"Failed to fetch account groups: {e}")

        # Fetch accounts
        container = db.get_container_client("Accounts")
        
        query = "SELECT * FROM c"
        items = container.query_items(
            query=query,
            partition_key=user_id
        )
        accounts = []
        async for item in items:
            g_id = item.get("AccountGroupId", item.get("accountGroupId"))
            accounts.append({
                "id": item.get("id"),
                "name": item.get("Name", item.get("name")),
                "description": item.get("Description", item.get("description")),
                "accountType": item.get("AccountType", item.get("accountType")),
                "accountGroupId": g_id,
                "accountGroupName": group_map.get(g_id) if g_id else None
            })
        return accounts

    async def get_specific_accounts_async(self, user_id: str, account_ids: list[str]) -> list[dict]:
        if not self.client or not account_ids:
            return []
            
        valid_ids = [aid for aid in account_ids if aid]
        if not valid_ids:
            return []
            
        db = self.client.get_database_client(self.db_name)
        
        # 1. Fetch only the requested accounts
        container = db.get_container_client("Accounts")
        parameters = [{"name": f"@id{i}", "value": val} for i, val in enumerate(valid_ids)]
        param_names = ", ".join(p["name"] for p in parameters)
        
        query = f"SELECT * FROM c WHERE c.id IN ({param_names})"
        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=user_id
        )
        
        accounts = []
        group_ids = set()
        async for item in items:
            g_id = item.get("AccountGroupId", item.get("accountGroupId"))
            if g_id:
                group_ids.add(g_id)
            accounts.append({
                "id": item.get("id"),
                "name": item.get("Name", item.get("name")),
                "accountGroupId": g_id
            })
            
        # 2. Fetch only the required account groups
        group_map = {}
        if group_ids:
            try:
                groups_container = db.get_container_client("AccountGroups")
                g_params = [{"name": f"@gid{i}", "value": val} for i, val in enumerate(group_ids)]
                g_param_names = ", ".join(p["name"] for p in g_params)
                
                g_query = f"SELECT c.id, c.Name, c.name FROM c WHERE c.id IN ({g_param_names})"
                g_items = groups_container.query_items(
                    query=g_query,
                    parameters=g_params,
                    partition_key=user_id
                )
                async for item in g_items:
                    g_id = item.get("id")
                    g_name = item.get("Name", item.get("name"))
                    if g_id and g_name:
                        group_map[g_id] = g_name
            except Exception as e:
                import logging
                logging.warning(f"Failed to fetch specific account groups: {e}")
                
        # 3. Assemble and return
        for acc in accounts:
            g_id = acc["accountGroupId"]
            acc["accountGroupName"] = group_map.get(g_id) if g_id else None
            
        return accounts

    async def search_vendors_by_lookups_async(self, user_id: str, lookups: list[str]) -> str | None:
        if not self.client or not lookups:
            return None
            
        db = self.client.get_database_client(self.db_name)
        try:
            lookup_container = db.get_container_client("VendorLookups")
            lookup_values = [loc.lower().strip() for loc in lookups if loc and isinstance(loc, str) and loc.strip()]
            if not lookup_values:
                return None
                
            parameters = [{"name": f"@p{i}", "value": val} for i, val in enumerate(lookup_values)]
            param_names = ", ".join(p["name"] for p in parameters)
            
            query = f"SELECT c.VendorId FROM c WHERE c.LookupValue IN ({param_names})"
            items = lookup_container.query_items(
                query=query,
                parameters=parameters,
                partition_key=user_id,
                max_item_count=1
            )
            
            vendor_id = None
            async for item in items:
                vendor_id = item.get("VendorId")
                break
                
            if vendor_id:
                vendor_container = db.get_container_client("Vendors")
                try:
                    vendor = await vendor_container.read_item(item=vendor_id, partition_key=user_id)
                    return vendor.get("Name")
                except Exception:
                    return None
        except Exception as e:
            import logging
            logging.warning(f"Error searching vendors by lookups: {e}")
        return None



    async def get_runbook_content_async(self, user_id: str) -> str:
        if not self.client:
            return ""
        try:
            db = self.client.get_database_client(self.db_name)
            container = db.get_container_client("Settings")
            item = await container.read_item(item="runbook", partition_key=user_id)
            return item.get("content", "")
        except Exception:
            return ""

    async def save_runbook_content_async(self, user_id: str, content: str) -> None:
        if not self.client:
            return
        db = self.client.get_database_client(self.db_name)
        container = db.get_container_client("Settings")
        doc = {
            "id": "runbook",
            "UserId": user_id,
            "content": content
        }
        await container.upsert_item(doc)
