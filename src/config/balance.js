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
  // EL RITMO DE SUBWAY SURFERS NO ES CORRER RÁPIDO, es correr con holgura.
  // Esto arrancaba a 18 y subía a 42 en poco más de un minuto, y a 42 no da
  // tiempo a mirar nada: se juega leyendo el carril y el juego deja de ser
  // agradable de ver, que es la mitad de por qué engancha el original.
  //
  // Ahora arranca a 15 y sube a 32 en tres minutos largos. Es un tercio menos
  // de velocidad punta y cuatro veces más lenta la rampa, y a cambio hay
  // tiempo de ver la calle, los papeles se recogen en tiradas limpias y
  // subirse a una tarima es una decisión y no un reflejo.
  INICIAL: 15,
  MAXIMA: 32,
  ACELERACION: 0.09, // Unidades/segundo² — sube de 15 a 32 en unos 190 s.
  // Penalización al chocar: no es game over inmediato, pierdes ritmo.
  FRENAZO_POR_GOLPE: 0.45, // Multiplicador aplicado sobre la velocidad base.
  // SUELO ABSOLUTO tras el frenazo, como fracción de INICIAL. Vivía como un
  // 0.6 suelto dentro de Game.js y ha dejado de poder vivir ahí: el generador
  // de tarimas dimensiona el hueco saltable a partir de la velocidad MÁS LENTA
  // a la que se puede llegar a él, que es exactamente este número. Dos copias
  // del mismo 0.6 en dos ficheros distintos es un hueco insaltable esperando a
  // que alguien toque uno y no el otro.
  PISO_TRAS_GOLPE: 0.6,
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
  // --- LA SOMBRA DE CONTACTO ------------------------------------------------
  // Radio de la mancha bajo los pies. 0.62 es algo más que el ancho de hombros
  // del personaje: una sombra del tamaño exacto de la silueta se lee como un
  // recorte, y una sombra de verdad al mediodía se derrama un poco.
  RADIO_SOMBRA: 0.62,
  // A qué altura deja de dibujarse. 3.2 m es por encima del pico de un salto
  // normal (2,2) y por debajo del de botas (3,6): en el salto grande la sombra
  // se apaga arriba del todo, que es lo que hace de verdad.
  ALTURA_SOMBRA_NULA: 3.2,

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
  //
  // TIENE QUE SER MENOR QUE LA Z DE LA CÁMARA (7.4). Estaba en 25, o sea que
  // los obstáculos seguían vivos mucho después de pasar el objetivo y cruzaban
  // el plano de la cámara. Con la cámara larga y alta de antes eso no se veía
  // —quedaban muy por debajo de un encuadre estrecho— pero con la cámara corta
  // un retén o un bus se comía la pantalla entera durante medio segundo al
  // adelantarlo.
  //
  // A 6.5, cuando desaparecen ya solo se les ve el techo por el borde inferior
  // del cuadro, así que se van sin que se note.
  DISTANCIA_RECICLADO: 5.5,
  // SUELO de distancia para el primer grupo de un tramo. A velocidad inicial
  // son tres segundos; lo que manda de verdad es el tiempo, aquí debajo.
  DISTANCIA_PRIMER_GRUPO: 45,

  // EL PRIMER OBSTÁCULO SE MIDE EN SEGUNDOS, NO EN METROS.
  //
  // Estaba clavado en 45 metros, y cuarenta y cinco metros son tres segundos a
  // la velocidad de salida y UNO Y CUARTO a velocidad tope. O sea que el tramo
  // que más margen necesita —el que se entra a toda velocidad después de
  // doblar una esquina— era justo el que menos daba. Es la causa de que al
  // cruzar la bifurcación uno se estrelle contra lo primero que aparece: no
  // llega antes de tiempo, llega antes de que se pueda ver.
  //
  // 1.6 s es el doble del tiempo de reacción garantizado entre grupos, que es
  // lo que pide entrar en una calle que no se ha visto nunca.
  SEGUNDOS_PRIMER_GRUPO: 1.6,

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
// EVIDENCIA Y PRUEBAS (las monedas)
// ---------------------------------------------------------------------------
export const EVIDENCIA = {
  VALOR_MINIMO: 1,
  VALOR_MAXIMO: 5,
  // Los papeles salen en hileras, como las monedas del original.
  LARGO_HILERA_MIN: 4,
  LARGO_HILERA_MAX: 8,
  // Separación entre papeles de una misma hilera.
  //
  // El número sale de una cuenta, no del ojo. La cámara mira la pista con una
  // inclinación de unos 10°, así que un metro de separación en Z se traduce en
  // ~0.18 de desplazamiento vertical en pantalla. Con papeles de 0.5 de alto,
  // para que se vea AIRE entre uno y otro hace falta:
  //
  //     separación × 0.18  >  altura del papel
  //     separación         >  0.5 / 0.18  ≈  2.8
  //
  // A 2.2 los papeles se solapaban y la hilera se leía como una CINTA continua
  // —se perdía el ritmo de recogida y la tira tapaba lo que hubiera detrás—.
  // A 4.0 quedan unos 0.22 de hueco proyectado: piezas sueltas, con su ritmo.
  // Y A 6.0 se separan del todo. A 4.0 seguían leyéndose como una tira: se
  // recogían sin verlos, que es lo contrario de lo que hace el original —ahí
  // cada moneda es una pieza que se ve venir, se apunta y se coge—.
  SEPARACION: 7.0,
  // Ondulación vertical de la hilera. Sube y baja un poco de papel en papel,
  // que es el segundo golpe contra el efecto cinta: aunque dos se acerquen en
  // pantalla, no están a la misma altura y siguen leyéndose como dos.
  ONDA: 0,
  // Holgura respecto a los obstáculos. La hilera empieza pasado el grupo y
  // tiene que terminar antes del siguiente: los carriles libres lo son para
  // UN grupo, no para el tramo entero.
  MARGEN_TRAS_GRUPO: 5,
  MARGEN_ANTES_GRUPO: 5,
  ALTURA: 1.25,
  // Altura de la hilera cuando acompaña a un salto (arco sobre el obstáculo).
  ALTURA_ARCO: 2.1,
  DISTANCIA_APARICION: 200,
  // A partir de aquí no se mandan a pintar. La niebla es FogExp2 con densidad
  // 0.017, así que a 100 metros ya queda tapado el 94 % de la pieza: lo que se
  // dibuja más allá no se ve, pero se paga. Importa en el trámite, donde el
  // reguero mide trescientos metros y cabe entero dentro del cono de la cámara.
  DISTANCIA_VISIBLE: 100,
  // Da para el reguero entero del trámite (TRAMITE.PIEZAS_MAXIMAS) más los de
  // la calle. El pasillo riega todos tus papeles de golpe, y con el pool corto
  // eso eran doscientas mallas creadas y destruidas en el fotograma de entrada.
  // Guardarlas cuesta memoria de sobra —geometría y material van compartidos—
  // y ahorra el tirón justo al cruzar la puerta.
  TAMANO_POOL: 340,
  // Radio de imán: los papeles cercanos se atraen al jugador. Suaviza el juego
  // en móvil, donde la precisión del swipe es menor.
  RADIO_IMAN: 2.4,
  VELOCIDAD_IMAN: 9,
};

