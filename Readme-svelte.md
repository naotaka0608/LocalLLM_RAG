# LocalLLM RAG System (SvelteKit版)

ローカルLLMとRAG（Retrieval-Augmented Generation）を活用した、プライバシー重視のドキュメント検索・質問応答システムです。

## 概要

このシステムは以下の機能を提供します：

- **ローカルLLMによる質問応答**: Ollamaを使用した完全ローカル環境での自然言語処理
- **RAG機能**: アップロードしたドキュメント（PDF、Markdown等）を参照した回答生成
- **キャラクター設定**: 侍、ギャル、関西人、猫、萌えキャラなど、個性的なキャラクターで応答
- **ドキュメント管理**: ファイルアップロード、削除、検索機能
- **チャット履歴管理**: 複数のチャットセッションを保存・切り替え可能
- **パフォーマンス計測**: 応答時間、生成時間、トークン生成速度の表示
- **モデル設定**: Temperature、Top-p、最大トークン数などの詳細設定

## 技術スタック

### バックエンド
- **Python 3.10+**
- **FastAPI**: RESTful API
- **LangChain**: LLM統合フレームワーク
- **ChromaDB**: ベクトルデータベース
- **Ollama**: ローカルLLMランタイム
- **uv**: 高速Pythonパッケージマネージャー

### フロントエンド
- **SvelteKit**: フルスタックフレームワーク
- **Svelte 5**: 最新のリアクティブフレームワーク
- **TypeScript**: 型安全な開発環境
- **Vite**: 高速ビルドツール
- **Markdown-it**: マークダウンレンダリング
- **Highlight.js**: コードシンタックスハイライト

## インストール方法

### 前提条件

1. **Ollamaのインストール**
   - [Ollama公式サイト](https://ollama.com/)からダウンロード・インストール
   - モデルをダウンロード（例: `ollama pull llama3`）

2. **Node.js のインストール**
   - Node.js 18.x以上が必要
   - [Node.js公式サイト](https://nodejs.org/)からダウンロード

3. **Python 3.10以上のインストール**
   - [Python公式サイト](https://www.python.org/)からダウンロード

4. **uv のインストール**
   ```bash
   # Windows (PowerShell)
   powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

   # macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

### バックエンドのセットアップ

1. **リポジトリのクローン**
   ```bash
   git clone <repository-url>
   cd LocalLLM_RAG
   ```

2. **Python仮想環境の作成と依存関係のインストール**
   ```bash
   uv venv
   uv pip install -e .
   ```

3. **バックエンドの起動**
   ```bash
   # Windows
   .venv\Scripts\python.exe main.py

   # macOS/Linux
   .venv/bin/python main.py
   ```

   サーバーは `http://localhost:8000` で起動します。

### フロントエンドのセットアップ

1. **フロントエンドディレクトリに移動**
   ```bash
   cd frontend-svelte
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **開発サーバーの起動**
   ```bash
   npm run dev
   ```

   フロントエンドは `http://localhost:5173` で起動します。

## 起動方法

### 通常起動（開発環境）

1. **ターミナル1: バックエンド起動**
   ```bash
   # プロジェクトルートディレクトリで
   .venv\Scripts\python.exe main.py
   ```

2. **ターミナル2: フロントエンド起動**
   ```bash
   cd frontend-svelte
   npm run dev
   ```

3. **ブラウザでアクセス**
   - フロントエンド: http://localhost:5173
   - バックエンドAPI: http://localhost:8000
   - API ドキュメント: http://localhost:8000/docs

### 本番ビルド

```bash
# フロントエンドのビルド
cd frontend-svelte
npm run build

# ビルド結果のプレビュー
npm run preview
```

## 使い方

1. **ドキュメントのアップロード**
   - サイドバーの「ドキュメント管理」からPDFやMarkdownファイルをアップロード
   - アップロードされたドキュメントは自動的にベクトル化されます

2. **キャラクター設定**
   - 右上の設定アイコンから「キャラクター設定」を選択
   - 侍、ギャル、関西人、猫、萌えキャラから選択可能

3. **質問の送信**
   - チャット入力欄に質問を入力
   - RAGモードが有効な場合、アップロードしたドキュメントを参照した回答が返されます
   - 参照元のドキュメント情報や類似度スコアも表示されます

4. **モデル設定のカスタマイズ**
   - Temperature: 回答の創造性を調整（0.0〜1.0）
   - Top-p: トークン選択の多様性を調整
   - 最大トークン数: 応答の最大長を設定

## ディレクトリ構成

```
LocalLLM_RAG/
├── main.py                      # バックエンドエントリーポイント
├── rag_service.py               # RAGサービス実装
├── pyproject.toml               # Python依存関係定義
├── frontend-svelte/             # SvelteKitフロントエンド
│   ├── src/
│   │   ├── routes/              # ページルート
│   │   │   └── +page.svelte     # メインチャットUI
│   │   └── lib/                 # 共有ライブラリ
│   │       ├── api/             # API通信層
│   │       ├── components/      # 再利用可能コンポーネント
│   │       ├── stores/          # Svelteストア（状態管理）
│   │       └── utils/           # ユーティリティ関数
│   ├── package.json             # フロントエンド依存関係
│   └── vite.config.ts           # Vite設定
├── chroma_db/                   # ベクトルDB（自動生成）
└── uploads/                     # アップロードファイル（自動生成）
```

## トラブルシューティング

### Ollamaが起動しない
- Ollamaサービスが起動しているか確認: `ollama list`
- モデルがダウンロードされているか確認: `ollama pull llama3`

### バックエンドAPIに接続できない
- バックエンドが起動しているか確認: `http://localhost:8000/docs` にアクセス
- ポート8000が他のアプリケーションで使用されていないか確認

### フロントエンドが起動しない
- `node_modules` を削除して再インストール: `rm -rf node_modules && npm install`
- Node.jsのバージョンを確認: `node --version` (18.x以上必要)

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

バグ報告や機能リクエストは、GitHubのIssuesで受け付けています。
