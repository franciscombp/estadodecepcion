# PRUEBA DE ESCRITORIO — el juego entero, de principio a fin

Este documento sirve para **leer el juego sin jugarlo**: sentarse con él
delante y comprobar, paso a paso, que lo que pasa en pantalla es lo que se
quería que pasara.

No repite `docs/GUION.md`, que explica **por qué** existe cada pieza. Este
cuenta **qué ocurre, en qué orden y con qué números**, desde que se abre la
pestaña hasta que se cierra. Todas las cifras salen del código —los ficheros
están citados— y no de la memoria de nadie: si una no cuadra con el juego, es
un fallo del juego o de este documento, y hay que resolverlo antes de seguir.

La última sección, **«Lo que esta prueba destapa»**, es la que importa: lo que
se ve al leer el recorrido seguido y que no se ve al mirar una pantalla suelta.

---

## 1 · En una página

| | |
|---|---|
| **Qué eres** | Periodista de investigación de EL MERCIO |
| **Qué haces** | Correr mientras te persiguen, recogiendo papeles y pruebas |
| **Cómo se gana** | Recuperando el reguero **entero** dentro de un ente de control. Prácticamente imposible, y a propósito |
| **Cómo se pierde** | Te alcanzan, y el juez que te toca no es el que no está comprado |
| **Qué sobrevive** | Papeles acumulados, pruebas por caso, páginas del Archivo, tramos recorridos, récords, el barrio donde te capturaron |
| **Cuánto dura una corrida** | De 40 s (primera) a varios minutos (con oficio) |
| **Cuántas pantallas** | Diez, todas maquetadas como secciones del diario |

**Los tres marcadores, y no son intercambiables:**

- **Papeles** — la puntuación. Se recogen a puñados, se pierden al entrar a un
  trámite, se acumulan entre partidas. Es lo que se imprime grande.
- **Pruebas** — los documentos del caso. Son nominales (cada una es *ese* video,
  *ese* acta), no se pierden nunca y son lo que abre páginas del Archivo.
- **Tramos** — cuántos has recorrido en total. Abren personajes y potenciadores.
  Solo suben.

---

## 2 · El recorrido

### §1 · Arranque frío

Se abre la pestaña. Carga un PWA: si ya se visitó, arranca sin red.

`main.js` sondea WebGL **en un lienzo aparte** y lo suelta, elige nivel de
calidad y con él el detalle del bisel (`afinarBisel`: alta 2 segmentos, media 1,
baja ninguno). Se lee `localStorage` (`elmercio.estadodecepcion.v1`); si está
bloqueado —Safari en privado— el juego corre igual y el Archivo lo avisa.

**A comprobar:** que el primer arranque no tarde más que la animación de
entrada, y que el segundo arranque sin red llegue a la portada.

### §2 · La portada

No es un menú: es la escena de la entrevista **corriendo en vivo**, con el
personaje de pie con el micrófono y la cámara meciéndose despacio a su
alrededor (`Intro.poseMenu`).

Es la única pantalla del juego que **no** va impresa, porque es la ventana por
la que se ve la escena. Todas las demás son papel.

Desde aquí: JUGAR · personaje · marcadores · Archivo · Redacción (ajustes).

**A comprobar:** que el degradado deje limpia la franja central —el desenfoque
de fondo convierte al personaje en una mancha si se cuela ahí— y que el panel
de edición diga qué versión corre y si está guardada para jugar sin conexión.

### §3 · La entrevista (cinemática de arranque)

`src/game/Intro.js`. Cinco fases, **5,9 s** la primera vez:

| Fase | s | Qué pasa |
|---|---|---|
| entrevista | 1,6 | Estás preguntándole a un ministro. Cámara cerca y de lado |
| rescate | 1,2 | Llegan los dos y se lo llevan. Sin forcejeo |
| **pared** | **1,0** | Sigues con el micrófono en alto y delante **no hay nadie** |
| retroceso | 1,4 | La cámara se va a su sitio y descubre que los tienes detrás |
| caballito | 0,7 | El bajito se sube al grande |

Quien ya la vio la ve **abreviada** (1,85 s en total), y la pared se acorta pero
no se quita: es la fase que explica por qué corres.

Se salta tocando la pantalla.

**A comprobar:** que la fase «pared» se lea como un silencio y no como un tirón,
y que el ministro no sea reconocible como nadie —traje genérico, corbata roja,
pin sin identificar.

### §4 · El primer tramo — 850 metros

`TRAMO.LONGITUD = 850`. A velocidad inicial son **57 s**; a velocidad tope,
27 s.

**La velocidad** arranca en 15 u/s y sube 0,09 u/s² hasta 32: tarda unos **190
segundos** en llegar arriba, o sea que en las primeras corridas nunca se ve el
tope. Un golpe la corta al 45 % y se recupera a 8 u/s².

**Lo que hay en la calle**, por orden de aparición:

- **Obstáculos** desde el metro 45, separados 22–34 m, con un 28 % de
  probabilidad de que sean dobles (dos carriles bloqueados). Cuatro tipos por
  barrio: uno de saltar, uno de agacharse, uno de cambiar de carril y uno que
  ocupa dos. Nunca se genera un grupo que deje menos de **0,85 s** de reacción.
- **Papeles**, en hileras de 4 a 8, separados 7 m, valor 1–5 cada uno. Radio de
  imán 2,4 m.
- **Pruebas** — las de verdad, las nominales — con un **18 %** por grupo, valor
  10–20.
- **Potenciadores**, cada 320 m y con un 62 % de que la tirada salga premiada.
- **Tarimas** (la capa de arriba), unas **siete por tramo** y hasta tres vivas
  a la vez: tablado sobre la cabeza el **66 %** del recorrido, una cada 118 m
  —3,7 s a velocidad tope, 7,9 s a la de salida—. Nunca dos seguidas en el
  mismo carril. Cada una son 55 a 95 m a 3,15 m de altura partidos en **dos o
  tres tramos con hueco entre ellos**, y el hueco es por donde se cae. Se sube
  por rampa, que da un impulso de 14,2 —sale de la altura, no se elige—.
- **El hueco no es un número fijo**: mide medio segundo de la velocidad más
  lenta a la que se puede llegar a él (el piso tras un golpe), o sea de **4,5 m
  al empezar a 7,2 m a velocidad tope**. Sale de repartir los 0,847 s de vuelo
  del salto: 0,50 s de hueco y **0,347 s de ventana para pulsar saltar**, que a
  ritmo normal son 0,62 s. Fijo no puede ser: medido, a 32 u/s un hueco de 6 m
  se cruza andando, y a 9 u/s uno de 6 m es insaltable.
- **Caerse por un hueco no cuesta un golpe.** Te devuelve a la calle y te deja
  arriba los papeles de valor 5, que es el motivo por el que subiste.

**Medido** (12 tramos de 850 m a 15, 24 y 32 u/s, y la cinta contada pieza a
pieza sobre 128 cadenas): 7,17-7,25 cadenas por tramo, 17,8-18,3 tramos de
tablado, 10,6-11,0 huecos, 65,5-67,0 % de cobertura, hasta 3 cadenas vivas,
**cero solapes** entre cadenas y cero entre reservas de obstáculo, y nunca dos
seguidas en el mismo carril. De la cinta: 4,66 arcos por cadena a 0,60-0,85 m
sobre el tablado, dos piezas marcando la rampa —una antes del pie, otra en la
pendiente— y **cero piezas flotando a la altura del tablado dentro de un
hueco**, que era lo único que podía leerse como «aquí hay piso» siendo mentira.
Sin saltar se cae en los cuatro casos límite (hueco máximo a velocidad máxima,
hueco máximo en el piso de velocidad, hueco mínimo en el piso absoluto, hueco
mínimo a la velocidad de salida), con ventanas de 0,34 a 0,62 s.

Antes de esto eran **2,50 cadenas por tramo, 23,3 % de cobertura, una sola viva
y cero huecos**: `MAXIMO_VIVAS: 3` era configuración muerta porque la condición
de no solape comparaba el borde LEJANO de la cadena —que nace en −260— contra
los 12 m de separación, así que solo se generaba con la lista vacía.

**A comprobar a mano:** que caerse se sienta caro sin sentirse injusto.

**Los perseguidores** empiezan a 26 m, pueden alejarse hasta 34, y te atrapan si
bajan de **4,5**. Cada golpe los acerca **8 m**: con tres golpes —26 → 2— te
alcanzan. Los tres intentos del HUD son eso, no una barra de vida aparte.

**La racha** sube con cada papel encadenado y se cae a los 1,5 s sin recoger o
con un golpe. En 6 → EN RACHA, en 14 → IMPARABLE, en 26 → PRIMERA PLANA. **No
multiplica nada**: cambia el color del estallido, de la estela y de la ficha.

**A comprobar:** que en los primeros 200 m no coincidan un obstáculo doble y una
hilera de papeles en el mismo carril libre; que la tarima se lea como algo a lo
que subirse y no como un obstáculo; que la racha se note sin que nadie explique
qué es.

**Los controles.** Deslizar en cualquier parte de la pantalla: 28 px de
recorrido mínimo y 600 ms como máximo —más lento que eso no cuenta como
deslizar, es un arrastre—. Con teclado: flechas o WASD, espacio para saltar,
Escape o P para pausar. No hay botones de dirección en pantalla; el hint de
deslizar se enseña las tres primeras partidas y luego desaparece.

**Lo que hay en pantalla mientras corres**, y son cuatro cosas:

| Dónde | Qué |
|---|---|
| Arriba izquierda | El botón de pausa, y nada más |
| Arriba derecha | Papeles · metros · MEJOR · los tres puntos de intento |
| Abajo | Las píldoras de lo que esté activo, con su cuenta atrás |
| **El centro** | **Nada. Nunca.** Por ahí se corre |

Se le suman dos piezas que salen solo cuando toca: el **cartel de salida**, que
baja del techo en la bifurcación, y el **panel del expediente**, que aparece
dentro del pasillo del ente de control. Cuando cualquiera de las dos está
puesta, el resto del HUD se atenúa: en cada momento manda una sola cosa.

**El sonido** es sintetizado, sin ficheros: cambio de carril, salto, agacharse,
papel (afinado según la racha), prueba, golpe, captura, clic del selector,
veredicto y cambio de escenario. Se puede silenciar desde la Redacción.

### §5 · La bifurcación

A 260 m del final **baja el cartel de salida** desde el techo de la pantalla:
señalización de autopista, un panel verde por vía con su flecha y su pestaña.
Se queda quieto mientras dura la decisión y se sube al cruzar. A 140 m **el
corredor se vacía**: de ahí al final no hay nada que esquivar.

Tres bocas de túnel, una por carril:

| Barrio | Izquierda | Centro | Derecha |
|---|---|---|---|
| **La Bahía** | Elecciones | FISCALÍA | El Apagón |
| **El Apagón** | La Bahía | ASAMBLEA NACIONAL | Centro histórico |
| **Las Elecciones** | Centro histórico | CNE | La Bahía |
| **Centro histórico** | Las Elecciones | **CARONDELET (cerco)** | El Apagón |

Cuando el centro es el cerco, el panel del medio va en **rojo** y la pestaña
dice SIN SALIDA.

**A comprobar:** que el cartel se lea entero en un teléfono de 375 px de ancho;
que el viraje de la cámara al entrar por un lado se sienta como un viraje y no
como un tirón; y —esto es lo que se olvida— que a la vuelta de un barrio ya
visitado el cartel siga diciendo la verdad.

### §6a · Si eliges un lado: la esquina, y luego otro barrio

Doblar la esquina dura **1,2 s** —lo que se tarda en cruzar el soportal de 30
metros a velocidad de crucero— y funciona como en Temple Run: **el camino ya
está ahí, y lo que gira es el mundo.**

1. El tramo nuevo se construye entero y nace **tendido en la transversal**,
   cruzado delante del jugador: exactamente donde está una bocacalle cuando
   llegas a la esquina.
2. Durante el viraje, esa calle **rota 90° alrededor del jugador** hasta quedar
   de frente. El giro del mundo termina en el **62 %** del viraje; el resto se
   corre ya derecho, saliendo de la esquina.
3. La cámara **no gira ni orbita**: se queda a la espalda del corredor. Lo que
   pone es el **peso** — el personaje se ladea hasta 46° hacia el giro, la
   cámara deriva corta hacia el lado de FUERA (como un cámara que toma la curva
   abierta, y así el personaje cae hacia el lado al que dobla) y se banquea 7°.
4. Se levanta **polvo** de la esquina. Por los costados ya no hay destello:
   la transición se enseña entera, y blanquearla sería tapar justo eso.
