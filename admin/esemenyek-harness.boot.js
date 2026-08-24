/**
 * CSAK TESZTHEZ: az esemenyek.js modult pont ugy hajtja, ahogy majd az admin.js fogja
 * (nezet-html + esemenykotes + ujraRajzol), de stub Firebase-szel.
 */
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { esemenyekNezet, esemenyekEsemenyek } from './esemenyek.js';

const db = getFirestore();
const fuggvenyek = getFunctions();
const cel = document.getElementById('tartalom');

async function ujraRajzol() {
  cel.innerHTML = await esemenyekNezet({ db });
  esemenyekEsemenyek(cel, { db, fuggvenyek, ujraRajzol });
  window.__kirajzolva = (window.__kirajzolva || 0) + 1;
}

await ujraRajzol();
