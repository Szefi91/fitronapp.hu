document.getElementById('year').textContent = new Date().getFullYear();

const heroMain = document.getElementById('hero-main-screen');

// Vite build-safe: src-eket a DOM-ból olvassuk, így a hashed fájlnevek is működnek
const gallerySources = Array.from(document.querySelectorAll('.shot img'))
  .map((img) => img.getAttribute('src'))
  .filter(Boolean);

const screens = Array.from(new Set([
  heroMain?.getAttribute('src'),
  ...gallerySources
])).filter(Boolean);

let idx = 0;
let lock = false;

function swapScreen(next) {
  if (!heroMain || lock || !screens.length) return;
  lock = true;
  heroMain.classList.add('swap');
  setTimeout(() => {
    heroMain.src = screens[next];
    heroMain.classList.remove('swap');
    lock = false;
  }, 220);
}

window.addEventListener('scroll', () => {
  if (!screens.length) return;
  const max = document.body.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  const ratio = window.scrollY / max;
  const next = Math.min(screens.length - 1, Math.floor(ratio * screens.length));
  if (next !== idx) {
    idx = next;
    swapScreen(idx);
  }
});

setInterval(() => {
  if (!screens.length) return;
  idx = (idx + 1) % screens.length;
  swapScreen(idx);
}, 3800);


/* ---- Gorgetesre OLDALROL beuszas (Szefi kerese, 2026-08-21) ----
   A szekciok valtakozva balrol/jobbrol usznak be. Nincs kulso konyvtar,
   IntersectionObserver + CSS-atmenet. prefers-reduced-motion eseten kimarad. */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  var targets = [];
  document.querySelectorAll('.section, .week-step, .hero-copy .stats li, .qr-card').forEach(function (el) {
    if (el.closest('.hero')) return;          // a hero maga marad, ne ugraljon betoltesnel
    if (el.classList.contains('live')) return; // sticky szekcio, sajat gorgetes-vezerlest kap
    targets.push(el);
  });

  targets.forEach(function (el, i) {
    // A .week-step sajat mozgast kap a CSS-ben (a keszulek uszik be), ezert
    // annak CSAK az .in kell, kulonben ket animacio harcolna egymassal.
    if (el.classList.contains('week-step')) return;
    el.classList.add('reveal-x');
    if (i % 2 === 1) el.classList.add('reveal-x--right');
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(function (el) { io.observe(el); });

  // BIZTONSAGI HALO: ha a megfigyelo barmiert nem tuzel (gyors gorgetes, regi
  // bongeszo, kikapcsolt animacio-kezeles), a tartalom NE maradjon lathatatlan.
  // 2,5 masodperc utan minden meg rejtett elem megjelenik.
  setTimeout(function () {
    targets.forEach(function (el) { el.classList.add('in'); });
  }, 2500);
})();

