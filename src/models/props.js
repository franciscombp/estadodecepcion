// ============================================================================
// PROPS — Obstáculos, recolectables y decorado
// ============================================================================
// Estilo: low-poly de formas redondeadas y sombreado suave, con neón encima.
// Ver docs/ESTILO.md.
//
// LAS TRES REGLAS QUE NO SE ROMPEN
//
// 1. LA SILUETA COMUNICA LA MECÁNICA.
//    Bajo y ancho      → saltar
//    Pórtico elevado   → agacharse
//    Bloque macizo     → cambiar de carril
//    El jugador tiene que leerlo en medio segundo, a distancia y en
//    movimiento. Si hay que mirarlo dos veces, está mal diseñado.
//
// 2. FRANJA ROJA DONDE ESTÁ EL PELIGRO.
//    En el borde superior de lo que se salta; en el borde inferior de lo que
//    se esquiva por debajo. Marca la línea que el cuerpo no puede cruzar.
//
// 3. EL DECORADO NUNCA COMPITE CON LA PISTA.
//    Los laterales van más apagados y más fríos que los obstáculos. Si un
//    elemento de fondo llama más la atención que un obstáculo, está mal.
//
// RENDIMIENTO: geometrías y materiales se comparten entre instancias siempre
// que se puede. Con hasta 90 papeles en pista, la diferencia entre una malla
// y cuatro son más de 200 draw calls.
// ============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CARRILES, OBSTACULOS, PALETA, TUNEL, ELEVADO } from '../config/balance.js';
import { COLOR3D } from '../config/estilo.js';
import { clonarEdificioDelCruce } from './hitos.js';

// ---------------------------------------------------------------------------
// MATERIALES
// ---------------------------------------------------------------------------

/**
 * Material sólido con emisión ajustable.
 *
 * NADA DE METAL Y MUY POCO BRILLO. Llevaba `metalness: 0.14`, y ese catorce por
 * ciento es justo lo que hacía que todo se viera de plástico: en un PBR el
 * metal tiñe el reflejo especular con el color del propio objeto y lo
 * concentra, así que cada caja tenía su lustre. Aquí no hay ni una superficie
 * metálica —son toldos, madera pintada, cartón y hormigón—, y una rugosidad
 * alta reparte ese reflejo hasta que desaparece.
 *
 * Es lo que separa el aspecto de juguete de vinilo del de figurita de plástico
 * barato: mate y de color plano, con el volumen puesto por la luz y por el
 * flatShading, no por los brillos.
 */
function mat(color, emision = 0.25, rugosidad = 0.94) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rugosidad,
    metalness: 0,
    emissive: color,
    emissiveIntensity: emision,
    flatShading: true,
  });
}

/**
 * Material de neón: emite por encima de 1 para que el bloom lo recoja. Sin ese
 * exceso, un cartel "encendido" es solo un rectángulo de color plano.
 *
 * OJO CON EL TONO. Multiplicar un color impuro por un factor alto le DESPLAZA
 * el matiz, porque el canal dominante se satura antes que los otros:
 *   #ff3355 × 2.8  →  rgb(2.8, 0.56, 0.93)  →  recortado a (1, 0.56, 0.93)
 * y eso ya no es rojo, es rosa. Por eso los colores de neón se declaran aquí
 * con los canales secundarios bajos, y la intensidad se queda en un rango que
 * no clipa por sí sola: el brillo lo pone el bloom, no la saturación.
 */
// EL ROJO DE PELIGRO ES UNO SOLO Y LATE. Todas las franjas de «esto te
// tumba» —el borde de la valla, el filo del pórtico, la X del cajón—
// comparten este material, y Game lo hace pulsar (ver pulsarPeligro). Un
// brillo fijo compite con el neón del decorado; un latido no compite con
// nada, porque en la calle no late nada más. Es lo que separa «adorno» de
// «esto es jugable» de un vistazo.
let _matPeligro = null;
function matPeligro() {
  if (!_matPeligro) {
    _matPeligro = neon(NEON.rojo, 2);
    // La marca que respetan todos los destructores: este material no es de
    // nadie en particular y no se destruye con ningún obstáculo.
    _matPeligro.userData.compartido = true;
  }
  return _matPeligro;
}

let _relojPeligro = 0;
export function pulsarPeligro(dt) {
  if (!_matPeligro) return;
  _relojPeligro += dt;
  _matPeligro.emissiveIntensity = 2.0 + Math.sin(_relojPeligro * 4.2) * 0.75;
}

function neon(color, fuerza = 1.5) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: Math.min(fuerza, 2),
    roughness: 0.3,
    toneMapped: false,
  });
}

// Versiones "puras" para neón: mismo tono percibido, pero con los canales
// secundarios lo bastante bajos como para aguantar la multiplicación.
const NEON = {
  rojo: 0xff1030,
  ambar: 0xffa000,
  cian: 0x00e5cc,
  blanco: 0xfff4d6,
};

// Caché de texturas procedurales, para no regenerarlas por instancia.
const _texturas = new Map();

function textura(clave, dibujar, ancho = 128, alto = 128) {
  if (_texturas.has(clave)) return _texturas.get(clave);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  dibujar(lienzo.getContext('2d'), ancho, alto);

  const t = new THREE.CanvasTexture(lienzo);
  t.needsUpdate = true;
  _texturas.set(clave, t);
  return t;
}

/** Franjas diagonales amarillas y negras: el lenguaje universal de "cuidado". */
function texturaChevron() {
  return textura('chevron', (ctx, w, h) => {
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16161c';
    ctx.save();
    ctx.translate(-h, 0);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 44, 0);
      ctx.lineTo(i * 44 + 22, 0);
      ctx.lineTo(i * 44 + 22 + h, h);
      ctx.lineTo(i * 44 + h, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }, 128, 64);
}

/** Tablones de madera para las cajas de embalaje. */
function texturaMadera() {
  return textura('madera', (ctx, w, h) => {
    ctx.fillStyle = '#6b4a2f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4a3220';
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (h / 4) * i);
      ctx.lineTo(w, (h / 4) * i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  });
}

/** Persiana metálica ondulada: la piel de casi todo local cerrado del país. */
function texturaPersiana() {
  return textura('persiana', (ctx, w, h) => {
    // El degradado por franja hace el relieve. Un rayado plano se lee como
    // papel pintado; lo que dice "chapa" es que cada onda tenga brillo y
    // sombra propios.
    for (let x = 0; x < w; x += 8) {
      const g = ctx.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, '#5c6068');
      g.addColorStop(0.45, '#9aa0a8');
      g.addColorStop(1, '#4a4e56');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 8, h);
    }
    // Óxido y roces. Una persiana impecable no existe en la Bahía.
    ctx.fillStyle = 'rgba(120,72,34,0.16)';
    for (let i = 0; i < 26; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 9, 1 + Math.random() * 4);
    }
  }, 128, 96);
}

/** Lona a rayas de toldo. Dos colores, franja ancha, como las de verdad. */
function texturaToldo(colorFranja = '#d94a3d') {
  return textura(`toldo-${colorFranja}`, (ctx, w, h) => {
    ctx.fillStyle = '#f2ece0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = colorFranja;
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 16, h);
  }, 128, 32);
}

/**
 * Rótulo pintado a mano. Los textos son GENÉRICOS de comercio —"AL POR MAYOR",
 * "TODO A $1"—, nunca marcas ni nombres de locales reales: el decorado ambienta
 * un mercado, no señala a un comerciante concreto.
 */
function texturaRotulo(texto, fondo = '#e8342a') {
  return textura(`rotulo-${texto}`, (ctx, w, h) => {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#fff8e6';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, w / 2, h / 2);
  }, 256, 64);
}

/**
 * Ropa colgada de una barra: camisetas, chompas y perchas.
 *
 * Va en UNA textura sobre un plano en vez de en veinte cuerpos sueltos. A los
 * seis metros que hay del carril a la vereda, una percha modelada y una percha
 * pintada se ven exactamente igual —y la pintada cuesta una malla en lugar de
 * veinte, que es la diferencia entre que la Bahía llene la vereda o que el
 * móvil no llegue a los treinta cuadros.
 */
function texturaRopaColgada(clave, paleta) {
  return textura(`ropa-${clave}`, (ctx, w, h) => {
    ctx.fillStyle = '#241d18';           // El fondo del local, en penumbra.
    ctx.fillRect(0, 0, w, h);

    // La barra de la que cuelga todo.
    ctx.fillStyle = '#8d939b';
    ctx.fillRect(0, h * 0.1, w, 5);

    const anchoPrenda = w / 7;
    for (let i = 0; i < 7; i++) {
      const x = i * anchoPrenda + anchoPrenda * 0.12;
      const ancho = anchoPrenda * 0.76;
      const alto = h * (0.42 + Math.random() * 0.3);
      const y = h * 0.12;

      // Percha.
      ctx.strokeStyle = '#c9ccd2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + ancho / 2, y);
      ctx.lineTo(x + ancho * 0.14, y + alto * 0.1);
      ctx.lineTo(x + ancho * 0.86, y + alto * 0.1);
      ctx.closePath();
      ctx.stroke();

      // Cuerpo de la prenda: un trapecio con mangas. Camiseta de fútbol,
      // chompa o polo según toque; la silueta es la misma a esta distancia.
      ctx.fillStyle = paleta[i % paleta.length];
      const yc = y + alto * 0.1;
      ctx.beginPath();
      ctx.moveTo(x + ancho * 0.18, yc);
      ctx.lineTo(x + ancho * 0.82, yc);
      ctx.lineTo(x + ancho * 0.94, yc + alto * 0.26);
      ctx.lineTo(x + ancho * 0.78, yc + alto * 0.3);
      ctx.lineTo(x + ancho * 0.8, y + alto);
      ctx.lineTo(x + ancho * 0.2, y + alto);
      ctx.lineTo(x + ancho * 0.22, yc + alto * 0.3);
      ctx.lineTo(x + ancho * 0.06, yc + alto * 0.26);
      ctx.closePath();
      ctx.fill();

      // Sombra interior: sin ella la fila se lee como recortes de cartulina.
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + ancho * 0.2, y + alto * 0.62, ancho * 0.6, alto * 0.38);
    }
  }, 256, 128);
}

/**
 * Mercadería apilada: cajas, fundas de detergente, pacas de papel higiénico.
 * La columna de producto de colores chillones subiendo hasta el techo es LA
 * imagen de la Bahía, más que el toldo o la persiana.
 */
function texturaMercaderia(variante = 0) {
  return textura(`mercaderia-${variante}`, (ctx, w, h) => {
    ctx.fillStyle = '#2a221b';
    ctx.fillRect(0, 0, w, h);

    const colores = ['#d8452f', '#f2b134', '#2e8b57', '#2f6fd0', '#e0e4e8',
      '#c73b7a', '#f07a1a'];
    let y = h;
    while (y > h * 0.06) {
      const alto = h * (0.08 + Math.random() * 0.07);
      let x = 0;
      while (x < w) {
        const ancho = w * (0.16 + Math.random() * 0.2);
        ctx.fillStyle = colores[Math.floor(Math.random() * colores.length)];
        ctx.fillRect(x + 1, y - alto + 1, ancho - 2, alto - 2);
        // Cinta de embalaje / etiqueta, para que no sea un mosaico plano.
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + ancho * 0.3, y - alto * 0.62, ancho * 0.4, alto * 0.14);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x + 1, y - 3, ancho - 2, 2);
        x += ancho;
      }
      y -= alto;
    }
  }, 128, 256);
}

// ---------------------------------------------------------------------------
// OBSTÁCULOS
// ---------------------------------------------------------------------------

/**
 * SALTAR — barrera de obra baja, con chevrones y franja roja arriba.
 * La silueta baja y ancha dice "por encima".
 */
export function crearObstaculoSaltar(colores) {
  const g = new THREE.Group();
  const alto = OBSTACULOS.ALTURA_SALTAR;
  const ancho = CARRILES.ANCHO * 0.88;

  // Panel principal con franjas diagonales.
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto * 0.66, 0.22),
    new THREE.MeshStandardMaterial({
      map: texturaChevron(),
      roughness: 0.75,
      flatShading: true,
    }),
  );
  panel.position.y = alto * 0.62;
  g.add(panel);

  // Franja roja de peligro en el borde superior: la línea que no se cruza.
  // Más gruesa que antes y con el rojo compartido que late (ver matPeligro).
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.05, 0.18, 0.3),
    matPeligro(),
  );
  franja.position.y = alto;
  g.add(franja);

  // Pies en A, como una valla de obra real.
  for (const s of [-1, 1]) {
    const pata = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, alto, 0.11),
      mat(COLOR3D.metal, 0.06),
    );
    pata.position.set(s * (ancho / 2 - 0.12), alto / 2, 0);
    g.add(pata);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.09, 0.7),
      mat(COLOR3D.metal, 0.06),
    );
    base.position.set(s * (ancho / 2 - 0.12), 0.045, 0);
    g.add(base);
  }

  // Baliza intermitente sobre la valla.
  const baliza = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 7, 5),
    neon(NEON.ambar, 1.9),
  );
  baliza.position.set(ancho / 2 - 0.12, alto + 0.14, 0);
  g.add(baliza);
  g.userData.baliza = baliza;

  g.userData.tipo = 'saltar';
  return g;
}

/**
 * AGACHAR — pórtico elevado. El hueco inferior tiene que verse vacío desde
 * lejos: si no se lee el paso, el jugador salta y choca.
 */
export function crearObstaculoAgachar(colores) {
  const g = new THREE.Group();
  const ancho = CARRILES.ANCHO * 0.92;
  const base = OBSTACULOS.ALTURA_AGACHAR_DESDE;
  const altoBarra = 1.0;

  // Barra suspendida con chevrones.
  const barra = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, altoBarra, 0.4),
    new THREE.MeshStandardMaterial({
      map: texturaChevron(),
      roughness: 0.7,
      flatShading: true,
    }),
  );
  barra.position.y = base + altoBarra / 2;
  g.add(barra);

  // Franja roja en el BORDE INFERIOR: marca la altura límite. El rojo es el
  // compartido que late: es el borde contra el que se choca.
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.05, 0.16, 0.48),
    matPeligro(),
  );
  franja.position.y = base;
  g.add(franja);

  // Tubo de neón bajo la barra: subraya el hueco por donde se pasa.
  const guia = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, ancho * 0.85, 6),
    neon(colores.acento ?? NEON.cian, 1.7),
  );
  guia.rotation.z = Math.PI / 2;
  guia.position.y = base - 0.14;
  g.add(guia);

  // Postes FUERA del ancho del carril, para no estorbar el paso.
  for (const s of [-1, 1]) {
    const poste = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, base + altoBarra, 0.13),
      mat(COLOR3D.metal, 0.08),
    );
    poste.position.set(s * (ancho / 2 + 0.08), (base + altoBarra) / 2, 0);
    g.add(poste);
  }

  g.userData.tipo = 'agachar';
  return g;
}

/**
 * ESQUIVAR — caja de embalaje con una X de neón rojo.
 * La X es un "no" universal: no se salta, no se pasa por debajo, se rodea.
 */
export function crearObstaculoEsquivar(colores) {
  const g = new THREE.Group();
  const alto = OBSTACULOS.ALTURA_ESQUIVAR;
  const ancho = CARRILES.ANCHO * 0.84;
  const fondo = OBSTACULOS.PROFUNDIDAD * 0.7;

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, fondo),
    new THREE.MeshStandardMaterial({
      map: texturaMadera(),
      roughness: 0.9,
      flatShading: true,
    }),
  );
  cuerpo.position.y = alto / 2;
  g.add(cuerpo);
  // Lo expone el vestido de escena para poder reteñirlo: en la Bahía este
  // bloque es la masa detrás de un militar, no un cajón de madera.
  g.userData.cuerpo = cuerpo;
  g.userData.fondo = fondo;

  // Refuerzos del marco.
  const matMarco = mat(0x4a3220, 0.04, 0.95);
  for (const y of [0.14, alto - 0.14]) {
    const listón = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 1.02, 0.16, fondo * 1.02),
      matMarco,
    );
    listón.position.y = y;
    g.add(listón);
  }

  // La X de neón, en la cara frontal. El rojo compartido que late.
  const matX = matPeligro();
  for (const rot of [Math.PI / 4, -Math.PI / 4]) {
    const aspa = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 1.18, 0.13, 0.07),
      matX,
    );
    aspa.position.set(0, alto * 0.52, fondo / 2 + 0.04);
    aspa.rotation.z = rot;
    g.add(aspa);
  }

  g.userData.tipo = 'esquivar';
  return g;
}

/**
 * DOBLE — el bus de simpatizantes. Ocupa dos carriles y hay que leerlo con
 * mucha antelación, así que lleva faros encendidos hacia el jugador.
 */
export function crearObstaculoDoble(colores) {
  const g = new THREE.Group();
  const alto = OBSTACULOS.ALTURA_ESQUIVAR;
  const ancho = CARRILES.ANCHO * 1.86;
  const fondo = OBSTACULOS.PROFUNDIDAD * 1.6;

  const carroceria = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, fondo),
    mat(colores.props ?? COLOR3D.metal, 0.14, 0.6),
  );
  carroceria.position.y = alto / 2 + 0.24;
  g.add(carroceria);

  // Franja de color a media altura: rompe la masa y da carácter de vehículo.
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.01, 0.28, fondo * 1.01),
    neon(colores.acento ?? COLOR3D.dorado, 1.4),
  );
  franja.position.y = alto * 0.52;
  g.add(franja);

  // Ventanas iluminadas.
  const matVentana = neon(0x9fe8ff, 1.3);
  for (let i = -1; i <= 1; i++) {
    const ventana = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 0.23, 0.46, 0.05),
      matVentana,
    );
    ventana.position.set(i * ancho * 0.29, alto * 0.82, fondo / 2 + 0.02);
    g.add(ventana);
  }

  // Faros hacia el jugador: se ven desde muy lejos y avisan del bloqueo.
  const matFaro = neon(NEON.blanco, 2);
  for (const s of [-1, 1]) {
    const faro = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), matFaro);
    faro.position.set(s * ancho * 0.36, 0.72, fondo / 2 + 0.06);
    g.add(faro);
  }

  // Parachoques.
  const parachoques = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.02, 0.22, fondo * 1.03),
    mat(0x22262f, 0.03),
  );
  parachoques.position.y = 0.34;
  g.add(parachoques);

  // Ruedas.
  const geoRueda = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
  const matRueda = mat(0x14161c, 0.02, 0.95);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const rueda = new THREE.Mesh(geoRueda, matRueda);
      rueda.rotation.z = Math.PI / 2;
      rueda.position.set(sx * ancho * 0.38, 0.3, sz * fondo * 0.32);
      g.add(rueda);
    }
  }

  g.userData.tipo = 'doble';
  return g;
}

/** Fábrica única: devuelve el prop que corresponde al tipo. */
export function crearObstaculo(tipo, colores, idEscenario = 'bahia') {
  let g;
  switch (tipo) {
    case 'saltar': g = crearObstaculoSaltar(colores); break;
    case 'agachar': g = crearObstaculoAgachar(colores); break;
    case 'doble': g = crearObstaculoDoble(colores); break;
    case 'esquivar':
    default: g = crearObstaculoEsquivar(colores); break;
  }

  vestirObstaculo(g, tipo, idEscenario, colores);
  return g;
}

// ---------------------------------------------------------------------------
// VESTIR LOS OBSTÁCULOS
// ---------------------------------------------------------------------------
// En la Bahía te cierra el paso un puesto de ropa; en la central térmica, una
// tubería reventada; en el centro histórico, una reja. Son la misma mecánica y
// tienen que serlo, pero no pueden verse igual: si las cuatro escenas usan los
// mismos cuatro objetos, el juego solo cambia de color cuatro veces.
//
// LA REGLA QUE NO SE ROMPE: la silueta base NO se toca. Lo que se salta se
// sigue leyendo bajo y ancho, lo que se esquiva sigue siendo un bloque macizo,
// y la franja roja sigue donde está el peligro. Encima de esa silueta se
// añaden dos o tres piezas que dicen QUÉ es. Vestir, no rediseñar —el jugador
// tiene medio segundo para leerlo y ese medio segundo lo compra la silueta.

