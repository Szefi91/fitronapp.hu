// Teszt-harness: belepett ADMIN felhasznalot szimulal, hogy a valodi admin.js kod fusson.
export function getAuth() { return { _stub: true }; }
export function onAuthStateChanged(_auth, cb) { setTimeout(() => cb({ uid: 'aQ1admin000000000000000000zz', email: 'szefi@fitron.app' }), 0); return () => {}; }
export async function signInWithEmailAndPassword() { return {}; }
export async function signOut() { return {}; }
export class GoogleAuthProvider {}
export async function signInWithPopup() { return {}; }
