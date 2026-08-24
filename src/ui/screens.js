// ============================================================================
// PANTALLAS — Menú, escape, victoria, game over, periódico y pausa
// ============================================================================
// Cada pantalla es un método que devuelve un elemento DOM. El gestor
// `Pantallas` monta una y desmonta la anterior.
//
// Convención: los textos se escriben siempre con textContent, nunca
// interpolados dentro de innerHTML. Vienen de nuestra configuración, pero es
// más barato mantener la costumbre que auditar cada vez.
//
// AQUÍ NO SE ESCRIBE TEXTO. Lo que dicen las pantallas vive en
// `config/guion.js` y se pide con `T('portada.titular')`. Este archivo decide
// la MAQUETA —qué caja va dónde, con qué clase— y el guion decide las
// PALABRAS. Sirve para dos cosas: cambiar un titular deja de ser un cambio de
// código, y el editor de `/creador/pantallas/` puede enseñarlos todos juntos.
// Cuando haga falta un texto nuevo, se añade allí y se pide desde aquí.
//
// Estilo en docs/ESTILO.md.
// ============================================================================

import { obtenerEscenario, ORDEN_ESCENARIOS, ESCENARIOS } from '../config/escenarios.js';
import { publicacionDe } from '../config/versionOficial.js';
import { T, Trico } from '../config/guion.js';
import { CABECERA, PAGINAS, hayPendientes, cuantosListos } from '../config/publicaciones.js';
import { CATALOGO_POTENCIADORES } from '../config/balance.js';
import { CLASIFICACIONES, clasificacion, tablaCompleta, hayAscenso, YO } from '../config/tabla.js';
import { PERSONAJES } from '../config/personajes.js';
import { Notebook } from '../game/Notebook.js';
import * as Icono from './iconos.js';

// ---------------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------------

