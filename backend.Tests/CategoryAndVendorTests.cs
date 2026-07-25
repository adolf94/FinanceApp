using FinanceApp.Interfaces;
using FinanceApp.Models;
using FinanceApp.Services;
using Moq;
using Xunit;

namespace backend.Tests
{
    public class CategoryAndVendorTests
    {
        [Fact]
        public async Task VendorService_CreateVendor_SavesVendorToRepository()
        {
            // Arrange
            var mockRepo = new Mock<IVendorRepository>();
            mockRepo.Setup(r => r.GetVendorsAsync("user-123")).ReturnsAsync(new List<Vendor>());
            
            Vendor? savedVendor = null;
            mockRepo.Setup(r => r.AddVendorAsync(It.IsAny<Vendor>()))
                    .Callback<Vendor>(v => savedVendor = v)
                    .Returns(Task.CompletedTask);

            var service = new VendorService(mockRepo.Object);

            // Act
            var vendor = await service.CreateVendorAsync("user-123", "Amazon");

            // Assert
            Assert.NotNull(vendor);
            Assert.Equal("Amazon", vendor.Name);
            Assert.Equal("user-123", vendor.UserId);
            mockRepo.Verify(r => r.AddVendorAsync(It.IsAny<Vendor>()), Times.Once);
        }

        [Fact]
        public void AccountGroup_SupportsFinancialTypesForBalanceAuditing()
        {
            // Arrange & Act
            var group = new AccountGroup
            {
                Name = "Food & Dining",
                AccountType = AccountType.Expense
            };

            // Assert
            Assert.Equal("Food & Dining", group.Name);
            Assert.Equal(AccountType.Expense, group.AccountType);
        }
    }
}
