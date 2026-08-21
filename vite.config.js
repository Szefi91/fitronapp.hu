import { defineConfig } from 'vite'
import { resolve } from 'path'

// Harom nyelvi belepesi pont: magyar (gyoker), angol, nemet.
// Enelkul a Vite CSAK az index.html-t epitene, es az /en/ /de/ oldalak
// egyszeruen hianyoznanak az eles oldalrol.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        en: resolve(__dirname, 'en/index.html'),
        de: resolve(__dirname, 'de/index.html'),
      },
    },
    assetsInlineLimit: 0,
  },
})
