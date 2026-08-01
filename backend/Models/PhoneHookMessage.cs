// Source: p/models/phone_hook.py
using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FinanceApp.Models
{
    public class PhoneHookMessage
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("UserId")]
        public string UserId { get; set; } = "default";

        [JsonPropertyName("received_at")]
        public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;

        [JsonPropertyName("action")]
        public string Action { get; set; } = string.Empty;

        [JsonPropertyName("raw_payload")]
        public Dictionary<string, object> RawPayload { get; set; } = new();

        [JsonPropertyName("raw_msg")]
        public string RawMsg { get; set; } = string.Empty;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "received";

        [JsonPropertyName("month_key")]
        public string MonthKey { get; set; } = string.Empty;

        [JsonPropertyName("partition_key")]
        public string PartitionKey { get; set; } = string.Empty;

        [JsonPropertyName("_ttl")]
        public int Ttl { get; set; } = 60 * 24 * 60 * 60;
    }
}
