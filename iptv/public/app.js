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

// Kennwort der eigenen Oberflaeche (setzt der lokale Server beim Ausliefern ein)
const TOKEN = (document.querySelector('meta[name="sporttv-token"]') || {}).content || '';
const proxied = (url) => '/proxy?url=' + encodeURIComponent(url) + '&t=' + TOKEN;

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

// Schwerpunkt im Live TV: Fussball und Formel 1
const FOOTBALL_RE = /fu(ss|ß)ball|football|soccer|bundesliga|\b[23]\.?\s?liga\b|champions\s?league|europa\s?league|conference\s?league|\buefa\b|\bfifa\b|\bdfb\b|pokal|premier\s?league|la\s?liga|serie\s?a\b|ligue\s?1|eredivisie|s[uü]per\s?lig|\bmls\b|sportdigital|\bdazn\b|konferenz/i;
const F1_RE = /\bf1\b|formel\s?1|formula\s?1|grand\s?prix/i;
const isFocus = (s) => FOOTBALL_RE.test(s) || F1_RE.test(s);

// Hochgestellte Zeichen (ᴴᴰ, ⁴ᴷ, ᴿᴬᵂ ...) in normale Buchstaben umwandeln
const SUP = {
  'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G', 'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L', 'ᴹ': 'M', 'ᴺ': 'N',
  'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R', 'ᵀ': 'T', 'ᵁ': 'U', 'ⱽ': 'V', 'ᵂ': 'W', 'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
  'ᶠ': 'F', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r',
  'ˢ': 'S', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z', 'ꜰ': 'F', 'ʜ': 'H', 'ᴅ': 'D', 'ᴋ': 'K', 'ᴘ': 'P',
  'ᶦ': 'I', 'ᶧ': 'I', 'ᵎ': 'I', 'ᶥ': 'I', 'ᶫ': 'L', 'ᶰ': 'N', 'ᶸ': 'U', 'ᴲ': 'E', 'ᴻ': 'N', 'ᴭ': 'AE', 'ᶛ': 'A', 'ᵊ': 'E',
  'ᵅ': 'A', 'ᵋ': 'E', 'ᶿ': 'TH', 'ᵝ': 'B', 'ᵞ': 'G', 'ᵟ': 'D', 'ᵠ': 'PH', 'ᵡ': 'X', 'ꟹ': 'OE', 'ʶ': 'R', 'ᶤ': 'I', 'ᶨ': 'J', 'ᶬ': 'M',
  'ᶮ': 'N', 'ᶯ': 'N', 'ᶴ': 'SH', 'ᶹ': 'V', 'ᶺ': 'V', 'ᶼ': 'Z', 'ᶽ': 'Z', 'ᶾ': 'ZH', 'ᴯ': 'B', 'ᴬ̲': 'A',
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+',
};
const SUP_RE = new RegExp('[' + Object.keys(SUP).join('') + ']+', 'g');
const supText = (s) => String(s || '').replace(SUP_RE, (m) => ' ' + [...m].map((c) => SUP[c] || c).join('').toUpperCase() + ' ');
const MARKS_RE = /[◉●○◎◆◇■□▪▫★☆✪✦✧•·]+/g;

// Kategorienamen: hochgestellte Zeichen lesbar, Markierungen weg
function catLabel(name) {
  return supText(name).replace(MARKS_RE, ' ').replace(/\s+/g, ' ').trim();
}

// Sender: Name ohne Qualitaetszusaetze + Abzeichen (UHD, HD, RAW ...)
const CHIP_WORDS = ['UHD', '4K', 'FHD', 'HD', 'SD', 'RAW', 'HDR', 'DV', 'HEVC', '50FPS', 'VIP'];
function liveLabel(name) {
  const raw = String(name || '');
  const chips = [];
  let text = raw.replace(SUP_RE, (m) => {
    const t = [...m].map((c) => SUP[c] || c).join('').toUpperCase();
    for (const w of t.split(/[^A-Z0-9]+/)) if (CHIP_WORDS.includes(w) && !chips.includes(w)) chips.push(w);
    return ' ';
  });
  text = text.replace(MARKS_RE, ' ').replace(/\s*[/|]\s*$/, '').replace(/\s+/g, ' ').trim();
  return { text: text || raw, chips };
}

function chipEls(chips) {
  return chips.slice(0, 2).map((c) => el('span', { class: 'qchip' }, c));
}

// Anzeigename fuer Filme/Serien: Kennungen vorne ("DE - ", "|DE| ", "4K-TOP - ", "4K-DE-DV - ")
// und Anhaengsel hinten ("(2026)", "(US)", "[2024]") weglassen
function displayName(name) {
  let n = supText(name).replace(MARKS_RE, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const before = n;
    n = n.replace(/^[|[]\s*[A-Za-z]{2,3}\s*[|\]]\s*/, '');
    n = n.replace(/^(?=[A-Z0-9+-]*[A-Z])[A-Z0-9]{2,5}(?:[-+][A-Z0-9]{2,5})*\s+[-–|»]\s+/, '');
    n = n.replace(/^([A-Za-z]{2,3})\s*:\s*/, (m, c) => (TAG_LABELS[(TAG_ALIAS[c.toUpperCase()] || c.toUpperCase())] ? '' : m));
    if (n === before) break;
  }
  const TAIL = /\s*[([]\s*(?:(?:19|20)\d{2}|[A-Z]{2,3}|multi[- ]?subs?|subs?|dubbed|dub|omu|omdu|ov|ger(?:man)?|deu(?:tsch)?|eng(?:lish)?|uncut|extended|4k|uhd|hd|fhd|hdr|dv)\s*[)\]]\s*$/i;
  for (let i = 0; i < 5; i++) n = n.replace(TAIL, '');
  n = n.trim();
  return n || String(name || '');
}

const is4k = (name) => /\b(4K|UHD|2160P?)\b/i.test(supText(name));

function yearOf(it) {
  for (const c of [it.year, it.releaseDate, it.releasedate, it.release_date]) {
    const m = String(c || '').match(/\b(19\d{2}|20\d{2})\b/);
    if (m) return Number(m[1]);
  }
  // Jahr im Titel nur, wenn plausibel ("Blade Runner 2049" ist kein Erscheinungsjahr)
  const max = new Date().getFullYear() + 1;
  const name = String(it.name || '').replace(/\s*[([]\s*[A-Z]{2,3}\s*[)\]]\s*$/, '');
  const m = name.match(/[([](19\d{2}|20\d{2})[)\]]/) || name.match(/[\s-](19\d{2}|20\d{2})\s*$/);
  const y = m ? Number(m[1]) : 0;
  return y >= 1900 && y <= max ? y : 0;
}

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
const SCRIPT_TAGS = [
  [/[\u0600-\u06FF\u0750-\u077F]/, 'AR'], [/[\u0400-\u04FF]/, 'CYR'], [/[\u0590-\u05FF]/, 'IL'],
  [/[\u0370-\u03FF]/, 'GR'], [/[\u0E00-\u0E7F]/, 'TH'], [/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/, 'ASIA'],
];
TAG_LABELS.CYR = 'Kyrillische Schrift';

function detectTag(name, prefixOnly) {
  const s = supText(name);
  // fremde Schrift (z. B. arabische Kategorien ohne Kennung)
  const letters = s.replace(/[^\p{L}]/gu, '');
  for (const [re, code] of SCRIPT_TAGS) {
    const hits = (letters.match(new RegExp(re.source, 'g')) || []).length;
    if (letters && hits / letters.length > 0.3) return code;
  }
  // Anhaengsel hinten, z. B. "Titel (2026) (US)"
  const tail = s.replace(/\s*[([]\s*(?:19|20)\d{2}\s*[)\]]\s*$/, '').match(/[([]\s*([A-Z]{2,3})\s*[)\]]\s*$/);
  if (tail) {
    const c = TAG_ALIAS[tail[1]] || tail[1];
    if (TAG_LABELS[c] && !NOT_TAGS.has(c)) return c;
  }
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
state.liveView = store('liveView') || 'list';
state.gridDay = 0;
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
      it._n = norm(supText(it.name));
      it._4k = kind !== 'live' && is4k(it.name);
      // weitere durchsuchbare Felder (bei Serien oft vorhanden)
      it._x = norm([it.genre, it.cast, it.director, it.plot].filter(Boolean).join(' '));
      it._tag = detectTag(it.name, true);
    }
    // Sport nur im Live TV; Schwerpunkt Fussball/Formel 1
    const focusIds = new Set(kind === 'live' ? catList.filter((c) => isFocus(c.category_name)).map((c) => c.category_id) : []);
    const sportIds = new Set(kind === 'live' ? catList.filter((c) => SPORT_RE.test(c.category_name) && !focusIds.has(c.category_id)).map((c) => c.category_id) : []);
    if (kind === 'live') {
      for (const it of itemList) {
        it._dk = dupKey(it);
        it._q = qualityOf(it.name);
        it._fb = FOOTBALL_RE.test(it.name) || (focusIds.has(it.category_id) && FOOTBALL_RE.test((catById[it.category_id] || {}).category_name || ''));
        it._f1 = F1_RE.test(it.name) || (focusIds.has(it.category_id) && F1_RE.test((catById[it.category_id] || {}).category_name || ''));
      }
    } else {
      for (const it of itemList) {
        it._year = yearOf(it);
        it._added = Number(it.added || it.last_modified) || 0;
        it._gk = norm(displayName(it.name)) + '|' + (it._year || '');
        it._qv = guessQuality(it.name + ' ' + ((catById[it.category_id] || {}).category_name || ''));
      }
    }
    const byId = new Map(itemList.map((it) => [itemId(kind, it), it]));
    state.data[kind] = { cats: catList, catById, items: itemList, sportIds, focusIds, byId };
    computeDupes();
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
    minQ: Number(f.minQ) || 0, showUnknownQ: f.showUnknownQ !== false,
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
  if (kind !== 'live' && !qualityOk(kind, it)) return false;
  return !(it._tag && state.filter.tags.includes(it._tag));
}

/* ---------- Qualitaet von Filmen/Serien (Name + Kategorie, genauer aus den Details) ---------- */
// 4 = 4K, 3 = 1080p, 2 = 720p, 1 = SD, 0 = unbekannt
const QLABEL = { 4: '4K', 3: '1080p', 2: '720p', 1: 'SD' };
function guessQuality(text) {
  const t = norm(supText(text));
  if (/\b(4k|uhd|2160p?|ultra ?hd|8k)\b/.test(t)) return 4;
  if (/\b(1080[pi]?|fhd|full ?hd|blu ?ray|bdrip|brrip|bd ?remux|remux)\b/.test(t)) return 3;
  if (/\b720p?\b/.test(t)) return 2;
  if (/\b(sd|480p?|576p?|dvdrip|dvd ?rip|xvid|divx|cam|hdcam|telesync|tsrip)\b/.test(t)) return 1;
  return 0;
}
function qualityFromRes(w, h) {
  w = Number(w) || 0; h = Number(h) || 0;
  if (!w && !h) return 0;
  if (w >= 3000 || h >= 2000) return 4;
  if (w >= 1800 || h >= 1000) return 3;
  if (w >= 1200 || h >= 700) return 2;
  return 1;
}
function qualityOf2(kind, it) {
  const exact = state.res && state.res[kind + ':' + itemId(kind, it)];
  return exact || it._qv || 0;
}
function qualityOk(kind, it) {
  const min = state.filter.minQ || 0;
  if (!min) return true;
  const q = qualityOf2(kind, it);
  if (!q) return state.filter.showUnknownQ !== false;
  return q >= min;
}
function rememberRes(kind, it, video) {
  if (!video) return 0;
  const q = qualityFromRes(video.width, video.height);
  if (!q) return 0;
  state.res = state.res || {};
  const k = kind + ':' + itemId(kind, it);
  if (state.res[k] !== q) { state.res[k] = q; store('res:' + accountKey(), state.res); }
  return q;
}

function itemVisible(kind, it) {
  if (!baseVisible(kind, it)) return false;
  if (!state.filter.dedupe) return true;
  if (kind === 'live') return !state.dupHidden.has(String(it.stream_id));
  const h = state.titleHidden && state.titleHidden[kind];
  return !(h && h.has(itemId(kind, it)));
}

