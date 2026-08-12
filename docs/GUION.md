# GUION TÉCNICO — Estado de Excepción

Este documento es la fuente de verdad de **qué cuenta el juego**. `README.md`
explica cómo está construido; este explica por qué existe cada pieza.

Cuando lore y código no coincidan, manda este documento y hay que arreglar el
código. Cuando una idea de aquí no esté implementada, lo dice su ficha.

---

## Regla editorial

Es sátira, y se sostiene sobre una línea que no se cruza:

- **No se inventan reportajes de El Mercio.** El Archivo reserva el espacio de
  las piezas que faltan con un sello de «en preparación» en vez de rellenarlo
  (`src/config/publicaciones.js`).
- **No se ponen frases en boca de personas reales.** `CITAS_VERIFICADAS` está
  vacío a propósito: solo entra ahí lo que tenga fuente, fecha y enlace.
- Los **nombres de caso** (Porsche, Progen) se usan como rótulo temático de cada
  escena, que es como los nombra la prensa. Lo que el jugador recoge dentro
  son objetos genéricos —un USB, un chat, un acta— y nunca una afirmación
  concreta sobre nadie.
- Los perseguidores son **caricaturas**, no retratos. El juego lo dice en el
  menú, en letra que se lee.

Los **expedientes** de cada caso —cronología y enlaces a la prensa que lo
cubrió— viven en `docs/CASOS/`. Son material para documentarse, no piezas de
El Mercio: [caso Porsche](CASOS/PORSCHE.md).

---

## Premisa

Eres periodista de investigación. Estás haciendo preguntas en la calle: en la
Bahía, en las centrales térmicas, en las protestas del centro histórico
cercado. Preguntar es el trabajo, y preguntar es lo que te pone a correr.

El juego es una persecución sin final. No se gana escapando —de eso va el
chiste— sino aguantando de pie el tiempo suficiente para publicar.

### Personajes

**Los cuatro jugables trabajan para EL MERCIO.** No son cuatro corredores con
distinto sombrero: son cuatro plazas de una redacción, cada una con su sección
y su forma de meterse en problemas. Por eso la pantalla de selección no es una
tienda de skins, es el organigrama del periódico —debajo de cada nombre va la
sección, y esa palabra hace todo el trabajo del lore.

| | Quién | Sección | Qué hace |
|---|---|---|---|
| 🎩 | **Chochólogo** | Política | Jugable. Sombrero, gafas y treinta años de oficio. Lleva en la redacción más tiempo que casi todos los ministros que ha cubierto: se acuerda. |
| 🪕 | **Alondra** | Sociedad | Jugable. Rizos, ukulele y todavía cree que esto sirve. Pregunta lo que en la sala ya nadie pregunta, y por eso se lo contestan. |
| 🎖️ | **Buscán** | Investigación | Jugable a los 8 tramos. Boina y traje; pregunta como si ya supiera. Trabaja con documentos y se le nota el sobre bajo el brazo. |
| 🛡️ | **Blanki** | Calle | Jugable a los 18 tramos. Casco de espartana; no se aparta. En su sección el casco no es un chiste. |
| 🕴️ | **El bajito** | — | Persigue. Va montado sobre el grande y señala. |
| 🧍 | **El grande** | — | Persigue. Corre pesado y carga al otro. |

Todos llevan la misma credencial: lo que cambia es con qué entra cada uno a
preguntar. A Buscán le abren la puerta por el traje; a Blanki no la cierran
porque está en medio.

### De dónde salen, y hasta dónde llega el guiño

Los cuatro están basados en **periodistas incómodos para el gobierno**, y dos
de ellos llevan el guiño en el nombre: **Buscán** por Andersson Boscán y
**Blanki** por Blanca Moncada.

**El desvío es el chiste.** No es que no se note de quién viene: es que no sea
exactamente. Se reconoce y a la vez no es él, que es la única forma de hacer un
guiño sin firmar por nadie. En Buscán el desvío encima paga doble —Boscán →
Buscán— porque además de sonar igual es lo que hace el personaje y lo que hacen
con él: para eso la tabla de acumulado se llama LOS MÁS BUSCADOS.

**El guiño no se explica en pantalla.** Ni en la ficha, ni en un pie, ni en un
huevo de pascua. Un guiño explicado deja de ser un guiño y pasa a ser una
atribución; quien lo pilla lo pilla, y quien no, se queda con dos personajes
que funcionan solos.

