// ============================================================================
// GUION — Todo lo que el juego DICE, en un solo sitio
// ============================================================================
//
// QUÉ ES ESTO
// -----------
// El texto de las pantallas y de los avisos estaba escrito dentro del código
// que los pinta: para cambiar un titular había que abrir `ui/screens.js`,
// encontrar la línea entre mil ochocientas y no romper nada al lado. Eso
// convierte una decisión editorial —que es de quien escribe— en un cambio de
// programación.
//
// Aquí está el guion entero, agrupado por pantalla, y cada entrada lleva su
// ayuda para saber dónde sale. `ui/screens.js` pide los textos por su
// identificador (`T('portada.titular')`) y no sabe qué dicen.
//
// CÓMO SE EDITA SIN TOCAR CÓDIGO
// ------------------------------
// En `/creador/pantallas/` está el editor: enseña este mismo guion en una
// lista de campos, deja probarlo en vivo y baja un `guion.json`. Ese archivo
// se deja en `public/contenido/guion.json` y a partir de ahí manda sobre lo
// que hay escrito abajo. Lo que no esté en el JSON se queda como está aquí:
// no hay que copiar el guion entero para cambiar una línea.
//
// Orden de prioridad, de más fuerte a menos:
//   1. Lo guardado en este navegador desde el editor (prueba en vivo).
//   2. public/contenido/guion.json (lo que se publica).
//   3. Lo escrito en este archivo (lo que siempre funciona).
//
// REGLAS DE LA CASA
// -----------------
// · Los huecos van entre llaves: `{lugar}`, `{caso}`, `{n}`. Si un texto
//   nuevo no trae el hueco que el código le pasa, no pasa nada: se queda sin
//   rellenar, no se rompe la pantalla.
// · Lo que va *entre asteriscos* sale en negrita. Es el único formato: no hay
//   HTML en el guion, precisamente para que nadie pueda inyectarlo desde el
//   editor.
// · Un texto vacío ('') esconde el elemento. Sirve para quitar una bajada sin
//   tener que tocar el código que la pinta.
// ============================================================================

