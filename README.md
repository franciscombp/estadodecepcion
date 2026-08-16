# EL MERCIO presenta: ESTADO DE EXCEPCIÓN

*(Estado Decepción)*

Un endless runner satírico ecuatoriano. Corres, esquivas y documentas mientras
Noboa —haciendo caballito sobre Reimberg— te pisa los talones por cuatro
escenarios en loop infinito.

**Mecánica:** la de Subway Surfers, sin inventos. Tres carriles, saltar,
agacharse, monedas y un perseguidor. Lo que cambia es la piel y el trasfondo.

---

## Jugar

**En línea:** https://franciscombp.github.io/estadodecepcion/

Es una PWA instalable: desde el móvil, "Añadir a pantalla de inicio". A partir
de la segunda visita arranca sin conexión.

### Controles

| Acción | Escritorio | Móvil |
|---|---|---|
| Cambiar de carril | `←` `→` o `A` `D` | Swipe lateral |
| Saltar | `↑`, `W` o `Espacio` | Swipe arriba |
| Agacharse | `↓` o `S` | Swipe abajo |
| Pausa | `ESC` o `P` | — |

---

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo con recarga en caliente
npm run build    # compila a dist/
npm run preview  # sirve el build de producción
```

Requiere Node 20 o superior.

---

## Cómo está montado

```
src/
├── config/
│   ├── balance.js      ← TODOS los pesos de juego. Empieza por aquí.
│   ├── publicaciones.js← Los reportajes REALES del Archivo ⚠️ hay que rellenarlo
│   ├── estilo.js       ← Tokens visuales (ver docs/ESTILO.md)
│   ├── escenarios.js   ← Los 4 escenarios y el mapa del loop
│   ├── personajes.js   ← La plantilla jugable y sus desbloqueos
│   ├── tabla.js        ← Las tres clasificaciones de muestra
│   └── textos.js       ← Microcopy, remates y fichas del cuaderno
├── game/
│   ├── Game.js         ← Orquestador: bucle y máquina de estados
│   ├── Player.js       ← Carriles, salto, agachada, hitbox
│   ├── Obstacle.js     ← Generación por grupos + pool de objetos
│   ├── Coin.js         ← Papeles y evidencia
│   ├── Track.js        ← Suelo infinito reciclable
│   ├── Chaser.js       ← Noboa + Reimberg
│   ├── Bifurcacion.js  ← Las tres bocas de túnel (el carril decide)
│   ├── Tramite.js      ← El túnel del centro: solo recolectar
│   ├── Elevado.js      ← Tarimas: el nivel por encima de la calle
│   ├── Cerco.js        ← La animación de que te rodean
│   ├── Rutas.js        ← El mapa del rombo
│   ├── PowerUps.js     ← Potenciadores y su desbloqueo progresivo
│   ├── Intro.js        ← La cinemática de arranque
│   └── Notebook.js     ← Meta-progreso en localStorage
├── scenes/
│   ├── BaseScene.js    ← Luces, niebla y decorado lateral
│   ├── BahiaScene.js       · corrupción
│   ├── ApagonScene.js      · crisis energética (mecánica de oscuridad)
│   ├── EleccionesScene.js  · cooptación del CNE
│   └── CarondeletScene.js  · censura de prensa
├── models/
│   ├── characters.js   ← Personajes low-poly procedurales
│   └── props.js        ← Obstáculos, recolectables y decorado
├── ui/
│   ├── HUD.js          ← Interfaz durante la partida
│   ├── iconos.js       ← Set de iconos SVG inline
│   └── screens.js      ← Portada, escape, primera plana, marcadores, archivo
└── utils/
    ├── controls.js     ← Teclado + swipe
    ├── collision.js    ← AABB
    ├── calidad.js      ← Detección de hardware y ajuste adaptativo
    ├── audio.js        ← Efectos sintetizados con Web Audio
    ├── actualizacion.js← Modo offline y entrada de versiones nuevas
    └── assetCache.js   ← Envoltorio de IndexedDB
