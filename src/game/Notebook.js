// ============================================================================
// ARCHIVO — Meta-progreso persistente
// ============================================================================
// Lo único que sobrevive entre partidas. Guarda en localStorage:
//   · Papeles acumulados (la moneda de meta-progreso)
//   · Reportajes desbloqueados (publicaciones REALES de El Mercio;
//     ver config/publicaciones.js)
//   · Evidencias encontradas
//   · Récords y el árbol de rutas recorridas
//
// Todo el acceso a localStorage pasa por aquí. Si el navegador lo tiene
// bloqueado (modo privado de Safari, por ejemplo), el juego sigue funcionando
// con el progreso solo en memoria: se degrada, no se rompe.
// ============================================================================

import { PROGRESO } from '../config/balance.js';
import { PUBLICACIONES } from '../config/publicaciones.js';

const ESTADO_INICIAL = {
  version: 1,
  totalPapeles: 0,        // Papeles disponibles para gastar
  papelesHistoricos: 0,   // Total acumulado de siempre (nunca baja)
  publicacionesDesbloqueadas: [],
  evidenciasEncontradas: [],
  mejorDistancia: 0,
  mejorPuntaje: 0,
  partidasJugadas: 0,
  rutasRecorridas: [],    // Historial de escenarios visitados
  personajePreferido: 'chochologo',
};

export class Notebook {
  constructor() {
    this.almacenamientoDisponible = this._comprobarAlmacenamiento();
    this.estado = this._cargar();
  }

  // -------------------------------------------------------------------------
  // PERSISTENCIA
  // -------------------------------------------------------------------------

  _comprobarAlmacenamiento() {
    try {
      const prueba = '__prueba_elmercio__';
      localStorage.setItem(prueba, '1');
      localStorage.removeItem(prueba);
      return true;
    } catch {
      // Modo privado o almacenamiento deshabilitado. Seguimos sin persistir.
      console.warn('[Cuaderno] localStorage no disponible: el progreso no se guardará.');
      return false;
    }
  }

  _cargar() {
    if (!this.almacenamientoDisponible) return { ...ESTADO_INICIAL };

    try {
      const crudo = localStorage.getItem(PROGRESO.CLAVE_ALMACENAMIENTO);
      if (!crudo) return { ...ESTADO_INICIAL };

      const guardado = JSON.parse(crudo);
      // Fusionamos con el estado inicial para tolerar versiones antiguas
      // a las que les falten campos nuevos.
      return { ...ESTADO_INICIAL, ...guardado };
    } catch (e) {
      console.warn('[Cuaderno] Progreso corrupto, se empieza de cero.', e);
      return { ...ESTADO_INICIAL };
    }
  }

  guardar() {
    if (!this.almacenamientoDisponible) return false;
    try {
      localStorage.setItem(PROGRESO.CLAVE_ALMACENAMIENTO, JSON.stringify(this.estado));
      return true;
    } catch (e) {
      console.warn('[Cuaderno] No se pudo guardar el progreso.', e);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // REGISTRO DE PARTIDAS
  // -------------------------------------------------------------------------

  /**
   * Cierra una partida y consolida su resultado.
   * @param {{papeles:number, distancia:number, puntaje:number,
   *          evidencias:string[], ruta:string[]}} resultado
   * @returns {{publicacionesNuevas:Array}} Lo que se desbloqueó con esta partida
   */
  registrarPartida(resultado) {
    this.estado.totalPapeles += resultado.papeles;
    this.estado.papelesHistoricos += resultado.papeles;
    this.estado.partidasJugadas += 1;

    this.estado.mejorDistancia = Math.max(this.estado.mejorDistancia, resultado.distancia);
    this.estado.mejorPuntaje = Math.max(this.estado.mejorPuntaje, resultado.puntaje);

    // Evidencias: guardamos cada tipo una sola vez.
    for (const ev of resultado.evidencias ?? []) {
      if (!this.estado.evidenciasEncontradas.includes(ev)) {
        this.estado.evidenciasEncontradas.push(ev);
      }
    }

    // Árbol de rutas: guardamos las últimas 50 corridas.
    if (resultado.ruta?.length) {
      this.estado.rutasRecorridas.push(resultado.ruta);
      if (this.estado.rutasRecorridas.length > 50) {
        this.estado.rutasRecorridas.shift();
      }
    }

    // Desbloqueo automático por acumulación histórica.
    const publicacionesNuevas = this._desbloquearPorAcumulacion();

    this.guardar();
    return { publicacionesNuevas };
  }

  /**
   * Desbloquea las publicaciones gratuitas. Las de costo se compran aparte,
   * desde el Archivo.
   */
  _desbloquearPorAcumulacion() {
    const nuevas = [];

    for (const pub of PUBLICACIONES) {
      if (this.estado.publicacionesDesbloqueadas.includes(pub.id)) continue;
      if (pub.costo === 0) {
        this.estado.publicacionesDesbloqueadas.push(pub.id);
        nuevas.push(pub);
      }
    }

    return nuevas;
  }

  // -------------------------------------------------------------------------
  // PUBLICACIONES
  // -------------------------------------------------------------------------

  /** ¿Está desbloqueado este reportaje? */
  estaDesbloqueada(idPublicacion) {
    return this.estado.publicacionesDesbloqueadas.includes(idPublicacion);
  }

  /**
   * Gasta papeles para desbloquear un reportaje.
   * @returns {{exito:boolean, motivo?:string}}
   */
  desbloquearPublicacion(idPublicacion) {
    const pub = PUBLICACIONES.find((p) => p.id === idPublicacion);
    if (!pub) return { exito: false, motivo: 'No existe.' };
    if (this.estaDesbloqueada(idPublicacion)) return { exito: false, motivo: 'Ya lo tienes.' };

    if (this.estado.totalPapeles < pub.costo) {
      const faltan = pub.costo - this.estado.totalPapeles;
      return { exito: false, motivo: `Te faltan ${faltan} papeles.` };
    }

    this.estado.totalPapeles -= pub.costo;
    this.estado.publicacionesDesbloqueadas.push(idPublicacion);
    this.guardar();

    return { exito: true };
  }

  /** Lista completa de reportajes con su estado, para pintar el Archivo. */
  listarPublicaciones() {
    return PUBLICACIONES.map((pub) => ({
      ...pub,
      desbloqueada: this.estaDesbloqueada(pub.id),
      alcanzable: this.estado.totalPapeles >= pub.costo,
    }));
  }

  // -------------------------------------------------------------------------
  // CONSULTAS
  // -------------------------------------------------------------------------

  get papeles() { return this.estado.totalPapeles; }
  get papelesHistoricos() { return this.estado.papelesHistoricos; }
  get mejorDistancia() { return this.estado.mejorDistancia; }
  get mejorPuntaje() { return this.estado.mejorPuntaje; }
  get partidasJugadas() { return this.estado.partidasJugadas; }
  get evidencias() { return this.estado.evidenciasEncontradas; }
  get rutas() { return this.estado.rutasRecorridas; }

  get personajePreferido() { return this.estado.personajePreferido; }
  set personajePreferido(nombre) {
    this.estado.personajePreferido = nombre;
    this.guardar();
  }

  /** El siguiente reportaje comprable, para orientar al jugador. */
  proximaPublicacion() {
    return PUBLICACIONES
      .filter((p) => !this.estaDesbloqueada(p.id))
      .sort((a, b) => a.costo - b.costo)[0] ?? null;
  }

  /** Borra todo el progreso. Pide confirmación quien la llame. */
  reiniciarProgreso() {
    this.estado = { ...ESTADO_INICIAL };
    this.guardar();
  }
}
