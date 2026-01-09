"""
バックエンド起動テスト
backendディレクトリから実行すること
"""
import sys
import os

print("=" * 50)
print("Backend Startup Test")
print("=" * 50)

# 1. モジュールインポートテスト
print("\n[1] Module Import Test...")
try:
    from rag_service import RAGService
    from config import RAGConfig
    import logger as logger_module
    print("OK - All modules imported successfully")
except Exception as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)

# 2. パス確認
print("\n[2] Path Configuration Test...")
print(f"Current directory: {os.getcwd()}")
print(f"ChromaDB path: {RAGConfig.CHROMA_PERSIST_DIRECTORY}")
print(f"Upload path: {RAGConfig.UPLOAD_DIRECTORY}")

# 3. ChromaDBディレクトリ確認
chroma_path = RAGConfig.CHROMA_PERSIST_DIRECTORY
if os.path.exists(chroma_path):
    print(f"✓ ChromaDB directory exists: {chroma_path}")
else:
    print(f"⚠ ChromaDB directory not found (will be created on first use): {chroma_path}")

# 4. RAGService初期化テスト
print("\n[3] RAGService Initialization Test...")
try:
    rag = RAGService()
    print("✓ RAGService initialized successfully")
except Exception as e:
    print(f"✗ RAGService initialization failed: {e}")
    sys.exit(1)

print("\n" + "=" * 50)
print("All tests passed! Backend is ready to start.")
print("Run: python main.py")
print("=" * 50)
