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

state.recent = { list: [], t: 0 };
state.reminders = { list: [], t: 0, lead: 2, auto: false };
state.guideMap = null;
state.dupHidden = new Set();
state.variants = new Map();

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
    if (kind === 'live') {
      for (const it of itemList) { it._dk = dupKey(it); it._q = qualityOf(it.name); }
    }
    const byId = new Map(itemList.map((it) => [itemId(kind, it), it]));
    state.data[kind] = { cats: catList, catById, items: itemList, sportIds, byId };
    if (kind === 'live') computeDupes();
    return state.data[kind];
  })();
  loading[kind].catch(() => { delete loading[kind]; });
  return loading[kind];
}

/* ================= Laenderfilter ================= */

function loadFilter() {
  const f = store('filter:' + accountKey()) || {};
  state.filter = {
    tags: f.tags || [], cats: { live: [], vod: [], series: [], ...(f.cats || {}) }, t: f.t || 0,
    dedupe: f.dedupe !== false, quality: f.quality || 'fhd',
  };
}
function saveFilter(touch = true) {
  if (touch) state.filter.t = Date.now();
  store('filter:' + accountKey(), state.filter);
  if (touch) schedulePush(2000);
}

function catVisible(kind, catId) {
  if (state.filter.cats[kind].includes(catId)) return false;
  const c = state.data[kind] && state.data[kind].catById[catId];
  return !(c && c._tag && state.filter.tags.includes(c._tag));
}

function baseVisible(kind, it) {
  if (!catVisible(kind, it.category_id)) return false;
  return !(it._tag && state.filter.tags.includes(it._tag));
}

function itemVisible(kind, it) {
  if (!baseVisible(kind, it)) return false;
  return !(kind === 'live' && state.filter.dedupe && state.dupHidden.has(String(it.stream_id)));
}

/* ---------- Doppelte Sender (SD/HD/FHD/4K) ---------- */

const QUALITY = [
  [/\b(uhd|4k|2160p?)\b/, 4, '4K'],
  [/\b(fhd|1080[pi]?)\b/, 3, 'Full HD'],
  [/\b(hd|720p?)\b/, 2, 'HD'],
  [/\b(sd|576[pi]?|480[pi]?)\b/, 0, 'SD'],
];
const PREFER = {
  fhd: [3, 2, 1, 4, 0],
  best: [4, 3, 2, 1, 0],
  hd: [2, 1, 3, 0, 4],
  sd: [0, 1, 2, 3, 4],
};
const Q_WORDS = /\b(uhd|4k|2160p?|fhd|1080[pi]?|hd|720p?|sd|576[pi]?|480[pi]?|hevc|h ?26[45]|x26[45]|26[45]|50 ?fps|60 ?fps|fps|raw|backup|vip|hdr|multi|audio|de|ger|deu)\b/g;

function superscriptFix(s) {
  return String(s || '').replace(/ᵁᴴᴰ/g, ' uhd ').replace(/ᶠᴴᴰ/g, ' fhd ').replace(/ᴴᴰ/g, ' hd ').replace(/ˢᴰ/g, ' sd ').replace(/⁴ᴷ/g, ' 4k ');
}

function qualityOf(name) {
  const n = norm(superscriptFix(name));
  for (const [re, rank, label] of QUALITY) if (re.test(n)) return { rank, label };
  return { rank: 1, label: 'Standard' };
}

function dupKey(it) {
  // Laenderkennung am Anfang entfernen, Qualitaetsangaben entfernen
  let n = superscriptFix(it.name).replace(/\+/g, ' plus ').replace(/^[^A-Za-z0-9]*[A-Za-z]{2,4}(?:-[A-Za-z]{2})?\s*(?:[|:\]\)\-–»•]|\s\|)\s*/, '');
  n = norm(n).replace(Q_WORDS, ' ').replace(/\s+/g, ' ').trim();
  return n ? (it._tag || '') + '|' + n : '';
}

function computeDupes() {
  state.guideMap = null;
  state.dupHidden = new Set();
  state.variants = new Map();
  const d = state.data.live;
  if (!d) return;
  const groups = new Map();
  for (const it of d.items) {
    if (!it._dk || !baseVisible('live', it)) continue;
    let g = groups.get(it._dk);
    if (!g) groups.set(it._dk, (g = []));
    g.push(it);
  }
  const order = PREFER[state.filter.quality] || PREFER.fhd;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => order.indexOf(a._q.rank) - order.indexOf(b._q.rank));
    const best = sorted[0];
    const byQuality = [...g].sort((a, b) => b._q.rank - a._q.rank);
    for (const it of g) {
      state.variants.set(String(it.stream_id), byQuality);
      if (it !== best) state.dupHidden.add(String(it.stream_id));
    }
  }
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
  saveFilter(true);
  computeDupes();
  clearTimeout(guide.filterTimer);
  guide.filterTimer = setTimeout(() => ensureGuide(), 10000);
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
    dupSection(),
    el('h3', { style: 'margin:22px 0 4px' }, 'Einzeln ausgeblendete Kategorien'),
    el('div', { class: 'muted' }, 'In der linken Liste mit der Maus über eine Kategorie fahren und „ausblenden“ klicken.'),
    el('div', { class: 'f-hidden' }, hiddenCats.length ? hiddenCats : el('div', { class: 'muted' }, 'Keine.')),
  );
}

function dupSection() {
  const cb = el('input', { type: 'checkbox', checked: state.filter.dedupe });
  cb.addEventListener('change', () => { state.filter.dedupe = cb.checked; filterChanged(); drawFilter(); });
  const sel = el('select', { class: 'search', style: 'max-width:260px;flex:none' },
    [['fhd', 'Full HD (empfohlen)'], ['best', 'Höchste Qualität (4K)'], ['hd', 'HD'], ['sd', 'SD (wenig Datenvolumen)']]
      .map(([v, l]) => el('option', { value: v, selected: state.filter.quality === v }, l)));
  sel.addEventListener('change', () => { state.filter.quality = sel.value; filterChanged(); drawFilter(); });
  const n = state.dupHidden.size;
  return el('div', {},
    el('h3', { style: 'margin:22px 0 4px' }, 'Doppelte Sender'),
    el('div', { class: 'muted' }, 'Derselbe Sender in SD, HD, Full HD und 4K wird nur einmal gezeigt. Im Player lässt sich die Qualität trotzdem wechseln.'),
    el('div', { class: 'sync-row', style: 'align-items:center;margin-top:10px;flex-wrap:wrap' },
      el('label', { class: 'f-item', style: 'flex:none' }, cb, el('span', {}, 'Nur eine Variante je Sender zeigen')),
      el('span', { class: 'muted' }, 'Bevorzugt:'), sel,
      el('span', { class: 'muted' }, state.filter.dedupe ? `${n} Varianten ausgeblendet` : `${n} Varianten vorhanden`)));
}

$('#filterBtn').addEventListener('click', openFilter);
$('#syncBtn').addEventListener('click', openSync);

/* ================= Favoriten ================= */

function loadFavs() {
  const f = store('favs:' + accountKey()) || {};
  state.favs = { live: f.live || [], vod: f.vod || [], series: f.series || [], t: f.t || 0 };
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
  state.favs.t = Date.now();
  store('favs:' + accountKey(), state.favs);
  schedulePush(2000);
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

/* ================= Wiedergabe-Fortschritt ================= */

// state.prog:       { 'vod:ID' | 'episode:ID': { pos, dur, done, t, hide, item } }
// state.seriesProg: { seriesId: { series, ep, next, t, hide } }  (zuletzt gesehene Folge je Serie)
const DONE_RATIO = 0.9;

function loadProgress() {
  const acc = accountKey();
  state.prog = store('prog:' + acc) || {};
  state.seriesProg = store('seriesprog:' + acc) || {};
  // Positionen aus der ersten Version uebernehmen
  try {
    const prefix = 'pos:' + acc + ':';
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const key = k.slice(prefix.length);
      if (!state.prog[key]) state.prog[key] = { pos: Number(localStorage.getItem(k)) || 0, dur: 0, done: false, t: Date.now() };
      localStorage.removeItem(k);
    }
  } catch { /* ignorieren */ }
  saveProgress();
}

