# SQLite schema v1

`schema_migrations(version, applied_at)` records applied migrations. Migration 1 is the table creation in `backend/database.py` and the definitions in `backend/models.py`.

| Table | Purpose / relationships |
|---|---|
| channels | Workspace channel identity, settings, current DNA |
| channel_dna_versions | Channel FK, numbered accepted/proposed/testing/rejected DNA |
| sources | Optional channel FK, URL/text/notes, raw/parsed Story DNA |
| projects | Required channel FK, optional source FK, duration, draft/version, stage, publish metadata |
| artifacts | Project/source/channel scope, structured provider output with provenance hashes |
| premises | Project FK, logline, scoring, mini-test, novelty signature and warnings |
| story_versions | Project FK, immutable narration text/hash and invalidation report |
| audit_issues | Project, cycle, scope, evidence, provider verdicts, final/fix states |
| tts_chunks | Project/version, narration, boundary reasons, context, audio reference, actual offset/duration |
| visual_scenes | Project/version, word ranges, prompt/continuity, primary/fallback asset, timing |
| assets | Project FK, relative path, kind, SHA256, ffprobe metadata, version |
| jobs | Durable status/progress/prompt/payload/logs; optional project/source/channel FK |
| analytics | Project FK, dated manually observed YouTube metrics |
| novelty_memory | Channel/project FKs, motifs, token hash and locked story identity |
| calendar | Channel FK, optional project FK, date/category/status/duration |
| settings | JSON-valued defaults/overrides and private local bridge pairing key |

Most entities have UUID-derived IDs, created/updated timestamps. Search and parent relationship columns are indexed; composite indexes cover latest artifacts and audit cycles. SQLite uses foreign keys, WAL, a busy timeout and short database transactions around background work.
