// ============================================================================
// RETARGET — pasar una animación de un esqueleto a otro
// ============================================================================
// Esto empezó siendo sólo para Mixamo (`src/creador/mixamo.js`, que sigue
// siendo quien lee los .fbx) y acabó haciendo falta DENTRO DEL JUEGO, así que
// vive aquí, sin dependencias de cargadores.
//
// EL MOTIVO DE LA MUDANZA: los clips horneados están puestos sobre el
// esqueleto del tostadólogo, y los nueve personajes NO tienen el mismo reposo.
// Medido hueso a hueso contra él: avecilla y genérico se separan entre 2° y
// 14°, pero el mando, el antidisturbias y los dos del dúo tienen la cadera y
// los fémures a MÁS DE CIENTO VEINTE GRADOS. Con las rotaciones locales
// compartidas tal cual, esos cuatro corrían hechos un ovillo: el policía
// pasaba de 1,70 m de estatura a 1,21, con la cabeza treinta centímetros más
// abajo que en reposo y los pies a diecisiete centímetros del suelo.
//
// O sea: exactamente el mismo problema que ya se había resuelto para traer los
// clips de Mixamo, pero entre dos esqueletos nuestros. Misma solución.
// ============================================================================
// EL ESQUELETO DE NUESTROS PERSONAJES ES EL DE MIXAMO, hueso por hueso: los
// mismos veinticuatro nombres, sin el prefijo `mixamorig:` y con la columna
// numerada al revés (nuestro `Spine02` cuelga de la cadera; el suyo se llama
// `Spine`, y el de arriba `Spine2`). Meshy usa esa convención porque se ha
// vuelto el estándar. Así que las animaciones de Mixamo se pueden traer sin
// subir nada: se baja el ciclo puesto sobre su propio muñeco —«without skin»,
// que son cuatrocientos kilobytes de huesos y nada más— y se pasa aquí.
//
// ---------------------------------------------------------------------------
// POR QUÉ NO SE USA `SkeletonUtils.retargetClip`
// ---------------------------------------------------------------------------
// Se probó, con un .fbx de Mixamo de verdad, y sale un muñeco APLASTADO. En
// las cinco combinaciones de sus opciones —por defecto, `preserveBonePositions`
// false, `preserveBoneMatrix` false, `useTargetMatrix` true, las dos false— y
// también renombrando las pistas a pelo sin retargetear nada, la cabeza acaba
// a 0,40 m y el pie izquierdo a 0,51 m: LA CABEZA POR DEBAJO DEL PIE, cuando
// en reposo la cabeza está a 1,31 m.
//
// El motivo es que los NOMBRES coinciden pero los EJES no. Un hueso no guarda
// una dirección, guarda una rotación respecto a su padre, y «cero» significa
// cosas distintas en cada esqueleto: el fémur de Mixamo en reposo mira a un
// sitio y el nuestro a otro. Copiar la rotación local de uno al otro es como
// copiar «gira 30° a la derecha» entre dos coches que no apuntan al mismo
// lado.
//
// ---------------------------------------------------------------------------
// LO QUE SÍ FUNCIONA: PASAR POR EL MUNDO
// ---------------------------------------------------------------------------
// Lo que hay que copiar no es la rotación local sino la ORIENTACIÓN EN EL
// MUNDO, corrigiendo por la diferencia entre las dos poses de reposo:
//
//     Δ            = inv(reposoMundoOrigen) · reposoMundoDestino
//     mundoDestino = mundoOrigen · Δ
//     localDestino = inv(mundoPadreDestino) · mundoDestino
//
// Δ se calcula UNA VEZ, con los dos esqueletos en reposo: es «cuánto hay que
// girar el hueso de Mixamo para que apunte donde apunta el nuestro». A partir
// de ahí, cada fotograma se pregunta al origen hacia dónde mira su hueso en el
// mundo, se le aplica Δ, y se convierte a local contra el padre —el padre YA
// recalculado en este mismo fotograma, por eso los huesos se recorren de la
// cadera hacia afuera y no en cualquier orden—.
//
// La CADERA es aparte, porque además de girar se mueve. Se copia su
// desplazamiento respecto a su propio reposo, escalado por la diferencia de
// estatura: Mixamo mide en centímetros y sus muñecos son más altos, así que
// sin ese factor el personaje pega botes de cuarenta metros.
// ============================================================================

import { AnimationClip, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3,
  VectorKeyframeTrack, AnimationMixer } from 'three';

