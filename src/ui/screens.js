// ============================================================================
// PANTALLAS — Menú, bifurcación, ruleta, game over, cuaderno y pausa
// ============================================================================
// Cada pantalla es una función que devuelve un elemento DOM. El gestor
// `Pantallas` se encarga de montar una y desmontar la anterior.
//
// Convención: los textos siempre se escriben con textContent, nunca
// interpolados dentro de innerHTML. Vienen de nuestra configuración, pero es
// más barato mantener la costumbre que auditar cada vez.
// ============================================================================

import { obtenerEscenario, ORDEN_ESCENARIOS } from '../config/escenarios.js';
import { PROGRESO } from '../config/balance.js';

// ---------------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------------

function elemento(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function boton(texto, clase, alPulsar) {
  const b = elemento('button', `boton ${clase ?? ''}`.trim(), texto);
  b.type = 'button';
  b.addEventListener('click', alPulsar);
  return b;
}

function pantallaBase() {
  const pantalla = elemento('div', 'pantalla');
  const contenido = elemento('div', 'pantalla__contenido');
  pantalla.appendChild(contenido);
  return { pantalla, contenido };
}

// ---------------------------------------------------------------------------
// GESTOR
// ---------------------------------------------------------------------------

export class Pantallas {
  /**
   * @param {HTMLElement} contenedor
   * @param {Game} juego
   * @param {Notebook} cuaderno
   * @param {Audio} audio
   */
  constructor(contenedor, juego, cuaderno, audio) {
    this.contenedor = contenedor;
    this.juego = juego;
    this.cuaderno = cuaderno;
    this.audio = audio;
    this.actual = null;
  }

  /** Monta una pantalla, desmontando la anterior. */
  mostrar(elementoPantalla) {
    this.ocultar();
    this.actual = elementoPantalla;
    this.contenedor.appendChild(elementoPantalla);
  }

  ocultar() {
    if (this.actual?.parentNode) {
      this.actual.parentNode.removeChild(this.actual);
    }
    this.actual = null;
  }

  // -------------------------------------------------------------------------
  // MENÚ PRINCIPAL
  // -------------------------------------------------------------------------

  menu() {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(elemento('div', 'marca', 'EL MERCIO PRESENTA'));
    contenido.appendChild(elemento('h1', 'titulo', 'ESTADO DE EXCEPCIÓN'));
    contenido.appendChild(elemento('p', 'subtitulo', 'También conocido como Estado Decepción'));

    // --- Selección de personaje -------------------------------------------
    let personajeElegido = this.cuaderno.personajePreferido;

    const personajes = elemento('div', 'personajes');
    const definiciones = [
      { id: 'chochologo', nombre: 'Chochólogo', desc: 'Sombrero, gafas y treinta años de oficio' },
      { id: 'alondra', nombre: 'Alondra', desc: 'Rizos, ukulele y todavía cree que esto sirve' },
    ];

    const tarjetas = definiciones.map((def) => {
      const tarjeta = elemento('div', 'personaje');
      tarjeta.appendChild(elemento('div', 'personaje__nombre', def.nombre));
      tarjeta.appendChild(elemento('div', 'personaje__desc', def.desc));
      if (def.id === personajeElegido) tarjeta.classList.add('seleccionado');

      tarjeta.addEventListener('click', () => {
        personajeElegido = def.id;
        tarjetas.forEach((t) => t.classList.remove('seleccionado'));
        tarjeta.classList.add('seleccionado');
      });

      personajes.appendChild(tarjeta);
      return tarjeta;
    });
    contenido.appendChild(personajes);

    // --- Botones -----------------------------------------------------------
    const botones = elemento('div', 'botones');
    botones.appendChild(boton('Empezar a correr', 'boton--principal', () => {
      this.audio.iniciar();
      this.audio.reanudar();
      this.juego.iniciarPartida(personajeElegido);
    }));
    botones.appendChild(boton('Cuaderno de expedientes', '', () => {
      this.mostrar(this.notebook());
    }));
    contenido.appendChild(botones);

    // --- Instrucciones -----------------------------------------------------
    const instrucciones = elemento('div', 'instrucciones');
    const controles = [
      ['← →', 'Cambiar de carril · o swipe lateral'],
      ['↑', 'Saltar · o swipe arriba'],
      ['↓', 'Agacharse · o swipe abajo'],
      ['ESC', 'Pausa'],
    ];
    for (const [tecla, desc] of controles) {
      const item = elemento('div', 'instruccion');
      item.appendChild(elemento('strong', '', tecla));
      item.appendChild(document.createTextNode(desc));
      instrucciones.appendChild(item);
    }
    contenido.appendChild(instrucciones);

    // --- Récords -----------------------------------------------------------
    if (this.cuaderno.partidasJugadas > 0) {
      const stats = elemento('div', 'estadisticas');
      const datos = [
        [this.cuaderno.mejorPuntaje.toLocaleString('es-EC'), 'Mejor puntaje'],
        [this.cuaderno.mejorDistancia.toLocaleString('es-EC'), 'Mejor distancia'],
        [this.cuaderno.papeles.toLocaleString('es-EC'), 'Papeles'],
      ];
      for (const [valor, etiqueta] of datos) {
        const stat = elemento('div', 'estadistica');
        stat.appendChild(elemento('div', 'estadistica__valor', valor));
        stat.appendChild(elemento('div', 'estadistica__etiqueta', etiqueta));
        stats.appendChild(stat);
      }
      contenido.appendChild(stats);
    }

    // --- Aviso de sátira ---------------------------------------------------
    // No es letra pequeña legal: es contexto. Que quede claro de qué va esto.
    const aviso = elemento('div', 'aviso-satira');
    aviso.textContent =
      'Obra de sátira política. Los personajes, situaciones y textos son ficción ' +
      'satírica de El Mercio y no reproducen declaraciones textuales de personas reales.';
    contenido.appendChild(aviso);

    const pie = elemento('div', 'pie');
    pie.appendChild(document.createTextNode('elmercio.com · '));
    const enlace = elemento('a', '', 'El Mercio');
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

    contenido.appendChild(elemento('div', 'marca', 'FIN DEL TRAMO'));
    contenido.appendChild(elemento('h1', 'titulo', '¿Por dónde?'));

    const rutas = elemento('div', 'bifurcacion');

    // --- Izquierda ---------------------------------------------------------
    rutas.appendChild(this._tarjetaRuta(
      'Izquierda',
      datos.destinos.izquierda,
      () => this.juego.elegirRuta('izquierda'),
    ));

    // --- De frente ---------------------------------------------------------
    if (config.frenteEsMuerte) {
      // Carondelet: se avisa claramente de que es letal. La decisión debe ser
      // informada; el chiste no es engañar al jugador.
      const mortal = elemento('button', 'ruta ruta--mortal');
      mortal.type = 'button';
      mortal.appendChild(elemento('div', 'ruta__direccion', 'De frente'));
      mortal.appendChild(elemento('div', 'ruta__nombre', 'CRUZAR EL CERCO'));
      mortal.appendChild(elemento('div', 'ruta__desc',
        'No hay trámite, no hay ruleta, no hay vuelta. Aquí se acaba la corrida.'));
      const etiqueta = elemento('span', 'ruta__probabilidad', '0% de salir');
      mortal.appendChild(etiqueta);
      mortal.addEventListener('click', () => this.juego.elegirRuta('frente'));
      rutas.appendChild(mortal);
    } else if (datos.institucion) {
      const inst = elemento('button', 'ruta ruta--institucion');
      inst.type = 'button';
      inst.appendChild(elemento('div', 'ruta__direccion', 'De frente'));
      inst.appendChild(elemento('div', 'ruta__nombre', datos.institucion.nombre));
      inst.appendChild(elemento('div', 'ruta__desc',
        'La vía institucional. Gira la ruleta: si sale, pagan bien.'));
      inst.appendChild(elemento('span', 'ruta__probabilidad',
        `${datos.institucion.porcentaje}% de éxito`));
      inst.addEventListener('click', () => this.juego.elegirRuta('frente'));
      rutas.appendChild(inst);
    }

    // --- Derecha -----------------------------------------------------------
    rutas.appendChild(this._tarjetaRuta(
      'Derecha',
      datos.destinos.derecha,
      () => this.juego.elegirRuta('derecha'),
    ));

    contenido.appendChild(rutas);
    return pantalla;
  }

  _tarjetaRuta(direccion, destino, alPulsar) {
    const ruta = elemento('button', 'ruta');
    ruta.type = 'button';
    ruta.appendChild(elemento('div', 'ruta__direccion', direccion));
    ruta.appendChild(elemento('div', 'ruta__nombre', destino.nombre));
    ruta.appendChild(elemento('div', 'ruta__desc', destino.subtitulo));
    ruta.addEventListener('click', alPulsar);
    return ruta;
  }

  // -------------------------------------------------------------------------
  // RULETA
  // -------------------------------------------------------------------------

  ruleta(datos) {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(elemento('div', 'marca', 'VÍA INSTITUCIONAL'));
    contenido.appendChild(elemento('h1', 'titulo', datos.institucion?.nombre ?? 'TRÁMITE'));
    contenido.appendChild(elemento('p', 'subtitulo',
      `Probabilidad declarada de éxito: ${datos.institucion?.porcentaje ?? 0}%`));

    // --- Disco -------------------------------------------------------------
    const contenedorRuleta = elemento('div', 'ruleta-contenedor');
    const disco = elemento('div', 'ruleta-disco');
    const aguja = elemento('div', 'ruleta-aguja');
    const centro = elemento('div', 'ruleta-centro', 'EXPEDIENTE');

    contenedorRuleta.appendChild(disco);
    contenedorRuleta.appendChild(centro);
    contenedorRuleta.appendChild(aguja);
    contenido.appendChild(contenedorRuleta);

    const zonaResultado = elemento('div');
    contenido.appendChild(zonaResultado);

    const botones = elemento('div', 'botones');
    contenido.appendChild(botones);

    // --- Girar -------------------------------------------------------------
    // IMPORTANTE: el resultado se sortea ANTES de animar, y la animación se
    // calcula para acabar donde toca. Si fuera al revés (dejar que la
    // animación decida), la probabilidad real dependería del easing del CSS
    // y no coincidiría con el porcentaje que anuncia el cartel.
    const botonGirar = boton('Girar la ruleta', 'boton--principal', () => {
      botonGirar.disabled = true;

      const resultado = this.juego.girarRuleta();

      // Si era Carondelet, ir de frente es muerte directa: Game ya terminó la
      // partida y cambió de estado. No animamos nada.
      if (resultado.muerteDirecta) return;

      const { anguloFinal, vueltas } = this.juego.ruleta.anguloParaResultado(resultado.exito);
      // Restamos porque el disco gira en sentido horario bajo una aguja fija.
      const rotacion = vueltas * 360 + (360 - anguloFinal);
      disco.style.transform = `rotate(${rotacion}deg)`;

      // Clics durante el giro, cada vez más espaciados.
      let retardo = 90;
      let transcurrido = 0;
      const programarClic = () => {
        if (transcurrido > 3200) return;
        this.audio.clicRuleta();
        transcurrido += retardo;
        retardo *= 1.13;
        setTimeout(programarClic, retardo);
      };
      programarClic();

      // Al terminar la animación del CSS (3.4 s), mostramos el resultado.
      setTimeout(() => {
        const caja = elemento('div', `resultado ${resultado.exito ? 'resultado--exito' : 'resultado--fracaso'}`);
        caja.appendChild(elemento('div', 'resultado__titulo',
          resultado.exito ? 'PROSPERÓ' : 'SE ARCHIVÓ'));
        caja.appendChild(elemento('div', 'resultado__texto', resultado.texto));

        if (resultado.exito && resultado.recompensa > 0) {
          const premio = elemento('div', 'estadisticas');
          const stat = elemento('div', 'estadistica');
          stat.appendChild(elemento('div', 'estadistica__valor', `+${resultado.recompensa}`));
          stat.appendChild(elemento('div', 'estadistica__etiqueta', 'Papeles'));
          premio.appendChild(stat);
          caja.appendChild(premio);
        }

        zonaResultado.appendChild(caja);

        botones.appendChild(boton('Seguir corriendo', 'boton--principal', () => {
          this.juego.continuarTrasRuleta();
        }));
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

    contenido.appendChild(elemento('div', 'marca', 'FIN DE LA CORRIDA'));

    const titulos = {
      captura: 'TE ALCANZARON',
      exhausto: 'TE QUEDASTE SIN FUERZAS',
      cerco: 'CRUZASTE EL CERCO',
    };
    contenido.appendChild(elemento('h1', 'titulo', titulos[datos.motivo] ?? 'SE ACABÓ'));

    if (datos.esRecord && datos.puntaje > 0) {
      contenido.appendChild(elemento('div', 'insignia-record', 'NUEVO RÉCORD'));
    }

    // --- Remate editorial --------------------------------------------------
    const remate = elemento('div', 'remate');
    remate.appendChild(document.createTextNode(datos.texto));
    remate.appendChild(elemento('span', 'remate__firma', 'El Mercio'));
    contenido.appendChild(remate);

    // --- Cita verificada, si el equipo cargó alguna -----------------------
    if (datos.cita) {
      const cita = elemento('div', 'cita');
      cita.appendChild(elemento('div', 'cita__texto', `«${datos.cita.texto}»`));
      cita.appendChild(elemento('span', 'cita__fuente',
        `${datos.cita.autor} · ${datos.cita.fuente} · ${datos.cita.fecha}`));
      contenido.appendChild(cita);
    }

    // --- Estadísticas ------------------------------------------------------
    const stats = elemento('div', 'estadisticas');
    const datosStats = [
      [datos.papeles.toLocaleString('es-EC'), 'Papeles'],
      [`${datos.distancia.toLocaleString('es-EC')} m`, 'Distancia'],
      [datos.puntaje.toLocaleString('es-EC'), 'Puntaje'],
      [String(datos.evidencias.length), 'Evidencias'],
    ];
    for (const [valor, etiqueta] of datosStats) {
      const stat = elemento('div', 'estadistica');
      stat.appendChild(elemento('div', 'estadistica__valor', valor));
      stat.appendChild(elemento('div', 'estadistica__etiqueta', etiqueta));
      stats.appendChild(stat);
    }
    contenido.appendChild(stats);

    // --- Ruta recorrida ----------------------------------------------------
    if (datos.ruta?.length > 1) {
      const historial = elemento('div', 'rutas-historial');
      historial.appendChild(elemento('div', 'rutas-historial__titulo', 'Ruta de esta corrida'));
      historial.appendChild(this._pintarRuta(datos.ruta));
      contenido.appendChild(historial);
    }

    // --- Fichas desbloqueadas ---------------------------------------------
    if (datos.fichasNuevas?.length > 0) {
      const fichas = elemento('div', 'fichas');
      for (const ficha of datos.fichasNuevas) {
        const f = elemento('div', 'ficha desbloqueada');
        f.appendChild(elemento('div', 'ficha__titulo', `NUEVO · ${ficha.titulo}`));
        f.appendChild(elemento('div', 'ficha__texto', ficha.texto));
        fichas.appendChild(f);
      }
      contenido.appendChild(fichas);
    }

    // --- Botones -----------------------------------------------------------
    const botones = elemento('div', 'botones');
    botones.appendChild(boton('Volver a correr', 'boton--principal', () => {
      this.juego.iniciarPartida();
    }));
    botones.appendChild(boton('Cuaderno de expedientes', '', () => {
      this.mostrar(this.notebook());
    }));
    botones.appendChild(boton('Menú principal', 'boton--tenue', () => {
      this.juego.volverAlMenu();
    }));
    contenido.appendChild(botones);

    return pantalla;
  }

  _pintarRuta(ruta) {
    const linea = elemento('div', 'ruta-linea');
    ruta.forEach((id, i) => {
      if (i > 0) linea.appendChild(elemento('span', 'ruta-flecha', '→'));
      linea.appendChild(elemento('span', 'ruta-nodo', obtenerEscenario(id).nombre));
    });
    return linea;
  }

  // -------------------------------------------------------------------------
  // CUADERNO DE EXPEDIENTES
  // -------------------------------------------------------------------------

  notebook() {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(elemento('div', 'marca', 'EL MERCIO'));
    contenido.appendChild(elemento('h1', 'titulo', 'CUADERNO'));
    contenido.appendChild(elemento('p', 'subtitulo', 'Lo que lograste sacar'));

    // --- Papeles disponibles ----------------------------------------------
    const cabecera = elemento('div', 'cuaderno-cabecera');
    const izq = elemento('div');
    izq.appendChild(elemento('div', 'cuaderno-cabecera__etiqueta', 'Papeles disponibles'));
    izq.appendChild(elemento('div', 'cuaderno-cabecera__valor',
      this.cuaderno.papeles.toLocaleString('es-EC')));
    cabecera.appendChild(izq);

    const der = elemento('div');
    der.appendChild(elemento('div', 'cuaderno-cabecera__etiqueta', 'Acumulado histórico'));
    der.appendChild(elemento('div', 'cuaderno-cabecera__valor',
      this.cuaderno.papelesHistoricos.toLocaleString('es-EC')));
    cabecera.appendChild(der);
    contenido.appendChild(cabecera);

    // --- Fichas ------------------------------------------------------------
    const fichas = elemento('div', 'fichas');

    for (const ficha of this.cuaderno.listarFichas()) {
      const f = elemento('div', `ficha ${ficha.desbloqueada ? 'desbloqueada' : 'bloqueada'}`);
      f.appendChild(elemento('div', 'ficha__titulo', ficha.titulo));

      if (ficha.desbloqueada) {
        f.appendChild(elemento('div', 'ficha__texto', ficha.texto));
      } else {
        f.appendChild(elemento('div', 'ficha__bloqueada',
          'Sin desbloquear. Hacen falta papeles.'));

        const pie = elemento('div', 'ficha__pie');
        pie.appendChild(elemento('span', 'ficha__costo',
          `${ficha.costo.toLocaleString('es-EC')} papeles`));

        const btn = boton('Desbloquear', 'boton--comprar', () => {
          const res = this.cuaderno.desbloquearFicha(ficha.id);
          if (res.exito) {
            this.audio.evidencia();
            // Repintamos el cuaderno para reflejar el nuevo estado.
            this.mostrar(this.notebook());
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
      const historial = elemento('div', 'rutas-historial');
      historial.appendChild(elemento('div', 'rutas-historial__titulo',
        `Evidencias encontradas (${this.cuaderno.evidencias.length})`));
      for (const ev of this.cuaderno.evidencias) {
        const linea = elemento('div', 'ruta-linea');
        linea.appendChild(elemento('span', 'ruta-nodo', ev));
        historial.appendChild(linea);
      }
      contenido.appendChild(historial);
    }

    // --- Árbol de rutas ----------------------------------------------------
    if (this.cuaderno.rutas.length > 0) {
      const historial = elemento('div', 'rutas-historial');
      historial.appendChild(elemento('div', 'rutas-historial__titulo',
        'Últimas rutas recorridas'));
      // Las más recientes primero, máximo 8 para no hacer la lista infinita.
      const recientes = [...this.cuaderno.rutas].reverse().slice(0, 8);
      for (const ruta of recientes) {
        historial.appendChild(this._pintarRuta(ruta));
      }
      contenido.appendChild(historial);
    }

    // --- Mapa del loop -----------------------------------------------------
    const mapa = elemento('div', 'rutas-historial');
    mapa.appendChild(elemento('div', 'rutas-historial__titulo', 'Los cuatro escenarios'));
    for (const id of ORDEN_ESCENARIOS) {
      const esc = obtenerEscenario(id);
      const linea = elemento('div', 'ruta-linea');
      linea.appendChild(elemento('span', 'ruta-nodo', esc.nombre));
      linea.appendChild(document.createTextNode(esc.subtitulo));
      mapa.appendChild(linea);
    }
    contenido.appendChild(mapa);

    // --- Botones -----------------------------------------------------------
    const botones = elemento('div', 'botones');
    botones.appendChild(boton('Volver', 'boton--principal', () => {
      this.juego.volverAlMenu();
    }));

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
      const aviso = elemento('div', 'aviso-satira');
      aviso.textContent =
        'Tu navegador tiene el almacenamiento bloqueado (suele pasar en modo privado). ' +
        'Puedes jugar igual, pero el progreso no se guardará al cerrar.';
      contenido.appendChild(aviso);
    }

    return pantalla;
  }

  // -------------------------------------------------------------------------
  // PAUSA
  // -------------------------------------------------------------------------

  pausa() {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(elemento('div', 'marca', 'EN PAUSA'));
    contenido.appendChild(elemento('h1', 'titulo', 'RESPIRA'));

    const botones = elemento('div', 'botones');
    botones.appendChild(boton('Seguir corriendo', 'boton--principal', () => {
      this.juego.reanudar();
    }));
    botones.appendChild(boton('Abandonar la corrida', 'boton--tenue', () => {
      this.juego.terminarPartida('captura');
    }));
    contenido.appendChild(botones);

    return pantalla;
  }
}