Lo que sí toman prestado es **el oficio y la terquedad**: el que trabaja con
documentos y llega con el sobre bajo el brazo, la que cubre desde el sitio y no
se aparta cuando le dicen que se aparte.

> **Regla editorial, y esta no se toca.** No llevan sus casos, ni sus medios,
> ni una sola frase suya. No se les pone nada en la boca ni se les atribuye
> nada que no hayan hecho. Un guiño es un nombre parecido y una manera de
> trabajar; todo lo que vaya más allá ya es hablar por ellos, y para eso no hay
> permiso.
>
> Y salen **bien parados**, que también cuenta: aquí los periodistas son los
> protagonistas y los que preguntan, y quien queda retratado es la oficina que
> se los quita de encima. Es la misma regla de siempre —se satiriza el trámite,
> nunca una cara— y ninguna de estas dos caras es la satirizada.

Lo que los distingue en pantalla es **la silueta de espaldas**, que es como se
les ve el 99% del tiempo: sombrero de ala, rizos, boina ladeada, casco con
cresta. El detalle de la cara no lo ve nadie.

Los dos persiguen **desde atrás**, en cuadro, entre la cámara y el jugador,
y **pegados a un lado**: de frente le tapan al personaje el cuerpo entero.
La amenaza se lee por el hueco que se cierra, no por el tamaño —ver la sección
de cámara en el README para por qué no pueden crecer al quedarse atrás.

La cámara es **corta y de gran angular**, la de un runner de móvil: estás
encima del personaje, la vía se abre hacia ti y los laterales pasan de largo
por el borde del cuadro. Se ve la persecución desde dentro, no desde la
tribuna.

---

## Cinemática de arranque

> **Estado: implementada** — `src/game/Intro.js`

Antes de la primera zancada:

1. **La entrevista.** Estás de pie, con el micrófono extendido, preguntándole a
   un ministro de los acusados. La cámara está cerca y de lado, para que se lea
   el gesto: no estás corriendo, estás trabajando.
2. **El rescate.** Llegan los dos calle arriba y se lo llevan. No hay forcejeo:
   el ministro se va con ellos como quien se acuerda de otra reunión, que es
   exactamente lo que pasa.
3. **La pared.** Sigues con el micrófono en alto y delante ya no hay nadie. Ni
   el ministro ni los que se lo llevaron. La cámara no se mueve.
4. **El retroceso.** La cámara se aleja hasta su posición de juego y, al
   hacerlo, descubre que ahora los tienes detrás.
5. **El caballito.** El bajito se sube al grande.
6. Arranca la carrera.

**La fase 3 es el chiste entero.** La cinemática podría acabar en el rescate y
se entendería igual de bien; lo que no se entendería es *por qué corres*. El
segundo largo en que sigues preguntándole a un sitio donde ya no hay nadie es
lo que convierte «me interrumpieron» en «me dejaron hablando con la pared», y
de ahí sale todo lo demás: el juego es lo que haces después de que te dejen
hablando solo.

El ministro **no es un retrato**. Traje genérico, corbata roja y un pin de
solapa que no dice de qué es —y ese es el chiste—. Se satiriza el cargo y la
maniobra, nunca una cara.

Dura poco menos de seis segundos y se puede saltar tocando la pantalla. Solo se
ve entera en las primeras partidas: quien ya la vio la ve abreviada, y la
pared se acorta pero **no se quita**, porque es la fase que explica el juego.

**La portada del menú es esta misma entrevista**, congelada en la fase 1 y con
una deriva lenta de cámara. El ministro también está ahí: una entrevista sin
nadie enfrente no es una entrevista, es alguien de pie con un micrófono.

---

## Las cuatro escenas

Cada una tiene: un **caso** que documentar, unos **obstáculos** propios y un
**ente de control** al que lleva la salida del centro.

### Se acabó la comida

Hubo una barra de aguante y unos platos que la rellenaban: encebollado, guata,
bolón, canelazo, y un micrófono en Elecciones. Se fue en dos pasos, y conviene
saber por qué para no volver a ponerla.

