// Vollstaendiger Programmfuehrer (XMLTV vom Xtream-Server) fuer Programmsuche und Erinnerungen.
// Laedt xmltv.php im Hintergrund, behaelt nur die gewuenschten Sender und die naechsten Tage,
// speichert einen Zwischenstand im Benutzerordner (~/.sporttv).

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEEP_BEFORE = 3 * 3600;          // Sendungen bis 3 h zurueck behalten
const KEEP_DAYS = 4;                   // und bis 4 Tage voraus
const MAX_AGE = 6 * 3600 * 1000;       // nach 6 h neu laden
const MAX_BYTES = 800 * 1024 * 1024;   // Schutz vor endlosen Downloads
const DESC_LEN = 220;

const stores = new Map(); // Kontokennung -> Zustand

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ؀-ۿ]+/g, ' ')
    .trim();
}

function decodeXml(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

// "20261107183000 +0100" -> Unix-Sekunden
function parseTime(s) {
  const m = String(s || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return 0;
  let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 1000;
  if (m[7]) {
    const sign = m[7][0] === '-' ? -1 : 1;
    t -= sign * (Number(m[7].slice(1, 3)) * 3600 + Number(m[7].slice(3, 5)) * 60);
  }
  return t;
}

const attr = (head, name) => {
  const m = head.match(new RegExp(name + '\\s*=\\s*"([^"]*)"'));
  return m ? decodeXml(m[1]) : '';
};
const tag = (body, name) => {
  const m = body.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'));
  return m ? decodeXml(m[1]) : '';
};

function index(p) {
  p.nt = norm(p.t);
  p.nd = norm(p.d);
  return p;
}

function storeFor(cfgDir, account) {
  const key = crypto.createHash('sha1').update(String(account)).digest('hex').slice(0, 16);
  let st = stores.get(key);
  if (!st) {
    st = { key, file: path.join(cfgDir, 'epg-' + key + '.json'), status: 'leer', error: '', loadedAt: 0, progs: [], channels: new Set(), bytes: 0 };
    try {
      const disk = JSON.parse(fs.readFileSync(st.file, 'utf8'));
      st.progs = (disk.progs || []).map(index);
      st.channels = new Set(disk.channels || []);
      st.loadedAt = disk.loadedAt || 0;
      st.status = 'bereit';
    } catch { /* noch kein Zwischenstand */ }
    stores.set(key, st);
  }
  return st;
}

async function download(st, creds, channels, userAgent) {
  st.status = 'laedt';
  st.error = '';
  st.bytes = 0;
  const q = new URLSearchParams({ username: creds.username, password: creds.password });
  const url = String(creds.server).replace(/\/+$/, '') + '/xmltv.php?' + q;
  const now = Date.now() / 1000;
  const from = now - KEEP_BEFORE;
  const to = now + KEEP_DAYS * 86400;
  const progs = [];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: '*/*' }, redirect: 'follow' });
    if (!res.ok) throw new Error('Anbieter antwortet mit Status ' + res.status);
    const reader = res.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';
    let sawXml = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      st.bytes += value.length;
      if (st.bytes > MAX_BYTES) { reader.cancel(); throw new Error('Programmdaten zu gross'); }
      buf += dec.decode(value, { stream: true });
      if (!sawXml && /<tv[\s>]/.test(buf)) sawXml = true;
      let pos = 0;
      for (;;) {
        const a = buf.indexOf('<programme', pos);
        if (a < 0) { pos = Math.max(pos, buf.length - 20); break; }
        const b = buf.indexOf('</programme>', a);
        if (b < 0) { pos = a; break; }
        const block = buf.slice(a, b);
        pos = b + 12;
        const headEnd = block.indexOf('>');
        const head = block.slice(0, headEnd);
        const ch = attr(head, 'channel');
        if (!ch || !channels.has(ch)) continue;
        const s = parseTime(attr(head, 'start'));
        const e = parseTime(attr(head, 'stop')) || s + 3600;
        if (e < from || s > to) continue;
        const body = block.slice(headEnd + 1);
        let d = tag(body, 'desc');
        if (d.length > DESC_LEN) d = d.slice(0, DESC_LEN - 1) + '…';
        progs.push(index({ c: ch, s, e, t: tag(body, 'title'), st: tag(body, 'sub-title'), d }));
      }
      buf = buf.slice(pos);
    }
    if (!sawXml) throw new Error('Anbieter liefert keinen Programmführer (xmltv.php)');
    progs.sort((x, y) => x.s - y.s);
    st.progs = progs;
    st.channels = channels;
    st.loadedAt = Date.now();
    st.status = 'bereit';
    const slim = progs.map(({ nt, nd, ...p }) => p);
    fs.mkdirSync(path.dirname(st.file), { recursive: true });
    fs.writeFile(st.file, JSON.stringify({ loadedAt: st.loadedAt, channels: [...channels], progs: slim }), () => {});
  } catch (err) {
    st.status = st.progs.length ? 'bereit' : 'fehler';
    st.error = err.message;
  }
}

