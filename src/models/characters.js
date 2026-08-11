// ============================================================================
// PERSONAJES — Modelos low-poly procedurales
// ============================================================================
// Los personajes se construyen con primitivas de Three.js en vez de cargarse
// desde archivos .glb. Ventajas para este proyecto:
//   · El bundle no crece: no hay descargas de decenas de MB.
//   · Cachear en el Service Worker es trivial (es código, no binarios).
//   · La estética low-poly/vaporwave es coherente con el resto del juego.
//
// CÓMO CAMBIAR A MODELOS .GLB REALES (cuando El Mercio tenga los assets):
//   1. Poner el archivo en public/assets/models/chochologo.glb
//   2. En Player.js, sustituir `crearChochologo()` por una carga con GLTFLoader.
//   3. Mantener los nombres de los huesos/partes (cuerpo, brazoIzq, piernaDer…)
//      o adaptar `animarCarrera()` a las animaciones del .glb.
// El resto del juego no se entera del cambio.
// ============================================================================

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// UTILIDADES DE CONSTRUCCIÓN
// ---------------------------------------------------------------------------

/** Material plano con un toque de emisión, para el look neón. */
function material(color, emision = 0.25) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
    emissive: color,
    emissiveIntensity: emision,
    flatShading: true,
  });
}

/** Caja posicionada por su centro. */
function caja(ancho, alto, profundo, color, emision) {
  return new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, profundo), material(color, emision));
}

/** Esfera de pocos segmentos (low-poly a propósito). */
function esfera(radio, color, emision) {
  return new THREE.Mesh(new THREE.SphereGeometry(radio, 8, 6), material(color, emision));
}

/** Cilindro de pocos segmentos. */
function cilindro(radioSup, radioInf, alto, color, emision) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radioSup, radioInf, alto, 8),
    material(color, emision),
  );
}

/**
 * Esqueleto humanoide básico compartido por todos los personajes.
 * Devuelve un grupo con las partes nombradas para poder animarlas.
 *
 * Convención: el personaje mide ~1.8 de alto y su origen está en los pies.
 */
function crearHumanoide({ colorPiel, colorRopa, colorPantalon, corpulencia = 1 }) {
  const grupo = new THREE.Group();
  const partes = {};

  const anchoTorso = 0.52 * corpulencia;

  // Torso
  const torso = caja(anchoTorso, 0.62, 0.3 * corpulencia, colorRopa);
  torso.position.y = 1.12;
  grupo.add(torso);
  partes.torso = torso;

  // Cadera
  const cadera = caja(anchoTorso * 0.9, 0.22, 0.28 * corpulencia, colorPantalon);
  cadera.position.y = 0.76;
  grupo.add(cadera);
  partes.cadera = cadera;

  // Cabeza
  const cabeza = caja(0.34, 0.36, 0.32, colorPiel);
  cabeza.position.y = 1.62;
  grupo.add(cabeza);
  partes.cabeza = cabeza;

  // Cuello
  const cuello = caja(0.14, 0.1, 0.14, colorPiel);
  cuello.position.y = 1.44;
  grupo.add(cuello);

  // ---- Brazos -------------------------------------------------------------
  // Cada brazo es un pivote en el hombro con el miembro colgando, para que
  // rotar el pivote produzca un balanceo natural.
  const crearBrazo = (signo) => {
    const pivote = new THREE.Group();
    pivote.position.set(signo * (anchoTorso / 2 + 0.09), 1.36, 0);

    const brazo = caja(0.16, 0.5, 0.16, colorRopa);
    brazo.position.y = -0.25;
    pivote.add(brazo);

    const mano = esfera(0.09, colorPiel);
    mano.position.y = -0.54;
    pivote.add(mano);

    grupo.add(pivote);
    return pivote;
  };
  partes.brazoIzq = crearBrazo(-1);
  partes.brazoDer = crearBrazo(1);

  // ---- Piernas ------------------------------------------------------------
  const crearPierna = (signo) => {
    const pivote = new THREE.Group();
    pivote.position.set(signo * 0.14, 0.72, 0);

    const pierna = caja(0.19, 0.62, 0.19, colorPantalon);
    pierna.position.y = -0.31;
    pivote.add(pierna);

    const pie = caja(0.21, 0.12, 0.3, 0x1a1a22);
    pie.position.set(0, -0.66, 0.05);
    pivote.add(pie);

    grupo.add(pivote);
    return pivote;
  };
  partes.piernaIzq = crearPierna(-1);
  partes.piernaDer = crearPierna(1);

  grupo.userData.partes = partes;
  return grupo;
}

