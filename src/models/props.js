// ============================================================================
// PROPS — Obstáculos y decorado lateral, procedurales y tematizados
// ============================================================================
// Cada obstáculo se construye con primitivas y se tiñe con la paleta del
// escenario activo. La FORMA comunica cómo se supera (regla de legibilidad):
//
//   · SALTAR   → bajo y ancho, con franja de peligro arriba
//   · AGACHAR  → pórtico elevado con hueco por debajo
//   · ESQUIVAR → bloque sólido de piso a techo
//   · DOBLE    → bloque sólido largo que ocupa dos carriles
//
// El jugador debe poder leer el tipo en menos de medio segundo. Por eso la
// silueta y el color importan más que el detalle.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, OBSTACULOS, PALETA } from '../config/balance.js';

function mat(color, emision = 0.3, rugosidad = 0.7) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rugosidad,
    metalness: 0.15,
    emissive: color,
    emissiveIntensity: emision,
    flatShading: true,
  });
}

// ---------------------------------------------------------------------------
// OBSTÁCULOS
// ---------------------------------------------------------------------------

/**
 * SALTAR — barrera baja. Se libra saltando por encima.
 * Lleva una franja superior en rojo peligro para leerse rápido.
 */
export function crearObstaculoSaltar(colores) {
  const g = new THREE.Group();
  const alto = OBSTACULOS.ALTURA_SALTAR;
  const ancho = CARRILES.ANCHO * 0.85;

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, OBSTACULOS.PROFUNDIDAD * 0.6),
    mat(colores.props ?? PALETA.OBSTACULO, 0.25),
  );
  cuerpo.position.y = alto / 2;
  g.add(cuerpo);

  // Franja de peligro en el borde superior.
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.02, 0.16, OBSTACULOS.PROFUNDIDAD * 0.62),
    mat(PALETA.BRILLO_PELIGRO, 0.9),
  );
  franja.position.y = alto;
  g.add(franja);

  // Patas, para que no parezca flotando.
  for (const s of [-1, 1]) {
    const pata = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, alto, 0.12),
      mat(0x2a2f3d, 0.1),
    );
    pata.position.set(s * (ancho / 2 - 0.1), alto / 2, 0);
    g.add(pata);
  }

  g.userData.tipo = 'saltar';
  return g;
}

/**
 * AGACHAR — pórtico elevado. Se libra pasando por debajo.
 * El hueco inferior tiene que verse claramente vacío.
 */
export function crearObstaculoAgachar(colores) {
  const g = new THREE.Group();
  const ancho = CARRILES.ANCHO * 0.9;
  const base = OBSTACULOS.ALTURA_AGACHAR_DESDE;
  const altoBarra = 1.0;

  // Barra horizontal suspendida.
  const barra = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, altoBarra, OBSTACULOS.PROFUNDIDAD * 0.5),
    mat(colores.acento ?? PALETA.OBSTACULO, 0.5),
  );
  barra.position.y = base + altoBarra / 2;
  g.add(barra);

  // Franja de peligro en el borde inferior de la barra: marca la altura límite.
  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho * 1.02, 0.14, OBSTACULOS.PROFUNDIDAD * 0.52),
    mat(PALETA.BRILLO_PELIGRO, 0.9),
  );
  franja.position.y = base;
  g.add(franja);

  // Postes laterales, FUERA del ancho del carril para no obstruir el paso.
  for (const s of [-1, 1]) {
    const poste = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, base + altoBarra, 0.14),
      mat(0x2a2f3d, 0.15),
    );
    poste.position.set(s * (ancho / 2 + 0.07), (base + altoBarra) / 2, 0);
    g.add(poste);
  }

  g.userData.tipo = 'agachar';
  return g;
}

/**
 * ESQUIVAR — bloque sólido. Solo se libra cambiando de carril.
 */
export function crearObstaculoEsquivar(colores) {
  const g = new THREE.Group();
  const alto = OBSTACULOS.ALTURA_ESQUIVAR;
  const ancho = CARRILES.ANCHO * 0.82;

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, OBSTACULOS.PROFUNDIDAD * 0.7),
    mat(colores.props ?? PALETA.OBSTACULO, 0.2),
  );
  cuerpo.position.y = alto / 2;
  g.add(cuerpo);

  // Aspas de peligro cruzadas al frente: lectura inmediata de "no pasar".
  for (const rot of [Math.PI / 4, -Math.PI / 4]) {
    const aspa = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 1.15, 0.14, 0.06),
      mat(PALETA.BRILLO_PELIGRO, 1.0),
    );
    aspa.position.set(0, alto * 0.55, OBSTACULOS.PROFUNDIDAD * 0.36);
    aspa.rotation.z = rot;
    g.add(aspa);
  }

  g.userData.tipo = 'esquivar';
  return g;
}

