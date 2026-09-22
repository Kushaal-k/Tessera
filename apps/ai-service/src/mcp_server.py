from mcp.server.fastmcp import FastMCP

from .config import settings
from .db import get_collection
from .embeddings import EmbeddingService

mcp = FastMCP(settings.MCP_SERVER_NAME)
embedding_service = EmbeddingService()


@mcp.tool()
async def search_codebase(query: str, top_k: int = 5) -> list[dict[str, object]]:
    """Search the indexed codebase for code similar to the given query."""
    query_vector = await embedding_service.embed_query(query)
    collection = get_collection()

    pipeline = [
        {
            "$vectorSearch": {
                "index": "vector_index",
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": top_k * 10,
                "limit": top_k,
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

    results: list[dict[str, object]] = []
    async for doc in collection.aggregate(pipeline):
        results.append(
            {
                "file_path": doc["file_path"],
                "content": doc["content"],
                "score": doc["score"],
            }
        )
    return results


@mcp.tool()
async def execute_code(code: str, language: str) -> dict[str, str]:
    """Placeholder — will enqueue code execution via the execution engine."""
    return {
        "status": "not_implemented",
        "message": f"Would execute {language} code ({len(code)} chars) via execution engine",
    }
