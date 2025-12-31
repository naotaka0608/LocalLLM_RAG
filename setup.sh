#!/bin/bash
#
# LocalLLM RAG 自動セットアップスクリプト
# Ubuntu 20.04/22.04/24.04対応
#
# 使い方:
#   chmod +x setup.sh
#   ./setup.sh
#

set -e  # エラーが発生したら停止

# 色付きログ用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# rootユーザーチェック
if [ "$EUID" -eq 0 ]; then
    log_error "このスクリプトはroot権限で実行しないでください"
    log_info "通常ユーザーで実行してください: ./setup.sh"
    exit 1
fi

log_info "============================================"
log_info "  LocalLLM RAG 自動セットアップ開始"
log_info "============================================"
echo ""

# 1. システム情報の表示
log_info "システム情報:"
echo "  OS: $(lsb_release -d | cut -f2)"
echo "  カーネル: $(uname -r)"
echo "  アーキテクチャ: $(uname -m)"
echo ""

# 2. GPU確認
log_info "GPU確認中..."
if command -v nvidia-smi &> /dev/null; then
    log_success "NVIDIA GPUが検出されました"
    nvidia-smi --query-gpu=name --format=csv,noheader
    USE_GPU=true
else
    log_warn "NVIDIA GPUが検出されませんでした（CPU版として動作します）"
    USE_GPU=false
fi
echo ""

# 3. 必要なパッケージのインストール
log_info "システムパッケージを更新中..."
sudo apt-get update -qq

log_info "必要なパッケージをインストール中..."
sudo apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    wget \
    jq

log_success "システムパッケージのインストール完了"
echo ""

# 4. Dockerのインストール確認
if command -v docker &> /dev/null; then
    log_info "Dockerは既にインストールされています: $(docker --version)"
else
    log_info "Dockerをインストール中..."

    # 古いバージョンを削除
    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    # DockerのGPGキーを追加
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    # Dockerリポジトリを追加
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Dockerをインストール
    sudo apt-get update -qq
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # Dockerサービスを有効化
    sudo systemctl enable docker
    sudo systemctl start docker

    log_success "Dockerのインストール完了: $(docker --version)"
fi
echo ""

# 5. ユーザーをdockerグループに追加
if groups $USER | grep -q docker; then
    log_info "ユーザーは既にdockerグループに所属しています"
else
    log_info "ユーザーをdockerグループに追加中..."
    sudo usermod -aG docker $USER
    log_warn "dockerグループへの追加が完了しました"
    log_warn "変更を反映するには、一度ログアウトして再ログインしてください"
    log_warn "または、以下のコマンドを実行してください: newgrp docker"
fi
echo ""

# 6. NVIDIA Container Toolkitのインストール（GPU使用時のみ）
if [ "$USE_GPU" = true ]; then
    if docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi &> /dev/null; then
        log_info "NVIDIA Container Toolkitは既にインストールされています"
    else
        log_info "NVIDIA Container Toolkitをインストール中..."

        # リポジトリを追加
        distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
        curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
        curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

        # NVIDIA Container Toolkitをインストール
        sudo apt-get update -qq
        sudo apt-get install -y nvidia-container-toolkit

        # Dockerを再起動
        sudo systemctl restart docker

        log_success "NVIDIA Container Toolkitのインストール完了"

        # GPU動作確認
        log_info "GPU動作確認中..."
        if docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi &> /dev/null; then
            log_success "GPUがDockerで正常に動作しています"
        else
            log_error "GPUの動作確認に失敗しました"
            exit 1
        fi
    fi
    echo ""
fi

# 7. プロジェクトディレクトリの設定
INSTALL_DIR="/opt/rag-system"
CURRENT_DIR=$(pwd)

log_info "インストール先: $INSTALL_DIR"

if [ "$CURRENT_DIR" != "$INSTALL_DIR" ]; then
    log_info "プロジェクトディレクトリを作成中..."
    sudo mkdir -p $INSTALL_DIR
    sudo chown $USER:$USER $INSTALL_DIR

    log_info "ファイルをコピー中..."
    cp -r * $INSTALL_DIR/

    log_info "作業ディレクトリを変更: $INSTALL_DIR"
    cd $INSTALL_DIR
