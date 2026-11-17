<# AOPX S2 READ-ONLY inspector; Live 13 Beta and disposable Set ONLY. #>
param([string]$LivePath = "C:\ProgramData\Ableton\Live 13 Beta\Program\Ableton Live 13 Beta.exe")
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
foreach ($f in @("..\..\ableton-extensions-sdk-1.0.0-beta.1.tgz", "..\..\ableton-extensions-cli-1.0.0-beta.1.tgz")) {
  if (-not (Test-Path -LiteralPath $f)) { throw "SDK archive missing: $f; install under the SDK examples folder." }
}
if (-not (Test-Path -LiteralPath $LivePath)) { throw "Live 13 Beta executable not found: $LivePath" }
Write-Host "AOPX S2 read-only AudioClip inspector" -ForegroundColor Cyan
& npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
& npm test
if ($LASTEXITCODE -ne 0) { throw "S2 snapshot unit tests failed" }
& npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed; do not launch" }
Write-Host "Right-click a disposable audio clip > AOPX S2 inspect audio clip (read-only)." -ForegroundColor Cyan
Write-Host "Capture JSON between AOPX_S2_RESULTS_BEGIN and AOPX_S2_RESULTS_END; Ctrl+C stops."
& npm start -- --live $LivePath
exit $LASTEXITCODE
