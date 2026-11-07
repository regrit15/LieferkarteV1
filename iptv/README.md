# Sport TV – IPTV-Web-App für Xtream Codes

Läuft lokal auf Ihrem Mac oder Windows-PC im Browser (Chrome, Edge, Safari, Firefox).

## Funktionen

- Anmeldung mit Xtream-Codes-Zugang (Server, Benutzername, Passwort)
- Live TV mit Vorschau rechts: Senderliste mit laufender Sendung und Fortschritt,
  Klick = abspielen in der Vorschau, Doppelklick = Vollbild
- Filme und Serien mit Postern, Hintergrundbild und Folgenbildern (sofern der Anbieter sie liefert),
  sonst farbige Titelkachel
- Volltextsuche über Sender, Filme und Serien gleichzeitig (Taste `/`), Wörter in beliebiger
  Reihenfolge, ohne Rücksicht auf Groß/Klein und Akzente; bei Serien auch Genre, Besetzung, Inhalt
- Länderfilter: erkennt Kennungen wie „FR |“, „[AR]“, „TR:“, „ARABIC“ und blendet sie aus;
  Schnellwahl „Nur Deutsch“; einzelne Kategorien per „ausblenden“ in der linken Liste
- Sport-Kategorien werden automatisch erkannt und oben angezeigt
- Favoriten für Sender, Filme und Serien
- Fortschritt: Filme und Folgen setzen an der gestoppten Stelle fort; ab 90 % gelten sie als gesehen
  (grüner Haken), angefangene zeigen einen Balken mit Restzeit; Folgen und Filme lassen sich auch
  von Hand als gesehen/ungesehen markieren
- Bereich „Weiter ansehen“: angefangene Filme und je Serie die angefangene bzw. nächste Folge
- Nach dem Ende einer Folge startet die nächste automatisch (10 Sekunden, abbrechbar)
- Tasten: Pfeil hoch/runter = Sender wechseln, F = Vollbild, Esc = schließen, / = Suche

## Einmalige Einrichtung

1. Node.js (LTS-Version) installieren: https://nodejs.org
2. Den Ordner `iptv` auf den Rechner kopieren (z. B. über GitHub „Code“ → „Download ZIP“).

## Starten

- **Mac:** Doppelklick auf `start-mac.command`.
  Beim ersten Mal ggf. Rechtsklick → „Öffnen“, weil macOS unbekannte Dateien blockiert.
- **Windows:** Doppelklick auf `start-windows.bat`.

Der Browser öffnet sich mit `http://localhost:8080`. Das schwarze Fenster offen lassen,
solange Sie fernsehen. Schließen beendet die App.

## Warum ein kleiner lokaler Server?

Browser dürfen Xtream-Server meist nicht direkt abfragen (CORS, unverschlüsseltes HTTP).
`server.js` leitet die Anfragen deshalb weiter. Er ist nur auf Ihrem eigenen Rechner erreichbar
(127.0.0.1) und hat keine Zusatzpakete.

## Hinweise

- Zugangsdaten, Favoriten, Filter und Fortschritt werden nur im Browser auf diesem Rechner gespeichert.
- Bleibt ein Sender schwarz, „Format“ im Player drücken (wechselt zwischen HLS und TS).
- Manche Filme liegen als MKV vor; diese spielt nicht jeder Browser ab. Dann „Link kopieren“
  und in VLC öffnen (VLC: Medien → Netzwerkstream öffnen).
- Manche Anbieter sperren unbekannte Programme. Der Server meldet sich daher wie VLC an.
  Anderer Wert möglich über die Umgebungsvariable `IPTV_USER_AGENT`.
- Anderer Port: Umgebungsvariable `PORT` (Standard 8080).
- Bibliotheken im Ordner `public/vendor`: hls.js und mpegts.js (Apache-2.0-Lizenz).
