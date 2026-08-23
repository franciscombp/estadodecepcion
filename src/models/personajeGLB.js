// ============================================================================
// PERSONAJES DEL MODELO — el .glb de verdad, con su esqueleto y su carrera
// ============================================================================
// Los dos protagonistas vienen de un modelo hecho fuera (Meshy): malla con
// esqueleto y un ciclo de carrera horneado de 0.67 s. Ese ciclo es el motivo
// de todo esto. Tiene cosas que un ciclo escrito a mano no acierta —el peso
// que cae sobre el pie de apoyo, el hombro que se adelanta con el brazo
// contrario, la cabeza que llega tarde— y se nota a la primera ojeada.
//
// SE USA EL ARCHIVO. Hubo una versión anterior que lo medía y lo reconstruía
// con cajas; quedaba un muñeco correcto y sin gracia. Lo que hace falta del
// modelo no son sus medidas: es su animación.
//
// ---------------------------------------------------------------------------
// EL COLOR: DOS CAMINOS, Y POR QUÉ HAY DOS
// ---------------------------------------------------------------------------
// LOS PRIMEROS DOS ARCHIVOS venían de UN SOLO COLOR: material blanco, sin
// texturas, y unas UVs que no llevaban ninguna imagen detrás. Así que el color
// se sacaba de la MALLA, que ya traía la información: el sombrero es un trozo
// de geometría separado del cráneo, la mochila es otro, las gafas otro.
//
//   1. Se agrupan los triángulos en ISLAS (trozos de malla que se tocan). El
//      modelo tiene veintitantas: el ala del sombrero, la cara, el pelo, cada
//      cristal de las gafas, la mochila, cada correa, cada pierna.
//   2. Cada isla se clasifica por dos cosas que ya están en el archivo: de qué
//      HUESO cuelga y DÓNDE está (su caja envolvente en reposo). Un trozo que
//      pesa del hueso del pie es zapato; uno que cuelga de la cabeza y mide
//      sesenta y ocho centímetros de ancho es el ala de un sombrero.
//   3. Se pinta cada TRIÁNGULO con el color de su isla.
//
// POR QUÉ POR TRIÁNGULO Y NO POR VÉRTICE. Los vértices de esta malla están
// compartidos entre caras, así que un color por vértice se interpola: el borde
// del sombrero se degradaría hacia la piel en vez de cortar. Se desindexa la
// geometría y cada cara lleva su color entero, y los cortes son cortes.
//
// LOS SEIS ARCHIVOS NUEVOS SÍ VIENEN PINTADOS, y no se parece. Puestos uno al
// lado del otro no hay discusión: la pintura por islas da manchas planas y una
// cara sin cara, y el atlas del modelador trae ojos, cejas, barba, labios, la
// tela con su sombra, el chaleco con POLICÍA escrito en la espalda y la banda
// tricolor de Roy. Nada de eso lo puede inventar un clasificador de islas.
//
// Así que cada personaje declara CÓMO se pinta:
//
//   'atlas'  se respeta la imagen del archivo y sólo se le cambia el material
//            —el que traen es emisivo puro (emissiveFactor [1,1,1]), o sea
//            que se ilumina solo y se saltaría la luz de todo el barrio—.
//   'islas'  el camino de arriba. Lo siguen los DERIVADOS: Buencán y Monki
//            salen del cuerpo del tostadólogo porque no tienen archivo propio,
//            y si heredaran también su atlas irían los tres vestidos igual.
//
// LO QUE COSTABA EL ATLAS, Y LO QUE CUESTA AHORA. Cada archivo traía 5 MB de
// PNG a 2048x2048: 31 MB entre los seis, y 2.290 ms de interpretar cada uno.
// Se recomprimieron a 512x512 en webp (ver scripts/adelgazar-personajes.py):
// 1.78 MB en total, y midiendo el color triángulo a triángulo en Lab el error
// medio es de 2.4 dE, que al tamaño al que se ve el personaje —0.30 del alto
// de la pantalla— no se distingue.
//
// ---------------------------------------------------------------------------
// LO QUE SE LE QUITA
// ---------------------------------------------------------------------------
//   · El material de fábrica, siempre. El de los archivos nuevos es emisivo al
//     100% y dejaría a los personajes planos y ajenos a la luz de la escena.
//   · Las UVs, sólo en el camino 'islas': ahí no hay ninguna imagen que mapear.
//   · La geometría se comparte entre copias (SkeletonUtils.clone clona el
//     esqueleto pero no los búferes), así que tener varios en pantalla no
//     multiplica la memoria.
// ============================================================================

import * as THREE from 'three';
import { material } from '../utils/materiales.js';
import { caja as cajaBiselada } from '../utils/geometria.js';
import { colgar, menear, descolgar } from '../utils/meneo.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonarConEsqueleto } from 'three/examples/jsm/utils/SkeletonUtils.js';

// ---------------------------------------------------------------------------
// PALETAS
// ---------------------------------------------------------------------------
// Los mismos tonos que tenían los personajes de cajas, para que cambiar el
// modelo no cambie de quién es la camisa verde.
const PALETAS = {
  // Sólo quedan los tres que pinta el clasificador de islas: el cuerpo del
  // que salen (el tostadólogo, por si algún día vuelve a hacer falta) y los
  // dos derivados. Los demás van con el atlas del modelador y su paleta era
  // código muerto: describía una ropa que ya no lleva nadie.
  //
  // Las tres ropas van lo más lejos posible unas de otras —gris azulado y
  // teja— porque a ocho metros y de espaldas es lo único que los separa.

  tostadologo: {
    piel: 0xd9a06b,
    antebrazo: 0xd9a06b,   // Manga corta
    ropa: 0x22c55e,       // Camisa verde
    // El azul del pantalón va bastante más claro de lo que pediría un vaquero
    // porque debajo hay zapatos negros: con el marino de siempre, pierna y
    // zapato eran la misma mancha oscura y el personaje acababa en un muñón.
    pantalon: 0x44598c,
    zapato: 0x18181f,
    sombrero: 0xe8cd8f,   // El ala, paja clara
    copa: 0xc9a765,       // La copa, un punto más tostada
    pelo: 0x3a2418,
    mochila: 0x1c2028,
    correa: 0x14161c,
    gafas: 0x0a0e17,
  },

  buencan: {
    piel: 0xcf9a70,
    antebrazo: 0x2f3a4f,   // De traje: la manga llega a la muñeca
    ropa: 0x2f3a4f,       // Chaqueta gris azulada
    pantalon: 0x4a5a7d,
    zapato: 0x18181f,
    pelo: 0x2a1c14,
    gafas: 0x0a0e17,
  },

  monki: {
    piel: 0xe0b088,
    antebrazo: 0xe0b088,   // Túnica sin mangas
    ropa: 0xb8452f,       // Túnica teja
    pantalon: 0x5a534a,
    zapato: 0x18181f,
    pelo: 0x241a12,
    gafas: 0x0a0e17,
  },
};

// ---------------------------------------------------------------------------
// LA REDACCIÓN
// ---------------------------------------------------------------------------
// Ahora hay SEIS archivos, uno por cara, y quedan DOS personajes sin el suyo.
// Cada uno declara:
//
//   archivo    de qué .glb sale su cuerpo
//   pintado    'atlas' (la imagen del modelador) o 'islas' (color por trozo
//              de malla). Ver la cabecera.
//   quitar     sólo en 'islas': qué piezas de ese cuerpo NO lleva. El sombrero
//              de paja y la mochila de prensa son del tostadólogo y de nadie
//              más.
//   accesorios sólo en 'islas': lo suyo, colgado de sus huesos. Los del atlas
//              ya vienen vestidos; colgarles encima una corbata de cajas sería
//              ponerle una corbata a una corbata.
//
// QUIÉN ES QUIÉN EN LOS ARCHIVOS. Se abrieron los seis y se miraron antes de
// repartir papeles, porque el nombre del archivo y quien sale dentro no
// siempre coinciden:
//
//   tostadologo  sombrero, gafas de sol, camisa oscura, pantalón gris
//   avecilla     rizos, jersey verde, vaqueros
//   generico     gafas, jersey gris, pantalón marrón — un ciudadano cualquiera
//   ministro     calvo, barba, gafas y CHALECO DE POLICÍA: el mando, no un
//                señor de traje. Es al que se le suben a caballito.
//   policia      casco, pasamontañas y equipo antidisturbios
//   roy          camisa celeste y BANDA TRICOLOR
//
// LOS PAPELES los repartió el autor: el genérico es a quien entrevistan, Roy
// es el que se sube al ministro, y el policía es el que suele hacer
// barbaridades (va en el cerco, ver game/Cerco.js).
const REDACCION = {
  tostadologo: { archivo: 'tostadologo', pintado: 'atlas' },
  avecilla: { archivo: 'avecilla', pintado: 'atlas' },

  // EL ENTREVISTADO de la portada y de la cinemática. No es nadie: es un
  // cargo, y por eso el modelo se llama «genérico». Ni un rasgo que apunte a
  // una persona concreta —se satiriza el cargo y el trámite, nunca una cara
  // (ver docs/GUION.md)—.
  generico: { archivo: 'generico', pintado: 'atlas' },

  // EL MANDO POLICIAL. Es el de abajo del dúo perseguidor, así que sale dos
  // veces con el mismo archivo: los bytes se bajan una sola vez.
  ministro: { archivo: 'ministro', pintado: 'atlas' },
  perseguidorAbajo: { archivo: 'ministro', pintado: 'atlas' },
  perseguidorArriba: { archivo: 'roy', pintado: 'atlas' },

  // EL ANTIDISTURBIOS del cerco.
  policia: { archivo: 'policia', pintado: 'atlas' },

  // LOS DOS QUE NO TIENEN ARCHIVO. Salen del cuerpo del tostadólogo, y por eso
  // van por el camino de las islas: heredar también su atlas los dejaría a los
  // tres con la misma camisa oscura y el mismo pantalón gris, y lo único que
  // los separa a ocho metros y de espaldas es la ropa.
  buencan: {
    archivo: 'tostadologo',
    pintado: 'islas',
    quitar: new Set(['sombrero', 'copa', 'mochila', 'correa', 'gafas']),
    accesorios: ponerBuencan,
  },
  monki: {
    archivo: 'tostadologo',
    pintado: 'islas',
    quitar: new Set(['sombrero', 'copa', 'mochila', 'correa', 'gafas']),
    accesorios: ponerMonki,
  },
};

// ---------------------------------------------------------------------------
// CLASIFICACIÓN DE ISLAS
// ---------------------------------------------------------------------------

/**
 * Une los vértices de la geometría en islas conexas.
 *
 * Se sueldan primero POR POSICIÓN: la malla trae vértices partidos (el mismo
 * punto repetido para que dos caras tengan normales distintas), y sin soldar
 * cada corte de normal rompería la isla en dos.
 *
 * @returns {Int32Array} índice de isla por vértice
 */
