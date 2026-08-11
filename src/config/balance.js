// ============================================================================
// BALANCE — Los "pesos de juego"
// ============================================================================
// Este archivo es la ÚNICA fuente de verdad para el tuning del juego.
// La mecánica es la de Subway Surfers: no la inventamos, la replicamos.
// Si algo se siente mal (salto corto, obstáculos injustos, muy lento),
// se ajusta AQUÍ, nunca dentro de la lógica.
//
// Unidades: 1 unidad de mundo ≈ 1 metro. Tiempos en segundos.
// ============================================================================

// ---------------------------------------------------------------------------
// CARRILES
// ---------------------------------------------------------------------------
// Subway Surfers usa 3 carriles equidistantes. El ancho está calibrado para que
// el personaje quepa holgado y el cambio de carril se lea claro en pantalla.
export const CARRILES = {
  ANCHO: 2.4,
  // Posiciones en X de cada carril. Se derivan del ancho para que NUNCA
  // se desincronicen los obstáculos del jugador (bug clásico).
  get POSICIONES() {
    return [-this.ANCHO, 0, this.ANCHO];
  },
  IZQUIERDA: 0,
  CENTRO: 1,
  DERECHA: 2,
  // Velocidad del deslizamiento lateral. Es un lerp exponencial:
  // cuanto más alto, más "snappy". 14 da ~0.15s de transición, como el original.
  VELOCIDAD_CAMBIO: 14,
};

// ---------------------------------------------------------------------------
// VELOCIDAD DE CARRERA
// ---------------------------------------------------------------------------
// El corredor acelera progresivamente hasta un tope. Esta rampa es lo que
// convierte la partida en una curva de dificultad sin necesidad de "niveles".
// El modelo tiene DOS velocidades y la distinción importa:
//
//   · BASE: la curva de dificultad. Solo sube, nunca baja. Es el reloj de la
//     partida: cuanto más aguantas, más rápido va.
//   · ACTUAL: lo que corre el personaje. Tropieza al chocar y vuelve a subir
//     hacia la base.
//
// Si se usara una sola velocidad, cada golpe retrasaría la curva de dificultad
// y una partida con tres tropiezos se quedaría lenta para siempre —que es
// exactamente lo que pasaba antes de separarlas.
export const VELOCIDAD = {
  INICIAL: 18,      // Arranque cómodo, permite leer el primer obstáculo.
  MAXIMA: 42,       // Tope: más allá, el tiempo de reacción humano no alcanza.
  ACELERACION: 0.35, // Unidades/segundo² — sube de 18 a 42 en ~68 segundos.
  // Penalización al chocar: no es game over inmediato, pierdes ritmo.
  FRENAZO_POR_GOLPE: 0.45, // Multiplicador aplicado sobre la velocidad base.
  // Recuperación tras el frenazo, en unidades/segundo².
  // A 8, recuperar un frenazo lleva ~1.4 s: se nota el tropiezo, pero no
  // arruina la partida.
  RECUPERACION: 8,
};

// ---------------------------------------------------------------------------
// SALTO
// ---------------------------------------------------------------------------
// Física balística clásica: altura_pico = v0²/(2g), tiempo_aire = 2·v0/g.
// Con v0=11 y g=27.5 → pico de 2.2 m y 0.80 s en el aire.
// A velocidad inicial (18 u/s) el salto cubre 14.4 m de suelo: sobra margen
// para librar un obstáculo de 2.5 m de profundidad.
export const SALTO = {
  VELOCIDAD_INICIAL: 11,
  GRAVEDAD: 27.5,
  // Ventana de "input anticipado": si presionas saltar hasta 0.15 s antes de
  // tocar suelo, el salto se ejecuta igual. Sin esto el juego se siente injusto.
  BUFFER_ENTRADA: 0.15,
  // Multiplicador de gravedad mientras cae con la caída rápida activa.
  // Se aplica de forma CONTINUA, no como un empujón por pulsación: así el
  // descenso se acelera de verdad en vez de dar tirones.
  MULTIPLICADOR_CAIDA_RAPIDA: 2.6,
};