/* ================= EFFEKTEK (Szefi: "mégtöbb effectet kérek", 2026-08-21) =================
   anime.js HELYBEN (vendor/anime.min.js, MIT). Minden hatás kihagyja magát, ha a
   felhasználó csökkentett mozgást kért, és anime hiányában sem törik el semmi. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  var A = window.anime;

  /* 1) HERO BELÉPŐ: a részek egymás után érkeznek, nem egyszerre villannak be. */
  if (A) {
    var seq = [
      '.hero-copy .pill',
      '.hero-copy h1',
      '.hero-copy .lead',
      '.hero-copy .proof li',
      '.hero-copy .cta-row',
      '.hero-copy .platform-line',
      '.qr-row',
      '.hero-copy .stats li'
    ];
    var els = [];
    seq.forEach(function (s) { document.querySelectorAll(s).forEach(function (e) { els.push(e); }); });
    // FONTOS: NEM nullazzuk elore az atlatszosagot. Az anime.js az
    // opacity:[0,1] kezdoerteket maga allitja be a futas pillanataban, tehat
    // ha az animacio barmiert NEM fut le, a tartalom LATHATO marad.
    // 2026-08-21: az elore-nullazas miatt a teljes hero eltunt a renderben.
    function feloldas() {
      els.forEach(function (e) { e.style.opacity = ''; e.style.transform = ''; });
      document.querySelectorAll('.hero-visual .device').forEach(function (d) {
        d.style.opacity = ''; 
      });
    }

    A({
      targets: els,
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 760,
      delay: A.stagger(85, { start: 120 }),
      easing: 'cubicBezier(.22,.61,.36,1)',
      complete: feloldas
    });

    // BIZTONSAGI HALO: hattérben levo fulon a requestAnimationFrame ALL, ezert
    // az anime megallhat az opacity:0 kezdoerteken, es a hero lathatatlan marad,
    // amig a felhasznalo vissza nem valt. A setTimeout viszont hattérben is fut,
    // igy 2,5 mp utan mindenkeppen feloldjuk. (Merve 2026-08-21: reload utan
    // 5 masodperccel a h1 es mindket telefon opacity-je 0 volt.)
    setTimeout(feloldas, 2500);
    A({
      targets: '.hero-visual .device',
      opacity: [0, 1],
      translateY: [34, 0],
      duration: 1000,
      delay: A.stagger(140, { start: 260 }),
      easing: 'cubicBezier(.22,.61,.36,1)'
    });
  }

  /* 2) EGÉR-KÖVETÉS: a hero telefonjai finoman a kurzor felé dőlnek. */
  var stack = document.querySelector('.hero-stack');
  if (stack && window.matchMedia('(pointer: fine)').matches) {
    var devs = stack.querySelectorAll('.device');
    stack.addEventListener('mousemove', function (ev) {
      var r = stack.getBoundingClientRect();
      var dx = (ev.clientX - r.left) / r.width - 0.5;
      var dy = (ev.clientY - r.top) / r.height - 0.5;
      devs.forEach(function (d, i) {
        var k = i === 0 ? 10 : 6;
        d.style.transition = 'transform .25s ease-out';
        d.style.transform = (d.dataset.base || '') +
          ' rotateY(' + (dx * k) + 'deg) rotateX(' + (-dy * k) + 'deg) translateZ(0)';
      });
    });
    stack.addEventListener('mouseleave', function () {
      devs.forEach(function (d) { d.style.transform = d.dataset.base || ''; });
    });
    devs.forEach(function (d) { d.dataset.base = getComputedStyle(d).transform === 'none' ? '' : ''; });
    stack.style.perspective = '1200px';
  }

  /* 3) PARALLAX: a háttér fényfoltjai lassabban mozognak, mint a tartalom. */
  var glows = document.querySelectorAll('.bg-glow, .lifestyle-glow');
  if (glows.length) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        glows.forEach(function (g, i) {
          g.style.transform = 'translate3d(0,' + (y * (i % 2 ? -0.05 : 0.07)) + 'px,0)';
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* 4) A "hét" lépéseinek címkéi felvillannak, amikor a lépés beúszik. */
  if (A && 'IntersectionObserver' in window) {
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var tag = e.target.querySelector('.week-tag');
        if (tag) A({ targets: tag, opacity: [0.35, 1], letterSpacing: ['.34em', '.18em'], duration: 700, easing: 'easeOutQuad' });
        io2.unobserve(e.target);
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('.week-step').forEach(function (s) { io2.observe(s); });
  }
})();


/* ===== A "hét" lépései DURVÁN oldalról csúsznak be (Szefi kérése, 2026-08-21):
   a szöveg az egyik, a telefon a másik oldalról érkezik, váltakozva. ===== */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var A = window.anime;
  if (!A || !('IntersectionObserver' in window)) return;

  var steps = [].slice.call(document.querySelectorAll('.week-step'));
  if (!steps.length) return;

  function feloldStep(step) {
    step.querySelectorAll('.week-txt, .week-device').forEach(function (e) {
      e.style.opacity = ''; e.style.transform = '';
    });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var step = e.target;
      io.unobserve(step);

      var flip = step.classList.contains('week-step--flip');
      var txt = step.querySelector('.week-txt');
      var dev = step.querySelector('.week-device');

      // A szoveg es a keszulek ELLENTETES oldalrol erkezik, jol lathato uttal.
      if (txt) A({
        targets: txt,
        translateX: [flip ? 140 : -140, 0],
        opacity: [0, 1],
        duration: 900,
        easing: 'cubicBezier(.16,.84,.34,1)'
      });
      if (dev) A({
        targets: dev,
        translateX: [flip ? -170 : 170, 0],
        rotate: [flip ? -12 : 12, flip ? 4 : -4],
        opacity: [0, 1],
        duration: 1000,
        delay: 90,
        easing: 'cubicBezier(.16,.84,.34,1)',
        complete: function () { feloldStep(step); }
      });

      // Ugyanaz a halo, mint a heronal: hattérben allo rAF eseten se ragadjon
      // benn a 0-s kezdoertek.
      setTimeout(function () { feloldStep(step); }, 2600);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });

  steps.forEach(function (s) { io.observe(s); });
})();


