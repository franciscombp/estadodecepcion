// ============================================================================
// EL ENTE DE CONTROL — El túnel del centro
// ============================================================================
// Ver docs/GUION.md. Entrar de frente NO es un premio, y esa es la broma
// central del juego.
//
// LO QUE PASA AL ENTRAR
// La institución te riega los papeles. No aparecen papeles nuevos: se
// desparraman por el pasillo LOS QUE TRAÍAS, en los tres carriles, y hay que
// recuperar los que se pueda mientras corres. No hay obstáculos aquí dentro
// porque el obstáculo es la propia institución, que ya te quitó lo que tenías.
//
// LO QUE PASA AL SALIR
// Te dan con la puerta en las narices —se archiva el caso, faltan votos, te
// quitan los derechos políticos— pero sales con la pieza que te faltaba del
// caso. Esa asimetría es lo que sostiene el modo historia:
//
//   · Para el ARCHIVO el trámite rinde: sales con el hallazgo.
//   · Para el RANKING el trámite cuesta: entras con un montón y sales con lo
//     que alcanzaste a recoger del suelo.
//
// Quien juega a puntuación aprende a no entrar. Quien juega a documentar,
// entra. Que las dos formas de jugar tiren en direcciones opuestas es el
// punto, no un desequilibrio que haya que corregir.
//
// POR QUÉ ANTES ERA UNA RULETA Y YA NO
// Un porcentaje, un giro, y la suerte decidía. Funcionaba como chiste una vez
// y como mecánica ninguna, porque el jugador solo miraba.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, TRAMITE, PAPELES } from '../config/balance.js';
import { crearGaleriaTramite } from '../models/props.js';

export class TramiteManager {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activo = false;
    this.galeria = null;
    this.luces = [];
    this.z = 0;
    this.recorrido = 0;

    // Papeles que te quitaron y piezas que has vuelto a levantar del suelo.
    this.confiscados = 0;   // Cuántos llevabas al entrar
    this.piezas = 0;        // Cuántas piezas se dibujaron
    this.recuperadas = 0;
    this.valorPorPieza = 0;

    this.institucion = null;
  }

  /**
   * Monta el pasillo y riega los papeles del jugador.
   *
   * @param {object} colores      Paleta de la escena de entrada
   * @param {object} institucion  Ficha del ente (config/escenarios.js)
   * @param {CoinManager} papeles
   * @param {number} papelesDelJugador Lo que llevaba recogido al entrar
   */
  iniciar(colores, institucion, papeles, papelesDelJugador) {
    this.limpiar();

    this.activo = true;
    this.recorrido = 0;
    this.recuperadas = 0;
    this.institucion = institucion;
    this.confiscados = Math.max(0, Math.floor(papelesDelJugador));

    const largo = TRAMITE.LONGITUD + 60;
    this.galeria = crearGaleriaTramite(largo, colores, institucion?.nombre ?? 'TRÁMITE');
    // La boca queda justo delante del jugador: acaba de entrar por ella.
    this.z = 6;
    this.galeria.position.z = this.z;
    this.grupo.add(this.galeria);

    // Farolas fijas EN EL MUNDO, no dentro de la galería. La galería se
    // desplaza hacia el jugador, así que unas luces montadas en ella se
    // alejarían con el resto de la geometría y el pasillo se iría apagando a
    // medida que avanzas. Estas se quedan donde están, iluminando siempre el
    // tramo que el jugador tiene delante.
    for (const z of [-12, -40, -72]) {
      const luz = new THREE.PointLight(colores.acento ?? 0xffcf3f, 15, 44, 2);
      luz.position.set(0, 5, z);
      this.grupo.add(luz);
      this.luces.push(luz);
    }

    this._regar(papeles);
  }

  /**
   * Desparrama el montón por el pasillo.
   *
   * Cuántas piezas se dibujan NO es cuántos papeles llevabas: con cuatrocientos
   * encima no se pueden pintar cuatrocientas piezas, y con tres no habría
   * trámite. Se acota el número y cada pieza representa una parte proporcional
   * del montón, de modo que recuperar la mitad de las piezas es recuperar la
   * mitad de los papeles.
   *
   * El reguero va en zigzag por los tres carriles con las piezas más juntas de
   * lo que tarda un cambio de carril. No es un descuido: recuperarlo todo
   * tiene que ser prácticamente imposible.
   */
  _regar(papeles) {
    this.piezas = Math.min(
      TRAMITE.PIEZAS_MAXIMAS,
      Math.max(TRAMITE.PIEZAS_MINIMAS, Math.round(this.confiscados / 6)),
    );
    this.valorPorPieza = this.confiscados / this.piezas;

    let carril = CARRILES.CENTRO;

    for (let i = 0; i < this.piezas; i++) {
      // Cambio de carril cada pocas piezas, y nunca al mismo del que vienes.
      if (i % TRAMITE.PIEZAS_POR_TRAMO === 0) {
        const opciones = [0, 1, 2].filter((c) => c !== carril);
        carril = opciones[Math.floor(Math.random() * opciones.length)];
      }

      papeles.plantarPapel(
        CARRILES.POSICIONES[carril],
        // Casi por el suelo: se los tiraron, no se los colocaron.
        PAPELES.ALTURA * 0.55,
        -26 - i * TRAMITE.SEPARACION,
      );
    }
  }

  /**
   * @param {number} avance
   * @returns {boolean} true en el fotograma en que se sale del pasillo
   */
  actualizar(avance) {
    if (!this.activo) return false;

    this.recorrido += avance;
    this.z += avance;
    if (this.galeria) this.galeria.position.z = this.z;

    if (this.recorrido >= TRAMITE.LONGITUD) {
      this.activo = false;
      return true;
    }
    return false;
  }

  /** Registra piezas levantadas del suelo. */
  contar(cantidad) {
    this.recuperadas += cantidad;
  }

  /** Cuántos papeles vuelves a tener, de los que te quitaron. */
  papelesRecuperados() {
    return Math.round(this.recuperadas * this.valorPorPieza);
  }

  /** Cuántos se quedaron por el suelo. */
  papelesPerdidos() {
    return Math.max(0, this.confiscados - this.papelesRecuperados());
  }

  /** Fracción 0..1 de expediente recuperado. */
  fraccion() {
    if (this.piezas === 0) return 0;
    return Math.min(1, this.recuperadas / this.piezas);
  }

  /** ¿Se recuperó absolutamente todo? Prácticamente imposible. */
  esPerfecto() {
    return this.piezas > 0 && this.recuperadas >= this.piezas * TRAMITE.UMBRAL_PERFECTO;
  }

  /** Progreso 0..1 dentro del pasillo, para la barra del HUD. */
  progreso() {
    return Math.min(1, this.recorrido / TRAMITE.LONGITUD);
  }

  limpiar() {
    if (this.galeria) {
      this.grupo.remove(this.galeria);
      this.galeria.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.galeria = null;
    }
    for (const luz of this.luces) this.grupo.remove(luz);
    this.luces = [];
    this.activo = false;
    this.recorrido = 0;
    this.piezas = 0;
    this.recuperadas = 0;
    this.confiscados = 0;
    this.valorPorPieza = 0;
  }
}
