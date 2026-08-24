/**
 * AZ ESEMÉNYEK FÜL VALÓDI BÖNGÉSZŐS TESZTJE (nem csak fordítás: a felület tényleg fut).
 *
 * Futtatás:
 *   1) npx vite --config vite.esemenyek.config.js     # Firebase-stub, rögzített adatokkal
 *   2) node admin/esemenyek-ui.browser-test.mjs
 *
 * MIÉRT KELL: a "hiányzó published == kint van" szabály elrontása a MEGLÉVŐ eseményeket
 * tüntetné el az appból, a month/day rossz számítása pedig rossz dátumot mutatna a kártyán.
 * Ezeket csak egy valódi böngészőben lefutó mentés-kör tudja bizonyítani.
 */
import pkg from '/mnt/e/claude.ai/Agentek/marveen/node_modules/playwright/index.js';
const { chromium } = pkg;
const SC = process.env.SC || '/tmp';
const URL = 'http://localhost:5178/admin/esemenyek-harness.html';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const hibak = [];
const ok = (nev, felt) => { console.log((felt ? 'OK   ' : 'BUKIK') + ' | ' + nev); if (!felt) hibak.push(nev); };

let dialogValasz = null; // null = confirm-accept; string = prompt-ba írt szöveg
p.on('dialog', (d) => (dialogValasz === null ? d.accept() : d.accept(dialogValasz)));
p.on('console', (m) => { if (m.text().includes('[harness]')) console.log('   ' + m.text()); });
p.on('pageerror', (e) => { console.log('LAP-HIBA:', e.message); hibak.push('pageerror: ' + e.message); });

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('.lista', { timeout: 8000 });

/* 1) Lista: minden doksi látszik, dátum szerint, a dátumtalan a végén, piszkozat-jel jó helyen */
ok('négy esemény-kártya jelenik meg', await p.locator('[data-esemeny-id]').count() === 4);
const cimek = await p.locator('[data-esemeny-id] strong').allTextContents();
ok('dátum szerinti sorrend, elöl a legkorábbi', cimek[0] === 'Nyárzáró Futás' && cimek[1] === 'Országos Szkander Kupa');
ok('a dátum nélküli doksi NEM tűnik el, a lista végén van', cimek[3] === 'Dátum nélküli teszt');
ok('pontosan egy piszkozat-jel van (a published:false eseményen)', await p.locator('.piszkozat-jel').count() === 1);
const piszkozatKartya = await p.locator('[data-esemeny-id="ev-piszkozat"]').textContent();
ok('a piszkozat-jel az Őszi Erőnléti Táboron van', piszkozatKartya.includes('piszkozat'));
ok('a Prémium jelző látszik a prémium eseményen', (await p.locator('[data-esemeny-id="ev-szkander"]').textContent()).includes('Prémium'));
ok('a jelentkezők és a max is kiíródik', (await p.locator('[data-esemeny-id="ev-szkander"]').textContent()).includes('34 jelentkező / max 64'));
await p.screenshot({ path: SC + '/esemenyek-lista.png', fullPage: true });

/* 2) Meglévő (RÉGI, published-mentes) esemény szerkesztője: előtöltés + "kint van" pipa */
await p.click('[data-esemeny-szerk="ev-regi"]');
await p.waitForSelector('#esemeny-urlap');
ok('a cím előtöltve', await p.inputValue('#ese-cim') === 'Nyárzáró Futás');
ok('a dátum előtöltve', await p.inputValue('#ese-datum') === '2026-08-30');
ok('hiányzó published mellett a "Kint van az appban" BE van pipálva', await p.isChecked('#ese-kint'));
ok('a prémium pipa nincs bepipálva', !(await p.isChecked('#ese-premium')));
await p.screenshot({ path: SC + '/esemenyek-szerkeszto.png', fullPage: true });

/* 3) Validáció: üres cím és max-nál több jelentkező NEM megy el a szerverre */
await p.fill('#ese-cim', '');
await p.click('#ese-ment');
await p.waitForTimeout(200);
/* Az üres címet a mező natív required-je fogja meg (a böngésző nem engedi beküldeni),
   a JS-validáció csak tartalék -- itt azt ellenőrizzük, hogy tényleg blokkolva van. */
