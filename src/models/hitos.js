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

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Qué rama del modelo le toca a cada escenario. Las Elecciones no tienen: el
// CNE no está modelado, y poner otro edificio en su sitio sería mentir sobre
// dónde estás.
export const HITO_POR_ESCENARIO = {
  carondelet: 'palacio_de_carondelet',
  bahia: 'fiscalia_general_del_estado',
};

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

/**
 * Una copia del hito que le toca a un escenario, o null si no hay.
 *
 * La copia se recentra en su base y en su eje: dentro del archivo cada rama
 * está donde el modelador la dejó, y colocarla tal cual dejaría el edificio
 * hundido en el asfalto o desplazado media manzana.
 */
export function clonarHito(idEscenario) {
  const nombre = HITO_POR_ESCENARIO[idEscenario];
  if (!raiz || !nombre) return null;

  const original = raiz.getObjectByName(nombre);
  if (!original) return null;

  const copia = original.clone(true);
  copia.position.set(0, 0, 0);
  copia.rotation.set(0, 0, 0);
  copia.updateMatrixWorld(true);
  return copia;
}
