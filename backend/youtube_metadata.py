"""Story-specific upload packaging. Editorial estimates are not audience data."""
import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .models import Artifact, Asset, Channel, Chunk, Scene, Premise, serialize
from .intelligence import digest

CONTRACT_VERSION = 2
POLICY_SOURCES = [
    'https://support.google.com/youtube/answer/12340300',
    'https://support.google.com/youtube/answer/146402',
    'https://support.google.com/youtube/answer/16391400',
    'https://support.google.com/youtube/answer/6390658',
    'https://support.google.com/youtube/answer/2801973',
    'https://support.google.com/youtube/answer/14328491',
    'https://developers.google.com/youtube/v3/docs/videos',
]
STRATEGIES = {'A': 'concrete_anomaly', 'B': 'search_context', 'C': 'first_person_curiosity'}
EvidenceType = Literal['youtube_analytics', 'trend_research', 'observed_niche_phrase', 'story_semantic', 'editorial_inference']
TRUE_CLAIM = re.compile(
    r'\b(?:based on (?:a |the )?(?:true|real) (?:story|events?)|'
    r'(?:true|real) (?:(?:horror|scary|night shift|crime|life) )?stor(?:y|ies)|'
    r'actual events?|really happened|truehorrorstor(?:y|ies)|truestor(?:y|ies)|realhorrorstor(?:y|ies))\b|(?:^|[|:\-])\s*TRUE\b', re.I | re.M)


def claims_true_events(text):
    # A clear denial is a fiction disclosure, not a positive truth claim.
    text = re.sub(r'\b(?:not|never)(?:\s+based on)?\s+(?:a\s+)?(?:true|real|actual)\s+(?:horror\s+)?(?:stor(?:y|ies)|events?)\b', '', text, flags=re.I)
    return bool(TRUE_CLAIM.search(text))


