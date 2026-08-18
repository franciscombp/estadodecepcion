// ============================================================================
// POTENCIADORES — Los power-ups, y por qué llegan tarde a propósito
// ============================================================================
// Son los de Subway Surfers traducidos a la redacción de un periódico: imán,
// multiplicador, botas, escudo y "jetpack". Mecánicamente no inventamos nada,
// que es la regla del proyecto.
//
// LO QUE SÍ ES UNA DECISIÓN: no están desde el principio.
//
// Un juego que te lo enseña todo en la primera partida no da ninguna razón
// para jugar la segunda. Aquí se abren de uno en uno según cuántos tramos
// llevas recorridos en total (3, 6, 10, 15, 22), así que las primeras cinco o
// seis corridas terminan cada una con algo nuevo que probar. Ese goteo es el
// gancho, y el hecho de que el contador sea acumulativo entre partidas
// significa que ninguna corrida se pierde del todo: hasta la peor te acerca al
// siguiente desbloqueo.
//
// El catálogo y los tiempos están en config/balance.js. Los efectos NO viven
// aquí: este módulo solo pone las cápsulas en pista y avisa de la recogida.
// Quien aplica cada efecto es Game, que es quien tiene los subsistemas.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, POTENCIADORES, CATALOGO_POTENCIADORES, OBSTACULOS } from '../config/balance.js';
import { crearPotenciador } from '../models/props.js';
import { crearCaja, hayColisionPlana } from '../utils/collision.js';

export class PowerUpManager {
  constructor(escena, camara = null) {
    this.escena = escena;
    // La cámara, para encarar el estallido radial. Es el primer objeto del
    // juego que necesita billboarding.
    this.camara = camara;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activos = [];
    this.tiempo = 0;
    this.distanciaDesdeUltimo = 0;

    /** Ids que pueden salir. Los fija Game a partir del progreso guardado. */
    this.desbloqueados = [];
  }

  /** @param {string[]} ids */
  establecerDesbloqueados(ids) {
    this.desbloqueados = ids ?? [];
    this._filtrar();
  }

  /**
   * En qué escenario se está corriendo. Decide qué potenciadores de escena
   * propia entran (`soloEn` en el catálogo): la linterna es del Apagón y en
   * las otras tres no significaría nada, porque hay luz.
   * @param {string} id
   */
  establecerEscenario(id) {
    this.escenario = id;
    this._filtrar();
  }

  _filtrar() {
    this.disponibles = this.desbloqueados
      .map((id) => CATALOGO_POTENCIADORES.find((p) => p.id === id))
      .filter((p) => p && (!p.soloEn || p.soloEn === this.escenario));

    // Los de escena propia no dependen del progreso, así que se añaden aquí
    // aunque no vengan en la lista de desbloqueados.
    for (const p of CATALOGO_POTENCIADORES) {
      if (p.soloEn === this.escenario && !this.disponibles.includes(p)) {
        this.disponibles.push(p);
      }
    }
  }

  // -------------------------------------------------------------------------
  // GENERACIÓN
  // -------------------------------------------------------------------------