5. El **soportal** viaja con el jugador y hace de esquina cubierta mientras la
   bocacalle se alinea.

Como todos los subsistemas del mundo cuelgan de un grupo asentado en el origen
y su movimiento es en coordenadas del grupo, girar el mundo son seis escrituras
de `rotation.y` y ninguna distancia cambia: colisiones y tiempos quedan
intactos mientras la calle gira.

Y el primer obstáculo del barrio nuevo se coloca contando **lo que queda de
giro**: el margen no son metros fijos, son los segundos que el jugador va a
tardar en poder ver. A velocidad de crucero eso pone el primer grupo a unos
**87 metros**, con más de 1,5 s de calle limpia tras enderezarse.

Cambia la piel, la luz, los cuatro obstáculos y el caso que se documenta. La
velocidad, los papeles y la distancia **no se reinician**: la corrida sigue.

Los cuatro barrios y su hora del día están en la tabla de la sección 3.

**A comprobar:** que al llegar a la esquina la bocacalle se vea cruzada y gire
hasta quedar de frente (no un corte con destello); que el personaje caiga hacia
el lado al que dobla (medido: hasta el 43 % del semiancho hacia el lado del
giro, nunca fuera del cuadro); y que al enderezarse haya calle limpia.

### §6b · Si eliges el centro: el ente de control

Este es el tramo con más historia detrás y el que más fácil se malinterpreta.

**Primera visita a ese ente** — el juego **para**. Sale una pantalla de
CONTEXTO con dos o tres párrafos en segunda persona contando qué está pasando
(pediste cita tres veces, te mandan pasar la carpeta por la banda y no está
cerrada, se levanta la sesión por falta de quórum) y un botón para seguir. Se
cuenta **una sola vez por ente**.

**Dentro del pasillo** (340 m):

1. Al entrar, la institución te **riega todos los papeles**. El marcador se
   pone a cero en el acto y lo que llevabas se desparrama por los tres
   carriles, uno a uno, cambiando de carril cada 10 m.
2. No hay obstáculos ni perseguidores. Lo único que se puede hacer es recoger.
3. **Lo que levantas vale ×2.** El punto de equilibrio está en recuperar la
   mitad: por debajo el pasillo te costó papeles, por encima te pagó.
4. El panel del HUD lleva la cuenta y dice de qué lado de la mitad vas. Del
   **90 %** en adelante cambia de discurso y anuncia el final: «TE FALTAN N
   PARA SALVARLO ENTERO».

**Al salir:** el portazo (siempre el mismo) y **el hallazgo** —la pieza del caso
que te faltaba—. En la primera visita se cuenta en pantalla; de la segunda en
adelante lo remata el propio panel del expediente, que se queda dos segundos con
«SALES CON +N · *la pieza*».

**Si recuperas el reguero entero**, y solo entonces, **se gana la partida**. Ver
§13.

**A comprobar:** que entrar no se sienta nunca como un castigo puro; que la
cuenta del panel coincida con lo que suma el marcador al salir; y que el
hallazgo se vea también en la variante corta, que es la que se juega casi
siempre.

### §7 · El choque y el cerco

Un golpe que no mata: el personaje se **aplasta contra lo que se llevó por
delante** y vuelve a su forma con un rebote, dando una vuelta entera sobre sí
mismo. Menos de medio segundo. Y 1,2 s de invulnerabilidad.

El tercer golpe —o que los perseguidores bajen de 4,5 m— **cierra el cerco**:

- El mundo se para.
- Los dos te caen encima por un lado; **cinco policías** cierran un círculo de
  4,6 m de radio.
- El personaje acaba **boca abajo** en el asfalto, brazos y piernas abiertos.
- La cámara se coloca en picado.
- Dura **1,9 s** y solo entonces aparece interfaz.

En ese fotograma exacto se **captura la pantalla**: es la foto que mañana sale
en portada.

### §8 · El sorteo del juez

Seis jueces. Cinco con la **camiseta morada** del oficialismo, uno sin ella. Un
selector los recorre y lo paras tú.

- Primera captura de la partida: **4,2 saltos por segundo**.
- Cada captura posterior suma **1,55**, hasta un tope de **15**.
- **No hay límite de intentos.** Lo que se encoge es la ventana, no el número de
  oportunidades.

Aciertas al juez limpio → medidas sustitutivas, vuelves a la pista en el mismo
barrio, con los perseguidores a 20 m. Fallas → sentencia, y se acabó la corrida.

Las cinco sentencias que no son la buena: prisión preventiva, domiciliaria con
grillete, pedido de extradición, incomunicación, causa reservada.

**Esta curva es la única progresión del juego que va en tu contra**, y es la que
hace que una partida termine.

**A comprobar:** que a 15 saltos por segundo siga pareciendo una decisión y no
una moneda al aire; que las seis camisetas se distingan **por color** también en
la maqueta impresa (es la única excepción a la tinta gris de todo lo demás); y
que parar el selector no produzca ninguna transición torpe.

### §9 · La primera plana

Perder no devuelve a una pantalla de juego: devuelve **un periódico**. La página
entera es la portada de El Mercio del día siguiente. La sentencia es el titular.
La foto es **tu arresto**, en blanco y negro y con trama de puntos.

La única cifra grande son **los papeles recogidos**. Metros, pruebas y puntaje
bajan a una línea de datos pequeña. Y son los papeles y no el puntaje a
propósito: el puntaje suma papeles más metros partido por diez, así que puntúa
igual al que documenta y al que solo corre rápido.

Un botón: CONTINUAR.

### §10 · El expediente del caso

Si la corrida trajo pruebas, CONTINUAR abre **el expediente**: la mesa con las
casillas del caso, una por documento, que **se llenan entre partidas**. Lo que
acabas de recoger cae con animación, una pieza cada 0,3 s; lo de antes ya está
puesto.

La mesa es **la lista de documentos de la redacción, no un álbum de cromos**:
cada casilla es una ficha con el nombre del documento impreso —también las que
faltan, que salen en fantasma con su sello de SIN RECUPERAR, porque el sumario
sabe exactamente qué es lo que sigue en la calle—. Lo recogido en esta corrida
cae con su sello de NUEVO, y arriba una cuenta dice cuántos documentos del caso
van.

Y la pantalla dice **a dónde va todo esto**: una línea bajo el titular conecta
la corrida con el Archivo según el estado de la página del caso — «se abre con
2 pruebas: llevas 1», «con esto se abrió la página Política», «ya está abierta;
cada documento nuevo la completa», o «expediente completo». Es la bisagra que
faltaba entre correr y publicar.

Aquí, y no antes, pasan dos cosas:

- Las pistas que **solo están en redes** salen marcadas: existen, ocupan su
  casilla, y no cierran ningún reportaje.
- **El material plantado se revela.** No ocupa casilla del caso —no es de este
  caso, es de quien te lo dejó ahí—, va marcado como PLANTADA y, al abrirlo, lo
  primero que se lee es **qué medio lo va a publicar**. Se detecta al
  contrastarlo, nunca al encontrarlo: esa es la broma entera.

### §11 · Deportes

Se pasa de hoja y sale la sección de deportes del mismo ejemplar. Tres
clasificaciones en pestañas:

| Pestaña | Qué mide |
|---|---|
| **Los más buscados** | Todo lo recogido, partida tras partida |
| **Distancia** | Metros corridos desde la primera entrevista |
| **Mejor corrida** | Papeles en una sola partida |

La primera no se presenta como una tabla de puntos sino como una **circular de
búsqueda**: cuanto más arriba, más estorbas. El puesto uno no es «director»,
es «prioridad uno».

No se enseñan los diez: el director, los puntos suspensivos si hay hueco, y tú
entre tus dos vecinos. La tabla entera vive en MARCADORES, desde el menú.

Salidas: INTENTAR DE NUEVO (vuelve **al barrio donde te capturaron**, no a la
Bahía) o VER TODO EL DIARIO.

### §12 · El Archivo

El ejemplar que vas armando. Cinco páginas.

**Una página se abre con PRUEBAS, no con papeles.** Cada una pide las de su
caso: dos para las cuatro de caso, seis repartidas para la última. Ni el
material plantado ni las pistas de solo-redes cuentan para abrirla.

**Una página cerrada** enseña de qué caso sale, en qué barrio se recoge, y
cuántas pruebas llevas de las que pide.

**Una página abierta** publica **el expediente**: el título del caso, qué pasó,
cómo está, y la lista de documentos marcando cuáles llevas y cuáles siguen en la
calle. Esa lista es lo que hace que la página **se llene según se recoge** en
vez de aparecer entera de golpe.

**Y una página tiene dos estados, no uno.** Se abre con dos pruebas y se
**completa** cuando tienes todos los documentos del caso: entonces lleva el
sello EXPEDIENTE COMPLETO, el filete se pone verde y el pie deja de decir qué
falta. La última página cuenta cuántos casos van enteros. Las pistas que solo
están en redes no cuentan para completar —con una captura de pantalla no se
publica—.

Debajo, tras el rótulo **«Lo que publicará El Mercio»**, los huecos de
reportaje con su sello de EN PREPARACIÓN: el filete separa el material de
trabajo (arriba) de lo publicable (abajo), y así se lee la cadena entera —
recoges → el expediente crece → la pieza se escribe con eso.

Y en la última página, **«Lo que dice el gobierno»**: cada pieza plantada que
recogiste, con el titular que salió publicado con ella. Esos titulares son
ficción y la propia sección lo dice; el resto del Archivo, no.

**La regla de la casa, que no se toca:** el expediente no es el reportaje y no
se maqueta como tal —hoja aparte, rótulo propio, sin firma y sin fecha—. En
`src/config/publicaciones.js` solo entra lo publicado por El Mercio, con
titular, autoría, fecha y **enlace comprobable**. Un reportaje falso con pinta
de real es exactamente lo que este juego critica.

### §13 · La victoria

Recuperar **el reguero entero** dentro de un ente de control. Está calibrado
para que sea prácticamente imposible: el reguero cambia de carril cada 10 m, que
a velocidad de crucero son tres cambios por segundo.

Sale la pantalla de PORTADA con el texto de éxito del ente, y `denunciaPresentada`
queda marcado para siempre en el archivo guardado.

Es el final del juego y **el único**.

---

## 3 · Los cuatro barrios

| | La Bahía | El Apagón | Las Elecciones | Centro histórico |
|---|---|---|---|---|
| **Caso** | Porsche | Progen | Elecciones | Estado de excepción |
| **Hora** | Mediodía nublado | Sin red eléctrica | Tarde de cierre | Amanecer con el cerco |
| **Ambiente** | 1,50 | **0,30** | 1,45 | 1,30 |
| **Saltar** | Puesto de ropa | Tubería reventada | Valla de campaña | Reja |
| **Agacharse** | Toldo con electrodomésticos | Cable de alta tensión | Pancarta | Alambre de púas |
| **Cambiar carril** | Militar | Generador averiado | Cartón del candidato | Antimotines |
| **Dos carriles** | Retén | Turbina varada | Bus de simpatizantes | Tanqueta |
| **Densidad de papeles** | 1,00 | 0,80 | 0,90 | **0,25** |
| **Pruebas del caso** | 4 | 5 | 5 | 5 + 1 de redes |
| **Material plantado** | — | — | 2 | 2 |
| **Mecánica propia** | La calle va techada | **Oscuridad** + linterna | — | Máx. 3 papeles por tramo |
| **Ente** | FISCALÍA | ASAMBLEA NACIONAL | CNE | **ninguno: cerco** |

**Por qué el Apagón es el único oscuro:** si vienes de una calle en penumbra y
entras en otra penumbra, quedarse sin luz no es un acontecimiento. Entrar al
Apagón divide la luz **por cinco** de golpe (1,50 → 0,30). Lo que importa es esa
proporción y no las cifras: subieron las cuatro juntas al iluminar el mundo, y
mientras el salto siga siendo de cinco veces el apagón sigue contando lo mismo.


**Y por qué en el Apagón los papeles alumbran:** el papel sube su emisión y deja
de teñirse con la niebla, así que la hilera dibuja la ruta a través del negro.
Sigues sin ver la calle —eso lo paga la linterna— pero ves por dónde va. Es lo
que permite que quedarse sin luz **no mate**: la linterna es un potenciador que
puede no salir, y morir por no haberlo encontrado sería perder por mala suerte.

**Carondelet es árido a propósito.** Densidad 0,25 y tope de tres papeles por
tramo: casi no hay qué documentar, y la carestía es el mensaje.

---

## 4 · Las tres economías

### Papeles

Se recogen, se pierden al entrar a un trámite, se recuperan ×2, se acumulan
entre partidas. **Alimentan tres clasificaciones y nada más.**

