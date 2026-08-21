// ============================================================================
// ENTORNO — el cielo que se refleja en las cosas
// ============================================================================
//
// LO QUE LE FALTABA AL MUNDO NO ERA LUZ, ERA A QUÉ REFLEJAR.
//
// La escena tenía cinco focos —ambiental, hemisférica, direccional, relleno y
// contraluz— y aun así salía a maqueta de cartón. El motivo no es la cantidad
// de luz: es que un `MeshStandardMaterial` calcula DOS cosas, el difuso (el
// color mate, que responde a las luces) y el especular (el brillo, que
// responde a lo que hay ALREDEDOR). Sin mapa de entorno, la segunda mitad
// vale cero en todas partes.
//
// Y esa segunda mitad es justo la que hace que algo parezca sólido. Una
// gominola no se ve apetecible porque le dé mucha luz, se ve así porque tiene
// un reflejo del cielo corriéndole por el lomo. Un cubo mate con cinco focos
// sigue siendo un cubo mate.
//
// ---------------------------------------------------------------------------
// POR QUÉ PROCEDURAL Y NO UN HDRI
// ---------------------------------------------------------------------------
// Un HDRI de verdad son entre uno y ocho megas por escenario, y esto es un PWA
// que tiene que arrancar sin conexión. Además serían fotos de sitios reales
// metidas en un mundo de cajas de colores planos: reflejaría un cielo con
// nubes de Utah en una tienda de La Bahía.
//
// El cielo se pinta aquí, con los colores del propio escenario: el mismo azul
// que ya usa la niebla arriba, el mismo rebote del asfalto abajo, y un sol en
// la posición del foco direccional. Pesa cero bytes, se genera en un
// milisegundo y —lo importante— cada barrio se refleja a sí mismo. El Apagón
// refleja su propia noche azul; las Elecciones, su morado.
//
// ---------------------------------------------------------------------------
// EL COSTE
// ---------------------------------------------------------------------------
// El PMREM (el prefiltrado que convierte el cielo en algo consultable a
// cualquier rugosidad) se hace UNA vez por escenario, al montarlo, y se
// guarda. Cambiar de barrio en la bifurcación no lo rehace si ya se generó.
// En tiempo de partida no cuesta nada: el sombreador ya hacía la consulta,
// solo que hasta ahora devolvía negro.
// ============================================================================

import * as THREE from 'three';

/** Lo ya generado, por escenario. Clave: el id del barrio. */
const cache = new Map();

let pmrem = null;

/**
 * EL CIELO A MEDIO CAMINO ENTRE DOS BARRIOS.
 *
 * Es UN SOLO objetivo de render que se reescribe una y otra vez durante la
 * transición de ambiente, y eso no es tacañería de memoria: `scene.environment`
 * tiene que seguir apuntando SIEMPRE AL MISMO objeto Texture. Medido: cambiar
 * la identidad de la textura cada fotograma cuesta 2,7 ms extra de refresco de
 * uniformes en todos los materiales de la escena; reescribir el contenido del
 * mismo objetivo no cuesta nada de eso. (Recompilar no recompila ninguna de las
 * dos: el recuento de programas se queda igual, comprobado.)
 */
let objetivoTransito = null;

/** El lienzo se comparte: se pinta, se sube y se vuelve a pintar encima. */
let lienzo = null;

/**
 * Alto y ancho del cielo antes de prefiltrar.
 *
 * 256 × 128 y no 1024: lo que sale de aquí se va a consultar SIEMPRE borroso
 * —el material más pulido del juego tiene rugosidad 0.3— así que la resolución
 * de partida se pierde entera en el prefiltrado. Con 256 el degradado no
 * bandea y la generación es instantánea.
 */
const ANCHO = 256;
const ALTO = 128;

/**
 * Los cuatro colores que definen un cielo, en notación de lienzo.
 *
 * Arriba el color del cielo, en el ecuador el de la niebla —que es donde el
 * mundo se funde con el fondo—, abajo el rebote cálido del suelo y aparte el
 * del sol. Son los colores que la escena ya usa para sus luces, así que el
 * reflejo nunca puede desentonar con la iluminación: es la misma paleta vista
 * de otra manera.
 *
 * Está sacado a función porque ahora hay dos clientes: el cielo de un barrio y
 * el cielo intermedio entre dos.
 */
function tonosDe(colores) {
  return {
    arriba: hex(colores.luzCielo ?? colores.nieblaLejos),
    medio: hex(colores.nieblaLejos),
    abajo: hex(colores.rebote ?? colores.luzAmbiente),
    sol: hex(colores.luzDireccional ?? 0xffffff),
  };
}

