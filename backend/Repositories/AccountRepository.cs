using FinanceApp.Data;
using FinanceApp.Interfaces;
using FinanceApp.Models;
using Microsoft.EntityFrameworkCore;

namespace FinanceApp.Repositories
{
    public class AccountRepository : IAccountRepository
    {
        private readonly FinanceDbContext _context;

        public AccountRepository(FinanceDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Account>> GetAccountsAsync(string userId)
        {
            return await _context.Accounts
                .WithPartitionKey(userId)
                .ToListAsync();
        }

        public async Task<Account?> GetAccountByIdAsync(string userId, string id)
        {
            return await _context.Accounts
                .WithPartitionKey(userId)
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task AddAccountAsync(Account account)
        {
            await _context.Accounts.AddAsync(account);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAccountAsync(Account account)
        {
            _context.Accounts.Update(account);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAccountAsync(string userId, string id)
        {
            var account = await GetAccountByIdAsync(userId, id);
            if (account != null)
            {
                _context.Accounts.Remove(account);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<AccountGroup>> GetAccountGroupsAsync(string userId)
        {
            return await _context.AccountGroups
                .WithPartitionKey(userId)
                .ToListAsync();
        }

        public async Task AddAccountGroupAsync(AccountGroup group)
        {
            await _context.AccountGroups.AddAsync(group);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAccountGroupAsync(string userId, string id)
        {
            var group = await _context.AccountGroups
                .WithPartitionKey(userId)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (group != null)
            {
                _context.AccountGroups.Remove(group);
                await _context.SaveChangesAsync();
            }
        }
    }
}