// Filme/Serien: gleicher Titel (+ Jahr) = eine Karte; bevorzugt deutsche Fassung, nicht 4K (ausser "Hoechste Qualitaet")
function computeTitleDupes() {
  state.titleHidden = { vod: new Set(), series: new Set() };
  state.titleVariants = { vod: new Map(), series: new Map() };
  const want4k = state.filter.quality === 'best';
  for (const kind of ['vod', 'series']) {
    const d = state.data[kind];
    if (!d) continue;
    const groups = new Map();
    for (const it of d.items) {
      if (!it._gk || !baseVisible(kind, it)) continue;
      let g = groups.get(it._gk);
      if (!g) groups.set(it._gk, (g = []));
      g.push(it);
    }
    const pic = (it) => (/^https?:/i.test((kind === 'series' ? it.cover : it.stream_icon) || '') ? 1 : 0);
    const score = (it) => (it._tag === 'DE' || /^\W*DE\b/i.test(it.name) ? 4 : 0) + (it._tag && it._tag !== 'DE' ? -2 : 0)
      + (it._4k ? (want4k ? 2 : -1) : 0) + pic(it);
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const sorted = [...g].sort((a, b) => score(b) - score(a));
      const best = sorted[0];
      for (const it of g) {
        state.titleVariants[kind].set(itemId(kind, it), sorted);
        if (it !== best) state.titleHidden[kind].add(itemId(kind, it));
      }
    }
  }
}

function variantLabel(it) {
  const parts = [];
  parts.push(it._4k ? '4K' : 'Standard');
  if (it._tag) parts.push(it._tag);
  const cat = state.data.vod && state.data.vod.catById[it.category_id] || state.data.series && state.data.series.catById[it.category_id];
  return parts.join(' · ') + (cat ? ` – ${catLabel(cat.category_name)}` : '');
}

// Auswahl der Fassung in der Detailansicht
function variantPicker(kind, it) {
  const vars = state.titleVariants && state.titleVariants[kind] && state.titleVariants[kind].get(itemId(kind, it));
  if (!vars || vars.length < 2) return null;
  return el('div', { class: 'variants' },
    el('span', { class: 'muted' }, 'Fassung:'),
    vars.map((v) => el('button', {
      class: 'btn small' + (v === it ? ' primary' : ''),
      title: v.name,
      onclick: () => { if (v !== it) (kind === 'series' ? openSeries(v) : openMovie(v)); },
    }, variantLabel(v))));
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
  computeTitleDupes();
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
  ($('.lbl', b) || b).textContent = n ? `Länderfilter (${n} aus)` : 'Länderfilter';
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
      state.cat = defaultCat(state.tab, d);
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

// Kennung dieses Browsers (Safari und Chrome auf demselben Rechner bekommen je eine eigene Abgleich-Datei)
const CLIENT_ID = (() => {
  let id = store('clientId');
  if (!id) { id = Math.random().toString(36).slice(2, 10); store('clientId', id); }
  return id;
})();

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
      minQ: Number(rfi.minQ) || 0, showUnknownQ: rfi.showUnknownQ !== false,
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
    const r = await syncApi('GET', 'data?account=' + acc + '&client=' + CLIENT_ID);
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
    await syncApi('PUT', 'data?account=' + acc + '&client=' + CLIENT_ID, localPayload());
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
  ($('.lbl', b) || b).textContent = !syncOn() ? 'Abgleich' : sync.busy ? 'Abgleich ...' : sync.error ? 'Abgleich: Fehler' : 'Abgleich an';
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
  fetch('/sync/data?account=' + encodeURIComponent(accountKey()) + '&client=' + CLIENT_ID, {
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
    if (was === 'laedt' && guide.status.status !== 'laedt') refreshNow();
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

/* ================= Programmraster ================= */

const EG = { px: 4, chW: 210, span: 24 * 3600, chunk: 50 };
let gridObserver = null;

$('#viewToggle').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b || b.dataset.view === state.liveView) return;
  state.liveView = b.dataset.view;
  store('liveView', state.liveView);
  render();
});

function gridStartFor(dayOffset) {
  if (!dayOffset) return Math.floor((Date.now() / 1000 - 2 * 3600) / 1800) * 1800;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.getTime() / 1000;
}

const xOf = (t) => ((t - state.grid.from) / 60) * EG.px;

function gridPlay(it) {
  const g = state.grid;
  state.livePlaylist = g.items;
  playLive(Math.max(0, g.items.indexOf(it)));
}

function markGridPlaying() {
  const sid = player.current && player.current.kind === 'live' ? String(player.current.item.stream_id) : '';
  document.querySelectorAll('.eg-row').forEach((r) => r.classList.toggle('playing', r.dataset.sid === sid));
}

function scrollGridToNow() {
  const sc = $('#egScroll');
  if (sc && state.grid) sc.scrollLeft = Math.max(0, xOf(Date.now() / 1000) - 30 * EG.px);
}

function renderGrid(items) {
  state.gridMode = true;
  const day = state.gridDay || 0;
  const from = gridStartFor(day);
  const to = from + EG.span;
  state.grid = { items, from, to, next: 0, busy: false };
  const list = $('#list');
  list.className = 'list';
  list.replaceChildren();

  const days = [0, 1, 2, 3].map((o) => {
    const d = new Date();
    d.setDate(d.getDate() + o);
    const label = o === 0 ? 'Heute' : o === 1 ? 'Morgen' : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return el('button', { class: 'btn small' + (o === day ? ' primary' : ''), onclick: () => { state.gridDay = o; render(); } }, label);
  });
  const nowBtn = el('button', {
    class: 'btn small',
    onclick: () => { if (state.gridDay) { state.gridDay = 0; render(); } else scrollGridToNow(); },
  }, 'Jetzt');
  const bar = el('div', { class: 'grid-bar' }, ...days, nowBtn, el('span', { class: 'muted eg-info', id: 'egInfo' }, guideInfoText()));

  const width = EG.chW + (EG.span / 60) * EG.px;
  const head = el('div', { class: 'eg-head', style: `width:${width}px` }, el('div', { class: 'eg-corner' }, 'Sender'));
  for (let t = from; t < to; t += 1800) {
    const d = new Date(t * 1000);
    const midnight = d.getHours() === 0 && d.getMinutes() === 0;
    head.append(el('div', { class: 'eg-tick' + (midnight ? ' day' : ''), style: `left:${EG.chW + xOf(t)}px` },
      midnight ? d.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + fmtTime(t) : fmtTime(t)));
  }
  const rows = el('div', { class: 'eg-rows', style: `width:${width}px` });
  const now = Date.now() / 1000;
  if (now > from && now < to) {
    rows.append(el('div', { class: 'eg-now', style: `left:${EG.chW + xOf(now)}px` }));
    head.append(el('div', { class: 'eg-now head', style: `left:${EG.chW + xOf(now)}px` }));
  }
  const sentinel = el('div', { class: 'eg-sentinel' });
  const scroller = el('div', { class: 'epg-grid', id: 'egScroll' }, head, rows, sentinel);
  list.append(bar, scroller);
  state.grid.rowsEl = rows;
  if (!items.length) { rows.append(el('div', { class: 'empty' }, 'Keine Sender in dieser Kategorie.')); return; }

  if (gridObserver) gridObserver.disconnect();
  gridObserver = new IntersectionObserver((en) => { if (en[0].isIntersecting) gridMore(); }, { root: scroller, rootMargin: '400px' });
  gridObserver.observe(sentinel);
  gridMore();
  if (!day) requestAnimationFrame(scrollGridToNow);
}

async function gridMore() {
  const g = state.grid;
  if (!g || !state.gridMode || g.busy || g.next >= g.items.length) return;
  g.busy = true;
  const chunk = g.items.slice(g.next, g.next + EG.chunk);
  g.next += chunk.length;
  const tracks = new Map();
  const frag = document.createDocumentFragment();
  for (const it of chunk) {
    const track = el('div', { class: 'eg-track' });
    frag.append(el('div', { class: 'eg-row', 'data-sid': it.stream_id },
      el('div', { class: 'eg-ch', title: it.name, onclick: () => gridPlay(it) },
        el('span', { class: 'num' }, it.num || ''), img(it.stream_icon, 'logo', it.name), el('span', { class: 'eg-name' }, it.name)),
      track));
    if (!it.epg_channel_id) { track.append(el('div', { class: 'eg-empty' }, 'Kein Programm')); continue; }
    const k = String(it.epg_channel_id);
    if (!tracks.has(k)) tracks.set(k, []);
    tracks.get(k).push({ track, it });
  }
  g.rowsEl.append(frag);
  markGridPlaying();
  try {
    const r = await localApi('POST', '/epg/grid?account=' + encodeURIComponent(accountKey()), { channels: [...tracks.keys()], from: g.from, to: g.to });
    if (state.grid !== g) return;
    for (const [k, list] of tracks) for (const { track, it } of list) fillTrack(track, it, r.progs[k] || []);
    const info = $('#egInfo');
    if (info) info.textContent = guideInfoText(r);
  } catch (err) {
    for (const list of tracks.values()) for (const { track } of list) track.append(el('div', { class: 'eg-empty' }, 'Fehler: ' + err.message));
  } finally {
    g.busy = false;
  }
  const sc = $('#egScroll');
  if (sc && state.grid === g && sc.scrollTop + sc.clientHeight + 400 >= sc.scrollHeight) gridMore();
}

function fillTrack(track, it, progs) {
  const g = state.grid;
  const now = Date.now() / 1000;
  if (!progs.length) { track.append(el('div', { class: 'eg-empty' }, 'Kein Programm')); return; }
  const sorted = [...progs].sort((x, y) => x.s - y.s);
  sorted.forEach((p, i) => {
    const nextStart = sorted[i + 1] ? sorted[i + 1].s : Infinity;
    const s = Math.max(p.s, g.from);
    const e = Math.min(p.e, g.to, nextStart); // Ueberlappungen kuerzen
    if (e <= s) return;
    const w = ((e - s) / 60) * EG.px;
    const rem = isReminded({ ch: it.epg_channel_id, s: p.s });
    const cls = p.e <= now ? ' past' : p.s <= now ? ' live' : '';
    const b = el('div', {
      class: 'eg-prog' + cls + (rem ? ' rem' : ''),
      style: `left:${xOf(s)}px;width:${Math.max(3, w - 3)}px`,
      title: `${fmtTime(p.s)} – ${fmtTime(p.e)}  ${p.t}`,
    },
    el('div', { class: 'eg-t' }, (rem ? '🔔 ' : '') + p.t),
    el('div', { class: 'eg-time' }, `${fmtTime(p.s)} – ${fmtTime(p.e)}`));
    b.addEventListener('click', () => progClick(it, p, b));
    track.append(b);
  });
}

function progClick(it, p, block) {
  const now = Date.now() / 1000;
  if (p.s <= now && p.e > now) { gridPlay(it); return; }
  const r = { ch: it.epg_channel_id, sid: it.stream_id, name: it.name, title: p.t, s: p.s, e: p.e };
  const upcoming = p.s > now;
  const bell = el('button', { class: 'btn' });
  const drawBell = () => {
    const on = isReminded(r);
    bell.textContent = on ? '🔔 Erinnerung entfernen' : '🔔 Erinnern';
    bell.classList.toggle('on', on);
    block.classList.toggle('rem', on);
    block.firstChild.textContent = (on ? '🔔 ' : '') + p.t;
  };
  bell.addEventListener('click', () => { toggleReminder(r); drawBell(); });
  drawBell();
  $('#detailBody').replaceChildren(
    detailFrame(null),
    el('div', { class: 'detail-top' },
      img(it.stream_icon, 'logo-lg', it.name),
      el('div', {},
        el('h2', {}, p.t),
        p.st ? el('div', { class: 'muted' }, p.st) : null,
        el('div', { class: 'ep-state' }, `${fmtDay(p.s)} – ${fmtTime(p.e)} · ${it.name}`),
        el('p', {}, p.d || ''),
        el('div', { class: 'detail-actions' },
          upcoming ? bell : null,
          el('button', { class: 'btn primary', onclick: () => { closeOverlay('detail'); gridPlay(it); } }, '▶ Sender jetzt einschalten')))));
  openOverlay('detail');
}

// Jetzt-Linie mitlaufen lassen
setInterval(() => {
  if (!state.gridMode || !state.grid) return;
  const x = EG.chW + xOf(Date.now() / 1000);
  document.querySelectorAll('.eg-now').forEach((n) => { n.style.left = x + 'px'; });
}, 60000);

/* ================= Startbildschirm ================= */

const ICONS = {
  tv: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 3 4 4 4-4"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18"/>',
  series: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 8l2.5-5h3L6 8M11 8l2.5-5h3L14 8M19 8l1.5-3"/>',
  heart: '<path d="M12 20s-7-4.4-9-9.2C1.6 7.1 4 4 7.2 4c2 0 3.4 1.1 4.8 2.7C13.4 5.1 14.8 4 16.8 4 20 4 22.4 7.1 21 10.8 19 15.6 12 20 12 20Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
};

function svgIcon(name) {
  const span = document.createElement('span');
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  return span.firstChild;
}

const home = { timer: null, slides: [], idx: 0, token: 0 };

function showHome(on) {
  const h = $('#home');
  h.classList.toggle('settings-view', state.tab === 'settings');
  h.classList.toggle('hidden', !on);
  document.querySelector('.main').classList.toggle('hidden', on);
  if (on) showPreview(false);
  if (!on) {
    clearInterval(home.timer);
    home.timer = null;
    home.token++;
    home.draw = null;
    h.replaceChildren();
    document.querySelector('.topbar').classList.remove('solid');
  }
}

