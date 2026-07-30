using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using FinanceApp.Interfaces;
using FinanceApp.Models;
using System.Text.Json;
using FinanceApp.Extensions;

namespace FinanceApp.Functions
{
    public class VendorFunctions
    {
        private readonly IVendorService _vendorService;
        private readonly ILogger<VendorFunctions> _logger;

        private static readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        public VendorFunctions(IVendorService vendorService, ILogger<VendorFunctions> logger)
        {
            _vendorService = vendorService;
            _logger = logger;
        }

        [Function("GetVendors")]
        public async Task<IActionResult> GetVendors(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "vendors")] HttpRequest req, FunctionContext context)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            var vendors = await _vendorService.GetVendorsAsync(userId);
            return new OkObjectResult(vendors);
        }

        [Function("CreateVendor")]
        public async Task<IActionResult> CreateVendor(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "vendors")] HttpRequest req, FunctionContext context)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            using var doc = JsonDocument.Parse(requestBody);
            
            if (!doc.RootElement.TryGetProperty("name", out var nameProp) || string.IsNullOrWhiteSpace(nameProp.GetString()))
            {
                return new BadRequestObjectResult("Vendor name is required.");
            }

            var vendor = await _vendorService.CreateVendorAsync(userId, nameProp.GetString()!);
            return new CreatedResult($"/api/vendors/{vendor.Id}", vendor);
        }

        [Function("DeleteVendor")]
        public async Task<IActionResult> DeleteVendor(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "vendors/{id}")] HttpRequest req, FunctionContext context,
            string id)
        {
            string? userId = context.GetUserId();
            if (string.IsNullOrEmpty(userId)) return new UnauthorizedResult();
            await _vendorService.DeleteVendorAsync(userId, id);
            return new NoContentResult();
        }
    }
}