// ---------------------------------------------------------------------------
// JUGADORES
// ---------------------------------------------------------------------------

/**
 * Sombrero de paja con banda tricolor.
 * Es la pieza que más identifica al personaje: se ve desde atrás, que es como
 * el jugador lo ve el 100% del tiempo.
 */
function anclarSombreroDePaja(cabeza) {
  const ala = cilindro(0.36, 0.36, 0.045, 0xe8cd8f, 0.06);
  ala.position.y = 0.19;
  cabeza.add(ala);

  const copa = cilindro(0.21, 0.235, 0.2, 0xdfc07c, 0.06);
  copa.position.y = 0.3;
  cabeza.add(copa);

  const remate = cilindro(0.215, 0.215, 0.03, 0xd4b268, 0.06);
  remate.position.y = 0.4;
  cabeza.add(remate);

  // Banda tricolor. Tres anillos finos apilados: amarillo, azul, rojo.
  const banda = [
    [0xffcf3f, 0.212],
    [0x1d4ed8, 0.244],
    [0xef4444, 0.276],
  ];
  for (const [color, y] of banda) {
    const anillo = cilindro(0.242, 0.242, 0.032, color, 0.35);
    anillo.position.y = y;
    cabeza.add(anillo);
  }
}

/**
 * Mochila de prensa. Va anclada al torso, así que acompaña el rebote de la
 * carrera y la inclinación al agacharse.
 */
function anclarMochilaPrensa(torso, anchoTorso) {
  const mochila = caja(anchoTorso * 0.82, 0.5, 0.22, 0x1c2028, 0.03);
  mochila.position.set(0, -0.02, -0.26);
  torso.add(mochila);

  // Parche blanco: se lee "PRENSA" aunque no haya texto. El contraste del
  // rectángulo claro sobre la mochila oscura basta a esta distancia.
  const parche = caja(anchoTorso * 0.5, 0.17, 0.03, 0xf2f2f2, 0.28);
  parche.position.set(0, 0.04, -0.38);
  torso.add(parche);

  // Franjas reflectantes.
  for (const y of [-0.16, 0.2]) {
    const franja = caja(anchoTorso * 0.84, 0.035, 0.03, 0xffcf3f, 0.55);
    franja.position.set(0, y, -0.375);
    torso.add(franja);
  }

  // Tirantes por delante.
  for (const s of [-1, 1]) {
    const tirante = caja(0.07, 0.44, 0.05, 0x1c2028, 0.03);
    tirante.position.set(s * anchoTorso * 0.28, 0, 0.15);
    torso.add(tirante);
  }
}

/** Cámara de fotos colgando de la cadera. */
function anclarCamara(cadera) {
  const cuerpo = caja(0.19, 0.13, 0.09, 0x14161c, 0.04);
  cuerpo.position.set(0.2, -0.04, 0.12);
  cadera.add(cuerpo);

  const objetivo = cilindro(0.055, 0.055, 0.07, 0x2a2f3d, 0.06);
  objetivo.rotation.x = Math.PI / 2;
  objetivo.position.set(0.2, -0.04, 0.19);
  cadera.add(objetivo);

  const lente = cilindro(0.035, 0.035, 0.02, 0x9fe8ff, 0.8);
  lente.rotation.x = Math.PI / 2;
  lente.position.set(0.2, -0.04, 0.23);
  cadera.add(lente);
}

/**
 * CHOCHÓLOGO — sombrero de paja, gafas y libreta.
 * El periodista veterano que ya vio esta película antes.
 */
export function crearChochologo() {
  const g = crearHumanoide({
    colorPiel: 0xd9a06b,
    colorRopa: 0x22c55e,       // Verde de camisa, más natural que el neón puro
    colorPantalon: 0x2a3550,
  });
  const p = g.userData.partes;

  anclarSombreroDePaja(p.cabeza);
  anclarMochilaPrensa(p.torso, 0.52);
  anclarCamara(p.cadera);

  // Gafas
  const gafas = caja(0.3, 0.08, 0.04, 0x0a0e17, 0.0);
  gafas.position.set(0, 0.03, 0.17);
  p.cabeza.add(gafas);

  const brilloGafa = caja(0.26, 0.045, 0.02, 0x9fe8ff, 0.9);
  brilloGafa.position.set(0, 0.035, 0.19);
  p.cabeza.add(brilloGafa);

  // Libreta en la mano derecha. Va en el pivote del brazo para que la
  // acompañe en todo el ciclo de carrera.
  const libreta = caja(0.16, 0.2, 0.025, 0xf2f2f2, 0.3);
  libreta.position.set(0, -0.6, 0.1);
  libreta.rotation.x = -0.5;
  p.brazoDer.add(libreta);

  const espiral = caja(0.17, 0.025, 0.035, 0xb9c6d4, 0.4);
  espiral.position.set(0, -0.51, 0.13);
  espiral.rotation.x = -0.5;
  p.brazoDer.add(espiral);

  g.userData.nombre = 'Chochólogo';
  return g;
}

