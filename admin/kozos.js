/**
 * Közös segédek az admin felület összes füléhez.
 *
 * MIERT KULON FAJL: az admin.js 1500 sorra nott, es Szefi kerte (2026-08-24), hogy tobb agent
 * dolgozzon parhuzamosan kulon fuleken. Egy fajlban ez azt jelentene, hogy egymas munkajat irjuk
 * felul. A fulek MOSTANTOL kulon modulban vannak, es ezt a kozos reszt importaljak.
 *
 * A modulok NEM osztjak meg az allapotot globalis valtozokon: a fo modul adja at nekik
 * (db, fuggvenyek, profil) parameterkent. Igy egy modul sem tud csendben elrontani egy masikat.
 */
import { getStorage, ref as tarolóRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** A Firebase hibakodjabol emberi mondat. Ne a nyers kodot lassa, aki dolgozik vele. */
export function olvashatoHiba(err) {
  const kod = (err && (err.code || err.message)) || '';
  if (/permission-denied|insufficient/i.test(kod)) return 'Ehhez nincs jogosultságod.';
  if (/unauthenticated/i.test(kod)) return 'Lejárt a bejelentkezésed, lépj be újra.';
  if (/not-found/i.test(kod)) return 'Nem találom ezt a tételt, lehet hogy közben törölték.';
  if (/already-exists/i.test(kod)) return 'Ez már létezik.';
  if (/unavailable|network/i.test(kod)) return 'Nincs kapcsolat a szerverrel, próbáld újra.';
  return String((err && err.message) || err || 'Ismeretlen hiba.');
}

/* ---------------------- kép-mező feltöltéssel ----------------------
 * Szefi kerese (2026-08-24): "mindegyiknel ahol kepet lehet betenni, ne csak link legyen,
 * hanem feltoltesi lehetoseg is". A link megmarad, mellette a Feltoltes gomb.
 * -------------------------------------------------------------------------- */
export function kepMezo(id, ertek, cimke = 'Borítókép') {
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

export function kepFeltoltesEsemenyek(gyoker = document) {
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
