/**
 * FITRON admin -- JELENTÉSEK (moderálás) fül.
 *
 * Külön fájl, hogy ne az 1500 soros admin.js-be írjunk (Szefi 2026-08-24). A bekötést
 * (import + hívás) az admin.js végzi; ez a modul a függőségeit PARAMÉTERKÉNT kapja, nem
 * globális változóból.
 *
 * MIT AD A KIINDULÁSHOZ KÉPEST (Anasztázia éjjeli verziója már betöltötte a bejelentett
 * tartalmat, adott állapot-gombokat és poszt-törlést):
 *  1) Szűrő: nyitott / átnézve / intézkedve (alapból a nyitottak).
 *  2) A jelentő (reporterId) feloldása névre -- eddig csak uid látszott.
 *  3) Ugyanarra a tartalomra érkező több jelentés ÖSSZEVONÁSA egy kártyába.
 *  4) Felhasználó-jelentésnél átugrás a felhasználóra (ha a bekötő átad ugrás-callbacket).
 *  5) Komment-jelentés támogatása (posts/{postId}/comments/{commentId}).
 *
 * A tiszta (Firestore-mentes) logika külön, exportált függvényekben van, hogy tesztelhető
 * legyen: admin/jelentesek.test.mjs.
 */
import {
  collection, getDocs, query, limit, doc, getDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

/* ------------------------------ tiszta segédfüggvények ------------------------------ */

/** HTML-escape (a modul önálló, nem az admin.js-belit használja). */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Státusz -> [css-osztály, magyar név]. A hiányzó státuszt nyitottnak vesszük. */
export function statuszCimke(status) {
  return ({
    open: ['nyitott', 'Nyitott'],
    reviewed: ['atnezve', 'Átnézve'],
    actioned: ['intezkedve', 'Intézkedve'],
  })[status] || ['nyitott', 'Nyitott'];
}

/** A hiányzó/ismeretlen státuszt "open"-nek tekintjük (a régi jelentéseknek nincs status mezője). */
export function normalStatusz(status) {
  return status === 'reviewed' || status === 'actioned' ? status : 'open';
}

/** Uid rövidítése megjelenítéshez, ha nincs feloldott név. */
export function rovidId(uid) {
  const s = String(uid ?? '');
  return s.length > 10 ? s.slice(0, 6) + '…' : (s || 'ismeretlen');
}

/** A jelentő azonosítója, több lehetséges mezőnévre defenzíven. */
export function reporterMezo(r) {
  return r?.reporterId ?? r?.reporterUid ?? r?.reporterUserId ?? r?.uid ?? null;
}

/** Komment-jelentésnél a szülő poszt azonosítója (defenzíven több mezőnévre). */
export function posztMezo(r) {
  return r?.postId ?? r?.parentPostId ?? r?.parentId ?? null;
}

/** A cél típusa: 'user' | 'comment' | 'post' (alapértelmezés poszt). */
export function celTipus(r) {
  return r?.targetType === 'user' || r?.targetType === 'comment' ? r.targetType : 'post';
}

/** Csoportosítási kulcs: azonos cél -> egy kártya. */
export function celKulcs(r) {
  return `${celTipus(r)}:${r?.targetId ?? ''}`;
}

/** A cél emberi felirata. */
export function celFelirat(tipus) {
  return tipus === 'user' ? 'Felhasználó' : tipus === 'comment' ? 'Hozzászólás' : 'Poszt';
}

/** Idő -> rövid, olvasható szöveg. Firestore Timestamp ({seconds}) VAGY ISO string VAGY üres. */
export function idoSzoveg(createdAt) {
  if (createdAt && typeof createdAt.seconds === 'number') {
    return new Date(createdAt.seconds * 1000).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' });
  }
  if (typeof createdAt === 'string' && createdAt) return createdAt.slice(0, 16).replace('T', ' ');
  return '';
}

/** Lezárt-e a jelentés (átnézve VAGY intézkedve egy közös "Lezárt" állapotba olvad). */
export function lezartE(status) {
  const n = normalStatusz(status);
  return n === 'reviewed' || n === 'actioned';
}

/**
 * Jelentések szűrése KÉT állapotra (Szefi 2026-08-24): 'open' = nyitott (a hiányzó státusz is),
 * 'lezart' = átnézve VAGY intézkedve. A régi három állapot adatban megmarad, csak a nézet vonja össze.
 */
export function szurStatusz(reports, szuro) {
  return (reports || []).filter((r) => (szuro === 'lezart' ? lezartE(r.status) : normalStatusz(r.status) === 'open'));
}

/**
 * Azonos célra érkező jelentések összevonása. Megőrzi az első előfordulás sorrendjét,
 * majd a több jelentést kapott célokat előre sorolja (azok a fontosabbak).
 * Visszaad: [{ kulcs, tipus, targetId, postId, jelentesek:[...], jelentesIdk:[...], szam }]
 */
export function csoportosit(reports) {
  const rend = new Map();
  for (const r of reports || []) {
    const kulcs = celKulcs(r);
    if (!rend.has(kulcs)) {
      rend.set(kulcs, {
        kulcs,
        tipus: celTipus(r),
        targetId: r.targetId ?? null,
        postId: posztMezo(r),
        jelentesek: [],
        jelentesIdk: [],
        szam: 0,
      });
    }
    const cs = rend.get(kulcs);
    cs.jelentesek.push(r);
    if (r.id) cs.jelentesIdk.push(r.id);
    cs.szam += 1;
    if (!cs.postId) cs.postId = posztMezo(r);   // ha csak egy jelentésen van meg a postId
  }
  return [...rend.values()].sort((a, b) => b.szam - a.szam);
}

/** A jelentő neve a feloldott név-térképből, vissza uid-rövidítésre. */
export function reporterNev(uid, nevMap) {
  if (!uid) return 'ismeretlen';
  const nev = nevMap && nevMap.get ? nevMap.get(uid) : null;
  return nev || rovidId(uid);
}

/* ------------------------------ Firestore olvasás (IO) ------------------------------ */

/** A bejelentett tartalom útvonala a cél típusa szerint. Komentnél kell a postId. */
function celRef(db, cs) {
  if (cs.tipus === 'user') return doc(db, 'users', cs.targetId);
  if (cs.tipus === 'comment') return cs.postId ? doc(db, 'posts', cs.postId, 'comments', cs.targetId) : null;
  return doc(db, 'posts', cs.targetId);
}

/** Modul-szintű szűrő-állapot (a fülön belül marad az újrarajzolások között). */
let aktivSzuro = 'open';
export function getAktivSzuro() { return aktivSzuro; }
export function setAktivSzuro(sz) { aktivSzuro = sz === 'lezart' ? 'lezart' : 'open'; }

/* ------------------------------ nézet ------------------------------ */

export async function jelentesekNezet({ db }) {
  const snap = await getDocs(query(collection(db, 'reports'), limit(200)));
  const osszes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const szamlalok = { open: 0, lezart: 0 };
  for (const r of osszes) szamlalok[lezartE(r.status) ? 'lezart' : 'open'] += 1;

  const nyitottNezet = aktivSzuro === 'open';
  const szurt = szurStatusz(osszes, aktivSzuro);
  const csoportok = csoportosit(szurt);

  // A bejelentett tartalmakat ES a jelento neveket EGYSZERRE toltjuk be (nem sorban).
  const tartalmak = new Map();
  await Promise.all(csoportok.map(async (cs) => {
    const ref = celRef(db, cs);
    if (!ref) return;
    try {
      const d = await getDoc(ref);
      if (d.exists()) tartalmak.set(cs.kulcs, d.data());
    } catch { /* jogosultság/hálózat -- a jelentés ettől még látszódjon */ }
  }));

  const reporterIdk = new Set();
  for (const cs of csoportok) for (const r of cs.jelentesek) {
    const uid = reporterMezo(r);
    if (uid) reporterIdk.add(uid);
  }
  const nevMap = new Map();
  await Promise.all([...reporterIdk].map(async (uid) => {
    try {
      const d = await getDoc(doc(db, 'users', uid));
      if (d.exists()) { const a = d.data(); nevMap.set(uid, a.name || a.userName || null); }
    } catch { /* a users/{uid} olvasható, de hálózat/jog eltérhet */ }
  }));

  const fejlec = szuroSav(szamlalok);
  if (!csoportok.length) {
    const ures = nyitottNezet
      ? 'Nincs nyitott jelentés. Ez jó hír.'
      : 'Nincs lezárt jelentés.';
    return `${fejlec}<p class="ures">${ures}</p>`;
  }

  return `${fejlec}<div class="lista">${csoportok.map((cs) => kartya(cs, tartalmak.get(cs.kulcs), nevMap, nyitottNezet)).join('')}</div>`;
}

/** A státusz-szűrő sáv, a darabszámokkal. */
function szuroSav(szamlalok) {
  const gombok = [
    ['open', 'Nyitott', szamlalok.open],
    ['lezart', 'Lezárt', szamlalok.lezart],
  ];
  return `<div class="szuro-sav">${gombok.map(([kulcs, nev, db]) =>
    `<button class="szuro ${kulcs === aktivSzuro ? 'aktiv' : ''}" data-szuro="${kulcs}">${esc(nev)} <span class="szuro-szam">${db}</span></button>`
  ).join('')}</div>`;
}

/**
 * Egy összevont jelentés-kártya. nyitottNezet=true a Nyitott szűrőn (ott a két döntés-gomb),
 * false a Lezárt szűrőn (ott csak a Visszanyit, hogy egy tévesen lezárt jelentés visszahozható legyen).
 */
function kartya(cs, tart, nevMap, nyitottNezet) {
  const [osztaly, statNev] = nyitottNezet ? ['nyitott', 'Nyitott'] : ['intezkedve', 'Lezárt'];
  const felirat = celFelirat(cs.tipus);
  const userE = cs.tipus === 'user';

  const okSorok = cs.jelentesek.map((r) => {
    const uid = reporterMezo(r);
    const nev = reporterNev(uid, nevMap);
    const ido = idoSzoveg(r.createdAt);
    // A jelentő neve kattintható -> a felhasználó adatlapjára visz (Szefi 2026-08-24). Ha nincs
    // reporterId, sima szöveg marad.
    const jelento = uid
      ? `<button type="button" class="link ok-jelento" data-jelentes-jelento="${esc(uid)}">${esc(nev)}</button>`
      : `<span class="ok-jelento">${esc(nev)}</span>`;
    return `<li class="ok-sor">
      ${jelento}
      ${ido ? `<span class="meta">${esc(ido)}</span>` : ''}
      <span class="ok-szoveg">${esc(r.reason || '(nincs ok megadva)')}</span>
    </li>`;
  }).join('');

  const idk = esc(cs.jelentesIdk.join(','));
  const tartalomBlokk = tart ? tartalomNezet(cs.tipus, tart) : `<p class="jelentett hianyzik">A bejelentett tartalom már nem érhető el (törölték, vagy nincs jogom olvasni).</p>`;

  // Nyitott nézet: KÉT egyértelmű döntés (a poszt marad + lezár VAGY törlés). Lezárt nézet: Visszanyit.
  const muveletek = nyitottNezet
    ? `<button data-csoport="${idk}" data-jelentes-statusz="reviewed">Rendben, maradhat</button>
       ${tart && cs.tipus === 'post'
        ? `<button class="veszelyes kicsi" data-poszt-torol="${esc(cs.targetId)}" data-jelentes-idk="${idk}">Poszt törlése</button>`
        : ''}`
    : `<button data-csoport="${idk}" data-jelentes-statusz="open" class="masodlagos">${cs.szam > 1 ? 'Mind visszanyit' : 'Visszanyit'}</button>`;

  return `<article class="tetel jelentes">
    <div class="fo">
      <div class="jelentes-fej">
        <strong>${esc(felirat)} jelentve</strong>
        <span class="jelzo ${osztaly}">${esc(statNev)}</span>
        ${cs.szam > 1 ? `<span class="jelzo tobb">${cs.szam} jelentés</span>` : ''}
      </div>

      ${tartalomBlokk}

      <ul class="okok">${okSorok}</ul>

      <div class="muveletek">
        ${muveletek}
        ${userE
          ? `<button class="masodlagos kicsi" data-ugras-felhasznalo="${esc(cs.targetId)}">Ugrás a felhasználóra</button>`
          : ''}
      </div>
    </div>
  </article>`;
}

/** A bejelentett tartalom megjelenítése (poszt / felhasználó / komment). */
function tartalomNezet(tipus, tart) {
  const nev = esc(tart.userName || tart.name || '(névtelen)');
  const avatar = tart.userAvatar || tart.avatar;
  const fej = `<div class="jelentett-fej">
      ${avatar ? `<img class="jelentett-avatar" src="${esc(avatar)}" alt="" />` : ''}
      <strong>${nev}</strong>
      ${tart.timestamp ? `<span class="meta">${esc(String(tart.timestamp).slice(0, 16).replace('T', ' '))}</span>` : ''}
    </div>`;
  if (tipus === 'user') {
    return `<div class="jelentett">${fej}
      <div class="meta">Szint: ${esc(tart.level ?? '?')} · ${esc(tart.tier || 'Scout')}</div></div>`;
  }
  // poszt vagy komment: szöveg + (posztnál) kép
  return `<div class="jelentett">${fej}
    ${tart.text || tart.content ? `<p class="jelentett-szoveg">${esc(tart.text || tart.content)}</p>` : ''}
    ${tipus === 'post' && tart.image ? `<img class="jelentett-kep" src="${esc(tart.image)}" alt="" />` : ''}</div>`;
}

/* ------------------------------ események ------------------------------ */

export function jelentesekEsemenyek(cel, { db, ujraRajzol, ugrasFelhasznalora }) {
  // Szűrő váltása: csak a modul-állapotot állítjuk, majd újrarajzolunk.
  cel.querySelectorAll('[data-szuro]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.szuro === aktivSzuro) return;
    setAktivSzuro(b.dataset.szuro);
    ujraRajzol();
  }));

  // Állapot-váltás EGY csoport MINDEN jelentésén (összevont kártya).
  cel.querySelectorAll('[data-csoport]').forEach((b) => b.addEventListener('click', async () => {
    const idk = (b.dataset.csoport || '').split(',').filter(Boolean);
    if (!idk.length) return;
    b.disabled = true;
    try {
      await Promise.all(idk.map((id) => updateDoc(doc(db, 'reports', id), { status: b.dataset.jelentesStatusz })));
      await ujraRajzol();
    } catch (err) {
      b.disabled = false;
      alert('Nem sikerült menteni. Lehet, hogy nincs hozzá jogosultságod.');
      console.error(err);
    }
  }));

  // Kifogásolt poszt törlése -> a csoport összes jelentése "intézkedve".
  cel.querySelectorAll('[data-poszt-torol]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Biztosan törlöd ezt a posztot?\n\nA szerzője nem kap róla értesítést, és nem vonható vissza.')) return;
    b.disabled = true; b.textContent = 'Törlés...';
    const idk = (b.dataset.jelentesIdk || '').split(',').filter(Boolean);
    try {
      await deleteDoc(doc(db, 'posts', b.dataset.posztTorol));
      await Promise.all(idk.map((id) => updateDoc(doc(db, 'reports', id), { status: 'actioned' })));
      await ujraRajzol();
    } catch (err) {
      b.disabled = false; b.textContent = 'Poszt törlése';
      alert('Nem sikerült törölni. Lehet, hogy nincs hozzá jogosultságod.');
      console.error(err);
    }
  }));

  // Ugrás egy felhasználóra. Ha a bekötő átad callbacket, azt hívjuk; különben a uid-t vágólapra
  // tesszük, hogy a Felhasználók fülön be lehessen keresni. Két helyről hívjuk:
  //  - a jelentett felhasználó ("Ugrás a felhasználóra" gomb),
  //  - a jelentő NEVE (kattintható, Szefi 2026-08-24).
  const ugrasUserre = async (uid) => {
    if (!uid) return;
    if (typeof ugrasFelhasznalora === 'function') { ugrasFelhasznalora(uid); return; }
    try { await navigator.clipboard.writeText(uid); alert('A felhasználó azonosítója a vágólapon. A Felhasználók fülön beilleszthető.'); }
    catch { alert('Felhasználó azonosító: ' + uid); }
  };
  cel.querySelectorAll('[data-ugras-felhasznalo]').forEach((b) => b.addEventListener('click', () => ugrasUserre(b.dataset.ugrasFelhasznalo)));
  cel.querySelectorAll('[data-jelentes-jelento]').forEach((b) => b.addEventListener('click', () => ugrasUserre(b.dataset.jelentesJelento)));
}