function saveProgress() {
  store('prog:' + accountKey(), state.prog);
  store('seriesprog:' + accountKey(), state.seriesProg);
  schedulePush(20000);
}

const getProg = (kind, id) => state.prog[kind + ':' + id];

function updateProg(kind, id, patch) {
  const key = kind + ':' + id;
  const p = { pos: 0, dur: 0, done: false, ...(state.prog[key] || {}), ...patch, t: Date.now() };
  if (p.dur > 0 && p.pos / p.dur >= DONE_RATIO) p.done = true;
  state.prog[key] = p;
  return p;
}

function setSeen(kind, id, seen) {
  const p = updateProg(kind, id, seen ? { done: true } : { done: false, pos: 0 });
  if (!seen) p.done = false;
  saveProgress();
}

// Anzeige: Balken in Prozent + Text
function progInfo(p) {
  if (!p) return null;
  if (p.done) return { pct: 100, label: 'gesehen', done: true };
  if (p.pos < 30) return null;
  const pct = p.dur ? Math.min(99, (p.pos / p.dur) * 100) : 0;
  const rest = p.dur ? Math.max(1, Math.round((p.dur - p.pos) / 60)) : 0;
  return { pct, label: rest ? `noch ${rest} Min.` : `bei ${Math.floor(p.pos / 60)} Min.`, done: false };
}

function progDecor(pi) {
  if (!pi) return [];
  return [
    el('div', { class: 'pbar' + (pi.done ? ' done' : '') }, el('i', { style: `width:${pi.pct}%` })),
    pi.done ? el('span', { class: 'seen-badge', title: 'gesehen' }, '✓') : null,
  ];
}

const plainItem = (it) => Object.fromEntries(Object.entries(it).filter(([k]) => !k.startsWith('_')));

/* ---------- Serien: Folgenliste ---------- */

const seriesInfoCache = new Map();
async function getSeriesInfo(id) {
  const key = String(id);
  const c = seriesInfoCache.get(key);
  if (c && Date.now() - c.t < 30 * 60 * 1000) return c.data;
  const data = await api('get_series_info', { series_id: id });
  seriesInfoCache.set(key, { t: Date.now(), data });
  return data;
}

// alle Folgen in Reihenfolge (Staffel, Folge)
function flatEpisodes(data) {
  const eps = (data && data.episodes) || {};
  const seasons = Object.keys(eps).sort((a, b) => Number(a) - Number(b));
  const out = [];
  for (const s of seasons) {
    const list = [...(eps[s] || [])].sort((a, b) => Number(a.episode_num) - Number(b.episode_num));
    for (const ep of list) {
      const ei = ep.info || {};
      out.push({
        id: String(ep.id), season: String(s), num: ep.episode_num, title: ep.title || '',
        ext: ep.container_extension || 'mp4', img: ei.movie_image || '', plot: ei.plot || '', dur: ei.duration || '',
      });
    }
  }
  return out;
}

const epLabel = (e) => `S${e.season} E${e.num}`;
const seriesPlain = (it, name) => ({ series_id: it.series_id, name: name || it.name, cover: it.cover || '' });

// Index der Folge, mit der es weitergeht (-1 = alles gesehen)
function continueIndex(seriesId, flat) {
  const sp = state.seriesProg[seriesId];
  if (sp && sp.ep) {
    const i = flat.findIndex((e) => e.id === sp.ep.id);
    if (i >= 0) {
      const p = getProg('episode', flat[i].id);
      if (!p || !p.done) return i;
      for (let j = i + 1; j < flat.length; j++) if (!(getProg('episode', flat[j].id) || {}).done) return j;
      return -1;
    }
  }
  return flat.findIndex((e) => !(getProg('episode', e.id) || {}).done);
}

/* ---------- Weiter ansehen ---------- */

function contEntries() {
  const out = [];
  for (const [key, p] of Object.entries(state.prog)) {
    if (!key.startsWith('vod:') || p.done || p.hide || p.pos < 30 || !p.item) continue;
    out.push({ type: 'vod', t: p.t, item: p.item, prog: p });
  }
  for (const sp of Object.values(state.seriesProg)) {
    if (sp.hide || !sp.ep) continue;
    const p = getProg('episode', sp.ep.id);
    if (p && p.done) {
      if (!sp.next) continue;
      out.push({ type: 'series', t: sp.t, sp, ep: sp.next, resume: false, prog: getProg('episode', sp.next.id) });
    } else {
      out.push({ type: 'series', t: sp.t, sp, ep: sp.ep, resume: true, prog: p });
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

function contCard(en) {
  const isVod = en.type === 'vod';
  const title = isVod ? en.item.name : en.sp.series.name;
  const pic = isVod ? en.item.stream_icon : (en.ep.img || en.sp.series.cover);
  const pi = progInfo(en.prog);
  const meta = isVod
    ? (pi ? pi.label : '')
    : `${en.resume ? '' : 'Nächste: '}${epLabel(en.ep)}${pi && !pi.done ? ' · ' + pi.label : ''}`;
  const remove = el('button', { class: 'star', title: 'Aus „Weiter ansehen“ entfernen' }, '×');
  remove.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isVod) updateProg('vod', en.item.stream_id, { hide: true });
    else en.sp.hide = true;
    saveProgress();
    renderSidebar();
    render();
  });
  const info = el('button', { class: 'card-info', title: 'Details' }, 'Details');
  info.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isVod) openMovie(en.item); else openSeries(en.sp.series);
  });
  return el('div', {
    class: 'card' + (isVod ? '' : ' wide'),
    title,
    onclick: () => (isVod ? playMovie(en.item) : playSeriesEpisode(en.sp.series, en.ep.id)),
  },
  el('div', { class: 'pwrap' }, img(pic, isVod ? 'poster' : 'poster wide', title), ...progDecor(pi), el('span', { class: 'play-ico' }, '▶')),
  remove,
  el('div', { class: 'title' }, title),
  el('div', { class: 'meta' }, meta, ' ', info));
}

async function playSeriesEpisode(series, epId) {
  try {
    const flat = flatEpisodes(await getSeriesInfo(series.series_id));
    const i = flat.findIndex((e) => e.id === String(epId));
    if (i < 0) { toast('Folge nicht mehr beim Anbieter vorhanden'); return; }
    playEpisode(series, flat, i);
  } catch (err) {
    toast('Fehler: ' + err.message);
  }
}

/* ================= Abgleich zwischen Rechnern (Google Drive) ================= */

const sync = { status: null, busy: false, last: 0, error: '', pushTimer: null, pushDue: 0, applying: false };

const syncApi = (method, route, body) => localApi(method, '/sync/' + route, body);

async function localApi(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-SportTV': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler ' + res.status);
  return data;
}

const syncOn = () => !!(sync.status && sync.status.configured && state.creds);

function localPayload() {
  return { v: 1, t: Date.now(), prog: state.prog, seriesProg: state.seriesProg, favs: state.favs, filter: state.filter, recent: state.recent, reminders: state.reminders };
}

function unionById(a, b) {
  const seen = new Set(a.map((x) => x.id));
  return [...a, ...b.filter((x) => !seen.has(x.id))];
}

