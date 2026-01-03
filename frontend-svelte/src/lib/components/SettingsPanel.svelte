<script lang="ts">
	import { settingsStore, characterPresets } from '$lib/stores/settingsStore';

	let isOpen = false;
	let availableTags: string[] = [];
	let isLoadingTags = false;

	// 設定の購読
	$: settings = $settingsStore;

	// システムプロンプトが手動編集されたらカスタムに切り替え
	$: {
		if (settings.character_preset !== 'custom') {
			const currentPresetPrompt = characterPresets[settings.character_preset];
			if (settings.system_prompt !== currentPresetPrompt) {
				settingsStore.update({ character_preset: 'custom' });
			}
		}
	}

	// 利用可能なタグを取得
	async function fetchTags() {
		isLoadingTags = true;
		try {
			const response = await fetch('http://localhost:8000/tags');
			if (response.ok) {
				const data = await response.json();
				availableTags = data.tags || [];
			}
		} catch (error) {
			console.error('Failed to fetch tags:', error);
		} finally {
			isLoadingTags = false;
		}
	}

	// パネルを開いたときにタグ一覧を取得
	$: if (isOpen) {
		fetchTags();
	}

	function togglePanel() {
		isOpen = !isOpen;
	}

	function closePanel() {
		isOpen = false;
	}

	function handleUpdate(key: string, value: any) {
		settingsStore.update({ [key]: value });
	}

	function handleReset() {
		if (confirm('設定をデフォルトに戻しますか?')) {
			settingsStore.reset();
		}
	}

	function toggleTag(tag: string) {
		const currentTags = settings.tags;
		if (currentTags.includes(tag)) {
			// タグを削除
			settingsStore.update({
				tags: currentTags.filter((t) => t !== tag)
			});
		} else {
			// タグを追加
			settingsStore.update({
				tags: [...currentTags, tag]
			});
		}
	}

	function clearAllTags() {
		settingsStore.update({ tags: [] });
	}

	function handleCharacterPresetChange(
		preset: 'none' | 'samurai' | 'gal' | 'kansai' | 'cat' | 'moe' | 'custom'
	) {
		if (preset === 'custom') {
			settingsStore.update({ character_preset: 'custom' });
		} else {
			settingsStore.applyCharacterPreset(preset);
		}
	}
</script>