// ---------------------------------------------------------------------------
// AGACHARSE
// ---------------------------------------------------------------------------
export const AGACHARSE = {
  DURACION: 0.55,     // Cuánto permanece agachado antes de volver a erguirse.
  ALTURA_NORMAL: 1.8, // Altura de la caja de colisión de pie.
  ALTURA_AGACHADO: 0.9,

  // Mismo margen de entrada anticipada que el salto. Sin esto, pulsar abajo
  // mientras estás en el aire perdía la intención: aterrizabas de pie y
  // chocabas contra el pórtico que querías esquivar.
  BUFFER_ENTRADA: 0.18,

  // Velocidad del lerp de la pose visual. Va MUY por encima del resto de
  // interpolaciones a propósito: la caja de colisión se encoge al instante,
  // así que la imagen tiene que alcanzarla en un par de fotogramas. Con un
  // valor bajo el personaje se ve de pie mientras ya está agachado, y eso se
  // lee como que atraviesa el obstáculo.
  VELOCIDAD_POSE: 34,
};

// ---------------------------------------------------------------------------
// JUGADOR — caja de colisión
// ---------------------------------------------------------------------------
// La hitbox es deliberadamente MÁS ANGOSTA que el modelo visual (0.7 vs ~0.9).
// Subway Surfers hace lo mismo: perdonar de más se siente bien, lo contrario
// se siente roto.
export const JUGADOR = {
  ANCHO_COLISION: 0.7,
  PROFUNDIDAD_COLISION: 0.7,
  // Vidas: cuántos golpes aguantas antes de que te atrapen.
  GOLPES_MAXIMOS: 3,
  // Invulnerabilidad tras recibir un golpe, para no encadenar choques.
  INVULNERABILIDAD: 1.2,
};

// ---------------------------------------------------------------------------
// OBSTÁCULOS
// ---------------------------------------------------------------------------
export const OBSTACULOS = {
  // Tipos y cómo se superan:
  //   SALTAR   → barrera baja, se salta por encima
  //   AGACHAR  → estructura elevada, se pasa por debajo
  //   ESQUIVAR → bloque sólido de piso a techo, solo cambio de carril
  //   DOBLE    → ocupa dos carriles (el "bus"), obliga a leer con antelación
  ALTURA_SALTAR: 1.15,
  ALTURA_AGACHAR_DESDE: 1.25, // Borde inferior del obstáculo elevado.
  ALTURA_ESQUIVAR: 2.6,
  PROFUNDIDAD: 2.2,

  // Distancia a la que se generan por delante de la cámara.
  DISTANCIA_APARICION: 220,
  // Distancia por detrás a la que se reciclan.
  DISTANCIA_RECICLADO: 25,
  // Dónde va el PRIMER grupo al arrancar una partida o un tramo nuevo.
  // A velocidad inicial (18 u/s) son ~2.5 s para leer el primer obstáculo:
  // suficiente para colocarse, sin que se sienta que no pasa nada.
  DISTANCIA_PRIMER_GRUPO: 45,

  // Separación entre grupos de obstáculos. Se escala con la velocidad para que
  // el tiempo de reacción se mantenga constante aunque el juego acelere.
  SEPARACION_MINIMA: 22,
  SEPARACION_MAXIMA: 34,
  // Tiempo mínimo de reacción garantizado (segundos). El generador respeta esto
  // aumentando la separación cuando la velocidad sube.
  TIEMPO_REACCION_MINIMO: 0.85,

  // Probabilidad de que un grupo bloquee 2 carriles en lugar de 1.
  PROBABILIDAD_DOBLE: 0.28,
  // Tamaño del pool de objetos reutilizables (evita crear/destruir en runtime).
  TAMANO_POOL: 40,
};

// ---------------------------------------------------------------------------
// PAPELES Y EVIDENCIA (las monedas)
// ---------------------------------------------------------------------------
export const PAPELES = {
  VALOR_MINIMO: 1,
  VALOR_MAXIMO: 5,
  // Los papeles salen en hileras, como las monedas del original.
  LARGO_HILERA_MIN: 5,
  LARGO_HILERA_MAX: 10,
  SEPARACION: 2.2,
  // Holgura respecto a los obstáculos. La hilera empieza pasado el grupo y
  // tiene que terminar antes del siguiente: los carriles libres lo son para
  // UN grupo, no para el tramo entero.
  MARGEN_TRAS_GRUPO: 5,
  MARGEN_ANTES_GRUPO: 5,
  ALTURA: 1.0,
  // Altura de la hilera cuando acompaña a un salto (arco sobre el obstáculo).
  ALTURA_ARCO: 2.0,
  DISTANCIA_APARICION: 200,
  TAMANO_POOL: 90,
  // Radio de imán: los papeles cercanos se atraen al jugador. Suaviza el juego
  // en móvil, donde la precisión del swipe es menor.
  RADIO_IMAN: 2.4,
  VELOCIDAD_IMAN: 9,
};

