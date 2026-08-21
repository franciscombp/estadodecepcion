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
//   · UNA TARIMA NO ES UNA TABLA: es una cadena de dos o tres tramos con vacío
//     entre ellos. Cada hueco es un salto, y el que no se salta te devuelve a
//     la calle desde 3.15 m. Correr por arriba es una decisión que se repite,
//     no un pasillo elevado.
//   · Cuando la cadena se acaba, te caes. Bajarse a tiempo —o saltar el hueco
//     al final— es la habilidad que se pide.
//
// CAERSE POR UN HUECO NO CUESTA UN GOLPE, Y ES DELIBERADO
// La capa de arriba es OPCIONAL y además PAGA: los papeles de ahí valen el
// máximo. Si el hueco cobrara una vida, la cuenta se invertiría —lo prudente
// sería no subir nunca— y la mecánica se convertiría en una trampa que se
// esquiva. Es el mismo razonamiento que ya hay escrito en Game.js para la
// cobertura aérea: «es un descanso, no otra prueba».
// Y hay un motivo más duro: los golpes son la moneda de muerte —tres y te
// atrapan, y cada uno acerca a los perseguidores 8 m—. Un hueco puede llegar
// mientras el jugador viene bajando de un salto anterior, o sea cuando no
// puede hacer nada, y eso es «un castigo por mala suerte, no por mal juego»,
// que es la línea que Game.js ya se negó a cruzar con el Apagón.
// La caída cuesta de sobra sin cobrar vida: pierdes la hilera de valor 5 que
// quedaba arriba —el motivo entero de haber subido—, pierdes los 3.15 m y
// medio segundo sin control, y vuelves a la calle, que es donde sí hay
// obstáculos.
//
// POR QUÉ NO ES UN OBSTÁCULO MÁS
// El generador de obstáculos garantiza que todo grupo sea superable eligiendo
// un carril solución. Una tarima ocupa 20-35 metros seguidos, o sea VARIOS
// grupos: si se colara ahí dentro rompería esa garantía. Por eso vive en su
// propio gestor y RESERVA su carril en el generador mientras dura.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, ELEVADO, SALTO, VELOCIDAD } from '../config/balance.js';
import { crearTarima } from '../models/props.js';

// DÓNDE NACE UNA CADENA. Estaba como literal dentro de _generar y esa fue
// exactamente la causa del defecto: la condición de no solape comparaba el
// borde lejano de las cadenas vivas contra 12 en vez de contra este número,
// así que solo dejaba nacer una cuando ya no quedaba ninguna. Un sitio, un
// número, y las dos cuentas miran al mismo.
const Z_APARICION = -260;

