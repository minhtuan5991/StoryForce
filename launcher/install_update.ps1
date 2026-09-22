param(
    [Parameter(Mandatory=$true)][string]$Installer,
    [Parameter(Mandatory=$true)][string]$AppDirectory,
    [Parameter(Mandatory=$true)][string]$DataDirectory,
    [Parameter(Mandatory=$true)][int]$ParentPid,
    [Parameter(Mandatory=$true)][string]$ExpectedHash
)
$ErrorActionPreference = 'Stop'
$updateFolder = Join-Path $DataDirectory 'updates'
$result = Join-Path $updateFolder 'install-result.json'
try {
    $parent = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
    if ($parent -and -not $parent.WaitForExit(60000)) { throw 'App has not exited; update postponed.' }
    if ((Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash -ne $ExpectedHash) { throw 'Installer SHA256 mismatch' }
    $arguments = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /RESTARTEXITCODE=3010 /DIR="' + $AppDirectory + '" /LOG="' + (Join-Path $updateFolder 'installer.log') + '"'
    $process = Start-Process -FilePath $Installer -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer exit code $($process.ExitCode). Check installer.log." }
    @{state='installed'; finished_at=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $result -Encoding utf8
} catch {
    @{state='error'; message=$_.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath $result -Encoding utf8
} finally {
    $start = Join-Path $AppDirectory 'StoryForge Start.exe'
    if (Test-Path -LiteralPath $start) {
        Start-Process -FilePath $start -ArgumentList ('--data-root "' + $DataDirectory + '"') -WorkingDirectory $AppDirectory -WindowStyle Hidden
    }
}