```

### Principio de diseño

`Game.js` no sabe nada del DOM. `screens.js` no sabe nada de Three.js. Se
hablan por callbacks que se enganchan en `main.js`. Puedes rehacer toda la
interfaz sin tocar una línea de lógica de juego.

---

## Ajustar el juego

**Todo el tuning vive en `src/config/balance.js`.** No hay constantes sueltas
repartidas por el código: si algo se siente mal, se cambia ahí.

Lo que se toca más a menudo:

| Se siente… | Ajusta |
|---|---|
| Muy lento / muy rápido | `VELOCIDAD.INICIAL`, `VELOCIDAD.ACELERACION`, `VELOCIDAD.MAXIMA` |
| El salto no llega | `SALTO.VELOCIDAD_INICIAL`, `SALTO.GRAVEDAD` |
| Obstáculos injustos | `OBSTACULOS.TIEMPO_REACCION_MINIMO`, `OBSTACULOS.SEPARACION_MINIMA` |
| Pocos/muchos papeles | `PAPELES.LARGO_HILERA_*`, `densidadPapeles` de cada escenario |
| Potenciadores escasos | `POTENCIADORES.DISTANCIA_ENTRE`, `POTENCIADORES.PROBABILIDAD` |
| Perseguidor pesado | `PERSEGUIDOR.ACERCAMIENTO_POR_GOLPE`, `PERSEGUIDOR.ALEJAMIENTO` |
| Tramos largos/cortos | `TRAMO.LONGITUD` |
| Poco tiempo para elegir ruta | `TRAMO.DISTANCIA_AVISO` |
| El agacharse no responde | `AGACHARSE.DURACION`, `AGACHARSE.VELOCIDAD_POSE` |

El salto usa física balística: `altura_pico = v₀²/(2g)` y
`tiempo_aire = 2·v₀/g`. Con los valores actuales (v₀=11, g=27.5) el pico son
2.2 m y el vuelo 0.80 s.

En desarrollo tienes `window.__juego` y `window.__cuaderno` en la consola del
navegador para trastear en vivo.

---

## La cámara

Corta y con gran angular, como la de Subway Surfers: **ocho unidades por
detrás** del personaje y cuatro por encima, FOV 58. Antes era casi un
teleobjetivo (FOV 38 a 17.5 de distancia) y resolvía un problema real —los
perseguidores van entre la cámara y el jugador, y un gran angular los dispara
de tamaño— pero lo pagaba caro: la profundidad comprimida dejaba la calle
plana, el personaje pequeño y la sensación de velocidad en nada.

Cuatro cosas van atadas a esa distancia, y si se toca una hay que revisar las
otras tres:

**1. El FOV según la forma de la pantalla.** Three.js fija el FOV *vertical* y
deriva el horizontal del aspecto, así que la misma cámara da imágenes muy
distintas en un móvil y en un monitor. Hay tope por los dos lados
(`_ajustarEncuadre`): en pantallas muy altas se abre para que los carriles
exteriores no se salgan, y en pantallas anchas se cierra para que 58 vertical
no se conviertan en 90 horizontales, que ya no es gran angular sino ojo de pez.

**2. El seguimiento lateral, de 0.18 a 0.5.** Con la cámara corta, un jugador
en el carril exterior (±2.4) se salía del borde en vertical. Siguiéndolo a la
mitad se queda descentrado pero dentro. La **mira acompaña al mismo ritmo**:
si siguiera menos, cada cambio de carril giraría el encuadre y la calle se
vería de lado.

**3. El reciclado de obstáculos, de 25 a 6.5.** Tiene que ser **menor que la Z
de la cámara**. Con 25, los obstáculos seguían vivos mucho después de pasar al
jugador y cruzaban el plano de la cámara; con la cámara larga y alta de antes
eso quedaba fuera de un encuadre estrecho, pero con la corta un retén se comía
la pantalla entera al adelantarlo. Papeles, estamina y potenciadores usan el
mismo umbral.

**4. Los perseguidores.** Ver abajo.

### Por qué los perseguidores no crecen al quedarse atrás

Van en Z positiva, entre la cámara y el jugador, y ahí lo más cercano a la
cámara se dibuja más grande — o sea que atar su Z a la distancia de juego los
haría **enormes cuando van lejos**, justo al revés de lo que hay que
comunicar. Por eso el rango de Z es estrecho y la escala lo compensa:

```
lejos:  0.72 / 4.44 = 0.162     ← mismo tamaño aparente
cerca:  0.95 / 5.99 = 0.159     ← en los dos extremos
jugador: 1.0 / 8.02 = 0.125     ← un tercio más pequeño que ellos
```

Lo que cambia al acercarse es **dónde están respecto al jugador**, no su
tamaño: suben en cuadro y el hueco se cierra.

Y van **pegados a un lado**, porque de frente tapaban al personaje entero. La
separación se calcula **en pantalla**, no en metros: lo que la perspectiva
convierte en píxeles es la razón `x / distancia_a_la_cámara`, así que se parte
de la razón del jugador y se le suma el hueco deseado. Con metros fijos, el
hueco se abría solo al acercarse y se cerraba justo al cambiar de carril, que
es cuando más falta hace que no se mueva.

---

## La portada: el menú es la escena

El menú **no es un menú**: es la escena de la entrevista corriendo en vivo. El
personaje está de pie con el micrófono en la mano, en la pose del arranque de
la cinemática, **y enfrente está el ministro**, porque una entrevista sin nadie
delante no es una entrevista: es alguien de pie con un micrófono. La cámara se
mece despacio alrededor. Al pulsar JUGAR se suelta la pose y el mismo
personaje, sin corte ni carga, echa a correr.

### La cinemática, y por qué corres

`src/game/Intro.js` la reparte en cinco fases: **entrevista → rescate → pared →
retroceso → caballito**. Estás preguntándole a un ministro de los acusados,
llegan los dos calle arriba y se lo llevan, y te quedas con el micrófono en
alto delante de nadie.

**La fase 3 es el chiste entero.** Podría acabar en el rescate y se entendería
igual de bien; lo que no se entendería es *por qué corres*. El segundo largo en
que sigues preguntándole a un sitio vacío es lo que convierte «me
interrumpieron» en «me dejaron hablando con la pared». Por eso la versión
abreviada —a partir de la tercera partida— la acorta pero **no la quita**.

Tres cosas que costaron, todas del mismo tipo: **las posiciones de la
cinemática no son las del juego**.

- Los perseguidores tienen su sitio calculado contra la cámara de carrera, que
  va *detrás* del periodista. La de la entrevista está de lado y algo por
  delante, y desde ahí ese sitio cae fuera de cuadro o encima del personaje.
  `SITIO_RESCATE` está calculado a mano contra `CAMARA_ENTREVISTA`; si se toca
  la cámara, hay que recalcularlo.
- **Alejarse en −Z empuja la figura hacia el borde derecho** desde esa cámara.
  La salida del rescate se hace casi toda en X para que los tres se vayan hacia
  dentro de la imagen y encogiendo, que es como se ve a alguien marcharse.
- Escribir `perseguidor.zVisualActual` desde la intro **no hace nada**: quien
  traslada esos campos a `modelo.position` es `Chaser._colocar()`, y ese método
  solo corre desde `actualizar()`, que en la cinemática no se llama. Hay que
  escribir `modelo.position` a mano (`_plantarPerseguidores`).

El ministro (`crearMinistro()` en `models/characters.js`) **no es un retrato**:
traje genérico, corbata roja y un pin de solapa que no dice de qué es.

En el estado `menu` el bucle sigue actualizando el escenario y renderizando;
lo único que cambia es que la cámara la lleva `Intro.encuadrarMenu()` en vez
de la lógica de partida. La cámara del menú **no es la de la cinemática**: allí
el plano es cerrado porque dura segundo y medio y hay que leer el gesto; aquí
el personaje convive con la interfaz, y a esa distancia le quedaban las piernas
detrás de los botones.

La interfaz se reparte en tres bandas: cabecera arriba, **hueco en el centro**
—vacío a propósito, es la ventana al 3D— y controles abajo. Dos cuidados que
cuestan encontrar:

- El degradado que oscurece la pantalla **se abre en la franja central** para
  que el personaje se lea nítido sobre el fondo.
- `.pantalla` lleva `backdrop-filter: blur(18px)`, así que en la portada hay
  que **anularlo**. Con el desenfoque puesto, la escena 3D se ve como una
  mancha de color y no como un personaje.

---

## Las cuatro escenas

> El lore completo —premisa, personajes, qué se documenta en cada escena y
> cómo termina cada trámite— está en **[docs/GUION.md](docs/GUION.md)**, que
> es la fuente de verdad. Este README explica cómo está construido; aquel,
> por qué existe cada pieza.

```
        ┌─── BAHÍA ───┐
        │  (Fiscalía) │
   ELECCIONES ──┼── APAGÓN
      (CNE)     │  (Asamblea)
        └─ CENTRO HISTÓRICO ┘
             (Carondelet)
