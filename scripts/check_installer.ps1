$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskCheckRoot = [IO.Path]::GetFullPath((Join-Path $taskRoot '.runtime\install-check'))
$taskInstallDir = [IO.Path]::GetFullPath((Join-Path $taskCheckRoot 'StoryForge US'))
$taskDataDir = [IO.Path]::GetFullPath((Join-Path $taskCheckRoot 'StoryForge US Data'))
if (-not $taskCheckRoot.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
    -not $taskInstallDir.StartsWith($taskCheckRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
    -not $taskDataDir.StartsWith($taskCheckRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Installer test paths escaped the project.' }
$taskExe = Join-Path $taskInstallDir 'StoryForge.exe'
if (Test-Path -LiteralPath $taskExe) { throw 'A test installation already exists. Inspect it before rerunning this check.' }
$taskInstaller = (Resolve-Path -LiteralPath (Join-Path $taskRoot 'release\StoryForge-US-3.0.0-Setup.exe')).Path
$taskLog = Join-Path $taskRoot '.runtime\installer-check.log'
$taskProcess = Start-Process -FilePath $taskInstaller -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOICONS','/TASKS=""',('/DIR="' + $taskInstallDir + '"'),('/LOG="' + $taskLog + '"') -WindowStyle Hidden -PassThru -Wait
if ($taskProcess.ExitCode -ne 0) { throw ('Installer exited with ' + $taskProcess.ExitCode) }
& (Join-Path $PSScriptRoot 'check_release.ps1') -Executable $taskExe -UseDefaultDataRoot -Shortcut -ReportName 'installed-smoke-report.json'
$taskUninstaller = (Resolve-Path -LiteralPath (Join-Path $taskInstallDir 'unins000.exe')).Path
if (-not $taskUninstaller.StartsWith($taskInstallDir + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected uninstaller path.' }
$taskHashBefore = (Get-FileHash -LiteralPath (Join-Path $taskDataDir 'storyforge.db') -Algorithm SHA256).Hash
$taskProcess = Start-Process -FilePath $taskUninstaller -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART' -WindowStyle Hidden -PassThru -Wait
if ($taskProcess.ExitCode -ne 0) { throw ('Uninstaller exited with ' + $taskProcess.ExitCode) }
$taskHashAfter = (Get-FileHash -LiteralPath (Join-Path $taskDataDir 'storyforge.db') -Algorithm SHA256).Hash
if ($taskHashBefore -ne $taskHashAfter) { throw 'Database changed during uninstall.' }
if (Test-Path -LiteralPath $taskExe) { throw 'Application binary remained after uninstall.' }
$taskReport = @{ installation = 'pass'; installed_to = $taskInstallDir; shortcut_launch = 'pass'; default_data_folder = $taskDataDir; uninstall = 'pass'; database_preserved = 'pass'; database_sha256 = $taskHashAfter }
$taskReport | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'release\installer-smoke-report.json') -Encoding UTF8
$taskReport | ConvertTo-Json
