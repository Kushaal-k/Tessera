"""Embedding service for converting text queries to vector representations."""

import asyncio
import logging
from functools import lru_cache

from .config import settings

try:
    from sentence_transformers import SentenceTransformer

    _HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    _HAS_SENTENCE_TRANSFORMERS = False

_logger = logging.getLogger(__name__)
_warned_once = False


@lru_cache(maxsize=1)
def _load_model(model_name: str) -> "SentenceTransformer":
    return SentenceTransformer(model_name)


class EmbeddingService:
    """Generates vector embeddings from text using the configured model.

    When ``sentence-transformers`` is not installed the service falls back to
    zero-vector placeholders so the rest of the application can still start.
    Install the optional ML dependencies to enable real embeddings::

        pip install -r requirements-ml.txt
    """

    def __init__(self, model_name: str = settings.EMBEDDING_MODEL) -> None:
        self.model_name = model_name

    async def embed_query(self, text: str) -> list[float]:
        if not _HAS_SENTENCE_TRANSFORMERS:
            global _warned_once
            if not _warned_once:
                _logger.warning(
                    "sentence-transformers is not installed — returning "
                    "placeholder embeddings. Install the optional ML "
                    "dependencies (pip install -r requirements-ml.txt) "
                    "to enable real vector search."
                )
                _warned_once = True
            return [0.0] * settings.EMBEDDING_DIMENSIONS

        loop = asyncio.get_running_loop()
        model = _load_model(self.model_name)
        vector = await loop.run_in_executor(None, model.encode, text)
        return vector.tolist()
