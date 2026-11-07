'use strict';

/* ---------- Hilfsfunktionen ---------- */

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function proxied(url) {
  return '/proxy?url=' + encodeURIComponent(url);
}

function b64(s) {
  if (!s) return '';
  try {
    const bin = atob(s);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Kategorien/Namen, die als Sport gelten
const SPORT_RE = /sport|fu(ss|ß)ball|football|soccer|bundesliga|\bliga\b|league|dazn|eurosport|tennis|golf|\bf1\b|formel|motorsport|moto\s?gp|\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|\bufc\b|\bmma\b|box(en|ing)|\bwwe\b|cricket|rugby|olymp|champions|uefa|fifa|\bppv\b|espn|bein|setanta|\bdyn\b|handball|darts|racing|eishockey|hockey|basketball|radsport|cycling/i;

/* ---------- Zustand ---------- */

const state = {
  creds: null,
  info: null,
  tab: 'live',
  cat: null,
  search: '',
  data: {},          // live / vod / series: { cats, items, sportIds, counts }
  favs: { live: [], vod: [], series: [] },
  view: [],          // aktuell angezeigte Einträge
  rendered: 0,
  liveFormat: 'm3u8',
};

const PAGE = 120;

function accountKey() {
  return state.creds ? state.creds.server + '|' + state.creds.username : '';
}

/* ---------- Xtream-API ---------- */

async function api(action, params = {}) {
  const { server, username, password } = state.creds;
  const q = new URLSearchParams({ username, password, ...params });
  if (action) q.set('action', action);
  const res = await fetch(proxied(`${server}/player_api.php?${q}`));
  if (!res.ok) throw new Error('Server antwortet mit Status ' + res.status);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Unerwartete Antwort vom Server');
  }
}

function streamUrl(kind, id, ext) {
  const { server, username, password } = state.creds;
  const u = encodeURIComponent(username);
  const p = encodeURIComponent(password);
  const path = kind === 'live' ? 'live' : kind === 'vod' ? 'movie' : 'series';
  return `${server}/${path}/${u}/${p}/${id}.${ext}`;
}

const ACTIONS = {
  live: ['get_live_categories', 'get_live_streams'],
  vod: ['get_vod_categories', 'get_vod_streams'],
  series: ['get_series_categories', 'get_series'],
};

function itemId(kind, it) {
  return String(kind === 'series' ? it.series_id : it.stream_id);
}

async function loadKind(kind) {
  if (state.data[kind]) return state.data[kind];
  const [catAction, itemAction] = ACTIONS[kind];
  const [cats, items] = await Promise.all([api(catAction), api(itemAction)]);
  const catList = Array.isArray(cats) ? cats : [];
  const itemList = Array.isArray(items) ? items : [];
  const counts = {};
  for (const it of itemList) counts[it.category_id] = (counts[it.category_id] || 0) + 1;
  const sportIds = new Set(catList.filter((c) => SPORT_RE.test(c.category_name)).map((c) => String(c.category_id)));
  state.data[kind] = { cats: catList, items: itemList, counts, sportIds };
  return state.data[kind];
}

/* ---------- Favoriten ---------- */

function loadFavs() {
  const f = store('favs:' + accountKey()) || {};
  state.favs = { live: f.live || [], vod: f.vod || [], series: f.series || [] };
}

function isFav(kind, id) {
  return state.favs[kind].some((f) => f.id === id);
}

function toggleFav(kind, it) {
  const id = itemId(kind, it);
  const list = state.favs[kind];
  const idx = list.findIndex((f) => f.id === id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push({ id, item: it });
  store('favs:' + accountKey(), state.favs);
  toast(idx >= 0 ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt');
  return idx < 0;
}

function starButton(kind, it) {
  const id = itemId(kind, it);
  const btn = el('button', { class: 'star' + (isFav(kind, id) ? ' on' : ''), title: 'Favorit' }, '★');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.classList.toggle('on', toggleFav(kind, it));
    if (state.tab === 'fav') render();
  });
  return btn;
}

/* ---------- Anmeldung ---------- */

function normalizeServer(raw) {
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  return new URL(s).origin;
}

async function login(creds) {
  state.creds = creds;
  const res = await api(null);
  if (!res || !res.user_info || Number(res.user_info.auth) !== 1) {
    throw new Error('Anmeldung fehlgeschlagen. Zugangsdaten prüfen.');
  }
  state.info = res.user_info;
  const formats = res.user_info.allowed_output_formats || [];
  const saved = store('liveFormat:' + accountKey());
  state.liveFormat = saved || (formats.includes('m3u8') || formats.length === 0 ? 'm3u8' : 'ts');
  store('creds', creds);
  loadFavs();
}

function showLogin(msg) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  $('#loginError').textContent = msg || '';
  const c = store('creds');
  if (c) {
    const f = $('#loginForm');
    f.server.value = c.server;
    f.username.value = c.username;
  }
}

