/**
 * FITRON admin felület (fitronapp.hu/admin/).
 *
 * MIÉRT ITT: Szefi 2026-08-22 döntése, hogy a szerkesztés a weboldalon legyen, nem az appban.
 * Külön Vite belépési pont, tehát a marketing-oldal NEM tölti be ezt a kódot.
 *
 * MIT TUD MOST: belépés, szerepkör-ellenőrzés, moderálási sor (jelentések), tartalom-listák.
 * A szerkesztés a manageContent Cloud Function-ön megy majd, mert a böngésző közvetlenül
 * NEM írhat a tartalom-gyűjteményekbe (firestore.rules: allow write: if false).
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs, updateDoc, query, where, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { can, roleOf, hasStaffAccess, SZEREP_NEVEK } from './roles.js';
import { osszeallitPartner, kulcsSzoveg, ertelmezKulcs } from './partner-utils.js';

const konfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = document.getElementById('app');
let auth = null;
let db = null;
let fuggvenyek = null;
let profil = null;
let aktivFul = 'jelentesek';

function beallitva() {
  return Boolean(konfig.apiKey && konfig.projectId);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function allapot(szoveg) {
  app.className = 'allapot';
  app.innerHTML = `<p class="allapot-szoveg">${esc(szoveg)}</p>`;
}

/* ------------------------------ belépés ------------------------------ */

function belepesKepernyo(hibaSzoveg) {
  app.className = 'allapot';
  app.innerHTML = `
    <form class="belepes" id="belepes-urlap">
      <h1>FITRON admin</h1>
      <p class="alcim">Belépés a szerkesztéshez és a moderáláshoz.</p>
      <label class="mezo"><span>E-mail</span><input type="email" id="email" autocomplete="username" required /></label>
      <label class="mezo"><span>Jelszó</span><input type="password" id="jelszo" autocomplete="current-password" required /></label>
      <button type="submit" id="belep-gomb">Belépés</button>
      <div class="valaszto"><span>vagy</span></div>
      <button type="button" id="google-gomb" class="masodlagos">Belépés Google-fiókkal</button>
      ${hibaSzoveg ? `<p class="hiba">${esc(hibaSzoveg)}</p>` : ''}
    </form>`;
  // Aki a telefonos appba Google-fiokkal lepett be, annak NINCS jelszava -- e nelkul be sem
  // tudna jonni ide. (Szefi kerdezte 2026-08-23: "mi van ha gmaillel leptem be?")
  document.getElementById('google-gomb').addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') return;   // o zarta be, ez nem hiba
      belepesKepernyo('A Google-belépés nem sikerült: ' + (err?.code || 'ismeretlen hiba'));
    }
  });
  document.getElementById('belepes-urlap').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gomb = document.getElementById('belep-gomb');
    gomb.disabled = true;
    gomb.textContent = 'Belépés...';
    try {
      await signInWithEmailAndPassword(auth, document.getElementById('email').value.trim(), document.getElementById('jelszo').value);
    } catch (err) {
      // Szandekosan NEM mondjuk meg, hogy az email vagy a jelszo volt-e rossz.
      belepesKepernyo('Hibás e-mail vagy jelszó.');
      console.warn('belepes hiba', err?.code);
    }
  });
}

/* ------------------------------ keret ------------------------------ */