ok('üres címet a natív required blokkolja', await p.evaluate(() => document.getElementById('ese-cim').validity.valueMissing));
ok('üres címnél NEM indult szerver-hívás', await p.evaluate(() => !window.__utolsoCF));
await p.fill('#ese-cim', 'Nyárzáró Futás');
await p.fill('#ese-max', '5');
await p.fill('#ese-jelentkezok', '12');
await p.click('#ese-ment');
await p.waitForTimeout(200);
ok('max-nál több jelentkezőre hibaüzenet jön', (await p.textContent('#ese-hiba')).includes('max'));
ok('hibás létszámnál sem indult szerver-hívás', await p.evaluate(() => !window.__utolsoCF));

/* 4) Érvényes mentés: a CF a helyes adatot kapja, az ismeretlen mező megmarad */
await p.fill('#ese-max', '40');
await p.click('#ese-ment');
await p.waitForSelector('.lista');
const mentes = await p.evaluate(() => window.__utolsoCF);
ok('mentés: manageContent / events / upsert a jó id-vel',
  mentes && mentes.nev === 'manageContent' && mentes.payload.collection === 'events'
  && mentes.payload.action === 'upsert' && mentes.payload.id === 'ev-regi');
ok('a felület által nem ismert mező (extraMezo) MEGMARADT', mentes.payload.data.extraMezo === 'megmarad');
ok('a bepipált "kint van" published:true-ként megy', mentes.payload.data.published === true);
ok('month/day a dátumból számolva (AUG/30)', mentes.payload.data.month === 'AUG' && mentes.payload.data.day === '30');
ok('a mentés után a lista jön vissza', await p.locator('[data-esemeny-id]').count() === 4);

/* 5) Új esemény képfeltöltéssel: a feltöltött URL a mezőbe kerül és a mentésbe is */
await p.click('[data-esemeny-uj]');
await p.waitForSelector('#esemeny-urlap');
await p.fill('#ese-cim', 'Teszt Kupa');
await p.fill('#ese-datum', '2026-12-05');
await p.fill('#ese-helyszin', 'Pécs');
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
await p.setInputFiles('#ese-kep-fajl', { name: 'proba.png', mimeType: 'image/png', buffer: png1x1 });
await p.waitForFunction(() => document.getElementById('ese-kep').value.startsWith('https://harness.example/'));
ok('a feltöltött kép URL-je a mezőbe került', (await p.inputValue('#ese-kep')).startsWith('https://harness.example/'));
ok('a kép-előnézet megjelent', !(await p.locator('#ese-kep-elonezet').isHidden()));
ok('a feltöltés az admin/ Storage-útvonalra ment', await p.evaluate(() => window.__utolsoFeltoltes.utvonal.startsWith('admin/')));
await p.screenshot({ path: SC + '/esemenyek-uj-kepfeltoltes.png', fullPage: true });
await p.click('#ese-ment');
await p.waitForSelector('.lista');
const uj = await p.evaluate(() => window.__utolsoCF);
ok('új eseménynél nincs id (a szerver ad)', uj.payload.action === 'upsert' && uj.payload.id === undefined);
ok('új esemény month/day (DEC/05)', uj.payload.data.month === 'DEC' && uj.payload.data.day === '05');
ok('a kép URL a mentett adatban van', String(uj.payload.data.image || '').startsWith('https://harness.example/'));
ok('a lista már öt kártyás', await p.locator('[data-esemeny-id]').count() === 5);

/* 6) Törlés a listáról: név-visszaírós megerősítéssel */
dialogValasz = 'Őszi Erőnléti Tábor';
await p.click('[data-esemeny-torol="ev-piszkozat"]');
await p.waitForFunction(() => document.querySelectorAll('[data-esemeny-id]').length === 4);
const torles = await p.evaluate(() => window.__utolsoCF);
ok('törlés: manageContent / events / delete a jó id-vel',
  torles.payload.collection === 'events' && torles.payload.action === 'delete' && torles.payload.id === 'ev-piszkozat');
ok('törlés után nincs több piszkozat-jel', await p.locator('.piszkozat-jel').count() === 0);
dialogValasz = null;
await p.screenshot({ path: SC + '/esemenyek-lista-vegallapot.png', fullPage: true });

await b.close();
console.log(hibak.length ? `\n${hibak.length} HIBA` : '\nMINDEN TESZT ZÖLD');
process.exit(hibak.length ? 1 : 0);
