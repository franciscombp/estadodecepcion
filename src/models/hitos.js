// ============================================================================
// HITOS — Los edificios reales de la escena de Quito
// ============================================================================
// El decorado de la calle es procedural y se genera solo (ver crearDecorado).
// Esto es otra cosa: los cuatro EDIFICIOS que el jugador tiene que reconocer
// —el Palacio de Carondelet, la Asamblea, la central térmica y la Fiscalía—
// vienen modelados en un glTF y se colocan al costado de la pista.
//
// POR QUÉ MODELADOS Y NO PROCEDURALES
// Una casa colonial genérica se puede generar con cajas y queda bien; un
// edificio que el jugador tiene que RECONOCER, no. La gracia de correr por el
// centro histórico es ver pasar Carondelet, y eso no sale de un algoritmo de
// fachadas: sale de haberlo modelado.
//
// POR QUÉ SE CARGA UNA VEZ Y SE CLONA
// El archivo entero son 480 KB con casi mil seiscientos nodos, y de ahí solo se
// usan cuatro ramas. Se descarga una vez durante la pantalla de carga, se
// guarda el árbol en memoria y cada escena clona la rama que le toca. Clonar es
// barato porque geometrías y materiales se comparten entre las copias.
//
// SI NO CARGA, NO PASA NADA. El juego es jugable sin los hitos: son decorado.
// Por eso todo esto falla en silencio y devuelve null en vez de reventar el
// arranque por un archivo que no llegó.
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// EL EDIFICIO QUE HAY DE FRENTE EN CADA BIFURCACIÓN.
//
// No es decorado que pasa: es la fachada del cruce, lo que se tiene delante al
// decidir. Cada escenario lleva EL SUYO, el de verdad: la Fiscalía en la
// Bahía, la Asamblea en el Apagón, Carondelet en el centro histórico.
//
// Las Elecciones no tienen: el CNE no está modelado, y poner cualquier otro
// edificio en su sitio sería mentir sobre a dónde estás entrando. Ahí se sigue
// levantando la fachada procedural.
export const EDIFICIO_DEL_CRUCE = {
  bahia: 'fiscalia_general_del_estado',
  apagon: 'asamblea_nacional',
  carondelet: 'palacio_de_carondelet',
};

// LOS HITOS QUE PASABAN DE LARGO YA NO ESTÁN.
//
// Eran los mismos edificios cruzándose cada trescientos metros, y con la
// fachada del cruce puestos DOS VECES: el palacio se veía pasar por el costado
// y volvía a aparecer de frente al bifurcar. Enseñar dos veces el mismo
// edificio en la misma calle no dobla la presencia, la reparte.
//
// Además el sitio dramático del edificio es la bifurcación, no la cuneta: ahí
// es donde significa algo, porque es donde hay que decidir si se entra.

// EL APAGÓN NO TIENE HITO, y no es un olvido. La central térmica no es un
// edificio que se ve pasar: es el sitio donde estás. Pasarla por delante cada
// trescientos metros la convertía en un monumento al que se saluda, cuando lo
// que tiene que ser es la nave dentro de la que corres —el decorado del tramo,
// no un punto de interés—.
//
// Se sigue pudiendo bajar del exportador para editarla en Blender; lo que
// cambia es que ya no entra en la calle como pieza suelta.
export const DECORADO_IMPORTADO = {
  apagon: 'central_termica',
};

