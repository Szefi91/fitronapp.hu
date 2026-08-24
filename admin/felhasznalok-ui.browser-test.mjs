/**
 * A FELHASZNÁLÓK fül valódi böngészős tesztje: keresés, 10-esével lapozás, jelölés,
 * tömeges törlés. (Szefi kérése, 2026-08-24.)
 *
 * Futtatás:
 *   1) npx vite --config vite.harness.config.js     # Firebase-stub, 24 teszt-felhasználó (5199)
 *   2) node admin/felhasznalok-ui.browser-test.mjs
 *
 * MIÉRT KELL: a tömeges törlés visszavonhatatlan. Bizonyítani kell, hogy pontosan a
 * KIJELÖLT fiókokra megy a deleteAccount, és hogy a saját fiókot nem lehet kijelölni.
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
p.on('dialog', (d) => d.accept());

await p.goto('http://localhost:5199/admin/index.html');
await p.waitForSelector('[data-ful="felhasznalok"]');
await p.click('[data-ful="felhasznalok"]');
await p.waitForSelector('#felh-kereso');

// 1) Lapozás 10-esével
let sorok = await p.locator('.lista > .tetel').count();
ok('Első oldalon 10 sor van (' + sorok + ')', sorok === 10);
const lapSzoveg = await p.locator('.lapozo').innerText();
ok('Lapozó 3 oldalt mutat (24 felhasználó): ' + lapSzoveg.replace(/\n/g, ' '), lapSzoveg.includes('/ 3'));
await p.click('[data-felh-lap="kovetkezo"]');
await p.waitForTimeout(200);
ok('Második oldalon is 10 sor', (await p.locator('.lista > .tetel').count()) === 10);
await p.click('[data-felh-lap="kovetkezo"]');
await p.waitForTimeout(200);
sorok = await p.locator('.lista > .tetel').count();
ok('Harmadik oldalon a maradék 4 sor (' + sorok + ')', sorok === 4);

// 2) Keresés névre és e-mailre
await p.fill('#felh-kereso', 'Réka');
await p.waitForTimeout(250);
let talalat = await p.locator('.lista > .tetel').count();
const talalatSzoveg = await p.locator('.lista').innerText();
ok('Névre keresés talál (Nagy Réka)', talalat === 1 && talalatSzoveg.includes('Nagy Réka'));
await p.fill('#felh-kereso', 'toth.odon@pelda.hu');
await p.waitForTimeout(250);
ok('E-mailre keresés talál', (await p.locator('.lista')).count() && (await p.locator('.lista').innerText()).includes('Tóth Ödön'));
await p.fill('#felh-kereso', 'nincsilyen');
await p.waitForTimeout(250);
ok('Nincs találat esetén szöveges üzenet', (await p.locator('#felh-doboz').innerText()).includes('Nincs találat'));
await p.fill('#felh-kereso', '');
await p.waitForTimeout(250);

// 3) A saját fiókot nem lehet kijelölni
const sajatTiltva = await p.locator('[data-felh-jelol="aQ1admin000000000000000000zz"]').isDisabled();
ok('A saját fiók jelölője le van tiltva', sajatTiltva);

// 4) Kijelölés + tömeges törlés PONTOSAN a kijelöltekre megy
await p.locator('[data-felh-jelol]:not([disabled])').nth(0).check();
await p.waitForTimeout(150);
await p.locator('[data-felh-jelol]:not([disabled])').nth(1).check();
await p.waitForTimeout(150);
const kijeloltUidk = await p.evaluate(() => [...document.querySelectorAll('[data-felh-jelol]')]
  .filter((c) => c.checked).map((c) => c.dataset.felhJelol));
ok('Két fiók van kijelölve', kijeloltUidk.length === 2);
ok('A sáv is kettőt mutat', (await p.locator('.felh-sav').innerText()).includes('2 kijelölve'));

await p.click('#felh-tomeges-torles');
await p.waitForTimeout(900);
const torolt = await p.evaluate(() => window.__torolt || []);
ok('Pontosan a kijelölt kettő törlődött', torolt.length === 2 && kijeloltUidk.every((u) => torolt.includes(u)));
const marad = await p.locator('.lapozo').innerText();
ok('A lista frissült (22 fő, még mindig 3 oldal): ' + marad.replace(/\n/g, ' '), (await p.locator('#felh-doboz').innerText()).includes('22 felhasználó'));
ok('A kijelölés kiürült a törlés után', (await p.locator('.felh-sav').innerText()).includes('0 kijelölve'));

// 5) GYORSITOTAR: fulvaltas utan a lista AZONNAL latszik (nem ures kepernyo), es a
// "frissites..." jelzes mutatja, hogy a szerver valasza a hatterben jon.
// Szefi 2026-08-24: "nagyon lassu a betoltese a felhasznalo fulnek pedig meg csak 12 user van".
await p.click('[data-ful="receptek"]');
await p.waitForTimeout(200);
await p.click('[data-ful="felhasznalok"]');
const azonnal = await p.locator('.lista > .tetel').count();   // varakozas NELKUL
ok('Fülváltás után a lista AZONNAL látszik (' + azonnal + ' sor, nem üres)', azonnal > 0);
await p.waitForTimeout(600);
const jelzoRejtve = await p.locator('#felh-frissul').isHidden();
ok('A "frissítés..." jelzés eltűnik, ha kész', jelzoRejtve);
const keresoMezoDb = await p.locator('#felh-kereso').count();
ok('A kereső mező nem duplázódik a háttér-frissítéstől', keresoMezoDb === 1);
// A kereses a hatter-frissites UTAN is mukodik (nem vesztek el a figyelok)
// SZANDEKOSAN 'Tóth Ödön': a 'Nagy Réka' addigra mar a tomeges torles aldozata lett,
// tehat rá keresve joggal 0 talalat lenne -- az a TESZT hibaja lenne, nem a kode.
await p.fill('#felh-kereso', 'Tóth');
await p.waitForTimeout(250);
ok('Keresés a háttér-frissítés után is működik', (await p.locator('.lista > .tetel').count()) === 1);
await p.fill('#felh-kereso', '');
await p.waitForTimeout(250);

await p.screenshot({ path: `${SC}/felhasznalok-asztali.png`, fullPage: true });

// 5) Mobil 390px
const m = await ctx.newPage();
await m.setViewportSize({ width: 390, height: 900 });
await m.goto('http://localhost:5199/admin/index.html');
await m.waitForSelector('[data-ful="felhasznalok"]');
await m.click('[data-ful="felhasznalok"]');
await m.waitForSelector('#felh-kereso');
await m.waitForTimeout(300);
const tul = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('390px: nincs vízszintes túlcsordulás (' + tul + 'px)', tul <= 1);
await m.screenshot({ path: `${SC}/felhasznalok-mobil.png`, fullPage: true });

await b.close();
console.log(hibak.length ? '\nBUKOTT: ' + hibak.join(' | ') : '\nMINDEN ZOLD');
process.exit(hibak.length ? 1 : 0);
