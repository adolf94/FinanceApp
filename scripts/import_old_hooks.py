import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone
from azure.cosmos import CosmosClient
from uuid_extensions import uuid7

# Add workspace root to system path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

def load_settings():
    """Load settings from local.settings.json or environment."""
    settings = {
        "CosmosConnectionString": "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
        "COSMOS_DB": "FinanceDb"
    }
    
    # Try reading from notif-ingester/local.settings.json first
    ingester_settings = ROOT_DIR / "notif-ingester" / "local.settings.json"
    if ingester_settings.exists():
        try:
            with open(ingester_settings, "r") as f:
                data = json.load(f)
                values = data.get("Values", {})
                if "CosmosConnectionString" in values:
                    settings["CosmosConnectionString"] = values["CosmosConnectionString"]
                if "COSMOS_DB" in values:
                    settings["COSMOS_DB"] = values["COSMOS_DB"]
            print(f"Loaded config from {ingester_settings}")
        except Exception as e:
            print(f"Warning: Failed to read {ingester_settings}: {e}")
            
    return settings

def parse_amount(extracted_data):
    if not extracted_data:
        return None
    amt_str = extracted_data.get("amount")
    if not amt_str:
        return None
    try:
        # Remove commas and convert to float
        return float(str(amt_str).replace(",", "").strip())
    except Exception:
        return None

def main():
    settings = load_settings()
    conn_str = settings["CosmosConnectionString"]
    new_db_name = settings["COSMOS_DB"]
    old_db_name = "FinanceAppLocal"
    
    print(f"Connecting to Cosmos DB Emulator...")
    client = CosmosClient.from_connection_string(conn_str)
    
    # Get source container
    try:
        old_db = client.get_database_client(old_db_name)
        old_container = old_db.get_container_client("HookMessages")
    except Exception as e:
        print(f"Error connecting to source database/container '{old_db_name}.HookMessages': {e}")
        sys.exit(1)
        
    # Get target containers
    try:
        new_db = client.get_database_client(new_db_name)
        phone_hook_container = new_db.get_container_client("PhoneHookMessages")
        pending_container = new_db.get_container_client("PendingIngestions")
    except Exception as e:
        print(f"Error connecting to target containers: {e}")
        sys.exit(1)
        
    print(f"Querying historical SMS/Notification hooks from {old_db_name}.HookMessages...")
    query = "SELECT * FROM c WHERE c.Type IN ('sms', 'notif')"
    try:
        old_items = list(old_container.query_items(query, enable_cross_partition_query=True))
        print(f"Found {len(old_items)} items to import.")
    except Exception as e:
        print(f"Error querying old items: {e}")
        sys.exit(1)
        
    success_count = 0
    error_count = 0
    
    for idx, old_item in enumerate(old_items):
        try:
            # 1. Map and save PhoneHookMessage as "processed" to prevent AI trigger, but keep historical audit log
            old_id = old_item["id"]
            received_at_str = old_item.get("Date") or datetime.now(timezone.utc).isoformat()
            month_key = old_item.get("MonthKey") or datetime.now(timezone.utc).strftime("%Y-%m-01")
            
            raw_payload = old_item.get("JsonData") or {}
            raw_msg = old_item.get("RawMsg") or "Unknown notification"
            
            phone_hook_doc = {
                "id": old_id,
                "UserId": "default",
                "received_at": received_at_str,
                "action": old_item.get("Type") or "notif",
                "raw_payload": raw_payload,
                "raw_msg": raw_msg,
                "status": "processed",  # processed status bypasses the AI change feed trigger!
                "month_key": month_key,
                "partition_key": month_key,
                "_ttl": 60 * 24 * 60 * 60
            }
            phone_hook_container.upsert_item(phone_hook_doc)
            
            # 2. Map and save directly into PendingIngestions with "Pending" status for review
            extracted = old_item.get("ExtractedData") or {}
            amount = parse_amount(extracted)
            
            # Extracted vendor if available
            vendor = extracted.get("recipientName") or extracted.get("senderName") or ""
            
            ai_parsed = {
                "is_financial": True,
                "vendor": vendor,
                "amount": amount,
                "transaction_type": None,
                "debit_account_id": None,
                "credit_account_id": None,
                "category": None,
                "notes": None,
                "confidence": 0.0,
                "recipient_account_number": extracted.get("recipientAcct") or extracted.get("ownAcct") or None,
                "recipient_account_name": extracted.get("recipientName") or None,
                "sender_account_number": extracted.get("senderAcct") or None,
                "sender_account_name": extracted.get("senderName") or None,
                "application": raw_payload.get("notif_pkg") or None
            }
            
            pending_doc = {
                "id": str(uuid7()), # Generate time-based time-ordered uuid7
                "UserId": "default",
                "hook_id": old_id,
                "received_at": received_at_str,
                "raw_payload": raw_payload,
                "raw_msg": raw_msg,
                "ai_parsed": ai_parsed,
                "user_confirmed": {},
                "similarity_score": 0.0,
                "top_matches": [],
                "status": "Pending",
                "transaction_id": None,
                "month_key": month_key,
                "partition_key": month_key
            }
            pending_container.upsert_item(pending_doc)
            
            success_count += 1
            if success_count % 50 == 0 or success_count == len(old_items):
                print(f"Progress: Imported {success_count}/{len(old_items)} items...")
                
        except Exception as e:
            print(f"Error importing item ID {old_item.get('id')}: {e}")
            error_count += 1
            
    print(f"\nImport finished! Success: {success_count}, Errors: {error_count}")

if __name__ == "__main__":
    main()
