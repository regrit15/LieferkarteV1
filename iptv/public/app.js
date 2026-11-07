'use strict';

/* ================= Hilfsfunktionen ================= */

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
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

const proxied = (url) => '/proxy?url=' + encodeURIComponent(url);

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

const fmtTime = (ts) => new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

// Text fuer die Suche vereinheitlichen: klein, ohne Akzente, nur Buchstaben/Ziffern
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ؀-ۿ]+/g, ' ')
    .trim();
}

function hue(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/* ================= Sport- und Laendererkennung ================= */

const SPORT_RE = /sport|fu(ss|ß)ball|football|soccer|bundesliga|\bliga\b|league|dazn|eurosport|tennis|golf|\bf1\b|formel|motorsport|moto\s?gp|\bnba\b|\bnfl\b|\bnhl\b|\bmlb\b|\bufc\b|\bmma\b|box(en|ing)|\bwwe\b|cricket|rugby|olymp|champions|uefa|fifa|\bppv\b|espn|bein|setanta|\bdyn\b|handball|darts|racing|eishockey|hockey|basketball|radsport|cycling/i;

const TAG_LABELS = {
  DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', EN: 'Englisch', UK: 'Großbritannien', US: 'USA',
  FR: 'Frankreich', AR: 'Arabisch', SA: 'Saudi-Arabien', AE: 'Emirate', QA: 'Katar', EG: 'Ägypten', MA: 'Marokko',
  DZ: 'Algerien', TN: 'Tunesien', TR: 'Türkei', IT: 'Italien', ES: 'Spanien', PT: 'Portugal', NL: 'Niederlande',
  BE: 'Belgien', PL: 'Polen', RU: 'Russland', UA: 'Ukraine', AL: 'Albanien', KU: 'Kurdisch', GR: 'Griechenland',
  RO: 'Rumänien', BG: 'Bulgarien', HU: 'Ungarn', CZ: 'Tschechien', SK: 'Slowakei', HR: 'Kroatien', RS: 'Serbien',
  BA: 'Bosnien', MK: 'Nordmazedonien', SI: 'Slowenien', 'EX-YU': 'Ex-Jugoslawien', SE: 'Schweden', NO: 'Norwegen',
  DK: 'Dänemark', FI: 'Finnland', IN: 'Indien', PK: 'Pakistan', IR: 'Iran', AF: 'Afghanistan', CA: 'Kanada',
  BR: 'Brasilien', MX: 'Mexiko', ARG: 'Argentinien', LATINO: 'Lateinamerika', AFR: 'Afrika', ASIA: 'Asien',
  KR: 'Korea', JP: 'Japan', CN: 'China', PH: 'Philippinen', VN: 'Vietnam', TH: 'Thailand', IL: 'Israel',
  CARIB: 'Karibik', AU: 'Australien', IE: 'Irland', LT: 'Litauen', LV: 'Lettland', EE: 'Estland', AM: 'Armenien',
  AZ: 'Aserbaidschan', GE: 'Georgien', KZ: 'Kasachstan', LB: 'Libanon', SY: 'Syrien', IQ: 'Irak', JO: 'Jordanien',
  KW: 'Kuwait', OM: 'Oman', BH: 'Bahrain', YE: 'Jemen', SO: 'Somalia', ET: 'Äthiopien', NG: 'Nigeria',
};
const TAG_ALIAS = {
  GER: 'DE', DEU: 'DE', D: 'DE', FRA: 'FR', ARA: 'AR', ARB: 'AR', ENG: 'EN', GB: 'UK', ITA: 'IT', ESP: 'ES',
  SPA: 'ES', POR: 'PT', TUR: 'TR', TR: 'TR', POL: 'PL', RUS: 'RU', ALB: 'AL', KUR: 'KU', IND: 'IN', PAK: 'PK',
  IRN: 'IR', NLD: 'NL', SWE: 'SE', NOR: 'NO', DEN: 'DK', FIN: 'FI', BEL: 'BE', SUI: 'CH', AUT: 'AT', USA: 'US',
  CAN: 'CA', BRA: 'BR', MEX: 'MX', GRE: 'GR', ROM: 'RO', BUL: 'BG', HUN: 'HU', CZE: 'CZ', SRB: 'RS', CRO: 'HR',
  BOS: 'BA', MKD: 'MK', UKR: 'UA', KOR: 'KR', JPN: 'JP', CHN: 'CN', PHI: 'PH', VIE: 'VN', THA: 'TH', EXYU: 'EX-YU',
  YU: 'EX-YU', LAT: 'LATINO', LA: 'LATINO', ASI: 'ASIA', CAR: 'CARIB', KSA: 'SA', UAE: 'AE', IRE: 'IE', AUS: 'AU',
  ISR: 'IL', MAR: 'MA', ALG: 'DZ', TUN: 'TN', EGY: 'EG', AFG: 'AF', SOM: 'SO', ARM: 'AM',
};
const NOT_TAGS = new Set(['HD', 'SD', 'FHD', 'UHD', 'TV', 'VIP', 'PPV', 'VOD', 'NEW', 'TOP', 'ALL', 'THE', 'MY', 'HEVC', 'RAW', 'LIVE', 'MULTI', 'ON', 'EPG']);
const TAG_WORDS = [
  [/fran(ce|cais|zosisch)|\bfrench\b/, 'FR'], [/\bsaudi|\bksa\b/, 'SA'], [/\barab|\bmbc\b|\bosn\b/, 'AR'],
  [/\bt(u|ue)rk/, 'TR'], [/\bital(y|ia|ian|ien)/, 'IT'], [/\bspain|spanish|espan/, 'ES'], [/\bpol(and|ish|ska|en)\b/, 'PL'],
  [/\brus(sia|sian|sland|skiy)/, 'RU'], [/\bportug/, 'PT'], [/\balban/, 'AL'], [/\bkurd/, 'KU'], [/\bindia\b|\bhindi\b|\btamil\b/, 'IN'],
  [/\bpakistan|\burdu\b/, 'PK'], [/\bpersian|\biran\b|\bfarsi\b/, 'IR'], [/\bdutch|nederland|netherland/, 'NL'],
  [/\bgreek|\bgreece|griech/, 'GR'], [/\broman(ia|ian)\b/, 'RO'], [/\bafrica/, 'AFR'], [/\blatino|latin america/, 'LATINO'],
  [/\bex ?yu\b|\bbalkan/, 'EX-YU'], [/\bdeutsch|\bgerman/, 'DE'], [/\bunited kingdom\b|\bbritish\b/, 'UK'],
];

// Laenderkennung aus einem Namen wie "FR | Sport", "[AR] MBC", "TR: TRT 1", "ARABIC MOVIES".
// prefixOnly: nur Kennung am Anfang werten (fuer Sender-/Filmnamen, damit "French Connection" nicht als FR gilt)
function detectTag(name, prefixOnly) {
  const s = String(name || '');
  const m = s.match(/^[^A-Za-z0-9]*([A-Za-z]{2,4}(?:-[A-Za-z]{2})?)\s*(?:[|:\]\)\-–»•]|\s\|)/);
  if (m) {
    let code = m[1].toUpperCase();
    code = TAG_ALIAS[code] || code;
    if (!NOT_TAGS.has(code) && (code.length === 2 || TAG_LABELS[code])) return code;
  }
  if (prefixOnly) return '';
  const n = norm(s);
  for (const [re, code] of TAG_WORDS) if (re.test(n)) return code;
  return '';
}

