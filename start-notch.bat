@echo off
title Dynamic RAM Notch Launcher
echo ========================================================
echo   Dynamic RAM Notch (Desktop Native Mode)
echo ========================================================

REM 1. Ensure Rust Backend Daemon is running
tasklist /FI "IMAGENAME eq notch-daemon.exe" 2>NUL | find /I /N "notch-daemon.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [1/2] Rust Backend Daemon is already running.
) else (
    echo [1/2] Starting Rust Backend Daemon in background...
    start /B "" "%~dp0src-tauri\target\debug\notch-daemon.exe"
    timeout /t 1 /nobreak >nul
)

REM 2. Launch Native Floating Desktop Notch Window
echo [2/2] Launching Native Floating Notch Window...
cd /d "%~dp0frontend"
call npx electron electron-main.cjs
