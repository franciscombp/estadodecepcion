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
// Estilo en docs/ESTILO.md.
// ============================================================================

import { obtenerEscenario, ORDEN_ESCENARIOS, ESCENARIOS } from '../config/escenarios.js';
import { CABECERA, hayPendientes, cuantosListos } from '../config/publicaciones.js';
import { CATALOGO_POTENCIADORES } from '../config/balance.js';
import { CLASIFICACIONES, clasificacion, tablaConJugador } from '../config/tabla.js';
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

function boton(texto, clase, alPulsar) {
  const b = el('button', `boton ${clase ?? ''}`.trim(), texto);
  b.type = 'button';
  b.addEventListener('click', alPulsar);
  return b;
}

/** Cabecera con el sello de El Mercio. */
function marca(texto = 'EL MERCIO') {
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

  const cab = el('header', 'plana__cabecera');
  cab.appendChild(el('span', 'plana__nombre', CABECERA.nombre));
  cab.appendChild(el('span', 'plana__fecha', seccion));
  plana.appendChild(cab);

  if (antetitulo) plana.appendChild(el('div', 'plana__antetitulo', antetitulo));
  if (titular) plana.appendChild(el('h1', 'plana__titular plana__titular--tabla', titular));
  if (bajada) plana.appendChild(el('div', 'plana__epigrafe', bajada));

  contenido.appendChild(plana);
  return { pantalla, contenido, plana };
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

    const plana = el('div', 'plana plana--menu');
    // La hoja va en DOS bloques con un hueco entre medias, y no de una pieza,
    // porque por ese hueco tiene que verse la partida corriendo. Un papel de
    // una pieza es opaco por definición: la «ventana» quedaba tapada por su
    // propio fondo. Partido, el hueco es hueco de verdad —como el troquel de
    // una portada—, y las dos mitades siguen leyéndose como la misma página
    // porque comparten grano, filetes y márgenes.
    const bloqueAlto = el('div', 'plana__bloque');

    // ══ MANCHETA ════════════════════════════════════════════════════════
    const mancheta = el('header', 'plana__mancheta');
    mancheta.appendChild(el('h1', 'plana__cabeza', CABECERA.nombre));
    mancheta.appendChild(el('div', 'plana__lema', CABECERA.lema));
    bloqueAlto.appendChild(mancheta);

    // ══ TITULAR ═════════════════════════════════════════════════════════
    // El escenario va EN el titular y no en una ficha aparte: es la noticia de
    // esta edición, no un dato de configuración.
    bloqueAlto.appendChild(el('h2', 'plana__titular plana__titular--menu',
      `ESTADO DE EXCEPCIÓN: ${esc.nombre}`));
    bloqueAlto.appendChild(el('div', 'plana__epigrafe plana__epigrafe--menu', esc.subtitulo));
    plana.appendChild(bloqueAlto);

    // ══ LA FOTO ═════════════════════════════════════════════════════════
    // El hueco por el que se ve la escena, ahora encuadrado como una foto de
    // prensa: filete, fondo transparente y pie debajo.
    const figura = el('figure', 'portada__foto');
    figura.appendChild(el('div', 'portada__hueco'));
    plana.appendChild(figura);

    const arriba = el('div', 'portada__arriba');
    plana.appendChild(arriba);
    contenido.appendChild(plana);

    // ══ BANDA INFERIOR ══════════════════════════════════════════════════
    const abajo = el('div', 'portada__abajo');

    // --- Personaje ---------------------------------------------------------
    // Fichas pequeñas: al que eliges se le ve en la escena, así que el texto no
    // tiene que describirlo.
    //
    // LOS BLOQUEADOS SE ENSEÑAN IGUAL, en gris y con el candado. Un personaje
    // que no sabías que existía no tira de ti; ver una ficha apagada con lo que
    // falta para ficharla, sí. Es lo mismo que hace el arsenal justo debajo.
    const abiertos = new Set(this.cuaderno.personajesDesbloqueados());
    let elegido = abiertos.has(this.cuaderno.personajePreferido)
      ? this.cuaderno.personajePreferido
      : PERSONAJES[0].id;

    const personajes = el('div', 'elector');
    const fichas = PERSONAJES.map((def) => {
      const abierto = abiertos.has(def.id);
      const ficha = el('button', `elector__ficha ${abierto ? '' : 'elector__ficha--cerrada'}`.trim());
      ficha.type = 'button';
      ficha.appendChild(el('span', 'elector__nombre', abierto ? def.nombre : '???'));
      // Debajo del nombre, la SECCIÓN. Es una palabra y hace todo el trabajo
      // del lore: cuatro fichas que ponen Política, Sociedad, Investigación y
      // Calle no se leen como cuatro skins, se leen como una redacción. Sin
      // esto, que todos trabajen para El Mercio era algo que solo sabía yo.
      if (abierto) ficha.appendChild(el('span', 'elector__seccion', def.seccion));
      ficha.title = abierto ? `${def.nombre} — ${def.nota}` : `Se ficha a los ${def.tramos} tramos`;

      if (!abierto) {
        ficha.appendChild(el('span', 'elector__candado', `${def.tramos} tramos`));
        ficha.disabled = true;
      } else if (def.id === elegido) {
        ficha.classList.add('elector__ficha--elegida');
      }

      ficha.addEventListener('click', () => {
        elegido = def.id;
        fichas.forEach((f) => f.classList.remove('elector__ficha--elegida'));
        ficha.classList.add('elector__ficha--elegida');
        this.juego.previsualizarPersonaje(def.id);
        this.audio.cambioCarril();
      });

      personajes.appendChild(ficha);
      return ficha;
    });
    abajo.appendChild(personajes);

    // --- Arsenal, en una tira ---------------------------------------------
    abajo.appendChild(this._pintarArsenal());

    // --- Jugar -------------------------------------------------------------
    abajo.appendChild(boton('JUGAR', 'boton--diario boton--diario-principal boton--jugar-plana', () => {
      this.audio.iniciar();
      this.audio.reanudar();
      this.juego.iniciarPartida(elegido);
    }));

    // --- Secundarios -------------------------------------------------------
    const secundarios = el('div', 'portada__secundarios');
    secundarios.appendChild(boton('Archivo', 'boton--diario', () => {
      this.mostrar(this.notebook());
    }));
    secundarios.appendChild(boton('Marcadores', 'boton--diario', () => {
      this.mostrar(this.marcadores());
    }));
    secundarios.appendChild(boton('Ajustes', 'boton--diario', () => {
      this.mostrar(this.ajustes());
    }));
    abajo.appendChild(secundarios);
    escalonar(abajo);

    abajo.insertBefore(el('div', 'plana__pie plana__pie--foto',
      `${esc.caso} · Fotografía de archivo`), abajo.firstChild);

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
    const { pantalla, contenido, plana } = seccionDiario({
      seccion: 'ADMINISTRACIÓN',
      antetitulo: 'CÓMO SE USA ESTE EJEMPLAR',
      titular: 'LA REDACCIÓN',
      bajada: 'Controles, edición y el botón de tirarlo todo a la basura',
    });

    plana.appendChild(ladillo('CONTROLES'));
    plana.appendChild(this._pintarControles());

    plana.appendChild(ladillo('EDICIÓN'));
    plana.appendChild(this._pintarVersion(pantalla));

    // No es letra pequeña legal: es contexto, y en un periódico eso va en el
    // pie de la página de administración, no perdido debajo de los botones.
    plana.appendChild(el('div', 'plana__nota-tabla',
      'Sátira política de El Mercio. Los personajes y textos son ficción y no '
      + 'reproducen declaraciones de personas reales.'));

    const botones = el('div', 'diario__acciones');
    botones.appendChild(boton('Volver', 'boton--diario boton--diario-principal',
      () => this.juego.volverAlMenu()));

    if (this.cuaderno.partidasJugadas > 0) {
      let confirmando = false;
      const btn = boton('Borrar progreso', 'boton--diario boton--diario-peligro', () => {
        if (!confirmando) {
          confirmando = true;
          btn.textContent = '¿Seguro? Pulsa otra vez';
          setTimeout(() => { confirmando = false; btn.textContent = 'Borrar progreso'; }, 3000);
          return;
        }
        this.cuaderno.reiniciarProgreso();
        this.juego.volverAlMenu();
      });
      botones.appendChild(btn);
    }
    contenido.appendChild(botones);

    const pie = el('div', 'pie');
    pie.appendChild(document.createTextNode('elmercio.com · '));
    const enlace = el('a', '', 'El Mercio');
    enlace.href = 'https://elmercio.com';
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    pie.appendChild(enlace);
    contenido.appendChild(pie);

    escalonar(plana);
    return pantalla;
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
    const proximo = this.cuaderno.proximoPotenciador();

    const bloque = el('div', 'arsenal');

    const fila = el('div', 'arsenal__fila');
    for (const pot of CATALOGO_POTENCIADORES) {
      const abierto = abiertos.has(pot.id);
      const casilla = el('div', `arsenal__casilla ${abierto ? '' : 'arsenal__casilla--cerrada'}`.trim());
      casilla.innerHTML = Icono.iconoPotenciador(pot.id, 26);
      casilla.title = abierto
        ? `${pot.nombre} — ${pot.descripcion}`
        : `${pot.nombre} — se abre a los ${pot.tramos} tramos`;
      if (!abierto) casilla.appendChild(el('span', 'arsenal__candado', '?'));
      fila.appendChild(casilla);
    }
    bloque.appendChild(fila);

    bloque.appendChild(el('div', 'arsenal__pista', proximo
      ? `${proximo.nombre} a ${proximo.faltan} ${proximo.faltan === 1 ? 'tramo' : 'tramos'}`
      : 'Arsenal completo. Ahora solo queda el expediente perfecto.'));

    return bloque;
  }

  /** Chuleta de controles. */
  _pintarControles() {
    const instrucciones = el('div', 'instrucciones');
    const controles = [
      [Icono.flecha('izquierda', 18), 'Carril', '← → o swipe lateral'],
      [Icono.flecha('arriba', 18), 'Saltar', '↑, espacio o swipe arriba'],
      [Icono.flecha('abajo', 18), 'Agacharse', '↓ o swipe abajo'],
      [Icono.pausa(18), 'Pausa', 'ESC o el botón'],
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
      act ? `v${act.version} · ${act.edicion}` : 'edición de desarrollo'));

    // SIN BOTÓN DE BUSCAR. Se comprueba al abrir el juego y cada hora, y la
    // edición nueva entra sola: durante el arranque de inmediato —con la
    // pantalla de carga aún puesta, así que ni se ve— y si aparece jugando, al
    // terminar la corrida. Un botón para pedir a mano lo que ya pasa solo no
    // da control, da la duda de si hace falta pulsarlo.
    panel.appendChild(el('div', 'edicion__nota',
      'Se comprueba al abrir y cada hora. La edición nueva entra sola: al '
      + 'arrancar, o al terminar la corrida si estabas jugando.'));

    const ESTADOS_TEXTO = {
      'sin-soporte': ['Sin modo offline en este navegador', 'edicion--tenue'],
      preparando: ['Guardando el juego para jugar sin conexión…', 'edicion--espera'],
      listo: ['Listo para jugar sin conexión', 'edicion--listo'],
      buscando: ['Buscando edición nueva…', 'edicion--espera'],
      disponible: ['Hay una edición nueva. Toca para instalarla', 'edicion--nueva'],
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
      seccion: 'CONTEXTO',
      antetitulo: esEntrada ? 'ENTRAS AL TRÁMITE' : 'SE ACABÓ EL PASILLO',
      titular: datos.institucion,
      clase: 'pantalla--relato',
    });

    // El cuerpo: dos o tres frases, tamaño de lectura, sin prisa.
    const relato = el('div', 'relato');
    for (const parrafo of String(datos.relato ?? '').split('\n').filter(Boolean)) {
      relato.appendChild(el('p', 'relato__parrafo', parrafo.trim()));
    }
    plana.appendChild(relato);

    // El remate en voz de El Mercio, que es la línea que ya existía y que
    // ahora tiene sitio para leerse.
    if (datos.remate) {
      const remate = el('div', 'remate');
      remate.appendChild(document.createTextNode(datos.remate));
      remate.appendChild(el('span', 'remate__firma', 'El Mercio'));
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
        [String(datos.recuperados ?? 0), 'Del suelo'],
        [String(datos.perdidos ?? 0), 'Ahí quedaron'],
        [String(datos.devueltos ?? (datos.recuperados ?? 0) * mult), `Al marcador ×${mult}`],
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
        texto.appendChild(el('span', 'desbloqueo__etiqueta', 'PERO SALES CON ALGO'));
        texto.appendChild(el('span', 'desbloqueo__nombre', datos.hallazgo));
        caja.appendChild(texto);
        plana.appendChild(caja);
      }
    }

    const botones = el('div', 'botones');
    botones.appendChild(boton(
      esEntrada ? 'ENTRAR' : 'SEGUIR CORRIENDO',
      'boton--principal',
      () => this.juego.continuarRelato(datos.fase),
    ));
    contenido.appendChild(botones);

    escalonar(plana);
    return pantalla;
  }

  escape(datos) {
    // Sección JUDICIALES, que es exactamente donde un periódico pondría esto:
    // a quién le tocó qué sala. Que el sorteo salga impreso en la misma página
    // en la que mañana saldrá la sentencia es la mitad del chiste.
    const { pantalla, contenido, plana } = seccionDiario({
      seccion: 'JUDICIALES',
      antetitulo: 'TE RODEARON',
      titular: 'SORTEO DE JUEZ QUE LLEVARÁ TU CAUSA',
      bajada: 'Cinco llevan la camiseta. Para el selector en el que no la lleva.',
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
      toga.innerHTML = Icono.juez(38, esHonesto);
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

    const marcar = () => {
      fichas.forEach((f, i) => {
        f.classList.toggle('juez--senalado', i === indiceGlobal);
      });
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

    const botones = el('div', 'botones');
    contenido.appendChild(botones);

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
        banda.style.transition = 'transform 0.22s cubic-bezier(0.22, 0.9, 0.3, 1)';
        marcar();
      }

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
        acerto ? 'MEDIDAS SUSTITUTIVAS' : 'LE TOCÓ UNO DE ELLOS'));
      caja.appendChild(el('div', 'resultado__texto', acerto
        ? 'Sales caminando y con la orden de no salir del país. Sigue corriendo.'
        : 'La sentencia sale mañana en primera plana.'));
      zonaResultado.appendChild(caja);

      this.audio.resultadoRuleta(acerto);

      // Un respiro para leer el resultado antes de que cambie la pantalla.
      setTimeout(() => this.juego.escapar(acerto), acerto ? 900 : 1300);
    };

    const botonParar = boton('PARAR', 'boton--principal', parar);
    botones.appendChild(botonParar);

    // Espacio y toque también valen: en móvil el pulgar ya está en la
    // pantalla, y obligar a apuntar al botón añade una dificultad que no tiene
    // nada que ver con lo que se está midiendo.
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
      seccion: 'PORTADA',
      antetitulo: 'SE PRESENTÓ LA DENUNCIA',
      titular: 'PROSPERÓ',
      bajada: datos.institucion,
      clase: 'pantalla--victoria',
    });

    const remate = el('div', 'remate');
    remate.appendChild(document.createTextNode(datos.texto));
    remate.appendChild(el('span', 'remate__firma', 'El Mercio'));
    plana.appendChild(remate);

    plana.appendChild(el('p', 'plana__cuerpo',
      `Te tiraron el expediente por el suelo y lo recogiste entero: ` +
      `${datos.papelesEntregados} papeles, sin que falte uno. ` +
      'No sabemos cómo lo lograste, pero lo lograste.'));

    plana.appendChild(estadisticas([
      [datos.papeles.toLocaleString('es-EC'), 'Evidencia'],
      [`${datos.distancia.toLocaleString('es-EC')} m`, 'Distancia'],
      [datos.puntaje.toLocaleString('es-EC'), 'Puntaje'],
      [String(datos.pruebas.length), 'Pruebas'],
    ]));

    if (datos.ruta?.length > 1) {
      plana.appendChild(ladillo('RUTA DE ESTA CORRIDA'));
      plana.appendChild(this._pintarRuta(datos.ruta));
    }

    this._pintarDesbloqueos(datos, plana);

    const botones = el('div', 'botones');
    botones.appendChild(boton('Volver a correr', 'boton--principal',
      () => this.juego.iniciarPartida()));
    botones.appendChild(boton('Archivo de El Mercio', '',
      () => this.mostrar(this.notebook())));
    botones.appendChild(boton('Menú principal', 'boton--tenue',
      () => this.juego.volverAlMenu()));
    contenido.appendChild(botones);

    escalonar(plana);
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
    botones.appendChild(boton('CONTINUAR', 'boton--principal',
      () => this.mostrar((datos.pruebas?.length)
        ? this.botin(datos)
        : this.deportes(datos))));
    contenido.appendChild(botones);

    escalonar(contenido);

    // Disparar el flash después de montar la pantalla
    // Esto permite que la animación ocurra visiblemente
    requestAnimationFrame(() => {
      pantalla.classList.add('pantalla--foto-flash-active');
    });

    return pantalla;
  }

  // -------------------------------------------------------------------------
  // DEPORTES — la segunda página del mismo ejemplar
  // -------------------------------------------------------------------------
  // Se pasa de hoja y la portada da paso a la tabla, con sus tres
  // clasificaciones en pestañas. Es la misma edición: misma mancheta, mismo
  // papel, otra sección.
  //
  // Estaban las dos cosas en la misma página y no cabían: la portada quiere
  // foto grande y una cifra enorme, la tabla quiere filas. Juntas obligaban a
  // hacer scroll justo en el momento en que el jugador quiere volver a jugar.

  deportes(datos = null) {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--plana');

    const plana = el('div', 'plana');

    const cab = el('header', 'plana__cabecera');
    cab.appendChild(el('span', 'plana__nombre', CABECERA.nombre));
    cab.appendChild(el('span', 'plana__fecha', 'DEPORTES'));
    plana.appendChild(cab);

    // El antetítulo, el título y el epígrafe cambian con la pestaña, así que
    // se guardan. El antetítulo cambia porque «Más buscados» no es una tabla de
    // méritos: es una circular, y tiene que anunciarse como tal.
    const antetitulo = el('div', 'plana__antetitulo', '');
    const titular = el('h1', 'plana__titular plana__titular--tabla', '');
    const epigrafe = el('div', 'plana__epigrafe', '');
    const cuerpoTabla = el('div', 'plana__tabla');
    plana.appendChild(antetitulo);

    // --- Pestañas ----------------------------------------------------------
    const pestanas = el('div', 'pestanas');
    const botonesPestana = new Map();

    const pintar = (id) => {
      const clase = clasificacion(id);
      antetitulo.textContent = clase.antetitulo;
      titular.textContent = clase.titulo;
      epigrafe.textContent = clase.epigrafe;
      // La circular de búsqueda se imprime distinta del resto de la sección:
      // filete grueso arriba y abajo, como los carteles de verdad.
      plana.classList.toggle('plana--circular', id === 'papeles');

      for (const [otro, b] of botonesPestana) {
        b.classList.toggle('pestana--activa', otro === id);
      }

      cuerpoTabla.innerHTML = '';
      cuerpoTabla.appendChild(this._listaPosiciones(clase, datos));
      this.pestanaDeportes = id;
    };

    for (const clase of CLASIFICACIONES) {
      const b = boton(clase.pestana, 'pestana', () => {
        this.audio.cambioCarril();
        pintar(clase.id);
      });
      pestanas.appendChild(b);
      botonesPestana.set(clase.id, b);
    }

    plana.appendChild(titular);
    plana.appendChild(pestanas);
    plana.appendChild(epigrafe);
    plana.appendChild(cuerpoTabla);

    // Al perder se abre SIEMPRE por la marca personal, que es la que habla de
    // la partida que se acaba de jugar. Desde el menú se recuerda la última
    // que se miró, porque ahí sí se está buscando algo concreto.
    pintar(datos ? 'mejor' : (this.pestanaDeportes ?? 'papeles'));

    plana.appendChild(el('div', 'plana__nota-tabla',
      'Tabla de muestra. Todavía no hay marcadores en línea: los puestos que no '
      + 'son el tuyo son de mentira, como tantas cosas.'));

    // Lo desbloqueado va aquí y no en la portada: es lo último que se lee
    // antes de decidir si se vuelve a correr, y habla del futuro.
    if (datos) this._pintarDesbloqueos(datos, plana);

    contenido.appendChild(plana);

    const botones = el('div', 'botones');
    if (datos) {
      const donde = obtenerEscenario(datos.escenario ?? this.juego.escenarioActual);
      botones.appendChild(boton(`INTENTAR DE NUEVO · ${donde.nombre}`, 'boton--principal',
        () => this.juego.iniciarPartida()));
      botones.appendChild(boton('Ver todo el diario', '',
        () => this.mostrar(this.notebook())));
      botones.appendChild(boton('Menú principal', 'boton--tenue',
        () => this.juego.volverAlMenu()));
    } else {
      botones.appendChild(boton('Volver', 'boton--principal',
        () => this.juego.volverAlMenu()));
    }
    contenido.appendChild(botones);

    escalonar(contenido);
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
    const cab = el('header', 'plana__cabecera');
    cab.appendChild(el('span', 'plana__nombre', CABECERA.nombre));
    cab.appendChild(el('span', 'plana__fecha', 'EDICIÓN DE MAÑANA'));
    plana.appendChild(cab);

    const titulos = {
      captura: 'TE ALCANZARON',
      exhausto: 'SIN FUERZAS',
      cerco: 'CRUZASTE EL CERCO',
    };
    const sentencia = datos.sentencia;

    plana.appendChild(el('div', 'plana__antetitulo',
      sentencia ? 'PERIODISTA DETENIDO' : 'SE INTERRUMPE LA COBERTURA'));
    plana.appendChild(el('h1', 'plana__titular',
      sentencia?.titular ?? titulos[datos.motivo] ?? 'SE ACABÓ'));

    // --- La foto del arresto -----------------------------------------------
    // Sale del propio juego: es el fotograma del cerco, con el círculo ya
    // cerrado. Que la imagen sea LA TUYA y no una ilustración genérica es lo
    // que convierte el resumen en una noticia sobre ti.
    if (datos.foto) plana.appendChild(this._fotoArresto(datos));

    if (sentencia) plana.appendChild(el('p', 'plana__bajada', sentencia.texto));

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
    marcador.appendChild(el('span', 'plana__marcador-rotulo', 'PRUEBAS RECOGIDA'));

    const cifra = el('span', 'plana__marcador-cifra', '0');
    marcador.appendChild(cifra);
    contarHasta(cifra, papeles);

    if (datos.esRecord && papeles > 0) {
      const sello = el('span', 'plana__record', 'RÉCORD PERSONAL');
      // El sello cae DESPUÉS de que la cifra termine de subir. Apareciendo a la
      // vez compiten, y lo que se quiere es que primero se lea el número y
      // luego llegue la palmadita.
      sello.style.animationDelay = '0.95s';
      marcador.appendChild(sello);
    }
    plana.appendChild(marcador);

    plana.appendChild(el('div', 'plana__datos',
      `${(datos.distancia ?? 0).toLocaleString('es-EC')} m corridos · `
      + `${(datos.puntaje ?? 0).toLocaleString('es-EC')} de puntaje`));

    // --- LO QUE SÍ SACASTE -------------------------------------------------
    //
    // Te capturaron, sí. Pero saliste con pruebas, y las pruebas se quedan: son
    // lo que arma el reportaje. Enseñarlas AQUÍ, en la portada de la derrota, es
    // la mitad del sentido del juego —documentar no se castiga; correr mal, sí—
    // y era justo lo que faltaba: la pantalla contaba metros y puntos, o sea
    // solo lo que habías perdido.
    const pruebas = datos.pruebas ?? [];
    if (pruebas.length) {
      const caja = el('div', 'plana__pruebas');
      caja.appendChild(el('div', 'plana__pruebas-rotulo',
        pruebas.length === 1 ? 'SACASTE UNA PRUEBA' : `SACASTE ${pruebas.length} PRUEBAS`));
      const lista = el('ul', 'plana__pruebas-lista');
      for (const nombre of pruebas) lista.appendChild(el('li', '', nombre));
      caja.appendChild(lista);
      plana.appendChild(caja);
    }

    // --- Y si con ellas se completó un reportaje ---------------------------
    for (const pagina of datos.paginasNuevas ?? []) {
      const abierta = el('div', 'plana__reportaje');
      abierta.appendChild(el('span', 'plana__reportaje-sello', 'REPORTAJE COMPLETO'));
      abierta.appendChild(el('span', 'plana__reportaje-nombre', pagina.nombre));
      plana.appendChild(abierta);
    }

    // --- LO QUE VIENE ------------------------------------------------------
    //
    // La razón para volver a jugar, dicha en una línea y con un número que
    // falta. Es lo único que faltaba en esta pantalla: contaba lo que habías
    // hecho —bien— pero no daba ningún motivo para pulsar otra vez. «Te falta
    // UNA prueba para Política» es ese motivo, y funciona porque es concreto,
    // es corto y depende de ti.
    //
    // Va después del reportaje completado a propósito: primero la palmadita por
    // lo que cerraste, y encima, el siguiente al alcance de la mano.
    const siguiente = this.cuaderno?.proximaPagina?.();
    if (siguiente && siguiente.pruebasPedidas > 0) {
      const meta = el('div', 'plana__meta');
      meta.appendChild(el('div', 'plana__meta-rotulo', 'EN LA SIGUIENTE CORRIDA'));

      const frase = siguiente.faltan === 0
        ? `«${siguiente.nombre}» sale con lo que ya tienes.`
        : siguiente.faltan === 1
          ? `Te falta UNA prueba para «${siguiente.nombre}».`
          : `Te faltan ${siguiente.faltan} pruebas para «${siguiente.nombre}».`;
      meta.appendChild(el('div', 'plana__meta-frase', frase));

      const barra = el('div', 'plana__meta-casillas');
      for (let i = 0; i < siguiente.pruebasPedidas; i++) {
        barra.appendChild(el('span',
          `plana__meta-casilla${i < siguiente.pruebasReunidas ? ' plana__meta-casilla--hecha' : ''}`));
      }
      meta.appendChild(barra);
      plana.appendChild(meta);
    }

    // --- El remate editorial, como pie de la nota --------------------------
    if (datos.texto) {
      const cuerpo = el('p', 'plana__cuerpo');
      cuerpo.appendChild(document.createTextNode(datos.texto));
      plana.appendChild(cuerpo);
      plana.appendChild(el('div', 'plana__firma', 'El Mercio'));
    }

    // La TABLA y los DESBLOQUEOS ya no están aquí: se fueron a la página de
    // deportes. Con todo junto la portada no cabía en una pantalla de móvil y
    // había que hacer scroll justo cuando lo que se quiere es volver a jugar.
    // Una portada es una portada: titular, foto, cifra y a pasar de hoja.
    return plana;
  }

  // -------------------------------------------------------------------------
  // BOTÍN — Lo que sacaste, en la mano
  // -------------------------------------------------------------------------

  /**
   * LAS PRUEBAS, GRANDES Y GIRANDO.
   *
   * En la portada salían como una lista de viñetas, y una lista es un dato:
   * dice qué tienes y no que sea importante. Lo que hace que un hallazgo se
   * sienta hallazgo es verlo ocupar la pantalla, con volumen y con brillo,
   * antes de que se vaya al inventario. Es la pausa que todos los juegos hacen
   * al soltar un objeto raro, y es donde está la recompensa de una corrida que
   * por lo demás terminó en captura.
   *
   * El volumen se hace con perspectiva y giro en CSS sobre el mismo icono que
   * ya usa el HUD, no con un segundo lienzo 3D: montar un renderizador nuevo
   * para enseñar cuatro fichas costaría más memoria y un tirón de arranque
   * justo en el momento en que se busca fluidez.
   */
  botin(datos) {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--botin');

    contenido.appendChild(el('div', 'botin__antetitulo', 'SALISTE CON ESTO'));

    const pruebas = datos.pruebas ?? [];
    const buenas = pruebas.filter((n) => !Notebook.esFalsa(n)).length;
    contenido.appendChild(el('h1', 'botin__titular',
      buenas === 0 ? 'NADA QUE SOSTENGA'
        : buenas === 1 ? 'UNA PRUEBA' : `${buenas} PRUEBAS`));

    const rejilla = el('div', 'botin__rejilla');

    // EL DESFILE VA DE UNO EN UNO. Antes las piezas entraban casi solapadas
    // (0,42 s) y se leían como una rejilla que se llena; ahora cada objeto
    // tiene su turno entero —aparece, brilla, y su sello de RECUPERADA le cae
    // encima— antes de que asome el siguiente. Es el ritmo de los juegos que
    // celebran el botín pieza a pieza, y es lo que convierte la lista en una
    // ceremonia.
    const PASO = 0.62;       // Un turno por objeto.
    let turno = 0.25;        // Cuándo entra el siguiente.

    // Los turnos pendientes se cancelan si la pantalla se va antes de que el
    // desfile termine: sin esto, pulsar CONTINUAR a mitad dejaba los golpes de
    // sonido sonando encima de la página de deportes, uno cada medio segundo.
    const temporizadores = [];
    pantalla.addEventListener('pantalla:desmontada',
      () => temporizadores.forEach(clearTimeout), { once: true });

    // La evidencia abre el desfile: el fajo de papeles con su contador
    // subiendo. No es una prueba, pero es lo que costó toda la corrida y
    // merece su puesto en la mesa.
    if ((datos.papeles ?? 0) > 0) {
      const pieza = el('div', 'botin__pieza');
      pieza.style.setProperty('--retardo', `${turno}s`);
      const caja = el('div', 'botin__caja');
      const cara = el('div', 'botin__cara');
      cara.innerHTML = Icono.papeles(78);
      caja.appendChild(cara);
      caja.appendChild(el('span', 'botin__destello'));
      pieza.appendChild(caja);
      const cifra = el('div', 'botin__nombre botin__nombre--cifra', '0');
      pieza.appendChild(cifra);
      const sello = el('div', 'botin__sello', 'EVIDENCIA');
      sello.style.setProperty('--sello', `${turno + 0.42}s`);
      pieza.appendChild(sello);
      rejilla.appendChild(pieza);

      const cuantos = datos.papeles;
      temporizadores.push(setTimeout(() => {
        contarHasta(cifra, cuantos, 750);
        this.audio?.evidencia?.();
      }, turno * 1000 + 180));
      turno += PASO + 0.25; // El contador necesita su medio segundo extra.
    }

    pruebas.forEach((nombre) => {
      // SE REVELA AQUÍ, no al recogerla. El material plantado se detecta al
      // contrastarlo, nunca al encontrarlo, y esa es justamente la broma: lo
      // metiste en la mochila creyendo que servía.
      const falsa = Notebook.esFalsa(nombre);
      const pieza = el('div', `botin__pieza${falsa ? ' botin__pieza--falsa' : ''}`);
      pieza.style.setProperty('--retardo', `${turno}s`);

      const caja = el('div', 'botin__caja');
      const cara = el('div', 'botin__cara');
      cara.innerHTML = Icono.iconoPrueba(nombre, 78);
      caja.appendChild(cara);
      caja.appendChild(el('span', 'botin__destello'));
      pieza.appendChild(caja);
      pieza.appendChild(el('div', 'botin__nombre', nombre));

      // El sello le cae encima medio tiempo después de aparecer: primero el
      // objeto, luego el veredicto. En las buenas es la recompensa; en las
      // plantadas, el chiste.
      const sello = el('div',
        `botin__sello${falsa ? ' botin__sello--falsa' : ''}`,
        falsa ? 'NO SE SOSTIENE' : 'RECUPERADA');
      sello.style.setProperty('--sello', `${turno + 0.42}s`);
      pieza.appendChild(sello);
      rejilla.appendChild(pieza);

      // El golpe de sonido de cada pieza, en su turno.
      temporizadores.push(setTimeout(() => this.audio?.evidencia?.(), 120 + turno * 1000));
      turno += PASO;
    });
    contenido.appendChild(rejilla);

    const plantadas = pruebas.length - buenas;
    contenido.appendChild(el('div', 'botin__pie',
      plantadas > 0
        ? `${plantadas === 1 ? 'Una' : plantadas} de las que recogiste no aguanta un `
          + 'contraste: te la dejaron ahí. Las buenas se quedan en el archivo.'
        : 'Se quedan en el archivo aunque te capturen. Son las que arman el reportaje.'));

    const botones = el('div', 'botones');
    botones.appendChild(boton('CONTINUAR', 'boton--principal',
      () => this.mostrar(this.deportes(datos))));
    contenido.appendChild(botones);

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
  _fotoArresto(datos) {
    const figura = el('figure', 'plana__foto');

    const img = document.createElement('img');
    img.src = datos.foto;
    img.alt = 'Momento de la detención';
    img.loading = 'lazy';
    figura.appendChild(img);
    figura.appendChild(el('span', 'plana__trama'));

    const esc = obtenerEscenario(datos.escenario ?? 'bahia');
    figura.appendChild(el('figcaption', 'plana__pie',
      `El momento de la detención en ${esc.nombre}. Foto: El Mercio`));

    return figura;
  }

  /**
   * La lista de una clasificación, maquetada como la tabla de resultados de un
   * diario: puesto, arroba y cifra alineada a la derecha, con filete entre
   * filas.
   *
   * Solo se enseñan el primero y el entorno del jugador. Los diez completos en
   * un móvil obligan a hacer scroll dentro de una pantalla que ya es larga, y
   * a nadie le importa el séptimo.
   *
   * @param {object} clase  Una de CLASIFICACIONES
   * @param {object|null} datos Resultado de la partida recién terminada
   */
  _listaPosiciones(clase, datos = null) {
    // El valor del jugador sale del cuaderno, que ya se cerró con esta
    // partida antes de pintar nada: no hay que sumarle el resultado a mano.
    const mio = clase.valor(this.cuaderno);
    const lista = el('ol', 'posiciones');
    const filas = [];
    let miFila = null; let miCifra = null; let miValor = 0;

    for (const fila of tablaConJugador(clase, mio)) {
      if (fila.corte) {
        lista.appendChild(el('li', 'posiciones__corte', '⋯'));
        continue;
      }

      const item = el('li', `posiciones__fila ${fila.esTu ? 'posiciones__fila--tu' : ''}`.trim());
      item.appendChild(el('span', 'posiciones__puesto', String(fila.puesto)));

      const quien = el('span', 'posiciones__quien');
      quien.appendChild(el('span', 'posiciones__arroba', fila.arroba));
      if (fila.nota) quien.appendChild(el('span', 'posiciones__nota', fila.nota));
      item.appendChild(quien);

      const cifra = el('span', 'posiciones__cifra',
        fila.valor.toLocaleString('es-EC') + clase.unidad);
      item.appendChild(cifra);
      if (fila.esTu) { miFila = item; miCifra = cifra; miValor = fila.valor; }
      filas.push({ item, fila });
      lista.appendChild(item);
    }

    escalonar(lista);

    // --- EL ASCENSO --------------------------------------------------------
    //
    // Solo al terminar una partida, que es cuando hay algo que celebrar. La
    // tabla salía ya ordenada, con el jugador puesto en su sitio: se leía como
    // una consulta, no como un resultado. Aquí la fila ENTRA POR ABAJO y sube
    // hasta su puesto mientras la cifra cuenta, y cada rival al que adelanta
    // parpadea al ser rebasado.
    //
    // Se sube desde donde estarías con el peor valor de la ventana, no desde
    // una posición inventada: si no has adelantado a nadie no se mueve nada, y
    // eso también es información.
    const adelantados = filas.filter(({ fila }) => !fila.esTu && fila.valor < miValor);
    if (datos && miFila && adelantados.length) {
      const alto = miFila.offsetHeight || 34;
      miFila.style.setProperty('--sube', `${adelantados.length * alto}px`);
      miFila.classList.add('posiciones__fila--sube');
      miCifra.textContent = (0).toLocaleString('es-EC') + clase.unidad;

      requestAnimationFrame(() => {
        contarHasta(miCifra, miValor, 1100, (v) =>
          v.toLocaleString('es-EC') + clase.unidad);
        // Cada rival se enciende justo cuando la fila pasa por encima.
        adelantados.forEach(({ item }, i) => {
          setTimeout(() => item.classList.add('posiciones__fila--rebasado'),
            420 + i * (700 / Math.max(1, adelantados.length)));
        });
      });
    }

    return lista;
  }

  /**
   * Lo que esta corrida desbloqueó y lo que falta para lo siguiente.
   *
   * Va al final del resumen a propósito: es lo último que se lee antes de
   * decidir si se pulsa «volver a correr», y es la única parte de la pantalla
   * que habla del futuro en vez del pasado.
   */
  _pintarDesbloqueos(datos, contenido) {
    // Los personajes van PRIMERO. Fichar a alguien pasa cuatro veces en toda
    // la vida del juego y un potenciador se abre cinco: de los dos avisos, el
    // que menos se repite es el que merece ir arriba.
    for (const per of datos.personajesNuevos ?? []) {
      const caja = el('div', 'desbloqueo desbloqueo--personaje');
      const icono = el('span', 'desbloqueo__icono');
      icono.innerHTML = Icono.sello(34);
      caja.appendChild(icono);

      const texto = el('span', 'desbloqueo__texto');
      texto.appendChild(el('span', 'desbloqueo__etiqueta', 'FICHAJE EN LA REDACCIÓN'));
      texto.appendChild(el('span', 'desbloqueo__nombre', per.nombre));
      texto.appendChild(el('span', 'desbloqueo__desc', per.nota));
      caja.appendChild(texto);

      contenido.appendChild(caja);
    }

    for (const pot of datos.potenciadoresNuevos ?? []) {
      const caja = el('div', 'desbloqueo');
      const icono = el('span', 'desbloqueo__icono');
      icono.innerHTML = Icono.iconoPotenciador(pot.id, 34);
      caja.appendChild(icono);

      const texto = el('span', 'desbloqueo__texto');
      texto.appendChild(el('span', 'desbloqueo__etiqueta', 'POTENCIADOR NUEVO'));
      texto.appendChild(el('span', 'desbloqueo__nombre', pot.nombre));
      texto.appendChild(el('span', 'desbloqueo__desc', pot.descripcion));
      caja.appendChild(texto);

      contenido.appendChild(caja);
    }

    // AQUÍ NO VA la pista de "a dos tramos de Fuente anónima". Estaba, y no
    // decía nada: en una página que ya cuenta lo que pasó, un contador de algo
    // que no ha pasado es ruido. La cuenta atrás sí tiene sitio en el menú,
    // junto a las casillas cerradas del arsenal, porque ahí se ve QUÉ falta y
    // el número tiene a qué referirse.
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
    const diario = el('div', 'diario');
    const hoja = el('div', 'diario__hoja');
    const pie = el('div', 'diario__pie');
    diario.appendChild(hoja);
    diario.appendChild(pie);
    contenido.appendChild(diario);

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

      hoja.appendChild(this._cabeceraDiario(pagina));
      hoja.appendChild(
        pagina.desbloqueada ? this._paginaAbierta(pagina) : this._paginaCerrada(pagina, () => pintar()),
      );
      hoja.appendChild(this._navegadorPaginas(paginas, actual, (n) =>
        cambiarPagina(n, Math.sign(n - actual))));

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
      hoja.style.minHeight = `${Math.ceil(mayor)}px`;
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
      const btn = boton('Borrar progreso', 'boton--diario boton--diario-peligro', () => {
        if (!confirmando) {
          confirmando = true;
          btn.textContent = '¿Seguro? Pulsa otra vez';
          setTimeout(() => { confirmando = false; btn.textContent = 'Borrar progreso'; }, 3000);
          return;
        }
        this.cuaderno.reiniciarProgreso();
        this.mostrar(this.notebook());
      });
      botones.appendChild(btn);
    }
    pie.appendChild(botones);

    if (hayPendientes()) {
      pie.appendChild(el('div', 'diario__nota',
        `Redacción: ${cuantosListos()} de ${paginas.reduce((n, p) => n + p.articulos.length, 0)} ` +
        'reportajes cargados. Los huecos se rellenan en src/config/publicaciones.js ' +
        'con titular, autoría, fecha y enlace reales. El periódico reserva el ' +
        'espacio, pero no inventa la pieza.'));
    }

    if (!this.cuaderno.almacenamientoDisponible) {
      pie.appendChild(el('div', 'diario__nota',
        'Tu navegador tiene el almacenamiento bloqueado (suele pasar en modo ' +
        'privado). Puedes jugar igual, pero el ejemplar no se guardará.'));
    }

    return pantalla;
  }

  /** Mancheta del diario. En portada va completa; dentro, reducida. */
  _cabeceraDiario(pagina) {
    const cab = el('header', 'diario__cabecera');

    if (pagina.numero === 1) {
      cab.appendChild(el('div', 'diario__lema', CABECERA.edicion));
      cab.appendChild(el('h1', 'diario__nombre', CABECERA.nombre));
      cab.appendChild(el('div', 'diario__lema', CABECERA.lema));

      const franja = el('div', 'diario__franja');
      franja.appendChild(el('span', '', CABECERA.sitio));
      franja.appendChild(el('span', '', `${this.cuaderno.paginasAbiertas} pág. recuperadas`));
      franja.appendChild(el('span', '', CABECERA.precio));
      cab.appendChild(franja);
    } else {
      const franja = el('div', 'diario__franja diario__franja--interior');
      franja.appendChild(el('span', '', CABECERA.nombre));
      franja.appendChild(el('span', '', pagina.seccion));
      franja.appendChild(el('span', '', `Pág. ${pagina.numero}`));
      cab.appendChild(franja);
      cab.appendChild(el('h2', 'diario__seccion', pagina.nombre));
    }

    return cab;
  }

  /** Contenido de una página abierta, maquetado a columnas. */
  _paginaAbierta(pagina) {
    const cuerpo = el('div', 'diario__cuerpo');

    const destacado = pagina.articulos.find((a) => a.destacado) ?? pagina.articulos[0];
    const resto = pagina.articulos.filter((a) => a !== destacado);

    if (destacado) cuerpo.appendChild(this._articulo(destacado, true));

    if (resto.length) {
      const columnas = el('div', 'diario__columnas');
      for (const art of resto) columnas.appendChild(this._articulo(art, false));
      cuerpo.appendChild(columnas);
    }

    return cuerpo;
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
      nodo.appendChild(el('div', 'articulo__reservado', 'ESPACIO RESERVADO'));
      nodo.appendChild(el('p', 'articulo__cuerpo',
        'Reportaje en preparación. Cuando se publique aparecerá aquí, con su ' +
        'firma y su enlace.'));
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
      const enlace = el('a', 'articulo__enlace', 'Leer el reportaje completo →');
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

    cerrada.appendChild(el('div', 'pagina-cerrada__sello', 'PÁGINA SIN RECUPERAR'));
    cerrada.appendChild(el('h3', 'pagina-cerrada__titulo', pagina.nombre));

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
        ? 'Ya tienes con qué. Sale al terminar la próxima corrida.'
        : 'Las pruebas están en la calle: USB, videos, chats, actas. '
          + 'Recógelas aunque te capturen; lo recogido se queda.'));

    return cerrada;
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
      b.title = p.desbloqueada ? p.nombre : `${p.nombre} · ${p.costo} papeles`;
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
      seccion: 'CIERRE DE EDICIÓN',
      antetitulo: 'EN PAUSA',
      titular: 'RESPIRA',
      bajada: 'La rotativa espera. Nadie te está persiguiendo mientras esto esté abierto.',
    });

    const botones = el('div', 'botones');
    botones.appendChild(boton('Seguir corriendo', 'boton--principal',
      () => this.juego.reanudar()));
    botones.appendChild(boton('Abandonar la corrida', 'boton--tenue',
      () => this.juego.terminarPartida('captura')));
    contenido.appendChild(botones);

    escalonar(plana);
    return pantalla;
  }
}