async function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const i = state.info;
  let txt = i.username;
  if (i.exp_date) txt += ' · gültig bis ' + new Date(Number(i.exp_date) * 1000).toLocaleDateString('de-DE');
  if (i.max_connections) txt += ' · ' + i.max_connections + ' Verbindung(en)';
  $('#accountInfo').textContent = txt;
  await switchTab(store('lastTab') || 'live');
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector('button');
  $('#loginError').textContent = '';
  btn.disabled = true;
  btn.textContent = 'Verbinde ...';
  try {
    await login({ server: normalizeServer(f.server.value), username: f.username.value.trim(), password: f.password.value });
    await showApp();
  } catch (err) {
    $('#loginError').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Anmelden';
  }
});

$('#logout').addEventListener('click', () => {
  const c = store('creds');
  if (c) store('creds', { server: c.server, username: c.username });
  state.data = {};
  showLogin();
});

/* ---------- Navigation ---------- */

async function switchTab(tab) {
  state.tab = tab;
  state.search = '';
  $('#search').value = '';
  store('lastTab', tab);
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'fav') {
    state.cat = state.cat && state.cat.startsWith('fav:') ? state.cat : 'fav:live';
    renderSidebar();
    render();
    return;
  }

  $('#sidebar').replaceChildren(el('div', { class: 'empty' }, 'Lade ...'));
  $('#list').replaceChildren();
  $('#listTitle').textContent = '';
  $('#listCount').textContent = '';
  try {
    const d = await loadKind(tab);
    if (state.tab !== tab) return;
    const saved = store('lastCat:' + tab);
    const validSaved = saved && (saved === '__all' || saved === '__sport' || d.cats.some((c) => String(c.category_id) === saved));
    state.cat = validSaved ? saved : d.sportIds.size ? '__sport' : '__all';
    if (state.cat === '__sport' && !d.sportIds.size) state.cat = '__all';
    renderSidebar();
    render();
  } catch (err) {
    $('#sidebar').replaceChildren();
    $('#list').replaceChildren(el('div', { class: 'empty' }, 'Fehler beim Laden: ' + err.message));
  }
}

document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  }, 200);
});

function selectCat(cat) {
  state.cat = cat;
  if (state.tab !== 'fav') store('lastCat:' + state.tab, cat);
  state.search = '';
  $('#search').value = '';
  document.querySelectorAll('.cat').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
  render();
  $('.content').scrollTop = 0;
}

function catButton(id, name, count, sport) {
  return el('button', {
    class: 'cat' + (sport ? ' sport' : '') + (state.cat === id ? ' active' : ''),
    'data-cat': id,
    onclick: () => selectCat(id),
  }, el('span', {}, name), count != null ? el('span', { class: 'n' }, count) : null);
}

