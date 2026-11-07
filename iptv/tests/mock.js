// Simulierter Xtream-Codes-Server nur fuer Tests
const http = require('http');
const fs = require('fs');
const path = require('path');
const M = path.join(__dirname, 'media');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const liveCats = [
  { category_id: '1', category_name: 'DE | Sport' },
  { category_id: '2', category_name: 'DE | Bundesliga' },
  { category_id: '3', category_name: 'DE | Nachrichten' },
  { category_id: '4', category_name: 'DE | Kinder' },
  { category_id: '5', category_name: 'FR | Sport' },
  { category_id: '6', category_name: '|AR| beIN Sports' },
  { category_id: '7', category_name: 'ARABIC GENERAL' },
  { category_id: '8', category_name: 'TR: Ulusal' },
  { category_id: '9', category_name: 'UK | Sky Sports' },
];
const IMG = 'http://localhost:9000/img/';
const live = [];
for (let i = 1; i <= 400; i++) {
  const cat = String(((i - 1) % 4) + 1);
  live.push({ num: i, name: `Sender ${i} ${cat === '1' ? 'Sport HD' : cat === '2' ? 'Liga Konferenz' : cat === '3' ? 'News' : 'Kids'}`, stream_id: i, stream_icon: i % 3 ? IMG + 'logo.png' : '', category_id: cat, epg_channel_id: 'ch' + i });
}
const extra = [['5', 'FR: Canal+ Sport'], ['5', 'FR: RMC Sport 1'], ['6', 'AR: beIN Sports 1 HD'], ['7', 'MBC 1'], ['8', 'TR: TRT 1'], ['9', 'UK: Sky Sports Premier League'], ['1', 'FR: Eurosport France']];
extra.push(['1', 'DE: Sky Sport 1 SD'], ['1', 'DE: Sky Sport 1 HD'], ['1', 'DE: Sky Sport 1 FHD'], ['1', 'DE: Sky Sport 1 4K'],
  ['1', 'DE: Sport1'], ['1', 'DE: Sport1+'], ['2', 'DE: DAZN 1 ᴴᴰ'], ['2', 'DE: DAZN 1 ᶠᴴᴰ']);
extra.forEach(([cat, name], k) => live.push({ num: 401 + k, name, stream_id: 401 + k, stream_icon: '', category_id: cat, epg_channel_id: '' }));
live.push({ num: 451, name: 'DE: Haenger Sport', stream_id: 451, stream_icon: '', category_id: '1', epg_channel_id: '' });
live.push({ num: 452, name: 'DE: Kaputt Sport', stream_id: 452, stream_icon: '', category_id: '1', epg_channel_id: '' });
live.find((x) => x.name === 'FR: Canal+ Sport').epg_channel_id = 'fr1';
live.push({ num: 460, name: 'DE: Sky Sport F1 HD', stream_id: 460, stream_icon: '', category_id: '1', epg_channel_id: 'skyf1' });
live.push({ num: 461, name: 'DE: Sky Sport Golf', stream_id: 461, stream_icon: '', category_id: '1', epg_channel_id: 'golf' });

