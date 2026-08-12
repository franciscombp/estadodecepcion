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

import { obtenerEscenario, ORDEN_ESCENARIOS } from '../config/escenarios.js';
import { CABECERA, hayPendientes, cuantosListos } from '../config/publicaciones.js';
import { CATALOGO_POTENCIADORES } from '../config/balance.js';
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
  constructor(contenedor, juego, cuaderno, audio) {
    this.contenedor = contenedor;
    this.juego = juego;
    this.cuaderno = cuaderno;
    this.audio = audio;
    this.actual = null;
  }

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
    // El menú no se come la escena: la escena ES el fondo, y encima van los
    // paneles. Por eso esta pantalla no lleva el velo opaco de las demás.
    pantalla.classList.add('pantalla--portada');

    const esc = obtenerEscenario(this.juego.escenarioActual);
    contenido.dataset.escenario = esc.id;

    // --- Cabecera ----------------------------------------------------------
    const cabecera = el('div', 'portada__cabecera');
    cabecera.appendChild(marca('EL MERCIO PRESENTA'));
    cabecera.appendChild(el('h1', 'titulo titulo--portada', 'ESTADO DE EXCEPCIÓN'));
    cabecera.appendChild(el('p', 'subtitulo subtitulo--portada',
      'También conocido como Estado Decepción'));
    contenido.appendChild(cabecera);

    // --- Ficha de la temporada --------------------------------------------
    // Lo primero que se ve después del título. El jugador tiene que saber
    // ANTES de pulsar dónde va a caer, porque el juego ya no empieza siempre
    // en la Bahía: retoma donde te capturaron.
    const temporada = el('div', 'temporada');
    temporada.appendChild(el('span', 'temporada__etiqueta',
      this.cuaderno.partidasJugadas > 0 ? 'RETOMAS EN' : 'EMPIEZAS EN'));

    const tituloTemporada = el('div', 'temporada__fila');
    const iconoTemporada = el('span', 'temporada__icono');
    iconoTemporada.innerHTML = Icono.iconoEstamina(esc.id, 30);
    tituloTemporada.appendChild(iconoTemporada);
    tituloTemporada.appendChild(el('span', 'temporada__nombre', esc.nombre));
    temporada.appendChild(tituloTemporada);

    temporada.appendChild(el('span', 'temporada__sub', esc.subtitulo));

    // Riel del rombo: en cuál de las cuatro estás.
    const riel = el('div', 'temporada__riel');
    for (const id of ORDEN_ESCENARIOS) {
      const nodo = el('span', 'temporada__nodo');
      nodo.title = obtenerEscenario(id).nombre;
      if (id === esc.id) nodo.classList.add('temporada__nodo--activo');
      riel.appendChild(nodo);
    }
    temporada.appendChild(riel);
    contenido.appendChild(temporada);

    // --- Personaje ---------------------------------------------------------
    let elegido = this.cuaderno.personajePreferido;

    contenido.appendChild(el('div', 'rotulo-seccion', 'QUIÉN CORRE'));

    const personajes = el('div', 'personajes');
    const definiciones = [
      { id: 'chochologo', nombre: 'Chochólogo', desc: 'Sombrero, gafas y treinta años de oficio' },
      { id: 'alondra', nombre: 'Alondra', desc: 'Rizos, ukulele y todavía cree que esto sirve' },
    ];

    const tarjetas = definiciones.map((def) => {
      const tarjeta = el('div', 'personaje');
      tarjeta.appendChild(el('div', 'personaje__nombre', def.nombre));
      tarjeta.appendChild(el('div', 'personaje__desc', def.desc));
      if (def.id === elegido) tarjeta.classList.add('personaje--elegido');

      tarjeta.addEventListener('click', () => {
        elegido = def.id;
        tarjetas.forEach((t) => t.classList.remove('personaje--elegido'));
        tarjeta.classList.add('personaje--elegido');
        // Cambio en vivo: se ve al personaje correr en el fondo antes de
        // decidir. Elegir a ciegas entre dos nombres no es elegir.
        this.juego.previsualizarPersonaje(def.id);
        this.audio.cambioCarril();
      });

      personajes.appendChild(tarjeta);
      return tarjeta;
    });
    contenido.appendChild(personajes);

    // --- Arsenal -----------------------------------------------------------
    contenido.appendChild(this._pintarArsenal());

    // --- Jugar -------------------------------------------------------------
    // Un solo botón dominante. Todo lo demás es secundario y se ve que lo es.
    const jugar = boton('JUGAR', 'boton--jugar', () => {
      this.audio.iniciar();
      this.audio.reanudar();
      this.juego.iniciarPartida(elegido);
    });
    contenido.appendChild(jugar);

    const secundarios = el('div', 'portada__secundarios');
    secundarios.appendChild(boton('Archivo de El Mercio', 'boton--tenue', () => {
      this.mostrar(this.notebook());
    }));
    contenido.appendChild(secundarios);

    // --- Marcador ----------------------------------------------------------
    if (this.cuaderno.partidasJugadas > 0) {
      contenido.appendChild(estadisticas([
        [this.cuaderno.mejorPuntaje.toLocaleString('es-EC'), 'Mejor puntaje'],
        [`${this.cuaderno.mejorDistancia.toLocaleString('es-EC')} m`, 'Mejor distancia'],
        [this.cuaderno.papeles.toLocaleString('es-EC'), 'Papeles'],
      ]));
    }

    // --- Controles ---------------------------------------------------------
    // Solo las primeras partidas. Después ocupan un tercio de la portada para
    // recordar algo que ya se sabe, y lo que empuja fuera de pantalla es el
    // título del juego.
    if (this.cuaderno.partidasJugadas < 3) {
      contenido.appendChild(this._pintarControles());
    }

    // --- Aviso de sátira ---------------------------------------------------
    // No es letra pequeña legal: es contexto. Que quede claro de qué va esto.
    contenido.appendChild(el('div', 'nota',
      'Sátira política de El Mercio. Los personajes y textos son ficción y no ' +
      'reproducen declaraciones de personas reales.'));

    const pie = el('div', 'pie');
    pie.appendChild(document.createTextNode('elmercio.com · '));
    const enlace = el('a', '', 'El Mercio');
    enlace.href = 'https://elmercio.com';
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    pie.appendChild(enlace);
    contenido.appendChild(pie);

    return pantalla;
  }

  /** Chuleta de controles. Solo se enseña mientras hace falta. */
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

    const titulo = el('div', 'rotulo-seccion', 'ARSENAL');
    bloque.appendChild(titulo);

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

  // -------------------------------------------------------------------------
  // MEDIDOR DE ESCAPE
  // -------------------------------------------------------------------------
  // Te rodearon y te queda un intento. Un cursor recorre la barra de ida y
  // vuelta a velocidad constante; lo paras y, si cae en la franja verde, te
  // zafas.
  //
  // NO ES UNA RULETA. La diferencia importa: aquí no hay número oculto ni
  // sorteo. El cursor está a la vista todo el tiempo, la franja también, y el
  // resultado es exactamente lo que el jugador hizo con el pulgar. Que sea
  // difícil está bien; que sea suerte, no —perder por un dado invisible
  // después de dos minutos corriendo es lo que hace que se apague el juego.

  escape(datos) {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--cerco');

    contenido.appendChild(marca('TE RODEARON'));
    contenido.appendChild(el('h1', 'titulo titulo--rojo', 'ÚLTIMO INTENTO'));
    contenido.appendChild(el('p', 'subtitulo',
      'Para la barra en verde y te escurres entre el cerco. Es pulso, no suerte.'));

    // --- La barra ----------------------------------------------------------
    const barra = el('div', 'medidor-escape');
    const zona = el('div', 'medidor-escape__zona');
    const cursor = el('div', 'medidor-escape__cursor');
    barra.append(zona, cursor);
    contenido.appendChild(barra);

    // La franja no va siempre en el centro: si estuviera fija, el jugador
    // aprendería el punto y esto dejaría de ser una prueba a la segunda vez.
    const ancho = datos.zona ?? 0.16;
    const centro = 0.5 + (Math.random() - 0.5) * 0.44;
    const desde = Math.max(0, Math.min(1 - ancho, centro - ancho / 2));

    zona.style.left = `${desde * 100}%`;
    zona.style.width = `${ancho * 100}%`;

    const zonaResultado = el('div');
    contenido.appendChild(zonaResultado);

    // --- Animación ---------------------------------------------------------
    // Va con requestAnimationFrame y reloj real, no con una transición CSS:
    // hace falta saber la posición EXACTA en el instante del toque, y una
    // animación declarativa no la da sin leer estilos computados.
    let posicion = 0;
    let sentido = 1;
    let anterior = performance.now();
    let corriendo = true;
    const velocidad = datos.velocidad ?? 1.45;

    const paso = (ahora) => {
      if (!corriendo) return;
      const dt = Math.min(0.05, (ahora - anterior) / 1000);
      anterior = ahora;

      posicion += sentido * velocidad * dt;
      if (posicion >= 1) { posicion = 1; sentido = -1; }
      if (posicion <= 0) { posicion = 0; sentido = 1; }

      cursor.style.left = `${posicion * 100}%`;
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);

    const botones = el('div', 'botones');
    contenido.appendChild(botones);

    const parar = () => {
      if (!corriendo) return;
      corriendo = false;
      botonParar.disabled = true;

      const acerto = posicion >= desde && posicion <= desde + ancho;
      cursor.classList.add(acerto ? 'medidor-escape__cursor--bien' : 'medidor-escape__cursor--mal');

      const caja = el('div', `resultado ${acerto ? 'resultado--exito' : 'resultado--fracaso'}`);
      caja.appendChild(el('div', 'resultado__titulo', acerto ? 'TE ZAFASTE' : 'TE AGARRARON'));
      caja.appendChild(el('div', 'resultado__texto', acerto
        ? 'Saliste por el hueco que dejaron. Sigue corriendo.'
        : 'No hubo hueco. Ni esta vez ni la anterior.'));
      zonaResultado.appendChild(caja);

      this.audio.resultadoRuleta(acerto);

      // Un respiro para leer el resultado antes de que cambie la pantalla.
      setTimeout(() => this.juego.escapar(acerto), acerto ? 700 : 1100);
    };

    const botonParar = boton('PARAR', 'boton--principal', parar);
    botones.appendChild(botonParar);

    // Espacio y toque también valen: en móvil el pulgar ya está en la
    // pantalla, y obligar a apuntar al botón le añade una dificultad que no
    // tiene nada que ver con lo que se está midiendo.
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
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--victoria');

    contenido.appendChild(marca('SE PRESENTÓ LA DENUNCIA'));
    contenido.appendChild(el('h1', 'titulo titulo--verde', 'PROSPERÓ'));
    contenido.appendChild(el('div', 'insignia-record', datos.institucion));

    const remate = el('div', 'remate');
    remate.appendChild(document.createTextNode(datos.texto));
    remate.appendChild(el('span', 'remate__firma', 'El Mercio'));
    contenido.appendChild(remate);

    contenido.appendChild(el('p', 'subtitulo',
      `Entregaste los ${datos.papelesEntregados} papeles del expediente. ` +
      'Sin que falte uno. No sabemos cómo lo lograste, pero lo lograste.'));

    contenido.appendChild(estadisticas([
      [datos.papeles.toLocaleString('es-EC'), 'Papeles'],
      [`${datos.distancia.toLocaleString('es-EC')} m`, 'Distancia'],
      [datos.puntaje.toLocaleString('es-EC'), 'Puntaje'],
      [String(datos.evidencias.length), 'Evidencias'],
    ]));

    if (datos.ruta?.length > 1) {
      const lista = el('div', 'lista');
      lista.appendChild(el('div', 'lista__titulo', 'Ruta de esta corrida'));
      lista.appendChild(this._pintarRuta(datos.ruta));
      contenido.appendChild(lista);
    }

    this._pintarDesbloqueos(datos, contenido);

    const botones = el('div', 'botones');
    botones.appendChild(boton('Volver a correr', 'boton--principal',
      () => this.juego.iniciarPartida()));
    botones.appendChild(boton('Archivo de El Mercio', '',
      () => this.mostrar(this.notebook())));
    botones.appendChild(boton('Menú principal', 'boton--tenue',
      () => this.juego.volverAlMenu()));
    contenido.appendChild(botones);

    return pantalla;
  }

  // -------------------------------------------------------------------------
  // GAME OVER
  // -------------------------------------------------------------------------

  gameOver(datos) {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(marca('FIN DE LA CORRIDA'));

    const titulos = {
      captura: 'TE ALCANZARON',
      exhausto: 'SIN FUERZAS',
      cerco: 'CRUZASTE EL CERCO',
    };
    contenido.appendChild(
      el('h1', 'titulo titulo--rojo', titulos[datos.motivo] ?? 'SE ACABÓ'));

    if (datos.esRecord && datos.puntaje > 0) {
      contenido.appendChild(el('div', 'insignia-record', 'NUEVO RÉCORD'));
    }

    // --- Remate editorial --------------------------------------------------
    const remate = el('div', 'remate');
    remate.appendChild(document.createTextNode(datos.texto));
    remate.appendChild(el('span', 'remate__firma', 'El Mercio'));
    contenido.appendChild(remate);

    // --- Cita verificada, si el equipo cargó alguna ------------------------
    if (datos.cita) {
      const cita = el('div', 'cita');
      cita.appendChild(el('div', 'cita__texto', `«${datos.cita.texto}»`));
      cita.appendChild(el('span', 'cita__fuente',
        `${datos.cita.autor} · ${datos.cita.fuente} · ${datos.cita.fecha}`));
      contenido.appendChild(cita);
    }

    contenido.appendChild(estadisticas([
      [datos.papeles.toLocaleString('es-EC'), 'Papeles'],
      [`${datos.distancia.toLocaleString('es-EC')} m`, 'Distancia'],
      [datos.puntaje.toLocaleString('es-EC'), 'Puntaje'],
      [String(datos.evidencias.length), 'Evidencias'],
    ]));

    // --- Ruta recorrida ----------------------------------------------------
    if (datos.ruta?.length > 1) {
      const lista = el('div', 'lista');
      lista.appendChild(el('div', 'lista__titulo', 'Ruta de esta corrida'));
      lista.appendChild(this._pintarRuta(datos.ruta));
      contenido.appendChild(lista);
    }

    // --- Evidencias de la partida -----------------------------------------
    if (datos.evidencias?.length > 0) {
      const lista = el('div', 'lista');
      lista.appendChild(el('div', 'lista__titulo', 'Lo que lograste sacar'));
      const fila = el('div', 'lista__fila');
      for (const ev of datos.evidencias) {
        fila.appendChild(el('span', 'nodo nodo--evidencia', ev));
      }
      lista.appendChild(fila);
      contenido.appendChild(lista);
    }

    // --- Páginas recuperadas ----------------------------------------------
    if (datos.paginasNuevas?.length > 0) {
      const lista = el('div', 'lista');
      lista.appendChild(el('div', 'lista__titulo', 'Recuperaste del periódico'));
      const fila = el('div', 'lista__fila');
      for (const pag of datos.paginasNuevas) {
        fila.appendChild(el('span', 'nodo', `Pág. ${pag.numero} · ${pag.nombre}`));
      }
      lista.appendChild(fila);
      contenido.appendChild(lista);
    }

    this._pintarDesbloqueos(datos, contenido);

    const botones = el('div', 'botones');
    botones.appendChild(boton('Volver a correr', 'boton--principal',
      () => this.juego.iniciarPartida()));
    botones.appendChild(boton('Archivo de El Mercio', '',
      () => this.mostrar(this.notebook())));
    botones.appendChild(boton('Menú principal', 'boton--tenue',
      () => this.juego.volverAlMenu()));
    contenido.appendChild(botones);

    return pantalla;
  }

  /**
   * Lo que esta corrida desbloqueó y lo que falta para lo siguiente.
   *
   * Va al final del resumen a propósito: es lo último que se lee antes de
   * decidir si se pulsa «volver a correr», y es la única parte de la pantalla
   * que habla del futuro en vez del pasado.
   */
  _pintarDesbloqueos(datos, contenido) {
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

    const proximo = datos.proximoPotenciador;
    if (proximo) {
      const pista = el('div', 'siguiente-desbloqueo');
      const icono = el('span', 'siguiente-desbloqueo__icono');
      icono.innerHTML = Icono.iconoPotenciador(proximo.id, 22);
      pista.appendChild(icono);
      pista.appendChild(el('span', '',
        `A ${proximo.faltan} ${proximo.faltan === 1 ? 'tramo' : 'tramos'} de ${proximo.nombre}`));
      contenido.appendChild(pista);
    }
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

    const diario = el('div', 'diario');
    contenido.appendChild(diario);

    const pintar = () => {
      diario.innerHTML = '';
      const pagina = paginas.find((p) => p.numero === actual) ?? paginas[0];

      diario.appendChild(this._cabeceraDiario(pagina));
      diario.appendChild(
        pagina.desbloqueada ? this._paginaAbierta(pagina) : this._paginaCerrada(pagina, pintar),
      );
      diario.appendChild(this._navegadorPaginas(paginas, actual, (n) => {
        actual = n;
        pintar();
      }));
    };
    pintar();

    // --- Salida y avisos ---------------------------------------------------
    const botones = el('div', 'botones');
    botones.appendChild(boton('Volver', 'boton--principal',
      () => this.juego.volverAlMenu()));

    if (this.cuaderno.partidasJugadas > 0) {
      let confirmando = false;
      const btn = boton('Borrar progreso', 'boton--tenue boton--peligro', () => {
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
    contenido.appendChild(botones);

    if (hayPendientes()) {
      contenido.appendChild(el('div', 'nota',
        `Redacción: ${cuantosListos()} de ${paginas.reduce((n, p) => n + p.articulos.length, 0)} ` +
        'reportajes cargados. Los huecos se rellenan en src/config/publicaciones.js ' +
        'con titular, autoría, fecha y enlace reales. El periódico reserva el ' +
        'espacio, pero no inventa la pieza.'));
    }

    if (!this.cuaderno.almacenamientoDisponible) {
      contenido.appendChild(el('div', 'nota',
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

    cerrada.appendChild(el('div', 'pagina-cerrada__precio',
      `${pagina.costo.toLocaleString('es-EC')} papeles`));

    const btn = boton('Recuperar la página', 'boton--comprar', () => {
      const res = this.cuaderno.desbloquearPagina(pagina.numero);
      if (res.exito) {
        this.audio.evidencia();
        this.mostrar(this.notebook());
      } else {
        btn.textContent = res.motivo;
        setTimeout(() => { btn.textContent = 'Recuperar la página'; }, 1800);
      }
    });
    btn.disabled = !pagina.alcanzable;
    cerrada.appendChild(btn);

    if (!pagina.alcanzable) {
      cerrada.appendChild(el('div', 'pagina-cerrada__ayuda',
        `Tienes ${this.cuaderno.papeles.toLocaleString('es-EC')} papeles. ` +
        'Se consiguen corriendo.'));
    }

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
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(marca('EN PAUSA'));
    contenido.appendChild(el('h1', 'titulo', 'RESPIRA'));

    const botones = el('div', 'botones');
    botones.appendChild(boton('Seguir corriendo', 'boton--principal',
      () => this.juego.reanudar()));
    botones.appendChild(boton('Abandonar la corrida', 'boton--tenue',
      () => this.juego.terminarPartida('captura')));
    contenido.appendChild(botones);

    return pantalla;
  }
}
