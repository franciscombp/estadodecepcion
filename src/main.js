// ============================================================================
// MAIN — Punto de entrada
// ============================================================================
// Conecta las tres piezas grandes:
//   Game (lógica y render 3D) ⇄ Pantallas/HUD (interfaz DOM) ⇄ Notebook (progreso)
//
// Game no sabe nada del DOM y las pantallas no saben nada de Three.js. Se
// comunican por los callbacks que se enganchan aquí abajo. Esa separación es
// lo que permite tocar la interfaz sin miedo a romper el juego.
// ============================================================================

import './style.css';

import { Game } from './game/Game.js';
import { Notebook } from './game/Notebook.js';
import { Audio } from './utils/audio.js';
import { HUD, Avisos } from './ui/HUD.js';
import { Pantallas } from './ui/screens.js';
import { AssetCache } from './utils/assetCache.js';

// ---------------------------------------------------------------------------
// PANTALLA DE CARGA
// ---------------------------------------------------------------------------

function mostrarCarga() {
  const carga = document.createElement('div');
  carga.className = 'cargando';
  carga.innerHTML = `
    <div class="marca">EL MERCIO PRESENTA</div>
    <div class="titulo" style="font-size:clamp(1.5rem,7vw,2.4rem)">ESTADO DE EXCEPCIÓN</div>
    <div class="cargando__barra"><div class="cargando__relleno"></div></div>
    <div class="subtitulo" data-campo="estado" style="margin:0">Preparando la corrida…</div>
  `;
  document.body.appendChild(carga);

  return {
    progreso(fraccion, texto) {
      carga.querySelector('.cargando__relleno').style.width = `${Math.round(fraccion * 100)}%`;
      if (texto) carga.querySelector('[data-campo="estado"]').textContent = texto;
    },
    cerrar() {
      carga.classList.add('oculto');
      setTimeout(() => carga.remove(), 450);
    },
  };
}

// ---------------------------------------------------------------------------
// ARRANQUE
// ---------------------------------------------------------------------------

async function arrancar() {
  const carga = mostrarCarga();

  const lienzo = document.getElementById('lienzo');
  const contenedorUI = document.getElementById('ui');

  // --- Comprobación de WebGL ------------------------------------------------
  // Mejor un mensaje claro que un canvas negro sin explicación.
  const contextoPrueba = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
  if (!contextoPrueba) {
    carga.cerrar();
    contenedorUI.innerHTML = `
      <div class="pantalla"><div class="pantalla__contenido">
        <div class="marca">EL MERCIO</div>
        <h1 class="titulo">SIN WEBGL</h1>
        <p class="subtitulo">Tu navegador no puede dibujar gráficos 3D.</p>
        <div class="aviso-satira">
          Prueba con Chrome, Firefox o Safari actualizados. Si estás en un móvil
          antiguo, puede que el hardware no dé para más.
        </div>
      </div></div>
    `;
    return;
  }

  carga.progreso(0.25, 'Abriendo el cuaderno…');

  // --- Progreso persistente -------------------------------------------------
  const cuaderno = new Notebook();

  carga.progreso(0.45, 'Afinando instrumentos…');

  // --- Audio ----------------------------------------------------------------
  // El contexto se crea suspendido; arranca con el primer toque del usuario.
  const audio = new Audio();

  // --- Caché de assets ------------------------------------------------------
  // Hoy no hay binarios que precargar (todo es procedural), pero dejamos la
  // caché abierta y lista para cuando los haya.
  const cache = new AssetCache();
  await cache.abrir();

  carga.progreso(0.7, 'Levantando el escenario…');

  // --- Juego ----------------------------------------------------------------
  const juego = new Game(lienzo, cuaderno, audio);

  // --- Interfaz -------------------------------------------------------------
  const hud = new HUD(contenedorUI);
  const avisos = new Avisos(contenedorUI);
  const pantallas = new Pantallas(contenedorUI, juego, cuaderno, audio);

  carga.progreso(0.9, 'Últimos ajustes…');

  // -------------------------------------------------------------------------
  // CABLEADO: juego → interfaz
  // -------------------------------------------------------------------------

  juego.alCambiarEstado = (estado, datos) => {
    switch (estado) {
      case 'menu':
        hud.ocultar();
        avisos.limpiar();
        pantallas.mostrar(pantallas.menu());
        break;

      case 'jugando':
        pantallas.ocultar();
        hud.invalidar(); // Fuerza repintado completo tras volver de una pantalla.
        hud.mostrar();
        break;

      case 'pausa':
        pantallas.mostrar(pantallas.pausa());
        break;

      case 'bifurcacion':
        hud.ocultar();
        avisos.limpiar();
        pantallas.mostrar(pantallas.bifurcacion(datos));
        break;

      case 'ruleta':
        pantallas.mostrar(pantallas.ruleta(datos));
        break;

      case 'gameover':
        hud.ocultar();
        avisos.limpiar();
        pantallas.mostrar(pantallas.gameOver(datos));
        break;
    }
  };

  juego.alActualizarHUD = (datos) => hud.actualizar(datos);
  juego.alMostrarAviso = (datos) => avisos.mostrar(datos);

  // -------------------------------------------------------------------------
  // COMPORTAMIENTOS DEL NAVEGADOR
  // -------------------------------------------------------------------------

  // Pausa automática al cambiar de pestaña o bloquear el teléfono. Sin esto,
  // al volver el jugador se encuentra la partida perdida sin haber jugado.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && juego.estado === 'jugando') {
      juego.pausar();
    }
  });

  // El primer gesto del usuario desbloquea el audio (requisito de los
  // navegadores móviles). Se registra una sola vez.
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

  // Bloquea el menú contextual al mantener pulsado sobre el canvas.
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

  // -------------------------------------------------------------------------
  // EN MARCHA
  // -------------------------------------------------------------------------

  carga.progreso(1, 'Listo');

  // Arrancamos el bucle de render ya, para que el menú tenga la escena 3D
  // moviéndose de fondo en lugar de un rectángulo negro.
  juego.iniciarBucle();
  juego.alCambiarEstado('menu', {});

  setTimeout(() => carga.cerrar(), 320);

  // Exponemos las piezas en consola para depurar desde el navegador.
  // Es deliberado: el equipo de El Mercio puede toquetear el balance en vivo.
  if (import.meta.env?.DEV) {
    window.__juego = juego;
    window.__cuaderno = cuaderno;
    console.info('[Estado de Excepción] Modo desarrollo: usa window.__juego para depurar.');
  }
}

// ---------------------------------------------------------------------------
// SERVICE WORKER
// ---------------------------------------------------------------------------
// vite-plugin-pwa genera y registra el service worker en el build de
// producción. En desarrollo no se registra (devOptions.enabled = false).

arrancar().catch((error) => {
  console.error('[Estado de Excepción] Fallo al arrancar:', error);

  const ui = document.getElementById('ui');
  if (ui) {
    ui.innerHTML = `
      <div class="pantalla"><div class="pantalla__contenido">
        <div class="marca">EL MERCIO</div>
        <h1 class="titulo">SE CAYÓ EL SISTEMA</h1>
        <p class="subtitulo">Qué casualidad tan puntual.</p>
        <div class="botones">
          <button class="boton boton--principal" onclick="location.reload()">Reintentar</button>
        </div>
      </div></div>
    `;
  }
  document.querySelector('.cargando')?.remove();
});
