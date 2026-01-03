<script lang="ts">
	import { settingsStore } from '$lib/stores/settingsStore';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	// テーマとフォントサイズを適用
	let theme = $derived($settingsStore.theme);
	let fontSize = $derived($settingsStore.fontSize);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-root theme-{theme}" style="--font-size: {fontSize}px;">
	{@render children()}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	.app-root {
		min-height: 100vh;
		background: #f5f5f5;
		font-size: var(--font-size, 16px);
	}

	/* ダークテーマのグローバルスタイル */
	.theme-dark {
		background: #1e1e1e;
		color: #e0e0e0;
	}
</style>
