// ============================================================================
// LA BAHÍA — Corrupción
// ============================================================================
// Una calle TECHADA. No es un malecón con toldos a los lados: es un pasaje
// cubierto de punta a punta por una bóveda traslúcida, con las hileras de
// puestos debajo. Ese techo es lo que define el sector —y es también lo que
// más cambia la sensación de correr, porque pone algo por encima de la cabeza
// del jugador y lo hace pasar de largo.
//
// Detalle propio: gaviotas de papel que cruzan el cielo. Son hojas sueltas,
// no pájaros — el chiste visual de que aquí hasta lo que vuela es papeleo.
// ============================================================================

import * as THREE from 'three';
import { material } from '../utils/materiales.js';
import { BaseScene } from './BaseScene.js';

// La bóveda es un arco de circunferencia cuyo centro está BAJO EL SUELO. Con
// el centro a ras, el arranque sería vertical y quedaría un tubo; hundiéndolo
// un poco, el arco toca el suelo abierto —como los pasajes de verdad— y la
// clave queda a una altura de nave, no de túnel.
// MÁS ANGOSTA Y MÁS ALTA, que es la geometría de la referencia.
//
// Con radio 10,4 y el centro a −3,2 la bóveda arrancaba en x = ±9,9 y su clave
// quedaba en 7,2: más ancha que alta, o sea una nave tumbada. En la referencia
// los arcos son lo contrario —estrechos y de clave alta— y eso no es estilo,
// es lo que hace que el pasillo apriete.
//
// Subiendo el centro POR ENCIMA del suelo la relación se invierte: con centro
// en +1,2 la bóveda arranca en x = ±7,5 (24 % más estrecha) y la clave sube a
// 8,8 (22 % más alta), o sea clave/semiluz pasa de 0,73 a 1,17. El arranque
// queda ahora detrás de la hilera de puestos en vez de a la vista, que es
// además como se ven los pasajes: el arco nace del techo de los locales.
const CUBIERTA = {
  RADIO: 7.6,
  CENTRO_Y: 1.2,         // Arranca en x = ±sqrt(R² - y²) ≈ ±7.5; clave en 8.8
  LARGO_TRAMO: 12,       // Longitud de cada segmento reciclable
  SEGMENTOS: 14,         // 168 m cubiertos: más que la niebla
};

export class BahiaScene extends BaseScene {
  constructor(escena, config, calidad) {
    super(escena, config, calidad);

    // Lo pone Game cuando hay fachada de bifurcación en pista. Ver _cubrir().
    this.zTope = null;

    this._crearCubierta();
    this._crearPapelesVolando();
  }

  /**
   * La bóveda que cruza la calle entera, en segmentos reciclables.
   *
   * Va aquí y no en el decorado lateral porque no es de un lado: es de los
   * dos. Montada como decorado habría dos medias bóvedas independientes que
   * no casan —cada lado se recicla por su cuenta— y por el eje de la calle se
   * vería la juntura.
   */
  _crearCubierta() {
    this.cubierta = [];

    const geoPanel = new THREE.CylinderGeometry(
      CUBIERTA.RADIO, CUBIERTA.RADIO, CUBIERTA.LARGO_TRAMO, 18, 1, true, 0, Math.PI,
    );
    const matPanel = material({
      color: 0xe8eeea,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0xdfe9e4,
      emissiveIntensity: 0.14,
      // Sin niebla el techo llegaría igual de sólido hasta el fondo y
      // delataría que es geometría; con ella se funde como todo lo demás.
      fog: true,
    });

    const geoCercha = new THREE.TorusGeometry(CUBIERTA.RADIO + 0.06, 0.11, 4, 22, Math.PI);
    const matCercha = material({
      color: 0x8d939b, roughness: 0.55, metalness: 0.35, flatShading: true,
    });

    for (let i = 0; i < CUBIERTA.SEGMENTOS; i++) {
      const tramo = new THREE.Group();

      const panel = new THREE.Mesh(geoPanel, matPanel);
      // El cilindro nace con el eje en Y; se tumba para que corra a lo largo
      // de la calle, y la media caña llena queda arriba.
      panel.rotation.z = Math.PI / 2;
      panel.rotation.y = Math.PI / 2;
      tramo.add(panel);

      // Cercha en la cabeza del segmento. Una por tramo basta: a doce metros
      // de separación ya dan el ritmo de nave industrial.
      const cercha = new THREE.Mesh(geoCercha, matCercha);
      cercha.position.z = -CUBIERTA.LARGO_TRAMO / 2;
      tramo.add(cercha);

      tramo.position.set(0, CUBIERTA.CENTRO_Y, -i * CUBIERTA.LARGO_TRAMO);
      this.grupo.add(tramo);
      this.cubierta.push(tramo);
    }

    this.largoCubierta = CUBIERTA.LARGO_TRAMO * CUBIERTA.SEGMENTOS;
  }

