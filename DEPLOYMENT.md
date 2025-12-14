# 本番環境デプロイメントガイド

## 概要

このプロジェクトは、Microsoft Entra Verified IDとブロックチェーン（Polygon Amoy Testnet）を組み合わせた本人確認システムです。すべて無料のクラウドサービスを使用して本番環境にデプロイされています。

## デプロイ済みサービス

### 1. フロントエンド（GitHub Pages）

- **URL**: https://johnyamanaka.github.io/nft-poc/
- **ホスティング**: GitHub Pages
- **自動デプロイ**: `main`ブランチへのプッシュで自動更新
- **ファイル**: `WebFrontend/` ディレクトリ

#### 特徴
- 環境別URL設定（`config.js`で本番/開発環境を自動切り替え）
- QRコード生成機能
- オンライン検証機能（Phase 1）
- レスポンシブデザイン

### 2. C# Backend（fly.io）

- **URL**: https://nft-poc-backend.fly.dev/
- **ヘルスチェック**: https://nft-poc-backend.fly.dev/api/status
- **ホスティング**: fly.io
- **高可用性**: 2台のマシン（自動スケーリング）
- **イメージサイズ**: 81 MB

#### エンドポイント
- `POST /api/issue` - Verified IDクレデンシャル発行
- `POST /api/verify` - Verified ID検証開始
- `POST /api/callback` - Verified IDコールバック（検証完了後の処理）
- `POST /api/issuance-callback` - 発行コールバック
- `GET /api/status` - ヘルスチェック
- `GET /api/verification-status/{requestId}` - 検証ステータス取得

### 3. Go Mint Service（fly.io）

- **URL**: https://nft-poc-mint.fly.dev/
- **ヘルスチェック**: https://nft-poc-mint.fly.dev/health
- **ホスティング**: fly.io
- **高可用性**: 2台のマシン（自動スケーリング）
- **イメージサイズ**: 11 MB

#### エンドポイント
- `POST /mint` - Soulbound Tokenのミント
- `GET /health` - ヘルスチェック

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pages                              │
│              (johnyamanaka.github.io)                        │
│                                                              │
│  - WebFrontend (HTML/CSS/JavaScript)                         │
│  - 環境別設定 (config.js)                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTPS
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              C# Backend (fly.io)                             │
│           nft-poc-backend.fly.dev                            │
│                                                              │
│  - ASP.NET Core 8.0                                          │
│  - Microsoft Entra Verified ID連携                           │
│  - Azure AD認証                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTPS (検証完了後)
                   │
┌──────────────────▼──────────────────────────────────────────┐
│          Go Mint Service (fly.io)                            │
│           nft-poc-mint.fly.dev                               │
│                                                              │
│  - Go 1.24.11                                                │
│  - Ethereum (go-ethereum)                                    │
│  - Polygon Amoy Testnet接続                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ JSON-RPC
                   │
┌──────────────────▼──────────────────────────────────────────┐
│         Polygon Amoy Testnet                                 │
│      (rpc-amoy.polygon.technology)                           │
│                                                              │
│  - Smart Contract: 0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c│
│  - IdentitySBT (Soulbound Token)                             │
└─────────────────────────────────────────────────────────────┘
```

## 環境変数設定

### C# Backend環境変数

```bash
# Azure AD設定
AZURE_TENANT_ID=dea134e7-4f5a-4ce5-8978-baf426bf11ca
AZURE_CLIENT_ID=d553fb25-b8b9-43b0-ab4c-034f4da60a3e
AZURE_CLIENT_SECRET=<シークレット>

# Verified ID設定
VERIFIED_ID_AUTHORITY=did:web:johnyamanaka.github.io
VERIFIED_ID_CREDENTIAL_TYPE=VerifiedEmployeeV2
VERIFIED_ID_MANIFEST_URL=<マニフェストURL>

# ブロックチェーン設定
BLOCKCHAIN_CONTRACT_ADDRESS=0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c
BLOCKCHAIN_OWNER_WALLET=0x37c49282b53401dae95d466c6b69b3721dc11620
BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology

# サービス間通信
PUBLIC_BASE_URL=https://nft-poc-backend.fly.dev
MINT_SERVICE_URL=https://nft-poc-mint.fly.dev
```

### Go Mint Service環境変数

```bash
# ブロックチェーン接続
RPC_URL=https://rpc-amoy.polygon.technology
CONTRACT_ADDRESS=0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c

