<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getDocumentStats,
		getDocuments,
		uploadFile,
		deleteDocument,
		clearDatabase,
		type Document,
		type DocumentStats
	} from '$lib/api/documents';

	let isOpen = false;
	let stats: DocumentStats | null = null;
	let documents: Document[] = [];
	let isLoading = false;
	let selectedTags: string[] = [];
	let uploadTags: string[] = [];
	let tagInput = '';
	let uploadTagInput = '';
	let fileInput: HTMLInputElement;
	let isUploading = false;
	let uploadProgress = '';
	let availableTags: string[] = [];
	let isDragging = false;

	function togglePanel() {
		isOpen = !isOpen;
		if (isOpen) {
			loadStats();
			loadTags();
			loadDocuments();
		}
	}

	function closePanel() {
		isOpen = false;
	}

	async function loadStats() {
		try {
			stats = await getDocumentStats();
		} catch (error) {
			console.error('Failed to load stats:', error);
		}
	}

	async function loadTags() {
		try {
			const response = await fetch('http://localhost:8000/tags');
			if (response.ok) {
				const data = await response.json();
				availableTags = data.tags || [];
			}
		} catch (error) {
			console.error('Failed to load tags:', error);
		}
	}

	async function loadDocuments() {
		isLoading = true;
		try {
			documents = await getDocuments(100, 0, selectedTags.length > 0 ? selectedTags : undefined);
		} catch (error) {
			console.error('Failed to load documents:', error);
			documents = [];
		} finally {
			isLoading = false;
		}
	}

	function addTag() {
		if (tagInput.trim() && !selectedTags.includes(tagInput.trim())) {
			selectedTags = [...selectedTags, tagInput.trim()];
			tagInput = '';
			loadDocuments();
		}
	}

	function removeTag(tag: string) {
		selectedTags = selectedTags.filter((t) => t !== tag);
		loadDocuments();
	}

	function addUploadTag() {
		if (uploadTagInput.trim() && !uploadTags.includes(uploadTagInput.trim())) {
			uploadTags = [...uploadTags, uploadTagInput.trim()];
			uploadTagInput = '';
		}
	}

	function removeUploadTag(tag: string) {
		uploadTags = uploadTags.filter((t) => t !== tag);
	}

	function handleTagKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addTag();
		}
	}

	function handleUploadTagKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addUploadTag();
		}
	}

	function toggleFilterTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
		loadDocuments();
	}

	function toggleUploadTag(tag: string) {
		if (uploadTags.includes(tag)) {
			uploadTags = uploadTags.filter((t) => t !== tag);
		} else {
			uploadTags = [...uploadTags, tag];
		}
	}

	async function processFiles(files: FileList) {
		if (!files || files.length === 0) return;

		isUploading = true;
		uploadProgress = '';

		try {
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				uploadProgress = `${i + 1}/${files.length}: ${file.name} をアップロード中...`;

				await uploadFile(file, uploadTags);
			}

			uploadProgress = `${files.length}件のファイルをアップロードしました`;
			uploadTags = [];

			// 統計、タグ、ドキュメント一覧を再読み込み
			await loadStats();
			await loadTags();
			await loadDocuments();

			// 成功メッセージを3秒後にクリア
			setTimeout(() => {
				uploadProgress = '';
			}, 3000);
		} catch (error) {
			uploadProgress = `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
		} finally {
			isUploading = false;
		}
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (files) {
			await processFiles(files);
			input.value = ''; // ファイル選択をリセット
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		const files = event.dataTransfer?.files;
		if (files) {
			await processFiles(files);
		}
	}

	async function handleDeleteDocument(filename: string) {
		if (!confirm(`ドキュメント "${filename}" を削除しますか?`)) {
			return;
		}

		try {
			await deleteDocument(filename);
			await loadStats();
			await loadTags();
			await loadDocuments();
		} catch (error) {
			alert(`削除に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
		}
	}

	async function handleClearDatabase() {
		if (
			!confirm(
				'すべてのドキュメントを削除しますか?\nこの操作は取り消せません。\n\n本当に削除しますか?'
			)
		) {
			return;
		}

		try {
			await clearDatabase();
			await loadStats();
			await loadTags();
			await loadDocuments();
		} catch (error) {
			alert(
				`データベースのクリアに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
			);
		}
	}
</script>

<button class="docs-button" on:click={togglePanel} title="ドキュメント管理">
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
		<path
			d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<polyline points="13 2 13 9 20 9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
</button>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay" on:click={closePanel}></div>

	<div class="docs-panel">
		<div class="panel-header">
			<h2>ドキュメント管理</h2>
			<button class="close-button" on:click={closePanel}>✕</button>
		</div>

		<div class="panel-content">
			<!-- 統計情報 -->
			{#if stats}
				<section class="stats-section">
					<div class="stat-card">
						<div class="stat-value">{stats.total_documents}</div>
						<div class="stat-label">ドキュメント</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">{stats.total_chunks}</div>
						<div class="stat-label">チャンク</div>
					</div>
					<div class="stat-card">
						<div class="stat-value">{stats.tags.length}</div>
						<div class="stat-label">タグ</div>
					</div>
				</section>
			{/if}

			<!-- ファイルアップロード -->
			<section>
				<h3>ファイルをアップロード</h3>
				<div class="upload-section">
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div
						class="drop-zone"
						class:dragging={isDragging}
						on:dragover={handleDragOver}
						on:dragleave={handleDragLeave}
						on:drop={handleDrop}
					>
						<input
							type="file"
							bind:this={fileInput}
							on:change={handleFileUpload}
							multiple
							accept=".txt,.md,.pdf"
							disabled={isUploading}
							style="display: none;"
						/>
						<div class="drop-zone-content">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
								<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								<polyline points="17 8 12 3 7 8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								<line x1="12" y1="3" x2="12" y2="15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
							<p class="drop-zone-text">ファイルをドラッグ&ドロップ</p>
							<p class="drop-zone-subtext">または</p>
							<button class="upload-button" on:click={() => fileInput.click()} disabled={isUploading}>
								{isUploading ? 'アップロード中...' : 'ファイルを選択'}
							</button>
							<p class="file-types">対応形式: PDF, TXT, MD</p>
						</div>
					</div>

					{#if uploadProgress}
						<div class="upload-progress">{uploadProgress}</div>
					{/if}

					<!-- タグ選択 -->
					{#if availableTags.length > 0}
						<div class="tag-checkbox-section">
							<label class="section-label">既存のタグから選択</label>
							<div class="tag-checkbox-list">
								{#each availableTags as tag}
									<label class="tag-checkbox">
										<input
											type="checkbox"
											checked={uploadTags.includes(tag)}
											on:change={() => toggleUploadTag(tag)}
										/>
										<span class="tag-label">{tag}</span>
									</label>
								{/each}
							</div>
						</div>
					{/if}
					<div class="tag-input-group">
						<input
							type="text"
							placeholder="新しいタグを追加..."
							bind:value={uploadTagInput}
							on:keypress={handleUploadTagKeyPress}
						/>
						<button on:click={addUploadTag}>追加</button>
					</div>
					{#if uploadTags.length > 0}
						<div class="selected-tags-section">
							<label class="section-label">選択中のタグ</label>
							<div class="tag-list">
								{#each uploadTags as tag}
									<span class="tag">
										{tag}
										<button on:click={() => removeUploadTag(tag)}>×</button>
									</span>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</section>

			<!-- ドキュメント一覧 -->
			<section>
				<h3>ドキュメント一覧</h3>
				{#if isLoading}
					<div class="loading">読み込み中...</div>
				{:else if documents.length === 0}
					<div class="empty">ドキュメントがありません</div>
				{:else}
					<div class="document-list">
						{#each documents as doc}
							<div class="document-item">
								<div class="document-header">
									<span class="document-source">{doc.filename}</span>
									<button class="delete-button" on:click={() => handleDeleteDocument(doc.filename)}>
										削除
									</button>
								</div>
								{#if doc.tags && doc.tags.length > 0}
									<div class="document-tags">
										{#each doc.tags as tag}
											<span class="tag-badge">{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- 危険な操作 -->
			<section class="danger-zone">
				<h3>危険な操作</h3>
				<button class="danger-button" on:click={handleClearDatabase}>
					すべてのドキュメントを削除
				</button>
			</section>
		</div>
	</div>
{/if}

<style>
	.docs-button {
		background: transparent;
		border: none;
		padding: 8px;
		cursor: pointer;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: background-color 0.2s;
	}

	.docs-button:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 998;
	}

	.docs-panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 500px;
		height: 100vh;
		background: white;
		box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
		z-index: 999;
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px;
		border-bottom: 1px solid #e0e0e0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.panel-header h2 {
		margin: 0;
		font-size: 1.3rem;
	}

	.close-button {
		background: transparent;
		border: none;
		color: white;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.close-button:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
	}

	section {
		margin-bottom: 30px;
	}

	section h3 {
		font-size: 1.1rem;
		margin: 0 0 15px 0;
		color: #333;
		border-bottom: 2px solid #667eea;
		padding-bottom: 8px;
	}

	.stats-section {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 15px;
		margin-bottom: 30px;
	}

	.stat-card {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 20px;
		border-radius: 12px;
		text-align: center;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		margin-bottom: 5px;
	}

	.stat-label {
		font-size: 0.85rem;
		opacity: 0.9;
	}

	.upload-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.tag-input-group {
		display: flex;
		gap: 8px;
	}

	.tag-input-group input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
	}

	.tag-input-group button {
		padding: 8px 16px;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
	}

	.tag-input-group button:hover {
		background: #5568d3;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #f0f0f0;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.85rem;
		color: #333;
	}

	.tag button {
		background: transparent;
		border: none;
		color: #666;
		cursor: pointer;
		padding: 0;
		font-size: 1.1rem;
		line-height: 1;
	}

	.tag button:hover {
		color: #333;
	}

	.drop-zone {
		border: 2px dashed #ddd;
		border-radius: 12px;
		padding: 40px 20px;
		text-align: center;
		background: #fafafa;
		transition: all 0.3s;
		cursor: pointer;
		margin-bottom: 20px;
	}

	.drop-zone:hover {
		border-color: #667eea;
		background: #f8f9ff;
	}

	.drop-zone.dragging {
		border-color: #667eea;
		background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
		transform: scale(1.02);
	}

	.drop-zone-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.drop-zone-content svg {
		color: #667eea;
		margin-bottom: 10px;
	}

	.drop-zone-text {
		font-size: 1.1rem;
		font-weight: 600;
		color: #333;
		margin: 0;
	}

	.drop-zone-subtext {
		font-size: 0.9rem;
		color: #999;
		margin: 0;
	}

	.file-types {
		font-size: 0.75rem;
		color: #888;
		margin: 0;
	}

	.upload-button {
		padding: 12px 24px;
		background: #10b981;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
		transition: background-color 0.2s;
		font-size: 0.95rem;
	}

	.upload-button:hover:not(:disabled) {
		background: #059669;
	}

	.upload-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.upload-progress {
		padding: 10px;
		background: #f0f9ff;
		border-left: 3px solid #3b82f6;
		border-radius: 4px;
		font-size: 0.9rem;
		color: #1e40af;
	}

	.loading,
	.empty {
		padding: 20px;
		text-align: center;
		color: #999;
	}

	.document-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.document-item {
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 12px;
		background: #fafafa;
	}

	.document-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.document-source {
		font-weight: 600;
		font-size: 0.9rem;
		color: #667eea;
	}

	.delete-button {
		padding: 4px 12px;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.delete-button:hover {
		background: #dc2626;
	}

	.document-content {
		font-size: 0.85rem;
		color: #555;
		line-height: 1.5;
		margin-bottom: 8px;
	}

	.document-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tag-badge {
		background: #667eea;
		color: white;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.danger-zone {
		border-top: 2px solid #ef4444;
		padding-top: 20px;
	}

	.danger-zone h3 {
		color: #ef4444;
		border-bottom-color: #ef4444;
	}

	.danger-button {
		width: 100%;
		padding: 12px;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
		transition: background-color 0.2s;
	}

	.danger-button:hover {
		background: #dc2626;
	}

	.tag-checkbox-section {
		margin-bottom: 15px;
	}

	.section-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 600;
		color: #555;
		margin-bottom: 10px;
	}

	.tag-checkbox-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 10px;
	}

	.tag-checkbox {
		display: flex;
		align-items: center;
		padding: 8px 12px;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.tag-checkbox:hover {
		background: #f8f9ff;
		border-color: #667eea;
	}

	.tag-checkbox input[type='checkbox'] {
		margin-right: 10px;
		cursor: pointer;
		width: 18px;
		height: 18px;
	}

	.tag-label {
		flex: 1;
		font-size: 0.9rem;
		color: #333;
	}

	.selected-tags-section {
		margin-bottom: 15px;
	}

	.no-tags-message {
		color: #999;
		font-size: 0.9rem;
		text-align: center;
		padding: 15px;
	}
</style>
