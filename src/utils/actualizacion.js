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

export class Actualizador {
  constructor() {
    this.hayNueva = false;
    this.aplicando = false;
    /** Se llama cuando aparece una versión nueva, para avisar por la interfaz. */
    this.alDetectar = () => {};

    this.registro = null;
  }

  /** Registra el service worker y empieza a vigilar. */
  async iniciar() {
    if (!('serviceWorker' in navigator)) return;

    // En desarrollo no hay service worker (devOptions.enabled está en false),
    // así que pedir /sw.js devuelve el index.html del servidor de Vite y el
    // navegador lo rechaza con un error de MIME en consola. No es un fallo
    // real, pero ensucia la consola justo donde se trabaja.
    if (!import.meta.env.PROD) return;

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
      return;
    }

    // Al recargar con una versión ya instalada y en espera, hay que avisar
    // igual: el service worker nuevo no vuelve a emitir 'updatefound'.
    if (this.registro.waiting && navigator.serviceWorker.controller) {
      this._marcar();
    }

    this.registro.addEventListener('updatefound', () => {
      const entrante = this.registro.installing;
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

  _marcar() {
    if (this.hayNueva) return;
    this.hayNueva = true;
    this.alDetectar();
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
