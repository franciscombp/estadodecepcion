// ============================================================================
// PERSONAJES — Modelos low-poly procedurales
// ============================================================================
// Los personajes se construyen con primitivas de Three.js en vez de cargarse
// desde archivos .glb. Ventajas para este proyecto:
//   · El bundle no crece: no hay descargas de decenas de MB.
//   · Cachear en el Service Worker es trivial (es código, no binarios).
//   · Cada pieza lleva su color en la malla, no en una imagen: no hay atlas
//     que cargar, ni UVs que se estiren, ni una textura borrosa a dos metros.
//
// DE DÓNDE SALEN ESTAS MEDIDAS
// Del modelo que mandó el autor (Meshy, `personaje low poly biped`, con su
// esqueleto y su ciclo de carrera). No se importa el archivo: se DESTRIPÓ,
// igual que se hizo con el mercado de la Bahía. Se midieron sus huesos y sus
// masas —el reparto de vértices por hueso, la altura de cada tramo— y de ahí
// sale la tabla PROPORCION de más abajo. Lo que se conserva es la FORMA: un
// cabezón de dibujo, tronco corto y piernas cortas; 1.70 de alto con 0.42 de
// cabeza, que es una cuarta parte del personaje.
//
// Lo que se deja fuera del original, a propósito:
//   · Sus 4.000 triángulos. Aquí el cuerpo entero anda por los 600, y a la
//     distancia a la que se juega —de espaldas y a ocho metros— no se nota.
//   · Su malla: llegaba en trozos sueltos (medio centenar de islas alrededor
//     del cráneo, los rizos) y con el ukelele estirado entre las dos manos.
//   · Sus UVs, que no llevaban ninguna imagen detrás.
//
// LOS MIEMBROS SON ARTICULADOS
// Cada brazo lleva codo y cada pierna lleva rodilla y tobillo. No es un
// capricho: una zancada con la pierna rígida es un compás, y un brazo rígido
// que oscila es un péndulo. Con dos segmentos y un tobillo, el mismo ciclo de
// carrera ya se lee como una carrera.
// ============================================================================

import * as THREE from 'three';
import { piezaEditada } from './hitos.js';

// ---------------------------------------------------------------------------
// PROPORCIONES — medidas sacadas del modelo original
// ---------------------------------------------------------------------------
// Origen en los pies, altura total 1.70. Las alturas NO se escalan con la
// corpulencia (todos miden lo mismo); lo que engorda es el ancho y el fondo.
export const PROPORCION = {
  ALTURA: 1.70,

  // El cráneo, sin sombrero. En el modelo original el hueso de la cabeza
  // llegaba a 1.70 y medía 0.68 de ancho, pero eso era el ALA DEL SOMBRERO
  // metida dentro del hueso: el cráneo de verdad acaba en 1.60, y de 1.56 a
  // 1.70 va el sombrero. Confundir las dos cosas daba un cabezón cúbico con
  // una gorrita encima.
  CABEZA: { ancho: 0.42, alto: 0.34, fondo: 0.40, y: 1.43 },   // 1.26 → 1.60
  CUELLO: { ancho: 0.16, alto: 0.10, fondo: 0.16, y: 1.235 },
  TORSO:  { ancho: 0.44, alto: 0.44, fondo: 0.32, y: 1.02 },   // 0.80 → 1.24
  CADERA: { ancho: 0.42, alto: 0.20, fondo: 0.31, y: 0.80 },   // 0.70 → 0.90

  // Hombro: pivote del brazo. El codo cuelga a BRAZO del hombro, y la muñeca
  // a ANTEBRAZO del codo.
  HOMBRO:    { y: 1.17, x: 0.245 },
  BRAZO:     { largo: 0.24, grueso: 0.145 },
  ANTEBRAZO: { largo: 0.23, grueso: 0.125 },
  MANO:      { radio: 0.085 },

  // Ingle: pivote de la pierna. Rodilla a MUSLO, tobillo a PANTORRILLA.
  INGLE:       { y: 0.80, x: 0.12 },
  MUSLO:       { largo: 0.34, grueso: 0.18 },
  PANTORRILLA: { largo: 0.38, grueso: 0.15 },
  PIE:         { ancho: 0.17, alto: 0.08, fondo: 0.26 },

  // EL OVILLO. Al agacharse el personaje no se aplasta: se hace una bola y
  // rueda. `centro` es el eje de la voltereta —la altura a la que queda el
  // corazón de la bola— y el resto son las posiciones a las que se recogen
  // las piezas del cuerpo para formarla.
  //
  // Sin este recogido la voltereta no funciona, y cuesta verlo: girar un
  // cuerpo estirado alrededor de un punto a media altura mete la cabeza medio
  // metro bajo el asfalto en cuanto pasa de los noventa grados. Lo que rueda
  // tiene que caber dentro de la bola ANTES de empezar a girar.
  OVILLO: {
    centro: 0.43,
    cabeza: { y: 0.60, z: 0.26 },
    cuello: { y: 0.56, z: 0.18 },
    torso:  { y: 0.52, z: 0.02 },
    cadera: { y: 0.44, z: -0.16 },
    hombro: { y: 0.62, z: 0.04 },
    ingle:  { y: 0.46, z: -0.14 },
  },
};

// ---------------------------------------------------------------------------
// UTILIDADES DE CONSTRUCCIÓN
// ---------------------------------------------------------------------------

// Los colores van en la malla, no en una textura, así que cada tono distinto
// es un material. Se comparten entre piezas y entre personajes: la camisa de
// uno y la de otro que sean del mismo verde son el MISMO material, y así el
// motor no compila un programa por cada caja.
//
// No se destruyen nunca. `cambiarPersonaje()` tira el modelo viejo sin liberar
// nada, y hace bien: si liberase, el siguiente personaje que reutilizase ese
// verde se quedaría con un material muerto.
const MATERIALES = new Map();

/** Material plano con un toque de emisión, para el look neón. */
function material(color, emision = 0.25) {
  const clave = `${color}|${emision}`;
  let mat = MATERIALES.get(clave);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.1,
      emissive: color,
      emissiveIntensity: emision,
      flatShading: true,
    });
    MATERIALES.set(clave, mat);
  }
  return mat;
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
 * Esqueleto humanoide compartido por todos los personajes.
 * Devuelve un grupo con las partes nombradas para poder animarlas.
 *
 * ESTRUCTURA
 *   grupo                 ← lo que se mueve por la pista (posición y giro)
 *     └ cuerpo            ← lo que rueda en la voltereta
 *         ├ cabeza, cuello, torso, cadera
 *         ├ brazoIzq/Der   → antebrazoIzq/Der → manoIzq/Der
 *         └ piernaIzq/Der  → pantorrillaIzq/Der → pieIzq/Der
 *
 * El grupo intermedio `cuerpo` existe para la voltereta: rodar hacia adelante
 * es girar sobre un eje que pasa por la barriga, no por los pies. Girar el
 * grupo de fuera haría un compás; girar `cuerpo` con su compensación de
 * posición hace una rueda. Ver `aplicarPoseAgachado()`.
 */
