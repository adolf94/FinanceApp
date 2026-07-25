namespace FinanceApp.Models
{
    public class Vendor
    {
        public string Id { get; set; } = Guid.CreateVersion7().ToString();
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }
}
