// ============================================================================
// PARTÍCULAS — Los estallidos, la estela y el color de la racha
// ============================================================================
// Un solo `THREE.Points` con un pozo fijo de partículas. UNO, no uno por
// efecto: cada malla añadida a la escena es una llamada de dibujo más, y esto
// dispara varias veces por segundo. Con un pozo compartido, todos los efectos
// del juego —recoger un papel, encadenar una racha, el chorro del vuelo, el
// fogonazo de un potenciador— cuestan exactamente una llamada de dibujo.
//
// POR QUÉ UN SHADER Y NO `PointsMaterial`
// `PointsMaterial` tiene UN tamaño para todos los puntos, y aquí cada partícula
// tiene que nacer grande y morir pequeña. Con un atributo `size` y ocho líneas
// de GLSL se resuelve; la alternativa era un pozo por tamaño, que es peor por
// todos lados.
//
// MEZCLA NORMAL, NO ADITIVA, y esto costó una tarde. En aditivo las chispas
// brillan preciosas sobre el asfalto del Apagón y son LITERALMENTE INVISIBLES
// en la Bahía: sumar luz a un fondo que ya está casi en blanco no cambia el
// píxel. Como tres de los cuatro escenarios van de día, el aditivo servía para
// uno de cada cuatro partidas.
//
// El brillo lo pone el bloom, que ya está en el compositor: cualquier color por
// encima del umbral (0.62) florece solo. Así las chispas se ven sobre el
// asfalto claro Y brillan en el apagón, que es lo que hacía falta. El
// desvanecido va por alfa, en su propio atributo, para que el COLOR se quede
// arriba del umbral hasta el final y no deje de florecer a mitad de vida.
//
// SE MUEVEN CON EL MUNDO. Aquí el jugador no avanza: el mundo viene hacia él.
// Cada fotograma se les suma `avance` en Z, igual que a los obstáculos, o el
// polvo de las pisadas se quedaría flotando en el sitio mientras la calle pasa
// por debajo.
// ============================================================================

import * as THREE from 'three';

