from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
from rag_service import RAGService

app = FastAPI(title="Local LLM RAG System")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静的ファイルのマウント（CSS, JS）
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")

# RAGサービスのインスタンス化
rag_service = RAGService()


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class QueryRequest(BaseModel):
    question: str
    stream: bool = False
    model: Optional[str] = None
    use_rag: bool = True  # RAG使用のON/OFF
    query_expansion: bool = False
    use_hybrid_search: bool = True  # ハイブリッド検索のON/OFF
    chat_history: Optional[List[Message]] = None  # 会話履歴
    # 主要パラメータ (★)
    temperature: Optional[float] = None
    document_count: Optional[int] = None
    search_multiplier: Optional[int] = None  # 検索範囲倍率
    top_p: Optional[float] = None
    repeat_penalty: Optional[float] = None
    num_predict: Optional[int] = None
    # 詳細パラメータ
    top_k: Optional[int] = None
    num_ctx: Optional[int] = None
    seed: Optional[int] = None
    mirostat: Optional[int] = None
    mirostat_tau: Optional[float] = None
    mirostat_eta: Optional[float] = None
    tfs_z: Optional[float] = None


class SourceInfo(BaseModel):
    source: str
    score: float

class QueryResponse(BaseModel):
    answer: str
    sources: List[str]
    source_scores: Optional[List[SourceInfo]] = None


class ModelListResponse(BaseModel):
    models: List[str]
    default_model: str


@app.get("/")
async def read_root():
    """HTMLフロントエンドを返す"""
    return FileResponse("frontend/index.html")


@app.post("/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    ファイルをアップロードしてベクトルストアに追加
    対応フォーマット: PDF, TXT, MD, CSV
    """
    try:
        # サポートされている拡張子
        SUPPORTED_EXTENSIONS = {'.pdf', '.txt', '.md', '.csv'}

        uploaded_files = []
        for file in files:
            # 拡張子チェック
            file_extension = os.path.splitext(file.filename)[1].lower()
            if file_extension not in SUPPORTED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"{file.filename} はサポートされていないファイル形式です。対応: PDF, TXT, MD, CSV"
                )

            # ファイルを一時保存
            file_path = f"./uploads/{file.filename}"
            os.makedirs("./uploads", exist_ok=True)

            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)

            # ベクトルストアに追加
            rag_service.add_documents(file_path)
            uploaded_files.append(file.filename)

        return {
            "message": "Documents uploaded successfully",
            "files": uploaded_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """
    質問に対してRAGで回答を生成（非ストリーミング）
    """
    try:
        # 会話履歴を辞書形式に変換
        chat_history = [{"role": msg.role, "content": msg.content} for msg in request.chat_history] if request.chat_history is not None else []

        answer, sources, source_scores = rag_service.query(
            request.question,
            model_name=request.model,
            use_rag=request.use_rag,
            enable_query_expansion=request.query_expansion,
            chat_history=chat_history,
            temperature=request.temperature,
            k=request.document_count,
            top_p=request.top_p,
            repeat_penalty=request.repeat_penalty,
            num_predict=request.num_predict,
            top_k=request.top_k,
            num_ctx=request.num_ctx,
            seed=request.seed,
            mirostat=request.mirostat,
            mirostat_tau=request.mirostat_tau,
            mirostat_eta=request.mirostat_eta,
            tfs_z=request.tfs_z
        )
        return QueryResponse(answer=answer, sources=sources, source_scores=source_scores)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    """
    質問に対してRAGで回答を生成（ストリーミング）
    """
    try:
        # 会話履歴を辞書形式に変換
        chat_history = [{"role": msg.role, "content": msg.content} for msg in request.chat_history] if request.chat_history is not None else []

        async def generate():
            async for chunk in rag_service.query_stream(
                request.question,
                model_name=request.model,
                use_rag=request.use_rag,
                enable_query_expansion=request.query_expansion,
                use_hybrid_search=request.use_hybrid_search,
                chat_history=chat_history,
                temperature=request.temperature,
                k=request.document_count,
                search_multiplier=request.search_multiplier,
                top_p=request.top_p,
                repeat_penalty=request.repeat_penalty,
                num_predict=request.num_predict,
                top_k=request.top_k,
                num_ctx=request.num_ctx,
                seed=request.seed,
                mirostat=request.mirostat,
                mirostat_tau=request.mirostat_tau,
                mirostat_eta=request.mirostat_eta,
                tfs_z=request.tfs_z
            ):
                # チャンクの先頭の改行を削除してから送信
                yield f"data: {chunk.lstrip()}\n\n"

        return StreamingResponse(generate(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents")
async def list_documents():
    """
    登録されているドキュメントの一覧を取得
    """
    try:
        docs = rag_service.list_documents()
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    """
    特定のドキュメントを削除
    """
    try:
        success = rag_service.delete_document(filename)
        if success:
            return {"message": f"{filename} deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail=f"{filename} not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/document/content/{filename}")
async def get_document_content(filename: str):
    """
    ドキュメントの内容を取得（プレビュー用）
    """
    try:
        content = rag_service.get_document_content(filename)
        if content:
            return {"content": content, "filename": filename}
        else:
            raise HTTPException(status_code=404, detail=f"{filename} not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents")
async def clear_documents():
    """
    すべてのドキュメントをクリア
    """
    try:
        rag_service.clear_documents()
        return {"message": "All documents cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/models", response_model=ModelListResponse)
async def list_models():
    """
    利用可能なOllamaモデルの一覧を取得
    """
    try:
        models = rag_service.get_available_models()
        return ModelListResponse(models=models, default_model=rag_service.model_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """
    ヘルスチェック
    """
    return {
        "status": "healthy",
        "ollama_available": rag_service.check_ollama_connection()
    }


if __name__ == "__main__":
    import uvicorn
    # host="0.0.0.0" で全てのネットワークインターフェースからのアクセスを許可
    # port=8000 でポート8000を使用
    uvicorn.run(app, host="0.0.0.0", port=8000)
