import time
from backend.models import Channel,Source,Project

def test_pagination_with_twenty_channels_thousand_sources_five_hundred_projects(client):
    with client.app.state.database.session() as db:
        channels=[Channel(name=f'Scale channel {i}') for i in range(20)]
        db.add_all(channels);db.flush()
        db.add_all([Source(channel_id=channels[i%20].id,title=f'Source {i:04}',transcript='Original source text. '*150) for i in range(1000)])
        db.add_all([Project(channel_id=channels[i%20].id,title=f'Project {i:04}',draft='Narration paragraph. '*500) for i in range(500)])
        db.commit()
    start=time.perf_counter()
    channels=client.get('/api/channels').json()
    sources=client.get('/api/sources?offset=950&limit=50').json()
    projects=client.get('/api/projects?offset=450&limit=50').json()
    assert channels['total']==20 and sum(c['project_count'] for c in channels['items'])==500
    assert sources['total']==1000 and len(sources['items'])==50
    assert projects['total']==500 and len(projects['items'])==50
    assert time.perf_counter()-start<10, 'Local pagination smoke budget exceeded'
