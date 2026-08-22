// ============================================================================
// ESCENA BASE — Iluminación, niebla, decorado y dron
// ============================================================================
// Cada escenario hereda de aquí. La base resuelve lo que todos comparten:
//
//   · Luces (ambiente + direccional + relleno de color que sigue al jugador)
//   · Niebla, que además hace de distancia de dibujado: lo lejano se funde
//     con el fondo y no hay que pintar más allá
//   · Decorado lateral reciclable
//   · Dron de vigilancia sobrevolando la pista
//
// Los escenarios concretos solo cambian paleta y props, y si acaso añaden una
// mecánica propia (la oscuridad del Apagón).
//
// Ver docs/ESTILO.md para las reglas de iluminación.
// ============================================================================

import * as THREE from 'three';
import { crearDecorado, crearDron, crearCruceAereo, CRUCE_AEREO, BOCACALLE }
  from '../models/props.js';
import { ANCHO_PISTA } from '../game/Track.js';
import { CALIDAD } from '../config/estilo.js';
import { fondoDe } from '../utils/entorno.js';

const SEPARACION_DECORADO = 15;

// LOS EDIFICIOS YA NO PASAN POR LA CUNETA.
//
// Había un «hito» que cruzaba cada trescientos metros: el mismo palacio que
// ahora está de frente en la bifurcación. Puesto en los dos sitios se veía dos
// veces en la misma calle, y eso no dobla la presencia, la reparte. El sitio
// del edificio es el cruce, que es donde significa algo porque es donde hay que
// decidir si se entra. Ver models/hitos.js.
// Y EL PASILLO APRIETA. 3.4 de vereda dejaba las fachadas a 6,15-6,65 del eje
// con la calzada acabando en 4,4: casi dos metros de acera vacía a cada lado,
// que en pantalla es cuadro muerto entre lo que se corre y lo que se mira. En
// la referencia no hay acera: la pared está pegada a la vía.
//
// 2.2 deja las fachadas a 4,95-5,45, o sea medio metro de vereda en Guayaquil
// y uno en el centro histórico, que es lo que miden de verdad. Y no toca nada
// de juego: lo generado —obstáculos, tarimas, papeles— vive dentro de |x| 4,4.
const OFFSET_LATERAL = ANCHO_PISTA / 2 + 2.2;

export class BaseScene {
  /**
   * @param {THREE.Scene} escena
   * @param {object} config  Configuración del escenario (config/escenarios.js)
   * @param {object} calidad Nivel gráfico (utils/calidad.js)
   */
  constructor(escena, config, calidad = { nivel: 'alta', ...CALIDAD.alta }) {
    this.escena = escena;
    this.config = config;
    this.colores = config.colores;
    this.calidad = calidad;

    this.grupo = new THREE.Group();
    escena.add(this.grupo);

    this.decorados = [];
    this.cruces = [];
    this.tiempo = 0;

    // --- DESPEJE ANTE EL CRUCE ---------------------------------------------
    // Al acercarse al edificio de la bifurcación, la niebla se retira y la luz
    // sube: la decisión de por dónde entrar hay que poder tomarla VIENDO el
    // edificio, no adivinándolo en la bruma. Game escribe el objetivo (0 lejos
    // del cruce, 1 delante de la fachada) según la distancia; aquí se suaviza
    // y se aplica. Al cruzar, el objetivo vuelve a 0 y el ambiente regresa.
    this.despeje = 0;
    this.despejeObjetivo = 0;

    // --- EL HUECO DE LA BOCACALLE -------------------------------------------
    // Dónde está el plano del cruce, o null si no hay cruce en pista. Lo
    // escribe Game (ver _actualizarJuego). Con él se apaga el decorado que
    // caería justo encima de la calle transversal: la manzana del barrio se
    // recicla a x = ±7,8…10,4 sin ningún hueco, así que sin esto la bocacalle
    // se monta detrás de una pared de puestos y no se ve nunca.
    this.zBocacalle = null;

    // El Apagón gestiona su propia luz y niebla (la oscuridad ES su mecánica):
    // pone esto a true y BaseScene no le toca las intensidades.
    this.luzPropia = false;

    // CUÁNTO DE ESTE BARRIO YA ESTÁ PUESTO: 0 recién cruzado, 1 asentado.
    //
    // Lo escribe la transición de ambiente (scenes/Ambiente.js) y sirve para lo
    // que no es luz de escena sino un objeto que emite: el cono de la linterna
    // del Apagón, por ejemplo, que dibujado a plena luz de la Bahía se lee como
    // un cono de plástico y no como un haz. Vale 1 salvo durante los dos
    // segundos que dura un cruce, así que quien no lo mire funciona igual.
    this.entrada = 1;

    this._crearLuces();
    this._crearNiebla();
    this._crearDecorado();
    this._crearCrucesAereos();
    this._crearDron();

    // Las intensidades de reposo, para poder subirlas con el despeje y
    // devolverlas exactamente a su sitio.
    this.intensidadBase = {
      ambiente: this.luzAmbiente.intensity,
      cielo: this.luzCielo.intensity,
      direccional: this.luzDireccional.intensity,
    };
  }

