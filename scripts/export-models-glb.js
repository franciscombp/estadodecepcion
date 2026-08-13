#!/usr/bin/env node
/**
 * Exporta todos los modelos procedurales a GLB para edición externa.
 * Usa serialización directa a glTF JSON + binario sin dependencias de navegador.
 *
 * Uso:
 *   npm install gltf-transform
 *   node scripts/export-models-glb.js
 */

import * as THREE from 'three';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, '../public/assets/models/export');

// Asegurar que el directorio existe
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// ============================================================================
// CONSTRUCCIÓN DE MODELOS
// ============================================================================

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

function caja(ancho, alto, profundo, color, emision) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, profundo),
    material(color, emision)
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function esfera(radio, color, emision) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radio, 8, 6),
    material(color, emision)
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cilindro(radioSup, radioInf, alto, color, emision) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radioSup, radioInf, alto, 8),
    material(color, emision)
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function crearHumanoide({ colorPiel, colorRopa, colorPantalon, corpulencia = 1 }) {
  const grupo = new THREE.Group();
  grupo.name = 'Humanoide';
  const partes = {};

  const anchoTorso = 0.52 * corpulencia;

  const torso = caja(anchoTorso, 0.62, 0.3 * corpulencia, colorRopa);
  torso.name = 'Torso';
  torso.position.y = 1.12;
  grupo.add(torso);
  partes.torso = torso;

  const cadera = caja(anchoTorso * 0.9, 0.22, 0.28 * corpulencia, colorPantalon);
  cadera.name = 'Cadera';
  cadera.position.y = 0.76;
  grupo.add(cadera);
  partes.cadera = cadera;

  const cabeza = caja(0.34, 0.36, 0.32, colorPiel);
  cabeza.name = 'Cabeza';
  cabeza.position.y = 1.62;
  grupo.add(cabeza);
  partes.cabeza = cabeza;

  const cuello = caja(0.14, 0.1, 0.14, colorPiel);
  cuello.name = 'Cuello';
  cuello.position.y = 1.44;
  grupo.add(cuello);

  const crearBrazo = (signo, lado) => {
    const pivote = new THREE.Group();
    pivote.name = lado;
    pivote.position.set(signo * (anchoTorso / 2 + 0.09), 1.36, 0);

    const brazo = caja(0.16, 0.5, 0.16, colorRopa);
    brazo.name = `${lado}_Brazo`;
    brazo.position.y = -0.25;
    pivote.add(brazo);

    const mano = esfera(0.09, colorPiel);
    mano.name = `${lado}_Mano`;
    mano.position.y = -0.54;
    pivote.add(mano);

    grupo.add(pivote);
    return pivote;
  };
  partes.brazoIzq = crearBrazo(-1, 'BrazoIzq');
  partes.brazoDer = crearBrazo(1, 'BrazoDer');

  const crearPierna = (signo, lado) => {
    const pivote = new THREE.Group();
    pivote.name = lado;
    pivote.position.set(signo * 0.14, 0.72, 0);

    const pierna = caja(0.19, 0.62, 0.19, colorPantalon);
    pierna.name = `${lado}_Pierna`;
    pierna.position.y = -0.31;
    pivote.add(pierna);

    const pie = caja(0.21, 0.12, 0.3, 0x1a1a22);
    pie.name = `${lado}_Pie`;
    pie.position.set(0, -0.66, 0.05);
    pivote.add(pie);

    grupo.add(pivote);
    return pivote;
  };
  partes.piernaIzq = crearPierna(-1, 'PiernaIzq');
  partes.piernaDer = crearPierna(1, 'PiernaDer');

  grupo.userData.partes = partes;
  return grupo;
}

