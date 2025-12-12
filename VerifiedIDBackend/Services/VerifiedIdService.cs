using Microsoft.Extensions.Options;
using Microsoft.Identity.Client;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using VerifiedIDBackend.Models;

namespace VerifiedIDBackend.Services;

public interface IVerifiedIdService
{
    Task<PresentationResponse> CreatePresentationRequestAsync(string walletAddress, string callbackUrl);
    Task<IssuanceResponse> CreateIssuanceRequestAsync(string firstName, string lastName, string email, string callbackUrl);
}

public class VerifiedIdService : IVerifiedIdService
{
    private readonly HttpClient _httpClient;
    private readonly AzureAdOptions _azureAdOptions;
    private readonly VerifiedIdOptions _verifiedIdOptions;
    private readonly ILogger<VerifiedIdService> _logger;
    private readonly IConfidentialClientApplication _msalClient;

    public VerifiedIdService(
        HttpClient httpClient,
        IOptions<AzureAdOptions> azureAdOptions,
        IOptions<VerifiedIdOptions> verifiedIdOptions,
        ILogger<VerifiedIdService> logger)
    {
        _httpClient = httpClient;
        _azureAdOptions = azureAdOptions.Value;
        _verifiedIdOptions = verifiedIdOptions.Value;
        _logger = logger;

        // MSALクライアントの初期化
        _msalClient = ConfidentialClientApplicationBuilder
            .Create(_azureAdOptions.ClientId)
            .WithClientSecret(_azureAdOptions.ClientSecret)
            .WithAuthority(new Uri($"https://login.microsoftonline.com/{_azureAdOptions.TenantId}"))
            .Build();
    }

    public async Task<PresentationResponse> CreatePresentationRequestAsync(string walletAddress, string callbackUrl)
    {
        try
        {
            // アクセストークンの取得
            var accessToken = await GetAccessTokenAsync();

            // プレゼンテーションリクエストの構築
            var requestPayload = new PresentationRequestPayload
            {
                IncludeQRCode = true,
                Authority = _verifiedIdOptions.Authority,
                Registration = new RegistrationConfig
                {
                    ClientName = "VerifiedID SBT PoC"
                },
                Callback = new CallbackConfig
                {
                    Url = callbackUrl,
                    State = walletAddress, // ウォレットアドレスをstateに格納
                    Headers = new Dictionary<string, string>
                    {
                        { "api-key", "poc-callback-key" }
                    }
                },
                RequestedCredentials = new List<RequestedCredential>
                {
                    new RequestedCredential
                    {
                        Type = _verifiedIdOptions.CredentialType,
                        Purpose = "To verify your identity and issue an SBT",
                        AcceptedIssuers = new List<string> { _verifiedIdOptions.Authority }
                    }
                }
            };

            // Verified ID APIへのリクエスト
            var jsonContent = JsonSerializer.Serialize(requestPayload);
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, _verifiedIdOptions.VerifyEndpoint)
            {
                Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
            };
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            _logger.LogInformation("Sending presentation request to Verified ID API");
            var response = await _httpClient.SendAsync(httpRequest);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Verified ID API returned error: {StatusCode} - {Error}",
                    response.StatusCode, errorContent);
                throw new HttpRequestException($"Verified ID API error: {response.StatusCode}");
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var presentationResponse = JsonSerializer.Deserialize<PresentationResponse>(responseContent);

            if (presentationResponse == null)
            {
                throw new InvalidOperationException("Failed to deserialize presentation response");
            }

            _logger.LogInformation("Presentation request created successfully. RequestId: {RequestId}",
                presentationResponse.RequestId);

            return presentationResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating presentation request");
            throw;
        }
    }

    public async Task<IssuanceResponse> CreateIssuanceRequestAsync(string firstName, string lastName, string email, string callbackUrl)
    {
        try
        {
            // アクセストークンの取得
            var accessToken = await GetAccessTokenAsync();

            // 発行リクエストの構築
            var requestPayload = new
            {
                includeQRCode = true,
                authority = _verifiedIdOptions.Authority,
                registration = new
                {
                    clientName = "VerifiedID SBT PoC"
                },
                callback = new
                {
                    url = callbackUrl,
                    state = email,
                    headers = new Dictionary<string, string>
                    {
                        { "api-key", "poc-issuance-key" }
                    }
                },
                type = _verifiedIdOptions.CredentialType,
                manifest = _verifiedIdOptions.ManifestUrl,
                claims = new
                {
                    firstName = firstName,
                    lastName = lastName,
                    employeeId = email
                }
            };

            // Verified ID APIへのリクエスト
            var jsonContent = JsonSerializer.Serialize(requestPayload);
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, _verifiedIdOptions.ApiEndpoint)
            {
                Content = new StringContent(jsonContent, Encoding.UTF8, "application/json")
            };
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            _logger.LogInformation("Sending issuance request to Verified ID API");
            var response = await _httpClient.SendAsync(httpRequest);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Verified ID API returned error: {StatusCode} - {Error}",
                    response.StatusCode, errorContent);
                throw new HttpRequestException($"Verified ID API error: {response.StatusCode}");
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var issuanceResponse = JsonSerializer.Deserialize<IssuanceResponse>(responseContent);

            if (issuanceResponse == null)
            {
                throw new InvalidOperationException("Failed to deserialize issuance response");
            }

            _logger.LogInformation("Issuance request created successfully. RequestId: {RequestId}",
                issuanceResponse.requestId);

            return issuanceResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating issuance request");
            throw;
        }
    }

    private async Task<string> GetAccessTokenAsync()
    {
        try
        {
            var scopes = new[] { "3db474b9-6a0c-4840-96ac-1fceb342124f/.default" };

            var result = await _msalClient
                .AcquireTokenForClient(scopes)
                .ExecuteAsync();

            _logger.LogInformation("Access token acquired successfully");
            return result.AccessToken;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to acquire access token");
            throw;
        }
    }
}
