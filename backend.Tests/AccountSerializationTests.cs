using System.Text.Json;
using FinanceApp.Models;
using Xunit;

namespace backend.Tests
{
    public class AccountSerializationTests
    {
        [Theory]
        [InlineData("Cash", AccountType.Cash)]
        [InlineData("Bank", AccountType.Bank)]
        [InlineData("CreditCard", AccountType.CreditCard)]
        [InlineData("Investment", AccountType.Investment)]
        public void AccountType_DeserializesFromStringSuccessfully(string enumString, AccountType expectedType)
        {
            // Arrange
            string json = $"{{\"id\":\"acc-1\",\"name\":\"My Account\",\"accountType\":\"{enumString}\",\"startingBalance\":100.50}}";
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // Act
            var account = JsonSerializer.Deserialize<Account>(json, options);

            // Assert
            Assert.NotNull(account);
            Assert.Equal("acc-1", account.Id);
            Assert.Equal("My Account", account.Name);
            Assert.Equal(expectedType, account.AccountType);
            Assert.Equal(100.50m, account.StartingBalance);
        }

        [Fact]
        public void Account_DeserializesUserExactPayloadSuccessfully()
        {
            // Arrange
            string json = "{\"name\":\"Cash\",\"accountGroupId\":\"2e313ca7-250d-492b-8ba0-d8161d05b51f\",\"startingBalance\":0.01,\"accountType\":\"Bank\",\"creditCardCycleStartDay\":null,\"creditCardPaymentDueDay\":null}";
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // Act
            var account = JsonSerializer.Deserialize<Account>(json, options);

            // Assert
            Assert.NotNull(account);
            Assert.Equal("Cash", account.Name);
            Assert.Equal(AccountType.Bank, account.AccountType);
        }

        [Fact]
        public void AccountType_SerializesToStringSuccessfully()
        {
            // Arrange
            var account = new Account
            {
                Id = "acc-2",
                Name = "Savings Account",
                AccountType = AccountType.Bank,
                StartingBalance = 500.0m
            };

            // Act
            string json = JsonSerializer.Serialize(account);

            // Assert
            Assert.Contains("\"AccountType\":\"Bank\"", json);
        }

        [Fact]
        public void AccountType_InvalidString_ThrowsJsonException()
        {
            // Arrange
            string json = "{\"id\":\"acc-3\",\"accountType\":\"InvalidType\"}";
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // Act & Assert
            Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<Account>(json, options));
        }

        [Fact]
        public void AccountGroup_DeserializesAndSerializesSuccessfully()
        {
            // Arrange
            string json = "{\"id\":\"grp-1\",\"userId\":\"user-123\",\"name\":\"Personal Accounts\"}";
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // Act
            var group = JsonSerializer.Deserialize<AccountGroup>(json, options);

            // Assert
            Assert.NotNull(group);
            Assert.Equal("grp-1", group.Id);
            Assert.Equal("user-123", group.UserId);
            Assert.Equal("Personal Accounts", group.Name);
        }
    }
}
