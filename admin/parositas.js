import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * BELEPES JOVAHAGYASA TELEFONON (2026-08-24)
 *
 * Ezt az oldalt a telefon nyitja meg, miutan a kamerajaval ranezett a gepen megjeleno QR-kodra.
 * Itt a belepes FaceID/TouchID (Apple) vagy egy koppintas (Google), mert a telefonon a felhasznalo
 * mar be van jelentkezve -- semmit nem kell begepelnie. Ez a lenyeg: a gepen NINCS jelszo-beiras.
 *
 * A tenyleges jogosultsag-ellenorzes a `parositasJovahagy` fuggvenyben, SZERVER-OLDALON tortenik.
 * Itt csak a felulet van.
 */

const konfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = document.getElementById('app');
const kod = new URLSearchParams(location.search).get('kod') || '';
let auth = null;
let fuggvenyek = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function allapot(szoveg, alszoveg) {
  app.className = 'allapot';
  app.innerHTML = `
    <div class="belepes">
      <h1>FITRON</h1>
      <p class="allapot-szoveg">${esc(szoveg)}</p>
      ${alszoveg ? `<p class="alcim" style="margin-top:10px">${esc(alszoveg)}</p>` : ''}
    </div>`;
}

/** A kod formaja fix: 32 hexa karakter. Ha nem az, el se induljunk. */
function ervenyesKod() {
  return /^[0-9a-f]{32}$/.test(kod);
}

function belepesKepernyo(hibaSzoveg) {
  app.className = 'allapot';
  app.innerHTML = `
    <div class="belepes">
      <h1>Belépés jóváhagyása</h1>
      <p class="alcim">A gépen elindított belépéshez lépj be itt a telefonodon. Semmit nem kell begépelned.</p>
      <button type="button" id="apple-gomb">Belépés Apple ID-val</button>
      <button type="button" id="google-gomb" class="masodlagos" style="margin-top:10px">Belépés Google-fiókkal</button>
      ${hibaSzoveg ? `<p class="hiba">${esc(hibaSzoveg)}</p>` : ''}
    </div>`;

  const belep = async (szolgaltato) => {
    try {
      await signInWithPopup(auth, szolgaltato);
    } catch (err) {
      if (err?.code === 'auth/popup-closed-by-user') return;   // o zarta be, ez nem hiba
      belepesKepernyo('A belépés nem sikerült: ' + (err?.code || 'ismeretlen hiba'));
    }
  };
  document.getElementById('google-gomb').addEventListener('click', () => belep(new GoogleAuthProvider()));
  document.getElementById('apple-gomb').addEventListener('click', () => {
    const p = new OAuthProvider('apple.com');
    p.addScope('email');
    p.addScope('name');
    p.setCustomParameters({ locale: 'hu_HU' });
    belep(p);
  });
}

function jovahagyoKepernyo(user, hibaSzoveg) {
  app.className = 'allapot';
  app.innerHTML = `
    <div class="belepes">
      <h1>Beengeded a gépet?</h1>
      <p class="alcim">Ezzel a fiókkal lép be a számítógépen:<br><strong>${esc(user.email || user.displayName || 'a fiókod')}</strong></p>
      <button type="button" id="jovahagy">Igen, engedd be</button>
      <button type="button" id="megse" class="masodlagos" style="margin-top:10px">Mégsem</button>
      ${hibaSzoveg ? `<p class="hiba">${esc(hibaSzoveg)}</p>` : ''}
    </div>`;

  document.getElementById('megse').addEventListener('click', async () => {
    // A kijelentkezes szandekos: ha valaki tevedesbol nyitotta meg, ne maradjon bent a telefonon.
    await signOut(auth).catch(() => {});
    allapot('Rendben, nem engedtem be semmit.', 'Ezt az ablakot bezárhatod.');
  });

  document.getElementById('jovahagy').addEventListener('click', async () => {
    const gomb = document.getElementById('jovahagy');
    gomb.disabled = true;
    gomb.textContent = 'Egy pillanat...';
    try {
      await httpsCallable(fuggvenyek, 'parositasJovahagy')({ kod });
      allapot('Kész, a gépen már bent vagy.', 'Ezt az ablakot bezárhatod.');
    } catch (err) {
      // A szerver emberi hibauzeneteket ad (lejart kod, nincs jogosultsag), azt mutatjuk.
      jovahagyoKepernyo(user, err?.message || 'Nem sikerült a jóváhagyás.');
    }
  });
}

function indul() {
  if (!konfig.apiKey || !konfig.projectId) {
    allapot('Hiányzik a Firebase-konfiguráció.', 'Ezt a webhely beállításánál kell pótolni.');
    return;
  }
  if (!ervenyesKod()) {
    allapot('Ez a link hiányos.', 'Olvasd be újra a QR-kódot a gépen látható ablakból.');
    return;
  }
  const fb = initializeApp(konfig);
  auth = getAuth(fb);
  // UGYANAZ a regio, mint a tobbi fuggvenynel -- enelkul a hivas 404-et kapna.
  fuggvenyek = getFunctions(fb, 'europe-west1');

  allapot('Betöltés...');
  onAuthStateChanged(auth, (user) => {
    if (!user) belepesKepernyo();
    else jovahagyoKepernyo(user);
  });
}

indul();
