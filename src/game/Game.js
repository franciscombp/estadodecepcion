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

import { crearEscenario } from '../scenes/index.js';
import { obtenerEscenario } from '../config/escenarios.js';
import { CATALOGO_POTENCIADORES } from '../config/balance.js';
import { Controles } from '../utils/controls.js';
import { remateCaptura, remateExhausto, citaVerificada } from '../config/textos.js';
import {
  VELOCIDAD, TRAMO, CAMARA, JUGADOR, CARRILES, CERCO, PAPELES,
  POTENCIADORES, SENTENCIAS,
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
    this.papelesPartida = 0;
    this.evidenciasPartida = [];
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
    this.multiplicadorPapeles = 1;

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

    // Tonemapping cinematográfico: comprime los altos para que el neón se
    // sature sin quemarse a blanco puro.
    this.renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderizador.toneMappingExposure = 1.15;

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
    this.papeles = new CoinManager(this.escenaThree);
    this.perseguidor = new Chaser(this.escenaThree);
    this.rutas = new Rutas();
    this.bifurcacion = new Bifurcacion(this.escenaThree);
    this.elevado = new ElevadoManager(this.escenaThree);
    this.tramite = new TramiteManager(this.escenaThree);
    this.cerco = new Cerco(this.escenaThree);
    this.intro = new Intro();
    this.potenciadores = new PowerUpManager(this.escenaThree);
    this.potenciadores.establecerDesbloqueados(this.cuaderno.potenciadoresDesbloqueados());

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
      this.papeles.generarHilera(carrilesLibres, z, gap, Math.random() < 0.33);
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
    const carrilPapeles = this.papeles.generarHilera(
      grupo.carrilesLibres,
      grupo.z,
      grupo.gap,
      Math.random() < 0.33,
    );

    const libres = grupo.carrilesLibres.filter((c) => c !== carrilPapeles);
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
    this.papeles.aplicarTema(config);
    this.elevado.aplicarTema(colores);

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
    this.papelesPartida = 0;
    this.evidenciasPartida = [];
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
    this.papeles.reiniciar();
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

    const puntaje = this.papelesPartida + Math.floor(this.distanciaTotal / 10);

    // CONTINUIDAD: la próxima partida arranca aquí, donde te capturaron.
    this.cuaderno.ultimoEscenario = this.escenarioActual;

    const cierre = this._cerrarEnCuaderno({
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      evidencias: this.evidenciasPartida,
      ruta: [...this.rutaPartida],
    });

    this.finPendiente = {
      motivo,
      texto,
      cita,
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      evidencias: this.evidenciasPartida,
      ruta: this.rutaPartida,
      // El récord que se anuncia es el de PAPELES, que es lo que mide el
      // juego: cuánta documentación sacaste antes de que te pararan. El
      // cuaderno ya se cerró unas líneas más arriba, así que la marca de esta
      // corrida ya está dentro y la comparación va con `>=`.
      esRecord: this.papelesPartida >= this.cuaderno.mejorPapeles,
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
    this.bifurcacion.iniciarViraje(carril);
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
    this.papeles.limpiar();
    this.bifurcacion.limpiar();
    this.elevado.limpiar();
    this.tramite.limpiar();
    this.potenciadores.limpiar();
    this.papeles.nuevoTramo();
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
    this.papeles.limpiar();
    this.potenciadores.limpiar();
    this.bifurcacion.limpiar();
    this._limpiarEfectos();

    const institucion = this.rutas.datosInstitucion(this.escenarioActual);

    // TE LOS QUITAN. El marcador se vacía en el acto: lo que había pasa a
    // estar por el suelo, y lo que se recupere volverá a sumar.
    const confiscados = this.papelesPartida;
    this.papelesPartida = 0;
    this.combo = 0;

    this.tramite.iniciar(
      this.escenario.obtenerColores(),
      institucion,
      this.papeles,
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
    const recuperados = this.tramite.papelesRecuperados();
    const perdidos = this.tramite.papelesPerdidos();
    const perfecto = this.tramite.esPerfecto();

    // Vuelve a la cuenta lo que se levantó del suelo.
    this.papelesPartida += recuperados;

    // El hallazgo del caso. Es lo único que compensa haber entrado.
    const hallazgo = institucion?.hallazgo;
    if (hallazgo && !this.evidenciasPartida.includes(hallazgo)) {
      this.evidenciasPartida.push(hallazgo);
      this.audio.evidencia();
    }

    if (perfecto) {
      this._ganarPartida(institucion, recuperados);
      return;
    }

    // Otra parada, y por el mismo motivo: el portazo es el remate de la
    // escena, y un remate que se va solo a los dos segundos no remata nada.
    this._contarInstitucion('salida', { hallazgo, recuperados, perdidos });
  }

  /**
   * Recuperaste el reguero entero, que es prácticamente imposible. El ente te
   * da igual con la puerta en las narices, pero el caso sigue vivo.
   */
  _ganarPartida(institucion, papelesRecuperados) {
    this.jugador.vivo = true;
    this.controles.desactivar();
    this.audio.evidencia();

    const puntaje = this.papelesPartida + Math.floor(this.distanciaTotal / 10);

    this.cuaderno.denunciaPresentada = true;
    this.cuaderno.ultimoEscenario = this.escenarioActual;

    const cierre = this._cerrarEnCuaderno({
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      evidencias: this.evidenciasPartida,
      ruta: [...this.rutaPartida],
    });

    this._establecerEstado('victoria', {
      institucion: institucion?.nombre ?? 'LA INSTITUCIÓN',
      texto: institucion?.textoExito
        ?? 'Los recogiste todos. Alguien, en algún piso, tuvo que leerlo.',
      papelesEntregados: papelesRecuperados,
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      evidencias: this.evidenciasPartida,
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
    const { paginasNuevas } = this.cuaderno.registrarPartida(resultado);

    const potenciadoresNuevos = CATALOGO_POTENCIADORES.filter(
      (p) => !antes.has(p.id) && this.cuaderno.tramosRecorridos >= p.tramos,
    );

    return {
      paginasNuevas,
      potenciadoresNuevos,
      proximoPotenciador: this.cuaderno.proximoPotenciador(),
    };
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
        this.multiplicadorPapeles = 2;
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
        this.papeles.radioIman = POTENCIADORES.RADIO_IMAN;
        this.efectos.set(def.id, def.duracion);
        break;
    }

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

  _desactivarPotenciador(id) {
    switch (id) {
      case 'botas': this.jugador.multiplicadorSalto = 1; break;
      case 'cobertura': this.jugador.volar(false); break;
      case 'portada': this.multiplicadorPapeles = 1; break;
      case 'iman': this.papeles.radioIman = PAPELES.RADIO_IMAN; break;
      default: break;
    }
  }

  /** Corta todos los efectos de golpe (fin de partida, tramo nuevo, escape). */
  _limpiarEfectos() {
    for (const id of this.efectos.keys()) this._desactivarPotenciador(id);
    this.efectos.clear();
    this.multiplicadorPapeles = 1;
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
    this.papeles.limpiar();
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

    // La foto se pide cerca del final del cerco, cuando el círculo ya está
    // cerrado: es el fotograma que cuenta la historia.
    if (t > 0.82 && !this.fotoArresto && !this._pedidoDeFoto) {
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

    // La Bahía va techada, y su bóveda no puede atravesar la fachada de la
    // bifurcación: el escenario necesita saber dónde se acaba la calle.
    // Cuando no hay fachada en pista, no hay tope.
    this.escenario.zTope = this.bifurcacion.activa ? this.bifurcacion.z : null;

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
      dt, avance, this.jugador, this.obstaculos, this.papeles,
    );
    this.jugador.establecerSuelo(alturaSuelo);

    this.papeles.actualizar(dt, avance, this.jugador);
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

    const recogido = this.papeles.recoger(this.jugador);
    if (recogido.papeles > 0) {
      this.papelesPartida += recogido.papeles * this.multiplicadorPapeles;
      this.combo += 1;
      this.temporizadorCombo = 1.5;
      this.audio.papel(this.combo);
      // El trámite se puntúa por PIEZAS, no por valor: el expediente está
      // completo o no lo está.
      if (this.tramite.activo) this.tramite.contar(recogido.cantidad);
    }
    for (const ev of recogido.evidencias) {
      if (!this.evidenciasPartida.includes(ev.nombre)) {
        this.evidenciasPartida.push(ev.nombre);
      }
      this.audio.evidencia();
      this.alMostrarAviso({ tipo: 'evidencia', titulo: 'EVIDENCIA', subtitulo: ev.nombre });
    }

    // El combo caduca si dejas de recoger.
    if (this.temporizadorCombo > 0) {
      this.temporizadorCombo -= dt;
      if (this.temporizadorCombo <= 0) this.combo = 0;
    }

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
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      velocidad: velocidadEfectiva,
      cercania: this.perseguidor.cercania(),
      golpesRestantes: JUGADOR.GOLPES_MAXIMOS - this.jugador.golpes,
      combo: this.combo,
      escenario: this.escenarioActual,
      progresoTramo: this.distanciaTramo / TRAMO.LONGITUD,
      linterna: this.escenarioActual === 'apagon' ? this.escenario.fraccionLinterna() : null,
      // El HUD pinta una ficha por tipo de evidencia con su contador.
      evidencias: this.evidenciasPartida,
      // Destello blanco que tapa el corte de escenario al tomar un desvío.
      destello: this.bifurcacion.destello(),
      // Marcador del expediente mientras se está dentro del túnel del centro.
      tramite: this.tramite.activo
        ? {
          recogidos: this.tramite.recuperadas,
          total: this.tramite.piezas,
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

    // Sigue al jugador lateralmente con retraso: da peso sin marear.
    const xObjetivo = this.jugador.x * CAMARA.SEGUIMIENTO_LATERAL;
    const t = 1 - Math.exp(-CAMARA.AMORTIGUACION * dt);
    this.camara.position.x += (xObjetivo - this.camara.position.x) * t;

    // Sube un poco cuando el jugador salta: no lo pierde de vista.
    const yObjetivo = CAMARA.POSICION.y + this.jugador.y * 0.28;
    this.camara.position.y += (yObjetivo - this.camara.position.y) * t;

    // Vuelta a la profundidad de siempre. Solo se mueve tras un cerco, pero
    // sin esta línea el encuadre se quedaría descolocado al reanudar.
    this.camara.position.z += (CAMARA.POSICION.z - this.camara.position.z) * t;

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
      this.jugador.x * CAMARA.SEGUIMIENTO_LATERAL,
      CAMARA.MIRA.y + this.jugador.y * 0.2,
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
    this.papeles.reiniciar();
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
