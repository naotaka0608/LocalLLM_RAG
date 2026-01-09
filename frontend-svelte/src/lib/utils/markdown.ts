import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// Markdown-itのインスタンスを作成
const md = new MarkdownIt({
	html: true, // HTMLタグを許可
	linkify: true, // URLを自動的にリンクに変換
	typographer: true, // 引用符などを美しく
	breaks: false, // 改行を<br>に変換しない（バニラJSと同じ動作）
	highlight: function (str, lang) {
		// コードブロックのシンタックスハイライト
		if (lang && hljs.getLanguage(lang)) {
			try {
				return (
					'<pre class="hljs"><code>' +
					hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
					'</code></pre>'
				);
			} catch (err) {
				console.error('Highlight error:', err);
			}
		}

		// 言語指定なし、または不明な言語の場合
		return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
	}
});

/**
 * HTMLエスケープ処理
 */
function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * マークダウンテキストをHTMLに変換
 * バニラJSのformatAnswerTextと同じ処理
 */
export function renderMarkdown(text: string): string {
	if (!text) return '';

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

/**
 * インラインマークダウンをHTMLに変換（ブロック要素なし）
 */
export function renderMarkdownInline(text: string): string {
	if (!text) return '';
	return md.renderInline(text);
}
