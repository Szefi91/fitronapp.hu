/**
 * AZ ESEMÉNYEK FÜL BEKÖTÉSÉNEK teszte: a TELJES admin.js fut (nem külön harness-lap),
 * és az Események fülre kattintva Aurora modulja rajzol és él.
 *
 * Futtatás:
 *   1) npx vite --config vite.harness.config.js     # Firebase-stub, rögzített adatokkal (5199)
 *   2) node admin/esemenyek-bekotes.browser-test.mjs
 *
 * MIÉRT KELL: a modul külön-külön letesztelve is lehet halott a valódi adminban, ha a
 * bekötés (import, ág, eseménykötés) hibás. 2026-08-24-en pont ez tortent a felhasznalo-fulnel.
 */
import pkg from '/mnt/e/claude.ai/Agentek/marveen/node_modules/playwright/index.js';
const { chromium } = pkg;
const SC = process.env.SC || '/tmp';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const hibak = [];
const ok = (nev, felt) => { console.log((felt ? 'OK   ' : 'BUKIK') + ' | ' + nev); if (!felt) hibak.push(nev); };
p.on('pageerror', (e) => { console.log('LAP-HIBA:', e.message); hibak.push('pageerror: ' + e.message); });
p.on('console', (m) => { if (m.text().includes('[harness]')) console.log('   ' + m.text()); });
let dialogValasz = null;
p.on('dialog', (d) => (dialogValasz === null ? d.accept() : d.accept(dialogValasz)));

await p.goto('http://localhost:5199/admin/index.html');
await p.waitForSelector('[data-ful]', { timeout: 10000 });

// 1) Ott van-e az Események fül, és rákattintva Aurora nézete jön-e (nem a régi generikus lista)
await p.click('[data-ful="esemenyek"]');
await p.waitForSelector('[data-esemeny-uj]', { timeout: 8000 });
ok('Események fül: Aurora nézete rajzolódik (Új esemény gomb)', true);

const szoveg = await p.locator('main, #tartalom, body').first().innerText();
ok('Lista: a rögzített esemény látszik (Nyári futóverseny)', szoveg.includes('Nyári futóverseny'));
ok('Lista: a piszkozat is látszik (Őszi edzőtábor)', szoveg.includes('Őszi edzőtábor'));

const kartyak = await p.locator('[data-esemeny-id]').count();
ok('Két esemény-kártya van', kartyak === 2);

// 2) Szerkesztő megnyílik és a mezők fel vannak töltve
await p.locator('[data-esemeny-szerk]').first().click();
await p.waitForTimeout(400);
const urlapSzoveg = await p.locator('body').innerText();
ok('Szerkesztő megnyílik', /Mentés/i.test(urlapSzoveg));

// 3) Mentés -> manageContent CF hívás megy, events kollekcióra
await p.locator('button:has-text("Mentés")').first().click();
await p.waitForTimeout(800);
const cf = await p.evaluate(() => window.__utolsoCF || null);
ok('Mentés a manageContent CF-en megy', cf && cf.nev === 'manageContent');
ok('A mentés az events kollekcióra megy', cf && cf.payload && cf.payload.collection === 'events');
ok('A mentés megtartja a címet', cf && cf.payload && cf.payload.data && String(cf.payload.data.title || '').length > 0);
console.log('   CF payload:', JSON.stringify(cf && cf.payload));

await p.screenshot({ path: `${SC}/esemenyek-bekotes-asztali.png`, fullPage: true });

// 4) Mobil 390px: nincs vízszintes túlcsordulás
const m = await ctx.newPage();
await m.goto('http://localhost:5199/admin/index.html');
await m.setViewportSize({ width: 390, height: 844 });
await m.waitForSelector('[data-ful="esemenyek"]', { timeout: 10000 });
await m.click('[data-ful="esemenyek"]');
await m.waitForSelector('[data-esemeny-id]', { timeout: 8000 });
await m.waitForTimeout(300);
const tul = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('390px: nincs vízszintes túlcsordulás (' + tul + 'px)', tul <= 1);
await m.screenshot({ path: `${SC}/esemenyek-bekotes-mobil.png`, fullPage: true });

await b.close();
console.log(hibak.length ? '\nBUKOTT: ' + hibak.join(' | ') : '\nMINDEN ZOLD');
process.exit(hibak.length ? 1 : 0);
