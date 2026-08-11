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
//        bifurcacion → ruleta → (jugando | gameover)
//            ↓
//        gameover → menu
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
import { StaminaManager } from './Stamina.js';
import { Chaser } from './Chaser.js';
import { Roulette } from './Roulette.js';

import { crearEscenario } from '../scenes/index.js';
import { obtenerEscenario } from '../config/escenarios.js';
import { Controles } from '../utils/controls.js';
import { remateCaptura, remateExhausto, citaVerificada } from '../config/textos.js';
import { VELOCIDAD, TRAMO, CAMARA, JUGADOR, ESTAMINA } from '../config/balance.js';
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

    // Callbacks hacia la UI. Los rellena main.js.
    this.alCambiarEstado = () => {};
    this.alActualizarHUD = () => {};
    this.alMostrarAviso = () => {};

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
    this.estamina = new StaminaManager(this.escenaThree);
    this.perseguidor = new Chaser(this.escenaThree);
    this.ruleta = new Roulette();

    this.escenario = null;
    this._cambiarEscenario(this.escenarioActual, false);
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
        this.camara.updateProjectionMatrix();
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
    this.obstaculos.aplicarTema(colores);
    this.papeles.aplicarTema(config);
    this.estamina.aplicarTema(config);

    this.rutaPartida.push(id);
    this.distanciaTramo = 0;

    // aplicarTema() vació la pista (los obstáculos tenían los colores viejos),
    // así que hay que volver a llenarla con la paleta nueva.
    this._precargarPista();

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

    this.jugador.reiniciar();
    this.obstaculos.reiniciar();
    this.papeles.reiniciar();
    this.estamina.reiniciar();
    this.perseguidor.reiniciar();

    this._cambiarEscenario('bahia', true);

    this.controles.activar();
    this._establecerEstado('jugando');
    this.iniciarBucle();
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
   * Fin de partida.
   * @param {'captura'|'exhausto'|'cerco'} motivo
   * @param {string} [textoPersonalizado]
   */
  terminarPartida(motivo, textoPersonalizado = null) {
    if (this.estado === 'gameover') return;

    this.jugador.caer();
    this.perseguidor.atrapar();
    this.controles.desactivar();
    this.audio.captura();

    let texto = textoPersonalizado;
    if (!texto) {
      texto = motivo === 'exhausto'
        ? remateExhausto()
        : remateCaptura(this.escenarioActual);
    }

    // Si el equipo cargó citas verificadas, se añade la que aplique.
    const cita = citaVerificada(this.escenarioActual);

    const puntaje = this.papelesPartida + Math.floor(this.distanciaTotal / 10);

    const { fichasNuevas } = this.cuaderno.registrarPartida({
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      evidencias: this.evidenciasPartida,
      ruta: [...this.rutaPartida],
    });

    this._establecerEstado('gameover', {
      motivo,
      texto,
      cita,
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      puntaje,
      evidencias: this.evidenciasPartida,
      ruta: this.rutaPartida,
      fichasNuevas,
      esRecord: puntaje >= this.cuaderno.mejorPuntaje,
    });
  }

  // -------------------------------------------------------------------------
  // BIFURCACIÓN
  // -------------------------------------------------------------------------

  _entrarBifurcacion() {
    this.obstaculos.generacionPausada = true;
    this._establecerEstado('bifurcacion', {
      escenario: this.escenarioActual,
      config: obtenerEscenario(this.escenarioActual),
      institucion: this.ruleta.datosInstitucion(this.escenarioActual),
      destinos: {
        izquierda: obtenerEscenario(this.ruleta.resolverRuta(this.escenarioActual, 'izquierda')),
        derecha: obtenerEscenario(this.ruleta.resolverRuta(this.escenarioActual, 'derecha')),
      },
    });
  }

  /**
   * Resuelve la decisión del jugador en la bifurcación.
   * @param {'izquierda'|'derecha'|'frente'} direccion
   */
  elegirRuta(direccion) {
    if (this.estado !== 'bifurcacion') return;

    if (direccion === 'frente') {
      this._establecerEstado('ruleta', {
        escenario: this.escenarioActual,
        institucion: this.ruleta.datosInstitucion(this.escenarioActual),
      });
      return;
    }

    const destino = this.ruleta.resolverRuta(this.escenarioActual, direccion);
    this.obstaculos.limpiar();
    this.papeles.limpiar();
    this.estamina.limpiar();
    this.papeles.nuevoTramo();
    this.obstaculos.generacionPausada = false;

    this._cambiarEscenario(destino, true);
    this._establecerEstado('jugando');
  }

  /** Ejecuta el giro de la ruleta y aplica el resultado. */
  girarRuleta() {
    const resultado = this.ruleta.girar(this.escenarioActual);

    if (resultado.muerteDirecta) {
      this.terminarPartida('cerco', resultado.texto);
      return resultado;
    }

    if (resultado.exito) {
      this.papelesPartida += resultado.recompensa;
    }

    this.audio.resultadoRuleta(resultado.exito);
    return resultado;
  }

  /** Tras ver el resultado de la ruleta, se continúa al siguiente escenario. */
  continuarTrasRuleta() {
    if (this.estado === 'gameover') return;

    // Sales por donde entraste: la vía institucional te devuelve a la calle.
    const destino = this.ruleta.resolverRuta(this.escenarioActual, 'derecha');

    this.obstaculos.limpiar();
    this.papeles.limpiar();
    this.estamina.limpiar();
    this.papeles.nuevoTramo();
    this.obstaculos.generacionPausada = false;

    this._cambiarEscenario(destino, true);
    this._establecerEstado('jugando');
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
    } else {
      // En pausa/menú seguimos animando al jugador y al perseguidor para que
      // la escena no se vea congelada, pero sin avanzar el mundo.
      this.jugador.actualizar(dt, this.velocidad);
      this.perseguidor.actualizar(dt, this.jugador, false);
      // El escenario sigue vivo de fondo: es el telón del menú.
      this.escenario?.actualizar(dt, 0, this.jugador, this.velocidad);
    }

    this._actualizarCamara(dt);

    // Con bloom vamos por el compositor; sin él, directo a pantalla.
    if (this.compositor) this.compositor.render();
    else this.renderizador.render(this.escenaThree, this.camara);
  };

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

    // La estamina baja penaliza la velocidad efectiva.
    const multiplicador = this.estamina.multiplicadorVelocidad();
    const velocidadEfectiva = this.velocidad * multiplicador;

    // Distancia recorrida este fotograma. El mundo se mueve hacia el jugador.
    const avance = velocidadEfectiva * dt;

    this.distanciaTotal += avance;
    this.distanciaTramo += avance;

    // ---- Subsistemas ------------------------------------------------------
    this.pista.actualizar(avance);

    // El Apagón necesita la velocidad para escalar la visibilidad.
    if (this.escenarioActual === 'apagon') {
      this.escenario.actualizar(dt, avance, this.jugador, velocidadEfectiva);
    } else {
      this.escenario.actualizar(dt, avance, this.jugador);
    }

    // Los obstáculos devuelven los datos del grupo recién generado: los
    // carriles libres son donde es seguro poner papeles y estamina.
    const grupo = this.obstaculos.actualizar(avance, this.velocidad);

    if (grupo) {
      // La hilera va en arco (sobre un salto) una de cada tres veces.
      this.papeles.generarHilera(
        grupo.carrilesLibres,
        grupo.z,
        grupo.gap,
        Math.random() < 0.33,
      );
    }

    this.papeles.actualizar(dt, avance, this.jugador);
    this.estamina.actualizar(dt, avance, grupo);
    this.jugador.actualizar(dt, velocidadEfectiva);
    this.perseguidor.actualizar(dt, this.jugador, this.estamina.estaExhausto());

    // ---- Recolección ------------------------------------------------------
    const recogido = this.papeles.recoger(this.jugador);
    if (recogido.papeles > 0) {
      this.papelesPartida += recogido.papeles;
      this.combo += 1;
      this.temporizadorCombo = 1.5;
      this.audio.papel(this.combo);
    }
    for (const ev of recogido.evidencias) {
      if (!this.evidenciasPartida.includes(ev.nombre)) {
        this.evidenciasPartida.push(ev.nombre);
      }
      this.audio.evidencia();
      this.alMostrarAviso({ tipo: 'evidencia', titulo: 'EVIDENCIA', subtitulo: ev.nombre });
    }

    if (this.estamina.recoger(this.jugador) > 0) {
      this.audio.estamina();
      // Gancho del escenario: en el Apagón esto enciende la linterna.
      this.escenario.alRecogerEstamina();
    }

    // El combo caduca si dejas de recoger.
    if (this.temporizadorCombo > 0) {
      this.temporizadorCombo -= dt;
      if (this.temporizadorCombo <= 0) this.combo = 0;
    }

    // ---- Colisiones -------------------------------------------------------
    const golpe = this.obstaculos.comprobarColision(this.jugador);
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

      const config = obtenerEscenario(this.escenarioActual);
      this.alMostrarAviso({
        tipo: 'golpe',
        titulo: config.obstaculos[golpe.tipo] ?? 'Obstáculo',
        subtitulo: `${JUGADOR.GOLPES_MAXIMOS - this.jugador.golpes} intentos restantes`,
      });
    }

    // ---- Condiciones de fin ----------------------------------------------
    if (this.perseguidor.haAtrapado() || this.jugador.estaAgotado()) {
      const motivo = this.estamina.valor <= 0 ? 'exhausto' : 'captura';
      this.terminarPartida(motivo);
      return;
    }

    // ---- Bifurcación ------------------------------------------------------
    if (this.distanciaTramo >= TRAMO.LONGITUD) {
      this._entrarBifurcacion();
      return;
    }

    // Aviso previo, una sola vez por tramo.
    const restante = TRAMO.LONGITUD - this.distanciaTramo;
    if (restante < TRAMO.DISTANCIA_AVISO && !this._avisoBifurcacionMostrado) {
      this._avisoBifurcacionMostrado = true;
      this.alMostrarAviso({ tipo: 'bifurcacion', titulo: 'BIFURCACIÓN', subtitulo: 'Prepárate para elegir' });
    }
    if (restante >= TRAMO.DISTANCIA_AVISO) {
      this._avisoBifurcacionMostrado = false;
    }

    // ---- HUD --------------------------------------------------------------
    this.alActualizarHUD({
      papeles: this.papelesPartida,
      distancia: Math.floor(this.distanciaTotal),
      velocidad: velocidadEfectiva,
      estamina: this.estamina.fraccion(),
      nombreEstamina: this.estamina.nombreItem,
      exhausto: this.estamina.estaExhausto(),
      cercania: this.perseguidor.cercania(),
      golpesRestantes: JUGADOR.GOLPES_MAXIMOS - this.jugador.golpes,
      combo: this.combo,
      escenario: this.escenarioActual,
      progresoTramo: this.distanciaTramo / TRAMO.LONGITUD,
      linterna: this.escenarioActual === 'apagon' ? this.escenario.fraccionLinterna() : null,
      // El HUD pinta una ficha por tipo de evidencia con su contador.
      evidencias: this.evidenciasPartida,
    });
  }

  // -------------------------------------------------------------------------
  // CÁMARA
  // -------------------------------------------------------------------------

  _actualizarCamara(dt) {
    // Sigue al jugador lateralmente con retraso: da peso sin marear.
    const xObjetivo = this.jugador.x * CAMARA.SEGUIMIENTO_LATERAL;
    const t = 1 - Math.exp(-CAMARA.AMORTIGUACION * dt);
    this.camara.position.x += (xObjetivo - this.camara.position.x) * t;

    // Sube un poco cuando el jugador salta: no lo pierde de vista.
    const yObjetivo = CAMARA.POSICION.y + this.jugador.y * 0.28;
    this.camara.position.y += (yObjetivo - this.camara.position.y) * t;

    // Sacudida por golpe, con decaimiento exponencial.
    if (this.sacudida > 0.001) {
      this.sacudida *= Math.exp(-6 * dt);
      this.camara.position.x += (Math.random() - 0.5) * this.sacudida;
      this.camara.position.y += (Math.random() - 0.5) * this.sacudida;
    } else {
      this.sacudida = 0;
    }

    this.camara.lookAt(
      this.jugador.x * 0.35,
      CAMARA.MIRA.y + this.jugador.y * 0.2,
      CAMARA.MIRA.z,
    );
  }

  // -------------------------------------------------------------------------
  // ESTADO
  // -------------------------------------------------------------------------

  _establecerEstado(nuevo, datos = {}) {
    this.estado = nuevo;
    this.alCambiarEstado(nuevo, datos);
  }

  /** Vuelve al menú principal. */
  volverAlMenu() {
    this.controles.desactivar();
    this.jugador.reiniciar();
    this.obstaculos.reiniciar();
    this.papeles.reiniciar();
    this.estamina.reiniciar();
    this.perseguidor.reiniciar();
    this.velocidad = VELOCIDAD.INICIAL;
    this.velocidadBase = VELOCIDAD.INICIAL;
    this._establecerEstado('menu');
  }
}
