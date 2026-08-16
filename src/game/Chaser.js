// ============================================================================
// PERSEGUIDOR — Noboa haciendo caballito sobre Reimberg
// ============================================================================
// Van DETRÁS del jugador, en cuadro, entre él y la cámara. No son un adorno de
// fondo: son la amenaza, y se tienen que ver corriendo tras él.
//
// Su distancia es el verdadero medidor de vida del juego:
//
//   · Corres limpio          → se aleja despacio
//   · Recibes un golpe       → salta hacia adelante de golpe
//   · Baja de DISTANCIA_CAPTURA → te atrapan, fin de la partida
//
// La presión es continua y legible: el jugador ve el hueco cerrarse por el
// espejo del propio encuadre, y el HUD se lo confirma con la barra.
// ============================================================================

import * as THREE from 'three';
import { PERSEGUIDOR, CERCO, CAMARA } from '../config/balance.js';
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
    this.zVisualActual = PERSEGUIDOR.Z_LEJOS;
    this.escalaActual = PERSEGUIDOR.ESCALA_LEJOS;
    this.xVisualActual = PERSEGUIDOR.DESVIO_EN_PANTALLA * (CAMARA.POSICION.z - PERSEGUIDOR.Z_LEJOS);

    // Cerco: cuando atrapan al jugador, se abalanzan. 0..1.
    this.cercando = 0;
  }

  /**
   * @param {number} dt
   * @param {Player} jugador
   * @param {boolean} exhausto Reservado: hoy siempre es false.
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

    this._colocar(dt);
    animarPerseguidores(this.modelo, this.tiempo, dt);
  }

  /**
   * Traduce la distancia de juego a posición en cuadro.
   *
   * Van SIEMPRE en Z positiva: el jugador corre hacia -Z, la cámara está a su
   * espalda, así que perseguir es ocupar el hueco entre la cámara y él.
   *
   * El rango de Z es estrecho y la escala lo compensa (ver PERSEGUIDOR en
   * balance.js): la amenaza se lee por el hueco que se cierra, no por el
   * tamaño. Con el rango entero atado a la distancia de juego pasaría lo
   * contrario de lo que hay que comunicar, porque lo más cercano a la cámara
   * —o sea, lo que va más rezagado— se dibuja más grande.
   */
  _colocar(dt) {
    const cerca = this.cercania();               // 0 = lejos, 1 = encima

    let zVisual = THREE.MathUtils.lerp(PERSEGUIDOR.Z_LEJOS, PERSEGUIDOR.Z_CERCA, cerca);
    let escala = THREE.MathUtils.lerp(PERSEGUIDOR.ESCALA_LEJOS, PERSEGUIDOR.ESCALA_CERCA, cerca);

    // Van pegados a un lado, no exactamente detrás: con la cámara corta, de
    // frente le tapaban al jugador el cuerpo entero.
    //
    // El hueco se calcula EN PANTALLA, no en metros. Lo que la perspectiva
    // convierte en píxeles es la razón x/distancia_a_la_cámara, así que se
    // parte de la razón del jugador y se le suma la separación deseada; el
    // resultado se devuelve a metros multiplicando por la distancia de ellos.
    // Con metros fijos el hueco se abría al acercarse y se cerraba al cambiar
    // de carril, que es justo cuando hace falta que no se mueva.
    //
    // El lado por defecto es la derecha, y se cambian a la izquierda cuando el
    // jugador se mete en el carril derecho —si no, se saldrían de cuadro—. El
    // salto de un lado a otro se suaviza abajo: un cambio de carril no puede
    // teletransportarlos.
    const lado = this.x > 1.2 ? -1 : 1;
    const razon = this.x / CAMARA.POSICION.z
      + lado * PERSEGUIDOR.DESVIO_EN_PANTALLA;
    let xVisual = razon * Math.max(0.5, CAMARA.POSICION.z - zVisual);

    // Durante el cerco se echan encima, pero también POR UN LADO. De frente
    // taparían al personaje justo en el fotograma en que hay que verlo rodeado.
    if (this.cercando > 0) {
      zVisual = THREE.MathUtils.lerp(zVisual, 1.5, this.cercando);
      escala = THREE.MathUtils.lerp(escala, 1.05, this.cercando);
      xVisual = THREE.MathUtils.lerp(
        xVisual, this.x + CERCO.DESVIO_PERSEGUIDOR, this.cercando,
      );
    }

    // Suavizamos para que los cambios de distancia no den tirones.
    const ts = 1 - Math.exp(-5 * dt);
    this.zVisualActual += (zVisual - this.zVisualActual) * ts;
    this.escalaActual += (escala - this.escalaActual) * ts;
    this.xVisualActual += (xVisual - this.xVisualActual) * ts;

    // Corren por el suelo, como todo el mundo. Ya no flotan al fondo: ahora
    // están donde tienen que estar y no hace falta disimular nada.
    this.modelo.position.set(this.xVisualActual, 0, this.zVisualActual);
    this.modelo.scale.setScalar(this.escalaActual);

    // Miran hacia el jugador, que está en -Z respecto a ellos.
    this.modelo.rotation.y = Math.PI;
  }

  /**
   * Avanza la animación de cerco. Se llama desde Game durante el estado
   * 'cerco', cuando el mundo ya está parado.
   * @param {number} fraccion 0..1
   */
  cercar(fraccion, dt) {
    this.cercando = fraccion;
    this.tiempo += dt;
    this._colocar(dt);
    animarPerseguidores(this.modelo, this.tiempo, dt);
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

  /** Los devuelve a distancia de respiro tras un escape logrado. */
  soltar(distancia) {
    this.distancia = distancia;
    this.cercando = 0;
  }

  reiniciar() {
    this.distancia = PERSEGUIDOR.DISTANCIA_INICIAL;
    this.x = 0;
    this.tiempo = 0;
    this.cercando = 0;
    this.zVisualActual = PERSEGUIDOR.Z_LEJOS;
    this.escalaActual = PERSEGUIDOR.ESCALA_LEJOS;
    this.xVisualActual = PERSEGUIDOR.DESVIO_EN_PANTALLA * (CAMARA.POSICION.z - PERSEGUIDOR.Z_LEJOS);
  }
}
