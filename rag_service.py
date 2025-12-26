import os
from typing import List, Tuple
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    CSVLoader,
    UnstructuredMarkdownLoader
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough


class RAGService:
    def __init__(
        self,
        model_name: str = None,
        embedding_model: str = "nomic-embed-text",
        persist_directory: str = "./chroma_db"
    ):
        """
        RAGサービスの初期化

        Args:
            model_name: Ollamaで使用するLLMモデル名（Noneの場合は利用可能な最初のモデルを使用）
            embedding_model: Ollamaで使用する埋め込みモデル名
            persist_directory: ChromaDBの永続化ディレクトリ
        """
        # model_nameがNoneの場合、利用可能なモデルの最初のものを使用
        if model_name is None:
            available_models = self._get_available_models_static()
            if available_models:
                model_name = available_models[0]
                print(f"[INFO] Using first available model: {model_name}")
            else:
                # フォールバック: モデルが見つからない場合
                model_name = "gemma3:12b"
                print(f"[WARNING] No models found, using fallback: {model_name}")

        self.model_name = model_name
        self.embedding_model = embedding_model
        self.persist_directory = persist_directory

        # Embeddings
        self.embeddings = OllamaEmbeddings(
            model=self.embedding_model,
            base_url="http://localhost:11434"
        )

        # Vector Store
        self.vectorstore = Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings
        )

        # LLM（temperature低めで高速化と一貫性向上）
        self.llm = Ollama(
            model=self.model_name,
            base_url="http://localhost:11434",
            temperature=0.3
        )

        # Text Splitter（より大きなチャンクでコンテキストを保持）
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=300,
            length_function=len
        )

        # プロンプトテンプレート
        self.prompt_template = """あなたは親切で知識豊富なアシスタントです。以下のドキュメントから抽出された情報を使って、ユーザーの質問に答えてください。

参照ドキュメント:
{context}

質問: {question}

指示:
- 上記の参照ドキュメントに含まれる情報を最大限活用して、質問に対して詳しく丁寧に答えてください
- 直接的な答えが見つからない場合でも、関連する情報や類似の内容があれば、それを基に推論して回答してください
- ドキュメントに複数の関連情報がある場合は、それらを統合して包括的な回答を提供してください
- ドキュメント内の具体的な情報（数値、固有名詞、事実など）を積極的に引用してください
- どうしても関連する情報が全く見つからない場合のみ、その旨を伝えてください

回答:"""

        self.prompt = PromptTemplate(
            template=self.prompt_template,
            input_variables=["context", "question"]
        )

    def add_documents(self, file_path: str) -> None:
        """
        ファイルを読み込んでベクトルストアに追加
        対応フォーマット: PDF, TXT, MD, CSV

        Args:
            file_path: ファイルのパス
        """
        # ファイル拡張子に応じてローダーを選択
        file_extension = os.path.splitext(file_path)[1].lower()

        if file_extension == '.pdf':
            loader = PyPDFLoader(file_path)
        elif file_extension == '.txt':
            loader = TextLoader(file_path, encoding='utf-8')
        elif file_extension == '.md':
            loader = UnstructuredMarkdownLoader(file_path)
        elif file_extension == '.csv':
            loader = CSVLoader(file_path, encoding='utf-8')
        else:
            raise ValueError(f"サポートされていないファイル形式です: {file_extension}")

        # ドキュメントの読み込み
        documents = loader.load()

        # テキストの分割
        splits = self.text_splitter.split_documents(documents)

        # メタデータにファイル名を追加
        for split in splits:
            split.metadata["source_file"] = os.path.basename(file_path)

        # ベクトルストアに追加
        print(f"[DEBUG] Adding {len(splits)} document chunks to vector store...")
        self.vectorstore.add_documents(splits)

        # 永続化
        try:
            self.vectorstore.persist()
            print(f"[DEBUG] Documents persisted successfully")
        except Exception as e:
            print(f"[DEBUG] Error persisting documents: {e}")

        # 追加後のドキュメント数を確認
        try:
            total_docs = len(self.vectorstore.get()['ids'])
            print(f"[DEBUG] Total documents in store: {total_docs}")
        except Exception as e:
            print(f"[DEBUG] Error counting documents: {e}")

    def _expand_query(self, question: str) -> List[str]:
        """
        クエリを拡張して関連するキーワードを生成

        Args:
            question: 元の質問

        Returns:
            拡張されたクエリのリスト
        """
        expansion_prompt = f"""質問: "{question}"

この質問に答えるために必要な関連キーワードや言い換えを3つ生成してください。
各キーワードは1行に1つずつ出力してください。
キーワードのみを出力し、説明は不要です。"""

        try:
            print("[DEBUG] Expanding query...")
            expanded = self.llm.invoke(expansion_prompt)
            # 改行で分割してクリーンアップ
            keywords = [line.strip() for line in expanded.split('\n') if line.strip() and not line.strip().startswith('#')]
            # 元の質問を先頭に追加
            keywords.insert(0, question)
            print(f"[DEBUG] Expanded queries: {keywords}")
            return keywords[:4]  # 最大4つまで(元の質問+3つ)
        except Exception as e:
            print(f"[DEBUG] Query expansion failed: {e}, using original question only")
            return [question]

    def _create_ollama_instance(self, model_name: str = None, **kwargs):
        """Ollamaインスタンスを作成するヘルパーメソッド"""
        # デフォルト値を設定
        params = {
            "model": model_name or self.model_name,
            "base_url": "http://localhost:11434",
            "temperature": kwargs.get("temperature", 0.3),
            "top_p": kwargs.get("top_p", 0.9),
            "repeat_penalty": kwargs.get("repeat_penalty", 1.1),
        }

        # オプショナルパラメータを追加（Noneでない場合のみ）
        optional_params = ["num_predict", "top_k", "num_ctx", "seed",
                          "mirostat", "mirostat_tau", "mirostat_eta", "tfs_z"]
        for param in optional_params:
            if param in kwargs and kwargs[param] is not None:
                params[param] = kwargs[param]

        return Ollama(**params)

    def query(self, question: str, k: int = 5, model_name: str = None, use_rag: bool = True, enable_query_expansion: bool = False,
              temperature: float = None, top_p: float = None, repeat_penalty: float = None,
              num_predict: int = None, top_k: int = None, num_ctx: int = None, seed: int = None,
              mirostat: int = None, mirostat_tau: float = None, mirostat_eta: float = None, tfs_z: float = None) -> Tuple[str, List[str], List[dict]]:
        """
        質問に対してRAGで回答を生成

        Args:
            question: 質問文
            k: 最終的に使用する関連文書の数（デフォルト: 5）
            model_name: 使用するモデル名（Noneの場合はデフォルトモデルを使用）
            use_rag: RAGを使用するか（Falseの場合は直接LLMに質問）
            enable_query_expansion: クエリ拡張を有効にするか（デフォルト: False）
            temperature: LLMの温度パラメータ（Noneの場合はデフォルト0.3を使用）
            top_p: Nucleus samplingパラメータ（Noneの場合はデフォルト0.9を使用）
            repeat_penalty: 繰り返しペナルティ（Noneの場合はデフォルト1.1を使用）

        Returns:
            回答、参照元、スコア情報のタプル
        """
        print(f"[DEBUG] Query received: {question}")
        print(f"[DEBUG] Model: {model_name if model_name else f'default ({self.model_name})'}")
        print(f"[DEBUG] Use RAG: {use_rag}")
        print(f"[DEBUG] Query expansion: {enable_query_expansion}")

        # クエリ拡張
        queries = self._expand_query(question) if enable_query_expansion else [question]

        # 各クエリで検索を実行し、スコア付きでドキュメントを取得
        # より多くのドキュメントを取得してフィルタリング
        initial_k = k * 2  # 最終的に必要な数の2倍を取得（高速化のため3倍→2倍に削減）
        all_docs_with_scores = []
        seen_content = set()  # 重複排除用

        for query in queries:
            try:
                docs_with_scores = self.vectorstore.similarity_search_with_score(query, k=initial_k)

                for doc, score in docs_with_scores:
                    # 重複チェック(同じ内容のドキュメントを排除)
                    content_hash = hash(doc.page_content[:200])  # 最初の200文字でハッシュ化
                    if content_hash not in seen_content:
                        seen_content.add(content_hash)
                        all_docs_with_scores.append((doc, score))
            except Exception as e:
                print(f"[DEBUG] Error searching with query '{query}': {e}")

        # パラメータをまとめる
        llm_params = {
            "temperature": temperature, "top_p": top_p, "repeat_penalty": repeat_penalty,
            "num_predict": num_predict, "top_k": top_k, "num_ctx": num_ctx,
            "seed": seed, "mirostat": mirostat, "mirostat_tau": mirostat_tau,
            "mirostat_eta": mirostat_eta, "tfs_z": tfs_z
        }

        if len(all_docs_with_scores) == 0:
            print("[DEBUG] No documents found in vector store. Responding without RAG context.")
            # ドキュメントがない場合は、RAGなしでLLMに直接質問
            llm = self._create_ollama_instance(model_name, **llm_params)

            # RAGなしのプロンプト
            simple_prompt = f"""あなたは親切で知識豊富なアシスタントです。以下の質問に答えてください。

質問: {question}

回答:"""

            answer = llm.invoke(simple_prompt)
            return answer, [], []

        # スコアでソート(ChromaDBの場合、スコアが小さいほど類似度が高い)して上位k件を選択
        all_docs_with_scores.sort(key=lambda x: x[1])
        top_docs_with_scores = all_docs_with_scores[:k]
        top_docs = [doc for doc, _score in top_docs_with_scores]

        # コンテキストの構築
        context = "\n\n".join([doc.page_content for doc in top_docs])

        # プロンプトの構築
        prompt_text = self.prompt.format(context=context, question=question)

        # モデルの選択
        llm = self._create_ollama_instance(model_name, **llm_params)

        # 回答の生成
        answer = llm.invoke(prompt_text)

        # 参照元の抽出とスコア情報の作成
        sources = []
        source_scores = []
        for doc, score in top_docs_with_scores:
            source = doc.metadata.get("source_file", "Unknown")
            page = doc.metadata.get("page", "Unknown")
            source_str = f"{source} (Page {page})"
            sources.append(source_str)

            # スコアを0-1の範囲に正規化（ChromaDBのスコアは距離なので、小さいほど良い）
            # 0に近いほど関連度が高いので、1 - (score / max_score)で正規化
            normalized_score = max(0, min(1, 1 - (score / 2)))
            source_scores.append({"source": source_str, "score": round(normalized_score, 3)})

        return answer, list(set(sources)), source_scores

    async def query_stream(self, question: str, k: int = 5, model_name: str = None, use_rag: bool = True, enable_query_expansion: bool = False,
                          temperature: float = None, top_p: float = None, repeat_penalty: float = None,
                          num_predict: int = None, top_k: int = None, num_ctx: int = None, seed: int = None,
                          mirostat: int = None, mirostat_tau: float = None, mirostat_eta: float = None, tfs_z: float = None):
        """
        質問に対してRAGで回答を生成（ストリーミング）

        Args:
            question: 質問文
            k: 取得する関連文書の数（デフォルト: 5）
            model_name: 使用するモデル名（Noneの場合はデフォルトモデルを使用）
            use_rag: RAGを使用するか（Falseの場合は直接LLMに質問）
            enable_query_expansion: クエリ拡張を有効にするか（デフォルト: False）
            temperature: LLMの温度パラメータ（Noneの場合はデフォルト0.3を使用）
            top_p: Nucleus samplingパラメータ（Noneの場合はデフォルト0.9を使用）
            repeat_penalty: 繰り返しペナルティ（Noneの場合はデフォルト1.1を使用）

        Yields:
            回答のチャンク
        """
        print(f"[DEBUG] Stream query received: {question}")
        print(f"[DEBUG] Use RAG: {use_rag}")
        print(f"[DEBUG] Query expansion: {enable_query_expansion}")

        # パラメータをまとめる
        llm_params = {
            "temperature": temperature, "top_p": top_p, "repeat_penalty": repeat_penalty,
            "num_predict": num_predict, "top_k": top_k, "num_ctx": num_ctx,
            "seed": seed, "mirostat": mirostat, "mirostat_tau": mirostat_tau,
            "mirostat_eta": mirostat_eta, "tfs_z": tfs_z
        }

        # RAG OFF の場合は直接LLMに質問
        if not use_rag:
            print("[DEBUG] RAG is disabled. Querying LLM directly without document context.")
            llm = self._create_ollama_instance(model_name, **llm_params)

            simple_prompt = f"""あなたは親切で知識豊富なアシスタントです。以下の質問に答えてください。

質問: {question}

回答:"""

            for chunk in llm.stream(simple_prompt):
                yield chunk
            return

        # クエリ拡張
        queries = self._expand_query(question) if enable_query_expansion else [question]

        # 各クエリで検索を実行
        all_docs_with_scores = []
        seen_content = set()

        for query in queries:
            try:
                docs_with_scores = self.vectorstore.similarity_search_with_score(query, k=k * 2)
                for doc, score in docs_with_scores:
                    content_hash = hash(doc.page_content[:200])
                    if content_hash not in seen_content:
                        seen_content.add(content_hash)
                        all_docs_with_scores.append((doc, score))
            except Exception as e:
                print(f"[DEBUG] Error searching with query '{query}': {e}")

        # パラメータをまとめる
        llm_params = {
            "temperature": temperature, "top_p": top_p, "repeat_penalty": repeat_penalty,
            "num_predict": num_predict, "top_k": top_k, "num_ctx": num_ctx,
            "seed": seed, "mirostat": mirostat, "mirostat_tau": mirostat_tau,
            "mirostat_eta": mirostat_eta, "tfs_z": tfs_z
        }

        # モデルの選択
        llm = self._create_ollama_instance(model_name, **llm_params)

        # ドキュメントがない場合
        if len(all_docs_with_scores) == 0:
            simple_prompt = f"""あなたは親切で知識豊富なアシスタントです。以下の質問に答えてください。

質問: {question}

回答:"""
            for chunk in llm.stream(simple_prompt):
                yield chunk
            return

        # スコアでソートして上位を選択
        all_docs_with_scores.sort(key=lambda x: x[1])
        top_docs_with_scores = all_docs_with_scores[:k]

        # コンテキストの構築
        context = "\n\n".join([doc.page_content for doc, _score in top_docs_with_scores])

        # プロンプトの構築
        prompt_text = self.prompt.format(context=context, question=question)

        # ストリーミング生成
        for chunk in llm.stream(prompt_text):
            yield chunk

        # 参照元の抽出とスコア情報の作成（ストリーミング終了後に送信）
        import json
        sources = []
        source_scores = []
        for doc, score in top_docs_with_scores:
            source = doc.metadata.get("source_file", "Unknown")
            page = doc.metadata.get("page", "Unknown")
            source_str = f"{source} (Page {page})"
            sources.append(source_str)

            # スコアを0-1の範囲に正規化
            normalized_score = max(0, min(1, 1 - (score / 2)))
            source_scores.append({"source": source_str, "score": round(normalized_score, 3)})

        # 参照元情報を最後に送信（特別なマーカーで識別）
        source_data = {
            "sources": list(set(sources)),
            "source_scores": source_scores
        }
        yield f"\n__SOURCES__:{json.dumps(source_data, ensure_ascii=False)}"

    def list_documents(self) -> List[str]:
        """
        登録されているドキュメントの一覧を取得

        Returns:
            ドキュメント名のリスト
        """
        try:
            collection = self.vectorstore.get()
            print(f"[DEBUG] Collection data: {collection}")  # デバッグ用

            if not collection or "metadatas" not in collection or not collection["metadatas"]:
                print("[DEBUG] No documents in collection")
                return []

            sources = set()
            for metadata in collection["metadatas"]:
                if metadata and "source_file" in metadata:
                    sources.add(metadata["source_file"])

            print(f"[DEBUG] Found documents: {list(sources)}")
            return sorted(list(sources))
        except Exception as e:
            print(f"[DEBUG] Error in list_documents: {e}")
            return []

    def clear_documents(self) -> None:
        """
        すべてのドキュメントをクリア
        """
        import shutil
        import time
        import gc

        print("[DEBUG] Clearing all documents...")

        try:
            # 既存のベクトルストアへの参照を解放
            if self.vectorstore is not None:
                try:
                    # コレクションを明示的にクリア
                    collection = self.vectorstore._collection
                    if collection:
                        # すべてのIDを取得して削除
                        all_ids = collection.get()['ids']
                        if all_ids:
                            collection.delete(ids=all_ids)
                            print(f"[DEBUG] Deleted {len(all_ids)} items from collection")
                except Exception as e:
                    print(f"[DEBUG] Error clearing collection: {e}")

                self.vectorstore = None
                gc.collect()  # ガベージコレクション実行

            # ディレクトリが存在する場合は削除
            if os.path.exists(self.persist_directory):
                print(f"[DEBUG] Removing directory: {self.persist_directory}")
                try:
                    shutil.rmtree(self.persist_directory)
                    print("[DEBUG] Directory removed successfully")
                except Exception as e:
                    print(f"[DEBUG] Error removing directory: {e}")
                # ディレクトリ削除後、少し待機
                time.sleep(0.5)

            # 新しいベクトルストアを作成
            print("[DEBUG] Creating new vector store...")
            self.vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings
            )

            # 空であることを確認
            try:
                count = len(self.vectorstore.get()['ids'])
                print(f"[DEBUG] New vector store created with {count} documents")
            except:
                print("[DEBUG] New vector store created (empty)")

            print("[DEBUG] Documents cleared successfully")

        except Exception as e:
            print(f"[DEBUG] Error clearing documents: {e}")
            import traceback
            traceback.print_exc()
            # エラーが発生しても新しいベクトルストアを作成
            self.vectorstore = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings
            )

    @staticmethod
    def _get_available_models_static() -> List[str]:
        """
        利用可能なOllamaモデルの一覧を取得（静的メソッド）

        Returns:
            モデル名のリスト
        """
        try:
            import requests
            response = requests.get("http://localhost:11434/api/tags", timeout=2)
            if response.status_code == 200:
                data = response.json()
                models = [model["name"] for model in data.get("models", [])]
                return models
            else:
                return []
        except Exception as e:
            print(f"[DEBUG] Exception fetching models: {e}")
            return []

    def check_ollama_connection(self) -> bool:
        """
        Ollamaへの接続をチェック

        Returns:
            接続が成功した場合True
        """
        try:
            import requests
            # Ollamaサーバーが起動しているかを確認（モデルの有無に関わらず）
            response = requests.get("http://localhost:11434/api/tags", timeout=2)
            return response.status_code == 200
        except Exception as e:
            print(f"[DEBUG] Ollama connection check failed: {e}")
            return False

    def get_available_models(self) -> List[str]:
        """
        利用可能なOllamaモデルの一覧を取得

        Returns:
            モデル名のリスト
        """
        models = self._get_available_models_static()
        print(f"[DEBUG] Found {len(models)} models: {models}")
        return models
