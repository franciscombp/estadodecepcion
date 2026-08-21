// ============================================================================
// EL APAGÓN — Crisis energética
// ============================================================================
// MECÁNICA ESPECIAL: la pantalla se oscurece. Solo ves unos metros por delante,
// y el potenciador LINTERNA —el único de esta escena— abre la visión mientras
// dura la pila.
//
// Y cuando se apaga NO te quedas ciego: los papeles de esta escena brillan y
// atraviesan la niebla (ver Coin.aplicarTema), así que la hilera sigue
// dibujando la ruta. Sin eso, quedarse sin luz sería quedarse a merced del
// primer obstáculo, y perder por no haber encontrado un ítem es perder por
// mala suerte, no por mal juego.
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

// Dónde va la linterna respecto al jugador. Z negativa es POR DELANTE: el
// personaje corre hacia -Z, así que la lente le va abriendo camino.
const ALTURA_LINTERNA = 1.35;
const Z_LINTERNA = -1.1;

export class ApagonScene extends BaseScene {
  constructor(escena, config, calidad) {
    super(escena, config, calidad);

    this.oscuridad = config.oscuridad;
    this.tiempoLinterna = 0;      // Segundos restantes de visión ampliada.
    this.densidadActual = densidadParaRadio(this.oscuridad.radioBase);

    // La oscuridad es la mecánica del tramo: BaseScene no toca ni la niebla
    // ni las luces de aquí. El despeje del cruce se aplica abajo, integrado
    // con el cálculo del radio de visión.
    this.luzPropia = true;

    this._crearLinternaJugador();
    this._crearParpadeos();
  }

