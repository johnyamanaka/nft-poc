using VerifiedIDBackend.Models;
using VerifiedIDBackend.Services;
using DotNetEnv;

// .envファイルを読み込む
var envPath = Path.Combine(Directory.GetParent(Directory.GetCurrentDirectory())?.FullName ?? "", ".env");
if (File.Exists(envPath))
{
    Env.Load(envPath);
}

var builder = WebApplication.CreateBuilder(args);

// 環境変数からConfigurationを上書き
builder.Configuration["AzureAd:TenantId"] = Environment.GetEnvironmentVariable("AZURE_TENANT_ID") ?? builder.Configuration["AzureAd:TenantId"];
builder.Configuration["AzureAd:ClientId"] = Environment.GetEnvironmentVariable("AZURE_CLIENT_ID") ?? builder.Configuration["AzureAd:ClientId"];
builder.Configuration["AzureAd:ClientSecret"] = Environment.GetEnvironmentVariable("AZURE_CLIENT_SECRET") ?? builder.Configuration["AzureAd:ClientSecret"];
builder.Configuration["VerifiedId:Authority"] = Environment.GetEnvironmentVariable("VERIFIED_ID_AUTHORITY") ?? builder.Configuration["VerifiedId:Authority"];
builder.Configuration["VerifiedId:CredentialType"] = Environment.GetEnvironmentVariable("VERIFIED_ID_CREDENTIAL_TYPE") ?? builder.Configuration["VerifiedId:CredentialType"];
builder.Configuration["VerifiedId:ManifestUrl"] = Environment.GetEnvironmentVariable("VERIFIED_ID_MANIFEST_URL") ?? builder.Configuration["VerifiedId:ManifestUrl"];
builder.Configuration["Blockchain:ContractAddress"] = Environment.GetEnvironmentVariable("BLOCKCHAIN_CONTRACT_ADDRESS") ?? builder.Configuration["Blockchain:ContractAddress"];
builder.Configuration["Blockchain:OwnerWalletAddress"] = Environment.GetEnvironmentVariable("BLOCKCHAIN_OWNER_WALLET") ?? builder.Configuration["Blockchain:OwnerWalletAddress"];
builder.Configuration["Blockchain:RpcUrl"] = Environment.GetEnvironmentVariable("BLOCKCHAIN_RPC_URL") ?? builder.Configuration["Blockchain:RpcUrl"];
builder.Configuration["App:PublicBaseUrl"] = Environment.GetEnvironmentVariable("PUBLIC_BASE_URL") ?? builder.Configuration["App:PublicBaseUrl"];

// Add services to the container.
builder.Services.AddOpenApi();

// Options pattern for configuration
builder.Services.Configure<AzureAdOptions>(builder.Configuration.GetSection("AzureAd"));
builder.Services.Configure<VerifiedIdOptions>(builder.Configuration.GetSection("VerifiedId"));
builder.Services.Configure<BlockchainOptions>(builder.Configuration.GetSection("Blockchain"));

// Add HttpClient and VerifiedIdService
builder.Services.AddHttpClient<IVerifiedIdService, VerifiedIdService>();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// 検証状態を保存するためのメモリ内ストレージ
var verificationStatuses = new Dictionary<string, VerificationStatus>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

// === Verified ID Endpoints ===

// POST /api/verify - VC検証リクエストの開始
app.MapPost("/api/verify", async (
    VerificationRequest request,
    IVerifiedIdService verifiedIdService,
    IConfiguration configuration,
    HttpContext httpContext) =>
{
    try
    {
        // コールバックURLの構築（ngrokなどの公開URLを使用）
        var publicBaseUrl = configuration["App:PublicBaseUrl"];
        var callbackUrl = string.IsNullOrEmpty(publicBaseUrl)
            ? $"{httpContext.Request.Scheme}://{httpContext.Request.Host}/api/callback"
            : $"{publicBaseUrl}/api/callback";

        var response = await verifiedIdService.CreatePresentationRequestAsync(
            request.WalletAddress,
            callbackUrl);

        // 検証状態を初期化
        verificationStatuses[response.RequestId] = new VerificationStatus
        {
            RequestId = response.RequestId,
            Status = "pending",
            WalletAddress = request.WalletAddress
        };

        return Results.Ok(response);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error creating verification request");
        return Results.Problem("Failed to create verification request");
    }
})
.WithName("CreateVerificationRequest");

