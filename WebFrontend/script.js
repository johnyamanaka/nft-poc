// Configuration
// API_BASE_URL and MINT_SERVICE_URL are defined in config.js

// Activity log
let activities = [];
let currentRole = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 マイクロクレデンシャルシステムを初期化中...');

    // Check service status
    checkServiceStatus();

    // Set up periodic status check
    setInterval(checkServiceStatus, 10000); // Check every 10 seconds

    addActivity('システムが起動しました');
});

// Role Selection
function selectRole(role) {
    currentRole = role;

    // Hide role selector
    document.getElementById('role-selector').style.display = 'none';

    // Hide all role views
    document.getElementById('university-view').style.display = 'none';
    document.getElementById('student-view').style.display = 'none';
    document.getElementById('company-view').style.display = 'none';

    // Show selected role view
    document.getElementById(`${role}-view`).style.display = 'block';

    // Log activity
    const roleNames = {
        'university': '🏛️ 大学',
        'student': '👨‍🎓 学生',
        'company': '🏢 企業'
    };
    addActivity(`${roleNames[role]}モードを選択しました`);

    console.log(`✅ Role selected: ${role}`);
}

function resetRole() {
    currentRole = null;

    // Show role selector
    document.getElementById('role-selector').style.display = 'block';

    // Hide all role views
    document.getElementById('university-view').style.display = 'none';
    document.getElementById('student-view').style.display = 'none';
    document.getElementById('company-view').style.display = 'none';

    addActivity('役割選択画面に戻りました');
}

// Check if backend services are running
async function checkServiceStatus() {
    // Check backend
    try {
        const response = await fetch(`${API_BASE_URL}/api/status`, {
            method: 'GET',
            mode: 'cors'
        });

        if (response.ok) {
            updateStatus('backend-status', 'オンライン', 'online');
        } else {
            updateStatus('backend-status', 'エラー', 'offline');
        }
    } catch (error) {
        updateStatus('backend-status', 'オフライン', 'offline');
    }

    // Check mint service
    try {
        const response = await fetch(`${MINT_SERVICE_URL}/health`, {
            method: 'GET',
            mode: 'cors'
        });

        if (response.ok) {
            updateStatus('mint-status', 'オンライン', 'online');
        } else {
            updateStatus('mint-status', 'エラー', 'offline');
        }
    } catch (error) {
        updateStatus('mint-status', 'オフライン', 'offline');
    }
}

function updateStatus(elementId, text, statusClass) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        element.className = `status-indicator ${statusClass}`;
    }
}

// Generate Issuance QR Code (University)
async function generateIssuanceQR() {
    // Student information
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const studentId = document.getElementById('studentId').value;

    // Course information
    const courseName = document.getElementById('courseName').value;
    const courseCode = document.getElementById('courseCode').value;
    const completionDate = document.getElementById('completionDate').value;
    const grade = document.getElementById('grade').value;
    const credits = document.getElementById('credits').value;

    // Issuer information
    const issuerName = document.getElementById('issuerName').value;
    const issuerDepartment = document.getElementById('issuerDepartment').value;

    // Validate required fields
    if (!firstName || !lastName || !studentId || !courseName || !completionDate || !issuerName) {
        alert('必須項目（*）をすべて入力してください');
        return;
    }

    try {
        addActivity(`🏛️ 大学: ${lastName} ${firstName}さんの資格発行QRコードを生成中...`);
        addActivity(`📚 講座: ${courseName}`);

        const response = await fetch(`${API_BASE_URL}/api/issue`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName: firstName,
                lastName: lastName,
                email: studentId,
                courseName: courseName,
                courseCode: courseCode,
                completionDate: completionDate,
                grade: grade,
                credits: credits,
                issuerName: issuerName,
                issuerDepartment: issuerDepartment
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate issuance QR code');
        }

        const data = await response.json();

        // Display QR code
        const qrImg = document.getElementById('university-qr');
        qrImg.src = data.qrCode;

        // Show result
        document.getElementById('university-qr-result').style.display = 'block';

        addActivity(`✅ 発行用QRコード生成完了: ${lastName} ${firstName}さん`);
        console.log('✅ Issuance QR code generated for university');
    } catch (error) {
        console.error('❌ Error generating issuance QR:', error);
        alert('エラー: QRコードの生成に失敗しました');
        addActivity('❌ エラー: 発行用QRコードの生成に失敗');
    }
}