function keret(tartalom) {
  const szerep = roleOf(profil);
  const fulek = [
    can(profil, 'moderate_reports') && ['jelentesek', 'Jelentések'],
    can(profil, 'manage_content') && ['receptek', 'Receptek'],
    can(profil, 'manage_content') && ['esemenyek', 'Események'],
    can(profil, 'manage_content') && ['tervek', 'Edzéstervek'],
    can(profil, 'manage_partners') && ['partnerek', 'Partnerek'],
  ].filter(Boolean);

  app.className = '';
  app.innerHTML = `
    <header class="fejlec">
      <h1>FITRON admin</h1>
      <span class="szerep">${esc(SZEREP_NEVEK[szerep] || szerep)}</span>
      <div class="jobb">
        <span class="ki">${esc(profil?.email || '')}</span>
        <button class="masodlagos" id="kilep">Kilépés</button>
      </div>
    </header>
    <nav class="fulek">
      ${fulek.map(([id, cim]) => `<button class="ful ${id === aktivFul ? 'aktiv' : ''}" data-ful="${id}">${esc(cim)}</button>`).join('')}
    </nav>
    <main id="tartalom">${tartalom}</main>`;

  document.getElementById('kilep').addEventListener('click', () => signOut(auth));
  app.querySelectorAll('[data-ful]').forEach((b) => b.addEventListener('click', () => {
    aktivFul = b.dataset.ful;
    // Fulvaltasnal a nyitott szerkesztok bezarulnak, kulonben a masik fulon is az urlap latszana.
    szerkesztettTetel = null; szerkesztettPartner = null;
    ujraRajzol();
  }));
}

/* ------------------------------ nézetek ------------------------------ */

async function jelentesekNezet() {
  const snap = await getDocs(query(collection(db, 'reports'), limit(100)));
  const tetelek = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!tetelek.length) return '<p class="ures">Nincs jelentés. Ez jó hír.</p>';

  const rend = { open: 0, reviewed: 1, actioned: 2 };
  tetelek.sort((a, b) => (rend[a.status] ?? 9) - (rend[b.status] ?? 9));

  const cimke = { open: ['nyitott', 'Nyitott'], reviewed: ['atnezve', 'Átnézve'], actioned: ['intezkedve', 'Intézkedve'] };
  return `<div class="lista">${tetelek.map((r) => {
    const [osztaly, nev] = cimke[r.status] || ['nyitott', r.status];
    return `<article class="tetel">
      <div class="fo">
        <strong>${esc(r.targetType === 'user' ? 'Felhasználó' : 'Poszt')} jelentve</strong>
        <div class="meta">Ok: ${esc(r.reason || '(nincs megadva)')}</div>
        <div class="meta">Azonosító: ${esc(r.targetId)}</div>
        <div class="muveletek">
          <button data-jelentes="${esc(r.id)}" data-uj="reviewed" class="masodlagos">Átnézve</button>
          <button data-jelentes="${esc(r.id)}" data-uj="actioned">Intézkedve</button>
          <button data-jelentes="${esc(r.id)}" data-uj="open" class="masodlagos">Visszanyit</button>
        </div>
      </div>
      <span class="jelzo ${osztaly}">${esc(nev)}</span>
    </article>`;
  }).join('')}</div>`;
}

async function tartalomNezet(kollekcio, cimMezo) {
  const snap = await getDocs(query(collection(db, kollekcio), limit(100)));
  const tetelek = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const fejlec = `<div class="muveletek" style="margin-bottom:14px">
    <button data-uj="${esc(kollekcio)}">Új felvétele</button></div>`;
  if (!tetelek.length) {
    return fejlec + `<p class="ures">Ez a gyűjtemény üres. Az app ilyenkor a beépített tartaléklistát használja.</p>`;
  }
  return fejlec + `<div class="lista">${tetelek.map((t) => `
    <article class="tetel">
      <div class="fo">
        <strong>${esc(t[cimMezo] || t.name || t.title || '(névtelen)')}</strong>
        <div class="meta">Azonosító: ${esc(t.id)}</div>
        <div class="muveletek">
          <button class="masodlagos" data-szerk="${esc(kollekcio)}" data-id="${esc(t.id)}">Szerkesztés</button>
        </div>
      </div>
      ${t.isPremium ? '<span class="jelzo intezkedve">Prémium</span>' : ''}
    </article>`).join('')}</div>`;
}

/* ------------------------------ partnerek ------------------------------ */

