using FinanceApp.Data;
using FinanceApp.Interfaces;
using FinanceApp.Models;
using Microsoft.EntityFrameworkCore;

namespace FinanceApp.Repositories
{
    public class VendorRepository : IVendorRepository
    {
        private readonly FinanceDbContext _context;

        public VendorRepository(FinanceDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Vendor>> GetVendorsAsync(string userId)
        {
            return await _context.Vendors
                .WithPartitionKey(userId)
                .ToListAsync();
        }

        public async Task AddVendorAsync(Vendor vendor)
        {
            await _context.Vendors.AddAsync(vendor);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteVendorAsync(string userId, string id)
        {
            var vendor = await _context.Vendors
                .WithPartitionKey(userId)
                .FirstOrDefaultAsync(v => v.Id == id);

            if (vendor != null)
            {
                _context.Vendors.Remove(vendor);
                await _context.SaveChangesAsync();
            }
        }
    }
}
