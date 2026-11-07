# Sport TV – Notizen für die Weiterentwicklung

Übergabe an eine neue Claude-Code-Sitzung. Stand: Branch `claude/ip-tv-app-1f70dj` im Repository
`regrit15/LieferkarteV1` (Ordner `iptv/`). Die Nutzer-Anleitung steht in `README.md`.

## Wer nutzt die App, worauf kommt es an

- Ein Nutzer, Mac (Safari) und gelegentlich Windows-PC, Abgleich über Google Drive.
- Xtream-Codes-Anbieter mit sehr großem Angebot: ca. 2.900 Sender, 25.000 Filme, 1.500 Serien
  (nach Länderfilter), echte Namen voller Kennungen wie „WOW: SKY SPORT BUNDESLIGA 1 ᴴᴰ ◉“,
  „4K-DE-DV - Titel (2026) (US)“, arabische Kategorien.
- Schwerpunkt Live TV: **Fußball und Formel 1**. Filme/Serien: **aktuelle Titel**, Bewertung
  **nur IMDb** (Anbieterwerte sind unzuverlässig und werden ausgeblendet).
- Wünsche zur Kommunikation: immer Deutsch, kurz und direkt, keine Emojis, keine Floskeln.
  Unsicheres klar als unsicher kennzeichnen, nichts erfinden. Bei Unklarheit nachfragen.
- Nach Änderungen: testen, Bildschirmfotos zur Abnahme zeigen, committen, pushen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `server.js` | Lokaler Server (Node ≥ 18, keine Pakete): liefert `public/` aus, `/proxy` (Xtream-API und Streams, schreibt HLS-Listen um), `/sync/*` (Google-Drive-Abgleich), `/epg/*`, `/meta/*`, `/transcode/*`. Läuft nur auf 127.0.0.1. |
| `epg.js` | Lädt `xmltv.php` im Hintergrund (nur sichtbare Sender, 4 Tage), Zwischenstand `~/.sporttv/epg-*.json`; Suche, Raster, „läuft jetzt“. |
| `meta.js` | IMDb über OMDb (Schlüssel in `~/.sporttv/config.json`), Zwischenspeicher `~/.sporttv/imdb-cache.json`, Tagesbudget für Hintergrund-Abfragen (800). |
| `transcode.js` | Kompatibilitätsmodus: ffmpeg (aus `node_modules/ffmpeg-static`, `FFMPEG_PATH` oder System) wandelt MKV/AC3/MPEG-4 in fragmentiertes MP4. |
| `public/index.html` | Gerüst: Symbolleiste links, Suche oben, Startbildschirm `#home`, Liste + Vorschau, Overlays (Detail, Player, Filter, Abgleich, IMDb, Wiedergabe). |
| `public/app.js` | Gesamte Oberfläche (ein Skript, Abschnitte mit `/* ===== */` markiert). |
| `public/app.css` | Grundstil oben, darunter „Design 2“ und weitere Nachträge, die frühere Regeln überschreiben. |
| `public/vendor/` | hls.js 1.5.17, mpegts.js 1.7.3, Schrift Outfit (OFL), Lizenzen. |

Wichtige Stellen in `app.js` (suchen nach):
- `detectTag`, `TAG_LABELS`, `SCRIPT_TAGS` – Länderfilter (Präfix, Schrift, Anhängsel „(US)“).
- `supText`, `liveLabel`, `catLabel`, `displayName`, `yearOf` – Namensbereinigung.
- `computeDupes` / `computeTitleDupes` – doppelte Sender bzw. Fassungen von Filmen/Serien.
- `FOOTBALL_RE`, `F1_RE`, `liveFocusItems` – Fußball/F1-Erkennung und „Jetzt live“.
- `startEngine`, `startPrebuffer`, `scheduleReconnect`, `startCompat` – Wiedergabe, Puffer,
  Neuverbinden, Kompatibilitätsmodus.
- `renderHome`, `buildHero` – Startbildschirm. `renderGrid` – Programmraster.
- `ratingOf` – nur IMDb. `startImdbBackground` – IMDb im Hintergrund nachladen.

