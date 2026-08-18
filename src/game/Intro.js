// ============================================================================
// CINEMÁTICA DE ARRANQUE — Por qué estás corriendo
// ============================================================================
// Un endless runner que empieza contigo ya corriendo no explica nada. Este
// empieza contigo haciendo tu trabajo, y la carrera es la consecuencia.
//
//   1. ENTREVISTA   Estás preguntándole a un ministro. Cámara cerca, de lado.
//   2. RESCATE      Aparecen los dos por detrás y se lo llevan.
//   3. LA PARED     Te quedas con el micrófono en alto y nadie delante.
//   4. RETROCESO    La cámara se aleja hasta su posición de juego.
//   5. CABALLITO    El bajito se sube al grande.
//   6. ARRANQUE     Se sueltan los controles y empieza la corrida.
//
// LA FASE 3 ES EL CHISTE ENTERO. La cinemática podría acabar en el rescate y
// se entendería igual de bien; lo que no se entendería es POR QUÉ corres. El
// segundo largo en que sigues con el micrófono extendido hacia un sitio donde
// ya no hay nadie es lo que convierte "me interrumpieron" en "me dejaron
// hablando con la pared", y de ahí sale todo lo demás.
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
import { material } from '../utils/materiales.js';
import { CAMARA, PERSEGUIDOR } from '../config/balance.js';
import { crearMinistro } from '../models/characters.js';
import { esGLB, poseEntrevistaGLB, poseMinistroGLB } from '../models/personajeGLB.js';

// Guiones de la secuencia, en segundos.
const COMPLETA = {
  entrevista: 1.6,
  rescate: 1.2,
  pared: 1.0,
  retroceso: 1.4,
  caballito: 0.7,
};

// Versión corta para quien ya la vio: el mismo relato, en un tercio.
// La pared se acorta pero NO se quita: es la fase que explica el juego.
const ABREVIADA = {
  entrevista: 0.35,
  rescate: 0.45,
  pared: 0.4,
  retroceso: 0.55,
  caballito: 0.3,
};

// Dónde está el ministro. El periodista mira hacia -X (ver _poseEntrevista),
// así que su interlocutor va ahí; y como la cámara está en +X, los dos salen
// en cuadro uno detrás de otro en vez de tapándose.
// Se acercó al meter la cámara dentro del pasillo: con el encuadre más
// frontal, los -2.15 de antes lo dejaban medio cuerpo fuera por la izquierda.
const SITIO_MINISTRO = { x: -1.7, y: 0, z: 0.8 };

// Dónde se plantan los perseguidores DURANTE la cinemática.
//
// No vale usar su sitio de juego: esa posición está calculada para la cámara
// de carrera, que va DETRÁS del periodista; la de la entrevista está de lado
// y algo por delante, y desde ahí el sitio de carrera cae fuera de cuadro —a
// la espalda del objetivo— o encima del periodista, según la distancia.
//
// Este punto está calculado a mano contra CAMARA_ENTREVISTA: queda a unos
// trece metros del objetivo y a cinco grados del eje de la cámara, o sea
// calle arriba y al fondo. Se les ve LLEGAR, que es lo único que tienen que
// contar en esta escena. Si se toca la cámara de la entrevista, hay que
// recalcular esto: no es una posición cualquiera, es la que cae en cuadro.
//
// Y va DENTRO DEL PASILLO por lo mismo que la cámara: a -4 de eje quedaban
// detrás de la fila de locales de La Bahía. Llegaban puntualmente y no los
// veía nadie, que en una escena de tres segundos es no llegar.
const SITIO_RESCATE = { x: -2.6, z: -6.0 };

// De dónde vienen: calle arriba y al fondo, diminutos.
const SITIO_APARICION = { x: -3.2, z: -14.0 };

// Por dónde se van. NO es marcha atrás por donde vinieron: la salida se hace
// casi toda en X, y el motivo es de encuadre, no de guion. Desde esta cámara,
// alejarse en -Z empuja la figura hacia el BORDE DERECHO del cuadro —se salían
// medio cuerpo—, mientras que alejarse en -X la lleva hacia el centro y al
// fondo. Con esta salida los tres se van juntos, hacia dentro de la imagen y
// encogiendo, que es como se ve a alguien marcharse.
const SALIDA_RESCATE = { x: 4.5, z: 2.0 };

