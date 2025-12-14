# Local LLM RAG System

OllamaとLangChainを使用したローカルLLMのRAG（Retrieval-Augmented Generation）システムです。複数形式のドキュメントをアップロードし、その内容に基づいて質問に回答します。

## 特徴

### コア機能
- **ローカル実行**: インターネット接続不要、プライバシー保護
- **複数ファイル形式対応**: PDF, TXT, Markdown, CSV
- **高速検索**: ChromaDBベクトルデータベースによる効率的な情報検索
- **モデル選択**: 複数のOllamaモデルから選択可能
- **リアルタイムフィードバック**: ローディング表示と通知システム

### RAG精度向上機能（v0.1.0）
- **クエリ拡張**: LLMによる関連キーワードの自動生成
- **マルチクエリ検索**: 複数の視点から情報を収集
- **スコアベースフィルタリング**: 関連性の高いドキュメントのみを使用
- **重複排除**: 同一内容の排除により多様な情報を活用
- **大規模コンテキスト**: チャンクサイズ1500文字、オーバーラップ300文字

### UI/UX
- **2タブインターフェース**: チャットと設定を分離
- **ローディング表示**: アップロードと回答生成の進行状況を可視化
- **通知システム**: 操作結果をリアルタイムで通知
- **レスポンシブデザイン**: モバイルにも対応

### 技術スタック
- **バックエンド**: FastAPI（高速、非同期対応）
- **LLM**: Ollama（ローカルLLMサーバー）
- **RAGフレームワーク**: LangChain v0.3.x
- **ベクトルDB**: ChromaDB（永続化対応）
- **パッケージ管理**: uv（高速依存関係管理）

## システム要件

- Python 3.10以上
- Ollama（ローカルLLMサーバー）
- 8GB以上のRAM推奨

## セットアップ手順

### 1. Ollamaのインストール

まず、Ollamaをインストールします。

**Windows/Mac/Linux:**
```bash
# https://ollama.ai/ からダウンロードしてインストール
```

インストール後、必要なモデルをダウンロードします：

```bash
# LLMモデル（回答生成用）
ollama pull llama3.2

# Embeddingモデル（ベクトル化用）
ollama pull nomic-embed-text
```

### 2. uvのインストール

uvをインストールします（Pythonの高速パッケージマネージャー）：

```bash
# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Mac/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 3. プロジェクトのセットアップ

```bash
# 依存関係のインストール
uv sync

# または手動で仮想環境を作成する場合
uv venv
# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

uv pip install -e .
```

### 4. サーバーの起動

```bash
# uvを使用して起動
uv run python main.py

# または仮想環境を有効化してから起動
python main.py
```

サーバーは `http://localhost:8000` で起動します。

### 5. フロントエンドへのアクセス

**ローカルからのアクセス（同じPC）:**
```
http://localhost:8000
```

**別PCからのアクセス（同じネットワーク内）:**
```
http://[サーバーのIPアドレス]:8000
```

例: `http://192.168.1.100:8000`

#### サーバーのIPアドレスを確認する方法

**Windows:**
```bash
ipconfig
```
「IPv4 アドレス」を確認してください（例: 192.168.1.100）

**Mac/Linux:**
```bash
ifconfig
# または
ip addr show
```

#### ファイアウォールの設定

別PCからアクセスする場合、ファイアウォールでポート8000を開放する必要があります。

**Windows Defender ファイアウォール:**
```powershell
# PowerShellを管理者権限で実行
New-NetFirewallRule -DisplayName "Local LLM RAG System" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

**Linux (ufw):**
```bash
sudo ufw allow 8000/tcp
```

**Mac:**
システム環境設定 > セキュリティとプライバシー > ファイアウォール > ファイアウォールオプション でポート8000を許可

## 使い方

### 基本的な使い方

1. **ドキュメントのアップロード**
   - ブラウザで `http://localhost:8000` にアクセス
   - 「⚙️ 設定」タブをクリック
   - 「📄 ドキュメント管理」エリアにファイルをドラッグ&ドロップ、またはクリックしてファイルを選択
   - 対応形式: PDF, TXT, MD, CSV
   - 複数ファイルの同時アップロードに対応
   - アップロード中はローディングアニメーションが表示されます

2. **質問する**
   - 「💬 チャット」タブに戻る
   - 必要に応じて使用するモデルをドロップダウンから選択
   - チャットエリアに質問を入力して送信
   - アップロードしたドキュメントの内容に基づいて回答が生成されます
   - 回答生成中はローディングアニメーションが表示されます
   - 回答には参照元のファイル名とページ情報も表示されます