/** Percha con prendas colgando. La Bahía es ropa antes que nada. */
function _ropaTendida(g, altura, ancho) {
  const colores = [0xd94f6a, 0x4fd1ff, 0xffd94f, 0x7cffb2];
  for (let i = 0; i < 4; i++) {
    const prenda = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.42, 0.05),
      mat(colores[i % colores.length], 0.22, 0.85),
    );
    prenda.position.set(-ancho * 0.32 + i * (ancho * 0.21), altura - 0.24, 0.28);
    prenda.rotation.z = (i % 2 ? 1 : -1) * 0.07;
    g.add(prenda);
  }
}

/**
 * Aplica el vestido de la escena.
 *
 * @param {THREE.Group} g Obstáculo ya construido
 * @param {string} tipo   saltar | agachar | esquivar | doble
 * @param {string} esc    Id de la escena
 */
export function vestirObstaculo(g, tipo, esc, colores) {
  const ancho = CARRILES.ANCHO * 0.88;

  // --- LA BAHÍA: venta ambulante -----------------------------------------
  if (esc === 'bahia') {
    if (tipo === 'saltar') {
      // Mesa de tablones con su percha y la ropa colgada.
      const tablero = new THREE.Mesh(
        new THREE.BoxGeometry(ancho * 1.04, 0.12, 0.8),
        new THREE.MeshStandardMaterial({ map: texturaMadera(), roughness: 0.85, flatShading: true }),
      );
      tablero.position.y = OBSTACULOS.ALTURA_SALTAR * 0.92;
      g.add(tablero);
      _ropaTendida(g, OBSTACULOS.ALTURA_SALTAR * 0.92, ancho);
      return;
    }
    if (tipo === 'agachar') {
      // Toldo con electrodomésticos colgando del travesaño.
      const toldo = new THREE.Mesh(
        new THREE.BoxGeometry(ancho * 1.15, 0.1, 1.5),
        mat(0xd94f6a, 0.2, 0.85),
      );
      toldo.position.y = OBSTACULOS.ALTURA_AGACHAR_DESDE + 1.15;
      g.add(toldo);

      for (let i = -1; i <= 1; i++) {
        const aparato = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.3, 0.26),
          mat(0xb9c6d4, 0.16, 0.5),
        );
        aparato.position.set(i * 0.7, OBSTACULOS.ALTURA_AGACHAR_DESDE + 0.42, 0.35);
        g.add(aparato);
      }
      return;
    }
    if (tipo === 'esquivar') {
      // Militar: casco, chaleco y el fusil cruzado. Si lo tocas, te capturan.
      _figuraDeUniforme(g, 0x4a5240, 0x2f3626);
      return;
    }
    return;
  }

  // --- EL APAGÓN: central térmica ----------------------------------------
  if (esc === 'apagon') {
    if (tipo === 'saltar') {
      // Tubería reventada, con su brida y el chorro de vapor.
      const tubo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, ancho * 1.1, 10),
        mat(0x6b7280, 0.08, 0.6),
      );
      tubo.rotation.z = Math.PI / 2;
      tubo.position.y = OBSTACULOS.ALTURA_SALTAR * 0.75;
      g.add(tubo);

      for (const sx of [-0.5, 0.5]) {
        const brida = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10),
          mat(0x8a94a6, 0.1, 0.5),
        );
        brida.rotation.z = Math.PI / 2;
        brida.position.set(sx * ancho * 0.5, OBSTACULOS.ALTURA_SALTAR * 0.75, 0);
        g.add(brida);
      }
      return;
    }
    if (tipo === 'agachar') {
      // Cable de alta tensión con sus aisladores y un chispazo.
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, ancho * 1.2, 6),
        mat(0x16181f, 0.04, 0.9),
      );
      cable.rotation.z = Math.PI / 2;
      cable.position.y = OBSTACULOS.ALTURA_AGACHAR_DESDE + 0.24;
      g.add(cable);

      const chispa = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 7, 6),
        neon(0x9fe8ff, 2),
      );
      chispa.position.set(0.35, OBSTACULOS.ALTURA_AGACHAR_DESDE + 0.24, 0.2);
      g.add(chispa);
      return;
    }
    if (tipo === 'esquivar') {
      // Generador parado: carcasa, rejilla de ventilación y piloto en rojo.
      // El generador ES el bloque: en vez de añadir uno delante, se reteñe el
      // que ya está y se le pone la chapa por fuera.
      if (g.userData.cuerpo) {
        g.userData.cuerpo.material = mat(0x5a6270, 0.06, 0.7);
      }
      const zf = (g.userData.fondo ?? 1.5) / 2 + 0.05;

      for (let i = 0; i < 5; i++) {
        const rejilla = new THREE.Mesh(
          new THREE.BoxGeometry(ancho * 0.72, 0.09, 0.07),
          mat(0x2a3040, 0.03, 0.9),
        );
        rejilla.position.set(0, 0.5 + i * 0.24, zf);
        g.add(rejilla);
      }

      const piloto = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 6), neon(NEON.rojo, 2));
      piloto.position.set(ancho * 0.3, 2.1, zf);
      g.add(piloto);
      return;
    }
    return;
  }

  // --- CENTRO HISTÓRICO: el cerco ----------------------------------------
  if (esc === 'carondelet') {
    if (tipo === 'saltar') {
      // Reja de contención: barrotes verticales y travesaños.
      const matReja = mat(0x8a94a6, 0.1, 0.6);
      for (let i = 0; i < 7; i++) {
        const barrote = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, OBSTACULOS.ALTURA_SALTAR * 0.9, 0.07),
          matReja,
        );
        barrote.position.set(-ancho * 0.45 + i * (ancho * 0.15), OBSTACULOS.ALTURA_SALTAR * 0.5, 0.12);
        g.add(barrote);
      }
      for (const y of [0.35, 0.95]) {
        const travesano = new THREE.Mesh(
          new THREE.BoxGeometry(ancho * 1.0, 0.08, 0.08),
          matReja,
        );
        travesano.position.set(0, y, 0.12);
        g.add(travesano);
      }
      return;
    }
    if (tipo === 'agachar') {
      // Alambre de púas: rollos de concertina tendidos a media altura.
      for (let i = -1; i <= 1; i++) {
        const rollo = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.05, 4, 10),
          mat(0x9aa4b8, 0.28, 0.4),
        );
        rollo.position.set(i * 0.75, OBSTACULOS.ALTURA_AGACHAR_DESDE + 0.45, 0);
        rollo.rotation.y = Math.PI / 2;
        g.add(rollo);
      }
      return;
    }
    if (tipo === 'esquivar') {
      // Antimotines: uniforme oscuro, casco y escudo por delante.
      _figuraDeUniforme(g, 0x232838, 0x161a26, true);
      return;
    }
    return;
  }

  // --- ELECCIONES: campaña -----------------------------------------------
  if (esc === 'elecciones') {
    if (tipo === 'saltar') {
      // Valla de campaña: panel liso con la franja del partido.
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(ancho * 1.02, OBSTACULOS.ALTURA_SALTAR * 0.7, 0.08),
        mat(colores.acento ?? 0xff5fa2, 0.3, 0.6),
      );
      panel.position.set(0, OBSTACULOS.ALTURA_SALTAR * 0.6, 0.16);
      g.add(panel);

      for (let i = 0; i < 3; i++) {
        const franja = new THREE.Mesh(
          new THREE.BoxGeometry(ancho * 0.7, 0.08, 0.04),
          mat(0xf2f2f2, 0.3, 0.5),
        );
        franja.position.set(0, OBSTACULOS.ALTURA_SALTAR * 0.42 + i * 0.18, 0.21);
        g.add(franja);
      }
      return;
    }
    if (tipo === 'agachar') {
      // Pancarta colgante, con sus cuerdas.
      const tela = new THREE.Mesh(
        new THREE.BoxGeometry(ancho * 1.05, 0.9, 0.05),
        mat(colores.acento ?? 0xff5fa2, 0.28, 0.75),
      );
      tela.position.y = OBSTACULOS.ALTURA_AGACHAR_DESDE + 0.6;
      g.add(tela);

      for (const sx of [-0.45, 0.45]) {
        const cuerda = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5),
          mat(0xd8d2c4, 0.1, 0.8),
        );
        cuerda.position.set(sx * ancho, OBSTACULOS.ALTURA_AGACHAR_DESDE + 1.5, 0);
        g.add(cuerda);
      }
      return;
    }
    if (tipo === 'esquivar') {
      // Cartón del candidato: silueta plana de tamaño natural, y su fan
      // revolcándose al pie. El cartón es lo que bloquea; la fan es el chiste.
      const zc = (g.userData.fondo ?? 1.5) / 2 + 0.14;
      if (g.userData.cuerpo) {
        g.userData.cuerpo.material = mat(0x1e2333, 0.03, 0.9);
      }

      const carton = new THREE.Mesh(
        new THREE.BoxGeometry(ancho * 0.78, 2.4, 0.08),
        mat(0xe8e2d4, 0.24, 0.7),
      );
      carton.position.set(0, 1.32, zc);
      g.add(carton);

      const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat(0xe0b088, 0.22, 0.6));
      cabeza.position.set(0, 2.2, zc + 0.08);
      g.add(cabeza);

      const traje = new THREE.Mesh(
        new THREE.BoxGeometry(ancho * 0.54, 1.15, 0.06),
        mat(0x2a3550, 0.16, 0.6),
      );
      traje.position.set(0, 1.3, zc + 0.08);
      g.add(traje);

      // La fan, revolcándose al pie del cartón. No estorba: es el chiste.
      const fan = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.24, 0.72, 3, 7),
        mat(0x7b3fb5, 0.2, 0.7),
      );
      fan.rotation.z = Math.PI / 2;
      fan.position.set(0.15, 0.26, zc + 0.72);
      g.add(fan);
      g.userData.fan = fan;
      return;
    }
  }
}

/**
 * Figura de uniforme para los bloqueos de carril. Cambia el color y si lleva
 * escudo; el resto es el mismo cuerpo, porque lo que tiene que leerse a
 * distancia es «hay una persona ahí y no se pasa».
 */
function _figuraDeUniforme(g, colorRopa, colorOscuro, conEscudo = false) {
  // OJO CON LA PROFUNDIDAD. El bloque base mide 2.6 de alto por 1.5 de fondo:
  // una figura puesta en el centro del grupo queda DENTRO de él y no se ve
  // nada. Va delante, sobre la cara que mira al jugador.
  const z = (g.userData.fondo ?? 1.5) / 2 + 0.28;

  // Y el bloque de detrás se reteñe: deja de ser un cajón de madera y pasa a
  // ser la masa oscura contra la que se recorta la figura.
  if (g.userData.cuerpo) {
    g.userData.cuerpo.material = mat(colorOscuro, 0.03, 0.9);
  }

  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.42), mat(colorRopa, 0.12, 0.75));
  cuerpo.position.set(0, 1.32, z);
  g.add(cuerpo);

  const piernas = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.9, 0.36), mat(colorOscuro, 0.06, 0.8));
  piernas.position.set(0, 0.44, z);
  g.add(piernas);

  const casco = new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 6), mat(colorOscuro, 0.08, 0.7));
  casco.position.set(0, 2.0, z);
  g.add(casco);

  const visera = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.06), neon(0x6fd8ff, 1.4));
  visera.position.set(0, 1.98, z + 0.26);
  g.add(visera);

  if (conEscudo) {
    const escudo = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 1.3, 0.07),
      new THREE.MeshStandardMaterial({
        color: 0x8fa6c4, transparent: true, opacity: 0.45, roughness: 0.25, metalness: 0.2,
      }),
    );
    escudo.position.set(0, 1.15, z + 0.3);
    g.add(escudo);
  } else {
    // Fusil cruzado al pecho.
    const fusil = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.1), mat(0x16181f, 0.04, 0.85));
    fusil.position.set(0, 1.24, z + 0.26);
    fusil.rotation.z = -0.5;
    g.add(fusil);
  }
}

// ---------------------------------------------------------------------------
// RECOLECTABLES
// ---------------------------------------------------------------------------

// Compartidos por todas las instancias.
let _geoEvidencia = null;
let _matCara = null;
let _matCanto = null;
let _texHalo = null;
let _matHalo = null;

// El halo se apaga en calidad baja: son 340 sprites más en pista y el
// subsistema ya es el que más duele en el reguero del trámite.
let _haloEncendido = true;

/** Enciende o apaga el halo de los papeles. Lo llama el detector de calidad. */
export function ajustarHaloEvidencia(encendido) {
  _haloEncendido = !!encendido;
}

/**
 * PAPEL — la moneda. Un disco grueso que gira sobre su eje vertical.
 *
 * ERA UNA LOSA de 0.05 de canto, y una losa tiene un problema que no se ve
 * hasta que la miras girar: DESAPARECE DOS VECES POR VUELTA. Al pasar de perfil
 * quedan cinco centímetros de nada, y como toda la hilera giraba con la misma
 * fase, la fila entera parpadeaba a la vez. Eso no se lee como monedas girando,
 * se lee como un fallo de dibujado.
 *
 * Ahora es un cilindro de 0.14 de grosor —el 16 % del diámetro, que es lo que
 * hace legible el canto— con la cara y el canto de distinto valor: el canto va
 * un 45 % más oscuro, que es lo que en la referencia distingue el borde
 * moleteado de la cara. Los 20 segmentos radiales dan esas muescas.
 *
 * El `rotateX` va HORNEADO EN LA GEOMETRÍA y no en `mesh.rotation.x`: el bucle
 * de Coin.js reescribe `rotation.y` cada fotograma y una rotación de malla en X
 * pelearía con él.
 *
 * Sigue siendo UNA malla más un sprite: los renglones van en textura en vez de
 * ser geometría, que a la velocidad del juego se ve igual y ahorra tres draw
 * calls por papel.
 */
export function crearEvidencia() {
  if (!_geoEvidencia) {
    // Diámetro 0.86, el mismo de siempre: no toca ni la separación de la
    // hilera ni las cajas de recogida. Lo que cambia es el canto.
    // ES UN PAPEL, NO UNA MONEDA. Estuvo un rato siendo un disco dorado y era
    // más legible, pero también era otro juego: aquí lo que se recoge son
    // EXPEDIENTES, y una moneda de oro rodando por la Bahía convierte al
    // periodista en un fontanero italiano. Lo que se llevó de la moneda es lo
    // que hacía falta —el CANTO— porque una hoja de cinco centímetros
    // desaparece dos veces por vuelta y la fila entera parpadea.
    //
    // Doce centímetros de canto es un legajo, no un folio: se lee como un
    // taco de papeles grapado, se ve de perfil, y de paso justifica que valga
    // algo. Un poco más ancho que alto, que es como se ve un documento
    // apaisado en una mesa.
    _geoEvidencia = new THREE.BoxGeometry(0.84, 0.94, 0.12);

    const tex = textura('papel', (ctx, w, h) => {
      ctx.fillStyle = '#ffd94f';
      ctx.fillRect(0, 0, w, h);
      // Membrete
      ctx.fillStyle = '#8a6d1f';
      ctx.fillRect(w * 0.18, h * 0.13, w * 0.64, h * 0.06);
      // Renglones
      for (let i = 0; i < 5; i++) {
        const y = h * (0.3 + i * 0.11);
        const ancho = i === 4 ? 0.4 : 0.64;
        ctx.fillRect(w * 0.18, y, w * ancho, h * 0.035);
      }
      // EL SELLO, GRANDE Y CENTRADO. Estaba pequeño y en una esquina, y a
      // treinta metros no se veía nada: la cara quedaba lisa y el giro no se
      // leía. En la referencia la cara lleva una marca central clara que ocupa
      // casi la mitad del disco, y es esa marca la que hace visible la vuelta.
      // Aquí es el sello del expediente, que además es lo que el papel ES.
      const cx = w * 0.5, cy = h * 0.52, r = w * 0.21;
      ctx.strokeStyle = 'rgba(197,59,43,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
      ctx.stroke();
    }, 64, 80);

    // El canto del legajo: crema pálido, sin textura y con más rugosidad. Es
    // el borde de las hojas apiladas, y es lo que hace que de perfil se siga
    // viendo un objeto en vez de una raya.
    _matCanto = new THREE.MeshStandardMaterial({
      color: 0xf2e6c2,
      emissive: COLOR3D.dorado,
      emissiveIntensity: 0.38,
      roughness: 0.85,
      flatShading: true,
    });

    _matCara = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: COLOR3D.dorado,
      // 0.55 de base. Estuvo en 0.85 para que el reguero le ganase el ojo al
      // decorado, y le ganaba de más: los papeles salían resplandecientes,
      // como si cada uno fuera un potenciador. Lo que los tiene que hacer
      // visibles es su TAMAÑO, su separación y su halo, no que brillen.
      emissiveIntensity: 0.55,
      roughness: 0.4,
      flatShading: true,
    });

    // El halo. Es lo que hace visible la pieza a treinta metros, donde el disco
    // mide cuatro píxeles, y lo que tapa el hueco cuando pasa de canto.
    _texHalo = textura('halo-papel', (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      // Cálido y SUAVE. A 0.55 en el centro, sobre un cielo claro y en
      // aditivo, el halo se quemaba a blanco y la moneda desaparecía dentro de
      // su propio resplandor. La referencia tiene halo, no farola.
      g.addColorStop(0, 'rgba(255,190,50,0.34)');
      g.addColorStop(0.4, 'rgba(255,180,40,0.13)');
      g.addColorStop(1, 'rgba(255,170,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, 64, 64);

    _matHalo = new THREE.SpriteMaterial({
      map: _texHalo,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      transparent: true,
    });
  }

  // El orden de materiales de BoxGeometry es [+x, -x, +y, -y, +z, -z]: los
  // cuatro cantos van con el borde de las hojas y las dos caras con el
  // documento.
  const papel = new THREE.Mesh(_geoEvidencia,
    [_matCanto, _matCanto, _matCanto, _matCanto, _matCara, _matCara]);
  papel.userData.tipo = 'papel';

  if (_haloEncendido) {
    const halo = new THREE.Sprite(_matHalo);
    halo.scale.setScalar(1.85);
    papel.add(halo);
    papel.userData.halo = halo;
  }

  return papel;
}

/**
 * Sube o baja el brillo de TODOS los papeles a la vez.
 *
 * Es lo que sostiene el Apagón desde que la linterna pasó a ser potenciador.
 * Sin luz y sin nada que brille, quedarse a oscuras era quedarse ciego, y de
 * ahí a chocar contra lo primero hay un segundo. Con los papeles encendidos
 * sigue sin verse la calle —eso lo paga la linterna— pero se ve POR DÓNDE va:
 * la hilera dibuja la ruta, que es justo lo que un reguero de monedas hace en
 * cualquier runner, solo que aquí además significa algo.
 *
 * Los materiales son dos —cara y canto— y están compartidos por las tres mil
 * piezas de la pista, así que esto son dos escrituras, no tres mil. Escribir
 * solo en la cara dejaba el canto apagado y en el Apagón se encendía media
 * moneda.
 *
 * @param {number} intensidad   Emisión. ~0.55 con luz, ~2 a oscuras.
 * @param {boolean} atraviesaNiebla
 *   Si es true el papel ignora la niebla. En el Apagón hace falta: con niebla
 *   los de más allá de veinte metros se funden con el negro y la ruta se corta
 *   justo donde hay que mirar. En el resto de escenas estorbaría, porque un
 *   objeto que no se funde con el fondo se lee como pegatina.
 */
export function ajustarBrilloEvidencia(intensidad, atraviesaNiebla = false) {
  if (!_matCara) crearEvidencia();
  for (const m of [_matCara, _matCanto]) {
    m.emissiveIntensity = intensidad;
    m.fog = !atraviesaNiebla;
    m.toneMapped = !atraviesaNiebla;
    m.needsUpdate = true;
  }
  // Con la emisión alta del Apagón, un halo aditivo encima se quema a blanco y
  // el reguero pasa de guiar a deslumbrar. Se baja a la mitad.
  if (_matHalo) _matHalo.opacity = intensidad > 1.2 ? 0.45 : 1;
}

/**
 * PRUEBAS — la gema. Un USB con carcasa naranja, conector metálico y
 * halo pulsante. Vale mucho más que un papel y tiene que notarse.
 */
export function crearPrueba() {
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.42, 0.13),
    mat(0x1c2230, 0.04, 0.55),
  );
  g.add(cuerpo);

  const etiqueta = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.18, 0.15),
    neon(COLOR3D.naranja, 1.7),
  );
  etiqueta.position.y = -0.04;
  g.add(etiqueta);

  const conector = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.2, 0.07),
    mat(0xb9c6d4, 0.25, 0.35),
  );
  conector.position.y = 0.28;
  g.add(conector);

  // HALO SUAVE, NO JAULA DE ALAMBRE. Era un octaedro en wireframe de 0.48 —o
  // sea 0.30 del ancho de pantalla, MÁS grande que un potenciador— y una
  // rejilla dura alrededor de un objeto pequeño no lo destaca: lo esconde
  // dentro de una caja. La referencia usa un resplandor difuso, y de paso esto
  // devuelve la jerarquía que se había perdido: moneda < prueba < potenciador.
  // EL MISMO MECANISMO QUE EL POTENCIADOR, y casi el mismo tamaño: la prueba
  // es lo segundo más valioso de la pista y tiene que avisar desde igual de
  // lejos. Antes era una jaula de alambre de 0.48 que a veinte metros se leía
  // como suciedad en la lente.
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({
      map: texturaEstallido(COLOR3D.naranja),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
      toneMapped: false,
    }),
  );
  halo.position.z = -0.25;
  g.add(halo);

  // Y luz propia, como la cápsula. Sin ella la prueba es una calcomanía
  // pegada al aire: no tiñe el suelo de debajo y el ojo la descarta como HUD.
  g.add(new THREE.PointLight(COLOR3D.naranja, 3.2, 5.2, 2));

  g.userData.tipo = 'evidencia';
  g.userData.halo = halo;
  // Un cuarto más grande: es el objeto que arma el reportaje y compite en
  // pantalla con obstáculos de dos metros. El manager solo escala el halo,
  // así que la escala del grupo se conserva.
  g.scale.setScalar(1.25);
  return g;
}

