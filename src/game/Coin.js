// ============================================================================
// EVIDENCIA Y PRUEBAS — Los recolectables
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
import { CARRILES, EVIDENCIA, PRUEBAS, OBSTACULOS } from '../config/balance.js';
import { crearEvidencia, crearPrueba, ajustarBrilloEvidencia } from '../models/props.js';
import { crearCaja, hayColisionPlana, distanciaHorizontal } from '../utils/collision.js';
import { HUECO } from './Luces.js';

export class CoinManager {
  constructor(escena, camara = null) {
    // La cámara, para encarar el halo de las pruebas. Ver el bucle de reposo.
    this.camara = camara;
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activos = [];
    this.poolEvidencia = [];
    this.poolPruebas = [];

    this.tiempo = 0;

    // Radio del imán. Es un campo y no una constante porque el potenciador
    // "Fuente anónima" lo agranda temporalmente.
    this.radioIman = EVIDENCIA.RADIO_IMAN;
    // Multiplicador de densidad que impone cada escenario (Carondelet ≈ 0.25).
    this.densidad = 1.0;
    // Tope duro de papeles por tramo, para escenarios áridos.
    this.maximoPorTramo = Infinity;
    this.generadosEsteTramo = 0;

    this.tiposPrueba = ['Documento'];
  }

  // -------------------------------------------------------------------------
  // POOL
  // -------------------------------------------------------------------------

  _obtenerEvidencia() {
    if (this.poolEvidencia.length > 0) return this.poolEvidencia.pop();
    const m = crearEvidencia();
    this.grupo.add(m);
    return m;
  }

  /**
   * Qué prueba sale. Con probabilidad fija, una plantada.
   *
   * El nombre ES el dato: quien quiera saber si una prueba vale mira si está en
   * la lista de falsas de algún escenario. Guardar además una bandera en el
   * objeto sería una segunda fuente de verdad para lo mismo, y las dos se
   * acabarían separando en cuanto alguien edite el catálogo.
   */
  _nombreDePrueba() {
    const falsas = this.tiposFalsos ?? [];
    if (falsas.length && Math.random() < 0.34) {
      return falsas[Math.floor(Math.random() * falsas.length)];
    }
    return this.tiposPrueba[Math.floor(Math.random() * this.tiposPrueba.length)];
  }

  _obtenerPrueba() {
    if (this.poolPruebas.length > 0) return this.poolPruebas.pop();
    const m = crearPrueba();
    this.grupo.add(m);
    return m;
  }

  _devolver(item) {
    item.malla.visible = false;
    if (item.tipo === 'prueba') {
      if (this.poolPruebas.length < PRUEBAS.TAMANO_POOL) this.poolPruebas.push(item.malla);
      else this._destruirMalla(item.malla);
    } else {
      if (this.poolEvidencia.length < EVIDENCIA.TAMANO_POOL) this.poolEvidencia.push(item.malla);
      else this._destruirMalla(item.malla);
    }
  }

