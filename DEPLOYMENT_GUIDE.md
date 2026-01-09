



# Vultr Ubuntu 24.04 デプロイメントガイド

このガイドでは、VultrでUbuntu 24.04サーバーを借りてから、LocalLLM RAGシステムをデプロイするまでの手順を説明します。

## 📋 前提条件

- Vultrアカウント
- Ubuntu 24.04 LTSサーバー（推奨スペック: 16GB RAM以上、4 CPU以上、GPU利用可能な場合はGPUインスタンス）
- ドメイン名（SSL証明書用、オプション）
- ローカルマシンにSSHクライアント

---

## 🚀 ステップ1: サーバーの初期設定

### 1.1 SSHでサーバーに接続

```bash
ssh root@your-server-ip
```

### 1.2 システムのアップデート

```bash
# パッケージリストを更新
apt update && apt upgrade -y

# 再起動が必要な場合
reboot
```

### 1.3 タイムゾーンの設定

```bash
timedatectl set-timezone Asia/Tokyo
```

### 1.4 新しいユーザーの作成（セキュリティ強化）

```bash
# 新しいユーザーを作成
adduser deploy
# sudo権限を付与
usermod -aG sudo deploy

# SSHディレクトリをセットアップ
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 1.5 SSHセキュリティ強化

```bash
# SSH設定を編集
nano /etc/ssh/sshd_config
```

以下の設定を変更:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222  # デフォルトポートから変更（任意）
```

```bash
# SSHサービスを再起動
systemctl restart sshd
```

**注意**: この後は `deploy` ユーザーでログインします:
```bash
ssh -p 2222 deploy@your-server-ip
```

---

## 🔒 ステップ2: ファイアウォール設定

### 2.1 UFWのインストールと設定

```bash
# UFWをインストール
sudo apt install ufw -y

# デフォルトポリシー
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 必要なポートを開放
sudo ufw allow 2222/tcp    # SSH（変更したポート番号）
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS

# UFWを有効化
sudo ufw enable

# 状態確認
sudo ufw status verbose
```

### 2.2 Fail2Banのインストール

```bash
# Fail2Banをインストール
sudo apt install fail2ban -y

# 設定ファイルを作成
sudo nano /etc/fail2ban/jail.local
```

以下の内容を追加:
```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
destemail = your-email@example.com
sendername = Fail2Ban
action = %(action_mwl)s

[sshd]
enabled = true
port = 2222
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
```

```bash
# Fail2Banを起動
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 状態確認
sudo fail2ban-client status
```

---

## 🐳 ステップ3: Dockerのインストール

### 3.1 Dockerのインストール

```bash
# 古いバージョンを削除
sudo apt remove docker docker-engine docker.io containerd runc

# 必要なパッケージをインストール
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# Docker公式GPGキーを追加
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Dockerリポジトリを追加
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Dockerをインストール
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ユーザーをdockerグループに追加
sudo usermod -aG docker $USER

# 一度ログアウトして再ログイン
exit
# 再接続後、Dockerが動作するか確認
docker --version
docker compose version
```

### 3.2 NVIDIA Docker（GPU使用の場合のみ）

```bash
# NVIDIA Dockerをインストール
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt update
sudo apt install -y nvidia-docker2
sudo systemctl restart docker

# テスト
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

---

## 📦 ステップ4: アプリケーションのデプロイ

### 4.1 プロジェクトファイルの転送

**ローカルマシンで実行**:
```bash
# プロジェクトディレクトリに移動
cd LocalLLM_RAG

# サーバーに転送（SCPまたはrsync）
rsync -avz -e "ssh -p 2222" \
  --exclude '.venv' \
  --exclude 'node_modules' \
  --exclude 'chroma_db' \
  --exclude 'uploads' \
  --exclude '.git' \
  . deploy@your-server-ip:/home/deploy/LocalLLM_RAG
```

### 4.2 環境変数の設定

**サーバーで実行**:
```bash
cd /home/deploy/LocalLLM_RAG

# .envファイルを作成
nano backend/.env
```

以下の内容を追加:
```env
ENVIRONMENT=production
LOG_LEVEL=WARNING
OLLAMA_BASE_URL=http://ollama:11434
```

### 4.3 Nginxの設定をカスタマイズ

```bash
# nginx-prod.confを編集
nano nginx-prod.conf
```

以下の箇所を変更:
- 74行目: `server_name yourdomain.com www.yourdomain.com;` を実際のドメインに変更
- ドメインがない場合は `server_name _;` に変更

### 4.4 SSL証明書の取得（ドメインがある場合）

```bash
# Certbotをインストール
sudo apt install certbot python3-certbot-nginx -y

# SSL証明書ディレクトリを作成
mkdir -p ssl

