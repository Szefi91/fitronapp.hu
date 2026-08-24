// Teszt-harness Storage: a feltoltes nem megy sehova, csak visszaad egy URL-t.
export function getStorage() { return { _stub: true }; }
export function ref(_t, ut) { return { ut }; }
export async function uploadBytes(r) { window.__utolsoFeltoltes = r.ut; return {}; }
export async function getDownloadURL(r) { return 'https://teszt.local/' + r.ut; }
