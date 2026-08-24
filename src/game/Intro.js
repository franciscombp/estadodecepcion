// ============================================================================
// CINEMÁTICA DE ARRANQUE — Por qué estás corriendo
// ============================================================================
// Un endless runner que empieza contigo ya corriendo no explica nada. Este
// empieza contigo haciendo tu trabajo, y la carrera es la consecuencia.
//
//   1. ENTREVISTA   Estás preguntándole a un ministro. Cámara cerca, de lado.
//   2. LLEGADA      Roy y el suyo aparecen por el primer término y se acercan
//                   ANDANDO. Nadie corre todavía: solo se están acercando.
//   3. HUIDA        El entrevistado los ve venir y sale por piernas.
//   4. ARRANQUE     Sales detrás de él. La cámara retrocede a su sitio de
//                   juego y los dos que venían andando se ponen a correr.
//   5. CABALLITO    El bajito se sube al grande.
//
// EL RELATO CAMBIÓ, Y CAMBIÓ POR LO QUE SE ENTENDÍA. Antes los dos llegaban y
// se LLEVABAN al entrevistado, y luego venía un plano largo del periodista con
// el micrófono extendido hacia un sitio donde ya no había nadie. La frase
// «hablando con la pared» estaba bien contada y explicaba el enfado, pero no
// explicaba la mecánica: si al entrevistado se lo llevaron en volandas, ¿a
// quién persigues tú, y por qué te persiguen a ti?
//
// Ahora la carrera SALE DEL PROPIO PLANO. El entrevistado huye por su cuenta
// —de los que se acercan, no de ti—, tú sales detrás porque es tu entrevista
// la que se está yendo, y los otros dos salen detrás de ti. Los tres corren en
// la misma dirección y por motivos distintos, que es exactamente la partida:
// tú persigues una respuesta y a ti te persigue el Estado.
//
// El plano de quedarse solo no se pierde, se mueve: es la fase 3, con la
// diferencia de que ahora al final del micrófono hay alguien alejándose.
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
import { crearMinistro, animarPerseguidores } from '../models/characters.js';
import {
  esGLB, poseEntrevistaGLB, poseMinistroGLB, animarCaminarGLB, animarCarreraGLB,
} from '../models/personajeGLB.js';

// Guiones de la secuencia, en segundos.
//
// LAS DURACIONES SALEN DE LOS METROS, no del ritmo. Es la lección que dejó la
// versión anterior: con la fase de llegada en 1,2 s, los que entraban recorrían
// 8 metros en 0,54 s, o sea CATORCE METROS POR SEGUNDO —tres veces un
// velocista—. A esa velocidad no hay ciclo de piernas que valga: cualquier
// animación se ve deslizarse, porque el cuerpo viaja mucho más de lo que da la
// zancada. Medido entonces: el entrevistado se iba a 10,7 m/s y su pie, en el
// punto más lento de cada paso, seguía moviéndose al 55 % de esa velocidad.
// Así que primero se decide a qué velocidad va cada uno, y de ahí sale el
// número de segundos.
//
// Ahora los dos que llegan recorren 3,18 m repartidos entre `llegada` y
// `huida` —4,4 s, o sea 0,72 m/s— que es el paso de quien se acerca sin
// prisa porque sabe que no hace falta correr. Y el que huye hace 16,5 m en
// 3,6 s, acelerando de cero a 6,2 m/s: eso sí es correr.
//
// La cinemática pasa de 14 a 9,6 segundos. No se acortó por ritmo: se acortó
// porque el relato nuevo no tiene la ida y vuelta que tenía el viejo —llegar,
// llevárselo, retirarse— sino una sola dirección.
const COMPLETA = {
  entrevista: 2.5,
  llegada: 2.8,
  huida: 1.6,
  arranque: 2.0,
  caballito: 0.7,
};

// Versión corta para quien ya la vio: el mismo relato, en poco más de un
// tercio. La huida NO se quita: es la fase que explica por qué corres. Aquí sí
// se anda y se corre más rápido de lo humano, y se acepta: quien la ve es
// alguien que ya vio la larga y lo que quiere es jugar.
const ABREVIADA = {
  entrevista: 0.9,
  llegada: 1.1,
  huida: 0.6,
  arranque: 0.8,
  caballito: 0.3,
};