/**
 * Affiliate partnerek: a JUTALEK-KULCS beallitasa. A partners/{uid} dokumentumot a bongeszo
 * NEM irhatja (firestore.rules: allow write: if false) -- a mentes a manageContent Cloud
 * Function-on megy, mint a tartalom. Indok: a jutalek-kulcs PENZ, tehat maradjon nyoma a
 * contentAudit-ban, KI allitotta at es MIKOR.
 *
 * A dokumentum azonositoja a PARTNER uid-je, NEM auto-id. Ezert lehet a felulten a partner-kodot
 * (FIT...) is megadni: feloldjuk uid-re, kulonben egy elgepelt azonositoval olyan partner-doc
 * keletkezne, ami senkihez nem tartozik, es ez csak a kifizetesnel derulne ki.
 */

let szerkesztettPartner = null;   // { uid?, adat, uj }

async function partnerekNezet() {
  const snap = await getDocs(query(collection(db, 'partners'), limit(200)));
  const tetelek = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Az aruhaz levonasa: a partner jutaleka a NETTORA jar (Szefi 2026-08-22: "amennyit megkap
  // kezhez annyit irjon"). A fizetesi ertesito sokszor megmondja a sajat szazalekat; ez az ertek
  // akkor lep be, ha nem mondja meg. Ezert all itt, a partnerek mellett, es nem egy rejtett kodsorban.
  let levonas = null;
  try {
    const cfg = await getDoc(doc(db, 'config', 'affiliate'));
    if (cfg.exists()) levonas = cfg.data()?.storeCutPercent ?? null;
  } catch { /* olvasas-hiba: a mezo uresen jelenik meg, a szamitas az alapertelmezettel megy */ }

  const beallitas = `
    <form class="beallitas" id="levonas-urlap">
      <label class="mezo mezo-sor">
        <span>Áruház levonása (%)</span>
        <input type="text" id="levonas" inputmode="decimal" value="${esc(levonas ?? '')}" placeholder="15" />
        <button type="submit" id="levonas-ment">Mentés</button>
      </label>
      <p class="sugo">Ennyit tart meg az Apple és a Google. A partner százaléka az ezután maradó összegre jár.
        Ha üresen hagyod, 15 százalékkal számolok.</p>
      <p class="hiba" id="levonas-hiba" hidden></p>
    </form>`;

  const fejlec = beallitas + `<div class="muveletek" style="margin-bottom:14px">
      <button id="uj-partner">Új partner felvétele</button></div>`;
  if (!tetelek.length) {
    return fejlec + '<p class="ures">Még nincs beállított partner. A felvételhez a partner kódja (FIT...) vagy az azonosítója kell.</p>';
  }
  tetelek.sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id), 'hu'));
  return fejlec + `<div class="lista">${tetelek.map((t) => `
    <article class="tetel">
      <div class="fo">
        <strong>${esc(t.displayName || '(nincs név)')}</strong>
        <div class="meta">Jutalék: ${esc(kulcsSzoveg(t.commissionRate))}</div>
        <div class="meta">Azonosító: ${esc(t.id)}</div>
        <div class="muveletek">
          <button class="masodlagos" data-partner="${esc(t.id)}">Szerkesztés</button>
        </div>
      </div>
      <span class="jelzo ${t.active ? 'intezkedve' : 'nyitott'}">${t.active ? 'Aktív' : 'Szünetel'}</span>
    </article>`).join('')}</div>`;
}