function crearHumanoide({ colorPiel, colorRopa, colorPantalon, corpulencia = 1 }) {
  const P = PROPORCION;
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);

  const partes = { cuerpo };
  const ancho = (v) => v * corpulencia;

  // --- Tronco ---------------------------------------------------------------
  const torso = caja(ancho(P.TORSO.ancho), P.TORSO.alto, ancho(P.TORSO.fondo), colorRopa);
  torso.position.y = P.TORSO.y;
  cuerpo.add(torso);
  partes.torso = torso;

  const cadera = caja(ancho(P.CADERA.ancho), P.CADERA.alto, ancho(P.CADERA.fondo), colorPantalon);
  cadera.position.y = P.CADERA.y;
  cuerpo.add(cadera);
  partes.cadera = cadera;

  const cuello = caja(P.CUELLO.ancho, P.CUELLO.alto, P.CUELLO.fondo, colorPiel);
  cuello.position.y = P.CUELLO.y;
  cuerpo.add(cuello);
  partes.cuello = cuello;

  // La cabeza va suelta del tronco (no colgada de él) porque casi todos los
  // adornos que identifican a un personaje son suyos y no deben heredar la
  // inclinación del torso al correr.
  const cabeza = caja(P.CABEZA.ancho, P.CABEZA.alto, P.CABEZA.fondo, colorPiel);
  cabeza.position.y = P.CABEZA.y;
  cuerpo.add(cabeza);
  partes.cabeza = cabeza;

  // --- Brazos ---------------------------------------------------------------
  // Hombro → codo → muñeca. Cada eslabón es un pivote con su miembro colgando
  // de él, así que rotar el pivote dobla por donde toca.
  const crearBrazo = (signo) => {
    const hombro = new THREE.Group();
    hombro.position.set(signo * ancho(P.HOMBRO.x), P.HOMBRO.y, 0);

    const brazo = caja(P.BRAZO.grueso, P.BRAZO.largo, P.BRAZO.grueso, colorRopa);
    brazo.position.y = -P.BRAZO.largo / 2;
    hombro.add(brazo);

    const codo = new THREE.Group();
    codo.position.y = -P.BRAZO.largo;
    hombro.add(codo);

    const antebrazo = caja(P.ANTEBRAZO.grueso, P.ANTEBRAZO.largo, P.ANTEBRAZO.grueso, colorPiel);
    antebrazo.position.y = -P.ANTEBRAZO.largo / 2;
    codo.add(antebrazo);

    const mano = new THREE.Group();
    mano.position.y = -P.ANTEBRAZO.largo;
    codo.add(mano);

    const puño = esfera(P.MANO.radio, colorPiel);
    mano.add(puño);

    cuerpo.add(hombro);
    return { hombro, codo, mano };
  };

  const brazoI = crearBrazo(-1);
  const brazoD = crearBrazo(1);
  partes.brazoIzq = brazoI.hombro;
  partes.brazoDer = brazoD.hombro;
  partes.antebrazoIzq = brazoI.codo;
  partes.antebrazoDer = brazoD.codo;
  partes.manoIzq = brazoI.mano;
  partes.manoDer = brazoD.mano;

  // --- Piernas --------------------------------------------------------------
  const crearPierna = (signo) => {
    const ingle = new THREE.Group();
    ingle.position.set(signo * ancho(P.INGLE.x), P.INGLE.y, 0);

    const muslo = caja(P.MUSLO.grueso, P.MUSLO.largo, P.MUSLO.grueso, colorPantalon);
    muslo.position.y = -P.MUSLO.largo / 2;
    ingle.add(muslo);

    const rodilla = new THREE.Group();
    rodilla.position.y = -P.MUSLO.largo;
    ingle.add(rodilla);

    const pantorrilla = caja(
      P.PANTORRILLA.grueso, P.PANTORRILLA.largo, P.PANTORRILLA.grueso, colorPantalon,
    );
    pantorrilla.position.y = -P.PANTORRILLA.largo / 2;
    rodilla.add(pantorrilla);

    const tobillo = new THREE.Group();
    tobillo.position.y = -P.PANTORRILLA.largo;
    rodilla.add(tobillo);

    // El pie va adelantado: el talón queda bajo el tobillo y la punta sale
    // por delante, que es lo que hace que un pie parezca un pie.
    const zapato = caja(P.PIE.ancho, P.PIE.alto, P.PIE.fondo, 0x1a1a22, 0.03);
    zapato.position.set(0, -P.PIE.alto / 2, P.PIE.fondo / 2 - 0.06);
    tobillo.add(zapato);

    cuerpo.add(ingle);
    return { ingle, rodilla, tobillo };
  };

  const piernaI = crearPierna(-1);
  const piernaD = crearPierna(1);
  partes.piernaIzq = piernaI.ingle;
  partes.piernaDer = piernaD.ingle;
  partes.pantorrillaIzq = piernaI.rodilla;
  partes.pantorrillaDer = piernaD.rodilla;
  partes.pieIzq = piernaI.tobillo;
  partes.pieDer = piernaD.tobillo;

  // Cada pieza que el ovillo mueve se guarda dónde estaba. Es lo que permite
  // devolverla a su sitio EXACTO al estirarse, en vez de ir sumando y restando
  // desplazamientos —que es como una pieza acaba a cinco centímetros de donde
  // debería después de veinte volteretas.
  for (const parte of piezasMoviles(partes)) {
    parte.userData.reposo = parte.position.clone();
  }

  grupo.userData.partes = partes;
  return grupo;
}

/** Las piezas del cuerpo que el ovillo recoge, en el orden en que se recogen. */
function piezasMoviles(p) {
  return [p.cabeza, p.cuello, p.torso, p.cadera, p.brazoIzq, p.brazoDer,
    p.piernaIzq, p.piernaDer];
}

/**
 * Devuelve todas las piezas a su sitio de reposo: posición, no rotación.
 * La usan la pose de derrota y el reinicio, que escriben rotaciones a mano y
 * necesitan partir de un cuerpo sin recoger.
 */
