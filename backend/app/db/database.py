from __future__ import annotations

from pathlib import Path

from sqlmodel import SQLModel, create_engine

from backend.app.core.settings import settings


def _normalize_sqlite_url(url: str) -> str:
    # Ensure a stable absolute path for sqlite files, independent of the current working directory.
    # Accepts:
    #   sqlite:///./dashboard.db   (relative)
    #   sqlite:////abs/path.db     (absolute)
    if url.startswith("sqlite:///./"):
        base_dir = Path(__file__).resolve().parents[3]  # .../dashboard (project root)
        db_file = base_dir / url.replace("sqlite:///./", "")
        return f"sqlite:///{db_file.as_posix()}"
    return url


DATABASE_URL = _normalize_sqlite_url(settings.database_url)

engine = create_engine(
    DATABASE_URL,
    echo=settings.debug,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