function partnerSzerkesztoNezet() {
  const { uid, adat, uj } = szerkesztettPartner;
  return `
    <div class="figyelmeztetes">
      ${uj ? 'Új partner felvétele.' : 'Meglévő partner szerkesztése.'}
      A jutalék-kulcs a szerveren keresztül mentődik, és nyomot hagy, ki állította át.
    </div>
    <form id="partner-urlap" class="belepes" style="width:min(560px,96vw)">
      <label class="mezo"><span>${uj ? 'Partner kódja (FIT...) vagy azonosítója' : 'Azonosító'}</span>
        <input type="text" id="partner-azonosito" value="${esc(uid || '')}" ${uj ? 'autocomplete="off" required' : 'readonly'} /></label>
      <label class="mezo"><span>Név (ha üresen hagyod, a felhasználó nevét írom be)</span>
        <input type="text" id="partner-nev" value="${esc(adat.displayName || '')}" autocomplete="off" /></label>
      <label class="mezo"><span>Jutalék-kulcs százalékban (például 20)</span>
        <input type="text" id="partner-kulcs" inputmode="decimal" value="${esc(adat.commissionRate ?? '')}" required /></label>
      <label class="mezo mezo-sor">
        <input type="checkbox" id="partner-aktiv" ${adat.active === false ? '' : 'checked'} />
        <span>Aktív partner (ha kiveszed, a kulcs megmarad, de szünetel)</span></label>
      <div class="muveletek">
        <button type="submit" id="partner-ment">Mentés</button>
        <button type="button" class="masodlagos" id="partner-megse">Mégse</button>
        ${uj ? '' : '<button type="button" class="veszelyes" id="partner-torol">Törlés</button>'}
      </div>
      <p class="hiba" id="partner-hiba" hidden></p>
    </form>`;
}

/**
 * Kodbol/azonositobol VALODI felhasznalo. Szandekosan ellenorzi, hogy a felhasznalo letezik-e:
 * enelkul egy elgepeles egy arva partner-docot szulne, jutalek-kulccsal, gazda nelkul.
 */
async function feloldPartnerAzonosito(az) {
  if (az.tipus === 'uid') {
    const snap = await getDoc(doc(db, 'users', az.ertek));
    if (!snap.exists()) throw new Error('Nincs ilyen azonosítójú felhasználó.');
    return { uid: az.ertek, nev: snap.data()?.name || '' };
  }
  const talalat = await getDocs(query(collection(db, 'users'), where('partnerCode', '==', az.ertek), limit(2)));
  if (talalat.empty) throw new Error('Nem találok felhasználót ezzel a kóddal: ' + az.ertek);
  if (talalat.size > 1) throw new Error('Több felhasználóhoz is tartozik ez a kód. Add meg inkább az azonosítót.');
  return { uid: talalat.docs[0].id, nev: talalat.docs[0].data()?.name || '' };
}

function partnerSzerkesztoEsemenyek() {
  const hiba = (uzenet) => {
    const el = document.getElementById('partner-hiba');
    el.hidden = !uzenet; el.textContent = uzenet || '';
  };

  document.getElementById('partner-megse').addEventListener('click', () => {
    szerkesztettPartner = null; ujraRajzol();
  });

  const torolGomb = document.getElementById('partner-torol');
  if (torolGomb) torolGomb.addEventListener('click', async () => {
    if (!confirm('Biztosan törlöd ezt a partnert? A jutalék-kulcsa is eltűnik.')) return;
    torolGomb.disabled = true;
    try {
      await httpsCallable(fuggvenyek, 'manageContent')({
        collection: 'partners', action: 'delete', id: szerkesztettPartner.uid,
      });
      szerkesztettPartner = null; await ujraRajzol();
    } catch (err) {
      torolGomb.disabled = false;
      hiba(olvashatoHiba(err));
    }
  });

  document.getElementById('partner-urlap').addEventListener('submit', async (e) => {
    e.preventDefault();
    hiba('');
    const gomb = document.getElementById('partner-ment');
    const eredmeny = osszeallitPartner({
      azonosito: szerkesztettPartner.uj ? document.getElementById('partner-azonosito').value : szerkesztettPartner.uid,
      kulcs: document.getElementById('partner-kulcs').value,
      aktiv: document.getElementById('partner-aktiv').checked,
      nev: document.getElementById('partner-nev').value,
      letezo: !szerkesztettPartner.uj,
    });
    if (!eredmeny.ok) { hiba(eredmeny.hiba); return; }

    gomb.disabled = true; gomb.textContent = 'Mentés...';
    try {
      // Uj partnernel feloldjuk a kodot uid-re (es ellenorizzuk, hogy letezik-e a felhasznalo).
      // Meglevo partnernel NINCS feloldas: az uid mar megvan, es egy kozben torolt felhasznalo
      // miatt sem akarok abba a helyzetbe kerulni, hogy egy arva partnert nem lehet lekapcsolni.
      const { uid, nev } = szerkesztettPartner.uj
        ? await feloldPartnerAzonosito(eredmeny.azonosito)
        : { uid: szerkesztettPartner.uid, nev: '' };
      const adat = { ...eredmeny.adat };
      // Ha az admin nem irt nevet, a felhasznalo sajat nevet tesszuk be, hogy a lista
      // ne csupa azonositobol alljon.
      if (!adat.displayName && nev) adat.displayName = nev;
      await httpsCallable(fuggvenyek, 'manageContent')({
        collection: 'partners', action: 'upsert', id: uid, data: adat,
      });
      szerkesztettPartner = null; await ujraRajzol();
    } catch (err) {
      gomb.disabled = false; gomb.textContent = 'Mentés';
      hiba(err instanceof Error && err.message && !err.code ? err.message : olvashatoHiba(err));
    }
  });
}

