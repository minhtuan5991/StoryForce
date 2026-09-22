# Release verification — StoryForge US 3.0.0

Executed locally on Windows x64 on 18 September 2026. These results apply to the supplied local build; they do not certify authenticated third-party AI pages or every Windows configuration.

| Check | Result | Evidence / coverage |
| --- | --- | --- |
| Backend | **41 passed** | CRUD, discovery, Story DNA, duration/chunking, audit disputes, targeted repairs, dual verification, context invalidation, workflow modes, saved defaults, security, persistence, backup, real media rendering |
| Frontend unit tests | **2 passed** | Structured content rendering and user-facing labels |
| Edge browser E2E | **2 passed** | Create channel/project, duration wizard, refresh persistence, premise checkpoint, dual-gate lock, issue evidence, visual plan, asset upload/mapping, mobile menu and demo dashboard |
| Production frontend | **Passed** | TypeScript build and Vite production bundle |
| Library scale smoke | **Passed** | 20 channels, 1,000 sources, 500 projects and pagination; included in backend count |
| Real FFmpeg render | **READY, 8/8 checks passed** | H.264/AAC MP4, 14 seconds, 960×540, 30 fps, stereo 48 kHz; selectable subtitles; `smoke-render-report.json` |
| PyInstaller Windows build | **Passed** | Bundles Python runtime, React assets, prompts, fixtures, Browser Bridge, FFmpeg and ffprobe |
| Portable executable smoke | **Passed** | Localhost start/stop, static UI, SQLite writes, mock job and saved workflow settings; `packaged-smoke-report.json` |
| Inno Setup installer | **Passed** | Compiled `.exe`; custom installation folder on D: |
| Installed application / shortcut | **Passed** | Launch through Windows `.lnk`, bundled tools and default sibling data directory; `installed-smoke-report.json` |
| Uninstall preservation | **Passed** | Test application removed; SQLite database SHA-256 unchanged; `installer-smoke-report.json` |

The short video uses original geometric images and synthetic tones. It verifies media handling, not voice quality or a complete 20-minute narration. Human review remains required even when technical QA passes.

The first plain pytest invocation encountered a Windows shared-temp ownership error. Test isolation now uses a unique `.runtime/pytest-*` folder inside the project; the normal command below passes without changing machine-wide temp permissions. One upstream AnyIO deprecation warning remains; it does not fail tests.

## Reproduce tests

From the source project directory:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
cd frontend
npm test
npm run test:e2e
cd ..
.\scripts\check_release.ps1
```

Stop the running app before browser or packaged smoke tests; they use port 8787. `check_release.ps1` uses a separate test database and stops the process it starts.

## Reproduce the Windows release

```powershell
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1
powershell -ExecutionPolicy Bypass -File .\build_installer.ps1
```

Prerequisites and optional flags are in `BUILD_WINDOWS.md`. The delivered build used `-SkipFrontend -SkipTests` for its final packaging pass only after the exact frontend build and all tests above had passed. Demo generation: `.\.venv\Scripts\python.exe scripts\create_demo.py`.

## What remains manual / unverified

- Log into provider sites, handle CAPTCHA/quota, load/pair the extension, choose voices, download/attach generated media, approve story checkpoints and review the final video.
- Upload to YouTube and enter analytics manually.
- Live authenticated ChatGPT/Gemini/AI Studio/Flow selectors were not exercised; manual copy/paste remains available.
- Long media-heavy 45–60 minute projects, multiple hardware configurations, literal E: installation and code signing were not validated. Custom D: installation was tested. The application and installer are unsigned.
- The full practical scope is recorded in `IMPLEMENTATION_STATUS.md`, including heuristic novelty/fit, subtitle timing, export and production limits.

Reports, installer, source/portable/bridge ZIPs, demo database/project, smoke video and SHA-256 manifest accompany the files in the release folder. The local source workspace is `D:\Auto Youtube\storyforge-us`.
