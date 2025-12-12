namespace VerifiedIDBackend.Models;

public class VerifiedIdOptions
{
    public string Authority { get; set; } = string.Empty;
    public string CredentialType { get; set; } = string.Empty;
    public string ApiEndpoint { get; set; } = string.Empty;
    public string VerifyEndpoint { get; set; } = string.Empty;
    public string ManifestUrl { get; set; } = string.Empty;
}
