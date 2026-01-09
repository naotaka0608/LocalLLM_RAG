"""
設定ファイル - すべてのハードコードされた値を一元管理
"""
import os


class RAGConfig:
    """RAGシステムの設定クラス"""

    # Ollama設定
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    DEFAULT_EMBEDDING_MODEL = "nomic-embed-text"

    # LLMデフォルトパラメータ
    DEFAULT_TEMPERATURE = 0.3
    DEFAULT_TOP_P = 0.9
    DEFAULT_REPEAT_PENALTY = 1.1

    # チャンク設定
    DEFAULT_CHUNK_SIZE = 1500
    DEFAULT_CHUNK_OVERLAP = 300

    # 検索設定
    DEFAULT_DOCUMENT_COUNT = 5  # 取得する関連文書数
    DEFAULT_SEARCH_MULTIPLIER = 10  # 検索範囲倍率（k * multiplier）
    HYBRID_SEARCH_VECTOR_WEIGHT = 0.5  # ベクトル検索の重み（0.0-1.0）

    # ChromaDB設定
    CHROMA_PERSIST_DIRECTORY = "../chroma_db"

    # 会話履歴設定
    CHAT_HISTORY_LIMIT = 10  # 保持する会話の往復数

    # ストリーミング設定
    STREAMING_TIMEOUT = 300.0  # 秒

    # トークン化設定（日本語）
    TOKENIZE_PATTERN = r'[一-龥ぁ-んァ-ヴー]+|[a-zA-Z0-9]+|[0-9]+(?:\.[0-9]+)?'

    # ファイルアップロード設定
    SUPPORTED_EXTENSIONS = {'.pdf', '.txt', '.md', '.csv'}
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    UPLOAD_DIRECTORY = "../uploads"

    # ログ設定
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT = "[%(levelname)s] %(name)s - %(message)s"


class PromptTemplates:
    """プロンプトテンプレート管理"""

    # 基本プロンプト（RAGあり）
    BASE_RAG_TEMPLATE = """あなたは親切で知識豊富なアシスタントです。以下のドキュメントから抽出された情報を使って、ユーザーの質問に答えてください。

参照ドキュメント:
{context}

質問: {question}

指示:
- 上記の参照ドキュメントに含まれる情報を最大限活用して、質問に対して詳しく丁寧に答えてください
- 直接的な答えが見つからない場合でも、関連する情報や類似の内容があれば、それを基に推論して回答してください
- ドキュメントに複数の関連情報がある場合は、それらを統合して包括的な回答を提供してください
- ドキュメント内の具体的な情報（数値、固有名詞、事実など）を積極的に引用してください
- どうしても関連する情報が全く見つからない場合のみ、その旨を伝えてください
- 回答は読みやすいように、適切に段落分けや改行を入れてください
- 複数の項目を説明する場合は、項目ごとに改行して見やすくしてください

回答:"""

    # 会話履歴付きプロンプト
    CHAT_HISTORY_TEMPLATE = """あなたは親切で知識豊富なアシスタントです。

以下は過去の会話履歴です：
{history}

参照ドキュメント:
{context}

質問: {question}

指示:
- 上記の参照ドキュメントに含まれる情報を最大限活用して、質問に対して詳しく丁寧に答えてください
- 会話の文脈を考慮し、自然な対話を心がけてください
- 直接的な答えが見つからない場合でも、関連する情報や類似の内容があれば、それを基に推論して回答してください
- ドキュメントに複数の関連情報がある場合は、それらを統合して包括的な回答を提供してください
- ドキュメント内の具体的な情報（数値、固有名詞、事実など）を積極的に引用してください
- どうしても関連する情報が全く見つからない場合のみ、その旨を伝えてください
- 回答は読みやすいように、適切に段落分けや改行を入れてください
- 複数の項目を説明する場合は、項目ごとに改行して見やすくしてください

回答:"""

    # RAGなしプロンプト
    SIMPLE_PROMPT_TEMPLATE = """あなたは親切で知識豊富なアシスタントです。以下の質問に答えてください。

質問: {question}

回答:"""

    # クエリ拡張プロンプト
    QUERY_EXPANSION_TEMPLATE = """質問: "{question}"

この質問に答えるために必要な関連キーワードや言い換えを3つ生成してください。
各キーワードは1行に1つずつ出力してください。
キーワードのみを出力し、説明は不要です。"""

    @staticmethod
    def build_prompt(context: str, question: str, chat_history: str = None) -> str:
        """プロンプトを構築

        Args:
            context: 参照ドキュメント
            question: ユーザーの質問
            chat_history: 会話履歴（オプション）

        Returns:
            構築されたプロンプト
        """
        if chat_history:
            return PromptTemplates.CHAT_HISTORY_TEMPLATE.format(
                history=chat_history,
                context=context,
                question=question
            )
        return PromptTemplates.BASE_RAG_TEMPLATE.format(
            context=context,
            question=question
        )

    @staticmethod
    def build_simple_prompt(question: str) -> str:
        """シンプルなプロンプトを構築（RAGなし）

        Args:
            question: ユーザーの質問

        Returns:
            構築されたプロンプト
        """
        return PromptTemplates.SIMPLE_PROMPT_TEMPLATE.format(question=question)

    @staticmethod
    def build_query_expansion_prompt(question: str) -> str:
        """クエリ拡張プロンプトを構築

        Args:
            question: 元の質問

        Returns:
            クエリ拡張用プロンプト
        """
        return PromptTemplates.QUERY_EXPANSION_TEMPLATE.format(question=question)
