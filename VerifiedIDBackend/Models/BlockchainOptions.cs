namespace VerifiedIDBackend.Models;

public class BlockchainOptions
{
    public string ContractAddress { get; set; } = string.Empty;
    public string OwnerWalletAddress { get; set; } = string.Empty;
    public string RpcUrl { get; set; } = string.Empty;
    public int ChainId { get; set; }
}
