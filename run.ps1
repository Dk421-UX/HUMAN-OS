# Human OS Startup Automation Script
# Run this from PowerShell in the root directory: powershell ./run.ps1

Clear-Host
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "               HUMAN OS                  " -ForegroundColor Cyan
Write-Host "  Operating System for Understanding Self" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Express Backend
Write-Host "[1/2] Launching Pattern Engine & Memory Server (Port 5000)..." -ForegroundColor Gray
$BackendPath = Join-Path $PSScriptRoot "backend"
$BackendCommand = "`$Host.UI.RawUI.WindowTitle='Human OS Backend'; Set-Location -LiteralPath '$BackendPath'; npm.cmd run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCommand -WindowStyle Normal

# Give the backend a quick second to bind to port 5000
Start-Sleep -Seconds 2

# 2. Start Next.js Frontend
Write-Host "[2/2] Launching Frontend Interface (Port 3000)..." -ForegroundColor Gray
$FrontendPath = Join-Path $PSScriptRoot "frontend"
$FrontendCommand = "`$Host.UI.RawUI.WindowTitle='Human OS Frontend'; Set-Location -LiteralPath '$FrontendPath'; npm.cmd run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCommand -WindowStyle Normal

Write-Host ""
Write-Host "-----------------------------------------" -ForegroundColor Green
Write-Host "Human OS successfully launched!" -ForegroundColor Green
Write-Host "-----------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "  -> Frontend UI:  http://localhost:3000" -ForegroundColor White
Write-Host "  -> Backend API: http://localhost:5000" -ForegroundColor White
Write-Host ""
Write-Host "Close the spawned PowerShell terminals when done." -ForegroundColor DarkGray
Write-Host ""
