// ============================================================================
// TABLA DE POSICIONES
// ============================================================================
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
// ============================================================================

/** Marcadores de muestra, ya ordenados de mayor a menor. */
export const RANKING = [
  { arroba: '@paquimal', puntaje: 18_420, nota: 'director' },
  { arroba: '@la_chulla_vida', puntaje: 15_880 },
  { arroba: '@ojo_de_agua', puntaje: 14_205 },
  { arroba: '@ni_una_menos_ec', puntaje: 12_960 },
  { arroba: '@cronica_del_sur', puntaje: 11_340 },
  { arroba: '@el_desvelado', puntaje: 9_775 },
  { arroba: '@radio_bemba', puntaje: 8_190 },
  { arroba: '@apagon_lover', puntaje: 6_640 },
  { arroba: '@guayaco_insomne', puntaje: 5_020 },
  { arroba: '@notas_al_pie', puntaje: 3_615 },
];

/** Cómo se llama el jugador en la tabla mientras no haya cuentas. */
export const YO = '@tú';

/**
 * Mete al jugador en la tabla por su puntaje y devuelve la ventana que se
 * enseña: siempre el primero —que es a quien hay que alcanzar— y el entorno
 * inmediato del jugador, que es lo único que le dice si sube o baja.
 *
 * Enseñar los diez de golpe en un móvil obliga a hacer scroll dentro de una
 * pantalla que ya es larga, y a nadie le importa el séptimo.
 *
 * @param {number} puntaje
 * @param {number} [alrededor] Cuántos enseñar por encima y por debajo
 * @returns {Array<{puesto:number, arroba:string, puntaje:number,
 *                  esTu:boolean, nota?:string, corte?:boolean}>}
 */
export function tablaConJugador(puntaje, alrededor = 1) {
  const todos = [...RANKING, { arroba: YO, puntaje, esTu: true }]
    .sort((a, b) => b.puntaje - a.puntaje)
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
