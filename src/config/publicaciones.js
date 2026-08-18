// ============================================================================
// PUBLICACIONES — El periódico que vas armando
// ============================================================================
// El Archivo no es una lista de premios: es un ejemplar de El Mercio que el
// jugador monta página a página. Cada página cuesta papeles y trae reportajes
// REALES, publicados de verdad, con su firma y su enlace.
//
// El juego es sátira. El periódico que desbloqueas, no. Ese contraste es el
// remate de todo el proyecto.
//
// ⚠️ AVISO PARA EL EQUIPO DE EL MERCIO — HAY QUE RELLENAR ESTO
// ------------------------------------------------------------
// Los artículos vienen marcados con `pendiente: true` y sin titular. No
// inventé ninguno: un reportaje falso con pinta de real es exactamente lo que
// este juego critica, y bastaría una captura para que circulara como si El
// Mercio lo hubiera publicado.
//
// Mientras un artículo siga pendiente, el periódico lo maqueta como un hueco
// con su tema y el sello "EN PREPARACIÓN" —igual que un diario que reserva
// espacio para una pieza que aún no cierra.
//
// PARA CARGAR UN REPORTAJE REAL:
//   1. `pendiente: false`
//   2. Rellena titular, bajada, autoria, fecha y url con los datos reales
//   3. Si es la pieza principal de la página, déjale `destacado: true`
//
// Ejemplo ya relleno:
//
//   {
//     id: 'a01',
//     destacado: true,
//     pendiente: false,
//     tema: 'Contratación pública',
//     titular: 'El contrato que nadie firmó pero todos cobraron',
//     bajada: 'Seis meses de facturas a una empresa constituida tres días ' +
//             'antes del concurso.',
//     autoria: 'Redacción El Mercio',
//     fecha: '2025-03-14',
//     url: 'https://elmercio.com/el-contrato-que-nadie-firmo',
//   }
//
// REGLA DE LA CASA: si no tiene enlace comprobable, no entra.
// ============================================================================

/** Cabecera del ejemplar. Se pinta en la portada. */
export const CABECERA = {
  nombre: 'EL MERCIO',
  lema: 'La verdad, aunque duela — y suele',
  edicion: 'Edición especial',
  precio: 'Gratis para quien corre',
  sitio: 'elmercio.com',
};

export const PAGINAS = [
  // -------------------------------------------------------------------------
  {
    numero: 1,
    nombre: 'Portada',
    seccion: 'Primera plana',
    // LA PORTADA ES EL CASO PORSCHE. Era la única página sin `caso`, así que
    // las pistas de la Bahía no tenían dónde publicarse: se recogían, se
    // guardaban y no abrían nada. Ahora los cuatro escenarios tienen su
    // página, que es lo que cierra el círculo del juego —corres, recoges,
    // publicas—.
    caso: 'bahia',
    costo: 0, // Se abre sola al terminar la primera partida.
    articulos: [
      {
        id: 'a01',
        destacado: true,
        pendiente: true,
        tema: 'Contratación pública y sobreprecios',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
      {
        id: 'a02',
        pendiente: true,
        tema: 'Cadena de custodia y pruebas desaparecidas',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
      {
        id: 'a03',
        pendiente: true,
        tema: 'Qué se sabe del caso y qué sigue sin saberse',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    numero: 2,
    nombre: 'Energía',
    seccion: 'El apagón',
    // Se arma con PRUEBAS del caso, no comprándola con evidencia suelta.
    // El Apagón suelta cuatro tipos distintos; con dos ya hay reportaje.
    caso: 'apagon',
    pruebas: 2,
    costo: 150,
    articulos: [
      {
        id: 'a04',
        destacado: true,
        pendiente: true,
        tema: 'Contratos de generación eléctrica',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
      {
        id: 'a05',
        pendiente: true,
        tema: 'Los informes técnicos que advirtieron el apagón',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    numero: 3,
    nombre: 'Política',
    seccion: 'Las elecciones',
    caso: 'elecciones',
    pruebas: 2,
    costo: 300,
    articulos: [
      {
        id: 'a06',
        destacado: true,
        pendiente: true,
        tema: 'Campaña anticipada y gasto electoral',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
      {
        id: 'a07',
        pendiente: true,
        tema: 'Nombramientos y parentescos en el CNE',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    numero: 4,
    nombre: 'Derechos',
    seccion: 'Carondelet',
    // Carondelet solo suelta dos tipos de prueba: hacen falta los dos.
    caso: 'carondelet',
    pruebas: 2,
    costo: 500,
    articulos: [
      {
        id: 'a08',
        destacado: true,
        pendiente: true,
        tema: 'Estado de excepción: alcance y prórrogas',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
      {
        id: 'a09',
        pendiente: true,
        tema: 'Restricciones al ejercicio periodístico',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    numero: 5,
    nombre: 'Seguimiento',
    seccion: 'La última',
    // El seguimiento no es de un caso: cruza todos. Seis pruebas de
    // cualquiera de ellos, que es media investigación completa.
    caso: null,
    pruebas: 6,
    costo: 800,
    articulos: [
      {
        id: 'a10',
        destacado: true,
        pendiente: true,
        tema: 'Qué pasó con los casos que abrimos',
        titular: '', bajada: '', autoria: '', fecha: '', url: '',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------------------------

/** Todos los artículos de todas las páginas, aplanados. */
export function todosLosArticulos() {
  return PAGINAS.flatMap((p) => p.articulos);
}

/** ¿Queda algo por rellenar? Lo usa el periódico para avisar al equipo. */
export function hayPendientes() {
  return todosLosArticulos().some((a) => a.pendiente);
}

/** Cuántos artículos están ya cargados con datos reales. */
export function cuantosListos() {
  return todosLosArticulos().filter((a) => !a.pendiente).length;
}

/** Busca una página por su número. */
export function obtenerPagina(numero) {
  return PAGINAS.find((p) => p.numero === numero) ?? null;
}
