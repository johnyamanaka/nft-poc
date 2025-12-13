# Verified ID + SBT Web Frontend

シンプルでモダンなWebフロントエンドで、Microsoft Entra Verified IDとSoulbound Tokenの統合デモを視覚的に体験できます。

## 🎨 特徴

- **モダンなUI/UX**: グラデーションとアニメーションを使用した美しいデザイン
- **リアルタイム状態監視**: バックエンドとミントサービスの稼働状況を自動チェック
- **QRコード生成**: ワンクリックで発行・検証用QRコードを生成
- **アクティビティログ**: 操作履歴をリアルタイムで表示
- **レスポンシブデザイン**: デスクトップ・タブレット・モバイルに対応

## 🚀 使用方法

### 1. ローカルで起動（推奨）

```bash
# WebFrontendディレクトリに移動
cd WebFrontend

# ブラウザで開く
start index.html
```

または、単純に `index.html` をダブルクリックしてブラウザで開きます。

### 2. 簡易Webサーバーで起動（推奨 - CORSエラー回避）

Pythonがインストールされている場合：

```bash
cd WebFrontend
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開きます。

Node.jsがインストールされている場合：

```bash
cd WebFrontend
npx http-server -p 8000
```

### 3. GitHub Pagesでホスティング（無料）

1. GitHubリポジトリの設定を開く
2. **Pages** → **Source** で `main` ブランチを選択
3. ルートディレクトリを `/WebFrontend` に設定
4. 数分後、`https://johnyamanaka.github.io/nft-poc/` でアクセス可能

## 📋 前提条件

以下のサービスが起動している必要があります：

- ✅ C# バックエンド (http://localhost:5062)
- ✅ Go ミントサービス (http://localhost:8080)
- ✅ ngrok トンネル

## 🛠️ 技術スタック

- **HTML5**: セマンティックなマークアップ
- **CSS3**: Flexbox、Grid、グラデーション、アニメーション
- **Vanilla JavaScript**: フレームワーク不要、軽量
- **Fetch API**: バックエンドとの通信

## 📱 使い方

### ステップ1: 資格情報の発行

1. ページを開くと、発行用QRコードが自動生成されます
2. Microsoft Authenticatorアプリでスキャン
3. 表示される情報を入力して送信

### ステップ2: 資格情報の検証とSBTミント

1. 検証用QRコードをスキャン
2. 保存した資格情報を選択
3. 送信すると自動的にSBTがミントされます

### QRコードの再生成

各カードの「🔄 QRコードを再生成」ボタンをクリックすると、新しいQRコードを生成できます。

## 🎨 カスタマイズ

### 色の変更

`styles.css` のグラデーション部分を編集：

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### ウォレットアドレスの変更

`index.html` の以下の部分を編集：

```html
<code id="wallet-address">0x37c49282b53401dae95d466c6b69b3721dc11620</code>
```

### APIエンドポイントの変更

`script.js` の設定部分を編集：

```javascript
const API_BASE_URL = 'http://localhost:5062';
const MINT_SERVICE_URL = 'http://localhost:8080';
```

## 🌐 本番環境へのデプロイ

### GitHub Pages（無料）

1. リポジトリ設定で GitHub Pages を有効化
2. `WebFrontend` フォルダをルートに設定
3. 自動的にデプロイされます

### Netlify（無料）

1. [Netlify](https://netlify.com) にサインアップ
2. リポジトリを接続
3. ビルドコマンド: （不要）
4. 公開ディレクトリ: `WebFrontend`

### Vercel（無料）

1. [Vercel](https://vercel.com) にサインアップ
2. リポジトリをインポート
3. ルートディレクトリを `WebFrontend` に設定

## 🔒 セキュリティ

- すべてのAPI呼び出しはローカルホスト経由
- 秘密鍵やクレデンシャルはフロントエンドに含まれていません
- CORSはバックエンドで適切に設定されています

## 📄 ファイル構成

```
WebFrontend/
├── index.html       # メインHTML（構造）
├── styles.css       # スタイルシート（デザイン）
├── script.js        # JavaScript（機能）
└── README.md        # このファイル
```

## 🐛 トラブルシューティング

### CORSエラーが発生する

**原因**: ブラウザのセキュリティポリシー

**解決策**:
- 簡易Webサーバー（Python、Node.js）を使用して起動
- または、ブラウザのCORS制限を一時的に無効化（開発時のみ）

### サービスが「オフライン」と表示される

**原因**: バックエンドまたはミントサービスが起動していない

**解決策**:
```bash
# C#バックエンドを起動
cd VerifiedIDBackend
dotnet run

# Goサービスを起動
cd SBTMintService
go run main.go IdentitySBT.go
```

### QRコードが生成されない

**原因**: バックエンドAPIへの接続エラー

**解決策**:
1. ブラウザのコンソール（F12）でエラーを確認
2. バックエンドが http://localhost:5062 で起動しているか確認
3. CORSが有効になっているか確認

## 💡 今後の拡張案

- [ ] WebSocketでリアルタイム通知
- [ ] トランザクション履歴の表示
- [ ] ダークモード対応
- [ ] 多言語対応（英語、日本語）
- [ ] PWA対応（オフライン動作）
- [ ] アニメーション効果の追加

## 📞 サポート

問題が発生した場合は、GitHubのIssuesで報告してください。

---

**作成日**: 2025年12月12日
**バージョン**: 1.0.0