export const PRUEBAS = {
  VALOR_MINIMO: 10,
  VALOR_MAXIMO: 20,
  // Aparece con mucha menos frecuencia que los papeles.
  PROBABILIDAD_POR_GRUPO: 0.18,
  ALTURA: 1.2,
  TAMANO_POOL: 12,
};


// ---------------------------------------------------------------------------
// POTENCIADORES
// ---------------------------------------------------------------------------
// Los power-ups de Subway Surfers, traducidos a la redacción de un periódico.
// No están desde el principio: se van abriendo a medida que repites tramos, y
// ese goteo es el motivo para volver a jugar. Cada desbloqueo se anuncia.
//
// El orden de la escalera no es casual: primero el que hace la partida más
// generosa (imán), después el que la hace más rentable (portada), luego los
// que cambian cómo te mueves, y al final el que te salva la vida.
export const POTENCIADORES = {
  ALTURA: 1.45,          // Altura de pecho, como en la referencia.
  TAMANO_POOL: 6,
  // Cada cuántos metros se intenta soltar uno, una vez desbloqueados.
  DISTANCIA_ENTRE: 320,
  // Probabilidad de que la tirada salga premiada. Que no siempre haya uno es
  // lo que hace que encontrarlo valga algo.
  PROBABILIDAD: 0.62,

  // Radio de imán mientras dura "Fuente anónima".
  RADIO_IMAN: 7.5,
  // Altura de vuelo de la cobertura aérea.
  ALTURA_VUELO: 5.2,
  // Multiplicador de salto de las botas.
  IMPULSO_BOTAS: 1.28,
};

// Definición de cada potenciador. `tramos` es cuántos tramos hay que haber
// recorrido en total para que empiece a aparecer.
export const CATALOGO_POTENCIADORES = [
  {
    id: 'iman',
    nombre: 'Fuente anónima',
    descripcion: 'Los papeles vienen solos. Nadie pregunta de dónde.',
    duracion: 9,
    tramos: 3,
    color: 0x2affd5,
  },
  {
    id: 'portada',
    nombre: 'Portada',
    descripcion: 'Todo lo que recojas vale el doble mientras dure la primicia.',
    duracion: 13,
    tramos: 6,
    color: 0xffcf3f,
  },
  {
    id: 'botas',
    nombre: 'Botas de campo',
    descripcion: 'Saltas más alto. El terreno es el terreno.',
    duracion: 14,
    tramos: 10,
    color: 0x3dff9a,
  },
  {
    id: 'salvoconducto',
    nombre: 'Salvoconducto',
    descripcion: 'Aguanta un golpe. Alguien movió un contacto.',
    duracion: 0,          // No caduca: se gasta al recibir el golpe.
    tramos: 15,
    color: 0xff6b35,
  },
  {
    id: 'cobertura',
    nombre: 'Cobertura aérea',
    descripcion: 'Sobrevuelas el tramo entero recogiéndolo todo.',
    duracion: 8,
    tramos: 22,
    color: 0xff5fa2,
  },
  {
    id: 'linterna',
    nombre: 'Linterna',
    descripcion: 'Se ve la calle. Dura lo que dura la pila.',
    duracion: 11,
    // NO SE DESBLOQUEA: existe desde la primera partida, pero SOLO en el
    // Apagón. Es el potenciador de esa escena, y ahí no es un extra —es la
    // diferencia entre ver la calle y adivinarla—, así que hacerlo esperar a
    // los tres tramos sería cerrarle el escenario a quien acaba de llegar.
    tramos: 0,
    soloEn: 'apagon',
    color: 0xffe066,
  },
];

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

  // --- Encuadre --------------------------------------------------------
  // Van DETRÁS del jugador, o sea en Z POSITIVA: el jugador corre hacia -Z
  // y la cámara está a su espalda, así que "detrás" es entre la cámara y él.
  //
  // Eso obliga a un compromiso que conviene entender antes de tocar estos
  // números: lo que está más cerca de la cámara se dibuja MÁS GRANDE. Si
  // atáramos la Z visual a la distancia de juego, los perseguidores se verían
  // enormes cuando van lejos y pequeños cuando te alcanzan —justo al revés de
  // lo que hay que comunicar.
  //
  // Por eso el rango de Z es estrecho y la escala lo compensa: al acercarse
  // AVANZAN hacia el jugador (suben en cuadro, se cierra el hueco entre ellos
  // y tú) manteniendo el tamaño aparente. La lectura de amenaza la da el hueco
  // que se cierra, no el tamaño.
  //
  // LOS NÚMEROS DEPENDEN DE LA CÁMARA y hubo que rehacerlos enteros al
  // acortarla. Con la cámara a 17.5 había sitio de sobra detrás del jugador;
  // con la cámara a 7.4 el hueco entero mide siete unidades y medio se lo come
  // la perspectiva.
  //
  // La cuenta que los fija es el tamaño aparente, proporcional a
  // escala / distancia_a_la_cámara (que está en (0, 4, 7.4), y el centro
  // visual de los perseguidores a y≈1.4):
  //
  //     lejos:  0.72 / 4.44  =  0.162
  //     cerca:  0.95 / 5.99  =  0.159
  //     jugador: 1.0 / 8.02  =  0.125
  //
  // O sea: ocupan lo mismo en los dos extremos —no crecen al quedarse atrás,
  // que era el problema— y son un tercio más grandes que el jugador, que es
  // lo que corresponde a dos personas una encima de otra. Si se toca uno de
  // los cuatro valores hay que rehacer la división.
  // LA CUENTA, REHECHA CONTRA LA CÁMARA DE VERDAD. La de arriba se escribió
  // para una cámara en (0, 4, 7.4) que ya no existe, así que estaba caducada.
  // Con la cámara en (0, 4.3, 5.5) y el centro visual del par en y ≈ 0,9-1,06:
  //
  //     lejos:  0.72 / 4.61  =  0.156
  //     cerca:  0.86 / 5.46  =  0.158
  //     jugador: 1.0 / 6.54  =  0.153
  //
  // Siguen ocupando lo mismo en los dos extremos (0,8 % de diferencia) y siguen
  // siendo más grandes que el jugador. Si se toca uno de los cuatro valores hay
  // que rehacer la división.
  //
  // Y HUBO QUE MOVER LA Z, no sólo la escala. Al acortar la cámara de 6.4 a 5.5
  // el hueco por detrás del jugador se encogió de 3,6 a 2,7, y con eso el
  // perseguidor lejano se caía del cuadro: medido, su cabeza pasaba a 1,006, o
  // sea POR DEBAJO del borde inferior de la pantalla. Alejándolos de la cámara
  // —Z más pequeña, más pegados al jugador— vuelven exactamente a donde estaban:
  //
  //     alto en pantalla   lejos 0,325 / cerca 0,335   (antes 0,270 / 0,276)
  //     cabeza             0,906 → 0,670               (antes 0,909 → 0,668)
  //
  // O sea: el cuadro entero se cerró ×1,245 y ellos se cerraron con él. La
  // lectura de amenaza —el hueco que sube por el cuadro— es la misma.
  Z_LEJOS: 2.4,
  Z_CERCA: 1.1,
  ESCALA_LEJOS: 0.72,
  ESCALA_CERCA: 0.86,

  // Corren PEGADOS A UN LADO del jugador, no exactamente detrás.
  //
  // Con la cámara corta van muy cerca del objetivo, y de frente le tapaban el
  // cuerpo entero: se veía la espalda del perseguidor y nada más. Desplazados,
  // el jugador queda libre y ellos siguen leyéndose como lo que van a hacer.
  //
  // OJO: ESTO NO SON METROS, es separación EN PANTALLA (la razón x/z, que es
  // lo que la perspectiva convierte en píxeles). Con un desplazamiento fijo en
  // metros el hueco cambiaba solo: al acercarse van más cerca de la cámara y
  // el mismo metro y medio se abría de par en par, y al cambiar el jugador al
  // carril derecho los perseguidores se le montaban encima en vez de apartarse.
  // Fijando la razón, el hueco en pantalla es siempre el mismo.
  //
  // 0.185 son unos tres cuartos del semiancho visible en un móvil vertical:
  // se les ve enteros, pegados al borde, sin tapar el carril del jugador.
  DESVIO_EN_PANTALLA: 0.185,
};

