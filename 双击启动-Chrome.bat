@echo off
title Hermedio
set PORT=3010

cd /d "%~dp0"

echo ====================================================
echo   Hermedio  -  Port: %PORT%
echo ====================================================

:: Kill old server
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING" 2^>nul') do (
  taskkill /f /pid %%a >nul 2>&1
)

:: Start main server on port 3010
echo Starting server...
start "" /d "%~dp0" /min cmd /c "set PORT=3010 && npm run dev"

:: Wait for server
echo Waiting for server...
timeout /t 5 /nobreak >nul

:: Open Chrome
echo Opening Chrome...
start chrome --app=http://localhost:%PORT%
exit
