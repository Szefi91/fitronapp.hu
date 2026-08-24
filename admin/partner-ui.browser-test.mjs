/**
 * A PARTNER-ADMIN VALODI BONGESZOS TESZTJE (nem csak forditas: a felulet tenyleg fut).
 *
 * Futtatas:
 *   1) npx vite --config vite.harness.config.js      # Firebase-stub, rogzitett adatokkal
 *   2) node admin/partner-ui.browser-test.mjs
 *
 * MIERT KELL: a jutalek-kulcs PENZ. A tiszta fuggvenyeket a partner-utils.test.mjs fedi,
 * de az "atirja-e a felulet a helyes adatot a Cloud Function-nek" kerdesre CSAK egy valodi
 * bongeszo tud valaszolni. Egy elo hibat mar el is kapott: a meglevo partner szerkesztese
 * a sajat azonositojan bukott el.
 *
 * A screenshotok a scratch mappaba mennek (SC kornyezeti valtozo, alapertelmezetten /tmp).
 */
import pkg from '/mnt/e/claude.ai/Agentek/marveen/node_modules/playwright/index.js';
const { chromium } = pkg;
const SC = process.env.SC || '/tmp';
const URL = 'http://localhost:5199/admin/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const hibak = [];
const ok = (nev, felt) => { console.log((felt ? 'OK   ' : 'BUKIK') + ' | ' + nev); if (!felt) hibak.push(nev); };

p.on('console', (m) => { if (m.text().includes('[harness]')) console.log('   ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.fulek', { timeout: 8000 });

// 1) A Partnerek ful CSAK adminnak latszik (a harness admin szerepkorrel lep be)
ok('van Partnerek ful', await p.locator('button[data-ful="partnerek"]').count() === 1);

await p.click('button[data-ful="partnerek"]');
await p.waitForSelector('#uj-partner');
const sorok = await p.locator('.tetel').count();
ok('harom partner-sor jelenik meg', sorok === 3);
ok('a 12.5%-os kulcs kiirodik', (await p.textContent('.lista')).includes('12.5%'));
ok('a hianyzo kulcsnal NEM nulla, hanem "nincs beallitva"', (await p.textContent('.lista')).includes('nincs beállítva'));
ok('a szunetelo partner jelzoje latszik', (await p.textContent('.lista')).includes('Szünetel'));
await p.screenshot({ path: SC + '/admin-partnerek-lista.png' });

// 2) Szerkesztes: az azonosito NEM irhato at, a mezok elotoltodnek
await p.click('[data-partner="pA2kiss00000000000000000000x"]');
await p.waitForSelector('#partner-urlap');
ok('az azonosito mezo csak olvashato', await p.getAttribute('#partner-azonosito', 'readonly') !== null);
ok('a kulcs elotoltve', await p.inputValue('#partner-kulcs') === '20');
ok('az aktiv jelolonegyzet be van pipalva', await p.isChecked('#partner-aktiv'));
await p.screenshot({ path: SC + '/admin-partner-szerkeszto.png' });

// 3) Hibas kulcs: NEM megy el a mentes
await p.fill('#partner-kulcs', '120');
await p.click('#partner-ment');
await p.waitForTimeout(300);
ok('120% eseten hibauzenet jon', (await p.textContent('#partner-hiba')).includes('100'));
ok('hibas ertek eseten NEM indult CF-hivas', await p.evaluate(() => !window.__utolsoCF));

// 4) Ervenyes mentes: a CF a helyes adatot kapja
await p.fill('#partner-kulcs', '17,5');
await p.uncheck('#partner-aktiv');
await p.click('#partner-ment');
await p.waitForTimeout(600);
const cf = await p.evaluate(() => window.__utolsoCF);
ok('a manageContent-et hivja', cf && cf.nev === 'manageContent');
ok('a partners kollekciora, a partner uid-jevel', cf && cf.payload.collection === 'partners' && cf.payload.id === 'pA2kiss00000000000000000000x');
ok('a tizedesvesszos kulcsbol szam lett (17.5)', cf && cf.payload.data.commissionRate === 17.5);
ok('a kipipalatlan jelolonegyzetbol active:false', cf && cf.payload.data.active === false);

// 5) Uj partner FELVETELE kodbol: feloldja uid-re, es a nevet a felhasznalotol veszi
await p.waitForSelector('#uj-partner');
await p.click('#uj-partner');
await p.waitForSelector('#partner-urlap');
await p.fill('#partner-azonosito', ' fitbbb222 ');   // kisbetus + szokozos, szandekosan
await p.fill('#partner-kulcs', '25');
await p.click('#partner-ment');
await p.waitForTimeout(600);
const cf2 = await p.evaluate(() => window.__utolsoCF);
ok('a kodot feloldotta a felhasznalo uid-jere', cf2 && cf2.payload.id === 'pB3nagy00000000000000000000y');
ok('a nevet a felhasznalotol vette at', cf2 && cf2.payload.data.displayName === 'Nagy Reka');

// 6) Nem letezo kod: nem keletkezik arva partner-doc
await p.click('#uj-partner');
await p.waitForSelector('#partner-urlap');
await p.evaluate(() => { window.__utolsoCF = null; });
await p.fill('#partner-azonosito', 'FITZZZ999');
await p.fill('#partner-kulcs', '30');
await p.click('#partner-ment');
await p.waitForTimeout(600);
ok('ismeretlen kodnal hibauzenet', (await p.textContent('#partner-hiba')).includes('Nem találok'));
ok('ismeretlen kodnal NEM ment el semmi', await p.evaluate(() => !window.__utolsoCF));

// 8) Aruhaz-levonas beallitas: elotoltve jon, es a mentes a config/affiliate-re megy
await p.click('button[data-ful="partnerek"]');
await p.waitForSelector('#levonas-urlap');
ok('a levonas elotoltve a configbol', await p.inputValue('#levonas') === '30');
await p.evaluate(() => { window.__utolsoCF = null; });
await p.fill('#levonas', '150');
await p.click('#levonas-ment');
await p.waitForTimeout(300);
ok('100 felett hibauzenet, es NEM megy CF-hivas',
   (await p.textContent('#levonas-hiba')).includes('100') && await p.evaluate(() => !window.__utolsoCF));
await p.fill('#levonas', '15');
await p.click('#levonas-ment');
await p.waitForTimeout(600);
const cf3 = await p.evaluate(() => window.__utolsoCF);
ok('a levonas a config/affiliate-re mentodik',
   cf3 && cf3.payload.collection === 'config' && cf3.payload.id === 'affiliate' && cf3.payload.data.storeCutPercent === 15);
await p.screenshot({ path: SC + '/admin-partnerek-levonas.png' });

// 7) Mobil nezet
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
const mp = await m.newPage();
await mp.goto(URL, { waitUntil: 'networkidle' });
await mp.waitForSelector('.fulek');
await mp.click('button[data-ful="partnerek"]');
await mp.waitForSelector('#uj-partner');
await mp.screenshot({ path: SC + '/admin-partnerek-mobil.png' });
const tulcsordul = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok('mobilon nincs vizszintes tulcsordulas', !tulcsordul);

await b.close();
console.log(hibak.length ? '\nBUKOTT: ' + hibak.join(' | ') : '\nMIND A ' + '17' + ' ALLITAS ATMENT');
process.exit(hibak.length ? 1 : 0);