  /**
   * Game ofrece el hueco de un grupo recién generado.
   *
   * La colocación la manda el generador de obstáculos: es el único que sabe
   * qué carriles quedaron transitables y dónde cae el hueco entre grupos.
   *
   * @returns {boolean} true si se colocó un potenciador
   */
  intentarGenerar(carrilesLibres, z) {
    const catalogo = this.disponibles ?? [];
    if (catalogo.length === 0) return false;
    if (this.distanciaDesdeUltimo < POTENCIADORES.DISTANCIA_ENTRE) return false;
    if (!carrilesLibres || carrilesLibres.length === 0) return false;

    // El contador se reinicia salga o no salga premiado. Si no, una tirada
    // fallida dejaría el contador cargado y el siguiente grupo tendría un
    // potenciador casi garantizado, que es lo contrario de lo que se busca.
    this.distanciaDesdeUltimo = 0;
    if (Math.random() > POTENCIADORES.PROBABILIDAD) return false;

    const def = catalogo[Math.floor(Math.random() * catalogo.length)];
    if (!def) return false;

    const carril = carrilesLibres[Math.floor(Math.random() * carrilesLibres.length)];
    const malla = crearPotenciador(def.id, def.color);
    malla.position.set(CARRILES.POSICIONES[carril], POTENCIADORES.ALTURA, z);
    this.grupo.add(malla);

    this.activos.push({
      malla,
      def,
      x: CARRILES.POSICIONES[carril],
      z,
      // Fase propia para la flotación. Ver el bucle de actualización: usar la
      // Z hacía que «flotar» se convirtiera en temblar a cinco hercios.
      fase: Math.random() * Math.PI * 2,
    });

    return true;
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  actualizar(dt, avance) {
    this.tiempo += dt;
    this.distanciaDesdeUltimo += avance;

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const p = this.activos[i];
      p.z += avance;
      p.malla.position.z = p.z;

      // FLOTA, no tiembla. La fase iba en `p.z`, que avanza a la velocidad de
      // carrera: el seno corría a 17-34 rad/s, o sea un temblor de ±0.18 m a
      // entre tres y cinco hercios. Un objeto que vibra a cinco hercios no se
      // lee como flotando, se lee como ruido. Con una fase fija por pieza el
      // ciclo dura los 2.86 s que siempre quiso durar.
      p.malla.position.y = POTENCIADORES.ALTURA + Math.sin(this.tiempo * 2.2 + p.fase) * 0.18;
      p.malla.rotation.y = this.tiempo * 1.1;

      const u = p.malla.userData;

      // EL ESTALLIDO, ENCARADO A CÁMARA. Es un plano, así que sin esto se ve
      // de canto —o sea, no se ve— justo desde lejos, que es cuando tiene que
      // avisar de que hay algo. Se le quita el giro de la cápsula y se le pone
      // el suyo, lento, sobre el eje de visión.
      if (u.estallido && this.camara) {
        u.estallido.quaternion.copy(this.camara.quaternion);
        u.estallido.rotateZ(this.tiempo * 0.35);
      }

      // LA PEANA, PEGADA AL SUELO. Es hija del grupo, así que subía y bajaba
      // con la flotación y se hundía bajo el asfalto un tercio de cada ciclo.
      if (u.peana) u.peana.position.y = 0.02 - p.malla.position.y;

      if (u.aro) {
        // Sin `rotation.z`: el aro está tumbado (rotation.x = PI/2) y en orden
        // Euler XYZ la Z se aplica ANTES, o sea sobre su propio eje de
        // simetría. Geométricamente no pasaba nada; era trabajo por fotograma
        // que no pintaba un píxel.
        u.aro.scale.setScalar(1 + Math.sin(this.tiempo * 3.4) * 0.14);
      }
      if (u.cristal) {
        u.cristal.rotation.y = -this.tiempo * 1.8;
      }
      if (u.insignia) {
        // La insignia se mantiene de frente pese al giro de la cápsula: es lo
        // que hay que reconocer, y girándola se pierde la silueta la mitad del
        // tiempo.
        u.insignia.rotation.y = -this.tiempo * 1.1;
      }

      // Ver DISTANCIA_RECICLADO: nada sigue vivo por detrás de la cámara.
      if (p.z > OBSTACULOS.DISTANCIA_RECICLADO) {
        this._destruir(p);
        this.activos.splice(i, 1);
      }
    }
  }

  /**
   * Recoge el potenciador que toque el jugador.
   * @returns {object|null} La definición del recogido, o null
   */
  recoger(jugador) {
    const caja = jugador.obtenerCaja();
    const cajaRecogida = crearCaja(
      caja.x, caja.y, caja.z,
      caja.ancho + 1.4, caja.alto + 1.4, caja.profundidad + 1.4,
    );

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const p = this.activos[i];
      if (Math.abs(p.z) > 3.5) continue;

      // 0.9 de alto y no 1.2: con la cápsula bajada a la altura del pecho
      // (1.45), una caja de 1.2 llegaría hasta 0.85 y se podría recoger
      // agachado, que es justo lo que la regla de la casa no quiere.
      const cajaItem = crearCaja(p.x, POTENCIADORES.ALTURA, p.z, 0.9, 0.9, 0.9);
      if (!hayColisionPlana(cajaRecogida, cajaItem)) continue;

      const def = p.def;
      this._destruir(p);
      this.activos.splice(i, 1);
      return def;
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  _destruir(p) {
    this.grupo.remove(p.malla);
    p.malla.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  limpiar() {
    for (const p of this.activos) this._destruir(p);
    this.activos = [];
  }

  reiniciar() {
    this.limpiar();
    // Arranca a media carga: el primer potenciador de la partida no debería
    // hacerse esperar los 320 metros completos.
    this.distanciaDesdeUltimo = POTENCIADORES.DISTANCIA_ENTRE * 0.55;
  }
}