export function reposar(partes) {
  for (const parte of piezasMoviles(partes)) {
    if (parte?.userData?.reposo) parte.position.copy(parte.userData.reposo);
  }
  if (partes.cuerpo) {
    partes.cuerpo.rotation.set(0, 0, 0);
    partes.cuerpo.position.set(0, 0, 0);
  }
}

/**
 * Devuelve todos los pivotes articulados de un personaje.
 * Lo usan las poses que necesitan dejar el cuerpo a cero antes de escribir la
 * suya (levantarse tras una caída, reiniciar la partida).
 */
export function pivotesDe(partes) {
  return [
    partes.brazoIzq, partes.brazoDer, partes.antebrazoIzq, partes.antebrazoDer,
    partes.piernaIzq, partes.piernaDer, partes.pantorrillaIzq, partes.pantorrillaDer,
    partes.pieIzq, partes.pieDer,
  ].filter(Boolean);
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
  // El ala, a la altura de las orejas y con los 0.68 de vuelo que traía el
  // modelo original. Es la silueta que se ve desde atrás.
  const ala = cilindro(0.34, 0.34, 0.045, 0xe8cd8f, 0.06);
  ala.position.y = 0.13;
  cabeza.add(ala);

  const copa = cilindro(0.2, 0.225, 0.15, 0xdfc07c, 0.06);
  copa.position.y = 0.2;
  cabeza.add(copa);

  const remate = cilindro(0.205, 0.205, 0.025, 0xd4b268, 0.06);
  remate.position.y = 0.278;
  cabeza.add(remate);

  // Banda tricolor. Tres anillos finos apilados: amarillo, azul, rojo.
  const banda = [
    [0xffcf3f, 0.152],
    [0x1d4ed8, 0.182],
    [0xef4444, 0.212],
  ];
  for (const [color, y] of banda) {
    const anillo = cilindro(0.232, 0.232, 0.03, color, 0.35);
    anillo.position.y = y;
    cabeza.add(anillo);
  }
}

/**
 * Mochila de prensa. Va anclada al torso, así que acompaña el rebote de la
 * carrera y la inclinación al agacharse.
 */
function anclarMochilaPrensa(torso, anchoTorso) {
  const fondo = PROPORCION.TORSO.fondo / 2;

  const mochila = caja(anchoTorso * 0.82, 0.34, 0.2, 0x1c2028, 0.03);
  mochila.position.set(0, -0.01, -fondo - 0.09);
  torso.add(mochila);

  // Parche blanco: se lee "PRENSA" aunque no haya texto. El contraste del
  // rectángulo claro sobre la mochila oscura basta a esta distancia.
  const parche = caja(anchoTorso * 0.5, 0.14, 0.03, 0xf2f2f2, 0.28);
  parche.position.set(0, 0.03, -fondo - 0.19);
  torso.add(parche);

  // Franjas reflectantes.
  for (const y of [-0.12, 0.15]) {
    const franja = caja(anchoTorso * 0.84, 0.032, 0.03, 0xffcf3f, 0.55);
    franja.position.set(0, y, -fondo - 0.185);
    torso.add(franja);
  }

  // Tirantes por delante.
  for (const s of [-1, 1]) {
    const tirante = caja(0.07, 0.34, 0.05, 0x1c2028, 0.03);
    tirante.position.set(s * anchoTorso * 0.28, 0.02, fondo - 0.01);
    torso.add(tirante);
  }
}

/** Cámara de fotos colgando de la cadera. */
function anclarCamara(cadera) {
  const fondo = PROPORCION.CADERA.fondo / 2;

  const cuerpo = caja(0.19, 0.13, 0.09, 0x14161c, 0.04);
  cuerpo.position.set(0.2, -0.02, fondo);
  cadera.add(cuerpo);

  const objetivo = cilindro(0.055, 0.055, 0.07, 0x2a2f3d, 0.06);
  objetivo.rotation.x = Math.PI / 2;
  objetivo.position.set(0.2, -0.02, fondo + 0.07);
  cadera.add(objetivo);

  const lente = cilindro(0.035, 0.035, 0.02, 0x9fe8ff, 0.8);
  lente.rotation.x = Math.PI / 2;
  lente.position.set(0.2, -0.02, fondo + 0.11);
  cadera.add(lente);
}

/**
 * UKELELE — de verdad, con su cintura y sus cuatro cuerdas.
 *
 * El que traía el modelo original venía estirado de una mano a la otra: una
 * caja plana con un palo de medio metro clavado, que a esa escala es una pala.
 * Un ukelele soprano mide 53 cm de los que 24 son caja, así que aquí van esas
 * proporciones y no otras: caja con dos lóbulos y cintura, boca, puente,
 * diapasón con trastes, clavijero y cuatro cuerdas.
 *
 * Devuelve un grupo con el mástil hacia +Y y la tapa hacia +Z.
 */
function crearUkelele() {
  const uku = new THREE.Group();
  const MADERA = 0xd9a441;
  const OSCURA = 0x5a3a22;

  // --- Caja: dos lóbulos y la cintura entre ellos --------------------------
  const canto = 0.06;
  const inferior = cilindro(0.088, 0.088, canto, MADERA, 0.22);
  inferior.rotation.x = Math.PI / 2;
  inferior.position.y = -0.075;
  uku.add(inferior);

  const superior = cilindro(0.066, 0.066, canto, MADERA, 0.22);
  superior.rotation.x = Math.PI / 2;
  superior.position.y = 0.055;
  uku.add(superior);

  const cintura = caja(0.1, 0.11, canto, MADERA, 0.22);
  cintura.position.y = -0.015;
  uku.add(cintura);

  // Boca y puente, que es lo que hace que la caja se lea como una caja de
  // música y no como una paleta.
  const boca = cilindro(0.032, 0.032, 0.01, 0x241a12, 0.02);
  boca.rotation.x = Math.PI / 2;
  boca.position.set(0, 0.01, canto / 2);
  uku.add(boca);

  const puente = caja(0.075, 0.02, 0.014, OSCURA, 0.1);
  puente.position.set(0, -0.1, canto / 2);
  uku.add(puente);

  // --- Mástil y diapasón ----------------------------------------------------
  const mastil = caja(0.038, 0.2, 0.032, MADERA, 0.18);
  mastil.position.y = 0.2;
  uku.add(mastil);

  const diapason = caja(0.042, 0.2, 0.012, OSCURA, 0.08);
  diapason.position.set(0, 0.2, 0.022);
  uku.add(diapason);

  for (const y of [0.14, 0.2, 0.26]) {
    const traste = caja(0.042, 0.006, 0.006, 0xcfd6dd, 0.4);
    traste.position.set(0, y, 0.03);
    uku.add(traste);
  }

  // --- Clavijero ------------------------------------------------------------
  const pala = caja(0.056, 0.075, 0.028, OSCURA, 0.08);
  pala.position.y = 0.335;
  pala.rotation.x = -0.22;
  uku.add(pala);

  for (const s of [-1, 1]) {
    for (const y of [0.315, 0.35]) {
      const clavija = caja(0.03, 0.008, 0.008, 0xe8e2d4, 0.35);
      clavija.position.set(s * 0.04, y, 0.01);
      uku.add(clavija);
    }
  }

  // --- Cuerdas: cuatro, del puente al clavijero ----------------------------
  for (let i = 0; i < 4; i++) {
    const cuerda = caja(0.004, 0.42, 0.004, 0xf4efe2, 0.5);
    cuerda.position.set((i - 1.5) * 0.011, 0.115, 0.034);
    uku.add(cuerda);
  }

  return uku;
}