// Generate Verification QR Code (Company)
async function generateVerificationQR() {
    const walletAddress = document.getElementById('walletAddress').value;

    if (!walletAddress) {
        alert('ウォレットアドレスを入力してください');
        return;
    }

    try {
        addActivity('🏢 企業: 検証用QRコードを生成中...');

        const response = await fetch(`${API_BASE_URL}/api/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                walletAddress: walletAddress
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate verification QR code');
        }

        const data = await response.json();

        // Display QR code
        const qrImg = document.getElementById('company-qr');
        qrImg.src = data.qrCode;

        // Show result
        document.getElementById('company-qr-result').style.display = 'block';

        // Display verification link
        if (data.verificationUrl) {
            const linkBox = document.getElementById('verification-link-box');
            const urlInput = document.getElementById('verification-url-input');
            urlInput.value = data.verificationUrl;
            linkBox.style.display = 'block';

            // Store URL globally for copy/email functions
            window.currentVerificationUrl = data.verificationUrl;
        }

        addActivity('✅ 検証用QRコード生成完了');
        addActivity(`📝 SBT発行先: ${walletAddress}`);
        addActivity('🔗 オンライン共有用リンクも生成されました');
        console.log('✅ Verification QR code generated for company');

        // 検証状態をポーリング
        pollVerificationStatus(data.requestId, walletAddress);
    } catch (error) {
        console.error('❌ Error generating verification QR:', error);
        alert('エラー: QRコードの生成に失敗しました');
        addActivity('❌ エラー: 検証用QRコードの生成に失敗');
    }
}

// Poll verification status
async function pollVerificationStatus(requestId, walletAddress) {
    const maxAttempts = 60; // 最大5分間（5秒ごと）
    let attempts = 0;

    const checkStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/verification-status/${requestId}`);

            if (!response.ok) {
                return; // まだ状態が更新されていない
            }

            const status = await response.json();

            if (status.status === 'verified' && status.transactionHash) {
                // 検証成功！トランザクションハッシュを表示
                displayTransactionLink(status.transactionHash, walletAddress);
                addActivity(`🎉 検証成功！SBTがミントされました`);
                addActivity(`⛓️ トランザクションハッシュ: ${status.transactionHash.substring(0, 10)}...`);
                return; // ポーリング終了
            } else if (status.status === 'failed') {
                addActivity(`❌ 検証に失敗しました`);
                return; // ポーリング終了
            }

            // まだ pending の場合、続けてポーリング
            if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkStatus, 5000); // 5秒後に再チェック
            }
        } catch (error) {
            console.error('Error polling verification status:', error);
            if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkStatus, 5000);
            }
        }
    };

    // 最初のチェックは10秒後（ユーザーがQRコードをスキャンする時間を確保）
    setTimeout(checkStatus, 10000);
}

// Display transaction link
function displayTransactionLink(txHash, walletAddress) {
    const resultDiv = document.getElementById('company-qr-result');

    // トランザクションリンクを追加
    const txLinkHtml = `
        <div class="success-box" style="margin-top: 20px;">
            <strong>✅ SBTミント成功！</strong>
            <p style="margin-top: 10px;">
                <strong>トランザクション:</strong><br>
                <a href="https://amoy.polygonscan.com/tx/${txHash}" target="_blank" rel="noopener noreferrer"
                   style="color: #667eea; text-decoration: none; word-break: break-all;">
                    ${txHash}
                    <span style="margin-left: 5px;">🔗</span>
                </a>
            </p>
            <p style="margin-top: 10px;">
                <strong>受信者:</strong><br>
                <span style="word-break: break-all;">${walletAddress}</span>
            </p>
            <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                ⛓️ Polygon Amoy Testnet上でブロックチェーントランザクションを確認できます
            </p>
        </div>
    `;

    resultDiv.insertAdjacentHTML('beforeend', txLinkHtml);
}

// Copy verification link to clipboard
function copyVerificationLink() {
    const url = window.currentVerificationUrl;
    if (!url) {
        alert('エラー: リンクが見つかりません');
        return;
    }

    navigator.clipboard.writeText(url).then(() => {
        alert('✅ リンクをクリップボードにコピーしました！\n\n応募者に送信してください。');
        addActivity('📋 検証リンクをコピーしました');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback: select the input
        const urlInput = document.getElementById('verification-url-input');
        urlInput.select();
        alert('リンクを選択しました。Ctrl+C（Mac: Cmd+C）でコピーしてください。');
    });
}

// Send verification link via email
function sendVerificationEmail() {
    const url = window.currentVerificationUrl;
    if (!url) {
        alert('エラー: リンクが見つかりません');
        return;
    }

    const subject = encodeURIComponent('【資格検証】マイクロクレデンシャルの提示をお願いします');
    const body = encodeURIComponent(`
お世話になっております。

マイクロクレデンシャル（デジタル資格証明書）の提示をお願いいたします。

以下のリンクをクリックして、保持している資格情報を提示してください：

${url}

【提示方法】
1. 上記のリンクをクリック
2. Microsoft Authenticatorアプリが自動的に起動します
3. 提示する資格情報を選択
4. 「送信」をタップして提示完了

ご不明な点がございましたら、お気軽にお問い合わせください。

よろしくお願いいたします。
    `.trim());

    const mailto = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailto;

    addActivity('📧 メールアプリを起動しました');
}

