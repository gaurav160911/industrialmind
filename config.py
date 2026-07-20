"""
IndustrialMind — centralised configuration via environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_TITLE: str = "IndustrialMind API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    CORS_ORIGINS: list[str] = ["*"]  # Override in prod: CORS_ORIGINS=["https://your-app.vercel.app"]

    # Groq (free tier) — get your key at https://console.groq.com
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"  # free & powerful
    CLAUDE_MAX_TOKENS: int = 1024  # Reduced for faster responses (was 4096)

    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "industrialmind"

    CHROMA_PERSIST_PATH: str = "/tmp/chroma"  # In-process persistent storage
    CHROMA_COLLECTION: str = "industrial_docs"

    UPLOAD_DIR: str = "/tmp/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}
@lru_cache
def get_settings() -> Settings:
    return Settings()