  _crearPapelesVolando() {
    this.papelesVolando = [];

    const geometria = new THREE.PlaneGeometry(0.5, 0.65);
    // `matPapel` y no `material`: este módulo importa ahora una función que se
    // llama `material()` —la del acabado de la casa— y una variable local con
    // ese nombre la tapa dentro del método. Aquí no rompía nada porque no se
    // usan las dos juntas, pero la que sí lo hacía se llevó por delante el
    // bucle de animación entero con un «Cannot access before initialization».
    const matPapel = new THREE.MeshBasicMaterial({
      color: 0xf0e6c8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });

    for (let i = 0; i < 12; i++) {
      const papel = new THREE.Mesh(geometria, matPapel);
      // Por DEBAJO de la clave de la bóveda: ahora hay techo, y unas hojas
      // volando por encima de él serían hojas volando fuera del edificio.
      papel.position.set(
        (Math.random() - 0.5) * 16,
        2.5 + Math.random() * 3,
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

  /**
   * Recicla los tramos de bóveda y esconde los que caerían más allá de la
   * fachada de la bifurcación.
   *
   * Sin ese recorte, el techo atraviesa la fachada y las cerchas salen por el
   * otro lado, que se lee como un fallo y no como un pasaje que se acaba.
   */
  _cubrir(avance) {
    for (const tramo of this.cubierta) {
      tramo.position.z += avance;
      if (tramo.position.z > CUBIERTA.LARGO_TRAMO) {
        tramo.position.z -= this.largoCubierta;
      }
      // Medio tramo de margen: se apaga cuando su cabeza ya pasó la fachada,
      // no cuando la roza.
      tramo.visible = this.zTope === null
        || tramo.position.z > this.zTope + CUBIERTA.LARGO_TRAMO / 2;
    }
  }

  actualizar(dt, avance, jugador) {
    super.actualizar(dt, avance, jugador);

    this._cubrir(avance);

    for (const p of this.papelesVolando) {
      // Se mueven hacia el jugador más lento que el suelo: parallax.
      p.malla.position.z += avance * 0.55;
      p.malla.position.x += p.velocidadX * dt;
      p.malla.position.y += Math.sin(this.tiempo * 1.5 + p.faseFlotacion) * dt * 1.4;

      p.malla.rotation.z += p.giro * dt;
      p.malla.rotation.y += p.giro * 0.7 * dt;

      // SE ENCOGEN ANTES DE LLEGAR AL OBJETIVO, y esto era un fallo de verdad.
      //
      // Reciclaban en z > 15, o sea NUEVE METROS POR DETRÁS de la cámara, así
      // que cada hoja cruzaba el plano del objetivo. Medido sobre la foto: una
      // hoja de 0,5 × 0,65 a 2,2 m de la cámara tapa el 40 % del ancho del
      // cuadro. Con la cámara a 6,4 ya pasaba y se leía como una veladura;
      // acortada a 5,5 y con el angular de diseño se lee como un cuadro blanco
      // pegado a la lente.
      //
      // Encogerlas y no desvanecerlas porque el material va COMPARTIDO entre
      // las doce: la opacidad es del material, así que difuminar una las
      // difuminaría todas. La escala es de la malla.
      const cerca = (p.malla.position.z + 2) / 6;   // 0 a −2 m, 1 a +4
      p.malla.scale.setScalar(1 - Math.min(1, Math.max(0, cerca)));

      if (p.malla.position.z > 4) {
        p.malla.position.z = -160 - Math.random() * 40;
        p.malla.position.x = (Math.random() - 0.5) * 16;
        p.malla.position.y = 2.5 + Math.random() * 3;
        p.malla.scale.setScalar(1);
      }
    }
  }
}
