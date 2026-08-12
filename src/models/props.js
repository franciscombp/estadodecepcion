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
import { CARRILES, OBSTACULOS, PALETA, TUNEL, ELEVADO } from '../config/balance.js';
import { COLOR3D } from '../config/estilo.js';

// ---------------------------------------------------------------------------
// MATERIALES
// ---------------------------------------------------------------------------

/** Material sólido con emisión ajustable. */
function mat(color, emision = 0.25, rugosidad = 0.72) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rugosidad,
    metalness: 0.14,
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
export function crearObstaculo(tipo, colores) {
  switch (tipo) {
    case 'saltar': return crearObstaculoSaltar(colores);
    case 'agachar': return crearObstaculoAgachar(colores);
    case 'doble': return crearObstaculoDoble(colores);
    case 'esquivar':
    default: return crearObstaculoEsquivar(colores);
  }
}

// ---------------------------------------------------------------------------
// RECOLECTABLES
// ---------------------------------------------------------------------------

// Compartidos por todas las instancias.
let _geoPapel = null;
let _matPapel = null;

/**
 * PAPEL — la moneda. Una hoja con renglones que gira sobre sí misma.
 *
 * Es UNA malla, no un grupo: los renglones van en una textura en vez de ser
 * geometría aparte. A la velocidad del juego se ve igual y ahorra tres draw
 * calls por papel (más de 200 con la pista llena).
 */
export function crearPapel() {
  if (!_geoPapel) {
    _geoPapel = new THREE.BoxGeometry(0.44, 0.56, 0.03);

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

  const papel = new THREE.Mesh(_geoPapel, _matPapel);
  papel.userData.tipo = 'papel';
  return papel;
}

/**
 * EVIDENCIA — la gema. Un USB con carcasa naranja, conector metálico y
 * halo pulsante. Vale mucho más que un papel y tiene que notarse.
 */
export function crearEvidencia() {
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
// ÍTEMS DE ESTAMINA
// ---------------------------------------------------------------------------
// Uno por escenario, y cada uno es un OBJETO RECONOCIBLE, no un cilindro
// teñido. La diferencia importa más de lo que parece: la estamina es el único
// recurso que hay que buscar activamente, así que el jugador tiene que
// distinguirla de un papel a treinta metros y en movimiento. Una silueta
// propia lo consigue; un color, no —el color ya lo usa todo lo demás.
//
// Todos comparten la misma envoltura: peana de luz en el suelo, halo que late
// y un par de chispas en órbita. Eso es lo que dice "esto se recoge"; el
// modelo de dentro solo dice QUÉ es.

/** Peana, halo y chispas. Lo común a todos los ítems. */
function envoltorioRecolectable(g, color) {
  // Disco en el suelo: ancla el objeto flotante a un carril concreto. Sin él,
  // un ítem que flota se lee ambiguo entre dos carriles.
  const peana = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 18),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  peana.rotation.x = -Math.PI / 2;
  peana.position.y = -0.98; // A ras de asfalto: el ítem va a ESTAMINA.ALTURA.
  g.add(peana);

  const anillo = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.04, 6, 18),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      toneMapped: false,
    }),
  );
  anillo.rotation.x = Math.PI / 2;
  g.add(anillo);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 10, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  g.add(halo);

  const chispas = new THREE.Group();
  const matChispa = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  for (let i = 0; i < 3; i++) {
    const chispa = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), matChispa);
    const a = (i / 3) * Math.PI * 2;
    chispa.position.set(Math.cos(a) * 0.52, Math.sin(a * 2) * 0.16, Math.sin(a) * 0.52);
    chispas.add(chispa);
  }
  g.add(chispas);

  g.userData.anillo = anillo;
  g.userData.halo = halo;
  g.userData.chispas = chispas;
}

