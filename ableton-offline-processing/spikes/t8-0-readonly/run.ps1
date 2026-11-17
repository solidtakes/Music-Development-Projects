<# AOPX T8-0 READ-ONLY prototype. Disposable Live 13 Beta Set only. #>
param([string]$LivePath = "C:\ProgramData\Ableton\Live 13 Beta\Program\Ableton Live 13 Beta.exe")
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
foreach ($f in @("..\..\ableton-extensions-sdk-1.0.0-beta.1.tgz", "..\..\ableton-extensions-cli-1.0.0-beta.1.tgz")) {
    if (-not (Test-Path -LiteralPath $f)) {
        throw "Local beta.1 SDK archive missing: $f. Install this folder under the official SDK examples directory."
    }
}
if (-not (Test-Path -LiteralPath $LivePath)) {
    throw "Live 13 Beta executable not found. Check the -LivePath parameter."
}
Write-Host ""
Write-Host "AOPX T8-0 READ-ONLY PROBE: no Set edits, no audio import, no new clip or track." -ForegroundColor Cyan
Write-Host "Open Live 13 Beta fully first. Stop any prior S2/S3/S4 extension CLI." -ForegroundColor Yellow
function Invoke-Checked([string]$Name, [string[]]$Arguments) {
    Write-Host "== $Name" -ForegroundColor Cyan
    & npm @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Name failed, exit $LASTEXITCODE" }
}
Invoke-Checked "Install local SDK beta.1" @("install")
Invoke-Checked "SDK-independent FakeHost tests" @("test")
Invoke-Checked "Typecheck and bundle against real SDK" @("run","build")
Write-Host ""
Write-Host "Right-click an isolated Arrangement audio clip > AOPX T8-0 Preview (READ-ONLY - does not save)." -ForegroundColor Cyan
Write-Host "If the editor opens, Cancel first; later Apply only runs in-memory DSP, never writes to Live." -ForegroundColor Yellow
Write-Host "Console output prefix: AOPX_T8_0. Press Ctrl+C to stop."
& npm start -- --live $LivePath
exit $LASTEXITCODE
