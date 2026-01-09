# マルチステージビルド
# ===================================
# Stage 1: Builder
# ===================================
FROM node:20-alpine AS builder

WORKDIR /build

# 依存関係ファイルをコピー
COPY package*.json ./

# 依存関係インストール
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# ビルド
RUN npm run build

# ===================================
# Stage 2: Runtime
# ===================================
FROM node:20-alpine

# メタデータ
LABEL maintainer="your-email@example.com"
LABEL version="1.0"
LABEL description="LocalLLM RAG System - Frontend (SvelteKit)"

# セキュリティ: 非rootユーザーで実行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sveltekit -u 1001

WORKDIR /app

# Builderステージからビルド済みファイルをコピー
COPY --from=builder --chown=sveltekit:nodejs /build/build ./build
COPY --from=builder --chown=sveltekit:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:nodejs /build/package.json ./

# 環境変数
ENV NODE_ENV=production \
    PORT=5173

# ポート公開
EXPOSE 5173

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:5173 || exit 1

# 非rootユーザーに切り替え
USER sveltekit

# アプリケーション起動
CMD ["node", "build"]
