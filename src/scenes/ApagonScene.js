// ============================================================================
// EL APAGÓN — Crisis energética
// ============================================================================
// MECÁNICA ESPECIAL: la pantalla se oscurece. Solo ves unos metros por delante
// y las linternas (el ítem de estamina de este escenario) amplían la visión
// durante unos segundos además de recuperar energía.
//
// NOTA DE DISEÑO IMPORTANTE — por qué la oscuridad ESCALA con la velocidad:
// Si la visibilidad fuera un valor fijo (pongamos 16 metros), a velocidad
// inicial tendrías ~0.9 s para reaccionar, pero a velocidad máxima tendrías
// 0.38 s. Eso no es difícil, es imposible: el obstáculo aparecería ya encima.
// Por eso el radio visible nunca baja de `velocidad × 1.0 segundos`. El
// escenario se siente asfixiante pero sigue siendo justo, que es la diferencia
// entre tensión y frustración.
// ============================================================================

import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

// Convierte un radio de visión deseado en densidad de niebla exponencial.
const densidadParaRadio = (radio) => 1.8 / Math.max(4, radio);

export class ApagonScene extends BaseScene {
  constructor(escena, config, calidad) {
    super(escena, config, calidad);

    this.oscuridad = config.oscuridad;
    this.tiempoLinterna = 0;      // Segundos restantes de visión ampliada.
    this.densidadActual = densidadParaRadio(this.oscuridad.radioBase);

    this._crearLinternaJugador();
    this._crearParpadeos();
  }

  /**
   * Foco que acompaña al jugador. Es la "linterna" diegética: siempre está,
   * pero se intensifica al recoger un ítem.
   */
  _crearLinternaJugador() {
    // OJO CON LA CAÍDA. Con decay 1.4 y una intensidad de 3, a veinte metros
    // del foco llega el 1.5% de la luz: el haz alumbraba los pies del jugador
    // y nada más, que es por lo que este tramo era literalmente injugable.
    // Con decay ~1 y una intensidad muy superior, el cono llega hasta donde
    // hace falta leer los obstáculos.
    // Y ojo también con la POSICIÓN. Cuanto más cerca del jugador esté el
    // foco, más desigual reparte: quemaba al personaje mientras el obstáculo
    // de más allá seguía a oscuras. Colocándolo alto y atrás, la diferencia de
    // distancia entre uno y otro se reduce y el cono ilumina parejo.
    this.foco = new THREE.SpotLight(0xffe9b0, 150, 140, Math.PI / 4.6, 0.55, 1.0);
    this.foco.position.set(0, 11, 14);
    this.foco.target.position.set(0, 0, -22);
    this.grupo.add(this.foco);
    this.grupo.add(this.foco.target);
  }

  /**
   * Luces piloto que parpadean en la lejanía. Son el único punto de referencia
   * cuando no tienes linterna, y refuerzan la idea de red eléctrica agonizando.
   */
  _crearParpadeos() {
    this.parpadeos = [];

    for (let i = 0; i < 6; i++) {
      const luz = new THREE.PointLight(
        Math.random() > 0.5 ? 0x4fd1ff : 0xff4f6d,
        0,      // Arranca apagada; el ciclo la enciende.
        22,
        2,
      );
      luz.position.set(
        (Math.random() > 0.5 ? 1 : -1) * (7 + Math.random() * 5),
        2 + Math.random() * 6,
        -Math.random() * 130,
      );
      this.grupo.add(luz);

      this.parpadeos.push({
        luz,
        // Cada una con su propio ritmo: un parpadeo sincronizado se lee como bug.
        frecuencia: 0.4 + Math.random() * 2.2,
        fase: Math.random() * Math.PI * 2,
        intensidadMaxima: 1.5 + Math.random() * 2,
      });
    }
  }

  /**
   * @param {number} dt
   * @param {number} avance
   * @param {Player} jugador
   * @param {number} velocidad Velocidad actual, para escalar la visibilidad
   */
  actualizar(dt, avance, jugador, velocidad = 18) {
    super.actualizar(dt, avance, jugador);

    // --- Temporizador de linterna -----------------------------------------
    if (this.tiempoLinterna > 0) this.tiempoLinterna -= dt;

    // --- Radio de visión objetivo -----------------------------------------
    // Suelo de seguridad: nunca menos de 1 segundo de reacción.
    const radioMinimoJusto = velocidad * 1.0;
    const radioBase = Math.max(this.oscuridad.radioBase, radioMinimoJusto);

    const radioObjetivo = this.tiempoLinterna > 0
      ? Math.max(this.oscuridad.radioConLinterna, radioMinimoJusto * 1.8)
      : radioBase;

    // Transición suave: un corte brusco de niebla marea.
    const densidadObjetivo = densidadParaRadio(radioObjetivo);
    const t = 1 - Math.exp(-2.5 * dt);
    this.densidadActual += (densidadObjetivo - this.densidadActual) * t;

    if (this.escena.fog) {
      this.escena.fog.density = this.densidadActual;
    }

    // --- Foco --------------------------------------------------------------
    this.foco.position.x = jugador.x;
    this.foco.target.position.x = jugador.x;
    this.foco.target.updateMatrixWorld();

    const intensidadObjetivo = this.tiempoLinterna > 0 ? 430 : 150;
    this.foco.intensity += (intensidadObjetivo - this.foco.intensity) * t;

    // La linterna también levanta el ambiente. Un cono aislado sobre negro
    // absoluto se lee como un foco de teatro; lo que se busca es que el tramo
    // ENTERO respire mientras dura la batería.
    const ambienteBase = this.config.colores.intensidadAmbiente;
    const ambienteObjetivo = this.tiempoLinterna > 0 ? ambienteBase * 2.6 : ambienteBase;
    this.luzAmbiente.intensity += (ambienteObjetivo - this.luzAmbiente.intensity) * t;

    // Titileo sutil del foco: la batería no está en su mejor momento.
    this.foco.intensity *= 0.98 + Math.sin(this.tiempo * 30) * 0.02;

    // --- Parpadeos ---------------------------------------------------------
    for (const p of this.parpadeos) {
      p.luz.position.z += avance;
      if (p.luz.position.z > 12) {
        p.luz.position.z = -130 - Math.random() * 30;
        p.luz.position.x = (Math.random() > 0.5 ? 1 : -1) * (7 + Math.random() * 5);
      }

      // Onda cuadrada suavizada: parpadeo de fluorescente moribundo.
      const onda = Math.sin(this.tiempo * p.frecuencia * Math.PI * 2 + p.fase);
      p.luz.intensity = onda > 0.3 ? p.intensidadMaxima : 0;
    }
  }

  /** Al recoger una linterna, se amplía la visión durante unos segundos. */
  alRecogerEstamina() {
    this.tiempoLinterna = this.oscuridad.duracionLinterna;
  }

  /** Fracción 0..1 de linterna restante, para pintarlo en el HUD. */
  fraccionLinterna() {
    return Math.max(0, this.tiempoLinterna / this.oscuridad.duracionLinterna);
  }

  factorVisibilidad() {
    return this.tiempoLinterna > 0 ? 1 : 0.45;
  }
}
