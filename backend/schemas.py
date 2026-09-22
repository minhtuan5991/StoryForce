from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    status: Literal["ESTABLISHED", "DISCOVERY"] = "DISCOVERY"
    niche: str = ""
    country: str = "United States"
    age_range: str = "25–54"
    language: str = "English (US)"
    default_duration: float = Field(10, ge=1, le=240)
    color: Literal["blue", "amber", "violet", "teal"] = "blue"


class SourceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    url: str = ""
    platform: str = "Pasted text"
    transcript: str = Field("", max_length=1_500_000)
    summary: str = ""
    notes: str = ""
    tags: list[str] = []
    language: str = "English"
    channel_id: str | None = None


class ProjectCreate(BaseModel):
    channel_id: str
    source_id: str | None = None
    title: str = Field(min_length=1, max_length=300)
    duration_mode: str = "10"
    target_minutes: float = Field(10, ge=1, le=240)
    wpm: int = Field(150, ge=80, le=240)


class JobCreate(BaseModel):
    kind: str
    project_id: str | None = None
    source_id: str | None = None
    channel_id: str | None = None
    payload: dict = {}


class AnalyticsCreate(BaseModel):
    project_id: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    views: int = Field(0, ge=0)
    impressions: int = Field(0, ge=0)
    ctr: float = Field(0, ge=0, le=100)
    average_view_duration: float = Field(0, ge=0)
    average_percentage_viewed: float = Field(0, ge=0, le=100)
    subscribers_gained: int = 0
    returning_viewers: int = Field(0, ge=0)
    likes: int = Field(0, ge=0)
    comments: int = Field(0, ge=0)


class AIIssue(BaseModel):
    issue_id: str
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "SUGGESTION"]
    type: str
    location: str = Field(min_length=1)
    evidence: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    suggested_repair: str = Field(min_length=1)
    bible_references: list[str] = []


class AuditResult(BaseModel):
    issues: list[AIIssue]
    summary: str = ""


class Verification(BaseModel):
    passed: bool
    critical: int = Field(ge=0)
    high: int = Field(ge=0)
    summary: str


class StoryDNA(BaseModel):
    primary_genre: str
    subgenres: list[str]
    tropes: list[str]
    hook_mechanics: list[str]
    story_mechanics: list[str]
    conflicts: list[str]
    emotional_payoffs: list[str]
    twist_types: list[str]
    pacing_style: str
    setting_type: str
    character_archetypes: list[str]
    audience_signals: list[str]
    source_specific_elements_to_avoid_copying: list[str]
