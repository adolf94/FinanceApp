import os
import sys
import json
import importlib.util
from pathlib import Path
from datetime import datetime, timezone
from azure.cosmos import CosmosClient, PartitionKey

# Add workspace root to system path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

def load_settings():
    """Load settings from local.settings.json or environment."""
    settings = {
        "CosmosConnectionString": "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
        "COSMOS_DB": "FinanceDb"
    }
    
    # Try backend settings first
    backend_settings = ROOT_DIR / "backend" / "local.settings.json"
    ingester_settings = ROOT_DIR / "notif-ingester" / "local.settings.json"
    
    for settings_path in [backend_settings, ingester_settings]:
        if settings_path.exists():
            try:
                with open(settings_path, "r") as f:
                    data = json.load(f)
                    values = data.get("Values", {})
                    if "CosmosConnectionString" in values:
                        settings["CosmosConnectionString"] = values["CosmosConnectionString"]
                    if "COSMOS_DB" in values:
                        settings["COSMOS_DB"] = values["COSMOS_DB"]
                    elif "CosmosDatabaseName" in values:
                        settings["COSMOS_DB"] = values["CosmosDatabaseName"]
                print(f"Loaded config from {settings_path}")
                break
            except Exception as e:
                print(f"Warning: Failed to read {settings_path}: {e}")
                
    if "CosmosConnectionString" in os.environ:
        settings["CosmosConnectionString"] = os.environ["CosmosConnectionString"]
    if "COSMOS_DB" in os.environ:
        settings["COSMOS_DB"] = os.environ["COSMOS_DB"]
        
    return settings

def get_applied_migrations(db):
    """Retrieve list of applied migrations from Cosmos DB."""
    # Ensure the SchemaMigrations container exists
    print("Ensuring 'SchemaMigrations' container exists...")
    migrations_container = db.create_container_if_not_exists(
        id="SchemaMigrations",
        partition_key=PartitionKey(path="/id")
    )
    
    applied = []
    try:
        items = migrations_container.query_items(
            query="SELECT c.id FROM c",
            enable_cross_partition_query=True
        )
        for item in items:
            applied.append(item["id"])
    except Exception as e:
        print(f"Error querying applied migrations: {e}")
        
    return applied, migrations_container

def record_migration(container, migration_name):
    """Record that a migration has been successfully applied."""
    container.upsert_item({
        "id": migration_name,
        "applied_at": datetime.now(timezone.utc).isoformat()
    })

def main():
    settings = load_settings()
    conn_str = settings["CosmosConnectionString"]
    db_name = settings["COSMOS_DB"]
    
    print("Connecting to Cosmos DB...")
    client = CosmosClient.from_connection_string(conn_str)
    db = client.create_database_if_not_exists(id=db_name)
    
    applied_list, migrations_container = get_applied_migrations(db)
    print(f"Applied migrations: {applied_list}")
    
    # Scan migrations folder
    migrations_dir = ROOT_DIR / "scripts" / "migrations"
    if not migrations_dir.exists():
        print(f"Migrations folder missing: {migrations_dir}")
        sys.exit(1)
        
    # Get all python files matching \d{4}_*.py
    migration_files = sorted([
        f for f in migrations_dir.glob("*.py")
        if f.name != "__init__.py" and f.name[:4].isdigit()
    ])
    
    run_count = 0
    for migration_file in migration_files:
        name = migration_file.stem
        if name in applied_list:
            continue
            
        print(f"\n---> Running migration: {name}")
        
        # Load and execute migration script dynamically
        spec = importlib.util.spec_from_file_location(name, migration_file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        if not hasattr(module, "up"):
            print(f"Error: Migration '{name}' does not contain an 'up' function.")
            sys.exit(1)
            
        try:
            module.up(db)
            record_migration(migrations_container, name)
            print(f"--> Successfully applied: {name}")
            run_count += 1
        except Exception as e:
            print(f"Error applying migration '{name}': {e}")
            sys.exit(1)
            
    if run_count == 0:
        print("\nDatabase is already up to date. No migrations to run.")
    else:
        print(f"\nSuccessfully applied {run_count} migrations!")

if __name__ == "__main__":
    main()
