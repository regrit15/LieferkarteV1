// Lokaler Server fuer die IPTV-Web-App.
// - liefert die Oberflaeche aus (Ordner "public")
// - leitet Anfragen an den Xtream-Codes-Server weiter (umgeht CORS/Mixed-Content)
// Laeuft nur auf diesem Rechner (127.0.0.1). Keine externen Abhaengigkeiten, Node.js >= 18.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

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
