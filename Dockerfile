# マルチステージビルドでイメージサイズを削減
# ===================================
# Stage 1: Builder
# ===================================
FROM python:3.12-slim AS builder

# 作業ディレクトリ
WORKDIR /build

# ビルドに必要なパッケージのみインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# uvインストール
RUN pip install --no-cache-dir uv

# 依存関係ファイルをコピー
COPY backend/pyproject.toml backend/uv.lock ./

# 依存パッケージをインストール（システムワイド）
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
    rank-bm25>=0.2.2 \
    slowapi>=0.1.9 \
    python-dotenv>=1.0.0

# ===================================
# Stage 2: Runtime
# ===================================
FROM python:3.12-slim

# メタデータ
LABEL maintainer="your-email@example.com"
LABEL version="1.0"
LABEL description="LocalLLM RAG System - Production Ready"

# セキュリティ: 非rootユーザーで実行
RUN groupadd -r ragapp && useradd -r -g ragapp ragapp

# 作業ディレクトリ
WORKDIR /app

# ランタイムに必要な最小限のパッケージのみ
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Builderステージからインストール済みPythonパッケージをコピー
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# アプリケーションコードをコピー
COPY --chown=ragapp:ragapp backend/*.py ./
COPY --chown=ragapp:ragapp frontend ./frontend

# 必要なディレクトリを作成（適切なパーミッション）
RUN mkdir -p /app/uploads /app/chroma_db /var/log/rag-app \
    && chown -R ragapp:ragapp /app/uploads /app/chroma_db /var/log/rag-app \
    && chmod 755 /app/uploads /app/chroma_db \
    && chmod 755 /var/log/rag-app

# 環境変数
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    LOG_LEVEL=WARNING \
    CHROMA_PERSIST_DIRECTORY=/app/chroma_db \
    UPLOAD_DIRECTORY=/app/uploads

# ポート8000を公開（ドキュメント用）
EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/tags || exit 1

# ボリュームマウントポイント
VOLUME ["/app/chroma_db", "/app/uploads"]

# 非rootユーザーに切り替え
USER ragapp

# アプリケーション起動
# 本番環境: ワーカー数を自動調整
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--log-level", "warning", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