// ---------------------------------------------------------------------------
// TRAMOS Y BIFURCACIONES
// ---------------------------------------------------------------------------
export const TRAMO = {
  // Distancia recorrida antes de llegar a la bifurcación, en metros.
  LONGITUD: 850,
  // Aviso previo a la bifurcación. A velocidad de crucero (~30 u/s) son más
  // de 8 segundos con los carteles a la vista: tiempo de sobra para leer los
  // tres destinos, decidir y colocarse sin que la elección sea un reflejo.
  DISTANCIA_AVISO: 260,
  // Dónde se vacía el corredor. Hasta aquí se sigue esquivando con normalidad;
  // a partir de aquí la pista queda limpia para que la elección sea una
  // decisión y no el carril que te tocó esquivar.
  //
  // Los dos números son distintos a propósito: si se vaciara ya en el aviso,
  // el jugador correría 260 metros —casi nueve segundos— sin nada que hacer.
  DISTANCIA_LIMPIEZA: 140,
};

// ---------------------------------------------------------------------------
// TÚNELES DE BIFURCACIÓN
// ---------------------------------------------------------------------------
// La bifurcación son tres bocas de túnel, no tres ramales al aire libre. El
// túnel resuelve de un golpe el problema que tenía el desvío: una boca es un
// destino con borde, se lee desde lejos, y "entrar" es un gesto inequívoco.
export const TUNEL = {
  LARGO: 110,           // Profundidad del tubo. Se pierde en su propia sombra.
  // La boca es alta y estrecha a propósito: con el ancho atado a la separación
  // de carriles (no puede pasar de 2.1 sin comerse la de al lado), la única
  // forma de que se lea como un túnel y no como una puerta es estirarla hacia
  // arriba. Y la fachada se queda justo por encima, para no ser un muro negro.
  ALTO_BOCA: 4.4,
  ANCHO_BOCA: 2.1,      // Una boca por carril, sin que se pisen entre ellas.
  ALTO_FACHADA: 7.8,
  ANCHO_FACHADA: 12,
  // A cuántos metros por delante de la boca se planta cada cartel de aviso.
  // El primero entra en cuadro con más de 6 segundos de margen: el jugador ve
  // a dónde va mucho antes de tener que decidir nada.
  AVISOS: [230, 150, 80],
};

// ---------------------------------------------------------------------------
// LOS ENTES DE CONTROL — el túnel del centro
// ---------------------------------------------------------------------------
// Entrar de frente no abre una ruleta: la institución te RIEGA LOS EVIDENCIA.
// Se desparraman por el pasillo los que traías y sales con lo que alcances a
// recoger del suelo. Ver docs/GUION.md y game/Tramite.js.
// ============================================================================
// LA RACHA — Encadenar papeles sin fallar
// ============================================================================
// El contador de racha existía desde el principio y no se veía en ningún sitio:
// subía, sonaba un poco más agudo y ahí se quedaba. Un multiplicador invisible
// no cambia cómo juega nadie.
//
// NO TOCA EL MARCADOR, Y ESO ES A PROPÓSITO. La racha no multiplica papeles:
// los papeles son el trabajo hecho y no se inflan por ir seguidos. Lo que da la
// racha es COLOR —el estallido de cada papel y la estela del corredor suben de
// tono— y la ficha del HUD. Es recompensa de la que se ve, no de la que se
// cuenta, y por eso puede escalar todo lo que quiera sin desequilibrar nada.
//
// LOS ESCALONES SON POCOS Y ANCHOS. Con un color por papel nadie distingue
// nada; con cuatro tramos, cada salto se nota y se persigue. El primero está en
// 6 porque encadenar cinco es lo normal sin proponérselo: el color tiene que
// empezar donde empieza el mérito.
export const RACHA = {
  // Segundos sin recoger antes de que se caiga. Un poco más de lo que tarda un
  // cambio de carril: cambiar de fila no puede costarte la racha.
  CADUCIDAD: 1.5,

  // Cada escalón: desde qué racha, con qué color y con cuánta chispa.
  // El color va de dorado a rojo pasando por naranja y magenta — sube de
  // temperatura, que es como se lee sin explicación.
  // `estela` es CHISPAS POR SEGUNDO, y los números parecen disparatados hasta
  // que se hace la cuenta: la ventana en la que una chispa de la estela se ve
  // es de unos tres metros y medio detrás del corredor —más atrás cae por
  // debajo del borde inferior del cuadro—, y a dieciocho metros por segundo eso
  // son DOS DÉCIMAS de vida útil. Con veinte por segundo salían cuatro puntos
  // sueltos; para que se lea como una cola hacen falta estos.
  TRAMOS: [
    // Los tonos son del diario, no cuatro neones distintos: el rojo sube de
    // intensidad con la racha en vez de cambiar de familia en cada escalón.
    { desde: 0, nombre: '', color: 0xd9705f, chispas: 10, estela: 0 },
    { desde: 6, nombre: 'EN RACHA', color: 0xc53b2b, chispas: 18, estela: 70 },
    { desde: 14, nombre: 'IMPARABLE', color: 0xa93123, chispas: 26, estela: 130 },
    { desde: 26, nombre: 'PRIMERA PLANA', color: 0x141414, chispas: 36, estela: 210 },
  ],
};

