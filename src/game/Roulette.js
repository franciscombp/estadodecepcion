// ============================================================================
// RULETA — La bifurcación institucional
// ============================================================================
// Al final de cada tramo el jugador elige:
//   · Izquierda / Derecha → sigue corriendo, va al escenario vecino
//   · De frente           → entra a la institución y gira la ruleta
//
// Las probabilidades son deliberadamente malas (20-30% de éxito) y son el
// chiste del juego: la vía institucional casi nunca funciona, pero paga bien
// cuando funciona. Carondelet no tiene ruleta — ir de frente ahí es perder,
// sin sorteo de por medio.
//
// La ruleta es lógica pura, sin DOM ni Three.js: quien la dibuja es la UI.
// Así se puede testear sola.
// ============================================================================

import { obtenerEscenario } from '../config/escenarios.js';

export class Roulette {
  constructor() {
    this.girando = false;
    this.ultimoResultado = null;
  }

  /**
   * ¿Se puede ir de frente en este escenario?
   * @param {string} idEscenario
   */
  tieneInstitucion(idEscenario) {
    const esc = obtenerEscenario(idEscenario);
    return esc.institucion !== null && esc.institucion !== undefined;
  }

  /**
   * Datos de la institución para pintar el cartel de la bifurcación.
   * Devuelve null si el escenario no tiene (Carondelet).
   */
  datosInstitucion(idEscenario) {
    const esc = obtenerEscenario(idEscenario);
    if (!esc.institucion) return null;
    return {
      nombre: esc.institucion.nombre,
      probabilidad: esc.institucion.probabilidadExito,
      // Porcentaje ya formateado para el cartel.
      porcentaje: Math.round(esc.institucion.probabilidadExito * 100),
    };
  }

  /**
   * Gira la ruleta del escenario dado.
   *
   * @param {string} idEscenario
   * @returns {{exito:boolean, texto:string, institucion:string,
   *            recompensa:number, probabilidad:number}}
   */
  girar(idEscenario) {
    const esc = obtenerEscenario(idEscenario);

    // Carondelet: ir de frente es perder. No hay sorteo.
    if (esc.frenteEsMuerte) {
      this.ultimoResultado = {
        exito: false,
        muerteDirecta: true,
        texto: esc.textoFrente,
        institucion: 'EL CERCO',
        recompensa: 0,
        probabilidad: 0,
      };
      return this.ultimoResultado;
    }

    if (!esc.institucion) {
      // Salvaguarda: si un escenario no define institución, tratamos el
      // "de frente" como una ruta normal sin premio ni castigo.
      this.ultimoResultado = {
        exito: true,
        texto: 'Seguiste de frente. No pasó nada. Tampoco es poco.',
        institucion: '—',
        recompensa: 0,
        probabilidad: 1,
      };
      return this.ultimoResultado;
    }

    const probabilidad = esc.institucion.probabilidadExito;
    const exito = Math.random() < probabilidad;

    // La recompensa compensa el riesgo: cuanto más improbable, más paga.
    // Con 20% de éxito → 250 papeles. Con 30% → ~167.
    const recompensa = exito ? Math.round(50 / probabilidad) : 0;

    this.ultimoResultado = {
      exito,
      muerteDirecta: false,
      texto: exito ? esc.institucion.textoExito : esc.institucion.textoFracaso,
      institucion: esc.institucion.nombre,
      recompensa,
      probabilidad,
    };

    return this.ultimoResultado;
  }

  /**
   * Resuelve a qué escenario lleva una decisión.
   *
   * @param {string} idActual
   * @param {'izquierda'|'derecha'} direccion
   * @returns {string} id del escenario destino
   */
  resolverRuta(idActual, direccion) {
    const esc = obtenerEscenario(idActual);
    return esc.rutas[direccion] ?? 'bahia';
  }

  /**
   * Genera la secuencia de ángulos para animar una ruleta visual que acabe
   * en el resultado ya decidido. La animación NUNCA decide el resultado:
   * primero se sortea, después se dibuja. Es la única forma de que la
   * probabilidad sea la que dice el cartel.
   *
   * @param {boolean} exito
   * @returns {{anguloFinal:number, vueltas:number}}
   */
  anguloParaResultado(exito) {
    // Sector de éxito: los primeros 90° del círculo. Sector de fracaso: el resto.
    const base = exito
      ? Math.random() * 80 + 5      // 5°..85°
      : Math.random() * 260 + 100;  // 100°..360°

    return {
      anguloFinal: base,
      vueltas: 4 + Math.floor(Math.random() * 3), // 4-6 vueltas completas
    };
  }
}