# ウォレット秘密鍵（注意: 本番環境では安全に管理すること）
PRIVATE_KEY=<秘密鍵>
```

## デプロイ手順

### 前提条件

- Git
- Node.js (フロントエンド開発用、オプション)
- Docker (ローカルテスト用、オプション)
- fly.io CLI (`flyctl`)
- Azure CLI (`az`)

### 1. フロントエンドのデプロイ（GitHub Pages）

#### 初回セットアップ

1. GitHubリポジトリの設定
   - Settings > Pages に移動
   - Source: "GitHub Actions" を選択

2. GitHub Actionsワークフローは自動的に実行されます
   - ファイル: `.github/workflows/deploy-frontend.yml`
   - トリガー: `main`ブランチへの`WebFrontend/`ディレクトリの変更

#### 更新方法

```bash
# WebFrontend配下のファイルを変更
git add WebFrontend/
git commit -m "feat: Update frontend"
git push origin main
```

GitHub Actionsが自動的にデプロイを実行します。

### 2. C# Backendのデプロイ（fly.io）

#### 初回セットアップ

```bash
# fly.ioにログイン
flyctl auth login

# アプリケーション作成（初回のみ）
cd VerifiedIDBackend
flyctl launch --name nft-poc-backend --region nrt --no-deploy

# 環境変数設定
flyctl secrets set \
  AZURE_TENANT_ID="<テナントID>" \
  AZURE_CLIENT_ID="<クライアントID>" \
  AZURE_CLIENT_SECRET="<シークレット>" \
  VERIFIED_ID_AUTHORITY="did:web:johnyamanaka.github.io" \
  VERIFIED_ID_CREDENTIAL_TYPE="VerifiedEmployeeV2" \
  VERIFIED_ID_MANIFEST_URL="<マニフェストURL>" \
  BLOCKCHAIN_CONTRACT_ADDRESS="0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c" \
  BLOCKCHAIN_OWNER_WALLET="0x37c49282b53401dae95d466c6b69b3721dc11620" \
  BLOCKCHAIN_RPC_URL="https://rpc-amoy.polygon.technology" \
  PUBLIC_BASE_URL="https://nft-poc-backend.fly.dev" \
  MINT_SERVICE_URL="https://nft-poc-mint.fly.dev"

# デプロイ
flyctl deploy
```

#### 更新方法

```bash
cd VerifiedIDBackend
flyctl deploy
```

### 3. Go Mint Serviceのデプロイ（fly.io）

#### 初回セットアップ

```bash
# fly.ioにログイン（済みの場合はスキップ）
flyctl auth login

# アプリケーション作成（初回のみ）
cd SBTMintService
flyctl launch --name nft-poc-mint --region nrt --no-deploy

# 環境変数設定
flyctl secrets set \
  RPC_URL="https://rpc-amoy.polygon.technology" \
  PRIVATE_KEY="<秘密鍵>" \
  CONTRACT_ADDRESS="0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c"

# デプロイ
flyctl deploy
```

#### 更新方法

```bash
cd SBTMintService
flyctl deploy
```

## 動作確認

### 1. ヘルスチェック

```bash
# C# Backend
curl https://nft-poc-backend.fly.dev/api/status
# 期待される応答: {"status":"running","timestamp":"..."}

# Go Mint Service
curl https://nft-poc-mint.fly.dev/health
# 期待される応答: {"status":"running"}
```

### 2. フロントエンドアクセス

ブラウザで https://johnyamanaka.github.io/nft-poc/ にアクセス

### 3. エンドツーエンドテスト

1. フロントエンドにアクセス
2. "発行" タブでVerified IDクレデンシャルを発行
3. Microsoft Authenticatorアプリでスキャン
4. "検証" タブで本人確認を実施
5. 検証完了後、自動的にSoulbound Tokenがミント
6. トランザクションハッシュが表示される
7. PolygonScan（Amoy）でトランザクションを確認

## トラブルシューティング

### デプロイが失敗する

```bash
# ログを確認
flyctl logs -a nft-poc-backend
flyctl logs -a nft-poc-mint

