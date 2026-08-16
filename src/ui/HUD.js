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

import { JUGADOR, tramoRacha } from '../config/balance.js';

// Casillas de la batería de un potenciador activo. Ocho es el número que hace
// que cada una valga algo: con cuatro, cada casilla es un cuarto de la duración
// y el aviso llega tarde; con dieciséis nadie las cuenta, se leen como barra.
const TRAMOS_BATERIA = 8;
import { obtenerEscenario, ORDEN_ESCENARIOS } from '../config/escenarios.js';
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
  }

  _cacheVacia() {
    return {
      papeles: -1,
      distancia: -1,
      cercania: -1,
      golpes: -1,
      combo: -1,
      escenario: null,
      linterna: -1,
      pruebas: -1,
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
      <!-- ══ FILA SUPERIOR ══
           DEL FIGMA: rótulo en Montserrat roja, cifra en PT Serif roja con un
           halo blanco que la despega de la calle, y la pausa como un cuadrado
           rojo pleno. Debajo, un filete fino cierra la cabecera. -->
      <div class="hud__superior">
        <span class="hud__rotulo-evidencia">Evidencia recolectada</span>

        <div class="contador contador--dorado">
          <span class="contador__valor" data-campo="papeles">0</span>

          <!-- La racha. Cuelga del contador de papeles porque es lo que la
               produce, y hacia abajo, fuera de la calle. No multiplica nada:
               es el termómetro de que vas encadenando. -->
          <span class="racha racha--oculta" data-campo="racha">
            <span class="racha__x" data-campo="racha-valor">×0</span>
            <span class="racha__nombre" data-campo="racha-nombre"></span>
          </span>
        </div>

        <button class="boton-icono boton-icono--rojo" data-campo="pausa"
                type="button" aria-label="Pausar">
          ${Icono.pausa(22)}
        </button>
      </div>

      <!-- EL CASO. La cabecera editorial de la corrida: el lema del barrio en
           redonda y el nombre en negra, ambos en PT Serif blanca, como titula
           el Figma la pantalla de juego. Se retira cuando otra pieza manda
           (señal de salida, expediente del trámite). -->
      <div class="caso-corrida" data-campo="caso">
        <div class="caso-corrida__lema" data-campo="caso-lema"></div>
        <div class="caso-corrida__nombre" data-campo="caso-nombre"></div>
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

      <!-- Potenciadores activos. OCULTOS.
           Enseñar qué potenciador te tocó y cuánto le queda solo sirve si se
           puede hacer algo al respecto, y hoy no se puede: caen solos, duran lo
           que duran y no hay dónde elegirlos ni comprarlos. Es una fila de
           iconos que ocupa la columna izquierda para informar de algo sobre lo
           que el jugador no decide nada.
           El marcado se queda montado y el estado se sigue llevando: cuando
           haya tienda donde comprarlos, la fila vuelve quitando esta clase. -->
      <div class="efectos efectos--ocultos" data-campo="efectos"></div>

      <!-- Cartel de salida. Es señalización de autopista, y va en el HUD y no
           en la calle: un pórtico dentro del mundo se lee de refilón, en
           escorzo y a la velocidad a la que pasa. Este baja desde arriba,
           se queda mientras haya que decidir, y se sube solo. -->
      <div class="rotulo rotulo--oculto" data-campo="rotulo">
        <div class="rotulo__salida" data-campo="rotulo-salida">SALIDA</div>
        <div class="rotulo__vias" data-campo="rotulo-vias"></div>
      </div>

      <!-- ══ ZONA MEDIA ══ -->
      <div class="hud__medio">
        <div class="riel">
          <div class="riel__etiqueta">RUTA ACTUAL</div>
          <div class="riel__nombre" data-campo="nombre-escenario">BAHÍA</div>
          <div class="riel__nodos" data-campo="riel-nodos"></div>
        </div>
      </div>

      <!-- Avisos. Van CENTRADOS: a un costado se los pierde quien mira el
           carril, que es todo el mundo, todo el rato. -->
      <div class="avisos" data-campo="avisos"></div>

      <!-- ══ PIE DE FOTO ══
           LA PARTIDA ES LA FOTO DE LA PÁGINA, Y UNA FOTO LLEVA PIE.
           Aquí abajo había tres paneles flotantes —PRUEBAS, DISTANCIA y la
           rosa de deslizamiento— con su marco y su fondo cada uno. Eran
           widgets de aplicación puestos encima de una página de revista, y se
           notaba: la maqueta no tiene NADA ahí abajo.
           Lo que sí hace un diario con una imagen a toda plana es ponerle un
           pie: crédito, lugar y datos, en una línea de cuerpo pequeño. Así que
           la distancia, los intentos y las pruebas se leen como el pie de la
           foto, que es información sin ser un tablero. -->
      <div class="hud__pie">
        <span class="pie-juego__credito">Fotografía de EL MERCIO.</span>
        <span class="pie-juego__separador">·</span>
        <span class="pie-juego__dato" data-campo="distancia">0 m</span>
        <span class="intentos" data-campo="intentos"></span>
        <span class="fichas-prueba" data-campo="pruebas"></span>
      </div>

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
      racha: q('racha'),
      rachaValor: q('racha-valor'),
      rachaNombre: q('racha-nombre'),
      distancia: q('distancia'),
      intentos: q('intentos'),
      nombreEscenario: q('nombre-escenario'),
      casoLema: q('caso-lema'),
      casoNombre: q('caso-nombre'),
      rielNodos: q('riel-nodos'),
      rotulo: q('rotulo'),
      rotuloSalida: q('rotulo-salida'),
      rotuloVias: q('rotulo-vias'),
      pruebas: q('pruebas'),
      avisos: q('avisos'),
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
    this._construirRiel();
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

  /** Riel vertical de escenarios: muestra en cuál estás dentro del loop. */
  _construirRiel() {
    this.ref.rielNodos.innerHTML = '';
    this.nodosRiel = new Map();

    for (const id of ORDEN_ESCENARIOS) {
      const nodo = document.createElement('span');
      nodo.className = 'riel__nodo';
      nodo.title = obtenerEscenario(id).nombre;
      this.ref.rielNodos.appendChild(nodo);
      this.nodosRiel.set(id, nodo);
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
        this.ref.papeles.classList.remove('late');
        void this.ref.papeles.offsetWidth; // Reinicia la animación.
        this.ref.papeles.classList.add('late');
        this._sumarFlotante(datos.papeles - c.papeles);
      }
      c.papeles = datos.papeles;
    }

    // --- Racha -------------------------------------------------------------
    // Aparece a partir del primer escalón con nombre y no antes: encadenar
    // cinco papeles es lo normal sin proponérselo, y una ficha que sale sola
    // cada cuatro segundos deja de significar nada a los dos minutos.
    if (datos.combo !== c.combo) {
      const t = tramoRacha(datos.combo ?? 0);
      const luce = !!t.nombre;

      this.ref.racha.classList.toggle('racha--oculta', !luce);
      if (luce) {
        this.ref.rachaValor.textContent = `×${datos.combo}`;
        this.ref.rachaNombre.textContent = t.nombre;
        this.ref.racha.style.setProperty('--tono', `#${t.color.toString(16).padStart(6, '0')}`);
        // Un rebote por papel encadenado. Es la misma técnica que el latido del
        // contador: quitar la clase, forzar el reflujo y volver a ponerla, que
        // es la única forma de reiniciar una animación CSS ya empezada.
        this.ref.racha.classList.remove('racha--sube');
        void this.ref.racha.offsetWidth;
        this.ref.racha.classList.add('racha--sube');
      }
      c.combo = datos.combo;
    }

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
      const esc = obtenerEscenario(datos.escenario);
      this.ref.nombreEscenario.textContent = esc.nombre;

      // La cabecera editorial de la corrida: lema del barrio + nombre.
      this.ref.casoLema.textContent = esc.subtitulo ?? '';
      this.ref.casoNombre.textContent = esc.nombre;

      for (const [id, nodo] of this.nodosRiel) {
        nodo.classList.toggle('riel__nodo--activo', id === datos.escenario);
      }

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

    // --- Evidencias --------------------------------------------------------
    const nPruebas = datos.pruebas?.length ?? 0;
    if (nPruebas !== c.pruebas) {
      this._pintarEvidencias(datos.pruebas ?? []);
      c.pruebas = nPruebas;
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
      // El ×2 va en el rótulo permanente del expediente, no en un aviso que se
      // va solo: es la regla del tramo, y hay que poder consultarla en
      // cualquier momento de los trescientos cuarenta metros que dura.
      this.ref.expedienteAviso.textContent = bajoLaMitad
        ? 'VAS POR DEBAJO DE LA MITAD · VALEN ×2'
        : 'VAS SALVANDO EL EXPEDIENTE · VALEN ×2';
      this.cache.tramite = tramite.recogidos;

      // Animación de progreso: pulse visual cuando se actualiza
      this._animarProgresoExpediente();
    }

    this.ref.expedienteProgreso.style.width = `${Math.round(tramite.progreso * 100)}%`;
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
    if (activo && this.ref?.avisos) this.ref.avisos.innerHTML = '';
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
        // Pastilla grande con el icono, y debajo la batería de tramos. La
        // batería se lee de un vistazo periférico: no hay que medir un ancho,
        // se cuenta cuántas casillas quedan encendidas.
        ficha.innerHTML = `
          <span class="efecto__tarjeta">${Icono.iconoPotenciador(efecto.id, 34)}</span>
          <span class="bateria"></span>
        `;
        ficha.title = efecto.nombre;

        const bateria = ficha.querySelector('.bateria');
        for (let i = 0; i < TRAMOS_BATERIA; i++) {
          bateria.appendChild(document.createElement('span')).className = 'bateria__tramo';
        }

        this.ref.efectos.appendChild(ficha);
        this.fichasEfecto.set(efecto.id, {
          ficha,
          tramos: [...bateria.children],
          encendidos: -1,
        });
      }

      this.cache.efectos = firma;
    }

    for (const efecto of lista) {
      const ref = this.fichasEfecto?.get(efecto.id);
      if (!ref) continue;

      // Se escribe solo cuando cambia el NÚMERO de casillas encendidas, o sea
      // ocho veces en toda la duración del potenciador en vez de sesenta por
      // segundo. La fracción cruda solo decide cuándo cruza cada umbral.
      const encendidos = Math.ceil(efecto.fraccion * TRAMOS_BATERIA);
      if (encendidos === ref.encendidos) continue;

      ref.tramos.forEach((t, i) => {
        t.classList.toggle('bateria__tramo--apagado', i >= encendidos);
      });
      // Los dos últimos tramos parpadean: es el aviso de que se acaba.
      ref.ficha.classList.toggle('efecto--agotandose', encendidos <= 2);
      ref.encendidos = encendidos;
    }
  }

  _pintarEvidencias(lista) {
    // Sin pruebas no se escribe nada: el pie de foto es una línea de texto, y
    // una casilla vacía con una raya dentro era exactamente el widget que se
    // quería quitar de ahí.
    if (lista.length === 0) {
      this.ref.pruebas.innerHTML = '';
      return;
    }

    // Agrupamos por tipo de icono y contamos: cuatro fichas con badge se leen
    // mucho mejor que veinte iconos repetidos.
    const grupos = new Map();
    for (const nombre of lista) {
      const svg = Icono.iconoPrueba(nombre, 24);
      grupos.set(svg, (grupos.get(svg) ?? 0) + 1);
    }

    this.ref.pruebas.innerHTML = '';
    for (const [svg, cuenta] of grupos) {
      const ficha = document.createElement('div');
      ficha.className = 'ficha-prueba';
      ficha.innerHTML = `${svg}<span class="ficha-evidencia__cuenta">${cuenta}</span>`;
      this.ref.pruebas.appendChild(ficha);
    }
  }

  // -------------------------------------------------------------------------
  // AVISOS
  // -------------------------------------------------------------------------

  /**
   * Muestra un aviso temporal, centrado en pantalla.
   * @param {{tipo:string, titulo:string, subtitulo?:string}} datos
   */
  mostrarAviso({ tipo, titulo, subtitulo }) {
    if (!this.ref?.avisos) return;

    // Mientras el trámite o el cartel manden, ni se crea. Un «EN RACHA» encima
    // del cartel de salida no informa de nada: quita medio segundo de lectura
    // justo cuando hay que decidir por dónde salir. Y el aviso de la propia
    // bifurcación es redundante con el cartel, que dice lo mismo y mejor.
    if (this.prioridad.size) return;

    // Tope de tres: si el jugador encadena golpes no queremos una torre.
    while (this.ref.avisos.childElementCount >= 3) {
      this.ref.avisos.removeChild(this.ref.avisos.firstChild);
    }

    const iconos = {
      golpe: Icono.alerta(18),
      prueba: Icono.usb(18),
      escenario: Icono.ruta(18),
      bifurcacion: Icono.ruta(18),
      consejo: Icono.alerta(18),
      potenciador: Icono.sello(18),
      desbloqueo: Icono.sello(18),
    };

    const aviso = document.createElement('div');
    aviso.className = `aviso aviso--${tipo}`;
    aviso.innerHTML = `
      <span class="aviso__icono">${iconos[tipo] ?? Icono.alerta(18)}</span>
      <span class="aviso__texto">
        <span class="aviso__titulo"></span>
        ${subtitulo ? '<span class="aviso__subtitulo"></span>' : ''}
      </span>
    `;
    // textContent, no interpolación: los textos vienen de configuración, pero
    // no hay razón para abrir la puerta a inyección.
    aviso.querySelector('.aviso__titulo').textContent = titulo;
    if (subtitulo) aviso.querySelector('.aviso__subtitulo').textContent = subtitulo;

    this.ref.avisos.appendChild(aviso);

    setTimeout(() => {
      if (aviso.parentNode === this.ref.avisos) {
        this.ref.avisos.removeChild(aviso);
      }
    }, 2400);
  }

  /**
   * El «+3» que sale del contador y sube.
   *
   * Es la recompensa más pequeña del juego y la que más veces ocurre: unas
   * cien por partida. El contador ya subía y latía, pero eso solo dice que
   * algo cambió; el número flotante dice CUÁNTO, y sobre todo lo dice donde
   * está pasando, sin que haya que leer el marcador.
   *
   * Se destruye solo al acabar la animación. No hay pool porque no hace falta:
   * a lo sumo hay dos o tres vivos a la vez, y cada uno es un span.
   */
  _sumarFlotante(cantidad) {
    if (cantidad <= 0 || !this.ref?.papeles) return;

    const chip = document.createElement('span');
    chip.className = 'suma-flotante';
    chip.textContent = `+${cantidad}`;
    this.ref.papeles.parentNode.appendChild(chip);
    chip.addEventListener('animationend', () => chip.remove());
  }

  limpiarAvisos() {
    if (this.ref?.avisos) this.ref.avisos.innerHTML = '';
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
