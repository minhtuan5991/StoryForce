"""Fetch the pinned compatibility renderer without changing the main FFmpeg."""
import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
config = json.loads((root/'docs/render-runtime.json').read_text(encoding='utf-8'))
target = root/'tools/ffmpeg-compatible.exe'
target.parent.mkdir(parents=True, exist_ok=True)
def checksum(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
if not target.exists() or checksum(target) != config['binary_sha256']:
    folder = root/'.runtime'
    folder.mkdir(exist_ok=True)
    archive = folder/f"ffmpeg-{config['version']}.zip"
    if not archive.exists() or checksum(archive) != config['archive_sha256']:
        urllib.request.urlretrieve(config['url'], archive)
    if checksum(archive) != config['archive_sha256']:
        raise ValueError('Compatibility renderer archive checksum mismatch')
    with zipfile.ZipFile(archive) as files:
        with files.open(config['binary']) as source, target.open('wb') as output:
            shutil.copyfileobj(source, output)
        for name in ('LICENSE', 'README.txt'):
            candidates = [n for n in files.namelist() if n.rsplit('/',1)[-1] == name]
            if candidates:
                (root/'docs'/('FFmpeg-compatible-'+name)).write_bytes(files.read(candidates[0]))
    if checksum(target) != config['binary_sha256']:
        raise ValueError('Compatibility renderer binary checksum mismatch')
print(f"Compatibility renderer {config['version']} ready")
