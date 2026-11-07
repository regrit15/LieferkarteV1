const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:8080');
  const r = await p.evaluate(() => {
    const live = ['4K: NOW SPORTS PREMIER LEAGUE ᵁᴴᴰ ³⁸⁴⁰ᴾ ᴺᴹ', 'PRIME: SPORTDIGITAL DE ᴿᴬᵂ', 'WOW: SKY SPORT BUNDESLIGA 1 ᴴᴰ ◉', 'DE: DAZN 1 ᶠᴴᴰ'];
    const films = ['4K-TOP - Heart of the Beast', '4K-DE-DV - VisionQuest (2026)', 'VisionQuest (2026) (US)', 'DE - Was verborgen blieb (2026) (PL)', 'Merry Berry Love (2026) (KR)', 'Blade Runner 2049', 'FBI: Most Wanted', 'CSI: Miami', 'DE: Der Pate', '1917 (2019)', 'Avatar: Die sieben Häfen (2026)'];
    const cats = ['TOP MOVIES ⁴ᴷ ³⁸⁴⁰ᴾ ᴰᴼᴸᴮʸ ᴬᵁᴰᴵᴼ', 'DE| DAZN EXCLUSIVE ᴴᴰ/ᴿᴬᵂ', 'مسلسلات عربية فائقة الوضوح', '4K ³⁸⁴⁰ᴾ DOLBY AUDIO مسلسلات عربية', 'Русские фильмы', 'DE| BUNDESLIGA HD/4K'];
    return {
      live: live.map((n) => { const l = liveLabel(n); return `${n}  ->  ${l.text}  [${l.chips.join(', ')}]`; }),
      films: films.map((n) => `${n}  ->  ${displayName(n)}  | Jahr ${yearOf({ name: n }) || '-'} | Kennung ${detectTag(n, true) || '-'} | 4K ${is4k(n)}`),
      cats: cats.map((n) => `${n}  ->  ${catLabel(n)}  | Kennung ${detectTag(n) || '-'}`),
      rating: [7.296, 10, 9.9, 0].map((r) => `${r} -> ${providerRating({ rating: String(r) }) ? fmtRating(providerRating({ rating: String(r) })) : 'ignoriert'}`),
    };
  });
  for (const [k, v] of Object.entries(r)) { console.log('--', k); v.forEach((x) => console.log('  ' + x)); }
  await b.close();
})();
