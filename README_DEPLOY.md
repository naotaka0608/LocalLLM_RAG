# LocalLLM RAG デプロイガイド

このガイドでは、Docker Composeを使用してUbuntu上にRAGシステムをデプロイする手順を説明します。

## 目次
- [前提条件](#前提条件)
- [インストール手順](#インストール手順)
- [起動と停止](#起動と停止)
- [設定のカスタマイズ](#設定のカスタマイズ)
- [トラブルシューティング](#トラブルシューティング)
- [本番環境向け設定](#本番環境向け設定)

---

## 前提条件

### 必須要件
- **OS**: Ubuntu 20.04 / 22.04 / 24.04
- **Docker**: 20.10以降
- **Docker Compose**: v2.0以降
- **メモリ**: 最低8GB（推奨16GB以上）
- **ストレージ**: 20GB以上の空き容量

### GPU使用時の追加要件
- **NVIDIA GPU**: CUDA対応GPU
- **NVIDIAドライバー**: 最新版
- **NVIDIA Container Toolkit**: インストール済み

---

## インストール手順

### 1. システムの準備

#### Dockerのインストール
```bash
# 古いバージョンを削除
sudo apt-get remove docker docker-engine docker.io containerd runc

# 必要なパッケージをインストール
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# DockerのGPGキーを追加
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Dockerリポジトリを追加
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Dockerをインストール
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Dockerサービスを有効化
sudo systemctl enable docker
sudo systemctl start docker

# ユーザーをdockerグループに追加（sudo不要にする）
sudo usermod -aG docker $USER
newgrp docker

# インストール確認
docker --version
docker compose version
```

#### NVIDIA Container Toolkit のインストール（GPU使用時）
```bash
# リポジトリを追加
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
    sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# NVIDIA Container Toolkitをインストール
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Dockerを再起動
sudo systemctl restart docker

# GPU動作確認
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

### 2. プロジェクトのセットアップ

```bash
# プロジェクトをクローンまたはコピー
cd /opt
sudo mkdir -p rag-system
sudo chown $USER:$USER rag-system
cd rag-system

# ファイルをコピー（例: scpやgitを使用）
# git clone <your-repo-url> .
# または
# scp -r user@source:/path/to/LocalLLM_RAG/* .

# 必要なディレクトリを作成
mkdir -p uploads chroma_db

# 権限設定
chmod 755 uploads chroma_db
```

### 3. 環境変数の設定（オプション）

`.env`ファイルを作成してカスタマイズできます：

```bash
cat > .env << 'EOF'
# Ollama設定
OLLAMA_BASE_URL=http://ollama:11434

# ログレベル
LOG_LEVEL=INFO

# その他の設定
PYTHONUNBUFFERED=1
EOF
```

---

## 起動と停止

### サービスの起動

```bash
# すべてのサービスを起動（バックグラウンド）
docker compose up -d

# ログを確認
docker compose logs -f

# 特定のサービスのログを確認
docker compose logs -f rag-app
docker compose logs -f ollama
```

### サービスの停止

```bash
# すべてのサービスを停止
docker compose down

# データを保持したまま停止
docker compose stop

# データも含めて完全削除
docker compose down -v
```

### サービスの再起動

```bash
# すべてのサービスを再起動
docker compose restart

# 特定のサービスのみ再起動
docker compose restart rag-app
```

### 状態確認

```bash
# 実行中のコンテナ確認
docker compose ps

# リソース使用状況
docker stats

# ヘルスチェック確認
docker compose ps --format json | jq '.[] | {name: .Name, health: .Health}'
```

---

## Ollamaモデルのダウンロード

### 初回セットアップ時

```bash
# Ollamaコンテナにアクセス
docker compose exec ollama bash

# モデルをダウンロード
ollama pull gemma3:12b
ollama pull nomic-embed-text

# ダウンロード済みモデル確認
ollama list

# コンテナから退出
exit
```

### ワンライナーで実行

```bash
# gemma3:12bをダウンロード
docker compose exec ollama ollama pull gemma3:12b

# nomic-embed-textをダウンロード
docker compose exec ollama ollama pull nomic-embed-text

# モデル一覧確認
docker compose exec ollama ollama list
```

---

## 設定のカスタマイズ

### 1. ポート番号の変更

`docker-compose.yml`を編集：

```yaml
services:
  rag-app:
    ports:
      - "8080:8000"  # ホスト側を8080に変更

  nginx:
    ports:
      - "8888:80"    # ホスト側を8888に変更
```

### 2. GPU設定の調整

特定のGPUのみ使用する場合：

```yaml
services:
  ollama:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']  # GPU 0のみ使用
              capabilities: [gpu]
```

### 3. CPU版での実行（GPU不要）

`docker-compose.yml`から`deploy`セクションを削除：

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    # deploy セクションを削除またはコメントアウト
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
```

### 4. メモリ制限の設定

```yaml
services:
  rag-app:
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

---

## アクセス方法

### ローカルアクセス

- **Nginx経由（推奨）**: http://localhost
- **FastAPI直接**: http://localhost:8000
- **APIドキュメント**: http://localhost:8000/docs

### リモートアクセス

サーバーのIPアドレスを使用：

- **Nginx経由**: http://<server-ip>
- **FastAPI直接**: http://<server-ip>:8000

---

## トラブルシューティング

### 1. GPUが認識されない

**問題**: OllamaがGPUを使用できない

```bash
# nvidia-smiが動作するか確認
nvidia-smi

# Docker内でGPU確認
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi

# NVIDIA Container Toolkitの再インストール
sudo apt-get install --reinstall nvidia-container-toolkit
sudo systemctl restart docker
```

### 2. ポートが使用中

**エラー**: `bind: address already in use`

```bash
# 使用中のポートを確認
sudo netstat -tulpn | grep :8000

# プロセスを終了
sudo kill -9 <PID>

# または、docker-compose.ymlでポートを変更
```

### 3. コンテナが起動しない

```bash
# ログを詳細に確認
docker compose logs --tail=100 rag-app

# コンテナを完全に削除して再作成
docker compose down -v
docker compose up -d --force-recreate
```

### 4. メモリ不足

```bash
# Dockerのメモリ使用状況確認
docker stats

# 不要なコンテナ・イメージを削除
docker system prune -a

# スワップを有効化（推奨されないが一時的対処）
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 5. ChromaDBの初期化

データベースが破損した場合：

```bash
# ChromaDBのデータを削除
docker compose down
sudo rm -rf chroma_db/*

# サービスを再起動
docker compose up -d
```

---

## 本番環境向け設定

### 1. HTTPS対応（Let's Encrypt）

```bash
# Certbotをインストール
sudo apt-get install certbot

# SSL証明書を取得
sudo certbot certonly --standalone -d your-domain.com

# nginx.confのHTTPS設定を有効化
# docker-compose.ymlでSSL証明書をマウント
```

`docker-compose.yml`に追加：

```yaml
services:
  nginx:
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

### 2. ログローテーション

`/etc/docker/daemon.json`を作成：

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Dockerを再起動：

```bash
sudo systemctl restart docker
```

### 3. 自動起動設定

```bash
# システム起動時に自動起動
docker compose up -d

# docker-compose.ymlで restart: unless-stopped が設定済み
```

### 4. バックアップスクリプト

`backup.sh`を作成：

```bash
#!/bin/bash
BACKUP_DIR="/backup/rag-system"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# ChromaDBをバックアップ
tar -czf $BACKUP_DIR/chroma_db_$DATE.tar.gz chroma_db/

# Ollamaモデルをバックアップ
docker compose exec ollama tar -czf /tmp/ollama_models.tar.gz /root/.ollama
docker cp rag-ollama:/tmp/ollama_models.tar.gz $BACKUP_DIR/ollama_models_$DATE.tar.gz

# 30日以上古いバックアップを削除
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

実行権限を付与：

```bash
chmod +x backup.sh
```

cronで定期実行：

```bash
# crontabを編集
crontab -e

# 毎日午前3時にバックアップ
0 3 * * * /opt/rag-system/backup.sh >> /var/log/rag-backup.log 2>&1
```

### 5. モニタリング

PrometheusとGrafanaを追加する場合、`docker-compose.yml`に：

```yaml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## パフォーマンスチューニング

### 1. Ollamaの並列処理設定

```yaml
services:
  ollama:
    environment:
      - OLLAMA_NUM_PARALLEL=2
      - OLLAMA_MAX_LOADED_MODELS=2
```

### 2. FastAPIのワーカー数調整

`Dockerfile`の最終行を変更：

```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 3. ChromaDBのチューニング

`config.py`で設定を調整：

```python
DEFAULT_CHUNK_SIZE = 1000  # より小さく
DEFAULT_CHUNK_OVERLAP = 200
```

---

## セキュリティ対策

### 1. ファイアウォール設定

```bash
# UFWをインストール
sudo apt-get install ufw

# 必要なポートのみ開放
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# ファイアウォールを有効化
sudo ufw enable
```

### 2. Docker Socketの保護

```bash
# docker.sockの権限を制限
sudo chmod 660 /var/run/docker.sock
```

### 3. APIレート制限

nginx.confに追加：

```nginx
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    server {
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            # ...
        }
    }
}
```

---

## アップデート手順

### アプリケーションの更新

```bash
# 最新のコードを取得
git pull origin main

# コンテナを再ビルド
docker compose build --no-cache

# サービスを再起動
docker compose up -d
```

### Ollamaモデルの更新

```bash
# モデルを更新
docker compose exec ollama ollama pull gemma3:12b

# サービスを再起動
docker compose restart ollama
```

---

## よくある質問（FAQ）

**Q: GPUなしでも動作しますか？**
A: はい、CPU版として動作します。ただし推論速度は大幅に遅くなります。

**Q: メモリはどれくらい必要ですか？**
A: 最低8GB、推奨16GB以上です。大きなモデル（gemma3:12b）を使用する場合は24GB以上推奨。

**Q: 複数のGPUを使用できますか？**
A: `count: all`の代わりに`device_ids: ['0', '1']`のように指定できます。

**Q: データの永続化はどうなっていますか？**
A: ChromaDB、アップロードファイル、Ollamaモデルはすべてボリュームに保存され、コンテナを削除しても保持されます。

---

## サポートとコミュニティ

問題が発生した場合は、以下を確認してください：

1. ログを確認: `docker compose logs -f`
2. GitHubのIssuesを検索
3. システムリソースを確認: `docker stats`

---

## ライセンス

このプロジェクトのライセンス情報については、READMEを参照してください。
