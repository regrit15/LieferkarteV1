// Lokaler Server fuer die IPTV-Web-App.
// - liefert die Oberflaeche aus (Ordner "public")
// - leitet Anfragen an den Xtream-Codes-Server weiter (umgeht CORS/Mixed-Content)
// - gleicht Fortschritt/Favoriten ueber einen Cloud-Ordner (z. B. Google Drive) zwischen Rechnern ab
// Laeuft nur auf diesem Rechner (127.0.0.1). Keine externen Abhaengigkeiten, Node.js >= 18.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');
const epg = require('./epg');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const USER_AGENT = process.env.IPTV_USER_AGENT || 'VLC/3.0.20 LibVLC/3.0.20';
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

/* ---------- Abgleich ueber Cloud-Ordner ---------- */

// Einstellungen liegen im Benutzerordner, damit sie ein App-Update ueberstehen
const CONFIG_DIR = path.join(os.homedir(), '.sporttv');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { /* noch keine */ }
  if (!cfg.device) {
    cfg.device = (os.hostname() || 'rechner').replace(/[^A-Za-z0-9-]/g, '').slice(0, 20) + '-' + crypto.randomBytes(3).toString('hex');
    saveConfig(cfg);
  }
  return cfg;
}

function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

// Google Drive fuer den Desktop suchen (macOS und Windows)
function driveCandidates() {
  const out = new Set();
  const home = os.homedir();
  const names = ['Meine Ablage', 'My Drive'];
  if (process.platform === 'darwin') {
    const cs = path.join(home, 'Library', 'CloudStorage');
    try {
      for (const d of fs.readdirSync(cs)) {
        if (!d.startsWith('GoogleDrive')) continue;
        for (const n of names) if (isDir(path.join(cs, d, n))) out.add(path.join(cs, d, n));
      }
    } catch { /* nicht vorhanden */ }
  }
  if (process.platform === 'win32') {
    for (let c = 68; c <= 90; c++) {
      const root = String.fromCharCode(c) + ':\\';
      for (const n of names) if (isDir(root + n)) out.add(root + n);
    }
  }
  for (const d of ['Google Drive', 'GoogleDrive']) {
    const p = path.join(home, d);
    if (!isDir(p)) continue;
    let sub = false;
    for (const n of names) if (isDir(path.join(p, n))) { out.add(path.join(p, n)); sub = true; }
    if (!sub) out.add(p);
  }
  return [...out];
}

function accountDir(cfg, account) {
  const h = crypto.createHash('sha1').update(String(account)).digest('hex').slice(0, 16);
  return path.join(cfg.dir, 'SportTV', h);
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('Daten zu gross')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('Ungueltige Daten')); }
    });
    req.on('error', reject);
  });
}

// Schutz: nur Aufrufe der eigenen Oberflaeche (fremde Webseiten koennen diesen Header nicht setzen)
function allowed(req, res) {
  const origin = req.headers.origin;
  if (req.headers['x-sporttv'] !== '1' || (origin && origin !== 'http://' + req.headers.host)) {
    sendJson(res, 403, { error: 'Nicht erlaubt' });
    return false;
  }
  return true;
}

async function handleEpg(req, res, u) {
  if (!allowed(req, res)) return;
  const route = u.pathname.slice('/epg/'.length);
  const account = u.searchParams.get('account') || '';
  if (route === 'load' && req.method === 'POST') {
    const body = await readBody(req, 20 * 1024 * 1024);
    if (!body.account || !body.server || !body.username) return sendJson(res, 400, { error: 'Zugangsdaten fehlen' });
    return sendJson(res, 200, epg.ensure(CONFIG_DIR, body, USER_AGENT));
  }
  if (!account) return sendJson(res, 400, { error: 'Konto fehlt' });
  if (route === 'status') return sendJson(res, 200, epg.statusOf(epg.storeFor(CONFIG_DIR, account)));
  if (route === 'search') return sendJson(res, 200, epg.search(CONFIG_DIR, account, u.searchParams.get('q') || ''));
  if (route === 'channel') return sendJson(res, 200, { list: epg.channel(CONFIG_DIR, account, u.searchParams.get('ch') || '') });
  return sendJson(res, 404, { error: 'Unbekannt' });
}