function crearChochologo() {
  const g = crearHumanoide({
    colorPiel: 0xd9a06b,
    colorRopa: 0x22c55e,
    colorPantalon: 0x2a3550,
  });
  g.name = 'Chochologo';
  const p = g.userData.partes;

  const ala = cilindro(0.36, 0.36, 0.045, 0xe8cd8f, 0.06);
  ala.name = 'Sombrero_Ala';
  ala.position.y = 0.19;
  p.cabeza.add(ala);

  const copa = cilindro(0.21, 0.235, 0.2, 0xdfc07c, 0.06);
  copa.name = 'Sombrero_Copa';
  copa.position.y = 0.3;
  p.cabeza.add(copa);

  const remate = cilindro(0.215, 0.215, 0.03, 0xd4b268, 0.06);
  remate.name = 'Sombrero_Remate';
  remate.position.y = 0.4;
  p.cabeza.add(remate);

  const mochila = caja(0.52 * 0.82, 0.5, 0.22, 0x1c2028, 0.03);
  mochila.name = 'Mochila_Principal';
  mochila.position.set(0, -0.02, -0.26);
  p.torso.add(mochila);

  const parche = caja(0.52 * 0.5, 0.17, 0.03, 0xf2f2f2, 0.28);
  parche.name = 'Mochila_Parche';
  parche.position.set(0, 0.04, -0.38);
  p.torso.add(parche);

  const cuerpoCamera = caja(0.19, 0.13, 0.09, 0x14161c, 0.04);
  cuerpoCamera.name = 'Camera_Cuerpo';
  cuerpoCamera.position.set(0.2, -0.04, 0.12);
  p.cadera.add(cuerpoCamera);

  const gafas = caja(0.3, 0.08, 0.04, 0x0a0e17, 0.0);
  gafas.name = 'Gafas';
  gafas.position.set(0, 0.03, 0.17);
  p.cabeza.add(gafas);

  const libreta = caja(0.16, 0.2, 0.025, 0xf2f2f2, 0.3);
  libreta.name = 'Libreta';
  libreta.position.set(0, -0.6, 0.1);
  libreta.rotation.x = -0.5;
  p.brazoDer.add(libreta);

  return g;
}

function crearAlondra() {
  const g = crearHumanoide({
    colorPiel: 0xc98b5e,
    colorRopa: 0x14b8a6,
    colorPantalon: 0x3d2a4a,
  });
  g.name = 'Alondra';
  const p = g.userData.partes;

  const mochila = caja(0.52 * 0.82, 0.5, 0.22, 0x1c2028, 0.03);
  mochila.name = 'Mochila_Principal';
  mochila.position.set(0, -0.02, -0.26);
  p.torso.add(mochila);

  const cuerpoCamera = caja(0.19, 0.13, 0.09, 0x14161c, 0.04);
  cuerpoCamera.name = 'Camera_Cuerpo';
  cuerpoCamera.position.set(0.2, -0.04, 0.12);
  p.cadera.add(cuerpoCamera);

  const rizos = [
    [0, 0.22, 0], [-0.17, 0.17, 0], [0.17, 0.17, 0],
    [0, 0.17, -0.17], [-0.13, 0.08, -0.15], [0.13, 0.08, -0.15],
    [-0.19, 0.02, 0.02], [0.19, 0.02, 0.02],
  ];
  for (const [i, [x, y, z]] of rizos.entries()) {
    const rizo = esfera(0.13, 0x2b1a12, 0.05);
    rizo.name = `Cabello_Rizo_${i}`;
    rizo.position.set(x, y, z);
    p.cabeza.add(rizo);
  }

  const uku = new THREE.Group();
  uku.name = 'Ukulele';
  const cuerpoUku = cilindro(0.13, 0.15, 0.07, 0xd9a441, 0.3);
  cuerpoUku.name = 'Ukulele_Cuerpo';
  cuerpoUku.rotation.x = Math.PI / 2;
  uku.add(cuerpoUku);

  const mastil = caja(0.05, 0.42, 0.05, 0x6b4a2f, 0.2);
  mastil.name = 'Ukulele_Mastil';
  mastil.position.y = 0.28;
  uku.add(mastil);

  uku.position.set(-0.26, -0.06, -0.34);
  uku.rotation.set(0, 0, 0.75);
  p.torso.add(uku);

  const credencial = caja(0.14, 0.18, 0.02, 0xffffff, 0.4);
  credencial.name = 'Credencial';
  credencial.position.set(0.1, -0.1, 0.17);
  p.torso.add(credencial);

  return g;
}

