# Dynamic RAM Notch Launcher
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Launching Dynamic RAM Notch (Desktop Native)       " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan

$releaseExe = "$PSScriptRoot\src-tauri\target\release\notch-daemon.exe"
$debugExe = "$PSScriptRoot\src-tauri\target\debug\notch-daemon.exe"
$backendExe = if (Test-Path $releaseExe) { $releaseExe } else { $debugExe }
if (-not (Get-Process -Name "notch-daemon" -ErrorAction SilentlyContinue)) {
    Write-Host "[1/2] Starting Rust Backend Daemon..." -ForegroundColor Yellow
    Start-Process -FilePath $backendExe -WindowStyle Hidden
    Start-Sleep -Milliseconds 1000
} else {
    Write-Host "[1/2] Rust Backend Daemon is already running." -ForegroundColor Gray
}

$frontendDir = "$PSScriptRoot\frontend"
$electronCmd = "$frontendDir\node_modules\.bin\electron.cmd"

Write-Host "[2/2] Launching Native Floating Notch Window..." -ForegroundColor Green
if (Test-Path $electronCmd) {
    Start-Process -FilePath $electronCmd -ArgumentList "electron-main.cjs" -WorkingDirectory $frontendDir
} else {
    Start-Process -FilePath "npx" -ArgumentList "electron electron-main.cjs" -WorkingDirectory $frontendDir
}

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Notch is now active on your desktop screen!        " -ForegroundColor Green
Write-Host "  Look at the top center of your screen or check     " -ForegroundColor Cyan
Write-Host "  the System Tray (near clock / show hidden icons).  " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