async function handleSync(req, res, u) {
  if (!allowed(req, res)) return;

  const cfg = loadConfig();
  const route = u.pathname.slice('/sync/'.length);

  if (route === 'status' && req.method === 'GET') {
    return sendJson(res, 200, { configured: !!cfg.dir && isDir(cfg.dir), dir: cfg.dir || '', device: cfg.device, candidates: driveCandidates() });
  }

  if (route === 'config' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.dir) {
      delete cfg.dir;
      saveConfig(cfg);
      return sendJson(res, 200, { configured: false });
    }
    const dir = path.resolve(String(body.dir).trim().replace(/^~(?=$|[\\/])/, os.homedir()));
    if (!isDir(dir)) return sendJson(res, 400, { error: 'Ordner nicht gefunden: ' + dir });
    try {
      fs.mkdirSync(path.join(dir, 'SportTV'), { recursive: true });
      const probe = path.join(dir, 'SportTV', '.schreibtest');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
    } catch (err) {
      return sendJson(res, 400, { error: 'Ordner nicht beschreibbar: ' + err.message });
    }
    cfg.dir = dir;
    saveConfig(cfg);
    return sendJson(res, 200, { configured: true, dir, device: cfg.device });
  }

  if (route === 'data') {
    if (!cfg.dir || !isDir(cfg.dir)) return sendJson(res, 409, { error: 'Abgleich nicht eingerichtet' });
    const account = u.searchParams.get('account') || '';
    if (!account) return sendJson(res, 400, { error: 'Konto fehlt' });
    const dir = accountDir(cfg, account);

    if (req.method === 'GET') {
      const files = [];
      let names = [];
      try { names = fs.readdirSync(dir); } catch { /* noch leer */ }
      for (const n of names) {
        if (!n.endsWith('.json') || n.startsWith('.')) continue;
        try {
          files.push({ device: n.slice(0, -5), data: JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')) });
        } catch { /* Datei wird evtl. gerade synchronisiert */ }
      }
      return sendJson(res, 200, { device: cfg.device, files });
    }

    if (req.method === 'PUT') {
      const body = await readBody(req);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, cfg.device + '.json');
      const tmp = path.join(dir, '.' + cfg.device + '.tmp');
      fs.writeFileSync(tmp, JSON.stringify(body));
      fs.renameSync(tmp, file);
      return sendJson(res, 200, { ok: true, device: cfg.device });
    }
  }
  return sendJson(res, 404, { error: 'Unbekannt' });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function validTarget(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

function proxied(url) {
  return '/proxy?url=' + encodeURIComponent(url);
}

// HLS-Playlists umschreiben, damit Segmente ebenfalls ueber den Proxy laufen.
function rewriteM3u8(text, baseUrl) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxied(new URL(uri, baseUrl).href)}"`);
      }
      return proxied(new URL(t, baseUrl).href);
    })
    .join('\n');
}

async function handleProxy(req, res, query) {
  const target = validTarget(query.get('url') || '');
  if (!target) return sendJson(res, 400, { error: 'Ungueltige URL' });

  const headers = { 'User-Agent': USER_AGENT, Accept: '*/*' };
  if (req.headers.range) headers.Range = req.headers.range;

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  let upstream;
  try {
    upstream = await fetch(target.href, { headers, redirect: 'follow', signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) return;
    return sendJson(res, 502, { error: 'Server nicht erreichbar: ' + err.message });
  }

  const ctype = upstream.headers.get('content-type') || '';
  const finalUrl = upstream.url || target.href;
  const isM3u8 = /mpegurl/i.test(ctype) || /\.m3u8?(\?|$)/i.test(new URL(finalUrl).pathname);

  if (isM3u8 && upstream.ok) {
    const body = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache',
    });
    return res.end(rewriteM3u8(body, finalUrl));
  }

  const out = { 'Cache-Control': 'no-cache' };
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h);
    if (v) out[h] = v;
  }
  res.writeHead(upstream.status, out);
  if (!upstream.body) return res.end();
  const stream = Readable.fromWeb(upstream.body);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/epg/')) {
    handleEpg(req, res, u).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
    });
    return;
  }
  if (u.pathname.startsWith('/sync/')) {
    handleSync(req, res, u).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
    });
    return;
  }
  if (u.pathname === '/proxy') {
    handleProxy(req, res, u.searchParams).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: err.message });
      else res.destroy();
    });
    return;
  }
  serveStatic(req, res, u.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`IPTV-App laeuft: http://localhost:${PORT}`);
  console.log('Fenster offen lassen. Beenden mit Strg+C.');
});
