// 現在のホスト名とポートを使用（別PCからのアクセスに対応）
// 開発時: http://localhost:8000
// 別PCから: http://[サーバーのIPアドレス]:8000
const API_BASE_URL = window.location.origin;

// チャット履歴管理
let chatHistory = [];
let currentChatId = null;

// 性能設定
let performanceSettings = {
    // 主要パラメータ
    temperature: 0.3,
    documentCount: 10,  // 検索精度向上のため10件に増加
    searchMultiplier: 10,  // 検索範囲倍率（documentCount × searchMultiplier = 実際の検索件数）
    useHybridSearch: true,  // ハイブリッド検索（BM25 + ベクトル）
    topP: 0.9,
    repeatPenalty: 1.1,
    numPredict: null,  // -1 = 無制限
    // 詳細パラメータ
    topK: null,
    numCtx: null,
    seed: null,
    mirostat: null,
    mirostatTau: null,
    mirostatEta: null,
    tfsZ: null
};

// カスタムプリセット
let customPresets = {};

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
    console.log('[DEBUG] renderChatHistory called, currentChatId:', currentChatId, 'chatHistory.length:', chatHistory.length);
    const historyDiv = document.getElementById('chatHistory');
    if (chatHistory.length === 0) {
        historyDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #999; font-size: 0.85rem;">履歴がありません</div>';
        return;
    }

    historyDiv.innerHTML = chatHistory.map(chat => `
        <div class="history-item ${chat.id === currentChatId ? 'active' : ''}" data-chat-id="${chat.id}">
            <div class="history-item-content">
                <div class="history-item-title" title="ダブルクリックで編集">${escapeHtml(chat.title)}</div>
                <div class="history-item-date">${new Date(chat.date).toLocaleString('ja-JP', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</div>
            </div>
            <button class="history-item-delete" title="削除">×</button>
        </div>
    `).reverse().join('');

    // イベントリスナーを設定
    setupHistoryEventListeners();
    console.log('[DEBUG] renderChatHistory completed');
}

// 履歴項目のイベントリスナーを設定
function setupHistoryEventListeners() {
    const historyItems = document.querySelectorAll('.history-item');

    historyItems.forEach(item => {
        const chatId = item.dataset.chatId;
        const content = item.querySelector('.history-item-content');
        const title = item.querySelector('.history-item-title');
        const deleteBtn = item.querySelector('.history-item-delete');

        // クリックでチャットを読み込む
        content.addEventListener('click', (e) => {
            // 編集中の入力フィールドがクリックされた場合は無視
            if (e.target.tagName === 'INPUT') return;
            loadChat(chatId);
        });

        // ダブルクリックでタイトル編集
        title.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            editChatTitle(chatId);
        });

        // 削除ボタン
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chatId);
        });
    });
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// チャットタイトルを編集
function editChatTitle(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;

    // タイトル要素を探す
    const historyItem = document.querySelector(`.history-item[data-chat-id="${chatId}"]`);
    if (!historyItem) return;

    const titleElement = historyItem.querySelector('.history-item-title');
    if (!titleElement) return;

    const currentTitle = chat.title;

    // 入力フィールドを作成
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'history-item-title-input';

    // 入力フィールドに置き換え
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    // 保存処理
    const saveTitle = () => {
        const newTitle = input.value.trim();

        if (newTitle && newTitle !== currentTitle) {
            chat.title = newTitle;
            saveChatHistory();
        }

        renderChatHistory();
    };

    // Enterキーで保存
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveTitle();
        } else if (e.key === 'Escape') {
            renderChatHistory(); // キャンセル
        }
    });

    // フォーカスが外れたら保存
    input.addEventListener('blur', saveTitle);

    // クリックイベントの伝播を防ぐ
    input.addEventListener('click', (e) => e.stopPropagation());
}

// 個別のチャットを削除
function deleteChat(chatId) {
    if (!confirm('このチャットを削除しますか？')) {
        return;
    }

    // 履歴から削除
    chatHistory = chatHistory.filter(chat => chat.id !== chatId);

    // 削除したチャットが現在表示中の場合、新規チャットを作成
    if (currentChatId === chatId) {
        createNewChat();
    } else {
        saveChatHistory();
        renderChatHistory();
    }
}