/* =========================================================================
   ELO TELEFON: a gorgetes vezerli a kepernyot (Szefi hangja, 2026-08-21)
   "gorgetesre eljen a telefon es a kepernyo, ne csak beusszon egy kep"
   Panelek: lepesszamlalo, szintlepes, makrok, terkep, kozosseg+receptek.

   ALAPELV (ma tanult szabaly): az ANIMACIO SOSEM REJTHETI EL A TARTALMAT.
   Minden panel VEGALLAPOTA benne van a HTML-ben es a CSS-ben (kesz szam, kesz
   gyuru-offset, kesz sav-szelesseg). Az anime.js csak ODAVISZ, nem o allitja
   elo. Ha az anime hianyzik, kivetelt dob, vagy hattérfulon megall a rAF, a
   latogato akkor is a HELYES vegallapotot latja.
   ========================================================================= */
(function () {
  var wrap = document.querySelector('.live-wrap');
  if (!wrap) return;

  var steps  = [].slice.call(document.querySelectorAll('.live-step'));
  var panels = [].slice.call(document.querySelectorAll('.lp'));
  if (!steps.length) return;   // a panelek kikerultek, a lepesek + a valodi kepernyok maradtak

  var A = window.anime;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var vids = [].slice.call(document.querySelectorAll('.live-vid'));

  /* --- A szamlalok VEGERTEKE a HTML-bol jon, es fallbackkent visszairjuk --- */
  function veg(el) { return el.dataset.finalText || (el.dataset.finalText = el.textContent); }
  function szamlal(el) {
    var cel = parseInt(el.getAttribute('data-to'), 10);
    var kesz = veg(el);
    if (!A || reduce || !isFinite(cel)) { el.textContent = kesz; return; }
    var o = { v: 0 };
    try {
      A({
        targets: o, v: cel, duration: 1100, easing: 'easeOutExpo', round: 1,
        update: function () { el.textContent = formaz(Math.round(o.v)); },
        complete: function () { el.textContent = kesz; }
      });
    } catch (e) { el.textContent = kesz; }
    // HALO: hattérfulon a rAF all, a setTimeout viszont fut.
    setTimeout(function () { el.textContent = kesz; }, 1800);
  }
  function formaz(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }

  /* --- Gyuru: a VEGSO offset a HTML-ben van, csak odaanimalunk --- */
  function gyuru(el) {
    var kesz = el.dataset.finalOffset || (el.dataset.finalOffset = el.getAttribute('stroke-dashoffset'));
    var teljes = el.getAttribute('stroke-dasharray');
    if (!A || reduce) { el.setAttribute('stroke-dashoffset', kesz); return; }
    try {
      A({ targets: el, strokeDashoffset: [teljes, kesz], duration: 1250, easing: 'easeOutCubic' });
    } catch (e) { el.setAttribute('stroke-dashoffset', kesz); }
    setTimeout(function () { el.setAttribute('stroke-dashoffset', kesz); }, 2000);
  }

  /* --- Savok (heti lepesek) es XP-sav: CSS adja a vegallapotot --- */
  function sav(el) {
    if (!A || reduce) return;
    var h = el.style.getPropertyValue('--h') || getComputedStyle(el).height;
    try { A({ targets: el, height: ['0%', h], duration: 700, easing: 'easeOutQuad' }); } catch (e) {}
    setTimeout(function () { el.style.height = ''; }, 1400);
  }
  function xp(el) {
    if (!A || reduce) return;
    var w = getComputedStyle(el).width;
    try { A({ targets: el, width: [0, w], duration: 1100, easing: 'easeOutExpo' }); } catch (e) {}
    setTimeout(function () { el.style.width = ''; }, 1800);
  }

  /* --- Szikrak a szintlepesnel: tisztan dekoracio, alapbol lathatatlan --- */
  function szikrak(box) {
    if (!A || reduce || !box) return;
    try {
      A({
        targets: box.querySelectorAll('i'),
        opacity: [{ value: 1, duration: 120 }, { value: 0, duration: 620 }],
        translateY: [10, -26],
        scale: [0.6, 1.15],
        delay: A.stagger(70),
        easing: 'easeOutQuad'
      });
    } catch (e) {}
  }

  var futott = {};
  function animalPanel(p) {
    var kulcs = p.getAttribute('data-panel');
    p.querySelectorAll('.num').forEach(szamlal);
    p.querySelectorAll('.rg-fg').forEach(gyuru);
    p.querySelectorAll('.lp-bars i').forEach(sav);
    p.querySelectorAll('.xp-fill').forEach(xp);
    if (kulcs === 'level') szikrak(p.querySelector('.sparks'));
    if (A && !reduce) {
      try {
        A({
          targets: p.querySelectorAll('.fcard, .mr, .map-card'),
          translateY: [14, 0], opacity: [0, 1],
          duration: 620, delay: A.stagger(90), easing: 'cubicBezier(.22,.61,.36,1)',
          complete: function () {
            p.querySelectorAll('.fcard, .mr, .map-card').forEach(function (e) {
              e.style.opacity = ''; e.style.transform = '';
            });
          }
        });
      } catch (e) {}
      setTimeout(function () {
        p.querySelectorAll('.fcard, .mr, .map-card').forEach(function (e) {
          e.style.opacity = ''; e.style.transform = '';
        });
      }, 2200);
    }
    futott[kulcs] = true;
  }

  var aktiv = null;
  function valt(kulcs) {
    if (kulcs === aktiv) return;
    aktiv = kulcs;

    steps.forEach(function (s) { s.classList.toggle('is-active', s.getAttribute('data-step') === kulcs); });

    panels.forEach(function (p) { p.classList.toggle('lp--on', p.getAttribute('data-panel') === kulcs); });

    var p = panels.filter(function (x) { return x.getAttribute('data-panel') === kulcs; })[0];
    if (p) animalPanel(p);

    // A keszuleken VALODI app-felvetel megy: csak az aktivat jatsszuk, a tobbi all.
    vids.forEach(function (v) {
      var akt = v.getAttribute('data-vid') === kulcs;
      v.classList.toggle('is-on', akt);
      if (akt) { try { v.currentTime = 0; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
      else { try { v.pause(); } catch (e) {} }
    });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      // A kepernyo kozepen levo lepes nyer.
      var legjobb = null;
      entries.forEach(function (e) { if (e.isIntersecting) legjobb = e.target; });
      if (legjobb) valt(legjobb.getAttribute('data-step'));
    }, { rootMargin: '-48% 0px -48% 0px', threshold: 0 });
    steps.forEach(function (s) { io.observe(s); });
  } else {
    // Regi bongeszo: gorgetes-alapu tartalek.
    window.addEventListener('scroll', function () {
      var kozep = window.innerHeight / 2, nyertes = null;
      steps.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.top <= kozep && r.bottom >= kozep) nyertes = s;
      });
      if (nyertes) valt(nyertes.getAttribute('data-step'));
    }, { passive: true });
  }

  // Az elso panel indulaskor is elje az eletet, ha mar a kepernyon van.
  var elso = document.querySelector('.lp[data-panel="steps"]');
  if (elso) {
    var io2 = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting && !futott.steps) { animalPanel(elso); io2.disconnect(); }
      });
    }, { threshold: 0.3 });
    io2.observe(document.querySelector('.live-device'));
  }
})();


