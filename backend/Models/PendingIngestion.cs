// Source: p/models/pending_ingestion.py
using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FinanceApp.Models
{
    public class AiParsedData
    {
        [JsonPropertyName("vendor")]
        public string? Vendor { get; set; }

        [JsonPropertyName("amount")]
        public decimal? Amount { get; set; }

        [JsonPropertyName("transaction_type")]
        public string? TransactionType { get; set; }

        [JsonPropertyName("debit_account_id")]
        public string? DebitAccountId { get; set; }

        [JsonPropertyName("credit_account_id")]
        public string? CreditAccountId { get; set; }

        [JsonPropertyName("suggested_account_creation")]
        public List<SuggestedAccountCreation>? SuggestedAccountCreation { get; set; }

        [JsonPropertyName("notes")]
        public string? Notes { get; set; }

        [JsonPropertyName("confidence")]
        public double? Confidence { get; set; }

        [JsonPropertyName("recipient_account_number")]
        public string? RecipientAccountNumber { get; set; }

        [JsonPropertyName("recipient_account_name")]
        public string? RecipientAccountName { get; set; }

        [JsonPropertyName("sender_account_number")]
        public string? SenderAccountNumber { get; set; }

        [JsonPropertyName("sender_account_name")]
        public string? SenderAccountName { get; set; }

        [JsonPropertyName("application")]
        public string? Application { get; set; }

        [JsonPropertyName("why")]
        public string? Why { get; set; }

        [JsonPropertyName("is_financial")]
        public bool? IsFinancial { get; set; }

        [JsonPropertyName("user_why")]
        public string? UserWhy { get; set; }
    }

    public class SuggestedAccountCreation
    {
        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("account_group")]
        public string? AccountGroup { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("reason")]
        public string? Reason { get; set; }
    }

    public class RawNotificationPayload
    {
        [JsonPropertyName("notif_pkg")]
        public string? NotifPkg { get; set; }

        [JsonPropertyName("sms_sender")]
        public string? SmsSender { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("text")]
        public string? Text { get; set; }

        [JsonPropertyName("plain_text")]
        public string? PlainText { get; set; }

        [JsonPropertyName("html_content")]
        public string? HtmlContent { get; set; }

        [JsonPropertyName("default")]
        public string? Default { get; set; }

        [JsonPropertyName("ai_content")]
        public string? AiContent { get; set; }

        [JsonPropertyName("subject")]
        public string? Subject { get; set; }

        [JsonPropertyName("sender")]
        public string? Sender { get; set; }

        [JsonPropertyName("action")]
        public string? Action { get; set; }

        [JsonPropertyName("emailId")]
        public string? EmailId { get; set; }

        [JsonPropertyName("timestamp")]
        public string? Timestamp { get; set; }
    }

    public class IngestionMatch
    {
        [JsonPropertyName("vendor")]
        public string? Vendor { get; set; }

        [JsonPropertyName("category")]
        public string? Category { get; set; }

        [JsonPropertyName("score")]
        public double? Score { get; set; }
    }

    public class PendingIngestion
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("UserId")]
        public string UserId { get; set; } = "default";

        [JsonPropertyName("hook_id")]
        public string HookId { get; set; } = string.Empty;

        [JsonPropertyName("received_at")]
        public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("raw_payload")]
        public RawNotificationPayload RawPayload { get; set; } = new();

        [JsonPropertyName("raw_msg")]
        public string RawMsg { get; set; } = string.Empty;

        [JsonPropertyName("ai_parsed")]
        public AiParsedData AiParsed { get; set; } = new();

        [JsonPropertyName("user_confirmed")]
        public AiParsedData UserConfirmed { get; set; } = new();

        [JsonPropertyName("similarity_score")]
        public double SimilarityScore { get; set; }

        [JsonPropertyName("top_matches")]
        public List<IngestionMatch> TopMatches { get; set; } = new();

        [JsonPropertyName("status")]
        public string Status { get; set; } = "Pending";

        [JsonPropertyName("transaction_id")]
        public string? TransactionId { get; set; }

        [JsonPropertyName("month_key")]
        public string MonthKey { get; set; } = string.Empty;

        [JsonPropertyName("partition_key")]
        public string PartitionKey { get; set; } = string.Empty;

        [JsonPropertyName("_ttl")]
        public int? Ttl { get; set; }
    }
}