```

Empiezas con una **cinemática**: estás entrevistando, la cámara se aleja,
aparecen los dos, el bajito se sube al grande y arranca la persecución. Se
salta con un toque y se abrevia a partir de la tercera partida.

**La bifurcación ocurre corriendo, no en un menú.** Al final de cada tramo la
calle termina contra una fachada con **tres bocas de túnel**, una por carril.
La boca por la que entres decide la temporada —como en Temple Run:

- **Izquierda / derecha** → la temporada vecina
- **Centro** → el **trámite**: la vía institucional

Son túneles y no ramales al aire libre por una razón de lectura: dos calles
que divergen en la niebla no tienen borde y a 200 metros son una mancha. Una
boca de túnel sí lo tiene, entrar en ella es un gesto inequívoco, y además
justifica el corte de escenario —dentro no se ve nada, y al salir estás en
otro sitio. En Carondelet la boca del centro está tapiada: es el cerco.

La señalización llega **muy por delante**. Tres pórticos de autopista a 230,
150 y 80 metros de la boca, más flechas en el asfalto, de modo que siempre
haya un cartel legible en cuadro mientras te colocas.

El corredor se vacía de obstáculos a los 140 metros, no antes: obligar a
esquivar mientras decides convierte una decisión en un accidente, pero vaciar
la pista desde el primer cartel dejaría 260 metros sin nada que hacer.

### Los entes de control (el túnel del centro)

Cada escena tiene el suyo: la Bahía lleva a la **Fiscalía**, el Apagón a la
**Asamblea**, las Elecciones al **CNE**, y el centro histórico a **Carondelet**,
que está cercado y donde ir de frente es estrellarse.

Entrar **no es un premio**. La institución te **riega los papeles**: al cruzar
la puerta **el marcador se pone a cero**, todos, y lo que llevabas recogido
queda desparramado por el pasillo. Hay que recuperar lo que se pueda mientras
corres. No hay obstáculos, porque el obstáculo es la propia institución.
Recuperarlo todo es prácticamente imposible y está calibrado para que lo sea.

#### Lo que recuperas vale ×2

`TRAMITE.MULTIPLICADOR_RESCATE`. Cada papel que levantas del suelo vuelve al
marcador **por dos**, y esa cifra decide si el tramo funciona:

| Recuperas | Vuelve al marcador | Contra los que entraste |
|---|---|---|
| ¼ del reguero | media entrada | pierdes la mitad |
| **½ del reguero** | **la entrada entera** | **empatas** |
| ¾ del reguero | vez y media | ganas |

Sin el ×2 el trámite era un castigo puro: entrabas con cuatrocientos, salías
con ciento veinte, y la única lectura posible era «no entres nunca». Un tramo
al que la respuesta correcta es evitarlo no es un tramo, es un error de diseño.
Con el multiplicador la cuenta cambia de signo sin dejar de doler —recuperar la
mitad del reguero ya es difícil— y lo que decide si ganas o pierdes pasa a ser
**cómo lo corres**, no si entraste.

Encaja además con lo que cuenta la escena: lo que sacas de una institución que
te tiró los papeles al suelo vale más que lo que traías, porque ya pasó por ahí
dentro.

El ×2 se anuncia en tres sitios —el aviso de entrada, el rótulo permanente del
expediente en el HUD y la pantalla de salida, donde va con su propio renglón en
vez de sumado en silencio—. Una bonificación que no se ve no cambia ninguna
decisión.

Al salir te dan con la puerta en las narices —se archiva el caso, faltan votos,
te quitan los derechos políticos— **pero sales con la pieza que te faltaba**.
Esa asimetría es lo que sostiene el modo historia:

- Para el **archivo** el trámite **rinde**: sales con el hallazgo.
- Para el **ranking** el trámite es **una apuesta**: entras con un montón, y
  sales con más o con menos según lo que hayas levantado del suelo.

Antes había una ruleta: un porcentaje, un giro y la suerte decidía. Funcionaba
como chiste una vez y como mecánica ninguna, porque el jugador solo miraba.

#### El hueco sin acciones

Al entrar y al salir **el juego se para** y aparece una pantalla que no pide
nada: dos o tres párrafos contando qué está pasando, el remate en voz de El
Mercio y un botón para seguir (`pantallas.relato`, estado `relato`).

Es la parte con más historia detrás y era la que menos se entendía. Entrabas
por el túnel del centro, se te caían los papeles y salías, todo en marcha, con
un aviso de dos líneas que se iba solo a los dos segundos y medio. Nadie leía
eso, y sin leerlo lo que queda es una fase rara en la que hay que recoger cosas
del suelo. Aquí no hay nada que esquivar ni nada que pulsar salvo seguir: es el
único momento en que se puede pedir atención sin quitársela a otra cosa.

**Y sale UNA sola vez por institución** (`cuaderno.institucionesContadas`). El
relato explica de qué va este sitio, y eso se explica una vez: a la quinta
visita a la Fiscalía, tres párrafos contando que pediste cita tres veces son
tres párrafos que ya se leyeron, y parar el juego para repetirlos deja de ser
un respiro y pasa a ser un peaje. A partir de la segunda se entra directo, con
la acusación de siempre —*se te cayeron los papeles, recógelos*— y se sale con
el portazo, los dos como aviso y sin parar nada.

Se marca **al salir, no al entrar**: si se marcara en la entrada, quien se
encuentra el trámite por primera vez leería el arranque y se quedaría sin el
remate.

Los textos están en `institucion.relatoEntrada` y `relatoSalida`, en segunda
persona y **sobre lo que te pasa a ti**: qué haces, qué te dicen, qué te
devuelven. Nunca una acusación concreta ni una frase entrecomillada de nadie.

Dentro del pasillo, además, **la cámara se ladea** despacio, como al entrar en
un túnel. Es lo mismo que hace la bifurcación al virar, y es lo que convierte
un tramo especial en un sitio distinto en vez de en más de lo mismo con otro
decorado. Va con balanceo y no con una inclinación fija porque una inclinación
fija se deja de percibir a los diez segundos —el ojo la adopta como nuevo
horizonte— y si es mayor, marea. Correr por encima de las tarimas lleva el
mismo ladeo, a media fuerza.

### El nivel de arriba

Como los trenes de Subway Surfers, hay una capa por encima del asfalto: las
**tarimas** de campaña, con su rampa de acceso. Se sube corriendo (el impulso
lo da la rampa, no hay que pulsar nada), arriba están los papeles que más
pagan, y cuando el tablado se acaba te caes. Bajarse a tiempo es la habilidad
que se pide.

Una tarima ocupa 20-35 metros seguidos, o sea varios grupos de obstáculos, así
que **reserva su carril** en el generador mientras dura. Sin esa reserva el
generador —que garantiza que todo grupo sea superable eligiendo un carril
solución— pondría un bloque sólido dentro de la madera.

### Cuando te alcanzan

Chocar y ver la pantalla de fin de partida en el mismo fotograma convierte la
derrota en un corte. Ahora la captura se **representa**: el mundo se para, el
dúo te cae encima, cinco policías cierran un círculo y la cámara retrocede
para que se vea. Solo entonces aparece la interfaz.

Y lo que aparece es el **sorteo del juez**: seis, y un selector que los
recorre. Cinco llevan la camiseta morada del oficialismo; uno no. Si paras en
el que no la lleva, sales con «medidas sustitutivas» y sigues corriendo en la
misma escena. Si caes en cualquier otro, la sentencia —prisión preventiva,
extradición, domiciliaria— se publica **en primera plana de El Mercio**.

No es una ruleta: el selector está a la vista, los jueces están a la vista, y
el resultado es exactamente lo que hiciste con el pulgar. **Cada captura
acelera el selector**, y no hay tope de intentos: siempre tienes tu
oportunidad, pero la oportunidad se encoge. Esa curva es la única progresión
del juego que va en tu contra, y es la que hace que la partida acabe.

### La portada del día siguiente

Perder no devuelve una pantalla de juego: devuelve **un periódico**. Mancheta,
antetítulo, titular —que es la sentencia—, bajada, y el resto de la página
maquetada como una portada de El Mercio.

**La foto del arresto es tuya.** Cuando el cerco está cerrado y la cámara ya ha
retrocedido, se captura el fotograma del juego y se imprime en la página en
blanco y negro, con trama de puntos encima. No es una ilustración: es el
instante exacto en que te agarraron, y cambia en cada partida.

> Se lee el lienzo con `toDataURL()` **en el mismo fotograma**, justo después
> de renderizar. Hacerlo de otro modo obligaría a activar
> `preserveDrawingBuffer`, que penaliza todas las partidas para una foto que se
> toma una vez.

**La única métrica grande son los papeles recogidos.** Metros, evidencia y
puntaje bajan a una línea pequeña de datos. Un periódico no da cinco titulares
del mismo tamaño, y si todo se mide, nada se mide.

No es el puntaje, y la diferencia importa: el puntaje suma papeles más metros
partido por diez, así que puntúa igual documentar que salir corriendo. Lo que
mide este juego es cuánta documentación sacaste antes de que te pararan; los
metros son el precio que pagaste, no el logro.

### El diario tiene dos páginas

Al perder no se llega a un panel de resultados: se llega a **la portada**, y de
ahí se **pasa de hoja** a la página de deportes. Un solo botón en la primera
—CONTINUAR— y las decisiones en la segunda.

Estaban las dos cosas juntas y no cabían: la portada quiere foto grande y una
cifra enorme, la tabla quiere filas. Con todo en una página había que hacer
scroll justo en el momento en que lo único que se quiere es volver a jugar.

| Página | Qué lleva | Botones |
|---|---|---|
| **1 · Portada** | Titular (la sentencia), foto del arresto, papeles recogidos | CONTINUAR |
| **2 · Deportes** | Las tres clasificaciones y lo que se acaba de desbloquear | Intentar de nuevo · Ver todo el diario · Menú |

Lo que **no** lleva la página de deportes es la cuenta atrás del siguiente
potenciador. Estaba, y no decía nada: en una página que cuenta lo que pasó, un
contador de algo que no ha pasado es ruido. Esa cuenta sigue en el menú, junto
a las casillas cerradas del arsenal, que es donde el número tiene a qué
referirse.

«Ver todo el diario» lleva al **Archivo**, que es el mismo ejemplar con tus
investigaciones.

### La tabla de posiciones

Maquetada como la de resultados de un diario: puesto, arroba y cifra alineada a
la derecha. Primero siempre `@paquimal`; después el hueco marcado con puntos
suspensivos si lo hay; y luego tú, entre tus dos vecinos.

**Tres clasificaciones, en pestañas**, porque un solo marcador premia una sola
forma de jugar y aquí hay tres que valen la pena:

| Pestaña | Qué mide | De dónde sale |
|---|---|---|
| **Más buscados** | Todo lo recogido, partida tras partida | `papelesHistoricos` |
| **Distancia** | Metros corridos desde la primera entrevista | `distanciaHistorica` |
| **Mejor corrida** | Papeles en una sola partida | `mejorPapeles` |

La primera **no es una tabla de puntos, es una circular de búsqueda**: mismo
número, leído desde el otro lado del escritorio. Se titula LOS MÁS BUSCADOS,
lleva antetítulo de circular y el puesto uno no dice «director» sino
«prioridad uno» (`antetitulo` y `notaLider` en `config/tabla.js`, ambos por
clasificación). Se imprime con filete grueso arriba y abajo del bloque del
título —`.plana--circular`— como los carteles de «se busca». Cambiar solo el
rótulo cambia entero lo que significa subir: no eres el que más junta, eres el
que más le estorba a alguien, que es de lo que va el juego.

Las dos primeras premian insistir; la tercera, una tarde inspirada. Con una
sola tabla, la mitad de los jugadores no tenía dónde salir. Al perder se abre
por **mejor corrida**, que es la que habla de la partida que se acaba de jugar;
desde el menú se recuerda la última que se miró.

Enseñar los diez de golpe obliga a hacer scroll dentro de una pantalla que ya
es larga, y el séptimo puesto no le importa a nadie: lo que dice algo es a
quién hay que alcanzar y quién te pisa los talones.

**MARCADORES**, desde el menú, es exactamente esta misma página sin los datos
de la partida. Tener dos tablas distintas era mantener dos maquetas para lo
mismo, y a la segunda ya no coincidían.

Son **datos de muestra** —`config/tabla.js`— y el pie de la tabla lo dice. No
hay servidor detrás y no se pretende que lo parezca; cuando lo haya, lo único
que cambia es de dónde sale la lista. Los arrobas son **inventados** salvo el
de la casa: meter cuentas reales de terceros en el marcador de un juego
satírico, aunque sea de mentira, es ponerles palabras en la boca por otra vía.

### La plantilla

Cuatro personajes jugables, **los cuatro de la redacción de El Mercio**. Dos
salen de fábrica y dos se fichan (`config/personajes.js`):

| | Quién | Sección | Se ficha a los |
|---|---|---|---|
| 🎩 | **Chochólogo** — sombrero, gafas y treinta años de oficio | Política | — |
| 🪕 | **Alondra** — rizos, ukulele y todavía cree que esto sirve | Sociedad | — |
| 🎖️ | **Buscán** — boina y traje. Pregunta como si ya supiera | Investigación | 8 tramos |
| 🛡️ | **Blanki** — casco de espartana. No se aparta | Calle | 18 tramos |

La **sección** va impresa debajo del nombre en la ficha del menú, y es una
palabra que hace todo el trabajo del lore: cuatro fichas que ponen Política,
Sociedad, Investigación y Calle no se leen como cuatro skins, se leen como una
redacción. Sin eso, que todos trabajaran para El Mercio era algo que solo sabía
el código.

Están basados en **periodistas incómodos para el gobierno**, y dos llevan el
guiño en el nombre: Buscán por Andersson Boscán y Blanki por Blanca Moncada.
**El desvío es el chiste** —que se reconozca y a la vez no sea exactamente— y
por eso el guiño **no se explica en pantalla**: explicado deja de ser un guiño y
pasa a ser una atribución.

Lo que toman prestado es el oficio y la terquedad. Lo que no: sus casos, sus
medios y sus frases. No se les pone nada en la boca ni se les atribuye nada que
no hayan hecho — un guiño es un nombre parecido y una manera de trabajar, y
todo lo que vaya más allá ya es hablar por ellos. Además salen bien parados:
aquí los periodistas son los protagonistas, y la satirizada es la oficina que
se los quita de encima. El razonamiento largo está en la cabecera de
`config/personajes.js` y en `docs/GUION.md`.

**Se desbloquean por tramos, no por papeles**, y eso es una decisión: los
papeles son la moneda del Archivo, que es la meta del juego. Meterle un segundo
sumidero le quita fuerza al primero y obliga a elegir entre un reportaje y un
sombrero. Los tramos solo se acumulan, así que ahí cabe otra recompensa sin
quitarle nada a ninguna.

Los umbrales (8 y 18) **se intercalan** con los de los potenciadores (3, 6, 10,
15, 22), para que ningún hito reparta dos cosas a la vez y luego cuatro no
repartan nada.

Los bloqueados **se enseñan igual** en el menú, apagados y con lo que falta
escrito debajo: un personaje que no sabías que existía no tira de ti. Y el
`personajePreferido` del cuaderno se filtra contra lo desbloqueado al leerlo —
borrar el progreso pone los tramos a cero pero deja el preferido guardado, y sin
ese filtro se jugaría con alguien a quien no se ha fichado.

**Lo que hace reconocible a cada uno es la silueta de espaldas**, que es como se
le ve el 99% del tiempo: la boina ladeada con su rabillo, el casco con cresta
transversal y el escudo redondo. El detalle de la cara no lo ve nadie.

### Potenciadores

Los de Subway Surfers, traducidos a la redacción de un periódico. La mecánica
no se inventa; lo que sí es una decisión es que **no estén desde el principio**:

| | Potenciador | Qué hace | Se abre a los |
|---|---|---|---|
| 🧲 | **Fuente anónima** | Los papeles vienen solos | 3 tramos |
| ×2 | **Portada** | Todo vale el doble | 6 tramos |
| 👢 | **Botas de campo** | Saltas más alto | 10 tramos |
| 📄 | **Salvoconducto** | Aguanta un golpe | 15 tramos |
| 🚁 | **Cobertura aérea** | Sobrevuelas el tramo recogiéndolo todo | 22 tramos |
| 🔦 | **Linterna** | Se ve la calle | siempre, **solo en el Apagón** |

Un juego que te lo enseña todo en la primera partida no da ninguna razón para
jugar la segunda. El contador de tramos es **acumulativo entre partidas**, así
que ninguna corrida se pierde del todo: hasta la peor te acerca al siguiente
desbloqueo, y el menú te dice cuánto falta.

La escalera se calcula desde el catálogo, no se guarda. Si mañana se cambia un
umbral en `config/balance.js`, el progreso de todo el mundo se recalcula solo
en vez de quedarse congelado con la escalera vieja.

**La linterna es aparte**: lleva `soloEn: 'apagon'` y no se desbloquea nunca,
porque en esa escena no es un extra —es la diferencia entre ver la calle y
adivinarla— y hacerla esperar a los tres tramos sería cerrarle el escenario a
quien acaba de llegar. En las otras tres no sale, porque ahí hay luz. El
filtrado por escena lo hace `PowerUpManager.establecerEscenario`; el progreso
sigue siendo cosa del cuaderno.

**Ya no hay comida.** El encebollado, la guata, el bolón y el canelazo se
fueron con la barra de aguante: sin barra eran un bonus suelto que sumaba
papeles y nada más —ni drenaba, ni había medidor, ni pasaba nada por
ignorarlos— y lo único que hacían era competir por el hueco del grupo con los
potenciadores, que sí cambian cómo se juega. Los modelos siguen en el historial
de git. De todo aquello sobrevive la linterna, que dejó de ser comida para ser
el potenciador del Apagón.

### Continuidad

La partida siguiente arranca **en la temporada donde te capturaron**, no
siempre en la Bahía. Volver al principio cada vez convertía cada muerte en un
reinicio del relato en lugar de en un capítulo.

| Escena | Caso | Ente de control |
|---|---|---|
| **La Bahía** | Porsche | Fiscalía |
| **El Apagón** | Progen | Asamblea Nacional |
| **Las Elecciones** | Elecciones | CNE |
| **Centro histórico** | Estado de excepción | — (cercado) |

Los obstáculos también cambian de piel: puestos de ropa y militares en la
Bahía, tuberías y generadores en la central térmica, rejas y antimotines en el
centro histórico, vallas de campaña y cartones del candidato en las
elecciones. La **silueta** no cambia —lo que se salta se sigue leyendo bajo y
ancho— porque el jugador tiene medio segundo para leerla y ese medio segundo
lo compra la silueta. Lo que cambia es lo que va encima.

**Apagón** tiene mecánica propia: la pantalla se oscurece y el potenciador
linterna abre la visión mientras dura. El radio visible escala con la velocidad
para que siempre tengas al menos un segundo de reacción — si fuera un valor
fijo, a velocidad máxima los obstáculos aparecerían ya encima. El tramo arranca
**con la linterna encendida**: entrar a oscuras y esperar a que el generador
suelte la primera cápsula no era difícil, era injugable.

**Y cuando se apaga, los papeles alumbran.** En esta escena —y solo en esta— el
papel sube su emisión y deja de teñirse con la niebla, así que la hilera se ve
entera a través del negro y dibuja la ruta. Es una sola escritura sobre el
material compartido por las tres mil piezas de la pista
(`ajustarBrilloPapel`), no tres mil.

Eso es lo que permitió que quedarse sin luz **deje de matar**. Mataba cuando la
linterna era un consumible sembrado cada 150 metros; ahora que es un
potenciador que puede no salir, morir por no haberlo encontrado sería perder
por mala suerte y no por mal juego. Sin luz sigues sin ver la calle —eso lo
paga la linterna— pero ves por dónde va.

**El centro histórico** es deliberadamente árido: máximo 3 papeles por tramo.
La carestía es el mensaje.

### La luz: solo hay un escenario oscuro

Las cuatro empezaron siendo nocturnas y eso le quitaba el sentido al Apagón:
si vienes de una calle en penumbra y entras en otra penumbra, quedarse sin luz
no es un acontecimiento. Ahora cada una tiene su hora del día:

| Escena | Hora | `intensidadAmbiente` |
|---|---|---|
| La Bahía | Mediodía nublado | 1.35 |
| Las Elecciones | Tarde de cierre de campaña | 1.30 |
| Centro histórico | Amanecer con el cerco puesto | 1.15 |
| **El Apagón** | Sin red eléctrica | **0.24** |

Entrar al Apagón divide la luz por cinco. Antes iba de 0.75 a 0.28 —menos de
la mitad— y no bastaba: el apagón se nota contra la luz, no contra otra
penumbra.

### La Bahía es un pasaje techado, no una calle con tiendas

Es una **calle cubierta de punta a punta**: una bóveda traslúcida que cruza el
ancho entero, con las hileras de puestos debajo. El techo es lo que define el
sector, y es también lo que más cambia la sensación de correr, porque pone algo
por encima de la cabeza del jugador y lo hace pasar de largo.

**La bóveda la monta la escena** (`BahiaScene`), en segmentos reciclables, no
el decorado lateral: puesta a los lados serían dos medias bóvedas que se
reciclan por su cuenta y no casan por el eje de la calle. Es un arco de
circunferencia con el centro **bajo el suelo** —con el centro a ras el arranque
sería vertical y quedaría un tubo— y se **recorta contra la fachada** de la
bifurcación (`escenario.zTope`, que pone `Game`): sin ese recorte el techo la
atraviesa y las cerchas salen por el otro lado.

**Los puestos** (`crearDecorado`, caso `bahia`) van en hileras de tres pegados,
con toldo a rayas, persiana metálica, rótulo pintado y el género —ropa colgada
o mercadería apilada— saliendo por delante de la persiana. Lo que hace que se
lea como comercio informal no es el local: es que la mercadería no cabe dentro.

Dos cosas más que costó afinar:

- **La hilera va alineada.** El resto del decorado se coloca con desviación
  lateral y escala al azar para que la ciudad no se repita; con eso puesto, una
  fila de mercado no se lee como desorden sino como fallo de colocación. Por
  eso el elemento puede pedir alineación (`userData.alineado`) y la escena la
  respeta, tanto al montar como al reciclar.
- **La ropa y la mercadería son textura, no geometría.** A los seis metros que
  hay del carril a la vereda, una percha modelada y una percha pintada se ven
  igual, y la pintada cuesta una malla en vez de veinte. Van **tres variantes**
  de cada una: con una sola, dos puestos seguidos enseñaban exactamente la
  misma pila de cajas —el mismo azar congelado en la caché de texturas— y la
  hilera se leía como un mosaico repetido.

**Las palmeras están en las Elecciones, no aquí.** Dentro de un mercado techado
no crece una palmera, y si asomaba por encima del techo lo que decía era que no
había techo. Elecciones es la escena de calle abierta, así que es donde toca el
arbolado.

---

## Modo offline y actualizaciones

La primera visita descarga el juego entero; a partir de ahí arranca **sin
tocar la red** (comprobado: la segunda carga hace cero peticiones al
servidor). Three.js va en su propio chunk a propósito: el precache de Workbox
indexa por hash de contenido, así que si la librería estuviera dentro del
bundle del juego, cada cambio de una línea de gameplay obligaría a volver a
bajar sus 485 KB. Separada, una actualización pesa unos pocos KB.

Lo contrario también hace falta: que un despliegue **llegue**. Dos decisiones
lo resuelven, y las dos costaron encontrarlas:

1. **El registro del service worker es a mano**, no del plugin, porque hace
   falta `updateViaCache: 'none'`. Sin esa opción el navegador sirve `sw.js`
   desde su caché HTTP y `update()` ni siquiera llega a pedirlo — verificado
   con el service worker real: la petición no sale y el despliegue puede
   tardar hasta 24 horas en verse.
2. **La versión nueva no entra en mitad de una corrida.** Recargar mientras
   alguien juega le borra la partida por un motivo que no tiene nada que ver
   con el juego. Se avisa por el HUD y se aplica en el primer momento seguro:
   menú o fin de partida.

El menú lleva un **panel de edición**: versión, sello de compilación, si el
juego ya está guardado para jugar sin conexión, y un botón para comprobar. Un
modo offline que no se puede consultar es indistinguible de un juego congelado
en una versión vieja.

Cuándo entra una edición nueva: **nunca jugando**, **sola al terminar la
partida** (el jugador ya iba a reiniciar) y **cuando él quiera desde el menú**
—ahí no se aplica sola, porque provocaba una recarga sorpresa a los dos
segundos de abrir el juego.

Ver `src/utils/actualizacion.js`.

---

## Sobre los modelos 3D

Los personajes y los props son **procedurales**: se construyen con primitivas de
Three.js en `src/models/`, no se cargan de archivos. El juego entero pesa poco
más de medio mega, no hay descargas que puedan fallar y la estética low-poly
encaja con el resto.

Pero procedural no significa cerrado. Hay un **camino de ida y vuelta con
Blender** para cualquiera que no quiera tocar JavaScript.

### El taller: `/creador/`

Seis herramientas con menú compartido, así que da igual por cuál entres:

| Herramienta | Ruta | Para qué |
|---|---|---|
| Portal | `/creador/` | Índice de todo |
| **Exportador** | `/creador/exportador/` | **Bajar piezas del juego a `.glb`** |
| Escenas | `/creador/mapas/` | Editor de escenas *(en desarrollo)* |
| Niveles | `/creador/niveles/` | Configurador *(en desarrollo)* |
| Personajes | `/creador/personajes/` | Visor de personajes |
| Design System | `/creador/ui/` | Tokens de diseño |
| Sandbox | `/creador/pruebas/` | Pruebas de juego |

Se abren con `npm run dev` en `http://localhost:5174/creador/`, y en producción
cuelgan de la misma URL del juego.

