// ============================================================================
// TABLA DE POSICIONES — la página de deportes
// ============================================================================
// TRES CLASIFICACIONES, no una. Un solo marcador premia una sola forma de
// jugar, y aquí hay tres que valen la pena y no son la misma:
//
//   · LOS MÁS BUSCADOS     la constancia. Suma de papeles de todas las partidas.
//   · TOTAL DE DISTANCIA   el kilometraje. También acumulado.
//   · MEJOR CORRIDA        la marca personal: papeles en una sola partida.
//
// LA PRIMERA NO ES UNA TABLA DE PUNTOS, ES UNA CIRCULAR DE BÚSQUEDA. Cambia
// solo el rótulo y cambia entero lo que significa subir: no eres el que más
// junta, eres el que más le estorba a alguien. Es la misma cifra —papeles
// acumulados— leída desde el otro lado del escritorio, y esa lectura es
// justamente la del juego: aquí documentar no te da prestigio, te da una
// carpeta con tu nombre. El puesto uno no es el campeón, es la prioridad.
//
// El acumulado premia insistir; la marca personal premia una corrida buena.
// Quien juega mucho y regular manda en las dos primeras; quien tiene una tarde
// inspirada manda en la tercera. Con una sola tabla, la mitad de los jugadores
// no tenía dónde salir.
//
// De momento son DATOS DE MUESTRA. No hay servidor detrás y no se pretende que
// lo parezca: el propio periódico lo dice al pie.
//
// Cuando haya backend, lo único que cambia es de dónde salen las listas; la
// función que inserta al jugador y maqueta la ventana se queda igual.
//
// NOMBRES: los arrobas son inventados salvo el primero, que es de la casa. No
// se usan cuentas reales de terceros —ni siquiera para un marcador de
// muestra— porque aparecer en la tabla de un juego satírico sin haber jugado
// no es una broma que le corresponda hacer a nadie más que a uno mismo.
//
// LAS CIFRAS salen de lo que da el generador: un grupo de obstáculos cada
// ~28 m, con una hilera de 4-8 papeles de valor 1-5, o sea del orden de 350
// papeles por cada mil metros recogiendo bien. Una corrida buena de verdad
// ronda los dos mil papeles y los seis mil metros. Si la cabeza de la tabla
// fuera inalcanzable, la tabla no sería un objetivo sino un adorno.
// ============================================================================

/** Cómo se llama el jugador en la tabla mientras no haya cuentas. */
export const YO = '@tú';

const ARROBAS = ['@paquimal', '@la_chulla_vida', '@ojo_de_agua', '@ni_una_menos_ec',
  '@cronica_del_sur', '@el_desvelado', '@radio_bemba', '@apagon_lover',
  '@guayaco_insomne', '@notas_al_pie'];

/**
 * Las tres clasificaciones, cada una con su unidad y su formato.
 *
 * `id` es lo que la pantalla pide; `valor(cuaderno)` saca del cuaderno la
 * cifra del jugador para esa tabla, y así la pantalla no tiene que saber qué
 * campo mira cada pestaña.
 *
 * `antetitulo` es el renglón de arriba de la página, y `notaLider` la coletilla
 * del puesto uno: los dos cambian con la pestaña porque las tres tablas dicen
 * la misma cifra desde sitios distintos. En «Más buscados» el primero no es el
 * director del periódico, es el que encabeza la lista.
 */
export const CLASIFICACIONES = [
  {
    id: 'papeles',
    pestana: 'Más buscados',
    titulo: 'LOS MÁS BUSCADOS',
    antetitulo: 'CIRCULAR DE BÚSQUEDA · ARCHIVO ACUMULADO',
    epigrafe: 'Ordenados por lo que llevan documentado. Cuanto más arriba, más estorbas',
    notaLider: 'prioridad uno',
    unidad: '',
    valor: (c) => c.papelesHistoricos,
    marcas: [46_820, 39_140, 34_505, 29_960, 24_340, 19_775, 15_190, 11_640, 8_020, 5_615],
  },
  {
    id: 'distancia',
    pestana: 'Distancia',
    titulo: 'TOTAL DE DISTANCIA',
    antetitulo: 'QUIÉN CORRE MÁS',
    epigrafe: 'Metros corridos desde la primera entrevista',
    unidad: ' m',
    valor: (c) => c.distanciaHistorica,
    marcas: [318_400, 264_900, 221_050, 186_300, 152_700, 118_450, 92_800, 68_300, 44_900, 26_150],
  },
  {
    id: 'mejor',
    pestana: 'Mejor corrida',
    titulo: 'MEJOR CORRIDA',
    antetitulo: 'QUIÉN DOCUMENTA MÁS DE UNA SENTADA',
    epigrafe: 'Papeles recogidos en una sola partida',
    unidad: '',
    valor: (c) => c.mejorPapeles,
    marcas: [3_180, 2_740, 2_455, 2_090, 1_815, 1_530, 1_265, 1_010, 780, 545],
  },
];

/** La clasificación con ese id, o la primera si no existe. */
export function clasificacion(id) {
  return CLASIFICACIONES.find((c) => c.id === id) ?? CLASIFICACIONES[0];
}

/**
 * Mete al jugador en una clasificación y devuelve la ventana que se enseña:
 * siempre el primero —que es a quien hay que alcanzar— y el entorno inmediato
 * del jugador, que es lo único que le dice si sube o baja.
 *
 * Enseñar los diez de golpe en un móvil obliga a hacer scroll dentro de una
 * pantalla que ya es larga, y a nadie le importa el séptimo.
 *
 * @param {object} clase   Una de CLASIFICACIONES
 * @param {number} valor   La cifra del jugador
 * @param {number} [alrededor] Cuántos enseñar por encima y por debajo
 * @returns {Array<{puesto:number, arroba:string, valor:number,
 *                  esTu:boolean, nota?:string, corte?:boolean}>}
 */
export function tablaConJugador(clase, valor, alrededor = 1) {
  const todos = [
    ...clase.marcas.map((v, i) => ({
      arroba: ARROBAS[i],
      valor: v,
      nota: i === 0 ? (clase.notaLider ?? 'director') : undefined,
    })),
    { arroba: YO, valor, esTu: true },
  ]
    .sort((a, b) => b.valor - a.valor)
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