### Pruebas

Nominales y únicas. No se pierden nunca —lo recogido se queda aunque te
capturen en esa misma corrida— y son lo único que abre páginas del Archivo. Se
distinguen tres clases:

| Clase | Se recoge | Ocupa casilla | Abre página |
|---|---|---|---|
| **Con documento** | sí | sí | **sí** |
| **Solo en redes** | sí | sí, marcada | no |
| **Plantada** | sí | no, va aparte y en gris | no |

Las plantadas salen **apagadas en la calle**, sin el halo de las buenas: perder
una es un error de lectura, no una trampa. Y no aparecen en los dos primeros
barrios —en la Bahía y en el Apagón se aprende qué es una prueba, y solo cuando
el jugador ya se fía de lo que recoge tiene gracia empezar a colárselas.

### Tramos recorridos

Acumulativo entre partidas, nunca baja. Abre:

| Tramos | Qué abre |
|---|---|
| 3 | **Fuente anónima** — imán de papeles, 9 s |
| 6 | **Portada** — todo vale el doble, 13 s |
| 8 | Personaje: **Buscán** |
| 10 | **Botas de campo** — saltas más alto, 14 s |
| 15 | **Salvoconducto** — aguanta un golpe |
| 18 | Personaje: **Blanki** |
| 22 | **Cobertura aérea** — sobrevuelas el tramo, 8 s |

La **linterna** no se desbloquea: existe desde la primera partida y solo sale en
el Apagón.

---

## 5 · Una sesión de veinte minutos

Así es como se ve el juego para alguien que lo abre por primera vez y le dedica
un rato. Es la prueba de escritorio de verdad: no cada pantalla por separado,
sino la secuencia.

| Min | Qué pasa | Qué aprende |
|---|---|---|
| 0:00 | Carga, portada, JUGAR | Que esto es un periódico |
| 0:05 | La entrevista entera, 5,9 s | **Por qué** corre |
| 0:12 | Primer tramo. Choca dos veces, recoge unos 60 papeles | Saltar, agacharse, cambiar de carril |
| 0:55 | Le atrapan antes de la bifurcación. Cerco, sorteo a 4,2 | Que el juez se elige con el pulgar |
| 1:05 | Falla. Primera plana con su foto | Que perder tiene titular |
| 1:15 | No hay expediente —no recogió ninguna prueba— y salta a Deportes | Que hay tres tablas |
| 1:30 | Segunda corrida. Llega a la bifurcación | Que hay más de un barrio |
| 2:10 | Elige un lado. Entra al Apagón y se queda a oscuras | Que la luz es una mecánica |
| 3:00 | Recoge una prueba. Al morir, la ve caer en el expediente | Que las pruebas son nominales |
| 5:00 | Tercera o cuarta corrida: **3 tramos**, se abre la Fuente anónima | Que insistir abre cosas |
| 7:00 | Entra por el centro. Pantalla de CONTEXTO, primera vez | De qué va el trámite |
| 7:30 | El pasillo. Recupera menos de la mitad y sale perdiendo | Que hay una apuesta ahí |
| 8:00 | Pero sale **con la pieza del caso** | Que documentar nunca se castiga |
| 10:00 | Segunda prueba del mismo caso → **se abre la portada del Archivo** | Que el Archivo es el objetivo |
| 11:00 | Abre el Archivo y lee el expediente del caso Porsche | De qué iba todo esto |
| 14:00 | En Elecciones recoge un «acta corregida a mano» | Nada: parece una prueba |
| 15:00 | Al morir, el expediente la revela plantada y dice quién la publicó | **El chiste central** |
| 18:00 | Sexta captura de la misma partida: el selector va a 12 saltos/s | Que la partida se acaba |
| 20:00 | Deja de jugar con tres páginas del Archivo abiertas | Que le falta media investigación |

---

## 6 · Lo que esta prueba destapa

Ordenado por lo que más cambiaría el juego. Cada punto lleva veredicto.

### 6.1 · Los papeles no se gastan en nada — **resuelto: son puntuación, y ahora lo dicen**

Las páginas del Archivo se abren con **pruebas**, que es la decisión correcta:
un reportaje se arma documentando, no corriendo. Pero al quitarles ese uso, los
papeles se quedaron **sin ningún sumidero**: se acumulan, alimentan tres tablas
y ya. `PROGRESO.PAPELES_POR_EVIDENCIA` no lo lee nadie y el campo `costo` de
cada página solo sobrevive en un `title` de un botón.

Que la moneda principal del juego —la que se imprime grande en la portada del
final— no se pueda gastar en nada es la incoherencia más grande que queda. Se
nota además en los comentarios: la cabecera de `personajes.js` todavía razona
que los personajes se abren por tramos y no por papeles «porque los papeles son
la moneda del Archivo», y ya no lo son.

Hay dos salidas honestas y son incompatibles: **(a)** dejarlo así y aceptar que
los papeles son puntuación pura, quitando de una vez el vocabulario de moneda
(«papeles disponibles para gastar», `costo`, `PAPELES_POR_EVIDENCIA`); o **(b)**
darles un destino que no compita con las pruebas —empezar la corrida en un
barrio elegido, arrancar con un potenciador puesto—, cuidando que no acabe
comprándose el progreso del Archivo por la puerta de atrás.

Se hizo **(a)**. El juego ya dice en su propia portada que lo que mide es cuánta
documentación sacaste; una tienda lo contradiría. Se quitaron
`PROGRESO.PAPELES_POR_EVIDENCIA` y el campo `costo` de las cinco páginas, y el
título emergente del paginador —que prometía «Política · 300 papeles»— pasa a
decir cuántas pruebas del caso llevas de las que pide. Los comentarios que
razonaban sobre «la moneda del Archivo» dicen ahora lo que hay.

Queda abierto lo otro: si algún día se quiere que los papeles compren algo, que
sea algo que no compita con las pruebas —empezar en un barrio elegido, arrancar
con un potenciador puesto— y nunca el progreso del Archivo por la puerta de
atrás.

### 6.2 · El final no se anunciaba en ninguna parte — **resuelto**

Solo se gana recuperando el reguero **entero** de un trámite, con el reguero
cambiando de carril tres veces por segundo. Está calibrado para ser casi
imposible y eso es coherente con lo que cuenta el juego.

Lo que la lectura seguida destapa no es que sea difícil: es que **el jugador no
sabe que existe**. No hay ninguna pantalla que diga que recuperarlo todo hace
algo distinto. El panel del pasillo habla de la mitad —el punto de equilibrio—
y nunca del todo.

Bastaba una línea. Del **90 %** en adelante el panel deja de hablar de la mitad
y dice **«TE FALTAN N PARA SALVARLO ENTERO»**, en verde y con el borde a juego;
al llegar, **«LO TIENES ENTERO»**. No antes del 90: prometer el final a mitad de
pasillo sería prometer algo que casi nunca se cumple, y eso desgasta más de lo
que empuja.

Que sea difícil no se toca. Que fuera invisible, sí.

### 6.3 · Una página abierta ya no daba ninguna razón para volver — **resuelto**

Cada página de caso pide **dos** pruebas del suyo, y los cuatro barrios sueltan
entre cuatro y seis tipos. O sea: dos corridas decentes por barrio abren su
página. La última pide seis de cualquiera, que a esas alturas ya se tienen.

No hay ninguna razón para visitar un barrio dos veces una vez abierta su página,
salvo puntuación. Y como el barrio de arranque es donde te capturaron, la ruta
se estanca fácil.

La solución no era pedir más pruebas —sería alargar por alargar— sino darle a
cada página **un segundo estado**: se abre con dos y se **completa** con todos
los documentos del caso. La maqueta ya lo estaba pidiendo, con su lista de
tachados.

Ahora un caso entero lleva el sello **EXPEDIENTE COMPLETO**, el filete del
sumario se pone en verde y el pie cambia de «lo tachado sigue en la calle» a
«están todos: este caso ya no te debe nada en La Bahía». La última página cuenta
cuántos van: **«2 de 4 expedientes completos»**.

Las pistas que **solo están en redes** no cuentan para completar. Exigirlas
sería lo contrario de la regla de la casa: convertiría una captura de pantalla
en un requisito de publicación.

### 6.4 · El trámite se jugaba a ciegas casi siempre — **resuelto**

Lo destapó leer §6b seguido. La primera visita a un ente para el juego y lo
cuenta todo; de la segunda en adelante se entra y se sale sin parar, que es lo
correcto. Pero la salida corta no decía **nada**: en `_resumirInstitucion` había
dos condicionales vacías, restos de los avisos flotantes que se quitaron del
HUD. Se salía del pasillo sin saber cuántos papeles se rescataron ni —peor— que
uno acababa de llevarse la pieza del caso, que es lo único que compensa entrar.

Y como de la segunda vez en adelante es casi siempre, el tramo con más historia
detrás era el que menos se entendía.

Lo remata el propio panel del expediente, que se queda dos segundos con
**«SALES CON +150 · EXPEDIENTE DEL CASO PORSCHE»**. Ahí y no en una tarjeta
nueva: es donde el jugador ha tenido los ojos los 340 metros anteriores.

### 6.5 · El giro de la esquina se leía al revés, y mareaba — **resuelto**

Tres fallos encadenados, y los tres salieron de leer §6a con el juego delante.

**El primero: la cámara hacía dos cosas contradictorias.** Se DESPLAZABA hacia
el lado elegido —2,4 unidades hacia la derecha al doblar a la derecha— y además
giraba la mirada hacia ese mismo lado. Moverse de lado y girar producen
paralajes opuestos: lo cercano se va hacia un lado y lo lejano hacia el otro.
Eso no es una manera de hablar, es el conflicto que provoca el mareo de
movimiento en cualquier cámara.

**El segundo: el giro se leía invertido.** La cámara rotaba 42° hacia la
esquina y el personaje solo 38°, así que él se salía del cuadro por el lado
contrario. Y lo primero que lee el ojo no es hacia dónde apunta la cámara, es
hacia dónde se va el personaje: al irse a la izquierda en un giro a la derecha,
el giro entero se leía a la izquierda.

Doblar una esquina es UNA sola cosa: la cámara recorre un arco **alrededor** del
personaje y se queda detrás de su nueva dirección. Ahora la posición y la mira
salen del mismo ángulo, así que no pueden decir cosas distintas, y el personaje
se queda clavado en el centro —medido: nunca se aparta más del 21 % del ancho
del cuadro, contra el salirse entero de antes—.

**El tercero: 42° era demasiado.** El semiángulo horizontal de esta cámara es de
16°, así que a 42° el punto de fuga de la calle se sale del cuadro. Y la calle
no dobla: la pista sigue yendo a −Z. Medio giro se pasaba enseñando la fila de
casas de canto. Ahora son **24°**, con el arco asimétrico —pico al 32 %, vuelta
en el 68 % restante—, el balanceo bajado de 15° a 9° y el destello movido al
pico, que es donde el mundo cambia.

Dos cosas más, de las que se ven al mirar el fotograma congelado: el polvo de la
esquina llevaba el color del asfalto, y una nube del mismo tono que el suelo
dibujada encima del suelo sale **más oscura** que él —eran manchas negras
flotando sobre la calzada mientras la cámara giraba—; y los muros del soportal
eran casi negros sin nada que los iluminara, o sea un rectángulo vacío justo
donde mira la cámara en el pico del giro.

**Y la órbita tampoco bastó.** Corregía los paralajes, pero el encuadre entero
se trasladaba y el suelo barría el cuadro en diagonal: seguía torpe, porque una
cámara de runner no se mueve de detrás del corredor. La versión definitiva es
la del género: **el mundo gira, la cámara no** (§6a). El tramo nuevo nace
tendido en la transversal y rota 90° hasta quedar de frente; la cámara solo
acompaña el peso. Y la deriva del peso va hacia FUERA del giro: derivar hacia
dentro —lo que parece natural— traslada el cuadro hacia el lado del giro y
empuja al personaje justo al lado contrario, con lo que el giro vuelve a
leerse al revés. Medido en las dos direcciones: el personaje cae hacia el lado
al que dobla, hasta el 43 % del semiancho, sin salirse nunca.

### 6.6 · Se chocaba con el primer obstáculo de cada tramo nuevo — **resuelto**

El primer grupo de obstáculos de un tramo estaba clavado en **45 metros**. Y 45
metros son tres segundos a la velocidad de salida y **uno y cuarto** a velocidad
tope: el tramo que más margen necesita —el que se entra a toda velocidad
después de doblar una esquina— era justo el que menos daba. Encima el giro dura
2,1 s con la cámara rotando, el polvo levantado y el destello por encima, así
que el obstáculo no es que llegara pronto: llegaba **antes de que se pudiera
ver**.

