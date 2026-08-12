// ============================================================================
// PERSONAJES JUGABLES
// ============================================================================
// La plantilla de la redacción. Dos salen de fábrica y dos se ganan.
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
    nota: 'Sombrero, gafas y treinta años de oficio',
    tramos: 0,
  },
  {
    id: 'alondra',
    nombre: 'Alondra',
    nota: 'Rizos, ukulele y todavía cree que esto sirve',
    tramos: 0,
  },
  {
    id: 'buscan',
    nombre: 'Buscán',
    nota: 'Boina y traje. Pregunta como si ya supiera',
    tramos: 8,
  },
  {
    id: 'blanki',
    nombre: 'Blanki',
    nota: 'Casco de espartana. No se aparta',
    tramos: 18,
  },
];

/** La ficha de un personaje, o la del primero si el id no existe. */
export function obtenerPersonaje(id) {
  return PERSONAJES.find((p) => p.id === id) ?? PERSONAJES[0];
}
