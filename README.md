# Local LLM RAG System

OllamaとLangChainを使用したローカルLLMのRAG（Retrieval-Augmented Generation）システムです。プライバシーを保護しながら、ドキュメントベースのAIチャットボットを構築できます。

## 主な特徴

- 🔒 **完全ローカル実行** - インターネット接続不要、データは外部に送信されません
- 📚 **複数ファイル対応** - PDF, TXT, Markdown, CSVをサポート
- 🔍 **ハイブリッド検索** - BM25 + ベクトル検索で高精度な情報取得
- 💬 **会話履歴保持** - 文脈を理解した自然な対話
- ⚡ **リアルタイム表示** - ストリーミングで1文字ずつ回答を表示
- 🎛️ **詳細なパラメータ制御** - Ollamaの全パラメータに対応
- 📱 **レスポンシブUI** - PC/タブレット/スマホ対応

## クイックスタート

### 1. Ollamaのインストール

[ollama.com](https://ollama.com/) からダウンロードしてインストール

```bash
# モデルのダウンロード
ollama pull llama3.2
ollama pull nomic-embed-text
```

### 2. プロジェクトのセットアップ

```bash
# 依存関係のインストール
uv sync

# サーバーの起動
uv run python main.py
```

### 3. ブラウザでアクセス

```
http://localhost:8000
```

## 主要機能

### RAG機能
- **クエリ拡張** - LLMが関連キーワードを自動生成
- **ハイブリッド検索** - BM25（キーワード）とベクトル（意味）の組み合わせ
- **スコアフィルタリング** - 関連性の高い情報のみを使用
- **重複排除** - 多様な情報源から回答を生成

### チャット機能
- **会話履歴** - 過去10往復を記憶し、文脈を理解
- **ストリーミング** - リアルタイムで回答を表示
- **速度表示** - 生成速度（文字/秒）と総時間を表示
- **参照元表示** - 情報源とスコアを表示
- **停止ボタン** - 生成途中で停止可能

### 便利機能
- **コピーボタン** - 回答をワンクリックでコピー
- **再生成** - 同じ質問で再度回答を生成
- **ドキュメントプレビュー** - 参照元をクリックで全文表示
- **会話管理** - サイドバーで過去のチャットを管理

### パラメータ調整

#### 主要パラメータ
- **Temperature** (0.0-2.0) - 回答のランダム性
- **Document Count** - 参照するドキュメント数
- **Top-P** - サンプリング確率の累積閾値
- **Repeat Penalty** - 繰り返しの抑制

#### 詳細パラメータ（NEW!）
- **Min-P** - 最小確率閾値（Top-Pより効果的）
- **Presence/Frequency Penalty** - 新トピック促進、繰り返し防止
- **Num Thread/GPU** - CPU/GPU使用量の制御
- **Typical P, TFS-Z** - 高度なサンプリング制御
- **Repeat Last N** - ペナルティ適用範囲
- **Penalize Newline** - 改行の制御

全てのパラメータにヘルプ（?アイコン）付き

## API エンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `GET /` | フロントエンド |
| `POST /upload` | ドキュメントアップロード |
| `POST /query` | RAG回答生成（非ストリーミング） |
| `POST /query/stream` | RAG回答生成（ストリーミング） |
| `GET /documents` | ドキュメント一覧 |
| `DELETE /documents/{filename}` | ドキュメント削除 |
| `GET /document/content/{filename}` | ドキュメント内容取得 |
| `GET /models` | 利用可能なモデル一覧 |
| `GET /health` | ヘルスチェック |

## プロジェクト構造

```
.
├── main.py              # FastAPIアプリケーション
├── rag_service.py       # RAG機能の実装
├── frontend/
│   ├── index.html       # UI
│   ├── css/styles.css   # スタイル
│   └── js/script.js     # ロジック
├── pyproject.toml       # 依存関係
├── uploads/             # アップロードファイル（自動作成）
└── chroma_db/           # ベクトルDB（自動作成）
```

## カスタマイズ

### モデルの変更

```python
# rag_service.py
rag_service = RAGService(
    model_name="llama3.2",  # 任意のOllamaモデル
    embedding_model="nomic-embed-text"
)
```

### チャンクサイズの調整

```python
# rag_service.py
self.text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1500,     # 大きいドキュメント向け
    chunk_overlap=300
)
```

## トラブルシューティング

### Ollama接続エラー
```bash
# Ollamaが起動しているか確認
ollama list
```

### メモリ不足
- 軽量モデルを使用: `ollama pull llama3.2:1b`
- チャンクサイズを削減
- 検索ドキュメント数を減らす

### 別PCからアクセスできない
1. ファイアウォールでポート8000を許可
   ```powershell
   # Windows
   New-NetFirewallRule -DisplayName "RAG System" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
   ```
2. サーバーのIPアドレスで接続: `http://192.168.x.x:8000`

### 回答精度が低い
1. **ハイブリッド検索**を有効化（デフォルトON）
2. **Document Count**を増やす（10→15）
3. より大きなモデルを使用
4. チャンクサイズを調整

## セキュリティ

⚠️ **重要な注意事項**
- インターネットに公開しないでください（認証機能なし）
- 信頼できるネットワーク内でのみ使用
- 機密情報を扱う場合は特に注意

## 更新履歴

### v0.5.0 (2025-12-30) - 最新版
- ✅ **Ollamaパラメータ完全対応**
  - Min-P, Presence/Frequency Penalty, Typical P
  - Num Thread, Num GPU, Repeat Last N
  - Penalize Newline, TFS-Z
  - 全パラメータにヘルプ付き
- ✅ **便利機能追加**
  - コピーボタン
  - 回答の再生成
  - ドキュメントプレビュー
- ✅ **停止機能改善**
  - 生成途中で停止可能
  - 部分的な回答を保持

### v0.4.0 (2025-12-26)
- ✅ 会話履歴保持（10往復）
- ✅ リアルタイムストリーミング表示
- ✅ RAG ON/OFF機能
- ✅ モバイル対応改善

### v0.3.0 (2025-12-20)
- ✅ チャット履歴機能（LocalStorage）
- ✅ UI/UX改善（コンパクト化）

### v0.2.0 (2025-12-16)
- ✅ ドラッグ&ドロップ対応
- ✅ ネットワークアクセス対応

### v0.1.0 (2025-12-14)
- ✅ 初期リリース

## システム要件

- Python 3.10以上
- 8GB以上のRAM推奨
- Ollama

## 技術スタック

- **バックエンド**: FastAPI
- **フロントエンド**: HTML5 + CSS3 + Vanilla JS
- **LLM**: Ollama
- **RAG**: LangChain v0.3.x
- **ベクトルDB**: ChromaDB
- **パッケージ管理**: uv

## ライセンス

MIT License

## 参考資料

- [Ollama](https://ollama.com/)
- [LangChain](https://python.langchain.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [ChromaDB](https://www.trychroma.com/)
