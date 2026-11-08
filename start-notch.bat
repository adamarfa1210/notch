@echo off
title Dynamic RAM Notch
echo ========================================================
echo   Dynamic RAM Notch (Desktop Native Mode)
echo ========================================================

REM 1. Start Rust Backend Daemon in background if not already running
tasklist /FI "IMAGENAME eq notch-daemon.exe" 2>NUL | find /I /N "notch-daemon.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [1/2] Rust Backend Daemon is already running.
) else (
    echo [1/2] Starting Rust Backend Daemon in background...
    start "" /B "%~dp0src-tauri\target\debug\notch-daemon.exe"
    timeout /t 1 /nobreak >nul
)

REM 2. Launch Native Floating Desktop Notch Window
echo [2/2] Launching Native Floating Notch Window...
cd /d "%~dp0frontend"
if exist "node_modules\.bin\electron.cmd" (
    start "" "node_modules\.bin\electron.cmd" electron-main.cjs
) else (
    start "" npx electron electron-main.cjs
)
echo.
echo ========================================================
echo   Notch is now active!
echo   Check the top center of your screen or the System Tray.
echo ========================================================