/* ------------------------------ szerkesztő ------------------------------ */

/**
 * Mezo-terkep tartalom-tipusonkent. Szandekosan EGYSZERU: cim + par mezo + szabad JSON.
 * MIERT a szabad JSON: a receptek/tervek szerkezete meg valtozhat, es nem akarom, hogy a
 * szerkeszto ELVESZITSE azokat a mezoket, amiket a felulet nem ismer. A mentes a manageContent
 * fuggvenyen at megy, ami a nem ismert mezoket valtozatlanul atveszi.
 */
const MEZOK = {
  recipes:      { kollekcio: 'recipes',      cimMezo: 'name',  cimke: 'Recept' },
  events:       { kollekcio: 'events',       cimMezo: 'title', cimke: 'Esemény' },
  workoutPlans: { kollekcio: 'workoutPlans', cimMezo: 'title', cimke: 'Edzésterv' },
};

let szerkesztettTetel = null;   // { kollekcio, id?, adat }

function szerkesztoNezet() {
  const { kollekcio, id, adat } = szerkesztettTetel;
  const info = MEZOK[kollekcio];
  const ujE = !id;
  return `
    <div class="figyelmeztetes">
      ${ujE ? 'Új' : 'Meglévő'} ${esc(info.cimke.toLowerCase())} szerkesztése.
      A mentés a szerveren keresztül megy, és nyomot hagy, hogy ki módosította.
    </div>
    <form id="szerk-urlap" class="belepes" style="width:min(680px,96vw)">
      <label class="mezo"><span>Megnevezés</span>
        <input type="text" id="szerk-cim" value="${esc(adat[info.cimMezo] || '')}" required /></label>
      <label class="mezo"><span>Minden mező (JSON) — amit nem ismer a felület, az is megmarad</span>
        <textarea id="szerk-json" rows="14" spellcheck="false">${esc(JSON.stringify(adat, null, 2))}</textarea></label>
      <div class="muveletek">
        <button type="submit" id="szerk-ment">Mentés</button>
        <button type="button" class="masodlagos" id="szerk-megse">Mégse</button>
        ${ujE ? '' : `<button type="button" class="veszelyes" id="szerk-torol">Törlés</button>`}
      </div>
      <p class="hiba" id="szerk-hiba" hidden></p>
    </form>`;
}