El margen pasa a medirse en segundos y a contar la ceguera del giro. Medido a
26 u/s: el primer grupo cae a 87 metros y, cuando la cámara termina de
enderezarse, quedan 1,5 s de calle limpia —casi el doble del tiempo de reacción
que el generador garantiza entre grupos—.

### 6.7 · El Centro histórico es el único barrio sin ente de control — **cerrado, es intencionado**

Carondelet está cercado: ir de frente te estrella. Es coherente y es el punto de
la escena. Pero conviene decirlo aquí para que nadie lo «arregle» por simetría:
el carril del centro rojo con SIN SALIDA no es un hueco, es la escena.

### 6.8 · Los perseguidores no se acercan por tiempo — **cerrado, y conviene que siga así**

Solo se acercan por golpes recibidos (8 m) y por exhausto (2,2 u/s). Sin golpes,
la persecución no aprieta nunca por sí sola. Podría parecer un fallo de tensión;
no lo es, porque quien aprieta es el mundo: la velocidad sube sin parar y los
obstáculos llegan cada vez más rápido con la misma separación en metros.

### 6.9 · La reserva de material real está desigual — **abierto, y es lo único que bloquea de verdad**

`docs/CASOS/` tiene **un** expediente escrito con sus fuentes: el caso Porsche.
Los otros tres viven solo en el bloque `expediente` de `escenarios.js` —tres o
cuatro frases— que es suficiente para el juego pero no para documentarse.

Y los once reportajes de El Mercio siguen **todos pendientes**: la regla de la
casa no deja inventarlos, así que hasta que la redacción publique, el Archivo
mantiene los huecos con su sello. Es lo correcto y hay que decirlo en voz alta
para que nadie lo lea como una tarea a medias: **el hueco es la pieza**, no la
falta de ella.

### 6.10 · El juego se congelaba a golpes, y eran tres relojes distintos — **resuelto**

El reporte era «se queda congelado en ciertos momentos», y los momentos
resultaron ser tres, cada uno con su causa. Se encontraron con un vigilante de
fotogramas largos (>300 ms) corriendo el juego entero en el navegador:

**En cada esquina.** `crearEscenario` costaba **380–680 ms en un solo
fotograma** (medido: la Bahía 530, Elecciones 460, Carondelet 380; solo el
Apagón es barato porque es escaso), y se pagaba en el fotograma del cruce —
justo cuando arranca el giro. Antes lo disimulaba el fogonazo blanco; al
quitarlo quedó desnudo. Arreglo: **los barrios ya no se destruyen al salir**:
se descuelgan del grafo y se aparcan (`BaseScene.suspender/reanudar`), y volver
a uno visitado cuesta 1–5 ms. La primera visita se paga **preconstruyendo los
dos destinos en el corredor vacío** de la bifurcación —donde no hay nada que
esquivar—, uno al vaciarse y el otro 60 m después. La niebla y el fondo son
globales de la escena y el constructor del barrio nuevo los pisa: se guardan y
reponen alrededor de cada preconstrucción.

**Al salir de cada trámite.** El early-return del pasillo se saltaba
`bifurcacion.actualizar`, así que el viraje de entrar de frente quedaba
congelado en su primer instante los 340 metros… y al salir se descongelaba y
disparaba entero su fogonazo: un velo blanco de un segundo en plena calle
nueva. Ahora el reloj del viraje corre también dentro del pasillo (con avance
cero: la fachada ya no existe) y el fogonazo se dispara donde se diseñó, al
entrar.

**Al ser capturado.** La foto del arresto se codificaba a resolución completa
con `toDataURL` síncrono: 300–400 ms clavados en mitad del cerco. La portada
la imprime a ~350 px y en blanco y negro con trama: ahora pasa por un lienzo
intermedio de 640 px de ancho y el JPEG cuesta una fracción.

### 6.11 · Los personajes no se llaman como dice el guion — **abierto, y es una decisión editorial**

`docs/GUION.md` y la cabecera de `src/config/personajes.js` dicen lo mismo: los
cuatro se llaman **Chochólogo, Alondra, Buscán y Blanki**, y dos de esos nombres
llevan el guiño —Buscán por Andersson Boscán, Blanki por Blanca Moncada— con el
desvío calculado para que se reconozca sin firmar por nadie.

En el código se llaman **Tostadólogo, Avecilla, Buencan y Monki**. El propio
fichero se contradice: el comentario de arriba explica por qué el nombre es
Buscán, y doce líneas más abajo el campo dice Buencan.

No se toca aquí a propósito. Un guiño al nombre de una periodista viva es
exactamente el tipo de decisión que no se resuelve por coherencia de ficheros:
o se cambia el código para que diga lo que dice el guion, o se cambia el guion
para que deje de prometer un guiño que el juego no hace. Las dos son
defendibles; ninguna es mecánica.

### 6.12 · Las costuras entre estados saltaban — **resuelto**

Las cinemáticas eran fluidas por dentro y bruscas por los BORDES: cada cambio
de estado tenía algún teletransporte.

- **La mira de la cámara.** Los dos encuadres (carrera y cerco) hacían `lookAt`
  directo a objetivos distintos: la posición viajaba suave pero la vista
  giraba EN UN FOTOGRAMA al capturarte y al zafarte. Ahora la mira es un punto
  suavizado que persigue su objetivo (`_mirar`): a 14/s el juego normal se
  siente igual, y los cambios de encuadre se vuelven paneos. Medido: el giro
  máximo por fotograma al entrar al cerco bajó de un corte seco a 3,3°.
- **Levantarse tras el escape.** `reiniciarTrasEscape` ponía al personaje de
  tumbado a de pie en un fotograma. Ahora el tronco rueda de −90° a 0 en media
  zancada (0,55 s con suavizado), con una pizca de altura para que los pies no
  asomen bajo el asfalto.
- **La cámara tras el escape** vuelve del picado con amortiguación a un tercio
  durante 0,9 s, en vez de al ritmo de juego (que era un latigazo).
- **El portazo del trámite.** Al arreglar el fogonazo diferido (6.10) quedó a
  la vista que la variante corta cambia el pasillo por la calle nueva EN UN
  FOTOGRAMA. Ahora el portazo lleva su propio golpe de blanco corto —la
  metáfora exacta del tramo— que muere en medio segundo. La primera visita no
  lo necesita: la pantalla del relato cubre el cambio.
- **Capturado en plena esquina**, el mundo se enderezaba de golpe. Ahora se
  desvanece durante el cerco (medido: 1,49 rad → 0,66 a los 0,3 s → 0).
- **Pulsar JUGAR** teletransportaba la cámara del encuadre del menú al de la
  entrevista (y al reintentar, desde el picado del cerco). La fase 1 de la
  cinemática ahora funde desde donde venga la cámara durante su primera mitad.

### 6.13 · Abandonar la corrida abría un juicio — **resuelto**

El botón «Abandonar la corrida» de la pausa llamaba a
`terminarPartida('captura')`, o sea la ruta entera de la captura: el cerco
cerrándose, el sorteo del juez y la primera plana con foto de arresto.
Retirarse a la portada te montaba un juicio.

Además de raro, contradice lo que significa cada pieza: **el sorteo del juez es
la oportunidad de seguir corriendo después de que te agarren**, y a quien se va
por su pie no hay que agarrarlo ni ofrecerle una oportunidad de nada.

Ahora `abandonarPartida()` cierra la corrida y vuelve al menú. Y **lo recogido
se queda**, igual que al ser capturado: es la regla de la casa —«recógelas
aunque te capturen»— y sin ella abandonar sería *peor* que caer preso. No hay
atajo que explotar: quien abandona renuncia justo a lo que da el cerco.

### 6.14 · El cuadro estaba vacío por arriba y lavado por todas partes — **resuelto**

Tres fallos distintos que se leían como uno solo («no se parece a la
referencia»), y ninguno era el que parecía.

**El primero: las texturas procedurales entraban en el espacio de color
equivocado.** `new THREE.CanvasTexture(...)` sin declarar `colorSpace` entra al
motor como si sus valores YA fueran lineales, así que el `#6b6a68` del asfalto
—0,42 de claridad— salía a pantalla en 0,68. Afectaba al asfalto (`Track.js`) y
a TODO lo procedural de `props.js` —chevrones, rótulos, persianas, el cartel del
dron—, que es media textura del juego. Se descartó la iluminación por medición
antes de encontrarlo: bajarle la mitad al ambiente movía la claridad media de la
Bahía del 0,674 al 0,666, o sea nada. El cielo de `utils/entorno.js` ya llevaba
la línea, con el mismo comentario, desde el día que se escribió.

Consecuencia de arreglarlo: las paletas llevaban compensando en la dirección
contraria, así que el mundo se quedó oscuro. De ahí la exposición por barrio
(`escenarios.js`), que tampoco puede ser global: a 1.8 las Elecciones caen justo
en la horquilla de la referencia y el Apagón sube a 0,409 de claridad, o sea
deja de ser un apagón.

**El segundo: el techo del cuadro no lo puede llenar nada que esté al lado.**
Medido por rayos, el quinto superior estaba vacío de lado a lado en los tres
barrios a cielo abierto. Subir las fachadas ayudó —el cielo de esa mitad bajó del
57,8 % al 46,3 %— pero no llegó, y la medida dice por qué: **en vertical, a diez
metros sólo se ven 4,2 m a cada lado del eje, y a veinte, 6,5**. La manzana está
en |x| = 7,8, o sea que la fachada que pasa al lado —la única lo bastante cerca
como para llegar arriba— cae fuera del cuadro. Lo que se ve arriba son las
manzanas de cuarenta metros para allá, y ahí harían falta 16 m de altura para
tocar y=0.10: cinco plantas, que en el centro histórico ya no es el centro
histórico. Lo llena lo que CRUZA por encima, que es lo que hace la referencia con
los pórticos de estación y lo que ya hacía aquí la bóveda de la Bahía. De ahí el
cruce aéreo: maraña de cables en el Apagón, pancarta de campaña en las
Elecciones, tendido con banderas en Carondelet.

**El tercero: el encuadre no era el que decía la configuración.** `_ajustarEncuadre`
abre el vertical para garantizar un ancho mínimo, y ese suelo —`SEMIANGULO_HORIZONTAL: 16`—
**se activaba siempre** en un móvil vertical: el FOV efectivo era 63,74 y no 58,
así que la cámara nunca corrió con la focal de diseño. Y a aspecto 0,562 —un
iPhone SE— no se activaba: dos móviles corrientes, dos encuadres distintos. Por
el otro lado, el techo (`SEMIANGULO_HORIZONTAL_MAXIMO: 34`) recortaba tanto en
escritorio que **los pies del personaje caían en 1,091, fuera de pantalla**, y en
un móvil tumbado hacía falta además un suelo al propio vertical (`FOV_MINIMO`).

| medida | antes | ahora | referencia |
|---|---|---|---|
| cielo del cuadro — apagón / elecciones / carondelet | 30,0 / 24,6 / 28,1 % | **16,0 / 8,3 / 11,0 %** | 14-22 % |
| cielo de la mitad superior | 57,8 / 50,3 / 56,5 % | **25,5 / 22,4 / 25,5 %** | — |
| saturación — bahía / elecciones / carondelet | 0,307 / 0,416 / 0,409 | **0,373 / 0,533 / 0,439** | 0,45-0,60 |
| saturación de la calzada — bahía | 0,213 | **0,319** | — |
| reparto de valores de la Bahía | 78 % en una banda | 53 % | — |
| alto del personaje en pantalla | 0,165-0,186 | **0,30** | ~0,25 |
| FOV efectivo en móvil vertical | 63,74 (¡no 58!) | **56** | — |
| pies del personaje, escritorio 16:9 | **1,091 (fuera)** | 0,954 | < 1 |
| pies del personaje, móvil tumbado | **1,044 (fuera)** | 0,964 | < 1 |
| valores por caja (superior : frontal : lateral) | 1,59 : **1,01** : 1,00 | 1,58 : **1,22** : 1,00 | tres |

Lo de los valores por caja es el sol: en (6, 15, 4) estaba a 64° de elevación y
las dos caras verticales eran indistinguibles, o sea que cada caja tenía DOS
valores y no tres. Bajarlo a (7.5, 9, 5) —44°— cuesta cero y es además la altura
a la que está el sol en las fotos de las que sale cada barrio.

**A comprobar a mano:** que el cruce aéreo no se lea nunca como obstáculo que hay
que agachar (va a 9 m, y el techo de lo alcanzable son 8,55: tablado a 3,15,
salto con botas 3,60 y 1,80 de personaje).

