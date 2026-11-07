// IMDb-Bewertungen ueber OMDb (omdbapi.com). Benoetigt einen kostenlosen API-Schluessel.
// Ergebnisse werden im Benutzerordner zwischengespeichert, damit das Tageslimit reicht.

'use strict';

const fs = require('fs');
const path = require('path');

const OMDB_URL = process.env.OMDB_URL || 'https://www.omdbapi.com/';
const HIT_AGE = 30 * 86400 * 1000;   // gefundene Bewertungen 30 Tage behalten
const MISS_AGE = 7 * 86400 * 1000;   // "nicht gefunden" 7 Tage merken

let cache = null;
let cacheFile = '';
let saveTimer = null;
let blockedUntil = 0;                // nach "Request limit reached" bis Mitternacht pausieren
let lastError = '';
const inflight = new Map();
let active = 0;
const queue = [];

function load(cfgDir) {
  if (cache) return;
  cacheFile = path.join(cfgDir, 'imdb-cache.json');
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { cache = {}; }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFile(cacheFile, JSON.stringify(cache), () => {});
  }, 2000);
}

// Titel bereinigen: Laenderkennung, Jahr, Qualitaets- und Sprachzusaetze entfernen
function cleanTitle(raw) {
  let t = String(raw || '');
  t = t.replace(/^[^A-Za-z0-9À-ɏ]*[A-Za-z]{2,4}(?:-[A-Za-z]{2})?\s*(?:[|:\]\)\-–»•]|\s\|)\s*/, '');
  t = t.replace(/\[[^\]]*\]/g, ' ').replace(/\((?:19|20)\d{2}\)/g, ' ');
  t = t.replace(/\b(4k|uhd|fhd|hd|sd|hevc|multi|omu|omdu|ov|dubbed|german|deutsch|subbed|extended|uncut|director'?s cut)\b/gi, ' ');
  t = t.replace(/\s[-–]\s*(?:19|20)\d{2}\s*$/, ' ').replace(/\s+(?:19|20)\d{2}\s*$/, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

function keyOf(it) {
  if (it.imdbId) return 'id:' + it.imdbId;
  return (it.type === 'series' ? 's|' : 'm|') + cleanTitle(it.title).toLowerCase() + '|' + (it.year || '');
}

function cached(it) {
  const c = cache[keyOf(it)];
  if (!c) return undefined;
  const age = Date.now() - c.at;
  if (c.miss ? age > MISS_AGE : age > HIT_AGE) return undefined;
  return c.miss ? null : c;
}

async function omdb(key, params) {
  const q = new URLSearchParams({ apikey: key, ...params });
  const res = await fetch(OMDB_URL + '?' + q, { headers: { Accept: 'application/json' } });
  const j = await res.json().catch(() => ({}));
  if (j.Response === 'False' && /limit/i.test(j.Error || '')) {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    blockedUntil = d.getTime();
    throw new Error('Tageslimit von OMDb erreicht');
  }
  if (j.Response === 'False' && /invalid api key|no api key/i.test(j.Error || '')) throw new Error('OMDb-Schlüssel ungültig');
  return j;
}

async function fetchOne(key, it) {
  const type = it.type === 'series' ? 'series' : 'movie';
  let j;
  if (it.imdbId) j = await omdb(key, { i: it.imdbId });
  else {
    const t = cleanTitle(it.title);
    if (!t) return null;
    j = await omdb(key, { t, type, ...(it.year ? { y: it.year } : {}) });
    // mit Jahr nichts gefunden -> ohne Jahr nochmal (Jahresangaben der Anbieter weichen oft ab)
    if (j.Response === 'False' && it.year) j = await omdb(key, { t, type });
  }
  if (j.Response !== 'True' || !j.imdbRating || j.imdbRating === 'N/A') return null;
  return { r: j.imdbRating, v: j.imdbVotes && j.imdbVotes !== 'N/A' ? j.imdbVotes : '', id: j.imdbID, title: j.Title, year: j.Year };
}

function pump(key) {
  while (active < 4 && queue.length) {
    const job = queue.shift();
    active++;
    fetchOne(key, job.it)
      .then((r) => {
        cache[job.k] = r ? { ...r, at: Date.now() } : { miss: true, at: Date.now() };
        persist();
        lastError = '';
        job.done(r);
      })
      .catch((err) => { lastError = err.message; job.done(undefined); })
      .finally(() => { active--; inflight.delete(job.k); pump(key); });
  }
}

function lookup(key, it) {
  const k = keyOf(it);
  if (inflight.has(k)) return inflight.get(k);
  const p = new Promise((done) => queue.push({ k, it, done }));
  inflight.set(k, p);
  pump(key);
  return p;
}

// items: [{ id, title, year, type, imdbId }] -> { id: {r, v, id} | null }
async function ratings(cfgDir, key, items) {
  load(cfgDir);
  const out = {};
  const todo = [];
  for (const it of (items || []).slice(0, 60)) {
    const c = cached(it);
    if (c !== undefined) out[it.id] = c;
    else todo.push(it);
  }
  if (key && todo.length && Date.now() > blockedUntil) {
    const res = await Promise.all(todo.map((it) => lookup(key, it)));
    todo.forEach((it, i) => { if (res[i] !== undefined) out[it.id] = res[i]; });
  }
  return { ratings: out, error: Date.now() < blockedUntil ? 'Tageslimit von OMDb erreicht, ab Mitternacht geht es weiter' : lastError };
}

async function testKey(key) {
  try {
    const j = await omdb(key, { i: 'tt0111161' });
    return j.Response === 'True' ? '' : (j.Error || 'Unbekannte Antwort');
  } catch (err) {
    return err.message;
  }
}

module.exports = { ratings, testKey, cleanTitle };
