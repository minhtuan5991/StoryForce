"""ChatGPT handoff data; publishing remains a manual user action."""
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .models import Channel, Chunk, Scene, serialize
from .intelligence import digest

POLICY_SOURCES = [
    'https://support.google.com/youtube/answer/146402',
    'https://support.google.com/youtube/answer/141805',
    'https://support.google.com/youtube/answer/2801973',
    'https://support.google.com/youtube/answer/14328491',
]

class YouTubeMetadata(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=5000)
    tags: list[str] = Field(min_length=1, max_length=30)
    hashtags: list[str] = Field(default_factory=list, max_length=3)
    alternative_titles: list[str] = Field(default_factory=list, max_length=3)
    seo_notes: str = Field(default='', max_length=3000)
    review_notes: list[str] = Field(default_factory=list, max_length=12)

    @field_validator('title', 'description')
    @classmethod
    def plain_text(cls, value):
        if '<' in value or '>' in value or '\x00' in value:
            raise ValueError('YouTube title and description cannot contain <, > or null characters')
        return value

    @field_validator('tags', 'hashtags', 'alternative_titles', 'review_notes')
    @classmethod
    def clean_list(cls, values):
        cleaned = list(dict.fromkeys(v.strip() for v in values if v.strip()))
        if any(len(v)>1000 or '\x00' in v for v in cleaned):
            raise ValueError('Metadata list item is too long or contains invalid characters')
        return cleaned

    @model_validator(mode='after')
    def platform_limits(self):
        # Conservative API limits also work when copied into YouTube Studio.
        if len(self.description.encode('utf-8'))>5000:
            raise ValueError('YouTube description must fit within 5000 UTF-8 bytes')
        if not self.tags or any(len(t)>100 or ',' in t or '\n' in t for t in self.tags):
            raise ValueError('Use separate, non-empty keyword tags without commas or newlines')
        if sum(len(t)+(2 if ' ' in t else 0) for t in self.tags)+max(0,len(self.tags)-1)>500:
            raise ValueError('YouTube tags exceed the combined 500-character limit')
        if any(not re.fullmatch(r'#[\w]+',h) for h in self.hashtags):
            raise ValueError('Hashtags must start with # and contain no spaces')
        if any(len(t)>100 or '\n' in t or '<' in t or '>' in t for t in [self.title,*self.alternative_titles]):
            raise ValueError('Use single-line titles of at most 100 characters')
        return self

def metadata_context(db, project):
    channel=db.get(Channel,project.channel_id)
    chunks=db.query(Chunk).filter_by(project_id=project.id,story_version=project.story_version).order_by(Chunk.number).all()
    scenes=db.query(Scene).filter_by(project_id=project.id,story_version=project.story_version).order_by(Scene.number).all()
    return {
        'project': {k:serialize(project)[k] for k in ('id','title','draft','story_version','target_minutes','locked')},
        'channel': {k:serialize(channel)[k] for k in ('name','language','niche','country','age_range','dna')},
        'narration_segments':[{'number':c.number,'text':c.text,'status':c.status,'seconds':c.real_duration} for c in chunks],
        'visual_plan':[{'scene':s.scene_key,'prompt':s.prompt} for s in scenes],
        'policy_sources':POLICY_SOURCES,
    }

def metadata_fingerprint(db, project):
    return digest(metadata_context(db,project))

def upload_text(content, project_title='', version=None):
    # Distinguish ready-to-paste fields from internal suggestions/review notes.
    tags=content.get('tags',[])
    if isinstance(tags,list):tags=', '.join(tags)
    sections=[('YOUTUBE UPLOAD INFORMATION',f'Project: {project_title}\nStory version: {version or "—"}'),
              ('VIDEO TITLE',content.get('title','')),('DESCRIPTION',content.get('description','')),
              ('TAGS (paste into the Tags field, not the description)',tags),
              ('HASHTAGS (optional)', ' '.join(content.get('hashtags',[]))),
              ('ALTERNATIVE TITLES', '\n'.join(content.get('alternative_titles',[]))),
              ('SEO NOTES — FOR CREATOR REVIEW',content.get('seo_notes','')),
              ('REVIEW BEFORE UPLOADING','\n'.join(content.get('review_notes',[]))),
              ('NOTE','Review the final video and rights to all media. Metadata is a suggestion, not a guarantee of policy approval, ranking or monetization.'),
              ('YOUTUBE REFERENCES','\n'.join(POLICY_SOURCES))]
    return '\n\n'.join(f'{heading}\n{value}' for heading,value in sections if value)+'\n'
