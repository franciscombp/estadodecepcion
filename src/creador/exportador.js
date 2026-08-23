// ============================================================================
// EXPORTADOR — De nuestras piezas procedurales a .glb para Blender
// ============================================================================
// El juego genera casi todo con código (src/models/). Eso es rápido de iterar y
// no pesa nada, pero deja fuera a quien no programa: para retocar una casa o un
// personaje había que editar JavaScript.
//
// Esto cierra el círculo. Exporta CUALQUIER pieza del catálogo a .glb, se abre
// en Blender, se retoca, y vuelve al juego por la carpeta de sobreescrituras
// (ver src/models/hitos.js y el README).
//
// POR QUÉ ES UNA ENTRADA DE VITE Y NO UNA PÁGINA SUELTA EN public/
// Porque tiene que importar EL MISMO código que el juego. La versión anterior
// vivía en public/, cargaba Three desde un CDN en r128 —el juego va por r184— y
// exportaba unos cubos de demostración: lo que bajabas no era la pieza del
// juego, era otra cosa parecida. Estando dentro del build, se exporta
// exactamente lo que se ve corriendo.
// ============================================================================

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

import * as Props from '../models/props.js';
import { crearPersonaje, crearPerseguidores } from '../models/characters.js';
import {
  cargarPersonajesGLB, crearPersonajeGLB, reposarGLB,
  idsPersonajesGLB, clipsDePersonajeGLB,
} from '../models/personajeGLB.js';
import { PERSONAJES } from '../config/personajes.js';
import { ESCENARIOS, obtenerEscenario } from '../config/escenarios.js';
import { CATALOGO_POTENCIADORES } from '../config/balance.js';
import { EDIFICIO_DEL_CRUCE, DECORADO_IMPORTADO, clonarPorNombre } from '../models/hitos.js';
import { cargarHitos } from '../models/hitos.js';

const PALETA = obtenerEscenario('bahia').colores;

// ---------------------------------------------------------------------------
// LO QUE HAY QUE HABER DESCARGADO ANTES DE PODER EXPORTAR NADA
// ---------------------------------------------------------------------------
// Dos familias de piezas no se generan con código: los edificios salen del
// .glb de Quito y los personajes de sus seis archivos. El juego los descarga
// en su pantalla de carga; esta página no tiene ninguna, así que si no se
// espera aquí pasa lo de siempre —y ya pasó una vez con los edificios—: la
// pieza aparece en la lista, se exporta, y lo que baja está VACÍO o es el
// muñeco de cajas de reserva en vez del modelo.
//
// Se nota tarde y mal: el archivo se abre en Blender, tiene el nombre
// correcto, y dentro hay otra cosa.
let preparado = null;
export function preparar(base = '/') {
  if (!preparado) {
    preparado = Promise.all([cargarHitos(base), cargarPersonajesGLB(base)]);
  }
  return preparado;
}

/**
 * Un personaje del modelo, en su pose de reposo.
 *
 * SE LE PONE EN REPOSO A PROPÓSITO. Al crearlo, el mezclador escribe el primer
 * fotograma de su ciclo, y exportar eso deja al muñeco a media zancada dentro
 * del archivo: se abre en Blender con una pierna adelantada y no hay forma de
 * saber si es la pose de reposo o un error del rig. En reposo sale en la cruz
 * en la que vino, que es lo que espera cualquiera que abra un personaje.
 */
function personajeDelModelo(id) {
  const m = crearPersonajeGLB(id);
  if (!m) return new THREE.Group();
  reposarGLB(m);
  return m;
}

// Cómo se llama cada uno en la lista. Los ids son de código —`perseguidorAbajo`
// no le dice nada a nadie— y quien abre esta página busca a una persona.
const NOMBRE_REPARTO = {
  tostadologo: 'El tostadólogo',
  avecilla: 'Avecilla',
  generico: 'El entrevistado (genérico)',
  ministro: 'El mando policial',
  policia: 'Antidisturbias (cerco)',
  perseguidorAbajo: 'Perseguidor: el que carga',
  perseguidorArriba: 'Perseguidor: Roy, el de arriba',
  buencan: 'Buencán',
  monki: 'Monki',
};

