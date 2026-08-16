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
import { crearPersonaje } from '../models/characters.js';
import { PERSONAJES } from '../config/personajes.js';
import { ESCENARIOS, obtenerEscenario } from '../config/escenarios.js';

const PALETA = obtenerEscenario('bahia').colores;

// El catálogo: qué se puede exportar y cómo se construye cada cosa. El `id` es
// además el nombre del archivo que sale, para que al volver de Blender se sepa
// dónde va sin tener que adivinar.
export const CATALOGO = [
  { grupo: 'Personajes', piezas: PERSONAJES.map((p) => ({
    id: `personaje-${p.id}`, nombre: p.nombre, hacer: () => crearPersonaje(p.id),
  })) },

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

  { grupo: 'Escena', piezas: [
    { id: 'policia', nombre: 'Perseguidor', hacer: () => Props.crearPolicia() },
    { id: 'dron', nombre: 'Dron de vigilancia', hacer: () => Props.crearDron() },
    { id: 'galeria-tramite', nombre: 'Pasillo del trámite', hacer: () => Props.crearGaleriaTramite(120, PALETA, 'FISCALÍA') },
    { id: 'tarima', nombre: 'Tarima elevada', hacer: () => Props.crearTarima(40, PALETA) },
  ] },
];

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

  return new Promise((resolver, rechazar) => {
    new GLTFExporter().parse(
      objeto,
      (resultado) => resolver(new Blob([resultado], { type: 'model/gltf-binary' })),
      (error) => rechazar(error),
      // Binario: un .gltf suelto se parte en archivo y buffers, y eso ya no es
      // «un archivo que arrastras a Blender».
      { binary: true, onlyVisible: false },
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

  function ajustar() {
    const lado = lienzo.clientWidth || 320;
    renderizador.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderizador.setSize(lado, lado, false);
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
    const radio = Math.max(tam.x, tam.y, tam.z) * 0.5 || 1;
    camara.position.set(radio * 2.2, radio * 1.4 + centro.y, radio * 2.2);
    camara.lookAt(centro);
    actual.position.sub(new THREE.Vector3(centro.x, 0, centro.z));
    return {
      ancho: +tam.x.toFixed(2), alto: +tam.y.toFixed(2), fondo: +tam.z.toFixed(2),
    };
  }

  function pintar(dt = 0.016) {
    giro += dt * 0.45;
    if (actual) actual.rotation.y = giro;
    renderizador.render(escena, camara);
  }

  ajustar();
  return { poner, pintar, ajustar };
}
