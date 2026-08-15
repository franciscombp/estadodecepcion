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
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.03, 0.13, 0.26),
    neon(NEON.rojo, 1.9),
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

  // Franja roja en el BORDE INFERIOR: marca la altura límite.
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.03, 0.12, 0.44),
    neon(NEON.rojo, 1.9),
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

  // La X de neón, en la cara frontal.
  const matX = neon(NEON.rojo, 2);
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
let _matPapel = null;

/**
 * PAPEL — la moneda. Una hoja con renglones que gira sobre sí misma.
 *
 * Es UNA malla, no un grupo: los renglones van en una textura en vez de ser
 * geometría aparte. A la velocidad del juego se ve igual y ahorra tres draw
 * calls por papel (más de 200 con la pista llena).
 */
export function crearEvidencia() {
  if (!_geoEvidencia) {
    // Algo más pequeño y casi cuadrado: cuanto menos alto es el papel,
    // menos separación hace falta para que se vea el hueco entre dos.
    _geoEvidencia = new THREE.BoxGeometry(0.46, 0.5, 0.03);

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
      // Sello
      ctx.strokeStyle = 'rgba(255,51,85,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w * 0.72, h * 0.78, w * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }, 64, 80);

    _matPapel = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: COLOR3D.dorado,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      flatShading: true,
    });
  }

  const papel = new THREE.Mesh(_geoEvidencia, _matPapel);
  papel.userData.tipo = 'papel';
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
 * El material es único y compartido por las tres mil piezas de la pista, así
 * que esto es una escritura, no tres mil.
 *
 * @param {number} intensidad   Emisión. ~0.55 con luz, ~2 a oscuras.
 * @param {boolean} atraviesaNiebla
 *   Si es true el papel ignora la niebla. En el Apagón hace falta: con niebla
 *   los de más allá de veinte metros se funden con el negro y la ruta se corta
 *   justo donde hay que mirar. En el resto de escenas estorbaría, porque un
 *   objeto que no se funde con el fondo se lee como pegatina.
 */
export function ajustarBrilloEvidencia(intensidad, atraviesaNiebla = false) {
  if (!_matPapel) crearEvidencia();
  _matPapel.emissiveIntensity = intensidad;
  _matPapel.fog = !atraviesaNiebla;
  _matPapel.toneMapped = !atraviesaNiebla;
  _matPapel.needsUpdate = true;
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

  // Halo en alambre: la hace destacar sobre cualquier fondo.
  const halo = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.48, 0),
    new THREE.MeshBasicMaterial({
      color: COLOR3D.naranja,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
      toneMapped: false,
    }),
  );
  g.add(halo);

  g.userData.tipo = 'evidencia';
  g.userData.halo = halo;
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

  const cristal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.24,
      roughness: 0.15,
      metalness: 0.3,
      flatShading: true,
    }),
  );
  g.add(cristal);

  const aro = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.05, 6, 20),
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

  g.userData.aro = aro;
  g.userData.cristal = cristal;
  return g;
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
      emissiveIntensity: 0.95,
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
export function crearPotenciador(id, color) {
  const g = capsulaPotenciador(color);

  const constructor = INSIGNIAS[id] ?? insigniaIman;
  const insignia = constructor(color);
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
      const PUESTOS = 3;
      const ANCHO_PUESTO = 4.7;
      const largo = PUESTOS * ANCHO_PUESTO;

      for (let i = 0; i < PUESTOS; i++) {
        const puesto = crearPuestoBahia(colores, aleatorio, ANCHO_PUESTO);
        puesto.position.x = (i - (PUESTOS - 1) / 2) * ANCHO_PUESTO;
        g.add(puesto);
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
      const puntales = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 5.4, 0.16),
        mat(0x9aa0a8, 0.03, 0.55),
      );
      puntales.position.set(largo / 2 - 0.4, 2.7, 3.2);
      g.add(puntales);

      // La hilera va ALINEADA: ni desviación lateral ni escala al azar. Una
      // fila de puestos torcidos y de tamaños distintos no se lee como
      // desorden, se lee como fallo de colocación.
      g.userData.alineado = true;
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
      // Vallas de campaña, muchas y muy encendidas.
      if (aleatorio() > 0.35) {
        g.add(crearValla(colores.acento, aleatorio));
      } else {
        g.add(crearFarola(0xffb0d8));
        const alto = 3.5 + aleatorio() * 2;
        const edificio = new THREE.Mesh(
          new THREE.BoxGeometry(3, alto, 3),
          mat(colores.props, 0.05, 0.9),
        );
        edificio.position.set(1.8, alto / 2, 1.5);
        g.add(edificio);
      }

      // LAS PALMERAS VIVEN AQUÍ. Estaban en la Bahía, que es un pasaje
      // techado: una palmera dentro de un mercado cubierto no crece, y si
      // asomaba por encima del techo lo que decía era que no había techo.
      // Esta es la escena de calle abierta —avenida en campaña—, así que es
      // donde toca el arbolado.
      if (aleatorio() > 0.55) {
        const palmera = crearPalmera(5.5 + aleatorio() * 3);
        palmera.position.set((aleatorio() - 0.5) * 4, 0, 2.8);
        g.add(palmera);
      }
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
export function crearTarima(largo, colores) {
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
  const tablero = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, 0.26, largo),
    new THREE.MeshStandardMaterial({
      map: texturaMadera(),
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    }),
  );
  tablero.position.set(0, h - 0.13, zInicio - largo / 2);
  g.add(tablero);

  // Borde de neón a ambos lados, a la altura de la superficie. Es lo que
  // comunica DÓNDE está el suelo nuevo: sin esta línea, desde arriba no se
  // distingue el filo y el jugador se cae sin entender por qué.
  const matBorde = neon(acento, 1.7);
  for (const s of [-1, 1]) {
    const borde = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.12, largo + ELEVADO.LARGO_RAMPA),
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

  for (const s of [-1, 1]) {
    const pared = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, alto, largo),
      matMuro,
    );
    pared.position.set(s * (ancho / 2), alto / 2, -largo / 2);
    g.add(pared);
  }

  const techo = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.4, largo), matMuro);
  techo.position.set(0, alto, -largo / 2);
  g.add(techo);

  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho, largo),
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
      new THREE.BoxGeometry(0.14, 0.12, largo),
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
