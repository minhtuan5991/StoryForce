"""Versioned YouTube preparation; AI judgments are not observed retention."""
from __future__ import annotations

import math
from bisect import bisect_left, bisect_right
from sqlalchemy import desc
from pydantic import BaseModel, Field
from typing import Literal
from .intelligence import digest, words, WORD_PATTERN
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
    matches = list(WORD_PATTERN.finditer(text))
    seconds = len(matches) * 60 / max(1, wpm)
    spans = [(0, 10, 'Concrete hook, curiosity and contradiction'), (10, 30, 'Immediate conflict, stakes and consequential choice'),
             (30, 60, 'Momentum without resetting the hook'), (60, 90, 'New evidence or escalation'),
             (90, 180, 'Meaningful change'), (180, 420, 'Escalation and partial payoff')]
    spans += [(start, start + 180, 'Sustained progression / payoff') for start in range(420, int(seconds), 180)]
    zones = []
    for start, end, purpose in spans:
        first, last = int(start * wpm / 60), min(len(matches), int(end * wpm / 60))
        lo = matches[first].start() if first < len(matches) else len(text)
        hi = matches[last - 1].end() if last > first else lo
        zones.append({'id': f'{start}-{end}', 'start_seconds': start, 'end_seconds': min(end, seconds),
                      'applicable': start < seconds, 'purpose': purpose, 'start_char': lo, 'end_char': hi,
                      'start_word': first, 'end_word': last, 'text': text[lo:hi]})
    windows = []
    for label, lo_fraction, hi_fraction, purpose in (
        ('midpoint', .4, .6, 'Main climax and central reversal around 45–55%'),
        ('aftermath', .55, .9, 'Causal explanation, consequences and forward progress'),
        ('ending', .9, 1, 'Resolution; optional earned ambiguity')):
        first, last = int(len(matches) * lo_fraction), int(len(matches) * hi_fraction)
        lo = matches[first].start() if first < len(matches) else len(text)
        hi = matches[last - 1].end() if last > first else lo
        windows.append({'id': label, 'start_seconds': seconds * lo_fraction, 'end_seconds': seconds * hi_fraction,
                        'purpose': purpose, 'start_word': first, 'end_word': last, 'text': text[lo:hi]})
    return {'estimated_seconds': round(seconds, 2), 'timing_basis': 'Estimated from words/WPM, not recorded narration',
            'midpoint_target_seconds': [round(seconds * .45, 2), round(seconds * .55, 2)],
            'structure_windows': windows, 'zones': zones}


class RetentionEvidenceError(ValueError):
    code = 'RETENTION_EVIDENCE'


def evidence_text(text):
    """Normalize display formatting while retaining a map to original text."""
    chars, positions = [], []
    for pos, char in enumerate(text):
        if char in '\"“”„«»':
            continue
        if char in '‘’':
            char = "'"
        if char.isspace():
            if not chars or chars[-1] == ' ':
                continue
            char = ' '
        chars.append(char)
        positions.append(pos)
    if chars and chars[-1] == ' ':
        chars.pop()
        positions.pop()
    return ''.join(chars), positions


def evidence_spans(text, quote, normalized_source=None):
    """Accept exact text or only whitespace/quotation-format differences."""
    if not words(quote):
        return []
    spans = []
    pos = text.find(quote)
    while pos >= 0:
        spans.append((pos, pos + len(quote), False))
        pos = text.find(quote, pos + 1)
    normalized, positions = normalized_source or evidence_text(text)
    needle, _ = evidence_text(quote)
    quote_words = [word.replace('‘', "'").replace('’', "'") for word in words(quote)]
    pos = normalized.find(needle)
    while pos >= 0:
        lo, hi = positions[pos], positions[pos + len(needle) - 1] + 1
        source_words = [word.replace('‘', "'").replace('’', "'") for word in words(text[lo:hi])]
        # Removing quote delimiters must not merge or alter spoken words.
        if source_words == quote_words:
            spans.append((lo, hi, True))
        pos = normalized.find(needle, pos + 1)
    return spans


def evidence_location(text, quote, zone, wpm, matches, normalized_source=None):
    """Match source occurrences against word time, including boundary context."""
    pace = max(1, wpm)
    starts, ends = [m.start() for m in matches], [m.end() for m in matches]
    occurrences = []
    for pos, stop, formatted in evidence_spans(text, quote, normalized_source):
        start = bisect_right(ends, pos) * 60 / pace
        end = bisect_left(starts, stop) * 60 / pace
        gap = max(zone['start_seconds'] - end, start - zone['end_seconds'], 0)
        occurrences.append((gap, start, end, pos, stop, formatted))
    if not occurrences:
        excerpt = ' '.join(quote.split())[:100]
        raise RetentionEvidenceError(
            f'Retention judgments need exact evidence from the current draft: khoảng {zone["id"]} giây '
            f'có trích dẫn không trùng bản gốc. Sao chép một đoạn ngắn từ zone.text, giữ nguyên '
            f'từng từ và thứ tự rồi đánh giá lại. Trích dẫn: “{excerpt}”.')
    # A quote may cross a boundary, but quoting a whole story cannot prove
    # every zone. Keep the same 15-second tolerance in actual word time.
    local_limit = zone['end_word'] - zone['start_word'] + 2 * math.ceil(pace * 15 / 60)
    gap, start, end, pos, stop, formatted = min(occurrences)
    if not words(quote) or len(words(quote)) > local_limit or gap > 15:
        excerpt = ' '.join(quote.split())[:100]
        raise RetentionEvidenceError(
            f'Kiểm định giữ người xem: khoảng {zone["id"]} giây, trích dẫn ở '
            f'{start:.1f}–{end:.1f} giây theo WPM. Chọn trích dẫn ngắn trong '
            f'nội dung của khoảng này rồi đánh giá lại. Trích dẫn: “{excerpt}”.')
    location = {'evidence_start_seconds': round(start, 2), 'evidence_end_seconds': round(end, 2)}
    if formatted:
        location.update(evidence=text[pos:stop], evidence_format_normalized=True)
    return location


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
    matches = list(WORD_PATTERN.finditer(p.draft))
    normalized_source = evidence_text(p.draft)
    if len(result['zones']) != len(expected) or {z['id'] for z in result['zones']} != set(expected):
        raise ValueError('Assess every provided retention time zone exactly once')
    for verdict in result['zones']:
        zone = expected[verdict['id']]
        if zone['applicable'] == (verdict['status'] == 'NOT_APPLICABLE'):
            raise ValueError('Only time zones outside the draft may be NOT_APPLICABLE')
        if zone['applicable']:
            quote = verdict['evidence']
            verdict.update(evidence_location(p.draft, quote, zone, p.wpm, matches, normalized_source))
    ids = [i['issue_id'] for i in result['issues']]
    if len(ids) != len(set(ids)):
        raise ValueError('Retention issue IDs must be unique')
    for issue in result['issues']:
        if issue['zone_id'] not in expected or not expected[issue['zone_id']]['applicable']:
            raise ValueError('Retention issues need an applicable time zone and exact draft evidence')
        zone = expected[issue['zone_id']]
        issue.update(evidence_location(p.draft, issue['evidence'], zone, p.wpm, matches, normalized_source))
        issue['estimated_seconds'] = issue['evidence_start_seconds']
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
