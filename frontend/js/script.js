// 現在のホスト名とポートを使用（別PCからのアクセスに対応）
// 開発時: http://localhost:8000
// 別PCから: http://[サーバーのIPアドレス]:8000
const API_BASE_URL = window.location.origin;

// チャット履歴管理
let chatHistory = [];
let currentChatId = null;

// ストリーミング中断用
let currentAbortController = null;
let currentReader = null;  // 追加: reader への参照を保持
let isGenerating = false;
let shouldStopGeneration = false;  // 停止フラグ

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
    tfsZ: null,
    // 追加の詳細パラメータ
    minP: null,
    presencePenalty: null,
    frequencyPenalty: null,
    repeatLastN: null,
    typicalP: null,
    numThread: null,
    numGpu: null,
    penalizeNewline: null,
    // キャラクター設定
    characterPreset: '',
    customCharacterPrompt: ''
};

// キャラクタープリセット定義
const characterPresets = {
    samurai: "あなたは江戸時代の侍です。古風で格調高い言葉遣いを使い、武士道の精神を重んじて回答してください。「～でござる」「～候」などの表現を使用してください。敬語を用いて、礼儀正しく接してください。",
    teacher: "あなたは優しく丁寧な学校の先生です。分かりやすい説明を心がけ、専門用語を使う際は必ず解説を加えてください。生徒の理解を第一に考え、励ましの言葉も交えながら回答してください。",
    gyaru: "あなたは明るく元気なギャルです。フレンドリーでカジュアルな口調で話してください。「～だよね」「マジで」「ヤバい」「超」などの若者言葉を使い、親しみやすく接してください。たまに「☆」「♪」などの記号も使ってOKです。",
    kansai: "あなたは関西人です。関西弁で親しみやすく話してください。「～やで」「～やん」「めっちゃ」「ほんま」「せやな」などの関西弁を積極的に使用してください。明るくて気さくな雰囲気で回答してください。",
    scientist: "あなたは論理的で知識豊富な科学者です。客観的な事実に基づき、科学的根拠を示しながら説明してください。専門用語も積極的に使用し、正確性を重視してください。仮説と事実を明確に区別して説明してください。",
    cat: "あなたは人間の言葉を話せる猫です。「にゃ」「にゃん」「にゃー」などの語尾を使い、猫らしい自由気ままな性格で回答してください。時々気まぐれで、甘えたり、ツンデレな態度を見せたりしてください。",
    moe: "あなたは可愛らしい萌え系キャラクターです。「～です♪」「～ですよ☆」「えへへ」「わぁ！」など、可愛らしい表現を使ってください。明るく元気で、少し天然な性格です。語尾に「♪」「☆」「♡」などの記号を使うこともあります。"
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

// 改行を含むテキストをHTMLに変換（回答表示用）
function formatAnswerText(text) {
    // HTMLエスケープ
    let escaped = escapeHtml(text);

    // 既存の改行を<br>に変換
    escaped = escaped.replace(/\n/g, '<br>');

    // 見出し風の処理: 「**」で囲まれた部分を太字にして前後に改行（先に処理）
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<br><strong>$1</strong><br>');

    // 箇条書きマーカーの変換（**を処理した後、残りの全ての*を●に変換）
    escaped = escaped.replace(/\*/g, '●');

    // 箇条書きの整形（自動改行より前に処理）
    // パターン: ● の後に <br> が続き、その後にテキストが来る場合、<br> を削除して同じ行にする
    // 例: ●<br>デザイン: → ● デザイン:
    escaped = escaped.replace(/●\s*<br>\s*/g, '● ');

    // 箇条書き項目の前に空行を入れる（見やすくするため）
    escaped = escaped.replace(/([^>])(<br>)?● /g, '$1<br><br>● ');

    // 連続する<br>を整理（3個以上→2個）
    escaped = escaped.replace(/(<br>){3,}/g, '<br><br>');

    // 自動改行: 句点の後に改行を挿入
    escaped = escaped.replace(/([。])([^\s）」』\d●<])/g, '$1<br>$2');

    return escaped;
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
    const characterName = getCharacterName();
    document.getElementById('chatMessages').innerHTML = `
        <div class="message assistant">
            <div class="message-header">${characterName}</div>
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
                <div>${formatAnswerText(msg.text)}</div>
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
            // タグ入力欄から値を取得
            const tagInput = document.getElementById('uploadTagInput');
            const tags = tagInput ? tagInput.value.trim() : '';
            await handleFileUpload(files, tags);
            // アップロード後、タグ入力欄をクリア
            if (tagInput) {
                tagInput.value = '';
            }
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
        // タグ情報付きのドキュメント詳細を取得
        const response = await fetch(`${API_BASE_URL}/documents/details`);
        const data = await response.json();
        const listElement = document.getElementById('documentList');
        const countElement = document.getElementById('documentCount');

        console.log('[DEBUG] Documents with tags:', data.documents);

        // 件数を更新
        countElement.textContent = `(${data.documents.length}件)`;

        if (data.documents.length === 0) {
            listElement.innerHTML = '<li style="text-align: center; color: #999;">ドキュメントなし</li>';
        } else {
            listElement.innerHTML = data.documents
                .map(doc => {
                    // タグの表示文字列を作成
                    let tagsHTML = '';
                    if (doc.tags && doc.tags.length > 0) {
                        tagsHTML = `<div style="margin-top: 4px; font-size: 0.75rem;">
                            ${doc.tags.map(tag => `<span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 3px; margin-right: 4px;">${tag}</span>`).join('')}
                        </div>`;
                    } else {
                        tagsHTML = `<div style="margin-top: 4px; font-size: 0.75rem; color: #999;">タグなし</div>`;
                    }

                    return `
                        <li class="document-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                            <div style="flex: 1;">
                                <div>${doc.filename}</div>
                                ${tagsHTML}
                            </div>
                            <button onclick="deleteDocument('${doc.filename}')" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8rem;">削除</button>
                        </li>
                    `;
                })
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
    const tagInput = document.getElementById('uploadTagInput');
    const files = fileInput.files;

    if (files.length === 0) return;

    const tags = tagInput.value.trim();
    await handleFileUpload(files, tags);
    fileInput.value = '';
    tagInput.value = '';  // タグ入力欄もクリア
}

// ファイルアップロード処理（共通）
async function handleFileUpload(files, tags = '') {
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

    // タグを追加
    if (tags) {
        formData.append('tags', tags);
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
            const tagMsg = data.tags && data.tags.length > 0 ? `\nタグ: ${data.tags.join(', ')}` : '';
            showNotification(`アップロード完了: ${data.files.join(', ')}${tagMsg}`, 'success');
            await loadDocuments();
            await loadTags();  // タグリストを再読み込み
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

    // 入力フィールドを無効化、ボタン切り替え
    input.disabled = true;
    input.placeholder = '回答を生成中...';
    document.getElementById('sendButton').style.display = 'none';
    document.getElementById('stopButton').style.display = 'inline-block';
    isGenerating = true;

    // AbortControllerを作成
    currentAbortController = new AbortController();

    // ストリーミング用のメッセージを追加（ローディング表示付き）
    const messageId = 'streaming-' + Date.now();
    console.log('[DEBUG] Creating streaming message with ID:', messageId);
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = 'message assistant';
    const characterName = getCharacterName();
    messageDiv.innerHTML = `
        <div class="message-header">${characterName}</div>
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
            tfs_z: performanceSettings.tfsZ,
            // 追加の詳細パラメータ
            min_p: performanceSettings.minP,
            presence_penalty: performanceSettings.presencePenalty,
            frequency_penalty: performanceSettings.frequencyPenalty,
            repeat_last_n: performanceSettings.repeatLastN,
            typical_p: performanceSettings.typicalP,
            num_thread: performanceSettings.numThread,
            num_gpu: performanceSettings.numGpu,
            penalize_newline: document.getElementById('penalizeNewlineToggle')?.checked || null
        };

        // モデルが選択されている場合のみ追加
        if (selectedModel) {
            requestBody.model = selectedModel;
        }

        // システムプロンプトを追加
        const systemPrompt = getSystemPrompt();
        console.log('[DEBUG] Character preset:', performanceSettings.characterPreset);
        console.log('[DEBUG] System prompt:', systemPrompt);
        if (systemPrompt) {
            requestBody.system_prompt = systemPrompt;
        }

        // タグフィルタを追加
        console.log('[DEBUG] selectedTags:', selectedTags);
        if (selectedTags && selectedTags.length > 0) {
            requestBody.tags = selectedTags;
            console.log('[DEBUG] Tag filter applied:', selectedTags);
        } else {
            console.log('[DEBUG] No tag filter (showing all documents)');
        }

        const response = await fetch(`${API_BASE_URL}/query/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: currentAbortController.signal
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

        // 品質スコア情報を保存する変数
        let qualityScore = 0;
        let documentCount = 0;
        let maxSimilarity = 0;

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

                            // 品質スコア情報を保存
                            qualityScore = sourceInfo.quality_score || 0;
                            documentCount = sourceInfo.document_count || 0;
                            maxSimilarity = sourceInfo.max_similarity || 0;

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
                        // テキストを表示（カーソルアニメーション付き、改行対応）
                        textElement.innerHTML = formatAnswerText(fullAnswer) + '<span class="streaming-cursor">▊</span>';
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

        // カーソルを削除して最終テキストを表示（改行対応）
        const textElement = specificMessageDiv.querySelector('[id^="streamingText-"]');
        if (textElement) {
            textElement.innerHTML = formatAnswerText(fullAnswer);
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

        // 品質スコアを表示（RAG使用時のみ）
        if (useRag && qualityScore > 0) {
            const qualityScoreDiv = document.createElement('div');
            qualityScoreDiv.style.cssText = 'margin-top: 10px; margin-bottom: 8px; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; font-size: 0.85rem; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);';

            // スコアに応じた星の数を計算（5段階）
            const stars = Math.round(qualityScore / 20);
            const starDisplay = '★'.repeat(stars) + '☆'.repeat(5 - stars);

            qualityScoreDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 1.2rem;">📊</span>
                        <strong>信頼度:</strong>
                        <span style="font-size: 1.1rem; letter-spacing: 2px;">${starDisplay}</span>
                        <span style="opacity: 0.9;">(${qualityScore}%)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; opacity: 0.9;">
                        <span>📄</span>
                        <span>${documentCount}件の文書から生成</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; opacity: 0.9;">
                        <span>🎯</span>
                        <span>最高類似度: ${(maxSimilarity * 100).toFixed(0)}%</span>
                    </div>
                </div>
            `;

            // 速度表示の後に挿入
            if (speedDisplay && speedDisplay.parentNode) {
                speedDisplay.parentNode.insertBefore(qualityScoreDiv, speedDisplay.nextSibling);
            } else {
                contentDiv.appendChild(qualityScoreDiv);
            }
        }

        // コピーボタンと再生成ボタンを追加
        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = 'margin-top: 8px; display: flex; gap: 8px;';
        actionButtons.innerHTML = `
            <button onclick="copyAnswer('${messageId}')" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
                📋 コピー
            </button>
            <button onclick="regenerateAnswer('${question.replace(/'/g, "\\'")}', '${messageId}')" style="padding: 6px 12px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
                🔄 再生成
            </button>
        `;
        specificMessageDiv.querySelector('.streaming-content') ?
            specificMessageDiv.querySelector('.streaming-content').parentNode.insertBefore(actionButtons, specificMessageDiv.querySelector('.streaming-content').nextSibling) :
            specificMessageDiv.appendChild(actionButtons);

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
                    sourceItem.style.cssText = 'font-size: 0.8rem; color: #555; margin: 4px 0; cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s;';
                    sourceItem.innerHTML = `• <span style="color: #667eea; text-decoration: underline;">${item.source}</span>${createScoreBar(item.score)}`;
                    sourceItem.onmouseover = () => sourceItem.style.background = '#f0f0ff';
                    sourceItem.onmouseout = () => sourceItem.style.background = 'transparent';
                    sourceItem.onclick = () => showDocumentPreview(item.source);
                    sourcesList.appendChild(sourceItem);
                });
            } else {
                // スコアなしの場合
                sourcesData.forEach(source => {
                    const sourceItem = document.createElement('div');
                    sourceItem.style.cssText = 'font-size: 0.8rem; color: #555; margin: 4px 0; cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s;';
                    sourceItem.innerHTML = `• <span style="color: #667eea; text-decoration: underline;">${source}</span>`;
                    sourceItem.onmouseover = () => sourceItem.style.background = '#f0f0ff';
                    sourceItem.onmouseout = () => sourceItem.style.background = 'transparent';
                    sourceItem.onclick = () => showDocumentPreview(source);
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

        // AbortErrorの場合は停止メッセージを表示（途中まで生成されたテキストは保持）
        if (error.name === 'AbortError') {
            console.log('[DEBUG] AbortError caught, stopping UI animations');
            const errorMessageDiv = document.getElementById(messageId);
            if (errorMessageDiv) {
                console.log('[DEBUG] Found error message div:', messageId);
                const streamingContent = errorMessageDiv.querySelector('.streaming-content');
                console.log('[DEBUG] streamingContent found:', !!streamingContent);

                // streaming-contentの中身を確認して、回答があれば保持
                if (streamingContent) {
                    // 既存のテキスト要素を探す
                    const textElement = streamingContent.querySelector('[id^="streamingText-"]');
                    const existingText = textElement ? textElement.textContent : '';

                    console.log('[DEBUG] Existing text length:', existingText.length);

                    // 停止メッセージを表示（既存のテキストを保持）
                    const speedDisplay = streamingContent.querySelector('.speed-display, [style*="font-size: 0.75rem"]');
                    if (speedDisplay) {
                        speedDisplay.innerHTML = '<span style="font-weight: bold; color: #ff9800;">⏹ 生成を停止しました</span>';
                        speedDisplay.style.background = '#fff3e0';
                    }

                    console.log('[DEBUG] Stop message displayed');
                }
            } else {
                console.log('[DEBUG] ERROR: errorMessageDiv not found for messageId:', messageId);
            }
        } else {
            const errorMessageDiv = document.getElementById(messageId);
            if (errorMessageDiv) {
                const contentDiv = errorMessageDiv.querySelector('.streaming-content');
                if (contentDiv) {
                    contentDiv.textContent = `エラー: ${error.message}`;
                }
            }
        }
    } finally {
        // ボタン状態を元に戻す
        document.getElementById('sendButton').style.display = 'inline-block';
        document.getElementById('stopButton').style.display = 'none';
        isGenerating = false;
        currentAbortController = null;

        // 入力フィールドを再び有効化
        input.disabled = false;
        input.placeholder = '質問を入力してください...';
        input.focus();
    }
}

// 生成停止
function stopGeneration() {
    if (currentAbortController && isGenerating) {
        currentAbortController.abort();
        console.log('[DEBUG] Generation stopped by user');
    }
}

// 回答をコピー
function copyAnswer(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;

    // テキストエリアを探す
    const textElement = messageDiv.querySelector('[id^="streamingText-"]');
    let answerText = '';

    if (textElement) {
        answerText = textElement.textContent;
    } else {
        // streaming-contentがない場合は、メッセージ全体からテキストを取得
        const contentDiv = messageDiv.querySelector('div[style*="white-space"]');
        if (contentDiv) {
            answerText = contentDiv.textContent;
        }
    }

    if (answerText) {
        navigator.clipboard.writeText(answerText).then(() => {
            // コピー成功のフィードバック
            const button = event.target.closest('button');
            const originalText = button.innerHTML;
            button.innerHTML = '✓ コピー完了';
            button.style.background = '#4caf50';
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = '#667eea';
            }, 2000);
        }).catch(err => {
            console.error('コピー失敗:', err);
            alert('コピーに失敗しました');
        });
    }
}

