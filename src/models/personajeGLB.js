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
};

// Qué archivo es cada quién. Los personajes que no están aquí siguen siendo
// procedurales (ver characters.js): no hay modelo suyo, y media redacción de
// cajas junto a dos modelados es peor que las cinco de cajas.
const ARCHIVOS = {
  tostadologo: 'tostadologo',
  avecilla: 'avecilla',
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
  // Antebrazo y mano van descubiertos; del codo para arriba, manga.
  if (/Hand|ForeArm/.test(hueso)) return 'piel';
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
function pintar(geometria, huesos, paleta) {
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
  const ind = geometria.attributes.skinIndex;
  const pes = geometria.attributes.skinWeight;
  const suelta = geometria.toNonIndexed();
  const colores = new Float32Array(suelta.attributes.position.count * 3);
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
      const o = (t + v) * 3;
      colores[o] = c.r; colores[o + 1] = c.g; colores[o + 2] = c.b;
    }
  }

  suelta.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  // Las UVs no llevan ninguna imagen detrás: fuera.
  suelta.deleteAttribute('uv');
  suelta.deleteAttribute('uv1');
  suelta.computeVertexNormals();
  return suelta;
}

// ---------------------------------------------------------------------------
// CARGA
// ---------------------------------------------------------------------------

const cargados = new Map();
// La geometría ORIGINAL (indexada, sin pintar) de cada modelo. Solo la usa
// `__islas()`, que es como se miden las reglas de clasificación.
const crudos = new Map();
let promesaCarga = null;

async function cargarUno(id, base) {
  const gltf = await new GLTFLoader().loadAsync(`${base}modelos/personajes/${ARCHIVOS[id]}.glb`);

  let piel = null;
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !piel) piel = o; });
  if (!piel) throw new Error(`El modelo de ${id} no trae malla con esqueleto`);

  const paleta = PALETAS[id];
  crudos.set(id, { geometria: piel.geometry, huesos: piel.skeleton.bones });
  piel.geometry = pintar(piel.geometry, piel.skeleton.bones, paleta);
  piel.material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.68,
    metalness: 0.0,
    flatShading: true,
  });
  // Se ve de espaldas y a contraluz media partida: sin esto, cualquier giro
  // de cámara que lo pille de lado enseña el interior de la malla.
  piel.frustumCulled = false;

  cargados.set(id, { escena: gltf.scene, clips: gltf.animations, paleta });
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
    Object.keys(ARCHIVOS).map((id) => cargarUno(id, base).catch((e) => {
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

  const mezclador = new THREE.AnimationMixer(cuerpo);
  const correr = fuente.clips[0] ? mezclador.clipAction(fuente.clips[0]) : null;
  if (correr) correr.play();
  mezclador.update(0);

  grupo.userData.glb = { mezclador, correr, cuerpo, ...esqueleto };
  grupo.userData.nombre = id;
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

/**
 * Gira un hueso sobre un eje DEL MUNDO, encima de lo que ya tuviera.
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
  _v.copy(eje).applyQuaternion(_qp.invert());
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
  girar(huesos, `${lado}Arm`, EJE_Z, lado === 'Left' ? -bajada : bajada);
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
