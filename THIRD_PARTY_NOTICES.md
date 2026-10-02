# Third-party components

The application uses React (MIT), Vite (MIT), TypeScript (Apache-2.0), Lucide (ISC), FastAPI (MIT), SQLAlchemy (MIT), Pydantic (MIT), Uvicorn (BSD-3-Clause), Pillow (HPND) and SQLite (public domain). Consult the included dependency metadata/source repositories for full licenses.

PyInstaller is GPL with an exception allowing distribution of bundled applications. Inno Setup is a separately installed build tool; its license applies to compiler use.

This build bundles FFmpeg/ffprobe from the Gyan Windows essentials distribution, licensed GPLv3. The app invokes them as separate executables. Preserve their copyright and license notices when redistributing.

- FFmpeg project, license and source: https://ffmpeg.org/legal.html and https://ffmpeg.org/download.html
- Windows build provenance: https://www.gyan.dev/ffmpeg/builds/
- Build used here: release essentials 9.0.1; FFmpeg source revision `bf1b838f2a`.
- Corresponding upstream source: https://github.com/FFmpeg/FFmpeg/tree/bf1b838f2a
- Build configuration can be inspected with `ffmpeg -buildconf`.

The installer also includes Gyan's FFmpeg 7.1.1 essentials build as
`ffmpeg-compatible.exe`, used only by the renderer when it restores supported
NVIDIA acceleration. It is an unmodified, separate GPLv3 executable; the main
FFmpeg/ffprobe remain unchanged for other operations.

- Compatibility build archive: https://github.com/GyanD/codexffmpeg/releases/tag/7.1.1
- Corresponding upstream source: https://github.com/FFmpeg/FFmpeg/tree/n7.1.1
- License and build configuration notices: `docs/FFmpeg-compatible-LICENSE` and `docs/FFmpeg-compatible-README.txt`.
- Pinned provenance/checksums: `docs/render-runtime.json`. Downloaded and verified during packaging, never downloaded by a running app.

Third-party provider names are text labels only. No provider logos, credentials or private browser sessions are bundled. Landscape illustrations, brand mark, story fixtures and demo images were created for this project.