// ---------------------------------------------------------------------------
// LOS ÍTEMS DE COMIDA YA NO ESTÁN
// ---------------------------------------------------------------------------
// Aquí vivían el encebollado, la guata, el bolón, el canelazo, el micrófono y
// la pila: unas seiscientas líneas de modelos con su vaho, su cuchara y su
// espuma, y estaban muy bien hechos.
//
// Se fueron con la barra de aguante. Sin barra, la comida era un bonus suelto
// que sumaba papeles y nada más, y lo único que hacía de verdad era competir
// por el hueco del grupo con los potenciadores, que sí cambian cómo se juega.
// De todo aquello sobrevive la LINTERNA, que dejó de ser comida para ser el
// potenciador del Apagón (ver insigniaLinterna, más abajo).
//
// Están en el historial de git si algún día vuelve una mecánica que los pida.

// ---------------------------------------------------------------------------
// POTENCIADORES
// ---------------------------------------------------------------------------
// Cinco objetos, cinco siluetas distintas. La regla es la misma que con la
// estamina, pero más estricta todavía: un potenciador sale una vez cada varios
// cientos de metros, así que el jugador tiene que reconocerlo de lejos y
// decidir si merece la pena cambiarse de carril para ir a por él. Si duda,
// llegó tarde.
//
// Van todos dentro de un rombo de cristal —la "cápsula"— que es lo que dice
// «esto no es un papel, esto es un potenciador». El objeto de dentro dice cuál.

/** Cápsula común: rombo translúcido, aro y resplandor. */
function capsulaPotenciador(color) {
  const g = new THREE.Group();

  // ══ EL ESTALLIDO RADIAL ══
  //
  // Es LO QUE FALTABA. En la referencia el power-up es, con diferencia, lo más
  // brillante del cuadro: no por su tamaño sino porque lleva detrás un abanico
  // de rayos que ocupa medio ancho de pantalla y que se ve venir desde el
  // fondo. Aquí lo más brillante eran las franjas de peligro de los
  // obstáculos, o sea que lo que más llamaba la atención era lo que hay que
  // esquivar y no lo que hay que coger.
  //
  // Va encarado a cámara (`PowerUps.actualizar` lo orienta cada fotograma): un
  // plano fijo se ve de canto a treinta metros y desaparece justo cuando más
  // falta hace verlo.
  // 3.4 y no 2.35. Medido en pantalla, 2.35 daba un estallido de 0.38 del
  // ancho: se veía, pero no se veía DESDE LEJOS, que es de lo que se trata.
  // Tienes que decidir a treinta metros si te cambias de carril a por él, y
  // para eso el aviso tiene que llegar antes que el objeto.
  const estallido = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({
      map: texturaEstallido(color),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    }),
  );
  estallido.position.z = -0.35;
  g.add(estallido);

  const cristal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.72, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      // Subido de 0.35 a 1.2 y de 0.24 a 0.42 de opacidad: la jaula tiene que
      // leerse como un objeto encendido, no como un cristal apagado.
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.42,
      roughness: 0.15,
      metalness: 0.3,
      flatShading: true,
    }),
  );
  g.add(cristal);

  const aro = new THREE.Mesh(
    new THREE.TorusGeometry(0.66, 0.055, 6, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false }),
  );
  aro.rotation.x = Math.PI / 2;
  g.add(aro);

  const peana = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 20),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false,
    }),
  );
  peana.rotation.x = -Math.PI / 2;
  peana.position.y = -1.5;
  g.add(peana);

  // QUE ILUMINE. Sin luz propia, la cápsula se lee como una calcomanía pegada
  // al aire: no tiñe el asfalto de debajo ni las cajas de al lado, y el ojo la
  // descarta como parte del HUD. Cuesta cero: nunca hay más de un potenciador
  // vivo a la vez, porque salen cada 320 m y se ven desde 220.
  const farol = new THREE.PointLight(color, 4.5, 6.5, 2);
  g.add(farol);

  g.userData.aro = aro;
  g.userData.cristal = cristal;
  g.userData.estallido = estallido;
  g.userData.peana = peana;
  g.userData.farol = farol;
  return g;
}

// Los estallidos se cachean por color: hay seis potenciadores y seis texturas,
// no una por aparición.
const _texEstallido = new Map();

/**
 * El abanico de rayos que va detrás de un potenciador. Catorce rayos
 * alternando blanco y el color del catálogo, con el alfa cayendo del centro al
 * borde para que el plano no se recorte en un cuadrado.
 */
function texturaEstallido(color) {
  const clave = `estallido-${color}`;
  if (_texEstallido.has(clave)) return _texEstallido.get(clave);

  const tex = textura(clave, (ctx, w, h) => {
    const cx = w / 2, cy = h / 2, r = w / 2;
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    const RAYOS = 14;

    for (let i = 0; i < RAYOS; i++) {
      const a0 = (i / RAYOS) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2 / RAYOS) * 0.55;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, i % 2 ? 'rgba(255,255,255,1)' : `${hex}ff`);
      grad.addColorStop(0.35, i % 2 ? 'rgba(255,255,255,0.8)' : `${hex}c0`);
      grad.addColorStop(0.7, i % 2 ? 'rgba(255,255,255,0.3)' : `${hex}50`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fill();
    }

    // El núcleo, para que el centro no se vea hueco entre rayo y rayo.
    const nucleo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.62);
    nucleo.addColorStop(0, 'rgba(255,255,255,1)');
    nucleo.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    nucleo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = nucleo;
    ctx.fillRect(0, 0, w, h);
  }, 256, 256);

  _texEstallido.set(clave, tex);
  return tex;
}

/** IMÁN — "Fuente anónima". La herradura de siempre, que se lee al instante. */
function insigniaIman(color) {
  const g = new THREE.Group();
  const matCuerpo = neon(color, 1.7);

  const arco = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.075, 6, 14, Math.PI),
    matCuerpo,
  );
  arco.rotation.z = Math.PI;
  g.add(arco);

  for (const s of [-1, 1]) {
    const pata = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.14), matCuerpo);
    pata.position.set(s * 0.2, 0.08, 0);
    g.add(pata);

    const punta = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.09, 0.15),
      neon(s < 0 ? NEON.rojo : NEON.blanco, 1.9),
    );
    punta.position.set(s * 0.2, 0.2, 0);
    g.add(punta);
  }

  g.position.y = -0.08;
  return g;
}

