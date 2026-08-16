// ============================================================================
// BIFURCACIÓN — El desvío se decide corriendo, no en un menú
// ============================================================================
// Al final de cada tramo la calle termina contra una fachada con TRES BOCAS DE
// TÚNEL, una por carril. El carril en el que estés al entrar decide la
// temporada. No se para el juego, no aparece una pantalla; eliges con el
// cuerpo, como en Temple Run.
//
//   túnel izquierdo → temporada vecina de la izquierda
//   túnel central   → el trámite (la vía institucional)
//   túnel derecho   → temporada vecina de la derecha
//
// POR QUÉ TÚNELES Y NO RAMALES
// Dos calles que divergen en la niebla son una mancha: no tienen borde, y a
// 200 metros no se distingue una de otra. Una boca de túnel sí tiene borde, y
// entrar en ella es un gesto inequívoco —o pasas por el hueco o no—. Además
// justifica el corte de escenario: dentro no se ve nada, y al salir estás en
// otro sitio.
//
// SECUENCIA
//   1. AVISO       A 260 m aparecen los carteles de señalización, uno tras
//                  otro, y las flechas en el asfalto. El jugador SIGUE
//                  esquivando: la decisión se toma mientras se corre.
//   2. LIMPIEZA    A 110 m el corredor se vacía. Obligar a esquivar en el
//                  último tramo convertiría la decisión en un accidente:
//                  acabarías eligiendo el carril que te tocó esquivar.
//   3. ENTRADA     Al llegar a la fachada se lee el carril y se compromete.
//   4. TRÁNSITO    La pantalla se va a blanco mientras se cambia de escenario.
//                  Ese destello es lo que tapa el corte.
// ============================================================================

import * as THREE from 'three';
import { CARRILES } from '../config/balance.js';
import {
  crearCruceDeEdificios,
  crearPasoLateral,
  crearFlechaAsfalto,
} from '../models/props.js';
import { obtenerEscenario } from '../config/escenarios.js';
import { COLOR3D } from '../config/estilo.js';

export class Bifurcacion {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activa = false;       // ¿Hay cruce en pista?
    this.tuneles = null;       // El cruce de edificios
    this.flechas = [];
    this.z = 0;                // Posición de la fachada

    // Tránsito tras entrar.
    this.virando = false;
    this.direccionViraje = 0;  // -1 izquierda, 0 centro, 1 derecha
    this.tiempoViraje = 0;
    this.DURACION_VIRAJE = 0.75;

