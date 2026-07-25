using FinanceApp.Interfaces;
using FinanceApp.Models;

namespace FinanceApp.Services
{
    public class VendorService : IVendorService
    {
        private readonly IVendorRepository _repository;

        public VendorService(IVendorRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<Vendor>> GetVendorsAsync(string userId)
        {
            return await _repository.GetVendorsAsync(userId);
        }

        public async Task<Vendor> CreateVendorAsync(string userId, string name)
        {
            var vendors = await _repository.GetVendorsAsync(userId);
            var existing = vendors.FirstOrDefault(v => v.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (existing != null)
            {
                return existing;
            }

            var vendor = new Vendor
            {
                UserId = userId,
                Name = name.Trim()
            };
            await _repository.AddVendorAsync(vendor);
            return vendor;
        }

        public async Task DeleteVendorAsync(string userId, string id)
        {
            await _repository.DeleteVendorAsync(userId, id);
        }
    }
}