// 全ての履歴を削除
function clearAllHistory() {
    if (chatHistory.length === 0) {
        alert('削除する履歴がありません。');
        return;
    }

    if (!confirm(`全ての履歴（${chatHistory.length}件）を削除しますか？\nこの操作は取り消せません。`)) {
        return;
    }

    chatHistory = [];
    localStorage.removeItem('chatHistory');
    createNewChat(); // 新規チャットを作成
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
    messagesDiv.innerHTML = chat.messages.map((msg, index) => {
        let html = `
            <div class="message ${msg.type}">
                <div class="message-header">${msg.sender}</div>
                <div>${msg.text}</div>
        `;

        if (msg.sources && msg.sources.length > 0) {
            const sourceId = `sources-${chatId}-${index}`;

            // スコア情報がある場合はスコアバー付きで表示
            let sourcesHTML = '';
            if (msg.sourceScores && msg.sourceScores.length > 0) {
                const sortedScores = [...msg.sourceScores].sort((a, b) => b.score - a.score);
                sourcesHTML = sortedScores.map(item => `
                    <div style="margin-bottom: 10px; padding: 8px; background: #fafafa; border-radius: 4px;">
                        <div style="font-size: 0.85rem; color: #333;">• ${escapeHtml(item.source)}</div>
                        ${createScoreBar(item.score)}
                    </div>
                `).join('');
            } else {
                sourcesHTML = msg.sources.map(s => `<div>• ${escapeHtml(s)}</div>`).join('');
            }

            html += `
                <div class="sources">
                    <div class="sources-title" data-source-id="${sourceId}">
                        <span class="sources-toggle collapsed" id="${sourceId}-toggle">▼</span>
                        参照元 (${msg.sources.length}件)
                        ${msg.sourceScores && msg.sourceScores.length > 0 ? '<span style="font-size: 0.75rem; color: #999; margin-left: 8px;">関連度スコア付き</span>' : ''}
                    </div>
                    <div class="sources-list collapsed" id="${sourceId}">
                        ${sourcesHTML}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        return html;
    }).join('');

    // イベントハンドラを設定
    document.querySelectorAll('.sources-title').forEach(titleElement => {
        titleElement.addEventListener('click', function() {
            const sourceId = this.getAttribute('data-source-id');
            toggleSources(sourceId);
        });
    });

    renderChatHistory();
}

// 現在のチャットにメッセージを保存
function saveMessageToHistory(sender, text, type, sources = null, sourceScores = null) {
    if (!currentChatId) {
        console.error('[DEBUG] saveMessageToHistory called without currentChatId');
        return;
    }

    const chat = chatHistory.find(c => c.id === currentChatId);
    if (!chat) {
        console.error('[DEBUG] Chat not found for currentChatId:', currentChatId);
        return;
    }

    chat.messages.push({ sender, text, type, sources, sourceScores });

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

    // 履歴がある場合は最後のチャットを開く、ない場合は新規作成
    if (chatHistory.length > 0) {
        const lastChat = chatHistory[chatHistory.length - 1];
        loadChat(lastChat.id);
    } else {
        createNewChat();
    }

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
        const countElement = document.getElementById('documentCount');

        // 件数を更新
        countElement.textContent = `(${data.documents.length}件)`;

        if (data.documents.length === 0) {
            listElement.innerHTML = '<li style="text-align: center; color: #999;">ドキュメントなし</li>';
        } else {
            listElement.innerHTML = data.documents
                .map(doc => `
                    <li class="document-item" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${doc}</span>
                        <button onclick="deleteDocument('${doc}')" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem;">削除</button>
                    </li>
                `)
                .join('');
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

// 特定のドキュメントを削除
async function deleteDocument(filename) {
    if (!confirm(`「${filename}」を削除しますか？`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert(`${filename} を削除しました`);
            loadDocuments(); // リストを再読み込み
        } else {
            const error = await response.json();
            alert(`削除に失敗しました: ${error.detail}`);
        }
    } catch (error) {
        console.error('Error deleting document:', error);
        alert('削除中にエラーが発生しました');
    }
}

// モデル一覧の読み込み
async function loadModels() {
    const modelCountDiv = document.getElementById('modelCount');
    try {
        modelCountDiv.innerHTML = '読み込み中...';

        const response = await fetch(`${API_BASE_URL}/models`);
        const data = await response.json();

        // モデルセレクトボックスを更新
        const selectElementSettings = document.getElementById('modelSelectSettings');

        // 現在選択されているモデルを保存
        const currentValue = selectElementSettings.value;

        // デフォルトモデル名を取得（バックエンドから返される）
        const defaultModelName = data.default_model || 'llama3.2';

        // モデルオプションHTMLを構築
        let optionsHTML = `<option value="">デフォルト (${defaultModelName})</option>`;

        // 取得したモデルを追加
        if (data.models && data.models.length > 0) {
            // モデルを名前順にソート
            const sortedModels = data.models.sort();

            sortedModels.forEach(model => {
                optionsHTML += `<option value="${model}">${model}</option>`;
            });

            // セレクトボックスを更新
            selectElementSettings.innerHTML = optionsHTML;

            // 以前の選択を復元
            if (currentValue) {
                selectElementSettings.value = currentValue;
            }

            modelCountDiv.innerHTML = `✓ ${data.models.length} 個のモデルが利用可能`;
            modelCountDiv.style.color = '#155724';
        } else {
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
    const modelSelect = document.getElementById('modelSelectSettings');
    const selectedModel = modelSelect.value;
    const ragToggle = document.getElementById('ragToggle');
    const useRag = ragToggle.checked;
    const queryExpansionToggle = document.getElementById('queryExpansionToggle');
    const queryExpansion = queryExpansionToggle.checked;

    if (!question) return;

    console.log('[DEBUG] sendQuestion started, currentChatId:', currentChatId);

    // 現在のチャットIDがない場合は新規チャットを作成
    if (!currentChatId) {
        createNewChat();
        console.log('[DEBUG] Created new chat, currentChatId:', currentChatId);
    }

    // ユーザーメッセージを追加（履歴保存は後でまとめて行う）
    addMessage('あなた', question, 'user', null, null, false);
    console.log('[DEBUG] Added user message to DOM (not saved to history yet)');
    input.value = '';

    // 入力フィールドを無効化
    input.disabled = true;
    input.placeholder = '回答を生成中...';

    // ストリーミング用のメッセージを追加（ローディング表示付き）
    const messageId = 'streaming-' + Date.now();
    console.log('[DEBUG] Creating streaming message with ID:', messageId);
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-header">アシスタント</div>
        <div class="streaming-content">
            <div class="loading-spinner" style="display: inline-block; margin-right: 8px;"></div>
            回答を生成中...
        </div>
    `;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    console.log('[DEBUG] Streaming message created and appended, children count:', messagesDiv.children.length);

    try {
        // 現在のチャットから会話履歴を構築（最新10件のみ）
        const currentChat = chatHistory.find(chat => chat.id === currentChatId);
        const chatHistoryMessages = [];
        if (currentChat && currentChat.messages) {
            // 最新10件のメッセージを取得（今回の質問は除く）
            const recentMessages = currentChat.messages.slice(-20); // 10往復分
            for (const msg of recentMessages) {
                // メッセージ形式を { role, content } に変換
                const role = msg.type === 'user' ? 'user' : 'assistant';
                const content = msg.text;
                chatHistoryMessages.push({
                    role: role,
                    content: content
                });
            }
        }

        const requestBody = {
            question,
            use_rag: useRag,
            query_expansion: queryExpansion,
            use_hybrid_search: performanceSettings.useHybridSearch,
            chat_history: chatHistoryMessages, // 会話履歴を追加
            // 主要パラメータ
            temperature: performanceSettings.temperature,
            document_count: performanceSettings.documentCount,
            search_multiplier: performanceSettings.searchMultiplier,
            top_p: performanceSettings.topP,
            repeat_penalty: performanceSettings.repeatPenalty,
            num_predict: performanceSettings.numPredict,
            // 詳細パラメータ
            top_k: performanceSettings.topK,
            num_ctx: performanceSettings.numCtx,
            seed: performanceSettings.seed,
            mirostat: performanceSettings.mirostat,
            mirostat_tau: performanceSettings.mirostatTau,
            mirostat_eta: performanceSettings.mirostatEta,
            tfs_z: performanceSettings.tfsZ
        };

        // モデルが選択されている場合のみ追加
        if (selectedModel) {
            requestBody.model = selectedModel;
        }

        const response = await fetch(`${API_BASE_URL}/query/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error('ストリーミングエラー');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullAnswer = '';
        // 特定のメッセージIDでDIVを取得（確実に正しいDIVを参照）
        const specificMessageDiv = document.getElementById(messageId);
        if (!specificMessageDiv) {
            console.error('[DEBUG] Could not find message div with ID:', messageId);
            return;
        }
        const contentDiv = specificMessageDiv.querySelector('.streaming-content');
        let isFirstChunk = true;

        // 速度計測用の変数
        const requestStartTime = Date.now(); // 質問送信時刻
        let firstChunkTime = null; // 最初の文字受信時刻
        let charCount = 0;  // 文字数カウント（トークン数の近似値として使用）
        let speedDisplay = null;

        // 参照元情報を保存する変数
        let sourcesData = null;
        let sourceScores = null;

        console.log('[DEBUG] Starting to read streaming response');
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('[DEBUG] Streaming completed');
                break;
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const content = line.slice(6);

                    // 参照元情報をチェック（特別なマーカー）
                    if (content.includes('__SOURCES__:')) {
                        try {
                            const jsonStr = content.split('__SOURCES__:')[1];
                            const sourceInfo = JSON.parse(jsonStr);
                            sourcesData = sourceInfo.sources;
                            sourceScores = sourceInfo.source_scores;
                            // 参照元情報は回答に含めない
                            continue;
                        } catch (e) {
                            console.error('Failed to parse source info:', e);
                        }
                    }

                    // 最初のチャンクでローディング表示をクリアし、速度表示を追加
                    if (isFirstChunk && content) {
                        console.log('[DEBUG] First chunk received, clearing loading display');
                        contentDiv.innerHTML = '';

                        // 最初の文字を受信した時刻を記録
                        firstChunkTime = Date.now();
                        const responseTime = ((firstChunkTime - requestStartTime) / 1000).toFixed(1);

                        // 速度表示エリアを追加
                        speedDisplay = document.createElement('div');
                        speedDisplay.style.cssText = 'font-size: 0.75rem; color: #999; margin-bottom: 8px; padding: 4px 8px; background: #f0f0f0; border-radius: 4px; display: inline-block;';
                        speedDisplay.textContent = `応答時間: ${responseTime}秒 | 生成中...`;
                        contentDiv.appendChild(speedDisplay);

                        const textContent = document.createElement('div');
                        textContent.id = 'streamingText-' + messageId;  // ユニークなIDを使用
                        contentDiv.appendChild(textContent);

                        isFirstChunk = false;
                        console.log('[DEBUG] First chunk processed, streaming UI ready');
                    }

                    // 文字数をカウント（実際の生成されたテキスト量）
                    if (content.length > 0) {
                        charCount += content.length;
                    }

                    fullAnswer += content;

                    // 特定のメッセージのテキストエリアを取得
                    const textElement = specificMessageDiv.querySelector('[id^="streamingText-"]');
                    if (textElement) {
                        // テキストを表示（カーソルアニメーション付き）
                        textElement.innerHTML = escapeHtml(fullAnswer) + '<span class="streaming-cursor">▊</span>';
                        // 即座にスクロール
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    }

                    // 速度を更新（リアルタイム）
                    if (firstChunkTime && speedDisplay && charCount > 0) {
                        const responseTime = ((firstChunkTime - requestStartTime) / 1000).toFixed(1);
                        const generationTime = ((Date.now() - firstChunkTime) / 1000).toFixed(1);
                        const speed = (charCount / parseFloat(generationTime)).toFixed(1);
                        speedDisplay.textContent = `応答時間: ${responseTime}秒 | 生成中: ${generationTime}秒 (${speed} 文字/秒)`;
                    }

                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
            }
        }

        // カーソルを削除して最終テキストを表示
        const textElement = specificMessageDiv.querySelector('[id^="streamingText-"]');
        if (textElement) {
            textElement.innerHTML = escapeHtml(fullAnswer);
        }

        // 最終速度を表示
        if (firstChunkTime && speedDisplay && charCount > 0) {
            const responseTime = ((firstChunkTime - requestStartTime) / 1000).toFixed(1);
            const generationTime = ((Date.now() - firstChunkTime) / 1000).toFixed(1);
            const avgSpeed = (charCount / parseFloat(generationTime)).toFixed(1);
            speedDisplay.textContent = `✓ 完了: 応答時間: ${responseTime}秒 | 生成時間: ${generationTime}秒 | 速度: ${avgSpeed} 文字/秒`;
            speedDisplay.style.background = '#e8f5e9';
            speedDisplay.style.color = '#2e7d32';
        }

        // 参照元を表示
        if (sourcesData && sourcesData.length > 0) {
            const sourcesDiv = document.createElement('div');
            sourcesDiv.className = 'sources';
            sourcesDiv.style.marginTop = '12px';

            const sourcesHeader = document.createElement('div');
            sourcesHeader.style.cssText = 'font-size: 0.85rem; color: #666; margin-bottom: 8px; cursor: pointer; user-select: none; display: flex; align-items: center; gap: 6px;';
            sourcesHeader.innerHTML = '<span class="source-toggle">▼</span> <strong>参照元:</strong>';

            const sourcesList = document.createElement('div');
            sourcesList.className = 'sources-list';
            sourcesList.style.display = 'block';

            // スコア情報付きで表示
            if (sourceScores && sourceScores.length > 0) {
                sourceScores.forEach(item => {
                    const sourceItem = document.createElement('div');
                    sourceItem.style.cssText = 'font-size: 0.8rem; color: #555; margin: 4px 0;';
                    sourceItem.innerHTML = `• ${item.source}${createScoreBar(item.score)}`;
                    sourcesList.appendChild(sourceItem);
                });
            } else {
                // スコアなしの場合
                sourcesData.forEach(source => {
                    const sourceItem = document.createElement('div');
                    sourceItem.style.cssText = 'font-size: 0.8rem; color: #555; margin: 4px 0;';
                    sourceItem.textContent = `• ${source}`;
                    sourcesList.appendChild(sourceItem);
                });
            }

            sourcesDiv.appendChild(sourcesHeader);
            sourcesDiv.appendChild(sourcesList);
            contentDiv.appendChild(sourcesDiv);

            // クリックで折りたたみ
            sourcesHeader.addEventListener('click', () => {
                const isVisible = sourcesList.style.display !== 'none';
                sourcesList.style.display = isVisible ? 'none' : 'block';
                sourcesHeader.querySelector('.source-toggle').textContent = isVisible ? '▶' : '▼';
            });
        }

        // 履歴に保存（ユーザーメッセージとアシスタントメッセージの両方）
        console.log('[DEBUG] Saving messages to history, question:', question, 'currentChatId:', currentChatId);
        console.log('[DEBUG] Chat messages div children count before save:', document.getElementById('chatMessages').children.length);
        saveMessageToHistory('あなた', question, 'user');
        saveMessageToHistory('アシスタント', fullAnswer, 'assistant', sourcesData, sourceScores);
        console.log('[DEBUG] Messages saved to history');
        console.log('[DEBUG] Chat messages div children count after save:', document.getElementById('chatMessages').children.length);

    } catch (error) {
        console.error('Error:', error);
        const errorMessageDiv = document.getElementById(messageId);
        if (errorMessageDiv) {
            const contentDiv = errorMessageDiv.querySelector('.streaming-content');
            if (contentDiv) {
                contentDiv.textContent = `エラー: ${error.message}`;
            }
        }
    } finally {
        // 入力フィールドを再び有効化
        input.disabled = false;
        input.placeholder = '質問を入力してください...';
        input.focus();
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

// スコアに応じた色を取得
function getScoreColor(score) {
    if (score >= 0.8) return '#4caf50'; // 緑: 高関連度
    if (score >= 0.5) return '#ff9800'; // オレンジ: 中関連度
    return '#f44336'; // 赤: 低関連度
}

// スコアバーのHTMLを生成
function createScoreBar(score) {
    const percentage = Math.round(score * 100);
    const color = getScoreColor(score);
    return `
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <div style="flex: 1; height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden;">
                <div style="width: ${percentage}%; height: 100%; background: ${color}; transition: width 0.3s;"></div>
            </div>
            <span style="font-size: 0.75rem; color: ${color}; font-weight: 600; min-width: 45px;">${percentage}%</span>
        </div>
    `;
}

// メッセージ追加
function addMessage(sender, text, type = 'assistant', sources = null, sourceScores = null, saveToHistory = true) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    let className = 'message';
    if (type === 'user') className += ' user';
    else if (type === 'assistant') className += ' assistant';

    messageDiv.className = className;

    let html = `<div class="message-header">${sender}</div><div>${text}</div>`;

    if (sources && sources.length > 0) {
        const sourceId = 'sources-' + Date.now();

        // スコア情報がある場合はスコアバー付きで表示
        let sourcesHTML = '';
        if (sourceScores && sourceScores.length > 0) {
            // スコア順にソート（高い順）
            const sortedScores = [...sourceScores].sort((a, b) => b.score - a.score);
            sourcesHTML = sortedScores.map(item => `
                <div style="margin-bottom: 10px; padding: 8px; background: #fafafa; border-radius: 4px;">
                    <div style="font-size: 0.85rem; color: #333;">• ${escapeHtml(item.source)}</div>
                    ${createScoreBar(item.score)}
                </div>
            `).join('');
        } else {
            // スコア情報がない場合は従来通りシンプル表示
            sourcesHTML = sources.map(s => `<div>• ${escapeHtml(s)}</div>`).join('');
        }

        html += `
            <div class="sources">
                <div class="sources-title" data-source-id="${sourceId}">
                    <span class="sources-toggle collapsed" id="${sourceId}-toggle">▼</span>
                    参照元 (${sources.length}件)
                    ${sourceScores && sourceScores.length > 0 ? '<span style="font-size: 0.75rem; color: #999; margin-left: 8px;">関連度スコア付き</span>' : ''}
                </div>
                <div class="sources-list collapsed" id="${sourceId}">
                    ${sourcesHTML}
                </div>
            </div>
        `;
    }

    messageDiv.innerHTML = html;
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // イベントハンドラを設定（参照元がある場合）
    if (sources && sources.length > 0) {
        const titleElement = messageDiv.querySelector('.sources-title');
        if (titleElement) {
            titleElement.addEventListener('click', function() {
                const sourceId = this.getAttribute('data-source-id');
                toggleSources(sourceId);
            });
        }
    }

    // 履歴に保存（フラグがtrueの場合のみ）
    if (saveToHistory) {
        saveMessageToHistory(sender, text, type, sources, sourceScores);
    }
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

// 性能プリセットの適用
function applyPerformancePreset() {
    const preset = document.getElementById('performancePreset').value;
    const descDiv = document.getElementById('presetDescription');

    let description = '';

    switch(preset) {
        case 'speed':
            performanceSettings.temperature = 0.1;
            performanceSettings.documentCount = 3;
            performanceSettings.topP = 0.7;
            performanceSettings.repeatPenalty = 1.2;
            description = '🚀 最速モード: 低temperature、少ないドキュメント検索で高速化';
            break;
        case 'balanced':
            performanceSettings.temperature = 0.3;
            performanceSettings.documentCount = 5;
            performanceSettings.topP = 0.9;
            performanceSettings.repeatPenalty = 1.1;
            description = '⚖️ バランスモード: 速度と精度のバランスが取れた設定（推奨）';
            break;
        case 'quality':
            performanceSettings.temperature = 0.5;
            performanceSettings.documentCount = 8;
            performanceSettings.topP = 0.95;
            performanceSettings.repeatPenalty = 1.0;
            description = '🎯 高精度モード: より多くのドキュメントを参照、詳細な回答を生成';
            break;
        case 'custom':
            description = '🔧 カスタムモード: 下記パラメータで自由に調整できます';
            break;
    }

    descDiv.textContent = description;

    // スライダーの値も更新
    if (preset !== 'custom') {
        document.getElementById('temperatureSlider').value = performanceSettings.temperature;
        document.getElementById('docsSlider').value = performanceSettings.documentCount;
        document.getElementById('topPSlider').value = performanceSettings.topP;
        document.getElementById('repeatPenaltySlider').value = performanceSettings.repeatPenalty;

        document.getElementById('tempValue').textContent = performanceSettings.temperature;
        document.getElementById('docsValue').textContent = performanceSettings.documentCount;
        document.getElementById('topPValue').textContent = performanceSettings.topP;
        document.getElementById('repeatPenaltyValue').textContent = performanceSettings.repeatPenalty;
    }

    // LocalStorageに保存
    localStorage.setItem('performancePreset', preset);
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Temperature更新
function updateTemperature(value) {
    performanceSettings.temperature = parseFloat(value);
    document.getElementById('tempValue').textContent = value;
    document.getElementById('performancePreset').value = 'custom';
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// ドキュメント数更新
function updateDocs(value) {
    performanceSettings.documentCount = parseInt(value);
    document.getElementById('docsValue').textContent = value;
    document.getElementById('performancePreset').value = 'custom';
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// 検索範囲倍率更新
function updateSearchMultiplier(value) {
    performanceSettings.searchMultiplier = parseInt(value);
    document.getElementById('searchMultiplierValue').textContent = value + '倍';
    document.getElementById('performancePreset').value = 'custom';
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// ハイブリッド検索ON/OFF更新
function updateHybridSearch(checked) {
    performanceSettings.useHybridSearch = checked;
    document.getElementById('performancePreset').value = 'custom';
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Top-P更新
function updateTopP(value) {
    performanceSettings.topP = parseFloat(value);
    document.getElementById('topPValue').textContent = value;
    document.getElementById('performancePreset').value = 'custom';
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Repeat Penalty更新
function updateRepeatPenalty(value) {
    performanceSettings.repeatPenalty = parseFloat(value);
    document.getElementById('repeatPenaltyValue').textContent = value;
    document.getElementById('performancePreset').value = 'custom';
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Num Predict更新
function updateNumPredict(value) {
    performanceSettings.numPredict = value === "-1" ? null : parseInt(value);
    document.getElementById('numPredictValue').textContent = value === "-1" ? "-1 (無制限)" : value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Top-K更新
function updateTopK(value) {
    performanceSettings.topK = parseInt(value);
    document.getElementById('topKValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Num Ctx更新
function updateNumCtx(value) {
    performanceSettings.numCtx = parseInt(value);
    document.getElementById('numCtxValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Seed更新
function updateSeed(value) {
    performanceSettings.seed = value === "" ? null : parseInt(value);
    document.getElementById('seedValue').textContent = value === "" ? "ランダム" : value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Mirostat更新
function updateMirostat(value) {
    const intValue = parseInt(value);
    performanceSettings.mirostat = intValue === 0 ? null : intValue;
    const labels = { "0": "無効 (0)", "1": "Mirostat 1.0", "2": "Mirostat 2.0" };
    document.getElementById('mirostatValue').textContent = labels[value] || value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Mirostat Tau更新
function updateMirostatTau(value) {
    performanceSettings.mirostatTau = parseFloat(value);
    document.getElementById('mirostatTauValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// Mirostat Eta更新
function updateMirostatEta(value) {
    performanceSettings.mirostatEta = parseFloat(value);
    document.getElementById('mirostatEtaValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// TFS-Z更新
function updateTfsZ(value) {
    performanceSettings.tfsZ = parseFloat(value);
    document.getElementById('tfsZValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

// カスタムプリセットを保存
function saveCustomPreset() {
    const nameInput = document.getElementById('customPresetName');
    const name = nameInput.value.trim();

    if (!name) {
        alert('プリセット名を入力してください');
        return;
    }

    // 現在の設定を保存
    customPresets[name] = { ...performanceSettings };
    localStorage.setItem('customPresets', JSON.stringify(customPresets));

    nameInput.value = '';
    renderCustomPresets();
    showNotification(`プリセット "${name}" を保存しました`, 'success');
}

// カスタムプリセットを読み込み
function loadCustomPreset(name) {
    if (customPresets[name]) {
        performanceSettings = { ...customPresets[name] };

        // UIを更新
        updateAllParameterUI();

        // プリセット選択をカスタムに変更
        document.getElementById('performancePreset').value = 'custom';
        document.getElementById('presetDescription').textContent = `🔧 カスタムプリセット: ${name}`;

        localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
        showNotification(`プリセット "${name}" を読み込みました`, 'success');
    }
}

// カスタムプリセットを削除
function deleteCustomPreset(name) {
    if (confirm(`プリセット "${name}" を削除しますか？`)) {
        delete customPresets[name];
        localStorage.setItem('customPresets', JSON.stringify(customPresets));
        renderCustomPresets();
        showNotification(`プリセット "${name}" を削除しました`, 'success');
    }
}

// カスタムプリセット一覧を表示
function renderCustomPresets() {
    const container = document.getElementById('customPresetsContainer');
    const listDiv = document.getElementById('customPresetsList');

    const presetNames = Object.keys(customPresets);

    if (presetNames.length === 0) {
        listDiv.style.display = 'none';
        return;
    }

    listDiv.style.display = 'block';
    container.innerHTML = presetNames.map(name => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px; background: #f8f9fa; border-radius: 5px; margin-bottom: 6px;">
            <span style="flex: 1; font-size: 0.9rem; color: #333;">📌 ${escapeHtml(name)}</span>
            <button onclick="loadCustomPreset('${escapeHtml(name)}')"
                    style="padding: 4px 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                読込
            </button>
            <button onclick="deleteCustomPreset('${escapeHtml(name)}')"
                    style="padding: 4px 10px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                削除
            </button>
        </div>
    `).join('');
}

// 全パラメータのUIを更新
function updateAllParameterUI() {
    document.getElementById('temperatureSlider').value = performanceSettings.temperature;
    document.getElementById('docsSlider').value = performanceSettings.documentCount;
    document.getElementById('topPSlider').value = performanceSettings.topP;
    document.getElementById('repeatPenaltySlider').value = performanceSettings.repeatPenalty;

    document.getElementById('tempValue').textContent = performanceSettings.temperature;
    document.getElementById('docsValue').textContent = performanceSettings.documentCount;
    document.getElementById('topPValue').textContent = performanceSettings.topP;
    document.getElementById('repeatPenaltyValue').textContent = performanceSettings.repeatPenalty;

    // 詳細パラメータ
    if (performanceSettings.numPredict !== null) {
        document.getElementById('numPredictSlider').value = performanceSettings.numPredict;
        document.getElementById('numPredictValue').textContent = performanceSettings.numPredict === -1 ? '-1 (無制限)' : performanceSettings.numPredict;
    }

    if (performanceSettings.topK !== null) {
        document.getElementById('topKSlider').value = performanceSettings.topK;
        document.getElementById('topKValue').textContent = performanceSettings.topK;
    }

    if (performanceSettings.numCtx !== null) {
        document.getElementById('numCtxSlider').value = performanceSettings.numCtx;
        document.getElementById('numCtxValue').textContent = performanceSettings.numCtx;
    }

    if (performanceSettings.seed !== null) {
        document.getElementById('seedInput').value = performanceSettings.seed;
        document.getElementById('seedValue').textContent = performanceSettings.seed;
    }

    if (performanceSettings.mirostat !== null) {
        document.getElementById('mirostatSelect').value = performanceSettings.mirostat;
        const labels = { 0: "無効 (0)", 1: "Mirostat 1.0", 2: "Mirostat 2.0" };
        document.getElementById('mirostatValue').textContent = labels[performanceSettings.mirostat];
    }

    if (performanceSettings.mirostatTau !== null) {
        document.getElementById('mirostatTauSlider').value = performanceSettings.mirostatTau;
        document.getElementById('mirostatTauValue').textContent = performanceSettings.mirostatTau;
    }

    if (performanceSettings.mirostatEta !== null) {
        document.getElementById('mirostatEtaSlider').value = performanceSettings.mirostatEta;
        document.getElementById('mirostatEtaValue').textContent = performanceSettings.mirostatEta;
    }

    if (performanceSettings.tfsZ !== null) {
        document.getElementById('tfsZSlider').value = performanceSettings.tfsZ;
        document.getElementById('tfsZValue').textContent = performanceSettings.tfsZ;
    }
}

// 設定の読み込み
function loadPerformanceSettings() {
    const savedPreset = localStorage.getItem('performancePreset');
    const savedSettings = localStorage.getItem('performanceSettings');
    const savedCustomPresets = localStorage.getItem('customPresets');

    if (savedSettings) {
        performanceSettings = JSON.parse(savedSettings);
    }

    if (savedCustomPresets) {
        customPresets = JSON.parse(savedCustomPresets);
        renderCustomPresets();
    }

    if (savedPreset) {
        document.getElementById('performancePreset').value = savedPreset;
        applyPerformancePreset();
    }
}

// 初期化実行
init();
loadPerformanceSettings();

// 定期的にヘルスチェック
setInterval(checkHealth, 30000);

// モバイルサイドバートグル機能
function initMobileSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const newChatBtn = document.querySelector('.btn-new-chat');

    if (!sidebar || !newChatBtn) return;

    // モバイルかどうかをチェック
    function isMobile() {
        return window.innerWidth <= 768;
    }

    // 新規チャットボタンをトグルボタンとしても機能させる
    newChatBtn.addEventListener('click', (e) => {
        if (isMobile()) {
            // サイドバーがすでに展開されている場合は新規チャットを作成
            if (sidebar.classList.contains('expanded')) {
                // 既存の新規チャット機能を実行
                createNewChat();
                // サイドバーを閉じる
                setTimeout(() => {
                    sidebar.classList.remove('expanded');
                }, 100);
            } else {
                // サイドバーを展開
                sidebar.classList.add('expanded');
                e.preventDefault(); // デフォルトの新規チャット作成を防ぐ
            }
        }
        // デスクトップでは通常通り新規チャット作成
    });

    // 履歴アイテムをクリックしたらサイドバーを閉じる
    document.addEventListener('click', (e) => {
        if (!isMobile()) return;

        const historyItem = e.target.closest('.history-item');
        if (historyItem && sidebar.classList.contains('expanded')) {
            setTimeout(() => {
                sidebar.classList.remove('expanded');
            }, 200);
        }
    });

    // 画面サイズが変更されたらクラスをリセット
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            sidebar.classList.remove('expanded');
        }
    });
}

// モバイルサイドバートグルを初期化
initMobileSidebarToggle();
