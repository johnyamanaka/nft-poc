namespace VerifiedIDBackend.Models;

// 発行リクエスト
public class IssuanceRequest
{
    // 学生情報
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    // 講座・資格情報
    public string CourseName { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
    public string CompletionDate { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public string Credits { get; set; } = string.Empty;

    // 発行機関情報
    public string IssuerName { get; set; } = string.Empty;
    public string IssuerDepartment { get; set; } = string.Empty;
}

// 発行リクエストのペイロード（Verified ID API用）
public class IssuanceRequestPayload
{
    public required string Authority { get; set; }
    public required string IncludeQRCode { get; set; }
    public required CallbackConfig Callback { get; set; }
    public required IssuanceRegistration Registration { get; set; }
    public required IssuanceType Type { get; set; }
    public required IssuanceManifest Manifest { get; set; }
    public required IssuanceClaims Claims { get; set; }
}

public class IssuanceRegistration
{
    public required string ClientName { get; set; }
    public string? Purpose { get; set; }
}

public class IssuanceType
{
    public required string Type { get; set; }
}

public class IssuanceManifest
{
    public required string Manifest { get; set; }
}

public class IssuanceClaims
{
    public required Dictionary<string, string> Claims { get; set; }
}

// 発行レスポンス
public class IssuanceResponse
{
    public string requestId { get; set; } = string.Empty;
    public string url { get; set; } = string.Empty;
    public int expiry { get; set; }
    public string? qrCode { get; set; }
}

// 検証状態
public class VerificationStatus
{
    public string RequestId { get; set; } = string.Empty;
    public string Status { get; set; } = "pending"; // pending, verified, failed
    public string? WalletAddress { get; set; }
    public string? TransactionHash { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? VerifiedAt { get; set; }
}
