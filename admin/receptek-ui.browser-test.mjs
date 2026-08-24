/**
 * A RECEPTEK fül valódi böngészős tesztje (mezős szerkesztő, a JSON-textarea helyett).
 *
 * Futtatás:
 *   1) npx vite --config vite.harness.config.js     # Firebase-stub (5199)
 *   2) node admin/receptek-ui.browser-test.mjs
 *
 * MIÉRT KELL: a receptnél KÉT zászló van ugyanarra (isPremium a lekérdezéshez, isFree az app
 * záráshoz). Ha a mentés csak az egyiket írja, a recept vagy láthatatlan lesz az ingyeneseknek,
 * vagy tévesen zárva marad. Ezt csak a MENTETT payloadon lehet bizonyítani, nem a képernyőn.
 */
import pkg from '/mnt/e/claude.ai/Agentek/marveen/node_modules/playwright/index.js';
const { chromium } = pkg;
const SC = process.env.SC || '/tmp';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
const hibak = [];
const ok = (nev, felt) => { console.log((felt ? 'OK   ' : 'BUKIK') + ' | ' + nev); if (!felt) hibak.push(nev); };
p.on('pageerror', (e) => { console.log('LAP-HIBA:', e.message); hibak.push('pageerror: ' + e.message); });
p.on('console', (m) => { if (m.text().includes('[harness]')) console.log('   ' + m.text()); });
p.on('dialog', (d) => d.accept());

await p.goto('http://localhost:5199/admin/index.html');
await p.waitForSelector('[data-ful="receptek"]', { timeout: 15000 });
await p.click('[data-ful="receptek"]');
await p.waitForSelector('[data-recept-uj]', { timeout: 8000 });

const lista = (await p.locator('body').innerText()).toLowerCase();
ok('Nincs nyers JSON-textarea a listán', !(await p.locator('#szerk-json').count()));
ok('A két recept látszik', lista.includes('fehérjés zabkása') && lista.includes('édesburgonyás csirke'));
ok('Piszkozat-jel a nem publikáltnál', lista.includes('piszkozat'));
ok('Makró-adatok a kártyán', lista.includes('420 kcal') && lista.includes('32g'));

// 1) Meglévő recept szerkesztése: a mezők fel vannak töltve, nem JSON.
// SZANDEKOSAN azonositora megyunk, nem a lista elso elemere: a lista magyar ABC szerint rendez
// ("Édesburgonyás" elozi a "Fehérjés"-t), tehat a .first() nem az, amit az ember gondolna.
await p.locator('[data-recept-szerk="rec-zabkasa"]').click();
await p.waitForSelector('#recept-urlap', { timeout: 8000 });
ok('Mezős szerkesztő nyílik (nem JSON)', (await p.locator('#rec-cim').count()) === 1 && (await p.locator('#szerk-json').count()) === 0);
ok('A név betöltve', (await p.locator('#rec-cim').inputValue()) === 'Fehérjés zabkása');
ok('A hozzávalók soronként', (await p.locator('#rec-hozzavalok').inputValue()).split('\n').length === 3);
ok('A kalória betöltve', (await p.locator('#rec-kcal').inputValue()) === '420');

// A KITOLTOTT szerkesztorol keszul a kep (a legvegen csak az ures uj-urlap allna a kepernyon).
await p.screenshot({ path: `${SC}/receptek-szerkeszto.png`, fullPage: true });

// 2) Mentés: a KÉT zászló együtt megy ki, és a lépések tömbbé alakulnak
await p.fill('#rec-lepesek', 'Első lépés\n\nMásodik lépés\n');
await p.check('#rec-premium');
await p.check('#rec-kint');   // maradjon kint az appban -> published: true
await p.click('#rec-ment');
await p.waitForTimeout(700);
const cf = await p.evaluate(() => window.__utolsoCF || null);
ok('Mentés a manageContent CF-en, a recipes kollekcióra', cf && cf.nev === 'manageContent' && cf.payload.collection === 'recipes');
ok('isPremium=true ÉS isFree=false EGYÜTT megy ki', cf && cf.payload.data.isPremium === true && cf.payload.data.isFree === false);
ok('Az üres sor nem lett külön lépés', cf && Array.isArray(cf.payload.data.instructions) && cf.payload.data.instructions.length === 2);
ok('A hiányzó published mező helyett expliciten true megy ki', cf && cf.payload.data.published === true);
console.log('   payload:', JSON.stringify(cf && cf.payload.data));

// 3) Új recept: üres név nem menthető
await p.waitForSelector('[data-recept-uj]', { timeout: 8000 });
await p.click('[data-recept-uj]');
await p.waitForSelector('#recept-urlap', { timeout: 8000 });
await p.evaluate(() => { window.__utolsoCF = null; });
await p.locator('#rec-ment').click();
await p.waitForTimeout(400);
const cf2 = await p.evaluate(() => window.__utolsoCF);
ok('Üres űrlappal NEM indul szerver-hívás', !cf2);
const hibaSzoveg = await p.locator('#rec-hiba').innerText().catch(() => '');
ok('A hiányzó név hibaüzenetet ad', /név|hozzávaló/i.test(hibaSzoveg) || (await p.locator('#rec-cim').evaluate((e) => !e.validity.valid)));

// 4) Mobil 390px
const m = await ctx.newPage();
await m.setViewportSize({ width: 390, height: 900 });
await m.goto('http://localhost:5199/admin/index.html');
await m.waitForSelector('[data-ful="receptek"]', { timeout: 15000 });
await m.click('[data-ful="receptek"]');
await m.waitForSelector('[data-recept-uj]', { timeout: 8000 });
await m.waitForTimeout(300);
const tul = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('390px: nincs vízszintes túlcsordulás (' + tul + 'px)', tul <= 1);
await m.screenshot({ path: `${SC}/receptek-mobil.png`, fullPage: true });

await b.close();
console.log(hibak.length ? '\nBUKOTT: ' + hibak.join(' | ') : '\nMINDEN ZOLD');
process.exit(hibak.length ? 1 : 0);