3. **モデルの選択**
   - チャットタブのヘッダー、または設定タブの「🤖 モデル設定」でモデルを選択
   - デフォルトは llama3.2
   - 「🔄 モデル再読み込み」ボタンで利用可能なモデルを更新

4. **ドキュメント管理**
   - 設定タブの「📚 登録済みドキュメント」で現在登録されているドキュメントを確認
   - 「全て削除」ボタンですべてのドキュメントをクリア
   - 削除時は確認ダイアログが表示されます

5. **システム状態の確認**
   - 設定タブの「⚙️ システム状態」でOllamaの接続状態を確認
   - 緑色: 正常、赤色: 接続エラー

## API エンドポイント

### `GET /`
HTMLフロントエンドを返す

### `POST /upload`
ファイルをアップロードしてベクトルストアに追加

**対応フォーマット**: PDF, TXT, MD, CSV

**リクエスト:**
- Content-Type: multipart/form-data
- Body: ファイル（複数可）

**レスポンス:**
```json
{
  "message": "Documents uploaded successfully",
  "files": ["document1.pdf", "notes.txt", "data.csv"]
}
```

### `POST /query`
質問に対してRAGで回答を生成（非ストリーミング）

**リクエスト:**
```json
{
  "question": "質問内容",
  "stream": false,
  "model": "llama3.2"  // オプション、指定しない場合はデフォルトモデル
}
```

**レスポンス:**
```json
{
  "answer": "回答内容",
  "sources": ["document.pdf (Page 1)", "document.pdf (Page 3)"]
}
```

**特徴:**
- クエリ拡張により関連キーワードを自動生成
- 最大30件（k×3）のドキュメントを検索
- スコアベースのフィルタリングで上位10件を選択
- 重複排除により多様な情報を提供

### `POST /query/stream`
質問に対してRAGで回答を生成（ストリーミング）

**リクエスト:**
```json
{
  "question": "質問内容",
  "stream": true,
  "model": "llama3.2"  // オプション
}
```

**レスポンス:**
- Content-Type: text/event-stream
- Server-Sent Events形式で回答をストリーミング

### `GET /documents`
登録されているドキュメント一覧を取得

**レスポンス:**
```json
{
  "documents": ["document1.pdf", "notes.txt", "data.csv"]
}
```

### `DELETE /documents`
すべてのドキュメントを削除

**レスポンス:**
```json
{
  "message": "All documents cleared"
}
```

### `GET /models`
利用可能なOllamaモデルの一覧を取得

**レスポンス:**
```json
{
  "models": ["llama3.2", "llama3.1", "mistral", "phi3"]
}
```

### `GET /health`
ヘルスチェック

**レスポンス:**
```json
{
  "status": "healthy",
  "ollama_available": true
}
```

## プロジェクト構造

```
.
├── main.py              # FastAPIアプリケーション
├── rag_service.py       # RAG機能の実装
├── index.html           # フロントエンド
├── pyproject.toml       # 依存関係定義
├── README.md            # このファイル
├── uploads/             # アップロードされたPDFの保存先（自動作成）
└── chroma_db/           # ベクトルデータベース（自動作成）
```

## カスタマイズ

### 使用するLLMモデルの変更

[rag_service.py](rag_service.py) の `RAGService` クラスのコンストラクタで変更できます：

```python
rag_service = RAGService(
    model_name="llama3.2",           # 任意のOllamaモデル
    embedding_model="nomic-embed-text",  # 任意のEmbeddingモデル
    persist_directory="./chroma_db"
)
```

利用可能なモデル：
- LLM: `llama3.2`, `llama3.1`, `mistral`, `phi3`, など
- Embedding: `nomic-embed-text`, `mxbai-embed-large`, など

### チャンクサイズの変更

