// ============================================================================
// MAIN — Punto de entrada
// ============================================================================
// Conecta las tres piezas grandes:
//   Game (lógica y render 3D) ⇄ HUD/Pantallas (interfaz DOM) ⇄ Notebook (progreso)
//
// Game no sabe nada del DOM y las pantallas no saben nada de Three.js. Se
// hablan por los callbacks que se enganchan aquí abajo. Esa separación es lo
// que permite rehacer toda la interfaz sin tocar la lógica de juego —que es
// exactamente lo que se hizo al subir el nivel visual.
// ============================================================================

import './style.css';

import { Game } from './game/Game.js';
import { Notebook } from './game/Notebook.js';
import { Audio } from './utils/audio.js';
import { HUD } from './ui/HUD.js';
import { Pantallas } from './ui/screens.js';
import { AssetCache } from './utils/assetCache.js';
import { detectarCalidad } from './utils/calidad.js';
import { Actualizador } from './utils/actualizacion.js';
import { PAGINAS } from './config/publicaciones.js';
import { CATALOGO_POTENCIADORES } from './config/balance.js';
import * as Icono from './ui/iconos.js';

// ---------------------------------------------------------------------------
// PANTALLA DE CARGA
// ---------------------------------------------------------------------------

function mostrarCarga() {
  const carga = document.createElement('div');
  carga.className = 'cargando';
  carga.innerHTML = `
    <div class="marca">
      <span class="marca__sello">${Icono.sello(40)}</span>
      EL MERCIO PRESENTA
    </div>
    <div class="titulo" style="font-size:clamp(1.5rem,7vw,2.4rem);margin:0">
      ESTADO DE EXCEPCIÓN
    </div>
    <div class="cargando__barra"><div class="cargando__relleno"></div></div>
    <div class="subtitulo" data-campo="estado" style="margin:0">
      Preparando la corrida…
    </div>
  `;
  document.body.appendChild(carga);

  return {
    progreso(fraccion, texto) {
      carga.querySelector('.cargando__relleno').style.width =
        `${Math.round(fraccion * 100)}%`;
      if (texto) carga.querySelector('[data-campo="estado"]').textContent = texto;
    },
    cerrar() {
      carga.classList.add('cargando--fuera');
      setTimeout(() => carga.remove(), 380);
    },
  };
}

/** Pantalla de error a pantalla completa, con la voz de la casa. */
function pantallaError(titulo, mensaje, reintentar = true) {
  const ui = document.getElementById('ui');
  if (!ui) return;
  ui.innerHTML = `
    <div class="pantalla"><div class="pantalla__contenido">
      <div class="marca">
        <span class="marca__sello">${Icono.sello(40)}</span>
        EL MERCIO
      </div>
      <h1 class="titulo titulo--rojo">${titulo}</h1>
      <p class="subtitulo">${mensaje}</p>
      ${reintentar ? `
        <div class="botones">
          <button class="boton boton--principal" data-accion="recargar">
            Reintentar
          </button>
        </div>` : ''}
    </div></div>
  `;
  ui.querySelector('[data-accion="recargar"]')
    ?.addEventListener('click', () => location.reload());
}

// ---------------------------------------------------------------------------
// ARRANQUE
// ---------------------------------------------------------------------------

