// ============================================================================
// CINEMÁTICA DE ARRANQUE — Por qué estás corriendo
// ============================================================================
// Un endless runner que empieza contigo ya corriendo no explica nada. Este
// empieza contigo haciendo tu trabajo, y la carrera es la consecuencia.
//
//   1. ENTREVISTA   Estás de pie, preguntando. La cámara está cerca y de lado.
//   2. RETROCESO    La cámara se aleja hasta su posición de juego.
//   3. LLEGADA      Aparecen los dos al fondo y se acercan corriendo.
//   4. CABALLITO    El bajito se sube al grande.
//   5. ARRANQUE     Se sueltan los controles y empieza la corrida.
//
// SE PUEDE SALTAR, y esto no es negociable: son cuatro segundos, y cuatro
// segundos repetidos treinta veces son dos minutos mirando lo mismo. Un toque
// la corta. Además, a partir de la tercera partida se reproduce abreviada:
// quien ya la vio no necesita verla entera nunca más.
//
// La cinemática NO toca la lógica de juego. Mueve la cámara y las poses, y
// nada más: cuando termina, el mundo está exactamente como estaría sin ella.
// ============================================================================

import * as THREE from 'three';
import { CAMARA, PERSEGUIDOR } from '../config/balance.js';

// Guiones de la secuencia, en segundos.
const COMPLETA = {
  entrevista: 1.5,
  retroceso: 1.6,
  llegada: 1.2,
  caballito: 0.8,
};

// Versión corta para quien ya la vio: el mismo relato, en un tercio.
const ABREVIADA = {
  entrevista: 0.35,
  retroceso: 0.6,
  llegada: 0.5,
  caballito: 0.35,
};

// Cámara del primer plano de la entrevista. Va de lado y algo por delante:
// desde detrás solo se le vería la espalda y el sombrero, y lo que tiene que
// leerse es que está PREGUNTANDO —el perfil, el brazo levantado, el micrófono.
// A unos siete metros: con el objetivo largo del juego (FOV 38), menos
// distancia deja al personaje comiéndose el cuadro entero.
const CAMARA_ENTREVISTA = { x: 6.2, y: 2.3, z: 4.0 };

// La del MENÚ es otra, y más lejos. En la cinemática el plano es cerrado
// porque dura segundo y medio y hay que leer el gesto; en la portada el
// personaje convive con la interfaz, y a la distancia de la cinemática le
// quedaban las piernas detrás de los botones.
const CAMARA_MENU = { x: 7.6, y: 2.9, z: 5.6 };
const MIRA_MENU = 1.45;

export class Intro {
  constructor() {
    this.activa = false;
    this.tiempo = 0;
    this.guion = COMPLETA;
    this.duracion = 0;
  }

  /**
   * @param {boolean} abreviada ¿Ya la vio antes?
   */
  iniciar(abreviada = false) {
    this.guion = abreviada ? ABREVIADA : COMPLETA;
    this.duracion = Object.values(this.guion).reduce((a, b) => a + b, 0);
    this.tiempo = 0;
    this.activa = true;
  }

  /**
   * Encuadre del MENÚ: la misma entrevista, en bucle.
   *
   * La portada del juego enseña al periodista trabajando en vez de un fondo
   * cualquiera. Es la misma pose y la misma cámara de la fase 1 de la
   * cinemática —no hay dos versiones que mantener— con una deriva lenta para
   * que la imagen respire: una escena 3D perfectamente quieta se lee como una
   * foto, y entonces daba igual que fuera 3D.
   */
  encuadrarMenu(dt, camara, jugador, perseguidor) {
    this.tiempo += dt;

    const vaiven = Math.sin(this.tiempo * 0.32);
    const pos = {
      x: CAMARA_MENU.x + vaiven * 0.6,
      y: CAMARA_MENU.y + Math.sin(this.tiempo * 0.21) * 0.16,
      z: CAMARA_MENU.z + vaiven * 0.34,
    };

    camara.position.set(pos.x, pos.y, pos.z);
    camara.lookAt(0, MIRA_MENU, -0.1);
    this._poseEntrevista(jugador, this.tiempo);
    this._perseguidoresLejos(perseguidor);
  }

  saltar() {
    if (!this.activa) return false;
    this.activa = false;
    if (this._microfono) this._microfono.visible = false;
    return true;
  }

  /**
   * Avanza la secuencia y coloca cámara, jugador y perseguidores.
   *
   * @returns {boolean} true en el fotograma en que termina
   */
  actualizar(dt, camara, jugador, perseguidor) {
    if (!this.activa) return false;

    this.tiempo += dt;
    const g = this.guion;

    // --- Fase 1: la entrevista ---------------------------------------------
    let t = this.tiempo;
    if (t < g.entrevista) {
      this._colocarCamara(camara, CAMARA_ENTREVISTA, jugador, 1);
      this._poseEntrevista(jugador, this.tiempo);
      this._perseguidoresLejos(perseguidor);
      return false;
    }
    t -= g.entrevista;

    // --- Fase 2: la cámara se aleja ----------------------------------------
    if (t < g.retroceso) {
      // Suavizado en los dos extremos: arranca despacio y frena al llegar.
      const f = this._suave(t / g.retroceso);
      const pos = {
        x: THREE.MathUtils.lerp(CAMARA_ENTREVISTA.x, CAMARA.POSICION.x, f),
        y: THREE.MathUtils.lerp(CAMARA_ENTREVISTA.y, CAMARA.POSICION.y, f),
        z: THREE.MathUtils.lerp(CAMARA_ENTREVISTA.z, CAMARA.POSICION.z, f),
      };
      this._colocarCamara(camara, pos, jugador, 1 - f);
      this._poseEntrevista(jugador, this.tiempo);
      this._perseguidoresLejos(perseguidor);
      return false;
    }
    t -= g.retroceso;

    // --- Fase 3: llegan por detrás -----------------------------------------
    if (t < g.llegada) {
      const f = t / g.llegada;
      this._colocarCamara(camara, CAMARA.POSICION, jugador, 0);
      this._poseEntrevista(jugador, this.tiempo, 1 - f);

      // Vienen desde muy atrás, fuera de cuadro, hasta su sitio de carrera.
      perseguidor.modelo.visible = true;
      perseguidor.zVisualActual = THREE.MathUtils.lerp(24, PERSEGUIDOR.Z_LEJOS, this._suave(f));
      perseguidor.escalaActual = PERSEGUIDOR.ESCALA_LEJOS;
      this._separados(perseguidor, 1 - f);
      return false;
    }
    t -= g.llegada;

    // --- Fase 4: el caballito ----------------------------------------------
    if (t < g.caballito) {
      const f = this._suave(t / g.caballito);
      this._colocarCamara(camara, CAMARA.POSICION, jugador, 0);
      this._separados(perseguidor, 1 - f);
      return false;
    }

    // --- Fin ---------------------------------------------------------------
    this.activa = false;
    this._separados(perseguidor, 0);
    if (this._microfono) this._microfono.visible = false;
    return true;
  }

