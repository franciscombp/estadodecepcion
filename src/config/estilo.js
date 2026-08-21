// ============================================================================
// ESTILO — Tokens de diseño
// ============================================================================
// Sistema visual extraído de las referencias de arte del proyecto
// (ver docs/ESTILO.md para el razonamiento y las reglas de composición).
//
// Referencia de estilo: juego móvil premium tipo Apple Arcade.
// Noche tropical + neón. Paneles oscuros casi negros, bordes de color con
// resplandor, tipografía pesada en mayúsculas, iconos ilustrados a color.
//
// REGLA CENTRAL: el color es SEMÁNTICO, nunca decorativo.
//   verde  = tú, tu progreso, lo bueno
//   dorado = lo que recolectas
//   rojo   = peligro y ellos
//   cian   = información neutra
//   naranja= evidencia, lo valioso
//
// Si un elemento nuevo no encaja en esos cinco significados, probablemente
// no debería llevar color: va en gris.
// ============================================================================

// ---------------------------------------------------------------------------
// COLORES
// ---------------------------------------------------------------------------
export const COLOR = {
  // --- Fondos ---
  abismo: '#05070c',        // El más oscuro: fondo de pantallas completas
  noche: '#0a0e17',         // Fondo base
  panel: '#0d1220',         // Relleno de paneles del HUD
  panelAlto: '#141b2d',     // Paneles elevados / hover
  asfalto: '#12172a',

  // --- Semánticos ---
  verde: '#3dff9a',         // Jugador, progreso, éxito
  verdeOscuro: '#0f5c38',
  dorado: '#ffcf3f',        // Papeles, recolectables
  doradoOscuro: '#8a6d1f',
  rojo: '#ff3355',          // Peligro, perseguidor, fracaso
  rojoOscuro: '#7a1226',
  cian: '#2affd5',          // Información, estamina
  cianOscuro: '#0d5f52',
  naranja: '#ff6b35',       // Evidencia
  naranjaOscuro: '#8a3517',

  // --- Neutros ---
  texto: '#eef2fa',
  textoTenue: '#8b95ad',
  textoDebil: '#4a5468',
  borde: 'rgba(255,255,255,0.10)',
};

// Versiones RGB para componer sombras y fondos translúcidos sin repetir
// literales por todo el CSS.
export const RGB = {
  verde: '61,255,154',
  dorado: '255,207,63',
  rojo: '255,51,85',
  cian: '42,255,213',
  naranja: '255,107,53',
};

// ---------------------------------------------------------------------------
// COLORES DEL MUNDO 3D
// ---------------------------------------------------------------------------
// Los mismos valores en hexadecimal numérico, que es lo que consume Three.js.
export const COLOR3D = {
  verde: 0x3dff9a,
  dorado: 0xffcf3f,
  rojo: 0xff3355,
  cian: 0x2affd5,
  naranja: 0xff6b35,
  asfalto: 0x12172a,
  noche: 0x0a0e17,

  // Materiales recurrentes del decorado
  chevronClaro: 0xf5c518,   // Amarillo de las barreras
  chevronOscuro: 0x1a1a1f,
  madera: 0x6b4a2f,
  metal: 0x3a4256,
  hormigon: 0x4a4a55,
};

// ---------------------------------------------------------------------------
// GEOMETRÍA DE LA INTERFAZ
// ---------------------------------------------------------------------------
export const FORMA = {
  radioChico: '10px',
  radio: '14px',
  radioGrande: '20px',
  radioPildora: '999px',
  grosorBorde: '2px',
};

// ---------------------------------------------------------------------------
// TIPOGRAFÍA
// ---------------------------------------------------------------------------
// No cargamos fuentes externas: el juego tiene que arrancar sin red y una
// fuente que no llega deja el HUD descuadrado. La pila de sistema con peso 900
// y tracking apretado da el mismo carácter que las condensadas de referencia.
export const TIPO = {
  familia: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  // Los números del HUD llevan cifras de ancho fijo: si no, el marcador
  // "baila" cada vez que cambia un dígito.
  numeros: `'SF Mono', 'Segoe UI Mono', 'Roboto Mono', ui-monospace, monospace`,
  pesoNormal: 600,
  pesoFuerte: 800,
  pesoMaximo: 900,
};

// ---------------------------------------------------------------------------
// RESPLANDORES
// ---------------------------------------------------------------------------
// El neón se compone en tres capas: un halo exterior amplio y tenue, un borde
// nítido, y un brillo interior. Una sola sombra grande se ve sucia; tres
// capas se leen como luz.
export function resplandor(rgb, intensidad = 1) {
  return [
    `0 0 ${8 * intensidad}px rgba(${rgb},${0.35 * intensidad})`,
    `0 0 ${22 * intensidad}px rgba(${rgb},${0.18 * intensidad})`,
    `inset 0 0 ${12 * intensidad}px rgba(${rgb},${0.06 * intensidad})`,
  ].join(', ');
}