// Add activity to log
function addActivity(message) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP');

    activities.unshift({
        time: timeString,
        message: message
    });

    // Keep only last 20 activities
    if (activities.length > 20) {
        activities = activities.slice(0, 20);
    }

    updateActivityLog();
}

function updateActivityLog() {
    const logContainer = document.getElementById('activity-log');

    if (activities.length === 0) {
        logContainer.innerHTML = '<p class="empty-state">アクティビティはまだありません</p>';
        return;
    }

    logContainer.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-time">${activity.time}</div>
            <div class="activity-message">${activity.message}</div>
        </div>
    `).join('');
}

// Wake up backend services
async function wakeUpServices() {
    const btn = document.getElementById('wake-up-btn');

    // Disable button and show waking state
    btn.disabled = true;
    btn.classList.add('waking');
    btn.textContent = '⏳ 起動中...';

    addActivity('🚀 バックエンドサービスを起動中...');

    try {
        // Wake up both services in parallel
        const wakePromises = [
            wakeUpService('backend', `${API_BASE_URL}/api/status`, 'バックエンドAPI'),
            wakeUpService('mint', `${MINT_SERVICE_URL}/health`, 'ミントサービス')
        ];

        const results = await Promise.allSettled(wakePromises);

        // Check results
        const successCount = results.filter(r => r.status === 'fulfilled').length;

        if (successCount === 2) {
            addActivity('✅ すべてのサービスが起動しました');
            btn.textContent = '✅ 起動完了';
        } else if (successCount === 1) {
            addActivity('⚠️ 一部のサービスの起動に失敗しました');
            btn.textContent = '⚠️ 一部起動';
        } else {
            addActivity('❌ サービスの起動に失敗しました');
            btn.textContent = '❌ 起動失敗';
        }

        // Re-check status immediately
        setTimeout(checkServiceStatus, 1000);

    } catch (error) {
        console.error('Error waking up services:', error);
        addActivity('❌ サービス起動中にエラーが発生しました');
        btn.textContent = '❌ エラー';
    } finally {
        // Re-enable button after 3 seconds
        setTimeout(() => {
            btn.disabled = false;
            btn.classList.remove('waking');
            btn.textContent = '🚀 バックエンドを起動';
        }, 3000);
    }
}

// Wake up a single service with retries
async function wakeUpService(serviceName, url, displayName) {
    const maxRetries = 12; // 最大12回 (約2分)
    const retryDelay = 10000; // 10秒ごと

    addActivity(`⏳ ${displayName}を起動中...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                signal: AbortSignal.timeout(20000) // 20秒タイムアウト
            });

            if (response.ok) {
                // 成功！
                addActivity(`✅ ${displayName}が起動しました (${attempt}回目の試行)`);
                return true;
            } else if (response.status === 502) {
                // 502 Bad Gateway = サービス起動中
                console.log(`${displayName} is waking up (502 Bad Gateway), attempt ${attempt}/${maxRetries}`);
                if (attempt < maxRetries) {
                    const remainingTime = Math.ceil((maxRetries - attempt) * retryDelay / 1000);
                    addActivity(`⏳ ${displayName}起動中... (${attempt}/${maxRetries}) 残り最大${remainingTime}秒`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            } else {
                // その他のHTTPエラー
                console.log(`${displayName} returned status ${response.status}, attempt ${attempt}/${maxRetries}`);
                if (attempt < maxRetries) {
                    const remainingTime = Math.ceil((maxRetries - attempt) * retryDelay / 1000);
                    addActivity(`⏳ ${displayName}起動待機中... (${attempt}/${maxRetries}) 残り最大${remainingTime}秒`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        } catch (error) {
            // ネットワークエラーまたはタイムアウト
            console.log(`${displayName} wake up attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (attempt < maxRetries) {
                const remainingTime = Math.ceil((maxRetries - attempt) * retryDelay / 1000);
                addActivity(`⏳ ${displayName}起動待機中... (${attempt}/${maxRetries}) 残り最大${remainingTime}秒`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    addActivity(`❌ ${displayName}の起動がタイムアウトしました`);
    throw new Error(`${displayName} failed to wake up after ${maxRetries} attempts`);
}

// Make functions available globally
window.selectRole = selectRole;
window.resetRole = resetRole;
window.generateIssuanceQR = generateIssuanceQR;
window.generateVerificationQR = generateVerificationQR;
window.wakeUpServices = wakeUpServices;
