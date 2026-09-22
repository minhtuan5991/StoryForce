"""Build a portable sample database and a real short FFmpeg smoke artifact."""
import io
import json
import math
from pathlib import Path
import shutil
import struct
import sys
import wave
from uuid import uuid4
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.api import create_app
from fastapi.testclient import TestClient

root=Path(__file__).resolve().parents[1]
class Inline:
    def submit(self,fn,*args,**kwargs):fn(*args,**kwargs)
    def shutdown(self,**kwargs):pass

def main():
    app=create_app(root/'.runtime'/('release-demo-'+uuid4().hex[:8]))
    app.state.workflow.executor.shutdown(wait=True)
    app.state.workflow.executor=Inline()
    with TestClient(app) as client:
        client.headers['X-StoryForge-Token']=client.get('/api/session').json()['token']
        client.patch('/api/settings',json={'pipeline_mode':'auto'}).raise_for_status()
        client.post('/api/demo')
        project=next(p for p in client.get('/api/projects').json()['items'] if p['target_minutes']==20)
        pid=project['id']
        def run(kind,payload=None):
            r=client.post('/api/jobs',json={'kind':kind,'project_id':pid,'payload':payload or {}})
            r.raise_for_status()
            record=next(j for j in client.get('/api/jobs').json()['items'] if j['id']==r.json()['id'])
            if record['status']!='completed':raise RuntimeError(record['error'])
            return record['result']
        detail=client.get('/api/projects/'+pid).json()
        if not detail['locked']:
            client.post('/api/projects/'+pid+'/pipeline').raise_for_status()
            detail=client.get('/api/projects/'+pid).json()
            client.post('/api/projects/'+pid+'/select-premise',json={'premise_id':detail['premises'][0]['id']}).raise_for_status()
            client.post('/api/projects/'+pid+'/pipeline').raise_for_status()
            client.post('/api/projects/'+pid+'/lock').raise_for_status()
        run('chunk_tts');run('visual_director',{'count':3})
        detail=client.get('/api/projects/'+pid).json()
        for chunk in detail['chunks']:
            buffer=io.BytesIO()
            with wave.open(buffer,'wb') as w:
                w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000)
                w.writeframes(b''.join(struct.pack('<h',int(2300*math.sin(2*math.pi*(180+chunk['number']*40)*i/24000))) for i in range(24000*2)))
            client.post('/api/projects/'+pid+'/assets',files=[('files',(f"tts_{chunk['number']:03}.wav",buffer.getvalue(),'audio/wav'))]).raise_for_status()
        for scene in detail['scenes']:
            im=Image.new('RGB',(960,540),'#132239');d=ImageDraw.Draw(im)
            d.ellipse((610,70,810,270),fill='#dbad72')
            d.polygon([(0,380),(170,240),(390,365),(620,190),(960,390),(960,540),(0,540)],fill=('#244469','#334569','#214b5b')[scene['number']-1])
            d.polygon([(0,490),(310,310),(510,455),(790,360),(960,510),(960,540),(0,540)],fill='#101d30')
            d.text((42,37),'STORYFORGE US / RENDER SMOKE TEST',fill='#d4e7ff',font_size=25)
            d.text((42,458),f"Scene {scene['number']:03} / Synthetic test audio",fill='#ddc49a',font_size=21)
            buffer=io.BytesIO();im.save(buffer,format='PNG')
            client.post('/api/projects/'+pid+'/assets',files=[('files',(f"scene_{scene['number']:03}.png",buffer.getvalue(),'image/png'))]).raise_for_status()
        run('sync')
        client.patch('/api/settings',json={'render_width':960,'render_height':540,'render_fps':30})
        report=run('render')
        (root/'release').mkdir(exist_ok=True)
        output=root/'release'/'StoryForge-Smoke-Test.mp4'
        output.write_bytes(client.get('/api/projects/'+pid+'/download/final_video.mp4').content)
        (root/'release'/'smoke-render-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        (root/'release'/'StoryForge-Demo-Project.zip').write_bytes(client.get('/api/projects/'+pid+'/export?media=true').content)
        client.patch('/api/settings',json={'render_width':1920,'render_height':1080,'render_fps':30,'pipeline_mode':'assisted'})
        (root/'release'/'StoryForge-Demo.db').write_bytes(client.get('/api/backup').content)
        print(json.dumps(report,indent=2))
if __name__=='__main__':main()
