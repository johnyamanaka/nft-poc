using System.Text.Json.Serialization;

namespace VerifiedIDBackend.Models;

public class PresentationResponse
{
    [JsonPropertyName("requestId")]
    public string RequestId { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    [JsonPropertyName("expiry")]
    public long Expiry { get; set; }

    [JsonPropertyName("qrCode")]
    public string? QrCode { get; set; }
}
