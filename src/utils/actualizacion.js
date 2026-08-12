// ============================================================================
// ACTUALIZACIÓN — Cuándo entra la edición nueva
// ============================================================================
// El juego es una PWA: la primera visita se descarga entero y a partir de ahí
// arranca sin red. Eso resuelve la mitad del problema —no volver a bajar los
// 485 KB de Three.js en cada recarga— pero abre la otra mitad: si el navegador
// se queda con la copia cacheada para siempre, un despliegue no llega nunca.
//
// LA REGLA
// Cuando hay versión nueva, entra ENTERA y cuanto antes. Pero no en mitad de
// una corrida: recargar la página mientras alguien juega le borra la partida
// por un motivo que no tiene nada que ver con el juego. Así que el aviso se
// guarda y se aplica en el primer momento seguro (menú o fin de partida).
//
// POR QUÉ EL REGISTRO ES A MANO
// vite-plugin-pwa trae su propio registrador, pero no deja tocar una opción
// que aquí es la que decide todo: `updateViaCache`.
//
// Sin ella, el navegador sirve `sw.js` desde su caché HTTP y `update()` no
// llega a pedirlo —comprobado: la petición ni siquiera sale—, así que un
// despliegue nuevo puede tardar hasta 24 horas en verse. Con
// `updateViaCache: 'none'` el script del service worker se pide siempre a la
// red, que es justo lo que hace falta para que "hay versión nueva" signifique
// algo.
//
// El resto es el baile estándar: el service worker nuevo se instala y se queda
// EN ESPERA (el sw generado solo se salta la espera si se lo pedimos con un
// mensaje), y cuando toma el control recargamos.
// ============================================================================

// Cada cuánto se le pregunta al servidor si hay algo nuevo. Una hora es
// suficiente para una sesión larga y no molesta a nadie.
const INTERVALO_COMPROBACION = 60 * 60 * 1000;

// Cuánto se vigila como mucho tras una comprobación manual antes de soltar el
// botón. Ver comprobar(): el service worker nuevo tiene que descargarse y
// precachear el bundle entero, así que hay que darle margen de verdad.
//
// Que se acabe la espera NO significa que no haya edición nueva: la escucha
// sigue puesta y el panel se enciende solo si llega más tarde. Por eso el
// mensaje de "no encontré nada" está redactado sin prometer nada.
const ESPERA_MAXIMA = 15000;

/**
 * Estados que puede reportar a la interfaz.
 *
 *   sin-soporte  El navegador no tiene service worker (o estamos en dev).
 *   preparando   Descargando el juego para poder jugar sin conexión.
 *   listo        Cacheado entero: arranca sin red.
 *   buscando     Comprobando si hay edición nueva.
 *   disponible   La hay, y está esperando a que sea seguro aplicarla.
 */
export const ESTADOS = {
  SIN_SOPORTE: 'sin-soporte',
  PREPARANDO: 'preparando',
  LISTO: 'listo',
  BUSCANDO: 'buscando',
  DISPONIBLE: 'disponible',
};

export class Actualizador {
  constructor() {
    this.hayNueva = false;
    this.aplicando = false;
    this.estado = ESTADOS.SIN_SOPORTE;

    /** Se llama cuando aparece una versión nueva, para avisar por la interfaz. */
    this.alDetectar = () => {};
    /** Se llama en cada cambio de estado, para repintar el panel de versión. */
    this.alCambiar = () => {};

    this.registro = null;
  }

  /** La edición que está corriendo ahora mismo. La inyecta el build. */
  get version() {
    return typeof __VERSION__ === 'string' ? __VERSION__ : '—';
  }

  get edicion() {
    return typeof __EDICION__ === 'string' ? __EDICION__ : '—';
  }

  /**
   * Engancha la vigilancia de novedades a un registro.
   *
   * Se llama con el registro inicial y con el que devuelve cada comprobación
   * forzada, porque pueden ser objetos distintos y una escucha atada al
   * anterior se pierde el 'updatefound' del nuevo.
   */
  _vigilar(registro) {
    if (!registro || registro.__vigilado) return;
    registro.__vigilado = true;
    this.registro = registro;

    // Al recargar con una versión ya instalada y en espera, hay que avisar
    // igual: el service worker nuevo no vuelve a emitir 'updatefound'.
    if (registro.waiting && navigator.serviceWorker.controller) this._marcar();

    registro.addEventListener('updatefound', () => {
      const entrante = registro.installing;
      if (!entrante) return;

      entrante.addEventListener('statechange', () => {
        // 'installed' + hay un controlador = es un RECAMBIO, no la primera
        // instalación. Sin la comprobación del controlador avisaríamos de una
        // "versión nueva" a quien acaba de entrar por primera vez.
        if (entrante.state === 'installed' && navigator.serviceWorker.controller) {
          this._marcar();
        }
      });
    });
  }

  _cambiarEstado(nuevo) {
    if (this.estado === nuevo) return;
    this.estado = nuevo;
    this.alCambiar(nuevo);
  }