/* ================= Zustand ================= */

const state = {
  creds: null,
  info: null,
  tab: 'live',
  cat: null,
  search: '',
  data: {},          // live / vod / series: { cats, catById, items, sportIds }
  favs: { live: [], vod: [], series: [] },
  filter: { tags: [], cats: { live: [], vod: [], series: [] } },
  view: [],
  viewKind: 'live',
  rendered: 0,
  liveFormat: 'm3u8',
  livePlaylist: [],
};

const PAGE = 120;
const KINDS = ['live', 'vod', 'series'];
const KIND_LABEL = { live: 'Sender', vod: 'Filme', series: 'Serien' };

const accountKey = () => (state.creds ? state.creds.server + '|' + state.creds.username : '');

/* ================= Xtream-API ================= */

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
  const path = kind === 'live' ? 'live' : kind === 'vod' ? 'movie' : 'series';
  return `${server}/${path}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${id}.${ext}`;
}

const ACTIONS = {
  live: ['get_live_categories', 'get_live_streams'],
  vod: ['get_vod_categories', 'get_vod_streams'],
  series: ['get_series_categories', 'get_series'],
};

const itemId = (kind, it) => String(kind === 'series' ? it.series_id : it.stream_id);

const loading = {};
function loadKind(kind) {
  if (state.data[kind]) return Promise.resolve(state.data[kind]);
  if (loading[kind]) return loading[kind];
  loading[kind] = (async () => {
    const [catAction, itemAction] = ACTIONS[kind];
    const [cats, items] = await Promise.all([api(catAction), api(itemAction)]);
    const catList = (Array.isArray(cats) ? cats : []).map((c) => ({ ...c, category_id: String(c.category_id) }));
    for (const c of catList) c._tag = detectTag(c.category_name);
    const catById = Object.fromEntries(catList.map((c) => [c.category_id, c]));
    const itemList = Array.isArray(items) ? items : [];
    for (const it of itemList) {
      it.category_id = String(it.category_id);
      it._n = norm(it.name);
      // weitere durchsuchbare Felder (bei Serien oft vorhanden)
      it._x = norm([it.genre, it.cast, it.director, it.plot].filter(Boolean).join(' '));
      it._tag = detectTag(it.name, true);
    }
    const sportIds = new Set(catList.filter((c) => SPORT_RE.test(c.category_name)).map((c) => c.category_id));
    state.data[kind] = { cats: catList, catById, items: itemList, sportIds };
    return state.data[kind];
  })();
  loading[kind].catch(() => { delete loading[kind]; });
  return loading[kind];
}

/* ================= Laenderfilter ================= */

function loadFilter() {
  const f = store('filter:' + accountKey()) || {};
  state.filter = { tags: f.tags || [], cats: { live: [], vod: [], series: [], ...(f.cats || {}) } };
}
const saveFilter = () => store('filter:' + accountKey(), state.filter);

