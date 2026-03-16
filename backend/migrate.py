import logging

from sqlalchemy import inspect, text

from database import engine
import models  # noqa: F401  # ensures models are imported so metadata is loaded


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ensure_chat_sessions_status_column() -> None:
    """
    Ensure the `status` column exists on the `chat_sessions` table.

    This is a minimal, one-off migration that can be safely re-run:
    - If the table is missing, it logs an error.
    - If the column already exists, it logs and does nothing.
    - If the column is missing, it adds it with the expected definition.
    """
    inspector = inspect(engine)

    tables = inspector.get_table_names()
    if "chat_sessions" not in tables:
        logger.error("Table 'chat_sessions' does not exist. Run your init-db.sql first.")
        return

    columns = {col["name"] for col in inspector.get_columns("chat_sessions")}
    if "status" in columns:
        logger.info("Column 'chat_sessions.status' already exists. Nothing to do.")
        return

    logger.info("Column 'chat_sessions.status' is missing. Adding it now...")
    ddl = text(
        "ALTER TABLE chat_sessions "
        "ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open';"
    )

    with engine.begin() as conn:
        conn.execute(ddl)

    logger.info("Column 'chat_sessions.status' successfully added.")


def main() -> None:
    logger.info("Starting custom DB migration based on SQLAlchemy models...")
    ensure_chat_sessions_status_column()
    logger.info("Migration finished.")


if __name__ == "__main__":
    main()