# 一時的にNginxなしで証明書を取得
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 証明書をコピー
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/
sudo chown $USER:$USER ./ssl/*.pem
```

**ドメインがない場合**: 自己署名証明書を作成
```bash
mkdir -p ssl
cd ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout privkey.pem -out fullchain.pem \
  -subj "/C=JP/ST=Tokyo/L=Tokyo/O=LocalLLM/CN=localhost"
cd ..
```

---

## 🏗️ ステップ5: Dockerコンテナの起動

### 5.1 Ollamaモデルのダウンロード（事前準備）

```bash
# Ollamaコンテナを単独で起動してモデルをダウンロード
docker compose up -d ollama

# モデルをダウンロード（必要なモデルすべて）
docker compose exec ollama ollama pull llama3.2:latest
docker compose exec ollama ollama pull elyza:jp8b

# 確認
docker compose exec ollama ollama list

# 一旦停止
docker compose down
```

### 5.2 全サービスの起動

```bash
# バックグラウンドで起動
docker compose up -d

# ログを確認
docker compose logs -f

# 各サービスの状態確認
docker compose ps
```

### 5.3 ヘルスチェック

```bash
# バックエンドAPIの確認
curl http://localhost:8000/tags

# フロントエンドの確認
curl http://localhost:5173

# Nginxの確認
curl http://localhost/health
```

---

## 🔍 ステップ6: 動作確認

### 6.1 ブラウザでアクセス

- HTTP: `http://your-server-ip`
- HTTPS: `https://yourdomain.com`（証明書設定済みの場合）

### 6.2 APIエンドポイントのテスト

```bash
# タグ一覧
curl http://localhost:8000/tags

# モデル一覧
curl http://localhost:8000/models

# ドキュメント一覧
curl http://localhost:8000/documents/details
```

---

## 🔧 ステップ7: 運用管理

### 7.1 ログの確認

```bash
# すべてのログ
docker compose logs -f

# 特定のサービス
docker compose logs -f rag-backend
docker compose logs -f nginx

# Nginxアクセスログ
docker compose exec nginx tail -f /var/log/nginx/access.log
```

### 7.2 サービスの再起動

```bash
# すべてのサービスを再起動
docker compose restart

# 特定のサービスのみ
docker compose restart rag-backend
docker compose restart nginx
```

### 7.3 アップデート

```bash
# コードを更新（ローカルで変更後、rsyncで転送）
rsync -avz -e "ssh -p 2222" \
  --exclude '.venv' \
  --exclude 'node_modules' \
  . deploy@your-server-ip:/home/deploy/LocalLLM_RAG

# サーバーで再ビルド・再起動
cd /home/deploy/LocalLLM_RAG
docker compose down
docker compose build
docker compose up -d
```

### 7.4 バックアップ

```bash
# データボリュームのバックアップ
docker run --rm \
  -v localllm_rag_chroma-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/chroma-backup-$(date +%Y%m%d).tar.gz -C /data .

docker run --rm \
  -v localllm_rag_uploads-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/uploads-backup-$(date +%Y%m%d).tar.gz -C /data .

# リストア
docker run --rm \
  -v localllm_rag_chroma-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/chroma-backup-YYYYMMDD.tar.gz -C /data
```

### 7.5 自動起動の設定

```bash
# システム起動時にDockerコンテナを自動起動
# docker-compose.ymlで restart: unless-stopped が設定済みなので、
# Dockerサービスが起動していれば自動的にコンテナも起動します

# Dockerサービスの自動起動を確認
sudo systemctl is-enabled docker
```

---

## 📊 ステップ8: モニタリング

### 8.1 リソース使用状況の確認

```bash
# コンテナのリソース使用状況
docker stats

# ディスク使用状況
df -h
docker system df
```

### 8.2 Fail2Banの状態確認

```bash
# 全体の状態
sudo fail2ban-client status

# SSH jailの状態
sudo fail2ban-client status sshd

# BANされたIPを確認
sudo fail2ban-client get sshd banned
```

---

## 🛡️ セキュリティチェックリスト

- [ ] rootログイン無効化
- [ ] パスワード認証無効化
- [ ] SSH鍵認証のみ有効
- [ ] SSHポート番号変更（任意）
- [ ] UFWファイアウォール有効化
- [ ] Fail2Ban設定完了
- [ ] SSL/TLS証明書設定（本番環境）
- [ ] 定期的なセキュリティアップデート
- [ ] ログモニタリング設定
- [ ] バックアップ体制確立

---

## 🐛 トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker compose logs

# 特定のサービスのログ
docker compose logs rag-backend

# コンテナの状態
docker compose ps
```

### ポートが使用中

```bash
# ポート使用状況を確認
sudo netstat -tulpn | grep :8000
sudo netstat -tulpn | grep :80

# プロセスを停止
sudo kill -9 <PID>
```

### Ollamaモデルがダウンロードできない

```bash
# Ollamaコンテナに入る
docker compose exec ollama bash

# 手動でダウンロード
ollama pull llama3.2:latest

# ディスク容量を確認
df -h
```

### SSL証明書エラー

```bash
# 証明書の確認
openssl x509 -in ssl/fullchain.pem -text -noout

# 証明書の更新
sudo certbot renew
sudo cp /etc/letsencrypt/live/yourdomain.com/*.pem ./ssl/
docker compose restart nginx
```

### メモリ不足

```bash
# メモリ使用状況
free -h

# スワップを追加
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📞 サポート

問題が発生した場合:
1. ログを確認: `docker compose logs -f`
2. コンテナの状態を確認: `docker compose ps`
3. リソースを確認: `docker stats`
4. GitHubのIssueで報告

---

## 🔄 アップデート手順

新しいバージョンがリリースされた場合:

```bash
# ローカルで最新コードを取得
git pull origin main

# サーバーに転送
rsync -avz -e "ssh -p 2222" \
  --exclude '.venv' \
  --exclude 'node_modules' \
  . deploy@your-server-ip:/home/deploy/LocalLLM_RAG

# サーバーで再デプロイ
ssh -p 2222 deploy@your-server-ip
cd /home/deploy/LocalLLM_RAG
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

**これで、LocalLLM RAGシステムの本番環境へのデプロイが完了です！** 🎉
