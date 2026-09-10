import asyncio
from qdrant_client import AsyncQdrantClient
from fastembed import TextEmbedding

async def verify():
    print("Testing fastembed embeddings...")
    # Fastembed generates ONNX-based embeddings locally.
    embedding_model = TextEmbedding("BAAI/bge-small-en-v1.5")
    texts = ["This is a test document.", "Another test document."]
    embeddings = list(embedding_model.embed(texts))
    print(f"Generated {len(embeddings)} embeddings successfully. Shape: {embeddings[0].shape}")

    print("Testing Qdrant connectivity...")
    # Connecting to Qdrant asynchronously (non-blocking)
    client = AsyncQdrantClient(host="qdrant", port=6333)
    collections = await client.get_collections()
    print("Connected to Qdrant successfully.")
    print("Collections:", collections)

if __name__ == "__main__":
    asyncio.run(verify())