[rag_service.py:51-55](rag_service.py#L51-L55) でテキスト分割の設定を変更できます：

```python
self.text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1500,      # チャンクの最大文字数（現在の設定）
    chunk_overlap=300,    # チャンク間のオーバーラップ（現在の設定）
    length_function=len
)
```

**推奨設定:**
- 小さいドキュメント: `chunk_size=1000, chunk_overlap=200`
- 大きいドキュメント: `chunk_size=1500, chunk_overlap=300`（デフォルト）
- 非常に大きいドキュメント: `chunk_size=2000, chunk_overlap=400`

### 検索する関連文書の数

[rag_service.py:158](rag_service.py#L158) の `k` パラメータで変更できます：

```python
def query(self, question: str, k: int = 10, ...):  # kの値を変更
```

**注意:** 実際には `k * 3` 件（デフォルトで30件）のドキュメントを取得し、フィルタリング後に上位 `k` 件を使用します。

### RAG精度向上機能の詳細

#### 1. クエリ拡張（Query Expansion）
[rag_service.py:129-156](rag_service.py#L129-L156)

```python
def _expand_query(self, question: str) -> List[str]:
    """
    ユーザーの質問から関連キーワードや言い換えを3つ自動生成
    """
```

**動作:**
- LLMに質問を渡して関連キーワードを生成
- 元の質問 + 3つの拡張クエリ = 合計4つのクエリで検索
- 失敗時は元の質問のみを使用（フォールバック）

**無効化方法:**
```python
# main.py の query エンドポイントで
answer, sources = rag_service.query(
    request.question,
    model_name=request.model,
    enable_query_expansion=False  # 追加
)
```

#### 2. マルチクエリ検索
[rag_service.py:184-203](rag_service.py#L184-L203)

各クエリで最大30件（`k * 3`）のドキュメントを検索し、結果をマージします。

#### 3. 重複排除
[rag_service.py:190-200](rag_service.py#L190-L200)

```python
content_hash = hash(doc.page_content[:200])  # 最初の200文字でハッシュ化
if content_hash not in seen_content:
    seen_content.add(content_hash)
    all_docs_with_scores.append((doc, score))
```

同じ内容のチャンクを排除し、より多様な情報をコンテキストに含めます。

#### 4. スコアベースフィルタリング
[rag_service.py:208-220](rag_service.py#L208-L220)

```python
best_score = all_docs_with_scores[0][1]
threshold = best_score * 2.0
filtered_docs = [(doc, score) for doc, score in all_docs_with_scores if score <= threshold]
```

最高スコアの2倍以内のドキュメントのみを保持し、無関係なドキュメントを除外します。

**ChromaDBのスコア:** 値が小さいほど類似度が高い（距離ベース）

#### 5. 改善されたプロンプト
[rag_service.py:58-72](rag_service.py#L58-L72)

- 直接的な答えがない場合でも推論して回答
- 複数の情報を統合
- 具体的な情報を積極的に引用

### 精度向上の効果

**改善前:**
- 単一クエリで10件のドキュメントを取得
- 質問の言い回しに敏感
- 関連情報を見逃すことがある

**改善後:**
- 4つのクエリで最大120件を検索、上位10件を厳選
- 質問の言い回しが異なっても適切な情報を発見
- より包括的で正確な回答を生成

**デバッグログの活用:**
```bash
# サーバー起動時にログを確認
uv run python main.py

# 以下のようなログが出力されます:
[DEBUG] Expanding query...
[DEBUG] Expanded queries: ['質問内容', 'キーワード1', 'キーワード2', 'キーワード3']
[DEBUG] Query '質問内容...' retrieved 30 documents
[DEBUG] Filtered 120 -> 45 documents (threshold: 0.8543)
[DEBUG] Using top 10 documents for context
```

## トラブルシューティング

### Ollamaに接続できない

1. Ollamaが起動しているか確認：
   ```bash
   ollama list
   ```

2. モデルがダウンロードされているか確認：
   ```bash
   ollama list
   ```

3. Ollamaのポートを確認（デフォルト: 11434）

### メモリ不足エラー

- より小さいモデルを使用：`llama3.2:1b` など
- チャンクサイズを小さくする
- 一度にアップロードするPDFファイルのサイズを減らす

### ファイルのアップロードエラー

**PDFファイル:**
- PDFファイルが破損していないか確認
- PDFにテキストが含まれているか確認（画像のみのPDFは読み取れません）
- OCR処理済みのPDFを使用してください

**その他のファイル:**
- TXTファイル: UTF-8エンコーディングを使用
- Markdownファイル: 標準的なMarkdown形式
- CSVファイル: UTF-8エンコーディング、ヘッダー行を含む

### 回答精度が低い場合

1. **クエリ拡張の確認**
   - デバッグログで拡張クエリを確認
   - 適切なキーワードが生成されているか確認

2. **ドキュメントの質**
   - ドキュメントに十分な情報が含まれているか確認
   - 複数の関連ドキュメントをアップロード

3. **チャンクサイズの調整**
   - 大きなドキュメント: chunk_size を増やす
   - 小さなドキュメント: chunk_size を減らす

4. **モデルの変更**
   - より大きなモデル（llama3.1など）を試す
   - 専門分野に特化したモデルを使用

5. **検索数の増加**
   - `k` パラメータを増やす（例: 15, 20）

### クエリ拡張が遅い場合

クエリ拡張を無効化することで高速化できます：

```python
# main.py の query エンドポイントを編集
answer, sources = rag_service.query(
    request.question,
    model_name=request.model,
    enable_query_expansion=False  # 追加
)
```

ただし、精度は低下する可能性があります。

### 別PCからアクセスできない場合

1. **サーバーが起動しているか確認**
   ```bash
   # サーバーのログを確認
   # "Uvicorn running on http://0.0.0.0:8000" と表示されているか確認
   ```

2. **ファイアウォールの確認**
   - Windows Defender ファイアウォールでポート8000が許可されているか確認
   - セキュリティソフトがブロックしていないか確認

3. **IPアドレスの確認**
   - サーバーとクライアントが同じネットワークにいるか確認
   - プライベートIPアドレス（192.168.x.x または 10.x.x.x）を使用しているか確認

4. **ネットワーク接続のテスト**
   ```bash
   # クライアントPCから
   ping [サーバーのIPアドレス]

   # 例: ping 192.168.1.100
   ```

5. **ポートのテスト**
   ```bash
   # Windows (PowerShell)
   Test-NetConnection -ComputerName [サーバーのIPアドレス] -Port 8000

   # Mac/Linux
   nc -zv [サーバーのIPアドレス] 8000
   ```

6. **CORSエラーの場合**
   - ブラウザの開発者ツール（F12）でコンソールを確認
   - CORSエラーが表示される場合は、`main.py`のCORS設定を確認
   - 現在の設定: `allow_origins=["*"]` （すべてのオリジンを許可）

7. **プロキシ環境下の場合**
   - 企業ネットワークなどでプロキシを使用している場合、プロキシ設定を確認
   - または、プロキシをバイパスする設定を追加

### セキュリティに関する注意

**重要:** このシステムはローカルネットワーク内での使用を想定しています。

- ⚠️ インターネットに公開しないでください（認証機能がありません）
- ⚠️ 信頼できるネットワーク内でのみ使用してください
- ⚠️ 機密情報を含むドキュメントを扱う場合は特に注意してください

**推奨設定:**
- ファイアウォールでアクセス元IPを制限
- VPNやSSHトンネルを使用してアクセス
- 必要に応じて認証機能を追加

## 開発履歴

### v0.1.0 (2025-12-14)
- ✅ 初期リリース
- ✅ PDF, TXT, MD, CSV対応
- ✅ モデル選択機能
- ✅ 2タブUI（チャット/設定）
- ✅ ローディング表示と通知システム
- ✅ RAG精度向上機能
  - クエリ拡張
  - マルチクエリ検索
  - スコアベースフィルタリング
  - 重複排除
  - 大規模コンテキスト（chunk_size: 1500）

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。

## よくある質問（FAQ）

### Q: ストリーミング機能は使えますか？
A: はい、`/query/stream` エンドポイントがありますが、現在のフロントエンドは非ストリーミングのみ対応しています。カスタムクライアントで利用可能です。

### Q: 複数のPDFを一度に検索できますか？
A: はい、複数のファイルをアップロードすれば、すべてのファイルから情報を検索します。

### Q: インターネット接続は必要ですか？
A: いいえ、すべてローカルで動作します。Ollamaとモデルがインストールされていれば、オフラインで使用できます。

### Q: GPUは必要ですか？
A: 必須ではありませんが、GPUがあると回答生成が高速化されます。OllamaはCPUでも動作します。

### Q: 日本語以外の言語も使えますか？
A: はい、使用するLLMモデルが対応している言語であれば使用できます。llama3.2は多言語対応しています。

### Q: クエリ拡張で生成されるキーワードが不適切な場合は？
A: `enable_query_expansion=False` で無効化するか、より高性能なモデルを使用してください。

## 参考資料

### 公式ドキュメント
- [Ollama](https://ollama.ai/) - ローカルLLMサーバー
- [LangChain](https://python.langchain.com/) - LLMアプリケーションフレームワーク
- [FastAPI](https://fastapi.tiangolo.com/) - Pythonウェブフレームワーク
- [ChromaDB](https://www.trychroma.com/) - ベクトルデータベース
- [uv](https://github.com/astral-sh/uv) - Pythonパッケージマネージャー

### 関連技術
- [RAG（Retrieval-Augmented Generation）](https://arxiv.org/abs/2005.11401) - 技術解説論文
- [Embedding Models](https://ollama.ai/library/nomic-embed-text) - nomic-embed-text
- [LangChain Text Splitters](https://python.langchain.com/docs/modules/data_connection/document_transformers/) - テキスト分割手法

### Ollamaモデル
- [llama3.2](https://ollama.ai/library/llama3.2) - デフォルトモデル
- [llama3.1](https://ollama.ai/library/llama3.1) - より高性能
- [mistral](https://ollama.ai/library/mistral) - 高速モデル
- [phi3](https://ollama.ai/library/phi3) - 軽量モデル
