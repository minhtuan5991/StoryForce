"""Versioned YouTube preparation; AI judgments are not observed retention."""
from __future__ import annotations

import re
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Literal
from .intelligence import digest, words
from .models import Artifact, Premise, serialize


class Packaging(BaseModel):
    primary_title_concept: str = Field(min_length=1, max_length=300)
    alternative_angles: list[str] = []
    thumbnail_concept: str = Field(min_length=1)
    visual_focal_point: str = Field(min_length=1)
    core_curiosity_question: str = Field(min_length=1)
    viewer_promise: str = Field(min_length=1)
    click_risk: str = ""
    likely_misinterpretation: str = ""
    one_sentence_pitch: str = Field(min_length=1)
    abstract_pattern: str = Field(min_length=1, max_length=250)


class Opening(BaseModel):
    id: Literal['A', 'B', 'C']
    strategy: str = Field(min_length=1)
    text: str = Field(min_length=1)
    scores: dict[str, float]
    tradeoff: str = ""


class Openings(BaseModel):
    variants: list[Opening] = Field(min_length=3, max_length=3)
    recommended: Literal['A', 'B', 'C']
    rationale: str = Field(min_length=1)


class ZoneVerdict(BaseModel):
    id: str
    status: Literal['PASS', 'FAIL', 'NOT_APPLICABLE']
    evidence: str = ""
    explanation: str = Field(min_length=1)


class RetentionIssue(BaseModel):
    issue_id: str
    zone_id: str
    severity: Literal['HIGH', 'MEDIUM', 'LOW', 'SUGGESTION']
    type: Literal['WEAK_HOOK', 'EXPOSITION', 'RESET_AFTER_HOOK', 'STALL', 'UNCLEAR_STAKES', 'PROMISE_MISMATCH', 'REPETITION', 'PACING']
    evidence: str = Field(min_length=1)
    retention_risk: str = Field(min_length=1)
    suggested_repair: str = Field(min_length=1)


class RetentionAudit(BaseModel):
    zones: list[ZoneVerdict]
    issues: list[RetentionIssue]
    retention_readiness_passed: bool
    packaging_alignment_passed: bool
    packaging_explanation: str = Field(min_length=1)
    summary: str = Field(min_length=1)


def latest(db, project_id, kind):
    return db.query(Artifact).filter_by(project_id=project_id, kind=kind).order_by(desc(Artifact.created_at), desc(Artifact.id)).first()


def fingerprint(db, p):
    premise = db.get(Premise, p.selected_premise_id) if p.selected_premise_id else None
    return digest({'draft': p.draft, 'wpm': p.wpm, 'target_minutes': p.target_minutes,
                   'packaging': premise.packaging if premise else {},
                   'inputs': {k: a.content if (a := latest(db, p.id, k)) else {}
                              for k in ('story_bible', 'outline_rewrite', 'opening_choice')}})


def timed_zones(text, wpm):
    matches = list(re.finditer(r'\S+', text))
    seconds = len(words(text)) * 60 / max(1, wpm)
    spans = [(0, 10, 'Concrete interest / question'), (10, 30, 'Stakes and reason to continue'),
             (30, 60, 'Momentum without resetting the hook'), (60, 90, 'New evidence or escalation'),
             (90, 180, 'Meaningful change'), (180, 420, 'Escalation and partial payoff')]
    spans += [(start, start + 180, 'Sustained progression / payoff') for start in range(420, int(seconds), 180)]
    zones = []
    for start, end, purpose in spans:
        first, last = int(start * wpm / 60), min(len(matches), int(end * wpm / 60))
        lo = matches[first].start() if first < len(matches) else len(text)
        hi = matches[last - 1].end() if last > first else lo
        zones.append({'id': f'{start}-{end}', 'start_seconds': start, 'end_seconds': min(end, seconds),
                      'applicable': start < seconds, 'purpose': purpose, 'start_char': lo, 'end_char': hi})
    return {'estimated_seconds': round(seconds, 2), 'timing_basis': 'Estimated from words/WPM, not recorded narration', 'zones': zones}


def validate_scores(scores):
    if not isinstance(scores, dict) or any(isinstance(v, bool) or not isinstance(v, (float, int)) or not 0 <= v <= 100 for v in scores.values() if v is not None):
        raise ValueError('AI scores must be numbers from 0 to 100; use null for non-applicable dimensions')


def validate_openings(output):
    result = Openings.model_validate(output).model_dump()
    if {v['id'] for v in result['variants']} != {'A', 'B', 'C'}:
        raise ValueError('Return distinct opening variants A, B and C')
    for v in result['variants']:
        validate_scores(v['scores'])
    return result