/** ENCEBOLLADO — La Bahía. Plato hondo, caldo humeante y cuchara. */
function modeloEncebollado(color) {
  const g = new THREE.Group();

  const plato = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.2, 0.24, 12),
    mat(0xf2f0e6, 0.28, 0.5),
  );
  g.add(plato);

  const caldo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.03, 12),
    neon(color, 1.5),
  );
  caldo.position.y = 0.11;
  g.add(caldo);

  // Yuca y aros de cebolla asomando: es lo que hace que se lea como comida.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const trozo = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.07, 0.11),
      mat(0xffe9c4, 0.3, 0.6),
    );
    trozo.position.set(Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14);
    trozo.rotation.y = a;
    g.add(trozo);
  }

  const cuchara = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.34, 0.04),
    mat(0xd8dde6, 0.25, 0.35),
  );
  cuchara.position.set(0.2, 0.26, -0.06);
  cuchara.rotation.z = 0.42;
  g.add(cuchara);

  // Vaho. Tres volutas que suben; las anima Stamina.js.
  const vapor = new THREE.Group();
  const matVapor = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    toneMapped: false,
  });
  for (let i = 0; i < 3; i++) {
    const nube = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), matVapor);
    nube.position.set((i - 1) * 0.1, 0.2 + i * 0.12, 0);
    vapor.add(nube);
  }
  g.add(vapor);
  g.userData.vapor = vapor;

  return g;
}

/** LINTERNA — El Apagón. Cuerpo, cabezal y haz de luz de verdad. */
function modeloLinterna(color) {
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.5, 10),
    mat(0x2b3140, 0.1, 0.55),
  );
  cuerpo.rotation.z = Math.PI / 2;
  g.add(cuerpo);

  // Franja de agarre: rompe el cilindro y da escala al objeto.
  const agarre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.135, 0.12, 10),
    mat(0x141821, 0.05, 0.85),
  );
  agarre.rotation.z = Math.PI / 2;
  agarre.position.x = -0.08;
  g.add(agarre);

  const cabezal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.13, 0.2, 10),
    mat(0x3d4557, 0.12, 0.5),
  );
  cabezal.rotation.z = -Math.PI / 2;
  cabezal.position.x = 0.33;
  g.add(cabezal);

  const lente = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 12),
    neon(color, 2),
  );
  lente.rotation.y = Math.PI / 2;
  lente.position.x = 0.435;
  g.add(lente);

  // El haz. Es lo que convierte "una linterna" en "LUZ", que es exactamente
  // lo que el jugador está buscando en ese tramo.
  const haz = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.5, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  haz.rotation.z = -Math.PI / 2;
  haz.position.x = 1.18;
  g.add(haz);

  return g;
}

/** MICRÓFONO — Las Elecciones. Rejilla, mango y cable suelto. */
function modeloMicrofono(color) {
  const g = new THREE.Group();

  const rejilla = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xb8c2d4,
      roughness: 0.35,
      metalness: 0.55,
      emissive: color,
      emissiveIntensity: 0.35,
      flatShading: true,
    }),
  );
  rejilla.position.y = 0.22;
  g.add(rejilla);

  const cuello = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.42, 10),
    mat(0x22283a, 0.08, 0.6),
  );
  cuello.position.y = -0.1;
  g.add(cuello);

  const aro = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.022, 5, 12),
    neon(color, 1.7),
  );
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.05;
  g.add(aro);

  // Cable colgando. Un micrófono sin cable parece un helado.
  const cable = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.022, 5, 14, Math.PI * 1.4),
    mat(0x1a1f2b, 0.05, 0.8),
  );
  cable.position.set(0.05, -0.36, 0);
  cable.rotation.set(Math.PI / 2, 0, 0.6);
  g.add(cable);

  return g;
}

/** CANELAZO — Carondelet. Jarro de barro, vapor y la rama de canela. */
function modeloCanelazo(color) {
  const g = new THREE.Group();

  const jarro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.17, 0.42, 12),
    mat(0x9a5a3c, 0.16, 0.75),
  );
  g.add(jarro);

  const liquido = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.03, 12),
    neon(color, 1.6),
  );
  liquido.position.y = 0.19;
  g.add(liquido);

  const asa = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.032, 5, 12, Math.PI * 1.1),
    mat(0x9a5a3c, 0.16, 0.75),
  );
  asa.position.set(0.24, 0.02, 0);
  asa.rotation.set(0, Math.PI / 2, -Math.PI / 2);
  g.add(asa);

  const canela = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.34, 6),
    mat(0x7a4520, 0.2, 0.8),
  );
  canela.position.set(0.07, 0.3, 0.04);
  canela.rotation.z = 0.35;
  g.add(canela);

  const vapor = new THREE.Group();
  const matVapor = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false,
  });
  for (let i = 0; i < 3; i++) {
    const nube = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), matVapor);
    nube.position.set((i - 1) * 0.08, 0.28 + i * 0.13, 0);
    vapor.add(nube);
  }
  g.add(vapor);
  g.userData.vapor = vapor;

  return g;
}