function statusOf(st) {
  return {
    status: st.status, error: st.error, loadedAt: st.loadedAt, count: st.progs.length,
    channels: st.channels.size, megabytes: Math.round(st.bytes / 1e5) / 10,
  };
}

// Hintergrund-Laden anstossen, falls noetig
function ensure(cfgDir, body, userAgent) {
  const st = storeFor(cfgDir, body.account);
  const wanted = new Set((body.channels || []).map(String).filter(Boolean));
  const missing = [...wanted].some((c) => !st.channels.has(c));
  const old = Date.now() - st.loadedAt > MAX_AGE;
  if (st.status !== 'laedt' && (body.force || missing || old || !st.progs.length)) {
    const all = new Set([...st.channels, ...wanted]);
    download(st, body, all, userAgent);
  }
  return statusOf(st);
}

function search(cfgDir, account, q, limit = 300) {
  const st = storeFor(cfgDir, account);
  const tokens = norm(q).split(' ').filter(Boolean);
  const now = Date.now() / 1000;
  if (!tokens.length) return { ...statusOf(st), results: [] };
  const phrase = tokens.join(' ');
  const hits = [];
  for (const p of st.progs) {
    if (p.e <= now) continue;
    let inTitle = true;
    let ok = true;
    for (const t of tokens) {
      if (!p.nt.includes(t)) {
        inTitle = false;
        if (!p.nd.includes(t)) { ok = false; break; }
      }
    }
    if (!ok) continue;
    const rank = p.nt.includes(phrase) ? 0 : inTitle ? 1 : 2;
    hits.push([rank, p]);
  }
  // Titeltreffer vor Beschreibungstreffern, jeweils nach Zeit
  hits.sort((a, b) => (a[0] === 2) - (b[0] === 2) || a[1].s - b[1].s);
  const results = hits.slice(0, limit).map(([r, p]) => ({ c: p.c, s: p.s, e: p.e, t: p.t, st: p.st, d: p.d, inDesc: r === 2 }));
  return { ...statusOf(st), results, total: hits.length };
}

// Programm eines Senders (fuer Erinnerungen aus der Vorschau, falls Kurz-EPG fehlt)
function channel(cfgDir, account, ch, limit = 30) {
  const st = storeFor(cfgDir, account);
  const now = Date.now() / 1000;
  return st.progs.filter((p) => p.c === ch && p.e > now).slice(0, limit).map(({ nt, nd, ...p }) => p);
}

// Programm mehrerer Sender in einem Zeitfenster (fuer das Programmraster)
function grid(cfgDir, account, channels, from, to) {
  const st = storeFor(cfgDir, account);
  const want = new Set((channels || []).map(String));
  const out = {};
  for (const p of st.progs) {
    if (p.s >= to) break; // nach Startzeit sortiert
    if (p.e <= from || !want.has(p.c)) continue;
    (out[p.c] || (out[p.c] = [])).push({ s: p.s, e: p.e, t: p.t, st: p.st, d: p.d });
  }
  return { ...statusOf(st), progs: out };
}

module.exports = { ensure, search, channel, grid, storeFor, statusOf, parseTime, decodeXml };
