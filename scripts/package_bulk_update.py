"""Package the bulk selection update without overwriting previous releases."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
release = root / "release"
prefix = "StoryForge-US-3.0.0-Bulk"


def archive_tree(folder, target, excluded=()):
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=5) as archive:
        for path in folder.rglob("*"):
            relative = path.relative_to(folder)
            if any(part in excluded for part in relative.parts):
                continue
            if path.is_file() and path.suffix not in (".pyc", ".tsbuildinfo", ".log"):
                archive.write(path, relative.as_posix())


archive_tree(release / "StoryForge", release / (prefix + "-Portable.zip"))
archive_tree(root, release / (prefix + "-Source.zip"), {
    ".venv", "node_modules", ".git", ".runtime", "release", "build", "tools",
    "__pycache__", ".pytest_cache", "test-results", "playwright-report", "dist",
})
manifest = []
for path in sorted(release.glob(prefix + "*")):
    if path.is_file() and path.suffix in (".exe", ".zip"):
        with path.open("rb") as handle:
            checksum = hashlib.file_digest(handle, "sha256").hexdigest()
        if path.suffix == ".zip":
            with zipfile.ZipFile(path) as archive:
                if archive.testzip() is not None:
                    raise RuntimeError("Invalid archive: " + path.name)
        manifest.append({"file": path.name, "bytes": path.stat().st_size, "sha256": checksum})
(release / "SHA256SUMS-Bulk.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(json.dumps(manifest, indent=2))