/** PORTADA — "×2". El multiplicador, escrito tal cual. */
function insigniaPortada(color) {
  const g = new THREE.Group();

  const tex = textura('pot:x2', (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1220';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffcf3f';
    ctx.font = `900 ${Math.round(h * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×2', w / 2, h / 2 + 2);
  }, 96, 96);

  const placa = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.08),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      // 0.6 en vez de 0.95: una prueba es un papel importante, no una linterna.
      emissiveIntensity: 0.6,
      roughness: 0.35,
      toneMapped: false,
    }),
  );
  g.add(placa);

  const borde = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.04, 5, 4),
    neon(color, 1.8),
  );
  borde.rotation.z = Math.PI / 4;
  g.add(borde);

  return g;
}

/** BOTAS — "Botas de campo". Bota de caña alta con suela marcada. */
function insigniaBotas(color) {
  const g = new THREE.Group();

  const cana = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.2), mat(0x3f3222, 0.14, 0.7));
  cana.position.y = 0.06;
  g.add(cana);

  const pie = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.42), mat(0x3f3222, 0.14, 0.7));
  pie.position.set(0, -0.2, 0.1);
  g.add(pie);

  const suela = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.46), neon(color, 1.8));
  suela.position.set(0, -0.3, 0.1);
  g.add(suela);

  // Cordones: dos trazos claros que rompen el marrón sobre marrón.
  for (let i = 0; i < 3; i++) {
    const cordon = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.03), mat(0xe8e0cc, 0.3, 0.5));
    cordon.position.set(0, 0.16 - i * 0.11, 0.11);
    g.add(cordon);
  }

  return g;
}

/** SALVOCONDUCTO — un sello oficial. Aguanta un golpe. */
function insigniaSalvoconducto(color) {
  const g = new THREE.Group();

  const hoja = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.54, 0.05),
    mat(0xf0ead8, 0.32, 0.5),
  );
  g.add(hoja);

  const sello = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.045, 6, 16),
    neon(color, 1.9),
  );
  sello.position.set(0.06, -0.1, 0.05);
  g.add(sello);

  for (let i = 0; i < 3; i++) {
    const renglon = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.035, 0.02),
      mat(0x8a8270, 0.1, 0.6),
    );
    renglon.position.set(-0.02, 0.17 - i * 0.1, 0.04);
    g.add(renglon);
  }

  return g;
}

/** COBERTURA AÉREA — el dron de prensa, en miniatura. */
function insigniaCobertura(color) {
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.12, 0.28),
    mat(0x2a3242, 0.1, 0.5),
  );
  g.add(cuerpo);

  const lente = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 6), neon(color, 2));
  lente.position.y = -0.11;
  g.add(lente);

  const matHelice = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.75, toneMapped: false,
  });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const brazo = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.035, 0.035),
        mat(0x5a6274, 0.06, 0.7),
      );
      brazo.position.set(sx * 0.16, 0.02, sz * 0.16);
      brazo.rotation.y = sx * sz * 0.78;
      g.add(brazo);

      const pala = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.06), matHelice);
      pala.position.set(sx * 0.26, 0.06, sz * 0.26);
      g.add(pala);
    }
  }

  return g;
}

/**
 * Insignia de la LINTERNA, el potenciador del Apagón.
 *
 * Es la única que emite luz de verdad y no solo la finge con material
 * emisivo: en un escenario a oscuras, una cápsula que brilla pero no alumbra
 * nada se lee como una calcomanía pegada al aire. Con un punto de luz de
 * alcance corto, el asfalto de alrededor se enciende y la cápsula pasa a estar
 * EN la escena.
 */
function insigniaLinterna(color) {
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.3, 8),
    mat(0x2a3242, 0.08, 0.5),
  );
  cuerpo.rotation.x = Math.PI / 2;
  g.add(cuerpo);

  const cabeza = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.09, 0.12, 8),
    mat(0x4a5262, 0.08, 0.45),
  );
  cabeza.rotation.x = -Math.PI / 2;
  cabeza.position.z = 0.2;
  g.add(cabeza);

  const lente = new THREE.Mesh(new THREE.CircleGeometry(0.115, 10), neon(color, 2));
  lente.position.z = 0.262;
  g.add(lente);

  g.add(new THREE.PointLight(color, 6, 5.5, 2));
  return g;
}

const INSIGNIAS = {
  iman: insigniaIman,
  portada: insigniaPortada,
  botas: insigniaBotas,
  salvoconducto: insigniaSalvoconducto,
  cobertura: insigniaCobertura,
  linterna: insigniaLinterna,
};

/**
 * POTENCIADOR completo: cápsula + insignia.
 * @param {string} id    Clave del catálogo (ver config/balance.js)
 * @param {number} color Color del potenciador
 */
// Cuánto hay que escalar cada insignia para que las seis midan lo mismo en
// pantalla. Estaban dibujadas a su aire —de 0.25 de ancho las botas a 0.76 la
// portada, o sea un factor tres entre la más pequeña y la más grande— y el
// resultado era que el mismo objeto de juego se leía enorme o diminuto según
// cuál te tocara. La referencia las pone todas al mismo cuerpo, ≈0.25 del
// ancho de pantalla, porque lo que importa es reconocer QUÉ es, no cuál.
const ESCALA_INSIGNIA = {
  botas: 4.2,
  linterna: 3.9,
  salvoconducto: 2.5,
  iman: 1.9,
  portada: 1.4,
  cobertura: 1.4,
};

export function crearPotenciador(id, color) {
  const g = capsulaPotenciador(color);

  const constructor = INSIGNIAS[id] ?? insigniaIman;
  const insignia = constructor(color);
  insignia.scale.setScalar(ESCALA_INSIGNIA[id] ?? 2);
  g.add(insignia);

  g.userData.tipo = 'potenciador';
  g.userData.id = id;
  g.userData.insignia = insignia;
  return g;
}

// ---------------------------------------------------------------------------
// DECORADO LATERAL
// ---------------------------------------------------------------------------

/** Palmera low-poly. El acento tropical que sitúa el juego. */
function crearPalmera(altura = 6) {
  const g = new THREE.Group();

  // Tronco con ligera curva: una palmera recta parece un poste.
  const segmentos = 5;
  for (let i = 0; i < segmentos; i++) {
    const t = i / segmentos;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 - t * 0.05, 0.18 - t * 0.05, altura / segmentos, 6),
      mat(0x5a4432, 0.03, 0.95),
    );
    seg.position.set(Math.sin(t * 1.5) * 0.35, (altura / segmentos) * (i + 0.5), 0);
    seg.rotation.z = -Math.sin(t * 1.5) * 0.18;
    g.add(seg);
  }

  // Hojas.
  const copaX = Math.sin(1.5) * 0.35;
  const matHoja = mat(0x1f7a4d, 0.14, 0.85);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.3, 4), matHoja);
    hoja.position.set(
      copaX + Math.cos(ang) * 0.85,
      altura - 0.15,
      Math.sin(ang) * 0.85,
    );
    hoja.rotation.z = Math.cos(ang) * 1.15;
    hoja.rotation.x = Math.sin(ang) * 1.15;
    g.add(hoja);
  }

  const coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), mat(0x4a3220, 0.02));
  coco.position.set(copaX, altura - 0.35, 0.2);
  g.add(coco);

  return g;
}

/** Poste de luz con farola encendida. */
function crearFarola(color = 0xffd28a) {
  const g = new THREE.Group();

  const poste = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.11, 7, 6),
    mat(0x2a2f3d, 0.03, 0.9),
  );
  poste.position.y = 3.5;
  g.add(poste);

  const brazo = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.1, 0.1),
    mat(0x2a2f3d, 0.03),
  );
  brazo.position.set(-0.7, 6.9, 0);
  g.add(brazo);

  const lampara = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.28),
    neon(color, 1.8),
  );
  lampara.position.set(-1.4, 6.8, 0);
  g.add(lampara);

  // Halo alrededor de la lámpara: sugiere la luz sin coste de iluminación real.
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 7, 6),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      toneMapped: false,
    }),
  );
  halo.position.copy(lampara.position);
  g.add(halo);

  return g;
}

/** Valla publicitaria de neón. El chiste visual va en el color, no en el texto. */
function crearValla(colorAcento, aleatorio) {
  const g = new THREE.Group();
  const altoPoste = 4.5 + aleatorio() * 1.5;

  for (const s of [-1, 1]) {
    const poste = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, altoPoste, 0.18),
      mat(0x2a2f3d, 0.03, 0.9),
    );
    poste.position.set(s * 1.3, altoPoste / 2, 0);
    g.add(poste);
  }

  // Panel oscuro de fondo.
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.1, 0.14),
    mat(0x14161f, 0.02, 0.9),
  );
  panel.position.y = altoPoste + 0.9;
  g.add(panel);

  // Marco de neón.
  const matNeon = neon(colorAcento, 1.8);
  const marco = [
    [3.6, 0.09, 1.05], [3.6, 0.09, -1.05],
  ];
  for (const [w, h, dy] of marco) {
    const barra = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.17), matNeon);
    barra.position.set(0, altoPoste + 0.9 + dy, 0);
    g.add(barra);
  }
  for (const s of [-1, 1]) {
    const barra = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.1, 0.17), matNeon);
    barra.position.set(s * 1.78, altoPoste + 0.9, 0);
    g.add(barra);
  }

  // "Texto": barras que insinúan un eslogan sin escribir nada. Deliberado —
  // un texto real sería ilegible a esta velocidad y a esta distancia.
  const matTexto = neon(NEON.blanco, 1.5);
  for (let i = 0; i < 3; i++) {
    const largo = 2.6 - i * 0.6;
    const linea = new THREE.Mesh(
      new THREE.BoxGeometry(largo, 0.24, 0.05),
      i === 0 ? matNeon : matTexto,
    );
    linea.position.set(0, altoPoste + 1.4 - i * 0.5, 0.1);
    g.add(linea);
  }

  return g;
}

/** Patrulla con luces de emergencia. Se anima desde la escena. */
function crearPatrulla() {
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.85, 4.2),
    mat(0x2b3a2b, 0.05, 0.7),
  );
  cuerpo.position.y = 0.85;
  g.add(cuerpo);

  const cabina = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.75, 2),
    mat(0x22301f, 0.04, 0.7),
  );
  cabina.position.set(0, 1.6, 0.3);
  g.add(cabina);

  const parabrisas = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.55, 0.08),
    mat(0x0d1a22, 0.2, 0.25),
  );
  parabrisas.position.set(0, 1.62, 1.32);
  g.add(parabrisas);

  // Barra de luces: azul y roja, animadas por la escena.
  const azul = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.28), neon(0x2050ff, 1.9));
  azul.position.set(-0.42, 2.06, 0.3);
  g.add(azul);

  const rojo = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.28), neon(NEON.rojo, 1.9));
  rojo.position.set(0.42, 2.06, 0.3);
  g.add(rojo);

  const geoRueda = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 8);
  const matRueda = mat(0x14161c, 0.02, 0.95);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const rueda = new THREE.Mesh(geoRueda, matRueda);
      rueda.rotation.z = Math.PI / 2;
      rueda.position.set(sx * 0.95, 0.42, sz * 1.4);
      g.add(rueda);
    }
  }

  g.userData.luces = { azul, rojo };
  return g;
}

// Textos de rótulo. GENÉRICOS a propósito: son los letreros que hay en
// cualquier mercado del país, no nombres de locales reales. El decorado
// ambienta un sector, no señala a un comerciante.
const ROTULOS_BAHIA = ['AL POR MAYOR', 'TODO A $1', 'OFERTAS', 'SE VENDE',
  'DESCUENTOS', 'CRÉDITO DIRECTO'];

const ROPA_BAHIA = [
  ['#f2c31d', '#1b4fa8', '#e63946', '#f7f7f2', '#2a9d54'],   // Camisetas
  ['#e8562f', '#2b3a67', '#f4a259', '#7a1f3d', '#dfe3e8'],   // Chompas
  ['#12a3c9', '#f7d548', '#b7295a', '#3f8f4a', '#efe7d8'],   // Ropa de niño
];

/**
 * Un puesto de la Bahía: persiana, toldo, rótulo pintado y mercadería a la
 * vista. Mide `ancho` metros de frente y se coloca en su sitio de la hilera.
 *
 * Lo que hace que se lea como comercio informal y no como "tienda" no es el
 * local: es que el género SALE del local. La ropa cuelga por delante de la
 * persiana, la mercadería se apila hasta arriba y el toldo invade la vereda.
 * Un local ordenado, con su vitrina y su puerta, sería otro barrio.
 */
// ===========================================================================
// LOS LOCALES DE LA BAHÍA
// ===========================================================================
// Desmenuzado de bahia_locales.glb, que es una manzana entera del mercado
// modelada a mano. Aquí no se carga ese archivo: se replica su ANATOMÍA con
// cajas, que es lo que permite que cada local salga distinto sin pesar más.
//
// Lo que dice el modelo, y que la versión anterior no tenía:
//
//   · TODOS LOS LOCALES MIDEN LO MISMO. 2,60 de frente por 3,31 de alto, sin
//     una sola excepción en los dieciocho del archivo. Antes cada puesto
//     sorteaba su altura entre 3,4 y 5, y una hilera de alturas distintas no
//     es un mercado: es una calle de casas. Lo que hace que esto se lea como
//     mercado es justo que la cornisa sea UNA línea continua.
//   · SON CAJAS DE OBRA, no fachadas. Piso levantado un escalón, pared de
//     fondo, dos tabiques que lo separan de los vecinos, losa encima y un
//     dintel del que cuelga el rótulo. Se ve el interior porque el frente
//     está abierto de verdad.
//   · TIENEN TRES ESTADOS y los tres estaban en el archivo: abierto con su
//     mostrador y su tubo fluorescente, cerrado con persiana de lamas —con su
//     rollo arriba y su candado abajo— y cerrado con reja de barrotes.
//   · HAY GÉNERO POR TODAS PARTES: cajas apiladas, bultos, sacos y repisas,
//     dentro y desbordando al pasillo.
//
// Las medidas son las del archivo, tomadas una a una. Ver el desglose en
// docs/ESTILO.md.
const LOCAL = {
  ANCHO: 2.6,
  ALTO: 3.31,
  FONDO: 3.4,
  PISO: 0.16,          // el escalón desde la calle
  PARED: 3.15,         // alto de pared de fondo y tabiques
  TABIQUE: 0.1,
  LOSA: 0.16,          // la cornisa continua de arriba
  DINTEL_ALTO: 0.55,
  DINTEL_Y: 2.59,
  ROTULO_ANCHO: 2.25,
  ROTULO_ALTO: 0.42,
  ROTULO_Y: 2.87,
  LAMAS: 19,           // lamas de la persiana, contadas en el archivo
  LAMA_DESDE: 0.08,
  LAMA_HASTA: 2.54,
  ROLLO_Y: 2.58,
  BARROTES: 17,
  MOSTRADOR: [2.1, 0.92, 0.5],
  RIEL_Y: 2.35,
  LAMPARA_Y: 2.4,
};

// La paleta del archivo, tal cual. Los seis tonos de mercancía son los que
// hacen que dos locales seguidos no se parezcan sin tener que modelar nada
// distinto: cambia el color de lo que hay dentro, no la caja.
const BAHIA = {
  concreto: 0xc7c6c2,
  concretoOscuro: 0x9a9a97,
  rotulo: 0xf6f4ee,
  madera: 0x9c8163,
  carton: 0xb79a76,
  acero: 0x5980a6,
  aceroClaro: 0x93a9be,
  lona: 0xe8e6df,
  plastico: 0xdfe4e6,
  // Los tres tonos del archivo —azulado, gris y tostado— MÁS los pintados.
  // En el archivo las persianas son de acero crudo porque es un modelo de
  // estudio; en la Bahía de verdad cada dueño pinta la suya del color de su
  // negocio, y esa hilera de persianas de colores es media identidad del
  // sector. Sin ellas la manzana entera salía gris.
  persiana: [
    0x6d8fae, 0xb8bcbd, 0x8d7f6d,
    0xc25b4a, 0x3f7f86, 0xc9a15a, 0x4a6f9c, 0xb8543f, 0x5f8f6a,
  ],
  mercancia: [0x3f5f86, 0xc25b4a, 0xe4e1d8, 0x37403f, 0xc9a15a, 0x6b8f7a],
};

// Mismo motivo que en las casas coloniales: los materiales se crean UNA vez y
// los comparten los dieciocho locales de la calle. Creados dentro del
// generador, fundir por material no fundiría nada.
const MATS_BAHIA = new Map();
function matBahia(color, emision = 0.03, rugosidad = 0.9) {
  const clave = `${color}|${emision}|${rugosidad}`;
  if (!MATS_BAHIA.has(clave)) MATS_BAHIA.set(clave, mat(color, emision, rugosidad));
  return MATS_BAHIA.get(clave);
}

/** Caja rápida: la mitad de este archivo es poner cajas en su sitio. */
function _caja(ancho, alto, fondo, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material);
  m.position.set(x, y, z);
  return m;
}

/**
 * LA PERSIANA DE LAMAS. Diecinueve lamas, su rollo arriba, las dos guías a los
 * costados y el candado abajo.
 *
 * Las lamas van una a una y no en un plano con textura porque la persiana es
 * lo que más se ve de un local cerrado —ocupa el frente entero— y una textura
 * plana se delata en cuanto la luz le da de lado. Diecinueve cajas finas se
 * funden luego en una sola malla, así que salen gratis en draw calls.
 *
 * @param {number} cerrada  1 = hasta el suelo, 0.45 = a medio bajar
 */
function _persianaBahia(g, rnd, cerrada = 1) {
  const tono = BAHIA.persiana[Math.floor(rnd() * BAHIA.persiana.length)];
  const matLama = matBahia(tono, 0.02, 0.6);
  const matGuia = matBahia(BAHIA.aceroClaro, 0.02, 0.55);
  const zf = LOCAL.FONDO / 2 - 0.05;

  // Las guías laterales, de suelo a rollo.
  for (const s of [-1, 1]) {
    g.add(_caja(0.07, 2.6, 0.1, matGuia, s * (LOCAL.ANCHO / 2 - 0.06), 1.3, zf));
  }

  // El rollo: el cilindro donde se enrolla, que es lo que dice que ESO sube.
  const rollo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, LOCAL.ANCHO - 0.24, 8), matGuia,
  );
  rollo.rotation.z = Math.PI / 2;
  rollo.position.set(0, LOCAL.ROLLO_Y, zf);
  g.add(rollo);

  // Las lamas, del rollo hacia abajo hasta donde llegue.
  const paso = (LOCAL.LAMA_HASTA - LOCAL.LAMA_DESDE) / (LOCAL.LAMAS - 1);
  const cuantas = Math.max(2, Math.round(LOCAL.LAMAS * cerrada));
  for (let i = 0; i < cuantas; i++) {
    const y = LOCAL.LAMA_HASTA - i * paso;
    g.add(_caja(LOCAL.ANCHO - 0.16, paso * 0.82, 0.05, matLama, 0, y, zf));
  }

  // El candado, solo si baja del todo: en una a medio subir no habría dónde.
  if (cerrada > 0.9) {
    g.add(_caja(0.16, 0.2, 0.07, matBahia(BAHIA.acero, 0.03, 0.5),
      -LOCAL.ANCHO / 2 + 0.28, 0.35, zf + 0.05));
  }
}

/**
 * LA REJA DE BARROTES. Diecisiete verticales y dos travesaños.
 *
 * Es el otro modo de estar cerrado, y la diferencia importa: por una reja se
 * VE el género de dentro, así que el local sigue contando algo. Por eso el
 * archivo tiene las dos y por eso aquí también.
 */
function _rejaBahia(g, rnd) {
  const matReja = matBahia(BAHIA.acero, 0.02, 0.55);
  const zf = LOCAL.FONDO / 2 - 0.05;
  const luz = LOCAL.ANCHO - 0.2;
  const paso = luz / (LOCAL.BARROTES - 1);

  for (let i = 0; i < LOCAL.BARROTES; i++) {
    g.add(_caja(0.035, 2.42, 0.035, matReja, -luz / 2 + i * paso, 1.21, zf));
  }
  // Los dos travesaños, arriba y abajo, que es lo que la hace una reja y no
  // una fila de palos.
  for (const y of [0.2, 2.3]) {
    g.add(_caja(LOCAL.ANCHO - 0.12, 0.04, 0.04, matReja, 0, y, zf));
  }
}

/**
 * EL INTERIOR DE UN LOCAL ABIERTO: mostrador, riel de perchas con su ropa,
 * tubo fluorescente y repisas con género.
 *
 * El tubo va con material emisivo y sin niebla: es la única luz propia de la
 * calle y lo que hace que un local abierto se distinga de uno cerrado desde
 * lejos, que es justo lo que hay que poder distinguir.
 */
function _interiorBahia(g, rnd) {
  const zf = LOCAL.FONDO / 2;

  // TODO VA HACIA EL FRENTE, y esa es la corrección que hace que un local
  // abierto se vea abierto. Colocado como en el archivo —mostrador a 0,85 del
  // frente y el riel a 1,45— desde la calle no se veía nada: el dintel tapa
  // por arriba y el hueco queda en sombra, así que el local se leía como un
  // panel liso. En el archivo eso da igual porque se mira de pie desde el
  // pasillo; aquí se pasa a veinte por hora y de refilón.
  const [mAncho, mAlto, mFondo] = LOCAL.MOSTRADOR;
  g.add(_caja(mAncho, mAlto, mFondo, matBahia(BAHIA.madera, 0.03, 0.9),
    0, LOCAL.PISO + mAlto / 2, zf - 0.35));

  // Y encima del mostrador, el género a la vista.
  const encima = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < encima; i++) {
    const tono = BAHIA.mercancia[Math.floor(rnd() * BAHIA.mercancia.length)];
    const a = 0.3 + rnd() * 0.2;
    g.add(_caja(a, 0.22, 0.3, matBahia(tono, 0.05, 0.9),
      (i / Math.max(1, encima - 1) - 0.5) * (mAncho - 0.5),
      LOCAL.PISO + mAlto + 0.11, zf - 0.35));
  }

  // Tubo fluorescente bajo la losa, a lo ancho del local: es la única luz
  // propia de la calle y lo que dice DE LEJOS que este local está abierto.
  g.add(_caja(LOCAL.ANCHO - 0.5, 0.07, 0.12, LUZ_BAHIA, 0, LOCAL.LAMPARA_Y, zf - 0.6));

  // Riel de perchas con prendas colgadas, justo detrás del mostrador. Cada
  // prenda un tono de la paleta: es lo que hace que un local de ropa no se
  // parezca al de al lado.
  g.add(_caja(LOCAL.ANCHO - 0.4, 0.05, 0.05, matBahia(BAHIA.aceroClaro, 0.02, 0.55),
    0, LOCAL.RIEL_Y, zf - 1.05));
  const prendas = 6 + Math.floor(rnd() * 4);
  for (let i = 0; i < prendas; i++) {
    const x = (i / (prendas - 1) - 0.5) * (LOCAL.ANCHO - 0.55);
    const alto = 0.6 + rnd() * 0.35;
    const tono = BAHIA.mercancia[Math.floor(rnd() * BAHIA.mercancia.length)];
    g.add(_caja(0.22, alto, 0.1, matBahia(tono, 0.05, 0.92),
      x, LOCAL.RIEL_Y - alto / 2 - 0.06, zf - 1.05));
  }

  // La pared del fondo, forrada. En un local abierto se ve el fondo, y el gris
  // de obra ahí detrás apagaba todo lo que tuviera delante.
  const forro = BAHIA.mercancia[Math.floor(rnd() * BAHIA.mercancia.length)];
  g.add(_caja(LOCAL.ANCHO - 0.3, LOCAL.PARED - 0.4, 0.06, matBahia(forro, 0.06, 0.92),
    0, (LOCAL.PARED - 0.4) / 2, -LOCAL.FONDO / 2 + 0.16));

  // Repisas contra la pared del fondo, con su género encima.
  for (let n = 0; n < 2; n++) {
    const y = 0.85 + n * 0.85;
    g.add(_caja(LOCAL.ANCHO - 0.35, 0.06, 0.42, matBahia(BAHIA.madera, 0.03, 0.9),
      0, y, -LOCAL.FONDO / 2 + 0.45));
    const bultos = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < bultos; i++) {
      const tono = BAHIA.mercancia[Math.floor(rnd() * BAHIA.mercancia.length)];
      const a = 0.28 + rnd() * 0.16;
      g.add(_caja(a, 0.26, 0.3, matBahia(tono, 0.03, 0.92),
        (i / Math.max(1, bultos - 1) - 0.5) * (LOCAL.ANCHO - 0.7), y + 0.16,
        -LOCAL.FONDO / 2 + 0.45));
    }
  }
}

/**
 * LOS CAJONES. Pilas de cartón y sacos, dentro del local y desbordando a la
 * vereda. En el archivo hay más de cien y son la mitad del carácter del sitio:
 * un mercado mayorista es mercancía que no cabe.
 */
function _cajonesBahia(g, rnd, cuantos) {
  const matCarton = matBahia(BAHIA.carton, 0.03, 0.95);
  for (let i = 0; i < cuantos; i++) {
    const x = (rnd() - 0.5) * (LOCAL.ANCHO - 0.5);
    const z = LOCAL.FONDO / 2 - 0.2 + rnd() * 0.7;
    const pila = 1 + Math.floor(rnd() * 3);
    const lado = 0.34 + rnd() * 0.16;
    for (let n = 0; n < pila; n++) {
      const caja = _caja(lado, lado * 0.72, lado * 0.9, matCarton,
        x, LOCAL.PISO + lado * 0.36 + n * lado * 0.72, z);
      caja.rotation.y = (rnd() - 0.5) * 0.5;
      g.add(caja);
    }
    // Un saco encima de algunas pilas: la silueta redondeada rompe la
    // cuadrícula de cajas, que si no se lee como almacén de cubos.
    if (rnd() > 0.55) {
      const tono = BAHIA.mercancia[Math.floor(rnd() * BAHIA.mercancia.length)];
      const saco = new THREE.Mesh(
        new THREE.SphereGeometry(lado * 0.42, 6, 5), matBahia(tono, 0.03, 0.95),
      );
      saco.scale.y = 0.8;
      saco.position.set(x, LOCAL.PISO + lado * 0.72 * pila + lado * 0.3, z);
      g.add(saco);
    }
  }
}

// El tubo fluorescente: un único material para los dieciocho locales, emisivo
// y sin niebla, para que se vea el local encendido desde el fondo de la calle.
const LUZ_BAHIA = new THREE.MeshStandardMaterial({
  color: 0xfdfbf0,
  emissive: 0xfdfbf0,
  emissiveIntensity: 1.6,
  roughness: 0.4,
  toneMapped: false,
});

/**
 * UN LOCAL. La caja de obra, su estado y lo que tenga dentro.
 *
 * @param {function} rnd Fuente de azar, inyectable para poder fijarla
 */
function crearLocalBahia(rnd, indiceRotulo = null) {
  const g = new THREE.Group();
  const matObra = matBahia(BAHIA.concreto, 0.03, 0.9);
  const matObraOsc = matBahia(BAHIA.concretoOscuro, 0.03, 0.9);

  // --- La caja de obra ------------------------------------------------------
  // Piso levantado un escalón, pared de fondo, dos tabiques y la losa. Es la
  // parte que NO cambia nunca: los dieciocho locales del archivo comparten
  // estas cinco piezas al milímetro.
  g.add(_caja(LOCAL.ANCHO, LOCAL.PISO, LOCAL.FONDO, matObraOsc, 0, LOCAL.PISO / 2, 0));
  g.add(_caja(LOCAL.ANCHO, LOCAL.PARED, 0.12, matObra,
    0, LOCAL.PARED / 2, -LOCAL.FONDO / 2 + 0.06));
  for (const s of [-1, 1]) {
    g.add(_caja(LOCAL.TABIQUE, LOCAL.PARED, LOCAL.FONDO, matObra,
      s * (LOCAL.ANCHO / 2 - LOCAL.TABIQUE / 2), LOCAL.PARED / 2, 0));
  }
  // La losa: sobresale un poco y es la línea continua que hace la manzana.
  g.add(_caja(LOCAL.ANCHO, LOCAL.LOSA, LOCAL.FONDO + 0.2, matObra,
    0, LOCAL.PARED + LOCAL.LOSA / 2, 0.1));

  // Dintel y rótulo, sobre el hueco.
  const zf = LOCAL.FONDO / 2;
  g.add(_caja(LOCAL.ANCHO - 0.06, LOCAL.DINTEL_ALTO, 0.16, matObra,
    0, LOCAL.DINTEL_Y + LOCAL.DINTEL_ALTO / 2, zf - 0.08));

  const texto = ROTULOS_BAHIA[
    (indiceRotulo ?? Math.floor(rnd() * ROTULOS_BAHIA.length)) % ROTULOS_BAHIA.length
  ];
  const rotulo = new THREE.Mesh(
    new THREE.PlaneGeometry(LOCAL.ROTULO_ANCHO, LOCAL.ROTULO_ALTO),
    new THREE.MeshStandardMaterial({
      map: texturaRotulo(texto, rnd() > 0.5 ? '#c25b4a' : '#3f5f86'),
      roughness: 0.85,
      emissive: 0xffffff,
      emissiveIntensity: 0.14,
    }),
  );
  rotulo.position.set(0, LOCAL.ROTULO_Y, zf + 0.02);
  g.add(rotulo);

  // --- El estado ------------------------------------------------------------
  // Mitad abiertos, y del resto dos tercios con persiana y uno con reja. La
  // proporción sale del archivo: de los dieciocho, ocho están abiertos, siete
  // con persiana y tres con reja.
  const dado = rnd();
  if (dado < 0.46) {
    _interiorBahia(g, rnd);
    _cajonesBahia(g, rnd, 1 + Math.floor(rnd() * 3));
    g.userData.abierto = true;
  } else if (dado < 0.62) {
    // A medio bajar: el local que está cerrando, con el género aún fuera.
    _persianaBahia(g, rnd, 0.45);
    _cajonesBahia(g, rnd, 2);
  } else if (dado < 0.86) {
    _persianaBahia(g, rnd, 1);
  } else {
    _rejaBahia(g, rnd);
    // Por la reja se ve lo de dentro, así que hay que poner algo dentro.
    _cajonesBahia(g, rnd, 2);
  }

  return g;
}

// ===========================================================================
// LA CALLE DE GUAYAQUIL — el decorado de Las Elecciones
// ===========================================================================
// Tomado de fotos de calle de Guayaquil. La gramática de esa arquitectura es
// muy concreta y es lo que hay que replicar:
//
//   · DOS PLANTAS, y la de arriba VUELA sobre la vereda apoyada en columnas.
//     Ese soportal continuo —columnas cuadradas cada tres metros y sombra
//     debajo— es lo primero que se reconoce, y es lo que la separa de la
//     cuadra colonial de Carondelet, donde la fachada baja a ras de suelo.
//   · LAS COLUMNAS VAN PINTADAS DE OTRO COLOR que el muro, casi siempre un
//     naranja o un terracota contra crema o amarillo pálido. No es un detalle:
//     esa alternancia es la mitad del color de la calle.
//   · ABAJO, PERSIANAS. Locales cerrados a esa hora, con su reja y su puerta.
//   · ARRIBA, UNA BANDA CORRIDA DE VENTANAS con marcos oscuros y montantes
//     finos, de esquina a esquina.
//   · REMATE PLANO con antepecho, sin alero ni teja.
const GYE = {
  muros: [0xefe4c9, 0xf2e2a8, 0xf0eee6, 0xdfe6d2, 0xe8dcc0],
  columnas: [0xe8873c, 0xc9603a, 0xd9a441, 0xb8654a],
  persiana: 0x7b8086,
  ventana: 0x2b3038,
  marco: 0xe8e4da,
  zocalo: 0x9a958c,
  // El morado del partido. Es el color de la campaña y se repite en banderas,
  // camiones y carteles: en una avenida en campaña, TODO es de ese color.
  partido: 0x7b4fd0,
  partidoClaro: 0xa585e8,
};

const MATS_GYE = new Map();
function matGye(color, emision = 0.05, rugosidad = 0.92) {
  const clave = `${color}|${emision}|${rugosidad}`;
  if (!MATS_GYE.has(clave)) MATS_GYE.set(clave, mat(color, emision, rugosidad));
  return MATS_GYE.get(clave);
}

/**
 * UNA CASA DE GUAYAQUIL. Soportal abajo, banda de ventanas arriba.
 *
 * La fachada mira a +Z, que es como la coloca BaseScene tras girarla.
 *
 * @param {number} ancho  Cuánta calle ocupa
 * @param {function} rnd  Fuente de azar, inyectable para poder fijarla
 */
function crearCasaGuayaquil(ancho, rnd) {
  const g = new THREE.Group();
  const PLANTA_BAJA = 3.2;     // hasta el techo del soportal
  const PLANTA_ALTA = 3.0;
  const ANTEPECHO = 0.6;
  const FONDO = 4.2;
  const VUELO = 1.5;           // cuánto vuela la planta alta sobre la vereda

  const muro = GYE.muros[Math.floor(rnd() * GYE.muros.length)];
  const columna = GYE.columnas[Math.floor(rnd() * GYE.columnas.length)];
  const matMuro = matGye(muro);
  const matCol = matGye(columna);

  const zFrente = FONDO / 2;

  // --- Planta baja: el cuerpo retranqueado y su soportal -------------------
  // El muro de los locales va METIDO hacia dentro: el hueco que queda delante
  // es la vereda cubierta, y es lo que da la sombra que define estas calles.
  g.add(_caja(ancho, PLANTA_BAJA, FONDO - VUELO, matMuro,
    0, PLANTA_BAJA / 2, -VUELO / 2));

  // Zócalo de baldosa, que en las fotos siempre está y siempre más oscuro.
  g.add(_caja(ancho, 0.5, FONDO - VUELO + 0.04, matGye(GYE.zocalo, 0.04, 0.9),
    0, 0.25, -VUELO / 2));

  // Las persianas de los locales, bajo el soportal.
  const locales = Math.max(1, Math.round(ancho / 2.6));
  const anchoLocal = ancho / locales;
  for (let i = 0; i < locales; i++) {
    const x = (i - (locales - 1) / 2) * anchoLocal;
    g.add(_caja(anchoLocal - 0.35, 2.2, 0.1, matGye(GYE.persiana, 0.03, 0.7),
      x, 1.2, zFrente - VUELO - 0.02));
    // El dintel pintado sobre cada local: otra franja de color.
    g.add(_caja(anchoLocal - 0.25, 0.42, 0.12, matCol,
      x, 2.55, zFrente - VUELO - 0.02));
  }

  // Las columnas del soportal, al filo de la vereda. Cuadradas y pintadas.
  const cuantas = Math.max(2, Math.round(ancho / 3) + 1);
  for (let i = 0; i < cuantas; i++) {
    const x = (i / (cuantas - 1) - 0.5) * (ancho - 0.5);
    g.add(_caja(0.42, PLANTA_BAJA, 0.42, matCol, x, PLANTA_BAJA / 2, zFrente - 0.25));
    // Basa más clara, como en las fotos.
    g.add(_caja(0.5, 0.35, 0.5, matGye(GYE.marco, 0.04, 0.9), x, 0.17, zFrente - 0.25));
  }

  // --- El forjado que vuela --------------------------------------------------
  g.add(_caja(ancho, 0.3, FONDO, matMuro, 0, PLANTA_BAJA + 0.15, 0));

  // --- Planta alta: muro y banda corrida de ventanas -----------------------
  const yAlta = PLANTA_BAJA + 0.3;
  g.add(_caja(ancho, PLANTA_ALTA, FONDO, matMuro, 0, yAlta + PLANTA_ALTA / 2, 0));

  // La banda de ventanas, de esquina a esquina.
  const yVent = yAlta + PLANTA_ALTA * 0.55;
  g.add(_caja(ancho - 0.5, 1.5, 0.1, matGye(GYE.ventana, 0.06, 0.5),
    0, yVent, zFrente + 0.02));
  // Montantes finos, que es lo que la hace una banda de ventanas y no un
  // rectángulo negro.
  const montantes = Math.max(3, Math.round(ancho / 0.9));
  for (let i = 0; i < montantes; i++) {
    const x = (i / (montantes - 1) - 0.5) * (ancho - 0.6);
    g.add(_caja(0.08, 1.5, 0.14, matGye(GYE.marco, 0.05, 0.9), x, yVent, zFrente + 0.04));
  }
  // Y su antepecho, la franja de color bajo la ventana.
  g.add(_caja(ancho, 0.5, 0.12, matCol, 0, yVent - 1.05, zFrente + 0.03));

  // --- Remate plano ---------------------------------------------------------
  const yRemate = yAlta + PLANTA_ALTA;
  g.add(_caja(ancho, ANTEPECHO, FONDO + 0.15, matMuro, 0, yRemate + ANTEPECHO / 2, 0));
  g.add(_caja(ancho + 0.1, 0.12, FONDO + 0.25, matGye(GYE.marco, 0.05, 0.9),
    0, yRemate + ANTEPECHO, 0));

  // --- La campaña, encima de todo -------------------------------------------
  // Una avenida en campaña está forrada: banderas del partido colgando de las
  // columnas y del antepecho. Es lo que convierte una calle cualquiera en LAS
  // ELECCIONES sin tener que escribirlo en ningún sitio.
  if (rnd() > 0.25) {
    const cuantasBanderas = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < cuantasBanderas; i++) {
      const bandera = crearBanderaCampana(rnd);
      // Colgadas de la fachada alta y VOLANDO sobre la vereda, que es donde se
      // cuelgan de verdad: pegadas al muro no se ven desde la calle.
      bandera.position.set(
        (i - (cuantasBanderas - 1) / 2) * (ancho / cuantasBanderas) + (rnd() - 0.5) * 0.6,
        yAlta + 1.15, zFrente + 0.08,
      );
      g.add(bandera);
    }
  }

  return g;
}

/**
 * BANDERA DEL PARTIDO. Un asta corta y el paño morado, ligeramente ondeado.
 *
 * El paño va inclinado y no colgando recto porque una bandera quieta se lee
 * como un cartel: lo que dice «bandera» es que esté torcida.
 */
function crearBanderaCampana(rnd) {
  const g = new THREE.Group();
  // CUÁNTO PUEDE VOLAR. Entre la fachada y el borde del carril hay 1,30 de
  // vereda, así que un paño de dos metros se metía en la calle y pasaba
  // rozando la cámara: una mancha morada que tapaba media pantalla. Colgada
  // alta y corta vuela sobre la vereda sin invadir por donde se corre.
  const largo = 0.95 + rnd() * 0.35;

  // El asta sale HACIA LA CALLE, en diagonal, como los mástiles de un balcón.
  const asta = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.1, 0.06), matGye(0xd8d4cc, 0.04, 0.7),
  );
  asta.position.set(0, 0.45, 0.32);
  asta.rotation.x = 0.85;
  g.add(asta);

  const claro = rnd() > 0.5;
  const pano = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.82, largo),
    matGye(claro ? GYE.partidoClaro : GYE.partido, 0.16, 0.9),
  );
  // Cuelga del asta hacia fuera, con una torcedura: una bandera recta se lee
  // como un cartel.
  pano.position.set(0, 0.5, 0.35 + largo / 2);
  pano.rotation.z = -0.1 + rnd() * 0.2;
  pano.rotation.x = 0.1;
  g.add(pano);

  // La franja clara del partido, cruzando el paño.
  g.add(_caja(0.05, 0.2, largo * 0.9,
    matGye(claro ? GYE.partido : GYE.partidoClaro, 0.16, 0.9),
    0, 0.4, 0.35 + largo / 2));

  return g;
}

/**
 * EL CAMIÓN DE CAMPAÑA. Plataforma, cabina rotulada y los cartones del
 * candidato de pie en la caja.
 *
 * En las caravanas de verdad el camión es el centro: va forrado con la cara
 * del candidato, lleva la gente arriba y detrás va la moto. Aquí lo que
 * importa es la silueta —una caja abierta con figuras planas asomando— porque
 * es lo que se reconoce de refilón y a velocidad.
 *
 * LOS CARTONES SON CARTONES, planos y recortados, y esa es la broma: el
 * candidato está en todas partes y en ninguna. El juego ya la tenía escrita
 * («Cartón del candidato» es uno de sus obstáculos); esto la pone en la calle.
 */
function crearCamionCampana(rnd) {
  const g = new THREE.Group();
  const matChasis = matGye(0xf0eee6, 0.05, 0.7);
  const matCaja = matGye(GYE.partido, 0.1, 0.85);
  const matRueda = matGye(0x1a1c22, 0.02, 0.95);

  // Cabina, adelante.
  g.add(_caja(2.1, 1.5, 1.7, matChasis, 0, 1.35, 1.6));
  g.add(_caja(1.85, 0.65, 0.1, matGye(GYE.ventana, 0.05, 0.5), 0, 1.75, 2.42));
  // La franja rotulada del morro: la cara del candidato va aquí.
  g.add(_caja(2.0, 0.5, 0.08, matCaja, 0, 1.0, 2.46));

  // Plataforma y barandas de la caja.
  g.add(_caja(2.2, 0.5, 3.6, matChasis, 0, 0.85, -0.7));
  for (const s of [-1, 1]) {
    g.add(_caja(0.1, 0.85, 3.6, matCaja, s * 1.05, 1.5, -0.7));
  }
  g.add(_caja(2.2, 0.85, 0.1, matCaja, 0, 1.5, -2.5));

  // Ruedas.
  const geoRueda = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 8);
  for (const sx of [-1, 1]) {
    for (const sz of [1.55, -0.2, -1.9]) {
      const r = new THREE.Mesh(geoRueda, matRueda);
      r.rotation.z = Math.PI / 2;
      r.position.set(sx * 1.05, 0.42, sz);
      g.add(r);
    }
  }

  // LOS CARTONES. Figuras planas de pie en la caja, cada una con su peana.
  const cuantos = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < cuantos; i++) {
    const carton = crearCartonCandidato(rnd);
    carton.position.set(
      (rnd() - 0.5) * 1.2, 1.1, -0.4 - i * 0.8 + (rnd() - 0.5) * 0.3,
    );
    // MIRANDO A LOS COSTADOS, no al frente del camión. El camión corre
    // paralelo a la calle, así que un cartón mirando hacia adelante se ve de
    // canto desde la vereda: una lámina de nada. Girados un cuarto miran a
    // quien pasa, que es justo lo que hace un cartón de campaña. Alternan lado
    // porque en la caja de verdad la gente va mirando a los dos.
    carton.rotation.y = (i % 2 ? -1 : 1) * Math.PI / 2 + (rnd() - 0.5) * 0.6;
    g.add(carton);
  }

  // Y las banderas asomando por la caja.
  for (let i = 0; i < 2; i++) {
    const b = crearBanderaCampana(rnd);
    // A lo largo de la caja, no hacia los costados: apuntando de lado, el paño
    // sobresalía del camión y volvía a meterse en el carril.
    b.position.set((i ? 1 : -1) * 0.7, 1.9, -2.3);
    b.rotation.y = Math.PI;
    g.add(b);
  }

  return g;
}

/**
 * UN CARTÓN DEL CANDIDATO: la silueta recortada, plana, con su peana.
 *
 * Sin cara. Es una silueta de traje y nada más, y a propósito: lo que se
 * reconoce en la calle es la FORMA —un señor de pie, tamaño real, apoyado en
 * una peana— y ponerle rasgos lo convertiría en el retrato de alguien. Este
 * juego es sátira de un sistema, no de una cara; el propio ejemplar lo dice en
 * su página de administración.
 */
function crearCartonCandidato(rnd) {
  const g = new THREE.Group();
  const matCarton = matGye(0xe8e2d4, 0.06, 0.95);
  const matTraje = matGye(rnd() > 0.5 ? GYE.partido : 0x2b3350, 0.06, 0.9);
  const matPiel = matGye(0xd9a882, 0.05, 0.9);

  // TAMAÑO REAL, que es de lo que va la broma: el cartón es de cuerpo entero.
  // A 1,60 el traje quedaba por debajo de la baranda del camión y desde la
  // calle solo asomaba la plancha de atrás, o sea una tabla.
  // La plancha de cartón por detrás: es lo que dice que es un recorte.
  g.add(_caja(0.72, 2.05, 0.04, matCarton, 0, 1.02, -0.02));
  // El traje y la cabeza, recortados encima.
  g.add(_caja(0.62, 1.15, 0.05, matTraje, 0, 0.88, 0.01));
  g.add(_caja(0.28, 0.34, 0.05, matPiel, 0, 1.66, 0.01));
  // El pelo, que es lo que separa una cabeza de un rectángulo.
  g.add(_caja(0.3, 0.12, 0.06, matGye(0x2a2119, 0.03, 0.9), 0, 1.8, 0.01));
  // La banda del partido cruzada, que es como salen en los carteles.
  const banda = _caja(0.66, 0.16, 0.06, matGye(GYE.partidoClaro, 0.16, 0.9), 0, 1.05, 0.02);
  banda.rotation.z = 0.42;
  g.add(banda);
  // Peana trasera.
  const peana = _caja(0.5, 0.6, 0.04, matCarton, 0, 0.3, -0.2);
  peana.rotation.x = 0.35;
  g.add(peana);

  return g;
}

/** Solo para pruebas: el camión de campaña suelto. */
export function __probarCamion(rnd) { return crearCamionCampana(rnd); }

/** Solo para pruebas: un local suelto, sin fundir, para poder contar estados. */
export function __probarLocal(rnd) { return crearLocalBahia(rnd); }

function crearPuestoBahia(colores, aleatorio, ancho = 4.6) {
  const g = new THREE.Group();
  const alto = 3.4 + aleatorio() * 1.6;
  const fondo = 3.2;

  // El cuerpo del local. Tonos de revoque pintado, no el color de props del
  // escenario: en la Bahía cada dueño pintó el suyo del color que tenía.
  const revoques = [0xc9a06a, 0xd8c9a8, 0xa8bcc4, 0xcf8f6a, 0xbfc4a8];
  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, fondo),
    mat(revoques[Math.floor(aleatorio() * revoques.length)], 0.04, 0.94),
  );
  cuerpo.position.y = alto / 2;
  g.add(cuerpo);

  // El frente: cerrado con persiana, o abierto con el género fuera.
  const zFrente = fondo / 2 + 0.03;
  const abierto = aleatorio() > 0.32;

  if (abierto) {
    // Persiana a medio subir, arriba del todo.
    const persiana = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho * 0.92, alto * 0.2),
      new THREE.MeshStandardMaterial({ map: texturaPersiana(), roughness: 0.6, metalness: 0.3 }),
    );
    persiana.position.set(0, alto * 0.86, zFrente);
    g.add(persiana);

    // Y debajo, el género. Mitad ropa colgada, mitad mercadería apilada: en
    // una hilera real se alternan, y alternarlos es lo que impide que la
    // vereda se lea como un patrón repetido.
    // Tres variantes de cada textura, elegidas al azar. Con una sola, dos
    // puestos seguidos enseñaban EXACTAMENTE la misma pila de cajas —el mismo
    // azar congelado en la caché— y la hilera se leía como un mosaico
    // repetido. Tres bastan: nadie compara el primer puesto con el cuarto.
    const esRopa = aleatorio() > 0.45;
    const variante = Math.floor(aleatorio() * 3);
    const genero = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho * 0.92, alto * 0.72),
      new THREE.MeshStandardMaterial({
        map: esRopa
          ? texturaRopaColgada(variante, ROPA_BAHIA[variante % ROPA_BAHIA.length])
          : texturaMercaderia(variante),
        roughness: 0.85,
      }),
    );
    genero.position.set(0, alto * 0.4, zFrente + 0.02);
    g.add(genero);
  } else {
    const persiana = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho * 0.92, alto * 0.78),
      new THREE.MeshStandardMaterial({ map: texturaPersiana(), roughness: 0.6, metalness: 0.3 }),
    );
    persiana.position.set(0, alto * 0.42, zFrente);
    g.add(persiana);
  }

  // Toldo de lona a rayas, volando sobre la vereda.
  const toldo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 0.98, 0.1, 1.8),
    new THREE.MeshStandardMaterial({
      map: texturaToldo(aleatorio() > 0.5 ? '#d94a3d' : '#2f6fd0'),
      roughness: 0.85,
    }),
  );
  toldo.position.set(0, alto * 0.84, fondo / 2 + 0.85);
  toldo.rotation.x = 0.24;
  g.add(toldo);

  // Rótulo pintado, encima del toldo.
  if (aleatorio() > 0.35) {
    const texto = ROTULOS_BAHIA[Math.floor(aleatorio() * ROTULOS_BAHIA.length)];
    const rotulo = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho * 0.8, 0.52),
      new THREE.MeshStandardMaterial({
        map: texturaRotulo(texto, aleatorio() > 0.5 ? '#e8342a' : '#1b4fa8'),
        roughness: 0.8,
        emissive: 0xffffff,
        emissiveIntensity: 0.12,
      }),
    );
    rotulo.position.set(0, alto * 0.97, zFrente + 0.06);
    g.add(rotulo);
  }

  return g;
}

/**
 * Genera un elemento de decorado para los costados de la pista.
 * A la velocidad del juego nadie ve el detalle, pero la variación de alturas,
 * colores y siluetas sí se percibe como "ciudad".
 */

// ---------------------------------------------------------------------------
// CASA COLONIAL — La fachada del centro histórico
// ---------------------------------------------------------------------------
// Las proporciones y la paleta salen de medir el modelo de Quito: zócalo de
// piedra de 1,25, portales de 2,50 por 1,50, ventanas de 1,90 por 1,15, losa de
// balcón de 1,60 y cinco balaustres de 0,44. Copiarlas a ojo habría dado una
// casa «tipo colonial»; midiéndolas sale ESTA calle.
//
// PROCEDURAL Y NO IMPORTADA, a propósito. Todas las casas del centro histórico
// son la misma casa: zócalo, dos plantas, cornisa entre ellas, alero y teja.
// Lo que cambia es el color del revoque, cuántos portales tiene, si el balcón
// es corrido o de a uno y cuánto ha llovido encima. Eso es exactamente lo que
// un generador hace bien y un modelo fijo hace mal: repetir un archivo cada
// quince metros se lee como un bucle; repetir la GRAMÁTICA se lee como un
// barrio.
//
// Un modelo importado, además, se paga entero cada vez. Aquí las geometrías y
// los materiales se comparten entre todas las casas de la calle.

// Los revoques reales del centro. El blanco y el crema son la mayoría; el
// ocre, el añil y el óxido son los que le dan carácter a la cuadra, y por eso
// salen menos: si todas las casas fueran de color, ninguna destacaría.
const REVOQUES = [
  0xf3f1eb, 0xeee3cb, 0xf3f1eb, 0xeee3cb,
  0xe1a531, 0x5f7e9a, 0x418984, 0xb6623e,
];

// Los materiales se crean UNA vez y los comparten todas las casas. Creándolos
// dentro del generador, cada casa tenía los suyos aunque el color fuera el
// mismo, y entonces fundir por material no fundía nada: solo se pueden juntar
// piezas que se manden a pintar con el mismo material, no con uno igual.
const MATS_COLONIAL = new Map();
function matColonial(color, emision = 0.02, rugosidad = 0.95) {
  const clave = `${color}|${emision}|${rugosidad}`;
  if (!MATS_COLONIAL.has(clave)) MATS_COLONIAL.set(clave, mat(color, emision, rugosidad));
  return MATS_COLONIAL.get(clave);
}

const TEJA = 0xa2573c;
const PIEDRA = 0xb7b1a4;
const PIEDRA_OSCURA = 0x8c867b;
const MADERA = 0x4b372b;
const VIDRIO_COLONIAL = 0x36434b;

/**
 * Una casa. La fachada mira a +Z, que es como la coloca BaseScene tras girarla.
 *
 * @param {number} ancho  Cuánta calle ocupa
 * @param {function} rnd  Fuente de azar, inyectable para poder fijarla
 */

/**
 * Funde un grupo en una malla por material.
 *
 * UNA CASA COLONIAL SON CUARENTA Y CINCO PIEZAS —muro, zócalo, dos cornisas,
 * teja, tres portales con su puerta, tres ventanas con su vidrio y tres
 * balcones con losa, ménsulas, pasamanos y cinco balaustres cada uno—, y en
 * pantalla hay más de treinta casas a la vez. Eso son mil trescientas mallas y,
 * lo que importa, casi seiscientas llamadas de dibujo: medido, el escenario
 * pasaba de 85 a 125 ms por fotograma CON MENOS TRIÁNGULOS que la Bahía. El
 * coste no era la geometría, era el número de piezas.
 *
 * Fundidas por material quedan seis mallas por casa —revoque, piedra, blanco,
 * teja, madera y vidrio— sin perder un solo detalle: lo que se junta es cómo se
 * manda a pintar, no lo que se ve.
 *
 * Se hace UNA vez, al crear la pieza. Las casas no se animan por dentro, así
 * que no hay nada que se pierda al soldarlas.
 */
function fundirPorMaterial(grupo) {
  const cubos = new Map();
  grupo.updateMatrixWorld(true);

  grupo.traverse((o) => {
    if (!o.isMesh) return;
    const clave = o.material.uuid;
    if (!cubos.has(clave)) cubos.set(clave, { material: o.material, geos: [] });
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    cubos.get(clave).geos.push(g);
  });

  const fundido = new THREE.Group();
  for (const { material, geos } of cubos.values()) {
    const unida = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!unida) continue;
    fundido.add(new THREE.Mesh(unida, material));
    if (geos.length > 1) for (const g of geos) g.dispose();
  }
  return fundido;
}

function crearCasaColonial(ancho, rnd = Math.random) {
  const g = new THREE.Group();

  const revoque = REVOQUES[Math.floor(rnd() * REVOQUES.length)];
  const fondo = 6.2;
  // Dos plantas, con la baja más alta que la alta: es así en las casas de
  // portal, porque abajo hay comercio y arriba se vive.
  const baja = 3.1 + rnd() * 0.5;
  const alta = 2.5 + rnd() * 0.4;
  const alto = baja + alta;

  const muro = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), matColonial(revoque, 0.02, 0.96));
  muro.position.set(0, alto / 2, -fondo / 2 + 0.1);
  g.add(muro);

  // Zócalo de piedra. Protege el revoque de las salpicaduras, y por eso existe.
  const zocalo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho + 0.12, 1.25, fondo + 0.1), matColonial(PIEDRA_OSCURA, 0.02, 0.97),
  );
  zocalo.position.set(0, 0.625, -fondo / 2 + 0.1);
  g.add(zocalo);

  // Cornisa entre plantas y alero, los dos en blanco: es lo que marca el
  // ritmo horizontal de la cuadra cuando pasas corriendo.
  for (const [y, sobresale, grosor] of [[baja, 0.18, 0.18], [alto, 0.34, 0.26]]) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(ancho + sobresale, grosor, fondo + sobresale),
      matColonial(0xf3f1eb, 0.02, 0.94),
    );
    c.position.set(0, y, -fondo / 2 + 0.1);
    g.add(c);
  }

  // Teja a dos aguas, resuelta como un prisma girado: con esta estética un
  // tejado de verdad no aporta nada y cuesta triángulos.
  const teja = new THREE.Mesh(
    new THREE.CylinderGeometry(ancho * 0.34, ancho * 0.34, fondo + 0.6, 3), matColonial(TEJA, 0.03, 0.9),
  );
  teja.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  teja.position.set(0, alto + 0.42, -fondo / 2 + 0.1);
  g.add(teja);

  // --- Planta baja: portales -----------------------------------------------
  const portales = ancho > 6 ? 3 : 2;
  const pasoP = ancho / portales;
  for (let i = 0; i < portales; i++) {
    const x = -ancho / 2 + pasoP * (i + 0.5);

    const marco = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.16), matColonial(PIEDRA, 0.02, 0.95));
    marco.position.set(x, 1.25, 0.42);
    g.add(marco);

    // La puerta: madera casi siempre, y de vez en cuando pintada de verde,
    // que es el otro color de puerta que se ve por ahí.
    const puerta = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 2.3, 0.1),
      matColonial(rnd() < 0.25 ? 0x507941 : MADERA, 0.02, 0.9),
    );
    puerta.position.set(x, 1.15, 0.48);
    g.add(puerta);
  }

  // --- Planta alta: ventanas con balcón -------------------------------------
  // O corrido o de a uno. Es la diferencia que más se nota entre dos casas
  // vecinas, y no cuesta más que un condicional.
  const corrido = rnd() < 0.4;
  const ventanas = portales;
  const pasoV = ancho / ventanas;

  if (corrido) {
    g.add(_balcon(ancho - 0.5, 0, baja + 0.1, 0.75));
  }

  for (let i = 0; i < ventanas; i++) {
    const x = -ancho / 2 + pasoV * (i + 0.5);
    const yV = baja + 1.25;

    const marco = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.9, 0.14), matColonial(0xf3f1eb, 0.02, 0.94));
    marco.position.set(x, yV, 0.4);
    g.add(marco);

    const vidrio = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.08), matColonial(VIDRIO_COLONIAL, 0.06, 0.3));
    vidrio.position.set(x, yV, 0.45);
    g.add(vidrio);

    if (!corrido) g.add(_balcon(1.6, x, baja + 0.1, 0.75));
  }

  return g;
}

/** Losa, ménsulas y balaustrada. La firma del centro histórico. */
function _balcon(ancho, x, y, saliente) {
  const b = new THREE.Group();

  const losa = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.12, saliente + 0.35), matColonial(PIEDRA, 0.02, 0.95));
  losa.position.set(0, 0, saliente / 2 + 0.3);
  b.add(losa);

  // Ménsulas: sostienen la losa. Sin ellas el balcón flota, y flotando se lee
  // como un error de modelado antes que como un balcón.
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.9), matColonial(PIEDRA, 0.02, 0.95));
    m.position.set(s * (ancho / 2 - 0.18), -0.16, saliente / 2 + 0.25);
    b.add(m);
  }

  const barandaMat = matColonial(0xf3f1eb, 0.02, 0.94);
  for (const [dy, alto] of [[0.06, 0.06], [0.5, 0.08]]) {
    const barra = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, 0.1), barandaMat);
    barra.position.set(0, dy, saliente + 0.4);
    b.add(barra);
  }

  const cuantos = Math.max(3, Math.round(ancho / 0.32));
  for (let i = 0; i < cuantos; i++) {
    const bal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.44, 0.1), barandaMat);
    bal.position.set(-ancho / 2 + (ancho / (cuantos - 1)) * i, 0.28, saliente + 0.4);
    b.add(bal);
  }

  b.position.set(x, y, 0);
  return b;
}

export function crearDecorado(idEscenario, colores, aleatorio = Math.random) {
  const g = new THREE.Group();
  const dado = aleatorio();

  // Un 18% de los huecos son patrullas: presentes pero no omnipresentes.
  if (dado > 0.82) {
    const patrulla = crearPatrulla();
    patrulla.position.z = (aleatorio() - 0.5) * 3;
    g.add(patrulla);
    g.userData.patrulla = patrulla;
    return g;
  }

  switch (idEscenario) {
    case 'bahia': {
      // UNA HILERA, no un local suelto. La Bahía no son tiendas separadas por
      // solares: son puestos pegados unos a otros, sin un palmo entre medias,
      // bajo una bóveda de policarbonato que recorre la cuadra entera. Ese
      // apelotonamiento es el sector; un local con su hueco a cada lado sería
      // cualquier avenida.
      // Seis locales de 2,60, que es el frente que miden en el archivo. Antes
      // eran tres de 4,70 con la altura sorteada entre 3,4 y 5: una calle de
      // casas anchas y desiguales. El mercado es lo contrario —muchos frentes
      // estrechos y una sola cornisa continua—, y esa cadencia apretada es la
      // mitad de lo que hace que se lea como la Bahía.
      // LA ESCALA HAY QUE SUBIRLA, y no es traicionar el modelo sino leerlo.
      // En el archivo el pasillo del mercado mide 2,30 de ancho y los locales
      // 3,31 de alto: el local ES alto respecto a por dónde se pasa. Nuestra
      // calle mide 8,80 —es una avenida, no un pasillo—, así que a tamaño
      // literal los locales quedaban por debajo del horizonte y la manzana se
      // leía como un bordillo. A 1,5 recuperan la proporción que tienen en el
      // archivo respecto a lo que se camina, y las medidas de dentro siguen
      // guardando entre sí exactamente la relación medida.
      const ESCALA = 1.5;
      const LOCALES = 4;
      const largo = LOCALES * LOCAL.ANCHO;

      // La hilera se arma aparte para poder FUNDIRLA entera antes de colgarla:
      // fundirPorMaterial devuelve un grupo nuevo, no toca el que recibe.
      const hilera = new THREE.Group();
      // Los rótulos avanzan por la lista desde un punto al azar en vez de
      // sortearse uno a uno: con seis textos y cuatro locales, sorteando salía
      // «TODO A $1» tres veces en la misma cuadra.
      const desdeRotulo = Math.floor(aleatorio() * ROTULOS_BAHIA.length);
      for (let i = 0; i < LOCALES; i++) {
        const local = crearLocalBahia(aleatorio, desdeRotulo + i);
        local.position.x = (i - (LOCALES - 1) / 2) * LOCAL.ANCHO;
        hilera.add(local);
      }

      // El género que desborda al pasillo. En el archivo hay bultos sueltos
      // delante de los locales, y son los que quitan el filo de maqueta a la
      // hilera: sin ellos la acera es una línea recta perfecta.
      for (let i = 0; i < 3; i++) {
        const bulto = new THREE.Mesh(
          new THREE.BoxGeometry(0.5 + aleatorio() * 0.3, 0.42, 0.44),
          matBahia(BAHIA.carton, 0.03, 0.95),
        );
        bulto.position.set(
          (aleatorio() - 0.5) * largo, 0.21, LOCAL.FONDO / 2 + 0.4 + aleatorio() * 0.4,
        );
        bulto.rotation.y = (aleatorio() - 0.5) * 0.8;
        hilera.add(bulto);
      }

      // AQUÍ NO HAY TECHO NI PALMERAS, y las dos ausencias son deliberadas:
      //
      //   · La bóveda cruza la calle ENTERA y la monta el escenario
      //     (scenes/BahiaScene.js), no el decorado. Puesta a los lados serían
      //     dos medias bóvedas que se reciclan por su cuenta y no casan por el
      //     eje de la calle.
      //   · Las palmeras se fueron a las Elecciones, que es la escena de
      //     calle abierta. La Bahía es un pasaje cubierto: dentro no crece una
      //     palmera, y si asoma por encima del techo es que el techo no está.
      //
      // Lo que queda aquí es lo que sí es de la acera: los puestos.
      // La columna del techo. Va a la altura de las del archivo (3,90) y
      // apoyada en el borde del andén, no flotando delante de los puestos.
      const columna = new THREE.Mesh(
        new THREE.BoxGeometry(0.19, 3.9, 0.19),
        matBahia(BAHIA.aceroClaro, 0.02, 0.55),
      );
      columna.position.set(largo / 2 - 0.4, 1.95, LOCAL.FONDO / 2 + 0.9);
      hilera.add(columna);

      // El andén: el bordillo corrido que separa la acera del pasillo. Es una
      // línea continua a lo largo de la manzana y ayuda a leer la hilera como
      // una sola pieza en vez de seis locales sueltos.
      hilera.add(_caja(largo, 0.14, 0.5, matBahia(BAHIA.concretoOscuro, 0.03, 0.9),
        0, 0.07, LOCAL.FONDO / 2 + 0.95));

      // La hilera va ALINEADA: ni desviación lateral ni escala al azar. Una
      // fila de puestos torcidos y de tamaños distintos no se lee como
      // desorden, se lee como fallo de colocación. Y en el mercado importa el
      // doble, porque lo que lo hace mercado es que la cornisa sea una sola
      // línea de punta a punta.
      g.userData.alineado = true;

      // Seis locales son unas doscientas cajas. Fundidas por material bajan a
      // una docena de mallas y la hilera entera cuesta menos que los tres
      // puestos de antes. Ver fundirPorMaterial().
      const fundida = fundirPorMaterial(hilera);
      fundida.scale.setScalar(ESCALA);
      g.add(fundida);
      break;
    }

    case 'apagon': {
      // Torres de generación y tuberías. Casi sin luz propia.
      const alto = 5 + aleatorio() * 6;
      const torre = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.35, alto, 7),
        mat(colores.props, 0.03, 0.95),
      );
      torre.position.y = alto / 2;
      g.add(torre);

      // Aros de refuerzo: dan escala a la torre.
      for (let i = 1; i <= 3; i++) {
        const aro = new THREE.Mesh(
          new THREE.TorusGeometry(1.15 - i * 0.06, 0.07, 5, 12),
          mat(0x2a2f3d, 0.02),
        );
        aro.rotation.x = Math.PI / 2;
        aro.position.y = (alto / 4) * i;
        g.add(aro);
      }

      // Luz piloto: casi el único punto de luz del escenario.
      const piloto = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 6, 5),
        neon(aleatorio() > 0.6 ? NEON.rojo : colores.acento, 1.9),
      );
      piloto.position.y = alto + 0.28;
      g.add(piloto);

      const tuberia = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 7, 7),
        mat(colores.props, 0.03, 0.95),
      );
      tuberia.rotation.z = Math.PI / 2;
      tuberia.position.set(0, 1.5, 2.6);
      g.add(tuberia);
      break;
    }

    case 'elecciones': {
      // UNA CUADRA DE GUAYAQUIL, no un cubo con una valla al lado.
      //
      // Aquí había un prisma de tres metros con el color del escenario y, de
      // vez en cuando, una valla de neón. O sea: nada. Las Elecciones son la
      // escena de calle abierta y la calle tenía que ser una calle de verdad,
      // y la de esa costa tiene una gramática muy reconocible —soportal de
      // columnas pintadas, persianas abajo, banda de ventanas arriba y remate
      // plano—. Ver crearCasaGuayaquil().
      //
      // Van dos casas de anchos desiguales, como los solares: partir la cuadra
      // por la mitad exacta canta a rejilla.
      const ANCHO_CUADRA = 13.5;
      const primera = ANCHO_CUADRA / 2 + (aleatorio() - 0.5) * 2.4;
      const cuadraGye = new THREE.Group();
      for (const [ancho, x] of [
        [primera, -ANCHO_CUADRA / 2 + primera / 2],
        [ANCHO_CUADRA - primera, ANCHO_CUADRA / 2 - (ANCHO_CUADRA - primera) / 2],
      ]) {
        const casa = crearCasaGuayaquil(ancho, aleatorio);
        casa.position.x = x;
        cuadraGye.add(casa);
      }

      // Fundida por material: dos casas son unas noventa cajas y en pantalla
      // hay una veintena de cuadras a la vez.
      g.add(fundirPorMaterial(cuadraGye));

      // EL CAMIÓN DE LA CARAVANA. No en todas las cuadras: una caravana es un
      // acontecimiento, y si hay un camión en cada esquina deja de serlo.
      if (aleatorio() > 0.62) {
        // EL CAMIÓN NO CABE A TAMAÑO REAL, y hay que decirlo: entre la fachada
        // y el borde del carril hay 1,30 de vereda, y un camión mide 2,20 de
        // ancho. A tamaño literal se metía casi hasta el eje de la calle y el
        // jugador lo atravesaba por el carril de fuera. A 0,72 queda un
        // camioncito de tres metros y medio aparcado contra el cordón, que es
        // lo que se ve de refilón a la velocidad a la que se pasa.
        const camion = crearCamionCampana(aleatorio);
        camion.scale.setScalar(0.72);
        camion.position.set((aleatorio() - 0.5) * 5, 0, 2.25);
        camion.rotation.y = Math.PI / 2 + (aleatorio() - 0.5) * 0.24;
        g.add(camion);
      } else if (aleatorio() > 0.5) {
        // Y donde no hay camión, la valla de siempre: el cartel de campaña
        // sigue siendo del sitio.
        const valla = crearValla(colores.acento, aleatorio);
        valla.position.z = 2.7;
        g.add(valla);
      }

      // LAS PALMERAS VIVEN AQUÍ. Estaban en la Bahía, que es un pasaje
      // techado: una palmera dentro de un mercado cubierto no crece, y si
      // asomaba por encima del techo lo que decía era que no había techo.
      // Esta es la escena de calle abierta —avenida en campaña—, así que es
      // donde toca el arbolado.
      if (aleatorio() > 0.55) {
        const palmera = crearPalmera(5.5 + aleatorio() * 3);
        palmera.position.set((aleatorio() - 0.5) * 9, 0, 2.6);
        g.add(palmera);
      }

      // La cuadra va ALINEADA, por lo mismo que la del centro histórico y la
      // hilera de la Bahía: una fila de fachadas torcidas y de tamaños
      // distintos se lee como error de colocación, no como desorden.
      g.userData.alineado = true;
      break;
    }

    case 'carondelet': {
      // UNA CUADRA, no una casa suelta. El centro histórico son fachadas
      // pegadas: medianera con medianera, sin un palmo entre una y otra. Con
      // casas separadas por hueco aquello deja de ser el casco colonial y pasa
      // a ser un barrio de quintas.
      //
      // Son la MISMA casa repetida —zócalo, dos plantas, cornisa, alero y
      // teja— y lo que cambia es el revoque, cuántos portales tiene y si el
      // balcón es corrido o de a uno. Esa es la gramática de la calle:
      // repetirla se lee como un barrio, y repetir un modelo fijo, como un
      // bucle.
      const ANCHO_CUADRA = 14;
      // Anchos desiguales, que es como están los solares de verdad: partir la
      // cuadra en dos mitades exactas canta a rejilla.
      const primera = ANCHO_CUADRA / 2 + (aleatorio() - 0.5) * 2.6;
      for (const [ancho, x] of [
        [primera, -ANCHO_CUADRA / 2 + primera / 2],
        [ANCHO_CUADRA - primera, ANCHO_CUADRA / 2 - (ANCHO_CUADRA - primera) / 2],
      ]) {
        const casa = crearCasaColonial(ancho, aleatorio);
        casa.position.x = x;
        g.add(casa);
      }

      // Concertina sobre el alero. Es lo que hace que la postal colonial
      // incomode, y por eso se queda.
      for (let i = 0; i < 3; i++) {
        const rollo = new THREE.Mesh(
          new THREE.TorusGeometry(0.36, 0.05, 4, 11),
          mat(0x9aa4b8, 0.3, 0.4),
        );
        rollo.position.set(-1 + i, 6.6, 0.4);
        rollo.rotation.y = Math.PI / 2;
        g.add(rollo);
      }

      // La cuadra entera se funde de una vez, no casa por casa: como los
      // materiales van compartidos, las dos casas y la concertina caben en
      // media docena de mallas en total.
      const cuadra = fundirPorMaterial(g);
      g.clear();
      g.add(cuadra);

      // La hilera va a escuadra: una cuadra torcida se lee como error de
      // colocación, no como desorden de barrio.
      g.userData.alineado = true;
      break;
    }

    default: {
      const alto = 3 + aleatorio() * 4;
      const bloque = new THREE.Mesh(
        new THREE.BoxGeometry(3, alto, 3),
        mat(colores.props, 0.05, 0.9),
      );
      bloque.position.y = alto / 2;
      g.add(bloque);
    }
  }

  // Farola de vez en cuando, en cualquier escenario: marcan el ritmo del
  // avance y dan puntos de luz que el bloom recoge.
  if (dado > 0.55 && dado <= 0.82 && idEscenario !== 'elecciones') {
    const farola = crearFarola(idEscenario === 'apagon' ? 0x6688aa : 0xffd28a);
    farola.position.set(-1.8, 0, 0);
    g.add(farola);
  }

  return g;
}

// ---------------------------------------------------------------------------
// BIFURCACIÓN
// ---------------------------------------------------------------------------

/**
 * Cartel de destino, con el nombre escrito en una textura de canvas.
 * Aquí SÍ va texto de verdad: el jugador tiene que poder leer a dónde lleva
 * cada carril con tiempo para colocarse, y unas barras abstractas no sirven.
 */
function crearCartelDestino(texto, colorAcento, esPeligro = false) {
  const g = new THREE.Group();

  const tex = textura(`cartel:${texto}:${colorAcento}:${esPeligro}`, (ctx, w, h) => {
    // Fondo
    ctx.fillStyle = esPeligro ? '#2a0a10' : '#0d1220';
    ctx.fillRect(0, 0, w, h);

    // Marco
    ctx.strokeStyle = esPeligro ? '#ff1030' : `#${colorAcento.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Texto. Se reduce el tamaño hasta que quepa: los nombres de escenario
    // varían mucho de largo ("BAHÍA" contra "LAS ELECCIONES").
    ctx.fillStyle = esPeligro ? '#ff4d66' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let tam = 60;
    do {
      ctx.font = `900 ${tam}px system-ui, sans-serif`;
      tam -= 2;
    } while (ctx.measureText(texto).width > w - 40 && tam > 14);

    ctx.fillText(texto, w / 2, h / 2);
  }, 512, 160);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 0.64, 0.09),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.85,
      roughness: 0.4,
      toneMapped: false,
      // Los carteles NO se atenúan con la niebla. Es lo mismo que pasa con la
      // señalización iluminada de verdad: corta la bruma. Sin esto el jugador
      // no puede leer los destinos hasta tenerlos a 30 m, que a velocidad de
      // crucero es poco más de un segundo para decidir.
      fog: false,
    }),
  );
  g.add(panel);

  return g;
}

