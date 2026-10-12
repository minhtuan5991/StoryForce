"""Versioned creative directions. Technical settings and legacy prompts stay separate."""
from copy import deepcopy
import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from sqlalchemy import desc, func, select

from .intelligence import digest
from .models import Channel, ChannelGuidance, DNAVersion, Job, now, serialize

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1600)]
Rules = Annotated[list[Text], Field(min_length=1, max_length=12)]
PARTS = ('identity', 'writing', 'review_packaging')
STEP_GROUPS = {
    'channel_fit': 'ideas', 'discovery': 'ideas', 'content_direction': 'ideas',
    'premise_generation': 'ideas', 'premise_mini_test': 'ideas', 'story_bible': 'bible',
    'outline': 'outline', 'outline_rewrite': 'outline', 'opening_variants': 'draft', 'full_draft': 'draft',
    'outline_audit': 'review', 'gemini_story_audit': 'review', 'chatgpt_cross_review': 'review',
    'disagreement_resolver': 'review', 'targeted_rewrite': 'review', 'retention_audit': 'review',
    'retention_rewrite': 'review', 'final_verify_gemini': 'review', 'final_verify_chatgpt': 'review',
    'visual_director': 'packaging', 'thumbnail_plan': 'packaging', 'youtube_metadata': 'packaging',
    'image_generation': 'packaging',
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class CreativeBrief(StrictModel):
    genre_mode: Literal['family_drama', 'speculative_mystery', 'custom'] = 'custom'
    audience_promise: Text
    narrative_voice: Text
    conflict_engine: Text
    hook_style: Text
    twist_style: Text
    ending_style: Text
    fiction_boundary: Text
    avoid: list[Text] = Field(default_factory=list, max_length=12)


class Identity(StrictModel):
    audience_promise: Text
    narrative_voice: Text
    conflict_engine: Text
    emotional_arc: Text
    fiction_boundary: Text


class HookExample(StrictModel):
    hook: Text
    reason: Text


class Reference(StrictModel):
    title: Text
    url: Annotated[str, StringConstraints(pattern=r'^https?://[^\s]+$', max_length=1500)]
    insight: Text


class Research(StrictModel):
    mode: Literal['dna_only', 'web_references']
    sources: list[Reference] = Field(default_factory=list, max_length=6)
    notes: Text


class IdentityPart(StrictModel):
    identity: Identity
    global_rules: Rules
    hook_examples: list[HookExample] = Field(min_length=1, max_length=3)
    avoid: Rules
    research: Research


class WritingRules(StrictModel):
    ideas: Rules
    bible: Rules
    outline: Rules
    draft: Rules


class ReviewRules(StrictModel):
    review: Rules
    packaging: Rules


class WritingPart(StrictModel):
    step_rules: WritingRules
    research: Research


class ReviewPart(StrictModel):
    step_rules: ReviewRules
    research: Research


class AllRules(WritingRules, ReviewRules):
    pass


class Guidance(IdentityPart):
    step_rules: AllRules


def default_brief(name='', niche=''):
    if name.casefold().strip() == 'heart & hurdles':
        return {
            'genre_mode': 'family_drama',
            'audience_promise': 'Intense family drama: apparently irrational choices gain a believable, surprising explanation.',
            'narrative_voice': 'Intimate natural American English; emotionally precise dialogue and actions, varied sentence rhythm.',
            'conflict_engine': 'Conflicting family loyalties, care, trust, shame, money, inheritance and emotional boundaries.',
            'hook_style': 'Open on a loved one making a contradictory, painful decision; establish the relationship and concrete stakes within 30 seconds.',
            'twist_style': 'An earned midpoint reversal reveals a previously seeded motive and reinterprets earlier actions.',
            'ending_style': 'Resolve the immediate family decision and its emotional cost; reconciliation or firm boundaries must be earned.',
            'fiction_boundary': 'Fictional family stories. Apparently absurd situations require plausible human causes; no supernatural solution.',
            'avoid': ['Supernatural explanations', 'Generic evil relatives', 'Endless shouting without progress', 'Late unseeded evidence', 'Mandatory forgiveness'],
        }
    if name.casefold().strip() == 'the veiled signal':
        return {
            'genre_mode': 'speculative_mystery',
            'audience_promise': 'Evidence-driven science-fiction mysteries: an ordinary scientific detail opens into an unfamiliar hidden reality.',
            'narrative_voice': 'Clear natural American English; observant, curious, precise, with understandable scientific detail.',
            'conflict_engine': 'Independent observations challenge a rational explanation and reveal a fictional hidden program, alien life or limited unknown technology.',
            'hook_style': 'Present a specific anomalous observation or clue in the first 10 seconds; show why it matters within 30 seconds.',
            'twist_style': 'The midpoint discovery reinterprets the evidence; technology follows established rules, limits and costs.',
            'ending_style': 'Explain the immediate event and consequences; a supported larger uncertainty may remain open.',
            'fiction_boundary': 'Real science is the foundation; concealed organizations, conspiracies and extraordinary discoveries are fictional. Distinguish facts, hypotheses and inventions.',
            'avoid': ['Invented science presented as established fact', 'Accusations against real organizations', 'Unlimited technology', 'Jargon dumps', 'Generic monsters unrelated to the clues'],
        }
    return {
        'genre_mode': 'custom', 'audience_promise': niche.strip() or 'Original stories with an earned emotional payoff.',
        'narrative_voice': 'Natural American English suited to the channel audience.',
        'conflict_engine': 'Concrete opposing goals and consequences appropriate to the selected genre.',
        'hook_style': 'A specific curiosity question or contradiction immediately, followed by stakes within 30 seconds.',
        'twist_style': 'An earned midpoint reversal supported by earlier clues.',
        'ending_style': 'Resolve the immediate problem; use an open ending only when earned.',
        'fiction_boundary': 'Fictional stories; distinguish any factual foundation from invented events.',
        'avoid': ['Copied source scenes', 'Arbitrary last-minute solutions', 'Repetitive exposition'],
    }


def validate_dna(dna):
    if not isinstance(dna, dict):
        raise ValueError('DNA must be a JSON object')
    if len(json.dumps(dna, ensure_ascii=False)) > 60000:
        raise ValueError('Channel DNA is too long (maximum 60,000 characters)')
    for key in ('primary_genres', 'core_tropes', 'avoid_genres', 'avoid_tropes'):
        if key in dna and (not isinstance(dna[key], list) or any(not isinstance(v, str) for v in dna[key])):
            raise ValueError(key + ' must be an array of strings')
    for key in ('tone', 'narration_style'):
        if key in dna and not isinstance(dna[key], str):
            raise ValueError(key + ' must be a string')
    result = deepcopy(dna)
    if 'creative_brief' in dna:
        result['creative_brief'] = CreativeBrief.model_validate(dna['creative_brief']).model_dump()
    return result


def channel_snapshot(channel):
    record = serialize(channel) if not isinstance(channel, dict) else channel
    return {key: deepcopy(record.get(key)) for key in ('name', 'niche', 'country', 'age_range', 'language', 'dna')}


def fingerprint(channel):
    return digest(channel_snapshot(channel))


def validate_part(part, result):
    model = {'identity': IdentityPart, 'writing': WritingPart, 'review_packaging': ReviewPart}[part]
    output = model.model_validate(result).model_dump()
    if output['research']['mode'] == 'web_references' and not output['research']['sources']:
        raise ValueError('Web research must include source URLs and concrete insights; otherwise use dna_only')
    if output['research']['mode'] == 'dna_only' and output['research']['sources']:
        raise ValueError('dna_only research must not claim consulted web sources')
    if len(json.dumps(output, ensure_ascii=False)) > 14000:
        raise ValueError('Research section is too long; keep only concise actionable directions')
    return output


def merge_parts(parts):
    if not all(part in parts for part in PARTS):
        raise ValueError('Complete all three research sections before applying')
    result = deepcopy(parts['identity'])
    result['step_rules'] = {**parts['writing']['step_rules'], **parts['review_packaging']['step_rules']}
    refs = {r['url']: r for part in PARTS for r in parts[part]['research']['sources']}
    result['research'] = {
        'mode': 'web_references' if refs else 'dna_only', 'sources': list(refs.values())[:6],
        'notes': ' '.join(dict.fromkeys(parts[p]['research']['notes'] for p in PARTS))[:1600],
    }
    output = Guidance.model_validate(result).model_dump()
    if len(json.dumps(output, ensure_ascii=False)) > 42000:
        raise ValueError('Combined channel directions exceed 42,000 characters')
    return output


def baseline(brief):
    """The two starting profiles implement the creative direction approved by the user."""
    family = brief['genre_mode'] == 'family_drama'
    identity = {key: brief[key] for key in ('audience_promise', 'narrative_voice', 'conflict_engine', 'fiction_boundary')}
    identity['emotional_arc'] = ('Hurt and mistrust → conflicting loyalties → earned recognition → a consequential family choice.' if family else
                                 'Curiosity → competing explanations → independent evidence → a limited discovery → consequences and supported uncertainty.'
                                 if brief['genre_mode'] == 'speculative_mystery' else
                                 'Immediate stakes → meaningful conflict → earned reinterpretation → consequential choices and genre-appropriate payoff.')
    common = [brief['hook_style'], brief['twist_style'], brief['ending_style'], brief['fiction_boundary'],
              'Every scene changes knowledge, decisions or consequences. Preserve causality, character identity and planted clues.']
    ideas = [brief['conflict_engine'], 'Transform source appeal into this channel genre. Preserve the abstract curiosity and emotional dilemma; never import an incompatible horror or survival mechanism.',
             'Keep Idea 1 reserved and original. Emotional or observational contradictions need not be physically impossible.']
    if family:
        bible = ['Give every family member a credible goal, fear, incomplete knowledge and reason for apparently irrational decisions.',
                 'Record the hidden motive, early clues, relationship changes and emotional costs. Explain practical legal/financial claims cautiously.',
                 'World rules describe plausible social and practical constraints. Leave disaster_rules empty unless the story actually needs them.']
        draft = ['Reveal conflict through specific dialogue, everyday actions, silence and competing loyalties.',
                 'Build intensity without endless shouting or stock villains. Apparent absurdity receives a plausible human explanation.',
                 'The midpoint reversal reinterprets seeded actions. The latter half follows emotional consequences and earned choices.']
        review = ['Assess believable motives, relationship continuity and the evidence supporting the revealed explanation.',
                  'Do not demand supernatural danger or physical survival. An unusual decision is not an error when its credible motive is established.',
                  'Flag unseeded explanations, convenient coincidences and inconsistent chronology with exact quotes. Never waive real continuity defects.']
        packaging = ['Use story-specific family expressions, objects, homes and contrasting emotional positions.',
                     'Three thumbnails A/B/C each combine an image and a short legible curiosity hook; typography and contrast suit family drama.',
                     'Use grounded lighting and physical emotion. No unsupported ghosts, horror lettering or cosmic imagery. Preserve character references.']
        example = {'hook': 'When my mother left the hospital, my brother refused to let her come home. Then he handed me a key to a house I had never seen.',
                   'reason': 'Fictional example: a specific family contradiction, a concrete clue and emotional stakes invite a plausible explanation.'}
    elif brief['genre_mode'] == 'speculative_mystery':
        bible = ['Separate verified scientific foundations, character hypotheses and invented extensions. Do not fabricate citations.',
                 'Define limits, costs and observable behavior of fictional technology; record the evidence sequence and rational alternatives.',
                 'Hidden organizations and conspiracies are fictional. Neutral factual organizations must not be accused of invented wrongdoing.']
        draft = ['Start with an observable clue, then test plausible explanations against independent evidence.',
                 'Explain only the scientific detail listeners need for the decision. Keep jargon brief and understandable.',
                 'The midpoint discovery changes the interpretation; the latter half explains mechanisms, limits and consequences.']
        review = ['Judge invented technology against the Bible\'s declared rules, costs and limits; do not reject declared fiction solely for being speculative.',
                  'Flag real scientific claims that lack support, inconsistent observations, impossible knowledge and invented citations.',
                  'Distinguish observations, hypotheses and fiction. Never waive causal errors or evidence requirements.']
        packaging = ['Use story-supported instruments, signals, spacecraft, laboratories and anomalies with a clear visual focal point.',
                     'Three thumbnails A/B/C each combine an image and short legible text. Use restrained scientific mystery typography and strong contrast.',
                     'Do not invent visible aliens or unsupported disaster images. Preserve character identity and plausible practical lighting. Label fictional stories clearly in metadata.']
        example = {'hook': 'We logged the pulse as background interference. But every time the probe changed course, the pulse changed with it.',
                   'reason': 'Fictional example: a simple measurement acquires a testable anomaly, without claiming an actual discovery.'}
    else:
        bible = ['Record character goals, relationships, knowledge limits, practical constraints and the planted evidence for this channel genre.',
                 brief['fiction_boundary'], 'Let the selected genre determine world rules; never import incompatible horror or speculative technology.']
        draft = [brief['narrative_voice'], brief['conflict_engine'], brief['twist_style'], brief['ending_style']]
        review = ['Assess motives, continuity, causality and the earned payoff against the supplied Bible and creative brief.',
                  'Keep exact evidence requirements. Judge genre conventions in context rather than applying an unrelated horror template.']
        packaging = ['Use story-supported people, objects and settings appropriate to the creative brief.',
                     'Three thumbnails A/B/C each combine an image and short legible text; match typography, color and mood to this channel genre.',
                     'Preserve character references and the title/thumbnail promise. Never add unsupported horror or cosmic elements.']
        example = {'hook': 'The invitation had my name on it. The person who sent it had just asked me not to come.',
                   'reason': 'Generic fictional illustration of a concrete contradiction; replace it with a hook specific to the channel and story.'}
    outline = ['Hook and a clear curiosity question in 0–10 seconds, stakes by 30 seconds; protect the opening clips\' continuous narration.',
               'Place the central reversal and main climax at 45–55%, then causal explanation, consequential choices and an earned ending.',
               'Every scene has a purpose, conflict, knowledge change and setup/payoff link; honor the supplied Bible and duration.']
    result = {'identity': identity, 'global_rules': common, 'avoid': brief['avoid'], 'hook_examples': [example],
              'step_rules': {'ideas': ideas, 'bible': bible, 'outline': outline, 'draft': draft, 'review': review, 'packaging': packaging},
              'research': {'mode': 'web_references', 'sources': [
                  {'title': 'YouTube audience retention', 'url': 'https://support.google.com/youtube/answer/9314415?hl=en',
                   'insight': 'Use the first 30 seconds to deliver the title/thumbnail promise; evaluate retention on actual published videos.'},
                  {'title': 'Creating convincing characters' if family else 'NASA: What is a biosignature?',
                   'url': 'https://www.open.edu/openlearn/history-the-arts/creative-writing/start-writing-fiction/content-section-1.1' if family else
                          'https://science.nasa.gov/astrobiology/learning-resources/alp/what-is-a-biosignature/',
                   'insight': 'Character goals and conflicts generate convincing events.' if family else
                              'Potential biosignatures require consideration of nonbiological explanations; uncertainty belongs in the story foundation.'}],
                  'notes': 'Starting directions approved in the update discussion. References support the principles, not fictional events or guaranteed performance.'}}
    return Guidance.model_validate(result).model_dump()


def bootstrap_connection(conn):
    """One-time migration, narrowly scoped to the two requested channel names."""
    for row in conn.execute(select(Channel.__table__)).mappings().all():
        if row['name'].casefold().strip() not in ('heart & hurdles', 'the veiled signal'):
            continue
        channel = dict(row)
        dna = deepcopy(channel['dna'] or {})
        brief = CreativeBrief.model_validate(dna.get('creative_brief') or default_brief(channel['name'], channel['niche'])).model_dump()
        dna['creative_brief'] = brief
        dna['tone'] = 'Emotionally intimate, dramatic, believable' if brief['genre_mode'] == 'family_drama' else 'Evidence-driven, speculative, precise and curious'
        dna['narration_style'] = brief['narrative_voice']
        conn.execute(Channel.__table__.update().where(Channel.id == channel['id']).values(dna=dna))
        channel['dna'] = dna
        version = (conn.execute(select(func.max(DNAVersion.version)).where(DNAVersion.channel_id == channel['id'])).scalar() or 0) + 1
        conn.execute(DNAVersion.__table__.insert().values(channel_id=channel['id'], version=version, dna=dna,
                                                       note='Channel identity approved for v3.1.45', magnitude='HIGH'))
        conn.execute(ChannelGuidance.__table__.insert().values(channel_id=channel['id'], version=1, status='active',
            origin='approved_baseline', dna_hash=fingerprint(channel), channel_snapshot=channel_snapshot(channel),
            criteria=brief, content=baseline(brief), note='Approved starting identity; research remains available for preview and Apply.'))


def active(db, channel_id):
    return db.query(ChannelGuidance).filter_by(channel_id=channel_id, status='active').first()


def freeze_project(db, project, channel):
    profile = active(db, channel.id)
    # Absence of a snapshot means legacy behavior, including all existing projects.
    if profile:
        project.settings = {**(project.settings or {}), 'channel_guidance': {
            key: deepcopy(getattr(profile, key)) for key in ('id', 'version', 'dna_hash', 'channel_snapshot', 'criteria', 'content')}}


def initialize_channel(db, channel):
    if channel.name.casefold().strip() == 'the midnight log':
        return
    brief = default_brief(channel.name, channel.niche)
    channel.dna = {**channel.dna, 'creative_brief': brief}
    if channel.name.casefold().strip() in ('heart & hurdles', 'the veiled signal'):
        channel.dna = {**channel.dna, 'tone': 'Emotionally intimate, dramatic, believable' if brief['genre_mode'] == 'family_drama' else
                       'Evidence-driven, speculative, precise and curious', 'narration_style': brief['narrative_voice']}
        db.add(ChannelGuidance(channel_id=channel.id, version=1, status='active', origin='approved_baseline',
            dna_hash=fingerprint(channel), channel_snapshot=channel_snapshot(channel), criteria=brief, content=baseline(brief),
            note='Approved starting identity for v3.1.45.'))


def for_job(db, job):
    if job.project_id:
        from .models import Project
        project = db.get(Project, job.project_id)
        return deepcopy((project.settings or {}).get('channel_guidance')) if project else None
    record = active(db, job.channel_id) if job.channel_id and job.kind != 'channel_research' else None
    return {key: deepcopy(getattr(record, key)) for key in ('id', 'version', 'dna_hash', 'channel_snapshot', 'criteria', 'content')} if record else None


def scope_context(db, job, context):
    profile = for_job(db, job)
    if not profile or job.kind not in STEP_GROUPS:
        return context
    content = profile['content']
    group = STEP_GROUPS[job.kind]
    # Send only the instructions needed for this task, never the full profile repeatedly.
    context['channel_guidance'] = {
        'id': profile['id'], 'version': profile['version'], 'genre_mode': profile['criteria']['genre_mode'],
        'identity': content['identity'], 'global_rules': content['global_rules'], 'avoid': content['avoid'],
        'step_rules': content['step_rules'][group],
        **({'hook_examples': content['hook_examples']} if group in ('ideas', 'draft') else {}),
    }
    context['channel'] = {**context.get('channel', {}), **deepcopy(profile['channel_snapshot'])}
    if 'channel_visual_profile' in context:
        context['channel_visual_profile']['visual_language'] = '; '.join(content['step_rules']['packaging'])[:700]
    if 'project' in context:
        context['project'].get('settings', {}).pop('channel_guidance', None)
    if 'novelty_memory' in context:
        channel_id = context.get('project', {}).get('channel_id') or job.channel_id
        context['novelty_memory'] = [n for n in context['novelty_memory'] if n.get('channel_id') == channel_id]
    return context


CREATIVE_BOUNDARY = '''
CHANNEL CREATIVE DIRECTIONS: use INPUT JSON.channel_guidance for this channel's genre,
voice, conflict, hook, ending and task-specific evaluation. These directions specialize
creative choices, never technical contracts: retain required JSON fields, IDs, output
limits, duration/WPM, midpoint timing, providers, workflow approvals and resource counts.
User-supplied Bible facts and endings remain authoritative. Research examples are fictional
illustrations, never ingredients to copy. Unsupported performance claims are forbidden.
Do not impose a horror/survival engine on a family or other incompatible genre. Reviewers
must use the same frozen directions while retaining exact evidence and causal consistency.
Legacy schema names such as anomaly, fear_engine, survival_problem and disaster_rules
are compatibility labels: use the appropriate contradiction, emotional risk or practical
problem; use 'not applicable to this genre' or empty optional arrays when appropriate.
'''


def creative_prompt(context):
    return CREATIVE_BOUNDARY if context.get('channel_guidance') else ''


def queue_part(db, record):
    channel = db.get(Channel, record.channel_id)
    if not channel or fingerprint(channel) != record.dna_hash:
        raise ValueError('DNA kênh đã thay đổi. Nghiên cứu lại từ DNA hiện tại.')
    part = next((p for p in PARTS if p not in record.parts), None)
    if not part:
        return None
    previous = db.get(Job, record.job_ids.get(part)) if record.job_ids.get(part) else None
    if previous and previous.status == 'waiting_user' and previous.step == 'Interrupted by restart. Resume this job.':
        previous.status, previous.step = 'cancelled', 'Replaced by resumed channel research section'
    if previous and previous.status in ('queued', 'running', 'waiting_user'):
        return None
    job = Job(kind='channel_research', channel_id=channel.id,
              payload={'guidance_id': record.id, 'part': part})
    db.add(job); db.flush()
    record.job_ids = {**record.job_ids, part: job.id}
    return job


def start_research(db, channel, regenerate=False):
    identity_hash = fingerprint(channel)
    existing = db.query(ChannelGuidance).filter_by(channel_id=channel.id, origin='chatgpt').order_by(desc(ChannelGuidance.version)).first()
    if existing and existing.dna_hash == identity_hash:
        if existing.status == 'researching':
            return existing, queue_part(db, existing), False
        if existing.status in ('draft', 'active') and not regenerate:
            return existing, None, True
    if existing and existing.status == 'researching':
        for job_id in existing.job_ids.values():
            job = db.get(Job, job_id)
            if job and job.status in ('queued', 'running', 'waiting_user'):
                job.status, job.step = 'cancelled', 'Superseded by research from the updated DNA'
        existing.status = 'obsolete'
    criteria = CreativeBrief.model_validate((channel.dna or {}).get('creative_brief') or default_brief(channel.name, channel.niche)).model_dump()
    version = (db.query(func.max(ChannelGuidance.version)).filter_by(channel_id=channel.id).scalar() or 0) + 1
    record = ChannelGuidance(channel_id=channel.id, version=version, dna_hash=identity_hash,
        channel_snapshot=channel_snapshot(channel), criteria=criteria, parts={}, job_ids={}, content={}, status='researching')
    db.add(record); db.flush()
    return record, queue_part(db, record), False


def validate_research_job(db, job):
    record = db.get(ChannelGuidance, job.payload.get('guidance_id'))
    part = job.payload.get('part')
    if (not record or record.channel_id != job.channel_id or job.project_id or job.source_id
            or record.status != 'researching' or part not in PARTS or record.job_ids.get(part) != job.id or part in record.parts):
        raise ValueError('Channel research is no longer accepting this section')
    if fingerprint(db.get(Channel, record.channel_id)) != record.dna_hash:
        raise ValueError('DNA kênh đã thay đổi. Nghiên cứu lại từ DNA hiện tại.')
    return record


def research_context(db, job):
    record = validate_research_job(db, job)
    model = {'identity': IdentityPart, 'writing': WritingPart, 'review_packaging': ReviewPart}[job.payload['part']]
    return {'project': {}, 'channel': {'id':record.channel_id, **deepcopy(record.channel_snapshot)}, 'creative_brief': deepcopy(record.criteria),
            'payload': {'part': job.payload['part']}, 'accepted_sections': deepcopy(record.parts),
            'output_schema': model.model_json_schema()}


def accept_part(db, job, output):
    record = validate_research_job(db, job)
    result = validate_part(job.payload['part'], output)
    record.parts = {**record.parts, job.payload['part']: result}
    if all(p in record.parts for p in PARTS):
        record.content = merge_parts(record.parts)
        record.status = 'draft'
        record.note = 'Awaiting preview and explicit Apply; no active directions were changed.'
    output.clear(); output.update(result)


def apply(db, channel, record):
    if not record or record.channel_id != channel.id or record.status not in ('draft', 'active', 'archived'):
        raise ValueError('Complete and preview this channel guidance before applying')
    if fingerprint(channel) != record.dna_hash:
        raise ValueError('DNA kênh đã thay đổi. Nghiên cứu lại hoặc khôi phục đúng phiên bản DNA trước khi áp dụng.')
    record.content = Guidance.model_validate(record.content).model_dump()
    for old in db.query(ChannelGuidance).filter_by(channel_id=channel.id, status='active'):
        if old.id != record.id:
            old.status = 'archived'
    record.status, record.updated_at = 'active', now()
    return record


def state(db, channel):
    records = db.query(ChannelGuidance).filter_by(channel_id=channel.id).order_by(desc(ChannelGuidance.version)).all()
    items = []
    for record in records:
        jobs = [db.get(Job, identifier) for identifier in record.job_ids.values()]
        item = serialize(record)
        item.update(stale=record.dna_hash != fingerprint(channel),
                    completed_parts=len(record.parts), total_parts=len(PARTS),
                    jobs=[{key: getattr(j, key) for key in ('id', 'status', 'step', 'error', 'progress')} for j in jobs if j])
        items.append(item)
    current = next((r for r in items if r['status'] == 'active'), None)
    return {'active_id': current['id'] if current else None, 'items': items,
            'criteria_template': default_brief(channel.name, channel.niche),
            'legacy': current is None, 'active_stale': bool(current and current['stale'])}
