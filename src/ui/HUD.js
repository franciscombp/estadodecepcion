// ============================================================================
// HUD — Interfaz durante la partida
// ============================================================================
// Composición (ver docs/ESTILO.md):
//
//   ┌──────────────────────────────────────────┐
//   │ [⏸]                            [📄 248] │  estado permanente
//   │ RUTA                        ┌──────────┐ │
//   │ BAHÍA                       │ ⚠ AVISO  │ │  eventos temporales
//   │  ● ○ ○ ○                    └──────────┘ │
//   │            (la escena respira aquí)      │
//   │ ┌────────┐  ┌──────────┐   ┌─────────┐  │
//   │ │ PRUEBAS │ │ DISTANCIA│   │ DESLIZA │  │  resumen y ayuda
//   │ └────────┘  └──────────┘   └─────────┘  │
//   └──────────────────────────────────────────┘
//
// El centro se deja libre: es donde el jugador tiene la mirada.
//
// RENDIMIENTO: esto se actualiza 60 veces por segundo. La regla es NO tocar
// el DOM si el valor no cambió — cada escritura en textContent o style
// dispara recálculo de layout, y hacerlo para diez campos cada fotograma se
// come el presupuesto de 16 ms en un móvil de gama media.
// ============================================================================

import { JUGADOR } from '../config/balance.js';


import * as Icono from './iconos.js';

export class HUD {
  /** @param {HTMLElement} contenedor */
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.raiz = null;
    this.visible = false;

    // Caché de últimos valores: evita escrituras redundantes en el DOM.
    this.cache = this._cacheVacia();

    // El hint de deslizar solo se muestra las primeras partidas.
    this.mostrarHint = true;

    // QUÉ MANDA EN PANTALLA AHORA MISMO.
    //
    // El HUD tiene tres cosas peleándose por la misma banda de arriba: el
    // marcador del expediente, el cartel de salida y la ficha de racha, y las
    // tres salían a la vez montadas unas encima de otras. Se apilaban de
    // verdad —el panel del trámite tapaba el botón de pausa, el cartel tapaba
    // la racha, y el aviso de «EN RACHA» se ponía encima del cartel—.
    //
    // La regla es que en cada momento hay UNA cosa importante y el resto se
    // aparta: dentro del túnel lo único que importa es recoger, y en la
    // bifurcación lo único que importa es a dónde lleva cada vía. Mientras haya
    // algo aquí dentro, lo demás se atenúa y los avisos ni se crean.
    this.prioridad = new Set();

    // Espejo del DOM, no de los datos: dice si el marcador del expediente está
    // puesto. Ver _actualizarExpediente() — deliberadamente FUERA de la caché,
    // porque invalidar() la vacía y dejaba el panel colgado toda la partida.
    this.expedientePuesto = false;

