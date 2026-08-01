using Microsoft.EntityFrameworkCore;
using FinanceApp.Models;

namespace FinanceApp.Data
{
    public class FinanceDbContext : DbContext
    {
        public FinanceDbContext(DbContextOptions<FinanceDbContext> options) : base(options) { }

        public DbSet<AccountGroup> AccountGroups { get; set; } = null!;
        public DbSet<Account> Accounts { get; set; } = null!;
        public DbSet<Transaction> Transactions { get; set; } = null!;
        public DbSet<LedgerEntry> LedgerEntries { get; set; } = null!;
        public DbSet<Vendor> Vendors { get; set; } = null!;
        public DbSet<VendorLookup> VendorLookups { get; set; } = null!;
        public DbSet<RecurringTransaction> RecurringTransactions { get; set; } = null!;
        public DbSet<PendingIngestion> PendingIngestions { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<RecurringTransaction>()
                .ToContainer("RecurringTransactions")
                .HasPartitionKey(x => x.UserId)
                .HasNoDiscriminator();
            modelBuilder.Entity<RecurringTransaction>()
                .Property(x => x.TemplateType)
                .HasConversion<string>();
            modelBuilder.Entity<RecurringTransaction>()
                .OwnsMany(rt => rt.TemplateEntries);
            modelBuilder.Entity<RecurringTransaction>()
                .OwnsMany(rt => rt.Occurrences);

            modelBuilder.Entity<AccountGroup>()
                .ToContainer("AccountGroups")
                .HasPartitionKey(x => x.UserId)
                .HasNoDiscriminator();
            modelBuilder.Entity<AccountGroup>()
                .Property(x => x.AccountType)
                .HasConversion<string>();

            modelBuilder.Entity<Account>()
                .ToContainer("Accounts")
                .HasPartitionKey(x => x.UserId)
                .HasNoDiscriminator();
            modelBuilder.Entity<Account>()
                .Property(x => x.AccountType)
                .HasConversion<string>();

            // Transactions Container - using Discriminator for Transaction and LedgerEntry
            modelBuilder.Entity<Transaction>()
                .ToContainer("Transactions")
                .HasPartitionKey(x => x.UserId);
            modelBuilder.Entity<Transaction>()
                .Property(x => x.Type)
                .HasConversion<string>();
            modelBuilder.Entity<Transaction>()
                .HasMany(t => t.Entries)
                .WithOne(e => e.Transaction)
                .HasForeignKey(e => new { e.TransactionId, e.UserId })
                .HasPrincipalKey(t => new { t.Id, t.UserId });

            modelBuilder.Entity<LedgerEntry>()
                .ToContainer("Transactions")
                .HasPartitionKey(x => x.UserId);

            modelBuilder.Entity<Vendor>()
                .ToContainer("Vendors")
                .HasPartitionKey(x => x.UserId)
                .HasNoDiscriminator();

            modelBuilder.Entity<VendorLookup>()
                .ToContainer("VendorLookups")
                .HasPartitionKey(x => x.UserId)
                .HasNoDiscriminator();

            modelBuilder.Entity<PendingIngestion>(entity =>
            {
                entity.ToContainer("PendingIngestions")
                    .HasPartitionKey(x => x.UserId)
                    .HasNoDiscriminator();

                entity.Property(x => x.HookId).ToJsonProperty("hook_id");
                entity.Property(x => x.ReceivedAt).ToJsonProperty("received_at");
                entity.Property(x => x.RawMsg).ToJsonProperty("raw_msg");
                entity.Property(x => x.SimilarityScore).ToJsonProperty("similarity_score");
                entity.Property(x => x.Status).ToJsonProperty("status");
                entity.Property(x => x.TransactionId).ToJsonProperty("transaction_id");
                entity.Property(x => x.MonthKey).ToJsonProperty("month_key");
                entity.Property(x => x.PartitionKey).ToJsonProperty("partition_key");

                entity.OwnsOne(x => x.RawPayload, rp =>
                {
                    rp.ToJsonProperty("raw_payload");
                    rp.Property(p => p.NotifPkg).ToJsonProperty("notif_pkg");
                    rp.Property(p => p.SmsSender).ToJsonProperty("sms_sender");
                    rp.Property(p => p.Title).ToJsonProperty("title");
                    rp.Property(p => p.Text).ToJsonProperty("text");
                    rp.Property(p => p.PlainText).ToJsonProperty("plain_text");
                    rp.Property(p => p.HtmlContent).ToJsonProperty("html_content");
                    rp.Property(p => p.Default).ToJsonProperty("default");
                    rp.Property(p => p.AiContent).ToJsonProperty("ai_content");
                    rp.Property(p => p.Subject).ToJsonProperty("subject");
                    rp.Property(p => p.Sender).ToJsonProperty("sender");
                    rp.Property(p => p.Action).ToJsonProperty("action");
                    rp.Property(p => p.EmailId).ToJsonProperty("emailId");
                    rp.Property(p => p.Timestamp).ToJsonProperty("timestamp");
                });

                entity.OwnsOne(x => x.AiParsed, ai =>
                {
                    ai.ToJsonProperty("ai_parsed");
                    ai.Property(a => a.Vendor).ToJsonProperty("vendor");
                    ai.Property(a => a.Amount).ToJsonProperty("amount");
                    ai.Property(a => a.TransactionType).ToJsonProperty("transaction_type");
                    ai.Property(a => a.DebitAccountId).ToJsonProperty("debit_account_id");
                    ai.Property(a => a.CreditAccountId).ToJsonProperty("credit_account_id");
                    
                    ai.OwnsMany(a => a.SuggestedAccountCreation, sac =>
                    {
                        sac.ToJsonProperty("suggested_account_creation");
                        sac.Property(s => s.Type).ToJsonProperty("type");
                        sac.Property(s => s.AccountGroup).ToJsonProperty("account_group");
                        sac.Property(s => s.Name).ToJsonProperty("name");
                        sac.Property(s => s.Description).ToJsonProperty("description");
                        sac.Property(s => s.Reason).ToJsonProperty("reason");
                    });

                    ai.Property(a => a.Notes).ToJsonProperty("notes");
                    ai.Property(a => a.Confidence).ToJsonProperty("confidence");
                    ai.Property(a => a.RecipientAccountNumber).ToJsonProperty("recipient_account_number");
                    ai.Property(a => a.RecipientAccountName).ToJsonProperty("recipient_account_name");
                    ai.Property(a => a.SenderAccountNumber).ToJsonProperty("sender_account_number");
                    ai.Property(a => a.SenderAccountName).ToJsonProperty("sender_account_name");
                    ai.Property(a => a.Application).ToJsonProperty("application");
                    ai.Property(a => a.Why).ToJsonProperty("why");
                    ai.Property(a => a.IsFinancial).ToJsonProperty("is_financial");
                    ai.Property(a => a.UserWhy).ToJsonProperty("user_why");
                });

                entity.OwnsOne(x => x.UserConfirmed, uc =>
                {
                    uc.ToJsonProperty("user_confirmed");
                    uc.Property(a => a.Vendor).ToJsonProperty("vendor");
                    uc.Property(a => a.Amount).ToJsonProperty("amount");
                    uc.Property(a => a.TransactionType).ToJsonProperty("transaction_type");
                    uc.Property(a => a.DebitAccountId).ToJsonProperty("debit_account_id");
                    uc.Property(a => a.CreditAccountId).ToJsonProperty("credit_account_id");
                    
                    uc.OwnsMany(a => a.SuggestedAccountCreation, sac =>
                    {
                        sac.ToJsonProperty("suggested_account_creation");
                        sac.Property(s => s.Type).ToJsonProperty("type");
                        sac.Property(s => s.AccountGroup).ToJsonProperty("account_group");
                        sac.Property(s => s.Name).ToJsonProperty("name");
                        sac.Property(s => s.Description).ToJsonProperty("description");
                        sac.Property(s => s.Reason).ToJsonProperty("reason");
                    });

                    uc.Property(a => a.Notes).ToJsonProperty("notes");
                    uc.Property(a => a.Confidence).ToJsonProperty("confidence");
                    uc.Property(a => a.RecipientAccountNumber).ToJsonProperty("recipient_account_number");
                    uc.Property(a => a.RecipientAccountName).ToJsonProperty("recipient_account_name");
                    uc.Property(a => a.SenderAccountNumber).ToJsonProperty("sender_account_number");
                    uc.Property(a => a.SenderAccountName).ToJsonProperty("sender_account_name");
                    uc.Property(a => a.Application).ToJsonProperty("application");
                    uc.Property(a => a.Why).ToJsonProperty("why");
                    uc.Property(a => a.IsFinancial).ToJsonProperty("is_financial");
                    uc.Property(a => a.UserWhy).ToJsonProperty("user_why");
                });

                entity.OwnsMany(x => x.TopMatches, tm =>
                {
                    tm.ToJsonProperty("top_matches");
                    tm.Property(m => m.Vendor).ToJsonProperty("vendor");
                    tm.Property(m => m.Category).ToJsonProperty("category");
                    tm.Property(m => m.Score).ToJsonProperty("score");
                });
            });
        }
    }
}