function xt(t) { const d = new Date(t * 1000); const z = (n) => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())} +0000`; }
function xmltv() {
  const now = Math.floor(Date.now() / 1000);
  const base = now - (now % 3600) - 7200;
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="mock">'];
  const titles = ['Sportschau', 'Nachrichten', 'Doppelpass', 'Sport am Abend', 'Wetter'];
  const add = (ch, s, e, t, d) => out.push(`<programme start="${xt(s)}" stop="${xt(e)}" channel="${ch}"><title lang="de">${t}</title>${d ? `<desc lang="de">${d}</desc>` : ''}</programme>`);
  for (let i = 1; i <= 400; i++) {
    for (let h = 0; h < 80; h++) {
      const s = base + h * 3600;
      if (i === 1 && s <= now && s + 3600 > now) { add('ch1', now - 1800, now + 5400, 'Bundesliga: FC Bayern München – Borussia Dortmund', 'Live aus der Allianz Arena'); continue; }
      add('ch' + i, s, s + 3600, titles[(i + h) % titles.length], i === 2 && h === 5 ? 'Talk über den FC Bayern &amp; die Liga' : '');
    }
  }
  add('ch5', now + 150, now + 7350, 'Formel 1: Großer Preis von Brasilien', 'Das Rennen aus São Paulo');
  add('skyf1', now - 600, now + 3000, 'Formel 1: Qualifying Brasilien', 'Live aus Interlagos');
  add('golf', now - 600, now + 3000, 'Golf: DP World Tour', '');
  add('ch9', now + 86400, now + 90000, 'Tennis: ATP Finals – Halbfinale', '');
  add('fr1', now + 3600, now + 9000, 'Champions League: PSG – Bayern', '');
  out.push('</tv>');
  return out.join('\n');
}
const vodCats = [{ category_id: '10', category_name: 'Sport Dokus' }, { category_id: '11', category_name: 'Action' }, { category_id: '12', category_name: 'FR | Films' }];
const vod = [
  { name: 'Das Wunder von Bern', stream_id: 1001, stream_icon: IMG + 'poster1.jpg', category_id: '10', container_extension: 'mp4', rating: '7.1', year: '2003' },
  { name: 'Testfilm Action', stream_id: 1002, stream_icon: IMG + 'poster2.jpg', category_id: '11', container_extension: 'mp4', rating: '6.0', year: '2020' },
  { name: 'French Connection', stream_id: 1003, stream_icon: '', category_id: '11', container_extension: 'mp4', rating: '7.7', year: '1971' },
  { name: 'Bild fehlt kaputt', stream_id: 1004, stream_icon: IMG + 'gibtsnicht.jpg', category_id: '11', container_extension: 'mkv' },
  { name: 'Le Film Français', stream_id: 1005, stream_icon: IMG + 'poster3.jpg', category_id: '12', container_extension: 'mp4' },
  { name: 'DE - Oppenheimer (2023)', stream_id: 1006, stream_icon: IMG + 'poster2.jpg', category_id: '11', container_extension: 'mp4', rating: '8.1', added: String(Math.floor(Date.now() / 1000) - 400 * 86400) },
  { name: 'Neuer Actionfilm 2026', stream_id: 1007, stream_icon: '', category_id: '11', container_extension: 'mp4', rating: '6.4', year: '2026', added: String(Math.floor(Date.now() / 1000) - 3 * 86400) },
  { name: 'Drama Aktuell', stream_id: 1008, stream_icon: '', category_id: '11', container_extension: 'mp4', rating: '7.9', year: '2025', added: String(Math.floor(Date.now() / 1000) - 10 * 86400) },
  { name: '4K-DE - Drama Aktuell (2025)', stream_id: 1010, stream_icon: '', category_id: '11', container_extension: 'mp4', rating: '7.9' },
  { name: 'Drama Aktuell (2025) (US)', stream_id: 1011, stream_icon: '', category_id: '11', container_extension: 'mp4', rating: '9.6' },
  { name: 'Film MKV AC3', stream_id: 2001, stream_icon: '', category_id: '11', container_extension: 'mkv', year: '2025' },
  { name: 'Film MPEG4 Bild', stream_id: 2002, stream_icon: '', category_id: '11', container_extension: 'mp4', year: '2025' },
  { name: 'Alter Klassiker', stream_id: 1009, stream_icon: '', category_id: '11', container_extension: 'mp4', rating: '8.6', year: '1994', added: String(Math.floor(Date.now() / 1000) - 2 * 86400) },
];
const seriesCats = [{ category_id: '20', category_name: 'Sport Serien' }, { category_id: '21', category_name: 'Krimi' }];
const series = [
  { name: 'Formel 1: Drive to Survive', series_id: 501, cover: IMG + 'poster3.jpg', category_id: '20', rating: '8.0', releaseDate: '2019-03-08', genre: 'Dokumentation', cast: 'Lewis Hamilton, Max Verstappen', plot: 'Hinter den Kulissen der Rennställe.' },
  { name: 'Tatort Test', series_id: 502, cover: '', category_id: '21', genre: 'Krimi', cast: 'Axel Prahl', plot: 'Kommissar ermittelt in Münster.' },
];

function json(res, o) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); }

function sendFile(req, res, file, type) {
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range) {
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = Number(s); const end = e ? Number(e) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  }
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  console.log(req.method, u.pathname, u.searchParams.get('action') || '', req.headers['user-agent']);
  if (u.pathname === '/omdb/') {
    const q = u.searchParams;
    if (q.get('apikey') !== 'testkey') return json(res, { Response: 'False', Error: 'Invalid API key!' });
    const db = { 'tt0111161': ['The Shawshank Redemption', '9.3', '3,000,000'], 'das wunder von bern': ['Das Wunder von Bern', '7.1', '12,345', 'tt0363510'],
      'oppenheimer': ['Oppenheimer', '8.3', '900,000', 'tt15398776'], 'formel 1: drive to survive': ['Formula 1: Drive to Survive', '8.6', '45,000', 'tt8289930'] };
    const hit = q.get('i') ? db[q.get('i')] : db[(q.get('t') || '').toLowerCase()];
    if (!hit) return json(res, { Response: 'False', Error: 'Movie not found!' });
    return json(res, { Response: 'True', Title: hit[0], imdbRating: hit[1], imdbVotes: hit[2], imdbID: hit[3] || q.get('i'), Year: '2003' });
  }
  if (u.pathname === '/xmltv.php') {
    if (u.searchParams.get('password') !== 'geheim') { res.writeHead(401); return res.end(); }
    const body = xmltv();
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    // in Stuecken senden, damit das Zerlegen ueber Blockgrenzen geprueft wird
    let i = 0;
    const step = () => { if (i >= body.length) return res.end(); res.write(body.slice(i, i + 7777)); i += 7777; setImmediate(step); };
    return step();
  }
  if (u.pathname === '/player_api.php') {
    if (u.searchParams.get('username') !== 'max' || u.searchParams.get('password') !== 'geheim') return json(res, { user_info: { auth: 0 } });
    switch (u.searchParams.get('action')) {
      case null: return json(res, { user_info: { auth: 1, username: 'max', status: 'Active', exp_date: '1830000000', max_connections: '1', allowed_output_formats: ['m3u8', 'ts'] }, server_info: {} });
      case 'get_live_categories': return json(res, liveCats);
      case 'get_live_streams': return json(res, live);
      case 'get_vod_categories': return json(res, vodCats);
      case 'get_vod_streams': return json(res, vod);
      case 'get_series_categories': return json(res, seriesCats);
      case 'get_series': return json(res, series);
      case 'get_vod_info': return json(res, { info: { plot: 'WM 1954 in der Schweiz.', genre: 'Drama', releasedate: '2003-10-16', duration: '01:58:00', backdrop_path: [IMG + 'backdrop.jpg'], cast: 'Peter Lohmeyer', director: 'Sönke Wortmann' } });
      case 'get_series_info': return json(res, { info: { name: 'Formel 1: Drive to Survive', plot: 'Doku-Serie.', backdrop_path: [IMG + 'backdrop.jpg'] }, episodes: {
        1: [{ id: 9001, episode_num: 1, title: 'Folge Eins', container_extension: 'mp4', info: { duration: '00:40:00', movie_image: IMG + 'ep.jpg', plot: 'Saisonstart in Bahrain.' } }, { id: 9002, episode_num: 2, title: 'Folge Zwei', container_extension: 'mp4', info: {} }],
        2: [{ id: 9003, episode_num: 1, title: 'Staffel 2 Start', container_extension: 'mp4', info: {} }] } });
      case 'get_short_epg': {
        const now = Math.floor(Date.now() / 1000);
        return json(res, { epg_listings: [
          { title: b64('Bundesliga: Bayern – Dortmund'), description: b64('Live aus München'), start_timestamp: String(now - 1800), stop_timestamp: String(now + 3600) },
          { title: b64('Sportschau'), description: '', start_timestamp: String(now + 3600), stop_timestamp: String(now + 7200) } ] });
      }
      default: return json(res, []);
    }
  }
  // Live-HLS: Weiterleitung auf anderen Pfad (wie bei echten Anbietern)
  let m;
  if (u.pathname.startsWith('/img/')) {
    const f = path.join(M, 'img', path.basename(u.pathname));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    return sendFile(req, res, f, f.endsWith('.png') ? 'image/png' : 'image/jpeg');
  }
  if ((m = u.pathname.match(/^\/live\/max\/geheim\/(\d+)\.m3u8$/))) {
    if (m[1] === '3') { res.writeHead(404); return res.end(); } // kaputter Sender
    if (m[1] === '451') { res.writeHead(302, { Location: '/hls/stall.m3u8' }); return res.end(); }
    if (m[1] === '452') { res.writeHead(500); return res.end(); }
    res.writeHead(302, { Location: '/hls/index.m3u8?token=abc' }); return res.end();
  }
  if ((m = u.pathname.match(/^\/live\/max\/geheim\/(\d+)\.ts$/)) && m[1] === '452') { res.writeHead(500); return res.end(); }
  if ((m = u.pathname.match(/^\/live\/max\/geheim\/(\d+)\.ts$/))) {
    // durchgehender Live-Strom in Echtzeit, mit kurzem Aussetzer alle 25 s
    const file = fs.readFileSync(path.join(M, 'long.ts'));
    if (m[1] === '451') { res.writeHead(200, { 'Content-Type': 'video/mp2t' }); res.write(file.subarray(0, 188 * 4000)); return; } // haengt nach ca. 4 s
    const rate = file.length / 180; // Bytes pro Sekunde
    res.writeHead(200, { 'Content-Type': 'video/mp2t' });
    let pos = Math.floor(rate * 2 / 188) * 188; // 2 s Anlauf sofort
    res.write(file.subarray(0, pos));
    const t0 = Date.now();
    let paused = 0;
    const timer = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      if (el % 25 > 23.5) { paused += 0.1; return; }
      const want = Math.min(file.length, Math.floor((2 + el - paused) * rate / 188) * 188);
      if (want > pos) { res.write(file.subarray(pos, want)); pos = want; }
      if (pos >= file.length) { clearInterval(timer); res.end(); }
    }, 100);
    req.on('close', () => clearInterval(timer));
    return;
  }
  if (u.pathname.startsWith('/hls/')) {
    const f = path.join(M, 'hls', path.basename(u.pathname));
    return sendFile(req, res, f, f.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
  }
  if (u.pathname === '/movie/max/geheim/2001.mkv') return sendFile(req, res, path.join(M, 'film_ac3.mkv'), 'video/x-matroska');
  if (u.pathname === '/movie/max/geheim/2002.mp4') return sendFile(req, res, path.join(M, 'film_mpeg4.mp4'), 'video/mp4');
  if (/^\/series\/max\/geheim\/\d+\.mp4$/.test(u.pathname)) return sendFile(req, res, path.join(M, 'short.mp4'), 'video/mp4');
  if (/^\/(movie|series)\/max\/geheim\/\d+\.mp4$/.test(u.pathname)) return sendFile(req, res, path.join(M, 'movie.mp4'), 'video/mp4');
  res.writeHead(404); res.end();
}).listen(9000, () => console.log('mock on 9000'));
