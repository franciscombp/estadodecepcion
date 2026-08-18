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
// EL PROBLEMA DEL COLOR, Y CÓMO SE RESUELVE
// ---------------------------------------------------------------------------
// El archivo llega de UN SOLO COLOR: un material blanco, sin texturas y con
// unas UVs que no llevan ninguna imagen detrás. Un personaje gris.
//
// No se le pone una imagen: se le pone color SEGÚN SU MALLA. La malla ya trae
// la información —el sombrero es un trozo de geometría separado del cráneo,
// la mochila es otro, las gafas otro— y lo único que hay que hacer es leerla:
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
// geometría y cada cara lleva su color entero. Cuesta pasar de 2.268 vértices
// a 11.937 —medio megabyte de más en la tarjeta, una vez, para los dos
// personajes— y a cambio los cortes son cortes.
//
// ---------------------------------------------------------------------------
// LO QUE SE LE QUITA
// ---------------------------------------------------------------------------
//   · Las UVs. No hay ninguna imagen que mapear y ocupaban 18 KB por modelo.
//   · El material blanco de fábrica, que se sustituye por uno plano con color
//     por vértice. Un material y una llamada de dibujo por personaje.
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
  avecilla: {
    piel: 0xc98b5e,
    antebrazo: 0xc98b5e,   // Manga corta
    ropa: 0x14b8a6,       // Verde azulado
    pantalon: 0x6a4b85,   // Morado, y claro por lo mismo que el otro pantalón
    zapato: 0x18181f,
    sombrero: 0xd9a441,
    copa: 0xbe8b2e,
    pelo: 0x2b1a12,       // Los rizos
    mochila: 0x1c2028,
    correa: 0x14161c,
    gafas: 0x0a0e17,
    instrumento: 0xd9a441, // El ukelele
  },

  // Los tres que salen del cuerpo del tostadólogo. Sin sombrero ni mochila, lo
  // único que los separa a ocho metros y de espaldas es el color de la ropa y
  // lo que llevan puesto en la cabeza, así que las tres ropas van lo más lejos
  // posible unas de otras: gris azulado, teja y azul marino.
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
  ministro: {
    piel: 0xd8b08c,
    antebrazo: 0x1f2c4a,   // De traje
    ropa: 0x1f2c4a,       // Traje azul
    pantalon: 0x2c3a5c,
    zapato: 0x18181f,
    pelo: 0x241a12,
    gafas: 0x0a0e17,
  },

  // Los perseguidores van los dos de oscuro y a contraluz: lo que tienen que
  // leerse desde ocho metros por delante es una silueta, no una cara.
  perseguidorAbajo: {
    piel: 0xc08a5e,
    antebrazo: 0x1f2333,
    ropa: 0x1f2333,       // Traje oscuro
    pantalon: 0x232838,
    zapato: 0x141414,
    pelo: 0x1a1410,
    gafas: 0x0a0e17,
  },
  perseguidorArriba: {
    piel: 0xe0b088,
    antebrazo: 0xf2f2f2,
    ropa: 0xf2f2f2,       // Camisa blanca
    pantalon: 0x2a3550,
    zapato: 0x141414,
    pelo: 0x241a12,
    gafas: 0x0a0e17,
  },
};

