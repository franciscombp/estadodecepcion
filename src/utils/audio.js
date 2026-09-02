// ============================================================================
// AUDIO — Efectos sintetizados con Web Audio API
// ============================================================================
// No cargamos archivos de sonido: los generamos en el momento con osciladores.
// Ventajas para este proyecto:
//   · Cero peso en el bundle y nada que cachear.
//   · Nada que pueda fallar al descargar.
//   · Los sonidos se afinan cambiando números, no reexportando WAVs.
//
// El AudioContext se crea SUSPENDIDO y solo arranca tras el primer gesto del
// usuario: los navegadores móviles lo exigen y, si no, el audio queda mudo
// toda la sesión sin dar error.
// ============================================================================

export class Audio {
  constructor() {
    this.ctx = null;
    this.silenciado = false;
    this.volumenMaestro = 0.35;
    this.iniciado = false;
  }

  /** Crea el contexto. Debe llamarse desde un manejador de evento de usuario. */
  iniciar() {
    if (this.iniciado) return;

    try {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) {
        console.warn('[Audio] Web Audio no disponible; el juego seguirá en silencio.');
        return;
      }

      this.ctx = new Contexto();

      // ── LA CADENA MAESTRA ────────────────────────────────────────────────
      // Antes era una sola ganancia enchufada a la salida, y con eso el juego
      // SATURABA. No es una impresión: los sonidos se suman en la salida, y
      // aquí se solapan de tres en tres a poco que pase algo. Un papel con
      // racha son dos tonos a 0,14 y 0,08; si en el mismo fotograma hay un
      // golpe (ruido a 0,4 + sierra a 0,3) y todavía suena el arpegio de un
      // archivo (cuatro tonos a 0,2), la suma pasa de 1 y el navegador lo
      // recorta a lo bruto: eso es el chasquido que se oía al chocar mientras
      // recogías.
      //
      // Un limitador lo baja en vez de recortarlo. El umbral en −14 dB con
      // ratio 12 hace que lo que se pase se aplaste en vez de romperse, y el
      // ataque de 3 ms lo pilla antes de que suene. `release` largo (0,25 s)
      // para que no bombee entre papel y papel.
      this.limitador = this.ctx.createDynamicsCompressor();
      this.limitador.threshold.value = -14;
      this.limitador.knee.value = 6;
      this.limitador.ratio.value = 12;
      this.limitador.attack.value = 0.003;
      this.limitador.release.value = 0.25;
      this.limitador.connect(this.ctx.destination);

      this.maestro = this.ctx.createGain();
      this.maestro.gain.value = this.volumenMaestro;
      this.maestro.connect(this.limitador);

      // ── Y LA CALLE ───────────────────────────────────────────────────────
      // Todo sonaba SECO, o sea dentro de la cabeza en vez de en un sitio. La
      // partida pasa en una calle de La Bahía, con paredes a los dos lados, y
      // eso tiene un eco corto.
      //
      // No es una reverb: es un retardo con realimentación y un filtro que se
      // come los agudos en cada vuelta, que es lo que hace una pared de
      // hormigón. Cuesta tres nodos para todo el juego —no uno por sonido— y
      // 0,085 s es el ida y vuelta de unos catorce metros, que es el ancho de
      // una calle con sus fachadas.
      //
      // Al 18 %: lo justo para que se note el sitio. Más y cada papel deja una
      // cola que se pisa con el siguiente, y a cien papeles por partida eso es
      // barro.
      this.eco = this.ctx.createDelay(0.5);
      this.eco.delayTime.value = 0.085;
      const realimenta = this.ctx.createGain();
      realimenta.gain.value = 0.26;
      const paredes = this.ctx.createBiquadFilter();
      paredes.type = 'lowpass';
      paredes.frequency.value = 2200;
      const envio = this.ctx.createGain();
      envio.gain.value = 0.18;

      this.maestro.connect(envio);
      envio.connect(this.eco);
      this.eco.connect(paredes);
      paredes.connect(realimenta);
      realimenta.connect(this.eco);
      paredes.connect(this.limitador);

      this.iniciado = true;
    } catch (e) {
      console.warn('[Audio] No se pudo iniciar el audio.', e);
    }
  }

  /** Reanuda el contexto si el navegador lo suspendió. */
  reanudar() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  /**
   * Bloque básico: un oscilador con envolvente.
   * @param {object} opciones
   */
  _tono({
    frecuencia = 440,
    frecuenciaFinal = null,
    duracion = 0.12,
    tipo = 'sine',
    volumen = 0.4,
    retardo = 0,
  }) {
    if (!this.iniciado || this.silenciado || !this.ctx) return;

    const t0 = this.ctx.currentTime + retardo;

    const osc = this.ctx.createOscillator();
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, t0);

    if (frecuenciaFinal !== null) {
      // Barrido exponencial: suena mucho más natural que el lineal.
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, frecuenciaFinal),
        t0 + duracion,
      );
    }

    const env = this.ctx.createGain();
    // Ataque muy corto pero no instantáneo: evita el "click" del corte seco.
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(volumen, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);

    osc.connect(env);
    env.connect(this.maestro);

    osc.start(t0);
    osc.stop(t0 + duracion + 0.02);
  }

  /** Ruido blanco con envolvente, para golpes e impactos. */
  _ruido({ duracion = 0.2, volumen = 0.3, frecuenciaFiltro = 1200 }) {
    if (!this.iniciado || this.silenciado || !this.ctx) return;

    const t0 = this.ctx.currentTime;
    const muestras = Math.floor(this.ctx.sampleRate * duracion);
    const buffer = this.ctx.createBuffer(1, muestras, this.ctx.sampleRate);
    const datos = buffer.getChannelData(0);

    for (let i = 0; i < muestras; i++) {
      datos[i] = Math.random() * 2 - 1;
    }

    const fuente = this.ctx.createBufferSource();
    fuente.buffer = buffer;

    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.setValueAtTime(frecuenciaFiltro, t0);
    filtro.frequency.exponentialRampToValueAtTime(200, t0 + duracion);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(volumen, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);

    fuente.connect(filtro);
    filtro.connect(env);
    env.connect(this.maestro);

    fuente.start(t0);
  }

  // -------------------------------------------------------------------------
  // EFECTOS DEL JUEGO
  // -------------------------------------------------------------------------

  cambioCarril() {
    this._tono({ frecuencia: 320, frecuenciaFinal: 460, duracion: 0.09, tipo: 'triangle', volumen: 0.18 });
  }

  saltar() {
    this._tono({ frecuencia: 280, frecuenciaFinal: 620, duracion: 0.16, tipo: 'sine', volumen: 0.26 });
  }

  agachar() {
    this._tono({ frecuencia: 420, frecuenciaFinal: 180, duracion: 0.13, tipo: 'sine', volumen: 0.22 });
  }

  /**
   * ATERRIZAR. El salto no tenía cierre: sonaba al despegar y nada al caer, y
   * un salto sin golpe abajo se siente flotando —el cuerpo baja pero no llega
   * a ninguna parte—. Es el sonido más barato que hay para dar peso.
   *
   * @param {number} fuerza 0..1, de dejarse caer un palmo a caer de una tarima.
   *   Escala las tres cosas a la vez, que es lo que separa un aterrizaje de
   *   otro: cuánto suena, cuán grave, y cuánto dura.
   */
  aterrizar(fuerza = 0.5) {
    const f = Math.max(0, Math.min(1, fuerza));
    // La suela: ruido corto y muy filtrado. Nada de agudos, que eso es cristal.
    this._ruido({
      duracion: 0.08 + f * 0.06,
      volumen: 0.10 + f * 0.16,
      frecuenciaFiltro: 420 + f * 260,
    });
    // Y el peso, que es lo que se nota en el pecho. Cae de golpe: un cuerpo
    // que aterriza no rebota en el suelo, lo golpea.
    this._tono({
      frecuencia: 150 - f * 40,
      frecuenciaFinal: 58 - f * 14,
      duracion: 0.10 + f * 0.08,
      tipo: 'sine',
      volumen: 0.12 + f * 0.16,
    });
  }

  /**
   * ACTIVAR UN POTENCIADOR. Estaba MUDO, y es lo más raro que pasa en una
   * partida: lo único que cambia las reglas durante diez segundos. Se veía
   * —anillo y estallido— y no se oía.
   *
   * Se distingue de los otros dos premios a propósito, porque los tres pasan
   * en la misma partida y hay que saber cuál sonó: el archivo es un arpegio
   * que SUBE (523·659·784·1047), el sobre es ese mismo arpegio una octava
   * arriba, y este es un ACORDE —las tres notas a la vez, no una detrás de
   * otra— que se abre hacia arriba. Un acorde no se confunde con un arpegio ni
   * de refilón.
   */
  potenciador() {
    // Quinta y octava sobre la tónica: suena a que algo se abre, no a melodía.
    [262, 392, 523].forEach((f) => {
      this._tono({
        frecuencia: f, frecuenciaFinal: f * 2,
        duracion: 0.5, tipo: 'triangle', volumen: 0.13,
      });
    });
    // Y el aire de debajo, que es lo que le da cuerpo al acorde.
    this._ruido({ duracion: 0.4, volumen: 0.10, frecuenciaFiltro: 2600 });
  }

  /**
   * ROZAR: pasar a un palmo de algo sin tocarlo.
   *
   * El juego no decía nada cuando esquivabas por poco, y esquivar por poco es
   * la mitad de lo que se hace aquí. No es una recompensa —no da papeles ni
   * toca el marcador— es un ACUSE: te enteras de que estuvo cerca, y por eso
   * es un soplo de aire y no una fanfarria.
   *
   * Ruido filtrado alto y brevísimo: el sonido de algo grande pasando de
   * largo. Va bajo (0,12) porque puede dispararse varias veces seguidas en un
   * tramo apretado y no puede taparse el resto del juego.
   */
  rozar() {
    this._ruido({ duracion: 0.16, volumen: 0.12, frecuenciaFiltro: 5200 });
  }

  /**
   * Recoger papel. La combo sube el tono: recompensa audible por encadenar,
   * igual que las monedas del original.
   */
  papel(combo = 0) {
    const base = 880 * Math.pow(1.0595, Math.min(combo, 12)); // Sube un semitono por papel.
    this._tono({ frecuencia: base, duracion: 0.08, tipo: 'square', volumen: 0.14 });
    this._tono({ frecuencia: base * 1.5, duracion: 0.06, tipo: 'sine', volumen: 0.08, retardo: 0.02 });
  }

  /** Recoger evidencia: arpegio ascendente, se nota que es importante. */
  evidencia() {
    const notas = [523, 659, 784, 1047];
    notas.forEach((f, i) => {
      this._tono({ frecuencia: f, duracion: 0.16, tipo: 'triangle', volumen: 0.2, retardo: i * 0.055 });
    });
  }

  /** Choque contra obstáculo. */
  golpe() {
    this._ruido({ duracion: 0.28, volumen: 0.4, frecuenciaFiltro: 900 });
    this._tono({ frecuencia: 140, frecuenciaFinal: 55, duracion: 0.3, tipo: 'sawtooth', volumen: 0.3 });
  }

  /** Captura: fin de la partida. */
  captura() {
    this._ruido({ duracion: 0.6, volumen: 0.45, frecuenciaFiltro: 700 });
    [330, 262, 196, 147].forEach((f, i) => {
      this._tono({ frecuencia: f, duracion: 0.35, tipo: 'sawtooth', volumen: 0.26, retardo: i * 0.13 });
    });
  }

  /** Clic de la ruleta girando. */
  clicRuleta() {
    this._tono({ frecuencia: 1200, duracion: 0.03, tipo: 'square', volumen: 0.1 });
  }

  /** Resultado de la ruleta. */
  resultadoRuleta(exito) {
    if (exito) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        this._tono({ frecuencia: f, duracion: 0.3, tipo: 'triangle', volumen: 0.24, retardo: i * 0.09 });
      });
    } else {
      [392, 349, 294].forEach((f, i) => {
        this._tono({ frecuencia: f, duracion: 0.4, tipo: 'sawtooth', volumen: 0.22, retardo: i * 0.14 });
      });
    }
  }

  /**
   * Se abre un sobre: lo que sale de él es lo más raro que reparte el juego.
   *
   * Es el arpegio de la evidencia subido una octava y con una quinta encima,
   * que es como suena algo que no pasa todos los días. Se distingue del
   * `resultadoRuleta(true)` a propósito: aquel es alivio —te salvaste— y éste
   * es hallazgo.
   */
  hallazgo() {
    [523, 784, 1047, 1568].forEach((f, i) => {
      this._tono({ frecuencia: f, duracion: 0.42, tipo: 'triangle', volumen: 0.2, retardo: i * 0.07 });
    });
    this._tono({ frecuencia: 261, duracion: 0.7, tipo: 'sine', volumen: 0.14, retardo: 0.02 });
  }

  /** Entrar a un escenario nuevo. */
  cambioEscenario() {
    this._tono({ frecuencia: 196, frecuenciaFinal: 587, duracion: 0.5, tipo: 'triangle', volumen: 0.2 });
  }

  /**
   * LA TENSIÓN DEL PERSEGUIDOR, que es lo único que puede acabar la partida y
   * hasta ahora solo se veía en una barra del HUD.
   *
   * Es un zumbido grave continuo cuyo volumen y brillo suben con la cercanía.
   * Lo importante es que no es un aviso que salta a los cinco metros: crece
   * DESDE LEJOS, así que el jugador sabe que va perdiendo terreno antes de
   * poder leerlo en ninguna parte. Y como sube y baja, también premia soltarse
   * —el silencio que vuelve cuando te separas es la mitad del efecto—.
   *
   * Un solo oscilador y un filtro para toda la partida. Se arranca al empezar
   * a correr y se para al terminar: un oscilador que se queda vivo en los
   * menús es un zumbido que nadie sabe de dónde sale.
   */
  arrancarTension() {
    if (!this.iniciado || !this.ctx || this.tension) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 47;          // Por debajo de donde vive la melodía.

    // Un segundo oscilador desafinado tres centésimas de tono. Dos sierras
    // casi iguales laten entre ellas, y ese latido lento es lo que hace que un
    // zumbido suene amenazante en vez de averiado.
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 47 * 1.008;

    const filtro = this.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 120;
    filtro.Q.value = 4;

    const gan = this.ctx.createGain();
    gan.gain.value = 0;

    osc.connect(filtro);
    osc2.connect(filtro);
    filtro.connect(gan);
    // NO va por el eco: un zumbido continuo realimentándose en el retardo se
    // convierte en un colchón que se come el resto de los sonidos. Va derecho
    // al limitador, que además lo aparta cuando suena cualquier otra cosa.
    gan.connect(this.limitador);

    osc.start();
    osc2.start();
    this.tension = { osc, osc2, filtro, gan };
  }

  /**
   * @param {number} cercania 0 = lejos y tranquilo, 1 = encima.
   */
  actualizarTension(cercania) {
    if (!this.tension || !this.ctx) return;
    const c = Math.max(0, Math.min(1, this.silenciado ? 0 : cercania));

    // AL CUADRADO, no lineal. Lineal, el zumbido está a medio volumen cuando
    // el perseguidor va por la mitad de su recorrido —o sea casi siempre— y
    // deja de significar nada. Al cuadrado se queda callado mientras la cosa
    // va bien y se echa encima en el último tercio, que es cuando importa.
    const objetivo = c * c * 0.22;
    // Rampas de un cuarto de segundo: sin ellas, cada fotograma es un salto de
    // ganancia y eso se oye como un crujido.
    const t = this.ctx.currentTime;
    this.tension.gan.gain.setTargetAtTime(objetivo, t, 0.25);
    // Y se ABRE al acercarse: más agudos es más presente, aunque el volumen
    // apenas cambie. Es el mismo truco que usa cualquier motor de coche.
    this.tension.filtro.frequency.setTargetAtTime(110 + c * 340, t, 0.25);
  }

  pararTension() {
    if (!this.tension) return;
    const { osc, osc2, gan } = this.tension;
    const t = this.ctx.currentTime;
    // Se baja antes de parar: cortar un oscilador a media onda es un chasquido.
    gan.gain.cancelScheduledValues(t);
    gan.gain.setTargetAtTime(0, t, 0.08);
    osc.stop(t + 0.4);
    osc2.stop(t + 0.4);
    this.tension = null;
  }

  alternarSilencio() {
    this.silenciado = !this.silenciado;
    // La tensión no pasa por `_tono`, así que el silencio no la alcanzaba: se
    // quedaba zumbando con el juego mudo.
    if (this.silenciado) this.actualizarTension(0);
    return this.silenciado;
  }
}
