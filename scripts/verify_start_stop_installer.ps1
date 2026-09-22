param([string]$ReleaseRoot = '')
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
if (-not $ReleaseRoot) { $ReleaseRoot = Join-Path $repo 'release\StoryForge' }
$checkRoot = Join-Path $repo '.runtime\start-stop-check'
New-Item -ItemType Directory -Force -Path $checkRoot | Out-Null
$source = Get-Content -LiteralPath (Join-Path $repo 'installer\StoryForge.iss') -Raw
if ($source -notmatch '#define AppVersion "([0-9.]+)"') { throw 'Installer version missing' }
$version = $Matches[1]
# Redirect every installer side effect to a disposable workspace; no user shortcuts or uninstall registration.
$source = $source.Replace('AppId={{B5F47D41-970F-48AA-AFE3-4982B853F742}', 'AppId=StoryForgeStartStopPackagingCheck')
$source = $source.Replace('UsePreviousAppDir=yes', "UsePreviousAppDir=no`nUsePreviousTasks=no`nUsePreviousGroup=no`nUninstallable=no`nCreateUninstallRegKey=no")
$source = $source.Replace('DefaultDirName={sd}\Tools\StoryForge US', "DefaultDirName=$checkRoot\installed")
$source = $source.Replace('OutputDir=..\release', "OutputDir=$checkRoot")
$source = $source.Replace('SetupIconFile=storyforge.ico', "SetupIconFile=$repo\installer\storyforge.ico")
$source = $source.Replace('..\release\StoryForge', $ReleaseRoot)
$source = $source.Replace('{autodesktop}', "$checkRoot\desktop").Replace('{group}', "$checkRoot\menu")
$fixture = Join-Path $checkRoot 'verify.iss'
Set-Content -LiteralPath $fixture -Value $source -Encoding utf8
& (Join-Path $repo 'tools\InnoSetup\ISCC.exe') $fixture | Out-File (Join-Path $checkRoot 'compile.log')
if ($LASTEXITCODE -ne 0) { throw 'Test installer compilation failed' }
$setup = Join-Path $checkRoot "StoryForge-US-$version-Setup.exe"
$proc = Start-Process -FilePath $setup -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /TASKS=desktopicon' -WindowStyle Hidden -Wait -PassThru
if ($proc.ExitCode -ne 0) { throw "Install failed: $($proc.ExitCode)" }
$installedExe = Join-Path $checkRoot 'installed\StoryForge Start.exe'
if ((Get-FileHash -LiteralPath $installedExe).Hash -ne (Get-FileHash -LiteralPath (Join-Path $ReleaseRoot 'StoryForge.exe')).Hash) { throw 'App binary changed' }
if (Test-Path -LiteralPath (Join-Path $checkRoot 'installed\StoryForge.exe')) { throw 'Old executable name still installed' }
$shell = New-Object -ComObject WScript.Shell
$results = foreach ($location in @('desktop', 'menu', 'installed')) {
    $names = if ($location -eq 'installed') { @('StoryForge Stop') } else { @('StoryForge Start', 'StoryForge Stop') }
    foreach ($name in $names) {
        $path = Join-Path $checkRoot "$location\$name.lnk"
        if (-not (Test-Path -LiteralPath $path)) { throw "Missing shortcut: $path" }
        $link = $shell.CreateShortcut($path)
        $expectedArgs = if ($name -eq 'StoryForge Stop') { '--helper stop' } else { '' }
        if ($link.TargetPath -ne $installedExe -or $link.Arguments -ne $expectedArgs) { throw "Invalid shortcut: $path" }
        [pscustomobject]@{Location=$location; Name=$name; Target=$link.TargetPath; Arguments=$link.Arguments}
    }
}
$results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $checkRoot 'verified.json') -Encoding utf8
Write-Output 'PASS: installed executable is unchanged; all 5 Start/Stop shortcuts point to the correct executable and arguments.'
