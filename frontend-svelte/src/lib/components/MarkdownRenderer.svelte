<script lang="ts">
	import { renderMarkdown } from '$lib/utils/markdown';
	import 'highlight.js/styles/github-dark.css'; // コードのハイライトテーマ

	export let content: string;

	$: html = renderMarkdown(content);
</script>

<div class="markdown-content">
	{@html html}
</div>

<style>
	.markdown-content {
		line-height: 1.6;
		color: inherit;
	}

	/* 見出し */
	:global(.markdown-content h1) {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 1em 0 0.5em 0;
		padding-bottom: 0.3em;
		border-bottom: 2px solid #e0e0e0;
	}

	:global(.markdown-content h2) {
		font-size: 1.3rem;
		font-weight: 700;
		margin: 0.8em 0 0.4em 0;
		padding-bottom: 0.2em;
		border-bottom: 1px solid #e0e0e0;
	}

	:global(.markdown-content h3) {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0.6em 0 0.3em 0;
	}

	:global(.markdown-content h4),
	:global(.markdown-content h5),
	:global(.markdown-content h6) {
		font-size: 1rem;
		font-weight: 600;
		margin: 0.5em 0 0.3em 0;
	}

	/* 段落 */
	:global(.markdown-content p) {
		margin: 0.5em 0;
	}

	/* リスト */
	:global(.markdown-content ul),
	:global(.markdown-content ol) {
		margin: 0.5em 0;
		padding-left: 2em;
	}

	:global(.markdown-content li) {
		margin: 0.25em 0;
	}

	/* コードブロック */
	:global(.markdown-content pre) {
		background: #1e1e1e;
		border-radius: 6px;
		padding: 1em;
		overflow-x: auto;
		margin: 1em 0;
	}

	:global(.markdown-content pre code) {
		background: transparent;
		padding: 0;
		border-radius: 0;
		font-size: 0.9em;
		line-height: 1.5;
		color: #d4d4d4;
	}

	/* インラインコード */
	:global(.markdown-content code) {
		background: rgba(0, 0, 0, 0.08);
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 0.9em;
	}

	/* テーブル */
	:global(.markdown-content table) {
		border-collapse: collapse;
		width: 100%;
		margin: 1em 0;
	}

	:global(.markdown-content th),
	:global(.markdown-content td) {
		border: 1px solid #e0e0e0;
		padding: 0.5em 0.8em;
		text-align: left;
	}

	:global(.markdown-content th) {
		background: #f5f5f5;
		font-weight: 600;
	}

	:global(.markdown-content tr:nth-child(even)) {
		background: #fafafa;
	}

	/* 引用 */
	:global(.markdown-content blockquote) {
		border-left: 4px solid #667eea;
		padding-left: 1em;
		margin: 1em 0;
		color: #666;
		font-style: italic;
	}

	/* リンク */
	:global(.markdown-content a) {
		color: #667eea;
		text-decoration: none;
		border-bottom: 1px solid transparent;
		transition: border-color 0.2s;
	}

	:global(.markdown-content a:hover) {
		border-bottom-color: #667eea;
	}

	/* 水平線 */
	:global(.markdown-content hr) {
		border: none;
		border-top: 2px solid #e0e0e0;
		margin: 2em 0;
	}

	/* 強調 */
	:global(.markdown-content strong) {
		font-weight: 700;
	}

	:global(.markdown-content em) {
		font-style: italic;
	}

	/* 画像 */
	:global(.markdown-content img) {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
		margin: 0.5em 0;
	}
</style>