### Editar una pieza en Blender

1. Abre **`/creador/exportador/`**. Ahí están todas las piezas del juego
   agrupadas —46 en total—: personajes, cuadras de decorado, obstáculos (los
   genéricos y los **vestidos por escenario**), recolectables, los **edificios
   del modelo de Quito**, potenciadores y elementos de escena. Cada una se
   previsualiza con sus medidas reales en metros.
2. **Descargar `.glb`** (o *Descargar todo*, que baja el catálogo entero).
   El visor se orbita arrastrando con el ratón y se acerca con la rueda; el
   botón *Reencuadrar* vuelve a la vista de partida.
3. En Blender: *File ▸ Import ▸ glTF 2.0*, retocas, y *File ▸ Export ▸ glTF 2.0
   (.glb)*.
4. Deja el archivo en **`public/modelos/piezas/`** con el mismo nombre.

A partir de ahí el juego usa el archivo. Si no está, usa el procedural. **No hay
que tocar código ni registrar nada**: la comprobación se hace al arrancar, y una
pieza que no existe simplemente no sustituye a nada.

Qué piezas admiten sustitución está en `PIEZAS_SUSTITUIBLES`
(`src/models/hitos.js`). Añadir una es meterla en esa lista y hacer que su
generador pregunte por `piezaEditada(id)` antes de construir.

