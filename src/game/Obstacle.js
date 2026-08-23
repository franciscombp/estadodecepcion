// ============================================================================
// OBSTÁCULOS — Generación por grupos, pool de objetos y colisión
// ============================================================================
// REGLA DE ORO: todo grupo generado tiene que ser superable.
//
// Antes de decidir qué obstáculos poner, el generador elige un "carril
// solución" y garantiza que por ahí se pueda pasar (vacío, o con algo que se
// libre saltando o agachándose). Recién después rellena los otros carriles.
// Así es imposible generar un muro impasable, que es el bug clásico de los
// endless runners hechos a ojo.
//
// La separación entre grupos se escala con la velocidad para que el TIEMPO de
// reacción sea constante: a 42 u/s los grupos van más separados que a 18 u/s.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, OBSTACULOS } from '../config/balance.js';
import { crearObstaculo, crearSombra } from '../models/props.js';
import { crearCaja, hayColision } from '../utils/collision.js';

// Tipos que se pueden superar sin abandonar el carril.
// Destruye una malla de obstáculo liberando su memoria — MENOS los materiales
// compartidos. El rojo de peligro es UN material para todas las franjas de la
// pista (ver props.matPeligro) y sigue en uso por los obstáculos vivos y por
// los que están por crearse: destruirlo aquí obligaba al renderer a
// reinicializarlo al fotograma siguiente, un tirón que caía justo en cada
// aproximación a la bifurcación y en cada cambio de temporada.
function desechar(malla) {
  malla.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material && !n.material.userData.compartido) n.material.dispose();
  });
}

const TIPOS_SUPERABLES = ['saltar', 'agachar'];
// Tipos que obligan a cambiar de carril.
const TIPOS_SOLIDOS = ['esquivar'];

export class ObstacleManager {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    /** Obstáculos actualmente en pista. */
    this.activos = [];
    /** Pool de mallas reutilizables, indexado por tipo. */
    this.pool = new Map();

    this.colores = { props: 0xd9a441, acento: 0xffcf3f };
    // Qué escena viste los obstáculos. Ver vestirObstaculo() en props.js.
    this.escenario = 'bahia';
    this.proximaZ = -OBSTACULOS.DISTANCIA_APARICION;

    // Se pone a true durante las transiciones de escenario para dejar de
    // generar (la pista se vacía antes de la bifurcación).
    this.generacionPausada = false;

