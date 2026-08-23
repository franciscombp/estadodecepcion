// ============================================================================
// MIXAMO — leer un .fbx bajado de Mixamo
// ============================================================================
// Lo que hacía este archivo —pasar una animación de un esqueleto a otro— se
// mudó a `src/models/retarget.js` cuando resultó que hacía falta también
// dentro del juego, y no sólo en el horneado: los clips horneados están sobre
// el esqueleto del tostadólogo y hay cuatro personajes cuyo reposo se separa
// del suyo más de ciento veinte grados en la cadera y los fémures.
//
// Aquí se queda sólo lo que depende de `FBXLoader`, que es un cargador de
// trescientos kilobytes y no tiene por qué entrar en el paquete del juego.
//
// EL ESQUELETO DE NUESTROS PERSONAJES ES EL DE MIXAMO, hueso por hueso: los
// mismos veinticuatro nombres, sin el prefijo `mixamorig:` y con la columna
// numerada al revés (nuestro `Spine02` cuelga de la cadera; el suyo se llama
// `Spine`, y el de arriba `Spine2`). Meshy usa esa convención porque se ha
// vuelto el estándar. Así que las animaciones de Mixamo se pueden traer sin
// subir nada: se baja el ciclo puesto sobre su propio muñeco —«without skin»,
// que son cuatrocientos kilobytes de huesos y nada más— y se pasa por aquí.
// ============================================================================

import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export { emparejarHuesos, pasarAlPersonaje, COLUMNA } from '../models/retarget.js';

/** Lee un `.fbx` y devuelve su escena y sus clips. */
export function leerFBX(bytes) {
  const escena = new FBXLoader().parse(bytes, '');
  return { escena, clips: escena.animations ?? [] };
}