  /**
   * La linterna del jugador. Va DELANTE de él y apunta hacia donde corre.
   *
   * Estaba montada arriba y atrás, que repartía la luz muy pareja pero se leía
   * como un foco de estadio: alumbraba la escena entera desde ninguna parte.
   * Una linterna se sostiene y apunta, y eso significa dos cosas:
   *
   *   · El origen va por delante del personaje, a la altura de la mano.
   *   · Hay un HAZ VISIBLE. Sin el cono dibujado, la luz es una propiedad del
   *     escenario; con él, es un objeto que el jugador lleva encima —y en un
   *     tramo cuya mecánica entera es la luz, eso no es decoración.
   *
   * OJO CON LA CAÍDA: con decay 1.4 y una intensidad de 3, a veinte metros del
   * foco llega el 1.5% de la luz. El haz alumbraba los pies y nada más, que es
   * por lo que este tramo era injugable. Decay ~1 e intensidad alta.
   */
  _crearLinternaJugador() {
    this.foco = new THREE.SpotLight(0xffe9b0, 150, 140, Math.PI / 5.2, 0.5, 1.0);
    this.foco.position.set(0, ALTURA_LINTERNA, Z_LINTERNA);
    this.foco.target.position.set(0, 0, -34);
    this.grupo.add(this.foco);
    this.grupo.add(this.foco.target);

    // El haz dibujado. Es un cono abierto por la base, sin escribir en el
    // buffer de profundidad para que no recorte lo que hay dentro.
    // ESTRECHO Y CORTO. Un cono ancho, visto desde detrás de su vértice, se
    // mira a lo largo y tapa media pantalla: deja de ser un haz y pasa a ser
    // una mancha. Y CON NIEBLA, para que se apague con la distancia en vez de
    // llegar igual de sólido hasta el final —que es lo que lo delataba como
    // geometría en vez de luz.
    const largo = 18;
    this.haz = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, largo, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe9b0,
        transparent: true,
        opacity: 0.035,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    // El cono nace apuntando a +Y; se tumba para que salga hacia -Z, o sea
    // hacia donde se corre.
    this.haz.rotation.x = -Math.PI / 2;
    this.haz.position.set(0, ALTURA_LINTERNA, Z_LINTERNA - largo / 2);
    this.grupo.add(this.haz);

    // Y la lente, para que el haz salga de algo y no del aire.
    this.lente = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff4d0, toneMapped: false, fog: false }),
    );
    this.lente.position.set(0, ALTURA_LINTERNA, Z_LINTERNA);
    this.grupo.add(this.lente);
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

    let radioObjetivo = this.tiempoLinterna > 0
      ? Math.max(this.oscuridad.radioConLinterna, radioMinimoJusto * 1.8)
      : radioBase;

    // DESPEJE ANTE LA ASAMBLEA. Delante del edificio del cruce el barrio
    // recupera la corriente: el radio de visión se abre hasta ver la fachada
    // entera. Sin esto, la decisión de por qué lado entrar se tomaba a
    // dieciocho metros de visibilidad, es decir, a ciegas.
    radioObjetivo += (160 - radioObjetivo) * this.despeje;

    // Transición suave: un corte brusco de niebla marea.
    const densidadObjetivo = densidadParaRadio(radioObjetivo);
    const t = 1 - Math.exp(-2.5 * dt);
    this.densidadActual += (densidadObjetivo - this.densidadActual) * t;

    if (this.escena.fog) {
      this.escena.fog.density = this.densidadActual;
    }

    // --- Foco --------------------------------------------------------------
    // Todo el conjunto acompaña al jugador de lado: la lente, el haz y el
    // punto al que apunta. Si solo se moviera el foco, el cono dibujado se
    // quedaría en el centro y se vería que son dos cosas distintas.
    this.foco.position.x = jugador.x;
    this.foco.position.y = ALTURA_LINTERNA + jugador.y;
    this.foco.target.position.x = jugador.x;
    this.foco.target.updateMatrixWorld();

    this.haz.position.x = jugador.x;
    this.haz.position.y = ALTURA_LINTERNA + jugador.y;
    this.lente.position.x = jugador.x;
    this.lente.position.y = ALTURA_LINTERNA + jugador.y;

    const intensidadObjetivo = this.tiempoLinterna > 0 ? 430 : 150;
    this.foco.intensity += (intensidadObjetivo - this.foco.intensity) * t;

    // La linterna también levanta el ambiente. Un cono aislado sobre negro
    // absoluto se lee como un foco de teatro; lo que se busca es que el tramo
    // ENTERO respire mientras dura la batería.
    const ambienteBase = this.config.colores.intensidadAmbiente;
    let ambienteObjetivo = this.tiempoLinterna > 0 ? ambienteBase * 2.6 : ambienteBase;

    // Con el despeje del cruce la calle entera se enciende hacia una luz de
    // día: es un max entre objetivos —linterna y despeje piden lo mismo, más
    // luz— y el despeje ya viene suavizado de BaseScene, así que cielo y
    // direccional pueden ir asignados directos sin dar cortes.
    const dd = this.despeje;
    ambienteObjetivo = Math.max(ambienteObjetivo, ambienteBase + (0.85 - ambienteBase) * dd);
    this.luzCielo.intensity = this.intensidadBase.cielo
      + (1.05 - this.intensidadBase.cielo) * dd;
    this.luzDireccional.intensity = this.intensidadBase.direccional
      + (0.95 - this.intensidadBase.direccional) * dd;

    this.luzAmbiente.intensity += (ambienteObjetivo - this.luzAmbiente.intensity) * t;

    // Titileo sutil: la batería no está en su mejor momento. El haz y la lente
    // titilan con el foco, porque si la luz parpadea y el cono no, el cono
    // deja de leerse como la misma linterna.
    const titileo = 0.98 + Math.sin(this.tiempo * 30) * 0.02;
    this.foco.intensity *= titileo;

    // EL HAZ Y LA LENTE ENTRAN CON EL BARRIO, NO ANTES.
    //
    // El cono dibujado y el punto de la lente son geometría haciéndose pasar
    // por luz, y eso sólo cuela con oscuridad alrededor: durante los dos
    // segundos que tarda la Bahía en irse, un cono aditivo a plena luz de
    // mediodía se lee como un cono de plástico pegado delante del personaje.
    // Se multiplica el OBJETIVO y no el resultado, que es lo que evita que la
    // exponencial se realimente; el retraso de τ=0,4 s que eso deja es además
    // el correcto: la linterna sube un poco por detrás de la oscuridad.
    //
    // El foco en sí NO se toca: es luz de verdad, y sobre un cuadro todavía
    // claro no se nota (medido: el cuadro del primer fotograma del Apagón con
    // la luz de la Bahía puesta sale a 0,340, por debajo de los 0,52 de la
    // Bahía sola, así que no quema nada). Que ya esté encendida es además lo
    // que se quiere contar: se va la luz y tú ya la tienes en la mano.
    const conLinterna = this.tiempoLinterna > 0;
    this.haz.material.opacity += ((conLinterna ? 0.06 : 0.03) * titileo * this.entrada
      - this.haz.material.opacity) * t;
    this.lente.scale.setScalar((conLinterna ? 1.5 : 1) * titileo * this.entrada);

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

  /**
   * Enciende la linterna. La llama el potenciador del mismo nombre, que es el
   * único de esta escena y el único que la enciende.
   * @param {number} [segundos]
   */
  encenderLinterna(segundos) {
    this.tiempoLinterna = segundos ?? this.oscuridad.duracionLinterna;
  }

  /** Fracción 0..1 de linterna restante, para pintarlo en el HUD. */
  fraccionLinterna() {
    return Math.max(0, this.tiempoLinterna / this.oscuridad.duracionLinterna);
  }

  factorVisibilidad() {
    return this.tiempoLinterna > 0 ? 1 : 0.45;
  }
}
