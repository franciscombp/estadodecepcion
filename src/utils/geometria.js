// ============================================================================
// GEOMETRÍA — cajas con bisel, compartidas entre miles de instancias
// ============================================================================
//
// POR QUÉ UN BISEL CAMBIA TANTO.
//
// Una `BoxGeometry` tiene la arista viva: dos caras que se encuentran en un
// ángulo perfecto. Ahí no cabe ni un píxel de luz, así que el borde de un cubo
// es siempre un salto brusco de un tono al siguiente, y da igual cuánta luz se
// le eche encima. Es la razón de que un mundo hecho de cajas se vea a maqueta
// de cartón por muy bien iluminado que esté.
//
// Un bisel —aunque sea de dos milímetros— mete una franja de caras que miran
// justo entre las dos. Esa franja recoge un reflejo especular alargado que
// recorre toda la arista, y eso es lo que el ojo lee como «esto es un objeto
// sólido con volumen» en vez de «esto es un dibujo de un cubo». Es el mismo
// truco de todos los juegos de caramelo: no tienen más polígonos en las
// formas, los tienen en los CANTOS.
//
// ---------------------------------------------------------------------------
// LO QUE CUESTA, Y POR QUÉ SE PUEDE PAGAR
// ---------------------------------------------------------------------------
// Una caja son 12 triángulos. Una caja biselada con un segmento son 12 caras
// planas más 12 cantos más 8 esquinas: unos 140 triángulos. Diez veces más.
//
// Se paga por dos razones. La primera es que en este juego los triángulos no
// son el cuello de botella —lo son las llamadas de dibujo y el relleno de
// píxeles—, y biselar no añade ni una llamada. La segunda, y más importante,
// es que las geometrías SE COMPARTEN: la calle repite las mismas medidas una y
// otra vez, así que la caché de aquí abajo hace que trescientas cajas de
// contenedor sean UNA geometría en memoria. Sin la caché esto sería inviable;
// con ella, el coste real es una fracción del que sugiere la cuenta.
//
// ---------------------------------------------------------------------------
// EL RADIO NO ES UN NÚMERO FIJO
// ---------------------------------------------------------------------------
// Un bisel de 4 cm en una caja de 30 cm de lado la convierte en una pastilla;
// el mismo bisel en un edificio de doce metros no se ve. Así que el radio se
// saca del LADO MÁS CORTO: siempre la misma proporción, siempre el mismo
// aspecto, mida lo que mida la pieza. Y con un techo, porque a partir de
// cierto tamaño el bisel deja de leerse como canto y empieza a leerse como que
// alguien lijó el edificio.
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Proporción del lado corto que se lleva el bisel.
 *
 * 0.12 y no 0.25: a un cuarto del lado las cajas pequeñas —una caja de fruta,
 * un ladrillo— se redondean hasta parecer jabones, y este mundo es de cartón y
 * hormigón, no de gominolas. Un octavo es el punto en el que la arista brilla
 * y la pieza sigue siendo reconociblemente una caja.
 */
const PROPORCION = 0.12;

/** Tope absoluto: por encima de esto el bisel deja de leerse como canto. */
const RADIO_MAXIMO = 0.22;

/**
 * Y UN SUELO, que resultó ser el mando de rendimiento más grande del juego.
 *
 * Estaba en 0.012 con el argumento de que por debajo de eso el bisel no ocupa
 * ni un píxel. El argumento era bueno y el número estaba mal, por dos cuentas:
 *
 *   · LO QUE MIDE UN PÍXEL. A veinte metros —la distancia a la que se lee el
 *     decorado— la pantalla vertical abarca 13 m de ancho en 393 píxeles: cada
 *     píxel son 3,3 cm. Un bisel de 1,2 cm es un tercio de píxel. No es que se
 *     vea poco: es que no se puede ver.
 *   · LO QUE CUESTA. Medido construyendo cada barrio con el reloj parado:
 *     construir la Bahía costaba 1.650 ms, las Elecciones 1.787 y Carondelet
 *     1.073, y esos son los congelones. Con el bisel apagado del todo bajaban a
 *     207 / 88 / 107, o sea que el bisel ERA el coste entero. Y no es el número
 *     de segmentos —con uno solo costaba 1.688— sino el coste fijo por pieza:
 *     construir la caja redondeada, soldarle los vértices, y después clonarla y
 *     transformarla otra vez dentro de fundirPorMaterial.
 *
 * Barrido del suelo, en milisegundos por barrio (bahía / elecciones / carondelet)
 * y piezas que conservan el bisel en la Bahía:
 *
 *     0.012   1650 / 1787 / 1073    2300 piezas   ← como estaba
 *     0.020   1126 /  834 /  628    1290
 *     0.030    818 /  819 /  541     985
 *     0.045    420 /  679 /  357     158          ← aquí
 *     0.060    210 /  582 /  318      67
 *
 * 0.045 es el corte: exige que el lado más corto de la pieza pase de 37 cm, o
 * sea que se bisela lo que tiene volumen —muros, cornisas, forjados, cajones de
 * obstáculo, el personaje— y se deja con arista viva lo que es lámina:
 * montantes, listones de baranda, dinteles, chapas. Que es exactamente donde el
 * bisel no se veía.
 */
