<script lang="ts">
	import { chatStore } from '$lib/stores/chatStore';

	interface Props {
		onNewChat: () => void;
		onSelectChat: (chatId: string) => void;
		onDeleteChat: (chatId: string) => void;
		onRenameChat: (chatId: string, newTitle: string) => void;
	}

	let { onNewChat, onSelectChat, onDeleteChat, onRenameChat }: Props = $props();

	let chats = $derived($chatStore.chats);
	let currentChatId = $derived($chatStore.currentChatId);

	let editingChatId = $state<string | null>(null);
	let editingTitle = $state('');

	function handleDelete(chatId: string, event: Event) {
		event.stopPropagation();
		if (confirm('このチャットを削除しますか？')) {
			onDeleteChat(chatId);
		}
	}

	function handleRename(chatId: string, event: Event) {
		event.stopPropagation();
		const chat = chats.find((c) => c.id === chatId);
		if (chat) {
			editingChatId = chatId;
			editingTitle = chat.title;
		}
	}

	function saveRename(chatId: string) {
		if (editingTitle.trim() && editingTitle.trim() !== '') {
			onRenameChat(chatId, editingTitle.trim());
		}
		editingChatId = null;
		editingTitle = '';
	}

	function cancelRename() {
		editingChatId = null;
		editingTitle = '';
	}

	function handleKeyDown(event: KeyboardEvent, chatId: string) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveRename(chatId);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelRename();
		}
	}

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'たった今';
		if (diffMins < 60) return `${diffMins}分前`;
		if (diffHours < 24) return `${diffHours}時間前`;
		if (diffDays < 7) return `${diffDays}日前`;

		return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
	}
</script>

<div class="sidebar">
	<div class="sidebar-header">
		<button class="btn-new-chat" on:click={onNewChat}>
			<span class="icon">+</span>
			新しいチャット
		</button>
	</div>

	<div class="chat-history">
		{#if chats.length === 0}
			<div class="empty-history">
				<p>チャット履歴なし</p>
			</div>
		{:else}
			{#each chats as chat (chat.id)}
				<div
					class="history-item"
					class:active={chat.id === currentChatId}
					class:editing={editingChatId === chat.id}
					on:click={() => editingChatId !== chat.id && onSelectChat(chat.id)}
					role="button"
					tabindex="0"
					on:keypress={(e) => e.key === 'Enter' && editingChatId !== chat.id && onSelectChat(chat.id)}
				>
					<div class="history-content">
						{#if editingChatId === chat.id}
							<input
								class="title-input"
								type="text"
								bind:value={editingTitle}
								on:keydown={(e) => handleKeyDown(e, chat.id)}
								on:blur={() => saveRename(chat.id)}
								autofocus
							/>
						{:else}
							<div class="history-title">{chat.title}</div>
						{/if}
						<div class="history-meta">
							<span class="message-count">{chat.messages.length}件</span>
							<span class="separator">•</span>
							<span class="timestamp">{formatDate(chat.updatedAt)}</span>
						</div>
					</div>
					<div class="history-actions">
						{#if editingChatId !== chat.id}
							<button
								class="btn-edit"
								on:click={(e) => handleRename(chat.id, e)}
								title="タイトル編集"
							>
								✎
							</button>
							<button class="btn-delete" on:click={(e) => handleDelete(chat.id, e)} title="削除">
								×
							</button>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<div class="sidebar-footer">
		<div class="app-info">
			<div class="app-name">LocalLLM RAG</div>
			<div class="app-version">Svelte版 v1.0</div>
		</div>
	</div>
</div>

<style>
	.sidebar {
		width: 280px;
		background: white;
		border-right: 1px solid #e0e0e0;
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.sidebar-header {
		padding: 20px;
		border-bottom: 1px solid #e0e0e0;
	}

	.btn-new-chat {
		width: 100%;
		padding: 12px 16px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: transform 0.2s;
	}

	.btn-new-chat:hover {
		transform: translateY(-2px);
	}

	.icon {
		font-size: 1.3rem;
		line-height: 1;
	}

	.chat-history {
		flex: 1;
		overflow-y: auto;
		padding: 10px;
	}

	.empty-history {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #999;
		font-size: 0.9rem;
	}

	.history-item {
		padding: 12px;
		margin-bottom: 8px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.history-item:hover {
		background: #f8f9fa;
		border-color: #e0e0e0;
	}

	.history-item.active {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border-color: transparent;
	}

	.history-item.editing {
		cursor: default;
	}

	.history-content {
		flex: 1;
		min-width: 0;
	}

	.history-title {
		font-size: 0.9rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-bottom: 4px;
	}

	.title-input {
		width: 100%;
		padding: 4px 8px;
		font-size: 0.9rem;
		font-weight: 500;
		border: 1px solid #667eea;
		border-radius: 4px;
		margin-bottom: 4px;
		background: white;
		color: #333;
	}

	.title-input:focus {
		outline: none;
		border-color: #764ba2;
		box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
	}

	.history-actions {
		display: flex;
		gap: 4px;
	}

	.history-meta {
		font-size: 0.75rem;
		opacity: 0.7;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.separator {
		opacity: 0.5;
	}

	.btn-edit {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.6;
		transition: all 0.2s;
	}

	.btn-edit:hover {
		opacity: 1;
		background: rgba(0, 0, 0, 0.1);
	}

	.history-item.active .btn-edit:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.btn-delete {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 1.2rem;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.6;
		transition: all 0.2s;
	}

	.btn-delete:hover {
		opacity: 1;
		background: rgba(0, 0, 0, 0.1);
	}

	.history-item.active .btn-delete:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.sidebar-footer {
		padding: 20px;
		border-top: 1px solid #e0e0e0;
	}

	.app-info {
		text-align: center;
	}

	.app-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: #333;
		margin-bottom: 4px;
	}

	.app-version {
		font-size: 0.75rem;
		color: #999;
	}
</style>
