// ============================================================================
// AGUANTE — Los ítems propios de cada escena
// ============================================================================
// Este módulo hace DOS cosas distintas según la escena, y la diferencia es
// deliberada (ver ESTAMINA en config/balance.js para el porqué largo):
//
//   · EN EL APAGÓN es un RECURSO. Hay barra, drena, y quedarse a cero es
//     derrota directa —sin luz no ves por dónde corres ni hay nada que
//     documentar—. Ahí el recurso no es un añadido: es la escena.
//
//   · EN LAS DEMÁS es un BONUS. La comida suma papeles y punto. No hay barra,
//     no drena nada, y no pasa absolutamente nada por ignorarla.
//
// El resumen de por qué: con drenaje en las cuatro, los números daban una
// barra que no bajaba nunca si recogías, y un castigo extra si ya ibas mal.
// Ni tensión ni decisión, solo un medidor más en pantalla.
//
// Cada escena tiene SUS ítems, y pueden ser varios: en la Bahía sale
// encebollado, guata o bolón; en el centro histórico, canelazo o mote.
// Ver docs/GUION.md.
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
    this.pool = new Map();

    this.tiempo = 0;
    this.distanciaDesdeUltimo = 0;

    // Catálogo de la escena actual: uno o varios ítems que se turnan.
    this.catalogo = [{ modelo: 'encebollado', nombre: 'Encebollado', color: 0xff8c42 }];
    this.etiqueta = 'AGUANTE';
    this.icono = 'encebollado';
    // ¿Es un recurso con barra (Apagón) o un bonus suelto (el resto)?
    this.esRecurso = false;
    // Nombre del último recogido, para el remate del HUD.
    this.nombreItem = 'Encebollado';

    // Se pone a true cuando se recoge un ítem, para que Game.js dispare
    // efectos (destello de linterna en el Apagón, por ejemplo).
    this.recogidoEsteFotograma = false;
  }

  // -------------------------------------------------------------------------
  // POOL
  // -------------------------------------------------------------------------

  /**
   * El pool va indexado por modelo. Con varios ítems por escena, un pool único
   * devolvería un bolón cuando tocaba un encebollado.
   */
  _obtener(def) {
    const libres = this.pool.get(def.modelo);
    if (libres?.length > 0) {
      const m = libres.pop();
      m.visible = true;
      return m;
    }
    const m = crearItemEstamina(def.color, def.modelo);
    m.userData.modelo = def.modelo;
    this.grupo.add(m);
    return m;
  }

  _devolver(item) {
    item.malla.visible = false;
    const modelo = item.malla.userData.modelo ?? 'encebollado';
    const libres = this.pool.get(modelo) ?? [];

    if (libres.length < 4) {
      libres.push(item.malla);
      this.pool.set(modelo, libres);
    } else {
      this.grupo.remove(item.malla);
      this._destruir(item.malla);
    }
  }

  _destruir(malla) {
    malla.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {number} avance
   */
  actualizar(dt, avance) {
    this.tiempo += dt;
    this.recogidoEsteFotograma = false;

    // --- Drenaje -----------------------------------------------------------
    // Solo donde el aguante es un recurso. En el resto la barra se queda
    // llena, no se pinta, y no interviene en nada.
    if (this.esRecurso) {
      this.valor = Math.max(0, this.valor - ESTAMINA.DRENAJE * dt);
    }
    this.distanciaDesdeUltimo += avance;

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
   * Game ofrece un hueco recién generado. Si toca ítem, se coloca aquí.
   *
   * La colocación no la decide la estamina: la decide el generador de
   * obstáculos, que es quien sabe qué carriles quedaron transitables y dónde
   * está el hueco entre grupos. Poner el ítem en una Z al azar acabaría
   * metiéndolo dentro de un muro.
   *
   * @param {number[]} carrilesLibres Carriles donde es seguro ponerlo
   * @param {number} z                Mitad del hueco entre grupos
   * @returns {boolean} true si se colocó
   */
  ofrecerHueco(carrilesLibres, z) {
    if (this.distanciaDesdeUltimo < ESTAMINA.DISTANCIA_ENTRE_ITEMS) return false;
    if (!carrilesLibres || carrilesLibres.length === 0) return false;

    this._generar(carrilesLibres, z);
    this.distanciaDesdeUltimo = 0;
    return true;
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
    const def = this.catalogo[Math.floor(Math.random() * this.catalogo.length)];
    const malla = this._obtener(def);

    malla.position.set(CARRILES.POSICIONES[carril], ESTAMINA.ALTURA, z);

    this.activos.push({
      malla,
      def,
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
        this.nombreItem = item.def?.nombre ?? this.nombreItem;
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
    return this.esRecurso && this.valor < ESTAMINA.UMBRAL_LENTITUD;
  }

  /** Multiplicador de velocidad que impone el aguante actual. */
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
    const cfg = escenario.estamina ?? {};
    this.esRecurso = !!escenario.aguanteEsRecurso;
    this.catalogo = cfg.items?.length
      ? cfg.items
      : [{ modelo: 'encebollado', nombre: 'Encebollado', color: 0xff8c42 }];
    this.etiqueta = cfg.etiqueta ?? (cfg.nombre ?? 'AGUANTE').toUpperCase();
    this.icono = cfg.icono ?? this.catalogo[0].modelo;
    this.nombreItem = this.catalogo[0].nombre;

    // Vaciamos pista y pool: los ítems guardados son de la escena anterior.
    this.limpiar();
    for (const [, mallas] of this.pool) {
      for (const malla of mallas) {
        this.grupo.remove(malla);
        this._destruir(malla);
      }
    }
    this.pool.clear();
  }

  /** ¿Se acabó del todo? En el Apagón esto es derrota, no lentitud. */
  estaAgotada() {
    return this.esRecurso && this.valor <= 0;
  }

  limpiar() {
    for (const item of this.activos) {
      this.grupo.remove(item.malla);
      this._destruir(item.malla);
    }
    this.activos = [];
  }

  reiniciar() {
    this.limpiar();
    this.valor = ESTAMINA.INICIAL;
    this.distanciaDesdeUltimo = 0;
  }
}
