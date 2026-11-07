const { chromium } = require('playwright');
const SHOT = __dirname + '/v3-';
const log = (...a) => console.log(...a);
const vt = (p) => p.evaluate(() => document.querySelector('video').currentTime);
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

  // Film anfangen
  await p.click('[data-tab=vod]');
  await p.click('.cat >> text=Alle Filme');
  await p.locator('.card', { hasText: 'Wunder' }).click();
  await p.click('#detailBody .btn.primary');
  await p.waitForFunction(() => document.querySelector('video').readyState >= 2);
  await p.evaluate(() => { document.querySelector('video').currentTime = 50; });
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');
  log('Film-Detail nach Abbruch:', await p.textContent('#detailBody .ep-state'), '|', await p.textContent('#detailBody .btn.primary'));
  await p.keyboard.press('Escape');
  log('Poster-Info:', await p.locator('.card', { hasText: 'Wunder' }).locator('.meta').textContent(), '| Balken:', await p.locator('.card', { hasText: 'Wunder' }).locator('.pbar').count());

  await p.click('[data-tab=cont]');
  await p.waitForSelector('.card');
  log('Weiter ansehen:', await p.locator('.card .title').allTextContents(), await p.locator('.card .meta').allTextContents());

  // Fortsetzen direkt aus "Weiter ansehen"
  await p.locator('.card').first().click();
  await p.waitForFunction(() => document.querySelector('video').currentTime > 40, null, { timeout: 15000 });
  log('Fortgesetzt bei Sekunde:', Math.round(await vt(p)));
  await p.evaluate(() => { document.querySelector('video').currentTime = 112; });
  await p.waitForTimeout(1500);
  await p.keyboard.press('Escape');
  log('Weiter ansehen nach 93%:', await p.locator('.card .title').allTextContents(), '| leer-Text:', await p.locator('.empty').count());

  // Serie
  await p.click('[data-tab=series]');
  await p.waitForSelector('.card');
  await p.locator('.card', { hasText: 'Formel' }).click();
  await p.waitForSelector('.episode');
  log('Serie neu:', await p.textContent('#detailBody .ep-state'), '|', await p.textContent('#detailBody .btn.primary'));
  await p.click('#detailBody .btn.primary');
  await p.waitForSelector('#nextUp', { timeout: 20000 });
  log('Countdown:', await p.textContent('#nextUp .nu-txt'));
  await p.screenshot({ path: SHOT + '1-countdown.png' });
  await p.waitForFunction(() => document.querySelector('#playerBox [data-role=sub]').textContent.includes('S1 E2'), null, { timeout: 15000 });
  log('Automatisch weiter:', await p.textContent('#playerBox [data-role=sub]'));
  await p.waitForTimeout(2000);
  await p.keyboard.press('Escape');
  log('Serie danach:', await p.textContent('#detailBody .ep-state'), '|', await p.textContent('#detailBody .btn.primary'), '| Haken:', await p.locator('.episode.seen').count());
  await p.screenshot({ path: SHOT + '2-serie.png' });
  await p.locator('.episode').nth(1).locator('.ep-mark').click();
  log('E2 manuell gesehen:', await p.textContent('#detailBody .ep-state'), '|', await p.textContent('#detailBody .btn.primary'), '| Staffeln:', await p.locator('.seasons button').allTextContents());
  await p.keyboard.press('Escape');

  // Abbrechen-Knopf testen: S2 E1 ist letzte Folge -> kein Countdown; daher E1 erneut und abbrechen
  await p.click('[data-tab=cont]');
  await p.waitForSelector('.card');
  log('Weiter ansehen:', await p.locator('.card .title').allTextContents(), await p.locator('.card .meta').allTextContents());
  await p.screenshot({ path: SHOT + '3-weiter.png' });

  await p.reload();
  await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=cont]'); await p.waitForSelector('.main .card');
  log('Nach Neuladen, Tab:', await p.textContent('.tab.active'), '|', await p.locator('.card .meta').allTextContents());
  await p.locator('.card .star').first().click();
  log('Nach Entfernen:', await p.locator('.card').count());
  log('Seitenfehler:', errs);
  await b.close();
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
