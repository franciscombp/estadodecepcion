#!/usr/bin/env node
/**
 * Exportador GLB SIMPLE — Basado en glTF 2.0 spec
 * Genera archivos válidos verificados
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
// CONSTRUCCIÓN DE MODELOS (minimizado para testing)
// ============================================================================

function material(color, emision = 0.25) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.6, metalness: 0.1,
    emissive: color, emissiveIntensity: emision, flatShading: true,
  })
}

function caja(ancho, alto, profundo, color, emision) {
  return new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, profundo), material(color, emision))
}

function crearChochologo() {
  const g = new THREE.Group()
  g.name = 'Chochologo'
  const torso = caja(0.52, 0.62, 0.3, 0x22c55e)
  torso.name = 'Torso'
  torso.position.y = 1.12
  g.add(torso)
  return g
}

function crearAlondra() {
  const g = new THREE.Group()
  g.name = 'Alondra'
  const torso = caja(0.52, 0.62, 0.3, 0x14b8a6)
  torso.name = 'Torso'
  torso.position.y = 1.12
  g.add(torso)
  return g
}

// ============================================================================
// EXPORTADOR GLB CORRECTO
// ============================================================================

function exportGLB(scene, filename) {
  // Colectar geometrías y materiales
  const buffers = []
  const accessors = []
  const bufferViews = []
  const meshes = []
  const nodes = []
  const materials = []
  const matMap = new Map()

  let bufferByteOffset = 0

  const gltf = {
    asset: { generator: 'Estado Decepción', version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }],
  }

  function processNode(obj, parentIndex = null) {
    const node = {
      name: obj.name || 'Node',
    }

    // Transform
    if (obj.position.lengthSq() > 0) {
      node.translation = [obj.position.x, obj.position.y, obj.position.z]
    }
    const q = obj.quaternion
    if (q.x || q.y || q.z || q.w !== 1) {
      node.rotation = [q.x, q.y, q.z, q.w]
    }
    if (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1) {
      node.scale = [obj.scale.x, obj.scale.y, obj.scale.z]
    }

    // Mesh
    if (obj.isMesh) {
      const geo = obj.geometry
      const mat = obj.material

      // Posiciones
      const positions = new Float32Array(geo.attributes.position.array)
      const posMin = [Infinity, Infinity, Infinity]
      const posMax = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < positions.length; i += 3) {
        for (let j = 0; j < 3; j++) {
          posMin[j] = Math.min(posMin[j], positions[i + j])
          posMax[j] = Math.max(posMax[j], positions[i + j])
        }
      }

      const posBuf = Buffer.from(positions.buffer)
      buffers.push(posBuf)

      const posAccessor = {
        bufferView: gltf.bufferViews.length,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        min: posMin, max: posMax,
      }

      gltf.bufferViews.push({
        buffer: 0,
        byteOffset: bufferByteOffset,
        byteLength: posBuf.byteLength,
      })
      bufferByteOffset += posBuf.byteLength

      gltf.accessors.push(posAccessor)
      const posAccessorIdx = gltf.accessors.length - 1

      // Índices
      let indexAccessorIdx = null
      if (geo.index) {
        const indices = new Uint32Array(geo.index.array)
        const idxBuf = Buffer.from(indices.buffer)
        buffers.push(idxBuf)

        const indexAccessor = {
          bufferView: gltf.bufferViews.length,
          componentType: 5125,
          count: indices.length,
          type: 'SCALAR',
        }

        gltf.bufferViews.push({
          buffer: 0,
          byteOffset: bufferByteOffset,
          byteLength: idxBuf.byteLength,
        })
        bufferByteOffset += idxBuf.byteLength

        gltf.accessors.push(indexAccessor)
        indexAccessorIdx = gltf.accessors.length - 1
      }

      // Material
      let matIdx = 0
      if (!matMap.has(mat)) {
        matIdx = gltf.materials.length
        matMap.set(mat, matIdx)
        gltf.materials.push({
          name: mat.name || `material_${matIdx}`,
          pbrMetallicRoughness: {
            baseColorFactor: [
              mat.color.r || 0.5, mat.color.g || 0.5, mat.color.b || 0.5, 1,
            ],
            metallicFactor: mat.metalness || 0,
            roughnessFactor: mat.roughness || 0.5,
          },
        })
      } else {
        matIdx = matMap.get(mat)
      }

      // Primitive
      const primitive = {
        attributes: { POSITION: posAccessorIdx },
        material: matIdx,
      }
      if (indexAccessorIdx !== null) {
        primitive.indices = indexAccessorIdx
      }

      const meshIdx = gltf.meshes.length
      gltf.meshes.push({
        name: obj.name || `mesh_${meshIdx}`,
        primitives: [primitive],
      })

      node.mesh = meshIdx
    }

    const nodeIdx = gltf.nodes.length
    gltf.nodes.push(node)

    if (obj.children.length > 0) {
      node.children = []
      for (const child of obj.children) {
        const childIdx = processNode(child, nodeIdx)
        node.children.push(childIdx)
      }
    }

    if (parentIndex === null) {
      gltf.scenes[0].nodes = [nodeIdx]
    }

    return nodeIdx
  }

  // Procesar escena
  processNode(scene.children[0])

  // Concatenar buffers
  const binaryBuffer = Buffer.concat(buffers)
  gltf.buffers[0].byteLength = binaryBuffer.byteLength

  // Generar GLB
  const jsonStr = JSON.stringify(gltf)
  const jsonBuffer = Buffer.from(jsonStr, 'utf8')

  // Padding con espacios (válido en JSON)
  const jsonPaddedLen = Math.ceil(jsonBuffer.length / 4) * 4
  const jsonPadded = Buffer.alloc(jsonPaddedLen, ' ')
  jsonBuffer.copy(jsonPadded)

  const binPaddedLen = Math.ceil(binaryBuffer.length / 4) * 4
  const binPadded = Buffer.alloc(binPaddedLen, 0)
  binaryBuffer.copy(binPadded)

  // Header
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonPaddedLen + 8 + binPaddedLen, 8)

  // JSON chunk
  const jsonChunk = Buffer.alloc(8)
  jsonChunk.writeUInt32LE(jsonPaddedLen, 0)
  jsonChunk.writeUInt32LE(0x4e4f534a, 4)

  // BIN chunk
  const binChunk = Buffer.alloc(8)
  binChunk.writeUInt32LE(binPaddedLen, 0)
  binChunk.writeUInt32LE(0x004e4942, 4)

  const glb = Buffer.concat([header, jsonChunk, jsonPadded, binChunk, binPadded])
  fs.writeFileSync(filename, glb)
}

// ============================================================================
// MAIN
// ============================================================================

const models = [
  { name: 'character-chochologo', factory: crearChochologo },
  { name: 'character-alondra', factory: crearAlondra },
]

console.log(`📦 Exportando con versión SIMPLE...\n`)

for (const { name, factory } of models) {
  try {
    const scene = new THREE.Scene()
    const model = factory()
    scene.add(model)

    const outputPath = path.join(outputDir, `${name}.glb`)
    exportGLB(scene, outputPath)

    console.log(`✅ ${name}.glb`)
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`)
  }
}

console.log(`\n✨ Completado`)

// ============================================================================
// AGREGAR RESTO DE MODELOS
// ============================================================================

function crearBuscan() {
  const g = new THREE.Group()
  g.name = 'Buscan'
  const torso = caja(0.525, 0.62, 0.3, 0x2f3a4f)
  torso.position.y = 1.12
  g.add(torso)
  return g
}

function crearBlanki() {
  const g = new THREE.Group()
  g.name = 'Blanki'
  const torso = caja(0.74, 0.62, 0.3, 0xb8452f)
  torso.position.y = 1.12
  g.add(torso)
  return g
}

function crearMinistro() {
  const g = new THREE.Group()
  g.name = 'Ministro'
  const torso = caja(0.61, 0.62, 0.3, 0x1f2c4a)
  torso.position.y = 1.12
  g.add(torso)
  return g
}

function crearPerseguidores() {
  const g = new THREE.Group()
  g.name = 'Perseguidores'
  const t1 = caja(0.75, 0.62, 0.3, 0x1f2333)
  t1.position.y = 1.12
  g.add(t1)
  return g
}

function crearObstaculoSaltar() {
  const g = new THREE.Group()
  g.name = 'Obstacle_Saltar'
  const panel = caja(0.88, 0.45, 0.22, 0xbf8f24)
  panel.position.y = 0.42
  g.add(panel)
  return g
}

function crearObstaculoAgachar() {
  const g = new THREE.Group()
  g.name = 'Obstacle_Agachar'
  const barra = caja(0.92, 1.0, 0.4, 0xbf8f24)
  barra.position.y = 1.36
  g.add(barra)
  return g
}

function crearObstaculoEsquivar() {
  const g = new THREE.Group()
  g.name = 'Obstacle_Esquivar'
  const cuerpo = caja(0.84, 1.68, 1.05, 0x6b4a2f)
  cuerpo.position.y = 0.84
  g.add(cuerpo)
  return g
}

function crearObstaculoDoble() {
  const g = new THREE.Group()
  g.name = 'Obstacle_Doble'
  const cuerpo = caja(1.86, 1.68, 1.6, 0x8a94a6)
  cuerpo.position.y = 1.08
  g.add(cuerpo)
  return g
}

function crearEvidencia() {
  const g = new THREE.Group()
  g.name = 'Evidencia'
  const c = caja(0.26, 0.42, 0.13, 0x1c2230)
  g.add(c)
  return g
}

function crearPalmera() {
  const g = new THREE.Group()
  g.name = 'Palmera'
  for (let i = 0; i < 2; i++) {
    const seg = caja(0.18, 1.2, 0.18, 0x5a4432)
    seg.position.y = i * 1.2
    g.add(seg)
  }
  return g
}

// ============================================================================
// EJECUTAR TAMBIÉN ESTOS MODELOS
// ============================================================================

const moreModels = [
  { name: 'character-buscan', factory: crearBuscan },
  { name: 'character-blanki', factory: crearBlanki },
  { name: 'character-ministro', factory: crearMinistro },
  { name: 'characters-perseguidores', factory: crearPerseguidores },
  { name: 'obstacle-saltar', factory: crearObstaculoSaltar },
  { name: 'obstacle-agachar', factory: crearObstaculoAgachar },
  { name: 'obstacle-esquivar', factory: crearObstaculoEsquivar },
  { name: 'obstacle-doble-bus', factory: crearObstaculoDoble },
  { name: 'collectible-evidencia', factory: crearEvidencia },
  { name: 'decor-palmera', factory: crearPalmera },
]

console.log(`📦 Agregando ${moreModels.length} modelos más...\n`)

for (const { name, factory } of moreModels) {
  try {
    const scene = new THREE.Scene()
    const model = factory()
    scene.add(model)

    const outputPath = path.join(outputDir, `${name}.glb`)
    exportGLB(scene, outputPath)

    console.log(`✅ ${name}.glb`)
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`)
  }
}

console.log(`\n✨ Todos los modelos completados`)
