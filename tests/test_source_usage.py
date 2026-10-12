from backend.models import Project
from test_premise_reuse import finished


def test_source_usage_is_counted_from_linked_projects_including_extend_and_cleanup(client,project):
    source_id=project['source_id']
    def count():
        return client.get('/api/sources/'+source_id).json()['usage_count']
    assert count()==1
    unused=client.post('/api/sources',json={'title':'Never used','transcript':'A different inspiration.'}).json()
    assert client.get('/api/sources/'+unused['id']).json()['usage_count']==0
    ideas,_,file=finished(client,project)
    file.unlink()
    child=client.post('/api/projects/'+project['id']+'/select-premise',json={'premise_id':ideas[1]['id']}).json()
    assert child['source_id']==source_id and count()==2
    # Counts are workspace-wide, even if a source belongs to a different channel.
    channel=client.post('/api/channels',json={'name':'Other channel'}).json()
    third=client.post('/api/projects',json={'channel_id':channel['id'],'source_id':source_id,'title':'Third adaptation'}).json()
    assert count()==3
    for query in ('','?q=Original&limit=1','?channel_id='+project['channel_id']):
        response=client.get('/api/sources'+query).json()
        row=next(s for s in response['items'] if s['id']==source_id)
        assert row['usage_count']==3
    # Importing a Bible has no inspiration source and contributes no usage.
    client.post('/api/projects',json={'channel_id':project['channel_id'],'title':'Custom story','entry_mode':'existing_bible'})
    assert count()==3
    with client.app.state.database.session() as db:
        db.delete(db.get(Project,third['id']));db.commit()
    assert count()==2
