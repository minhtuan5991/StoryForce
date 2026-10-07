import sqlite3
from contextlib import closing
from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from .models import Base, Job, PremiseUsage


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
            if version < 2:
                # Inspect columns as fresh databases already include these fields.
                for table, column in (("premises", "packaging"), ("analytics", "metrics")):
                    columns = {r[1] for r in conn.execute(text(f"PRAGMA table_info({table})"))}
                    if column not in columns:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} JSON DEFAULT '{{}}'"))
                conn.execute(text("INSERT INTO schema_migrations(version) VALUES(2)"))
            if version < 3:
                PremiseUsage.__table__.create(conn, checkfirst=True)
                # Backfill existing choices without changing any story/settings.
                rows = conn.execute(text('SELECT id, channel_id, title, selected_premise_id, settings FROM projects')).all()
                import json
                projects = {row.id: row for row in rows}
                for row in rows:
                    origin = json.loads(row.settings or '{}').get('premise_origin', {})
                    pool_id = origin.get('project_id') or row.id
                    premise_id = origin.get('premise_id') or row.selected_premise_id
                    pool = projects.get(pool_id)
                    if not premise_id or not pool or pool.channel_id != row.channel_id:
                        continue
                    chosen = conn.execute(text('SELECT title FROM premises WHERE id=:id AND project_id=:pool'),
                                          {'id': premise_id, 'pool': pool_id}).first()
                    if not chosen:
                        continue
                    known = conn.execute(text('SELECT id FROM premise_usage WHERE pool_project_id=:pool AND premise_id=:idea'),
                                         {'pool': pool_id, 'idea': premise_id}).first()
                    if not known:
                        conn.execute(PremiseUsage.__table__.insert().values(channel_id=row.channel_id,
                            pool_project_id=pool_id, premise_id=premise_id, project_id=row.id, title=chosen.title))
                conn.execute(text("INSERT INTO schema_migrations(version) VALUES(3)"))
        with self.session() as db:
            for job in db.query(Job).filter(Job.status.in_(["running", "queued"])).all():
                job.status = "waiting_user"
                job.step = "Interrupted by restart. Resume this job."
            db.commit()

    def backup(self, destination: Path):
        with closing(sqlite3.connect(self.path)) as source, closing(sqlite3.connect(destination)) as target:
            source.backup(target)