const RADIO_MINIMO = 0.045;

/** Segmentos del bisel. Lo fija el nivel de calidad al arrancar. */
let segmentos = 2;

/**
 * Caché de geometrías. La clave son las medidas redondeadas al milímetro: la
 * calle genera las mismas cajas una y otra vez con decimales que bailan en la
 * quinta cifra, y sin redondear la caché no acertaría nunca.
 */
const cache = new Map();

/**
 * Ajusta el detalle del bisel al nivel de calidad.
 *
 * En «baja» se queda en cero, que devuelve cajas normales: un teléfono que va
 * justo no tiene por qué pagar diez veces los triángulos por un brillo en el
 * canto. Se llama UNA vez al arrancar, antes de construir nada; llamarlo con
 * la escena montada no rehace lo que ya existe.
 *
 * @param {string} nivel 'alta' | 'media' | 'baja'
 */
export function afinarBisel(nivel) {
  const antes = segmentos;
  segmentos = nivel === 'baja' ? 0 : nivel === 'media' ? 1 : 2;
  // Si cambia el detalle, la caché guarda geometrías del detalle anterior.
  if (segmentos !== antes) vaciarCache();
}

/** Cuántos segmentos lleva el bisel ahora mismo. Para las pruebas. */
export function segmentosBisel() { return segmentos; }

/**
 * Una caja con los cantos biselados, compartida con todas las que midan igual.
 *
 * Sustituye a `new THREE.BoxGeometry(w, h, d)` en cualquier pieza sólida de un
 * solo material.
 *
 * NO SIRVE PARA CAJAS DE VARIOS MATERIALES. `BoxGeometry` reparte sus caras en
 * seis grupos —[+x, −x, +y, −y, +z, −z]— y por eso admite un array de seis
 * materiales; el legajo de pruebas lo usa para poner el borde de las hojas en
 * los cantos y la portada en las caras. Una caja biselada es UN solo grupo:
 * pasarle el array deja la pieza con el primer material en todas partes. Esas
 * se quedan con `BoxGeometry` y está bien que se queden.
 *
 * @param {number} ancho
 * @param {number} alto
 * @param {number} fondo
 * @param {number} [radio] Para forzarlo. Por defecto sale del lado más corto.
 * @returns {THREE.BufferGeometry}
 */
export function caja(ancho, alto, fondo, radio) {
  if (segmentos === 0) return cajaViva(ancho, alto, fondo);

  const r = radio ?? Math.min(
    RADIO_MAXIMO,
    Math.min(Math.abs(ancho), Math.abs(alto), Math.abs(fondo)) * PROPORCION,
  );
  if (r < RADIO_MINIMO) return cajaViva(ancho, alto, fondo);

  const clave = `b${m(ancho)}|${m(alto)}|${m(fondo)}|${m(r)}|${segmentos}`;
  let g = cache.get(clave);
  if (!g) {
    // INDEXADA, Y NO ES UN DETALLE.
    //
    // `RoundedBoxGeometry` sale SIN índice y `BoxGeometry` sale CON él, y
    // `mergeGeometries()` —que este juego usa para fundir las fachadas de una
    // manzana en una sola malla— exige que todas las piezas que le entran sean
    // del mismo tipo. Al cambiar las cajas de golpe, las fusiones empezaron a
    // fallar con «All geometries must have compatible attributes» y manzanas
    // enteras dejaron de dibujarse.
    //
    // `mergeVertices` le pone el índice soldando los vértices repetidos. Suelda
    // solo los que coinciden EN TODO —posición, normal y uv—, así que no
    // redondea ninguna arista que no estuviera ya redondeada, y de paso baja la
    // cuenta de vértices.
    const bruta = new RoundedBoxGeometry(ancho, alto, fondo, segmentos, r);
    g = mergeVertices(bruta);
    bruta.dispose();
    cache.set(clave, g);
  }
  return g;
}

/**
 * La caja de toda la vida, también compartida.
 *
 * Existe para las piezas que no deben biselarse —las de varios materiales, las
 * láminas finísimas— y para el nivel de calidad baja. Que pase por la misma
 * caché es lo que hace que cambiar de nivel no duplique nada.
 */
export function cajaViva(ancho, alto, fondo) {
  const clave = `v${m(ancho)}|${m(alto)}|${m(fondo)}`;
  let g = cache.get(clave);
  if (!g) {
    g = new THREE.BoxGeometry(ancho, alto, fondo);
    cache.set(clave, g);
  }
  return g;
}

/** Milímetro, que es la precisión a la que la caché acierta. */
function m(v) { return Math.round(v * 1000); }

/** Cuántas geometrías distintas hay vivas. Para medir el ahorro. */
export function tamanoCache() { return cache.size; }

/**
 * Suelta todas las geometrías compartidas.
 *
 * Ojo: deja inservible cualquier malla que siga usándolas, así que solo se
 * llama al cambiar el detalle del bisel antes de construir nada.
 */
export function vaciarCache() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