**Primero se cayó la barra.** Con drenaje de 2/s tardabas 50 segundos en
vaciarte, pero los ítems salían cada 150 metros —unos 6 segundos a velocidad de
crucero— y devolvían 35 cada uno: recogiendo la mayoría, la barra no bajaba
nunca. Invisible jugando bien y castigo añadido jugando mal, que es la peor
forma posible para una mecánica. Y fallaba de forma indirecta —sin aguante vas
lento, al ir lento te alcanzan— así que al morir no había un momento claro de
«ahí me equivoqué».

**Después se cayó la comida.** Sin barra era un bonus suelto: sumaba papeles y
ya. No drenaba, no había medidor y no pasaba nada por ignorarla. Lo único que
hacía de verdad era competir por el hueco de cada grupo con los potenciadores,
que sí cambian cómo se juega. Un recolectable que solo suma no compite con uno
que además hace algo.

**Lo que sobrevive es la linterna**, que dejó de ser comida para ser EL
potenciador del Apagón. Ver esa escena.

### Sobre la luz: solo hay un escenario oscuro

Las cuatro empezaron siendo nocturnas, con el mismo vaporwave de fondo. El
problema no era estético: **el Apagón dejaba de contar nada**. Si vienes de
una calle en penumbra y entras en otra penumbra, quedarse sin luz no es un
acontecimiento, es un poco más de lo mismo.

Así que las otras tres suben, y cada una a su hora del día:

| Escena | Hora | Ambiente |
|---|---|---|
| **La Bahía** | Mediodía nublado | 1.35 |
| **Las Elecciones** | Tarde de cierre de campaña | 1.30 |
| **Centro histórico** | Amanecer con el cerco puesto | 1.15 |
| **El Apagón** | Sin red eléctrica | **0.24** |

Entrar al Apagón divide la luz por cinco de golpe. Antes se pasaba de 0.75 a
0.28 —menos de la mitad— y no bastaba: el apagón se nota **contra la luz**, no
contra otra penumbra.

Que la Bahía sea la más clara tiene además su propio motivo: un mercado
popular es un sitio diurno. Se abre a las siete y se cierra al caer el sol.

---

### 1 · LA BAHÍA — caso Porsche

> Mediodía en un **pasaje cubierto**. La calle entera va bajo una bóveda
> traslúcida, y debajo, **hileras de puestos pegados unos a otros**: toldos a
> rayas, persianas metálicas, rótulos pintados a mano y la mercadería apilada
> hasta arriba.

**Cómo se construye el sector**

Lo que hace que se lea como comercio informal y no como «una calle con
tiendas» son tres decisiones, y ninguna es el detalle de los modelos:

1. **La calle va TECHADA de punta a punta.** No son toldos por los lados: es
   una bóveda que cruza el ancho entero, como la del pasaje de verdad. La
   monta el escenario (`BahiaScene`) y no el decorado, porque no es de un lado,
   es de los dos: puesta a los lados serían dos medias bóvedas que se reciclan
   por su cuenta y no casan por el eje de la calle. Es también lo que más
   cambia la sensación de correr —hay algo por encima de la cabeza que pasa de
   largo— y por eso la Bahía se siente distinta de las otras tres.
2. **Los puestos van pegados.** Cada elemento de decorado no es un local: es
   una hilera de tres, sin un palmo entre medias, alineada a escuadra. El
   decorado del resto de escenas se coloca con desviación lateral y escala al
   azar para que la ciudad no se repita; una fila de mercado con eso puesto no
   se lee como desorden, se lee como fallo de colocación, así que la hilera
   pide alineación y el escenario se la respeta.
3. **El género sale del local.** La ropa cuelga por delante de la persiana, la
   mercadería se apila hasta arriba y el toldo invade la vereda. Un local
   ordenado, con su vitrina y su puerta, sería otro barrio.

Los rótulos son **genéricos** —«AL POR MAYOR», «TODO A $1»— y nunca marcas ni
nombres de locales reales: el decorado ambienta un sector, no señala a un
comerciante.

Y **aquí no hay palmeras**. Están en las Elecciones, que es la escena de calle
abierta. Dentro de un pasaje techado no crece una palmera, y si asoma por
encima del techo lo que dice es que no hay techo.

**Obstáculos**

| Cómo se supera | Qué es |
|---|---|
| Saltar | **Puesto de ropa**: mesa de tablones con perchas y prendas colgadas |
| Agacharse | **Toldo con electrodomésticos** colgando de un travesaño |
| Cambiar de carril | **Militar**: no se salta ni se esquiva encima. Si lo tocas, te capturan |
| Dos carriles | **Retén** |

