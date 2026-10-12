from copy import deepcopy
import pytest
from backend.story_import import bible_title
from backend.project_storage import project_path
from test_story_entry import imported_project, bible


@pytest.mark.parametrize('content,expected', [
    ({'title':'  The Thing Beneath Station Nine  '},'The Thing Beneath Station Nine'),
    ({'story_title':'The Empty Room'},'The Empty Room'),
    ({'metadata':{'title':'Room 614'}},'Room 614'),
    ({'summary':'THE THING BENEATH STATION NINE is a 45-minute coastal-horror story.'},'THE THING BENEATH STATION NINE'),
    ({'summary':'“The Empty Room” is a mystery story.'},'The Empty Room'),
    ({'summary':'A technician finds an unusual sound.'},None),
    ({'summary':'Mara Vance is a technician.'},None),
])
def test_bible_title_uses_supplied_titles_and_only_clear_legacy_headings(content,expected):
    assert bible_title(content)==expected


def test_import_renames_project_and_storage_without_changing_identity_or_input(client,project):
    p=imported_project(client,project);base='/api/projects/'+p['id']
    root=client.app.state.root
    old=project_path(root,p['id']);marker=old/'images'/'keep.txt';marker.write_text('Keep existing resource',encoding='utf-8')
    content=bible(client);content['title']='The Thing Beneath Station Nine'
    response=client.post(base+'/story-bible/import',json={'content':content})
    assert response.status_code==200,response.text
    current=client.get(base).json()
    assert current['title']=='Customize - '+content['title'] and current['id']==p['id']
    assert current['channel_id']==p['channel_id'] and current['source_id']==p['source_id']
    assert current['artifacts']['story_bible']['content']==content and not current['jobs']
    folder=project_path(root,p['id'])
    assert folder!=old and folder.name=='Customize - '+content['title']
    assert (folder/'images'/'keep.txt').read_text(encoding='utf-8')=='Keep existing resource'
    repeated=client.post(base+'/story-bible/import',json={'content':content})
    assert repeated.json()['id']==response.json()['id']


def test_import_missing_title_keeps_working_name_and_invalid_title_does_not_rename(client,project):
    p=imported_project(client,project);base='/api/projects/'+p['id']
    content=bible(client);content.pop('title',None);content['summary']='A technician hears a strange sound.'
    assert client.post(base+'/story-bible/import',json={'content':content}).status_code==200
    assert client.get(base).json()['title']==p['title']
    bad=deepcopy(content);bad['title']='x'*301
    assert client.post(base+'/story-bible/import',json={'content':bad}).status_code==422
    assert client.get(base).json()['title']==p['title']
