// ============================================================================
// ESCENA BASE — Iluminación, niebla y decorado lateral
// ============================================================================
// Cada escenario hereda de aquí. La clase base resuelve lo que todos comparten:
//   · Luces (ambiente + direccional + relleno de color)
//   · Niebla, que además es el sistema de "distancia de dibujado": los objetos
//     lejanos se funden con el fondo y no hay que dibujar más allá.
//   · Decorado lateral reciclable a ambos lados de la pista.
//
// Los escenarios concretos solo cambian paleta, props y, si acaso, añaden una
// mecánica especial (la oscuridad del Apagón).
// ============================================================================

import * as THREE from 'three';
import { crearDecorado } from '../models/props.js';
import { ANCHO_PISTA } from '../game/Track.js';

const SEPARACION_DECORADO = 14;   // Cada cuántas unidades cae un elemento.
const ELEMENTOS_POR_LADO = 14;    // Suficientes para cubrir hasta la niebla.
const OFFSET_LATERAL = ANCHO_PISTA / 2 + 3.2;

export class BaseScene {
  /**
   * @param {THREE.Scene} escena
   * @param {object} config Configuración del escenario (config/escenarios.js)
   */
  constructor(escena, config) {
    this.escena = escena;
    this.config = config;
    this.colores = config.colores;

    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.decorados = [];
    this.tiempo = 0;

    this._crearLuces();
    this._crearNiebla();
    this._crearDecorado();
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  _crearLuces() {
    const c = this.colores;

    // Ambiente: define el "suelo" tonal de todo el escenario.
    this.luzAmbiente = new THREE.AmbientLight(c.luzAmbiente, c.intensidadAmbiente);
    this.grupo.add(this.luzAmbiente);

    // Direccional: da volumen a las cajas low-poly.
    this.luzDireccional = new THREE.DirectionalLight(c.luzDireccional, c.intensidadDireccional);
    this.luzDireccional.position.set(6, 14, 4);
    this.grupo.add(this.luzDireccional);

    // Relleno con el color de acento, desde el frente: hace que el acento del
    // escenario tiña los objetos cercanos y unifica la imagen.
    this.luzRelleno = new THREE.PointLight(c.acento, 1.4, 42, 2);
    this.luzRelleno.position.set(0, 5, -6);
    this.grupo.add(this.luzRelleno);
  }

  _crearNiebla() {
    // Niebla exponencial: se ve más natural que la lineal a estas distancias.
    this.escena.fog = new THREE.FogExp2(this.colores.nieblaLejos, 0.016);
    this.escena.background = new THREE.Color(this.colores.nieblaLejos);
  }

  _crearDecorado() {
    for (const signo of [-1, 1]) {
      for (let i = 0; i < ELEMENTOS_POR_LADO; i++) {
        const elemento = crearDecorado(this.config.id, this.colores);

        const z = -i * SEPARACION_DECORADO;
        // Variación lateral, para que no quede una pared perfectamente recta.
        const desviacion = Math.random() * 2.5;
        elemento.position.set(signo * (OFFSET_LATERAL + desviacion), 0, z);
        elemento.rotation.y = signo > 0 ? -Math.PI / 2 : Math.PI / 2;

        // Escala variada: rompe la repetición.
        const escala = 0.8 + Math.random() * 0.6;
        elemento.scale.setScalar(escala);

        this.grupo.add(elemento);
        this.decorados.push({ objeto: elemento, signo });
      }
    }
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {number} avance Distancia recorrida este fotograma
   * @param {Player} jugador
   */
  actualizar(dt, avance, jugador) {
    this.tiempo += dt;

    const total = SEPARACION_DECORADO * ELEMENTOS_POR_LADO;

    for (const d of this.decorados) {
      d.objeto.position.z += avance;

      if (d.objeto.position.z > SEPARACION_DECORADO) {
        d.objeto.position.z -= total;
        // Al reciclar, revolvemos escala y desviación: la ciudad no se repite.
        d.objeto.position.x = d.signo * (OFFSET_LATERAL + Math.random() * 2.5);
        d.objeto.scale.setScalar(0.8 + Math.random() * 0.6);
      }
    }

    // La luz de relleno acompaña al jugador para que siempre esté iluminado.
    this.luzRelleno.position.x = jugador.x * 0.5;
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  /** Devuelve la paleta, para que Track y obstáculos se tiñan igual. */
  obtenerColores() {
    return this.colores;
  }

  /** ¿Este escenario aplica un multiplicador de visibilidad? (lo usa Apagón) */
  factorVisibilidad() {
    return 1;
  }

  /** Gancho para efectos al recoger estamina. Vacío por defecto. */
  alRecogerEstamina() {}

  /** Desmonta el escenario y libera memoria. */
  destruir() {
    this.escena.remove(this.grupo);
    this.grupo.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    this.decorados = [];
    this.escena.fog = null;
  }
}
