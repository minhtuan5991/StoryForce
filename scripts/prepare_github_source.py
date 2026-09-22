"""Stage only application source for GitHub, never local projects or releases."""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = ('backend', 'frontend', 'browser-extension', 'docs', 'fixtures',
           'launcher', 'prompts', 'scripts', 'tests', 'assets', 'installer', '.github')
FILES = ('.gitignore', 'ARCHITECTURE.md', 'BUILD_WINDOWS.md', 'CHANGELOG.md',
         'README.md', 'THIRD_PARTY_NOTICES.md', 'USER_GUIDE.md',
         'build_installer.ps1', 'build_windows.ps1', 'requirements.txt', 'pytest.ini')
SKIP = {'node_modules', 'dist', '__pycache__', '.pytest_cache', 'test-results',
        'playwright-report', '.runtime', '.git'}
SECRET = re.compile(rb'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|'
                    rb'sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|'
                    rb'-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----')


def main():
    candidates = [ROOT / name for name in FILES]
    for name in FOLDERS:
        folder = ROOT / name
        if folder.exists():
            candidates.extend(folder.rglob('*'))
    entries = []
    for path in sorted(set(candidates)):
        relative = path.relative_to(ROOT)
        if SKIP.intersection(relative.parts) or not path.is_file():
            continue
        if any(parent.is_symlink() for parent in (path, *path.parents)):
            raise ValueError(f'Refusing linked source: {relative}')
        if path.name.startswith('.env') or path.name == 'storyforge.config.json':
            continue
        if path.suffix.lower() in {'.pyc', '.db', '.log', '.tsbuildinfo', '.pem', '.key', '.pfx', '.p12'}:
            continue
        data = path.read_bytes()
        if SECRET.search(data):
            raise ValueError(f'Possible secret in {relative}; inspect before publishing')
        entries.append((relative.as_posix(), data))
    output = ROOT / 'release' / 'StoryForge-GitHub-Source.zip'
    output.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries:
            archive.writestr(name, data)
    manifest = {'archive': output.name, 'file_count': len(entries),
                'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                'files': [name for name, _ in entries]}
    output.with_suffix('.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in manifest.items() if key != 'files'}))


if __name__ == '__main__':
    main()