// ---------------------------------------------------------------------------
// EL GUION
// ---------------------------------------------------------------------------
// Cada grupo es una pantalla. `_nombre` es cómo se llama en el editor y
// `_nota` explica cuándo se ve. Cada entrada: `t` es el texto, `ayuda` dice
// dónde sale y `largo` marca los que necesitan una caja de varias líneas.
export const GUION = {
  portada: {
    _nombre: 'Portada',
    _nota: 'La primera pantalla, la que se ve al abrir el juego.',
    titular: {
      t: 'Presidente Roy declara estado de excepción indefinido',
      ayuda: 'El titular grande, en serif. Es la premisa del juego, no el nivel.',
      largo: true,
    },
    epigrafe: {
      t: '¿Qué está intentando ocultar el oficialismo?',
      ayuda: 'La bajada, debajo del titular.',
    },
    // Tal como está en el Figma, incluido el crédito con barra: «El Tostadólogo
    // investiga el Caso Porche en LA BAHIA. / Foto: EL MERCIO.» Decía
    // «Periodista de EL MERCIO./investiga el caso…», que junta el crédito con
    // la frase y deja al protagonista sin nombre.
    pieFoto: {
      t: 'El {personaje} investiga el {caso} en {lugar}. / Foto: EL MERCIO.',
      ayuda: 'Pie de la foto. Huecos: {personaje}, {caso}, {lugar}.',
      largo: true,
    },
    jugar: { t: 'Toca para investigar', ayuda: 'El botón rojo, el principal.' },
    // Los tres del Figma: Redacción · Ranking · Ajustes. Llevan a las mismas
    // pantallas de siempre (el periódico y la tabla), que en la maqueta se
    // llaman así —los marcos son «Pruebas/redacción» y «Pruebas/ranking».
    archivo: { t: 'Redacción', ayuda: 'Botón secundario izquierdo: lleva al periódico.' },
    marcadores: { t: 'Ranking', ayuda: 'Botón secundario del medio: lleva a la tabla.' },
    ajustes: { t: 'Ajustes', ayuda: 'Botón secundario derecho.' },
  },

  pausa: {
    _nombre: 'Pausa',
    _nota: 'Al tocar el botón de pausa durante la corrida.',
    seccion: { t: 'PAUSA', ayuda: 'La etiqueta de sección, arriba.' },
    antetitulo: { t: 'EN PAUSA', ayuda: 'El antetítulo, encima del titular.' },
    titular: { t: 'Respira', ayuda: 'El titular.' },
    bajada: {
      t: 'La rotativa espera. Nadie te está persiguiendo mientras esto esté abierto.',
      ayuda: 'El texto bajo el titular.',
      largo: true,
    },
    seguir: { t: 'Seguir corriendo', ayuda: 'Botón principal.' },
    abandonar: { t: 'Abandonar la corrida', ayuda: 'Botón secundario.' },
  },

  captura: {
    _nombre: 'Fin de partida',
    _nota: 'La primera plana que sale al perder.',
    titularAlcanzado: { t: 'Te alcanzaron a media cuadra', ayuda: 'Titular: te atrapó el perseguidor.' },
    titularExhausto: { t: 'El periodista ya no daba más', ayuda: 'Titular: se acabó la estamina.' },
    titularCerco: { t: 'Cruzó el cerco y no volvió a salir', ayuda: 'Titular: chocaste contra el cerco.' },
    titularGenerico: { t: 'Se acabó la cobertura', ayuda: 'Titular de repuesto.' },
    rotuloEvidencia: { t: 'EVIDENCIA RECOLECTADA', ayuda: 'Encima de la cifra grande.' },
    // Del marco 89:1025, literal. Es el único hueco de voz propia que la
    // maqueta dibuja en esta página; el remate por escenario que había debajo
    // no está dibujado y se quitó.
    bajada: {
      t: 'Sin visitas, sin llamadas y sin abogado los primeros días. Después ya no hacía falta.',
      ayuda: 'El texto bajo el titular. Lo sustituye la sentencia cuando hubo sorteo de juez.',
      largo: true,
    },
    resumen: {
      t: '{distancia}m recorridos・{evidencia} evidencia total',
      ayuda: 'La línea de datos bajo la cifra. Huecos: {distancia}, {evidencia}.',
    },
    altFoto: { t: 'Momento de la detención', ayuda: 'Texto alternativo de la foto, para lectores de pantalla.' },
    sinFoto: {
      t: 'Sin fotografía',
      ayuda: 'Sello del hueco cuando la captura del arresto no se pudo tomar. Ocupa el sitio de la foto para que la portada no se quede a medias.',
    },
    sinFotoPie: {
      t: 'No se autorizó el registro gráfico de la detención.',
      ayuda: 'Pie del hueco sin foto.',
      largo: true,
    },
    pieFoto: {
      t: 'Momento de la detención en *{lugar}*.',
      ayuda: 'Pie de la foto del arresto. Hueco: {lugar}.',
      largo: true,
    },
    fichaje: { t: 'FICHAJE EN LA REDACCIÓN', ayuda: 'Cuando se desbloquea un personaje.' },
    potenciador: { t: 'POTENCIADOR NUEVO', ayuda: 'Cuando se desbloquea un potenciador.' },
  },

  botin: {
    _nombre: 'Pruebas',
    _nota: 'El expediente que se arma con lo recogido, al terminar la corrida.',
    seccion: { t: './resumen', ayuda: 'Lo que sigue al punto de EL MERCIO, en rojo.' },
    siguiente: { t: 'Siguiente', ayuda: 'Botón rojo: sigue al ranking.' },
    caso: { t: 'Caso {caso}', ayuda: 'El caso investigado. Hueco: {caso}.' },
    estadoAbierto: { t: 'Investigación iniciada', ayuda: 'Cuando la corrida deja material.' },
    estadoVacio: { t: 'Investigación bloqueada', ayuda: 'Cuando no se recogió nada útil.' },
    destinoPlantada: {
      t: 'Mañana sale en {medio}',
      ayuda: 'Al abrir una prueba plantada: qué medio afín la va a publicar. Hueco: {medio}.',
    },
    sinConfirmar: {
      t: 'Sin confirmar',
      ayuda: 'Marca de las pistas que solo están en redes: se guardan pero no cierran un reportaje.',
    },
  },

  victoria: {
    _nombre: 'Denuncia presentada',
    _nota: 'Cuando la corrida termina bien.',
    seccion: { t: 'PORTADA', ayuda: 'La etiqueta de sección.' },
    titularCorto: { t: 'SE PRESENTÓ LA DENUNCIA', ayuda: 'Sección alternativa.' },
    titular: { t: 'La denuncia prosperó', ayuda: 'El titular.' },
    conEvidencia: {
      t: 'Te tiraron el expediente por el suelo y lo recogiste entero: {n} papeles, sin que falte uno. No sabemos cómo lo lograste, pero lo lograste.',
      ayuda: 'Bajada con evidencia. Hueco: {n}.',
      largo: true,
    },
    sinEvidencia: {
      t: 'No sabemos cómo lo lograste, pero lo lograste.',
      ayuda: 'Bajada cuando se llega sin evidencia.',
      largo: true,
    },
    ruta: { t: 'RUTA DE ESTA CORRIDA', ayuda: 'Encabeza el mapa del recorrido.' },
    archivo: { t: 'Archivo de El Mercio', ayuda: 'Botón secundario que lleva al periódico.' },
  },

  sorteo: {
    _nombre: 'Sorteo del juez',
    _nota: 'La tómbola que decide quién lleva tu causa.',
    seccion: { t: 'JUDICIALES', ayuda: 'La etiqueta de sección.' },
    titular: { t: 'TE RODEARON', ayuda: 'El titular.' },
    bajada: {
      t: 'Se sortea el juez que llevará tu causa',
      ayuda: 'Debajo del titular.',
    },
    instruccion: {
      t: 'Cinco son del gobierno y salen en morado. Para la ventana en el verde.',
      ayuda: 'La regla del minijuego, antes de girar.',
      largo: true,
    },
    ganaSeccion: { t: 'MEDIDAS SUSTITUTIVAS', ayuda: 'Sección si sale bien.' },
    pierdeSeccion: { t: 'LE TOCÓ UNO DE ELLOS', ayuda: 'Sección si sale mal.' },
    gana: {
      t: 'Sales caminando y con la orden de no salir del país. Sigue corriendo.',
      ayuda: 'Remate si sale bien.',
      largo: true,
    },
    pierde: {
      t: 'La sentencia sale mañana en primera plana.',
      ayuda: 'Remate si sale mal.',
      largo: true,
    },
    parar: { t: 'Toca para parar', ayuda: 'El botón que detiene la tómbola.' },
    opinion: { t: 'OPINIÓN', ayuda: 'Etiqueta de la nota al pie.' },
    nota: {
      t: 'Cinco de los seis ya están repartidos antes de empezar. No te sientas mal si no tienes suerte.',
      ayuda: 'La nota al pie del sorteo.',
      largo: true,
    },
  },

  relato: {
    _nombre: 'Bifurcación',
    _nota: 'La pantalla entre escenarios, al elegir por dónde seguir.',
    seccion: { t: 'CONTEXTO', ayuda: 'La etiqueta de sección.' },
    entra: { t: 'ENTRAS AL TRÁMITE', ayuda: 'Titular al empezar un escenario nuevo.' },
    termina: { t: 'SE ACABÓ EL PASILLO', ayuda: 'Titular al cerrar un escenario.' },
    delSuelo: { t: 'Del suelo', ayuda: 'Etiqueta de la evidencia recogida.' },
    ahiQuedo: { t: 'Ahí quedaron', ayuda: 'Etiqueta de lo que se perdió.' },
    multiplicador: { t: 'Al marcador ×{mult}', ayuda: 'Hueco: {mult}.' },
    salvado: { t: 'PERO SALES CON ALGO', ayuda: 'Cuando algo se salva.' },
    entrar: { t: 'ENTRAR', ayuda: 'Botón al empezar.' },
    seguir: { t: 'SEGUIR CORRIENDO', ayuda: 'Botón al continuar.' },
  },

  marcadores: {
    _nombre: 'Ranking',
    _nota: 'La tabla de posiciones. Al perder solo sale si esa corrida te subió de puesto.',
    seccion: { t: './ranking', ayuda: 'Lo que sigue al punto de EL MERCIO, en rojo.' },
    antetitulo: { t: 'Los mejores investigadores', ayuda: 'El antetítulo rojo, sobre el titular.' },
    descanso: { t: 'Tomar un descanso', ayuda: 'Botón negro: vuelve a la portada.' },
    renombrar: { t: 'Cambiar nombre', ayuda: 'Botón de contorno. También se toca la propia fila.' },
  },

  comunes: {
    _nombre: 'Botones compartidos',
    _nota: 'Salen en varias pantallas. Cambiarlos aquí los cambia en todas.',
    reintentar: { t: 'Volver a investigar', ayuda: 'Botón principal de fin de partida y de la tabla.' },
    menu: { t: 'Ir al menú principal', ayuda: 'Vuelve a la portada.' },
    continuar: { t: 'Toca para continuar', ayuda: 'Avanza entre las pantallas de cierre.' },
    borrar: { t: 'Borrar progreso', ayuda: 'En Ajustes y en el Archivo.' },
    borrarConfirma: { t: '¿Seguro? Pulsa otra vez', ayuda: 'El mismo botón, tras el primer toque.' },
  },

  ajustes: {
    _nombre: 'Ajustes',
    _nota: 'Controles, personaje y borrado de progreso.',
    seccion: { t: 'REDACCIÓN', ayuda: 'La etiqueta de sección.' },
    titularCorto: { t: 'CÓMO SE USA ESTE EJEMPLAR', ayuda: 'Sección alternativa.' },
    titular: { t: 'La redacción', ayuda: 'El titular.' },
    bajada: {
      t: 'Controles, edición y el botón de tirarlo todo a la basura',
      ayuda: 'Debajo del titular.',
      largo: true,
    },
    grupoPersonajes: { t: 'LA REDACCIÓN', ayuda: 'Encabeza la fila de personajes.' },
    grupoArsenal: { t: 'EL ARSENAL', ayuda: 'Encabeza los potenciadores.' },
    grupoControles: { t: 'CONTROLES', ayuda: 'Encabeza los controles.' },
    grupoEdicion: { t: 'EDICIÓN', ayuda: 'Encabeza la versión y el offline.' },
    descargo: {
      t: 'Sátira política de El Mercio. Los personajes y textos son ficción y no reproducen declaraciones de personas reales.',
      ayuda: 'El descargo legal. Piénsalo dos veces antes de tocarlo.',
      largo: true,
    },
    fichaje: { t: 'Se ficha a los {tramos} tramos', ayuda: 'Personaje aún cerrado. Hueco: {tramos}.' },
    arsenalCompleto: {
      t: 'Arsenal completo. Ahora solo queda el expediente perfecto.',
      ayuda: 'Cuando están todos los potenciadores.',
      largo: true,
    },
    salir: { t: 'ESC o el botón', ayuda: 'Cómo se sale de la pausa.' },
  },

  edicion: {
    _nombre: 'Versión y offline',
    _nota: 'El bloque de estado del service worker, dentro de Ajustes.',
    desarrollo: { t: 'edición de desarrollo', ayuda: 'Cuando se corre en local.' },
    explicacion: {
      t: 'Se comprueba al abrir y cada hora. La edición nueva entra sola: al arrancar, o al terminar la corrida si estabas jugando.',
      ayuda: 'Cómo funcionan las actualizaciones.',
      largo: true,
    },
    sinSoporte: { t: 'Sin modo offline en este navegador', ayuda: 'Estado: no hay service worker.' },
    preparando: { t: 'Guardando el juego para jugar sin conexión…', ayuda: 'Estado: descargando.' },
    listo: { t: 'Listo para jugar sin conexión', ayuda: 'Estado: cacheado entero.' },
    buscando: { t: 'Buscando edición nueva…', ayuda: 'Estado: comprobando.' },
    disponible: { t: 'Hay una edición nueva. Toca para instalarla', ayuda: 'Estado: hay versión nueva.' },
  },

  archivo: {
    _nombre: 'Archivo',
    _nota: 'El periódico con los reportajes reales.',
    progreso: {
      t: 'Redacción: {listos} de {total} reportajes cargados.',
      ayuda: 'SOLO EN DESARROLLO. Recado para quien monta el juego, no para el jugador: cuántos reportajes reales quedan por cargar. Huecos: {listos}, {total}.',
    },
    explicacion: {
      t: 'Los huecos se rellenan en src/config/publicaciones.js con titular, autoría, fecha y enlace reales. El periódico reserva el espacio, pero no inventa la pieza.',
      ayuda: 'SOLO EN DESARROLLO. Nombra una ruta de código a propósito: es la instrucción para la redacción. En la versión publicada no aparece.',
      largo: true,
    },
    sinAlmacenamiento: {
      t: 'Tu navegador tiene el almacenamiento bloqueado (suele pasar en modo privado). Puedes jugar igual, pero el ejemplar no se guardará.',
      ayuda: 'Aviso cuando localStorage no va.',
      largo: true,
    },
    paginasAbiertas: { t: '{n} pág. recuperadas', ayuda: 'Hueco: {n}.' },
    pagina: { t: 'Pág. {n}', ayuda: 'Hueco: {n}.' },
    reservado: { t: 'ESPACIO RESERVADO', ayuda: 'Artículo aún no publicado.' },
    enPreparacion: {
      t: 'Reportaje en preparación. Cuando se publique aparecerá aquí, con su firma y su enlace.',
      ayuda: 'Debajo del espacio reservado.',
      largo: true,
    },
    leer: { t: 'Leer el reportaje completo →', ayuda: 'El enlace al reportaje.' },
    sinRecuperar: { t: 'PÁGINA SIN RECUPERAR', ayuda: 'Página aún cerrada.' },
    versionOficial: {
      t: 'Lo que dice el gobierno',
      ayuda: 'Rótulo de la sección que recoge lo publicado con el material plantado.',
    },
    versionOficialNota: {
      t: 'Cada pieza que te colaron terminó publicada. Estos titulares son ficción; el resto del Archivo, no.',
      ayuda: 'La aclaración de la sección. Ojo antes de tocarla: es lo que evita que los recortes inventados se confundan con los reportajes reales.',
      largo: true,
    },
    versionOficialOrigen: {
      t: 'Salió de: {pieza}',
      ayuda: 'De qué pieza plantada salió el titular. Hueco: {pieza}.',
    },
    yaPuedes: {
      t: 'Ya tienes con qué. Sale al terminar la próxima corrida.',
      ayuda: 'Cuando hay pruebas de sobra para abrirla.',
      largo: true,
    },
    sumarioRotulo: {
      t: 'Expediente · {caso}',
      ayuda: 'Rótulo del sumario, arriba de la página abierta. Es lo que evita que el expediente se confunda con la pieza publicada. Hueco: {caso}.',
    },
    sumarioAviso: {
      t: 'Esto es el expediente: lo que está documentado hasta ahora. No es el reportaje; el reportaje va debajo, cuando se publique.',
      ayuda: 'La aclaración del sumario. Ojo antes de tocarla: es lo que separa el expediente del reportaje firmado.',
      largo: true,
    },
    sumarioEstado: { t: 'Cómo está', ayuda: 'Etiqueta de la línea de estado del caso.' },
    sumarioPapeles: {
      t: 'Lo que recuperaste · {n} de {total}',
      ayuda: 'Encabeza la lista de documentos del caso. Huecos: {n}, {total}.',
    },
    sumarioFaltan: {
      t: 'Lo tachado sigue en la calle. Sale en {lugar}.',
      ayuda: 'Debajo de la lista, cuando queda algo por recoger. Hueco: {lugar}.',
      largo: true,
    },
    sumarioRedes: {
      t: 'solo en redes',
      ayuda: 'Marca de una pista sin documento detrás. No cierra reportaje.',
    },
    sumarioSeguimiento: {
      t: 'La última',
      ayuda: 'Rótulo del sumario de la página 5, que cruza los cuatro casos.',
    },
    sumarioSeguimientoAviso: {
      t: 'En qué quedó cada caso que abrimos, y cuánto llegó a documentarse.',
      ayuda: 'La entradilla de la página de seguimiento.',
      largo: true,
    },
    comoAbrir: {
      t: 'Cada caso tiene sus propias pruebas y solo salen en su barrio. Recógelas aunque te capturen: lo recogido se queda.',
      ayuda: 'Cómo se abren las páginas.',
      largo: true,
    },
  },

  marca: {
    _nombre: 'Marca',
    _nota: 'La cabecera del diario. Sale en casi todas las pantallas.',
    nombre: { t: 'EL MERCIO', ayuda: 'La mancheta. Ojo: sale en todas partes.' },
    lema: { t: 'El Mercio', ayuda: 'La firma pequeña del pie.' },
  },
};

