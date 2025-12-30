"""
カスタム例外クラス - RAGシステム固有のエラーハンドリング
"""


class RAGException(Exception):
    """RAG操作の基底例外クラス"""
    pass


class DocumentLoadError(RAGException):
    """ドキュメントの読み込みに失敗した場合の例外"""
    pass


class DocumentNotFoundError(RAGException):
    """指定されたドキュメントが見つからない場合の例外"""
    pass


class SearchError(RAGException):
    """検索操作に失敗した場合の例外"""
    pass


class BM25IndexError(RAGException):
    """BM25インデックス操作に失敗した場合の例外"""
    pass


class OllamaConnectionError(RAGException):
    """Ollamaサーバーへの接続に失敗した場合の例外"""
    pass


class ModelNotFoundError(RAGException):
    """指定されたモデルが見つからない場合の例外"""
    pass


class VectorStoreError(RAGException):
    """ベクトルストア操作に失敗した場合の例外"""
    pass


class UnsupportedFileTypeError(RAGException):
    """サポートされていないファイル形式の場合の例外"""
    def __init__(self, file_extension: str, supported_extensions: set):
        self.file_extension = file_extension
        self.supported_extensions = supported_extensions
        message = (
            f"Unsupported file type: {file_extension}. "
            f"Supported types: {', '.join(sorted(supported_extensions))}"
        )
        super().__init__(message)


class QueryError(RAGException):
    """クエリ実行に失敗した場合の例外"""
    pass
