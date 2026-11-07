@echo off
REM ffmpeg fuer den Kompatibilitaetsmodus installieren (Windows): Doppelklick auf diese Datei
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js ist nicht installiert. Bitte zuerst von https://nodejs.org ^(LTS^) installieren.
  pause
  exit /b 1
)
echo Lade ffmpeg herunter (einmalig, ca. 30-80 MB) ...
call npm install --no-save --no-audit --no-fund ffmpeg-static@5.2.0
if errorlevel 1 (
  echo Installation fehlgeschlagen.
) else (
  echo Fertig. Bitte die App neu starten.
)
pause
