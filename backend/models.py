from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, JSON, ForeignKey, Index
from sqlalchemy.orm import declarative_base

Base = declarative_base()


def uid():
    return uuid4().hex[:16]


def now():
    return datetime.now(timezone.utc).isoformat()


class Record:
    id = Column(String, primary_key=True, default=uid)
    created_at = Column(String, default=now, nullable=False)
    updated_at = Column(String, default=now, onupdate=now, nullable=False)


class Channel(Record, Base):
    __tablename__ = "channels"
    name = Column(String(160), nullable=False)
    status = Column(String, default="DISCOVERY", index=True)
    niche = Column(String, default="")
    country = Column(String, default="United States")
    age_range = Column(String, default="25–54")
    language = Column(String, default="English (US)")
    default_duration = Column(Float, default=10)
    dna = Column(JSON, default=dict)
    settings = Column(JSON, default=dict)
    color = Column(String, default="blue")
    is_demo = Column(Boolean, default=False)


class DNAVersion(Record, Base):
    __tablename__ = "channel_dna_versions"
    channel_id = Column(String, ForeignKey("channels.id", ondelete="CASCADE"), index=True)
    version = Column(Integer, default=1)
    dna = Column(JSON, default=dict)
    note = Column(Text, default="Manual edit")
    magnitude = Column(String, default="LOW")
    status = Column(String, default="accepted")