// fremde Daten einarbeiten: je Film/Folge gilt der neuere Stand; Favoriten/Filter als Ganzes
function mergePayload(d) {
  if (!d || typeof d !== 'object') return { changed: false };
  let changed = false;
  let filterChanged = false;
  for (const [k, v] of Object.entries(d.prog || {})) {
    const l = state.prog[k];
    if (v && (!l || (v.t || 0) > (l.t || 0))) { state.prog[k] = v; changed = true; }
  }
  for (const [k, v] of Object.entries(d.seriesProg || {})) {
    const l = state.seriesProg[k];
    if (v && (!l || (v.t || 0) > (l.t || 0))) { state.seriesProg[k] = v; changed = true; }
  }
  const rf = d.favs;
  if (rf) {
    if ((rf.t || 0) > (state.favs.t || 0)) {
      state.favs = { live: rf.live || [], vod: rf.vod || [], series: rf.series || [], t: rf.t };
      changed = true;
    } else if (!rf.t && !state.favs.t) {
      for (const k of KINDS) {
        const u = unionById(state.favs[k], rf[k] || []);
        if (u.length !== state.favs[k].length) { state.favs[k] = u; changed = true; }
      }
    }
  }
  const rfi = d.filter;
  if (rfi && (rfi.t || 0) > (state.filter.t || 0)) {
    state.filter = {
      tags: rfi.tags || [], cats: { live: [], vod: [], series: [], ...(rfi.cats || {}) }, t: rfi.t,
      dedupe: rfi.dedupe !== false, quality: rfi.quality || 'fhd',
    };
    changed = true;
    filterChanged = true;
  }
  if (d.reminders && (d.reminders.t || 0) > (state.reminders.t || 0)) {
    state.reminders = { lead: 2, auto: false, ...d.reminders, list: d.reminders.list || [] };
    changed = true;
  }
  if (d.recent && (d.recent.t || 0) > (state.recent.t || 0)) {
    state.recent = { list: d.recent.list || [], t: d.recent.t };
    changed = true;
  }
  return { changed, filterChanged };
}

async function syncNow(manual) {
  if (!syncOn() || sync.busy) return;
  sync.busy = true;
  clearTimeout(sync.pushTimer);
  sync.pushTimer = null;
  updateSyncButton();
  const acc = encodeURIComponent(accountKey());
  try {
    const r = await syncApi('GET', 'data?account=' + acc);
    let changed = false;
    let filterChanged = false;
    for (const f of r.files || []) {
      if (f.device === r.device) continue;
      const m = mergePayload(f.data);
      changed = changed || m.changed;
      filterChanged = filterChanged || m.filterChanged;
    }
    if (changed) {
      sync.applying = true;
      store('prog:' + accountKey(), state.prog);
      store('seriesprog:' + accountKey(), state.seriesProg);
      store('favs:' + accountKey(), state.favs);
      store('recent:' + accountKey(), state.recent);
      store('reminders:' + accountKey(), state.reminders);
      saveFilter(false);
      sync.applying = false;
      refreshAfterSync(filterChanged);
    }
    await syncApi('PUT', 'data?account=' + acc, localPayload());
    sync.last = Date.now();
    sync.error = '';
    if (manual) toast(changed ? 'Abgeglichen, Änderungen übernommen' : 'Abgeglichen, alles aktuell');
  } catch (err) {
    sync.error = err.message;
    if (manual) toast('Abgleich fehlgeschlagen: ' + err.message);
  } finally {
    sync.busy = false;
    updateSyncButton();
    if (!$('#syncDlg').classList.contains('hidden')) drawSync();
  }
}

// Hochladen gebuendelt: Favoriten/Filter nach 2 s, Wiedergabe hoechstens alle 20 s
function schedulePush(ms) {
  if (!syncOn() || sync.applying) return;
  const due = Date.now() + ms;
  if (sync.pushTimer && sync.pushDue <= due) return;
  clearTimeout(sync.pushTimer);
  sync.pushDue = due;
  sync.pushTimer = setTimeout(() => { sync.pushTimer = null; syncNow(false); }, ms);
}

function refreshAfterSync(filterChanged) {
  if (filterChanged) computeDupes();
  updateFilterButton();
  const overlayOpen = ['player', 'detail', 'filterDlg'].some((id) => !$('#' + id).classList.contains('hidden'));
  if (overlayOpen || state.search) return;
  if (filterChanged || ['cont', 'fav'].includes(state.tab) || (state.tab === 'live' && ['__recent', '__rem'].includes(state.cat))) {
    renderSidebar();
    render();
  }
}

function updateSyncButton() {
  const b = $('#syncBtn');
  if (!b) return;
  b.classList.toggle('active-filter', syncOn() && !sync.error);
  b.classList.toggle('sync-err', !!sync.error);
  b.textContent = !syncOn() ? 'Abgleich' : sync.busy ? 'Abgleich ...' : sync.error ? 'Abgleich: Fehler' : 'Abgleich an';
  b.title = sync.last ? 'Zuletzt abgeglichen: ' + new Date(sync.last).toLocaleTimeString('de-DE') : '';
}

async function initSync() {
  try {
    sync.status = await syncApi('GET', 'status');
  } catch {
    sync.status = null;
  }
  updateSyncButton();
  if (syncOn()) await syncNow(false);
}

async function openSync() {
  $('#syncDlg').classList.remove('hidden');
  $('#syncBody').replaceChildren(el('div', { class: 'empty' }, 'Lade ...'));
  try { sync.status = await syncApi('GET', 'status'); } catch (err) { sync.error = err.message; }
  drawSync();
}

async function setSyncDir(dir) {
  try {
    await syncApi('POST', 'config', { dir });
    sync.status = await syncApi('GET', 'status');
    sync.error = '';
    if (dir) await syncNow(true);
    else toast('Abgleich ausgeschaltet');
  } catch (err) {
    toast(err.message);
  }
  updateSyncButton();
  drawSync();
}

function drawSync() {
  const st = sync.status || { candidates: [] };
  const input = el('input', { class: 'search', type: 'text', value: st.dir || '', placeholder: 'Pfad zum Google-Drive-Ordner' });
  input.style.maxWidth = 'none';
  const cands = (st.candidates || []).filter((c) => c !== st.dir);
  $('#syncBody').replaceChildren(
    el('h2', { style: 'margin:0 0 4px' }, 'Abgleich zwischen Mac und PC'),
    el('div', { class: 'muted' }, 'Fortschritt, „Weiter ansehen“, Favoriten und Länderfilter werden über einen Ordner in Google Drive abgeglichen. Das Passwort wird dort nicht gespeichert.'),
    el('div', { class: 'sync-status' + (st.configured ? ' ok' : '') },
      st.configured
        ? [el('strong', {}, 'Aktiv'), el('div', { class: 'muted' }, st.dir),
          el('div', { class: 'muted' }, sync.last ? 'Zuletzt abgeglichen: ' + new Date(sync.last).toLocaleTimeString('de-DE') : 'Noch nicht abgeglichen'),
          sync.error ? el('div', { class: 'error' }, sync.error) : null]
        : [el('strong', {}, 'Nicht eingerichtet'), el('div', { class: 'muted' }, 'Auf jedem Rechner einmal den Google-Drive-Ordner wählen.')]),
    cands.length ? el('div', {},
      el('h3', { style: 'margin:16px 0 6px' }, 'Gefundenes Google Drive'),
      ...cands.map((c) => el('div', { class: 'f-row' }, el('span', {}, c), el('button', { class: 'btn primary small', onclick: () => setSyncDir(c) }, 'Verwenden'))))
      : st.configured ? null : el('div', { class: 'muted', style: 'margin-top:14px' }, 'Kein Google Drive automatisch gefunden. Bitte Pfad eintragen, z. B. Mac: ~/Library/CloudStorage/GoogleDrive-…/Meine Ablage, Windows: G:\\Meine Ablage'),
    el('h3', { style: 'margin:16px 0 6px' }, 'Ordner von Hand'),
    el('div', { class: 'sync-row' }, input, el('button', { class: 'btn', onclick: () => setSyncDir(input.value) }, 'Übernehmen')),
    el('div', { class: 'f-presets' },
      st.configured ? el('button', { class: 'btn primary', onclick: () => syncNow(true) }, 'Jetzt abgleichen') : null,
      st.configured ? el('button', { class: 'btn', onclick: () => setSyncDir('') }, 'Abgleich ausschalten') : null),
    el('div', { class: 'muted' }, 'Voraussetzung: „Google Drive für den Desktop“ ist auf beiden Rechnern installiert und mit demselben Konto angemeldet.'));
}