export class ElevadoManager {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    /** Cadenas en pista. Hasta ELEVADO.MAXIMO_VIVAS, y normalmente todas. */
    this.activas = [];
    this.colores = { props: 0xc9884a, acento: 0xffcf3f };
    this.distanciaDesdeUltima = 0;
    this.generacionPausada = false;
    /** Carril de la última cadena, para no repetirlo. Ver _generar(). */
    this.ultimoCarril = -1;
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
   * @param {number} velocidadBase La curva de dificultad, no la velocidad
   *   actual. De ella sale el tamaño del hueco, y tiene que ser la que SOLO
   *   sube: si se dimensionara con la actual, un golpe entre que la cadena
   *   nace (a 260 m) y el jugador llega a ella dejaría un hueco calculado para
   *   una velocidad que ya no tiene. Ver _generar().
   */
  actualizar(dt, avance, jugador, obstaculos, papeles, velocidadBase) {
    this.distanciaDesdeUltima += avance;

    // TRES CADENAS VIVAS, Y ESTA VEZ DE VERDAD.
    //
    // El tope llevaba dos versiones puesto en tres y la realidad seguía siendo
    // UNA: la condición de no solape comparaba el borde lejano de las cadenas
    // vivas contra DISTANCIA_ENTRE (12) cuando la cadena nueva no nace en 12,
    // nace en Z_APARICION (-260). Como el reciclado destruye precisamente en
    // +12, la condición solo se cumplía con la lista vacía. Medido sobre el
    // gestor real: 2.50 cadenas por tramo de 850 m, una cada 359 m, máximo de
    // vivas a la vez = 1, tablado sobre la cabeza el 23 % del recorrido.
    //
    // Comparando contra Z_APARICION + DISTANCIA_ENTRE la pregunta pasa a ser
    // la que siempre quiso ser: ¿quedan 22 m de calle libre delante del sitio
    // donde va a nacer? Mismo gestor, mismo recorrido: 7.25 cadenas por tramo,
    // una cada 118 m, tres vivas, 66 % de cobertura, cero solapes en Z.
    //
    // LA CONDICIÓN DE NO SOLAPARSE NO ES OPCIONAL: cada cadena veta su carril,
    // y si dos se pisan en Z el generador de obstáculos se queda con menos
    // sitio para repartir y el juego degenera en pasillo único.
    if (!this.generacionPausada
        && this.distanciaDesdeUltima >= ELEVADO.DISTANCIA_ENTRE
        && this.activas.length < ELEVADO.MAXIMO_VIVAS
        && !this.activas.some(
          (t) => t.z - t.largoTotal < Z_APARICION + ELEVADO.DISTANCIA_ENTRE)) {
      this._generar(obstaculos, papeles, velocidadBase);
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

  _generar(obstaculos, papeles, velocidadBase = VELOCIDAD.INICIAL) {
    // NUNCA DOS CADENAS SEGUIDAS EN EL MISMO CARRIL.
    //
    // Con el carril al azar puro salía repetido una de cada tres veces
    // (medido: 18 de 58 en 6800 m). Y dos cadenas seguidas en la misma línea
    // es exactamente lo que se ve como «va todo en línea recta»: subes una vez
    // y corres derecho hasta que se acaba el tramo. Obligando a cambiar, la
    // capa de arriba cruza la calle: bajarse de una y buscar la rampa de la
    // siguiente en otro carril pasa a ser parte del recorrido.
    const carril = this.ultimoCarril < 0
      ? Math.floor(Math.random() * 3)
      : (this.ultimoCarril + 1 + Math.floor(Math.random() * 2)) % 3;
    this.ultimoCarril = carril;

    const largo = ELEVADO.LARGO_MINIMO
      + Math.random() * (ELEVADO.LARGO_MAXIMO - ELEVADO.LARGO_MINIMO);

    // EL HUECO SALE DE LA VELOCIDAD MÁS LENTA A LA QUE SE PUEDE LLEGAR AQUÍ,
    // que no es la de ahora ni la inicial: es el piso tras un golpe, la misma
    // fórmula que aplica Game.js al chocar. Dimensionarlo con la velocidad
    // actual dejaría un hueco insaltable a quien se lleve un golpe en los 260
    // metros que hay desde que esto nace hasta que lo pisa; dimensionarlo con
    // el piso lo deja siempre del lado bueno, porque velocidadBase solo sube.
    const piso = Math.max(
      VELOCIDAD.INICIAL * VELOCIDAD.PISO_TRAS_GOLPE,
      velocidadBase * VELOCIDAD.FRENAZO_POR_GOLPE,
    );
    const hueco = Math.min(
      ELEVADO.HUECO_MAXIMO,
      Math.max(ELEVADO.HUECO_MINIMO, piso * ELEVADO.HUECO_SEGUNDOS),
    );

    const { piezas, largoTotal } = this._repartirTramos(largo, hueco);

    // Se planta lejos, donde todavía no hay nada generado que pueda quedar
    // atrapado debajo.
    const z = Z_APARICION;

    const malla = crearTarima(piezas, this.colores, this.idEscenario);
    malla.position.set(CARRILES.POSICIONES[carril], 0, z);
    this.grupo.add(malla);

    const tarima = {
      malla,
      carril,
      x: CARRILES.POSICIONES[carril],
      z,                 // Pie de la rampa (el borde cercano)
      largo,
      largoTotal,        // Rampa + tramos + huecos. Sigue valiendo largo + rampa.
      piezas,            // Tramos macizos, en metros desde el pie de la rampa
      hueco,
    };
    this.activas.push(tarima);

    // El carril queda reservado: el generador de obstáculos no pondrá nada
    // ahí mientras la cadena ocupe ese tramo. Sin esto, un bloque sólido
    // aparecería dentro de la madera.
    //
    // LA RESERVA CUBRE LA CADENA ENTERA, HUECOS INCLUIDOS, y eso es lo que
    // hace que caerse por un hueco no tenga que costar un golpe: el que falla
    // el salto aterriza en un tramo de calle donde no se genera nada y tiene
    // tiempo de recolocarse. Si la reserva se partiera con los huecos —que es
    // la «optimización» evidente, porque bajo el hueco no hay tablado— el
    // jugador caería 3.15 m encima de un bloque sólido con cero tiempo de
    // reacción, que es justo la muerte que el generador existe para evitar.
    obstaculos?.reservar(carril, z - largoTotal - 6, z + 8);

    // Premio por subir: la cinta de papeles sobre la cadena. Es la razón para
    // tomar la rampa en vez de ignorarla, y es además el cartel: arquea sobre
    // la rampa —donde hay que subir— y sobre cada hueco —donde hay que saltar.
    papeles?.generarHileraElevada(
      carril, z, ELEVADO.ALTURA, piezas, ELEVADO.LARGO_RAMPA,
    );
  }

  /**
   * Parte el largo sorteado en tramos macizos con un hueco entre cada dos.
   *
   * Las coordenadas son METROS DESDE EL PIE DE LA RAMPA y crecen alejándose
   * del jugador. Es el mismo sistema en el que piensa _resolverSuelo —el
   * jugador está clavado en z=0, así que `t.z` ES cuánto lleva recorrido
   * dentro de la cadena— y usar el mismo aquí ahorra la conversión que se
   * olvida.
   *
   * @returns {{piezas: {ini:number,fin:number}[], largoTotal: number}}
   */
  _repartirTramos(largo, hueco) {
    // Cuántos tramos: los mínimos con los que ninguno pase de TRAMO_MAXIMO.
    // Dos es el suelo porque una cadena sin hueco no es una cadena. Tres es el
    // techo por RITMO, no por cabida: con cuatro tramos en 95 m el ciclo
    // tramo+hueco baja a 0.8 s a velocidad tope, que es exactamente lo que
    // dura el salto, y el jugador se pasaría la cadena entera en el aire. Eso
    // se lee como caos, no como ritmo. Con tres, el ciclo va de 0.98 s (32 u/s)
    // a 2.1 s (15 u/s), del mismo orden que los 0.85 s de reacción que
    // garantiza el generador de obstáculos.
    let n = 2;
    while (n < 3 && (largo - (n - 1) * hueco) / n > ELEVADO.TRAMO_MAXIMO) n++;

    // Invariante que sostiene el reparto de abajo: siempre queda al menos
    // TRAMO_MINIMO por tramo. Se cumple porque 2·20 + 7.2 = 47.2 cabe en
    // LARGO_MINIMO (55). Quien baje LARGO_MINIMO tiene que rehacer esta cuenta.
    const piezas = [];
    let libre = largo - (n - 1) * hueco;
    let cursor = ELEVADO.LARGO_RAMPA;

    for (let i = 0; i < n; i++) {
      const quedan = n - i - 1;
      // El último se lleva el resto EXACTO. Así la suma cuadra con el largo
      // sorteado y largoTotal sigue siendo largo + LARGO_RAMPA, que es lo que
      // dan por hecho la reserva de carril y el reciclado.
      let l = quedan === 0
        ? libre
        : (libre / (quedan + 1)) * (0.85 + Math.random() * 0.30);
      // Ni tan largo que deje a los siguientes por debajo del mínimo, ni tan
      // corto que no quepa lo que falta.
      l = Math.min(l, ELEVADO.TRAMO_MAXIMO, libre - quedan * ELEVADO.TRAMO_MINIMO);
      l = Math.max(l, ELEVADO.TRAMO_MINIMO);

      piezas.push({ ini: cursor, fin: cursor + l });
      libre -= l;
      cursor += l + (quedan > 0 ? hueco : 0);
    }

    return { piezas, largoTotal: cursor };
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

      // --- Tramos y huecos -------------------------------------------------
      // Aquí es donde un hueco es un hueco. Antes esto devolvía ELEVADO.ALTURA
      // para todo el intervalo de la tarima, así que el tablado era una tabla
      // continua de 55 a 95 m por la que se corría sin riesgo. Ahora se busca
      // en qué tramo macizo cae el jugador; si no cae en ninguno, está sobre
      // el vacío y el suelo es la calle.
      //
      // Devolver 0 basta para que se caiga: Player.actualizar ve el suelo por
      // debajo de los pies, pone estaEnElAire con velocidadY = 0 y deja caer.
      // Sin salto y sin impulso, que es lo que ya hacía al salirse por el
      // borde final —la caída por un hueco no es un caso nuevo, es el mismo.
      for (const pieza of t.piezas) {
        if (avanceEnTarima < pieza.ini || avanceEnTarima > pieza.fin) continue;
        // El suelo elevado solo cuenta si el jugador está a su altura o por
        // encima. Si viene por debajo (saltó fuera y volvió, o se cayó por el
        // hueco anterior), sigue en la calle. Este mismo margen es el que
        // engancha al que llega justo desde el otro lado del hueco: son los
        // 0.047 s de vuelo extra con los que está dimensionado HUECO_SEGUNDOS.
        if (jugador.y >= ELEVADO.ALTURA - ELEVADO.MARGEN_ATERRIZAJE) {
          return ELEVADO.ALTURA;
        }
        return 0;
      }

      // Ni rampa ni tramo: está sobre un hueco.
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
    // Que la primera cadena de la partida pueda salir en cualquier carril y no
    // se herede el de la partida anterior.
    this.ultimoCarril = -1;
  }
}
