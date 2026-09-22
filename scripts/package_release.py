from pathlib import Path
import hashlib
import json
import zipfile

root=Path(__file__).resolve().parents[1]
release=root/'release';release.mkdir(exist_ok=True)
def zip_tree(folder,output,exclude=()):
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
        for path in folder.rglob('*'):
            relative=path.relative_to(folder)
            if any(part in exclude for part in relative.parts):continue
            if path.is_file() and path.suffix not in ('.pyc','.tsbuildinfo','.log'):
                archive.write(path,relative.as_posix())
zip_tree(root/'browser-extension',release/'StoryForge-Browser-Bridge-1.0.0.zip')
zip_tree(root,release/'StoryForge-US-3.0.0-Source.zip',exclude={'.venv','node_modules','.git','.runtime','release','build','tools','__pycache__','.pytest_cache','test-results','playwright-report','dist'})
zip_tree(release/'StoryForge',release/'StoryForge-US-3.0.0-Windows-Portable.zip')
manifest=[]
for path in sorted(release.iterdir()):
    if path.is_file() and path.suffix in ('.exe','.zip','.mp4','.db'):
        sha=hashlib.sha256()
        with path.open('rb') as f:
            while data:=f.read(1024*1024):sha.update(data)
        manifest.append({'file':path.name,'bytes':path.stat().st_size,'sha256':sha.hexdigest()})
(release/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest,indent=2))
