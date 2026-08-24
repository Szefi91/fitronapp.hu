/**
 * FITRON admin -- KONYHA-AJÁNLAT fül (kupon + partner-termékek).
 *
 * MIÉRT: eddig a Konyha képernyő kuponja és két terméke BE VOLT ÉGETVE az appba
 * (views/Kitchen.tsx), egy árváltozáshoz új app-verzió kellett. Szefi (2026-08-24):
 * a kupont és a termékeket (linkekkel) adminból kell tudni szerkeszteni.
 *
 * SÉMA (a forrás az app: FitronBuild/lib/partnerAjanlat.ts):
 *   partnerAjanlat/aktualis                 -> { kuponKod, cim, leiras }
 *   partnerAjanlat/aktualis/termekek/{id}   -> { nev, ar, markajelzes, kategoria,
 *                                               kep, link, sorrend, lathato }
 * Az ar SZÖVEG (pl. "12 990 Ft"). A LINK-be a sima termék-link kerül: a követési
 * paramétert (utm) az APP fűzi hozzá megjelenítéskor, az adminban nem kell vele bajlódni.
 *
 * A minta az esemenyek.js: önálló modul, minden függőség paraméterként jön, írás
 * KIZÁRÓLAG a manageContent Cloud Functionön (a böngésző nem ír közvetlenül).
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

/* ------------------------------ segédek (esemenyek.js-ből átemelve) ------------------------------ */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function olvashatoHiba(err) {
  const kod = err?.code || '';
  if (kod.includes('permission-denied')) return 'Nincs jogosultságod ehhez a művelethez.';
  if (kod.includes('unauthenticated')) return 'Lejárt a belépésed. Lépj be újra.';
  if (kod.includes('invalid-argument')) return 'A szerver visszautasította: ' + (err?.message || 'hibás adat.');
  if (kod.includes('internal') || kod.includes('unavailable')) return 'A szerver most nem érhető el. Próbáld újra.';
  console.error(err);
  return 'Nem sikerült elmenteni. Részletek a konzolban.';
}

const TERMEK_KOLLEKCIO = 'partnerAjanlat/aktualis/termekek';

/* ------------------------------ állapot ------------------------------ */

let szerkesztettTermek = null;   // { id?, adat }
/* A legutóbb betöltött, sorrend szerint rendezett lista: a fel/le mozgatásnak kell
   (a szomszéd teljes adatával együtt, mert a mentés a TELJES dokumentumot küldi --
   a szerver a csonka, név nélküli terméket helyesen elutasítja). */
let utolsoTermekek = [];

function rendezett(termekek) {
  return [...termekek].sort((a, b) => (a.sorrend ?? 0) - (b.sorrend ?? 0));
}

/* ------------------------------ nézetek ------------------------------ */

function fejUrlap(fej) {
  return `
    <form id="pa-fej-urlap" class="belepes" style="width:min(760px,100%)">
      <h2 style="margin:0 0 4px">Kupon</h2>
      <div class="gyak-racs">
        <label><span>Kuponkód</span>
          <input type="text" id="pa-kupon" value="${esc(fej.kuponKod || '')}" placeholder="pl. FITRON10" /></label>
        <label><span>Cím</span>
          <input type="text" id="pa-cim" value="${esc(fej.cim || '')}" placeholder="pl. Partner ajánlat" /></label>
      </div>
      <label class="mezo"><span>Leírás</span>
        <textarea id="pa-leiras" rows="2">${esc(fej.leiras || '')}</textarea></label>
      <div class="muveletek">
        <button type="submit" id="pa-fej-ment">Kupon mentése</button>
      </div>
      <p class="hiba" id="pa-fej-hiba" hidden></p>
    </form>`;
}

function termekKartya(t) {
  return `
    <article class="huzhato" data-pa-id="${esc(t.id)}">
      ${t.kep ? `<div class="huzhato-kep" style="background-image:url('${esc(t.kep)}')"></div>` : ''}
      <div class="huzhato-fo">
        <strong>${esc(t.nev || '(névtelen)')}</strong>
        <div class="huzhato-meta">
          ${esc(t.ar || 'nincs ár')}
          ${t.markajelzes ? ` · ${esc(t.markajelzes)}` : ''}${t.kategoria ? ` · ${esc(t.kategoria)}` : ''}
          ${t.lathato === false ? ' · <span class="piszkozat-jel">rejtett</span>' : ''}
        </div>
      </div>
      <div class="huzhato-gombok">
        <button class="masodlagos kicsi" data-pa-fel="${esc(t.id)}" title="Előrébb">↑</button>
        <button class="masodlagos kicsi" data-pa-le="${esc(t.id)}" title="Hátrébb">↓</button>
        <button class="masodlagos kicsi" data-pa-szerk="${esc(t.id)}">Szerk.</button>
        <button class="veszelyes kicsi" data-pa-torol="${esc(t.id)}" data-nev="${esc(t.nev || '')}">Törlés</button>
      </div>
    </article>`;
}

