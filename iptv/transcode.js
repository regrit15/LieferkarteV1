// Kompatibilitaetsmodus fuer Filme/Serien: ffmpeg wandelt Dateien unterwegs in ein
// browserfreundliches Format (MP4 mit H.264/HEVC-Bild und AAC-Ton) um.
// ffmpeg wird gesucht: Umgebungsvariable FFMPEG_PATH, Paket ffmpeg-static (npm), Systempfad.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

let found = null;

function findFfmpeg() {
  if (process.env.SPORTTV_NO_FFMPEG) return null; // nur fuer Tests
  if (found) return found;
  const cands = [];
  if (process.env.FFMPEG_PATH) cands.push(['Umgebungsvariable', process.env.FFMPEG_PATH]);
  try {
    const p = require(path.join(__dirname, 'node_modules', 'ffmpeg-static'));
    if (p) cands.push(['mitinstalliert', p]);
  } catch { /* nicht installiert */ }
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  for (const dir of ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', ...(process.env.PATH || '').split(path.delimiter)]) {
    if (dir) cands.push(['System', path.join(dir, exe)]);
  }
  for (const [source, p] of cands) {
    try {
      if (!fs.existsSync(p)) continue;
      const r = spawnSync(p, ['-version'], { timeout: 5000 });
      if (r.status === 0) {
        found = { path: p, source, version: String(r.stdout).split('\n')[0].slice(0, 80) };
        return found;
      }
    } catch { /* weiter suchen */ }
  }
  return null;
}

function status() {
  const f = findFfmpeg();
  return f ? { available: true, source: f.source, version: f.version } : { available: false };
}