/**
 * TOSTADOLOGO — sombrero de paja, gafas y libreta.
 * El periodista veterano que ya vio esta película antes.
 */
export function crearTostadologo() {
  const g = crearHumanoide({
    colorPiel: 0xd9a06b,
    colorRopa: 0x22c55e,       // Verde de camisa, más natural que el neón puro
    colorPantalon: 0x2a3550,
  });
  const p = g.userData.partes;

  anclarSombreroDePaja(p.cabeza);
  anclarMochilaPrensa(p.torso, PROPORCION.TORSO.ancho);
  anclarCamara(p.cadera);

  // Gafas
  const gafas = caja(0.33, 0.08, 0.04, 0x0a0e17, 0.0);
  gafas.position.set(0, 0.02, 0.21);
  p.cabeza.add(gafas);

  const brilloGafa = caja(0.28, 0.045, 0.02, 0x9fe8ff, 0.9);
  brilloGafa.position.set(0, 0.025, 0.23);
  p.cabeza.add(brilloGafa);

  // Libreta EN LA MANO, no colgada del hombro: así la lleva agarrada durante
  // todo el ciclo de carrera y se dobla con el codo, que es lo que hace un
  // brazo que corre con algo en la mano.
  const libreta = caja(0.16, 0.2, 0.025, 0xf2f2f2, 0.3);
  libreta.position.set(0, -0.06, 0.06);
  libreta.rotation.x = -0.5;
  p.manoDer.add(libreta);

  const espiral = caja(0.17, 0.025, 0.035, 0xb9c6d4, 0.4);
  espiral.position.set(0, 0.03, 0.09);
  espiral.rotation.x = -0.5;
  p.manoDer.add(espiral);

  g.userData.nombre = 'Tostadologo';
  return g;
}

/**
 * AVECILLA — cabello rizado y ukelele a la espalda.
 * La reportera joven que todavía cree que esto sirve de algo.
 */
export function crearAvecilla() {
  const g = crearHumanoide({
    colorPiel: 0xc98b5e,
    colorRopa: 0x14b8a6,       // Verde azulado, para distinguirla de Tostadologo
    colorPantalon: 0x3d2a4a,
  });
  const p = g.userData.partes;

  anclarMochilaPrensa(p.torso, PROPORCION.TORSO.ancho);
  anclarCamara(p.cadera);

  // Cabello rizado: racimo de esferas alrededor del cráneo. En el modelo
  // original eran medio centenar de islas sueltas; aquí son diez, que a la
  // distancia de juego dan la misma mata y cuestan una décima parte.
  const rizos = [
    [0, 0.2, 0], [-0.18, 0.16, 0], [0.18, 0.16, 0],
    [0, 0.16, -0.19], [-0.14, 0.06, -0.18], [0.14, 0.06, -0.18],
    [-0.21, -0.02, 0.02], [0.21, -0.02, 0.02],
    [-0.12, 0.19, 0.13], [0.12, 0.19, 0.13],
  ];
  for (const [x, y, z] of rizos) {
    const rizo = esfera(0.13, 0x2b1a12, 0.05);
    rizo.position.set(x, y, z);
    p.cabeza.add(rizo);
  }

  // Ukelele a la espalda, colgado por fuera de la mochila y ladeado: así se
  // leen como dos objetos y no como una masa. La tapa mira hacia afuera.
  const uku = crearUkelele();
  uku.position.set(-0.26, -0.02, -PROPORCION.TORSO.fondo / 2 - 0.21);
  uku.rotation.set(0, Math.PI, 0.7);
  p.torso.add(uku);

  // NO lleva correa, y no es un olvido. Se probó, y una correa recta cruzando
  // la espalda a la altura del ukelele lo tacha: se lee antes la barra roja
  // que el instrumento. Como no se puede hacer que abrace la caja sin doblar
  // geometría, se queda fuera.

  // Credencial de prensa al cuello.
  const credencial = caja(0.14, 0.18, 0.02, 0xffffff, 0.4);
  credencial.position.set(0.1, -0.06, PROPORCION.TORSO.fondo / 2 + 0.01);
  p.torso.add(credencial);

  g.userData.nombre = 'Avecilla';
  return g;
}

/**
 * BUENCAN — boina y traje.
 *
 * El que llega con la pregunta ya hecha. Va de chaqueta y corbata porque
 * entra donde los otros dos no entran, y lo que hay que reconocer desde
 * atrás es esa silueta: hombros marcados y una boina plana en vez de un
 * sombrero de ala.
 *
 * OJO CON LA BOINA. Es lo único que lo distingue en el 99% del tiempo de
 * juego —que es de espaldas y a ocho metros—, así que va LADEADA y con
 * rabillo. Una boina puesta recta, a esa distancia, es una tapa.
 */
