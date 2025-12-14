// 環境別設定
const CONFIG = {
    // 本番環境（GitHub Pages）
    production: {
        API_BASE_URL: 'https://nft-poc-backend.fly.dev',
        MINT_SERVICE_URL: 'https://nft-poc-mint.fly.dev'
    },
    // 開発環境（ローカル）
    development: {
        API_BASE_URL: 'http://localhost:5062',
        MINT_SERVICE_URL: 'http://localhost:8080'
    }
};

// 環境判定（GitHub PagesならプロダクションモードにならないURLならDev）
function getEnvironment() {
    const hostname = window.location.hostname;

    // GitHub Pagesまたはカスタムドメインの場合
    if (hostname === 'johnyamanaka.github.io' ||
        hostname.includes('.github.io') ||
        hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return 'production';
    }

    // それ以外はローカル開発環境
    return 'development';
}

// 現在の環境の設定を取得
const ENV = getEnvironment();
const API_BASE_URL = CONFIG[ENV].API_BASE_URL;
const MINT_SERVICE_URL = CONFIG[ENV].MINT_SERVICE_URL;

// デバッグ用
console.log(`🌍 Environment: ${ENV}`);
console.log(`📡 API Backend: ${API_BASE_URL}`);
console.log(`⛓️ Mint Service: ${MINT_SERVICE_URL}`);