---

### 6.15 · La ciudad era ancha y tumbada — **resuelto**

Lo de arriba llenó el techo del cuadro, pero por el camino resolvió mal una
cosa: subió las casas AÑADIENDO PLANTAS. En la referencia no hay más plantas,
hay las mismas estiradas — todo angosto y apretado, con las verticales largas.
Una casa colonial de tres plantas además es históricamente falsa: la casa de
patio del centro tiene dos y punto.

Así que se deshizo y se rehizo por proporción, no por cantidad:

| | antes | ahora |
|---|---|---|
| casa de Guayaquil | 3,2 + 3,0 + 0,6 = **6,8** | 4,3 + 4,3 + 0,85 = **9,45** |
| casa colonial | 3,1-3,6 + 2,5-2,9 = **5,6-6,5** | 4,2-4,8 + 3,5-3,9 = **7,7-8,7** |
| frente de cuadra (GYE / centro) | 13,5 / 14 | **10 / 10,5** |
| frente de local (GYE) | 2,6 | **1,95** |
| torre del Apagón, esbeltez | 1:6,7 | **1:9,8** |
| hilera de la Bahía, escala | 1,5 en los tres ejes | **1,25 de frente, 1,95 de alto** |
| bóveda: clave / semiluz | 7,2 / 9,9 = **0,73** | 8,8 / 7,5 = **1,17** |
| vereda hasta la fachada | 3,4 | **2,2** |

El puntal alto no es licencia: en Guayaquil los entresuelos miden cuatro metros
y pico porque sin aire acondicionado el techo alto ERA la ventilación, y en
Quito por lo mismo al revés —guardar el calor del día a 2.800—. Lo que sí hubo
que rehacer con ellos son los huecos: una persiana de 2,2 bajo un techo de 4,3
deja metro y medio de pared muerta y el local se lee como una alacena, así que
persianas, portales y ventanas crecen con el puntal (0,76-0,77 de la planta) y
la ventana de balcón pasa a ser a la francesa, 1,0 × 2,6.

Resultado medido, con la cornisa a veinte metros y el cielo por rayos:

| | antes de todo | tras subir plantas | ahora, por proporción |
|---|---|---|---|
| cornisa a 20 m (elecciones) | 0,245 | 0,199 | **−0,014** (sale por arriba) |
| cornisa a 40 m (elecciones) | 0,280 | 0,250 | **0,094** |
| cielo del cuadro (apagón / elec. / carondelet) | 30,0 / 24,6 / 28,1 % | 16,0 / 8,3 / 11,0 % | **15,8 / 6,6 / 11,4 %** |
| cielo de la mitad superior | 57,8 / 50,3 / 56,5 % | 25,5 / 22,4 / 25,5 % | **~21 / 13,3 / 23,8 %** |

Y un fallo que sólo se vio al acercar la cámara: **los papeles que vuelan por
la Bahía cruzaban el plano del objetivo**. Reciclaban en z > 15, o sea nueve
metros POR DETRÁS de la cámara. Medido sobre la foto, una hoja de 0,5 × 0,65 a
2,2 m de la lente tapa el 40 % del ancho del cuadro: salía un rectángulo blanco
pegado al objetivo. Ahora se encogen entre −2 y +4 y reciclan en z > 4. Se
encogen en vez de desvanecerse porque el material va compartido entre las doce
y la opacidad es del material.

**A comprobar a mano:** que el pasillo apretado no haga que la bocacalle del
cruce se vea peor. Medido da 18-33 rayos de 576 a las cuatro distancias —contra
8-81 con la vereda ancha y contra 0 antes de que la bocacalle existiera—, o sea
que se ve menos que con la calle ancha pero se ve; si en mano se lee justo, lo
que toca es abrir el hueco del decorado, no volver a ensanchar la vereda.

---

### 6.16 · Volvió a congelarse, y el culpable era el bisel — **resuelto**

El §6.10 arregló tres relojes que se peleaban; esto es otra cosa. Cronometrando
cada parte del montaje con el reloj parado:

| | construir el barrio | de eso, `_crearDecorado` |
|---|---|---|
| Bahía | **1.650 ms** | 1.648 |
| Elecciones | **1.787 ms** | 1.781 |
| Carondelet | **1.073 ms** | 1.069 |
| Apagón | 33 ms | 15 |

Y un fotograma normal de juego cuesta **0,4 ms**. O sea: no había ningún
problema de rendimiento sostenido, había un segundo y medio metido en un solo
fotograma. El cruce aéreo nuevo cuesta 0-15 ms y el dron cero; no eran ellos.

**Primera causa: el bisel, y una cuenta de píxeles mal hecha.** `RADIO_MINIMO`
estaba en 0.012 con el argumento de que por debajo de eso el bisel no ocupa un
píxel. El argumento era bueno y el número estaba mal: a veinte metros la
pantalla vertical abarca 13 m en 393 píxeles, o sea 3,3 cm por píxel, y un
bisel de 1,2 cm es un tercio de píxel. Barrido:

|suelo|bahía|elecciones|carondelet|piezas biseladas (bahía)|
|---|---|---|---|---|
|0.012|1650|1787|1073|2300|
|0.020|1126|834|628|1290|
|0.030|818|819|541|985|
|**0.045**|**420**|**679**|**357**|**158**|
|0.060|210|582|318|67|

Con el bisel apagado del todo y el MISMO decorado costaba 207 / 88 / 107, así
que el bisel era el coste entero. Y no es el número de segmentos —con uno solo
costaba 1.688— sino el coste fijo por pieza: construir la caja redondeada,
soldarle los vértices y volver a clonarla y transformarla dentro de
`fundirPorMaterial`. Con 0.045 se bisela lo que tiene volumen y se deja con
arista viva lo que es lámina, que es donde no se veía.

**Segunda causa: treinta y dos manzanas en un fotograma.** Bajado el bisel
quedaban 350-615 ms, y eso ya no se puede abaratar por pieza: son doce a
diecinueve milisegundos por manzana y es trabajo real. Lo que se puede es no
hacerlo todo a la vez. Ahora `_crearDecorado` solo APUNTA las treinta y dos y
`construirPendientes(6)` levanta las que quepan en seis milisegundos por
fotograma, mientras el barrio está aparcado durante la aproximación —que dura
cientos de metros—. `rematarDecorado()` termina lo que quede justo antes de
enseñarlo, y medido nunca queda nada: los tres fotogramas caros de una corrida
de cuatro tramos llegan con **cero pendientes**.

Una pieza que se levanta veinte fotogramas tarde tiene que nacer donde estaría
si hubiera nacido con las demás, no en su z de origen; de ahí `recorridoDecorado`.

**Resultado**, corriendo cuatro tramos completos con sus tres bifurcaciones
(9.288 fotogramas):

| | antes | ahora |
|---|---|---|
| peor fotograma | ~2.200 ms | **29-95 ms** |
| fotogramas > 100 ms | uno por barrio y visita | **0-1** |
| fotogramas > 16,6 ms | — | 39 de 9.288 |
| p50 / p95 / p99 | — | 0,1 / 0,2 / 1,4 ms |

**Lo que queda abierto:** el fotograma del cruce sigue costando 29-95 ms y no
está en ninguna de las diez partes cronometradas —remate 0,1, cielo 0, pista
0,5, obstáculos 0,3, precarga 1,6, partículas 0, efectos 0, bifurcación 0,
viraje 0,2, polvo 0,1—. Son dos a seis fotogramas perdidos UNA vez por esquina;
antes de seguir buscando conviene comprobar en mano si se nota.

---

### 6.17 · Se doblaba contra la pared, y una pared tapaba el giro — **resuelto**

Dos fallos distintos que se sentían como uno.

**Se doblaba en el sitio equivocado.** El viraje disparaba en `this.z >= 0`, o
sea en el plano del cruce: la fachada de la institución. Con la calle
transversal montada delante —doce metros de intersección— eso significa que el
jugador la cruzaba ENTERA y viraba al llegar al bordillo de enfrente. Ahora
quien se va por un lado dobla en el EJE de la calzada a la que entra, que es lo
que hace un coche: `BOCACALLE.EJE` = 6 m antes, 0,23 s a velocidad de crucero.
Quien sigue de frente no —ése va a la puerta— y por eso el umbral depende del
carril y llega desde `Game`.

**Y una pared tapaba la esquina, medida rayo a rayo.** Atribuyendo cada impacto
de una rejilla de 576 a su dueño, con el cruce a varias distancias:

| | institución | calle transversal | medianera | manzana del barrio |
|---|---|---|---|---|
| 40 m | 4,3 % | **0,7 %** | 1,7 % | 93,2 % |
| 24 m | 18,6 % | **0 %** | 10,9 % | 70,5 % |
| 14 m | 45,3 % | **0 %** | 18,1 % | 36,6 % |
| 10 m | 72,6 % | **0 %** | 16,7 % | 10,8 % |

La calle a la que se dobla no salía en pantalla. Y no era el edificio: era **la
manzana del propio corredor**. Apuntando un rayo al eje de la calzada
transversal con el cruce a cuarenta metros, el punto SÍ está en cuadro —cae en
x = 0,094, pegado al borde izquierdo— pero el rayo choca antes, a veintitrés
metros, contra la fachada de al lado. Con razón: mirar la bocacalle es mirar
muy de refilón, y una visual tan oblicua atraviesa la manzana de enfrente
veinte metros antes de llegar.

O sea que el hueco que hay que abrir en el decorado no lo fija el ancho de una
manzana —que es lo que fijaba `MARGEN_DECORADO: 8`— sino la visual. Por detrás
del cruce siguen bastando ocho metros; por delante hacen falta treinta
(`MARGEN_DECORADO_DELANTE`). Y esto empeoró al apretar el pasillo en §6.15 —la
fachada pasó de 6,15 a 4,95 del eje—: con la calle ancha la visual se colaba
por el hueco de siempre, y por eso el fallo apareció ahora.

Con la esquina abierta, a cuarenta metros se ve el edificio de frente y **las
dos fachadas de la transversal a los lados, cada una del color del barrio al
que lleva**, más las flechas del asfalto. Que es lo que la bocacalle venía a
hacer desde el principio.

Un cabo suelto que abre este cambio y va cerrado: las piezas apagadas para
abrir la esquina se quedan apagadas hasta reciclar —es un pestillo a propósito,
sin él la manzana se encendería en el fotograma del cruce a dos metros del
jugador— pero al VOLVER a ese barrio el pestillo ya no protege nada y sí deja
agujeros: con la banda en cincuenta metros son tres o cuatro manzanas por lado
que tardarían 240 m en recuperarse. `reanudar()` las devuelve enteras.

---

### 6.18 · El salto metía al personaje debajo del cartel — **resuelto**

Lo primero que hay que decir de esto es que **las dos primeras mediciones eran
falsas**, y merece la pena dejarlo escrito porque el error es de los que se
repiten:

1. El arnés forzaba `jugador.y` desde fuera para simular estar en la tarima. El
   MODELO no se entera —lo coloca `jugador.actualizar()`— así que la caja
   envolvente medía un personaje en el suelo con la cámara subida a tres metros.
   Salían cifras de escándalo (cabeza en −0,70, o sea fuera del cuadro) que no
   pasaban en el juego.
2. La corrección nueva proyectaba con `camara.project()` **sin actualizar la
   matriz**. Three sólo recalcula `matrixWorldInverse` al renderizar, así que
   leía la cámara de un fotograma antes —o de mucho antes, en una prueba que no
   pinta— y devolvía imposibles: un punto más alto proyectando más abajo que
   otro más bajo.

Con las dos cosas arregladas —subir a la tarima por su rampa como se sube
jugando, y `updateMatrixWorld` antes de proyectar— el encuadre real es:

| | cabeza en pantalla, en reposo | en el pico del salto |
|---|---|---|
| en la calle | 0,660 | **0,520** |
| sobre el tablado (3,15 m) | 0,506 | **0,392** |
| tablado + salto con botas (6,75 m) | — | **0,325** |

Y con los factores de antes (0,45 la posición y 0,12 la mira) el pico desde el
tablado quedaba en **0,304**, y el de botas en torno a 0,24. El cartel de salida
de la bifurcación ocupa la banda **y = 0,09-0,27**: ahí es donde se metía. No
era que los letreros estorbasen, era que el salto lo llevaba debajo de ellos.

Los factores suben a 0,80 y 0,55. Barrido, con la cabeza en el pico de un salto
en la calle: 0,45/0,12 → 0,419; 0,65/0,35 → 0,485; **0,80/0,55 → 0,520**;
1,00/0,85 → 0,545. Más arriba tampoco sale gratis: la cámara vuelve rezagada al
aterrizar y los pies se acercan al borde de abajo.