setInterval(() => { if (syncOn() && document.visibilityState === 'visible') syncNow(false); }, 60 * 1000);
window.addEventListener('focus', () => { if (syncOn() && Date.now() - sync.last > 15000) syncNow(false); });
window.addEventListener('beforeunload', () => {
  if (!syncOn()) return;
  // letzten Stand noch schnell sichern
  fetch('/sync/data?account=' + encodeURIComponent(accountKey()), {
    method: 'PUT', keepalive: true,
    headers: { 'Content-Type': 'application/json', 'X-SportTV': '1' },
    body: JSON.stringify(localPayload()),
  }).catch(() => {});
});

/* ================= Programmfuehrer: Suche und Erinnerungen ================= */

const guide = { status: null, timer: null, filterTimer: null };

function guideChannels() {
  const d = state.data.live;
  if (!d) return [];
  const set = new Set();
  for (const it of d.items) if (it.epg_channel_id && itemVisible('live', it)) set.add(String(it.epg_channel_id));
  return [...set];
}

// EPG-Kennung -> sichtbarer Sender (bevorzugte Variante)
function chanFor(epgId) {
  if (!state.guideMap) {
    state.guideMap = new Map();
    const d = state.data.live;
    if (d) for (const it of d.items) {
      if (!it.epg_channel_id || !itemVisible('live', it)) continue;
      const k = String(it.epg_channel_id);
      if (!state.guideMap.has(k)) state.guideMap.set(k, it);
    }
  }
  return state.guideMap.get(String(epgId)) || null;
}

async function ensureGuide(force) {
  if (!state.creds || !state.data.live) return;
  const { server, username, password } = state.creds;
  try {
    guide.status = await localApi('POST', '/epg/load', { account: accountKey(), server, username, password, channels: guideChannels(), force: !!force });
  } catch (err) {
    guide.status = { status: 'fehler', error: err.message };
  }
  pollGuide();
}

function pollGuide() {
  clearTimeout(guide.timer);
  if (!guide.status || guide.status.status !== 'laedt') return;
  guide.timer = setTimeout(async () => {
    const was = guide.status.status;
    try {
      guide.status = await localApi('GET', '/epg/status?account=' + encodeURIComponent(accountKey()));
    } catch { /* naechster Versuch */ }
    // nur neu aufbauen, wenn die Suche noch "wird geladen" zeigt
    if (was === 'laedt' && guide.status.status !== 'laedt' && state.search && document.querySelector('.sr-section[data-state="loading"]')) renderSearch();
    pollGuide();
  }, 3000);
}
setInterval(() => ensureGuide(), 30 * 60 * 1000);

function guideInfoText(r) {
  const st = r || guide.status || {};
  if (st.status === 'laedt') return `Programmdaten werden geladen ... (${st.megabytes || 0} MB)`;
  if (st.status === 'fehler') return 'Programmsuche nicht verfügbar: ' + (st.error || 'unbekannter Fehler');
  if (!st.loadedAt) return 'Programmdaten noch nicht geladen.';
  return `Programm-Stand: ${new Date(st.loadedAt).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}, `
    + `${st.count} Sendungen auf ${st.channels} Sendern` + (st.error ? ` (letzte Aktualisierung fehlgeschlagen: ${st.error})` : '');
}

function fmtDay(ts) {
  const d = new Date(ts * 1000);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86400000);
  const label = diff === 0 ? 'Heute' : diff === 1 ? 'Morgen' : diff === -1 ? 'Gestern'
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return label + ' ' + fmtTime(ts);
}

function playChannelItem(it) {
  state.livePlaylist = [it];
  playLive(0);
}

function progRow(p, ch, tokens) {
  const now = Date.now() / 1000;
  const running = p.s <= now && p.e > now;
  const when = running ? `läuft · noch ${Math.max(1, Math.round((p.e - now) / 60))} Min.` : fmtDay(p.s);
  const row = el('div', { class: 'row prog-row' + (running ? ' running' : ''), title: running ? 'Jetzt ansehen' : 'Sender jetzt einschalten' },
    el('span', { class: 'when' }, when),
    img(ch.stream_icon, 'logo', ch.name),
    el('div', { class: 'txt' },
      el('div', { class: 'name' }, highlight(p.t, tokens), p.st ? el('span', { class: 'muted' }, ' · ' + p.st) : null),
      el('div', { class: 'now' }, ch.name + (p.d ? ' · ' : ''), p.d ? (p.inDesc ? highlight(p.d, tokens) : p.d) : ''),
      running ? el('div', { class: 'bar' }, el('i', { style: `width:${Math.min(100, ((now - p.s) / (p.e - p.s)) * 100)}%` })) : null),
    running ? el('span', { class: 'live-dot' }, 'LIVE') : bellButton({ ch: p.c, sid: ch.stream_id, name: ch.name, title: p.t, s: p.s, e: p.e }));
  row.addEventListener('click', () => playChannelItem(ch));
  return row;
}

/* ---------- Erinnerungen ---------- */

const remId = (r) => r.ch + '@' + r.s;
const isReminded = (r) => state.reminders.list.some((x) => remId(x) === remId(r));

function saveReminders() {
  state.reminders.t = Date.now();
  store('reminders:' + accountKey(), state.reminders);
  schedulePush(2000);
  const n = document.querySelector('.cat[data-cat="__rem"] .n');
  if (n) n.textContent = state.reminders.list.length;
}

function toggleReminder(r) {
  const id = remId(r);
  const had = isReminded(r);
  state.reminders.list = had ? state.reminders.list.filter((x) => remId(x) !== id) : [...state.reminders.list, { ...r, sid: String(r.sid) }];
  saveReminders();
  if (!had && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  toast(had ? 'Erinnerung entfernt' : `Erinnerung gesetzt: ${fmtDay(r.s)} · ${r.title}`);
  if (state.tab === 'live' && state.cat === '__rem' && !state.search) render();
  return !had;
}

function bellButton(r) {
  const b = el('button', { class: 'bell' + (isReminded(r) ? ' on' : ''), title: 'Erinnern' }, '🔔');
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.classList.toggle('on', toggleReminder(r));
  });
  return b;
}

function remRow(r) {
  const now = Date.now() / 1000;
  const running = r.s <= now && r.e > now;
  const ch = (state.data.live && state.data.live.byId.get(String(r.sid))) || chanFor(r.ch);
  const del = el('button', { class: 'star', title: 'Erinnerung löschen' }, '×');
  del.addEventListener('click', (e) => { e.stopPropagation(); toggleReminder(r); });
  const row = el('div', { class: 'row prog-row' + (running ? ' running' : '') },
    el('span', { class: 'when' }, running ? 'läuft' : fmtDay(r.s)),
    img(ch && ch.stream_icon, 'logo', r.name),
    el('div', { class: 'txt' },
      el('div', { class: 'name' }, r.title),
      el('div', { class: 'now' }, `${r.name} · ${fmtTime(r.s)} - ${fmtTime(r.e)}`)),
    del);
  row.addEventListener('click', () => { if (ch) playChannelItem(ch); });
  return row;
}

function reminderSettings() {
  const lead = el('select', { class: 'search', style: 'flex:none;max-width:200px' },
    [0, 1, 2, 5, 10, 15].map((m) => el('option', { value: m, selected: Number(state.reminders.lead) === m }, m ? `${m} Min. vorher` : 'Bei Beginn')));
  lead.addEventListener('change', () => { state.reminders.lead = Number(lead.value); saveReminders(); });
  const auto = el('input', { type: 'checkbox', checked: !!state.reminders.auto });
  auto.addEventListener('change', () => { state.reminders.auto = auto.checked; saveReminders(); });
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const permBtn = perm === 'default' ? el('button', {
    class: 'btn small',
    onclick: () => Notification.requestPermission().then(() => render()),
  }, 'Systemmitteilungen erlauben') : el('span', { class: 'muted' }, perm === 'granted' ? 'Systemmitteilungen: an' : perm === 'denied' ? 'Systemmitteilungen im Browser blockiert' : '');
  return el('div', { class: 'rem-settings' },
    el('span', { class: 'muted' }, 'Hinweis:'), lead,
    el('label', { class: 'f-item', style: 'flex:none' }, auto, el('span', {}, 'automatisch umschalten')),
    permBtn,
    el('div', { class: 'muted', style: 'flex-basis:100%' }, 'Erinnerungen funktionieren nur, solange die App im Browser geöffnet ist.'));
}