function renderSidebar() {
  const side = $('#sidebar');
  side.replaceChildren();

  if (state.tab === 'fav') {
    side.append(
      el('div', { class: 'side-group' }, 'Favoriten'),
      catButton('fav:live', 'Sender', state.favs.live.length),
      catButton('fav:vod', 'Filme', state.favs.vod.length),
      catButton('fav:series', 'Serien', state.favs.series.length),
    );
    return;
  }

  const d = state.data[state.tab];
  const label = state.tab === 'live' ? 'Sender' : state.tab === 'vod' ? 'Filme' : 'Serien';
  const sportCats = d.cats.filter((c) => d.sportIds.has(String(c.category_id)));
  const otherCats = d.cats.filter((c) => !d.sportIds.has(String(c.category_id)));

  if (sportCats.length) {
    const sportCount = sportCats.reduce((n, c) => n + (d.counts[c.category_id] || 0), 0);
    side.append(el('div', { class: 'side-group' }, 'Sport'));
    side.append(catButton('__sport', 'Alle Sport-' + label, sportCount, true));
    for (const c of sportCats) side.append(catButton(String(c.category_id), c.category_name, d.counts[c.category_id] || 0, true));
  }
  side.append(el('div', { class: 'side-group' }, 'Kategorien'));
  side.append(catButton('__all', 'Alle ' + label, d.items.length));
  for (const c of otherCats) side.append(catButton(String(c.category_id), c.category_name, d.counts[c.category_id] || 0));
}

/* ---------- Liste ---------- */

function currentItems() {
  if (state.tab === 'fav') {
    const kind = state.cat.slice(4);
    let items = state.favs[kind].map((f) => f.item);
    if (state.search) items = items.filter((it) => (it.name || '').toLowerCase().includes(state.search));
    return { kind, items, title: { live: 'Favoriten: Sender', vod: 'Favoriten: Filme', series: 'Favoriten: Serien' }[kind] };
  }
  const d = state.data[state.tab];
  const kind = state.tab;
  if (state.search) {
    return {
      kind,
      items: d.items.filter((it) => (it.name || '').toLowerCase().includes(state.search)),
      title: 'Suche: ' + state.search,
    };
  }
  if (state.cat === '__all') return { kind, items: d.items, title: 'Alle' };
  if (state.cat === '__sport') {
    return { kind, items: d.items.filter((it) => d.sportIds.has(String(it.category_id))), title: 'Alle Sport' };
  }
  const cat = d.cats.find((c) => String(c.category_id) === state.cat);
  return { kind, items: d.items.filter((it) => String(it.category_id) === state.cat), title: cat ? cat.category_name : '' };
}

function render() {
  const { kind, items, title } = currentItems();
  state.view = items;
  state.viewKind = kind;
  state.rendered = 0;
  $('#listTitle').textContent = title;
  $('#listCount').textContent = items.length + ' Einträge';
  const list = $('#list');
  list.className = 'list ' + (kind === 'live' ? 'rows' : 'grid');
  list.replaceChildren();
  if (!items.length) {
    list.append(el('div', { class: 'empty' }, state.tab === 'fav' ? 'Noch keine Favoriten. Stern bei einem Eintrag anklicken.' : 'Keine Einträge gefunden.'));
    return;
  }
  renderMore();
}

function renderMore() {
  const { view, viewKind: kind } = state;
  const list = $('#list');
  const end = Math.min(view.length, state.rendered + PAGE);
  const frag = document.createDocumentFragment();
  for (let i = state.rendered; i < end; i++) {
    frag.append(kind === 'live' ? liveRow(view[i], i) : posterCard(kind, view[i]));
  }
  list.append(frag);
  state.rendered = end;
}

new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && state.rendered < state.view.length) renderMore();
}, { root: document.querySelector('.content'), rootMargin: '600px' }).observe($('#listMore'));

function img(src, cls) {
  const box = () => el('div', { class: cls + ' noimg' });
  if (!src) return box();
  const i = el('img', { class: cls, loading: 'lazy', alt: '', src });
  i.addEventListener('error', () => i.replaceWith(box()), { once: true });
  return i;
}

function liveRow(it, index) {
  return el('div', { class: 'row', onclick: () => { state.livePlaylist = state.view; playLive(index); } },
    el('span', { class: 'num' }, it.num || ''),
    img(it.stream_icon, 'logo'),
    el('span', { class: 'name' }, it.name),
    starButton('live', it));
}