else
    log_info "既に正しいディレクトリにいます"
fi
echo ""

# 8. 必要なディレクトリを作成
log_info "必要なディレクトリを作成中..."
mkdir -p uploads chroma_db
chmod 755 uploads chroma_db
log_success "ディレクトリ作成完了"
echo ""

# 9. 環境変数ファイルの作成（存在しない場合）
if [ ! -f .env ]; then
    log_info ".envファイルを作成中..."
    cat > .env << 'EOF'
# Ollama設定
OLLAMA_BASE_URL=http://ollama:11434

# ログレベル
LOG_LEVEL=INFO

# その他の設定
PYTHONUNBUFFERED=1
EOF
    log_success ".envファイル作成完了"
else
    log_info ".envファイルは既に存在します"
fi
echo ""

# 10. Dockerイメージのビルド
log_info "Dockerイメージをビルド中..."
docker compose build
log_success "Dockerイメージのビルド完了"
echo ""

# 11. サービスの起動
log_info "サービスを起動中..."
docker compose up -d
log_success "サービス起動完了"
echo ""

# 12. サービスの状態確認
log_info "サービスの状態を確認中..."
sleep 5
docker compose ps
echo ""

# 13. Ollamaモデルのダウンロード確認
log_info "Ollamaコンテナの準備を待機中..."
sleep 10

log_info "利用可能なモデルを確認中..."
MODELS=$(docker compose exec -T ollama ollama list 2>/dev/null || echo "")

if echo "$MODELS" | grep -q "gemma3:12b"; then
    log_info "gemma3:12bは既にダウンロード済みです"
else
    log_warn "gemma3:12bがダウンロードされていません"
    read -p "今すぐダウンロードしますか？ (約7GB) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "gemma3:12bをダウンロード中... (数分かかります)"
        docker compose exec -T ollama ollama pull gemma3:12b
        log_success "gemma3:12bのダウンロード完了"
    else
        log_warn "スキップしました。後で手動でダウンロードしてください:"
        log_warn "  docker compose exec ollama ollama pull gemma3:12b"
    fi
fi
echo ""

if echo "$MODELS" | grep -q "nomic-embed-text"; then
    log_info "nomic-embed-textは既にダウンロード済みです"
else
    log_warn "nomic-embed-textがダウンロードされていません"
    read -p "今すぐダウンロードしますか？ (約274MB) [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "nomic-embed-textをダウンロード中..."
        docker compose exec -T ollama ollama pull nomic-embed-text
        log_success "nomic-embed-textのダウンロード完了"
    else
        log_warn "スキップしました。後で手動でダウンロードしてください:"
        log_warn "  docker compose exec ollama ollama pull nomic-embed-text"
    fi
fi
echo ""

# 14. ヘルスチェック
log_info "アプリケーションのヘルスチェック中..."
sleep 5

if curl -f http://localhost:8000/health &> /dev/null; then
    log_success "FastAPIサーバーが正常に動作しています"
else
    log_error "FastAPIサーバーへの接続に失敗しました"
    log_info "ログを確認してください: docker compose logs rag-app"
fi
echo ""

# 15. 完了メッセージ
log_success "============================================"
log_success "  セットアップが完了しました！"
log_success "============================================"
echo ""
log_info "アクセス方法:"
echo "  - Nginx経由:     http://localhost"
echo "  - FastAPI直接:   http://localhost:8000"
echo "  - APIドキュメント: http://localhost:8000/docs"
echo ""
log_info "よく使うコマンド:"
echo "  - サービス起動:   docker compose up -d"
echo "  - サービス停止:   docker compose down"
echo "  - ログ確認:       docker compose logs -f"
echo "  - モデル確認:     docker compose exec ollama ollama list"
echo ""
log_info "詳細なドキュメント: README_DEPLOY.md"
echo ""

if ! groups $USER | grep -q docker; then
    log_warn "重要: dockerグループへの追加を反映するため、以下を実行してください:"
    log_warn "  1. ログアウトして再ログイン"
    log_warn "  または"
    log_warn "  2. 以下のコマンドを実行: newgrp docker"
fi
