// ============================================================================
// GAME — Orquestador principal
// ============================================================================
// Monta Three.js, corre el bucle y coordina a todos los subsistemas.
// La lógica de cada mecánica vive en su módulo; aquí solo se decide QUÉ se
// actualiza, EN QUÉ ORDEN y CUÁNDO se cambia de estado.
//
// Máquina de estados:
//   menu → jugando ⇄ pausa
//            ↓
//          cerco → escape ─(logrado)→ jugando
//            │        └────(fallado)→ gameover → menu
//            └──────────────────────→ gameover → menu
//
//   jugando → victoria   (trámite perfecto: el final del juego)
//
// LO QUE NO ES UN ESTADO
// La BIFURCACIÓN ocurre dentro de 'jugando': las bocas de túnel vienen hacia
// el jugador y aquella en la que entre decide la temporada, sin parar el juego
// (ver game/Bifurcacion.js).
//
// El TRÁMITE tampoco: es un tramo especial dentro de 'jugando', sin obstáculos
// y sin perseguidores, donde solo se recogen papeles (ver game/Tramite.js).
//
// El CERCO sí es un estado, porque el mundo se detiene: te rodean, y solo
// después aparece la interfaz.
// ============================================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Player } from './Player.js';
import { Track } from './Track.js';
import { ObstacleManager } from './Obstacle.js';
import { CoinManager } from './Coin.js';
import { Chaser } from './Chaser.js';
import { Rutas } from './Rutas.js';
import { Bifurcacion } from './Bifurcacion.js';
import { ElevadoManager } from './Elevado.js';
import { TramiteManager } from './Tramite.js';
import { Cerco } from './Cerco.js';
import { PowerUpManager } from './PowerUps.js';
import { Intro } from './Intro.js';
import { Particulas } from './Particulas.js';

import { crearEscenario } from '../scenes/index.js';
import { TransicionDeAmbiente } from '../scenes/Ambiente.js';
import { cieloDe } from '../utils/entorno.js';
import { obtenerEscenario, ORDEN_ESCENARIOS } from '../config/escenarios.js';
import { RigDeLuces, HUECO } from './Luces.js';
import { CATALOGO_POTENCIADORES } from '../config/balance.js';
import { PERSONAJES } from '../config/personajes.js';
import { Controles } from '../utils/controls.js';
import { curvarEscena } from '../utils/curvatura.js';
import {
  pulsarPeligro, ajustarHaloEvidencia, crearPotenciador, crearObstaculo, BOCACALLE,
} from '../models/props.js';
import { remateCaptura, remateExhausto, citaVerificada } from '../config/textos.js';
import {
  VELOCIDAD, TRAMO, CAMARA, JUGADOR, CARRILES, CERCO, EVIDENCIA,
  POTENCIADORES, SENTENCIAS, TRAMITE, RACHA, tramoRacha,
} from '../config/balance.js';
import { BLOOM, CALIDAD, COLOR3D } from '../config/estilo.js';
import { VigilanteRendimiento } from '../utils/calidad.js';

// Tope de delta time. Si la pestaña estuvo en segundo plano, dt puede valer
// varios segundos; sin este tope el jugador aparecería atravesando obstáculos.
const DT_MAXIMO = 1 / 20;

// A qué distancia del cruce se retira el cartel de la bifurcación. Va por
// debajo de donde termina el despeje de la niebla (55 m): primero se ve el
// edificio entero y un instante después se le quita el cartel de encima.
const DISTANCIA_RETIRAR_SENAL = 50;

// EN QUÉ PUNTO DEL VIRAJE TERMINA DE GIRAR EL MUNDO. Ver _girarMundo(): el
// resto del viraje se corre ya recto por la calle nueva, que es lo que separa
// «doblé una esquina» de «el escenario no termina de asentarse».
const FIN_GIRO_MUNDO = 0.62;

// DÓNDE SE ATRAPA. El punto del que sale el brillo al recoger algo, en
// coordenadas del jugador: 0,65 m por delante y 1,40 de alto.
//
// Estaba en (y + 1.05, z 0.2) y ahí no se veía atrapar nada. El cuerpo del
// jugador ocupa de z −0,35 a +0,35, o sea que 0,2 cae DENTRO: la mitad de las
// chispas nacían dentro del personaje, y como las partículas leen el búfer de
// profundidad, esa mitad no se dibujaba. Lo que quedaba era medio estallido
// asomando por los lados, que se lee como un aura y no como una mano que se
// cierra.
//
// Los dos números salen de proyectar contra la cámara de carrera (0, 4,3, 5,5
// mirando a 0, 0,9, −6, FOV 56 en 393×852) y pedir tres cosas a la vez:
//
//   · POR DELANTE DEL CUERPO con holgura. La cara delantera del jugador está a
//     5,80 m de la cámara; el punto de atrape queda a 5,47, o sea un tercio de
//     metro despejado. Nada lo tapa.
//   · SOBRE EL TORSO EN PANTALLA. En NDC vertical la cadera cae en −0,513 y la
//     cabeza en −0,278; el punto de atrape cae en −0,483, o sea a la altura de
//     las manos. Esto hay que calcularlo y no estimarlo: la cámara mira desde
//     arriba, así que acercar un punto a la cámara lo BAJA en pantalla aunque
//     no cambie de altura. Subir z de 0,2 a 0,65 sin tocar y lo habría dejado
//     a la altura de las rodillas.
//   · A LA ALTURA DE LA MANO. De los puntos que cumplen las dos anteriores,
//     este es el más cercano a donde va la mano de alguien que corre.
const ATRAPE = { y: 1.40, z: 0.65 };

// Y HACIA DÓNDE SALEN LAS CHISPAS: hacia la cámara y un poco arriba, en vez de
// en esfera. Con el estallido pegado al cuerpo, todo lo que salga hacia −Z se
// mete en el personaje y desaparece. Módulo 1, que abre un cono de unos
// noventa grados: sigue habiendo dispersión, solo que empujada hacia fuera.
const SESGO_ATRAPE = { x: 0, y: 0.35, z: 0.95 };

export class Game {
  /**
   * @param {HTMLCanvasElement} lienzo
   * @param {Notebook} cuaderno
   * @param {Audio} audio
   * @param {object} calidad Nivel gráfico detectado (utils/calidad.js)
   */
  constructor(lienzo, cuaderno, audio, calidad = { nivel: 'alta', ...CALIDAD.alta }) {
    this.lienzo = lienzo;
    this.cuaderno = cuaderno;
    this.audio = audio;
    this.calidad = calidad;

    // Si el framerate no llega, baja el nivel gráfico en caliente.
    this.vigilante = new VigilanteRendimiento((nivel) => this._aplicarCalidad(nivel));
    this.vigilante.establecerNivel(calidad.nivel);
    this.vigilante.nivelForzado = !!calidad.forzada;

    // ---- Estado -----------------------------------------------------------
    this.estado = 'menu';
    this.escenarioActual = 'bahia';

    this.velocidad = VELOCIDAD.INICIAL;
    this.velocidadBase = VELOCIDAD.INICIAL;
    this.distanciaTotal = 0;
    this.distanciaTramo = 0;
    this.evidenciaPartida = 0;
    this.pruebasPartida = [];
    this.rutaPartida = [];
    this.combo = 0;
    this.temporizadorCombo = 0;

    // Sacudida de cámara al chocar.
    this.sacudida = 0;

    // Ladeo de cámara en los tramos especiales. Ver _ladeoEspecial().
    this.fuerzaLadeo = 0;
    this.relojLadeo = 0;

    // La foto del arresto. Se saca del propio juego en el momento del cerco y
    // sale al día siguiente en primera plana.
    this.fotoArresto = null;
    this._pedidoDeFoto = false;

    // ¿Estamos en el corredor previo a las bocas de túnel?
    this.enAproximacion = false;
    this.corredorLimpio = false;

    // Potenciadores activos: id → segundos restantes. El salvoconducto no
    // entra aquí porque no caduca; vive como bandera en el jugador.
    this.efectos = new Map();
    this.multiplicadorEvidencia = 1;

    // Cuántas veces te han atrapado en esta partida. No limita los intentos
    // —siempre tienes tu sorteo— pero acelera el selector cada vez.
    this.capturas = 0;
    // Datos del fin de partida, que se calculan al ser capturado pero solo se
    // consumen si el jugador falla el escape.
    this.finPendiente = null;

    // Rotación en curso del mundo al doblar una esquina. Ver _girarMundo().
    this.giroMundo = null;

    // LA MIRA DE LA CÁMARA, SUAVIZADA. Los dos encuadres del juego —carrera y
    // cerco— hacían lookAt directo a objetivos distintos, así que cada cambio
    // de estado giraba la vista EN UN FOTOGRAMA aunque la posición viajara
    // suave: al capturarte y al zafarte, la cámara daba un latigazo. La mira
    // vive aquí y persigue su objetivo con retraso; los saltos de objetivo se
    // convierten en paneos. Ver _mirar().
    this.miraActual = null;
    this._miraObjetivo = new THREE.Vector3();
    // Ventana de recuperación tras zafarse del cerco: la cámara vuelve a su
    // encuadre de carrera despacio en vez de al ritmo de juego.
    this.recuperacionCamara = 0;
    // Fogonazo del portazo al salir del trámite. Ver _resumirInstitucion.
    this.destelloPortazo = 0;

    // BARRIOS YA CONSTRUIDOS, aparcados fuera del grafo. Construir un
    // escenario cuesta 380-680 ms en un solo fotograma (medido); con esta
    // caché solo se paga la primera visita, y esa se adelanta al corredor
    // vacío de la bifurcación. Ver _cambiarEscenario y _prepararBarrio.
    this.escenariosVivos = new Map();
    // Segundo destino pendiente de preconstruir durante la aproximación.
    this.barrioPorPreparar = null;

    // Callbacks hacia la UI. Los rellena main.js.
    this.alCambiarEstado = () => {};
    this.alActualizarHUD = () => {};
    /** Baja el cartel de salida con los tres destinos. */
    this.alSeñalizar = () => {};
    /** Remata el panel del expediente al salir del pasillo. */
    this.alCerrarExpediente = () => {};
    // ¿Ya se quitó el cartel de esta bifurcación? Se retira solo al acercarse
    // (ver la actualización), no al cruzar.
    this.senalRetirada = false;
    /** Lo vuelve a subir. */
    this.alQuitarSenal = () => {};

    this._configurarThree();
    this._configurarSubsistemas();
    this._configurarControles();
    this._configurarRedimension();

    this.relojAnterior = performance.now();
    this.animando = false;
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  _configurarThree() {
    this.escenaThree = new THREE.Scene();

    // EL APAREJO DE LUCES, ANTES QUE NADA Y PARA SIEMPRE. Ver game/Luces.js: el
    // recuento de luces entra en las macros del sombreador, así que añadir o
    // quitar una recompila TODOS los materiales de la escena. Se crean aquí
    // todas las que va a haber nunca, colgadas de la escena y no del barrio
    // —que se descuelga al cruzar—, y a partir de ahí sólo se encienden y se
    // apagan.
    this.luces = new RigDeLuces(this.escenaThree);
    // Colgado de la escena para que lo alcancen los escenarios, que reciben la
    // escena pero no el juego.
    this.escenaThree.userData.rig = this.luces;

    this.camara = new THREE.PerspectiveCamera(
      CAMARA.FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
    this.camara.position.set(CAMARA.POSICION.x, CAMARA.POSICION.y, CAMARA.POSICION.z);
    this.camara.lookAt(CAMARA.MIRA.x, CAMARA.MIRA.y, CAMARA.MIRA.z);
    this._ajustarEncuadre();

    this.renderizador = new THREE.WebGLRenderer({
      canvas: this.lienzo,
      // Con bloom activo el antialias del contexto no se aplica (se pinta a
      // un buffer intermedio), así que solo lo pedimos cuando no hay bloom.
      antialias: !this.calidad.bloom && window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
      // SOLO CON ?foto=1: conservar el búfer para poder fotografiarlo.
      //
      // Sin esto, el navegador limpia el lienzo en cuanto lo presenta, y
      // cualquier captura —la de Playwright incluida— devuelve el último
      // fotograma compositado, que dentro de una misma sesión se queda
      // congelado o sale partido por la mitad. Verificar un cambio de
      // iluminación mirando capturas rotas es peor que no mirarlas.
      //
      // Va detrás de un parámetro de URL y no de `import.meta.env.DEV` por dos
      // motivos: cuesta rendimiento —obliga a copiar el búfer en cada
      // presentación— así que tampoco se quiere encendido mientras se
      // desarrolla, y además permite fotografiar una compilación de producción
      // si alguna vez hace falta comprobar algo que solo pasa ahí.
      preserveDrawingBuffer: new URLSearchParams(location.search).has('foto'),
    });
    this.renderizador.setSize(window.innerWidth, window.innerHeight);
    this.renderizador.setPixelRatio(
      Math.min(window.devicePixelRatio, this.calidad.pixelRatioMaximo),
    );
    // Las sombras son el mayor coste del pipeline y con esta estética no
    // aportan: el volumen lo da el flatShading y el contraste de la niebla.
    this.renderizador.shadowMap.enabled = false;

    // NEUTRAL, QUE ES LA TERCERA OPCIÓN Y LA QUE ESTE JUEGO NECESITA.
    //
    // Aquí estaba Cineon, y estaba por un buen motivo: ACES es una curva de
    // cine que le quita saturación a todo el tramo medio a propósito, y en una
    // paleta de colores planos eso deja un toldo naranja en naranja terroso y
    // un cielo azul en gris azulado. Todo eso sigue siendo verdad.
    //
    // Lo que pasa es que Cineon tampoco es de aquí: es la curva de la película
    // Kodak escaneada, y también apaga —menos, pero apaga—. Y encima levanta
    // los negros, que es de donde venía esa neblina lechosa en las sombras.
    //
    // `NeutralToneMapping` es el mapeo PBR Neutral de Khronos, y lo hicieron
    // exactamente para este problema: mantener el TONO y la SATURACIÓN clavados
    // hasta bien arriba, y comprimir solo lo que de verdad se iba a quemar. Un
    // color de la paleta sale a pantalla siendo ese color, no una versión
    // cansada. Es el que usan los configuradores de producto, que es el mismo
    // requisito que tiene un juego de colores planos: que el rojo sea el rojo.
    this.renderizador.toneMapping = THREE.NeutralToneMapping;
    // 1.45. Con Neutral ya no hay que compensar el apagado del medio, así que
    // la exposición pasa de arreglar un problema a hacer lo suyo: dar la hora
    // del día. Un mediodía guayaquileño en un mundo de caramelo es este.
    this.renderizador.toneMappingExposure = 1.2;

    this._configurarPostproceso();
  }

  /**
   * Ajusta el FOV vertical para garantizar un ancho mínimo visible.
   *
   * Three.js fija el FOV VERTICAL y deriva el horizontal del aspecto, así que
   * en un móvil en vertical (aspecto ~0.46) el ancho se queda en menos de la
   * mitad y los carriles exteriores se salen de pantalla justo a la altura del
   * jugador. Para un juego que es primero móvil eso no es un detalle de
   * encuadre, es que no ves dónde corres.
   *
   * Abrimos el FOV vertical lo justo para cumplir el ancho mínimo. En
   * pantallas anchas la fórmula da menos que el FOV de diseño y no se toca
   * nada, que es lo que se quiere: en escritorio manda la composición.
   */
  _ajustarEncuadre() {
    const aspecto = Math.max(0.2, this.camara.aspect);
    const verticalPara = (semianguloEnGrados) => THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(semianguloEnGrados)) / aspecto),
    );

    // Suelo: abrir lo justo si la pantalla es tan alta que estrecha el ancho.
    let fov = Math.max(CAMARA.FOV, verticalPara(CAMARA.SEMIANGULO_HORIZONTAL));
    // Techo: cerrar si la pantalla es tan ancha que el gran angular se
    // convierte en ojo de pez. En vertical este límite queda muy por encima y
    // no toca nada; en escritorio es el que manda.
    fov = Math.min(fov, verticalPara(CAMARA.SEMIANGULO_HORIZONTAL_MAXIMO));

    // Y UN SUELO AL PROPIO VERTICAL, que es el que faltaba y por eso en
    // apaisado el personaje corría sin pies.
    //
    // El techo de arriba cierra el vertical según lo ancha que sea la pantalla,
    // y en un móvil tumbado —aspecto 2,16— lo cerraba a 45,18°: medido, los
    // pies caían en 1,044, o sea por debajo del borde inferior. Es el mismo
    // fallo que en escritorio, sólo que allí se arregló ensanchando el techo y
    // aquí no basta, porque el aspecto es todavía más ancho.
    //
    // 52° es lo que hace falta: deja los pies en 0,971 a aspecto 2,16 y no
    // toca nada en 16:9 (que pide 53,72) ni en vertical (56). Se paga con 93°
    // horizontales en el formato más ancho —más de lo que a esta cámara le
    // gusta— y es un precio que se paga sin discutir: ver por dónde corres es
    // información de juego, que el borde del cuadro se estire no lo es.
    fov = Math.max(fov, CAMARA.FOV_MINIMO);

