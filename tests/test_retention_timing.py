from copy import deepcopy
from types import SimpleNamespace

import pytest

from backend import audience
from backend.intelligence import words
from backend.models import Project, Artifact
from conftest import build_story


def locate(text, quote, zone_id, wpm=150):
    zone = next(z for z in audience.timed_zones(text, wpm)['zones'] if z['id'] == zone_id)
    return audience.evidence_location(text, quote, zone, wpm, list(audience.WORD_PATTERN.finditer(text)))


def test_zone_excerpts_use_the_same_words_as_runtime_even_with_punctuation():
    text = ' '.join(['gate—badge exit—road don’t re-check.'] * 80)
    clock = audience.timed_zones(text, 150)
    assert clock['estimated_seconds'] == len(words(text)) * .4
    applicable = [z for z in clock['zones'] if z['applicable']]
    assert sum(len(words(z['text'])) for z in applicable) == len(words(text))
    for z in applicable:
        assert z['text'] == text[z['start_char']:z['end_char']]
        assert len(words(z['text'])) == z['end_word'] - z['start_word']


def test_boundary_tolerance_does_not_depend_on_character_length():
    text = ' '.join(('a' * 100) + str(i) for i in range(400))
    assert locate(text, text.split()[20], '10-30')['evidence_start_seconds'] == 8
    # Short words must not turn a 15-second allowance into a minute.
    short = ' '.join('x' + str(i) for i in range(400))
    with pytest.raises(audience.RetentionEvidenceError, match='50.0'):
        locate(short, 'x125', '0-10')


def test_cross_boundary_passages_and_repeated_quotes_use_actual_occurrences():
    tokens = ['w' + str(i) for i in range(500)]
    text = ' '.join(tokens)
    quote = ' '.join(tokens[100:175])  # 40–70s overlaps 60–90s.
    assert locate(text, quote, '60-90') == {'evidence_start_seconds': 40, 'evidence_end_seconds': 70}
    tokens[0] = tokens[240] = 'Repeating'
    assert locate(' '.join(tokens), 'Repeating', '90-180')['evidence_start_seconds'] == 96
    with pytest.raises(audience.RetentionEvidenceError):
        locate(text, text, '0-10')


def test_quotation_and_whitespace_formatting_preserves_the_actual_source():
    text = 'He said, “Don’t open it.”\n\nThe gate stayed shut.'
    result = locate(text, 'He said, "Don\'t open it." The gate stayed shut.', '0-10')
    assert result['evidence'] == text
    assert result['evidence_format_normalized'] is True
    assert result['evidence_start_seconds'] == 0
    assert result['evidence_end_seconds'] == len(words(text)) * .4
    omitted = locate(text, 'He said, Don’t open it. The gate stayed shut.', '0-10')
    assert omitted['evidence'] == text


@pytest.mark.parametrize('quote', [
    'He said, Don’t close it. The gate stayed shut.',
    'He said, Dont open it. The gate stayed shut.',
    'The gate stayed shut. He said, Don’t open it.',
    'He said, Don’t open it... The gate stayed shut.',
])
def test_formatting_tolerance_never_accepts_changed_words_order_or_ellipsis(quote):
    with pytest.raises(audience.RetentionEvidenceError, match='exact evidence'):
        locate('He said, “Don’t open it.”\n\nThe gate stayed shut.', quote, '0-10')


def test_formatted_repeated_quote_is_still_matched_to_its_actual_time_zone():
    tokens = ['word' + str(i) for i in range(500)]
    tokens[0] = '"Don\'t go."'
    tokens[240] = '“Don’t go.”'
    result = locate(' '.join(tokens), '"Don\'t go."', '90-180')
    assert result['evidence'] == 'Don’t go.'
    assert result['evidence_start_seconds'] == 96.4


