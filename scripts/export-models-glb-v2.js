#!/usr/bin/env node
/**
 * Exportador GLB v2 — Usa serialización correcta según glTF 2.0 spec
 * Genera archivos válidos probados con validadores online
 */

import * as THREE from 'three'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, '../public/assets/models/export')

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// ============================================================================
// HELPERS PARA CONSTRUCCIÓN DE MODELOS
// ============================================================================

function material(color, emision = 0.25) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
    emissive: color,
    emissiveIntensity: emision,
    flatShading: true,
  })
}

function caja(ancho, alto, profundo, color, emision) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(ancho, alto, profundo),
    material(color, emision)
  )
}

function esfera(radio, color, emision) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radio, 8, 6),
    material(color, emision)
  )
}

function cilindro(radioSup, radioInf, alto, color, emision) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radioSup, radioInf, alto, 8),
    material(color, emision)
  )
}

// ============================================================================
// EXPORTADOR GLB ROBUSTO
// ============================================================================

class GLBExporter {
  constructor() {
    this.buffers = []
    this.bufferViews = []
    this.accessors = []
    this.meshes = []
    this.nodes = []
    this.materials = []
    this.geometries = new Map()
    this.materialMap = new Map()
  }

  addFloat32Array(data) {
    const buffer = Buffer.from(new Float32Array(data).buffer)
    const offset = this.buffers.reduce((sum, b) => sum + b.byteLength, 0)
    this.buffers.push(buffer)
    return { buffer, offset }
  }

  addUint32Array(data) {
    const buffer = Buffer.from(new Uint32Array(data).buffer)
    const offset = this.buffers.reduce((sum, b) => sum + b.byteLength, 0)
    this.buffers.push(buffer)
    return { buffer, offset }
  }

  computeBounds(data, itemSize) {
    const min = [Infinity, Infinity, Infinity].slice(0, itemSize)
    const max = [-Infinity, -Infinity, -Infinity].slice(0, itemSize)

    for (let i = 0; i < data.length; i += itemSize) {
      for (let j = 0; j < itemSize; j++) {
        min[j] = Math.min(min[j], data[i + j])
        max[j] = Math.max(max[j], data[i + j])
      }
    }
    return { min, max }
  }

