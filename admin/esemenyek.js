/**
 * FITRON admin -- ESEMÉNYEK fül (mezős szerkesztő + kártyás lista).
 *
 * MIÉRT KÜLÖN FÁJL: párhuzamos munka (2026-08-24, Anasztázia bekötésével). Ez a modul
 * SEMMIT nem importál az admin.js-ből: minden függőségét (db, fuggvenyek, ujraRajzol)
 * paraméterként kapja, a közös segédek (esc, kepMezo, feltöltés) ide vannak átemelve.
 *
 * SÉMA (a forrás az app: FitronBuild/lib/events.ts docToEvent + seedEvents):
 *   title, date ('YYYY-MM-DD'), month ('JAN'), day ('24'), location, type,
 *   attendees (szám), isPremium, hasMedal, tags (string[]), image, description.
 * A month/day a kártya-megjelenítéshez kell az appban; itt a dátumból SZÁMOLJUK,
 * hogy ne lehessen elcsúszni. A felület által nem ismert mezőket a mentés megtartja
 * (az eredeti adatra épít), a manageContent pedig merge-gel ír.
 *
 * FONTOS, app-oldali rés (2026-08-24-i felderítés): a getEvents NEM szűr published-re,
 * tehát a "Kint van az appban" pipa app-oldali szűrője még hiányzik. A pipát a tervek
 * mintája szerint így is tároljuk (hiányzó published == kint van), hogy a szűrő
 * bekötésekor a meglévő adat jó legyen.
 */
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref as tarolóRef, uploadBytes, getDownloadURL } from 'firebase/storage';

/* ------------------------------ segédek (admin.js-ből átemelve) ------------------------------ */

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

function kepMezo(id, ertek, cimke = 'Borítókép') {
  return `
    <label class="mezo"><span>${esc(cimke)}</span>
      <div class="kep-mezo">
        <input type="url" id="${id}" placeholder="https://... vagy tölts fel egy képet" value="${esc(ertek || '')}" />
        <button type="button" class="masodlagos kicsi" data-kep-fel="${id}">Feltöltés</button>
        <input type="file" accept="image/*" id="${id}-fajl" hidden />
      </div>
      <div class="kep-elonezet" id="${id}-elonezet" ${ertek ? `style="background-image:url('${esc(ertek)}')"` : 'hidden'}></div>
    </label>`;
}

function kepFeltoltesEsemenyek(gyoker = document) {
  gyoker.querySelectorAll('[data-kep-fel]').forEach((gomb) => {
    const id = gomb.dataset.kepFel;
    const fajlBemenet = document.getElementById(`${id}-fajl`);
    const mezo = document.getElementById(id);
    const elonezet = document.getElementById(`${id}-elonezet`);
    if (!fajlBemenet || !mezo) return;

    gomb.addEventListener('click', () => fajlBemenet.click());
    fajlBemenet.addEventListener('change', async () => {
      const fajl = fajlBemenet.files && fajlBemenet.files[0];
      if (!fajl) return;
      if (fajl.size > 8 * 1024 * 1024) { alert('Ez a kép túl nagy (max 8 MB).'); return; }
      gomb.disabled = true; gomb.textContent = 'Feltöltés...';
      try {
        const tar = getStorage();
        const nev = `admin/${Date.now()}-${fajl.name.replace(/[^\w.-]/g, '_')}`;
        const r = tarolóRef(tar, nev);
        await uploadBytes(r, fajl, { contentType: fajl.type });
        const url = await getDownloadURL(r);
        mezo.value = url;
        if (elonezet) { elonezet.hidden = false; elonezet.style.backgroundImage = `url('${url}')`; }
      } catch (err) {
        alert('A kép feltöltése nem sikerült. ' + olvashatoHiba(err));
      }
      gomb.disabled = false; gomb.textContent = 'Feltöltés';
    });
  });
}

/* ------------------------------ dátum-segédek ------------------------------ */

/* Az app kártyája a month/day szöveget mutatja; a seed-adat magyar rövidítést használ. */
const HONAP_JELEK = ['JAN', 'FEB', 'MÁR', 'ÁPR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SZEP', 'OKT', 'NOV', 'DEC'];