Daten im Browser (`localStorage`, je Konto): Favoriten, Fortschritt, Filter, Erinnerungen,
Zuletzt gesehen, Wiedergabe-Einstellungen. Sicherheitsrelevant: `/proxy` und `/transcode/stream`
verlangen das Kennwort `t=` (aus `config.json`, wird in `index.html` eingesetzt); `/sync`, `/epg`,
`/meta`, `/transcode` sonst den Header `X-SportTV: 1`.

## Entscheidungen, die bewusst so sind

- Live-Standardformat **TS** mit 4 s Vorlauf-Puffer, kein Aufholen zur Live-Kante (HLS lieferte
  beim Anbieter doppelte Stücke → Szenen wiederholten sich). Format-Ausnahmen nur je Sender.
- Kompatibilitätsmodus liefert **HLS (fMP4-Stücke)** aus einem temporären Ordner (`os.tmpdir()/sporttv-hls`),
  weil Safari einen durchgehenden MP4-Strom ohne Längenangabe nicht abspielt. Immer nur eine Umwandlung
  gleichzeitig (Zugang erlaubt meist 1 Verbindung). Getestet nur in Chromium, Safari beim Nutzer prüfen.
- Anbieterbewertungen werden nicht angezeigt; „Top bewertet“ = IMDb ≥ 7,5.
- Fassungen gleicher Titel: eine Karte, bevorzugt deutsche Fassung ohne 4K (außer Qualität „Höchste“).
- Keine Kopie fremder Apps (Name/Logo); Design nur „in der Richtung“ der Vorlagen des Nutzers.

## Testen

Nachgebauter Anbieter in `tests/` (alle Daten erfunden):

```bash
cd iptv/tests
./medien-erzeugen.sh                 # einmalig, braucht ffmpeg
node mock.js &                       # Anbieter auf Port 9000 (Zugang: localhost:9000 / max / geheim)
cd .. && HOME=/tmp/sporttv-test PORT=8080 OMDB_URL=http://localhost:9000/omdb/ node server.js &
npm i --no-save playwright && npx playwright install chromium   # einmalig
node tests/test-e2e2.js              # usw., jedes Skript gibt "Seitenfehler: []" aus, wenn alles passt
```

- `HOME` auf einen eigenen Testordner setzen, sonst landen Testdaten in `~/.sporttv` des Nutzers.
- Programm-Zwischenstand vor `test-e2e6`/`test-e2e7` löschen (`rm /tmp/sporttv-test/.sporttv/epg-*`),
  sonst passen die Zeiten im Testprogramm nicht mehr.
- `test-e2e8`/`test-imdb` brauchen einen frischen `HOME` (ohne gespeicherten OMDb-Schlüssel).
- `test-e2e5` dauert ca. 1–2 Minuten (Neuverbinden mit Wartezeiten).

Live gegen den echten Anbieter: App normal starten (`./start-mac.command`) und im Browser prüfen.
Zugangsdaten des Nutzers nie in Dateien, Commits oder Logs schreiben.

## Offene Punkte (Stand der Übergabe)

1. Design Schritt 2: Programmführer mit großem „Jetzt läuft“-Bereich oben (Vorlage des Nutzers).
2. Design Schritt 3: eigener Player (große Knöpfe, ±10 s, Abzeichen Auflösung/Bild-/Tonformat, „Endet um“).
3. Design Schritt 4: Einstellungsseite als Kachelübersicht; Länderfilter, Abgleich, IMDb, Wiedergabe
   dorthin verschieben (Kopfleiste entlasten).
4. Startbildschirm: Filmbereich niedriger oder durch laufendes Fußball-/F1-Spiel ersetzen, wenn eins läuft.
5. Namensbereinigung mit echten Daten weiter prüfen (Beispiele sammeln, `tests/test-namen.js` erweitern).
6. Noch nicht mit dem echten Zugang bestätigt: Länderfilter-Ergebnis nach „Nur Deutsch“ mit den neuen
   Kennungen (AR, CYR, KR, PL …), Abgleich Mac ↔ PC, Erinnerungen.
7. Zurückgestellt: Multiview (Zugang erlaubt vermutlich nur 1 Verbindung), Steuerung per Smartphone,
   Personen-Seiten (bräuchten TMDB-Schlüssel), automatische Genres.