> **El exportador exporta lo que corre.** Vive dentro del build de Vite y no en
> `public/`, así que importa los mismos generadores y la misma versión de Three
> que el juego. Una versión anterior vivía suelta en `public/`, tiraba de un CDN
> con Three r128 —el juego va por r184— y exportaba unos cubos de demostración:
> lo que bajabas no era la pieza del juego, era otra cosa parecida.

### Dos avisos que ahorran un rato

**Los personajes importados no se animan.** `animarCarrera()` mueve los miembros
buscándolos por nombre, y desde que los miembros son articulados la lista es más
larga: `brazoDer` → `antebrazoDer` → `manoDer`, `piernaDer` → `pantorrillaDer` →
`pieDer`, y sus dos gemelos del otro lado, más `torso`, `cadera`, `cuello`,
`cabeza` y el grupo `cuerpo` que los contiene a todos. Si el `.glb` no los trae
con esos nombres, el personaje corre quieto —y sin `cuerpo` tampoco da la
voltereta al agacharse—. O mantienes los nombres en Blender, o adaptas
`animarCarrera()` a las animaciones del archivo. El árbol entero está en
`docs/ASSET-EXPORT-GUIDE.md`.

**Cuidado con el número de piezas.** El coste en móvil no son los triángulos,
son las llamadas de dibujo. Una cuadra colonial son cuarenta y cinco piezas y en
pantalla hay más de treinta casas: sin fundir, eran 597 llamadas y 125 ms por
fotograma; fundidas por material, 451 llamadas y 110 ms —con MÁS triángulos—.
Si traes una pieza muy despiezada de Blender, júntala por material antes de
exportar (en Blender, *Join* por color).

