// ============================================================================
// MATERIALES — el acabado del mundo, en un solo sitio
// ============================================================================
//
// EL MAPA DE ENTORNO NO SIRVE DE NADA SI NADA LO REFLEJA.
//
// En `utils/entorno.js` se le puso cielo a la escena para que las cosas
// tuvieran algo que reflejar. Pero un material responde al entorno en
// proporción a lo PULIDO que esté: con rugosidad 0.9 el reflejo se reparte por
// toda la media esfera y no se ve nada; con 0.9 se puede encender el cielo más
// brillante del mundo y la caja seguirá saliendo mate.
//
// Y así estaba el mundo: rugosidades entre 0.25 y 0.95, la mayoría por encima
// de 0.8, repartidas por cuarenta declaraciones en seis ficheros. Cada una
// escrita en su momento, a ojo, sin nadie que las mirara juntas.
//
// ---------------------------------------------------------------------------
// EL TECHO DE RUGOSIDAD
// ---------------------------------------------------------------------------
// Lo que hace este módulo no es igualar todos los materiales —una lona y un
// azulejo no brillan igual, y está bien que no lo hagan— sino ponerles un
// TECHO. Lo que el autor pidió por debajo del techo se respeta; lo que pidió
// por encima se baja. Así se conserva la intención relativa (la chapa sigue
// siendo más brillante que el cartón) y desaparece el suelo mate en el que
// todo se igualaba.
//
// ---------------------------------------------------------------------------
// POR QUÉ UN REGISTRO
// ---------------------------------------------------------------------------
// Los materiales se crean una vez y se comparten entre miles de mallas, así
// que cuando el nivel de calidad baja en caliente —o cuando se está afinando
// el acabado con el juego corriendo— hace falta poder tocarlos todos. El
// registro es una lista débil de lo que se ha creado; `afinarAcabado()` la
// recorre y reescribe. Sin ella, cambiar el acabado obligaría a recargar.
// ============================================================================

import * as THREE from 'three';

/**
 * Lo más mate que se le permite a nada del mundo.
 *
 * 0.5, elegido midiendo. Se barrieron 0.95 (el mundo tal como estaba), 0.62,
 * 0.5 y 0.4 con el juego corriendo: la saturación media del cuadro sube 0,140 →
 * 0,165 → 0,182 y luego BAJA a 0,177, porque a 0.4 el brillo empieza a comerse
 * el color en vez de realzarlo y el quemado salta del 0,9 % al 5 %. El punto
 * está en 0.5: el reflejo del cielo se estira por los cantos biselados y la
 * lona sigue pareciendo lona.
 */
let techoRugosidad = 0.5;

/**
 * Cuánto cielo recoge cada material.
 *
 * Va muy por encima de uno a propósito: el cielo procedural de `entorno.js` es
 * un degradado suave, y además la escena lo consulta al 0.3 para no lavarse.
 * Este 2.0 devuelve al canto el brillo que aquel recorte le quita, sin
 * devolvérselo al difuso —que es justo el reparto que se buscaba: mucho
 * especular, poco ambiente—.
 */
let brilloEntorno = 2.0;

/**
 * Un puntito de metalidad para todo.
 *
 * El reflejo especular de un dieléctrico puro es gris y flojo. Un cinco por
 * ciento de metalidad tiñe el brillo con el color del propio objeto, y eso es
 * lo que hace que un toldo rojo tenga un canto rojo brillante en vez de un
 * canto blanco. Es el truco que separa una imagen de plástico barato de una
 * imagen de caramelo.
 */
let metalidadMinima = 0.12;

/** Todo lo que ha salido de aquí, para poder reafinarlo en caliente. */
const registro = new Set();

/**
 * Un material del mundo, con el acabado de la casa aplicado.
 *
 * Sustituye a `new THREE.MeshStandardMaterial(...)` en todo lo que se ve
 * dentro del juego. Los parámetros son los mismos; lo único que cambia es que
 * la rugosidad pasa por el techo y que se le pone el brillo de entorno.
 *
 * @param {object} params Los de MeshStandardMaterial
 * @returns {THREE.MeshStandardMaterial}
 */
export function material(params = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  registro.add(m);
  aplicar(m);
  return m;
}

/**
 * Reescribe el acabado de TODO lo creado hasta ahora.
 *
 * Sirve para dos cosas: bajar el brillo cuando el vigilante de rendimiento
 * baja de nivel, y afinar el acabado con el juego corriendo sin recargar. Lo
 * segundo importa más de lo que parece: ajustar rugosidades recompilando es un
 * ciclo de veinte segundos por prueba, y así son dos.
 *
 * @param {{techo?:number, entorno?:number, metal?:number}} v
 */
export function afinarAcabado(v = {}) {
  if (v.techo !== undefined) techoRugosidad = v.techo;
  if (v.entorno !== undefined) brilloEntorno = v.entorno;
  if (v.metal !== undefined) metalidadMinima = v.metal;
  for (const m of registro) aplicar(m);
  return { techo: techoRugosidad, entorno: brilloEntorno, metal: metalidadMinima };
}

/** El acabado que hay ahora mismo, y cuántos materiales lo llevan. */
export function acabadoActual() {
  return {
    techo: techoRugosidad,
    entorno: brilloEntorno,
    metal: metalidadMinima,
    materiales: registro.size,
  };
}

function aplicar(m) {
  // LA RUGOSIDAD ORIGINAL SE GUARDA, y esto no es un detalle: sin guardarla,
  // llamar dos veces a `afinarAcabado` con techos distintos iría bajando la
  // rugosidad a cada llamada —porque la segunda vez leería la ya recortada— y
  // el mundo se volvería un espejo a base de retoques. Se recorta siempre
  // contra el valor con el que nació.
  if (m.userData.rugosidadOriginal === undefined) {
    m.userData.rugosidadOriginal = m.roughness;
    m.userData.metalidadOriginal = m.metalness;
  }
  m.roughness = Math.min(m.userData.rugosidadOriginal, techoRugosidad);
  m.metalness = Math.max(m.userData.metalidadOriginal, metalidadMinima);
  m.envMapIntensity = brilloEntorno;
  m.needsUpdate = true;
}