  // -------------------------------------------------------------------------
  // MONTAJE
  // -------------------------------------------------------------------------

  _crearLuces() {
    const c = this.colores;

    // 1. Ambiente: define el suelo tonal del escenario.
    //
    // Se reparte entre una ambiental y una HEMISFÉRICA, y ahí está la mitad del
    // cambio de aspecto. La ambiental suma el mismo color por todas las caras de
    // un objeto: aplana el volumen y, sobre todo, deja las cinco caras del mismo
    // gris, que es de donde venía la sensación de maqueta apagada.
    //
    // La hemisférica separa cielo y suelo: las caras que miran arriba reciben la
    // luz del cielo y las que miran abajo el rebote cálido del asfalto. Un cubo
    // liso pasa a tener tres tonos sin necesidad de más focos, y el rebote
    // caliente por debajo es exactamente el truco que hace que los juegos de
    // esta familia se vean soleados en vez de tristes.
    // AHORA EL AMBIENTE LO PONE EL CIELO, NO ESTA LÁMPARA.
    //
    // Iba a 0.45 del ambiente del escenario, y era la que sostenía las caras en
    // sombra. Desde que la escena tiene mapa de entorno (utils/entorno.js), ese
    // trabajo lo hace el cielo —y lo hace mucho mejor, porque una cara que mira
    // al este recibe el color del este y no el mismo gris por los cuatro
    // costados—. Dejar las dos era sumar dos ambientes: el mundo salía lavado,
    // con un 24 % de la pantalla quemada a blanco, medido.
    //
    // Se queda un rescoldo —0.067, una séptima parte de lo que había— para que
    // nada caiga a negro absoluto en los rincones donde el cielo no llega.
    this.luzAmbiente = new THREE.AmbientLight(
      c.luzAmbiente, c.intensidadAmbiente * 0.067,
    );
    this.grupo.add(this.luzAmbiente);

    // La hemisférica baja de 0.95 a 0.233 por el mismo motivo: el mapa de
    // entorno ES una hemisférica, pero con la forma del cielo de verdad en vez
    // de dos colores interpolados. Se queda con la cuarta parte porque el
    // reparto cielo/suelo que hace ella sigue ayudando en las caras que miran
    // justo al horizonte, donde el degradado del entorno se aplana.
    this.luzCielo = new THREE.HemisphereLight(
      c.luzCielo ?? c.nieblaLejos,
      c.rebote ?? c.luzAmbiente,
      c.intensidadAmbiente * 0.233,
    );
    this.luzCielo.position.set(0, 30, 0);
    this.grupo.add(this.luzCielo);

    // 2. Direccional cálida: da volumen a las cajas low-poly.
    // Y la direccional SUBE un 44 %. Con el ambiente recortado, es la que tiene
    // que dibujar el volumen: es la diferencia entre la cara iluminada y la
    // sombra lo que hace que un color se lea como color y no como una mancha
    // plana. Medido: la saturación media del cuadro pasa de 0,14 a 0,18.
    this.luzDireccional = new THREE.DirectionalLight(
      c.luzDireccional, c.intensidadDireccional * 1.44,
    );
    // EL SOL BAJA DE 64° A 44°, Y ESO ES LO QUE DA EL TERCER VALOR.
    //
    // Con la direccional en (6, 15, 4) —64° de elevación— cada caja tenía DOS
    // valores, no tres: sondeando un cubo biselado con el material de la casa y
    // leyendo un parche de 7×7 píxeles en el centro de cada cara, salía
    // superior 0,655 · frontal 0,416 · lateral 0,411. O sea que las dos caras
    // verticales eran INDISTINGUIBLES (razón 1,01), y sin diferencia entre la
    // cara que mira y la que se va, una caja es una silueta plana.
    //
    // No hacía falta ni un material más ni colores por vértice —lo primero
    // duplica llamadas de dibujo sobre un presupuesto de 1.165, lo segundo es
    // una bandera del MATERIAL y los materiales van compartidos entre la
    // geometría de la casa, planos, cilindros y el GLB—. Bastaba con bajar el
    // sol, que cuesta cero:
    //
    //     (6, 15, 4)    64°   0,655 / 0,416 / 0,411   →  1,59 : 1,01 : 1,00
    //     (7, 11, 4.5)  52°   0,629 / 0,444 / 0,393   →  1,60 : 1,13 : 1,00
    //     (7.5, 9, 5)   44°   0,608 / 0,469 / 0,384   →  1,58 : 1,22 : 1,00
    //
    // A 44° la escalera es de tres peldaños de verdad, y además es la altura a
    // la que está el sol en las fotos de las que sale cada barrio: ninguna es
    // de mediodía clavado.
    this.luzDireccional.position.set(7.5, 9, 5);
    this.grupo.add(this.luzDireccional);

    // 3. Relleno de color siguiendo al jugador. Garantiza que el personaje
    //    nunca se pierda contra el fondo y tiñe el entorno cercano con el
    //    acento del escenario.
    this.luzRelleno = new THREE.PointLight(c.acento, 2.2, 46, 2);
    this.luzRelleno.position.set(0, 5, -6);
    this.grupo.add(this.luzRelleno);

    // 4. Contraluz frío desde el fondo: recorta la silueta del jugador y de
    //    los obstáculos contra la niebla. Es lo que da profundidad a la imagen.
    this.luzContra = new THREE.DirectionalLight(0x6688cc, 0.55);
    this.luzContra.position.set(-4, 6, -18);
    this.grupo.add(this.luzContra);
  }