// 回答を再生成
async function regenerateAnswer(question, oldMessageId) {
    // 古い回答メッセージを削除
    const oldMessage = document.getElementById(oldMessageId);
    if (oldMessage) {
        oldMessage.remove();
    }

    // 会話履歴から質問と回答のペアを削除
    const currentChat = chatHistory.find(chat => chat.id === currentChatId);
    if (currentChat && currentChat.messages.length >= 2) {
        // 最後の2つのメッセージ（質問と回答）を削除
        const lastMsg = currentChat.messages[currentChat.messages.length - 1];
        const secondLastMsg = currentChat.messages[currentChat.messages.length - 2];

        if (lastMsg.type === 'assistant' && secondLastMsg.type === 'user') {
            currentChat.messages.pop(); // 回答を削除
            currentChat.messages.pop(); // 質問を削除
        }
    }

    // 質問メッセージも削除（DOMから）
    const messagesDiv = document.getElementById('chatMessages');
    const allMessages = messagesDiv.querySelectorAll('.message');
    for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        // 質問メッセージを見つけて削除
        if (msg.querySelector('.message-header')?.textContent.includes('あなた')) {
            const msgContent = msg.querySelector('div[style*="white-space"]')?.textContent;
            if (msgContent && msgContent.trim() === question.trim()) {
                msg.remove();
                break;
            }
        }
    }

    // 質問を入力フィールドに設定して再送信
    const input = document.getElementById('questionInput');
    input.value = question;
    await sendQuestion();
}