$('#home').addEventListener('scroll', (e) => {
  document.querySelector('.topbar').classList.toggle('solid', e.target.scrollTop > 60);
});

function goTo(tab, cat) {
  switchTab(tab).then(() => { if (cat) selectCat(cat); });
}

// waagerechte Reihe mit Pfeilen
function hrow(title, items, makeCard, moreFn) {
  if (!items.length) return null;
  const row = el('div', { class: 'hrow' }, items.map(makeCard));
  const scroll = (dir) => row.scrollBy({ left: dir * row.clientWidth * 0.85 });
  return el('section', { class: 'hsec' },
    el('div', { class: 'hsec-head' }, el('h3', {}, title), moreFn ? el('button', { class: 'more', onclick: moreFn }, 'Alle anzeigen  ›') : null),
    el('div', { class: 'hrow-wrap' },
      el('button', { class: 'hscroll l', title: 'Zurück', onclick: () => scroll(-1) }, '‹'),
      row,
      el('button', { class: 'hscroll r', title: 'Weiter', onclick: () => scroll(1) }, '›')));
}

function channelCard(it) {
  const np = it.epg_channel_id && state.nowMap[String(it.epg_channel_id)];
  const t = Date.now() / 1000;
  const live = np && np.s <= t && np.e > t;
  return el('div', { class: 'chcard', title: it.name, onclick: () => playChannelItem(it) },
    img(it.stream_icon, 'logo', it.name),
    el('div', { class: 'ch-name' }, liveLabel(it.name).text),
    el('div', { class: 'ch-now' }, live ? [el('b', {}, '● Live'), ` · ${fmtTime(np.s)}–${fmtTime(np.e)} · ${np.t}`] : 'Live TV'));
}

function liveRowForHome() {
  const now = liveFocusItems();
  if (now.length) return hrow('Jetzt live: Fußball & Formel 1', now.slice(0, 30), channelCard, () => goTo('live', '__livefocus'));
  const d = state.data.live;
  if (!d) return null;
  const focus = d.items.filter((it) => itemVisible('live', it) && (it._fb || it._f1)).slice(0, 30);
  return hrow('Fußball & Formel 1', focus, channelCard, () => goTo('live', '__focus'));
}

function updateHomeLive() {
  const old = document.getElementById('homeLive');
  if (!old) return;
  const fresh = liveRowForHome();
  const box = el('div', { id: 'homeLive' }, fresh);
  old.replaceWith(box);
}

