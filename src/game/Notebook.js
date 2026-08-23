// ============================================================================
// ARCHIVO — Meta-progreso persistente
// ============================================================================
// Lo único que sobrevive entre partidas. Guarda en localStorage:
//   · Papeles acumulados (la moneda de meta-progreso)
//   · Páginas desbloqueadas del periódico (reportajes REALES de El Mercio;
//     ver config/publicaciones.js)
//   · Evidencias encontradas
//   · Récords y el árbol de rutas recorridas
//
// Todo el acceso a localStorage pasa por aquí. Si el navegador lo tiene
// bloqueado (modo privado de Safari, por ejemplo), el juego sigue funcionando
// con el progreso solo en memoria: se degrada, no se rompe.
// ============================================================================

import { PROGRESO, CATALOGO_POTENCIADORES } from '../config/balance.js';
import { PERSONAJES } from '../config/personajes.js';
import { PAGINAS } from '../config/publicaciones.js';
import { ESCENARIOS } from '../config/escenarios.js';

const ESTADO_INICIAL = {
  version: 1,
  // Papeles acumulados. NO SON UNA MONEDA: no se gastan en nada. Alimentan las
  // tres clasificaciones y la cifra grande de la portada del final, y eso es
  // todo. Lo que abre páginas del Archivo son las pruebas del caso.
  totalEvidencia: 0,
  evidenciaHistorica: 0,   // Total acumulado de siempre (nunca baja)
  paginasDesbloqueadas: [],
  pruebasEncontradas: [],
  mejorDistancia: 0,
  mejorPuntaje: 0,
  // Papeles de la MEJOR corrida, que no es lo mismo que `totalEvidencia` (lo que
  // te queda por gastar) ni que `evidenciaHistorica` (lo que juntaste desde
  // siempre). Es la marca personal, y es la cifra que compite en la tabla.
  mejorEvidencia: 0,
  // Cómo te llamas en el ranking. Vacío hasta que alguien lo cambia desde
  // «Cambiar nombre»; mientras tanto la tabla usa el apodo por defecto.
  nombreJugador: '',
  // Entes de control cuyo relato ya se leyó. Se cuenta UNA vez cada uno; a
  // partir de la segunda visita solo queda la acusación de siempre. Ver
  // Game._contarInstitucion().
  institucionesContadas: [],
  // Metros acumulados de todas las partidas. Es la segunda clasificación de la
  // página de deportes; `mejorDistancia` es otra cosa (la mejor corrida).
  distanciaHistorica: 0,
  partidasJugadas: 0,
  rutasRecorridas: [],    // Historial de escenarios visitados
  personajePreferido: 'tostadologo',
  // Qué fichajes y potenciadores ya se han visto EN LA REDACCIÓN. No es lo
  // mismo que estar desbloqueado: el sobre te lo anuncia al terminar la
  // corrida, pero la ficha sigue marcada como nueva hasta que abres la
  // pantalla donde vive. Es el punto rojo de toda la vida, y sirve para lo
  // mismo: que lo que te dieron tenga un sitio al que ir a verlo.
  // `null` significa «nunca se ha mirado esto». Al cargar una partida que ya
  // venía jugada se rellena con todo lo que esa partida tuviera abierto (ver
  // `_cargar`): si no, quien vuelve al juego se encuentra la Redacción entera
  // marcada como nueva, y una pantalla donde TODO es nuevo no marca nada.
  vistosEnRedaccion: null,
  // Dónde te capturaron la última vez. La partida siguiente arranca ahí:
  // volver siempre a la Bahía rompía la continuidad de la temporada y
  // convertía cada muerte en un reinicio del relato, no en un capítulo.
  ultimoEscenario: 'bahia',
  // ¿Se logró alguna vez el trámite perfecto? Es el final del juego.
  denunciaPresentada: false,
  // Tramos recorridos en total, entre todas las partidas. Es el contador que
  // abre los potenciadores: acumulativo a propósito, para que ninguna corrida
  // se pierda del todo —hasta la peor te acerca al siguiente desbloqueo.
  tramosRecorridos: 0,
};

