// ============================================================================
// COLISIÓN — Cajas alineadas a los ejes (AABB)
// ============================================================================
// Un endless runner de carriles no necesita un motor de física. Subway Surfers
// resuelve las colisiones con cajas alineadas a los ejes y nosotros hacemos lo
// mismo: es exacto, predecible y cuesta prácticamente nada en móvil.
//
// Cada entidad expone una caja {x, y, z, ancho, alto, profundidad} donde
// (x, y, z) es el CENTRO de la caja.
// ============================================================================

/**
 * Crea una caja de colisión a partir de un centro y sus dimensiones.
 */
export function crearCaja(x, y, z, ancho, alto, profundidad) {
  return { x, y, z, ancho, alto, profundidad };
}

/**
 * ¿Se solapan dos cajas en los tres ejes?
 * Devuelve true solo si hay intersección real en X, Y y Z simultáneamente.
 */
export function hayColision(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.ancho + b.ancho &&
    Math.abs(a.y - b.y) * 2 < a.alto + b.alto &&
    Math.abs(a.z - b.z) * 2 < a.profundidad + b.profundidad
  );
}

/**
 * Colisión en el plano horizontal (X/Z), ignorando la altura.
 * La usamos para los recolectables: si pasas por encima de un papel a la
 * altura que sea, lo recoges. Ser estricto con la Y aquí solo frustra.
 */
export function hayColisionPlana(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.ancho + b.ancho &&
    Math.abs(a.z - b.z) * 2 < a.profundidad + b.profundidad
  );
}

/**
 * Distancia horizontal entre dos puntos del mundo.
 * Se usa para el imán de los papeles.
 */
export function distanciaHorizontal(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Determina cómo se supera un obstáculo dado el estado del jugador.
 * Devuelve true si el jugador LIBRA el obstáculo (no choca).
 *
 * Esta función concentra la regla del juego: saltar libra los bajos,
 * agacharse libra los altos, y nada libra los sólidos salvo cambiar de carril.
 */
export function libraObstaculo(tipoObstaculo, jugador) {
  switch (tipoObstaculo) {
    case 'saltar':
      // Se libra si el pie del jugador está por encima del obstáculo.
      return jugador.estaEnElAire;
    case 'agachar':
      // Se libra si el jugador redujo su altura.
      return jugador.estaAgachado;
    case 'esquivar':
    case 'doble':
      // Bloques sólidos: no hay salto ni agachada que valga.
      return false;
    default:
      return false;
  }
}
