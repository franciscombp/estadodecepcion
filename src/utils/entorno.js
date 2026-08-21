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
 * EL MISMO CIELO, PERO PARA MIRARLO.
 *
 * El fondo de la escena era `new THREE.Color(nieblaLejos)`: una losa de un solo
 * valor ocupando el cuarto superior del cuadro. Y mientras tanto aquí al lado
 * ya se estaba pintando un degradado con su sol para los reflejos, que nadie
 * veía. Esto lo saca a la vista.
 *
 * Va en lienzos APARTE de `lienzo` y no en el mismo por dos motivos:
 *
 *   · Identidad. El fondo se queda colgado de `escena.background` mientras el
 *     de los reflejos se repinta a cada paso de la transición; compartiendo
 *     lienzo, repintar el reflejo repintaría el cielo que se está mirando.
 *   · Resolución. Para reflejar borroso bastan 256×128; para MIRARLO no: el
 *     cuadro se come 63° de los 180 verticales, o sea 45 píxeles estirados
 *     sobre 852, y el degradado bandea. A 512×256 no.
 *
 * Uno por barrio, como los reflejos, más el de tránsito que repinta Ambiente.
 */
const fondos = new Map();
let texturaTransito = null;
const ANCHO_FONDO = 512;
const ALTO_FONDO = 256;

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

/**
 * Pinta un cielo en un lienzo. El mismo dibujo sirve para los dos clientes,
 * con una diferencia: al que se MIRA se le ponen nubes, y al de los reflejos
 * no. Ver el porqué en `nubes()`.
 */
function pintarEn(ctx, ancho, alto, { arriba, medio, abajo, sol: colorSol }, paraMirar) {
  // --- El degradado vertical ------------------------------------------------
  //
  // LAS PARADAS DEL CIELO QUE SE MIRA NO SON LAS DEL QUE SE REFLEJA, y el
  // motivo es una cuenta que costó dos intentos aprender:
  //
  // La cámara pica 13° y abre 63,7° en vertical, así que ve desde +18,9° hacia
  // abajo. En una equirectangular eso es v ∈ [0.395, 0.48]: EL OCHO Y MEDIO
  // POR CIENTO DE LA TEXTURA, una franja pegada al ecuador. Un cénit puesto en
  // v=0 —que es donde lo pondría cualquiera— cae setenta grados por encima de
  // lo que se ve, y por eso el primer intento salió idéntico a la losa plana
  // que venía a sustituir: el degradado estaba, pero entero fuera de cuadro.
  //
  // Para el reflejo sí valen las paradas de siempre, porque el prefiltrado
  // muestrea la esfera entera.
  const grad = ctx.createLinearGradient(0, 0, 0, alto);
  if (paraMirar) {
    // Todo el recorrido metido en la franja que se ve. El cénit se calcula del
    // propio color de cielo del barrio —claridad al 72 %, saturación un 30 %
    // más— así que cada uno conserva el suyo sin constantes aparte.
    grad.addColorStop(0, _cenitDe(arriba));
    grad.addColorStop(0.36, _cenitDe(arriba));
    grad.addColorStop(0.44, arriba);
    grad.addColorStop(0.48, medio);
  } else {
    grad.addColorStop(0, arriba);
    grad.addColorStop(0.48, medio);
  }
  grad.addColorStop(0.52, medio);
  grad.addColorStop(1, abajo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ancho, alto);

  // --- El sol ---------------------------------------------------------------
  // Una mancha clara y blanda, no un disco. Un disco duro se refleja como un
  // punto y da aspecto de bola de billar; una mancha ancha recorre el canto
  // entero de una caja, que es exactamente el brillo que se buscaba al
  // biselar. Va arriba a la derecha porque ahí está la luz direccional de
  // BaseScene: si el reflejo viniera de otro lado, el brillo y la sombra
  // dirían cosas distintas.
  //
  // La altura la manda esa luz, no el gusto: en (7.5, 9, 5) está a 44° sobre el
  // horizonte, y 44° en una equirectangular son v = 0.5 − 44/180 = 0.256. Con
  // el 0.22 de antes —que correspondía a los 64° de la luz vieja— el reflejo
  // venía de más arriba que la sombra.
  const sol = ctx.createRadialGradient(
    ancho * 0.72, alto * 0.256, 0,
    ancho * 0.72, alto * 0.256, alto * 0.42,
  );
  sol.addColorStop(0, colorSol);
  sol.addColorStop(0.35, mezcla(colorSol, medio, 0.55));
  sol.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sol;
  ctx.fillRect(0, 0, ancho, alto);

  if (paraMirar) capas(ctx, ancho, alto, arriba, colorSol);
}