  _crearNiebla() {
    // Exponencial: se ve más natural que la lineal a estas distancias.
    //
    // 0.012 y no 0.017. A 0.017 la niebla se comía el 69 % del color a
    // sesenta metros, o sea justo donde ahora hay que MIRAR: con la curvatura
    // subida, el siguiente grupo de obstáculos asoma por ahí, y asomaba ya
    // teñido del color del cielo. Se pierde algo de profundidad atmosférica y
    // se gana poder decidir el carril con tiempo, que es el trato correcto en
    // un juego que va de esquivar.
    // 0.005 Y NO 0.012.
    //
    // Esta niebla venía de 0.017, y bajó a 0.012 para poder ver el siguiente
    // grupo de obstáculos. El problema es el otro efecto que tiene: la niebla
    // mezcla TODO con el color del cielo, así que a media distancia los toldos,
    // las cajas y las persianas llegaban ya teñidos de azul pálido. Esa era la
    // mitad del aspecto lavado —lo que se veía como «poca luz» era en realidad
    // «todo mezclado con el fondo»—.
    //
    // Con 0.005 el barrio conserva su color hasta bien lejos y sigue habiendo
    // profundidad atmosférica en el último tramo, que es para lo que sirve.
    this.densidadBase = 0.005;
    this.escena.fog = new THREE.FogExp2(this.colores.nieblaLejos, this.densidadBase);
    // EL FONDO YA NO ES UN COLOR PLANO.
    //
    // Era `new THREE.Color(nieblaLejos)`: el cuarto superior del cuadro con un
    // solo valor de punta a punta. Ahora es el mismo cielo pintado que alimenta
    // los reflejos —degradado, sol y nubes—, que estaba generado y no se veía.
    // Ver utils/entorno.js.
    //
    // La banda del ecuador de ese cielo ES `nieblaLejos`, o sea exactamente el
    // color de la niebla, y eso no es casualidad sino la condición para que
    // esto funcione: lo lejano tiene que seguir fundiéndose con el fondo sin
    // costura. Comprobado con muestras a un lado y otro del horizonte.
    this.escena.background = fondoDe(this.config.id, this.colores);
  }