/* ===== Az edzotermi fotora tett app-adat (WHOOP-tanulsag): a gyuru es a
   szamlalo akkor indul, amikor a kep a kepernyore er. Vegallapot a HTML-ben. ===== */
(function () {
  var media = document.querySelector('.lifestyle-media');
  if (!media || !('IntersectionObserver' in window)) return;
  var A = window.anime;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.disconnect();

      var ring = media.querySelector('.rg-fg');
      if (ring) {
        var kesz = ring.getAttribute('stroke-dashoffset');
        var teljes = ring.getAttribute('stroke-dasharray');
        if (A && !reduce) {
          try { A({ targets: ring, strokeDashoffset: [teljes, kesz], duration: 1300, easing: 'easeOutCubic' }); } catch (err) {}
          setTimeout(function () { ring.setAttribute('stroke-dashoffset', kesz); }, 2100);
        }
      }

      var num = media.querySelector('.num');
      if (num && A && !reduce) {
        var kesz2 = num.textContent, cel = parseInt(num.getAttribute('data-to'), 10);
        var o = { v: 0 };
        try {
          A({ targets: o, v: cel, duration: 1100, easing: 'easeOutExpo', round: 1,
              update: function () { num.textContent = Math.round(o.v); },
              complete: function () { num.textContent = kesz2; } });
        } catch (err) { num.textContent = kesz2; }
        setTimeout(function () { num.textContent = kesz2; }, 1800);
      }

      if (A && !reduce) {
        try {
          A({ targets: media.querySelectorAll('.hud'), opacity: [0, 1], translateY: [16, 0],
              duration: 800, delay: A.stagger(140), easing: 'cubicBezier(.22,.61,.36,1)',
              complete: function () {
                media.querySelectorAll('.hud').forEach(function (h) { h.style.opacity=''; h.style.transform=''; });
              } });
        } catch (err) {}
        setTimeout(function () {
          media.querySelectorAll('.hud').forEach(function (h) { h.style.opacity=''; h.style.transform=''; });
        }, 2400);
      }
    });
  }, { threshold: 0.25 });
  io.observe(media);
})();