export class Notebook {
  constructor() {
    this.almacenamientoDisponible = this._comprobarAlmacenamiento();
    this.estado = this._cargar();
    // Ver `vistosEnRedaccion` en el estado inicial: `null` es «nunca se ha
    // mirado». Se resuelve aquí, con el progreso ya cargado, porque hace falta
    // saber qué estaba abierto para decidir qué NO es nuevo.
    if (this.estado.vistosEnRedaccion == null) {
      this.estado.vistosEnRedaccion = [];
      if ((this.estado.partidasJugadas ?? 0) > 0) this.marcarVistoEnRedaccion();
    }
  }

  // -------------------------------------------------------------------------
  // PERSISTENCIA
  // -------------------------------------------------------------------------

  _comprobarAlmacenamiento() {
    try {
      const prueba = '__prueba_elmercio__';
      localStorage.setItem(prueba, '1');
      localStorage.removeItem(prueba);
      return true;
    } catch {
      // Modo privado o almacenamiento deshabilitado. Seguimos sin persistir.
      console.warn('[Cuaderno] localStorage no disponible: el progreso no se guardará.');
      return false;
    }
  }

  _cargar() {
    if (!this.almacenamientoDisponible) return { ...ESTADO_INICIAL };

    try {
      const crudo = localStorage.getItem(PROGRESO.CLAVE_ALMACENAMIENTO);
      if (!crudo) return { ...ESTADO_INICIAL };

      const guardado = JSON.parse(crudo);
      // Fusionamos con el estado inicial para tolerar versiones antiguas
      // a las que les falten campos nuevos.
      const estado = { ...ESTADO_INICIAL, ...Notebook._migrar(guardado) };

      // LO QUE YA TENÍAS NO ES NUEVO. La marca de «recién abierto» llegó
      // después que el juego: sin esto, la primera visita a la Redacción de
      // quien ya llevaba veinte tramos enseñaba cuatro fichajes y seis
      // potenciadores marcados a la vez.
      if (estado.vistosEnRedaccion == null) estado.vistosEnRedaccion = null;
      return estado;
    } catch (e) {
      console.warn('[Cuaderno] Progreso corrupto, se empieza de cero.', e);
      return { ...ESTADO_INICIAL };
    }
  }

  /**
   * TRAE EL PROGRESO DE LOS NOMBRES VIEJOS.
   *
   * Al renombrar el dominio —los papeles pasaron a ser evidencia y las
   * evidencias a ser pruebas— cambiaron también las claves que se guardan en
   * el navegador. Sin esto, quien ya venía jugando abriría el juego y se
   * encontraría el archivo en blanco: los campos nuevos no existirían en su
   * partida guardada y el estado inicial los pondría a cero.
   *
   * Es una traducción de una sola dirección y se puede aplicar siempre: si la
   * clave vieja no está, no hay nada que traer. Las viejas se borran para que
   * el guardado no arrastre dos nombres de lo mismo.
   */
  static _migrar(guardado) {
    const equivalencias = [
      ['totalPapeles', 'totalEvidencia'],
      ['papelesHistoricos', 'evidenciaHistorica'],
      ['mejorPapeles', 'mejorEvidencia'],
      ['evidenciasEncontradas', 'pruebasEncontradas'],
    ];
    const estado = { ...guardado };
    for (const [viejo, nuevo] of equivalencias) {
      if (estado[viejo] === undefined) continue;
      // Si por lo que sea ya existe el nuevo, manda el nuevo: es el vigente.
      if (estado[nuevo] === undefined) estado[nuevo] = estado[viejo];
      delete estado[viejo];
    }
    return estado;
  }