function crearBuscan() {
  const g = crearHumanoide({
    colorPiel: 0xcf9a70,
    colorRopa: 0x2f3a4f,
    colorPantalon: 0x232a38,
    corpulencia: 1.05,
  });
  g.name = 'Buscan';
  const p = g.userData.partes;

  const boina = new THREE.Group();
  boina.name = 'Boina';
  const disco = cilindro(0.3, 0.26, 0.075, 0x8f2f3a, 0.06);
  disco.name = 'Boina_Disco';
  boina.add(disco);

  boina.position.set(0.03, 0.22, -0.01);
  boina.rotation.z = -0.22;
  p.cabeza.add(boina);

  const camisa = caja(0.16, 0.3, 0.02, 0xf0ece2, 0.24);
  camisa.name = 'Traje_Camisa';
  camisa.position.set(0, 0.06, 0.155);
  p.torso.add(camisa);

  const corbata = caja(0.07, 0.3, 0.025, 0x9c1f2e, 0.2);
  corbata.name = 'Traje_Corbata';
  corbata.position.set(0, 0.02, 0.175);
  p.torso.add(corbata);

  const grabadora = caja(0.09, 0.17, 0.05, 0x14161c, 0.05);
  grabadora.name = 'Grabadora';
  grabadora.position.set(0, -0.58, 0.08);
  p.brazoDer.add(grabadora);

  return g;
}

function crearBlanki() {
  const g = crearHumanoide({
    colorPiel: 0xe0b088,
    colorRopa: 0xb8452f,
    colorPantalon: 0x3a3630,
    corpulencia: 1.42,
  });
  g.name = 'Blanki';
  const p = g.userData.partes;

  const casco = cilindro(0.235, 0.25, 0.26, 0xb08d3a, 0.16);
  casco.name = 'Casco_Cilindro';
  casco.position.y = 0.13;
  p.cabeza.add(casco);

  const cupula = esfera(0.235, 0xb08d3a, 0.16);
  cupula.name = 'Casco_Cupula';
  cupula.position.y = 0.26;
  cupula.scale.y = 0.7;
  p.cabeza.add(cupula);

  const nasal = caja(0.055, 0.2, 0.05, 0xc79c42, 0.18);
  nasal.name = 'Casco_Nasal';
  nasal.position.set(0, -0.02, 0.2);
  p.cabeza.add(nasal);

  const escudo = cilindro(0.34, 0.34, 0.05, 0x9a6f2c, 0.14);
  escudo.name = 'Escudo_Disco';
  escudo.rotation.x = Math.PI / 2;
  escudo.position.set(0.12, -0.04, -0.42);
  escudo.rotation.z = 0.3;
  p.torso.add(escudo);

  const umbo = esfera(0.09, 0xd8b45a, 0.3);
  umbo.name = 'Escudo_Umbo';
  umbo.position.set(0.12, -0.04, -0.47);
  p.torso.add(umbo);

  return g;
}

function crearMinistro() {
  const g = crearHumanoide({
    colorPiel: 0xd8b08c,
    colorRopa: 0x1f2c4a,
    colorPantalon: 0x1a2438,
    corpulencia: 1.18,
  });
  g.name = 'Ministro';
  const p = g.userData.partes;

  const camisa = caja(0.18, 0.32, 0.02, 0xf4f1e8, 0.24);
  camisa.name = 'Traje_Camisa';
  camisa.position.set(0, 0.05, 0.16);
  p.torso.add(camisa);

  const corbata = caja(0.08, 0.32, 0.025, 0x8a1c2a, 0.2);
  corbata.name = 'Traje_Corbata';
  corbata.position.set(0, 0.01, 0.18);
  p.torso.add(corbata);

  const insignia = caja(0.06, 0.06, 0.02, 0xd8b45a, 0.55);
  insignia.name = 'Insignia';
  insignia.position.set(0.17, 0.16, 0.19);
  p.torso.add(insignia);

  const maletin = caja(0.34, 0.26, 0.1, 0x3a2a1c, 0.05);
  maletin.name = 'Maletin';
  maletin.position.set(0, -0.68, 0);
  p.brazoIzq.add(maletin);

  return g;
}

function crearPerseguidores() {
  const grupo = new THREE.Group();
  grupo.name = 'Perseguidores';

  const reimberg = crearHumanoide({
    colorPiel: 0xc08a5e,
    colorRopa: 0x1f2333,
    colorPantalon: 0x151824,
    corpulencia: 1.45,
  });
  reimberg.name = 'Reimberg';
  grupo.add(reimberg);

  const noboa = crearHumanoide({
    colorPiel: 0xe0b088,
    colorRopa: 0xf2f2f2,
    colorPantalon: 0x2a3550,
    corpulencia: 0.82,
  });
  noboa.name = 'Noboa';
  noboa.position.y = 1.52;
  noboa.scale.setScalar(0.92);
  grupo.add(noboa);

  return grupo;
}

function crearPapel() {
  const papel = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.5, 0.03),
    material(0xffd94f, 0.55)
  );
  papel.name = 'Papel';
  return papel;
}

