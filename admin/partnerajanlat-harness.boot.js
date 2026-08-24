/**
 * CSAK TESZTHEZ: a partnerajanlat.js modult pont úgy hajtja, ahogy az admin.js
 * (nézet-html + eseménykötés + ujraRajzol), de stub Firebase-szel.
 */
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { partnerAjanlatNezet, partnerAjanlatEsemenyek } from './partnerajanlat.js';

const db = getFirestore();
const fuggvenyek = getFunctions();
const cel = document.getElementById('tartalom');

async function ujraRajzol() {
  cel.innerHTML = await partnerAjanlatNezet({ db });
  partnerAjanlatEsemenyek(cel, { db, fuggvenyek, ujraRajzol });
  window.__kirajzolva = (window.__kirajzolva || 0) + 1;
}

await ujraRajzol();
