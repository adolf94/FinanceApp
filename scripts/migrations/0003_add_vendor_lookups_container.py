from azure.cosmos import PartitionKey

def up(db):
    """Create the VendorLookups container partitioned by /UserId."""
    print("Ensuring container 'VendorLookups' exists (partition key: /UserId)...")
    db.create_container_if_not_exists(
        id="VendorLookups",
        partition_key=PartitionKey(path="/UserId")
    )