function catVisible(kind, catId) {
  if (state.filter.cats[kind].includes(catId)) return false;
  const c = state.data[kind] && state.data[kind].catById[catId];
  return !(c && c._tag && state.filter.tags.includes(c._tag));
}

function itemVisible(kind, it) {
  if (!catVisible(kind, it.category_id)) return false;
  return !(it._tag && state.filter.tags.includes(it._tag));
}

function hiddenCount() {
  return state.filter.tags.length + KINDS.reduce((n, k) => n + state.filter.cats[k].length, 0);
}

function updateFilterButton() {
  const n = hiddenCount();
  const b = $('#filterBtn');
  b.textContent = n ? `Länderfilter (${n} aus)` : 'Länderfilter';
  b.classList.toggle('active-filter', n > 0);
}

function filterChanged() {
  saveFilter();
  updateFilterButton();
  if (state.tab !== 'fav') {
    const d = state.data[state.tab];
    if (d && !['__all', '__sport'].includes(state.cat) && !catVisible(state.tab, state.cat)) {
      state.cat = d.sportIds.size ? '__sport' : '__all';
    }
  }
  renderSidebar();
  render();
}

function hideCategory(kind, catId) {
  if (!state.filter.cats[kind].includes(catId)) state.filter.cats[kind].push(catId);
  const c = state.data[kind].catById[catId];
  toast(`„${c ? c.category_name : catId}“ ausgeblendet. Wieder einblenden über Länderfilter.`);
  filterChanged();
}

async function openFilter() {
  const body = $('#filterBody');
  body.replaceChildren(el('div', { class: 'empty' }, 'Lade Kategorien ...'));
  $('#filterDlg').classList.remove('hidden');
  await Promise.all(KINDS.map((k) => loadKind(k).catch(() => null)));
  drawFilter();
}

function drawFilter() {
  const body = $('#filterBody');
  // Kennungen mit Anzahl Kategorien/Sender sammeln
  const counts = {};
  for (const k of KINDS) {
    const d = state.data[k];
    if (!d) continue;
    for (const c of d.cats) if (c._tag) counts[c._tag] = (counts[c._tag] || 0) + 1;
    for (const it of d.items) {
      if (it._tag && !(d.catById[it.category_id] || {})._tag) counts[it._tag] = (counts[it._tag] || 0) + 1;
    }
  }
  const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const hidden = new Set(state.filter.tags);

  const setTags = (list) => {
    state.filter.tags = list;
    filterChanged();
    drawFilter();
  };

  const grid = el('div', { class: 'f-grid' }, tags.map((t) => {
    const on = !hidden.has(t);
    const cb = el('input', { type: 'checkbox', checked: on });
    cb.addEventListener('change', () => {
      setTags(cb.checked ? state.filter.tags.filter((x) => x !== t) : [...state.filter.tags, t]);
    });
    return el('label', { class: 'f-item' + (on ? '' : ' off') },
      cb, el('span', { class: 'code' }, t), el('span', {}, TAG_LABELS[t] || ''), el('span', { class: 'cnt' }, counts[t]));
  }));

  const hiddenCats = [];
  for (const k of KINDS) {
    for (const id of state.filter.cats[k]) {
      const c = state.data[k] && state.data[k].catById[id];
      hiddenCats.push(el('div', { class: 'f-row' },
        el('span', {}, `${KIND_LABEL[k]}: ${c ? c.category_name : id}`),
        el('button', {
          class: 'btn small',
          onclick: () => {
            state.filter.cats[k] = state.filter.cats[k].filter((x) => x !== id);
            filterChanged();
            drawFilter();
          },
        }, 'Einblenden')));
    }
  }

  const keep = new Set(['DE', 'AT', 'CH']);
  body.replaceChildren(
    el('h2', { style: 'margin:0 0 4px' }, 'Länderfilter'),
    el('div', { class: 'muted' }, 'Haken entfernen = Länder/Sprachen in allen Bereichen ausblenden. Erkannt an Kennungen wie „FR |“, „[AR]“, „TR:“ im Namen.'),
    el('div', { class: 'f-presets' },
      el('button', { class: 'btn primary', onclick: () => setTags(tags.filter((t) => !keep.has(t))) }, 'Nur Deutsch (DE, AT, CH)'),
      el('button', { class: 'btn', onclick: () => setTags(tags.filter((t) => !['DE', 'AT', 'CH', 'EN', 'UK', 'US'].includes(t))) }, 'Deutsch + Englisch'),
      el('button', { class: 'btn', onclick: () => setTags([]) }, 'Alle Länder zeigen')),
    tags.length ? grid : el('div', { class: 'empty' }, 'Keine Länderkennungen gefunden.'),
    el('h3', { style: 'margin:22px 0 4px' }, 'Einzeln ausgeblendete Kategorien'),
    el('div', { class: 'muted' }, 'In der linken Liste mit der Maus über eine Kategorie fahren und „ausblenden“ klicken.'),
    el('div', { class: 'f-hidden' }, hiddenCats.length ? hiddenCats : el('div', { class: 'muted' }, 'Keine.')),
  );
}

$('#filterBtn').addEventListener('click', openFilter);

/* ================= Favoriten ================= */

