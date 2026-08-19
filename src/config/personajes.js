// ============================================================================
// PERSONAJES JUGABLES — LA REDACCIÓN DE EL MERCIO
// ============================================================================
// Los cuatro trabajan en el mismo sitio: EL MERCIO. No son cuatro corredores
// con distinto sombrero, son cuatro plazas de una redacción, cada una con su
// sección y su forma de meterse en problemas. Por eso la pantalla de selección
// no es una tienda de skins: es el organigrama del periódico.
//
// DE DÓNDE SALEN
// Están basados en periodistas incómodos para el gobierno, y dos de ellos
// llevan el guiño en el nombre: BUSCÁN por Andersson Boscán y BLANKI por
// Blanca Moncada.
//
// EL DESVÍO ES EL CHISTE. No es que no se note de quién viene: es que no sea
// exactamente. Se reconoce y a la vez no es él, que es la única forma de hacer
// un guiño sin firmar por nadie. Y en el caso de Buscán el desvío encima paga
// doble: Boscán → Buscán, que además de sonar igual es lo que hace el
// personaje —y lo que hacen con él, que para eso la tabla de acumulado se
// llama LOS MÁS BUSCADOS—.
//
// LO QUE SÍ TOMAN PRESTADO es el oficio y la terquedad: el que trabaja con
// documentos y llega con el sobre bajo el brazo, la que cubre desde el sitio y
// no se aparta cuando la empujan.
//
// Y AQUÍ LA REGLA QUE NO SE TOCA
// No llevan sus casos, ni sus medios, ni una sola frase suya. No se les pone en
// la boca nada, ni se les atribuye nada que no hayan hecho. Un guiño es un
// nombre parecido y una manera de trabajar; todo lo que vaya más allá ya es
// hablar por ellos, y para eso no hay permiso.
//
// Salen bien parados, y eso también cuenta: aquí los periodistas son los
// protagonistas y los que preguntan, y quien queda retratado es la oficina que
// se los quita de encima. Es la misma regla de siempre —se satiriza el trámite,
// nunca una cara—, y ninguna de estas dos caras es la satirizada.
//
// POR QUÉ SE DESBLOQUEAN POR TRAMOS Y NO POR PAPELES
// Porque los papeles no se gastan: son puntuación, alimentan las tres
// clasificaciones y nada más. (Este comentario decía que eran «la moneda del
// Archivo»; dejaron de serlo cuando las páginas pasaron a completarse con las
// pruebas del caso en vez de comprarse.) Los tramos recorridos tampoco se
// gastan —solo se acumulan— así que ahí cabe una recompensa que no le quita
// nada a ninguna otra, y encima ninguna corrida se pierde del todo.
//
// LOS UMBRALES SE INTERCALAN CON LOS DE LOS POTENCIADORES (3, 6, 10, 15, 22).
// A los 8 y a los 18 no se abre ningún potenciador, así que cada hito reparte
// una cosa distinta y no hay ninguna corrida que dé dos premios a la vez y
// luego cuatro que no den nada.
// ============================================================================

export const PERSONAJES = [
  {
    id: 'tostadologo',
    nombre: 'Tostadólogo',
    seccion: 'Política',
    nota: 'Sombrero, gafas y treinta años de oficio',
    ficha: 'Lleva en la redacción más tiempo que casi todos los ministros que ha cubierto. Ese es el problema: se acuerda.',
    tramos: 0,
  },
  {
    id: 'avecilla',
    nombre: 'Avecilla',
    seccion: 'Sociedad',
    nota: 'Rizos, ukulele y todavía cree que esto sirve',
    ficha: 'Entró de pasante y se quedó. Pregunta cosas que en la sala ya nadie pregunta porque dan pereza, y por eso se las contestan.',
    tramos: 0,
  },
  // Buencan y Monki llevan nombres inventados para proteger privacidad (ver docs/CHARACTER-NAMES.md).
  // La mecánica de juego y el guiño narrativo se preservan en la forma de trabajar de los personajes.
  {
    id: 'buencan',
    nombre: 'Buencan',
    seccion: 'Investigación',
    nota: 'Boina y traje. Pregunta como si ya supiera',
    ficha: 'Trabaja con documentos. Cuando llega a una rueda de prensa la gente mira de reojo el sobre que trae bajo el brazo.',
    tramos: 8,
  },
  {
    id: 'monki',
    nombre: 'Monki',
    seccion: 'Calle',
    nota: 'Casco de espartana. No se aparta',
    ficha: 'Cubre desde el sitio, con casco, porque en su sección el casco no es un chiste. La mandan a apartarse y no se aparta.',
    tramos: 18,
  },
];

/** La ficha de un personaje, o la del primero si el id no existe. */
export function obtenerPersonaje(id) {
  return PERSONAJES.find((p) => p.id === id) ?? PERSONAJES[0];
}
