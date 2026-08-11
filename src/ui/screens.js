// ============================================================================
// PANTALLAS — Menú, bifurcación, ruleta, game over, cuaderno y pausa
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
    if (this.actual?.parentNode) this.actual.parentNode.removeChild(this.actual);
    this.actual = null;
  }

  // -------------------------------------------------------------------------
  // MENÚ PRINCIPAL
  // -------------------------------------------------------------------------

  menu() {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(marca('EL MERCIO PRESENTA'));
    contenido.appendChild(el('h1', 'titulo', 'ESTADO DE EXCEPCIÓN'));
    contenido.appendChild(el('p', 'subtitulo', 'También conocido como Estado Decepción'));

    // --- Personaje ---------------------------------------------------------
    let elegido = this.cuaderno.personajePreferido;

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
      });

      personajes.appendChild(tarjeta);
      return tarjeta;
    });
    contenido.appendChild(personajes);

    // --- Botones -----------------------------------------------------------
    const botones = el('div', 'botones');
    botones.appendChild(boton('Empezar a correr', 'boton--principal', () => {
      this.audio.iniciar();
      this.audio.reanudar();
      this.juego.iniciarPartida(elegido);
    }));
    botones.appendChild(boton('Archivo de El Mercio', '', () => {
      this.mostrar(this.notebook());
    }));
    contenido.appendChild(botones);

    // --- Controles ---------------------------------------------------------
    const instrucciones = el('div', 'instrucciones');
    const controles = [
      [Icono.flecha('izquierda', 18), 'Carril', '← → o swipe lateral'],
      [Icono.flecha('arriba', 18), 'Saltar', '↑, espacio o swipe arriba'],
      [Icono.flecha('abajo', 18), 'Agacharse', '↓ o swipe abajo'],
      [Icono.pausa(18), 'Pausa', 'ESC o el botón'],
    ];
    for (const [svg, titulo, desc] of controles) {
      const item = el('div', 'instruccion');
      const ic = el('span', 'instruccion__icono');
      ic.innerHTML = svg;
      item.appendChild(ic);
      const txt = el('span');
      txt.appendChild(el('strong', '', titulo));
      txt.appendChild(document.createTextNode(desc));
      item.appendChild(txt);
      instrucciones.appendChild(item);
    }
    contenido.appendChild(instrucciones);

    // --- Récords -----------------------------------------------------------
    if (this.cuaderno.partidasJugadas > 0) {
      contenido.appendChild(estadisticas([
        [this.cuaderno.mejorPuntaje.toLocaleString('es-EC'), 'Mejor puntaje'],
        [`${this.cuaderno.mejorDistancia.toLocaleString('es-EC')} m`, 'Mejor distancia'],
        [this.cuaderno.papeles.toLocaleString('es-EC'), 'Papeles'],
      ]));
    }

    // --- Aviso de sátira ---------------------------------------------------
    // No es letra pequeña legal: es contexto. Que quede claro de qué va esto.
    contenido.appendChild(el('div', 'nota',
      'Obra de sátira política. Los personajes, situaciones y textos son ' +
      'ficción satírica de El Mercio y no reproducen declaraciones textuales ' +
      'de personas reales.'));

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

  // -------------------------------------------------------------------------
  // RULETA
  // -------------------------------------------------------------------------

  ruleta(datos) {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(marca('VÍA INSTITUCIONAL'));
    contenido.appendChild(el('h1', 'titulo', datos.institucion?.nombre ?? 'TRÁMITE'));
    contenido.appendChild(el('p', 'subtitulo',
      `Probabilidad declarada de éxito: ${datos.institucion?.porcentaje ?? 0}%`));

    const contenedorRuleta = el('div', 'ruleta-contenedor');
    const disco = el('div', 'ruleta-disco');
    const centro = el('div', 'ruleta-centro', 'EXPEDIENTE');
    const aguja = el('div', 'ruleta-aguja');
    contenedorRuleta.append(disco, centro, aguja);
    contenido.appendChild(contenedorRuleta);

    const zonaResultado = el('div');
    contenido.appendChild(zonaResultado);

    const botones = el('div', 'botones');
    contenido.appendChild(botones);

    // IMPORTANTE: el resultado se sortea ANTES de animar, y la animación se
    // calcula para acabar donde toca. Si fuera al revés (dejar que la
    // animación decida), la probabilidad real dependería del easing del CSS
    // y no coincidiría con el porcentaje que anuncia el cartel.
    const botonGirar = boton('Girar la ruleta', 'boton--principal', () => {
      botonGirar.disabled = true;

      const resultado = this.juego.girarRuleta();

      // En Carondelet ir de frente es muerte directa: Game ya terminó la
      // partida y cambió de estado. No hay nada que animar.
      if (resultado.muerteDirecta) return;

      const { anguloFinal, vueltas } = this.juego.ruleta.anguloParaResultado(resultado.exito);
      // Restamos porque el disco gira en sentido horario bajo una aguja fija.
      disco.style.transform = `rotate(${vueltas * 360 + (360 - anguloFinal)}deg)`;

      // Clics durante el giro, cada vez más espaciados.
      let retardo = 90;
      let transcurrido = 0;
      const clic = () => {
        if (transcurrido > 3200) return;
        this.audio.clicRuleta();
        transcurrido += retardo;
        retardo *= 1.13;
        setTimeout(clic, retardo);
      };
      clic();

      setTimeout(() => {
        const caja = el('div',
          `resultado ${resultado.exito ? 'resultado--exito' : 'resultado--fracaso'}`);
        caja.appendChild(el('div', 'resultado__titulo',
          resultado.exito ? 'PROSPERÓ' : 'SE ARCHIVÓ'));
        caja.appendChild(el('div', 'resultado__texto', resultado.texto));

        if (resultado.exito && resultado.recompensa > 0) {
          caja.appendChild(estadisticas([[`+${resultado.recompensa}`, 'Papeles']]));
        }

        zonaResultado.appendChild(caja);
        botones.appendChild(boton('Seguir corriendo', 'boton--principal',
          () => this.juego.continuarTrasRuleta()));
      }, 3500);
    });

    botones.appendChild(botonGirar);
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
