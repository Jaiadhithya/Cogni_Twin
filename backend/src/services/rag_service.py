import os
import uuid
import logging
import asyncio
from typing import List, Dict, Any, Generator
from src.domain.interfaces.uow import UnitOfWork
from src.domain.interfaces.document_parser import DocumentParser
from src.domain.interfaces.vector_store import VectorStore
from src.api.schemas.document import DocumentUploadResponse, ChunkResponse, DocumentSearchResponse
from src.domain.exceptions import DocumentParseError, VectorStoreError

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self, uow: UnitOfWork, document_parser: DocumentParser, vector_store: VectorStore, llm_client=None):
        self.uow = uow
        self.document_parser = document_parser
        self.vector_store = vector_store
        self.llm_client = llm_client
        
    async def generate_answer(self, query: str) -> Dict[str, Any]:
        """Synthesize an answer using RAG context."""
        search_res = await self.search_documents(query, top_k=4)
        sources = []
        context = ""
        
        for idx, chunk in enumerate(search_res.results):
            filename = chunk.metadata.get("filename", "Unknown")
            context += f"Document {idx+1} ({filename}):\n{chunk.text}\n\n"
            sources.append({"filename": filename, "score": chunk.score, "snippet": chunk.text[:100]})
            
        if not sources:
            return {"answer": "I don't have any uploaded documents that answer this question.", "sources": []}
            
        prompt = f"""You are a helpful business assistant. Answer the user's question based ONLY on the provided document excerpts.
If the excerpts do not contain the answer, say "I don't have enough information in the uploaded documents to answer that."

Excerpts:
{context}

Question: {query}
"""
        if self.llm_client:
            try:
                answer = await asyncio.wait_for(
                    self.llm_client.generate_text(prompt=prompt),
                    timeout=3.0
                )
            except Exception as e:
                logger.warning(f"LLM generate_text failed/timed out ({e}). Synthesizing answer directly from document excerpts.")
                top_snippets = "\n\n".join([f"• Document: **{s['filename']}** (relevance: {int(s['score']*100)}%)\n{chunk.text}" for s, chunk in zip(sources, search_res.results[:3])])
                answer = f"Based on your uploaded documents, here are the key findings:\n\n{top_snippets}"
        else:
            top_snippets = "\n\n".join([f"• Document: **{s['filename']}**\n{chunk.text}" for s, chunk in zip(sources, search_res.results[:3])])
            answer = f"Based on your uploaded documents, here are the key findings:\n\n{top_snippets}"
            
        return {"answer": answer, "sources": sources}
        
    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> Generator[str, None, None]:
        """Native Python fixed-size chunking algorithm by words."""
        words = text.split()
        if not words:
            return
            
        i = 0
        while i < len(words):
            chunk_words = words[i:i + chunk_size]
            yield " ".join(chunk_words)
            i += (chunk_size - overlap)
            
    def _classify_document(self, filename: str, content: str) -> str:
        """Heuristic classification based on filename and content."""
        name_lower = filename.lower()
        if "invoice" in name_lower or "receipt" in name_lower:
            return "invoice"
        if "report" in name_lower:
            return "report"
        if "contract" in name_lower or "agreement" in name_lower:
            return "contract"
        return "general"

    async def upload_document(self, file_path: str, filename: str) -> DocumentUploadResponse:
        try:
            # 1. Parse text (can be blocking if large, so running in thread)
            extracted_text = await asyncio.to_thread(self.document_parser.extract_text, file_path)
            
            # 2. Classify
            doc_type = self._classify_document(filename, extracted_text)
            
            # 3. Chunk text
            chunks_text = list(self._chunk_text(extracted_text))
            
            # 4. Save to Database
            document_data = {
                "filename": filename,
                "doc_type": doc_type,
                "file_path": file_path,
                "chunk_count": len(chunks_text)
            }
            
            async with self.uow:
                document_id = await self.uow.repository.save_document(document_data)
                await self.uow.commit()
                
            # 5. Upsert Vectors
            vector_chunks = []
            for idx, text in enumerate(chunks_text):
                vector_chunks.append({
                    "chunk_id": str(uuid.uuid4()),
                    "text": text,
                    "metadata": {
                        "chunk_index": idx,
                        "filename": filename,
                        "doc_type": doc_type
                    }
                })
                
            await asyncio.to_thread(self.vector_store.upsert_vectors, document_id, vector_chunks)
            
            return DocumentUploadResponse(
                document_id=document_id,
                filename=filename,
                chunk_count=len(chunks_text),
                status="success"
            )
            
        except Exception as e:
            logger.error(f"Failed to process document: {e}")
            raise DocumentParseError(f"Failed to process document {filename}: {str(e)}")
            
    async def search_documents(self, query: str, top_k: int = 4) -> DocumentSearchResponse:
        try:
            results = await asyncio.to_thread(self.vector_store.search_vectors, query, top_k)
            
            chunk_responses = []
            for r in results:
                chunk_responses.append(ChunkResponse(
                    chunk_id=r.chunk_id,
                    document_id=r.document_id,
                    score=r.score,
                    text=r.text,
                    metadata=r.metadata
                ))
                
            return DocumentSearchResponse(results=chunk_responses)

        except VectorStoreError:
            # An outage is not "no matching documents": let callers say search is unavailable.
            raise
        except Exception as e:
            logger.warning(f"Document search failed: {e}")
            raise VectorStoreError("Document search failed. Try again in a minute.") from e
