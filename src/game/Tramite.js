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
import { CARRILES, TRAMITE, EVIDENCIA } from '../config/balance.js';
import { crearGaleriaTramite } from '../models/props.js';
import { HUECO } from './Luces.js';

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
   * @param {number} evidenciaDelJugador Lo que llevaba recogido al entrar
   */
  iniciar(colores, institucion, papeles, evidenciaDelJugador) {
    this.limpiar();

    this.activo = true;
    this.recorrido = 0;
    this.recuperadas = 0;
    this.institucion = institucion;
    this.confiscados = Math.max(0, Math.floor(evidenciaDelJugador));

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
    // DOS FAROLAS DEL APAREJO, NO TRES COLGADAS. Ver game/Luces.js: crear luces
    // al empezar el trámite subía el recuento de la escena y recompilaba todos
    // los materiales, o sea que entrar al pasillo costaba un tirón. Ahora se
    // piden dos huecos que ya existen y se colocan; la tercera sobraba —con el
    // alcance de 44 m las dos cubren el pasillo entero—.
    const rig = this.escena.userData.rig;
    this.rig = rig;
    if (rig) {
      const color = colores.acento ?? 0xffcf3f;
      rig.encender(HUECO.TRAMITE, { x: 0, y: 5, z: -16 }, color, 15, 44);
      rig.encender(HUECO.LIBRE, { x: 0, y: 5, z: -58 }, color, 15, 44);
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
    if (this.confiscados <= 0) { this.piezas = 0; return; }

    const util = TRAMITE.LONGITUD - TRAMITE.ENTRADA - TRAMITE.COLA;
    const rodajasMax = Math.max(1, Math.floor(util / TRAMITE.PASO_MINIMO) + 1);

    // Cuántas PIEZAS se dibujan. Es un tope de dibujo, no de cuenta.
    this.piezas = Math.max(1, Math.min(this.confiscados, TRAMITE.PIEZAS_MAXIMAS, rodajasMax));
    const paso = this.piezas > 1 ? util / (this.piezas - 1) : 0;

    // CADA PIEZA LLEVA UN NÚMERO ENTERO DE EVIDENCIA, Y LA SUMA CUADRA EXACTA.
    //
    // Antes cada pieza valía `confiscados / piezas` —un decimal— y lo devuelto
    // se redondeaba al final. Mientras cupieran todos daba igual, porque ese
    // decimal valía 1; en cuanto el montón pasaba del tope, cada pieza pasaba a
    // valer 1,25 o 2,5 y entonces recoger 320 cosas devolvía 800 papeles. Ese
    // es el «el cálculo final es mayor al de lo recogido por dos»: no era el
    // ×2, era que cada cosa del suelo valía más de un papel sin decirlo.
    //
    // Repartiendo en enteros —unas piezas llevan uno más que otras— lo que
    // vuelve al marcador es SIEMPRE la suma de lo que levantaste, por dos.
    const base = Math.floor(this.confiscados / this.piezas);
    const sobran = this.confiscados - base * this.piezas;

    let carril = CARRILES.CENTRO;
    let ultimoCambio = -Infinity;

    for (let i = 0; i < this.piezas; i++) {
      const avance = i * paso;

      // El cambio de carril se mide en METROS recorridos, no en papeles: con el
      // reparto apretándose según cuántos lleves, contar papeles haría que un
      // montón grande zigzagueara cada palmo y el reguero perdería la forma.
      if (avance - ultimoCambio >= TRAMITE.TRAMO_CARRIL) {
        const opciones = [0, 1, 2].filter((c) => c !== carril);
        carril = opciones[Math.floor(Math.random() * opciones.length)];
        ultimoCambio = avance;
      }

      // Los que sobran se reparten POR TODO EL PASILLO, no desde el principio.
      // Es el reparto de Bresenham: da exactamente `sobran` piezas gordas y las
      // deja lo más separadas posible entre sí. Amontonándolas al principio, el
      // primer tercio del túnel valía el doble que el último y la jugada óptima
      // pasaba a ser recoger pronto y desentenderse del resto.
      const extra = (i * sobran) % this.piezas < sobran ? 1 : 0;

      papeles.plantarEvidencia(
        CARRILES.POSICIONES[carril],
        // Casi por el suelo: se los tiraron, no se los colocaron.
        EVIDENCIA.ALTURA * 0.55,
        -TRAMITE.ENTRADA - avance,
        base + extra,
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

  /**
   * Registra EVIDENCIA levantados del suelo, no piezas.
   *
   * Quien llama pasa el valor sumado de lo recogido este fotograma, que es lo
   * que llevaba cada pieza. Contando piezas y multiplicando después había que
   * fiarse de una media, y la media mentía en cuanto las piezas no valían todas
   * lo mismo.
   */
  contar(papelesLevantados) {
    this.recuperadas += papelesLevantados;
  }

  /** Cuántos papeles levantaste del suelo, en crudo y sin el ×2. */
  evidenciaRecuperada() {
    return Math.min(this.confiscados, this.recuperadas);
  }

  /**
   * Lo que de verdad vuelve al marcador: lo recuperado POR DOS.
   *
   * El multiplicador vive aquí y no en Game para que la pantalla de salida y la
   * cuenta del jugador saquen la cifra del mismo sitio. Cuando estaban en dos
   * lados, la pantalla decía una cosa y el contador otra.
   */
  evidenciaDevuelta() {
    return this.evidenciaRecuperada() * TRAMITE.MULTIPLICADOR_RESCATE;
  }

  /**
   * Cuántos se quedaron por el suelo.
   *
   * Se cuenta sobre lo RECUPERADO EN CRUDO, no sobre lo devuelto: el ×2 es una
   * bonificación, no papeles que hayas levantado. Si se restara lo devuelto,
   * recuperar más de la mitad daría «perdidos: 0» con medio pasillo aún lleno
   * de papeles, y la cifra dejaría de significar nada.
   */
  evidenciaPerdida() {
    return Math.max(0, this.confiscados - this.evidenciaRecuperada());
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
    if (this.confiscados === 0) return 0;
    const util = TRAMITE.LONGITUD - TRAMITE.ENTRADA - TRAMITE.COLA;
    const f = (this.recorrido - TRAMITE.ENTRADA) / util;
    return Math.round(Math.min(1, Math.max(0, f)) * this.confiscados);
  }

  /** Fracción 0..1 de expediente recuperado. */
  fraccion() {
    if (this.confiscados === 0) return 0;
    return Math.min(1, this.recuperadas / this.confiscados);
  }

  /** ¿Se recuperó absolutamente todo? Prácticamente imposible. */
  esPerfecto() {
    return this.confiscados > 0
      && this.recuperadas >= this.confiscados * TRAMITE.UMBRAL_PERFECTO;
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
    // Las farolas son del aparejo: se apagan, no se quitan. Quitarlas movería
    // el recuento de luces y recompilaría la escena entera. Ver game/Luces.js.
    if (this.rig) {
      this.rig.apagar(HUECO.TRAMITE);
      this.rig.apagar(HUECO.LIBRE);
    }
    this.luces = [];
    this.activo = false;
    this.recorrido = 0;
    this.piezas = 0;
    this.recuperadas = 0;
    this.confiscados = 0;
    this.valorPorPieza = 0;
  }
}
