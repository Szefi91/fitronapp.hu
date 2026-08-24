// Teszt-harness Firestore: rogzitett adatok, hogy a felulet valodi renderelese lathato legyen.
const ADATOK = {
  users: {
    'aQ1admin000000000000000000zz': { role: 'admin', name: 'Szefi' },
    'pA2kiss00000000000000000000x': { name: 'Kiss Jozsef', partnerCode: 'FITAAA111' },
    'pB3nagy00000000000000000000y': { name: 'Nagy Reka', partnerCode: 'FITBBB222' },
  },
  partners: {
    'pA2kiss00000000000000000000x': { displayName: 'Kiss József', commissionRate: 20, active: true },
    'pB3nagy00000000000000000000y': { displayName: 'Nagy Réka', commissionRate: 12.5, active: false },
    'pC4nevn00000000000000000000w': { commissionRate: undefined, active: true },
  },
  config: { affiliate: { storeCutPercent: 30 } },
  reports: {},
  recipes: {
    'rec-zabkasa': { title: 'Fehérjés zabkása', category: 'breakfast', prepTime: '10 perc', kcal: 420, protein: 32, carbs: 55, fat: 9, image: '', description: 'Reggeli, ami eltelít.', ingredients: ['80 g zabpehely', '1 adag fehérjepor', '200 ml tej'], instructions: ['Főzd meg a zabpelyhet.', 'Keverd bele a fehérjeport.'], isPremium: false, isFree: true },
    'rec-piszkozat': { title: 'Édesburgonyás csirke', category: 'main', prepTime: '35 perc', kcal: 610, protein: 48, carbs: 60, fat: 16, ingredients: ['300 g csirkemell'], instructions: ['Süsd meg.'], isPremium: true, isFree: false, published: false },
  },
  events: {
    'ev-nyari': { title: 'Nyári futóverseny', date: '2026-07-12', month: 'JÚL', day: '12', location: 'Budapest, Margitsziget', type: 'Futás', attendees: 120, isPremium: false, hasMedal: true, tags: ['futás', 'verseny'], image: 'https://teszt.local/futas.jpg', description: 'Tíz kilométeres verseny.' },
    'ev-piszkozat': { title: 'Őszi edzőtábor', date: '2026-09-30', month: 'SZEP', day: '30', location: 'Balatonfüred', type: 'Edzőtábor', attendees: 24, isPremium: true, hasMedal: false, tags: ['tábor'], image: '', description: 'Hétvégi tábor.', published: false },
  },
  workoutPlans: {},
};
export function getFirestore() { return { _stub: true }; }
export function doc(_db, kollekcio, id) { return { kollekcio, id }; }
export function collection(_db, kollekcio) { return { kollekcio }; }
export function query(ref, ...m) { return { ...ref, m }; }
export function where(mezo, _op, ertek) { return { tipus: 'where', mezo, ertek }; }
export function limit(n) { return { tipus: 'limit', n }; }
export async function getDoc(ref) {
  const d = (ADATOK[ref.kollekcio] || {})[ref.id];
  return { exists: () => Boolean(d), data: () => d };
}
export async function getDocs(q) {
  const forras = ADATOK[q.kollekcio] || {};
  let sorok = Object.entries(forras);
  const w = (q.m || []).find((x) => x && x.tipus === 'where');
  if (w) sorok = sorok.filter(([, v]) => v[w.mezo] === w.ertek);
  const docs = sorok.map(([id, v]) => ({ id, data: () => v }));
  return { docs, empty: docs.length === 0, size: docs.length };
}
export async function updateDoc() { return {}; }
export async function deleteDoc() { return {}; }