function szerkesztoEsemenyek() {
  const info = MEZOK[szerkesztettTetel.kollekcio];
  const hiba = (uzenet) => {
    const el = document.getElementById('szerk-hiba');
    el.hidden = !uzenet; el.textContent = uzenet || '';
  };

  document.getElementById('szerk-megse').addEventListener('click', () => {
    szerkesztettTetel = null; ujraRajzol();
  });

  const torolGomb = document.getElementById('szerk-torol');
  if (torolGomb) torolGomb.addEventListener('click', async () => {
    if (!confirm('Biztosan törlöd? Ez nem vonható vissza.')) return;
    torolGomb.disabled = true;
    try {
      await httpsCallable(fuggvenyek, 'manageContent')({
        collection: szerkesztettTetel.kollekcio, action: 'delete', id: szerkesztettTetel.id,
      });
      szerkesztettTetel = null; await ujraRajzol();
    } catch (err) {
      torolGomb.disabled = false;
      hiba(olvashatoHiba(err));
    }
  });

  document.getElementById('szerk-urlap').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gomb = document.getElementById('szerk-ment');
    hiba('');
    let adat;
    try {
      adat = JSON.parse(document.getElementById('szerk-json').value);
    } catch {
      hiba('A JSON hibás, így nem tudom elmenteni. Nézd át a zárójeleket és a vesszőket.');
      return;
    }
    // A megnevezes mezo a kulon inputbol nyer, hogy ne kelljen a JSON-ben keresgelni.
    adat[info.cimMezo] = document.getElementById('szerk-cim').value.trim();

    gomb.disabled = true; gomb.textContent = 'Mentés...';
    try {
      await httpsCallable(fuggvenyek, 'manageContent')({
        collection: szerkesztettTetel.kollekcio,
        action: 'upsert',
        id: szerkesztettTetel.id,
        data: adat,
      });
      szerkesztettTetel = null; await ujraRajzol();
    } catch (err) {
      gomb.disabled = false; gomb.textContent = 'Mentés';
      hiba(olvashatoHiba(err));
    }
  });
}

/** A Firebase hibakodjabol emberi mondat. Ne a nyers kodot lassa, aki dolgozik vele. */
function olvashatoHiba(err) {
  const kod = err?.code || '';
  if (kod.includes('permission-denied')) return 'Nincs jogosultságod ehhez a művelethez.';
  if (kod.includes('unauthenticated')) return 'Lejárt a belépésed. Lépj be újra.';
  if (kod.includes('invalid-argument')) return 'A szerver visszautasította: ' + (err?.message || 'hibás adat.');
  if (kod.includes('internal') || kod.includes('unavailable')) return 'A szerver most nem érhető el. Próbáld újra.';
  console.error(err);
  return 'Nem sikerült elmenteni. Részletek a konzolban.';
}

