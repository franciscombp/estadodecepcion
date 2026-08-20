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
- **Tarimas** (la capa de arriba) cada 12 m de intento, de 55 a 95 m de largo,
  a 3,15 m de altura. Se sube por rampa, que da un impulso de 14,2 —sale de la
  altura, no se elige— y arriba se saltan los obstáculos de la calle.

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

### §6a · Si eliges un lado: el giro, y luego otro barrio

Doblar la esquina dura **2,1 s** y es la cinemática más vistosa del juego. Lo
que pasa, por orden:

1. El personaje **rota hasta 66°** hacia el lado elegido.
2. La cámara **recorre un arco alrededor de él**, hasta 24°, y se queda a su
   espalda respecto de la nueva dirección: al doblar a la derecha, la cámara se
   va hacia la izquierda. El personaje no se mueve del centro del cuadro; lo
   que rota es el mundo.
3. La cámara **se banquea 9°**, como quien se inclina en una curva.
4. Se levanta **polvo** de la esquina, y un destello corto acompaña el cambio
   de barrio entre el 20 % y el 46 % del giro.
5. Se cruza un **soportal** de 30 metros mientras el barrio de detrás se
   sustituye por el nuevo.

El arco es asimétrico: **se abre en el 32 % y se cierra en el 68 % restante**.
Se asoma a la esquina y vuelve enseguida a mirar la calle, porque la calle no
dobla de verdad —la pista sigue yendo a −Z y se sustituye entera— así que
sostener la mirada de lado sería sostenerla contra una pared.

Y el primer obstáculo del barrio nuevo se coloca contando **lo que queda de
giro**: el margen no son metros fijos, son los segundos que el jugador va a
tardar en poder ver. A velocidad de crucero eso pone el primer grupo a unos
**87 metros**, y cuando la cámara se endereza todavía quedan **1,5 s** de calle
limpia por delante.

Cambia la piel, la luz, los cuatro obstáculos y el caso que se documenta. La
velocidad, los papeles y la distancia **no se reinician**: la corrida sigue.

Los cuatro barrios y su hora del día están en la tabla de la sección 3.

**A comprobar:** que el personaje no se salga del cuadro en ningún fotograma
del giro (medido: nunca pasa del 21 % del ancho desde el centro); que el giro a
la derecha se sienta a la derecha; y que al enderezarse haya calle limpia y no
un obstáculo encima.

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

Aquí, y no antes, pasan dos cosas:

- Las pistas que **solo están en redes** salen marcadas: existen, ocupan su
  casilla, y no cierran ningún reportaje.
- **El material plantado se revela.** No ocupa casilla del caso —no es de este
  caso, es de quien te lo dejó ahí—, va en gris al final y, al abrirlo, lo
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

Debajo, el hueco del reportaje de El Mercio, con su sello de EN PREPARACIÓN.

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

### 6.10 · Los personajes no se llaman como dice el guion — **abierto, y es una decisión editorial**

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

### 6.11 · Del guion, sigue sin implementarse — **abierto**

Cuatro cosas listadas en `docs/GUION.md` y todavía no en el juego:

- **Gas lacrimógeno** en el Centro histórico, como atmósfera que estorba la
  vista y no como obstáculo con colisión.
- **Pandilleros armados** como variante del bloqueo de carril en Elecciones.
- **Locales cerrados** con persianas bajadas como decorado propio de la Bahía.
- **Voces de calle** al recoger evidencia, con un tono distinto por barrio.

Las dos primeras son las que más aportarían: son las únicas que cambiarían cómo
se juega un barrio concreto.

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
