#!/bin/bash
# ffmpeg fuer den Kompatibilitaetsmodus installieren (macOS): Doppelklick auf diese Datei
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js ist nicht installiert. Bitte zuerst von https://nodejs.org (LTS) installieren."
  read -r -p "Enter zum Schliessen"
  exit 1
fi
echo "Lade ffmpeg herunter (einmalig, ca. 30-80 MB) ..."
if npm install --no-save --no-audit --no-fund ffmpeg-static@5.2.0; then
  echo ""
  echo "Fertig. Bitte die App neu starten (Terminal-Fenster der App schliessen und neu starten)."
else
  echo ""
  echo "Installation fehlgeschlagen. Alternative: Homebrew installieren und 'brew install ffmpeg' ausfuehren."
fi
read -r -p "Enter zum Schliessen"
