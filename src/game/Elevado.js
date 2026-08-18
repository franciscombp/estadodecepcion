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
import { CARRILES, ELEVADO, SALTO } from '../config/balance.js';
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

    // DOS TARIMAS VIVAS, NO UNA.
    //
    // Con el tope en una sola, la configuración decía 95 m entre tarimas y la
    // realidad eran 340-370: la siguiente no podía nacer hasta que la anterior
    // se destruía, y la anterior no se destruía hasta haber recorrido su largo
    // entero más cuarenta metros de cortesía. Salían dos por tramo, una cada
    // once o veintitrés segundos. En la referencia los trenes por los que se
    // corre por encima son parte constante del recorrido, no una rareza.
    //
    // Con dos vivas y el reciclado a doce metros, el intervalo real baja a
    // 95-130 m: una cada seis u ocho segundos a velocidad de crucero.
    //
    // LA CONDICIÓN DE NO SOLAPARSE NO ES OPCIONAL: dos tarimas reservan dos
    // carriles, y si se solapan en Z el generador de obstáculos se queda con
    // uno solo para repartirlo todo y el juego degenera en pasillo único.
    if (!this.generacionPausada
        && this.distanciaDesdeUltima >= ELEVADO.DISTANCIA_ENTRE
        && this.activas.length < (ELEVADO.MAXIMO_VIVAS ?? 2)
        // Que no se solapen en Z: dos hileras reservan dos carriles, y si se
        // pisan el generador de obstáculos se queda con uno solo para todo y
        // el juego degenera en pasillo único. El margen es el hueco saltable.
        && !this.activas.some((t) => t.z - t.largoTotal < ELEVADO.DISTANCIA_ENTRE)) {
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
      if (t.z - t.largoTotal > 12) {
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

    const malla = crearTarima(largo, this.colores, this.idEscenario);
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
    obstaculos?.reservar(carril, z - largoTotal - 6, z + 8);

    // Premio por subir: una hilera de papeles sobre el tablado. Es la razón
    // para tomar la rampa en vez de ignorarla.
    // LA CINTA EMPIEZA EN LA RAMPA, no pasada la rampa.
    //
    // Arrancaba en `z - LARGO_RAMPA - 2`, o sea ya arriba del todo: los cinco
    // metros y medio de rampa no tenían ni una moneda, y por tanto nada decía
    // que aquello se pudiera subir. En la referencia la cinta de monedas ES la
    // señal de por dónde va el camino, y arquea hacia arriba precisamente
    // donde hay que subir.
    //
    // Ahora sube con la rampa: la reserva de carril se amplía a z + 8 para que
    // esas piezas no caigan donde el generador sí pone obstáculos.
    papeles?.generarHileraElevada(
      carril,
      z + 4,
      largo + ELEVADO.LARGO_RAMPA,
      ELEVADO.ALTURA,
      { zRampaFin: z - ELEVADO.LARGO_RAMPA, zRampaIni: z },
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
        if (!t.impulsoDado) {
          t.impulsoDado = true;
          if (!jugador.estaEnElAire) {
            jugador.impulsar(ELEVADO.IMPULSO_RAMPA);
          } else if (jugador.y < ELEVADO.ALTURA) {
            // LLEGAR SALTANDO YA NO TE CUESTA LA TARIMA. Antes la rampa solo
            // empujaba a quien venía por el suelo, así que saltar justo antes
            // —que es lo que hace cualquiera al ver una rampa— te dejaba
            // pasando por debajo: la rampa castigaba por saltar.
            // Ahora se le completa la velocidad vertical justo hasta la altura
            // del tablado, ni un centímetro más. Una vez por tarima, y solo
            // dentro de la rampa, para que no se lea como un doble salto.
            const falta = ELEVADO.ALTURA - jugador.y;
            const necesaria = Math.sqrt(2 * SALTO.GRAVEDAD * falta);
            if (jugador.velocidadY < necesaria) jugador.velocidadY = necesaria;
          }
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

  /**
   * @param {object} colores
   * @param {string} idEscenario Decide QUÉ sostiene el tablado: contenedores de
   *   puerto en la Bahía, buses parados en fila en el resto. Ver crearTarima().
   */
  aplicarTema(colores, idEscenario = 'bahia') {
    this.colores = colores;
    this.idEscenario = idEscenario;
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