**Evidencia**: USB, chats, videos de vigilancia, actas.

**El centro lleva a**: **FISCALÍA**.

---

### 2 · EL APAGÓN — caso Progen

> Una central térmica a oscuras. Generadores parados, maquinaria, cables.

**Obstáculos**

| Cómo se supera | Qué es |
|---|---|
| Saltar | **Tubería** reventada |
| Agacharse | **Cable de alta tensión** cruzando la vía |
| Cambiar de carril | **Generador averiado** |
| Dos carriles | **Turbina varada** |

**Linterna** (potenciador). Es el único de esta escena y el único que no se
desbloquea: existe desde la primera partida, pero solo sale aquí. En las otras
tres no significaría nada, porque hay luz; y hacerla esperar a los tres tramos
sería cerrarle el escenario a quien acaba de llegar.

La linterna va **delante del personaje** y apunta hacia donde corre, con su haz
dibujado. Estaba montada arriba y atrás, que repartía la luz muy pareja pero se
leía como un foco de estadio: alumbraba la escena desde ninguna parte. Una
linterna se sostiene y apunta, y en un tramo cuya mecánica entera es la luz eso
no es decoración.

> **Y cuando se apaga, los papeles alumbran.** En esta escena —y solo en esta—
> el papel sube su emisión y deja de teñirse con la niebla, así que la hilera
> se ve entera a través del negro y **dibuja la ruta**. Sigues sin ver la calle
> —eso lo paga la linterna— pero ves por dónde va.
>
> Eso es lo que permitió que quedarse sin luz DEJE DE MATAR. Mataba cuando la
> linterna era un consumible sembrado cada 150 metros; ahora que es un
> potenciador que puede no salir, morir por no haberlo encontrado sería perder
> por mala suerte y no por mal juego.
>
> El tramo arranca **con la linterna encendida**: entrar a oscuras y esperar a
> la primera cápsula no era difícil, era injugable.

**Evidencia**: contratos con sobreprecio, audios, chats, informes técnicos.

**El centro lleva a**: **ASAMBLEA NACIONAL**.

---

### 3 · EL CENTRO HISTÓRICO — estado de excepción

> Cercado. Rejas, alambre, gas.

**Obstáculos**

| Cómo se supera | Qué es |
|---|---|
| Saltar | **Reja** de contención |
| Agacharse | **Alambre de púas** tendido a media altura |
| Cambiar de carril | **Policía antimotines** con escudo |
| Dos carriles | **Tanqueta** |

Además, **gas lacrimógeno**: no es un obstáculo con caja de colisión, es
atmósfera —bocanadas que cruzan la vía y estorban la vista.

**Evidencia**: órdenes sin firma, listas de periodistas vigilados. Aquí hay
**muy poco que recoger**: máximo tres papeles por tramo. La carestía es el
mensaje.

**El centro lleva a**: **CARONDELET**, que está cercado. Ir de frente no abre
ningún trámite: te estrellas contra el cerco y te atrapan, sin más.

---

### 4 · LAS ELECCIONES

> Una ciudad ecuatoriana en campaña.

**Obstáculos**

| Cómo se supera | Qué es |
|---|---|
| Saltar | **Valla de campaña** |
| Agacharse | **Pancarta** colgante |
| Cambiar de carril | **Cartón del candidato**, con su fan revolcándose al pie |
| Dos carriles | **Bus de simpatizantes** |

También hay **pandilleros armados** que apoyan al gobierno, como variante del
bloqueo de carril.

**Evidencia**: pruebas de campaña anticipada, nóminas repetidas, facturas
fantasma, actas con más votos que votantes.

**El centro lleva a**: **CNE**.

---

## La bifurcación

Cada escena termina contra una fachada con **tres bocas de túnel**, una por
carril.

- **Izquierda / derecha** → otra escena
- **Centro** → el ente de control de ESA escena

```
                    ┌─── BAHÍA ───┐
                    │  (Fiscalía) │
                    │             │
     ELECCIONES ────┼─────────────┼──── APAGÓN
        (CNE)       │             │   (Asamblea)
                    │             │
                    └─ CENTRO HISTÓRICO ─┘
                         (Carondelet)
```