function crearEvidencia() {
  const g = new THREE.Group();
  g.name = 'Evidencia_USB';

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.42, 0.13),
    material(0x1c2230, 0.04)
  );
  cuerpo.name = 'Cuerpo';
  g.add(cuerpo);

  const etiqueta = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.18, 0.15),
    material(0xff8800, 1.7)
  );
  etiqueta.name = 'Etiqueta';
  etiqueta.position.y = -0.04;
  g.add(etiqueta);

  return g;
}

function crearPalmera() {
  const g = new THREE.Group();
  g.name = 'Palmera';

  const segmentos = 5;
  for (let i = 0; i < segmentos; i++) {
    const t = i / segmentos;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 - t * 0.05, 0.18 - t * 0.05, 6 / segmentos, 6),
      material(0x5a4432, 0.03)
    );
    seg.name = `Tronco_${i}`;
    seg.position.set(Math.sin(t * 1.5) * 0.35, (6 / segmentos) * (i + 0.5), 0);
    seg.rotation.z = -Math.sin(t * 1.5) * 0.18;
    g.add(seg);
  }

  const copaX = Math.sin(1.5) * 0.35;
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const hoja = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 2.3, 4),
      material(0x1f7a4d, 0.14)
    );
    hoja.name = `Hoja_${i}`;
    hoja.position.set(
      copaX + Math.cos(ang) * 0.85,
      6 - 0.15,
      Math.sin(ang) * 0.85
    );
    hoja.rotation.z = Math.cos(ang) * 1.15;
    hoja.rotation.x = Math.sin(ang) * 1.15;
    g.add(hoja);
  }

  const coco = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 6, 5),
    material(0x4a3220, 0.02)
  );
  coco.name = 'Coco';
  coco.position.set(copaX, 6 - 0.35, 0.2);
  g.add(coco);

  return g;
}

// ============================================================================
// OBSTÁCULOS PRINCIPALES
// ============================================================================

function crearObstaculoSaltar() {
  const g = new THREE.Group();
  g.name = 'Obstacle_Saltar';

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.88, 0.45, 0.22),
    material(0xbf8f24, 0.06)
  );
  panel.name = 'Panel';
  panel.position.y = 0.42;
  g.add(panel);

  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(0.90, 0.13, 0.26),
    material(0xff1030, 1.9)
  );
  franja.name = 'Franja_Danger';
  franja.position.y = 0.68;
  g.add(franja);

  return g;
}

function crearObstaculoAgachar() {
  const g = new THREE.Group();
  g.name = 'Obstacle_Agachar';

  const barra = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 1.0, 0.4),
    material(0xbf8f24, 0.06)
  );
  barra.name = 'Barra';
  barra.position.y = 1.36;
  g.add(barra);

  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.12, 0.44),
    material(0xff1030, 1.9)
  );
  franja.name = 'Franja_Danger';
  franja.position.y = 0.72;
  g.add(franja);

  return g;
}

function crearObstaculoEsquivar() {
  const g = new THREE.Group();
  g.name = 'Obstacle_Esquivar';

  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 1.68, 1.05),
    material(0x6b4a2f, 0.04)
  );
  cuerpo.name = 'Cuerpo';
  cuerpo.position.y = 0.84;
  g.add(cuerpo);

  const aspa1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.99, 0.13, 0.07),
    material(0xff1030, 2)
  );
  aspa1.name = 'X_Aspa_1';
  aspa1.position.set(0, 0.88, 0.58);
  aspa1.rotation.z = Math.PI / 4;
  g.add(aspa1);

  const aspa2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.99, 0.13, 0.07),
    material(0xff1030, 2)
  );
  aspa2.name = 'X_Aspa_2';
  aspa2.position.set(0, 0.88, 0.58);
  aspa2.rotation.z = -Math.PI / 4;
  g.add(aspa2);

  return g;
}

