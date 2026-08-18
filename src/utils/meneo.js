// ============================================================================
// MENEO — lo que se mueve DESPUÉS del cuerpo
// ============================================================================
//
// EL SOMBRERO NO PUEDE IR ATORNILLADO A LA CABEZA.
//
// Los accesorios de los personajes cuelgan de un hueso: el sombrero del Head,
// la corbata del Spine, la mochila de la espalda. Eso los hace seguir al hueso
// EXACTAMENTE, en el mismo fotograma y sin un milímetro de retraso, y el ojo
// lo lee enseguida —aunque no sepa decir por qué— como que el sombrero es
// parte del cráneo. Un personaje al que se le mueve todo a la vez parece una
// figura de una pieza, por buena que sea la animación del esqueleto.
//
// Lo que hace que un personaje de este género se vea vivo y divertido no es
// el ciclo de carrera: es lo que pasa medio fotograma DESPUÉS. El sombrero se
// queda atrás al arrancar y se adelanta al frenar. La corbata sale volando en
// el salto y tarda en caer. Es el mismo principio que las orejas de un perro
// corriendo, y es gratis en comparación con lo que aporta.
//
// ---------------------------------------------------------------------------
// CÓMO
// ---------------------------------------------------------------------------
// Cada pieza colgada guarda un ángulo propio que NO se dibuja en el esqueleto:
// se suma a su rotación de reposo. Ese ángulo va gobernado por un muelle
// amortiguado al que empuja la ACELERACIÓN de su anclaje.
//
//     aceleración del anclaje  →  empujón
//     muelle                   →  tira de vuelta al reposo
//     amortiguación            →  evita que oscile eternamente
//
// Un muelle y no una interpolación porque un muelle REBASA: el sombrero pasa
// de largo el punto de reposo y vuelve. Ese rebase es exactamente la parte
// divertida; una interpolación suave llega y se para, que es lo que hace un
// ascensor.
//
// ---------------------------------------------------------------------------
// LO QUE NO HACE
// ---------------------------------------------------------------------------
// No hay colisión ni cadenas de varios eslabones. Una corbata de tres
// segmentos que no atraviese el pecho es un sistema bastante más grande, y en
// una figura de doce centímetros en pantalla no se nota la diferencia. Aquí
// cada pieza es un péndulo de un solo tramo.
// ============================================================================

import * as THREE from 'three';

/** Lo colgado. Se recorre entero cada fotograma, así que conviene que sea poco. */
const colgados = [];

const _mundo = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _acel = new THREE.Vector3();
const _local = new THREE.Vector3();
const _inv = new THREE.Quaternion();

/**
 * Cuelga una pieza para que se mueva con retraso respecto a su anclaje.
 *
 * La pieza tiene que estar YA colocada y anclada a su hueso: se guarda su
 * rotación actual como reposo y el meneo se suma a esa.
 *
 * @param {THREE.Object3D} pieza
 * @param {object} [op]
 * @param {number} [op.rigidez]      Cuánto tira de vuelta. Alto = tieso.
 * @param {number} [op.amortiguacion] Cuánto frena. Bajo = tiembla más rato.
 * @param {number} [op.sensibilidad] Cuánto le afecta la aceleración.
 * @param {number} [op.tope]         Ángulo máximo, en radianes.
 * @param {boolean} [op.sobreAnimacion] Para HUESOS que ya anima un clip: en vez
 *   de partir de una rotación de reposo guardada, se suma a la que el clip haya
 *   dejado en este fotograma. Sin esto, colgar un hueso animado BORRARÍA su
 *   animación —el meneo escribiría encima de la zancada— en vez de matizarla.
 */