const firedNow = new Set();

function checkReminders() {
  if (!state.creds) return;
  const now = Date.now() / 1000;
  const list = state.reminders.list;
  const keep = list.filter((r) => r.e > now);
  if (keep.length !== list.length) { state.reminders.list = keep; saveReminders(); }
  const lead = (Number(state.reminders.lead) || 0) * 60;
  for (const r of keep) {
    const id = remId(r);
    if (firedNow.has(id) || r.fired) continue;
    if (now >= r.s - lead) {
      firedNow.add(id);
      r.fired = true;
      store('reminders:' + accountKey(), state.reminders);
      fireReminder(r);
    }
  }
}
setInterval(checkReminders, 10000);

let remTimer = null;
function closeReminderBar() {
  clearInterval(remTimer);
  remTimer = null;
  const b = document.getElementById('remBar');
  if (b) b.remove();
}

function switchToReminder(r) {
  closeReminderBar();
  const ch = (state.data.live && state.data.live.byId.get(String(r.sid))) || chanFor(r.ch);
  if (!ch) { toast('Sender nicht gefunden'); return; }
  if (!$('#player').classList.contains('hidden') && !(player.current && player.current.kind === 'live')) closeOverlay('player');
  if (!$('#detail').classList.contains('hidden')) closeOverlay('detail');
  playChannelItem(ch);
}

