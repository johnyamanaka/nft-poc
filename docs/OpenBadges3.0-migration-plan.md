# OpenBadges 3.0 移行計画書

## 1. 概要

### 1.1 目的
現在のMicrosoft Entra Verified IDベースのマイクロクレデンシャル発行システムに、OpenBadges 3.0準拠のバッジ発行・検証機能を追加する。

### 1.2 方針
- 既存のMicrosoft Verified ID機能は**残す**（並存）
- SBTミント機能は**一時的に連携しない**（将来的に再連携可能な設計）
- OSSライブラリ（digitalbazaar/vc）を使用してOpenBadges 3.0を実装

### 1.3 スコープ
- OpenBadges 3.0形式でのバッジ発行
- 発行されたバッジの署名検証
- フロントエンドからのバッジ発行・検証UI
- バッジJSONのダウンロード機能

---

## 2. 現行アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                    (WebFrontend/)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ 大学     │  │ 学生     │  │ 企業     │                   │
│  │ (発行者) │  │ (受取人) │  │ (検証者) │                   │
│  └────┬─────┘  └──────────┘  └────┬─────┘                   │
└───────┼──────────────────────────┼───────────────────────────┘
        │                          │
        ▼                          ▼
┌───────────────────────────────────────────────────────────────┐
│                C# Backend (VerifiedIDBackend/)                 │
│  POST /api/issue          POST /api/verify                     │
│  POST /api/callback       GET /api/verification-status/{id}   │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │ Microsoft Entra Verified ID  │
              │ (外部サービス)                │
              └──────────────┬───────────────┘
                             │
                             ▼ (検証成功時)
              ┌──────────────────────────────┐
              │ Go Mint Service              │
              │ (SBTMintService/)            │
              │ POST /mint                   │
              └──────────────────────────────┘
```

---

## 3. 移行後アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend                                   │
│                       (WebFrontend/)                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  モード切替スイッチ                            │   │
│  │        [Microsoft VC]  ←→  [OpenBadges 3.0]                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │ 大学     │  │ 学生     │  │ 企業     │                          │
│  │ (発行者) │  │ (受取人) │  │ (検証者) │                          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                          │
└───────┼─────────────┼─────────────┼──────────────────────────────────┘
        │             │             │
        │  ┌──────────┴─────────────┘
        │  │  OpenBadges 3.0モード時
        ▼  ▼
┌───────────────────────────────────┐    ┌────────────────────────────┐
│  Node.js Badge Service (新規)     │    │ C# Backend (既存)          │
│  (BadgeService/)                  │    │ (VerifiedIDBackend/)       │
│                                   │    │                            │
│  POST /api/badge/issue            │    │ POST /api/issue            │
│  POST /api/badge/verify           │    │ POST /api/verify           │
│  GET  /health                     │    │ ...                        │
└───────────────────────────────────┘    └────────────────────────────┘
        │
        │ (将来的にSBT連携を再開する場合)
        ▼
┌───────────────────────────────────┐
│ Go Mint Service (既存・待機)      │
│ (SBTMintService/)                 │
└───────────────────────────────────┘
```

---

## 4. 新規コンポーネント詳細

### 4.1 BadgeService (Node.js)

#### ディレクトリ構成
```
BadgeService/
├── package.json
├── src/
│   ├── index.js              # Express サーバー
│   ├── services/
│   │   ├── issuer.js         # バッジ発行ロジック
│   │   ├── verifier.js       # バッジ検証ロジック
│   │   └── documentLoader.js # JSON-LDコンテキストローダー
│   └── config/
│       └── issuer.js         # 発行者設定
├── keys/                     # 署名鍵（.gitignore対象）
│   ├── issuer-key.json       # 秘密鍵+公開鍵
│   ├── issuer-public-key.json
│   └── did-document.json     # DIDドキュメント
└── scripts/
    └── generate-keys.js      # 鍵生成スクリプト
```

