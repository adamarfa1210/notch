# Dynamic RAM Notch Launcher
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Launching Dynamic RAM Notch (Desktop Native)       " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan

$backendExe = "$PSScriptRoot\src-tauri\target\debug\notch-daemon.exe"
if (-not (Get-Process -Name "notch-daemon" -ErrorAction SilentlyContinue)) {
    Write-Host "[1/2] Starting Rust Backend Daemon..." -ForegroundColor Yellow
    Start-Process -FilePath $backendExe -WindowStyle Hidden
    Start-Sleep -Milliseconds 1000
} else {
    Write-Host "[1/2] Rust Backend Daemon is already running." -ForegroundColor Gray
}

$electronExe = "$PSScriptRoot\frontend\node_modules\electron\dist\electron.exe"
$mainCjs = "$PSScriptRoot\frontend\electron-main.cjs"

Write-Host "[2/2] Launching Native Floating Notch Window..." -ForegroundColor Green
Start-Process -FilePath $electronExe -ArgumentList "`"$mainCjs`""

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Notch is now active on your desktop screen!        " -ForegroundColor Green
Write-Host "  Look at the top center of your screen or check     " -ForegroundColor Cyan
Write-Host "  the System Tray (near clock / show hidden icons).  " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
