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
import { tablaConJugador } from '../config/tabla.js';
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
  constructor(contenedor, juego, cuaderno, audio, actualizador = null) {
    this.contenedor = contenedor;
    this.juego = juego;
    this.cuaderno = cuaderno;
    this.audio = audio;
    // Puede ser null en desarrollo, donde no hay service worker.
    this.actualizador = actualizador;
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
    // LA PORTADA ES LA ESCENA. La interfaz se aparta a los bordes —una banda
    // arriba y otra abajo— y deja el centro libre, que es donde está el
    // periodista entrevistando. Un menú que tapa la escena convierte el 3D en
    // un fondo de pantalla; apartándolo, la escena cuenta de qué va el juego
    // antes de que nadie lea una línea.
    pantalla.classList.add('pantalla--portada');
    contenido.classList.add('portada');

    const esc = obtenerEscenario(this.juego.escenarioActual);

    // ══ BANDA SUPERIOR ══════════════════════════════════════════════════
    const arriba = el('div', 'portada__arriba');

    arriba.appendChild(marca('EL MERCIO PRESENTA'));
    arriba.appendChild(el('h1', 'titulo titulo--portada', 'ESTADO DE EXCEPCIÓN'));

    // La temporada, en una línea. Antes era una ficha con borde que ocupaba un
    // quinto de la pantalla para decir dos palabras.
    const temporada = el('div', 'temporada-linea');
    const icono = el('span', 'temporada-linea__icono');
    icono.innerHTML = Icono.iconoTemporada(esc.id, 20);
    temporada.appendChild(icono);
    temporada.appendChild(el('span', 'temporada-linea__etiqueta',
      this.cuaderno.partidasJugadas > 0 ? 'RETOMAS EN' : 'EMPIEZAS EN'));
    temporada.appendChild(el('span', 'temporada-linea__nombre', esc.nombre));
    arriba.appendChild(temporada);

    contenido.appendChild(arriba);

    // ══ HUECO ═══════════════════════════════════════════════════════════
    // No lleva nada. Es la ventana por la que se ve la entrevista.
    contenido.appendChild(el('div', 'portada__hueco'));

    // ══ BANDA INFERIOR ══════════════════════════════════════════════════
    const abajo = el('div', 'portada__abajo');

    // --- Personaje ---------------------------------------------------------
    // Dos fichas pequeñas: al que eliges se le ve en la escena, así que el
    // texto ya no tiene que describirlo.
    let elegido = this.cuaderno.personajePreferido;
    const definiciones = [
      { id: 'chochologo', nombre: 'Chochólogo' },
      { id: 'alondra', nombre: 'Alondra' },
    ];

    const personajes = el('div', 'elector');
    const fichas = definiciones.map((def) => {
      const ficha = el('button', 'elector__ficha', def.nombre);
      ficha.type = 'button';
      if (def.id === elegido) ficha.classList.add('elector__ficha--elegida');

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
    abajo.appendChild(boton('JUGAR', 'boton--jugar', () => {
      this.audio.iniciar();
      this.audio.reanudar();
      this.juego.iniciarPartida(elegido);
    }));

    // --- Secundarios -------------------------------------------------------
    const secundarios = el('div', 'portada__secundarios');
    secundarios.appendChild(boton('Archivo', 'boton--tenue', () => {
      this.mostrar(this.notebook());
    }));
    secundarios.appendChild(boton('Marcadores', 'boton--tenue', () => {
      this.mostrar(this.marcadores());
    }));
    secundarios.appendChild(boton('Ajustes', 'boton--tenue', () => {
      this.mostrar(this.ajustes());
    }));
    abajo.appendChild(secundarios);

    contenido.appendChild(abajo);
    return pantalla;
  }

  // -------------------------------------------------------------------------
  // MARCADORES
  // -------------------------------------------------------------------------
  // La tabla completa, en su propia página del periódico. En la portada de
  // derrota solo cabe el entorno del jugador; aquí están los diez.

  marcadores() {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--plana');

    const plana = el('div', 'plana');

    const cab = el('header', 'plana__cabecera');
    cab.appendChild(el('span', 'plana__nombre', CABECERA.nombre));
    cab.appendChild(el('span', 'plana__fecha', 'DEPORTES'));
    plana.appendChild(cab);

    plana.appendChild(el('div', 'plana__antetitulo', 'QUIÉN DOCUMENTA MÁS'));
    plana.appendChild(el('h1', 'plana__titular', 'TABLA GENERAL'));

    // Va con la MEJOR corrida, no con lo que se lleva acumulado. El acumulado
    // premia insistir; la marca personal premia una corrida buena, que es lo
    // que se compara cuando dos personas hablan de este juego.
    plana.appendChild(this._tablaPosiciones(this.cuaderno.mejorPapeles, 99));
    contenido.appendChild(plana);

    const botones = el('div', 'botones');
    botones.appendChild(boton('Volver', 'boton--principal',
      () => this.juego.volverAlMenu()));
    contenido.appendChild(botones);

    return pantalla;
  }

  // -------------------------------------------------------------------------
  // AJUSTES
  // -------------------------------------------------------------------------
  // Lo que antes colgaba del final del menú y lo alargaba: la chuleta de
  // controles, el panel de edición y el borrado de progreso.

  ajustes() {
    const { pantalla, contenido } = pantallaBase();

    contenido.appendChild(marca('AJUSTES'));
    contenido.appendChild(el('h1', 'titulo', 'LA REDACCIÓN'));

    contenido.appendChild(el('div', 'rotulo-seccion', 'CONTROLES'));
    contenido.appendChild(this._pintarControles());

    contenido.appendChild(el('div', 'rotulo-seccion', 'EDICIÓN'));
    contenido.appendChild(this._pintarVersion(pantalla));

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
        this.juego.volverAlMenu();
      });
      botones.appendChild(btn);
    }
    contenido.appendChild(botones);

    // No es letra pequeña legal: es contexto. Que quede claro de qué va esto.
    contenido.appendChild(el('div', 'nota',
      'Sátira política de El Mercio. Los personajes y textos son ficción y no '
      + 'reproducen declaraciones de personas reales.'));

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

    panel.appendChild(el('div', 'edicion__nota',
      'Se comprueba sola cada hora y la edición nueva entra al terminar una '
      + 'corrida, nunca en mitad de una.'));

    // El botón tiene UN solo dueño de su texto y de si está activo: pintar().
    // Repartir eso entre el manejador del clic y el repintado es lo que dejaba
    // el botón deshabilitado para siempre cuando una comprobación tardaba más
    // de lo previsto.
    const boton_ = boton('Buscar actualización', 'boton--tenue boton--edicion', async () => {
      if (!act) return;

      if (act.estado === 'disponible') {
        // Desde los ajustes el momento es seguro: se aplica al instante.
        boton_.textContent = 'Instalando…';
        boton_.disabled = true;
        act.aplicar();
        return;
      }

      const hay = await act.comprobar();
      if (!hay) {
        // OJO CON LO QUE DICE ESTE MENSAJE. Que la comprobación se agote no
        // demuestra que no haya edición nueva: el navegador puede tardar más
        // que la espera. La escucha sigue puesta y el panel se enciende solo
        // si llega después, así que el rótulo informa y no promete.
        boton_.textContent = 'Sin novedades por ahora';
        setTimeout(pintar, 2600);
      }
    });

    const ESTADOS_TEXTO = {
      'sin-soporte': ['Sin modo offline en este navegador', 'edicion--tenue'],
      preparando: ['Guardando el juego para jugar sin conexión…', 'edicion--espera'],
      listo: ['Listo para jugar sin conexión', 'edicion--listo'],
      buscando: ['Buscando edición nueva…', 'edicion--espera'],
      disponible: ['Hay una edición nueva. Toca para instalarla', 'edicion--nueva'],
    };

    const ESTADOS_BOTON = {
      'sin-soporte': ['Buscar actualización', true],
      preparando: ['Buscar actualización', false],
      listo: ['Buscar actualización', false],
      buscando: ['Buscando…', true],
      disponible: ['Instalar y reiniciar', false],
    };

    function pintar() {
      const estado = act?.estado ?? 'sin-soporte';
      const [frase, clase] = ESTADOS_TEXTO[estado] ?? ESTADOS_TEXTO['sin-soporte'];
      texto.textContent = frase;
      panel.className = `edicion ${clase}`;

      const [rotulo, bloqueado] = ESTADOS_BOTON[estado] ?? ESTADOS_BOTON['sin-soporte'];
      boton_.textContent = rotulo;
      boton_.disabled = bloqueado;
    }
    pintar();

    // El estado puede cambiar solo mientras la pantalla está abierta. Se
    // repinta, y la escucha se suelta al desmontar: sin eso, cada visita
    // dejaría un callback vivo apuntando a nodos que ya no existen.
    if (act) {
      act.alCambiar = pintar;
      pantalla.addEventListener('pantalla:desmontada', () => { act.alCambiar = () => {}; });
      panel.appendChild(boton_);
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
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--relato');

    const esEntrada = datos.fase === 'entrada';

    contenido.appendChild(marca(esEntrada ? 'ENTRAS AL TRÁMITE' : 'SE ACABÓ EL PASILLO'));
    contenido.appendChild(el('h1', 'titulo titulo--dorado', datos.institucion));

    // El cuerpo: dos o tres frases, tamaño de lectura, sin prisa.
    const relato = el('div', 'relato');
    for (const parrafo of String(datos.relato ?? '').split('\n').filter(Boolean)) {
      relato.appendChild(el('p', 'relato__parrafo', parrafo.trim()));
    }
    contenido.appendChild(relato);

    // El remate en voz de El Mercio, que es la línea que ya existía y que
    // ahora tiene sitio para leerse.
    if (datos.remate) {
      const remate = el('div', 'remate');
      remate.appendChild(document.createTextNode(datos.remate));
      remate.appendChild(el('span', 'remate__firma', 'El Mercio'));
      contenido.appendChild(remate);
    }

    // A la salida, el balance. Es información de partida y va con formato de
    // dato, no de narración.
    if (!esEntrada) {
      contenido.appendChild(estadisticas([
        [String(datos.recuperados ?? 0), 'Recuperados'],
        [String(datos.perdidos ?? 0), 'En el suelo'],
      ]));

      if (datos.hallazgo) {
        const caja = el('div', 'desbloqueo');
        const icono = el('span', 'desbloqueo__icono');
        icono.innerHTML = Icono.usb(22);
        caja.appendChild(icono);
        const texto = el('span', 'desbloqueo__texto');
        texto.appendChild(el('span', 'desbloqueo__titulo', 'PERO SALES CON ALGO'));
        texto.appendChild(el('span', 'desbloqueo__nota', datos.hallazgo));
        caja.appendChild(texto);
        contenido.appendChild(caja);
      }
    }

    const botones = el('div', 'botones');
    botones.appendChild(boton(
      esEntrada ? 'ENTRAR' : 'SEGUIR CORRIENDO',
      'boton--principal',
      () => this.juego.continuarRelato(datos.fase),
    ));
    contenido.appendChild(botones);

    return pantalla;
  }

  escape(datos) {
    const { pantalla, contenido } = pantallaBase();
    pantalla.classList.add('pantalla--cerco');

    contenido.appendChild(marca('TE RODEARON'));
    contenido.appendChild(el('h1', 'titulo titulo--rojo', 'LE TOCA UN JUEZ'));
    contenido.appendChild(el('p', 'subtitulo',
      'Cinco llevan la camiseta. Para el selector en el que no la lleva.'));

    // --- Los seis jueces ---------------------------------------------------
    // El honesto está en un puesto distinto cada vez. Si estuviera fijo, esto
    // se aprendería a la segunda captura y dejaría de ser una prueba.
    const total = datos.jueces ?? 6;
    const honesto = Math.floor(Math.random() * total);

    const tribunal = el('div', 'tribunal');
    const fichas = [];

    for (let i = 0; i < total; i++) {
      const ficha = el('div', `juez ${i === honesto ? 'juez--limpio' : 'juez--comprado'}`);
      const toga = el('span', 'juez__toga');
      toga.innerHTML = Icono.juez(38, i === honesto);
      ficha.appendChild(toga);
      // Los seis se llaman igual. Rotular al bueno como «el bueno» convertiría
      // la prueba en leer una etiqueta; lo que hay que mirar es el pecho.
      ficha.appendChild(el('span', 'juez__rotulo', `JUEZ ${i + 1}`));
      tribunal.appendChild(ficha);
      fichas.push(ficha);
    }
    contenido.appendChild(tribunal);

    const zonaResultado = el('div');
    contenido.appendChild(zonaResultado);

    // --- El selector -------------------------------------------------------
    // Va con requestAnimationFrame y reloj real, no con una animación CSS:
    // hace falta saber en qué juez está EXACTAMENTE en el instante del toque,
    // y una animación declarativa no lo dice sin leer estilos computados.
    let indice = 0;
    let acumulado = 0;
    let anterior = performance.now();
    let corriendo = true;
    const saltosPorSegundo = datos.velocidad ?? 4.2;

    const marcar = () => {
      fichas.forEach((f, i) => f.classList.toggle('juez--senalado', i === indice));
    };
    marcar();

    const paso = (ahora) => {
      if (!corriendo) return;
      const dt = Math.min(0.05, (ahora - anterior) / 1000);
      anterior = ahora;

      acumulado += dt * saltosPorSegundo;
      while (acumulado >= 1) {
        acumulado -= 1;
        indice = (indice + 1) % total;
        marcar();
      }
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);

    const botones = el('div', 'botones');
    contenido.appendChild(botones);

    const parar = () => {
      if (!corriendo) return;
      corriendo = false;
      botonParar.disabled = true;

      const acerto = indice === honesto;
      fichas[indice].classList.add(acerto ? 'juez--acierto' : 'juez--fallo');
      if (!acerto) fichas[honesto].classList.add('juez--revelado');

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
      `Te tiraron el expediente por el suelo y lo recogiste entero: ` +
      `${datos.papelesEntregados} papeles, sin que falte uno. ` +
      'No sabemos cómo lo lograste, pero lo lograste.'));

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
    // La pantalla entera es el periódico del día siguiente. No un panel de
    // resultados con una cabecera bonita: el ejemplar completo. El periodista
    // deja de firmar la noticia y pasa a ser la noticia, y para que eso se
    // sienta tiene que ocupar todo, como ocuparía la portada de verdad.
    pantalla.classList.add('pantalla--plana');

    contenido.appendChild(this._primeraPlana(datos));

    const botones = el('div', 'botones');
    const donde = obtenerEscenario(datos.escenario ?? this.juego.escenarioActual);
    botones.appendChild(boton(`Volver a ${donde.nombre}`, 'boton--principal',
      () => this.juego.iniciarPartida()));
    botones.appendChild(boton('Archivo de El Mercio', '',
      () => this.mostrar(this.notebook())));
    botones.appendChild(boton('Menú principal', 'boton--tenue',
      () => this.juego.volverAlMenu()));
    contenido.appendChild(botones);

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
    // La ÚNICA cifra grande, y son PAPELES, no puntaje. El puntaje suma
    // papeles y metros, así que puntúa igual documentar que salir corriendo; y
    // lo que este juego mide es cuánta documentación sacaste antes de que te
    // pararan. Los metros son el precio que pagaste, no el logro.
    //
    // Antes había cuatro recuadros del mismo tamaño y ninguno destacaba, así
    // que no se sabía qué se estaba puntuando. El resto es contexto y va en
    // letra de pie de foto.
    const papeles = datos.papeles ?? 0;
    const marcador = el('div', 'plana__marcador');
    marcador.appendChild(el('span', 'plana__marcador-rotulo', 'PAPELES RECOGIDOS'));
    marcador.appendChild(el('span', 'plana__marcador-cifra',
      papeles.toLocaleString('es-EC')));
    if (datos.esRecord && papeles > 0) {
      marcador.appendChild(el('span', 'plana__record', 'RÉCORD PERSONAL'));
    }
    plana.appendChild(marcador);

    plana.appendChild(el('div', 'plana__datos',
      `${(datos.distancia ?? 0).toLocaleString('es-EC')} m corridos · `
      + `${datos.evidencias?.length ?? 0} evidencias · `
      + `${(datos.puntaje ?? 0).toLocaleString('es-EC')} de puntaje`));

    // --- El remate editorial, como pie de la nota --------------------------
    if (datos.texto) {
      const cuerpo = el('p', 'plana__cuerpo');
      cuerpo.appendChild(document.createTextNode(datos.texto));
      plana.appendChild(cuerpo);
      plana.appendChild(el('div', 'plana__firma', 'El Mercio'));
    }

    // --- Cita verificada, si el equipo cargó alguna ------------------------
    if (datos.cita) {
      const cita = el('div', 'cita cita--plana');
      cita.appendChild(el('div', 'cita__texto', `«${datos.cita.texto}»`));
      cita.appendChild(el('span', 'cita__fuente',
        `${datos.cita.autor} · ${datos.cita.fuente} · ${datos.cita.fecha}`));
      plana.appendChild(cita);
    }

    // --- Tabla de posiciones ----------------------------------------------
    plana.appendChild(this._tablaPosiciones(papeles));

    // --- Lo que se desbloqueó ---------------------------------------------
    this._pintarDesbloqueos(datos, plana);

    return plana;
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
   * Tabla de posiciones, maquetada como la de un diario deportivo: puesto,
   * nombre y cifra, alineada a la derecha y con filete entre filas.
   *
   * Solo se enseñan el primero y el entorno del jugador. Los diez completos en
   * un móvil obligan a hacer scroll dentro de una pantalla que ya es larga, y
   * a nadie le importa el séptimo.
   */
  _tablaPosiciones(papeles, alrededor = 1) {
    const bloque = el('section', 'plana__tabla');
    bloque.appendChild(el('h2', 'plana__seccion', 'TABLA DE POSICIONES'));
    bloque.appendChild(el('div', 'plana__epigrafe', 'Por papeles recogidos'));

    const lista = el('ol', 'posiciones');

    for (const fila of tablaConJugador(papeles, alrededor)) {
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

      item.appendChild(el('span', 'posiciones__cifra', fila.papeles.toLocaleString('es-EC')));
      lista.appendChild(item);
    }

    bloque.appendChild(lista);
    // El periódico dice lo que sabe. No hay servidor detrás y fingir que sí lo
    // hay sería exactamente lo que este juego critica.
    bloque.appendChild(el('div', 'plana__nota-tabla',
      'Tabla de muestra. Todavía no hay marcadores en línea: los puestos que no '
      + 'son el tuyo son de mentira, como tantas cosas.'));

    return bloque;
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
