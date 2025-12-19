// 現在のホスト名とポートを使用（別PCからのアクセスに対応）
// 開発時: http://localhost:8000
// 別PCから: http://[サーバーのIPアドレス]:8000
const API_BASE_URL = window.location.origin;

// チャット履歴管理
let chatHistory = [];
let currentChatId = null;

// LocalStorageから履歴を読み込む
function loadChatHistory() {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
        chatHistory = JSON.parse(saved);
    }
    renderChatHistory();
}

// 履歴を保存
function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

// 履歴を表示
function renderChatHistory() {
    const historyDiv = document.getElementById('chatHistory');
    if (chatHistory.length === 0) {
        historyDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 0.85rem;">履歴がありません</div>';
        return;
    }

    historyDiv.innerHTML = chatHistory.map(chat => `
        <div class="history-item ${chat.id === currentChatId ? 'active' : ''}" onclick="loadChat('${chat.id}')">
            <div class="history-item-title">${chat.title}</div>
            <div class="history-item-date">${new Date(chat.date).toLocaleString('ja-JP', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</div>
        </div>
    `).reverse().join('');
}

// 新規チャット作成
function createNewChat() {
    const chatId = 'chat_' + Date.now();
    const newChat = {
        id: chatId,
        title: '新しいチャット',
        date: new Date().toISOString(),
        messages: []
    };

    chatHistory.push(newChat);
    currentChatId = chatId;

    // チャットエリアをクリア
    document.getElementById('chatMessages').innerHTML = `
        <div class="message assistant">
            <div class="message-header">アシスタント</div>
            <div>
                <p style="font-size: 0.95rem;">こんにちは！ファイルをアップロードして、質問してください。</p>
                <div style="margin-top: 8px; padding: 8px; background: #f0f8ff; border-left: 3px solid #667eea; border-radius: 5px; font-size: 0.85rem;">
                    <strong>💡 より精度の高い回答を得るコツ:</strong>
                    <ul style="margin: 5px 0 0 18px; padding: 0;">
                        <li>具体的で明確な質問をする（例: 「○○の手順を教えてください」）</li>
                        <li>コンテキストを含める（例: 「Pythonで○○する方法」）</li>
                        <li>ドキュメント内の用語を使う（専門用語や正式名称）</li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    saveChatHistory();
    renderChatHistory();
}

// チャットを読み込む
function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;

    // メッセージを復元
    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = chat.messages.map(msg => {
        let html = `
            <div class="message ${msg.type}">
                <div class="message-header">${msg.sender}</div>
                <div>${msg.text}</div>
        `;

        if (msg.sources && msg.sources.length > 0) {
            const sourceId = 'sources-' + Date.now() + Math.random();
            html += `
                <div class="sources">
                    <div class="sources-title" onclick="toggleSources('${sourceId}')">
                        <span class="sources-toggle collapsed" id="${sourceId}-toggle">▼</span>
                        参照元 (${msg.sources.length}件)
                    </div>
                    <div class="sources-list collapsed" id="${sourceId}">
                        ${msg.sources.map(s => `<div>• ${s}</div>`).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }).join('');

    renderChatHistory();
}

// 現在のチャットにメッセージを保存
function saveMessageToHistory(sender, text, type, sources = null) {
    if (!currentChatId) {
        createNewChat();
    }

    const chat = chatHistory.find(c => c.id === currentChatId);
    if (!chat) return;

    chat.messages.push({ sender, text, type, sources });

    // 最初のユーザーメッセージをタイトルにする
    if (type === 'user' && chat.messages.filter(m => m.type === 'user').length === 1) {
        chat.title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
    }

    chat.date = new Date().toISOString();
    saveChatHistory();
    renderChatHistory();
}

// メインタブ切り替え
function switchMainTab(tabName) {
    // すべてのタブとタブコンテンツを取得
    const tabs = document.querySelectorAll('.main-tab');
    const tabContents = document.querySelectorAll('.main-tab-content');

    // すべてのタブとコンテンツから active クラスを削除
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // クリックされたタブと対応するコンテンツに active クラスを追加
    event.target.classList.add('active');
    document.getElementById(tabName + '-main').classList.add('active');
}