Y queda una red, `CAMARA.TECHO_PERSONAJE`: si la cabeza entrara en la banda del
cartel, la cámara y la mira suben LA MISMA cantidad hasta sacarla —trasladar las
dos no cambia el picado ni gira nada, que es la lección de §6.5—. No se dispara
en ninguno de los tres casos de la tabla, y es lo correcto para una red.

**Comprobado además:** nada de geometría se interpone entre la cámara y el
personaje mientras va por arriba —240 fotogramas de rayo cámara-pecho, cero
intersecciones—, así que el cruce aéreo nuevo a 9 m no le pasa por delante.

---

### 6.19 · No había ni una sombra en todo el juego — **resuelto**

`shadowMap.enabled = false` y ninguna falsa: nada TOCABA el suelo. Es de esas
cosas que no se saben señalar —el mundo «parece maqueta» por muy bien iluminado
que esté— y en la referencia está clarísima: el personaje lleva su mancha
blanda debajo, y es la mitad de lo que lo hace sólido.

No se enciende el mapa de sombras de verdad, y no por comodidad: es una pasada
extra de render sobre las mil y pico llamadas que ya cuesta un barrio. A esta
escala se imita con una mancha, que además se puede poner exactamente donde
hace falta —a ras del suelo que toque, sea la calle o el tablado— sin depender
de dónde esté el sol.

**Y no es decoración, es información.** Mientras estás en el aire, la sombra es
lo único que dice DÓNDE vas a caer. En un juego que va de saltar huecos de 4,5
a 7,2 m y de cambiar de carril en el aire, eso no es un adorno. Encoge al 45 % y
se apaga al 20 % conforme subes, y desaparece pasados 3,2 m —por encima del
salto normal (2,2) y por debajo del de botas (3,6)—.

Dos intentos fallidos que conviene dejar escritos porque los dos parecían
correctos:

1. **Mezcla multiplicativa.** Es la que hace de verdad una sombra —oscurece el
   color que ya hay en vez de pintar gris encima— pero multiplica TODO el
   cuadrado, y la parte transparente del degradado vale cero en premultiplicado:
   salía un cuadrado negro. Con transparencia normal la mancha queda algo más
   plana y a cambio se controla con la opacidad, que es lo que hace falta para
   desvanecerla al saltar.
2. **Con niebla.** Parecía obligatorio —todo lo demás se difumina— y hacía lo
   contrario: a cuarenta metros la mancha se mezcla hacia el color del cielo y
   DEJA DE SER OSCURA. Con una docena de obstáculos en pista salía un velo
   claro cubriendo media calzada. Medidas las manchas, el tamaño era correcto
   (2,4 m, un carril), o sea que no era la escala sino el color. Una sombra no
   es un objeto en el aire: es una modulación del suelo, y ese suelo ya lleva su
   niebla.

Y una tercera trampa, ésta de tamaño: el radio de la sombra de un obstáculo
salía de su caja envolvente, que **incluye sus halos y su cono de luz**. Salían
manchas de diez metros trepando por las fachadas. Va acotado a [0,55 · 1,5], que
es la huella de un carril.

Coste: cero medible. Peor fotograma de una corrida de cuatro tramos, 64 ms —el
mismo que sin sombras—, y la saturación y el reparto de valores de los cuatro
barrios no se mueven.

---

### 6.20 · Seguía congelándose, y no estaba donde miraba nadie — **resuelto**

El §6.16 quitó segundo y medio metido en un fotograma y aun así el juego seguía
dando tirones. La razón por la que no aparecían en ninguna medición es que
**todas las anteriores llamaban a `_actualizarJuego` en un bucle cerrado, sin
pintar**. Y lo que estaba pasando no pasa al actualizar: pasa al RENDERIZAR.

**Compilar sombreadores.** Contando programas del renderizador a lo largo de una
partida real:

| momento | programas |
|---|---|
| menú | 39 |
| intro | 45 |
| primer tramo | **57** |
| a los 27 s | **63** |
| entrar al Apagón | **76** |
| entrar a Carondelet | **87** |

Cuarenta y ocho sombreadores compilándose con la partida en marcha. Compilar y
enlazar GLSL es síncrono: bloquea el hilo, y en un móvil cuesta de veinte a
doscientos milisegundos cada uno.

**Y la causa de fondo no era la cantidad de materiales: era el recuento de
luces.** El número de luces de cada tipo entra en las MACROS del sombreador
(`NUM_POINT_LIGHTS`, `NUM_SPOT_LIGHTS`), o sea que forma parte de la firma con
la que Three decide si un material necesita un programa nuevo. Cambiar el
recuento recompila TODOS los materiales de la escena. Diferenciando las claves
de caché de antes y después de cruzar a otro barrio, los catorce programas
nuevos se distinguían **exactamente en los mismos dos campos**, y los dos eran
recuentos de luces.

Y el juego los cambiaba a todas horas, porque varias piezas traían su luz
colgada. Medido con el juego corriendo:

| | luces puntuales | programas |
|---|---|---|
| lo normal | 2 | 92 |
| aparece una prueba | 3 | **96** (+4) |
| aparece un potenciador | 4 | **107** (+11) |
| desaparecen las dos | 2 | 107 |

Volver a un recuento ya visto es gratis; llegar a uno nuevo recompila. Y las
pruebas salen en el 18 % de los grupos, los potenciadores cada 320 m, el Apagón
traía seis luces piloto, Carondelet dos focos y el trámite tres farolas.

**La solución es la de siempre en este oficio: presupuesto fijo de luces.** Ver
`game/Luces.js`. Se crean al arrancar —cinco puntuales y dos focos—, se cuelgan
de la ESCENA y no del barrio, y no se añade ni se quita ninguna nunca más. Las
piezas ya no llevan luz: la PIDEN, y quien las mueve la coloca. La prueba más
cercana usa un hueco, el potenciador vivo otro, el trámite dos, y el Apagón pasa
de seis luces piloto a una que va rotando entre sus seis posiciones —a la
velocidad a la que se corre, y con el parpadeo de fluorescente moribundo, se lee
igual: lo que hace el efecto es que aparezca y desaparezca, no que haya seis—.

Cinco y no ocho porque cada puntual se evalúa por fragmento en todos los
materiales: el presupuesto fijo arregla los tirones, pero no es gratis al
pintar.

**Y aparte, precalentar.** Con la portada delante —que es la pantalla de carga
que este juego ya tiene— se construyen los otros tres barrios y se compilan sus
materiales SIN colgarlos, con `compile(objeto, camara, escenaDestino)`, más las
dieciséis combinaciones de obstáculo (que son distintas en cada barrio) en un
grupo que no se cuelga de ninguna escena.

Colgar los cuatro barrios a la vez para compilarlos, que fue el primer intento,
salía PEOR: cada barrio traía entonces sus cinco luces, así que la escena pasaba
de cinco a veinte y lo que se compilaba era una variante que el juego no iba a
usar jamás.

**Resultado:**

| momento | antes | ahora |
|---|---|---|
| menú | 39 | 50 |
| primer tramo | 57 | 54 |
| 35 s corriendo | 63 | **55** |
| entrar al Apagón | 76 | **60** |
| Carondelet | 87 | **59** |
| **compilados en marcha** | **48** | **9** |

Y en el arnés de lógica, que ya iba bien, todavía mejora: de 38 fotogramas por
encima de 16,6 ms a **6** sobre 9.286, con el peor en 54 ms.

---

### 6.21 · Del guion, sigue sin implementarse — **abierto**

Cuatro cosas listadas en `docs/GUION.md` y todavía no en el juego:

- **Gas lacrimógeno** en el Centro histórico, como atmósfera que estorba la
  vista y no como obstáculo con colisión.
- **Pandilleros armados** como variante del bloqueo de carril en Elecciones.
- **Locales cerrados** con persianas bajadas como decorado propio de la Bahía.
- **Voces de calle** al recoger evidencia, con un tono distinto por barrio.

Las dos primeras son las que más aportarían: son las únicas que cambiarían cómo
se juega un barrio concreto.

---

### 6.22 · Treinta y un megas de imagen que el juego tiraba a la basura — **resuelto**

Llegaron seis modelos nuevos —genérico, ministro, policía, Roy y los dos
protagonistas rehechos— y pesaban **31 MB entre los seis**. El 95 % de cada
archivo era UNA imagen: un atlas de 2048×2048 en PNG, entre 4,3 y 5,2 MB.

Y el cargador la tiraba. La línea era ésta, y no tenía condición ninguna:

```js
piel.material = material({ vertexColors: true, ... });
```

O sea que el juego bajaba treinta y un megas, los descodificaba, y luego
sustituía el material que los usaba por otro que pintaba los personajes él
mismo, isla a isla. Se pagaba entero un trabajo para no usarlo.

**Lo que cuesta un atlas.** Interpretando los mismos bytes en el navegador,
alternando gordo y fino para que un tirón del contenedor no se llevara la
medida:

| | bytes | interpretar |
|---|---|---|
| con atlas de 2048² | 5,1 MB | 2.290 ms |
| con atlas de 512² | 0,29 MB | 1.670 ms |
| **sin ninguna imagen** | **0,24 MB** | **2 ms** |

Y el detalle que decide el diseño: **el coste no depende del tamaño de la
imagen**. Con el atlas reducido a 32×32 el archivo tarda lo mismo que con el de
512×512. Lo que se paga es que HAYA una imagen —el camino de textura del
cargador, con su `createImageBitmap`—, no cómo de grande sea. Encoger la imagen
recupera bytes; sólo quitarla recupera tiempo.

**Y aun así se queda.** Porque puestos uno al lado del otro no hay discusión:

- La pintura por islas da manchas planas y una cara sin cara. Clasifica trozos
  de malla por el hueso del que cuelgan y les asigna un color de una paleta.
- El atlas del modelador trae ojos, cejas, barba, labios, la tela con su
  sombra, el chaleco con POLICÍA escrito en la espalda y la banda tricolor de
  Roy. Nada de eso lo puede inventar un clasificador de islas.

Es el caso raro en que la respuesta correcta no es la que dice el contador de
bytes. Se paga el camino de textura y se recorta la imagen a lo que de verdad
hace falta.

**Cuánto se recorta, medido.** No comparando las imágenes píxel a píxel —la
mitad del atlas son huecos que no toca ninguna cara— sino el color en el
centroide UV de CADA triángulo, en Lab, original contra candidato, con los seis
modelos y sus ~4.200 triángulos cada uno:

| candidato | KB medio | ΔE medio | % ΔE>5 | peor |
|---|---|---|---|---|
| webp 1024 q90 | 110,4 | 1,88 | 5,9 % | 51,5 |
| **webp 512 q90** | **42,7** | **2,44** | **9,6 %** | 58,7 |
| png 512 (64 colores) | 108,2 | 2,73 | 13,1 % | 71,4 |
| webp 256 q90 | 17,5 | 3,58 | 17,9 % | 72,4 |

512 q90. Un ΔE de 2,4 está en el límite de lo que se distingue con las dos
muestras pegadas, y aquí no lo están: el personaje ocupa 0,30 del alto de la
pantalla, unos 320 px en un móvil. Renderizados uno encima de otro, el de 2048
y el de 512 no se diferencian. 1024 costaría 2,6 veces más bytes para bajar el
ΔE de 2,44 a 1,88, y no se paga. El PNG, para llegar a los mismos bytes, hay que
cuantizarlo a 64 colores y da MÁS error que el webp.

El error que queda tampoco está repartido: se concentra en los bordes entre
islas del atlas, que es donde el reescalado mezcla dos colores planos. Ese borde
en la malla es una arista que la luz ya rompe.

**Total: 31,0 MB → 1,78 MB.** La PWA entera, con los cuatro barrios y los nueve
personajes, precachea ahora 3,6 MB.

Se hace a mano, con `scripts/adelgazar-personajes.py`, no en el build: los
`.glb` versionados ya salen finos. El webp entra en el `.glb` por
`EXT_texture_webp`, que `GLTFLoader` trae de serie.

**Dos cosas más que salieron de aquí.** El material de fábrica de estos
archivos es **emisivo del 100 %** (`emissiveFactor [1,1,1]` con el mismo atlas
de mapa), que es como salen de Meshy: el personaje se ilumina solo, no le entra
la luz del barrio, no le llega la niebla y va igual de brillante de noche en el
Apagón que a mediodía en la Bahía. Se le pasa sólo el mapa de color a un
material del juego.

