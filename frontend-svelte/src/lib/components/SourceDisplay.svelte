<script lang="ts">
	import type { SourceInfo } from '$lib/api/chat';

	export let sources: SourceInfo[] = [];
	export let qualityScore: number | undefined = undefined;

	let isExpanded = false;

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	// スコアの色を決定
	function getScoreColor(score: number): string {
		if (score >= 0.8) return '#10b981'; // 緑
		if (score >= 0.6) return '#f59e0b'; // オレンジ
		return '#ef4444'; // 赤
	}

	// クオリティスコアの色を決定（0-100の範囲）
	function getQualityColor(quality: number): string {
		if (quality >= 70) return '#10b981';
		if (quality >= 50) return '#f59e0b';
		return '#ef4444';
	}
</script>

{#if sources.length > 0}
	<div class="source-container">
		<button class="source-toggle" on:click={toggleExpanded}>
			<span class="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
			<span class="toggle-text">
				参照ソース ({sources.length}件)
				{#if qualityScore !== undefined}
					<span class="quality-badge" style="background-color: {getQualityColor(qualityScore)}">
						品質: {qualityScore.toFixed(0)}%
					</span>
				{/if}
			</span>
		</button>

		{#if isExpanded}
			<div class="source-list">
				{#each sources as source, index}
					<div class="source-item">
						<div class="source-header">
							<span class="source-number">#{index + 1}</span>
							<span
								class="source-score"
								style="color: {getScoreColor(source.score)}"
							>
								関連度: {(source.score * 100).toFixed(1)}%
							</span>
						</div>
						<div class="source-content">
							{source.source}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.source-container {
		margin-top: 12px;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		padding-top: 8px;
	}

	.source-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		border: none;
		padding: 6px 0;
		cursor: pointer;
		font-size: 0.85rem;
		color: #666;
		transition: color 0.2s;
		width: 100%;
		text-align: left;
	}

	.source-toggle:hover {
		color: #333;
	}

	.toggle-icon {
		font-size: 0.7rem;
		transition: transform 0.2s;
	}

	.toggle-text {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
	}

	.quality-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		color: white;
		font-weight: 600;
	}

	.source-list {
		margin-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.source-item {
		background: rgba(0, 0, 0, 0.02);
		border-left: 3px solid #667eea;
		padding: 10px 12px;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.source-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.source-number {
		font-weight: 600;
		color: #667eea;
		font-size: 0.8rem;
	}

	.source-score {
		font-weight: 600;
		font-size: 0.8rem;
	}

	.source-content {
		line-height: 1.5;
		color: #444;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
