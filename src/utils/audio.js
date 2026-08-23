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
      this.maestro = this.ctx.createGain();
      this.maestro.gain.value = this.volumenMaestro;
      this.maestro.connect(this.ctx.destination);

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

  /** Recoger estamina. */
  estamina() {
    this._tono({ frecuencia: 392, frecuenciaFinal: 784, duracion: 0.24, tipo: 'sine', volumen: 0.24 });
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

  alternarSilencio() {
    this.silenciado = !this.silenciado;
    return this.silenciado;
  }
}
