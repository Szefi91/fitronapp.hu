// CSAK TESZTHEZ: az admin feluletet Firebase nelkul futtatja, rogzitett adatokkal.
import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      'firebase/app': resolve(__dirname, '.harness/firebase-app.js'),
      'firebase/auth': resolve(__dirname, '.harness/firebase-auth.js'),
      'firebase/firestore': resolve(__dirname, '.harness/firebase-firestore.js'),
      'firebase/functions': resolve(__dirname, '.harness/firebase-functions.js'),
      'firebase/storage': resolve(__dirname, '.harness/firebase-storage.js'),
    },
  },
  define: { 'import.meta.env.VITE_FIREBASE_API_KEY': '"harness"', 'import.meta.env.VITE_FIREBASE_PROJECT_ID': '"harness"' },
  server: { port: 5199, strictPort: true },
});