  /**
   * EL DECORADO SE APUNTA AHORA Y SE CONSTRUYE A PLAZOS.
   *
   * Aquí estaba el congelón entero. Medido cronometrando cada parte del montaje
   * con el reloj parado: construir un barrio costaba 400 ms en la Bahía, 615 en
   * las Elecciones y 355 en Carondelet, y de esos, 398 / 609 / 351 eran ESTE
   * método. El cruce aéreo cuesta 0-15 y el dron cero.
   *
   * Y no se puede hacer más barato pieza a pieza —ya se le subió el suelo del
   * bisel y bajó cuatro veces, ver utils/geometria.js— porque son treinta y dos
   * manzanas y cada una vale de doce a diecinueve milisegundos: es trabajo real
   * que hay que hacer. Lo que sí se puede es no hacerlo TODO EN EL MISMO
   * FOTOGRAMA.
   *
   * Así que este método solo apunta las treinta y dos en una lista y las
   * construye `construirPendientes()`, con un presupuesto de milisegundos por
   * fotograma. El barrio se preconstruye durante la aproximación al cruce, que
   * dura cientos de metros: sobran fotogramas.
   */
  _crearDecorado() {
    const porLado = this.calidad.decoradosPorLado;
    // Se fija ANTES de construir nada porque _crearCrucesAereos lo necesita y
    // porque el reciclado lo usa desde el primer fotograma.
    this.totalDecorado = SEPARACION_DECORADO * porLado;

    /** Lo que falta por levantar. Se vacía en construirPendientes(). */
    this.pendientes = [];
    for (const signo of [-1, 1]) {
      for (let i = 0; i < porLado; i++) this.pendientes.push({ signo, i });
    }

    // Cuánto ha avanzado el decorado desde que se apuntó la lista. Una pieza
    // que se construye veinte fotogramas más tarde tiene que nacer donde
    // estaría si hubiera nacido con las demás, no en su z de origen: si no,
    // aparecería veinte metros por detrás y se vería llegar.
    this.recorridoDecorado = 0;
  }

  /**
   * Levanta las manzanas que quepan en el presupuesto y dice si queda alguna.
   *
   * @param {number} presupuestoMs Cuánto se le puede dedicar a este fotograma.
   *   Con 0 construye una y para, que es el mínimo para que siempre progrese.
   * @returns {boolean} true si ya no queda nada pendiente.
   */
  construirPendientes(presupuestoMs = 6) {
    if (!this.pendientes?.length) return true;
    const hasta = performance.now() + presupuestoMs;
    do {
      this._levantarDecorado(this.pendientes.shift());
    } while (this.pendientes.length && performance.now() < hasta);
    return this.pendientes.length === 0;
  }

