#!/usr/bin/env node
// ============================================================================
// HORNEAR ANIMACIONES — de los .fbx de Mixamo a un .glb que carga el juego
// ============================================================================
// Lee los `.fbx` de `scripts/animaciones/`, les pasa el ciclo a nuestro
// esqueleto (ver `src/creador/mixamo.js`) y escribe
// `public/modelos/animaciones.glb`: los tres clips y NADA MÁS —ni malla, ni
// textura, ni material—, 93 KB para las tres animaciones.
//
// UN SOLO ARCHIVO PARA LOS SEIS PERSONAJES. Comparten esqueleto y nombres de
// hueso, y las pistas van nombradas por hueso (`Hips.quaternion`), así que el
// mismo clip se ata a cualquiera de ellos. Hornear uno por personaje sería
// multiplicar por seis el mismo cuaternión.
//
// SE EJECUTA A MANO, con el servidor de desarrollo levantado:
//
//     npm run dev              (en otra terminal)
//     npm run animaciones
//
// POR QUÉ PASA POR UN NAVEGADOR. `FBXLoader` y `GLTFExporter` son módulos de
// los ejemplos de Three y dan por hecho que hay DOM: el primero para
// descodificar, el segundo para volcar texturas a un lienzo. Montar eso en
// Node es pelearse con dos docenas de polyfills; abrir Chromium y pedirle que
// lo haga es una línea. Y de paso se hornea con EXACTAMENTE el mismo código
// que corre en el juego, que es la regla de esta casa.
// ============================================================================

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(AQUI, '..', 'public', 'modelos', 'animaciones.glb');
const SERVIDOR = process.env.SERVIDOR ?? 'http://localhost:5173';

// Qué clip sale de qué archivo. El nombre es con el que el juego lo pide.
//
// LOS TRES DE LA PARTIDA. `correr` es el ciclo de siempre; `salto` y `rol` no
// se reproducen a su ritmo sino con la aguja puesta donde diga el juego (ver
// personajeGLB.js).
//
// Y LOS CUATRO DE LA PORTADA, que es una escena de entrevista y no una
// partida: el periodista aguanta el micrófono, el entrevistado gesticula, y al
// final los dos salen corriendo. `microfono` sale de un «torch idle» —sostener
// una antorcha y sostener un micrófono son el mismo gesto— y `arrancar` es un
// arranque de carrera, que empieza de pie y no a media zancada como el ciclo.
//
// Y CADA UNO A LOS FOTOGRAMAS QUE PIDE. Los de acción van a 30: en 0,73 s de
// zancada, veintitrés cuadros ya son justos. Los de estar de pie van a 15,
// porque son gestos lentos y a 30 lo único que se duplica es el peso —el de
// discutir dura veinte segundos y pasaba de doscientos kilobytes él solo—.
const RECETA = [
  ['correr', '/scripts/animaciones/correr.fbx', 30],
  ['salto', '/scripts/animaciones/salto.fbx', 30],
  ['rol', '/scripts/animaciones/rol.fbx', 30],
  ['microfono', '/scripts/animaciones/microfono.fbx', 15],
  ['discutir', '/scripts/animaciones/discutir.fbx', 15],
  ['secreto', '/scripts/animaciones/secreto.fbx', 15],
  ['arrancar', '/scripts/animaciones/arrancar.fbx', 30],
  // Y LOS DOS DEL RESTO DEL REPARTO. `golpe` es la reacción al choque, que se
  // recorre con la aguja puesta por el aplastón; `montado` es Roy sentado
  // sobre los hombros del mando —un «sitting yell», que es exactamente lo que
  // hace: ir sentado y gritar—.
  ['golpe', '/scripts/animaciones/golpe.fbx', 30],
  ['montado', '/scripts/animaciones/montado.fbx', 15],
  // Y el ciclo del que CARGA. No es el mismo que el de correr: va agachado,
  // porque lleva a Roy sentado encima.
  ['cargando', '/scripts/animaciones/cargando.fbx', 30],
];