// Cámara del primer plano de la entrevista. Va de lado y algo por delante:
// desde detrás solo se le vería la espalda y el sombrero, y lo que tiene que
// leerse es que está PREGUNTANDO —el perfil, el brazo levantado, el micrófono.
// A unos siete metros: con el objetivo largo del juego (FOV 38), menos
// distancia deja al personaje comiéndose el cuadro entero.
//
// SE MANTIENE DENTRO DEL PASILLO DE CARRERA, y eso no es una preferencia de
// encuadre: es lo único que garantiza que no haya nada delante. El juego
// asegura que los tres carriles están despejados —el decorado más cercano
// queda a más de tres metros del eje—, pero a los lados hay escenario, y en
// La Bahía eso son locales de tres metros de alto pegados a la acera. Con la
// cámara a 6.2 de eje, la portada del juego era una pared gris: el periodista
// estaba ahí detrás, tapado por una tienda. Se conserva la distancia al
// objetivo (unos siete metros) abriendo en Z lo que se cierra en X.
const CAMARA_ENTREVISTA = { x: 3.0, y: 2.3, z: 6.4 };

// La del MENÚ es otra. En la cinemática el plano es cerrado porque dura
// segundo y medio y hay que leer el gesto; en la portada el personaje convive
// con la interfaz y necesita algo más de aire por abajo, o las piernas le
// quedan detrás de los botones.
//
// Se acercó al ensanchar el objetivo de juego (FOV 38 → 58): con el gran
// angular, la misma distancia dejaba al personaje diminuto en medio de la
// franja libre. Menos distancia, mismo tamaño en pantalla.
// Y por el mismo motivo que la de la entrevista, tampoco se sale del pasillo.
const CAMARA_MENU = { x: 2.7, y: 2.5, z: 6.3 };
const MIRA_MENU = 1.35;

// A dónde apunta la cámara mientras dura la entrevista: NO al periodista, sino
// al punto medio entre él y el ministro. Encuadrar a uno de los dos deja al
// otro pegado al borde o directamente fuera, y lo que hay que contar aquí es
// que hay una pregunta y alguien contestándola —o sea, los dos.
const MIRA_ENTREVISTA_X = -0.75;

// Reutilizable, para no crear un vector por fotograma.
const _puntoMano = new THREE.Vector3();

export class Intro {
  /** @param {THREE.Scene} escena Para poder plantar al ministro. */
  constructor(escena = null) {
    this.escena = escena;
    this.activa = false;
    this.tiempo = 0;
    this.guion = COMPLETA;
    this.duracion = 0;
    this.ministro = null;
  }

  /**
   * El ministro se crea la primera vez que hace falta y se queda.
   * Sale en la cinemática y en la portada, así que destruirlo y rehacerlo en
   * cada partida sería trabajo por nada.
   */
  _obtenerMinistro() {
    if (!this.ministro && this.escena) {
      this.ministro = crearMinistro();
      // Mira hacia +X, o sea de vuelta al periodista. El signo importa: con
      // -PI/2 miraba justo al revés y se le veía la espalda a los dos.
      this.ministro.rotation.y = Math.PI / 2;
      this.escena.add(this.ministro);
    }
    return this.ministro;
  }

  /**
   * Coloca al ministro.
   * @param {number} presencia 1 = ahí plantado, 0 = ya se lo llevaron
   */
  _colocarMinistro(presencia, tiempo = 0) {
    const m = this._obtenerMinistro();
    if (!m) return;

    const f = THREE.MathUtils.clamp(presencia, 0, 1);
    m.visible = f > 0.02;
    if (!m.visible) return;

    // Al llevárselo se aleja hacia atrás y de lado, y se encoge un poco: no
    // desaparece de golpe, se lo llevan.
    m.position.set(
      SITIO_MINISTRO.x - (1 - f) * 3.4,
      SITIO_MINISTRO.y,
      SITIO_MINISTRO.z - (1 - f) * 5.2,
    );
    m.scale.setScalar(0.85 + f * 0.15);

    // Mientras responde asiente despacio. Es lo único que lo distingue de un
    // maniquí, y basta con eso.
    if (esGLB(m)) {
      poseMinistroGLB(m, tiempo, f);
      return;
    }

    const p = m.userData.partes;
    if (p) {
      p.cabeza.rotation.x = Math.sin(tiempo * 1.7) * 0.09 * f;
      p.torso.rotation.y = Math.sin(tiempo * 0.9) * 0.06 * f;
    }
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
    camara.lookAt(MIRA_ENTREVISTA_X, MIRA_MENU, -0.1);
    this._poseEntrevista(jugador, this.tiempo);
    // En la portada el ministro TAMBIÉN está. La escena del menú es la
    // entrevista, y una entrevista sin nadie enfrente no es una entrevista: es
    // alguien de pie con un micrófono.
    this._colocarMinistro(1, this.tiempo);
    this._perseguidoresLejos(perseguidor);
  }

