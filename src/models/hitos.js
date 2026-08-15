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
  apagon: 'central_termica',
  bahia: 'fiscalia_general_del_estado',
};

let raiz = null;
let cargando = null;

/** Descarga el modelo. Se llama una vez, desde la pantalla de carga. */
export function cargarHitos(base = '/') {
  if (raiz) return Promise.resolve(true);
  if (cargando) return cargando;

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