const MODELOS_ESTAMINA = {
  encebollado: modeloEncebollado,
  linterna: modeloLinterna,
  microfono: modeloMicrofono,
  canelazo: modeloCanelazo,
};

/**
 * ÍTEM DE ESTAMINA.
 * @param {number} color Color del escenario
 * @param {string} tipo  Clave del modelo (ver MODELOS_ESTAMINA)
 */
export function crearItemEstamina(color, tipo = 'encebollado') {
  const g = new THREE.Group();

  const constructor = MODELOS_ESTAMINA[tipo] ?? modeloEncebollado;
  const modelo = constructor(color);
  g.add(modelo);

  envoltorioRecolectable(g, color);

  g.userData.tipo = 'estamina';
  // El vapor lo declara el modelo interior; lo subimos al grupo para que
  // Stamina.js no tenga que saber cómo está montado por dentro.
  if (modelo.userData.vapor) g.userData.vapor = modelo.userData.vapor;
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

/**
 * Genera un elemento de decorado para los costados de la pista.
 * A la velocidad del juego nadie ve el detalle, pero la variación de alturas,
 * colores y siluetas sí se percibe como "ciudad".
 */
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
      // Locales con toldo y reja bajada.
      const alto = 3 + aleatorio() * 3;
      const local = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, alto, 3.4),
        mat(colores.props, 0.05, 0.92),
      );
      local.position.y = alto / 2;
      g.add(local);

      // Toldo a rayas.
      const toldo = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.14, 1.5),
        mat(aleatorio() > 0.5 ? colores.acento : COLOR3D.rojo, 0.3),
      );
      toldo.position.set(0, alto * 0.52, 2.1);
      toldo.rotation.x = 0.28;
      g.add(toldo);

      // Reja del local cerrado.
      const reja = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, alto * 0.42, 0.09),
        mat(0x2a2f3d, 0.03),
      );
      reja.position.set(0, alto * 0.23, 1.72);
      g.add(reja);

      // Rótulo de neón encendido: los locales cerrados dejan el letrero puesto.
      if (aleatorio() > 0.45) {
        const rotulo = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.4, 0.09),
          neon(aleatorio() > 0.5 ? colores.acento : 0x4fd1ff, 1.7),
        );
        rotulo.position.set(0, alto * 0.78, 1.76);
        g.add(rotulo);
      }

      if (aleatorio() > 0.6) {
        const palmera = crearPalmera(5 + aleatorio() * 2.5);
        palmera.position.set(aleatorio() > 0.5 ? 2.6 : -2.6, 0, 2.5);
        g.add(palmera);
      }
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
      break;
    }

    case 'carondelet': {
      // Fachadas coloniales cercadas con concertina.
      const alto = 4.5 + aleatorio() * 3;
      const fachada = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, alto, 3.2),
        mat(colores.props, 0.04, 0.95),
      );
      fachada.position.y = alto / 2;
      g.add(fachada);

      // Balcones: la firma del centro histórico de Quito.
      for (let i = 1; i <= 2; i++) {
        const balcon = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.13, 0.85),
          mat(0x2a2f3d, 0.03),
        );
        balcon.position.set(0, (alto / 3) * i + 0.5, 1.75);
        g.add(balcon);

        const baranda = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.38, 0.07),
          mat(0x22262f, 0.03),
        );
        baranda.position.set(0, (alto / 3) * i + 0.7, 2.13);
        g.add(baranda);
      }

      // Concertina sobre el muro.
      for (let i = 0; i < 3; i++) {
        const rollo = new THREE.Mesh(
          new THREE.TorusGeometry(0.36, 0.05, 4, 11),
          mat(0x9aa4b8, 0.3, 0.4),
        );
        rollo.position.set(-1 + i, alto + 0.32, 1.5);
        rollo.rotation.y = Math.PI / 2;
        g.add(rollo);
      }
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
