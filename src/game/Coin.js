// ============================================================================
// PAPELES Y EVIDENCIA — Los recolectables
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
import { CARRILES, PAPELES, EVIDENCIA, OBSTACULOS } from '../config/balance.js';
import { crearPapel, crearEvidencia, ajustarBrilloPapel } from '../models/props.js';
import { crearCaja, hayColisionPlana, distanciaHorizontal } from '../utils/collision.js';

export class CoinManager {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.activos = [];
    this.poolPapeles = [];
    this.poolEvidencia = [];

    this.tiempo = 0;

    // Radio del imán. Es un campo y no una constante porque el potenciador
    // "Fuente anónima" lo agranda temporalmente.
    this.radioIman = PAPELES.RADIO_IMAN;
    // Multiplicador de densidad que impone cada escenario (Carondelet ≈ 0.25).
    this.densidad = 1.0;
    // Tope duro de papeles por tramo, para escenarios áridos.
    this.maximoPorTramo = Infinity;
    this.generadosEsteTramo = 0;

    this.tiposEvidencia = ['Documento'];
  }

  // -------------------------------------------------------------------------
  // POOL
  // -------------------------------------------------------------------------

  _obtenerPapel() {
    if (this.poolPapeles.length > 0) return this.poolPapeles.pop();
    const m = crearPapel();
    this.grupo.add(m);
    return m;
  }

  _obtenerEvidencia() {
    if (this.poolEvidencia.length > 0) return this.poolEvidencia.pop();
    const m = crearEvidencia();
    this.grupo.add(m);
    return m;
  }

  _devolver(item) {
    item.malla.visible = false;
    if (item.tipo === 'evidencia') {
      if (this.poolEvidencia.length < EVIDENCIA.TAMANO_POOL) this.poolEvidencia.push(item.malla);
      else this._destruirMalla(item.malla);
    } else {
      if (this.poolPapeles.length < PAPELES.TAMANO_POOL) this.poolPapeles.push(item.malla);
      else this._destruirMalla(item.malla);
    }
  }

  /**
   * Saca una malla de la escena.
   *
   * OJO: NO libera geometría ni material. Los papeles comparten ambos entre
   * todas sus instancias (ver crearPapel en models/props.js), así que
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
    const z = zGrupo - PAPELES.MARGEN_TRAS_GRUPO;
    const espacioDisponible = Math.max(0, gap - PAPELES.MARGEN_TRAS_GRUPO - PAPELES.MARGEN_ANTES_GRUPO);
    const cabenPorEspacio = Math.floor(espacioDisponible / PAPELES.SEPARACION) + 1;

    const largoDeseado = PAPELES.LARGO_HILERA_MIN +
      Math.floor(Math.random() * (PAPELES.LARGO_HILERA_MAX - PAPELES.LARGO_HILERA_MIN + 1));

    const largo = Math.min(largoDeseado, cabenPorEspacio);
    if (largo < 1) return null;

    for (let i = 0; i < largo; i++) {
      if (this.generadosEsteTramo >= this.maximoPorTramo) break;

      const zPapel = z - i * PAPELES.SEPARACION;

      // En arco, la hilera describe una parábola que coincide con la
      // trayectoria del salto. Es la señal visual de "salta aquí".
      let y = PAPELES.ALTURA;
      if (enArco) {
        const t = i / Math.max(1, largo - 1);
        y = PAPELES.ALTURA + Math.sin(t * Math.PI) * (PAPELES.ALTURA_ARCO - PAPELES.ALTURA);
      } else {
        // Ondulación: dos papeles seguidos nunca están a la misma altura, así
        // que aunque se junten en pantalla se siguen distinguiendo.
        y = PAPELES.ALTURA + Math.sin(i * 1.15) * PAPELES.ONDA;
      }

      const malla = this._obtenerPapel();
      malla.visible = true;
      malla.position.set(x, y, zPapel);

      this.activos.push({
        malla,
        tipo: 'papel',
        x,
        y,
        z: zPapel,
        valor: PAPELES.VALOR_MINIMO +
          Math.floor(Math.random() * (PAPELES.VALOR_MAXIMO - PAPELES.VALOR_MINIMO + 1)),
        recogido: false,
      });

      this.generadosEsteTramo++;
    }

    // ¿Cae una evidencia al final de la hilera?
    if (Math.random() < EVIDENCIA.PROBABILIDAD_POR_GRUPO) {
      const malla = this._obtenerEvidencia();
      malla.visible = true;
      const zEvidencia = z - largo * PAPELES.SEPARACION;
      malla.position.set(x, EVIDENCIA.ALTURA, zEvidencia);

      this.activos.push({
        malla,
        tipo: 'evidencia',
        x,
        y: EVIDENCIA.ALTURA,
        z: zEvidencia,
        valor: EVIDENCIA.VALOR_MINIMO +
          Math.floor(Math.random() * (EVIDENCIA.VALOR_MAXIMO - EVIDENCIA.VALOR_MINIMO + 1)),
        nombre: this.tiposEvidencia[Math.floor(Math.random() * this.tiposEvidencia.length)],
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
   * @param {number} zInicio Borde cercano del tablado
   * @param {number} largo   Metros de tablado utilizables
   * @param {number} altura  Altura de la superficie
   */
  generarHileraElevada(carril, zInicio, largo, altura) {
    const x = CARRILES.POSICIONES[carril];
    const cuantos = Math.max(2, Math.floor(largo / PAPELES.SEPARACION));

    for (let i = 0; i < cuantos; i++) {
      const zPapel = zInicio - i * PAPELES.SEPARACION;
      const malla = this._obtenerPapel();
      malla.visible = true;
      const y = altura + PAPELES.ALTURA;
      malla.position.set(x, y, zPapel);

      this.activos.push({
        malla,
        tipo: 'papel',
        x,
        y,
        z: zPapel,
        valor: PAPELES.VALOR_MAXIMO, // Arriba se paga mejor. Para eso subiste.
        recogido: false,
      });
      this.generadosEsteTramo++;
    }
  }

  /**
   * Planta un papel suelto en coordenadas exactas. Lo usa el trámite, que
   * dibuja su propio patrón y no quiere que nadie se lo filtre por densidad ni
   * se lo recorte por tope de tramo: ahí los papeles SON la prueba.
   */
  plantarPapel(x, y, z) {
    const malla = this._obtenerPapel();
    malla.visible = true;
    malla.position.set(x, y, z);

    this.activos.push({
      malla,
      tipo: 'papel',
      x,
      y,
      z,
      valor: PAPELES.VALOR_MINIMO,
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

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      item.z += avance;

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
          const factor = 1 - Math.exp(-PAPELES.VELOCIDAD_IMAN * dt);
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
      const visible = item.z > -PAPELES.DISTANCIA_VISIBLE;
      if (item.malla.visible !== visible) item.malla.visible = visible;
      if (!visible) continue;

      // --- Animación de reposo ---------------------------------------------
      if (item.tipo === 'papel') {
        // Cada papel gira desfasado según su Z: una hilera girando al unísono
        // se lee como una sola pieza articulada, no como ocho objetos.
        item.malla.rotation.y = this.tiempo * 3 + item.z * 0.55;
      } else {
        item.malla.rotation.y = this.tiempo * 2;
        item.malla.rotation.x = this.tiempo * 1.4;
        // Pulso del halo.
        const escala = 1 + Math.sin(this.tiempo * 5) * 0.12;
        if (item.malla.userData.halo) item.malla.userData.halo.scale.setScalar(escala);
      }

      // --- Reciclado --------------------------------------------------------
      // Mismo umbral que los obstáculos: por detrás de la cámara no queda
      // nada vivo, o al adelantarlo cruzaría el objetivo. Ver DISTANCIA_RECICLADO.
      if (item.z > OBSTACULOS.DISTANCIA_RECICLADO) {
        this._devolver(item);
        this.activos.splice(i, 1);
      }
    }
  }

  /**
   * Recoge todo lo que toque el jugador.
   * @returns {{papeles:number, cantidad:number, evidencias:Array}}
   *          Valor sumado, número de piezas y evidencias de este fotograma.
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
    const evidencias = [];

    for (let i = this.activos.length - 1; i >= 0; i--) {
      const item = this.activos[i];
      if (item.recogido) continue;
      if (Math.abs(item.z) > 3) continue;

      const cajaItem = crearCaja(item.x, item.y, item.z, 0.5, 0.6, 0.5);

      if (hayColisionPlana(cajaRecogida, cajaItem)) {
        // Para la evidencia sí comprobamos altura: está flotando y debe
        // sentirse como algo que se alcanza.
        const dy = Math.abs(cajaRecogida.y - item.y);
        if (dy > (cajaRecogida.alto / 2 + 0.9)) continue;

        item.recogido = true;
        papeles += item.valor;
        cantidad += 1;
        if (item.tipo === 'evidencia') {
          evidencias.push({ nombre: item.nombre, valor: item.valor });
        }

        this._devolver(item);
        this.activos.splice(i, 1);
      }
    }

    return { papeles, cantidad, evidencias };
  }

  // -------------------------------------------------------------------------
  // TEMA Y CICLO DE VIDA
  // -------------------------------------------------------------------------

  /** Configura densidad y tipos de evidencia según el escenario. */
  aplicarTema(escenario) {
    this.densidad = escenario.densidadPapeles ?? 1.0;
    this.maximoPorTramo = escenario.maximoPapelesPorTramo ?? Infinity;
    this.tiposEvidencia = escenario.evidencia ?? ['Documento'];
    this.generadosEsteTramo = 0;

    // A OSCURAS, LOS PAPELES ALUMBRAN. Es lo que sostiene el Apagón desde que
    // la linterna dejó de ser un consumible garantizado: sin luz sigues sin
    // ver la calle, pero ves por dónde va, porque la hilera dibuja la ruta.
    const aOscuras = !!escenario.papelesBrillan;
    ajustarBrilloPapel(aOscuras ? 2.1 : 0.55, aOscuras);
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
