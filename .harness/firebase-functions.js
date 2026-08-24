// Teszt-harness Cloud Functions. A listUsers eleg sok felhasznalot ad vissza, hogy a
// lapozas es a kereses tenyleg tesztelheto legyen (nem 3 sorral).
const NEVEK = ['Kiss József', 'Nagy Réka', 'Tóth Ödön', 'Szabó Ágnes', 'Kovács Béla', 'Varga Zsófia',
  'Molnár Örs', 'Németh Ildikó', 'Farkas Ügyes', 'Balogh Emese', 'Papp Áron', 'Lakatos Bence',
  'Mészáros Dóra', 'Simon Gergő', 'Fekete Márk', 'Szűcs Petra', 'Oláh Tamás', 'Fehér Anita',
  'Takács Csaba', 'Juhász Nóra', 'Szalai Máté', 'Gál Enikő', 'Rácz Tibor'];
const FELHASZNALOK = [
  { uid: 'aQ1admin000000000000000000zz', name: 'Szefi', email: 'szefi@fitron.app', role: 'admin', tier: 'Legend', utoljara: 1787500000000 },
  ...NEVEK.map((nev, i) => ({
    uid: 'u' + String(i).padStart(27, '0'),
    name: nev,
    email: nev.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(/ /g, '.') + '@pelda.hu',
    role: i === 2 ? 'moderator' : 'user',
    tier: i % 3 === 0 ? 'Legend' : 'Scout',
    utoljara: i % 4 === 0 ? null : 1787000000000 + i * 86400000,
    partnerProgramEnabled: i === 1,
  })),
];
window.__torolt = [];
export function getFunctions() { return { _stub: true }; }
export function httpsCallable(_f, nev) {
  return async (payload) => {
    console.log('[harness] CF hivas:', nev, JSON.stringify(payload));
    window.__utolsoCF = { nev, payload };
    if (nev === 'listUsers') return { data: { users: FELHASZNALOK.filter((u) => !window.__torolt.includes(u.uid)) } };
    if (nev === 'deleteAccount') { window.__torolt.push(payload.uid); return { data: { ok: true } }; }
    return { data: { ok: true } };
  };
}
