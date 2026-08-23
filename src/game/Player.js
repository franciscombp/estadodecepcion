// ============================================================================
// JUGADOR — Movimiento, salto, agachada y caja de colisión
// ============================================================================
// Réplica de la mecánica de Subway Surfers:
//   · Tres carriles con deslizamiento suave entre ellos.
//   · Salto balístico (gravedad constante, sin doble salto).
//   · Agachada con duración fija que reduce la hitbox.
//   · Buffer de entrada para que el salto anticipado no se pierda.
//
// Todos los números salen de config/balance.js. Aquí no hay constantes sueltas.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, SALTO, AGACHARSE, JUGADOR } from '../config/balance.js';
import {
  crearPersonaje, animarCarrera, animarSalto, aplicarPoseAgachado, pivotesDe, reposar,
} from '../models/characters.js';
import {
  esGLB, usaClipsGLB, animarCarreraGLB, animarSaltoGLB, aplicarPoseAgachadoGLB,
  poseDerrotaGLB, reposarGLB, aplicarGolpeGLB,
} from '../models/personajeGLB.js';
import { crearCaja } from '../utils/collision.js';
import { crearSombra } from '../models/props.js';

export class Player {
  /**
   * @param {THREE.Scene} escena
   * @param {'tostadologo'|'avecilla'|'buencan'|'monki'|'ministro'} personaje
   */
  constructor(escena, personaje = 'tostadologo') {
    this.escena = escena;

    // ---- Modelo visual ----------------------------------------------------
    this.modelo = crearPersonaje(personaje);
    this.modelo.position.set(0, 0, 0);
    // Media vuelta: el personaje se construye mirando a +Z (con las gafas y la
    // credencial delante), pero corre hacia -Z. Sin esta rotación veríamos su
    // cara todo el rato y la mochila PRENSA quedaría oculta detrás.
    this.modelo.rotation.y = Math.PI;
    escena.add(this.modelo);

    // LA SOMBRA VA SUELTA EN LA ESCENA, no colgada del modelo. Colgada, subiría
    // con el salto —que es exactamente lo contrario de lo que tiene que hacer—
    // y heredaría su giro al cambiar de carril, con lo que la mancha se ladearía
    // en el suelo. Se coloca a mano cada fotograma. Ver crearSombra().
    this.sombra = crearSombra(JUGADOR.RADIO_SOMBRA);
    escena.add(this.sombra);

    // ---- Estado de carril -------------------------------------------------
    this.carril = CARRILES.CENTRO;
    this.x = 0;          // Posición real (interpolada)
    this.xObjetivo = 0;  // Posición del carril destino

    // Giro añadido por la cinemática del desvío (radianes, lo escribe Game
    // cada fotograma desde Bifurcacion.cinematicaGiro). Se SUMA a la media
    // vuelta del modelo: negativo mira a la derecha, positivo a la izquierda.
    this.giroCinematico = 0;
    // Segundos que quedan de LEVANTARSE tras zafarse del cerco. Mientras
    // corre, el cuerpo rueda de la pose de derrota a la de carrera en vez de
    // teletransportarse de tumbado a de pie. Ver reiniciarTrasEscape().
    this.recuperacion = 0;

    // ---- Estado vertical --------------------------------------------------
    this.y = 0;
    this.velocidadY = 0;
    this.estaEnElAire = false;

    // Altura del suelo bajo los pies. Vale 0 en el asfalto y ELEVADO.ALTURA
    // cuando el jugador va sobre una tarima. Lo fija Game cada fotograma a
    // partir de lo que diga el gestor de niveles elevados.
    this.alturaSuelo = 0;

    // ---- Estado de agachada ----------------------------------------------
    this.estaAgachado = false;
    this.temporizadorAgachado = 0;
    this.factorAgachado = 0; // 0..1, para suavizar la pose visual
    // POR DÓNDE VA EL ROL, 0..1. Hace falta un reloj APARTE de `factorAgachado`
    // porque ése sube y vuelve a bajar —es una envolvente— y una vuelta no se
    // puede sacar de ahí: a mitad de la agachada valdría lo mismo subiendo que
    // bajando, y el personaje rodaría hacia adelante y luego hacia atrás.
    this.avanceRodada = 0;
    // POR DÓNDE VA EL SALTO, 0..1. El clip de Mixamo dura 1,70 s y el vuelo
    // dura lo que dure —depende del impulso, del potenciador y de si se pulsó
    // caída rápida—, así que al clip no se le deja correr a su ritmo: se le
    // pone la aguja donde toca. Sin esto, un salto corto aterrizaba con el
    // muñeco todavía boca abajo a mitad del mortal.
    this.avanceSalto = 0;
    this.vueloPrevisto = 0;

    // ---- Buffer de salto --------------------------------------------------
    // Si pulsas saltar poco antes de aterrizar, el salto se guarda y se ejecuta
    // en cuanto tocas el suelo. Sin esto, el juego se siente injusto.
    this.bufferSalto = 0;
    // La agachada usa una petición que dura todo el vuelo en vez de un buffer
    // con caducidad (ver agachar()), más la bandera de caída rápida.
    this.agacharAlAterrizar = false;
    this.caidaRapida = false;

    // ---- Daño e invulnerabilidad -----------------------------------------
    this.golpes = 0;
    this.invulnerabilidad = 0;
    // Escudo del salvoconducto: absorbe un golpe y se gasta.
    this.escudo = false;

    // ---- Potenciadores ----------------------------------------------------
    // Multiplicador del impulso de salto (botas de campo).
    this.multiplicadorSalto = 1;
    // Vuelo de la cobertura aérea: mientras dura, ni gravedad ni obstáculos.
    this.volando = false;
    this.alturaVuelo = 0;

    // ---- Animación --------------------------------------------------------
    // ¿La pose actual está escrita a mano (salto, limbo) en vez de salir del
    // ciclo de carrera? Sirve para deshacerla UNA vez al volver a correr.
    this.poseManual = false;
    this.tiempoAnimacion = 0;
    this.vivo = true;
  }

