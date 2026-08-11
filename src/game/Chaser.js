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

    // Posición y tamaño VISUALES, separados de la distancia de juego.
    this.zVisualActual = -14;
    this.yVisualActual = 2.6;
    this.escalaActual = 0.78;
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

    // La distancia de JUEGO no sirve como posición visual. La cámara está a
    // ~9 unidades por detrás del jugador, así que cualquier cosa situada a
    // 26-34 unidades detrás cae fuera de cuadro —literalmente detrás del
    // objetivo— y el perseguidor no se vería nunca.
    //
    // Por eso mapeamos el rango de juego a un rango visual estrecho que
    // siempre queda encuadrado: lejos van pequeños y altos al fondo, cerca
    // bajan y crecen encima del jugador. Se conserva la lectura de amenaza sin
    // atarla a las unidades del mundo.
    // El rango se queda SIEMPRE en Z negativa, o sea más allá del jugador en
    // profundidad de pantalla. Así se leen como una presencia al fondo que
    // crece, y nunca tapan al personaje —que es justo lo que el jugador
    // necesita ver para esquivar.
    const cerca = this.cercania();               // 0 = lejos, 1 = encima
    const zVisual = THREE.MathUtils.lerp(-24, -4.5, cerca);
    const yVisual = THREE.MathUtils.lerp(2.2, 0.3, cerca);
    const escala = THREE.MathUtils.lerp(0.8, 1.2, cerca);

    // Suavizamos para que los cambios de distancia no den tirones.
    const ts = 1 - Math.exp(-5 * dt);
    this.zVisualActual += (zVisual - this.zVisualActual) * ts;
    this.yVisualActual += (yVisual - this.yVisualActual) * ts;
    this.escalaActual += (escala - this.escalaActual) * ts;

    this.modelo.position.set(this.x, this.yVisualActual, this.zVisualActual);
    this.modelo.scale.setScalar(this.escalaActual);

    // Miran hacia el jugador, es decir, hacia -Z.
    this.modelo.rotation.y = Math.PI;

    // Cuando están lejos flotan un poco: refuerza que son una presencia al
    // fondo y no un objeto apoyado en el suelo a media pista.
    if (cerca < 0.5) {
      this.modelo.position.y += Math.sin(this.tiempo * 1.8) * 0.18;
    }

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
    this.zVisualActual = -14;
    this.yVisualActual = 2.6;
    this.escalaActual = 0.78;
  }
}