function islas(geometria) {
  const pos = geometria.attributes.position;
  const idx = geometria.index;
  const n = pos.count;
  const padre = new Int32Array(n);
  for (let i = 0; i < n; i++) padre[i] = i;

  const raiz = (x) => {
    while (padre[x] !== x) { padre[x] = padre[padre[x]]; x = padre[x]; }
    return x;
  };
  const unir = (a, b) => {
    const ra = raiz(a); const rb = raiz(b);
    if (ra !== rb) padre[ra] = rb;
  };

  const mapa = new Map();
  for (let i = 0; i < n; i++) {
    const clave = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},`
      + `${Math.round(pos.getZ(i) * 2000)}`;
    const previo = mapa.get(clave);
    if (previo === undefined) mapa.set(clave, i);
    else unir(i, previo);
  }
  for (let i = 0; i < idx.count; i += 3) {
    unir(idx.getX(i), idx.getX(i + 1));
    unir(idx.getX(i + 1), idx.getX(i + 2));
  }

  const salida = new Int32Array(n);
  for (let i = 0; i < n; i++) salida[i] = raiz(i);
  return salida;
}

/** Reúne, por isla: su caja envolvente y de qué hueso cuelga sobre todo. */
function fichasDeIslas(geometria, huesos, mapaIslas) {
  const pos = geometria.attributes.position;
  const ind = geometria.attributes.skinIndex;
  const pes = geometria.attributes.skinWeight;
  const fichas = new Map();

  for (let i = 0; i < pos.count; i++) {
    const id = mapaIslas[i];
    let f = fichas.get(id);
    if (!f) {
      f = { n: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], pesos: new Map() };
      fichas.set(id, f);
    }
    f.n++;
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    for (let c = 0; c < 3; c++) {
      if (p[c] < f.min[c]) f.min[c] = p[c];
      if (p[c] > f.max[c]) f.max[c] = p[c];
    }
    // De qué hueso cuelga este vértice: el de más peso de los cuatro.
    let mejor = 0; let peso = -1;
    for (let k = 0; k < 4; k++) {
      const w = pes.getComponent(i, k);
      if (w > peso) { peso = w; mejor = ind.getComponent(i, k); }
    }
    const nombre = huesos[mejor]?.name ?? '';
    f.pesos.set(nombre, (f.pesos.get(nombre) ?? 0) + 1);
  }

  for (const f of fichas.values()) {
    f.hueso = [...f.pesos.entries()].sort((a, b) => b[1] - a[1])[0][0];
    f.tam = f.max.map((v, c) => v - f.min[c]);
    f.centro = f.max.map((v, c) => (v + f.min[c]) / 2);
  }
  return fichas;
}

/**
 * Qué parte es, sabiendo solo de qué hueso cuelga.
 *
 * Es la regla del CUERPO: donde la malla es continua —tronco, brazos, cara—
 * lo único que separa una camisa de una mano es el esqueleto, y el esqueleto
 * está en el archivo con los huesos nombrados.
 */
function porHueso(hueso) {
  if (/Foot|ToeBase/.test(hueso)) return 'zapato';
  if (/UpLeg|Leg/.test(hueso)) return 'pantalon';
  if (/Hand/.test(hueso)) return 'piel';
  // El antebrazo lo decide cada uno en su paleta: los periodistas van de manga
  // corta y llevan el brazo descubierto, y los que van de traje, no. Sin este
  // corte, el ministro salía con dos manazas de piel asomando de una chaqueta.
  if (/ForeArm/.test(hueso)) return 'antebrazo';
  if (/Arm|Shoulder/.test(hueso)) return 'ropa';
  if (/Head|neck/.test(hueso)) return 'piel';
  return 'ropa';   // Hips y Spine: el tronco.
}

/**
 * ¿Esta isla es un ACCESORIO? Devuelve su parte, o null si es cuerpo.
 *
 * Aquí está el reparto de trabajo que hace que esto funcione con dos modelos
 * distintos, y costó un intento entenderlo. La primera versión clasificaba
 * ISLAS enteras por su hueso dominante, y con el tostadólogo salía perfecto
 * —su malla viene despiezada— pero con la avecilla salía un desastre: en su
 * modelo el tronco, los dos brazos y la cara son UNA SOLA ISLA, así que el
 * hueso dominante de esa isla era el de una mano y el abrigo entero se pintaba
 * de color piel.
 *
 * Las islas solo sirven, pues, para lo que están separadas de verdad: los
 * accesorios. El cuerpo se pinta triángulo a triángulo por su hueso.
 *
 * LOS NÚMEROS SON MEDIDAS DE ESTOS MODELOS, no constantes generales: están en
 * metros, miden 1.70 y su cráneo va de 1.26 a 1.60. Cuando llegue un tercero
 * habrá que volver a medirlo, y para eso está `__islas()`.
 */
function accesorio(f) {
  const hueso = f.hueso;
  const enCabeza = /Head|neck/.test(hueso);

  // El ala del sombrero: nada más en la cabeza mide dos tercios de metro.
  if (enCabeza && f.tam[0] > 0.55) return 'sombrero';

  // Las correas de la mochila: tiras finas que bajan del hombro y dan la
  // vuelta de la espalda al pecho.
  if (f.tam[0] < 0.07 && f.tam[1] > 0.25 && f.tam[2] > 0.3) return 'correa';

  // La mochila: bulto colgado del tronco y por detrás.
  if (/Hips|Spine/.test(hueso) && f.centro[2] < -0.13) return 'mochila';

  // Las piezas sueltas de la cabeza. En un modelo son las gafas —dos cristales
  // y sus patillas— y en el otro son los rizos, treinta y pico bolas alrededor
  // del cráneo. Lo que las distingue es dónde están: unas gafas van delante y
  // a la altura de los ojos; un rizo puede estar en cualquier parte.
  if (enCabeza && Math.max(...f.tam) < 0.25 && f.n < 140) {
    return (f.centro[2] > 0.06 && f.centro[1] < 1.48) ? 'gafas' : 'pelo';
  }

  // La mata de pelo, cuando viene de una pieza: detrás y por arriba.
  if (enCabeza && f.centro[2] < -0.02 && f.max[1] > 1.5 && f.tam[0] < 0.4) return 'pelo';

  return null;
}

/** Lo que decide el color de una isla, para `__islas()`. */
function clasificar(f) {
  return accesorio(f) ?? `cuerpo:${porHueso(f.hueso)}`;
}

/**
 * Pinta la geometría: desindexa y da a cada triángulo el color de su isla.
 * Devuelve la geometría nueva; la original se queda intacta.
 */
function pintar(geometria, huesos, paleta, quitar = null) {
  const mapaIslas = islas(geometria);
  const fichas = fichasDeIslas(geometria, huesos, mapaIslas);

  // De las islas solo se toman los accesorios; el resto es cuerpo y lo decide
  // el hueso de cada triángulo.
  const accesorios = new Map();
  for (const [id, f] of fichas) {
    const a = accesorio(f);
    if (a) accesorios.set(id, a);
  }

  const idx = geometria.index;
  const pos = geometria.attributes.position;
  const nor = geometria.attributes.normal;
  const ind = geometria.attributes.skinIndex;
  const pes = geometria.attributes.skinWeight;

  // Se construye a mano en vez de con toNonIndexed() porque hay triángulos que
  // NO van: el sombrero y la mochila del tostadólogo no los lleva nadie más, y
  // dejarlos invisibles con un material aparte costaría otra llamada de dibujo
  // por personaje. Lo que no se quiere, no se copia.
  const P = []; const N = []; const C = []; const SI = []; const SW = [];
  const c = new THREE.Color();
  const suma = new Map();

  for (let t = 0; t < idx.count; t += 3) {
    let nombre = accesorios.get(mapaIslas[idx.getX(t)]);

    if (!nombre) {
      // El hueso del triángulo: el que más pesa sumando sus tres vértices.
      // Por vértice suelto la costura entre camisa y mano queda dentada; por
      // triángulo el corte cae por el borde de una cara.
      suma.clear();
      for (let v = 0; v < 3; v++) {
        const i = idx.getX(t + v);
        for (let k = 0; k < 4; k++) {
          const w = pes.getComponent(i, k);
          if (w <= 0) continue;
          const h = huesos[ind.getComponent(i, k)]?.name ?? '';
          suma.set(h, (suma.get(h) ?? 0) + w);
        }
      }
      let mejor = ''; let peso = -1;
      for (const [h, w] of suma) if (w > peso) { peso = w; mejor = h; }
      nombre = porHueso(mejor);
    }

    if (quitar && quitar.has(nombre)) continue;

    // La copa del sombrero, un punto más tostada que el ala. Es la única
    // sub-pieza que se pinta dentro de una isla: copa y ala son la misma malla,
    // y sin el corte el sombrero es una mancha beige de un palmo. Se separa por
    // RADIO y no por altura —el ala va ladeada, así que a cualquier altura hay
    // trozos de las dos— y el eje del sombrero es lo único que no se mueve.
    if (nombre === 'sombrero') {
      let r = 0;
      for (let v = 0; v < 3; v++) {
        const i = idx.getX(t + v);
        r += Math.hypot(pos.getX(i), pos.getZ(i)) / 3;
      }
      if (r < 0.17) nombre = 'copa';
    }

    c.setHex(paleta[nombre] ?? paleta.ropa);
    // Three.js trabaja en espacio lineal; los tonos están escritos en sRGB.
    c.convertSRGBToLinear();

    for (let v = 0; v < 3; v++) {
      const i = idx.getX(t + v);
      P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      C.push(c.r, c.g, c.b);
      for (let k = 0; k < 4; k++) {
        SI.push(ind.getComponent(i, k));
        SW.push(pes.getComponent(i, k));
      }
    }
  }

  const suelta = new THREE.BufferGeometry();
  suelta.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  suelta.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  suelta.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  suelta.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  suelta.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  return suelta;
}

// ---------------------------------------------------------------------------
// ACCESORIOS
// ---------------------------------------------------------------------------
// Lo que distingue a un personaje de otro cuando el cuerpo es el mismo.
//
// SE ANCLAN A UN HUESO, y hay un detalle que hace falta para que salga: los
// huesos de este esqueleto están en centímetros y con los ejes mirando a donde
// el modelador quiso, así que colgar de uno un sombrero de tamaño normal lo
// deja del tamaño de un edificio y apuntando al suelo. La solución es colocar
// la pieza donde va EN COORDENADAS DEL PERSONAJE —que es como se piensa: «la
// boina va a 1.58 de alto»— y convertirla después al espacio del hueso.

const PIEZAS = new Map();

/** Material plano compartido: un tono, un material, aunque lo usen varios. */
function mat(color, emision = 0.06) {
  const clave = `${color}|${emision}`;
  let m = PIEZAS.get(clave);
  if (!m) {
    m = material({
      color, emissive: color, emissiveIntensity: emision,
      roughness: 0.7, metalness: 0.05, flatShading: true,
    });
    PIEZAS.set(clave, m);
  }
  return m;
}

const caja = (a, al, f, color, em) => new THREE.Mesh(cajaBiselada(a, al, f), mat(color, em));
const cilindro = (rs, ri, al, color, em) => new THREE.Mesh(
  new THREE.CylinderGeometry(rs, ri, al, 8), mat(color, em),
);
const esfera = (r, color, em) => new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(color, em));

/**
 * Cuelga una pieza de un hueso conservando dónde estaba puesta.
 *
 * La pieza llega colocada en coordenadas del personaje; aquí se convierte al
 * espacio local del hueso, que es lo que hace que acompañe al movimiento sin
 * heredar ni su escala en centímetros ni su orientación arbitraria.
 */
function anclar(pieza, hueso, modelo) {
  if (!hueso) return;
  modelo.updateMatrixWorld(true);
  pieza.updateMatrix();
  const aLocal = new THREE.Matrix4().copy(hueso.matrixWorld).invert()
    .multiply(modelo.matrixWorld);
  pieza.applyMatrix4(aLocal);
  hueso.add(pieza);
}

/**
 * LAS COTAS DE UN MODELO, medidas de su propia malla en reposo.
 *
 * Antes eran dos constantes copiadas del primer archivo que llegó —cráneo a
 * 1,44, coronilla a 1,62, pecho a 1,12— y valían mientras todos los personajes
 * salieran de ese mismo cuerpo. Ahora hay seis archivos de seis estaturas
 * distintas, de 1,45 a 1,85, y una boina puesta a 1,62 se le queda a uno
 * flotando por encima y a otro clavada en la nariz.
 *
 * SE MIDE LA MALLA, NO EL HUESO. El hueso de la cabeza está en la base del
 * cráneo, no en la coronilla, y entre uno y otro hay quince centímetros que
 * cambian de modelo a modelo —y más aún si el personaje lleva casco—. Así que
 * se buscan los vértices que PESAN de cada hueso y se les toma la caja: eso sí
 * es el cráneo, con su pelo y su casco incluidos.
 */
function medidasDe(escena, piel) {
  escena.updateMatrixWorld(true);
  const pos = piel.geometry.attributes.position;
  const ind = piel.geometry.attributes.skinIndex;
  const pes = piel.geometry.attributes.skinWeight;
  const v = new THREE.Vector3();

  // OJO CON LA MATRIZ DE LA MALLA. Estos archivos traen la malla con escala
  // 0.01 —el armazón viene en centímetros, como sale de Blender— pero los
  // vértices YA están en metros: van de 0 a 1.70. Y da igual, porque una malla
  // con piel no usa su propia matriz para deformarse: usa `bindMatrix`, las
  // matrices de los huesos y `bindMatrixInverse`. Aplicarle su `matrixWorld`
  // encoge las medidas cien veces —la primera versión de esto dijo que el
  // tostadólogo tenía la coronilla a 2 cm del suelo—.
  const cual = (nombre) => piel.skeleton.bones.findIndex((b) => b.name === nombre);

  /**
   * La caja de los vértices que cuelgan de un grupo de huesos.
   *
   * Va por GRUPOS y no por hueso suelto porque la cabeza de estos modelos no
   * es un hueso: son tres —`Head`, `head_end` y `headfront`— y el pelo, el
   * sombrero y el casco se reparten entre los tres. Pidiendo sólo `Head` se
   * queda fuera media coronilla, que es justo la cota que hace falta.
   */
  const cajaDe = (...nombres) => {
    const cuales = nombres.map(cual).filter((i) => i >= 0);
    if (!cuales.length) return null;
    const c = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) {
      // Un vértice cuenta si el grupo se lleva más de la mitad de su peso: al
      // 50% ya es carne de estos huesos y no de los vecinos.
      let peso = 0;
      for (let k = 0; k < 4; k++) {
        if (cuales.includes(ind.getComponent(i, k))) peso += pes.getComponent(i, k);
      }
      if (peso < 0.5) continue;
      c.expandByPoint(v.fromBufferAttribute(pos, i));
    }
    return c.isEmpty() ? null : c;
  };

  const todo = new THREE.Box3().setFromBufferAttribute(pos);
  const cab = cajaDe('Head', 'head_end', 'headfront');
  const pec = cajaDe('Spine01', 'Spine02');

  return {
    alto: todo.max.y - todo.min.y,
    craneo: {
      y: cab ? (cab.min.y + cab.max.y) / 2 : todo.max.y - 0.18,
      alto: cab ? cab.max.y - cab.min.y : 0.35,
      ancho: cab ? cab.max.x - cab.min.x : 0.24,
      fondo: cab ? cab.max.z - cab.min.z : 0.26,
      coronilla: cab ? cab.max.y : todo.max.y,
    },
    pecho: {
      y: pec ? (pec.min.y + pec.max.y) / 2 : todo.max.y * 0.66,
      fondo: pec ? pec.max.z : 0.11,
    },
  };
}

/**
 * BUENCAN — boina, traje y grabadora.
 *
 * OJO CON LA BOINA. Es lo único que lo distingue en el 99% del tiempo de juego
 * —que es de espaldas y a ocho metros—, así que va LADEADA y con rabillo. Una
 * boina puesta recta, a esa distancia, es una tapa.
 */
function ponerBuencan(huesos, modelo, _paleta, medidas) {
  const CRANEO = medidas.craneo;
  const PECHO = medidas.pecho;
  const cabeza = huesos.get('Head')?.nodo;

  const boina = new THREE.Group();
  boina.add(cilindro(0.175, 0.15, 0.06, 0x8f2f3a));
  const rabillo = cilindro(0.018, 0.018, 0.045, 0x6f2029);
  rabillo.position.set(0.02, 0.045, 0);
  boina.add(rabillo);
  boina.position.set(0.02, CRANEO.coronilla - 0.01, -0.01);
  boina.rotation.z = -0.24;
  anclar(boina, cabeza, modelo);

  // El bigote, que es la otra pieza que lo identifica de perfil.
  const bigote = caja(0.13, 0.035, 0.03, 0x2a1c14);
  bigote.position.set(0, CRANEO.y - 0.06, CRANEO.fondo / 2 + 0.01);
  anclar(bigote, cabeza, modelo);

  // Camisa y corbata sobre el pecho.
  const tronco = huesos.get('Spine01')?.nodo ?? huesos.get('Spine')?.nodo;
  const camisa = caja(0.1, 0.2, 0.02, 0xf0ece2, 0.2);
  camisa.position.set(0, PECHO.y + 0.02, PECHO.fondo);
  anclar(camisa, tronco, modelo);

  const corbata = caja(0.045, 0.2, 0.02, 0x9c1f2e, 0.16);
  corbata.position.set(0, PECHO.y, PECHO.fondo + 0.015);
  anclar(corbata, tronco, modelo);

  // Grabadora en la mano: entra a preguntar, no a apuntar.
  const mano = huesos.get('RightHand')?.nodo;
  const grabadora = caja(0.06, 0.11, 0.035, 0x14161c);
  grabadora.position.set(-0.62, 1.16, 0.06);
  anclar(grabadora, mano, modelo);
  const testigo = caja(0.025, 0.025, 0.015, 0xff3b3b, 0.9);
  testigo.position.set(-0.62, 1.2, 0.075);
  anclar(testigo, mano, modelo);
}

/**
 * MONKI — casco de espartana y escudo.
 *
 * El casco lleva CRESTA, y la cresta es transversal —de oreja a oreja, no de
 * frente a nuca— porque es como va la de verdad y porque de espaldas se ve
 * como una línea horizontal, que no se parece a nada más del juego.
 */
function ponerMonki(huesos, modelo, _paleta, medidas) {
  const CRANEO = medidas.craneo;
  const PECHO = medidas.pecho;
  const cabeza = huesos.get('Head')?.nodo;
  const BRONCE = 0x8a6c28;
  const PLACA = 0xb08d3a;

  // El casco es una caja y no un cilindro: la cabeza es cúbica, y un casco
  // redondo la tapa por el centro y le deja las esquinas del cráneo al aire.
  const casco = caja(CRANEO.ancho + 0.04, 0.24, CRANEO.fondo + 0.04, BRONCE, 0.12);
  casco.position.set(0, 1.5, -0.01);
  anclar(casco, cabeza, modelo);

  const cupula = esfera(CRANEO.ancho / 2 + 0.02, BRONCE, 0.12);
  cupula.scale.set(1, 0.5, 0.95);
  cupula.position.set(0, 1.61, -0.01);
  anclar(cupula, cabeza, modelo);

  // La cara del casco: frontal, nasal y dos carrilleras. Lo que dejan sin
  // tapar son dos huecos a los lados del nasal, y esos huecos son los ojos.
  const frontal = caja(CRANEO.ancho + 0.04, 0.06, 0.05, PLACA, 0.16);
  frontal.position.set(0, CRANEO.y - 0.06, CRANEO.fondo / 2);
  anclar(frontal, cabeza, modelo);

  const nasal = caja(0.05, 0.13, 0.05, PLACA, 0.16);
  nasal.position.set(0, CRANEO.y - 0.12, CRANEO.fondo / 2);
  anclar(nasal, cabeza, modelo);

  for (const s of [-1, 1]) {
    const carrillera = caja(0.05, 0.15, 0.1, PLACA, 0.16);
    carrillera.position.set(s * (CRANEO.ancho / 2 + 0.01), CRANEO.y - 0.13, CRANEO.fondo / 2 - 0.06);
    anclar(carrillera, cabeza, modelo);
  }

  // La cresta, transversal, en cinco tacos que bajan hacia los lados: un solo
  // bloque se lee como una caja encima de la cabeza.
  for (let i = -2; i <= 2; i++) {
    const alto = 0.15 - Math.abs(i) * 0.033;
    const taco = caja(0.055, alto, 0.09, 0x8f1f2a, 0.1);
    taco.position.set(i * 0.055, 1.7 - (0.15 - alto) / 2, -0.01);
    anclar(taco, cabeza, modelo);
  }

  // El escudo a la espalda. Es la segunda silueta reconocible y va detrás
  // porque detrás es donde se la ve.
  const tronco = huesos.get('Spine01')?.nodo ?? huesos.get('Spine')?.nodo;
  const escudo = cilindro(0.22, 0.22, 0.04, 0x9a6f2c, 0.1);
  escudo.rotation.set(Math.PI / 2, 0, 0.3);
  escudo.position.set(0.06, 1.06, -0.22);
  anclar(escudo, tronco, modelo);
  const umbo = esfera(0.055, 0xd8b45a, 0.25);
  umbo.position.set(0.06, 1.06, -0.25);
  anclar(umbo, tronco, modelo);
}

// ---------------------------------------------------------------------------
// CARGA
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// LA CORPULENCIA, Y POR QUÉ YA NO ESTÁ
// ---------------------------------------------------------------------------
// Aquí vivían doscientas líneas que reescribían los veinticuatro huesos de
// cada modelo —cabeza al 126 %, manos al 155 %, piernas al 80 % de largo— para
// darle al personaje el achaparrado de los runners del género: tres cabezas y
// media, sin cuello, miembros cortos y gruesos. Tenía su razón: con los dos
// primeros archivos, que venían de UN SOLO COLOR y con proporciones de
// persona, a veinte píxeles de alto y de espaldas lo único que se leía era la
// silueta, y una figura realista a ese tamaño es un palo con una bola encima.
//
// SE QUITA porque ya no hay nada que arreglar. Los seis modelos nuevos vienen
// hechos con sus proporciones, y son las que el autor quiere: entre 1,45 y
// 1,85 de alto, cada uno la suya. Estirarles y engordarles los huesos encima
// no los estilizaba, los deformaba —cabezones con manoplas—, y encima peleaba
// con el atlas: la textura está pintada sobre la malla en reposo, así que
// cualquier hueso que cambie de grueso arrastra el dibujo con él.
//
// Lo que se lee a veinte píxeles ahora lo da el atlas: el casco del
// antidisturbias, el sombrero del tostadólogo, la banda tricolor de Roy. Es
// más información de silueta y de color de la que daba engordar un hueso.
//
// Lo que dependía de aquellas medidas —dónde va la boina de Buencán, a qué
// altura se sienta el de arriba del dúo— ya no son constantes: se MIDEN del
// esqueleto de cada modelo al cargarlo (`medidasDe()`), que es lo que había
// que haber hecho desde el principio y lo que hace que un séptimo archivo con
// otra estatura entre sin tocar una línea.

const cargados = new Map();
// La geometría ORIGINAL (indexada, sin pintar) de cada modelo. Solo la usa
// `__islas()`, que es como se miden las reglas de clasificación.
const crudos = new Map();
let promesaCarga = null;

// Los BYTES de cada archivo, descargados una sola vez. Tres personajes salen
// del mismo .glb y bajarlo tres veces sería tirar medio mega por la ventana.
const archivos = new Map();

async function bytesDe(nombre, base) {
  let ya = archivos.get(nombre);
  if (!ya) {
    ya = fetch(`${base}modelos/personajes/${nombre}.glb`).then((r) => {
      if (!r.ok) throw new Error(`No está ${nombre}.glb (${r.status})`);
      return r.arrayBuffer();
    });
    archivos.set(nombre, ya);
  }
  return ya;
}

async function cargarUno(id, base) {
  const ficha = REDACCION[id];

  // SE VUELVE A INTERPRETAR el archivo para cada personaje, en vez de clonar
  // uno ya interpretado. Los bytes se bajan una vez —eso es lo caro— pero el
  // árbol tiene que salir nuevo, y el motivo es una trampa del clonador de
  // esqueletos: clonar un clon deja la malla atada a los huesos del PRIMERO.
  // El personaje se renderiza en la pose del original y no le hace caso a
  // nadie, que fue exactamente lo que pasó —el ministro y el periodista se
  // quedaban con un brazo en cruz haciendo el saludo, y ninguna pose escrita a
  // mano les movía nada—.
  const gltf = await new GLTFLoader().parseAsync(await bytesDe(ficha.archivo, base), '');
  const escena = gltf.scene;

  let piel = null;
  escena.traverse((o) => { if (o.isSkinnedMesh && !piel) piel = o; });
  if (!piel) throw new Error(`El modelo de ${id} no trae malla con esqueleto`);

  const paleta = PALETAS[id];
  crudos.set(id, { geometria: piel.geometry, huesos: piel.skeleton.bones });

  if (ficha.pintado === 'atlas') {
    // SE RESPETA LA IMAGEN Y SE CAMBIA EL MATERIAL. El que trae el archivo es
    // emisivo del todo —emissiveFactor [1,1,1] con el mismo atlas de mapa—,
    // que es como salen de Meshy: el personaje se ilumina solo, no le entra la
    // luz del barrio, no le llega la niebla y va igual de brillante de noche
    // en el Apagón que a mediodía en la Bahía. Se le pasa el mapa de color a
    // un material del juego y se acabó.
    const mapa = piel.material.map || piel.material.emissiveMap || null;
    piel.material = material({
      map: mapa,
      roughness: 0.68,
      metalness: 0.0,
      // SIN flatShading, al revés que en el camino de las islas. Ahí las caras
      // planas eran lo que hacía que se leyeran los trozos; aquí el atlas ya
      // trae la sombra pintada y facetar la malla sólo la ensucia.
      side: THREE.DoubleSide,
    });
  } else {
    piel.geometry = pintar(piel.geometry, piel.skeleton.bones, paleta, ficha.quitar);
    piel.material = material({
      vertexColors: true,
      roughness: 0.68,
      metalness: 0.0,
      flatShading: true,
    });
  }
  // Se ve de espaldas y a contraluz media partida: sin esto, cualquier giro
  // de cámara que lo pille de lado enseña el interior de la malla.
  piel.frustumCulled = false;

  // LAS MEDIDAS DEL MODELO, tomadas aquí y una sola vez. Cada archivo tiene su
  // estatura —de 1,45 a 1,85— y todo lo que se le cuelgue encima tiene que
  // salir de ella, no de una constante copiada del primer modelo que llegó.
  const medidas = medidasDe(escena, piel);

  cargados.set(id, { escena, clips: gltf.animations, paleta, medidas, accesorios: ficha.accesorios });
  return true;
}

/**
 * Carga los modelos. Se llama una vez, desde la pantalla de carga.
 * Si alguno falla, ese personaje se queda con su versión de cajas y ya está:
 * el juego no depende de que el archivo esté.
 */
/**
 * LOS CICLOS DE FUERA. `public/modelos/animaciones.glb` trae tres clips
 * —correr, salto y rol— retargeteados desde Mixamo (ver
 * `scripts/hornear-animaciones.mjs`). Son 93 KB de cuaterniones: ni malla, ni
 * material, ni textura.
 *
 * UN SOLO ARCHIVO PARA LOS SEIS. Comparten esqueleto y nombres de hueso, y las
 * pistas van nombradas por hueso (`Hips.quaternion`), así que el mismo clip se
 * ata a cualquiera de ellos.
 *
 * Si el archivo no está, el juego sigue: quedan los ciclos escritos a mano, que
 * es lo que había antes y lo que se usa con los personajes de cajas.
 */
const clipsDeFuera = new Map();

async function cargarAnimaciones(base) {
  const r = await fetch(`${base}modelos/animaciones.glb`);
  if (!r.ok) throw new Error(`No está animaciones.glb (${r.status})`);
  const gltf = await new GLTFLoader().parseAsync(await r.arrayBuffer(), '');
  for (const c of gltf.animations) clipsDeFuera.set(c.name, c);
}

export function cargarPersonajesGLB(base = '/') {
  if (promesaCarga) return promesaCarga;
  promesaCarga = Promise.all(
    // Las animaciones PRIMERO en la lista pero en paralelo: cada personaje que
    // se cree después las encontrará, y si no llegan no pasa nada.
    [
      cargarAnimaciones(base).catch((e) => {
        console.warn('[Personajes] Sin animaciones de fuera, se usan las escritas a mano.', e);
        return false;
      }),
      ...Object.keys(REDACCION).map((id) => cargarUno(id, base).catch((e) => {
        console.warn(`[Personajes] Sin modelo para ${id}, se usa el procedural.`, e);
        return false;
      })),
    ],
  );
  return promesaCarga;
}

/**
 * Los ids de todos los personajes que salen de un archivo.
 *
 * Lo pide el exportador del creador: la lista de personajes JUGABLES son
 * cuatro, pero del modelo salen nueve —el entrevistado, el mando, el
 * antidisturbias y los dos del dúo no se juegan y hasta ahora no había forma
 * de bajarlos para retocarlos en Blender—.
 */
export function idsPersonajesGLB() {
  return Object.keys(REDACCION);
}

/** Los clips que trae el archivo de un personaje, para exportarlos con él. */
export function clipsDePersonajeGLB(id) {
  return cargados.get(id)?.clips ?? [];
}

export function hayPersonajeGLB(id) {
  return cargados.has(id);
}

/**
 * Una copia lista para jugar.
 *
 * Devuelve el grupo, su mezclador de animación y la tabla de huesos con la
 * pose de referencia de cada uno, que es lo que necesitan el salto y la
 * voltereta para colocarlos a mano (ver `poseGLB.js`).
 */
export function crearPersonajeGLB(id) {
  const fuente = cargados.get(id);
  if (!fuente) return null;

  // Dos grupos, como en los personajes de cajas y por lo mismo: el de fuera es
  // el que se mueve por la pista y el de dentro es el que rueda en la
  // voltereta, que gira sobre un eje que pasa por la barriga y no por los pies.
  const grupo = new THREE.Group();
  const cuerpo = clonarConEsqueleto(fuente.escena);
  grupo.add(cuerpo);

  // El esqueleto se ficha ANTES de tocar el mezclador, y el orden importa.
  // Lo que se guarda como pose de reposo son las transformaciones que traen los
  // nodos del archivo, que es el modelo EN CRUZ. En cuanto el mezclador da un
  // solo paso, esas transformaciones son ya un fotograma de la zancada —brazos
  // desiguales, uno adelante y otro atrás— y cualquier pose escrita a mano
  // sale torcida y distinta en cada lado.
  //
  // (`skeleton.pose()`, que sería lo canónico para volver a la pose de enlace,
  // no sirve aquí: las matrices de enlace de este archivo no cuentan con que
  // la armadura entera va escalada a 0.01, y deja al personaje del tamaño de
  // un dedal.)
  const esqueleto = armarEsqueleto(cuerpo);

  // SE SUELTA LO COLGADO ANTES DE COLGAR NADA NUEVO.
  //
  // El registro de meneo es global —una lista que se recorre entera cada
  // fotograma— y aquí se construye un personaje cada vez que se cambia de
  // protagonista en Ajustes, se previsualiza uno, o arranca una partida. Sin
  // esto, la lista crece a cada cambio y el juego se pasa el rato meneando los
  // huesos de personajes que ya no existen: primero cuesta rendimiento y
  // luego, cuando el recolector no puede llevárselos porque la lista los
  // retiene, es una fuga de memoria en toda regla.
  descolgar();

  // LOS ACCESORIOS SE CUELGAN DE ESTA COPIA, no de la plantilla, y el orden
  // importa: van después de fichar el esqueleto —para que se coloquen contra
  // la pose de reposo— y antes de que el mezclador toque nada.
  //
  // Costó verlo: colgados de la plantilla parecían funcionar, pero el clonador
  // de esqueletos no reparenta lo que no es hueso, así que el maletín del
  // ministro y la grabadora de Buencan se quedaban enganchados al hueso de la
  // PLANTILLA —que no se anima nunca— y salían flotando a la altura de la
  // oreja, en el sitio exacto donde el modelo tiene la mano en cruz.
  if (fuente.accesorios) {
    cuerpo.updateMatrixWorld(true);
    fuente.accesorios(esqueleto.huesos, cuerpo, fuente.paleta, fuente.medidas);
  }

  const mezclador = new THREE.AnimationMixer(cuerpo);
  const correr = fuente.clips[0] ? mezclador.clipAction(fuente.clips[0]) : null;
  if (correr) correr.play();

  // LAS ACCIONES DE LOS CICLOS DE FUERA, una por clip y todas a peso CERO.
  // Se dejan sonando desde el principio y lo que se toca es el peso: crear la
  // acción la primera vez que hace falta cuesta un enganche de bindings a
  // mitad de partida, y eso es un tirón justo en el fotograma del salto.
  const acciones = {};
  for (const [nombre, clip] of clipsDeFuera) {
    const a = mezclador.clipAction(clip);
    a.play();
    a.setEffectiveWeight(0);
    acciones[nombre] = a;
  }
  mezclador.update(0);

  grupo.userData.medidas = fuente.medidas;
  grupo.userData.glb = { mezclador, correr, acciones, cuerpo, ...esqueleto };
  grupo.userData.nombre = id;

  // --- LO QUE SE MUEVE DESPUÉS DEL CUERPO ----------------------------------
  //
  // El sombrero de paja y la mochila del tostadólogo NO se pueden colgar: van
  // dentro de la malla con piel del modelo, cosidos a los huesos, y separarlos
  // sería partir la geometría en dos. Lo que sí se puede es menear los HUESOS
  // de los que cuelgan, y el efecto que se ve en pantalla es el mismo: al
  // cambiar de carril la cabeza —con su sombrero— se queda un pelo atrás y
  // vuelve rebasando, que es justo lo que hace un sombrero.
  //
  // Solo dos huesos, y a propósito. La cabeza lleva el meneo largo, que es el
  // que se lee; el tronco uno mucho más corto y tieso, para que el torso
  // acompañe sin que el personaje parezca de goma. Meter también los brazos
  // convertía la carrera en un baile.
  const cabeza = esqueleto.huesos?.get('Head')?.nodo;
  const tronco = esqueleto.huesos?.get('Spine01')?.nodo
    ?? esqueleto.huesos?.get('Spine')?.nodo;
  if (cabeza) {
    colgar(cabeza, {
      sobreAnimacion: true,
      rigidez: 78, amortiguacion: 9.5, sensibilidad: 0.05, tope: 0.3,
    });
  }
  if (tronco) {
    colgar(tronco, {
      sobreAnimacion: true,
      // Más rígido y menos sensible: el torso responde, pero no se dobla.
      rigidez: 150, amortiguacion: 15, sensibilidad: 0.018, tope: 0.12,
    });
  }

  return grupo;
}

// ---------------------------------------------------------------------------
// POSES SOBRE EL ESQUELETO IMPORTADO
// ---------------------------------------------------------------------------
// El archivo trae UNA animación: correr. El salto y la voltereta hay que
// ponerlos a mano, moviendo huesos.
//
// EL PROBLEMA DE LOS EJES, que es lo que hace esto menos obvio de lo que
// parece. Un hueso rota sobre SUS ejes locales, y los de este esqueleto no son
// los del mundo: el fémur no apunta a ninguna parte reconocible, así que
// escribir `hueso.rotation.x = 0.5` para adelantar una pierna adelanta lo que
// sea que salga. Lo que se quiere siempre es lo mismo —girar el miembro sobre
// el eje izquierda-derecha del personaje— así que se calcula UNA VEZ, en la
// pose de reposo, hacia dónde cae el eje X del mundo visto desde el padre de
// cada hueso, y se rota sobre ese vector. A partir de ahí, un ángulo positivo
// echa el miembro hacia atrás en todos los huesos, que es lo que hace que las
// poses de abajo se puedan leer.

const _q = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _v = new THREE.Vector3();

// Los tres ejes del MUNDO. Se gira siempre sobre ellos y nunca sobre los del
// hueso: los del hueso no apuntan a nada reconocible.
const EJE_X = new THREE.Vector3(1, 0, 0);   // izquierda-derecha
const EJE_Z = new THREE.Vector3(0, 0, 1);   // adelante-atrás

function armarEsqueleto(cuerpo) {
  const huesos = new Map();

  cuerpo.updateMatrixWorld(true);
  cuerpo.traverse((o) => {
    if (!o.isBone) return;
    huesos.set(o.name, {
      nodo: o,
      // La pose de reposo, que es de donde parte cualquier pose escrita a mano.
      pos: o.position.clone(),
      quat: o.quaternion.clone(),
      esc: o.scale.clone(),
    });
  });
  return { huesos };
}

/** Devuelve todos los huesos a la pose de reposo del archivo. */
function reposar(huesos) {
  for (const h of huesos.values()) {
    h.nodo.position.copy(h.pos);
    h.nodo.quaternion.copy(h.quat);
    h.nodo.scale.copy(h.esc);
  }
}

// La orientación del personaje entero, para el bloque de pose que se esté
// escribiendo. La fija `orientar()` y la usan todos los giros.
const _qModelo = new THREE.Quaternion();

/**
 * Empieza un bloque de pose: apunta qué personaje se está posando.
 *
 * HACE FALTA, y cuesta un buen rato descubrir por qué. Los giros de abajo se
 * piensan en ejes DEL PERSONAJE —«bajar el brazo», «echar el tronco atrás»—
 * pero se aplican sobre huesos, cuyos ejes no apuntan a nada. La conversión
 * pasa por el mundo... y ahí está la trampa: el personaje no siempre mira a
 * donde mira el mundo. El ministro está girado un cuarto de vuelta para
 * hablar con el periodista, y el periodista otro tanto durante la entrevista.
 *
 * Con ejes del mundo a secas, «bajar el brazo» de alguien girado noventa
 * grados es echárselo hacia adelante: uno se le iba arriba y el otro abajo, y
 * los dos quedaban saludando. Se veía en pantalla y no en las medidas, porque
 * medidas y render coincidían —los dos estaban mal—.
 */
function orientar(modelo) {
  modelo.updateWorldMatrix(true, false);
  modelo.getWorldQuaternion(_qModelo);
}

/**
 * Gira un hueso sobre un eje DEL PERSONAJE, encima de lo que ya tuviera.
 *
 * El eje se recalcula en cada llamada contra la posición actual del padre, y
 * eso es lo que permite encadenar giros: al bajar el brazo cambia hacia dónde
 * mira el codo, así que un eje calculado en la pose de reposo ya no sirve para
 * el antebrazo. Precalcularlo era más rápido y estaba mal.
 */
function girar(huesos, nombre, eje, angulo) {
  const h = huesos.get(nombre);
  if (!h || !angulo) return;
  h.nodo.parent.updateWorldMatrix(true, false);
  h.nodo.parent.getWorldQuaternion(_qp);
  // Del personaje al mundo, y del mundo al padre del hueso.
  _v.copy(eje).applyQuaternion(_qModelo).applyQuaternion(_qp.invert());
  _q.setFromAxisAngle(_v, angulo);
  h.nodo.quaternion.premultiply(_q);
}

/**
 * Cabeceo: adelante y atrás. Vale para todo lo que cuelga hacia abajo
 * —piernas, tronco, cabeza—: ángulo positivo lo echa hacia atrás.
 */
function doblar(huesos, nombre, angulo) {
  girar(huesos, nombre, EJE_X, angulo);
}

/**
 * LOS BRAZOS SON OTRA COSA, y aquí está el detalle que hace falta saber para
 * tocar cualquier pose de este archivo: el modelo viene en CRUZ, con los
 * brazos extendidos a los lados. Un brazo así apunta en la misma dirección que
 * el eje izquierda-derecha, y girarlo sobre ese eje lo hace rodar sobre sí
 * mismo sin moverlo de sitio. La primera versión de estas poses levantaba el
 * micrófono y el brazo se quedaba exactamente donde estaba.
 *
 * Así que van en dos tiempos: primero se BAJA el brazo (giro sobre el eje de
 * avance, y en sentido contrario en cada lado), y solo entonces, ya colgando,
 * se le puede dar el balanceo de siempre.
 *
 * @param {number} bajada  0 = en cruz, 1.5 = colgando pegado al cuerpo
 * @param {number} avance  negativo hacia adelante, positivo hacia atrás
 * @param {number} codo    flexión del antebrazo (negativo, hacia adelante)
 */
function brazo(huesos, lado, bajada, avance, codo) {
  // EL HOMBRO BAJA CON EL BRAZO, una parte del ángulo cada uno. Rotando solo
  // el hueso del brazo, la mano y el antebrazo obedecían pero el trozo de
  // malla que va del cuello al codo se quedaba donde estaba —pesa del hueso
  // del hombro— y el personaje acababa con la mano en la cadera y el brazo
  // extendido en cruz, saludando. Repartir el giro mueve el miembro entero.
  const signo = lado === 'Left' ? -1 : 1;
  girar(huesos, `${lado}Shoulder`, EJE_Z, signo * bajada * 0.45);
  girar(huesos, `${lado}Arm`, EJE_Z, signo * bajada * 0.55);
  girar(huesos, `${lado}Arm`, EJE_X, avance);
  girar(huesos, `${lado}ForeArm`, EJE_X, codo);
}

/** ¿Es un personaje del modelo, con su mezclador y sus huesos? */
export function esGLB(modelo) {
  return !!modelo?.userData?.glb;
}

/**
 * El ciclo de carrera del archivo, a la cadencia del juego.
 * El clip está grabado para una velocidad concreta; se estira o se encoge con
 * la velocidad de la corrida para que los pies no patinen sobre el asfalto.
 */
// ---------------------------------------------------------------------------
// LA CARRERA — escrita a mano, y por qué no se usa el clip del archivo
// ---------------------------------------------------------------------------
// EL CLIP SE LLAMA `walking_man` Y ES LO QUE DICE: un paseo. Se midió, hueso a
// hueso, muestreando el ciclo en sesenta posiciones:
//
//   zancada (recorrido del pie en Z) ....... 0.68 m
//   alza del pie ........................... 0.145 m
//   rebote de la cabeza .................... 0.070 m
//   ciclo .................................. 1.07 s
//
// Eso son 1.37 m de suelo por ciclo. A la escala que se usaba —1.055 a 20 m/s—
// el personaje «andaba» a 1.35 m/s mientras el mundo pasaba a 20: PATINABA
// 14,8 VECES. Que pareciera que resbala en vez de correr no era una impresión,
// era la medida.
//
// NO SE ARREGLA IGUALANDO. Para no patinar nada haría falta poner el clip a
// 15,6x, o sea cuarenta y cinco pasos por segundo: eso no es correr, es un
// abanico. Y bajar la velocidad del mundo tampoco, porque la velocidad ES el
// juego.
//
// SE INTENTÓ EXAGERAR EL CLIP y no vale. Se extrapolaba cada hueso alejándolo
// de su reposo con un `slerp` de t mayor que uno. La zancada subía de 0,68 a
// 1,16 m —bien— pero el pie se alzaba 0,88 m, seis veces lo del clip y no las
// dos que se pedían: la extrapolación se MULTIPLICA por la cadena de huesos,
// así que muslo, rodilla y tobillo se componen. Y peor: la pierna salía
// ESTIRADA en la recogida, con las dos piernas abiertas en un spagat de
// vallista, porque un paseo casi no dobla la rodilla y extrapolar «casi nada»
// sigue siendo casi nada. Queda la foto en la prueba de escritorio.
//
// ASÍ QUE SE ESCRIBE. Es el mismo ciclo que ya tenían los personajes de cajas
// —el de `characters.js`, con sus razones— pasado a huesos y subido de tono,
// porque lo que se pide es un sprint de dibujos animados:
//
//   · LA RODILLA SE DOBLA EN LA RECOGIDA, no en el apoyo. El talón sube por
//     detrás justo después de despegar y la pierna llega estirada al suelo.
//     Sin eso las piernas son dos palos que abren y cierran, que es justo lo
//     que hacía la extrapolación.
//   · LOS CODOS VAN DOBLADOS Y FIJOS cerca de 90°: nadie corre con los brazos
//     colgando, y de espaldas el braceo es la mitad de lo que se lee.
//   · EL TRONCO Y LA CADERA GIRAN EN SENTIDOS OPUESTOS. Es el detalle que más
//     se nota de espaldas, que es como se ve el personaje toda la partida.
//   · EL REBOTE VA AL DOBLE DE LA ZANCADA —se sube una vez por pie— y la
//     cabeza llega un pelo tarde. Eso lo pone `menear()`.
//   · Y EL TRONCO SE INCLINA. Un paseo va erguido; nadie esprinta erguido.
//
// Los números van bastante más lejos que los de las cajas —la cadera abre 1,15
// rad contra 0,95, la rodilla recoge 1,55 contra 1,25— porque ahí el objetivo
// era un muñeco creíble y aquí es que se lea a ocho metros, de espaldas y con
// el mundo pasando a treinta por hora.

/** Radianes de fase por segundo. Un ciclo son 2π y dos pasos. */
const CADENCIA = { LENTA: 9.2, RAPIDA: 13.4, V_LENTA: 15, V_RAPIDA: 32 };

const EJE_Y = new THREE.Vector3(0, 1, 0);   // la torsión del tronco

// ---------------------------------------------------------------------------
// QUIÉN MANDA SOBRE LOS HUESOS EN CADA MOMENTO
// ---------------------------------------------------------------------------
// Conviven dos formas de mover al personaje y no se pueden mezclar a lo tonto:
// el mezclador reescribe cada fotograma TODO hueso que su clip toque, así que
// una pose escrita a mano puesta antes se pierde entera, y un clip sonando
// debajo de una pose escrita a mano la pisa al fotograma siguiente.
//
// La regla es una sola: en cada instante hay UN clip a peso 1 y los demás a 0,
// o ninguno y entonces manda lo escrito a mano. `mandaElClip()` es quien lo
// decide, y devuelve la acción elegida o null.
function mandaElClip(g, nombre, peso = 1, dt = 0) {
  const acciones = g.acciones;
  if (!acciones || !acciones[nombre]) return null;
  // CON `dt` SE FUNDE, SIN `dt` SE CORTA. Al salir de la cinemática el
  // personaje viene del clip de arranque y entra en el de carrera: sin fundido
  // eso es un salto de pose en el primer fotograma de cada partida, y se ve.
  // El salto y el rol no lo necesitan —empiezan con una silueta tan distinta
  // que el corte no se lee— y además no reciben `dt`.
  const paso = dt > 0 ? 1 - Math.exp(-14 * dt) : 1;
  for (const [otro, accion] of Object.entries(acciones)) {
    const objetivo = otro === nombre ? peso : 0;
    const actual = accion.getEffectiveWeight();
    accion.setEffectiveWeight(actual + (objetivo - actual) * paso);
  }
  // El ciclo de carrera del propio archivo —el paseo con el que vino— se
  // apaga: lo sustituyen éstos.
  if (g.correr) g.correr.setEffectiveWeight(0);
  return acciones[nombre];
}

/**
 * Varios clips a la vez, con la aguja puesta por reloj.
 *
 * Lo usan las poses de la portada y la cinemática, que no tienen `dt`: reciben
 * el tiempo acumulado de la escena y con eso basta —`time = tiempo % duración`
 * y el mezclador se limita a evaluar—. Además hace falta poder mezclar DOS:
 * la salida de la entrevista es un fundido del micrófono al arranque de
 * carrera, y con un solo clip a peso 1 eso sería un corte.
 *
 * @param {Object<string,number>} mezcla nombre del clip → peso
 * @returns {boolean} si había clips que tocar
 */
function tocarClips(g, mezcla, tiempo) {
  if (!g.acciones) return false;
  let alguno = false;
  for (const [nombre, accion] of Object.entries(g.acciones)) {
    const peso = mezcla[nombre] ?? 0;
    accion.setEffectiveWeight(peso);
    if (peso <= 0) continue;
    const duracion = accion.getClip().duration;
    accion.time = duracion > 0 ? (tiempo % duracion) : 0;
    accion.timeScale = 0;
    alguno = true;
  }
  if (g.correr) g.correr.setEffectiveWeight(0);
  if (alguno) {
    g.cuerpo.rotation.set(0, 0, 0);
    g.cuerpo.position.set(0, 0, 0);
    g.cuerpo.scale.setScalar(1);
    g.mezclador.update(0);
  }
  return alguno;
}

/** Suelta los huesos: ningún clip manda, y lo escrito a mano vuelve a valer. */
function sueltaElClip(g) {
  if (g.acciones) for (const a of Object.values(g.acciones)) a.setEffectiveWeight(0);
  if (g.correr) g.correr.setEffectiveWeight(0);
}

export function animarCarreraGLB(modelo, dt, velocidad = 20) {
  const g = modelo.userData.glb;
  if (!g) return;
  const { huesos } = g;

  // EL CICLO DE MIXAMO, SI ESTÁ. Es un ciclo grabado sobre una persona, y se
  // nota en todo lo que un ciclo escrito a mano no acierta: el peso que cae
  // sobre el pie de apoyo, el hombro que se adelanta con el brazo contrario,
  // la cabeza que llega tarde.
  const conClip = mandaElClip(g, 'correr', 1, dt);
  if (conClip) {
    const clip = conClip.getClip();
    // LA CADENCIA. El clip trae un ciclo entero —dos pasos— en 0,73 s, o sea
    // 2,74 pasos por segundo tal cual. Se estira para ir de 2,9 a 4,3 pasos
    // según la velocidad: es la misma horquilla que se afinó a mano, y por el
    // mismo motivo —el jugador nota la aceleración por las piernas antes que
    // por el marcador—.
    const t = Math.max(0, Math.min(1,
      (velocidad - CADENCIA.V_LENTA) / (CADENCIA.V_RAPIDA - CADENCIA.V_LENTA)));
    const pasos = 2.9 + 1.4 * t;
    conClip.timeScale = (pasos * clip.duration) / 2;
    g.cuerpo.rotation.set(0, 0, 0);
    g.cuerpo.position.set(0, 0, 0);
    g.mezclador.update(dt);
    menear(dt);
    return;
  }

  // Y SI NO ESTÁ, el ciclo escrito a mano de siempre. No es un adorno: los
  // personajes de cajas no tienen otro, y si `animaciones.glb` no llega el
  // juego tiene que seguir corriendo.
  sueltaElClip(g);

  // LA CADENCIA SUBE CON LA VELOCIDAD, pero mucho menos que ella: de 2,9 a 4,3
  // pasos por segundo entre la velocidad de salida y la punta. Igualarla sería
  // el abanico de arriba; no moverla dejaría al personaje corriendo igual a 15
  // que a 32, y el jugador nota la aceleración por las piernas antes que por
  // el marcador.
  const t = Math.max(0, Math.min(1,
    (velocidad - CADENCIA.V_LENTA) / (CADENCIA.V_RAPIDA - CADENCIA.V_LENTA)));
  g.faseCarrera = (g.faseCarrera ?? 0)
    + dt * (CADENCIA.LENTA + (CADENCIA.RAPIDA - CADENCIA.LENTA) * t);
  const fase = g.faseCarrera;

  // EL MEZCLADOR NO SE TOCA. Si se le llamara, reescribiría cada fotograma
  // todos los huesos que el clip toca y se llevaría por delante lo de abajo.
  // El clip sigue cargado —lo usan el menú y las poses que sí lo quieren— pero
  // durante la carrera no avanza.
  orientar(modelo);
  reposar(huesos);

  for (const lado of ['Left', 'Right']) {
    const f = fase + (lado === 'Left' ? 0 : Math.PI);
    const sen = Math.sin(f);

    // CADERA: adelante con el seno. Negativo es hacia adelante.
    doblar(huesos, `${lado}UpLeg`, -sen * 1.22);

    // Y ABIERTA DE LADO. Esto es lo que separa un trote de una carrera de
    // dibujos: en el original las piernas no van en un plano, se abren hacia
    // fuera al recoger y se cierran al plantar. Visto desde atrás —que es como
    // se ve el 95% de la partida— una zancada en un solo plano no se lee: las
    // dos piernas se tapan la una a la otra y sólo queda un bulto que sube y
    // baja. Abriéndolas, cada paso saca una pierna del contorno del cuerpo.
    const signo = lado === 'Left' ? 1 : -1;
    girar(huesos, `${lado}UpLeg`, EJE_Z,
      signo * (0.10 + 0.26 * Math.max(0, Math.sin(f - 0.6))));

    // RODILLA: dobla al RECOGER, un cuarto de ciclo después del punto más
    // atrasado. Nunca al revés —una rodilla no se dobla hacia adelante—, de
    // ahí el max(0, …).
    const recogida = Math.max(0, Math.sin(f - 0.9));
    doblar(huesos, `${lado}Leg`, 0.22 + 1.55 * recogida);

    // TOBILLO: empuja al despegar y levanta la punta al llegar al suelo.
    doblar(huesos, `${lado}Foot`,
      0.38 * Math.max(0, Math.sin(f - 0.3)) - 0.32 * Math.max(0, -sen));

    // BRAZO CONTRARIO a la pierna de este lado. `bajada` lo saca de la cruz en
    // la que viene el modelo; el codo se queda doblado todo el ciclo y se
    // cierra un poco más cuando el brazo va atrás.
    const otro = lado === 'Left' ? 'Right' : 'Left';
    brazo(huesos, otro, 1.42, -sen * 1.05,
      -(0.75 + 0.30 * Math.max(0, sen)));
  }

  // TORSIÓN: el tronco gira contra la cadera. Se reparte entre los tres Spine
  // para que no haya un escalón entre la cintura y el pecho.
  const giro = Math.sin(fase);
  girar(huesos, 'Spine', EJE_Y, -giro * 0.10);
  girar(huesos, 'Spine01', EJE_Y, giro * 0.12);
  girar(huesos, 'Spine02', EJE_Y, giro * 0.10);
  girar(huesos, 'Head', EJE_Y, -giro * 0.06);

  // INCLINACIÓN hacia adelante, más cuanto más rápido.
  // LA INCLINACIÓN VA EN `Spine02`, QUE ES LA BASE. En este esqueleto los tres
  // Spine están numerados al revés de lo que parece: `Spine02` cuelga de la
  // cadera, `Spine01` va encima y `Spine` es el de arriba, del que salen el
  // cuello y los hombros. Inclinando `Spine` sólo se echa hacia adelante el
  // pecho y la cabeza —medido: la cabeza se movía 4,8 cm— y el personaje sale
  // jorobado en vez de lanzado. Desde la base se inclina el tronco entero.
  doblar(huesos, 'Spine02', -(0.20 + 0.10 * t));
  doblar(huesos, 'Spine01', -(0.08 + 0.04 * t));
  // Y la cabeza deshace la inclinación: mira al frente, no al suelo.
  doblar(huesos, 'Head', 0.26 + 0.13 * t);

  // REBOTE al doble de la zancada: se sube una vez por pie. Va en `cuerpo` y
  // no en el grupo del personaje porque el grupo lo mueve el juego —el salto,
  // el carril— y la sombra de contacto cuelga de él: si rebotara el grupo,
  // rebotaría la sombra y se despegaría del suelo.
  // EL REBOTE, que es la mitad de lo cómico. Va al doble de la zancada —se
  // sube una vez por pie— y sube MUCHO más que un rebote realista: 18 cm
  // contra los 7 del clip original. No es un temblor sobre el suelo, es una
  // fase de vuelo: el personaje despega en cada paso, que es lo que se pidió
  // —«corriendo dando saltos»— y lo que hacen los runners del género.
  //
  // La curva no es un seno: es un seno ELEVADO, que deja al muñeco poco
  // tiempo abajo y mucho arriba. Un seno pelado pasa la mitad del ciclo a
  // media altura y se lee como flotar; así se lee como despegar y caer.
  const vuelo = Math.pow(Math.abs(Math.sin(fase)), 0.62);
  g.cuerpo.rotation.x = 0;
  g.cuerpo.position.set(0, vuelo * (0.15 + 0.06 * t), 0);

  // Y UN BANDAZO LATERAL, al ritmo de la zancada y no al del rebote: el cuerpo
  // cae sobre el pie que apoya. Sin esto la carrera es simétrica y se ve
  // mecánica; con esto el personaje va dando tumbos hacia los lados, que es
  // justo lo que se buscaba.
  g.cuerpo.rotation.z = Math.sin(fase) * (0.07 + 0.04 * t);

  // EL MENEO VA EL ÚLTIMO, siempre. La cabeza y el tronco parten de la zancada
  // que se acaba de escribir y le añaden el retraso.
  menear(dt);
}

/**
 * Pose de salto. Se para el mezclador —si no, machacaría los huesos en el
 * fotograma siguiente— y se coloca el cuerpo a mano.
 * @param {number} subida +1 despegando, 0 en lo alto, −1 cayendo.
 */
export function animarSaltoGLB(modelo, subida = 0, avance = -1) {
  const g = modelo.userData.glb;
  if (!g) return;
  const { huesos } = g;

  // EL SALTO DE MIXAMO, SI ESTÁ Y SI EL JUGADOR SABE POR DÓNDE VA. El clip
  // dura 1,70 s y el vuelo del juego dura lo que dure —depende del impulso,
  // del potenciador y de si se pulsó caída rápida—, así que no se reproduce a
  // su ritmo: se le pone la aguja donde toca. `avance` va de 0 (acaba de
  // despegar) a 1 (aterriza), y el clip se recorre entero en ese trayecto.
  //
  // Así el aterrizaje del clip cae SIEMPRE en el fotograma en que el personaje
  // toca el suelo, corto o largo. Reproduciéndolo a su ritmo, un salto rápido
  // aterrizaba con el muñeco todavía boca abajo.
  if (avance >= 0) {
    const accion = mandaElClip(g, 'salto');
    if (accion) {
      accion.time = accion.getClip().duration * Math.max(0, Math.min(1, avance));
      accion.timeScale = 0;
      g.cuerpo.rotation.set(0, 0, 0);
      g.cuerpo.position.set(0, 0, 0);
      g.mezclador.update(0);
      return;
    }
  }

  sueltaElClip(g);
  orientar(modelo);
  reposar(huesos);

  const sube = Math.max(0, Math.min(1, subida));
  const cae = Math.max(0, Math.min(1, -subida));

  // Pierna de delante: se recoge al despegar y se adelanta a buscar el suelo.
  doblar(huesos, 'LeftUpLeg', -0.5 - 0.6 * sube - 0.25 * cae);
  doblar(huesos, 'LeftLeg', 0.5 + 1.1 * sube - 0.35 * cae);
  doblar(huesos, 'LeftFoot', -0.2 - 0.2 * cae);
  // Pierna de atrás: cuelga, y al caer se recoge para amortiguar.
  doblar(huesos, 'RightUpLeg', 0.35 + 0.3 * sube - 0.2 * cae);
  doblar(huesos, 'RightLeg', 0.4 + 0.9 * sube + 0.5 * cae);
  doblar(huesos, 'RightFoot', 0.25 * sube);

  // Brazos arriba al impulsarse, atrás al caer.
  const braceo = -0.9 - 0.5 * sube + 1.2 * cae;
  for (const lado of ['Left', 'Right']) {
    brazo(huesos, lado, 1.25, braceo, -0.5 - 0.5 * sube);
  }

  doblar(huesos, 'Spine', 0.18 * sube - 0.1 * cae);
  doblar(huesos, 'Head', -0.12 * cae);

  g.cuerpo.rotation.x = 0;
  g.cuerpo.position.set(0, 0, 0);
}

/**
 * AGACHARSE ES UN LIMBO, no una voltereta.
 *
 * La voltereta se probó y no da: es un modelo de cuatro mil triángulos con
 * pesos de esqueleto sencillos, y para que ruede de verdad hay que cerrar el
 * ovillo más de lo que la malla aguanta —pasados los 150 grados de flexión el
 * muslo atraviesa el torso y el sombrero se sale de la cabeza—. Quedaba una
 * bola de trozos dando vueltas.
 *
 * El limbo, en cambio, es lo que este cuerpo sabe hacer: las rodillas se
 * doblan, el tronco se echa hacia atrás y el personaje pasa por debajo del
 * pórtico mirando al techo. Ninguna articulación sale de su rango, se lee de
 * un vistazo desde atrás —el sombrero se ladea y aparece la cara— y encima
 * cuenta lo mismo que la voltereta contaba: que ahí no cabía de pie.
 *
 * @param {number} factor 0 = erguido, 1 = tumbado del todo hacia atrás
 */
/**
 * EL ROL HACIA ADELANTE — la voltereta con la que se pasa por debajo.
 *
 * Antes esto era un LIMBO: el personaje se echaba hacia atrás doblando la
 * cintura y pasaba por debajo del pórtico deslizándose. Funcionaba y no se
 * leía: de espaldas, un cuerpo echado atrás y uno de pie tienen el mismo
 * contorno, y lo único que decía «me agaché» era que la cabeza bajaba unos
 * centímetros. En el género no se hace eso —se rueda—, y una voltereta se lee
 * desde cualquier ángulo porque el cuerpo entero DA UNA VUELTA.
 *
 * Son dos cosas a la vez:
 *
 *   EL OVILLO. Rodillas al pecho, talones al culo, brazos abrazando y barbilla
 *   dentro. Sin esto la vuelta es la de un palo y se ve el momento en que el
 *   personaje atraviesa el suelo con la cabeza.
 *
 *   LA VUELTA, y aquí está el detalle. Un cuerpo gira alrededor del centro del
 *   ovillo, no de los pies, pero el origen de esta malla está EN LOS PIES: si
 *   se rota `cuerpo` y ya está, el muñeco barre el suelo con la cabeza como
 *   una guadaña. Se compensa moviendo el cuerpo por la diferencia entre dónde
 *   acaba el centro y dónde tenía que quedarse:
 *
 *       C = (0, h, 0)      el centro del ovillo, a media altura
 *       R·C = (0, h·cosθ, h·senθ)
 *       T = C − R·C        lo que hay que desplazar para que C no se mueva
 *
 * @param {number} factor  0..1, cuánto de la pose. Suaviza la entrada y la
 *                         salida para que no haya un salto de fotograma.
 * @param {number} avance  0..1, por dónde va la vuelta. A 0 y a 1 el giro es
 *                         nulo, así que empieza y termina de pie sin costura.
 */
export function aplicarPoseAgachadoGLB(modelo, factor, avance = 0) {
  const g = modelo.userData.glb;
  if (!g) return;
  const { huesos, cuerpo } = g;

  cuerpo.rotation.set(0, 0, 0);
  cuerpo.position.set(0, 0, 0);
  cuerpo.scale.setScalar(1);

  const f = Math.min(1, Math.max(0, factor));
  if (f <= 0.001) { sueltaElClip(g); return; }

  // EL ROL DE MIXAMO, SI ESTÁ. Mismo trato que el salto: la aguja se pone
  // donde diga `avance`, no se reproduce a su ritmo, porque la agachada del
  // juego dura 0,55 s y el clip 1,17 s. El peso va con `factor`, así que la
  // entrada y la salida se mezclan con lo que hubiera antes en vez de saltar
  // de una pose a otra en un fotograma.
  const accion = mandaElClip(g, 'rol', f);
  if (accion) {
    accion.time = accion.getClip().duration * Math.max(0, Math.min(1, avance));
    accion.timeScale = 0;
    cuerpo.rotation.set(0, 0, 0);
    cuerpo.position.set(0, 0, 0);
    g.mezclador.update(0);
    return;
  }

  sueltaElClip(g);
  orientar(modelo);
  reposar(huesos);

  // --- EL OVILLO ----------------------------------------------------------
  // La cadera baja: en una voltereta el cuerpo se recoge antes de girar, y si
  // no baja el personaje rueda a la altura a la que iba corriendo.
  const cadera = huesos.get('Hips');
  if (cadera) cadera.nodo.position.y = cadera.pos.y * (1 - 0.44 * f);

  // El tronco se cierra HACIA ADELANTE —al revés que el limbo de antes— y la
  // barbilla se mete dentro. Recuérdese que `Spine02` es la base.
  doblar(huesos, 'Spine02', -0.55 * f);
  doblar(huesos, 'Spine01', -0.45 * f);
  doblar(huesos, 'Spine', -0.35 * f);
  doblar(huesos, 'Head', -0.75 * f);

  for (const lado of ['Left', 'Right']) {
    // Rodillas al pecho y talones al culo.
    doblar(huesos, `${lado}UpLeg`, -1.55 * f);
    doblar(huesos, `${lado}Leg`, 2.05 * f);
    doblar(huesos, `${lado}Foot`, -0.35 * f);
    // Y las piernas juntas: en el aire se abren solas y el ovillo deja de
    // serlo. Se cierran un poco hacia dentro.
    const signo = lado === 'Left' ? 1 : -1;
    girar(huesos, `${lado}UpLeg`, EJE_Z, -signo * 0.12 * f);
    // Brazos abrazando las espinillas.
    brazo(huesos, lado, 1.55 * f, -1.35 * f, -2.35 * f);
  }

  // --- LA VUELTA ----------------------------------------------------------
  const a = Math.min(1, Math.max(0, avance));
  // Suavizado: arranca y termina despacio, y en medio se va. Una vuelta a
  // velocidad constante se lee como una animación mecánica; ésta se lee como
  // un impulso.
  const suave = a * a * (3 - 2 * a);
  const giro = -Math.PI * 2 * suave * f;

  // El centro del ovillo, proporcional a la estatura: los personajes miden
  // entre 1,45 y 1,85 y una altura fija dejaría a unos rodando por el aire y a
  // otros clavados en el asfalto.
  const alto = modelo.userData.medidas?.alto ?? 1.7;
  // 0.31: MEDIDO, no elegido. El extremo más lejano del ovillo —el ala del
  // sombrero— queda a unos 50 cm del centro, así que con el centro más bajo
  // que eso la cabeza pasa POR DEBAJO del asfalto en el punto bajo de la
  // vuelta. Se vio en la tira de fotogramas: a 0.24 el sombrero desaparecía
  // dentro de la calle durante dos fotogramas.
  const h = alto * 0.31;

  cuerpo.rotation.x = giro;
  cuerpo.position.set(0, h - h * Math.cos(giro), -h * Math.sin(giro));
}

/** Despatarrado boca abajo: la pose de que lo tumbaron. */
export function poseDerrotaGLB(modelo) {
  const g = modelo.userData.glb;
  if (!g) return;
  sueltaElClip(g);
  const { huesos, cuerpo } = g;
  orientar(modelo);
  reposar(huesos);
  cuerpo.rotation.x = 0;
  cuerpo.position.set(0, 0, 0);
  cuerpo.scale.setScalar(1);

  // Brazos y piernas ABIERTOS, que es lo que dice «cayó». Se abren sobre el
  // eje de avance, no sobre el de siempre, porque el cuerpo va tumbado.
  // Los brazos se quedan casi en cruz —que es la pose de reposo del archivo—
  // porque un cuerpo tumbado con los brazos abiertos se lee como caído, y uno
  // con los brazos pegados al cuerpo se lee como de pie visto raro.
  brazo(huesos, 'Left', 0.25, -0.5, -0.5);
  brazo(huesos, 'Right', 0.25, -0.5, -0.5);
  for (const [nombre, angulo] of [
    ['LeftUpLeg', -0.3], ['RightUpLeg', 0.3], ['LeftLeg', 0.45], ['RightLeg', 0.45],
    ['Spine', -0.15], ['Head', -0.4],
  ]) doblar(huesos, nombre, angulo);
}

/**
 * Pose de la entrevista: de perfil, con el micrófono en alto.
 *
 * Es la única pose que además de colocar huesos necesita DEVOLVER uno: el
 * micrófono se cuelga de la mano, y quien lo cuelga (la cinemática) no tiene
 * por qué saber cómo se llaman los huesos de este esqueleto.
 *
 * @returns {THREE.Bone|null} la mano que sostiene el micrófono
 */
export function poseEntrevistaGLB(modelo, tiempo, intensidad = 1) {
  const g = modelo.userData.glb;
  if (!g) return null;
  const { huesos } = g;
  const k = Math.min(1, Math.max(0, intensidad));

  // EL MICRÓFONO ES UNA ANTORCHA. El clip se bajó de Mixamo como «torch idle»
  // porque sostener una antorcha y sostener un micrófono son el mismo gesto:
  // el brazo derecho adelantado a la altura del pecho, el puño cerrado, y el
  // peso cambiando de pie cada tantos segundos. Lo que se le cuelga al puño ya
  // es cosa de la cinemática.
  //
  // Y `intensidad` deja de ser «cuánto de la pose» para ser un FUNDIDO: a 1
  // está entrevistando, a 0 ya está corriendo, y por el medio se mezclan los
  // dos clips. Ese medio es la fase en la que la cámara retrocede y aparecen
  // los perseguidores, y antes era la pose escrita a mano desvaneciéndose
  // hacia la cruz de reposo —el personaje se quedaba blando un segundo—.
  if (tocarClips(g, { microfono: k, arrancar: 1 - k }, tiempo)) {
    return huesos.get('RightHand')?.nodo ?? null;
  }

  sueltaElClip(g);
  orientar(modelo);
  reposar(huesos);
  g.cuerpo.rotation.x = 0;
  g.cuerpo.position.set(0, 0, 0);
  g.cuerpo.scale.setScalar(1);

  // El brazo del micrófono, extendido y con el pulso de quien lleva rato
  // aguantándolo. El otro cuelga.
  const pulso = Math.sin(tiempo * 2.4) * 0.07;
  brazo(huesos, 'Right', 1.25 * k, (-0.5 + pulso) * k, -1.15 * k);
  brazo(huesos, 'Left', 1.42 * k, 0.15 * k, -0.5 * k);

  // Quieto, con el peso repartido: no está corriendo todavía.
  doblar(huesos, 'LeftUpLeg', 0.12 * k);
  doblar(huesos, 'RightUpLeg', -0.16 * k);
  doblar(huesos, 'LeftLeg', 0.08 * k);
  doblar(huesos, 'RightLeg', 0.12 * k);
  doblar(huesos, 'Spine', -0.05 * k);

  return huesos.get('RightHand')?.nodo ?? null;
}

/**
 * EL MINISTRO, DE PIE, esperando a que la pregunta termine.
 *
 * No corre nunca: sale en la cinemática y en la portada, plantado. Su pose es
 * la única que no viene del ciclo de carrera, así que se escribe entera —y con
 * el asentimiento incluido, que es lo único que lo distingue de un maniquí.
 */
export function poseMinistroGLB(modelo, tiempo = 0, presencia = 1) {
  const g = modelo.userData.glb;
  if (!g) return;
  const { huesos } = g;
  const k = Math.min(1, Math.max(0, presencia));

  // EL ENTREVISTADO NO ESTÁ QUIETO: primero suelta algo en confianza y después
  // se pone a discutir. Son dos clips encadenados —«contar un secreto» de 6 s
  // y «discutir de pie» de 20,8— y se alternan por reloj.
  //
  // El orden es el chiste, y por eso no se sortea: se acerca a decir algo que
  // no debería, y en cuanto se le repregunta empieza a manotear. En la portada
  // el ciclo entero dura veintisiete segundos, que es tiempo de sobra para que
  // nadie lo vea repetirse.
  const secreto = g.acciones?.secreto;
  const discutir = g.acciones?.discutir;
  if (secreto && discutir) {
    const ciclo = secreto.getClip().duration + discutir.getClip().duration;
    const donde = ((tiempo % ciclo) + ciclo) % ciclo;
    const enSecreto = donde < secreto.getClip().duration;
    // `presencia` va al PESO del clip: mientras se lo llevan, el gesto se
    // desvanece en vez de cortarse. Lo que encoge y aleja al personaje es
    // `_colocarMinistro()`, en la cinemática, y eso no se toca desde aquí.
    tocarClips(g, enSecreto ? { secreto: k } : { discutir: k }, tiempo);
    return;
  }

  sueltaElClip(g);
  orientar(modelo);
  reposar(huesos);
  g.cuerpo.rotation.set(0, 0, 0);
  g.cuerpo.position.set(0, 0, 0);

  // Brazos caídos y las manos por delante, que es como está de pie todo el que
  // espera a que le acaben de preguntar.
  brazo(huesos, 'Left', 1.42 * k, -0.25 * k, -0.85 * k);
  brazo(huesos, 'Right', 1.42 * k, -0.2 * k, -0.8 * k);

  // Peso repartido y una pierna un pelo adelantada.
  doblar(huesos, 'LeftUpLeg', 0.1 * k);
  doblar(huesos, 'RightUpLeg', -0.12 * k);
  doblar(huesos, 'LeftLeg', 0.08 * k);
  doblar(huesos, 'RightLeg', 0.1 * k);

  // Asiente despacio mientras responde.
  doblar(huesos, 'Spine', (-0.04 + Math.sin(tiempo * 0.9) * 0.03) * k);
  doblar(huesos, 'Head', Math.sin(tiempo * 1.7) * 0.09 * k);
}

/**
 * EL QUE VA A CABALLITO: piernas abiertas sobre los hombros del otro y un
 * brazo señalando al frente, que es el gesto de «a ese».
 */
export function poseMontadoGLB(modelo, tiempo = 0) {
  const g = modelo.userData.glb;
  if (!g) return;
  sueltaElClip(g);
  const { huesos } = g;

  orientar(modelo);
  reposar(huesos);
  g.cuerpo.rotation.set(0, 0, 0);
  g.cuerpo.position.set(0, 0, 0);

  // Piernas abiertas y colgando por delante de la cabeza del de abajo.
  for (const lado of ['Left', 'Right']) {
    girar(huesos, `${lado}UpLeg`, EJE_Z, lado === 'Left' ? 0.62 : -0.62);
    doblar(huesos, `${lado}UpLeg`, -0.5);
    doblar(huesos, `${lado}Leg`, 0.85);
  }

  // Un brazo señalando —con su temblor de insistencia— y el otro sujetándose.
  brazo(huesos, 'Right', 0.35, -1.35 + Math.sin(tiempo * 4) * 0.12, -0.2);
  brazo(huesos, 'Left', 1.1, 0.5, -1.1);
  doblar(huesos, 'Spine', -0.12);
}

/** Deja el cuerpo listo para volver a correr. */
export function reposarGLB(modelo) {
  const g = modelo.userData.glb;
  if (!g) return;
  // Primero se sueltan los clips: si alguno se quedara con peso, volvería a
  // escribir los huesos en cuanto alguien llamara al mezclador y la pose de
  // reposo duraría un fotograma.
  sueltaElClip(g);
  reposar(g.huesos);
  g.cuerpo.rotation.set(0, 0, 0);
  g.cuerpo.position.set(0, 0, 0);
  g.cuerpo.scale.setScalar(1);
}

/**
 * La tabla de islas de un modelo, con lo que decide `clasificar()`.
 *
 * Es la herramienta con la que se ajustan las reglas de arriba: los umbrales
 * son medidas de estos dos modelos, no constantes universales, así que cuando
 * llegue un tercero habrá que volver a mirarlo. Se llama a mano desde la
 * consola: `(await import('/src/models/personajeGLB.js')).__islas('avecilla')`.
 */
export function __islas(id) {
  const bruto = crudos.get(id);
  if (!bruto) return null;
  const mapa = islas(bruto.geometria);
  const fichas = fichasDeIslas(bruto.geometria, bruto.huesos, mapa);
  return [...fichas.values()]
    .map((f) => ({
      n: f.n,
      hueso: f.hueso,
      parte: clasificar(f),
      min: f.min.map((v) => +v.toFixed(2)),
      max: f.max.map((v) => +v.toFixed(2)),
      tam: f.tam.map((v) => +v.toFixed(2)),
      centro: f.centro.map((v) => +v.toFixed(2)),
    }))
    .sort((a, b) => b.n - a.n);
}
