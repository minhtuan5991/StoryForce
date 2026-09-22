param([string]$NotesFile, [string]$Gh = 'gh')
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoRoot
if (-not (Get-Command $Gh -ErrorAction SilentlyContinue)) { $Gh = Join-Path $repoRoot 'tools\github-cli\bin\gh.exe' }
$config = Get-Content -LiteralPath 'backend\config.py' -Raw
if ($config -notmatch 'VERSION = "(\d+\.\d+\.\d+)"') { throw 'Version not found' }
$version = $Matches[1]
$asset = Join-Path $repoRoot "release\StoryForge-US-$version-Setup.exe"
if (-not (Test-Path -LiteralPath $asset)) { throw 'Build the installer first' }
if (-not $NotesFile -or -not (Test-Path -LiteralPath $NotesFile)) { throw 'Supply a release notes text file with -NotesFile' }
& $Gh release create "v$version" $asset --repo minhtuan5991/StoryForce --verify-tag --draft --title "StoryForge $version" --notes-file $NotesFile
if ($LASTEXITCODE -ne 0) { throw 'Draft release failed; inspect GitHub before retrying' }
Write-Output "Draft uploaded. Verify the asset, then publish release v$version on GitHub."
