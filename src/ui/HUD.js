// ============================================================================
// HUD — Interfaz durante la partida
// ============================================================================
// Se actualiza 60 veces por segundo, así que la regla aquí es: NO tocar el DOM
// si el valor no cambió. Escribir en textContent o en style dispara recálculo
// de layout, y hacerlo en cada fotograma para siete campos se come el
// presupuesto de 16 ms en un móvil de gama media.
//
// Por eso cada campo guarda su último valor y solo escribe cuando difiere.
// ============================================================================

import { JUGADOR } from '../config/balance.js';
import { obtenerEscenario } from '../config/escenarios.js';

export class HUD {
  /** @param {HTMLElement} contenedor */
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.raiz = null;
    this.visible = false;

    // Caché de últimos valores, para evitar escrituras redundantes en el DOM.
    this.cache = {
      papeles: -1,
      distancia: -1,
      estamina: -1,
      cercania: -1,
      golpes: -1,
      combo: -1,
      escenario: null,
      exhausto: null,
      linterna: -1,
    };
  }

  /** Monta el HUD en el DOM. */
  montar() {
    if (this.raiz) return;

    this.raiz = document.createElement('div');
    this.raiz.className = 'hud';
    this.raiz.innerHTML = `
      <div class="hud__fila-superior">
        <div>
          <div class="hud__bloque">
            <div class="hud__etiqueta">Papeles</div>
            <div class="hud__valor hud__valor--papeles" data-campo="papeles">0</div>
            <div class="hud__combo" data-campo="combo"></div>
          </div>
          <div class="hud__intentos" data-campo="intentos"></div>
        </div>

        <div>
          <div class="hud__bloque">
            <div class="hud__etiqueta">Metros</div>
            <div class="hud__valor hud__valor--distancia" data-campo="distancia">0</div>
          </div>
          <div class="hud__escenario" data-campo="escenario"></div>
        </div>
      </div>

      <div class="hud__barras">
        <div class="barra" data-barra="estamina">
          <div class="barra__cabecera">
            <span data-campo="nombre-estamina">Estamina</span>
            <span data-campo="pct-estamina">100%</span>
          </div>
          <div class="barra__canal">
            <div class="barra__relleno barra__relleno--estamina" data-campo="rel-estamina"></div>
          </div>
        </div>

        <div class="barra" data-barra="linterna" style="display:none">
          <div class="barra__cabecera">
            <span>Linterna</span>
            <span data-campo="pct-linterna">0%</span>
          </div>
          <div class="barra__canal">
            <div class="barra__relleno barra__relleno--linterna" data-campo="rel-linterna"></div>
          </div>
        </div>

        <div class="barra" data-barra="perseguidor">
          <div class="barra__cabecera">
            <span>Te siguen</span>
            <span data-campo="pct-perseguidor">0%</span>
          </div>
          <div class="barra__canal">
            <div class="barra__relleno barra__relleno--perseguidor" data-campo="rel-perseguidor"></div>
          </div>
        </div>
      </div>
    `;

    this.contenedor.appendChild(this.raiz);

    // Guardamos referencias una sola vez: querySelector en cada fotograma
    // sería otro coste innecesario.
    this.ref = {
      papeles: this.raiz.querySelector('[data-campo="papeles"]'),
      distancia: this.raiz.querySelector('[data-campo="distancia"]'),
      combo: this.raiz.querySelector('[data-campo="combo"]'),
      intentos: this.raiz.querySelector('[data-campo="intentos"]'),
      escenario: this.raiz.querySelector('[data-campo="escenario"]'),
      nombreEstamina: this.raiz.querySelector('[data-campo="nombre-estamina"]'),
      pctEstamina: this.raiz.querySelector('[data-campo="pct-estamina"]'),
      relEstamina: this.raiz.querySelector('[data-campo="rel-estamina"]'),
      barraEstamina: this.raiz.querySelector('[data-barra="estamina"]'),
      barraLinterna: this.raiz.querySelector('[data-barra="linterna"]'),
      pctLinterna: this.raiz.querySelector('[data-campo="pct-linterna"]'),
      relLinterna: this.raiz.querySelector('[data-campo="rel-linterna"]'),
      pctPerseguidor: this.raiz.querySelector('[data-campo="pct-perseguidor"]'),
      relPerseguidor: this.raiz.querySelector('[data-campo="rel-perseguidor"]'),
      barraPerseguidor: this.raiz.querySelector('[data-barra="perseguidor"]'),
    };

    this._construirIntentos();
  }

  _construirIntentos() {
    this.ref.intentos.innerHTML = '';
    this.puntosIntento = [];
    for (let i = 0; i < JUGADOR.GOLPES_MAXIMOS; i++) {
      const punto = document.createElement('div');
      punto.className = 'intento';
      this.ref.intentos.appendChild(punto);
      this.puntosIntento.push(punto);
    }
  }

  mostrar() {
    this.montar();
    this.raiz.style.display = 'flex';
    this.visible = true;
  }

  ocultar() {
    if (this.raiz) this.raiz.style.display = 'none';
    this.visible = false;
  }

  /**
   * Actualiza el HUD con el estado del juego.
   * @param {object} datos Lo que emite Game.alActualizarHUD
   */
  actualizar(datos) {
    if (!this.visible || !this.ref) return;
    const c = this.cache;

    // --- Papeles -----------------------------------------------------------
    if (datos.papeles !== c.papeles) {
      this.ref.papeles.textContent = datos.papeles.toLocaleString('es-EC');
      c.papeles = datos.papeles;
    }

    // --- Distancia ---------------------------------------------------------
    if (datos.distancia !== c.distancia) {
      this.ref.distancia.textContent = datos.distancia.toLocaleString('es-EC');
      c.distancia = datos.distancia;
    }

    // --- Combo -------------------------------------------------------------
    if (datos.combo !== c.combo) {
      if (datos.combo >= 3) {
        this.ref.combo.textContent = `×${datos.combo} racha`;
        this.ref.combo.classList.add('activo');
      } else {
        this.ref.combo.classList.remove('activo');
      }
      c.combo = datos.combo;
    }

    // --- Intentos restantes ------------------------------------------------
    if (datos.golpesRestantes !== c.golpes) {
      this.puntosIntento.forEach((punto, i) => {
        punto.classList.toggle('gastado', i >= datos.golpesRestantes);
      });
      c.golpes = datos.golpesRestantes;
    }

    // --- Escenario ---------------------------------------------------------
    if (datos.escenario !== c.escenario) {
      this.ref.escenario.textContent = obtenerEscenario(datos.escenario).nombre;
      this.ref.nombreEstamina.textContent = datos.nombreEstamina;
      // La barra de linterna solo existe en el Apagón.
      this.ref.barraLinterna.style.display = datos.escenario === 'apagon' ? 'block' : 'none';
      c.escenario = datos.escenario;
    }

    // --- Estamina ----------------------------------------------------------
    // Redondeamos al 1% para no reescribir el DOM por cambios imperceptibles.
    const pctEstamina = Math.round(datos.estamina * 100);
    if (pctEstamina !== c.estamina) {
      this.ref.relEstamina.style.width = `${pctEstamina}%`;
      this.ref.pctEstamina.textContent = `${pctEstamina}%`;
      c.estamina = pctEstamina;
    }
    if (datos.exhausto !== c.exhausto) {
      this.ref.relEstamina.classList.toggle('bajo', datos.exhausto);
      this.ref.barraEstamina.classList.toggle('peligro', datos.exhausto);
      c.exhausto = datos.exhausto;
    }

    // --- Linterna (solo Apagón) -------------------------------------------
    if (datos.linterna !== null && datos.linterna !== undefined) {
      const pctLinterna = Math.round(datos.linterna * 100);
      if (pctLinterna !== c.linterna) {
        this.ref.relLinterna.style.width = `${pctLinterna}%`;
        this.ref.pctLinterna.textContent = `${pctLinterna}%`;
        c.linterna = pctLinterna;
      }
    }

    // --- Perseguidor -------------------------------------------------------
    const pctCercania = Math.round(datos.cercania * 100);
    if (pctCercania !== c.cercania) {
      this.ref.relPerseguidor.style.width = `${pctCercania}%`;
      this.ref.pctPerseguidor.textContent = `${pctCercania}%`;
      // Por encima del 70% empieza a parpadear: es la última advertencia.
      this.ref.barraPerseguidor.classList.toggle('peligro', pctCercania > 70);
      c.cercania = pctCercania;
    }
  }

  /** Reinicia la caché para forzar un repintado completo. */
  invalidar() {
    this.cache = {
      papeles: -1, distancia: -1, estamina: -1, cercania: -1,
      golpes: -1, combo: -1, escenario: null, exhausto: null, linterna: -1,
    };
  }
}