    // Tramos de carril vetados. Los pide el gestor de niveles elevados: una
    // tarima ocupa 20-35 metros seguidos, o sea varios grupos, y un bloque
    // sólido generado ahí dentro aparecería dentro de la madera.
    this.reservas = [];
  }

  // -------------------------------------------------------------------------
  // RESERVAS DE CARRIL
  // -------------------------------------------------------------------------

  /**
   * Veta un carril en un tramo de Z. Las reservas se mueven con el mundo, como
   * todo lo demás, y caducan solas al quedar atrás.
   *
   * @param {number} carril
   * @param {number} zLejano  Extremo más alejado del jugador (más negativo)
   * @param {number} zCercano Extremo más cercano
   */
  reservar(carril, zLejano, zCercano) {
    this.reservas.push({ carril, zLejano, zCercano });
  }

  /** ¿Está vetado este carril en esta Z? */
  _estaReservado(carril, z) {
    for (const r of this.reservas) {
      if (r.carril !== carril) continue;
      if (z >= r.zLejano && z <= r.zCercano) return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // POOL
  // -------------------------------------------------------------------------

  _obtenerDelPool(tipo) {
    if (!this.pool.has(tipo)) this.pool.set(tipo, []);
    const libres = this.pool.get(tipo);

    if (libres.length > 0) return libres.pop();

    const malla = crearObstaculo(tipo, this.colores, this.escenario);

    // SU SOMBRA, colgada del propio obstáculo. Va como hijo y no suelta —al
    // revés que la del personaje— porque un obstáculo no salta: se mueve en Z
    // con su grupo y la mancha tiene que ir con él sin que nadie la coloque.
    //
    // El tamaño sale de su caja envolvente y se mide UNA vez, al sacarlo del
    // molde: los obstáculos se reciclan por tipo, así que el de un tipo mide
    // siempre lo mismo y volver a medirlo por fotograma sería pagar por nada.
    //
    // Y no es sólo aspecto: la sombra dice a qué distancia está el obstáculo,
    // que en un corredor con curvatura del mundo —donde lo lejano se hunde por
    // debajo de la cresta— es justo lo que cuesta juzgar.
    // EL RADIO SE ACOTA, y no es prudencia: medido, la caja envolvente de un
    // obstáculo incluye sus halos y su cono de luz —que son mallas de varios
    // metros— y salían manchas de diez metros tapando media calzada y trepando
    // por las fachadas. Un obstáculo ocupa un carril, y un carril mide 2,4.
    const caja = new THREE.Box3().setFromObject(malla);
    const huella = Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z) * 0.55;
    const sombra = crearSombra(THREE.MathUtils.clamp(huella, 0.55, 1.5));
    sombra.position.y = 0.02;
    sombra.material.opacity = 0.75;
    malla.add(sombra);

    malla.visible = false;
    this.grupo.add(malla);
    return malla;
  }

  _devolverAlPool(obstaculo) {
    obstaculo.malla.visible = false;
    // Se deshace el hundimiento del choque antes de guardarlo: el pool
    // reparte mallas, y una que vuelva medio enterrada y ladeada reaparece
    // así a cien metros de aquí.
    obstaculo.malla.position.y = 0;
    obstaculo.malla.rotation.x = 0;
    const libres = this.pool.get(obstaculo.tipo) ?? [];
    // Si el pool ya está lleno, destruimos en vez de acumular memoria.
    if (libres.length >= OBSTACULOS.TAMANO_POOL) {
      this.grupo.remove(obstaculo.malla);
      desechar(obstaculo.malla);
    } else {
      libres.push(obstaculo.malla);
      this.pool.set(obstaculo.tipo, libres);
    }
  }

  // -------------------------------------------------------------------------
  // GENERACIÓN
  // -------------------------------------------------------------------------

  /**
   * Calcula la separación hasta el siguiente grupo.
   * Se escala con la velocidad para que el TIEMPO de reacción sea constante:
   * a 42 u/s los grupos van más separados que a 18 u/s.
   */
  _calcularSeparacion(velocidad) {
    const separacionPorTiempo = velocidad * OBSTACULOS.TIEMPO_REACCION_MINIMO;
    const base = Math.max(OBSTACULOS.SEPARACION_MINIMA, separacionPorTiempo);
    const extra = Math.random() * (OBSTACULOS.SEPARACION_MAXIMA - OBSTACULOS.SEPARACION_MINIMA);
    return base + extra;
  }

  /**
   * Genera un grupo de obstáculos en la Z indicada.
   * Devuelve la lista de carriles que quedaron transitables sin cambiar de
   * carril (útil para decidir dónde poner los papeles).
   */
  _generarGrupo(z) {
    // 0. Carriles vetados por una tarima. Si alguno lo está, es además el
    //    candidato ideal a carril solución: por ahí se pasa seguro.
    const vetados = [0, 1, 2].filter((c) => this._estaReservado(c, z));

    // 1. Elegimos el carril por el que SÍ se puede pasar.
    const carrilSolucion = vetados.length > 0
      ? vetados[Math.floor(Math.random() * vetados.length)]
      : Math.floor(Math.random() * 3);

    // 2. Decidimos qué hay en el carril solución.
    //    40% vacío, 60% algo que se libra saltando o agachándose.
    let tipoSolucion = null;
    if (!vetados.includes(carrilSolucion) && Math.random() > 0.4) {
      tipoSolucion = TIPOS_SUPERABLES[Math.floor(Math.random() * TIPOS_SUPERABLES.length)];
    }

    const carrilesOcupados = new Set();

    if (tipoSolucion) {
      this._colocar(tipoSolucion, [carrilSolucion], z);
      carrilesOcupados.add(carrilSolucion);
    }

    // 3. Los otros dos carriles.
    const otrosCarriles = [0, 1, 2].filter((c) => c !== carrilSolucion);

    // ¿Ponemos un "doble" (bus) que cubra los dos carriles restantes?
    // Solo cabe si los dos restantes son adyacentes, es decir, si el carril
    // solución es uno de los extremos.
    const sonAdyacentes = Math.abs(otrosCarriles[0] - otrosCarriles[1]) === 1
      && !otrosCarriles.some((c) => vetados.includes(c));

    if (sonAdyacentes && Math.random() < OBSTACULOS.PROBABILIDAD_DOBLE) {
      this._colocar('doble', otrosCarriles, z);
      otrosCarriles.forEach((c) => carrilesOcupados.add(c));
    } else {
      for (const carril of otrosCarriles) {
        if (vetados.includes(carril)) continue;
        const r = Math.random();
        if (r < 0.45) {
          // Bloque sólido: obliga a no estar aquí.
          this._colocar(TIPOS_SOLIDOS[0], [carril], z);
          carrilesOcupados.add(carril);
        } else if (r < 0.72) {
          // Otro superable: da alternativas al jugador hábil.
          const t = TIPOS_SUPERABLES[Math.floor(Math.random() * TIPOS_SUPERABLES.length)];
          this._colocar(t, [carril], z);
          carrilesOcupados.add(carril);
        }
        // Resto: se queda vacío.
      }
    }

    // Carriles por los que se puede correr recto sin hacer nada.
    return [0, 1, 2].filter((c) => !carrilesOcupados.has(c));
  }

  /**
   * Instancia un obstáculo de un tipo en uno o varios carriles.
   * @param {string} tipo
   * @param {number[]} carriles Índices de carril que ocupa
   * @param {number} z
   */
  _colocar(tipo, carriles, z) {
    const malla = this._obtenerDelPool(tipo);
    malla.visible = true;

    // Posición X: centro de los carriles que ocupa.
    const xs = carriles.map((c) => CARRILES.POSICIONES[c]);
    const x = xs.reduce((a, b) => a + b, 0) / xs.length;

    malla.position.set(x, 0, z);
    malla.rotation.x = 0;

    // Caja de colisión según el tipo. Aquí es donde se codifica la regla
    // física: qué altura ocupa cada obstáculo.
    let centroY;
    let altoCaja;
    let profundidad = OBSTACULOS.PROFUNDIDAD * 0.6;

    switch (tipo) {
      case 'saltar':
        centroY = OBSTACULOS.ALTURA_SALTAR / 2;
        altoCaja = OBSTACULOS.ALTURA_SALTAR;
        break;
      case 'agachar':
        // Ocupa desde ALTURA_AGACHAR_DESDE hacia arriba: hay que pasar debajo.
        altoCaja = 1.0;
        centroY = OBSTACULOS.ALTURA_AGACHAR_DESDE + altoCaja / 2;
        profundidad = OBSTACULOS.PROFUNDIDAD * 0.5;
        break;
      case 'doble':
        centroY = OBSTACULOS.ALTURA_ESQUIVAR / 2;
        altoCaja = OBSTACULOS.ALTURA_ESQUIVAR;
        profundidad = OBSTACULOS.PROFUNDIDAD * 1.6;
        break;
      case 'esquivar':
      default:
        centroY = OBSTACULOS.ALTURA_ESQUIVAR / 2;
        altoCaja = OBSTACULOS.ALTURA_ESQUIVAR;
        profundidad = OBSTACULOS.PROFUNDIDAD * 0.7;
        break;
    }

    const anchoCaja = carriles.length > 1
      ? CARRILES.ANCHO * 1.8
      : CARRILES.ANCHO * 0.8;

    this.activos.push({
      malla,
      tipo,
      carriles,
      x,
      z,
      centroY,
      altoCaja,
      anchoCaja,
      profundidad,
      // Marca para no contar el mismo choque dos veces.
      yaGolpeo: false,
    });
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * Llena la pista de golpe, desde justo delante del jugador hasta la
   * distancia de aparición.
   *
   * Es imprescindible al empezar una partida y en cada cambio de escenario:
   * sin esto la pista arranca VACÍA y el jugador corre en el desierto hasta
   * que los primeros obstáculos, generados a 220 unidades, llegan hasta él.
   *
   * @param {number} velocidad
   * @param {(carrilesLibres:number[], z:number, gap:number)=>void} [alGenerarGrupo]
   * @param {number} [segundosCiegos] Cuánto tiempo va a estar el jugador SIN
   *   PODER VER cuando esta pista arranque: el giro de la bifurcación, el
   *   polvo, el destello. Se suma al margen de lectura, porque un obstáculo
   *   que aparece mientras la cámara todavía está doblando la esquina no se
   *   esquiva —no se ve—.
   */
  precargar(velocidad, alGenerarGrupo = null, segundosCiegos = 0) {
    // EL MARGEN ES TIEMPO, NO METROS. Ver OBSTACULOS.SEGUNDOS_PRIMER_GRUPO:
    // con una distancia fija, el tramo que se entra a toda velocidad —el de
    // después de la esquina— era el que menos margen daba.
    const segundos = OBSTACULOS.SEGUNDOS_PRIMER_GRUPO + Math.max(0, segundosCiegos);
    this.proximaZ = -Math.max(
      OBSTACULOS.DISTANCIA_PRIMER_GRUPO,
      Math.max(1, velocidad) * segundos,
    );

    while (this.proximaZ > -OBSTACULOS.DISTANCIA_APARICION) {
      const zGrupo = this.proximaZ;
      const carrilesLibres = this._generarGrupo(zGrupo);
      const separacion = this._calcularSeparacion(velocidad);

      alGenerarGrupo?.(carrilesLibres, zGrupo, separacion);

      this.proximaZ -= separacion;
    }
  }

  /**
   * @param {number} avance    Distancia recorrida este fotograma
   * @param {number} velocidad Velocidad actual (para escalar la separación)
   * @returns {{carrilesLibres:number[], z:number, gap:number}|null}
   *          Datos del último grupo generado, o null si no se generó ninguno
   */
  actualizar(avance, velocidad) {
    let ultimoGrupo = null;

    // Mover y caducar las reservas de carril.
    for (let i = this.reservas.length - 1; i >= 0; i--) {
      const r = this.reservas[i];
      r.zLejano += avance;
      r.zCercano += avance;
      if (r.zLejano > OBSTACULOS.DISTANCIA_RECICLADO) this.reservas.splice(i, 1);
    }

    // Mover y reciclar.
    for (let i = this.activos.length - 1; i >= 0; i--) {
      const o = this.activos[i];
      o.z += avance;
      o.malla.position.z = o.z;

      // LO QUE YA TE DIO SE HUNDE. Medido fotograma a fotograma después de un
      // choque: desde el cuarto fotograma la cara delantera del obstáculo está
      // MÁS CERCA DE LA CÁMARA que el personaje, y su caja en pantalla lo
      // contiene entero. O sea que durante los veinte fotogramas que tarda en
      // pasar de largo, el jugador está detrás de un camión. Empujarlo hacia
      // atrás ayuda los primeros fotogramas y nada más: el obstáculo viene a
      // veinte metros por segundo y acaba pasando por encima de cualquier
      // retroceso razonable.
      //
      // Así que el obstáculo se va. No de golpe —desaparecer un camión a
      // cuatro metros de la cámara se lee como un fallo— sino hundiéndose en
      // el asfalto y ladeándose, que con la sacudida de cámara y el estallido
      // de papeles encima se lee como que se quedó atrás. Y el asfalto lo tapa
      // solo: cualquier rayo desde una cámara que mira desde arriba hasta un
      // punto por debajo de cero cruza la calzada antes.
      //
      // Va por Z y no por tiempo: así se hunde exactamente en el tramo en que
      // taparía al jugador, corra éste a la velocidad que corra.
      if (o.yaGolpeo) {
        const f = Math.max(0, Math.min(1, (o.z - (o.zGolpe ?? o.z)) / 1.8));
        o.malla.position.y = -f * (o.altoCaja + 1.4);
        o.malla.rotation.x = f * 0.22;
      }

      if (o.z > OBSTACULOS.DISTANCIA_RECICLADO) {
        this._devolverAlPool(o);
        this.activos.splice(i, 1);
      }
    }

    // Generar hacia adelante.
    if (!this.generacionPausada) {
      this.proximaZ += avance;

      while (this.proximaZ > -OBSTACULOS.DISTANCIA_APARICION) {
        const zGrupo = this.proximaZ;
        const carrilesLibres = this._generarGrupo(zGrupo);
        const separacion = this._calcularSeparacion(velocidad);

        ultimoGrupo = { carrilesLibres, z: zGrupo, gap: separacion };
        this.proximaZ -= separacion;
      }
    }

    return ultimoGrupo;
  }

  /**
   * Comprueba si el jugador choca con algún obstáculo.
   * Colisión AABB pura: el salto y la agachada se resuelven solos porque
   * cambian la caja del jugador. No hay casos especiales.
   *
   * @returns {object|null} El obstáculo golpeado, o null
   */
  comprobarColision(jugador) {
    const cajaJugador = jugador.obtenerCaja();

    for (const o of this.activos) {
      if (o.yaGolpeo) continue;
      // Descarte rápido por Z antes de la comprobación completa.
      if (Math.abs(o.z) > 4) continue;

      const cajaObstaculo = crearCaja(
        o.x, o.centroY, o.z,
        o.anchoCaja, o.altoCaja, o.profundidad,
      );

      if (hayColision(cajaJugador, cajaObstaculo)) {
        o.yaGolpeo = true;
        // Dónde estaba al dar: el hundimiento se mide desde aquí, para que
        // empiece en el fotograma del golpe y no un metro después.
        o.zGolpe = o.z;
        return o;
      }
    }

    return null;
  }

  /**
   * Cuánto tendría que apartarse de lado algo que corre por (xBase, z) para no
   * llevarse por delante ningún obstáculo.
   *
   * Lo piden los perseguidores. Van entre el jugador y la cámara —en Z 2,4—, y
   * los obstáculos siguen viniendo hasta Z 5,5, así que TODO lo que el jugador
   * esquiva les pasa a ellos por encima cinco décimas después. Medido en un
   * minuto de partida: 163 fotogramas de 3600 con la caja del dúo metida
   * dentro de la de un obstáculo, o sea uno de cada veintidós, con solapes de
   * hasta 1,3 m. Se veía un contenedor atravesando a dos personas.
   *
   * No se resuelve reciclando antes —a Z 1,5 los obstáculos se esfumarían en
   * mitad del cuadro— ni con un salto: hay obstáculos altos, y a veinte metros
   * por segundo la ventana para saltarlos es de una décima. Se resuelve
   * apartándose, que es además lo que haría cualquiera.
   *
   * El aviso son nueve metros, que a la velocidad de crucero son cuatro
   * décimas: bastante para que el desvío se lea como un quiebro y no como un
   * teletransporte.
   *
   * @param {number} xBase  Dónde iría si no hubiera nada
   * @param {number} z
   * @param {number} ancho  Lo que ocupa de lado quien pregunta
   * @param {number} aviso  Cuánto mira hacia adelante, en metros
   * @returns {number} Desplazamiento lateral DESDE xBase (0 si está libre).
   *   Se calcula contra xBase y no contra la posición ya desviada a propósito:
   *   preguntando desde donde ya te apartaste, la respuesta es siempre «estás
   *   bien» y el desvío se deshace justo cuando hace falta.
   */
  apartarse(xBase, z, ancho = 1.4, aviso = 14) {
    // Todo lo que viene, como tramos de X ocupados.
    const bultos = [];
    for (const o of this.activos) {
      if (o.z < z - aviso || o.z > z + 1.5) continue;
      const r = o.anchoCaja / 2 + ancho / 2 + 0.2;
      bultos.push([o.x - r, o.x + r]);
    }
    if (!bultos.length) return 0;

    const libre = (x) => bultos.every(([a, b]) => x <= a || x >= b);
    if (libre(xBase)) return 0;

    // EL HUECO LIBRE MÁS CERCANO, y no «el lado por el que salgo de este
    // bulto»: mirando los obstáculos de uno en uno, apartarse del contenedor
    // del carril derecho los metía justo debajo del que había en el central.
    // Los candidatos son los bordes de los propios bultos —el hueco entre dos
    // obstáculos empieza donde acaba uno—.
    const BORDE = 3.6;   // más allá se salen de cuadro
    let mejor = null;
    for (const [a, b] of bultos) {
      for (const donde of [a - 0.02, b + 0.02]) {
        if (donde < -BORDE || donde > BORDE || !libre(donde)) continue;
        if (mejor === null || Math.abs(donde - xBase) < Math.abs(mejor - xBase)) mejor = donde;
      }
    }
    // Si los tres carriles están tapados no hay nada que hacer: se pasa por
    // dentro. Pasa poco y dura una décima.
    return mejor === null ? 0 : mejor - xBase;
  }


  // -------------------------------------------------------------------------
  // TEMA Y CICLO DE VIDA
  // -------------------------------------------------------------------------

  /**
   * Cambia la paleta. Vacía la pista y el pool para que los obstáculos
   * se reconstruyan con los colores nuevos. Se llama en las transiciones,
   * donde hay un overlay tapando el cambio.
   */
  aplicarTema(colores, idEscenario = this.escenario) {
    this.colores = colores;
    this.escenario = idEscenario;
    this.limpiar();

    // Vaciamos el pool: las mallas guardadas tienen los colores viejos.
    for (const [, mallas] of this.pool) {
      for (const malla of mallas) {
        this.grupo.remove(malla);
        desechar(malla);
      }
    }
    this.pool.clear();
  }

  /**
   * Quita los obstáculos que estén MÁS ALLÁ de una Z dada, dejando intactos
   * los que el jugador ya tiene encima.
   *
   * Lo usa la bifurcación para vaciar el corredor de decisión. Pausar la
   * generación no basta: los obstáculos ya creados siguen llegando durante
   * más de 200 unidades, y el jugador acabaría eligiendo el carril que le
   * tocó esquivar en vez del que quería.
   *
   * El límite se pone lo bastante lejos como para que la niebla tape la
   * desaparición: nada se esfuma delante de los ojos del jugador.
   *
   * @param {number} zLimite Se borra todo con z menor que este valor
   */
  limpiarAdelante(zLimite) {
    for (let i = this.activos.length - 1; i >= 0; i--) {
      const o = this.activos[i];
      if (o.z >= zLimite) continue;

      this.grupo.remove(o.malla);
      desechar(o.malla);
      this.activos.splice(i, 1);
    }
  }

  /** Quita todos los obstáculos de la pista. */
  limpiar() {
    for (const o of this.activos) {
      this.grupo.remove(o.malla);
      desechar(o.malla);
    }
    this.activos = [];
    this.reservas = [];
    this.proximaZ = -OBSTACULOS.DISTANCIA_APARICION;
  }

  /** Reinicia para una nueva partida. */
  reiniciar() {
    this.limpiar();
    this.generacionPausada = false;
  }
}