class Source(Record, Base):
    __tablename__ = "sources"
    channel_id = Column(String, ForeignKey("channels.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    url = Column(Text, default="")
    platform = Column(String, default="Pasted text")
    transcript = Column(Text, default="")
    summary = Column(Text, default="")
    notes = Column(Text, default="")
    tags = Column(JSON, default=list)
    language = Column(String, default="English")
    status = Column(String, default="INBOX", index=True)
    dna = Column(JSON, default=dict)
    raw_result = Column(Text, default="")


class Project(Record, Base):
    __tablename__ = "projects"
    channel_id = Column(String, ForeignKey("channels.id", ondelete="RESTRICT"), index=True, nullable=False)
    source_id = Column(String, ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(300), nullable=False)
    duration_mode = Column(String, default="10")
    target_minutes = Column(Float, default=10)
    wpm = Column(Integer, default=150)
    stage = Column(String, default="DIRECTION", index=True)
    selected_premise_id = Column(String, nullable=True)
    story_version = Column(Integer, default=0)
    locked = Column(Boolean, default=False)
    audit_cycle = Column(Integer, default=0)
    draft = Column(Text, default="")
    publish = Column(JSON, default=dict)
    settings = Column(JSON, default=dict)
    is_demo = Column(Boolean, default=False)


class Artifact(Record, Base):
    __tablename__ = "artifacts"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    source_id = Column(String, ForeignKey("sources.id", ondelete="CASCADE"), nullable=True)
    channel_id = Column(String, ForeignKey("channels.id", ondelete="CASCADE"), nullable=True)
    kind = Column(String, index=True)
    provider = Column(String)
    content = Column(JSON, default=dict)
    raw_result = Column(Text, default="")
    template_version = Column(String)
    inputs_hash = Column(String)
    output_hash = Column(String)
    story_version = Column(Integer, default=0)


class Premise(Record, Base):
    __tablename__ = "premises"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title = Column(String)
    logline = Column(Text)
    category = Column(String, default="Core")
    scores = Column(JSON, default=dict)
    mini_test = Column(JSON, default=dict)
    warnings = Column(JSON, default=list)
    signature = Column(JSON, default=dict)


class StoryVersion(Record, Base):
    __tablename__ = "story_versions"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    version = Column(Integer)
    text = Column(Text)
    text_hash = Column(String)
    locked = Column(Boolean, default=False)
    affected = Column(JSON, default=dict)


class Issue(Record, Base):
    __tablename__ = "audit_issues"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    issue_key = Column(String)
    scope = Column(String, default="story")
    cycle = Column(Integer, default=0)
    severity = Column(String, default="MEDIUM", index=True)
    type = Column(String)
    location = Column(String)
    evidence = Column(Text)
    explanation = Column(Text)
    repair = Column(Text)
    gemini_claim = Column(Text, default="")
    chatgpt_verdict = Column(String, default="PENDING")
    challenge = Column(Text, default="")
    final_status = Column(String, default="PENDING")
    fix_status = Column(String, default="OPEN")
    resolution = Column(Text, default="")
    bible_references = Column(JSON, default=list)


class Chunk(Record, Base):
    __tablename__ = "tts_chunks"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    story_version = Column(Integer)
    number = Column(Integer)
    text = Column(Text)
    word_count = Column(Integer)
    estimated_duration = Column(Float)
    reasons = Column(JSON, default=list)
    previous_context = Column(Text, default="")
    next_context = Column(Text, default="")
    mood = Column(String, default="Measured, suspenseful")
    voice_profile = Column(JSON, default=dict)
    status = Column(String, default="PENDING")
    asset_id = Column(String, nullable=True)
    offset = Column(Float, default=0)
    real_duration = Column(Float, nullable=True)


class Scene(Record, Base):
    __tablename__ = "visual_scenes"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    story_version = Column(Integer)
    number = Column(Integer)
    scene_key = Column(String)
    text = Column(Text, default="")
    start_word = Column(Integer, default=0)
    end_word = Column(Integer, default=0)
    visual_type = Column(String, default="IMAGE")
    prompt = Column(Text, default="")
    negative_prompt = Column(Text, default="No text, no logos, no watermarks")
    continuity = Column(JSON, default=dict)
    offset = Column(Float, default=0)
    duration = Column(Float, default=0)
    asset_id = Column(String, nullable=True)
    fallback_asset_id = Column(String, nullable=True)
    status = Column(String, default="PENDING")


class Asset(Record, Base):
    __tablename__ = "assets"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name = Column(String)
    path = Column(String)
    kind = Column(String, index=True)
    sha256 = Column(String, index=True)
    size = Column(Integer)
    duration = Column(Float, nullable=True)
    metadata_json = Column(JSON, default=dict)
    story_version = Column(Integer)


class Job(Record, Base):
    __tablename__ = "jobs"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    channel_id = Column(String, ForeignKey("channels.id", ondelete="CASCADE"), nullable=True)
    source_id = Column(String, ForeignKey("sources.id", ondelete="CASCADE"), nullable=True)
    kind = Column(String)
    provider = Column(String, default="mock")
    status = Column(String, default="queued", index=True)
    progress = Column(Integer, default=0)
    step = Column(String, default="Queued")
    payload = Column(JSON, default=dict)
    result = Column(JSON, default=dict)
    prompt = Column(Text, default="")
    error = Column(Text, default="")
    logs = Column(JSON, default=list)
    attempts = Column(Integer, default=0)


class Analytics(Record, Base):
    __tablename__ = "analytics"
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    date = Column(String, index=True)
    views = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    ctr = Column(Float, default=0)
    average_view_duration = Column(Float, default=0)
    average_percentage_viewed = Column(Float, default=0)
    subscribers_gained = Column(Integer, default=0)
    returning_viewers = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)


class CalendarEntry(Record, Base):
    __tablename__ = "calendar"
    channel_id = Column(String, ForeignKey("channels.id", ondelete="CASCADE"), index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    title = Column(String)
    target_date = Column(String, index=True)
    category = Column(String, default="Core")
    duration = Column(Float, default=10)
    status = Column(String, default="PLANNED")


class Novelty(Record, Base):
    __tablename__ = "novelty_memory"
    channel_id = Column(String, ForeignKey("channels.id", ondelete="CASCADE"), index=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title = Column(String)
    signature = Column(JSON, default=dict)
    text_hash = Column(String, index=True)
    tokens = Column(JSON, default=list)


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(JSON)


Index("ix_artifact_latest", Artifact.project_id, Artifact.kind, Artifact.created_at)
Index("ix_issue_cycle", Issue.project_id, Issue.cycle, Issue.scope)


def serialize(record):
    return {column.name: getattr(record, column.name) for column in record.__table__.columns}