// El catálogo: qué se puede exportar y cómo se construye cada cosa. El `id` es
// además el nombre del archivo que sale, para que al volver de Blender se sepa
// dónde va sin tener que adivinar.
export const CATALOGO = [
  // Los JUGABLES. `crearPersonaje` devuelve el del modelo si está descargado
  // —por eso `preparar()`— y el de cajas si no, así que la marca `glb` es la
  // que hace que sus clips viajen dentro del archivo.
  { grupo: 'Personajes', piezas: PERSONAJES.map((p) => ({
    id: `personaje-${p.id}`, nombre: p.nombre, glb: p.id,
    hacer: () => crearPersonaje(p.id),
  })) },

  // EL REPARTO ENTERO, no sólo los cuatro jugables. Del modelo salen nueve
  // personajes —el entrevistado de la portada, el mando policial, el
  // antidisturbias del cerco y los dos del dúo perseguidor— y hasta ahora no
  // había forma de bajar ninguno de esos cinco para retocarlo.
  //
  // Van con sus animaciones dentro (ver `exportar()`), así que lo que se abre
  // en Blender es el personaje con su esqueleto y su ciclo, no una estatua.
  { grupo: 'Reparto (del modelo)', piezas: [
    ...idsPersonajesGLB().map((id) => ({
      id: `modelo-${id}`, nombre: NOMBRE_REPARTO[id] ?? id, glb: id,
      hacer: () => personajeDelModelo(id),
    })),
    { id: 'modelo-perseguidores', nombre: 'Dúo perseguidor (montado)',
      hacer: () => crearPerseguidores() },
  ] },

  { grupo: 'Decorado', piezas: Object.keys(ESCENARIOS).map((id) => ({
    id: `decorado-${id}`, nombre: `Cuadra de ${obtenerEscenario(id).nombre}`,
    hacer: () => Props.crearDecorado(id, obtenerEscenario(id).colores),
  })) },

  { grupo: 'Obstáculos', piezas: [
    { id: 'obstaculo-saltar', nombre: 'Barrera (saltar)', hacer: () => Props.crearObstaculoSaltar(PALETA) },
    { id: 'obstaculo-agachar', nombre: 'Pórtico (agachar)', hacer: () => Props.crearObstaculoAgachar(PALETA) },
    { id: 'obstaculo-esquivar', nombre: 'Bloque (esquivar)', hacer: () => Props.crearObstaculoEsquivar(PALETA) },
    { id: 'obstaculo-doble', nombre: 'Retén (doble)', hacer: () => Props.crearObstaculoDoble(PALETA) },
  ] },

  { grupo: 'Recolectables', piezas: [
    { id: 'evidencia', nombre: 'Evidencia (el papel)', hacer: () => Props.crearEvidencia() },
    { id: 'prueba', nombre: 'Prueba (USB, video…)', hacer: () => Props.crearPrueba() },
  ] },

  // Los edificios que vienen del .glb de la ciudad. Se listan aquí para poder
  // bajarlos, mirarlos y devolverlos retocados como cualquier otra pieza: que
  // vengan de archivo en vez de generarse no los hace menos editables.
  { grupo: 'Edificios (del modelo de Quito)', piezas: [
    ...Object.entries(EDIFICIO_DEL_CRUCE).map(([escenario, nombre]) => ({
      id: `edificio-${escenario}`,
      nombre: nombre.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      hacer: () => clonarPorNombre(nombre) ?? new THREE.Group(),
    })),
    // La central no es hito —ver hitos.js—, pero se baja igual para editarla.
    ...Object.values(DECORADO_IMPORTADO).map((nombre) => ({
      id: `decorado-importado-${nombre}`,
      nombre: nombre.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      hacer: () => clonarPorNombre(nombre) ?? new THREE.Group(),
    })),
  ] },

  { grupo: 'Obstáculos vestidos por escenario', piezas:
    Object.keys(ESCENARIOS).flatMap((esc) =>
      ['saltar', 'agachar', 'esquivar', 'doble'].map((tipo) => ({
        id: `obstaculo-${esc}-${tipo}`,
        nombre: `${obtenerEscenario(esc).nombre}: ${tipo}`,
        hacer: () => Props.crearObstaculo(tipo, obtenerEscenario(esc).colores, esc),
      }))) },

  { grupo: 'Potenciadores', piezas: CATALOGO_POTENCIADORES.map((p) => ({
    id: `potenciador-${p.id}`, nombre: p.nombre,
    hacer: () => Props.crearPotenciador(p.id, p.color ?? 0xffcf3f),
  })) },

  { grupo: 'Escena', piezas: [
    { id: 'policia', nombre: 'Perseguidor', hacer: () => Props.crearPolicia() },
    { id: 'dron', nombre: 'Dron de vigilancia', hacer: () => Props.crearDron() },
    { id: 'galeria-tramite', nombre: 'Pasillo del trámite', hacer: () => Props.crearGaleriaTramite(120, PALETA, 'FISCALÍA') },
    { id: 'elevado-bahia', nombre: 'Elevado: contenedores (Bahía)',
      hacer: () => Props.crearTarima(26, PALETA, 'bahia') },
    { id: 'elevado-buses', nombre: 'Elevado: buses en fila',
      hacer: () => Props.crearTarima(26, PALETA, 'carondelet') },
    { id: 'tuneles-bifurcacion', nombre: 'Bocas de la bifurcación',
      hacer: () => Props.crearTunelesBifurcacion(
        { izquierda: 'LA BAHÍA', centro: 'FISCALÍA', derecha: 'EL APAGÓN' }, PALETA) },
    { id: 'fachada-institucion', nombre: 'Fachada de institución',
      hacer: () => Props.crearFachadaInstitucion('FISCALÍA', PALETA, false) },
    { id: 'flecha-asfalto', nombre: 'Flecha de asfalto',
      hacer: () => Props.crearFlechaAsfalto('izquierda', 0x4fd1ff) },
  ] },
];