function tile(cls, icon, title, sub, imgs, onclick) {
  return el('button', { class: 'tile ' + cls, onclick },
    svgIcon(icon),
    el('div', { class: 't-txt' }, el('div', { class: 't-title' }, title), el('div', { class: 't-sub' }, sub)),
    imgs.length ? el('div', { class: 't-imgs' }, imgs.map((src) => el('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }))) : null,
    el('span', { class: 't-arrow' }, '›'));
}

const posterUrls = (kind, n) => {
  const d = state.data[kind];
  if (!d) return [];
  const key = kind === 'series' ? 'cover' : 'stream_icon';
  return sortItems(kind, d.items.filter((it) => /^https?:/i.test(it[key] || '') && itemVisible(kind, it)), 'year').slice(0, n).map((it) => it[key]);
};

async function renderHome() {
  const token = ++home.token;
  const box = $('#home');
  const hero = el('section', { class: 'hero empty' });
  const tiles = el('div', { class: 'tiles' });
  const rows = el('div', { class: 'hrows' });
  box.replaceChildren(hero, tiles, rows);

  const draw = () => {
    if (token !== home.token) return;
    const n = (k) => (state.data[k] ? state.data[k].items.filter((it) => itemVisible(k, it)).length : '…');
    const favCount = state.favs.live.length + state.favs.vod.length + state.favs.series.length;
    tiles.replaceChildren(
      tile('t-live', 'tv', 'Live TV', `${n('live')} Sender`, [], () => goTo('live')),
      tile('t-vod', 'film', 'Filme', `${n('vod')} Filme`, posterUrls('vod', 3), () => goTo('vod')),
      tile('t-series', 'series', 'Serien', `${n('series')} Serien`, posterUrls('series', 3), () => goTo('series')),
      tile('t-fav', 'heart', 'Favoriten', favCount ? `${favCount} gespeichert` : 'Ihre Auswahl', [], () => goTo('fav')),
      tile('t-cont', 'clock', 'Weiter ansehen', `${contEntries().length} Titel`, [], () => goTo('cont')));

    const yNow = new Date().getFullYear();
    const since = Date.now() / 1000 - 30 * 86400;
    const vis = (k) => (state.data[k] ? state.data[k].items.filter((it) => itemVisible(k, it)) : []);
    const vod = vis('vod');
    const ser = vis('series');
    const addedVod = vod.some((it) => it._added >= since);
    const recentCh = state.recent.list.map((r) => (state.data.live && state.data.live.byId.get(String(r.stream_id))) || r);
    rows.replaceChildren(...[
      el('div', { id: 'homeLive' }, liveRowForHome()),
      hrow('Weiter ansehen', contEntries().slice(0, 20), contCard, () => goTo('cont')),
      hrow('Zuletzt gesehene Sender', recentCh.slice(0, 20), channelCard, () => goTo('live', '__recent')),
      addedVod
        ? hrow('Neu hinzugefügt: Filme', sortItems('vod', vod.filter((it) => it._added >= since), 'added').slice(0, 30), (it) => posterCard('vod', it), () => goTo('vod', '__added'))
        : hrow(`Aktuelle Filme (${yNow - 1}–${yNow})`, sortItems('vod', vod.filter((it) => it._year >= yNow - 1), 'year').slice(0, 30), (it) => posterCard('vod', it), () => goTo('vod', '__current')),
      hrow(`Aktuelle Serien (${yNow - 1}–${yNow})`, sortItems('series', ser.filter((it) => it._year >= yNow - 1), 'year').slice(0, 30), (it) => posterCard('series', it), () => goTo('series', '__current')),
      hrow('Top bewertete Filme (IMDb)', sortItems('vod', vod.filter((it) => ratingOf('vod', it) >= 7.5), 'rating').slice(0, 30), (it) => posterCard('vod', it), () => goTo('vod', '__top')),
    ].filter(Boolean));
  };

  home.draw = draw;
  draw();
  await Promise.all(KINDS.map((k) => loadKind(k).catch(() => null)));
  if (token !== home.token) return;
  draw();
  buildHero(hero, token);
}

async function buildHero(hero, token) {
  const d = state.data.vod;
  if (!d) return;
  const cand = sortItems('vod', d.items.filter((it) => itemVisible('vod', it) && /^https?:/i.test(it.stream_icon || '')), 'year')
    .filter((it, i, arr) => arr.findIndex((x) => x.name === it.name) === i).slice(0, 6);
  if (!cand.length) return;
  const key = cand.map((it) => it.stream_id).join(',');
  let slides = home.cache && home.cache.key === key && Date.now() - home.cache.t < 10 * 60 * 1000 ? home.cache.slides : null;
  if (!slides) {
    slides = await Promise.all(cand.map(async (it) => {
      let info = {};
      try { info = (await api('get_vod_info', { vod_id: it.stream_id })).info || {}; } catch { /* ohne Zusatzinfos */ }
      return { it, info };
    }));
    home.cache = { key, slides, t: Date.now() };
  }
  if (token !== home.token) return;
  home.slides = slides;
  home.idx = 0;
  hero.classList.remove('empty');
  const bg = el('div', { class: 'hero-bg' });
  const content = el('div', { class: 'hero-content' });
  const dots = el('div', { class: 'hero-dots' }, slides.map((_, i) => el('button', { title: 'Film ' + (i + 1), onclick: () => { show(i); restart(); } })));
  hero.replaceChildren(bg, content, dots);

  function show(i) {
    home.idx = i;
    const { it, info } = slides[i];
    const pic = firstUrl(info.backdrop_path) || info.movie_image || it.stream_icon;
    bg.style.opacity = 0;
    setTimeout(() => { bg.style.backgroundImage = `url("${String(pic).replace(/"/g, '%22')}")`; bg.style.opacity = 1; }, 250);
    const year = it._year || yearOf(it);
    const genre = String(info.genre || '').split(/[,/]/)[0].trim();
    const dur = info.duration ? String(info.duration).replace(/^0?(\d+):(\d{2}):\d{2}$/, (m, h, mm) => `${Number(h)} Std. ${Number(mm)} Min.`) : '';
    const meta = el('div', { class: 'hero-meta' });
    [year, genre, dur].filter(Boolean).forEach((x, k) => { if (k) meta.append(el('span', { class: 'sep' })); meta.append(el('span', {}, x)); });
    const rating = el('span', {});
    meta.append(rating);
    imdbFor('vod', it, info.imdb_id).then((v) => {
      if (v && v.r) rating.replaceChildren(el('span', { class: 'sep' }), ' ', el('span', { class: 'imdb' }, 'IMDb ' + v.r));
    });
    content.replaceChildren(
      el('div', { class: 'hero-kicker' }, 'FILM'),
      el('h1', {}, displayName(it.name)),
      meta,
      el('p', { class: 'hero-plot' }, info.plot || info.description || ''),
      el('div', { class: 'hero-btns' },
        el('button', { class: 'btn light', onclick: () => playMovie(it, '') }, svgIcon('play'), 'Jetzt ansehen'),
        el('button', { class: 'btn glass', onclick: () => openMovie(it) }, svgIcon('info'), 'Mehr Infos')));
    dots.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
  }
  function restart() {
    clearInterval(home.timer);
    if (slides.length > 1) home.timer = setInterval(() => { if (document.visibilityState === 'visible') show((home.idx + 1) % slides.length); }, 9000);
  }
  show(0);
  restart();
}

/* ================= Einstellungen ================= */

const SICON = {
  quality: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7.5 9.5v3M7.5 11h2M9.5 9.5v3M12.5 9.5v3h1.5a1.5 1.5 0 0 0 0-3Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5Z" fill="currentColor"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8Z"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.6 1.5A3.5 3.5 0 0 1 17.5 18Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
};

function stile(cls, icon, title, sub, onclick) {
  const ic = document.createElement('span');
  ic.className = 's-ic';
  ic.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SICON[icon]}</svg>`;
  return el('button', { class: 'stile ' + cls, onclick }, ic,
    el('div', { class: 's-txt' }, el('div', { class: 's-title' }, title), el('div', { class: 's-sub' }, sub)),
    el('span', { class: 's-arrow' }, '›'));
}

function renderSettings() {
  const box = $('#home');
  const minQ = state.filter.minQ || 0;
  const hidden = hiddenCount();
  const pb = state.playback || {};
  const syncTxt = !syncOn() ? 'nicht eingerichtet' : sync.error ? 'Fehler: ' + sync.error : 'aktiv' + (sync.last ? ', zuletzt ' + new Date(sync.last).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '');
  const i = state.info || {};
  box.replaceChildren(el('div', { class: 'settings' },
    el('h1', {}, 'Einstellungen'),
    el('div', { class: 'muted s-lead' }, 'Alles zu Anzeige, Wiedergabe und Konto'),
    el('div', { class: 'stiles' },
      stile('c1', 'quality', 'Qualität', minQ ? `Filme & Serien ab ${QLABEL[minQ]}` : 'Filme & Serien: alle Qualitäten', openQuality),
      stile('c2', 'globe', 'Länder, Sprachen & Doppelte', hidden ? `${hidden} ausgeblendet` : 'nichts ausgeblendet', openFilter),
      stile('c3', 'play', 'Live TV & Wiedergabe', `Format ${String(pb.fmt || 'ts').toUpperCase()}, Puffer ${({ normal: 'normal', gross: 'groß', sehrgross: 'sehr groß' })[pb.buffer] || 'groß'}`, openPlayback),
      stile('c4', 'bell', 'Erinnerungen', `${state.reminders.list.length} gesetzt, Hinweis ${state.reminders.lead ? state.reminders.lead + ' Min. vorher' : 'bei Beginn'}`, () => goTo('live', '__rem')),
      stile('c5', 'star', 'IMDb-Bewertungen', state.metaCfg && state.metaCfg.hasKey ? 'eingeschaltet' : 'nicht eingerichtet', openImdb),
      stile('c6', 'cloud', 'Abgleich Mac & PC', syncTxt, openSync),
      stile('c7', 'user', 'Konto', i.username ? `${i.username}${i.exp_date ? ', gültig bis ' + new Date(Number(i.exp_date) * 1000).toLocaleDateString('de-DE') : ''}` : '', openAccount),
      stile('c8', 'info', 'Info & Diagnose', 'Programmführer, ffmpeg, Version', openInfo))));
}

function openQuality() {
  const f = state.filter;
  const opts = [[0, 'Alle Qualitäten'], [3, 'Ab 1080p (Full HD und 4K)'], [4, 'Nur 4K']];
  const radios = opts.map(([v, l]) => {
    const r = el('input', { type: 'radio', name: 'minq', value: v, checked: (f.minQ || 0) === v });
    return el('label', { class: 'f-item q-opt' }, r, el('span', {}, l));
  });
  const unk = el('input', { type: 'checkbox', checked: f.showUnknownQ !== false });
  const count = () => {
    let shown = 0, total = 0;
    for (const k of ['vod', 'series']) {
      const d = state.data[k];
      if (!d) continue;
      for (const it of d.items) { if (!catVisible(k, it.category_id)) continue; total++; if (qualityOk(k, it)) shown++; }
    }
    return `${shown} von ${total} Filmen und Serien sichtbar`;
  };
  const info = el('div', { class: 'muted', style: 'margin-top:10px' }, count());
  const apply = () => {
    const sel = radios.map((l) => l.querySelector('input')).find((r) => r.checked);
    f.minQ = Number(sel ? sel.value : 0);
    f.showUnknownQ = unk.checked;
    filterChanged();
    info.textContent = count();
    if (state.tab === 'settings') renderSettings();
  };
  radios.forEach((l) => l.querySelector('input').addEventListener('change', apply));
  unk.addEventListener('change', apply);
  $('#qualBody').replaceChildren(
    el('h2', { style: 'margin:0 0 6px' }, 'Qualität von Filmen und Serien'),
    el('div', { class: 'muted' }, 'Die Liste des Anbieters enthält keine Auflösung. Die App erkennt die Qualität an Angaben im Namen oder in der Kategorie (z. B. „4K“, „UHD“, „1080p“, „Bluray“, „720p“, „SD“). Öffnen Sie einen Film, merkt sie sich zusätzlich die echte Auflösung, falls der Anbieter sie mitliefert.'),
    el('div', { class: 'q-opts' }, radios),
    el('label', { class: 'f-item', style: 'display:inline-flex;margin-top:12px' }, unk, el('span', {}, 'Titel ohne erkennbare Qualität anzeigen (empfohlen)')),
    info);
  $('#qualDlg').classList.remove('hidden');
}

function openAccount() {
  const i = state.info || {};
  const row = (k, v) => (v ? el('div', { class: 'f-row' }, el('span', { class: 'muted' }, k), el('span', {}, v)) : null);
  $('#qualBody').replaceChildren(
    el('h2', { style: 'margin:0 0 10px' }, 'Konto'),
    el('div', { class: 'f-hidden' },
      row('Benutzer', i.username),
      row('Anbieter', state.creds && state.creds.server),
      row('Status', i.status),
      row('Gültig bis', i.exp_date ? new Date(Number(i.exp_date) * 1000).toLocaleDateString('de-DE') : 'unbegrenzt'),
      row('Gleichzeitige Verbindungen', i.max_connections),
      row('Aktive Verbindungen', i.active_cons)),
    el('div', { class: 'f-presets' }, el('button', { class: 'btn', onclick: () => { $('#qualDlg').classList.add('hidden'); $('#logout').click(); } }, 'Abmelden')));
  $('#qualDlg').classList.remove('hidden');
}

async function openInfo() {
  const ff = await ffStatus();
  let g = guide.status || {};
  try { g = await localApi('GET', '/epg/status?account=' + encodeURIComponent(accountKey())); } catch { /* alter Stand */ }
  const row = (k, v) => el('div', { class: 'f-row' }, el('span', { class: 'muted' }, k), el('span', {}, v));
  const d = (k) => (state.data[k] ? state.data[k].items.length : '…');
  $('#qualBody').replaceChildren(
    el('h2', { style: 'margin:0 0 10px' }, 'Info & Diagnose'),
    el('div', { class: 'f-hidden' },
      row('Sender / Filme / Serien beim Anbieter', `${d('live')} / ${d('vod')} / ${d('series')}`),
      row('Programmführer', guideInfoText(g)),
      row('ffmpeg (Kompatibilitätsmodus)', ff.available ? `vorhanden (${ff.source})` : 'nicht installiert'),
      row('IMDb-Werte im Speicher dieser Sitzung', String(state.imdb.size)),
      row('Bekannte Auflösungen', String(Object.keys(state.res || {}).length)),
      row('Browser-Kennung', CLIENT_ID)));
  $('#qualDlg').classList.remove('hidden');
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
  // TS (durchgehender Datenstrom) ist Standard: ruhiger als HLS bei vielen Xtream-Anbietern
  const pb = store('playback:' + accountKey()) || {};
  state.playback = {
    fmt: pb.fmt || (formats.length === 0 || formats.includes('ts') ? 'ts' : 'm3u8'),
    buffer: pb.buffer || 'gross',
    stats: !!pb.stats,
  };
  state.fmtOverride = store('fmtOverride:' + accountKey()) || {};
  state.liveFormat = state.playback.fmt;
  store('creds', creds);
  loadFavs();
  loadFilter();
  loadProgress();
  state.res = store('res:' + accountKey()) || {};
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
  await switchTab('home');
  // restliche Bereiche im Hintergrund laden, damit die Suche sofort alles findet
  KINDS.forEach((k) => loadKind(k).catch(() => {}));
  loadKind('live').then(() => ensureGuide()).then(() => setTimeout(refreshNow, 1500)).catch(() => {});
  loadMetaCfg();
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

  showHome(tab === 'home' || tab === 'settings');
  if (tab === 'home') { renderHome(); return; }
  if (tab === 'settings') { renderSettings(); return; }
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
    const virt = tab === 'live' ? ['__recent', '__rem', '__focus', '__livefocus', '__football', '__f1', '__sport'] : ['__added', '__current', '__top'];
    const okSaved = saved && (saved === '__all' || virt.includes(saved) || (d.catById[saved] && catVisible(tab, saved)));
    state.cat = okSaved ? saved : defaultCat(tab, d);
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
  renderSidebarInner();
  groupSidebar();
}

// Gruppen in der Seitenleiste ein-/ausklappbar machen (Zustand merken), bei vielen Kategorien Suchfeld
function groupSidebar() {
  const side = $('#sidebar');
  const key = 'sgCollapsed:' + state.tab;
  let collapsed = store(key);
  if (!Array.isArray(collapsed)) collapsed = ['Weiterer Sport'];
  const kids = [...side.children];
  if (!kids.some((k) => k.classList.contains('side-group'))) return;
  side.replaceChildren();
  let body = null;
  for (const k of kids) {
    if (k.classList.contains('side-group')) {
      const name = k.textContent;
      body = el('div', { class: 'sg-body' });
      const head = el('button', { class: 'sg-head', 'aria-expanded': 'true' }, el('span', {}, name), el('span', { class: 'chev' }, '\u203A'));
      const b = body;
      const apply = (isCollapsed) => {
        b.classList.toggle('hidden', isCollapsed);
        head.classList.toggle('collapsed', isCollapsed);
        head.setAttribute('aria-expanded', String(!isCollapsed));
      };
      head.addEventListener('click', () => {
        const now = !b.classList.contains('hidden');
        apply(now);
        const list = (store(key) || ['Weiterer Sport']).filter((x) => x !== name);
        if (now) list.push(name);
        store(key, list);
      });
      side.append(head, body);
      body._apply = apply;
      body._name = name;
    } else if (body) body.append(k);
    else side.append(k);
  }
  side.querySelectorAll('.sg-body').forEach((b) => {
    const hasActive = !!b.querySelector('.cat.active');
    b._apply(collapsed.includes(b._name) && !hasActive);
  });
  const cats = side.querySelectorAll('.cat');
  if (cats.length > 15) {
    const input = el('input', { class: 'side-search', type: 'search', placeholder: 'Kategorie suchen ...' });
    input.addEventListener('input', () => {
      const q = norm(input.value);
      side.querySelectorAll('.cat').forEach((c) => {
        const w = c.closest('.cat-wrap') || c;
        w.classList.toggle('hidden', !!q && !norm(c.textContent).includes(q));
      });
      side.querySelectorAll('.sg-body').forEach((b) => { if (q) b.classList.remove('hidden'); else b._apply(collapsed.includes(b._name) && !b.querySelector('.cat.active')); });
    });
    side.prepend(input);
  }
}

function renderSidebarInner() {
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
  const vc = { focus: 0, fb: 0, f1: 0, added: 0, current: 0, top: 0 };
  const yNow = new Date().getFullYear();
  const addedSince = Date.now() / 1000 - 30 * 86400;
  for (const it of d.items) {
    if (!itemVisible(kind, it)) continue;
    counts[it.category_id] = (counts[it.category_id] || 0) + 1;
    total++;
    if (d.sportIds.has(it.category_id)) sportTotal++;
    if (kind === 'live') {
      if (it._fb || it._f1) vc.focus++;
      if (it._fb) vc.fb++;
      if (it._f1) vc.f1++;
    } else {
      if (it._added >= addedSince) vc.added++;
      if (it._year >= yNow - 1) vc.current++;
      if (ratingOf(kind, it) >= 7.5) vc.top++;
    }
  }
  const visCats = d.cats.filter((c) => catVisible(kind, c.category_id));
  const focusCats = visCats.filter((c) => d.focusIds.has(c.category_id));
  const sportCats = visCats.filter((c) => d.sportIds.has(c.category_id));
  const otherCats = visCats.filter((c) => !d.sportIds.has(c.category_id) && !d.focusIds.has(c.category_id));
  const label = KIND_LABEL[kind];

  if (kind === 'live') {
    side.append(el('div', { class: 'side-group' }, 'Fußball & Formel 1'));
    side.append(catButton('__livefocus', 'Jetzt live: Fußball & F1', liveFocusItems().length, { sport: true }));
    side.append(catButton('__focus', 'Alle Fußball- & F1-Sender', vc.focus, { sport: true }));
    if (vc.fb) side.append(catButton('__football', 'Nur Fußball', vc.fb, { sport: true }));
    if (vc.f1) side.append(catButton('__f1', 'Nur Formel 1', vc.f1, { sport: true }));
    for (const c of focusCats) side.append(catButton(c.category_id, catLabel(c.category_name), counts[c.category_id] || 0, { sport: true, hideable: true }));
  } else {
    side.append(el('div', { class: 'side-group' }, 'Entdecken'));
    side.append(catButton('__current', `Aktuell (${yNow - 1}–${yNow})`, vc.current));
    if (vc.added) side.append(catButton('__added', 'Neu hinzugefügt (30 Tage)', vc.added));
    if (state.metaCfg && state.metaCfg.hasKey) side.append(catButton('__top', 'Top bewertet (IMDb ab 7,5)', vc.top));
  }

  if (kind === 'live') {
    side.append(el('div', { class: 'side-group' }, 'Persönlich'));
    side.append(catButton('__recent', 'Zuletzt gesehen', state.recent.list.length));
    side.append(catButton('__rem', 'Erinnerungen', state.reminders.list.length));
  }
  if (sportCats.length) {
    side.append(el('div', { class: 'side-group' }, 'Weiterer Sport'));
    side.append(catButton('__sport', 'Alle weiteren Sport-' + label, sportTotal));
    for (const c of sportCats) side.append(catButton(c.category_id, catLabel(c.category_name), counts[c.category_id] || 0, { hideable: true }));
  }
  side.append(el('div', { class: 'side-group' }, 'Kategorien'));
  side.append(catButton('__all', 'Alle ' + label, total));
  for (const c of otherCats) side.append(catButton(c.category_id, catLabel(c.category_name), counts[c.category_id] || 0, { hideable: true }));
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
  const yNow = new Date().getFullYear();
  const sorted = (items, how) => (kind === 'live' ? items : sortItems(kind, items, how || state.sort[kind]));
  switch (state.cat) {
    case '__all': return { kind, items: sorted(vis), title: 'Alle ' + KIND_LABEL[kind] };
    case '__sport': return { kind, items: vis.filter((it) => d.sportIds.has(it.category_id)), title: 'Weiterer Sport' };
    case '__focus': return { kind, items: vis.filter((it) => it._fb || it._f1), title: 'Fußball & Formel 1' };
    case '__football': return { kind, items: vis.filter((it) => it._fb), title: 'Fußball' };
    case '__f1': return { kind, items: vis.filter((it) => it._f1), title: 'Formel 1' };
    case '__livefocus': return { kind, items: liveFocusItems(), title: 'Jetzt live: Fußball & Formel 1' };
    case '__current': return { kind, items: sorted(vis.filter((it) => it._year >= yNow - 1)), title: `Aktuell (${yNow - 1}–${yNow})` };
    case '__added': {
      const since = Date.now() / 1000 - 30 * 86400;
      return { kind, items: sorted(vis.filter((it) => it._added >= since), 'added'), title: 'Neu hinzugefügt (30 Tage)' };
    }
    case '__top': return { kind, items: sorted(vis.filter((it) => ratingOf(kind, it) >= 7.5), 'rating'), title: 'Top bewertet (IMDb ab 7,5)' };
    default: {
      const cat = d.catById[state.cat];
      return { kind, items: sorted(vis.filter((it) => it.category_id === state.cat)), title: cat ? catLabel(cat.category_name) : '' };
    }
  }
}

function defaultCat(kind, d) {
  if (kind === 'live') return d.items.some((it) => it._fb || it._f1) ? '__focus' : '__all';
  const yNow = new Date().getFullYear();
  return d.items.some((it) => it._year >= yNow - 1) ? '__current' : '__all';
}

/* ---------- Sortierung Filme/Serien ---------- */

state.sort = { vod: store('sort:vod') || 'year', series: store('sort:series') || 'year' };

function ratingOf(kind, it) {
  const im = state.imdb.get(kind + ':' + itemId(kind, it));
  return im && im.r ? Number(im.r) || 0 : 0; // nur IMDb zaehlt
}

// Anbieterwerte ab 9,0 stammen meist von neuen Titeln mit kaum Stimmen: ignorieren
function providerRating(it) {
  let r = Number(it.rating);
  if (!(r > 0)) r = (Number(it.rating_5based) || 0) * 2;
  return r > 0 && r < 9 ? r : 0;
}

const fmtRating = (r) => (Number(r) || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function sortItems(kind, items, how) {
  const arr = [...items];
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'de');
  if (how === 'year') arr.sort((a, b) => (b._year - a._year) || (b._added - a._added) || byName(a, b));
  else if (how === 'added') arr.sort((a, b) => (b._added - a._added) || (b._year - a._year));
  else if (how === 'rating') arr.sort((a, b) => (ratingOf(kind, b) - ratingOf(kind, a)) || (b._year - a._year));
  else if (how === 'name') arr.sort(byName);
  return arr;
}

$('#sortSel').addEventListener('change', (e) => {
  const kind = state.tab;
  if (!state.sort[kind]) return;
  state.sort[kind] = e.target.value;
  store('sort:' + kind, e.target.value);
  render();
  $('#listCol').scrollTop = 0;
});

/* ---------- Jetzt live: Fussball & F1 (aus dem Programmfuehrer) ---------- */

state.nowMap = {};
async function refreshNow() {
  if (!state.creds) return;
  try {
    const r = await localApi('GET', '/epg/now?account=' + encodeURIComponent(accountKey()));
    state.nowMap = r.now || {};
  } catch { return; }
  const n = document.querySelector('.cat[data-cat="__livefocus"] .n');
  if (n) n.textContent = liveFocusItems().length;
  if (state.tab === 'live' && state.cat === '__livefocus' && !state.search && !state.gridMode) render();
  if (state.tab === 'home' && !state.search) updateHomeLive();
}
setInterval(refreshNow, 2 * 60 * 1000);

function liveFocusItems() {
  const d = state.data.live;
  if (!d) return [];
  const seen = new Set();
  const out = [];
  for (const it of d.items) {
    if (!it.epg_channel_id || !itemVisible('live', it)) continue;
    const p = state.nowMap[String(it.epg_channel_id)];
    if (!p || !isFocus(p.t) || seen.has(String(it.epg_channel_id))) continue;
    seen.add(String(it.epg_channel_id));
    out.push(it);
  }
  return out;
}

function showPreview(on) {
  $('#preview').classList.toggle('hidden', !on);
  if (!on && player.mount === $('#preview')) stopPlayer();
}

function render() {
  const main = document.querySelector('.main');
  if (state.tab === 'home' || state.tab === 'settings') {
    if (state.search) { main.classList.add('no-side'); showHome(false); return renderSearch(); }
    main.classList.remove('no-side');
    showHome(true);
    return state.tab === 'home' ? renderHome() : renderSettings();
  }
  main.classList.remove('no-side');
  if (state.search) return renderSearch();
  if (KINDS.includes(state.tab) && !state.data[state.tab]) return;
  const { kind, items, title } = currentItems();
  state.view = items;
  state.viewKind = kind;
  state.rendered = 0;
  state.gridMode = false;
  showPreview(kind === 'live' || kind === 'rem');
  $('#listTitle').textContent = title;
  $('#listCount').textContent = items.length + ' Einträge';
  const vt = $('#viewToggle');
  vt.classList.toggle('hidden', kind !== 'live');
  const ss = $('#sortSel');
  const sortable = (kind === 'vod' || kind === 'series') && KINDS.includes(state.tab) && !['__added', '__top'].includes(state.cat);
  ss.classList.toggle('hidden', !sortable);
  if (sortable) ss.value = state.sort[kind];
  $('#imdbBtn').classList.toggle('hidden', !(kind === 'vod' || kind === 'series'));
  updateImdbButton();
  vt.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.liveView));
  if (kind === 'live' && state.liveView === 'grid') return renderGrid(items);
  const list = $('#list');
  list.className = 'list ' + (kind === 'live' || kind === 'rem' ? 'rows' : 'grid');
  list.replaceChildren();
  if (kind === 'rem') list.append(reminderSettings());
  if ((kind === 'vod' || kind === 'series') && state.metaCfg && !state.metaCfg.hasKey && !store('imdbHintOff')) list.append(imdbHint());
  if (state.cat === '__livefocus' && !items.length) {
    list.append(el('div', { class: 'empty' }, Object.keys(state.nowMap).length
      ? 'Laut Programm läuft gerade kein Fußball und keine Formel 1. Tipp: Programmsuche oder Raster für die nächsten Spiele.'
      : 'Programmdaten werden noch geladen ...'));
    return;
  }
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
  if (state.gridMode) return;
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
  state.gridMode = false;
  $('#viewToggle').classList.add('hidden');
  $('#sortSel').classList.add('hidden');
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
      el('div', { class: 'name' }, ...(() => { const l = liveLabel(it.name); return [tokens ? highlight(l.text, tokens) : l.text, ...chipEls(l.chips)]; })()),
      el('div', { class: 'now' }),
      el('div', { class: 'bar hidden' }, el('i'))),
    starButton('live', it));
  if (player.current && player.current.kind === 'live' && String(player.current.item.stream_id) === String(it.stream_id)) row.classList.add('playing');
  row.addEventListener('click', () => { state.livePlaylist = list; playLive(index); });
  row.addEventListener('dblclick', () => goFullscreen());
  // laufende Sendung zuerst aus dem vollstaendigen Programmfuehrer, sonst Kurz-EPG beim Anbieter abfragen
  const np = it.epg_channel_id && state.nowMap[String(it.epg_channel_id)];
  const t = Date.now() / 1000;
  if (np && np.s <= t && np.e > t) {
    $('.now', row).textContent = `${fmtTime(np.s)}  ${np.t}`;
    const bar = $('.bar', row);
    bar.classList.remove('hidden');
    bar.firstChild.style.width = Math.min(100, ((t - np.s) / (np.e - np.s)) * 100) + '%';
  } else {
    epgObserver.observe(row);
  }
  row._item = it;
  return row;
}

function posterCard(kind, it, tokens) {
  const pic = kind === 'series' ? it.cover : it.stream_icon;
  const year = it._year || yearOf(it) || '';
  const im = state.imdb.get(kind + ':' + itemId(kind, it));
  let meta = year ? String(year) : '';
  let pi = null;
  if (kind === 'vod') pi = progInfo(getProg('vod', it.stream_id));
  if (kind === 'series') {
    const sp = state.seriesProg[it.series_id];
    if (sp && sp.ep) meta = 'Zuletzt ' + epLabel(sp.ep) + (meta ? ' · ' + meta : '');
  }
  if (pi && !pi.done) meta = pi.label + (meta ? ' · ' + meta : '');
  const card = el('div', { class: 'card', title: it.name, 'data-ik': kind + ':' + itemId(kind, it), onclick: () => (kind === 'series' ? openSeries(it) : openMovie(it)) },
    el('div', { class: 'pwrap' }, img(pic, 'poster', it.name), ...progDecor(pi), im && im.r ? imdbBadge(im) : null, (() => {
      const vars = state.titleVariants && state.titleVariants[kind] && state.titleVariants[kind].get(itemId(kind, it));
      const qs = [qualityOf2(kind, it), ...((state.filter.dedupe && vars) ? vars.map((v) => qualityOf2(kind, v)) : [])];
      const best = Math.max(...qs, it._4k ? 4 : 0);
      return best >= 2 ? el('span', { class: 'b4k' + (best === 4 ? ' uhd' : '') }, QLABEL[best]) : null;
    })(),
    (() => {
      const vars = state.filter.dedupe && state.titleVariants && state.titleVariants[kind] && state.titleVariants[kind].get(itemId(kind, it));
      return vars && vars.length > 1 ? el('span', { class: 'bvar', title: vars.length + ' Fassungen' }, vars.length + ' Fassungen') : null;
    })()),
    starButton(kind, it),
    el('div', { class: 'title' }, tokens ? highlight(displayName(it.name), tokens) : displayName(it.name)),
    el('div', { class: 'meta' }, meta));
  if (!state.imdb.has(kind + ':' + itemId(kind, it))) {
    card._imdbReq = { kind, it };
    imdbObserver.observe(card);
  }
  return card;
}

/* ---------- IMDb-Bewertungen (ueber OMDb, lokaler Server) ---------- */

state.imdb = new Map();
state.metaCfg = null;
const imdbQueue = new Map();
let imdbTimer = null;

const imdbBadge = (im) => el('span', { class: 'imdb', title: im.v ? im.v + ' Stimmen auf IMDb' : 'IMDb' }, 'IMDb ' + im.r);

const imdbObserver = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    imdbObserver.unobserve(en.target);
    const rq = en.target._imdbReq;
    if (!rq) continue;
    const key = rq.kind + ':' + itemId(rq.kind, rq.it);
    if (!state.imdb.has(key)) imdbQueue.set(key, rq);
  }
  if (imdbQueue.size && !imdbTimer) imdbTimer = setTimeout(flushImdb, 250);
}, { rootMargin: '300px' });

async function flushImdb() {
  imdbTimer = null;
  const batch = [...imdbQueue.entries()].slice(0, 40);
  for (const [k] of batch) imdbQueue.delete(k);
  if (!batch.length) return;
  const items = batch.map(([k, { kind, it }]) => ({
    id: k, title: it.name, year: it._year || yearOf(it) || '', type: kind === 'series' ? 'series' : 'movie',
    imdbId: /^tt\d+$/.test(String(it.imdb_id || it.imdb || '')) ? String(it.imdb_id || it.imdb) : undefined,
  }));
  try {
    const r = await localApi('POST', '/meta/imdb', { items });
    state.metaCfg = { ...(state.metaCfg || {}), hasKey: r.hasKey };
    state.imdbError = r.error || '';
    for (const [k] of batch) {
      if (!(k in r.ratings)) continue;
      const v = r.ratings[k];
      state.imdb.set(k, v);
      if (v && v.r) applyImdb(k, v);
    }
    updateImdbButton();
  } catch { /* spaeter erneut */ }
  if (imdbQueue.size) imdbTimer = setTimeout(flushImdb, 250);
}

function applyImdb(k, v) {
  document.querySelectorAll(`.card[data-ik="${CSS.escape(k)}"]`).forEach((card) => {
    const w = $('.pwrap', card);
    if (w && !$('.imdb', w)) w.append(imdbBadge(v));
    const m = $('.meta', card);
    if (m) m.textContent = m.textContent.replace(/\s*·?\s*\u2605 [\d.,]+/, '');
  });
}

async function imdbFor(kind, it, extraId) {
  const k = kind + ':' + itemId(kind, it);
  if (state.imdb.has(k)) return state.imdb.get(k);
  try {
    const imdbId = /^tt\d+$/.test(String(extraId || '')) ? extraId : undefined;
    const r = await localApi('POST', '/meta/imdb', { items: [{ id: k, title: it.name, year: it._year || yearOf(it) || '', type: kind === 'series' ? 'series' : 'movie', imdbId }] });
    if (k in r.ratings) state.imdb.set(k, r.ratings[k]);
    return r.ratings[k] || null;
  } catch {
    return null;
  }
}

function imdbLine(kind, it, extraId) {
  const box = el('div', { class: 'imdb-line' });
  imdbFor(kind, it, extraId).then((v) => {
    if (!v || !v.r) return;
    box.append(el('a', { class: 'imdb big', href: 'https://www.imdb.com/title/' + v.id + '/', target: '_blank', rel: 'noopener noreferrer' }, 'IMDb ' + v.r),
      v.v ? el('span', { class: 'muted' }, ` ${v.v} Stimmen`) : null);
    applyImdb(kind + ':' + itemId(kind, it), v);
  });
  return box;
}

function updateImdbButton() {
  const b = $('#imdbBtn');
  if (!b) return;
  const on = state.metaCfg && state.metaCfg.hasKey;
  b.textContent = on ? (state.imdbError ? 'IMDb: Hinweis' : 'IMDb an') : 'IMDb einrichten';
  b.classList.toggle('active-filter', !!on && !state.imdbError);
  b.title = state.imdbError || '';
}

const imdbBg = { running: false, queue: [], done: 0 };

async function startImdbBackground() {
  if (imdbBg.running || !(state.metaCfg && state.metaCfg.hasKey)) return;
  await Promise.all(['vod', 'series'].map((k) => loadKind(k).catch(() => null)));
  const yNow = new Date().getFullYear();
  const since = Date.now() / 1000 - 30 * 86400;
  const list = [];
  for (const kind of ['vod', 'series']) {
    const d = state.data[kind];
    if (!d) continue;
    for (const it of d.items) {
      if (!itemVisible(kind, it)) continue;
      const k = kind + ':' + itemId(kind, it);
      if (state.imdb.has(k)) continue;
      const prio = (it._year >= yNow - 1 ? 2 : 0) + (it._added >= since ? 2 : 0) + (it._year >= yNow - 5 ? 1 : 0);
      list.push({ k, kind, it, prio });
    }
  }
  list.sort((a, b) => b.prio - a.prio || b.it._year - a.it._year);
  imdbBg.queue = list;
  imdbBg.running = true;
  let lastRefresh = Date.now();
  while (imdbBg.queue.length && state.metaCfg && state.metaCfg.hasKey) {
    const batch = imdbBg.queue.splice(0, 40);
    let r;
    try {
      r = await localApi('POST', '/meta/imdb', {
        background: true,
        items: batch.map(({ k, kind, it }) => ({ id: k, title: it.name, year: it._year || '', type: kind === 'series' ? 'series' : 'movie' })),
      });
    } catch { break; }
    let fresh = 0;
    for (const { k } of batch) if (k in r.ratings) { state.imdb.set(k, r.ratings[k]); fresh++; if (r.ratings[k] && r.ratings[k].r) applyImdb(k, r.ratings[k]); }
    imdbBg.done += fresh;
    if (!r.budgetLeft && fresh < batch.length) break; // Tagesbudget aufgebraucht, morgen weiter
    if (Date.now() - lastRefresh > 20000) {
      lastRefresh = Date.now();
      if (KINDS.includes(state.tab) && state.tab !== 'live' && !state.search) renderSidebar();
    }
    await new Promise((res) => setTimeout(res, fresh === batch.length ? 150 : 1500));
  }
  imdbBg.running = false;
  if (KINDS.includes(state.tab) && state.tab !== 'live' && !state.search) renderSidebar();
}
setInterval(() => { if (!imdbBg.running) startImdbBackground(); }, 60 * 60 * 1000);

async function loadMetaCfg() {
  try { state.metaCfg = await localApi('GET', '/meta/config'); } catch { state.metaCfg = null; }
  updateImdbButton();
  startImdbBackground();
}

function imdbHint() {
  const off = el('button', { class: 'btn small', onclick: () => { store('imdbHintOff', true); render(); } }, 'Nicht mehr anzeigen');
  return el('div', { class: 'rem-settings imdb-hint' },
    el('span', {}, 'IMDb-Bewertungen anzeigen? Dafür ist ein kostenloser Schlüssel von OMDb nötig.'),
    el('button', { class: 'btn small primary', onclick: openImdb }, 'Einrichten'), off);
}

function openImdb() {
  const input = el('input', { class: 'search', type: 'text', placeholder: 'OMDb-Schlüssel, z. B. 1a2b3c4d', style: 'max-width:none;flex:1' });
  const msg = el('div', { class: 'error' });
  const save = async (key) => {
    msg.textContent = '';
    try {
      state.metaCfg = await localApi('POST', '/meta/config', { key });
      state.imdb.clear();
      state.imdbError = '';
      toast(key ? 'IMDb-Bewertungen eingeschaltet' : 'IMDb-Schlüssel entfernt');
      if (key) startImdbBackground();
      $('#imdbDlg').classList.add('hidden');
      updateImdbButton();
      render();
    } catch (err) {
      msg.textContent = err.message;
    }
  };
  const on = state.metaCfg && state.metaCfg.hasKey;
  $('#imdbBody').replaceChildren(
    el('h2', { style: 'margin:0 0 6px' }, 'IMDb-Bewertungen'),
    el('div', { class: 'muted' }, 'Die Bewertungen kommen von OMDb (omdbapi.com), einem Dienst, der IMDb-Daten bereitstellt. Der Schlüssel bleibt auf diesem Rechner.'),
    el('ol', { class: 'imdb-steps' },
      el('li', {}, 'Auf ', el('a', { href: 'https://www.omdbapi.com/apikey.aspx', target: '_blank', rel: 'noopener noreferrer' }, 'omdbapi.com/apikey.aspx'), ' die Variante „FREE“ wählen und E-Mail-Adresse eintragen.'),
      el('li', {}, 'Den Bestätigungslink in der E-Mail anklicken.'),
      el('li', {}, 'Den Schlüssel aus der E-Mail hier eintragen.')),
    el('div', { class: 'sync-row' }, input, el('button', { class: 'btn primary', onclick: () => save(input.value) }, 'Speichern')),
    msg,
    on ? el('div', { class: 'f-presets' },
      el('span', { class: 'muted' }, 'Status: eingeschaltet' + (state.imdbError ? ' – ' + state.imdbError : '')),
      el('button', { class: 'btn', onclick: () => save('') }, 'Schlüssel entfernen')) : null,
    el('div', { class: 'muted', style: 'margin-top:12px' }, 'Hinweise: Der kostenlose Schlüssel erlaubt etwa 1.000 Abfragen am Tag. Die App fragt sichtbare Titel sofort ab und holt im Hintergrund nach und nach weitere (aktuelle und neue zuerst, höchstens etwa 800 am Tag). Ergebnisse merkt sie sich 30 Tage. Deutsche Titel findet OMDb nicht immer, weil dort meist der Originaltitel geführt wird.'));
  $('#imdbDlg').classList.remove('hidden');
}

$('#imdbBtn').addEventListener('click', openImdb);

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
  box.replaceChildren(...rows.map((e, i) => {
    const upcoming = e.start > now;
    const running = e.start <= now && e.stop > now;
    if (running) {
      const pct = Math.min(100, ((now - e.start) / (e.stop - e.start)) * 100);
      const rest = Math.max(1, Math.round((e.stop - now) / 60));
      return el('div', { class: 'epg-now' },
        el('div', { class: 'en-top' }, el('span', { class: 'en-badge' }, 'JETZT'), el('span', { class: 'muted' }, `${fmtTime(e.start)} – ${fmtTime(e.stop)}`)),
        el('div', { class: 'en-title' }, e.title),
        el('div', { class: 'en-bar' }, el('i', { style: `width:${pct}%` })),
        el('div', { class: 'en-rest' }, `noch ${rest} Min.`),
        e.desc ? el('div', { class: 'epg-desc' }, e.desc) : null);
    }
    return el('div', { class: 'epg-item compact' },
      upcoming && it.epg_channel_id ? bellButton({ ch: it.epg_channel_id, sid: it.stream_id, name: it.name, title: e.title, s: e.start, e: e.stop }) : null,
      i === 1 || (i === 0 && upcoming) ? el('div', { class: 'en-next' }, 'DANACH') : null,
      el('span', { class: 'epg-time' }, e.start ? fmtDay(e.start) : ''),
      el('strong', {}, e.title));
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
    if (state.tab === 'home' && !state.search && home.draw) home.draw();
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
  const resQ = rememberRes('vod', it, info.video);
  const resTxt = info.video && info.video.width ? `${info.video.width}×${info.video.height}` : '';
  const facts = [info.releasedate || info.release_date, info.genre, info.duration, resQ ? `${QLABEL[resQ]}${resTxt ? ' (' + resTxt + ')' : ''}` : (it._qv ? QLABEL[it._qv] + ' (laut Name)' : '')]
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
        el('h2', {}, displayName(it.name)),
        el('div', { class: 'muted' }, facts),
        imdbLine('vod', it, info.imdb_id || info.imdb),
        variantPicker('vod', it),
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
  { // Aufloesung der ersten Folge als Anhaltspunkt fuer die Serie
    const eps = data.episodes || {};
    const first = Object.values(eps).flat()[0];
    if (first && first.info) rememberRes('series', it, first.info.video);
  }
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
        el('div', { class: 'muted' }, [info.releaseDate || info.releasedate, info.genre].filter(Boolean).join(' · ')),
        imdbLine('series', it, info.imdb_id || info.imdb),
        variantPicker('series', it),
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
  if (player.compatSess) {
    const id = player.compatSess;
    player.compatSess = null;
    fetch('/transcode/stop', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-SportTV': '1' }, body: JSON.stringify({ id }) }).catch(() => {});
  }
  clearInterval(player.bufTimer);
  player.prebuffering = false;
  document.querySelectorAll('.cbar').forEach((b) => b.remove());
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
  m.classList.remove('info');
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

function startEngine(url, ext, live, current, rawSrc) {
  stopPlayer();
  player.current = current;
  player.lastT = -1;
  player.lastProg = Date.now();
  player.startT = null;
  setMsg('');
  video.autoplay = !live; // Live: Start erst nach Vorlauf (startPrebuffer)
  video.controls = true; // im Kompatibilitaetsmodus durch eigene Steuerung ersetzt (showCompatBar)
  const src = rawSrc || proxied(url);

  if (ext === 'm3u8') {
    if (window.Hls && Hls.isSupported()) {
      const n = { normal: 3, gross: 5, sehrgross: 7 }[state.playback.buffer] || 3;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        liveSyncDurationCount: live ? n : 3,     // mehr Abstand zur Live-Kante = weniger Haenger
        liveMaxLatencyDurationCount: Infinity,   // nicht nach vorne springen
        maxLiveSyncPlaybackRate: 1,              // kein beschleunigtes Aufholen
        maxBufferLength: 40,
        backBufferLength: 60,
        startPosition: live ? -1 : 0,            // umgewandelte Filme von vorn (Liste waechst noch)
      });
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
    const p = mpegts.createPlayer({ type: 'mpegts', isLive: live, url: new URL(src, location.href).href }, {
      enableWorker: true,
      enableStashBuffer: true,
      stashInitialSize: 512 * 1024,
      lazyLoad: !live,
      liveBufferLatencyChasing: false,           // kein Springen/Aufholen: verhindert Spruenge
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 120,
      autoCleanupMinBackwardDuration: 60,
    });
    player.ts = p;
    p.on(mpegts.Events.ERROR, () => onPlaybackError(live));
    p.attachMediaElement(video);
    p.load();
  } else {
    video.src = src;
  }
  if (live) startPrebuffer();
  else video.play().catch(() => { /* Autoplay evtl. blockiert */ });
}

/* ---------- Puffer fuer Live TV ---------- */

const BUFFER_TARGET = { normal: 2, gross: 4, sehrgross: 8 };
const bufferTarget = () => BUFFER_TARGET[state.playback && state.playback.buffer] || 4;
player.stats = { rebuffers: 0, reconnects: 0 };

function bufferedAhead() {
  const b = video.buffered;
  const t = video.currentTime;
  for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.3 && b.end(i) > t) return b.end(i) - t;
  return 0;
}

// Wiedergabe erst starten, wenn genug Vorrat da ist (wie bei TV-Apps); nach Leerlaufen erneut auffuellen
function startPrebuffer(isRebuffer) {
  clearInterval(player.bufTimer);
  const target = bufferTarget();
  const started = Date.now();
  const cur = player.current;
  player.prebuffering = true;
  if (isRebuffer) { player.stats.rebuffers++; video.pause(); }
  slotNote(isRebuffer ? 'Puffer wird aufgefüllt ...' : '');
  let lastEnd = -1;
  let lastGrow = Date.now();
  player.bufTimer = setInterval(() => {
    if (player.current !== cur) { clearInterval(player.bufTimer); return; }
    const b = video.buffered;
    // kommen gar keine Daten mehr an, nicht lange warten, sondern neu verbinden
    const end = b.length ? b.end(b.length - 1) : 0;
    if (end > lastEnd + 0.01) { lastEnd = end; lastGrow = Date.now(); }
    else if (Date.now() - lastGrow > 8000) {
      clearInterval(player.bufTimer);
      player.prebuffering = false;
      scheduleReconnect('Keine Daten vom Anbieter');
      return;
    }
    // Startzeit liegt evtl. vor dem ersten gepufferten Bereich: dorthin springen
    if (b.length && video.currentTime < b.start(0) && b.start(0) - video.currentTime < 10) video.currentTime = b.start(0) + 0.05;
    const ahead = bufferedAhead();
    const waited = Date.now() - started;
    if (ahead >= target || (waited > 6000 && ahead > 0.8) || waited > 15000) {
      clearInterval(player.bufTimer);
      player.prebuffering = false;
      slotNote('');
      if (!ahead && waited > 15000) { scheduleReconnect('Keine Daten vom Anbieter'); return; }
      video.play().catch(() => {});
    }
  }, 200);
}

video.addEventListener('waiting', () => {
  const cur = player.current;
  if (!cur || cur.kind !== 'live' || player.prebuffering || video.ended || video.currentTime < 1) return;
  startPrebuffer(true);
});

function liveFormatFor(it) {
  return (state.fmtOverride && state.fmtOverride[String(it.stream_id)]) || state.playback.fmt;
}

function setFormatOverride(it, fmt) {
  const id = String(it.stream_id);
  if (fmt === state.playback.fmt) delete state.fmtOverride[id];
  else state.fmtOverride[id] = fmt;
  store('fmtOverride:' + accountKey(), state.fmtOverride);
}

function savePlayback() {
  store('playback:' + accountKey(), state.playback);
}

/* ---------- Info-Anzeige (Taste I) ---------- */

setInterval(() => {
  const slot = role('slot');
  const cur = player.current;
  const old = document.querySelectorAll('.stats');
  if (!state.playback || !state.playback.stats || !cur || !slot) { old.forEach((n) => n.remove()); return; }
  let box = $('.stats', slot);
  old.forEach((n) => { if (n !== box) n.remove(); });
  if (!box) { box = el('div', { class: 'stats' }); slot.append(box); }
  const q = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : {};
  const fmt = cur.kind === 'live' ? (cur.ext || '').toUpperCase() : cur.mode === 'compat' ? 'Kompatibilitätsmodus' : (cur.ext || '').toUpperCase();
  const lines = [
    `Format: ${fmt}`,
    `Puffer: ${bufferedAhead().toFixed(1)} s` + (cur.kind === 'live' ? ` (Ziel ${bufferTarget()} s)` : ''),
    `Bild: ${video.videoWidth}×${video.videoHeight}`,
    `Verlorene Bilder: ${q.droppedVideoFrames || 0} von ${q.totalVideoFrames || 0}`,
    `Puffer leergelaufen: ${player.stats.rebuffers}×`,
    `Neu verbunden: ${player.stats.reconnects}×`,
  ];
  if (player.hls && player.hls.levels && player.hls.levels.length) {
    const lv = player.hls.levels[player.hls.currentLevel] || player.hls.levels[0];
    if (lv && lv.bitrate) lines.push(`Bitrate: ${(lv.bitrate / 1e6).toFixed(1)} Mbit/s`);
  }
  box.replaceChildren(...lines.map((l) => el('div', {}, l)));
}, 1000);

function openPlayback() {
  const pb = state.playback;
  const fmtSel = el('select', { class: 'search', style: 'flex:none;max-width:320px' },
    [['ts', 'TS – durchgehender Datenstrom (empfohlen)'], ['m3u8', 'HLS – in Stücken']].map(([v, l]) => el('option', { value: v, selected: pb.fmt === v }, l)));
  const bufSel = el('select', { class: 'search', style: 'flex:none;max-width:320px' },
    [['normal', 'Normal (ca. 2 s Vorlauf)'], ['gross', 'Groß (ca. 4 s Vorlauf, empfohlen)'], ['sehrgross', 'Sehr groß (ca. 8 s Vorlauf)']].map(([v, l]) => el('option', { value: v, selected: pb.buffer === v }, l)));
  const stats = el('input', { type: 'checkbox', checked: pb.stats });
  const overrides = Object.keys(state.fmtOverride || {}).length;
  const apply = () => {
    pb.fmt = fmtSel.value;
    pb.buffer = bufSel.value;
    pb.stats = stats.checked;
    savePlayback();
    $('#playDlg').classList.add('hidden');
    const cur = player.current;
    if (cur && cur.kind === 'live') { player.triedFallback = false; player.stats = { rebuffers: 0, reconnects: 0 }; cur.restart(); }
    toast('Wiedergabe-Einstellungen gespeichert');
  };
  $('#playBody').replaceChildren(
    el('h2', { style: 'margin:0 0 6px' }, 'Wiedergabe (Live TV)'),
    el('div', { class: 'muted' }, 'Bei Rucklern oder sich wiederholenden Szenen: Format TS verwenden und den Puffer erhöhen. Mehr Puffer bedeutet, dass der Sender etwas später startet und das Bild einige Sekunden hinter dem Live-Geschehen liegt.'),
    el('div', { class: 'pb-row' }, el('span', {}, 'Standardformat'), fmtSel),
    el('div', { class: 'pb-row' }, el('span', {}, 'Puffer'), bufSel),
    el('label', { class: 'f-item', style: 'display:inline-flex;margin-top:10px' }, stats, el('span', {}, 'Info-Anzeige im Bild (Taste I)')),
    overrides ? el('div', { class: 'pb-row' },
      el('span', { class: 'muted' }, `${overrides} Sender mit eigenem Format`),
      el('button', { class: 'btn small', onclick: () => { state.fmtOverride = {}; store('fmtOverride:' + accountKey(), {}); toast('Zurückgesetzt'); openPlayback(); } }, 'Zurücksetzen')) : null,
    el('div', { class: 'f-presets' }, el('button', { class: 'btn primary', onclick: apply }, 'Übernehmen')));
  $('#playDlg').classList.remove('hidden');
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
  player.stats.reconnects++;
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
  if (now - player.lastProg > 12000) {
    // Datei startet nicht: zuerst Kompatibilitaetsmodus versuchen, sonst neu verbinden
    if (cur.kind !== 'live' && cur.mode !== 'compat' && compat.status && compat.status.available && !cur.triedCompat) {
      cur.triedCompat = true;
      slotNote('Datei startet nicht – wechsle in den Kompatibilitätsmodus ...');
      startCompat(cur, Math.max(curPos(), savedPos(cur)));
      return;
    }
    scheduleReconnect('Bild steht');
  }
}, 2000);

// Ton laeuft, aber kein Bild (Videoformat wird vom Browser nicht unterstuetzt)
setInterval(() => {
  const cur = player.current;
  if (!cur || cur.kind === 'live' || video.paused || cur.blackHandled) return;
  if (video.currentTime > 4 && video.videoWidth === 0 && !(cur.probe && !cur.probe.video)) {
    if (cur.mode !== 'compat' && compat.status && compat.status.available) {
      cur.blackHandled = true;
      slotNote('Kein Bild – wechsle in den Kompatibilitätsmodus ...');
      startCompat(cur, curPos());
    } else if (cur.mode === 'compat' && cur.vmode !== 'x264') {
      cur.blackHandled = true;
      cur.forceX264 = true;
      slotNote('Kein Bild – Bild wird jetzt umgerechnet ...');
      startCompat(cur, curPos());
    } else if (cur.mode !== 'compat') {
      cur.blackHandled = true;
      fileFailed(cur, 'Ton läuft, aber das Bildformat kann der Browser nicht darstellen');
    }
  }
}, 2000);

video.addEventListener('playing', () => slotNote(''));

function onPlaybackError(live) {
  const cur = player.current;
  if (!cur) return;
  if (!live) { fileError(cur); return; }
  if (live && !player.triedFallback && !player.attempts) {
    player.triedFallback = true;
    const other = cur.ext === 'm3u8' ? 'ts' : 'm3u8';
    setMsg(`Stream-Fehler, versuche Format ${other.toUpperCase()} für diesen Sender ...`);
    setFormatOverride(cur.item, other);
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
  const ob = role('opts');
  if (ob) ob.classList.toggle('hidden', !live);
  for (const r of ['vlc', 'compat']) { const b = role(r); if (b) b.classList.toggle('hidden', live); }
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
    player.stats = { rebuffers: 0, reconnects: 0 };
    // fuer "Letzter Sender" merken
    const prev = player.lastPlayedLive;
    if (prev && String(prev.item.stream_id) !== String(it.stream_id)) player.lastLive = prev;
    player.lastPlayedLive = { list, index, item: it };
    addRecent(it);
  }
  const inPreview = !$('#preview').classList.contains('hidden') && $('#player').classList.contains('hidden');
  const target = inPreview ? $('#preview') : $('#playerBox');
  const ext = liveFormatFor(it);
  const url = streamUrl('live', it.stream_id, ext);
  const cur = { kind: 'live', index, item: it, url, list, ext };
  cur.restart = () => { state.livePlaylist = list; playLive(index, true); };
  startEngine(url, ext, true, cur);
  mountPlayer(target);
  if (!inPreview) openOverlay('player');
  setupHead(liveLabel(it.name).text, `Live · ${ext.toUpperCase()} · ${index + 1}/${list.length}`, 'live', it);
  const lastBtn = role('last');
  lastBtn.disabled = !player.lastLive;
  lastBtn.title = player.lastLive ? 'Zurück zu: ' + player.lastLive.item.name + ' (Taste Z)' : 'Noch kein vorheriger Sender';
  const vars = state.variants.get(String(it.stream_id));
  const qs = role('quality');
  if (vars && vars.length > 1) {
    qs.replaceChildren(...vars.map((v) => el('option', { value: v.stream_id, selected: String(v.stream_id) === String(it.stream_id) }, v._q.label)));
    qs.classList.remove('hidden');
  }
  const qw = qs.closest('[data-qwrap]');
  if (qw) qw.classList.toggle('hidden', qs.classList.contains('hidden'));
  document.querySelectorAll('.row').forEach((r) => r.classList.toggle('playing', r.dataset.sid === String(it.stream_id)));
  const row = document.querySelector(`.row[data-sid="${it.stream_id}"]`);
  if (row && inPreview) row.scrollIntoView({ block: 'nearest' });
  markGridPlaying();
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
  mountPlayer($('#playerBox'));
  openOverlay('player');
  setupHead(displayName(it.name), sub || '', 'vod', it);
  role('epg').replaceChildren();
  const cur = { kind: 'vod', id, item: it, url, ext, offset: 0 };
  cur.restart = () => playMovie(it, sub, false, true);
  startFile(cur);
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
  mountPlayer($('#playerBox'));
  openOverlay('player');
  setupHead(series.name, `${epLabel(e)}${e.title ? ' · ' + e.title : ''}`, 'episode', null);
  role('epg').replaceChildren();
  const cur = { kind: 'episode', id: e.id, item: null, url, ext: e.ext, series, flat, idx, offset: 0 };
  cur.restart = () => playEpisode(series, flat, idx, true);
  startFile(cur);
}

/* ---------- Kompatibilitaetsmodus (Umwandlung ueber ffmpeg im lokalen Server) ---------- */

const compat = { status: null };
const COMPAT_EXT = ['mkv', 'avi', 'wmv', 'flv', 'mpg', 'mpeg', 'm2ts', 'ts', 'divx', 'xvid', 'vob', '3gp', 'webm'];

async function ffStatus() {
  if (!compat.status) {
    try { compat.status = await localApi('GET', '/transcode/status'); } catch { compat.status = { available: false }; }
  }
  return compat.status;
}

function curPos() {
  const cur = player.current;
  return (cur && cur.mode === 'compat' ? cur.offset || 0 : 0) + (video.currentTime || 0);
}

function curDur() {
  const cur = player.current;
  if (cur && cur.mode === 'compat') return cur.duration || 0;
  return isFinite(video.duration) ? video.duration : 0;
}

function savedPos(cur) {
  const p = getProg(cur.kind, cur.id);
  return p && !p.done && p.pos > 30 ? p.pos : 0;
}

const hevcSupported = () => !!(window.MediaSource && MediaSource.isTypeSupported('video/mp4; codecs="hvc1.1.6.L93.B0"'));

function pickAudio(list) {
  if (!list || !list.length) return -1;
  const de = list.find((a) => /^(ger|deu|de)$/i.test(a.lang));
  return (de || list[0]).index;
}

async function startFile(cur, opts = {}) {
  const ff = await ffStatus();
  const ext = String(cur.ext || '').toLowerCase();
  const auto = ff.available && (COMPAT_EXT.includes(ext) || store('compatAlways'));
  if (!opts.direct && (opts.compat || auto) && ff.available) return startCompat(cur, opts.start != null ? opts.start : savedPos(cur));
  cur.mode = 'direct';
  startEngine(cur.url, ext, false, cur);
  updateCompatButton(cur);
}

async function startCompat(cur, start) {
  cur.mode = 'compat';
  updateCompatButton(cur);
  if (!cur.probe) {
    stopPlayer();
    player.current = cur;
    setMsg('Kompatibilitätsmodus: Datei wird geprüft ...');
    try {
      cur.probe = await localApi('GET', '/transcode/probe?url=' + encodeURIComponent(cur.url));
    } catch (err) {
      cur.probe = { error: err.message };
    }
    if (player.current !== cur) return;
    if (cur.probe.error) {
      const err = cur.probe.error;
      cur.probe = null;
      fileFailed(cur, 'Datei nicht lesbar: ' + err);
      return;
    }
  }
  const pr = cur.probe;
  let v = 'x264';
  if (!pr.video) v = 'copy';
  else if (!cur.forceX264 && pr.video === 'h264') v = 'copy';
  else if (!cur.forceX264 && pr.video === 'hevc' && hevcSupported()) v = 'hevc';
  cur.vmode = v;
  cur.duration = pr.duration || 0;
  const a = pickAudio(pr.audio);
  const st = Math.max(0, Math.floor(start || 0));
  cur.restart = () => startCompat(cur, curPos());
  // Umwandlung als HLS starten (Safari braucht das; Chrome spielt es ueber hls.js)
  const token = (cur.compatToken = (cur.compatToken || 0) + 1);
  slotNote('Umwandlung startet ...');
  let sess;
  try {
    sess = await localApi('POST', '/transcode/start', { url: cur.url, start: st, v, a: a >= 0 ? a : null });
  } catch (err) {
    if (cur.compatToken !== token || (player.current && player.current !== cur)) return;
    slotNote('');
    if (v !== 'x264' && !cur.forceX264 && /Umwandlung fehlgeschlagen/.test(err.message)) { cur.forceX264 = true; startCompat(cur, st); return; }
    fileFailed(cur, err.message);
    return;
  }
  if (cur.compatToken !== token || (player.current && player.current !== cur)) {
    localApi('POST', '/transcode/stop', { id: sess.id }).catch(() => {});
    return;
  }
  slotNote('');
  const src = `/transcode/hls/${sess.id}/index.m3u8?t=${TOKEN}`;
  startEngine(null, 'm3u8', false, cur, src);
  player.compatSess = sess.id;
  cur.offset = st;
  showCompatBar(cur);
  setTimeout(() => { const m = role('msg'); if (m && /^Kompatibilitätsmodus aktiv/.test(m.textContent)) m.classList.add('info'); }, 0);
  setMsg(`Kompatibilitätsmodus aktiv (${[pr.container, pr.video, pr.audio && pr.audio[0] && pr.audio[0].codec].filter(Boolean).join(', ')}${v === 'x264' ? '; Bild wird umgerechnet, braucht mehr Rechenleistung' : ''}).`);
  updateCompatButton(cur);
}

function updateCompatButton(cur) {
  const b = role('compat');
  if (!b) return;
  b.textContent = cur && cur.mode === 'compat' ? 'Normalmodus' : 'Kompatibilitätsmodus';
  b.classList.toggle('active-filter', !!(cur && cur.mode === 'compat'));
}

const fmtClock = (sec) => {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

// eigene Zeitleiste, weil der umgewandelte Datenstrom keine Gesamtlaenge kennt
// Springen: innerhalb des schon umgewandelten Bereichs direkt, sonst Umwandlung ab der Stelle neu starten
function compatSeek(cur, t) {
  const target = Math.max(0, Math.min(t, (cur.duration || t + 1) - 1));
  const rel = target - (cur.offset || 0);
  const b = video.buffered;
  for (let i = 0; i < b.length; i++) {
    if (rel >= b.start(i) && rel <= b.end(i) - 0.5) { video.currentTime = rel; return; }
  }
  startCompat(cur, target);
}

const SVGI = (d) => { const sp = document.createElement('span'); sp.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`; return sp.firstChild; };
const IC_PLAY = '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor" stroke="none"/>';
const IC_PAUSE = '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>';
const IC_VOL = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>';
const IC_MUTE = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>';
const IC_FULL = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';

// eigene Steuerung im Kompatibilitaetsmodus: der Browser kennt dort die Gesamtlaenge nicht
function showCompatBar(cur) {
  const slot = role('slot');
  if (!slot) return;
  video.controls = false;
  const total = cur.duration || 0;
  const play = el('button', { class: 'cb-btn', title: 'Abspielen / Pause (Leertaste)' });
  const setPlayIcon = () => play.replaceChildren(SVGI(video.paused ? IC_PLAY : IC_PAUSE));
  setPlayIcon();
  play.addEventListener('click', () => (video.paused ? video.play().catch(() => {}) : video.pause()));
  const back = el('button', { class: 'cb-btn txt', title: '30 Sekunden zurück', onclick: () => compatSeek(cur, curPos() - 30) }, '−30');
  const fwd = el('button', { class: 'cb-btn txt', title: '30 Sekunden vor', onclick: () => compatSeek(cur, curPos() + 30) }, '+30');
  const time = el('span', { class: 'cb-time' });
  const ends = el('span', { class: 'cb-ends' });
  const range = el('input', { type: 'range', min: 0, max: Math.max(1, Math.floor(total || 1)), step: 1, value: cur.offset, disabled: !total, title: 'Zeitleiste' });
  let dragging = false;
  range.addEventListener('input', () => { dragging = true; time.textContent = `${fmtClock(range.value)} / ${total ? fmtClock(total) : '--:--'}`; });
  range.addEventListener('change', () => { dragging = false; compatSeek(cur, Number(range.value)); });
  const mute = el('button', { class: 'cb-btn', title: 'Ton aus/an' });
  const setVolIcon = () => mute.replaceChildren(SVGI(video.muted || video.volume === 0 ? IC_MUTE : IC_VOL));
  setVolIcon();
  mute.addEventListener('click', () => { video.muted = !video.muted; setVolIcon(); });
  const vol = el('input', { type: 'range', class: 'cb-vol', min: 0, max: 1, step: 0.05, value: video.muted ? 0 : video.volume, title: 'Lautstärke' });
  vol.addEventListener('input', () => { video.volume = Number(vol.value); video.muted = video.volume === 0; setVolIcon(); });
  const full = el('button', { class: 'cb-btn', title: 'Vollbild (F)', onclick: () => goFullscreen() }, SVGI(IC_FULL));
  const bar = el('div', { class: 'cbar' },
    el('div', { class: 'cb-row' }, range),
    el('div', { class: 'cb-row' }, play, back, fwd, time, ends, el('span', { class: 'cb-grow' }), mute, vol, full));
  bar._update = () => {
    if (player.current !== cur) return;
    const p = curPos();
    if (!dragging) {
      range.value = Math.floor(p);
      time.textContent = `${fmtClock(p)} / ${total ? fmtClock(total) : '--:--'}`;
    }
    ends.textContent = total ? 'endet um ' + new Date(Date.now() + Math.max(0, total - p) * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
    setPlayIcon();
  };
  bar._update();
  slot.append(bar);
}

// Klick ins Bild = Pause/Weiter, Doppelklick = Vollbild (nur Kompatibilitaetsmodus, sonst eigene Browser-Steuerung)
video.addEventListener('click', () => {
  if (!player.current || player.current.mode !== 'compat') return;
  if (video.paused) video.play().catch(() => {}); else video.pause();
});
video.addEventListener('dblclick', () => { if (player.current && player.current.mode === 'compat') goFullscreen(); });
for (const ev of ['play', 'pause']) video.addEventListener(ev, () => { const cb = document.querySelector('.cbar'); if (cb && cb._update) cb._update(); });

async function fileError(cur) {
  const ff = await ffStatus();
  if (player.current !== cur) return;
  const code = video.error ? video.error.code : 0;
  if (cur.mode !== 'compat') {
    if (ff.available && !cur.triedCompat) {
      cur.triedCompat = true;
      slotNote('Format nicht abspielbar – wechsle in den Kompatibilitätsmodus ...');
      startCompat(cur, Math.max(curPos(), savedPos(cur)));
      return;
    }
    if (code === 2) { scheduleReconnect('Verbindung unterbrochen'); return; }
    fileFailed(cur);
    return;
  }
  // im Kompatibilitaetsmodus: erst Bild umrechnen, dann neu verbinden
  if (cur.vmode !== 'x264' && !cur.forceX264) {
    cur.forceX264 = true;
    startCompat(cur, curPos());
    return;
  }
  scheduleReconnect('Verbindung unterbrochen');
}

async function fileFailed(cur, extra) {
  let diag = extra || '';
  if (!diag) {
    try {
      const r = await fetch(proxied(cur.url), { headers: { Range: 'bytes=0-1' } });
      diag = r.ok ? `Format ${String(cur.ext || '?').toUpperCase()}${r.headers.get('content-type') ? ', ' + r.headers.get('content-type') : ''}` : `Anbieter meldet Fehler ${r.status}`;
      if (r.body) r.body.cancel().catch(() => {});
    } catch { /* ohne Zusatzinfo */ }
  }
  if (player.current !== cur) return;
  const ff = compat.status || {};
  setMsg(`Datei kann im Browser nicht abgespielt werden${diag ? ' (' + diag + ')' : ''}. `
    + (ff.available ? '' : 'Abhilfe: ffmpeg installieren (Datei „ffmpeg-installieren“ im App-Ordner, danach App neu starten) oder ')
    + 'in VLC öffnen.', { label: 'In VLC öffnen', fn: () => openInVlc(cur) });
}

async function openInVlc(cur) {
  const url = cur.url;
  closeOverlay('player'); // Verbindung freigeben (viele Zugaenge erlauben nur eine gleichzeitig)
  try {
    await localApi('GET', '/transcode/vlc?url=' + encodeURIComponent(url));
    toast('VLC wird geöffnet');
  } catch (err) {
    toast(err.message);
  }
}

// beim Start an gespeicherter Stelle fortsetzen
video.addEventListener('loadedmetadata', () => {
  const cur = player.current;
  if (!cur || cur.kind === 'live' || cur.mode === 'compat') return;
  const p = getProg(cur.kind, cur.id);
  if (p && !p.done && p.pos > 30 && (!isFinite(video.duration) || p.pos < video.duration - 30)) {
    video.currentTime = p.pos;
    toast('Fortsetzen bei ' + Math.floor(p.pos / 60) + ' Min.');
  }
});

function saveCurrentPos() {
  const cur = player.current;
  if (!cur || cur.kind === 'live' || !video.currentTime) return;
  updateProg(cur.kind, cur.id, { pos: Math.floor(curPos()), dur: Math.floor(curDur()) });
  if (cur.kind === 'episode' && state.seriesProg[cur.series.series_id]) state.seriesProg[cur.series.series_id].t = Date.now();
  saveProgress();
}

video.addEventListener('timeupdate', () => {
  const cb = document.querySelector('.cbar');
  if (cb && cb._update) cb._update();
  const now = Date.now();
  if (now - player.saveTimer < 5000) return;
  player.saveTimer = now;
  saveCurrentPos();
});
video.addEventListener('pause', saveCurrentPos);

video.addEventListener('ended', () => {
  const cur = player.current;
  if (!cur || cur.kind === 'live') return;
  const dur = Math.floor(curDur()) || Math.floor(curPos());
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
// Menue "…" (weitere Optionen)
document.addEventListener('click', (e) => {
  const more = e.target.closest('[data-role="more"]');
  document.querySelectorAll('[data-role="menu"]').forEach((m) => {
    const own = more && m.parentElement.contains(more);
    if (own) m.classList.toggle('hidden');
    else if (!m.contains(e.target) || e.target.closest('button')) m.classList.add('hidden');
  });
});

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
      case 'stats': state.playback.stats = !state.playback.stats; savePlayback(); break;
      case 'vlc': openInVlc(cur); break;
      case 'compat':
        if (cur.kind === 'live') break;
        if (cur.mode === 'compat') { const at = curPos(); stopPlayer(); player.current = cur; updateProg(cur.kind, cur.id, { pos: Math.floor(at) }); startFile(cur, { direct: true }); }
        else startCompat(cur, curPos() || savedPos(cur));
        break;
      case 'format': {
        const next = cur.ext === 'm3u8' ? 'ts' : 'm3u8';
        setFormatOverride(cur.item, next);
        player.triedFallback = true;
        playLive(cur.index, true);
        toast(`Format für diesen Sender: ${next.toUpperCase()}`);
        break;
      }
      case 'opts': openPlayback(); break;
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
    else if (overlayOpen('imdbDlg')) closeOverlay('imdbDlg');
    else if (overlayOpen('playDlg')) closeOverlay('playDlg');
    else if (overlayOpen('qualDlg')) closeOverlay('qualDlg');
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
  if (e.key === ' ' && player.current && player.current.mode === 'compat') {
    e.preventDefault();
    if (video.paused) video.play().catch(() => {}); else video.pause();
  }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && player.current && player.current.mode === 'compat') {
    e.preventDefault();
    compatSeek(player.current, curPos() + (e.key === 'ArrowLeft' ? -10 : 10));
  }
  if (e.key.toLowerCase() === 'i' && state.playback) { state.playback.stats = !state.playback.stats; savePlayback(); }
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
