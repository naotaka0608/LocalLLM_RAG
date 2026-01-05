#!/bin/bash
# バックエンドサーバー起動スクリプト

cd "$(dirname "$0")"

# 仮想環境のアクティベート
if [ -f "../.venv/bin/activate" ]; then
    source ../.venv/bin/activate
elif [ -f "../.venv/Scripts/activate" ]; then
    source ../.venv/Scripts/activate
else
    echo "Error: Virtual environment not found at ../.venv"
    exit 1
fi

# FastAPIサーバーを起動
echo "Starting FastAPI server..."
python main.py
