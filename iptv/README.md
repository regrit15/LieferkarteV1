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
- Live TV mit Schwerpunkt Fußball & Formel 1: eigene Gruppe oben mit „Jetzt live: Fußball & F1“
  (laut Programm), „Nur Fußball“, „Nur Formel 1“; andere Sportarten unter „Weiterer Sport“
- Filme/Serien: „Aktuell“ (dieses/letztes Jahr), „Neu hinzugefügt (30 Tage)“, „Top bewertet“;
  Sortierung neueste zuerst, zuletzt hinzugefügt, Bewertung, A–Z
- IMDb-Bewertungen auf Postern und in der Detailansicht (über OMDb, kostenloser Schlüssel nötig,
  siehe unten)
- Programmsuche: die Suche findet auch Sendungen im Programm der nächsten 4 Tage (z. B. „Bayern“),
  mit Tag, Uhrzeit und Sender; laufende Sendungen mit einem Klick ansehen
- Programmraster: in Live TV oben „Programm“ wählen; Sender untereinander, Zeit waagerecht (24 Std.),
  rote Linie = jetzt; Heute/Morgen/weitere Tage; Klick auf laufende Sendung schaltet ein,
  auf kommende zeigt Details mit Erinnerung
- Erinnerungen: Glocke an kommenden Sendungen (Suche und Programm neben dem Player); Hinweis in der App
  und als Systemmitteilung, Vorlauf einstellbar, auf Wunsch automatisch umschalten; Liste unter
  Live TV → „Erinnerungen“. Funktioniert nur, solange die App im Browser geöffnet ist.
- Automatisch neu verbinden: steht das Bild über 12 Sekunden oder bricht der Stream ab, verbindet die App
  selbst neu (bis zu 5 Versuche, Filme/Folgen laufen an derselben Stelle weiter)
- „Letzter Sender“ (Knopf oder Taste Z) springt zwischen den zwei zuletzt gesehenen Sendern;
  Liste „Zuletzt gesehen“ oben in Live TV
- Doppelte Sender (SD/HD/Full HD/4K) werden zusammengefasst; bevorzugte Qualität im Länderfilter
  einstellbar, im Player per Auswahl wechselbar
- Favoriten für Sender, Filme und Serien
- Fortschritt: Filme und Folgen setzen an der gestoppten Stelle fort; ab 90 % gelten sie als gesehen
  (grüner Haken), angefangene zeigen einen Balken mit Restzeit; Folgen und Filme lassen sich auch
  von Hand als gesehen/ungesehen markieren
- Bereich „Weiter ansehen“: angefangene Filme und je Serie die angefangene bzw. nächste Folge
- Nach dem Ende einer Folge startet die nächste automatisch (10 Sekunden, abbrechbar)
- Abgleich zwischen Mac und PC über Google Drive (Fortschritt, Weiter ansehen, Favoriten, Filter)
- Tasten: Pfeil hoch/runter = Sender wechseln, Z = letzter Sender, F = Vollbild, Esc = schließen, / = Suche

## Einmalige Einrichtung

1. Node.js (LTS-Version) installieren: https://nodejs.org
2. Den Ordner `iptv` auf den Rechner kopieren (z. B. über GitHub „Code“ → „Download ZIP“).

## Starten

- **Mac:** Doppelklick auf `start-mac.command`.
  Beim ersten Mal ggf. Rechtsklick → „Öffnen“, weil macOS unbekannte Dateien blockiert.
- **Windows:** Doppelklick auf `start-windows.bat`.

Der Browser öffnet sich mit `http://localhost:8080`. Das schwarze Fenster offen lassen,
solange Sie fernsehen. Schließen beendet die App.

## Abgleich zwischen Mac und PC (Google Drive)

1. Auf beiden Rechnern „Google Drive für den Desktop“ installieren und mit demselben Google-Konto anmelden.
2. In der App oben auf „Abgleich“ klicken. Meist wird Google Drive automatisch gefunden: „Verwenden“ klicken.
   Sonst Pfad eintragen, z. B. Mac: `~/Library/CloudStorage/GoogleDrive-<E-Mail>/Meine Ablage`,
   Windows: `G:\Meine Ablage`.
3. Auf dem zweiten Rechner genauso.

Die App legt in Google Drive einen Ordner `SportTV` an. Jeder Rechner schreibt seine eigene Datei, daher
entstehen keine Konflikte. Je Film/Folge gilt der neuere Stand. Abgeglichen wird beim Start, jede Minute,
nach Änderungen und beim Schließen eines Films. Wie schnell der andere Rechner es sieht, hängt von
Google Drive ab (meist Sekunden bis wenige Minuten). Das Passwort wird nicht in Google Drive gespeichert.
Die Einstellung liegt im Benutzerordner unter `.sporttv` und bleibt bei App-Updates erhalten.

## Programmführer