  /**
   * Saca una malla de la escena.
   *
   * OJO: NO libera geometría ni material. Los papeles comparten ambos entre
   * todas sus instancias (ver crearEvidencia en models/props.js), así que
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
   * @returns {number|null} El carril que ocupó la hilera, para que quien
   *          coloque ítems después no se lo pise. Una hilera de papeles tapa
   *          por completo lo que tenga detrás en el mismo carril.
   */
  generarHilera(carrilesLibres, zGrupo, gap, enArco = false) {
    if (!carrilesLibres || carrilesLibres.length === 0) return null;
    if (this.generadosEsteTramo >= this.maximoPorTramo) return null;
    // La densidad del escenario decide si esta hilera llega a existir.
    if (Math.random() > this.densidad) return null;

    const carril = carrilesLibres[Math.floor(Math.random() * carrilesLibres.length)];
    const x = CARRILES.POSICIONES[carril];

    // La hilera empieza pasado el grupo y tiene que caber ANTES del siguiente.
    // Los carriles libres lo son para ESTE grupo; el siguiente tiene otro
    // reparto, así que invadirlo pondría papeles dentro de un muro.
    const z = zGrupo - EVIDENCIA.MARGEN_TRAS_GRUPO;
    const espacioDisponible = Math.max(0, gap - EVIDENCIA.MARGEN_TRAS_GRUPO - EVIDENCIA.MARGEN_ANTES_GRUPO);
    const cabenPorEspacio = Math.floor(espacioDisponible / EVIDENCIA.SEPARACION) + 1;

    const largoDeseado = EVIDENCIA.LARGO_HILERA_MIN +
      Math.floor(Math.random() * (EVIDENCIA.LARGO_HILERA_MAX - EVIDENCIA.LARGO_HILERA_MIN + 1));

    const largo = Math.min(largoDeseado, cabenPorEspacio);

    // La fase de giro de esta hilera. Que cada cinta arranque en un ángulo
    // distinto es lo que evita que dos hileras seguidas se vean calcadas.
    const faseHilera = Math.random() * Math.PI * 2;
    if (largo < 1) return null;

    for (let i = 0; i < largo; i++) {
      if (this.generadosEsteTramo >= this.maximoPorTramo) break;

      const zEvidencia = z - i * EVIDENCIA.SEPARACION;

      // En arco, la hilera describe una parábola que coincide con la
      // trayectoria del salto. Es la señal visual de "salta aquí".
      let y = EVIDENCIA.ALTURA;
      if (enArco) {
        const t = i / Math.max(1, largo - 1);
        y = EVIDENCIA.ALTURA + Math.sin(t * Math.PI) * (EVIDENCIA.ALTURA_ARCO - EVIDENCIA.ALTURA);
      }
      // SIN ONDULACIÓN DE ALTURA. Subía y bajaba ±0.14 con periodo de 5.5
      // índices, y las hileras reales tienen entre tres y cinco piezas: no
      // completaba ni un ciclo, así que no se leía como onda sino como
      // desorden. La variedad que buscaba ya la pone el desfase de GIRO, que
      // es lo que hace la referencia.

      const malla = this._obtenerEvidencia();
      malla.visible = true;
      malla.position.set(x, y, zEvidencia);

      this.activos.push({
        malla,
        tipo: 'evidencia',
        x,
        y,
        z: zEvidencia,
        // Una fase por hilera y 60° entre vecinas: desfase legible dentro de
        // la fila y distinto en cada hilera. Ver el bucle de animación.
        fase: faseHilera + i * 1.05,
        valor: EVIDENCIA.VALOR_MINIMO +
          Math.floor(Math.random() * (EVIDENCIA.VALOR_MAXIMO - EVIDENCIA.VALOR_MINIMO + 1)),
        recogido: false,
      });

      this.generadosEsteTramo++;
    }

    // ¿Cae una evidencia al final de la hilera?
    if (Math.random() < PRUEBAS.PROBABILIDAD_POR_GRUPO) {
      const malla = this._obtenerPrueba();
      malla.visible = true;
      const zPrueba = z - largo * EVIDENCIA.SEPARACION;
      malla.position.set(x, PRUEBAS.ALTURA, zPrueba);

      this.activos.push({
        malla,
        tipo: 'prueba',
        x,
        y: PRUEBAS.ALTURA,
        z: zPrueba,
        valor: PRUEBAS.VALOR_MINIMO +
          Math.floor(Math.random() * (PRUEBAS.VALOR_MAXIMO - PRUEBAS.VALOR_MINIMO + 1)),
        // UNA DE CADA TRES ES PLANTADA, donde las haya. Menos y no llegas a
        // desconfiar; más y recoger deja de compensar, que es peor: el juego
        // pasaría a premiar no coger nada.
        nombre: this._nombreDePrueba(),
        recogido: false,
      });
    }

    return carril;
  }