    // Este es el SUELO, no el valor final: encima se le suma el empuje de la
    // velocidad (ver _empujarFov). Guardarlo aparte es lo que hace que las
    // cotas de este método —el ancho mínimo, el techo de ojo de pez, el suelo
    // vertical— sigan protegiendo aunque el angular se abra al correr.
    this.fovBase = fov;
    this._aplicarFov();
  }

  /** Escribe el FOV de verdad: el suelo del encuadre más el empuje. */
  _aplicarFov() {
    // El suelo lo pone `_ajustarEncuadre`, que corre en el constructor y en
    // cada redimensionado. La guarda es por si algún día alguien mueve el
    // orden: sin ella, un `undefined + 0` deja el FOV en NaN y la escena
    // desaparece entera, que es un fallo caro de diagnosticar por lo mudo.
    if (!this.fovBase) return;
    const fov = this.fovBase + (this.empujeFov ?? 0);
    // Solo se toca la matriz si el valor CAMBIÓ de verdad. `updateProjectionMatrix`
    // es barato pero no gratis, y con el suavizado lento del empuje la mayoría
    // de los fotogramas piden el mismo grado que el anterior: una centésima de
    // grado es el umbral por debajo del cual nadie ve nada.
    if (Math.abs(fov - (this.camara.fov ?? 0)) < 0.01) return;
    this.camara.fov = fov;
    this.camara.updateProjectionMatrix();
  }

  /**
   * Abre el angular con la velocidad, y lo cierra al parar.
   *
   * Ver CAMARA.EMPUJE_FOV para el porqué de los tres grados. Aquí solo queda
   * decir por qué el objetivo es cero fuera de la carrera: la cinemática, el
   * menú y el cerco tienen sus encuadres MEDIDOS a FOV 56 —el sitio de llegada
   * de los perseguidores, el corro de policías, el punto de atrape— y un
   * angular abierto los descuadraría todos. La velocidad no se pone a cero al
   * capturar, así que sin esta condición el cerco se vería con el angular de
   * la carrera.
   */
  _empujarFov(dt) {
    const enCarrera = this.estado === 'jugando';
    const t = enCarrera
      ? THREE.MathUtils.clamp(
        (this.velocidad - VELOCIDAD.INICIAL) / (VELOCIDAD.MAXIMA - VELOCIDAD.INICIAL), 0, 1,
      )
      : 0;
    const objetivo = t * CAMARA.EMPUJE_FOV;
    const k = 1 - Math.exp(-dt / CAMARA.EMPUJE_FOV_SUAVIZADO);
    this.empujeFov = (this.empujeFov ?? 0) + (objetivo - (this.empujeFov ?? 0)) * k;
    this._aplicarFov();
  }

  /**
   * Cadena de post-procesado. El bloom es lo que convierte los materiales
   * emisivos planos en neón de verdad: sin él, un cartel "encendido" es solo
   * un rectángulo de color.
   *
   * Es también el efecto más caro del pipeline, así que en calidad baja se
   * omite entero y se pinta directo a pantalla.
   */
  _configurarPostproceso() {
    if (!this.calidad.bloom) {
      this.compositor = null;
      return;
    }

    this.compositor = new EffectComposer(this.renderizador);
    this.compositor.setSize(window.innerWidth, window.innerHeight);
    this.compositor.setPixelRatio(
      Math.min(window.devicePixelRatio, this.calidad.pixelRatioMaximo),
    );

    this.compositor.addPass(new RenderPass(this.escenaThree, this.camara));

    // El umbral alto es deliberado: solo debe brillar lo que emite luz.
    // Si se baja, el asfalto se lava y se pierde el contraste que hace
    // legibles los obstáculos.
    this.pasadaBloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      BLOOM.intensidad,
      BLOOM.radio,
      BLOOM.umbral,
    );
    this.compositor.addPass(this.pasadaBloom);

    // OutputPass aplica tonemapping y conversión de espacio de color al final
    // de la cadena. Sin él, los colores salen lavados respecto al render directo.
    this.compositor.addPass(new OutputPass());
  }

  /**
   * Cambia el nivel gráfico en caliente. Lo llama el vigilante cuando el
   * framerate no llega.
   */
  _aplicarCalidad(nivel) {
    this.calidad = { nivel, ...CALIDAD[nivel] };

    // Los barrios aparcados se construyeron con el detalle de ANTES: se
    // tiran, y la próxima visita los reconstruye al nivel nuevo. El activo se
    // queda como está —igual que siempre: la calidad aplica a lo que se
    // construya a partir de ahora—.
    if (this.escenariosVivos) {
      for (const [clave, esc] of this.escenariosVivos) {
        if (esc !== this.escenario) {
          esc.destruir();
          this.escenariosVivos.delete(clave);
        }
      }
    }
    this.barrioPorPreparar = null;

    // El cruce del cielo cuesta un prefiltrado por paso: si el vigilante acaba
    // de bajar de nivel es porque el fotograma no llega, y ése es el primer
    // gasto opcional que sobra. En baja se queda en cero (un solo cambio de
    // cielo al final del fundido). Ver estilo.js/pasosCieloTransito.
    if (this.ambiente) this.ambiente.pasosCielo = this.calidad.pasosCieloTransito ?? 0;

    this.renderizador.setPixelRatio(
      Math.min(window.devicePixelRatio, this.calidad.pixelRatioMaximo),
    );

    if (!this.calidad.bloom && this.compositor) {
      // Soltamos los buffers del compositor: son varios render targets a
      // resolución de pantalla y liberarlos se nota en memoria de GPU.
      this.compositor.dispose?.();
      this.compositor = null;
    }
  }

  _configurarSubsistemas() {
    this.pista = new Track(this.escenaThree);
    this.jugador = new Player(this.escenaThree, this.cuaderno.personajePreferido);
    this.obstaculos = new ObstacleManager(this.escenaThree);
    this.evidencia = new CoinManager(this.escenaThree, this.camara);
    this.perseguidor = new Chaser(this.escenaThree);
    this.rutas = new Rutas();
    this.bifurcacion = new Bifurcacion(this.escenaThree);
    this.elevado = new ElevadoManager(this.escenaThree);
    this.tramite = new TramiteManager(this.escenaThree);
    this.cerco = new Cerco(this.escenaThree);
    this.intro = new Intro(this.escenaThree);
    this.potenciadores = new PowerUpManager(this.escenaThree, this.camara);
    this.potenciadores.establecerDesbloqueados(this.cuaderno.potenciadoresDesbloqueados());

    // Las chispas cuelgan de la RAÍZ de la escena, no del grupo del escenario:
    // ese grupo se destruye entero al cambiar de temporada y se llevaría por
    // delante el pozo. Aquí sobreviven a los cambios de escena.
    // El halo de los papeles se decide AQUÍ y no en props.js, porque tiene que
    // estar puesto antes de que se cree la primera pieza: `crearEvidencia`
    // añade el sprite al construir la malla, y el pool no vuelve a pasar por
    // ahí. Va junto a las partículas porque es la misma decisión —cuánto se
    // puede permitir este aparato— tomada en el mismo sitio.
    ajustarHaloEvidencia(this.calidad.halosEvidencia !== false);

    this.particulas = new Particulas(
      this.escenaThree,
      this.calidad.particulas ? (this.calidad.pozoParticulas ?? 320) : 0,
    );
    this.particulas.redimensionar(window.innerHeight);
    // Resto fraccionario de la estela: emitir `Math.round(0.4)` partículas por
    // fotograma es emitir cero para siempre.
    this.restoEstela = 0;

    // EL VIAJE DE LA LUZ ENTRE BARRIOS. Se construye antes del primer
    // _cambiarEscenario porque ése ya lo usa: con this.escenario a null es el
    // caso base y planta la paleta entera de golpe, que es lo correcto —no hay
    // barrio anterior del que venir—. Ver scenes/Ambiente.js.
    this.ambiente = new TransicionDeAmbiente(
      this.escenaThree, this.renderizador, this.calidad,
    );

    this.escenario = null;
    // El fondo del menú es la temporada en la que se va a retomar, no siempre
    // la Bahía. Así la portada dice a dónde vas antes de que pulses nada.
    this._cambiarEscenario(this.cuaderno.ultimoEscenario, false);

    // Y EN CUANTO LA PORTADA ESTÉ PINTADA, A PRECALENTAR. Ver _precalentar().
    requestAnimationFrame(() => { this._precalentar(); });
  }

  _configurarControles() {
    this.controles = new Controles();

    this.controles
      .on('izquierda', () => {
        if (this.estado !== 'jugando') return;
        if (this.jugador.moverIzquierda()) this.audio.cambioCarril();
      })
      .on('derecha', () => {
        if (this.estado !== 'jugando') return;
        if (this.jugador.moverDerecha()) this.audio.cambioCarril();
      })
      .on('saltar', () => {
        if (this.estado !== 'jugando') return;
        if (this.jugador.saltar()) this.audio.saltar();
      })
      .on('agachar', () => {
        if (this.estado !== 'jugando') return;
        if (this.jugador.agachar()) this.audio.agachar();
      })
      .on('pausa', () => {
        if (this.estado === 'jugando') this.pausar();
        else if (this.estado === 'pausa') this.reanudar();
      });
  }

  _configurarRedimension() {
    // Debounce: en móvil, girar el dispositivo dispara decenas de eventos.
    let temporizador = null;
    const redimensionar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const ancho = window.innerWidth;
        const alto = window.innerHeight;
        this.camara.aspect = ancho / alto;
        this._ajustarEncuadre();
        this.renderizador.setSize(ancho, alto);
        this.renderizador.setPixelRatio(
          Math.min(window.devicePixelRatio, this.calidad.pixelRatioMaximo),
        );

        // El compositor tiene sus propios render targets: si no se
        // redimensionan, la imagen sale estirada tras girar el móvil.
        this.compositor?.setSize(ancho, alto);
        this.pasadaBloom?.setSize(ancho, alto);
        // El tamaño de las chispas se calcula en píxeles a partir de la altura
        // del lienzo: sin esto, al girar el móvil salen del tamaño equivocado.
        this.particulas?.redimensionar(alto);
      }, 120);
    };

    window.addEventListener('resize', redimensionar);
    window.addEventListener('orientationchange', redimensionar);
  }

  // -------------------------------------------------------------------------
  // ESCENARIOS
  // -------------------------------------------------------------------------

  /**
   * Llena la pista de obstáculos y papeles antes de que el jugador empiece a
   * correr. Sin esto la pista arrancaría vacía y habría que esperar a que los
   * primeros objetos, generados a 220 unidades, llegaran hasta el jugador.
   */
  /**
   * @param {number} [segundosCiegos] Lo que el jugador va a tardar en poder
   *   VER esta pista: lo que le queda de cinemática de giro, con su polvo y su
   *   destello. Ver Obstacle.precargar().
   */
  _precargarPista(segundosCiegos = 0) {
    this.obstaculos.precargar(this.velocidad, (carrilesLibres, z, gap) => {
      this.evidencia.generarHilera(carrilesLibres, z, gap, Math.random() < 0.33);
    }, segundosCiegos);
  }

  /**
   * Cuánto le queda al jugador de no ver nada.
   *
   * Es lo que resta de la cinemática del giro. Al doblar por un costado la
   * cámara rota, el polvo se levanta y el destello pasa por encima: durante
   * esos dos segundos largos la calle nueva está delante pero no se lee. Poner
   * ahí el primer obstáculo es ponerlo donde nadie puede verlo.
   */
  _cegueraRestante() {
    if (!this.bifurcacion?.virando) return 0;
    const total = this.bifurcacion.duracionActual ?? 0;
    return Math.max(0, total - this.bifurcacion.tiempoViraje);
  }

  /**
   * Reparte el contenido de un grupo recién generado entre papeles y
   * potenciadores.
   *
   * La regla que importa: los ítems NUNCA van en el carril que se llevó la
   * hilera de papeles. Una hilera es una fila opaca de ocho piezas; lo que
   * quede detrás en ese carril no se ve hasta que ya es tarde para cambiarse,
   * y el jugador acaba pasándose de largo el potenciador sin haberlo visto.
   */
  _poblarGrupo(grupo) {
    if (!grupo) return;

    // La hilera va en arco (sobre un salto) una de cada tres veces.
    // La hilera puede cruzar de carril (ver Coin.generarHilera), así que lo
    // que devuelve no es un carril sino con qué preguntarle qué tapa y dónde.
    const carrilesEvidencia = this.evidencia.generarHilera(
      grupo.carrilesLibres,
      grupo.z,
      grupo.gap,
      Math.random() < 0.33,
    );

    // Lo único que se ofrece en el hueco es un potenciador. Antes competía
    // con la comida, y la comida se fue: ver CATALOGO_POTENCIADORES.
    const zHueco = grupo.z - grupo.gap / 2;

    // SE LE PREGUNTA A LA HILERA QUÉ TAPA AQUÍ, no qué carriles usó en total.
    // Con hileras rectas daba igual, pero una que cruza toca dos carriles y
    // excluirlos los dos deja sin sitio al potenciador en el caso más común
    // —un obstáculo bloquea un carril, quedan dos libres—, o sea que cruzar
    // habría costado casi todos los potenciadores del juego.
    const tapado = carrilesEvidencia.carrilEn(zHueco);
    const libres = grupo.carrilesLibres.filter((c) => c !== tapado);
    if (libres.length === 0) return;

    this.potenciadores.intentarGenerar(libres, zHueco);
  }

  /**
   * Cambia de escenario, aplicando su paleta a todos los subsistemas.
   * @param {string} id
   * @param {boolean} anunciar ¿Mostrar el cartel del escenario?
   */
  _cambiarEscenario(id, anunciar = true) {
    // EL BARRIO VIEJO SE APARCA, NO SE TIRA. Y el nuevo, si ya se visitó —o
    // se preconstruyó en la aproximación—, se descuelga de la caché en menos
    // de un milisegundo. Es el arreglo del congelón de las esquinas: el
    // destruir/crear de antes costaba medio segundo EN EL FOTOGRAMA DEL
    // CRUCE, o sea justo cuando arranca el giro. Ver BaseScene.suspender().
    // Y EL RETRATO DE LO QUE HAY EN PANTALLA, tomado justo antes de descolgar
    // nada: es el punto de partida del fundido de ambiente. Después de
    // suspender() ya no se puede leer, porque la niebla y el fondo son
    // GLOBALES de la escena Three y suspender() se los lleva consigo.
    //
    // Es la foto de lo VIVO, no de la paleta: si se cruza con el despeje de la
    // bifurcación abierto, lo que había era una calle sin niebla y con la luz
    // subida, y de ahí tiene que salir el fundido. Ver scenes/Ambiente.js.
    const anterior = this.escenario;
    const retrato = anterior ? anterior.retrato() : null;
    if (anterior) anterior.suspender();

    this.escenarioActual = id;
    const clave = `${id}|${this.calidad.nivel}`;
    const guardado = this.escenariosVivos.get(clave);
    if (guardado) {
      this.escenario = guardado;
      guardado.reanudar();
    } else {
      this.escenario = crearEscenario(id, this.escenaThree, this.calidad);
      this.escenariosVivos.set(clave, this.escenario);
    }
    // Y SE REMATA LO QUE LE FALTE. El decorado se construye a plazos mientras
    // el barrio está aparcado (ver BaseScene.construirPendientes), así que al
    // enseñarlo hay que terminar lo que quede: cruzar a una calle a medio
    // construir sería peor que el tirón que esto viene a quitar. Si la
    // aproximación hizo su trabajo, aquí no queda nada y no cuesta nada.
    this.escenario.rematarDecorado();

    const config = obtenerEscenario(id);
    const colores = this.escenario.obtenerColores();

    // EL CIELO DEL BARRIO, para que las cosas tengan algo que reflejar.
    //
    // Sin `environment`, la mitad especular de cada material vale cero y el
    // mundo sale mate por muchos focos que se le pongan: un cubo con cinco
    // luces sigue siendo un cubo mate. Con el cielo puesto, cada canto
    // biselado recoge un reflejo alargado y eso es lo que se lee como volumen.
    //
    // Se genera una vez por barrio y se guarda, así que cruzar la bifurcación
    // de ida y vuelta no vuelve a pagarlo. Ver utils/entorno.js.
    const cielo = cieloDe(this.renderizador, id, colores);

    // Y LA LUZ NO SE PLANTA: VIAJA.
    //
    // Las cinco luces, la niebla, el fondo, el cielo y su intensidad salen del
    // estado que había en pantalla al cruzar y tardan dos segundos en llegar al
    // de aquí. Entrar al Apagón deja de ser un corte a negro —medido: −82 % de
    // brillo en un fotograma— y pasa a ser lo que dice el nombre del barrio.
    //
    // Si no hay de dónde venir (arranque en frío) o si el barrio es el mismo
    // que ya estaba puesto (volver a jugar desde la portada), se planta entero
    // en este fotograma: es el caso base. Ver scenes/Ambiente.js.
    this.ambiente.arrancar(
      this.escenario === anterior ? null : retrato,
      this.escenario,
      cielo,
    );

    this.pista.aplicarTema(colores);
    this.obstaculos.aplicarTema(colores, id);
    this.evidencia.aplicarTema(config);
    this.elevado.aplicarTema(colores, id);

    this.rutaPartida.push(id);
    this.distanciaTramo = 0;

    // aplicarTema() vació la pista (los obstáculos tenían los colores viejos),
    // así que hay que volver a llenarla con la paleta nueva.
    //
    // Y CONTANDO LO QUE FALTA DE GIRO. A este método se llega desde la
    // bifurcación con la cinemática recién arrancada: el primer grupo caía a
    // 45 metros —un segundo y cuarto a velocidad alta— mientras la cámara
    // seguía doblando la esquina entre polvo y destello. El jugador se comía el
    // primer obstáculo de cada tramo nuevo sin haberlo visto nunca.
    this._precargarPista(this._cegueraRestante());

    // Qué potenciadores pueden salir aquí. La linterna es del Apagón y en las
    // otras tres no significaría nada, porque hay luz.
    this.potenciadores.establecerEscenario(id);

    // El Apagón arranca CON la linterna encendida. No es un mimo: entrar a
    // oscuras y esperar a que el generador suelte la primera cápsula no era
    // difícil, era injugable. Lo que sostiene el tramo cuando se apaga son los
    // papeles, que aquí brillan (ver Coin.aplicarTema).
    if (config.linternaAlEntrar) {
      this.escenario.encenderLinterna?.();
    }

    if (anunciar) {
      this.audio.cambioEscenario();
    }
  }

  // -------------------------------------------------------------------------
  // CICLO DE PARTIDA
  // -------------------------------------------------------------------------

  /** Empieza una partida nueva. */
  iniciarPartida(personaje = null) {
    if (personaje && personaje !== this.cuaderno.personajePreferido) {
      this.cuaderno.personajePreferido = personaje;
      this.jugador.cambiarPersonaje(personaje);
    }

    this.velocidad = VELOCIDAD.INICIAL;
    this.velocidadBase = VELOCIDAD.INICIAL;
    this.distanciaTotal = 0;
    this.distanciaTramo = 0;
    this.evidenciaPartida = 0;
    this.pruebasPartida = [];
    this.rutaPartida = [];
    this.combo = 0;
    this.temporizadorCombo = 0;
    this.sacudida = 0;
    this.enAproximacion = false;
    this.corredorLimpio = false;
    this.capturas = 0;
    this.finPendiente = null;

    this.jugador.reiniciar();
    this.bifurcacion.reiniciar();
    this._asentarGiroMundo();
    this.obstaculos.reiniciar();
    this.evidencia.reiniciar();
    this.perseguidor.reiniciar();
    this.elevado.reiniciar();
    this.tramite.limpiar();
    this.cerco.limpiar();
    this.potenciadores.reiniciar();
    this.potenciadores.establecerDesbloqueados(this.cuaderno.potenciadoresDesbloqueados());
    this._limpiarEfectos();

    // CONTINUIDAD: se retoma en la temporada donde te capturaron, no siempre
    // en la Bahía. Volver al principio cada vez convertía cada muerte en un
    // reinicio del relato en vez de en un capítulo.
    this._cambiarEscenario(this.cuaderno.ultimoEscenario, false);

    // Y EN CUANTO LA PORTADA ESTÉ PINTADA, A PRECALENTAR. Ver _precalentar().
    requestAnimationFrame(() => { this._precalentar(); });

    // La cinemática explica POR QUÉ corres: estabas entrevistando y te
    // interrumpieron. Se ve entera las dos primeras partidas y abreviada
    // después; un toque la corta siempre.
    this.intro.iniciar(this.cuaderno.partidasJugadas >= 2);
    this._establecerEstado('intro');
    this.iniciarBucle();
  }

  /** Corta la cinemática y arranca la corrida de verdad. */
  arrancarCorrida() {
    if (this.estado !== 'intro') return;

    // La mira suavizada arranca de cero: viene de donde la dejó la intro y no
    // debe arrastrar un paneo desde el encuadre del menú.
    this.miraActual = null;

    this.intro.saltar();
    this.jugador.reiniciar();
    this.intro.soltarPose(this.jugador);
    this.perseguidor.modelo.visible = true;

    const config = obtenerEscenario(this.escenarioActual);
    this.audio.cambioEscenario();

    this.controles.activar();
    // EL ZUMBIDO DEL PERSEGUIDOR. Es lo único que puede acabar la partida y
    // hasta ahora solo se veía en una barra del HUD; ahora también se oye, y
    // crece desde lejos. Se arranca AQUÍ y no al pulsar JUGAR: durante la
    // cinemática todavía no te persigue nadie.
    this.audio.arrancarTension();
    this.relojAnterior = performance.now();
    this._establecerEstado('jugando');
  }

  pausar() {
    if (this.estado !== 'jugando') return;
    // El zumbido se calla en la pausa. Con el juego parado sigue siendo cierto
    // que los tienes encima, pero un zumbido de amenaza debajo de un menú de
    // ajustes no dice nada: dice que algo va mal con el sonido.
    this.audio.actualizarTension(0);
    this._establecerEstado('pausa');
  }

  reanudar() {
    if (this.estado !== 'pausa') return;
    // Reseteamos el reloj para que el tiempo en pausa no cuente como dt.
    this.relojAnterior = performance.now();
    this._establecerEstado('jugando');
  }

  /**
   * ABANDONAR LA CORRIDA. Es lo que hace el botón de la pausa, y NO es que te
   * atrapen.
   *
   * Llamaba a `terminarPartida('captura')`, que es la ruta de la captura
   * entera: el cerco cerrándose, el sorteo del juez y la primera plana con tu
   * foto de arresto. O sea que retirarse a la portada te montaba un juicio.
   * Además de raro, contradice lo que significa cada cosa: el sorteo del juez
   * es la OPORTUNIDAD de seguir corriendo después de que te agarren, y a quien
   * se va por su pie no hay que agarrarlo ni darle una oportunidad de nada.
   *
   * LO RECOGIDO SE QUEDA, igual que al ser capturado. Es la regla de la casa
   * —«recógelas aunque te capturen»— y sin ella abandonar sería PEOR que caer
   * preso: perderías los papeles y las pruebas de la corrida por retirarte.
   * Así que la partida se cierra en el cuaderno como cualquier otra y solo
   * después se vuelve a la portada.
   *
   * No hay atajo que explotar: quien abandona renuncia justo a lo que da el
   * cerco, que es la posibilidad de seguir.
   */
  abandonarPartida() {
    if (this.estado !== 'pausa' && this.estado !== 'jugando') return;

    this.controles.desactivar();
    this.audio.pararTension();
    this.bifurcacion.abortarViraje();
    this.jugador.giroCinematico = 0;
    this._asentarGiroMundo();
    this._limpiarEfectos();

    const puntaje = this.evidenciaPartida + Math.floor(this.distanciaTotal / 10);
    this.cuaderno.ultimoEscenario = this.escenarioActual;
    this._cerrarEnCuaderno({
      papeles: this.evidenciaPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      pruebas: this.pruebasPartida,
      ruta: [...this.rutaPartida],
    });

    this.volverAlMenu();
  }

  /**
   * Te alcanzaron. Esto NO abre la pantalla de fin de partida: arranca el
   * cerco, que es la representación de lo que acaba de pasar. El resultado se
   * calcula ya (para no recalcularlo dos veces) pero se queda en espera hasta
   * que el jugador falle el medidor de escape.
   *
   * @param {'captura'|'exhausto'|'cerco'} motivo
   * @param {string} [textoPersonalizado]
   */
  terminarPartida(motivo, textoPersonalizado = null) {
    if (this.estado === 'gameover' || this.estado === 'cerco' || this.estado === 'escape') return;

    // Si la captura pilla un viraje a medias, se corta aquí: el viraje solo
    // avanza jugando, así que quedaba congelado y su destello reaparecía de la
    // nada al reanudar tras el escape. El giro del personaje, igual.
    this.bifurcacion.abortarViraje();
    this.jugador.giroCinematico = 0;
    // El giro del mundo NO se asienta de golpe: si te capturan en plena
    // esquina, enderezar la calle en un fotograma es un teletransporte del
    // decorado justo cuando la cámara se está abriendo al corro. Se desvanece
    // durante el cerco (ver _actualizarCerco) y, si algo quedara, el arranque
    // del tramo siguiente lo asienta igual que siempre.

    this.jugador.caer();
    this._limpiarEfectos();
    this.fotoArresto = null;
    this.perseguidor.atrapar();
    this.controles.desactivar();
    // El zumbido se para ANTES del sonido de captura: si sigue sonando por
    // debajo, el corro se cierra sobre una nota que ya no significa nada —lo
    // que anunciaba acaba de pasar—.
    this.audio.pararTension();
    this.audio.captura();

    this.cerco.iniciar(this.jugador.x);

    let texto = textoPersonalizado;
    if (!texto) {
      texto = motivo === 'exhausto'
        ? remateExhausto()
        : remateCaptura(this.escenarioActual);
    }

    // Si el equipo cargó citas verificadas, se añade la que aplique.
    const cita = citaVerificada(this.escenarioActual);

    const puntaje = this.evidenciaPartida + Math.floor(this.distanciaTotal / 10);

    // CONTINUIDAD: la próxima partida arranca aquí, donde te capturaron.
    this.cuaderno.ultimoEscenario = this.escenarioActual;

    // LAS MARCAS DE ANTES, capturadas AQUÍ porque una línea más abajo el
    // cuaderno se cierra con esta partida dentro y ya no hay con qué comparar.
    // Las usa el resumen para decidir si la tabla de posiciones se enseña: solo
    // sale si esta corrida te subió de puesto (ver `hayAscenso` en
    // config/tabla.js).
    const marcasPrevias = {
      evidenciaHistorica: this.cuaderno.evidenciaHistorica ?? 0,
      distanciaHistorica: this.cuaderno.distanciaHistorica ?? 0,
      mejorEvidencia: this.cuaderno.mejorEvidencia ?? 0,
    };

    const cierre = this._cerrarEnCuaderno({
      papeles: this.evidenciaPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      pruebas: this.pruebasPartida,
      ruta: [...this.rutaPartida],
    });

    this.finPendiente = {
      motivo,
      texto,
      cita,
      papeles: this.evidenciaPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      pruebas: this.pruebasPartida,
      ruta: this.rutaPartida,
      // El récord que se anuncia es el de EVIDENCIA, que es lo que mide el
      // juego: cuánta documentación sacaste antes de que te pararan. El
      // cuaderno ya se cerró unas líneas más arriba, así que la marca de esta
      // corrida ya está dentro y la comparación va con `>=`.
      esRecord: this.evidenciaPartida >= this.cuaderno.mejorEvidencia,
      escenario: this.escenarioActual,
      marcasPrevias,
      ...cierre,
    };

    // La foto todavía no existe: se saca durante el cerco. finPendiente se
    // consume después, así que llega a tiempo.

    this._establecerEstado('cerco', { motivo });
  }

  // -------------------------------------------------------------------------
  // BIFURCACIÓN
  // -------------------------------------------------------------------------

  /**
   * Empieza la aproximación: aparecen los carteles y las bocas de túnel al
   * fondo. El juego sigue igual: aquí todavía se esquiva.
   */
  _iniciarAproximacionBifurcacion() {
    this.enAproximacion = true;
    this.corredorLimpio = false;

    const distancia = TRAMO.LONGITUD - this.distanciaTramo;
    const senal = this.bifurcacion.preparar(
      this.escenarioActual,
      this.escenario.obtenerColores(),
      distancia,
    );

    // El cartel de salida baja del techo de la pantalla. Lo que dice sale de la
    // propia bifurcación, no de un texto aparte: dos fuentes acabarían
    // diciendo cosas distintas.
    this.alSeñalizar(senal.destinos, senal.centroEsPeligro);
    this.senalRetirada = false;

    const esc = obtenerEscenario(this.escenarioActual);
  }

  /**
   * Vacía el corredor final.
   *
   * Se hace MÁS TARDE que el aviso, y esa separación es el punto: obligar a
   * esquivar mientras eliges convierte una decisión en un accidente —acabarías
   * entrando por el túnel que te tocó esquivar—, pero vaciar la pista desde el
   * primer cartel dejaría 260 metros sin nada que hacer.
   */
  _limpiarCorredor() {
    this.corredorLimpio = true;
    this.obstaculos.generacionPausada = true;
    this.elevado.generacionPausada = true;

    // Pausar la generación no basta: lo ya creado sigue llegando durante más
    // de 200 unidades. El límite en -40 deja intacto lo que el jugador tiene
    // encima y borra el resto donde la niebla tapa la desaparición.
    this.obstaculos.limpiarAdelante(-40);
    this.elevado.limpiar();
    this.potenciadores.limpiar();

    // Y SE PRECONSTRUYEN LOS DOS DESTINOS LATERALES, uno ahora y el otro unos
    // metros después (ver la aproximación en _actualizarJuego). Construir un
    // barrio cuesta hasta medio segundo de fotograma: pagado aquí —corredor
    // vacío, nada que esquivar— es un tirón que apenas se nota UNA vez por
    // barrio y sesión; pagado en el cruce era el congelón de cada esquina.
    const esc = obtenerEscenario(this.escenarioActual);
    this._prepararBarrio(esc.rutas.izquierda);
    this.barrioPorPreparar = esc.rutas.derecha;
  }

  /**
   * PRECALENTAR: compilar los sombreadores ANTES de correr, no durante.
   *
   * ESTE ERA EL CONGELÓN QUE QUEDABA, y no se veía en ninguna medición porque
   * todas las anteriores llamaban a `_actualizarJuego` en un bucle cerrado SIN
   * PINTAR. Compilar GLSL no pasa al actualizar: pasa la primera vez que un
   * material entra en cuadro, dentro del render.
   *
   * Contando programas del renderizador a lo largo de una partida:
   *
   *     menú                    39
   *     intro                   45
   *     primer tramo            57      ← doce de golpe al arrancar
   *     a los 27 s              63      ← cinco más, con obstáculos nuevos
   *     entrar al Apagón        76      ← trece
   *     entrar a Carondelet     87      ← once
   *
   * O sea CUARENTA Y OCHO sombreadores compilándose con la partida en marcha.
   * Compilar+enlazar es síncrono y bloquea el hilo; en un móvil cuesta de
   * veinte a doscientos milisegundos cada uno. Eso es exactamente lo que se
   * siente: tirones sueltos, «en ciertos momentos», sin relación con lo que
   * está pasando en pantalla.
   *
   * Y por eso los juegos 3D de tienda tienen pantalla de carga: no están
   * cargando datos, están compilando. Aquí se hace lo mismo —con la portada
   * puesta, que es la pantalla de carga que este juego ya tiene—.
   *
   * Medido: montar los cuatro barrios y llamar a `compile()` cuesta 103 ms y
   * resuelve 25 programas de una vez. El resto los trae la muestra de abajo.
   *
   * El decorado se levanta A PLAZOS también aquí (ver construirPendientes): el
   * precalentado no puede ser él mismo el tirón que viene a quitar.
   */
  async _precalentar() {
    if (this._precalentado) return;
    this._precalentado = true;
    const escena = this.escenaThree;
    const esperar = () => new Promise((r) => requestAnimationFrame(r));

    try {
      // --- 1 · Los otros tres barrios, compilados SIN colgarlos -------------
      //
      // COLGARLOS A LA VEZ FUE EL ERROR, y es el que hacía que precalentar no
      // sirviera de nada: cada barrio trae SUS CINCO LUCES dentro del grupo, así
      // que con los cuatro puestos la escena pasa de cinco luces a veinte. El
      // número de luces entra en las macros del sombreador, o sea que lo que se
      // compilaba era una variante que el juego no va a usar nunca, y al
      // cruzar volvía a compilar. Medido: con los cuatro colgados, entrar a un
      // barrio nuevo seguía costando trece programas.
      //
      // `compile(objeto, camara, escenaDestino)` acepta cualquier Object3D y
      // prepara SUS materiales contra el estado de la escena destino. O sea:
      // se compila el grupo del barrio aparcado con las luces, la niebla y el
      // entorno del barrio que está puesto —que son los que va a tener cuando
      // le toque— sin colgarlo y sin que aparezca en pantalla ni un fotograma.
      for (const id of ORDEN_ESCENARIOS) {
        this._prepararBarrio(id);
        const esc = this.escenariosVivos.get(`${id}|${this.calidad.nivel}`);
        if (!esc || esc === this.escenario) continue;
        // SEIS MANZANAS POR BARRIO, NO LAS TREINTA Y DOS. Para compilar no hace
        // falta el barrio entero: hace falta una de cada MATERIAL, y
        // `crearDecorado` los reparte entre sus ramas —patrulla, farola,
        // palmera, camión, la manzana normal—. Con seis salen casi todas y
        // cuesta la sexta parte. El resto lo levanta la aproximación al cruce.
        esc.rematarDecorado();
        await this.renderizador.compileAsync(esc.grupo, this.camara, escena);
      }
      const prestados = [];

      // --- 1b · Los obstáculos DE CADA BARRIO --------------------------------
      //
      // Y aquí estaba el resto. `crearObstaculo(tipo, colores, idEscenario)`
      // ramifica por barrio: el bloque de saltar de la Bahía es un puesto de
      // ropa y el del Apagón es otra cosa, con otros materiales. Como el juego
      // sólo tiene en pista los del barrio en curso, entrar a uno nuevo los
      // construía por primera vez —y los compilaba— en el fotograma del cruce.
      // Medido: catorce programas al entrar al Apagón, incluso con su decorado
      // ya compilado.
      //
      // Se montan las dieciséis combinaciones en un grupo que NO se cuelga de
      // ninguna escena, se compilan contra la de verdad y se sueltan. Lo que
      // queda compilado es el programa, que es lo caro; la geometría y los
      // materiales se tiran.
      const muestrario = new THREE.Group();
      for (const id of ORDEN_ESCENARIOS) {
        const cfg = obtenerEscenario(id);
        for (const tipo of ['saltar', 'agachar', 'esquivar', 'doble']) {
          try { muestrario.add(crearObstaculo(tipo, cfg.colores, id)); }
          catch { /* un tipo que ese barrio no monta */ }
        }
      }
      await this.renderizador.compileAsync(muestrario, this.camara, escena);
      muestrario.traverse((o) => {
        if (o.isMesh && !o.userData.compartido) o.geometry?.dispose?.();
      });

      // --- 2 · Una muestra de cada cosa que compila distinto ----------------
      // Lejísimos, detrás de la niebla y del plano lejano de la cámara: da
      // igual dónde estén porque `compile()` recorre el grafo, no el cuadro.
      const LEJOS = -360;
      for (const tipo of ['saltar', 'agachar', 'esquivar', 'doble']) {
        try { this.obstaculos._colocar(tipo, [1], LEJOS); } catch { /* ya está */ }
      }
      try { this.evidencia.generarHilera([0, 1, 2], LEJOS, 6); } catch { /* ya está */ }
      for (const def of (this.potenciadores.disponibles ?? [])) {
        const malla = crearPotenciador(def.id, def.color);
        malla.position.set(0, POTENCIADORES.ALTURA, LEJOS);
        this.potenciadores.grupo.add(malla);
        prestados.push({ grupo: malla, suelto: true });
      }
      try {
        this.elevado._generar(this.obstaculos, this.evidencia);
      } catch { /* ya está */ }
      const bifurcacionViva = this.bifurcacion.activa;
      if (!bifurcacionViva) {
        try {
          this.bifurcacion.preparar(
            this.escenarioActual, this.escenario.obtenerColores(), 360,
          );
        } catch { /* ya está */ }
      }

      await esperar();

      // --- 3 · Compilar ----------------------------------------------------
      // `compileAsync` usa la extensión de compilado en paralelo cuando el
      // navegador la trae, así que en un móvil moderno esto ni siquiera
      // bloquea; donde no está, se comporta como el síncrono de siempre y se
      // paga aquí, con la portada delante, en vez de en mitad de una corrida.
      await this.renderizador.compileAsync(escena, this.camara);

      // --- 4 · Y todo vuelve a su sitio ------------------------------------
      for (const p of prestados) {
        if (p.suelto) p.grupo.parent?.remove(p.grupo);
        else escena.remove(p.grupo);
      }
      this.obstaculos.limpiar();
      this.evidencia.limpiar();
      this.elevado.limpiar();
      this.potenciadores.limpiar();
      if (!bifurcacionViva) this.bifurcacion.limpiar();
    } catch (error) {
      // Un precalentado que falla no puede llevarse la partida por delante: lo
      // peor que pasa sin él es lo que pasaba antes.
      console.warn('[Precalentado] No se pudo completar.', error);
    }
  }

  /**
   * Construye un barrio y lo deja aparcado en la caché, listo para el cruce.
   * Si ya está construido no hace nada, así que llamarlo de más es gratis.
   */
  _prepararBarrio(id) {
    if (!id) return;
    const clave = `${id}|${this.calidad.nivel}`;
    if (this.escenariosVivos.has(clave)) return;
    // El constructor del barrio escribe la niebla GLOBAL de la escena (es lo
    // que hace al montarse), así que construir uno en segundo plano pisaría la
    // del barrio que se está corriendo. Se guarda y se repone.
    const nieblaActiva = this.escenaThree.fog;
    const fondoActivo = this.escenaThree.background;
    const escena = crearEscenario(id, this.escenaThree, this.calidad);
    escena.suspender();
    this.escenaThree.fog = nieblaActiva;
    this.escenaThree.background = fondoActivo;
    // Y su cielo, aquí también. Generarlo cuesta un prefiltrado (1,2-3,5 ms
    // medidos, con un caso de 24 ms la primera vez), y hasta ahora se pagaba en
    // el fotograma del cruce por el mismo motivo por el que se pagaba el barrio
    // entero: porque nadie lo había pedido antes. Es la misma jugada, aplicada
    // a la textura. Se guarda en la caché de utils/entorno.js.
    cieloDe(this.renderizador, id, escena.obtenerColores());
    this.escenariosVivos.set(clave, escena);
  }

  /**
   * El jugador acaba de entrar a un túnel. El carril decide.
   * @param {number} carril 0 izquierda, 1 centro, 2 derecha
   */
  /**
   * LA CORTINA DE POLVO de la esquina.
   *
   * Aunque la cámara ya no se abre más de 24°, el pico del giro sigue dejando
   * a la vista el canto de la acera y el muro del soportal. El polvo lo
   * disimula y, sobre todo, hace que la esquina se sienta esquina.
   *
   * Se emite CADA FOTOGRAMA mientras dura el pico del giro, y delante de la
   * cámara —no bajo los pies del corredor—, porque lo que hay que cubrir es el
   * cuadro entero. Un estallido suelto al empezar se disuelve antes de que la
   * cámara llegue a donde estorba.
   */
  /**
   * De qué color es el polvo de la esquina.
   *
   * ERA EL COLOR DE LA CALLE, Y ESO LO CONVERTÍA EN AGUJEROS. El asfalto de
   * cada barrio es un tono medio-oscuro; una nube pintada de ese mismo tono,
   * dibujada ENCIMA del asfalto y con transparencia, sale más oscura que el
   * suelo. Lo que se veía en pleno giro no era polvo: eran manchas negras
   * flotando sobre la calzada, y una mancha oscura que se mueve por delante de
   * la cámara mientras la cámara gira es de las cosas que peor sienta.
   *
   * El polvo de una calle es lo que la calle refleja cuando se levanta, o sea
   * algo más claro que ella. Un tercio hacia el blanco: conserva el tinte del
   * barrio —el polvo del Apagón sigue siendo azulado y el de Elecciones
   * morado— y ya no se lee como un agujero. Se probó a la mitad y era peor por
   * el otro lado: nubes blancas opacas sobre la calzada, bolas de nieve.
   */
  _colorDePolvo() {
    const calle = this.escenario?.obtenerColores?.().calle ?? 0x9a938a;
    return new THREE.Color(calle).lerp(new THREE.Color(0xffffff), 0.32).getHex();
  }

  _cortinaDePolvo(dt, fuerza, direccion) {
    if (!this.particulas || fuerza < 0.28) return;

    // Cuántas se encienden este fotograma. Se acumula el resto: a 60 fps una
    // cantidad fraccionaria redondeada da cero fotograma tras fotograma y no
    // sale nunca ni una.
    //
    // BAJÓ DE 320 A 70, y el motivo es que la cortina hacía demasiado bien su
    // trabajo: tapaba el pico del giro, sí, pero también tapaba el giro. Lo
    // que se veía era una pantalla de polvo y, al abrirse, otra calle —o sea,
    // exactamente el corte que se quería evitar, con niebla—. Con setenta el
    // polvo acompaña la esquina en vez de sustituirla.
    this._restoPolvo = (this._restoPolvo ?? 0) + dt * 46 * fuerza;
    const cuantas = Math.floor(this._restoPolvo);
    this._restoPolvo -= cuantas;
    if (cuantas <= 0) return;

    const polvo = this._colorDePolvo();
    const delante = new THREE.Vector3();
    this.camara.getWorldDirection(delante);

    for (let i = 0; i < cuantas; i++) {
      const d = 5 + Math.random() * 7;
      this.particulas.estallido(
        this.camara.position.x + delante.x * d + (Math.random() - 0.5) * 9,
        // Bajo, a la altura de las ruedas: el polvo de una esquina se levanta
        // del suelo. A media pantalla era una cortina y no una polvareda.
        0.2 + Math.random() * 1.2,
        this.camara.position.z + delante.z * d + (Math.random() - 0.5) * 5,
        {
          color: polvo,
          cantidad: 1,
          fuerza: 1.4,
          // Más chico desde que el polvo dejó de ser oscuro: a 1.4-2.6 y en
          // claro, cada mota tapaba media calzada.
          tam: 0.9 + Math.random() * 0.8,
          vida: 0.5 + Math.random() * 0.3,
          gravedad: 0.4,
          roce: 1.4,
          subida: 0.8 + direccion * 0.1,
        },
      );
    }
  }

  /**
   * EL POLVO DE LA ESQUINA.
   *
   * Doblar era un corte: el decorado se sustituía entero en un fotograma y lo
   * tapaba un destello blanco. Funcionaba como truco de montaje y no como
   * cosa que pasa. Una nube de polvo levantada al frenar sobre el asfalto es
   * lo que hace cualquiera que dobla una esquina a la carrera, tapa el mismo
   * corte, y encima explica por qué se tapa.
   *
   * Se levanta A LO ANCHO del corredor, no solo bajo los pies: una nubecilla
   * junto al zapato no cubre nada, y lo que hay que acompañar es el barrido
   * entero del giro.
   */
  _polvoDeEsquina(carril) {
    if (!this.particulas) return;
    const direccion = carril - 1;
    if (direccion === 0) return;   // De frente no se dobla: no hay derrape.

    const polvo = this._colorDePolvo();

    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      this.particulas.estallido(
        this.jugador.x + direccion * (0.6 + t * 5.4),
        0.25 + t * 0.5,
        -1 - t * 4,
        {
          color: polvo,
          cantidad: 12,
          fuerza: 2.2 + t * 1.6,
          tam: 0.9 + t * 0.7,
          vida: 0.75 + t * 0.35,
          // Poca gravedad y mucho roce: el polvo se queda flotando en vez de
          // caer como chispas, que es lo que hace que tape algo.
          gravedad: 0.9,
          roce: 1.1,
          subida: 1.6,
        },
      );
    }
  }

  _cruzarBifurcacion(carril) {
    this.enAproximacion = false;
    this.corredorLimpio = false;
    this.bifurcacion.iniciarViraje(carril, this.escenario.obtenerColores());
    this.audio.cambioEscenario();
    this.alQuitarSenal();
    this._polvoDeEsquina(carril);

    const esc = obtenerEscenario(this.escenarioActual);

    // --- Centro: la vía institucional --------------------------------------
    if (carril === CARRILES.CENTRO) {
      if (esc.frenteEsMuerte) {
        this.terminarPartida('cerco', esc.textoFrente);
        return;
      }
      // Antes de entrar se PARA y se cuenta. Ver _contarInstitucion().
      this._contarInstitucion('entrada');
      return;
    }

    // --- Laterales: sigues corriendo, sin menú -----------------------------
    const direccion = carril === CARRILES.IZQUIERDA ? 'izquierda' : 'derecha';
    const destino = this.rutas.resolverRuta(this.escenarioActual, direccion);
    this._entrarEnTramo(destino);
    // Y la calle nueva NACE EN LA TRANSVERSAL: cruzada delante del jugador,
    // como está una bocacalle de verdad cuando llegas a la esquina. El viraje
    // la irá girando hasta ponerla de frente. Ver _girarMundo().
    this._prepararGiroMundo(carril === CARRILES.IZQUIERDA ? -1 : 1);
  }

  // -------------------------------------------------------------------------
  // EL GIRO DEL MUNDO — la esquina, como la hace Temple Run
  // -------------------------------------------------------------------------
  //
  // EL MUNDO GIRA; EL JUGADOR Y LA CÁMARA, NO.
  //
  // Éste es el tercer enfoque de la esquina, y el bueno. El primero giraba la
  // cámara en su sitio mientras la desplazaba al lado contrario: paralajes
  // opuestos, mareo, y el giro leído al revés. El segundo la hacía orbitar
  // alrededor del personaje: correcto sobre el papel, pero el encuadre entero
  // se trasladaba y el suelo barría el cuadro en diagonal — seguía sintiéndose
  // torpe, porque una cámara de runner NO se mueve de detrás del corredor.
  //
  // Lo que hace el género es lo contrario: el camino ya está generado doblando
  // la esquina, y al girar es EL MUNDO el que se reorienta alrededor del
  // jugador mientras la cámara se queda donde estaba. Aquí la pista no dobla
  // —se sustituye entera al cruzar— así que se consigue lo mismo por el otro
  // lado: el tramo nuevo se construye normal (a lo largo de −Z) y se PRE-ROTA
  // ±90° alrededor del jugador, con lo que queda tendido en la transversal,
  // exactamente donde está una bocacalle cuando llegas a la esquina. Durante
  // el viraje esa rotación vuelve a cero: la calle nueva gira hasta quedar de
  // frente, el barrio viejo ya quedó atrás, y el soportal —que viaja con el
  // jugador y no gira— hace de esquina cubierta.
  //
  // Dos propiedades hacen esto barato:
  // · Todos los subsistemas del mundo cuelgan de un `grupo` propio asentado en
  //   el origen, así que girar el mundo son seis escrituras de rotation.y.
  // · El movimiento interno (obstáculos, papeles) es en coordenadas del grupo:
  //   con el grupo girado, «acercarse por la calle» se convierte solo en
  //   acercarse por la calle GIRADA. Las distancias no cambian —una rotación
  //   es isometría— así que colisiones y tiempos quedan intactos.

  /** Los grupos que forman el mundo por el que se corre. */
  _gruposMundo() {
    return [
      this.pista?.grupo,
      this.escenario?.grupo,
      this.obstaculos?.grupo,
      this.evidencia?.grupo,
      this.elevado?.grupo,
      this.potenciadores?.grupo,
    ].filter(Boolean);
  }

  /**
   * Tiende el tramo recién construido en la transversal.
   * @param {number} dir -1 izquierda, 1 derecha
   */
  _prepararGiroMundo(dir) {
    // Pre-rotación: −dir·90°. Construida a lo largo de −Z, con −90° la calle
    // queda hacia +X (la bocacalle de la derecha); con +90°, hacia −X.
    this.giroMundo = { angulo: -dir * Math.PI / 2 };
    for (const g of this._gruposMundo()) g.rotation.y = this.giroMundo.angulo;
  }

  /** Adelanta el giro del mundo al ritmo del viraje. */
  _girarMundo() {
    if (!this.giroMundo) return;
    const b = this.bifurcacion;
    const t = b.virando ? b.tiempoViraje / (b.duracionActual || 1) : 1;
    // El giro termina ANTES que el viraje (ver FIN_GIRO_MUNDO): lo que queda
    // de soportal se corre ya con la calle de frente, que es el «salir de la
    // esquina acelerando» del género.
    const p = Math.min(1, t / FIN_GIRO_MUNDO);
    const suave = p * p * (3 - 2 * p);
    const rot = this.giroMundo.angulo * (1 - suave);
    for (const g of this._gruposMundo()) g.rotation.y = rot;
    if (p >= 1) this._asentarGiroMundo();
  }

  /** Deja el mundo derecho. Al terminar el giro y ante cualquier corte. */
  _asentarGiroMundo() {
    if (!this.giroMundo) return;
    for (const g of this._gruposMundo()) g.rotation.y = 0;
    this.giroMundo = null;
  }

  /** Limpia la pista y arranca un tramo nuevo en el escenario indicado. */
  _entrarEnTramo(destino) {
    this.obstaculos.limpiar();
    this.evidencia.limpiar();
    // Las chispas también: al cambiar de temporada el mundo entero salta, y un
    // estallido de la calle anterior quedaría flotando sobre la nueva.
    this.particulas.limpiar();
    this.bifurcacion.limpiar();
    this.elevado.limpiar();
    this.tramite.limpiar();
    this.potenciadores.limpiar();
    this.evidencia.nuevoTramo();
    this.obstaculos.generacionPausada = false;
    this.elevado.generacionPausada = false;
    this.enAproximacion = false;
    this.corredorLimpio = false;
    // Si quedó un destino pendiente de preconstruir (captura en pleno
    // corredor, por ejemplo), ya no corresponde a este tramo.
    this.barrioPorPreparar = null;

    this._cambiarEscenario(destino, true);
    // Lo recién levantado trae materiales nuevos: se compilan ahora, con el
    // polvo del giro tapando, y no en el primer fotograma de la calle nueva.
    this.precalentar();
  }

  // -------------------------------------------------------------------------
  // EL TRÁMITE
  // -------------------------------------------------------------------------

  /**
   * EL HUECO SIN ACCIONES. Se para el juego y se cuenta qué está pasando.
   *
   * El trámite era la parte con más historia detrás y la que menos se
   * entendía: entrabas por el túnel del centro, se te caían los papeles y
   * salías, todo en marcha y con un aviso de dos líneas que se iba solo a los
   * dos segundos y medio. Nadie leía eso. Y sin leerlo, lo que queda es una
   * fase rara en la que hay que recoger cosas.
   *
   * Así que aquí el juego se detiene. No hay nada que esquivar ni nada que
   * pulsar salvo seguir: es el único momento en que se puede pedir atención
   * sin quitársela a otra cosa.
   *
   * @param {'entrada'|'salida'} fase
   * @param {object} [extra] Datos de la salida (recuperados, perdidos…)
   */
  _contarInstitucion(fase, extra = {}) {
    const institucion = this.rutas.datosInstitucion(this.escenarioActual);

    // SOLO LA PRIMERA VEZ. El relato explica de qué va este sitio, y eso se
    // explica una vez: a la quinta visita a la Fiscalía, tres párrafos
    // contando que pediste cita tres veces son tres párrafos que ya se
    // leyeron, y parar el juego para repetirlos deja de ser un respiro y pasa
    // a ser un peaje.
    //
    // A partir de la segunda entra directo, con la acusación de siempre: se te
    // cayeron los papeles, recógelos.
    if (this.cuaderno.yaConoceInstitucion(this.escenarioActual)) {
      this._resumirInstitucion(fase, institucion, extra);
      return;
    }

    this.controles.desactivar();
    this._establecerEstado('relato', {
      fase,
      institucion: institucion?.nombre ?? 'EL TRÁMITE',
      relato: fase === 'entrada'
        ? (institucion?.relatoEntrada ?? institucion?.entrada ?? '')
        : (institucion?.relatoSalida ?? institucion?.portazo ?? ''),
      remate: fase === 'entrada' ? institucion?.entrada : institucion?.portazo,
      escenario: this.escenarioActual,
      ...extra,
    });

    // Se marca al SALIR, no al entrar: si se marcara en la entrada, quien se
    // encuentra el trámite por primera vez leería el arranque y se quedaría
    // sin el remate.
    if (fase === 'salida') {
      this.cuaderno.marcarInstitucionContada(this.escenarioActual);
    }
  }

  /**
   * La versión corta, de la segunda visita en adelante: un aviso y a correr.
   * Sin parar el juego, sin pantalla y sin botón.
   */
  _resumirInstitucion(fase, institucion, extra) {
    if (fase === 'entrada') {
      this._entrarEnTramite();
      return;
    }

    // EL ×2 Y EL HALLAZGO SE ANUNCIAN SIEMPRE, también en la versión corta.
    //
    // Aquí no había nada: dos condicionales vacías, restos de los avisos
    // flotantes que se quitaron del HUD. O sea que de la segunda visita en
    // adelante —que es casi siempre— salías del pasillo sin que nada dijera
    // cuánto rescataste ni que acababas de llevarte la pieza del caso, que es
    // lo único por lo que merece la pena entrar. El tramo con más historia
    // detrás se jugaba a ciegas.
    //
    // Lo cuenta el propio panel del expediente, que se queda dos segundos más
    // con el resultado. Ver HUD.cerrarExpediente().
    this.alCerrarExpediente({
      devueltos: extra.devueltos ?? 0,
      hallazgo: extra.hallazgo ?? null,
    });

    // EL PORTAZO SE VE. En la variante corta el pasillo se cambia por la calle
    // nueva EN UN FOTOGRAMA, sin pantalla ni soportal que lo tape: un corte a
    // pelo. (Lo tapaba, por accidente, el fogonazo diferido del viraje; al
    // arreglar aquel bug el corte quedó desnudo.) Un golpe de blanco corto es
    // además la metáfora exacta del tramo: te dan con la puerta en las
    // narices. La primera visita no lo necesita: la pantalla del relato cubre
    // el cambio.
    this.destelloPortazo = 1;

    const destino = this.rutas.resolverRuta(this.escenarioActual, 'derecha');
    this._entrarEnTramo(destino);
  }

  /** Lo que hace el botón del relato: seguir. */
  continuarRelato(fase) {
    this.controles.activar();
    if (fase === 'entrada') {
      this._entrarEnTramite();
      this._establecerEstado('jugando');
      return;
    }
    const destino = this.rutas.resolverRuta(this.escenarioActual, 'derecha');
    this._entrarEnTramo(destino);
    this._establecerEstado('jugando');
  }

  /**
   * Entra al ente de control. Dentro no hay obstáculos, ni perseguidores, ni
   * drenaje de aguante: solo el reguero de TUS papeles por el suelo.
   */
  _entrarEnTramite() {
    this.obstaculos.limpiar();
    this.obstaculos.generacionPausada = true;
    this.elevado.limpiar();
    this.elevado.generacionPausada = true;
    this.evidencia.limpiar();
    this.potenciadores.limpiar();
    this.bifurcacion.limpiar();
    this._limpiarEfectos();

    const institucion = this.rutas.datosInstitucion(this.escenarioActual);

    // TE LOS QUITAN. El marcador se vacía en el acto: lo que había pasa a
    // estar por el suelo, y lo que se recupere volverá a sumar.
    const confiscados = this.evidenciaPartida;
    this.evidenciaPartida = 0;
    this.combo = 0;

    this.tramite.iniciar(
      this.escenario.obtenerColores(),
      institucion,
      this.evidencia,
      confiscados,
    );

  }

  /**
   * Se acabó el pasillo. Aquí se cuenta lo que quedó en el suelo.
   *
   * El portazo es siempre el mismo pase lo que pase —para eso es un portazo—,
   * pero el HALLAZGO también: entrar cuesta papeles y paga historia. Es la
   * asimetría que hace que jugar a puntuación y jugar a documentar tiren en
   * direcciones opuestas.
   */
  _salirDelTramite() {
    const institucion = this.rutas.datosInstitucion(this.escenarioActual);
    const recuperados = this.tramite.evidenciaRecuperada();
    const devueltos = this.tramite.evidenciaDevuelta();
    const perdidos = this.tramite.evidenciaPerdida();
    const perfecto = this.tramite.esPerfecto();

    // Vuelve a la cuenta lo que se levantó del suelo, POR DOS. Ver
    // TRAMITE.MULTIPLICADOR_RESCATE: sin el ×2 la única jugada correcta era no
    // entrar nunca, y un tramo que solo se puede evitar no es un tramo.
    this.evidenciaPartida += devueltos;

    // El hallazgo del caso. Es lo único que compensa haber entrado.
    const hallazgo = institucion?.hallazgo;
    if (hallazgo && !this.pruebasPartida.includes(hallazgo)) {
      this.pruebasPartida.push(hallazgo);
      this.audio.evidencia();
    }

    if (perfecto) {
      this._ganarPartida(institucion, recuperados);
      return;
    }

    // Otra parada, y por el mismo motivo: el portazo es el remate de la
    // escena, y un remate que se va solo a los dos segundos no remata nada.
    this._contarInstitucion('salida', {
      hallazgo, recuperados, perdidos, devueltos,
      multiplicador: TRAMITE.MULTIPLICADOR_RESCATE,
    });
  }

  /**
   * Recuperaste el reguero entero, que es prácticamente imposible. El ente te
   * da igual con la puerta en las narices, pero el caso sigue vivo.
   */
  _ganarPartida(institucion, evidenciaRecuperada) {
    this.jugador.vivo = true;
    this.controles.desactivar();
    this.audio.evidencia();

    const puntaje = this.evidenciaPartida + Math.floor(this.distanciaTotal / 10);

    this.cuaderno.denunciaPresentada = true;
    this.cuaderno.ultimoEscenario = this.escenarioActual;

    const cierre = this._cerrarEnCuaderno({
      papeles: this.evidenciaPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      pruebas: this.pruebasPartida,
      ruta: [...this.rutaPartida],
    });

    this._establecerEstado('victoria', {
      institucion: institucion?.nombre ?? 'LA INSTITUCIÓN',
      texto: institucion?.textoExito
        ?? 'Los recogiste todos. Alguien, en algún piso, tuvo que leerlo.',
      papelesEntregados: evidenciaRecuperada,
      papeles: this.evidenciaPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      pruebas: this.pruebasPartida,
      ruta: this.rutaPartida,
      ...cierre,
    });
  }

  /**
   * Cierra la partida en el cuaderno y devuelve, además de las páginas, los
   * potenciadores que se abrieron con ella.
   *
   * Se compara antes/después en vez de guardar una lista de "ya anunciados":
   * la escalera se calcula sola desde el catálogo, así que el diff es la
   * fuente de verdad y no hay estado que se pueda desincronizar.
   */
  _cerrarEnCuaderno(resultado) {
    const antes = new Set(this.cuaderno.potenciadoresDesbloqueados());
    const antesPersonajes = new Set(this.cuaderno.personajesDesbloqueados());
    const { paginasNuevas } = this.cuaderno.registrarPartida(resultado);

    const potenciadoresNuevos = CATALOGO_POTENCIADORES.filter(
      (p) => !antes.has(p.id) && this.cuaderno.tramosRecorridos >= p.tramos,
    );
    const personajesNuevos = PERSONAJES.filter(
      (p) => !antesPersonajes.has(p.id) && this.cuaderno.tramosRecorridos >= p.tramos,
    );

    // Sin `proximoPotenciador`: la cuenta atrás de "a dos tramos de X" se
    // quitó del fin de partida. Sigue en el menú, que es donde el número tiene
    // a qué referirse —las casillas cerradas del arsenal—, y ahí lo pide la
    // pantalla directamente al cuaderno.
    return { paginasNuevas, potenciadoresNuevos, personajesNuevos };
  }

  // -------------------------------------------------------------------------
  // POTENCIADORES
  // -------------------------------------------------------------------------
  // Los efectos viven aquí, no en PowerUps.js, porque tocan subsistemas que
  // solo Game conoce (el imán es del gestor de papeles, el vuelo es del
  // jugador, el multiplicador es de la puntuación). El gestor solo pone las
  // cápsulas en pista y dice qué se recogió.

  /** Aplica un potenciador recién recogido. */
  _activarPotenciador(def) {
    this.audio.evidencia();

    switch (def.id) {
      case 'salvoconducto':
        // No caduca: se gasta al recibir el golpe.
        this.jugador.escudo = true;
        break;

      case 'botas':
        this.jugador.multiplicadorSalto = POTENCIADORES.IMPULSO_BOTAS;
        this.efectos.set(def.id, def.duracion);
        break;

      case 'cobertura':
        this.jugador.volar(true, POTENCIADORES.ALTURA_VUELO);
        this.efectos.set(def.id, def.duracion);
        break;

      case 'portada':
        this.multiplicadorEvidencia = 2;
        this.efectos.set(def.id, def.duracion);
        break;

      case 'linterna':
        // El efecto lo lleva la escena, porque lo que cambia es la niebla y el
        // foco, no nada del jugador. Aquí solo se enciende y se cuenta el
        // tiempo para que el HUD pueda pintar la cuenta atrás.
        this.escenario.encenderLinterna?.(def.duracion);
        this.efectos.set(def.id, def.duracion);
        break;

      case 'iman':
      default:
        this.evidencia.radioIman = POTENCIADORES.RADIO_IMAN;
        this.efectos.set(def.id, def.duracion);
        break;
    }

    // Anillo y estallido en el color del propio potenciador, que ya lo lleva en
    // el catálogo. Anillo Y estallido, no uno de los dos: es el único momento
    // del juego en que pasa algo que cambia las reglas durante diez segundos, y
    // tiene que verse distinto de recoger un papel más.
    this.particulas.anillo(this.jugador.x, this.jugador.y + 0.9, 0.2, {
      color: def.color ?? 0x39d98a, cantidad: 34, radio: 7.5, vida: 0.62, tam: 0.4,
    });
    // El estallido sale del PUNTO DE ATRAPE, igual que el del papel y por el
    // mismo motivo: a z 0,2 nacía dentro del cuerpo y la mitad de las chispas
    // no llegaban a dibujarse. El anillo se queda donde estaba porque es otra
    // cosa —una onda que se abre alrededor de quien corre, no algo que sale de
    // la mano— y a esa altura no lo tapa nadie.
    // ESTABA MUDO, y es lo único que cambia las reglas durante diez segundos.
    // Se veía —anillo y estallido— y no se oía.
    this.audio.potenciador();
    this.particulas.fogonazo(this.jugador.x, this.jugador.y + ATRAPE.y, ATRAPE.z, {
      color: def.color ?? 0x39d98a, cantidad: 6, tam: 1.2, vida: 0.2,
      arrastre: this.velocidad,
    });
    this.particulas.estallido(this.jugador.x, this.jugador.y + ATRAPE.y, ATRAPE.z, {
      color: def.color ?? 0x39d98a, cantidad: 24, fuerza: 4.6, tam: 0.42, vida: 0.62,
      sesgo: SESGO_ATRAPE,
    });

  }

  /** Descuenta los temporizadores y deshace los efectos que caducan. */
  _actualizarEfectos(dt) {
    if (this.efectos.size === 0) return;

    for (const [id, restante] of this.efectos) {
      const nuevo = restante - dt;
      if (nuevo > 0) {
        this.efectos.set(id, nuevo);
        continue;
      }
      this.efectos.delete(id);
      this._desactivarPotenciador(id);
    }
  }

  /**
   * LA ESTELA. Lo que va dejando el corredor mientras corre y mientras vuela.
   *
   * Son dos efectos distintos y no uno con una variable:
   *
   *   · CORRIENDO deja polvo a ras de suelo, saliendo hacia atrás desde los
   *     pies. Sin racha es gris y casi no se ve —es polvo de la calle—; con
   *     racha toma el color del escalón y se vuelve denso. Esa es la única
   *     forma en que la racha se paga, así que tiene que notarse.
   *   · VOLANDO deja un chorro hacia ABAJO, que es lo que hace legible que
   *     estás sostenido en el aire y no saltando. Va siempre, con racha o sin
   *     ella: no es premio, es información.
   *
   * El acumulador `restoEstela` está ahí porque la cantidad por fotograma es
   * fraccionaria: emitir `Math.round(0.4)` partículas sesenta veces por segundo
   * es no emitir ninguna nunca.
   */
  _emitirEstela(dt, velocidad) {
    if (!this.particulas.activo) return;

    const t = tramoRacha(this.combo);
    const enSuelo = !this.jugador.estaEnElAire && !this.jugador.volando;

    if (this.jugador.volando) {
      this.particulas.chorro(this.jugador.x, this.jugador.y + 0.15, 0.35, {
        // EL CHORRO DEL VUELO NO LLEVA EL COLOR DE LA RACHA. Sale de los pies
        // hacia abajo —empuje −5,2 en Y— o sea que apunta al asfalto y se
        // estampa contra él: es el sitio del juego donde algo rojo cae más
        // claramente sobre el suelo. Y además no tiene por qué llevarlo: esto
        // es el chorro de la cobertura aérea, no la racha.
        color: 0x4fd8ff,
        cantidad: 2,
        dispersion: 0.34,
        empuje: { x: 0, y: -5.2, z: 1.5 },
        tam: 0.32, vida: 0.34, gravedad: -1.2, roce: 2.4,
      });
      return;
    }

    // Sin racha y en el aire no hay nada que levantar: el polvo sale de pisar.
    if (!enSuelo || t.estela === 0) { this.restoEstela = 0; return; }

    // Escala con la velocidad: a paso de arranque el polvo es un hilo y a
    // velocidad de crucero es una cola. Sale gratis y es lo que hace que
    // acelerar se sienta como acelerar.
    const porSegundo = t.estela * (0.6 + velocidad / VELOCIDAD.MAXIMA);
    this.restoEstela += porSegundo * dt;
    const cuantas = Math.floor(this.restoEstela);
    if (cuantas <= 0) return;
    this.restoEstela -= cuantas;

    // DÓNDE SE EMITE, que resultó ser lo único que importaba aquí.
    //
    // La primera versión soltaba polvo a ras de suelo, a la altura de los pies.
    // Es lo lógico y no se veía NADA, por geometría: la cámara está a cuatro
    // metros de alto y el borde inferior del cuadro corta el asfalto a dos
    // metros y pico por detrás del corredor. Todo lo que se emite pegado al
    // suelo cae fuera de cuadro en una décima de segundo.
    //
    // Ahora sale a la altura de la cintura y subiendo despacio, con lo que se
    // queda dentro del encuadre casi el doble de tiempo. El empuje hacia atrás
    // sigue siendo pequeño: la cola la hace el mundo, que ya arrastra cada
    // chispa dieciocho metros por segundo hacia la cámara.
    this.particulas.chorro(this.jugador.x, this.jugador.y + 0.85, 0.5, {
      // Papel, no el color del escalón. Ver RACHA.COLOR_ESTELA: doscientas
      // diez chispas por segundo de rojo oscuro por detrás de alguien que huye
      // no se leen como una racha.
      color: RACHA.COLOR_ESTELA,
      cantidad: cuantas,
      dispersion: 0.62,
      empuje: { x: 0, y: 1.1, z: 0.6 },
      tam: 0.3, vida: 0.55, gravedad: 0.9, roce: 1.2,
    });
  }

  _desactivarPotenciador(id) {
    switch (id) {
      case 'botas': this.jugador.multiplicadorSalto = 1; break;
      case 'cobertura': this.jugador.volar(false); break;
      case 'portada': this.multiplicadorEvidencia = 1; break;
      case 'iman': this.evidencia.radioIman = EVIDENCIA.RADIO_IMAN; break;
      default: break;
    }
  }

  /** Corta todos los efectos de golpe (fin de partida, tramo nuevo, escape). */
  _limpiarEfectos() {
    for (const id of this.efectos.keys()) this._desactivarPotenciador(id);
    this.efectos.clear();
    this.multiplicadorEvidencia = 1;
    this.jugador.escudo = false;
  }

  /** Lo que el HUD necesita saber de los efectos activos. */
  _efectosParaHUD() {
    const lista = [];
    for (const [id, restante] of this.efectos) {
      const def = CATALOGO_POTENCIADORES.find((p) => p.id === id);
      if (!def) continue;
      lista.push({ id, nombre: def.nombre, fraccion: restante / def.duracion });
    }
    if (this.jugador.escudo) {
      lista.push({ id: 'salvoconducto', nombre: 'Salvoconducto', fraccion: 1 });
    }
    return lista;
  }

  // -------------------------------------------------------------------------
  // CERCO Y ESCAPE
  // -------------------------------------------------------------------------

  /**
   * Aplica el resultado del medidor de habilidad.
   *
   * Es HABILIDAD, no suerte: el cursor va y viene a velocidad conocida y el
   * jugador lo para. Quien acierta se lo ganó, y quien falla sabe por qué.
   *
   * @param {boolean} exito
   */
  escapar(exito) {
    if (this.estado !== 'escape') return;

    if (!exito) {
      // Le tocó uno de ellos. Qué sentencia exactamente sí es al azar: a esas
      // alturas ya perdiste, y lo que se sortea es solo el titular de mañana.
      const compradas = SENTENCIAS.filter((j) => !j.limpio);
      const sentencia = compradas[Math.floor(Math.random() * compradas.length)];
      this._consumarFin(sentencia);
      return;
    }

    // Te zafaste. Vuelves a la pista en la misma temporada, con aire.
    this.audio.evidencia();
    this.cerco.limpiar();
    this.finPendiente = null;
    // La cámara vuelve del picado del cerco al encuadre de carrera DESPACIO:
    // al ritmo normal de juego era un latigazo de posición y de mira a la vez.
    this.recuperacionCamara = 0.9;

    this.jugador.reiniciarTrasEscape();
    this.perseguidor.soltar(CERCO.DISTANCIA_TRAS_ESCAPE);
    this.velocidad = VELOCIDAD.INICIAL;

    // La pista quedó parada bajo los pies del jugador: hay que rellenarla.
    this.obstaculos.limpiar();
    this.evidencia.limpiar();
    this.elevado.limpiar();
    this.potenciadores.limpiar();

    // Si el cerco te cayó EN LA FACHADA MISMA —ir de frente en Carondelet—,
    // el tramo estaba consumido: sin esto, al zafarte la aproximación volvía a
    // dispararse en el mismo metro, cruzabas al instante por el carril del
    // centro y el cerco te caía otra vez. Un bucle de capturas del que solo se
    // salía cambiando de carril en un fotograma. La calle vuelve a empezar.
    if (this.distanciaTramo >= TRAMO.LONGITUD - 1) {
      this.distanciaTramo = 0;
      this.enAproximacion = false;
      this.corredorLimpio = false;
      this.bifurcacion.limpiar();
    }

    // …salvo si te atraparon en pleno corredor de bifurcación. Ahí la pista
    // está vacía a propósito y volver a llenarla pondría obstáculos justo
    // donde el jugador tiene que estar eligiendo túnel.
    if (this.corredorLimpio) {
      this.obstaculos.generacionPausada = true;
      this.elevado.generacionPausada = true;
    } else {
      this.obstaculos.generacionPausada = false;
      this.elevado.generacionPausada = false;
      this._precargarPista();
    }

    this.controles.activar();
    this.relojAnterior = performance.now();
    this._establecerEstado('jugando');
  }

  /**
   * Cierra la partida de verdad, con los datos calculados en la captura.
   * @param {object} [sentencia] La que dictó el juez, si hubo sorteo
   */
  _consumarFin(sentencia = null) {
    const datos = this.finPendiente ?? {};
    this.finPendiente = null;
    this.cerco.limpiar();
    this._establecerEstado('gameover', {
      ...datos,
      sentencia,
      foto: this.fotoArresto,
    });
  }

  // -------------------------------------------------------------------------
  // BUCLE
  // -------------------------------------------------------------------------

  iniciarBucle() {
    if (this.animando) return;
    this.animando = true;
    this.relojAnterior = performance.now();
    this._bucle();
  }

  /**
   * Curva el mundo y dibuja. En este orden y JUSTO aquí: el parche de
   * curvatura (ver utils/curvatura.js) tiene que pasar DESPUÉS de que la
   * actualización haya montado lo que tuviera que montar —el soportal, la
   * galería del trámite, el cruce— y antes del render. Cuando iba al principio
   * del bucle, todo lo montado durante la actualización se dibujaba UNA vez
   * recto —el soportal entero un palmo más arriba durante un fotograma— y
   * encima pagaba compilar un shader sin parche que se tiraba al siguiente.
   */
  /**
   * COMPILAR LOS PROGRAMAS ANTES DE JUGAR.
   *
   * WebGL no compila un shader hasta que hace falta pintar algo con él, y
   * compilar un programa con esqueleto, color por vértice y la curvatura del
   * mundo encima cuesta cientos de milisegundos. Como cada personaje y cada
   * escenario traen materiales nuevos, esos cientos de milisegundos caían a
   * mitad de partida: el juego se paraba en seco un par de segundos la primera
   * vez que aparecían los perseguidores o al cambiar de barrio.
   *
   * Aquí se compilan todos de golpe, con la pantalla de carga puesta o durante
   * el cambio de escenario, que es donde parar no se nota.
   */
  precalentar() {
    if (!this.renderizador || !this.escenaThree || !this.camara) return;
    // La curvatura tiene que estar puesta ANTES de compilar, o se compila el
    // programa sin ella y hay que volver a compilarlo al primer fotograma.
    curvarEscena(this.escenaThree);
    this.renderizador.compile(this.escenaThree, this.camara);
  }

  _render() {
    curvarEscena(this.escenaThree);
    if (this.compositor) this.compositor.render();
    else this.renderizador.render(this.escenaThree, this.camara);
  }

  _bucle = () => {
    if (!this.animando) return;
    requestAnimationFrame(this._bucle);

    const ahora = performance.now();
    let dt = (ahora - this.relojAnterior) / 1000;
    this.relojAnterior = ahora;

    // Tope de dt: evita el "salto" tras volver de segundo plano.
    dt = Math.min(dt, DT_MAXIMO);

    if (this.estado === 'jugando') {
      this._actualizarJuego(dt);
      // Solo vigilamos el rendimiento durante el juego: en los menús el
      // framerate baja por motivos que no dicen nada del hardware.
      this.vigilante.registrar(dt);
    } else if (this.estado === 'intro') {
      // La cinemática mueve cámara y poses; el mundo no avanza.
      if (this.intro.actualizar(dt, this.camara, this.jugador, this.perseguidor)) {
        this.arrancarCorrida();
      }
      this.escenario?.actualizar(dt, 0, this.jugador, this.velocidad);
      // La cámara la lleva la propia intro: nos saltamos el seguimiento normal.
      this._render();
      return;
    } else if (this.estado === 'cerco') {
      this._actualizarCerco(dt);
    } else if (this.estado === 'menu') {
      // La portada del juego ES la escena de la entrevista: el periodista de
      // pie, preguntando, con la calle detrás. Un fondo con el personaje
      // corriendo bajo un menú no cuenta nada; este cuenta de qué va el juego
      // antes de que nadie lea una línea.
      this.escenario?.actualizar(dt, 0, this.jugador, this.velocidad);
      this.intro.encuadrarMenu(dt, this.camara, this.jugador, this.perseguidor);

      this._render();
      return;
    } else {
      // En pausa seguimos animando al jugador y al perseguidor para que la
      // escena no se vea congelada, pero sin avanzar el mundo.
      this.jugador.actualizar(dt, this.velocidad);
      this.perseguidor.actualizar(dt, this.jugador, false);
      this.escenario?.actualizar(dt, 0, this.jugador, this.velocidad);
    }

    this._actualizarCamara(dt);

    // LA LUZ VIAJA DESPUÉS DE QUE EL BARRIO HAYA DICHO LO QUE QUIERE, y antes
    // de pintar. Va aquí y no dentro de _actualizarJuego por dos motivos: es el
    // único sitio por el que pasan todos los estados que mueven mundo —jugando,
    // cerco y pausa— y es el único que tiene el dt del fotograma a mano. El
    // fundido se mide con el reloj del juego, no con el de pared.
    //
    // En la intro y en el menú no llega, y da igual: allí no hay cruces.
    this.ambiente.actualizar(dt);

    // EL DECORADO DE LOS BARRIOS APARCADOS, A PLAZOS. Ver BaseScene:
    // levantar las treinta y dos manzanas de un barrio costaba de 350 a 615 ms
    // EN UN SOLO FOTOGRAMA, y ése era el congelón. Ahora se reparte con un
    // presupuesto por fotograma, y con seis milisegundos el reparto no se nota:
    // un fotograma normal de juego cuesta 0,4 ms medidos, así que aun con el
    // plazo puesto queda de sobra dentro de los 16,6 de sesenta por segundo.
    //
    // Se le da a UNO por fotograma —el primero que tenga faena— y no a todos:
    // dos barrios preconstruyéndose a la vez pagarían el presupuesto dos veces.
    for (const esc of this.escenariosVivos.values()) {
      if (esc.pendientes?.length) { esc.construirPendientes(6); break; }
    }

    // Con bloom vamos por el compositor; sin él, directo a pantalla.
    this._render();

    // La foto se saca AQUÍ, en el mismo fotograma en que se acaba de dibujar.
    //
    // No es un capricho de sitio: WebGL limpia el buffer de dibujo al terminar
    // el fotograma salvo que se pida `preserveDrawingBuffer`, y esa opción
    // cuesta rendimiento en todos los fotogramas para algo que se usa una vez
    // por partida. Leyendo justo después del render, el buffer todavía está.
    if (this._pedidoDeFoto) {
      this._pedidoDeFoto = false;
      try {
        // A MEDIA RESOLUCIÓN, pasando por un lienzo 2D. Codificar el JPEG del
        // lienzo entero (a ratio de píxel alto son millones de píxeles) tardaba
        // 300-400 ms SÍNCRONOS en pleno cerco: el círculo se congelaba un
        // instante justo en el momento más coreografiado del juego. La portada
        // imprime la foto a unos 350 px de ancho y en blanco y negro con trama:
        // 640 de ancho van sobrados, y el drawImage desde WebGL es barato.
        const ancho = Math.min(640, this.lienzo.width);
        const alto = Math.round(this.lienzo.height * (ancho / this.lienzo.width));
        this._lienzoFoto = this._lienzoFoto ?? document.createElement('canvas');
        this._lienzoFoto.width = ancho;
        this._lienzoFoto.height = alto;
        this._lienzoFoto.getContext('2d')
          .drawImage(this.lienzo, 0, 0, ancho, alto);
        this.fotoArresto = this._lienzoFoto.toDataURL('image/jpeg', 0.72);
      } catch (error) {
        // Un canvas "contaminado" no se puede leer. No pasa nada: la portada
        // sale sin foto.
        console.warn('[Foto] No se pudo capturar el arresto.', error);
        this.fotoArresto = null;
      }
    }
  };

  /**
   * El mundo está parado y el círculo se cierra. Cuando termina la animación
   * se decide qué interfaz sale: el medidor de escape si queda algún intento,
   * o directamente el fin de partida.
   */
  _actualizarCerco(dt) {
    // Si la captura pilló el mundo a medio girar, se endereza aquí, suave:
    // exponencial rápida, imperceptible en un par de fotogramas si el ángulo
    // era chico y un asentamiento visible y limpio si era grande.
    if (this.giroMundo) {
      const actual = this.pista.grupo.rotation.y * Math.exp(-5 * dt);
      if (Math.abs(actual) < 0.01) this._asentarGiroMundo();
      else for (const g of this._gruposMundo()) g.rotation.y = actual;
    }

    const t = this.cerco.actualizar(dt);
    // Los perseguidores se abalanzan al ritmo del CIERRE, no del total: desde
    // que el cerco tiene un tiempo muerto detrás (ver CERCO.SOSTENIDO), pasar
    // el progreso entero los dejaba llegando a cámara lenta y aterrizando
    // encima del jugador cuando los policías llevaban ya un segundo puestos.
    this.perseguidor.cercar(this.cerco.cierre, dt);
    this.escenario?.actualizar(dt, 0, this.jugador, this.velocidad);

    // La foto se pide DENTRO DEL SOSTENIDO, con el círculo ya cerrado y la
    // cámara parada. Se pedía a 0.82 del cerco viejo y salía movida: a esa
    // altura el encuadre todavía viajaba —se persigue a 2,4/s, o sea más de un
    // segundo— y lo que se imprimía al día siguiente era un fotograma de
    // tránsito con los policías a medio llegar. Ahora hay un trozo entero de
    // escena en el que no se mueve nada, y la foto sale de ahí: en cuanto el
    // sostenido lleva un cuarto de su recorrido, que son ~0,35 s de sobra
    // después de que la cámara haya llegado.
    if (this.cerco.quieto > 0.25 && !this.fotoArresto && !this._pedidoDeFoto) {
      this._pedidoDeFoto = true;
    }

    if (t < 1) return;

    // Siempre hay sorteo. Lo que cambia es la velocidad del selector: cada
    // captura de esta partida lo acelera, así que la oportunidad se encoge
    // sin llegar a desaparecer nunca. Esa curva es la que acaba la partida.
    this.capturas += 1;
    const velocidad = Math.min(
      CERCO.SELECTOR_VELOCIDAD_MAXIMA,
      CERCO.SELECTOR_VELOCIDAD + (this.capturas - 1) * CERCO.SELECTOR_ACELERACION,
    );

    this._establecerEstado('escape', {
      escenario: this.escenarioActual,
      jueces: CERCO.JUECES,
      velocidad,
      captura: this.capturas,
    });
  }

  _actualizarJuego(dt) {
    // ---- Velocidad --------------------------------------------------------
    // La BASE es la curva de dificultad: solo sube, pase lo que pase.
    this.velocidadBase = Math.min(
      VELOCIDAD.MAXIMA,
      this.velocidadBase + VELOCIDAD.ACELERACION * dt,
    );

    // La ACTUAL tropieza al chocar y vuelve a subir hacia la base.
    if (this.velocidad < this.velocidadBase) {
      this.velocidad = Math.min(
        this.velocidadBase,
        this.velocidad + VELOCIDAD.RECUPERACION * dt,
      );
    } else {
      this.velocidad = this.velocidadBase;
    }

    // Ya no hay nada que module la velocidad: la barra de aguante desapareció
    // con la comida. Se conserva la variable porque la usan el HUD, la
    // oscuridad del Apagón y el avance del mundo.
    const velocidadEfectiva = this.velocidad;

    // Distancia recorrida este fotograma. El mundo se mueve hacia el jugador.
    const avance = velocidadEfectiva * dt;

    this.distanciaTotal += avance;
    this.distanciaTramo += avance;

    // ---- Subsistemas ------------------------------------------------------
    this.pista.actualizar(avance);
    // Las chispas se mueven con el mundo, igual que los obstáculos: si no, el
    // polvo de las pisadas se queda flotando mientras la calle pasa por debajo.
    this.particulas.actualizar(dt, avance);
    // El latido del rojo de peligro: una escritura para todas las franjas.
    pulsarPeligro(dt);

    // La Bahía va techada, y su bóveda no puede atravesar la fachada de la
    // bifurcación: el escenario necesita saber dónde se acaba la calle.
    // Cuando no hay fachada en pista, no hay tope.
    // Y EL TOPE SE ADELANTA HASTA EL BORDE DE LA TRANSVERSAL. La bóveda del
    // mercado llegaba hasta la fachada, pero delante de la fachada ya no hay
    // mercado: hay un cruce. Con el tope en la fachada, los doce metros últimos
    // de bóveda pasaban por encima de la calzada transversal, que es techar una
    // esquina.
    this.escenario.zTope = this.bifurcacion.activa
      ? this.bifurcacion.z + BOCACALLE.FRENTE
      : null;

    // Dónde está el plano del cruce, para que el escenario abra el hueco del
    // decorado por el que se ve la bocacalle. Ver BaseScene.actualizar().
    this.escenario.zBocacalle = this.bifurcacion.activa ? this.bifurcacion.z : null;

    // DESPEJE: a 150 m del edificio la niebla empieza a retirarse y a 55 ya
    // se le ve la fachada entera —queda tiempo de sobra para colocarse en el
    // carril—. Al cruzar, bifurcacion.activa cae y el ambiente regresa solo.
    const dCruce = this.bifurcacion.activa ? -this.bifurcacion.z : Infinity;
    this.escenario.despejeObjetivo =
      Math.min(1, Math.max(0, (150 - dCruce) / (150 - 55)));

    // Y EL CARTEL SE RETIRA ANTES DE LLEGAR. Se quedaba puesto hasta el
    // instante de cruzar, que es justo cuando ya no hace falta —la decisión
    // está tomada y el carril, elegido— y justo cuando estorba: son los tres
    // segundos en que la fachada del edificio llena la pantalla, y el cartel
    // se le quedaba encima. Se va a los 50 m, con el despeje ya terminado.
    if (this.bifurcacion.activa && !this.senalRetirada && dCruce < DISTANCIA_RETIRAR_SENAL) {
      this.senalRetirada = true;
      this.alQuitarSenal();
    }

    // El Apagón necesita la velocidad para escalar la visibilidad.
    if (this.escenarioActual === 'apagon') {
      this.escenario.actualizar(dt, avance, this.jugador, velocidadEfectiva);
    } else {
      this.escenario.actualizar(dt, avance, this.jugador);
    }

    // Los obstáculos devuelven los datos del grupo recién generado: los
    // carriles libres son donde es seguro poner papeles y potenciadores.
    const grupo = this.obstaculos.actualizar(avance, this.velocidad);
    if (!this.tramite.activo) this._poblarGrupo(grupo);

    // Niveles elevados. Devuelve la altura del suelo bajo los pies, que puede
    // ser el asfalto o el tablado de una tarima.
    // Se le pasa la velocidad BASE, no la efectiva: el gestor dimensiona el
    // hueco saltable a partir del piso de velocidad que se deduce de ella, y
    // la base es la única que solo sube. Ver Elevado._generar().
    const alturaSuelo = this.elevado.actualizar(
      dt, avance, this.jugador, this.obstaculos, this.evidencia,
      this.velocidadBase,
    );
    this.jugador.establecerSuelo(alturaSuelo);

    this.evidencia.actualizar(dt, avance, this.jugador);
    this.potenciadores.actualizar(dt, avance);
    this._actualizarEfectos(dt);

    this.jugador.actualizar(dt, velocidadEfectiva);

    // ---- Aterrizaje -------------------------------------------------------
    // El salto sonaba al despegar y NADA al caer. Un salto sin golpe abajo se
    // siente flotando: el cuerpo baja pero no llega a ninguna parte.
    if (this.jugador.impactoAterrizaje > 0) {
      const f = Math.min(1, this.jugador.impactoAterrizaje);
      this.audio.aterrizar(f);

      // El polvo de la pisada, A LA ALTURA DE LA CINTURA y no en los pies. Es
      // la misma lección que dejó la estela (ver _emitirEstela): la cámara
      // está a cuatro metros de alto y el borde inferior del cuadro corta el
      // asfalto dos metros por detrás del corredor, así que todo lo que se
      // emite pegado al suelo se sale de cuadro en una décima de segundo.
      // Sale hacia los lados y casi sin subir, que es como se abre el polvo
      // cuando alguien planta los dos pies.
      this.particulas.estallido(this.jugador.x, this.jugador.y + 0.55, 0.5, {
        color: 0xd8cdb4,
        cantidad: Math.round(5 + f * 9),
        fuerza: 1.6 + f * 1.8,
        tam: 0.30, vida: 0.4, gravedad: 2.2, roce: 3.4, subida: 0.25,
      });

      // Y una sacudida de cámara CHICA. La del golpe es 0.5; esta llega a
      // 0.11 en el peor aterrizaje, o sea la quinta parte: se nota en el
      // cuerpo y no se confunde con haber chocado, que es lo que pasaría si
      // fueran parecidas. Por debajo de medio impacto no se sacude nada:
      // bajarse de un bordillo no mueve ninguna cámara.
      if (f > 0.5) this.sacudida = Math.max(this.sacudida, 0.05 + f * 0.06);
    }

    if (this.tramite.activo) {
      // Se quedan a la puerta del túnel, esperando a que salgas. Y sin pista
      // que esquivar: durante el trámite no hay obstáculos generándose.
      this.perseguidor.actualizar(dt, this.jugador, false);
    } else {
      this.perseguidor.actualizar(dt, this.jugador, false, this.obstaculos);
    }

    // ---- Recolección ------------------------------------------------------
    const potenciador = this.potenciadores.recoger(this.jugador);
    if (potenciador) this._activarPotenciador(potenciador);

    const recogido = this.evidencia.recoger(this.jugador);
    if (recogido.papeles > 0) {
      // IMPORTANTE: Durante el trámite, NO sumamos papeles aquí. Se registran en
      // tramite.contar() y se devuelven al salir (con el ×2 incluido). Si sumáramos
      // aquí ADEMÁS de sumar al salir, se contarían dos veces.
      if (!this.tramite.activo) {
        this.evidenciaPartida += recogido.papeles * this.multiplicadorEvidencia;
      }

      this.combo += 1;
      this.temporizadorCombo = RACHA.CADUCIDAD;
      this.audio.papel(this.combo);

      // El brillo, del color del escalón de racha en el que vas. Es toda la
      // recompensa que da la racha —no toca el marcador— y por eso tiene que
      // verse: sale donde está el jugador, no donde estaba el papel, porque lo
      // que se celebra es que lo cogiste TÚ.
      //
      // Y sale DELANTE de él, no encima. Ver ATRAPE: el punto viejo caía dentro
      // del cuerpo y media recogida no se dibujaba.
      const t = tramoRacha(this.combo);
      const atrapeY = this.jugador.y + ATRAPE.y;

      // Primero el fogonazo, que es el que dice CUÁNDO. El estallido tarda
      // medio segundo en desplegarse y a veinte metros por segundo eso son
      // diez metros de calle: sin un pico de luz en el primer fotograma, el
      // efecto se lee cuando el papel ya quedó atrás.
      this.particulas.fogonazo(this.jugador.x, atrapeY, ATRAPE.z, {
        // Luz, no el color del escalón: en PRIMERA PLANA ese color es la tinta
        // y el fogonazo salía negro. Ver RACHA.COLOR_FOGONAZO.
        color: RACHA.COLOR_FOGONAZO,
        // Anclado al personaje: ver Particulas.fogonazo. Sin esto, a velocidad
        // máxima el fogonazo le pasa a la cámara por dentro.
        arrastre: velocidadEfectiva,
      });
      this.particulas.estallido(this.jugador.x, atrapeY, ATRAPE.z, {
        color: t.color,
        cantidad: t.chispas,
        fuerza: 3.0 + this.combo * 0.03,
        sesgo: SESGO_ATRAPE,
      });
      if (this.combo === t.desde && t.nombre) {
        // Solo en el fotograma en que se sube de escalón, no en cada papel.
        // El anillo sí se queda a la altura de la cintura y en el eje del
        // cuerpo: es una onda que se abre en horizontal alrededor de quien
        // corre, no algo que salga de la mano.
        this.particulas.anillo(this.jugador.x, this.jugador.y + 0.9, 0.2, {
          color: t.color, cantidad: 30, radio: 6.5,
        });
      }

      // Dentro del trámite se cuenta el VALOR, no el número de piezas. Cada
      // pieza del reguero lleva sus papeles escritos —normalmente uno— y así lo
      // que vuelve al marcador es exactamente lo que levantaste, por dos.
      // Contando piezas había que multiplicar por una media al salir, y esa
      // media se separaba de la realidad en cuanto no todas valían lo mismo.
      if (this.tramite.activo) this.tramite.contar(recogido.papeles);
    }
    for (const ev of recogido.pruebas) {
      if (!this.pruebasPartida.includes(ev.nombre)) {
        this.pruebasPartida.push(ev.nombre);
      }
      this.audio.evidencia();

      // UN ARCHIVO NO ES UN PAPEL MÁS, y hasta ahora se recogía igual: el
      // mismo estallido del color de la racha y un sonido distinto. El sonido
      // solo llega si estás oyendo el juego, y estos son las cinco o seis
      // piezas de las que va la partida entera —lo que se publica al día
      // siguiente— frente a los cientos de papeles sueltos.
      //
      // Se distingue por COLOR y por FORMA, no por tamaño: el naranja es el de
      // la propia cápsula que acabas de atrapar —el mismo `pideLuz` que la
      // ilumina en la calle— y el anillo lo separa del estallido del papel,
      // que es esfera. Anillo Y estallido a la vez es lo que hace un
      // potenciador, y aquí no hace falta tanto: basta con que el fogonazo sea
      // más grande y venga en el color del archivo.
      this.particulas.fogonazo(this.jugador.x, this.jugador.y + ATRAPE.y, ATRAPE.z, {
        color: COLOR3D.naranja, cantidad: 6, tam: 1.15, vida: 0.2,
        arrastre: velocidadEfectiva,
      });
      this.particulas.estallido(this.jugador.x, this.jugador.y + ATRAPE.y, ATRAPE.z, {
        color: COLOR3D.naranja,
        cantidad: 16,
        fuerza: 4.2,
        tam: 0.36,
        sesgo: SESGO_ATRAPE,
      });
    }

    // El combo caduca si dejas de recoger.
    if (this.temporizadorCombo > 0) {
      this.temporizadorCombo -= dt;
      if (this.temporizadorCombo <= 0) this.combo = 0;
    }

    this._emitirEstela(dt, velocidadEfectiva);

    // El fogonazo del portazo se apaga solo, en poco más de medio segundo.
    if (this.destelloPortazo > 0) {
      this.destelloPortazo = Math.max(0, this.destelloPortazo - dt * 1.8);
    }

    // ---- Trámite ----------------------------------------------------------
    // Es un tramo aparte: sin obstáculos, sin bifurcación y sin captura. Se
    // resuelve entero aquí y se sale antes de tocar nada de lo demás.
    if (this.tramite.activo) {
      // EL VIRAJE DEL CENTRO SIGUE SU CURSO AQUÍ DENTRO. Este early-return se
      // saltaba bifurcacion.actualizar, así que el viraje de entrar de frente
      // quedaba CONGELADO en su primer instante durante los 340 metros del
      // pasillo… y al salir se descongelaba y disparaba entero su fogonazo
      // blanco —un velo de un segundo en plena calle nueva, que en un teléfono
      // se leía como «el juego se congela al salir del trámite»—. Con avance 0:
      // la fachada ya no existe y el soportal no viaja, solo corre el reloj.
      this.bifurcacion.actualizar(dt, 0);
      if (this.tramite.actualizar(avance)) {
        this._salirDelTramite();
        return;
      }
      this._publicarHUD(velocidadEfectiva);
      return;
    }

    // ---- Colisiones -------------------------------------------------------
    // Volando no se choca con nada: la cobertura aérea es un descanso, no otra
    // prueba. Es lo mismo que hace el jetpack del original.
    const golpe = this.jugador.volando
      ? null
      : this.obstaculos.comprobarColision(this.jugador);

    // ---- Roces ------------------------------------------------------------
    // Pasar a un palmo de algo sin tocarlo. El juego no decía NADA cuando
    // esquivabas por poco, y esquivar por poco es la mitad de lo que se hace
    // aquí: pasar a un dedo y pasar por el carril de al lado se sentían igual.
    //
    // No da papeles ni toca el marcador: es un acuse de recibo, no una
    // recompensa. Meterle economía convertiría el roce en algo que hay que
    // buscar, y buscar roces es la manera más rápida de chocar.
    //
    // EL UMBRAL SON 30 cm, y el número no es redondo por casualidad: sale de
    // medir los tres tipos de obstáculo con las cotas de balance.js.
    //
    //   carril de al lado      1,09 m   fijo, nunca es un roce
    //   colarse por debajo     0,35 m   FIJO TAMBIÉN: el obstáculo alto empieza
    //                                   a 1,25 y agachado mides 0,90, así que
    //                                   el hueco es el mismo SIEMPRE
    //   saltar justo            0..1,05  depende de cuándo saltaste
    //   a medio cambio de carril 0..1,09 depende de dónde te pilló
    //
    // La línea de en medio es la que fija el umbral. Agacharse deja 35 cm
    // exactos todas las veces: con el umbral en 45 sonaría en CADA agachada,
    // y un aviso que suena siempre deja de avisar de nada —pasaría de «uf, por
    // poco» a «has pulsado abajo»—. Por debajo de 30 solo entran las dos que
    // dependen de lo que hiciste.
    if (!golpe && !this.jugador.volando) {
      const roce = this.obstaculos.roceMasCerrado(this.jugador);
      if (roce && roce.margen < 0.30) {
        this.audio.rozar();

        // Y unas chispas POR DONDE PASÓ, que es lo que convierte el aviso en
        // información: te enteras de por dónde estuvo cerca sin tener que
        // reconstruirlo. Se saca del propio obstáculo, no de la posición del
        // jugador —de dónde estabas TÚ no se deduce por dónde te pasó—.
        const o = roce.obstaculo;
        const porEncima = this.jugador.y > o.centroY;
        if (porEncima) {
          // Le pasaste por encima: la raspadura va bajo los pies y sale hacia
          // atrás, como cuando la suela toca el borde de algo.
          this.particulas.chorro(this.jugador.x, this.jugador.y + 0.1, 0.45, {
            color: 0xffffff, cantidad: 3, dispersion: 0.35,
            empuje: { x: 0, y: 1.1, z: 2.6 },
            tam: 0.2, vida: 0.26, gravedad: 1.6, roce: 3,
          });
        } else {
          // Te pasó de lado: al costado, y hacia el lado por el que vino.
          const lado = Math.sign(o.x - this.jugador.x) || 1;
          this.particulas.chorro(this.jugador.x + lado * 0.45, this.jugador.y + 1.0, 0.45, {
            color: 0xffffff, cantidad: 3, dispersion: 0.3,
            empuje: { x: lado * 1.4, y: 0.6, z: 2.2 },
            tam: 0.2, vida: 0.26, gravedad: 1.2, roce: 3,
          });
        }
      }
    }

    if (golpe && this.jugador.recibirGolpe(golpe)) {
      this.audio.golpe();
      this.sacudida = CAMARA.SACUDIDA_GOLPE;

      // El choque cuesta velocidad y acerca a los perseguidores.
      // El frenazo se calcula sobre la BASE, no sobre la actual: si no, dos
      // golpes seguidos se multiplicarían entre sí y te dejarían clavado.
      this.velocidad = Math.max(
        VELOCIDAD.INICIAL * VELOCIDAD.PISO_TRAS_GOLPE,
        this.velocidadBase * VELOCIDAD.FRENAZO_POR_GOLPE,
      );
      this.perseguidor.acercarPorGolpe();
      this.combo = 0;

      // Al chocar, los papeles salen volando. Es literal —el estallido va en el
      // dorado del papel y hacia arriba y atrás— y remata la deformación del
      // personaje: el golpe se lee en el cuerpo y en lo que se le cae.
      //
      // También sale por delante, como el de recoger, pero MÁS ARRIBA y sin
      // sesgo: aquí no hay ninguna mano que se cierre, hay un fajo que se
      // suelta, y eso se reparte en todas direcciones. Lo único que se corrige
      // es que la mitad se dibujaba dentro del cuerpo: a z 0,3 el estallido
      // nacía dentro de la caja del jugador, que va de −0,35 a 0,35.
      this.particulas.estallido(this.jugador.x, this.jugador.y + 1.35, 0.55, {
        color: 0xf0e2b0, cantidad: 22, fuerza: 5.2, tam: 0.38,
        vida: 0.75, gravedad: 8, subida: 2.4,
      });

      const esc = obtenerEscenario(this.escenarioActual);
    }

    // ---- Condiciones de fin ----------------------------------------------
    // Ya solo hay una: que te alcancen. Quedarse a oscuras en el Apagón MATABA
    // por sí solo, y dejó de hacerlo al convertir la linterna en potenciador:
    // ahora los papeles brillan, así que sin luz sigues viendo por dónde vas
    // —peor, pero viendo—. Una muerte por falta de un ítem que ya no está
    // garantizado sería un castigo por mala suerte, no por mal juego.
    if (this.perseguidor.haAtrapado() || this.jugador.estaAgotado()) {
      this.terminarPartida('captura');
      return;
    }

    // ---- Bifurcación ------------------------------------------------------
    // A diferencia de todo lo demás, esto NO abre un menú: el pórtico viene
    // hacia el jugador y el carril en el que lo cruce decide la ruta.
    const restante = TRAMO.LONGITUD - this.distanciaTramo;

    if (!this.enAproximacion && restante <= TRAMO.DISTANCIA_AVISO) {
      this._iniciarAproximacionBifurcacion();
    }

    // El corredor se vacía más tarde que el aviso, a propósito: ver
    // _limpiarCorredor().
    if (this.enAproximacion && !this.corredorLimpio
        && restante <= TRAMO.DISTANCIA_LIMPIEZA) {
      this._limpiarCorredor();
    }

    // El segundo destino se preconstruye unos metros después del primero:
    // dos barrios en el mismo fotograma serían un segundo entero de tirón.
    if (this.barrioPorPreparar && restante <= TRAMO.DISTANCIA_LIMPIEZA - 60) {
      const pendiente = this.barrioPorPreparar;
      this.barrioPorPreparar = null;
      this._prepararBarrio(pendiente);
    }

    // El carril viaja hasta aquí porque decide DÓNDE se dobla: por un lado,
    // en el eje de la transversal; de frente, en la puerta. Ver Bifurcacion.
    if (this.bifurcacion.actualizar(dt, avance, this.jugador.carril)) {
      this._cruzarBifurcacion(this.jugador.carril);
      return;
    }
    this._girarMundo();

    this._publicarHUD(velocidadEfectiva);
  }

  /**
   * Vuelca el estado al HUD. Está aparte porque el trámite sale del bucle
   * antes de llegar al final y también necesita pintar.
   */
  _publicarHUD(velocidadEfectiva) {
    const cercania = this.perseguidor.cercania();
    // El zumbido se actualiza AQUÍ y no en el bucle, y no es por comodidad:
    // este método es el único al que llegan los dos caminos —la corrida normal
    // y el trámite, que se sale del bucle antes de llegar al final—. Puesto en
    // el bucle, el zumbido se quedaba congelado en su último valor durante los
    // trescientos cuarenta metros del pasillo.
    this.audio.actualizarTension(cercania);

    this.alActualizarHUD({
      papeles: this.evidenciaPartida,
      distancia: Math.floor(this.distanciaTotal),
      velocidad: velocidadEfectiva,
      cercania,
      golpesRestantes: JUGADOR.GOLPES_MAXIMOS - this.jugador.golpes,
      combo: this.combo,
      // El récord de siempre, tercera línea de la columna. Es la cifra que la
      // referencia pone bajo «MEJOR PUNTUACIÓN»: se compite contra uno mismo
      // sin tener que salir a mirar la tabla.
      record: this.cuaderno?.mejorEvidencia ?? 0,
      escenario: this.escenarioActual,
      progresoTramo: this.distanciaTramo / TRAMO.LONGITUD,
      linterna: this.escenarioActual === 'apagon' ? this.escenario.fraccionLinterna() : null,
      // El HUD pinta una ficha por tipo de evidencia con su contador.
      pruebas: this.pruebasPartida,
      // Destello blanco que tapa el corte de escenario al tomar un desvío.
      destello: Math.max(this.bifurcacion.destello(), this.destelloPortazo),
      // Marcador del expediente mientras se está dentro del túnel del centro.
      tramite: this.tramite.activo
        ? {
          // En EVIDENCIA, no en piezas: el marcador dice «12 / 300» sobre los que
          // te quitaron, que es la única cuenta que el jugador puede comprobar.
          recogidos: this.tramite.evidenciaRecuperada(),
          total: this.tramite.confiscados,
          // Cuántos han quedado ya atrás. Es con lo que el HUD decide si vas
          // por encima o por debajo de la mitad, que es la cuenta del tramo.
          pasados: this.tramite.piezasPasadas(),
          progreso: this.tramite.progreso(),
          institucion: this.tramite.institucion?.nombre ?? 'TRÁMITE',
        }
        : null,
      // ¿Va corriendo por arriba? El HUD lo usa para avisar del borde.
      porArriba: this.jugador.vaPorArriba || this.jugador.volando,
      // Potenciadores activos, con lo que les queda.
      efectos: this._efectosParaHUD(),
    });
  }

  // -------------------------------------------------------------------------
  // CÁMARA
  // -------------------------------------------------------------------------

  _actualizarCamara(dt) {
    // El angular, antes que nada y para TODOS los estados: la cinemática y el
    // cerco lo quieren en su valor de diseño, y quien se encarga de devolverlo
    // ahí es esta llamada. Si sólo se empujara dentro de la carrera, al ser
    // capturado el corro se vería con el angular de los treinta metros por
    // segundo, que es donde estaba la velocidad el fotograma anterior.
    this._empujarFov(dt);

    // El cerco tiene su propio plano: la cámara se sale de la espalda del
    // jugador y da la vuelta para enseñar el corro.
    if (this.estado === 'cerco') {
      this._encuadrarCerco(dt);
      return;
    }

    // LA CINEMÁTICA DEL DESVÍO, TERCERA VERSIÓN, Y ESTA VEZ COMO LA HACE EL
    // GÉNERO. Ni la cámara gira en su sitio (v1: paralajes opuestos, mareo) ni
    // orbita al personaje (v2: correcto en papel, torpe en pantalla —el
    // encuadre entero se trasladaba y el suelo barría en diagonal—).
    //
    // Lo que gira es EL MUNDO: ver _girarMundo(). La calle nueva ya está
    // generada en la transversal, cruzada delante del jugador, y durante el
    // viraje rota 90° alrededor de la esquina hasta quedar de frente. Es
    // exactamente lo que hace Temple Run: el personaje dobla, el escenario se
    // reorienta a su alrededor, y la cámara NUNCA deja de estar a su espalda.
    //
    // A la cámara le queda lo que le toca en ese esquema: el PESO. El
    // personaje se ladea hacia el giro y la cámara lo acompaña con una deriva
    // corta hacia ese lado —posición y mira juntas, sin rotar el encuadre—,
    // que es la parte de «el cuerpo se va para allá» sin ninguna de las dos
    // fuentes de mareo.
    const cine = this.bifurcacion.cinematicaGiro();
    const fCine = cine ? cine.fuerza : 0;
    const dirCine = cine ? cine.dir : 0;
    // El personaje se ladea hacia la esquina: ~46° en el pico. El signo es
    // negativo porque rotation.y = π mira a −Z y restarle gira hacia +X.
    this.jugador.giroCinematico = -dirCine * 0.8 * fCine;

    // LA CÁMARA ORBITA AL JUGADOR, NO GIRA EN SU SITIO. Y esto era el fallo.
    //
    // Antes la cámara hacía dos cosas a la vez que se contradecían: se
    // DESPLAZABA hacia el lado elegido (+2.4 en X hacia la derecha al doblar a
    // la derecha) y además giraba la mirada hacia ese mismo lado. Una cosa es
    // moverse de lado y la otra es girar, y las dos juntas producen paralajes
    // opuestos: lo cercano se va hacia un lado y lo lejano hacia el otro. Eso
    // es exactamente lo que marea, y no es una metáfora —es el conflicto que
    // provoca el mareo de movimiento en cualquier cámara—.
    //
    // Y encima el giro se leía AL REVÉS. La cámara rotaba 42° hacia la esquina
    // mientras el personaje solo rotaba 38°, así que él se salía del cuadro por
    // el lado contrario. Lo que el ojo lee primero no es hacia dónde apunta la
    // cámara, es hacia dónde se va el personaje: al irse a la izquierda en un
    // giro a la derecha, el giro entero se leía a la izquierda.
    //
    // Doblar una esquina es UNA sola cosa: la cámara recorre un arco ALREDEDOR
    // del personaje. Al girar a la derecha se queda a su izquierda —detrás de
    // su nueva dirección— y lo mira desde ahí. El personaje se queda clavado en
    // el centro del cuadro y lo que rota es el mundo, que es lo que pasa de
    // verdad cuando se doblan noventa grados de calle.
    //
    // Con la órbita ya no hace falta el rotateY de después del lookAt: la
    // posición y la mira salen del mismo ángulo, así que no pueden decir cosas
    // distintas.
    // La deriva del peso: corta, y la MISMA para posición y mira, así que el
    // encuadre se traslada sin girar y no puede fabricar paralajes opuestos.
    //
    // Y HACIA FUERA DEL GIRO, no hacia dentro. Derivar hacia dentro parece lo
    // natural («la cámara acompaña») y hace lo contrario: trasladar el cuadro
    // hacia la derecha empuja al personaje hacia la IZQUIERDA de la pantalla,
    // y el giro vuelve a leerse al revés. La cámara se queda rezagada hacia el
    // lado de fuera —como un cámara que corre detrás y toma la curva abierta—
    // y así el personaje cae hacia el lado al que dobla, que es donde el ojo
    // lo espera.
    const derivaGiro = -dirCine * 0.7 * fCine;
    const pivoteX = this.jugador.x * CAMARA.SEGUIMIENTO_LATERAL + derivaGiro;

    // Sigue al jugador lateralmente con retraso: da peso sin marear.
    //
    // Y MÁS DESPACIO justo después de zafarse del cerco: la cámara viene del
    // picado, y volver al encuadre de carrera al ritmo de juego era un
    // latigazo. Durante la ventana de recuperación amortigua a un tercio.
    this.recuperacionCamara = Math.max(0, this.recuperacionCamara - dt);
    const amortiguacion = this.recuperacionCamara > 0 ? 3 : CAMARA.AMORTIGUACION;
    const t = 1 - Math.exp(-amortiguacion * dt);

    // CORRIENDO POR ARRIBA la cámara se abre. Ver CAMARA.ARRIBA_*: sobre la
    // plataforma hay que ver el borde —que es de donde te caes— y el final del
    // tramo, y con el encuadre de calle no se ve ni una cosa ni la otra.
    //
    // La transición va con su propio reloj y no con el amortiguador de arriba,
    // porque ese está afinado para el seguimiento lateral —que tiene que ser
    // rápido— y aquí un cambio así de grande a esa velocidad se lee como un
    // tirón. Medio segundo.
    // EL VUELO CUENTA COMO IR POR ARRIBA. Estaba excluido con un `&& !volando`,
    // y por eso al coger la cobertura aérea el personaje se iba al tercio
    // SUPERIOR del cuadro —por encima del horizonte— mientras la cámara se
    // quedaba abajo. En la referencia pasa lo contrario: el personaje no sale
    // nunca del tercio inferior, y lo que hay encima de él es cielo vacío.
    const arriba = this.jugador.vaPorArriba || this.jugador.volando;
    this.mezclaArriba = (this.mezclaArriba ?? 0)
      + ((arriba ? 1 : 0) - (this.mezclaArriba ?? 0))
      * (1 - Math.exp(-dt / (CAMARA.ARRIBA_TRANSICION / 3)));
    const m = this.mezclaArriba;

    // SUBIR DE NIVEL Y SALTAR NO SON LO MISMO, y con un factor único los dos
    // se seguían igual de mal: subirse a una tarima dejaba al personaje en el
    // centro exacto de la pantalla y encogido, y un salto normal apenas movía
    // el encuadre.
    //
    // Se parten en dos. La ALTURA DEL SUELO —tarima, o vuelo— se sigue casi
    // entera (0.90): la cámara sube contigo y el personaje se queda donde
    // estaba en el cuadro. El SALTO se sigue a medias (0.45): que el encuadre
    // ceda un poco es lo que hace que un salto se sienta salto.
    //
    // Y la diferencia entre este factor y el de la mira (más abajo) es lo que
    // ABRE EL PICADO al subir, que es lo que dice la referencia: «la cámara
    // sube con él y ADEMÁS pica más hacia abajo». Antes esa diferencia era de
    // 0.08 y valía tres cuartos de grado; ahora son tres grados en el pico del
    // salto y siete en pleno vuelo.
    const alturaSuelo = this.jugador.volando ? this.jugador.y : (this.jugador.alturaSuelo ?? 0);
    const alturaSalto = this.jugador.volando ? 0 : this.jugador.y - alturaSuelo;

    const yObjetivo = CAMARA.POSICION.y
      + alturaSuelo * CAMARA.SEGUIMIENTO_SUELO
      + alturaSalto * CAMARA.SEGUIMIENTO_SALTO
      + CAMARA.ARRIBA_ALTURA_EXTRA * m;
    this.camara.position.y += (yObjetivo - this.camara.position.y) * t;

    const xObjetivo = pivoteX;
    this.camara.position.x += (xObjetivo - this.camara.position.x) * t;

    // Vuelta a la profundidad de siempre. Solo se mueve tras un cerco, pero
    // sin esta línea el encuadre se quedaría descolocado al reanudar.
    const zObjetivo = CAMARA.POSICION.z
      + CAMARA.ARRIBA_DISTANCIA_EXTRA * m;
    this.camara.position.z += (zObjetivo - this.camara.position.z) * t;

    // Sacudida por golpe, con decaimiento exponencial.
    if (this.sacudida > 0.001) {
      this.sacudida *= Math.exp(-6 * dt);
      this.camara.position.x += (Math.random() - 0.5) * this.sacudida;
      this.camara.position.y += (Math.random() - 0.5) * this.sacudida;
    } else {
      this.sacudida = 0;
    }

    // La mira acompaña al mismo ritmo que la posición. Si siguiera al jugador
    // MENOS que la cámara, cada cambio de carril giraría el encuadre hacia
    // fuera y la calle se vería de lado; si lo siguiera más, la cámara
    // orbitaría alrededor del personaje. Van juntas.
    this._mirar(
      pivoteX,
      CAMARA.MIRA.y + alturaSuelo * CAMARA.SEGUIMIENTO_SUELO_MIRA
        + alturaSalto * CAMARA.SEGUIMIENTO_SALTO_MIRA
        - CAMARA.ARRIBA_MIRA_BAJA * m,
      CAMARA.MIRA.z,
      this.recuperacionCamara > 0 ? 3 : 14,
      dt,
    );

    // --- EL TECHO DEL PERSONAJE ----------------------------------------------
    //
    // Los factores de arriba dicen CUÁNTO acompaña la cámara. Esto dice algo
    // distinto y más fuerte: que el personaje no se sale por arriba, pase lo
    // que pase. Y hacía falta porque los factores solos no llegan.
    //
    // Medido proyectando su caja: en la calle un salto normal llevaba la cabeza
    // a 0,014 de la pantalla —el borde— y desde el tablado a −0,70, o sea fuera
    // del cuadro. Ahí es donde vive el cartel de salida de la bifurcación y el
    // HUD, y por eso el jugador lo contaba como «los letreros lo tapan»: no es
    // que los letreros estorben, es que el salto lo metía debajo.
    //
    // Se barrieron los factores de seguimiento y no bastan: para dejar el
    // tablado en su sitio hacía falta que la mira siguiera el suelo a 2,6 veces
    // su altura, que ya no es seguir sino inventarse el encuadre, y aun así el
    // salto desde arriba se salía. La razón de fondo es que la altura sube
    // hasta 6,75 m —tablado 3,15, salto con botas 3,60— y ningún factor fijo
    // sirve para un rango así.
    //
    // Así que se mide dónde ha quedado y se corrige lo que falte, subiendo
    // cámara y mira LA MISMA cantidad: trasladar las dos no cambia el picado ni
    // gira nada, sólo baja el mundo en el cuadro. Es la única corrección que no
    // puede fabricar paralajes opuestos, que es la lección de §6.5.
    this._alzaCamara = this._alzaCamara ?? 0;
    // ANTES DE PROYECTAR, ACTUALIZAR LA MATRIZ. `project()` usa
    // `matrixWorldInverse`, y Three sólo la recalcula al renderizar: sin esta
    // línea la corrección leía la cámara de HACE UN FOTOGRAMA —o de mucho
    // antes, en las pruebas que no pintan— y salían números imposibles, como
    // que un punto más alto proyectara más abajo que otro más bajo.
    this.camara.updateMatrixWorld(true);
    // 1.60 sobre los pies: es el alto real del modelo con sombrero, medido con
    // su caja envolvente (1,56 sobre el suelo). Se usa una constante y no un
    // Box3 por fotograma a propósito: recorrer el esqueleto sesenta veces por
    // segundo para saber lo que ya se sabe es pagar por nada.
    const cabeza = new THREE.Vector3(this.jugador.x, this.jugador.y + 1.60, 0)
      .project(this.camara);
    const yCabeza = (1 - cabeza.y) / 2;
    if (import.meta.env.DEV) this._yCabeza = yCabeza;
    // Cuánto mide en metros la pantalla a la distancia del personaje: es el
    // cambio de escala entre «fracción de cuadro» y «metros de cámara».
    const distancia = this.camara.position.z - this.jugador.y * 0 + 0.0;
    const altoVisible = 2 * Math.abs(distancia)
      * Math.tan(THREE.MathUtils.degToRad(this.camara.fov) / 2);
    let objetivoAlza = this._alzaCamara;
    if (yCabeza < CAMARA.TECHO_PERSONAJE) {
      objetivoAlza += (CAMARA.TECHO_PERSONAJE - yCabeza) * altoVisible;
    } else if (yCabeza > CAMARA.TECHO_PERSONAJE + CAMARA.HOLGURA_TECHO) {
      // Ya sobra sitio: la corrección se devuelve, o el encuadre se quedaría
      // alto para siempre después del primer salto.
      objetivoAlza -= (yCabeza - CAMARA.TECHO_PERSONAJE - CAMARA.HOLGURA_TECHO) * altoVisible;
    }
    objetivoAlza = Math.max(0, objetivoAlza);
    // Sube deprisa y baja despacio: llegar tarde a corregir es que se salga del
    // cuadro, y volver deprisa es un tirón al aterrizar.
    const ritmo = objetivoAlza > this._alzaCamara ? 18 : 4;
    this._alzaCamara += (objetivoAlza - this._alzaCamara) * (1 - Math.exp(-ritmo * dt));
    if (this._alzaCamara > 0.001) {
      this.camara.position.y += this._alzaCamara;
      this._mirar(
        pivoteX,
        CAMARA.MIRA.y + alturaSuelo * CAMARA.SEGUIMIENTO_SUELO_MIRA
          + alturaSalto * CAMARA.SEGUIMIENTO_SALTO_MIRA
          - CAMARA.ARRIBA_MIRA_BAJA * m
          + this._alzaCamara,
        CAMARA.MIRA.z,
        this.recuperacionCamara > 0 ? 3 : 14,
        dt,
      );
    }

    // El polvo de la esquina. La rotación ya no se aplica aquí —la hace el
    // arco de arriba, posición y mira a la vez— y por eso desapareció el
    // rotateY que había en este sitio: era el que peleaba con el desplazamiento
    // lateral y el que sacaba al personaje del cuadro.
    if (fCine > 0.001) this._cortinaDePolvo(dt, fCine, dirCine);

    // Banqueo al tomar un desvío. Por el mismo motivo, después del lookAt.
    const banqueo = this.bifurcacion.banqueoCamara() + this._ladeoEspecial(dt);
    if (banqueo !== 0) this.camara.rotateZ(banqueo);
  }

  /**
   * Ladeo de cámara en los tramos especiales, en radianes.
   *
   * El giro que se hace al entrar en un túnel es lo que convierte ese momento
   * en un momento: la calle se tuerce, el horizonte deja de estar a nivel y de
   * pronto el sitio se siente distinto. Los tramos especiales —el pasillo del
   * ente de control, y correr por encima de las tarimas— no tenían nada de
   * eso: la misma cámara recta de siempre, y por eso se leían como más de lo
   * mismo con otro decorado.
   *
   * Va con un balanceo lento en vez de una inclinación fija. Una inclinación
   * fija de tres grados se deja de percibir a los diez segundos —el ojo la
   * adopta como nuevo horizonte— y si es mayor, marea. Un balanceo no se
   * adopta nunca, porque nunca se queda quieto.
   *
   * Entra y sale con una rampa: aparecer torcido de golpe se lee como fallo.
   */
  _ladeoEspecial(dt) {
    const objetivo = this.tramite.activo ? 1 : (this.jugador.vaPorArriba ? 0.55 : 0);
    const t = 1 - Math.exp(-2.2 * dt);
    this.fuerzaLadeo += (objetivo - this.fuerzaLadeo) * t;

    if (this.fuerzaLadeo < 0.002) return 0;
    this.relojLadeo += dt;
    return Math.sin(this.relojLadeo * 0.62) * CAMARA.LADEO_ESPECIAL * this.fuerzaLadeo;
  }

  /**
   * Plano del cerco: la cámara se abre en tres cuartos desde arriba para que
   * se vea el círculo entero. Desde la espalda del jugador esta escena no se
   * entiende —los perseguidores lo tapan y los policías caen fuera de cuadro—,
   * y el sentido de la secuencia es precisamente que se vea.
   */
  /**
   * Apunta la cámara con retraso: la mira persigue el objetivo en vez de
   * clavarse en él. A velocidad alta (14/s) el juego normal se siente igual
   * —el retraso es de milésimas— pero un cambio de encuadre grande (entrar o
   * salir del cerco) se recorre en unos fotogramas en vez de en uno.
   */
  _mirar(x, y, z, velocidad, dt) {
    this._miraObjetivo.set(x, y, z);
    if (!this.miraActual) this.miraActual = this._miraObjetivo.clone();
    else this.miraActual.lerp(this._miraObjetivo, 1 - Math.exp(-velocidad * dt));
    this.camara.lookAt(this.miraActual);
  }

  _encuadrarCerco(dt) {
    const t = 1 - Math.exp(-2.4 * dt);

    this.camara.position.x += (this.jugador.x + CERCO.CAMARA.x - this.camara.position.x) * t;
    this.camara.position.y += (CERCO.CAMARA.y - this.camara.position.y) * t;
    this.camara.position.z += (CERCO.CAMARA.z - this.camara.position.z) * t;

    // Al mismo ritmo que la posición: el paneo de bajar la vista al corro es
    // parte de la escena, no un corte.
    this._mirar(this.jugador.x, CERCO.CAMARA_MIRA_Y, CERCO.CAMARA_MIRA_Z, 2.4, dt);
  }

  // -------------------------------------------------------------------------
  // ESTADO
  // -------------------------------------------------------------------------

  _establecerEstado(nuevo, datos = {}) {
    this.estado = nuevo;
    this.alCambiarEstado(nuevo, datos);
  }

  /**
   * Cambia el personaje sin empezar partida, para la vista previa del menú.
   * Es la diferencia entre elegir entre dos nombres y elegir entre dos
   * personajes: en el fondo se ve correr al que estás señalando.
   */
  previsualizarPersonaje(nombre) {
    if (nombre === this.cuaderno.personajePreferido) return;
    this.cuaderno.personajePreferido = nombre;
    this.jugador.cambiarPersonaje(nombre);
    // cambiarPersonaje() reinicia el modelo, así que la pose de entrevista se
    // pierde. En el menú hay que volver a ponerla o el recién elegido aparece
    // de pie y de espaldas mientras el otro estaba entrevistando.
    if (this.estado === 'menu') {
      this.intro.encuadrarMenu(0, this.camara, this.jugador, this.perseguidor);
    }
  }

  /** Vuelve al menú principal. */
  volverAlMenu() {
    this.controles.desactivar();
    // El cinturón de seguridad del zumbido: aquí llegan todos los caminos de
    // vuelta a la portada, incluidos los que no pasan por la captura ni por
    // abandonar. Es idempotente, así que pararlo dos veces no cuesta nada;
    // dejarlo sonando en la portada, sí.
    this.audio.pararTension();
    this.jugador.reiniciar();
    this.obstaculos.reiniciar();
    this.evidencia.reiniciar();
    this.perseguidor.reiniciar();
    this.bifurcacion.reiniciar();
    this._asentarGiroMundo();
    this.elevado.reiniciar();
    this.tramite.limpiar();
    this.cerco.limpiar();
    this.potenciadores.reiniciar();
    this.potenciadores.establecerDesbloqueados(this.cuaderno.potenciadoresDesbloqueados());
    this._limpiarEfectos();
    this.velocidad = VELOCIDAD.INICIAL;
    this.velocidadBase = VELOCIDAD.INICIAL;
    this.enAproximacion = false;
    this.corredorLimpio = false;
    this.finPendiente = null;
    // El despeje del cruce no se queda puesto en el menú: la fachada que lo
    // justificaba ya no está, y el telón de fondo volvía sin niebla y con las
    // luces subidas para siempre. Solo el objetivo: el regreso es en fundido.
    if (this.escenario) this.escenario.despejeObjetivo = 0;
    // Y si te capturaron a medio cruce, el fundido de ambiente se remata aquí:
    // la portada tiene que enseñar el barrio con SU luz, no con la mitad de la
    // del vecino. Mismo criterio que _asentarGiroMundo.
    this.ambiente.asentar();
    this._establecerEstado('menu');
  }
}