const VERTICE = /* glsl */`
  attribute float size;
  attribute float alfa;
  varying vec3 vColor;
  varying float vAlfa;
  uniform float alturaCanvas;

  void main() {
    vColor = color;
    vAlfa = alfa;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);

    // GUARDA DE PROFUNDIDAD, y no es una optimización: es lo que impide que el
    // efecto reviente. Un punto que queda DETRÁS de la cámara proyecta a
    // coordenadas sin sentido, y como el tamaño se divide por la distancia, ahí
    // se dispara a miles de píxeles: en pantalla salían cuadrados blancos
    // enormes flotando en mitad de la calle. Con la cámara casi encima del
    // jugador y las chispas viajando hacia atrás, esto pasa CADA VEZ.
    float prof = -mv.z;
    if (prof < 0.6) {
      gl_PointSize = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // fuera del volumen de vista
      return;
    }

    // El tamaño va en unidades de mundo y el shader lo pasa a píxeles con la
    // altura del lienzo. Con una constante fija, la misma partícula salía el
    // doble de grande en una pantalla el doble de alta. El tope de 160 px es
    // el cinturón de seguridad de la guarda de arriba.
    gl_PointSize = min(160.0, size * (alturaCanvas / prof));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENTO = /* glsl */`
  varying vec3 vColor;
  varying float vAlfa;

  void main() {
    // Disco con borde suave. Sin esto son cuadraditos, y un cuadrado se lee
    // como un fallo de render, no como una chispa.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float a = (1.0 - smoothstep(0.02, 0.25, r2)) * vAlfa;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

export class Particulas {
  /**
   * @param {THREE.Scene} escena
   * @param {number} pozo Cuántas partículas vivas caben a la vez. 0 = apagado.
   */
  constructor(escena, pozo = 320) {
    this.escena = escena;
    this.pozo = Math.max(0, pozo);
    this.activo = this.pozo > 0;
    this.cursor = 0;

    // Z a partir de la cual una chispa ya no sirve para nada: el mundo la
    // arrastra hacia atrás y en cuanto pasa de la cámara —que va en 7.4— deja
    // de verse. Se apagan ahí en vez de esperar a que se les acabe la vida, y
    // así el pozo se recicla mucho antes: en carrera, la mayoría de partículas
    // muere por este límite y no por vieja.
    this.zLimite = 6.6;

    if (!this.activo) return;

    const n = this.pozo;
    this.posiciones = new Float32Array(n * 3);
    this.colores = new Float32Array(n * 3);
    this.tamanos = new Float32Array(n);
    this.alfas = new Float32Array(n);

    // Estado que no viaja a la GPU. Se queda en arrays planos y no en objetos
    // porque esto se recorre entero sesenta veces por segundo.
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.vida = new Float32Array(n);
    this.vidaMax = new Float32Array(n);
    this.tamBase = new Float32Array(n);
    this.gravedad = new Float32Array(n);
    this.roce = new Float32Array(n);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posiciones, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colores, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.tamanos, 1));
    geo.setAttribute('alfa', new THREE.BufferAttribute(this.alfas, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: { alturaCanvas: { value: 700 } },
      vertexShader: VERTICE,
      fragmentShader: FRAGMENTO,
      vertexColors: true,
      transparent: true,
      // Sin escritura de profundidad: son cientos de discos transparentes y
      // ordenarlos entre sí no compensa. Sí LEEN el búfer, así que una chispa
      // detrás de un obstáculo queda tapada, que es lo que hay que conservar.
      depthWrite: false,
    });

    this.puntos = new THREE.Points(geo, this.material);
    // Las posiciones se escriben a mano y la caja envolvente nunca se
    // recalcula: con el descarte por frustum puesto, el sistema entero
    // desaparecía en cuanto la caja original quedaba fuera de cámara.
    this.puntos.frustumCulled = false;
    this.puntos.renderOrder = 5;
    escena.add(this.puntos);

    this._color = new THREE.Color();
  }

  /** El shader necesita saber cuántos píxeles de alto tiene el lienzo. */
  redimensionar(alturaPixeles) {
    if (this.activo) this.material.uniforms.alturaCanvas.value = alturaPixeles * 0.5;
  }

  /**
   * Enciende una partícula del pozo.
   *
   * Cuando el pozo se llena se pisa la más vieja en vez de descartar la nueva.
   * Es deliberado: lo que acaba de pasar importa más que lo que está a punto de
   * apagarse, y así un estallido grande nunca sale a medias.
   */
  _encender(x, y, z, vx, vy, vz, color, tam, vida, gravedad, roce) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.pozo;

    const i3 = i * 3;
    this.posiciones[i3] = x;
    this.posiciones[i3 + 1] = y;
    this.posiciones[i3 + 2] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;

    this._color.set(color);
    this.colores[i3] = this._color.r;
    this.colores[i3 + 1] = this._color.g;
    this.colores[i3 + 2] = this._color.b;

    this.tamBase[i] = tam;
    this.tamanos[i] = tam;
    this.alfas[i] = 1;
    this.vida[i] = vida;
    this.vidaMax[i] = vida;
    this.gravedad[i] = gravedad;
    this.roce[i] = roce;
  }

  /**
   * ESTALLIDO: un puñado de chispas saliendo en todas direcciones.
   *
   * Es el efecto de recoger algo. La dispersión va en esfera y no en cono
   * porque el papel se recoge de frente y de lado indistintamente, y un cono
   * apuntando siempre al mismo sitio delata que el efecto es un adorno pegado
   * encima en vez de algo que sale del objeto.
   *
   * …SALVO CUANDO SÍ SALE SIEMPRE DEL MISMO SITIO. El estallido de recoger no
   * sale del papel: sale de la mano del personaje, que está siempre en el
   * mismo punto de la pantalla. Ahí la esfera es un problema y no una virtud,
   * porque la mitad de las chispas nacen HACIA DENTRO del cuerpo y el búfer de
   * profundidad se las come: se pierde la mitad del efecto y lo que queda se
   * lee como un aura alrededor, no como algo que se acaba de atrapar.
   *
   * `sesgo` es un vector que se suma a la dirección al azar antes de
   * normalizar. Con módulo 0 no cambia nada —la esfera de siempre— y con
   * módulo 1 el reparto se abre en un cono de unos noventa grados hacia donde
   * apunte. No es un cono clavado: sigue habiendo dispersión completa, solo
   * que empujada.
   */
  estallido(x, y, z, {
    color = 0xffcf3f, cantidad = 14, fuerza = 3.4, tam = 0.30,
    vida = 0.5, gravedad = 5.5, roce = 2.2, subida = 1.2, sesgo = null,
  } = {}) {
    if (!this.activo) return;

    for (let i = 0; i < cantidad; i++) {
      // Dirección al azar sobre la esfera, sesgada hacia arriba: la gravedad
      // se las lleva enseguida, y sin ese sesgo la mitad del estallido se pasa
      // la vida entera enterrada en el asfalto.
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const s = fuerza * (0.45 + Math.random() * 0.55);
      const jitter = 0.6 + Math.random() * 0.8;

      let dx = Math.sin(b) * Math.cos(a);
      let dy = Math.cos(b);
      let dz = Math.sin(b) * Math.sin(a);
      if (sesgo) {
        dx += sesgo.x ?? 0;
        dy += sesgo.y ?? 0;
        dz += sesgo.z ?? 0;
        const m = Math.hypot(dx, dy, dz) || 1;
        dx /= m; dy /= m; dz /= m;
      }

      this._encender(
        x, y, z,
        dx * s,
        dy * s + subida,
        dz * s,
        color,
        tam * jitter,
        vida * (0.7 + Math.random() * 0.6),
        gravedad, roce,
      );
    }
  }

  /**
   * FOGONAZO: el golpe de luz del instante en que algo se atrapa.
   *
   * Son tres o cuatro chispas GRANDES, casi quietas y que duran un suspiro.
   * No es decoración del estallido: es la parte que dice CUÁNDO. El estallido
   * tarda medio segundo en desplegarse, y en medio segundo a veinte metros por
   * segundo el jugador ha recorrido diez metros; sin un pico de luz en el
   * primer fotograma, el efecto empieza a leerse cuando la acción ya pasó.
   *
   * ESTE NO VIAJA CON EL MUNDO, y es la única excepción de la clase. Todo lo
   * demás sí —el polvo de las pisadas se quedaría flotando mientras la calle
   * pasa por debajo— pero el polvo pertenece a la CALLE y este fogonazo
   * pertenece al PERSONAJE: marca el instante en que su mano se cierra, y una
   * mano no se queda atrás.
   *
   * No es un capricho de encuadre, es aritmética. A 32 m/s —la velocidad
   * máxima— una chispa suelta en el punto de atrape recorre cinco metros en
   * 0,16 s, y el punto de atrape está a 5,47 m de la cámara: o sea que le
   * pasaría por dentro. El shader tiene su guarda (por debajo de 0,6 m no
   * dibuja) y su tope de 160 px, así que no reventaría, pero lo que se vería
   * sería un disco blanco creciendo hasta comerse un quinto de la pantalla
   * justo cuando el fogonazo debería estar apagándose.
   *
   * Se ancla pasándole `arrastre`: la velocidad del mundo, en metros por
   * segundo, que se le resta a la componente Z. Como `actualizar()` le suma
   * `avance` —que es esa misma velocidad por dt— las dos se cancelan EXACTAS y
   * la chispa se queda donde nació. Por eso el roce va a cero: con roce, la
   * resta se iría apagando y la chispa empezaría a derivar a media vida.
   */
  fogonazo(x, y, z, {
    color = 0xffffff, cantidad = 4, tam = 0.9, vida = 0.16, dispersion = 0.14,
    arrastre = 0,
  } = {}) {
    if (!this.activo) return;

    for (let i = 0; i < cantidad; i++) {
      this._encender(
        x + (Math.random() - 0.5) * dispersion,
        y + (Math.random() - 0.5) * dispersion,
        z + (Math.random() - 0.5) * dispersion,
        // Casi quietas: lo que hace el fogonazo es aparecer, no viajar. Los
        // medio metro por segundo de temblor son para que las cuatro no salgan
        // clavadas en el mismo punto.
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        -arrastre + (Math.random() - 0.5) * 0.6,
        color,
        tam * (0.75 + Math.random() * 0.5),
        vida * (0.8 + Math.random() * 0.4),
        // Sin gravedad —en dieciséis centésimas la caída no se ve— y sin roce,
        // que es lo que mantiene el anclaje exacto.
        0, 0,
      );
    }
  }

  /**
   * CHORRO: emisión continua, para estelas.
   *
   * Se llama cada fotograma con una cantidad fraccionaria y se acumula el
   * resto, porque `Math.round(0.4)` fotograma tras fotograma da cero y la
   * estela no sale nunca. El acumulador vive en quien llama.
   */
  chorro(x, y, z, {
    color = 0xffffff, cantidad = 1, dispersion = 0.4, empuje = { x: 0, y: 0, z: 3 },
    tam = 0.26, vida = 0.42, gravedad = 0.6, roce = 1.6,
  } = {}) {
    if (!this.activo) return;

    for (let i = 0; i < cantidad; i++) {
      this._encender(
        x + (Math.random() - 0.5) * dispersion,
        y + (Math.random() - 0.5) * dispersion * 0.6,
        z + (Math.random() - 0.5) * dispersion,
        empuje.x + (Math.random() - 0.5) * dispersion * 3,
        empuje.y + (Math.random() - 0.5) * dispersion * 2,
        empuje.z + (Math.random() - 0.5) * dispersion * 2,
        color,
        tam * (0.7 + Math.random() * 0.6),
        vida * (0.7 + Math.random() * 0.6),
        gravedad, roce,
      );
    }
  }

  /**
   * ANILLO: una onda plana que se abre en horizontal.
   *
   * Es el fogonazo de un potenciador. Se distingue del estallido a propósito —
   * anillo contra esfera— porque los dos pasan seguidos y con la misma forma no
   * se sabría cuál de las dos cosas acaba de ocurrir.
   */
  anillo(x, y, z, { color = 0x39d98a, cantidad = 26, radio = 5.5, tam = 0.34, vida = 0.55 } = {}) {
    if (!this.activo) return;

    for (let i = 0; i < cantidad; i++) {
      const a = (i / cantidad) * Math.PI * 2 + Math.random() * 0.12;
      this._encender(
        x, y, z,
        Math.cos(a) * radio,
        0.5 + Math.random() * 0.7,
        Math.sin(a) * radio,
        color,
        tam * (0.8 + Math.random() * 0.4),
        vida * (0.8 + Math.random() * 0.4),
        1.4, 2.6,
      );
    }
  }

  /**
   * @param {number} dt
   * @param {number} avance Lo que se desplazó el mundo este fotograma
   */
  actualizar(dt, avance = 0) {
    if (!this.activo) return;

    let vivas = 0;

    for (let i = 0; i < this.pozo; i++) {
      if (this.vida[i] <= 0) continue;

      this.vida[i] -= dt;
      if (this.vida[i] <= 0) {
        this.tamanos[i] = 0;
        continue;
      }
      vivas++;

      const i3 = i * 3;

      // Rozamiento exponencial e independiente de los fotogramas: la misma
      // fórmula que usa el resto del juego para suavizados.
      const freno = Math.exp(-this.roce[i] * dt);
      this.vx[i] *= freno;
      this.vz[i] *= freno;
      this.vy[i] = this.vy[i] * freno - this.gravedad[i] * dt;

      this.posiciones[i3] += this.vx[i] * dt;
      this.posiciones[i3 + 1] += this.vy[i] * dt;
      this.posiciones[i3 + 2] += this.vz[i] * dt + avance;

      // Se pasó de la cámara: fuera. Ver `zLimite`.
      if (this.posiciones[i3 + 2] > this.zLimite) {
        this.vida[i] = 0;
        this.tamanos[i] = 0;
        vivas--;
        continue;
      }

      // Rebote seco contra el asfalto. Sin esto la mitad de cada estallido
      // atraviesa el suelo y se ve el efecto por debajo de la calle.
      if (this.posiciones[i3 + 1] < 0.04) {
        this.posiciones[i3 + 1] = 0.04;
        this.vy[i] = Math.abs(this.vy[i]) * 0.32;
      }

      const f = this.vida[i] / this.vidaMax[i];
      // Nace algo mayor de su tamaño y muere en nada. El alfa aguanta al 1
      // durante el primer tercio y luego cae: la chispa se ve entera casi toda
      // su vida y desaparece de golpe, que es como se comporta una de verdad.
      // El COLOR no se toca, para que siga floreciendo en el bloom hasta el
      // final.
      this.tamanos[i] = this.tamBase[i] * (0.25 + 0.95 * f);
      this.alfas[i] = Math.min(1, f * 1.5);
    }

    // Sin nada vivo no se sube nada a la GPU. En un juego que pasa la mitad del
    // tiempo sin partículas, esto ahorra un envío por fotograma.
    this.puntos.visible = vivas > 0;
    if (!vivas) return;

    this.puntos.geometry.attributes.position.needsUpdate = true;
    this.puntos.geometry.attributes.color.needsUpdate = true;
    this.puntos.geometry.attributes.size.needsUpdate = true;
    this.puntos.geometry.attributes.alfa.needsUpdate = true;
  }

  /** Apaga todo de golpe. Se llama al cambiar de escena. */
  limpiar() {
    if (!this.activo) return;
    this.vida.fill(0);
    this.tamanos.fill(0);
    this.alfas.fill(0);
    this.puntos.geometry.attributes.size.needsUpdate = true;
    this.puntos.geometry.attributes.alfa.needsUpdate = true;
    this.puntos.visible = false;
  }

  destruir() {
    if (!this.activo) return;
    this.escena.remove(this.puntos);
    this.puntos.geometry.dispose();
    this.material.dispose();
    this.activo = false;
  }
}
