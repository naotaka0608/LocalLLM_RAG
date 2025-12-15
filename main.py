from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
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


class QueryRequest(BaseModel):
    question: str
    stream: bool = False
    model: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    sources: List[str]


class ModelListResponse(BaseModel):
    models: List[str]


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
        answer, sources = rag_service.query(
            request.question,
            model_name=request.model
        )
        return QueryResponse(answer=answer, sources=sources)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query/stream")
async def query_stream(request: QueryRequest):
    """
    質問に対してRAGで回答を生成（ストリーミング）
    """
    try:
        async def generate():
            async for chunk in rag_service.query_stream(
                request.question,
                model_name=request.model
            ):
                yield f"data: {chunk}\n\n"

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
        return ModelListResponse(models=models)
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
