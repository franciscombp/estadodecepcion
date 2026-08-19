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
import { cargarHitos } from './models/hitos.js';
import { cargarPersonajesGLB } from './models/personajeGLB.js';
import { detectarCalidad } from './utils/calidad.js';
import { afinarBisel, tamanoCache, segmentosBisel } from './utils/geometria.js';
import { afinarAcabado, acabadoActual } from './utils/materiales.js';
import { Actualizador } from './utils/actualizacion.js';
import { PAGINAS } from './config/publicaciones.js';
import { cargarGuion } from './config/guion.js';
import { comprobarVersionOficial } from './config/versionOficial.js';
import { ESCENARIOS } from './config/escenarios.js';
import { CATALOGO_POTENCIADORES, RACHA, tramoRacha } from './config/balance.js';
import * as Icono from './ui/iconos.js';

// ---------------------------------------------------------------------------
// PANTALLA DE CARGA
// ---------------------------------------------------------------------------

function mostrarCarga() {
  const carga = document.createElement('div');
  carga.className = 'cargando';
  carga.innerHTML = `
    <div class="cargando__marca">EL MERCIO<span class="cargando__punto">.</span></div>
    <div class="cargando__titulo">Estado de excepción</div>
    <div class="cargando__barra"><div class="cargando__relleno"></div></div>
    <div class="cargando__estado" data-campo="estado">Preparando la corrida…</div>
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
  //
  // EN UN LIENZO DE USAR Y TIRAR, NO EN EL DEL JUEGO. Esto probaba sobre
  // `lienzo`, y un canvas SOLO TIENE UN CONTEXTO: el primer `getContext` fija
  // sus atributos y todas las llamadas posteriores devuelven ese mismo,
  // ignorando en silencio lo que se les pida. O sea que el contexto con el que
  // el juego lleva corriendo desde siempre es este de aquí —el de la prueba,
  // con todo por defecto— y los atributos que pide `WebGLRenderer` unas líneas
  // más abajo (`antialias`, `powerPreference: 'high-performance'`) nunca han
  // llegado a aplicarse. Se descubrió al intentar activar
  // `preserveDrawingBuffer` para poder fotografiar la pantalla y ver que salía
  // en `false` por mucho que se pidiera.
  //
  // Con un canvas suelto, la prueba comprueba lo que tiene que comprobar —si
  // este navegador sabe hacer WebGL— y deja el lienzo de verdad intacto para
  // que lo estrene el renderizador con sus opciones.
  const canvasPrueba = document.createElement('canvas');
  const prueba = canvasPrueba.getContext('webgl2') || canvasPrueba.getContext('webgl');
  if (!prueba) {
    carga.cerrar();
    pantallaError(
      'SIN WEBGL',
      'Tu navegador no puede dibujar gráficos 3D. Prueba con Chrome, Firefox o Safari actualizados.',
      false,
    );
    return;
  }

  // Se suelta en cuanto ha dicho que sí: los contextos WebGL vivos están
  // limitados (unos dieciséis por pestaña) y este ya no hace falta.
  prueba.getExtension('WEBGL_lose_context')?.loseContext();

  carga.progreso(0.2, 'Abriendo el cuaderno…');
  const cuaderno = new Notebook();

  carga.progreso(0.4, 'Midiendo el equipo…');
  // Detectamos de qué es capaz el dispositivo ANTES de montar la escena:
  // el nivel decide si hay bloom, cuánto decorado y a qué resolución se pinta.
  const calidad = detectarCalidad();

  // EL BISEL SE DECIDE AQUÍ Y SOLO AQUÍ.
  //
  // Las geometrías del mundo se construyen una vez y se comparten entre miles
  // de mallas, así que el detalle de los cantos tiene que quedar fijado ANTES
  // de que nadie pida una caja. Después ya no: cambiarlo con la escena montada
  // no rehace lo que existe, solo hace que las piezas nuevas no casen con las
  // viejas.
  //
  // En calidad baja se queda en cero, que devuelve la caja de siempre. Un
  // teléfono que va justo no tiene por qué pagar diez veces los triángulos por
  // un brillo en la arista.
  afinarBisel(calidad.nivel);

  carga.progreso(0.55, 'Afinando instrumentos…');
  // El contexto de audio se crea suspendido; arranca con el primer toque.
  const audio = new Audio();

  // Caché lista para cuando haya binarios que precargar. Hoy todo es
  // procedural, así que no hay nada que bajar.
  const cache = new AssetCache();
  await cache.abrir();

  // EL GUION, ANTES QUE NADA QUE PINTE TEXTO.
  //
  // Trae `public/contenido/guion.json` —lo que baja el editor de pantallas— y
  // lo que haya guardado el editor en este navegador para probar en vivo. Si
  // no hay ninguno de los dos, se sigue con el guion escrito en
  // `config/guion.js`, que es el caso normal. Va antes de construir el juego
  // porque la pantalla de carga ya es la primera que dice cosas.
  await cargarGuion(import.meta.env.BASE_URL ?? '/');

  // Que ninguna prueba plantada se quede sin su titular en la sección de «lo
  // que dice el gobierno». Un desajuste de nombres no rompe nada —la pieza
  // simplemente no aparece— y por eso hace falta avisar: un fallo silencioso
  // en una tabla de nombres se descubre meses después, cuando alguien se
  // pregunta por qué esa pieza nunca sale publicada.
  comprobarVersionOficial(ESCENARIOS);

  // Los edificios reconocibles de la ciudad. Se esperan AQUÍ, con la pantalla
  // de carga puesta, porque las escenas los clonan al construirse: llegando
  // tarde, la primera partida saldría sin ellos. Si falla, se sigue sin hitos.
  carga.progreso(0.68, 'Levantando la ciudad…');
  await cargarHitos(import.meta.env.BASE_URL ?? '/');

  // Los dos protagonistas vienen de un archivo, con su esqueleto y su ciclo de
  // carrera. También se esperan aquí: el menú ya enseña al periodista haciendo
  // la entrevista, así que llegar tarde significa que la portada sale con el
  // muñeco de repuesto y se cambia solo a los dos segundos.
  carga.progreso(0.72, 'Llamando a la redacción…');
  await cargarPersonajesGLB(import.meta.env.BASE_URL ?? '/');

  carga.progreso(0.75, 'Levantando el escenario…');
  const juego = new Game(lienzo, cuaderno, audio, calidad);

  // Los programas de shader, compilados AQUÍ y no en el primer fotograma. Son
  // unos cientos de milisegundos que, sin esto, se pagaban jugando.
  carga.progreso(0.85, 'Encendiendo las luces…');
  juego.precalentar();

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

    // Aquí solo se llega estando ya jugando, y ya no hay dónde decirlo: los
    // avisos flotantes se fueron con el HUD nuevo. No se pierde nada, porque
    // la edición entra sola al terminar la corrida —recargar en mitad de una
    // partida se la borra al jugador por un motivo que no tiene nada que ver
    // con el juego— y el panel de Ajustes lo cuenta con todas las letras.
  };

  /**
   * Dónde entra sola una edición nueva y dónde no.
   *
   *   · ABRIENDO EL JUEGO, siempre y al instante. Es el caso que importa: la
   *     edición nueva se descargó en una sesión anterior y estaba esperando, y
   *     lo que el jugador espera al abrir es tener la última. Como la pantalla
   *     de carga sigue delante, la recarga no interrumpe nada y la versión
   *     vieja no llega a verse.
   *
   *     Antes esto tardaba CINCO SEGUNDOS y se hacía con el menú ya puesto: se
   *     avisaba, se contaba hasta cinco y se recargaba encima del jugador. Eso
   *     es justo lo contrario de inmediato, y además enseñaba la edición vieja.
   *
   *   · AL TERMINAR UNA PARTIDA, porque el jugador ya iba a reiniciar y la
   *     recarga no le cuesta nada.
   *
   *   · EN MITAD DE UNA CORRIDA, nunca.
   *
   *   · EN EL MENÚ, si aparece una edición mientras el jugador está ahí
   *     parado, tampoco: manda él. El panel de versión se enciende y decide
   *     cuándo. Si se aplicara sola, ese botón sería inalcanzable —se
   *     instalaría antes de que nadie llegara a tocarlo—.
   */
  function aplicarSiEsSeguro() {
    if (!actualizador.hayNueva) return false;
    const momentoSeguro = actualizador.arrancando
      || juego.estado === 'gameover'
      || juego.estado === 'victoria';
    if (!momentoSeguro) return false;
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
  juego.alCerrarExpediente = (resumen) => hud.cerrarExpediente(resumen);
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
  // El texto puede ser ambiguo: "TOCA" implica que necesitas tocarlo. En realidad
  // la cinemática avanza sola, pero puedes saltarla tocando. Cambiar a algo más claro.
  pistaSalto.textContent = 'O TOCA PARA SALTARLA';
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

  // Se acabó la ventana de arranque: el menú ya está puesto y es del jugador.
  // A partir de aquí una edición nueva deja de entrar sola y pasa a esperar
  // —al final de la corrida, o a que la instale desde el panel de versión—.
  //
  // El margen va POR ENCIMA del cierre de la pantalla de carga a propósito. La
  // comprobación sale con el registro del service worker, y entre pedirla y
  // que el worker nuevo termine de instalarse hay una descarga por medio;
  // cerrando la ventana en el mismo instante en que aparece el menú, una
  // respuesta que llegue doscientos milisegundos tarde se quedaría esperando a
  // la siguiente partida, que es justo lo que se venía a arreglar.
  setTimeout(() => { actualizador.arrancando = false; }, 2500);

  // Piezas expuestas en consola para depurar desde el navegador. Es
  // deliberado: el equipo de El Mercio puede tocar el balance en vivo.
  if (import.meta.env?.DEV) {
    window.__juego = juego;
    window.__cuaderno = cuaderno;
    window.__hud = hud;
    // El gestor de pantallas, para poder abrir una sola sin llegar a ella
    // jugando. Probar la maqueta de la victoria de otro modo obliga a
    // completar un expediente entero, que es casi imposible a propósito.
    window.__pantallas = pantallas;

    // ── EL CATÁLOGO DE PANTALLAS, para el constructor ──────────────────────
    //
    // El constructor de textos (creador/pantallas/) tiene un teléfono con el
    // juego dentro, y hasta ahora solo se podía mirar la portada: para ver
    // cómo queda un texto en la pantalla de victoria había que ganarse una
    // victoria. Con esto, el constructor abre cualquiera de las diez.
    //
    // El catálogo vive AQUÍ y no allí a propósito: la lista de pantallas, sus
    // nombres y los datos de ejemplo que necesita cada una son cosa del juego.
    // Duplicados en la herramienta, se quedarían viejos en cuanto alguien
    // añadiera una pantalla, que es exactamente lo que le pasó al catálogo de
    // textos antes de importarlo del código.
    const runDeEjemplo = {
      papeles: 1345,
      papelesEntregados: 12,
      distancia: 984,
      puntaje: 8800,
      texto: 'Nadie vio nada.',
      pruebas: ['Video del Nissan huyendo', 'Video del Cayenne llegando', 'Audio editado'],
      escenario: 'bahia',
      motivo: 'captura',
      jueces: 6,
      velocidad: 7,
      marcasPrevias: { evidenciaHistorica: 0, distanciaHistorica: 0, mejorEvidencia: 500 },
    };

    window.__catalogo = {
      ejemplo: runDeEjemplo,
      pantallas: [
        { id: 'menu', nombre: 'Portada', abrir: () => pantallas.menu() },
        { id: 'ajustes', nombre: 'Redacción', abrir: () => pantallas.ajustes() },
        { id: 'archivo', nombre: 'Archivo', abrir: () => pantallas.notebook() },
        { id: 'relato', nombre: 'Bifurcación', abrir: (d) => pantallas.relato(d) },
        { id: 'sorteo', nombre: 'Sorteo del juez', abrir: (d) => pantallas.escape(d) },
        { id: 'pruebas', nombre: 'Expediente', abrir: (d) => pantallas.botin(d) },
        { id: 'ranking', nombre: 'Ranking', abrir: (d) => pantallas.deportes(d) },
        { id: 'victoria', nombre: 'Victoria', abrir: (d) => pantallas.victoria(d) },
        { id: 'gameover', nombre: 'Derrota', abrir: (d) => pantallas.gameOver(d) },
        { id: 'pausa', nombre: 'Pausa', abrir: () => pantallas.pausa() },
      ],
      /**
       * Abre una pantalla por su id. Devuelve false si no existe, para que la
       * herramienta pueda avisar en vez de quedarse callada.
       */
      abrir(id, datos) {
        const ficha = this.pantallas.find((p) => p.id === id);
        if (!ficha) return false;
        pantallas.mostrar(ficha.abrir({ ...runDeEjemplo, ...datos }));
        return true;
      },
    };
    // Las páginas del periódico, para poder probar un titular en caliente
    // antes de escribirlo en config/publicaciones.js. Por ejemplo:
    //   Object.assign(__paginas[0].articulos[0],
    //     { pendiente:false, titular:'…', bajada:'…', url:'…' })
    window.__paginas = PAGINAS;
    window.__cat = CATALOGO_POTENCIADORES;
    // Los escalones de racha y su resolución, para poder ver un color sin
    // encadenar treinta papeles a mano.
    window.__racha = { TRAMOS: RACHA.TRAMOS, tramo: tramoRacha };
    // El detalle del bisel y cuántas geometrías comparte el mundo.
    window.__bisel = () => ({ segmentos: segmentosBisel(), geometrias: tamanoCache() });
    // Los mandos de la luz, en caliente. Ajustar iluminación recompilando y
    // recargando es un ciclo de veinte segundos por prueba; con esto se barren
    // treinta combinaciones en una sola sesión y se elige con números delante
    // en vez de a ojo. Solo en desarrollo.
    // MEDIR LO QUE HAY EN PANTALLA, DE VERDAD.
    //
    // Playwright saca capturas del compositor, y para un lienzo WebGL sin
    // `preserveDrawingBuffer` eso devuelve el último fotograma presentado —que
    // dentro de una misma sesión se queda congelado—. Barriendo treinta
    // combinaciones de luz, las treinta salían con el mismo brillo al
    // milésimo, que es la clase de medida que parece un resultado y no lo es.
    //
    // Esto lee los píxeles del propio contexto. Va en un `requestAnimationFrame`
    // que se registra DESPUÉS del bucle del juego, así que corre en el mismo
    // fotograma pero cuando ya está pintado y antes de que el navegador
    // presente y limpie: el búfer aún es válido. Y como lee la pantalla y no la
    // escena, incluye el postproceso —el bloom, que es justo lo que puede estar
    // quemando la imagen—.
    window.__muestra = () => new Promise((listo) => {
      // REINTENTA HASTA PILLAR UN FOTOGRAMA PINTADO.
      //
      // El orden de los `requestAnimationFrame` no está garantizado respecto
      // al bucle del juego: unas veces esta devolución de llamada corre después
      // de pintar —y el búfer tiene la imagen— y otras antes, con el búfer
      // recién limpiado, y entonces se lee negro. Midiendo una sola vez, dos de
      // cada tres lecturas salían a cero y parecían una escena apagada.
      // Se prueba hasta doce veces y se devuelve la primera lectura con luz.
      let intentos = 0;
      const probar = () => {
        const gl = window.__juego.renderizador.getContext();
        // AL BÚFER DE PANTALLA, EXPLÍCITAMENTE.
        //
        // Con el postproceso encendido, el compositor deja atado el destino de
        // la última pasada, y `readPixels` lee SIEMPRE lo que esté atado en ese
        // momento. Según qué pasada hubiera corrido de última, esto leía un
        // objetivo intermedio recién limpiado y devolvía negro: en un barrido
        // de siete combinaciones, las cinco últimas salían a cero seguidas y
        // parecía que la escena se hubiera apagado a mitad de la prueba.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        const an = gl.drawingBufferWidth;
        const al = gl.drawingBufferHeight;
        const buf = new Uint8Array(an * al * 4);
        gl.readPixels(0, 0, an, al, gl.RGBA, gl.UNSIGNED_BYTE, buf);

        // Se salta las bandas del HUD: arriba el marcador, abajo los mandos.
        // (readPixels devuelve las filas de abajo arriba; da igual, el recorte
        // es simétrico.)
        const y0 = Math.floor(al * 0.14), y1 = Math.floor(al * 0.78);
        let lum = 0, sat = 0, quem = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = 0; x < an; x++) {
            const i = (y * an + x) * 4;
            const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
            sat += mx === 0 ? 0 : (mx - mn) / mx;
            if (mx > 0.985) quem++;
            n++;
          }
        }
        if (lum === 0 && ++intentos < 12) { requestAnimationFrame(probar); return; }
        listo({
          brillo: +(lum / n).toFixed(3),
          saturacion: +(sat / n).toFixed(3),
          quemado: +((quem / n) * 100).toFixed(1),
          intentos,
        });
      };
      requestAnimationFrame(probar);
    });

    window.__luz = (v = {}) => {
      const j = window.__juego;
      const e = j.escenaThree;
      const esc = j.escenario;
      if (v.exposicion !== undefined) j.renderizador.toneMappingExposure = v.exposicion;
      if (v.entorno !== undefined) e.environmentIntensity = v.entorno;
      if (v.ambiente !== undefined) esc.luzAmbiente.intensity = v.ambiente;
      if (v.cielo !== undefined) esc.luzCielo.intensity = v.cielo;
      if (v.direccional !== undefined) esc.luzDireccional.intensity = v.direccional;
      if (v.niebla !== undefined && e.fog) { e.fog.density = v.niebla; esc.densidadBase = v.niebla; }
      // El acabado de los materiales entra por el mismo mando: rugosidad,
      // brillo de entorno y metalidad son parte de «cuánta luz hay» tanto como
      // las lámparas, y separarlos obligaba a barrer dos veces.
      if (v.techo !== undefined || v.brillo !== undefined || v.metal !== undefined) {
        afinarAcabado({ techo: v.techo, entorno: v.brillo, metal: v.metal });
      }
      return {
        ...acabadoActual(),
        exposicion: j.renderizador.toneMappingExposure,
        entorno: e.environmentIntensity,
        ambiente: esc.luzAmbiente?.intensity,
        cielo: esc.luzCielo?.intensity,
        direccional: esc.luzDireccional?.intensity,
        niebla: e.fog?.density,
      };
    };
    // Cuántas geometrías distintas hay vivas. La caché de utils/geometria.js
    // dice que la calle repite medidas y que por eso se puede pagar el bisel;
    // este número es la comprobación de que es verdad, y no una suposición
    // sobre el reparto de tamaños del mundo. Si sube a los millares, es que
    // algo está generando cajas con decimales distintos cada vez y el bisel
    // ha pasado de barato a carísimo sin avisar.
    console.info(
      `[Estado de Excepción] Modo desarrollo. Calidad detectada: ${calidad.nivel}. ` +
      `Geometrías compartidas: ${tamanoCache()}. Usa window.__juego para depurar.`,
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
