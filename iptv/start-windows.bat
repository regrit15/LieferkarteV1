@echo off
REM IPTV-App starten (Windows): Doppelklick auf diese Datei
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ist nicht installiert. Bitte von https://nodejs.org ^(LTS^) installieren.
  pause
  exit /b 1
)
start "" http://localhost:8080
node server.js
pause