function crearObstaculoDoble() {
  const g = new THREE.Group();
  g.name = 'Obstacle_Doble_Bus';

  const carroceria = new THREE.Mesh(
    new THREE.BoxGeometry(1.86, 1.68, 1.6),
    material(0x8a94a6, 0.14)
  );
  carroceria.name = 'Carroceria';
  carroceria.position.y = 1.08;
  g.add(carroceria);

  const franja = new THREE.Mesh(
    new THREE.BoxGeometry(1.88, 0.28, 1.62),
    material(0xd8b45a, 1.4)
  );
  franja.name = 'Franja_Band';
  franja.position.y = 0.88;
  g.add(franja);

  for (let i = -1; i <= 1; i++) {
    const ventana = new THREE.Mesh(
      new THREE.BoxGeometry(0.43, 0.46, 0.05),
      material(0x9fe8ff, 1.3)
    );
    ventana.name = `Ventana_${i}`;
    ventana.position.set(i * 0.54, 1.36, 0.82);
    g.add(ventana);
  }

  for (const s of [-1, 1]) {
    const faro = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 8, 6),
      material(0xfff4d6, 2)
    );
    faro.name = `Faro_${s > 0 ? 'R' : 'L'}`;
    faro.position.set(s * 0.67, 0.72, 0.82);
    g.add(faro);
  }

  return g;
}

// ============================================================================
// EXPORTACIÓN A ARCHIVO BINARY GLB
// ============================================================================

function exportToGLB(scene, filename) {
  const gltf = {
    asset: { generator: 'Estado Decepción Export', version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [],
    meshes: [],
    materials: [],
    geometries: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0, uri: 'data.bin' }],
  };

  let bufferData = [];
  let meshIndex = 0;
  const geometryMap = new Map();
  const materialMap = new Map();

  function addNode(object) {
    const node = {
      name: object.name || 'Node',
    };

    if (object.position.x !== 0 || object.position.y !== 0 || object.position.z !== 0) {
      node.translation = [object.position.x, object.position.y, object.position.z];
    }

    if (object.quaternion.x !== 0 || object.quaternion.y !== 0 ||
        object.quaternion.z !== 0 || object.quaternion.w !== 1) {
      node.rotation = [object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w];
    }

    if (object.scale.x !== 1 || object.scale.y !== 1 || object.scale.z !== 1) {
      node.scale = [object.scale.x, object.scale.y, object.scale.z];
    }

    if (object.isMesh) {
      if (!geometryMap.has(object.geometry)) {
        geometryMap.set(object.geometry, gltf.meshes.length);
        addMesh(object);
      }
      node.mesh = geometryMap.get(object.geometry);
    }

    const nodeIndex = gltf.nodes.length;
    gltf.nodes.push(node);

    if (object.children.length > 0) {
      node.children = [];
      for (const child of object.children) {
        const childIndex = addNode(child);
        node.children.push(childIndex);
      }
    }

    return nodeIndex;
  }

  function addMesh(object) {
    const geometry = object.geometry;
    const material = object.material;

    // Geometría
    const positions = geometry.attributes.position.array;
    const positionAccessor = addAccessor(positions, 'VEC3', 5126);

    let normalAccessor = null;
    if (geometry.attributes.normal) {
      const normals = geometry.attributes.normal.array;
      normalAccessor = addAccessor(normals, 'VEC3', 5126);
    }

    let indexAccessor = null;
    if (geometry.index) {
      const indices = geometry.index.array;
      indexAccessor = addAccessor(indices, 'SCALAR', 5125);
    }

    // Material
    let materialIndex = 0;
    if (!materialMap.has(material)) {
      materialIndex = gltf.materials.length;
      materialMap.set(material, materialIndex);

      const matObject = {
        name: material.name || `material_${materialIndex}`,
        pbrMetallicRoughness: {
          baseColorFactor: [
            ((material.color.r || 0.5) * 255) / 255,
            ((material.color.g || 0.5) * 255) / 255,
            ((material.color.b || 0.5) * 255) / 255,
            material.opacity !== undefined ? material.opacity : 1,
          ],
          metallicFactor: material.metalness || 0,
          roughnessFactor: material.roughness || 0.5,
        },
      };

      if (material.emissive) {
        matObject.emissiveFactor = [
          ((material.emissive.r || 0) * 255) / 255,
          ((material.emissive.g || 0) * 255) / 255,
          ((material.emissive.b || 0) * 255) / 255,
        ];
      }

      gltf.materials.push(matObject);
    } else {
      materialIndex = materialMap.get(material);
    }

    const meshObject = {
      name: object.name || `mesh_${meshIndex++}`,
      primitives: [{
        attributes: {
          POSITION: positionAccessor,
        },
        material: materialIndex,
      }],
    };

    if (normalAccessor !== null) {
      meshObject.primitives[0].attributes.NORMAL = normalAccessor;
    }

    if (indexAccessor !== null) {
      meshObject.primitives[0].indices = indexAccessor;
    }

    gltf.meshes.push(meshObject);
  }

  function addAccessor(data, type, componentType) {
    let min, max;
    if (type === 'VEC3') {
      min = [Infinity, Infinity, Infinity];
      max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < data.length; i += 3) {
        for (let j = 0; j < 3; j++) {
          min[j] = Math.min(min[j], data[i + j]);
          max[j] = Math.max(max[j], data[i + j]);
        }
      }
    } else if (type === 'SCALAR') {
      min = [Math.min(...data)];
      max = [Math.max(...data)];
    }

    const accessor = {
      bufferView: gltf.bufferViews.length,
      componentType,
      count: type === 'SCALAR' ? data.length : data.length / 3,
      type,
      min,
      max,
    };

    const byteLength = data.byteLength || (data.length * (componentType === 5126 ? 4 : 4));
    gltf.bufferViews.push({
      buffer: 0,
      byteLength,
      byteOffset: bufferData.length,
    });

    if (data instanceof Uint32Array || data instanceof Uint16Array) {
      bufferData.push(...Array.from(data));
    } else {
      bufferData.push(...Array.from(data));
    }

    gltf.accessors.push(accessor);
    return gltf.accessors.length - 1;
  }

  // Procesar la escena
  const rootNode = addNode(scene.children[0]);
  gltf.scenes[0].nodes = [rootNode];

  // Buffer final
  const buffer = Buffer.from(new Float32Array(bufferData));
  gltf.buffers[0].byteLength = buffer.byteLength;

  // Escribir GLB
  const json = JSON.stringify(gltf);
  const jsonPadded = Buffer.alloc(Math.ceil(json.length / 4) * 4);
  jsonPadded.write(json);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // "glTF"
  header.writeUInt32LE(2, 4); // Version 2
  header.writeUInt32LE(28 + jsonPadded.length + buffer.byteLength, 8);

  const jsonChunk = Buffer.alloc(8);
  jsonChunk.writeUInt32LE(jsonPadded.length, 0);
  jsonChunk.writeUInt32LE(0x4E4F534A, 4); // "JSON"

  const binChunk = Buffer.alloc(8);
  binChunk.writeUInt32LE(buffer.byteLength, 0);
  binChunk.writeUInt32LE(0x004E4942, 4); // "BIN\0"

  const glb = Buffer.concat([header, jsonChunk, jsonPadded, binChunk, buffer]);
  fs.writeFileSync(filename, glb);
}