  /** Termina de golpe lo que quede. Se llama justo antes de enseñar el barrio. */
  rematarDecorado() {
    while (this.pendientes?.length) this._levantarDecorado(this.pendientes.shift());
  }

  /** Una manzana, con su sitio. Es el cuerpo del bucle de antes. */
  _levantarDecorado({ signo, i }) {
    const elemento = crearDecorado(this.config.id, this.colores);

    // La z de origen MENOS lo ya recorrido: ver recorridoDecorado.
    const z = -i * SEPARACION_DECORADO + this.recorridoDecorado;
    // Variación lateral, para que no quede una pared perfectamente recta.
    // Salvo cuando el propio elemento pide alineación: una hilera de
    // puestos de mercado va a escuadra, y torcerla se lee como error de
    // colocación, no como desorden de barrio.
    const alineado = !!elemento.userData.alineado;
    const desviacion = alineado ? 0 : Math.random() * 2.6;
    elemento.position.set(signo * (OFFSET_LATERAL + desviacion), 0, z);
    elemento.rotation.y = signo > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (!alineado) elemento.scale.setScalar(0.85 + Math.random() * 0.55);

    this.grupo.add(elemento);
    this.decorados.push({
      objeto: elemento,
      signo,
      alineado,
      // Cada patrulla parpadea a su ritmo; sincronizadas se leen como bug.
      fasePatrulla: Math.random() * Math.PI * 2,
    });
  }

  /**
   * LO QUE CRUZA LA CALLE POR ENCIMA. Ver crearCruceAereo() en models/props.js
   * para la medición que justifica que exista.
   *
   * Es una capa aparte y no un decorado más porque va en el eje —x = 0— y no
   * al lado, así que ni se sortea su desviación lateral ni se le cambia la
   * escala al reciclar: un tendido que cruza la calle la cruza entera, y uno
   * al 85 % se quedaría a medio camino colgando de nada.
   */
  _crearCrucesAereos() {
    // Cubre el mismo largo que el decorado, para que las dos capas reciclen
    // sobre la misma vuelta y no se desincronicen nunca.
    const cuantos = Math.max(2, Math.round(this.totalDecorado / CRUCE_AEREO.SEPARACION));
    this.separacionCruce = this.totalDecorado / cuantos;

    for (let i = 0; i < cuantos; i++) {
      const pieza = crearCruceAereo(this.config.id, this.colores);
      // La Bahía devuelve null: ya tiene bóveda de punta a punta, y colgarle
      // un tendido por encima sería un techo sobre otro techo.
      if (!pieza) return;
      pieza.position.set(0, 0, -i * this.separacionCruce);
      this.grupo.add(pieza);
      this.cruces.push({ objeto: pieza });
    }
  }

  /**
   * Dron de vigilancia. Sobrevuela la pista describiendo un vaivén lateral:
   * está siempre presente pero nunca tapa el carril del jugador.
   */
  _crearDron() {
    if (!this.calidad.particulas) {
      this.dron = null;
      return;
    }

    this.dron = crearDron();
    this.dron.position.set(3, 8.5, -34);
    this.grupo.add(this.dron);
  }

  // -------------------------------------------------------------------------
  // ACTUALIZACIÓN
  // -------------------------------------------------------------------------

