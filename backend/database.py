import sqlite3
from contextlib import closing
from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from .models import Base, Job, PremiseUsage, ChannelGuidance
from .project_naming import name_project

SCHEMA_VERSION = 7


class Database:
    def __init__(self, root: Path):
        self.path = root / "storyforge.db"
        if self.path.is_file() and self.path.stat().st_size:
            with closing(sqlite3.connect(self.path.as_uri() + '?mode=ro', uri=True)) as old:
                try:
                    previous = old.execute('SELECT COALESCE(MAX(version),0) FROM schema_migrations').fetchone()[0]
                except sqlite3.OperationalError:
                    previous = 0
            if 0 < previous < SCHEMA_VERSION:
                from .models import uid
                prefix = 'before-project-labels-' if previous < 4 else 'before-source-collections-' if previous < 5 else 'before-channel-guidance-' if previous < 6 else 'before-narration-'
                backup = root / 'backups' / (prefix + uid() + '.db')
                backup.parent.mkdir(parents=True, exist_ok=True)
                self.backup(backup)
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
            if version < 4:
                import json
                rows = conn.execute(text('SELECT id,title,settings FROM projects')).all()
                for row in rows:
                    item = {'title': row.title, 'settings': json.loads(row.settings or '{}')}
                    name_project(item)
                    conn.execute(text('UPDATE projects SET title=:title,settings=:settings WHERE id=:id'),
                                 {'id': row.id, 'title': item['title'], 'settings': json.dumps(item['settings'], ensure_ascii=False)})
                conn.execute(text("INSERT INTO schema_migrations(version) VALUES(4)"))
            if version < 5:
                import json
                columns = {r[1] for r in conn.execute(text('PRAGMA table_info(sources)'))}
                if 'collection' not in columns:
                    conn.execute(text("ALTER TABLE sources ADD COLUMN collection VARCHAR(16) NOT NULL DEFAULT 'inbox'"))
                conn.execute(text('CREATE INDEX IF NOT EXISTS ix_sources_collection ON sources(collection)'))
                used = set(conn.execute(text('SELECT DISTINCT source_id FROM projects WHERE source_id IS NOT NULL')).scalars())
                # Classify existing sources once. Later manual moves must survive restarts,
                # even when an inbox source still has DNA or linked projects.
                for row in conn.execute(text('SELECT id,status,dna FROM sources')).all():
                    dna = json.loads(row.dna or '{}')
                    collection = 'library' if dna or row.status == 'ANALYZED' or row.id in used else 'inbox'
                    conn.execute(text('UPDATE sources SET collection=:collection WHERE id=:id'),
                                 {'id': row.id, 'collection': collection})
                conn.execute(text("INSERT INTO schema_migrations(version) VALUES(5)"))
            if version < 6:
                from .channel_guidance import bootstrap_connection
                ChannelGuidance.__table__.create(conn, checkfirst=True)
                bootstrap_connection(conn)
                conn.execute(text("INSERT INTO schema_migrations(version) VALUES(6)"))
            if version < 7:
                from .narration import bootstrap_connection as bootstrap_narration
                bootstrap_narration(conn)
                conn.execute(text("INSERT INTO schema_migrations(version) VALUES(7)"))
        with self.session() as db:
            for job in db.query(Job).filter(Job.status.in_(["running", "queued"])).all():
                job.status = "waiting_user"
                job.step = "Interrupted by restart. Resume this job."
            db.commit()

    def backup(self, destination: Path):
        with closing(sqlite3.connect(self.path)) as source, closing(sqlite3.connect(destination)) as target:
            source.backup(target)
