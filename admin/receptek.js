/**
 * FITRON admin -- RECEPTEK fül (mezős szerkesztő + kártyás lista).
 *
 * MIÉRT KÉSZÜLT (2026-08-24): a Receptek fül eddig a GENERIKUS szerkesztőt kapta, aminek az
 * egyetlen érdemi mezője egy nyers JSON-textarea volt. Azon Szefi nem tud receptet felvinni:
 * egy elgépelt kapcsos zárójel csendben elrontja az egész dokumentumot.
 *
 * SÉMA (a forrás az app: FitronBuild/lib/recipes.ts docToRecipe + types.ts Recipe):
 *   title, kcal, protein, carbs, fat, prepTime, category, image, description,
 *   ingredients (string[]), instructions (string[])
 *
 * KÉT ZÁSZLÓ UGYANARRA -- vigyázni kell rá:
 *   A lekérdezés (`getRecipes`) az `isPremium`-ot szűri (az van indexelve), az app viszont az
 *   `isFree`-t nézi a záráshoz (Kitchen.tsx, RecipeDetail.tsx). Ha csak az egyik kerül a
 *   dokumentumba, a recept vagy láthatatlan lesz az ingyeneseknek, vagy tévesen zárva marad.
 *   Ezért ez a felület MINDKETTŐT írja, egymás ellentéteként. Egy pipa van a képernyőn.
 *
 * PISZKOZAT: a `published` mező hiánya KINT VAN-t jelent (mint a terveknél/eseményeknél), hogy a
 * régi receptek ne tűnjenek el. A pipa kivétele ír `published: false`-t.
 *
 * A felület által nem ismert mezőket a mentés megtartja (az eredeti adatra épít), a manageContent
 * pedig merge-gel ír. Közvetlen Firestore-írás NINCS: minden a Cloud Functionön megy, hogy
 * nyoma legyen, ki módosította.
 */
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref as tarolóRef, uploadBytes, getDownloadURL } from 'firebase/storage';

/* ------------------------------ segédek ------------------------------ */

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

/* Soronkénti lista <-> tömb. Az üres sorokat kiszűrjük, hogy egy véletlen Enter ne
   csináljon üres hozzávalót a receptbe. */
