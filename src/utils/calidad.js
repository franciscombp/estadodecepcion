// ============================================================================
// CALIDAD — Detección y ajuste adaptativo del nivel gráfico
// ============================================================================
// El objetivo es 60 FPS en móviles de gama media. Como no hay forma fiable de
// saber de antemano cuánto rinde un dispositivo, hacemos dos cosas:
//
//   1. Una ESTIMACIÓN inicial a partir de señales del navegador (memoria,
//      núcleos, GPU declarada). Sirve para no arrancar con todo encendido en
//      un equipo que no puede.
//   2. Una VIGILANCIA continua durante la partida: si el framerate se cae de
//      forma sostenida, se baja de nivel en caliente.
//
// La estimación se equivoca a menudo —los navegadores mienten sobre el
// hardware por privacidad— así que lo que de verdad protege el rendimiento es
// la vigilancia. La estimación solo evita el primer segundo feo.
// ============================================================================

import { CALIDAD } from '../config/estilo.js';

/**
 * Estima el nivel de calidad inicial del dispositivo.
 * @returns {{nivel:string, bloom:boolean, pixelRatioMaximo:number,
 *            decoradosPorLado:number, sombrasNeon:boolean, particulas:boolean}}
 */
export function detectarCalidad() {
  // Override manual por URL: ?calidad=alta|media|baja
  // Sirve para probar los tres niveles en el mismo dispositivo sin tener que
  // conseguir tres teléfonos distintos.
  const forzada = new URLSearchParams(location.search).get('calidad');
  if (forzada && CALIDAD[forzada]) {
    console.info(`[Calidad] Forzada por URL: ${forzada}`);
    return { nivel: forzada, ...CALIDAD[forzada], forzada: true };
  }

  let puntos = 0;

  // --- Núcleos de CPU ------------------------------------------------------
  const nucleos = navigator.hardwareConcurrency ?? 4;
  if (nucleos >= 8) puntos += 2;
  else if (nucleos >= 4) puntos += 1;

  // --- Memoria (solo la exponen los navegadores basados en Chromium) -------
  const memoria = navigator.deviceMemory ?? 4;
  if (memoria >= 8) puntos += 2;
  else if (memoria >= 4) puntos += 1;

  // --- Densidad de pantalla ------------------------------------------------
  // Una pantalla muy densa multiplica los píxeles a pintar. En un equipo
  // modesto con pantalla retina, el coste de relleno es el cuello de botella.
  const dpr = window.devicePixelRatio ?? 1;
  if (dpr > 2.5) puntos -= 1;

  // --- GPU declarada -------------------------------------------------------
  puntos += puntuarGPU();

  // --- Resolución ----------------------------------------------------------
  const pixeles = window.screen.width * window.screen.height * dpr * dpr;
  if (pixeles > 4_000_000) puntos -= 1;

  let nivel;
  if (puntos >= 4) nivel = 'alta';
  else if (puntos >= 2) nivel = 'media';
  else nivel = 'baja';

  return { nivel, ...CALIDAD[nivel] };
}

/**
 * Intenta leer el nombre de la GPU y puntuarla.
 * Muchos navegadores lo ocultan por privacidad; en ese caso devolvemos 0 y
 * dejamos que decidan las otras señales.
 */
function puntuarGPU() {
  try {
    const lienzo = document.createElement('canvas');
    const gl = lienzo.getContext('webgl') || lienzo.getContext('experimental-webgl');
    if (!gl) return -1;

    const info = gl.getExtension('WEBGL_debug_renderer_info');
    if (!info) return 0;

    const gpu = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)).toLowerCase();

    // Renderizado por software: sin GPU real, todo lo caro se va al suelo.
    if (gpu.includes('swiftshader') || gpu.includes('llvmpipe') || gpu.includes('software')) {
      return -3;
    }

    // Gama alta reconocible.
    if (/apple (a1[4-9]|m[1-9])/.test(gpu)) return 2;
    if (/adreno \(tm\) (7[0-9][0-9]|6[5-9][0-9])/.test(gpu)) return 2;
    if (/mali-g[7-9][0-9]/.test(gpu)) return 1;
    if (gpu.includes('nvidia') || gpu.includes('radeon')) return 2;

    // Gama baja conocida.
    if (/adreno \(tm\) [1-5][0-9][0-9]/.test(gpu)) return -1;
    if (/mali-[tg][0-5][0-9]/.test(gpu)) return -1;

    return 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// VIGILANTE DE RENDIMIENTO
// ---------------------------------------------------------------------------

/**
 * Observa el framerate y avisa cuando conviene bajar de nivel.
 *
 * Solo baja, nunca sube: subir de nivel a media partida provocaría un tirón
 * justo cuando el juego va bien, y el jugador lo leería como un fallo. Es
 * preferible quedarse en el nivel prudente hasta la siguiente carga.
 */
export class VigilanteRendimiento {
  /**
   * @param {(nuevoNivel:string)=>void} alBajarNivel
   */
  constructor(alBajarNivel) {
    this.alBajarNivel = alBajarNivel;

    this.muestras = [];
    this.tiempoUltimoAjuste = 0;
    this.nivelActual = null;

    // Nº de fotogramas por ventana de medición.
    this.TAMANO_VENTANA = 90;
    // Por debajo de esto consideramos que no llega.
    this.FPS_MINIMO = 45;
    // Margen entre ajustes: bajar dos escalones seguidos por un tirón puntual
    // dejaría el juego feo sin necesidad.
    this.ESPERA_ENTRE_AJUSTES = 6000;
  }

  establecerNivel(nivel) {
    this.nivelActual = nivel;
  }

  /**
   * Registra un fotograma. Llamar una vez por frame con el delta en segundos.
   */
  registrar(dt) {
    // Si el nivel se forzó por URL, respetamos la decisión: quien está
    // probando quiere ver ese nivel, no el que el vigilante crea mejor.
    if (this.nivelForzado) return;

    // Ignoramos fotogramas anómalos (pestaña en segundo plano, GC largo):
    // contarlos dispararía una bajada de nivel que no hace falta.
    if (dt <= 0 || dt > 0.5) return;

    this.muestras.push(dt);
    if (this.muestras.length < this.TAMANO_VENTANA) return;

    const suma = this.muestras.reduce((a, b) => a + b, 0);
    const fpsMedio = this.muestras.length / suma;
    this.muestras.length = 0;

    if (fpsMedio >= this.FPS_MINIMO) return;

    const ahora = performance.now();
    if (ahora - this.tiempoUltimoAjuste < this.ESPERA_ENTRE_AJUSTES) return;

    const siguiente = this._siguienteNivelAbajo();
    if (!siguiente) return; // Ya estamos en el mínimo.

    this.tiempoUltimoAjuste = ahora;
    this.nivelActual = siguiente;

    console.info(
      `[Calidad] ${Math.round(fpsMedio)} FPS sostenidos: bajando a calidad ${siguiente}.`,
    );
    this.alBajarNivel(siguiente);
  }

  _siguienteNivelAbajo() {
    if (this.nivelActual === 'alta') return 'media';
    if (this.nivelActual === 'media') return 'baja';
    return null;
  }
}
