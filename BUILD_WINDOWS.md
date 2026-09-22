# Building Windows artifacts

Build host: Windows 10/11 x64, Python 3.11+ (validated with 3.12), Node.js compatible with Vite 6, Inno Setup 6, FFmpeg/ffprobe. The finished app needs neither Python nor Node installed.

## Dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
npm ci
cd ..
```

Store `ffmpeg.exe` and `ffprobe.exe` under `tools/`, or under `tools/ffmpeg/<version>/bin/`. The build discovers them recursively. The generated application discovers its packaged copies automatically.

Install the signed compiler from the [official Inno Setup downloads](https://jrsoftware.org/isdl.php), then pass `-Compiler` or place the compiler in `tools/InnoSetup/ISCC.exe`. This workspace already contains the build prerequisites. Review the compiler's license for your build use.

## Build commands

```powershell
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1
powershell -ExecutionPolicy Bypass -File .\build_installer.ps1
```

Optional flags on the first script: `-SkipFrontend`, `-SkipTests`, `-WithoutFFmpeg`. Only skip checks when they have already passed for the exact source being packaged. A build without FFmpeg requires the user to supply those executable paths in Settings.

Generate the optional demo database and short smoke video before packaging ZIPs:

```powershell
.\.venv\Scripts\python.exe scripts\create_demo.py
.\.venv\Scripts\python.exe scripts\package_release.py
```

## Outputs

- `release/StoryForge/StoryForge.exe`: portable executable directory; keep `_internal/` alongside it.
- `release/StoryForge-US-3.0.0-Setup.exe`: installer with directory choice, Desktop and Start Menu helpers, uninstall entry.
- `release/StoryForge-US-3.0.0-Windows-Portable.zip`.
- `release/StoryForge-Browser-Bridge-1.0.0.zip`.
- `release/StoryForge-US-3.0.0-Source.zip` (excludes dependencies, tools, generated test data).
- `release/StoryForge-Demo.db`, `StoryForge-Demo-Project.zip`, `StoryForge-Smoke-Test.mp4`.
- `release/SHA256SUMS.json`.

No code-signing certificate is configured for StoryForge. The build tools are verified upstream downloads, but the generated application and installer are unsigned.

## Installer behavior

The directory page is always shown for interactive installation. Choose any writable drive/path. Data defaults to a sibling `StoryForge US Data`, not AppData or a forced C: location. Uninstall preserves data; an explicit optional deletion prompt applies only to the default data folder with a StoryForge database marker. Custom roots are always preserved.

For isolated installer testing without modifying user shortcuts:

```powershell
.\release\StoryForge-US-3.0.0-Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS="" /DIR="D:\Auto Youtube\storyforge-us\.runtime\install-check\StoryForge US"
```

For a complete automated install → shortcut launch → data-directory verification → uninstall preservation check, run `powershell -ExecutionPolicy Bypass -File .\scripts\check_installer.ps1`. It uses `.runtime/install-check` and preserves its test database; stop the running app first. The executable smoke alone is `powershell -ExecutionPolicy Bypass -File .\scripts\check_release.ps1`.

The Browser Bridge is never installed silently. Use its helper, enable Developer Mode in Chrome/Edge and select Load unpacked yourself.
