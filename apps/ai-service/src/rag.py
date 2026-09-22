from fastapi import APIRouter
from pydantic import BaseModel, Field

from .config import settings
from .db import get_collection

router = APIRouter(prefix="/rag", tags=["RAG"])


class IngestRequest(BaseModel):
    file_path: str
    content: str
    chunk_size: int = Field(default=512, ge=64, le=4096)


class IngestResponse(BaseModel):
    chunks_stored: int


class SearchRequest(BaseModel):
    query_vector: list[float]
    top_k: int = Field(default=5, ge=1, le=50)


class ChunkResult(BaseModel):
    file_path: str
    content: str
    score: float


class SearchResponse(BaseModel):
    results: list[ChunkResult]


def _split_into_chunks(text: str, chunk_size: int) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for word in words:
        if current_len + len(word) + 1 > chunk_size and current:
            chunks.append(" ".join(current))
            current = []
            current_len = 0
        current.append(word)
        current_len += len(word) + 1

    if current:
        chunks.append(" ".join(current))

    return chunks


@router.post("/ingest", response_model=IngestResponse)
async def ingest(req: IngestRequest) -> IngestResponse:
    collection = get_collection()
    chunks = _split_into_chunks(req.content, req.chunk_size)

    # Placeholder embedding — replace with real embedding provider later
    placeholder_vector = [0.0] * settings.EMBEDDING_DIMENSIONS

    documents = [
        {
            "file_path": req.file_path,
            "content": chunk,
            "embedding": placeholder_vector,
            "chunk_index": idx,
        }
        for idx, chunk in enumerate(chunks)
    ]

    if documents:
        await collection.insert_many(documents)

    return IngestResponse(chunks_stored=len(documents))


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest) -> SearchResponse:
    collection = get_collection()

    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": req.query_vector,
                "numCandidates": req.top_k * 10,
                "limit": req.top_k,
            }
        },
        {
            "$project": {
                "file_path": 1,
                "content": 1,
                "score": {"$meta": "vectorSearchScore"},
                "_id": 0,
            }
        },
    ]

    results: list[ChunkResult] = []
    async for doc in collection.aggregate(pipeline):
        results.append(
            ChunkResult(
                file_path=doc["file_path"],
                content=doc["content"],
                score=doc["score"],
            )
        )

    return SearchResponse(results=results)