// El Chromium que traiga el entorno, si está donde suele. Sin esto, Playwright
// busca el suyo propio y falla en cualquier máquina donde lo instalara otra
// versión —que es todas las que no acaban de correr `playwright install`—.
const DE_LA_CASA = '/opt/pw-browsers/chromium';
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM
    ?? (fs.existsSync(DE_LA_CASA) ? DE_LA_CASA : undefined),
  args: ['--no-sandbox'],
});
const pagina = await navegador.newPage({ viewport: { width: 900, height: 600 } });
pagina.on('pageerror', (e) => console.error('[navegador]', e.message));

await pagina.goto(`${SERVIDOR}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await pagina.waitForFunction(() => !!window.__juego, { timeout: 120000 });

const salida = await pagina.evaluate(async (receta) => {
  const T = await import('/node_modules/.vite/deps/three.js');
  const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const P = await import('/src/models/personajeGLB.js');
  const M = await import('/src/creador/mixamo.js');
  await P.cargarPersonajesGLB('/');

  const clips = [];
  const informe = [];
  for (const [nombre, url, fps] of receta) {
    const { escena, clips: deFuera } = M.leerFBX(await (await fetch(url)).arrayBuffer());
    if (!deFuera.length) throw new Error(`${url} no trae ninguna animación`);
    const modelo = P.crearPersonajeGLB('tostadologo');
    P.reposarGLB(modelo);
    const r = M.pasarAlPersonaje(modelo, escena, deFuera[0], { nombre, fps });
    clips.push(r.clip);
    informe.push(`  ${nombre.padEnd(8)} ${r.clip.duration.toFixed(2)} s · ${r.cuadros} cuadros`
      + ` · ${r.emparejados.length} huesos · escala ${r.escala.toFixed(3)}`
      + ` · posado ${r.desnivel >= 0 ? '−' : '+'}${Math.abs(r.desnivel).toFixed(3)} m`
      + (r.sinPareja.length ? ` · sin pareja: ${r.sinPareja.join(', ')}` : ''));
  }

  // EL PORTADOR: el mismo esqueleto, sin malla. Se le arrancan los huesos al
  // personaje y se cuelgan de un grupo pelado; lo que se exporta son nodos y
  // pistas, y nada que pese.
  const modelo = P.crearPersonajeGLB('tostadologo');
  P.reposarGLB(modelo);
  const raiz = new T.Group();
  raiz.name = 'animaciones';
  const raices = [];
  modelo.traverse((o) => { if (o.isBone && !o.parent?.isBone) raices.push(o); });
  for (const h of raices) raiz.add(h);

  // CON QUÉ CADERA SE HORNEÓ, apuntado dentro del propio archivo.
  //
  // La pista de posición de la cadera va en unidades del padre del hueso y es
  // ABSOLUTA: dice «la cadera está a 87,8», no «la cadera baja 12». Y 87,8 es
  // la cadera DEL TOSTADÓLOGO. Los otros la tienen entre 71,8 (Roy) y 95,9 (el
  // mando), así que un clip agachado horneado con uno deja al otro con la
  // cadera treinta centímetros por debajo de donde le corresponde y las
  // piernas metidas dentro del torso. Se apunta aquí la referencia y cada
  // personaje reescala la pista a la suya al cargarla.
  const cadera = modelo.userData.glb.huesos.get('Hips').nodo;
  cadera.userData.reposoCadera = {
    x: cadera.position.x, y: cadera.position.y, z: cadera.position.z,
  };

  const bytes = await new Promise((ok, mal) => {
    new GLTFExporter().parse(raiz, ok, mal,
      { binary: true, onlyVisible: false, animations: clips });
  });
  const u8 = new Uint8Array(bytes);
  let texto = '';
  for (let i = 0; i < u8.length; i += 8192) texto += String.fromCharCode(...u8.subarray(i, i + 8192));
  return { b64: btoa(texto), informe: informe.join('\n') };
}, RECETA);

console.log(salida.informe);
fs.writeFileSync(SALIDA, Buffer.from(salida.b64, 'base64'));
console.log(`\n${path.relative(process.cwd(), SALIDA)}: ${(fs.statSync(SALIDA).size / 1024).toFixed(0)} KB`);
await navegador.close();