function el(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

/**
 * «CASO PORSCHE» → «Caso Porsche». Los nombres de caso se guardan en versales
 * porque el HUD los pinta así; en un pie de foto o en un cuerpo de texto, las
 * versales se leen como un grito.
 */
// Las palabras que en español NO llevan mayúscula dentro de un titular. Sin
// esta lista «ESTADO DE EXCEPCIÓN» salía «Estado De Excepción», que es cómo
// escribe los títulos el inglés y no cómo se escriben aquí.
const ATONAS = new Set([
  'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'e', 'el',
  'en', 'entre', 'hacia', 'hasta', 'la', 'las', 'lo', 'los', 'o', 'para',
  'por', 'según', 'sin', 'sobre', 'tras', 'u', 'un', 'una', 'y',
]);

function cajaDeTitular(texto) {
  return texto.toLocaleLowerCase('es')
    .replace(/(^|\s)(\p{L}+)/gu, (entero, espacio, palabra) =>
      espacio + (espacio && ATONAS.has(palabra)
        ? palabra
        : palabra[0].toLocaleUpperCase('es') + palabra.slice(1)));
}

function boton(texto, clase, alPulsar) {
  const b = el('button', `boton ${clase ?? ''}`.trim(), texto);
  b.type = 'button';
  b.addEventListener('click', alPulsar);
  return b;
}

/**
 * LA MARCA DEL DIARIO, como la dibuja el Figma: «EL MERCIO» en Montserrat
 * negra con el punto en rojo. En portada el punto es solo el punto; en las
 * secciones interiores crece a «./judiciales», como un dominio. Una sola
 * función para que ninguna página invente su propia cabecera.
 *
 * @param {string} [seccion] Nombre de sección, o nada para la portada
 * @param {boolean} [portada] Marca a toda plana
 */
function cabeceraMarca(seccion = null, portada = false) {
  const cab = el('header', 'plana__cabecera');
  const marca = el('span', `plana__marca${portada ? ' plana__marca--portada' : ''}`);
  marca.appendChild(document.createTextNode(T('marca.nombre')));
  // La portada no lleva sección: su punto es solo el punto. Se compara contra
  // el guion y no contra la palabra escrita aquí, para que renombrar la
  // sección desde el constructor no deje la mancheta diciendo «./portada».
  const sufijo = seccion && seccion !== T('victoria.seccion')
    ? `./${seccion.toLowerCase()}`
    : '.';
  marca.appendChild(el('span', 'plana__marca-seccion', sufijo));
  cab.appendChild(marca);
  return cab;
}

/** Cabecera con el sello de El Mercio. */
function marca(texto = T('marca.nombre')) {
  const m = el('div', 'marca');
  const sello = el('span', 'marca__sello');
  sello.innerHTML = Icono.sello(34);
  m.appendChild(sello);
  m.appendChild(document.createTextNode(texto));
  return m;
}

function pantallaBase() {
  const pantalla = el('div', 'pantalla');
  const contenido = el('div', 'pantalla__contenido');
  pantalla.appendChild(contenido);
  return { pantalla, contenido };
}

/**
 * UNA SECCIÓN DEL PERIÓDICO. La maqueta que comparten todas las pantallas que
 * no son la corrida.
 *
 * Antes había dos mundos: el juego y sus menús iban de neón sobre negro, y el
 * papel crema salía solo en el Archivo y en la primera plana del final. Eso
 * dejaba al periódico como una pantalla más en vez de como lo que es —el sitio
 * al que va a parar todo lo que recoges—, y encima obligaba a mantener dos
 * sistemas de estilo para las mismas cuatro cosas: un título, un cuerpo de
 * texto y unos botones.
 *
 * Ahora TODO lo que no es correr sale impreso, y cada pantalla es una sección
 * con su nombre en la mancheta: los ajustes son ADMINISTRACIÓN, la pausa es
 * ÚLTIMA HORA, el juez es JUDICIALES, la tabla es DEPORTES. El chiste se cuenta
 * solo: estás dentro del periódico incluso cuando estás toqueteando el volumen.
 *
 * El cuerpo de la pantalla se cuelga de `plana` —va sobre papel— y los botones
 * de `contenido`, fuera de la hoja, porque un botón dibujado encima del papel
 * se lee como un anuncio y no como algo que se pulsa.
 */
function seccionDiario({ seccion, antetitulo, titular, bajada, clase }) {
  const { pantalla, contenido } = pantallaBase();
  pantalla.classList.add('pantalla--plana');
  if (clase) pantalla.classList.add(clase);

  const plana = el('div', 'plana');

  plana.appendChild(cabeceraMarca(seccion));

  if (antetitulo) plana.appendChild(el('div', 'plana__antetitulo', antetitulo));
  if (titular) plana.appendChild(el('h1', 'plana__titular plana__titular--tabla', titular));
  if (bajada) plana.appendChild(el('div', 'plana__epigrafe', bajada));

  contenido.appendChild(plana);
  return { pantalla, contenido, plana };
}

/**
 * LA BARRA DE LO QUE FALTA.
 *
 * Aquí había una línea de texto: «Fuente anónima a 2 tramos». Dice el dato y
 * no dice nada más — no se sabe si dos tramos es mucho o poco, ni cuánto
 * llevas, ni si estás cerca. Una barra que se llena sí: es la forma más vieja
 * que existe de convertir un número en una promesa, y es exactamente por eso
 * que la lleva puesta todo el género.
 *
 * El relleno NO se mide desde cero: se mide desde el escalón anterior. Con
 * cero como origen, el jugador que ya abrió el potenciador de los 15 y va a
 * por el de los 22 ve la barra al 68 % nada más desbloquear el anterior, y a
 * partir de ahí se mueve un dedo por partida. Entre escalón y escalón, la
 * barra recorre el ancho entero cada vez.
 *
 * @param {number} hechos   Tramos recorridos.
 * @param {?{nombre:string, tramos:number, faltan:number}} proximo
 * @param {Array<{tramos:number}>} catalogo Para saber de dónde viene el tramo.
 * @param {string} textoCompleto Qué decir cuando ya no queda nada por abrir.
 */
function barraDeProgreso(hechos, proximo, catalogo, textoCompleto) {
  const bloque = el('div', 'avance');

  if (!proximo) {
    bloque.appendChild(el('div', 'progreso-pie progreso-pie--completo', textoCompleto));
    return bloque;
  }

  const anteriores = catalogo
    .map((x) => x.tramos)
    .filter((t) => t <= hechos);
  const desde = anteriores.length ? Math.max(...anteriores) : 0;
  const tramo = Math.max(1, proximo.tramos - desde);
  const parte = Math.max(0, Math.min(1, (hechos - desde) / tramo));

  // LA BARRA ES LA DEL SISTEMA. `.progreso` con un `<span>` dentro es un
  // componente de `mal-ds`, con su carril, su relleno de marca y su transición
  // de ancho ya puestos; el juego tenía su propia versión con dos clases más y
  // una animación de entrada escrita a mano, que es exactamente el tipo de
  // duplicado que este cambio viene a quitar.
  //
  // El ancho se escribe en cero y se sube en el fotograma siguiente: así el
  // relleno CRECE con la transición del propio sistema en vez de aparecer ya
  // puesto, que es la diferencia entre un dato y un progreso.
  const carril = el('div', 'progreso');
  const relleno = el('span');
  relleno.style.width = '0';
  carril.appendChild(relleno);
  bloque.appendChild(carril);
  requestAnimationFrame(() => { relleno.style.width = `${(parte * 100).toFixed(1)}%`; });

  bloque.appendChild(el('div', 'progreso-pie', T('ajustes.faltanTramos', {
    nombre: proximo.nombre,
    n: proximo.faltan,
    tramos: proximo.faltan === 1 ? T('ajustes.tramoSingular') : T('ajustes.tramoPlural'),
  })));
  return bloque;
}

/** Ladillo: el rótulo que separa bloques dentro de una sección impresa. */
function ladillo(texto) {
  return el('div', 'plana__seccion', texto);
}

/**
 * Numera los hijos de un contenedor para que entren EN CASCADA.
 *
 * Toda la pantalla apareciendo a la vez se lee como un cambio de diapositiva;
 * entrando de arriba abajo con cuarenta milisegundos entre pieza se lee como
 * algo que se está montando delante de ti, y el ojo va siguiendo. Es el truco
 * más barato que existe para que una pantalla se sienta viva, y solo cuesta
 * una variable CSS por hijo.
 *
 * El retardo se corta a los ocho elementos: más allá, quien llega el último
 * aparece medio segundo tarde y eso ya no es cascada, es esperar.
 */
function escalonar(contenedor, desde = 0) {
  [...contenedor.children].forEach((hijo, i) => {
    hijo.style.setProperty('--i', String(Math.min(desde + i, 8)));
    hijo.classList.add('en-cascada');
  });
  return contenedor;
}

/**
 * Cuenta desde cero hasta la cifra final.
 *
 * Un número que aparece ya puesto es un dato; un número que sube es un premio.
 * Es la misma razón por la que en cualquier juego de móvil el marcador nunca
 * se limita a aparecer, y aquí encima cae bien: lo que sube son los papeles
 * que costó recoger.
 *
 * Va con requestAnimationFrame y reloj real —no con una transición CSS— porque
 * lo que se anima es el TEXTO, y eso no se puede interpolar declarativamente.
 * Se corta sola si el elemento sale de pantalla antes de terminar.
 */
function contarHasta(nodo, valor, duracion = 900, formato = null) {
  const pinta = (n) => { nodo.textContent = formato ? formato(n) : n.toLocaleString('es-EC'); };
  if (valor <= 0) { pinta(0); return; }

  const arranque = performance.now();
  const paso = (ahora) => {
    if (!nodo.isConnected) return;
    const t = Math.min(1, (ahora - arranque) / duracion);
    // Desaceleración fuerte: sube de golpe y frena al final, que es donde el
    // ojo lee la cifra.
    const suave = 1 - (1 - t) ** 3;
    pinta(Math.round(valor * suave));
    if (t < 1) requestAnimationFrame(paso);
  };
  pinta(0);
  requestAnimationFrame(paso);
}

/** Rejilla de estadísticas. */
function estadisticas(pares) {
  const grid = el('div', 'estadisticas');
  for (const [valor, etiqueta] of pares) {
    const stat = el('div', 'estadistica');
    stat.appendChild(el('div', 'estadistica__valor', valor));
    stat.appendChild(el('div', 'estadistica__etiqueta', etiqueta));
    grid.appendChild(stat);
  }
  return grid;
}

// ---------------------------------------------------------------------------
// GESTOR
// ---------------------------------------------------------------------------

/**
 * AVISA DE QUE HAY MÁS ABAJO.
 *
 * Cuatro pantallas usan `.se-estira--desplazable` —ajustes, la bifurcación, la
 * victoria y el Archivo— y ninguna decía que se pudiera desplazar. En Ajustes,
 * que es la que más contenido lleva, quedaban ciento cincuenta y seis píxeles
 * por debajo del corte: el bloque de EDICIÓN salía partido por la mitad de un
 * renglón, con un borde duro, justo encima del botón de Volver. Eso no se lee
 * como «sigue abajo», se lee como que algo se rompió al dibujar.
 *
 * En un móvil no hay barra de desplazamiento que lo delate, así que hace falta
 * decirlo: mientras quede contenido por debajo, el borde inferior se desvanece.
 * Es la señal más vieja del oficio y no ocupa sitio.
 *
 * Se mide después de montar —antes no hay alturas— y se vuelve a mirar al
 * desplazar, al cambiar de tamaño y cuando el contenido cambia solo (el
 * Archivo se repinta entero al pasar de página).
 */
function marcarDesplazables(pantalla) {
  for (const caja of pantalla.querySelectorAll('.se-estira--desplazable')) {
    const revisar = () => {
      // Dos de margen: los redondeos de subpíxel dejan medio píxel de sobra en
      // cajas que están exactamente llenas, y sin holgura la sombra parpadea.
      const queda = caja.scrollHeight - caja.clientHeight - caja.scrollTop > 2;
      caja.classList.toggle('se-estira--hay-mas', queda);
    };

    caja.addEventListener('scroll', revisar, { passive: true });

    // El contenido cambia sin que cambie el tamaño de la caja: el Archivo
    // rehace su hoja al pasar de página, y Ajustes crece cuando llega el aviso
    // de versión nueva.
    const observador = new ResizeObserver(revisar);
    observador.observe(caja);
    for (const hijo of caja.children) observador.observe(hijo);

    pantalla.addEventListener('pantalla:desmontada',
      () => observador.disconnect(), { once: true });

    requestAnimationFrame(revisar);
  }
}

/**
 * TOCAR EN CUALQUIER PARTE PARA PASAR DE PÁGINA.
 *
 * Las pantallas que solo cuentan algo —el relato del tramo, la primera plana
 * del día siguiente, el recuento del botín— tenían un único botón al fondo, y
 * pedir puntería para un botón que solo puede hacer una cosa es pedir trabajo
 * por nada. Peor en el móvil: el botón vive abajo del todo, y si la página se
 * desplaza hay que leer, bajar, y recién ahí apuntar.
 *
 * El botón NO se quita, y esto es deliberado: es lo que dice QUÉ pasa al tocar
 * («Entrar», «Continuar», «Siguiente»). Lo que cambia es que la superficie de
 * pulsación pasa a ser la hoja entera.
 *
 * Tres cosas que hubo que resolver para que no dispare cuando no toca:
 *
 * 1. NO ROBA LOS CONTROLES QUE YA HAY. Si el toque cayó sobre un botón, un
 *    enlace o un campo —o dentro de algo marcado `data-sin-avance`, que es
 *    como una pestaña o un navegador de páginas se declara intocable— manda
 *    ese control y aquí no pasa nada. Sin esto, pulsar «Reintentar» en el
 *    botín disparaba además el «Siguiente».
 * 2. ARRASTRAR NO ES TOCAR. Estas páginas se desplazan, y un dedo que baja
 *    para seguir leyendo termina en un `click`. Se compara dónde empezó y
 *    dónde acabó el gesto: más de diez píxeles y no cuenta.
 * 3. NI PULSAR DOS VECES. Al pasar de pantalla el avance puede tardar un
 *    fotograma en desmontar esta, y dos toques seguidos encadenaban dos
 *    avances. Se cierra con una bandera.
 *
 * Y con el teclado, Enter o espacio: el juego se puede jugar entero sin tocar
 * la pantalla y estas páginas cortan el paso.
 */
function tocarParaAvanzar(pantalla, avanzar) {
  let gastado = false;
  let desde = null;

  pantalla.addEventListener('pointerdown', (e) => { desde = { x: e.clientX, y: e.clientY }; });

  pantalla.addEventListener('click', (e) => {
    if (gastado) return;
    if (e.target.closest('button, a, input, select, textarea, label, [data-sin-avance]')) return;
    if (desde) {
      const corrido = Math.hypot(e.clientX - desde.x, e.clientY - desde.y);
      desde = null;
      if (corrido > 10) return;
    }
    gastado = true;
    avanzar();
  });

  const teclado = (e) => {
    if (gastado) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // Si el foco está en un control, que lo resuelva el control.
    if (document.activeElement?.closest('button, a, input, select, textarea')) return;
    e.preventDefault();
    gastado = true;
    avanzar();
  };
  window.addEventListener('keydown', teclado);
  pantalla.addEventListener('pantalla:desmontada',
    () => window.removeEventListener('keydown', teclado), { once: true });
}

/**
 * La coletilla que avisa de lo anterior. Va bajo los botones, en gris y
 * pequeña: una superficie de pulsación que no se ve no existe, y esto es lo
 * más barato que la anuncia sin ocupar sitio.
 */
function pistaDeToque() {
  return el('div', 'pista-toque', T('comunes.tocaDonde'));
}

export class Pantallas {
  constructor(contenedor, juego, cuaderno, audio, actualizador = null) {
    this.contenedor = contenedor;
    this.juego = juego;
    this.cuaderno = cuaderno;
    this.audio = audio;
    // Puede ser null en desarrollo, donde no hay service worker.
    this.actualizador = actualizador;
    this.actual = null;
  }

  /**
   * Monta una pantalla encima de la partida.
   *
   * NO se captura el lienzo para hacer de fondo. Se intentó, y no podía
   * funcionar: el renderizador se crea sin `preserveDrawingBuffer`, así que el
   * buffer ya está vaciado cuando `toDataURL()` lo lee y lo que devuelve es un
   * rectángulo negro. El fondo lo pone el `backdrop-filter` de `.pantalla`,
   * que desenfoca el lienzo VIVO —el bucle sigue corriendo en los menús— y no
   * cuesta ni una lectura de GPU.
   */
  mostrar(elementoPantalla) {
    this.ocultar();
    this.actual = elementoPantalla;
    this.contenedor.appendChild(elementoPantalla);
    marcarDesplazables(elementoPantalla);
  }

  ocultar() {
    if (this.actual) {
      // Aviso a la pantalla saliente. El medidor de escape engancha un
      // listener en window y necesita saber cuándo soltarlo: si no, cada
      // captura deja uno vivo y a la tercera partida la barra se para sola con
      // cualquier tecla.
      this.actual.dispatchEvent(new CustomEvent('pantalla:desmontada'));
      this.actual.parentNode?.removeChild(this.actual);
    }
    this.actual = null;
  }

  // -------------------------------------------------------------------------
  // MENÚ PRINCIPAL
  // -------------------------------------------------------------------------

  menu() {
    const { pantalla, contenido } = pantallaBase();
    // LA PORTADA ES UNA PORTADA. Impresa, no un panel.
    //
    // Era la única pantalla del juego que seguía siendo interfaz de aplicación
    // —neón sobre negro, con la escena 3D de fondo—, mientras el Archivo, la
    // derrota, el juez y la pausa ya salían sobre papel. Esa excepción rompía
    // justo la idea que sostiene todo lo demás: que aquí lo que no es correr
    // sale IMPRESO, y que el juego entero es un ejemplar de El Mercio.
    //
    // La escena no se pierde: pasa a ser LA FOTO de la portada, dentro de su
    // recuadro y con su pie, que es como un periódico enseña una imagen. Antes
    // era el fondo y la interfaz se apartaba a los bordes para no taparla;
    // ahora está encuadrada, que le da más presencia y no menos.
    pantalla.classList.add('pantalla--plana', 'pantalla--portada');
    contenido.classList.add('portada');

    const esc = obtenerEscenario(this.juego.escenarioActual);

    // Quién sale a la calle. La ficha se elige en Ajustes; aquí hace falta
    // saberlo dos veces: para nombrarlo en el pie de la foto —el Figma titula
    // «El Tostadólogo investiga…», con nombre— y para saber a quién mandar
    // cuando se toque el botón de jugar.
    const abiertos = new Set(this.cuaderno.personajesDesbloqueados());
    const elegido = abiertos.has(this.cuaderno.personajePreferido)
      ? this.cuaderno.personajePreferido
      : PERSONAJES[0].id;

    const plana = el('div', 'plana plana--menu');
    // La hoja va en DOS bloques con un hueco entre medias, y no de una pieza,
    // porque por ese hueco tiene que verse la partida corriendo. Un papel de
    // una pieza es opaco por definición: la «ventana» quedaba tapada por su
    // propio fondo. Partido, el hueco es hueco de verdad —como el troquel de
    // una portada—, y las dos mitades siguen leyéndose como la misma página
    // porque comparten grano, filetes y márgenes.
    const bloqueAlto = el('div', 'plana__bloque');

    // ══ MANCHETA ════════════════════════════════════════════════════════
    bloqueAlto.appendChild(cabeceraMarca(null, true));

    // ══ TITULAR ═════════════════════════════════════════════════════════
    // LA PORTADA TITULA LA PREMISA, no el escenario.
    //
    // Decía «ESTADO DE EXCEPCIÓN: LA BAHÍA», que es un rótulo de selector de
    // nivel escrito en versalitas. Un periódico no titula dónde vas a jugar:
    // titula lo que pasó. El barrio no se pierde —va en el pie de la foto, que
    // es donde un diario dice dónde se tomó— y su lema titula la corrida en el
    // propio juego (ver el bloque del caso en el HUD).
    bloqueAlto.appendChild(el('h2', 'plana__titular plana__titular--menu',
      T('portada.titular')));
    bloqueAlto.appendChild(el('div', 'plana__epigrafe plana__epigrafe--menu',
      T('portada.epigrafe')));
    plana.appendChild(bloqueAlto);

    // ══ LA FOTO ═════════════════════════════════════════════════════════
    // El hueco por el que se ve la escena, ahora encuadrado como una foto de
    // prensa: filete, fondo transparente y pie debajo.
    const figura = el('figure', 'portada__foto se-estira');
    figura.appendChild(el('div', 'portada__hueco'));
    plana.appendChild(figura);

    // El pie de la foto, como lo maqueta el Figma: la escena en vivo es la
    // fotografía de prensa y lleva su crédito.
    const pie = el('div', 'portada__pie');
    // El caso va en caja de titular —«Caso Porsche», no «CASO PORSCHE»— como
    // en la maqueta. Los datos lo guardan en versales porque en el HUD sale
    // así, y un pie de foto en mayúsculas grita.
    pie.appendChild(Trico('portada.pieFoto', {
      personaje: PERSONAJES.find((p) => p.id === elegido)?.nombre ?? PERSONAJES[0].nombre,
      caso: cajaDeTitular(esc.caso),
      lugar: esc.nombre,
    }));

    const arriba = el('div', 'portada__arriba');
    plana.appendChild(arriba);
    contenido.appendChild(plana);

    // ══ BANDA INFERIOR ══════════════════════════════════════════════════
    const abajo = el('div', 'portada__abajo');
    abajo.appendChild(pie);

    // LA PORTADA NO ELIGE PERSONAJE NI ENSEÑA EL ARSENAL.
    //
    // Estaban las dos filas aquí —cuatro fichas de periodista y cinco casillas
    // de potenciador— y ninguna de las dos ayuda a empezar a jugar. La de
    // personajes es una decisión que se toma una vez cada muchas partidas; la
    // de potenciadores informa de cosas que caen solas y sobre las que el
    // jugador no decide nada mientras la mecánica no cambie. Entre las dos se
    // comían media portada y empujaban la foto y el titular fuera de sitio.
    //
    // El personaje se elige en Ajustes, que es donde vive lo que se cambia de
    // vez en cuando. Las dos funciones siguen aquí enteras: el día que los
    // potenciadores se compren, la tira vuelve a la portada con una línea.

    // --- Jugar -------------------------------------------------------------
    abajo.appendChild(boton(T('portada.jugar'), 'boton--diario boton--diario-principal boton--jugar-plana', () => {
      this.audio.iniciar();
      this.audio.reanudar();
      this.juego.iniciarPartida(elegido);
    }));

    // --- Secundarios -------------------------------------------------------
    const secundarios = el('div', 'portada__secundarios');
    secundarios.appendChild(boton(T('portada.archivo'), 'boton--diario', () => {
      this.mostrar(this.notebook());
    }));
    secundarios.appendChild(boton(T('portada.marcadores'), 'boton--diario', () => {
      this.mostrar(this.marcadores());
    }));
    secundarios.appendChild(boton(T('portada.ajustes'), 'boton--diario', () => {
      this.mostrar(this.ajustes());
    }));
    abajo.appendChild(secundarios);
    escalonar(abajo);



    // DENTRO del papel, no debajo. Fuera de la hoja se leían como una barra de
    // aplicación pegada a un dibujo de periódico, que es exactamente lo que el
    // resto de pantallas lleva evitando.
    arriba.parentNode.appendChild(abajo);
    return pantalla;
  }

  // -------------------------------------------------------------------------
  // MARCADORES
  // -------------------------------------------------------------------------
  // Es la MISMA página de deportes que sale al perder, sin los datos de la
  // partida: mismas tres pestañas y mismo papel. Tener dos tablas distintas
  // —una desde el menú y otra al perder— era mantener dos maquetas para lo
  // mismo, y a la segunda ya no coincidían.

  marcadores() {
    return this.deportes(null);
  }

  // -------------------------------------------------------------------------
  // AJUSTES
  // -------------------------------------------------------------------------
  // Lo que antes colgaba del final del menú y lo alargaba: la chuleta de
  // controles, el panel de edición y el borrado de progreso.
  //
  // Va impreso como el resto: es la página de ADMINISTRACIÓN, la que en un
  // diario de verdad lleva el staff, el número de depósito legal y a quién
  // reclamar. Aquí lleva los controles y qué edición estás leyendo, que es
  // exactamente lo mismo con otro contenido.

  ajustes() {
    // Se abre la Redacción: lo que estuviera marcado como nuevo deja de estarlo
    // A PARTIR DE LA PRÓXIMA VEZ. Se lee el estado antes de marcar, porque si
    // no la propia visita que viene a ver los puntos rojos se los borra antes
    // de pintarlos.
    const marcarDespues = () => this.cuaderno.marcarVistoEnRedaccion?.();

    const { pantalla, contenido, plana } = seccionDiario({
      seccion: T('ajustes.seccion'),
      antetitulo: T('ajustes.titularCorto'),
      titular: T('ajustes.titular'),
      bajada: T('ajustes.bajada'),
    });

    // El cuerpo de la página es el bloque elástico: se queda con el hueco que
    // le toque y se desplaza por dentro en pantallas cortas, en vez de estirar
    // la hoja y sacar los botones fuera de cuadro.
    const cuerpo = el('div', 'se-estira se-estira--desplazable');
    cuerpo.appendChild(ladillo(T('ajustes.grupoPersonajes')));
    cuerpo.appendChild(this._pintarElectorPersonajes());
    cuerpo.appendChild(ladillo(T('ajustes.grupoArsenal')));
    cuerpo.appendChild(this._pintarArsenal());

    cuerpo.appendChild(ladillo(T('ajustes.grupoControles')));
    cuerpo.appendChild(this._pintarControles());

    cuerpo.appendChild(ladillo(T('ajustes.grupoEdicion')));
    cuerpo.appendChild(this._pintarVersion(pantalla));

    // No es letra pequeña legal: es contexto, y en un periódico eso va en el
    // pie de la página de administración, no perdido debajo de los botones.
    cuerpo.appendChild(el('div', 'plana__nota-tabla',
      T('ajustes.descargo')));
    plana.appendChild(cuerpo);

    const botones = el('div', 'diario__acciones');
    botones.appendChild(boton('Volver', 'boton--diario boton--diario-principal',
      () => this.juego.volverAlMenu()));

    if (this.cuaderno.partidasJugadas > 0) {
      let confirmando = false;
      const btn = boton(T('comunes.borrar'), 'boton--diario boton--diario-peligro', () => {
        if (!confirmando) {
          confirmando = true;
          btn.textContent = T('comunes.borrarConfirma');
          setTimeout(() => { confirmando = false; btn.textContent = T('comunes.borrar'); }, 3000);
          return;
        }
        this.cuaderno.reiniciarProgreso();
        this.juego.volverAlMenu();
      });
      botones.appendChild(btn);
    }
    // EL BLOQUE DE ACCIONES ES SIEMPRE LO ÚLTIMO DE LA PÁGINA.
    //
    // Aquí el pie del periódico —«elmercio.com · El Mercio»— iba DESPUÉS de los
    // botones, así que el borde inferior de las acciones caía en 734 mientras
    // en las otras ocho pantallas cae en 794. Sesenta píxeles de diferencia en
    // el sitio donde está la mano.
    //
    // La regla, para todo el juego: lo que se lee va arriba, lo que se pulsa va
    // abajo, y debajo del botón no hay nada.
    const pie = el('div', 'pie');
    pie.appendChild(document.createTextNode('elmercio.com · '));
    const enlace = el('a', '', T('marca.lema'));
    enlace.href = 'https://elmercio.com';
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    pie.appendChild(enlace);
    contenido.appendChild(pie);

    contenido.appendChild(botones);

    escalonar(plana);
    marcarDespues();
    return pantalla;
  }

  /**
   * EL ELECTOR DE PERIODISTA. Vive en Ajustes.
   *
   * Estuvo en la portada, y ahí no iba: elegir con quién sales pasa una vez
   * cada muchas partidas, y la fila se comía media primera página. Ajustes es
   * donde vive lo que se cambia de vez en cuando.
   *
   * LOS BLOQUEADOS SE ENSEÑAN IGUAL, en gris y con el candado. Un personaje
   * que no sabías que existía no tira de ti; ver una ficha apagada con lo que
   * falta para ficharla, sí.
   */
  _pintarElectorPersonajes() {
    const abiertos = new Set(this.cuaderno.personajesDesbloqueados());
    let elegido = abiertos.has(this.cuaderno.personajePreferido)
      ? this.cuaderno.personajePreferido
      : PERSONAJES[0].id;

    const personajes = el('div', 'elector');
    const fichas = PERSONAJES.map((def) => {
      const abierto = abiertos.has(def.id);
      const ficha = el('button', `elector__ficha ${abierto ? '' : 'elector__ficha--cerrada'}`.trim());
      ficha.type = 'button';

      // EL RETRATO PRIMERO, y esto es el cambio. Cuatro botones con un nombre
      // escrito no son una plantilla de redacción, son una lista: se elige
      // leyendo, y elegir personaje es de las pocas cosas del juego que se
      // deciden MIRANDO. Ahora cada ficha lleva su emblema —el mismo que sale
      // en el sobre al ficharlo, para que la cara que te anunciaron sea la que
      // luego encuentras aquí— y el bloqueado lo enseña en silueta: se ve que
      // hay alguien y no se ve quién.
      const retrato = el('span', 'elector__retrato');
      retrato.innerHTML = Icono.periodista(def.id, 54);
      ficha.appendChild(retrato);

      ficha.appendChild(el('span', 'elector__nombre', abierto ? def.nombre : '???'));
      // Debajo del nombre, la SECCIÓN. Es una palabra y hace todo el trabajo
      // del lore: cuatro fichas que ponen Política, Sociedad, Investigación y
      // Calle no se leen como cuatro skins, se leen como una redacción.
      if (abierto) ficha.appendChild(el('span', 'elector__seccion', def.seccion));
      ficha.title = abierto ? `${def.nombre} — ${def.nota}` : T('ajustes.fichaje', { tramos: def.tramos });

      if (!abierto) {
        ficha.appendChild(el('span', 'elector__candado', T('ajustes.candadoTramos', { n: def.tramos })));
        ficha.disabled = true;
      } else {
        if (def.id === elegido) ficha.classList.add('elector__ficha--elegida');
        // EL PUNTO ROJO. Lo abriste al terminar una corrida y esta es la
        // primera vez que pasas por donde vive: se marca hasta que la ves. Sin
        // esto, el sobre anuncia un fichaje y la pantalla donde está no dice
        // nada — el premio se queda sin sitio al que ir a mirarlo.
        if (this.cuaderno.esNuevoEnRedaccion?.(def.id)) {
          ficha.classList.add('elector__ficha--nueva');
          ficha.appendChild(el('span', 'marca-nueva', T('ajustes.etiquetaNuevo')));
        }
      }

      ficha.addEventListener('click', () => {
        elegido = def.id;
        fichas.forEach((f) => f.classList.remove('elector__ficha--elegida'));
        ficha.classList.add('elector__ficha--elegida');
        this.cuaderno.personajePreferido = def.id;
        this.cuaderno.guardar?.();
        this.audio.cambioCarril();
      });

      personajes.appendChild(ficha);
      return ficha;
    });

    const bloque = el('div', 'coleccion');
    bloque.appendChild(personajes);
    bloque.appendChild(barraDeProgreso(
      this.cuaderno.tramosRecorridos,
      this.cuaderno.proximoPersonaje?.(),
      PERSONAJES,
      T('ajustes.plantillaCompleta'),
    ));
    return bloque;
  }

  /**
   * Los cinco potenciadores, abiertos y por abrir.
   *
   * Enseñar las casillas cerradas es deliberado: un desbloqueo que no sabías
   * que existía no tira de ti. Ver cuatro siluetas apagadas y la distancia
   * exacta que falta para la primera, sí.
   */
  _pintarArsenal() {
    const abiertos = new Set(this.cuaderno.potenciadoresDesbloqueados());

    const bloque = el('div', 'coleccion');
    const fila = el('div', 'arsenal__fila');
    for (const pot of CATALOGO_POTENCIADORES) {
      const abierto = abiertos.has(pot.id);
      const casilla = el('div', `arsenal__casilla ${abierto ? '' : 'arsenal__casilla--cerrada'}`.trim());
      const cuadro = el('span', 'arsenal__cuadro');
      cuadro.innerHTML = Icono.iconoPotenciador(pot.id, 30);
      if (!abierto) cuadro.appendChild(el('span', 'arsenal__candado', '?'));
      casilla.appendChild(cuadro);
      // EL NOMBRE DEBAJO. Cinco iconos sin rótulo son cinco adivinanzas: el
      // imán, el x2 y la bota se distinguen, pero «Fuente anónima» y
      // «Salvoconducto» no están en el dibujo. Y sin saber cómo se llaman, la
      // línea de «X a dos tramos» de abajo no tiene a qué referirse.
      casilla.appendChild(el('span', 'arsenal__nombre', abierto ? pot.nombre : '???'));
      casilla.title = abierto
        ? `${pot.nombre} — ${pot.descripcion}`
        : `${pot.nombre} — se abre a los ${pot.tramos} tramos`;
      if (abierto && this.cuaderno.esNuevoEnRedaccion?.(pot.id)) {
        casilla.classList.add('arsenal__casilla--nueva');
        casilla.appendChild(el('span', 'marca-nueva', T('ajustes.etiquetaNuevo')));
      }
      fila.appendChild(casilla);
    }
    bloque.appendChild(fila);

    bloque.appendChild(barraDeProgreso(
      this.cuaderno.tramosRecorridos,
      this.cuaderno.proximoPotenciador(),
      CATALOGO_POTENCIADORES,
      T('ajustes.arsenalCompleto'),
    ));

    return bloque;
  }

  /** Chuleta de controles. */
  _pintarControles() {
    const instrucciones = el('div', 'instrucciones');
    const controles = [
      [Icono.flecha('izquierda', 18), 'Carril', '← → o swipe lateral'],
      [Icono.flecha('arriba', 18), 'Saltar', '↑, espacio o swipe arriba'],
      [Icono.flecha('abajo', 18), 'Agacharse', '↓ o swipe abajo'],
      [Icono.pausa(18), 'Pausa', T('ajustes.salir')],
    ];
    for (const [svgIcono, titulo, desc] of controles) {
      const item = el('div', 'instruccion');
      const ic = el('span', 'instruccion__icono');
      ic.innerHTML = svgIcono;
      item.appendChild(ic);
      const txt = el('span');
      txt.appendChild(el('strong', '', titulo));
      txt.appendChild(document.createTextNode(desc));
      item.appendChild(txt);
      instrucciones.appendChild(item);
    }
    return instrucciones;
  }

  /**
   * Panel de edición y modo offline.
   *
   * Existe porque todo esto era invisible: el juego se cachea entero y se
   * actualiza solo, pero el jugador no tenía forma de saber si podía jugar sin
   * conexión, qué edición corría, ni de forzar una comprobación. Un modo
   * offline que no se puede consultar es indistinguible de un juego congelado
   * en una versión vieja.
   *
   * La comprobación automática va cada hora. El botón es para el resto.
   */
  _pintarVersion(pantalla) {
    const act = this.actualizador;
    const panel = el('div', 'edicion');

    const fila = el('div', 'edicion__fila');
    const punto = el('span', 'edicion__punto');
    const texto = el('span', 'edicion__estado');
    fila.append(punto, texto);
    panel.appendChild(fila);

    panel.appendChild(el('div', 'edicion__sello',
      act ? `v${act.version} · ${act.edicion}` : T('edicion.desarrollo')));

    // SIN BOTÓN DE BUSCAR. Se comprueba al abrir el juego y cada hora, y la
    // edición nueva entra sola: durante el arranque de inmediato —con la
    // pantalla de carga aún puesta, así que ni se ve— y si aparece jugando, al
    // terminar la corrida. Un botón para pedir a mano lo que ya pasa solo no
    // da control, da la duda de si hace falta pulsarlo.
    panel.appendChild(el('div', 'edicion__nota',
      T('edicion.explicacion')));

    const ESTADOS_TEXTO = {
      'sin-soporte': [T('edicion.sinSoporte'), 'edicion--tenue'],
      preparando: [T('edicion.preparando'), 'edicion--espera'],
      listo: [T('edicion.listo'), 'edicion--listo'],
      buscando: [T('edicion.buscando'), 'edicion--espera'],
      disponible: [T('edicion.disponible'), 'edicion--nueva'],
    };

    function pintar() {
      const estado = act?.estado ?? 'sin-soporte';
      const [frase, clase] = ESTADOS_TEXTO[estado] ?? ESTADOS_TEXTO['sin-soporte'];
      texto.textContent = frase;
      panel.className = `edicion ${clase}`;
    }
    pintar();

    // El estado puede cambiar solo mientras la pantalla está abierta. Se
    // repinta, y la escucha se suelta al desmontar: sin eso, cada visita
    // dejaría un callback vivo apuntando a nodos que ya no existen.
    if (act) {
      act.alCambiar = pintar;
      pantalla.addEventListener('pantalla:desmontada', () => { act.alCambiar = () => {}; });
    }

    return panel;
  }

  // -------------------------------------------------------------------------
  // EL SORTEO DEL JUEZ
  // -------------------------------------------------------------------------
  // Te rodearon. Ahora te sortean un juez: seis, y un selector que los
  // recorre. Cinco llevan la camiseta morada del oficialismo; uno no.
  //
  // NO ES UNA RULETA, y la diferencia es todo. Aquí no hay número oculto ni
  // sorteo: el selector está a la vista, los jueces están a la vista, y el
  // resultado es exactamente lo que hiciste con el pulgar. Que sea difícil
  // está bien; que sea suerte, no —perder por un dado invisible después de dos
  // minutos corriendo es lo que apaga un juego.
  //
  // Cada captura acelera el selector. No hay tope de intentos: siempre tienes
  // la oportunidad, pero la oportunidad se encoge.

  // -------------------------------------------------------------------------
  // RELATO — el hueco sin acciones dentro del ente de control
  // -------------------------------------------------------------------------
  // Es la única pantalla del juego que no pide nada. Ni un selector, ni una
  // elección, ni una cifra: se para todo y se cuenta qué está pasando.
  //
  // Existe porque el trámite era la parte con más historia detrás y la que
  // menos se entendía. Entrabas por el túnel del centro, se te caían los
  // papeles y salías, todo en marcha, con un aviso de dos líneas que se iba
  // solo a los dos segundos y medio. Nadie lo leía. Y sin leerlo, lo que
  // quedaba era una fase rara en la que hay que recoger cosas del suelo.

  relato(datos) {
    const esEntrada = datos.fase === 'entrada';

    // Va impreso, y aquí es donde más se nota por qué: esta pantalla es un
    // ARTÍCULO —dos párrafos explicando un caso y una firma al pie— y estaba
    // maquetada como un cartel. Sobre papel, el jugador reconoce al instante
    // que lo que tiene delante es para leerlo.
    const { pantalla, contenido, plana } = seccionDiario({
      seccion: T('relato.seccion'),
      antetitulo: esEntrada ? T('relato.entra') : T('relato.termina'),
      titular: datos.institucion,
      clase: 'pantalla--relato',
    });

    // El cuerpo: dos o tres frases, tamaño de lectura, sin prisa. Y es el
    // bloque que da y quita, como la foto en las demás páginas.
    const relato = el('div', 'relato se-estira se-estira--desplazable');
    for (const parrafo of String(datos.relato ?? '').split('\n').filter(Boolean)) {
      relato.appendChild(el('p', 'relato__parrafo', parrafo.trim()));
    }
    plana.appendChild(relato);

    // El remate en voz de El Mercio, que es la línea que ya existía y que
    // ahora tiene sitio para leerse.
    if (datos.remate) {
      const remate = el('div', 'remate');
      remate.appendChild(document.createTextNode(datos.remate));
      remate.appendChild(el('span', 'remate__firma', T('marca.lema')));
      plana.appendChild(remate);
    }

    // A la salida, el balance. Es información de partida y va con formato de
    // dato, no de narración.
    if (!esEntrada) {
      // Tres cifras y en este orden, porque cuentan una operación: levantaste
      // esto del suelo, se te quedó esto otro, y al marcador vuelve el doble.
      // El ×2 va en medio y con su propio rótulo —no sumado en silencio— porque
      // es lo único que hace que entrar al trámite pueda salir a cuenta, y una
      // bonificación que no se ve no cambia ninguna decisión.
      const mult = datos.multiplicador ?? 2;
      plana.appendChild(estadisticas([
        [String(datos.recuperados ?? 0), T('relato.delSuelo')],
        [String(datos.perdidos ?? 0), T('relato.ahiQuedo')],
        [String(datos.devueltos ?? (datos.recuperados ?? 0) * mult), T('relato.multiplicador', { mult })],
      ]));

      if (datos.hallazgo) {
        const caja = el('div', 'desbloqueo');
        const icono = el('span', 'desbloqueo__icono');
        icono.innerHTML = Icono.usb(22);
        caja.appendChild(icono);
        // Mismas clases que el resto de recuadros de desbloqueo. Llevaba dos
        // propias —`__titulo` y `__nota`— que no existían en la hoja de
        // estilos, así que el texto salía sin maquetar: se veía porque hereda,
        // no porque estuviera pensado.
        const texto = el('span', 'desbloqueo__texto');
        texto.appendChild(el('span', 'desbloqueo__etiqueta', T('relato.salvado')));
        texto.appendChild(el('span', 'desbloqueo__nombre', datos.hallazgo));
        caja.appendChild(texto);
        plana.appendChild(caja);
      }
    }

    const seguir = () => this.juego.continuarRelato(datos.fase);

    const botones = el('div', 'botones');
    botones.appendChild(boton(
      esEntrada ? T('relato.entrar') : T('relato.seguir'),
      'boton--principal',
      seguir,
    ));
    botones.appendChild(pistaDeToque());
    contenido.appendChild(botones);
    tocarParaAvanzar(pantalla, seguir);

    escalonar(plana);
    return pantalla;
  }

  escape(datos) {
    // Sección JUDICIALES, que es exactamente donde un periódico pondría esto:
    // a quién le tocó qué sala. Que el sorteo salga impreso en la misma página
    // en la que mañana saldrá la sentencia es la mitad del chiste.
    const { pantalla, contenido, plana } = seccionDiario({
      seccion: T('sorteo.seccion'),
      antetitulo: T('sorteo.titular'),
      titular: T('sorteo.bajada'),
      bajada: T('sorteo.instruccion'),
      clase: 'pantalla--cerco',
    });

    // --- La tómbola horizontal de jueces ------------------------------------
    // El honesto está en un puesto distinto cada vez. Si estuviera fijo, esto
    // se aprendería a la segunda captura y dejaría de ser una prueba.
    //
    // La tómbola se desplaza infinitamente de izquierda a derecha con jueces
    // duplicados para crear el efecto de bucle continuo.
    const total = datos.jueces ?? 6;
    const honesto = Math.floor(Math.random() * total);

    // SIN `.se-estira`. Esa clase es `flex: 1 1 0` y, en la columna de la
    // pantalla, hacía que el bombo se comiera todo el hueco libre: las cartas
    // van al cien por cien de su alto, así que salían de 100 × 335 con la
    // figura del juez ocupando el dieciséis por ciento. El bombo tiene la
    // altura que le da la maqueta y no negocia.
    const contenedorTombola = el('div', 'tombola-contenedor');
    const banda = el('div', 'tombola-banda');

    // Los jueces se repiten para que la banda no se acabe nunca. Cinco vueltas
    // son de sobra: se rebobina un ciclo entero cuando lleva dos recorridos, y
    // el corte cae siempre fuera del trozo visible.
    const REPETICIONES = 5;
    const fichas = [];  // Todas, en fila. El índice global manda.
    for (let i = 0; i < total * REPETICIONES; i++) {
      const puesto = i % total;
      const esHonesto = puesto === honesto;
      const ficha = el('div', `juez ${esHonesto ? 'juez--limpio' : 'juez--comprado'}`);
      const toga = el('span', 'juez__toga');
      // 76 Y NO 54. Con el bombo estirado la carta medía 335 de alto y la
      // figura ocupaba el 16 %: una manchita en medio de un rectángulo de
      // color. Arreglada la altura del bombo la carta baja a 159 y la misma
      // figura sube al 34 %, que sigue siendo poco para lo único que hay que
      // reconocer de un vistazo. A 76 ocupa el ancho útil de la carta —100
      // menos 8 de relleno a cada lado— y se lee la toga, no una silueta.
      toga.innerHTML = Icono.juez(76, esHonesto);
      ficha.appendChild(toga);
      // Los seis se llaman igual. Rotular al bueno como «el bueno» convertiría
      // la prueba en leer una etiqueta; lo que hay que mirar es el pecho.
      ficha.appendChild(el('span', 'juez__rotulo', `JUEZ ${puesto + 1}`));
      banda.appendChild(ficha);
      fichas.push(ficha);
    }
    contenedorTombola.appendChild(banda);

    // Selector visual en el centro
    const selector = el('div', 'tombola-selector');
    contenedorTombola.appendChild(selector);

    plana.appendChild(contenedorTombola);

    const zonaResultado = el('div');
    plana.appendChild(zonaResultado);

    // --- El movimiento de la tómbola ----------------------------------------
    // Va con requestAnimationFrame y reloj real, no con una animación CSS:
    // hace falta saber en qué juez está EXACTAMENTE bajo el selector en el
    // instante del toque, y una animación declarativa no lo dice sin leer
    // estilos computados.
    //
    // La geometría se MIDE del DOM en el primer fotograma. Estaba escrita a
    // mano (120 px por ficha) y no coincidía con el CSS —`clamp(100px, 22vw,
    // 140px)` más el hueco de la fila—, así que el juez resaltado no era el que
    // estaba bajo el selector: en pantallas anchas iba dos puestos por detrás.
    let indiceGlobal = 0;
    let desplazamiento = 0;   // Píxeles que lleva recorridos la banda
    let anterior = performance.now();
    let corriendo = true;
    let paso1 = 0;            // Ancho de ficha + hueco
    let offsetPrimera = 0;    // Del borde de la banda al centro de la ficha 0

    // OJO CON LAS UNIDADES. `datos.velocidad` viene de CERCO.SELECTOR_VELOCIDAD
    // y está en JUECES POR SEGUNDO —4,2 la primera captura, subiendo hasta 15—,
    // porque el selector original saltaba de puesto en puesto. Al pasar la
    // tómbola a desplazamiento continuo hay que convertirla a píxeles, y eso
    // solo se puede hacer después de medir el ancho real de una ficha.
    // Sin convertir, la banda corría a 4,2 PÍXELES por segundo: congelada.
    const juecesPorSegundo = datos.velocidad ?? 7;

    const medir = () => {
      const primera = fichas[0];
      if (!primera?.offsetWidth) return false;
      const estilo = getComputedStyle(banda);
      const hueco = parseFloat(estilo.columnGap || estilo.gap) || 0;
      paso1 = primera.offsetWidth + hueco;
      offsetPrimera = (parseFloat(estilo.paddingLeft) || 0) + primera.offsetWidth / 2;
      return paso1 > 0;
    };

    // MIENTRAS GIRA, EL ÚNICO INDICADOR ES LA VENTANA.
    //
    // Antes se resaltaba además la ficha más cercana al centro, y como la banda
    // corre en continuo, «la más cercana» puede estar a media ficha de la
    // ventana: se veía el marco rojo en un sitio y el recuadro negro en otro,
    // los dos diciendo «este». Dos indicadores que no coinciden no informan,
    // confunden —y en un sorteo, hacen sospechar del sorteo—.
    //
    // La ventana es fija y lo que pasa por debajo es lo que toca. El recuadro
    // se pone solo al parar, cuando la ficha ya está encajada en el centro.
    const marcar = () => {
      banda.style.transform = `translateX(${-desplazamiento}px)`;
    };

    const avanzar = (ahora) => {
      if (!corriendo) return;
      // Hasta que la pantalla no está montada no se puede medir nada.
      if (!paso1 && !medir()) { requestAnimationFrame(avanzar); return; }

      const dt = Math.min(0.05, (ahora - anterior) / 1000);
      anterior = ahora;
      desplazamiento += dt * juecesPorSegundo * paso1;

      // Rebobinado de un ciclo entero: la banda es idéntica cada `total`
      // fichas, así que el salto no se ve.
      const ciclo = paso1 * total;
      if (desplazamiento >= ciclo * 2) desplazamiento -= ciclo;

      // Qué ficha queda bajo el selector, que está en el centro del marco.
      const centro = contenedorTombola.clientWidth / 2;
      indiceGlobal = Math.max(0, Math.min(
        fichas.length - 1,
        Math.round((desplazamiento + centro - offsetPrimera) / paso1),
      ));

      marcar();
      requestAnimationFrame(avanzar);
    };
    requestAnimationFrame(avanzar);

    // El botón se crea aquí porque `parar()` lo necesita, pero NO se cuelga
    // todavía: va el último de la página, después de la columna de opinión.
    // Colgado aquí quedaba a media altura —con `margin-top: auto` empujando
    // hasta la opinión y no hasta el borde— y en un teléfono corto la caja del
    // veredicto se dibujaba encima de él.
    const botones = el('div', 'botones');

    const parar = () => {
      if (!corriendo) return;
      corriendo = false;
      botonParar.disabled = true;

      // Se para EN SECO en el juez que estuviera bajo el selector —eso es lo
      // que el jugador acaba de decidir— y solo después se encaja la ficha en
      // el centro. Frenar poco a poco movería el resultado después del toque,
      // que es exactamente lo que no puede pasar en un sorteo.
      const acerto = indiceGlobal % total === honesto;
      if (paso1) {
        desplazamiento = indiceGlobal * paso1 + offsetPrimera
          - contenedorTombola.clientWidth / 2;
        // EL ENCAJE, LARGO Y BLANDO. Estaba en 0.22 s con una curva de
        // salida brusca, y como el recorrido es de menos de media ficha, esos
        // 0.22 se leían como un tirón: la banda estaba corriendo a toda
        // velocidad y de pronto daba un salto seco de veinte píxeles.
        // Con 0.55 s y una curva que solo frena —sin rebote, sin adelanto— la
        // banda PARA, que es lo que hace una tómbola de verdad. El resultado
        // sigue decidiéndose en el instante del toque: aquí solo se acomoda
        // lo que ya está decidido.
        banda.style.transition = 'transform 0.55s cubic-bezier(0.16, 0.85, 0.3, 1)';
        marcar();
      }

      fichas[indiceGlobal].classList.add('juez--senalado');
      fichas[indiceGlobal].classList.add(acerto ? 'juez--acierto' : 'juez--fallo');
      if (!acerto) {
        // El honesto que se enseña es la copia MÁS CERCANA a donde paró, para
        // que quede a la vista y no en una vuelta que no está en pantalla.
        const vuelta = Math.round((indiceGlobal - honesto) / total);
        const cercano = Math.max(0, Math.min(
          fichas.length - 1, honesto + vuelta * total,
        ));
        fichas[cercano].classList.add('juez--revelado');
      }

      const caja = el('div', `resultado ${acerto ? 'resultado--exito' : 'resultado--fracaso'}`);
      caja.appendChild(el('div', 'resultado__titulo',
        acerto ? T('sorteo.ganaSeccion') : T('sorteo.pierdeSeccion')));
      caja.appendChild(el('div', 'resultado__texto', acerto
        ? T('sorteo.gana')
        : T('sorteo.pierde')));
      zonaResultado.appendChild(caja);

      // LA REGLA SE RETIRA CUANDO YA NO HAY NADA QUE DECIDIR.
      //
      // «Cinco son del gobierno y salen en morado. Para la ventana en el
      // verde» es una instrucción, y una instrucción sobra en cuanto se ha
      // ejecutado. Dejándola puesta, en un iPhone de 667 le robaba al veredicto
      // los cuarenta y cuatro píxeles que necesitaba y el remate salía cortado
      // a media línea: se leía «MEDIDAS SUSTITUTIVAS» y de la explicación,
      // nada. Y lo que hay que leer al final es justo eso.
      plana.querySelector('.plana__epigrafe')?.remove();

      this.audio.resultadoRuleta(acerto);

      // Un respiro para leer el resultado antes de que cambie la pantalla.
      setTimeout(() => this.juego.escapar(acerto), acerto ? 900 : 1300);
    };

    const botonParar = boton(T('sorteo.parar'), 'boton--principal', parar);
    botones.appendChild(botonParar);

    // Espacio y toque también valen: en móvil el pulgar ya está en la
    // pantalla, y obligar a apuntar al botón añade una dificultad que no tiene
    // nada que ver con lo que se está midiendo.
    // LA COLUMNA DE OPINIÓN, como maqueta el Figma la página del sorteo: el
    // filete, la etiqueta roja, la cita en negra y el busto del columnista.
    // La cita es la misma sátira que ya cuenta la bajada, dicha por alguien.
    // Y AHORA SÍ, EN ORDEN: primero la columna de opinión, que es contenido de
    // la página, y debajo el botón, que es la acción.
    const opinion = el('div', 'opinion');
    const opTexto = el('div', 'opinion__texto');
    opTexto.appendChild(el('div', 'opinion__etiqueta', T('sorteo.opinion')));
    opTexto.appendChild(el('div', 'opinion__cita',
      T('sorteo.nota')));
    opinion.appendChild(opTexto);
    const opBusto = el('div', 'opinion__busto');
    opBusto.innerHTML = Icono.juez(44, true);
    opinion.appendChild(opBusto);
    contenido.appendChild(opinion);
    contenido.appendChild(botones);

    const porTecla = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        parar();
      }
    };
    window.addEventListener('keydown', porTecla);
    pantalla.addEventListener('pointerdown', (e) => {
      if (e.target !== botonParar) parar();
    });

    // Se limpia el listener global cuando la pantalla desaparece.
    pantalla.addEventListener('pantalla:desmontada', () => {
      corriendo = false;
      window.removeEventListener('keydown', porTecla);
    });

    return pantalla;
  }

  // -------------------------------------------------------------------------
  // VICTORIA
  // -------------------------------------------------------------------------
  // El final del juego. Se llega presentando un expediente COMPLETO en el
  // túnel del centro, que es casi imposible a propósito.

  victoria(datos) {
    // Es la única portada del juego que no habla de una derrota, así que va
    // impresa como tal: sección PORTADA, antetítulo de última hora y el titular
    // de una palabra que se pone cuando de verdad pasó algo.
    const { pantalla, contenido, plana } = seccionDiario({
      seccion: T('victoria.seccion'),
      antetitulo: T('victoria.titularCorto'),
      titular: T('victoria.titular'),
      bajada: datos.institucion,
      clase: 'pantalla--victoria',
    });

    const remate = el('div', 'remate');
    remate.appendChild(document.createTextNode(datos.texto));
    remate.appendChild(el('span', 'remate__firma', T('marca.lema')));
    plana.appendChild(remate);

    plana.appendChild(el('p', 'plana__cuerpo',
      datos.papelesEntregados > 0
        ? T('victoria.conEvidencia', { n: datos.papelesEntregados })
        : T('victoria.sinEvidencia')));

    const cuerpoVictoria = el('div', 'se-estira se-estira--desplazable');
    cuerpoVictoria.appendChild(estadisticas([
      [datos.papeles.toLocaleString('es-EC'), 'Evidencia'],
      [`${datos.distancia.toLocaleString('es-EC')} m`, 'Distancia'],
      [datos.puntaje.toLocaleString('es-EC'), 'Puntaje'],
      [String(datos.pruebas.length), 'Pruebas'],
    ]));
    plana.appendChild(cuerpoVictoria);

    if (datos.ruta?.length > 1) {
      cuerpoVictoria.appendChild(ladillo(T('victoria.ruta')));
      cuerpoVictoria.appendChild(this._pintarRuta(datos.ruta));
    }

    const botones = el('div', 'botones');
    botones.appendChild(boton(T('comunes.reintentar'), 'boton--principal',
      () => this.juego.iniciarPartida()));
    botones.appendChild(boton(T('victoria.archivo'), '',
      () => this.mostrar(this.notebook())));
    botones.appendChild(boton(T('comunes.menu'), 'boton--tenue',
      () => this.juego.volverAlMenu()));
    contenido.appendChild(botones);

    escalonar(plana);
    return pantalla;
  }

  // -------------------------------------------------------------------------
  // EL SOBRE — lo que se acaba de desbloquear, a pantalla completa
  // -------------------------------------------------------------------------
  //
  // POR QUÉ EXISTE ESTA PANTALLA. Fichar a alguien pasa dos veces en toda la
  // vida del juego y abrir un potenciador, cinco. Eran los momentos más raros
  // que reparte el juego y se anunciaban con un recuadro pálido de sesenta
  // píxeles pegado al final de la tabla de posiciones — y encima esa tabla
  // SOLO SALE SI LA CORRIDA TE SUBIÓ DE PUESTO (ver `hayAscenso`). O sea que
  // la mayoría de las veces el aviso no se enseñaba en ningún sitio: se
  // desbloqueaba un personaje y el jugador se enteraba semanas después, al
  // abrir Ajustes y ver una ficha que ya no decía «???».
  //
  // Un desbloqueo tiene que PARAR EL JUEGO. Los runners llevan treinta años
  // resolviéndolo igual: pantalla entera, fondo de rayos, la cosa en el
  // centro, grande, y un toque para abrir. Eso es lo que hay aquí, contado con
  // lo que hay en esta redacción: llega un sobre sin remitente, lo abres, y
  // dentro está lo que sea.
  //
  // Y NO SE PUEDE SALTAR SIN VERLO. Ocupa toda la pantalla y pide un toque por
  // sobre: no es un aviso al margen de otra cosa, es la cosa.

  /**
   * Lo que esta corrida abrió, en el orden en que se cuenta.
   *
   * Los personajes van PRIMERO: de las tres clases de hallazgo es la que menos
   * se repite en toda la partida, y la primera que se abre es la que se
   * recuerda. Detrás los potenciadores —que cambian cómo se corre— y al final
   * las páginas, que son lectura para después.
   *
   * @returns {Array<{clase:string, antetitulo:string, nombre:string,
   *   sub:string, desc:string, icono:string}>}
   */
  _colaDeHallazgos(datos) {
    if (!datos) return [];
    const cola = [];

    for (const per of datos.personajesNuevos ?? []) {
      // La `ficha` y no la `nota`: la nota es la línea de la lista («Boina y
      // traje») y aquí sobra sitio para la de verdad, que es la que explica
      // por qué ese periodista incomoda.
      const def = PERSONAJES.find((p) => p.id === per.id) ?? per;
      cola.push({
        clase: 'hallazgo--personaje',
        antetitulo: T('hallazgo.fichaje'),
        nombre: def.nombre,
        sub: def.seccion ?? '',
        desc: def.ficha ?? def.nota ?? '',
        icono: Icono.periodista(def.id, 130),
      });
    }

    for (const pot of datos.potenciadoresNuevos ?? []) {
      const def = CATALOGO_POTENCIADORES.find((p) => p.id === pot.id) ?? pot;
      cola.push({
        clase: 'hallazgo--potenciador',
        antetitulo: T('hallazgo.potenciador'),
        nombre: def.nombre,
        sub: '',
        desc: def.descripcion ?? '',
        icono: Icono.iconoPotenciador(def.id, 112),
      });
    }

    for (const pag of datos.paginasNuevas ?? []) {
      cola.push({
        clase: 'hallazgo--pagina',
        antetitulo: T('hallazgo.pagina'),
        nombre: pag.nombre,
        sub: T('hallazgo.subPagina', { n: pag.numero }),
        desc: T('hallazgo.descPagina'),
        icono: Icono.paginaDiario(112),
      });
    }

    return cola;
  }

  /**
   * Mete la cola de sobres ANTES de la pantalla que venga, si hay algo que
   * enseñar. Si no hay nada, no se nota que esto existe.
   *
   * @param {Function} hacer Devuelve la pantalla siguiente.
   */
  conHallazgos(datos, hacer) {
    const cola = this._colaDeHallazgos(datos);
    if (!cola.length) return hacer();
    return this.hallazgos(cola, () => this.mostrar(hacer()));
  }

  /**
   * La pantalla del sobre. Un toque abre; otro pasa al siguiente.
   *
   * @param {Array} cola Lo que hay que enseñar, en orden.
   * @param {Function} alTerminar Qué hacer cuando no quede ninguno.
   */
  hallazgos(cola, alTerminar = () => this.juego.volverAlMenu()) {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--hallazgo');

    // LOS RAYOS. Un abanico de rayos saliendo del centro es el recurso más
    // viejo del oficio para decir «mira aquí», y no es una importación de otro
    // juego: es el estallido de los anuncios de prensa, que es de donde lo
    // sacaron los juegos. Se dibuja con un degradado cónico repetido —cuesta
    // cero, no hay imagen que cargar— y gira despacio detrás de todo.
    const rayos = el('div', 'hallazgo__rayos');
    pantalla.insertBefore(rayos, contenido);

    // La mancheta, con el contador de sobres pegado. El contador va ARRIBA y no
    // bajo el nombre: cuando el sobre está abierto, ese sitio lo ocupa la
    // sección del periodista o el número de la página, y el jugador se quedaba
    // sin saber si venían más. Aquí está siempre, y no estorba.
    const cabecera = cabeceraMarca(T('hallazgo.seccion'));
    let cuenta = null;
    if (cola.length > 1) {
      cuenta = el('span', 'hallazgo__cuenta');
      cabecera.appendChild(cuenta);
    }
    contenido.appendChild(cabecera);

    const escena = el('div', 'hallazgo__escena');

    const pieza = el('div', 'hallazgo__pieza');
    const disco = el('div', 'hallazgo__disco');
    pieza.appendChild(disco);
    escena.appendChild(pieza);

    const texto = el('div', 'hallazgo__texto');
    const antetitulo = el('div', 'hallazgo__antetitulo');
    const nombre = el('h1', 'hallazgo__nombre');
    const sub = el('div', 'hallazgo__sub');
    const desc = el('p', 'hallazgo__desc');
    texto.append(antetitulo, nombre, sub, desc);
    escena.appendChild(texto);

    contenido.appendChild(escena);

    const pie = el('div', 'hallazgo__pie');
    contenido.appendChild(pie);

    let i = 0;
    let abierto = false;

    const pintarCerrado = () => {
      abierto = false;
      pantalla.classList.remove('hallazgo--abierto');
      pantalla.classList.add('hallazgo--cerrado');
      pieza.className = 'hallazgo__pieza';
      disco.innerHTML = Icono.sobre(126);
      antetitulo.textContent = T('hallazgo.antetituloCerrado');
      nombre.textContent = T('hallazgo.nombreCerrado');
      sub.textContent = '';
      desc.textContent = '';
      if (cuenta) cuenta.textContent = T('hallazgo.cuenta', { n: i + 1, total: cola.length });
      pie.textContent = T('hallazgo.abrir');
    };

    const pintarAbierto = () => {
      abierto = true;
      const h = cola[i];
      pantalla.classList.remove('hallazgo--cerrado');
      pantalla.classList.add('hallazgo--abierto');
      // Se rehace el nodo de la pieza para que la animación de entrada vuelva
      // a dispararse: reañadir una clase sobre el mismo elemento no reinicia
      // un `animation`, y el segundo sobre salía ya puesto, sin rebote.
      pieza.className = `hallazgo__pieza hallazgo__pieza--sale ${h.clase}`;
      disco.innerHTML = h.icono;
      antetitulo.textContent = h.antetitulo;
      nombre.textContent = h.nombre;
      sub.textContent = h.sub;
      desc.textContent = h.desc;
      pie.textContent = T('hallazgo.continuar');
      this.audio?.hallazgo?.();
    };

    const tocar = () => {
      if (!abierto) { pintarAbierto(); return; }
      i += 1;
      if (i >= cola.length) { alTerminar(); return; }
      pintarCerrado();
    };

    pantalla.addEventListener('click', tocar);
    // Y con el teclado, que el juego entero se puede jugar sin tocar la
    // pantalla y esta pantalla bloquea el paso.
    const teclado = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        tocar();
      }
    };
    window.addEventListener('keydown', teclado);
    pantalla.addEventListener('pantalla:desmontada',
      () => window.removeEventListener('keydown', teclado), { once: true });

    pintarCerrado();
    return pantalla;
  }

  // -------------------------------------------------------------------------
  // GAME OVER
  // -------------------------------------------------------------------------

  gameOver(datos) {
    const { pantalla, contenido } = pantallaBase();
    // La pantalla entera es el periódico del día siguiente. No un panel de
    // resultados con una cabecera bonita: el ejemplar completo. El periodista
    // deja de firmar la noticia y pasa a ser la noticia, y para que eso se
    // sienta tiene que ocupar todo, como ocuparía la portada de verdad.
    pantalla.classList.add('pantalla--plana');

    // Efecto de flash/photo cuando la pantalla aparece, como si tomaran una foto
    pantalla.classList.add('pantalla--foto-flash');

    contenido.appendChild(this._primeraPlana(datos));

    // UN SOLO BOTÓN. La portada es una página, no un menú: aquí solo se pasa
    // de hoja. Las tres opciones de antes —volver, archivo, menú— cabían mal y
    // encima obligaban a decidir antes de haber terminado de leer.
    const botones = el('div', 'botones');
    // EL SOBRE VA AQUÍ, entre la portada y el expediente. La portada es el
    // remate de la corrida y no puede llevar nada delante; el expediente y la
    // tabla son recuento, y un recuento después de una buena noticia se lee
    // mejor que al revés.
    const pasarDeHoja = () => this.mostrar(this.conHallazgos(datos,
      () => ((datos.pruebas?.length) ? this.botin(datos) : this.deportes(datos))));
    botones.appendChild(boton(T('comunes.continuar'), 'boton--principal', pasarDeHoja));
    botones.appendChild(pistaDeToque());
    contenido.appendChild(botones);
    tocarParaAvanzar(pantalla, pasarDeHoja);

    escalonar(contenido);

    // Disparar el flash después de montar la pantalla
    // Esto permite que la animación ocurra visiblemente
    requestAnimationFrame(() => {
      pantalla.classList.add('pantalla--foto-flash-active');
    });

    return pantalla;
  }

  /**
   * EL RANKING, RÉPLICA DEL MARCO 105:372.
   *
   * Mancheta con «./ranking», antetítulo rojo, titular, el conmutador de tres
   * pestañas, el podio de tres —con el primero en su tarjeta amarilla y más
   * alto que los otros dos— la ventana de puestos alrededor del jugador, y
   * tres botones.
   *
   * CUÁNDO SE VE. Al terminar una corrida, solo si esa corrida te subió de
   * puesto en alguna de las tres tablas (ver `hayAscenso`). Una tabla de
   * posiciones que sale siempre deja de ser una noticia: la mayoría de las
   * partidas no mueven nada, y ver tres veces seguidas el mismo puesto solo
   * alarga el camino de vuelta a jugar. Desde el menú se entra igual, a mano,
   * porque ahí sí se está buscando algo concreto.
   */
  deportes(datos = null) {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--plana', 'pantalla--pruebas');

    const hoja = el('div', 'pruebas');

    // ══ MANCHETA ════════════════════════════════════════════════════════
    const mancheta = el('div', 'pruebas__mancheta');
    mancheta.appendChild(document.createTextNode(T('marca.nombre')));
    mancheta.appendChild(el('span', 'pruebas__seccion', T('marcadores.seccion')));
    hoja.appendChild(mancheta);

    // ══ ANTETÍTULO, TITULAR Y PESTAÑAS ══════════════════════════════════
    const encabezado = el('div', 'pruebas__encabezado');
    const antetitulo = el('div', 'pruebas__caso', T('marcadores.antetitulo'));
    const titular = el('h1', 'pruebas__estado', '');
    encabezado.appendChild(antetitulo);
    encabezado.appendChild(titular);

    const pestanas = el('div', 'ranking__pestanas');
    const botonesPestana = new Map();
    encabezado.appendChild(pestanas);
    hoja.appendChild(encabezado);

    // EL PODIO Y LA TABLA VAN EN UN CUERPO QUE SE DESPLAZA.
    //
    // Colgados directamente de la página, en un teléfono corto no había sitio
    // para todo y `.ranking__filas` se quedaba en CERO de alto: sus tres filas
    // se salían por abajo y se dibujaban encima de los botones. Medido a
    // 393 × 667: el botón «Volver a investigar» impreso sobre la fila #9.
    //
    // Sumado sin engaños, esa pantalla pide 590 px de contenido —mancheta 61,
    // encabezado 112, podio 120, tres filas 124 y tres botones 173— más los
    // huecos, en una ventana de 526. No caben, y ninguna cantidad de afinar
    // márgenes los va a meter. Lo que corresponde es que la parte que ES una
    // lista se comporte como una lista: la mancheta y las pestañas se quedan
    // arriba, los botones abajo, y el podio con la tabla se desplazan en medio.
    const cuerpo = el('div', 'pruebas__cuerpo');
    const podio = el('div', 'ranking__podio');
    const filas = el('div', 'ranking__filas');
    cuerpo.appendChild(podio);
    cuerpo.appendChild(filas);
    hoja.appendChild(cuerpo);

    // ══ PINTAR UNA CLASIFICACIÓN ════════════════════════════════════════
    const pintar = (id) => {
      const clase = clasificacion(id);
      titular.textContent = clase.titulo;

      for (const [otro, b] of botonesPestana) {
        b.classList.toggle('ranking__pestana--activa', otro === id);
      }

      const mio = clase.valor(this.cuaderno);
      const todos = tablaCompleta(clase, mio, this.cuaderno.nombreJugador ?? YO);

      // --- El podio ------------------------------------------------------
      // El orden en pantalla es 2 · 1 · 3, como en el marco y como en
      // cualquier podio: el primero en medio y más alto.
      podio.replaceChildren();
      const cifra = (v) => v.toLocaleString('es-EC') + clase.unidad;
      for (const [puesto, medalla] of [[2, '🥈'], [1, '👑'], [3, '🥉']]) {
        const fila = todos[puesto - 1];
        if (!fila) continue;
        const caja = el('div',
          `ranking__puesto ranking__puesto--${puesto}${fila.esTu ? ' ranking__puesto--tu' : ''}`);
        caja.appendChild(el('div', 'ranking__medalla', medalla));
        caja.appendChild(el('div', 'ranking__nombre', fila.arroba));
        caja.appendChild(el('div', 'ranking__cifra', cifra(fila.valor)));
        podio.appendChild(caja);
      }

      // --- La ventana ----------------------------------------------------
      // Los tres de arriba ya están en el podio, así que la lista empieza en
      // el cuarto. Se centra en el jugador: enseñar del cuatro al seis cuando
      // vas noveno es enseñar a gente que no te dice nada.
      filas.replaceChildren();
      const yo = todos.findIndex((f) => f.esTu);
      const desde = Math.min(
        Math.max(3, yo - 1),
        Math.max(3, todos.length - 3),
      );

      for (const fila of todos.slice(desde, desde + 3)) {
        const nodo = el('div',
          `ranking__fila${fila.esTu ? ' ranking__fila--tu' : ''}`);

        const quien = el('div', 'ranking__quien');
        quien.appendChild(el('span', 'ranking__puesto-num', `#${fila.puesto}`));
        quien.appendChild(el('span', 'ranking__arroba',
          fila.esTu ? `${fila.arroba} (Tú)` : fila.arroba));
        nodo.appendChild(quien);
        nodo.appendChild(el('span', 'ranking__valor', cifra(fila.valor)));

        // Renombrarse se hace TOCANDO TU PROPIA FILA, además de con el botón:
        // es donde se ve el nombre y es donde la mano ya está.
        if (fila.esTu) {
          nodo.addEventListener('click', () => renombrar());
          nodo.title = T('marcadores.renombrar');
        }
        filas.appendChild(nodo);
      }

      this.pestanaDeportes = id;
    };

    for (const clase of CLASIFICACIONES) {
      const b = boton(clase.pestana, 'ranking__pestana', () => {
        this.audio.cambioCarril();
        pintar(clase.id);
      });
      pestanas.appendChild(b);
      botonesPestana.set(clase.id, b);
    }

    // ══ CAMBIAR NOMBRE ══════════════════════════════════════════════════
    // El marco trae el botón, así que el nombre tiene que poder cambiarse de
    // verdad. Se hace en la propia fila —un campo de texto donde estaba el
    // arroba— y no en una pantalla nueva: es un dato de una línea.
    const renombrar = () => {
      const fila = filas.querySelector('.ranking__fila--tu');
      if (!fila || fila.querySelector('input')) return;

      const arroba = fila.querySelector('.ranking__arroba');
      const campo = document.createElement('input');
      campo.className = 'ranking__campo';
      campo.type = 'text';
      campo.maxLength = 24;
      campo.value = this.cuaderno.nombreJugador ?? YO;
      campo.setAttribute('aria-label', T('marcadores.renombrar'));
      arroba.replaceWith(campo);
      campo.focus();
      campo.select();

      const guardar = () => {
        const limpio = campo.value.trim().slice(0, 24);
        if (limpio) this.cuaderno.nombreJugador = limpio;
        pintar(this.pestanaDeportes);
      };
      campo.addEventListener('blur', guardar, { once: true });
      campo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') campo.blur();
        if (e.key === 'Escape') { campo.value = ''; campo.blur(); }
      });
    };

    // Al perder se abre por la tabla en la que subiste, que es la que explica
    // por qué esta pantalla ha salido. Desde el menú se recuerda la última.
    pintar(datos?.ascenso ?? (datos ? 'mejor' : (this.pestanaDeportes ?? 'papeles')));

    // ══ BOTONES ═════════════════════════════════════════════════════════
    const botones = el('div', 'pruebas__botones');
    botones.appendChild(boton(T('comunes.reintentar'), 'boton--diario boton--diario-principal',
      () => this.juego.iniciarPartida()));
    botones.appendChild(boton(T('marcadores.descanso'), 'boton--diario boton--diario-oscuro',
      () => this.juego.volverAlMenu()));
    botones.appendChild(boton(T('marcadores.renombrar'), 'boton--diario', renombrar));
    hoja.appendChild(botones);

    contenido.appendChild(hoja);

    // AQUÍ YA NO VA LO DESBLOQUEADO. Estaba, como aviso flotante al pie, y era
    // el peor sitio posible por dos razones: un recuadro pálido de sesenta
    // píxeles para anunciar el segundo fichaje de toda la partida, y encima
    // esta pantalla SOLO SALE SI LA CORRIDA TE SUBIÓ DE PUESTO. La mayoría de
    // las veces el aviso no llegaba a enseñarse. Ahora hay una pantalla entera
    // para eso (ver `hallazgos`).

    return pantalla;
  }

  /**
   * La portada de mañana. Cuando hubo sorteo de juez, el titular es la
   * sentencia; cuando no —te quedaste sin luz, cruzaste el cerco— es el motivo
   * de la caída.
   */
  _primeraPlana(datos) {
    const plana = el('div', 'plana');

    // --- Mancheta ----------------------------------------------------------
    plana.appendChild(cabeceraMarca(null, true));

    const titulos = {
      captura: T('captura.titularAlcanzado'),
      exhausto: T('captura.titularExhausto'),
      cerco: T('captura.titularCerco'),
    };
    const sentencia = datos.sentencia;

    // SIN ANTETÍTULO ROJO. El marco 89:1025 va directo de la mancheta al
    // titular; el «PERIODISTA DETENIDO / SE INTERRUMPE LA COBERTURA» que había
    // aquí no está dibujado en ninguna parte.
    plana.appendChild(el('h1', 'plana__titular',
      sentencia?.titular ?? titulos[datos.motivo] ?? T('captura.titularGenerico')));

    // --- La foto del arresto -----------------------------------------------
    // Sale del propio juego: es el fotograma del cerco, con el círculo ya
    // cerrado. Que la imagen sea LA TUYA y no una ilustración genérica es lo
    // que convierte el resumen en una noticia sobre ti.
    // LA BAJADA VA SIEMPRE. En el marco hay un texto bajo el titular —«Sin
    // visitas, sin llamadas y sin abogado los primeros días. Después ya no
    // hacía falta.»— y ese es el sitio de la voz del diario en esta página.
    //
    // Aquí abajo estaba el remate por escenario («El conteo rápido te dio por
    // perdedor…») en un bloque suelto con su firma, y ese bloque no está
    // dibujado. Se va: la bajada del marco ocupa su función y se edita desde
    // el constructor. La sentencia del juez manda cuando la hay, porque
    // entonces la noticia del día es esa.
    plana.appendChild(el('p', 'plana__bajada', sentencia?.texto ?? T('captura.bajada')));

    // --- Los papeles -------------------------------------------------------
    // La ÚNICA cifra grande, y son EVIDENCIA, no puntaje. El puntaje suma
    // papeles y metros, así que puntúa igual documentar que salir corriendo; y
    // lo que este juego mide es cuánta documentación sacaste antes de que te
    // pararan. Los metros son el precio que pagaste, no el logro.
    //
    // Antes había cuatro recuadros del mismo tamaño y ninguno destacaba, así
    // que no se sabía qué se estaba puntuando. El resto es contexto y va en
    // letra de pie de foto.
    const papeles = datos.papeles ?? 0;
    const marcador = el('div', 'plana__marcador');
    marcador.appendChild(el('span', 'plana__marcador-rotulo', T('captura.rotuloEvidencia')));

    const cifra = el('span', 'plana__marcador-cifra', '0');
    marcador.appendChild(cifra);
    contarHasta(cifra, papeles);

    // EL SELLO DE «RÉCORD PERSONAL» TAMPOCO ESTÁ EN EL MARCO. Se va con el
    // resto: la marca personal se ve en el ranking, que es su sitio.
    plana.appendChild(marcador);

    // La línea de datos, como la escribe el Figma en «Game over» (89:1025):
    // «984m recorridos・1.345 evidencia total». El puntaje se cae de aquí
    // porque el marco no lo lleva y porque lo que el juego cuenta es
    // evidencia: dos cifras distintas para lo mismo confunden más que informan.
    plana.appendChild(el('div', 'plana__datos', T('captura.resumen', {
      distancia: (datos.distancia ?? 0).toLocaleString('es-EC'),
      // El máximo y no el histórico a secas: la partida se registra antes de
      // pintar esta pantalla, pero si alguna vez dejara de hacerlo, un total
      // de cero debajo de una cifra de mil trescientos sería absurdo.
      evidencia: Math.max(this.cuaderno.estado?.evidenciaHistorica ?? 0, datos.papeles ?? 0)
        .toLocaleString('es-EC'),
    })));

    // Y DESPUÉS la foto, como en el marco: primero la cifra que resume la
    // corrida, luego su línea de datos, y al final la imagen con su pie. Es
    // además el bloque elástico de esta página.
    // Y SI NO HAY FOTO, SE RESERVA EL ESPACIO. No se deja el hueco.
    //
    // La foto la saca Game.js del propio lienzo en el instante del arresto, y
    // puede no salir: si el canvas está «contaminado» el navegador no deja
    // leerlo, y la portada se quedaba sin ella. Medido: 274 px de papel en
    // blanco, el 39 % de la página, entre la línea de datos y el botón. Una
    // portada con un agujero de ese tamaño no parece una portada, parece que
    // algo no cargó.
    //
    // Lo que hace un periódico cuando no tiene la foto es reservar el hueco y
    // decirlo, y este juego ya tiene ese gesto: es el mismo sello de ESPACIO
    // RESERVADO con el que el Archivo guarda sitio a un reportaje que aún no
    // cierra. Así que la portada se completa sola y encima con una broma que
    // es de la casa.
    plana.appendChild(datos.foto
      ? this._fotoArresto(datos)
      : this._huecoSinFoto());

    // LO QUE SÍ SACASTE, EL REPORTAJE COMPLETO, LO QUE VIENE Y EL REMATE:
    // fuera los cuatro. Debajo de la foto había una lista con viñetas de las
    // pruebas de la corrida, un sello de reportaje cerrado, un bloque de «EN
    // LA SIGUIENTE CORRIDA» con sus casillas y el remate editorial firmado, y
    // el marco 89:1025 no dibuja ninguno: va de la foto al botón.
    //
    // Nada de eso se pierde, cambia de página. Las pruebas de la corrida son
    // justo lo que arma la pantalla de Pruebas, que viene inmediatamente
    // después y las enseña una a una en la rejilla del caso; los reportajes
    // cerrados salen en el Archivo. Aquí estaban dos veces.

    // La TABLA y los DESBLOQUEOS ya no están aquí: se fueron a la página de
    // deportes. Con todo junto la portada no cabía en una pantalla de móvil y
    // había que hacer scroll justo cuando lo que se quiere es volver a jugar.
    // Una portada es una portada: titular, foto, cifra y a pasar de hoja.
    return plana;
  }

  // -------------------------------------------------------------------------
  // PRUEBAS — El expediente se arma con lo que sacaste
  // -------------------------------------------------------------------------

  /**
   * RÉPLICA DE LOS MARCOS «Pruebas» DEL FIGMA (89:1063 y 105:310).
   *
   * Los dos marcos son la MISMA pantalla en dos estados, y verlo así es lo que
   * resuelve la papeleta entera:
   *
   *   105:310  la rejilla: nueve casillas, las recogidas con su prueba y el
   *            resto con un interrogante gris.
   *   89:1063  el detalle: una sola pieza a 184 px con su pie en rojo.
   *
   * Así que el «armar el caso animado e interactivo» no necesita una pantalla
   * inventada: el armado es la rejilla llenándose de una en una, y lo
   * interactivo es tocar una casilla para verla en grande. Los dos estados
   * están dibujados; lo único que no estaba dibujado es el camino entre ellos.
   *
   * NUEVE CASILLAS porque son las que dibuja la maqueta. Si una corrida trae
   * más pruebas que eso, el tablero crece en múltiplos de tres para no dejar
   * una fila coja.
   *
   * LO ÚNICO QUE NO SE COPIA LITERAL son los emoji. El Figma pone 🌁 💿 💾, que
   * son marcadores de posición —el juego no tiene un puente de San Francisco
   * entre las pruebas—; en su sitio va el mismo juego de iconos que usa el HUD
   * al recogerlas, que es lo que esos emoji representan. Todo lo demás
   * —medidas, colores, tipografías, el interrogante, los dos botones— es lo
   * que dice el marco.
   */
  botin(datos) {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--plana', 'pantalla--pruebas');

    const hoja = el('div', 'pruebas');
    const pruebas = datos.pruebas ?? [];
    const buenas = pruebas.filter((n) => !Notebook.esFalsa(n)).length;
    const esc = obtenerEscenario(datos.escenario ?? this.juego.escenarioActual);

    // ══ MANCHETA ════════════════════════════════════════════════════════
    const mancheta = el('div', 'pruebas__mancheta');
    mancheta.appendChild(document.createTextNode(T('marca.nombre')));
    mancheta.appendChild(el('span', 'pruebas__seccion', T('botin.seccion')));
    hoja.appendChild(mancheta);

    // ══ CASO Y ESTADO ═══════════════════════════════════════════════════
    const encabezado = el('div', 'pruebas__encabezado');
    // El «CASO» lo pone el guion, así que el dato entra sin él: los escenarios
    // guardan «CASO PORSCHE» porque el HUD lo pinta entero, y aquí salía
    // «CASO CASO PORSCHE».
    encabezado.appendChild(el('div', 'pruebas__caso',
      T('botin.caso', { caso: esc.caso.replace(/^caso\s+/i, '') })));
    encabezado.appendChild(el('h1', 'pruebas__estado',
      buenas > 0 ? T('botin.estadoAbierto') : T('botin.estadoVacio')));

    // La línea del expediente: lo que el caso ES, en la voz del dossier. Va
    // debajo del estado porque es lo que explica por qué recoger esto importa;
    // sin ella, la rejilla es un marcador de cromos.
    if (esc.expediente) {
      encabezado.appendChild(el('p', 'pruebas__sumario', esc.expediente.escena));
    }

    // A DÓNDE VA ESTO. La línea que faltaba para que la pantalla contara lo
    // que es: la redacción armando una página del periódico con lo que traes.
    // Sin ella, la mesa era un álbum de cromos —se recogía sin saber para
    // qué—; con ella, cada corrida termina diciendo qué le hizo al Archivo.
    const idEsc = datos.escenario ?? this.juego.escenarioActual;
    const pagina = PAGINAS.find((p) => p.caso === idEsc);
    const sumarioCaso = this.cuaderno?.sumarioDelCaso?.(idEsc);
    if (pagina) {
      const recienAbierta = (datos.paginasNuevas ?? [])
        .some((p) => p.numero === pagina.numero);
      const abierta = this.cuaderno?.estaDesbloqueada?.(pagina.numero);
      const texto = sumarioCaso?.completo
        ? T('botin.cierreCompleto', { pagina: pagina.nombre })
        : recienAbierta
          ? T('botin.cierreNueva', { pagina: pagina.nombre })
          : abierta
            ? T('botin.cierreAbierta', { pagina: pagina.nombre })
            : T('botin.cierreFaltan', {
              pagina: pagina.nombre,
              pedidas: pagina.pruebas ?? 0,
              n: this.cuaderno?.pruebasDelCaso?.(idEsc) ?? 0,
            });
      encabezado.appendChild(el('p', 'pruebas__cierre', texto));
    }
    hoja.appendChild(encabezado);
    hoja.appendChild(el('div', 'pruebas__filete'));

    // La cuenta de la mesa: cuántos documentos del caso están recuperados.
    // Solo los que tienen documento detrás —igual que el sello de completo—.
    if (sumarioCaso?.documentos) {
      hoja.appendChild(el('div', 'pruebas__cuenta', T('botin.documentos', {
        n: sumarioCaso.documentados, total: sumarioCaso.documentos,
      })));
    }

    // ══ LA MESA ═════════════════════════════════════════════════════════
    const mesa = el('div', 'pruebas__mesa');
    // El tablero va DENTRO de la mesa y no es la mesa: en el Figma la mesa
    // («Opinion / Item») mide 497 y centra dentro un bloque de 354×402 que es
    // la rejilla. Sin esa distinción las tres filas quedaban apretadas en el
    // medio, con todo el aire repartido arriba y abajo en vez de entre ellas.
    const tablero = el('div', 'pruebas__tablero');
    mesa.appendChild(tablero);
    hoja.appendChild(mesa);

    // Las casillas: primero lo recogido, luego los huecos hasta completar la
    // fila. La evidencia suelta abre el expediente —no es una prueba, pero es
    // lo que costó la corrida— y por eso ocupa la primera casilla.
    // ══ EL EXPEDIENTE DEL CASO ══════════════════════════════════════════
    //
    // LAS CASILLAS SON LAS PRUEBAS DE ESTE CASO, no nueve huecos genéricos.
    // Cada escenario declara las suyas en `config/escenarios.js` —la Bahía
    // tiene el USB sin cadena de custodia, el chat del grupo, el video de
    // vigilancia y el acta borroneada— y son únicas: el acta borroneada no
    // aparece en el Apagón ni el audio del ministro en la Bahía.
    //
    // Por eso el tablero es el expediente y no un marcador: cada hueco tiene
    // dueño, se sabe qué falta, y encontrar la pieza que faltaba es un
    // hallazgo concreto y no «una prueba más».
    //
    // SE LLENA CON TODO LO QUE TENGAS DE ESTE CASO, no solo con lo de esta
    // corrida: el expediente se arma entre partidas, que es de lo que va. Lo
    // recogido AHORA es lo que cae con animación; lo de antes ya está puesto.
    // Las casillas del expediente: primero las pistas con documento detrás y
    // luego las que solo están en redes, que ocupan su sitio igual —existen—
    // pero van marcadas, porque con una captura de pantalla no se publica.
    const conDocumento = esc.evidencia ?? [];
    const soloRedes = esc.pistasSinConfirmar ?? [];
    const delCaso = [...conDocumento, ...soloRedes];
    const tengo = new Set(this.cuaderno?.pruebas ?? []);
    const recienRecogidas = new Set(pruebas);

    const casillas = delCaso.map((nombre) => ({
      nombre,
      icono: (t) => Icono.iconoPrueba(nombre, t),
      falsa: false,
      sinConfirmar: soloRedes.includes(nombre),
      tengo: tengo.has(nombre) || recienRecogidas.has(nombre),
      nueva: recienRecogidas.has(nombre),
    }));

    // El material plantado NO ocupa casilla del expediente —no es de este caso,
    // es de quien te lo dejó ahí— pero si lo recogiste tiene que verse, o el
    // chiste no se entiende. Va al final, en gris y fuera de la cuenta.
    for (const nombre of pruebas) {
      if (!Notebook.esFalsa(nombre)) continue;
      casillas.push({
        nombre,
        icono: (t) => Icono.iconoPrueba(nombre, t),
        // SE REVELA AQUÍ, no al recogerla: el material plantado se detecta al
        // contrastarlo, nunca al encontrarlo, y esa es justamente la broma.
        falsa: true,
        tengo: true,
        nueva: true,
      });
    }

    // Dos columnas hasta cuatro piezas y tres a partir de ahí: con tres
    // columnas, un caso de cuatro pruebas deja una sola casilla huérfana en la
    // segunda fila.
    const columnas = casillas.length <= 4 ? 2 : 3;
    tablero.style.setProperty('--columnas', String(columnas));

    // Cada pieza cae en su turno. El ritmo es el de la versión anterior —un
    // objeto cada 0,3 s—, que es lo que convierte la lista en ceremonia sin
    // que quien acaba de perder tenga que esperar a que termine el desfile.
    const PASO = 0.3;

    // Los turnos pendientes se cancelan si la pantalla se va antes de que el
    // armado acabe: sin esto, pulsar SIGUIENTE a mitad dejaba los golpes de
    // sonido sonando encima de la página de deportes.
    const temporizadores = [];
    pantalla.addEventListener('pantalla:desmontada',
      () => temporizadores.forEach(clearTimeout), { once: true });

    // El detalle es el otro marco: la misma mesa con una sola pieza dentro.
    // Se vuelve tocándola otra vez.
    const verDetalle = (casilla) => {
      tablero.replaceChildren();
      mesa.classList.add('pruebas__mesa--detalle');
      tablero.appendChild(pieza(casilla, 184, () => pintarRejilla()));
    };

    // CADA CASILLA ES UNA FICHA DE DOCUMENTO, CON SU NOMBRE. La rejilla
    // enseñaba solo iconos —y cuatro de cinco documentos comparten icono, así
    // que la mesa era una fila de cromos repetidos— y lo no recogido era un
    // interrogante, o sea un misterio. Pero aquí no hay misterio: el sumario
    // del caso sabe exactamente qué documento falta y el Archivo ya lo lista
    // por su nombre. Una redacción no colecciona cromos: mantiene una lista de
    // lo que tiene y de lo que le falta conseguir, con cada papel rotulado.
    const pieza = (casilla, tamano, alPulsar) => {
      const esFicha = tamano <= 100;
      const nodo = el('button', ['pruebas__pieza',
        esFicha ? 'pruebas__pieza--ficha' : '',
        casilla?.tengo === false ? 'pruebas__pieza--reservada' : '',
        casilla?.falsa ? 'pruebas__pieza--falsa' : '',
        casilla?.sinConfirmar ? 'pruebas__pieza--sin-confirmar' : '',
      ].filter(Boolean).join(' '));
      nodo.type = 'button';
      nodo.style.setProperty('--cara', `${tamano}px`);

      const cara = el('div', 'pruebas__cara');
      cara.innerHTML = casilla.icono(Math.round(tamano * 0.76));
      nodo.appendChild(cara);

      // El sello de estado va ANTES del nombre, como en una carpeta de
      // archivo: primero si está o no está, después qué es.
      if (casilla.tengo === false) {
        nodo.appendChild(el('div', 'pruebas__sello', T('botin.sinRecuperar')));
      } else if (casilla.nueva && !casilla.falsa) {
        nodo.appendChild(el('div', 'pruebas__sello pruebas__sello--nuevo', T('botin.nuevo')));
      }

      nodo.appendChild(el('div', 'pruebas__nombre', casilla.nombre));

      if (casilla.sinConfirmar) {
        nodo.appendChild(el('div', 'pruebas__marca', T('botin.sinConfirmar')));
      }
      if (casilla.falsa) {
        // En la rejilla basta la marca; el remate —qué medio la publica— se
        // guarda para el detalle, que es donde hay sitio para leerlo.
        const pub = !esFicha && publicacionDe(casilla.nombre);
        nodo.appendChild(el('div', 'pruebas__marca pruebas__marca--falsa', T('botin.plantada')));
        // AQUÍ SE ENTIENDE EL CHISTE, y no dos pantallas después. Al abrir una
        // pieza plantada, lo primero que se lee es quién la va a publicar: no
        // te la colaron para que perdieras una casilla, te la colaron para que
        // mañana salga en otro sitio contando otra cosa.
        if (pub) {
          nodo.appendChild(el('div', 'pruebas__destino',
            T('botin.destinoPlantada', { medio: pub.medio.nombre })));
        }
      }

      if (alPulsar) nodo.addEventListener('click', alPulsar);
      else nodo.disabled = true;

      return nodo;
    };

    const pintarRejilla = (animar = false) => {
      temporizadores.forEach(clearTimeout);
      temporizadores.length = 0;
      tablero.replaceChildren();
      mesa.classList.remove('pruebas__mesa--detalle');

      // Solo lo que cae AHORA lleva turno. Lo que ya estaba en el expediente
      // aparece puesto: animarlo otra vez cada partida convertiría el hallazgo
      // en un trámite.
      let turno = 0;
      casillas.forEach((casilla) => {
        const nodo = pieza(casilla, 56,
          casilla.tengo ? () => verDetalle(casilla) : null);
        if (animar && casilla.nueva) {
          nodo.classList.add('pruebas__pieza--entra');
          nodo.style.setProperty('--retardo', `${0.2 + turno * PASO}s`);
          temporizadores.push(setTimeout(
            () => this.audio?.evidencia?.(), (0.2 + turno * PASO) * 1000));
          turno++;
        }
        tablero.appendChild(nodo);
      });
    };

    pintarRejilla(true);

    // ══ BOTONES ═════════════════════════════════════════════════════════
    // EL RANKING SOLO SI SUBISTE DE PUESTO. `hayAscenso` compara las marcas
    // de antes de esta corrida con las de ahora; si no adelantaste a nadie, el
    // botón lleva directo a la portada. Una tabla de posiciones que sale
    // siempre deja de ser una noticia, y la mayoría de las partidas no mueven
    // nada: era una pantalla más entre perder y volver a jugar.
    const ascenso = hayAscenso(datos.marcasPrevias, this.cuaderno);

    const siguiente = () => (ascenso
      ? this.mostrar(this.deportes({ ...datos, ascenso }))
      : this.juego.volverAlMenu());

    const botones = el('div', 'pruebas__botones');
    botones.appendChild(boton(T('botin.siguiente'), 'boton--diario boton--diario-principal',
      siguiente));
    botones.appendChild(boton(T('comunes.reintentar'), 'boton--diario',
      () => this.juego.iniciarPartida()));
    hoja.appendChild(botones);
    hoja.appendChild(pistaDeToque());

    contenido.appendChild(hoja);
    // El toque en cualquier parte hace lo del botón PRINCIPAL, o sea pasar de
    // hoja. «Volver a investigar» sigue pidiendo su pulsación: empezar una
    // partida por rozar la pantalla mientras se lee el recuento es justo lo
    // contrario de lo que se quiere.
    tocarParaAvanzar(pantalla, siguiente);
    return pantalla;
  }

  /**
   * La foto de prensa. Es la captura del juego pasada por un filtro de tinta:
   * gris, contrastada y con la trama de puntos por encima.
   *
   * El tramado va en CSS y no tocando los píxeles, que sería lo "correcto":
   * procesar una imagen de pantalla completa en el momento en que el jugador
   * acaba de perder es medio segundo de bloqueo justo donde más se nota.
   */
  /**
   * El hueco de la foto cuando no hay foto.
   *
   * Mismo lenguaje que el espacio reservado del Archivo —filete discontinuo y
   * sello— y mismo comportamiento elástico que la figura de verdad, así que la
   * página mide lo mismo haya imagen o no.
   */
  _huecoSinFoto() {
    const hueco = el('figure', 'plana__foto plana__foto--vacia se-estira');
    hueco.appendChild(el('div', 'plana__foto-sello', T('captura.sinFoto')));
    hueco.appendChild(el('figcaption', 'plana__pie', T('captura.sinFotoPie')));
    return hueco;
  }

  _fotoArresto(datos) {
    const figura = el('figure', 'plana__foto se-estira');

    const img = document.createElement('img');
    img.src = datos.foto;
    img.alt = T('captura.altFoto');
    img.loading = 'lazy';
    figura.appendChild(img);
    figura.appendChild(el('span', 'plana__trama'));

    const esc = obtenerEscenario(datos.escenario ?? 'bahia');
    figura.appendChild(el('figcaption', 'plana__pie',
      T('captura.pieFoto', { lugar: esc.nombre })));

    return figura;
  }

  _pintarRuta(ruta) {
    const fila = el('div', 'lista__fila');
    ruta.forEach((id, i) => {
      if (i > 0) fila.appendChild(el('span', 'nodo-flecha', '→'));
      fila.appendChild(el('span', 'nodo', obtenerEscenario(id).nombre));
    });
    return fila;
  }

  // -------------------------------------------------------------------------
  // EL PERIÓDICO
  // -------------------------------------------------------------------------
  // El Archivo es un ejemplar de El Mercio que el jugador arma página a
  // página. Rompe a propósito con la estética del resto del juego: papel
  // crema y tipografía con remates, en vez de neón sobre negro. Es lo único
  // que no es sátira, y el cambio de piel lo dice sin explicarlo.

  notebook() {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--periodico');

    const paginas = this.cuaderno.listarPaginas();
    // Se abre por la última página desbloqueada: es lo nuevo que quiere ver.
    const abiertas = paginas.filter((p) => p.desbloqueada);
    let actual = abiertas.length ? abiertas[abiertas.length - 1].numero : 1;

    // EL EJEMPLAR ENTERO ES LA INTERFAZ: los botones van DENTRO del papel.
    //
    // Estaban colgados de `contenido`, o sea flotando fuera de la hoja, y eso
    // rompía la idea de que todo lo que no es correr sale impreso: quedaba una
    // hoja de periódico con dos botones de aplicación debajo. Ahora el papel
    // tiene cuerpo y pie, como una página de verdad, y el pie lleva las
    // acciones —igual que el panel de versión lleva su «buscar actualización»
    // dentro de su propia caja—.
    //
    // La separación en dos también hace falta para el alto fijo: `pintar()`
    // vacía y rehace el CUERPO en cada cambio de página, así que los botones
    // tienen que vivir fuera de ese vaciado o desaparecerían al pasar la hoja.
    // SIN `--desplazable`: el que se desplaza es la HOJA, no el ejemplar.
    // La clase traía además un `::after` de doce píxeles —el respiro para que
    // la última línea de un cuerpo desplazable no quede a ras del borde— que
    // aquí no pintaba nada y empujaba los botones doce píxeles por encima de
    // donde caen en las otras nueve pantallas.
    const diario = el('div', 'diario se-estira');
    // LA HOJA SÍ LLEVA EL AVISO DE «HAY MÁS ABAJO».
    //
    // El que se desplaza es la hoja —no el ejemplar—, y desde que las páginas
    // publican el sumario del caso hay páginas que no caben en un teléfono de
    // 667. Sin la máscara, el último renglón visible se corta a media altura
    // contra un borde duro y se lee como un fallo de dibujado, no como una
    // página larga. `marcarDesplazables()` la enciende y la apaga sola.
    const hoja = el('div', 'diario__hoja se-estira--desplazable');
    const pie = el('div', 'diario__pie');
    diario.appendChild(hoja);
    diario.appendChild(pie);
    contenido.appendChild(diario);

    // EL PAGINADOR VIVE EN EL PIE, NO DENTRO DE LA HOJA.
    //
    // Estaba colgado de la hoja, y la hoja es lo que se desplaza: en un iPhone
    // de 667 los números de página se iban por debajo del corte junto con el
    // texto, así que para cambiar de página había que desplazar hasta el final
    // de la que estabas leyendo. Un paginador que hay que ir a buscar deja de
    // ser un paginador.
    //
    // Además va aquí porque se pinta UNA sola vez: `pintar()` vacía y rehace la
    // hoja en cada cambio de página, así que dentro había que reconstruirlo
    // entero cada vez solo para marcar cuál está activa.
    const paginador = this._navegadorPaginas(paginas, actual, (n) =>
      cambiarPagina(n, Math.sign(n - actual)));
    pie.appendChild(paginador);

    /**
     * @param {number} n       Página destino
     * @param {number} sentido +1 avanza, -1 retrocede, 0 sin animación
     */
    const cambiarPagina = (n, sentido = 0) => {
      if (n === actual || n < 1 || n > paginas.length) return;
      actual = n;
      pintar(sentido);
      this.audio?.cambioCarril?.();
    };

    const pintar = (sentido = 0) => {
      hoja.innerHTML = '';
      const pagina = paginas.find((p) => p.numero === actual) ?? paginas[0];

      const { cab, franja } = this._cabeceraDiario(pagina);
      hoja.appendChild(cab);
      hoja.appendChild(franja);
      hoja.appendChild(
        pagina.desbloqueada ? this._paginaAbierta(pagina) : this._paginaCerrada(pagina, () => pintar()),
      );

      // «LO QUE DICE EL GOBIERNO» ES UNA SECCIÓN, NO UN PIE.
      //
      // Estaba en el pie del ejemplar, o sea impresa en las cinco páginas y
      // fuera de lo que se desplaza. Con el pie llevando además el paginador y
      // dos botones, ocupaba 587 px de un teléfono de 852: a la hoja —donde
      // está el periódico— le quedaban 217. Medido, no estimado.
      //
      // Va donde le corresponde: al final de LA ÚLTIMA, que es la página de
      // seguimiento. Ahí deja de repetirse cinco veces y además cae en el
      // único sitio donde significa algo —la página que resume en qué quedó
      // cada caso, seguida de lo que se publicó con lo que te plantaron—.
      if (pagina.numero === paginas.length) {
        const contra = this._pintarVersionOficial();
        if (contra) hoja.appendChild(contra);

        // EL RECADO A LA REDACCIÓN NO SE LE ENSEÑA AL JUGADOR: dice
        // literalmente «se rellenan en src/config/publicaciones.js». Es para
        // quien monta el juego, y quien monta el juego trabaja en desarrollo.
        if (import.meta.env?.DEV && hayPendientes()) {
          hoja.appendChild(el('div', 'diario__nota',
            T('archivo.progreso', {
              listos: cuantosListos(),
              total: paginas.reduce((n, p) => n + p.articulos.length, 0),
            })));
          hoja.appendChild(el('div', 'diario__nota', T('archivo.explicacion')));
        }
      }

      // Marcar la página activa en el paginador, que ahora vive fuera de la
      // hoja y por tanto sobrevive a este vaciado.
      for (const b of paginador.children) {
        b.classList.toggle('paginador__pag--actual', Number(b.textContent) === actual);
      }

      // La hoja entra por el lado del que viene. Quitar la clase, forzar el
      // reflujo y volver a ponerla es la única forma de reiniciar una animación
      // CSS que ya empezó.
      if (!sentido) return;
      hoja.classList.remove('diario--pasa-avanza', 'diario--pasa-retrocede');
      void hoja.offsetWidth;
      hoja.classList.add(sentido > 0 ? 'diario--pasa-avanza' : 'diario--pasa-retrocede');
    };
    pintar();

    // --- Pasar página con el dedo -------------------------------------------
    // El gesto tiene que ser CLARAMENTE horizontal: el diario se desplaza en
    // vertical, y un arrastre para leer que además cambie de página convierte
    // la lectura en una pelea. Por eso se exige que el trazo horizontal sea
    // mayor que el vertical antes de contarlo como pase.
    const MINIMO_PASE = 48;
    let arranqueX = 0;
    let arranqueY = 0;

    const alTocar = (e) => {
      arranqueX = e.changedTouches[0].clientX;
      arranqueY = e.changedTouches[0].clientY;
    };

    const alSoltar = (e) => {
      const dx = e.changedTouches[0].clientX - arranqueX;
      const dy = e.changedTouches[0].clientY - arranqueY;
      if (Math.abs(dx) < MINIMO_PASE || Math.abs(dx) <= Math.abs(dy)) return;
      // Arrastrar hacia la izquierda trae la página siguiente, como en papel.
      cambiarPagina(actual + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    };

    diario.addEventListener('touchstart', alTocar, { passive: true });
    diario.addEventListener('touchend', alSoltar, { passive: true });

    // --- El ejemplar no cambia de tamaño ------------------------------------
    // La portada lleva la mancheta entera y las interiores una franja de una
    // línea, y cada página trae un número distinto de artículos: con el alto
    // libre el papel encogía un palmo largo entre una página y la siguiente
    // —medido: 514 px contra 454— y los botones de abajo saltaban con él.
    //
    // El alto NO se puede clavar en CSS porque depende de cuánto texto envuelva
    // en cada ancho de pantalla. Así que se mide: se pinta cada página en seco,
    // se apunta su alto natural y se fija el mayor de todos. Pasa una sola vez
    // al abrir el Archivo y no se llega a ver —los repintados caen dentro del
    // mismo fotograma, y el navegador solo dibuja el último—.
    const fijarAlto = () => {
      if (!diario.isConnected) return;
      const previa = actual;
      hoja.style.minHeight = '';
      let mayor = 0;
      for (const p of paginas) {
        actual = p.numero;
        pintar();
        // offsetHeight y NO getBoundingClientRect(): la pantalla entra con una
        // animación de escala, y el rectángulo devuelve el tamaño YA
        // transformado. Midiendo a mitad de esa animación salía un 2 % corto y
        // el salto volvía, ocho píxeles en vez de sesenta pero visible igual.
        mayor = Math.max(mayor, hoja.offsetHeight);
      }
      actual = previa;
      pintar();
      // Y NUNCA MÁS ALTO QUE EL HUECO QUE HAY.
      //
      // Esto clavaba el alto de la página más larga sin mirar la ventana. En un
      // iPhone de 667 salían 585 px de hoja dentro de un ejemplar de 526, y el
      // pie —con el botón de Volver— se iba fuera de la pantalla. El alto fijo
      // sirve para que el papel no encoja al pasar de hoja; cuando no cabe, lo
      // que toca es que la hoja se desplace por dentro, no que empuje al pie.
      const hueco = diario.clientHeight - (pie.offsetHeight || 0);
      hoja.style.minHeight = `${Math.ceil(Math.min(mayor, Math.max(120, hueco)))}px`;
    };
    // Hasta que `mostrar()` no lo cuelga del documento no hay nada que medir.
    requestAnimationFrame(fijarAlto);

    // Al girar el teléfono cambia el ancho, y con él lo que envuelve cada
    // titular: el alto de antes deja de valer y hay que volver a medir.
    const alRedimensionar = () => fijarAlto();
    window.addEventListener('resize', alRedimensionar);

    pantalla.addEventListener('pantalla:desmontada', () => {
      diario.removeEventListener('touchstart', alTocar);
      diario.removeEventListener('touchend', alSoltar);
      window.removeEventListener('resize', alRedimensionar);
    });

    // --- Salida y avisos ---------------------------------------------------
    const botones = el('div', 'diario__acciones');
    botones.appendChild(boton('Volver', 'boton--diario boton--diario-principal',
      () => this.juego.volverAlMenu()));

    if (this.cuaderno.partidasJugadas > 0) {
      let confirmando = false;
      const btn = boton(T('comunes.borrar'), 'boton--diario boton--diario-peligro', () => {
        if (!confirmando) {
          confirmando = true;
          btn.textContent = T('comunes.borrarConfirma');
          setTimeout(() => { confirmando = false; btn.textContent = T('comunes.borrar'); }, 3000);
          return;
        }
        this.cuaderno.reiniciarProgreso();
        this.mostrar(this.notebook());
      });
      botones.appendChild(btn);
    }
    if (!this.cuaderno.almacenamientoDisponible) {
      pie.appendChild(el('div', 'diario__nota',
        T('archivo.sinAlmacenamiento')));
    }

    // Y los botones, LOS ÚLTIMOS, como en todas las demás páginas. Estaban
    // antes de las notas, así que en desarrollo quedaban a media altura con
    // dos párrafos debajo.
    pie.appendChild(botones);

    return pantalla;
  }

  /**
   * Mancheta del Archivo — LA MISMA MARCA QUE EL RESTO.
   *
   * Tenía cabecera propia: antetítulo de edición, el nombre a cuerpo enorme,
   * el lema debajo y una franja de tres datos. Era bonita y era otro diseño:
   * la única pantalla del juego que no se presentaba como se presentan todas
   * las demás. Ahora usa la marca del sistema —«EL MERCIO./archivo»,
   * «EL MERCIO./portada»— y debajo, en una línea de cuerpo pequeño, lo que
   * lleva la cabecera de un ejemplar de verdad: sitio, páginas y precio.
   */
  _cabeceraDiario(pagina) {
    const esPortada = pagina.numero === 1;
    const cab = cabeceraMarca(esPortada ? 'archivo' : pagina.seccion);
    cab.classList.add('plana__cabecera--diario');

    const franja = el('div', 'diario__franja');
    if (esPortada) {
      franja.appendChild(el('span', '', CABECERA.sitio));
      franja.appendChild(el('span', '', T('archivo.paginasAbiertas', { n: this.cuaderno.paginasAbiertas })));
      franja.appendChild(el('span', '', CABECERA.precio));
    } else {
      franja.appendChild(el('span', '', pagina.nombre));
      franja.appendChild(el('span', '', T('archivo.pagina', { n: pagina.numero })));
    }
    // La franja va FUERA del bloque de cabecera —se devuelve aparte— para que
    // la cabecera del Archivo mida exactamente lo mismo que la de las otras
    // nueve pantallas. Dentro, la estiraba de 61 a 95 px y bajaba la mancheta
    // quince píxeles respecto al resto del juego.
    return { cab, franja };
  }

  /** Contenido de una página abierta, maquetado a columnas. */
  _paginaAbierta(pagina) {
    const cuerpo = el('div', 'diario__cuerpo');

    // EL SUMARIO PRIMERO, Y ESTE ES EL ARREGLO DE FONDO DEL ARCHIVO.
    //
    // Reunías las pruebas de un caso, se abría su página, y dentro no había
    // nada: dos huecos de «ESPACIO RESERVADO» y un sello. El objetivo de toda
    // la corrida —correr, recoger, publicar— terminaba en una página en
    // blanco, y eso vacía de sentido lo que la mecánica pide.
    //
    // Lo que la página publica ahora es el EXPEDIENTE: el sumario con el que
    // la redacción se documenta, que existe, está escrito y está contrastado
    // (config/escenarios.js). No es el reportaje y no se presenta como tal:
    // va con su rótulo propio, sin firma y sin fecha —un expediente no las
    // lleva— y el hueco del reportaje sigue ahí debajo. La regla de la casa
    // no se toca: lo que no está publicado, no se firma.
    const sumario = pagina.caso
      ? this._sumarioCaso(pagina.caso)
      : this._sumarioSeguimiento();
    if (sumario) cuerpo.appendChild(sumario);

    const destacado = pagina.articulos.find((a) => a.destacado) ?? pagina.articulos[0];
    const resto = pagina.articulos.filter((a) => a !== destacado);

    // El rótulo que separa las dos mitades de la página: arriba el material de
    // trabajo (el expediente), abajo lo que la redacción va a publicar con él.
    // Sin este filete, los huecos de «ESPACIO RESERVADO» parecían sobras
    // debajo del sumario; con él se lee la cadena entera del juego: recoges →
    // el expediente crece → la pieza se escribe con eso.
    if (pagina.articulos.length) {
      cuerpo.appendChild(el('div', 'diario__zona', T('archivo.zonaReportajes')));
    }

    if (destacado) cuerpo.appendChild(this._articulo(destacado, true));

    if (resto.length) {
      const columnas = el('div', 'diario__columnas');
      for (const art of resto) columnas.appendChild(this._articulo(art, false));
      cuerpo.appendChild(columnas);
    }

    return cuerpo;
  }

  /**
   * El sumario de un caso: qué pasó, cómo está y qué llevas documentado.
   *
   * La lista de papeles es lo que hace que la página SE LLENE SEGÚN SE RECOGE
   * en vez de aparecer entera de golpe: los que tienes salen enteros, los que
   * te faltan salen tachados y con su nombre —que es el nombre del documento
   * real, no un adjetivo—, así que la página abierta sigue siendo una lista de
   * tareas y no un premio ya cobrado.
   */
  _sumarioCaso(caso) {
    const s = this.cuaderno.sumarioDelCaso(caso);
    if (!s) return null;

    const nodo = el('section', `sumario${s.completo ? ' sumario--completo' : ''}`);
    nodo.appendChild(el('div', 'sumario__rotulo',
      T('archivo.sumarioRotulo', { caso: cajaDeTitular(s.rotulo) })));
    // EL SELLO DE COMPLETO ES LA SEGUNDA META DE LA PÁGINA.
    //
    // Abrirla cuesta dos pruebas del caso y los barrios sueltan entre cuatro y
    // seis: sin un segundo estado, dos corridas por barrio abrían las cinco
    // páginas y ya no había ninguna razón para volver a ninguna parte.
    if (s.completo) {
      nodo.appendChild(el('div', 'sumario__sello', T('archivo.sumarioCompleto')));
    }
    nodo.appendChild(el('h3', 'sumario__titulo', s.titulo));
    nodo.appendChild(el('p', 'sumario__escena', s.escena));

    const estado = el('div', 'sumario__estado');
    estado.appendChild(el('span', 'sumario__etiqueta', T('archivo.sumarioEstado')));
    estado.appendChild(el('span', 'sumario__estado-texto', s.estado));
    nodo.appendChild(estado);

    if (s.total) {
      nodo.appendChild(el('div', 'sumario__etiqueta',
        T('archivo.sumarioPapeles', { n: s.reunidos, total: s.total })));

      const lista = el('ul', 'sumario__papeles');
      for (const papel of s.papeles) {
        const fila = el('li', `sumario__papel${papel.tengo ? ' sumario__papel--tengo' : ''}`);
        fila.appendChild(el('span', 'sumario__papel-nombre', papel.nombre));
        // La marca de «solo en redes» va SIEMPRE, la tengas o no. Es la regla
        // de la casa dicha en la propia lista: esta pieza no cierra el
        // reportaje aunque la hayas recogido.
        if (papel.redes) {
          fila.appendChild(el('span', 'sumario__papel-marca', T('archivo.sumarioRedes')));
        }
        lista.appendChild(fila);
      }
      nodo.appendChild(lista);

      nodo.appendChild(el('p', 'sumario__pie', s.completo
        ? T('archivo.sumarioCompletoPie', { lugar: cajaDeTitular(s.lugar) })
        : T('archivo.sumarioFaltan', { lugar: cajaDeTitular(s.lugar) })));
    }

    nodo.appendChild(el('p', 'sumario__aviso', T('archivo.sumarioAviso')));
    return nodo;
  }

  /**
   * El sumario de la última página, que no es de un caso: los cruza todos.
   *
   * Una línea por caso con en qué quedó y cuánto llegó a documentarse. Es la
   * única página del ejemplar que solo se lee entera al final, y por eso es la
   * que resume: aquí el jugador ve de una vez que abrió cuatro casos y que
   * ninguno se cerró.
   */
  _sumarioSeguimiento() {
    const casos = this.cuaderno.sumarioGeneral();
    if (!casos.length) return null;

    const nodo = el('section', 'sumario');
    nodo.appendChild(el('div', 'sumario__rotulo', T('archivo.sumarioSeguimiento')));
    nodo.appendChild(el('p', 'sumario__escena', T('archivo.sumarioSeguimientoAviso')));

    const lista = el('ul', 'sumario__casos');
    for (const c of casos) {
      const fila = el('li', `sumario__caso${c.completo ? ' sumario__caso--completo' : ''}`);
      fila.appendChild(el('div', 'sumario__caso-rotulo', cajaDeTitular(c.rotulo)));
      fila.appendChild(el('div', 'sumario__caso-estado', c.estado));
      fila.appendChild(el('div', 'sumario__caso-cuenta', c.completo
        ? T('archivo.sumarioCompleto')
        : T('archivo.sumarioPapeles', { n: c.reunidos, total: c.total })));
      lista.appendChild(fila);
    }
    nodo.appendChild(lista);

    // La cuenta de arriba: cuántos casos están enteros. Es la única cifra del
    // Archivo que mide la investigación completa y no una página suelta.
    nodo.appendChild(el('div', 'sumario__etiqueta',
      T('archivo.sumarioCasosCompletos', {
        n: casos.filter((c) => c.completo).length,
        total: casos.length,
      })));

    nodo.appendChild(el('p', 'sumario__aviso', T('archivo.sumarioAviso')));
    return nodo;
  }

  /**
   * Un artículo maquetado. Si sigue pendiente, se reserva el espacio con su
   * tema y un sello —como haría un diario con una pieza que aún no cierra—
   * en lugar de inventar el titular.
   */
  _articulo(art, esDestacado) {
    const nodo = el('article', `articulo ${esDestacado ? 'articulo--destacado' : ''}`.trim());

    if (art.pendiente) {
      nodo.appendChild(el('div', 'articulo__antetitulo', art.tema));
      nodo.appendChild(el('div', 'articulo__reservado', T('archivo.reservado')));
      nodo.appendChild(el('p', 'articulo__cuerpo',
        T('archivo.enPreparacion')));
      return nodo;
    }

    nodo.appendChild(el('div', 'articulo__antetitulo', art.tema));
    nodo.appendChild(el('h3', 'articulo__titular', art.titular));
    if (art.bajada) nodo.appendChild(el('p', 'articulo__bajada', art.bajada));

    const firma = el('div', 'articulo__firma');
    if (art.autoria) firma.appendChild(el('span', '', art.autoria));
    if (art.fecha) firma.appendChild(el('span', '', art.fecha));
    nodo.appendChild(firma);

    if (art.url) {
      const enlace = el('a', 'articulo__enlace', T('archivo.leer'));
      enlace.href = art.url;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
      nodo.appendChild(enlace);
    }

    return nodo;
  }

  /** Página sin desbloquear: se ve el papel doblado y el precio. */
  _paginaCerrada(pagina, repintar) {
    const cerrada = el('div', 'pagina-cerrada');

    cerrada.appendChild(el('div', 'pagina-cerrada__sello', T('archivo.sinRecuperar')));
    cerrada.appendChild(el('h3', 'pagina-cerrada__titulo', pagina.nombre));

    // DE QUÉ CASO SALE ESTA PÁGINA.
    //
    // Faltaba, y era justo lo que convierte el Archivo en un objetivo: la
    // página decía «2 de 4 pruebas» sin decir de qué, así que el jugador sabía
    // que le faltaban dos y no dónde ir a buscarlas. Con el caso delante, el
    // Archivo deja de ser un marcador y pasa a ser una lista de tareas: te
    // faltan dos del Caso Porsche, o sea vuelve a la Bahía.
    if (pagina.caso) {
      const esc = ESCENARIOS[pagina.caso];
      if (esc) {
        const donde = el('div', 'pagina-cerrada__caso');
        donde.appendChild(el('span', 'pagina-cerrada__caso-nombre',
          cajaDeTitular(esc.caso)));
        donde.appendChild(el('span', 'pagina-cerrada__caso-lugar', esc.nombre));
        cerrada.appendChild(donde);
      }
    }

    const temas = el('ul', 'pagina-cerrada__temas');
    for (const art of pagina.articulos) {
      temas.appendChild(el('li', '', art.tema));
    }
    cerrada.appendChild(temas);

    // LO QUE FALTA SON PRUEBAS, NO DINERO.
    //
    // Aquí había un precio en papeles y un botón de comprar. Un reportaje no se
    // compra: se arma. Lo que se enseña ahora es cuántas pruebas del caso
    // llevas y cuántas hacen falta, y la página se abre sola al terminar la
    // corrida en que reúnes la última.
    const pedidas = pagina.pruebasPedidas ?? 0;
    const reunidas = Math.min(pagina.pruebasReunidas ?? 0, pedidas);

    cerrada.appendChild(el('div', 'pagina-cerrada__precio',
      `${reunidas} de ${pedidas} pruebas`));

    const medidor = el('div', 'pagina-cerrada__medidor');
    for (let i = 0; i < pedidas; i++) {
      medidor.appendChild(el('span',
        `pagina-cerrada__prueba${i < reunidas ? ' pagina-cerrada__prueba--hecha' : ''}`));
    }
    cerrada.appendChild(medidor);

    cerrada.appendChild(el('div', 'pagina-cerrada__ayuda',
      reunidas >= pedidas
        ? T('archivo.yaPuedes')
        : T('archivo.comoAbrir')));

    return cerrada;
  }

  /**
   * LO QUE DICE EL GOBIERNO — la contraportada del material plantado.
   *
   * Recoger una prueba falsa era un castigo mudo: la metías en la mochila
   * creyendo que servía, al contrastarla salía NO SE SOSTIENE y ahí acababa
   * todo. El chiste estaba, pero se quedaba a medias, porque en la realidad
   * que esto satiriza el material plantado no desaparece: se publica.
   *
   * Aquí se cierra. Cada pieza que te colaron aparece con el titular que un
   * medio afín construyó a partir de ella. Tú corriste, te la colaron, y al
   * día siguiente sale en portada de otro.
   *
   * Va con OTRA PIEL a propósito —fondo de tinta, sin filetes de El Mercio—
   * porque estos titulares son inventados y el resto del Archivo no. Que no se
   * puedan confundir no es maquetación: es la línea que separa la sátira de
   * aquello de lo que se ríe.
   *
   * @returns {HTMLElement|null} null si no te han colado nada todavía
   */
  _pintarVersionOficial() {
    const plantadas = this.cuaderno?.plantadas ?? [];
    const fichas = plantadas
      .map((nombre) => ({ nombre, pub: publicacionDe(nombre) }))
      .filter((f) => f.pub);
    if (!fichas.length) return null;

    const caja = el('section', 'contraversion');
    caja.appendChild(el('div', 'contraversion__rotulo', T('archivo.versionOficial')));
    caja.appendChild(el('p', 'contraversion__nota', T('archivo.versionOficialNota')));

    for (const { nombre, pub } of fichas) {
      const recorte = el('article', 'contraversion__recorte');

      const cabecera = el('div', 'contraversion__medio');
      cabecera.appendChild(el('span', 'contraversion__marca', pub.medio.nombre));
      cabecera.appendChild(el('span', 'contraversion__tipo', pub.medio.tipo));
      recorte.appendChild(cabecera);

      recorte.appendChild(el('h4', 'contraversion__titular', pub.titular));
      recorte.appendChild(el('p', 'contraversion__bajada', pub.bajada));

      // De qué pieza tuya salió. Es lo que cierra el círculo: sin esta línea
      // el recorte es una noticia más y no LA CONSECUENCIA de lo que recogiste.
      recorte.appendChild(el('div', 'contraversion__origen',
        T('archivo.versionOficialOrigen', { pieza: nombre })));

      caja.appendChild(recorte);
    }

    return caja;
  }

  /** Paginador inferior, con el estado de cada página. */
  _navegadorPaginas(paginas, actual, alElegir) {
    const nav = el('nav', 'paginador');

    for (const p of paginas) {
      const b = el('button',
        `paginador__pag ${p.numero === actual ? 'paginador__pag--actual' : ''} ` +
        `${p.desbloqueada ? '' : 'paginador__pag--cerrada'}`.trim());
      b.type = 'button';
      b.textContent = String(p.numero);
      // NO CUESTAN PAPELES, y esto lo decía. Las páginas se completan con las
      // pruebas de su caso desde que se quitó la compra; el título seguía
      // prometiendo un precio en papeles que no cobra nadie.
      b.title = p.desbloqueada
        ? p.nombre
        : `${p.nombre} · ${p.pruebasReunidas} de ${p.pruebasPedidas} pruebas`;
      b.addEventListener('click', () => alElegir(p.numero));
      nav.appendChild(b);
    }

    return nav;
  }

  // -------------------------------------------------------------------------
  // PAUSA
  // -------------------------------------------------------------------------

  pausa() {
    // Hasta la pausa es una sección: CIERRE DE EDICIÓN, que es como se llama en
    // un periódico el rato en que todo se detiene y hay que decidir con qué se
    // sale. Es la pantalla más tonta del juego y por eso mismo tenía que ir
    // impresa: si esta se salvara del papel, el sistema no sería un sistema.
    const { pantalla, contenido, plana } = seccionDiario({
      seccion: T('pausa.seccion'),
      antetitulo: T('pausa.antetitulo'),
      titular: T('pausa.titular'),
      bajada: T('pausa.bajada'),
    });

    // La pausa no tiene contenido variable, pero su aire se declara igual que
    // el de las demás: un bloque elástico vacío. Así la anatomía de la página
    // es la misma en las doce pantallas y los botones caen donde caen siempre.
    plana.appendChild(el('div', 'se-estira'));

    const botones = el('div', 'botones');
    botones.appendChild(boton(T('pausa.seguir'), 'boton--principal',
      () => this.juego.reanudar()));
    // ABANDONAR NO ES QUE TE ATRAPEN. Esto llamaba a terminarPartida('captura'),
    // o sea que retirarse a la portada montaba el cerco, el sorteo del juez y
    // la primera plana con foto de arresto incluida. Ver Game.abandonarPartida:
    // cierra la corrida —lo recogido se queda— y vuelve al menú.
    botones.appendChild(boton(T('pausa.abandonar'), 'boton--tenue',
      () => this.juego.abandonarPartida()));
    contenido.appendChild(botones);

    escalonar(plana);
    return pantalla;
  }
}