// 初期化
async function init() {
    loadChatHistory();
    createNewChat(); // 初回は新規チャット作成
    await checkHealth();
    await loadDocuments();
    await loadModels();
    setupDragAndDrop();
}

// ドラッグアンドドロップの設定
function setupDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');

    // ドラッグオーバー時
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.style.background = '#e8e8ff';
        uploadArea.style.borderColor = '#764ba2';
    });

    // ドラッグが離れた時
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.style.background = '';
        uploadArea.style.borderColor = '#667eea';
    });

    // ドロップ時
    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadArea.style.background = '';
        uploadArea.style.borderColor = '#667eea';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await handleFileUpload(files);
        }
    });
}

// ヘルスチェック
async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        const statusDiv = document.getElementById('healthStatus');

        if (data.status === 'healthy' && data.ollama_available) {
            statusDiv.innerHTML = '<div class="status success">正常に動作中</div>';
        } else if (data.status === 'healthy') {
            statusDiv.innerHTML = '<div class="status error">Ollama未接続</div>';
        } else {
            statusDiv.innerHTML = '<div class="status error">エラー</div>';
        }
    } catch (error) {
        document.getElementById('healthStatus').innerHTML =
            '<div class="status error">サーバー未接続</div>';
    }
}

// ドキュメント一覧の読み込み
async function loadDocuments() {
    try {
        const response = await fetch(`${API_BASE_URL}/documents`);
        const data = await response.json();
        const listElement = document.getElementById('documentList');

        if (data.documents.length === 0) {
            listElement.innerHTML = '<li style="text-align: center; color: #999;">ドキュメントなし</li>';
        } else {
            listElement.innerHTML = data.documents
                .map(doc => `<li class="document-item">${doc}</li>`)
                .join('');
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

// モデル一覧の読み込み
async function loadModels() {
    const modelCountDiv = document.getElementById('modelCount');
    try {
        modelCountDiv.innerHTML = '読み込み中...';

        const response = await fetch(`${API_BASE_URL}/models`);
        const data = await response.json();

        // 両方のセレクトボックスを更新
        const selectElement = document.getElementById('modelSelect');
        const selectElementSettings = document.getElementById('modelSelectSettings');

        // 現在選択されているモデルを保存
        const currentValue = selectElement.value;

        // モデルオプションHTMLを構築
        let optionsHTML = '<option value="">デフォルト (llama3.2)</option>';

        // 取得したモデルを追加
        if (data.models && data.models.length > 0) {
            // モデルを名前順にソート
            const sortedModels = data.models.sort();

            sortedModels.forEach(model => {
                optionsHTML += `<option value="${model}">${model}</option>`;
            });

            // 両方のセレクトボックスを更新
            selectElement.innerHTML = optionsHTML;
            selectElementSettings.innerHTML = optionsHTML;

            // 以前の選択を復元
            if (currentValue) {
                selectElement.value = currentValue;
                selectElementSettings.value = currentValue;
            }

            modelCountDiv.innerHTML = `✓ ${data.models.length} 個のモデルが利用可能`;
            modelCountDiv.style.color = '#155724';
        } else {
            selectElement.innerHTML = optionsHTML;
            selectElementSettings.innerHTML = optionsHTML;

            modelCountDiv.innerHTML = '⚠ モデルが見つかりません';
            modelCountDiv.style.color = '#856404';
        }
    } catch (error) {
        console.error('Error loading models:', error);
        modelCountDiv.innerHTML = '✗ モデル読み込みエラー';
        modelCountDiv.style.color = '#721c24';
    }
}

// モデル選択を同期
document.addEventListener('DOMContentLoaded', function() {
    const selectElement = document.getElementById('modelSelect');
    const selectElementSettings = document.getElementById('modelSelectSettings');

    selectElement.addEventListener('change', function() {
        selectElementSettings.value = this.value;
    });

    selectElementSettings.addEventListener('change', function() {
        selectElement.value = this.value;
    });
});

// 通知を表示
function showNotification(message, type = 'info') {
    // 既存の通知を削除
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // 新しい通知を作成
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // 3秒後に自動的に削除
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ファイルアップロード（input要素から）
async function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;

    if (files.length === 0) return;

    await handleFileUpload(files);
    fileInput.value = '';
}

// ファイルアップロード処理（共通）
async function handleFileUpload(files) {
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

    // アップロードエリアにローディング表示
    const uploadArea = document.querySelector('.upload-area');
    const originalContent = uploadArea.innerHTML;
    uploadArea.innerHTML = `
        <div class="upload-loading">
            <div class="loading-spinner" style="margin: 0 auto 10px;"></div>
            <div>${files.length}個のファイルをアップロード中...</div>
        </div>
    `;
    uploadArea.style.pointerEvents = 'none';

    try {
        showNotification(`${files.length}個のファイルをアップロード中...`, 'info');

        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showNotification(`アップロード完了: ${data.files.join(', ')}`, 'success');
            await loadDocuments();
        } else {
            showNotification(`エラー: ${data.detail}`, 'error');
        }
    } catch (error) {
        showNotification(`アップロードエラー: ${error.message}`, 'error');
    } finally {
        // ローディング表示を元に戻す
        uploadArea.innerHTML = originalContent;
        uploadArea.style.pointerEvents = 'auto';
    }
}

// ドキュメント削除
async function clearDocuments() {
    if (!confirm('すべてのドキュメントを削除しますか?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/documents`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('すべてのドキュメントを削除しました', 'success');
            await loadDocuments();
        } else {
            showNotification('削除に失敗しました', 'error');
        }
    } catch (error) {
        showNotification(`削除エラー: ${error.message}`, 'error');
    }
}

// 質問送信
async function sendQuestion() {
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect.value;

    if (!question) return;

    addMessage('あなた', question, 'user');
    input.value = '';

    // ローディングメッセージを追加
    const loadingId = addLoadingMessage();

    try {
        const requestBody = {
            question,
            stream: false
        };

        // モデルが選択されている場合のみ追加
        if (selectedModel) {
            requestBody.model = selectedModel;
        }

        const response = await fetch(`${API_BASE_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // ローディングメッセージを削除
        removeLoadingMessage(loadingId);

        if (response.ok) {
            addMessage('アシスタント', data.answer, 'assistant', data.sources);
        } else {
            addMessage('システム', `エラー: ${data.detail}`, 'error');
        }
    } catch (error) {
        // ローディングメッセージを削除
        removeLoadingMessage(loadingId);
        addMessage('システム', `エラー: ${error.message}`, 'error');
    }
}

// ローディングメッセージを追加
function addLoadingMessage() {
    const messagesDiv = document.getElementById('chatMessages');
    const loadingDiv = document.createElement('div');
    const loadingId = 'loading-' + Date.now();

    loadingDiv.id = loadingId;
    loadingDiv.className = 'loading-message';
    loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <div>回答を生成中...</div>
    `;

    messagesDiv.appendChild(loadingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    return loadingId;
}

// ローディングメッセージを削除
function removeLoadingMessage(loadingId) {
    const loadingDiv = document.getElementById(loadingId);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// メッセージ追加
function addMessage(sender, text, type = 'assistant', sources = null) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    let className = 'message';
    if (type === 'user') className += ' user';
    else if (type === 'assistant') className += ' assistant';

    messageDiv.className = className;

    let html = `<div class="message-header">${sender}</div><div>${text}</div>`;

    if (sources && sources.length > 0) {
        const sourceId = 'sources-' + Date.now();
        html += `
            <div class="sources">
                <div class="sources-title" onclick="toggleSources('${sourceId}')">
                    <span class="sources-toggle collapsed" id="${sourceId}-toggle">▼</span>
                    参照元 (${sources.length}件)
                </div>
                <div class="sources-list collapsed" id="${sourceId}">
                    ${sources.map(s => `<div>• ${s}</div>`).join('')}
                </div>
            </div>
        `;
    }

    messageDiv.innerHTML = html;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // 履歴に保存
    saveMessageToHistory(sender, text, type, sources);
}

// 参照元の開閉
function toggleSources(sourceId) {
    const sourcesList = document.getElementById(sourceId);
    const toggle = document.getElementById(sourceId + '-toggle');

    if (sourcesList && toggle) {
        sourcesList.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
    }
}

// Enter キーで送信
function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendQuestion();
    }
}

// 初期化実行
init();

// 定期的にヘルスチェック
setInterval(checkHealth, 30000);
