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
    botones.appendChild(boton('Cuaderno de expedientes', '', () => {
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
  // BIFURCACIÓN
  // -------------------------------------------------------------------------

  bifurcacion(datos) {
    const { pantalla, contenido } = pantallaBase();
    const config = datos.config;

    contenido.appendChild(marca('FIN DEL TRAMO'));
    contenido.appendChild(el('h1', 'titulo', '¿POR DÓNDE?'));

    const rutas = el('div', 'bifurcacion');

    rutas.appendChild(this._tarjetaRuta(
      'Izquierda', datos.destinos.izquierda, 'izquierda',
      () => this.juego.elegirRuta('izquierda'),
    ));

    // --- De frente ---------------------------------------------------------
    if (config.frenteEsMuerte) {
      // Carondelet: se avisa claramente de que es letal. La decisión debe ser
      // informada; el chiste no es engañar al jugador.
      const mortal = el('button', 'ruta ruta--mortal');
      mortal.type = 'button';
      const flecha = el('span', 'ruta__flecha');
      flecha.innerHTML = Icono.flecha('arriba', 20);
      mortal.appendChild(flecha);
      const cuerpo = el('span', 'ruta__cuerpo');
      cuerpo.appendChild(el('span', 'ruta__direccion', 'De frente'));
      cuerpo.appendChild(el('span', 'ruta__nombre', 'CRUZAR EL CERCO'));
      cuerpo.appendChild(el('span', 'ruta__desc',
        'No hay trámite, no hay ruleta, no hay vuelta. Aquí se acaba la corrida.'));
      cuerpo.appendChild(el('span', 'ruta__probabilidad', '0% de salir'));
      mortal.appendChild(cuerpo);
      mortal.addEventListener('click', () => this.juego.elegirRuta('frente'));
      rutas.appendChild(mortal);
    } else if (datos.institucion) {
      const inst = el('button', 'ruta ruta--institucion');
      inst.type = 'button';
      const flecha = el('span', 'ruta__flecha');
      flecha.innerHTML = Icono.flecha('arriba', 20);
      inst.appendChild(flecha);
      const cuerpo = el('span', 'ruta__cuerpo');
      cuerpo.appendChild(el('span', 'ruta__direccion', 'De frente'));
      cuerpo.appendChild(el('span', 'ruta__nombre', datos.institucion.nombre));
      cuerpo.appendChild(el('span', 'ruta__desc',
        'La vía institucional. Gira la ruleta: si sale, pagan bien.'));
      cuerpo.appendChild(el('span', 'ruta__probabilidad',
        `${datos.institucion.porcentaje}% de éxito`));
      inst.appendChild(cuerpo);
      inst.addEventListener('click', () => this.juego.elegirRuta('frente'));
      rutas.appendChild(inst);
    }

    rutas.appendChild(this._tarjetaRuta(
      'Derecha', datos.destinos.derecha, 'derecha',
      () => this.juego.elegirRuta('derecha'),
    ));

    contenido.appendChild(rutas);
    return pantalla;
  }

  _tarjetaRuta(direccion, destino, iconoDir, alPulsar) {
    const ruta = el('button', 'ruta');
    ruta.type = 'button';

    const flecha = el('span', 'ruta__flecha');
    flecha.innerHTML = Icono.flecha(iconoDir, 20);
    ruta.appendChild(flecha);

    const cuerpo = el('span', 'ruta__cuerpo');
    cuerpo.appendChild(el('span', 'ruta__direccion', direccion));
    cuerpo.appendChild(el('span', 'ruta__nombre', destino.nombre));
    cuerpo.appendChild(el('span', 'ruta__desc', destino.subtitulo));
    ruta.appendChild(cuerpo);

    ruta.addEventListener('click', alPulsar);
    return ruta;
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

    // --- Fichas desbloqueadas ---------------------------------------------
    if (datos.fichasNuevas?.length > 0) {
      const fichas = el('div', 'fichas');
      for (const ficha of datos.fichasNuevas) {
        const f = el('div', 'ficha ficha--abierta');
        f.appendChild(el('div', 'ficha__titulo', `NUEVO · ${ficha.titulo}`));
        f.appendChild(el('div', 'ficha__texto', ficha.texto));
        fichas.appendChild(f);
      }
      contenido.appendChild(fichas);
    }

    const botones = el('div', 'botones');
    botones.appendChild(boton('Volver a correr', 'boton--principal',
      () => this.juego.iniciarPartida()));
    botones.appendChild(boton('Cuaderno de expedientes', '',
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
  // CUADERNO DE EXPEDIENTES
  // -------------------------------------------------------------------------

  notebook() {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(marca('EL MERCIO'));
    contenido.appendChild(el('h1', 'titulo', 'CUADERNO'));
    contenido.appendChild(el('p', 'subtitulo', 'Lo que lograste sacar'));

    // --- Papeles -----------------------------------------------------------
    const cabecera = el('div', 'cuaderno-cabecera');
    for (const [etiqueta, valor] of [
      ['Papeles disponibles', this.cuaderno.papeles],
      ['Acumulado histórico', this.cuaderno.papelesHistoricos],
    ]) {
      const bloque = el('div');
      bloque.appendChild(el('div', 'cuaderno-cabecera__etiqueta', etiqueta));
      bloque.appendChild(el('div', 'cuaderno-cabecera__valor',
        valor.toLocaleString('es-EC')));
      cabecera.appendChild(bloque);
    }
    contenido.appendChild(cabecera);

    // --- Fichas ------------------------------------------------------------
    const fichas = el('div', 'fichas');

    for (const ficha of this.cuaderno.listarFichas()) {
      const f = el('div', `ficha ${ficha.desbloqueada ? 'ficha--abierta' : 'ficha--cerrada'}`);
      f.appendChild(el('div', 'ficha__titulo', ficha.titulo));

      if (ficha.desbloqueada) {
        f.appendChild(el('div', 'ficha__texto', ficha.texto));
      } else {
        f.appendChild(el('div', 'ficha__bloqueada',
          'Sin desbloquear. Hacen falta papeles.'));

        const pie = el('div', 'ficha__pie');
        pie.appendChild(el('span', 'ficha__costo',
          `${ficha.costo.toLocaleString('es-EC')} papeles`));

        const btn = boton('Desbloquear', 'boton--comprar', () => {
          const res = this.cuaderno.desbloquearFicha(ficha.id);
          if (res.exito) {
            this.audio.evidencia();
            this.mostrar(this.notebook()); // Repintamos con el nuevo estado.
          } else {
            btn.textContent = res.motivo;
            setTimeout(() => { btn.textContent = 'Desbloquear'; }, 1800);
          }
        });
        btn.disabled = !ficha.alcanzable;
        pie.appendChild(btn);
        f.appendChild(pie);
      }

      fichas.appendChild(f);
    }
    contenido.appendChild(fichas);

    // --- Evidencias encontradas -------------------------------------------
    if (this.cuaderno.evidencias.length > 0) {
      const lista = el('div', 'lista');
      lista.appendChild(el('div', 'lista__titulo',
        `Evidencias encontradas (${this.cuaderno.evidencias.length})`));
      const fila = el('div', 'lista__fila');
      for (const ev of this.cuaderno.evidencias) {
        fila.appendChild(el('span', 'nodo nodo--evidencia', ev));
      }
      lista.appendChild(fila);
      contenido.appendChild(lista);
    }

    // --- Árbol de rutas ----------------------------------------------------
    if (this.cuaderno.rutas.length > 0) {
      const lista = el('div', 'lista');
      lista.appendChild(el('div', 'lista__titulo', 'Últimas rutas recorridas'));
      // Las más recientes primero, máximo 8 para no hacer la lista infinita.
      for (const ruta of [...this.cuaderno.rutas].reverse().slice(0, 8)) {
        lista.appendChild(this._pintarRuta(ruta));
      }
      contenido.appendChild(lista);
    }

    // --- Mapa del loop -----------------------------------------------------
    const mapa = el('div', 'lista');
    mapa.appendChild(el('div', 'lista__titulo', 'Los cuatro escenarios'));
    for (const id of ORDEN_ESCENARIOS) {
      const esc = obtenerEscenario(id);
      const fila = el('div', 'lista__fila');
      fila.appendChild(el('span', 'nodo', esc.nombre));
      fila.appendChild(document.createTextNode(esc.subtitulo));
      mapa.appendChild(fila);
    }
    contenido.appendChild(mapa);

    // --- Botones -----------------------------------------------------------
    const botones = el('div', 'botones');
    botones.appendChild(boton('Volver', 'boton--principal',
      () => this.juego.volverAlMenu()));

    if (this.cuaderno.partidasJugadas > 0) {
      let confirmando = false;
      const btnBorrar = boton('Borrar progreso', 'boton--tenue boton--peligro', () => {
        if (!confirmando) {
          confirmando = true;
          btnBorrar.textContent = '¿Seguro? Pulsa otra vez';
          setTimeout(() => {
            confirmando = false;
            btnBorrar.textContent = 'Borrar progreso';
          }, 3000);
          return;
        }
        this.cuaderno.reiniciarProgreso();
        this.mostrar(this.notebook());
      });
      botones.appendChild(btnBorrar);
    }
    contenido.appendChild(botones);

    if (!this.cuaderno.almacenamientoDisponible) {
      contenido.appendChild(el('div', 'nota',
        'Tu navegador tiene el almacenamiento bloqueado (suele pasar en modo ' +
        'privado). Puedes jugar igual, pero el progreso no se guardará al cerrar.'));
    }

    return pantalla;
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
