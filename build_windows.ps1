param([switch]$SkipFrontend, [switch]$SkipTests, [switch]$WithoutFFmpeg, [string]$ReleaseDirectory = 'release')
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskPython = Join-Path $taskRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Create .venv and install requirements.txt first. See BUILD_WINDOWS.md.' }
& $taskPython scripts\create_icon.py
if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed' }
if (-not $SkipFrontend) {
    Push-Location -LiteralPath (Join-Path $taskRoot 'frontend')
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    Pop-Location
}
if (-not $SkipTests) {
    & $taskPython -m pytest -q
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
    Push-Location -LiteralPath (Join-Path $taskRoot 'frontend')
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
    Pop-Location
}
$taskBuildArgs = @('-m','PyInstaller','--noconfirm','--clean','--onedir','--windowed','--name','StoryForge','--distpath',$ReleaseDirectory,'--workpath','build\pyinstaller','--specpath','build','--paths',$taskRoot,'--icon',(Join-Path $taskRoot 'installer\storyforge.ico'),'--add-data',"$taskRoot\frontend\dist;frontend\dist",'--add-data',"$taskRoot\prompts;prompts",'--add-data',"$taskRoot\fixtures;fixtures",'--add-data',"$taskRoot\browser-extension;browser-extension",'--collect-all','uvicorn','--hidden-import','sqlalchemy.dialects.sqlite','--hidden-import','PIL.Image','--hidden-import','PIL.ImageDraw')
if (-not $WithoutFFmpeg) {
    $taskFFmpeg = Get-ChildItem -LiteralPath (Join-Path $taskRoot 'tools') -Recurse -Filter ffmpeg.exe | Select-Object -First 1
    $taskFFprobe = Get-ChildItem -LiteralPath (Join-Path $taskRoot 'tools') -Recurse -Filter ffprobe.exe | Select-Object -First 1
    if (-not $taskFFmpeg -or -not $taskFFprobe) { throw 'Place FFmpeg and ffprobe in tools, or pass -WithoutFFmpeg.' }
    $taskBuildArgs += @('--add-binary',"$($taskFFmpeg.FullName);tools",'--add-binary',"$($taskFFprobe.FullName);tools")
}
$taskBuildArgs += @('--add-data',"$taskRoot\launcher\install_update.ps1;launcher",'launcher\main.py')
& $taskPython @taskBuildArgs
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed' }
$taskRelease = Join-Path $ReleaseDirectory 'StoryForge'
Copy-Item -LiteralPath 'installer\storyforge.ico' -Destination $taskRelease -Force
Copy-Item -LiteralPath 'README.md','USER_GUIDE.md','BUILD_WINDOWS.md','ARCHITECTURE.md','CHANGELOG.md','THIRD_PARTY_NOTICES.md' -Destination $taskRelease -Force
Copy-Item -LiteralPath 'browser-extension' -Destination $taskRelease -Recurse -Force
Copy-Item -LiteralPath 'docs' -Destination $taskRelease -Recurse -Force
if (-not $WithoutFFmpeg) {
    $taskNotices = Get-ChildItem -LiteralPath (Join-Path $taskRoot 'tools\ffmpeg') -Recurse -File | Where-Object { $_.Name -match '^(LICENSE|README)' }
    foreach ($taskNotice in $taskNotices) { Copy-Item -LiteralPath $taskNotice.FullName -Destination (Join-Path $taskRelease ('docs\FFmpeg-' + $taskNotice.Name)) -Force }
}
Write-Output "Windows release: $taskRelease\StoryForge.exe"