/** El escalón de racha que toca para un contador dado. */
export function tramoRacha(combo) {
  let actual = RACHA.TRAMOS[0];
  for (const t of RACHA.TRAMOS) if (combo >= t.desde) actual = t;
  return actual;
}

export const TRAMITE = {
  LONGITUD: 340,        // Metros dentro del pasillo del ente de control.

  // UN PAPEL EN EL SUELO ES UN PAPEL TUYO.
  //
  // Antes se acotaba el reguero entre 24 y 72 piezas y cada una representaba
  // una parte proporcional del montón —con trescientos encima se regaban 50 y
  // cada una valía seis—. La cuenta cuadraba, pero no había forma de leerla:
  // entrabas con trescientos, veías cincuenta cosas por el suelo, recogías
  // veinticinco y el marcador saltaba a trescientos. Ni el reguero se parecía a
  // lo que te habían quitado, ni la suma se parecía a lo que habías recogido.
  //
  // Ahora se riegan TODOS. Uno a uno, hasta donde caben. Y lo que caben lo
  // decide el pasillo, no un número redondo: ver el reparto en Tramite._regar().
  //
  // Este tope es de DIBUJO, no de cuenta. Pasado él, varios papeles viajan en
  // la misma pieza y esa pieza vale lo que lleva —en entero, nunca en
  // fracción—, así que lo que vuelve al marcador sigue siendo exactamente lo
  // recogido por dos. Lo que se pierde por encima del tope es resolución
  // visual, jamás papeles.
  PIEZAS_MAXIMAS: 520,

  // Dónde arranca el reguero y cuánto se deja libre al final, para que el
  // último papel alcance a pasar por delante antes de que se acabe el pasillo.
  ENTRADA: 20,
  COLA: 18,

  // Hueco mínimo entre papeles seguidos. Por debajo de esto la hilera se lee
  // como una cinta continua en vez de como papeles sueltos —la cuenta está en
  // EVIDENCIA.SEPARACION—, pero aquí se admite bastante más apretado a propósito:
  // esto no es una hilera de recompensa, es un expediente reventado por el
  // suelo, y ahí la masa ES el mensaje.
  PASO_MINIMO: 0.6,

  // Cada cuántos METROS cambia de carril el reguero. Va en metros y no en
  // número de papeles porque el reparto ahora se aprieta o se estira según
  // cuántos lleves: contando papeles, un montón grande cambiaría de carril
  // cada palmo y el reguero dejaría de tener forma.
  //
  // Diez metros a velocidad de crucero es cambiar de carril tres veces por
  // segundo. Recuperarlo todo tiene que ser prácticamente imposible.
  TRAMO_CARRIL: 10,

  // Fracción a partir de la cual el expediente "entra". Es 1: todo o nada.
  // Y aun recuperándolo todo el ente te da con la puerta en las narices; lo
  // que cambia es que el caso sigue vivo.
  UMBRAL_PERFECTO: 1,

  // LO QUE RECUPERAS DEL SUELO VALE EL DOBLE.
  //
  // Al entrar el marcador se pone a CERO —te los quitan todos, no una parte— y
  // eso deja el trámite como un castigo puro: entrabas con cuatrocientos, salías
  // con ciento veinte, y la lectura era «no entres nunca». Un tramo al que la
  // única respuesta correcta es evitarlo no es un tramo, es un error.
  //
  // Con el ×2 la cuenta cambia de signo sin dejar de doler: hay que recuperar
  // la mitad del reguero para salir en tablas, y a partir de ahí el pasillo
  // PAGA. Sigue costando —recuperar la mitad ya es difícil, y el reguero está
  // hecho para que recuperarlo entero sea casi imposible—, pero ahora lo que
  // decide si ganas o pierdes es cómo lo corres, no si entraste.
  //
  // Y encaja con lo que cuenta la escena: lo que sacas de una institución que
  // te tiró los papeles al suelo vale más que lo que traías, porque ya pasó por
  // ahí dentro.
  MULTIPLICADOR_RESCATE: 2,
};

// ---------------------------------------------------------------------------
// CERCO Y ESCAPE — lo que pasa cuando te atrapan
// ---------------------------------------------------------------------------
export const CERCO = {
  // Duración de la animación de cerco antes de que aparezca la interfaz.
  DURACION: 1.9,
  // Cuántos policías cierran el círculo.
  POLICIAS: 5,
  RADIO: 4.6,

  // La cámara se sale de su sitio y da la vuelta para enseñar el corro. Sin
  // esto la escena no se entiende: desde detrás, los perseguidores tapan al
  // jugador y los policías quedan repartidos fuera de cuadro. El plano tiene
  // que abrirse para que se vea QUÉ está pasando.
  //
  // La cámara NO orbita: se queda detrás y se aleja. Con un objetivo largo
  // como el de este juego, girar alrededor del corro obliga a acercarse tanto
  // que solo caben dos figuras. Retrocediendo y subiendo entra todo —el
  // jugador, los cinco policías y el dúo— y encima se conserva la orientación,
  // así que el corte no marea.
  // Plano del cerco. Se acortó junto con la cámara de juego y por el mismo
  // motivo, y además porque el jugador ahora TERMINA EN EL SUELO: desde 22
  // unidades y ocho y medio de alto, un cuerpo tumbado detrás de cinco
  // policías es una mancha de tres píxeles. De aquí sale la foto que se
  // imprime al día siguiente, así que tiene que verse quién está tirado.
  // MÁS ALTA QUE ANTES Y MÁS CERCA, y mirando casi al suelo: un cuerpo tumbado
  // se lee desde arriba, no desde su misma altura. A ras se ve un bulto entre
  // piernas; picado se ve quién está tirado y quién lo rodea.
  CAMARA: { x: 1.4, y: 6.6, z: 9 },
  CAMARA_MIRA_Y: 0.35,
  // Desplazamiento lateral de los perseguidores durante el cerco: se ponen a
  // un lado en vez de encima, o taparían al personaje justo en el momento en
  // que hay que verlo. Subió a 2.6 al pasar el jugador a caer al suelo: dos
  // figuras de pie a metro y medio de un cuerpo tumbado lo tapan entero.
  DESVIO_PERSEGUIDOR: 2.6,

  // --- Sorteo del juez ---------------------------------------------------
  // Seis jueces y un selector que los recorre. Cinco llevan la camiseta
  // morada del oficialismo; uno no. Paras el selector y a ver qué te toca.
  //
  // No es una ruleta: el selector está a la vista, los jueces están a la
  // vista, y el resultado es exactamente lo que hiciste con el pulgar.
  JUECES: 6,
  // Saltos por segundo del selector, la primera vez que te atrapan.
  SELECTOR_VELOCIDAD: 4.2,
  // Cuánto acelera por cada captura acumulada en la partida. NO hay tope de
  // intentos: siempre tienes la oportunidad, pero la oportunidad se encoge.
  // Esa curva es la única progresión del juego que va en tu contra, y es la
  // que hace que la partida acabe.
  SELECTOR_ACELERACION: 1.55,
  SELECTOR_VELOCIDAD_MAXIMA: 15,
  // A qué distancia quedan los perseguidores tras zafarte.
  DISTANCIA_TRAS_ESCAPE: 20,
};