function loadFavs() {
  const f = store('favs:' + accountKey()) || {};
  state.favs = { live: f.live || [], vod: f.vod || [], series: f.series || [] };
}

const isFav = (kind, id) => state.favs[kind].some((f) => f.id === id);

function toggleFav(kind, it) {
  const id = itemId(kind, it);
  const list = state.favs[kind];
  const idx = list.findIndex((f) => f.id === id);
  if (idx >= 0) list.splice(idx, 1);
  else {
    const { _n, _x, _tag, ...plain } = it;
    list.push({ id, item: plain });
  }
  store('favs:' + accountKey(), state.favs);
  toast(idx >= 0 ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt');
  if (state.tab === 'fav') { renderSidebar(); render(); }
  return idx < 0;
}

function starButton(kind, it) {
  const id = itemId(kind, it);
  const btn = el('button', { class: 'star' + (isFav(kind, id) ? ' on' : ''), title: 'Favorit' }, '★');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    btn.classList.toggle('on', toggleFav(kind, it));
  });
  btn.addEventListener('dblclick', (e) => e.stopPropagation());
  return btn;
}

/* ================= Anmeldung ================= */

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
  loadFilter();
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
  updateFilterButton();
  await switchTab(store('lastTab') || 'live');
  // restliche Bereiche im Hintergrund laden, damit die Suche sofort alles findet
  KINDS.forEach((k) => loadKind(k).catch(() => {}));
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
  stopPlayer();
  const c = store('creds');
  if (c) store('creds', { server: c.server, username: c.username });
  state.data = {};
  for (const k of Object.keys(loading)) delete loading[k];
  showLogin();
});

/* ================= Navigation ================= */

function clearSearch() {
  state.search = '';
  $('#search').value = '';
}

async function switchTab(tab) {
  state.tab = tab;
  clearSearch();
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
    const okSaved = saved && (saved === '__all' || (saved === '__sport' && d.sportIds.size) || (d.catById[saved] && catVisible(tab, saved)));
    state.cat = okSaved ? saved : d.sportIds.size ? '__sport' : '__all';
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
    state.search = e.target.value.trim();
    render();
  }, 180);
});

function selectCat(cat) {
  state.cat = cat;
  if (state.tab !== 'fav') store('lastCat:' + state.tab, cat);
  clearSearch();
  document.querySelectorAll('.cat').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
  render();
  $('#listCol').scrollTop = 0;
}

function catButton(id, name, count, opts = {}) {
  const btn = el('button', {
    class: 'cat' + (opts.sport ? ' sport' : '') + (state.cat === id ? ' active' : ''),
    'data-cat': id,
    onclick: () => selectCat(id),
  }, el('span', {}, name), count != null ? el('span', { class: 'n' }, count) : null);
  if (!opts.hideable) return btn;
  return el('div', { class: 'cat-wrap' }, btn,
    el('button', {
      class: 'cat-hide',
      title: 'Kategorie ausblenden',
      onclick: (e) => { e.stopPropagation(); hideCategory(state.tab, id); },
    }, 'ausblenden'));
}

function renderSidebar() {
  const side = $('#sidebar');
  side.replaceChildren();

  if (state.tab === 'fav') {
    side.append(
      el('div', { class: 'side-group' }, 'Favoriten'),
      catButton('fav:live', 'Sender', state.favs.live.length),
      catButton('fav:vod', 'Filme', state.favs.vod.length),
      catButton('fav:series', 'Serien', state.favs.series.length));
    return;
  }

  const kind = state.tab;
  const d = state.data[kind];
  if (!d) return;
  const counts = {};
  let total = 0;
  let sportTotal = 0;
  for (const it of d.items) {
    if (!itemVisible(kind, it)) continue;
    counts[it.category_id] = (counts[it.category_id] || 0) + 1;
    total++;
    if (d.sportIds.has(it.category_id)) sportTotal++;
  }
  const visCats = d.cats.filter((c) => catVisible(kind, c.category_id));
  const sportCats = visCats.filter((c) => d.sportIds.has(c.category_id));
  const otherCats = visCats.filter((c) => !d.sportIds.has(c.category_id));
  const label = KIND_LABEL[kind];

  if (sportCats.length) {
    side.append(el('div', { class: 'side-group' }, 'Sport'));
    side.append(catButton('__sport', 'Alle Sport-' + label, sportTotal, { sport: true }));
    for (const c of sportCats) side.append(catButton(c.category_id, c.category_name, counts[c.category_id] || 0, { sport: true, hideable: true }));
  }
  side.append(el('div', { class: 'side-group' }, 'Kategorien'));
  side.append(catButton('__all', 'Alle ' + label, total));
  for (const c of otherCats) side.append(catButton(c.category_id, c.category_name, counts[c.category_id] || 0, { hideable: true }));
}

/* ================= Liste ================= */

function currentItems() {
  if (state.tab === 'fav') {
    const kind = state.cat.slice(4);
    return { kind, items: state.favs[kind].map((f) => f.item), title: 'Favoriten: ' + KIND_LABEL[kind] };
  }
  const kind = state.tab;
  const d = state.data[kind];
  const vis = d.items.filter((it) => itemVisible(kind, it));
  if (state.cat === '__all') return { kind, items: vis, title: 'Alle ' + KIND_LABEL[kind] };
  if (state.cat === '__sport') return { kind, items: vis.filter((it) => d.sportIds.has(it.category_id)), title: 'Alle Sport-' + KIND_LABEL[kind] };
  const cat = d.catById[state.cat];
  return { kind, items: vis.filter((it) => it.category_id === state.cat), title: cat ? cat.category_name : '' };
}

