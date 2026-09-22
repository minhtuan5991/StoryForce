import sqlite3
from contextlib import closing
from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from .models import Base, Job


class Database:
    def __init__(self, root: Path):
        self.path = root / "storyforge.db"
        self.engine = create_engine(f"sqlite:///{self.path.as_posix()}", connect_args={"check_same_thread": False, "timeout": 30})

        @event.listens_for(self.engine, "connect")
        def pragmas(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA busy_timeout=30000")

        self.session = sessionmaker(self.engine, expire_on_commit=False)
        self.migrate()

    def migrate(self):
        with self.engine.begin() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"))
            version = conn.execute(text("SELECT COALESCE(MAX(version),0) FROM schema_migrations")).scalar()
            if version < 1:
                Base.metadata.create_all(conn)
                conn.execute(text("INSERT INTO schema_migrations(version) VALUES(1)"))
        with self.session() as db:
            for job in db.query(Job).filter(Job.status.in_(["running", "queued"])).all():
                job.status = "waiting_user"
                job.step = "Interrupted by restart. Resume this job."
            db.commit()

    def backup(self, destination: Path):
        with closing(sqlite3.connect(self.path)) as source, closing(sqlite3.connect(destination)) as target:
            source.backup(target)
