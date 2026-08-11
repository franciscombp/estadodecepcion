// ============================================================================
// PUBLICACIONES — Los reportajes reales de El Mercio
// ============================================================================
// Lo que se desbloquea en el Archivo NO es ficción: son reportajes publicados
// de verdad. El juego es sátira, pero el premio por jugarlo es periodismo real.
// Esa es toda la idea.
//
// ⚠️ AVISO PARA EL EQUIPO DE EL MERCIO — HAY QUE RELLENAR ESTO
// ------------------------------------------------------------
// Las entradas de abajo son PLANTILLAS VACÍAS, marcadas con `pendiente: true`.
// No inventé titulares ni enlaces: un reportaje falso con pinta de real es
// exactamente lo que este juego critica, y bastaría una captura para que
// circulara como si El Mercio lo hubiera publicado.
//
// Mientras `pendiente` sea true, el Archivo muestra el hueco con su tema y un
// aviso de "por publicar" en vez de fingir contenido.
//
// PARA CARGAR UN REPORTAJE REAL:
//   1. Pon `pendiente: false`
//   2. Rellena titular, bajada, autoria, fecha y url con los datos reales
//   3. Ajusta `costo` si quieres cambiar cuántos papeles cuesta
//
// Ejemplo ya relleno:
//
//   {
//     id: 'p01',
//     escenario: 'bahia',
//     costo: 0,
//     pendiente: false,
//     titular: 'El contrato que nadie firmó pero todos cobraron',
//     bajada: 'Seis meses de facturas a una empresa constituida tres días antes del concurso.',
//     autoria: 'Redacción El Mercio',
//     fecha: '2025-03-14',
//     url: 'https://elmercio.com/el-contrato-que-nadie-firmo',
//   }
//
// REGLA DE LA CASA: si no tiene enlace comprobable, no entra.
// ============================================================================

export const PUBLICACIONES = [
  {
    id: 'p01',
    escenario: 'bahia',
    costo: 0, // Gratis: es la primera, se abre sola al terminar una partida.
    pendiente: true,
    tema: 'Contratación pública y sobreprecios',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p02',
    escenario: 'bahia',
    costo: 100,
    pendiente: true,
    tema: 'Cadena de custodia y pruebas desaparecidas',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p03',
    escenario: 'apagon',
    costo: 200,
    pendiente: true,
    tema: 'Crisis eléctrica: contratos de generación y responsables',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p04',
    escenario: 'apagon',
    costo: 300,
    pendiente: true,
    tema: 'Informes técnicos que advirtieron el apagón',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p05',
    escenario: 'elecciones',
    costo: 400,
    pendiente: true,
    tema: 'Campaña anticipada y gasto electoral',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p06',
    escenario: 'elecciones',
    costo: 500,
    pendiente: true,
    tema: 'Nombramientos y parentescos en el CNE',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p07',
    escenario: 'carondelet',
    costo: 600,
    pendiente: true,
    tema: 'Estado de excepción: alcance y prórrogas',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p08',
    escenario: 'carondelet',
    costo: 800,
    pendiente: true,
    tema: 'Restricciones al ejercicio periodístico',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
  {
    id: 'p09',
    escenario: 'carondelet',
    costo: 1000,
    pendiente: true,
    tema: 'Seguimiento: qué pasó con los casos que abrimos',
    titular: '',
    bajada: '',
    autoria: '',
    fecha: '',
    url: '',
  },
];

/** Publicaciones ya cargadas con datos reales. */
export function publicacionesListas() {
  return PUBLICACIONES.filter((p) => !p.pendiente);
}

/** ¿Queda algo por rellenar? Lo usa el Archivo para avisar al equipo. */
export function hayPendientes() {
  return PUBLICACIONES.some((p) => p.pendiente);
}

/** Busca una publicación por su id. */
export function obtenerPublicacion(id) {
  return PUBLICACIONES.find((p) => p.id === id) ?? null;
}
