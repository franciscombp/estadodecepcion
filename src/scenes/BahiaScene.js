// ============================================================================
// LA BAHÍA — Corrupción
// ============================================================================
// Malecón de locales cerrados, toldos y barricadas. Es el escenario de entrada:
// el más iluminado, el más generoso en papeles y el que enseña la mecánica.
//
// Detalle propio: gaviotas de papel que cruzan el cielo. Son hojas sueltas,
// no pájaros — el chiste visual de que aquí hasta lo que vuela es papeleo.
// ============================================================================

import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

export class BahiaScene extends BaseScene {
  constructor(escena, config, calidad) {
    super(escena, config, calidad);
    this._crearPapelesVolando();
  }

  _crearPapelesVolando() {
    this.papelesVolando = [];

    const geometria = new THREE.PlaneGeometry(0.5, 0.65);
    const material = new THREE.MeshBasicMaterial({
      color: 0xf0e6c8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });

    for (let i = 0; i < 12; i++) {
      const papel = new THREE.Mesh(geometria, material);
      papel.position.set(
        (Math.random() - 0.5) * 40,
        5 + Math.random() * 8,
        -Math.random() * 160,
      );
      this.grupo.add(papel);

      this.papelesVolando.push({
        malla: papel,
        // Cada hoja tiene su propia deriva y giro: el aire no es uniforme.
        velocidadX: (Math.random() - 0.5) * 1.2,
        giro: (Math.random() - 0.5) * 2,
        faseFlotacion: Math.random() * Math.PI * 2,
      });
    }
  }

  actualizar(dt, avance, jugador) {
    super.actualizar(dt, avance, jugador);

    for (const p of this.papelesVolando) {
      // Se mueven hacia el jugador más lento que el suelo: parallax.
      p.malla.position.z += avance * 0.55;
      p.malla.position.x += p.velocidadX * dt;
      p.malla.position.y += Math.sin(this.tiempo * 1.5 + p.faseFlotacion) * dt * 1.4;

      p.malla.rotation.z += p.giro * dt;
      p.malla.rotation.y += p.giro * 0.7 * dt;

      if (p.malla.position.z > 15) {
        p.malla.position.z = -160 - Math.random() * 40;
        p.malla.position.x = (Math.random() - 0.5) * 40;
        p.malla.position.y = 5 + Math.random() * 8;
      }
    }
  }
}
