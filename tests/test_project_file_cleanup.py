from pathlib import Path
from unittest.mock import patch
from backend.models import Project, Asset, Job
from backend.project_files import remove_planned_files, private_file_plan

def preview(client,project,delete=True):
    response=client.post('/api/deletions/preview',json={'kind':'projects','ids':[project['id']],'delete_files':delete})
    assert response.status_code==200,response.text
    return response.json()
def confirm(client,report,delete=None):
    body={k:report[k] for k in ('kind','ids','confirmation','delete_files')}
    if delete is not None:body['delete_files']=delete
    return client.post('/api/deletions/confirm',json=body)
def files(client,project):
    root=client.app.state.root;folder=root/'projects'/project['id']
    image=folder/'images/scene_001.png';image.parent.mkdir(parents=True,exist_ok=True);image.write_bytes(b'image-content')
    render=folder/'render/v1/attempt/final_video.mp4';render.parent.mkdir(parents=True);render.write_bytes(b'video-content')
    external=root/'exports/keep.mp4';external.write_bytes(b'export')
    return image,render,external

def test_keep_files_is_default_and_opt_in_is_bound_to_confirmation(client,project):
    image,render,external=files(client,project)
    report=preview(client,project,False)
    assert confirm(client,report,True).status_code==409
    assert image.exists() and render.exists()
    assert confirm(client,report).status_code==200
    assert image.exists() and render.exists() and external.exists()

def test_explicit_cleanup_deletes_private_files_preserves_external_and_shared(client,project):
    image,render,external=files(client,project)
    other=client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Other project'}).json()
    with client.app.state.database.session() as db:
        db.add(Asset(project_id=other['id'],name='Shared image',path=str(image.relative_to(client.app.state.root)),kind='image'))
        db.commit()
    report=preview(client,project)
    assert report['file_cleanup']['count']==1
    assert report['file_cleanup']['bytes']==len(b'video-content')
    assert report['file_cleanup']['kept']==[str(image.relative_to(client.app.state.root))]
    result=confirm(client,report).json()
    assert result['file_cleanup']['removed_files']==1
    assert not render.exists() and image.exists() and external.exists()
    assert client.get('/api/projects/'+other['id']).status_code==200

def test_file_changes_and_running_jobs_block_cleanup(client,project):
    image,render,_=files(client,project)
    report=preview(client,project)
    image.write_bytes(b'changed-file')
    assert confirm(client,report).status_code==409
    with client.app.state.database.session() as db:
        db.add(Job(project_id=project['id'],kind='render',status='running'));db.commit()
    report=preview(client,project)
    assert report['blocked'] and confirm(client,report).status_code==409
    assert image.exists() and render.exists()

def test_changed_link_is_not_followed_and_locked_file_is_reported(client,project):
    image,render,_=files(client,project)
    report=preview(client,project)
    with patch('backend.project_files.linked',side_effect=lambda path:Path(path)==image):
        result=remove_planned_files(client.app.state.root,[project['id']],report['file_cleanup'])
    assert str(image.relative_to(client.app.state.root)) in result['failed_files']
    assert image.exists() and not render.exists()

def test_linked_project_root_is_rejected_before_database_deletion(client,project):
    folder=client.app.state.root/'projects'/project['id']
    with patch('backend.project_files.linked',side_effect=lambda path:path==folder):
        response=client.post('/api/deletions/preview',json={'kind':'projects','ids':[project['id']],'delete_files':True})
    assert response.status_code==422
    assert client.get('/api/projects/'+project['id']).status_code==200