/**
 * ALONDRA — cabello rizado y ukulele a la espalda.
 * La reportera joven que todavía cree que esto sirve de algo.
 */
export function crearAlondra() {
  const g = crearHumanoide({
    colorPiel: 0xc98b5e,
    colorRopa: 0x14b8a6,       // Verde azulado, para distinguirla de Chochólogo
    colorPantalon: 0x3d2a4a,
  });
  const p = g.userData.partes;

  anclarMochilaPrensa(p.torso, 0.52);
  anclarCamara(p.cadera);

  // Cabello rizado: racimo de esferas alrededor del cráneo.
  const rizos = [
    [0, 0.22, 0], [-0.17, 0.17, 0], [0.17, 0.17, 0],
    [0, 0.17, -0.17], [-0.13, 0.08, -0.15], [0.13, 0.08, -0.15],
    [-0.19, 0.02, 0.02], [0.19, 0.02, 0.02],
  ];
  for (const [x, y, z] of rizos) {
    const rizo = esfera(0.13, 0x2b1a12, 0.05);
    rizo.position.set(x, y, z);
    p.cabeza.add(rizo);
  }

  // Ukulele cruzado a la espalda.
  const uku = new THREE.Group();
  const cuerpoUku = cilindro(0.13, 0.15, 0.07, 0xd9a441, 0.3);
  cuerpoUku.rotation.x = Math.PI / 2;
  uku.add(cuerpoUku);

  const mastil = caja(0.05, 0.42, 0.05, 0x6b4a2f, 0.2);
  mastil.position.y = 0.28;
  uku.add(mastil);

  // Va colgado por fuera de la mochila y ladeado, para que ambos se lean
  // como dos objetos y no como una masa en la espalda.
  uku.position.set(-0.26, -0.06, -0.34);
  uku.rotation.set(0, 0, 0.75);
  p.torso.add(uku);

  // Credencial de prensa al cuello.
  const credencial = caja(0.14, 0.18, 0.02, 0xffffff, 0.4);
  credencial.position.set(0.1, -0.1, 0.17);
  p.torso.add(credencial);

  g.userData.nombre = 'Alondra';
  return g;
}

// ---------------------------------------------------------------------------
// PERSEGUIDORES
// ---------------------------------------------------------------------------

/**
 * EL DÚO PERSEGUIDOR — Noboa haciendo caballito sobre Reimberg.
 * Se ve al fondo de la pantalla; por eso la silueta importa más que el detalle.
 */
export function crearPerseguidores() {
  const grupo = new THREE.Group();

  // --- REIMBERG: robusto, traje oscuro. Es el que carga. -------------------
  const reimberg = crearHumanoide({
    colorPiel: 0xc08a5e,
    colorRopa: 0x1f2333,     // Traje oscuro
    colorPantalon: 0x15182444,
    corpulencia: 1.45,        // Más ancho de hombros
  });
  const pr = reimberg.userData.partes;

  // Corbata
  const corbata = caja(0.09, 0.34, 0.03, 0xff4f6d, 0.5);
  corbata.position.set(0, -0.06, 0.17);
  pr.torso.add(corbata);

  // Los brazos van hacia atrás, sosteniendo al de arriba.
  pr.brazoIzq.rotation.x = 2.2;
  pr.brazoDer.rotation.x = 2.2;

  grupo.add(reimberg);

  // --- NOBOA: delgado, gafas, camisa blanca. Va encima. --------------------
  const noboa = crearHumanoide({
    colorPiel: 0xe0b088,
    colorRopa: 0xf2f2f2,     // Camisa blanca
    colorPantalon: 0x2a3550,
    corpulencia: 0.82,        // Más delgado
  });
  const pn = noboa.userData.partes;

  // Gafas
  const gafas = caja(0.3, 0.07, 0.04, 0x0a0e17, 0.0);
  gafas.position.set(0, 0.03, 0.17);
  pn.cabeza.add(gafas);

  const brilloGafa = caja(0.26, 0.04, 0.02, 0xff9f9f, 0.8);
  brilloGafa.position.set(0, 0.035, 0.19);
  pn.cabeza.add(brilloGafa);

  // Piernas abiertas, montado sobre los hombros.
  pn.piernaIzq.rotation.z = 0.55;
  pn.piernaDer.rotation.z = -0.55;
  pn.piernaIzq.rotation.x = -0.3;
  pn.piernaDer.rotation.x = -0.3;

  // Un brazo señalando al frente: el gesto de "a ese".
  pn.brazoDer.rotation.x = -1.75;
  pn.brazoIzq.rotation.x = 0.4;

  // Se sienta sobre los hombros de Reimberg.
  noboa.position.y = 1.52;
  noboa.scale.setScalar(0.92);
  grupo.add(noboa);

  grupo.userData.partes = {
    reimberg: pr,
    noboa: pn,
    grupoReimberg: reimberg,
    grupoNoboa: noboa,
  };
  grupo.userData.nombre = 'Perseguidores';

  return grupo;
}

