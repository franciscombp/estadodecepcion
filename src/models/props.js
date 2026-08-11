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
import { CARRILES, OBSTACULOS, PALETA } from '../config/balance.js';
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

/** ÍTEM DE ESTAMINA — cambia de color según el escenario. */
export function crearItemEstamina(color) {
  const g = new THREE.Group();

  const cuerpo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 0.44, 9),
    neon(color, 1.6),
  );
  g.add(cuerpo);

  // Tapa, para que se lea como recipiente y no como cilindro suelto.
  const tapa = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.07, 9),
    mat(0xe8eef5, 0.4, 0.4),
  );
  tapa.position.y = 0.24;
  g.add(tapa);

  const anillo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.045, 6, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      toneMapped: false,
    }),
  );
  anillo.rotation.x = Math.PI / 2;
  g.add(anillo);

  g.userData.tipo = 'estamina';
  g.userData.anillo = anillo;
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
 * PÓRTICO DE BIFURCACIÓN — el cartel que anuncia hacia dónde va cada carril.
 *
 * Es la pieza clave del sistema: aquí NO hay menú, el carril en el que estés
 * al cruzarlo decide la ruta. Por eso el pórtico tiene que leerse con mucha
 * antelación y sin ambigüedad —un cartel por carril, alineado exactamente
 * sobre él.
 *
 * @param {{izquierda:string, centro:string, derecha:string}} destinos
 * @param {boolean} centroEsPeligro Si ir de frente mata (Carondelet)
 */
export function crearPorticoBifurcacion(destinos, colores, centroEsPeligro = false) {
  const g = new THREE.Group();
  const anchoTotal = CARRILES.ANCHO * 3 + 1.4;
  const altoPortico = 5;

  // Columnas.
  for (const s of [-1, 1]) {
    const columna = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, altoPortico, 0.34),
      mat(COLOR3D.metal, 0.06, 0.85),
    );
    columna.position.set(s * (anchoTotal / 2), altoPortico / 2, 0);
    g.add(columna);

    // Tira de neón vertical: enmarca el pórtico y lo hace visible de lejos.
    const tira = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, altoPortico * 0.85, 0.09),
      neon(colores.acento ?? COLOR3D.dorado, 1.7),
    );
    tira.position.set(s * (anchoTotal / 2), altoPortico / 2, 0.2);
    g.add(tira);
  }

  // Viga superior.
  const viga = new THREE.Mesh(
    new THREE.BoxGeometry(anchoTotal + 0.34, 0.4, 0.4),
    mat(COLOR3D.metal, 0.06, 0.85),
  );
  viga.position.y = altoPortico;
  g.add(viga);

  // Un cartel por carril, alineado exactamente sobre él.
  const carteles = [
    { texto: destinos.izquierda, carril: 0, peligro: false },
    { texto: destinos.centro, carril: 1, peligro: centroEsPeligro },
    { texto: destinos.derecha, carril: 2, peligro: false },
  ];

  for (const c of carteles) {
    const cartel = crearCartelDestino(
      c.texto,
      c.peligro ? 0xff1030 : (colores.acento ?? COLOR3D.dorado),
      c.peligro,
    );
    cartel.position.set(CARRILES.POSICIONES[c.carril], altoPortico - 0.62, 0.12);
    g.add(cartel);

    // Flecha bajo el cartel, apuntando a su carril.
    const flecha = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.4, 3),
      neon(c.peligro ? NEON.rojo : (colores.acento ?? COLOR3D.dorado), 1.9),
    );
    flecha.position.set(CARRILES.POSICIONES[c.carril], altoPortico - 1.18, 0.12);
    flecha.rotation.z = Math.PI; // Apunta hacia abajo.
    if (c.carril === 0) flecha.rotation.z = Math.PI * 0.75;   // Izquierda
    if (c.carril === 2) flecha.rotation.z = Math.PI * 1.25;   // Derecha
    g.add(flecha);
  }

  return g;
}

/**
 * LOS TRES CAMINOS — el desvío físico.
 *
 * La carretera se abre de verdad en tres ramales que divergen, con isletas
 * de hormigón separándolos. No son tres carriles pintados: son tres calles.
 *
 * El ramal CENTRAL sigue recto y termina en la fachada de la institución
 * (Fiscalía, Asamblea, CNE…), lo que resuelve dos problemas de golpe:
 *   · la calle recta tiene un final visible en vez de perderse en la niebla
 *   · queda claro que ir de frente es entrar a un edificio, no seguir corriendo
 *
 * Los laterales se van en ángulo y se pierden en la niebla, que es justo la
 * sensación que se busca: no sabes qué hay allá, solo a dónde lleva.
 *
 * @param {{izquierda:string, centro:string, derecha:string}} destinos
 * @param {boolean} centroEsPeligro Si ir de frente mata (Carondelet)
 */
