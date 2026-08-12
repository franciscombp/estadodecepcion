// ============================================================================
// NIVELES ELEVADOS — Las tarimas
// ============================================================================
// La capa de arriba, que es lo que en Subway Surfers son los trenes: un piso
// alternativo por el que se corre a 1.55 m del asfalto. Aquí son TARIMAS de
// campaña, los tablados que se montan en cada esquina en época electoral —lo
// cual, en este juego, es siempre.
//
// CÓMO SE JUEGA
//   · La rampa está delante y ocupa el carril entero: si vienes por ahí, subes.
//     No hay que pulsar nada. Una rampa que te mata por no saltar no es una
//     rampa, es un obstáculo disfrazado.
//   · Arriba corres por encima de la calle. Los papeles buenos están ahí.
//   · Cuando el tablado se acaba, te caes. Bajarse a tiempo —o saltar el hueco
//     al final— es la habilidad que se pide.
//
// POR QUÉ NO ES UN OBSTÁCULO MÁS
// El generador de obstáculos garantiza que todo grupo sea superable eligiendo
// un carril solución. Una tarima ocupa 20-35 metros seguidos, o sea VARIOS
// grupos: si se colara ahí dentro rompería esa garantía. Por eso vive en su
// propio gestor y RESERVA su carril en el generador mientras dura.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, ELEVADO } from '../config/balance.js';
import { crearTarima } from '../models/props.js';

export class ElevadoManager {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    /** Tarimas en pista. Rara vez hay más de una. */
    this.activas = [];
    this.colores = { props: 0xc9884a, acento: 0xffcf3f };
    this.distanciaDesdeUltima = 0;
    this.generacionPausada = false;
  }

  // -------------------------------------------------------------------------
  // GENERACIÓN
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {number} avance
   * @param {Player} jugador
   * @param {ObstacleManager} obstaculos Para reservarle el carril
   * @param {CoinManager} papeles        Para premiar el nivel de arriba
   */
  actualizar(dt, avance, jugador, obstaculos, papeles) {
    this.distanciaDesdeUltima += avance;

    if (!this.generacionPausada
        && this.distanciaDesdeUltima >= ELEVADO.DISTANCIA_ENTRE
        && this.activas.length === 0) {
      this._generar(obstaculos, papeles);
      this.distanciaDesdeUltima = 0;
    }

    // Mover y reciclar.
    for (let i = this.activas.length - 1; i >= 0; i--) {
      const t = this.activas[i];
      t.z += avance;
      t.malla.position.z = t.z;

      // El pie de la rampa es el borde CERCANO y el tablado se extiende hacia
      // -Z, así que el borde lejano está en z - largoTotal. La tarima entera
      // ha quedado atrás cuando incluso ese ha pasado de largo al jugador.
      if (t.z - t.largoTotal > 40) {
        this._destruir(t);
        this.activas.splice(i, 1);
      }
    }

    return this._resolverSuelo(jugador);
  }

  _generar(obstaculos, papeles) {
    const carril = Math.floor(Math.random() * 3);
    const largo = ELEVADO.LARGO_MINIMO
      + Math.random() * (ELEVADO.LARGO_MAXIMO - ELEVADO.LARGO_MINIMO);

    // Se planta lejos, donde todavía no hay nada generado que pueda quedar
    // atrapado debajo.
    const z = -260;
    const largoTotal = largo + ELEVADO.LARGO_RAMPA;

    const malla = crearTarima(largo, this.colores);
    malla.position.set(CARRILES.POSICIONES[carril], 0, z);
    this.grupo.add(malla);

    const tarima = {
      malla,
      carril,
      x: CARRILES.POSICIONES[carril],
      z,                 // Pie de la rampa (el borde cercano)
      largo,
      largoTotal,
    };
    this.activas.push(tarima);

    // El carril queda reservado: el generador de obstáculos no pondrá nada
    // ahí mientras la tarima ocupe ese tramo. Sin esto, un bloque sólido
    // aparecería dentro de la madera.
    obstaculos?.reservar(carril, z - largoTotal - 6, z + 6);

    // Premio por subir: una hilera de papeles sobre el tablado. Es la razón
    // para tomar la rampa en vez de ignorarla.
    papeles?.generarHileraElevada(
      carril,
      z - ELEVADO.LARGO_RAMPA - 2,
      largo - 4,
      ELEVADO.ALTURA,
    );
  }

  // -------------------------------------------------------------------------
  // SUELO
  // -------------------------------------------------------------------------

  /**
   * Decide a qué altura está el suelo bajo el jugador y, de paso, dispara el
   * impulso de la rampa.
   *
   * El jugador está siempre en z=0: es el mundo el que se mueve. Así que basta
   * con mirar si el 0 cae dentro del tramo de alguna tarima del mismo carril.
   *
   * @returns {number} Altura del suelo
   */
  _resolverSuelo(jugador) {
    for (const t of this.activas) {
      if (t.carril !== jugador.carril) continue;

      // Cuánto lleva recorrido el jugador dentro de la tarima. El pie de la
      // rampa está en t.z y el tablado se extiende hacia -Z, así que en cuanto
      // t.z pasa de 0 esa misma cifra ES la distancia recorrida encima.
      const avanceEnTarima = t.z;

      if (avanceEnTarima < 0 || avanceEnTarima > t.largoTotal) continue;

      // --- Rampa -----------------------------------------------------------
      if (avanceEnTarima <= ELEVADO.LARGO_RAMPA) {
        // Solo empuja si viene por el suelo. Quien llega saltando ya está
        // arriba y no necesita ayuda; darle otro impulso lo lanzaría al cielo.
        if (!jugador.estaEnElAire && !t.impulsoDado) {
          t.impulsoDado = true;
          jugador.impulsar(ELEVADO.IMPULSO_RAMPA);
        }
        // Durante la rampa el suelo sube linealmente: si el jugador vuelve a
        // tocarla, se apoya en la pendiente y no atraviesa la madera.
        return (avanceEnTarima / ELEVADO.LARGO_RAMPA) * ELEVADO.ALTURA;
      }

      // --- Tablado ---------------------------------------------------------
      // El suelo elevado solo cuenta si el jugador está a su altura o por
      // encima. Si viene por debajo (saltó fuera y volvió), sigue en la calle.
      if (jugador.y >= ELEVADO.ALTURA - ELEVADO.MARGEN_ATERRIZAJE) {
        return ELEVADO.ALTURA;
      }
      return 0;
    }

    return 0;
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  aplicarTema(colores) {
    this.colores = colores;
    this.limpiar();
  }

  _destruir(t) {
    this.grupo.remove(t.malla);
    t.malla.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  limpiar() {
    for (const t of this.activas) this._destruir(t);
    this.activas = [];
  }

  reiniciar() {
    this.limpiar();
    this.distanciaDesdeUltima = 0;
    this.generacionPausada = false;
  }
}
