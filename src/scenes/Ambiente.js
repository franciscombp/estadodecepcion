// ============================================================================
// TRANSICIÓN DE AMBIENTE — la luz no salta de un barrio al otro, viaja
// ============================================================================
// AL CRUZAR UNA ESQUINA SE APAGABA UN MUNDO Y SE ENCENDÍA OTRO EN EL MISMO
// FOTOGRAMA.
//
// Medido en el navegador (cruce Bahía → Apagón, brillo medio del cuadro leído
// del búfer de pantalla): 0,526 → 0,094 de un fotograma al siguiente. El 82 %
// de la luz en dieciséis milisegundos. Al revés era peor, porque subir de golpe
// deslumbra: 0,118 → 0,550, casi cinco veces.
//
// Eso no es un apagón, es un corte de montaje. Un apagón se ve venir: la luz
// baja, el color se va del cielo, la calle se acorta y entonces enciendes la
// linterna. Esto es exactamente eso —una sola cuenta atrás durante la cual todo
// lo que es AMBIENTE (los colores y las intensidades de las cinco luces, la
// niebla, el fondo y el cielo que se refleja en las cosas) viaja del estado que
// tenía el barrio viejo AL SALIR hasta el que pide el nuevo.
//
// Lo que NO viaja es el contenido: la calle, los obstáculos y el decorado se
// cambian de golpe, como siempre. Y está bien que así sea: con la transición
// puesta, cruzar al Apagón mueve el cuadro −0,171 en el fotograma del cruce, y
// cruzar a las Elecciones —dos barrios igual de claros— mueve −0,169. El mismo
// número. Lo que queda de salto ya no es la luz, es que has doblado la esquina.
//
// ---------------------------------------------------------------------------
// POR QUÉ CORRE DESPUÉS DEL BARRIO Y NO EN SU LUGAR
// ---------------------------------------------------------------------------
// El barrio nuevo sigue calculando lo suyo con normalidad: BaseScene sube la
// luz con el despeje del cruce, el Apagón mueve el radio de visión con la
// linterna y con la velocidad. Esto corre DESPUÉS, en el mismo fotograma, y
// tira de esos valores hacia los del barrio viejo con un peso que va de 1 a 0.
// Así no hay que duplicar ni una línea de la lógica de ninguna escena.
//
// De ahí salen dos reglas que hay que respetar al tocar esto:
//
//   · LAS INTENSIDADES Y LA DENSIDAD DE NIEBLA se leen del propio objeto,
//     porque la escena las reescribe ENTERAS cada fotograma —son asignaciones,
//     no acumulaciones— así que lo que hay al llegar aquí es el objetivo de
//     este fotograma. La única excepción es la ambiental del Apagón, que se
//     relaja sobre sí misma: leerla realimenta la mezcla, pero la realimenta
//     hacia el mismo destino (queda una combinación convexa de tres valores que
//     convergen), así que amortigua un poco y no rompe nada.
//   · LOS COLORES NO se leen del objeto. Nadie los reescribe por fotograma, así
//     que leerlos sería leer la mezcla del fotograma anterior: el color se
//     quedaría clavado a medio camino para siempre. El destino sale de la
//     paleta del barrio, que es fija.
// ============================================================================

import * as THREE from 'three';
import { cieloEntre } from '../utils/entorno.js';

/**
 * CUÁNTO DURA EL VIAJE, en segundos.
 *
 * Tiene que durar MÁS que la esquina, no lo mismo. El mundo termina de girar a
 * FIN_GIRO_MUNDO × DURACION_VIRAJE_LATERAL = 0,62 × 1,2 = 0,744 s, y el viraje
 * entero acaba a 1,2 s. Si el fundido terminara con él, todo el cambio de luz
 * caería dentro del giro —con el destello (40-58 % del viraje) y el polvo por
 * encima— y se leería como parte del corte, que es justo lo que se venía a
 * quitar. A dos segundos, el último 40 % del fundido se corre ya con la calle
 * de frente y a la vista: eso es lo que separa «se está yendo la luz» de «la
 * esquina estaba oscura».
 *
 * Por arriba manda el juego: dos segundos son unos 48 metros a velocidad de
 * crucero, o sea dos grupos de obstáculos de los 850 metros que mide un tramo.
 * Estirarlo a tres y el barrio nuevo tarda en ser el barrio nuevo.
 *
 * Del trámite se sale sin esquina (no hay giro de mundo por el centro), así que
 * allí los dos segundos van enteros en recta, con el fogonazo del portazo
 * tapando los primeros 0,55.
 */