### Edificios reconocibles

Aparte de las piezas sustituibles, hay **hitos**: los edificios que el jugador
tiene que reconocer, modelados y no generados, en `public/modelos/quito.glb`. Se
cargan una vez en la pantalla de carga y cada escena clona el suyo:

| Escenario | Hito |
|---|---|
| Carondelet | Palacio de Carondelet |
| El Apagón | Central térmica |
| La Bahía | Fiscalía General del Estado |
| Las Elecciones | *(ninguno: el CNE no está modelado)* |

Una casa colonial genérica se genera con cajas y queda bien; un edificio que hay
que **reconocer**, no. Por eso el decorado sigue siendo procedural y solo los
hitos vienen de archivo.

Pasan cada 300 metros —unos diez segundos a velocidad de crucero— y a once
metros del eje, por encima de los tejados. Los primeros números fueron 620 y 16:
con la niebla tapando el 94 % a los cien metros, el edificio se pasaba veinte
segundos invisible y asomaba tres, y encima quedaba detrás de la fila de casas.
En la práctica no se veía nunca.

### Los obstáculos ya cambian por escenario

No hay que hacerlos: `vestirObstaculo()` (en `src/models/props.js`) le pone a
cada silueta las piezas de su barrio. En la Bahía, cajas de mercadería y ropa
tendida; en el centro histórico, reja y concertina; en la central, tubería
reventada. La regla que no se rompe es que **la silueta base no se toca**: lo
que se salta se sigue leyendo bajo y ancho y lo que se esquiva sigue siendo un
bloque macizo, porque el jugador tiene medio segundo para leerlo y ese medio
segundo lo compra la silueta, no el adorno.

Se ven todos juntos en el exportador, en el grupo *Obstáculos vestidos por
escenario*.

Para binarios pesados está `src/utils/assetCache.js`: un envoltorio de IndexedDB
que descarga una vez y sirve desde local. El Service Worker no es buen sitio
para archivos grandes porque su caché se invalida en cada despliegue; IndexedDB
los conserva entre versiones.

```js
const cache = new AssetCache();
await cache.abrir();
const buffer = await cache.obtenerOBajar('pieza.glb', '/modelos/pieza.glb');
```

---

## El Archivo: el periódico que armas

El Archivo no es una lista de premios: es **un ejemplar de El Mercio que el
jugador monta página a página**. Cada página cuesta papeles y trae reportajes
**reales**, publicados de verdad, con su firma y su enlace.

Rompe a propósito con la estética del resto del juego —papel crema y
tipografía con remates, en vez de neón sobre negro—. Es lo único que no es
sátira, y el cambio de piel lo dice sin explicarlo.

Cinco páginas: Portada (gratis), Energía (150), Política (300), Derechos (500)
y Seguimiento (800).

⚠️ **Hay que rellenarlo.** Los diez artículos vienen marcados
`pendiente: true` y sin titular. No inventé ninguno: un reportaje falso con
pinta de real es exactamente lo que este juego critica, y bastaría una captura
para que circulara como si El Mercio lo hubiera publicado.

Mientras un artículo siga pendiente, el periódico **reserva su espacio** con el
tema y un sello — igual que un diario que guarda hueco para una pieza que aún
no cierra. Para cargar una real, en `src/config/publicaciones.js`:

1. Pon `pendiente: false`
2. Rellena `titular`, `bajada`, `autoria`, `fecha` y `url`
3. Si es la pieza principal de su página, déjale `destacado: true`

En desarrollo puedes probar un titular sin comitearlo:

```js
Object.assign(__paginas[0].articulos[0], {
  pendiente: false, titular: '…', bajada: '…', url: '…',
})
```

Regla de la casa: si no tiene enlace comprobable, no entra.

### Los expedientes

Para documentarse antes de escribir cada pieza están los expedientes de
`docs/CASOS/`: cronología del caso y enlaces a **la prensa que lo cubrió**.

- [Caso Porsche](docs/CASOS/PORSCHE.md) — la escena de La Bahía

No son reportajes de El Mercio ni pueden entrar en `publicaciones.js`: son
enlaces a terceros, y llevan marcado qué está confirmado y qué no.

---

## Sobre los textos

**Aquí no hay citas atribuidas a personas reales, y es a propósito.**

El brief original pedía cerrar cada partida con "una cita real del caso". Una
frase entrecomillada con nombre y apellido que en realidad escribimos nosotros
deja de ser sátira y pasa a ser una cita falsa: se captura en pantalla, circula
sin el juego alrededor y ya no hay forma de explicar que era un chiste.

Lo que hacemos —y es lo que hace un diario satírico— es rematar en **voz propia
de El Mercio**: el narrador comenta, ironiza y describe. La sátira queda
intacta; la responsabilidad, también.

Si el equipo quiere citas textuales reales, el sitio es `CITAS_VERIFICADAS` en
`src/config/textos.js`. Van con autor, fuente, fecha y quién las verificó
contra el registro original. El array viene vacío y el juego funciona
perfectamente así; en cuanto se llene, las citas aparecen automáticamente en la
pantalla de fin de partida junto al remate.

Regla de la casa: si no tiene fuente y fecha comprobables, no entra.

---

## Despliegue

> ## ⚠️ PASO OBLIGATORIO, UNA SOLA VEZ
>
> En GitHub: **Settings → Pages → Source → `GitHub Actions`**
>
> Si está en *"Deploy from a branch"*, GitHub publica el **repositorio en
> crudo** en lugar del build. El `index.html` de la raíz apunta a
> `/src/main.js`, que sin compilar no existe, y como el CSS se importa desde
> el JS **no carga nada: pantalla en blanco.**
>
> Se reconoce porque en la pestaña Actions aparece un workflow llamado
> *"pages build and deployment"* que nadie escribió: ese es el desplegador
> antiguo, y solo corre en modo rama.

