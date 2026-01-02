# LocalLLM RAG System - Svelte版

## 🚀 開発サーバーの起動

```bash
cd frontend-svelte
npm run dev
```

ブラウザで http://localhost:5173 にアクセスしてください。

## 📝 現在の状態

### ✅ 完了
- SvelteKitプロジェクト作成
- 基本的なチャット画面
- メッセージ送受信UI

### 🔄 次のステップ
1. FastAPI APIへの接続
2. ストリーミング対応
3. チャット履歴管理（Svelte Store）
4. その他機能の移行

## 🔧 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# ビルド結果のプレビュー
npm run preview

# TypeScriptの型チェック
npm run check
```

## 📁 プロジェクト構造

```
src/
├── routes/
│   ├── +layout.svelte      # 全体のレイアウト
│   └── +page.svelte         # メインページ（チャット画面）
├── lib/
│   ├── components/          # （今後追加）コンポーネント
│   ├── stores/              # （今後追加）状態管理
│   └── api/                 # （今後追加）API呼び出し
└── app.html                 # HTMLテンプレート
```

## 🎨 Svelteの特徴

### リアクティビリティ
```svelte
<script>
  let count = 0;  // 自動的にリアクティブ
</script>

<button on:click={() => count++}>
  クリック数: {count}
</button>
```

### 双方向バインディング
```svelte
<input bind:value={message} />
```

### コンポーネントスコープCSS
```svelte
<style>
  /* このコンポーネントにだけ適用される */
  .message { color: blue; }
</style>
```

## 🔗 次に実装する機能

1. **API接続** - FastAPIとの通信
2. **ストリーミング** - Server-Sent Eventsでリアルタイム表示
3. **Store** - 状態管理の導入
4. **コンポーネント分割** - 保守性向上
