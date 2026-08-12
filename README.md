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
│   └── textos.js       ← Microcopy, remates y fichas del cuaderno
├── game/
│   ├── Game.js         ← Orquestador: bucle y máquina de estados
│   ├── Player.js       ← Carriles, salto, agachada, hitbox
│   ├── Obstacle.js     ← Generación por grupos + pool de objetos
│   ├── Coin.js         ← Papeles y evidencia
│   ├── Track.js        ← Suelo infinito reciclable
│   ├── Stamina.js      ← Barra e ítems por escenario
│   ├── Chaser.js       ← Noboa + Reimberg
│   ├── Bifurcacion.js  ← Las tres bocas de túnel (el carril decide)
│   ├── Tramite.js      ← El túnel del centro: solo recolectar
│   ├── Elevado.js      ← Tarimas: el nivel por encima de la calle
│   ├── Cerco.js        ← La animación de que te rodean
│   ├── Rutas.js        ← El mapa del rombo
│   ├── PowerUps.js     ← Potenciadores y su desbloqueo progresivo
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
│   └── screens.js      ← Menú, escape, victoria, game over, periódico
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
| Estamina agobiante | `ESTAMINA.DRENAJE`, `ESTAMINA.DISTANCIA_ENTRE_ITEMS` |
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

## Los cuatro escenarios

```
        ┌─── BAHÍA ───┐
        │             │
   ELECCIONES ──┼── APAGÓN
        │             │
        └─ CARONDELET ┘
```

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

### El trámite (el túnel del centro)

Antes había una ruleta: un porcentaje, un giro y la suerte decidía. Funcionaba
como chiste una vez y como mecánica ninguna, porque el jugador solo miraba.

Ahora la vía institucional es una **prueba de habilidad**. Dentro del túnel no
hay obstáculos, ni perseguidores, ni drenaje de estamina: solo 154 papeles en
un patrón que obliga a cambiar de carril sin descanso durante 340 metros. Al
final se cuentan.

- Los recogiste **todos** → la denuncia entra. **Ganas el juego.**
- Faltó uno → *«no alcanzaste los votos»*, se archiva, y sales a la calle.

El umbral es 1. No 0.95: uno. Que sea casi imposible es exactamente el chiste.

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

Y lo que aparece es un **medidor de habilidad**, no una ruleta: un cursor
recorre una barra a velocidad conocida y lo paras. Si cae en la franja verde,
te zafas y sigues corriendo en la misma temporada. Uno por partida. Perder por
un dado invisible después de dos minutos corriendo es lo que apaga un juego;
perder por no llegar a tiempo, no.

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

Un juego que te lo enseña todo en la primera partida no da ninguna razón para
jugar la segunda. El contador de tramos es **acumulativo entre partidas**, así
que ninguna corrida se pierde del todo: hasta la peor te acerca al siguiente
desbloqueo, y el menú te dice cuánto falta.

La escalera se calcula desde el catálogo, no se guarda. Si mañana se cambia un
umbral en `config/balance.js`, el progreso de todo el mundo se recalcula solo
en vez de quedarse congelado con la escalera vieja.

### Continuidad

La partida siguiente arranca **en la temporada donde te capturaron**, no
siempre en la Bahía. Volver al principio cada vez convertía cada muerte en un
reinicio del relato en lugar de en un capítulo.

| Escenario | Tema | Estamina | Institución | Cómo se gana |
|---|---|---|---|---|
| **Bahía** | Corrupción | Encebollado | Fiscalía | trámite perfecto |
| **Apagón** | Crisis energética | Linterna | Asamblea Nacional | trámite perfecto |
| **Elecciones** | Cooptación del CNE | Micrófono | CNE | trámite perfecto |
| **Carondelet** | Censura de prensa | Canelazo | — | ir de frente es perder |

**Apagón** tiene mecánica propia: la pantalla se oscurece y las linternas
amplían la visión. El radio visible escala con la velocidad para que siempre
tengas al menos un segundo de reacción — si fuera un valor fijo, a velocidad
máxima los obstáculos aparecerían ya encima. Y el tramo **regala una linterna
al entrar** además de sembrar otra a la vista: llegar a oscuras y esperar 150
metros a la primera no era difícil, era injugable.

**Carondelet** es deliberadamente árido: máximo 3 papeles por tramo. La
carestía es el mensaje.

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

Ver `src/utils/actualizacion.js`.

---

## Sobre los modelos 3D

Los personajes y los props son **procedurales**: se construyen con primitivas
de Three.js en `src/models/`, no se cargan desde archivos `.glb`.

Se hizo así porque no existían modelos de Chochólogo, Alondra, Noboa ni
Reimberg que pudiéramos usar. Las ventajas resultaron ser varias: el juego
entero pesa unos 570 KB, no hay descargas que puedan fallar, y la estética
low-poly encaja con el vaporwave.

### Cambiar a modelos .glb reales

Cuando El Mercio tenga assets de verdad:

1. Poner el archivo en `public/assets/models/chochologo.glb`
2. En `src/models/characters.js`, sustituir `crearChochologo()` por una carga
   con `GLTFLoader`
3. Mantener los nombres de las partes (`torso`, `cabeza`, `brazoIzq`,
   `piernaDer`…) o adaptar `animarCarrera()` a las animaciones del `.glb`

El resto del juego no se entera del cambio.

Para binarios pesados usa `src/utils/assetCache.js`, que ya está escrito: es un
envoltorio de IndexedDB que descarga una vez y sirve desde local a partir de
ahí. El Service Worker no es buen sitio para archivos grandes porque su caché
se invalida en cada despliegue; IndexedDB los conserva entre versiones.

```js
const cache = new AssetCache();
await cache.abrir();
const buffer = await cache.obtenerOBajar('noboa.glb', '/assets/models/noboa.glb');
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

Lo esencial: **el color es semántico, nunca decorativo.** Verde eres tú, dorado
es lo que recoges, rojo es el peligro, cian es información, naranja es
evidencia. Si algo nuevo no encaja en esos cinco significados, va en gris.

Los iconos son SVG inline (`src/ui/iconos.js`): cero peticiones de red, escalan
sin pixelarse y el juego arranca sin conexión.

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
reales.

---

**El Mercio** · [elmercio.com](https://elmercio.com)