// ---------------------------------------------------------------------------
// LO QUE MANDA SOBRE EL GUION
// ---------------------------------------------------------------------------
// Un objeto plano `{'portada.titular': 'otro texto'}`. Plano y no anidado a
// propósito: así el editor guarda solo lo que se cambió y una entrada nueva
// en el guion de arriba aparece sola, sin tener que regenerar el JSON.
const CLAVE_LOCAL = 'mercio-guion';

let sobrescrito = Object.create(null);

/** Lee lo guardado en este navegador. Si no hay o está roto, devuelve nada. */
function deEsteNavegador() {
  try {
    const crudo = localStorage.getItem(CLAVE_LOCAL);
    if (!crudo) return null;
    const leido = JSON.parse(crudo);
    return leido && typeof leido === 'object' ? leido : null;
  } catch {
    return null;
  }
}

/**
 * Carga el guion publicado y el de prueba, en ese orden. Se llama una vez, al
 * arrancar. Nunca falla: si el JSON no está o está roto se sigue con lo
 * escrito en este archivo, que es lo que garantiza que el juego hable siempre.
 */
export async function cargarGuion(base = '/') {
  try {
    const respuesta = await fetch(`${base}contenido/guion.json`, { cache: 'no-cache' });
    if (respuesta.ok) {
      const publicado = await respuesta.json();
      if (publicado && typeof publicado === 'object') {
        Object.assign(sobrescrito, aplanar(publicado));
      }
    }
  } catch {
    // Sin JSON publicado. Es el caso normal.
  }

  const local = deEsteNavegador();
  if (local) Object.assign(sobrescrito, aplanar(local));

  return sobrescrito;
}