// ---------------------------------------------------------------------------
// AVISOS FLOTANTES
// ---------------------------------------------------------------------------

export class Avisos {
  constructor(contenedor) {
    this.raiz = document.createElement('div');
    this.raiz.className = 'avisos';
    contenedor.appendChild(this.raiz);

    // Evita que se apilen decenas de avisos si el jugador encadena golpes.
    this.maximoSimultaneos = 3;
  }

  /**
   * @param {{tipo:string, titulo:string, subtitulo?:string}} datos
   */
  mostrar({ tipo, titulo, subtitulo }) {
    while (this.raiz.childElementCount >= this.maximoSimultaneos) {
      this.raiz.removeChild(this.raiz.firstChild);
    }

    const aviso = document.createElement('div');
    aviso.className = `aviso aviso--${tipo}`;
    aviso.innerHTML = `
      <div class="aviso__titulo"></div>
      ${subtitulo ? '<div class="aviso__subtitulo"></div>' : ''}
    `;
    // textContent en vez de interpolar en el HTML: los textos vienen de
    // configuración, pero no hay razón para abrir la puerta a inyección.
    aviso.querySelector('.aviso__titulo').textContent = titulo;
    if (subtitulo) aviso.querySelector('.aviso__subtitulo').textContent = subtitulo;

    this.raiz.appendChild(aviso);

    // La animación CSS lo desvanece; aquí solo lo quitamos del árbol.
    setTimeout(() => {
      if (aviso.parentNode === this.raiz) this.raiz.removeChild(aviso);
    }, 2000);
  }

  limpiar() {
    this.raiz.innerHTML = '';
  }
}