export function sorokbolTomb(szoveg) {
  return String(szoveg || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tombbolSorok(tomb) {
  return Array.isArray(tomb) ? tomb.join('\n') : '';
}

/* A kategória az appban angol kulcs (`main` az alapértelmezett a docToRecipe-ban), a felületen
   viszont magyarul kell látszania, különben Szefi angol kulcsokat gépel be találomra. */
const KATEGORIAK = [
  ['breakfast', 'Reggeli'],
  ['main', 'Főétel'],
  ['snack', 'Snack'],
  ['dessert', 'Desszert'],
  ['drink', 'Ital'],
];

function kategoriaNev(kulcs) {
  const t = KATEGORIAK.find(([k]) => k === kulcs);
  return t ? t[1] : (kulcs || 'Főétel');
}

/* ------------------------------ állapot ------------------------------ */

let szerkesztettRecept = null;   // { id?, adat }

/* ------------------------------ lista ------------------------------ */

/**
 * A kártya SZÁNDÉKOSAN az app Konyha-oldalának receptkártyáját követi (Kitchen.tsx):
 * kép felül, rajta a kalória-jelvény, alatta dőlt nagybetűs cím és az elkészítési idő.
 * Szefi kérése (2026-08-24): "ott is dizájnban hasonló legyen mint ami az applikáció".
 * Így szerkesztés közben azt látja, amit a felhasználó is látni fog.
 */
function receptKartya(r) {
  const premium = r.isPremium === true;
  const hozzavalok = Array.isArray(r.ingredients) ? r.ingredients.length : 0;
  const makro = `F ${Number(r.protein) || 0} · Sz ${Number(r.carbs) || 0} · Zs ${Number(r.fat) || 0}`;
  return `
    <article class="recept-kartya${premium ? ' premium' : ''}" data-recept-id="${esc(r.id)}">
      <div class="recept-kep" ${r.image ? `style="background-image:url('${esc(r.image)}')"` : ''}>
        <span class="recept-kcal">${Number(r.kcal) || 0} kcal</span>
        ${premium ? '<span class="recept-zar">🔒 Prémium</span>' : ''}
        ${r.published === false ? '<span class="recept-piszkozat">Piszkozat</span>' : ''}
      </div>
      <div class="recept-fo">
        <h3>${esc(r.title || '(névtelen)')}</h3>
        <div class="recept-also">
          <span class="recept-ido">${esc(r.prepTime || kategoriaNev(r.category))}</span>
          <span class="recept-makro">${esc(makro)}</span>
        </div>
        <div class="recept-meta">${esc(kategoriaNev(r.category))} · ${hozzavalok} hozzávaló</div>
        <div class="recept-gombok">
          <button class="masodlagos kicsi" data-recept-szerk="${esc(r.id)}">Szerkesztés</button>
          <button class="veszelyes kicsi" data-recept-torol="${esc(r.id)}" data-recept-nev="${esc(r.title || '')}">Törlés</button>
        </div>
      </div>
    </article>`;
}

/* ------------------------------ szerkesztő ------------------------------ */

function szerkesztoHtml() {
  const adat = szerkesztettRecept.adat || {};
  const ujE = !szerkesztettRecept.id;
  return `
    <div class="figyelmeztetes">
      ${ujE ? 'Új recept felvétele.' : 'Meglévő recept szerkesztése.'}
      A mentés a szerveren keresztül megy, és nyomot hagy, hogy ki módosította.
    </div>
    <form id="recept-urlap" class="belepes" style="width:min(760px,100%)">
      <label class="mezo"><span>Recept neve</span>
        <input type="text" id="rec-cim" value="${esc(adat.title || '')}" required /></label>

      <div class="gyak-racs">
        <label class="mezo"><span>Kategória</span>
          <select id="rec-kategoria">
            ${KATEGORIAK.map(([k, n]) => `<option value="${k}" ${(adat.category || 'main') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}
          </select></label>
        <label class="mezo"><span>Elkészítési idő</span>
          <input type="text" id="rec-ido" placeholder="pl. 20 perc" value="${esc(adat.prepTime || '')}" /></label>
        <label class="mezo"><span>Kalória (kcal)</span>
          <input type="number" id="rec-kcal" min="0" value="${esc(adat.kcal ?? '')}" /></label>
      </div>

      <div class="gyak-racs">
        <label class="mezo"><span>Fehérje (g)</span>
          <input type="number" id="rec-feherje" min="0" value="${esc(adat.protein ?? '')}" /></label>
        <label class="mezo"><span>Szénhidrát (g)</span>
          <input type="number" id="rec-szenhidrat" min="0" value="${esc(adat.carbs ?? '')}" /></label>
        <label class="mezo"><span>Zsír (g)</span>
          <input type="number" id="rec-zsir" min="0" value="${esc(adat.fat ?? '')}" /></label>
      </div>

      ${kepMezo('rec-kep', adat.image)}

      <label class="mezo"><span>Rövid leírás</span>
        <textarea id="rec-leiras" rows="3">${esc(adat.description || '')}</textarea></label>

      <label class="mezo"><span>Hozzávalók (soronként egy)</span>
        <textarea id="rec-hozzavalok" rows="6" placeholder="2 tojás&#10;100 g zabpehely">${esc(tombbolSorok(adat.ingredients))}</textarea></label>

      <label class="mezo"><span>Elkészítés (soronként egy lépés)</span>
        <textarea id="rec-lepesek" rows="6" placeholder="Melegítsd elő a sütőt.&#10;Keverd össze a hozzávalókat.">${esc(tombbolSorok(adat.instructions))}</textarea></label>

      <div class="gyak-racs">
        <label class="pipa"><input type="checkbox" id="rec-kint" ${adat.published === false ? '' : 'checked'} />
          <span>Kint van az appban</span></label>
        <label class="pipa"><input type="checkbox" id="rec-premium" ${adat.isPremium === true ? 'checked' : ''} />
          <span>Csak előfizetőknek</span></label>
      </div>

      <div class="muveletek">
        <button type="submit" id="rec-ment">Mentés</button>
        <button type="button" class="masodlagos" id="rec-megse">Mégse</button>
        ${ujE ? '' : '<button type="button" class="veszelyes" id="rec-torol">Törlés</button>'}
      </div>
      <p class="hiba" id="rec-hiba" hidden></p>
    </form>`;
}

/** Az űrlapból adat. Az EREDETI dokumentumra épít, hogy az ismeretlen mezők megmaradjanak. */
function receptOsszeallit() {
  const eredeti = szerkesztettRecept.adat || {};
  const szam = (id) => {
    const v = document.getElementById(id).value.trim();
    return v === '' ? 0 : Number(v);
  };
  const premium = document.getElementById('rec-premium').checked;
  return {
    ...eredeti,
    title: document.getElementById('rec-cim').value.trim(),
    category: document.getElementById('rec-kategoria').value,
    prepTime: document.getElementById('rec-ido').value.trim(),
    kcal: szam('rec-kcal'),
    protein: szam('rec-feherje'),
    carbs: szam('rec-szenhidrat'),
    fat: szam('rec-zsir'),
    image: document.getElementById('rec-kep').value.trim(),
    description: document.getElementById('rec-leiras').value.trim(),
    ingredients: sorokbolTomb(document.getElementById('rec-hozzavalok').value),
    instructions: sorokbolTomb(document.getElementById('rec-lepesek').value),
    // A KÉT ZÁSZLÓ EGYÜTT: a lekérdezés az isPremium-ot szűri, az app az isFree-t nézi.
    isPremium: premium,
    isFree: !premium,
    published: document.getElementById('rec-kint').checked ? true : false,
  };
}

/* ------------------------------ export: nézet ------------------------------ */

export async function receptekNezet({ db }) {
  if (szerkesztettRecept) return szerkesztoHtml();

  const snap = await getDocs(query(collection(db, 'recipes'), limit(200)));
  const tetelek = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'hu'));

  const fejlec = `<div class="muveletek" style="margin-bottom:14px">
    <button data-recept-uj>Új recept</button></div>`;
  if (!tetelek.length) {
    return fejlec + `<p class="ures">Ez a gyűjtemény üres. Az app ilyenkor a beépített
      tartaléklistát mutatja, tehát a felhasználók addig is látnak recepteket.</p>`;
  }
  return fejlec + `<div class="recept-racs">${tetelek.map(receptKartya).join('')}</div>`;
}

/* ------------------------------ export: események ------------------------------ */

export function receptekEsemenyek(cel, { db, fuggvenyek, ujraRajzol }) {
  /* ---------- szerkesztő nyitva ---------- */
  if (szerkesztettRecept) {
    kepFeltoltesEsemenyek(cel);
    const hiba = (uzenet) => {
      const el = document.getElementById('rec-hiba');
      el.hidden = !uzenet; el.textContent = uzenet || '';
    };

    document.getElementById('rec-megse').addEventListener('click', () => {
      szerkesztettRecept = null; ujraRajzol();
    });

    const torolGomb = document.getElementById('rec-torol');
    if (torolGomb) torolGomb.addEventListener('click', async () => {
      if (!confirm('Biztosan törlöd ezt a receptet? Ez nem vonható vissza.')) return;
      torolGomb.disabled = true;
      try {
        await httpsCallable(fuggvenyek, 'manageContent')({
          collection: 'recipes', action: 'delete', id: szerkesztettRecept.id,
        });
        szerkesztettRecept = null; await ujraRajzol();
      } catch (err) {
        torolGomb.disabled = false;
        hiba(olvashatoHiba(err));
      }
    });

    document.getElementById('recept-urlap').addEventListener('submit', async (e) => {
      e.preventDefault();
      const gomb = document.getElementById('rec-ment');
      hiba('');
      const adat = receptOsszeallit();
      if (!adat.title) { hiba('A recept neve nem maradhat üresen.'); return; }
      if (!adat.ingredients.length) { hiba('Legalább egy hozzávaló kell.'); return; }
      if (!adat.instructions.length) { hiba('Legalább egy elkészítési lépés kell.'); return; }
      gomb.disabled = true; gomb.textContent = 'Mentés...';
      try {
        await httpsCallable(fuggvenyek, 'manageContent')({
          collection: 'recipes',
          action: 'upsert',
          id: szerkesztettRecept.id,
          data: adat,
        });
        szerkesztettRecept = null; await ujraRajzol();
      } catch (err) {
        gomb.disabled = false; gomb.textContent = 'Mentés';
        hiba(olvashatoHiba(err));
      }
    });
    return;
  }

  /* ---------- lista ---------- */
  const ujGomb = cel.querySelector('[data-recept-uj]');
  if (ujGomb) ujGomb.addEventListener('click', () => {
    szerkesztettRecept = { id: undefined, adat: {} };
    ujraRajzol();
  });

  cel.querySelectorAll('[data-recept-szerk]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      const snap = await getDocs(query(collection(db, 'recipes'), limit(200)));
      const d = snap.docs.find((x) => x.id === b.dataset.receptSzerk);
      if (!d) { b.disabled = false; alert('Nem találom ezt a receptet, frissítsd az oldalt.'); return; }
      szerkesztettRecept = { id: d.id, adat: d.data() };
      ujraRajzol();
    } catch (err) {
      b.disabled = false;
      alert(olvashatoHiba(err));
    }
  }));

  // Törlés a listáról: névre kérdez rá, mert egy elgépelt kattintás visszavonhatatlan.
  cel.querySelectorAll('[data-recept-torol]').forEach((b) => b.addEventListener('click', async () => {
    const nev = b.dataset.receptNev || 'ez a recept';
    if (!confirm(`Biztosan törlöd? "${nev}"\n\nEz nem vonható vissza.`)) return;
    b.disabled = true; b.textContent = 'Törlés...';
    try {
      await httpsCallable(fuggvenyek, 'manageContent')({
        collection: 'recipes', action: 'delete', id: b.dataset.receptTorol,
      });
      await ujraRajzol();
    } catch (err) {
      b.disabled = false; b.textContent = 'Törlés';
      alert(olvashatoHiba(err));
    }
  }));
}
