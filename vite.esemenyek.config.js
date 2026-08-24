// CSAK TESZTHEZ: az Események fül harness-e Firebase nélkül, rögzített adatokkal.
import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      'firebase/firestore': resolve(__dirname, '.harness/esemenyek-stub.js'),
      'firebase/functions': resolve(__dirname, '.harness/esemenyek-stub.js'),
      'firebase/storage': resolve(__dirname, '.harness/esemenyek-stub.js'),
    },
  },
  server: { port: 5178, strictPort: true },
});