  saltar() {
    if (!this.activa) return false;
    this.activa = false;
    this._colocarMinistro(0);
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
      this._colocarMinistro(1, this.tiempo);
      this._perseguidoresLejos(perseguidor);
      return false;
    }
    t -= g.entrevista;

    // --- Fase 2: el rescate -------------------------------------------------
    // Llegan calle arriba y se lo llevan. No hay forcejeo ni nada parecido: el
    // ministro se va con ellos como quien se acuerda de otra reunión, que es
    // exactamente lo que pasa.
    //
    // La fase tiene dos mitades dentro: primero LLEGAN (0 → 0.45) y luego se
    // RETIRAN con él (0.45 → 1). Que se vayan los tres a la vez y en la misma
    // dirección es lo que hace que se lea como un rescate y no como que el
    // ministro se esfumó por su cuenta.
    if (t < g.rescate) {
      const f = this._suave(t / g.rescate);
      const llegada = THREE.MathUtils.clamp(f / 0.45, 0, 1);
      const retirada = THREE.MathUtils.clamp((f - 0.45) / 0.55, 0, 1);

      this._colocarCamara(camara, CAMARA_ENTREVISTA, jugador, 1);
      this._poseEntrevista(jugador, this.tiempo);
      this._colocarMinistro(1 - retirada, this.tiempo);

      this._plantarPerseguidores(
        perseguidor,
        THREE.MathUtils.lerp(SITIO_APARICION.x, SITIO_RESCATE.x, llegada)
          - retirada * SALIDA_RESCATE.x,
        THREE.MathUtils.lerp(SITIO_APARICION.z, SITIO_RESCATE.z, llegada)
          - retirada * SALIDA_RESCATE.z,
        0, // de cara al periodista: vienen hacia él, no de espaldas
      );
      this._separados(perseguidor, 1);
      return false;
    }
    t -= g.rescate;

    // --- Fase 3: hablando con la pared -------------------------------------
    // El micrófono sigue extendido y delante NO HAY NADIE. Ni el ministro ni
    // los que se lo llevaron: el cuadro se queda con el periodista y la calle
    // vacía, y la cámara no se mueve. Ese plano quieto es el juego entero.
    if (t < g.pared) {
      this._colocarCamara(camara, CAMARA_ENTREVISTA, jugador, 1);
      this._poseEntrevista(jugador, this.tiempo);
      this._colocarMinistro(0);
      this._perseguidoresLejos(perseguidor);
      return false;
    }
    t -= g.pared;

    // --- Fase 4: la cámara se aleja ----------------------------------------
    if (t < g.retroceso) {
      // Suavizado en los dos extremos: arranca despacio y frena al llegar.
      const f = this._suave(t / g.retroceso);
      const pos = {
        x: THREE.MathUtils.lerp(CAMARA_ENTREVISTA.x, CAMARA.POSICION.x, f),
        y: THREE.MathUtils.lerp(CAMARA_ENTREVISTA.y, CAMARA.POSICION.y, f),
        z: THREE.MathUtils.lerp(CAMARA_ENTREVISTA.z, CAMARA.POSICION.z, f),
      };
      this._colocarCamara(camara, pos, jugador, 1 - f);
      this._poseEntrevista(jugador, this.tiempo, 1 - f);
      this._colocarMinistro(0);
      // Aquí es donde REAPARECEN, y el orden importa: no se les ve dar la
      // vuelta, se les descubre. Estabas solo hablando con la pared, la cámara
      // retrocede, y resulta que los tienes detrás. Plantarlos ya en su sitio
      // de carrera durante todo el retroceso hace justo eso: al principio del
      // movimiento quedan a la espalda del objetivo y no se ven; al final la
      // cámara está detrás de ti y ahí están.
      this._plantarPerseguidores(
        perseguidor,
        PERSEGUIDOR.DESVIO_EN_PANTALLA * 3.6,
        PERSEGUIDOR.Z_LEJOS,
        Math.PI,
      );
      this._separados(perseguidor, 1);
      return false;
    }
    t -= g.retroceso;