/**
 * Acepta tanto `{'portada.titular': '…'}` como `{portada: {titular: '…'}}`:
 * el editor escribe lo primero y una edición a mano tiende a lo segundo.
 */
function aplanar(objeto, prefijo = '', salida = Object.create(null)) {
  for (const [clave, valor] of Object.entries(objeto)) {
    if (clave.startsWith('_')) continue;
    const ruta = prefijo ? `${prefijo}.${clave}` : clave;
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      // `{t: '…'}` es una entrada del guion, no un grupo.
      if (typeof valor.t === 'string') salida[ruta] = valor.t;
      else aplanar(valor, ruta, salida);
    } else if (typeof valor === 'string') {
      salida[ruta] = valor;
    }
  }
  return salida;
}

/** Cambia el guion en caliente. Lo usa el editor a través del iframe. */
export function aplicarGuion(objeto) {
  sobrescrito = aplanar(objeto || {});
  return sobrescrito;
}

// ---------------------------------------------------------------------------
// PEDIR UN TEXTO
// ---------------------------------------------------------------------------

/** Busca `portada.titular` dentro de GUION y devuelve su `t`, o null. */
function porDefecto(ruta) {
  let nodo = GUION;
  for (const tramo of ruta.split('.')) {
    if (!nodo || typeof nodo !== 'object') return null;
    nodo = nodo[tramo];
  }
  return nodo && typeof nodo.t === 'string' ? nodo.t : null;
}

