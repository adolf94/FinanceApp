using System.Text.Json.Serialization;

namespace FinanceApp.Models
{
    public class AccountGroup
    {
        public string Id { get; set; } = Guid.CreateVersion7().ToString();
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        [JsonConverter(typeof(JsonStringEnumConverter))]
        public AccountType AccountType { get; set; }
    }
}
