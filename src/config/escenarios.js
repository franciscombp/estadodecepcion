// ============================================================================
// ESCENARIOS — Las cuatro escenas y el mapa del loop
// ============================================================================
// Ver docs/GUION.md: este archivo es la traducción a datos de aquel guion, y
// si los dos no coinciden manda el guion.
//
// El loop es un rombo. Desde cada escena puedes ir a dos vecinas, o seguir de
// frente hacia SU ente de control:
//
//              ┌─── BAHÍA ───┐
//              │  (Fiscalía) │
//         ELECCIONES ──┼── APAGÓN
//            (CNE)     │  (Asamblea)
//              └─ CENTRO HISTÓRICO ┘
//                   (Carondelet)
//
// LO QUE COMPARTEN Y LO QUE NO
// Las cuatro escenas usan la misma mecánica de aguante: si no recoges, vas
// lento y te alcanzan. Lo que cambia es QUÉ recoges, y eso no es decoración.
// En la Bahía corres y te da hambre; en la central térmica no comes, alumbras.
// Misma regla, ficción distinta.
// ============================================================================

export const ESCENARIOS = {
  // -------------------------------------------------------------------------
  bahia: {
    id: 'bahia',
    nombre: 'LA BAHÍA',
    subtitulo: 'Donde todo se vende, hasta el silencio',
    tema: 'corrupción',
    // Rótulo del caso que se documenta aquí. Es el nombre con el que la prensa
    // lo nombra; lo que el jugador recoge dentro son objetos genéricos.
    caso: 'CASO PORCHE',

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

    // Aguante. Correr da hambre, así que aquí se come.
    estamina: {
      nombre: 'Comida',
      etiqueta: 'COMIDA',
      icono: 'encebollado',
      items: [
        { modelo: 'encebollado', nombre: 'Encebollado', color: 0xff8c42 },
        { modelo: 'guata', nombre: 'Guata', color: 0xd9542a },
        { modelo: 'bolon', nombre: 'Bolón', color: 0xc9a34a },
      ],
    },

    // Etiquetas de los obstáculos, para el HUD y los mensajes de choque.
    obstaculos: {
      saltar: 'Puesto de ropa',
      agachar: 'Toldo de electrodomésticos',
      esquivar: 'Militar',
      doble: 'Retén',
    },

    // Tipos de evidencia que suelta este escenario.
    evidencia: ['USB sin cadena de custodia', 'Chat del grupo "Los Panas"', 'Video de vigilancia', 'Acta borroneada'],

    // Densidad de recolectables: la Bahía es generosa, es donde se aprende.
    densidadPapeles: 1.0,

    // El ente de control al que lleva la boca del centro. Ver docs/GUION.md:
    // entrar no es un premio. Te riegan los papeles, recuperas lo que puedas,
    // y a la salida te dan con la puerta en las narices —pero sales con la
    // pieza que te faltaba del caso.
    institucion: {
      nombre: 'FISCALÍA',
      // Qué pasa al entrar, en una línea.
      entrada: 'Al cruzar la puerta se te riegan los papeles por todo el pasillo.',
      // El portazo de salida. Es el remate, y es siempre el mismo: no importa
      // cuánto recuperes.
      portazo: 'No contabas con evidencia suficiente. Se archiva el caso.',
      // Lo que sí te llevas. El trámite cuesta papeles y paga historia.
      hallazgo: 'Expediente del caso Porche',
      // Si recuperas TODO, cosa prácticamente imposible.
      textoExito: 'Los recogiste todos. Alguien, en algún piso, tuvo que leerlo.',
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
    caso: 'CASO PROGEN',

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

    // Aquí no se come: se alumbra. Las pilas van iluminadas porque esta es la
    // única escena donde el recolectable tiene que brillar por sí mismo —en el
    // resto basta con que destaque, aquí es que si no brilla no existe.
    estamina: {
      nombre: 'Pilas',
      etiqueta: 'PILAS',
      icono: 'linterna',
      items: [
        { modelo: 'pila', nombre: 'Pila', color: 0xffe066 },
      ],
      // El Apagón arranca a oscuras y la pila es lo único que abre la visión.
      // Entrar sin ninguna y esperar a que el generador suelte la primera a
      // los 150 m no era difícil: era injugable. Así que el tramo REGALA una
      // al entrar (se enciende sola) y siembra otra a la vista.
      regaloAlEntrar: true,
      distanciaSembrada: 70,
    },

    // LA ÚNICA ESCENA DONDE QUEDARSE SIN RECURSO MATA.
    // En las demás, quedarte sin aguante te vuelve lento y te acaban
    // alcanzando —una presión indirecta—. Aquí no: sin luz no ves por dónde
    // corres ni hay nada que documentar, así que la oscuridad total es derrota
    // directa. La compensación es el regalo de entrada y una siembra generosa.
    sinAguanteEsCaptura: true,
    textoSinAguante: 'Se apagó la linterna. Lo que pasó después no lo vio nadie.',

    obstaculos: {
      saltar: 'Tubería reventada',
      agachar: 'Cable de alta tensión',
      esquivar: 'Generador averiado',
      doble: 'Turbina varada',
    },

    evidencia: ['Contrato con sobreprecio', 'Audio del ministro', 'Chat del gabinete', 'Informe técnico ignorado'],

    densidadPapeles: 0.8,

    // MECÁNICA ESPECIAL: la pantalla se oscurece. Las linternas de estamina
    // amplían el radio de visión además de recuperar energía.
    mecanicaEspecial: 'oscuridad',
    oscuridad: {
      radioBase: 18,       // Distancia visible sin linterna.
      radioConLinterna: 52,
      duracionLinterna: 9, // Segundos de visión ampliada por linterna.
    },

    institucion: {
      nombre: 'ASAMBLEA NACIONAL',
      entrada: 'La comisión de fiscalización te riega los papeles «para revisarlos».',
      portazo: 'La comisión niega el juicio político por falta de votos.',
      hallazgo: 'Informe técnico del caso Progen',
      textoExito: 'Los recogiste todos. Hubo votos. Nadie se lo explica.',
    },

    rutas: { izquierda: 'bahia', derecha: 'carondelet' },
  },

  // -------------------------------------------------------------------------
  elecciones: {
    id: 'elecciones',
    nombre: 'LAS ELECCIONES',
    subtitulo: 'Campaña anticipada, conteo retrasado',
    tema: 'cooptación del CNE',
    caso: 'CASO ELECCIONES',

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
      etiqueta: 'MICRÓFONO',
      icono: 'microfono',
      items: [
        { modelo: 'microfono', nombre: 'Micrófono', color: 0x7cffb2 },
      ],
    },

    obstaculos: {
      saltar: 'Valla de campaña',
      agachar: 'Pancarta colgante',
      esquivar: 'Cartón del candidato',
      doble: 'Bus de simpatizantes',
    },

    evidencia: ['Prueba de campaña anticipada', 'Nómina con apellidos repetidos', 'Factura de publicidad fantasma', 'Acta con más votos que votantes'],

    densidadPapeles: 0.9,

    institucion: {
      nombre: 'CNE',
      entrada: 'Te piden los papeles «para cotejarlos» y acaban por el suelo.',
      portazo: 'Pierdes tus derechos políticos y de participación. '
        + 'Igual no importa: no ibas a ser candidato.',
      hallazgo: 'Acta con más votos que votantes',
      textoExito: 'Los recogiste todos. La impugnación entró. Se resolverá algún día.',
    },

    rutas: { izquierda: 'carondelet', derecha: 'bahia' },
  },

  // -------------------------------------------------------------------------
  carondelet: {
    id: 'carondelet',
    nombre: 'CENTRO HISTÓRICO',
    subtitulo: 'Amaneció cercado',
    tema: 'censura de prensa',
    caso: 'ESTADO DE EXCEPCIÓN',

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

    // Comida de la sierra, y el canelazo que además calienta.
    estamina: {
      nombre: 'Comida',
      etiqueta: 'COMIDA Y CANELAZO',
      icono: 'canelazo',
      items: [
        { modelo: 'canelazo', nombre: 'Canelazo', color: 0xffa94d },
        { modelo: 'mote', nombre: 'Mote', color: 0xf0e2c0 },
      ],
    },

    obstaculos: {
      saltar: 'Reja de contención',
      agachar: 'Alambre de púas',
      esquivar: 'Policía antimotines',
      doble: 'Tanqueta',
    },

    evidencia: ['Orden de allanamiento sin firma', 'Lista de periodistas vigilados'],

    // Carondelet es árido: casi no hay qué documentar. Es el punto del juego.
    densidadPapeles: 0.25,
    maximoPapelesPorTramo: 3,

    // AQUÍ NO HAY ENTE DE CONTROL. Carondelet está cercado: ir de frente es
    // estrellarse contra el cerco, sin trámite y sin trámite que negar.
    institucion: null,
    frenteEsMuerte: true,
    nombreFrente: 'CARONDELET',
    textoFrente: 'Cruzaste el cerco. No hubo trámite, no hubo papeleo, no hubo nada.',

    rutas: { izquierda: 'elecciones', derecha: 'apagon' },
  },
};

// Orden de aparición para el primer arranque y para el selector.
export const ORDEN_ESCENARIOS = ['bahia', 'apagon', 'elecciones', 'carondelet'];

/** Devuelve la configuración de un escenario por su id. */
export function obtenerEscenario(id) {
  return ESCENARIOS[id] ?? ESCENARIOS.bahia;
}