function posterCard(kind, it) {
  const pic = kind === 'series' ? it.cover : it.stream_icon;
  const meta = [it.year || (it.releaseDate || '').slice(0, 4), it.rating ? '★ ' + it.rating : ''].filter(Boolean).join(' · ');
  return el('div', { class: 'card', onclick: () => (kind === 'series' ? openSeries(it) : openMovie(it)) },
    img(pic, 'poster'),
    starButton(kind, it),
    el('div', { class: 'title', title: it.name }, it.name),
    el('div', { class: 'meta' }, meta));
}

/* ---------- Detailansicht ---------- */

function openOverlay(id) {
  $('#' + id).classList.remove('hidden');
}

function closeOverlay(id) {
  $('#' + id).classList.add('hidden');
  if (id === 'player') stopPlayer();
}

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeOverlay(b.dataset.close)));
document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('click', (e) => {
  if (e.target === o) closeOverlay(o.id);
}));

function favButton(kind, it) {
  const b = el('button', { class: 'btn' + (isFav(kind, itemId(kind, it)) ? ' on' : '') }, '★ Favorit');
  b.addEventListener('click', () => {
    b.classList.toggle('on', toggleFav(kind, it));
    if (state.tab === 'fav') render();
  });
  return b;
}

async function openMovie(it) {
  const body = $('#detailBody');
  const ext = it.container_extension || 'mp4';
  const plot = el('p', {}, 'Lade Beschreibung ...');
  const facts = el('div', { class: 'muted' });
  body.replaceChildren(el('div', { class: 'detail-top' },
    img(it.stream_icon, ''),
    el('div', {},
      el('h2', {}, it.name),
      facts,
      plot,
      el('div', { class: 'detail-actions' },
        el('button', { class: 'btn primary', onclick: () => playFile('vod', it.stream_id, ext, it.name, '', it) }, 'Abspielen'),
        favButton('vod', it)))));
  openOverlay('detail');
  try {
    const info = (await api('get_vod_info', { vod_id: it.stream_id })).info || {};
    plot.textContent = info.plot || info.description || '';
    facts.textContent = [info.releasedate || info.release_date, info.genre, info.duration, info.director && 'Regie: ' + info.director]
      .filter(Boolean).join(' · ');
  } catch {
    plot.textContent = '';
  }
}

async function openSeries(it) {
  const body = $('#detailBody');
  body.replaceChildren(el('div', { class: 'empty' }, 'Lade Serie ...'));
  openOverlay('detail');
  let data;
  try {
    data = await api('get_series_info', { series_id: it.series_id });
  } catch (err) {
    body.replaceChildren(el('div', { class: 'empty' }, 'Fehler: ' + err.message));
    return;
  }
  const info = data.info || {};
  const episodes = data.episodes || {};
  const seasons = Object.keys(episodes).sort((a, b) => Number(a) - Number(b));
  const seasonBar = el('div', { class: 'seasons' });
  const epList = el('div', { class: 'episodes' });

  function showSeason(s) {
    seasonBar.querySelectorAll('button').forEach((b) => b.classList.toggle('primary', b.dataset.s === s));
    epList.replaceChildren(...(episodes[s] || []).map((ep) => {
      const label = `S${s} E${ep.episode_num}`;
      const dur = ep.info && (ep.info.duration || '');
      return el('div', {
        class: 'episode',
        onclick: () => playFile('episode', ep.id, ep.container_extension || 'mp4', it.name, `${label} · ${ep.title || ''}`),
      },
      el('span', { class: 'ep-n' }, 'E' + ep.episode_num),
      el('span', { class: 'ep-t' }, ep.title || label),
      el('span', { class: 'ep-d' }, dur));
    }));
  }

  for (const s of seasons) {
    seasonBar.append(el('button', { class: 'btn small', 'data-s': s, onclick: () => showSeason(s) }, 'Staffel ' + s));
  }

  body.replaceChildren(
    el('div', { class: 'detail-top' },
      img(info.cover || it.cover, ''),
      el('div', {},
        el('h2', {}, info.name || it.name),
        el('div', { class: 'muted' }, [info.releaseDate || info.releasedate, info.genre, info.rating && '★ ' + info.rating].filter(Boolean).join(' · ')),
        el('p', {}, info.plot || ''),
        el('div', { class: 'detail-actions' }, favButton('series', it)))),
    seasons.length ? seasonBar : el('div', { class: 'empty' }, 'Keine Folgen vorhanden.'),
    epList);
  if (seasons.length) showSeason(seasons[0]);
}

