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
import { esGLB, animarCarreraGLB, poseMinistroGLB } from '../models/personajeGLB.js';

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
    // Progreso del cierre y del sostenido, por separado. Ver actualizar().
    this.cierre = 0;
    this.quieto = 0;
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
   * @returns {number} Progreso 0..1 de la ESCENA entera (cierre + sostenido).
   *   El cierre por separado queda en `this.cierre`, y eso es lo que hay que
   *   mirar para todo lo que tenga que pasar cuando el corro LLEGA: los
   *   perseguidores se abalanzan con el cierre, no con el total.
   */
  actualizar(dt) {
    if (!this.activo) return 0;

    this.tiempo += dt;
    const total = CERCO.DURACION + CERCO.SOSTENIDO;

    // CIERRE: lo que tardan en llegar. QUIETO: lo que llevan ya puestos.
    const t = Math.min(1, this.tiempo / total);
    const cierre = Math.min(1, this.tiempo / CERCO.DURACION);
    const quieto = Math.min(1, Math.max(0,
      (this.tiempo - CERCO.DURACION) / Math.max(0.001, CERCO.SOSTENIDO)));
    this.cierre = cierre;
    this.quieto = quieto;

    // Curva de entrada: llegan rápido y frenan al final. Un acercamiento
    // lineal se lee como una animación; este se lee como gente corriendo.
    const avance = 1 - Math.pow(1 - cierre, 3);

    // …Y UNA VEZ PUESTOS, APRIETAN. Un 7 % de la elipse, repartido a lo largo
    // del sostenido. Un corro perfectamente inmóvil se lee como decorado; ese
    // apretón mínimo es lo que lo convierte en gente que sigue encima de ti,
    // y no cuesta una figura más ni una animación nueva: es la misma elipse
    // un poco más chica.
    const aprieta = 0.07 * (quieto * quieto * (3 - 2 * quieto));

    this.policias.forEach((policia, i) => {
      // Se reparten en un arco por DELANTE y a los lados. La espalda se deja
      // libre a propósito: ahí están Noboa y Reimberg, que llegan por su lado.
      const angulo = -Math.PI * 0.72 + (i / (CERCO.POLICIAS - 1)) * Math.PI * 1.44;
      const abre = 1.9 - avance - aprieta;

      // Elipse: estrecha a lo ancho de la calle y honda a lo largo. Ver
      // CERCO.RADIO_X / RADIO_Z, que explica por qué no es un círculo.
      policia.position.set(
        Math.sin(angulo) * CERCO.RADIO_X * abre,
        0,
        -Math.cos(angulo) * CERCO.RADIO_Z * abre,
      );
      // MIRAN AL CENTRO, o sea al jugador. Dos arreglos en la misma línea:
      //
      // - Con la elipse, el ángulo del reparto ya no coincide con la dirección
      //   al centro: un punto a metro y medio de lado y cuatro y medio de
      //   frente no mira a 45°. Se saca de la posición.
      // - Y sobraba media vuelta. Estos modelos miran a +Z con rotación cero
      //   —por eso el jugador lleva un `rotation.y = Math.PI` puesto a mano,
      //   para correr de espaldas—, así que el `+ Math.PI` que había aquí los
      //   ponía de espaldas al hombre que acababan de tirar al suelo. En un
      //   corro de cinco no se notaba porque cuatro estaban fuera de cuadro.
      policia.rotation.y = Math.atan2(-policia.position.x, -policia.position.z);

      // Trote hasta que se plantan. Contra el CIERRE, no contra el total: con
      // el total, el umbral de 0.85 caía dentro del sostenido y los dejaba
      // botando un rato después de haber llegado.
      const trote = cierre < 0.85 ? Math.abs(Math.sin(this.tiempo * 9 + i)) * 0.09 : 0;
      policia.position.y = trote;

      // EL DEL ARCHIVO CORRE DE VERDAD. El de cajas se apañaba con el rebote
      // de arriba —sube y baja, y el ojo lo lee como pasos— pero al que trae
      // esqueleto eso lo deja botando con las piernas quietas. Mientras se
      // acerca se le pasa su ciclo de carrera; cuando se planta, la pose de
      // estar de pie, que es la misma que usa el entrevistado en la portada:
      // respira despacio y ya está. Un policía plantado y perfectamente
      // inmóvil se lee como un maniquí, y lo que tiene que dar es cerco.
      if (esGLB(policia)) {
        if (cierre < 0.85) animarCarreraGLB(policia, dt, 14);
        else poseMinistroGLB(policia, this.tiempo, 1);
      }
    });

    return t;
  }

  limpiar() {
    this.activo = false;
    this.tiempo = 0;
    this.cierre = 0;
    this.quieto = 0;
    this.grupo.visible = false;
  }
}