function showPreview(on) {
  $('#preview').classList.toggle('hidden', !on);
  if (!on && player.mount === $('#preview')) stopPlayer();
}

function render() {
  if (state.search) return renderSearch();
  if (state.tab !== 'fav' && !state.data[state.tab]) return;
  const { kind, items, title } = currentItems();
  state.view = items;
  state.viewKind = kind;
  state.rendered = 0;
  showPreview(kind === 'live');
  $('#listTitle').textContent = title;
  $('#listCount').textContent = items.length + ' Einträge';
  const list = $('#list');
  list.className = 'list ' + (kind === 'live' ? 'rows' : 'grid');
  list.replaceChildren();
  if (!items.length) {
    list.append(el('div', { class: 'empty' }, state.tab === 'fav' ? 'Noch keine Favoriten. Stern bei einem Eintrag anklicken.' : 'Keine Einträge (evtl. durch Länderfilter ausgeblendet).'));
    return;
  }
  renderMore();
}

function renderMore() {
  const { view, viewKind: kind } = state;
  const end = Math.min(view.length, state.rendered + PAGE);
  const frag = document.createDocumentFragment();
  for (let i = state.rendered; i < end; i++) {
    frag.append(kind === 'live' ? liveRow(view[i], view, i) : posterCard(kind, view[i]));
  }
  $('#list').append(frag);
  state.rendered = end;
}

new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !state.search && state.rendered < state.view.length) renderMore();
}, { root: $('#listCol'), rootMargin: '600px' }).observe($('#listMore'));

/* ---------- Volltextsuche ---------- */

function searchKind(kind, tokens) {
  const d = state.data[kind];
  if (!d) return [];
  const q = tokens.join(' ');
  const hits = [];
  for (const it of d.items) {
    if (!itemVisible(kind, it)) continue;
    let inName = true;
    let all = true;
    for (const t of tokens) {
      if (!it._n.includes(t)) {
        inName = false;
        if (!it._x.includes(t)) { all = false; break; }
      }
    }
    if (!all) continue;
    // Rang: Treffer am Anfang > ganze Phrase im Namen > alle Woerter im Namen > nur Zusatzfelder
    const score = it._n.startsWith(q) ? 0 : it._n.includes(q) ? 1 : inName ? 2 : 3;
    hits.push([score, it]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  return hits.map((h) => h[1]);
}

function highlight(text, tokens) {
  // markiert Suchwoerter im Originaltext (Gross/Klein egal)
  const s = String(text || '');
  const ranges = [];
  const lower = s.toLowerCase();
  for (const t of tokens) {
    if (!t) continue;
    let i = lower.indexOf(t);
    while (i >= 0) { ranges.push([i, i + t.length]); i = lower.indexOf(t, i + t.length); }
  }
  if (!ranges.length) return document.createTextNode(s);
  ranges.sort((a, b) => a[0] - b[0]);
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a < pos) continue;
    frag.append(s.slice(pos, a), el('mark', {}, s.slice(a, b)));
    pos = b;
  }
  frag.append(s.slice(pos));
  return frag;
}

const searchLimits = {};
async function renderSearch() {
  const raw = state.search;
  const tokens = norm(raw).split(' ').filter(Boolean);
  showPreview(state.tab === 'live');
  const list = $('#list');
  list.className = 'list';
  $('#listTitle').textContent = 'Suche: ' + raw;
  if (!tokens.length) { list.replaceChildren(); $('#listCount').textContent = ''; return; }

  const missing = KINDS.filter((k) => !state.data[k]);
  if (missing.length) {
    $('#listCount').textContent = 'lade Daten ...';
    await Promise.all(missing.map((k) => loadKind(k).catch(() => null)));
    if (state.search !== raw) return;
  }

  const sections = [];
  let total = 0;
  for (const kind of KINDS) {
    const hits = searchKind(kind, tokens);
    total += hits.length;
    if (!hits.length) continue;
    const key = raw + '|' + kind;
    const limit = searchLimits[key] || (kind === 'live' ? 30 : 24);
    const shown = hits.slice(0, limit);
    const box = el('div', { class: kind === 'live' ? 'rows' : 'grid' },
      shown.map((it, i) => (kind === 'live' ? liveRow(it, hits, i, tokens) : posterCard(kind, it, tokens))));
    sections.push(el('section', { class: 'sr-section' },
      el('div', { class: 'sr-head' }, el('h3', {}, KIND_LABEL[kind]), el('span', { class: 'muted' }, hits.length + ' Treffer')),
      box,
      hits.length > limit ? el('button', {
        class: 'btn small sr-more',
        onclick: () => { searchLimits[key] = limit + 120; renderSearch(); },
      }, `Weitere ${Math.min(120, hits.length - limit)} anzeigen`) : null));
  }
  $('#listCount').textContent = total + ' Treffer';
  list.replaceChildren(...(sections.length ? sections : [el('div', { class: 'empty' }, 'Nichts gefunden.')]));
}