// ============================================================================
// MAIN
// ============================================================================

const models = [
  { name: 'character-chochologo', factory: crearChochologo },
  { name: 'character-alondra', factory: crearAlondra },
  { name: 'character-buscan', factory: crearBuscan },
  { name: 'character-blanki', factory: crearBlanki },
  { name: 'character-ministro', factory: crearMinistro },
  { name: 'characters-perseguidores', factory: crearPerseguidores },
  { name: 'obstacle-saltar', factory: crearObstaculoSaltar },
  { name: 'obstacle-agachar', factory: crearObstaculoAgachar },
  { name: 'obstacle-esquivar', factory: crearObstaculoEsquivar },
  { name: 'obstacle-doble-bus', factory: crearObstaculoDoble },
  { name: 'collectible-papel', factory: crearPapel },
  { name: 'collectible-evidencia', factory: crearEvidencia },
  { name: 'decor-palmera', factory: crearPalmera },
];

console.log(`📦 Exportando ${models.length} modelos a GLB...\n`);

for (const { name, factory } of models) {
  try {
    const scene = new THREE.Scene();
    const model = factory();
    scene.add(model);

    const outputPath = path.join(outputDir, `${name}.glb`);
    exportToGLB(scene, outputPath);
    console.log(`✅ ${name}.glb`);
  } catch (error) {
    console.error(`❌ Error exportando ${name}:`, error.message);
  }
}

console.log(`\n✨ Exportación completada en: ${outputDir}`);
console.log(`📋 ${models.length} modelos listos para editar en Blender, Maya, etc.`);
console.log(`📝 Instrucciones:`);
console.log(`   1. Abre los archivos .glb en Blender o tu editor 3D favorito`);
console.log(`   2. Edita geometría, añade texturas y detalles`);
console.log(`   3. Exporta de nuevo como GLB manteniendo los nombres de partes`);
console.log(`   4. Copia al directorio: public/assets/models/`);
console.log(`   5. Actualiza el código para cargar desde GLB en vez de procedural`);