function termekSzerkesztoHtml() {
  const { id, adat } = szerkesztettTermek;
  const ujT = !id;
  return `
    <div class="figyelmeztetes">
      ${ujT ? 'Új' : 'Meglévő'} partner-termék szerkesztése.
      A mentés a szerveren keresztül megy, és nyomot hagy, hogy ki módosította.
    </div>
    <form id="pa-termek-urlap" class="belepes" style="width:min(760px,100%)">
      <label class="mezo"><span>Termék neve</span>
        <input type="text" id="pa-nev" value="${esc(adat.nev || '')}" required /></label>
      <div class="gyak-racs">
        <label><span>Ár (szöveg, pl. 12 990 Ft)</span>
          <input type="text" id="pa-ar" value="${esc(adat.ar || '')}" /></label>
        <label><span>Márka</span>
          <input type="text" id="pa-marka" value="${esc(adat.markajelzes || '')}" /></label>
        <label><span>Kategória</span>
          <input type="text" id="pa-kategoria" value="${esc(adat.kategoria || '')}" /></label>
      </div>
      <label class="mezo"><span>Kép (URL)</span>
        <input type="url" id="pa-kep" placeholder="https://..." value="${esc(adat.kep || '')}" /></label>
      <label class="mezo"><span>Termék-link</span>
        <input type="url" id="pa-link" placeholder="https://..." value="${esc(adat.link || '')}" />
        <span class="halvany" style="font-size:.82rem">A SIMA termék-linket másold be. A követési
        paramétert (utm) az app magától hozzáfűzi, azzal itt nem kell foglalkozni.</span></label>
      <div class="gyak-racs">
        <label><span>Sorrend</span>
          <input type="number" id="pa-sorrend" value="${esc(adat.sorrend ?? '')}" /></label>
        <label class="pipa"><input type="checkbox" id="pa-lathato" ${adat.lathato === false ? '' : 'checked'} />
          <span>Látható az appban</span></label>
      </div>
      <div class="muveletek">
        <button type="submit" id="pa-termek-ment">Mentés</button>
        <button type="button" class="masodlagos" id="pa-megse">Mégse</button>
        ${ujT ? '' : `<button type="button" class="veszelyes" id="pa-torol">Törlés</button>`}
      </div>
      <p class="hiba" id="pa-termek-hiba" hidden></p>
    </form>`;
}

/** Az űrlapból a mentendő termék. A nem ismert mezőket megtartja (eredetire épít). */
function termekOsszeallit() {
  const eredeti = szerkesztettTermek.adat || {};
  const m = (id) => document.getElementById(id).value.trim();
  const sorrendNyers = m('pa-sorrend');
  return {
    ...eredeti,
    nev: m('pa-nev'),
    ar: m('pa-ar'),
    markajelzes: m('pa-marka'),
    kategoria: m('pa-kategoria'),
    kep: m('pa-kep'),
    link: m('pa-link'),
    sorrend: sorrendNyers === '' ? kovetkezoSorrend() : Number(sorrendNyers),
    lathato: document.getElementById('pa-lathato').checked,
  };
}

function kovetkezoSorrend() {
  return utolsoTermekek.reduce((max, t) => Math.max(max, t.sorrend ?? 0), 0) + 1;
}

/* ------------------------------ exportok ------------------------------ */

export async function partnerAjanlatNezet({ db }) {
  if (szerkesztettTermek) return termekSzerkesztoHtml();

  const [fejDoc, lista] = await Promise.all([
    getDoc(doc(db, 'partnerAjanlat', 'aktualis')),
    getDocs(collection(db, 'partnerAjanlat', 'aktualis', 'termekek')),
  ]);
  const fej = fejDoc.exists() ? fejDoc.data() : {};
  utolsoTermekek = rendezett(lista.docs.map((d) => ({ id: d.id, ...d.data() })));

  const termekFejlec = `<div class="muveletek" style="margin:18px 0 14px">
    <h2 style="margin:0;flex:1">Termékek</h2>
    <button data-pa-uj>Új termék</button></div>`;
  const listaHtml = utolsoTermekek.length
    ? `<div class="lista">${utolsoTermekek.map(termekKartya).join('')}</div>`
    : `<p class="ures">Még nincs termék. Amíg a lista üres, az app a beépített tartalék-ajánlatot mutatja.</p>`;
  return fejUrlap(fej) + termekFejlec + listaHtml;
}