/* ---------- Zeilen und Kacheln ---------- */

function placeholder(cls, title) {
  const short = String(title || '').replace(/^[^A-Za-z0-9À-ɏ]*[A-Za-z]{2,4}\s*[|:\]\-]\s*/, '');
  return el('div', { class: cls + ' ph', style: `--h:${hue(title)}` }, cls.includes('logo') ? short.slice(0, 10) : short);
}

function img(src, cls, title) {
  if (!src || !/^https?:\/\//i.test(src)) return placeholder(cls, title);
  const i = el('img', { class: cls, loading: 'lazy', alt: '', src, referrerpolicy: 'no-referrer' });
  i.addEventListener('error', () => i.replaceWith(placeholder(cls, title)), { once: true });
  return i;
}

function liveRow(it, list, index, tokens) {
  const row = el('div', { class: 'row', 'data-sid': it.stream_id },
    el('span', { class: 'num' }, it.num || ''),
    img(it.stream_icon, 'logo', it.name),
    el('div', { class: 'txt' },
      el('div', { class: 'name' }, tokens ? highlight(it.name, tokens) : it.name),
      el('div', { class: 'now' }),
      el('div', { class: 'bar hidden' }, el('i'))),
    starButton('live', it));
  if (player.current && player.current.kind === 'live' && String(player.current.item.stream_id) === String(it.stream_id)) row.classList.add('playing');
  row.addEventListener('click', () => { state.livePlaylist = list; playLive(index); });
  row.addEventListener('dblclick', () => goFullscreen());
  epgObserver.observe(row);
  row._item = it;
  return row;
}

function posterCard(kind, it, tokens) {
  const pic = kind === 'series' ? it.cover : it.stream_icon;
  const year = it.year || (it.releaseDate || it.releasedate || '').slice(0, 4);
  const meta = [year, it.rating && Number(it.rating) > 0 ? '★ ' + it.rating : ''].filter(Boolean).join(' · ');
  return el('div', { class: 'card', title: it.name, onclick: () => (kind === 'series' ? openSeries(it) : openMovie(it)) },
    img(pic, 'poster', it.name),
    starButton(kind, it),
    el('div', { class: 'title' }, tokens ? highlight(it.name, tokens) : it.name),
    el('div', { class: 'meta' }, meta));
}

/* ================= EPG (Programm) ================= */

const epgCache = new Map(); // stream_id -> { t, list }
const epgQueue = [];
let epgActive = 0;

function epgFor(it) {
  const sid = String(it.stream_id);
  const c = epgCache.get(sid);
  if (c && (c.list || c.pending) && Date.now() - c.t < 10 * 60 * 1000) return c.pending || Promise.resolve(c.list);
  const p = new Promise((resolve) => epgQueue.push({ sid, resolve }));
  epgCache.set(sid, { t: Date.now(), pending: p });
  pumpEpg();
  return p;
}

function pumpEpg() {
  while (epgActive < 4 && epgQueue.length) {
    const job = epgQueue.shift();
    epgActive++;
    api('get_short_epg', { stream_id: job.sid, limit: 8 })
      .then((d) => (Array.isArray(d.epg_listings) ? d.epg_listings : []))
      .catch(() => [])
      .then((list) => {
        const parsed = list.map((e) => ({
          start: Number(e.start_timestamp) || 0,
          stop: Number(e.stop_timestamp) || 0,
          title: b64(e.title),
          desc: b64(e.description),
        }));
        epgCache.set(job.sid, { t: Date.now(), list: parsed });
        job.resolve(parsed);
      })
      .finally(() => { epgActive--; pumpEpg(); });
  }
}

function nowEntry(list) {
  const now = Date.now() / 1000;
  return list.find((e) => e.start <= now && e.stop > now);
}

const epgObserver = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const row = en.target;
    epgObserver.unobserve(row);
    const it = row._item;
    if (!it || it.epg_channel_id === '' || it.epg_channel_id === null) continue;
    epgFor(it).then((list) => {
      const e = nowEntry(list);
      if (!e) return;
      row.querySelector('.now').textContent = `${fmtTime(e.start)}  ${e.title}`;
      const bar = row.querySelector('.bar');
      bar.classList.remove('hidden');
      bar.firstChild.style.width = Math.min(100, ((Date.now() / 1000 - e.start) / (e.stop - e.start)) * 100) + '%';
    });
  }
}, { rootMargin: '200px' });

async function showEpg(it, box) {
  box.replaceChildren();
  const list = await epgFor(it);
  if (!player.current || player.current.item !== it) return;
  const now = Date.now() / 1000;
  const rows = list.filter((e) => !e.stop || e.stop > now);
  if (!rows.length) { box.append(el('div', { class: 'muted' }, 'Kein Programm verfügbar.')); return; }
  box.replaceChildren(...rows.map((e) => el('div', { class: 'epg-item' + (e.start <= now && e.stop > now ? ' now' : '') },
    el('span', { class: 'epg-time' }, e.start ? `${fmtTime(e.start)} - ${fmtTime(e.stop)}` : ''),
    el('strong', {}, e.title),
    e.desc ? el('div', { class: 'epg-desc' }, e.desc) : null)));
}

