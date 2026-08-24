/**
 * Futtatas: node --test admin/partner-utils.test.mjs
 * Miert: a jutalek-kulcs PENZ. Egy csendes NaN vagy egy elgepelt azonosito olyan partner-docot
 * szulne, ami senkihez nem tartozik -- es ez csak a kifizetesnel derulne ki.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizalAzonosito, ertelmezKulcs, osszeallitPartner, kulcsSzoveg } from './partner-utils.js';

test('kod: kisbetus es szokozos alakot is elfogad, nagybetusen adja vissza', () => {
  assert.deepEqual(normalizalAzonosito(' fitab12cd '), { tipus: 'kod', ertek: 'FITAB12CD' });
  assert.deepEqual(normalizalAzonosito('FIT123456'), { tipus: 'kod', ertek: 'FIT123456' });
});

test('uid: valodi hosszusagu Firebase azonositot uid-nek ismer fel', () => {
  const uid = 'aB3xY9kLmN2pQr7sT4uV6wZ0';
  assert.deepEqual(normalizalAzonosito(uid), { tipus: 'uid', ertek: uid });
});

test('azonosito: ures es szemet ertek elkulonitve', () => {
  assert.equal(normalizalAzonosito('   ').tipus, 'ures');
  assert.equal(normalizalAzonosito('FIT12').tipus, 'ervenytelen');       // tul rovid kod
  assert.equal(normalizalAzonosito('users/abc').tipus, 'ervenytelen');   // utvonal-tores
  assert.equal(normalizalAzonosito('kiss.jozsef@pelda.hu').tipus, 'ervenytelen');
});

test('kulcs: szam, tizedesvesszo es szazalekjel is mehet', () => {
  assert.deepEqual(ertelmezKulcs('20'), { ok: true, ertek: 20 });
  assert.deepEqual(ertelmezKulcs('12,5'), { ok: true, ertek: 12.5 });
  assert.deepEqual(ertelmezKulcs(' 30% '), { ok: true, ertek: 30 });
  assert.deepEqual(ertelmezKulcs('12,555'), { ok: true, ertek: 12.56 });
  assert.deepEqual(ertelmezKulcs(0), { ok: true, ertek: 0 });
});

test('kulcs: a hibas ertekek NEM csusznak at', () => {
  assert.equal(ertelmezKulcs('').ok, false);
  assert.equal(ertelmezKulcs('husz').ok, false);
  assert.equal(ertelmezKulcs('-5').ok, false);
  assert.equal(ertelmezKulcs('120').ok, false);
});

test('osszeallitas: ervenyes bemenetbol mentheto dokumentum lesz', () => {
  const r = osszeallitPartner({ azonosito: 'fit123456', kulcs: '20', aktiv: true, nev: ' Kiss Jozsef ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.azonosito, { tipus: 'kod', ertek: 'FIT123456' });
  assert.deepEqual(r.adat, { commissionRate: 20, active: true, displayName: 'Kiss Jozsef' });
});

test('osszeallitas: ures nev eseten NINCS displayName mezo (ne irjunk ures stringet a docba)', () => {
  const r = osszeallitPartner({ azonosito: 'FIT123456', kulcs: '10', aktiv: false, nev: '   ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.adat, { commissionRate: 10, active: false });
});

test('osszeallitas: hibas azonosito/kulcs eseten hibauzenet jon, nem dobas', () => {
  assert.equal(osszeallitPartner({ azonosito: '', kulcs: '20' }).ok, false);
  assert.equal(osszeallitPartner({ azonosito: 'abc', kulcs: '20' }).ok, false);
  assert.equal(osszeallitPartner({ azonosito: 'FIT123456', kulcs: 'sok' }).ok, false);
});

test('megjelenites: hianyzo kulcsbol nem talalunk ki nullat', () => {
  assert.equal(kulcsSzoveg(20), '20%');
  assert.equal(kulcsSzoveg(12.5), '12.5%');
  assert.equal(kulcsSzoveg(undefined), 'nincs beállítva');
  assert.equal(kulcsSzoveg(NaN), 'nincs beállítva');
});