/**
 * LAS CAPAS DEL CIELO — bandas que dan la vuelta entera, no nubes sueltas.
 *
 * Se probaron nubes de verdad, manchas ovaladas repartidas por el cielo, y hay
 * dos razones por las que no pueden ser eso:
 *
 *   · EN HORIZONTAL LA CÁMARA VE EL 9 % DE LA TEXTURA. El mundo gira en las
 *     bifurcaciones, pero la cámara mira siempre hacia -Z, así que la ventana
 *     de cielo que entra en cuadro es SIEMPRE LA MISMA. Una nube dentro de esa
 *     ventana no se movería nunca: se leería como suciedad en el objetivo, no
 *     como nube. Y una fuera no se vería jamás.
 *   · Una banda que da la vuelta entera no tiene rasgos en azimut, así que le
 *     da igual que el mundo gire noventa grados en una esquina. Una nube
 *     suelta se quedaría quieta mientras la calle tuerce, que es exactamente
 *     el fallo que se arregló al girar el mundo en vez de la cámara.
 *
 * Lo que aportan es lo que pedía el encargo: valor y capas. Tres franjas
 * blandas dentro de la banda visible rompen el degradado limpio y le dan
 * espesor, que es lo que separa un cielo de un fondo de color.
 *
 * El color sale de la paleta —el tono de arriba mezclado con el del sol—, así
 * que el Apagón tiene sus capas de noche, apenas más claras que su cielo, sin
 * ninguna regla aparte.
 */
function capas(ctx, ancho, alto, arriba, colorSol) {
  // v de la banda visible: [0.395, 0.48]. Las capas van dentro, y la más baja
  // no llega al ecuador: pegada al horizonte se confundiría con la niebla.
  const franjas = [
    [0.400, 0.030, 0.30],
    [0.428, 0.018, 0.22],
    [0.452, 0.012, 0.16],
  ];
  const claro = mezcla(arriba, colorSol, 0.66);
  for (const [centro, grosor, alfa] of franjas) {
    const y0 = (centro - grosor) * alto;
    const y1 = (centro + grosor) * alto;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, claro);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, ancho, y1 - y0);
    ctx.restore();
  }
}

/** Pinta un cielo en el lienzo compartido y lo devuelve como textura. */
function pintarCielo(tonos) {
  if (!lienzo) {
    lienzo = document.createElement('canvas');
    lienzo.width = ANCHO;
    lienzo.height = ALTO;
  }
  pintarEn(lienzo.getContext('2d'), ANCHO, ALTO, tonos, false);

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
 * EL CIELO DEL BARRIO PARA PONER DE FONDO DE ESCENA.
 *
 * Uno por barrio y cacheado, igual que el de los reflejos, para que suspender
 * y reanudar un escenario se lleven cada uno el suyo sin repintar nada.
 *
 * @param {string} id      Identificador del barrio
 * @param {object} colores Paleta del escenario
 * @returns {THREE.Texture}
 */
export function fondoDe(id, colores) {
  const guardado = fondos.get(id);
  if (guardado) return guardado;
  const t = _texturaFondo();
  pintarEn(t.image.getContext('2d'), ANCHO_FONDO, ALTO_FONDO, tonosDe(colores), true);
  t.needsUpdate = true;
  fondos.set(id, t);
  return t;
}

/**
 * EL FONDO A MEDIO CAMINO, para que el cielo que se mira también viaje.
 *
 * A diferencia del de los reflejos, aquí no hay prefiltrado que pagar: es
 * repintar un lienzo de 512×256 y volver a subirlo, 0,3-0,5 ms medidos. Por eso
 * este sí se puede pedir cada fotograma y el otro va a pasos.
 *
 * Devuelve SIEMPRE la misma textura: sólo cambia su contenido.
 */
export function fondoEntre(coloresA, coloresB, t) {
  const a = tonosDe(coloresA);
  const b = tonosDe(coloresB);
  if (!texturaTransito) texturaTransito = _texturaFondo();
  pintarEn(texturaTransito.image.getContext('2d'), ANCHO_FONDO, ALTO_FONDO, {
    arriba: mezcla(a.arriba, b.arriba, t),
    medio: mezcla(a.medio, b.medio, t),
    abajo: mezcla(a.abajo, b.abajo, t),
    sol: mezcla(a.sol, b.sol, t),
  }, true);
  texturaTransito.needsUpdate = true;
  return texturaTransito;
}

/** Un lienzo de fondo con su textura, listo para pintar encima. */
function _texturaFondo() {
  const c = document.createElement('canvas');
  c.width = ANCHO_FONDO;
  c.height = ALTO_FONDO;
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  for (const t of fondos.values()) t.dispose();
  fondos.clear();
  texturaTransito?.dispose();
  texturaTransito = null;
  objetivoTransito?.dispose();
  objetivoTransito = null;
  pmrem?.dispose();
  pmrem = null;
}

/** Un color de la paleta (0xrrggbb) en la notación que entiende el canvas. */
function hex(c) {
  return '#' + new THREE.Color(c).getHexString();
}

/**
 * El cénit a partir del color de cielo del barrio: más oscuro y más saturado.
 * Ver el degradado en pintarEn().
 */
function _cenitDe(c) {
  const hsl = {};
  new THREE.Color(c).getHSL(hsl);
  return '#' + new THREE.Color().setHSL(
    hsl.h, Math.min(1, hsl.s * 1.3 + 0.06), hsl.l * 0.72,
  ).getHexString();
}

/** Mezcla dos colores de canvas, para el halo del sol. */
function mezcla(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return '#' + ca.lerp(cb, t).getHexString();
}
