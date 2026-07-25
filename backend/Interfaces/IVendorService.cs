using FinanceApp.Models;

namespace FinanceApp.Interfaces
{
    public interface IVendorService
    {
        Task<IEnumerable<Vendor>> GetVendorsAsync(string userId);
        Task<Vendor> CreateVendorAsync(string userId, string name);
        Task DeleteVendorAsync(string userId, string id);
    }
}