/**
 * El texto de `ruta`, con los huecos rellenos.
 *
 * Si la ruta no existe devuelve la ruta misma en vez de una cadena vacía: un
 * `portada.titualr` mal escrito se ve en pantalla y se arregla, mientras que
 * un hueco en blanco pasa desapercibido hasta que alguien lo reporta.
 */
export function T(ruta, datos = null) {
  const crudo = ruta in sobrescrito ? sobrescrito[ruta] : porDefecto(ruta);
  if (crudo == null) return ruta;
  if (!datos) return crudo;

  return crudo.replace(/\{(\w+)\}/g, (entero, clave) =>
    (clave in datos ? String(datos[clave]) : entero));
}

/**
 * Igual que T(), pero devuelve nodos para que *lo entre asteriscos* salga en
 * negrita. Devuelve un DocumentFragment listo para appendChild.
 *
 * Se pasa por nodos de texto y `<b>`, nunca por innerHTML: el guion puede
 * venir de un JSON editado fuera del repositorio y no tiene por qué poder
 * meter etiquetas.
 */
export function Trico(ruta, datos = null) {
  const texto = T(ruta, datos);
  const trozo = document.createDocumentFragment();
  let resto = texto;
  let corte;

  while ((corte = resto.match(/\*([^*]+)\*/))) {
    if (corte.index > 0) trozo.appendChild(document.createTextNode(resto.slice(0, corte.index)));
    const fuerte = document.createElement('b');
    fuerte.textContent = corte[1];
    trozo.appendChild(fuerte);
    resto = resto.slice(corte.index + corte[0].length);
  }
  if (resto) trozo.appendChild(document.createTextNode(resto));

  return trozo;
}