/**
 * LOS TRES TÚNELES — el desvío físico.
 *
 * La calle no se abre en ramales al aire libre: termina contra una fachada con
 * tres bocas de túnel, una por carril. El túnel resuelve de golpe lo que el
 * desvío hacía a medias:
 *
 *   · Una boca tiene BORDE. Se lee a 200 metros como una figura recortada,
 *     mientras que dos calles que divergen en la niebla son una mancha.
 *   · Entrar es un gesto inequívoco. No hay "casi tomé el desvío": o pasas por
 *     el hueco o te comes el muro.
 *   · Lo que hay dentro no se ve, y ese es justo el punto: sabes a qué
 *     temporada vas porque lo dice el rótulo, no porque la veas.
 *
 * El túnel del CENTRO es la vía institucional. Cuando el escenario no tiene
 * institución (Carondelet) esa boca está tapiada: es el cerco.
 *
 * @param {{izquierda:string, centro:string, derecha:string}} destinos
 * @param {boolean} centroEsPeligro Si ir de frente mata (Carondelet)
 */

// ---------------------------------------------------------------------------
// EL CRUCE — Los edificios que bifurcan
// ---------------------------------------------------------------------------
// Antes había una fachada abstracta con tres bocas de túnel dibujadas: un
// paredón con tres agujeros, igual en las cuatro escenas y sin pertenecer a
// ninguna. Cumplía la función —marcaba dónde se decide— pero mentía sobre el
// sitio: en el centro histórico no hay bocas de túnel, hay una esquina con un
// palacio enfrente.
//
// Ahora bifurca la CIUDAD. De frente está el edificio de la institución, con su
// puerta, que es por donde se entra al trámite. A los lados no hay boca
// ninguna: la calle sigue, y lo que la enmarca son las medianeras de las casas
// del barrio. Entrar por un costado es doblar la esquina, no meterse por un
// agujero.
//
// La geometría respeta lo que ya sabía leer el jugador: el hueco del centro
// sigue estando en el carril del centro y los laterales siguen alineados con
// los suyos, porque eso es lo que decide la partida y no puede cambiar por un
// cambio de aspecto.

