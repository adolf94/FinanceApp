using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using FinanceApp.Interfaces;
using FinanceApp.Models;
using System.Text.Json;
using FinanceApp.Extensions;
using System.Text.Json.Serialization;

namespace FinanceApp.Functions
{
    public class TransactionFunctions
    {
        private readonly ITransactionService _transactionService;
        private readonly ILogger<TransactionFunctions> _logger;

        private static readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() }
        };

        public TransactionFunctions(ITransactionService transactionService, ILogger<TransactionFunctions> logger)
        {
            _transactionService = transactionService;
            _logger = logger;
        }

        [Function("GetTransactions")]
        public async Task<IActionResult> GetTransactions(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "transactions")] HttpRequest req, FunctionContext context)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            
            DateTime? startDate = null;
            DateTime? endDate = null;

            if (DateTime.TryParse(req.Query["startDate"], out var parsedStart))
            {
                startDate = parsedStart;
            }
            if (DateTime.TryParse(req.Query["endDate"], out var parsedEnd))
            {
                endDate = parsedEnd;
            }

            string? accountGroupId = req.Query["accountGroupId"];

            var transactions = await _transactionService.GetTransactionsAsync(userId, startDate, endDate, accountGroupId);
            return new OkObjectResult(transactions);
        }

        [Function("GetTransactionById")]
        public async Task<IActionResult> GetTransactionById(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "transactions/{id}")] HttpRequest req, FunctionContext context,
            string id)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            var transaction = await _transactionService.GetTransactionByIdAsync(userId, id);
            if (transaction == null)
            {
                return new NotFoundResult();
            }
            return new OkObjectResult(transaction);
        }

        [Function("GetTransactionsByAccountId")]
        public async Task<IActionResult> GetTransactionsByAccountId(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "accounts/{accountId}/transactions")] HttpRequest req, FunctionContext context,
            string accountId)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            var transactions = await _transactionService.GetTransactionsByAccountIdAsync(userId, accountId);
            return new OkObjectResult(transactions);
        }

        [Function("CreateTransaction")]
        public async Task<IActionResult> CreateTransaction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "transactions")] HttpRequest req, FunctionContext context)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var transaction = JsonSerializer.Deserialize<Transaction>(requestBody, _jsonOptions);

            if (transaction == null)
            {
                return new BadRequestObjectResult("Invalid transaction data.");
            }

            try
            {
                var createdTx = await _transactionService.CreateTransactionAsync(userId, transaction);
                return new CreatedResult($"/api/transactions/{createdTx.Id}", createdTx);
            }
            catch (KeyNotFoundException ex)
            {
                return new NotFoundObjectResult(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
        }

        [Function("UpdateTransaction")]
        public async Task<IActionResult> UpdateTransaction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "transactions/{id}")] HttpRequest req, FunctionContext context,
            string id)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var transaction = JsonSerializer.Deserialize<Transaction>(requestBody, _jsonOptions);

            if (transaction == null)
            {
                return new BadRequestObjectResult("Invalid transaction data.");
            }

            transaction.Id = id;
            try
            {
                var updatedTx = await _transactionService.UpdateTransactionAsync(userId, transaction);
                return new OkObjectResult(updatedTx);
            }
            catch (KeyNotFoundException ex)
            {
                return new NotFoundObjectResult(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
        }

        [Function("DeleteTransaction")]
        public async Task<IActionResult> DeleteTransaction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "transactions/{id}")] HttpRequest req, FunctionContext context,
            string id)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            try
            {
                await _transactionService.DeleteTransactionAsync(userId, id);
                return new NoContentResult();
            }
            catch (KeyNotFoundException ex)
            {
                return new NotFoundObjectResult(ex.Message);
            }
        }
    }
}