// CADA EDIFICIO VIENE DONDE EL MODELADOR LO DEJÓ, y eso no sirve aquí.
//
// El .glb es una maqueta del centro de Quito: dentro del archivo cada edificio
// está en su sitio DE LA CIUDAD, no en el origen. Clonar la rama y ponerla en
// la bifurcación tal cual dejaba a la Fiscalía volando por encima del jugador
// (su geometría se extendía treinta metros hacia la cámara) y a Carondelet a
// setenta metros por detrás del cruce, hecho una mancha en la niebla. Se veía
// «un edificio al fondo» en vez de tener el edificio delante.
//
// Así que la copia se ASIENTA: se mide su caja real y se mueve hasta que la
// fachada quede centrada en la calle, apoyada en el asfalto y con su cara
// frontal justo en el plano del cruce. Lo que hay detrás de esa cara —treinta,
// cincuenta metros de edificio— se va hacia dentro, que es donde no estorba.
//
// Se mide recorriendo los vértices y no con Box3.setFromObject porque hace
// falta la caja DESPUÉS de aplicar el giro, y girar la caja de un objeto no da
// la caja del objeto girado.
const ROTACION_FACHADA = {
  // Hacia dónde mira cada edificio DENTRO DE LA MAQUETA, que es un plano de la
  // ciudad y no una hoja de sprites: cada uno está orientado a la calle a la
  // que da en Quito, no a la cámara. Aquí se le da el cuarto o la media vuelta
  // que hace falta para ponerlo de cara.
  //
  //   · La Asamblea tiene el lado largo en profundidad: de frente se le vería
  //     el costado.
  //   · La Fiscalía mira a −Z —su muro cortina, la marquesina de acceso y los
  //     bolardos están todos en z negativa—, así que sin darle la vuelta lo
  //     que se tiene delante es su medianera trasera: un panel gris liso. Era
  //     exactamente lo que se veía.
  asamblea_nacional: Math.PI / 2,
  fiscalia_general_del_estado: Math.PI,
};

// Por debajo de esta fracción de la altura del edificio, la geometría no cuenta
// para decidir dónde está la fachada. Es lo que separa el EDIFICIO de lo que lo
// rodea: la explanada de la Fiscalía se mete treinta metros hacia la calle y
// los bolardos otros seis, y midiendo la caja entera el «frente» acababa siendo
// el borde de la acera —con el edificio en sí a treinta metros por detrás,
// diluido en la niebla—. Un tercio de la altura deja fuera plazas, aceras,
// bolardos y marquesinas bajas, y deja dentro el cuerpo, el vestíbulo y el
// pórtico de entrada, que es lo que forma la fachada.
const FRACCION_CUERPO = 0.35;

function asentarFachada(objeto, giro = 0) {
  objeto.rotation.y = giro;
  objeto.updateMatrixWorld(true);

  // Una caja por malla. Hacen falta las dos cosas: la global para centrar y
  // apoyar, y las de cada pieza para poder descartar las bajas al buscar el
  // frente. Se recorren los vértices en vez de usar Box3.setFromObject porque
  // hace falta la caja DESPUÉS del giro, y girar la caja de un objeto no da la
  // caja del objeto girado.
  const cajas = [];
  const v = new THREE.Vector3();

  objeto.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const c = [v.x, v.y, v.z];
      for (let k = 0; k < 3; k++) {
        if (c[k] < min[k]) min[k] = c[k];
        if (c[k] > max[k]) max[k] = c[k];
      }
    }
    cajas.push({ min, max });
  });

  if (!cajas.length) return objeto;   // rama vacía: nada que asentar

  const global = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const c of cajas) {
    for (let k = 0; k < 3; k++) {
      if (c.min[k] < global.min[k]) global.min[k] = c.min[k];
      if (c.max[k] > global.max[k]) global.max[k] = c.max[k];
    }
  }

  const alturaCuerpo = global.min[1] + (global.max[1] - global.min[1]) * FRACCION_CUERPO;
  let frente = -Infinity;
  for (const c of cajas) if (c.max[1] >= alturaCuerpo && c.max[2] > frente) frente = c.max[2];
  if (!Number.isFinite(frente)) frente = global.max[2];

  objeto.position.set(
    -(global.min[0] + global.max[0]) / 2,   // centrado en la calle
    -global.min[1],                         // apoyado en el asfalto
    -frente,                                // su fachada en el plano del cruce
  );
  objeto.updateMatrixWorld(true);
  return objeto;
}

/**
 * El edificio que toca de frente en la bifurcación de este escenario, ya
 * asentado: centrado, a ras de calle y con la fachada en el plano del cruce.
 */
