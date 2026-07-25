using FinanceApp.Interfaces;
using FinanceApp.Models;
using FinanceApp.Services;
using Moq;
using Xunit;

namespace backend.Tests
{
    public class AccountServiceTests
    {
        private readonly Mock<IAccountRepository> _mockRepo;
        private readonly AccountService _service;

        public AccountServiceTests()
        {
            _mockRepo = new Mock<IAccountRepository>();
            _service = new AccountService(_mockRepo.Object);
        }

        [Fact]
        public async Task CreateAccountGroupAsync_CreatesGroupWithUserIdAndName()
        {
            // Arrange
            string userId = "user-123";
            var newGroup = new AccountGroup { Name = "Main Accounts", AccountType = AccountType.Asset };

            AccountGroup? capturedGroup = null;
            _mockRepo.Setup(r => r.AddAccountGroupAsync(It.IsAny<AccountGroup>()))
                     .Callback<AccountGroup>(g => capturedGroup = g)
                     .Returns(Task.CompletedTask);

            // Act
            var result = await _service.CreateAccountGroupAsync(userId, newGroup);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(userId, result.UserId);
            Assert.Equal("Main Accounts", result.Name);
            Assert.Equal(AccountType.Asset, result.AccountType);
            Assert.False(string.IsNullOrEmpty(result.Id));

            _mockRepo.Verify(r => r.AddAccountGroupAsync(It.IsAny<AccountGroup>()), Times.Once);
        }

        [Fact]
        public async Task CreateAccountAsync_SetsUserIdAndInitializesCurrentBalanceToStartingBalance()
        {
            // Arrange
            string userId = "user-123";
            var newAccount = new Account
            {
                Name = "Everyday Checking",
                AccountGroupId = "group-1",
                AccountType = AccountType.Bank,
                StartingBalance = 2500.00m
            };

            Account? capturedAccount = null;
            _mockRepo.Setup(r => r.AddAccountAsync(It.IsAny<Account>()))
                     .Callback<Account>(a => capturedAccount = a)
                     .Returns(Task.CompletedTask);

            // Act
            var result = await _service.CreateAccountAsync(userId, newAccount);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(userId, result.UserId);
            Assert.Equal(2500.00m, result.StartingBalance);
            Assert.Equal(2500.00m, result.CurrentBalance);
            Assert.Equal(AccountType.Bank, result.AccountType);

            _mockRepo.Verify(r => r.AddAccountAsync(It.IsAny<Account>()), Times.Once);
        }

        [Fact]
        public async Task GetAccountGroupsAsync_ReturnsGroupsFromRepository()
        {
            // Arrange
            string userId = "user-123";
            var expectedGroups = new List<AccountGroup>
            {
                new AccountGroup { Id = "g1", UserId = userId, Name = "Checking & Savings" },
                new AccountGroup { Id = "g2", UserId = userId, Name = "Investments" }
            };

            _mockRepo.Setup(r => r.GetAccountGroupsAsync(userId))
                     .ReturnsAsync(expectedGroups);

            // Act
            var result = await _service.GetAccountGroupsAsync(userId);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(2, result.Count());
            _mockRepo.Verify(r => r.GetAccountGroupsAsync(userId), Times.Once);
        }

        [Fact]
        public async Task GetAccountsAsync_ReturnsAccountsFromRepository()
        {
            // Arrange
            string userId = "user-123";
            var expectedAccounts = new List<Account>
            {
                new Account { Id = "a1", UserId = userId, Name = "Cash Wallet", AccountType = AccountType.Cash, StartingBalance = 100 },
                new Account { Id = "a2", UserId = userId, Name = "Credit Card", AccountType = AccountType.CreditCard, StartingBalance = 0 }
            };

            _mockRepo.Setup(r => r.GetAccountsAsync(userId))
                     .ReturnsAsync(expectedAccounts);

            // Act
            var result = await _service.GetAccountsAsync(userId);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(2, result.Count());
            _mockRepo.Verify(r => r.GetAccountsAsync(userId), Times.Once);
        }
    }
}