// Dauer und Formate einer Datei ermitteln (ffmpeg -i gibt die Infos auf stderr aus)
function probe(url, userAgent) {
  const f = findFfmpeg();
  if (!f) return Promise.reject(new Error('ffmpeg nicht installiert'));
  return new Promise((resolve) => {
    const p = spawn(f.path, ['-hide_banner', '-user_agent', userAgent, '-i', url], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), 25000);
    p.stderr.on('data', (d) => { err += d; if (err.length > 200000) p.kill('SIGKILL'); });
    p.on('close', () => {
      clearTimeout(timer);
      const dm = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      const duration = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0;
      const vm = err.match(/Stream #\d+:\d+(?:\[[^\]]*\])?(?:\([^)]*\))?: Video: (\w+)/);
      const audio = [...err.matchAll(/Stream #\d+:(\d+)(?:\[[^\]]*\])?(?:\(([^)]*)\))?: Audio: (\w+)/g)].map((m) => ({ index: Number(m[1]), lang: m[2] || '', codec: m[3] }));
      const container = (err.match(/Input #0, ([^,]+),/) || [])[1] || '';
      const httpErr = (err.match(/Server returned ([^\n]+)/) || [])[1] || '';
      resolve({ duration, video: vm ? vm[1] : '', audio, container, error: !dm && !vm ? (httpErr || 'Datei konnte nicht gelesen werden') : '' });
    });
  });
}

// Umgewandelten Datenstrom an die Antwort weiterreichen
function stream(req, res, { url, start, videoMode, audioIndex, userAgent }) {
  const f = findFfmpeg();
  if (!f) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ffmpeg nicht installiert');
  }
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
  if (start > 0) args.push('-ss', String(start));
  args.push('-user_agent', userAgent, '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-i', url);
  args.push('-map', '0:v:0?', '-map', audioIndex >= 0 ? `0:${audioIndex}` : '0:a:0?', '-sn', '-dn');
  if (videoMode === 'copy') args.push('-c:v', 'copy');
  else if (videoMode === 'hevc') args.push('-c:v', 'copy', '-tag:v', 'hvc1');
  else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-maxrate', '8M', '-bufsize', '16M');
  args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');
  args.push('-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', 'pipe:1');

  const p = spawn(f.path, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let errText = '';
  p.stderr.on('data', (d) => { if (errText.length < 4000) errText += d; });
  let started = false;
  p.stdout.once('data', () => {
    started = true;
  });
  res.writeHead(200, { 'Content-Type': 'video/mp4', 'Cache-Control': 'no-cache' });
  p.stdout.pipe(res);
  const stop = () => { try { p.kill('SIGKILL'); } catch { /* schon beendet */ } };
  req.on('close', stop);
  res.on('close', stop);
  p.on('close', (code) => {
    if (code && !started) console.log('ffmpeg-Fehler:', errText.trim().split('\n').slice(-3).join(' | '));
    res.end();
  });
}

/* ---------- Umwandlung als HLS (funktioniert in Safari und Chrome) ---------- */

// Safari spielt einen durchgehenden MP4-Strom ohne Laengenangabe nicht ab. Deshalb schreibt
// ffmpeg HLS-Stuecke (fMP4) in einen temporaeren Ordner, der Browser spielt die Liste ab.
const HLS_ROOT = path.join(os.tmpdir(), 'sporttv-hls');
const sessions = new Map(); // id -> { proc, dir, last, err }

function removeSession(id) {
  const s = sessions.get(id);
  if (!s) return;
  sessions.delete(id);
  try { s.proc.kill('SIGKILL'); } catch { /* schon beendet */ }
  setTimeout(() => fs.rm(s.dir, { recursive: true, force: true }, () => {}), 1500);
}

// verwaiste Umwandlungen aufraeumen (Fenster geschlossen, Film gewechselt)
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.last > 90000) removeSession(id);
}, 30000).unref();

function startHls({ url, start, videoMode, audioIndex, userAgent }) {
  const f = findFfmpeg();
  if (!f) return Promise.reject(new Error('ffmpeg nicht installiert'));
  // Zugang erlaubt oft nur eine Verbindung: alte Umwandlungen zuerst beenden
  for (const id of [...sessions.keys()]) removeSession(id);
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(HLS_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
  if (start > 0) args.push('-ss', String(start));
  args.push('-user_agent', userAgent, '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-i', url);
  args.push('-map', '0:v:0?', '-map', audioIndex >= 0 ? `0:${audioIndex}` : '0:a:0?', '-sn', '-dn');
  if (videoMode === 'copy') args.push('-c:v', 'copy');
  else if (videoMode === 'hevc') args.push('-c:v', 'copy', '-tag:v', 'hvc1');
  else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-maxrate', '8M', '-bufsize', '16M', '-g', '96');
  args.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');
  args.push('-f', 'hls', '-hls_time', '4', '-hls_list_size', '0', '-hls_playlist_type', 'event',
    '-hls_segment_type', 'fmp4', '-hls_fmp4_init_filename', 'init.mp4', '-hls_flags', 'independent_segments+temp_file',
    '-hls_segment_filename', path.join(dir, 'seg%05d.m4s'), path.join(dir, 'index.m3u8'));
  const proc = spawn(f.path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const sess = { proc, dir, last: Date.now(), err: '', done: false };
  sessions.set(id, sess);
  proc.stderr.on('data', (d) => { if (sess.err.length < 4000) sess.err += d; });
  proc.on('close', (code) => { sess.done = true; sess.code = code; });

  // warten, bis die ersten Stuecke fertig sind
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setInterval(() => {
      let list = '';
      try { list = fs.readFileSync(path.join(dir, 'index.m3u8'), 'utf8'); } catch { /* noch nicht da */ }
      const segs = (list.match(/#EXTINF/g) || []).length;
      if (segs >= 2 || (segs >= 1 && sess.done)) { clearInterval(timer); resolve({ id }); return; }
      if (sess.done && !segs) {
        clearInterval(timer);
        removeSession(id);
        reject(new Error('Umwandlung fehlgeschlagen: ' + (sess.err.trim().split('\n').slice(-2).join(' | ') || 'unbekannter Fehler')));
        return;
      }
      if (Date.now() - t0 > 30000) { clearInterval(timer); removeSession(id); reject(new Error('Umwandlung startet nicht (Zeitüberschreitung)')); }
    }, 250);
  });
}

// Dateien einer Umwandlung ausliefern; Kennwort an alle Stueck-Adressen haengen
function serveHls(res, id, file, token) {
  const sess = sessions.get(id);
  if (!sess || !/^[\w.-]+$/.test(file)) { res.writeHead(404); return res.end(); }
  sess.last = Date.now();
  const fp = path.join(sess.dir, file);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    if (file.endsWith('.m3u8')) {
      const text = String(data).split('\n').map((l) => {
        if (l.startsWith('#EXT-X-MAP:')) return l.replace(/URI="([^"]+)"/, (m, u) => `URI="${u}?t=${token}"`);
        return l && !l.startsWith('#') ? `${l.trim()}?t=${token}` : l;
      }).join('\n');
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-cache' });
      return res.end(text);
    }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

module.exports = { status, probe, stream, findFfmpeg, startHls, serveHls, removeSession };
