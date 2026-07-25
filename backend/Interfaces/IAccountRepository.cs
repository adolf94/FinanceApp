using FinanceApp.Models;

namespace FinanceApp.Interfaces
{
    public interface IAccountRepository
    {
        Task<IEnumerable<Account>> GetAccountsAsync(string userId);
        Task<Account?> GetAccountByIdAsync(string userId, string id);
        Task AddAccountAsync(Account account);
        Task UpdateAccountAsync(Account account);
        Task DeleteAccountAsync(string userId, string id);
        
        Task<IEnumerable<AccountGroup>> GetAccountGroupsAsync(string userId);
        Task AddAccountGroupAsync(AccountGroup group);
        Task DeleteAccountGroupAsync(string userId, string id);
    }
}