// ---------------------------------------------------------------------------
// LOS JUECES
// ---------------------------------------------------------------------------
// Lo que te cae encima cuando el selector para donde no debe. El primero de la
// lista es el único que no está comprado; el resto reparten sentencias.
export const SENTENCIAS = [
  {
    id: 'honesto',
    limpio: true,
    titular: 'Le dictan medidas sustitutivas al periodista',
    texto: 'El juez no llevaba la camiseta. Sales con medidas sustitutivas y '
      + 'la orden de no salir del país. Todo sigue exactamente como antes.',
  },
  {
    id: 'preventiva',
    limpio: false,
    titular: 'Prisión preventiva para el periodista',
    texto: 'Seis meses mientras se investiga. La investigación es sobre ti, '
      + 'no sobre lo que documentaste.',
  },
  {
    id: 'domiciliaria',
    limpio: false,
    titular: 'Prisión domiciliaria y un grillete',
    texto: 'Puedes seguir escribiendo desde casa. Con un grillete y sin salir '
      + 'a preguntar, que es de donde salían las notas.',
  },
  {
    id: 'extradicion',
    limpio: false,
    titular: 'Aparece un pedido de extradición',
    texto: 'Alguien encontró una causa abierta en otro país. Qué oportuno, y '
      + 'qué rápido se tramitó.',
  },
  {
    id: 'incomunicacion',
    limpio: false,
    titular: 'Gobierno detiene a otro periodista',
    texto: 'Sin visitas, sin llamadas y sin abogado los primeros días. '
      + 'Después ya no hacía falta.',
  },
  {
    id: 'archivo',
    limpio: false,
    titular: 'Declaran reservada la causa',
    texto: 'El expediente pasa a reservado por seguridad nacional. Ni tú '
      + 'puedes leer de qué te acusan.',
  },
];