/**
 * @param {string} nombre        Rótulo de la institución del centro
 * @param {object} colores       Paleta del escenario
 * @param {boolean} centroEsPeligro El de frente es el cerco, no una entrada
 */
export function crearCruceDeEdificios(nombre, colores, centroEsPeligro = false,
                                      idEscenario = null) {
  const g = new THREE.Group();
  const acento = colores.acento ?? COLOR3D.dorado;
  const hueco = CARRILES.ANCHO * 1.02;   // por donde se pasa, en cada carril

  // --- El edificio del centro ----------------------------------------------
  // EL EDIFICIO DE VERDAD, si lo hay. La Fiscalía en la Bahía, la Asamblea en
  // el Apagón, Carondelet en el centro histórico: los modelados, no una caja
  // con un rótulo. Es lo que se tiene delante al decidir, así que es donde más
  // se nota la diferencia entre un edificio y un sustituto.
  //
  // Viene ya asentado por clonarEdificioDelCruce(): centrado en la calle, a ras
  // de asfalto y con la fachada en z = 0. Aquí solo se retranquea el medio
  // metro que hace falta para que el marco del portal quede POR DELANTE de la
  // piedra y no empotrado en ella.
  const real = clonarEdificioDelCruce(idEscenario);
  if (real) {
    real.position.z -= 0.6;
    g.add(real);
  } else {
    // Las Elecciones no tienen edificio modelado: ahí sigue la fachada
    // procedural, que al menos lleva el rótulo bien puesto.
    const fachada = crearFachadaInstitucion(nombre, colores, centroEsPeligro);
    fachada.position.z = -2;
    g.add(fachada);
  }

  // El portal, recortado sobre la fachada: un marco iluminado a la altura del
  // carril central. No es un agujero en la geometría —eso obligaría a CSG— sino
  // un vano oscuro con su marco, que a esta velocidad se lee igual.
  if (!centroEsPeligro) {
    const vano = new THREE.Mesh(
      new THREE.BoxGeometry(hueco, 4.6, 0.5),
      mat(0x05070c, 0.0, 1),
    );
    vano.position.set(0, 2.3, 0.2);
    g.add(vano);

    const marco = new THREE.Mesh(
      new THREE.BoxGeometry(hueco + 0.7, 5.3, 0.35),
      neon(acento, 1.35),
    );
    marco.position.set(0, 2.65, 0.05);
    g.add(marco);
    // El marco se ve por delante del vano, así que el vano tapa su centro y lo
    // que queda es un rectángulo de luz: el portal.
    vano.position.z = 0.3;
  }

  // --- Las medianeras que enmarcan los laterales ---------------------------
  // Dos bloques de casa que dejan pasar por fuera. No cierran la calle: la
  // estrechan, que es lo que hace una esquina.
  for (const lado of [-1, 1]) {
    const medianera = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 7.5, 4),
      mat(colores.props ?? 0x8a7f6d, 0.03, 0.95),
    );
    medianera.position.set(lado * (CARRILES.ANCHO * 1.5 + 1.6), 3.75, -2);
    g.add(medianera);

    // Rótulo de esquina con el nombre de la calle: es lo que convierte un
    // bloque en una esquina de verdad.
    const chapa = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.5, 0.12),
      neon(acento, 0.9),
    );
    chapa.position.set(lado * (CARRILES.ANCHO * 1.5 + 1.6), 5.4, 0.1);
    g.add(chapa);
  }

  return g;
}

