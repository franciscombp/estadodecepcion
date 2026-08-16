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
import { obtenerEscenario } from '../config/escenarios.js';
import { CATALOGO_POTENCIADORES } from '../config/balance.js';
import { PERSONAJES } from '../config/personajes.js';
import { Controles } from '../utils/controls.js';
import { curvarEscena } from '../utils/curvatura.js';
import { remateCaptura, remateExhausto, citaVerificada } from '../config/textos.js';
import {
  VELOCIDAD, TRAMO, CAMARA, JUGADOR, CARRILES, CERCO, EVIDENCIA,
  POTENCIADORES, SENTENCIAS, TRAMITE, RACHA, tramoRacha,
} from '../config/balance.js';
import { BLOOM, CALIDAD } from '../config/estilo.js';
import { VigilanteRendimiento } from '../utils/calidad.js';

// Tope de delta time. Si la pestaña estuvo en segundo plano, dt puede valer
// varios segundos; sin este tope el jugador aparecería atravesando obstáculos.
const DT_MAXIMO = 1 / 20;

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

    // Callbacks hacia la UI. Los rellena main.js.
    this.alCambiarEstado = () => {};
    this.alActualizarHUD = () => {};
    this.alMostrarAviso = () => {};
    /** Baja el cartel de salida con los tres destinos. */
    this.alSeñalizar = () => {};
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
    });
    this.renderizador.setSize(window.innerWidth, window.innerHeight);
    this.renderizador.setPixelRatio(
      Math.min(window.devicePixelRatio, this.calidad.pixelRatioMaximo),
    );
    // Las sombras son el mayor coste del pipeline y con esta estética no
    // aportan: el volumen lo da el flatShading y el contraste de la niebla.
    this.renderizador.shadowMap.enabled = false;

    // CINEON Y NO ACES. Los dos comprimen los altos para que el neón se sature
    // sin quemarse a blanco, que es lo que hacía falta; la diferencia está en el
    // camino hasta ahí. ACES es una curva de cine: le quita saturación a todo el
    // tramo medio a propósito, porque busca que la imagen parezca rodada. En una
    // paleta de colores planos eso se traduce en que un toldo naranja llega a
    // pantalla como un naranja terroso y un cielo azul como un gris azulado, y
    // el escenario entero se apaga.
    //
    // Cineon comprime bastante menos el medio, así que los colores llegan a
    // pantalla parecidos a como están escritos en la paleta. La exposición baja
    // un poco para compensar que ahora los medios pesan más.
    this.renderizador.toneMapping = THREE.CineonToneMapping;
    this.renderizador.toneMappingExposure = 1.05;

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

    this.camara.fov = fov;
    this.camara.updateProjectionMatrix();
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
    this.evidencia = new CoinManager(this.escenaThree);
    this.perseguidor = new Chaser(this.escenaThree);
    this.rutas = new Rutas();
    this.bifurcacion = new Bifurcacion(this.escenaThree);
    this.elevado = new ElevadoManager(this.escenaThree);
    this.tramite = new TramiteManager(this.escenaThree);
    this.cerco = new Cerco(this.escenaThree);
    this.intro = new Intro(this.escenaThree);
    this.potenciadores = new PowerUpManager(this.escenaThree);
    this.potenciadores.establecerDesbloqueados(this.cuaderno.potenciadoresDesbloqueados());

    // Las chispas cuelgan de la RAÍZ de la escena, no del grupo del escenario:
    // ese grupo se destruye entero al cambiar de temporada y se llevaría por
    // delante el pozo. Aquí sobreviven a los cambios de escena.
    this.particulas = new Particulas(
      this.escenaThree,
      this.calidad.particulas ? (this.calidad.pozoParticulas ?? 320) : 0,
    );
    this.particulas.redimensionar(window.innerHeight);
    // Resto fraccionario de la estela: emitir `Math.round(0.4)` partículas por
    // fotograma es emitir cero para siempre.
    this.restoEstela = 0;

    this.escenario = null;
    // El fondo del menú es la temporada en la que se va a retomar, no siempre
    // la Bahía. Así la portada dice a dónde vas antes de que pulses nada.
    this._cambiarEscenario(this.cuaderno.ultimoEscenario, false);
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
  _precargarPista() {
    this.obstaculos.precargar(this.velocidad, (carrilesLibres, z, gap) => {
      this.evidencia.generarHilera(carrilesLibres, z, gap, Math.random() < 0.33);
    });
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
    const carrilEvidencia = this.evidencia.generarHilera(
      grupo.carrilesLibres,
      grupo.z,
      grupo.gap,
      Math.random() < 0.33,
    );

    const libres = grupo.carrilesLibres.filter((c) => c !== carrilEvidencia);
    if (libres.length === 0) return;

    // Lo único que se ofrece en el hueco es un potenciador. Antes competía
    // con la comida, y la comida se fue: ver CATALOGO_POTENCIADORES.
    const zHueco = grupo.z - grupo.gap / 2;
    this.potenciadores.intentarGenerar(libres, zHueco);
  }

  /**
   * Cambia de escenario, aplicando su paleta a todos los subsistemas.
   * @param {string} id
   * @param {boolean} anunciar ¿Mostrar el cartel del escenario?
   */
  _cambiarEscenario(id, anunciar = true) {
    if (this.escenario) this.escenario.destruir();

    this.escenarioActual = id;
    this.escenario = crearEscenario(id, this.escenaThree, this.calidad);

    const config = obtenerEscenario(id);
    const colores = this.escenario.obtenerColores();

    this.pista.aplicarTema(colores);
    this.obstaculos.aplicarTema(colores, id);
    this.evidencia.aplicarTema(config);
    this.elevado.aplicarTema(colores, id);

    this.rutaPartida.push(id);
    this.distanciaTramo = 0;

    // aplicarTema() vació la pista (los obstáculos tenían los colores viejos),
    // así que hay que volver a llenarla con la paleta nueva.
    this._precargarPista();

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
      this.alMostrarAviso({
        tipo: 'escenario',
        titulo: config.nombre,
        subtitulo: config.subtitulo,
      });
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

    this.intro.saltar();
    this.jugador.reiniciar();
    this.intro.soltarPose(this.jugador);
    this.perseguidor.modelo.visible = true;

    const config = obtenerEscenario(this.escenarioActual);
    this.audio.cambioEscenario();
    this.alMostrarAviso({
      tipo: 'escenario',
      titulo: config.nombre,
      subtitulo: config.subtitulo,
    });

    this.controles.activar();
    this.relojAnterior = performance.now();
    this._establecerEstado('jugando');
  }

  pausar() {
    if (this.estado !== 'jugando') return;
    this._establecerEstado('pausa');
  }

  reanudar() {
    if (this.estado !== 'pausa') return;
    // Reseteamos el reloj para que el tiempo en pausa no cuente como dt.
    this.relojAnterior = performance.now();
    this._establecerEstado('jugando');
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

    this.jugador.caer();
    this._limpiarEfectos();
    this.fotoArresto = null;
    this.perseguidor.atrapar();
    this.controles.desactivar();
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

    // El cartel de salida baja del techo de la pantalla y se queda hasta que
    // se cruce. Lo que dice sale de la propia bifurcación, no de un texto
    // aparte: dos fuentes acabarían diciendo cosas distintas.
    this.alSeñalizar(senal.destinos, senal.centroEsPeligro);

    const esc = obtenerEscenario(this.escenarioActual);
    this.alMostrarAviso({
      tipo: 'bifurcacion',
      titulo: 'ELIGE TÚNEL',
      subtitulo: esc.frenteEsMuerte
        ? 'El del centro es el cerco. No lleva a ninguna parte.'
        : 'El túnel por el que entres decide la temporada',
    });
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
  }

  /**
   * El jugador acaba de entrar a un túnel. El carril decide.
   * @param {number} carril 0 izquierda, 1 centro, 2 derecha
   */
  _cruzarBifurcacion(carril) {
    this.enAproximacion = false;
    this.corredorLimpio = false;
    this.bifurcacion.iniciarViraje(carril, this.escenario.obtenerColores());
    this.audio.cambioEscenario();
    this.alQuitarSenal();

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

    this._cambiarEscenario(destino, true);
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
      this.alMostrarAviso({
        tipo: 'golpe',
        titulo: institucion?.nombre ?? 'TRÁMITE',
        subtitulo: `Se te cayeron TODOS. Lo que recojas vale ×${TRAMITE.MULTIPLICADOR_RESCATE}.`,
      });
      return;
    }

    this.alMostrarAviso({
      tipo: 'golpe',
      titulo: institucion?.nombre ?? 'SE ARCHIVÓ',
      subtitulo: institucion?.portazo ?? 'Se archiva el caso.',
    });
    // El ×2 se anuncia siempre, también en la versión corta. Es la única cifra
    // del trámite que cambia si vale la pena entrar, y esta es la variante que
    // se ve a partir de la segunda visita: o sea, casi todas las veces.
    if (extra.devueltos) {
      this.alMostrarAviso({
        tipo: 'bifurcacion',
        titulo: `×${extra.multiplicador ?? 2}: +${extra.devueltos}`,
        subtitulo: `Recogiste ${extra.recuperados ?? 0} del suelo y valen el doble`,
      });
    }
    if (extra.hallazgo) {
      this.alMostrarAviso({
        tipo: 'prueba',
        titulo: 'PERO SALES CON ALGO',
        subtitulo: `${extra.hallazgo} · ${extra.perdidos ?? 0} se quedaron en el suelo`,
      });
    }

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
    this.particulas.estallido(this.jugador.x, this.jugador.y + 1.1, 0.2, {
      color: def.color ?? 0x39d98a, cantidad: 24, fuerza: 4.6, tam: 0.42, vida: 0.62,
    });

    this.alMostrarAviso({
      tipo: 'potenciador',
      titulo: def.nombre.toUpperCase(),
      subtitulo: def.descripcion,
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
        color: t.desde > 0 ? t.color : 0x4fd8ff,
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
      color: t.color,
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

    this.jugador.reiniciarTrasEscape();
    this.perseguidor.soltar(CERCO.DISTANCIA_TRAS_ESCAPE);
    this.velocidad = VELOCIDAD.INICIAL;

    // La pista quedó parada bajo los pies del jugador: hay que rellenarla.
    this.obstaculos.limpiar();
    this.evidencia.limpiar();
    this.elevado.limpiar();
    this.potenciadores.limpiar();

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

  _bucle = () => {
    if (!this.animando) return;
    requestAnimationFrame(this._bucle);

    // El doblez del mundo (ver utils/curvatura.js). Va ANTES de actualizar y
    // de cualquiera de los render de abajo: lo que se monte en este fotograma
    // —un cruce, una pieza del GLB— se parchea antes de compilar su shader y
    // no llega a pintarse recto ni una vez.
    curvarEscena(this.escenaThree);

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
      if (this.compositor) this.compositor.render();
      else this.renderizador.render(this.escenaThree, this.camara);
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

      if (this.compositor) this.compositor.render();
      else this.renderizador.render(this.escenaThree, this.camara);
      return;
    } else {
      // En pausa seguimos animando al jugador y al perseguidor para que la
      // escena no se vea congelada, pero sin avanzar el mundo.
      this.jugador.actualizar(dt, this.velocidad);
      this.perseguidor.actualizar(dt, this.jugador, false);
      this.escenario?.actualizar(dt, 0, this.jugador, this.velocidad);
    }

    this._actualizarCamara(dt);

    // Con bloom vamos por el compositor; sin él, directo a pantalla.
    if (this.compositor) this.compositor.render();
    else this.renderizador.render(this.escenaThree, this.camara);

    // La foto se saca AQUÍ, en el mismo fotograma en que se acaba de dibujar.
    //
    // No es un capricho de sitio: WebGL limpia el buffer de dibujo al terminar
    // el fotograma salvo que se pida `preserveDrawingBuffer`, y esa opción
    // cuesta rendimiento en todos los fotogramas para algo que se usa una vez
    // por partida. Leyendo justo después del render, el buffer todavía está.
    if (this._pedidoDeFoto) {
      this._pedidoDeFoto = false;
      try {
        this.fotoArresto = this.lienzo.toDataURL('image/jpeg', 0.72);
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
    const t = this.cerco.actualizar(dt);
    // Los perseguidores se abalanzan al mismo ritmo que el cerco se cierra.
    this.perseguidor.cercar(t, dt);
    this.escenario?.actualizar(dt, 0, this.jugador, this.velocidad);

    // La foto se pide AL FINAL DEL TODO, con el círculo cerrado y la cámara
    // ya parada en su sitio. Se pedía a 0.82 y salía movida: a esa altura el
    // encuadre todavía viaja hacia su posición —el lerp de la cámara tarda lo
    // suyo— y lo que se imprimía al día siguiente era un fotograma de tránsito
    // con los policías a medio llegar.
    if (t > 0.96 && !this.fotoArresto && !this._pedidoDeFoto) {
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

    // La Bahía va techada, y su bóveda no puede atravesar la fachada de la
    // bifurcación: el escenario necesita saber dónde se acaba la calle.
    // Cuando no hay fachada en pista, no hay tope.
    this.escenario.zTope = this.bifurcacion.activa ? this.bifurcacion.z : null;

    // DESPEJE: a 150 m del edificio la niebla empieza a retirarse y a 55 ya
    // se le ve la fachada entera —queda tiempo de sobra para colocarse en el
    // carril—. Al cruzar, bifurcacion.activa cae y el ambiente regresa solo.
    const dCruce = this.bifurcacion.activa ? -this.bifurcacion.z : Infinity;
    this.escenario.despejeObjetivo =
      Math.min(1, Math.max(0, (150 - dCruce) / (150 - 55)));

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
    const alturaSuelo = this.elevado.actualizar(
      dt, avance, this.jugador, this.obstaculos, this.evidencia,
    );
    this.jugador.establecerSuelo(alturaSuelo);

    this.evidencia.actualizar(dt, avance, this.jugador);
    this.potenciadores.actualizar(dt, avance);
    this._actualizarEfectos(dt);

    this.jugador.actualizar(dt, velocidadEfectiva);

    if (this.tramite.activo) {
      // Se quedan a la puerta del túnel, esperando a que salgas.
      this.perseguidor.actualizar(dt, this.jugador, false);
    } else {
      this.perseguidor.actualizar(dt, this.jugador, false);
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

      // El estallido, del color del escalón de racha en el que vas. Es toda la
      // recompensa que da la racha —no toca el marcador— y por eso tiene que
      // verse: sale donde está el jugador, no donde estaba el papel, porque lo
      // que se celebra es que lo cogiste tú.
      const t = tramoRacha(this.combo);
      this.particulas.estallido(this.jugador.x, this.jugador.y + 1.05, 0.2, {
        color: t.color,
        cantidad: t.chispas,
        fuerza: 3.0 + this.combo * 0.03,
      });
      if (this.combo === t.desde && t.nombre) {
        // Solo en el fotograma en que se sube de escalón, no en cada papel.
        this.particulas.anillo(this.jugador.x, this.jugador.y + 0.9, 0.2, {
          color: t.color, cantidad: 30, radio: 6.5,
        });
        this.alMostrarAviso({ tipo: 'racha', titulo: t.nombre, subtitulo: `${this.combo} seguidos` });
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
      this.alMostrarAviso({ tipo: 'prueba', titulo: 'PRUEBA', subtitulo: ev.nombre });
    }

    // El combo caduca si dejas de recoger.
    if (this.temporizadorCombo > 0) {
      this.temporizadorCombo -= dt;
      if (this.temporizadorCombo <= 0) this.combo = 0;
    }

    this._emitirEstela(dt, velocidadEfectiva);

    // ---- Trámite ----------------------------------------------------------
    // Es un tramo aparte: sin obstáculos, sin bifurcación y sin captura. Se
    // resuelve entero aquí y se sale antes de tocar nada de lo demás.
    if (this.tramite.activo) {
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
    if (golpe && this.jugador.recibirGolpe()) {
      this.audio.golpe();
      this.sacudida = CAMARA.SACUDIDA_GOLPE;

      // El choque cuesta velocidad y acerca a los perseguidores.
      // El frenazo se calcula sobre la BASE, no sobre la actual: si no, dos
      // golpes seguidos se multiplicarían entre sí y te dejarían clavado.
      this.velocidad = Math.max(
        VELOCIDAD.INICIAL * 0.6,
        this.velocidadBase * VELOCIDAD.FRENAZO_POR_GOLPE,
      );
      this.perseguidor.acercarPorGolpe();
      this.combo = 0;

      // Al chocar, los papeles salen volando. Es literal —el estallido va en el
      // dorado del papel y hacia arriba y atrás— y remata la deformación del
      // personaje: el golpe se lee en el cuerpo y en lo que se le cae.
      this.particulas.estallido(this.jugador.x, this.jugador.y + 1.0, 0.3, {
        color: 0xf0e2b0, cantidad: 22, fuerza: 5.2, tam: 0.38,
        vida: 0.75, gravedad: 8, subida: 2.4,
      });

      const esc = obtenerEscenario(this.escenarioActual);
      this.alMostrarAviso({
        tipo: 'golpe',
        titulo: esc.obstaculos[golpe.tipo] ?? 'Obstáculo',
        subtitulo: `${JUGADOR.GOLPES_MAXIMOS - this.jugador.golpes} intentos restantes`,
      });
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

    if (this.bifurcacion.actualizar(dt, avance)) {
      this._cruzarBifurcacion(this.jugador.carril);
      return;
    }

    this._publicarHUD(velocidadEfectiva);
  }

  /**
   * Vuelca el estado al HUD. Está aparte porque el trámite sale del bucle
   * antes de llegar al final y también necesita pintar.
   */
  _publicarHUD(velocidadEfectiva) {
    this.alActualizarHUD({
      papeles: this.evidenciaPartida,
      distancia: Math.floor(this.distanciaTotal),
      velocidad: velocidadEfectiva,
      cercania: this.perseguidor.cercania(),
      golpesRestantes: JUGADOR.GOLPES_MAXIMOS - this.jugador.golpes,
      combo: this.combo,
      escenario: this.escenarioActual,
      progresoTramo: this.distanciaTramo / TRAMO.LONGITUD,
      linterna: this.escenarioActual === 'apagon' ? this.escenario.fraccionLinterna() : null,
      // El HUD pinta una ficha por tipo de evidencia con su contador.
      pruebas: this.pruebasPartida,
      // Destello blanco que tapa el corte de escenario al tomar un desvío.
      destello: this.bifurcacion.destello(),
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
    // El cerco tiene su propio plano: la cámara se sale de la espalda del
    // jugador y da la vuelta para enseñar el corro.
    if (this.estado === 'cerco') {
      this._encuadrarCerco(dt);
      return;
    }

    // LA CINEMÁTICA DEL DESVÍO. Al doblar por un costado el personaje rota
    // hacia la esquina y la cámara lo sigue con la vista: se desplaza hacia el
    // lado elegido y gira la mira hacia allá, con lo que se ve al corredor
    // girar Y el camino que eligió abrirse delante de él. La curva de fuerza
    // la da la bifurcación (pico al doblar, cola al enderezarse en el
    // soportal); aquí solo se aplica.
    const cine = this.bifurcacion.cinematicaGiro();
    const fCine = cine ? cine.fuerza : 0;
    const dirCine = cine ? cine.dir : 0;
    // El personaje: hasta ~66° de giro sobre su media vuelta. El signo es
    // negativo porque rotation.y = π mira a −Z y restarle gira hacia +X.
    this.jugador.giroCinematico = -dirCine * 1.15 * fCine;

    // Sigue al jugador lateralmente con retraso: da peso sin marear.
    const xObjetivo = this.jugador.x * CAMARA.SEGUIMIENTO_LATERAL
      + dirCine * 1.7 * fCine;
    const t = 1 - Math.exp(-CAMARA.AMORTIGUACION * dt);
    this.camara.position.x += (xObjetivo - this.camara.position.x) * t;

    // CORRIENDO POR ARRIBA la cámara se abre. Ver CAMARA.ARRIBA_*: sobre la
    // plataforma hay que ver el borde —que es de donde te caes— y el final del
    // tramo, y con el encuadre de calle no se ve ni una cosa ni la otra.
    //
    // La transición va con su propio reloj y no con el amortiguador de arriba,
    // porque ese está afinado para el seguimiento lateral —que tiene que ser
    // rápido— y aquí un cambio así de grande a esa velocidad se lee como un
    // tirón. Medio segundo.
    const arriba = this.jugador.vaPorArriba && !this.jugador.volando;
    this.mezclaArriba = (this.mezclaArriba ?? 0)
      + ((arriba ? 1 : 0) - (this.mezclaArriba ?? 0))
      * (1 - Math.exp(-dt / (CAMARA.ARRIBA_TRANSICION / 3)));
    const m = this.mezclaArriba;

    // Sube un poco cuando el jugador salta: no lo pierde de vista.
    const yObjetivo = CAMARA.POSICION.y + this.jugador.y * 0.28
      + CAMARA.ARRIBA_ALTURA_EXTRA * m;
    this.camara.position.y += (yObjetivo - this.camara.position.y) * t;

    // Vuelta a la profundidad de siempre. Solo se mueve tras un cerco, pero
    // sin esta línea el encuadre se quedaría descolocado al reanudar.
    const zObjetivo = CAMARA.POSICION.z + CAMARA.ARRIBA_DISTANCIA_EXTRA * m;
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
    this.camara.lookAt(
      this.jugador.x * CAMARA.SEGUIMIENTO_LATERAL + dirCine * 7 * fCine,
      CAMARA.MIRA.y + this.jugador.y * 0.2 - CAMARA.ARRIBA_MIRA_BAJA * m,
      CAMARA.MIRA.z,
    );

    // Banqueo al tomar un desvío. lookAt reescribe la orientación entera, así
    // que el balanceo se aplica DESPUÉS: si no, se pierde.
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
  _encuadrarCerco(dt) {
    const t = 1 - Math.exp(-2.4 * dt);

    this.camara.position.x += (this.jugador.x + CERCO.CAMARA.x - this.camara.position.x) * t;
    this.camara.position.y += (CERCO.CAMARA.y - this.camara.position.y) * t;
    this.camara.position.z += (CERCO.CAMARA.z - this.camara.position.z) * t;

    this.camara.lookAt(this.jugador.x, CERCO.CAMARA_MIRA_Y, -0.6);
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
    this.jugador.reiniciar();
    this.obstaculos.reiniciar();
    this.evidencia.reiniciar();
    this.perseguidor.reiniciar();
    this.bifurcacion.reiniciar();
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
    this._establecerEstado('menu');
  }
}
