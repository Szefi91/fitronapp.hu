# -*- coding: utf-8 -*-
"""A magyar index.html-bol generalja az /en/ es /de/ valtozatot.
   Forras: index.html (HU). Kimenet: en/index.html, de/index.html.
   Futtatas: python3 i18n/build.py   (a fitron-preview gyokerebol)"""
import io, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strings import T, HEAD

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
nyers = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()



def normalizal(s):
    """A build VISSZAIR az index.html-be, ezert a masodik futas mar atirt utvonalakat olvasna.
       Eloszor mindent visszaviszunk gyoker-abszolutra, es CSAK utana teszunk ra prefixet.
       (2026-08-22: e nelkul a de/index.html-ben './script.js' maradt, es a Vite build elszallt.)"""
    for elo in ('../', './'):
        s = s.replace('"' + elo + 'assets/', '"/assets/')
        for f in ('styles.css', 'script.js'):
            s = s.replace('"' + elo + f + '"', '"/' + f + '"')
    return s


def relativ_utvonalak(s, melyseg):
    """A Vite a RELATIV hivatkozasokat dolgozza fel es hasheli (igy epul ma az eles oldal).
       A gyoker-relativ /assets/... a Vite szamara public-utvonal lenne, ezert almappanal
       ../ prefixre valtunk: /en/index.html -> ../assets/...  A HU gyoker-lap ./ prefixet kap."""
    elo = './' if melyseg == 0 else '../'
    for mappa in ('assets/',):
        s = s.replace('"/' + mappa, '"' + elo + mappa)
    for f in ('styles.css', 'script.js'):
        s = s.replace('"/' + f + '"', '"' + elo + f + '"')
    return s

def angol_kepek(s):
    """Az /en/ es /de/ oldalon az APP is angolul lassszon: az -en valtozatokra cserelunk.
       (A recept- es edzesterv-NEVEK adatbazis-tartalom, azok magyarul maradnak; ez app-oldali kerdes.)"""
    for n in ('dashboard', 'level', 'tracker', 'kitchen', 'community'):
        s = s.replace('/assets/app-%s.mp4' % n, '/assets/app-%s-en.mp4' % n)
        s = s.replace('/assets/app-%s.jpg' % n, '/assets/app-%s-en.jpg' % n)
    for n in ('screen-home', 'screen-achievement', 'screen-workout', 'screen-kitchen', 'screen-profile'):
        s = s.replace('/assets/%s.jpg' % n, '/assets/%s-en.jpg' % n)
    return s

def fejlec(s, lang):
    h = HEAD[lang]
    s = s.replace('<html lang="hu">', '<html lang="%s">' % lang)
    s = re.sub(r'<title>.*?</title>', '<title>%s</title>' % h['title'], s, count=1, flags=re.S)
    s = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda m: m.group(1)+h['desc']+m.group(2), s, count=1)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*(")', lambda m: m.group(1)+h['ogt']+m.group(2), s, count=1)
    s = re.sub(r'(<meta property="og:description" content=")[^"]*(")', lambda m: m.group(1)+h['ogd']+m.group(2), s, count=1)
    s = re.sub(r'(<meta property="og:locale" content=")[^"]*(")', lambda m: m.group(1)+h['locale']+m.group(2), s, count=1)
    s = re.sub(r'(<meta name="twitter:title" content=")[^"]*(")', lambda m: m.group(1)+h['ogt']+m.group(2), s, count=1)
    s = re.sub(r'(<meta name="twitter:description" content=")[^"]*(")', lambda m: m.group(1)+h['twd']+m.group(2), s, count=1)
    s = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1)+h['url']+m.group(2), s, count=1)
    s = s.replace('"SEO_DESC"', '"%s"' % h['desc'])
    s = s.replace('"url": "https://fitronapp.hu/",\n    "image"', '"url": "%s",\n    "image"' % h['url'])
    return s

def nyelvvalaszto(s, lang):
    s = s.replace(' class="is-current"', '')
    cel = {'hu': 'href="/"', 'en': 'href="/en/"', 'de': 'href="/de/"'}[lang]
    return s.replace('<a %s' % cel, '<a %s class="is-current"' % cel, 1)

def forditas(s, idx):
    kulcsok = sorted(T.keys(), key=len, reverse=True)
    hianyzo = []
    for i, k in enumerate(kulcsok):
        if k not in s:
            hianyzo.append(k); continue
        s = s.replace(k, '\x00%d\x00' % i)
    for i, k in enumerate(kulcsok):
        s = s.replace('\x00%d\x00' % i, T[k][idx])
    return s, hianyzo

# HU: csak a fejlec-behelyettesites es az aktiv nyelv
src = normalizal(nyers)
hu = relativ_utvonalak(nyelvvalaszto(fejlec(src, 'hu'), 'hu'), 0)
io.open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(hu)

for lang, idx in (('en', 0), ('de', 1)):
    ki, hianyzo = forditas(src, idx)
    ki = angol_kepek(ki)
    ki = relativ_utvonalak(nyelvvalaszto(fejlec(ki, lang), lang), 1)
    d = os.path.join(ROOT, lang)
    os.makedirs(d, exist_ok=True)
    io.open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(ki)
    print('%s kesz, nem talalt kulcs: %d %s' % (lang, len(hianyzo), hianyzo[:6] if hianyzo else ''))

# sitemap a harom nyelvvel + hreflang alternativakkal
sm = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
for u in ('https://fitronapp.hu/', 'https://fitronapp.hu/en/', 'https://fitronapp.hu/de/'):
    sm.append('  <url><loc>%s</loc>' % u)
    for l, lu in (('hu', 'https://fitronapp.hu/'), ('en', 'https://fitronapp.hu/en/'), ('de', 'https://fitronapp.hu/de/')):
        sm.append('    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (l, lu))
    sm.append('    <xhtml:link rel="alternate" hreflang="x-default" href="https://fitronapp.hu/"/>')
    sm.append('  </url>')
for u in ('privacy', 'terms', 'cookies', 'impresszum', 'disclaimer', 'legal'):
    sm.append('  <url><loc>https://fitronapp.hu/%s.html</loc></url>' % u)
sm.append('</urlset>')
io.open(os.path.join(ROOT, 'public', 'sitemap.xml'), 'w', encoding='utf-8').write('\n'.join(sm) + '\n')
print('sitemap kesz')