  /** Registra el service worker y empieza a vigilar. */
  async iniciar() {
    if (!('serviceWorker' in navigator)) return;

    // En desarrollo no hay service worker (devOptions.enabled está en false),
    // así que pedir /sw.js devuelve el index.html del servidor de Vite y el
    // navegador lo rechaza con un error de MIME en consola. No es un fallo
    // real, pero ensucia la consola justo donde se trabaja.
    if (!import.meta.env.PROD) return;

    this._cambiarEstado(ESTADOS.PREPARANDO);

    const base = import.meta.env.BASE_URL ?? '/';

    try {
      this.registro = await navigator.serviceWorker.register(`${base}sw.js`, {
        scope: base,
        // La opción que hace que todo esto funcione. Ver la cabecera.
        updateViaCache: 'none',
        type: 'classic',
      });
    } catch (error) {
      // Sin service worker el juego funciona igual, solo que sin modo offline.
      console.warn('[Actualización] No se pudo registrar el service worker.', error);
      this._cambiarEstado(ESTADOS.SIN_SOPORTE);
      return;
    }

    // Cacheado del todo y controlando la pestaña: a partir de aquí el juego
    // arranca sin red. Es lo que el panel de versión enseña como "listo".
    navigator.serviceWorker.ready.then(() => {
      if (this.estado === ESTADOS.PREPARANDO) this._cambiarEstado(ESTADOS.LISTO);
    });

    this._vigilar(this.registro);

    // Cuando el service worker nuevo toma el control, el código viejo que hay
    // en memoria ya no se corresponde con nada: se recarga para que entre la
    // edición completa y no una mezcla de las dos.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!this.aplicando) return;
      window.location.reload();
    });

    // Comprobación periódica. Sin esto, una pestaña abierta durante horas no
    // se entera de nada: el navegador solo consulta al navegar.
    setInterval(() => {
      if (navigator.onLine) this.registro.update().catch(() => {});
    }, INTERVALO_COMPROBACION);
  }

  /**
   * Dispara una comprobación sin esperar su promesa.
   *
   * Se pide el registro en el momento en vez de reusar el guardado, y se
   * vuelve a enganchar la vigilancia por si el navegador devuelve otro objeto:
   * una escucha atada al anterior se perdería el 'updatefound' de esta
   * comprobación.
   */
  _forzarComprobacion() {
    navigator.serviceWorker.getRegistration()
      .then((registro) => {
        const r = registro ?? this.registro;
        if (!r) return null;
        this._vigilar(r);
        return r.update();
      })
      .catch((error) => {
        console.warn('[Actualización] No se pudo comprobar.', error);
      });
  }

  _marcar() {
    this._cambiarEstado(ESTADOS.DISPONIBLE);
    if (this.hayNueva) return;
    this.hayNueva = true;
    this.alDetectar();
  }

  /**
   * Comprobación a petición del jugador, desde el panel de versión.
   *
   * Existe porque la automática va cada hora, y en una PWA instalada eso puede
   * significar que alguien tenga una edición vieja durante toda una sesión sin
   * forma de enterarse. Un botón que dice «buscar» y responde algo es la
   * diferencia entre un modo offline y un juego que se quedó congelado.
   *
   * @returns {Promise<boolean>} true si apareció una edición nueva
   */
  async comprobar() {
    if (!this.registro) return false;
    if (this.hayNueva) return true;

    const anterior = this.estado;
    this._cambiarEstado(ESTADOS.BUSCANDO);

    // NO se espera a que update() resuelva, y esto costó encontrarlo.
    //
    // Su promesa puede quedarse pendiente indefinidamente —medido: más de
    // quince segundos sin resolver— MIENTRAS el service worker nuevo se
    // instala perfectamente por detrás. O sea que esa promesa ni indica que
    // haya terminado ni indica que no haya nada: no sirve como señal.
    //
    // Quien avisa de verdad es el evento 'updatefound', que ya está enganchado
    // en iniciar() y acaba llamando a _marcar(). Así que aquí se dispara la
    // comprobación y se vigila la bandera.
    // Se RE-REGISTRA en vez de llamar a update(). Volver a registrar el mismo
    // script con el mismo ámbito es la otra forma documentada de forzar la
    // comprobación, y aquí es la que responde: con update() a secas la
    // promesa se quedaba pendiente y el service worker nuevo no llegaba a
    // instalarse aunque el servidor lo estuviera sirviendo.
    this._forzarComprobacion();

    const limite = Date.now() + ESPERA_MAXIMA;
    while (!this.hayNueva && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!this.hayNueva) {
      this._cambiarEstado(anterior === ESTADOS.BUSCANDO ? ESTADOS.LISTO : anterior);
    }
    return this.hayNueva;
  }

  /**
   * Aplica la versión nueva: saca de la espera al service worker y recarga.
   * Quien llame decide CUÁNDO; aquí solo se ejecuta.
   */
  aplicar() {
    if (!this.hayNueva || this.aplicando) return false;

    const enEspera = this.registro?.waiting;
    if (!enEspera) return false;

    this.aplicando = true;
    // El sw generado por Workbox escucha este mensaje para llamar a
    // skipWaiting(). Es lo que dispara el controllerchange de arriba.
    enEspera.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }
}
