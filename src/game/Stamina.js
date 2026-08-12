// ============================================================================
// ESTAMINA — Barra, drenaje e ítems por escenario
// ============================================================================
// La estamina no te mata: te vuelve LENTO. Y al volverte lento, el perseguidor
// se acerca. Es una presión indirecta, que es lo que la hace interesante:
// puedes ignorarla un rato, pero no para siempre.
//
// Cada escenario tiene su propio ítem (encebollado, linterna, micrófono,
// canelazo). Mecánicamente son idénticos; narrativamente, no.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, ESTAMINA } from '../config/balance.js';
import { crearItemEstamina } from '../models/props.js';
import { crearCaja, hayColisionPlana } from '../utils/collision.js';

export class StaminaManager {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.valor = ESTAMINA.INICIAL;
    this.activos = [];
    this.pool = [];

    this.tiempo = 0;
    this.distanciaDesdeUltimo = 0;

    this.colorItem = 0x7cffb2;
    this.nombreItem = 'Estamina';
    this.modeloItem = 'encebollado';

    // Se pone a true cuando se recoge un ítem, para que Game.js dispare
    // efectos (destello de linterna en el Apagón, por ejemplo).
    this.recogidoEsteFotograma = false;
  }

  // -------------------------------------------------------------------------
  // POOL
  // -------------------------------------------------------------------------

  _obtener() {
    if (this.pool.length > 0) {
      const m = this.pool.pop();
      m.visible = true;
      return m;
    }
    const m = crearItemEstamina(this.colorItem, this.modeloItem);
    this.grupo.add(m);
    return m;
  }

  _devolver(item) {
    item.malla.visible = false;
    if (this.pool.length < 8) {
      this.pool.push(item.malla);
    } else {
      this.grupo.remove(item.malla);
      item.malla.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {number} avance
   * @param {{carrilesLibres:number[], z:number, gap:number}|null} grupo
   *        Datos del grupo de obstáculos recién generado. El ítem se coloca
   *        en uno de SUS carriles libres y dentro de SU hueco: si lo pusiéramos
   *        en una Z arbitraria podría acabar dentro de un obstáculo.
   */
  actualizar(dt, avance, grupo) {
    this.tiempo += dt;
    this.recogidoEsteFotograma = false;

    // --- Drenaje -----------------------------------------------------------
    this.valor = Math.max(0, this.valor - ESTAMINA.DRENAJE * dt);

    // --- Generación --------------------------------------------------------
    this.distanciaDesdeUltimo += avance;
    if (this.distanciaDesdeUltimo >= ESTAMINA.DISTANCIA_ENTRE_ITEMS) {
      if (grupo?.carrilesLibres?.length > 0) {
        // A mitad del hueco entre este grupo y el siguiente.
        this._generar(grupo.carrilesLibres, grupo.z - grupo.gap / 2);
        this.distanciaDesdeUltimo = 0;
      }
      // Si no había carril libre, reintenta en el siguiente grupo.
    }

    // --- Mover, animar y reciclar -----------------------------------------
    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      item.z += avance;
      item.malla.position.z = item.z;

      this._animar(item.malla, item.z);

      if (item.z > 18) {
        this._devolver(item);
        this.activos.splice(i, 1);
      }
    }
  }

  /**
   * Flotación, giro y vida propia del ítem.
   *
   * La fase depende de la Z para que dos ítems en pantalla no latan a la vez:
   * un grupo sincronizado se lee como un bucle de vídeo, no como objetos.
   */
  _animar(malla, z) {
    const u = malla.userData;

    malla.position.y = ESTAMINA.ALTURA + Math.sin(this.tiempo * 2.5 + z) * 0.14;
    malla.rotation.y = this.tiempo * 1.6;

    if (u.anillo) {
      u.anillo.rotation.z = this.tiempo * 2.2;
      u.anillo.scale.setScalar(1 + Math.sin(this.tiempo * 4) * 0.15);
    }
    if (u.halo) {
      u.halo.scale.setScalar(1 + Math.sin(this.tiempo * 3.1 + z) * 0.12);
    }
    if (u.chispas) {
      u.chispas.rotation.y = -this.tiempo * 2.6;
      u.chispas.rotation.x = Math.sin(this.tiempo * 1.7) * 0.3;
    }
    if (u.vapor) {
      // El vaho sube y se desvanece, y vuelve a empezar. El ciclo es corto
      // (1.6 s) porque el ítem pasa muy poco tiempo en pantalla.
      u.vapor.children.forEach((nube, i) => {
        const fase = (this.tiempo * 0.62 + i * 0.33) % 1;
        nube.position.y = 0.2 + fase * 0.55;
        nube.material.opacity = 0.24 * (1 - fase);
        nube.scale.setScalar(0.6 + fase * 0.9);
      });
    }
  }

  _generar(carrilesLibres, z) {
    const carril = carrilesLibres[Math.floor(Math.random() * carrilesLibres.length)];
    const malla = this._obtener();

    malla.position.set(CARRILES.POSICIONES[carril], ESTAMINA.ALTURA, z);

    this.activos.push({
      malla,
      x: CARRILES.POSICIONES[carril],
      z,
    });
  }

  /**
   * Coloca un ítem a mano, sin esperar al generador.
   *
   * Lo usa el Apagón: ese tramo depende por completo de la linterna, así que
   * no puede empezar sin una a la vista. Va en el carril central porque es
   * donde el jugador entra a cualquier tramo nuevo.
   *
   * @param {number} distancia A cuántos metros por delante
   * @param {number} [carril]  Carril, centro por defecto
   */
  sembrar(distancia, carril = CARRILES.CENTRO) {
    this._generar([carril], -Math.abs(distancia));
    // El contador arranca desde aquí: si no, el siguiente ítem saldría antes
    // de tiempo por lo que ya se había acumulado en el tramo anterior.
    this.distanciaDesdeUltimo = 0;
  }

  /** Rellena la barra. Se usa al regalar un ítem al entrar en un tramo. */
  rellenar(valor = ESTAMINA.MAXIMA) {
    this.valor = Math.min(ESTAMINA.MAXIMA, valor);
  }

  /**
   * Recoge los ítems que toque el jugador.
   * @returns {number} Cuántos ítems se recogieron
   */
  recoger(jugador) {
    const caja = jugador.obtenerCaja();
    const cajaRecogida = crearCaja(
      caja.x, caja.y, caja.z,
      caja.ancho + 1.0, caja.alto + 1.0, caja.profundidad + 1.0,
    );

    let recogidos = 0;

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      if (Math.abs(item.z) > 3) continue;

      const cajaItem = crearCaja(item.x, ESTAMINA.ALTURA, item.z, 0.6, 0.8, 0.6);

      if (hayColisionPlana(cajaRecogida, cajaItem)) {
        this.valor = Math.min(ESTAMINA.MAXIMA, this.valor + ESTAMINA.RECUPERACION_POR_ITEM);
        this._devolver(item);
        this.activos.splice(i, 1);
        recogidos++;
        this.recogidoEsteFotograma = true;
      }
    }

    return recogidos;
  }

  // -------------------------------------------------------------------------
  // CONSULTAS
  // -------------------------------------------------------------------------

  /** ¿Está el jugador por debajo del umbral de lentitud? */
  estaExhausto() {
    return this.valor < ESTAMINA.UMBRAL_LENTITUD;
  }

  /** Multiplicador de velocidad que impone la estamina actual. */
  multiplicadorVelocidad() {
    return this.estaExhausto() ? ESTAMINA.PENALIZACION_VELOCIDAD : 1.0;
  }

  /** Fracción 0..1 para pintar la barra del HUD. */
  fraccion() {
    return this.valor / ESTAMINA.MAXIMA;
  }

  // -------------------------------------------------------------------------
  // TEMA Y CICLO DE VIDA
  // -------------------------------------------------------------------------

  aplicarTema(escenario) {
    this.colorItem = escenario.estamina?.color ?? 0x7cffb2;
    this.nombreItem = escenario.estamina?.nombre ?? 'Estamina';
    this.modeloItem = escenario.estamina?.modelo ?? 'encebollado';

    // Vaciamos pista y pool para que los ítems se reconstruyan con el color nuevo.
    this.limpiar();
    for (const malla of this.pool) {
      this.grupo.remove(malla);
      malla.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.pool = [];
  }

  limpiar() {
    for (const item of this.activos) {
      this.grupo.remove(item.malla);
      item.malla.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.activos = [];
  }

  reiniciar() {
    this.limpiar();
    this.valor = ESTAMINA.INICIAL;
    this.distanciaDesdeUltimo = 0;
  }
}
