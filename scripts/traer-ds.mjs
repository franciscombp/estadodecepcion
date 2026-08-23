// ============================================================================
// TRAER EL SISTEMA DE DISEÑO — copia mal-ds dentro de public/ds
// ============================================================================
// El juego NO tiene sistema de diseño propio: usa `mal-ds`, el de la casa, con
// el tema del periódico (`data-marca="mercio"`). Este script trae una copia
// literal desde un clon del repo y la deja en `public/ds`, que Vite publica tal
// cual —sin tocar sus `url()`, sin renombrarle nada— para que lo que sirve el
// juego sea byte a byte lo que dice `version.json`.
//
//   node scripts/traer-ds.mjs /ruta/al/clon/de/mal
//
// POR QUÉ UNA COPIA Y NO UN SUBMÓDULO. El juego se despliega en GitHub Pages
// desde una acción que hace `npm ci && vite build`: un submódulo obliga a
// clonar recursivo en el CI y deja el despliegue dependiendo de que otro repo
// esté disponible en ese momento. Una copia versionada arranca siempre, y este
// script hace que actualizarla sea un comando.
//
// LO QUE SE PODA. `mal-ds` trae las tipografías de sus CUATRO temas. El
// periódico usa PT Serif, PT Serif Caption y Montserrat; Inter, Syne y
// JetBrains Mono son de los otros tres y aquí no las pide nadie. Son 219 KB
// que el service worker precargaría para no usarlas nunca —esto es un juego
// que arranca sin conexión y todo lo que entra en el precache se baja entero
// la primera vez—. Sus `@font-face` se quedan en la hoja apuntando a archivos
// que no están, y no pasa nada: un navegador solo pide una tipografía cuando
// algo la usa.
// ============================================================================

import { cp, rm, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = path.join(AQUI, '..', 'public', 'ds');

// Las de los otros tres temas.
const SOBRAN = ['inter.woff2', 'inter-italic.woff2', 'syne.woff2', 'jetbrains-mono.woff2'];

const origen = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(AQUI, '..', '..', 'mal');
const ds = path.join(origen, 'ds');

if (!existsSync(path.join(ds, 'mal', 'mal.css'))) {
  console.error(`No hay un mal-ds en ${ds}.\n`
    + 'Clona https://github.com/franciscombp/mal y pásale la ruta:\n'
    + '  node scripts/traer-ds.mjs /ruta/al/clon');
  process.exit(1);
}

await rm(DESTINO, { recursive: true, force: true });
await mkdir(DESTINO, { recursive: true });

for (const pieza of ['mal', 'fonts']) {
  await cp(path.join(ds, pieza), path.join(DESTINO, pieza), { recursive: true });
}
// Solo `version.json`: es lo que dice qué versión se está sirviendo, y lo lee
// la pantalla de Ajustes. `componentes.json` (64 KB) y el README son
// documentación del sistema —se consultan en su repo— y aquí solo serían
// sesenta y ocho kilobytes más en el precache de un juego que arranca sin
// conexión.
await cp(path.join(ds, 'version.json'), path.join(DESTINO, 'version.json'));

// El escaparate del sistema no se publica con el juego.
await rm(path.join(DESTINO, 'mal', 'demo'), { recursive: true, force: true });
await rm(path.join(DESTINO, 'mal', 'index.html'), { force: true });
for (const fuente of SOBRAN) {
  await rm(path.join(DESTINO, 'fonts', fuente), { force: true });
}

const v = JSON.parse(await readFile(path.join(DESTINO, 'version.json'), 'utf8'));
console.log(`mal-ds ${v.version} (${v.fecha}) copiado en public/ds`);
console.log(`  mal.css ${v.hojas['mal/mal.css'].bytes} bytes · sha ${v.hojas['mal/mal.css'].sha}`);
