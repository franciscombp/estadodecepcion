// ============================================================================
// CERCO — Lo que pasa en los dos segundos después de que te alcanzan
// ============================================================================
// Antes, chocar y ver la pantalla de fin de partida ocurría en el mismo
// fotograma. Eso convierte la derrota en un corte: no ves qué pasó, solo que
// ya no estás jugando.
//
// Ahora la captura se REPRESENTA. El mundo se para, Noboa y Reimberg te caen
// encima y cinco policías cierran un círculo a tu alrededor mientras la cámara
// se abre. Solo cuando el círculo está cerrado aparece la interfaz.
//
// Es puro teatro —el resultado ya está decidido— pero es el teatro el que hace
// que la derrota se entienda: te rodearon, no "se acabó".
// ============================================================================

import * as THREE from 'three';
import { CERCO } from '../config/balance.js';
import { crearPolicia } from '../models/props.js';

export class Cerco {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    escena.add(this.grupo);

    this.policias = [];
    for (let i = 0; i < CERCO.POLICIAS; i++) {
      const p = crearPolicia();
      this.grupo.add(p);
      this.policias.push(p);
    }

    this.activo = false;
    this.tiempo = 0;
  }

  /** Arranca el cerco alrededor de la posición lateral del jugador. */
  iniciar(xJugador) {
    this.activo = true;
    this.tiempo = 0;
    this.x = xJugador;
    this.grupo.visible = true;
    this.grupo.position.set(xJugador, 0, 0);
  }

  /**
   * @param {number} dt
   * @returns {number} Progreso 0..1 del cerco
   */
  actualizar(dt) {
    if (!this.activo) return 0;

    this.tiempo += dt;
    const t = Math.min(1, this.tiempo / CERCO.DURACION);

    // Curva de entrada: llegan rápido y frenan al final. Un acercamiento
    // lineal se lee como una animación; este se lee como gente corriendo.
    const avance = 1 - Math.pow(1 - t, 3);

    this.policias.forEach((policia, i) => {
      // Se reparten en un arco por DELANTE y a los lados. La espalda se deja
      // libre a propósito: ahí están Noboa y Reimberg, que llegan por su lado.
      const angulo = -Math.PI * 0.72 + (i / (CERCO.POLICIAS - 1)) * Math.PI * 1.44;
      const radio = CERCO.RADIO * (1.9 - avance);

      policia.position.set(
        Math.sin(angulo) * radio,
        0,
        -Math.cos(angulo) * radio,
      );
      // Miran al centro, o sea al jugador.
      policia.rotation.y = angulo + Math.PI;

      // Trote hasta que se plantan.
      const trote = t < 0.85 ? Math.abs(Math.sin(this.tiempo * 9 + i)) * 0.09 : 0;
      policia.position.y = trote;
    });

    return t;
  }

  limpiar() {
    this.activo = false;
    this.tiempo = 0;
    this.grupo.visible = false;
  }
}
