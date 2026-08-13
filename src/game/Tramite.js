// ============================================================================
// EL ENTE DE CONTROL — El túnel del centro
// ============================================================================
// Ver docs/GUION.md. Entrar de frente NO es un premio, y esa es la broma
// central del juego.
//
// LO QUE PASA AL ENTRAR
// La institución te riega los papeles. TODOS: el marcador se pone a cero en el
// acto. No aparecen papeles nuevos, se desparraman por el pasillo LOS QUE
// TRAÍAS, en los tres carriles, y hay que recuperar los que se pueda mientras
// corres. No hay obstáculos aquí dentro porque el obstáculo es la propia
// institución, que ya te quitó lo que tenías.
//
// LO QUE RECUPERAS VALE ×2 (ver TRAMITE.MULTIPLICADOR_RESCATE). El equilibrio
// está en levantar la mitad del reguero: menos, y sales perdiendo; más, y el
// pasillo te pagó. Sin ese multiplicador esto era un castigo puro y la única
// jugada correcta era no entrar nunca, que es tanto como no tener el tramo.
//
// LO QUE PASA AL SALIR
// Te dan con la puerta en las narices —se archiva el caso, faltan votos, te
// quitan los derechos políticos— pero sales con la pieza que te faltaba del
// caso. Esa asimetría es lo que sostiene el modo historia:
//
//   · Para el ARCHIVO el trámite RINDE SIEMPRE: sales con el hallazgo.
//   · Para el MARCADOR es UNA APUESTA: sales con más o con menos según lo que
//     hayas alcanzado a levantar del suelo.
//
// Documentar nunca se castiga; correr mal, sí.
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
   * Desparrama el montón por el pasillo. TODO el montón.
   *
   * UN PAPEL DEL SUELO ES UN PAPEL TUYO. Antes se regaba un número acotado de
   * piezas y cada una valía una fracción del montón; la cuenta cuadraba pero
   * era ilegible —trescientos papeles se convertían en cincuenta cosas por el
   * suelo que valían seis cada una—. Ahora se planta uno por papel y
   * `valorPorPieza` vale exactamente 1 en cuanto caben todos, que es el caso
   * normal.
   *
   * EL REGUERO OCUPA SIEMPRE EL PASILLO ENTERO. El hueco entre papeles sale de
   * dividir el recorrido útil entre los que hay, no de una separación fija.
   * Con una separación fija, el reguero medía lo que midiera: setenta y dos
   * papeles a tres metros llenaban 216 de los 340, y trescientos se habrían
   * salido novecientos metros por detrás del final del pasillo —o sea que la
   * mayoría no habría llegado a pasar nunca por delante del jugador—.
   *
   * UNO POR RODAJA, Y LA RODAJA CAMBIA DE CARRIL. Es lo que sostiene el
   * equilibrio del tramo: con un solo carril ocupado de tres, quien no se mueve
   * levanta un tercio del reguero, y un tercio por dos es menos de lo que
   * entró. Hay que tejer para salir ganando. Solo cuando ya no caben más
   * rodajas se ponen dos papeles en una, y entonces en carriles distintos.
   */
  _regar(papeles) {
    const util = TRAMITE.LONGITUD - TRAMITE.ENTRADA - TRAMITE.COLA;
    const rodajasMax = Math.max(1, Math.floor(util / TRAMITE.PASO_MINIMO) + 1);

    // Hasta dos por rodaja antes de rendirse y empezar a agrupar valor.
    const tope = Math.min(TRAMITE.PIEZAS_MAXIMAS, rodajasMax * 2);
    this.piezas = Math.max(1, Math.min(this.confiscados, tope));
    // Vale 1 mientras quepan todos. Solo se despega de 1 en marcadores enormes.
    this.valorPorPieza = this.confiscados / this.piezas;

    const rodajas = Math.min(this.piezas, rodajasMax);
    const paso = rodajas > 1 ? util / (rodajas - 1) : 0;

    let carril = CARRILES.CENTRO;
    let ultimoCambio = -Infinity;
    let puestos = 0;

    for (let r = 0; r < rodajas; r++) {
      const avance = r * paso;

      // El cambio de carril se mide en METROS recorridos, no en papeles: con el
      // reparto apretándose según cuántos lleves, contar papeles haría que un
      // montón grande zigzagueara cada palmo y el reguero perdería la forma.
      if (avance - ultimoCambio >= TRAMITE.TRAMO_CARRIL) {
        const opciones = [0, 1, 2].filter((c) => c !== carril);
        carril = opciones[Math.floor(Math.random() * opciones.length)];
        ultimoCambio = avance;
      }

      // El resto se reparte parejo entre las rodajas que quedan, para que la
      // cola del reguero no se quede vacía ni se amontone al final.
      const enEsta = Math.ceil((this.piezas - puestos) / (rodajas - r));
      const z = -TRAMITE.ENTRADA - avance;
      const ocupados = [carril];

      for (let k = 0; k < enEsta; k++) {
        let c = carril;
        if (k > 0) {
          const libres = [0, 1, 2].filter((x) => !ocupados.includes(x));
          if (!libres.length) break;
          c = libres[Math.floor(Math.random() * libres.length)];
          ocupados.push(c);
        }
        papeles.plantarPapel(
          CARRILES.POSICIONES[c],
          // Casi por el suelo: se los tiraron, no se los colocaron.
          PAPELES.ALTURA * 0.55,
          z,
        );
        puestos += 1;
      }
    }

    // Si algo se quedó fuera por el tope de carriles, la cuenta tiene que
    // reflejar lo que HAY en el suelo: si no, el expediente pediría recoger
    // papeles que nunca se plantaron y jamás se podría completar.
    this.piezas = puestos;
    this.valorPorPieza = puestos > 0 ? this.confiscados / puestos : 0;
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

  /** Cuántos papeles levantaste del suelo, en crudo y sin el ×2. */
  papelesRecuperados() {
    return Math.round(this.recuperadas * this.valorPorPieza);
  }

  /**
   * Lo que de verdad vuelve al marcador: lo recuperado POR DOS.
   *
   * El multiplicador vive aquí y no en Game para que la pantalla de salida y la
   * cuenta del jugador saquen la cifra del mismo sitio. Cuando estaban en dos
   * lados, la pantalla decía una cosa y el contador otra.
   */
  papelesDevueltos() {
    return this.papelesRecuperados() * TRAMITE.MULTIPLICADOR_RESCATE;
  }

  /**
   * Cuántos se quedaron por el suelo.
   *
   * Se cuenta sobre lo RECUPERADO EN CRUDO, no sobre lo devuelto: el ×2 es una
   * bonificación, no papeles que hayas levantado. Si se restara lo devuelto,
   * recuperar más de la mitad daría «perdidos: 0» con medio pasillo aún lleno
   * de papeles, y la cifra dejaría de significar nada.
   */
  papelesPerdidos() {
    return Math.max(0, this.confiscados - this.papelesRecuperados());
  }

  /**
   * Cuántos papeles del reguero han quedado ya por detrás.
   *
   * Se saca de la MISMA geometría con la que se plantaron, no de la barra de
   * avance del pasillo. Aproximarlo con `progreso × total` sale mal en los dos
   * extremos: el reguero empieza en el metro 20 y termina 18 antes del final,
   * así que al entrar decía que ya habían pasado veinte papeles cuando no había
   * pasado ninguno —y el marcador te daba por perdido antes de empezar—.
   */
  piezasPasadas() {
    if (this.piezas === 0) return 0;
    const util = TRAMITE.LONGITUD - TRAMITE.ENTRADA - TRAMITE.COLA;
    const f = (this.recorrido - TRAMITE.ENTRADA) / util;
    return Math.round(Math.min(1, Math.max(0, f)) * this.piezas);
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