export const DURACION = 2.0;

/**
 * Cuánto cielo recoge la escena cuando el barrio no pide otra cosa.
 *
 * El cielo procedural es más brillante de lo que parece —es un degradado a
 * pantalla completa— y al uno lavaba la escena entera. Cada barrio puede pedir
 * el suyo con `brilloEntorno`: el Apagón es de noche y debería reflejar casi
 * nada. Medido en la Bahía, este mando vale 0,077 de brillo medio del cuadro
 * entre 0 y 0,3, y 0,23 entre 0 y 1,2.
 */
export const ENTORNO_BASE = 0.3;

export class TransicionDeAmbiente {
  /**
   * @param {THREE.Scene} escenaThree
   * @param {THREE.WebGLRenderer} renderizador
   * @param {object} calidad Nivel gráfico (config/estilo.js)
   */
  constructor(escenaThree, renderizador, calidad) {
    this.escena = escenaThree;
    this.renderizador = renderizador;
    this.pasosCielo = calidad?.pasosCieloTransito ?? 0;
    this.viaje = null;
  }

  /** ¿Hay un cruce de ambiente en curso? Para depurar y para las pruebas. */
  get activa() {
    return this.viaje !== null;
  }

  /** 0 recién cruzado, 1 con el barrio nuevo ya puesto del todo. */
  get progreso() {
    return this.viaje ? this.viaje.t / DURACION : 1;
  }

  /**
   * Arranca el viaje.
   *
   * @param {?object} retrato  Lo que había en pantalla (BaseScene.retrato()),
   *                           tomado ANTES de suspender el barrio viejo. Si es
   *                           null se planta el nuevo tal cual: es el CASO BASE
   *                           —primera partida, arranque en frío, o volver al
   *                           mismo barrio desde la portada—. No hay de dónde
   *                           venir, y fundir desde la nada sería fundir desde
   *                           negro, que es otro efecto.
   * @param {BaseScene} escena El barrio nuevo, ya colgado
   * @param {THREE.Texture} mapaDestino Su cielo prefiltrado
   */
  arrancar(retrato, escena, mapaDestino) {
    if (!retrato) {
      this.viaje = null;
      escena.restablecerPaleta();
      this._plantar(escena, mapaDestino);
      return;
    }

    const c = escena.colores;
    this.viaje = {
      t: 0,
      origen: retrato,
      escena,
      mapaDestino,
      coloresDestino: c,
      paso: 0,
      color: {
        ambiente: new THREE.Color(c.luzAmbiente),
        cielo: new THREE.Color(c.luzCielo ?? c.nieblaLejos),
        suelo: new THREE.Color(c.rebote ?? c.luzAmbiente),
        direccional: new THREE.Color(c.luzDireccional),
        relleno: new THREE.Color(c.acento),
        niebla: new THREE.Color(c.nieblaLejos),
      },
      entorno: c.brilloEntorno ?? ENTORNO_BASE,
    };

    // El cielo del barrio VIEJO se queda puesto de momento. El fotograma del
    // cruce ya es el más caro que hay —se cambia el tema de la pista entera y
    // se precarga el primer grupo— y no hay por qué meterle además un
    // prefiltrado: el primero cae un paso más adelante.
    if (retrato.mapaEntorno) this.escena.environment = retrato.mapaEntorno;

    // Y se escribe el fotograma cero AHORA, antes de que nadie pinte: si no,
    // el cruce se vería un fotograma con la luz del barrio nuevo, que es
    // exactamente el corte que se venía a quitar.
    this.actualizar(0);
  }

