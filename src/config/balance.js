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
  SEPARACION: 4.0,
  // Ondulación vertical de la hilera. Sube y baja un poco de papel en papel,
  // que es el segundo golpe contra el efecto cinta: aunque dos se acerquen en
  // pantalla, no están a la misma altura y siguen leyéndose como dos.
  ONDA: 0.14,
  // Holgura respecto a los obstáculos. La hilera empieza pasado el grupo y
  // tiene que terminar antes del siguiente: los carriles libres lo son para
  // UN grupo, no para el tramo entero.
  MARGEN_TRAS_GRUPO: 5,
  MARGEN_ANTES_GRUPO: 5,
  ALTURA: 1.0,
  // Altura de la hilera cuando acompaña a un salto (arco sobre el obstáculo).
  ALTURA_ARCO: 2.1,
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
// AGUANTE
// ---------------------------------------------------------------------------
// POR QUÉ ESTO YA NO ES UN RECURSO EN TODAS PARTES
//
// Empezó siendo una barra que drenaba en las cuatro escenas: si no comías ibas
// lento, y al ir lento te alcanzaban. Los números decían otra cosa. Con drenaje
// de 2/s tardas 50 segundos en vaciarte desde lleno, pero los ítems salen cada
// 150 metros —unos 6 segundos a velocidad de crucero— y devuelven 35 cada uno.
// Recogiendo la mayoría ganas 23 netos por ciclo: la barra no baja NUNCA.
//
// O sea: invisible cuando juegas bien, y castigo añadido cuando ya vas mal y
// además fallas los ítems. Es la peor forma posible para una mecánica, porque
// no crea tensión —la duplica justo cuando ya la habías perdido—. Y encima
// falla de forma indirecta (sin aguante → lento → te alcanzan), así que al
// morir no hay un momento claro de «ahí me equivoqué».
//
// Así que el drenaje se queda SOLO en el Apagón, donde el recurso no es un
// añadido sino la escena entera: la luz se traduce en lo que literalmente ves.
// En las demás la comida es un bonus que solo suma, sin barra y sin castigo por
// ignorarla. Lo decide `aguanteEsRecurso` en config/escenarios.js.
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
  // Lo que paga la comida donde NO es un recurso. Es un bonus limpio: si la
  // ignoras no pierdes nada, y si la coges ganas papeles. Un plato vale como
  // tres papeles buenos, lo bastante para que merezca el desvío de carril sin
  // convertirse en la única forma de puntuar.
  BONIFICACION_PAPELES: 15,
  // Vuela por encima de la altura de los papeles a propósito: es lo que hay
  // que ver desde lejos, y a la altura de la hilera quedaba escondido detrás
  // de ella.
  ALTURA: 1.45,
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
  ALTURA: 1.6,           // Aún más arriba que la estamina: es lo más llamativo.
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
  Z_LEJOS: 8.8,
  Z_CERCA: 3.8,
  ESCALA_LEJOS: 0.68,
  ESCALA_CERCA: 1.25,
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
// Entrar de frente no abre una ruleta: la institución te RIEGA LOS PAPELES.
// Se desparraman por el pasillo los que traías y sales con lo que alcances a
// recoger del suelo. Ver docs/GUION.md y game/Tramite.js.
export const TRAMITE = {
  LONGITUD: 340,        // Metros dentro del pasillo del ente de control.

  // CUÁNTAS PIEZAS SE DIBUJAN.
  // No son papeles nuevos: son los tuyos. Pero la cantidad no puede ser la
  // real —con cuatrocientos encima no se pueden pintar cuatrocientas piezas, y
  // con tres no habría trámite—, así que se acota y cada pieza en pista
  // representa una parte proporcional del montón.
  PIEZAS_MINIMAS: 24,
  PIEZAS_MAXIMAS: 72,

  // Reparto en zigzag por los tres carriles. La separación es MENOR que lo que
  // tarda un cambio de carril a velocidad de crucero, y eso es deliberado:
  // recuperarlo todo tiene que ser prácticamente imposible.
  SEPARACION: 3.0,
  // Cada cuántas piezas cambia de carril el reguero.
  PIEZAS_POR_TRAMO: 3,

  // Fracción a partir de la cual el expediente "entra". Es 1: todo o nada.
  // Y aun recuperándolo todo el ente te da con la puerta en las narices; lo
  // que cambia es que el caso sigue vivo.
  UMBRAL_PERFECTO: 1,
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
  CAMARA: { x: 2.2, y: 8.6, z: 22 },
  CAMARA_MIRA_Y: 1.1,
  // Desplazamiento lateral de los perseguidores durante el cerco: se ponen a
  // un lado en vez de encima, o taparían al personaje justo en el momento en
  // que hay que verlo.
  DESVIO_PERSEGUIDOR: 1.7,

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
  // Con qué aguante te devuelve a la pista un fallo del sistema a tu favor.
  ESTAMINA_TRAS_ESCAPE: 70,
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
    titular: 'MEDIDAS SUSTITUTIVAS',
    texto: 'El juez no llevaba la camiseta. Sales con medidas sustitutivas y '
      + 'la orden de no salir del país. Todo sigue exactamente como antes.',
  },
  {
    id: 'preventiva',
    limpio: false,
    titular: 'PRISIÓN PREVENTIVA',
    texto: 'Seis meses mientras se investiga. La investigación es sobre ti, '
      + 'no sobre lo que documentaste.',
  },
  {
    id: 'domiciliaria',
    limpio: false,
    titular: 'PRISIÓN DOMICILIARIA',
    texto: 'Puedes seguir escribiendo desde casa. Con un grillete y sin salir '
      + 'a preguntar, que es de donde salían las notas.',
  },
  {
    id: 'extradicion',
    limpio: false,
    titular: 'PEDIDO DE EXTRADICIÓN',
    texto: 'Alguien encontró una causa abierta en otro país. Qué oportuno, y '
      + 'qué rápido se tramitó.',
  },
  {
    id: 'incomunicacion',
    limpio: false,
    titular: 'INCOMUNICACIÓN',
    texto: 'Sin visitas, sin llamadas y sin abogado los primeros días. '
      + 'Después ya no hacía falta.',
  },
  {
    id: 'archivo',
    limpio: false,
    titular: 'CAUSA RESERVADA',
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
  ALTURA: 1.55,          // Altura de la superficie transitable.
  LARGO_MINIMO: 16,
  LARGO_MAXIMO: 30,
  LARGO_RAMPA: 5.5,      // Tramo inclinado de subida.
  // Impulso vertical que da la rampa al pisarla. Basta para superar la altura
  // de la tarima con margen: v0 = √(2·g·h) con h = ALTURA + 0.5.
  IMPULSO_RAMPA: 10.6,
  // Cada cuántos metros se intenta colocar una tarima.
  DISTANCIA_ENTRE: 190,
  // Margen de tolerancia al aterrizar sobre la plataforma: si el jugador está
  // cayendo y su pie queda dentro de esta franja por encima, se le engancha.
  MARGEN_ATERRIZAJE: 0.55,
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
  // La cámara está lo bastante atrás como para que los perseguidores quepan
  // ENTRE ella y el jugador. Sin ese hueco no hay forma de enseñarlos
  // persiguiendo: irían siempre fuera de cuadro, por detrás del objetivo.
  // El FOV es DELIBERADAMENTE cerrado, casi de teleobjetivo. Es lo que
  // resuelve el problema de encuadre que abre la persecución: con la cámara
  // atrás y los perseguidores entre ella y el jugador, un gran angular los
  // dispara de tamaño y tapan al personaje. Una focal larga comprime la
  // profundidad, así que ellos ocupan lo que tienen que ocupar —una franja
  // baja del cuadro— y el jugador conserva su tamaño en pantalla.
  FOV: 38,
  POSICION: { x: 0, y: 6.2, z: 17.5 },
  MIRA: { x: 0, y: 1.3, z: -8 },

  // Compensación de encuadre en pantallas verticales.
  //
  // Three.js mantiene FIJO el FOV VERTICAL y deriva el horizontal del aspecto.
  // En un móvil en vertical (aspecto ~0.46) eso recorta el ancho a menos de la
  // mitad, y los carriles exteriores se salían de pantalla justo a la altura
  // del jugador. Para un juego que es primero móvil, eso no es un detalle.
  //
  // La solución estándar (Hor+): fijar el ANCHO mínimo visible y abrir el FOV
  // vertical lo que haga falta para conseguirlo. En pantallas anchas no se
  // toca nada, porque el mínimo ya se cumple de sobra.
  // Semiángulo horizontal necesario, en grados, medido a la distancia del
  // jugador: cubre los tres carriles (±2.4) más un margen de aire.
  SEMIANGULO_HORIZONTAL: 11.2,
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