// ---------------------------------------------------------------------------
// LA REDACCIÓN
// ---------------------------------------------------------------------------
// Llegaron DOS modelos y hacen falta CINCO personajes. El resto se saca del
// mismo cuerpo que el tostadólogo, que es lo que hace que todos tengan el
// mismo estilo: la misma malla, el mismo esqueleto y el mismo ciclo de
// carrera, y encima ni un triángulo más de descarga.
//
// Cada uno declara tres cosas:
//   archivo    de qué .glb sale su cuerpo
//   quitar     qué piezas de ese cuerpo NO lleva. El sombrero de paja y la
//              mochila de prensa son del tostadólogo y de nadie más.
//   accesorios lo suyo, colgado de sus huesos
//
// El ministro sale de aquí también, aunque no sea jugable: se le ve de pie en
// la portada del juego y en la cinemática, al lado del periodista, y era el
// único que quedaba de cajas justo al lado de uno que no.
const REDACCION = {
  tostadologo: { archivo: 'tostadologo' },
  avecilla: { archivo: 'avecilla' },

  buencan: {
    archivo: 'tostadologo',
    quitar: new Set(['sombrero', 'copa', 'mochila', 'correa', 'gafas']),
    accesorios: ponerBuencan,
  },
  monki: {
    archivo: 'tostadologo',
    quitar: new Set(['sombrero', 'copa', 'mochila', 'correa', 'gafas']),
    accesorios: ponerMonki,
  },
  ministro: {
    archivo: 'tostadologo',
    quitar: new Set(['sombrero', 'copa', 'mochila', 'correa', 'gafas']),
    accesorios: ponerMinistro,
  },

  // Los dos que vienen detrás. Salen del mismo cuerpo por lo mismo que los
  // demás, y además porque se les ve TODA la partida por encima del hombro:
  // eran los últimos de cajas, y con los cinco de delante ya modelados
  // cantaban más que nadie.
  perseguidorAbajo: {
    archivo: 'tostadologo',
    quitar: new Set(['sombrero', 'copa', 'mochila', 'correa', 'gafas']),
    accesorios: ponerPerseguidorAbajo,
  },
  perseguidorArriba: {
    archivo: 'tostadologo',
    quitar: new Set(['sombrero', 'copa', 'mochila', 'correa']),
    accesorios: ponerPerseguidorArriba,
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

// Las cotas del cráneo de este modelo, medidas: va de 1.27 a 1.62 de alto y
// mide unos 24 cm de ancho por 26 de fondo. Todo lo que se le pone encima sale
// de aquí, así que si algún día llega otro modelo se cambia en un sitio.
const CRANEO = { y: 1.44, alto: 0.35, ancho: 0.24, fondo: 0.26, coronilla: 1.62 };
const PECHO = { y: 1.12, fondo: 0.11 };

/**
 * BUENCAN — boina, traje y grabadora.
 *
 * OJO CON LA BOINA. Es lo único que lo distingue en el 99% del tiempo de juego
 * —que es de espaldas y a ocho metros—, así que va LADEADA y con rabillo. Una
 * boina puesta recta, a esa distancia, es una tapa.
 */
function ponerBuencan(huesos, modelo) {
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
  bigote.position.set(0, 1.38, CRANEO.fondo / 2 + 0.01);
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
function ponerMonki(huesos, modelo) {
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
  frontal.position.set(0, 1.38, CRANEO.fondo / 2);
  anclar(frontal, cabeza, modelo);

  const nasal = caja(0.05, 0.13, 0.05, PLACA, 0.16);
  nasal.position.set(0, 1.32, CRANEO.fondo / 2);
  anclar(nasal, cabeza, modelo);

  for (const s of [-1, 1]) {
    const carrillera = caja(0.05, 0.15, 0.1, PLACA, 0.16);
    carrillera.position.set(s * (CRANEO.ancho / 2 + 0.01), 1.31, CRANEO.fondo / 2 - 0.06);
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

/** EL DE ABAJO: traje oscuro y corbata chillona. Es el que carga. */
function ponerPerseguidorAbajo(huesos, modelo) {
  const tronco = huesos.get('Spine01')?.nodo ?? huesos.get('Spine')?.nodo;
  const corbata = caja(0.05, 0.22, 0.02, 0xff4f6d, 0.35);
  corbata.position.set(0, PECHO.y, PECHO.fondo + 0.015);
  anclar(corbata, tronco, modelo);

  const camisa = caja(0.1, 0.2, 0.02, 0xd8d4cc, 0.12);
  camisa.position.set(0, PECHO.y + 0.02, PECHO.fondo);
  anclar(camisa, tronco, modelo);
}

/** EL DE ARRIBA: camisa blanca, gafas y el pelo peinado. Va encima. */
function ponerPerseguidorArriba(huesos, modelo) {
  const cabeza = huesos.get('Head')?.nodo;
  const pelo = caja(CRANEO.ancho + 0.02, 0.07, CRANEO.fondo + 0.01, 0x241a12);
  pelo.position.set(0, CRANEO.coronilla - 0.02, -0.01);
  anclar(pelo, cabeza, modelo);

  const tronco = huesos.get('Spine01')?.nodo ?? huesos.get('Spine')?.nodo;
  const corbata = caja(0.045, 0.2, 0.02, 0x9c1f2e, 0.16);
  corbata.position.set(0, PECHO.y, PECHO.fondo + 0.015);
  anclar(corbata, tronco, modelo);
}

/**
 * EL MINISTRO — traje, corbata, insignia y maletín.
 *
 * No es nadie. Es un cargo, y lleva el uniforme de cualquier ministro de
 * cualquier gobierno: ni un rasgo que apunte a una persona concreta. No es
 * timidez, es la regla editorial del proyecto —se satiriza el cargo y el
 * trámite, nunca una cara (ver docs/GUION.md)—.
 */
function ponerMinistro(huesos, modelo) {
  const cabeza = huesos.get('Head')?.nodo;

  // Pelo peinado con raya, en dos bloques de distinta altura.
  const pelo = caja(CRANEO.ancho + 0.02, 0.07, CRANEO.fondo + 0.01, 0x241a12);
  pelo.position.set(0, CRANEO.coronilla - 0.02, -0.01);
  anclar(pelo, cabeza, modelo);
  const copete = caja(0.12, 0.05, 0.2, 0x241a12);
  copete.position.set(-0.05, CRANEO.coronilla + 0.02, -0.01);
  anclar(copete, cabeza, modelo);

  const tronco = huesos.get('Spine01')?.nodo ?? huesos.get('Spine')?.nodo;

  const camisa = caja(0.11, 0.22, 0.02, 0xf4f1e8, 0.2);
  camisa.position.set(0, PECHO.y + 0.02, PECHO.fondo);
  anclar(camisa, tronco, modelo);

  const corbata = caja(0.05, 0.22, 0.02, 0x8a1c2a, 0.16);
  corbata.position.set(0, PECHO.y, PECHO.fondo + 0.015);
  anclar(corbata, tronco, modelo);

  for (const s of [-1, 1]) {
    const solapa = caja(0.075, 0.2, 0.02, 0x16203a);
    solapa.position.set(s * 0.075, PECHO.y + 0.03, PECHO.fondo + 0.005);
    solapa.rotation.z = s * 0.26;
    anclar(solapa, tronco, modelo);
  }

  // La insignia: un cuadradito dorado que no dice de qué es, y ese es el
  // chiste —siempre hay una y nunca se sabe de qué—.
  const insignia = caja(0.035, 0.035, 0.015, 0xd8b45a, 0.5);
  insignia.position.set(0.095, PECHO.y + 0.1, PECHO.fondo + 0.01);
  anclar(insignia, tronco, modelo);

  // Maletín en la mano izquierda.
  const mano = huesos.get('LeftHand')?.nodo;
  const maletin = caja(0.2, 0.16, 0.06, 0x3a2a1c);
  maletin.position.set(0.62, 1.05, 0);
  anclar(maletin, mano, modelo);
  const asa = caja(0.07, 0.03, 0.02, 0x241a12);
  asa.position.set(0.62, 1.14, 0);
  anclar(asa, mano, modelo);
}

// ---------------------------------------------------------------------------
// CARGA
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CORPULENCIA — el achaparrado de los runners
// ---------------------------------------------------------------------------
// El modelo viene con proporciones de persona: siete cabezas y media, cuello,
// brazos largos. Los corredores de este género no son así, y no por descuido:
// son cabezones y rechonchos —tres cabezas y media, sin cuello, miembros
// cortos y gruesos, manos y pies grandes— porque a la escala a la que se ven,
// con el personaje ocupando un dieciochoavo de la pantalla y de espaldas, lo
// único que se lee es la SILUETA. Una figura realista a ese tamaño es un palo
// con una bola encima; una achaparrada tiene contorno reconocible incluso a
// veinte píxeles de alto.
//
// CÓMO SE APLICA, que es la parte que tiene truco. El clip de carrera del
// archivo anima posición, rotación Y ESCALA de los veinticuatro huesos, así
// que cualquier cambio escrito en el esqueleto lo pisa el mezclador en el
// siguiente fotograma. Así que la corpulencia se HORNEA: se reescriben las
// pistas del clip una vez al cargar, y de paso el esqueleto en reposo. A
// partir de ahí no cuesta nada por fotograma y lo heredan todas las poses
// escritas a mano —salto, limbo, entrevista— sin tener que tocarlas.
//
// EL EJE LARGO DE CADA HUESO ES SU +Y: en este esqueleto todos los hijos
// cuelgan en (0, N, 0) del padre. Eso permite separar limpiamente GRUESO de
// LARGO, que es justo lo que hace falta para engordar sin estirar.
//
// Las escalas son ABSOLUTAS (respecto al personaje, no al padre) y uniformes.
// Uniformes a propósito: una escala no uniforme en un padre CIZALLA la malla
// del hijo en cuanto el hijo rota, y estos huesos rotan todo el rato. El
// acortamiento no se hace aplastando el hueso, sino acercando al hijo.
const CORPULENCIA = {
  // hueso: [escala absoluta, largo del segmento que sale de él]
  Hips: [1.0, 1.0],

  // El tronco: más ancho y algo más corto. Los tres Spine se reparten el
  // ensanchado para que no haya un escalón entre la cintura y el pecho.
  Spine02: [1.20, 0.94],
  Spine01: [1.26, 0.94],
  Spine: [1.26, 0.90],

  // SIN CUELLO. Es la pieza que más delata a un modelo realista: en cuanto la
  // cabeza crece, seis centímetros de cuello la dejan flotando como un globo
  // atado. Al 30 % la cabeza se apoya en los hombros.
  neck: [1.0, 0.30],

  // LA CABEZA, que es el cambio que más se nota de los diez, y el que hay que
  // frenar antes de tiempo. La referencia va a tres cabezas y media, pero aquí
  // el sombrero de paja está cosido a este hueso y crece con él: a 1.45 el ala
  // era más ancha que los hombros y tapaba el torso entero visto de espaldas,
  // que es como se ve el 95 % de la partida. A 1.26 el personaje pasa de siete
  // cabezas y media a poco menos de seis, se lee claramente cabezón, y el ala
  // sigue dejando ver la mochila y el braceo.
  Head: [1.26, 1.0],

  // Brazos: cortos y gruesos. El hombro se ensancha primero para que el brazo
  // no salga de un torso más estrecho que él.
  // El hombro se ensancha pero NO se separa del tronco: alejar el nacimiento
  // del brazo estira la manga y deja un triángulo de tela colgando entre el
  // costado y el bíceps. Ancho sí, envergadura no.
  LeftShoulder: [1.30, 1.0],
  RightShoulder: [1.30, 1.0],
  LeftArm: [1.34, 0.84],
  RightArm: [1.34, 0.84],
  LeftForeArm: [1.30, 0.84],
  RightForeArm: [1.30, 0.84],
  // Manos grandes: en las siluetas del género son casi manoplas, y a esta
  // escala son lo que hace que se lea el braceo.
  LeftHand: [1.55, 1.0],
  RightHand: [1.55, 1.0],

  // Piernas: lo mismo, un poco más marcado. Acortarlas es lo que baja el
  // centro de gravedad y da el aire achaparrado.
  LeftUpLeg: [1.42, 0.80],
  RightUpLeg: [1.42, 0.80],
  LeftLeg: [1.34, 0.82],
  RightLeg: [1.34, 0.82],
  LeftFoot: [1.40, 1.05],
  RightFoot: [1.40, 1.05],
  LeftToeBase: [1.40, 1.0],
  RightToeBase: [1.40, 1.0],
};

/** La escala absoluta que le toca a un hueso, con 1 por defecto. */
function escalaDe(nombre) {
  return CORPULENCIA[nombre]?.[0] ?? 1;
}

/**
 * El factor local de un hueso: lo que hay que escribir en `scale` para que su
 * escala ABSOLUTA salga la de la tabla, contando lo que ya hereda del padre.
 */
function factorLocal(nodo) {
  const padre = nodo.parent?.isBone ? escalaDe(nodo.parent.name) : 1;
  return escalaDe(nodo.name) / padre;
}

/**
 * El factor de posición de un hueso. Un hijo situado en `p` acaba a `p * Ap`
 * del padre, donde `Ap` es la escala absoluta del padre; para que el segmento
 * mida `L` veces lo que medía, hay que escribir `p * L / Ap`.
 *
 * El largo lo manda el PADRE, porque el segmento es la distancia del padre al
 * hijo: acortar el muslo es acercar la rodilla a la cadera.
 */
function factorPosicion(nodo) {
  if (!nodo.parent?.isBone) return 1;      // la raíz lleva el movimiento
  const padre = nodo.parent.name;
  return (CORPULENCIA[padre]?.[1] ?? 1) / escalaDe(padre);
}

/**
 * Aplica la corpulencia a los huesos, para la pose de reposo, y DEVUELVE
 * cuánto hay que bajar la cadera para que los pies vuelvan al suelo.
 *
 * Acortar las piernas sin bajar la cadera deja al personaje FLOTANDO: la
 * cadera sigue a la altura de siempre y el pie ya no llega. Con estos factores
 * son trece centímetros, o sea el personaje corriendo por el aire un palmo por
 * encima del asfalto, y eso a esta escala se ve enseguida aunque no se sepa
 * decir qué falla.
 *
 * La bajada NO se calcula a mano: se mide el pie antes y después, y se resuelve
 * cuánto vale una unidad local de cadera moviéndola una y volviendo a medir.
 * Así sigue saliendo bien aunque mañana se cambien los factores de la tabla.
 */
function engordarEsqueleto(raiz) {
  const punto = new THREE.Vector3();
  const dedo = [];
  raiz.traverse((o) => { if (o.isBone && /ToeBase|Foot/.test(o.name)) dedo.push(o); });
  const suelo = () => {
    raiz.updateWorldMatrix(true, true);
    return Math.min(...dedo.map((o) => o.getWorldPosition(punto).y));
  };

  const antes = dedo.length ? suelo() : null;

  raiz.traverse((o) => {
    if (!o.isBone) return;
    o.scale.multiplyScalar(factorLocal(o));
    o.position.multiplyScalar(factorPosicion(o));
  });

  if (antes === null) return 0;

  // Cuánto sube el pie por unidad local de cadera.
  const conCero = suelo();
  raiz.position.y += 1;
  const conUna = suelo();
  raiz.position.y -= 1;
  const porUnidad = conUna - conCero;
  if (!Number.isFinite(porUnidad) || Math.abs(porUnidad) < 1e-9) return 0;

  const bajada = (antes - conCero) / porUnidad;
  raiz.position.y += bajada;
  return bajada;
}

/**
 * Y a las pistas del clip, que es lo que de verdad manda mientras se corre.
 *
 * Se reescriben los valores en sitio. El clip es de este personaje y de nadie
 * más —cada uno reinterpreta el archivo por su cuenta, ver `cargarUno`— así
 * que no hay riesgo de engordar a otro dos veces.
 */
function engordarClip(clip, huesosPorNombre, bajadaCadera = 0) {
  for (const pista of clip.tracks) {
    const nombre = pista.name.split('.')[0].replace(/^.*\//, '');
    const tipo = pista.name.split('.').pop();
    const nodo = huesosPorNombre.get(nombre);
    if (!nodo) continue;

    const f = tipo === 'scale' ? factorLocal(nodo)
      : tipo === 'position' ? factorPosicion(nodo)
        : 0;
    // La cadera lleva el movimiento del clip, así que su posición no se escala
    // —eso movería la zancada entera— pero sí hay que BAJARLA lo mismo que se
    // bajó en reposo, o el mezclador devuelve al personaje al aire en el primer
    // fotograma. Solo la componente Y, que en estas pistas va en el índice 1
    // de cada terna.
    if (tipo === 'position' && !nodo.parent?.isBone && bajadaCadera) {
      for (let i = 1; i < pista.values.length; i += 3) pista.values[i] += bajadaCadera;
      continue;
    }

    if (!f || f === 1) continue;

    for (let i = 0; i < pista.values.length; i++) pista.values[i] *= f;
  }
}

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
  piel.geometry = pintar(piel.geometry, piel.skeleton.bones, paleta, ficha.quitar);
  piel.material = material({
    vertexColors: true,
    roughness: 0.68,
    metalness: 0.0,
    flatShading: true,
  });
  // Se ve de espaldas y a contraluz media partida: sin esto, cualquier giro
  // de cámara que lo pille de lado enseña el interior de la malla.
  piel.frustumCulled = false;

  // LA CORPULENCIA, horneada aquí y una sola vez. Va después de pintar —no
  // toca los colores— y antes de guardar, para que todas las copias salgan ya
  // rechonchas y ninguna pose escrita a mano tenga que enterarse.
  const porNombre = new Map();
  escena.traverse((o) => { if (o.isBone) porNombre.set(o.name, o); });
  const raizHueso = piel.skeleton.bones.find((b) => !b.parent?.isBone);
  const bajada = raizHueso ? engordarEsqueleto(raizHueso) : 0;
  for (const clip of gltf.animations) engordarClip(clip, porNombre, bajada);

  cargados.set(id, { escena, clips: gltf.animations, paleta, accesorios: ficha.accesorios });
  return true;
}

/**
 * Carga los modelos. Se llama una vez, desde la pantalla de carga.
 * Si alguno falla, ese personaje se queda con su versión de cajas y ya está:
 * el juego no depende de que el archivo esté.
 */
export function cargarPersonajesGLB(base = '/') {
  if (promesaCarga) return promesaCarga;
  promesaCarga = Promise.all(
    Object.keys(REDACCION).map((id) => cargarUno(id, base).catch((e) => {
      console.warn(`[Personajes] Sin modelo para ${id}, se usa el procedural.`, e);
      return false;
    })),
  );
  return promesaCarga;
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
    fuente.accesorios(esqueleto.huesos, cuerpo, fuente.paleta);
  }

  const mezclador = new THREE.AnimationMixer(cuerpo);
  const correr = fuente.clips[0] ? mezclador.clipAction(fuente.clips[0]) : null;
  if (correr) correr.play();
  mezclador.update(0);

  grupo.userData.glb = { mezclador, correr, cuerpo, ...esqueleto };
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
export function animarCarreraGLB(modelo, dt, velocidad = 20) {
  const g = modelo.userData.glb;
  if (!g) return;
  g.mezclador.update(dt * (0.62 + velocidad / 46));
  // EL MENEO VA DESPUÉS DEL MEZCLADOR, siempre.
  //
  // El mezclador reescribe la rotación de todos los huesos que el clip toca,
  // cada fotograma y sin preguntar. Cualquier cosa que se le sume antes se
  // pierde entera. Llamando aquí —justo detrás— la cabeza y el tronco parten
  // de la zancada que acaba de escribir el clip y le añaden el retraso.
  menear(dt);
}

/**
 * Pose de salto. Se para el mezclador —si no, machacaría los huesos en el
 * fotograma siguiente— y se coloca el cuerpo a mano.
 * @param {number} subida +1 despegando, 0 en lo alto, −1 cayendo.
 */
export function animarSaltoGLB(modelo, subida = 0) {
  const g = modelo.userData.glb;
  if (!g) return;
  const { huesos } = g;
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
  const avance = -0.9 - 0.5 * sube + 1.2 * cae;
  for (const lado of ['Left', 'Right']) {
    brazo(huesos, lado, 1.25, avance, -0.5 - 0.5 * sube);
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
export function aplicarPoseAgachadoGLB(modelo, factor) {
  const g = modelo.userData.glb;
  if (!g) return;
  const { huesos, cuerpo } = g;

  cuerpo.rotation.x = 0;
  cuerpo.position.set(0, 0, 0);
  cuerpo.scale.setScalar(1);

  const f = Math.min(1, Math.max(0, factor));
  if (f <= 0.001) return;

  orientar(modelo);
  reposar(huesos);

  // La cadera baja y se adelanta: el peso se va sobre los pies y por eso el
  // tronco puede irse atrás sin caerse. Sin bajarla, el personaje se dobla
  // hacia atrás por la cintura y se queda igual de alto, que es justo lo que
  // no vale bajo un pórtico.
  const cadera = huesos.get('Hips');
  if (cadera) {
    cadera.nodo.position.y = cadera.pos.y * (1 - 0.42 * f);
    cadera.nodo.position.z = cadera.pos.z + 22 * f;   // centímetros: ver la nota de escala
  }

  // Tronco y cabeza atrás; la barbilla acaba mirando al pórtico que pasa.
  doblar(huesos, 'Hips', -0.85 * f);
  doblar(huesos, 'Spine', -0.3 * f);
  doblar(huesos, 'Spine01', -0.25 * f);
  doblar(huesos, 'Head', -0.55 * f);

  for (const lado of ['Left', 'Right']) {
    // Rodillas dobladas y pies por delante, que es lo que sostiene el arco.
    doblar(huesos, `${lado}UpLeg`, -0.55 * f);
    doblar(huesos, `${lado}Leg`, 1.25 * f);
    doblar(huesos, `${lado}Foot`, -0.45 * f);
    // Brazos abiertos hacia atrás, de contrapeso.
    brazo(huesos, lado, 0.75 * f, 0.9 * f, -0.35 * f);
  }
}

/** Despatarrado boca abajo: la pose de que lo tumbaron. */
export function poseDerrotaGLB(modelo) {
  const g = modelo.userData.glb;
  if (!g) return;
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
