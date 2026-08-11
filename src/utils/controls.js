// ============================================================================
// CONTROLES — Teclado (escritorio) y swipe (móvil)
// ============================================================================
// Cuatro acciones, exactamente las de Subway Surfers:
//   izquierda / derecha → cambio de carril
//   arriba              → saltar
//   abajo               → agacharse (y caída rápida si estás en el aire)
//
// El módulo NO conoce al jugador: solo traduce entradas físicas a intenciones
// y las emite. Quien las ejecuta es Player.js. Así podemos cambiar el esquema
// de control sin tocar la lógica de juego.
// ============================================================================

const UMBRAL_SWIPE = 28;        // Píxeles mínimos para considerar un swipe.
const TIEMPO_MAXIMO_SWIPE = 600; // ms — más lento que esto no es un swipe.

export class Controles {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.oyentes = new Map();

    this.tactilInicioX = 0;
    this.tactilInicioY = 0;
    this.tactilInicioTiempo = 0;
    this.activo = false;

    // Guardamos las funciones ligadas para poder quitarlas después.
    this._onKeyDown = this._manejarTecla.bind(this);
    this._onTouchStart = this._manejarTactilInicio.bind(this);
    this._onTouchEnd = this._manejarTactilFin.bind(this);
    this._onTouchMove = this._manejarTactilMovimiento.bind(this);
  }

  /** Suscribe una función a una acción ('izquierda', 'derecha', 'saltar', 'agachar', 'pausa'). */
  on(accion, callback) {
    if (!this.oyentes.has(accion)) this.oyentes.set(accion, new Set());
    this.oyentes.get(accion).add(callback);
    return this;
  }

  /** Emite una acción a todos sus suscriptores. */
  emitir(accion) {
    const conjunto = this.oyentes.get(accion);
    if (conjunto) conjunto.forEach((cb) => cb());
  }

  /** Empieza a escuchar entradas. */
  activar() {
    if (this.activo) return;
    window.addEventListener('keydown', this._onKeyDown);
    // passive:false porque necesitamos preventDefault para que el swipe no
    // arrastre la página en iOS.
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: false });
    this.activo = true;
  }

  /** Deja de escuchar entradas. */
  desactivar() {
    if (!this.activo) return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    this.activo = false;
  }

  // -------------------------------------------------------------------------
  // TECLADO
  // -------------------------------------------------------------------------
  _manejarTecla(evento) {
    switch (evento.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.emitir('izquierda');
        evento.preventDefault();
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        this.emitir('derecha');
        evento.preventDefault();
        break;

      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ': // Barra espaciadora
        this.emitir('saltar');
        evento.preventDefault();
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        this.emitir('agachar');
        evento.preventDefault();
        break;

      case 'Escape':
      case 'p':
      case 'P':
        this.emitir('pausa');
        evento.preventDefault();
        break;
    }
  }

  // -------------------------------------------------------------------------
  // TÁCTIL
  // -------------------------------------------------------------------------
  _manejarTactilInicio(evento) {
    const toque = evento.touches[0];
    this.tactilInicioX = toque.clientX;
    this.tactilInicioY = toque.clientY;
    this.tactilInicioTiempo = performance.now();
  }

  _manejarTactilMovimiento(evento) {
    // Bloqueamos el scroll/rebote mientras el dedo está sobre el canvas.
    if (evento.cancelable) evento.preventDefault();
  }

  _manejarTactilFin(evento) {
    const toque = evento.changedTouches[0];
    if (!toque) return;

    const dx = toque.clientX - this.tactilInicioX;
    const dy = toque.clientY - this.tactilInicioY;
    const dt = performance.now() - this.tactilInicioTiempo;

    if (dt > TIEMPO_MAXIMO_SWIPE) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // El eje dominante decide la acción: así un swipe diagonal no dispara dos.
    if (absX < UMBRAL_SWIPE && absY < UMBRAL_SWIPE) return;

    if (evento.cancelable) evento.preventDefault();

    if (absX > absY) {
      this.emitir(dx > 0 ? 'derecha' : 'izquierda');
    } else {
      this.emitir(dy > 0 ? 'agachar' : 'saltar');
    }
  }
}