  // -------------------------------------------------------------------------
  // ACCIONES (las dispara Controles)
  // -------------------------------------------------------------------------

  moverIzquierda() {
    if (!this.vivo) return;
    if (this.carril > CARRILES.IZQUIERDA) {
      this.carril -= 1;
      this.xObjetivo = CARRILES.POSICIONES[this.carril];
      return true;
    }
    return false;
  }

  moverDerecha() {
    if (!this.vivo) return;
    if (this.carril < CARRILES.DERECHA) {
      this.carril += 1;
      this.xObjetivo = CARRILES.POSICIONES[this.carril];
      return true;
    }
    return false;
  }

  saltar() {
    if (!this.vivo) return false;

    if (this.volando) return false;

    if (!this.estaEnElAire) {
      // Salta desde donde esté: el impulso es el mismo arriba de una tarima
      // que en la calle, así que la altura ganada también.
      this.velocidadY = SALTO.VELOCIDAD_INICIAL * this.multiplicadorSalto;
      this.estaEnElAire = true;
      // CUÁNTO VA A DURAR EL VUELO, calculado en el despegue: subir y bajar
      // con aceleración constante son 2·v₀/g. Es una previsión, no una ley
      // —la caída rápida lo acorta y aterrizar sobre una tarima también— así
      // que el avance se recorta a 1 y el aterrizaje real manda.
      this.vueloPrevisto = (2 * this.velocidadY) / SALTO.GRAVEDAD;
      this.avanceSalto = 0;
      // Saltar cancela la agachada, activa y pendiente.
      this.estaAgachado = false;
      this.temporizadorAgachado = 0;
      this.agacharAlAterrizar = false;
      return true;
    }

    // En el aire: guardamos la intención por si aterrizamos pronto.
    this.bufferSalto = SALTO.BUFFER_ENTRADA;
    return false;
  }