/* ---------- Player ---------- */

const video = $('#video');
const player = { hls: null, ts: null, current: null, saveTimer: 0, triedFallback: false };

function stopPlayer() {
  if (player.hls) { player.hls.destroy(); player.hls = null; }
  if (player.ts) {
    try { player.ts.pause(); player.ts.unload(); player.ts.detachMediaElement(); player.ts.destroy(); } catch { /* ignorieren */ }
    player.ts = null;
  }
  video.removeAttribute('src');
  video.load();
  player.current = null;
  $('#epg').replaceChildren();
}

function playerMsg(msg) {
  $('#playerMsg').textContent = msg || '';
}

function startEngine(url, ext, live, current) {
  stopPlayer();
  player.current = current;
  playerMsg('');
  const src = proxied(url);

  if (ext === 'm3u8') {
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      player.hls = hls;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
        onPlaybackError(live);
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }
  } else if (ext === 'ts' && window.mpegts && mpegts.isSupported()) {
    const p = mpegts.createPlayer({ type: 'mpegts', isLive: live, url: new URL(src, location.href).href },
      { enableWorker: true, liveBufferLatencyChasing: live, lazyLoad: !live });
    player.ts = p;
    p.on(mpegts.Events.ERROR, () => onPlaybackError(live));
    p.attachMediaElement(video);
    p.load();
  } else {
    video.src = src;
  }
  video.play().catch(() => { /* Autoplay kann blockiert sein, Nutzer klickt Play */ });
}

video.addEventListener('error', () => {
  if (player.current && video.error) onPlaybackError(player.current.kind === 'live');
});

function onPlaybackError(live) {
  const cur = player.current;
  if (!cur) return;
  if (live && !player.triedFallback) {
    player.triedFallback = true;
    const other = state.liveFormat === 'm3u8' ? 'ts' : 'm3u8';
    playerMsg(`Stream-Fehler, versuche Format ${other.toUpperCase()} ...`);
    state.liveFormat = other;
    store('liveFormat:' + accountKey(), other);
    setTimeout(() => playLive(cur.index, true), 500);
    return;
  }
  playerMsg(live
    ? 'Sender kann nicht abgespielt werden (offline oder vom Anbieter gesperrt).'
    : 'Datei kann im Browser nicht abgespielt werden (z. B. MKV mit nicht unterstütztem Ton). "Link kopieren" und in VLC öffnen.');
}

function setupPlayerHead(title, sub, kind, item) {
  $('#playerTitle').textContent = title;
  $('#playerSub').textContent = sub || '';
  const live = kind === 'live';
  $('#prevCh').classList.toggle('hidden', !live);
  $('#nextCh').classList.toggle('hidden', !live);
  $('#switchFormat').classList.toggle('hidden', !live);
  const favBtn = $('#playerFav');
  favBtn.classList.toggle('hidden', !item);
  if (item) favBtn.classList.toggle('on', isFav(kind, itemId(kind, item)));
  openOverlay('player');
}

function playLive(index, retry) {
  const list = state.livePlaylist || [];
  const it = list[index];
  if (!it) return;
  if (!retry) player.triedFallback = false;
  const ext = state.liveFormat;
  const url = streamUrl('live', it.stream_id, ext);
  setupPlayerHead(it.name, `Live · ${ext.toUpperCase()} · ${index + 1}/${list.length}`, 'live', it);
  startEngine(url, ext, true, { kind: 'live', index, item: it, url });
  loadEpg(it);
}

// kind: 'vod' (Film) oder 'episode' (Serienfolge); item nur bei Filmen (fuer Favorit)
function playFile(kind, id, ext, title, sub, item) {
  const url = streamUrl(kind === 'episode' ? 'series' : 'vod', id, ext);
  setupPlayerHead(title, sub, kind, item || null);
  startEngine(url, ext, false, { kind, id, item: item || null, url, posKey: `pos:${accountKey()}:${kind}:${id}` });
}