  guardar() {
    if (!this.almacenamientoDisponible) return false;
    try {
      localStorage.setItem(PROGRESO.CLAVE_ALMACENAMIENTO, JSON.stringify(this.estado));
      return true;
    } catch (e) {
      console.warn('[Cuaderno] No se pudo guardar el progreso.', e);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // REGISTRO DE PARTIDAS
  // -------------------------------------------------------------------------

  /**
   * Cierra una partida y consolida su resultado.
   * @param {{papeles:number, distancia:number, puntaje:number,
   *          pruebas:string[], ruta:string[]}} resultado
   * @returns {{paginasNuevas:Array}} Lo que se desbloqueó con esta partida
   */
  registrarPartida(resultado) {
    // Cada escenario visitado cuenta como un tramo. La ruta incluye el de
    // salida, así que la primera partida ya suma uno.
    this.estado.tramosRecorridos += resultado.ruta?.length ?? 0;

    this.estado.totalEvidencia += resultado.papeles;
    this.estado.evidenciaHistorica += resultado.papeles;
    this.estado.partidasJugadas += 1;

    this.estado.mejorDistancia = Math.max(this.estado.mejorDistancia, resultado.distancia);
    this.estado.mejorPuntaje = Math.max(this.estado.mejorPuntaje, resultado.puntaje);
    this.estado.mejorEvidencia = Math.max(this.estado.mejorEvidencia ?? 0, resultado.papeles);
    this.estado.distanciaHistorica = (this.estado.distanciaHistorica ?? 0) + resultado.distancia;

    // Evidencias: guardamos cada tipo una sola vez.
    for (const ev of resultado.pruebas ?? []) {
      if (!this.estado.pruebasEncontradas.includes(ev)) {
        this.estado.pruebasEncontradas.push(ev);
      }
    }

    // Árbol de rutas: guardamos las últimas 50 corridas.
    if (resultado.ruta?.length) {
      this.estado.rutasRecorridas.push(resultado.ruta);
      if (this.estado.rutasRecorridas.length > 50) {
        this.estado.rutasRecorridas.shift();
      }
    }

    // Desbloqueo automático: las páginas gratuitas se abren solas.
    const paginasNuevas = this._desbloquearPorAcumulacion();

    this.guardar();
    return { paginasNuevas };
  }

  /**
   * De qué caso es una prueba. Se deduce del catálogo de los escenarios, que
   * es donde ya está escrito qué suelta cada uno: mantener aquí una segunda
   * lista sería garantizar que las dos se separen.
   */
  static _casoDeLaPrueba(nombre) {
    for (const id of Object.keys(ESCENARIOS)) {
      if ((ESCENARIOS[id].evidencia ?? []).includes(nombre)) return id;
    }
    return null;
  }

  /**
   * ¿Es material plantado? Se responde mirando el catálogo, no una bandera
   * guardada con la pieza: el nombre ya lo dice y una segunda fuente de verdad
   * para el mismo dato acaba separándose de la primera.
   */
  static esFalsa(nombre) {
    for (const id of Object.keys(ESCENARIOS)) {
      if ((ESCENARIOS[id].pruebasFalsas ?? []).includes(nombre)) return true;
    }
    return false;
  }

  /**
   * ¿Es una pista que solo está en redes?
   *
   * No es falsa —es cierta hasta donde se sabe— pero su único respaldo es una
   * publicación: ni documento, ni acta, ni sentencia. Se recoge, se guarda y
   * ocupa su casilla en el expediente; lo que NO hace es cerrar un reportaje.
   * Con una captura de pantalla se abre una línea de investigación, no se
   * publica una pieza, y esa es la regla de la casa metida en la mecánica.
   */
  static sinConfirmar(nombre) {
    for (const id of Object.keys(ESCENARIOS)) {
      if ((ESCENARIOS[id].pistasSinConfirmar ?? []).includes(nombre)) return true;
    }
    return false;
  }

  /** El escenario al que pertenece una pista, sea del tipo que sea. */
  static casoDe(nombre) {
    for (const id of Object.keys(ESCENARIOS)) {
      const e = ESCENARIOS[id];
      if ((e.evidencia ?? []).includes(nombre)) return id;
      if ((e.pistasSinConfirmar ?? []).includes(nombre)) return id;
    }
    return null;
  }

  /**
   * Lo que te plantaron y recogiste, en orden de aparición.
   *
   * No se guarda aparte: sale de la misma lista de siempre filtrada por
   * `esFalsa`. Dos fuentes de verdad para el mismo dato acaban separándose, y
   * esta en concreto se separaría en la peor dirección —una pieza que el
   * expediente da por falsa y la sección de recortes da por buena—.
   */
  get plantadas() {
    return (this.estado.pruebasEncontradas ?? []).filter((n) => Notebook.esFalsa(n));
  }

  /** Cuántas pruebas distintas tienes de un caso. Sin `caso`, de todos. */
  pruebasDelCaso(caso = null) {
    // Las plantadas NO cuentan, ni para su caso ni para el total. Contarlas en
    // el total —que es lo que pasaba mirando solo la longitud de la lista—
    // dejaba que un puñado de material falso abriera el último reportaje, que
    // es exactamente lo contrario de lo que la mecánica quiere decir.
    // Ni las plantadas ni las de solo-redes cuentan para PUBLICAR: las
    // primeras porque no son ciertas y las segundas porque no están probadas.
    // Las de redes sí se guardan y sí salen en el expediente —ver casoDe()—,
    // solo que no bastan para cerrar la pieza.
    const mias = (this.estado.pruebasEncontradas ?? [])
      .filter((n) => !Notebook.esFalsa(n) && !Notebook.sinConfirmar(n));
    if (!caso) return mias.length;
    return mias.filter((n) => Notebook._casoDeLaPrueba(n) === caso).length;
  }

  /**
   * ABRE LAS PÁGINAS QUE YA TIENEN PRUEBAS SUFICIENTES.
   *
   * Antes se compraban con papeles: juntabas ochocientos corriendo y pagabas.
   * Eso hacía que el periódico se armara CORRIENDO, y correr es justo lo que un
   * periodista no hace para publicar. La evidencia —los papeles— mide cuánto
   * aguantaste; lo que arma el reportaje son las PRUEBAS: el USB, el video, el
   * chat, el documento reservado.
   *
   * Y por eso ya no se compra nada. Una página no se paga: se completa. En
   * cuanto tienes las pruebas del caso, el reportaje sale —aunque te hayan
   * capturado en esa misma corrida, que es lo normal—.
   */
  _desbloquearPorAcumulacion() {
    const nuevas = [];

    for (const pagina of PAGINAS) {
      if (this.estado.paginasDesbloqueadas.includes(pagina.numero)) continue;

      const hacenFalta = pagina.pruebas ?? 0;
      if (hacenFalta > 0 && this.pruebasDelCaso(pagina.caso ?? null) < hacenFalta) {
        continue;
      }

      this.estado.paginasDesbloqueadas.push(pagina.numero);
      nuevas.push(pagina);
    }

    return nuevas;
  }

  // -------------------------------------------------------------------------
  // PÁGINAS DEL PERIÓDICO
  // -------------------------------------------------------------------------

  /** ¿Está desbloqueada esta página? */
  estaDesbloqueada(numeroPagina) {
    return this.estado.paginasDesbloqueadas.includes(numeroPagina);
  }

  /**
   * Ya no se compra ninguna página: se completan con pruebas.
   *
   * Se deja el método porque la interfaz vieja podría llamarlo, y devolver un
   * motivo legible es mejor que reventar. La apertura la hace
   * _desbloquearPorAcumulacion() al terminar cada partida.
   */
  desbloquearPagina(numeroPagina) {
    const pagina = PAGINAS.find((p) => p.numero === numeroPagina);
    if (!pagina) return { exito: false, motivo: 'No existe.' };
    if (this.estaDesbloqueada(numeroPagina)) return { exito: false, motivo: 'Ya la tienes.' };

    const faltan = (pagina.pruebas ?? 0) - this.pruebasDelCaso(pagina.caso ?? null);
    return {
      exito: false,
      motivo: faltan > 0 ? `Te faltan ${faltan} pruebas` : 'Se abre al terminar la corrida',
    };
  }

  /** Todas las páginas con su estado, para maquetar el periódico. */
  listarPaginas() {
    return PAGINAS.map((pagina) => ({
      ...pagina,
      desbloqueada: this.estaDesbloqueada(pagina.numero),
      // Cuántas pruebas del caso pide y cuántas llevas. Es lo que la página
      // cerrada enseña en vez de un precio.
      pruebasPedidas: pagina.pruebas ?? 0,
      pruebasReunidas: this.pruebasDelCaso(pagina.caso ?? null),
    }));
  }

  /**
   * EL SUMARIO DE UN CASO — lo que la página publica de verdad.
   *
   * Una página abierta enseñaba únicamente los huecos de los reportajes que El
   * Mercio todavía no ha publicado. O sea: reunías las pruebas del caso, se
   * abría la página, y dentro no había nada. El objetivo del juego entero
   * terminaba en un sello de «EN PREPARACIÓN».
   *
   * Lo que sí existe —escrito, contrastado y ya en el repositorio— es el
   * expediente: el sumario que la redacción usa para documentarse. Eso es lo
   * que llena la página. No es la pieza publicada y no se presenta como tal:
   * va con su propio rótulo, sin firma y sin fecha, porque un expediente no
   * las lleva. El reportaje sigue pendiente debajo, con su hueco.
   *
   * Y se llena SEGÚN SE RECOGE: la lista de documentos marca cuáles llevas y
   * cuáles siguen en la calle, así que el sumario crece corrida a corrida en
   * vez de aparecer entero de golpe.
   *
   * @param {string} caso Id de escenario ('bahia', 'apagon', …)
   * @returns {object|null} null si el caso no existe o no tiene expediente
   */
  sumarioDelCaso(caso) {
    const esc = ESCENARIOS[caso];
    if (!esc?.expediente) return null;

    const tengo = new Set(this.estado.pruebasEncontradas ?? []);
    // Las plantadas NO entran. Aparecen en «Lo que dice el gobierno», que es
    // donde su presencia significa algo; metidas aquí ensuciarían el único
    // sitio del Archivo donde todo lo listado está documentado.
    const documentos = (esc.evidencia ?? []).map((nombre) => ({
      nombre, tengo: tengo.has(nombre), redes: false,
    }));
    const redes = (esc.pistasSinConfirmar ?? []).map((nombre) => ({
      nombre, tengo: tengo.has(nombre), redes: true,
    }));
    const papeles = [...documentos, ...redes];

    // COMPLETO NO ES «ABIERTO».
    //
    // Una página se abre con DOS pruebas del caso, y los barrios sueltan entre
    // cuatro y seis: con dos corridas decentes por barrio se abrían las cinco
    // páginas y no quedaba ninguna razón para volver a ninguna parte. Un
    // expediente tiene un segundo estado —el de estar entero— y esa es la meta
    // que faltaba.
    //
    // Cuenta solo lo que tiene documento detrás. Las pistas que únicamente
    // están en redes se recogen y se enseñan, pero exigirlas para dar un caso
    // por completo sería justo lo contrario de la regla de la casa: convertiría
    // una captura de pantalla en un requisito de publicación.
    const conDocumento = papeles.filter((d) => !d.redes);

    return {
      caso,
      rotulo: esc.caso,
      lugar: esc.nombre,
      titulo: esc.expediente.titulo,
      escena: esc.expediente.escena,
      estado: esc.expediente.estado,
      papeles,
      reunidos: papeles.filter((d) => d.tengo).length,
      total: papeles.length,
      documentados: conDocumento.filter((d) => d.tengo).length,
      documentos: conDocumento.length,
      completo: conDocumento.length > 0 && conDocumento.every((d) => d.tengo),
    };
  }

  /**
   * El sumario de la última página, que no es de un caso: los cruza todos.
   *
   * Devuelve una línea por caso con su estado y cuánto llevas documentado. Es
   * el «qué pasó con lo que abrimos» de la página cinco, y es la única de las
   * cinco que se lee entera solo al final.
   */
  sumarioGeneral() {
    return Object.keys(ESCENARIOS)
      .map((id) => this.sumarioDelCaso(id))
      .filter(Boolean);
  }

  /** Cuántas páginas lleva abiertas, para el resumen del ejemplar. */
  get paginasAbiertas() {
    return this.estado.paginasDesbloqueadas.length;
  }

  // -------------------------------------------------------------------------
  // CONSULTAS
  // -------------------------------------------------------------------------

  get papeles() { return this.estado.totalEvidencia; }
  get evidenciaHistorica() { return this.estado.evidenciaHistorica; }
  get mejorDistancia() { return this.estado.mejorDistancia; }
  get mejorPuntaje() { return this.estado.mejorPuntaje; }
  // Con `?? 0` porque a quien ya venía jugando no se le guardó nunca: el
  // estado se lee de localStorage y las partidas viejas no traen este campo.
  get mejorEvidencia() { return this.estado.mejorEvidencia ?? 0; }
  get distanciaHistorica() { return this.estado.distanciaHistorica ?? 0; }

  /** El nombre del jugador en la tabla, o null si nunca lo cambió. */
  get nombreJugador() { return this.estado.nombreJugador || null; }

  set nombreJugador(nombre) {
    this.estado.nombreJugador = String(nombre ?? '').trim().slice(0, 24);
    this.guardar();
  }

  /** ¿Ya se contó el relato de este ente de control? */
  yaConoceInstitucion(id) {
    return (this.estado.institucionesContadas ?? []).includes(id);
  }

  /** Lo marca como contado. A partir de aquí solo queda la acusación. */
  marcarInstitucionContada(id) {
    if (!this.estado.institucionesContadas) this.estado.institucionesContadas = [];
    if (this.estado.institucionesContadas.includes(id)) return;
    this.estado.institucionesContadas.push(id);
    this.guardar();
  }
  get partidasJugadas() { return this.estado.partidasJugadas; }
  get pruebas() { return this.estado.pruebasEncontradas; }
  get rutas() { return this.estado.rutasRecorridas; }

  /**
   * El personaje elegido, SIEMPRE uno que esté desbloqueado.
   *
   * El filtro no es paranoia: borrar el progreso pone los tramos a cero pero
   * el archivo guardado puede seguir teniendo un preferido que ya no está
   * disponible, y entonces se jugaría con alguien a quien no se ha fichado.
   * Se resuelve aquí y no en el menú porque el jugador se construye antes de
   * que exista ninguna pantalla.
   */
  get personajePreferido() {
    const guardado = this.estado.personajePreferido;
    return this.personajesDesbloqueados().includes(guardado)
      ? guardado
      : PERSONAJES[0].id;
  }

  set personajePreferido(nombre) {
    this.estado.personajePreferido = nombre;
    this.guardar();
  }

  /** Temporada en la que retomar. Es donde te capturaron la última vez. */
  get ultimoEscenario() { return this.estado.ultimoEscenario ?? 'bahia'; }
  set ultimoEscenario(id) {
    this.estado.ultimoEscenario = id;
    this.guardar();
  }

  get tramosRecorridos() { return this.estado.tramosRecorridos ?? 0; }

  /**
   * Ids de potenciadores ya abiertos.
   *
   * Se calcula, no se guarda: si mañana se cambia el umbral de uno en
   * config/balance.js, el progreso de todo el mundo se recalcula solo en vez
   * de quedarse congelado con la escalera vieja.
   */
  /**
   * Qué potenciadores pueden salir. Los de escenario propio (`soloEn`) los
   * filtra Game según dónde se esté corriendo; aquí solo se resuelve el
   * progreso.
   */
  potenciadoresDesbloqueados() {
    return CATALOGO_POTENCIADORES
      .filter((p) => this.tramosRecorridos >= p.tramos)
      .map((p) => p.id);
  }

  /**
   * Qué personajes se pueden elegir. Mismo contador que los potenciadores
   * —tramos recorridos— pero con umbrales intercalados, para que ningún hito
   * reparta dos cosas a la vez y luego cuatro no repartan nada.
   */
  personajesDesbloqueados() {
    return PERSONAJES
      .filter((p) => this.tramosRecorridos >= p.tramos)
      .map((p) => p.id);
  }

  /**
   * ¿Está desbloqueado y todavía sin visitar en la Redacción?
   *
   * @param {string} id Un personaje o un potenciador; los ids no chocan.
   */
  esNuevoEnRedaccion(id) {
    if (this.estado.vistosEnRedaccion?.includes(id)) return false;
    return this.personajesDesbloqueados().includes(id)
      || this.potenciadoresDesbloqueados().includes(id);
  }

  /**
   * Se acaba de abrir la Redacción: lo que hubiera de nuevo ya se vio.
   *
   * Se marca TODO lo desbloqueado y no solo lo que se estaba enseñando: si
   * mañana la pantalla deja de pintar una de las dos listas, la otra no se
   * queda con el punto rojo puesto para siempre.
   */
  marcarVistoEnRedaccion() {
    const vistos = new Set(this.estado.vistosEnRedaccion ?? []);
    const antes = vistos.size;
    for (const id of this.personajesDesbloqueados()) vistos.add(id);
    for (const id of this.potenciadoresDesbloqueados()) vistos.add(id);
    if (vistos.size === antes) return false;
    this.estado.vistosEnRedaccion = [...vistos];
    this.guardar();
    return true;
  }

  /** El siguiente por fichar, con cuánto falta. Null si ya están todos. */
  proximoPersonaje() {
    const siguiente = PERSONAJES
      .filter((p) => this.tramosRecorridos < p.tramos)
      .sort((a, b) => a.tramos - b.tramos)[0];

    if (!siguiente) return null;
    return { ...siguiente, faltan: siguiente.tramos - this.tramosRecorridos };
  }

  /**
   * El siguiente por abrir, con cuánto falta. Es el gancho para otra corrida.
   *
   * Los de escenario propio no entran: no se "abren" nunca, así que
   * anunciarlos como próxima meta sería una promesa que no se cumple.
   */
  proximoPotenciador() {
    const siguiente = CATALOGO_POTENCIADORES
      .filter((p) => !p.soloEn && this.tramosRecorridos < p.tramos)
      .sort((a, b) => a.tramos - b.tramos)[0];

    if (!siguiente) return null;
    return { ...siguiente, faltan: siguiente.tramos - this.tramosRecorridos };
  }

  get denunciaPresentada() { return !!this.estado.denunciaPresentada; }
  set denunciaPresentada(valor) {
    this.estado.denunciaPresentada = !!valor;
    this.guardar();
  }

  /** La siguiente página comprable, para orientar al jugador. */
  /**
   * El reportaje que tienes MÁS CERCA de completar, y cuánto le falta.
   *
   * Ordenaba por `costo`, que era el precio en papeles y ya no significa nada:
   * proponía la página más barata aunque no tuvieras ni una de sus pruebas. Lo
   * que hace volver a jugar es saber que te falta UNA, así que se ordena por
   * eso —y a igualdad, primero la que menos pide, que es la más asequible—.
   */
  proximaPagina() {
    const candidatas = PAGINAS
      // Las que no piden pruebas se abren solas al terminar la corrida: como
      // meta no sirven, no hay nada que ir a buscar.
      .filter((p) => !this.estaDesbloqueada(p.numero) && (p.pruebas ?? 0) > 0)
      .map((p) => {
        const pedidas = p.pruebas ?? 0;
        const reunidas = Math.min(this.pruebasDelCaso(p.caso ?? null), pedidas);
        return { ...p, pruebasPedidas: pedidas, pruebasReunidas: reunidas,
                 faltan: Math.max(0, pedidas - reunidas) };
      })
      .sort((a, b) => a.faltan - b.faltan || a.pruebasPedidas - b.pruebasPedidas);
    return candidatas[0] ?? null;
  }

  /** Borra todo el progreso. Pide confirmación quien la llame. */
  reiniciarProgreso() {
    this.estado = { ...ESTADO_INICIAL };
    this.guardar();
  }
}