Son túneles y no ramales al aire libre por una razón de lectura: dos calles
que divergen en la niebla no tienen borde y a 200 metros son una mancha. Una
boca sí lo tiene, y entrar en ella es un gesto inequívoco.

La señalización llega desde 260 metros. El corredor se vacía a los 140: obligar
a esquivar mientras decides convierte una decisión en un accidente, pero
vaciarlo desde el primer aviso deja 260 metros sin nada que hacer.

**El cartel está en la interfaz, no en la calle.** Eran tres pórticos modelados
sobre la vía, escalonados a 230, 150 y 80 metros. El problema no era que
estuvieran: era dónde. Un cartel dentro del mundo se ve en escorzo, se cruza en
segundo y medio y hay que levantar la vista del carril para leerlo justo cuando
todavía se está esquivando.

Ahora es señalización de autopista —panel verde por vía, con su flecha y su
pestaña de salida, como las de la carretera— que **baja desde el techo de la
pantalla**, se queda quieta mientras dura la decisión y **se sube al cruzar**.
Se lee entera y todo el rato. Lo que sigue en el mundo son las **flechas del
asfalto**, que están donde ya se está mirando.

Cuando el centro es el cerco (Carondelet), el panel del medio va en rojo y la
pestaña dice SIN SALIDA: en señalización el color dice lo que pasa antes de que
se lea la palabra.

---

## Los entes de control

> **Estado: reescrito según este guion** — `src/game/Tramite.js`

Entrar de frente **no es un premio**. Es el chiste central del juego.

### El hueco sin acciones

**Al entrar y al salir, el juego se para.** Aparece una pantalla que no pide
nada: dos o tres párrafos contando qué está pasando, el remate en voz de El
Mercio y un botón para seguir.

Era la parte con más historia detrás y la que menos se entendía. Entrabas por
el túnel del centro, se te caían los papeles y salías, todo en marcha, con un
aviso de dos líneas que se iba solo a los dos segundos y medio. Nadie leía eso,
y sin leerlo lo que queda es una fase rara en la que hay que recoger cosas del
suelo.

Aquí no hay nada que esquivar ni nada que pulsar salvo seguir: es el único
momento del juego en que se puede pedir atención sin quitársela a otra cosa.

**Y se cuenta UNA VEZ.** El relato explica de qué va este sitio, y eso se
explica una vez. A la quinta visita a la Fiscalía, tres párrafos contando que
pediste cita tres veces son tres párrafos que ya se leyeron, y parar el juego
para repetirlos deja de ser un respiro y pasa a ser un peaje. De la segunda en
adelante se entra directo, con la acusación de siempre —**se te cayeron los
papeles, recógelos**— y se sale con el portazo, sin parar nada.

**Cómo se escriben esos textos.** En segunda persona y sobre **lo que te pasa a
ti**: qué haces, qué te dicen, qué te devuelven. Pediste cita tres veces; te
mandan pasar la carpeta por la banda y no está cerrada; la sesión se levanta
por falta de quórum; te dicen que el sistema está en mantenimiento. Nunca una
acusación concreta contra nadie ni una frase entrecomillada de nadie —ver la
regla editorial—. Lo satírico está en el trámite, no en el señalado.

**Y la cámara se ladea** dentro del pasillo, despacio, como al entrar en un
túnel. Es lo mismo que hace la bifurcación al virar, y es lo que convierte un
tramo especial en un sitio distinto en vez de en más de lo mismo con otro
decorado.

**Lo que pasa al entrar:** la institución te **riega los papeles**. Todo lo que
llevabas recogido se desparrama por el pasillo, en los tres carriles, y tienes
que recuperar lo que puedas mientras corres. No hay obstáculos: el único
obstáculo es la propia institución, que ya te quitó lo que tenías.

Recuperarlo todo es **prácticamente imposible**, y está calibrado para que lo
sea.

**Lo que pasa al salir**, según dónde entraste:

| Ente | Qué te dicen |
|---|---|
| **Fiscalía** | No contabas con evidencia suficiente. Se archiva el caso. |
| **Asamblea Nacional** | La comisión niega el juicio político por falta de votos. |
| **CNE** | Pierdes tus derechos políticos y de participación. Igual no ibas a ser candidato. |
| **Carondelet** | No hay trámite. Está cercado. |

