/**
 * Futtatas: node --test admin/jelentesek.test.mjs
 * Miert: a moderalas dontesek alapja. Ha a szures/osszevonas csendben rossz, a moderator vagy
 * eltunt jelenteseket lat (nem intezkedik), vagy ugyanazt a posztot otszor kapja kulon sorban.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  statuszCimke, normalStatusz, lezartE, rovidId, reporterMezo, posztMezo, celTipus, celKulcs,
  celFelirat, idoSzoveg, szurStatusz, csoportosit, reporterNev,
} from './jelentesek.js';

test('statuszCimke: ismert statuszok + a hianyzo/ismeretlen nyitottnak szamit', () => {
  assert.deepEqual(statuszCimke('open'), ['nyitott', 'Nyitott']);
  assert.deepEqual(statuszCimke('reviewed'), ['atnezve', 'Átnézve']);
  assert.deepEqual(statuszCimke('actioned'), ['intezkedve', 'Intézkedve']);
  assert.deepEqual(statuszCimke(undefined), ['nyitott', 'Nyitott']);
  assert.deepEqual(statuszCimke('szemet'), ['nyitott', 'Nyitott']);
});

test('normalStatusz: a regi, status nelkuli jelentes open', () => {
  assert.equal(normalStatusz(undefined), 'open');
  assert.equal(normalStatusz('reviewed'), 'reviewed');
  assert.equal(normalStatusz('barmi'), 'open');
});

test('reporterMezo: tobb lehetseges mezonevre defenziv', () => {
  assert.equal(reporterMezo({ reporterId: 'a' }), 'a');
  assert.equal(reporterMezo({ reporterUid: 'b' }), 'b');
  assert.equal(reporterMezo({ uid: 'c' }), 'c');
  assert.equal(reporterMezo({}), null);
});

test('celTipus / celKulcs: user es comment kulon, minden mas poszt', () => {
  assert.equal(celTipus({ targetType: 'user' }), 'user');
  assert.equal(celTipus({ targetType: 'comment' }), 'comment');
  assert.equal(celTipus({}), 'post');
  assert.equal(celTipus({ targetType: 'valami' }), 'post');
  assert.equal(celKulcs({ targetType: 'user', targetId: 'u1' }), 'user:u1');
  assert.equal(celKulcs({ targetId: 'p1' }), 'post:p1');
});

test('celFelirat: emberi nev', () => {
  assert.equal(celFelirat('user'), 'Felhasználó');
  assert.equal(celFelirat('comment'), 'Hozzászólás');
  assert.equal(celFelirat('post'), 'Poszt');
});

test('rovidId: hosszut rovidit, rovidet meghagy, ureset kezel', () => {
  assert.equal(rovidId('aB3xY9kLmN2pQr7sT4uV6wZ0'), 'aB3xY9…');
  assert.equal(rovidId('rovid'), 'rovid');
  assert.equal(rovidId(''), 'ismeretlen');
  assert.equal(rovidId(null), 'ismeretlen');
});

test('idoSzoveg: Firestore Timestamp, ISO string, es ures', () => {
  assert.match(idoSzoveg({ seconds: 1_700_000_000 }), /\d/);          // ad valami datumot
  assert.equal(idoSzoveg('2026-08-24T01:23:45Z'), '2026-08-24 01:23');
  assert.equal(idoSzoveg(undefined), '');
  assert.equal(idoSzoveg(null), '');
});

test('lezartE: atnezve VAGY intezkedve lezart, a nyitott/hianyzo nem', () => {
  assert.equal(lezartE('reviewed'), true);
  assert.equal(lezartE('actioned'), true);
  assert.equal(lezartE('open'), false);
  assert.equal(lezartE(undefined), false);
});

test('szurStatusz: KET allapot -- open (a status nelkulivel) es lezart (reviewed+actioned)', () => {
  const reports = [
    { id: '1', status: 'open' },
    { id: '2' },                       // nincs status -> open
    { id: '3', status: 'reviewed' },
    { id: '4', status: 'actioned' },
  ];
  assert.deepEqual(szurStatusz(reports, 'open').map((r) => r.id), ['1', '2']);
  assert.deepEqual(szurStatusz(reports, 'lezart').map((r) => r.id), ['3', '4']);
});

test('csoportosit: azonos celra erkezo jelentesek EGY kartyaba, tobb-jelentes elore', () => {
  const reports = [
    { id: 'r1', targetId: 'pA', reporterId: 'u1', reason: 'spam' },
    { id: 'r2', targetId: 'pB', targetType: 'user', reporterId: 'u2' },
    { id: 'r3', targetId: 'pA', reporterId: 'u3', reason: 'gyulolet' },   // pA masodszor
    { id: 'r4', targetId: 'pA', reporterId: 'u4' },                        // pA harmadszor
  ];
  const cs = csoportosit(reports);
  assert.equal(cs.length, 2);                       // pA (poszt) + pB (user)
  assert.equal(cs[0].kulcs, 'post:pA');             // 3 jelentes -> elore
  assert.equal(cs[0].szam, 3);
  assert.deepEqual(cs[0].jelentesIdk, ['r1', 'r3', 'r4']);
  assert.equal(cs[1].kulcs, 'user:pB');
  assert.equal(cs[1].szam, 1);
});

test('csoportosit: komment-jelentes megorzi a postId-t barmelyik jelentesbol', () => {
  const reports = [
    { id: 'c1', targetType: 'comment', targetId: 'k1' },                  // ezen nincs postId
    { id: 'c2', targetType: 'comment', targetId: 'k1', postId: 'pX' },    // ezen van
  ];
  const cs = csoportosit(reports);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].tipus, 'comment');
  assert.equal(cs[0].postId, 'pX');
  assert.equal(cs[0].szam, 2);
});

test('reporterNev: feloldott nev, kulonben rovid uid, ures uid ismeretlen', () => {
  const nevMap = new Map([['u1', 'Kiss József']]);
  assert.equal(reporterNev('u1', nevMap), 'Kiss József');
  assert.equal(reporterNev('aB3xY9kLmN2pQr7sT4uV6wZ0', nevMap), 'aB3xY9…');
  assert.equal(reporterNev(null, nevMap), 'ismeretlen');
});
