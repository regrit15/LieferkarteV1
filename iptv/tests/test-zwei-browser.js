const { chromium } = require('playwright');
const DRIVE = process.argv[2];
async function open(b) {
  const p = await (await b.newContext()).newPage();
  await p.goto('http://localhost:8080');
  const f = p.locator('#loginForm');
  await f.locator('[name=server]').fill('localhost:9000'); await f.locator('[name=username]').fill('max'); await f.locator('[name=password]').fill('geheim');
  await f.locator('button').click(); await p.waitForSelector('.tiles .tile');
  return p;
}
(async () => {
  const b = await chromium.launch();
  const A = await open(b);
  await A.click('#syncBtn'); await A.fill('#syncBody .sync-row input', DRIVE); await A.click('#syncBody .sync-row .btn');
  await A.waitForSelector('#syncBody .sync-status.ok'); await A.keyboard.press('Escape');
  const B = await open(b);   // zweiter Browser: Abgleich ist schon eingerichtet (Einstellung liegt im Server)
  await A.click('.rail [data-tab=live]'); await A.waitForSelector('.main .row'); await A.click('.cat[data-cat="__all"]');
  await A.locator('.main .row').first().locator('.star').click();
  await A.waitForTimeout(3000);
  await B.evaluate(() => syncNow(true)); await B.waitForTimeout(800);
  await B.click('.rail [data-tab=fav]');
  console.log('Browser B sieht Favorit von A:', await B.locator('.main .row .name').allTextContents());
  await B.locator('.main .row .star').first().click(); await B.waitForTimeout(3000);
  await A.evaluate(() => syncNow(true)); await A.waitForTimeout(800);
  await A.click('.rail [data-tab=fav]');
  console.log('Browser A nach Entfernen in B:', await A.locator('.main .row').count(), 'Favoriten');
  const fs = require('fs'); const path = require('path'); const dir = path.join(DRIVE, 'SportTV'); const sub = fs.readdirSync(dir).filter((n) => !n.startsWith('.'))[0];
  console.log('Dateien:', fs.readdirSync(path.join(dir, sub)).filter((n) => n.endsWith('.json')));
  await b.close();
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
