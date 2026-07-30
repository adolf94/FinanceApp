using System.Security.Claims;
using Microsoft.Azure.Functions.Worker;

namespace FinanceApp.Extensions
{
    public static class FunctionContextExtensions
    {
        public static string? GetUserId(this FunctionContext context)
        {
            if (context.Items.TryGetValue("ArAuthUser", out var userObj) && userObj is ClaimsPrincipal principal)
            {
                return principal.FindFirst("sub")?.Value 
                       ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            }
            return null;
        }
    }
}