  /**
   * @param {number} dt
   * @param {number} avance Distancia recorrida este fotograma
   * @param {Player} jugador
   */
  actualizar(dt, avance, jugador) {
    this.tiempo += dt;

    // --- Despeje ante el cruce ---------------------------------------------
    // El objetivo ya es continuo con la distancia; el lerp solo amortigua los
    // saltos (cruzar, reiniciar), para que la niebla nunca dé un corte seco.
    this.despeje += (this.despejeObjetivo - this.despeje) * (1 - Math.exp(-2.8 * dt));
    const d = this.despeje;

    if (!this.luzPropia) {
      if (this.escena.fog) {
        // Se retira hasta dejar una quinta parte: el edificio queda nítido y
        // el fondo lejano sigue teniendo aire, no un corte a cielo raso.
        this.escena.fog.density = this.densidadBase * (1 - 0.8 * d);
      }
      // La luz sube como si al edificio le dieran sus focos de fachada.
      this.luzAmbiente.intensity = this.intensidadBase.ambiente * (1 + 0.35 * d);
      this.luzCielo.intensity = this.intensidadBase.cielo * (1 + 0.3 * d);
      this.luzDireccional.intensity = this.intensidadBase.direccional * (1 + 0.3 * d);
    }

    // --- Decorado ----------------------------------------------------------
    // Y EL HUECO POR EL QUE SE VE LA BOCACALLE.
    //
    // La calle transversal del cruce ocupa una banda de z, y la manzana de ESTE
    // barrio la taparía entera. Hay que abrir el hueco que en una ciudad abre
    // la propia esquina.
    //
    // Se apaga por VENTANA y se queda apagado hasta que la pieza recicle, y las
    // dos cosas tienen motivo:
    //
    //   · Ventana: media banda (6 m) más MARGEN_DECORADO (8 m, la media manzana
    //     más ancha que genera crearDecorado). Sin el margen, una hilera con el
    //     centro fuera de la banda se queda cruzada por encima de la calzada.
    //
    //   · Latch: la banda viaja hacia el jugador AL MISMO RITMO que el
    //     decorado, así que lo que está fuera se queda fuera; la única manera
    //     de entrar es reciclando, y eso ocurre con el cruce todavía a 216-245
    //     metros, con la niebla comiéndose el 73 % de la pieza. Sin el latch, la
    //     pieza volvería a encenderse en el fotograma del cruce —a dos metros
    //     del jugador— y sería un puesto de mercado apareciendo de la nada.
    const zBoca = this.zBocacalle;
    const bandaDesde = BOCACALLE.FONDO - BOCACALLE.MARGEN_DECORADO;
    const bandaHasta = BOCACALLE.FRENTE + BOCACALLE.MARGEN_DECORADO;

    // Lo que llevan recorrido las manzanas ya levantadas. Lo necesita
    // _levantarDecorado para que una pieza que se construye tarde nazca donde
    // le toca y no veinte metros por detrás.
    this.recorridoDecorado += avance;

    for (const d of this.decorados) {
      d.objeto.position.z += avance;

      if (d.objeto.position.z > SEPARACION_DECORADO) {
        d.objeto.position.z -= this.totalDecorado;
        // Vuelve a entrar en juego: la pieza que renace es otra manzana.
        d.oculto = false;
        // Al reciclar, revolvemos posición y escala: la ciudad no se repite.
        if (!d.alineado) {
          d.objeto.position.x = d.signo * (OFFSET_LATERAL + Math.random() * 2.6);
          d.objeto.scale.setScalar(0.85 + Math.random() * 0.55);
        }
      }

      if (zBoca !== null) {
        const relativa = d.objeto.position.z - zBoca;
        if (relativa > bandaDesde && relativa < bandaHasta) d.oculto = true;
      }
      d.objeto.visible = !d.oculto;

      // Luces de emergencia de las patrullas.
      const patrulla = d.objeto.userData.patrulla;
      if (patrulla) {
        const ciclo = Math.sin(this.tiempo * 7 + d.fasePatrulla);
        const luces = patrulla.userData.luces;
        // Alternancia dura entre azul y rojo, como una barra real.
        luces.azul.material.emissiveIntensity = ciclo > 0 ? 4.5 : 0.2;
        luces.rojo.material.emissiveIntensity = ciclo > 0 ? 0.2 : 4.5;
      }
    }

    // --- Los cruces aéreos -------------------------------------------------
    // Mismo reciclado que el decorado y misma regla de la bocacalle: en la
    // esquina no hay tendido, porque el tendido va de fachada a fachada y ahí
    // no hay fachada. Sin esto, el cable cruzaría la calle transversal
    // colgando del aire, que es la señal más clara de que algo está montado y
    // no construido.
    for (const c of this.cruces) {
      c.objeto.position.z += avance;
      if (c.objeto.position.z > this.separacionCruce) {
        c.objeto.position.z -= this.totalDecorado;
        c.oculto = false;
      }
      if (zBoca !== null) {
        const relativa = c.objeto.position.z - zBoca;
        if (relativa > bandaDesde && relativa < bandaHasta) c.oculto = true;
      }
      c.objeto.visible = !c.oculto;
    }

    // --- Dron --------------------------------------------------------------
    if (this.dron) {
      // Vaivén lateral amplio y lento, y flotación vertical suave.
      this.dron.position.x = Math.sin(this.tiempo * 0.42) * 5.5;
      this.dron.position.y = 8.5 + Math.sin(this.tiempo * 1.1) * 0.5;
      // Se inclina hacia donde se mueve: da sensación de vuelo real.
      this.dron.rotation.z = -Math.cos(this.tiempo * 0.42) * 0.16;
      this.dron.rotation.y = Math.sin(this.tiempo * 0.3) * 0.3;

      for (const rotor of this.dron.userData.helices) {
        rotor.rotation.y += dt * 42;
      }
    }

    // La luz de relleno acompaña al jugador para que siempre esté iluminado.
    this.luzRelleno.position.x = jugador.x * 0.5;
  }