export const EVIDENCIA = {
  VALOR_MINIMO: 10,
  VALOR_MAXIMO: 20,
  // Aparece con mucha menos frecuencia que los papeles.
  PROBABILIDAD_POR_GRUPO: 0.18,
  ALTURA: 1.2,
  TAMANO_POOL: 12,
};

// ---------------------------------------------------------------------------
// ESTAMINA
// ---------------------------------------------------------------------------
// Cada escenario tiene su propio ítem de estamina. Si no lo recoges, te vuelves
// lento — no mueres, pero el perseguidor se acerca.
export const ESTAMINA = {
  MAXIMA: 100,
  INICIAL: 100,
  // Drenaje por segundo. Da ~50 s de margen sin recoger nada.
  DRENAJE: 2.0,
  // Cuánto recupera un ítem.
  RECUPERACION_POR_ITEM: 35,
  // Por debajo de este umbral el jugador se ralentiza.
  UMBRAL_LENTITUD: 30,
  // Multiplicador de velocidad cuando estás exhausto.
  PENALIZACION_VELOCIDAD: 0.72,
  // Frecuencia de aparición del ítem (uno cada N metros aprox.).
  DISTANCIA_ENTRE_ITEMS: 150,
  ALTURA: 1.1,
};

// ---------------------------------------------------------------------------
// PERSEGUIDOR (Noboa haciendo caballito sobre Reimberg)
// ---------------------------------------------------------------------------
export const PERSEGUIDOR = {
  DISTANCIA_INICIAL: 26,   // Visible al fondo, pero sin agobiar.
  DISTANCIA_MAXIMA: 34,
  DISTANCIA_CAPTURA: 4.5,  // Si baja de aquí, te atrapan.
  // Se acerca este tanto por cada golpe recibido.
  ACERCAMIENTO_POR_GOLPE: 8,
  // Se acerca a este ritmo (unidades/s) mientras estás exhausto.
  ACERCAMIENTO_POR_EXHAUSTO: 2.2,
  // Se aleja a este ritmo cuando corres limpio.
  ALEJAMIENTO: 1.6,
};

// ---------------------------------------------------------------------------
// TRAMOS Y BIFURCACIONES
// ---------------------------------------------------------------------------
export const TRAMO = {
  // Distancia recorrida antes de llegar a la bifurcación, en metros.
  LONGITUD: 850,
  // Aviso previo a la bifurcación.
  DISTANCIA_AVISO: 120,
};

// ---------------------------------------------------------------------------
// META-PROGRESO
// ---------------------------------------------------------------------------
export const PROGRESO = {
  // Cada cuántos papeles acumulados se desbloquea una evidencia del cuaderno.
  PAPELES_POR_EVIDENCIA: 100,
  CLAVE_ALMACENAMIENTO: 'elmercio.estadodecepcion.v1',
};

// ---------------------------------------------------------------------------
// CÁMARA
// ---------------------------------------------------------------------------
export const CAMARA = {
  FOV: 62,
  POSICION: { x: 0, y: 4.2, z: 8.5 },
  MIRA: { x: 0, y: 1.6, z: -8 },
  // La cámara sigue el desplazamiento lateral del jugador con retraso, lo que
  // da sensación de peso sin marear.
  SEGUIMIENTO_LATERAL: 0.18,
  AMORTIGUACION: 6,
  // Sacudida al chocar.
  SACUDIDA_GOLPE: 0.5,
};

// ---------------------------------------------------------------------------
// PALETA — vaporwave tropical
// ---------------------------------------------------------------------------
export const PALETA = {
  CIELO_ALTO: 0x0a0e17,
  CIELO_BAJO: 0x1a1f2e,
  CALLE: 0x12172a,
  LINEA_CARRIL: 0xffcf3f,
  JUGADOR: 0x7cffb2,
  PAPEL: 0xffcf3f,
  EVIDENCIA: 0xff6b35,
  OBSTACULO: 0xd9a441,
  BRILLO_PELIGRO: 0xff4f6d,
  ESTAMINA: 0x7cffb2,
  PERSEGUIDOR: 0xff4f6d,
};
