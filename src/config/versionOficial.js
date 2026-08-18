// ============================================================================
// LA VERSIÓN OFICIAL — qué pasa con lo que te plantaron
// ============================================================================
//
// EL MATERIAL PLANTADO NO SE PIERDE: CAMBIA DE MANOS.
//
// Hasta ahora, recoger una prueba falsa era un castigo mudo. La metías en la
// mochila creyendo que servía, al contrastarla salía el sello de NO SE
// SOSTIENE y ahí se acababa: una casilla tachada. El chiste estaba, pero se
// quedaba a medias, porque en la realidad que este juego satiriza el material
// plantado no desaparece —se publica—.
//
// Aquí es donde se cierra. Cada pieza plantada que recoges aparece en el
// Archivo bajo LO QUE DICE EL GOBIERNO: el titular con el que un medio afín
// convirtió esa misma pieza en la explicación oficial del caso. Tú corriste,
// te la colaron, y al día siguiente sale en portada de otro.
//
// Y funciona en las dos direcciones: es la única sección del periódico que se
// llena por equivocarte, así que verla crecer es la forma más clara de
// entender qué acaba de pasar.
//
// ---------------------------------------------------------------------------
// POR QUÉ ESTO NO ESTÁ EN publicaciones.js
// ---------------------------------------------------------------------------
// Porque aquello es periodismo REAL —reportajes publicados de verdad, con su
// firma y su enlace— y su regla de la casa dice que ahí no entra nada
// inventado: «un reportaje falso con pinta de real es exactamente lo que este
// juego critica». Estos titulares son justo eso, inventados, y por eso viven
// en otro archivo y se pintan con otra piel. Que no se puedan confundir NO es
// un detalle de maquetación: es la línea que separa la sátira de aquello de lo
// que se ríe.
//
// ---------------------------------------------------------------------------
// LOS MEDIOS SON INVENTADOS, Y ES UNA DECISIÓN
// ---------------------------------------------------------------------------
// El juego ya trabaja así: el periódico del jugador es EL MERCIO, que es un
// guiño y no un medio real. Sus rivales siguen la misma convención.
//
// Decir de un medio REAL que está comprado es una acusación de hecho sobre una
// organización que existe, y eso es de otra categoría que satirizar un caso
// que está en el expediente público. Si la redacción decide poner nombres
// reales, es su decisión editorial y se cambia AQUÍ, en una línea: los
// titulares no mencionan a nadie más.
// ============================================================================

/**
 * Los medios afines. Archetipos, no organizaciones: el nombre de cada uno ya
 * dice de qué lado está, que es la mitad del chiste.
 */
export const MEDIOS = {
  vocero: { nombre: 'EL VOCERO', tipo: 'Diario' },
  cadena: { nombre: 'RADIO CADENA NACIONAL', tipo: 'Radio' },
  data: { nombre: 'DATA PATRIA', tipo: 'Portal' },
};

/**
 * Qué se publicó con cada pieza plantada.
 *
 * La clave es el NOMBRE EXACTO de la prueba falsa, tal como está en
 * `config/escenarios.js`. Si allí se renombra una y aquí no, la pieza se
 * recoge y no aparece nada: hay una comprobación al arrancar que lo avisa por
 * consola (ver `comprobarVersionOficial`).
 */
export const VERSION_OFICIAL = {
  // --- Elecciones ---------------------------------------------------------
  'Acta "corregida" a mano': {
    medio: 'vocero',
    titular: 'El acta se corrigió por un error de digitación, aclara el organismo',
    bajada: 'La corrección consta en el sistema y no altera el resultado, '
      + 'según la explicación entregada esta tarde.',
  },
  'Captura de pantalla sin metadatos': {
    medio: 'data',
    titular: 'Circula una imagen sin verificar; especialistas piden prudencia',
    bajada: 'El archivo no conserva datos de origen. Fuentes consultadas '
      + 'recomiendan no difundirlo hasta contar con la versión completa.',
  },

  // --- Estado de excepción ------------------------------------------------
  'Denuncia anónima sin respaldo': {
    medio: 'cadena',
    titular: 'Denuncia anónima carece de sustento, señalan fuentes del caso',
    bajada: 'No se adjuntó documentación. El trámite continúa por la vía '
      + 'administrativa correspondiente.',
  },
  'Audio editado': {
    medio: 'vocero',
    titular: 'El audio que circula fue editado, confirma un peritaje',
    bajada: 'El informe técnico identifica cortes en la grabación difundida '
      + 'en redes durante el fin de semana.',
  },
};

/** La ficha de publicación de una pieza plantada, o null si no la hay. */
export function publicacionDe(nombre) {
  const entrada = VERSION_OFICIAL[nombre];
  if (!entrada) return null;
  return { ...entrada, medio: MEDIOS[entrada.medio] ?? MEDIOS.vocero };
}

/**
 * Avisa si alguna prueba falsa se quedó sin su titular.
 *
 * Un desajuste aquí no rompe nada —la pieza simplemente no aparece en la
 * sección— y por eso hace falta el aviso: un fallo silencioso en una tabla de
 * nombres se descubre meses después, cuando alguien se pregunta por qué esa
 * pieza nunca sale publicada.
 */
export function comprobarVersionOficial(escenarios) {
  const huerfanas = [];
  for (const esc of Object.values(escenarios)) {
    for (const nombre of esc.pruebasFalsas ?? []) {
      if (!VERSION_OFICIAL[nombre]) huerfanas.push(nombre);
    }
  }
  if (huerfanas.length) {
    console.warn('[Versión oficial] Estas pruebas plantadas no tienen titular '
      + 'y no aparecerán en el Archivo:', huerfanas);
  }
  return huerfanas;
}
