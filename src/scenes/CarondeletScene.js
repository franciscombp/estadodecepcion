// ============================================================================
// CARONDELET — Censura de prensa
// ============================================================================
// Centro histórico cercado. Es el escenario más hostil y el más pobre en
// recolectables (densidad 0.25, tope de 3 papeles por tramo): aquí no hay nada
// que documentar porque no dejan documentar. Esa carestía es el mensaje.
//
// Tampoco hay bifurcación de frente: cruzar el cerco es perder, sin ruleta.
//
// Detalle propio: humo de gas a ras de suelo y focos de vigilancia que barren
// la pista desde arriba.
// ============================================================================

import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

export class CarondeletScene extends BaseScene {
  constructor(escena, config) {
    super(escena, config);
    this._crearHumo();
    this._crearVigilancia();
  }

  /** Humo a ras de suelo. Planos semitransparentes que derivan. */
  _crearHumo() {
    this.humo = [];

    const geometria = new THREE.PlaneGeometry(9, 4.5);

    for (let i = 0; i < 14; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xb8a89a,
        transparent: true,
        opacity: 0.055 + Math.random() * 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const nube = new THREE.Mesh(geometria, material);
      nube.position.set(
        (Math.random() - 0.5) * 18,
        0.7 + Math.random() * 1.6,
        -Math.random() * 140,
      );
      nube.rotation.y = Math.random() * Math.PI;
      this.grupo.add(nube);

      this.humo.push({
        malla: nube,
        deriva: (Math.random() - 0.5) * 0.8,
        giro: (Math.random() - 0.5) * 0.25,
        faseOndulacion: Math.random() * Math.PI * 2,
      });
    }
  }

  /** Focos de vigilancia barriendo la pista desde lo alto. */
  _crearVigilancia() {
    this.focos = [];

    for (let i = 0; i < 2; i++) {
      const foco = new THREE.SpotLight(0xffd0c0, 3.5, 55, Math.PI / 9, 0.6, 1.6);
      foco.position.set((i === 0 ? -1 : 1) * 9, 13, -30 - i * 45);
      foco.target.position.set(0, 0, -30 - i * 45);

      this.grupo.add(foco);
      this.grupo.add(foco.target);

      this.focos.push({
        luz: foco,
        // Barrido lento y regular: es vigilancia, no una fiesta.
        velocidad: 0.28 + i * 0.12,
        fase: i * Math.PI,
        amplitud: 7,
      });
    }
  }

  actualizar(dt, avance, jugador) {
    super.actualizar(dt, avance, jugador);

    // --- Humo --------------------------------------------------------------
    for (const h of this.humo) {
      h.malla.position.z += avance * 1.05; // Casi a la velocidad del suelo.
      h.malla.position.x += h.deriva * dt;
      h.malla.position.y += Math.sin(this.tiempo * 0.8 + h.faseOndulacion) * dt * 0.3;
      h.malla.rotation.z += h.giro * dt;

      if (h.malla.position.z > 16) {
        h.malla.position.z = -140 - Math.random() * 30;
        h.malla.position.x = (Math.random() - 0.5) * 18;
        h.malla.position.y = 0.7 + Math.random() * 1.6;
      }
    }

    // --- Focos de vigilancia ----------------------------------------------
    for (const f of this.focos) {
      f.luz.position.z += avance * 0.6;
      f.luz.target.position.z += avance * 0.6;

      if (f.luz.position.z > 15) {
        f.luz.position.z -= 110;
        f.luz.target.position.z -= 110;
      }

      // Barrido lateral: el haz recorre la pista de lado a lado.
      const barrido = Math.sin(this.tiempo * f.velocidad + f.fase) * f.amplitud;
      f.luz.target.position.x = barrido;
      f.luz.target.updateMatrixWorld();
    }
  }
}
