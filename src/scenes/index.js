// ============================================================================
// REGISTRO DE ESCENARIOS
// ============================================================================
// Un único punto donde se resuelve "id de escenario → clase que lo construye".
// Para añadir un quinto escenario:
//   1. Definirlo en config/escenarios.js
//   2. Crear su clase heredando de BaseScene
//   3. Registrarlo aquí
// Nada más del juego necesita enterarse.
// ============================================================================

import { BahiaScene } from './BahiaScene.js';
import { ApagonScene } from './ApagonScene.js';
import { EleccionesScene } from './EleccionesScene.js';
import { CarondeletScene } from './CarondeletScene.js';
import { obtenerEscenario } from '../config/escenarios.js';

const CLASES = {
  bahia: BahiaScene,
  apagon: ApagonScene,
  elecciones: EleccionesScene,
  carondelet: CarondeletScene,
};

/**
 * Construye la escena correspondiente a un id.
 * @param {string} id
 * @param {THREE.Scene} escenaThree
 * @param {object} calidad Nivel gráfico (utils/calidad.js)
 * @returns {BaseScene}
 */
export function crearEscenario(id, escenaThree, calidad) {
  const config = obtenerEscenario(id);
  const Clase = CLASES[id] ?? BahiaScene;
  return new Clase(escenaThree, config, calidad);
}

export { BahiaScene, ApagonScene, EleccionesScene, CarondeletScene };