/**
 * La columna, que es lo único cuyos NOMBRES no coinciden.
 *
 * Nuestro (de la cadera hacia arriba): Spine02 → Spine01 → Spine
 * El de Mixamo:                        Spine   → Spine1  → Spine2
 */
export const COLUMNA = { spine02: 'spine', spine01: 'spine1', spine: 'spine2' };

/**
 * Y el diccionario VACÍO, para cuando los dos esqueletos son nuestros.
 *
 * Hace falta desde que el juego retargetea de un personaje a otro: con el
 * diccionario de Mixamo puesto, nuestro `Spine02` se emparejaba con el `Spine`
 * del otro —que es el de ARRIBA— y la columna salía del revés. Un mapa vacío
 * dice «los nombres ya coinciden, empareja a pelo».
 */
export const MISMO = {};

/**
 * Un nombre de hueso, venga como venga, reducido a lo comparable.
 *
 * Llega de tres formas según por dónde pase: `mixamorig:Hips` en el archivo,
 * `mixamorigHips` después de que `FBXLoader` lo pase por
 * `PropertyBinding.sanitizeNodeName` —que se come los dos puntos—, y `Hips` a
 * secas si alguien lo limpió antes.
 */
function normalizar(nombre) {
  return String(nombre)
    .replace(/^mixamorig[:_]?/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/** Los huesos de una malla con piel, de un esqueleto o de un árbol cualquiera. */
function huesosDe(x) {
  if (Array.isArray(x)) return x;
  // OJO: en un glTF el armazón NO cuelga de la malla con piel —son hermanos—,
  // así que recorrer la malla no encuentra ni un hueso. Se le pide al
  // esqueleto, que es quien los tiene.
  if (x.skeleton) return x.skeleton.bones;
  const fuera = [];
  x.traverse((o) => { if (o.isBone) fuera.push(o); });
  if (fuera.length) return fuera;

  // Y SI NO HAY NI UNO, valen los nodos a secas. Esto no es una red de
  // seguridad teórica: `animaciones.glb` se exporta con los huesos SIN malla
  // —son las pistas y nada más— y sin malla con piel que los reclame,
  // `GLTFExporter` los escribe como nodos normales y `GLTFLoader` los devuelve
  // como `Object3D`. Buscando `isBone` salían cero, el emparejamiento se
  // quedaba vacío y el retargeteo no hacía nada mientras decía que sí.
  x.traverse((o) => { if (o !== x) fuera.push(o); });
  return fuera;
}

/**
 * Empareja los huesos de los dos esqueletos por nombre.
 *
 * @returns {{pares: Array, sinPareja: string[]}} `pares` va ORDENADO de la
 * cadera hacia afuera, que es como hay que recorrerlo al convertir a local.
 */
export function emparejarHuesos(destino, origen, columna = COLUMNA) {
  const suyos = new Map();
  for (const b of huesosDe(origen)) {
    const clave = normalizar(b.name);
    // Los .fbx de Mixamo repiten nombres entre el nodo y su hueso; vale el
    // primero, que es el que anima el clip.
    if (!suyos.has(clave)) suyos.set(clave, b);
  }

  const nuestros = huesosDe(destino);
  const pares = [];
  const sinPareja = [];
  for (const b of nuestros) {
    const clave = normalizar(b.name);
    const suyo = suyos.get(columna[clave] ?? clave);
    if (suyo) pares.push({ nuestro: b, suyo });
    else sinPareja.push(b.name);
  }

  // DE LA CADERA HACIA AFUERA. Convertir la orientación de mundo a local pide
  // el padre ya recalculado, así que un orden arbitrario da un esqueleto que
  // se deshace por tramos —y el error no salta, sólo queda raro—.
  pares.sort((a, b) => profundidad(a.nuestro) - profundidad(b.nuestro));
  return { pares, sinPareja };
}

function profundidad(hueso) {
  let n = 0;
  for (let p = hueso.parent; p && p.isBone; p = p.parent) n++;
  return n;
}

/**
 * Pasa un clip del esqueleto de fuera al nuestro.
 *
 * @param {Object3D} modelo  Un personaje del juego, en su pose de reposo.
 * @param {Object3D} fuente  La escena que salió del `.fbx`, sin animar.
 * @param {AnimationClip} clip
 * @param {{nombre?: string, fps?: number, enElSitio?: boolean}} opciones
 */
export function pasarAlPersonaje(modelo, fuente, clip, opciones = {}) {
  const {
    nombre = clip.name || 'importada', fps = 30, enElSitio = true, columna = COLUMNA,
  } = opciones;

  let piel = null;
  modelo.traverse((o) => { if (o.isSkinnedMesh && !piel) piel = o; });
  if (!piel) throw new Error('Ese personaje no tiene malla con esqueleto');

  const { pares, sinPareja } = emparejarHuesos(piel, fuente, columna);
  const cadera = pares.find((p) => normalizar(p.nuestro.name) === 'hips');
  if (!cadera) throw new Error('No se encontró la cadera: ¿es un esqueleto humanoide?');

  // --- EL REPOSO DE LOS DOS, que es de donde sale Δ ------------------------
  modelo.updateMatrixWorld(true);
  fuente.updateMatrixWorld(true);

  // Y SE APUNTA CÓMO ESTABA LA FUENTE. Muestrear el clip la deja plantada en su
  // último fotograma, y la Δ se calcula contra el REPOSO: encadenar dos
  // llamadas sobre la misma fuente —que es lo que hace el juego, un esqueleto
  // de referencia y diez clips por personaje— daba el segundo clip retargeteado
  // contra el final del primero. No rompía nada visible, sólo salía torcido.
  const reposoFuente = pares.map((p) => ({
    hueso: p.suyo,
    pos: p.suyo.position.clone(),
    quat: p.suyo.quaternion.clone(),
  }));

  const reposo = new Map();
  for (const par of pares) {
    reposo.set(par.nuestro, {
      // Δ: cuánto hay que girar el hueso de fuera para que apunte donde apunta
      // el nuestro. Se calcula una vez y vale para todo el clip.
      delta: mundoQ(par.suyo).invert().multiply(mundoQ(par.nuestro)),
      local: par.nuestro.quaternion.clone(),
    });
  }
  const caderaReposoOrigen = mundoP(cadera.suyo);
  const caderaReposoDestino = cadera.nuestro.position.clone();

  // CUÁNTO SE ENCOGE EL DESPLAZAMIENTO. Los muñecos de Mixamo miden en
  // centímetros y son más altos que los nuestros. El factor sale de comparar a
  // qué altura tiene cada uno la cadera SOBRE SUS PIES, que es la medida que
  // manda en un ciclo de carrera.
  //
  // OJO: no vale la Y de la cadera a secas. El esqueleto de Mixamo está
  // centrado EN LA CADERA, no en el suelo: su cadera está a −8,2 y sus dedos a
  // −99,9. Midiendo así, el factor salía −0,108 —negativo, o sea con el salto
  // invertido— y aun así el personaje parecía casi correcto, que es la clase de
  // error que se queda dentro.
  // LAS UNIDADES DE LA PISTA NO SON METROS. La posición de un hueso se escribe
  // en el sistema de su PADRE, y en estos archivos el armazón viene con escala
  // 0,01 —está modelado en centímetros—: la cadera del tostadólogo está a 0,884
  // m del suelo pero su `position.y` vale 88,4.
  //
  // Costó verlo porque el error no rompe nada: se restaba un desnivel de 0,121
  // (metros) a una pista que va por 88 (centímetros), o sea un 0,14% — el
  // personaje seguía flotando exactamente igual y los números decían que la
  // corrección se había aplicado. Lo mismo con el desplazamiento de la cadera:
  // el salto subía 1,3 cm en vez de 1,3 m.
  const unidad = escalaDelPadre(cadera.nuestro);
  const escala = (alturaDeCadera(pares) / unidad)
    / Math.max(1e-6, alturaDeCaderaOrigen(pares));

  // --- SE MUESTREA EL CLIP -------------------------------------------------
  const mezclador = new AnimationMixer(fuente);
  const accion = mezclador.clipAction(clip);
  accion.play();

  const cuadros = Math.max(2, Math.round(clip.duration * fps) + 1);
  const tiempos = new Float32Array(cuadros);
  const salida = new Map(pares.map((p) => [p.nuestro, new Float32Array(cuadros * 4)]));
  const posCadera = new Float32Array(cuadros * 3);

  const qMundo = new Map();     // la orientación de mundo de CADA hueso nuestro
  const q = new Quaternion();
  const v = new Vector3();
  let cadera0 = null;

  for (let f = 0; f < cuadros; f++) {
    const t = (f / (cuadros - 1)) * clip.duration;
    tiempos[f] = t;

    mezclador.setTime(t);
    fuente.updateMatrixWorld(true);

    for (const par of pares) {
      const { delta } = reposo.get(par.nuestro);
      // mundoDestino = mundoOrigen · Δ
      q.copy(mundoQ(par.suyo)).multiply(delta);
      qMundo.set(par.nuestro, q.clone());

      // localDestino = inv(mundoPadre) · mundoDestino. El padre puede no estar
      // emparejado (o ser la raíz): entonces vale el que ya tiene puesto.
      const padre = par.nuestro.parent;
      const qPadre = qMundo.get(padre) ?? (padre?.isBone ? mundoQ(padre) : new Quaternion());
      const local = qPadre.clone().invert().multiply(q);

      const dest = salida.get(par.nuestro);
      dest[f * 4 + 0] = local.x; dest[f * 4 + 1] = local.y;
      dest[f * 4 + 2] = local.z; dest[f * 4 + 3] = local.w;
    }

    // LA CADERA TAMBIÉN SE MUEVE. Se copia su desplazamiento respecto a su
    // propio reposo, encogido, y se le suma al reposo del nuestro.
    v.copy(mundoP(cadera.suyo)).sub(caderaReposoOrigen).multiplyScalar(escala)
      .add(caderaReposoDestino);
    if (f === 0) cadera0 = v.clone();
    // EN EL SITIO. Los clips de Mixamo traen el avance horneado —«in place» es
    // una casilla que se olvida al bajarlos— y en un runner el personaje no
    // avanza: avanza el mundo. Se le quita el desplazamiento horizontal y se
    // le deja el vertical, que es el que hace que un salto sea un salto.
    posCadera[f * 3 + 0] = enElSitio ? caderaReposoDestino.x : v.x;
    posCadera[f * 3 + 1] = v.y;
    posCadera[f * 3 + 2] = enElSitio ? caderaReposoDestino.z : v.z;
  }

  accion.stop();
  mezclador.uncacheClip(clip);
  for (const g of reposoFuente) {
    g.hueso.position.copy(g.pos);
    g.hueso.quaternion.copy(g.quat);
  }
  fuente.updateMatrixWorld(true);

  const pistas = [];
  for (const [hueso, valores] of salida) {
    pistas.push(new QuaternionKeyframeTrack(`${hueso.name}.quaternion`, tiempos, valores));
  }
  const pistaCadera = new VectorKeyframeTrack(
    `${cadera.nuestro.name}.position`, tiempos, posCadera);
  pistas.push(pistaCadera);

  aplanarPistasQuietas(pistas, cuadros);

  const resultado = new AnimationClip(nombre, clip.duration, pistas);

  // --- Y SE POSA EN EL SUELO -----------------------------------------------
  // La cadera va donde la pone el mocap, y eso deja el ciclo flotando o
  // hundido según cuánto se parezcan las dos estaturas. No se corrige a ojo:
  // se reproduce el clip entero sobre el personaje, se busca el punto MÁS BAJO
  // que alcanza cualquier hueso en cualquier fotograma, y se compara con el
  // punto más bajo que tiene en reposo —la punta del pie—. La diferencia es lo
  // que hay que bajar o subir la cadera.
  //
  // Vale para los tres casos y por la misma razón: en la carrera el más bajo
  // es el pie que apoya, en el salto es el pie en la agachada previa, y en el
  // rol es la espalda al pasar por el suelo. En los tres, ese punto es
  // exactamente el que tiene que rozar el asfalto.
  const desnivel = medirDesnivel(modelo, piel, resultado, pares, cuadros);
  if (Math.abs(desnivel) > 1e-4) {
    // El desnivel se mide en metros y la pista va en unidades del padre.
    const enLaPista = desnivel / unidad;
    for (let f = 0; f < cuadros; f++) posCadera[f * 3 + 1] -= enLaPista;
  }

  return {
    clip: new AnimationClip(nombre, clip.duration, pistas),
    desnivel,
    emparejados: pares.map((p) => p.nuestro.name),
    sinPareja,
    escala,
    cuadros,
    alturaCadera: cadera0 ? cadera0.y : 0,
  };
}

/**
 * Deja en dos claves las pistas que no se mueven.
 *
 * En un ciclo de carrera se mueven los veintidós huesos. En una pose de estar
 * de pie discutiendo, no: los pies no hacen nada en veinte segundos, y guardar
 * seiscientas veinticinco copias del mismo cuaternión son ocho kilobytes por
 * hueso quieto. Se comparan todas las claves con la primera y, si ninguna se
 * separa más de medio grado, la pista se queda con la primera y la última.
 *
 * Medio grado es el umbral porque por debajo de eso no se ve ni con el
 * personaje ocupando la pantalla entera, y porque un mocap real nunca da un
 * hueso EXACTAMENTE quieto: siempre tiembla en el sexto decimal.
 */
function aplanarPistasQuietas(pistas, cuadros) {
  const LIMITE = Math.cos((0.5 * Math.PI / 180) / 2);   // medio grado, en coseno
  for (const pista of pistas) {
    const v = pista.values;
    const anchura = pista.getValueSize();
    if (cuadros < 3) continue;

    let quieta = true;
    for (let f = 1; f < cuadros && quieta; f++) {
      if (anchura === 4) {
        // Cuaterniones: el producto escalar da el coseno de medio ángulo.
        let punto = 0;
        for (let k = 0; k < 4; k++) punto += v[k] * v[f * 4 + k];
        if (Math.abs(punto) < LIMITE) quieta = false;
      } else {
        for (let k = 0; k < anchura; k++) {
          if (Math.abs(v[k] - v[f * anchura + k]) > 1e-4) { quieta = false; break; }
        }
      }
    }
    if (!quieta) continue;

    const t = pista.times;
    pista.times = new Float32Array([t[0], t[cuadros - 1]]);
    const dos = new Float32Array(anchura * 2);
    for (let k = 0; k < anchura; k++) { dos[k] = v[k]; dos[anchura + k] = v[k]; }
    pista.values = dos;
  }
}

/**
 * Cuánto flota (o se hunde) el clip respecto a donde el personaje pisa.
 *
 * Se devuelve la diferencia entre el punto más bajo que alcanza el clip y el
 * punto más bajo del personaje en reposo. Positivo: el clip va alto y hay que
 * bajarlo.
 */
function medirDesnivel(modelo, piel, clip, pares, cuadros) {
  const guardado = pares.map((p) => ({
    hueso: p.nuestro,
    pos: p.nuestro.position.clone(),
    quat: p.nuestro.quaternion.clone(),
  }));

  modelo.updateMatrixWorld(true);
  let enReposo = Infinity;
  for (const p of pares) enReposo = Math.min(enReposo, mundoP(p.nuestro).y);

  const mez = new AnimationMixer(modelo);
  mez.clipAction(clip).play();
  let masBajo = Infinity;
  for (let f = 0; f < cuadros; f++) {
    mez.setTime((f / (cuadros - 1)) * clip.duration);
    modelo.updateMatrixWorld(true);
    for (const p of pares) masBajo = Math.min(masBajo, mundoP(p.nuestro).y);
  }
  mez.stopAllAction();
  mez.uncacheClip(clip);

  // Y se deja al personaje como estaba: reproducir un clip para medirlo lo
  // deja plantado en el último fotograma.
  for (const g of guardado) {
    g.hueso.position.copy(g.pos);
    g.hueso.quaternion.copy(g.quat);
  }
  modelo.updateMatrixWorld(true);

  return masBajo - enReposo;
}

/**
 * A qué altura del suelo tiene la cadera cada esqueleto.
 *
 * El «suelo» es el punto más bajo de los huesos emparejados —la punta del pie—
 * y no el cero del sistema, precisamente porque los dos esqueletos no ponen el
 * cero en el mismo sitio.
 */
function alturaSobreLosPies(caderaNodo, nodos) {
  let masBajo = Infinity;
  for (const n of nodos) masBajo = Math.min(masBajo, mundoP(n).y);
  return mundoP(caderaNodo).y - masBajo;
}

/**
 * Cuántos metros vale una unidad de la posición local de un hueso.
 *
 * Es la escala que arrastra su padre desde la raíz. En estos archivos vale
 * 0,01, porque el armazón viene en centímetros.
 */
function escalaDelPadre(hueso) {
  const padre = hueso.parent;
  if (!padre) return 1;
  padre.updateWorldMatrix(true, false);
  const e = new Vector3();
  padre.matrixWorld.decompose(new Vector3(), new Quaternion(), e);
  return e.y || 1;
}

function alturaDeCadera(pares) {
  const cadera = pares.find((p) => normalizar(p.nuestro.name) === 'hips').nuestro;
  return alturaSobreLosPies(cadera, pares.map((p) => p.nuestro));
}

function alturaDeCaderaOrigen(pares) {
  const cadera = pares.find((p) => normalizar(p.nuestro.name) === 'hips').suyo;
  return alturaSobreLosPies(cadera, pares.map((p) => p.suyo));
}

function mundoQ(nodo) { return nodo.getWorldQuaternion(new Quaternion()); }
function mundoP(nodo) { return nodo.getWorldPosition(new Vector3()); }