/**
 * DOBLE — el "bus": bloque sólido que ocupa dos carriles.
 * Se instancia una sola vez centrado entre los dos carriles que cubre.
 */
export function crearObstaculoDoble(colores) {
  const g = new THREE.Group();
  const alto = OBSTACULOS.ALTURA_ESQUIVAR;
  const ancho = CARRILES.ANCHO * 1.85;

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, OBSTACULOS.PROFUNDIDAD * 1.6),
    mat(colores.props ?? PALETA.OBSTACULO, 0.2),
  );
  cuerpo.position.y = alto / 2;
  g.add(cuerpo);

  // Ventanas: rompen la masa y sugieren "vehículo".
  for (let i = -1; i <= 1; i++) {
    const ventana = new THREE.Mesh(
      new THREE.BoxGeometry(ancho * 0.24, 0.5, 0.06),
      mat(colores.acento ?? 0x9fe8ff, 0.75),
    );
    ventana.position.set(i * ancho * 0.3, alto * 0.68, OBSTACULOS.PROFUNDIDAD * 0.81);
    g.add(ventana);
  }

  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, 0.16, OBSTACULOS.PROFUNDIDAD * 1.62),
    mat(PALETA.BRILLO_PELIGRO, 0.85),
  );
  franja.position.y = alto * 0.32;
  g.add(franja);

  g.userData.tipo = 'doble';
  return g;
}

/** Fábrica única: devuelve el mesh que corresponde al tipo. */
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

// Geometría y material compartidos por TODOS los papeles.
// Hay hasta 90 papeles simultáneos en pista: si cada uno creara su propia
// geometría y su propio material serían 90 subidas a GPU y 90 cambios de
// estado por fotograma. Compartiéndolos, el coste es uno solo.
let _geoPapel = null;
let _matPapel = null;

/**
 * PAPEL — la "moneda". Una hoja con renglones que gira sobre sí misma.
 *
 * Es UNA sola malla, no un grupo. Los renglones van pintados en una textura
 * de canvas en lugar de ser geometría aparte: a la velocidad del juego el
 * resultado se ve igual, y ahorra tres draw calls por papel (más de 200 en
 * total con la pista llena).
 */
export function crearPapel() {
  if (!_geoPapel) {
    _geoPapel = new THREE.BoxGeometry(0.42, 0.54, 0.03);

    // Textura del documento: fondo dorado con renglones.
    const lienzo = document.createElement('canvas');
    lienzo.width = 32;
    lienzo.height = 40;
    const ctx = lienzo.getContext('2d');

    ctx.fillStyle = '#ffcf3f';
    ctx.fillRect(0, 0, 32, 40);

    ctx.fillStyle = '#8a6d1f';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(6, 9 + i * 7, 20, 2);
    }

    const textura = new THREE.CanvasTexture(lienzo);
    textura.magFilter = THREE.NearestFilter;

    _matPapel = new THREE.MeshStandardMaterial({
      map: textura,
      color: 0xffffff,
      emissive: PALETA.PAPEL,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      flatShading: true,
    });
  }

  const papel = new THREE.Mesh(_geoPapel, _matPapel);
  papel.userData.tipo = 'papel';
  return papel;
}

/** EVIDENCIA — la "gema": USB, chat, audio. Vale mucho más y escasea. */
export function crearEvidencia() {
  const g = new THREE.Group();

  const nucleo = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    new THREE.MeshStandardMaterial({
      color: PALETA.EVIDENCIA,
      emissive: PALETA.EVIDENCIA,
      emissiveIntensity: 1.0,
      roughness: 0.2,
      metalness: 0.4,
      flatShading: true,
    }),
  );
  g.add(nucleo);

  // Halo exterior: la hace destacar sobre cualquier fondo.
  const halo = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.46, 0),
    new THREE.MeshBasicMaterial({
      color: PALETA.EVIDENCIA,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
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
    new THREE.CylinderGeometry(0.24, 0.28, 0.42, 8),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      flatShading: true,
    }),
  );
  g.add(cuerpo);

  const anillo = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.045, 6, 14),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
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