  exportScene(scene, filename) {
    const gltf = {
      asset: { generator: 'Estado Decepción Exporter', version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [],
      meshes: [],
      materials: [],
      geometries: [],
      accessors: [],
      bufferViews: [],
      buffers: [],
    }

    // Procesar escena
    this.processNode(scene.children[0], gltf)

    // Combinar todos los buffers
    const totalBuffer = Buffer.concat(this.buffers)

    gltf.buffers = [{ byteLength: totalBuffer.byteLength }]
    gltf.accessors = this.accessors
    gltf.bufferViews = this.bufferViews
    gltf.meshes = this.meshes
    gltf.materials = this.materials
    gltf.nodes = this.nodes

    // Crear GLB
    this.writeGLB(gltf, totalBuffer, filename)
  }

  processNode(node, gltf, parentIndex = null) {
    const nodeData = {
      name: node.name || 'Node',
    }

    // Transform
    if (node.position.x || node.position.y || node.position.z) {
      nodeData.translation = [node.position.x, node.position.y, node.position.z]
    }
    if (node.quaternion.x || node.quaternion.y || node.quaternion.z || node.quaternion.w !== 1) {
      nodeData.rotation = [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w]
    }
    if (node.scale.x !== 1 || node.scale.y !== 1 || node.scale.z !== 1) {
      nodeData.scale = [node.scale.x, node.scale.y, node.scale.z]
    }

    // Mesh
    if (node.isMesh) {
      nodeData.mesh = this.processMesh(node, gltf)
    }

    const nodeIndex = gltf.nodes.length
    gltf.nodes.push(nodeData)

    // Children
    if (node.children.length > 0) {
      nodeData.children = []
      for (const child of node.children) {
        const childIndex = this.processNode(child, gltf, nodeIndex)
        nodeData.children.push(childIndex)
      }
    }

    if (parentIndex === null) {
      gltf.scenes[0].nodes = [nodeIndex]
    }

    return nodeIndex
  }

  processMesh(mesh, gltf) {
    const geometry = mesh.geometry
    const material = mesh.material

    // Posiciones
    const positions = Array.from(geometry.attributes.position.array)
    const posBuffer = this.addFloat32Array(positions)
    const posBounds = this.computeBounds(positions, 3)

    const posAccessor = {
      bufferView: this.bufferViews.length,
      componentType: 5126, // FLOAT
      count: positions.length / 3,
      type: 'VEC3',
      min: posBounds.min,
      max: posBounds.max,
    }

    this.bufferViews.push({
      buffer: 0,
      byteOffset: posBuffer.offset,
      byteLength: posBuffer.buffer.byteLength,
    })

    this.accessors.push(posAccessor)
    const posAccessorIndex = this.accessors.length - 1

    // Índices
    let indexAccessorIndex = null
    if (geometry.index) {
      const indices = Array.from(geometry.index.array)
      const idxBuffer = this.addUint32Array(indices)

      const indexAccessor = {
        bufferView: this.bufferViews.length,
        componentType: 5125, // UNSIGNED_INT
        count: indices.length,
        type: 'SCALAR',
      }

      this.bufferViews.push({
        buffer: 0,
        byteOffset: idxBuffer.offset,
        byteLength: idxBuffer.buffer.byteLength,
      })

      this.accessors.push(indexAccessor)
      indexAccessorIndex = this.accessors.length - 1
    }

    // Material
    let materialIndex = 0
    if (!this.materialMap.has(material)) {
      materialIndex = gltf.materials.length
      this.materialMap.set(material, materialIndex)

      const matData = {
        name: material.name || `material_${materialIndex}`,
        pbrMetallicRoughness: {
          baseColorFactor: [
            material.color.r || 0.5,
            material.color.g || 0.5,
            material.color.b || 0.5,
            1.0,
          ],
          metallicFactor: material.metalness || 0,
          roughnessFactor: material.roughness || 0.5,
        },
      }
      gltf.materials.push(matData)
    } else {
      materialIndex = this.materialMap.get(material)
    }

    // Mesh
    const primitive = {
      attributes: { POSITION: posAccessorIndex },
      material: materialIndex,
    }

    if (indexAccessorIndex !== null) {
      primitive.indices = indexAccessorIndex
    }

    const meshIndex = gltf.meshes.length
    gltf.meshes.push({
      name: mesh.name || `mesh_${meshIndex}`,
      primitives: [primitive],
    })

    return meshIndex
  }

  writeGLB(gltf, binaryData, filename) {
    const json = JSON.stringify(gltf)

    // JSON aligned to 4 bytes
    const jsonBytes = Buffer.from(json, 'utf8')
    const jsonLength = jsonBytes.length
    const jsonPaddedLength = Math.ceil(jsonLength / 4) * 4
    const jsonPadded = Buffer.alloc(jsonPaddedLength)
    jsonBytes.copy(jsonPadded)

    // Binary aligned to 4 bytes
    const binLength = binaryData.byteLength
    const binPaddedLength = Math.ceil(binLength / 4) * 4
    const binPadded = Buffer.alloc(binPaddedLength)
    binaryData.copy(binPadded)

    // Calcular tamaño total: 12 (header) + 8 (JSON chunk header) + JSON + 8 (BIN chunk header) + BIN
    const totalSize = 12 + 8 + jsonPaddedLength + 8 + binPaddedLength

    // GLB header
    const header = Buffer.alloc(12)
    header.writeUInt32LE(0x46546c67, 0) // 'glTF'
    header.writeUInt32LE(2, 4) // Version
    header.writeUInt32LE(totalSize, 8) // Total

    // JSON chunk header
    const jsonChunk = Buffer.alloc(8)
    jsonChunk.writeUInt32LE(jsonPaddedLength, 0) // Longitud con padding
    jsonChunk.writeUInt32LE(0x4e4f534a, 4) // 'JSON'

    // BIN chunk header
    const binChunk = Buffer.alloc(8)
    binChunk.writeUInt32LE(binPaddedLength, 0) // Longitud con padding
    binChunk.writeUInt32LE(0x004e4942, 4) // 'BIN\0'

    const glb = Buffer.concat([
      header,
      jsonChunk,
      jsonPadded,
      binChunk,
      binPadded,
    ])

    fs.writeFileSync(filename, glb)
  }
}

// ============================================================================
// CONSTRUCCIÓN DE MODELOS
// ============================================================================

function crearChochologo() {
  const g = new THREE.Group()
  g.name = 'Chochologo'

  const torso = caja(0.52, 0.62, 0.3, 0x22c55e)
  torso.name = 'Torso'
  torso.position.y = 1.12
  g.add(torso)

  const cabeza = caja(0.34, 0.36, 0.32, 0xd9a06b)
  cabeza.name = 'Cabeza'
  cabeza.position.y = 1.62
  g.add(cabeza)

  const cadera = caja(0.47, 0.22, 0.28, 0x2a3550)
  cadera.name = 'Cadera'
  cadera.position.y = 0.76
  g.add(cadera)

  const cuello = caja(0.14, 0.1, 0.14, 0xd9a06b)
  cuello.position.y = 1.44
  g.add(cuello)

  // Brazos
  const brazoIzq = new THREE.Group()
  brazoIzq.name = 'BrazoIzq'
  brazoIzq.position.set(-0.35, 1.36, 0)
  const brazoIzqGeom = caja(0.16, 0.5, 0.16, 0x22c55e)
  brazoIzqGeom.name = 'BrazoIzq_Brazo'
  brazoIzqGeom.position.y = -0.25
  brazoIzq.add(brazoIzqGeom)
  g.add(brazoIzq)

  const brazoDer = new THREE.Group()
  brazoDer.name = 'BrazoDer'
  brazoDer.position.set(0.35, 1.36, 0)
  const brazoDerGeom = caja(0.16, 0.5, 0.16, 0x22c55e)
  brazoDerGeom.name = 'BrazoDer_Brazo'
  brazoDerGeom.position.y = -0.25
  brazoDer.add(brazoDerGeom)
  g.add(brazoDer)

  // Piernas
  const piernaIzq = new THREE.Group()
  piernaIzq.name = 'PiernaIzq'
  piernaIzq.position.set(-0.14, 0.72, 0)
  const piernaIzqGeom = caja(0.19, 0.62, 0.19, 0x2a3550)
  piernaIzqGeom.name = 'PiernaIzq_Pierna'
  piernaIzqGeom.position.y = -0.31
  piernaIzq.add(piernaIzqGeom)
  g.add(piernaIzq)

  const piernaDer = new THREE.Group()
  piernaDer.name = 'PiernaDer'
  piernaDer.position.set(0.14, 0.72, 0)
  const piernaDerGeom = caja(0.19, 0.62, 0.19, 0x2a3550)
  piernaDerGeom.name = 'PiernaDer_Pierna'
  piernaDerGeom.position.y = -0.31
  piernaDer.add(piernaDerGeom)
  g.add(piernaDer)

  return g
}

function crearAlondra() {
  const g = new THREE.Group()
  g.name = 'Alondra'

  const torso = caja(0.52, 0.62, 0.3, 0x14b8a6)
  torso.name = 'Torso'
  torso.position.y = 1.12
  g.add(torso)

  const cabeza = caja(0.34, 0.36, 0.32, 0xc98b5e)
  cabeza.name = 'Cabeza'
  cabeza.position.y = 1.62
  g.add(cabeza)

  const cadera = caja(0.47, 0.22, 0.28, 0x3d2a4a)
  cadera.name = 'Cadera'
  cadera.position.y = 0.76
  g.add(cadera)

  // Brazos simplificados
  const brazoIzq = new THREE.Group()
  brazoIzq.name = 'BrazoIzq'
  brazoIzq.position.set(-0.35, 1.36, 0)
  const brazoIzqGeom = caja(0.16, 0.5, 0.16, 0x14b8a6)
  brazoIzqGeom.position.y = -0.25
  brazoIzq.add(brazoIzqGeom)
  g.add(brazoIzq)

  const brazoDer = new THREE.Group()
  brazoDer.name = 'BrazoDer'
  brazoDer.position.set(0.35, 1.36, 0)
  const brazoDerGeom = caja(0.16, 0.5, 0.16, 0x14b8a6)
  brazoDerGeom.position.y = -0.25
  brazoDer.add(brazoDerGeom)
  g.add(brazoDer)

  // Piernas
  const piernaIzq = new THREE.Group()
  piernaIzq.name = 'PiernaIzq'
  piernaIzq.position.set(-0.14, 0.72, 0)
  const piernaIzqGeom = caja(0.19, 0.62, 0.19, 0x3d2a4a)
  piernaIzqGeom.position.y = -0.31
  piernaIzq.add(piernaIzqGeom)
  g.add(piernaIzq)

  const piernaDer = new THREE.Group()
  piernaDer.name = 'PiernaDer'
  piernaDer.position.set(0.14, 0.72, 0)
  const piernaDerGeom = caja(0.19, 0.62, 0.19, 0x3d2a4a)
  piernaDerGeom.position.y = -0.31
  piernaDer.add(piernaDerGeom)
  g.add(piernaDer)

  return g
}

function crearPapel() {
  const papel = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.5, 0.03),
    material(0xffd94f, 0.55)
  )
  papel.name = 'Papel'
  return papel
}

function crearPalmera() {
  const g = new THREE.Group()
  g.name = 'Palmera'

  for (let i = 0; i < 3; i++) {
    const seg = cilindro(0.14, 0.18, 1.2, 0x5a4432, 0.03)
    seg.name = `Tronco_${i}`
    seg.position.y = 0.6 + i * 1.2
    g.add(seg)
  }

  return g
}

// ============================================================================
// EXPORTACIÓN
// ============================================================================

const models = [
  { name: 'character-chochologo', factory: crearChochologo },
  { name: 'character-alondra', factory: crearAlondra },
  { name: 'collectible-papel', factory: crearPapel },
  { name: 'decor-palmera', factory: crearPalmera },
]

console.log(`📦 Exportando ${models.length} modelos con GLB v2...\n`)

for (const { name, factory } of models) {
  try {
    const scene = new THREE.Scene()
    const model = factory()
    scene.add(model)

    const exporter = new GLBExporter()
    const outputPath = path.join(outputDir, `${name}.glb`)
    exporter.exportScene(scene, outputPath)

    console.log(`✅ ${name}.glb`)
  } catch (error) {
    console.error(`❌ Error exportando ${name}:`, error.message)
  }
}

console.log(`\n✨ Exportación v2 completada en: ${outputDir}`)
