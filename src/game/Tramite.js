// ============================================================================
// EL TRÁMITE — El túnel del centro
// ============================================================================
// Antes, entrar de frente abría una ruleta: un porcentaje, un giro, y la suerte
// decidía. Funcionaba como chiste una vez y como mecánica ninguna, porque el
// jugador no tenía nada que hacer más que mirar.
//
// Ahora la vía institucional es una prueba de HABILIDAD. Dentro del túnel no
// hay obstáculos ni perseguidores: solo papeles, colocados en un patrón que
// obliga a cambiar de carril sin descanso durante 340 metros. Al final se
// cuentan.
//
//   · Los recogiste TODOS  → la denuncia entra. Ganas el juego.
//   · Faltó uno            → «no alcanzaste los votos», se archiva, y sales a
//                            la calle a seguir corriendo.
//
// El umbral es 1. No 0.95: uno. Que sea casi imposible es exactamente el
// chiste —y también lo que hace que valga la pena intentarlo.
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
    this.sembrados = 0;
    this.recogidos = 0;
    this.institucion = '';
  }

  /**
   * Monta la galería y siembra el patrón de papeles.
   *
   * @param {object} colores      Paleta del escenario de entrada
   * @param {string} institucion  Nombre que cierra el fondo del túnel
   * @param {CoinManager} papeles
   */
  iniciar(colores, institucion, papeles) {
    this.limpiar();

    this.activo = true;
    this.recorrido = 0;
    this.recogidos = 0;
    this.institucion = institucion;

    const largo = TRAMITE.LONGITUD + 60;
    this.galeria = crearGaleriaTramite(largo, colores, institucion);
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

    this.sembrados = this._sembrar(papeles);
  }

  /**
   * Siembra el patrón. Las hileras van alternando de carril con un salto que
   * no se repite dos veces seguidas: es lo que obliga a leer por delante en
   * vez de aprenderse una secuencia.
   *
   * @returns {number} Cuántos papeles se plantaron
   */
  _sembrar(papeles) {
    const separacionHileras = TRAMITE.LONGITUD / TRAMITE.HILERAS;
    let carril = CARRILES.CENTRO;
    let total = 0;

    for (let i = 0; i < TRAMITE.HILERAS; i++) {
      // Salto de carril: siempre se mueve, nunca repite el mismo dos veces.
      const opciones = [0, 1, 2].filter((c) => c !== carril);
      carril = opciones[Math.floor(Math.random() * opciones.length)];

      const zInicio = -24 - i * separacionHileras;

      for (let j = 0; j < TRAMITE.PAPELES_POR_HILERA; j++) {
        papeles.plantarPapel(
          CARRILES.POSICIONES[carril],
          PAPELES.ALTURA,
          zInicio - j * PAPELES.SEPARACION,
        );
        total++;
      }
    }

    return total;
  }

  /**
   * @param {number} avance
   * @returns {boolean} true en el fotograma en que se sale del túnel
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

  /** Registra papeles recogidos dentro del trámite. */
  contar(cantidad) {
    this.recogidos += cantidad;
  }

  /** Fracción 0..1 de expediente completado. */
  fraccion() {
    if (this.sembrados === 0) return 0;
    return Math.min(1, this.recogidos / this.sembrados);
  }

  /** ¿Se logró el expediente completo? */
  esPerfecto() {
    return this.sembrados > 0 && this.recogidos >= this.sembrados * TRAMITE.UMBRAL_PERFECTO;
  }

  /** Progreso 0..1 dentro del túnel, para la barra del HUD. */
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
    this.sembrados = 0;
    this.recogidos = 0;
  }
}