    // El soportal que se cruza al doblar la esquina.
    this.paso = null;
    this.zPaso = 0;
    // Treinta metros: a velocidad de crucero es algo más de un segundo dentro.
    // Menos y no da tiempo a leerlo como un sitio; más y se hace un túnel, que
    // es lo que tiene que seguir siendo exclusivo del trámite.
    this.LARGO_PASO = 30;
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  /**
   * Coloca la fachada de túneles y su señalización.
   *
   * @param {string} idEscenario Escenario actual
   * @param {object} colores     Paleta del escenario
   * @param {number} distancia   A cuántas unidades por delante ponerla
   */
  preparar(idEscenario, colores, distancia) {
    this.limpiar();

    const esc = obtenerEscenario(idEscenario);
    const izquierda = obtenerEscenario(esc.rutas.izquierda);
    const derecha = obtenerEscenario(esc.rutas.derecha);

    // Qué dice el rótulo del centro depende del escenario: en Carondelet no
    // hay institución, ir de frente es el cerco.
    const centroEsPeligro = !!esc.frenteEsMuerte;
    const destinos = {
      izquierda: izquierda.nombre,
      centro: centroEsPeligro ? 'EL CERCO' : (esc.institucion?.nombre ?? 'DE FRENTE'),
      derecha: derecha.nombre,
    };

    this.z = -distancia;

    // BIFURCA LA CIUDAD, no un paredón con tres agujeros. De frente está el
    // edificio de la institución con su portal; a los lados la calle sigue,
    // enmarcada por las medianeras del barrio. Ver crearCruceDeEdificios().
    this.tuneles = crearCruceDeEdificios(destinos.centro, colores, centroEsPeligro);
    this.tuneles.position.z = this.z;
    this.grupo.add(this.tuneles);

    // AQUÍ YA NO HAY PÓRTICOS. Había tres carteles escalonados sobre la vía,
    // y el problema no era que estuvieran: era dónde. Un cartel modelado en el
    // mundo se ve en escorzo, se cruza en segundo y medio y hay que levantar
    // la vista del carril para leerlo justo cuando todavía se está esquivando.
    //
    // La señalización se fue al HUD (ver HUD.mostrarRotulo): baja desde arriba,
    // se queda quieta mientras dura la decisión y se lee entera. Lo que sigue
    // en el mundo son las flechas del asfalto, que están donde ya se está
    // mirando.

    // Flechas en el asfalto, repartidas por el corredor. Repiten en el suelo
    // lo que dicen los carteles, para que el jugador no tenga que levantar la
    // vista mientras se coloca.
    const direcciones = [
      { dir: 'izquierda', carril: 0, color: colores.acento ?? COLOR3D.dorado },
      { dir: 'centro', carril: 1, color: centroEsPeligro ? COLOR3D.rojo : COLOR3D.naranja },
      { dir: 'derecha', carril: 2, color: colores.acento ?? COLOR3D.dorado },
    ];

    for (let i = 0; i < 6; i++) {
      for (const d of direcciones) {
        const flecha = crearFlechaAsfalto(d.dir, d.color);
        flecha.position.x = CARRILES.POSICIONES[d.carril];
        flecha.position.z = this.z + 12 + i * 14;
        this.grupo.add(flecha);
        this.flechas.push(flecha);
      }
    }

    this.activa = true;

    // Se devuelven para que la interfaz pinte el cartel con lo mismo que dicen
    // las bocas: si los dos textos se calcularan por separado acabarían
    // diciendo cosas distintas el día que se toque uno.
    return { destinos, centroEsPeligro };
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * Mueve la fachada y su señalización hacia el jugador.
   *
   * @param {number} dt
   * @param {number} avance
   * @returns {boolean} true en el fotograma en que el jugador entra al túnel
   */
  actualizar(dt, avance) {
    if (this.virando) {
      this.tiempoViraje += dt;
      if (this.tiempoViraje >= this.DURACION_VIRAJE) {
        this.virando = false;
        this.tiempoViraje = 0;
      }
    }

    // El soportal viaja hacia atrás y se retira al quedar cruzado.
    if (this.paso) {
      this.zPaso += avance;
      this.paso.position.z = this.zPaso;
      if (this.zPaso > this.LARGO_PASO + 20) {
        this._destruir(this.paso);
        this.paso = null;
      }
    }

    if (!this.activa) return false;

    this.z += avance;
    this.tuneles.position.z = this.z;


    for (const flecha of this.flechas) {
      flecha.position.z += avance;
      // Las flechas que quedan atrás se reenganchan por delante de la fachada,
      // así el corredor nunca se queda sin señalización.
      if (flecha.position.z > 14) flecha.position.z = this.z + 10;
    }

    // La entrada se detecta cuando la boca pasa por la posición del jugador.
    if (this.z >= 0) {
      this.activa = false;
      return true;
    }

    return false;
  }

  /**
   * Arranca el tránsito hacia el carril elegido.
   * @param {number} carril 0 izquierda, 1 centro, 2 derecha
   */
  iniciarViraje(carril, colores) {
    this.direccionViraje = carril - 1; // -1, 0, 1
    this.virando = true;
    this.tiempoViraje = 0;

    // POR UN COSTADO SE CRUZA ALGO. El decorado cambiaba de golpe, tapado con
    // un destello: funcionaba, pero no se sentía como ir a ninguna parte —la
    // calle era otra sin que hubiera pasado nada—. Ahora se atraviesa un
    // soportal mientras el barrio de detrás se sustituye, que es el mismo
    // recurso del pasillo del trámite y por la misma razón: lo que separa una
    // escena de otra es cruzar algo, no un corte.
    if (this.direccionViraje !== 0 && colores) {
      this._montarPaso(colores);
    }
  }

  _montarPaso(colores) {
    this._destruir(this.paso);
    this.paso = crearPasoLateral(this.LARGO_PASO, colores);
    // Arranca justo encima del jugador: se entra en el mismo fotograma en que
    // se dobla la esquina.
    this.zPaso = 4;
    this.paso.position.z = this.zPaso;
    this.grupo.add(this.paso);
  }

  /**
   * Inclinación de cámara a aplicar este fotograma, en radianes.
   * Describe una campana: entra y sale, con el pico a mitad del tránsito.
   * El túnel central no inclina nada: se entra de frente.
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

  _destruir(objeto) {
    // Tolera null: lo llaman rutas que no saben si había algo montado —el paso
    // lateral solo existe cuando se dobla por un costado—, y obligarlas a
    // comprobarlo antes reparte la misma condición por cuatro sitios.
    if (!objeto) return;
    this.grupo.remove(objeto);
    objeto.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  /**
   * Retira el cruce. NO toca el soportal a propósito.
   *
   * A limpiar() lo llama el cambio de tramo, que es exactamente el momento en
   * que el jugador está DENTRO del paso: si se llevara el soportal por delante,
   * desaparecería en el mismo fotograma en que se entra en él y el cambio de
   * decorado volvería a verse a pelo, que es lo que el paso venía a tapar.
   *
   * El soportal se retira solo al quedar cruzado (ver actualizar) y se fuerza
   * en reiniciar(), que es cuando de verdad no queda nada en pista.
   */
  limpiar() {
    if (this.tuneles) {
      this._destruir(this.tuneles);
      this.tuneles = null;
    }

    for (const flecha of this.flechas) this._destruir(flecha);
    this.flechas = [];

    this.activa = false;
  }

  reiniciar() {
    this._destruir(this.paso);
    this.paso = null;
    this.limpiar();
    this.virando = false;
    this.tiempoViraje = 0;
    this.direccionViraje = 0;
  }
}