  /**
   * Un fotograma de viaje. Va después de escenario.actualizar() y antes de
   * pintar. Ver la cabecera: lee las intensidades y escribe los colores.
   *
   * @param {number} dt
   */
  actualizar(dt) {
    const v = this.viaje;
    if (!v) return;

    v.t = Math.min(DURACION, v.t + dt);
    const p = v.t / DURACION;
    // Suavizado clásico: derivada nula en los dos extremos, que es lo que hace
    // que ni el arranque ni la llegada se noten como un cambio de régimen.
    const s = p * p * (3 - 2 * p);

    const e = this.escena;
    const esc = v.escena;
    const o = v.origen;

    // --- Colores: de la foto del barrio viejo a la paleta del nuevo ---------
    esc.luzAmbiente.color.lerpColors(o.color.ambiente, v.color.ambiente, s);
    esc.luzCielo.color.lerpColors(o.color.cielo, v.color.cielo, s);
    esc.luzCielo.groundColor.lerpColors(o.color.suelo, v.color.suelo, s);
    esc.luzDireccional.color.lerpColors(o.color.direccional, v.color.direccional, s);
    esc.luzRelleno.color.lerpColors(o.color.relleno, v.color.relleno, s);

    // --- Intensidades: lo que el barrio nuevo acaba de pedir, frenado -------
    esc.luzAmbiente.intensity = o.intensidad.ambiente
      + (esc.luzAmbiente.intensity - o.intensidad.ambiente) * s;
    esc.luzCielo.intensity = o.intensidad.cielo
      + (esc.luzCielo.intensity - o.intensidad.cielo) * s;
    esc.luzDireccional.intensity = o.intensidad.direccional
      + (esc.luzDireccional.intensity - o.intensidad.direccional) * s;

    // --- Niebla -------------------------------------------------------------
    if (e.fog) {
      e.fog.color.lerpColors(o.color.niebla, v.color.niebla, s);
      // EN LOGARITMO, NO EN LÍNEA RECTA. FogExp2 calcula 1 − exp(−(d·z)²), así
      // que lo que se ve es una distancia proporcional a 1/d: pasos iguales en
      // log(d) son pasos iguales en «hasta dónde llego a ver», que es lo que
      // lee el ojo. De 0,005 a 0,0346 el punto medio geométrico es 0,0132
      // —unos 76 m de alcance—; el lineal sería 0,0198, o sea 50 m: la vista
      // se cerraría casi entera en la primera mitad y la segunda no haría nada.
      const desde = Math.max(1e-4, o.niebla);
      const hasta = Math.max(1e-4, e.fog.density);
      e.fog.density = desde * ((hasta / desde) ** s);
    }
    if (e.background?.isColor) e.background.lerpColors(o.color.fondo, v.color.niebla, s);

    e.environmentIntensity = o.entorno + (v.entorno - o.entorno) * s;

    // Lo que no es luz de escena sino objeto que emite. Ver BaseScene.entrada.
    esc.entrada = s;

    // --- El cielo, a pasos --------------------------------------------------
    // El mapa de entorno no se puede mezclar en el sombreador; hay que volver a
    // prefiltrarlo, y eso cuesta 1,2-3,5 ms. Ver estilo.js/pasosCieloTransito
    // para de dónde sale el número de pasos.
    if (this.pasosCielo > 0) {
      const paso = Math.floor(s * this.pasosCielo);
      if (paso !== v.paso) {
        v.paso = paso;
        e.environment = paso >= this.pasosCielo
          ? v.mapaDestino
          : cieloEntre(
            this.renderizador, o.colores, v.coloresDestino, paso / this.pasosCielo,
          );
      }
    }

    if (p >= 1) this.asentar();
  }

  /**
   * Planta el barrio nuevo tal cual y da el viaje por terminado.
   *
   * Lo llama el propio fundido al llegar, y el juego ante cualquier corte —una
   * vuelta a la portada— para no dejar a nadie con la paleta a medias.
   */
  asentar() {
    const v = this.viaje;
    if (!v) return;
    this.viaje = null;
    v.escena.restablecerPaleta();
    this._plantar(v.escena, v.mapaDestino);
  }

  _plantar(escena, mapa) {
    this.escena.environment = mapa;
    this.escena.environmentIntensity = escena.colores.brilloEntorno ?? ENTORNO_BASE;
  }
}