# マシンの状態を確認
flyctl status -a nft-poc-backend
flyctl status -a nft-poc-mint
```

### 環境変数が正しく設定されているか確認

```bash
# 設定済みの環境変数を確認（値は表示されません）
flyctl secrets list -a nft-poc-backend
flyctl secrets list -a nft-poc-mint
```

### Go Mint Serviceのビルドエラー

Go 1.24+が必要な依存関係があります。Dockerfileで以下のように設定されています：

```dockerfile
# Go 1.24.11ツールチェーンを明示的にダウンロード
RUN go install golang.org/dl/go1.24.11@latest && \
    go1.24.11 download

# ビルド時にgo1.24.11を使用
RUN go1.24.11 mod tidy && \
    go1.24.11 build -o main .
```

### CORS エラー

C# BackendのProgram.csで以下の設定を確認：

```csharp
app.UseCors(policy =>
{
    policy.AllowAnyOrigin()
          .AllowAnyMethod()
          .AllowAnyHeader();
});
```

### Soulbound Tokenのミントに失敗

1. ウォレットにMATICトークンがあるか確認
   - Polygon Amoy Faucet: https://faucet.polygon.technology/

2. RPCエンドポイントが応答しているか確認
   ```bash
   curl https://rpc-amoy.polygon.technology \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

3. コントラクトアドレスが正しいか確認
   - PolygonScan Amoy: https://amoy.polygonscan.com/address/0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c

## コスト

すべて無料サービスを使用：

- **GitHub Pages**: 無料
- **fly.io**: 無料枠（2台のシェアCPUマシン、合計512MB RAM）
- **Polygon Amoy Testnet**: 無料（テストネット）
- **Microsoft Entra Verified ID**: 無料（試用版）

## セキュリティ考慮事項

### 本番環境での推奨事項

1. **秘密鍵の管理**
   - `.env`ファイルをGitにコミットしない
   - fly.io secretsを使用して環境変数を安全に管理
   - 可能であれば、KMS（Key Management Service）を使用

2. **Azure ADシークレットのローテーション**
   - 定期的にクライアントシークレットを更新
   - 有効期限を設定

3. **CORS設定の見直し**
   - 本番環境では`AllowAnyOrigin()`を避ける
   - 特定のオリジンのみを許可

   ```csharp
   policy.WithOrigins("https://johnyamanaka.github.io")
         .AllowAnyMethod()
         .AllowAnyHeader();
   ```

4. **HTTPS強制**
   - fly.ioではデフォルトで強制されています（`force_https = true`）

5. **レート制限**
   - 必要に応じてAPIレート制限を実装

## モニタリング

### fly.ioダッシュボード

- C# Backend: https://fly.io/apps/nft-poc-backend/monitoring
- Go Mint Service: https://fly.io/apps/nft-poc-mint/monitoring

### ログの確認

```bash
# リアルタイムログ
flyctl logs -a nft-poc-backend
flyctl logs -a nft-poc-mint

# 過去のログ
flyctl logs -a nft-poc-backend --past 1h
```

### メトリクス

```bash
# アプリケーションステータス
flyctl status -a nft-poc-backend
flyctl status -a nft-poc-mint
```

## ロールバック

### 以前のバージョンに戻す

```bash
# デプロイ履歴を確認
flyctl releases -a nft-poc-backend

# 特定のバージョンにロールバック
flyctl releases rollback <version> -a nft-poc-backend
```

## スケーリング

### 手動スケーリング

```bash
# マシン数を増やす
flyctl scale count 3 -a nft-poc-backend

# メモリを増やす
flyctl scale memory 2048 -a nft-poc-backend
```

### 自動スケーリング（fly.toml）

```toml
[[vm]]
  memory = '1gb'
  cpu_kind = 'shared'
  cpus = 1

[http_service]
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0  # コスト削減のため0に設定
```

## 関連リンク

- **フロントエンド**: https://johnyamanaka.github.io/nft-poc/
- **C# Backend API**: https://nft-poc-backend.fly.dev/api/status
- **Go Mint Service**: https://nft-poc-mint.fly.dev/health
- **GitHubリポジトリ**: https://github.com/johnyamanaka/nft-poc
- **Polygon Amoy Explorer**: https://amoy.polygonscan.com/
- **スマートコントラクト**: https://amoy.polygonscan.com/address/0xFF49Af5D03DA6E855F97cE19384AE13086A32e0c

## サポート

問題が発生した場合は、GitHubのIssuesを使用してください：
https://github.com/johnyamanaka/nft-poc/issues
