// ============================================================================
// LAS ELECCIONES — Cooptación del CNE
// ============================================================================
// Calle de campaña: vallas, banderines y focos de propaganda barriendo el
// cielo. Es el escenario más saturado visualmente, a propósito — la sobrecarga
// de estímulos ES el tema.
//
// Detalle propio: reflectores que barren el cielo como en un mitin, y confeti
// de papeleta cayendo.
// ============================================================================

import * as THREE from 'three';
import { BaseScene } from './BaseScene.js';

export class EleccionesScene extends BaseScene {
  constructor(escena, config) {
    super(escena, config);
    this._crearReflectores();
    this._crearConfeti();
  }

  /** Reflectores de mitin barriendo el cielo. */
  _crearReflectores() {
    this.reflectores = [];

    for (let i = 0; i < 3; i++) {
      const haz = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 34, 6, 1, true),
        new THREE.MeshBasicMaterial({
          color: this.colores.acento,
          transparent: true,
          opacity: 0.09,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );

      const x = (i - 1) * 13;
      haz.position.set(x, 16, -35 - i * 26);
      this.grupo.add(haz);

      this.reflectores.push({
        malla: haz,
        // Cada reflector barre a su ritmo: si van sincronizados parece un error.
        velocidad: 0.35 + Math.random() * 0.4,
        fase: Math.random() * Math.PI * 2,
        amplitud: 0.5 + Math.random() * 0.35,
      });
    }
  }

  /** Confeti de papeleta cayendo. */
  _crearConfeti() {
    this.confeti = [];

    const geometria = new THREE.PlaneGeometry(0.18, 0.26);
    const colores = [0xff5fa2, 0xffcf3f, 0xffffff, 0x7cffb2];

    for (let i = 0; i < 40; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: colores[i % colores.length],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });

      const trozo = new THREE.Mesh(geometria, material);
      trozo.position.set(
        (Math.random() - 0.5) * 26,
        3 + Math.random() * 14,
        -Math.random() * 130,
      );
      this.grupo.add(trozo);

      this.confeti.push({
        malla: trozo,
        caida: 1.2 + Math.random() * 1.8,
        giro: (Math.random() - 0.5) * 6,
        deriva: (Math.random() - 0.5) * 1.5,
      });
    }
  }

  actualizar(dt, avance, jugador) {
    super.actualizar(dt, avance, jugador);

    // --- Reflectores -------------------------------------------------------
    for (const r of this.reflectores) {
      r.malla.position.z += avance * 0.4; // Parallax lento: están lejos.
      if (r.malla.position.z > 20) r.malla.position.z -= 130;

      // Barrido pendular.
      r.malla.rotation.z = Math.sin(this.tiempo * r.velocidad + r.fase) * r.amplitud;
      r.malla.rotation.x = 0.25 + Math.cos(this.tiempo * r.velocidad * 0.6) * 0.12;
    }

    // --- Confeti -----------------------------------------------------------
    for (const c of this.confeti) {
      c.malla.position.z += avance * 0.8;
      c.malla.position.y -= c.caida * dt;
      c.malla.position.x += c.deriva * dt;
      c.malla.rotation.z += c.giro * dt;
      c.malla.rotation.x += c.giro * 0.5 * dt;

      // Al tocar el suelo o pasar de largo, vuelve arriba y al fondo.
      if (c.malla.position.y < 0 || c.malla.position.z > 14) {
        c.malla.position.set(
          (Math.random() - 0.5) * 26,
          10 + Math.random() * 8,
          -110 - Math.random() * 30,
        );
      }
    }
  }
}