/* =========================================================================
   MOBIL: lepesenkenti keszulek-kep a ragado telefon HELYETT (2026-08-23)

   MIERT: egy teszteloő telefonon HIBANAK nezte a ragado telefont ("beragadt"),
   mert kis kepernyon a keszulek a hely felet elfoglalja, es nincs mibol latni,
   hogy ez szandekos. Asztali gepen marad a ragadas, ott ket hasab van.

   HOGYAN: nem duplikalunk HTML-t. A meglevo videokat KLONOZZUK a lepesek ala,
   es csak az lejatszik, amelyik eppen lathato (akkumulator + adatforgalom).
   Ha barmi elszall, a lepesek szovege valtozatlanul olvashato marad.
   ========================================================================= */
(function () {
  var mobil = window.matchMedia && window.matchMedia('(max-width:980px)');
  if (!mobil || !mobil.matches) return;

  var keret = document.querySelector('.live-sticky .live-device');
  var lepesek = [].slice.call(document.querySelectorAll('.live-step'));
  if (!keret || !lepesek.length) return;

  // A ragado oszlop videoi mobilon nem kellenek: allitsuk meg oket.
  [].slice.call(document.querySelectorAll('.live-sticky .live-vid')).forEach(function (v) {
    try { v.pause(); v.preload = 'none'; } catch (e) {}
  });

  var sajatVideok = [];

  lepesek.forEach(function (lepes) {
    var kulcs = lepes.getAttribute('data-step');
    var eredeti = document.querySelector('.live-sticky .live-vid[data-vid="' + kulcs + '"]');
    if (!eredeti) return;

    var keretMasolat = keret.cloneNode(false);           // csak a keret, gyerekek nelkul
    ['device-notch', 'device-btn btn-top', 'device-btn btn-mid', 'device-btn btn-low'].forEach(function (o) {
      var sp = document.createElement('span'); sp.className = o; keretMasolat.appendChild(sp);
    });
    var kepernyo = document.createElement('div');
    kepernyo.className = 'device-screen';

    var video = eredeti.cloneNode(false);
    video.classList.add('is-on');
    video.removeAttribute('autoplay');
    video.preload = 'none';
    video.muted = true; video.loop = true; video.playsInline = true;

    kepernyo.appendChild(video);
    keretMasolat.appendChild(kepernyo);

    var hold = document.createElement('div');
    hold.className = 'live-step-shot';
    hold.appendChild(keretMasolat);
    var fenyfolt = document.createElement('span');
    fenyfolt.className = 'live-glow'; fenyfolt.setAttribute('aria-hidden', 'true');
    hold.appendChild(fenyfolt);

    // A kep a cim ES a szoveg utan jojjon, kozvetlenul a chipek ele: igy eloszor
    // azt olvassa el, MIT lat, es utana latja is.
    var chipek = lepes.querySelector('.ls-chips');
    if (chipek) lepes.insertBefore(hold, chipek); else lepes.appendChild(hold);
    sajatVideok.push(video);
  });

  if (!sajatVideok.length || !('IntersectionObserver' in window)) return;

  var figyelo = new IntersectionObserver(function (bejegyzesek) {
    bejegyzesek.forEach(function (b) {
      var v = b.target;
      if (b.isIntersecting) {
        if (v.preload === 'none') { v.preload = 'metadata'; v.load(); }
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function () {});   // autoplay-tiltas: a poster marad
      } else {
        try { v.pause(); } catch (e) {}
      }
    });
  }, { threshold: 0.45 });

  sajatVideok.forEach(function (v) { figyelo.observe(v); });
})();