class TrafficProfile(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    suggested_percent: float | None = Field(default=None, ge=0, le=100)
    browse_percent: float | None = Field(default=None, ge=0, le=100)
    search_percent: float | None = Field(default=None, ge=0, le=100)

    @field_validator('*', mode='before')
    @classmethod
    def no_boolean(cls, value):
        if isinstance(value, bool):
            raise ValueError('Traffic percentages must be numbers or blank')
        return value

    @model_validator(mode='after')
    def total(self):
        if sum(v for v in self.model_dump().values() if v is not None) > 100.01:
            raise ValueError('Traffic percentages cannot total more than 100%')
        return self


class KeywordEvidence(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    phrase: str = Field(min_length=1, max_length=100)
    evidence_type: EvidenceType = 'editorial_inference'
    source: str = Field(default='', max_length=500)
    notes: str = Field(default='', max_length=1000)

    @model_validator(mode='after')
    def attribution(self):
        if self.evidence_type in ('youtube_analytics', 'trend_research', 'observed_niche_phrase') and not self.source:
            raise ValueError('Observed keyword evidence needs a source or Analytics reference')
        return self


class MetadataPreferences(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    traffic_profile: TrafficProfile = Field(default_factory=TrafficProfile)
    fiction_disclosure_enabled: bool = True
    fiction_disclosure_text: str = Field(default='This is a fictional story created for entertainment.', min_length=1, max_length=300)
    keyword_evidence: list[KeywordEvidence] = Field(default_factory=list, max_length=12)

    @field_validator('fiction_disclosure_text')
    @classmethod
    def accurate_disclosure(cls, value):
        if claims_true_events(value) or '\x00' in value or '<' in value or '>' in value:
            raise ValueError('Fiction disclosure cannot claim a true story or contain markup')
        return value


class MetadataInputs(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    channel_preferences: MetadataPreferences
    thumbnail_text: str = Field(default='', max_length=200)


class EditorialScores(BaseModel):
    """AI rubric values, never probabilities of clicks, retention or views."""
    model_config = ConfigDict(extra='forbid')
    clarity: int = Field(ge=0, le=100)
    curiosity: int = Field(ge=0, le=100)
    specificity: int = Field(ge=0, le=100)
    story_accuracy: int = Field(ge=0, le=100)
    suggested_fit: int = Field(ge=0, le=100)
    search_fit: int = Field(ge=0, le=100)
    channel_fit: int = Field(ge=0, le=100)
    thumbnail_complement: int | None = Field(default=None, ge=0, le=100)
    genericness_risk: int = Field(ge=0, le=100)
    keyword_stuffing_risk: int = Field(ge=0, le=100)


class TitleVariant(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    id: Literal['A', 'B', 'C']
    strategy: Literal['concrete_anomaly', 'search_context', 'first_person_curiosity']
    title: str = Field(min_length=1, max_length=100)
    evidence_quote: str = Field(default='', max_length=600)
    thumbnail_complement_reason: str = Field(default='', max_length=1000)
    scores: EditorialScores


class KeywordCluster(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    primary: str = Field(min_length=1, max_length=100)
    secondary: list[str] = Field(default_factory=list, max_length=6)
    evidence_type: EvidenceType = 'story_semantic'


class StoryPackaging(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    protagonist: str = Field(default='', max_length=300)
    occupation: str = Field(default='', max_length=300)
    primary_location: str = Field(default='', max_length=300)
    concrete_anchors: list[str] = Field(min_length=1, max_length=8)
    central_anomaly: str = Field(min_length=1, max_length=1000)
    escalation: str = Field(default='', max_length=1000)
    genre: str = Field(min_length=1, max_length=100)
    audience_intent: str = Field(default='', max_length=500)
    evidence_quotes: list[str] = Field(min_length=1, max_length=4)


class MetadataNotes(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    title_reason: str = Field(min_length=1, max_length=1500)
    suffix_decision: str = Field(min_length=1, max_length=1000)
    search_vs_suggested_strategy: str = Field(min_length=1, max_length=1000)
    accuracy_notes: list[str] = Field(default_factory=list, max_length=12)


class YouTubeMetadata(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=100)
    recommended_title: str = Field(default='', max_length=100)
    title_variants: list[TitleVariant] = Field(default_factory=list, max_length=3)
    story_packaging: StoryPackaging | None = None
    primary_keyword_cluster: KeywordCluster | None = None
    description: str = Field(min_length=1, max_length=5000)
    tags: list[str] = Field(min_length=1, max_length=30)
    hashtags: list[str] = Field(default_factory=list, max_length=3)
    alternative_titles: list[str] = Field(default_factory=list, max_length=3)
    thumbnail_title_overlap_risk: int | None = Field(default=None, ge=0, le=100)
    metadata_notes: MetadataNotes | None = None
    seo_notes: str = Field(default='', max_length=3000)
    review_notes: list[str] = Field(default_factory=list, max_length=12)

    @model_validator(mode='before')
    @classmethod
    def legacy_fields(cls, value):
        if isinstance(value, dict):
            value = dict(value)
            if value.get('recommended_title') and not value.get('title'):
                value['title'] = value['recommended_title']
        return value

    @field_validator('title', 'description', 'recommended_title')
    @classmethod
    def plain_text(cls, value):
        if '<' in value or '>' in value or '\x00' in value:
            raise ValueError('YouTube title and description cannot contain <, > or null characters')
        return value

    @field_validator('tags', 'hashtags', 'alternative_titles', 'review_notes')
    @classmethod
    def clean_list(cls, values):
        cleaned = list(dict.fromkeys(v.strip() for v in values if v.strip()))
        if any(len(v) > 1000 or '\x00' in v for v in cleaned):
            raise ValueError('Metadata list item is too long or contains invalid characters')
        return cleaned

    @model_validator(mode='after')
    def platform_limits(self):
        if len(self.description.encode('utf-8')) > 5000:
            raise ValueError('YouTube description must fit within 5000 UTF-8 bytes')
        if not self.tags or any(len(t) > 100 or ',' in t or '\n' in t for t in self.tags):
            raise ValueError('Use separate, non-empty keyword tags without commas or newlines')
        if sum(len(t) + (2 if ' ' in t else 0) for t in self.tags) + max(0, len(self.tags) - 1) > 500:
            raise ValueError('YouTube tags exceed the combined 500-character limit')
        if any(not re.fullmatch(r'#[\w]+', h) for h in self.hashtags):
            raise ValueError('Hashtags must start with # and contain no spaces')
        titles = [self.title, *self.alternative_titles, *(v.title for v in self.title_variants)]
        if any(len(t) > 100 or '\n' in t or '\r' in t or '<' in t or '>' in t or '\x00' in t for t in titles):
            raise ValueError('Use single-line titles of at most 100 characters')
        if claims_true_events('\n'.join([*titles, self.description, *self.tags, *self.hashtags])):
            raise ValueError('Fiction metadata cannot claim a true story or actual events')
        self.recommended_title = self.recommended_title or self.title
        if self.recommended_title != self.title:
            raise ValueError('Title must match the recommended title')
        if self.title_variants:
            if len(self.title_variants) != 3 or {v.id for v in self.title_variants} != set(STRATEGIES):
                raise ValueError('Provide exactly three title strategies: A, B and C')
            if any(v.strategy != STRATEGIES[v.id] for v in self.title_variants):
                raise ValueError('Each title variant must use its assigned strategy')
            if len({normal(v.title) for v in self.title_variants}) != 3:
                raise ValueError('Title variants must not be duplicate rewrites')
            if self.title not in [v.title for v in self.title_variants]:
                raise ValueError('Recommended title must be one of the three variants')
            self.title_variants.sort(key=lambda v: v.id)
            self.alternative_titles = [v.title for v in self.title_variants if v.title != self.title]
        return self


def normal(text):
    return ' '.join(str(text).casefold().replace('’', "'").replace('“', '"').replace('”', '"').split())


def preferences(channel):
    return MetadataPreferences.model_validate((channel.settings or {}).get('youtube_metadata', {}))


def traffic_strategy(profile):
    values = profile.model_dump()
    if any(v is None for v in values.values()):
        mode = 'packaging_first'
    elif profile.search_percent > profile.suggested_percent + profile.browse_percent:
        mode = 'search_context'
    elif profile.search_percent < profile.suggested_percent + profile.browse_percent:
        mode = 'suggested_browse'
    else:
        mode = 'balanced'
    return {'mode': mode, 'traffic_profile': values, 'provenance': 'creator_supplied' if any(v is not None for v in values.values()) else 'not_supplied',
            'priority': ['story_accuracy', 'anomaly', 'concrete_context', 'curiosity', 'natural_language', 'concision', 'useful_search_context', 'channel_fit'],
            'note': 'Compare only the supplied traffic categories. Missing values are unknown, not zero. No predicted CTR or keyword-volume data.'}


def metadata_inputs(project, channel):
    return {'channel_preferences': preferences(channel).model_dump(),
            'thumbnail_text': (project.settings or {}).get('youtube_metadata', {}).get('thumbnail_text', '')
            if (project.settings or {}).get('youtube_metadata', {}).get('thumbnail_story_version', project.story_version) == project.story_version else ''}


def metadata_context(db, project):
    channel = db.get(Channel, project.channel_id)
    chunks = db.query(Chunk).filter_by(project_id=project.id, story_version=project.story_version).order_by(Chunk.number).all()
    scenes = db.query(Scene).filter_by(project_id=project.id, story_version=project.story_version).order_by(Scene.number).all()
    premise = db.get(Premise, project.selected_premise_id) if project.selected_premise_id else None
    artifacts = {}
    for artifact in db.query(Artifact).filter_by(project_id=project.id).order_by(Artifact.created_at, Artifact.id):
        if artifact.kind in ('story_bible', 'outline', 'outline_rewrite', 'opening_choice'):
            artifacts[artifact.kind] = artifact.content
    inputs = metadata_inputs(project, channel)
    thumbnail_id = (project.publish or {}).get('thumbnail_asset_id')
    thumbnail = db.get(Asset, thumbnail_id) if thumbnail_id else None
    # Only known text is evidence. Do not infer text by looking at a file name or an image prompt.
    actual_text = inputs['thumbnail_text']
    text_known = bool(actual_text)
    pairing = {}
    if thumbnail and thumbnail.project_id == project.id and thumbnail.story_version == project.story_version:
        data = thumbnail.metadata_json or {}
        review = data.get('thumbnail_review', {})
        reviewed = review.get('asset_sha256') == thumbnail.sha256 and review.get('text_correct') is True
        if not actual_text:
            actual_text = review.get('actual_text', '') if reviewed else data.get('title', '')
        text_known = reviewed or bool(actual_text)
        if review.get('passed') and review.get('asset_sha256') == thumbnail.sha256:
            plan = next((row for row in db.query(Artifact).filter_by(project_id=project.id, kind='thumbnail_plan', story_version=project.story_version)
                         if (row.content.get('plan_hash') or row.content.get('content_fingerprint')) == data.get('thumbnail_plan_hash')), None)
            variant = next((v for v in plan.content['thumbnail_variants'] if v['id'] == data.get('thumbnail_variant')), None) if plan else None
            if variant:
                pairing = {'concept':variant['concept'], 'composition':variant['composition'],
                           'provenance':'human_confirmed_image_matches_concept; evaluate title pairing editorially'}
    return {
        'contract_version': CONTRACT_VERSION,
        'project': {k: serialize(project)[k] for k in ('id', 'title', 'draft', 'story_version', 'target_minutes', 'locked')},
        'channel': {k: serialize(channel)[k] for k in ('name', 'language', 'niche', 'country', 'age_range', 'dna')},
        'narration_segments': [{'number': c.number, 'text': c.text, 'status': c.status, 'seconds': c.real_duration} for c in chunks],
        'visual_plan': [{'scene': s.scene_key, 'prompt': s.prompt} for s in scenes],
        'story_evidence': {'bible': artifacts.get('story_bible', {}), 'outline': artifacts.get('outline_rewrite', artifacts.get('outline', {}))},
        'selected_premise': {k: getattr(premise, k) for k in ('title', 'logline', 'signature')} if premise else {},
        'selected_packaging': (premise.packaging or {}) if premise else {},
        'thumbnail': {'text': actual_text, 'text_known': text_known, 'reviewed_visual':pairing,
                      'asset_id': thumbnail.id if thumbnail and thumbnail.project_id == project.id else None,
                      'concept': (project.publish or {}).get('thumbnail_concept', '')},
        'metadata_preferences': inputs['channel_preferences'],
        'traffic_strategy': traffic_strategy(preferences(channel).traffic_profile),
        'fiction_policy': 'This app adapts fictional stories. Source inspirations are not verification of true events.',
        'policy_sources': POLICY_SOURCES,
    }


def metadata_fingerprint(db, project):
    return digest(metadata_context(db, project))


def overlap_risk(title, thumbnail_text):
    if not thumbnail_text:
        return None
    stop = {'the', 'a', 'an', 'is', 'was', 'at', 'in', 'of', 'to', 'from', 'my', 'i', 'and', 'it', 'on', 'for'}
    def terms(text):
        return set(re.findall(r'\b\w+\b', text.casefold())) - stop
    thumbnail = terms(thumbnail_text)
    return round(100 * len(terms(title) & thumbnail) / len(thumbnail)) if thumbnail else None


def validate_metadata(output, context, require_contract=False):
    content = dict(output)
    prefs = context['metadata_preferences']
    if prefs['fiction_disclosure_enabled'] and isinstance(content.get('description'), str) and content['description'].strip():
        disclosure = prefs['fiction_disclosure_text']
        if normal(disclosure) not in normal(content['description']):
            content['description'] = content['description'].rstrip() + '\n\n' + disclosure
    result = YouTubeMetadata.model_validate(content)
    if require_contract and (not result.title_variants or not result.story_packaging or not result.primary_keyword_cluster or not result.metadata_notes):
        raise ValueError('Provide the three title strategies, story evidence, keyword cluster and metadata notes')
    if result.title_variants and len(result.tags) > 8:
        raise ValueError('Use at most eight focused tags for the new metadata package')
    if result.story_packaging:
        # Exact evidence is checked against this story, never a source inspiration or another project.
        def text_values(value):
            if isinstance(value, str):
                return [value]
            if isinstance(value, dict):
                return [s for v in value.values() for s in text_values(v)]
            if isinstance(value, list):
                return [s for v in value for s in text_values(v)]
            return []
        evidence = normal(context['project']['draft'] + '\n' + '\n'.join(text_values(context['story_evidence'])) +
                          '\n' + '\n'.join(c['text'] for c in context['narration_segments']))
        quotes = [*result.story_packaging.evidence_quotes, *(v.evidence_quote for v in result.title_variants if v.evidence_quote)]
        if any(len(normal(q)) < 12 or normal(q) not in evidence for q in quotes):
            raise ValueError('Metadata evidence must quote the current story or Bible exactly')
        if require_contract and any(not v.evidence_quote for v in result.title_variants):
            raise ValueError('Each title strategy needs an exact quote from the current story or Bible')
    cluster = result.primary_keyword_cluster
    if cluster and cluster.evidence_type in ('youtube_analytics', 'trend_research', 'observed_niche_phrase'):
        if not any(normal(k['phrase']) == normal(cluster.primary) and k['evidence_type'] == cluster.evidence_type
                   for k in prefs['keyword_evidence']):
            raise ValueError('Keyword research claims need matching supplied evidence; otherwise use story_semantic or editorial_inference')
    word_overlap = overlap_risk(result.title, context['thumbnail']['text'])
    semantic_pairing = bool(context['thumbnail'].get('reviewed_visual'))
    if not semantic_pairing:
        result.thumbnail_title_overlap_risk = word_overlap
        for variant in result.title_variants:
            risk = overlap_risk(variant.title, context['thumbnail']['text'])
            variant.scores.thumbnail_complement = None if risk is None else 100 - risk
    data = result.model_dump()
    data['contract_version'] = CONTRACT_VERSION if result.title_variants else 1
    data['traffic_strategy'] = context['traffic_strategy']
    data['thumbnail_title_word_overlap'] = word_overlap
    for variant in data['title_variants']:
        variant['thumbnail_word_overlap'] = overlap_risk(variant['title'], context['thumbnail']['text'])
    data['score_provenance'] = ('editorial_ai_estimate_of_title_image_pairing; image concept confirmed by creator; not observed performance'
                              if semantic_pairing else 'editorial_ai_estimate; thumbnail overlap is a local word-overlap heuristic, not observed performance')
    data['keyword_evidence'] = [k for k in prefs['keyword_evidence'] if cluster and normal(k['phrase']) == normal(cluster.primary)]
    return data


def upload_text(content, project_title='', version=None):
    tags = content.get('tags', [])
    if isinstance(tags, list):
        tags = ', '.join(tags)
    variants = '\n'.join(f"{v['id']} — {v['strategy']}: {v['title']}" for v in content.get('title_variants', []))
    cluster = content.get('primary_keyword_cluster') or {}
    notes = content.get('metadata_notes') or {}
    strategy_notes = '\n'.join(f'{key}: {value}' for key, value in notes.items() if key != 'accuracy_notes')
    keyword = '\n'.join([cluster.get('primary', ''), ', '.join(cluster.get('secondary', [])), 'Evidence: ' + cluster.get('evidence_type', 'editorial_inference')]) if cluster else ''
    supplied_evidence = '\n'.join(f"{k['phrase']} [{k['evidence_type']}] — {k['source']}" for k in content.get('keyword_evidence', []))
    sections = [('YOUTUBE UPLOAD INFORMATION', f'Project: {project_title}\nStory version: {version or "—"}'),
                ('VIDEO TITLE', content.get('recommended_title') or content.get('title', '')), ('DESCRIPTION', content.get('description', '')),
                ('TAGS (paste into the Tags field, not the description)', tags),
                ('HASHTAGS (optional)', ' '.join(content.get('hashtags', []))),
                ('TITLE TEST STRATEGIES — EDITORIAL HYPOTHESES', variants),
                ('ALTERNATIVE TITLES', '\n'.join(content.get('alternative_titles', [])) if not variants else ''),
                ('KEYWORD CLUSTER — FOR CREATOR REVIEW', keyword),
                ('CREATOR-SUPPLIED KEYWORD EVIDENCE — NOT INDEPENDENTLY VERIFIED', supplied_evidence),
                ('PACKAGING NOTES — FOR CREATOR REVIEW', strategy_notes),
                ('SEO NOTES — FOR CREATOR REVIEW', content.get('seo_notes', '')),
                ('REVIEW BEFORE UPLOADING', '\n'.join([*content.get('review_notes', []), *notes.get('accuracy_notes', [])])),
                ('NOTE', 'Variants and AI scores are editorial hypotheses, not predictions of CTR, retention, views or search demand. Review the final video and media rights.'),
                ('YOUTUBE REFERENCES', '\n'.join(POLICY_SOURCES))]
    return '\n\n'.join(f'{heading}\n{value}' for heading, value in sections if value) + '\n'
