---
name: model-syncer
description: Synchronizes class properties and enums between .NET Core (C#) models and Python Pydantic models.
---

# Model Syncer Skill

This skill outlines the strict rules and procedures for synchronizing data models between the C# backend (`backend/Models/`) and the Python notification ingester (`notif-ingester/models/`).

## Synchronization Rules

### 1. Casing and Serialization (Crucial)
* **C# Models:** Standard PascalCase properties (e.g., `UserId`, `AccountType`).
* **Python Models:** Standard snake_case fields (e.g., `user_id`, `account_type`).
* **Cosmos DB Compatibility:** 
  * C# EF Core writes properties using PascalCase or matches property name casing directly in the JSON document.
  * Python models MUST use Pydantic `Field(..., alias="PascalCaseName")` and `Config.populate_by_name = True` to guarantee that documents serialized by Python match the C# property casing in Cosmos DB.

### 2. Type Mapping Table

| C# Type | Python (Pydantic) Type | Notes |
| :--- | :--- | :--- |
| `string` | `str` | |
| `string?` / Nullable | `Optional[str]` | Default to `None` |
| `int` | `int` | |
| `int?` | `Optional[int]` | Default to `None` |
| `decimal` | `Decimal` (from `decimal`) or `float` | Use `Decimal` for financial calculations |
| `DateTime` | `datetime` (from `datetime`) | |
| `DateTime?` | `Optional[datetime]` | |
| `List<T>` / `IEnumerable<T>` | `List[T]` (from `typing`) | |
| `Dictionary<string, object>` | `dict` or `Dict[str, Any]` | |

### 3. Enum Handling
* Enums in C# mapped with `[JsonConverter(typeof(JsonStringEnumConverter))]` must map to standard Python `str` subclasses of `Enum` in `notif-ingester/models/enums.py`.
* Example:
  ```python
  from enum import Enum
  
  class AccountType(str, Enum):
      Cash = "Cash"
      Bank = "Bank"
  ```

### 4. Updating Models
When updating models:
1. Identify the source change (C# or Python).
2. Apply the matching changes to the corresponding file on the other side.
3. Keep the file `notif-ingester/models/__init__.py` updated with appropriate imports.
