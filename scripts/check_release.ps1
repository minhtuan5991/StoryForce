param([string]$Executable = '', [string]$DataRoot = '', [switch]$UseDefaultDataRoot, [switch]$Shortcut, [string]$ReportName = 'packaged-smoke-report.json')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
if (-not $Executable) { $Executable = Join-Path $taskRoot 'release\StoryForge\StoryForge.exe' }
$taskExePath = (Resolve-Path -LiteralPath $Executable).Path
if ($UseDefaultDataRoot) { $DataRoot = Join-Path (Split-Path -Parent (Split-Path -Parent $taskExePath)) 'StoryForge US Data' }
if (-not $DataRoot) { $DataRoot = Join-Path $taskRoot '.runtime\packaged-check' }
$taskDataPath = [IO.Path]::GetFullPath($DataRoot)
if (-not $taskDataPath.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Smoke data root must stay inside this project.' }
if ([IO.Path]::GetFileName($ReportName) -ne $ReportName) { throw 'ReportName must be a filename.' }
$taskExisting = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($taskExisting) { throw 'Port 8787 is occupied. Stop the app or test server first.' }
$taskArguments = '--no-browser'
if (-not $UseDefaultDataRoot) { $taskArguments += ' --data-root="' + $taskDataPath + '"' }
if ($Shortcut) {
    $taskShortcutPath = Join-Path $taskRoot '.runtime\Start StoryForge smoke.lnk'
    $taskShell = New-Object -ComObject WScript.Shell
    $taskLink = $taskShell.CreateShortcut($taskShortcutPath)
    $taskLink.TargetPath = $taskExePath
    $taskLink.Arguments = $taskArguments
    $taskLink.WorkingDirectory = Split-Path -Parent $taskExePath
    $taskLink.Save()
    $taskProcess = Start-Process -FilePath $taskShortcutPath -WindowStyle Hidden -PassThru
} else {
    $taskProcess = Start-Process -FilePath $taskExePath -ArgumentList $taskArguments -WindowStyle Hidden -PassThru
}
try {
    $taskHealth = $null
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:8787/api/health' -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $taskHealth) { throw 'Packaged application did not start. Inspect startup-error.log in the smoke data root.' }
    if ($taskHealth.app -ne 'StoryForge US' -or -not $taskHealth.ffmpeg -or -not $taskHealth.ffprobe) { throw 'Packaged health or FFmpeg discovery failed.' }
    if ([IO.Path]::GetFullPath($taskHealth.data_root) -ne $taskDataPath) { throw 'Application selected an unexpected data directory.' }
    $taskSession = Invoke-RestMethod 'http://127.0.0.1:8787/api/session'
    $taskHeaders = @{ 'X-StoryForge-Token' = $taskSession.token }
    $taskBody = @{ name = 'Packaged release smoke'; status = 'ESTABLISHED'; niche = 'Mystery' } | ConvertTo-Json
    $taskChannel = Invoke-RestMethod 'http://127.0.0.1:8787/api/channels' -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskBody
    $taskProjectBody = @{ title = 'Packaged executable project'; channel_id = $taskChannel.id; target_minutes = 5; duration_mode = '5' } | ConvertTo-Json
    $taskProject = Invoke-RestMethod 'http://127.0.0.1:8787/api/projects' -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskProjectBody
    $taskJobBody = @{ kind = 'content_direction'; project_id = $taskProject.id } | ConvertTo-Json
    Invoke-RestMethod 'http://127.0.0.1:8787/api/jobs' -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskJobBody | Out-Null
    for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
        $taskDetail = Invoke-RestMethod ('http://127.0.0.1:8787/api/projects/' + $taskProject.id)
        if ($taskDetail.artifacts.content_direction) { break }
        Start-Sleep -Milliseconds 300
    }
    if (-not $taskDetail.artifacts.content_direction) { throw 'Bundled mock provider did not complete the job.' }
    Invoke-RestMethod 'http://127.0.0.1:8787/api/settings' -Method Patch -Headers $taskHeaders -ContentType 'application/json' -Body '{"pipeline_mode":"manual","default_premise_count":7}' | Out-Null
    Invoke-RestMethod ('http://127.0.0.1:8787/api/projects/' + $taskProject.id + '/pipeline') -Method Post -Headers $taskHeaders | Out-Null
    for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
        $taskDetail = Invoke-RestMethod ('http://127.0.0.1:8787/api/projects/' + $taskProject.id)
        if ($taskDetail.premises.Count -eq 7) { break }
        Start-Sleep -Milliseconds 300
    }
    if ($taskDetail.premises.Count -ne 7 -or $taskDetail.artifacts.premise_mini_test) { throw 'Packaged workflow settings were not applied.' }
    Invoke-RestMethod 'http://127.0.0.1:8787/api/settings' -Method Patch -Headers $taskHeaders -ContentType 'application/json' -Body '{"pipeline_mode":"assisted","default_premise_count":10}' | Out-Null
    $taskPage = Invoke-WebRequest 'http://127.0.0.1:8787/' -UseBasicParsing
    if ($taskPage.Content -notmatch 'assets/index-') { throw 'Bundled React assets not served.' }
    $taskResult = @{ executable = $taskExePath; health = $taskHealth; static_frontend = 'pass'; channel_create = 'pass'; project_create = 'pass'; bundled_mock_job = 'pass'; saved_workflow_settings = 'pass'; default_sibling_data = [bool]$UseDefaultDataRoot; shortcut_launch = [bool]$Shortcut }
    $taskResult | ConvertTo-Json -Depth 5
    $taskResult | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskRoot ('release\' + $ReportName)) -Encoding UTF8
} finally {
    if (Test-Path -LiteralPath $taskDataPath) { Set-Content -LiteralPath (Join-Path $taskDataPath 'stop.request') -Value 'stop' }
    if ($taskProcess -and -not $taskProcess.WaitForExit(15000)) { throw 'Packaged process did not respond to its stop helper sentinel.' }
}