Hecho eso, cada push a `main` compila y publica automáticamente
(`.github/workflows/deploy.yml`).

La base del build sale de `vite.config.js`: en GitHub Actions es
`/estadodecepcion/` y en local `/`. Si el repositorio cambia de nombre, hay que
actualizarla ahí.

### Si aparece la pantalla en blanco

`index.html` lleva una red de seguridad: si el juego no arranca en 8 segundos,
sustituye el blanco por una pantalla que explica qué pasó. Si dice *"El
servidor está publicando el código fuente"*, es exactamente el caso de arriba.

El despliegue puede tardar: una vez el job de publicación estuvo **48 minutos**
en cola por congestión de GitHub, con el build ya terminado. Eso no es un
fallo; se ve en Actions si el job "Desplegar" está en `queued`.

La base del build sale de `vite.config.js`: en GitHub Actions es
`/estadodecepcion/` y en local `/`. Si el repositorio cambia de nombre, hay que
actualizarla ahí.

---

## Estilo visual

El lenguaje visual está documentado en **[docs/ESTILO.md](docs/ESTILO.md)** y
los valores viven en `src/config/estilo.js`. Léelo antes de añadir pantallas,
iconos o props.

### Todas las pantallas son secciones del periódico

Había dos mundos y no debía haberlos: el juego y sus menús iban de neón sobre
negro, y el papel crema salía solo en el Archivo y en la primera plana del
final. Eso dejaba al periódico como una pantalla más y obligaba a mantener dos
sistemas de estilo para las mismas cuatro cosas.

Ahora todo lo que no es correr sale impreso, con la mancheta de El Mercio y su
rótulo de sección. La maqueta la reparte un solo ayudante, `seccionDiario()` en
`src/ui/screens.js`:

| Método | Sección | Titular |
|---|---|---|
| `ajustes()` | ADMINISTRACIÓN | LA REDACCIÓN |
| `pausa()` | CIERRE DE EDICIÓN | RESPIRA |
| `relato()` | CONTEXTO | *el ente de control* |
| `escape()` | JUDICIALES | LE TOCA UN JUEZ |
| `victoria()` | PORTADA | PROSPERÓ |
| `gameOver()` | *la fecha* | *el titular de tu caída* |
| `deportes()` | DEPORTES | LOS MÁS BUSCADOS |

La única que no va impresa es el **menú**, porque es la ventana por la que se
ve la escena.

Al portarlas hay cuatro cosas que costaron y conviene no repetir:

- **El cuerpo cuelga de `plana`; los botones, de `contenido`.** Un botón
  dibujado encima de la hoja se lee como un anuncio y el ojo lo salta.
- **Los componentes se reimprimen, no se migran.** `.instruccion`, `.edicion`,
  `.remate`, `.estadistica`, `.juez`, `.resultado` y `.ruta` siguen saliendo en
  negro dentro del juego, así que su versión de papel vive en un bloque
  `.plana .loQueSea` al final de `style.css`. La regla es siempre la misma:
  tinta en vez de luz, filete en vez de resplandor.
- **El tinte de pantalla hay que repetirlo.** `.pantalla--plana` está declarada
  *después* que `.pantalla--cerco` y compañía, así que con la misma
  especificidad ganaba el negro liso y el cerco perdía su rojo. Están duplicadas
  como `.pantalla--plana.pantalla--cerco` para que el tinte siga siendo el fondo
  sobre el que se apoya la hoja.
- **Los iconos del sorteo del juez no se pasan a gris.** Es la única excepción a
  la maqueta impresa y no es negociable: el juez limpio se distingue de los otros
  cinco *por el color de la camiseta*, y en gris los seis son la misma silueta y
  el juego deja de tener solución.

### La racha y las chispas

`src/game/Particulas.js` y `RACHA` en `config/balance.js`.

**La racha no toca el marcador, y es a propósito.** Los papeles son el trabajo
hecho y no se inflan por ir seguidos. Lo que da la racha es **color**: el
estallido de cada papel y la estela del corredor suben de tono, y aparece una
ficha en el HUD. Recompensa de la que se ve, no de la que se cuenta — por eso
puede escalar cuanto quiera sin desequilibrar nada.

Cuatro escalones, pocos y anchos (0 / 6 / 14 / 26): con un color por papel nadie
distingue nada. El primero está en 6 porque encadenar cinco es lo normal sin
proponérselo, y el color tiene que empezar donde empieza el mérito.

El sistema de partículas es **un solo `THREE.Points`** con un pozo fijo —420
partículas en calidad alta, 220 en media, ninguna en baja—. Todos los efectos
del juego salen de ahí, así que el conjunto cuesta exactamente una llamada de
dibujo. Cuatro cosas que costaron encontrar:

- **Mezcla normal, no aditiva.** En aditivo las chispas brillan sobre el asfalto
  del Apagón y son *literalmente invisibles* en la Bahía: sumar luz a un fondo
  casi blanco no cambia el píxel, y tres de los cuatro escenarios van de día. El
  brillo lo pone el bloom, que ya estaba puesto. El desvanecido va por alfa en
  su propio atributo, para que el color se quede por encima del umbral de
  floración hasta el final.
- **Hay que matar las partículas que pasan la cámara.** Un punto detrás del
  observador proyecta a coordenadas sin sentido y, como el tamaño se divide por
  la distancia, se dispara a miles de píxeles: salían cuadrados blancos enormes
  flotando en mitad de la calle. Se apagan al cruzar `zLimite` y el shader lleva
  además una guarda de profundidad.
- **La estela hay que emitirla a la altura de la cintura, no de los pies.** Con
  la cámara a cuatro metros de alto, el borde inferior del cuadro corta el
  asfalto a dos metros por detrás del corredor: todo lo que sale pegado al suelo
  desaparece en una décima de segundo. Es la misma cuenta que dicta las
  cantidades de `RACHA.TRAMOS` —la ventana visible es de unas dos décimas, así
  que hacen falta cientos de chispas por segundo para que se lea como una cola.
- **`frustumCulled = false`.** Las posiciones se escriben a mano y la caja
  envolvente no se recalcula nunca; con el descarte puesto, el sistema entero
  desaparecía en cuanto la caja original salía de cámara.

Volando el chorro va **hacia abajo** y sale siempre, con racha o sin ella: ahí
no es premio, es la información de que estás sostenido en el aire y no saltando.

### Ninguna pantalla hace scroll

**Regla dura**: cada pantalla cabe entera en un móvil. Si no cabe, se parte en
dos —eso es lo que llevó a separar la portada de la página de deportes— o se
recorta, no se deja que aparezca la barra.

Se comprueba midiendo `scrollHeight - clientHeight` de `.pantalla` en cada
una. Dos cosas que engañan al medir:

- **Hay que esperar a que termine la cascada de entrada.** Mientras dura, los
  elementos vienen desplazados hacia abajo y el navegador cuenta ese
  desplazamiento en el área desbordable.
- **Las animaciones infinitas de escala también cuentan.** El latido de la
  cifra grande crea desborde real mientras está en su punto máximo, y por eso
  es de dos puntos porcentuales y no de tres y medio.

### Microinteracciones

Sin ellas la interfaz es correcta y está muerta. Lo que hay, y por qué:

| Dónde | Qué hace | Por qué |
|---|---|---|
| Toda pantalla | Entra **en cascada**, 40 ms por pieza | Todo a la vez se lee como una diapositiva; escalonado se lee como algo que se monta delante de ti |
| Cifra de papeles | **Cuenta desde cero** | Un número que aparece puesto es un dato; uno que sube es un premio |
| Sello de récord | **Cae** girado y de más tamaño, tras la cuenta | Primero se lee el número, luego llega la palmadita |
| Botón principal | **Brillo** que lo cruza cada pocos segundos | En una pantalla quieta, lo único que se mueve es lo que hay que pulsar |
| JUGAR | Late con el **resplandor**, no con la escala | Un botón que cambia de tamaño es un blanco que se mueve |
| Al pulsar | Se hunde y **rebota** al soltar | La curva elástica está en la transición, no en el `:active` |
| Contador del HUD | **«+3»** que sale y sube | Es la recompensa más pequeña y la que más veces ocurre; dice cuánto, y lo dice donde pasa |
| Tu fila en la tabla | Pulsa dos veces al entrar | Es la fila que se está buscando |