// ---------------------------------------------------------------------------
// ANIMACIÓN
// ---------------------------------------------------------------------------

/**
 * Anima el ciclo de carrera de un humanoide.
 *
 * @param {THREE.Group} personaje  Grupo devuelto por crearChochologo/crearAlondra
 * @param {number} tiempo          Tiempo acumulado en segundos
 * @param {number} intensidad      0 = quieto, 1 = carrera completa
 * @param {number} cadencia        Zancadas por segundo (sube con la velocidad)
 */
export function animarCarrera(personaje, tiempo, intensidad = 1, cadencia = 9) {
  const p = personaje.userData?.partes;
  if (!p) return;

  const fase = tiempo * cadencia;
  const swing = Math.sin(fase) * intensidad;
  const swingOpuesto = Math.sin(fase + Math.PI) * intensidad;

  // Piernas: se alternan.
  p.piernaIzq.rotation.x = swing * 0.9;
  p.piernaDer.rotation.x = swingOpuesto * 0.9;

  // Brazos: opuestos a la pierna del mismo lado.
  p.brazoIzq.rotation.x = swingOpuesto * 0.75;
  p.brazoDer.rotation.x = swing * 0.75;

  // Rebote vertical del torso, al doble de frecuencia que la zancada.
  const rebote = Math.abs(Math.sin(fase)) * 0.05 * intensidad;
  p.torso.position.y = 1.12 + rebote;
  p.cabeza.position.y = 1.62 + rebote;
  p.cadera.position.y = 0.76 + rebote * 0.6;

  // Ligera inclinación hacia adelante: da sensación de urgencia.
  p.torso.rotation.x = 0.12 * intensidad;
}

/**
 * Animación del dúo perseguidor. Reimberg trota pesado; Noboa se bambolea
 * encima y señala.
 */
export function animarPerseguidores(grupo, tiempo) {
  const partes = grupo.userData?.partes;
  if (!partes) return;

  const { reimberg, noboa, grupoNoboa } = partes;

  // Reimberg corre con cadencia más lenta y zancada más corta: pesa más.
  const fase = tiempo * 7;
  reimberg.piernaIzq.rotation.x = Math.sin(fase) * 0.7;
  reimberg.piernaDer.rotation.x = Math.sin(fase + Math.PI) * 0.7;

  const rebote = Math.abs(Math.sin(fase)) * 0.07;
  reimberg.torso.position.y = 1.12 + rebote;
  reimberg.cabeza.position.y = 1.62 + rebote;

  // Noboa acompaña el rebote con retraso: se bambolea.
  grupoNoboa.position.y = 1.52 + rebote * 1.5;
  grupoNoboa.rotation.z = Math.sin(fase * 0.5) * 0.08;

  // El brazo que señala oscila un poco, insistente.
  noboa.brazoDer.rotation.x = -1.75 + Math.sin(tiempo * 4) * 0.15;
}

/**
 * Pone al personaje en pose de agachado (encogido) o lo devuelve a la normal.
 * @param {number} factor 0 = de pie, 1 = totalmente agachado
 */
export function aplicarPoseAgachado(personaje, factor) {
  const p = personaje.userData?.partes;
  if (!p) return;

  // Comprimimos el personaje en Y y lo inclinamos hacia adelante.
  personaje.scale.y = 1 - 0.42 * factor;
  p.torso.rotation.x = 0.12 + 0.55 * factor;
  p.cabeza.rotation.x = 0.3 * factor;
}
