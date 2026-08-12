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
   * Datos de la institución. Devuelve null si la temporada no tiene
   * (Carondelet: allí el túnel del centro es el cerco).
   *
   * SE DEVUELVE ENTERA. Antes copiaba tres campos a mano —nombre, textoExito y
   * un textoFracaso que ni siquiera existe en la configuración— y el resto se
   * perdía por el camino. No era un detalle: `hallazgo` viajaba por aquí, así
   * que la evidencia que se supone que te llevas del trámite NUNCA se
   * entregaba, y los textos de entrada y portazo caían siempre al valor por
   * defecto. Una lista blanca escrita a mano se queda vieja en cuanto alguien
   * añade un campo, y aquí se quedó vieja en silencio.
   */
  datosInstitucion(idEscenario) {
    const esc = obtenerEscenario(idEscenario);
    if (!esc.institucion) return null;
    return { ...esc.institucion };
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