#### 使用ライブラリ
| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| @digitalbazaar/vc | ^7.0.0 | VC発行・検証 |
| @digitalbazaar/ed25519-signature-2020 | ^5.4.0 | Ed25519署名 |
| @digitalbazaar/ed25519-verification-key-2020 | ^4.1.0 | 鍵管理 |
| @digitalcredentials/open-badges-context | ^3.0.0 | OB3.0コンテキスト |
| express | ^4.18.2 | HTTPサーバー |
| cors | ^2.8.5 | CORS対応 |
| uuid | ^9.0.0 | UUID生成 |

#### APIエンドポイント

##### POST /api/badge/issue
バッジを発行する

**リクエスト:**
```json
{
  "recipientName": "山田 太郎",
  "recipientEmail": "taro.yamada@example.com",
  "achievementName": "データサイエンス基礎",
  "achievementDescription": "データサイエンスの基礎的な知識とスキルを習得",
  "issuerName": "○○大学",
  "courseName": "データサイエンス入門",
  "courseCode": "DS101",
  "completionDate": "2025-01-15",
  "grade": "優",
  "credits": "2"
}
```

**レスポンス:**
```json
{
  "success": true,
  "credential": {
    "@context": [...],
    "type": ["VerifiableCredential", "OpenBadgeCredential"],
    "issuer": {...},
    "credentialSubject": {...},
    "proof": {...}
  },
  "message": "OpenBadge credential issued successfully"
}
```

##### POST /api/badge/verify
バッジの署名を検証する

**リクエスト:**
```json
{
  "credential": { /* 発行されたバッジJSON */ }
}
```

**レスポンス:**
```json
{
  "verified": true,
  "results": [...],
  "message": "Credential is valid"
}
```

---

### 4.2 フロントエンド変更

#### モード切替機能
- ヘッダーまたはロールセレクター画面にモード切替スイッチを追加
- 選択したモードによってAPI呼び出し先を切り替え

#### 大学（発行者）画面の変更
- OpenBadgesモード時は `/api/badge/issue` を呼び出し
- QRコードの代わりにバッジJSONを表示
- バッジJSONダウンロードボタンを追加

#### 学生（受取人）画面の変更
- バッジJSON表示エリアの追加
- バッジのビジュアル表示（将来的にバッジ画像対応）

#### 企業（検証者）画面の変更
- バッジJSONアップロード/ペースト機能
- `/api/badge/verify` を呼び出して検証
- 検証結果の表示

---

## 5. OpenBadges 3.0 クレデンシャル構造

### 発行されるバッジの例
```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "urn:uuid:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "issuer": {
    "id": "did:web:example.university.edu",
    "type": ["Profile"],
    "name": "○○大学"
  },
  "validFrom": "2025-01-15T00:00:00Z",
  "name": "データサイエンス基礎",
  "credentialSubject": {
    "id": "urn:uuid:...",
    "type": ["AchievementSubject"],
    "name": "山田 太郎",
    "achievement": {
      "id": "urn:uuid:...",
      "type": ["Achievement"],
      "name": "データサイエンス基礎",
      "description": "データサイエンスの基礎的な知識とスキルを習得",
      "criteria": {
        "narrative": "データサイエンス入門を修了し、必要な評価基準を満たしたことを証明します。"
      },
      "fieldOfStudy": "データサイエンス入門",
      "humanCode": "DS101"
    },
    "result": [
      {
        "type": ["Result"],
        "resultDescription": {
          "name": "成績評価",
          "resultType": "GradeLevel"
        },
        "value": "優"
      },
      {
        "type": ["Result"],
        "resultDescription": {
          "name": "単位数",
          "resultType": "CreditHours"
        },
        "value": "2"
      }
    ],
    "achievementDate": "2025-01-15"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2025-01-15T12:00:00Z",
    "verificationMethod": "did:web:example.university.edu#key-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "z..."
  }
}
```

---

## 6. 実装ステップ