    // HASTA CUÁNDO SE QUEDA EL PANEL DESPUÉS DE QUE SE ACABE EL PASILLO.
    //
    // Ver cerrarExpediente(). Cero mientras no haya un cierre en curso.
    this.cierreExpedienteHasta = 0;
  }

  _cacheVacia() {
    return {
      papeles: -1,
      distancia: -1,
      cercania: -1,
      golpes: -1,
      escenario: null,
      linterna: -1,
      record: -1,
      tramite: -1,
      porArriba: null,
      efectos: '',
    };
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  montar() {
    if (this.raiz) return;

    this.raiz = document.createElement('div');
    this.raiz.className = 'hud';
    this.raiz.innerHTML = `
      <!-- ══ EL HUD, COMO LO MONTA LA REFERENCIA ══
           Subway Surfers pone CUATRO cosas encima del juego y ni una más: la
           pausa arriba a la izquierda, la columna de cifras arriba a la
           derecha, las píldoras de lo que esté activo abajo, y NADA en el
           centro. Nunca.

           Ese vacío del centro no es austeridad, es que el centro es por donde
           se corre: todo lo que se ponga ahí compite con lo único que el
           jugador está mirando de verdad.

           Aquí había además un rótulo fijo de «Evidencia recolectada», la
           ficha de racha, los «+N» flotantes, el titular del barrio en dos
           líneas de PT Serif, la línea de progreso de escenario, hasta tres
           toasts apilados y un pie de foto con crédito. Todo eso se lee en la
           pantalla de resultados, que es donde hay tiempo para leer. -->

      <div class="hud__superior">
        <!-- Arriba a la izquierda: SOLO la pausa. -->
        <button class="boton-icono boton-icono--rojo" data-campo="pausa"
                type="button" aria-label="Pausar">
          ${Icono.pausa(22)}
        </button>

        <!-- Arriba a la derecha, en columna y alineado a la derecha: la cifra
             de la corrida, los metros, el récord con su etiqueta, y los puntos
             de intento. En la referencia son cuatro renglones y ninguno lleva
             fondo propio: van sueltos sobre la calle, con sombra. -->
        <div class="marcador">
          <div class="marcador__linea marcador__linea--fuerte">
            <span class="contador__valor" data-campo="papeles">0</span>
          </div>
          <div class="marcador__linea">
            <span class="marcador__cifra" data-campo="distancia">0 m</span>
          </div>
          <div class="marcador__record">
            <span class="marcador__rotulo">MEJOR</span>
            <span class="marcador__cifra" data-campo="record">0</span>
          </div>
          <div class="intentos" data-campo="intentos"></div>
        </div>
      </div>

      <!-- Marcador del expediente. Solo aparece dentro del túnel del centro,
           donde es LA información: no hay obstáculos que mirar, solo cuántos
           papeles llevas y cuántos faltan. -->
      <div class="expediente expediente--oculto" data-campo="expediente">
        <div class="expediente__institucion" data-campo="expediente-institucion"></div>
        <div class="expediente__cuenta">
          <span data-campo="expediente-recogidos">0</span>
          <span class="expediente__barra">/</span>
          <span data-campo="expediente-total">0</span>
        </div>
        <div class="medidor medidor--fino">
          <span class="medidor__relleno medidor__relleno--dorado"
                data-campo="expediente-progreso"></span>
        </div>
        <div class="expediente__aviso" data-campo="expediente-aviso">
          RECUPERA LOS QUE PUEDAS
        </div>
      </div>

      <!-- Cartel de salida. Es señalización de autopista, y va en el HUD y no
           en la calle: un pórtico dentro del mundo se lee de refilón, en
           escorzo y a la velocidad a la que pasa. Este baja desde arriba,
           se queda mientras haya que decidir, y se sube solo. -->
      <div class="rotulo rotulo--oculto" data-campo="rotulo">
        <div class="rotulo__salida" data-campo="rotulo-salida">SALIDA</div>
        <div class="rotulo__vias" data-campo="rotulo-vias"></div>
      </div>

      <!-- ══ ABAJO: LO QUE ESTÁ ACTIVO Y CUÁNTO LE QUEDA ══
           Estaba montado y APAGADO a mano, con el argumento de que enseñar un
           potenciador que no se puede elegir no informa de nada. Informa de lo
           que informa en la referencia: CUÁNTO TE QUEDA. Sin eso, el imán se
           acaba y el jugador no sabe por qué han dejado de venirle los papeles
           solos. Y ahora hace falta el doble, porque al quitar los toasts esta
           píldora es lo único que dice qué acabas de recoger.
           Solo se pinta si hay algo activo: la lista vacía no deja nada. -->
      <div class="efectos" data-campo="efectos"></div>

      <!-- La rosa de deslizamiento. Solo en la primera corrida: es la chuleta
           de controles, no un panel permanente. -->
      <div class="hint-swipe" data-campo="hint">
        <div class="rosa-swipe">
          <span class="rosa-swipe__arriba">${Icono.flecha('arriba', 20)}</span>
          <span class="rosa-swipe__izq">${Icono.flecha('izquierda', 20)}</span>
          <span class="rosa-swipe__mano">${Icono.mano(24)}</span>
          <span class="rosa-swipe__der">${Icono.flecha('derecha', 20)}</span>
          <span class="rosa-swipe__abajo">${Icono.flecha('abajo', 20)}</span>
        </div>
      </div>

      <!-- Tinte de peligro en los bordes cuando aprietan -->
      <div class="tinte-peligro" data-campo="tinte"></div>

      <!-- Destello que tapa el corte de escenario al tomar un desvío -->
      <div class="destello" data-campo="destello"></div>
    `;

    this.contenedor.appendChild(this.raiz);

    // Referencias cacheadas: querySelector en cada fotograma sería otro
    // coste innecesario.
    const q = (sel) => this.raiz.querySelector(`[data-campo="${sel}"]`);
    this.ref = {
      pausa: q('pausa'),
      papeles: q('papeles'),
      distancia: q('distancia'),
      record: q('record'),
      intentos: q('intentos'),
      rotulo: q('rotulo'),
      rotuloSalida: q('rotulo-salida'),
      rotuloVias: q('rotulo-vias'),
      hint: q('hint'),
      tinte: q('tinte'),
      destello: q('destello'),
      expediente: q('expediente'),
      expedienteInstitucion: q('expediente-institucion'),
      expedienteRecogidos: q('expediente-recogidos'),
      expedienteTotal: q('expediente-total'),
      expedienteProgreso: q('expediente-progreso'),
      expedienteAviso: q('expediente-aviso'),
      efectos: q('efectos'),
    };

    this._construirIntentos();
  }

  _construirIntentos() {
    this.ref.intentos.innerHTML = '';
    this.puntosIntento = [];
    for (let i = 0; i < JUGADOR.GOLPES_MAXIMOS; i++) {
      const punto = document.createElement('span');
      punto.className = 'intento';
      this.ref.intentos.appendChild(punto);
      this.puntosIntento.push(punto);
    }
  }


  /** Engancha el botón de pausa. */
  alPulsarPausa(callback) {
    this.montar();
    this.ref.pausa.addEventListener('click', (e) => {
      e.stopPropagation();
      callback();
    });
  }

  // -------------------------------------------------------------------------
  // VISIBILIDAD
  // -------------------------------------------------------------------------

  mostrar() {
    this.montar();
    this.raiz.classList.add('hud--visible');
    this.visible = true;
  }

  ocultar() {
    if (this.raiz) this.raiz.classList.remove('hud--visible');
    this.visible = false;
  }

  /** Fuerza un repintado completo la próxima vez. */
  invalidar() {
    this.cache = this._cacheVacia();
  }

  /** Oculta el hint de deslizar (tras la primera partida). */
  ocultarHint() {
    this.mostrarHint = false;
    if (this.ref?.hint) this.ref.hint.classList.add('hint-swipe--oculto');
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  actualizar(datos) {
    if (!this.visible || !this.ref) return;
    const c = this.cache;

    // --- Papeles -----------------------------------------------------------
    if (datos.papeles !== c.papeles) {
      this.ref.papeles.textContent = datos.papeles.toLocaleString('es-EC');
      // Latido al sumar: confirma la recogida sin necesidad de leer el número.
      if (datos.papeles > c.papeles && c.papeles >= 0) {
        // El golpe: la cifra crece de golpe y vuelve. Es lo único de la
        // pantalla que responde a lo que acaba de hacer el jugador, así que
        // responde de verdad y no con un parpadeo.
        this.ref.papeles.classList.add('contador__valor--golpe');
        clearTimeout(this._golpe);
        this._golpe = setTimeout(
          () => this.ref.papeles.classList.remove('contador__valor--golpe'), 150,
        );
      }
      c.papeles = datos.papeles;
    }

    // LA RACHA YA NO SE PINTA. El campo `combo` se sigue emitiendo y lo usan
    // el color de las chispas y el tono del audio, que es donde la racha se
    // percibe SIN LEER NADA. La ficha de «×7 IMPARABLE» colgaba del contador y
    // rebotaba con cada papel: texto en movimiento justo en la esquina que hay
    // que mirar para saber la cifra, así que el ojo volvía ahí en vez de al
    // carril. La referencia no tiene nada parecido, y no es un descuido suyo.

    // --- Distancia ---------------------------------------------------------
    if (datos.distancia !== c.distancia) {
      this.ref.distancia.textContent = `${datos.distancia.toLocaleString('es-EC')} m`;
      c.distancia = datos.distancia;
    }

    // --- Intentos restantes ------------------------------------------------
    if (datos.golpesRestantes !== c.golpes) {
      this.puntosIntento.forEach((punto, i) => {
        punto.classList.toggle('intento--gastado', i >= datos.golpesRestantes);
      });
      c.golpes = datos.golpesRestantes;
    }

    // --- Escenario ---------------------------------------------------------
    if (datos.escenario !== c.escenario) {
      // EL BARRIO NO SE ESCRIBE ENCIMA. Estaban el lema y el nombre en dos
      // líneas de PT Serif ocupando el tercio superior izquierdo, permanentes.
      // El barrio ya lo dice el barrio: los toldos de la Bahía no se parecen a
      // Carondelet. Y si hay que nombrarlo, se nombra en los resultados, que es
      // donde hay tiempo para leer.

      // El escenario tiñe el HUD entero: cada tramo se siente distinto.
      this.raiz.dataset.escenario = datos.escenario;
      c.escenario = datos.escenario;
    }

    // --- Perseguidor -------------------------------------------------------
    // NO hay barra. La había, y sobraba: los perseguidores están en pantalla,
    // corriendo, con el hueco cerrándose. Medir en una barra lo que ya se ve
    // es pedirle al jugador que aparte la vista del carril para enterarse de
    // algo que tenía delante.
    //
    // Lo que sí se queda es el tinte de los bordes, que no se lee: se percibe.
    const pctCercania = Math.round(datos.cercania * 100);
    if (pctCercania !== c.cercania) {
      this.ref.tinte.style.opacity = pctCercania > 65
        ? String((pctCercania - 65) / 35 * 0.55)
        : '0';
      c.cercania = pctCercania;
    }

    // --- Destello de transición -------------------------------------------
    // Sin caché: dura menos de un segundo y su valor cambia cada fotograma,
    // así que comparar saldría más caro que escribir.
    if (datos.destello !== undefined) {
      this.ref.destello.style.opacity = String(datos.destello * 0.75);
    }

    // --- Expediente (túnel del centro) ------------------------------------
    this._actualizarExpediente(datos.tramite);

    // --- Nivel elevado -----------------------------------------------------
    // Correr por arriba cambia el marco de la pantalla. Es un aviso periférico
    // de "ojo, esto se acaba" que no obliga a leer nada.
    if (datos.porArriba !== c.porArriba) {
      this.raiz.classList.toggle('hud--elevado', !!datos.porArriba);
      c.porArriba = datos.porArriba;
    }

    // --- Potenciadores activos ---------------------------------------------
    this._actualizarEfectos(datos.efectos ?? []);

    // --- El récord, tercera línea de la columna ----------------------------
    if (datos.record !== c.record) {
      this.ref.record.textContent = (datos.record ?? 0).toLocaleString('es-EC');
      c.record = datos.record;
    }
  }

  /**
   * Marcador del expediente. Se dibuja solo dentro del trámite; el resto del
   * tiempo el panel ni existe en pantalla.
   */
  _actualizarExpediente(tramite) {
    // Si está puesto o no se lleva APARTE de la caché de valores, y no es
    // duplicar estado por gusto: `invalidar()` vacía la caché entera al volver
    // de cualquier pantalla, y el HUD la invalida justo al reanudar el juego
    // —o sea, al salir del túnel—. Con la marca dentro de la caché, ese vaciado
    // dejaba escrito «ya está oculto» mientras el panel seguía en pantalla, y
    // la rama de abajo no volvía a entrar nunca: el marcador del expediente se
    // quedaba puesto el resto de la partida, y con él el modo de prioridad, así
    // que la ruta y la racha tampoco volvían. Esta marca refleja el DOM, y el
    // DOM no lo vacía `invalidar()`.
    // EL PORTAZO TARDA UN SEGUNDO EN LEERSE. Ver cerrarExpediente().
    //
    // El congelado va ANTES de mirar si hay pasillo, y no dentro de la rama de
    // «ya no hay»: al salir, el trámite tarda uno o dos fotogramas en darse por
    // terminado, así que durante esos fotogramas seguía llegando aquí con datos
    // y reescribía el remate con la cuenta de siempre. Mientras dure el cierre
    // no se toca nada: el panel se queda exactamente como lo dejó el portazo.
    if (this.cierreExpedienteHasta) {
      if (performance.now() < this.cierreExpedienteHasta) return;
      this.cierreExpedienteHasta = 0;
    }

    if (!tramite) {
      if (this.expedientePuesto) {
        this.ref.expediente.classList.add('expediente--oculto');
        this._prioridad('tramite', false);
        this.expedientePuesto = false;
        this.cache.tramite = -1;
      }
      return;
    }

    if (!this.expedientePuesto) {
      this.ref.expediente.classList.remove('expediente--oculto');
      this.ref.expedienteInstitucion.textContent = tramite.institucion;
      this.ref.expedienteTotal.textContent = String(tramite.total);
      // Dentro del túnel no hay obstáculos ni desvíos: recoger es lo único que
      // se puede hacer, así que el marcador se queda solo en la banda.
      this._prioridad('tramite', true);
      this.expedientePuesto = true;
      this.cache.tramite = -1;  // Fuerza el pintado de la cuenta más abajo.
    }

    if (tramite.recogidos !== this.cache.tramite) {
      this.ref.expedienteRecogidos.textContent = String(tramite.recogidos);

      // LA SEÑAL ES SI VAS POR ENCIMA O POR DEBAJO DE LA MITAD, no si se te
      // escapó alguno. Antes se encendía en rojo al dejar atrás el tercer
      // papel, y con el reguero acotado a unas decenas eso decía algo; ahora se
      // riegan TODOS los que llevabas, así que se te quedan atrás docenas
      // siempre y el aviso estaría permanentemente encendido sin informar de
      // nada.
      //
      // La mitad no es un número cualquiera: como lo recuperado vale ×2, en la
      // mitad exacta sales igual que entraste. Por debajo el pasillo te costó
      // papeles y por encima te pagó, que es LA pregunta del tramo.
      const bajoLaMitad = tramite.recogidos * 2 < (tramite.pasados ?? 0);
      this.ref.expediente.classList.toggle('expediente--perdido', bajoLaMitad);

      // EL ÚNICO FINAL DEL JUEGO NO SE ANUNCIABA EN NINGUNA PARTE.
      //
      // Se gana recuperando el reguero ENTERO, y esta línea solo hablaba de la
      // mitad —el punto en el que el pasillo deja de costarte papeles—. O sea
      // que el jugador podía llegar al 95 % sin que nada le dijera que había
      // algo ahí arriba, y sin saberlo no lo va a intentar nunca: quien va
      // salvando el expediente se relaja justo cuando debería apretar.
      //
      // A partir del noventa por ciento la línea cambia y lo dice. No antes:
      // prometer el final a mitad de pasillo sería prometer algo que casi
      // nunca se cumple, y eso desgasta más de lo que empuja.
      const quedan = (tramite.total ?? 0) - tramite.recogidos;
      const casi = tramite.total > 0 && tramite.recogidos >= tramite.total * 0.9;

      // El ×2 va en el rótulo permanente del expediente, no en un aviso que se
      // va solo: es la regla del tramo, y hay que poder consultarla en
      // cualquier momento de los trescientos cuarenta metros que dura.
      this.ref.expedienteAviso.textContent = casi
        ? (quedan > 0 ? `TE FALTAN ${quedan} PARA SALVARLO ENTERO` : 'LO TIENES ENTERO')
        : bajoLaMitad
          ? 'VAS POR DEBAJO DE LA MITAD · VALEN ×2'
          : 'VAS SALVANDO EL EXPEDIENTE · VALEN ×2';
      this.ref.expediente.classList.toggle('expediente--casi', casi);
      this.cache.tramite = tramite.recogidos;

      // Animación de progreso: pulse visual cuando se actualiza
      this._animarProgresoExpediente();
    }

    this.ref.expedienteProgreso.style.width = `${Math.round(tramite.progreso * 100)}%`;
  }

  /**
   * EL PORTAZO, CONTADO DONDE SE CONTÓ EL PASILLO.
   *
   * A partir de la SEGUNDA visita a un ente de control el juego no para: se
   * entra directo y se sale directo. Eso está bien —tres párrafos que ya
   * leíste dejan de ser un respiro y pasan a ser un peaje— pero dejaba la
   * salida completamente muda: el marcador del expediente se apagaba en el
   * mismo fotograma en que se acababa el pasillo y el jugador volvía a la
   * calle sin saber ni cuántos papeles rescató ni —peor— que acababa de salir
   * con la pieza del caso, que es LO ÚNICO que compensa haber entrado.
   *
   * Y como a partir de la segunda vez es casi siempre, el trámite se estaba
   * jugando a ciegas casi siempre.
   *
   * El remate va en el propio panel del expediente y no en una tarjeta nueva:
   * es donde el jugador ha tenido los ojos los trescientos cuarenta metros
   * anteriores, y este HUD no tiene avisos flotantes a propósito.
   *
   * La prioridad se suelta YA —el resto del HUD deja de estar atenuado en el
   * acto— porque al salir del pasillo empieza otro tramo con obstáculos: lo
   * que se queda un momento más es el panel, no la penumbra.
   *
   * @param {{devueltos?:number, hallazgo?:string}} resumen
   */
  cerrarExpediente(resumen = {}) {
    if (!this.expedientePuesto || !this.ref?.expediente) return;

    const devueltos = resumen.devueltos ?? 0;
    const hallazgo = resumen.hallazgo ?? null;

    this.ref.expedienteAviso.textContent = hallazgo
      ? `SALES CON +${devueltos} · ${hallazgo.toLocaleUpperCase('es')}`
      : `SALES CON +${devueltos}`;
    // En verde aunque hayas salido perdiendo: lo que dice esta línea ya no es
    // si el pasillo te pagó —eso lo dijo durante los 340 metros— sino con qué
    // sales, y con la pieza del caso siempre sales ganando algo.
    this.ref.expediente.classList.remove('expediente--perdido');

    this._prioridad('tramite', false);
    this.cierreExpedienteHasta = performance.now() + 2000;
  }

  /**
   * Enciende o apaga un modo de prioridad y lo refleja en la raíz del HUD.
   *
   * El CSS hace el resto: `.hud--tramite` y `.hud--rotulo` atenúan o retiran lo
   * que estorba a la pieza que manda en ese momento.
   *
   * @param {'tramite'|'rotulo'} modo
   * @param {boolean} activo
   */
  _prioridad(modo, activo) {
    if (activo) this.prioridad.add(modo);
    else this.prioridad.delete(modo);
    this.raiz?.classList.toggle(`hud--${modo}`, activo);

    // Se barren los avisos que ya estuvieran puestos. Bloquear solo los nuevos
    // no bastaba: un aviso dura 2,4 segundos, así que recoger una evidencia
    // justo antes de entrar al túnel dejaba la tarjeta colgando encima del
    // marcador del expediente durante los dos primeros segundos del tramo.
  }

  /**
   * Anima el expediente cuando progresa: pulse visual en el panel y glow en la barra.
   */
  _animarProgresoExpediente() {
    if (!this.ref?.expediente) return;

    // Quitar la clase si ya existe (reiniciar la animación)
    this.ref.expediente.classList.remove('expediente--progresa');

    // Forzar reflujo para reiniciar la animación
    void this.ref.expediente.offsetWidth;

    // Añadir la clase para disparar la animación
    this.ref.expediente.classList.add('expediente--progresa');

    // Remover la clase después de que termine la animación (500ms)
    setTimeout(() => {
      this.ref?.expediente?.classList.remove('expediente--progresa');
    }, 500);
  }

  /**
   * Fichas de los potenciadores activos, con su cuenta atrás.
   *
   * La lista se repinta solo cuando CAMBIA la composición (qué potenciadores
   * hay), no cuando cambia el tiempo restante: el vaciado de la barra se hace
   * con un ancho, que es una sola escritura de estilo y no toca el layout del
   * resto. Repintar el HTML entero sesenta veces por segundo por una barra que
   * baja sería tirar el presupuesto de fotograma.
   */
  _actualizarEfectos(lista) {
    const firma = lista.map((e) => e.id).join(',');

    if (firma !== this.cache.efectos) {
      this.ref.efectos.innerHTML = '';
      this.fichasEfecto = new Map();

      for (const efecto of lista) {
        const ficha = document.createElement('div');
        ficha.className = `efecto efecto--${efecto.id}`;
        // PÍLDORA HORIZONTAL: icono a la izquierda, barra a la derecha, como
        // en la referencia. Era una pastilla cuadrada con una batería de ocho
        // casillas DEBAJO, en columna, ocupando el costado entero de la
        // pantalla. Ocho casillas se cuentan; una barra continua se mira de
        // reojo, que es todo el tiempo que hay para mirarla mientras corres.
        ficha.innerHTML = `
          <span class="efecto__tarjeta">${Icono.iconoPotenciador(efecto.id, 22)}</span>
          <span class="efecto__barra"><span class="efecto__relleno"></span></span>
        `;
        ficha.title = efecto.nombre;

        this.ref.efectos.appendChild(ficha);
        this.fichasEfecto.set(efecto.id, {
          ficha,
          relleno: ficha.querySelector('.efecto__relleno'),
          ultimo: -1,
        });
      }

      this.cache.efectos = firma;
    }

    for (const efecto of lista) {
      const ref = this.fichasEfecto?.get(efecto.id);
      if (!ref) continue;

      // Se escribe al uno por ciento, no a sesenta veces por segundo: una barra
      // de doscientos píxeles no distingue nada por debajo de eso.
      const pct = Math.round(efecto.fraccion * 100);
      if (pct === ref.ultimo) continue;
      ref.relleno.style.width = `${pct}%`;
      // El último quinto parpadea: es el aviso de que se acaba.
      ref.ficha.classList.toggle('efecto--agotandose', pct <= 20);
      ref.ultimo = pct;
    }
  }


  // -------------------------------------------------------------------------
  // AVISOS
  // -------------------------------------------------------------------------



  // Ya no hay avisos que limpiar —los toasts se fueron con el bloque de
  // borrado—, pero el método se queda: es el que apaga el tinte de peligro y
  // el destello al salir de la partida, y lo llaman tres sitios de main.js.
  limpiarAvisos() {
    if (this.ref?.tinte) this.ref.tinte.style.opacity = '0';
    if (this.ref?.destello) this.ref.destello.style.opacity = '0';
    this.ocultarRotulo();
  }

  // -------------------------------------------------------------------------
  // CARTEL DE SALIDA
  // -------------------------------------------------------------------------
  // Señalización de autopista, con su panel verde por vía, su flecha y su
  // pestaña de salida. Va en el HUD y no en la calle, y ese cambio no es de
  // gusto: un pórtico dentro del mundo se lee en escorzo, de refilón y durante
  // el segundo y medio que tarda en pasar por encima. Fijo arriba se lee
  // entero, todo el rato que dura la decisión.

  /**
   * Baja el cartel. Se queda hasta que lo quiten.
   *
   * @param {{izquierda:string, centro:string, derecha:string}} destinos
   * @param {boolean} centroEsPeligro El del centro es el cerco, no una salida
   */
  mostrarRotulo(destinos, centroEsPeligro = false) {
    if (!this.ref?.rotulo) return;

    const vias = [
      { clave: 'izquierda', flecha: '↖', nombre: destinos.izquierda },
      { clave: 'centro', flecha: '↑', nombre: destinos.centro, peligro: centroEsPeligro },
      { clave: 'derecha', flecha: '↗', nombre: destinos.derecha },
    ];

    this.ref.rotuloVias.innerHTML = '';
    for (const via of vias) {
      const panel = document.createElement('div');
      panel.className = `via${via.peligro ? ' via--peligro' : ''}`;
      panel.innerHTML = `
        <span class="via__flecha"></span>
        <span class="via__nombre"></span>
      `;
      panel.querySelector('.via__flecha').textContent = via.flecha;
      panel.querySelector('.via__nombre').textContent = via.nombre;
      this.ref.rotuloVias.appendChild(panel);
    }

    this.ref.rotuloSalida.textContent = centroEsPeligro ? 'SIN SALIDA' : 'PRÓXIMA SALIDA';
    this.ref.rotulo.classList.toggle('rotulo--peligro', centroEsPeligro);
    // Mientras el cartel esté puesto, manda él: la ficha de racha se recoge y
    // los avisos dejan de salir. Antes se limitaban a bajar un poco y seguían
    // cayendo encima de las vías.
    // Enciende el modo y de paso barre los avisos que hubiera puestos. No se
    // usa limpiarAvisos() porque termina llamando a ocultarRotulo() y se
    // llevaría por delante el cartel que acabamos de bajar.
    this._prioridad('rotulo', true);
    // Dos fotogramas de margen: aplicar la clase en el mismo tick en que se
    // rellena el contenido se salta la transición y el cartel aparece de golpe.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.ref?.rotulo.classList.remove('rotulo--oculto'));
    });
  }

  /** Lo sube otra vez. La transición la lleva el CSS. */
  ocultarRotulo() {
    this.ref?.rotulo?.classList.add('rotulo--oculto');
    this._prioridad('rotulo', false);
  }
}
