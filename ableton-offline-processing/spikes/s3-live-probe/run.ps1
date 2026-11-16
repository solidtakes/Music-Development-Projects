<#
  AOPX S3 live probe: install, build and connect to Live 13 Beta (READ-ONLY extension).

  Run from inside this folder after extracting it to <SDK>\examples\aopx-s3-probe :
    powershell -ExecutionPolicy Bypass -File .\run.ps1

  Optional: -LivePath "<path to Ableton Live 13 Beta.exe>"

  The extension only opens dialogs and prints results to this console. It does not edit, render
  or import anything. Use a new, disposable Live Set. Stop any other running extension first.
#>
param(
  [string]$LivePath = "C:\ProgramData\Ableton\Live 13 Beta\Program\Ableton Live 13 Beta.exe"
)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$sdkTgz = Join-Path $PSScriptRoot "..\..\ableton-extensions-sdk-1.0.0-beta.1.tgz"
$cliTgz = Join-Path $PSScriptRoot "..\..\ableton-extensions-cli-1.0.0-beta.1.tgz"
foreach ($f in @($sdkTgz, $cliTgz)) {
  if (-not (Test-Path -LiteralPath $f)) {
    Write-Host "Not found: $f" -ForegroundColor Red
    Write-Host "Extract this folder to <SDK folder>\examples\aopx-s3-probe, for example:"
    Write-Host "  F:\Downloads\extensions-sdk-1.0.0-beta.1\extensions-sdk-1.0.0-beta.1\examples\aopx-s3-probe"
    exit 1
  }
}
if (-not (Test-Path -LiteralPath $LivePath)) {
  Write-Host "Live not found at: $LivePath" -ForegroundColor Red
  Write-Host 'Pass the path:  .\run.ps1 -LivePath "C:\...\Ableton Live 13 Beta.exe"'
  exit 1
}

Write-Host "node $(node --version), npm $(npm --version)"
function Invoke-Step([string]$Label, [string[]]$NpmArgs) {
  Write-Host "== $Label" -ForegroundColor Cyan
  & npm @NpmArgs
  if ($LASTEXITCODE -ne 0) { Write-Host "$Label failed (exit $LASTEXITCODE)." -ForegroundColor Red; exit $LASTEXITCODE }
}
Invoke-Step "npm install" @("install")
Invoke-Step "npm run build (typecheck + bundle)" @("run", "build")
Write-Host "== Connecting to Live. In Live, right-click any clip and choose 'AOPX S3 probe: core cases (read-only)'." -ForegroundColor Cyan
Write-Host "   Results print here between AOPX_S3_RESULTS_BEGIN and AOPX_S3_RESULTS_END. Ctrl+C stops the extension."
& npm start -- --live $LivePath
exit $LASTEXITCODE