  // -------------------------------------------------------------------------
  // CICLO DE VIDA
  // -------------------------------------------------------------------------

  /** Devuelve la paleta, para que pista y obstáculos se tiñan igual. */
  obtenerColores() {
    return this.colores;
  }

  /**
   * LO QUE HAY PUESTO AHORA MISMO, para poder viajar desde aquí.
   *
   * Es la foto del ambiente en el instante del cruce, y son los valores VIVOS,
   * no los de la paleta: si se cruza con el despeje de la bifurcación abierto,
   * lo que había en pantalla era una calle sin niebla y con la luz subida, y es
   * de ahí de donde tiene que salir el fundido. Si se sale del Apagón con la
   * linterna encendida, igual.
   *
   * Se llama ANTES de suspender(), porque la niebla y el fondo son globales de
   * la escena Three y suspender() se los lleva. Ver scenes/Ambiente.js.
   */
  retrato() {
    const c = this.colores;
    return {
      colores: c,
      color: {
        ambiente: this.luzAmbiente.color.clone(),
        cielo: this.luzCielo.color.clone(),
        suelo: this.luzCielo.groundColor.clone(),
        direccional: this.luzDireccional.color.clone(),
        relleno: this.luzRelleno.color.clone(),
        niebla: this.escena.fog
          ? this.escena.fog.color.clone()
          : new THREE.Color(c.nieblaLejos),
        // El fondo dejó de ser un color y pasó a ser el cielo pintado, así
        // que lo que la transición necesita guardar ya no es un THREE.Color
        // sino la PALETA de la que sale ese cielo. Ver Ambiente.actualizar().
        fondo: new THREE.Color(c.nieblaLejos),
      },
      intensidad: {
        ambiente: this.luzAmbiente.intensity,
        cielo: this.luzCielo.intensity,
        direccional: this.luzDireccional.intensity,
      },
      niebla: this.escena.fog ? this.escena.fog.density : this.densidadBase,
      entorno: this.escena.environmentIntensity,
      mapaEntorno: this.escena.environment,
    };
  }