// POST /api/issue - VC発行リクエストの開始
app.MapPost("/api/issue", async (
    IssuanceRequest request,
    IVerifiedIdService verifiedIdService,
    IConfiguration configuration,
    HttpContext httpContext) =>
{
    try
    {
        // コールバックURLの構築
        var publicBaseUrl = configuration["App:PublicBaseUrl"];
        var callbackUrl = string.IsNullOrEmpty(publicBaseUrl)
            ? $"{httpContext.Request.Scheme}://{httpContext.Request.Host}/api/issuance-callback"
            : $"{publicBaseUrl}/api/issuance-callback";

        var response = await verifiedIdService.CreateIssuanceRequestAsync(
            request,
            callbackUrl);

        return Results.Ok(response);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error creating issuance request");
        return Results.Problem("Failed to create issuance request");
    }
})
.WithName("CreateIssuanceRequest");

// POST /api/issuance-callback - Verified IDからの発行コールバック受信
app.MapPost("/api/issuance-callback", async (CallbackPayload payload, HttpContext httpContext) =>
{
    try
    {
        app.Logger.LogInformation("Received issuance callback. RequestId: {RequestId}, Status: {Status}",
            payload.RequestId, payload.RequestStatus);

        // ステータスに応じた処理
        switch (payload.RequestStatus)
        {
            case "issuance_successful":
                app.Logger.LogInformation("Credential issued successfully for: {Email}", payload.State);
                break;

            case "issuance_error":
                app.Logger.LogWarning("Issuance error. RequestId: {RequestId}", payload.RequestId);
                break;

            default:
                app.Logger.LogInformation("Unknown status: {Status}", payload.RequestStatus);
                break;
        }

        return Results.Ok(new { message = "Issuance callback processed" });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error processing issuance callback");
        return Results.Problem("Failed to process issuance callback");
    }
})
.WithName("HandleIssuanceCallback");

// POST /api/callback - Verified IDからのコールバック受信
app.MapPost("/api/callback", async (CallbackPayload payload, HttpContext httpContext) =>
{
    try
    {
        app.Logger.LogInformation("Received callback. RequestId: {RequestId}, Status: {Status}",
            payload.RequestId, payload.RequestStatus);

        // ステータスに応じた処理
        switch (payload.RequestStatus)
        {
            case "presentation_verified":
                app.Logger.LogInformation("Presentation verified successfully for wallet: {WalletAddress}",
                    payload.State);

                // GoサービスにSBT Mintをリクエスト
                try
                {
                    using var httpClient = new HttpClient();
                    var mintRequest = new
                    {
                        walletAddress = payload.State
                    };
                    var jsonContent = System.Text.Json.JsonSerializer.Serialize(mintRequest);
                    var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

                    var response = await httpClient.PostAsync("http://localhost:8080/mint", content);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseBody = await response.Content.ReadAsStringAsync();
                        app.Logger.LogInformation("SBT minted successfully: {Response}", responseBody);

                        // トランザクションハッシュを抽出して検証状態を更新
                        try
                        {
                            var mintResponse = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseBody);
                            if (mintResponse.TryGetProperty("txHash", out var txHashElement))
                            {
                                var txHash = txHashElement.GetString();
                                if (verificationStatuses.TryGetValue(payload.RequestId, out var status))
                                {
                                    status.Status = "verified";
                                    status.TransactionHash = txHash;
                                    status.VerifiedAt = DateTime.UtcNow;
                                }
                            }
                        }
                        catch (Exception parseEx)
                        {
                            app.Logger.LogError(parseEx, "Error parsing mint response");
                        }
                    }
                    else
                    {
                        app.Logger.LogError("Failed to mint SBT. Status: {StatusCode}", response.StatusCode);

                        // 検証状態を失敗に更新
                        if (verificationStatuses.TryGetValue(payload.RequestId, out var status))
                        {
                            status.Status = "failed";
                        }
                    }
                }
                catch (Exception ex)
                {
                    app.Logger.LogError(ex, "Error calling Go mint service");
                }

                break;

            case "request_retrieved":
                app.Logger.LogInformation("User scanned QR code. RequestId: {RequestId}", payload.RequestId);
                break;

            case "presentation_error":
                app.Logger.LogWarning("Presentation error. RequestId: {RequestId}", payload.RequestId);
                break;

            default:
                app.Logger.LogInformation("Unknown status: {Status}", payload.RequestStatus);
                break;
        }

        return Results.Ok(new { message = "Callback processed" });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error processing callback");
        return Results.Problem("Failed to process callback");
    }
})
.WithName("HandleCallback");

// GET /api/status - ヘルスチェック
app.MapGet("/api/status", () => Results.Ok(new { status = "running", timestamp = DateTime.UtcNow }))
    .WithName("HealthCheck");

// GET /api/verification-status/{requestId} - 検証状態を取得
app.MapGet("/api/verification-status/{requestId}", (string requestId) =>
{
    if (verificationStatuses.TryGetValue(requestId, out var status))
    {
        return Results.Ok(status);
    }
    return Results.NotFound(new { message = "Verification request not found" });
})
.WithName("GetVerificationStatus");

app.Run();

