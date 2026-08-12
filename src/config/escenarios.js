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
// Las cuatro comparten mecánica: correr, esquivar, recoger papeles y aguantar
// de pie. Lo que cambia es la piel, el caso que se documenta y el ente de
// control al que lleva la boca del centro.
//
// La comida —encebollado, guata, bolón, canelazo— YA NO ESTÁ. Era un bonus
// suelto que sumaba papeles y nada más: ni drenaba, ni había medidor, ni
// pasaba nada por ignorarla, así que lo único que hacía era competir por el
// hueco del grupo con lo que sí importa, que son los potenciadores. Lo que
// queda de aquello es la linterna, que dejó de ser comida para ser EL
// potenciador del Apagón.
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
    caso: 'CASO PORSCHE',

    // Paleta propia del escenario. Todos parten del vaporwave tropical base
    // pero cada uno vira hacia un dominante distinto para que se distingan
    // de un vistazo.
    //
    // LA BAHÍA ES DE DÍA, y es la más clara de las cuatro. Dos motivos, y los
    // dos mandan sobre el gusto por el nocturno:
    //
    //   · El Apagón tiene que ser EL escenario oscuro. Si las otras tres
    //     tiran a noche, quedarse sin luz no es un acontecimiento: es un poco
    //     más de lo mismo. El apagón se nota contra la luz, no contra otra
    //     penumbra.
    //   · Un mercado popular es un sitio diurno. Se abre a las siete, se
    //     cierra al caer el sol, y las fotos del sector son todas de un
    //     mediodía nublado y blanco.
    colores: {
      nieblaLejos: 0x7d97ae,   // Cielo de mediodía nublado guayaquileño
      nieblaCerca: 0x93aabd,
      calle: 0x4c5058,         // Asfalto gris, no azul de noche
      acento: 0xffcf3f,        // Dorado mercado
      props: 0xc9884a,         // Madera / toldos
      luzAmbiente: 0xaec4da,
      luzDireccional: 0xfff2d8,
      intensidadAmbiente: 1.35,
      intensidadDireccional: 1.85,
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
      // EL RELATO. Es el texto de la pantalla que para el juego al entrar y al
      // salir del trámite, y es donde se explica de qué va esta fase.
      //
      // Se escribe en SEGUNDA PERSONA y sobre lo que te pasa a ti: qué haces,
      // qué te dicen, qué te devuelven. Nunca una acusación concreta contra
      // nadie ni una frase entrecomillada de nadie —ver la regla editorial en
      // docs/GUION.md—. Lo satírico está en el trámite, no en el señalado.
      //
      // Los saltos de línea separan párrafos.
      relatoEntrada:
        'Llevas semanas juntando papeles del caso Porsche y hoy vienes a '
        + 'entregarlos. Pediste cita tres veces; a la tercera te dieron una '
        + 'para dentro de mes y medio y te presentaste igual.\n'
        + 'En recepción te piden que lo pases todo por la banda. La carpeta '
        + 'no está cerrada. Nadie te avisa.',
      relatoSalida:
        'Recogiste lo que alcanzaste antes de que cerraran el turno. El '
        + 'funcionario numera lo que le entregas, sella una copia y te la '
        + 'devuelve con la fecha de hoy.\n'
        + 'Es lo único que te llevas con un sello: la prueba de que estuviste '
        + 'aquí. Lo demás sigue en el suelo del pasillo.',
      // Qué pasa al entrar, en una línea.
      entrada: 'Al cruzar la puerta se te riegan los papeles por todo el pasillo.',
      // El portazo de salida. Es el remate, y es siempre el mismo: no importa
      // cuánto recuperes.
      portazo: 'No contabas con evidencia suficiente. Se archiva el caso.',
      // Lo que sí te llevas. El trámite cuesta papeles y paga historia.
      hallazgo: 'Expediente del caso Porsche',
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
      // Deliberadamente oscuro, y ahora la comparación es de verdad: las
      // otras tres escenas están entre 1.15 y 1.35 de ambiente, así que
      // entrar aquí divide la luz por cinco de golpe. Antes la diferencia
      // era de 0.75 a 0.28 y el apagón se leía como "un poco más de noche".
      intensidadAmbiente: 0.24,
      intensidadDireccional: 0.3,
    },

    // El tramo arranca CON la linterna encendida. Entrar a oscuras y esperar
    // a que el generador suelte la primera cápsula no era difícil, era
    // injugable. Cuando se apaga, lo que queda para orientarse son los
    // papeles, que aquí brillan.
    linternaAlEntrar: true,

    // Y los papeles brillan, y atraviesan la niebla. Es lo único que se ve
    // cuando la linterna se apaga: la hilera marca la ruta aunque no se vea la
    // calle. Ver Coin.aplicarTema.
    papelesBrillan: true,

    obstaculos: {
      saltar: 'Tubería reventada',
      agachar: 'Cable de alta tensión',
      esquivar: 'Generador averiado',
      doble: 'Turbina varada',
    },

    evidencia: ['Contrato con sobreprecio', 'Audio del ministro', 'Chat del gabinete', 'Informe técnico ignorado'],

    densidadPapeles: 0.8,

    // MECÁNICA ESPECIAL: la pantalla se oscurece. El potenciador linterna
    // abre el radio de visión mientras dura.
    mecanicaEspecial: 'oscuridad',
    oscuridad: {
      radioBase: 18,       // Distancia visible sin linterna.
      radioConLinterna: 52,
      duracionLinterna: 11, // Solo es el respaldo: manda la del potenciador.
    },

    institucion: {
      nombre: 'ASAMBLEA NACIONAL',
      relatoEntrada:
        'La comisión de fiscalización aceptó recibirte. Traes los informes '
        + 'técnicos que ya circulaban antes de los cortes y una lista de '
        + 'fechas que no cuadran con las versiones oficiales.\n'
        + 'Te hacen pasar a una sala con la mesa ocupada. Alguien dice «déjelo '
        + 'ahí» y señala un sitio donde no cabe.',
      relatoSalida:
        'La sesión se levanta por falta de quórum antes de que llegues al '
        + 'segundo punto. Se te acerca un asesor, te pide una copia «a título '
        + 'personal» y se la das.\n'
        + 'Sales con la parte del informe que alcanzaste a recoger. Nadie te '
        + 'firmó nada, pero el papel es el mismo.',
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

    // Tarde de cierre de campaña: el sol ya baja pero todavía hay luz de
    // sobra. Sube respecto al nocturno anterior por lo mismo que la Bahía:
    // el Apagón es el escenario oscuro, y solo hay uno.
    colores: {
      nieblaLejos: 0x594a80,
      nieblaCerca: 0x7a63a8,
      calle: 0x39304f,
      acento: 0xff5fa2,      // Magenta de propaganda
      props: 0x8a68c4,
      luzAmbiente: 0x9a86c0,
      luzDireccional: 0xffc8e4,
      intensidadAmbiente: 1.3,
      intensidadDireccional: 1.55,
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
      relatoEntrada:
        'Vienes a pedir las actas. Las públicas, las que por ley se entregan '
        + 'a quien las pida, y llevas el formulario lleno desde hace once '
        + 'días.\n'
        + 'En la ventanilla te dicen que el sistema está en mantenimiento y '
        + 'que mejor las cotejen contigo. Te piden la carpeta. Se resbala.',
      relatoSalida:
        'Cotejaron lo que quedaba encima del mostrador y te lo devolvieron sin '
        + 'sellar. El resto sigue desparramado y ya llamaron al de limpieza.\n'
        + 'Te llevas un acta con más votos que votantes. La tienes tú, no '
        + 'ellos, y esa es toda la diferencia.',
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

    // Amanecer con el cerco puesto. Es el más apagado de los tres claros
    // —está bien que el toque de queda pese— pero sigue muy por encima del
    // Apagón: aquí se ve la calle, allí no.
    colores: {
      nieblaLejos: 0x6b4038,
      nieblaCerca: 0x8c564a,
      calle: 0x40323a,
      acento: 0xff4f6d,      // Rojo represión
      props: 0x8a6754,
      luzAmbiente: 0xb08078,
      luzDireccional: 0xffc0aa,
      intensidadAmbiente: 1.15,
      intensidadDireccional: 1.35,
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
