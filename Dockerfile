# Python 3.10ベースイメージ
FROM python:3.10-slim

# 作業ディレクトリを設定
WORKDIR /app

# システムパッケージの更新と必要なツールのインストール
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Pythonの依存関係をコピー
COPY pyproject.toml .

# uvのインストール
RUN pip install --no-cache-dir uv

# 依存パッケージのインストール
RUN uv pip install --system --no-cache-dir \
    fastapi>=0.104.0 \
    uvicorn[standard]>=0.24.0 \
    langchain>=0.3.0 \
    langchain-community>=0.3.0 \
    langchain-text-splitters>=0.3.0 \
    langchain-core>=0.3.0 \
    chromadb>=0.4.22 \
    pypdf>=3.17.0 \
    python-multipart>=0.0.6 \
    ollama>=0.1.0 \
    unstructured>=0.10.0 \
    markdown>=3.5.0 \
    requests>=2.31.0 \
    rank-bm25>=0.2.2

# アプリケーションコードをコピー
COPY *.py ./
COPY frontend ./frontend

# 必要なディレクトリを作成
RUN mkdir -p /app/uploads /app/chroma_db

# ポート8000を公開
EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# アプリケーションの起動
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
