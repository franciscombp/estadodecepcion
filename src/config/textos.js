// ============================================================================
// TEXTOS — Microcopy, remates de game over y fichas del cuaderno
// ============================================================================
//
// NOTA EDITORIAL IMPORTANTE PARA EL EQUIPO DE EL MERCIO
// -----------------------------------------------------
// El brief original pedía cerrar cada partida con "una cita real del caso".
// Aquí NO se incluyen citas atribuidas a personas reales, y es a propósito:
// una frase entrecomillada con nombre y apellido que en realidad escribimos
// nosotros deja de ser sátira y pasa a ser una cita falsa. Se saca de contexto,
// se captura en pantalla y circula sin el juego alrededor.
//
// Lo que sí hacemos —y es lo que hace un diario satírico— es rematar en VOZ
// PROPIA de El Mercio: el narrador comenta, ironiza y describe. La sátira queda
// intacta; la responsabilidad, también.
//
// Si quieren citas textuales reales, el lugar es `citasVerificadas` más abajo:
// van con fuente y fecha, y solo si alguien del equipo las verificó contra el
// registro original (video, acta, boletín). El campo viene vacío a propósito.
// ============================================================================

// ---------------------------------------------------------------------------
// REMATES DE GAME OVER — cuando el perseguidor te alcanza
// ---------------------------------------------------------------------------
// Voz de El Mercio. Uno por escenario, para que el cierre sea temático.
export const REMATES_CAPTURA = {
  bahia: [
    'Te alcanzaron entre los toldos. El expediente se quedó en el suelo, junto a las cáscaras.',
    'Nadie vio nada. En la Bahía nadie ve nada, es política de local.',
    'El USB apareció tres meses después. Vacío, pero apareció.',
  ],
  apagon: [
    'Te agarraron a oscuras. Ni tú viste quién fue.',
    'La linterna se apagó primero. Después, todo lo demás.',
    'Dijeron que fue una falla técnica. Tu cámara también tuvo una falla técnica.',
  ],
  elecciones: [
    'Te alcanzaron entre dos cartones sonrientes. Los cartones siguen sonriendo.',
    'El conteo rápido te dio por perdedor antes de que terminaras de correr.',
    'Tu denuncia entró como observación. Las observaciones no se cuentan.',
  ],
  carondelet: [
    'El cerco se cerró. Aquí nunca hubo por dónde salir, esa era la idea.',
    'Te retuvieron para verificar tu identidad. Sigues en verificación.',
    'La rueda de prensa fue sin preguntas. Tú ya no ibas a hacer ninguna.',
  ],
};

// Remate genérico por si se agrega un escenario sin textos propios.
export const REMATE_GENERICO = 'Te alcanzaron. La noticia no salió.';

// ---------------------------------------------------------------------------
// REMATES POR QUEDARSE SIN ESTAMINA
// ---------------------------------------------------------------------------
export const REMATES_EXHAUSTO = [
  'Te quedaste sin fuerzas. Ellos tenían viáticos.',
  'El cansancio no sale en el informe de derechos humanos, pero cuenta.',
  'Corriste hasta que el cuerpo dijo basta. El cuerpo suele decirlo antes que el miedo.',
];

// ---------------------------------------------------------------------------
// NOTA: LAS FICHAS FICTICIAS SE ELIMINARON
// ---------------------------------------------------------------------------
// El meta-progreso ya no desbloquea definiciones satíricas inventadas, sino
// REPORTAJES REALES publicados por El Mercio. Viven en config/publicaciones.js.
//
// El cambio es de fondo, no de forma: el juego es sátira, pero lo que ganas
// por jugarlo es periodismo de verdad, con su enlace y su firma.

// ---------------------------------------------------------------------------
// CITAS VERIFICADAS — vacío a propósito
// ---------------------------------------------------------------------------
// Para incorporar una cita textual real, agregar un objeto con esta forma:
//
//   {
//     escenario: 'bahia',
//     texto: '...la cita textual, sin editar...',
//     autor: 'Nombre y cargo al momento de la declaración',
//     fuente: 'Medio o documento + enlace',
//     fecha: '2025-03-14',
//     verificadaPor: 'quien-la-chequeó',
//   }
//
// Regla de la casa: si no tiene fuente y fecha comprobables, no entra.
// El juego funciona perfectamente con esta lista vacía.
export const CITAS_VERIFICADAS = [];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Elige un remate de captura para el escenario dado. */
export function remateCaptura(idEscenario) {
  const lista = REMATES_CAPTURA[idEscenario];
  if (!lista || lista.length === 0) return REMATE_GENERICO;
  return lista[Math.floor(Math.random() * lista.length)];
}

/** Elige un remate para el final por agotamiento. */
export function remateExhausto() {
  return REMATES_EXHAUSTO[Math.floor(Math.random() * REMATES_EXHAUSTO.length)];
}

/**
 * Devuelve la cita verificada aplicable a un escenario, o null.
 * Mientras CITAS_VERIFICADAS esté vacío siempre devuelve null y el juego
 * se queda solo con el remate satírico.
 */
export function citaVerificada(idEscenario) {
  const candidatas = CITAS_VERIFICADAS.filter((c) => c.escenario === idEscenario);
  if (candidatas.length === 0) return null;
  return candidatas[Math.floor(Math.random() * candidatas.length)];
}
