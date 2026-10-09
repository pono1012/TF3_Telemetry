@echo off
title Transport Fever 3 Telemetry - Mod Installer
cd /d "%~dp0"
echo ============================================================
echo   TF3 TELEMETRY & COCKPIT - MOD INSTALLER
echo ============================================================
echo.
python create_telemetry_mod.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [HINWEIS] Falls Python nicht installiert ist, kopiere einfach den Ordner:
    echo   companion-mod\tf3_telemetry
    echo direkt in dein Transport Fever 3 "mods" Verzeichnis.
)
echo.
pause