// Wiedergabeposition fuer Filme/Folgen merken
video.addEventListener('loadedmetadata', () => {
  const cur = player.current;
  if (!cur || !cur.posKey) return;
  const pos = Number(store(cur.posKey)) || 0;
  if (pos > 30 && (!isFinite(video.duration) || pos < video.duration - 60)) {
    video.currentTime = pos;
    toast('Fortsetzen bei ' + Math.floor(pos / 60) + ' Min.');
  }
});
video.addEventListener('timeupdate', () => {
  const cur = player.current;
  if (!cur || !cur.posKey) return;
  const now = Date.now();
  if (now - player.saveTimer < 5000) return;
  player.saveTimer = now;
  store(cur.posKey, Math.floor(video.currentTime));
});

async function loadEpg(it) {
  const box = $('#epg');
  box.replaceChildren();
  try {
    const data = await api('get_short_epg', { stream_id: it.stream_id, limit: 6 });
    if (!player.current || player.current.item !== it) return;
    const now = Date.now() / 1000;
    const rows = (data.epg_listings || []).filter((e) => Number(e.stop_timestamp || 0) > now || !e.stop_timestamp);
    box.replaceChildren(...rows.map((e) => {
      const start = Number(e.start_timestamp);
      const stop = Number(e.stop_timestamp);
      const isNow = start <= now && stop > now;
      return el('div', { class: 'epg-item' + (isNow ? ' now' : '') },
        el('span', { class: 'epg-time' }, start ? `${fmtTime(start)} - ${fmtTime(stop)}` : ''),
        el('strong', {}, b64(e.title)),
        e.description ? el('div', { class: 'epg-desc' }, b64(e.description)) : null);
    }));
  } catch {
    /* EPG optional */
  }
}

$('#prevCh').addEventListener('click', () => stepChannel(-1));
$('#nextCh').addEventListener('click', () => stepChannel(1));

function stepChannel(delta) {
  const cur = player.current;
  if (!cur || cur.kind !== 'live') return;
  const list = state.livePlaylist || [];
  if (!list.length) return;
  const next = (cur.index + delta + list.length) % list.length;
  playLive(next);
}

$('#switchFormat').addEventListener('click', () => {
  const cur = player.current;
  if (!cur || cur.kind !== 'live') return;
  state.liveFormat = state.liveFormat === 'm3u8' ? 'ts' : 'm3u8';
  store('liveFormat:' + accountKey(), state.liveFormat);
  player.triedFallback = true;
  playLive(cur.index, true);
  toast('Format: ' + state.liveFormat.toUpperCase());
});

$('#playerFav').addEventListener('click', () => {
  const cur = player.current;
  if (!cur || !cur.item) return;
  const kind = cur.kind === 'live' ? 'live' : 'vod';
  $('#playerFav').classList.toggle('on', toggleFav(kind, cur.item));
  if (state.tab === 'fav') render();
});

$('#copyLink').addEventListener('click', async () => {
  const cur = player.current;
  if (!cur) return;
  try {
    await navigator.clipboard.writeText(cur.url);
    toast('Link kopiert (enthält Ihre Zugangsdaten)');
  } catch {
    window.prompt('Link kopieren:', cur.url);
  }
});

document.addEventListener('keydown', (e) => {
  const playerOpen = !$('#player').classList.contains('hidden');
  if (e.key === 'Escape') {
    if (playerOpen) closeOverlay('player');
    else if (!$('#detail').classList.contains('hidden')) closeOverlay('detail');
    return;
  }
  if (playerOpen && player.current && player.current.kind === 'live') {
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); stepChannel(-1); }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); stepChannel(1); }
  }
  if (playerOpen && e.key.toLowerCase() === 'f' && document.activeElement.tagName !== 'INPUT') {
    if (document.fullscreenElement) document.exitFullscreen();
    else video.requestFullscreen().catch(() => {});
  }
});

/* ---------- Start ---------- */

(async function init() {
  const c = store('creds');
  if (c && c.password) {
    try {
      await login(c);
      await showApp();
      return;
    } catch (err) {
      showLogin(err.message);
      return;
    }
  }
  showLogin();
})();