<button class="settings-button" on:click={togglePanel} title="設定">
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
		<path
			d="M12 15a3 3 0 100-6 3 3 0 000 6z"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</button>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay" on:click={closePanel}></div>

	<div class="settings-panel">
		<div class="panel-header">
			<h2>基本設定</h2>
			<button class="close-button" on:click={closePanel}>✕</button>
		</div>

		<div class="panel-content">

			<!-- RAG設定 -->
			<section>
				<h3>RAG設定</h3>
				<div class="form-group checkbox-group">
					<label>
						<input
							type="checkbox"
							checked={settings.use_rag}
							on:change={(e) => handleUpdate('use_rag', e.currentTarget.checked)}
						/>
						<span>RAGを使用</span>
					</label>
				</div>
				<div class="form-group checkbox-group">
					<label>
						<input
							type="checkbox"
							checked={settings.use_hybrid_search}
							on:change={(e) => handleUpdate('use_hybrid_search', e.currentTarget.checked)}
						/>
						<span>ハイブリッド検索を使用</span>
					</label>
				</div>
				<div class="form-group checkbox-group">
					<label>
						<input
							type="checkbox"
							checked={settings.query_expansion}
							on:change={(e) => handleUpdate('query_expansion', e.currentTarget.checked)}
						/>
						<span>クエリ拡張を使用</span>
					</label>
				</div>
			</section>

			<!-- タグフィルター -->
			<section>
				<h3>タグフィルター</h3>
				<div class="form-group">
					{#if isLoadingTags}
						<p class="loading-text">タグ一覧を読み込み中...</p>
					{:else if availableTags.length > 0}
						<div class="tag-checkbox-list">
							{#each availableTags as tag}
								<label class="tag-checkbox">
									<input
										type="checkbox"
										checked={settings.tags.includes(tag)}
										on:change={() => toggleTag(tag)}
									/>
									<span class="tag-label">{tag}</span>
								</label>
							{/each}
						</div>
						{#if settings.tags.length > 0}
							<button class="clear-tags-btn" on:click={clearAllTags}>
								すべてクリア
							</button>
						{/if}
					{:else}
						<p class="no-tags-text">タグが登録されていません</p>
						<span class="help-text">ドキュメント管理でタグを付けたドキュメントをアップロードしてください</span>
					{/if}
				</div>
			</section>

			<!-- システムプロンプト -->
			<section>
				<h3>システムプロンプト</h3>
				<div class="form-group">
					<label>キャラクタープリセット</label>
					<div class="character-preset-buttons">
						<button
							class="character-preset-btn"
							class:active={settings.character_preset === 'none'}
							on:click={() => handleCharacterPresetChange('none')}
						>
							なし
						</button>
						<button
							class="character-preset-btn"
							class:active={settings.character_preset === 'samurai'}
							on:click={() => handleCharacterPresetChange('samurai')}
						>
							侍
						</button>
						<button
							class="character-preset-btn"
							class:active={settings.character_preset === 'gal'}
							on:click={() => handleCharacterPresetChange('gal')}
						>
							ギャル
						</button>
						<button
							class="character-preset-btn"
							class:active={settings.character_preset === 'kansai'}
							on:click={() => handleCharacterPresetChange('kansai')}
						>
							関西弁
						</button>
						<button
							class="character-preset-btn"
							class:active={settings.character_preset === 'cat'}
							on:click={() => handleCharacterPresetChange('cat')}
						>
							猫
						</button>
						<button
							class="character-preset-btn"
							class:active={settings.character_preset === 'moe'}
							on:click={() => handleCharacterPresetChange('moe')}
						>
							萌え
						</button>
						<button
							class="character-preset-btn"
							class:active={settings.character_preset === 'custom'}
							on:click={() => handleCharacterPresetChange('custom')}
						>
							カスタム
						</button>
					</div>
				</div>
				<div class="form-group">
					<label>プロンプト内容</label>
					<textarea
						rows="4"
						placeholder="AIの振る舞いを指定..."
						value={settings.system_prompt}
						on:input={(e) => handleUpdate('system_prompt', e.currentTarget.value)}
					></textarea>
				</div>
			</section>

			<!-- テーマ設定 -->
			<section>
				<h3>テーマ設定</h3>
				<div class="form-group">
					<label for="theme">カラーテーマ</label>
					<select
						id="theme"
						value={settings.theme}
						on:change={(e) => handleUpdate('theme', e.currentTarget.value)}
					>
						<option value="light">🌞 ライト（デフォルト）</option>
						<option value="dark">🌙 ダーク</option>
						<option value="ocean">🌊 オーシャン</option>
						<option value="sunset">🌅 サンセット</option>
						<option value="forest">🌲 フォレスト</option>
						<option value="purple">💜 パープル</option>
					</select>
				</div>
				<div class="form-group">
					<label for="fontSize">フォントサイズ: {settings.fontSize}px</label>
					<input
						id="fontSize"
						type="range"
						min="12"
						max="20"
						value={settings.fontSize}
						on:input={(e) => handleUpdate('fontSize', parseInt(e.currentTarget.value))}
					/>
					<span class="help-text">チャット画面の文字サイズを調整</span>
				</div>
			</section>

			<!-- リセットボタン -->
			<div class="panel-footer">
				<button class="reset-button" on:click={handleReset}>デフォルトに戻す</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-button {
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

	.settings-button:hover {
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

	.settings-panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 400px;
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

	.form-group {
		margin-bottom: 15px;
	}

	.form-group label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 6px;
		color: #555;
	}

	.form-group input[type='text'],
	.form-group input[type='number'],
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		font-family: inherit;
		box-sizing: border-box;
	}

	.form-group input[type='text']:focus,
	.form-group input[type='number']:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #667eea;
	}

	.form-group input[type='range'] {
		width: 100%;
	}

	.form-group textarea {
		resize: vertical;
		min-height: 80px;
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		cursor: pointer;
		font-weight: normal;
	}

	.checkbox-group input[type='checkbox'] {
		margin-right: 8px;
		cursor: pointer;
	}

	.help-text {
		display: block;
		font-size: 0.75rem;
		color: #888;
		margin-top: 4px;
	}

	.tag-input-group {
		display: flex;
		gap: 8px;
		margin-bottom: 10px;
	}

	.tag-input-group input {
		flex: 1;
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

	.panel-footer {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid #e0e0e0;
	}

	.reset-button {
		width: 100%;
		padding: 10px;
		background: #ef4444;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
		transition: background-color 0.2s;
	}

	.reset-button:hover {
		background: #dc2626;
	}

	.loading-text {
		color: #667eea;
		font-size: 0.9rem;
		margin: 8px 0;
		font-style: italic;
	}

	.tag-checkbox-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 15px;
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

	.clear-tags-btn {
		width: 100%;
		padding: 8px;
		background: #ff9800;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 600;
		transition: background-color 0.2s;
	}

	.clear-tags-btn:hover {
		background: #f57c00;
	}

	.no-tags-text {
		color: #999;
		font-size: 0.9rem;
		margin: 8px 0;
		text-align: center;
	}

	.character-preset-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 15px;
	}

	.character-preset-btn {
		padding: 8px 16px;
		border: 2px solid #e0e0e0;
		border-radius: 6px;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.character-preset-btn:hover {
		border-color: #667eea;
		background: #f8f9ff;
	}

	.character-preset-btn.active {
		border-color: #667eea;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}
</style>