// ---------------------------------------------------------------------------
// NIVELES ELEVADOS — rampas y plataformas
// ---------------------------------------------------------------------------
// Como los trenes de Subway Surfers: hay una capa por encima del asfalto.
// Aquí son TARIMAS de campaña (los tablados que se montan en cada esquina) a
// las que se sube por una rampa. Correr arriba te salta los obstáculos de la
// calle, pero hay que bajarse antes de que la tarima se acabe.
export const ELEVADO = {
  // ALTURA DE LA SUPERFICIE TRANSITABLE.
  //
  // Estaba en 1,55 y era la altura de un bordillo. Ahí abajo no cabe nada que
  // justifique la plataforma: lo que la sostiene —buses parados en fila,
  // contenedores apilados— salía aplastado a la mitad de su tamaño, y una
  // «tarima» de metro y medio es un cajón sin sentido, que es justo lo que se
  // quería quitar.
  //
  // A 3.15 es el techo de un bus urbano. Ahora subirse es subirse ENCIMA de
  // algo, se ve desde lejos que hay altura y la caída de vuelta pesa. Es un
  // cambio de sensación, no solo de decorado.
  ALTURA: 3.15,
  // MÁS LARGAS. Estaban en 16-30 metros, que a la velocidad de antes eran
  // menos de un segundo arriba: se subía y se bajaba sin tiempo de estar. La
  // gracia de la capa de arriba del original es que se vive ahí un rato —se
  // recogen papeles, se salta de una a otra, se ve la calle desde lo alto—.
  // Y MÁS LARGAS TODAVÍA: 34-62 seguían siendo una tarima suelta a la que se
  // sube y de la que se baja. Lo que hace la capa de arriba en este género es
  // ser un CAMINO: una hilera de contenedores tras otra, con el hueco justo
  // para saltar entre ellas. A 55-95 metros y con el hueco de abajo, arriba se
  // vive un tramo entero saltando de una a la siguiente.
  LARGO_MINIMO: 55,
  LARGO_MAXIMO: 95,
  LARGO_RAMPA: 5.5,      // Tramo inclinado de subida.
  // Impulso vertical que da la rampa al pisarla. Sale de la altura, no se
  // elige: v0 = √(2·g·h) con h = ALTURA + 0.5 de margen. Al subir la
  // plataforma de 1,55 a 3.15 hay que subirlo con ella, o la rampa lanza
  // corto y el jugador se estrella contra el costado del bus.
  //   √(2 · 27.5 · 3.65) = 14.2
  IMPULSO_RAMPA: 14.2,
  // METROS DE CALLE LIBRE entre el final de una cadena y el pie de la rampa de
  // la siguiente. Ojo: es una separación GEOMÉTRICA, no una cadencia. Los 12
  // que había aquí decían ser lo segundo y se comparaban como lo primero
  // contra la Z equivocada, y por eso nunca hubo más de una tarima viva.
  //
  // 22 sale de dos cuentas que coinciden:
  //   · La reserva de carril se estira 6 m por detrás y 8 por delante de la
  //     cadena (ver Elevado._generar): 14 m. Por debajo de eso dos cadenas en
  //     carriles distintos se vetarían el mismo tramo de Z y el generador de
  //     obstáculos se quedaría sin sitio donde repartir. 22 deja 8 m de aire.
  //   · Es lo mismo que OBSTACULOS.SEPARACION_MINIMA, y por el mismo motivo:
  //     a 32 u/s son 0.69 s para caer del tablado, ver la rampa siguiente y
  //     colocarse; a 15 u/s, 1.47 s.
  DISTANCIA_ENTRE: 22,
  // Cuántas cadenas seguidas puede haber vivas a la vez. Con la condición de
  // solape arreglada esto por fin manda: medido sobre el gestor real, 3 dan
  // 7.25 cadenas por tramo de 850 m (antes 2.50) y tablado sobre la cabeza el
  // 66 % del recorrido (antes 23 %). Con 4 sube al 81 %, y ahí la capa de
  // arriba deja de ser una opción y pasa a ser el suelo por defecto.
  MAXIMO_VIVAS: 3,

  // ---- EL HUECO ----------------------------------------------------------
  // Una tarima no es una tabla: es una cadena de tramos con vacío entre ellos,
  // como los vagones del original. El vacío es lo que convierte correr por
  // arriba en una decisión repetida en vez de en un pasillo elevado.
  //
  // EL TAMAÑO NO SE ELIGE, SE DESPEJA, y no puede ser fijo. Hay dos cotas y
  // van en direcciones contrarias:
  //
  //   · Para que se pueda saltar SIEMPRE, el alcance del salto tiene que ganar
  //     al hueco a la velocidad más lenta posible. El vuelo dura 0.800 s
  //     (2·v0/g = 2·11/27.5) y llega a 0.847 s contando el MARGEN_ATERRIZAJE,
  //     porque el labio de llegada engancha 0.55 m por debajo del tablado.
  //   · Para que NO saltar cueste algo, el hueco tiene que dar tiempo a caer
  //     esos mismos 0.55 m: 0.20 s (√(2·0.55/27.5)). Por debajo de eso el
  //     labio de enfrente te recoge y el hueco es decorado.
  //
  // Medido en el navegador con el Player real: a 32 u/s un hueco de 4.5 y uno
  // de 6.0 SE CRUZAN ANDANDO. A 9 u/s —el piso tras un golpe— el alcance es de
  // 7.6 m y un hueco de 6 es casi insaltable. No hay número fijo que sirva:
  // el hueco escala con la velocidad, igual que la separación entre grupos de
  // obstáculos escala para mantener constante el tiempo de reacción.
  //
  // Se reparte el vuelo: medio segundo para el hueco y los 0.347 s restantes
  // como VENTANA para pulsar saltar. Medido, la ventana sale constante en toda
  // la curva: 0.34 s en el peor caso concebible y 0.62 s jugando normal, contra
  // los 0.15 s de SALTO.BUFFER_ENTRADA.
  HUECO_SEGUNDOS: 0.5,
  // Los extremos de esa misma cuenta, escritos para que se vean: el piso de
  // velocidad va de 9 (arrancando) a 14.4 (a tope), así que el hueco va de
  // 0.5·9 = 4.5 a 0.5·14.4 = 7.2. Sirven de tope por si alguien mueve VELOCIDAD.
  HUECO_MINIMO: 4.5,
  HUECO_MAXIMO: 7.2,

  // ---- LOS TRAMOS --------------------------------------------------------
  // Largo de cada pieza maciza de la cadena, en metros.
  //
  // MÍNIMO 20: es lo que tiene que medir el primer tramo para que quepa la
  // caída de la rampa. Medido barriendo velocidades, el impulso de 14.2 deja
  // al jugador tocando tablado 6.5 m pasada la rampa en el peor caso (17 u/s;
  // por encima de 18 el jugador sube apoyado en la pendiente y aterriza en el
  // borde mismo). Con las botas de campo puestas y saltando justo en el pie de
  // la rampa a 32 u/s se llega a 16.7 m. 20 los cubre. Y de paso son dos buses
  // de 8.4, que es lo mínimo para que una fila se lea como fila.
  TRAMO_MINIMO: 20,
  // MÁXIMO 34: cuatro buses. Más largo y el tramo vuelve a ser la tabla de 55
  // a 95 m que se venía a partir.
  TRAMO_MAXIMO: 34,
  // Margen de tolerancia al aterrizar sobre la plataforma: si el jugador está
  // cayendo y su pie queda dentro de esta franja por encima, se le engancha.
  MARGEN_ATERRIZAJE: 0.55,
};

// ---------------------------------------------------------------------------
// META-PROGRESO
// ---------------------------------------------------------------------------
export const PROGRESO = {
  // Aquí vivía PAPELES_POR_EVIDENCIA: cada cuántos papeles acumulados se
  // desbloqueaba una pieza del cuaderno. No lo leía nadie desde que el Archivo
  // dejó de comprarse —una página se completa con las PRUEBAS de su caso, no
  // con puntuación— y una constante de balance que no se consulta es peor que
  // no tenerla: la próxima persona que la lea creerá que manda algo.
  CLAVE_ALMACENAMIENTO: 'elmercio.estadodecepcion.v1',
};

