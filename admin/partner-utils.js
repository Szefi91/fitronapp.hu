/**
 * Partner (affiliate) admin -- TISZTA segedfuggvenyek.
 *
 * MIERT KULON FAJL: ezek Firebase nelkul futtathatok, tehat node --test-tel valodi teszt
 * fut rajuk. Az admin.js DOM-os resze nem tesztelheto igy, a szamolos/ellenorzos resz igen,
 * es itt PENZ van (jutalek-kulcs), tehat nem eleg ranezni.
 *
 * A jutalek-kulcs a partners/{uid} dokumentumban el. Az {uid} NEM auto-id: a partner
 * felhasznaloi azonositoja. Ezert van a kod-feloldas (FIT... -> uid), kulonben az admin
 * kezzel masolna uid-t, es egy elgepeles egy SOHA senkihez nem tartozo partner-docot szulne.
 */

/** A partner-kod alakja a Fitron appban: 'FIT' + 6 karakter (lib/firestore-user.ts). */
export const KOD_MINTA = /^FIT[A-Z0-9]{6}$/;

/**
 * Amit az admin beir (kod vagy uid), abbol hasznalhato ertek.
 * A kodot nagybetusitjuk es a szokozoket kiszedjuk, mert telefonrol/masolasbol
 * gyakran kisbetus vagy szokozos alakban jon.
 */
export function normalizalAzonosito(nyers) {
  const s = String(nyers ?? '').trim().replace(/\s+/g, '');
  if (!s) return { tipus: 'ures', ertek: '' };
  const nagy = s.toUpperCase();
  if (KOD_MINTA.test(nagy)) return { tipus: 'kod', ertek: nagy };
  // A Firebase uid betu/szam, 20-40 karakter kozott. A '/' kizarva: az utvonalat torne el.
  if (/^[A-Za-z0-9_-]{20,64}$/.test(s)) return { tipus: 'uid', ertek: s };
  return { tipus: 'ervenytelen', ertek: s };
}

/**
 * A jutalek-kulcs ellenorzese. Szazalek, 0 es 100 kozott.
 * A magyar tizedesvesszot ('12,5') is elfogadjuk, mert azt fogja beirni, aki magyar
 * billentyuzeten dolgozik, es egy csendes NaN itt PENZT allitana rosszra.
 */
export function ertelmezKulcs(nyers) {
  const s = String(nyers ?? '').trim().replace(',', '.').replace('%', '').trim();
  if (s === '') return { ok: false, hiba: 'A jutalék-kulcs nem lehet üres.' };
  const szam = Number(s);
  if (!Number.isFinite(szam)) return { ok: false, hiba: 'A jutalék-kulcs csak szám lehet (például 20).' };
  if (szam < 0) return { ok: false, hiba: 'A jutalék-kulcs nem lehet negatív.' };
  if (szam > 100) return { ok: false, hiba: 'A jutalék-kulcs nem lehet 100 százaléknál nagyobb.' };
  // Ket tizedesnel tovabb nincs ertelme, es a lebegopontos maradek csunya osszegeket szulne.
  return { ok: true, ertek: Math.round(szam * 100) / 100 };
}

/**
 * A mentendo partner-dokumentum osszeallitasa. Hibat ad vissza, nem dob, mert
 * a felulet a hibat a mezo ala irja ki.
 */
export function osszeallitPartner({ azonosito, kulcs, aktiv, nev, letezo = false }) {
  // MAR LETEZO partnernel az azonositot NEM ellenorizzuk ujra: az a dokumentum sajat azonositoja,
  // nem az admin gepelte be. (Ez elo hiba volt: a szerkesztes a sajat uid-jen bukott el.)
  const az = letezo
    ? { tipus: 'uid', ertek: String(azonosito ?? '') }
    : normalizalAzonosito(azonosito);
  if (az.tipus === 'ures' || (letezo && !az.ertek)) return { ok: false, hiba: 'Add meg a partner kódját (FIT...) vagy az azonosítóját.' };
  if (az.tipus === 'ervenytelen') return { ok: false, hiba: 'Ez nem tűnik érvényes partner-kódnak vagy azonosítónak.' };

  const k = ertelmezKulcs(kulcs);
  if (!k.ok) return { ok: false, hiba: k.hiba };

  return {
    ok: true,
    azonosito: az,
    adat: {
      commissionRate: k.ertek,
      active: Boolean(aktiv),
      ...(String(nev ?? '').trim() ? { displayName: String(nev).trim() } : {}),
    },
  };
}

/** Megjelenites: '20%' / '12.5%'. Ha nincs ertek, nem talalunk ki nullat. */
export function kulcsSzoveg(ertek) {
  if (typeof ertek !== 'number' || !Number.isFinite(ertek)) return 'nincs beállítva';
  return String(ertek) + '%';
}
