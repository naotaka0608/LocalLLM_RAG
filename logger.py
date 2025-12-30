"""
ロギング設定 - アプリケーション全体で使用する統一されたロガー
"""
import logging
import sys
from config import RAGConfig


def setup_logger(name: str, level: str = None) -> logging.Logger:
    """
    ロガーをセットアップ

    Args:
        name: ロガー名（通常は __name__ を使用）
        level: ログレベル（DEBUG, INFO, WARNING, ERROR, CRITICAL）

    Returns:
        設定済みのロガー
    """
    logger = logging.getLogger(name)

    # レベル設定（環境変数または指定されたレベル、デフォルトはINFO）
    log_level = level or RAGConfig.LOG_LEVEL
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # すでにハンドラが設定されていれば追加しない
    if not logger.handlers:
        # コンソールハンドラ
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logger.level)

        # フォーマッタ
        formatter = logging.Formatter(RAGConfig.LOG_FORMAT)
        handler.setFormatter(formatter)

        logger.addHandler(handler)

    return logger


# アプリケーション全体で使用するデフォルトロガー
app_logger = setup_logger("rag_app")
