const { chromium } = require('playwright');
const log = (...a) => console.log(...a);
const NOFF = process.argv[2] === 'noff';
async function openFilm(p, name) {
  await p.click('[data-tab=vod]');
  await p.click('.cat[data-cat="__all"]');
  await p.locator('.card', { hasText: name }).first().click();
  await p.click('#detailBody .btn.primary');
}
const st = (p) => p.evaluate(() => ({ pos: Math.round(curPos()), w: document.querySelector('video').videoWidth, mode: player.current && player.current.mode, vmode: player.current && player.current.vmode, msg: document.querySelector('#playerBox [data-role=msg]').textContent }));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080');
  const f = p.locator('#loginForm');
  await f.locator('[name=server]').fill('localhost:9000');
  await f.locator('[name=username]').fill('max');
  await f.locator('[name=password]').fill('geheim');
  await f.locator('button').click();
  await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=live]'); await p.waitForSelector('.main .row');
  log('ffmpeg-Status:', await p.evaluate(() => ffStatus()));

  if (NOFF) {
    await openFilm(p, 'Film MPEG4 Bild');
    await p.waitForSelector('#playerBox [data-role=msg] button', { timeout: 40000 });
    log('Ohne ffmpeg, Meldung:', await p.textContent('#playerBox [data-role=msg]'));
    await p.click('#playerBox [data-role=msg] button');
    await p.waitForSelector('#toast:not(.hidden)');
    log('VLC-Knopf:', await p.textContent('#toast'), '| Player geschlossen:', await p.locator('#player.hidden').count() === 1);
    log('Seitenfehler:', errs);
    await b.close();
    return;
  }

  // 1. MKV mit AC3-Ton
  await openFilm(p, 'Film MKV AC3');
  await p.waitForFunction(() => document.querySelector('video').currentTime > 2 && document.querySelector('video').videoWidth > 0, null, { timeout: 30000 });
  log('MKV/AC3:', await st(p), '| Zeitleiste:', await p.locator('.cbar').count());
  await p.screenshot({ path: __dirname + '/v9-kompat.png' });
  await p.evaluate(() => { const r = document.querySelector('.cbar input'); r.value = 30; r.dispatchEvent(new Event('change')); });
  await p.waitForFunction(() => curPos() > 31 && document.querySelector('video').currentTime > 0.5, null, { timeout: 20000 });
  log('Nach Sprung auf 0:30:', await st(p));
  await p.waitForTimeout(2500);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await openFilm(p, 'Film MKV AC3');
  await p.waitForFunction(() => document.querySelector('video').currentTime > 0.5, null, { timeout: 20000 });
  log('Wieder geoeffnet (fortsetzen):', await st(p));
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');

  // 2. MP4 mit MPEG-4-Bild (Browser kann es nicht)
  await openFilm(p, 'Film MPEG4 Bild');
  await p.waitForFunction(() => player.current && player.current.mode === 'compat' && document.querySelector('video').videoWidth > 0 && document.querySelector('video').currentTime > 1, null, { timeout: 60000 });
  log('MPEG-4:', await st(p));
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');

  // 3. normales MP4 bleibt im Normalmodus
  await openFilm(p, 'Das Wunder von Bern');
  await p.waitForFunction(() => document.querySelector('video').currentTime > 1.5, null, { timeout: 20000 });
  await p.waitForTimeout(3000);
  log('Normales MP4:', await st(p));
  await p.click('#playerBox [data-role=more]'); await p.click('#playerBox [data-role=compat]');
  await p.waitForFunction(() => player.current.mode === 'compat' && document.querySelector('video').currentTime > 1, null, { timeout: 30000 });
  log('Von Hand Kompatibilitaetsmodus:', await st(p), '| Knopf:', await p.textContent('#playerBox [data-role=compat]'));
  await p.click('#playerBox [data-role=more]'); await p.click('#playerBox [data-role=compat]');
  await p.waitForFunction(() => player.current.mode === 'direct' && document.querySelector('video').currentTime > 1, null, { timeout: 30000 });
  log('Zurueck in Normalmodus:', await st(p));
  await p.click('#playerBox [data-role=more]'); await p.click('#playerBox [data-role=vlc]');
  await p.waitForSelector('#toast:not(.hidden)');
  log('VLC:', await p.textContent('#toast'));
  log('Seitenfehler:', errs);
  await b.close();
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