export function crearCaminosBifurcacion(destinos, colores, centroEsPeligro = false) {
  const g = new THREE.Group();

  const ANGULO = 0.34;          // ~19°: se lee como desvío sin desaparecer.
  const LARGO = 95;
  const ANCHO_RAMAL = CARRILES.ANCHO * 1.35;

  const matAsfalto = new THREE.MeshStandardMaterial({
    color: colores.calle ?? COLOR3D.asfalto,
    roughness: 0.92,
    metalness: 0.05,
  });

  const matBordillo = mat(0x3a4152, 0.04, 0.9);
  const matLinea = neon(colores.acento ?? COLOR3D.dorado, 1.2);

  // --- Los tres ramales ----------------------------------------------------
  const ramales = [
    { signo: -1, x: CARRILES.POSICIONES[0] },
    { signo: 0, x: 0 },
    { signo: 1, x: CARRILES.POSICIONES[2] },
  ];

  for (const r of ramales) {
    const ramal = new THREE.Group();

    const calzada = new THREE.Mesh(
      new THREE.PlaneGeometry(ANCHO_RAMAL, LARGO),
      matAsfalto,
    );
    calzada.rotation.x = -Math.PI / 2;
    // El plano se ancla por su centro: lo empujamos media longitud hacia -Z
    // para que arranque exactamente en el punto de bifurcación.
    calzada.position.z = -LARGO / 2;
    ramal.add(calzada);

    // Bordillos a los lados del ramal.
    for (const s of [-1, 1]) {
      const bordillo = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.3, LARGO),
        matBordillo,
      );
      bordillo.position.set(s * (ANCHO_RAMAL / 2), 0.15, -LARGO / 2);
      ramal.add(bordillo);
    }

    // Eje central discontinuo, para que el ramal se lea como calle.
    for (let i = 0; i < 14; i++) {
      const trazo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.4), matLinea);
      trazo.rotation.x = -Math.PI / 2;
      trazo.position.set(0, 0.03, -4 - i * 6.5);
      ramal.add(trazo);
    }

    ramal.position.x = r.x;
    ramal.rotation.y = r.signo * ANGULO;
    g.add(ramal);
  }

  // --- Isletas entre ramales -----------------------------------------------
  // Cuñas de hormigón que ocupan el hueco que dejan los ramales al abrirse.
  // Además de separar, tapan la calle recta que sigue por debajo.
  for (const signo of [-1, 1]) {
    const isleta = new THREE.Group();

    // OJO CON EL SIGNO. Al girar la forma -90° sobre X, su eje Y se mapea a
    // -Z del mundo: un vértice en Y negativa acaba DETRÁS del jugador. Por eso
    // el lado ancho de la cuña se define en Y positiva.
    const forma = new THREE.Shape();
    forma.moveTo(0, 0);
    forma.lineTo(2.1, LARGO * 0.72);
    forma.lineTo(-2.1, LARGO * 0.72);
    forma.closePath();

    const cuna = new THREE.Mesh(
      new THREE.ShapeGeometry(forma),
      mat(0x2a3040, 0.03, 0.95),
    );
    cuna.rotation.x = -Math.PI / 2;
    cuna.position.y = 0.06;
    isleta.add(cuna);

    // Morro de la isleta: lo primero que ve el jugador del desvío.
    const morro = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 0.85, 7),
      mat(0xd8d2c4, 0.12, 0.85),
    );
    morro.position.y = 0.42;
    isleta.add(morro);

    const franjaMorro = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.16, 7),
      neon(NEON.ambar, 1.8),
    );
    franjaMorro.position.y = 0.55;
    isleta.add(franjaMorro);

    // Balizas en fila, marcando el filo de la isleta.
    for (let i = 1; i <= 6; i++) {
      const baliza = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 6, 5),
        neon(NEON.ambar, 1.6),
      );
      baliza.position.set(0, 0.5, -i * 9);
      isleta.add(baliza);
    }

    // Palmeras en la isleta: es Ecuador, hasta las medianas tienen palmeras.
    for (let i = 0; i < 2; i++) {
      const palmera = crearPalmera(4 + Math.random() * 2);
      palmera.scale.setScalar(0.8);
      palmera.position.set(0, 0, -14 - i * 22);
      isleta.add(palmera);
    }

    isleta.position.x = signo * (CARRILES.ANCHO / 2 + 0.35);
    isleta.position.z = -1.5;
    g.add(isleta);
  }

  // --- Fachada de la institución al fondo del ramal central -----------------
  const fachada = crearFachadaInstitucion(
    destinos.centro,
    colores,
    centroEsPeligro,
  );
  fachada.position.z = -LARGO * 0.82;
  g.add(fachada);

  return g;
}

/**
 * Fachada del edificio institucional que cierra el ramal central.
 * En Carondelet no es un edificio sino un cerco militar: mismo papel visual
 * —cerrar la calle— pero con lectura opuesta.
 */
function crearFachadaInstitucion(nombre, colores, esCerco) {
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

  // Asta.
  const asta = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 2.4), matFlecha);
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
