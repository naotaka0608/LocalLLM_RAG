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
        model_name: str = "llama3.2",
        embedding_model: str = "nomic-embed-text",
        persist_directory: str = "./chroma_db"
    ):
        """
        RAGサービスの初期化

        Args:
            model_name: Ollamaで使用するLLMモデル名
            embedding_model: Ollamaで使用する埋め込みモデル名
            persist_directory: ChromaDBの永続化ディレクトリ
        """
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

        # LLM
        self.llm = Ollama(
            model=self.model_name,
            base_url="http://localhost:11434",
            temperature=0.7
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

    def query(self, question: str, k: int = 10, model_name: str = None, enable_query_expansion: bool = True) -> Tuple[str, List[str]]:
        """
        質問に対してRAGで回答を生成

        Args:
            question: 質問文
            k: 最終的に使用する関連文書の数（デフォルト: 10）
            model_name: 使用するモデル名（Noneの場合はデフォルトモデルを使用）
            enable_query_expansion: クエリ拡張を有効にするか（デフォルト: True）

        Returns:
            回答と参照元のタプル
        """
        print(f"[DEBUG] Query received: {question}")
        print(f"[DEBUG] Model: {model_name if model_name else 'default (llama3.2)'}")
        print(f"[DEBUG] Query expansion: {enable_query_expansion}")

        # クエリ拡張
        queries = self._expand_query(question) if enable_query_expansion else [question]

        # 各クエリで検索を実行し、スコア付きでドキュメントを取得
        # より多くのドキュメントを取得してフィルタリング
        initial_k = k * 3  # 最終的に必要な数の3倍を取得
        all_docs_with_scores = []
        seen_content = set()  # 重複排除用

        for query in queries:
            try:
                docs_with_scores = self.vectorstore.similarity_search_with_score(query, k=initial_k)
                print(f"[DEBUG] Query '{query[:50]}...' retrieved {len(docs_with_scores)} documents")

                for doc, score in docs_with_scores:
                    # 重複チェック(同じ内容のドキュメントを排除)
                    content_hash = hash(doc.page_content[:200])  # 最初の200文字でハッシュ化
                    if content_hash not in seen_content:
                        seen_content.add(content_hash)
                        all_docs_with_scores.append((doc, score))
                        print(f"[DEBUG] Document score: {score:.4f}, preview: {doc.page_content[:80]}...")
            except Exception as e:
                print(f"[DEBUG] Error searching with query '{query}': {e}")

        if len(all_docs_with_scores) == 0:
            print("[DEBUG] No documents found in vector store. Please upload documents first.")
            return "ドキュメントが登録されていません。まずファイルをアップロードしてください。", []

        # スコアでソート(ChromaDBの場合、スコアが小さいほど類似度が高い)
        all_docs_with_scores.sort(key=lambda x: x[1])

        # スコアベースのフィルタリング
        # 最高スコアの2倍以内のドキュメントのみを保持
        if len(all_docs_with_scores) > 0:
            best_score = all_docs_with_scores[0][1]
            threshold = best_score * 2.0
            filtered_docs = [(doc, score) for doc, score in all_docs_with_scores if score <= threshold]
            print(f"[DEBUG] Filtered {len(all_docs_with_scores)} -> {len(filtered_docs)} documents (threshold: {threshold:.4f})")
        else:
            filtered_docs = all_docs_with_scores

        # 上位k件を選択
        top_docs = [doc for doc, _score in filtered_docs[:k]]
        print(f"[DEBUG] Using top {len(top_docs)} documents for context")

        # 取得したドキュメントの詳細をログ出力
        for i, (doc, score) in enumerate(filtered_docs[:k]):
            print(f"[DEBUG] Document {i+1} score: {score:.4f}")
            print(f"[DEBUG] Document {i+1} preview: {doc.page_content[:100]}...")
            print(f"[DEBUG] Document {i+1} metadata: {doc.metadata}")

        # コンテキストの構築
        context = "\n\n".join([doc.page_content for doc in top_docs])
        print(f"[DEBUG] Context length: {len(context)} characters")

        # プロンプトの構築
        prompt_text = self.prompt.format(context=context, question=question)

        # モデルの選択
        if model_name:
            llm = Ollama(
                model=model_name,
                base_url="http://localhost:11434",
                temperature=0.7
            )
        else:
            llm = self.llm

        print("[DEBUG] Generating answer...")
        # 回答の生成
        answer = llm.invoke(prompt_text)
        print(f"[DEBUG] Answer generated: {len(answer)} characters")

        # 参照元の抽出
        sources = []
        for doc in top_docs:
            source = doc.metadata.get("source_file", "Unknown")
            page = doc.metadata.get("page", "Unknown")
            sources.append(f"{source} (Page {page})")

        return answer, list(set(sources))

    async def query_stream(self, question: str, k: int = 10, model_name: str = None):
        """
        質問に対してRAGで回答を生成（ストリーミング）

        Args:
            question: 質問文
            k: 取得する関連文書の数
            model_name: 使用するモデル名（Noneの場合はデフォルトモデルを使用）

        Yields:
            回答のチャンク
        """
        # 関連文書の検索
        retriever = self.vectorstore.as_retriever(search_kwargs={"k": k})
        docs = retriever.invoke(question)

        # コンテキストの構築
        context = "\n\n".join([doc.page_content for doc in docs])

        # プロンプトの構築
        prompt_text = self.prompt.format(context=context, question=question)

        # モデルの選択
        if model_name:
            llm = Ollama(
                model=model_name,
                base_url="http://localhost:11434",
                temperature=0.7
            )
        else:
            llm = self.llm

        # ストリーミング生成
        for chunk in llm.stream(prompt_text):
            yield chunk

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

    def check_ollama_connection(self) -> bool:
        """
        Ollamaへの接続をチェック

        Returns:
            接続が成功した場合True
        """
        try:
            self.llm.invoke("test")
            return True
        except Exception:
            return False

    def get_available_models(self) -> List[str]:
        """
        利用可能なOllamaモデルの一覧を取得

        Returns:
            モデル名のリスト
        """
        try:
            import requests
            response = requests.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = [model["name"] for model in data.get("models", [])]
                print(f"Found {len(models)} models: {models}")  # デバッグ用
                return models
            else:
                print(f"Error fetching models: status code {response.status_code}")
                return []
        except Exception as e:
            print(f"Exception fetching models: {e}")
            return []
