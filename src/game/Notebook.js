// ============================================================================
// ARCHIVO — Meta-progreso persistente
// ============================================================================
// Lo único que sobrevive entre partidas. Guarda en localStorage:
//   · Papeles acumulados (la moneda de meta-progreso)
//   · Páginas desbloqueadas del periódico (reportajes REALES de El Mercio;
//     ver config/publicaciones.js)
//   · Evidencias encontradas
//   · Récords y el árbol de rutas recorridas
//
// Todo el acceso a localStorage pasa por aquí. Si el navegador lo tiene
// bloqueado (modo privado de Safari, por ejemplo), el juego sigue funcionando
// con el progreso solo en memoria: se degrada, no se rompe.
// ============================================================================

import { PROGRESO } from '../config/balance.js';
import { PAGINAS } from '../config/publicaciones.js';

const ESTADO_INICIAL = {
  version: 1,
  totalPapeles: 0,        // Papeles disponibles para gastar
  papelesHistoricos: 0,   // Total acumulado de siempre (nunca baja)
  paginasDesbloqueadas: [],
  evidenciasEncontradas: [],
  mejorDistancia: 0,
  mejorPuntaje: 0,
  partidasJugadas: 0,
  rutasRecorridas: [],    // Historial de escenarios visitados
  personajePreferido: 'chochologo',
  // Dónde te capturaron la última vez. La partida siguiente arranca ahí:
  // volver siempre a la Bahía rompía la continuidad de la temporada y
  // convertía cada muerte en un reinicio del relato, no en un capítulo.
  ultimoEscenario: 'bahia',
  // ¿Se logró alguna vez el trámite perfecto? Es el final del juego.
  denunciaPresentada: false,
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
   * @returns {{paginasNuevas:Array}} Lo que se desbloqueó con esta partida
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

    // Desbloqueo automático: las páginas gratuitas se abren solas.
    const paginasNuevas = this._desbloquearPorAcumulacion();

    this.guardar();
    return { paginasNuevas };
  }

  /**
   * Abre las páginas gratuitas. Las de costo se compran desde el periódico.
   */
  _desbloquearPorAcumulacion() {
    const nuevas = [];

    for (const pagina of PAGINAS) {
      if (this.estado.paginasDesbloqueadas.includes(pagina.numero)) continue;
      if (pagina.costo === 0) {
        this.estado.paginasDesbloqueadas.push(pagina.numero);
        nuevas.push(pagina);
      }
    }

    return nuevas;
  }

  // -------------------------------------------------------------------------
  // PÁGINAS DEL PERIÓDICO
  // -------------------------------------------------------------------------

  /** ¿Está desbloqueada esta página? */
  estaDesbloqueada(numeroPagina) {
    return this.estado.paginasDesbloqueadas.includes(numeroPagina);
  }

  /**
   * Gasta papeles para desbloquear una página del periódico.
   * @returns {{exito:boolean, motivo?:string}}
   */
  desbloquearPagina(numeroPagina) {
    const pagina = PAGINAS.find((p) => p.numero === numeroPagina);
    if (!pagina) return { exito: false, motivo: 'No existe.' };
    if (this.estaDesbloqueada(numeroPagina)) return { exito: false, motivo: 'Ya la tienes.' };

    if (this.estado.totalPapeles < pagina.costo) {
      const faltan = pagina.costo - this.estado.totalPapeles;
      return { exito: false, motivo: `Te faltan ${faltan} papeles` };
    }

    this.estado.totalPapeles -= pagina.costo;
    this.estado.paginasDesbloqueadas.push(numeroPagina);
    this.guardar();

    return { exito: true };
  }

  /** Todas las páginas con su estado, para maquetar el periódico. */
  listarPaginas() {
    return PAGINAS.map((pagina) => ({
      ...pagina,
      desbloqueada: this.estaDesbloqueada(pagina.numero),
      alcanzable: this.estado.totalPapeles >= pagina.costo,
    }));
  }

  /** Cuántas páginas lleva abiertas, para el resumen del ejemplar. */
  get paginasAbiertas() {
    return this.estado.paginasDesbloqueadas.length;
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

  /** Temporada en la que retomar. Es donde te capturaron la última vez. */
  get ultimoEscenario() { return this.estado.ultimoEscenario ?? 'bahia'; }
  set ultimoEscenario(id) {
    this.estado.ultimoEscenario = id;
    this.guardar();
  }

  get denunciaPresentada() { return !!this.estado.denunciaPresentada; }
  set denunciaPresentada(valor) {
    this.estado.denunciaPresentada = !!valor;
    this.guardar();
  }

  /** La siguiente página comprable, para orientar al jugador. */
  proximaPagina() {
    return PAGINAS
      .filter((p) => !this.estaDesbloqueada(p.numero))
      .sort((a, b) => a.costo - b.costo)[0] ?? null;
  }

  /** Borra todo el progreso. Pide confirmación quien la llame. */
  reiniciarProgreso() {
    this.estado = { ...ESTADO_INICIAL };
    this.guardar();
  }
}
