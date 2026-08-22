// ============================================================================
// BIFURCACIÓN — El desvío se decide corriendo, no en un menú
// ============================================================================
// Al final de cada tramo la calle topa con UN EDIFICIO: la Fiscalía, la
// Asamblea, Carondelet. El carril en el que estés al llegar decide la
// temporada. No se para el juego, no aparece una pantalla; eliges con el
// cuerpo, como en Temple Run.
//
//   por la izquierda → temporada vecina de la izquierda
//   de frente        → el trámite (la vía institucional), por su portal
//   por la derecha   → temporada vecina de la derecha
//
// POR QUÉ UN EDIFICIO Y NO TRES BOCAS DE TÚNEL
// Antes había un paredón con tres agujeros, uno por carril, y funcionaba como
// mecánica pero no significaba nada: la calle acababa en una pieza de utilería
// idéntica en los cuatro escenarios. Lo que corta una calle en una ciudad es
// un edificio, y aquí además es EL edificio —el sitio al que se está entrando
// a preguntar—, así que la decisión pasa a leerse sola: de frente se entra ahí
// dentro, por los lados se dobla la esquina. Ver crearCruceDeEdificios().
//
// El corte de escenario ya no lo tapa un túnel sino el soportal lateral (ver
// _montarPaso): un pasaje corto que se cruza mientras el barrio de detrás se
// sustituye por el nuevo.
//
// SECUENCIA
//   1. AVISO       A 260 m aparecen los carteles de señalización, uno tras
//                  otro, y las flechas en el asfalto. El jugador SIGUE
//                  esquivando: la decisión se toma mientras se corre.
//   2. LIMPIEZA    A 110 m el corredor se vacía. Obligar a esquivar en el
//                  último tramo convertiría la decisión en un accidente:
//                  acabarías eligiendo el carril que te tocó esquivar.
//   3. ENTRADA     Al llegar a la fachada se lee el carril y se compromete.
//   4. TRÁNSITO    Por los costados, la ESQUINA: el tramo nuevo nace tendido
//                  en la transversal y gira 90° hasta quedar de frente
//                  mientras se cruza el soportal (ver Game._girarMundo).
//                  De frente (al trámite) no hay esquina: ahí sí tapa un
//                  destello, porque no hay nada que enseñar.
// ============================================================================

import * as THREE from 'three';
import { CARRILES } from '../config/balance.js';
import {
  crearCruceDeEdificios,
  crearPasoLateral,
  crearFlechaAsfalto,
  BOCACALLE,
} from '../models/props.js';
import { obtenerEscenario } from '../config/escenarios.js';
import { COLOR3D } from '../config/estilo.js';

export class Bifurcacion {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activa = false;       // ¿Hay cruce en pista?
    this.tuneles = null;       // El cruce de edificios
    this.flechas = [];
    this.z = 0;                // Posición de la fachada

    // Tránsito tras entrar.
    this.virando = false;
    this.direccionViraje = 0;  // -1 izquierda, 0 centro, 1 derecha
    this.tiempoViraje = 0;
    // De frente dura menos: no hay esquina que doblar. Por los costados el
    // viraje se alarga para que quepa la cinemática del giro (ver
    // cinematicaGiro): el personaje rota hacia la esquina, la cámara lo sigue
    // y se endereza ya dentro del soportal.
    this.DURACION_VIRAJE = 0.75;
    // BAJÓ DE 2.1 A 1.2 al pasar el giro al mundo (ver Game._girarMundo).
    // Los dos segundos largos eran para que a la CÁMARA le diera tiempo de
    // irse y volver sin tirones; una esquina de las de verdad —el escenario
    // rota, tú sigues corriendo— se dobla en un suspiro, y estirarla es
    // navegar. A 26 u/s esto es casi exactamente lo que se tarda en cruzar el
    // soportal de 30 metros: se entra doblando y se sale derecho.
    this.DURACION_VIRAJE_LATERAL = 1.2;