/**
 * Genera un elemento de decorado para los costados de la pista.
 * Son siluetas simples: a la velocidad del juego nadie ve el detalle, pero
 * la variación de alturas y colores sí se percibe como "ciudad".
 */
export function crearDecorado(idEscenario, colores, aleatorio = Math.random) {
  const g = new THREE.Group();

  switch (idEscenario) {
    case 'bahia': {
      // Locales con toldo: cajas bajas con voladizo.
      const alto = 2.5 + aleatorio() * 2.5;
      const local = new THREE.Mesh(
        new THREE.BoxGeometry(3, alto, 3),
        mat(colores.props, 0.1, 0.9),
      );
      local.position.y = alto / 2;
      g.add(local);

      const toldo = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.16, 1.4),
        mat(aleatorio() > 0.5 ? colores.acento : PALETA.BRILLO_PELIGRO, 0.45),
      );
      toldo.position.set(0, alto * 0.55, 1.9);
      toldo.rotation.x = 0.25;
      g.add(toldo);

      // Reja de local cerrado.
      const reja = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, alto * 0.45, 0.1),
        mat(0x2a2f3d, 0.05),
      );
      reja.position.set(0, alto * 0.24, 1.55);
      g.add(reja);
      break;
    }

    case 'apagon': {
      // Torres de generación y tuberías.
      const alto = 5 + aleatorio() * 6;
      const torre = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.3, alto, 6),
        mat(colores.props, 0.06, 0.95),
      );
      torre.position.y = alto / 2;
      g.add(torre);

      // Luz piloto: casi el único punto de luz del escenario.
      const piloto = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 5),
        new THREE.MeshBasicMaterial({ color: aleatorio() > 0.6 ? 0xff4f6d : colores.acento }),
      );
      piloto.position.y = alto + 0.25;
      g.add(piloto);

      const tuberia = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 6, 6),
        mat(colores.props, 0.06, 0.95),
      );
      tuberia.rotation.z = Math.PI / 2;
      tuberia.position.set(0, 1.4, 2.5);
      g.add(tuberia);
      break;
    }

    case 'elecciones': {
      // Vallas publicitarias y postes con banderines.
      const altoPoste = 4 + aleatorio() * 2;
      const poste = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, altoPoste, 0.24),
        mat(0x2a2f3d, 0.05),
      );
      poste.position.y = altoPoste / 2;
      g.add(poste);

      const valla = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 2.0, 0.12),
        mat(colores.acento, 0.5),
      );
      valla.position.y = altoPoste - 0.5;
      g.add(valla);

      // Barras horizontales que insinúan un rostro/eslogan sin dibujarlo.
      for (let i = 0; i < 2; i++) {
        const barra = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.22, 0.03),
          mat(0xffffff, 0.6),
        );
        barra.position.set(0, altoPoste - 0.2 - i * 0.5, 0.09);
        g.add(barra);
      }
      break;
    }

    case 'carondelet': {
      // Fachadas coloniales cercadas, con concertina arriba.
      const alto = 4 + aleatorio() * 3;
      const fachada = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, alto, 3),
        mat(colores.props, 0.08, 0.95),
      );
      fachada.position.y = alto / 2;
      g.add(fachada);

      // Balcón.
      const balcon = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.14, 0.9),
        mat(0x2a2f3d, 0.05),
      );
      balcon.position.set(0, alto * 0.6, 1.7);
      g.add(balcon);

      // Concertina: espirales sobre el muro.
      for (let i = 0; i < 3; i++) {
        const rollo = new THREE.Mesh(
          new THREE.TorusGeometry(0.34, 0.05, 4, 10),
          mat(0x9aa4b8, 0.35),
        );
        rollo.position.set(-1 + i, alto + 0.3, 1.4);
        rollo.rotation.y = Math.PI / 2;
        g.add(rollo);
      }
      break;
    }

    default: {
      const alto = 3 + aleatorio() * 4;
      const bloque = new THREE.Mesh(
        new THREE.BoxGeometry(3, alto, 3),
        mat(colores.props, 0.08, 0.9),
      );
      bloque.position.y = alto / 2;
      g.add(bloque);
    }
  }

  return g;
}
