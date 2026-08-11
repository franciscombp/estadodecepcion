// ============================================================================
// PERSEGUIDOR — Noboa haciendo caballito sobre Reimberg
// ============================================================================
// Va siempre detrás, visible al fondo. Su distancia es el verdadero medidor de
// vida del juego:
//
//   · Corres limpio          → se aleja despacio
//   · Recibes un golpe       → salta hacia adelante de golpe
//   · Te quedas sin estamina → se acerca de forma sostenida
//   · Baja de DISTANCIA_CAPTURA → te atrapan, fin de la partida
//
// La presión es continua y legible: el jugador siempre sabe qué tan mal va con
// solo mirar atrás por el retrovisor del HUD.
// ============================================================================

import * as THREE from 'three';
import { PERSEGUIDOR } from '../config/balance.js';
import { crearPerseguidores, animarPerseguidores } from '../models/characters.js';

export class Chaser {
  constructor(escena) {
    this.escena = escena;

    this.modelo = crearPerseguidores();
    escena.add(this.modelo);

    this.distancia = PERSEGUIDOR.DISTANCIA_INICIAL;
    this.tiempo = 0;
    // Desplazamiento lateral suavizado: persigue el carril del jugador.
    this.x = 0;
  }

  /**
   * @param {number} dt
   * @param {Player} jugador
   * @param {boolean} exhausto ¿El jugador está sin estamina?
   */
  actualizar(dt, jugador, exhausto) {
    this.tiempo += dt;

    // --- Distancia ---------------------------------------------------------
    if (exhausto) {
      this.distancia -= PERSEGUIDOR.ACERCAMIENTO_POR_EXHAUSTO * dt;
    } else {
      this.distancia += PERSEGUIDOR.ALEJAMIENTO * dt;
    }

    this.distancia = THREE.MathUtils.clamp(
      this.distancia,
      0,
      PERSEGUIDOR.DISTANCIA_MAXIMA,
    );

    // --- Posición ----------------------------------------------------------
    // Sigue el carril del jugador con retraso: se lee como persecución real.
    const t = 1 - Math.exp(-3 * dt);
    this.x += (jugador.x - this.x) * t;

    this.modelo.position.set(this.x, 0, this.distancia);

    // Mira hacia el jugador (es decir, hacia -Z).
    this.modelo.rotation.y = Math.PI;

    animarPerseguidores(this.modelo, this.tiempo);
  }

  /** Los acerca de golpe. Se llama cuando el jugador choca. */
  acercarPorGolpe() {
    this.distancia -= PERSEGUIDOR.ACERCAMIENTO_POR_GOLPE;
    this.distancia = Math.max(0, this.distancia);
  }

  /** ¿Ya atraparon al jugador? */
  haAtrapado() {
    return this.distancia <= PERSEGUIDOR.DISTANCIA_CAPTURA;
  }

  /**
   * Cercanía normalizada 0..1 para el HUD.
   * 0 = lejos y tranquilo, 1 = encima.
   */
  cercania() {
    const rango = PERSEGUIDOR.DISTANCIA_MAXIMA - PERSEGUIDOR.DISTANCIA_CAPTURA;
    const actual = this.distancia - PERSEGUIDOR.DISTANCIA_CAPTURA;
    return THREE.MathUtils.clamp(1 - actual / rango, 0, 1);
  }

  /** Animación de captura: se abalanzan sobre el jugador. */
  atrapar() {
    this.distancia = PERSEGUIDOR.DISTANCIA_CAPTURA;
  }

  reiniciar() {
    this.distancia = PERSEGUIDOR.DISTANCIA_INICIAL;
    this.x = 0;
    this.tiempo = 0;
  }
}