  // -------------------------------------------------------------------------
  // PIEZAS
  // -------------------------------------------------------------------------

  /** Curva suave de entrada y salida. */
  _suave(x) {
    const c = THREE.MathUtils.clamp(x, 0, 1);
    return c * c * (3 - 2 * c);
  }

  _colocarCamara(camara, pos, jugador, cercania) {
    camara.position.set(pos.x, pos.y, pos.z);
    // Durante la entrevista la cámara mira al periodista; al alejarse va
    // pasando a mirar la pista, que es lo que enseña a dónde se corre.
    const miraZ = THREE.MathUtils.lerp(CAMARA.MIRA.z, -0.1, cercania);
    const miraY = THREE.MathUtils.lerp(CAMARA.MIRA.y, 1.15, cercania);
    camara.lookAt(jugador.x * (1 - cercania) * 0.35, miraY, miraZ);
  }

  /** Deja el modelo listo para correr, deshaciendo la pose de entrevista. */
  soltarPose(jugador) {
    this._poseEntrevista(jugador, this.tiempo, 0);
    if (this._microfono) this._microfono.visible = false;
  }

  /**
   * De pie, preguntando: micrófono en alto y peso en una pierna.
   * @param {number} intensidad 1 = entrevistando, 0 = ya corriendo
   */
  _poseEntrevista(jugador, tiempo, intensidad = 1) {
    const p = jugador.modelo?.userData?.partes;
    if (!p) return;

    // Se gira hacia quien responde, que está fuera de cuadro a su derecha.
    // Media vuelta más el giro deja el perfil hacia la cámara.
    jugador.modelo.rotation.y = Math.PI + 1.5 * intensidad;

    // El brazo del micrófono, extendido y con el pulso de quien lleva rato
    // aguantándolo. El otro sostiene la libreta contra el pecho.
    const pulso = Math.sin(tiempo * 2.4) * 0.07;
    p.brazoDer.rotation.x = (-1.65 + pulso) * intensidad;
    p.brazoDer.rotation.z = -0.35 * intensidad;
    p.brazoIzq.rotation.x = -0.5 * intensidad;

    // Piernas quietas: no está corriendo todavía.
    p.piernaIzq.rotation.x = 0.1 * intensidad;
    p.piernaDer.rotation.x = -0.14 * intensidad;
    p.torso.rotation.x = -0.06 * intensidad;

    // El micrófono. Se crea una vez y se cuelga del brazo; al terminar la
    // intro se esconde, porque durante la corrida no lo lleva en la mano.
    if (!this._microfono) {
      this._microfono = new THREE.Group();
      const mango = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.055, 0.3, 7),
        new THREE.MeshStandardMaterial({ color: 0x22283a, roughness: 0.6, flatShading: true }),
      );
      this._microfono.add(mango);
      const rejilla = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        new THREE.MeshStandardMaterial({
          color: 0xb8c2d4, roughness: 0.35, metalness: 0.5, flatShading: true,
        }),
      );
      rejilla.position.y = 0.19;
      this._microfono.add(rejilla);
      this._microfono.position.set(0, -0.42, 0);
      p.brazoDer.add(this._microfono);
    }
    this._microfono.visible = intensidad > 0.05;
  }

  /** Los deja fuera de cuadro, muy atrás. */
  _perseguidoresLejos(perseguidor) {
    perseguidor.modelo.visible = false;
  }

  /**
   * Separa al de arriba del de abajo. Con separacion=1 el bajito va corriendo
   * al lado; con 0 ya está montado, que es la pose normal del juego.
   *
   * @param {number} separacion 0..1
   */
  _separados(perseguidor, separacion) {
    const partes = perseguidor.modelo?.userData?.partes;
    if (!partes) return;

    const arriba = partes.grupoNoboa;
    const f = THREE.MathUtils.clamp(separacion, 0, 1);

    // Baja al suelo y se aparta a un lado mientras corre en paralelo.
    arriba.position.y = THREE.MathUtils.lerp(1.52, 0, f);
    arriba.position.x = THREE.MathUtils.lerp(0, 0.95, f);
    arriba.scale.setScalar(THREE.MathUtils.lerp(0.92, 1, f));

    // Las piernas se cierran al montarse y se abren al correr.
    const abiertas = THREE.MathUtils.lerp(0.55, 0.05, 1 - f);
    partes.noboa.piernaIzq.rotation.z = abiertas;
    partes.noboa.piernaDer.rotation.z = -abiertas;
  }
}
