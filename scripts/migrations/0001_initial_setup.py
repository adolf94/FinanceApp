from azure.cosmos import PartitionKey

def up(db):
    """Run initial setup: create all standard containers."""
    
    # 1. Standard C# Backend Containers (partitioned by /UserId)
    cs_containers = [
        "Accounts",
        "AccountGroups",
        "Vendors",
        "Transactions",
        "RecurringTransactions"
    ]
    
    for container_name in cs_containers:
        print(f"Ensuring container '{container_name}' exists (partition key: /UserId)...")
        db.create_container_if_not_exists(
            id=container_name,
            partition_key=PartitionKey(path="/UserId")
        )
        
    # 2. Python Ingester Containers (partitioned by /UserId)
    py_containers = [
        "PendingIngestions",
        "TransactionVectors"
    ]
    
    for container_name in py_containers:
        print(f"Ensuring container '{container_name}' exists (partition key: /UserId)...")
        db.create_container_if_not_exists(
            id=container_name,
            partition_key=PartitionKey(path="/UserId")
        )
        
    # 3. Notification Messages Container (with 60-day default TTL)
    print("Ensuring container 'PhoneHookMessages' exists with 60-day TTL...")
    db.create_container_if_not_exists(
        id="PhoneHookMessages",
        partition_key=PartitionKey(path="/UserId"),
        default_ttl=60 * 24 * 60 * 60 # 60 days in seconds
    )
    
    # 4. Change Feed Lease Container (partitioned by /id)
    print("Ensuring lease container 'PhoneHookMessages-leases' exists...")
    db.create_container_if_not_exists(
        id="PhoneHookMessages-leases",
        partition_key=PartitionKey(path="/id")
    )
    
    print("All initial containers initialized successfully!")
