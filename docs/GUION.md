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
- Los **nombres de caso** (Porche, Progen) se usan como rótulo temático de cada
  escena, que es como los nombra la prensa. Lo que el jugador recoge dentro
  son objetos genéricos —un USB, un chat, un acta— y nunca una afirmación
  concreta sobre nadie.
- Los perseguidores son **caricaturas**, no retratos. El juego lo dice en el
  menú, en letra que se lee.

---

## Premisa

Eres periodista de investigación. Estás haciendo preguntas en la calle: en la
Bahía, en las centrales térmicas, en las protestas del centro histórico
cercado. Preguntar es el trabajo, y preguntar es lo que te pone a correr.

El juego es una persecución sin final. No se gana escapando —de eso va el
chiste— sino aguantando de pie el tiempo suficiente para publicar.

### Personajes

| | Quién | Qué hace |
|---|---|---|
| 🎩 | **Chochólogo** | Jugable. Sombrero, gafas y treinta años de oficio. |
| 🪕 | **Alondra** | Jugable. Rizos, ukulele y todavía cree que esto sirve. |
| 🕴️ | **El bajito** | Persigue. Va montado sobre el grande y señala. |
| 🧍 | **El grande** | Persigue. Corre pesado y carga al otro. |

Los dos persiguen **desde atrás**, en cuadro, entre la cámara y el jugador.
La amenaza se lee por el hueco que se cierra.

---

## Cinemática de arranque

> **Estado: implementada** — `src/game/Intro.js`

Antes de la primera zancada:

1. Estás **de pie, entrevistando**. La cámara está cerca, de lado.
2. La cámara **se aleja** y toma su posición de juego.
3. Aparecen **los dos, al fondo**. Se acercan corriendo.
4. **El bajito se sube al grande.**
5. Arranca la carrera.

Dura poco más de cuatro segundos y se puede saltar tocando la pantalla. Solo
se ve entera en las primeras partidas: quien ya la vio la ve abreviada.

---

## Las cuatro escenas

Cada una tiene: un **caso** que documentar, unos **obstáculos** propios, un
**recolectable de aguante** propio, y un **ente de control** al que lleva la
salida del centro.

### Sobre el aguante

Empezó siendo un recurso en las cuatro escenas: una barra que drenaba, y si no
comías ibas lento y te alcanzaban. Los números decían otra cosa. Con drenaje de
2/s tardas 50 segundos en vaciarte, pero los ítems salen cada 150 metros —unos
6 segundos a velocidad de crucero— y devuelven 35 cada uno: recogiendo la
mayoría, **la barra no bajaba nunca**.

O sea, invisible cuando jugabas bien y castigo añadido cuando ya ibas mal. Y
encima fallaba de forma indirecta —sin aguante vas lento, al ir lento te
alcanzan— así que al morir no había un momento claro de «ahí me equivoqué».

Así que ahora:

- **En el Apagón es un RECURSO.** Hay barra, drena, y llegar a cero es derrota
  directa. Ahí no es un añadido: la luz se traduce en lo que literalmente ves,
  y gastarla y reponerla es el juego de ese tramo.
- **En las demás es un BONUS.** La comida suma papeles y punto. No hay barra,
  no drena, y no pasa nada por ignorarla.

Se conserva lo que valía —que cada escena tenga su propio objeto, que es la
expresión más clara del lore dentro del juego— y se quita el medidor que no
medía nada.

---

### 1 · LA BAHÍA — caso Porche

> Un corredor largo. A los lados, **locales cerrados**. En la vía, puestos de
> venta ambulante.

**Obstáculos**

| Cómo se supera | Qué es |
|---|---|
| Saltar | **Puesto de ropa**: mesa de tablones con perchas y prendas colgadas |
| Agacharse | **Toldo con electrodomésticos** colgando de un travesaño |
| Cambiar de carril | **Militar**: no se salta ni se esquiva encima. Si lo tocas, te capturan |
| Dos carriles | **Retén** |

**Comida costeña** (bonus, sin barra). Correr da hambre.

- Encebollado
- Guata
- Bolón

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

**Pilas** (RECURSO, con barra). Aquí no se come: se alumbra. Las pilas van
**iluminadas** para que se vean en la oscuridad, que es el único sitio donde el
recolectable tiene que brillar por sí mismo.

La linterna va **delante del personaje** y apunta hacia donde corre, con su haz
dibujado. Estaba montada arriba y atrás, que repartía la luz muy pareja pero se
leía como un foco de estadio: alumbraba la escena desde ninguna parte. Una
linterna se sostiene y apunta, y en un tramo cuya mecánica entera es la luz eso
no es decoración.

> **Y aquí quedarse sin recurso NO te vuelve lento: te atrapan.** Es la única
> escena con barra de aguante y la única donde llegar a cero es derrota
> directa, y tiene su lógica —sin luz no hay nada que documentar y no ves por
> dónde corres.
>
> Por eso el tramo **regala una pila al entrar** y siembra otra a la vista.
> Entrar a oscuras y esperar a la primera no era difícil, era injugable.

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

**Comida de la sierra y canelazo** (bonus, sin barra), que además calienta.

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

**Micrófono** (bonus, sin barra): tu canal es el último medio que te queda.

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

La señalización llega desde 230 metros. El corredor se vacía a los 140: obligar
a esquivar mientras decides convierte una decisión en un accidente, pero
vaciarlo desde el primer cartel deja 260 metros sin nada que hacer.

---

## Los entes de control

> **Estado: reescrito según este guion** — `src/game/Tramite.js`

Entrar de frente **no es un premio**. Es el chiste central del juego.

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

El mundo se para. Los dos te caen encima por un lado y **cinco policías cierran
un círculo**. La cámara retrocede para que se vea. Solo entonces aparece la
interfaz.

Chocar y ver la pantalla de fin de partida en el mismo fotograma convierte la
derrota en un corte. Representarla la convierte en una escena.

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

La sentencia se publica **en portada de El Mercio**: prisión preventiva,
extradición, prisión domiciliaria, y las demás.

Desde ahí se puede:

- **volver a correr** desde la escena donde perdiste, o
- **abrir el archivo** de investigación.

La continuidad importa: retomas donde te capturaron, no siempre en la Bahía.
Volver al principio cada vez convierte cada muerte en un reinicio del relato en
lugar de en un capítulo.

---

## Lo que sostiene la repetición

Tres cosas, y ninguna es la puntuación:

1. **El archivo.** Un ejemplar de El Mercio que se arma página a página con
   reportajes reales. Es lo único del juego que no es sátira, y el cambio de
   piel —papel crema, tipografía con remates— lo dice sin explicarlo.
2. **Los potenciadores.** Se abren a los 3, 6, 10, 15 y 22 tramos recorridos.
   El contador es acumulativo, así que ninguna corrida se pierde del todo.
3. **La continuidad de escena.** Cada partida es un capítulo, no un reinicio.

---

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
