// ============================================================================
// PAPELES Y EVIDENCIA — Los recolectables
// ============================================================================
// Papeles = las monedas. Salen en hileras, como en Subway Surfers, y guían al
// jugador por la ruta buena: si sigues los papeles, sobrevives.
//
// Evidencia = las gemas. Vale 10-20 y aparece poco. Es el recurso que abre
// las fichas del Cuaderno de Expedientes.
//
// Ambos usan pool de objetos: nunca se crea ni se destruye nada en runtime.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, PAPELES, EVIDENCIA } from '../config/balance.js';
import { crearPapel, crearEvidencia } from '../models/props.js';
import { crearCaja, hayColisionPlana, distanciaHorizontal } from '../utils/collision.js';

export class CoinManager {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activos = [];
    this.poolPapeles = [];
    this.poolEvidencia = [];

    this.tiempo = 0;
    // Multiplicador de densidad que impone cada escenario (Carondelet ≈ 0.25).
    this.densidad = 1.0;
    // Tope duro de papeles por tramo, para escenarios áridos.
    this.maximoPorTramo = Infinity;
    this.generadosEsteTramo = 0;

    this.tiposEvidencia = ['Documento'];
  }

  // -------------------------------------------------------------------------
  // POOL
  // -------------------------------------------------------------------------

  _obtenerPapel() {
    if (this.poolPapeles.length > 0) return this.poolPapeles.pop();
    const m = crearPapel();
    this.grupo.add(m);
    return m;
  }

  _obtenerEvidencia() {
    if (this.poolEvidencia.length > 0) return this.poolEvidencia.pop();
    const m = crearEvidencia();
    this.grupo.add(m);
    return m;
  }

  _devolver(item) {
    item.malla.visible = false;
    if (item.tipo === 'evidencia') {
      if (this.poolEvidencia.length < EVIDENCIA.TAMANO_POOL) this.poolEvidencia.push(item.malla);
      else this._destruirMalla(item.malla);
    } else {
      if (this.poolPapeles.length < PAPELES.TAMANO_POOL) this.poolPapeles.push(item.malla);
      else this._destruirMalla(item.malla);
    }
  }

  /**
   * Saca una malla de la escena.
   *
   * OJO: NO libera geometría ni material. Los papeles comparten ambos entre
   * todas sus instancias (ver crearPapel en models/props.js), así que
   * liberarlos aquí dejaría invisibles al resto de papeles vivos. Son un puñado
   * de recursos de tamaño fijo que viven lo que dura la aplicación: no hay
   * nada que recuperar liberándolos.
   */
  _destruirMalla(malla) {
    this.grupo.remove(malla);
  }

  // -------------------------------------------------------------------------
  // GENERACIÓN
  // -------------------------------------------------------------------------

  /**
   * Genera una hilera de papeles en un carril concreto.
   * Se llama desde Game.js pasándole los carriles que el generador de
   * obstáculos dejó libres, para que los papeles nunca queden dentro de un muro.
   *
   * @param {number[]} carrilesLibres Carriles transitables del grupo
   * @param {number} zGrupo           Z del grupo de obstáculos de referencia
   * @param {number} gap              Distancia hasta el siguiente grupo
   * @param {boolean} enArco          Si va elevada (acompañando un salto)
   */
  generarHilera(carrilesLibres, zGrupo, gap, enArco = false) {
    if (!carrilesLibres || carrilesLibres.length === 0) return;
    if (this.generadosEsteTramo >= this.maximoPorTramo) return;
    // La densidad del escenario decide si esta hilera llega a existir.
    if (Math.random() > this.densidad) return;

    const carril = carrilesLibres[Math.floor(Math.random() * carrilesLibres.length)];
    const x = CARRILES.POSICIONES[carril];

    // La hilera empieza pasado el grupo y tiene que caber ANTES del siguiente.
    // Los carriles libres lo son para ESTE grupo; el siguiente tiene otro
    // reparto, así que invadirlo pondría papeles dentro de un muro.
    const z = zGrupo - PAPELES.MARGEN_TRAS_GRUPO;
    const espacioDisponible = Math.max(0, gap - PAPELES.MARGEN_TRAS_GRUPO - PAPELES.MARGEN_ANTES_GRUPO);
    const cabenPorEspacio = Math.floor(espacioDisponible / PAPELES.SEPARACION) + 1;

    const largoDeseado = PAPELES.LARGO_HILERA_MIN +
      Math.floor(Math.random() * (PAPELES.LARGO_HILERA_MAX - PAPELES.LARGO_HILERA_MIN + 1));

    const largo = Math.min(largoDeseado, cabenPorEspacio);
    if (largo < 1) return;

    for (let i = 0; i < largo; i++) {
      if (this.generadosEsteTramo >= this.maximoPorTramo) break;

      const zPapel = z - i * PAPELES.SEPARACION;

      // En arco, la hilera describe una parábola que coincide con la
      // trayectoria del salto. Es la señal visual de "salta aquí".
      let y = PAPELES.ALTURA;
      if (enArco) {
        const t = i / Math.max(1, largo - 1);
        y = PAPELES.ALTURA + Math.sin(t * Math.PI) * (PAPELES.ALTURA_ARCO - PAPELES.ALTURA);
      }

      const malla = this._obtenerPapel();
      malla.visible = true;
      malla.position.set(x, y, zPapel);

      this.activos.push({
        malla,
        tipo: 'papel',
        x,
        y,
        z: zPapel,
        valor: PAPELES.VALOR_MINIMO +
          Math.floor(Math.random() * (PAPELES.VALOR_MAXIMO - PAPELES.VALOR_MINIMO + 1)),
        recogido: false,
      });

      this.generadosEsteTramo++;
    }

    // ¿Cae una evidencia al final de la hilera?
    if (Math.random() < EVIDENCIA.PROBABILIDAD_POR_GRUPO) {
      const malla = this._obtenerEvidencia();
      malla.visible = true;
      const zEvidencia = z - largo * PAPELES.SEPARACION;
      malla.position.set(x, EVIDENCIA.ALTURA, zEvidencia);

      this.activos.push({
        malla,
        tipo: 'evidencia',
        x,
        y: EVIDENCIA.ALTURA,
        z: zEvidencia,
        valor: EVIDENCIA.VALOR_MINIMO +
          Math.floor(Math.random() * (EVIDENCIA.VALOR_MAXIMO - EVIDENCIA.VALOR_MINIMO + 1)),
        nombre: this.tiposEvidencia[Math.floor(Math.random() * this.tiposEvidencia.length)],
        recogido: false,
      });
    }
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {number} avance
   * @param {Player} jugador Para el efecto imán
   */
  actualizar(dt, avance, jugador) {
    this.tiempo += dt;

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      item.z += avance;

      // --- Imán ------------------------------------------------------------
      // Los recolectables cercanos se acercan al jugador. Compensa la menor
      // precisión del swipe en móvil sin regalar el juego.
      if (!item.recogido && Math.abs(item.z) < 12) {
        const d = distanciaHorizontal(item.x, item.z, jugador.x, 0);
        if (d < PAPELES.RADIO_IMAN) {
          const factor = 1 - Math.exp(-PAPELES.VELOCIDAD_IMAN * dt);
          item.x += (jugador.x - item.x) * factor;
          const yObjetivo = jugador.y + 0.9;
          item.y += (yObjetivo - item.y) * factor;
        }
      }

      item.malla.position.set(item.x, item.y, item.z);

      // --- Animación de reposo ---------------------------------------------
      if (item.tipo === 'papel') {
        item.malla.rotation.y = this.tiempo * 3 + item.z * 0.1;
      } else {
        item.malla.rotation.y = this.tiempo * 2;
        item.malla.rotation.x = this.tiempo * 1.4;
        // Pulso del halo.
        const escala = 1 + Math.sin(this.tiempo * 5) * 0.12;
        if (item.malla.userData.halo) item.malla.userData.halo.scale.setScalar(escala);
      }

      // --- Reciclado --------------------------------------------------------
      if (item.z > 18) {
        this._devolver(item);
        this.activos.splice(i, 1);
      }
    }
  }

  /**
   * Recoge todo lo que toque el jugador.
   * @returns {{papeles: number, evidencias: Array}} Lo recogido este fotograma
   */
  recoger(jugador) {
    const cajaJugador = jugador.obtenerCaja();
    // Ensanchamos la caja de recogida: ser generoso aquí se siente bien.
    const cajaRecogida = crearCaja(
      cajaJugador.x, cajaJugador.y, cajaJugador.z,
      cajaJugador.ancho + 0.8, cajaJugador.alto + 0.6, cajaJugador.profundidad + 0.8,
    );

    let papeles = 0;
    const evidencias = [];

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      if (item.recogido) continue;
      if (Math.abs(item.z) > 3) continue;

      const cajaItem = crearCaja(item.x, item.y, item.z, 0.5, 0.6, 0.5);

      if (hayColisionPlana(cajaRecogida, cajaItem)) {
        // Para la evidencia sí comprobamos altura: está flotando y debe
        // sentirse como algo que se alcanza.
        const dy = Math.abs(cajaRecogida.y - item.y);
        if (dy > (cajaRecogida.alto / 2 + 0.9)) continue;

        item.recogido = true;
        papeles += item.valor;
        if (item.tipo === 'evidencia') {
          evidencias.push({ nombre: item.nombre, valor: item.valor });
        }

        this._devolver(item);
        this.activos.splice(i, 1);
      }
    }

    return { papeles, evidencias };
  }

  // -------------------------------------------------------------------------
  // TEMA Y CICLO DE VIDA
  // -------------------------------------------------------------------------

  /** Configura densidad y tipos de evidencia según el escenario. */
  aplicarTema(escenario) {
    this.densidad = escenario.densidadPapeles ?? 1.0;
    this.maximoPorTramo = escenario.maximoPapelesPorTramo ?? Infinity;
    this.tiposEvidencia = escenario.evidencia ?? ['Documento'];
    this.generadosEsteTramo = 0;
  }

  /** Reinicia el contador al empezar un tramo nuevo. */
  nuevoTramo() {
    this.generadosEsteTramo = 0;
  }

  limpiar() {
    // Copiamos la lista antes de recorrerla: _devolver puede sacar mallas del
    // grupo y no queremos mutar lo que estamos iterando.
    const items = [...this.activos];
    this.activos = [];
    for (const item of items) {
      item.malla.visible = false;
      this._devolver(item);
    }
  }

  reiniciar() {
    this.limpiar();
    this.generadosEsteTramo = 0;
  }
}
