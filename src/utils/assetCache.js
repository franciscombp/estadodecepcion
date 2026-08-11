// ============================================================================
// CACHÉ DE ASSETS — Envoltorio de IndexedDB
// ============================================================================
// ESTADO ACTUAL: el juego no necesita esta caché para funcionar, porque todos
// los modelos son procedurales y los sonidos están sintetizados. El bundle
// entero lo cachea el Service Worker.
//
// PARA QUÉ ESTÁ ENTONCES: es la infraestructura lista para cuando El Mercio
// tenga modelos .glb reales, texturas de fondo o música. Esos archivos sí
// pesan, y el Service Worker no es el sitio adecuado para binarios grandes
// (su caché se invalida en cada despliegue). IndexedDB sí los conserva entre
// versiones.
//
// USO PREVISTO:
//   const cache = new AssetCache();
//   await cache.abrir();
//   const buffer = await cache.obtenerOBajar('noboa.glb', '/assets/models/noboa.glb');
//   // A partir de la segunda vez, `buffer` sale de IndexedDB sin tocar la red.
// ============================================================================

const NOMBRE_BD = 'elmercio-estadodecepcion';
const VERSION_BD = 1;
const ALMACEN = 'assets';

export class AssetCache {
  constructor() {
    this.bd = null;
    this.disponible = typeof indexedDB !== 'undefined';
  }

  /**
   * Abre (y si hace falta crea) la base de datos.
   * @returns {Promise<boolean>} true si quedó lista
   */
  abrir() {
    if (!this.disponible) {
      console.warn('[Caché] IndexedDB no disponible; se descargará siempre de red.');
      return Promise.resolve(false);
    }
    if (this.bd) return Promise.resolve(true);

    return new Promise((resolver) => {
      const peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);

      peticion.onupgradeneeded = (evento) => {
        const bd = evento.target.result;
        if (!bd.objectStoreNames.contains(ALMACEN)) {
          const almacen = bd.createObjectStore(ALMACEN, { keyPath: 'clave' });
          almacen.createIndex('guardadoEn', 'guardadoEn', { unique: false });
        }
      };

      peticion.onsuccess = () => {
        this.bd = peticion.result;
        resolver(true);
      };

      peticion.onerror = () => {
        // Safari en modo privado, cuota agotada, etc. No es motivo para
        // romper el juego: seguimos tirando de red.
        console.warn('[Caché] No se pudo abrir IndexedDB.', peticion.error);
        this.disponible = false;
        resolver(false);
      };
    });
  }

  /**
   * Guarda un asset binario.
   * @param {string} clave
   * @param {ArrayBuffer} datos
   * @param {string} [tipo] MIME, informativo
   */
  guardar(clave, datos, tipo = 'application/octet-stream') {
    if (!this.bd) return Promise.resolve(false);

    return new Promise((resolver) => {
      try {
        const tx = this.bd.transaction(ALMACEN, 'readwrite');
        tx.objectStore(ALMACEN).put({
          clave,
          datos,
          tipo,
          guardadoEn: Date.now(),
          bytes: datos.byteLength ?? 0,
        });
        tx.oncomplete = () => resolver(true);
        tx.onerror = () => {
          console.warn(`[Caché] No se pudo guardar "${clave}".`, tx.error);
          resolver(false);
        };
      } catch (e) {
        console.warn(`[Caché] Error al guardar "${clave}".`, e);
        resolver(false);
      }
    });
  }

  /**
   * Recupera un asset.
   * @returns {Promise<ArrayBuffer|null>}
   */
  obtener(clave) {
    if (!this.bd) return Promise.resolve(null);

    return new Promise((resolver) => {
      try {
        const tx = this.bd.transaction(ALMACEN, 'readonly');
        const peticion = tx.objectStore(ALMACEN).get(clave);
        peticion.onsuccess = () => resolver(peticion.result?.datos ?? null);
        peticion.onerror = () => resolver(null);
      } catch {
        resolver(null);
      }
    });
  }

  /**
   * El método principal: devuelve el asset desde caché, y si no está,
   * lo descarga y lo guarda para la próxima.
   *
   * @param {string} clave  Identificador estable del asset
   * @param {string} url    De dónde bajarlo si no está cacheado
   * @param {(progreso:number)=>void} [alProgresar] 0..1
   * @returns {Promise<ArrayBuffer|null>}
   */
  async obtenerOBajar(clave, url, alProgresar = null) {
    const cacheado = await this.obtener(clave);
    if (cacheado) {
      alProgresar?.(1);
      return cacheado;
    }

    try {
      const respuesta = await fetch(url);
      if (!respuesta.ok) {
        throw new Error(`HTTP ${respuesta.status} al pedir ${url}`);
      }

      let datos;

      // Si el servidor informa del tamaño y podemos leer por trozos,
      // reportamos progreso real en vez de un spinner ciego.
      const total = Number(respuesta.headers.get('content-length')) || 0;
      if (total > 0 && respuesta.body && alProgresar) {
        const lector = respuesta.body.getReader();
        const trozos = [];
        let recibido = 0;

        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          trozos.push(value);
          recibido += value.length;
          alProgresar(Math.min(1, recibido / total));
        }

        const unido = new Uint8Array(recibido);
        let offset = 0;
        for (const trozo of trozos) {
          unido.set(trozo, offset);
          offset += trozo.length;
        }
        datos = unido.buffer;
      } else {
        datos = await respuesta.arrayBuffer();
        alProgresar?.(1);
      }

      await this.guardar(clave, datos, respuesta.headers.get('content-type') ?? undefined);
      return datos;
    } catch (e) {
      console.warn(`[Caché] Falló la descarga de "${clave}".`, e);
      return null;
    }
  }

  /**
   * Descarga en lote, reportando progreso global.
   * @param {Array<{clave:string, url:string}>} lista
   * @param {(progreso:number, clave:string)=>void} [alProgresar]
   */
  async precargar(lista, alProgresar = null) {
    const resultados = new Map();

    for (let i = 0; i < lista.length; i++) {
      const { clave, url } = lista[i];
      const datos = await this.obtenerOBajar(clave, url, (p) => {
        // Progreso global: los ya terminados más la fracción del actual.
        alProgresar?.((i + p) / lista.length, clave);
      });
      resultados.set(clave, datos);
    }

    alProgresar?.(1, null);
    return resultados;
  }

  /** Cuánto ocupa la caché, en bytes. */
  async tamano() {
    if (!this.bd) return 0;

    return new Promise((resolver) => {
      try {
        const tx = this.bd.transaction(ALMACEN, 'readonly');
        const peticion = tx.objectStore(ALMACEN).getAll();
        peticion.onsuccess = () => {
          const total = (peticion.result ?? []).reduce((suma, r) => suma + (r.bytes ?? 0), 0);
          resolver(total);
        };
        peticion.onerror = () => resolver(0);
      } catch {
        resolver(0);
      }
    });
  }

  /** Vacía la caché. */
  vaciar() {
    if (!this.bd) return Promise.resolve(false);

    return new Promise((resolver) => {
      try {
        const tx = this.bd.transaction(ALMACEN, 'readwrite');
        tx.objectStore(ALMACEN).clear();
        tx.oncomplete = () => resolver(true);
        tx.onerror = () => resolver(false);
      } catch {
        resolver(false);
      }
    });
  }
}