/**
 * Le quita al objeto lo que no cabe en un archivo.
 *
 * Los personajes del modelo llevan en `userData` su mezclador de animación, su
 * esqueleto fichado y sus medidas. El mezclador apunta a la escena y la escena
 * al mezclador, así que `GLTFExporter` —que serializa `userData` tal cual—
 * tropieza con la referencia circular, escupe un aviso por consola y descarta
 * el userData ENTERO, incluido el nombre por el que el juego busca la pieza
 * al volver de Blender.
 *
 * Se limpia sobre la copia que se va a exportar, no sobre la del juego: cada
 * `hacer()` construye una nueva.
 */
function limpiarParaExportar(objeto) {
  objeto.traverse((o) => {
    if (!o.userData) return;
    delete o.userData.glb;
    delete o.userData.medidas;
    delete o.userData.partes;   // el dúo guarda aquí sus dos mitades
  });
}

export function buscarPieza(id) {
  for (const g of CATALOGO) {
    const p = g.piezas.find((x) => x.id === id);
    if (p) return p;
  }
  return null;
}

/**
 * Empaqueta una pieza en .glb.
 *
 * El nombre va puesto en la raíz porque es por ese nombre por el que el juego
 * la busca al volver: si se pierde al guardar, la pieza regresa y no la
 * encuentra nadie.
 */
export function exportar(id) {
  const pieza = buscarPieza(id);
  if (!pieza) return Promise.reject(new Error(`No existe la pieza «${id}»`));

  const objeto = pieza.hacer();
  objeto.name = id;
  limpiarParaExportar(objeto);

  // LAS ANIMACIONES VIAJAN CON EL PERSONAJE. Sin esto lo que baja es una malla
  // con huesos y ningún movimiento: se abre en Blender, se ve el esqueleto, y
  // el ciclo de carrera que trae el archivo original no está por ninguna
  // parte. `GLTFExporter` sólo escribe los clips que se le pasan a mano.
  const animaciones = pieza.glb ? clipsDePersonajeGLB(pieza.glb) : [];

  return new Promise((resolver, rechazar) => {
    new GLTFExporter().parse(
      objeto,
      (resultado) => resolver(new Blob([resultado], { type: 'model/gltf-binary' })),
      (error) => rechazar(error),
      {
        // Binario: un .gltf suelto se parte en archivo y buffers, y eso ya no
        // es «un archivo que arrastras a Blender».
        binary: true,
        onlyVisible: false,
        animations: animaciones,
        // OJO CON EL PESO. El atlas de los personajes va en webp dentro del
        // .glb del juego —42 KB— pero `GLTFExporter` no sabe escribir webp y
        // lo vuelca como PNG, que multiplica por diez. Se acepta: esto es un
        // archivo para abrir en Blender, no para servir, y el PNG lo lee todo
        // el mundo. Lo que se sirve sigue saliendo de
        // `scripts/adelgazar-personajes.py`.
      },
    );
  });
}

