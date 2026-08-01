from azure.cosmos import PartitionKey

def up(db):
    """Create the Settings container partitioned by /UserId."""
    print("Ensuring container 'Settings' exists (partition key: /UserId)...")
    db.create_container_if_not_exists(
        id="Settings",
        partition_key=PartitionKey(path="/UserId")
    )
