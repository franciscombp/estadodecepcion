// ============================================================================
// ESCENA BASE — Iluminación, niebla, decorado y dron
// ============================================================================
// Cada escenario hereda de aquí. La base resuelve lo que todos comparten:
//
//   · Luces (ambiente + direccional + relleno de color que sigue al jugador)
//   · Niebla, que además hace de distancia de dibujado: lo lejano se funde
//     con el fondo y no hay que pintar más allá
//   · Decorado lateral reciclable
//   · Dron de vigilancia sobrevolando la pista
//
// Los escenarios concretos solo cambian paleta y props, y si acaso añaden una
// mecánica propia (la oscuridad del Apagón).
//
// Ver docs/ESTILO.md para las reglas de iluminación.
// ============================================================================

import * as THREE from 'three';
import { crearDecorado, crearDron } from '../models/props.js';
import { ANCHO_PISTA } from '../game/Track.js';
import { CALIDAD } from '../config/estilo.js';

const SEPARACION_DECORADO = 15;
const OFFSET_LATERAL = ANCHO_PISTA / 2 + 3.4;

export class BaseScene {
  /**
   * @param {THREE.Scene} escena
   * @param {object} config  Configuración del escenario (config/escenarios.js)
   * @param {object} calidad Nivel gráfico (utils/calidad.js)
   */
  constructor(escena, config, calidad = { nivel: 'alta', ...CALIDAD.alta }) {
    this.escena = escena;
    this.config = config;
    this.colores = config.colores;
    this.calidad = calidad;

    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.decorados = [];
    this.tiempo = 0;

    this._crearLuces();
    this._crearNiebla();
    this._crearDecorado();
    this._crearDron();
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  _crearLuces() {
    const c = this.colores;

    // 1. Ambiente: define el suelo tonal del escenario.
    this.luzAmbiente = new THREE.AmbientLight(c.luzAmbiente, c.intensidadAmbiente);
    this.grupo.add(this.luzAmbiente);

    // 2. Direccional cálida: da volumen a las cajas low-poly.
    this.luzDireccional = new THREE.DirectionalLight(c.luzDireccional, c.intensidadDireccional);
    this.luzDireccional.position.set(6, 15, 4);
    this.grupo.add(this.luzDireccional);

    // 3. Relleno de color siguiendo al jugador. Garantiza que el personaje
    //    nunca se pierda contra el fondo y tiñe el entorno cercano con el
    //    acento del escenario.
    this.luzRelleno = new THREE.PointLight(c.acento, 2.2, 46, 2);
    this.luzRelleno.position.set(0, 5, -6);
    this.grupo.add(this.luzRelleno);

    // 4. Contraluz frío desde el fondo: recorta la silueta del jugador y de
    //    los obstáculos contra la niebla. Es lo que da profundidad a la imagen.
    this.luzContra = new THREE.DirectionalLight(0x6688cc, 0.55);
    this.luzContra.position.set(-4, 6, -18);
    this.grupo.add(this.luzContra);
  }

  _crearNiebla() {
    // Exponencial: se ve más natural que la lineal a estas distancias.
    this.escena.fog = new THREE.FogExp2(this.colores.nieblaLejos, 0.017);
    this.escena.background = new THREE.Color(this.colores.nieblaLejos);
  }

  _crearDecorado() {
    const porLado = this.calidad.decoradosPorLado;

    for (const signo of [-1, 1]) {
      for (let i = 0; i < porLado; i++) {
        const elemento = crearDecorado(this.config.id, this.colores);

        const z = -i * SEPARACION_DECORADO;
        // Variación lateral, para que no quede una pared perfectamente recta.
        const desviacion = Math.random() * 2.6;
        elemento.position.set(signo * (OFFSET_LATERAL + desviacion), 0, z);
        elemento.rotation.y = signo > 0 ? -Math.PI / 2 : Math.PI / 2;
        elemento.scale.setScalar(0.85 + Math.random() * 0.55);

        this.grupo.add(elemento);
        this.decorados.push({
          objeto: elemento,
          signo,
          // Cada patrulla parpadea a su ritmo; sincronizadas se leen como bug.
          fasePatrulla: Math.random() * Math.PI * 2,
        });
      }
    }

    this.totalDecorado = SEPARACION_DECORADO * porLado;
  }

  /**
   * Dron de vigilancia. Sobrevuela la pista describiendo un vaivén lateral:
   * está siempre presente pero nunca tapa el carril del jugador.
   */
  _crearDron() {
    if (!this.calidad.particulas) {
      this.dron = null;
      return;
    }

    this.dron = crearDron();
    this.dron.position.set(3, 8.5, -34);
    this.grupo.add(this.dron);
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

    // --- Decorado ----------------------------------------------------------
    for (const d of this.decorados) {
      d.objeto.position.z += avance;

      if (d.objeto.position.z > SEPARACION_DECORADO) {
        d.objeto.position.z -= this.totalDecorado;
        // Al reciclar, revolvemos posición y escala: la ciudad no se repite.
        d.objeto.position.x = d.signo * (OFFSET_LATERAL + Math.random() * 2.6);
        d.objeto.scale.setScalar(0.85 + Math.random() * 0.55);
      }

      // Luces de emergencia de las patrullas.
      const patrulla = d.objeto.userData.patrulla;
      if (patrulla) {
        const ciclo = Math.sin(this.tiempo * 7 + d.fasePatrulla);
        const luces = patrulla.userData.luces;
        // Alternancia dura entre azul y rojo, como una barra real.
        luces.azul.material.emissiveIntensity = ciclo > 0 ? 4.5 : 0.2;
        luces.rojo.material.emissiveIntensity = ciclo > 0 ? 0.2 : 4.5;
      }
    }

    // --- Dron --------------------------------------------------------------
    if (this.dron) {
      // Vaivén lateral amplio y lento, y flotación vertical suave.
      this.dron.position.x = Math.sin(this.tiempo * 0.42) * 5.5;
      this.dron.position.y = 8.5 + Math.sin(this.tiempo * 1.1) * 0.5;
      // Se inclina hacia donde se mueve: da sensación de vuelo real.
      this.dron.rotation.z = -Math.cos(this.tiempo * 0.42) * 0.16;
      this.dron.rotation.y = Math.sin(this.tiempo * 0.3) * 0.3;

      for (const rotor of this.dron.userData.helices) {
        rotor.rotation.y += dt * 42;
      }
    }

    // La luz de relleno acompaña al jugador para que siempre esté iluminado.
    this.luzRelleno.position.x = jugador.x * 0.5;
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  /** Devuelve la paleta, para que pista y obstáculos se tiñan igual. */
  obtenerColores() {
    return this.colores;
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
    this.dron = null;
    this.escena.fog = null;
  }
}
