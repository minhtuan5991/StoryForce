param([string]$Compiler = '')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'release\StoryForge\StoryForge.exe')) { throw 'Run build_windows.ps1 first.' }
if (-not $Compiler) {
    $taskCandidates = @((Join-Path $PSScriptRoot 'tools\InnoSetup\ISCC.exe'), "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe")
    $Compiler = $taskCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $Compiler) { throw 'Install Inno Setup or supply -Compiler with the path to ISCC.exe.' }
& $Compiler 'installer\StoryForge.iss'
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed' }
& '.\.venv\Scripts\python.exe' 'scripts\package_release.py'
if ($LASTEXITCODE -ne 0) { throw 'Release archive generation failed' }
Write-Output "Release artifacts: $PSScriptRoot\release"