export function crearBuencan() {
  const g = crearHumanoide({
    colorPiel: 0xcf9a70,
    colorRopa: 0x2f3a4f,       // Chaqueta gris azulada
    colorPantalon: 0x232a38,
    corpulencia: 1.05,
  });
  const p = g.userData.partes;

  anclarCamara(p.cadera);

  // --- Boina ---------------------------------------------------------------
  const boina = new THREE.Group();
  const disco = cilindro(0.26, 0.23, 0.08, 0x8f2f3a, 0.06);
  boina.add(disco);
  // El rabillo, arriba y descentrado. Es medio centímetro de geometría y es
  // lo que hace que se lea "boina" y no "gorro".
  const rabillo = cilindro(0.025, 0.025, 0.06, 0x6f2029, 0.06);
  rabillo.position.set(0.03, 0.06, 0);
  boina.add(rabillo);

  boina.position.set(0.03, 0.195, -0.01);
  boina.rotation.z = -0.22;
  p.cabeza.add(boina);

  // --- Traje ---------------------------------------------------------------
  // Solapas: dos placas finas en V sobre el pecho.
  for (const s of [-1, 1]) {
    const solapa = caja(0.13, 0.3, 0.03, 0x232a38, 0.04);
    solapa.position.set(s * 0.11, 0.04, 0.17);
    solapa.rotation.z = s * 0.3;
    p.torso.add(solapa);
  }

  const camisa = caja(0.16, 0.26, 0.02, 0xf0ece2, 0.24);
  camisa.position.set(0, 0.05, 0.165);
  p.torso.add(camisa);

  const corbata = caja(0.07, 0.26, 0.025, 0x9c1f2e, 0.2);
  corbata.position.set(0, 0.01, 0.185);
  p.torso.add(corbata);

  // Bigote. Junto a la boina, es la otra pieza que lo identifica de perfil.
  const bigote = caja(0.19, 0.048, 0.04, 0x2a1c14, 0.02);
  bigote.position.set(0, -0.05, 0.2);
  p.cabeza.add(bigote);

  // Grabadora en la mano, en vez de libreta: entra a preguntar, no a apuntar.
  const grabadora = caja(0.09, 0.17, 0.05, 0x14161c, 0.05);
  grabadora.position.set(0, -0.04, 0.05);
  p.manoDer.add(grabadora);

  const testigo = caja(0.04, 0.04, 0.02, 0xff3b3b, 0.9);
  testigo.position.set(0, 0.02, 0.08);
  p.manoDer.add(testigo);

  g.userData.nombre = 'Buencan';
  return g;
}

/**
 * MONKI — casco de espartana.
 *
 * Corpulenta y plantada. La corpulencia no es un chiste sobre el cuerpo: es
 * la silueta, y en un juego donde al personaje se le ve de espaldas y
 * pequeño, una silueta ancha es lo único que lo distingue de una estrecha a
 * la primera ojeada.
 *
 * El casco lleva CRESTA, y la cresta es transversal —de oreja a oreja, no de
 * frente a nuca— porque es como va la de verdad y porque de espaldas se ve
 * como una línea horizontal, que no se parece a nada más del juego.
 */
export function crearMonki() {
  const g = crearHumanoide({
    colorPiel: 0xe0b088,
    colorRopa: 0xb8452f,       // Túnica teja
    colorPantalon: 0x3a3630,
    corpulencia: 1.42,
  });
  const p = g.userData.partes;

  anclarMochilaPrensa(p.torso, PROPORCION.TORSO.ancho * 1.42);

  // --- Casco ---------------------------------------------------------------
  // El casco es una CAJA, no un cilindro. La cabeza es cúbica, así que un
  // casco redondo la tapaba por el centro y le dejaba las cuatro esquinas del
  // cráneo al aire: parecía un gorro de baño con la cabeza asomando.
  const BRONCE = 0x8a6c28;
  const PLACA = 0xb08d3a;

  const casco = caja(0.45, 0.32, 0.44, BRONCE, 0.14);
  casco.position.set(0, 0.06, -0.015);
  p.cabeza.add(casco);

  const cupula = esfera(0.235, BRONCE, 0.14);
  cupula.position.y = 0.21;
  cupula.scale.set(1, 0.5, 0.95);
  p.cabeza.add(cupula);

  // La cara del casco: frontal, nasal y dos carrilleras. Lo que dejan sin
  // tapar son dos huecos a los lados del nasal, y esos dos huecos son los
  // ojos. Un casco de estos no tiene ojos dibujados: tiene agujeros.
  const frontal = caja(0.45, 0.09, 0.07, PLACA, 0.2);
  frontal.position.set(0, -0.07, 0.2);
  p.cabeza.add(frontal);

  const nasal = caja(0.07, 0.18, 0.07, PLACA, 0.2);
  nasal.position.set(0, -0.15, 0.2);
  p.cabeza.add(nasal);

  for (const s of [-1, 1]) {
    const carrillera = caja(0.08, 0.22, 0.14, PLACA, 0.2);
    carrillera.position.set(s * 0.185, -0.16, 0.16);
    p.cabeza.add(carrillera);
  }

  // La cresta, transversal. Cinco tacos que bajan de tamaño hacia los lados:
  // un solo bloque se lee como una caja encima de la cabeza.
  for (let i = -2; i <= 2; i++) {
    const alto = 0.2 - Math.abs(i) * 0.044;
    const taco = caja(0.088, alto, 0.13, 0x8f1f2a, 0.12);
    taco.position.set(i * 0.088, 0.31 - (0.2 - alto) / 2, -0.01);
    p.cabeza.add(taco);
  }

  // --- Escudo a la espalda -------------------------------------------------
  // Redondo, sobre la mochila. Es la segunda silueta reconocible y va detrás
  // porque detrás es donde se la ve.
  const fondo = PROPORCION.TORSO.fondo / 2;

  const escudo = cilindro(0.34, 0.34, 0.05, 0x9a6f2c, 0.14);
  escudo.rotation.x = Math.PI / 2;
  escudo.position.set(0.12, -0.02, -fondo - 0.23);
  escudo.rotation.z = 0.3;
  p.torso.add(escudo);

  const umbo = esfera(0.09, 0xd8b45a, 0.3);
  umbo.position.set(0.12, -0.02, -fondo - 0.28);
  p.torso.add(umbo);

  // Credencial de prensa, que es lo que la mete en esta redacción.
  const credencial = caja(0.15, 0.19, 0.02, 0xffffff, 0.4);
  credencial.position.set(0.14, -0.05, fondo + 0.04);
  p.torso.add(credencial);

  g.userData.nombre = 'Monki';
  return g;
}

/**
 * EL MINISTRO — al que se está entrevistando cuando empieza todo.
 *
 * No es nadie. Es un cargo: traje azul, corbata, maletín y una insignia en la
 * solapa, que es el uniforme de cualquier ministro de cualquier gobierno. No
 * lleva ni un rasgo que apunte a una persona concreta, y eso no es timidez —es
 * la regla editorial del proyecto: se satiriza el cargo y el trámite, nunca
 * una cara (ver docs/GUION.md).
 *
 * Se le ve unos segundos y de perfil, así que lo que tiene que leerse es la
 * silueta: hombros de traje, maletín colgando y esa forma de estar de pie con
 * las manos por delante que tiene todo el que está esperando a que la pregunta
 * termine.
 */
