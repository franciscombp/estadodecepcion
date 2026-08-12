// ============================================================================
// RUTAS — El mapa del rombo
// ============================================================================
// Resuelve a qué temporada lleva cada boca de túnel:
//
//   izquierda / derecha → la temporada vecina
//   centro              → el trámite (ver game/Tramite.js)
//
// Esto ANTES era una ruleta: el centro sorteaba un porcentaje y la suerte
// decidía si la denuncia entraba. Ya no. La vía institucional se juega, no se
// sortea, así que de aquella clase solo sobrevive lo que siempre fue lógica de
// mapa —y este archivo es esa parte.
//
// Sin DOM y sin Three.js a propósito: se puede probar sola.
// ============================================================================

import { obtenerEscenario } from '../config/escenarios.js';

export class Rutas {
  /**
   * ¿Se puede entrar al trámite en esta temporada?
   * En Carondelet no: ahí el túnel del centro es el cerco.
   */
  tieneInstitucion(idEscenario) {
    const esc = obtenerEscenario(idEscenario);
    return esc.institucion !== null && esc.institucion !== undefined;
  }

  /**
   * Datos de la institución para rotular el túnel central.
   * Devuelve null si la temporada no tiene (Carondelet).
   */
  datosInstitucion(idEscenario) {
    const esc = obtenerEscenario(idEscenario);
    if (!esc.institucion) return null;
    return {
      nombre: esc.institucion.nombre,
      textoExito: esc.institucion.textoExito,
      textoFracaso: esc.institucion.textoFracaso,
    };
  }

  /**
   * A qué temporada lleva una boca lateral.
   *
   * @param {string} idActual
   * @param {'izquierda'|'derecha'} direccion
   * @returns {string} id de la temporada destino
   */
  resolverRuta(idActual, direccion) {
    const esc = obtenerEscenario(idActual);
    return esc.rutas[direccion] ?? 'bahia';
  }
}