// ドキュメントプレビューを表示
async function showDocumentPreview(sourceInfo) {
    // ファイル名とページ番号を抽出
    let filename = sourceInfo;
    let pageNum = null;

    // "filename (Page X)" 形式の場合、ファイル名とページ番号を分離
    const pageMatch = sourceInfo.match(/^(.+?)\s*\(Page\s+(\d+)\)$/);
    if (pageMatch) {
        filename = pageMatch[1];
        pageNum = parseInt(pageMatch[2]);
    }

    const modal = document.getElementById('documentPreviewModal');
    const titleElement = document.getElementById('previewTitle');
    const contentElement = document.getElementById('previewContent');

    // モーダルを表示
    modal.style.display = 'flex';
    titleElement.textContent = sourceInfo;
    contentElement.innerHTML = '<div style="text-align: center; padding: 20px;">読み込み中...</div>';

    try {
        // バックエンドからドキュメント内容を取得
        const response = await fetch(`${API_BASE_URL}/document/content/${encodeURIComponent(filename)}`);

        if (!response.ok) {
            throw new Error('ドキュメントの取得に失敗しました');
        }

        const data = await response.json();

        // コンテンツを表示
        if (data.content) {
            contentElement.textContent = data.content;
        } else {
            contentElement.textContent = 'ドキュメントの内容が見つかりませんでした';
        }
    } catch (error) {
        console.error('Error loading document:', error);
        contentElement.innerHTML = `<div style="color: #e74c3c;">エラー: ${error.message}</div>`;
    }
}