/**
 * EL PASO LATERAL — la cinemática de doblar la esquina.
 *
 * Entrar por un costado cambiaba el decorado de golpe, tapado con un destello.
 * Funcionaba, pero no se sentía como ir a ninguna parte: la calle era otra sin
 * que hubiera pasado nada. Esto es un pasaje corto —soportales, que es como se
 * pasa de una calle a otra en un casco antiguo— que se atraviesa mientras el
 * barrio de detrás se sustituye por el nuevo.
 *
 * Es el mismo recurso que el pasillo del trámite y a propósito: lo que separa
 * una escena de otra es cruzar algo, no un corte.
 */
export function crearPasoLateral(largo, colores) {
  const g = new THREE.Group();
  const acento = colores.acento ?? COLOR3D.dorado;
  const ancho = CARRILES.ANCHO * 3 + 2.4;
  const alto = 6.2;

  // Techo del soportal. Segmentado a lo largo por la curvatura del mundo:
  // treinta metros de viga recta sobre una calle que se dobla se leen como un
  // error de encaje. Ver utils/curvatura.js.
  const segmentos = Math.max(2, Math.round(largo / 4));
  const techo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho + 1.2, 0.5, largo, 1, 1, segmentos),
    mat(colores.props ?? 0x6b5f4d, 0.03, 0.95),
  );
  techo.position.set(0, alto, -largo / 2);
  g.add(techo);

  // Los dos muros, con sus arcos. El interior va oscuro para que la salida al
  // fondo se lea como salida.
  for (const lado of [-1, 1]) {
    const muro = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, alto, largo, 1, 1, segmentos),
      mat(0x2c2b30, 0.02, 0.97),
    );
    muro.position.set(lado * (ancho / 2), alto / 2, -largo / 2);
    g.add(muro);

    // Columnas cada pocos metros: son las que dan el ritmo al pasar y hacen
    // que se note la velocidad dentro del pasaje.
    const cuantas = Math.max(2, Math.round(largo / 6));
    for (let i = 0; i < cuantas; i++) {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, alto, 0.85),
        mat(colores.props ?? 0x8a7f6d, 0.03, 0.95),
      );
      col.position.set(lado * (ancho / 2 - 0.4), alto / 2, -(largo / cuantas) * i);
      g.add(col);

      const farol = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), neon(acento, 1.6));
      farol.position.set(lado * (ancho / 2 - 1), alto - 1.2, -(largo / cuantas) * i);
      g.add(farol);
    }
  }

  return g;
}

export function crearTunelesBifurcacion(destinos, colores, centroEsPeligro = false) {
  const g = new THREE.Group();

  const acento = colores.acento ?? COLOR3D.dorado;
  const medioAncho = TUNEL.ANCHO_BOCA / 2;
  const grosorPilar = CARRILES.ANCHO - TUNEL.ANCHO_BOCA; // 0.3 con los valores actuales

  const matMuro = mat(0x2b3040, 0.03, 0.94);
  const matInterior = mat(0x151a26, 0.02, 0.96);

  const bocas = [
    { texto: destinos.izquierda, carril: 0, peligro: false },
    { texto: destinos.centro, carril: 1, peligro: centroEsPeligro },
    { texto: destinos.derecha, carril: 2, peligro: false },
  ];

  // --- Fachada -------------------------------------------------------------
  // Se compone por partes en vez de agujerear una caja: dintel arriba, pilares
  // entre bocas y dos machones a los lados. Sale más barato que cualquier CSG
  // y además deja los bordes exactamente donde interesa.
  const altoDintel = TUNEL.ALTO_FACHADA - TUNEL.ALTO_BOCA;
  const dintel = new THREE.Mesh(
    new THREE.BoxGeometry(TUNEL.ANCHO_FACHADA, altoDintel, 1.8),
    matMuro,
  );
  dintel.position.y = TUNEL.ALTO_BOCA + altoDintel / 2;
  g.add(dintel);

  // Pilares interiores, entre boca y boca.
  for (const x of [-CARRILES.ANCHO / 2, CARRILES.ANCHO / 2]) {
    const pilar = new THREE.Mesh(
      new THREE.BoxGeometry(grosorPilar, TUNEL.ALTO_BOCA, 1.8),
      matMuro,
    );
    pilar.position.set(x, TUNEL.ALTO_BOCA / 2, 0);
    g.add(pilar);
  }

  // Machones exteriores: cierran la calle a los lados. Sin ellos el jugador
  // podría leer que hay sitio por fuera, y no lo hay.
  const bordeExterior = CARRILES.ANCHO + medioAncho;
  const anchoMachon = TUNEL.ANCHO_FACHADA / 2 - bordeExterior;
  for (const s of [-1, 1]) {
    const machon = new THREE.Mesh(
      new THREE.BoxGeometry(anchoMachon, TUNEL.ALTO_BOCA, 1.8),
      matMuro,
    );
    machon.position.set(s * (bordeExterior + anchoMachon / 2), TUNEL.ALTO_BOCA / 2, 0);
    g.add(machon);
  }

  // --- Cada boca -----------------------------------------------------------
  for (const b of bocas) {
    const x = CARRILES.POSICIONES[b.carril];
    const color = b.peligro ? NEON.rojo : acento;

    // Tubo: dos paredes, techo y calzada. El interior va casi negro para que
    // la boca se lea como un hueco y no como un panel pintado.
    for (const s of [-1, 1]) {
      const pared = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, TUNEL.ALTO_BOCA, TUNEL.LARGO),
        matInterior,
      );
      pared.position.set(x + s * medioAncho, TUNEL.ALTO_BOCA / 2, -TUNEL.LARGO / 2);
      g.add(pared);
    }

    const techo = new THREE.Mesh(
      new THREE.BoxGeometry(TUNEL.ANCHO_BOCA, 0.25, TUNEL.LARGO),
      matInterior,
    );
    techo.position.set(x, TUNEL.ALTO_BOCA, -TUNEL.LARGO / 2);
    g.add(techo);

    const calzada = new THREE.Mesh(
      new THREE.PlaneGeometry(TUNEL.ANCHO_BOCA, TUNEL.LARGO),
      new THREE.MeshStandardMaterial({
        color: colores.calle ?? COLOR3D.asfalto,
        roughness: 0.94,
        metalness: 0.04,
      }),
    );
    calzada.rotation.x = -Math.PI / 2;
    calzada.position.set(x, 0.02, -TUNEL.LARGO / 2);
    g.add(calzada);

    // Marco de neón alrededor del hueco. Es lo que hace que la boca se
    // distinga de lejos: un rectángulo de luz sobre una fachada apagada.
    const matMarco = neon(color, 1.9);
    const marcoH = new THREE.BoxGeometry(TUNEL.ANCHO_BOCA + 0.3, 0.16, 0.16);
    const marcoV = new THREE.BoxGeometry(0.16, TUNEL.ALTO_BOCA, 0.16);
    for (const y of [0.1, TUNEL.ALTO_BOCA - 0.08]) {
      const barra = new THREE.Mesh(marcoH, matMarco);
      barra.position.set(x, y, 0.95);
      g.add(barra);
    }
    for (const s of [-1, 1]) {
      const barra = new THREE.Mesh(marcoV, matMarco);
      barra.position.set(x + s * (medioAncho + 0.07), TUNEL.ALTO_BOCA / 2, 0.95);
      g.add(barra);
    }

    // Luminarias del interior, en fuga. Dan profundidad al tubo y confirman
    // que hay algo dentro: sin ellas, la boca se lee como un rectángulo negro
    // pegado a la pared.
    const matLuz = neon(b.peligro ? NEON.rojo : NEON.blanco, 1.5);
    for (let i = 1; i <= 9; i++) {
      const luz = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.28), matLuz);
      luz.position.set(x, TUNEL.ALTO_BOCA - 0.22, -i * (TUNEL.LARGO / 10));
      g.add(luz);
    }

    // Resplandor justo dentro del hueco. Sin esto la boca es un rectángulo
    // negro pegado a la pared; con esto se lee que ahí dentro hay sitio.
    const resplandor = new THREE.Mesh(
      new THREE.PlaneGeometry(TUNEL.ANCHO_BOCA, TUNEL.ALTO_BOCA),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    resplandor.position.set(x, TUNEL.ALTO_BOCA / 2, -1.6);
    g.add(resplandor);

    // Rótulo sobre la boca, alineado con su carril.
    const cartel = crearCartelDestino(b.texto, color, b.peligro);
    cartel.scale.setScalar(1.12);
    cartel.position.set(x, TUNEL.ALTO_BOCA + 0.75, 0.98);
    g.add(cartel);

    if (b.peligro) {
      // La boca del centro en Carondelet está tapiada con concertina. Sigue
      // siendo un hueco —el jugador puede meterse— pero se ve que no es una
      // salida, es una trampa.
      for (let i = 0; i < 4; i++) {
        const rollo = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.06, 4, 10),
          mat(0x9aa4b8, 0.3, 0.4),
        );
        rollo.position.set(x, 0.55 + i * 0.85, 0.6);
        rollo.rotation.y = Math.PI / 2;
        g.add(rollo);
      }
    }
  }

  // --- Cornisa iluminada ---------------------------------------------------
  // Una línea de luz que recorre el dintel de lado a lado. Ata las tres bocas
  // en una sola pieza y remata la silueta contra la niebla.
  const cornisa = new THREE.Mesh(
    new THREE.BoxGeometry(TUNEL.ANCHO_FACHADA, 0.2, 0.24),
    neon(acento, 1.5),
  );
  cornisa.position.set(0, TUNEL.ALTO_FACHADA - 0.5, 0.95);
  g.add(cornisa);

  return g;
}

/**
 * CARTEL DE AVISO — el que se ve venir desde lejos.
 *
 * Es un pórtico de señalización de autopista: dos postes, una viga y tres
 * paneles. Se planta a 230, 150 y 80 metros de la boca, de modo que siempre
 * haya uno legible en cuadro mientras el jugador se coloca.
 *
 * No está alineado con los carriles al milímetro como el pórtico antiguo: aquí
 * lo que importa es leerlo, y por eso los paneles van grandes y muy arriba,
 * donde nada los tapa.
 */
export function crearAvisoBifurcacion(destinos, colores, centroEsPeligro = false) {
  const g = new THREE.Group();
  const acento = colores.acento ?? COLOR3D.dorado;
  const ancho = 12.4;
  const alto = 7.4;

  for (const s of [-1, 1]) {
    const poste = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, alto, 0.3),
      mat(COLOR3D.metal, 0.06, 0.85),
    );
    poste.position.set(s * (ancho / 2), alto / 2, 0);
    g.add(poste);
  }

  const viga = new THREE.Mesh(
    new THREE.BoxGeometry(ancho + 0.3, 0.32, 0.34),
    mat(COLOR3D.metal, 0.06, 0.85),
  );
  viga.position.y = alto;
  g.add(viga);

  const paneles = [
    { texto: destinos.izquierda, dir: 'izquierda', x: -3.6, peligro: false },
    { texto: destinos.centro, dir: 'centro', x: 0, peligro: centroEsPeligro },
    { texto: destinos.derecha, dir: 'derecha', x: 3.6, peligro: false },
  ];

  for (const p of paneles) {
    const color = p.peligro ? NEON.rojo : acento;

    const cartel = crearCartelDestino(p.texto, color, p.peligro);
    cartel.scale.setScalar(1.5);
    cartel.position.set(p.x, alto - 0.95, 0.1);
    g.add(cartel);

    // Flecha bajo el panel, inclinada hacia su lado.
    const flecha = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.55, 3),
      neon(color, 1.9),
    );
    flecha.position.set(p.x, alto - 2.2, 0.1);
    flecha.rotation.z = Math.PI;
    if (p.dir === 'izquierda') flecha.rotation.z = Math.PI * 0.75;
    if (p.dir === 'derecha') flecha.rotation.z = Math.PI * 1.25;
    g.add(flecha);
  }

  return g;
}

/**
 * TARIMA — el nivel de arriba.
 *
 * Es la versión local de los trenes de Subway Surfers: un tablado de campaña
 * con su rampa de acceso. Se sube corriendo por la rampa (no hay que hacer
 * nada, el impulso lo da ella) y arriba se corre por encima de la calle.
 *
 * La lectura tiene que ser inmediata a distancia: rampa clara delante, borde
 * de neón marcando la altura, y el faldón con la lona de campaña. Si el
 * jugador duda de si eso se sube o se esquiva, está mal.
 *
 * El origen del grupo está en el PIE DE LA RAMPA, que es el punto donde el
 * jugador la toca. Todo lo demás va hacia -Z.
 *
 * @param {number} largo Longitud del tablado (sin contar la rampa)
 */

// ---------------------------------------------------------------------------
// VESTIR LA TARIMA
// ---------------------------------------------------------------------------
// Una tarima de obra en mitad del centro histórico no significa nada: es un
// cajón elevado y punto. Lo que sí significa algo es SUBIRSE POR ENCIMA DE algo
// que está ahí por una razón —buses parados en fila, contenedores apilados en
// el muelle—, y de paso el juego deja de tener una pieza abstracta.
//
// La regla es la misma que con los obstáculos: la SUPERFICIE no se toca. El
// alto transitable, el ancho y la rampa siguen donde estaban, porque son lo que
// el jugador tiene que leer para saber que se sube. Lo que cambia es qué hay
// debajo sosteniéndola.

