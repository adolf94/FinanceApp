using System;

namespace FinanceApp.Models
{
    public class VendorLookup
    {
        public string Id { get; set; } = Guid.CreateVersion7().ToString();
        public string UserId { get; set; } = string.Empty;
        public string VendorId { get; set; } = string.Empty;
        public string LookupValue { get; set; } = string.Empty;
    }
}