// ドキュメントプレビューを閉じる
function closeDocumentPreview() {
    const modal = document.getElementById('documentPreviewModal');
    modal.style.display = 'none';
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

    // アシスタントの場合はキャラクター名を使用
    const displayName = (type === 'assistant' && sender === 'アシスタント') ? getCharacterName() : sender;

    let html = `<div class="message-header">${displayName}</div><div>${text}</div>`;

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

function updateMinP(value) {
    performanceSettings.minP = parseFloat(value);
    document.getElementById('minPValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

function updatePresencePenalty(value) {
    performanceSettings.presencePenalty = parseFloat(value);
    document.getElementById('presencePenaltyValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

function updateFrequencyPenalty(value) {
    performanceSettings.frequencyPenalty = parseFloat(value);
    document.getElementById('frequencyPenaltyValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

function updateRepeatLastN(value) {
    performanceSettings.repeatLastN = parseInt(value);
    document.getElementById('repeatLastNValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

function updateTypicalP(value) {
    performanceSettings.typicalP = parseFloat(value);
    document.getElementById('typicalPValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

function updateNumThread(value) {
    performanceSettings.numThread = parseInt(value);
    document.getElementById('numThreadValue').textContent = value;
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

function updateNumGpu(value) {
    performanceSettings.numGpu = parseInt(value);
    document.getElementById('numGpuValue').textContent = value;
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
function savePerformanceSettings() {
    localStorage.setItem('performanceSettings', JSON.stringify(performanceSettings));
}

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

    // キャラクター設定を復元
    if (performanceSettings.characterPreset) {
        const presetSelect = document.getElementById('characterPreset');
        if (presetSelect) {
            presetSelect.value = performanceSettings.characterPreset;
            toggleCustomCharacter();
        }
    }

    if (performanceSettings.customCharacterPrompt) {
        const customPromptTextarea = document.getElementById('customCharacterPrompt');
        if (customPromptTextarea) {
            customPromptTextarea.value = performanceSettings.customCharacterPrompt;
        }
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

// キャラクター設定関連の関数

// キャラクター名を取得
function getCharacterName() {
    const preset = performanceSettings.characterPreset;

    const characterNames = {
        samurai: '侍',
        teacher: '先生',
        gyaru: 'ギャル',
        kansai: '関西弁',
        scientist: '科学者',
        cat: '猫',
        moe: '萌え系',
        custom: 'カスタム'
    };

    if (!preset || preset === '') {
        return 'アシスタント';
    }

    return `アシスタント（${characterNames[preset] || preset}）`;
}

// カスタムキャラクター入力欄の表示切り替え
function toggleCustomCharacter() {
    const preset = document.getElementById('characterPreset').value;
    const customSection = document.getElementById('customCharacterSection');

    console.log('[DEBUG] toggleCustomCharacter called, preset:', preset);

    if (preset === 'custom') {
        customSection.style.display = 'block';
    } else {
        customSection.style.display = 'none';
    }

    // 設定を保存
    performanceSettings.characterPreset = preset;
    savePerformanceSettings();
    console.log('[DEBUG] Character preset saved:', performanceSettings.characterPreset);
}

// システムプロンプトを取得
function getSystemPrompt() {
    const preset = performanceSettings.characterPreset;

    if (!preset) {
        return null;  // プリセットなし
    }

    if (preset === 'custom') {
        const customPrompt = document.getElementById('customCharacterPrompt')?.value.trim();
        return customPrompt || null;
    }

    return characterPresets[preset] || null;
}

// カスタムキャラクタープロンプトを保存
function saveCustomCharacterPrompt() {
    const customPrompt = document.getElementById('customCharacterPrompt')?.value || '';
    performanceSettings.customCharacterPrompt = customPrompt;
    savePerformanceSettings();
}

// ========================================
// タグ機能
// ========================================

// 選択中のタグフィルタ
let selectedTags = [];

// タグ一覧を取得して表示
async function loadTags() {
    try {
        const response = await fetch('/tags');
        const data = await response.json();
        const tags = data.tags || [];

        // アップロード画面の既存タグリスト
        const existingTagsArea = document.getElementById('existingTagsArea');
        const existingTagsList = document.getElementById('existingTagsList');

        if (tags.length > 0) {
            existingTagsArea.style.display = 'block';
            existingTagsList.innerHTML = tags.map(tag =>
                `<button onclick="addTagToInput('${tag}')" style="padding: 4px 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                    ${tag}
                </button>`
            ).join('');
        } else {
            existingTagsArea.style.display = 'none';
        }

        // チャット画面のタグフィルタボタン
        updateTagFilterUI(tags);

    } catch (error) {
        console.error('Failed to load tags:', error);
    }
}

// タグフィルタUIを更新
function updateTagFilterUI(tags) {
    const tagFilterArea = document.getElementById('tagFilterArea');
    const tagFilterButtons = document.getElementById('tagFilterButtons');

    if (tags.length > 0) {
        tagFilterArea.style.display = 'block';
        tagFilterButtons.innerHTML = tags.map(tag => {
            const isSelected = selectedTags.includes(tag);
            return `<button onclick="toggleTagFilter('${tag}')" style="padding: 4px 10px; background: ${isSelected ? '#764ba2' : '#667eea'}; color: white; border: ${isSelected ? '2px solid #4a148c' : 'none'}; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: ${isSelected ? 'bold' : 'normal'};">
                ${isSelected ? '✓ ' : ''}${tag}
            </button>`;
        }).join('');
    } else {
        tagFilterArea.style.display = 'none';
    }
}

// タグを入力欄に追加
function addTagToInput(tag) {
    const input = document.getElementById('uploadTagInput');
    const currentValue = input.value.trim();

    if (currentValue) {
        // 既存の値がある場合はカンマで追加
        const existingTags = currentValue.split(',').map(t => t.trim());
        if (!existingTags.includes(tag)) {
            input.value = currentValue + ', ' + tag;
        }
    } else {
        input.value = tag;
    }
}

// タグフィルタの切り替え
function toggleTagFilter(tag) {
    const index = selectedTags.indexOf(tag);
    if (index > -1) {
        selectedTags.splice(index, 1);
    } else {
        selectedTags.push(tag);
    }

    // UIを更新
    loadTags();

    console.log('[DEBUG] Selected tags:', selectedTags);
}

// タグフィルタをクリア
function clearTagFilter() {
    selectedTags = [];
    loadTags();
}

// ページ読み込み時にタグを読み込む
document.addEventListener('DOMContentLoaded', function() {
    loadTags();
});