  agachar() {
    if (!this.vivo) return false;
    if (this.volando) return false;

    if (this.estaEnElAire) {
      // En el aire, abajo hace DOS cosas:
      //   1. Activa la caída rápida, para bajar antes.
      //   2. Deja pedida la agachada para el aterrizaje.
      //
      // Lo segundo NO usa el buffer con caducidad del salto, y es a propósito.
      // El gesto natural es saltar, ver el pórtico que viene y pulsar abajo
      // en pleno vuelo: si esa intención caducara a los 0.18 s, la pulsación
      // se perdería en cualquier salto largo y aterrizarías de pie contra el
      // obstáculo. Mientras dure el vuelo, la petición se respeta.
      this.caidaRapida = true;
      this.agacharAlAterrizar = true;
      return false;
    }

    this.estaAgachado = true;
    this.temporizadorAgachado = AGACHARSE.DURACION;
    return true;
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN POR FOTOGRAMA
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt        Delta time en segundos
   * @param {number} velocidad Velocidad de carrera actual (para la cadencia)
   */
  actualizar(dt, velocidad) {
    // CAÍDO SE QUEDA CAÍDO. Sin esta salida, cualquier fotograma posterior a
    // caer() deshacía la pose: la gravedad veía el cuerpo a 0.26 sobre el
    // asfalto y lo hacía "caerse" hasta cero, y animarCarrera() le devolvía la
    // zancada. O sea que el personaje se levantaba solo a correr en la pantalla
    // de escape, tumbado boca abajo pero moviendo las piernas.
    if (!this.vivo) return;

    this.tiempoAnimacion += dt;

    // ---- Desplazamiento lateral ------------------------------------------
    // Lerp exponencial: independiente del framerate, a diferencia de un
    // `x += diff * factor` fijo (que va más rápido a más FPS).
    const t = 1 - Math.exp(-CARRILES.VELOCIDAD_CAMBIO * dt);
    this.x += (this.xObjetivo - this.x) * t;
    if (Math.abs(this.xObjetivo - this.x) < 0.01) this.x = this.xObjetivo;

    // ---- Vuelo ------------------------------------------------------------
    // Mientras dura la cobertura aérea el jugador no tiene física: sube a su
    // altura y se queda ahí. Es lo mismo que hace el jetpack del original, y
    // por el mismo motivo —el potenciador es un descanso, no otra prueba.
    if (this.volando) {
      const tv = 1 - Math.exp(-7 * dt);
      this.y += (this.alturaVuelo - this.y) * tv;
      this.velocidadY = 0;
      this.estaEnElAire = false;
      this.estaAgachado = false;
    }

    // ---- Salto y gravedad -------------------------------------------------
    if (this.estaEnElAire) {
      // La caída rápida multiplica la gravedad de forma CONTINUA mientras
      // desciende. Antes era un impulso fijo por pulsación, así que machacar
      // la tecla te mandaba al suelo de golpe.
      const gravedad = (this.caidaRapida && this.velocidadY < 0)
        ? SALTO.GRAVEDAD * SALTO.MULTIPLICADOR_CAIDA_RAPIDA
        : SALTO.GRAVEDAD;

      this.velocidadY -= gravedad * dt;
      this.y += this.velocidadY * dt;
      if (this.vueloPrevisto > 0) {
        this.avanceSalto = Math.min(1, this.avanceSalto + dt / this.vueloPrevisto);
      }

      if (this.y <= this.alturaSuelo) {
        // Aterrizaje. El suelo puede no ser el asfalto: si hay una tarima
        // debajo, se aterriza sobre ella.
        this.y = this.alturaSuelo;
        this.velocidadY = 0;
        this.estaEnElAire = false;
        this.caidaRapida = false;

        // Los buffers se resuelven aquí, en orden de prioridad.
        // El salto manda sobre la agachada: si el jugador pidió las dos cosas,
        // saltar es lo que le saca de más apuros.
        if (this.bufferSalto > 0) {
          // CON EL MULTIPLICADOR DE LAS BOTAS. El salto que sale del buffer de
      // entrada lo ignoraba, así que con las botas de campo puestas el salto
      // amortiguado subía 2.20 m en vez de 3.60 y no llegaba a la tarima: el
      // jugador veía que iba a subir y pasaba por debajo. Es la misma fórmula
      // que usa saltar().
      this.velocidadY = SALTO.VELOCIDAD_INICIAL * (this.multiplicadorSalto ?? 1);
          this.estaEnElAire = true;
          this.bufferSalto = 0;
          this.agacharAlAterrizar = false;
        } else if (this.agacharAlAterrizar) {
          this.estaAgachado = true;
          this.temporizadorAgachado = AGACHARSE.DURACION;
          this.agacharAlAterrizar = false;
        }
      }
    }

    if (this.bufferSalto > 0) this.bufferSalto -= dt;

    // Salirse de una tarima por el borde: el suelo desaparece bajo los pies y
    // se empieza a caer, sin salto y sin impulso. Es la penalización natural
    // de correr por arriba y no bajarse a tiempo.
    if (!this.volando && !this.estaEnElAire && this.y > this.alturaSuelo + 0.01) {
      this.estaEnElAire = true;
      this.velocidadY = 0;
    }
    // Y al revés: si el suelo SUBE de golpe (rampa, o una tarima que aparece
    // bajo un jugador que corre a ras) se le pega al suelo nuevo en vez de
    // dejarlo hundido dentro de la madera.
    if (!this.volando && !this.estaEnElAire && this.y < this.alturaSuelo) {
      this.y = this.alturaSuelo;
    }

    // ---- Agachada ---------------------------------------------------------
    if (this.estaAgachado) {
      this.temporizadorAgachado -= dt;
      if (this.temporizadorAgachado <= 0) this.estaAgachado = false;
    }

    // Pose visual. Va deprisa a propósito: la caja de colisión se encoge al
    // instante, así que la imagen tiene que alcanzarla en un par de fotogramas.
    const objetivoAgachado = this.estaAgachado ? 1 : 0;
    const ta = 1 - Math.exp(-AGACHARSE.VELOCIDAD_POSE * dt);
    this.factorAgachado += (objetivoAgachado - this.factorAgachado) * ta;
    if (Math.abs(objetivoAgachado - this.factorAgachado) < 0.02) {
      this.factorAgachado = objetivoAgachado;
    }

    // La vuelta avanza mientras haya algo de pose, y se pone a cero al salir.
    // Sigue corriendo durante el desvanecido de la pose a propósito: así la
    // voltereta TERMINA —vuelve a 0 rad— en vez de cortarse a media vuelta.
    if (this.factorAgachado > 0.001) {
      this.avanceRodada = Math.min(1, this.avanceRodada + dt / AGACHARSE.DURACION);
    } else {
      this.avanceRodada = 0;
    }

    // ---- Invulnerabilidad -------------------------------------------------
    if (this.invulnerabilidad > 0) this.invulnerabilidad -= dt;

    // ---- Aplicar al modelo ------------------------------------------------
    this.modelo.position.x = this.x;
    this.modelo.position.y = this.y;
    this._colocarSombra();

    // El aplastón del choque manda sobre la pose normal mientras dura: escribe
    // escala y las dos rotaciones, así que la inclinación de carril se salta.
    const aplastando = this._aplastar(dt);

    if (!aplastando) {
      // Inclinación lateral al cambiar de carril: peso visual.
      // Va negada porque el modelo está girado media vuelta sobre Y: sin el
      // signo, el personaje se inclinaría en contra de su propio movimiento.
      const desvio = this.xObjetivo - this.x;
      this.modelo.rotation.y = Math.PI + this.giroCinematico;
      this.modelo.rotation.z = -THREE.MathUtils.clamp(desvio * 0.22, -0.3, 0.3);
    }

    // El levantarse tras el escape: el tronco rueda de −90° a 0 con un
    // suavizado, y una pizca de altura extra evita que los pies asomen bajo el
    // asfalto a mitad de la rodada. Escribe rotation.x, que la carrera normal
    // no toca, así que no pisa a nadie.
    if (this.recuperacion > 0) {
      this.recuperacion = Math.max(0, this.recuperacion - dt);
      const f = 1 - this.recuperacion / 0.55;
      const suave = f * f * (3 - 2 * f);
      this.modelo.rotation.x = -Math.PI / 2 * (1 - suave);
      this.modelo.position.y = this.y + 0.26 * (1 - suave);
    } else if (this.modelo.rotation.x !== 0 && this.vivo) {
      this.modelo.rotation.x = 0;
    }

    // Animación de carrera: la cadencia sube con la velocidad.
    const subida = this.velocidadY / SALTO.VELOCIDAD_INICIAL;
    const cadencia = 6 + (velocidad / 42) * 8;

    // Dos clases de personaje conviven: los del archivo, que traen esqueleto y
    // un ciclo de carrera grabado, y los de cajas. Corren por vías distintas
    // —uno por su mezclador de animación y el otro moviendo pivotes— pero el
    // resto del jugador no se entera: los estados y los tiempos son los mismos.
    if (esGLB(this.modelo)) {
      // La agachada manda sobre el salto: quien rueda no está saltando, y si
      // el mezclador siguiera corriendo machacaría los huesos del ovillo.
      if (this.factorAgachado > 0.001) {
        this.poseManual = true;
        aplicarPoseAgachadoGLB(this.modelo, this.factorAgachado, this.avanceRodada, dt);
      } else if (this.estaEnElAire) {
        this.poseManual = true;
        animarSaltoGLB(this.modelo, subida, this.avanceSalto, dt);
      } else {
        // Se deshace la pose escrita a mano SOLO al volver de ella. Hacerlo
        // cada fotograma dejaba el cuerpo en cruz durante el instante que va
        // de una cosa a la otra, y ese instante se veía: es el fotograma que
        // el jugador pillaba de vez en cuando con el personaje en T.
        if (this.poseManual) {
          // CON CLIPS NO SE REPOSA. El ciclo de carrera funde solo desde donde
          // esté, así que meter un reposo por el medio sobra: era pedirle al
          // mezclador dos actualizaciones en el mismo fotograma y daba un
          // salto de 101 mm de cabeza justo al aterrizar. Sin clips —los
          // personajes de cajas— sí hace falta, o el cuerpo se queda con la
          // última pose escrita a mano.
          if (!usaClipsGLB(this.modelo)) reposarGLB(this.modelo, dt);
          this.poseManual = false;
        }
        animarCarreraGLB(this.modelo, dt, velocidad);
      }
    } else if (this.estaEnElAire) {
      // En el aire la pose ya no está congelada: cambia con la fase del vuelo,
      // así que el despegue, la suspensión y la caída se ven distintos.
      animarSalto(this.modelo, subida);
      aplicarPoseAgachado(this.modelo, this.factorAgachado);
    } else {
      animarCarrera(this.modelo, this.tiempoAnimacion, 1, cadencia);
      // La agachada ya NO toca la escala: el personaje se hace una bola de
      // verdad, recogiendo cada pieza. Antes se aplastaba en Y, y de paso se
      // llevaba por delante el squash del choque —que escribe escala en el
      // mismo fotograma y se veía solo a lo ancho y a lo hondo.
      aplicarPoseAgachado(this.modelo, this.factorAgachado);
    }

    // Parpadeo durante la invulnerabilidad, PERO NO MIENTRAS DURA EL APLASTÓN.
    // El golpe y la invulnerabilidad empiezan en el mismo fotograma, así que
    // con el parpadeo desde el principio la voltereta se veía a medias: media
    // docena de fotogramas sí y otros tantos no, que es como no verla. Primero
    // se ve el porrazo entero, y después parpadea lo que quede.
    if (this.invulnerabilidad > 0 && this.aplaston <= 0) {
      this.modelo.visible = Math.floor(this.invulnerabilidad * 14) % 2 === 0;
    } else {
      this.modelo.visible = true;
    }
  }

  // -------------------------------------------------------------------------
  // NIVEL ELEVADO
  // -------------------------------------------------------------------------

  /**
   * Fija la altura del suelo bajo los pies.
   * @param {number} altura 0 en el asfalto, ELEVADO.ALTURA sobre una tarima
   */
  establecerSuelo(altura) {
    this.alturaSuelo = altura;
  }

  /** Impulso de la rampa. No es un salto: el jugador no ha pulsado nada. */
  impulsar(velocidad) {
    if (!this.vivo) return;
    this.velocidadY = velocidad;
    this.estaEnElAire = true;
    this.caidaRapida = false;
    // La rampa cancela la agachada: subir agachado no tiene sentido y además
    // dejaría la caja de colisión encogida en el aire.
    this.estaAgachado = false;
    this.temporizadorAgachado = 0;
    this.agacharAlAterrizar = false;
  }

  /** ¿Va corriendo por encima de la calle? */
  get vaPorArriba() {
    return this.alturaSuelo > 0.1;
  }

  // -------------------------------------------------------------------------
  // COLISIÓN
  // -------------------------------------------------------------------------

  /** Caja de colisión actual, sensible al estado de agachada y salto. */
  obtenerCaja() {
    const alto = this.estaAgachado ? AGACHARSE.ALTURA_AGACHADO : AGACHARSE.ALTURA_NORMAL;
    return crearCaja(
      this.x,
      this.y + alto / 2,
      0, // El jugador siempre está en z=0; el mundo se mueve hacia él.
      JUGADOR.ANCHO_COLISION,
      alto,
      JUGADOR.PROFUNDIDAD_COLISION,
    );
  }

  /**
   * Registra un golpe. Devuelve true si el golpe se aplicó
   * (false si estaba invulnerable).
   */
  recibirGolpe() {
    if (this.invulnerabilidad > 0) return false;

    // El salvoconducto se gasta en lugar del intento. No cuenta como golpe
    // recibido: para eso lo recogiste.
    if (this.escudo) {
      this.escudo = false;
      this.invulnerabilidad = JUGADOR.INVULNERABILIDAD;
      return false;
    }

    this.golpes += 1;
    this.invulnerabilidad = JUGADOR.INVULNERABILIDAD;
    // Arranca el aplastón. Ver _aplastar().
    this.aplaston = 1;
    return true;
  }

  /**
   * El choque, en clave de dibujo animado.
   *
   * Chocar solo restaba un intento y hacía temblar la cámara: el personaje
   * seguía corriendo con la misma zancada, tan campante, y el golpe se
   * enteraba el HUD antes que el cuerpo. En un runner de este tipo el choque
   * es el momento con más lectura de toda la partida, y tiene que verse EN EL
   * MUÑECO.
   *
   * Lo que hace es lo de siempre en animación: SQUASH AND STRETCH. El cuerpo
   * se aplasta contra lo que se llevó por delante —ancho y alto de más,
   * profundidad de menos— y vuelve a su forma con un rebote elástico que se
   * pasa de largo antes de asentarse. Además da media vuelta sobre sí mismo,
   * que es lo que convierte un tropiezo en una voltereta.
   *
   * Dura menos de medio segundo. Más que eso deja de ser un golpe y pasa a ser
   * una animación que hay que esperar.
   */
  /**
   * La sombra, cada fotograma: dónde cae y cuánto se ve.
   *
   * Va SIEMPRE en el suelo que le toca —la calle o el tablado— y nunca en la
   * altura del personaje: mientras está en el aire, la sombra es lo único que
   * dice dónde va a aterrizar, y en un juego de saltar huecos y cambiar de
   * carril en el aire eso es información, no adorno.
   *
   * Encoge y se aclara con la altura porque es lo que hace una sombra de
   * verdad al alejarse su dueño de la superficie, y porque así la distancia al
   * suelo se lee sin mirar al personaje. A 2,2 m —el pico de un salto normal—
   * queda en el 55 % de su tamaño y a un tercio de su fuerza.
   */
  _colocarSombra() {
    if (!this.sombra) return;
    const suelo = this.volando ? this.y : (this.alturaSuelo ?? 0);
    const altura = Math.max(0, this.y - suelo);
    // 2 cm por encima del suelo: en el mismo plano pelearía con el asfalto y
    // saldría el parpadeo de dos superficies coplanares.
    this.sombra.position.set(this.x, suelo + 0.02, 0);
    const t = Math.min(1, altura / JUGADOR.ALTURA_SOMBRA_NULA);
    this.sombra.scale.setScalar(JUGADOR.RADIO_SOMBRA * (1 - 0.55 * t));
    // Su propio material —crearSombra() lo clona— para poder desvanecerla sin
    // tocar la de nadie más.
    this.sombra.material.opacity = 1 - 0.8 * t;
    this.sombra.visible = altura < JUGADOR.ALTURA_SOMBRA_NULA;
  }

  _aplastar(dt) {
    if (this.aplaston <= 0) return false;

    this.aplaston -= dt / 0.42;
    if (this.aplaston <= 0) {
      this.aplaston = 0;
      this.modelo.scale.set(1, 1, 1);
      return false;
    }

    // t va de 0 (recién chocado) a 1 (recuperado).
    const t = 1 - this.aplaston;
    // Rebote elástico: amplitud que decae multiplicada por una oscilación.
    // El seno arranca en 1 con esta fase, así que el aplastón es máximo en el
    // fotograma del impacto y no medio segundo después.
    const rebote = Math.cos(t * Math.PI * 2.6) * Math.exp(-t * 4.2);

    // CON CLIP, EL SQUASH SE MODERA Y LA PEONZA SE VA. La vuelta entera sobre
    // el eje de avance era un apaño de cuando no había animación de choque:
    // servía para que el golpe se leyera, pero un corredor que da una pirueta
    // completa cada vez que roza una barrera no se lee como que le han dado,
    // se lee como que el juego hace cosas raras. Ahora el cuerpo encaja el
    // golpe de verdad, así que basta con un aplastón más suave y el bandazo.
    const conClip = aplicarGolpeGLB(this.modelo, t, dt);
    const fuerza = conClip ? 0.45 : 1;

    this.modelo.scale.set(
      1 + rebote * 0.45 * fuerza,
      1 - rebote * 0.4 * fuerza,
      1 - rebote * 0.5 * fuerza,
    );

    if (!conClip) {
      // La voltereta: una vuelta entera sobre el eje de avance, encima de la
      // media vuelta que el personaje lleva siempre puesta.
      this.modelo.rotation.y = Math.PI + t * Math.PI * 2;
    } else {
      this.modelo.rotation.y = Math.PI + this.giroCinematico;
    }
    // Y un bandazo lateral, para que no sea una peonza perfecta.
    this.modelo.rotation.z = rebote * 0.5 * fuerza;
    return true;
  }

  /** Arranca o corta el vuelo de la cobertura aérea. */
  volar(activo, altura = 0) {
    this.volando = activo;
    this.alturaVuelo = altura;
    if (activo) {
      this.estaEnElAire = false;
      this.velocidadY = 0;
      this.estaAgachado = false;
      this.temporizadorAgachado = 0;
      this.agacharAlAterrizar = false;
      this.bufferSalto = 0;
    } else {
      // Al terminar, se cae. Con la caída normal, no de golpe.
      this.estaEnElAire = true;
      this.velocidadY = 0;
    }
  }

  /** ¿Se agotaron los golpes disponibles? */
  estaAgotado() {
    return this.golpes >= JUGADOR.GOLPES_MAXIMOS;
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  /** Reinicia al jugador para una nueva partida. */
  reiniciar() {
    this.carril = CARRILES.CENTRO;
    this.x = 0;
    this.xObjetivo = 0;
    this.giroCinematico = 0;
    this.y = 0;
    this.velocidadY = 0;
    this.estaEnElAire = false;
    this.alturaSuelo = 0;
    this.estaAgachado = false;
    this.temporizadorAgachado = 0;
    this.factorAgachado = 0;
    this.bufferSalto = 0;
    this.agacharAlAterrizar = false;
    this.caidaRapida = false;
    this.golpes = 0;
    this.invulnerabilidad = 0;
    this.escudo = false;
    this.multiplicadorSalto = 1;
    this.volando = false;
    this.alturaVuelo = 0;
    this.vivo = true;
    this.aplaston = 0;
    this.modelo.visible = true;
    // Se conserva la media vuelta: el personaje sigue corriendo de espaldas.
    this.modelo.rotation.set(0, Math.PI, 0);
    this.modelo.scale.set(1, 1, 1);
    this._enderezarMiembros();
  }

  /**
   * Vuelta a la carrera tras zafarse del cerco.
   *
   * No es reiniciar(): se conservan los papeles, la distancia y el escenario.
   * Lo que se limpia es el CUERPO —pose de derrota, golpes, estado vertical— y
   * se regala la invulnerabilidad para que el jugador no vuelva a chocar en el
   * primer fotograma con lo mismo que le costó la partida.
   */
  reiniciarTrasEscape() {
    this.vivo = true;
    this.volando = false;
    this.golpes = 0;
    this.invulnerabilidad = JUGADOR.INVULNERABILIDAD * 1.6;

    this.y = 0;
    this.velocidadY = 0;
    this.estaEnElAire = false;
    this.alturaSuelo = 0;
    this.estaAgachado = false;
    this.temporizadorAgachado = 0;
    this.factorAgachado = 0;
    this.bufferSalto = 0;
    this.agacharAlAterrizar = false;
    this.caidaRapida = false;

    this.aplaston = 0;
    this.modelo.visible = true;
    // NO se pone de pie de golpe: la pose de derrota (tumbado, −90° en X) se
    // deshace rodando hacia delante durante la primera media vuelta de
    // zancada. Antes era un teletransporte de cuerpo entero en un fotograma,
    // y era el salto más visible de toda la reanudación.
    this.modelo.rotation.set(-Math.PI / 2, Math.PI, 0);
    this.modelo.scale.set(1, 1, 1);
    this._enderezarMiembros();
    this.recuperacion = 0.55;
  }

  /**
   * Devuelve brazos y piernas a cero.
   *
   * Hace falta porque la pose de derrota los ABRE con rotation.z, y
   * animarCarrera() solo reescribe rotation.x: sin esto, quien se zafa del
   * cerco vuelve a la pista corriendo con los brazos en cruz.
   */
  _enderezarMiembros() {
    if (esGLB(this.modelo)) {
      // Enderezar deja el cuerpo en la pose de reposo del archivo, que es EN
      // CRUZ. Si nadie lo anima antes de pintar —y al reiniciar o al zafarse
      // del cerco pasa medio segundo— el personaje aparece haciendo la T. Un
      // paso de cero segundos del mezclador lo devuelve a su zancada sin
      // adelantar el reloj de la animación.
      reposarGLB(this.modelo);
      animarCarreraGLB(this.modelo, 0, 20);
      this.poseManual = false;
      return;
    }

    // Una pieza suelta puesta en public/ no trae miembros nombrados (ver
    // crearPersonaje). No se la anima ni se la endereza: se la deja como está,
    // que es mejor que reventar la partida entera al morir.
    const p = this.modelo.userData.partes;
    if (!p) return;

    for (const parte of pivotesDe(p)) parte.rotation.set(0, 0, 0);

    p.torso.rotation.set(0, 0, 0);
    p.cadera.rotation.set(0, 0, 0);
    p.cabeza.rotation.set(0, 0, 0);

    // Y el ovillo: si se muere o se reinicia a media voltereta, el cuerpo se
    // queda girado y con las piezas recogidas. Sin esto, el personaje reaparece
    // de lado y hecho una bola.
    reposar(p);
  }

  /**
   * Pose de derrota: BOCA ABAJO EN EL SUELO, despatarrado.
   *
   * Antes se quedaba de pie y se doblaba un poco por la cintura, y era la
   * diferencia entre «se cansó» y «lo tumbaron». Un cuerpo en el suelo con los
   * brazos y las piernas abiertos se lee de un vistazo desde cualquier ángulo,
   * y es además la imagen que se va a imprimir en la portada del día
   * siguiente: la foto del arresto se saca de este fotograma.
   */
  caer() {
    this.vivo = false;
    this.modelo.visible = true;
    this.aplaston = 0;

    // Tumbado y con la cabeza hacia la cámara. La media vuelta de siempre se
    // conserva; lo que se añade es el cuarto de vuelta que lo echa al suelo.
    // Se deshace primero cualquier voltereta a medias: si lo tumban en pleno
    // rodar, el cuerpo está girado dentro del grupo y la pose de derrota se
    // aplicaría encima de esa vuelta.
    this._enderezarMiembros();
    this.factorAgachado = 0;

    this.modelo.scale.set(1, 1, 1);

    // CON CLIP NO SE TUMBA EL MODELO. El final de «big body blow» ya lo deja
    // boca arriba en el suelo, así que el cuarto de vuelta en X —que era la
    // forma de tumbarlo cuando la pose se escribía a mano— lo pondría dos
    // veces: de espaldas al asfalto y de cara a él a la vez.
    if (esGLB(this.modelo) && usaClipsGLB(this.modelo)) {
      this.modelo.rotation.set(0, Math.PI, 0);
      this.y = 0;
      this.modelo.position.y = 0;
      poseDerrotaGLB(this.modelo);
      return;
    }

    this.modelo.rotation.set(-Math.PI / 2, Math.PI, 0);
    this.y = 0.26;
    this.modelo.position.y = this.y;

    if (esGLB(this.modelo)) { poseDerrotaGLB(this.modelo); return; }

    const p = this.modelo.userData.partes;
    if (!p) return;

    // Brazos y piernas ABIERTOS, no colgando: es lo que dice «cayó», y sin
    // ello un cuerpo tumbado se lee como un cuerpo de pie visto raro.
    p.brazoIzq.rotation.set(0, 0, 1.15);
    p.brazoDer.rotation.set(0, 0, -1.15);
    p.piernaIzq.rotation.set(0, 0, 0.42);
    p.piernaDer.rotation.set(0, 0, -0.42);
    p.torso.rotation.x = 0;
    p.cabeza.rotation.x = 0.25;
  }

  /** Cambia el personaje jugable en caliente. */
  cambiarPersonaje(nombre) {
    this.escena.remove(this.modelo);
    this.modelo = crearPersonaje(nombre);
    this.modelo.rotation.y = Math.PI;
    this.escena.add(this.modelo);
    this.reiniciar();
  }
}
