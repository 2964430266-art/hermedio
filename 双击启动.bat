@echo off
title Hermedio
cd /d "%~dp0"

:: Kill previous
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3011.*LISTENING" 2^>nul') do taskkill /f /pid %%a 2>nul

:: First-time install
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

:: Start
start "Hermedio" cmd /k "cd /d %~dp0 && set PORT=3011 && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:3011

pause
