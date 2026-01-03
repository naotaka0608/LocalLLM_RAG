<script lang="ts">
	import { onMount } from 'svelte';
	import { sendQuestionStream, processStream } from '$lib/api/chat';
	import { chatStore, currentChat } from '$lib/stores/chatStore';
	import { settingsStore } from '$lib/stores/settingsStore';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MarkdownRenderer from '$lib/components/MarkdownRenderer.svelte';
	import SourceDisplay from '$lib/components/SourceDisplay.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import ModelSettingsPanel from '$lib/components/ModelSettingsPanel.svelte';
	import DocumentManager from '$lib/components/DocumentManager.svelte';

	let inputMessage = '';
	let isGenerating = false;
	let currentStreamingMessage = '';
	let abortController: AbortController | null = null;

	// 現在のチャットのメッセージ
	$: messages = $currentChat?.messages || [];
	$: chatId = $currentChat?.id || null;

	// テーマとフォントサイズを適用
	$: theme = $settingsStore.theme;
	$: fontSize = $settingsStore.fontSize;

	// 初回読み込み時に新しいチャットを作成
	onMount(() => {
		if ($chatStore.chats.length === 0) {
			chatStore.createNewChat();
		}
	});

	// 新しいチャットを作成
	function handleNewChat() {
		if (isGenerating) return;
		chatStore.createNewChat();
	}

	// チャットを選択
	function handleSelectChat(selectedChatId: string) {
		if (isGenerating) return;
		chatStore.selectChat(selectedChatId);
	}

	// チャットを削除
	function handleDeleteChat(deleteChatId: string) {
		chatStore.deleteChat(deleteChatId);
	}

	function stopGeneration() {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		isGenerating = false;

		// 中断されたメッセージに注釈を追加
		if (chatId && currentStreamingMessage) {
			chatStore.updateLastMessage(chatId, currentStreamingMessage + '\n\n*[生成が停止されました]*');
		}
		currentStreamingMessage = '';
	}

	async function sendMessage() {
		if (!inputMessage.trim() || isGenerating || !chatId) return;

		// ユーザーメッセージを追加
		const userQuestion = inputMessage;
		console.log('[DEBUG] Sending question:', userQuestion);
		chatStore.addMessage(chatId, { role: 'user', content: userQuestion });
		inputMessage = '';
		isGenerating = true;
		currentStreamingMessage = '';

		// AbortControllerを作成
		abortController = new AbortController();

		// アシスタントメッセージのプレースホルダーを追加
		chatStore.addMessage(chatId, { role: 'assistant', content: '' });

		try {
			// 設定を取得
			const settings = $settingsStore;

			// APIリクエストパラメータを構築（空の値は送信しない）
			const requestParams: any = {
				use_rag: settings.use_rag,
				use_hybrid_search: settings.use_hybrid_search,
				query_expansion: settings.query_expansion,
				temperature: settings.temperature,
				top_p: settings.top_p,
				repeat_penalty: settings.repeat_penalty,
				num_predict: settings.num_predict,
				document_count: settings.document_count,
				search_multiplier: settings.search_multiplier
			};

			// オプショナルなパラメータ（値がある場合のみ追加）
			if (settings.model && settings.model.trim()) {
				requestParams.model = settings.model;
			}
			if (settings.system_prompt && settings.system_prompt.trim()) {
				requestParams.system_prompt = settings.system_prompt;
			}
			if (settings.tags && settings.tags.length > 0) {
				requestParams.tags = settings.tags;
			}

			// APIからストリーミングレスポンスを取得
			const stream = await sendQuestionStream(
				userQuestion,
				requestParams,
				abortController?.signal
			);

			// ストリーミングを処理
			await processStream(
				stream,
				(chunk) => {
					// メッセージを追加
					currentStreamingMessage += chunk;

					// 最後のメッセージを更新
					if (chatId) {
						chatStore.updateLastMessage(chatId, currentStreamingMessage);
					}
				},
				() => {
					// ストリーミング完了
					isGenerating = false;
					currentStreamingMessage = '';
				},
				(sources, qualityScore) => {
					// ソース情報を受信
					if (chatId) {
						chatStore.updateLastMessageSources(chatId, sources, qualityScore);
					}
				}
			);
		} catch (error: any) {
			console.error('API Error:', error);

			// Abortエラーの場合は何もしない（停止ボタンによる中断）
			if (error.name === 'AbortError') {
				return;
			}

			// エラーメッセージを表示
			if (chatId) {
				chatStore.updateLastMessage(
					chatId,
					`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}\n\nFastAPIサーバーが起動しているか確認してください（http://localhost:8000）`
				);
			}
			isGenerating = false;
			currentStreamingMessage = '';
		} finally {
			abortController = null;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="app-layout theme-{theme}" style="--font-size: {fontSize}px;">
	<Sidebar
		onNewChat={handleNewChat}
		onSelectChat={handleSelectChat}
		onDeleteChat={handleDeleteChat}
	/>

	<div class="main-content">
		<div class="chat-header">
			<div class="header-content">
				<div>
					<h1>LocalLLM RAG System</h1>
					<p>Svelte版 - チャット履歴管理対応</p>
				</div>
				<div class="header-buttons">
					<DocumentManager />
					<ModelSettingsPanel />
					<SettingsPanel />
				</div>
			</div>
		</div>

		<!-- タグフィルター表示 -->
		{#if $settingsStore.tags && $settingsStore.tags.length > 0}
			<div class="tag-filter-area">
				<span class="filter-label">🏷️ フィルタ:</span>
				<div class="filter-tags">
					{#each $settingsStore.tags as tag}
						<span class="filter-tag">{tag}</span>
					{/each}
				</div>
				<button class="clear-filter-btn" on:click={() => settingsStore.update({ tags: [] })}>
					✕ クリア
				</button>
			</div>
		{/if}

		<div class="chat-messages">
			{#each messages as message, index}
				<div class="message {message.role}">
					<div class="message-role">
						{message.role === 'user' ? 'あなた' : 'AI'}
					</div>
					<div class="message-content">
						{#if message.role === 'user'}
							<!-- ユーザーメッセージはプレーンテキスト -->
							{message.content}
						{:else if index === messages.length - 1 && isGenerating}
							<!-- 生成中のメッセージ -->
							<MarkdownRenderer content={message.content} />
							<span class="cursor">▊</span>
						{:else}
							<!-- アシスタントメッセージはマークダウン表示 -->
							<MarkdownRenderer content={message.content} />
							<!-- ソース情報を表示 -->
							{#if message.sources && message.sources.length > 0}
								<SourceDisplay sources={message.sources} qualityScore={message.qualityScore} />
							{/if}
						{/if}
					</div>
				</div>
			{/each}

			{#if messages.length === 0}
				<div class="empty-state">
					<p>何か質問してみてください</p>
					<p class="api-info">FastAPI: http://localhost:8000</p>
				</div>
			{/if}
		</div>

		<div class="chat-input">
			<input
				type="text"
				bind:value={inputMessage}
				on:keypress={handleKeyPress}
				placeholder="質問を入力してください..."
				disabled={isGenerating}
			/>
			{#if isGenerating}
				<button class="btn-stop" on:click={stopGeneration}>
					⏹ 停止
				</button>
			{:else}
				<button on:click={sendMessage}>
					📤 送信
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background: #f5f5f5;
	}

	.app-layout {
		display: flex;
		height: 100vh;
		max-width: 1400px;
		margin: 0 auto;
		background: white;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
		font-size: var(--font-size, 16px);
	}

	/* ダークテーマ */
	.theme-dark {
		background: #1e1e1e;
		color: #e0e0e0;
	}

	.theme-dark .chat-messages {
		background: #2d2d2d;
	}

	.theme-dark .message.assistant {
		background: #383838;
		color: #e0e0e0;
	}

	.theme-dark .chat-input {
		background: #2d2d2d;
		border-top-color: #444;
	}

	.theme-dark .chat-input input {
		background: #383838;
		color: #e0e0e0;
		border-color: #555;
	}

	/* ブルーテーマ */
	.theme-blue .chat-header {
		background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
	}

	.theme-blue .message.user {
		background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
	}

	/* グリーンテーマ */
	.theme-green .chat-header {
		background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
	}

	.theme-green .message.user {
		background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.chat-header {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 20px;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-buttons {
		display: flex;
		gap: 10px;
	}

	.chat-header h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.chat-header p {
		margin: 5px 0 0 0;
		opacity: 0.9;
		font-size: 0.9rem;
	}

	.tag-filter-area {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		background: #f9f9f9;
		border-bottom: 1px solid #e0e0e0;
		flex-wrap: wrap;
	}

	.filter-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #666;
		white-space: nowrap;
	}

	.filter-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex: 1;
	}

	.filter-tag {
		background: #667eea;
		color: white;
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.clear-filter-btn {
		padding: 4px 12px;
		background: #ff5722;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.clear-filter-btn:hover {
		background: #e64a19;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.message {
		display: flex;
		flex-direction: column;
		max-width: 70%;
		padding: 12px 16px;
		border-radius: 12px;
		word-wrap: break-word;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message.user {
		align-self: flex-end;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.message.assistant {
		align-self: flex-start;
		background: #f0f0f0;
		color: #333;
	}

	.message-role {
		font-size: 0.75rem;
		font-weight: 600;
		margin-bottom: 5px;
		opacity: 0.8;
	}

	.message-content {
		font-size: 0.95rem;
		line-height: 1.5;
	}

	/* ユーザーメッセージのみpre-wrapを適用 */
	.message.user .message-content {
		white-space: pre-wrap;
	}

	.cursor {
		animation: blink 1s infinite;
		margin-left: 2px;
	}

	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #999;
		font-size: 1.1rem;
		gap: 10px;
	}

	.api-info {
		font-size: 0.85rem;
		color: #ccc;
		font-family: monospace;
	}

	.chat-input {
		display: flex;
		gap: 10px;
		padding: 20px;
		border-top: 1px solid #e0e0e0;
		background: #fafafa;
	}

	.chat-input input {
		flex: 1;
		padding: 12px 16px;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		font-size: 1rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.2s;
	}

	.chat-input input:focus {
		border-color: #667eea;
	}

	.chat-input input:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	.chat-input button {
		padding: 12px 24px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s;
		min-width: 100px;
	}

	.chat-input button:hover:not(:disabled) {
		transform: translateY(-2px);
	}

	.chat-input button:active:not(:disabled) {
		transform: translateY(0);
	}

	.chat-input button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-stop {
		background: #ff5722 !important;
		font-weight: bold;
	}

	.btn-stop:hover:not(:disabled) {
		background: #e64a19 !important;
	}
</style>