export function partnerAjanlatEsemenyek(cel, { db, fuggvenyek, ujraRajzol }) {
  const ment = (payload) => httpsCallable(fuggvenyek, 'manageContent')(payload);

  /* ---------- termék-szerkesztő nyitva ---------- */
  if (szerkesztettTermek) {
    const hiba = (uzenet) => {
      const el = document.getElementById('pa-termek-hiba');
      el.hidden = !uzenet; el.textContent = uzenet || '';
    };

    document.getElementById('pa-megse').addEventListener('click', () => {
      szerkesztettTermek = null; ujraRajzol();
    });

    const torolGomb = document.getElementById('pa-torol');
    if (torolGomb) torolGomb.addEventListener('click', async () => {
      if (!confirm('Biztosan törlöd? Ez nem vonható vissza.')) return;
      torolGomb.disabled = true;
      try {
        await ment({ collection: TERMEK_KOLLEKCIO, action: 'delete', id: szerkesztettTermek.id });
        szerkesztettTermek = null; await ujraRajzol();
      } catch (err) {
        torolGomb.disabled = false;
        hiba(olvashatoHiba(err));
      }
    });

    document.getElementById('pa-termek-urlap').addEventListener('submit', async (e) => {
      e.preventDefault();
      const gomb = document.getElementById('pa-termek-ment');
      hiba('');
      const adat = termekOsszeallit();
      if (!adat.nev) { hiba('A termék neve nem maradhat üresen.'); return; }
      for (const mezo of ['kep', 'link']) {
        if (adat[mezo] && !/^https?:\/\//.test(adat[mezo])) {
          hiba(`A ${mezo === 'kep' ? 'kép' : 'link'} csak http(s) cím lehet.`); return;
        }
      }
      gomb.disabled = true; gomb.textContent = 'Mentés...';
      try {
        await ment({ collection: TERMEK_KOLLEKCIO, action: 'upsert', id: szerkesztettTermek.id, data: adat });
        szerkesztettTermek = null; await ujraRajzol();
      } catch (err) {
        gomb.disabled = false; gomb.textContent = 'Mentés';
        hiba(olvashatoHiba(err));
      }
    });
    return;
  }

  /* ---------- fej (kupon) mentése ---------- */
  document.getElementById('pa-fej-urlap').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gomb = document.getElementById('pa-fej-ment');
    const hibaEl = document.getElementById('pa-fej-hiba');
    hibaEl.hidden = true;
    const m = (id) => document.getElementById(id).value.trim();
    gomb.disabled = true; gomb.textContent = 'Mentés...';
    try {
      await ment({
        collection: 'partnerAjanlat', action: 'upsert', id: 'aktualis',
        data: { kuponKod: m('pa-kupon'), cim: m('pa-cim'), leiras: m('pa-leiras') },
      });
      await ujraRajzol();
    } catch (err) {
      gomb.disabled = false; gomb.textContent = 'Kupon mentése';
      hibaEl.hidden = false; hibaEl.textContent = olvashatoHiba(err);
    }
  });

  /* ---------- termék-lista ---------- */
  const ujGomb = cel.querySelector('[data-pa-uj]');
  if (ujGomb) ujGomb.addEventListener('click', () => {
    szerkesztettTermek = { id: undefined, adat: { sorrend: kovetkezoSorrend(), lathato: true } };
    ujraRajzol();
  });

  cel.querySelectorAll('[data-pa-szerk]').forEach((b) => b.addEventListener('click', () => {
    const t = utolsoTermekek.find((x) => x.id === b.dataset.paSzerk);
    if (!t) return;
    const { id, ...adat } = t;
    szerkesztettTermek = { id, adat };
    ujraRajzol();
  }));

  cel.querySelectorAll('[data-pa-torol]').forEach((b) => b.addEventListener('click', async () => {
    const nev = b.dataset.nev || 'ezt a terméket';
    if (prompt(`A törléshez írd be a termék nevét: "${nev}"`) !== nev) return;
    b.disabled = true;
    try {
      await ment({ collection: TERMEK_KOLLEKCIO, action: 'delete', id: b.dataset.paTorol });
      await ujraRajzol();
    } catch (err) {
      b.disabled = false;
      alert(olvashatoHiba(err));
    }
  }));

  /* Fel/le: a MEGJELENÍTETT sorrendben cserél helyet a szomszéddal. A két mentés a
     TELJES dokumentumot küldi (a szerver a név nélküli, csonka mentést elutasítja). */
  const mozgat = async (gomb, id, irany) => {
    const sorban = rendezett(utolsoTermekek);
    const i = sorban.findIndex((x) => x.id === id);
    const j = i + irany;
    if (i < 0 || j < 0 || j >= sorban.length) return;
    const a = sorban[i]; const b2 = sorban[j];
    /* Azonos sorrend-értékeknél (pl. minden 0) a csere önmagában nem változtatna;
       ilyenkor a lista-pozícióból osztunk újra egyértelmű értékeket. */
    let aUj = b2.sorrend ?? 0; let bUj = a.sorrend ?? 0;
    if (aUj === bUj) { aUj = j + 1; bUj = i + 1; }
    gomb.disabled = true;
    try {
      const { id: aId, ...aAdat } = a;
      const { id: bId, ...bAdat } = b2;
      await ment({ collection: TERMEK_KOLLEKCIO, action: 'upsert', id: aId, data: { ...aAdat, sorrend: aUj } });
      await ment({ collection: TERMEK_KOLLEKCIO, action: 'upsert', id: bId, data: { ...bAdat, sorrend: bUj } });
      await ujraRajzol();
    } catch (err) {
      gomb.disabled = false;
      alert(olvashatoHiba(err));
    }
  };
  cel.querySelectorAll('[data-pa-fel]').forEach((b) => b.addEventListener('click', () => mozgat(b, b.dataset.paFel, -1)));
  cel.querySelectorAll('[data-pa-le]').forEach((b) => b.addEventListener('click', () => mozgat(b, b.dataset.paLe, 1)));
}
