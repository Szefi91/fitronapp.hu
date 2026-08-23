/**
 * Ajánlói link elkapása a landing oldalon.
 *
 * MIÉRT: eddig CSAK kód volt (FIT123456), amit a meghívottnak KÉZZEL kellett begépelnie a
 * regisztrációnál. Minden begépelésnél emberek esnek ki. Mostantól a linkből magától átjön.
 *
 * Kétféle alak működik, mert a partner mindkettőt kaphatja:
 *   https://fitronapp.hu/?ref=FIT123456
 *   https://fitronapp.hu/r/FIT123456
 *
 * A kódot itt CSAK eltároljuk. Az app (Fitron) olvassa ki és tölti elő vele az onboardingot;
 * a párja ott a lib/referral.js captureRefCode/getStoredRefCode.
 */
(function () {
  var KULCS = 'fitron_ref';

  function kodBeolvasas() {
    try {
      var u = new URL(window.location.href);
      var q = u.searchParams.get('ref');
      if (q) return q;
      // /r/KOD alak
      var m = u.pathname.match(/^\/r\/([^/?#]+)/i);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  /** Csak az valodi kod, ami a FIT-elotaggal kezdodik. A szemetet eldobjuk. */
  function tisztit(kod) {
    if (!kod) return null;
    var k = String(kod).trim().toUpperCase();
    return /^FIT[A-Z0-9]{4,12}$/.test(k) ? k : null;
  }

  var kod = tisztit(kodBeolvasas());
  if (!kod) return;

  try {
    localStorage.setItem(KULCS, kod);
  } catch (e) {
    // Privat ablak vagy letiltott tarolas: nem baj, csak nem tudjuk atadni.
  }

  // A letoltes-gombokra ratesszuk a kodot, hogy az aruhazbol visszaterve is megmaradjon,
  // ha a link tamogatja. (Ma csak jelzes, a boltok kulon kezelik.)
  document.addEventListener('DOMContentLoaded', function () {
    var jelzo = document.querySelector('[data-ref-jelzo]');
    if (jelzo) jelzo.textContent = kod;
  });
})();