// ---------------------------------------------------------------------------
// PARA EL EDITOR
// ---------------------------------------------------------------------------

/**
 * El guion entero en forma de lista, con el valor efectivo de cada entrada.
 * Es lo que pinta `/creador/pantallas/`.
 */
export function guionPlano() {
  const grupos = [];
  for (const [idGrupo, grupo] of Object.entries(GUION)) {
    const entradas = [];
    for (const [clave, entrada] of Object.entries(grupo)) {
      if (clave.startsWith('_')) continue;
      const ruta = `${idGrupo}.${clave}`;
      entradas.push({
        ruta,
        original: entrada.t,
        valor: ruta in sobrescrito ? sobrescrito[ruta] : entrada.t,
        ayuda: entrada.ayuda || '',
        largo: !!entrada.largo,
        huecos: [...new Set([...entrada.t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))],
      });
    }
    grupos.push({
      id: idGrupo,
      nombre: grupo._nombre || idGrupo,
      nota: grupo._nota || '',
      entradas,
    });
  }
  return grupos;
}

/** Solo lo que difiere del guion escrito en este archivo. */
export function guionCambiado() {
  const salida = {};
  for (const [ruta, valor] of Object.entries(sobrescrito)) {
    if (valor !== porDefecto(ruta)) salida[ruta] = valor;
  }
  return salida;
}

export const CLAVE_GUION = CLAVE_LOCAL;
