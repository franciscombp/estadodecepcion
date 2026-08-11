// ============================================================================
// BIFURCACIÓN — El desvío se decide corriendo, no en un menú
// ============================================================================
// Como en Temple Run: el carril en el que estés al cruzar el pórtico decide
// la ruta. No se para el juego, no aparece una pantalla; sigues corriendo y
// eliges con el cuerpo.
//
//   carril izquierdo → escenario vecino de la izquierda
//   carril central   → la institución (dispara la ruleta)
//   carril derecho   → escenario vecino de la derecha
//
// SECUENCIA
//   1. AVISO       Faltan ~120 m. Se deja de generar obstáculos y aparece el
//                  pórtico al fondo con un cartel por carril.
//   2. APROXIMACIÓN El jugador se coloca. El corredor está limpio a propósito:
//                  obligar a esquivar mientras eliges convierte una decisión
//                  en un accidente.
//   3. CRUCE       Al llegar al pórtico se lee el carril y se compromete.
//   4. VIRAJE      La cámara se inclina hacia el lado elegido y la pantalla
//                  destella. Ese banqueo es lo que vende el giro sin tener que
//                  construir geometría de carretera curva.
// ============================================================================

import * as THREE from 'three';
import { CARRILES } from '../config/balance.js';
import { crearPorticoBifurcacion, crearFlechaAsfalto } from '../models/props.js';
import { obtenerEscenario } from '../config/escenarios.js';
import { COLOR3D } from '../config/estilo.js';

export class Bifurcacion {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activa = false;       // ¿Hay un pórtico en pista?
    this.portico = null;
    this.flechas = [];
    this.z = 0;                // Posición del pórtico

    // Viraje tras cruzar.
    this.virando = false;
    this.direccionViraje = 0;  // -1 izquierda, 0 centro, 1 derecha
    this.tiempoViraje = 0;
    this.DURACION_VIRAJE = 0.75;
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  /**
   * Coloca el pórtico y las flechas a la distancia indicada.
   *
   * @param {string} idEscenario Escenario actual
   * @param {object} colores     Paleta del escenario
   * @param {number} distancia   A cuántas unidades por delante ponerlo
   */
  preparar(idEscenario, colores, distancia) {
    this.limpiar();

    const esc = obtenerEscenario(idEscenario);
    const izquierda = obtenerEscenario(esc.rutas.izquierda);
    const derecha = obtenerEscenario(esc.rutas.derecha);

    // Qué dice el cartel del centro depende del escenario: en Carondelet no
    // hay institución, ir de frente es el cerco.
    const centroEsPeligro = !!esc.frenteEsMuerte;
    const textoCentro = centroEsPeligro
      ? 'EL CERCO'
      : (esc.institucion?.nombre ?? 'DE FRENTE');

    this.portico = crearPorticoBifurcacion(
      {
        izquierda: izquierda.nombre,
        centro: textoCentro,
        derecha: derecha.nombre,
      },
      colores,
      centroEsPeligro,
    );

    this.z = -distancia;
    this.portico.position.z = this.z;
    this.grupo.add(this.portico);

    // Flechas en el asfalto, repartidas por el corredor de aproximación.
    // Se repiten cada 14 unidades para que siempre haya una a la vista.
    const direcciones = [
      { dir: 'izquierda', carril: 0, color: colores.acento ?? COLOR3D.dorado },
      { dir: 'centro', carril: 1, color: centroEsPeligro ? COLOR3D.rojo : COLOR3D.naranja },
      { dir: 'derecha', carril: 2, color: colores.acento ?? COLOR3D.dorado },
    ];

    for (let i = 0; i < 5; i++) {
      for (const d of direcciones) {
        const flecha = crearFlechaAsfalto(d.dir, d.color);
        flecha.position.x = CARRILES.POSICIONES[d.carril];
        flecha.position.z = this.z + 12 + i * 14;
        this.grupo.add(flecha);
        this.flechas.push(flecha);
      }
    }

    this.activa = true;
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * Mueve el pórtico hacia el jugador.
   *
   * @param {number} dt
   * @param {number} avance
   * @returns {boolean} true en el fotograma en que el jugador lo cruza
   */
  actualizar(dt, avance) {
    if (this.virando) {
      this.tiempoViraje += dt;
      if (this.tiempoViraje >= this.DURACION_VIRAJE) {
        this.virando = false;
        this.tiempoViraje = 0;
      }
    }

    if (!this.activa) return false;

    this.z += avance;
    this.portico.position.z = this.z;

    for (const flecha of this.flechas) {
      flecha.position.z += avance;
      // Las flechas que quedan atrás se reenganchan por delante del pórtico,
      // así el corredor nunca se queda sin señalización.
      if (flecha.position.z > 14) flecha.position.z = this.z + 10;
    }

    // El cruce se detecta cuando el pórtico pasa por la posición del jugador.
    if (this.z >= 0) {
      this.activa = false;
      return true;
    }

    return false;
  }

  /**
   * Arranca el viraje de cámara hacia el carril elegido.
   * @param {number} carril 0 izquierda, 1 centro, 2 derecha
   */
  iniciarViraje(carril) {
    this.direccionViraje = carril - 1; // -1, 0, 1
    this.virando = true;
    this.tiempoViraje = 0;
  }

  /**
   * Inclinación de cámara a aplicar este fotograma, en radianes.
   * Describe una campana: entra y sale, con el pico a mitad del viraje.
   */
  banqueoCamara() {
    if (!this.virando || this.direccionViraje === 0) return 0;
    const t = this.tiempoViraje / this.DURACION_VIRAJE;
    return -this.direccionViraje * Math.sin(t * Math.PI) * 0.26;
  }

  /** Fracción 0..1 del destello de transición. */
  destello() {
    if (!this.virando) return 0;
    const t = this.tiempoViraje / this.DURACION_VIRAJE;
    // Sube de golpe y baja despacio: así el corte de escenario queda tapado.
    return t < 0.25 ? t / 0.25 : Math.max(0, 1 - (t - 0.25) / 0.75);
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  limpiar() {
    if (this.portico) {
      this.grupo.remove(this.portico);
      this.portico.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.portico = null;
    }

    for (const flecha of this.flechas) {
      this.grupo.remove(flecha);
      flecha.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.flechas = [];
    this.activa = false;
  }

  reiniciar() {
    this.limpiar();
    this.virando = false;
    this.tiempoViraje = 0;
    this.direccionViraje = 0;
  }
}
