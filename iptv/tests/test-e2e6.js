const { chromium } = require('playwright');
const log = (...a) => console.log(...a);
async function search(p, q) { await p.fill('#search', q); await p.waitForTimeout(400); await p.waitForFunction(() => document.querySelector('.sr-section[data-state="done"]')); await p.waitForTimeout(200); }
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 880 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080');
  const f = p.locator('#loginForm');
  await f.locator('[name=server]').fill('localhost:9000');
  await f.locator('[name=username]').fill('max');
  await f.locator('[name=password]').fill('geheim');
  await f.locator('button').click();
  await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=live]'); await p.waitForSelector('.main .row');
  const t0 = Date.now();
  await p.waitForFunction(async () => {
    const r = await fetch('/epg/status?account=' + encodeURIComponent('http://localhost:9000|max'), { headers: { 'X-SportTV': '1' } }).then((x) => x.json());
    return r.status === 'bereit';
  }, null, { timeout: 60000, polling: 1000 });
  log('Programmfuehrer geladen nach', Math.round((Date.now() - t0) / 1000), 's');

  await search(p, 'bayern');
  log('Abschnitte:', await p.locator('.sr-section h3').allTextContents());
  log('Im Programm:', await p.locator('.prog-row .name').allTextContents());
  log('Zeiten:', await p.locator('.prog-row .when').allTextContents());
  log('Info:', await p.textContent('.guide-info'));
  await p.screenshot({ path: __dirname + '/v6-suche.png' });

  // Laufende Sendung anklicken -> spielt
  await p.locator('.prog-row.running').first().click();
  await p.waitForFunction(() => document.querySelector('video') && document.querySelector('video').currentTime > 1);
  log('Laeuft:', await p.textContent('#preview [data-role=title]'));
  await p.waitForSelector('#preview .epg-item');
  log('Glocken im Kurzprogramm:', await p.locator('#preview .epg-item .bell').count());

  // Filter: Nur Deutsch -> franzoesischer Treffer verschwindet
  await p.keyboard.press('Escape');
  await p.evaluate(() => openFilter());
  await p.click('text=Nur Deutsch (DE, AT, CH)');
  await p.keyboard.press('Escape');
  await search(p, 'bayern');
  log('Nach Nur Deutsch:', await p.locator('.prog-row .name').allTextContents());

  // Erinnerung
  await search(p, 'formel 1');
  log('Formel 1:', await p.locator('.prog-row .name').allTextContents(), await p.locator('.prog-row .when').allTextContents());
  await p.locator('.prog-row', { hasText: 'Brasilien' }).locator('.bell').click();
  log('Glocke an:', await p.locator('.prog-row', { hasText: 'Brasilien' }).locator('.bell.on').count());
  await p.keyboard.press('Escape');
  await p.click('.cat[data-cat="__rem"]');
  log('Erinnerungen:', await p.locator('.prog-row .name').allTextContents(), '| Seitenleiste:', await p.textContent('.cat[data-cat="__rem"]'));
  await p.locator('.rem-settings select').selectOption('5');
  await p.locator('.rem-settings input[type=checkbox]').check();
  await p.screenshot({ path: __dirname + '/v6-erinnerungen.png' });
  await p.waitForSelector('#remBar', { timeout: 20000 });
  log('Hinweis:', await p.textContent('#remBar .nu-txt'));
  await p.screenshot({ path: __dirname + '/v6-hinweis.png' });
  await p.waitForFunction(() => document.querySelector('#preview [data-role=title]').textContent.startsWith('Sender 5'), null, { timeout: 20000 });
  log('Automatisch umgeschaltet auf:', await p.textContent('#preview [data-role=title]'), '| Hinweis weg:', await p.locator('#remBar').count() === 0);

  await p.reload();
  await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=live]'); await p.waitForSelector('.main .row');
  await p.click('[data-tab=live]');
  log('Nach Neuladen, Erinnerungen:', await p.textContent('.cat[data-cat="__rem"]'), '| kein erneuter Hinweis:', await p.waitForSelector('#remBar', { timeout: 12000 }).then(() => false).catch(() => true));
  log('Seitenfehler:', errs);
  await b.close();
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
