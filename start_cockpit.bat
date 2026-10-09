@echo off
title Transport Fever 3 Telemetry Dashboard
cd /d "%~dp0"
echo ============================================================
echo   TRANSPORT FEVER 3 — LIVE TELEMETRY ^& COCKPIT SERVER
echo ============================================================
echo.
if not exist node_modules (
    echo [INFO] First time setup: Installing Node.js dependencies...
    echo [INFO] Ersteinrichtung: Installiere Abhaengigkeiten (npm install)...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] 'npm install' fehlgeschlagen. Bitte stelle sicher, dass Node.js (https://nodejs.org/) installiert ist.
        echo [ERROR] 'npm install' failed. Please ensure Node.js (https://nodejs.org/) is installed.
        pause
        exit /b
    )
)
echo.
echo Launching Web Cockpit Dashboard on http://localhost:3000 ...
echo (Starte Web-Dashboard auf http://localhost:3000 ...)
echo.
start http://localhost:3000
node server.js
pause