export function crearMinistro() {
  const g = crearHumanoide({
    colorPiel: 0xd8b08c,
    colorRopa: 0x1f2c4a,
    colorPantalon: 0x1a2438,
    corpulencia: 1.18,
  });
  const p = g.userData.partes;

  // Camisa y corbata bajo las solapas.
  const camisa = caja(0.18, 0.28, 0.02, 0xf4f1e8, 0.24);
  camisa.position.set(0, 0.05, 0.17);
  p.torso.add(camisa);

  const corbata = caja(0.08, 0.28, 0.025, 0x8a1c2a, 0.2);
  corbata.position.set(0, 0.01, 0.19);
  p.torso.add(corbata);

  for (const s of [-1, 1]) {
    const solapa = caja(0.14, 0.32, 0.03, 0x16203a, 0.04);
    solapa.position.set(s * 0.13, 0.05, 0.175);
    solapa.rotation.z = s * 0.28;
    p.torso.add(solapa);
  }

  // La insignia. Un cuadradito dorado que no dice de qué es, y ese es el
  // chiste: siempre hay una y nunca se sabe de qué.
  const insignia = caja(0.06, 0.06, 0.02, 0xd8b45a, 0.55);
  insignia.position.set(0.17, 0.14, 0.2);
  p.torso.add(insignia);

  // Pelo peinado con raya, en dos bloques de distinta altura.
  const pelo = caja(0.43, 0.1, 0.41, 0x241a12, 0.03);
  pelo.position.y = 0.175;
  p.cabeza.add(pelo);
  const copete = caja(0.22, 0.075, 0.35, 0x241a12, 0.03);
  copete.position.set(-0.08, 0.24, 0);
  p.cabeza.add(copete);

  // Maletín en la mano izquierda.
  const maletin = caja(0.34, 0.26, 0.1, 0x3a2a1c, 0.05);
  maletin.position.set(0, -0.17, 0);
  p.manoIzq.add(maletin);

  const asa = caja(0.12, 0.05, 0.03, 0x241a12, 0.05);
  asa.position.set(0, -0.03, 0);
  p.manoIzq.add(asa);

  // De pie, esperando a que la pregunta termine: brazos caídos y peso atrás.
  p.brazoDer.rotation.x = -0.18;
  p.antebrazoDer.rotation.x = -0.35;
  p.brazoIzq.rotation.x = 0.1;
  p.torso.rotation.x = -0.05;

  g.userData.nombre = 'El ministro';
  return g;
}

/**
 * Devuelve el modelo del personaje pedido.
 *
 * Existe para que nadie más tenga que saber qué constructor va con qué id:
 * antes había un ternario `nombre === 'alondra' ? … : …` repetido en dos
 * sitios del jugador, y con cuatro personajes eso ya no escala.
 */
export function crearPersonaje(id) {
  // ¿Hay una versión retocada en Blender? Manda ella. Ver models/hitos.js: el
  // archivo se busca al arrancar y, si no está, se sigue con el procedural de
  // siempre. Así se puede cambiar un personaje sin tocar una línea de código.
  //
  // OJO: una pieza importada NO se anima. animarCarrera() busca los miembros
  // por nombre (`piernaIzq`, `brazoDer`…), y si el archivo no los trae, el
  // personaje corre quieto. Está documentado en el README.
  const editada = piezaEditada(`personaje-${id}`);
  if (editada) return editada;

  switch (id) {
    case 'avecilla': return crearAvecilla();
    case 'buencan': return crearBuencan();
    case 'monki': return crearMonki();
    case 'tostadologo':
    default: return crearTostadologo();
  }
}

// ---------------------------------------------------------------------------
// PERSEGUIDORES
// ---------------------------------------------------------------------------

/**
 * EL DÚO PERSEGUIDOR — uno haciendo caballito sobre el otro.
 * Se ve al fondo de la pantalla; por eso la silueta importa más que el detalle.
 */