Y la pose de reposo de estos archivos es la de BIND, o sea **la cruz**: el
primer policía del cerco salió plantado con los brazos en aspa. No se le llama a
`reposarGLB()`; se le pasa su ciclo de carrera mientras se acerca y la pose de
estar de pie cuando se planta.

**Lo que sigue por islas.** Buencán y Monki no tienen archivo propio: salen del
cuerpo del tostadólogo. Si heredaran también su atlas irían los tres con la
misma camisa oscura y el mismo pantalón gris, y a ocho metros y de espaldas lo
único que los separa es la ropa. Ésos se quedan con la paleta.

---

### 6.23 · Los personajes salían deformes: la corpulencia sobraba — **resuelto**

Con los modelos nuevos puestos, los personajes salían **cabezones y con
manoplas**. No era el atlas: era una capa que llevaba meses ahí y que hasta
ahora tenía sentido.

`CORPULENCIA` reescribía los veinticuatro huesos de cada modelo al cargarlo
—cabeza al 126 %, manos al 155 %, hombros al 130 %, piernas al 80 % de largo—
para darle al personaje el achaparrado de los runners del género: tres cabezas
y media, sin cuello, miembros cortos y gruesos. Se horneaba en el clip de
carrera y en el esqueleto en reposo, así que no costaba nada por fotograma y lo
heredaban todas las poses escritas a mano.

Tenía su razón. Con los dos primeros archivos —que venían de un solo color y
con proporciones de persona— a veinte píxeles de alto y de espaldas lo único
que se leía era la silueta, y una figura realista a ese tamaño es un palo con
una bola encima.

**Ya no hay nada que arreglar.** Los seis modelos nuevos vienen hechos con sus
proporciones, y son las que se quieren. Encima peleaban con el atlas: la
textura está pintada sobre la malla en reposo, así que cualquier hueso que
cambie de grueso arrastra el dibujo con él. Y lo que se lee a veinte píxeles
ahora lo da la textura —el casco del antidisturbias, el sombrero, la banda
tricolor— que es más información de silueta y de color de la que daba engordar
un hueso.

Se quitó entera. Las estaturas que llegan al juego son ahora exactamente las
del archivo:

| | alto |
|---|---|
| Roy | 1,45 |
| Avecilla | 1,57 |
| genérico | 1,60 |
| tostadólogo | 1,70 |
| policía | 1,70 |
| ministro (el mando) | 1,85 |

**Y no se pierde nada de encuadre.** Medido con el juego corriendo: el
personaje ocupa **0,302 del alto de la pantalla**, que es exactamente el
objetivo al que se llegó afinando la cámara (§6.15). La corpulencia no estaba
comprando presencia en pantalla; eso lo compraba la cámara.

**Lo que colgaba de aquellas medidas.** Había dos constantes copiadas del
primer archivo que llegó —cráneo a 1,44, coronilla a 1,62, pecho a 1,12— y un
`CORONILLA = 1.62` a mano para sentar al de arriba del dúo. Con seis estaturas
distintas eso deja la boina de Buencán flotando sobre uno y clavada en la nariz
de otro, y a Roy o por encima del casco o metido dentro del pecho. Ahora se
**miden del propio esqueleto** al cargar (`medidasDe()`), y un séptimo archivo
con otra estatura entra sin tocar una línea.

Dos trampas de esa medición, las dos costaron una tarde:

- **Se mide la MALLA, no el hueso.** El hueso de la cabeza está en la base del
  cráneo, y entre uno y otro hay quince centímetros que cambian de modelo a
  modelo, más aún con casco. Se buscan los vértices que PESAN de la cabeza y se
  les toma la caja. Y la cabeza no es un hueso: son tres —`Head`, `head_end` y
  `headfront`— y el pelo y el casco se reparten entre los tres.
- **La matriz de la malla no se aplica.** Estos archivos traen la malla con
  escala 0,01 —el armazón viene en centímetros— pero los vértices ya están en
  metros. Y da igual, porque una malla con piel no usa su propia matriz para
  deformarse: usa `bindMatrix`, las matrices de los huesos y
  `bindMatrixInverse`. La primera versión aplicó `matrixWorld` y dijo que el
  tostadólogo tenía la coronilla a **2 cm del suelo**.

---

### 6.24 · Corría patinando, y las proporciones contra la referencia — **resuelto / medido**

**EL CLIP DEL ARCHIVO SE LLAMA `walking_man` Y ES LO QUE DICE.** Medido hueso a
hueso, muestreando el ciclo en sesenta posiciones: zancada 0,68 m, alza del pie
0,145 m, rebote de la cabeza 0,070 m, ciclo 1,07 s. Eso son 1,37 m de suelo por
ciclo, y a la escala que se usaba —1,055 a 20 m/s— el personaje «andaba» a 1,35
m/s mientras el mundo pasaba a 20: **patinaba 14,8 veces**. Que pareciera que
resbala en vez de correr no era una impresión, era la medida.

No se arregla igualando: para no patinar nada haría falta el clip a 15,6×, o sea
cuarenta y cinco pasos por segundo, que no es correr sino un abanico. Y bajar la
velocidad del mundo tampoco, porque la velocidad ES el juego.

**Se intentó exagerar el clip y no vale.** Se extrapolaba cada hueso alejándolo
de su reposo con un `slerp` de t mayor que uno —la fórmula extrapola, no está
acotada—. La zancada subía de 0,68 a 1,16 m, que era lo que se buscaba, pero:

- el pie se alzaba **0,88 m**, seis veces lo del clip y no las dos que se
  pedían, porque la extrapolación se MULTIPLICA por la cadena de huesos y
  muslo, rodilla y tobillo se componen;
- y la pierna salía **estirada en la recogida**, con las dos piernas abiertas en
  un spagat de vallista, porque un paseo casi no dobla la rodilla y extrapolar
  «casi nada» sigue siendo casi nada.

**Así que se escribe a mano.** Es el mismo ciclo que ya tenían los personajes de
cajas en `characters.js` —la rodilla dobla en la RECOGIDA y no en el apoyo, los
codos van doblados cerca de 90°, tronco y cadera giran en sentidos opuestos, el
rebote va al doble de la zancada— pasado a huesos y subido de tono, porque lo
que hace falta es que se lea a ocho metros, de espaldas y con el mundo pasando a
treinta por hora.

| | antes | ahora |
|---|---|---|
| zancada | 0,68 m | **1,08 m** |
| alza del pie | 0,145 m | **0,56 m** |
| cadencia | 0,9 pasos/s | **2,9 → 4,3** según la velocidad |
| patinaje | 14,8× | **4,7 → 6,9×** |
| cabeza por delante de la cadera | −0,03 m | **−0,13 m** |

Dos cosas costaron una foto cada una:

- **El signo.** `doblar` positivo echa el hueso hacia ATRÁS. Con el signo al
  revés el personaje corría echado para atrás, como quien frena.
- **Los tres `Spine` están numerados al revés de lo que parece.** `Spine02`
  cuelga de la cadera, `Spine01` va encima y `Spine` es el de arriba, del que
  salen cuello y hombros. Inclinando `Spine` sólo se echa hacia adelante el
  pecho —medido: la cabeza se movía 4,8 cm— y el personaje sale jorobado.
  Desde `Spine02` se inclina el tronco entero: 12,8 cm.

#### Y las proporciones contra la referencia

Se midió sobre una captura del original (1179×2556) con una rejilla encima, y
contra el juego corriendo en 393×852:

| | referencia | el juego |
|---|---|---|
| el personaje ocupa | 0,30–0,33 del alto | **0,318** |
| el obstáculo de esquivar mide | ~2,7 m | **2,6 m** |

O sea que **la escala no es el problema**: el personaje y los obstáculos están
donde tienen que estar. Lo que la referencia tiene y el juego no es DENSIDAD y
masa en el plano medio. En cualquier captura del original hay un tranvía entero
pegado al carril de al lado, comiéndose un tercio del cuadro, y edificios
apretados contra la vía sin acera de por medio. En el juego la calzada mide 8,8
m y se ve abierta y vacía: los buses están en la capa elevada, más lejos, y las
tiendas quedan detrás de una acera ancha.

Eso es lo que queda abierto, y es una decisión de nivel —cuánto se cierra la
calle— más que de escala. No se ha tocado nada: cambiar el ancho de la calzada o
la altura de los obstáculos mueve el salto, el agachado y el cambio de carril, y
eso se decide jugando, no midiendo.

---

### 6.25 · La carrera era lineal, y el limbo no se leía — **resuelto**

Dos cosas, las dos por lo mismo: de espaldas y a ocho metros sólo se lee el
CONTORNO, y las dos poses estaban dentro del contorno del cuerpo.

**LA ZANCADA IBA EN UN SOLO PLANO.** Vista desde atrás —que es el 95 % de la
partida— las dos piernas se tapan la una a la otra y lo que queda es un bulto
que sube y baja. Se le añadieron dos cosas que no tenía:

- **Apertura lateral.** La cadera abre hasta 0,36 rad hacia fuera al recoger y
  se cierra al plantar. Cada paso saca una pierna del contorno del cuerpo, que
  es lo que hace que se cuenten los pasos sin verles los pies.
- **Fase de vuelo de verdad.** El rebote de la cabeza pasa de 0,07 m (el clip
  original) a **0,148–0,205 m** según la velocidad, y la curva no es un seno
  sino un seno elevado a 0,62: deja al muñeco poco tiempo abajo y mucho arriba.
  Un seno pelado pasa medio ciclo a media altura y se lee como flotar; así se
  lee como despegar y caer. Más el bandazo lateral del tronco al ritmo de la
  zancada —no del rebote—, que es el cuerpo cayendo sobre el pie que apoya.

| | el clip | primera versión | ahora |
|---|---|---|---|
| zancada | 0,68 m | 1,08 m | **1,12 m** |
| alza del pie | 0,145 m | 0,56 m | **0,68–0,73 m** |
| rebote de la cabeza | 0,070 m | 0,05–0,08 m | **0,148–0,205 m** |

**Y EL LIMBO ERA UN LIMBO.** El personaje se echaba hacia atrás doblando la
cintura y pasaba por debajo del pórtico deslizándose. Funcionaba y no se leía:
de espaldas, un cuerpo echado atrás y uno de pie tienen el mismo contorno, y lo
único que decía «me agaché» era que la cabeza bajaba unos centímetros. En el
género no se hace eso: se RUEDA, y una voltereta se lee desde cualquier ángulo
porque el cuerpo entero da una vuelta.

Ahora es un rol hacia adelante, y son dos cosas a la vez:

- **El ovillo.** Rodillas al pecho, talones al culo, brazos abrazando y barbilla
  dentro. Sin esto la vuelta es la de un palo.
- **La vuelta, con el pivote donde toca.** Un cuerpo gira alrededor del centro
  del ovillo, no de los pies, pero el origen de esta malla ESTÁ en los pies: si
  se rota el cuerpo y ya está, el muñeco barre el suelo con la cabeza como una
  guadaña. Se compensa desplazando por `C − R·C`, la diferencia entre dónde
  acaba el centro y dónde tenía que quedarse.

Dos números que salieron de mirar la tira de fotogramas, no de elegirlos:

- **El centro del ovillo va a 0,31 de la estatura.** El extremo más lejano —el
  ala del sombrero— queda a unos 50 cm del centro, así que con el centro más
  bajo la cabeza pasa POR DEBAJO del asfalto en el punto bajo de la vuelta. A
  0,24 el sombrero desaparecía dentro de la calle durante dos fotogramas.
- **La vuelta necesita un reloj APARTE de `factorAgachado`.** Ése sube y vuelve
  a bajar —es una envolvente— así que a mitad de la agachada valdría lo mismo
  subiendo que bajando y el personaje rodaría hacia adelante y luego hacia
  atrás. `avanceRodada` va de 0 a 1 y sigue corriendo durante el desvanecido de
  la pose, para que la voltereta TERMINE en vez de cortarse a media vuelta.

---

### 6.26 · Las animaciones de Mixamo, retargeteadas a mano — **resuelto**

Con los `.fbx` delante se pudo cerrar lo que en §6.25 quedó abierto.
`SkeletonUtils.retargetClip` sigue sin servir —da el muñeco aplastado, con la
cabeza por debajo del pie— así que se escribió el retargeteador.

**No copia la rotación LOCAL de cada hueso, que es lo que falla.** Los nombres
coinciden pero los ejes no: un hueso no guarda una dirección, guarda una
rotación respecto a su padre, y «cero» significa cosas distintas en cada
esqueleto. Copia la orientación EN EL MUNDO, corrigiendo por la diferencia
entre las dos poses de reposo:

```
Δ            = inv(reposoMundoOrigen) · reposoMundoDestino
mundoDestino = mundoOrigen · Δ
localDestino = inv(mundoPadreDestino) · mundoDestino
```