**Y aun así compensa entrar**, porque a la salida encuentras **evidencia del
caso**. Es la asimetría que sostiene el modo historia:

- Para el **modo historia** el trámite **rinde**: sales con la pieza que te
  faltaba, la digan como la digan.
- Para el **ranking de papeles** el trámite **cuesta**: entras con un montón y
  sales con lo que alcanzaste a recoger del suelo.

Quien juega a puntuación aprende a no entrar. Quien juega a documentar, entra.
Que las dos formas de jugar tiren en direcciones opuestas es el punto.

---

## Cuando te atrapan

> **Estado: reescrito según este guion** — `src/ui/screens.js`, `src/game/Cerco.js`

### 1 · El cerco

El mundo se para. Los dos te caen encima por un lado, **cinco policías cierran
un círculo** y **tú acabas boca abajo en el asfalto**, con los brazos y las
piernas abiertos. La cámara se coloca en picado para que se vea. Solo entonces
aparece la interfaz.

Chocar y ver la pantalla de fin de partida en el mismo fotograma convierte la
derrota en un corte. Representarla la convierte en una escena.

Que el personaje **caiga** y no se quede de pie doblándose por la cintura es la
diferencia entre «se cansó» y «lo tumbaron». Y no es solo el remate: de ese
fotograma sale la foto que se imprime al día siguiente en portada.

### Y los choques que no te matan

Chocar sin perder la partida también se ve en el cuerpo. **Squash and stretch**
de manual: el personaje se aplasta contra lo que se llevó por delante y vuelve
a su forma con un rebote elástico, dando una vuelta entera sobre sí mismo.
Menos de medio segundo. Antes solo restaba un intento y sacudía la cámara, así
que el golpe lo sabía el HUD antes que el muñeco.

### 2 · El sorteo del juez

**Seis jueces.** Un selector los recorre. Cinco llevan la **camiseta morada**
del oficialismo; **uno no**. Paras el selector y a ver qué te toca.

No es una ruleta: el selector está a la vista, los jueces están a la vista, y
el resultado es exactamente lo que hiciste con el pulgar. Es habilidad.

- **Aciertas al juez que no está comprado** → «medidas sustitutivas» o hábeas
  corpus. Vuelves a la pista, en la misma escena. Todo sigue como antes.
- **Caes en cualquier otro** → sentencia.

**Cada captura lo pone más difícil**: el selector va más rápido cada vez. No
hay tope de intentos —siempre tienes la oportunidad— pero la oportunidad se
encoge. Esa curva es la que hace que la partida acabe, y es también la única
progresión del juego que va en tu contra.

### 3 · La primera plana

Perder **no devuelve a una pantalla de juego**: devuelve un periódico. La
página entera es la portada de El Mercio del día siguiente, con mancheta,
antetítulo, titular y bajada, y la sentencia es el titular.

**La foto del arresto es tuya.** En el momento en que el cerco se cierra
—cuando el círculo de policías ya está formado y la cámara ha retrocedido— se
captura el fotograma del juego y se imprime en la portada, en blanco y negro,
con trama de puntos encima como en un impreso de verdad. No es una ilustración
genérica de detención: es literalmente el instante en que te agarraron, y por
eso cambia en cada partida.

> Técnicamente: el lienzo se lee con `toDataURL()` **en el mismo fotograma**
> justo después de renderizar. Sin eso haría falta `preserveDrawingBuffer`, que
> penaliza el rendimiento de todas las partidas para una foto que se toma una
> vez.

**La única métrica que se imprime grande son los papeles recogidos.** Metros,
evidencia y puntaje bajan a una línea de datos pequeña, como los datos al pie
de una noticia. Un periódico no da cinco titulares del mismo tamaño; y si todo
se mide, nada se mide.

Y son los papeles, no el puntaje. El puntaje suma papeles más metros partido
por diez, así que puntúa igual al que documenta y al que solo corre rápido. Lo
que este juego mide es **cuánta documentación sacaste antes de que te
pararan**: correr es el precio, no el logro. Un periodista que llegó lejísimos
sin un papel en la mano no tiene nada que publicar.

Desde ahí se puede:

- **volver a correr** desde la escena donde perdiste, o
- **abrir el archivo** de investigación.

La continuidad importa: retomas donde te capturaron, no siempre en la Bahía.
Volver al principio cada vez convierte cada muerte en un reinicio del relato en
lugar de en un capítulo.

