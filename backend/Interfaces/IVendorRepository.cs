using FinanceApp.Models;

namespace FinanceApp.Interfaces
{
    public interface IVendorRepository
    {
        Task<IEnumerable<Vendor>> GetVendorsAsync(string userId);
        Task AddVendorAsync(Vendor vendor);
        Task DeleteVendorAsync(string userId, string id);
    }
}
