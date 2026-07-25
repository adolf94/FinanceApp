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

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

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
    database_name=os.environ.get("COSMOS_DB", "FinanceDb"),
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

# ── Function 3: ConfirmIngestionFunction ──────────────────────────────────
@app.route(route="ingestions/{ingestion_id}/confirm", methods=["POST"])
async def ConfirmIngestionFunction(req: func.HttpRequest) -> func.HttpResponse:
    if not validate_api_key(req):
        return func.HttpResponse("Unauthorized", status_code=401)
        
    ingestion_id = req.route_params.get("ingestion_id")
    user_id = req.headers.get("x-user-id", "default")
    
    ingestion_service = get_ingestion_service()
    
    try:
        confirmed = await ingestion_service.confirm_ingestion_async(ingestion_id, user_id)
        return func.HttpResponse(
            json.dumps(confirmed.model_dump(by_alias=True, mode="json")),
            status_code=200,
            mimetype="application/json"
        )
    except ValueError as e:
        return func.HttpResponse(str(e), status_code=404)
    except Exception as e:
        logging.error(f"Error confirming ingestion: {e}")
        return func.HttpResponse(f"Internal server error: {e}", status_code=500)