/** Resplandor de texto, para cifras grandes. */
export function resplandorTexto(rgb, intensidad = 1) {
  return `0 0 ${10 * intensidad}px rgba(${rgb},0.55), 0 0 ${28 * intensidad}px rgba(${rgb},0.25)`;
}

// ---------------------------------------------------------------------------
// MOVIMIENTO
// ---------------------------------------------------------------------------
// Duraciones cortas y curvas con rebote: un HUD de juego responde, no se
// desliza con elegancia. Todo lo que el jugador provoca debe confirmarse en
// menos de 200 ms.
export const MOVIMIENTO = {
  instantaneo: '90ms',
  rapido: '160ms',
  medio: '280ms',
  lento: '450ms',
  rebote: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  salida: 'cubic-bezier(0.4, 0, 1, 1)',
  entrada: 'cubic-bezier(0, 0, 0.2, 1)',
};

// ---------------------------------------------------------------------------
// POST-PROCESADO 3D
// ---------------------------------------------------------------------------
// El bloom es lo que convierte materiales emisivos planos en neón de verdad.
// Es también el efecto más caro del pipeline, así que va con un interruptor
// por calidad y se apaga entero en equipos lentos.
export const BLOOM = {
  intensidad: 0.62,
  radio: 0.45,
  // Solo brilla lo que supera este umbral de luminancia: así el asfalto no
  // se lava y el neón destaca.
  umbral: 0.62,
};

// ---------------------------------------------------------------------------
// CALIDAD ADAPTATIVA
// ---------------------------------------------------------------------------
// El juego mide su propio rendimiento y baja de nivel si no llega a 60 FPS.
// Ver utils/calidad.js.
export const CALIDAD = {
  alta: {
    bloom: true,
    pixelRatioMaximo: 2,
    decoradosPorLado: 16,
    sombrasNeon: true,
    particulas: true,
    // El halo de cada papel. Es un sprite más por pieza y hay hasta 340 en
    // pista —520 en el reguero del trámite—, así que en gama baja se apaga:
    // la moneda sigue leyéndose por su tamaño y su canto.
    halosEvidencia: true,
    // Tamaño del pozo de chispas. Es una sola llamada de dibujo pase lo que
    // pase, así que lo que se paga aquí es el recorrido por CPU de un array
    // plano por fotograma: barato, pero no gratis en un móvil de gama baja.
    pozoParticulas: 420,
    // EN CUÁNTOS PASOS SE CRUZA EL CIELO AL CAMBIAR DE BARRIO.
    //
    // El mapa de entorno es una textura prefiltrada: no se puede mezclar con
    // otra en el sombreador, sólo se puede volver a prefiltrar uno intermedio.
    // Eso cuesta entre 1,2 y 3,5 ms medidos (256×128 → cubo de 64, en un
    // equipo sin GPU donde un fotograma entero cuesta 5,4-8,5), así que cada
    // fotograma no; a pasos, sí.
    //
    // Dieciséis y no ocho: cambiar el cielo de la Bahía por el del Apagón
    // mueve el brillo medio del cuadro 0,0726 —el 13,7 %, medido con el mundo
    // quieto—, o sea 0,0057 por paso con dieciséis. Y el propio fundido, en su
    // tramo más empinado a 60 fps, mueve 0,005 por fotograma: el escalón del
    // cielo mide lo mismo que un fotograma normal de la transición, así que no
    // se puede leer como escalón. Con ocho medía el doble y se notaba un tic.
    pasosCieloTransito: 16,
  },
  media: {
    bloom: true,
    pixelRatioMaximo: 1.5,
    decoradosPorLado: 12,
    sombrasNeon: false,
    particulas: true,
    halosEvidencia: true,
    pozoParticulas: 220,
    // La mitad de pasos: el escalón sube a 0,0105 —el doble de un fotograma
    // del fundido— pero se paga la mitad de prefiltrados. En gama media el
    // trato correcto es ese.
    pasosCieloTransito: 8,
  },
  baja: {
    bloom: false,
    pixelRatioMaximo: 1,
    decoradosPorLado: 8,
    sombrasNeon: false,
    particulas: false,
    halosEvidencia: false,
    // NINGUNO. El cielo se cambia de una vez al final de la transición, que es
    // donde menos cuesta: al terminar el fundido hacia el Apagón el cuadro ya
    // está oscuro y el mapa aporta 0,038 en vez de los 0,073 que aportaría
    // cambiándolo al principio, con la Bahía todavía puesta. Medido.
    pasosCieloTransito: 0,
    pozoParticulas: 0,
  },
};