async function arrancar() {
  // Señal para la red de seguridad de index.html: si esto no se ejecuta en
  // 8 segundos, el HTML pinta una pantalla explicando qué falló en vez de
  // dejar la página en blanco.
  window.__arranco = true;

  const carga = mostrarCarga();

  const lienzo = document.getElementById('lienzo');
  const contenedorUI = document.getElementById('ui');

  // --- Comprobación de WebGL ------------------------------------------------
  // Mejor un mensaje claro que un canvas negro sin explicación.
  const prueba = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
  if (!prueba) {
    carga.cerrar();
    pantallaError(
      'SIN WEBGL',
      'Tu navegador no puede dibujar gráficos 3D. Prueba con Chrome, Firefox o Safari actualizados.',
      false,
    );
    return;
  }

  carga.progreso(0.2, 'Abriendo el cuaderno…');
  const cuaderno = new Notebook();

  carga.progreso(0.4, 'Midiendo el equipo…');
  // Detectamos de qué es capaz el dispositivo ANTES de montar la escena:
  // el nivel decide si hay bloom, cuánto decorado y a qué resolución se pinta.
  const calidad = detectarCalidad();

  carga.progreso(0.55, 'Afinando instrumentos…');
  // El contexto de audio se crea suspendido; arranca con el primer toque.
  const audio = new Audio();

  // Caché lista para cuando haya binarios que precargar. Hoy todo es
  // procedural, así que no hay nada que bajar.
  const cache = new AssetCache();
  await cache.abrir();

  carga.progreso(0.75, 'Levantando el escenario…');
  const juego = new Game(lienzo, cuaderno, audio, calidad);

  carga.progreso(0.9, 'Últimos ajustes…');
  const hud = new HUD(contenedorUI);

  // El actualizador se crea ANTES que las pantallas porque el menú pinta su
  // estado: qué edición corre, si el juego ya está guardado para jugar sin
  // conexión y si hay una nueva esperando.
  const actualizador = new Actualizador();

  const pantallas = new Pantallas(contenedorUI, juego, cuaderno, audio, actualizador);

  hud.alPulsarPausa(() => juego.pausar());

  // -------------------------------------------------------------------------
  // ACTUALIZACIONES
  // -------------------------------------------------------------------------
  // La edición nueva entra entera, pero nunca en mitad de una corrida: se
  // guarda el aviso y se aplica al volver al menú o al terminar la partida.
  // Ver utils/actualizacion.js.

  actualizador.alDetectar = () => {
    if (aplicarSiEsSeguro()) return;
    if (juego.estado === 'menu') return;  // El panel del menú ya lo anuncia.
    hud.mostrarAviso({
      tipo: 'consejo',
      titulo: 'EDICIÓN NUEVA',
      subtitulo: 'Entra al terminar esta corrida',
    });
  };

  /**
   * Dónde se aplica sola una edición nueva y dónde no.
   *
   * SOLO al terminar una partida. Ahí el jugador ya iba a reiniciar, así que
   * la recarga no le cuesta nada y de paso se ahorra el paso manual.
   *
   * En el MENÚ deliberadamente no. Antes sí, y tenía dos problemas: abrir el
   * juego con una edición pendiente provocaba una recarga sorpresa a los dos
   * segundos, y el botón de instalar del panel de versión era inalcanzable
   * —se aplicaba solo antes de que nadie pudiera tocarlo—. En el menú manda el
   * jugador; el panel se enciende y él decide cuándo.
   */
  function aplicarSiEsSeguro() {
    if (!actualizador.hayNueva) return false;
    if (juego.estado !== 'gameover' && juego.estado !== 'victoria') return false;
    return actualizador.aplicar();
  }

  actualizador.iniciar();  // Sin await: el juego no espera al service worker.

  // El hint de deslizar solo se enseña las tres primeras partidas.
  if (cuaderno.partidasJugadas >= 3) hud.ocultarHint();

  // -------------------------------------------------------------------------
  // CABLEADO: juego → interfaz
  // -------------------------------------------------------------------------

  juego.alCambiarEstado = (estado, datos) => {
    // Momento seguro para recargar con la versión nueva: se acabó la partida
    // y el jugador ya iba a reiniciar. Ver aplicarSiEsSeguro().
    if (estado === 'gameover' || estado === 'victoria') {
      if (aplicarSiEsSeguro()) return;
    }

    switch (estado) {
      case 'menu':
        hud.ocultar();
        hud.limpiarAvisos();
        pantallas.mostrar(pantallas.menu());
        break;

      case 'intro':
        // La cinemática se ve sin nada encima: solo el aviso de que se puede
        // saltar. Cuatro segundos repetidos treinta veces son dos minutos
        // mirando lo mismo, y eso hay que poder cortarlo.
        pantallas.ocultar();
        hud.ocultar();
        mostrarSaltoIntro(true);
        break;

      case 'jugando':
        pantallas.ocultar();
        mostrarSaltoIntro(false);
        hud.invalidar(); // Repintado completo al volver de una pantalla.
        hud.mostrar();
        break;

      case 'pausa':
        pantallas.mostrar(pantallas.pausa());
        break;

      case 'cerco':
        // El cerco no tiene interfaz: es la animación de que te rodean. Se
        // quita cualquier pantalla y se deja ver.
        pantallas.ocultar();
        hud.limpiarAvisos();
        break;

      case 'relato':
        // El HUD se queda oculto: en este hueco no hay nada que medir.
        hud.ocultar();
        hud.limpiarAvisos();
        pantallas.mostrar(pantallas.relato(datos));
        break;

      case 'escape':
        hud.ocultar();
        pantallas.mostrar(pantallas.escape(datos));
        break;

      case 'victoria':
        hud.ocultar();
        hud.limpiarAvisos();
        pantallas.mostrar(pantallas.victoria(datos));
        break;

      case 'gameover':
        hud.ocultar();
        hud.limpiarAvisos();
        if (cuaderno.partidasJugadas >= 3) hud.ocultarHint();
        pantallas.mostrar(pantallas.gameOver(datos));
        break;
    }
  };

  juego.alActualizarHUD = (datos) => hud.actualizar(datos);
  juego.alMostrarAviso = (datos) => hud.mostrarAviso(datos);
  juego.alSeñalizar = (destinos, peligro) => hud.mostrarRotulo(destinos, peligro);
  juego.alQuitarSenal = () => hud.ocultarRotulo();

  // -------------------------------------------------------------------------
  // CINEMÁTICA: SALTARLA
  // -------------------------------------------------------------------------
  // Cualquier toque o tecla la corta. No pasa por Controles porque ese módulo
  // está desactivado durante la intro —y tiene que estarlo: un swipe ahí no
  // debe cambiar de carril, solo empezar de una vez.

  const pistaSalto = document.createElement('div');
  pistaSalto.className = 'salto-intro';
  pistaSalto.textContent = 'TOCA PARA EMPEZAR';
  contenedorUI.appendChild(pistaSalto);

  function mostrarSaltoIntro(visible) {
    pistaSalto.classList.toggle('salto-intro--visible', visible);
  }

  const saltarIntro = () => {
    if (juego.estado === 'intro') juego.arrancarCorrida();
  };
  window.addEventListener('pointerdown', saltarIntro);
  window.addEventListener('keydown', saltarIntro);

  // -------------------------------------------------------------------------
  // COMPORTAMIENTOS DEL NAVEGADOR
  // -------------------------------------------------------------------------

  // Pausa automática al cambiar de pestaña o bloquear el teléfono. Sin esto,
  // al volver el jugador se encuentra la partida perdida sin haber jugado.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && juego.estado === 'jugando') juego.pausar();
  });

  // El primer gesto desbloquea el audio (requisito de los navegadores
  // móviles). Se registra una sola vez.
  const desbloquearAudio = () => {
    audio.iniciar();
    audio.reanudar();
  };
  window.addEventListener('pointerdown', desbloquearAudio, { once: true });
  window.addEventListener('keydown', desbloquearAudio, { once: true });

  // Evita el zoom por doble toque en iOS, que arruina los swipes rápidos.
  let ultimoToque = 0;
  document.addEventListener('touchend', (evento) => {
    const ahora = Date.now();
    if (ahora - ultimoToque < 320) evento.preventDefault();
    ultimoToque = ahora;
  }, { passive: false });

  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

  // -------------------------------------------------------------------------
  // EN MARCHA
  // -------------------------------------------------------------------------

  carga.progreso(1, 'Listo');

  // Arrancamos el bucle ya, para que el menú tenga la escena 3D moviéndose
  // de fondo en lugar de un rectángulo negro.
  juego.iniciarBucle();
  juego.alCambiarEstado('menu', {});

  setTimeout(() => carga.cerrar(), 300);

  // Piezas expuestas en consola para depurar desde el navegador. Es
  // deliberado: el equipo de El Mercio puede tocar el balance en vivo.
  if (import.meta.env?.DEV) {
    window.__juego = juego;
    window.__cuaderno = cuaderno;
    window.__hud = hud;
    // Las páginas del periódico, para poder probar un titular en caliente
    // antes de escribirlo en config/publicaciones.js. Por ejemplo:
    //   Object.assign(__paginas[0].articulos[0],
    //     { pendiente:false, titular:'…', bajada:'…', url:'…' })
    window.__paginas = PAGINAS;
    window.__cat = CATALOGO_POTENCIADORES;
    console.info(
      `[Estado de Excepción] Modo desarrollo. Calidad detectada: ${calidad.nivel}. ` +
      'Usa window.__juego para depurar.',
    );
  }
}

// ---------------------------------------------------------------------------
// SERVICE WORKER
// ---------------------------------------------------------------------------
// vite-plugin-pwa genera y registra el service worker en el build de
// producción. En desarrollo no se registra.

arrancar().catch((error) => {
  console.error('[Estado de Excepción] Fallo al arrancar:', error);
  document.querySelector('.cargando')?.remove();
  pantallaError('SE CAYÓ EL SISTEMA', 'Qué casualidad tan puntual.');
});