/** Vista previa girando, para no exportar a ciegas. */
export function crearVisor(lienzo) {
  const renderizador = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 400);

  escena.add(new THREE.HemisphereLight(0xbfd8f2, 0x8a7a5e, 2.2));
  const sol = new THREE.DirectionalLight(0xfff0cf, 2.2);
  sol.position.set(6, 12, 8);
  escena.add(sol);

  let actual = null;
  let giro = 0;
  let inclinacion = 0.25;
  let distancia = 1;
  let radioPieza = 1;
  let centroPieza = new THREE.Vector3();
  let girandoSolo = true;

  // --- Órbita con el ratón ---------------------------------------------------
  // Sin esto solo se ve la cara que el giro automático quiera enseñar, y para
  // decidir si una pieza está bien hay que poder mirarla por detrás y por
  // debajo. Se implementa a mano y no con OrbitControls porque hacen falta
  // cuatro líneas y el addon pesa más que todo este archivo.
  let arrastrando = false;
  let ultimoX = 0;
  let ultimoY = 0;

  lienzo.style.touchAction = 'none';
  lienzo.style.cursor = 'grab';

  lienzo.addEventListener('pointerdown', (ev) => {
    arrastrando = true;
    girandoSolo = false;   // en cuanto tocas, mandas tú
    ultimoX = ev.clientX;
    ultimoY = ev.clientY;
    lienzo.setPointerCapture(ev.pointerId);
    lienzo.style.cursor = 'grabbing';
  });

  lienzo.addEventListener('pointermove', (ev) => {
    if (!arrastrando) return;
    giro -= (ev.clientX - ultimoX) * 0.01;
    // La inclinación se topa antes de los polos: pasado el cenit la escena se
    // da la vuelta y se pierde de vista qué es arriba.
    inclinacion = Math.max(-1.35, Math.min(1.35, inclinacion + (ev.clientY - ultimoY) * 0.008));
    ultimoX = ev.clientX;
    ultimoY = ev.clientY;
  });

  const soltar = (ev) => {
    arrastrando = false;
    lienzo.style.cursor = 'grab';
    if (ev?.pointerId !== undefined && lienzo.hasPointerCapture?.(ev.pointerId)) {
      lienzo.releasePointerCapture(ev.pointerId);
    }
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);

  // Rueda para acercar. Los topes son relativos al tamaño de la pieza: un USB y
  // un pasillo de ciento veinte metros no admiten los mismos límites fijos.
  lienzo.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    distancia = Math.max(0.35, Math.min(4, distancia * (1 + Math.sign(ev.deltaY) * 0.12)));
  }, { passive: false });

  function ajustar() {
    const ancho = lienzo.clientWidth || 480;
    const alto = lienzo.clientHeight || ancho;
    renderizador.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderizador.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  }

  function poner(id) {
    if (actual) escena.remove(actual);
    const pieza = buscarPieza(id);
    if (!pieza) { actual = null; return null; }
    actual = pieza.hacer();
    escena.add(actual);

    // Encuadre automático: cada pieza tiene su tamaño —un USB y un pasillo de
    // ciento veinte metros— y una cámara fija dejaría media lista fuera de
    // cuadro o convertida en un punto.
    const caja = new THREE.Box3().setFromObject(actual);
    const tam = caja.getSize(new THREE.Vector3());
    const centro = caja.getCenter(new THREE.Vector3());
    radioPieza = Math.max(tam.x, tam.y, tam.z) * 0.5 || 1;
    // La pieza se recentra en el eje para que orbitar la mantenga en el medio:
    // girando alrededor del origen, una pieza descentrada se sale de cuadro.
    actual.position.sub(new THREE.Vector3(centro.x, 0, centro.z));
    centroPieza = new THREE.Vector3(0, centro.y, 0);
    distancia = 1;
    inclinacion = 0.25;
    girandoSolo = true;
    return {
      ancho: +tam.x.toFixed(2), alto: +tam.y.toFixed(2), fondo: +tam.z.toFixed(2),
    };
  }

  function pintar(dt = 0.016) {
    // El giro automático se para en cuanto el usuario arrastra: seguir girando
    // bajo el ratón hace imposible mirar un detalle concreto.
    if (girandoSolo) giro += dt * 0.45;

    const r = radioPieza * 3.1 * distancia;
    camara.position.set(
      centroPieza.x + Math.sin(giro) * Math.cos(inclinacion) * r,
      centroPieza.y + Math.sin(inclinacion) * r + radioPieza * 0.25,
      centroPieza.z + Math.cos(giro) * Math.cos(inclinacion) * r,
    );
    camara.lookAt(centroPieza);
    renderizador.render(escena, camara);
  }

  /** Vuelve al encuadre de partida y reanuda el giro solo. */
  function reencuadrar() {
    giro = 0; inclinacion = 0.25; distancia = 1; girandoSolo = true;
  }

  ajustar();
  return { poner, pintar, ajustar, reencuadrar };
}
