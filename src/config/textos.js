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
// FICHAS DEL CUADERNO DE EXPEDIENTES
// ---------------------------------------------------------------------------
// Se desbloquean cada N papeles acumulados (ver PROGRESO en balance.js).
// Son microcopys filosos en voz de El Mercio, no denuncias con nombre propio.
export const FICHAS_CUADERNO = [
  {
    id: 'f01',
    titulo: 'Expediente 01 — El archivo que camina',
    costo: 0,
    texto:
      'Todo expediente incómodo desarrolla, con el tiempo, la capacidad de moverse solo. Entra por Fiscalía y sale por una ventana que nadie recuerda haber abierto.',
  },
  {
    id: 'f02',
    titulo: 'Expediente 02 — Cadena de custodia',
    costo: 100,
    texto:
      'La cadena de custodia es un documento que certifica quién tocó la prueba. Cuando la prueba desaparece, el documento sobrevive. Es el único que sobrevive.',
  },
  {
    id: 'f03',
    titulo: 'Expediente 03 — Estado de excepción',
    costo: 200,
    texto:
      'Figura jurídica que suspende derechos por un plazo definido. El plazo se renueva. La definición, no.',
  },
  {
    id: 'f04',
    titulo: 'Expediente 04 — Falla técnica',
    costo: 300,
    texto:
      'Explicación oficial de cualquier interrupción cuyo momento resulte demasiado conveniente. Se aplica a sistemas eléctricos, sistemas de conteo y transmisiones en vivo.',
  },
  {
    id: 'f05',
    titulo: 'Expediente 05 — Campaña anticipada',
    costo: 400,
    texto:
      'Actividad proselitista realizada antes del plazo legal. Se sanciona con una multa que cuesta menos que un spot de treinta segundos.',
  },
  {
    id: 'f06',
    titulo: 'Expediente 06 — Fuente reservada',
    costo: 500,
    texto:
      'Persona que te cuenta lo que sabe a cambio de que nunca se sepa que lo sabe. El último recurso del periodismo y el primero que se persigue.',
  },
  {
    id: 'f07',
    titulo: 'Expediente 07 — Comisión investigadora',
    costo: 600,
    texto:
      'Grupo conformado para esclarecer un hecho. Su producto final es un informe. El destino del informe es otra comisión.',
  },
  {
    id: 'f08',
    titulo: 'Expediente 08 — Cerco perimetral',
    costo: 700,
    texto:
      'Perímetro de seguridad instalado para proteger una institución. Protege a la institución de las preguntas, principalmente.',
  },
  {
    id: 'f09',
    titulo: 'Expediente 09 — Vocería oficial',
    costo: 800,
    texto:
      'Formato de comunicación en el que se entrega información sin admitir preguntas. También llamado, en otros contextos, comunicado.',
  },
  {
    id: 'f10',
    titulo: 'Expediente 10 — Archivo definitivo',
    costo: 1000,
    texto:
      'Última etapa de todo caso relevante. No implica que se haya resuelto: implica que se dejó de contar. Por eso corres.',
  },
];

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
