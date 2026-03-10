# FITRON Website (Landing)

Kész, egyoldalas landing page a FITRON apphoz.

## Tartalom
- `index.html` – fő landing oldal
- `styles.css` – dizájn + effektek
- `script.js` – screen swap + cookie consent + analytics opt-in
- `legal.css` – jogi oldalak egységes sötét témája
- `assets/` – logó + screenshotok + hero kép
- Jogi oldalak:
  - `privacy.html`
  - `terms.html`
  - `cookies.html`
  - `impresszum.html`
  - `disclaimer.html`
  - `legal.html`
- SEO:
  - `robots.txt`
  - `sitemap.xml`

## Fontos teendő publikálás előtt
1. `index.html` fájlban a **Google Play** gomb href-jét cseréld le a végleges Play Store URL-re.
2. Support e-mail már: `info@fitronapp.hu`.
3. Az `impresszum.html` fájlban töltsd ki a jogilag kötelező cégadatokat (`[kitöltendő]`).
4. Analyticshez add meg a GA4 mérési azonosítót a `script.js` fájlban (`MEASUREMENT_ID`).

## Lokális futtatás
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Gyors publikus hostolás (Netlify)
1. Nyisd meg a Netlify-t, új site deploy drag&drop-pal.
2. Húzd be a teljes `fitron-website` mappát.
3. Deploy után kapott URL mehet Play Console-ba (privacy + terms + impresszum linkekkel).