function honapJel(datum) {
  const h = Number(String(datum).slice(5, 7));
  return HONAP_JELEK[h - 1] || '';
}

function napJel(datum) {
  const n = String(datum).slice(8, 10);
  return /^\d\d$/.test(n) ? n : '--';
}

function szepDatum(e) {
  if (!e.date) return 'nincs dátum';
  return `${e.date}${e.time ? ' ' + e.time : ''}`;
}

/* ------------------------------ állapot ------------------------------ */

/* A szerkesztő állapota MODULON BELÜL él; fülváltásnál az admin.js újrarajzol, és
   a lista jön vissza (a bezárást a Mégse/Mentés intézi). */
let szerkesztettEsemeny = null;   // { id?, adat }

/* ------------------------------ lista-nézet ------------------------------ */

/**
 * A kártya SZÁNDÉKOSAN az app Események-oldalát követi (views/Events.tsx): lila kártya,
 * bal oldalt a dátum-doboz (hónap fölött, nap alatta), mellette a cím, helyszín, típus és
 * a címke-pirulák, prémiumnál lila szalag a sarokban.
 * Szefi kérése (2026-08-24), ugyanaz, amit a Receptek fül kapott: szerkesztés közben azt
 * lássa, amit a felhasználó is látni fog.
 */
function esemenyKartya(e) {
  const premium = e.isPremium === true;
  const cimkek = Array.isArray(e.tags) ? e.tags : [];
  return `
    <article class="esemeny-kartya${premium ? ' premium' : ''}" data-esemeny-id="${esc(e.id)}">
      ${premium ? '<span class="esemeny-szalag">Prémium</span>' : ''}
      <div class="esemeny-fej">
        <div class="esemeny-datum">
          <span class="honap">${esc(honapJel(e.date) || '--')}</span>
          <span class="nap">${esc(napJel(e.date))}</span>
        </div>
        <div class="esemeny-fo">
          <h3>${esc(e.title || '(névtelen)')}</h3>
          <div class="esemeny-sor">
            <span>📍 ${esc(e.location || 'nincs helyszín')}</span>
            ${e.type ? `<span>· ${esc(e.type)}</span>` : ''}
          </div>
          <div class="esemeny-sor halvany">
            👥 ${Number(e.attendees) || 0} jelentkező${e.maxAttendees ? ` / max ${esc(e.maxAttendees)}` : ''}
            ${e.hasMedal ? ' · 🏅 érmes' : ''}
            ${e.published === false ? ' · <span class="piszkozat-jel">piszkozat</span>' : ''}
          </div>
          ${cimkek.length ? `<div class="esemeny-cimkek">${cimkek.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="esemeny-gombok">
        <button class="masodlagos kicsi" data-esemeny-szerk="${esc(e.id)}">Szerkesztés</button>
        <button class="veszelyes kicsi" data-esemeny-torol="${esc(e.id)}" data-nev="${esc(e.title || '')}">Törlés</button>
      </div>
    </article>`;
}

/* ------------------------------ szerkesztő-nézet ------------------------------ */

function szerkesztoHtml() {
  const { id, adat } = szerkesztettEsemeny;
  const ujE = !id;
  return `
    <div class="figyelmeztetes">
      ${ujE ? 'Új' : 'Meglévő'} esemény szerkesztése.
      A mentés a szerveren keresztül megy, és nyomot hagy, hogy ki módosította.
    </div>
    <!-- 100%, nem 96vw: a 96vw a konténer-padding mellett 390px-es telefonon túlcsordul -->
    <form id="esemeny-urlap" class="belepes" style="width:min(760px,100%)">
      <label class="mezo"><span>Esemény neve</span>
        <input type="text" id="ese-cim" value="${esc(adat.title || '')}" required /></label>

      <div class="gyak-racs">
        <label><span>Dátum</span>
          <input type="date" id="ese-datum" value="${esc(adat.date || '')}" required /></label>
        <label><span>Időpont (nem kötelező)</span>
          <input type="time" id="ese-ido" value="${esc(adat.time || '')}" /></label>
        <label><span>Helyszín</span>
          <input type="text" id="ese-helyszin" placeholder="pl. Budapest" value="${esc(adat.location || '')}" /></label>
      </div>

      <div class="gyak-racs">
        <label><span>Típus</span>
          <input type="text" id="ese-tipus" placeholder="pl. Szkander, Fitness" value="${esc(adat.type || '')}" /></label>
        <label><span>Max létszám (nem kötelező)</span>
          <input type="number" min="0" id="ese-max" value="${esc(adat.maxAttendees ?? '')}" /></label>
        <label><span>Jelentkezők száma</span>
          <input type="number" min="0" id="ese-jelentkezok" value="${esc(adat.attendees ?? 0)}" /></label>
      </div>

      <label class="mezo"><span>Leírás</span>
        <textarea id="ese-leiras" rows="5">${esc(adat.description || '')}</textarea></label>

      ${kepMezo('ese-kep', adat.image, 'Borítókép')}

      <label class="mezo"><span>Címkék (vesszővel elválasztva)</span>
        <input type="text" id="ese-cimkek" placeholder="pl. Kupa, Nemzeti" value="${esc(Array.isArray(adat.tags) ? adat.tags.join(', ') : '')}" /></label>

      <div class="gyak-racs">
        <label class="pipa"><input type="checkbox" id="ese-kint" ${adat.published === false ? '' : 'checked'} />
          <span>Kint van az appban</span></label>
        <label class="pipa"><input type="checkbox" id="ese-premium" ${adat.isPremium === true ? 'checked' : ''} />
          <span>Prémium (csak előfizetőknek)</span></label>
        <label class="pipa"><input type="checkbox" id="ese-erem" ${adat.hasMedal === true ? 'checked' : ''} />
          <span>Éremszerző (érem jár érte)</span></label>
      </div>

      <div class="muveletek">
        <button type="submit" id="ese-ment">Mentés</button>
        <button type="button" class="masodlagos" id="ese-megse">Mégse</button>
        ${ujE ? '' : `<button type="button" class="veszelyes" id="ese-torol">Törlés</button>`}
      </div>
      <p class="hiba" id="ese-hiba" hidden></p>
    </form>`;
}

/** Az űrlapból állítja össze a mentendő eseményt. A NEM ismert mezőket megtartja
 *  (az eredeti adatra épít), hogy egy jövőbeli mezőt ez a felület ne töröljön le. */
function esemenyOsszeallit() {
  const eredeti = szerkesztettEsemeny.adat || {};
  const m = (id) => document.getElementById(id).value.trim();
  const datum = m('ese-datum');

  const ki = {
    ...eredeti,
    title: m('ese-cim'),
    date: datum,
    month: honapJel(datum),
    day: napJel(datum),
    location: m('ese-helyszin'),
    type: m('ese-tipus'),
    attendees: Number(m('ese-jelentkezok')) || 0,
    tags: m('ese-cimkek').split(',').map((c) => c.trim()).filter(Boolean),
    published: document.getElementById('ese-kint').checked,
    isPremium: document.getElementById('ese-premium').checked,
    hasMedal: document.getElementById('ese-erem').checked,
  };
  const leiras = m('ese-leiras');
  if (leiras) ki.description = leiras; else delete ki.description;
  const ido = m('ese-ido');
  if (ido) ki.time = ido; else delete ki.time;
  const max = m('ese-max');
  if (max !== '') ki.maxAttendees = Number(max); else delete ki.maxAttendees;
  const kep = m('ese-kep');
  if (kep) ki.image = kep; else delete ki.image;
  return ki;
}

/* ------------------------------ exportok ------------------------------ */

export async function esemenyekNezet({ db }) {
  if (szerkesztettEsemeny) return szerkesztoHtml();

  /* Szándékosan NEM orderBy('date'): az kihagyná azokat a dokumentumokat, amikben
     nincs date mező, és az adminban "eltűnne" a hibás tétel, pont amit javítani kéne. */
  const snap = await getDocs(query(collection(db, 'events'), limit(100)));
  const tetelek = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));

  const fejlec = `<div class="muveletek" style="margin-bottom:14px">
    <button data-esemeny-uj>Új esemény</button></div>`;
  if (!tetelek.length) {
    return fejlec + `<p class="ures">Ez a gyűjtemény üres. Az app ilyenkor a beépített tartaléklistát használja.</p>`;
  }
  return fejlec + `<div class="esemeny-racs">${tetelek.map(esemenyKartya).join('')}</div>`;
}

export function esemenyekEsemenyek(cel, { db, fuggvenyek, ujraRajzol }) {
  /* ---------- szerkesztő nyitva ---------- */
  if (szerkesztettEsemeny) {
    kepFeltoltesEsemenyek(cel);
    const hiba = (uzenet) => {
      const el = document.getElementById('ese-hiba');
      el.hidden = !uzenet; el.textContent = uzenet || '';
    };

    document.getElementById('ese-megse').addEventListener('click', () => {
      szerkesztettEsemeny = null; ujraRajzol();
    });

    const torolGomb = document.getElementById('ese-torol');
    if (torolGomb) torolGomb.addEventListener('click', async () => {
      if (!confirm('Biztosan törlöd? Ez nem vonható vissza.')) return;
      torolGomb.disabled = true;
      try {
        await httpsCallable(fuggvenyek, 'manageContent')({
          collection: 'events', action: 'delete', id: szerkesztettEsemeny.id,
        });
        szerkesztettEsemeny = null; await ujraRajzol();
      } catch (err) {
        torolGomb.disabled = false;
        hiba(olvashatoHiba(err));
      }
    });

    document.getElementById('esemeny-urlap').addEventListener('submit', async (e) => {
      e.preventDefault();
      const gomb = document.getElementById('ese-ment');
      hiba('');
      const adat = esemenyOsszeallit();
      if (!adat.title) { hiba('Az esemény neve nem maradhat üresen.'); return; }
      if (!adat.date) { hiba('A dátum kötelező.'); return; }
      if (adat.maxAttendees !== undefined && adat.attendees > adat.maxAttendees) {
        hiba('A jelentkezők száma nem lehet több, mint a max létszám.'); return;
      }
      gomb.disabled = true; gomb.textContent = 'Mentés...';
      try {
        await httpsCallable(fuggvenyek, 'manageContent')({
          collection: 'events',
          action: 'upsert',
          id: szerkesztettEsemeny.id,
          data: adat,
        });
        szerkesztettEsemeny = null; await ujraRajzol();
      } catch (err) {
        gomb.disabled = false; gomb.textContent = 'Mentés';
        hiba(olvashatoHiba(err));
      }
    });
    return;
  }

  /* ---------- lista ---------- */
  const ujGomb = cel.querySelector('[data-esemeny-uj]');
  if (ujGomb) ujGomb.addEventListener('click', () => {
    szerkesztettEsemeny = { id: undefined, adat: {} };
    ujraRajzol();
  });

  cel.querySelectorAll('[data-esemeny-szerk]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      /* A friss adatot a listából már ismerjük, de újraolvassuk, hogy két admin
         párhuzamos munkájánál ne egy elavult példányt szerkesszünk tovább. */
      const snap = await getDocs(query(collection(db, 'events'), limit(100)));
      const talalt = snap.docs.find((d) => d.id === b.dataset.esemenySzerk);
      szerkesztettEsemeny = { id: b.dataset.esemenySzerk, adat: talalt ? talalt.data() : {} };
      ujraRajzol();
    } catch (err) {
      b.disabled = false;
      alert(olvashatoHiba(err));
    }
  }));

  cel.querySelectorAll('[data-esemeny-torol]').forEach((b) => b.addEventListener('click', async () => {
    const nev = b.dataset.nev || 'ezt az eseményt';
    if (prompt(`A törléshez írd be az esemény nevét: "${nev}"`) !== nev) return;
    b.disabled = true;
    try {
      await httpsCallable(fuggvenyek, 'manageContent')({
        collection: 'events', action: 'delete', id: b.dataset.esemenyTorol,
      });
      await ujraRajzol();
    } catch (err) {
      b.disabled = false;
      alert(olvashatoHiba(err));
    }
  }));
}
