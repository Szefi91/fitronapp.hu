/**
 * CSAK TESZTHEZ: Firebase-stub az ESEMÉNYEK fül böngészős tesztjéhez (esemenyek.js).
 * Egy fájl adja a firestore + functions + storage API-t (a vite.esemenyek.config.js
 * mindhárom 'firebase/*' modult ide aliasolja). A manageContent hívás TÉNYLEG
 * módosítja az itteni adatot, hogy a mentés utáni újrarajzolás is ellenőrizhető legyen.
 */
const ESEMENYEK = {
  'ev-szkander': {
    title: 'Országos Szkander Kupa', date: '2026-09-12', month: 'SZEP', day: '12',
    time: '10:00', location: 'Budapest', type: 'Szkander', attendees: 34, maxAttendees: 64,
    isPremium: true, hasMedal: true, tags: ['Kupa', 'Nemzeti'], published: true,
    description: 'Az év legnagyobb hazai szkander versenye.',
    image: 'https://example.com/szkander.jpg',
  },
  // RÉGI esemény: NINCS published mezője -> a felületen "kint van"-ként kell látszania.
  'ev-regi': {
    title: 'Nyárzáró Futás', date: '2026-08-30', location: 'Debrecen', type: 'Futás',
    attendees: 12, tags: ['Közösségi'], extraMezo: 'megmarad',
  },
  'ev-piszkozat': {
    title: 'Őszi Erőnléti Tábor', date: '2026-10-01', location: 'Eger', type: 'Fitness',
    attendees: 0, maxAttendees: 20, published: false,
  },
  // HIBÁS doksi: nincs date -> a listában akkor is látszania kell (a végén).
  'ev-datumtalan': { title: 'Dátum nélküli teszt', location: 'Szeged', attendees: 3 },
};

/* ------------ firestore ------------ */
/* A dep-scan az admin/index.html-t is beolvassa, ezert az admin.js/jelentesek.js altal
   importalt nevek is kellenek -- azok itt csak ures csonkok, ez a harness NEM az admin.js-t
   futtatja. */
export function doc(_db, kollekcio, id) { return { kollekcio, id }; }
export async function getDoc() { return { exists: () => false, data: () => undefined }; }
export async function updateDoc() { return {}; }
export async function deleteDoc() { return {}; }
export function where(mezo, _op, ertek) { return { tipus: 'where', mezo, ertek }; }
export function orderBy(mezo, irany) { return { tipus: 'orderBy', mezo, irany }; }
export function getFirestore() { return { _stub: true }; }
export function collection(_db, kollekcio) { return { kollekcio }; }
export function query(ref, ...m) { return { ...ref, m }; }
export function limit(n) { return { tipus: 'limit', n }; }
export async function getDocs(q) {
  if (q.kollekcio !== 'events') return { docs: [], empty: true, size: 0 };
  const docs = Object.entries(ESEMENYEK).map(([id, v]) => ({ id, data: () => ({ ...v }) }));
  return { docs, empty: docs.length === 0, size: docs.length };
}

/* ------------ functions ------------ */
export function getFunctions() { return { _stub: true }; }
export function httpsCallable(_f, nev) {
  return async (payload) => {
    console.log('[harness] CF hivas:', nev, JSON.stringify(payload));
    window.__utolsoCF = { nev, payload };
    window.__cfHivasok = (window.__cfHivasok || []).concat([{ nev, payload }]);
    if (nev === 'manageContent' && payload.collection === 'events') {
      if (payload.action === 'delete') delete ESEMENYEK[payload.id];
      if (payload.action === 'upsert') {
        const id = payload.id || ('uj-' + Object.keys(ESEMENYEK).length);
        ESEMENYEK[id] = { ...payload.data };
      }
    }
    return { data: { ok: true } };
  };
}

/* ------------ storage ------------ */
export function getStorage() { return { _stub: true }; }
export function ref(_tar, utvonal) { return { utvonal }; }
export async function uploadBytes(r, fajl) {
  console.log('[harness] feltoltes:', r.utvonal, fajl && fajl.size, 'bajt');
  window.__utolsoFeltoltes = { utvonal: r.utvonal, meret: fajl ? fajl.size : 0 };
  return {};
}
export async function getDownloadURL(r) {
  return 'https://harness.example/' + encodeURIComponent(r.utvonal);
}
