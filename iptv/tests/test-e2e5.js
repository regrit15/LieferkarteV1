const { chromium } = require('playwright');
const log = (...a) => console.log(...a);
const title = (p) => p.textContent('#preview [data-role=title]');
async function search(p, q) { await p.fill('#search', q); await p.waitForTimeout(450); }
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

  // 8: Duplikate
  await search(p, 'sky sport 1');
  log('Suche "sky sport 1":', await p.locator('.row .name').allTextContents());
  await search(p, 'sport1');
  log('Suche "sport1":', await p.locator('.row .name').allTextContents());
  await search(p, 'dazn');
  log('Suche "dazn":', await p.locator('.row .name').allTextContents());
  await search(p, 'sky sport 1');
  await p.locator('.row').first().click();
  await p.waitForFunction(() => document.querySelector('video').currentTime > 1);
  log('Qualitaetsauswahl:', await p.locator('#preview [data-role=quality] option').allTextContents());
  await p.click('#preview [data-role=more]'); await p.selectOption('#preview [data-role=quality]', { label: 'SD' });
  await p.waitForFunction(() => document.querySelector('#preview [data-role=title]').textContent.includes('SD'));
  log('Nach Wechsel auf SD:', await title(p));
  await p.keyboard.press('Escape');
  await p.click('#filterBtn');
  await p.waitForSelector('.f-item');
  log('Filter-Dialog:', (await p.locator('text=Varianten ausgeblendet').textContent()));
  await p.locator('label', { hasText: 'Nur eine Variante je Sender zeigen' }).locator('input').uncheck();
  await p.keyboard.press('Escape');
  await search(p, 'sky sport 1');
  log('Ohne Zusammenfassen:', await p.locator('.row .name').allTextContents());
  await p.click('#filterBtn');
  await p.locator('label', { hasText: 'Nur eine Variante je Sender zeigen' }).locator('input').check();
  await p.keyboard.press('Escape');
  await p.keyboard.press('Escape');

  // 6: Letzter Sender + Zuletzt gesehen
  await p.click('.cat[data-cat="__all"]');
  await p.locator('.row').nth(0).click();
  await p.waitForFunction(() => document.querySelector('video').currentTime > 1);
  await p.locator('.row').nth(3).click();
  await p.waitForFunction(() => document.querySelector('video').currentTime > 1);
  const a = await title(p);
  await p.keyboard.press('z');
  await p.waitForTimeout(800);
  const bTitle = await title(p);
  await p.keyboard.press('z');
  await p.waitForTimeout(800);
  log('Letzter Sender:', a, '-> Z ->', bTitle, '-> Z ->', await title(p));
  await p.click('.cat[data-cat="__recent"]');
  log('Zuletzt gesehen:', await p.locator('.row .name').allTextContents());

  // 1: Neu verbinden bei haengendem Bild
  await search(p, 'haenger');
  await p.locator('.row').first().click();
  await p.waitForSelector('#preview .slot-note', { timeout: 40000 });
  log('Hinweis im Bild:', await p.textContent('#preview .slot-note'));
  await p.waitForTimeout(3000);
  await p.screenshot({ path: __dirname + '/v5-reconnect.png' });

  // 1: komplett kaputter Sender -> nach 5 Versuchen Knopf
  await search(p, 'kaputt');
  await p.locator('.row').first().click();
  await p.waitForSelector('#preview [data-role=msg] button', { timeout: 70000 });
  log('Endmeldung:', await p.textContent('#preview [data-role=msg]'));
  log('Seitenfehler:', errs);
  await b.close();
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
