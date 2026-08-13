/**
 * Utilidad para cargar modelos GLB en lugar de procedurales.
 * Coloca esto en src/utils/GLBLoader.js
 *
 * Uso:
 *   import { loadCharacter, loadObstacle } from '@/utils/GLBLoader'
 *   const modelo = await loadCharacter('chochologo')
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const loader = new GLTFLoader()
const cache = new Map()

/**
 * Carga un modelo de personaje desde GLB.
 * @param {string} nombre - 'chochologo' | 'alondra' | 'buscan' | 'blanki' | 'ministro' | 'perseguidores'
 * @returns {Promise<THREE.Group>} El modelo cargado
 */
export async function loadCharacter(nombre) {
  const archivo = `assets/models/character-${nombre}.glb`
  return loadFromCache(archivo)
}

/**
 * Carga un modelo de obstáculo desde GLB.
 * @param {string} tipo - 'saltar' | 'agachar' | 'esquivar' | 'doble-bus'
 * @returns {Promise<THREE.Group>} El modelo cargado
 */
export async function loadObstacle(tipo) {
  const archivo = `assets/models/obstacle-${tipo}.glb`
  return loadFromCache(archivo)
}

/**
 * Carga un recolectable desde GLB.
 * @param {string} tipo - 'papel' | 'evidencia'
 * @returns {Promise<THREE.Group>} El modelo cargado
 */
export async function loadCollectible(tipo) {
  const archivo = `assets/models/collectible-${tipo}.glb`
  return loadFromCache(archivo)
}

/**
 * Carga decoración desde GLB.
 * @param {string} tipo - 'palmera' | 'farola' | 'valla' | 'patrulla'
 * @returns {Promise<THREE.Group>} El modelo cargado
 */
export async function loadDecor(tipo) {
  const archivo = `assets/models/decor-${tipo}.glb`
  return loadFromCache(archivo)
}

/**
 * Carga cualquier GLB con caché interno.
 */
async function loadFromCache(archivo) {
  // Retorna de caché si ya fue cargado
  if (cache.has(archivo)) {
    return cache.get(archivo).clone()
  }

  try {
    const gltf = await loader.loadAsync(archivo)
    const scene = gltf.scene

    // Caché el original (no clonado)
    cache.set(archivo, scene)

    // Retorna un clon para evitar compartir referencias
    return scene.clone()
  } catch (error) {
    console.error(`Error cargando ${archivo}:`, error)
    throw error
  }
}

/**
 * Limpia el caché (útil para hot reload en desarrollo).
 */
export function clearCache() {
  cache.clear()
}

/**
 * Compatibilidad: mantiene la firma de la función procedural.
 * Útil para reemplazar gradualmente procedurales sin cambiar todo el código.
 *
 * Uso:
 *   const crearChochologo = createGLBFactory('chochologo')
 *   const modelo = crearChochologo()  // Retorna Promise<Group>
 */
export function createGLBFactory(nombre, tipo = 'character') {
  return async () => {
    if (tipo === 'character') return loadCharacter(nombre)
    if (tipo === 'obstacle') return loadObstacle(nombre)
    if (tipo === 'collectible') return loadCollectible(nombre)
    if (tipo === 'decor') return loadDecor(nombre)
    throw new Error(`Tipo desconocido: ${tipo}`)
  }
}

/**
 * Detecta y reemplaza materiales según necesidad.
 * Útil si necesitas aplicar estilos globales a modelos importados.
 */
export function applyGameStyle(scene) {
  scene.traverse((node) => {
    if (node.isMesh && node.material) {
      // Asegurar que usan MeshStandardMaterial (compatible con nuestro renderer)
      if (!node.material.isMeshStandardMaterial) {
        const oldMat = node.material
        const newMat = new THREE.MeshStandardMaterial({
          color: oldMat.color || 0xffffff,
          roughness: 0.6,
          metalness: 0.1,
          map: oldMat.map,
        })
        node.material = newMat
      }

      // Habilita sombras
      node.castShadow = true
      node.receiveShadow = true
    }
  })
}

/**
 * Encuentra una parte nombrada en el modelo (para animar).
 * Útil porque la estructura GLB preserva nombres.
 *
 * Uso:
 *   const cabeza = findByName(modelo, 'Cabeza')
 *   cabeza.rotation.x = Math.PI / 2
 */
export function findByName(scene, name) {
  let found = null
  scene.traverse((node) => {
    if (node.name === name) found = node
  })
  return found
}

/**
 * Lista todas las partes nombradas (útil para debugging).
 */
export function listParts(scene) {
  const parts = []
  scene.traverse((node) => {
    if (node.name && node.name !== 'Scene') {
      parts.push(node.name)
    }
  })
  return parts
}
