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
import { crearChochologo, crearAlondra, animarCarrera, aplicarPoseAgachado } from '../models/characters.js';
import { crearCaja } from '../utils/collision.js';

export class Player {
  /**
   * @param {THREE.Scene} escena
   * @param {'chochologo'|'alondra'} personaje
   */
  constructor(escena, personaje = 'chochologo') {
    this.escena = escena;

    // ---- Modelo visual ----------------------------------------------------
    this.modelo = personaje === 'alondra' ? crearAlondra() : crearChochologo();
    this.modelo.position.set(0, 0, 0);
    // Media vuelta: el personaje se construye mirando a +Z (con las gafas y la
    // credencial delante), pero corre hacia -Z. Sin esta rotación veríamos su
    // cara todo el rato y la mochila PRENSA quedaría oculta detrás.
    this.modelo.rotation.y = Math.PI;
    escena.add(this.modelo);

    // ---- Estado de carril -------------------------------------------------
    this.carril = CARRILES.CENTRO;
    this.x = 0;          // Posición real (interpolada)
    this.xObjetivo = 0;  // Posición del carril destino

    // ---- Estado vertical --------------------------------------------------
    this.y = 0;
    this.velocidadY = 0;
    this.estaEnElAire = false;

    // ---- Estado de agachada ----------------------------------------------
    this.estaAgachado = false;
    this.temporizadorAgachado = 0;
    this.factorAgachado = 0; // 0..1, para suavizar la pose visual

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

    // ---- Animación --------------------------------------------------------
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

    if (!this.estaEnElAire) {
      this.velocidadY = SALTO.VELOCIDAD_INICIAL;
      this.estaEnElAire = true;
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
    this.tiempoAnimacion += dt;

    // ---- Desplazamiento lateral ------------------------------------------
    // Lerp exponencial: independiente del framerate, a diferencia de un
    // `x += diff * factor` fijo (que va más rápido a más FPS).
    const t = 1 - Math.exp(-CARRILES.VELOCIDAD_CAMBIO * dt);
    this.x += (this.xObjetivo - this.x) * t;
    if (Math.abs(this.xObjetivo - this.x) < 0.01) this.x = this.xObjetivo;

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

      if (this.y <= 0) {
        // Aterrizaje
        this.y = 0;
        this.velocidadY = 0;
        this.estaEnElAire = false;
        this.caidaRapida = false;

        // Los buffers se resuelven aquí, en orden de prioridad.
        // El salto manda sobre la agachada: si el jugador pidió las dos cosas,
        // saltar es lo que le saca de más apuros.
        if (this.bufferSalto > 0) {
          this.velocidadY = SALTO.VELOCIDAD_INICIAL;
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

    // ---- Invulnerabilidad -------------------------------------------------
    if (this.invulnerabilidad > 0) this.invulnerabilidad -= dt;

    // ---- Aplicar al modelo ------------------------------------------------
    this.modelo.position.x = this.x;
    this.modelo.position.y = this.y;

    // Inclinación lateral al cambiar de carril: peso visual.
    // Va negada porque el modelo está girado media vuelta sobre Y: sin el
    // signo, el personaje se inclinaría en contra de su propio movimiento.
    const desvio = this.xObjetivo - this.x;
    this.modelo.rotation.z = -THREE.MathUtils.clamp(desvio * 0.22, -0.3, 0.3);

    // Animación de carrera: la cadencia sube con la velocidad.
    const cadencia = 6 + (velocidad / 42) * 8;
    if (this.estaEnElAire) {
      // En el aire congelamos las piernas en pose de salto.
      const p = this.modelo.userData.partes;
      p.piernaIzq.rotation.x = -0.55;
      p.piernaDer.rotation.x = 0.35;
      p.brazoIzq.rotation.x = -1.1;
      p.brazoDer.rotation.x = -1.1;
    } else {
      animarCarrera(this.modelo, this.tiempoAnimacion, 1, cadencia);
    }

    aplicarPoseAgachado(this.modelo, this.factorAgachado);

    // Parpadeo durante la invulnerabilidad.
    if (this.invulnerabilidad > 0) {
      this.modelo.visible = Math.floor(this.invulnerabilidad * 14) % 2 === 0;
    } else {
      this.modelo.visible = true;
    }
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
    this.golpes += 1;
    this.invulnerabilidad = JUGADOR.INVULNERABILIDAD;
    return true;
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
    this.y = 0;
    this.velocidadY = 0;
    this.estaEnElAire = false;
    this.estaAgachado = false;
    this.temporizadorAgachado = 0;
    this.factorAgachado = 0;
    this.bufferSalto = 0;
    this.agacharAlAterrizar = false;
    this.caidaRapida = false;
    this.golpes = 0;
    this.invulnerabilidad = 0;
    this.vivo = true;
    this.modelo.visible = true;
    // Se conserva la media vuelta: el personaje sigue corriendo de espaldas.
    this.modelo.rotation.set(0, Math.PI, 0);
    this.modelo.scale.set(1, 1, 1);
  }

  /** Pose de derrota: el personaje se detiene y se dobla. */
  caer() {
    this.vivo = false;
    this.modelo.visible = true;
    const p = this.modelo.userData.partes;
    p.torso.rotation.x = 0.9;
    p.cabeza.rotation.x = 0.5;
    p.brazoIzq.rotation.x = -2.2;
    p.brazoDer.rotation.x = -2.2;
  }

  /** Cambia el personaje jugable en caliente. */
  cambiarPersonaje(nombre) {
    this.escena.remove(this.modelo);
    this.modelo = nombre === 'alondra' ? crearAlondra() : crearChochologo();
    this.modelo.rotation.y = Math.PI;
    this.escena.add(this.modelo);
    this.reiniciar();
  }
}
