// ============================================================================
// CUADERNO DE EXPEDIENTES — Meta-progreso persistente
// ============================================================================
// Lo único que sobrevive entre partidas. Guarda en localStorage:
//   · Papeles acumulados (la moneda de meta-progreso)
//   · Fichas desbloqueadas
//   · Evidencias encontradas
//   · Récords y el árbol de rutas recorridas
//
// Todo el acceso a localStorage pasa por aquí. Si el navegador lo tiene
// bloqueado (modo privado de Safari, por ejemplo), el juego sigue funcionando
// con el progreso solo en memoria: se degrada, no se rompe.
// ============================================================================

import { PROGRESO } from '../config/balance.js';
import { FICHAS_CUADERNO } from '../config/textos.js';

const ESTADO_INICIAL = {
  version: 1,
  totalPapeles: 0,        // Papeles disponibles para gastar
  papelesHistoricos: 0,   // Total acumulado de siempre (nunca baja)
  fichasDesbloqueadas: [],
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
   * @returns {{fichasNuevas:Array}} Lo que se desbloqueó con esta partida
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
    const fichasNuevas = this._desbloquearPorAcumulacion();

    this.guardar();
    return { fichasNuevas };
  }

  /**
   * Desbloquea las fichas gratuitas que correspondan al total histórico.
   * Las fichas con costo se compran aparte, desde el cuaderno.
   */
  _desbloquearPorAcumulacion() {
    const nuevas = [];

    for (const ficha of FICHAS_CUADERNO) {
      if (this.estado.fichasDesbloqueadas.includes(ficha.id)) continue;
      // Las de costo 0 se abren solas la primera vez.
      if (ficha.costo === 0) {
        this.estado.fichasDesbloqueadas.push(ficha.id);
        nuevas.push(ficha);
      }
    }

    return nuevas;
  }

  // -------------------------------------------------------------------------
  // FICHAS
  // -------------------------------------------------------------------------

  /** ¿Está desbloqueada esta ficha? */
  estaDesbloqueada(idFicha) {
    return this.estado.fichasDesbloqueadas.includes(idFicha);
  }

  /**
   * Gasta papeles para desbloquear una ficha.
   * @returns {{exito:boolean, motivo?:string}}
   */
  desbloquearFicha(idFicha) {
    const ficha = FICHAS_CUADERNO.find((f) => f.id === idFicha);
    if (!ficha) return { exito: false, motivo: 'La ficha no existe.' };
    if (this.estaDesbloqueada(idFicha)) return { exito: false, motivo: 'Ya la tienes.' };

    if (this.estado.totalPapeles < ficha.costo) {
      const faltan = ficha.costo - this.estado.totalPapeles;
      return { exito: false, motivo: `Te faltan ${faltan} papeles.` };
    }

    this.estado.totalPapeles -= ficha.costo;
    this.estado.fichasDesbloqueadas.push(idFicha);
    this.guardar();

    return { exito: true };
  }

  /** Lista completa de fichas con su estado, para pintar el cuaderno. */
  listarFichas() {
    return FICHAS_CUADERNO.map((ficha) => ({
      ...ficha,
      desbloqueada: this.estaDesbloqueada(ficha.id),
      alcanzable: this.estado.totalPapeles >= ficha.costo,
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

  /** Cuántos papeles faltan para la siguiente ficha comprable. */
  proximaFicha() {
    const pendientes = FICHAS_CUADERNO
      .filter((f) => !this.estaDesbloqueada(f.id))
      .sort((a, b) => a.costo - b.costo);
    return pendientes[0] ?? null;
  }

  /** Borra todo el progreso. Pide confirmación quien la llame. */
  reiniciarProgreso() {
    this.estado = { ...ESTADO_INICIAL };
    this.guardar();
  }
}
