#!/bin/bash
#
# Docker + NVIDIA Container Toolkit インストールスクリプト
# 既にDockerがインストールされている場合はスキップされます
#
# 使い方:
#   chmod +x docker-install.sh
#   ./docker-install.sh
#

set -e

# 色付きログ
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "Docker環境セットアップ開始"
echo ""

# 1. Dockerのインストール
if command -v docker &> /dev/null; then
    log_info "Docker既にインストール済み: $(docker --version)"
else
    log_info "Dockerをインストール中..."

    sudo apt-get update -qq
    sudo apt-get install -y ca-certificates curl gnupg lsb-release

    sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -qq
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    sudo systemctl enable docker
    sudo systemctl start docker

    log_success "Dockerインストール完了"
fi
echo ""

# 2. dockerグループに追加
if groups $USER | grep -q docker; then
    log_info "既にdockerグループに所属しています"
else
    log_info "ユーザーをdockerグループに追加中..."
    sudo usermod -aG docker $USER
    log_warn "ログアウトして再ログインするか、'newgrp docker'を実行してください"
fi
echo ""

# 3. NVIDIA Container Toolkit（GPU検出時のみ）
if command -v nvidia-smi &> /dev/null; then
    log_info "NVIDIA GPUを検出しました"

    if docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi &> /dev/null 2>&1; then
        log_info "NVIDIA Container Toolkit既にインストール済み"
    else
        log_info "NVIDIA Container Toolkitをインストール中..."

        distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
        curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
        curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

        sudo apt-get update -qq
        sudo apt-get install -y nvidia-container-toolkit
        sudo systemctl restart docker

        log_success "NVIDIA Container Toolkitインストール完了"
    fi
else
    log_warn "NVIDIA GPUが検出されませんでした（CPU版として動作します）"
fi
echo ""

log_success "Docker環境のセットアップ完了！"
docker --version
docker compose version