  /**
   * Hilera sobre una tarima. Es el premio por tomar la rampa en vez de
   * ignorarla, así que va densa y ocupa el tablado casi entero.
   *
   * No pasa por el filtro de densidad ni por el tope del tramo: esta hilera no
   * es relleno ambiental, es la recompensa de una mecánica. En Carondelet, que
   * tiene tope de papeles, sigue contando —pero se genera igual.
   *
   * @param {number} carril
   * @param {number} zPieRampa Z del pie de la rampa (el borde cercano)
   * @param {number} altura    Altura de la superficie
   * @param {{ini:number,fin:number}[]} piezas Tramos macizos, en metros desde
   *   el pie de la rampa. Entre uno y el siguiente hay vacío.
   * @param {number} largoRampa
   */
  generarHileraElevada(carril, zPieRampa, altura, piezas, largoRampa) {
    const x = CARRILES.POSICIONES[carril];
    const faseElevada = Math.random() * Math.PI * 2;
    let puestos = 0;

    const plantar = (avance, y) => {
      const malla = this._obtenerEvidencia();
      malla.visible = true;
      const z = zPieRampa - avance;
      malla.position.set(x, y, z);
      this.activos.push({
        malla,
        tipo: 'evidencia',
        x,
        y,
        z,
        fase: faseElevada + puestos * 1.05,
        valor: EVIDENCIA.VALOR_MAXIMO, // Arriba se paga mejor. Para eso subiste.
        recogido: false,
      });
      puestos++;
      this.generadosEsteTramo++;
    };

    const enTramo = (a) => piezas.some((p) => a >= p.ini && a <= p.fin);
    const finCadena = piezas[piezas.length - 1].fin;

    // --- La cinta, tramo a tramo --------------------------------------------
    // LA CINTA EMPIEZA CUATRO METROS ANTES DE LA RAMPA, no pasada la rampa.
    // Los cinco metros y medio de subida sin una moneda no decían que aquello
    // se pudiera subir; las piezas que caen sobre la rampa suben CON ella,
    // siguiendo su pendiente, y eso es lo que se lee como «por aquí».
    //
    // Lo que NO se pone es cinta sobre un hueco a la altura del tablado:
    // flotaría en mitad del vacío diciendo que ahí hay piso. Los huecos llevan
    // su propio arco, abajo.
    for (let a = -4; a <= finCadena; a += EVIDENCIA.SEPARACION) {
      if (a > largoRampa && !enTramo(a)) continue;
      const subida = Math.min(1, Math.max(0, a / largoRampa));
      const y = (a <= largoRampa ? subida * altura : altura) + EVIDENCIA.ALTURA;
      plantar(a, y);
    }

    // --- Y un arco por cada hueco -------------------------------------------
    // ARQUEA SOBRE EL HUECO POR EL MISMO MOTIVO POR EL QUE ARQUEA SOBRE LA
    // RAMPA: la cinta es el cartel. Sobre la rampa dice «se sube»; sobre el
    // vacío dice «se salta», y lo dice desde doscientos metros, que es cuando
    // hace falta saberlo. Sin el arco, un hueco de cinco metros a contraluz y
    // a 32 u/s es un cambio de textura que se ve cuando ya se pisó.
    //
    // TRES PIEZAS, con su propia separación, y no la de EVIDENCIA.SEPARACION:
    // el hueco mide de 4.5 a 7.2 m, así que la rejilla de 7 m metería cero o
    // una, y una pieza suelta no dibuja un arco. Tres, a un cuarto, la mitad y
    // tres cuartos, sí.
    //
    // El alto del arco es el mismo que usa la hilera de calle
    // (ALTURA_ARCO − ALTURA = 0.85 m) y no se elige más alto por una razón
    // medida: el salto sube 2.20 m sobre el tablado, así que un arco de 0.85
    // queda barrido entero por cualquier salto que cruce el hueco. Un arco a
    // la altura del pico solo se cogería clavando el salto, y entonces la
    // recompensa dejaría de ser la señal para ser otra prueba.
    for (let i = 0; i < piezas.length - 1; i++) {
      const ini = piezas[i].fin;
      const largoHueco = piezas[i + 1].ini - ini;
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const y = altura + EVIDENCIA.ALTURA
          + Math.sin(t * Math.PI) * (EVIDENCIA.ALTURA_ARCO - EVIDENCIA.ALTURA);
        plantar(ini + t * largoHueco, y);
      }
    }
  }

  /**
   * Planta un papel suelto en coordenadas exactas. Lo usa el trámite, que
   * dibuja su propio patrón y no quiere que nadie se lo filtre por densidad ni
   * se lo recorte por tope de tramo: ahí los papeles SON la prueba.
   */
  /**
   * @param {number} valor Cuántos papeles vale esta pieza. Normalmente 1: el
   *   trámite riega uno por papel. Solo sube si el montón no cabe entero en el
   *   pasillo y hay que juntar varios en la misma pieza (ver Tramite._regar).
   */
  plantarEvidencia(x, y, z, valor = EVIDENCIA.VALOR_MINIMO) {
    const malla = this._obtenerEvidencia();
    malla.visible = true;
    malla.position.set(x, y, z);

    this.activos.push({
      malla,
      tipo: 'evidencia',
      x,
      y,
      z,
      // El reguero del trámite también necesita fase, o quinientas piezas
      // giran clavadas a la vez y el pasillo parece un molinillo.
      fase: Math.random() * Math.PI * 2,
      valor,
      recogido: false,
    });
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

    // La luz de la prueba nominal es UNA del aparejo, no una por pieza. Ver
    // game/Luces.js: con una PointLight colgada de cada prueba, cada vez que
    // aparecía una cambiaba el recuento de luces de la escena y se recompilaban
    // todos los materiales —medido, cuatro programas por prueba—. Y las pruebas
    // salen en el 18 % de los grupos, o sea muchas veces por tramo.
    const rig = this.escena.userData.rig;
    let conLuz = null;

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      item.z += avance;

      // La candidata: la prueba sin recoger más cercana por delante. Nunca hay
      // dos a la vez en cuadro, así que una luz basta.
      if (rig && !item.recogido && item.malla.userData.pideLuz
          && item.z < 6 && (!conLuz || item.z > conLuz.z)) conLuz = item;

      // --- Imán ------------------------------------------------------------
      // Los recolectables cercanos se acercan al jugador. Compensa la menor
      // precisión del swipe en móvil sin regalar el juego.
      if (!item.recogido && Math.abs(item.z) < 14) {
        const d = distanciaHorizontal(item.x, item.z, jugador.x, 0);
        // El imán también mira la ALTURA. Sin esto, un papel puesto sobre una
        // tarima se dejaría arrastrar hasta un jugador que corre por debajo,
        // y el premio de subir se cobraría sin subir.
        // Volando, el imán alcanza en vertical toda la altura de vuelo: la
        // cobertura aérea recoge el tramo entero, que es su gracia.
        const alcanceVertical = jugador.volando
          ? true
          : Math.abs(item.y - (jugador.y + 0.9)) < 1.6;
        if (d < this.radioIman && alcanceVertical) {
          const factor = 1 - Math.exp(-EVIDENCIA.VELOCIDAD_IMAN * dt);
          item.x += (jugador.x - item.x) * factor;
          const yObjetivo = jugador.y + 0.9;
          item.y += (yObjetivo - item.y) * factor;
        }
      }

      item.malla.position.set(item.x, item.y, item.z);

      // --- Recorte por distancia --------------------------------------------
      // El pasillo del trámite riega TODOS tus papeles de una vez y el reguero
      // mide trescientos metros, así que sin esto hay hasta trescientas piezas
      // dentro del cono de la cámara a la vez. El descarte por volumen de Three
      // no las quita —están delante, aunque la niebla las haya borrado ya— y
      // cada una se cobra su llamada de dibujo: medido, +67 % de tiempo de
      // fotograma dentro del túnel.
      //
      // Se apagan las que quedan más lejos de lo que la niebla deja ver. La
      // lógica no las toca: siguen avanzando, sumando y recogiéndose igual; lo
      // único que cambia es que no se mandan a pintar hasta que hay algo que
      // ver. En la calle no cambia nada, porque ahí nunca llegan tan lejos.
      const visible = item.z > -EVIDENCIA.DISTANCIA_VISIBLE;
      if (item.malla.visible !== visible) item.malla.visible = visible;
      if (!visible) continue;

      // --- Animación de reposo ---------------------------------------------
      if (item.tipo === 'evidencia') {
        // EL DESFASE VA EN LA PIEZA, no en su Z.
        //
        // Estaba en `tiempo * 3 + z * 0.55`, y esa Z avanza a la velocidad de
        // carrera: el desfase real entre dos vecinas era de nueve grados —o
        // sea, la hilera giraba al unísono— y la velocidad de giro dependía de
        // lo rápido que fueras, llegando a tres vueltas por segundo. Tres
        // vueltas por segundo no es un giro, es un centelleo.
        //
        // Con una fase fija por pieza, en la misma fila hay monedas de canto
        // junto a monedas de frente, que es exactamente lo que hace que la
        // cinta se vea viva en la referencia. Y 4.2 rad/s es una vuelta cada
        // vuelta y media de segundo: aproximadamente lo que la pieza tarda en
        // cruzar el cuadro, o sea una pose por moneda.
        //
        // El `?? 0` no es decorativo: una pieza sin fase daría NaN y
        // desaparecería.
        item.malla.rotation.y = (item.fase ?? 0) + this.tiempo * 4.2;
      } else {
        // La prueba gira SOLO sobre el eje vertical. Volteaba también en X y
        // la silueta quedaba irreconocible la mitad del tiempo.
        item.malla.rotation.y = (item.fase ?? 0) + this.tiempo * 2;
        // El halo late y va encarado a cámara. Encararlo SOLO aquí, en la
        // rama de las pruebas: hay doce vivas como mucho, mientras que por la
        // rama de los papeles pasan trescientas cuarenta por fotograma.
        const halo = item.malla.userData.halo;
        if (halo) {
          halo.scale.setScalar(1 + Math.sin(this.tiempo * 5) * 0.12);
          if (this.camara) halo.quaternion.copy(this.camara.quaternion);
        }
      }

      // --- Reciclado --------------------------------------------------------
      // Mismo umbral que los obstáculos: por detrás de la cámara no queda
      // nada vivo, o al adelantarlo cruzaría el objetivo. Ver DISTANCIA_RECICLADO.
      if (item.z > OBSTACULOS.DISTANCIA_RECICLADO) {
        if (conLuz === item) conLuz = null;
        this._devolver(item);
        this.activos.splice(i, 1);
      }
    }

    // Y la luz, al final: encenderla dentro del bucle la movería varias veces
    // por fotograma sin necesidad.
    if (rig) {
      if (!conLuz) rig.apagar(HUECO.PRUEBA);
      else {
        const l = conLuz.malla.userData.pideLuz;
        rig.encender(HUECO.PRUEBA, conLuz.malla.position, l.color, l.intensidad, l.alcance);
      }
    }
  }

  /**
   * Recoge todo lo que toque el jugador.
   * @returns {{papeles:number, cantidad:number, pruebas:Array}}
   *          Valor sumado, número de piezas y pruebas de este fotograma.
   *          La CANTIDAD importa aparte del valor: el trámite se puntúa por
   *          piezas recogidas, no por papeles sumados.
   */
  recoger(jugador) {
    const cajaJugador = jugador.obtenerCaja();
    // Ensanchamos la caja de recogida: ser generoso aquí se siente bien.
    const cajaRecogida = crearCaja(
      cajaJugador.x, cajaJugador.y, cajaJugador.z,
      cajaJugador.ancho + 0.8, cajaJugador.alto + 0.6, cajaJugador.profundidad + 0.8,
    );

    let papeles = 0;
    let cantidad = 0;
    const pruebas = [];

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      if (item.recogido) continue;
      if (Math.abs(item.z) > 3) continue;

      // La caja de recogida, del tamaño de la pieza. Era 0.5×0.6 sobre un
      // disco de 0.86: la mitad del área visible no recogía, así que la moneda
      // se atravesaba sin contar. Con 0.86 el alcance lateral llega a 1.18 m,
      // todavía muy lejos de los 2.4 que separan dos carriles: no aparece
      // recogida cruzada.
      const cajaItem = crearCaja(item.x, item.y, item.z, 0.86, 0.86, 0.5);

      if (hayColisionPlana(cajaRecogida, cajaItem)) {
        // Para la evidencia sí comprobamos altura: está flotando y debe
        // sentirse como algo que se alcanza.
        const dy = Math.abs(cajaRecogida.y - item.y);
        if (dy > (cajaRecogida.alto / 2 + 0.9)) continue;

        item.recogido = true;
        papeles += item.valor;
        cantidad += 1;
        if (item.tipo === 'prueba') {
          pruebas.push({ nombre: item.nombre, valor: item.valor });
        }

        this._devolver(item);
        this.activos.splice(i, 1);
      }
    }

    return { papeles, cantidad, pruebas };
  }

  // -------------------------------------------------------------------------
  // TEMA Y CICLO DE VIDA
  // -------------------------------------------------------------------------

  /** Configura densidad y tipos de evidencia según el escenario. */
  aplicarTema(escenario) {
    this.densidad = escenario.densidadEvidencia ?? 1.0;
    this.maximoPorTramo = escenario.maximoEvidenciaPorTramo ?? Infinity;
    // LAS DE REDES ENTRAN AL SORTEO IGUAL QUE LAS DEMÁS. Si solo se sortearan
    // las que tienen documento, su casilla del expediente no se llenaría
    // nunca: sería un hueco permanente que el jugador leería como un fallo, no
    // como «esta pista existe pero no está probada». Se recogen igual; lo que
    // cambia es que no cuentan para publicar (ver Notebook.sinConfirmar).
    this.tiposPrueba = [
      ...(escenario.evidencia ?? ['Documento']),
      ...(escenario.pistasSinConfirmar ?? []),
    ];
    // Material plantado. Solo lo tienen los escenarios tardíos: ver
    // config/escenarios.js, donde está explicado por qué no aparece antes.
    this.tiposFalsos = escenario.pruebasFalsas ?? [];
    this.generadosEsteTramo = 0;

    // A OSCURAS, LOS EVIDENCIA ALUMBRAN. Es lo que sostiene el Apagón desde que
    // la linterna dejó de ser un consumible garantizado: sin luz sigues sin
    // ver la calle, pero ves por dónde va, porque la hilera dibuja la ruta.
    const aOscuras = !!escenario.evidenciaBrilla;
    ajustarBrilloEvidencia(aOscuras ? 2.1 : 0.85, aOscuras);
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