/** Buses en fila, uno tras otro. Se corre por encima del techo. */
function _busesBajoTarima(g, largo, ancho, alto) {
  // Cada bus mide unos ocho metros, así que un tramo de veinte lleva dos y
  // pico. Se recortan al largo exacto: medio bus asomando por el final se lee
  // como que la plataforma se acaba antes de tiempo.
  const LARGO_BUS = 8.4;
  const cuantos = Math.max(1, Math.round(largo / LARGO_BUS));
  const paso = largo / cuantos;

  for (let i = 0; i < cuantos; i++) {
    const z = -i * paso - paso / 2;
    const carroceria = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 0.94, alto * 0.86, paso * 0.94),
      mat(i % 2 ? 0xd9d2c4 : 0xe8e2d6, 0.03, 0.9),
    );
    carroceria.position.set(0, alto * 0.43, z);
    g.add(carroceria);

    // Franja de color a media altura: es lo que hace que un cajón blanco se
    // lea como un bus urbano y no como un contenedor.
    const franja = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 0.96, 0.26, paso * 0.9),
      mat(0x2f6fb0, 0.14, 0.8),
    );
    franja.position.set(0, alto * 0.52, z);
    g.add(franja);

    // Ventanillas corridas por los dos costados.
    for (const lado of [-1, 1]) {
      const cristal = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.44, paso * 0.78),
        mat(0x1d2735, 0.05, 0.35),
      );
      cristal.position.set(lado * ancho * 0.47, alto * 0.7, z);
      g.add(cristal);
    }

    // Ruedas. Sin ellas la fila se lee como cajas apiladas.
    for (const lado of [-1, 1]) {
      for (const dz of [paso * 0.3, -paso * 0.3]) {
        const rueda = new THREE.Mesh(
          new THREE.CylinderGeometry(0.34, 0.34, 0.2, 8),
          mat(0x14161c, 0.02, 0.85),
        );
        rueda.rotation.z = Math.PI / 2;
        rueda.position.set(lado * ancho * 0.45, 0.34, z + dz);
        g.add(rueda);
      }
    }
  }
}

/** Contenedores de puerto, apilados. La Bahía es mercadería en tránsito. */
function _contenedoresBajoTarima(g, largo, ancho, alto) {
  const LARGO_CAJA = 6.2;
  const COLORES = [0xc63a41, 0x326da6, 0x2f7d52, 0xd08a2a];
  const cuantos = Math.max(1, Math.round(largo / LARGO_CAJA));
  const paso = largo / cuantos;

  for (let i = 0; i < cuantos; i++) {
    const z = -i * paso - paso / 2;
    const caja = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 0.96, alto * 0.94, paso * 0.96),
      mat(COLORES[i % COLORES.length], 0.05, 0.92),
    );
    caja.position.set(0, alto * 0.47, z);
    g.add(caja);

    // Corrugado: cuatro nervios verticales por costado. Es la firma de un
    // contenedor y sale casi gratis.
    for (const lado of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const nervio = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, alto * 0.8, 0.12),
          mat(COLORES[i % COLORES.length], 0.02, 0.95),
        );
        nervio.position.set(
          lado * ancho * 0.49, alto * 0.47, z - paso * 0.35 + (paso * 0.7 / 3) * k,
        );
        g.add(nervio);
      }
    }
  }
}

export function crearTarima(largo, colores, idEscenario = 'bahia') {
  const g = new THREE.Group();
  const acento = colores.acento ?? COLOR3D.dorado;
  const ancho = CARRILES.ANCHO * 0.92;
  const h = ELEVADO.ALTURA;

  // --- Rampa ---------------------------------------------------------------
  // Se inclina hacia -Z: el extremo lejano es el que sube. Al girar sobre X un
  // ángulo positivo, el vértice en -Z se levanta, que es justo lo que hace
  // falta para que el jugador la suba de frente.
  const anguloRampa = Math.atan2(h, ELEVADO.LARGO_RAMPA);
  const largoInclinado = Math.hypot(h, ELEVADO.LARGO_RAMPA);

  const rampa = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, 0.22, largoInclinado),
    mat(colores.props ?? COLOR3D.madera, 0.16, 0.72),
  );
  rampa.rotation.x = anguloRampa;
  rampa.position.set(0, h / 2, -ELEVADO.LARGO_RAMPA / 2);
  g.add(rampa);

  // Chevrones en la rampa: es la señal universal de "por aquí se sube".
  const banda = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho * 0.9, largoInclinado * 0.9),
    new THREE.MeshStandardMaterial({
      map: texturaChevron(),
      emissive: 0xffffff,
      emissiveMap: texturaChevron(),
      emissiveIntensity: 0.5,
      roughness: 0.6,
      toneMapped: false,
    }),
  );
  banda.rotation.x = -Math.PI / 2 + anguloRampa;
  banda.position.set(0, h / 2 + 0.13, -ELEVADO.LARGO_RAMPA / 2);
  g.add(banda);

  // --- Tablado -------------------------------------------------------------
  const zInicio = -ELEVADO.LARGO_RAMPA;
  // Con segmentos a lo largo: el tablado mide 20-35 metros y la curvatura del
  // mundo dobla por vértice — sin ellos quedaría tendido recto sobre una calle
  // que se curva por debajo. Ver utils/curvatura.js.
  const tablero = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, 0.26, largo, 1, 1, Math.max(2, Math.round(largo / 4))),
    new THREE.MeshStandardMaterial({
      map: texturaMadera(),
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    }),
  );
  tablero.position.set(0, h - 0.13, zInicio - largo / 2);
  g.add(tablero);

  // --- QUÉ SOSTIENE EL TABLADO ---------------------------------------------
  // Una tarima de obra en mitad del centro histórico no significa nada: es un
  // cajón elevado y punto. Lo que sí significa algo es subirse POR ENCIMA de
  // algo que está ahí por una razón. Debajo van buses parados en fila o
  // contenedores del muelle, según el barrio.
  //
  // La superficie no se toca: el alto, el ancho y la rampa siguen donde
  // estaban, porque son lo que el jugador lee para saber que se sube. Lo que
  // cambia es lo que hay debajo.
  const bajo = new THREE.Group();
  bajo.position.z = zInicio;
  if (idEscenario === 'bahia') _contenedoresBajoTarima(bajo, largo, ancho, h);
  else _busesBajoTarima(bajo, largo, ancho, h);
  g.add(bajo);

  // Borde de neón a ambos lados, a la altura de la superficie. Es lo que
  // comunica DÓNDE está el suelo nuevo: sin esta línea, desde arriba no se
  // distingue el filo y el jugador se cae sin entender por qué.
  const matBorde = neon(acento, 1.7);
  for (const s of [-1, 1]) {
    const borde = new THREE.Mesh(
      // Segmentado a lo largo, como el tablero: es la línea que marca el filo
      // y la que más cantaría si quedara recta sobre la calle curvada.
      new THREE.BoxGeometry(0.1, 0.12, largo + ELEVADO.LARGO_RAMPA,
        1, 1, Math.max(2, Math.round(largo / 4))),
      matBorde,
    );
    borde.position.set(
      s * (ancho / 2),
      h + 0.06,
      zInicio - largo / 2 + ELEVADO.LARGO_RAMPA / 2,
    );
    g.add(borde);
  }

  // Patas de andamio. Van en pares, cada 6 metros.
  const matPata = mat(COLOR3D.metal, 0.05, 0.85);
  for (let z = zInicio - 1.5; z > zInicio - largo; z -= 6) {
    for (const s of [-1, 1]) {
      const pata = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), matPata);
      pata.position.set(s * (ancho / 2 - 0.16), h / 2, z);
      g.add(pata);
    }
  }

  // Faldón del fondo, para que el tablado tenga final visible y el jugador
  // sepa cuándo se acaba el piso.
  const faldon = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, h, 0.2),
    mat(0x2a3040, 0.05, 0.9),
  );
  faldon.position.set(0, h / 2, zInicio - largo);
  g.add(faldon);

  const remate = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, 0.14, 0.26),
    neon(NEON.ambar, 1.8),
  );
  remate.position.set(0, h + 0.06, zInicio - largo);
  g.add(remate);

  return g;
}

/**
 * GALERÍA DEL TRÁMITE — el interior del túnel central.
 *
 * Un pasillo de tres carriles de ancho, cerrado, con la fachada de la
 * institución al fondo. No hay obstáculos aquí dentro y eso es deliberado: el
 * trámite no se pierde chocando, se pierde dejando papeles en el suelo.
 *
 * El origen está en la BOCA (donde entra el jugador) y todo va hacia -Z.
 *
 * @param {number} largo Profundidad de la galería
 * @param {string} nombre Nombre de la institución que la cierra al fondo
 */
export function crearGaleriaTramite(largo, colores, nombre) {
  const g = new THREE.Group();
  const acento = colores.acento ?? COLOR3D.dorado;
  const ancho = CARRILES.ANCHO * 3 + 3.4;

  // OJO CON LA ALTURA. La cámara va a 6.2 de alto: un techo por debajo de esa
  // cota deja de ser un techo y pasa a ser una tapa vista desde arriba, que es
  // literalmente lo que se veía —una mancha negra ocupando media pantalla—.
  // El techo tiene que quedar POR ENCIMA de la cámara.
  const alto = 9;

  const matMuro = mat(0x1a2030, 0.03, 0.93);

  // Segmentos a lo largo: el pasillo es la geometría más larga del juego y la
  // curvatura del mundo dobla por vértice. Ver utils/curvatura.js.
  const segmentosLargo = Math.max(2, Math.round(largo / 4));

  for (const s of [-1, 1]) {
    const pared = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, alto, largo, 1, 1, segmentosLargo),
      matMuro,
    );
    pared.position.set(s * (ancho / 2), alto / 2, -largo / 2);
    g.add(pared);
  }

  const techo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, 0.4, largo, 1, 1, segmentosLargo), matMuro);
  techo.position.set(0, alto, -largo / 2);
  g.add(techo);

  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, largo, 1, segmentosLargo),
    new THREE.MeshStandardMaterial({
      color: colores.calle ?? COLOR3D.asfalto,
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.set(0, 0.02, -largo / 2);
  g.add(suelo);

  // Arcos de luz cada 9 metros. Son la única referencia de avance que hay aquí
  // dentro: sin ellos el pasillo se lee como una imagen congelada. Y como el
  // techo tapa la luz direccional de la escena, son además casi toda la
  // iluminación del tramo, así que van generosos.
  const matArco = neon(acento, 1.35);
  const geoArcoH = new THREE.BoxGeometry(ancho - 0.6, 0.18, 0.34);
  const geoArcoV = new THREE.BoxGeometry(0.18, alto, 0.34);

  for (let z = -6; z > -largo; z -= 9) {
    const barra = new THREE.Mesh(geoArcoH, matArco);
    barra.position.set(0, alto - 0.35, z);
    g.add(barra);

    for (const s of [-1, 1]) {
      const lateral = new THREE.Mesh(geoArcoV, matArco);
      lateral.position.set(s * (ancho / 2 - 0.3), alto / 2, z);
      g.add(lateral);
    }
  }

  // Zócalo iluminado a ras de suelo, a los dos lados. Marca el ancho
  // transitable —que aquí no lo dicen los obstáculos, porque no hay— y evita
  // que el asfalto se funda con las paredes en una sola mancha negra.
  const matZocalo = neon(acento, 1.0);
  for (const s of [-1, 1]) {
    const zocalo = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, largo, 1, 1, segmentosLargo),
      matZocalo,
    );
    zocalo.position.set(s * (CARRILES.ANCHO * 1.6), 0.06, -largo / 2);
    g.add(zocalo);
  }

  // Archivadores contra las paredes: el decorado del sitio al que has entrado.
  const matArchivo = mat(0x39404f, 0.05, 0.88);
  for (let z = -14; z > -largo + 20; z -= 17) {
    for (const s of [-1, 1]) {
      const mueble = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 3.4), matArchivo);
      mueble.position.set(s * (ancho / 2 - 0.55), 1.1, z);
      g.add(mueble);
    }
  }

  const fachada = crearFachadaInstitucion(nombre, colores, false);
  fachada.position.z = -largo + 6;
  fachada.scale.setScalar(0.72);
  g.add(fachada);

  return g;
}

/**
 * POLICÍA de cerco. No corre ni esquiva: aparece cuando ya perdiste, así que
 * se construye para leerse de golpe —casco, visera, escudo— y nada más.
 */
export function crearPolicia() {
  const g = new THREE.Group();

  const matUniforme = mat(0x39415a, 0.16, 0.8);
  const matChaleco = mat(0x4a5470, 0.18, 0.75);

  const piernas = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.85, 0.34), matUniforme);
  piernas.position.y = 0.42;
  g.add(piernas);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.4), matChaleco);
  torso.position.y = 1.2;
  g.add(torso);

  // Bandas reflectantes. No son decoración: el cerco pasa de noche sobre
  // asfalto casi negro, y sin ellas cinco figuras azul oscuro sencillamente no
  // se ven. Son lo que convierte el corro en una imagen legible.
  const matBanda = neon(0xd8e4a0, 0.9);
  const banda = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.11, 0.42), matBanda);
  banda.position.y = 1.2;
  g.add(banda);

  const casco = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), matUniforme);
  casco.position.y = 1.72;
  g.add(casco);

  // Visera: el único punto brillante del modelo. Es lo que lo identifica.
  const visera = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.13, 0.06),
    neon(0x6fd8ff, 1.4),
  );
  visera.position.set(0, 1.7, 0.24);
  g.add(visera);

  const escudo = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.1, 0.07),
    new THREE.MeshStandardMaterial({
      color: 0x8fa6c4,
      transparent: true,
      opacity: 0.42,
      roughness: 0.25,
      metalness: 0.2,
    }),
  );
  escudo.position.set(0.16, 1.05, 0.36);
  escudo.rotation.y = -0.2;
  g.add(escudo);

  g.userData.escudo = escudo;
  return g;
}

/**
 * Fachada del edificio institucional que cierra el ramal central.
 * En Carondelet no es un edificio sino un cerco militar: mismo papel visual
 * —cerrar la calle— pero con lectura opuesta.
 */
export function crearFachadaInstitucion(nombre, colores, esCerco) {
  const g = new THREE.Group();
  const ancho = 16;
  const alto = esCerco ? 4.5 : 11;

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, 4),
    mat(esCerco ? 0x2a2228 : 0x3b3f4d, 0.04, 0.92),
  );
  cuerpo.position.y = alto / 2;
  g.add(cuerpo);

  if (esCerco) {
    // Muro bajo con concertina y luces de emergencia. No se entra.
    for (let i = -3; i <= 3; i++) {
      const rollo = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.06, 4, 10),
        mat(0x9aa4b8, 0.3, 0.4),
      );
      rollo.position.set(i * 2.1, alto + 0.4, 1.6);
      rollo.rotation.y = Math.PI / 2;
      g.add(rollo);
    }
    for (const s of [-1, 1]) {
      const luz = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.22, 0.3),
        neon(NEON.rojo, 1.9),
      );
      luz.position.set(s * 5, alto * 0.7, 2.05);
      g.add(luz);
    }
  } else {
    // Edificio institucional: columnas, escalinata y rótulo iluminado.
    for (let i = -3; i <= 3; i++) {
      const columna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.46, alto * 0.62, 8),
        mat(0xd8d2c4, 0.1, 0.85),
      );
      columna.position.set(i * 2.2, alto * 0.31, 2.1);
      g.add(columna);
    }

    // Frontón.
    const fronton = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 0.92, 1.1, 1.4),
      mat(0xd8d2c4, 0.1, 0.85),
    );
    fronton.position.set(0, alto * 0.68, 2.1);
    g.add(fronton);

    // Escalinata.
    for (let i = 0; i < 3; i++) {
      const peldano = new THREE.Mesh(
        new THREE.BoxGeometry(ancho * 0.8 - i * 0.6, 0.18, 1.2 - i * 0.3),
        mat(0xc4bfb2, 0.08, 0.9),
      );
      peldano.position.set(0, 0.09 + i * 0.18, 3.4 - i * 0.35);
      g.add(peldano);
    }

    // Rótulo con el nombre de la institución. Ignora la niebla, como los
    // carteles del pórtico: tiene que leerse desde lejos.
    const tex = textura(`fachada:${nombre}`, (ctx, w, h) => {
      ctx.fillStyle = '#0d1220';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffcf3f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let tam = 74;
      do {
        ctx.font = `900 ${tam}px system-ui, sans-serif`;
        tam -= 2;
      } while (ctx.measureText(nombre).width > w - 50 && tam > 16);
      ctx.fillText(nombre, w / 2, h / 2);
    }, 640, 140);

    const rotulo = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 0.78, 1.5, 0.12),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.9,
        roughness: 0.4,
        toneMapped: false,
        fog: false,
      }),
    );
    rotulo.position.set(0, alto * 0.86, 2.15);
    g.add(rotulo);

    // Ventanas encendidas: a estas horas siempre hay alguien trabajando.
    const matVentana = neon(0xffe9b0, 1.2);
    for (let fila = 0; fila < 2; fila++) {
      for (let col = -3; col <= 3; col++) {
        if (Math.random() > 0.55) continue;
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.06), matVentana);
        v.position.set(col * 2.2, alto * 0.42 + fila * 1.5, 2.02);
        g.add(v);
      }
    }
  }

  return g;
}

/**
 * Flecha pintada en el asfalto. Marca en el suelo lo mismo que dice el cartel,
 * para que el jugador no tenga que levantar la vista mientras se coloca.
 */
export function crearFlechaAsfalto(direccion, color) {
  const g = new THREE.Group();

  const matFlecha = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.2,
    roughness: 0.5,
    transparent: true,
    opacity: 0.85,
    toneMapped: false,
  });

  // Asta. Va ancha porque se pinta en el suelo y la cámara la mira casi de
  // canto: una franja estrecha se escorza hasta parecer un poste de pie.
  const asta = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 2.2), matFlecha);
  asta.rotation.x = -Math.PI / 2;
  g.add(asta);

  // Punta.
  const punta = new THREE.Mesh(new THREE.CircleGeometry(0.62, 3), matFlecha);
  punta.rotation.x = -Math.PI / 2;
  punta.rotation.z = Math.PI;
  punta.position.z = -1.5;
  g.add(punta);

  // Las laterales se inclinan hacia su lado: refuerzan la idea de desvío.
  if (direccion === 'izquierda') g.rotation.y = -0.42;
  if (direccion === 'derecha') g.rotation.y = 0.42;

  g.position.y = 0.03;
  return g;
}

/** DRON de vigilancia con foco. Sobrevuela la pista. */
export function crearDron() {
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.17, 0.5, 3, 7),
    mat(0x8fa8bd, 0.16, 0.5),
  );
  cuerpo.rotation.z = Math.PI / 2;
  g.add(cuerpo);

  // Brazos y hélices.
  const matBrazo = mat(0x6b5a48, 0.05, 0.7);
  const matHelice = new THREE.MeshStandardMaterial({
    color: 0xa8d4e0,
    roughness: 0.4,
    transparent: true,
    opacity: 0.65,
    flatShading: true,
  });

  g.userData.helices = [];

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), matBrazo);
      brazo.position.set(sx * 0.3, 0, sz * 0.3);
      brazo.rotation.y = sx * sz * 0.7;
      g.add(brazo);

      const rotor = new THREE.Group();
      rotor.position.set(sx * 0.52, 0.06, sz * 0.52);
      for (let i = 0; i < 2; i++) {
        const pala = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.02, 0.09), matHelice);
        pala.rotation.y = (i * Math.PI) / 2;
        rotor.add(pala);
      }
      g.add(rotor);
      g.userData.helices.push(rotor);
    }
  }

  // Cámara y foco: lo que hace que el dron se lea como vigilancia.
  const camara = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 6), mat(0x14161c, 0.05, 0.3));
  camara.position.y = -0.2;
  g.add(camara);

  const lente = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), neon(NEON.rojo, 2));
  lente.position.set(0, -0.24, 0.1);
  g.add(lente);

  // Cono de luz descendente.
  const haz = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 7, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff0c0,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  haz.position.y = -3.6;
  g.add(haz);

  g.userData.tipo = 'dron';
  return g;
}