  /**
   * Devuelve luces, niebla y fondo a los colores de ESTE barrio.
   *
   * Hace falta porque la transición de ambiente escribe colores mezclados
   * directamente en las lámparas y en la niebla, y un cruce puede cortarse a
   * medias —te atrapan, abandonas, cruzas otra vez—. Sin esto, un barrio
   * aparcado a mitad de fundido guardaría esa mezcla y volvería con ella
   * puesta para siempre: la Bahía reaparecería tirando a azul marino.
   *
   * Las INTENSIDADES no se tocan aquí a propósito: ésas la escena las reescribe
   * enteras en su primer actualizar(), así que se arreglan solas.
   */
  restablecerPaleta() {
    const c = this.colores;
    this.luzAmbiente.color.set(c.luzAmbiente);
    this.luzCielo.color.set(c.luzCielo ?? c.nieblaLejos);
    this.luzCielo.groundColor.set(c.rebote ?? c.luzAmbiente);
    this.luzDireccional.color.set(c.luzDireccional);
    this.luzRelleno.color.set(c.acento);
    if (this.escena.fog) this.escena.fog.color.set(c.nieblaLejos);
    // El fondo vuelve al cielo de ESTE barrio: si se salió a mitad de fundido,
    // lo que hay colgado es el cielo de tránsito con la mezcla a medias.
    this.escena.background = fondoDe(this.config.id, c);
    this.entrada = 1;
  }

  /** Gancho del potenciador linterna. Solo lo implementa el Apagón. */
  encenderLinterna() {}

  /**
   * APARCA el escenario sin tirarlo. Es la mitad barata del cambio de barrio.
   *
   * Construir una de estas escenas cuesta entre 380 y 680 ms EN UN SOLO
   * FOTOGRAMA (medido con el juego corriendo: la Bahía 530, Elecciones 460,
   * Carondelet 380; solo el Apagón es barato porque es escaso). Con
   * destruir/crear en cada cruce, ese medio segundo caía justo al doblar la
   * esquina y el juego se CONGELABA a la vista —antes lo disimulaba el
   * fogonazo blanco del cruce; al quitarlo, quedó desnudo—.
   *
   * Así que los barrios no se destruyen al salir: se descuelgan del grafo y
   * esperan. Volver a un barrio ya visitado es re-colgar su grupo: menos de un
   * milisegundo. La memoria de tener los cuatro montados es asumible porque
   * las geometrías ya se comparten (utils/geometria.js) y lo que queda vivo
   * son mallas y materiales.
   */
  suspender() {
    this.escena.remove(this.grupo);
    // La niebla y el fondo son GLOBALES de la escena Three: se guardan los de
    // este barrio y se sueltan, y quien entre después pone los suyos.
    this.nieblaGuardada = this.escena.fog;
    this.fondoGuardado = this.escena.background;
    this.escena.fog = null;
  }

  /** Vuelve a colgar un escenario aparcado. El espejo exacto de suspender(). */
  reanudar() {
    this.escena.add(this.grupo);
    if (this.nieblaGuardada) this.escena.fog = this.nieblaGuardada;
    if (this.fondoGuardado) this.escena.background = this.fondoGuardado;
    // El despeje del cruce anterior no debe heredarse: se vuelve con la
    // niebla puesta y el juego ya la retirará al acercarse al próximo cruce.
    this.despeje = 0;
    this.despejeObjetivo = 0;
    // Y la paleta, tampoco: un barrio del que se salió a mitad de fundido
    // guardó luces y niebla con el color del vecino a medias. Se vuelve
    // siempre con la propia, y ya la transición volverá a mezclarla si hay
    // cruce. Ver restablecerPaleta().
    this.restablecerPaleta();
  }

  /** Desmonta el escenario y libera memoria. */
  destruir() {
    this.escena.remove(this.grupo);
    this.grupo.traverse((obj) => {
      // Lo compartido (clones del GLB, materiales de catálogo) no se libera:
      // otras escenas y los cruces siguen usándolo, y liberarlo aquí evicta
      // los buffers del modelo entero para todos. Mismo criterio que
      // Bifurcacion._destruir().
      if (obj.userData.compartido) return;
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    this.decorados = [];
    this.cruces = [];
    this.dron = null;
    this.escena.fog = null;
  }
}
