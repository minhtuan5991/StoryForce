import pytest
from backend.intelligence import duration_profile, chunk_text, words, sentence_units, channel_fit, novelty_check, tokens


@pytest.mark.parametrize('minutes',[5,10,20,30,45,60,17,90])
def test_duration_scales(minutes):
    profile=duration_profile(minutes,150)
    assert profile['target_words']==minutes*150
    assert profile['word_range'][0]<minutes*150<profile['word_range'][1]
    assert profile['retention_map'][-1]['seconds']==round(minutes*60*.95)


def test_duration_rejects_invalid():
    with pytest.raises(ValueError):duration_profile(0)
    with pytest.raises(ValueError):duration_profile(10,1000)


def test_tts_preserves_all_words_and_sentences():
    text='\n\n'.join(f'Mara read the station log before checking signal number {i}. The rain had finally stopped.' for i in range(140))
    chunks=chunk_text(text)
    assert words(' '.join(c['text'] for c in chunks))==words(text)
    for c in chunks:
        assert c['text'].endswith('.')
        assert c['estimated_duration']<=240
        assert c['estimated_duration']>=60


def test_tts_abbreviations_and_dialogue():
    text='Dr. Bell checked the dial. "Is Mr. Clark still outside? Yes, he is."\n\nAt dawn, she opened the door.'
    units=sentence_units(text)
    assert units[0]['text']=='Dr. Bell checked the dial.'
    chunks=chunk_text(text)
    assert len(chunks)==1
    assert chunks[0]['text']==text
    assert any(u['score']<0 for u in units if u['text'].endswith('?'))


def test_tts_prefers_paragraph_near_target():
    paragraph=('Mara counted each marked station on the coastal rescue chart. '*34).strip()
    chunks=chunk_text('\n\n'.join([paragraph]*5))
    assert any('Paragraph boundary' in c['reasons'] for c in chunks[:-1])


def test_tts_short_five_minute_total():
    text=' '.join('Mara checked every radio before she finally closed the door.' for _ in range(70))
    chunks=chunk_text(text)
    assert 1<=len(chunks)<=2
    assert max(c['estimated_duration'] for c in chunks)<=240


def test_single_overlong_sentence_requires_author_edit():
    with pytest.raises(ValueError,match='sentence exceeds'):
        chunk_text(('word '*1000)+'.')


def test_channel_fit_reports_conflict_and_history():
    result=channel_fit({'primary_genre':'Horror','tropes':['isolation']},{'id':'a','name':'A','niche':'Horror','dna':{'primary_genres':['Horror'],'avoid_tropes':['isolation']}},[],[{'id':'plan'}])
    assert result['conflicts']
    assert result['planned_videos']==1
    assert 'Heuristic' in result['basis']


def test_cross_channel_duplicate_has_explanations():
    signature={'job':'ranger','location':'bunker','twist':'rewind'}
    result=novelty_check('The ranger in the bunker',signature,[{'project_id':'p','channel_id':'other','title':'Original','signature':signature,'tokens':list(tokens('The ranger in the bunker'))}],'mine')
    assert result[0]['scope']=='CROSS_CHANNEL'
    assert result[0]['level']=='BLOCK'
    assert len(result[0]['shared'])==3
