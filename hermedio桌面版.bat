@echo off
title Hermedio Desktop
cd /d "%~dp0"

echo ====================================================
echo   Hermedio Lofi Room
echo ====================================================

:: Kill previous server
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3011.*LISTENING" 2^>nul') do taskkill /f /pid %%a 2>nul

:: Install dependencies
echo.
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed. Check Node.js installation.
    pause
    exit /b 1
)
echo Done.
echo.

:: Start server
echo Starting server on port 3011...
start "Hermedio Server" cmd /k "cd /d %~dp0 && set PORT=3011 && npm run dev"

:: Wait for server
echo Waiting for server to be ready...
:wait
timeout /t 2 /nobreak >nul
curl -s http://localhost:3011 >nul 2>&1
if errorlevel 1 goto wait

:: Launch Chrome app mode
echo Launching desktop window...
start "" chrome --app=http://localhost:3011 --window-size=1376,916 --user-data-dir="%TEMP%\hermedio-desktop"

echo Hermedio Desktop launched!
pause