// Dónde está el entrevistado. El periodista mira hacia -X (ver
// _poseEntrevista), así que su interlocutor va ahí; y como la cámara está en
// +X, los dos salen en cuadro uno detrás de otro en vez de tapándose.
//
// SE ACERCÓ OTRA VEZ, y esta vez por el micrófono. A 1,88 m —donde estaba— el
// periodista extiende el brazo y el micro se queda a medio metro largo de la
// cara del otro: los dos parecen estar hablando cada uno con su pared. Una
// entrevista de calle se hace a un brazo y pico, y el gesto de aguantar el
// micro sólo se lee si el micro llega a alguien. A 1,15 m el puño queda
// justo delante del entrevistado.
//
// Antes de esto ya se había acercado una vez, al meter la cámara dentro del
// pasillo: con el encuadre más frontal, los −2,15 originales lo dejaban medio
// cuerpo fuera por la izquierda.
const SITIO_MINISTRO = { x: -1.05, y: 0, z: 0.48 };

// Dónde se plantan los perseguidores DURANTE la cinemática.
//
// No vale usar su sitio de juego: esa posición está calculada para la cámara
// de carrera, que va DETRÁS del periodista; la de la entrevista está de lado
// y algo por delante, y desde ahí el sitio de carrera cae fuera de cuadro —a
// la espalda del objetivo— o encima del periodista, según la distancia.
//
// ENTRAN POR LA ESQUINA DE ABAJO A LA DERECHA, o sea por el primer término.
// Se barrió el suelo entero en su día buscando un punto que cumpliera tres
// cosas a la vez: la caja entera fuera de cuadro, a más de metro y medio del
// plano de la cámara, y pegada al borde para entrar enseguida. Llegar calle
// arriba —que fue lo primero que se probó— los dejaba entre el 6,7 % y el
// 10,6 % del alto del cuadro: no es que se entendiera mal de dónde salían, es
// que no se veía que saliera nadie.
//
// (5.6, 3.2) queda a 4,2 m de la cámara de entrevista y muy fuera por la
// derecha. Desde ahí caminan 3,18 m hasta el sitio de llegada, que es un
// paseo de 4,4 segundos: los dos primeros de la fase de llegada y todo el
// tiempo que dura la huida. Siguen andando mientras el otro sale corriendo, y
// eso es a propósito —ver la cabecera—.
const SITIO_APARICION = { x: 5.6, z: 3.2 };

// Y dónde se paran: al lado de la entrevista, en el término medio.
//
// AQUÍ NO CABÍAN CUATRO PERSONAS, y esa fue la medida que obligó a mover la
// cámara. Se barrió el suelo entero (4,2 × 9 m, paso de 10 cm) buscando un
// sitio donde los dos que llegan salieran enteros en cuadro, a más de 3,2 m de
// la cámara, entre el 26 % y el 52 % del alto, sin tapar al entrevistado y
// comiéndose menos de la mitad del periodista. CERO candidatos. El cuadro es
// vertical y estrecho —393×852 con FOV 56— y a la profundidad de la entrevista
// el borde derecho del encuadre cae en x ≈ 0,86 m: cualquiera que se acerque
// por la derecha o se sale del cuadro o se pone delante del periodista.
//
// Así que la cámara ABRE mientras ellos llegan (ver CAMARA_LLEGADA), y con el
// plano abierto sí hay sitio. Barriendo cámara y destino a la vez, el mejor
// resultado es este: en el último fotograma de la llegada los cuatro salen en
// fila de izquierda a derecha —entrevistado en −0,92..−0,46, periodista en
// −0,39..0,02, Roy en −0,09..0,61 y el grande en 0,28..0,89— con el
// entrevistado sin tapar y el periodista comido en un 27 % por su lado
// derecho, que es el lado donde no está el micrófono.
const SITIO_LLEGADA = { x: 2.5, z: 2.5 };

