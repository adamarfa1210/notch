@echo off
echo Starting Dynamic RAM Notch (Desktop Native Mode)...

REM 1. Start Rust Backend Daemon in background
start /B "" "%~dp0src-tauri\target\debug\notch-daemon.exe"

REM 2. Start Desktop Notch Window
cd /d "%~dp0frontend"
npm run desktop