def test_retention_context_uses_only_current_draft_and_exact_zone_passages(client, project):
    build_story(client, project)
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        db.add(Artifact(project_id=p.id, kind='full_draft', content={'story': 'OLD DRAFT SHOULD NOT BE EVIDENCE'}))
        db.commit()
        context = client.app.state.workflow.context(db, SimpleNamespace(
            kind='retention_audit', project_id=p.id, payload={}, source_id=None, channel_id=None))
        assert context['project']['draft'] == p.draft
        assert 'source' not in context and 'sources' not in context and 'premises' not in context
        assert 'full_draft' not in context['artifacts']
        assert all(z['text'] for z in context['audience_timing']['zones'] if z['applicable'])


@pytest.mark.parametrize('rejection', ['wrong_zone', 'changed_words'])
def test_rejected_retention_callback_authorizes_one_corrected_attempt_and_preserves_gates(client, project, rejection):
    build_story(client, project)
    from backend.workflow import set_draft
    with client.app.state.database.session() as db:
        p = db.get(Project, project['id'])
        set_draft(db, p, ' '.join('word' + str(i) for i in range(1200)))
        db.commit()
    client.patch('/api/settings', json={'provider_mode': 'browser', 'pipeline_mode': 'manual'})
    headers = {'X-Bridge-Token': client.post('/api/settings/pair-bridge').json()['token']}
    jid = client.post('/api/jobs', json={'kind': 'retention_audit', 'project_id': project['id']}).json()['id']
    path = '/api/bridge/jobs/' + jid
    client.post(path + '/claim', headers=headers, json={'owner': 'one', 'attempt': 1, 'authorize_send': True})
    from backend.models import Job
    with client.app.state.database.session() as db:
        j = db.get(Job, jid)
        context = client.app.state.workflow.context(db, j)
        valid = client.app.state.workflow.mock.generate('retention_audit', context, '')
    bad = deepcopy(valid)
    bad['zones'][0]['evidence'] = valid['zones'][-1]['evidence'] if rejection == 'wrong_zone' else 'Invented evidence'
    response = client.post(path + '/result', headers=headers, json={'attempt': 1, 'result': bad})
    assert response.status_code == 422 and response.json()['code'] == 'RETENTION_EVIDENCE'
    assert '0-10' in response.json()['detail']
    assert not client.get('/api/projects/' + project['id']).json()['locked']
    retry = {'owner': 'one', 'attempt': 1, 'retry_id': 'correct-time', 'reason': 'RETENTION_EVIDENCE'}
    assert client.post(path + '/retry', headers=headers, json={**retry, 'owner': 'other'}).status_code == 409
    assert client.post(path + '/retry', headers=headers, json=retry).status_code == 200
    assert client.post(path + '/retry', headers=headers, json=retry).json()['retry_count'] == 1
    waiting = next(j for j in client.get('/api/bridge/jobs', headers=headers).json()['items'] if j['id'] == jid)
    assert waiting['attempt'] == 2 and 'correction_feedback' in waiting['prompt']
    assert 'Trích dẫn:' in waiting['prompt'] and '"text": "word0' in waiting['prompt']
    assert client.post(path + '/result', headers=headers, json={'attempt': 1, 'result': valid}).status_code == 422
    assert client.post(path + '/claim', headers=headers, json={'owner': 'one', 'attempt': 2, 'authorize_send': True}).json()['send']
    assert client.post(path + '/result', headers=headers, json={'attempt': 2, 'result': valid}).json()['accepted']
    detail = client.get('/api/projects/' + project['id']).json()
    assert not detail['locked']  # Independent verifications of this new draft are still required.
    assert detail['artifacts']['retention_audit']['content']['zones'][0]['evidence_start_seconds'] == 0


def test_retention_retry_requires_a_rejection_from_the_current_draft(client, project):
    from test_bridge_retry import setup_retry
    headers, jid, body, recorder = setup_retry(client)
    assert client.post('/api/bridge/jobs/' + jid + '/retry', headers=headers,
                       json={**body, 'reason': 'RETENTION_EVIDENCE'}).status_code == 422
    assert not recorder.calls
