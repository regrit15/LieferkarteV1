const { chromium } = require('playwright');
const SHOT = __dirname + '/v2-';
const playing = (p) => p.waitForFunction(() => { const v = document.querySelector('video'); return v && v.currentTime > 1.5 && !v.paused; }, null, { timeout: 20000 });
const log = (...a) => console.log(...a);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 880 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080');
  const f = p.locator('#loginForm');
  await f.locator('[name=server]').fill('localhost:9000');
  await f.locator('[name=username]').fill('max');
  await f.locator('[name=password]').fill('geheim');
  await f.locator('button').click();
  await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=live]'); await p.waitForSelector('.main .row');
  await p.click('.cat[data-cat="__all"]');
  await p.waitForSelector('.row');

  log('Sidebar:', (await p.locator('#sidebar .cat').allTextContents()).join(' / '));

  // Vorschau
  await p.locator('.row').first().click();
  await playing(p);
  await p.waitForSelector('#preview .epg-item');
  log('Vorschau laeuft im Panel:', await p.locator('#preview video').count() === 1, '|', await p.textContent('#preview [data-role=title]'));
  await p.waitForFunction(() => [...document.querySelectorAll('.row .now')].some((n) => n.textContent));
  log('EPG in Zeile:', await p.locator('.row .now').first().textContent());
  await p.keyboard.press('ArrowDown');
  await p.waitForFunction(() => document.querySelector('#preview [data-role=title]').textContent.startsWith('Sender 2 '));
  await playing(p);
  log('Pfeil runter ->', await p.textContent('#preview [data-role=title]'), '| markiert:', await p.textContent('.row.playing .name'));
  await p.screenshot({ path: SHOT + '1-live.png' });

  // Suche waehrend Vorschau laeuft
  await p.keyboard.press('/');
  await p.keyboard.type('sky premier');
  await p.waitForFunction(() => document.querySelector('#listTitle').textContent.includes('sky premier'));
  await p.waitForTimeout(300);
  log('Suche "sky premier":', await p.textContent('#listCount'), (await p.locator('.sr-section h3').allTextContents()).join(','));
  await p.fill('#search', 'hamilton');
  await p.waitForTimeout(400);
  log('Suche "hamilton" (Besetzung):', await p.textContent('#listCount'), await p.locator('.sr-section .card .title').allTextContents());
  await p.fill('#search', 'wunder bern');
  await p.waitForTimeout(400);
  log('Suche "wunder bern":', await p.locator('.sr-section .card .title').allTextContents());
  await p.fill('#search', 'sender 1');
  await p.waitForTimeout(400);
  log('Suche "sender 1":', await p.textContent('#listCount'), '| Vorschau laeuft weiter:', await p.evaluate(() => !document.querySelector('video').paused));
  await p.screenshot({ path: SHOT + '2-suche.png' });
  await p.keyboard.press('Escape');

  // Laenderfilter
  await p.click('#filterBtn');
  await p.waitForSelector('.f-item');
  log('Erkannte Laender:', (await p.locator('.f-item .code').allTextContents()).join(' '));
  await p.screenshot({ path: SHOT + '3-filter.png' });
  await p.click('text=Nur Deutsch (DE, AT, CH)');
  await p.waitForTimeout(200);
  log('Filterknopf:', await p.textContent('#filterBtn'));
  await p.keyboard.press('Escape');
  log('Sidebar nach Filter:', (await p.locator('#sidebar .cat').allTextContents()).join(' / '));
  await p.locator('.cat', { hasText: 'Alle Sender' }).click();
  const names = await p.locator('.row .name').allTextContents();
  log('Sender nach Filter:', names.length, '| FR/AR/TR/UK uebrig:', names.filter((n) => /^(FR|AR|TR|UK):|MBC/.test(n)));
  await p.fill('#search', 'sport');
  await p.waitForTimeout(400);
  log('Suche nach Filter enthaelt FR?', (await p.locator('.row .name').allTextContents()).some((n) => n.startsWith('FR')));
  await p.keyboard.press('Escape');

  // Kategorie einzeln ausblenden
  await p.locator('.cat-wrap', { hasText: 'Kinder' }).hover();
  await p.locator('.cat-wrap', { hasText: 'Kinder' }).locator('.cat-hide').click();
  log('Nach Ausblenden "Kinder":', (await p.locator('#sidebar .cat').allTextContents()).some((t) => t.includes('Kinder')), '|', await p.textContent('#filterBtn'));

  // Filme mit Thumbnails
  await p.click('[data-tab=vod]');
  await p.click('.cat >> text=Alle Filme');
  await p.waitForSelector('.card');
  await p.waitForTimeout(500);
  log('Filme:', await p.locator('.card .title').allTextContents(), '| echte Bilder geladen:', await p.evaluate(() => [...document.querySelectorAll('img.poster')].filter((i) => i.naturalWidth > 0).length), '| Platzhalter:', await p.locator('.poster.ph').count());
  await p.screenshot({ path: SHOT + '4-filme.png' });
  await p.locator('.card', { hasText: 'Wunder' }).click();
  await p.waitForSelector('.backdrop');
  await p.waitForTimeout(300);
  await p.screenshot({ path: SHOT + '5-film-detail.png' });
  await p.click('#detailBody .btn.primary');
  await playing(p);
  log('Film laeuft im grossen Player');
  await p.keyboard.press('Escape');
  await p.keyboard.press('Escape');

  await p.click('[data-tab=series]');
  await p.waitForSelector('.card');
  await p.locator('.card').first().click();
  await p.waitForSelector('.episode');
  await p.waitForTimeout(300);
  await p.screenshot({ path: SHOT + '6-serie.png' });
  await p.locator('.episode').first().click();
  await playing(p);
  log('Folge laeuft:', await p.textContent('#playerBox [data-role=sub]'));
  await p.keyboard.press('Escape');
  await p.keyboard.press('Escape');

  // Filter bleibt nach Neuladen
  await p.reload();
  await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=live]'); await p.waitForSelector('.main .row');
  log('Nach Neuladen:', await p.textContent('#filterBtn'));
  await p.click('#filterBtn');
  await p.click('text=Alle Länder zeigen');
  await p.keyboard.press('Escape');
  await p.click('[data-tab=live]');
  await p.waitForSelector('.row');
  log('Alle Laender wieder:', (await p.locator('#sidebar .cat').allTextContents()).filter((t) => /FR|AR|TR|UK/.test(t)).length, 'Laenderkategorien');

  await p.setViewportSize({ width: 390, height: 820 });
  await p.screenshot({ path: SHOT + '7-mobil.png' });
  log('Seitenfehler:', errs);
  await b.close();
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