/* ================= Detailansicht ================= */

function openOverlay(id) { $('#' + id).classList.remove('hidden'); }

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
  b.addEventListener('click', () => b.classList.toggle('on', toggleFav(kind, it)));
  return b;
}

function detailFrame(backdrop) {
  const box = $('#detail .detail-box');
  box.classList.toggle('has-backdrop', !!backdrop);
  box.scrollTop = 0;
  return backdrop ? el('div', { class: 'backdrop', style: `background-image:url("${backdrop.replace(/"/g, '%22')}")` }) : null;
}

function firstUrl(v) {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && /^https?:\/\//i.test(s) ? s : '';
}

async function openMovie(it) {
  const body = $('#detailBody');
  const ext = it.container_extension || 'mp4';
  body.replaceChildren(el('div', { class: 'empty' }, 'Lade ...'));
  openOverlay('detail');
  let info = {};
  try {
    info = (await api('get_vod_info', { vod_id: it.stream_id })).info || {};
  } catch { /* Beschreibung optional */ }
  const facts = [info.releasedate || info.release_date, info.genre, info.duration, info.rating && Number(info.rating) > 0 && '★ ' + info.rating]
    .filter(Boolean).join(' · ');
  body.replaceChildren(
    detailFrame(firstUrl(info.backdrop_path)),
    el('div', { class: 'detail-top' },
      img(info.movie_image || it.stream_icon, 'poster-lg', it.name),
      el('div', {},
        el('h2', {}, it.name),
        el('div', { class: 'muted' }, facts),
        el('p', {}, info.plot || info.description || ''),
        info.cast ? el('div', { class: 'muted' }, 'Mit: ' + info.cast) : null,
        info.director ? el('div', { class: 'muted' }, 'Regie: ' + info.director) : null,
        el('div', { class: 'detail-actions' },
          el('button', { class: 'btn primary', onclick: () => playFile('vod', it.stream_id, ext, it.name, facts, it) }, '▶ Abspielen'),
          favButton('vod', it)))));
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
  const name = info.name || it.name;

  function showSeason(s) {
    seasonBar.querySelectorAll('button').forEach((b) => b.classList.toggle('primary', b.dataset.s === s));
    epList.replaceChildren(...(episodes[s] || []).map((ep) => {
      const label = `S${s} E${ep.episode_num}`;
      const ei = ep.info || {};
      const seen = Number(store(`pos:${accountKey()}:episode:${ep.id}`)) > 30;
      return el('div', {
        class: 'episode',
        onclick: () => playFile('episode', ep.id, ep.container_extension || 'mp4', name, `${label} · ${ep.title || ''}`),
      },
      img(ei.movie_image, 'ep-img', label),
      el('div', { class: 'ep-t' },
        el('div', {}, el('strong', {}, 'E' + ep.episode_num + '  '), ep.title || label, seen ? el('span', { class: 'muted' }, '  · angesehen') : null),
        ei.plot ? el('div', { class: 'ep-plot' }, ei.plot) : null),
      el('span', { class: 'ep-d' }, ei.duration || ''));
    }));
  }

  for (const s of seasons) {
    seasonBar.append(el('button', { class: 'btn small', 'data-s': s, onclick: () => showSeason(s) }, 'Staffel ' + s));
  }

  body.replaceChildren(
    detailFrame(firstUrl(info.backdrop_path) || firstUrl(it.backdrop_path)),
    el('div', { class: 'detail-top' },
      img(info.cover || it.cover, 'poster-lg', name),
      el('div', {},
        el('h2', {}, name),
        el('div', { class: 'muted' }, [info.releaseDate || info.releasedate, info.genre, info.rating && Number(info.rating) > 0 && '★ ' + info.rating].filter(Boolean).join(' · ')),
        el('p', {}, info.plot || it.plot || ''),
        info.cast ? el('div', { class: 'muted' }, 'Mit: ' + info.cast) : null,
        el('div', { class: 'detail-actions' }, favButton('series', it)))),
    seasons.length ? seasonBar : el('div', { class: 'empty' }, 'Keine Folgen vorhanden.'),
    epList);
  if (seasons.length) showSeason(seasons[0]);
}

/* ================= Player ================= */

const video = el('video', { controls: true, autoplay: true, playsinline: true });
const player = { hls: null, ts: null, current: null, mount: null, saveTimer: 0, triedFallback: false };
const role = (r) => (player.mount ? $(`[data-role="${r}"]`, player.mount) : null);

function stopPlayer() {
  if (player.hls) { player.hls.destroy(); player.hls = null; }
  if (player.ts) {
    try { player.ts.pause(); player.ts.unload(); player.ts.detachMediaElement(); player.ts.destroy(); } catch { /* ignorieren */ }
    player.ts = null;
  }
  video.removeAttribute('src');
  video.load();
  player.current = null;
  document.querySelectorAll('.row.playing').forEach((r) => r.classList.remove('playing'));
  const pv = $('#preview');
  $('[data-role="slot"]', pv).replaceChildren(el('div', { class: 'slot-empty' }, 'Sender anklicken zum Abspielen.', el('br'), 'Doppelklick = Vollbild'));
  for (const r of ['title', 'sub', 'msg', 'epg']) $(`[data-role="${r}"]`, pv).replaceChildren();
}

