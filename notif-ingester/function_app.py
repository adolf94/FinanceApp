import azure.functions as func
import os
import json
import logging
from models.phone_hook import PhoneHookMessage
from repositories.hook_repository import CosmosHookRepository
from repositories.ingestion_repository import CosmosIngestionRepository
from repositories.vector_repository import CosmosVectorRepository
from services.hook_service import HookService
from services.embedding_service import EmbeddingService
from services.vector_service import VectorService
from services.ai_service import AiService
from services.finance_api_service import FinanceApiService
from services.ingestion_service import IngestionService
from ar_auth.client import ArAuthClient
from ar_auth.exceptions import TokenValidationError
from typing import Optional, Tuple

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# Shared auth client (caches JWKS)
_auth_client = ArAuthClient(authority="https://auth.adolfrey.com/api")

def _require_auth(req: func.HttpRequest) -> Tuple[Optional[dict], Optional[func.HttpResponse]]:
    """Validate Bearer JWT. Returns (payload, None) on success, (None, error_response) on failure."""
    auth_header = req.headers.get("Authorization") or req.headers.get("authorization", "")
    if not auth_header:
        return None, func.HttpResponse(
            json.dumps({"error": "authorization_header_missing"}),
            status_code=401, mimetype="application/json"
        )
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None, func.HttpResponse(
            json.dumps({"error": "invalid_header", "description": "Expected: Bearer <token>"}),
            status_code=401, mimetype="application/json"
        )
    try:
        payload = _auth_client.verify_token(parts[1])
        return payload, None
    except TokenValidationError as e:
        return None, func.HttpResponse(
            json.dumps({"error": "invalid_token", "description": str(e)}),
            status_code=401, mimetype="application/json"
        )

# Setup dependencies
def get_hook_service():
    repo = CosmosHookRepository()
    return HookService(repo)

def get_ingestion_service():
    ingestion_repo = CosmosIngestionRepository()
    vector_repo = CosmosVectorRepository()
    embedding_service = EmbeddingService()
    vector_service = VectorService(vector_repo)
    ai_service = AiService()
    finance_api_service = FinanceApiService()
    
    return IngestionService(
        ingestion_repo=ingestion_repo,
        embedding_service=embedding_service,
        vector_service=vector_service,
        ai_service=ai_service,
        finance_api_service=finance_api_service
    )

def validate_api_key(req: func.HttpRequest) -> bool:
    expected_key = os.environ.get("API_KEY")
    provided_key = req.headers.get("x-api-key")
    return bool(expected_key and provided_key and expected_key == provided_key)

# ── Function 1: PhoneHookFunction ──────────────────────────────────────────
@app.route(route="phone_hook", methods=["POST"])
async def PhoneHookFunction(req: func.HttpRequest) -> func.HttpResponse:
    if not validate_api_key(req):
        return func.HttpResponse("Unauthorized", status_code=401)
        
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)
        
    hook_service = get_hook_service()
    
    try:
        hook_msg = await hook_service.save_hook_async(body)
        return func.HttpResponse(
            json.dumps(hook_msg.model_dump(by_alias=True, mode="json")),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error saving hook: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)

# ── Function 2: ClassifyNotificationFunction ────────────────────────────────
@app.cosmos_db_trigger(
    arg_name="documents",
    connection="CosmosConnectionString",
    database_name="%COSMOS_DB%",
    container_name="PhoneHookMessages",
    lease_container_name="PhoneHookMessages-leases",
    create_lease_container_if_not_exists=True,
)
async def ClassifyNotificationFunction(documents: func.DocumentList) -> None:
    if not documents:
        return
        
    ingestion_service = get_ingestion_service()
    hook_repo = CosmosHookRepository()
    
    for doc in documents:
        doc_dict = dict(doc)
        if doc_dict.get("status") != "received":
            continue
            
        try:
            hook_msg = PhoneHookMessage(**doc_dict)
            await ingestion_service.process_hook_async(hook_msg)
            
            # Mark hook as processed
            await hook_repo.update_status_async(
                hook_msg.id, "processed", hook_msg.user_id
            )
        except Exception as e:
            logging.error(f"Error processing document {doc_dict.get('id')}: {e}")
            await hook_repo.update_status_async(
                doc_dict.get("id"), "error", doc_dict.get("user_id", "default")
            )