    // --- Fase 5: el caballito ----------------------------------------------
    if (t < g.caballito) {
      const f = this._suave(t / g.caballito);
      this._colocarCamara(camara, CAMARA.POSICION, jugador, 0);
      this._colocarMinistro(0);
      this._plantarPerseguidores(
        perseguidor, PERSEGUIDOR.DESVIO_EN_PANTALLA * 3.6, PERSEGUIDOR.Z_LEJOS, Math.PI,
      );
      this._separados(perseguidor, 1 - f);
      return false;
    }

    // --- Fin ---------------------------------------------------------------
    this.activa = false;
    this._separados(perseguidor, 0);
    this._colocarMinistro(0);
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
    const miraX = jugador.x * (1 - cercania) * 0.35 + MIRA_ENTREVISTA_X * cercania;
    camara.lookAt(miraX, miraY, miraZ);
  }

  /** Deja el modelo listo para correr, deshaciendo la pose de entrevista. */
  soltarPose(jugador) {
    this._poseEntrevista(jugador, this.tiempo, 0);
    this._colocarMinistro(0);
    if (this._microfono) this._microfono.visible = false;
  }

  /**
   * De pie, preguntando: micrófono en alto y peso en una pierna.
   * @param {number} intensidad 1 = entrevistando, 0 = ya corriendo
   */
  _poseEntrevista(jugador, tiempo, intensidad = 1) {
    // Se gira hacia quien responde, que está fuera de cuadro a su derecha.
    // Media vuelta más el giro deja el perfil hacia la cámara.
    jugador.modelo.rotation.y = Math.PI + 1.5 * intensidad;

    // Los dos protagonistas vienen de un archivo con esqueleto: su pose se
    // escribe sobre huesos, no sobre pivotes, y la mano que sostiene el
    // micrófono la devuelve el propio modelo —aquí no se sabe cómo se llaman
    // sus huesos, ni hace falta—.
    if (esGLB(jugador.modelo)) {
      const mano = poseEntrevistaGLB(jugador.modelo, tiempo, intensidad);
      this._colgarMicrofono(mano, intensidad, jugador.modelo);
      return;
    }

    const p = jugador.modelo?.userData?.partes;
    if (!p) return;

    // El brazo del micrófono, extendido y con el pulso de quien lleva rato
    // aguantándolo. El otro sostiene la libreta contra el pecho.
    const pulso = Math.sin(tiempo * 2.4) * 0.07;
    p.brazoDer.rotation.x = (-1.35 + pulso) * intensidad;
    p.brazoDer.rotation.z = -0.35 * intensidad;
    // El codo, doblado: el micrófono se sostiene con el antebrazo levantado,
    // no con el brazo entero estirado como una barrera.
    p.antebrazoDer.rotation.x = -0.55 * intensidad;
    p.brazoIzq.rotation.x = -0.5 * intensidad;
    p.antebrazoIzq.rotation.x = -0.85 * intensidad;

    // Piernas quietas: no está corriendo todavía.
    p.piernaIzq.rotation.x = 0.1 * intensidad;
    p.piernaDer.rotation.x = -0.14 * intensidad;
    p.pantorrillaIzq.rotation.x = 0.06 * intensidad;
    p.pantorrillaDer.rotation.x = 0.1 * intensidad;
    p.torso.rotation.x = -0.06 * intensidad;

    this._colgarMicrofono(p.manoDer, intensidad, jugador.modelo);
  }

  /**
   * El micrófono. Se crea una vez y SIGUE a la mano; al terminar la intro se
   * esconde, porque durante la corrida no lo lleva.
   *
   * No se cuelga como hijo de la mano, que sería lo obvio, y el motivo es que
   * la mano puede ser dos cosas muy distintas: un grupo del personaje de cajas
   * o un HUESO del modelo importado. Los huesos de ese archivo vienen en
   * centímetros y con los ejes mirando a donde el modelador quiso, así que un
   * micrófono colgado de uno sale del tamaño de un edificio y apuntando al
   * suelo. Siguiendo solo la POSICIÓN de la mano, da igual de quién sea.
   */
  _colgarMicrofono(mano, intensidad, modelo) {
    if (!mano || !modelo) return;

    if (!this._microfono) {
      this._microfono = new THREE.Group();
      const mango = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.055, 0.3, 7),
        material({ color: 0x22283a, roughness: 0.6, flatShading: true }),
      );
      this._microfono.add(mango);
      const rejilla = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        material({
          color: 0xb8c2d4, roughness: 0.35, metalness: 0.5, flatShading: true,
        }),
      );
      rejilla.position.y = 0.19;
      this._microfono.add(rejilla);
    }

    if (this._microfono.parent !== modelo) modelo.add(this._microfono);

    // La mano, en coordenadas del personaje, y el micrófono un palmo por
    // debajo y por delante: agarrado, no clavado en el puño.
    mano.getWorldPosition(_puntoMano);
    modelo.worldToLocal(_puntoMano);
    this._microfono.position.set(_puntoMano.x, _puntoMano.y - 0.09, _puntoMano.z + 0.06);
    this._microfono.visible = intensidad > 0.05;
  }

  /** Los deja fuera de cuadro, muy atrás. */
  _perseguidoresLejos(perseguidor) {
    perseguidor.modelo.visible = false;
  }

  /**
   * Planta a los perseguidores en un sitio concreto DURANTE la cinemática.
   *
   * Hace falta escribir la posición del modelo a mano, y esto costó verlo:
   * `zVisualActual` y compañía son el estado interno del perseguidor, pero
   * quien los traslada a `modelo.position` es su propio `_colocar()`, y ese
   * método solo corre desde `actualizar()` —que en la cinemática no se llama—.
   * O sea que fijar los campos y esperar que se movieran no hacía nada: los
   * dos se quedaban en su sitio de carrera, encima del periodista.
   *
   * De paso se dejan los campos cuadrados, para que el primer fotograma de la
   * corrida no dé un salto.
   */
  _plantarPerseguidores(perseguidor, x, z, giro = Math.PI) {
    perseguidor.modelo.visible = true;
    perseguidor.modelo.position.set(x, 0, z);
    perseguidor.modelo.scale.setScalar(PERSEGUIDOR.ESCALA_LEJOS);
    perseguidor.modelo.rotation.y = giro;
    perseguidor.zVisualActual = z;
    perseguidor.xVisualActual = x;
    perseguidor.escalaActual = PERSEGUIDOR.ESCALA_LEJOS;
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

    const f = THREE.MathUtils.clamp(separacion, 0, 1);

    // Los del modelo se bajan al suelo y se apartan; sus piernas las escribe
    // su propia pose (ver poseMontadoGLB) y aquí no se tocan.
    if (partes.delModelo) {
      const montado = partes.alturaMontado ?? 1.5;
      partes.arriba.position.y = THREE.MathUtils.lerp(montado, 0, f);
      partes.arriba.position.x = THREE.MathUtils.lerp(0, 0.95, f);
      partes.arriba.scale.setScalar(THREE.MathUtils.lerp(0.86, 1, f));
      return;
    }

    const arriba = partes.grupoNoboa;

    // Baja al suelo y se aparta a un lado mientras corre en paralelo.
    arriba.position.y = THREE.MathUtils.lerp(partes.alturaMontado ?? 1.52, 0, f);
    arriba.position.x = THREE.MathUtils.lerp(0, 0.95, f);
    arriba.scale.setScalar(THREE.MathUtils.lerp(0.92, 1, f));

    // Las piernas se cierran al montarse y se abren al correr.
    const abiertas = THREE.MathUtils.lerp(0.55, 0.05, 1 - f);
    partes.noboa.piernaIzq.rotation.z = abiertas;
    partes.noboa.piernaDer.rotation.z = -abiertas;
  }
}