Δ se calcula una vez. Los huesos se recorren de la cadera hacia afuera, porque
convertir a local pide el padre YA recalculado en ese fotograma.

**Tres trampas, las tres medidas y las tres silenciosas** —ninguna daba error,
las tres dejaban algo casi correcto:

- **El esqueleto de Mixamo está centrado en la cadera, no en el suelo.** Su
  cadera está a −8,2 y sus dedos a −99,9. Sacando el factor de escala de la Y de
  la cadera a secas salía **negativo** (−0,108), o sea con el salto invertido, y
  el personaje seguía pareciendo casi bien. Se mide la altura de la cadera
  **sobre sus pies**.
- **La pista de la cadera no va en metros.** La posición de un hueso se escribe
  en el sistema de su padre, y estos archivos traen el armazón con escala 0,01:
  la cadera está a 0,884 m del suelo pero su `position.y` vale **88,4**. Se
  restaba un desnivel de 0,121 metros a una pista que va por 88 —un 0,14 %— y
  los números decían que la corrección se había aplicado. El salto subía 1,3 cm
  en vez de 1,3 m.
- **Se posa en el suelo midiendo, no a ojo.** Se reproduce el clip entero, se
  busca el punto más bajo que alcanza cualquier hueso en cualquier fotograma y
  se compara con el punto más bajo en reposo. En la carrera ese punto es el pie
  que apoya; en el salto, el pie de la agachada previa; en el rol, la espalda al
  pasar por el suelo. En los tres es exactamente el que tiene que rozar el
  asfalto.

**El resultado**, horneado en `public/modelos/animaciones.glb`. Tres para la
partida y cuatro para la portada, que es una escena de entrevista y no una
carrera:

| | duración | cuadros | fps | para qué |
|---|---|---|---|---|
| correr | 0,73 s | 23 | 30 | el ciclo de la partida |
| salto | 1,70 s | 52 | 30 | con la aguja puesta por el juego |
| rol | 1,17 s | 36 | 30 | ídem |
| microfono | 6,33 s | 96 | 15 | el periodista aguantando el micro |
| discutir | 20,80 s | 313 | 15 | el entrevistado manoteando |
| secreto | 6,00 s | 91 | 15 | el entrevistado en confianza |
| arrancar | 1,63 s | 50 | 30 | el arranque, de pie a corriendo |
| golpe | 3,10 s | 94 | 30 | el choque **y** la derrota |
| montado | 5,80 s | 88 | 15 | Roy sentado sobre el mando |

**477 KB los nueve**, y un solo archivo para los seis personajes: comparten
esqueleto y nombres de hueso, y las pistas van nombradas por hueso, así que el
mismo clip se ata a cualquiera. Se rehornea con `npm run animaciones`.

Los de estar de pie van a 15 fps y no a 30: son gestos lentos y a 30 lo único
que se duplica es el peso. Y se **aplanan las pistas quietas**: en una pose de
estar de pie discutiendo los pies no hacen nada en veinte segundos, y guardar
seiscientas veinticinco copias del mismo cuaternión son ocho kilobytes por hueso
quieto. Si ninguna clave se separa más de medio grado de la primera, la pista se
queda con dos. Entre las dos cosas, el archivo baja de **608 a 375 KB**.

Medio grado es el umbral porque por debajo no se ve ni con el personaje
ocupando la pantalla entera, y porque un mocap real nunca da un hueso
EXACTAMENTE quieto: siempre tiembla en el sexto decimal.

**El micrófono es una antorcha.** El clip se bajó de Mixamo como «torch idle»
porque sostener una antorcha y sostener un micrófono son el mismo gesto: brazo
derecho adelantado a la altura del pecho, puño cerrado, y el peso cambiando de
pie cada tantos segundos. Lo que se le cuelga al puño ya lo pone la cinemática,
y lo cuelga del mismo hueso que antes.

**Y el entrevistado no está quieto:** primero suelta algo en confianza y después
se pone a discutir. Son los dos clips encadenados por reloj, veintisiete
segundos de ciclo. El orden es el chiste y por eso no se sortea: se acerca a
decir algo que no debería, y en cuanto se le repregunta empieza a manotear.

#### Cómo se enganchan, que tiene su detalle

**El clip no se reproduce a su ritmo, salvo la carrera.** El salto dura 1,70 s
en el archivo y el vuelo del juego dura lo que dure —depende del impulso, del
potenciador y de si se pulsó caída rápida—; la agachada dura 0,55 s y el rol
1,17 s. Así que a esos dos se les pone la aguja donde toca: `avance` va de 0 a 1
y el clip se recorre entero en ese trayecto. El aterrizaje del clip cae SIEMPRE
en el fotograma en que el personaje toca el suelo.

El avance del salto sale de una previsión hecha en el despegue —subir y bajar
con aceleración constante son 2·v₀/g— recortada a 1, porque la caída rápida lo
acorta y aterrizar sobre una tarima también.

**Y en cada instante manda UN clip o ninguno.** El mezclador reescribe cada
fotograma todo hueso que su clip toque, así que una pose escrita a mano puesta
antes se pierde entera, y un clip sonando debajo de una pose escrita a mano la
pisa al fotograma siguiente. Las acciones se crean todas al construir el
personaje y se dejan sonando a peso cero: crear una a mitad de partida cuesta un
enganche de bindings, y eso es un tirón justo en el fotograma del salto.

**Los ciclos escritos a mano se quedan** como reserva. No es nostalgia: los
personajes de cajas no tienen otro, y si `animaciones.glb` no llega el juego
tiene que seguir corriendo.

---

### 6.27 · Los relevos entre animaciones eran cortes — **resuelto**

Con siete clips en marcha apareció lo que con uno no se veía: **pasar de un
clip a otro poniendo uno a 1 y el otro a 0 en el mismo fotograma es un corte**.
El cuerpo entero salta de una postura a otra sin pasar por el medio. Se veía en
tres sitios —al entrar en la partida, al empezar a rodar, y cada vez que el
entrevistado pasaba de contar un secreto a discutir—.

Ahora cada clip tiene un peso OBJETIVO y el real lo persigue con un suavizado
exponencial. Se midió el relevo más grande de todos —el del entrevistado, de
manos juntas a manos abiertas— mirando cuánto se mueve su mano derecha entre
dos fotogramas seguidos:

| | mayor salto de la mano |
|---|---|
| sin fundido | de golpe, en un fotograma |
| a 12 por segundo | 30,4 mm (1,8 m/s de mano: un gesto brusco) |
| **a 8 por segundo** | **20,1 mm**, repartido en 0,3 s |

Más lento que 8 y los dos clips conviven tanto que se ve al personaje hacer las
dos cosas a medias.

**Y en la partida**, con la cabeza como testigo y `dt` fijo de 1/60 —corriendo,
la cabeza se mueve 10 mm por fotograma, que es la vara de medir—:

| relevo | antes | ahora |
|---|---|---|
| entrar al salto | — | 18 mm |
| salir del salto | 101 mm | **14 mm** |
| entrar al rol | 92 mm | **55 mm** |
| salir del rol | 34 mm | **4 mm** |

Los 101 mm de salir del salto no eran el fundido: eran **dos actualizaciones
del mezclador en el mismo fotograma**. Al volver de una pose, el jugador
llamaba a `reposarGLB()` y acto seguido al ciclo de carrera, y cada uno movía el
reloj. Con clips no hace falta reposar nada —el ciclo funde solo desde donde
esté—, así que sólo se reposa a los personajes de cajas, que no tienen clip.

Los 92 mm de entrar al rol eran la envolvente del jugador aplicada a pelo: sube
al 43 % en el primer fotograma, a propósito, porque la caja de colisión se
encoge de golpe. Ahora la imagen entra con su propio fundido encima y la caja
sigue encogiéndose cuando quiere.

Y el 55 que queda al entrar al rol no es un corte: es que **una zambullida
empieza rápido**. Lo mismo con los 57–101 mm que se miden DENTRO del salto justo
antes de aterrizar: un aterrizaje es una caída, y el mocap la tiene grabada.

### 6.28 · La entrevista se hacía desde el otro lado de la vereda — **resuelto**

El entrevistado estaba a 1,88 m del periodista. Con el clip del micrófono
puesto, eso deja el puño a medio metro largo de la cara del otro: los dos
parecen estar hablando cada uno con su pared, y el gesto de aguantar el micro
—que es la mitad de lo que cuenta la portada— no se lee, porque un micrófono
sólo se entiende si llega a alguien.

A **1,15 m** el puño queda justo delante del entrevistado. Es la distancia a la
que se hace una entrevista de calle: un brazo y pico.

---

### 6.29 · Un clip de golpe que sirve para dos cosas — **resuelto**

«Big body blow» dura 3,10 s y cuenta un porrazo entero. Medido con la cabeza y
el pie, tiene tres tramos:

| | |
|---|---|
| 0,00 – 1,05 s | viene corriendo (cabeza 1,19 → 1,34) |
| 1,05 – 1,70 s | el impacto y la caída (cabeza 1,34 → 0,25) |
| 1,70 – 2,95 s | en el suelo, quieto (cabeza 0,18) |

De ahí salen las **dos** cosas que el juego necesita y que no son la misma:

**El choque del que se sigue corriendo** dura 0,42 s y termina de pie, así que
no vale la caída. Se usa sólo el arranque del impacto —de 1,05 a 1,33— y se
vuelve: la aguja va y viene con un seno, y el peso hace lo mismo, así que el
cuerpo encaja el golpe y se recompone mezclándose con la carrera. Que es
exactamente lo que pasa: pierdes ritmo, no la partida. A media zancada, un
personaje que deja de correr de golpe se lee como que se ha colgado el juego.

Y **se va la peonza.** La vuelta entera sobre el eje de avance era un apaño de
cuando no había animación de choque: servía para que el golpe se leyera, pero un
corredor que da una pirueta completa cada vez que roza una barrera no se lee
como que le han dado, se lee como que el juego hace cosas raras. El aplastón se
queda, al 45 % de lo que era, porque el squash-and-stretch sigue siendo lo que
pone el golpe en el fotograma del impacto y no medio segundo después.

**La derrota** usa el final: tumbado y quieto, medido de 0,03 a 0,34 m de alto.
Y como el clip ya lo pone en el suelo, el jugador **no gira el modelo** el
cuarto de vuelta en X que hacía con la pose escrita a mano —eso lo tumbaría dos
veces: de espaldas al asfalto y de cara a él a la vez—.

**Y Roy va sentado de verdad.** El clip es un «sitting yell», que es
literalmente lo que hace sobre los hombros del mando: ir sentado y vociferar.
Las piernas ya vienen dobladas hacia adelante —que era lo que hacía a mano el
bloque de la pose— y encima gesticula.

---

## 7 · Cómo se prueba cada pantalla sin jugar

`/creador/pantallas/` abre cualquiera de las diez con datos de ejemplo, sobre
tres teléfonos (SE 375×667, iPhone 15 393×852, ancho 430×932) y con las zonas
seguras de iOS inyectables. Sale de `window.__catalogo`, que la previsualización
carga con `?debug=1`.

Es lo que hace que revisar la pantalla de sorteo o la de victoria cueste un clic
en vez de una partida entera, y por eso las pantallas raras dejaron de ser las
que nadie revisa.

### Y cómo se fotografía el mundo, que tiene más trampa

Para comprobar el 3D —el giro de la esquina, la luz de un barrio, un obstáculo—
hay tres trampas, las tres aprendidas por las malas:

- **`page.screenshot()` devuelve el lienzo WebGL en negro** en un navegador sin
  pantalla. Hay que leerlo con `canvas.toDataURL()` y arrancar el juego con
  `?foto=1`, que enciende `preserveDrawingBuffer`.
- **Con bloom, `toDataURL()` pilla el lienzo a medio escribir.** Medido: leyendo
  ocho fotogramas seguidos en el mismo instante, cinco salen enteros en negro y
  tres bien. El compositor escribe el framebuffer por defecto en su último
  pase y la lectura se cuela antes. Se lee en bucle hasta que salga un
  fotograma con contenido —o se apaga el bloom con `?calidad=baja`—. Media
  tarde se fue persiguiendo un «rectángulo negro gigante en mitad del giro» que
  no existía.
- **El reloj de pared no sirve para sincronizar.** Sin GPU el juego corre a
  cuatro fotogramas por segundo, así que un giro de 2,1 s tarda diez segundos
  de reloj. Hay que esperar al reloj DEL JUEGO
  (`bifurcacion.tiempoViraje / duracionActual`), no a un `setTimeout`.
