from pydantic import field_validator
from pydantic_settings import BaseSettings
from pymongo import uri_parser
from pymongo.errors import InvalidURI

_VALID_URI_SCHEMES = ("mongodb://", "mongodb+srv://")


class Settings(BaseSettings):
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "tessera"
    MONGODB_COLLECTION: str = "code_chunks"
    # Bound server selection so an unreachable database fails fast (e.g. in the
    # /health probe) instead of waiting out Motor's 30s default.
    MONGODB_TIMEOUT_MS: int = 3000
    EMBEDDING_DIMENSIONS: int = 384
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    MCP_SERVER_NAME: str = "tessera-ai"

    model_config = {"env_prefix": "TESSERA_", "env_file": ".env"}

    @field_validator("MONGODB_URI")
    @classmethod
    def validate_mongodb_uri(cls, v: str) -> str:
        """Reject non-MongoDB connection strings at startup.

        Gate 1 — scheme check: gives a clear human-readable error for the
        most common misconfigurations (wrong service URI, empty string, etc.).

        Gate 2 — structural check: delegates to pymongo's own parser for
        ``mongodb://`` URIs to catch missing host, bad port, etc.
        Skipped for ``mongodb+srv://`` because pymongo performs a live DNS
        lookup for SRV URIs, which is inappropriate at configuration time.
        """
        if not any(v.startswith(scheme) for scheme in _VALID_URI_SCHEMES):
            raise ValueError(
                f"MONGODB_URI has an invalid scheme: {v!r}. "
                "Must start with 'mongodb://' or 'mongodb+srv://'."
            )
        if v.startswith("mongodb://"):
            if v == "mongodb://":
                raise ValueError(
                    "MONGODB_URI is missing a host. "
                    "Expected format: 'mongodb://<host>:<port>'."
                )
            try:
                uri_parser.parse_uri(v)
            except InvalidURI as exc:
                raise ValueError(
                    f"MONGODB_URI is not a valid MongoDB connection string: {exc}"
                ) from exc
        return v


settings = Settings()