# ── Function 3: LearnIngestionFunction ──────────────────────────────────
@app.route(route="ingestions/{ingestion_id}/learn", methods=["POST"])
async def LearnIngestionFunction(req: func.HttpRequest) -> func.HttpResponse:
    user, err = _require_auth(req)
    if err: return err

    ingestion_id = req.route_params.get("ingestion_id")
    body = {}
    try:
        body = req.get_json() or {}
    except ValueError:
        pass

    user_id = user.get("sub", "default")
    user_confirmed = {k: v for k, v in body.items() if k != "user_id"}

    ingestion_service = get_ingestion_service()
    try:
        learned = await ingestion_service.learn_ingestion_async(ingestion_id, user_id, user_confirmed)
        return func.HttpResponse(
            json.dumps(learned.model_dump(by_alias=True, mode="json")),
            status_code=200, mimetype="application/json"
        )
    except ValueError as e:
        return func.HttpResponse(str(e), status_code=404)
    except Exception as e:
        logging.error(f"Error learning ingestion: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)

# ── Function 4: ReclassifyIngestionFunction ───────────────────────────────
@app.route(route="ingestions/{ingestion_id}/reclassify", methods=["POST"])
async def ReclassifyIngestionFunction(req: func.HttpRequest) -> func.HttpResponse:
    user, err = _require_auth(req)
    if err: return err

    ingestion_id = req.route_params.get("ingestion_id")
    user_id = user.get("sub", "default")
    
    ingestion_service = get_ingestion_service()
    
    try:
        reclassified = await ingestion_service.reclassify_ingestion_async(ingestion_id, user_id)
        return func.HttpResponse(
            json.dumps(reclassified.model_dump(by_alias=True, mode="json")),
            status_code=200,
            mimetype="application/json"
        )
    except ValueError as e:
        return func.HttpResponse(str(e), status_code=404)
    except Exception as e:
        logging.error(f"Error reclassifying ingestion: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)

# ── Function 5: ClassifyHookFunction (Synchronous classification endpoint) ─
@app.route(route="ingestions/classify-hook", methods=["POST"])
async def ClassifyHookFunction(req: func.HttpRequest) -> func.HttpResponse:
    user, err = _require_auth(req)
    if err: return err
        
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)
        
    ingestion_service = get_ingestion_service()
    
    try:
        hook_msg = PhoneHookMessage(**body)
        # Process the hook synchronously using Gemini AI
        pending_ingestion = await ingestion_service.process_hook_async(hook_msg)
        return func.HttpResponse(
            json.dumps(pending_ingestion.model_dump(by_alias=True, mode="json")),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error processing synchronous classification: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)

# ── Function 6: GenerateAccountDescriptionFunction ─────────────────────────
@app.route(route="accounts/generate-description", methods=["POST"])
async def GenerateAccountDescriptionFunction(req: func.HttpRequest) -> func.HttpResponse:
    user, err = _require_auth(req)
    if err: return err

    try:
        body = req.get_json()
        account_name = body.get("name", "")
        account_type = body.get("type", "")
        group_name = body.get("groupName", "")
        context_str = body.get("context", "")
        user_id = user.get("sub", "default")
    except ValueError:
        return func.HttpResponse("Invalid JSON", status_code=400)
        
    if not account_name or not account_type or not group_name:
        return func.HttpResponse("Missing required fields: name, type, groupName", status_code=400)
        
    ingestion_service = get_ingestion_service()
    try:
        description = await ingestion_service.generate_account_description_async(
            user_id=user_id,
            account_name=account_name,
            account_type=account_type,
            group_name=group_name,
            context=context_str
        )
        return func.HttpResponse(
            json.dumps({"description": description}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error generating account description: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)


# ── Function 7: GetHistoricalHooksFunction ─────────────────────────────────
@app.route(route="historical-hooks", methods=["GET"])
async def GetHistoricalHooksFunction(req: func.HttpRequest) -> func.HttpResponse:
    _, err = _require_auth(req)
    if err: return err
    old_conn = os.environ.get("OldCosmosConnectionString", "")
    old_db = os.environ.get("OLD_COSMOS_DB", "FinanceAppLocal")

    if not old_conn:
        return func.HttpResponse("OldCosmosConnectionString not configured", status_code=500)

    from azure.cosmos.aio import CosmosClient as AsyncCosmosClient

    try:
        async with AsyncCosmosClient.from_connection_string(old_conn) as client:
            container = client.get_database_client(old_db).get_container_client("HookMessages")
            query = (
                "SELECT * FROM c "
                "WHERE c.JsonData.action IN ('notif_post', 'sms_receive') "
                "AND (NOT IS_DEFINED(c.Status) OR (c.Status != 'Imported' AND c.Status != 'Ignored')) "
                "ORDER BY c.Date DESC"
            )
            results = []
            async for item in container.query_items(query=query, max_item_count=100):
                results.append(item)
                if len(results) >= 100:
                    break

        return func.HttpResponse(
            json.dumps(results, default=str),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as e:
        logging.error(f"Error fetching historical hooks: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)


# ── Function 8: ImportHistoricalHookFunction ────────────────────────────────
@app.route(route="historical-hooks/{hook_id}/import", methods=["POST"])
async def ImportHistoricalHookFunction(req: func.HttpRequest) -> func.HttpResponse:
    user, err = _require_auth(req)
    if err: return err

    hook_id = req.route_params.get("hook_id")
    user_id = user.get("sub", "default")

    old_conn = os.environ.get("OldCosmosConnectionString", "")
    old_db = os.environ.get("OLD_COSMOS_DB", "FinanceAppLocal")

    if not old_conn:
        return func.HttpResponse("OldCosmosConnectionString not configured", status_code=500)

    from azure.cosmos.aio import CosmosClient as AsyncCosmosClient
    from datetime import datetime, timezone

    def _scalar(val):
        """Flatten any value to a plain string — handles arrays, dicts, primitives."""
        if val is None:
            return ""
        if isinstance(val, list):
            return str(val[0]) if val else ""
        if isinstance(val, dict):
            return json.dumps(val)
        return str(val)

    try:
        async with AsyncCosmosClient.from_connection_string(old_conn) as client:
            old_container = client.get_database_client(old_db).get_container_client("HookMessages")

            # 1. Fetch old item
            old_item = None
            async for item in old_container.query_items(
                query="SELECT * FROM c WHERE c.id = @id",
                parameters=[{"name": "@id", "value": hook_id}],
            ):
                old_item = item
                break

            if old_item is None:
                return func.HttpResponse(f"Hook {hook_id} not found in old database", status_code=404)

            # 2. Mark old item as Imported
            old_item["Status"] = "Imported"
            await old_container.upsert_item(old_item)

        # 3. Map old schema → PhoneHookMessage (no type juggling needed in Python)
        date_str = _scalar(old_item.get("Date"))
        try:
            received_at = datetime.fromisoformat(date_str.replace("Z", "+00:00")) if date_str else datetime.now(timezone.utc)
        except ValueError:
            received_at = datetime.now(timezone.utc)

        received_at = received_at.astimezone(timezone.utc)
        month_key = received_at.strftime("%Y-%m-01")

        # Flatten JsonData arrays/primitives to plain strings
        json_data: dict = old_item.get("JsonData") or {}
        raw_payload = {k: _scalar(v) for k, v in json_data.items()}

        # Merge ExtractedData fields
        extracted: dict = old_item.get("ExtractedData") or {}
        if app_val := _scalar(extracted.get("app")):
            raw_payload.setdefault("notif_pkg", app_val)
        if sender_val := _scalar(extracted.get("senderName")):
            raw_payload.setdefault("sms_sender", sender_val)

        raw_msg = _scalar(old_item.get("RawMsg")) or "Unknown notification"
        action = _scalar(old_item.get("Type")) or "notif"

        hook_msg = PhoneHookMessage(
            id=hook_id,
            UserId=user_id,
            received_at=received_at,
            action=action,
            raw_payload=raw_payload,
            raw_msg=raw_msg,
            status="processed",
            month_key=month_key,
            partition_key=month_key,
        )

        # 4. Upsert into new CosmosDB PhoneHookMessages
        hook_repo = CosmosHookRepository()
        await hook_repo.add_async(hook_msg)

        # 5. Classify synchronously
        ingestion_service = get_ingestion_service()
        pending_ingestion = await ingestion_service.process_hook_async(hook_msg)

        return func.HttpResponse(
            json.dumps(pending_ingestion.model_dump(by_alias=True, mode="json")),
            status_code=200,
            mimetype="application/json",
        )

    except Exception as e:
        logging.error(f"Error importing historical hook {hook_id}: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)


# ── Function 9: IgnoreHistoricalHookFunction ────────────────────────────────
@app.route(route="historical-hooks/{hook_id}/ignore", methods=["POST"])
async def IgnoreHistoricalHookFunction(req: func.HttpRequest) -> func.HttpResponse:
    _, err = _require_auth(req)
    if err: return err

    hook_id = req.route_params.get("hook_id")

    old_conn = os.environ.get("OldCosmosConnectionString", "")
    old_db = os.environ.get("OLD_COSMOS_DB", "FinanceAppLocal")

    if not old_conn:
        return func.HttpResponse("OldCosmosConnectionString not configured", status_code=500)

    from azure.cosmos.aio import CosmosClient as AsyncCosmosClient

    try:
        async with AsyncCosmosClient.from_connection_string(old_conn) as client:
            container = client.get_database_client(old_db).get_container_client("HookMessages")

            old_item = None
            async for item in container.query_items(
                query="SELECT * FROM c WHERE c.id = @id",
                parameters=[{"name": "@id", "value": hook_id}],
            ):
                old_item = item
                break

            if old_item is None:
                return func.HttpResponse(f"Hook {hook_id} not found", status_code=404)

            old_item["Status"] = "Ignored"
            await container.upsert_item(old_item)

        return func.HttpResponse(
            json.dumps({"id": hook_id, "status": "Ignored"}),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as e:
        logging.error(f"Error ignoring historical hook {hook_id}: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)