### 4 · Se pasa de hoja: DEPORTES

La portada termina con un botón, CONTINUAR, y **se pasa de página**. La
siguiente es la sección de deportes del mismo ejemplar: misma mancheta, mismo
papel, la tabla de posiciones.

Estaban las dos cosas en la misma página y no cabían. La portada quiere foto
grande y una cifra enorme; la tabla quiere filas. Juntas obligaban a hacer
scroll justo en el momento en que lo único que se quiere es volver a jugar.

**Tres clasificaciones, en pestañas**, porque un solo marcador premia una sola
forma de jugar:

| Pestaña | Qué mide |
|---|---|
| **Más buscados** | Todo lo recogido, partida tras partida |
| **Distancia** | Metros corridos desde la primera entrevista |
| **Mejor corrida** | Papeles en una sola partida |

Las dos primeras premian insistir; la tercera, una tarde inspirada. Quien juega
mucho y regular manda arriba; quien tuvo una corrida buena manda abajo. Con una
sola tabla, la mitad de los jugadores no tenía dónde salir.

#### La primera no es una tabla de puntos: es una circular de búsqueda

El acumulado de papeles no se titula «total de papeles» sino **LOS MÁS
BUSCADOS**, con su antetítulo de circular y su epígrafe: *«ordenados por lo que
llevan documentado; cuanto más arriba, más estorbas»*. La cifra es exactamente
la misma; lo que cambia es desde qué lado del escritorio se lee.

Y cambia entero lo que significa subir. No eres el que más junta: eres el que
más le estorba a alguien. Esa lectura es la del juego —aquí documentar no te da
prestigio, te da una carpeta con tu nombre— y por eso el puesto uno no lleva la
coletilla «director» como en las otras dos pestañas, sino **«prioridad uno»**.
La pestaña se imprime distinta: filete grueso arriba y abajo del bloque del
título, como los carteles de «se busca» de toda la vida.

Cada una va maquetada como la tabla de resultados de un diario: puesto, arroba
y cifra alineada a la derecha. Primero siempre `@paquimal`, que es el director;
después el hueco marcado con puntos suspensivos si lo hay; y luego tú, entre
tus dos vecinos.

De aquí se sale por **INTENTAR DE NUEVO** —que devuelve a la escena donde te
capturaron— o por **VER TODO EL DIARIO**, que abre el Archivo con tus
investigaciones.

No se enseñan los diez de golpe. En un móvil eso obliga a hacer scroll dentro
de una pantalla que ya es larga, y el séptimo puesto no le importa a nadie: lo
que dice algo es a quién hay que alcanzar y quién te pisa los talones. La tabla
completa vive en su propia página (**MARCADORES**, desde el menú).

Dos reglas que no se negocian:

- **Los arrobas son inventados** salvo el de la casa. Meter cuentas reales de
  terceros en el marcador de un juego satírico —aunque sea de muestra— es
  ponerles palabras en la boca por otra vía.
- **El pie de la tabla dice que son datos de muestra.** No hay servidor
  detrás y no se pretende que lo parezca. Cuando lo haya, lo único que cambia
  es de dónde sale la lista.

---

## Lo que sostiene la repetición

Cuatro cosas, y solo una es una cifra:

1. **El archivo.** Un ejemplar de El Mercio que se arma página a página con
   reportajes reales. Es lo único del juego que no es sátira, y el cambio de
   piel —papel crema, tipografía con remates— lo dice sin explicarlo.
2. **Los potenciadores.** Se abren a los 3, 6, 10, 15 y 22 tramos recorridos.
   El contador es acumulativo, así que ninguna corrida se pierde del todo.
3. **La continuidad de escena.** Cada partida es un capítulo, no un reinicio.
4. **El puesto en la tabla.** Se compite por papeles recogidos, que es la
   única cifra que se imprime grande —y que en la pestaña principal no se
   presenta como un mérito sino como un motivo para buscarte.

---

## La portada

El menú **no es un menú**: es la escena de la entrevista corriendo en vivo. El
personaje está de pie con el micrófono en la mano, en la pose del arranque de
la cinemática, y la cámara se mece despacio a su alrededor.

