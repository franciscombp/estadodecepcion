// ============================================================================
// ESCENARIOS — Definición de los cuatro tramos y el mapa del loop infinito
// ============================================================================
//
// El loop es un rombo. Desde cada escenario puedes ir a dos vecinos, o seguir
// de frente hacia la "institución" (que dispara la ruleta):
//
//              ┌─── BAHÍA ───┐
//              │             │
//         ELECCIONES ──┼── APAGÓN
//              │             │
//              └─ CARONDELET ┘
//
// ============================================================================

export const ESCENARIOS = {
  // -------------------------------------------------------------------------
  bahia: {
    id: 'bahia',
    nombre: 'LA BAHÍA',
    subtitulo: 'Donde todo se vende, hasta el silencio',
    tema: 'corrupción',

    // Paleta propia del escenario. Todos parten del vaporwave tropical base
    // pero cada uno vira hacia un dominante distinto para que se distingan
    // de un vistazo.
    colores: {
      nieblaLejos: 0x1a2438,
      nieblaCerca: 0x2a3550,
      calle: 0x161c30,
      acento: 0xffcf3f,      // Dorado mercado
      props: 0xc9884a,       // Madera / toldos
      luzAmbiente: 0x4a5578,
      luzDireccional: 0xffd9a0,
      intensidadAmbiente: 0.75,
      intensidadDireccional: 1.0,
    },

    // Ítem de estamina propio del escenario.
    estamina: {
      nombre: 'Encebollado',
      descripcion: 'Cura el chuchaqui y la desesperanza',
      color: 0xff8c42,
    },

    // Etiquetas de los obstáculos, para el HUD y los mensajes de choque.
    obstaculos: {
      saltar: 'Barricada',
      agachar: 'Bomba lacrimógena',
      esquivar: 'Policía coimero',
      doble: 'Retén',
    },

    // Tipos de evidencia que suelta este escenario.
    evidencia: ['USB sin cadena de custodia', 'Chat del grupo "Los Panas"', 'Video de vigilancia', 'Acta borroneada'],

    // Densidad de recolectables: la Bahía es generosa, es donde se aprende.
    densidadPapeles: 1.0,

    // Bifurcación de frente.
    institucion: {
      nombre: 'FISCALÍA',
      probabilidadExito: 0.20,
      textoExito: 'La denuncia entró. Alguien, en algún piso, la leyó.',
      textoFracaso: 'El expediente se traspapeló. Como siempre. Como todos.',
    },

    // Vecinos del rombo.
    rutas: { izquierda: 'elecciones', derecha: 'apagon' },
  },

  // -------------------------------------------------------------------------
  apagon: {
    id: 'apagon',
    nombre: 'EL APAGÓN',
    subtitulo: 'Cuatro horas diarias de patriotismo forzado',
    tema: 'crisis energética',

    colores: {
      nieblaLejos: 0x05070d,
      nieblaCerca: 0x0d1220,
      calle: 0x0a0d18,
      acento: 0x4fd1ff,      // Azul eléctrico
      props: 0x3a4258,
      luzAmbiente: 0x1a2030,
      luzDireccional: 0x6688aa,
      intensidadAmbiente: 0.28,   // Deliberadamente oscuro
      intensidadDireccional: 0.35,
    },

    estamina: {
      nombre: 'Linterna',
      descripcion: 'Batería china, esperanza nacional',
      color: 0xffe066,
    },

    obstaculos: {
      saltar: 'Tubería',
      agachar: 'Cable de alta tensión',
      esquivar: 'Generador ATM',
      doble: 'Turbina varada',
    },

    evidencia: ['Contrato con sobreprecio', 'Audio del ministro', 'Chat del gabinete', 'Informe técnico ignorado'],

    densidadPapeles: 0.8,

    // MECÁNICA ESPECIAL: la pantalla se oscurece. Las linternas de estamina
    // amplían el radio de visión además de recuperar energía.
    mecanicaEspecial: 'oscuridad',
    oscuridad: {
      radioBase: 16,       // Distancia visible sin linterna.
      radioConLinterna: 40,
      duracionLinterna: 9, // Segundos de visión ampliada por linterna.
    },

    institucion: {
      nombre: 'ASAMBLEA NACIONAL',
      probabilidadExito: 0.30,
      textoExito: 'Se aprobó una comisión. La comisión pidió un informe.',
      textoFracaso: 'Se fue la luz en plena votación. Qué casualidad tan puntual.',
    },

    rutas: { izquierda: 'bahia', derecha: 'carondelet' },
  },

  // -------------------------------------------------------------------------
  elecciones: {
    id: 'elecciones',
    nombre: 'LAS ELECCIONES',
    subtitulo: 'Campaña anticipada, conteo retrasado',
    tema: 'cooptación del CNE',

    colores: {
      nieblaLejos: 0x1a1230,
      nieblaCerca: 0x2d1f4a,
      calle: 0x181228,
      acento: 0xff5fa2,      // Magenta de propaganda
      props: 0x6b4a9e,
      luzAmbiente: 0x554070,
      luzDireccional: 0xffb0d8,
      intensidadAmbiente: 0.8,
      intensidadDireccional: 1.1,
    },

    estamina: {
      nombre: 'Micrófono',
      descripcion: 'Tu canal de YouTube es el último medio libre',
      color: 0x7cffb2,
    },

    obstaculos: {
      saltar: 'Valla de ADN',
      agachar: 'Pancarta colgante',
      esquivar: 'Cartón de candidato',
      doble: 'Bus de simpatizantes',
    },

    evidencia: ['Prueba de campaña anticipada', 'Nómina con apellidos repetidos', 'Factura de publicidad fantasma', 'Acta con más votos que votantes'],

    densidadPapeles: 0.9,

    institucion: {
      nombre: 'CNE',
      probabilidadExito: 0.25,
      textoExito: 'Impugnación admitida. Se resolverá después de la posesión.',
      textoFracaso: 'El sistema se cayó justo en tu mesa. Vuelva mañana.',
    },

    rutas: { izquierda: 'carondelet', derecha: 'bahia' },
  },

  // -------------------------------------------------------------------------
  carondelet: {
    id: 'carondelet',
    nombre: 'CARONDELET',
    subtitulo: 'El centro histórico amaneció cercado',
    tema: 'censura de prensa',

    colores: {
      nieblaLejos: 0x2a0f14,
      nieblaCerca: 0x3d1a20,
      calle: 0x1c1218,
      acento: 0xff4f6d,      // Rojo represión
      props: 0x5a4238,
      luzAmbiente: 0x6a4048,
      luzDireccional: 0xffa090,
      intensidadAmbiente: 0.65,
      intensidadDireccional: 0.9,
    },

    estamina: {
      nombre: 'Canelazo',
      descripcion: 'Calienta el cuerpo, no la valentía',
      color: 0xffa94d,
    },

    obstaculos: {
      saltar: 'Decreto ejecutivo',
      agachar: 'Concertina',
      esquivar: 'Militar',
      doble: 'Tanqueta',
    },

    evidencia: ['Orden de allanamiento sin firma', 'Lista de periodistas vigilados'],

    // Carondelet es árido: casi no hay qué documentar. Es el punto del juego.
    densidadPapeles: 0.25,
    maximoPapelesPorTramo: 3,

    // AQUÍ NO HAY BIFURCACIÓN DE FRENTE. Ir de frente es perder.
    institucion: null,
    frenteEsMuerte: true,
    textoFrente: 'Cruzaste el cerco. No hubo ruleta, no hubo trámite, no hubo nada.',

    rutas: { izquierda: 'elecciones', derecha: 'apagon' },
  },
};

// Orden de aparición para el primer arranque y para el selector.
export const ORDEN_ESCENARIOS = ['bahia', 'apagon', 'elecciones', 'carondelet'];

/** Devuelve la configuración de un escenario por su id. */
export function obtenerEscenario(id) {
  return ESCENARIOS[id] ?? ESCENARIOS.bahia;
}
