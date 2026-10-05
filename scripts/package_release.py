from pathlib import Path
import hashlib
import json
import re
import zipfile

root=Path(__file__).resolve().parents[1]
release=root/'release';release.mkdir(exist_ok=True)
version=re.search(r'^VERSION\s*=\s*[\"\']([^\"\']+)',(root/'backend'/'config.py').read_text(encoding='utf-8'),re.MULTILINE).group(1)
bridge_version=json.loads((root/'browser-extension'/'manifest.json').read_text(encoding='utf-8'))['version']
def zip_tree(folder,output,exclude=()):
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
        for path in folder.rglob('*'):
            relative=path.relative_to(folder)
            if any(part in exclude for part in relative.parts):continue
            if path.is_file() and path.suffix not in ('.pyc','.tsbuildinfo','.log'):
                archive.write(path,relative.as_posix())
zip_tree(root/'browser-extension',release/f'StoryForge-Browser-Bridge-{bridge_version}.zip')
zip_tree(root,release/f'StoryForge-US-{version}-Source.zip',exclude={'.venv','node_modules','.git','.runtime','release','build','tools','__pycache__','.pytest_cache','test-results','playwright-report','dist'})
zip_tree(release/'StoryForge',release/f'StoryForge-US-{version}-Windows-Portable.zip')
manifest=[]
for path in sorted(release.iterdir()):
    if path.is_file() and path.suffix in ('.exe','.zip','.mp4','.db'):
        sha=hashlib.sha256()
        with path.open('rb') as f:
            while data:=f.read(1024*1024):sha.update(data)
        manifest.append({'file':path.name,'bytes':path.stat().st_size,'sha256':sha.hexdigest()})
(release/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest,indent=2))