Todo respeta `prefers-reduced-motion`. No es un adorno accesible: para parte de
la gente esto es mareo, no dopamina.

La regla que las gobierna: **acompañan, no retienen**. Quien acaba de perder
quiere volver a jugar, así que nada de esto puede tardar lo bastante como para
estorbar.

Lo esencial: **el color es semántico, nunca decorativo.** Verde eres tú, dorado
es lo que recoges, rojo es el peligro, cian es información, naranja es
evidencia. Si algo nuevo no encaja en esos cinco significados, va en gris.

Los iconos son SVG inline (`src/ui/iconos.js`): cero peticiones de red, escalan
sin pixelarse y el juego arranca sin conexión.

### Lo que el HUD dejó de decir

**No hay barra del perseguidor.** La había —«TE SIGUEN», con su medidor— y
sobraba: los perseguidores están en pantalla, corriendo, con el hueco
cerrándose. Medir en una barra lo que ya se ve es pedirle al jugador que aparte
la vista del carril para enterarse de algo que tenía delante. Lo que sí se
queda es el **tinte rojo de los bordes** por encima del 65% de cercanía, que no
se lee: se percibe.

**No hay barra de aguante**, porque no hay aguante. Se fue con la comida.

**El cartel de la bifurcación está en el HUD, no en la calle.** Antes eran tres
pórticos modelados sobre la vía, a 230, 150 y 80 metros. El problema no era que
estuvieran: era dónde. Un cartel dentro del mundo se ve en escorzo, se cruza en
segundo y medio y hay que levantar la vista del carril para leerlo justo cuando
todavía se está esquivando. Ahora es señalización de autopista —panel verde por
vía, flecha y pestaña de salida— que **baja desde el techo de la pantalla**, se
queda quieta mientras dura la decisión y se sube al cruzar. Lo que sigue en el
mundo son las flechas del asfalto, que están donde ya se está mirando.

**Los avisos van centrados y arriba.** Centrados porque a un costado —donde
estaban, junto a la barra del perseguidor— no los leía nadie: la vista está en
el carril. Y arriba porque al 38% de la pantalla caían justo sobre el punto de
fuga, que es el trozo de calle donde aparecen los obstáculos que aún da tiempo a
esquivar: un aviso ahí obliga a esquivar a ciegas y añade una dificultad que no
es la del juego. Ahora se pegan debajo de la fila superior, se apartan hacia
abajo mientras el cartel de salida está puesto —comparten banda, y el aviso de
«ELIGE TÚNEL» sale en el mismo fotograma que él— y vuelven solos.

**El potenciador activo se ve.** Pastilla cuadrada grande abajo a la izquierda
con el icono, y debajo una **batería de ocho casillas** que se van apagando; las
dos últimas parpadean. Estaba arriba, pequeño y con una barrita fina, y un
potenciador que no se nota es un potenciador que no se disfruta: la mitad de la
gracia de recogerlo es ver que lo llevas puesto.

La batería se escribe **ocho veces en toda la duración**, no sesenta por
segundo: solo cuando cambia el número de casillas encendidas. Y se lee de reojo
—se cuentan casillas— en vez de medir el ancho de una barra.

### El choque, en clave de dibujo animado

Chocar solo restaba un intento y sacudía la cámara: el personaje seguía
corriendo con la misma zancada, tan campante, y del golpe se enteraba el HUD
antes que el cuerpo.

Ahora hace lo de siempre en animación —**squash and stretch**—: se aplasta
contra lo que se llevó por delante (ancho y alto de más, profundidad de menos)
y vuelve a su forma con un rebote elástico que se pasa de largo antes de
asentarse, dando una vuelta entera sobre sí mismo. Dura 0.42 s; más que eso
deja de ser un golpe y pasa a ser una animación que hay que esperar.

El **parpadeo de invulnerabilidad no empieza hasta que el aplastón termina**.
Los dos arrancaban en el mismo fotograma, así que la voltereta se veía a
medias: seis fotogramas sí y seis no, que es como no verla.

Y al ser capturado el personaje **cae boca abajo, despatarrado**. Antes se
quedaba de pie y se doblaba por la cintura, y era la diferencia entre «se
cansó» y «lo tumbaron». De ese fotograma sale la foto de la portada, así que el
plano del cerco se bajó y se acercó —un cuerpo tumbado se lee picado, no a su
misma altura— y los perseguidores se apartan más, porque dos figuras de pie a
metro y medio tapan un cuerpo en el suelo entero.

> Ojo con `Player.actualizar`: sale antes si `vivo` es false. Sin esa salida, el
> fotograma siguiente a la caída deshacía la pose —la gravedad veía el cuerpo a
> 26 cm del asfalto y lo hacía «caer» hasta cero, y `animarCarrera()` le
> devolvía la zancada—, así que el personaje se levantaba solo a correr en la
> pantalla de escape, tumbado boca abajo pero moviendo las piernas.

---

## Rendimiento

Presupuesto: **~230 draw calls** y ~2 700 triángulos por fotograma.

Las decisiones que más pesaron:

- **Las líneas de carril van pintadas en la textura del asfalto**, no montadas
  como mallas. Como segmentos sueltos costaban más de cien draw calls.
- **Cada papel es una sola malla con textura**, no un grupo de cuatro. Con
  hasta 90 papeles en pista, la diferencia eran más de 200 draw calls.
- Geometrías y materiales **compartidos** entre instancias, pool de objetos
  para obstáculos y recolectables (nada se crea ni se destruye durante la
  partida), y sombras desactivadas.

### Calidad adaptativa

El juego mide el dispositivo al arrancar (`src/utils/calidad.js`) y elige entre
tres niveles. Si el framerate no llega a 45 FPS de forma sostenida, baja de
nivel en caliente.

| Nivel | Bloom | Pixel ratio | Decorado |
|---|---|---|---|
| alta | sí | hasta 2× | 16 por lado |
| media | sí | hasta 1.5× | 12 por lado |
| baja | no | 1× | 8 por lado |

Para probar un nivel concreto en cualquier dispositivo:
`?calidad=alta`, `?calidad=media` o `?calidad=baja` en la URL. Con el nivel
forzado, el vigilante no lo cambia.

El **bloom** es lo que convierte los materiales emisivos en neón de verdad, y
es también el efecto más caro: por eso se apaga entero en calidad baja.

> **Ojo con el neón.** Multiplicar un color impuro por un factor alto le
> desplaza el matiz: `#ff3355 × 2.8` se recorta a rosa, no a rojo. Los colores
> de neón se declaran en `props.js` con los canales secundarios bajos y la
> intensidad acotada a 2. El brillo lo pone el bloom, no la saturación.

Si añades elementos, vigila `renderizador.info.render.calls` en consola —
con bloom activo esa cifra deja de ser útil, así que mídela con
`?calidad=baja`.

---

## Estado

Probado automáticamente con Playwright: flujo completo (menú → partida →
túneles → trámite → cerco → escape → game over / victoria → periódico),
recolección, colisiones, salto y agachada, rampa y tablado de las tarimas,
persistencia en localStorage, y varios cambios de escenario seguidos sin fuga
de memoria (geometrías estables).

Pendiente de prueba en hardware móvil real — los números de FPS medidos aquí
salen de renderizado por software y no representan el rendimiento en un GPU.

---

## Licencia

MIT. Ver [LICENSE](LICENSE).

Obra de sátira política. Los personajes, situaciones y textos son ficción
satírica de El Mercio y no reproducen declaraciones textuales de personas
reales. Los arrobas de la tabla de posiciones son inventados salvo el de la
casa; no corresponden a cuentas de terceros.

---

**El Mercio** · [elmercio.com](https://elmercio.com)