La interfaz se reparte en dos bandas —cabecera arriba, controles abajo— y
**deja libre el centro**, que es por donde se ve al personaje. El degradado que
oscurece la pantalla se abre justo en esa franja para que el 3D se vea nítido:
la capa de menú lleva desenfoque de fondo, y ahí hay que quitarlo o el
personaje aparece convertido en una mancha.

Al pulsar JUGAR se suelta la pose y el mismo personaje, sin corte ni carga,
echa a correr.

La portada es la única pantalla que **no** va impresa, y por una razón: es la
ventana por la que se ve la escena. Todo lo demás sí.

---

## Todo lo que no es correr, va impreso

Había dos mundos y no debía haberlos. El juego y sus menús iban de neón sobre
negro, y el papel crema salía solo en el Archivo y en la primera plana del
final. Eso dejaba al periódico como una pantalla más —en vez de como el sitio
al que va a parar todo lo que recoges— y encima obligaba a mantener dos
sistemas de estilo para las mismas cuatro cosas: un título, un cuerpo de texto,
unas cifras y unos botones.

Ahora **cada pantalla es una sección de El Mercio**, con su nombre en la
mancheta:

| Pantalla | Sección | Titular |
|---|---|---|
| Ajustes | ADMINISTRACIÓN | LA REDACCIÓN |
| Pausa | CIERRE DE EDICIÓN | RESPIRA |
| El hueco del trámite | CONTEXTO | *el ente de control* |
| El sorteo del juez | JUDICIALES | LE TOCA UN JUEZ |
| Victoria | PORTADA | PROSPERÓ |
| Fin de partida | *la fecha* | *el titular de tu caída* |
| Tabla de posiciones | DEPORTES | LOS MÁS BUSCADOS |
| Archivo | *el ejemplar entero* | — |

El chiste se cuenta solo: estás dentro del periódico incluso cuando estás
toqueteando el volumen. Y las secciones no son decorativas —ADMINISTRACIÓN es
donde un diario de verdad pone el staff y a quién reclamar, y aquí pone los
controles y qué edición estás leyendo, que es lo mismo con otro contenido.

Tres detalles de maqueta que importan:

- **Los botones van fuera del papel.** Un botón dibujado encima de la hoja se
  lee como un anuncio y el ojo lo salta.
- **El tinte de la pantalla se queda**, detrás de la hoja: el cerco sigue rojo y
  la victoria sigue verde. No cambia el papel, cambia la luz de la habitación.
- **Los iconos del sorteo del juez no se pasan a gris.** El resto de la maqueta
  impresa sí, pero ahí está la única excepción que no puede saltarse: el juez
  limpio se distingue de los otros cinco *por el color de la camiseta*, y en
  gris los seis son la misma silueta y el juego deja de tener solución. La
  tinta manda en todo menos en lo que el jugador tiene que mirar.

---

## Modo offline y ediciones

El menú lleva un panel que dice tres cosas: qué edición corre (versión y sello
de compilación), si el juego ya está guardado para jugar sin conexión, y si hay
una nueva. Existe porque todo eso era invisible: un modo offline que no se
puede consultar es indistinguible de un juego congelado en una versión vieja.

Cuándo entra una edición nueva:

- **Jugando** → nunca. Recargar en mitad de una corrida la borra por un motivo
  que no tiene nada que ver con el juego. Se avisa por el HUD y espera.
- **Al terminar la partida** → sola. El jugador ya iba a reiniciar.
- **En el menú** → cuando él quiera. El panel se enciende y hay un botón. Antes
  se aplicaba sola también aquí, y eso provocaba una recarga sorpresa a los dos
  segundos de abrir el juego.

El botón de comprobar dispara la búsqueda y espera un rato acotado. Si en ese
rato no aparece nada dice «sin novedades por ahora» y no «ya tienes la última»,
porque no es lo mismo: la comprobación puede tardar más que la espera, y si
llega después el panel se enciende igual.

---

## Pendiente

Ideas del guion que todavía no están en el juego, por orden de lo que más
aportaría:

- **Gas lacrimógeno** en el centro histórico como atmósfera que estorba la
  vista, no como obstáculo con colisión.
- **Pandilleros armados** como variante del bloqueo de carril en Elecciones.
- **Locales cerrados** con persianas bajadas como decorado propio de la Bahía,
  en vez del decorado genérico de ciudad.
- **Voces de calle** al recoger evidencia: un tono distinto por escena.
