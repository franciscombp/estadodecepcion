// ============================================================================
// PISTA — Suelo infinito, líneas de carril y bordillos
// ============================================================================
// El jugador nunca avanza en Z: se queda en z=0 y es el mundo el que viene
// hacia él. Es como funciona Subway Surfers y evita por completo los problemas
// de precisión de coma flotante en partidas largas.
//
// El suelo son baldosas que se reciclan: cuando una queda detrás de la cámara,
// se reengancha al final de la fila.
//
// NOTA DE RENDIMIENTO: las líneas de carril van PINTADAS en la textura del
// asfalto, no montadas como mallas. Dibujarlas como segmentos sueltos costaba
// más de cien draw calls —una quinta parte del presupuesto del fotograma— para
// algo que una textura resuelve gratis.
// ============================================================================

import * as THREE from 'three';
import { CARRILES, PALETA } from '../config/balance.js';

const LARGO_BALDOSA = 40;
const NUMERO_BALDOSAS = 8;   // 320 unidades de pista: sobra para llegar a la niebla.
const ANCHO_PISTA = CARRILES.ANCHO * 3 + 1.6;

// Resolución de la textura del asfalto. Solo tiene franjas rectas, así que no
// necesita más.
const TEX_ANCHO = 128;
const TEX_ALTO = 256;

/**
 * Genera la textura del asfalto con las dos líneas divisorias segmentadas.
 * @param {number} colorCalle
 * @param {number} colorLinea
 */
function crearTexturaAsfalto(colorCalle, colorLinea) {
  const lienzo = document.createElement('canvas');
  lienzo.width = TEX_ANCHO;
  lienzo.height = TEX_ALTO;
  const ctx = lienzo.getContext('2d');

  const aHex = (n) => `#${n.toString(16).padStart(6, '0')}`;

  // Fondo
  ctx.fillStyle = aHex(colorCalle);
  ctx.fillRect(0, 0, TEX_ANCHO, TEX_ALTO);

  // Las divisorias van entre carriles: en x = ±ANCHO/2 del mundo.
  // Convertimos esa posición del mundo a coordenada de textura.
  const aTextura = (xMundo) => ((xMundo + ANCHO_PISTA / 2) / ANCHO_PISTA) * TEX_ANCHO;
  const xIzquierda = aTextura(-CARRILES.ANCHO / 2);
  const xDerecha = aTextura(CARRILES.ANCHO / 2);

  const anchoLinea = 3;

  // Segmentos: 3 unidades de línea + 3 de hueco, repetidos a lo largo de la
  // baldosa (40 unidades → 6.67 ciclos).
  const ciclosPorBaldosa = LARGO_BALDOSA / 6;
  const altoCiclo = TEX_ALTO / ciclosPorBaldosa;
  const altoTrazo = altoCiclo / 2;

  ctx.fillStyle = aHex(colorLinea);
  for (let i = 0; i < Math.ceil(ciclosPorBaldosa); i++) {
    const y = i * altoCiclo;
    ctx.fillRect(xIzquierda - anchoLinea / 2, y, anchoLinea, altoTrazo);
    ctx.fillRect(xDerecha - anchoLinea / 2, y, anchoLinea, altoTrazo);
  }

  const textura = new THREE.CanvasTexture(lienzo);
  textura.wrapS = THREE.ClampToEdgeWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.needsUpdate = true;
  return textura;
}

export class Track {
  constructor(escena) {
    this.escena = escena;
    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.baldosas = [];
    this.bordillos = [];

    this.colorCalle = PALETA.CALLE;
    this.colorLinea = PALETA.LINEA_CARRIL;

    this._construir();
  }

  // -------------------------------------------------------------------------
  // CONSTRUCCIÓN
  // -------------------------------------------------------------------------

  _construir() {
    // Geometría y material compartidos: las ocho baldosas son idénticas, así
    // que basta con una geometría y un material para todas.
    this.geoBaldosa = new THREE.PlaneGeometry(ANCHO_PISTA, LARGO_BALDOSA);
    this.texturaAsfalto = crearTexturaAsfalto(this.colorCalle, this.colorLinea);

    this.matBaldosa = new THREE.MeshStandardMaterial({
      map: this.texturaAsfalto,
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.05,
    });

    for (let i = 0; i < NUMERO_BALDOSAS; i++) {
      const baldosa = new THREE.Mesh(this.geoBaldosa, this.matBaldosa);
      baldosa.rotation.x = -Math.PI / 2;
      baldosa.position.z = -i * LARGO_BALDOSA;
      this.grupo.add(baldosa);
      this.baldosas.push(baldosa);
    }

    // Bordillos laterales: enmarcan la pista y refuerzan la sensación de
    // velocidad. También comparten geometría y material.
    this.geoBordillo = new THREE.BoxGeometry(0.5, 0.4, LARGO_BALDOSA);
    this.matBordillo = new THREE.MeshStandardMaterial({
      color: this.colorCalle,
      emissive: this.colorLinea,
      emissiveIntensity: 0.12,
      roughness: 0.8,
    });

    for (const signo of [-1, 1]) {
      for (let i = 0; i < NUMERO_BALDOSAS; i++) {
        const bordillo = new THREE.Mesh(this.geoBordillo, this.matBordillo);
        bordillo.position.set(signo * (ANCHO_PISTA / 2 + 0.25), 0.2, -i * LARGO_BALDOSA);
        this.grupo.add(bordillo);
        this.bordillos.push(bordillo);
      }
    }
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * Desplaza la pista hacia el jugador y recicla lo que queda atrás.
   * @param {number} avance Distancia recorrida en este fotograma
   */
  actualizar(avance) {
    const total = LARGO_BALDOSA * NUMERO_BALDOSAS;

    for (const baldosa of this.baldosas) {
      baldosa.position.z += avance;
      if (baldosa.position.z > LARGO_BALDOSA) baldosa.position.z -= total;
    }

    for (const bordillo of this.bordillos) {
      bordillo.position.z += avance;
      if (bordillo.position.z > LARGO_BALDOSA) bordillo.position.z -= total;
    }
  }

  /**
   * Aplica la paleta de un escenario. Regenera la textura del asfalto con los
   * colores nuevos; como el material es compartido, con una sola asignación
   * cambian las ocho baldosas.
   */
  aplicarTema(colores) {
    this.colorCalle = colores.calle;
    this.colorLinea = colores.acento;

    this.texturaAsfalto.dispose();
    this.texturaAsfalto = crearTexturaAsfalto(this.colorCalle, this.colorLinea);
    this.matBaldosa.map = this.texturaAsfalto;
    this.matBaldosa.needsUpdate = true;

    this.matBordillo.color.setHex(this.colorCalle);
    this.matBordillo.emissive.setHex(this.colorLinea);
  }

  /** Libera geometrías, materiales y texturas. */
  destruir() {
    this.escena.remove(this.grupo);
    this.geoBaldosa.dispose();
    this.geoBordillo.dispose();
    this.matBaldosa.dispose();
    this.matBordillo.dispose();
    this.texturaAsfalto.dispose();
    this.baldosas = [];
    this.bordillos = [];
  }
}

export { LARGO_BALDOSA, ANCHO_PISTA };
