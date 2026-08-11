import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// El juego se publica en GitHub Pages bajo https://<usuario>.github.io/estadodecepcion/
// Por eso la base debe llevar el nombre del repositorio. En desarrollo local usamos '/'.
const BASE = process.env.GITHUB_ACTIONS ? '/estadodecepcion/' : '/';

export default defineConfig({
  base: BASE,

  build: {
    // Los navegadores objetivo son móviles modernos: no hace falta transpilar a ES5.
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Separamos Three.js en su propio chunk para que el Service Worker
        // lo cachee una sola vez y las actualizaciones del juego no lo invaliden.
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },

  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Inyectamos el manifiesto en el HTML y generamos el service worker.
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'EL MERCIO — Estado de Excepción',
        short_name: 'Estado Decepción',
        description:
          'Corre, esquiva y documenta. Un endless runner satírico de El Mercio.',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'fullscreen',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cacheamos todo el bundle en la primera carga. El juego es autocontenido
        // (los modelos 3D son procedurales), así que a partir de la segunda visita
        // arranca 100% offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Three.js comprimido ronda los 700 KB; subimos el límite para que entre.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Permite probar el comportamiento PWA con `npm run dev`.
        enabled: false,
      },
    }),
  ],
});
