using FinanceApp.Models;

namespace FinanceApp.Interfaces
{
    public interface IAccountService
    {
        Task<IEnumerable<Account>> GetAccountsAsync(string userId);
        Task<Account?> GetAccountByIdAsync(string userId, string id);
        Task<Account> CreateAccountAsync(string userId, Account account);
        Task<Account> UpdateAccountAsync(string userId, Account account);
        Task DeleteAccountAsync(string userId, string id);

        Task<IEnumerable<AccountGroup>> GetAccountGroupsAsync(string userId);
        Task<AccountGroup> CreateAccountGroupAsync(string userId, AccountGroup group);
        Task DeleteAccountGroupAsync(string userId, string id);
    }
}
