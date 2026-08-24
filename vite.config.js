import { defineConfig } from 'vite'
import { resolve } from 'path'

// Harom nyelvi belepesi pont: magyar (gyoker), angol, nemet.
// Enelkul a Vite CSAK az index.html-t epitene, es az /en/ /de/ oldalak
// egyszeruen hianyoznanak az eles oldalrol.
export default defineConfig({
  server: {
    headers: {
      // A Google-belepes felugro ablakkal megy. A bongeszo alap COOP-szabalya elvagja a fo ablak
      // es a popup kapcsolatat: a felhasznalo belep, az oldal viszont nem ertesul rola, es
      // latszolag nem tortenik semmi. (2026-08-24-en a Fitron app dev szerverén ugyanez volt.)
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        en: resolve(__dirname, 'en/index.html'),
        de: resolve(__dirname, 'de/index.html'),
        // Az admin KULON belepesi pont: a marketing-oldal NEM tolti be a Firebase SDK-t.
        admin: resolve(__dirname, 'admin/index.html'),
        // A telefonon megnyilo jovahagyo-oldal KULON belepesi pont: sajat, kicsi bundle,
        // hogy egy QR-beolvasas utan azonnal betoltodjon mobilneten is.
        parositas: resolve(__dirname, 'admin/parositas.html'),
      },
    },
    assetsInlineLimit: 0,
  },
})