async function ujraRajzol() {
  keret('<p class="ures">Betöltés...</p>');
  const cel = document.getElementById('tartalom');
  try {
    let html = '<p class="ures">Ehhez nincs jogosultságod.</p>';
    if (szerkesztettPartner) {
      cel.innerHTML = partnerSzerkesztoNezet();
      partnerSzerkesztoEsemenyek();
      return;
    }
    if (szerkesztettTetel) {
      cel.innerHTML = szerkesztoNezet();
      szerkesztoEsemenyek();
      return;
    }
    if (aktivFul === 'jelentesek' && can(profil, 'moderate_reports')) html = await jelentesekNezet();
    else if (aktivFul === 'receptek' && can(profil, 'manage_content')) html = await tartalomNezet('recipes', 'name');
    else if (aktivFul === 'esemenyek' && can(profil, 'manage_content')) html = await tartalomNezet('events', 'title');
    else if (aktivFul === 'tervek' && can(profil, 'manage_content')) html = await tartalomNezet('workoutPlans', 'title');
    else if (aktivFul === 'partnerek' && can(profil, 'manage_partners')) html = await partnerekNezet();
    cel.innerHTML = html;

    const levonasUrlap = cel.querySelector('#levonas-urlap');
    if (levonasUrlap) levonasUrlap.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hibaElem = document.getElementById('levonas-hiba');
      const gomb = document.getElementById('levonas-ment');
      const ertek = ertelmezKulcs(document.getElementById('levonas').value);
      if (!ertek.ok) { hibaElem.hidden = false; hibaElem.textContent = ertek.hiba; return; }
      if (ertek.ertek >= 100) { hibaElem.hidden = false; hibaElem.textContent = 'A levonás nem lehet 100 százalék vagy több.'; return; }
      hibaElem.hidden = true;
      gomb.disabled = true; gomb.textContent = 'Mentés...';
      try {
        await httpsCallable(fuggvenyek, 'manageContent')({
          collection: 'config', action: 'upsert', id: 'affiliate', data: { storeCutPercent: ertek.ertek },
        });
        await ujraRajzol();
      } catch (err) {
        gomb.disabled = false; gomb.textContent = 'Mentés';
        hibaElem.hidden = false; hibaElem.textContent = olvashatoHiba(err);
      }
    });

    const ujPartnerGomb = cel.querySelector('#uj-partner');
    if (ujPartnerGomb) ujPartnerGomb.addEventListener('click', () => {
      szerkesztettPartner = { uid: '', adat: {}, uj: true };
      ujraRajzol();
    });

    cel.querySelectorAll('[data-partner]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const snap = await getDoc(doc(db, 'partners', b.dataset.partner));
        szerkesztettPartner = { uid: b.dataset.partner, adat: snap.exists() ? snap.data() : {}, uj: false };
        ujraRajzol();
      } catch (err) {
        b.disabled = false;
        alert(olvashatoHiba(err));
      }
    }));

    cel.querySelectorAll('[data-uj]').forEach((b) => b.addEventListener('click', () => {
      szerkesztettTetel = { kollekcio: b.dataset.uj, id: undefined, adat: {} };
      ujraRajzol();
    }));

    cel.querySelectorAll('[data-szerk]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const snap = await getDoc(doc(db, b.dataset.szerk, b.dataset.id));
        const adat = snap.exists() ? snap.data() : {};
        // A rendszer-mezoket nem mutatjuk szerkesztesre: azokat a szerver kezeli.
        delete adat.createdAt; delete adat.updatedAt; delete adat.updatedBy;
        szerkesztettTetel = { kollekcio: b.dataset.szerk, id: b.dataset.id, adat };
        ujraRajzol();
      } catch (err) {
        b.disabled = false;
        alert(olvashatoHiba(err));
      }
    }));

    cel.querySelectorAll('[data-jelentes]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await updateDoc(doc(db, 'reports', b.dataset.jelentes), { status: b.dataset.uj });
        await ujraRajzol();
      } catch (err) {
        b.disabled = false;
        alert('Nem sikerült menteni. Lehet, hogy nincs hozzá jogosultságod.');
        console.error(err);
      }
    }));
  } catch (err) {
    console.error(err);
    cel.innerHTML = `<p class="ures">Nem sikerült betölteni. Részletek a konzolban.</p>`;
  }
}

/* ------------------------------ indulás ------------------------------ */

async function indul() {
  if (!beallitva()) {
    allapot('Hiányzik a Firebase-konfiguráció. Helyi futtatáshoz a .env fájl kell.');
    return;
  }
  const fbApp = initializeApp(konfig);
  auth = getAuth(fbApp);
  db = getFirestore(fbApp);
  // A tartalom-iras SZERVER-OLDALON megy: a bongeszo nem irhat kozvetlenul
  // (firestore.rules: allow write: if false). A regio egyezzen a Cloud Function-okkel.
  fuggvenyek = getFunctions(fbApp, 'europe-west1');

  onAuthStateChanged(auth, async (user) => {
    if (!user) { profil = null; belepesKepernyo(); return; }
    allapot('Jogosultság ellenőrzése...');
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      profil = { email: user.email, ...(snap.exists() ? snap.data() : {}) };
    } catch (err) {
      console.error(err);
      profil = { email: user.email };
    }
    if (!hasStaffAccess(profil)) {
      app.className = 'allapot';
      app.innerHTML = `<div class="belepes">
        <h1>Nincs hozzáférésed</h1>
        <p class="alcim">Ez a fiók nem kapott admin, moderátori vagy ügyfélszolgálati jogot.</p>
        <button class="masodlagos" id="kilep2">Kilépés</button></div>`;
      document.getElementById('kilep2').addEventListener('click', () => signOut(auth));
      return;
    }
    if (!can(profil, 'moderate_reports')) aktivFul = 'receptek';
    await ujraRajzol();
  });
}

indul();
