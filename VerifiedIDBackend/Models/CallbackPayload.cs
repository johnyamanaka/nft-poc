using System.Text.Json.Serialization;

namespace VerifiedIDBackend.Models;

public class CallbackPayload
{
    [JsonPropertyName("requestId")]
    public string RequestId { get; set; } = string.Empty;

    [JsonPropertyName("requestStatus")]
    public string RequestStatus { get; set; } = string.Empty;

    [JsonPropertyName("state")]
    public string State { get; set; } = string.Empty;

    [JsonPropertyName("subject")]
    public string? Subject { get; set; }

    [JsonPropertyName("verifiedCredentialsData")]
    public List<VerifiedCredentialData>? VerifiedCredentialsData { get; set; }
}

public class VerifiedCredentialData
{
    [JsonPropertyName("issuer")]
    public string? Issuer { get; set; }

    [JsonPropertyName("type")]
    public List<string>? Type { get; set; }

    [JsonPropertyName("claims")]
    public Dictionary<string, object>? Claims { get; set; }
}