// A dónde huye el entrevistado: calle arriba, 16,5 metros.
//
// Se va casi recto por −Z porque es la dirección en la que se corre en la
// partida: quien huye tiene que irse por donde luego vas a ir tú, o la carrera
// no se lee como una persecución. Con la cámara abierta el recorrido entero
// cae dentro del cuadro y la figura pasa del 20 % al 8 % del alto, así que se
// ve marcharse en vez de desaparecer por un borde.
const SITIO_FUGA = { x: -0.45, z: -16 };

// LA HUIDA SE MIDE CON UN RELOJ SOLO, el de las fases de huida y arranque
// juntas, y la curva es un exponente en vez de un suavizado.
//
// Repartirla entre las dos fases con la curva suave de siempre —la que arranca
// despacio y FRENA AL LLEGAR— daba un frenazo en la costura: la huida acababa
// con velocidad cero y el arranque volvía a empezar en cero, así que el hombre
// que va escapando se paraba medio segundo justo en mitad de la carrera. Con
// un exponente por encima de 1 la velocidad solo sube: arranca parado —que es
// lo que hace quien echa a correr desde quieto— y termina a 6,2 m/s.
//
// 1.35 sale de querer las dos cosas a la vez: que en los 1,6 s de la huida
// haya recorrido ya un tercio del camino (5,7 m, o sea que se le ve IRSE, no
// arrancar) y que la punta no pase de una carrera humana.
const CURVA_DE_LA_FUGA = 1.35;

// Hacia dónde miran al aparecer. Se saca del propio camino en vez de escribirlo
// a mano: el primer fotograma de la fase no tiene fotograma anterior del que
// medir el rumbo, así que sin esto la pareja aparecía mirando a donde mirase
// la partida anterior y giraba en el aire durante el primer tercio de segundo.
const RUMBO_LLEGADA = Math.atan2(
  SITIO_LLEGADA.x - SITIO_APARICION.x,
  SITIO_LLEGADA.z - SITIO_APARICION.z,
);

// A partir de qué velocidad se corre en vez de andarse.
//
// El ciclo de andar SE AJUSTA al suelo —su cadencia sale de los metros por
// segundo de verdad, así que el pie se queda quieto sobre el asfalto— y el de
// correr no: su cadencia sale de la curva de la partida. Por eso el umbral
// está alto: mientras se pueda, anda, porque andando no hay deslizamiento.
// Por encima de esto un ciclo de paseo estirado deja de parecer una persona.
const CORRER_DESDE = 2.6;

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

// Y LA MISMA CÁMARA, ABIERTA, para cuando en el plano hay cuatro personas.
//
// No es un plano nuevo: es este mismo retrocedido dos metros SOBRE SU PROPIO
// EJE, subido ochenta centímetros y con la mira corrida a la derecha. Que el
// retroceso vaya por el eje y no por los ejes del mundo es lo que hace que el
// movimiento se lea como abrir el plano y no como cambiar de sitio.
//
// Los tres números salen de un barrido conjunto de cámara y destino (ver
// SITIO_LLEGADA): 2 m es el mínimo retroceso con el que los cuatro caben, y
// mira.x = 0.4 el mínimo paneo. Menos de eso y los que llegan se salen por la
// derecha; más y el entrevistado se acerca al borde izquierdo justo antes de
// tener que salir corriendo.
const CAMARA_LLEGADA = { x: 3.99, y: 3.40, z: 8.11 };

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

// Y a dónde apunta con el plano abierto. Se corre a la derecha porque el
// cuadro tiene que hacer sitio a dos personas más por ese lado; el resultado
// medido es que el entrevistado se queda en el tercio izquierdo en vez de en
// el centro, que es donde tiene que estar alguien que va a salir corriendo.
const MIRA_LLEGADA_X = 0.4;

// Reutilizable, para no crear un vector por fotograma.
const _puntoMano = new THREE.Vector3();
const _donde = new THREE.Vector3();

