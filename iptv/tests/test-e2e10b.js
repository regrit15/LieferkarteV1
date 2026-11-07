const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:8080');
  const f = p.locator('#loginForm');
  await f.locator('[name=server]').fill('localhost:9000'); await f.locator('[name=username]').fill('max'); await f.locator('[name=password]').fill('geheim');
  await f.locator('button').click(); await p.waitForSelector('.tiles .tile'); await p.click('.rail [data-tab=live]'); await p.waitForSelector('.main .row');
  await p.click('.cat[data-cat="__all"]'); await p.waitForSelector('.row');
  const t0 = Date.now();
  await p.locator('.row').nth(4).click();
  await p.waitForFunction(() => !document.querySelector('video').paused && document.querySelector('video').currentTime > 0.3, null, { timeout: 20000 });
  console.log('Standard-Puffer:', await p.evaluate(() => state.playback.buffer), '| Start nach', ((Date.now() - t0) / 1000).toFixed(1), 's');
  const r = await p.evaluate(async () => { const v = document.querySelector('video'); let back = 0, last = v.currentTime;
    for (let i = 0; i < 240; i++) { await new Promise((r) => setTimeout(r, 250)); if (v.currentTime < last - 0.2) back++; last = v.currentTime; }
    return { zeit: v.currentTime.toFixed(1), ruecksprunge: back, leergelaufen: player.stats.rebuffers, neu_verbunden: player.stats.reconnects }; });
  console.log('60 s mit 2 Aussetzern:', r);
  await b.close();
})();