def validate_audit(db, p, output):
    result = RetentionAudit.model_validate(output).model_dump()
    clock = timed_zones(p.draft, p.wpm)
    expected = {z['id']: z for z in clock['zones']}
    if len(result['zones']) != len(expected) or {z['id'] for z in result['zones']} != set(expected):
        raise ValueError('Assess every provided retention time zone exactly once')
    for verdict in result['zones']:
        zone = expected[verdict['id']]
        if zone['applicable'] == (verdict['status'] == 'NOT_APPLICABLE'):
            raise ValueError('Only time zones outside the draft may be NOT_APPLICABLE')
        if zone['applicable']:
            quote = verdict['evidence']
            if not quote or quote not in p.draft:
                raise ValueError('Retention judgments need exact evidence from the current draft')
            # Include a 15-second boundary margin; do not accept evidence from
            # an unrelated later passage as proof of an effective opening.
            margin = int(p.wpm / 4) * 10
            pos = p.draft.find(quote, max(0, zone['start_char'] - margin), min(len(p.draft), zone['end_char'] + margin + len(quote)))
            if pos < 0:
                raise ValueError('Retention evidence does not belong to the reported time zone')
    ids = [i['issue_id'] for i in result['issues']]
    if len(ids) != len(set(ids)):
        raise ValueError('Retention issue IDs must be unique')
    for issue in result['issues']:
        if issue['zone_id'] not in expected or not expected[issue['zone_id']]['applicable'] or issue['evidence'] not in p.draft:
            raise ValueError('Retention issues need an applicable time zone and exact draft evidence')
        zone = expected[issue['zone_id']]
        margin = int(p.wpm / 4) * 10
        if p.draft.find(issue['evidence'], max(0, zone['start_char'] - margin), min(len(p.draft), zone['end_char'] + margin + len(issue['evidence']))) < 0:
            raise ValueError('Retention issue evidence does not belong to its time zone')
        issue['estimated_seconds'] = expected[issue['zone_id']]['start_seconds']
    failed = any(z['status'] == 'FAIL' for z in result['zones']) or any(i['severity'] == 'HIGH' for i in result['issues'])
    if result['retention_readiness_passed'] and failed:
        raise ValueError('Retention cannot pass with failed zones or HIGH retention issues')
    if not result['retention_readiness_passed'] and not result['issues']:
        raise ValueError('A failed retention audit must identify exact passages to repair')
    if not result['packaging_alignment_passed'] and not any(i['type'] == 'PROMISE_MISMATCH' for i in result['issues']):
        raise ValueError('A failed packaging check must identify the exact promise mismatch')
    result.update(content_fingerprint=fingerprint(db, p), story_version=p.story_version, timing=clock, score_source='AI assessment, not YouTube results')
    return result


def readiness(db, p, story_integrity=None):
    a = latest(db, p.id, 'retention_audit')
    current = bool(a and a.content.get('content_fingerprint') == fingerprint(db, p))
    content = a.content if current else {}
    required = bool((p.settings or {}).get('audience_policy'))
    retention = content.get('retention_readiness_passed') if current else None
    packaging = content.get('packaging_alignment_passed') if current else None
    return {'required': required, 'status': 'ASSESSED' if current else 'STALE' if a else 'NOT_ASSESSED',
            'story_integrity_passed': story_integrity, 'retention_readiness_passed': retention,
            'packaging_alignment_passed': packaging,
            'youtube_readiness_passed': bool(story_integrity and retention and packaging) if current else None,
            'audit': serialize(a) if a else None}


def apply_repairs(db, p, output, set_draft):
    report = latest(db, p.id, 'retention_audit')
    if not report or report.content.get('content_fingerprint') != fingerprint(db, p):
        raise ValueError('Audit the current draft before retention repairs')
    issues = {i['issue_id']: i for i in report.content['issues']}
    replacements = output.get('replacements', [])
    if not replacements:
        raise ValueError('Return targeted replacements for the retention issues')
    text = p.draft
    covered = set()
    for r in replacements:
        issue = issues.get(r.get('issue_id'))
        old, new = r.get('old_text', ''), r.get('new_text', '')
        if not issue or r['issue_id'] in covered or not old or text.count(old) != 1 or not new or issue['evidence'] not in old:
            raise ValueError('Retention repairs must identify an issue and one exact passage containing its evidence')
        if len(old) > len(p.draft) * .6:
            raise ValueError('Retention repairs must preserve the rest of the story; structural rewrites require manual editing')
        text = text.replace(old, new, 1)
        covered.add(r['issue_id'])
    set_draft(db, p, text)
