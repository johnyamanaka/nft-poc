package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/joho/godotenv"
)

// 設定
var (
	rpcURL          string
	contractAddress string
	chainID         *big.Int
	privateKey      string
)

// MintRequest - HTTPリクエストのペイロード
type MintRequest struct {
	WalletAddress string `json:"walletAddress"`
}

// MintResponse - HTTPレスポンス
type MintResponse struct {
	Success bool   `json:"success"`
	TxHash  string `json:"txHash,omitempty"`
	Message string `json:"message"`
}

func main() {
	// .envファイルを読み込む（親ディレクトリから）
	envPath := filepath.Join("..", ".env")
	if err := godotenv.Load(envPath); err != nil {
		log.Printf("Warning: .env file not found at %s, using system environment variables", envPath)
	}

	// 環境変数から設定を読み込む
	rpcURL = getEnv("BLOCKCHAIN_RPC_URL", "https://rpc-amoy.polygon.technology")
	contractAddress = getEnv("BLOCKCHAIN_CONTRACT_ADDRESS", "0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c")
	chainIDInt := getEnvAsInt("BLOCKCHAIN_CHAIN_ID", 80002)
	chainID = big.NewInt(chainIDInt)
	privateKey = os.Getenv("PRIVATE_KEY")

	if privateKey == "" {
		log.Fatal("PRIVATE_KEY environment variable is not set")
	}

	log.Printf("Configuration loaded:")
	log.Printf("  RPC URL: %s", rpcURL)
	log.Printf("  Contract Address: %s", contractAddress)
	log.Printf("  Chain ID: %d", chainID.Int64())

	// HTTPサーバーの起動
	http.HandleFunc("/mint", mintHandler)
	http.HandleFunc("/health", healthHandler)

	port := "8080"
	log.Printf("SBT Mint Service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// healthHandler - ヘルスチェック
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "running"})
}

// mintHandler - SBT Mintエンドポイント
func mintHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(MintResponse{
			Success: false,
			Message: "Method not allowed",
		})
		return
	}

	// リクエストボディの解析
	var req MintRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MintResponse{
			Success: false,
			Message: "Invalid request body",
		})
		return
	}

	// ウォレットアドレスの検証
	if !common.IsHexAddress(req.WalletAddress) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(MintResponse{
			Success: false,
			Message: "Invalid wallet address",
		})
		return
	}

	// SBTのMint実行
	txHash, err := mintSBT(req.WalletAddress)
	if err != nil {
		log.Printf("Error minting SBT: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(MintResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to mint SBT: %v", err),
		})
		return
	}

	// 成功レスポンス
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(MintResponse{
		Success: true,
		TxHash:  txHash,
		Message: "SBT minted successfully",
	})
}

// mintSBT - 実際のSBT Mint処理
func mintSBT(walletAddress string) (string, error) {
	// Polygon Amoyに接続
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return "", fmt.Errorf("failed to connect to network: %w", err)
	}
	defer client.Close()

	// 秘密鍵からECDSA鍵を生成
	privateKeyECDSA, err := crypto.HexToECDSA(privateKey)
	if err != nil {
		return "", fmt.Errorf("invalid private key: %w", err)
	}

	// 公開鍵からアドレスを取得
	publicKey := privateKeyECDSA.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return "", fmt.Errorf("error casting public key to ECDSA")
	}

	fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)

	// Nonceの取得
	nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	// ガス価格の取得
	gasPrice, err := client.SuggestGasPrice(context.Background())
	if err != nil {
		return "", fmt.Errorf("failed to suggest gas price: %w", err)
	}

	// TransactOptsの作成
	auth, err := bind.NewKeyedTransactorWithChainID(privateKeyECDSA, chainID)
	if err != nil {
		return "", fmt.Errorf("failed to create transactor: %w", err)
	}
	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = big.NewInt(0)       // POLを送らない
	auth.GasLimit = uint64(300000)   // ガスリミット
	auth.GasPrice = gasPrice

	// コントラクトインスタンスの作成
	contractAddr := common.HexToAddress(contractAddress)
	instance, err := NewIdentitySBT(contractAddr, client)
	if err != nil {
		return "", fmt.Errorf("failed to instantiate contract: %w", err)
	}

	// safeMint関数の呼び出し
	recipientAddress := common.HexToAddress(walletAddress)
	tx, err := instance.SafeMint(auth, recipientAddress)
	if err != nil {
		return "", fmt.Errorf("failed to mint SBT: %w", err)
	}

	log.Printf("SBT minted successfully. TxHash: %s", tx.Hash().Hex())
	return tx.Hash().Hex(), nil
}

// getEnv - 環境変数を取得（デフォルト値付き）
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// getEnvAsInt - 環境変数を整数として取得（デフォルト値付き）
func getEnvAsInt(key string, defaultValue int64) int64 {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.ParseInt(valueStr, 10, 64)
	if err != nil {
		log.Printf("Warning: invalid value for %s, using default %d", key, defaultValue)
		return defaultValue
	}
	return value
}
