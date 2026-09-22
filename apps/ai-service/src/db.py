import logging
from time import perf_counter

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from pymongo import ASCENDING
from pymongo.errors import CollectionInvalid, OperationFailure
from pymongo.operations import SearchIndexModel

from .config import settings

_client: AsyncIOMotorClient | None = None  # type: ignore[type-arg]
_logger = logging.getLogger(__name__)

VECTOR_SEARCH_INDEX_NAME = "vector_index"
FILE_PATH_INDEX_NAME = "file_path_idx"
FILE_PATH_CHUNK_INDEX_NAME = "file_path_chunk_idx"
_DUPLICATE_INDEX_ERROR_CODES = {68, 85, 86, 11000}
_UNSUPPORTED_SEARCH_INDEX_ERROR_CODES = {40324}
_DUPLICATE_INDEX_ERROR_MARKERS = (
    "already exists",
    "duplicate",
    "indexalreadyexists",
    "indexkeyspecsconflict",
    "indexoptionsconflict",
)


async def connect_db() -> None:
    global _client
    # serverSelectionTimeoutMS keeps the /health probe (and any first query)
    # fast when the database is unreachable, instead of Motor's 30s default.
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
    )


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_collection() -> AsyncIOMotorCollection:  # type: ignore[type-arg]
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    db = _client[settings.MONGODB_DB_NAME]
    return db[settings.MONGODB_COLLECTION]


async def check_connection() -> dict[str, object]:
    """Ping MongoDB and report connectivity statistics for the health check.

    Never raises: a failed or missing connection is reported as
    ``connected: False`` so the caller can degrade gracefully instead of
    returning a 500.
    """
    status: dict[str, object] = {
        "connected": False,
        "database": settings.MONGODB_DB_NAME,
        "collection": settings.MONGODB_COLLECTION,
        "latency_ms": None,
    }

    if _client is None:
        status["error"] = "Database client not initialized"
        return status

    start = perf_counter()
    try:
        await _client.admin.command("ping")
    except Exception as exc:
        status["error"] = str(exc)
        return status

    status["connected"] = True
    status["latency_ms"] = round((perf_counter() - start) * 1000, 2)
    return status


async def ensure_collection_indexes() -> None:
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")

    db = _client[settings.MONGODB_DB_NAME]

    try:
        await db.create_collection(settings.MONGODB_COLLECTION)
    except CollectionInvalid:
        # The collection already exists, or another startup worker created it.
        pass

    collection = db[settings.MONGODB_COLLECTION]
    await _ensure_standard_index(
        collection,
        [("file_path", ASCENDING)],
        FILE_PATH_INDEX_NAME,
    )
    await _ensure_standard_index(
        collection,
        [("file_path", ASCENDING), ("chunk_index", ASCENDING)],
        FILE_PATH_CHUNK_INDEX_NAME,
    )
    await _ensure_vector_search_index(collection)
    _logger.info(
        "MongoDB indexes ensured for collection %s",
        settings.MONGODB_COLLECTION,
    )


async def _ensure_standard_index(
    collection: AsyncIOMotorCollection,  # type: ignore[type-arg]
    keys: list[tuple[str, int]],
    name: str,
) -> None:
    try:
        await collection.create_index(keys, name=name)
    except OperationFailure as exc:
        if _is_duplicate_index_error(exc):
            return
        _logger.warning(
            "Skipping MongoDB index creation for %s.%s: %s",
            settings.MONGODB_COLLECTION,
            name,
            exc,
        )


async def _ensure_vector_search_index(
    collection: AsyncIOMotorCollection,  # type: ignore[type-arg]
) -> None:
    if await _has_vector_search_index(collection):
        return

    index_model = SearchIndexModel(
        definition={
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": settings.EMBEDDING_DIMENSIONS,
                    "similarity": "cosine",
                }
            ]
        },
        name=VECTOR_SEARCH_INDEX_NAME,
        type="vectorSearch",
    )

    try:
        await collection.create_search_index(model=index_model)
    except AttributeError as exc:
        _logger.warning(
            "Skipping MongoDB vector search index creation for %s: %s",
            settings.MONGODB_COLLECTION,
            exc,
        )
    except OperationFailure as exc:
        if _is_duplicate_index_error(exc):
            return
        _logger.warning(
            "Skipping MongoDB vector search index creation for %s: %s",
            settings.MONGODB_COLLECTION,
            exc,
        )


async def _has_vector_search_index(
    collection: AsyncIOMotorCollection,  # type: ignore[type-arg]
) -> bool:
    try:
        async for index in collection.list_search_indexes():
            if index.get("name") == VECTOR_SEARCH_INDEX_NAME:
                return True
    except AttributeError as exc:
        _logger.warning(
            "Skipping MongoDB search index inspection for %s: %s",
            settings.MONGODB_COLLECTION,
            exc,
        )
        return True
    except OperationFailure as exc:
        if _is_search_index_unsupported_error(exc):
            _logger.warning(
                "Skipping MongoDB search index inspection for %s: %s",
                settings.MONGODB_COLLECTION,
                exc,
            )
            return True
        _logger.warning(
            "MongoDB search index inspection failed for %s: %s",
            settings.MONGODB_COLLECTION,
            exc,
        )
        return False

    return False


def _is_search_index_unsupported_error(exc: OperationFailure) -> bool:
    return exc.code in _UNSUPPORTED_SEARCH_INDEX_ERROR_CODES


def _is_duplicate_index_error(exc: OperationFailure) -> bool:
    if exc.code in _DUPLICATE_INDEX_ERROR_CODES:
        return True

    error_text = str(exc).lower()
    return any(marker in error_text for marker in _DUPLICATE_INDEX_ERROR_MARKERS)
