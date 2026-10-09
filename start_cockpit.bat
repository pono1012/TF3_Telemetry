@echo off
title Transport Fever 3 Telemetrie Dashboard
cd /d "%~dp0"
echo ============================================================
echo   TRANSPORT FEVER 3 — LIVE TELEMETRIE & COCKPIT SERVER
echo ============================================================
echo.
echo Starte Web-Dashboard auf http://localhost:3000 ...
echo.
start http://localhost:3000
node server.js
pause
