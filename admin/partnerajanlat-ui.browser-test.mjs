/**
 * A KONYHA-AJÁNLAT FÜL VALÓDI BÖNGÉSZŐS TESZTJE (390 px, nem csak fordítás).
 *
 * Futtatás:
 *   1) npx vite --config vite.esemenyek.config.js      # Firebase-stub (közös), port 5178
 *   2) node admin/partnerajanlat-ui.browser-test.mjs
 *
 * MIÉRT KELL: a kupon és a termék-linkek MINDEN felhasználó Konyha képernyőjére mennek.
 * Egy rossz sorrend-csere vagy egy átengedett nem-http link élesben, mindenkinél
 * jelenne meg. A mentés-payloadokra állítunk (mit kap a szerver), nem a látszatra.
 */
import pkg from '/mnt/e/claude.ai/Agentek/marveen/node_modules/playwright/index.js';
const { chromium } = pkg;
const SC = process.env.SC || '/tmp';
const URL = 'http://localhost:5178/admin/partnerajanlat-harness.html';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const hibak = [];
const ok = (nev, felt, reszlet) => { console.log((felt ? 'OK   ' : 'BUKIK') + ' | ' + nev + (felt || !reszlet ? '' : '  <- ' + reszlet)); if (!felt) hibak.push(nev); };
let dialogValasz = null;
p.on('dialog', (d) => (dialogValasz === null ? d.accept() : d.accept(dialogValasz)));
p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('#pa-fej-urlap');

