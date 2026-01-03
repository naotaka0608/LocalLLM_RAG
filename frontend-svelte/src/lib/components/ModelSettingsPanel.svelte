<script lang="ts">
	import { settingsStore, presets } from '$lib/stores/settingsStore';

	let isOpen = false;
	let availableModels: string[] = [];
	let defaultModel = '';
	let isLoadingModels = false;

	// 設定の購読
	$: settings = $settingsStore;

	// プリセット変更時にカスタムに切り替えるかチェック
	$: {
		if (settings.preset !== 'custom') {
			const currentPreset = presets[settings.preset];
			const isCustom =
				settings.temperature !== currentPreset.temperature ||
				settings.top_p !== currentPreset.top_p ||
				settings.repeat_penalty !== currentPreset.repeat_penalty ||
				settings.num_predict !== currentPreset.num_predict ||
				settings.document_count !== currentPreset.document_count ||
				settings.search_multiplier !== currentPreset.search_multiplier;

			if (isCustom) {
				settingsStore.update({ preset: 'custom' });
			}
		}
	}

	// 利用可能なモデルを取得
	async function fetchModels() {
		isLoadingModels = true;
		try {
			const response = await fetch('http://localhost:8000/models');
			if (response.ok) {
				const data = await response.json();
				availableModels = data.models || [];
				defaultModel = data.default_model || '';
			}
		} catch (error) {
			console.error('Failed to fetch models:', error);
		} finally {
			isLoadingModels = false;
		}
	}

	// パネルを開いたときにモデル一覧を取得
	$: if (isOpen && availableModels.length === 0) {
		fetchModels();
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

	function handlePresetChange(preset: 'balanced' | 'fast' | 'accurate' | 'custom') {
		if (preset === 'custom') {
			settingsStore.update({ preset: 'custom' });
		} else {
			settingsStore.applyPreset(preset);
		}
	}

	// プリセットの説明
	function getPresetDescription(preset: string): string {
		const descriptions = {
			balanced: '速度と精度のバランスが取れた設定です',
			fast: '応答速度を優先した設定です。シンプルな質問に最適',
			accurate: '精度を優先した設定です。複雑な質問や詳細な回答が必要な場合に最適',
			custom: '手動でパラメータをカスタマイズした設定です'
		};
		return descriptions[preset as keyof typeof descriptions] || '';
	}
</script>

<button class="model-settings-button" on:click={togglePanel} title="モデル・パラメータ設定">
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
		<rect x="3" y="3" width="7" height="7" stroke-width="2" stroke-linecap="round" />
		<rect x="14" y="3" width="7" height="7" stroke-width="2" stroke-linecap="round" />
		<rect x="14" y="14" width="7" height="7" stroke-width="2" stroke-linecap="round" />
		<rect x="3" y="14" width="7" height="7" stroke-width="2" stroke-linecap="round" />
	</svg>
</button>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="overlay" on:click={closePanel}></div>

	<div class="settings-panel">
		<div class="panel-header">
			<h2>モデル・パラメータ設定</h2>
			<button class="close-button" on:click={closePanel}>✕</button>
		</div>

		<div class="panel-content">
			<!-- プリセット選択 -->
			<section>
				<h3>⚡ 性能プリセット</h3>
				<p class="section-desc">回答速度と精度のバランスを選択</p>
				<div class="preset-buttons">
					<button
						class="preset-btn"
						class:active={settings.preset === 'balanced'}
						on:click={() => handlePresetChange('balanced')}
					>
						<div class="preset-icon">⚖️</div>
						<div class="preset-name">バランス型</div>
						<div class="preset-desc">推奨</div>
					</button>
					<button
						class="preset-btn"
						class:active={settings.preset === 'fast'}
						on:click={() => handlePresetChange('fast')}
					>
						<div class="preset-icon">🚀</div>
						<div class="preset-name">高速優先</div>
						<div class="preset-desc">速度重視</div>
					</button>
					<button
						class="preset-btn"
						class:active={settings.preset === 'accurate'}
						on:click={() => handlePresetChange('accurate')}
					>
						<div class="preset-icon">🎯</div>
						<div class="preset-name">高精度優先</div>
						<div class="preset-desc">精度重視</div>
					</button>
					<button
						class="preset-btn"
						class:active={settings.preset === 'custom'}
						on:click={() => handlePresetChange('custom')}
					>
						<div class="preset-icon">🔧</div>
						<div class="preset-name">カスタム</div>
						<div class="preset-desc">手動設定</div>
					</button>
				</div>
				<div class="preset-info">
					{getPresetDescription(settings.preset)}
				</div>
			</section>

			<!-- モデル設定 -->
			<section>
				<h3>モデル設定</h3>
				<div class="form-group">
					<label for="model">モデル名</label>
					{#if isLoadingModels}
						<p class="loading-text">モデル一覧を読み込み中...</p>
					{:else if availableModels.length > 0}
						<select
							id="model"
							value={settings.model}
							on:change={(e) => handleUpdate('model', e.currentTarget.value)}
						>
							<option value="">自動選択 ({defaultModel})</option>
							{#each availableModels as model}
								<option value={model}>{model}</option>
							{/each}
						</select>
					{:else}
						<input
							id="model"
							type="text"
							value={settings.model}
							on:input={(e) => handleUpdate('model', e.currentTarget.value)}
							placeholder="モデル名を入力..."
						/>
						<span class="help-text">モデル一覧の取得に失敗しました</span>
					{/if}
				</div>
			</section>

			<!-- 主要パラメータ -->
			<section>
				<h3>★ 主要パラメータ</h3>
				<p class="section-desc">回答の品質と速度に最も影響するパラメータ</p>

				<!-- Temperature -->
				<div class="form-group">
					<label for="temperature">
						★ Temperature (創造性): {settings.temperature}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Temperature（創造性）</strong><br />
								範囲: 0.0 〜 2.0<br /><br />
								<strong>低い (0.0〜0.3)</strong>: 一貫性が高く予測可能。事実ベースのQ&Aに最適<br /><br />
								<strong>中程度 (0.4〜0.7)</strong>: バランス型<br /><br />
								<strong>高い (0.8〜1.0)</strong>: 創造的で多様。ブレインストーミングに有効<br /><br />
								推奨: RAG用途 0.2〜0.4
							</div>
						</div>
					</label>
					<input
						id="temperature"
						type="range"
						min="0"
						max="2"
						step="0.1"
						value={settings.temperature}
						on:input={(e) => handleUpdate('temperature', parseFloat(e.currentTarget.value))}
					/>
					<span class="help-text">低い: 一貫性↑ 高い: 創造性↑</span>
				</div>

				<!-- Document Count -->
				<div class="form-group">
					<label for="document_count">
						★ 検索ドキュメント数: {settings.document_count}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>検索ドキュメント数</strong><br />
								範囲: 3 〜 20<br />
								回答生成に使用するドキュメントの数<br /><br />
								<strong>少ない (3〜5)</strong>: 高速、シンプルなコンテキスト<br />
								<strong>多い (10〜20)</strong>: 正確で詳細な回答、多角的な視点<br /><br />
								推奨: 標準 10、複雑な質問 15〜20
							</div>
						</div>
					</label>
					<input
						id="document_count"
						type="range"
						min="3"
						max="20"
						step="1"
						value={settings.document_count}
						on:input={(e) => handleUpdate('document_count', parseInt(e.currentTarget.value))}
					/>
					<span class="help-text">少ない: 高速↑ 多い: 精度↑</span>
				</div>

				<!-- Search Multiplier -->
				<div class="form-group">
					<label for="search_multiplier">
						★ 検索範囲倍率: {settings.search_multiplier}倍
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>検索範囲倍率</strong><br />
								範囲: 2 〜 20倍<br />
								実際に検索する候補数 = ドキュメント数 × 倍率<br /><br />
								例: ドキュメント数10、倍率10 → <strong>100件検索</strong>して上位10件を使用<br /><br />
								<strong>低い倍率 (2〜5)</strong>: 高速<br />
								<strong>高い倍率 (10〜20)</strong>: より関連性の高い文書を選択、日本語検索精度向上<br /><br />
								推奨: 標準 10、精度優先 15〜20
							</div>
						</div>
					</label>
					<input
						id="search_multiplier"
						type="range"
						min="2"
						max="20"
						step="1"
						value={settings.search_multiplier}
						on:input={(e) => handleUpdate('search_multiplier', parseInt(e.currentTarget.value))}
					/>
					<span class="help-text"
						>検索時に取得する候補数（ドキュメント数×この倍率）。大きいほど精度↑</span
					>
				</div>

				<!-- Hybrid Search -->
				<div class="form-group checkbox-group">
					<label>
						<input
							type="checkbox"
							checked={settings.use_hybrid_search}
							on:change={(e) => handleUpdate('use_hybrid_search', e.currentTarget.checked)}
						/>
						<span>
							★ ハイブリッド検索 (BM25 + ベクトル)
							<div class="tooltip-container">
								<span class="tooltip-icon">?</span>
								<div class="tooltip-text">
									<strong>ハイブリッド検索</strong><br />
									BM25（キーワード検索）とベクトル検索を組み合わせた高精度検索<br /><br />
									<strong>ON</strong>: 日本語キーワード（例: EMC試験）の検索精度が大幅に向上。推奨設定<br
									/>
									<strong>OFF</strong>: ベクトル検索のみ。セマンティック検索に特化<br /><br />
									推奨: ONで使用
								</div>
							</div>
						</span>
					</label>
					<span class="help-text">日本語キーワード検索の精度向上。通常はON推奨</span>
				</div>

				<!-- Top P -->
				<div class="form-group">
					<label for="top_p">
						★ Top-P (多様性): {settings.top_p}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Top-P（多様性）</strong><br />
								範囲: 0.1 〜 1.0<br />
								Nucleus sampling。累積確率がこの値に達するまでのトークンから選択<br /><br />
								<strong>低い (0.1〜0.5)</strong>: 確実性の高い単語のみ、一貫性重視<br />
								<strong>高い (0.8〜1.0)</strong>: 多様な単語候補を考慮、表現の幅が広がる<br /><br />
								推奨: 事実ベース 0.7〜0.8、標準 0.9
							</div>
						</div>
					</label>
					<input
						id="top_p"
						type="range"
						min="0.1"
						max="1"
						step="0.05"
						value={settings.top_p}
						on:input={(e) => handleUpdate('top_p', parseFloat(e.currentTarget.value))}
					/>
					<span class="help-text">低い: 確実性↑ 高い: 多様性↑</span>
				</div>

				<!-- Repeat Penalty -->
				<div class="form-group">
					<label for="repeat_penalty">
						★ Repeat Penalty (繰り返し抑制): {settings.repeat_penalty}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Repeat Penalty（繰り返し抑制）</strong><br />
								範囲: 1.0 〜 2.0<br />
								同じ単語やフレーズの繰り返しを抑制<br /><br />
								<strong>1.0</strong>: ペナルティなし（繰り返しを許容）<br />
								<strong>1.1〜1.2</strong>: 適度に抑制（推奨）<br />
								<strong>1.3以上</strong>: 強い抑制（不自然になる可能性）<br /><br />
								推奨: 標準 1.1
							</div>
						</div>
					</label>
					<input
						id="repeat_penalty"
						type="range"
						min="1"
						max="2"
						step="0.05"
						value={settings.repeat_penalty}
						on:input={(e) => handleUpdate('repeat_penalty', parseFloat(e.currentTarget.value))}
					/>
					<span class="help-text">低い: 繰り返しOK 高い: 抑制強</span>
				</div>

				<!-- Num Predict -->
				<div class="form-group">
					<label for="num_predict">
						★ 最大生成トークン数: {settings.num_predict}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>最大生成トークン数</strong><br />
								範囲: 128 〜 8192<br />
								生成する最大トークン数<br /><br />
								<strong>128〜256</strong>: 短い回答（要約、簡潔な説明）<br />
								<strong>512〜1024</strong>: 標準的な回答<br />
								<strong>1024〜2048</strong>: 詳細な説明、長文生成<br />
								<strong>2048以上</strong>: 非常に詳細な回答<br /><br />
								推奨: 詳細な回答なら 2048〜4096
							</div>
						</div>
					</label>
					<input
						id="num_predict"
						type="range"
						min="128"
						max="8192"
						step="128"
						value={settings.num_predict}
						on:input={(e) => handleUpdate('num_predict', parseInt(e.currentTarget.value))}
					/>
					<span class="help-text">128/256/512/1024など。短い回答が欲しい場合は小さく</span>
				</div>
			</section>

			<!-- 詳細パラメータ -->
			<section>
				<h3>詳細パラメータ</h3>
				<p class="section-desc">高度な調整用パラメータ（通常は変更不要）</p>

				<!-- Top-K -->
				<div class="form-group">
					<label for="top_k">
						Top-K: {settings.top_k !== undefined ? settings.top_k : 'デフォルト (40)'}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Top-K</strong><br />
								範囲: 1 〜 100<br />
								各ステップで考慮する上位K個のトークン候補<br /><br />
								<strong>低い (10〜20)</strong>: より予測可能な出力<br />
								<strong>高い (60〜100)</strong>: より多様な出力<br /><br />
								通常はTop-Pで制御するため、デフォルトのままでOK
							</div>
						</div>
					</label>
					<input
						id="top_k"
						type="range"
						min="1"
						max="100"
						step="1"
						value={settings.top_k || 40}
						on:input={(e) => handleUpdate('top_k', parseInt(e.currentTarget.value))}
					/>
					<span class="help-text">各ステップで考慮する上位K個のトークン</span>
				</div>

				<!-- Num Ctx -->
				<div class="form-group">
					<label for="num_ctx">
						Num Ctx (コンテキストサイズ): {settings.num_ctx !== undefined
							? settings.num_ctx
							: 'デフォルト (2048)'}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Num Ctx（コンテキストサイズ）</strong><br />
								範囲: 512 〜 8192<br />
								モデルが一度に考慮できるトークン数（入力+出力）<br /><br />
								<strong>512〜1024</strong>: 短い会話に十分<br />
								<strong>2048</strong>: 標準的な会話と文書<br />
								<strong>4096〜8192</strong>: 長文の文書、長い会話履歴<br /><br />
								注意: 大きくするほどメモリ使用量とレイテンシが増加
							</div>
						</div>
					</label>
					<input
						id="num_ctx"
						type="range"
						min="512"
						max="8192"
						step="512"
						value={settings.num_ctx || 2048}
						on:input={(e) => handleUpdate('num_ctx', parseInt(e.currentTarget.value))}
					/>
					<span class="help-text">モデルが一度に考慮できるトークン数。長文向けは大きく</span>
				</div>

				<!-- Seed -->
				<div class="form-group">
					<label for="seed">
						Seed (乱数シード): {settings.seed !== undefined ? settings.seed : 'ランダム'}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Seed（乱数シード）</strong><br />
								範囲: 任意の整数、または空欄（ランダム）<br />
								同じシードで同じ結果を再現可能にする<br /><br />
								<strong>用途</strong>: デバッグ、A/Bテスト、結果の再現性確保<br /><br />
								通常は空欄（ランダム）でOK
							</div>
						</div>
					</label>
					<input
						id="seed"
						type="number"
						placeholder="空欄=ランダム"
						min="0"
						value={settings.seed || ''}
						on:input={(e) =>
							handleUpdate('seed', e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined)}
					/>
					<span class="help-text">同じ値で結果を再現可能。デバッグ用</span>
				</div>

				<!-- Mirostat -->
				<div class="form-group">
					<label for="mirostat">
						Mirostat: {settings.mirostat === 1
							? 'Mirostat 1.0'
							: settings.mirostat === 2
								? 'Mirostat 2.0'
								: '無効 (0)'}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Mirostat</strong><br />
								動的サンプリングアルゴリズム。perplexityを制御して一貫した品質を維持<br /><br />
								<strong>無効 (0)</strong>: 標準的なサンプリング（Temperature、Top-Pを使用）<br />
								<strong>Mirostat 1.0 / 2.0</strong>: より一貫した品質の出力<br /><br />
								推奨: 通常は無効でOK。品質が不安定な場合に試す
							</div>
						</div>
					</label>
					<select
						id="mirostat"
						value={settings.mirostat || 0}
						on:change={(e) => handleUpdate('mirostat', parseInt(e.currentTarget.value))}
					>
						<option value="0">無効 (0)</option>
						<option value="1">Mirostat 1.0</option>
						<option value="2">Mirostat 2.0</option>
					</select>
					<span class="help-text">動的サンプリングでより一貫した品質</span>
				</div>

				<!-- Mirostat Tau -->
				<div class="form-group">
					<label for="mirostat_tau">
						Mirostat Tau: {settings.mirostat_tau !== undefined
							? settings.mirostat_tau
							: 'デフォルト (5.0)'}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Mirostat Tau</strong><br />
								範囲: 0.0 〜 10.0<br />
								目標perplexity値。Mirostat有効時のみ使用<br /><br />
								<strong>低い (2〜4)</strong>: より予測可能<br />
								<strong>高い (6〜10)</strong>: より多様<br /><br />
								推奨: デフォルト 5.0
							</div>
						</div>
					</label>
					<input
						id="mirostat_tau"
						type="range"
						min="0"
						max="10"
						step="0.5"
						value={settings.mirostat_tau || 5.0}
						on:input={(e) => handleUpdate('mirostat_tau', parseFloat(e.currentTarget.value))}
					/>
					<span class="help-text">Mirostat使用時の目標perplexity</span>
				</div>

				<!-- Mirostat Eta -->
				<div class="form-group">
					<label for="mirostat_eta">
						Mirostat Eta: {settings.mirostat_eta !== undefined
							? settings.mirostat_eta
							: 'デフォルト (0.1)'}
						<div class="tooltip-container">
							<span class="tooltip-icon">?</span>
							<div class="tooltip-text">
								<strong>Mirostat Eta</strong><br />
								範囲: 0.0 〜 1.0<br />
								学習率。Mirostat有効時のみ使用<br /><br />
								<strong>低い (0.05〜0.1)</strong>: ゆっくり調整<br />
								<strong>高い (0.2〜0.5)</strong>: 速く調整<br /><br />
								推奨: デフォルト 0.1
							</div>
						</div>
					</label>
					<input
						id="mirostat_eta"
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={settings.mirostat_eta || 0.1}
						on:input={(e) => handleUpdate('mirostat_eta', parseFloat(e.currentTarget.value))}
					/>
					<span class="help-text">Mirostat使用時の学習率</span>
				</div>
			</section>
		</div>
	</div>
{/if}

<style>
	.model-settings-button {
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

	.model-settings-button:hover {
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
		width: 500px;
		max-width: 90vw;
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
		margin: 0 0 8px 0;
		color: #333;
		border-bottom: 2px solid #667eea;
		padding-bottom: 8px;
	}

	.section-desc {
		font-size: 0.85rem;
		color: #666;
		margin: 0 0 15px 0;
	}

	.preset-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		margin-bottom: 15px;
	}

	.preset-btn {
		padding: 15px;
		border: 2px solid #e0e0e0;
		border-radius: 8px;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}

	.preset-btn:hover {
		border-color: #667eea;
		background: #f8f9ff;
	}

	.preset-btn.active {
		border-color: #667eea;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.preset-icon {
		font-size: 2rem;
		margin-bottom: 5px;
	}

	.preset-name {
		font-weight: 600;
		font-size: 0.95rem;
		margin-bottom: 3px;
	}

	.preset-desc {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	.preset-info {
		font-size: 0.8rem;
		color: #666;
		padding: 10px;
		background: #f8f9fa;
		border-radius: 6px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 8px;
		color: #333;
		position: relative;
	}

	.form-group input[type='text'],
	.form-group input[type='number'],
	.form-group select {
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
	.form-group select:focus {
		outline: none;
		border-color: #667eea;
	}

	.form-group input[type='range'] {
		width: 100%;
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		cursor: pointer;
		font-weight: 600;
	}

	.checkbox-group input[type='checkbox'] {
		margin-right: 10px;
		width: 20px;
		height: 20px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.help-text {
		display: block;
		font-size: 0.75rem;
		color: #888;
		margin-top: 5px;
	}

	.loading-text {
		color: #667eea;
		font-size: 0.9rem;
		margin: 8px 0;
		font-style: italic;
	}

	/* ツールチップスタイル */
	.tooltip-container {
		display: inline-block;
		position: relative;
		margin-left: 6px;
	}

	.tooltip-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		background: #667eea;
		color: white;
		border-radius: 50%;
		font-size: 0.7rem;
		font-weight: bold;
		cursor: help;
		vertical-align: middle;
	}

	.tooltip-text {
		visibility: hidden;
		opacity: 0;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 125%;
		background: #333;
		color: white;
		padding: 12px;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: normal;
		line-height: 1.5;
		width: 300px;
		max-width: 90vw;
		z-index: 1000;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
		transition:
			opacity 0.2s,
			visibility 0.2s;
		pointer-events: none;
	}

	.tooltip-text::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: #333;
	}

	.tooltip-container:hover .tooltip-text {
		visibility: visible;
		opacity: 1;
	}

	.tooltip-text strong {
		display: block;
		margin-bottom: 5px;
		font-size: 0.8rem;
	}

	.tooltip-text ul {
		margin: 5px 0 0 18px;
		padding: 0;
	}

	.tooltip-text li {
		margin: 3px 0;
	}
</style>