export function crearPerseguidores() {
  const grupo = new THREE.Group();

  // --- EL DE ABAJO: robusto, traje oscuro. Es el que carga. ----------------
  const abajo = crearHumanoide({
    colorPiel: 0xc08a5e,
    colorRopa: 0x1f2333,     // Traje oscuro
    colorPantalon: 0x151824,
    corpulencia: 1.45,        // Más ancho de hombros
  });
  const pr = abajo.userData.partes;

  // Corbata
  const corbata = caja(0.09, 0.3, 0.03, 0xff4f6d, 0.5);
  corbata.position.set(0, -0.04, 0.18);
  pr.torso.add(corbata);

  // Los brazos van hacia adelante y arriba, sujetando por las espinillas al
  // de encima —que es como se sujeta a alguien subido a los hombros—.
  pr.brazoIzq.rotation.x = -1.5;
  pr.brazoDer.rotation.x = -1.5;
  pr.antebrazoIzq.rotation.x = -0.9;
  pr.antebrazoDer.rotation.x = -0.9;

  grupo.add(abajo);

  // --- EL DE ARRIBA: delgado, gafas, camisa blanca. ------------------------
  const arriba = crearHumanoide({
    colorPiel: 0xe0b088,
    colorRopa: 0xf2f2f2,     // Camisa blanca
    colorPantalon: 0x2a3550,
    corpulencia: 0.82,        // Más delgado
  });
  const pn = arriba.userData.partes;

  // Gafas
  const gafas = caja(0.31, 0.07, 0.04, 0x0a0e17, 0.0);
  gafas.position.set(0, 0.02, 0.21);
  pn.cabeza.add(gafas);

  const brilloGafa = caja(0.26, 0.04, 0.02, 0xff9f9f, 0.8);
  brilloGafa.position.set(0, 0.025, 0.23);
  pn.cabeza.add(brilloGafa);

  // Piernas abiertas, montado sobre los hombros.
  pn.piernaIzq.rotation.z = 0.62;
  pn.piernaDer.rotation.z = -0.62;
  pn.piernaIzq.rotation.x = -0.5;
  pn.piernaDer.rotation.x = -0.5;
  pn.pantorrillaIzq.rotation.x = 0.85;
  pn.pantorrillaDer.rotation.x = 0.85;

  // Un brazo señalando al frente: el gesto de "a ese".
  pn.brazoDer.rotation.x = -1.75;
  pn.brazoIzq.rotation.x = 0.4;

  // Se sienta ENCIMA DE LA CABEZA del de abajo, no sobre la línea de hombros.
  // Anatómicamente uno se sienta en los hombros, sí, pero entonces la cabeza
  // del de abajo y el tronco del de arriba ocupan el mismo metro cúbico y los
  // dos se ven como un solo bicho de dos cabezas. Poniendo la ingle a la
  // altura de la coronilla, las piernas caen a los lados de esa cabeza y la
  // torre se lee: dos personas, una encima de otra.
  const ESCALA = 0.82;
  const CORONILLA = PROPORCION.CABEZA.y + PROPORCION.CABEZA.alto / 2;
  arriba.scale.setScalar(ESCALA);
  arriba.position.set(0, CORONILLA - PROPORCION.INGLE.y * ESCALA, -0.04);
  grupo.add(arriba);

  grupo.userData.partes = {
    reimberg: pr,
    noboa: pn,
    grupoReimberg: abajo,
    grupoNoboa: arriba,
    alturaMontado: arriba.position.y,
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
 * QUÉ HACE QUE ESTO PAREZCA UNA CARRERA Y NO UN COMPÁS
 *   · La rodilla se dobla en la recuperación, no en el apoyo. El talón sube
 *     por detrás justo después de despegar, y la pierna llega estirada al
 *     suelo. Sin eso, las piernas son dos palos que abren y cierran.
 *   · Los codos van doblados y fijos alrededor de 90°: nadie corre con los
 *     brazos colgando.
 *   · El tronco y la cadera giran en sentidos opuestos. Es el detalle que más
 *     se nota de espaldas, que es como se ve al personaje todo el rato.
 *   · El rebote va al DOBLE de la zancada (se sube una vez por pie), y la
 *     cabeza llega un pelo tarde.
 *
 * @param {THREE.Group} personaje  Grupo devuelto por crearTostadologo/…
 * @param {number} tiempo          Tiempo acumulado en segundos
 * @param {number} intensidad      0 = quieto, 1 = carrera completa
 * @param {number} cadencia        Zancadas por segundo (sube con la velocidad)
 */
export function animarCarrera(personaje, tiempo, intensidad = 1, cadencia = 9) {
  const p = personaje.userData?.partes;
  if (!p) return;

  const P = PROPORCION;
  const fase = tiempo * cadencia;
  const k = intensidad;

  // Un lado va medio ciclo por detrás del otro.
  for (const lado of [0, 1]) {
    const f = fase + lado * Math.PI;
    const sufijo = lado === 0 ? 'Izq' : 'Der';
    const sen = Math.sin(f);

    // Cadera: adelante (negativo) y atrás (positivo).
    p[`pierna${sufijo}`].rotation.x = sen * 0.95 * k;

    // Rodilla: dobla al recoger, es decir un cuarto de ciclo DESPUÉS del
    // punto más atrasado. Nunca al revés (la rodilla no se dobla hacia
    // adelante), de ahí el max(0, …).
    const recogida = Math.max(0, Math.sin(f - 0.9));
    p[`pantorrilla${sufijo}`].rotation.x = (0.18 + 1.25 * recogida) * k;

    // Tobillo: empuja al despegar y se levanta la punta al llegar.
    p[`pie${sufijo}`].rotation.x = (0.3 * Math.max(0, Math.sin(f - 0.3))
      - 0.25 * Math.max(0, -sen)) * k;

    // Brazo contrario a la pierna del mismo lado.
    const brazo = lado === 0 ? 'Der' : 'Izq';
    p[`brazo${brazo}`].rotation.x = sen * 0.7 * k;
    p[`antebrazo${brazo}`].rotation.x = -(1.0 + 0.45 * Math.max(0, -sen)) * k;
  }

  // Rebote vertical: se sube una vez por pie, o sea al doble de la zancada.
  const rebote = Math.abs(Math.sin(fase)) * 0.045 * k;
  p.torso.position.y = P.TORSO.y + rebote;
  p.cadera.position.y = P.CADERA.y + rebote * 0.65;
  p.cuello.position.y = P.CUELLO.y + rebote;
  // La cabeza llega tarde: es lo que da el bamboleo.
  p.cabeza.position.y = P.CABEZA.y + Math.abs(Math.sin(fase - 0.35)) * 0.045 * k;

  // Torsión: el tronco gira contra la cadera, y la cabeza corrige.
  const giro = Math.sin(fase) * k;
  p.torso.rotation.y = giro * 0.13;
  p.cadera.rotation.y = -giro * 0.1;
  p.cabeza.rotation.y = -giro * 0.05;

  // Ligera inclinación hacia adelante: da sensación de urgencia.
  p.torso.rotation.x = 0.16 * k;
  p.cabeza.rotation.x = -0.06 * k;
  p.torso.rotation.z = 0;
  p.cabeza.rotation.z = 0;
}

/**
 * Pose de salto. Ya no es una postura congelada: cambia con la fase del vuelo,
 * que es lo que distingue un salto de una estatua que sube y baja.
 *
 *   · Al despegar (subida = 1) se encoge: rodillas al pecho y brazos arriba.
 *   · En lo alto (subida = 0) se estira, un instante de suspensión.
 *   · Al caer (subida = −1) adelanta las piernas a buscar el suelo y echa los
 *     brazos atrás.
 *
 * @param {number} subida  velocidadY normalizada: +1 subiendo, −1 cayendo.
 */
export function animarSalto(personaje, subida = 0) {
  const p = personaje.userData?.partes;
  if (!p) return;

  const P = PROPORCION;
  const sube = Math.max(0, Math.min(1, subida));
  const cae = Math.max(0, Math.min(1, -subida));

  // Pierna de delante: la que se recoge al despegar y se adelanta al caer.
  p.piernaIzq.rotation.x = -0.5 - 0.55 * sube - 0.2 * cae;
  p.pantorrillaIzq.rotation.x = 0.45 + 1.1 * sube - 0.3 * cae;
  p.pieIzq.rotation.x = -0.2 - 0.2 * cae;

  // Pierna de atrás: se queda colgando, y al caer se recoge para amortiguar.
  p.piernaDer.rotation.x = 0.35 + 0.3 * sube - 0.15 * cae;
  p.pantorrillaDer.rotation.x = 0.35 + 0.95 * sube + 0.45 * cae;
  p.pieDer.rotation.x = 0.25 * sube;

  // Brazos arriba al impulsarse, atrás al caer.
  const brazo = -1.15 - 0.55 * sube + 1.35 * cae;
  p.brazoIzq.rotation.x = brazo;
  p.brazoDer.rotation.x = brazo;
  p.antebrazoIzq.rotation.x = -0.55 - 0.5 * sube;
  p.antebrazoDer.rotation.x = -0.55 - 0.5 * sube;

  // El tronco se recoge al subir y se abre al caer.
  p.torso.rotation.x = 0.2 * sube - 0.12 * cae;
  p.torso.rotation.y = 0;
  p.cadera.rotation.y = 0;
  p.cabeza.rotation.x = -0.1 * cae;
  p.cabeza.rotation.y = 0;

  p.torso.position.y = P.TORSO.y;
  p.cadera.position.y = P.CADERA.y;
  p.cuello.position.y = P.CUELLO.y;
  p.cabeza.position.y = P.CABEZA.y;
}

/**
 * Animación del dúo perseguidor. El de abajo trota pesado; el de arriba se
 * bambolea encima y señala.
 */
export function animarPerseguidores(grupo, tiempo) {
  const partes = grupo.userData?.partes;
  if (!partes) return;

  const P = PROPORCION;
  const { reimberg, noboa, grupoNoboa, alturaMontado } = partes;

  // Corre con cadencia más lenta y zancada más corta: pesa más.
  const fase = tiempo * 7;
  reimberg.piernaIzq.rotation.x = Math.sin(fase) * 0.7;
  reimberg.piernaDer.rotation.x = Math.sin(fase + Math.PI) * 0.7;
  reimberg.pantorrillaIzq.rotation.x = 0.2 + 0.9 * Math.max(0, Math.sin(fase - 0.9));
  reimberg.pantorrillaDer.rotation.x = 0.2 + 0.9 * Math.max(0, Math.sin(fase + Math.PI - 0.9));

  const rebote = Math.abs(Math.sin(fase)) * 0.07;
  reimberg.torso.position.y = P.TORSO.y + rebote;
  reimberg.cadera.position.y = P.CADERA.y + rebote * 0.65;
  reimberg.cabeza.position.y = P.CABEZA.y + rebote;
  reimberg.cuello.position.y = P.CUELLO.y + rebote;

  // El de arriba acompaña el rebote con retraso: se bambolea.
  grupoNoboa.position.y = alturaMontado + rebote * 1.5;
  grupoNoboa.rotation.z = Math.sin(fase * 0.5) * 0.08;

  // El brazo que señala oscila un poco, insistente.
  noboa.brazoDer.rotation.x = -1.75 + Math.sin(tiempo * 4) * 0.15;
}

/**
 * AGACHARSE ES UNA VOLTERETA HACIA ADELANTE.
 *
 * Antes se encogía en el sitio: el personaje se aplastaba en Y y se inclinaba,
 * que a la velocidad a la que va esto se lee como un fallo de escala más que
 * como una acción. Una voltereta, en cambio, ocupa el mismo hueco bajo el
 * pórtico, dura lo mismo, y se entiende de un vistazo.
 *
 * CÓMO RUEDA. El giro va en `cuerpo`, el grupo intermedio, y no en el grupo de
 * fuera: el de fuera tiene el origen en los pies, y girarlo ahí sería un
 * compás. Rodar es girar alrededor de un punto en la barriga, así que además
 * del giro hay que compensar la posición —rotar sobre un pivote P equivale a
 * rotar sobre el origen y luego trasladar P − R·P—, y eso es lo que hacen las
 * dos líneas de `cuerpo.position`.
 *
 * @param {number} factor 0 = de pie, 1 = totalmente encogido
 * @param {number} giro   Ángulo de la voltereta en radianes (0 → 2π)
 */
export function aplicarPoseAgachado(personaje, factor, giro = 0) {
  const p = personaje.userData?.partes;
  if (!p?.cuerpo) return;

  const O = PROPORCION.OVILLO;
  const h = O.centro;

  // El giro va SIEMPRE, aunque el factor sea cero: así la vuelta termina
  // mientras el cuerpo se está estirando, y no se corta a medio camino.
  p.cuerpo.rotation.x = giro;
  p.cuerpo.position.y = h * (1 - Math.cos(giro));
  p.cuerpo.position.z = -h * Math.sin(giro);

  const f = Math.min(1, factor);

  // Estirado del todo: se devuelve el fondo a su sitio y se sale. La altura no
  // se toca, que es de quien esté animando la carrera y lleva su rebote.
  if (f <= 0.001) {
    for (const parte of piezasMoviles(p)) {
      if (parte?.userData?.reposo) parte.position.z = parte.userData.reposo.z;
    }
    for (const b of [p.brazoIzq, p.brazoDer, p.piernaIzq, p.piernaDer]) {
      if (b?.userData?.reposo) b.position.y = b.userData.reposo.y;
    }
    return;
  }

  // Recoger una pieza: SIEMPRE desde su sitio de reposo, nunca desde donde
  // esté ahora. Interpolar contra la posición actual acumula error, y basta
  // con que el jugador mantenga la agachada un segundo para que el cuerpo se
  // desarme pieza a pieza.
  const recoger = (parte, destino) => {
    const r = parte.userData.reposo;
    parte.position.y = r.y + (destino.y - r.y) * f;
    parte.position.z = r.z + (destino.z - r.z) * f;
  };
  recoger(p.cabeza, O.cabeza);
  recoger(p.cuello, O.cuello);
  recoger(p.torso, O.torso);
  recoger(p.cadera, O.cadera);
  for (const b of [p.brazoIzq, p.brazoDer]) recoger(b, O.hombro);
  for (const l of [p.piernaIzq, p.piernaDer]) recoger(l, O.ingle);

  // Doblar una articulación hacia el ángulo del ovillo.
  const doblar = (parte, angulo) => {
    parte.rotation.x += (angulo - parte.rotation.x) * f;
  };
  doblar(p.torso, 0.9);
  doblar(p.cabeza, 0.85);

  // Rodillas al pecho y talones al trasero.
  doblar(p.piernaIzq, -1.75);
  doblar(p.piernaDer, -1.55);
  doblar(p.pantorrillaIzq, 2.3);
  doblar(p.pantorrillaDer, 2.3);
  doblar(p.pieIzq, 0.2);
  doblar(p.pieDer, 0.2);

  // Brazos abrazando las rodillas.
  doblar(p.brazoIzq, -1.0);
  doblar(p.brazoDer, -1.0);
  doblar(p.antebrazoIzq, -2.0);
  doblar(p.antebrazoDer, -2.0);
}