function fireReminder(r) {
  const startsIn = Math.round((r.s - Date.now() / 1000) / 60);
  const when = startsIn > 0 ? `beginnt in ${startsIn} Min. (${fmtTime(r.s)})` : 'läuft jetzt';
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(r.title, { body: `${when} auf ${r.name}`, tag: remId(r) });
      n.onclick = () => { window.focus(); switchToReminder(r); n.close(); };
    } catch { /* ignorieren */ }
  }
  closeReminderBar();
  const label = el('div', { class: 'muted' });
  const bar = el('div', { id: 'remBar', class: 'rem-bar' },
    el('span', { class: 'rem-ico' }, '🔔'),
    el('div', { class: 'nu-txt' }, el('strong', {}, r.title), el('div', {}, `${when} · ${r.name}`), label),
    el('button', { class: 'btn primary', onclick: () => switchToReminder(r) }, '▶ Umschalten'),
    el('button', { class: 'btn', onclick: closeReminderBar }, 'Schließen'));
  const fs = document.fullscreenElement;
  (fs && fs !== video ? fs : document.body).append(bar);
  if (state.reminders.auto) {
    let left = 10;
    const tick = () => {
      label.textContent = `Schaltet in ${left} s automatisch um`;
      if (left-- <= 0) switchToReminder(r);
    };
    tick();
    remTimer = setInterval(tick, 1000);
  }
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
  loadProgress();
  state.recent = store('recent:' + accountKey()) || { list: [], t: 0 };
  state.reminders = { list: [], t: 0, lead: 2, auto: false, ...(store('reminders:' + accountKey()) || {}) };
  initSync();
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
  loadKind('live').then(() => ensureGuide()).catch(() => {});
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

  if (tab === 'fav' || tab === 'cont') {
    const prefix = tab + ':';
    state.cat = state.cat && state.cat.startsWith(prefix) ? state.cat : prefix + (tab === 'fav' ? 'live' : 'all');
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
    const okSaved = saved && (saved === '__all' || (['__recent', '__rem'].includes(saved) && tab === 'live') || (saved === '__sport' && d.sportIds.size) || (d.catById[saved] && catVisible(tab, saved)));
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
  if (KINDS.includes(state.tab)) store('lastCat:' + state.tab, cat);
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
  if (state.tab === 'cont') {
    const all = contEntries();
    side.append(
      el('div', { class: 'side-group' }, 'Weiter ansehen'),
      catButton('cont:all', 'Alles', all.length),
      catButton('cont:vod', 'Filme', all.filter((e) => e.type === 'vod').length),
      catButton('cont:series', 'Serien', all.filter((e) => e.type === 'series').length));
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

  if (kind === 'live') {
    side.append(el('div', { class: 'side-group' }, 'Persönlich'));
    side.append(catButton('__recent', 'Zuletzt gesehen', state.recent.list.length));
    side.append(catButton('__rem', 'Erinnerungen', state.reminders.list.length));
  }
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
  if (state.tab === 'cont') {
    const f = state.cat.slice(5);
    const items = contEntries().filter((e) => f === 'all' || e.type === f);
    return { kind: 'cont', items, title: 'Weiter ansehen' };
  }
  if (state.tab === 'fav') {
    const kind = state.cat.slice(4);
    return { kind, items: state.favs[kind].map((f) => f.item), title: 'Favoriten: ' + KIND_LABEL[kind] };
  }
  const kind = state.tab;
  const d = state.data[kind];
  const vis = d.items.filter((it) => itemVisible(kind, it));
  if (state.cat === '__rem') {
    return { kind: 'rem', items: [...state.reminders.list].sort((a, b) => a.s - b.s), title: 'Erinnerungen' };
  }
  if (state.cat === '__recent') {
    return { kind, items: state.recent.list.map((r) => d.byId.get(String(r.stream_id)) || r), title: 'Zuletzt gesehen' };
  }
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
  if (KINDS.includes(state.tab) && !state.data[state.tab]) return;
  const { kind, items, title } = currentItems();
  state.view = items;
  state.viewKind = kind;
  state.rendered = 0;
  showPreview(kind === 'live' || kind === 'rem');
  $('#listTitle').textContent = title;
  $('#listCount').textContent = items.length + ' Einträge';
  const list = $('#list');
  list.className = 'list ' + (kind === 'live' || kind === 'rem' ? 'rows' : 'grid');
  list.replaceChildren();
  if (kind === 'rem') list.append(reminderSettings());
  if (!items.length) {
    const msg = kind === 'rem' ? 'Keine Erinnerungen. In der Suche oder im Programm neben dem Player die Glocke anklicken.'
      : state.tab === 'fav' ? 'Noch keine Favoriten. Stern bei einem Eintrag anklicken.'
      : state.tab === 'cont' ? 'Nichts angefangen. Hier erscheinen angefangene Filme und die nächste Folge Ihrer Serien.'
        : 'Keine Einträge (evtl. durch Länderfilter ausgeblendet).';
    list.append(el('div', { class: 'empty' }, msg));
    return;
  }
  renderMore();
}

function renderMore() {
  const { view, viewKind: kind } = state;
  const end = Math.min(view.length, state.rendered + PAGE);
  const frag = document.createDocumentFragment();
  for (let i = state.rendered; i < end; i++) {
    frag.append(kind === 'live' ? liveRow(view[i], view, i) : kind === 'rem' ? remRow(view[i])
      : kind === 'cont' ? contCard(view[i]) : posterCard(kind, view[i]));
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
  const progSection = el('section', { class: 'sr-section' },
    el('div', { class: 'sr-head' }, el('h3', {}, 'Im Programm'), el('span', { class: 'muted' }, 'suche ...')));
  // "Im Programm" direkt nach den Sendern einordnen
  const liveFirst = sections.length && hitsLive(tokens) ? 1 : 0;
  sections.splice(liveFirst, 0, progSection);
  list.replaceChildren(...sections);
  fillProgSection(progSection, raw, tokens, total);
}

const hitsLive = (tokens) => searchKind('live', tokens).length > 0;

async function fillProgSection(box, raw, tokens, otherTotal) {
  const head = $('.sr-head', box);
  let r;
  try {
    r = await localApi('GET', '/epg/search?account=' + encodeURIComponent(accountKey()) + '&q=' + encodeURIComponent(raw));
  } catch (err) {
    head.lastChild.textContent = 'nicht verfügbar: ' + err.message;
    box.dataset.state = 'done';
    return;
  }
  if (state.search !== raw) return;
  const items = (r.results || []).map((p) => ({ p, ch: chanFor(p.c) })).filter((x) => x.ch);
  const info = guideInfoText(r);
  box.dataset.state = r.status === 'laedt' || !r.loadedAt ? 'loading' : 'done';
  if (!items.length) {
    head.lastChild.textContent = r.status === 'bereit' ? 'keine Treffer' : '';
    box.append(el('div', { class: 'muted' }, info));
    if (!otherTotal && r.status === 'bereit') box.replaceWith(el('div', { class: 'empty' }, 'Nichts gefunden.'));
    return;
  }
  head.lastChild.textContent = items.length + (r.total > (r.results || []).length ? '+' : '') + ' Sendungen';
  const key = raw + '|prog';
  const limit = searchLimits[key] || 25;
  box.append(...[
    el('div', { class: 'rows' }, items.slice(0, limit).map((x) => progRow(x.p, x.ch, tokens))),
    items.length > limit ? el('button', {
      class: 'btn small sr-more',
      onclick: () => { searchLimits[key] = limit + 100; renderSearch(); },
    }, `Weitere ${Math.min(100, items.length - limit)} anzeigen`) : null,
    el('div', { class: 'muted guide-info' }, info)].filter(Boolean));
  $('#listCount').textContent = (otherTotal + items.length) + ' Treffer';
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
  let meta = [year, it.rating && Number(it.rating) > 0 ? '★ ' + it.rating : ''].filter(Boolean).join(' · ');
  let pi = null;
  if (kind === 'vod') pi = progInfo(getProg('vod', it.stream_id));
  if (kind === 'series') {
    const sp = state.seriesProg[it.series_id];
    if (sp && sp.ep) meta = 'Zuletzt ' + epLabel(sp.ep) + (meta ? ' · ' + meta : '');
  }
  if (pi && !pi.done) meta = pi.label + (meta ? ' · ' + meta : '');
  return el('div', { class: 'card', title: it.name, onclick: () => (kind === 'series' ? openSeries(it) : openMovie(it)) },
    el('div', { class: 'pwrap' }, img(pic, 'poster', it.name), ...progDecor(pi)),
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
  box.replaceChildren(...rows.map((e) => {
    const upcoming = e.start > now;
    return el('div', { class: 'epg-item' + (e.start <= now && e.stop > now ? ' now' : '') },
      upcoming && it.epg_channel_id ? bellButton({ ch: it.epg_channel_id, sid: it.stream_id, name: it.name, title: e.title, s: e.start, e: e.stop }) : null,
      el('span', { class: 'epg-time' }, e.start ? `${fmtDay(e.start)} - ${fmtTime(e.stop)}` : ''),
      el('strong', {}, e.title),
      e.desc ? el('div', { class: 'epg-desc' }, e.desc) : null);
  }));
}

/* ================= Detailansicht ================= */

function openOverlay(id) { $('#' + id).classList.remove('hidden'); }

let detailRefresh = null;
function closeOverlay(id) {
  $('#' + id).classList.add('hidden');
  if (id === 'player') {
    stopPlayer();
    // Fortschritt in offenen Ansichten aktualisieren
    if (detailRefresh && !$('#detail').classList.contains('hidden')) detailRefresh();
    if (!state.search && ['cont', 'vod', 'series'].includes(state.tab)) {
      const top = $('#listCol').scrollTop;
      renderSidebar();
      render();
      while (state.rendered < state.view.length && $('#listCol').scrollHeight < top + $('#listCol').clientHeight) renderMore();
      $('#listCol').scrollTop = top;
    }
  }
  if (id === 'detail') detailRefresh = null;
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
  body.replaceChildren(el('div', { class: 'empty' }, 'Lade ...'));
  openOverlay('detail');
  let info = {};
  try {
    info = (await api('get_vod_info', { vod_id: it.stream_id })).info || {};
  } catch { /* Beschreibung optional */ }
  const facts = [info.releasedate || info.release_date, info.genre, info.duration, info.rating && Number(info.rating) > 0 && '★ ' + info.rating]
    .filter(Boolean).join(' · ');
  const actions = el('div', { class: 'detail-actions' });
  const state1 = el('div', { class: 'ep-state' });

  function drawActions() {
    const p = getProg('vod', it.stream_id);
    const pi = progInfo(p);
    const resumable = pi && !pi.done;
    state1.textContent = pi ? (pi.done ? '✓ gesehen' : 'Angefangen, ' + pi.label) : '';
    state1.className = 'ep-state' + (pi && pi.done ? ' done' : '');
    actions.replaceChildren(
      el('button', { class: 'btn primary', onclick: () => playMovie(it, facts) }, resumable ? '▶ Weiter ansehen' : '▶ Abspielen'),
      resumable ? el('button', { class: 'btn', onclick: () => playMovie(it, facts, true) }, 'Von vorn') : null,
      el('button', {
        class: 'btn',
        onclick: () => { setSeen('vod', it.stream_id, !(p && p.done)); drawActions(); },
      }, p && p.done ? 'Als ungesehen markieren' : 'Als gesehen markieren'),
      favButton('vod', it));
  }
  drawActions();
  detailRefresh = drawActions;

  body.replaceChildren(
    detailFrame(firstUrl(info.backdrop_path)),
    el('div', { class: 'detail-top' },
      img(info.movie_image || it.stream_icon, 'poster-lg', it.name),
      el('div', {},
        el('h2', {}, it.name),
        el('div', { class: 'muted' }, facts),
        state1,
        el('p', {}, info.plot || info.description || ''),
        info.cast ? el('div', { class: 'muted' }, 'Mit: ' + info.cast) : null,
        info.director ? el('div', { class: 'muted' }, 'Regie: ' + info.director) : null,
        actions)));
}

function episodeRow(series, flat, i, redraw) {
  const e = flat[i];
  const p = getProg('episode', e.id);
  const pi = progInfo(p);
  const mark = el('button', { class: 'ep-mark' + (p && p.done ? ' on' : ''), title: p && p.done ? 'Als ungesehen markieren' : 'Als gesehen markieren' }, '✓');
  mark.addEventListener('click', (ev) => {
    ev.stopPropagation();
    setSeen('episode', e.id, !(p && p.done));
    redraw();
  });
  return el('div', { class: 'episode' + (pi && pi.done ? ' seen' : ''), onclick: () => playEpisode(series, flat, i) },
    el('div', { class: 'thumb' }, img(e.img, 'ep-img', epLabel(e)), ...progDecor(pi)),
    el('div', { class: 'ep-t' },
      el('div', {}, el('strong', {}, 'E' + e.num + '  '), e.title || epLabel(e)),
      e.plot ? el('div', { class: 'ep-plot' }, e.plot) : null,
      pi ? el('div', { class: 'ep-state' + (pi.done ? ' done' : '') }, pi.label) : null),
    el('span', { class: 'ep-d' }, e.dur),
    mark);
}

async function openSeries(it) {
  const body = $('#detailBody');
  body.replaceChildren(el('div', { class: 'empty' }, 'Lade Serie ...'));
  openOverlay('detail');
  let data;
  try {
    data = await getSeriesInfo(it.series_id);
  } catch (err) {
    body.replaceChildren(el('div', { class: 'empty' }, 'Fehler: ' + err.message));
    return;
  }
  const info = data.info || {};
  const flat = flatEpisodes(data);
  const seasons = [...new Set(flat.map((e) => e.season))];
  const name = info.name || it.name;
  const series = { ...seriesPlain(it, name), cover: it.cover || info.cover || '' };
  const seasonBar = el('div', { class: 'seasons' });
  const epList = el('div', { class: 'episodes' });
  const actions = el('div', { class: 'detail-actions' });
  const summary = el('div', { class: 'ep-state' });
  let current = null;

  function showSeason(s) {
    current = s;
    seasonBar.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('primary', b.dataset.s === s);
      const eps = flat.filter((e) => e.season === b.dataset.s);
      const allSeen = eps.length && eps.every((e) => (getProg('episode', e.id) || {}).done);
      b.textContent = 'Staffel ' + b.dataset.s + (allSeen ? ' ✓' : '');
    });
    epList.replaceChildren(...flat.map((e, i) => [e, i]).filter(([e]) => e.season === s).map(([, i]) => episodeRow(series, flat, i, redraw)));
  }

  function drawActions() {
    const ci = continueIndex(series.series_id, flat);
    const seen = flat.filter((e) => (getProg('episode', e.id) || {}).done).length;
    summary.textContent = flat.length ? `${seen} von ${flat.length} Folgen gesehen` : '';
    summary.className = 'ep-state' + (seen && seen === flat.length ? ' done' : '');
    let label = '';
    if (ci >= 0) {
      const p = progInfo(getProg('episode', flat[ci].id));
      label = p && !p.done ? `▶ Weiter: ${epLabel(flat[ci])} (${p.label})`
        : ci === 0 && !seen ? `▶ Abspielen: ${epLabel(flat[0])}` : `▶ Nächste: ${epLabel(flat[ci])}`;
    }
    actions.replaceChildren(
      ci >= 0 ? el('button', { class: 'btn primary', onclick: () => playEpisode(series, flat, ci) }, label)
        : flat.length ? el('button', { class: 'btn primary', onclick: () => playEpisode(series, flat, 0) }, '▶ Von vorn') : null,
      favButton('series', it));
    return ci;
  }

  function redraw() {
    drawActions();
    showSeason(current);
  }

  for (const s of seasons) {
    seasonBar.append(el('button', { class: 'btn small', 'data-s': s, onclick: () => showSeason(s) }, 'Staffel ' + s));
  }
  const ci = drawActions();
  detailRefresh = redraw;

  body.replaceChildren(
    detailFrame(firstUrl(info.backdrop_path) || firstUrl(it.backdrop_path)),
    el('div', { class: 'detail-top' },
      img(info.cover || it.cover, 'poster-lg', name),
      el('div', {},
        el('h2', {}, name),
        el('div', { class: 'muted' }, [info.releaseDate || info.releasedate, info.genre, info.rating && Number(info.rating) > 0 && '★ ' + info.rating].filter(Boolean).join(' · ')),
        summary,
        el('p', {}, info.plot || it.plot || ''),
        info.cast ? el('div', { class: 'muted' }, 'Mit: ' + info.cast) : null,
        actions)),
    seasons.length ? seasonBar : el('div', { class: 'empty' }, 'Keine Folgen vorhanden.'),
    epList);
  if (seasons.length) showSeason(ci >= 0 ? flat[ci].season : seasons[0]);
}

/* ================= Player ================= */

const video = el('video', { controls: true, autoplay: true, playsinline: true });
const player = { hls: null, ts: null, current: null, mount: null, saveTimer: 0, triedFallback: false };
const role = (r) => (player.mount ? $(`[data-role="${r}"]`, player.mount) : null);

function stopPlayer() {
  clearTimeout(player.retryTimer);
  player.retryTimer = null;
  if (player.current && player.current.kind !== 'live') { saveCurrentPos(); schedulePush(1500); }
  cancelNext();
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

function setMsg(msg, action) {
  const m = role('msg');
  if (!m) return;
  m.replaceChildren(msg || '');
  if (action) m.append(' ', el('button', { class: 'btn small', onclick: action.fn }, action.label));
}

// Hinweis direkt im Videobild (auch im Vollbild sichtbar)
function slotNote(text) {
  const slot = role('slot');
  if (!slot) return;
  let n = $('.slot-note', slot);
  if (!text) { if (n) n.remove(); return; }
  if (!n) { n = el('div', { class: 'slot-note' }); slot.append(n); }
  n.textContent = text;
}

function mountPlayer(target) {
  player.mount = target;
  role('slot').replaceChildren(video);
}

function startEngine(url, ext, live, current) {
  stopPlayer();
  player.current = current;
  player.lastT = -1;
  player.lastProg = Date.now();
  player.startT = null;
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

/* ---------- Automatisch neu verbinden ---------- */

const RETRY_DELAYS = [1, 2, 4, 8, 15];

function scheduleReconnect(reason) {
  const cur = player.current;
  if (!cur || !cur.restart || player.retryTimer) return;
  if (player.attempts >= RETRY_DELAYS.length) {
    slotNote('');
    setMsg(cur.kind === 'live'
      ? 'Verbindung verloren. Sender evtl. offline oder vom Anbieter gesperrt.'
      : 'Verbindung verloren.', { label: 'Erneut versuchen', fn: () => { player.attempts = 0; cur.restart(); } });
    return;
  }
  const d = RETRY_DELAYS[player.attempts++];
  slotNote(`${reason} – verbinde neu in ${d} s (Versuch ${player.attempts}/${RETRY_DELAYS.length})`);
  player.retryTimer = setTimeout(() => {
    player.retryTimer = null;
    if (player.current === cur) cur.restart();
  }, d * 1000);
}

// Waechter: steht das Bild laenger als 12 s, neu verbinden
setInterval(() => {
  const cur = player.current;
  const now = Date.now();
  if (!cur || video.paused || video.ended || player.retryTimer || $('#nextUp')) {
    player.lastT = video.currentTime;
    player.lastProg = now;
    return;
  }
  if (video.currentTime !== player.lastT) {
    player.lastT = video.currentTime;
    player.lastProg = now;
    if (player.startT === null) player.startT = video.currentTime;
    if (player.attempts && video.currentTime - player.startT > 20) player.attempts = 0;
    return;
  }
  if (now - player.lastProg > 12000) scheduleReconnect('Bild steht');
}, 2000);

video.addEventListener('playing', () => slotNote(''));

function onPlaybackError(live) {
  const cur = player.current;
  if (!cur) return;
  if (!live && video.error && video.error.code === 4) {
    setMsg('Datei kann im Browser nicht abgespielt werden (z. B. MKV mit nicht unterstütztem Ton). „Link kopieren“ und in VLC öffnen.');
    return;
  }
  if (live && !player.triedFallback && !player.attempts) {
    player.triedFallback = true;
    const other = state.liveFormat === 'm3u8' ? 'ts' : 'm3u8';
    setMsg(`Stream-Fehler, versuche Format ${other.toUpperCase()} ...`);
    state.liveFormat = other;
    store('liveFormat:' + accountKey(), other);
    setTimeout(() => { if (player.current === cur) cur.restart(); }, 500);
    return;
  }
  scheduleReconnect('Verbindung unterbrochen');
}

function setupHead(title, sub, kind, item) {
  role('title').textContent = title;
  role('sub').textContent = sub || '';
  const live = kind === 'live';
  for (const r of ['prev', 'next', 'format', 'last']) role(r).classList.toggle('hidden', !live);
  role('quality').classList.add('hidden');
  const fav = role('fav');
  fav.classList.toggle('hidden', !item);
  if (item) fav.classList.toggle('on', isFav(kind, itemId(kind, item)));
}

function playLive(index, retry) {
  const list = state.livePlaylist || [];
  const it = list[index];
  if (!it) return;
  if (!retry) {
    player.triedFallback = false;
    player.attempts = 0;
    // fuer "Letzter Sender" merken
    const prev = player.lastPlayedLive;
    if (prev && String(prev.item.stream_id) !== String(it.stream_id)) player.lastLive = prev;
    player.lastPlayedLive = { list, index, item: it };
    addRecent(it);
  }
  const inPreview = !$('#preview').classList.contains('hidden') && $('#player').classList.contains('hidden');
  const target = inPreview ? $('#preview') : $('#playerBox');
  const ext = state.liveFormat;
  const url = streamUrl('live', it.stream_id, ext);
  const cur = { kind: 'live', index, item: it, url, list };
  cur.restart = () => { state.livePlaylist = list; playLive(index, true); };
  startEngine(url, ext, true, cur);
  mountPlayer(target);
  if (!inPreview) openOverlay('player');
  setupHead(it.name, `Live · ${ext.toUpperCase()} · ${index + 1}/${list.length}`, 'live', it);
  const lastBtn = role('last');
  lastBtn.disabled = !player.lastLive;
  lastBtn.title = player.lastLive ? 'Zurück zu: ' + player.lastLive.item.name + ' (Taste Z)' : 'Noch kein vorheriger Sender';
  const vars = state.variants.get(String(it.stream_id));
  const qs = role('quality');
  if (vars && vars.length > 1) {
    qs.replaceChildren(...vars.map((v) => el('option', { value: v.stream_id, selected: String(v.stream_id) === String(it.stream_id) }, v._q.label)));
    qs.classList.remove('hidden');
  }
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('playing', r.dataset.sid === String(it.stream_id)));
  const row = document.querySelector(`.row[data-sid="${it.stream_id}"]`);
  if (row && inPreview) row.scrollIntoView({ block: 'nearest' });
  showEpg(it, role('epg'));
}

function playMovie(it, sub, fromStart, retry) {
  if (!retry) player.attempts = 0;
  const ext = it.container_extension || 'mp4';
  const id = String(it.stream_id);
  if (fromStart) updateProg('vod', id, { pos: 0, done: false });
  updateProg('vod', id, { item: plainItem(it), hide: false });
  saveProgress();
  const url = streamUrl('vod', id, ext);
  startEngine(url, ext, false, { kind: 'vod', id, item: it, url, restart: () => playMovie(it, sub, false, true) });
  mountPlayer($('#playerBox'));
  openOverlay('player');
  setupHead(it.name, sub || '', 'vod', it);
  role('epg').replaceChildren();
}

function playEpisode(series, flat, idx, retry) {
  const e = flat[idx];
  if (!e) return;
  if (!retry) player.attempts = 0;
  const { plot, ...epShort } = e;
  const next = flat[idx + 1] ? (({ plot: _p, ...n }) => n)(flat[idx + 1]) : null;
  state.seriesProg[series.series_id] = { series, ep: epShort, next, t: Date.now() };
  saveProgress();
  const url = streamUrl('series', e.id, e.ext);
  startEngine(url, e.ext, false, { kind: 'episode', id: e.id, item: null, url, series, flat, idx, restart: () => playEpisode(series, flat, idx, true) });
  mountPlayer($('#playerBox'));
  openOverlay('player');
  setupHead(series.name, `${epLabel(e)}${e.title ? ' · ' + e.title : ''}`, 'episode', null);
  role('epg').replaceChildren();
}

// beim Start an gespeicherter Stelle fortsetzen
video.addEventListener('loadedmetadata', () => {
  const cur = player.current;
  if (!cur || cur.kind === 'live') return;
  const p = getProg(cur.kind, cur.id);
  if (p && !p.done && p.pos > 30 && (!isFinite(video.duration) || p.pos < video.duration - 30)) {
    video.currentTime = p.pos;
    toast('Fortsetzen bei ' + Math.floor(p.pos / 60) + ' Min.');
  }
});

function saveCurrentPos() {
  const cur = player.current;
  if (!cur || cur.kind === 'live' || !video.currentTime) return;
  const dur = isFinite(video.duration) ? Math.floor(video.duration) : 0;
  updateProg(cur.kind, cur.id, { pos: Math.floor(video.currentTime), dur });
  if (cur.kind === 'episode' && state.seriesProg[cur.series.series_id]) state.seriesProg[cur.series.series_id].t = Date.now();
  saveProgress();
}

video.addEventListener('timeupdate', () => {
  const now = Date.now();
  if (now - player.saveTimer < 5000) return;
  player.saveTimer = now;
  saveCurrentPos();
});
video.addEventListener('pause', saveCurrentPos);

video.addEventListener('ended', () => {
  const cur = player.current;
  if (!cur || cur.kind === 'live') return;
  const dur = isFinite(video.duration) ? Math.floor(video.duration) : 0;
  updateProg(cur.kind, cur.id, { pos: dur, dur, done: true });
  saveProgress();
  if (cur.kind === 'episode' && cur.flat[cur.idx + 1]) {
    if (document.fullscreenElement === video) document.exitFullscreen().catch(() => {});
    startNextCountdown(cur);
  }
});

// Naechste Folge automatisch starten (10 Sekunden Countdown)
let nextTimer = null;
function cancelNext() {
  clearInterval(nextTimer);
  nextTimer = null;
  const n = document.getElementById('nextUp');
  if (n) n.remove();
}

function startNextCountdown(cur) {
  cancelNext();
  const e = cur.flat[cur.idx + 1];
  let left = 10;
  const label = el('div', { class: 'muted' });
  const go = () => { cancelNext(); playEpisode(cur.series, cur.flat, cur.idx + 1); };
  const box = el('div', { id: 'nextUp', class: 'nextup' },
    img(e.img, 'ep-img', epLabel(e)),
    el('div', { class: 'nu-txt' },
      el('div', { class: 'muted' }, 'Nächste Folge'),
      el('strong', {}, `${epLabel(e)}${e.title ? ' · ' + e.title : ''}`),
      label),
    el('div', { class: 'nu-btns' },
      el('button', { class: 'btn primary', onclick: go }, '▶ Jetzt'),
      el('button', { class: 'btn', onclick: cancelNext }, 'Abbrechen')));
  const tick = () => {
    label.textContent = `startet in ${left} s`;
    if (left-- <= 0) go();
  };
  tick();
  nextTimer = setInterval(tick, 1000);
  role('slot').append(box);
}

function stepChannel(delta) {
  const cur = player.current;
  if (!cur || cur.kind !== 'live') return;
  const list = cur.list || state.livePlaylist || [];
  if (!list.length) return;
  state.livePlaylist = list;
  playLive((cur.index + delta + list.length) % list.length);
}

function jumpBack() {
  const l = player.lastLive;
  if (!l) { toast('Noch kein vorheriger Sender'); return; }
  state.livePlaylist = l.list;
  const i = l.list[l.index] && String(l.list[l.index].stream_id) === String(l.item.stream_id) ? l.index : l.list.indexOf(l.item);
  if (i < 0) { state.livePlaylist = [l.item]; playLive(0); return; }
  playLive(i);
}

function addRecent(it) {
  const plain = plainItem(it);
  const list = state.recent.list.filter((r) => String(r.stream_id) !== String(it.stream_id));
  list.unshift(plain);
  state.recent = { list: list.slice(0, 30), t: Date.now() };
  store('recent:' + accountKey(), state.recent);
  schedulePush(5000);
  if (state.tab === 'live' && state.cat === '__recent') {
    const n = document.querySelector('.cat[data-cat="__recent"] .n');
    if (n) n.textContent = state.recent.list.length;
  }
}

function goFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else (role('slot') || video).requestFullscreen().catch(() => {});
}

// Knoepfe in Vorschau und grossem Player
for (const box of [$('#preview'), $('#playerBox')]) {
  box.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-role="quality"]');
    const cur = player.current;
    if (!sel || !cur || cur.kind !== 'live') return;
    const v = (state.variants.get(String(cur.item.stream_id)) || []).find((x) => String(x.stream_id) === sel.value);
    if (!v) return;
    const nl = cur.list.slice();
    nl[cur.index] = v;
    state.livePlaylist = nl;
    player.lastPlayedLive = null;
    playLive(cur.index);
    toast('Qualität: ' + v._q.label);
  });
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
      case 'last': jumpBack(); break;
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
    else if (overlayOpen('syncDlg')) closeOverlay('syncDlg');
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
  if (e.key.toLowerCase() === 'z' || e.key === 'Backspace') {
    if (player.lastLive) { e.preventDefault(); jumpBack(); }
  }
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