// ---------------------------------------------------------------------------
// CÁMARA
// ---------------------------------------------------------------------------
export const CAMARA = {
  // CÁMARA CORTA, COMO LA DE SUBWAY SURFERS. Va ocho unidades por detrás del
  // personaje y poco más de tres por encima, con un gran angular franco.
  //
  // La versión anterior era casi un teleobjetivo (FOV 38 a 17.5 de distancia)
  // y resolvía un problema real —con la cámara atrás y los perseguidores entre
  // ella y el jugador, un gran angular los dispara de tamaño—, pero lo pagaba
  // caro: la profundidad comprimida deja la calle plana, el personaje pequeño
  // y la sensación de velocidad en nada. Se veía la persecución desde la
  // tribuna en vez de correrla.
  //
  // Lo que hace inmersiva a la de Subway Surfers es exactamente lo contrario:
  // estás encima del personaje, la vía se abre hacia ti y las paredes laterales
  // pasan de largo por el borde del cuadro. El problema de los perseguidores no
  // se resuelve con la focal, se resuelve con su rango de Z (ver PERSEGUIDOR).
  // MÁS CORTA Y MÁS CERRADA, PORQUE EL PERSONAJE SALÍA PEQUEÑO. Medido
  // proyectando su caja envolvente —la del esqueleto, no la de reposo— contra
  // la cámara en un móvil vertical de 393×852: ocupaba 0,165 del alto de la
  // pantalla. En la referencia ocupa un cuarto. Estaba bien COLOCADO —cabeza en
  // 0,698, pies en 0,863, o sea tercio inferior— pero medía dos tercios de lo
  // que debía.
  //
  // El tamaño aparente es 1 / (2·d·tan(fov/2)), así que sólo hay dos mandos y
  // los dos están aquí: distancia y focal. Con 56 a 6,54 de distancia sale
  // 0,209, un 27 % más grande, y ahí se para la cosa por dos topes MEDIDOS:
  //
  //   · Por focal: a FOV 52 el borde del jugador en el carril exterior cae en
  //     0,9815 de la pantalla, o sea rozando el corte. Cerrar más el angular
  //     es dejar de ver por dónde se corre.
  //   · Por distancia: a z = 4,6 ese mismo borde llega a 1,003 —se sale— y los
  //     perseguidores, que van entre la cámara y el jugador, se van del cuadro
  //     por abajo.
  FOV: 56,
  POSICION: { x: 0, y: 4.3, z: 5.5 },
  // Y LA MIRA BAJA, que parece lo contrario de lo que decía el comentario
  // viejo y es lo mismo. Lo que pone al personaje en el tercio inferior no es
  // el número, es que la línea de visión le pase POR ENCIMA de la cabeza: con
  // la cámara en 4,3 y la mira en 0,90 a z = −6, esa línea pasa a 2,68 sobre el
  // asfalto a la altura del personaje, y él mide 1,60. Dejarla en 2,00 con la
  // cámara acortada lo empujaba fuera del cuadro por abajo (pies en 1,013).
  //
  // Con esto: cabeza 0,666, pies 0,876, picado 16,47° contra los 12,28° de
  // antes —el «picado claro» de la referencia— y horizonte en 0,222.
  MIRA: { x: 0, y: 0.90, z: -6 },

  // Encuadre según la forma de la pantalla.
  //
  // Three.js mantiene FIJO el FOV VERTICAL y deriva el horizontal del aspecto,
  // así que la misma cámara da imágenes muy distintas en un móvil vertical y
  // en un monitor. Hay un límite por cada lado:
  //
  // MÍNIMO — en pantallas MUY altas el ancho se estrecha tanto que los
  // carriles exteriores dejan de verse a tiempo. Es una red de seguridad: con
  // el gran angular actual ni siquiera se activa en un móvil normal (aspecto
  // ~0.46), solo en formatos extremos.
  // 13.5 Y NO 16, Y ESTO ERA UN FALLO SILENCIOSO. El comentario de arriba dice
  // que esta red de seguridad «ni siquiera se activa en un móvil normal
  // (aspecto ~0.46)». Medido: SE ACTIVA SIEMPRE. A aspecto 0,461 el suelo pide
  // un vertical de 63,74° y el juego lo aplicaba, así que la cámara nunca corrió
  // con el FOV que dice la línea de arriba —y el personaje pagaba un 10 % de
  // tamaño por una red que no hacía falta—.
  //
  // Peor: a aspecto 0,562 (un iPhone SE) el suelo pide 54,05 y NO se activa. O
  // sea que dos móviles corrientes daban dos encuadres distintos.
  //
  // 13.5 es el semiángulo que a 0,461 pide 55,0°, justo por debajo del FOV de
  // diseño: deja de mandar en un móvil normal y sigue mandando en formatos
  // extremos, que es lo que se quería. Y el margen que protegía sigue ahí
  // medido: el borde del jugador en el carril exterior queda en 0,872.
  SEMIANGULO_HORIZONTAL: 13.5,
  // MÁXIMO — en pantallas anchas pasa lo contrario: un FOV vertical de 58 en
  // 16:9 da casi 90° horizontales, y eso ya no es gran angular, es ojo de pez.
  // Las líneas de la calle se curvan y los laterales se estiran.
  // 42 Y NO 34, porque 34 recortaba DEMASIADO y el recorte tenía un precio que
  // no se había medido: cerrar el vertical a 41,55° agranda todo y empuja al
  // personaje fuera del cuadro. Medido en 1280×720, con la cámara de ANTES los
  // pies ya caían en 1,091 —fuera de pantalla— y el cielo se quedaba en el
  // 21 % del cuadro. O sea que en un monitor el juego llevaba tiempo cortándole
  // los pies al personaje y nadie lo había medido.
  //
  // Barrido en escritorio con la cámara nueva: 34 → pies 1,135; 38 → 1,054;
  // 40 → 1,019; 42 → 0,974 con el horizonte en 0,297; 46 → 0,956 pero ya sin
  // recortar nada (86,8° horizontales). 42 son 84° horizontales: es lo que hay
  // que pagar para que en un monitor se le vean los pies al personaje.
  SEMIANGULO_HORIZONTAL_MAXIMO: 42,
  // Y EL SUELO DEL PROPIO VERTICAL. Sin él, en un móvil tumbado (aspecto 2,16)
  // el techo de arriba cerraba el vertical a 45,18° y los pies del personaje
  // caían en 1,044 de pantalla, o sea fuera. Ver Game._ajustarEncuadre().
  FOV_MINIMO: 52,
  // La cámara sigue el desplazamiento lateral del jugador con retraso, lo que
  // da sensación de peso sin marear.
  //
  // Subió de 0.18 a 0.5 al acortar la cámara, y no es cuestión de gusto: con
  // la cámara a 7.4 y el gran angular, un jugador en el carril exterior (±2.4)
  // se salía del borde de la pantalla en vertical. Siguiéndolo a la mitad se
  // queda a media distancia del centro, que es donde debe estar: dentro, pero
  // suficientemente descentrado como para que se note el cambio de carril.
  // 0.78 al acercar la cámara, y sale de la misma medida que lo fijó en 0.7:
  // dónde queda el borde del jugador cuando está en el carril exterior. Medido
  // con el encuadre nuevo: a 0,70 cae en 0,9385 de la pantalla —cinco
  // centésimas del corte— y a 0,80 en 0,8557. Interpolando, 0,78 lo deja en
  // 0,872, que es clavado el margen que había antes (0,869).
  //
  // O sea: no es que ahora se quiera un seguimiento más pegajoso, es que un
  // cuadro un 24 % más cerrado necesita seguir un poco más para dejar el mismo
  // hueco.
  SEGUIMIENTO_LATERAL: 0.78,
  AMORTIGUACION: 8,

  // --- CORRIENDO POR ARRIBA -------------------------------------------------
  // Sobre la plataforma la cámara se queda corta: seguía al jugador solo con
  // un 0,28 de su altura, así que a tres metros y pico se veía el techo de los
  // buses desde muy cerca y la calle de abajo desaparecía del cuadro. Se corría
  // a ciegas por un pasillo estrecho sin saber dónde acaba.
  //
  // Arriba la cámara se separa, sube y baja la mira. Se separa porque hay que
  // ver el borde de la plataforma —que es de donde te caes—, sube porque si no
  // el propio tablado tapa lo que viene, y la mira baja para que el final del
  // elevado entre en cuadro con antelación.
  // --- CUÁNTO SIGUE LA CÁMARA A LA ALTURA DEL SUELO -------------------------
  // Subirse a una tarima no es saltar: el suelo cambia de sitio y la cámara
  // tiene que ir con él, o el personaje se queda arriba del cuadro. Se sigue
  // casi entero en posición y a medias en la mira, y esa DIFERENCIA es la que
  // abre el picado al subir. Medido sobre una tarima de verdad —subiendo por su
  // rampa, no forzando la altura a mano—: la cabeza queda en 0,506 del alto de
  // pantalla contra 0,660 en la calle.
  SEGUIMIENTO_SUELO: 0.90,
  SEGUIMIENTO_SUELO_MIRA: 0.55,

  // --- CUÁNTO SIGUE LA CÁMARA AL SALTO --------------------------------------
  //
  // Estaba en 0.45 la posición y 0.12 la mira, con el argumento de que «que el
  // encuadre ceda un poco es lo que hace que un salto se sienta salto». El
  // argumento sigue siendo bueno; los números dejaron de valer al acortar la
  // cámara y cerrar el angular (§6.14). Medido proyectando la caja del
  // personaje fotograma a fotograma durante un salto:
  //
  //   posición  mira   cabeza en el pico   cuánto sube en cuadro
  //     0.45    0.12        0.014                0.621     ← como estaba
  //     0.65    0.35        0.102                0.519
  //     0.80    0.55        0.168                0.465     ← aquí
  //     0.90    0.70        0.212                0.406
  //     1.00    0.85        0.249                0.389
  //
  // Con 0.45 la CABEZA llegaba a 0.014 de la pantalla: el personaje salía por
  // el borde de arriba, que es exactamente donde vive el cartel de salida de la
  // bifurcación y el HUD. Por eso «los letreros lo tapan»: no es que los
  // letreros estorben, es que el salto lo metía debajo de ellos.
  //
  // 0.80 / 0.55 lo deja en 0.168 —bien dentro— y aun así sube 0.465 del alto de
  // la pantalla, o sea que el salto se sigue leyendo como salto. Subir más
  // tampoco sale gratis: al aterrizar la cámara viene rezagada arriba y los
  // pies bajan a 0.982 con 0.90, que ya roza el borde de abajo.
  SEGUIMIENTO_SALTO: 0.80,
  SEGUIMIENTO_SALTO_MIRA: 0.55,

  // --- EL TECHO DEL PERSONAJE, que es una red y no un mando ------------------
  //
  // Los factores de arriba dicen cuánto acompaña la cámara. Esto dice otra
  // cosa: que el personaje no se meta debajo del cartel de salida, pase lo que
  // pase. El cartel se cuelga a 68 px del borde superior y mide otros ciento y
  // pico, o sea que ocupa la banda y = 0.09-0.27 de la pantalla.
  //
  // 0.28 va justo por debajo de esa banda. Y NO SE DISPARA EN NINGÚN CASO
  // MEDIDO HOY, que es como tiene que ser una red: con la cámara ya ajustada,
  // la cabeza queda en 0,520 saltando en la calle, 0,392 saltando desde el
  // tablado y 0,325 en el techo de lo alcanzable —tablado más salto con botas,
  // 6,75 m—. Existe porque esas tres cifras dependen de media docena de
  // constantes que se van a volver a tocar, y el día que una se mueva, esto
  // avisa moviendo la cámara en vez de escondiendo al personaje.
  TECHO_PERSONAJE: 0.28,
  // Y cuánto tiene que sobrarle antes de devolver la corrección, para que no
  // oscile entre corregir y soltar en cada fotograma.
  HOLGURA_TECHO: 0.12,

  ARRIBA_ALTURA_EXTRA: 0.4,
  ARRIBA_DISTANCIA_EXTRA: 1.2,
  ARRIBA_MIRA_BAJA: 0.2,
  // Lo que tarda en llegar a ese encuadre y en volver. Medio segundo: más
  // rápido se lee como un tirón al subir, más lento y la cámara sigue
  // acomodándose cuando ya te bajaste.
  ARRIBA_TRANSICION: 0.5,

  // --- CURVATURA DEL MUNDO --------------------------------------------------
  // Cuánto se dobla la calle hacia abajo con la distancia (y -= k·z², en
  // espacio de cámara). Con 0.0008, a cien metros el asfalto ha bajado unos
  // ocho metros: una loma franca, que es lo que hace que los obstáculos
  // aparezcan SUBIENDO por la cresta en vez de materializarse en la niebla.
  // Se probó 0.0004 —no se notaba— y 0.0013 —el fondo entero se hundía y la
  // fachada de la bifurcación tardaba demasiado en asomar—.
  // 0.0004 y no 0.0008. Con 0.0008 la cresta del suelo caía en y=0.46 de la
  // pantalla —la mitad del cuadro era loma— y encima a 64 m, donde la niebla ya
  // solo deja pasar el 31 % del color: no se leía como loma, se leía como
  // bruma. Con el picado nuevo y 0.0004 la cresta sube a 0.29-0.36, que es
  // donde la referencia pone el punto de fuga, y quien corta el mundo vuelve a
  // ser la niebla, que es lo que se espera de una niebla.
  // 0.0009. Estuvo en 0.0004 para que la cresta cayera donde la referencia
  // pone el punto de fuga, y esa medida se cumplía a costa de lo que la
  // curvatura sirve DE VERDAD: con el suelo casi plano, lo que viene a treinta
  // metros queda escondido detrás de lo que viene a quince. Curvado, el mundo
  // se levanta hacia el fondo y el siguiente grupo de obstáculos asoma por
  // encima del anterior, que es el motivo por el que estos juegos curvan el
  // mundo y no un adorno.
  CURVATURA: 0.0009,
  // Sacudida al chocar.
  SACUDIDA_GOLPE: 0.5,

  // Amplitud del balanceo de cámara en los tramos especiales, en radianes.
  // Unos cinco grados: se nota que el sitio es otro sin que llegue a marear.
  // Ver Game._ladeoEspecial() para por qué se balancea en vez de inclinarse.
  LADEO_ESPECIAL: 0.088,
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
  PRUEBAS: 0xff6b35,
  OBSTACULO: 0xd9a441,
  BRILLO_PELIGRO: 0xff4f6d,
  PERSEGUIDOR: 0xff4f6d,
};
