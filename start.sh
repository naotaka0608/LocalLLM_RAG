#!/bin/bash
#
# LocalLLM RAG アプリケーション起動スクリプト
# Docker環境が既にセットアップ済みであることを前提とします
#
# 使い方:
#   chmod +x start.sh
#   ./start.sh
#

set -e

# 色付きログ
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "============================================"
log_info "  LocalLLM RAG アプリケーション起動"
log_info "============================================"
echo ""

# 1. Docker確認
if ! command -v docker &> /dev/null; then
    log_error "Dockerがインストールされていません"
    log_info "先にsetup.shを実行してください"
    exit 1
fi

# 2. docker-compose.ymlの存在確認
if [ ! -f docker-compose.yml ]; then
    log_error "docker-compose.ymlが見つかりません"
    log_info "プロジェクトのルートディレクトリで実行してください"
    exit 1
fi

# 3. 既存のコンテナを停止（存在する場合）
if docker compose ps | grep -q "Up"; then
    log_info "既存のコンテナを停止中..."
    docker compose down
fi

# 4. Dockerイメージの確認とビルド
if docker images | grep -q "localllm_rag-rag-app"; then
    log_info "既存のDockerイメージを使用します"
    read -p "イメージを再ビルドしますか？ [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Dockerイメージを再ビルド中..."
        docker compose build --no-cache
        log_success "ビルド完了"
    fi
else
    log_info "Dockerイメージをビルド中..."
    docker compose build
    log_success "ビルド完了"
fi
echo ""

# 5. サービスの起動
log_info "サービスを起動中..."
docker compose up -d

# 起動待機
sleep 5
log_success "サービス起動完了"
echo ""

# 6. サービス状態の確認
log_info "サービスの状態:"
docker compose ps
echo ""

# 7. ヘルスチェック
log_info "ヘルスチェック中..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:8000/health &> /dev/null; then
        log_success "FastAPIサーバーが正常に動作しています"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "FastAPIサーバーの起動に失敗しました"
    log_info "ログを確認してください: docker compose logs rag-app"
    exit 1
fi
echo ""

# 8. モデルの確認
log_info "Ollamaモデルの確認中..."
MODELS=$(docker compose exec -T ollama ollama list 2>/dev/null || echo "")

if echo "$MODELS" | grep -q "gemma3:12b"; then
    log_success "gemma3:12b インストール済み"
else
    log_warn "gemma3:12b が見つかりません"
    log_info "以下のコマンドでダウンロードしてください:"
    log_info "  docker compose exec ollama ollama pull gemma3:12b"
fi

if echo "$MODELS" | grep -q "nomic-embed-text"; then
    log_success "nomic-embed-text インストール済み"
else
    log_warn "nomic-embed-text が見つかりません"
    log_info "以下のコマンドでダウンロードしてください:"
    log_info "  docker compose exec ollama ollama pull nomic-embed-text"
fi
echo ""

# 9. 完了メッセージ
log_success "============================================"
log_success "  アプリケーション起動完了！"
log_success "============================================"
echo ""
log_info "アクセス方法:"
echo "  - Nginx経由:     http://localhost"
echo "  - FastAPI直接:   http://localhost:8000"
echo "  - APIドキュメント: http://localhost:8000/docs"
echo ""
log_info "よく使うコマンド:"
echo "  - ログ確認:       docker compose logs -f"
echo "  - サービス停止:   docker compose down"
echo "  - サービス再起動: docker compose restart"
echo ""
log_info "ログをリアルタイム表示しますか？ (Ctrl+Cで終了)"
read -p "[y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose logs -f
fi
