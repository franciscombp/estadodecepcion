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
//   │ │EVIDENCIA│ │ DISTANCIA│   │ DESLIZA │  │  resumen y ayuda
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
      evidencias: -1,
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
      <!-- ══ FILA SUPERIOR ══ -->
      <div class="hud__superior">
        <button class="boton-icono boton-icono--rojo" data-campo="pausa"
                type="button" aria-label="Pausar">
          ${Icono.pausa(22)}
        </button>

        <div class="contador contador--dorado">
          <span class="contador__valor" data-campo="papeles">0</span>
          <span class="contador__icono">${Icono.papeles(26)}</span>
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

      <!-- Potenciadores activos. Van bajo la fila superior y a la izquierda,
           donde ya está el riel: es la columna de "en qué estado estás". -->
      <div class="efectos" data-campo="efectos"></div>

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

      <!-- ══ FILA INFERIOR ══ -->
      <div class="hud__inferior">
        <div class="panel panel--evidencia">
          <div class="panel__titulo">EVIDENCIA</div>
          <div class="fichas-evidencia" data-campo="evidencias">
            <div class="ficha-evidencia ficha-evidencia--vacia">—</div>
          </div>
        </div>

        <div class="panel panel--distancia">
          <div class="panel__titulo">DISTANCIA</div>
          <div class="panel__valor" data-campo="distancia">0 m</div>
          <div class="intentos" data-campo="intentos"></div>
        </div>

        <div class="panel panel--hint" data-campo="hint">
          <div class="panel__titulo">DESLIZA</div>
          <div class="rosa-swipe">
            <span class="rosa-swipe__arriba">${Icono.flecha('arriba', 20)}</span>
            <span class="rosa-swipe__izq">${Icono.flecha('izquierda', 20)}</span>
            <span class="rosa-swipe__mano">${Icono.mano(24)}</span>
            <span class="rosa-swipe__der">${Icono.flecha('derecha', 20)}</span>
            <span class="rosa-swipe__abajo">${Icono.flecha('abajo', 20)}</span>
          </div>
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
      intentos: q('intentos'),
      nombreEscenario: q('nombre-escenario'),
      rielNodos: q('riel-nodos'),
      rotulo: q('rotulo'),
      rotuloSalida: q('rotulo-salida'),
      rotuloVias: q('rotulo-vias'),
      evidencias: q('evidencias'),
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
    if (this.ref?.hint) this.ref.hint.classList.add('panel--oculto');
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
      }
      c.papeles = datos.papeles;
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
    const nEvidencias = datos.evidencias?.length ?? 0;
    if (nEvidencias !== c.evidencias) {
      this._pintarEvidencias(datos.evidencias ?? []);
      c.evidencias = nEvidencias;
    }
  }

  /**
   * Marcador del expediente. Se dibuja solo dentro del trámite; el resto del
   * tiempo el panel ni existe en pantalla.
   */
  _actualizarExpediente(tramite) {
    if (!tramite) {
      if (this.cache.tramite !== -1) {
        this.ref.expediente.classList.add('expediente--oculto');
        this.cache.tramite = -1;
      }
      return;
    }

    if (this.cache.tramite === -1) {
      this.ref.expediente.classList.remove('expediente--oculto');
      this.ref.expedienteInstitucion.textContent = tramite.institucion;
      this.ref.expedienteTotal.textContent = String(tramite.total);
    }

    if (tramite.recogidos !== this.cache.tramite) {
      this.ref.expedienteRecogidos.textContent = String(tramite.recogidos);
      // En cuanto se escapa el primer papel, el expediente ya está perdido.
      // Decirlo de inmediato es más honesto que dejar que el jugador siga
      // creyendo que va bien hasta el recuento final.
      // En cuanto se te queda uno atrás, el expediente ya está incompleto.
      // Decirlo de inmediato es más honesto que dejar creer que va bien hasta
      // el recuento final.
      const perdido = tramite.recogidos < Math.round(tramite.progreso * tramite.total) - 2;
      this.ref.expediente.classList.toggle('expediente--perdido', perdido);
      this.ref.expedienteAviso.textContent = perdido
        ? 'YA SE TE QUEDARON ATRÁS'
        : 'RECUPERA LOS QUE PUEDAS';
      this.cache.tramite = tramite.recogidos;
    }

    this.ref.expedienteProgreso.style.width = `${Math.round(tramite.progreso * 100)}%`;
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
    if (lista.length === 0) {
      this.ref.evidencias.innerHTML =
        '<div class="ficha-evidencia ficha-evidencia--vacia">—</div>';
      return;
    }

    // Agrupamos por tipo de icono y contamos: cuatro fichas con badge se leen
    // mucho mejor que veinte iconos repetidos.
    const grupos = new Map();
    for (const nombre of lista) {
      const svg = Icono.iconoEvidencia(nombre, 24);
      grupos.set(svg, (grupos.get(svg) ?? 0) + 1);
    }

    this.ref.evidencias.innerHTML = '';
    for (const [svg, cuenta] of grupos) {
      const ficha = document.createElement('div');
      ficha.className = 'ficha-evidencia';
      ficha.innerHTML = `${svg}<span class="ficha-evidencia__cuenta">${cuenta}</span>`;
      this.ref.evidencias.appendChild(ficha);
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

    // Tope de tres: si el jugador encadena golpes no queremos una torre.
    while (this.ref.avisos.childElementCount >= 3) {
      this.ref.avisos.removeChild(this.ref.avisos.firstChild);
    }

    const iconos = {
      golpe: Icono.alerta(18),
      evidencia: Icono.usb(18),
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
      { clave: 'izquierda', flecha: '←', nombre: destinos.izquierda },
      { clave: 'centro', flecha: '↑', nombre: destinos.centro, peligro: centroEsPeligro },
      { clave: 'derecha', flecha: '→', nombre: destinos.derecha },
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
    // Dos fotogramas de margen: aplicar la clase en el mismo tick en que se
    // rellena el contenido se salta la transición y el cartel aparece de golpe.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.ref?.rotulo.classList.remove('rotulo--oculto'));
    });
  }

  /** Lo sube otra vez. La transición la lleva el CSS. */
  ocultarRotulo() {
    this.ref?.rotulo?.classList.add('rotulo--oculto');
  }
}
