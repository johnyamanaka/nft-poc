using System.Text.Json.Serialization;

namespace VerifiedIDBackend.Models;

public class PresentationRequestPayload
{
    [JsonPropertyName("includeQRCode")]
    public bool IncludeQRCode { get; set; } = true;

    [JsonPropertyName("callback")]
    public CallbackConfig Callback { get; set; } = new();

    [JsonPropertyName("authority")]
    public string Authority { get; set; } = string.Empty;

    [JsonPropertyName("registration")]
    public RegistrationConfig Registration { get; set; } = new();

    [JsonPropertyName("requestedCredentials")]
    public List<RequestedCredential> RequestedCredentials { get; set; } = new();

    [JsonPropertyName("includeReceipt")]
    public bool IncludeReceipt { get; set; } = false;
}

public class CallbackConfig
{
    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    [JsonPropertyName("state")]
    public string State { get; set; } = string.Empty;

    [JsonPropertyName("headers")]
    public Dictionary<string, string>? Headers { get; set; }
}

public class RegistrationConfig
{
    [JsonPropertyName("clientName")]
    public string ClientName { get; set; } = "VerifiedID PoC";
}

public class RequestedCredential
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("purpose")]
    public string Purpose { get; set; } = "To verify your identity";

    [JsonPropertyName("acceptedIssuers")]
    public List<string> AcceptedIssuers { get; set; } = new();
}
