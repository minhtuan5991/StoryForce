"""Pin Idea 1 and check its declared rubric; these are not audience metrics."""
from copy import deepcopy
from .intelligence import words
from .models import Premise, serialize

CONTRACT_VERSION = 2
THRESHOLDS = {'hook_immediacy': 85, 'hook_clarity': 85, 'source_dna_alignment': 80,
              'transformative_distance': 70, 'retention_engine': 80, 'thumbnail_clarity': 80}
CORE_FIELDS = ('primary_hook', 'central_contradiction', 'fear_engine', 'discovery_engine',
               'threat_type', 'survival_problem', 'emotional_promise', 'most_memorable_mechanic',
               'most_transformable_mechanic')

POLICY_PROMPT = '''
Mandatory Idea 1 contract (also overrides older custom premise templates):
If source.transcript or source.summary is non-empty, reserve exactly one premise_role="source_close",
rank_role="SOURCE_CLOSE", category="Core", at premises[0]. Otherwise use premise_role="original_primary",
rank_role="ORIGINAL_PRIMARY" from channel DNA; do not claim source affinity or fabricate a source_core.
Extract source_core with primary_hook, central_contradiction, fear_engine, discovery_engine, threat_type,
survival_problem, emotional_promise, most_memorable_mechanic, most_transformable_mechanic,
elements_to_avoid_copying (non-empty array), grounded ONLY in the supplied source.
For Idea 1 include source_relationship={dna_alignment:string,preserved:string[],transformed:string[],anti_copy_changes:string[]}
when sourced. List at least six concrete transformed aspects and three anti-copy changes.
Keep the strongest abstract hook, fear, discovery rhythm, survival dilemma and emotional promise.
Substantially transform protagonist, job, concrete place/anomaly/mechanism, supporting cast, subplot,
scene sequence, climax and ending. Never copy dialogue, unique reveals, death sequences or ending.
No cosmetic renaming. No genre drift: do not turn every source into voice mimics, hotels or monsters.
Check channel novelty_memory and remaining candidates for repeated mechanics; change the mechanism while preserving source appeal.
Idea 1 signature must include non-empty protagonist, protagonist_job, location, anomaly, mechanism, immediate_stakes.
Add signature_rule (one short observable/repeatable rule, max 250 characters).
Title: concrete abnormal event + immediate problem. Logline: protagonist/job + normal situation + specific impossible
or disturbing interruption + immediate consequence + unique mechanism, at least 20 words. Hook before lore.
Include 0–100 scores hook_immediacy>=85, hook_clarity>=85, transformative_distance>=70,
retention_engine>=80, thumbnail_clarity>=80, signature_rule_strength; source_dna_alignment>=80 and
surface_similarity_risk<=35 when sourced (aim for DNA alignment>=85). Horror channels require horror_promise>=85;
other genres require genre_promise>=85 and may use horror_promise=null. Similarity scores are surface copying risks,
not abstract DNA alignment. These are rubric estimates, not measured retention/CTR or a guarantee of originality.
Idea 1 should suggest a concrete visual contradiction for packaging without generating an actual image here.
For ten candidates use 1 source-close/original-primary Core + 3 Core + 3 Adjacent + 2 Experimental + 1 Wildcard.
Never sort Idea 1 down. For a repair request return only the repaired Idea 1 (+ grounded source_core when sourced);
leave every remaining candidate unchanged. Examples of mechanics are illustrations, not fixed plot ingredients.
'''


def ordered(db, project_id):
    rows = db.query(Premise).filter_by(project_id=project_id).order_by(Premise.created_at, Premise.id).all()
    return sorted(rows, key=lambda p: (p.signature or {}).get('_premise', {}).get('number', 999))


def record(premise):
    result = serialize(premise)
    result.update((premise.signature or {}).get('_premise', {}))
    result['signature'] = {k: v for k, v in (premise.signature or {}).items() if not k.startswith('_')}
    return result


class CandidateRepairNeeded(ValueError):
    def __init__(self, batch, reasons):
        self.batch, self.reasons = batch, reasons
        super().__init__('Idea 1 needs repair: ' + '; '.join(reasons))


def has_source(source):
    return bool(source and (str(source.get('transcript') or '').strip() or str(source.get('summary') or '').strip()))


def mock_batch(context, result):
    sourced = has_source(context.get('source'))
    for index, item in enumerate(result['premises']):
        item.update(premise_role=('source_close' if sourced else 'original_primary') if index == 0 else 'standard',
                    rank_role=('SOURCE_CLOSE' if sourced else 'ORIGINAL_PRIMARY') if index == 0 else 'STANDARD',
                    signature_rule='Opening the relay connects two otherwise isolated places.')
        item['scores'].update({key: 90 for key in THRESHOLDS})
        item['scores'].update(horror_promise=90, genre_promise=90, surface_similarity_risk=12, signature_rule_strength=90)
        item['signature'].update(protagonist='Mara the station keeper', anomaly='An unpowered relay receives tomorrow’s warning',
                                 mechanism='A relay links places only while its receiver is open', immediate_stakes='Opening it could expose the keeper to the storm')
        if index == 0 and sourced:
            item['source_relationship'] = {'dna_alignment': 'Synthetic fixture: isolation, uncertain warning and a survival choice.',
                'preserved': ['Isolation and a difficult decision about an impossible warning'],
                'transformed': ['New keeper', 'New occupation', 'New station', 'New relay anomaly', 'New discovery order', 'New ending'],
                'anti_copy_changes': ['Different mechanism', 'Different climax', 'Different ending']}
    if sourced:
        result['source_core'] = {key: 'Synthetic source pattern: an isolated keeper must decide whether a warning can be trusted.' for key in CORE_FIELDS}
        result['source_core']['elements_to_avoid_copying'] = ['Source names', 'Exact scenes', 'Exact ending']
    return result


