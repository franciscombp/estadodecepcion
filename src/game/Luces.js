// ============================================================================
// EL APAREJO DE LUCES — un presupuesto fijo, que es lo que evita los tirones
// ============================================================================
//
// AQUÍ ESTABA EL CONGELÓN QUE QUEDABA, y no se parecía en nada a un problema de
// luces.
//
// El número de luces de cada tipo entra en las MACROS del sombreador
// (`NUM_POINT_LIGHTS`, `NUM_SPOT_LIGHTS`). O sea que no es un uniforme que se
// cambia y ya: es parte de la firma con la que Three decide si un material
// necesita un programa nuevo. Cambiar el recuento OBLIGA A RECOMPILAR TODOS LOS
// MATERIALES DE LA ESCENA, y compilar GLSL es síncrono: bloquea el hilo.
//
// Y el juego cambiaba el recuento constantemente, porque varias piezas traían su
// propia luz colgada:
//
//   · la prueba nominal (una PointLight por pieza),
//   · el potenciador (otra),
//   · la insignia del trámite (otra),
//   · las seis luces piloto del Apagón,
//   · el foco de la linterna y los del centro histórico.
//
// Medido con el juego corriendo, contando programas del renderizador:
//
//     dos luces puntuales (lo normal)          92 programas
//     aparece una prueba  → tres               96      (+4 recompilados)
//     aparece un potenciador → cuatro         107      (+11)
//     desaparecen las dos → dos               107      (volver es gratis)
//
// Volver a un recuento ya visto es gratis —el programa está en la caché— pero
// llegar a uno NUEVO recompila. Y como las pruebas salen en el 18 % de los
// grupos y los potenciadores cada 320 m, eso pasaba una y otra vez durante la
// partida. Eso es lo que el jugador cuenta como «se congela en ciertos
// momentos»: no tiene relación con lo que está pasando en pantalla porque la
// causa no está en pantalla, está en el compilador.
//
// LA SOLUCIÓN ES LA DE SIEMPRE EN ESTE OFICIO: presupuesto fijo. Se crean todas
// las luces al arrancar, se cuelgan de la ESCENA —no del barrio, que va y
// viene— y no se añade ni se quita ninguna nunca más. Lo que hacen las piezas
// es PEDIR una: se le mueve la posición, se le pone color e intensidad, y al
// soltarla se le baja la intensidad a cero. El recuento no se mueve, así que no
// se recompila nada.
//
// CUÁNTAS. Cinco puntuales y un foco:
//
//   0  el relleno del barrio, que sigue al jugador (siempre encendida)
//   1  la prueba nominal más cercana
//   2  el potenciador vivo (nunca hay más de uno: salen cada 320 m)
//   3  la primera farola del pasillo del trámite
//   4  suelta: la segunda farola del trámite, o la luz piloto del Apagón
//
// Y DOS FOCOS, que es lo que pide el barrio que más usa: la linterna del Apagón
// gasta uno y los dos de vigilancia del centro histórico gastan los dos. En los
// demás barrios están, apagados, sin costar un solo tirón.
//
// Cinco y no ocho porque cada puntual se evalúa por fragmento en TODOS los
// materiales: el presupuesto fijo arregla los tirones, pero no es gratis en el
// pintado, y ocho ya se nota en un móvil de gama media. El Apagón pasa de seis
// luces piloto a una que va rotando entre sus posiciones; a la velocidad a la
// que se corre, se lee igual.
// ============================================================================

import * as THREE from 'three';

/** Cuántas luces hay SIEMPRE. Cambiar esto cambia todos los sombreadores. */
export const PUNTUALES = 5;
export const FOCOS = 2;

/** Los huecos con dueño. El 4 queda suelto. */
export const HUECO = {
  RELLENO: 0,
  PRUEBA: 1,
  POTENCIADOR: 2,
  TRAMITE: 3,
  LIBRE: 4,
};

export class RigDeLuces {
  /**
   * @param {THREE.Scene} escena La escena del juego. Las luces se cuelgan de
   *   ella y NO del grupo del barrio: el grupo se descuelga al cambiar de
   *   barrio, y eso movería el recuento, que es justo lo que hay que evitar.
   */
  constructor(escena) {
    this.escena = escena;

    this.puntuales = [];
    for (let i = 0; i < PUNTUALES; i++) {
      // Intensidad cero, pero PRESENTE. Una luz apagada sigue contando para las
      // macros, que es exactamente lo que se quiere: el recuento no se mueve.
      const luz = new THREE.PointLight(0xffffff, 0, 20, 2);
      luz.position.set(0, 5, -6);
      escena.add(luz);
      this.puntuales.push(luz);
    }

    this.focos = [];
    for (let i = 0; i < FOCOS; i++) {
      const foco = new THREE.SpotLight(0xffffff, 0, 140, Math.PI / 5.2, 0.5, 1.0);
      foco.position.set(0, 6, 2);
      // El objetivo también va colgado de la escena: un SpotLight apunta a su
      // `target`, y si el target no está en el grafo su matriz no se actualiza
      // y el foco apunta al origen pase lo que pase.
      escena.add(foco.target);
      escena.add(foco);
      this.focos.push(foco);
    }
  }

  /** El relleno del barrio: la única que está siempre encendida. */
  get relleno() { return this.puntuales[HUECO.RELLENO]; }

  /** El primer foco: la linterna del Apagón, o la vigilancia del centro. */
  get foco() { return this.focos[0]; }
  /** El segundo, que sólo usa la vigilancia del centro histórico. */
  get foco2() { return this.focos[1]; }

  /**
   * Enciende una luz de las que van y vienen.
   *
   * @param {number} hueco   Cuál, de HUECO
   * @param {THREE.Vector3|{x:number,y:number,z:number}} donde
   * @param {number} color
   * @param {number} intensidad
   * @param {number} alcance
   */
  encender(hueco, donde, color, intensidad, alcance) {
    const luz = this.puntuales[hueco];
    if (!luz) return;
    luz.position.set(donde.x, donde.y, donde.z);
    luz.color.setHex(color);
    luz.intensity = intensidad;
    luz.distance = alcance;
  }

  /** La apaga sin quitarla: bajar la intensidad no toca el recuento. */
  apagar(hueco) {
    const luz = this.puntuales[hueco];
    if (luz) luz.intensity = 0;
  }

  /** Todo a cero menos el relleno. Al reiniciar o al volver al menú. */
  reiniciar() {
    for (let i = 1; i < this.puntuales.length; i++) this.puntuales[i].intensity = 0;
    for (const f of this.focos) f.intensity = 0;
  }
}