/* 1) Fej-űrlap előtöltve + 390px-en nincs túlcsordulás */
ok('390px-en nincs vizszintes tulcsordulas',
  await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
ok('kuponkod elotoltve', await p.inputValue('#pa-kupon') === 'KOLTI5');
ok('leiras elotoltve', (await p.inputValue('#pa-leiras')).includes('kedvezmény'));

/* 2) Lista: 3 termék sorrend szerint, a rejtett jelölve */
const cimek = () => p.locator('[data-pa-id] strong').allTextContents();
ok('harom termek, sorrend szerint', JSON.stringify(await cimek()) === JSON.stringify(['Whey Protein', 'Kreatin', 'Vitamin D3']), JSON.stringify(await cimek()));
ok('a rejtett termek jelolve', (await p.locator('[data-pa-id="t2"]').textContent()).includes('rejtett'));
await p.screenshot({ path: SC + '/konyhaajanlat-lista.png', fullPage: true });

/* 3) Kupon mentése: a CF a fej-dokumentumot kapja, fix id-vel */
await p.fill('#pa-kupon', 'KOLTI10');
await p.click('#pa-fej-ment');
await p.waitForFunction(() => window.__utolsoCF);
{
  const cf = await p.evaluate(() => window.__utolsoCF);
  ok('fej-mentes: partnerAjanlat/aktualis upsert',
    cf.payload.collection === 'partnerAjanlat' && cf.payload.id === 'aktualis' && cf.payload.action === 'upsert'
    && cf.payload.data.kuponKod === 'KOLTI10', JSON.stringify(cf.payload));
  ok('ujrarajzolas utan az uj kupon latszik', await p.inputValue('#pa-kupon') === 'KOLTI10');
}

/* 4) Sorrend: a Whey-t hátrébb visszük -- KÉT teljes-dokumentumos mentés, csere */
await p.evaluate(() => { window.__cfHivasok = []; });
await p.click('[data-pa-le="t1"]');
await p.waitForFunction(() => window.__cfHivasok.length >= 2);
{
  const hivasok = await p.evaluate(() => window.__cfHivasok);
  ok('mozgatas: ket upsert ment', hivasok.length === 2 && hivasok.every((h) => h.payload.action === 'upsert'));
  ok('mindket mentes TELJES doksit kuld (nev is megy)', hivasok.every((h) => typeof h.payload.data.nev === 'string' && h.payload.data.nev));
  ok('csere utan a Kreatin az elso', JSON.stringify(await cimek()) === JSON.stringify(['Kreatin', 'Whey Protein', 'Vitamin D3']), JSON.stringify(await cimek()));
}

/* 5) Szerkesztő: előtöltés + link-magyarázat + rossz link kliens-oldalon elakad */
await p.click('[data-pa-szerk="t3"]');
await p.waitForSelector('#pa-termek-urlap');
ok('nev elotoltve', await p.inputValue('#pa-nev') === 'Vitamin D3');
ok('a link melletti magyarazat ott van (sima linket kell bemasolni)',
  (await p.locator('#pa-termek-urlap').textContent()).includes('SIMA termék-linket'));
await p.screenshot({ path: SC + '/konyhaajanlat-szerkeszto.png', fullPage: true });
await p.evaluate(() => { window.__utolsoCF = null; });
await p.fill('#pa-link', 'ftp://rossz');
await p.click('#pa-termek-ment');
await p.waitForTimeout(200);
ok('nem-http link: kliens-hibauzenet', (await p.textContent('#pa-termek-hiba')).includes('http'));
ok('nem-http linknel NEM indult CF', await p.evaluate(() => !window.__utolsoCF));
await p.fill('#pa-link', 'https://bolt.hu/d3');
await p.click('#pa-termek-ment');
await p.waitForSelector('[data-pa-uj]');
{
  const cf = await p.evaluate(() => window.__utolsoCF);
  ok('termek-mentes a jo alkollekciora, teljes adattal',
    cf.payload.collection === 'partnerAjanlat/aktualis/termekek' && cf.payload.id === 't3'
    && cf.payload.data.link === 'https://bolt.hu/d3' && cf.payload.data.lathato === true, JSON.stringify(cf.payload));
}

/* 6) Új termék: üres név elakad; érvényes mentésnél sorrend = max+1, id nincs */
await p.click('[data-pa-uj]');
await p.waitForSelector('#pa-termek-urlap');
ok('uj termeknel a sorrend alapbol max+1', await p.inputValue('#pa-sorrend') === '4');
await p.evaluate(() => { window.__utolsoCF = null; });
await p.click('#pa-termek-ment');
await p.waitForTimeout(200);
/* Az üres nevet a mező natív required-je fogja meg (a böngésző nem engedi beküldeni),
   a JS-validáció csak tartalék -- azt ellenőrizzük, hogy tényleg blokkolva van. */
ok('ures nevet a nativ required blokkolja', await p.evaluate(() => document.getElementById('pa-nev').validity.valueMissing));
ok('ures nevnel NEM indult CF', await p.evaluate(() => !window.__utolsoCF));
await p.fill('#pa-nev', 'Omega-3');
await p.fill('#pa-ar', '4 590 Ft');
await p.click('#pa-termek-ment');
await p.waitForSelector('[data-pa-uj]');
{
  const cf = await p.evaluate(() => window.__utolsoCF);
  ok('uj termek: id nelkuli upsert, sorrend=4',
    cf.payload.id === undefined && cf.payload.data.sorrend === 4 && cf.payload.data.nev === 'Omega-3', JSON.stringify(cf.payload));
  ok('a lista negy termekes lett', (await cimek()).length === 4);
}

/* 7) Törlés név-visszaírással */
dialogValasz = 'Kreatin';
await p.click('[data-pa-torol="t2"]');
await p.waitForFunction(() => document.querySelectorAll('[data-pa-id]').length === 3);
{
  const cf = await p.evaluate(() => window.__utolsoCF);
  ok('torles a jo alkollekciora, jo id-vel',
    cf.payload.collection === 'partnerAjanlat/aktualis/termekek' && cf.payload.action === 'delete' && cf.payload.id === 't2');
}
dialogValasz = null;
await p.screenshot({ path: SC + '/konyhaajanlat-vegallapot.png', fullPage: true });

await b.close();
console.log(hibak.length ? `\n${hibak.length} HIBA` : '\nMINDEN TESZT ZÖLD');
process.exit(hibak.length ? 1 : 0);
