#!/bin/bash
# IPTV-App starten (macOS): Doppelklick auf diese Datei
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js ist nicht installiert. Bitte von https://nodejs.org (LTS) installieren."
  read -r -p "Enter zum Schliessen"
  exit 1
fi
(sleep 1; open "http://localhost:8080") &
node server.js
