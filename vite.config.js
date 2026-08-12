import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const paquete = JSON.parse(readFileSync('./package.json', 'utf8'));

// Sello de la edición. Se inyecta en tiempo de compilación porque el juego
// tiene que poder DECIR qué versión está corriendo: sin eso, "actualiza" es un
// botón de fe. La fecha va en el sello porque la versión de package.json no
// cambia en cada despliegue y el jugador necesita distinguir dos builds del
// mismo número.
const SELLO = new Date().toISOString().slice(0, 16).replace('T', ' ');

// El juego se publica en GitHub Pages bajo https://<usuario>.github.io/estadodecepcion/
// Por eso la base debe llevar el nombre del repositorio. En desarrollo local usamos '/'.
const BASE = process.env.GITHUB_ACTIONS ? '/estadodecepcion/' : '/';

export default defineConfig({
  base: BASE,

  define: {
    __VERSION__: JSON.stringify(paquete.version),
    __EDICION__: JSON.stringify(SELLO),
  },

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
      // 'prompt', no 'autoUpdate'. Con autoUpdate el service worker nuevo se
      // activa y recarga la página en cuanto está listo, y eso puede pasar en
      // mitad de una corrida: el jugador pierde la partida por una razón que
      // no tiene nada que ver con el juego. Aquí el aviso llega a main.js y se
      // aplica en el primer momento seguro (menú o fin de partida).
      // Ver src/utils/actualizacion.js.
      registerType: 'prompt',
      // El registro lo hace src/utils/actualizacion.js, no el plugin: hace
      // falta pasarle `updateViaCache: 'none'` al registro y esa opción no se
      // puede tocar desde aquí. Con el registrador del plugin puesto habría
      // dos registros compitiendo.
      injectRegister: null,
      // Inyectamos el manifiesto en el HTML y generamos el service worker.
      includeAssets: ['icons/*.svg'],
      manifest: {
        name: 'EL MERCIO — Estado de Excepción',
        short_name: 'Estado Decepción',
        description:
          'Corre, esquiva y documenta. Un endless runner satírico de El Mercio.',
        // Sin esto el manifiesto declara 'en' por defecto y los lectores de
        // pantalla leen el español con fonética inglesa.
        lang: 'es-EC',
        dir: 'ltr',
        categories: ['games', 'entertainment'],
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
        // Cacheamos todo el bundle en la primera carga. El juego es
        // autocontenido (los modelos 3D son procedurales, así que "los
        // archivos 3D" son en realidad el chunk de Three.js), y a partir de la
        // segunda visita arranca 100% offline y sin tocar la red.
        //
        // POR QUÉ THREE VA EN SU PROPIO CHUNK (ver build.rollupOptions):
        // el precache de Workbox va por URL con hash de contenido. Si Three
        // estuviera dentro del bundle del juego, CADA cambio de una línea de
        // gameplay cambiaría el hash del archivo entero y el navegador se
        // volvería a bajar los 485 KB de la librería. Separado, su hash solo
        // cambia cuando cambia Three de verdad: las actualizaciones del juego
        // descargan unos pocos KB.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Three.js sin comprimir ronda los 500 KB; subimos el límite para que
        // entre en el precache.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Borra los precaches de versiones viejas. Sin esto, cada despliegue
        // deja su copia completa del juego en disco.
        cleanupOutdatedCaches: true,
        // El service worker nuevo NO se salta la espera por su cuenta: lo hace
        // cuando se lo pedimos desde la aplicación, en un momento seguro. Pero
        // en cuanto se activa, toma el control de la pestaña de inmediato, que
        // es lo que garantiza que el código nuevo entre entero y no a medias.
        skipWaiting: false,
        clientsClaim: true,
      },
      devOptions: {
        // Permite probar el comportamiento PWA con `npm run dev`.
        enabled: false,
      },
    }),
  ],
});