/** La diferencia entre dos ángulos, por el lado corto. */
function anguloCorto(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * A qué velocidad se está moviendo esto DE VERDAD, en metros por segundo.
 *
 * La cinemática mueve a la gente escribiéndole la posición —interpolaciones
 * entre dos puntos, con suavizados— así que nadie sabe a qué velocidad va
 * nadie. Se saca de la diferencia entre dónde está ahora y dónde estaba en el
 * fotograma anterior, que es la única fuente honesta: si el guion cambia una
 * duración, la cadencia de los pasos se entera sola.
 *
 * Sin esto, los que llegan a llevarse al entrevistado se DESLIZAN: los pies
 * quietos y el cuerpo viajando, que es lo que se veía.
 */
function velocidadDe(objeto, dt) {
  objeto.getWorldPosition(_donde);
  const antes = objeto.userData._dondeEstaba;
  let v = 0;
  if (antes && dt > 0) {
    v = _donde.distanceTo(antes) / dt;
    // Y HACIA DÓNDE. Lo guarda el propio objeto para que quien quiera pueda
    // ponerle la cara donde van los pies.
    if (v > 0.05) objeto.userData._rumbo = Math.atan2(_donde.x - antes.x, _donde.z - antes.z);
  }
  objeto.userData._dondeEstaba = (antes ?? new THREE.Vector3()).copy(_donde);
  // Recorte: el primer fotograma y los saltos de reloj dan velocidades
  // absurdas, y una cadencia absurda es un personaje pedaleando en el sitio.
  return Math.min(6, v);
}

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
   * Coloca al entrevistado.
   *
   * @param {number} fuga 0 = ahí plantado contestando, 1 = ya se perdió calle
   *   arriba. En medio, lo que lleva recorrido de su huida.
   *
   * ANTES ESTO ERA `presencia` Y ERA AL REVÉS: 1 = está, 0 = ya no. El cambio
   * de nombre no es cosmético. Con `presencia` el que se iba no iba a ningún
   * sitio —se deslizaba hacia atrás y a la izquierda y se encogía un 15 % para
   * fingir distancia— porque no se iba por su pie: se lo llevaban. Ahora huye
   * él, o sea que tiene un DESTINO, y la escala no hace falta tocarla: la
   * perspectiva lo encoge sola, del 20 % al 8 % del alto del cuadro.
   */
  _colocarEntrevistado(fuga, tiempo = 0, dt = 1 / 60) {
    const m = this._obtenerMinistro();
    if (!m) return;

    const f = THREE.MathUtils.clamp(fuga, 0, 1);

    // SI EL RELOJ SALTÓ, SE OLVIDA DÓNDE ESTABA. `velocidadDe` mide contra el
    // fotograma anterior, y hay tres sitios donde el anterior no tiene nada
    // que ver con este: volver al menú después de una partida, empezar otra
    // cinemática, y saltársela. En los tres el entrevistado pasa de estar a
    // dieciséis metros calle arriba a estar otra vez delante del micrófono, y
    // sin borrar la memoria ese teletransporte se mide como una carrera: el
    // hombre salía en la portada pedaleando en el sitio y mirando al revés.
    if (Math.abs(f - (this._fugaAnterior ?? f)) > 0.2) delete m.userData._dondeEstaba;
    this._fugaAnterior = f;

    // A 16 metros ya está fuera de la partida; esconderlo antes sería que
    // desapareciera a la vista.
    m.visible = f < 1;
    if (!m.visible) return;

    m.position.set(
      THREE.MathUtils.lerp(SITIO_MINISTRO.x, SITIO_FUGA.x, f),
      SITIO_MINISTRO.y,
      THREE.MathUtils.lerp(SITIO_MINISTRO.z, SITIO_FUGA.z, f),
    );
    m.scale.setScalar(1);

    // MIENTRAS HUYE, CORRE. Antes se deslizaba hacia atrás con la pose de
    // estar de pie puesta, que es la imagen de un maniquí sobre ruedas. Si se
    // está moviendo, se mueve con las piernas; y si está quieto, gesticula.
    if (esGLB(m)) {
      const v = velocidadDe(m, dt);
      let animado = false;
      // Por encima del umbral, el ciclo de correr. Por debajo, el de andar,
      // que sí ajusta la cadencia a los metros por segundo de verdad.
      if (v > CORRER_DESDE) {
        animarCarreraGLB(m, dt, 20);
        animado = true;
      } else if (v > 0.12) {
        animado = animarCaminarGLB(m, dt, v);
      }
      if (animado) {
        // Y SE GIRA HACIA DONDE VA. Sin esto se mueve perfectamente —el pie
        // planta y todo— pero de lado: la cinemática lo arrastra mientras él
        // sigue mirando al periodista, así que sus pasos van en una dirección
        // y su cuerpo en otra. Medido en su día, el pie seguía moviéndose al
        // 99 % de la velocidad del cuerpo, que es deslizarse con estilo.
        //
        // El giro se persigue, no se copia: un cambio de rumbo instantáneo en
        // el primer fotograma en que se mueve es un latigazo. Y aquí ese giro
        // ES la escena: el hombre que estaba contestando de frente da media
        // vuelta en un cuarto de segundo y sale por piernas.
        const rumbo = m.userData._rumbo ?? m.rotation.y;
        m.rotation.y += anguloCorto(rumbo - m.rotation.y) * (1 - Math.exp(-9 * dt));
        return;
      }
      poseMinistroGLB(m, tiempo, 1);
      return;
    }

    const p = m.userData.partes;
    if (p) {
      p.cabeza.rotation.x = Math.sin(tiempo * 1.7) * 0.09 * (1 - f);
      p.torso.rotation.y = Math.sin(tiempo * 0.9) * 0.06 * (1 - f);
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
    // De dónde viene la cámara. Se captura en el primer fotograma de la
    // cinemática (ver actualizar) para fundir hasta el plano de la entrevista
    // en vez de teletransportarse: desde el menú es un paso corto —el vaivén
    // de la portada la deja a medio metro— pero al reintentar desde la primera
    // plana la cámara viene del picado del cerco, y ahí el salto era de
    // cuadro entero.
    this.desdeCamara = null;
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
    this._colocarEntrevistado(0, this.tiempo, dt);
    this._perseguidoresLejos(perseguidor);
  }

  saltar() {
    if (!this.activa) return false;
    this.activa = false;
    // Sin `dt`: esto no es un fotograma de la cinemática, es alguien pulsando
    // para saltársela. Lo único que hace falta es esconder al entrevistado, y
    // esconderlo es mandarlo al final de su huida.
    this._colocarEntrevistado(1, this.tiempo);
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
      // El primer fotograma apunta de dónde viene la cámara; los siguientes
      // funden hacia el plano de la entrevista durante la primera mitad de la
      // fase. Sin este fundido, pulsar JUGAR daba un corte seco de cámara.
      if (!this.desdeCamara) this.desdeCamara = camara.position.clone();
      this._colocarCamara(camara, CAMARA_ENTREVISTA, jugador, 1, MIRA_ENTREVISTA_X);
      const f = this._suave(Math.min(1, t / (g.entrevista * 0.5)));
      if (f < 1) camara.position.lerpVectors(this.desdeCamara, camara.position, f);
      this._poseEntrevista(jugador, this.tiempo);
      this._colocarEntrevistado(0, this.tiempo, dt);
      this._perseguidoresLejos(perseguidor);
      return false;
    }
    t -= g.entrevista;

    // --- Fase 2: se acercan andando ----------------------------------------
    // Aparecen por el primer término, por la derecha, y CAMINAN. No hay prisa
    // ni forcejeo: dos hombres que se acercan a una entrevista de calle. La
    // amenaza está en que se acercan, no en cómo.
    //
    // Mientras tanto la cámara ABRE —retrocede dos metros por su eje y panea a
    // la derecha— porque en el plano cerrado de la entrevista no caben cuatro
    // personas. Ver CAMARA_LLEGADA: eso está medido, no elegido.
    //
    // EL CAMINO NO ACABA AQUÍ: los dos siguen andando durante toda la fase
    // siguiente, y el avance se reparte entre las dos midiendo contra la SUMA
    // de sus duraciones. Esa suma es lo importante y costó una pasada: con el
    // paseo metido en esta fase sola salían a 1,14 m/s —que está bien— pero se
    // PARABAN EN SECO justo cuando el otro sale corriendo, y un frenazo ahí
    // dice «ya llegamos, ya está», que es lo contrario de lo que pasa. Y con
    // un reparto escrito a mano (70/30) el paso se frenaba un 24 % al cruzar
    // de fase. Contra la suma, la velocidad es la misma a los dos lados de la
    // costura pase lo que pase con el guion: 3,18 m en 4,4 s, 0,72 m/s.
    if (t < g.llegada) {
      const f = this._suave(t / g.llegada);
      this._colocarCamara(
        camara,
        this._entreCamaras(CAMARA_ENTREVISTA, CAMARA_LLEGADA, f),
        jugador,
        1,
        THREE.MathUtils.lerp(MIRA_ENTREVISTA_X, MIRA_LLEGADA_X, f),
      );
      this._poseEntrevista(jugador, this.tiempo);
      this._colocarEntrevistado(0, this.tiempo, dt);
      this._caminarLosDos(perseguidor, t / (g.llegada + g.huida), dt);
      return false;
    }
    t -= g.llegada;

    // --- Fase 3: la huida ---------------------------------------------------
    // EL ENTREVISTADO LOS VE Y SE VA. Da media vuelta y sale corriendo calle
    // arriba; los otros dos siguen acercándose al mismo paso de antes, sin
    // inmutarse, y el periodista se queda con el micrófono en alto.
    //
    // Esta es la fase que explica el juego, y por eso la cámara NO se mueve:
    // el plano queda quieto mientras dentro pasa todo. Antes esta misma fase
    // era el plano de hablar con la pared —el micrófono extendido hacia nadie—
    // y sigue siéndolo, con la diferencia de que ahora al final del micrófono
    // hay alguien que se aleja. La frase cambia de «me dejaron con la palabra
    // en la boca» a «se me está yendo», que es una frase que se puede correr.
    if (t < g.huida) {
      this._colocarCamara(camara, CAMARA_LLEGADA, jugador, 1, MIRA_LLEGADA_X);
      this._poseEntrevista(jugador, this.tiempo);
      this._colocarEntrevistado(this._huida(t, g), this.tiempo, dt);
      this._caminarLosDos(perseguidor, (g.llegada + t) / (g.llegada + g.huida), dt);
      return false;
    }
    t -= g.huida;

    // --- Fase 4: el arranque ------------------------------------------------
    // Sales detrás. El micrófono baja, el cuerpo se gira hacia la calle y la
    // cámara vuelve a su sitio de juego; los dos que venían andando pasan a
    // correr y se colocan donde van a ir toda la partida.
    //
    // Los tres movimientos comparten la misma `f`, y eso es lo que hace que el
    // arranque se lea como UNA cosa: no es que la cámara retroceda y además el
    // personaje se gire, es que la escena entera cambia de marcha a la vez.
    if (t < g.arranque) {
      const f = this._suave(t / g.arranque);
      this._colocarCamara(
        camara,
        this._entreCamaras(CAMARA_LLEGADA, CAMARA.POSICION, f),
        jugador,
        1 - f,
        MIRA_LLEGADA_X,
      );
      this._poseEntrevista(jugador, this.tiempo, 1 - f);
      this._colocarEntrevistado(this._huida(g.huida + t, g), this.tiempo, dt);
      // Del sitio de llegada al sitio de carrera, y ya CORRIENDO: se les pasa
      // la velocidad de la partida en vez de la medida, porque lo que están
      // haciendo deja de ser un desplazamiento de cinemática y pasa a ser lo
      // que van a hacer durante todo el juego.
      this._plantarPerseguidores(
        perseguidor,
        THREE.MathUtils.lerp(SITIO_LLEGADA.x, PERSEGUIDOR.DESVIO_EN_PANTALLA * 3.6, f),
        THREE.MathUtils.lerp(SITIO_LLEGADA.z, PERSEGUIDOR.Z_LEJOS, f),
        // Al principio siguen mirando hacia donde andaban; al final, calle
        // arriba como en la partida. El giro se interpola con la misma `f`.
        //
        // POR EL LADO CORTO, y esto no es un detalle: interpolando los ángulos
        // a pelo, de −103° a +180° hay 283 grados, así que los dos daban casi
        // una vuelta entera sobre sí mismos durante el arranque. Por el lado
        // corto son 77 grados en la otra dirección, que es lo que hace alguien
        // que gira para echar a correr.
        RUMBO_LLEGADA + anguloCorto(Math.PI - RUMBO_LLEGADA) * f,
        dt,
        THREE.MathUtils.lerp(1, PERSEGUIDOR.ESCALA_LEJOS, f),
        1,
        true, // corriendo
      );
      this._separados(perseguidor, 1);
      return false;
    }
    t -= g.arranque;

    // --- Fase 5: el caballito ----------------------------------------------
    if (t < g.caballito) {
      const f = this._suave(t / g.caballito);
      this._colocarCamara(camara, CAMARA.POSICION, jugador, 0, MIRA_LLEGADA_X);
      this._colocarEntrevistado(1, this.tiempo, dt);
      this._plantarPerseguidores(
        perseguidor, PERSEGUIDOR.DESVIO_EN_PANTALLA * 3.6, PERSEGUIDOR.Z_LEJOS, Math.PI, dt,
        PERSEGUIDOR.ESCALA_LEJOS, 1 - f, true,
      );
      this._separados(perseguidor, 1 - f);
      return false;
    }

    // --- Fin ---------------------------------------------------------------
    this.activa = false;
    this._separados(perseguidor, 0);
    this._colocarEntrevistado(1, this.tiempo, dt);
    if (this._microfono) this._microfono.visible = false;
    return true;
  }

  // -------------------------------------------------------------------------
  // PIEZAS
  // -------------------------------------------------------------------------

  /**
   * Cuánto lleva recorrido de su huida el entrevistado.
   * @param {number} desdeQueSalio segundos desde el primer fotograma de la huida
   */
  _huida(desdeQueSalio, g) {
    const q = THREE.MathUtils.clamp(desdeQueSalio / (g.huida + g.arranque), 0, 1);
    return q ** CURVA_DE_LA_FUGA;
  }

  /** Curva suave de entrada y salida. */
  _suave(x) {
    const c = THREE.MathUtils.clamp(x, 0, 1);
    return c * c * (3 - 2 * c);
  }

  _colocarCamara(camara, pos, jugador, cercania, miraCercaX = MIRA_ENTREVISTA_X) {
    camara.position.set(pos.x, pos.y, pos.z);
    // Durante la entrevista la cámara mira al periodista; al alejarse va
    // pasando a mirar la pista, que es lo que enseña a dónde se corre.
    //
    // `miraCercaX` es a dónde apunta con `cercania` = 1, y es un parámetro
    // desde que el plano abre para que quepan cuatro: la entrevista apunta a
    // −0,75 y la llegada a +0,4, y el paneo entre las dos ES el movimiento de
    // la fase 2. Con el valor clavado en la constante, abrir el plano dejaba a
    // los que llegaban fuera del cuadro por la derecha.
    const miraZ = THREE.MathUtils.lerp(CAMARA.MIRA.z, -0.1, cercania);
    const miraY = THREE.MathUtils.lerp(CAMARA.MIRA.y, 1.15, cercania);
    const miraX = jugador.x * (1 - cercania) * 0.35 + miraCercaX * cercania;
    camara.lookAt(miraX, miraY, miraZ);
  }

  /** Un punto entre dos cámaras. Evita crear un objeto por fotograma. */
  _entreCamaras(a, b, f) {
    const p = this._camaraInterpolada ?? (this._camaraInterpolada = { x: 0, y: 0, z: 0 });
    p.x = THREE.MathUtils.lerp(a.x, b.x, f);
    p.y = THREE.MathUtils.lerp(a.y, b.y, f);
    p.z = THREE.MathUtils.lerp(a.z, b.z, f);
    return p;
  }

  /**
   * Los dos, andando del sitio de aparición al sitio de llegada.
   * @param {number} avance 0..1 del camino
   */
  _caminarLosDos(perseguidor, avance, dt) {
    this._plantarPerseguidores(
      perseguidor,
      THREE.MathUtils.lerp(SITIO_APARICION.x, SITIO_LLEGADA.x, avance),
      THREE.MathUtils.lerp(SITIO_APARICION.z, SITIO_LLEGADA.z, avance),
      null, // mirando hacia donde andan
      dt,
      // A tamaño real. El 0.72 de ESCALA_LEJOS es un truco de la cámara de
      // carrera —que los mira desde delante y a doce metros— y aquí, con la
      // pareja en el término medio, sólo los haría parecer muñecos.
      1,
      1, // sueltos: llegan andando cada uno por su pie
    );
    this._separados(perseguidor, 1);
  }

  /** Deja el modelo listo para correr, deshaciendo la pose de entrevista. */
  soltarPose(jugador) {
    this._poseEntrevista(jugador, this.tiempo, 0);
    this._colocarEntrevistado(1, this.tiempo);
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
    // Y SE OLVIDA DÓNDE ESTABAN. velocidadDe() mide contra el fotograma
    // anterior, y el fotograma anterior a una aparición es el sitio donde se
    // les escondió: sin borrarlo, el primer paso de la llegada se calcula
    // sobre un teletransporte de diez metros y salen pedaleando.
    delete perseguidor.modelo.userData._dondeEstaba;
    perseguidor.modelo.rotation.y = RUMBO_LLEGADA;
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
  _plantarPerseguidores(perseguidor, x, z, giro = Math.PI, dt = 1 / 60,
                        escala = PERSEGUIDOR.ESCALA_LEJOS, separacion = 1,
                        corriendo = false) {
    perseguidor.modelo.visible = true;
    perseguidor.modelo.position.set(x, 0, z);
    perseguidor.modelo.scale.setScalar(escala);
    perseguidor.zVisualActual = z;
    perseguidor.xVisualActual = x;
    perseguidor.escalaActual = escala;

    // Y ANDAN LO QUE SE LES ESTÉ MOVIENDO. La velocidad no se declara, se mide
    // del propio desplazamiento: si mañana el guion alarga la llegada, los
    // pasos se enteran solos.
    //
    // MENOS CUANDO CORREN. En el arranque el desplazamiento en pantalla es
    // pequeño —van del sitio de llegada al de carrera, dos metros escasos— y
    // sin embargo lo que están haciendo es echar a correr detrás de alguien.
    // Medirlo daría un paseo de 0,9 m/s con el mundo entero arrancando
    // alrededor. Con `corriendo` se les pasa −1, que es como
    // `animarPerseguidores` entiende «corre como en la partida».
    const medida = velocidadDe(perseguidor.modelo, dt);
    const v = corriendo ? -1 : medida;

    // giro === null significa «mira hacia donde andas». Hace falta porque la
    // llegada entra por el primer término: el camino de la aparición al sitio
    // de llegada es una diagonal, y con un giro fijo cruzaban el cuadro de
    // lado, andando hacia un sitio y mirando a otro —el mismo deslizamiento
    // con estilo que ya se había arreglado en el entrevistado—.
    //
    // Se persigue, no se copia: un cambio de rumbo instantáneo en el primer
    // fotograma en que se mueven es un latigazo.
    if (giro === null) {
      const rumbo = perseguidor.modelo.userData._rumbo ?? perseguidor.modelo.rotation.y;
      perseguidor.modelo.rotation.y
        += anguloCorto(rumbo - perseguidor.modelo.rotation.y) * (1 - Math.exp(-9 * dt));
    } else {
      perseguidor.modelo.rotation.y = giro;
    }

    animarPerseguidores(perseguidor.modelo, this.tiempo, dt, v, separacion);
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