### Phase 1: 基盤構築
| # | タスク | 詳細 |
|---|--------|------|
| 1-1 | BadgeServiceディレクトリ作成 | package.json, 基本ファイル構成 |
| 1-2 | 依存ライブラリインストール | npm install |
| 1-3 | 鍵生成スクリプト作成・実行 | Ed25519キーペア生成 |

### Phase 2: バックエンド実装
| # | タスク | 詳細 |
|---|--------|------|
| 2-1 | Expressサーバー実装 | index.js |
| 2-2 | 発行サービス実装 | issuer.js |
| 2-3 | 検証サービス実装 | verifier.js |
| 2-4 | DocumentLoader実装 | JSON-LDコンテキスト解決 |
| 2-5 | 動作確認（curl/Postman） | API単体テスト |

### Phase 3: フロントエンド実装
| # | タスク | 詳細 |
|---|--------|------|
| 3-1 | モード切替UI追加 | スイッチコンポーネント |
| 3-2 | 発行画面修正 | OpenBadges API呼び出し |
| 3-3 | 検証画面修正 | バッジアップロード・検証 |
| 3-4 | バッジ表示コンポーネント | JSON表示、ダウンロード |

### Phase 4: 統合・テスト
| # | タスク | 詳細 |
|---|--------|------|
| 4-1 | E2Eテスト | 発行→ダウンロード→検証 |
| 4-2 | エラーハンドリング確認 | 異常系テスト |
| 4-3 | ドキュメント更新 | README更新 |

---

## 7. 設定・環境

### 7.1 開発環境
| サービス | URL |
|---------|-----|
| Badge Service | http://localhost:3000 |
| C# Backend | http://localhost:5062 |
| Go Mint Service | http://localhost:8080 |
| Frontend | http://localhost:5500 (Live Server) |

### 7.2 本番環境（将来）
| サービス | URL |
|---------|-----|
| Badge Service | https://nft-poc-badge.onrender.com |
| C# Backend | https://nft-poc-backend.onrender.com |

### 7.3 環境変数
```env
# BadgeService
PORT=3000
ISSUER_DID=did:web:example.university.edu
```

---

## 8. セキュリティ考慮事項

### 8.1 鍵管理
- 秘密鍵（issuer-key.json）は`.gitignore`に追加
- 本番環境では環境変数またはシークレット管理サービスを使用

### 8.2 CORS設定
- 開発時は全オリジン許可
- 本番環境では許可オリジンを限定

### 8.3 入力検証
- 必須フィールドのバリデーション
- 不正なJSONの拒否

---

## 9. 将来の拡張

### 9.1 SBT連携の再開
OpenBadges発行成功時にSBTをミントする場合：
```javascript
// issuer.js での拡張例
const signedCredential = await vc.issue({...});

// SBTミント呼び出しを追加
if (walletAddress) {
  await mintSBT(walletAddress, signedCredential.id);
}
```

### 9.2 バッジ画像対応
- Achievement.imageプロパティの追加
- 画像ホスティング（S3/Cloudflare R2等）

### 9.3 失効（Revocation）対応
- StatusList2021による失効管理
- credentialStatus プロパティの追加

---

## 10. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 秘密鍵の漏洩 | 不正なバッジ発行が可能に | .gitignore、シークレット管理 |
| OSSライブラリの脆弱性 | セキュリティリスク | 定期的な依存関係更新 |
| JSON-LDコンテキストの変更 | 検証失敗の可能性 | コンテキストのローカルキャッシュ |

---

## 11. 承認

| 項目 | 確認者 | 日付 |
|------|--------|------|
| 計画内容の承認 | | |
| 実装開始の承認 | | |

---

## 付録A: 参考リンク

- [OpenBadges 3.0 Specification](https://www.imsglobal.org/spec/ob/v3p0)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model-2.0/)
- [digitalbazaar/vc GitHub](https://github.com/digitalbazaar/vc)
- [1EdTech Open Badges](https://www.1edtech.org/standards/open-badges)
