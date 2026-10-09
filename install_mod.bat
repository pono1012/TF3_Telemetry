@echo off
title Transport Fever 3 Telemetry - Mod Installer
cd /d "%~dp0"
echo ============================================================
echo   TF3 TELEMETRY ^& COCKPIT - MOD INSTALLER
echo ============================================================
echo.
echo Installing in-game companion mod...
python create_telemetry_mod.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTE] If Python is not installed, simply copy the folder:
    echo   companion-mod\tf3_telemetry
    echo directly into your Transport Fever 3 "mods" folder.
    echo.
    echo [HINWEIS] Falls Python nicht installiert ist, kopiere einfach den Ordner:
    echo   companion-mod\tf3_telemetry
    echo direkt in dein Transport Fever 3 "mods" Verzeichnis.
)
echo.
pause