/** Pinta un cielo en el lienzo compartido y lo devuelve como textura. */
function pintarCielo({ arriba, medio, abajo, sol: colorSol }) {
  if (!lienzo) {
    lienzo = document.createElement('canvas');
    lienzo.width = ANCHO;
    lienzo.height = ALTO;
  }
  const ctx = lienzo.getContext('2d');

  // --- El degradado vertical ------------------------------------------------
  const grad = ctx.createLinearGradient(0, 0, 0, ALTO);
  grad.addColorStop(0, arriba);
  grad.addColorStop(0.48, medio);
  grad.addColorStop(0.52, medio);
  grad.addColorStop(1, abajo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // --- El sol ---------------------------------------------------------------
  // Una mancha clara y blanda, no un disco. Un disco duro se refleja como un
  // punto y da aspecto de bola de billar; una mancha ancha recorre el canto
  // entero de una caja, que es exactamente el brillo que se buscaba al
  // biselar. Va arriba a la derecha porque ahí está la luz direccional de
  // BaseScene (posición 6, 15, 4): si el reflejo viniera de otro lado, el
  // brillo y la sombra dirían cosas distintas.
  const sol = ctx.createRadialGradient(
    ANCHO * 0.72, ALTO * 0.22, 0,
    ANCHO * 0.72, ALTO * 0.22, ALTO * 0.42,
  );
  sol.addColorStop(0, colorSol);
  sol.addColorStop(0.35, mezcla(colorSol, medio, 0.55));
  sol.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sol;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const textura = new THREE.CanvasTexture(lienzo);
  textura.mapping = THREE.EquirectangularReflectionMapping;
  // El degradado se escribe en valores de pantalla, así que hay que decirle al
  // motor que vienen con gamma aplicada. Sin esto el cielo entra al cálculo
  // más claro de lo que es y los reflejos salen lavados.
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/**
 * Prefiltra un cielo. Con `objetivo` reescribe ese render target —y conserva la
 * identidad de su textura, que es lo que importa para la transición—; sin él,
 * pide uno nuevo.
 */
function prefiltrar(renderizador, tonos, objetivo = null) {
  if (!pmrem) {
    pmrem = new THREE.PMREMGenerator(renderizador);
    // El sombreador del equirectangular se compila AQUÍ y no en la primera
    // mezcla. Medido: sin esto la primera regeneración del cielo de tránsito
    // costó 24 ms, y caía justo dentro del cruce, que es el fotograma que
    // menos margen tiene de todo el juego.
    pmrem.compileEquirectangularShader();
  }
  const textura = pintarCielo(tonos);
  const salida = pmrem.fromEquirectangular(textura, objetivo);
  textura.dispose();
  return salida;
}

/**
 * El cielo del escenario, listo para poner en `escena.environment`.
 *
 * @param {THREE.WebGLRenderer} renderizador
 * @param {string} id      Identificador del barrio, para la caché
 * @param {object} colores Paleta del escenario (config/escenarios.js)
 * @returns {THREE.Texture}
 */
export function cieloDe(renderizador, id, colores) {
  const guardado = cache.get(id);
  if (guardado) return guardado;

  const objetivo = prefiltrar(renderizador, tonosDe(colores));
  cache.set(id, objetivo.texture);
  return objetivo.texture;
}

/**
 * EL CIELO INTERMEDIO ENTRE DOS BARRIOS, para que los reflejos también viajen.
 *
 * Al cruzar de la Bahía al Apagón no basta con bajar la intensidad del entorno:
 * lo que se refleja en los cantos biselados pasa de un mediodía azul a una
 * noche marina, y ese cambio vale por sí solo 0,0726 de brillo medio del cuadro
 * —el 13,7 %, medido con el mundo parado—. Dejarlo como un salto sería dejar la
 * quinta parte de la transición sin transicionar.
 *
 * No se puede mezclar en el sombreador (son texturas prefiltradas y el material
 * estándar sólo muestrea una), así que se vuelve a prefiltrar un cielo pintado
 * con la paleta a medio camino. Cuesta 1,2-3,5 ms, o sea que no se llama cada
 * fotograma: la transición lo pide a pasos. Ver scenes/Ambiente.js.
 *
 * @param {THREE.WebGLRenderer} renderizador
 * @param {object} coloresA Paleta del barrio del que se viene
 * @param {object} coloresB Paleta del barrio al que se va
 * @param {number} t        0 el de A, 1 el de B
 * @returns {THREE.Texture} SIEMPRE el mismo objeto: sólo cambia su contenido
 */
export function cieloEntre(renderizador, coloresA, coloresB, t) {
  const a = tonosDe(coloresA);
  const b = tonosDe(coloresB);
  objetivoTransito = prefiltrar(renderizador, {
    arriba: mezcla(a.arriba, b.arriba, t),
    medio: mezcla(a.medio, b.medio, t),
    abajo: mezcla(a.abajo, b.abajo, t),
    sol: mezcla(a.sol, b.sol, t),
  }, objetivoTransito);
  return objetivoTransito.texture;
}

/**
 * Suelta el generador y los cielos.
 *
 * Solo al cerrar: los cielos son cinco texturas pequeñas y se reutilizan cada
 * vez que se vuelve a un barrio.
 */
export function soltarCielos() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
  objetivoTransito?.dispose();
  objetivoTransito = null;
  pmrem?.dispose();
  pmrem = null;
}

/** Un color de la paleta (0xrrggbb) en la notación que entiende el canvas. */
function hex(c) {
  return '#' + new THREE.Color(c).getHexString();
}

/** Mezcla dos colores de canvas, para el halo del sol. */
function mezcla(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return '#' + ca.lerp(cb, t).getHexString();
}