    // El soportal que se cruza al doblar la esquina.
    this.paso = null;
    this.zPaso = 0;
    // Treinta metros: a velocidad de crucero es algo más de un segundo dentro.
    // Menos y no da tiempo a leerlo como un sitio; más y se hace un túnel, que
    // es lo que tiene que seguir siendo exclusivo del trámite.
    this.LARGO_PASO = 30;
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  /**
   * Coloca la fachada de túneles y su señalización.
   *
   * @param {string} idEscenario Escenario actual
   * @param {object} colores     Paleta del escenario
   * @param {number} distancia   A cuántas unidades por delante ponerla
   */
  preparar(idEscenario, colores, distancia) {
    this.limpiar();

    const esc = obtenerEscenario(idEscenario);
    const izquierda = obtenerEscenario(esc.rutas.izquierda);
    const derecha = obtenerEscenario(esc.rutas.derecha);

    // Qué dice el rótulo del centro depende del escenario: en Carondelet no
    // hay institución, ir de frente es el cerco.
    const centroEsPeligro = !!esc.frenteEsMuerte;
    const destinos = {
      izquierda: izquierda.nombre,
      centro: centroEsPeligro ? 'EL CERCO' : (esc.institucion?.nombre ?? 'DE FRENTE'),
      derecha: derecha.nombre,
    };

    this.z = -distancia;

    // BIFURCA LA CIUDAD, no un paredón con tres agujeros. De frente está el
    // edificio de la institución con su portal; a los lados la calle sigue,
    // enmarcada por las medianeras del barrio. Ver crearCruceDeEdificios().
    // LAS DOS PALETAS VECINAS VIAJAN CON EL CRUCE. La bocacalle de cada lado se
    // pinta con el color del barrio al que lleva ESE lado, y sale de la misma
    // entrada de config/escenarios.js que usará el tramo nuevo al cruzar
    // (Game._cambiarEscenario → Track.aplicarTema). Calculadas por separado
    // acabarían diciendo cosas distintas el día que alguien toque una paleta, y
    // enseñar una calle morada y entregar una azul es peor que no enseñar nada.
    this.tuneles = crearCruceDeEdificios(
      destinos.centro, colores, centroEsPeligro, idEscenario,
      { izquierda: izquierda.colores, derecha: derecha.colores },
    );
    this.tuneles.position.z = this.z;
    this.grupo.add(this.tuneles);

    // AQUÍ YA NO HAY PÓRTICOS. Había tres carteles escalonados sobre la vía,
    // y el problema no era que estuvieran: era dónde. Un cartel modelado en el
    // mundo se ve en escorzo, se cruza en segundo y medio y hay que levantar
    // la vista del carril para leerlo justo cuando todavía se está esquivando.
    //
    // La señalización se fue al HUD (ver HUD.mostrarRotulo): baja desde arriba,
    // se queda quieta mientras dura la decisión y se lee entera. Lo que sigue
    // en el mundo son las flechas del asfalto, que están donde ya se está
    // mirando.

    // Flechas en el asfalto, repartidas por el corredor. Repiten en el suelo
    // lo que dicen los carteles, para que el jugador no tenga que levantar la
    // vista mientras se coloca.
    const direcciones = [
      { dir: 'izquierda', carril: 0, color: colores.acento ?? COLOR3D.dorado },
      { dir: 'centro', carril: 1, color: centroEsPeligro ? COLOR3D.rojo : COLOR3D.naranja },
      { dir: 'derecha', carril: 2, color: colores.acento ?? COLOR3D.dorado },
    ];

    for (let i = 0; i < 6; i++) {
      for (const d of direcciones) {
        const flecha = crearFlechaAsfalto(d.dir, d.color);
        flecha.position.x = CARRILES.POSICIONES[d.carril];
        // Detrás del borde cercano del cruce: una flecha pintada EN MEDIO de la
        // calzada transversal dice que hay que girar donde ya se está girando.
        flecha.position.z = this.z + BOCACALLE.FRENTE + 2 + i * 14;
        this.grupo.add(flecha);
        this.flechas.push(flecha);
      }
    }

    this.activa = true;

    // Se devuelven para que la interfaz pinte el cartel con lo mismo que dicen
    // las bocas: si los dos textos se calcularan por separado acabarían
    // diciendo cosas distintas el día que se toque uno.
    return { destinos, centroEsPeligro };
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * Mueve la fachada y su señalización hacia el jugador.
   *
   * @param {number} dt
   * @param {number} avance
   * @returns {boolean} true en el fotograma en que el jugador entra al túnel
   */
  actualizar(dt, avance, carril = CARRILES.CENTRO) {
    if (this.virando) {
      this.tiempoViraje += dt;
      if (this.tiempoViraje >= (this.duracionActual ?? this.DURACION_VIRAJE)) {
        this.virando = false;
        this.tiempoViraje = 0;
      }
    }

    // El soportal viaja hacia atrás y se retira al quedar cruzado.
    if (this.paso) {
      this.zPaso += avance;
      this.paso.position.z = this.zPaso;
      if (this.zPaso > this.LARGO_PASO + 20) {
        this._destruir(this.paso);
        this.paso = null;
      }
    }

    if (!this.activa) return false;

    this.z += avance;
    this.tuneles.position.z = this.z;


    for (const flecha of this.flechas) {
      flecha.position.z += avance;
      // Las flechas que quedan atrás se reenganchan por delante de la fachada,
      // así el corredor nunca se queda sin señalización.
      if (flecha.position.z > 14) flecha.position.z = this.z + BOCACALLE.FRENTE + 2;
    }

    // DÓNDE SE DOBLA, que no es donde se entra.
    //
    // Esto disparaba en `this.z >= 0`, o sea en el plano del cruce: la fachada
    // de la institución. Con la calle transversal montada delante —doce metros
    // de intersección, ver BOCACALLE— eso significaba que el jugador la cruzaba
    // ENTERA y viraba al llegar al bordillo de enfrente. Se veía doblar contra
    // la pared.
    //
    // Quien se va por un lado dobla en el EJE de la calzada a la que entra, que
    // es lo que hace un coche: seis metros antes, 0,23 s a velocidad de crucero.
    // Quien sigue de frente no —ése va a la puerta— y por eso el umbral depende
    // del carril y llega de fuera.
    const umbral = carril === CARRILES.CENTRO ? 0 : -BOCACALLE.EJE;
    if (this.z >= umbral) {
      this.activa = false;
      return true;
    }

    return false;
  }

  /**
   * Arranca el tránsito hacia el carril elegido.
   * @param {number} carril 0 izquierda, 1 centro, 2 derecha
   */
  iniciarViraje(carril, colores) {
    this.direccionViraje = carril - 1; // -1, 0, 1
    this.virando = true;
    this.tiempoViraje = 0;
    this.duracionActual = this.direccionViraje === 0
      ? this.DURACION_VIRAJE
      : this.DURACION_VIRAJE_LATERAL;

    // POR UN COSTADO SE CRUZA ALGO. El decorado cambiaba de golpe, tapado con
    // un destello: funcionaba, pero no se sentía como ir a ninguna parte —la
    // calle era otra sin que hubiera pasado nada—. Ahora se atraviesa un
    // soportal mientras el barrio de detrás se sustituye, que es el mismo
    // recurso del pasillo del trámite y por la misma razón: lo que separa una
    // escena de otra es cruzar algo, no un corte.
    if (this.direccionViraje !== 0 && colores) {
      this._montarPaso(colores);
    }
  }

  _montarPaso(colores) {
    this._destruir(this.paso);
    this.paso = crearPasoLateral(this.LARGO_PASO, colores);
    // Arranca justo encima del jugador: se entra en el mismo fotograma en que
    // se dobla la esquina.
    this.zPaso = 4;
    this.paso.position.z = this.zPaso;
    this.grupo.add(this.paso);
  }

  /**
   * Inclinación de cámara a aplicar este fotograma, en radianes.
   * Describe una campana: entra y sale, con el pico a mitad del tránsito.
   * El túnel central no inclina nada: se entra de frente.
   */
  banqueoCamara() {
    if (!this.virando || this.direccionViraje === 0) return 0;
    const t = this.tiempoViraje / this.duracionActual;
    // Siete grados. Es el ÚNICO giro que hace la cámara en toda la esquina
    // —el resto lo pone el mundo al rotar— y va de banqueo, como quien se
    // inclina en una curva: acompaña al peso del personaje, no compite con él.
    return -this.direccionViraje * Math.sin(t * Math.PI) * 0.12;
  }

  /**
   * LA CINEMÁTICA DEL GIRO — doblar la esquina con el cuerpo.
   *
   * Al tomar un costado, el personaje ROTA hacia ese lado y la cámara lo
   * sigue con la vista: primero se abre hacia la esquina (se ve al corredor
   * girar y el camino elegido aparecer delante de él) y luego, ya dentro del
   * soportal, los dos se enderezan mirando la calle nueva.
   *
   * Desde que la esquina la hace EL MUNDO al rotar (Game._girarMundo), esta
   * curva ya no mueve la cámara: alimenta el PESO —el ladeo del personaje, el
   * banqueo, la deriva corta de cámara y el polvo—. Sigue siendo asimétrica
   * (pico al 32 %, vuelta en el resto) para que el cuerpo se incline mientras
   * el mundo gira y se enderece cuando la calle nueva ya está de frente.
   *
   * De frente no hay cinemática: al trámite se entra recto.
   *
   * @returns {{dir: number, fuerza: number}|null}
   */
  cinematicaGiro() {
    if (!this.virando || this.direccionViraje === 0) return null;
    const t = Math.min(1, this.tiempoViraje / this.duracionActual);

    // EL GIRO SE PASA POR EL CUARTO DE VUELTA, no rebota contra él.
    //
    // Antes la curva era seno hasta el 20 % y coseno hasta el 62 %: la cámara
    // salía disparada al máximo en un cuarto de segundo, se quedaba ahí un
    // instante y volvía. Eso no es doblar una esquina, es un tirón y su vuelta
    // —y encima con un pico anguloso en el empalme de las dos curvas, que es lo
    // que se sentía como un golpe.
    //
    // Ahora son tres tiempos:
    // Un ARCO ENTERO, sin meseta: la cámara entra en la curva, pasa por el
    // punto de máxima inclinación y sale, sin quedarse quieta en ningún sitio.
    //
    // Hubo una versión con meseta —quedarse mirando de lado mientras el mundo
    // cambiaba— y era peor: al costado no hay nada construido, así que
    // sostener el encuadre ahí enseñaba una pared negra durante medio segundo.
    // El cambio de escenario no necesita que se mire a otro sitio; le basta
    // con el instante de máxima rotación, que es cuando el pasillo viejo está
    // más escorado.
    //
    // EL ARCO ES ASIMÉTRICO: SE ABRE RÁPIDO Y SE CIERRA DESPACIO.
    //
    // Era un seno simétrico suavizado, que pasa MÁS tiempo cerca del máximo que
    // en los extremos. Con la cámara mirando al costado —donde no hay calle,
    // porque la pista no dobla— eso significaba pasar la mitad del giro
    // enseñando una fachada. Justo al revés de lo que hace falta.
    //
    // Ahora el pico cae al 32 % y el 68 % restante se emplea en volver a mirar
    // la calle nueva. Sale un volantazo: se abre en seis décimas, se asoma a la
    // esquina, y el resto del pasaje ya se corre mirando adelante. Las dos
    // mitades son suavizados —derivada nula en el pico— así que no hay ángulo
    // en el empalme: si lo hubiera se sentiría como un tirón.
    const PICO = 0.32;
    const u = t < PICO ? t / PICO : (1 - t) / (1 - PICO);
    return { dir: this.direccionViraje, fuerza: u * u * (3 - 2 * u) };
  }

  /** Fracción 0..1 del destello de transición. */
  destello() {
    if (!this.virando) return 0;
    const t = this.tiempoViraje / this.duracionActual;

    // EL FOGONAZO, MUCHO MÁS CORTO Y CENTRADO EN EL CAMBIO.
    //
    // Subía en el primer cuarto y tardaba tres cuartos en irse: un velón
    // blanco encima de tres cuartos del giro. Un fogonazo es lo que se usa
    // cuando NO se puede enseñar la transición, y aquí sí se puede —para eso
    // está el arco de la cámara—, así que tapar con luz lo que ya se está
    // enseñando solo consigue que el giro se vea sucio.
    //
    // Ahora vive dentro de la meseta del giro (40-58 %), que es cuando el
    // mundo cambia de verdad, y no pasa del 45 % de opacidad: acompaña el
    // cambio en vez de sustituirlo.
    //
    // De frente (al trámite) no hay giro que tape nada, así que ahí se queda
    // como estaba: es el único caso en que el fogonazo hace falta.
    if (this.direccionViraje === 0) {
      return t < 0.25 ? t / 0.25 : Math.max(0, 1 - (t - 0.25) / 0.75);
    }
    // POR LOS COSTADOS YA NO HAY DESTELLO NINGUNO. Un fogonazo es el recurso
    // para cuando NO se puede enseñar la transición, y ahora la transición se
    // enseña entera: la bocacalle gira hasta quedar de frente, a la vista.
    // Blanquearla sería tapar exactamente lo que este giro por fin enseña.
    return 0;
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  _destruir(objeto) {
    // Tolera null: lo llaman rutas que no saben si había algo montado —el paso
    // lateral solo existe cuando se dobla por un costado—, y obligarlas a
    // comprobarlo antes reparte la misma condición por cuatro sitios.
    if (!objeto) return;
    this.grupo.remove(objeto);
    objeto.traverse((o) => {
      // Los edificios del GLB comparten geometría y materiales con la
      // plantilla cargada (ver hitos.clonarPorNombre): aquí no hay nada que
      // liberar, y destruirlos evictaba los buffers del modelo entero en cada
      // cruce.
      if (o.userData.compartido) return;
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  /**
   * Retira el cruce. NO toca el soportal a propósito.
   *
   * A limpiar() lo llama el cambio de tramo, que es exactamente el momento en
   * que el jugador está DENTRO del paso: si se llevara el soportal por delante,
   * desaparecería en el mismo fotograma en que se entra en él y el cambio de
   * decorado volvería a verse a pelo, que es lo que el paso venía a tapar.
   *
   * El soportal se retira solo al quedar cruzado (ver actualizar) y se fuerza
   * en reiniciar(), que es cuando de verdad no queda nada en pista.
   */
  limpiar() {
    if (this.tuneles) {
      this._destruir(this.tuneles);
      this.tuneles = null;
    }

    for (const flecha of this.flechas) this._destruir(flecha);
    this.flechas = [];

    this.activa = false;
  }

  /**
   * Corta el viraje en seco, sin tocar lo montado en pista.
   *
   * Lo llama el fin de partida: el viraje solo avanza mientras se juega, así
   * que una captura en mitad del tránsito lo dejaba CONGELADO —virando=true,
   * destello a medias— y al zafarte del cerco la pantalla soltaba un
   * destellazo blanco salido de ninguna parte.
   */
  abortarViraje() {
    this.virando = false;
    this.tiempoViraje = 0;
    this.direccionViraje = 0;
  }

  reiniciar() {
    this._destruir(this.paso);
    this.paso = null;
    this.limpiar();
    this.abortarViraje();
  }
}
