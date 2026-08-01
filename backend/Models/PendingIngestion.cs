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

        [JsonPropertyName("category")]
        public string? Category { get; set; }

        [JsonPropertyName("notes")]
        public string? Notes { get; set; }

        [JsonPropertyName("confidence")]
        public double? Confidence { get; set; }
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
        public Dictionary<string, object> RawPayload { get; set; } = new();

        [JsonPropertyName("raw_msg")]
        public string RawMsg { get; set; } = string.Empty;

        [JsonPropertyName("ai_parsed")]
        public AiParsedData AiParsed { get; set; } = new();

        [JsonPropertyName("user_confirmed")]
        public Dictionary<string, object> UserConfirmed { get; set; } = new();

        [JsonPropertyName("similarity_score")]
        public double SimilarityScore { get; set; }

        [JsonPropertyName("top_matches")]
        public List<Dictionary<string, object>> TopMatches { get; set; } = new();

        [JsonPropertyName("status")]
        public string Status { get; set; } = "Pending";

        [JsonPropertyName("transaction_id")]
        public string? TransactionId { get; set; }

        [JsonPropertyName("month_key")]
        public string MonthKey { get; set; } = string.Empty;

        [JsonPropertyName("partition_key")]
        public string PartitionKey { get; set; } = string.Empty;
    }
}