Der lokale Server lädt den Programmführer des Anbieters (`xmltv.php`) im Hintergrund, nur für Sender,
die der Länderfilter zeigt, und erneuert ihn alle 6 Stunden. Ein Zwischenstand liegt in `~/.sporttv`.
Liefert der Anbieter keinen Programmführer, zeigt die Suche das an; die übrigen Funktionen laufen weiter.

## Ruckler oder sich wiederholende Szenen im Live TV

Standard ist das Format **TS** (durchgehender Datenstrom) mit großem Puffer (ca. 4 s Vorlauf).
Das ist bei vielen Xtream-Anbietern deutlich ruhiger als HLS, wo Stücke doppelt geliefert werden
können. Einstellungen im Player unter „Wiedergabe“: Standardformat, Puffer (normal / groß /
sehr groß), Info-Anzeige. Der Knopf „Format“ wechselt nur für den aktuellen Sender.
Die Info-Anzeige (Taste I) zeigt Puffer, verlorene Bilder, Leerlaufen und Neuverbindungen.

## Filme und Serien starten nicht (schwarzes Bild / Fehlermeldung)

Viele Anbieter liefern Filme als MKV oder mit Kino-Ton (AC3, E-AC3, DTS) bzw. Bildformaten, die
Browser nicht abspielen. Dafür gibt es den **Kompatibilitätsmodus**: der lokale Server wandelt die
Datei mit dem kostenlosen Programm ffmpeg unterwegs um (Ton immer in AAC, Bild nur wenn nötig).

1. Einmalig ffmpeg installieren:
   - Mac: Doppelklick auf `ffmpeg-installieren.command` (beim ersten Mal ggf. wie bei
     `start-mac.command` über Systemeinstellungen → Datenschutz & Sicherheit → „Dennoch öffnen“).
   - Windows: Doppelklick auf `ffmpeg-installieren.bat`.
   - Alternativ (Mac mit Homebrew): `brew install ffmpeg`.
2. App neu starten. Im Terminal-Fenster steht dann „ffmpeg gefunden“.

Danach schaltet die App automatisch um, wenn ein Film nicht startet, kein Bild zeigt oder als MKV
vorliegt. Im Player gibt es außerdem den Knopf „Kompatibilitätsmodus“ (von Hand umschalten,
z. B. wenn der Ton fehlt) und „In VLC öffnen“ (startet VLC auf diesem Rechner, falls installiert).
Im Kompatibilitätsmodus erscheint unter dem Bild eine eigene Zeitleiste zum Springen.
Muss das Bild umgerechnet werden, braucht das spürbar Rechenleistung.

## IMDb-Bewertungen

Angezeigt und für „Top bewertet“ bzw. die Sortierung genutzt werden nur IMDb-Bewertungen.
Die Bewertungen, die der Anbieter mitliefert (meist von TMDB übernommen, bei neuen Titeln oft
unzuverlässig), blendet die App aus. Ohne IMDb-Schlüssel gibt es daher keine Bewertungen.

1. Auf https://www.omdbapi.com/apikey.aspx die Variante „FREE“ wählen und E-Mail eintragen.
2. Bestätigungslink in der E-Mail anklicken, den Schlüssel kopieren.
3. In der App unter Filme oder Serien oben rechts „IMDb einrichten“ klicken und den Schlüssel eintragen.

Der Schlüssel bleibt auf dem Rechner (`~/.sporttv/config.json`), auf dem zweiten Rechner einmal
ebenso eintragen. Der kostenlose Schlüssel erlaubt etwa 1.000 Abfragen am Tag; die App fragt nur
sichtbare Titel ab und merkt sich Ergebnisse 30 Tage. Deutsche Titel findet OMDb nicht immer,
weil dort meist der Originaltitel geführt wird.

## Warum ein kleiner lokaler Server?

Browser dürfen Xtream-Server meist nicht direkt abfragen (CORS, unverschlüsseltes HTTP).
`server.js` leitet die Anfragen deshalb weiter. Er ist nur auf Ihrem eigenen Rechner erreichbar
(127.0.0.1) und hat keine Zusatzpakete.

## Hinweise

- Zugangsdaten werden nur im Browser auf diesem Rechner gespeichert. Favoriten, Filter und Fortschritt ebenfalls, zusätzlich in Google Drive, wenn der Abgleich eingerichtet ist.
- Bleibt ein Sender schwarz, „Format“ im Player drücken (wechselt zwischen HLS und TS).
- Manche Filme liegen als MKV vor; diese spielt nicht jeder Browser ab. Dann „Link kopieren“
  und in VLC öffnen (VLC: Medien → Netzwerkstream öffnen).
- Manche Anbieter sperren unbekannte Programme. Der Server meldet sich daher wie VLC an.
  Anderer Wert möglich über die Umgebungsvariable `IPTV_USER_AGENT`.
- Anderer Port: Umgebungsvariable `PORT` (Standard 8080).
- Bibliotheken im Ordner `public/vendor`: hls.js und mpegts.js (Apache-2.0-Lizenz).