export function colgar(pieza, op = {}) {
  if (!pieza) return;
  colgados.push({
    pieza,
    sobreAnimacion: !!op.sobreAnimacion,
    reposo: pieza.rotation.clone(),
    // El muelle trabaja en dos ángulos: cabeceo (adelante/atrás) y balanceo
    // (izquierda/derecha). El giro sobre su propio eje no se menea: un
    // sombrero que rota sobre la coronilla parece un tornillo, no un sombrero.
    cabeceo: 0,
    balanceo: 0,
    velCabeceo: 0,
    velBalanceo: 0,
    rigidez: op.rigidez ?? 90,
    amortiguacion: op.amortiguacion ?? 11,
    sensibilidad: op.sensibilidad ?? 0.055,
    tope: op.tope ?? 0.42,
    posPrevia: null,
    velPrevia: new THREE.Vector3(),
  });
}

/** Suelta todo. Al cambiar de personaje o al desmontar la escena. */
export function descolgar() {
  colgados.length = 0;
}

/** Cuántas piezas hay colgadas. Para las pruebas. */
export function cuantosColgados() { return colgados.length; }

/**
 * Adelanta el muelle de cada pieza colgada.
 *
 * Se llama UNA vez por fotograma, DESPUÉS de animar el esqueleto: lee dónde ha
 * quedado el anclaje este fotograma, así que si se llama antes lee el del
 * anterior y el retraso sale de dos fotogramas en vez de uno.
 *
 * @param {number} dt Segundos desde el fotograma anterior.
 */
export function menear(dt) {
  if (!colgados.length || dt <= 0) return;
  // Un tope de paso: si la pestaña estuvo en segundo plano, dt puede venir de
  // varios segundos y el muelle explotaría —la aceleración sale disparada y el
  // sombrero se va a tomar viento—.
  const paso = Math.min(dt, 1 / 30);

  for (const c of colgados) {
    const { pieza } = c;
    if (!pieza.parent) continue;

    pieza.parent.getWorldPosition(_mundo);

    if (c.posPrevia === null) {
      c.posPrevia = _mundo.clone();
      continue;
    }

    // Velocidad y aceleración del anclaje, en el mundo.
    _vel.subVectors(_mundo, c.posPrevia).divideScalar(paso);
    _acel.subVectors(_vel, c.velPrevia).divideScalar(paso);
    c.posPrevia.copy(_mundo);
    c.velPrevia.copy(_vel);

    // A las coordenadas del anclaje: lo que importa es si la cabeza acelera
    // hacia DELANTE o hacia UN LADO, no hacia dónde apunta el eje del mundo.
    pieza.parent.getWorldQuaternion(_inv).invert();
    _local.copy(_acel).applyQuaternion(_inv);

    // Muelle amortiguado, integrado a lo bruto. Con estos valores —rigidez 90,
    // amortiguación 11— el sistema queda subamortiguado, que es lo que hace
    // falta: rebasa el reposo y vuelve. Sobreamortiguado llegaría suave y
    // muerto, que es justo lo que se quería evitar.
    c.velCabeceo += (-c.rigidez * c.cabeceo - c.amortiguacion * c.velCabeceo
      + _local.z * c.sensibilidad) * paso;
    c.velBalanceo += (-c.rigidez * c.balanceo - c.amortiguacion * c.velBalanceo
      - _local.x * c.sensibilidad) * paso;

    c.cabeceo = clamp(c.cabeceo + c.velCabeceo * paso, c.tope);
    c.balanceo = clamp(c.balanceo + c.velBalanceo * paso, c.tope);

    // Un hueso que ya anima un clip parte de lo que el clip acaba de escribir;
    // una pieza suelta, de su reposo. La diferencia es entre matizar una
    // animación y borrarla.
    const baseX = c.sobreAnimacion ? pieza.rotation.x : c.reposo.x;
    const baseZ = c.sobreAnimacion ? pieza.rotation.z : c.reposo.z;
    pieza.rotation.x = baseX + c.cabeceo;
    pieza.rotation.z = baseZ + c.balanceo;
  }
}

function clamp(v, tope) {
  return v < -tope ? -tope : v > tope ? tope : v;
}
