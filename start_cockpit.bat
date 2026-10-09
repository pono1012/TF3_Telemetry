@echo off
title Transport Fever 3 Telemetry Dashboard
cd /d "%~dp0"
echo ============================================================
echo   TRANSPORT FEVER 3 — LIVE TELEMETRY ^& COCKPIT SERVER
echo ============================================================
echo.
echo Launching Web Cockpit Dashboard on http://localhost:3000 ...
echo (Starte Web-Dashboard auf http://localhost:3000 ...)
echo.
start http://localhost:3000
node server.js
pause
