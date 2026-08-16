// ============================================================================
// CURVATURA DEL MUNDO — la calle se pierde tras una loma, como en Subway Surfers
// ============================================================================
// El mundo se dobla hacia abajo con la distancia: lo lejano queda bajo una
// cresta y los obstáculos APARECEN subiendo por ella, en vez de materializarse
// en la niebla. Es el truco de cámara más viejo del género y hace dos cosas a
// la vez: da al horizonte una forma —una loma, no una pared gris— y convierte
// el nacimiento de cada obstáculo en un evento visible en lugar de un pop-in.
//
// CÓMO. No se mueve ni un vértice de verdad: la física, las colisiones y las
// posiciones del juego siguen en un mundo recto. El doblez se aplica en el
// shader de vértices, ya en espacio de cámara, restando a la altura una
// parábola sobre la profundidad:  y -= k · z².  En z=0 (el jugador) no pasa
// nada; a cien metros la calle ha bajado k·10000. Como solo se toca la
// proyección a pantalla —no mvPosition—, la niebla y la iluminación siguen
// midiendo las distancias reales.
//
// CÓMO SE APLICA. Cada material de la escena recibe un parche vía
// onBeforeCompile. No hay lista de materiales que mantener: curvarEscena() se
// pasa por el grafo ANTES de cada render y parchea lo que no esté parcheado
// aún. Es un recorrido barato (una marca por material) y es lo que garantiza
// que una pieza nueva —el cruce recién montado, un material del GLB— nunca
// llegue a pintarse recta: se parchea en el mismo fotograma en que aparece,
// antes de compilar su shader.
//
// A QUIÉN NO SE PARCHEA. Los ShaderMaterial propios (las partículas) no
// tienen <project_vertex> que sustituir, y viven pegados al jugador, donde la
// curvatura es cero de todos modos.
//
// OJO CON LAS GEOMETRÍAS LARGAS: el doblez es por vértice. Una baldosa de
// calle de 40 metros con vértices solo en las esquinas no se curva: se tiende
// como una cuerda entre sus extremos y desentona con lo que tiene encima. Todo
// lo que mida más de ~8 metros a lo largo necesita segmentos intermedios (ver
// Track, crearTarima, crearPasoLateral).

import { CAMARA } from '../config/balance.js';

// Compartido por TODOS los materiales parcheados: subir o bajar la curvatura
// es una escritura, no doscientas.
export const CURVATURA = { value: CAMARA.CURVATURA };

const MARCA = '__curvado';

function parchear(material) {
  if (material.userData[MARCA] || material.isShaderMaterial) return;
  material.userData[MARCA] = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurvatura = CURVATURA;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uCurvatura;')
      .replace('#include <project_vertex>', `#include <project_vertex>
{
  // Solo la proyección: mvPosition queda intacta para la niebla.
  vec4 mvCurva = mvPosition;
  mvCurva.y -= uCurvatura * mvCurva.z * mvCurva.z;
  gl_Position = projectionMatrix * mvCurva;
}`);
  };

  // Todos los parches son idénticos, así que una clave constante deja que
  // Three siga compartiendo programas entre materiales del mismo tipo. La
  // clave por defecto serializa onBeforeCompile entero en cada fotograma.
  material.customProgramCacheKey = () => 'curvatura';
  material.needsUpdate = true;
}

/** Parchea todo material de la escena que aún no lo esté. Llamar cada
 *  fotograma, antes del render. */
export function curvarEscena(escena) {
  escena.traverse((objeto) => {
    const m = objeto.material;
    if (!m) return;
    if (Array.isArray(m)) m.forEach(parchear);
    else parchear(m);
  });
}
