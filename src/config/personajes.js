// ============================================================================
// PERSONAJES JUGABLES — LA REDACCIÓN DE EL MERCIO
// ============================================================================
// Los cuatro trabajan en el mismo sitio: EL MERCIO. No son cuatro corredores
// con distinto sombrero, son cuatro plazas de una redacción, cada una con su
// sección y su forma de meterse en problemas. Por eso la pantalla de selección
// no es una tienda de skins: es el organigrama del periódico.
//
// DE DÓNDE SALEN
// Están basados en periodistas incómodos para el gobierno. En el arquetipo, no
// en la persona: el que pregunta lo que nadie pregunta, la que llega joven y
// todavía cree que sirve, el que ya sabe la respuesta antes de preguntarla, la
// que no se aparta cuando la empujan. Eso es lo que se juega.
//
// Y AQUÍ LA REGLA QUE NO SE TOCA
// Ninguno es un periodista real con otro nombre. No llevan sus rasgos, ni sus
// medios, ni sus casos, ni frases suyas. Es la misma regla que gobierna todo
// este juego —se satiriza la oficina y el trámite, nunca una cara— y aplica
// igual a los nuestros: poner a una persona real a correr por una calle
// mientras la persiguen es meterla en un chiste que no eligió contar. El
// homenaje es al oficio; el retrato no es de nadie.
//
// POR QUÉ SE DESBLOQUEAN POR TRAMOS Y NO POR PAPELES
// Los papeles son la moneda del Archivo, y el Archivo es la meta del juego:
// meterle un segundo sumidero le quita fuerza al primero, y encima obligaría a
// elegir entre un reportaje y un sombrero. Los tramos recorridos, en cambio,
// no se gastan en nada —solo se acumulan— así que ahí sí cabe otra recompensa
// sin quitarle nada a ninguna.
//
// LOS UMBRALES SE INTERCALAN CON LOS DE LOS POTENCIADORES (3, 6, 10, 15, 22).
// A los 8 y a los 18 no se abre ningún potenciador, así que cada hito reparte
// una cosa distinta y no hay ninguna corrida que dé dos premios a la vez y
// luego cuatro que no den nada.
// ============================================================================

export const PERSONAJES = [
  {
    id: 'chochologo',
    nombre: 'Chochólogo',
    seccion: 'Política',
    nota: 'Sombrero, gafas y treinta años de oficio',
    ficha: 'Lleva en la redacción más tiempo que casi todos los ministros que ha cubierto. Ese es el problema: se acuerda.',
    tramos: 0,
  },
  {
    id: 'alondra',
    nombre: 'Alondra',
    seccion: 'Sociedad',
    nota: 'Rizos, ukulele y todavía cree que esto sirve',
    ficha: 'Entró de pasante y se quedó. Pregunta cosas que en la sala ya nadie pregunta porque dan pereza, y por eso se las contestan.',
    tramos: 0,
  },
  {
    id: 'buscan',
    nombre: 'Buscán',
    seccion: 'Investigación',
    nota: 'Boina y traje. Pregunta como si ya supiera',
    ficha: 'Trabaja con documentos. Cuando llega a una rueda de prensa la gente mira de reojo el sobre que trae bajo el brazo.',
    tramos: 8,
  },
  {
    id: 'blanki',
    nombre: 'Blanki',
    seccion: 'Calle',
    nota: 'Casco de espartana. No se aparta',
    ficha: 'Cubre desde el sitio, con casco, porque en su sección el casco no es un chiste. La han empujado y no se movió.',
    tramos: 18,
  },
];

/** La ficha de un personaje, o la del primero si el id no existe. */
export function obtenerPersonaje(id) {
  return PERSONAJES.find((p) => p.id === id) ?? PERSONAJES[0];
}
