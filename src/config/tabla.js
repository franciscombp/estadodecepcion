// ============================================================================
// TABLA DE POSICIONES
// ============================================================================
// Se compite por PAPELES RECOGIDOS, no por puntaje. El puntaje mezcla papeles
// con metros corridos, y esa mezcla premia por igual al que documenta y al que
// solo huye rápido. Lo que mide este juego es cuánta documentación sacaste
// antes de que te pararan; correr es el precio, no el logro.
//
// De momento son DATOS DE MUESTRA. No hay servidor detrás y no se pretende que
// lo parezca: el propio periódico lo dice en el pie de la tabla.
//
// Cuando haya backend, lo único que cambia es de dónde sale `RANKING`; la
// función que inserta al jugador y maqueta la tabla se queda igual. Por eso
// vive aquí y no dentro de la pantalla.
//
// NOMBRES: los arrobas son inventados salvo el primero, que es de la casa. No
// se usan cuentas reales de terceros —ni siquiera para un marcador de
// muestra— porque aparecer en la tabla de un juego satírico sin haber jugado
// no es una broma que le corresponda hacer a nadie más que a uno mismo.
//
// LAS CIFRAS salen de lo que da el generador: un grupo de obstáculos cada
// ~28 m, con una hilera de 4-8 papeles de valor 1-5, o sea del orden de 350
// papeles por cada mil metros recogiendo bien. Una corrida buena de verdad
// ronda los dos mil. Si la cabeza de la tabla fuera inalcanzable, la tabla no
// sería un objetivo sino un adorno.
// ============================================================================

/** Marcadores de muestra, ya ordenados de mayor a menor. */
export const RANKING = [
  { arroba: '@paquimal', papeles: 3_180, nota: 'director' },
  { arroba: '@la_chulla_vida', papeles: 2_740 },
  { arroba: '@ojo_de_agua', papeles: 2_455 },
  { arroba: '@ni_una_menos_ec', papeles: 2_090 },
  { arroba: '@cronica_del_sur', papeles: 1_815 },
  { arroba: '@el_desvelado', papeles: 1_530 },
  { arroba: '@radio_bemba', papeles: 1_265 },
  { arroba: '@apagon_lover', papeles: 1_010 },
  { arroba: '@guayaco_insomne', papeles: 780 },
  { arroba: '@notas_al_pie', papeles: 545 },
];

/** Cómo se llama el jugador en la tabla mientras no haya cuentas. */
export const YO = '@tú';

/**
 * Mete al jugador en la tabla por sus papeles y devuelve la ventana que se
 * enseña: siempre el primero —que es a quien hay que alcanzar— y el entorno
 * inmediato del jugador, que es lo único que le dice si sube o baja.
 *
 * Enseñar los diez de golpe en un móvil obliga a hacer scroll dentro de una
 * pantalla que ya es larga, y a nadie le importa el séptimo.
 *
 * @param {number} papeles
 * @param {number} [alrededor] Cuántos enseñar por encima y por debajo
 * @returns {Array<{puesto:number, arroba:string, papeles:number,
 *                  esTu:boolean, nota?:string, corte?:boolean}>}
 */
export function tablaConJugador(papeles, alrededor = 1) {
  const todos = [...RANKING, { arroba: YO, papeles, esTu: true }]
    .sort((a, b) => b.papeles - a.papeles)
    .map((fila, i) => ({ ...fila, puesto: i + 1, esTu: !!fila.esTu }));

  const mio = todos.findIndex((f) => f.esTu);
  const desde = Math.max(0, mio - alrededor);
  const hasta = Math.min(todos.length, mio + alrededor + 1);

  const ventana = todos.slice(desde, hasta);

  // El primero va siempre, aunque quede lejos del jugador. Si hay hueco entre
  // él y la ventana, se marca con puntos suspensivos como en cualquier tabla
  // impresa.
  if (desde > 0) {
    const salto = desde > 1 ? [{ corte: true }] : [];
    return [todos[0], ...salto, ...ventana];
  }

  return ventana;
}
