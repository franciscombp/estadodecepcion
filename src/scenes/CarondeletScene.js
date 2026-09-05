// ============================================================================
// CARONDELET — Censura de prensa
// ============================================================================
// Centro histórico cercado. Es el escenario más hostil y el más pobre en
// recolectables (densidad 0.25, tope de 3 papeles por tramo): aquí no hay nada
// que documentar porque no dejan documentar. Esa carestía es el mensaje.
//
// Tampoco hay bifurcación de frente: cruzar el cerco es perder, sin ruleta.
//
// Detalle propio: humo de gas a ras de suelo, BOCANADAS de gas lacrimógeno que
// cruzan la vía, y focos de vigilancia que barren la pista desde arriba.
// ============================================================================

import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

export class CarondeletScene extends BaseScene {
  constructor(escena, config, calidad) {
    super(escena, config, calidad);
    this._crearHumo();
    this._crearBocanadas();
    this._crearVigilancia();
  }

  /**
   * GAS LACRIMÓGENO. Lo pedía el guion desde el principio y no estaba: «no es
   * un obstáculo con caja de colisión, es atmósfera —bocanadas que cruzan la
   * vía y estorban la vista—». Es lo único que hace que este barrio se JUEGUE
   * distinto de los otros tres, que hasta ahora solo se veían distintos.
   *
   * NO ES EL HUMO DE ARRIBA. Ese es un velo constante y flojísimo —opacidad
   * 0,055 a 0,115, catorce planos repartidos por 140 metros— y está bien que
   * lo sea: es ambiente. Esto es un EVENTO: una bocanada densa que entra por
   * un lado, cruza la calzada y se va.
   *
   * ══ HASTA DÓNDE PUEDE TAPAR ══════════════════════════════════════════════
   *
   * Aquí está la única decisión difícil. Una bocanada que tape del todo
   * convierte el barrio en una lotería: los obstáculos aparecen a 220 m y se
   * leen durante varios segundos, y quitarle al jugador el que tiene delante
   * en el último medio segundo no es dificultad, es tramposo.
   *
   * Así que TAPA A MEDIAS: 0,42 de opacidad en el núcleo. A través de eso las
   * siluetas se siguen leyendo —que es lo que hace falta para decidir— pero se
   * leen SUCIAS. El barrio pasa de «ves y esquivas» a «ves peor y te acuerdas
   * de lo que viste», que es exactamente lo que dice el guion.
   *
   * No he podido comprobarlo en pantalla: no hay navegador en esta tarea. Si
   * hay que moverlo, el número es `NUCLEO` y sube o baja solo esto.
   */
  _crearBocanadas() {
    // Tres, y nunca más de una en el mismo tramo de calle: se sueltan cada
    // 70 metros y viven 94, así que como mucho hay dos vivas y separadas.
    // Encadenar dos seguidas sería el velo permanente que este efecto NO es.
    this.bocanadas = [];
    this.metrosDesdeBocanada = 0;

    // Cada bocanada son tres planos girados entre sí. Uno solo se lee como un
    // cartel plano en cuanto se mueve de lado; tres cruzados dan volumen por
    // el mismo precio, que es lo único que se puede pagar en un móvil: nueve
    // cuadriláteros transparentes en total para todo el efecto.
    const geo = new THREE.PlaneGeometry(7.5, 5.2);

    for (let i = 0; i < 3; i++) {
      const grupo = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const mat = new THREE.MeshBasicMaterial({
          // El gris verdoso del gas, no blanco: el blanco a esta opacidad se
          // lee como niebla y la niebla ya la pone el ambiente.
          color: 0xc2c8b4,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const hoja = new THREE.Mesh(geo, mat);
        hoja.position.set((j - 1) * 1.1, (j - 1) * 0.5, (j - 1) * 1.4);
        hoja.rotation.z = (j - 1) * 0.5;
        grupo.add(hoja);
      }
      grupo.visible = false;
      this.grupo.add(grupo);
      this.bocanadas.push({ grupo, viva: false, deriva: 0, giro: 0 });
    }
  }

  /** Humo a ras de suelo. Planos semitransparentes que derivan. */
  _crearHumo() {
    this.humo = [];

    const geometria = new THREE.PlaneGeometry(9, 4.5);

    for (let i = 0; i < 14; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xb8a89a,
        transparent: true,
        opacity: 0.055 + Math.random() * 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const nube = new THREE.Mesh(geometria, material);
      nube.position.set(
        (Math.random() - 0.5) * 18,
        0.7 + Math.random() * 1.6,
        -Math.random() * 140,
      );
      nube.rotation.y = Math.random() * Math.PI;
      this.grupo.add(nube);

      this.humo.push({
        malla: nube,
        deriva: (Math.random() - 0.5) * 0.8,
        giro: (Math.random() - 0.5) * 0.25,
        faseOndulacion: Math.random() * Math.PI * 2,
      });
    }
  }

  /** Focos de vigilancia barriendo la pista desde lo alto. */
  _crearVigilancia() {
    this.focos = [];

    // LOS DOS FOCOS SON DEL APAREJO, NO DEL BARRIO. Ver game/Luces.js: colgados
    // del grupo, entrar y salir del centro histórico subía y bajaba
    // NUM_SPOT_LIGHTS y con eso se recompilaban todos los materiales de la
    // escena. Existen siempre, en todos los barrios, apagados; aquí sólo se les
    // da color, sitio y trabajo.
    const rig = this.escena.userData.rig;
    for (let i = 0; i < 2; i++) {
      const foco = i === 0 ? rig.foco : rig.foco2;
      foco.color.setHex(0xffd0c0);
      foco.intensity = 3.5;
      foco.distance = 55;
      foco.angle = Math.PI / 9;
      foco.penumbra = 0.6;
      foco.decay = 1.6;
      foco.position.set((i === 0 ? -1 : 1) * 9, 13, -30 - i * 45);
      foco.target.position.set(0, 0, -30 - i * 45);

      this.focos.push({
        luz: foco,
        // Barrido lento y regular: es vigilancia, no una fiesta.
        velocidad: 0.28 + i * 0.12,
        fase: i * Math.PI,
        amplitud: 7,
      });
    }
  }

  actualizar(dt, avance, jugador) {
    super.actualizar(dt, avance, jugador);

    // --- Humo --------------------------------------------------------------
    for (const h of this.humo) {
      h.malla.position.z += avance * 1.05; // Casi a la velocidad del suelo.
      h.malla.position.x += h.deriva * dt;
      h.malla.position.y += Math.sin(this.tiempo * 0.8 + h.faseOndulacion) * dt * 0.3;
      h.malla.rotation.z += h.giro * dt;

      if (h.malla.position.z > 16) {
        h.malla.position.z = -140 - Math.random() * 30;
        h.malla.position.x = (Math.random() - 0.5) * 18;
        h.malla.position.y = 0.7 + Math.random() * 1.6;
      }
    }

    // --- Bocanadas de gas ---------------------------------------------------
    this._actualizarBocanadas(dt, avance);

    // --- Focos de vigilancia ----------------------------------------------
    for (const f of this.focos) {
      f.luz.position.z += avance * 0.6;
      f.luz.target.position.z += avance * 0.6;

      if (f.luz.position.z > 15) {
        f.luz.position.z -= 110;
        f.luz.target.position.z -= 110;
      }

      // Barrido lateral: el haz recorre la pista de lado a lado.
      const barrido = Math.sin(this.tiempo * f.velocidad + f.fase) * f.amplitud;
      f.luz.target.position.x = barrido;
      f.luz.target.updateMatrixWorld();
    }
  }

  _actualizarBocanadas(dt, avance) {
    const NUCLEO = 0.42;      // Cuánto llega a tapar. Ver _crearBocanadas.
    const LEJOS = -80;        // Dónde nace, en metros por delante.
    const FIN = 14;           // Y dónde se recicla, ya pasada la cámara.
    // Metros de calle entre una y la siguiente. 95 y no 70, y el número sale
    // de una cuenta: la bocanada recorre 94 m, así que con 70 habría 1,34
    // vivas de media y a máxima velocidad saldría una cada 2,2 s. Eso deja de
    // ser un evento y vuelve a ser un velo, que es justo lo que este efecto NO
    // es —para velo ya está el humo de fondo—. Con 95 hay UNA de media.
    const CADA = 95;

    // Se suelta por METROS RECORRIDOS y no por segundos. Con un reloj, a 15
    // m/s saldría una cada 1050 metros y a 32 una cada 2240: el barrio se
    // volvería más limpio cuanto más rápido fueras, que es al revés de lo que
    // tiene que pasar.
    this.metrosDesdeBocanada += avance;
    if (this.metrosDesdeBocanada >= CADA) {
      const libre = this.bocanadas.find((b) => !b.viva);
      if (libre) {
        this.metrosDesdeBocanada = 0;
        // Entra por un costado y sale por el otro: cruzar la vía es el efecto.
        // Si naciera en el centro se quedaría en el centro, y una mancha
        // clavada en el eje de la calle tapa el carril que más se usa durante
        // todo su recorrido.
        const lado = Math.random() < 0.5 ? -1 : 1;
        libre.grupo.position.set(lado * 9.5, 1.5 + Math.random() * 0.8, LEJOS);
        libre.grupo.rotation.y = Math.random() * Math.PI;
        // La travesía completa son unos 19 m de lado. La bocanada vive 94 m de
        // calle, o sea 4,7 s a la velocidad de crucero: 4 m/s la cruzan entera
        // y sobra, que es lo que hace que ningún carril la aguante todo el rato.
        libre.deriva = -lado * (3.4 + Math.random() * 1.2);
        libre.giro = (Math.random() - 0.5) * 0.25;
        libre.viva = true;
        libre.grupo.visible = true;
      }
    }

    for (const b of this.bocanadas) {
      if (!b.viva) continue;
      const p = b.grupo.position;
      // Viaja con el mundo. A diferencia del humo de fondo —que va al 1,05
      // para despegarse del suelo— esta va exacta: es una cosa que está EN la
      // calle, y si se adelantara al asfalto se leería como que la empujan.
      p.z += avance;
      p.x += b.deriva * dt;
      b.grupo.rotation.y += b.giro * dt;

      // Aparece y se deshace en los extremos de su recorrido. Sin el fundido,
      // una mancha de opacidad 0,42 apareciendo de golpe a ochenta metros es
      // un parpadeo, y desapareciendo al pasar la cámara es un corte.
      const t = (p.z - LEJOS) / (FIN - LEJOS);           // 0 al nacer, 1 al morir
      const sube = Math.min(1, t / 0.18);
      const baja = Math.min(1, (1 - t) / 0.22);
      const alfa = NUCLEO * Math.max(0, Math.min(sube, baja));
      for (const hoja of b.grupo.children) hoja.material.opacity = alfa;

      if (p.z > FIN) {
        b.viva = false;
        b.grupo.visible = false;
      }
    }
  }
}
