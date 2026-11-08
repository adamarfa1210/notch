# Dynamic RAM Notch Launcher
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Launching Dynamic RAM Notch (Desktop Native)       " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan

$backendExe = "$PSScriptRoot\src-tauri\target\debug\notch-daemon.exe"
if (-not (Get-Process -Name "notch-daemon" -ErrorAction SilentlyContinue)) {
    Write-Host "[1/2] Starting Rust Backend Daemon..." -ForegroundColor Yellow
    Start-Process -FilePath $backendExe -WindowStyle Hidden
    Start-Sleep -Milliseconds 800
} else {
    Write-Host "[1/2] Rust Backend Daemon is already running." -ForegroundColor Gray
}

Write-Host "[2/2] Launching Native Floating Notch Window..." -ForegroundColor Green
Set-Location "$PSScriptRoot\frontend"
npm run desktop
