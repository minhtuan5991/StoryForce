"""Manual, comparable YouTube observations and optional in-app reminders."""
from __future__ import annotations

from datetime import date, timedelta
from statistics import median
from collections import defaultdict
from sqlalchemy import desc
from pydantic import BaseModel, Field, ConfigDict
from .models import Analytics, Project, Premise


class ObservedMetrics(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    video_id: str | None = Field(None, max_length=100)
    published_date: date | None = None
    horizon_days: int | None = Field(None, ge=1, le=3650)
    video_duration_seconds: float | None = Field(None, gt=0)
    traffic_source: str = Field('Mixed', max_length=80)
    date_range_start: date | None = None
    date_range_end: date | None = None
    title_used: str | None = Field(None, max_length=300)
    thumbnail_used: str | None = Field(None, max_length=500)
    views: int | None = Field(None, ge=0)
    impressions: int | None = Field(None, ge=0)
    ctr: float | None = Field(None, ge=0, le=100)
    watch_time_minutes: float | None = Field(None, ge=0)
    average_view_duration: float | None = Field(None, ge=0)
    average_percentage_viewed: float | None = Field(None, ge=0)
    subscribers_gained: int | None = None
    returning_viewers: int | None = Field(None, ge=0)
    likes: int | None = Field(None, ge=0)
    comments: int | None = Field(None, ge=0)
    retention_30: float | None = Field(None, ge=0)
    retention_60: float | None = Field(None, ge=0)
    retention_90: float | None = Field(None, ge=0)
    retention_180: float | None = Field(None, ge=0)
    retention_300: float | None = Field(None, ge=0)
    retention_600: float | None = Field(None, ge=0)


LEGACY = ('views', 'impressions', 'ctr', 'average_view_duration', 'average_percentage_viewed',
          'subscribers_gained', 'returning_viewers', 'likes', 'comments')


def normalize_snapshot(body, p, premise):
    raw = dict(body.metrics)
    for k in LEGACY:
        if k in body.model_fields_set:
            raw.setdefault(k, getattr(body, k))
    raw.setdefault('title_used', p.publish.get('title') or p.title)
    raw.setdefault('published_date', p.publish.get('date') or None)
    raw.setdefault('video_duration_seconds', p.publish.get('final_duration') or None)
    observed = ObservedMetrics.model_validate(raw).model_dump(mode='json')
    end = date.fromisoformat(body.date)
    published = date.fromisoformat(observed['published_date']) if observed['published_date'] else None
    if published and published > end:
        raise ValueError('Snapshot date cannot precede publication')
    if observed['date_range_start'] and observed['date_range_end'] and observed['date_range_start'] > observed['date_range_end']:
        raise ValueError('Analytics date range is reversed')
    duration = observed['video_duration_seconds']
    for seconds in (30, 60, 90, 180, 300, 600):
        if duration and duration < seconds and observed[f'retention_{seconds}'] is not None:
            raise ValueError(f'Retention at {seconds}s is not applicable to this video duration')
    if observed['horizon_days'] is None and published:
        observed['horizon_days'] = max(1, (end - published).days)
    return {**observed, '_version': 1, '_story_version': p.story_version,
            '_abstract_pattern': (premise.packaging or {}).get('abstract_pattern') if premise else None}


def values(a):
    if (a.metrics or {}).get('_version'):
        return a.metrics
    # Legacy snapshots did not distinguish an empty input from zero.
    return {**{k: getattr(a, k) for k in LEGACY}, 'horizon_days': None,
            'video_duration_seconds': None, 'traffic_source': 'Unknown', '_legacy': True}


def latest_rows(db, channel_id=None):
    query = db.query(Project)
    if channel_id:
        query = query.filter_by(channel_id=channel_id)
    rows = []
    for p in query.all():
        a = db.query(Analytics).filter_by(project_id=p.id).order_by(desc(Analytics.date), desc(Analytics.updated_at)).first()
        if a:
            rows.append((p, a, values(a)))
    return rows


def comparable(p, m, other, v):
    d, e = m.get('video_duration_seconds'), v.get('video_duration_seconds')
    age, age2 = m.get('horizon_days'), v.get('horizon_days')
    return (p.channel_id == other.channel_id and d and e and abs(d - e) <= max(d, e) * .25
            and age is not None and age2 is not None and abs(age - age2) <= max(1, min(age, age2) * .1)
            and m.get('traffic_source') == v.get('traffic_source'))


def quality_sample(m):
    return (m.get('impressions') or 0) >= 100 and (m.get('views') or 0) >= 30


def comparisons(rows):
    results = []
    for p, a, m in rows:
        peers = [v for other, _, v in rows if other.id != p.id and comparable(p, m, other, v) and quality_sample(v)]
        metrics = ('ctr', 'retention_30', 'retention_60', 'retention_90', 'average_percentage_viewed')
        baselines = {k: median(v[k] for v in peers if v.get(k) is not None) if any(v.get(k) is not None for v in peers) else None for k in metrics}
        counts = {k: sum(v.get(k) is not None for v in peers) for k in metrics}
        watch_key = 'retention_30' if m.get('retention_30') is not None and counts['retention_30'] >= 5 else 'average_percentage_viewed'
        enough = quality_sample(m) and counts['ctr'] >= 5 and counts[watch_key] >= 5 and m.get('ctr') is not None and m.get(watch_key) is not None
        classification = 'INSUFFICIENT_DATA'
        if enough:
            click_high = m['ctr'] > baselines['ctr'] and m['ctr'] >= baselines['ctr'] * 1.15
            click_low = m['ctr'] < baselines['ctr'] * .85
            watch_high = m[watch_key] > baselines[watch_key] and m[watch_key] >= baselines[watch_key] * 1.15
            watch_low = m[watch_key] < baselines[watch_key] * .85
            classification = ('STRONG_CLICK_WEAK_RETENTION' if click_high and watch_low else
                              'WEAK_CLICK_STRONG_RETENTION' if click_low and watch_high else
                              'PROMISING_COMPARABLE_RESULT' if click_high and watch_high else 'NEAR_BASELINE_OR_MIXED')
        results.append({'project_id': p.id, 'title': m.get('title_used') or p.title, 'snapshot_id': a.id,
                        'baseline': baselines, 'baseline_sample_sizes': counts, 'comparable_videos': len(peers),
                        'confidence': 'LOW' if not enough or len(peers) < 10 else 'MODERATE_OBSERVATIONAL',
                        'classification': classification, 'observed': m,
                        'note': 'Compared only within channel, similar duration, observation age and traffic source. Not proof of causation.'})
    return results


def learning_data(db, channel_id=None):
    rows = latest_rows(db, channel_id)
    n = len(rows)
    scored = comparisons(rows)
    grouped = defaultdict(list)
    categories = defaultdict(list)
    for p, a, m in rows:
        premise = db.get(Premise, p.selected_premise_id) if p.selected_premise_id else None
        categories[premise.category if premise else 'Unclassified'].append(m)
        pattern = m.get('_abstract_pattern')
        if pattern:
            grouped[(p.channel_id, pattern)].append(next(c for c in scored if c['project_id'] == p.id))
    learned = []
    for (channel, pattern), items in grouped.items():
        tested = [i for i in items if i['classification'] != 'INSUFFICIENT_DATA']
        if len(tested) >= 3 and sum(p.channel_id == channel for p, _, _ in rows) >= 10:
            learned.append({'channel_id': channel, 'abstract_pattern': pattern, 'sample_size': len(tested),
                            'promising_count': sum(i['classification'] == 'PROMISING_COMPARABLE_RESULT' for i in tested),
                            'weak_retention_count': sum(i['classification'] == 'STRONG_CLICK_WEAK_RETENTION' for i in tested),
                            'confidence': 'MODERATE_OBSERVATIONAL',
                            'use': 'Test the abstract appeal in a new setting, job, conflict and beat sequence; never repeat a successful story.'})
    avg = lambda items, key: round(sum(v[key] for v in items if v.get(key) is not None) / sum(v.get(key) is not None for v in items), 2) if any(v.get(key) is not None for v in items) else None
    return {'sample_size': n, 'confidence': 'Insufficient' if n < 5 else 'Low' if n < 20 else 'Moderate observational evidence',
            'total_views': sum(m.get('views') or 0 for _, _, m in rows), 'average_ctr': avg([m for _, _, m in rows], 'ctr'),
            'patterns': [{'category': k, 'sample_size': len(v), 'views': sum(m.get('views') or 0 for m in v),
                          'average_ctr': avg(v, 'ctr'), 'average_percentage_viewed': avg(v, 'average_percentage_viewed')} for k, v in categories.items()],
            'comparisons': scored, 'learned_patterns': learned, 'automatic_dna_changes': False,
            'recommendations': ['Collect comparable snapshots at 7 or 28 days. Missing data is allowed; AI preparation scores are not real audience measurements.',
                                'Patterns guide the next experiment only when enough comparable videos exist. Protect originality and vary the execution.'],
            'snapshot_policy': 'Latest snapshot per project; cumulative snapshots are not summed'}


def reminders(db, channel_id=None, today=None):
    today = today or date.today()
    items = []
    query = db.query(Project)
    if channel_id:
        query = query.filter_by(channel_id=channel_id)
    for p in query.all():
        publish = p.publish or {}
        if not publish.get('url') or not publish.get('date') or publish.get('analytics_reminders') is False:
            continue
        try:
            day = date.fromisoformat(publish['date'])
        except ValueError:
            continue
        snapshots = db.query(Analytics).filter_by(project_id=p.id).all()
        dismissed = publish.get('analytics_reminders_dismissed', [])
        for horizon in (7, 28):
            due = day + timedelta(days=horizon)
            covered = any((values(a).get('horizon_days') or (date.fromisoformat(a.date) - day).days) >= horizon for a in snapshots)
            if today >= due and horizon not in dismissed and not covered:
                items.append({'project_id': p.id, 'title': p.title, 'horizon_days': horizon, 'due_date': due.isoformat(), 'optional': True})
    return items
