const { chromium } = require('playwright');
const log = (...a) => console.log(...a);
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
  await p.click('.cat[data-cat="__all"]');
  await p.waitForSelector('.row');
  await p.waitForFunction(async () => (await localApi('GET', '/epg/status?account=' + encodeURIComponent(accountKey()))).status === 'bereit', null, { polling: 1000, timeout: 60000 });

  await p.click('#viewToggle [data-view=grid]');
  await p.waitForSelector('.eg-prog');
  log('Zeilen:', await p.locator('.eg-row').count(), '| Zeitmarken:', (await p.locator('.eg-tick').allTextContents()).slice(0, 4).join(' '), '| Jetzt-Linie:', await p.locator('.eg-rows .eg-now').count());
  log('Horizontal auf jetzt gescrollt:', await p.evaluate(() => document.querySelector('#egScroll').scrollLeft));
  log('Laufend (Sender 1):', await p.locator('.eg-row[data-sid="1"] .eg-prog.live .eg-t').textContent());
  await p.locator('.eg-row[data-sid="1"] .eg-prog.live').click();
  await p.waitForFunction(() => document.querySelector('video') && document.querySelector('video').currentTime > 1);
  log('Spielt:', await p.textContent('#preview [data-role=title]'), '| markiert:', await p.locator('.eg-row.playing .eg-name').textContent());
  await p.screenshot({ path: __dirname + '/v7-raster.png' });

  const next = p.locator('.eg-row[data-sid="2"] .eg-prog:not(.live):not(.past)').first();
  const title = await next.locator('.eg-t').textContent();
  await next.click();
  await p.waitForSelector('#detailBody h2');
  log('Detail:', await p.textContent('#detailBody h2'), '|', await p.textContent('#detailBody .ep-state'));
  await p.click('#detailBody .detail-actions .btn:not(.primary)');
  log('Glocke gesetzt, Block markiert:', await p.locator('.eg-row[data-sid="2"] .eg-prog.rem').count(), '| Erinnerungen:', await p.textContent('.cat[data-cat="__rem"] .n'));
  await p.screenshot({ path: __dirname + '/v7-detail.png' });
  await p.keyboard.press('Escape');

  await p.evaluate(() => { const s = document.querySelector('#egScroll'); s.scrollTop = s.scrollHeight; });
  await p.waitForFunction(() => document.querySelectorAll('.eg-row').length > 50, null, { timeout: 10000 });
  log('Nach Scrollen Zeilen:', await p.locator('.eg-row').count());

  await p.click('.grid-bar >> text=Morgen');
  await p.waitForSelector('.eg-prog');
  log('Morgen erste Zeitmarke:', await p.locator('.eg-tick').first().textContent(), '| Jetzt-Linie:', await p.locator('.eg-rows .eg-now').count());
  await p.click('.grid-bar >> text=Jetzt');
  await p.waitForSelector('.eg-rows .eg-now');

  await p.locator('.sg-head', { hasText: 'Weiterer Sport' }).click();
  await p.click('.cat >> text=DE | Sport');
  await p.waitForSelector('.eg-row');
  await p.evaluate(() => { const s = document.querySelector('#egScroll'); s.scrollTop = s.scrollHeight; });
  await p.waitForTimeout(800);
  log('Kategorie DE | Sport im Raster:', await p.locator('.eg-row').count(), 'Zeilen | ohne Programm:', await p.locator('.eg-empty').count());
  await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(600);
  log('Pfeil runter im Raster ->', await p.textContent('#preview [data-role=title]'));

  await p.reload();
  await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=live]'); await p.waitForSelector('.eg-row');
  log('Ansicht bleibt nach Neuladen: Raster');
  await p.click('#viewToggle [data-view=list]');
  await p.waitForSelector('.row');
  log('Zurueck zur Liste:', await p.locator('.row').count() > 0);
  log('Seitenfehler:', errs);
  await b.close();
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