def validate_batch(output, source, channel, count):
    result = deepcopy(output)
    items = result.get('premises')
    if not isinstance(items, list) or len(items) != count or not 1 <= count <= 50:
        raise ValueError(f'Return exactly {count} premises')
    if any(not isinstance(item, dict) for item in items):
        raise ValueError('Every premise must be a JSON object')
    sourced = has_source(source)
    role = 'source_close' if sourced else 'original_primary'
    reserved = [i for i, item in enumerate(items) if item.get('premise_role') == role
                or sourced and item.get('rank_role') == 'SOURCE_CLOSE']
    reasons = []
    if len(reserved) == 1:
        items.insert(0, items.pop(reserved[0]))
    else:
        reasons.append(f'Exactly one candidate must declare premise_role={role}')
    primary = items[0]
    for key in ('title', 'logline'):
        if not isinstance(primary.get(key), str) or not primary[key].strip():
            reasons.append(f'{key} must contain concrete story content')
    scores = primary.get('scores') if isinstance(primary.get('scores'), dict) else {}
    for key, minimum in THRESHOLDS.items():
        if key == 'source_dna_alignment' and not sourced:
            continue
        value = scores.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not minimum <= value <= 100:
            reasons.append(f'{key} must be {minimum}–100')
    genre_text = str(channel.get('niche', '')) + ' ' + str(channel.get('dna', {})) + ' ' + str((source or {}).get('dna', {}))
    genre_key = 'horror_promise' if any(term in genre_text.lower() for term in ('horror', 'kinh dị', 'kinh di')) else 'genre_promise'
    if not isinstance(scores.get(genre_key), (int, float)) or isinstance(scores.get(genre_key), bool) or not 85 <= scores[genre_key] <= 100:
        reasons.append(f'{genre_key} must be 85–100')
    value = scores.get('surface_similarity_risk')
    if sourced and (isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 35):
        reasons.append('surface_similarity_risk must be 0–35')
    signature = primary.get('signature') if isinstance(primary.get('signature'), dict) else {}
    for key in ('protagonist', 'protagonist_job', 'location', 'anomaly', 'mechanism', 'immediate_stakes'):
        if not isinstance(signature.get(key), str) or not signature[key].strip():
            reasons.append(f'signature.{key} must describe a concrete story element')
    if len(words(str(primary.get('logline') or ''))) < 20:
        reasons.append('Use a concrete logline with situation, anomaly, immediate stakes and mechanism')
    rule = primary.get('signature_rule')
    if not isinstance(rule, str) or not rule.strip() or len(rule) > 250:
        reasons.append('signature_rule must be one short observable rule (1–250 characters)')
    if sourced:
        core = result.get('source_core') if isinstance(result.get('source_core'), dict) else {}
        for key in CORE_FIELDS:
            if not isinstance(core.get(key), str) or not core[key].strip():
                reasons.append(f'source_core.{key} is required')
        if (not isinstance(core.get('elements_to_avoid_copying'), list) or not core['elements_to_avoid_copying']
                or any(not isinstance(v, str) or not v.strip() for v in core['elements_to_avoid_copying'])):
            reasons.append('source_core.elements_to_avoid_copying is required')
        relationship = primary.get('source_relationship') if isinstance(primary.get('source_relationship'), dict) else {}
        if not isinstance(relationship.get('dna_alignment'), str) or not relationship['dna_alignment'].strip():
            reasons.append('Explain source_relationship.dna_alignment')
        for key, minimum in (('preserved', 1), ('transformed', 6), ('anti_copy_changes', 3)):
            entries = relationship.get(key)
            if not isinstance(entries, list) or len(entries) < minimum or any(not isinstance(v, str) or not v.strip() for v in entries):
                reasons.append(f'source_relationship.{key} needs {minimum} concrete changes or patterns')
        # Detect direct reuse of a long expression; conceptual affinity is allowed.
        source_words = [w.casefold() for w in words(str(source.get('transcript') or '') + ' ' + str(source.get('summary') or ''))]
        source_phrases = {tuple(source_words[i:i+12]) for i in range(max(0, len(source_words)-11))}
        candidate_words = [w.casefold() for w in words(str(primary.get('logline') or ''))]
        if any(tuple(candidate_words[i:i+12]) in source_phrases for i in range(max(0, len(candidate_words)-11))):
            reasons.append('Logline repeats a 12-word source expression; transform the wording and situation')
    if reasons:
        raise CandidateRepairNeeded(result, reasons)
    primary['premise_role'], primary['rank_role'], primary['category'] = role, 'SOURCE_CLOSE' if sourced else 'ORIGINAL_PRIMARY', 'Core'
    for index, item in enumerate(items):
        item['number'] = index + 1
        if index == 0 and isinstance(item.get('scores'), dict) and item['scores'].get('surface_similarity_risk') is not None:
            # Old clients read this risk field; conceptual affinity is separate.
            item['scores']['source_similarity'] = item['scores']['surface_similarity_risk']
        if index:
            item['premise_role'], item['rank_role'] = 'standard', 'STANDARD'
    return result