export function clonarEdificioDelCruce(idEscenario) {
  const nombre = EDIFICIO_DEL_CRUCE[idEscenario];
  const copia = clonarPorNombre(nombre);
  return copia ? asentarFachada(copia, ROTACION_FACHADA[nombre] ?? 0) : null;
}

/** Copia de una rama cualquiera del modelo de la ciudad, por su nombre. */
export function clonarPorNombre(nombre) {
  if (!raiz || !nombre) return null;
  const original = raiz.getObjectByName(nombre);
  if (!original) return null;
  const copia = original.clone(true);
  copia.position.set(0, 0, 0);
  copia.rotation.set(0, 0, 0);
  copia.updateMatrixWorld(true);
  return copia;
}

let raiz = null;
let cargando = null;

// ---------------------------------------------------------------------------
// PIEZAS SOBREESCRITAS — Lo que vuelve de Blender
// ---------------------------------------------------------------------------
// El juego genera sus piezas con código. Si alguien baja una del exportador, la
// retoca en Blender y la deja en public/modelos/piezas/ con el mismo nombre, a
// partir de ahí manda el archivo.
//
// SE INTENTA UNA VEZ Y EN SILENCIO. No hay lista de qué archivos existen —eso
// obligaría a mantener un índice a mano y a acordarse de tocarlo cada vez—, así
// que se pide la pieza y, si el servidor responde 404, se usa la procedural. El
// 404 en consola es ruido, pero es el precio de que añadir una pieza sea dejar
// un archivo en una carpeta y nada más.
const piezas = new Map();

/**
 * Registra una pieza editada, si existe. Se llama al arrancar con la lista de
 * las que el juego sabe sustituir.
 */
async function intentarCargarPieza(id, base) {
  try {
    const respuesta = await fetch(`${base}modelos/piezas/${id}.glb`, { method: 'HEAD' });
    if (!respuesta.ok) return false;
  } catch {
    return false;
  }

  return new Promise((resolver) => {
    new GLTFLoader().load(
      `${base}modelos/piezas/${id}.glb`,
      (gltf) => { piezas.set(id, gltf.scene); resolver(true); },
      undefined,
      () => resolver(false),
    );
  });
}

/**
 * ¿Hay una versión editada de esta pieza? Devuelve una copia o null.
 *
 * Quien genera una pieza pregunta primero por aquí y, si no hay nada, sigue con
 * su código de siempre. Así el juego funciona igual sin un solo archivo, y
 * cambiar una casa no obliga a tocar JavaScript.
 */
export function piezaEditada(id) {
  const original = piezas.get(id);
  return original ? original.clone(true) : null;
}

export function hayPiezaEditada(id) {
  return piezas.has(id);
}

/** Descarga el modelo. Se llama una vez, desde la pantalla de carga. */
// Qué piezas admiten sustitución desde Blender. Es la lista de lo que el
// generador consulta antes de construir; añadir una es añadirla aquí y meter la
// consulta en su generador.
export const PIEZAS_SUSTITUIBLES = [
  'personaje-tostadologo', 'personaje-avecilla', 'personaje-buencan',
  'personaje-monki', 'personaje-ministro',
  'evidencia', 'prueba', 'policia', 'dron',
];

export function cargarHitos(base = '/') {
  if (raiz) return Promise.resolve(true);
  if (cargando) return cargando;

  // Las piezas editadas van en paralelo con el modelo de la ciudad: son
  // independientes y esperar una por una alargaría la pantalla de carga.
  Promise.all(PIEZAS_SUSTITUIBLES.map((id) => intentarCargarPieza(id, base)))
    .catch(() => {});

  cargando = new Promise((resolver) => {
    new GLTFLoader().load(
      `${base}modelos/quito.glb`,
      (gltf) => { raiz = gltf.scene; resolver(true); },
      undefined,
      (error) => {
        console.warn('[Hitos] No se pudo cargar el modelo de Quito.', error);
        resolver(false);
      },
    );
  });
  return cargando;
}
