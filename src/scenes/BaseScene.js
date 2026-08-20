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
import { crearDecorado, crearDron } from '../models/props.js';
import { ANCHO_PISTA } from '../game/Track.js';
import { CALIDAD } from '../config/estilo.js';

const SEPARACION_DECORADO = 15;

// LOS EDIFICIOS YA NO PASAN POR LA CUNETA.
//
// Había un «hito» que cruzaba cada trescientos metros: el mismo palacio que
// ahora está de frente en la bifurcación. Puesto en los dos sitios se veía dos
// veces en la misma calle, y eso no dobla la presencia, la reparte. El sitio
// del edificio es el cruce, que es donde significa algo porque es donde hay que
// decidir si se entra. Ver models/hitos.js.
const OFFSET_LATERAL = ANCHO_PISTA / 2 + 3.4;

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
    this.tiempo = 0;

    // --- DESPEJE ANTE EL CRUCE ---------------------------------------------
    // Al acercarse al edificio de la bifurcación, la niebla se retira y la luz
    // sube: la decisión de por dónde entrar hay que poder tomarla VIENDO el
    // edificio, no adivinándolo en la bruma. Game escribe el objetivo (0 lejos
    // del cruce, 1 delante de la fachada) según la distancia; aquí se suaviza
    // y se aplica. Al cruzar, el objetivo vuelve a 0 y el ambiente regresa.
    this.despeje = 0;
    this.despejeObjetivo = 0;
    // El Apagón gestiona su propia luz y niebla (la oscuridad ES su mecánica):
    // pone esto a true y BaseScene no le toca las intensidades.
    this.luzPropia = false;

    this._crearLuces();
    this._crearNiebla();
    this._crearDecorado();
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
    this.luzDireccional.position.set(6, 15, 4);
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
    this.escena.background = new THREE.Color(this.colores.nieblaLejos);
  }

  _crearDecorado() {
    const porLado = this.calidad.decoradosPorLado;

    for (const signo of [-1, 1]) {
      for (let i = 0; i < porLado; i++) {
        const elemento = crearDecorado(this.config.id, this.colores);

        const z = -i * SEPARACION_DECORADO;
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
    }

    this.totalDecorado = SEPARACION_DECORADO * porLado;
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
    for (const d of this.decorados) {
      d.objeto.position.z += avance;

      if (d.objeto.position.z > SEPARACION_DECORADO) {
        d.objeto.position.z -= this.totalDecorado;
        // Al reciclar, revolvemos posición y escala: la ciudad no se repite.
        if (!d.alineado) {
          d.objeto.position.x = d.signo * (OFFSET_LATERAL + Math.random() * 2.6);
          d.objeto.scale.setScalar(0.85 + Math.random() * 0.55);
        }
      }

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
    this.dron = null;
    this.escena.fog = null;
  }
}