function setMsg(msg) {
  const m = role('msg');
  if (m) m.textContent = msg || '';
}

function mountPlayer(target) {
  player.mount = target;
  role('slot').replaceChildren(video);
}

function startEngine(url, ext, live, current) {
  stopPlayer();
  player.current = current;
  setMsg('');
  const src = proxied(url);

  if (ext === 'm3u8') {
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
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
  video.play().catch(() => { /* Autoplay evtl. blockiert */ });
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
    setMsg(`Stream-Fehler, versuche Format ${other.toUpperCase()} ...`);
    state.liveFormat = other;
    store('liveFormat:' + accountKey(), other);
    setTimeout(() => { if (player.current === cur) playLive(cur.index, true); }, 500);
    return;
  }
  setMsg(live
    ? 'Sender kann nicht abgespielt werden (offline oder vom Anbieter gesperrt).'
    : 'Datei kann im Browser nicht abgespielt werden (z. B. MKV mit nicht unterstütztem Ton). „Link kopieren“ und in VLC öffnen.');
}

function setupHead(title, sub, kind, item) {
  role('title').textContent = title;
  role('sub').textContent = sub || '';
  const live = kind === 'live';
  for (const r of ['prev', 'next', 'format']) role(r).classList.toggle('hidden', !live);
  const fav = role('fav');
  fav.classList.toggle('hidden', !item);
  if (item) fav.classList.toggle('on', isFav(kind, itemId(kind, item)));
}

function playLive(index, retry) {
  const list = state.livePlaylist || [];
  const it = list[index];
  if (!it) return;
  if (!retry) player.triedFallback = false;
  const inPreview = !$('#preview').classList.contains('hidden') && $('#player').classList.contains('hidden');
  const target = inPreview ? $('#preview') : $('#playerBox');
  const ext = state.liveFormat;
  const url = streamUrl('live', it.stream_id, ext);
  startEngine(url, ext, true, { kind: 'live', index, item: it, url });
  mountPlayer(target);
  if (!inPreview) openOverlay('player');
  setupHead(it.name, `Live · ${ext.toUpperCase()} · ${index + 1}/${list.length}`, 'live', it);
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('playing', r.dataset.sid === String(it.stream_id)));
  const row = document.querySelector(`.row[data-sid="${it.stream_id}"]`);
  if (row && inPreview) row.scrollIntoView({ block: 'nearest' });
  showEpg(it, role('epg'));
}

// kind: 'vod' (Film) oder 'episode' (Serienfolge); item nur bei Filmen (fuer Favorit)
function playFile(kind, id, ext, title, sub, item) {
  const url = streamUrl(kind === 'episode' ? 'series' : 'vod', id, ext);
  startEngine(url, ext, false, { kind, id, item: item || null, url, posKey: `pos:${accountKey()}:${kind}:${id}` });
  mountPlayer($('#playerBox'));
  openOverlay('player');
  setupHead(title, sub, kind, item || null);
  role('epg').replaceChildren();
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

function stepChannel(delta) {
  const cur = player.current;
  if (!cur || cur.kind !== 'live') return;
  const list = state.livePlaylist || [];
  if (!list.length) return;
  playLive((cur.index + delta + list.length) % list.length);
}

function goFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else video.requestFullscreen().catch(() => {});
}

// Knoepfe in Vorschau und grossem Player
for (const box of [$('#preview'), $('#playerBox')]) {
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-role]');
    if (!b || !player.current) return;
    const cur = player.current;
    switch (b.dataset.role) {
      case 'prev': stepChannel(-1); break;
      case 'next': stepChannel(1); break;
      case 'full': goFullscreen(); break;
      case 'fav':
        if (cur.item) b.classList.toggle('on', toggleFav(cur.kind === 'live' ? 'live' : 'vod', cur.item));
        break;
      case 'format':
        state.liveFormat = state.liveFormat === 'm3u8' ? 'ts' : 'm3u8';
        store('liveFormat:' + accountKey(), state.liveFormat);
        player.triedFallback = true;
        playLive(cur.index, true);
        toast('Format: ' + state.liveFormat.toUpperCase());
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(cur.url);
          toast('Link kopiert (enthält Ihre Zugangsdaten)');
        } catch {
          window.prompt('Link kopieren:', cur.url);
        }
        break;
      default:
    }
  });
}

/* ================= Tastatur ================= */

document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  const overlayOpen = (id) => !$('#' + id).classList.contains('hidden');
  if (e.key === 'Escape') {
    if (overlayOpen('player')) closeOverlay('player');
    else if (overlayOpen('detail')) closeOverlay('detail');
    else if (overlayOpen('filterDlg')) closeOverlay('filterDlg');
    else if (state.search) { clearSearch(); render(); $('#search').blur(); }
    return;
  }
  if (typing) return;
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); return; }
  if (player.current && player.current.kind === 'live') {
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); stepChannel(-1); }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); stepChannel(1); }
  }
  if (player.current && e.key.toLowerCase() === 'f') goFullscreen();
});

/* ================= Start ================= */

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
