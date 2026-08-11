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
│   ├── Roulette.js     ← Bifurcaciones institucionales
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
│   └── screens.js      ← Menú, bifurcación, ruleta, game over, cuaderno
└── utils/
    ├── controls.js     ← Teclado + swipe
    ├── collision.js    ← AABB
    ├── calidad.js      ← Detección de hardware y ajuste adaptativo
    ├── audio.js        ← Efectos sintetizados con Web Audio
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

Al final de cada tramo eliges izquierda o derecha para ir a un vecino, o sigues
de frente hacia la institución y giras la ruleta.

| Escenario | Tema | Estamina | Institución | Éxito |
|---|---|---|---|---|
| **Bahía** | Corrupción | Encebollado | Fiscalía | 20% |
| **Apagón** | Crisis energética | Linterna | Asamblea Nacional | 30% |
| **Elecciones** | Cooptación del CNE | Micrófono | CNE | 25% |
| **Carondelet** | Censura de prensa | Canelazo | — | ir de frente es perder |

**Apagón** tiene mecánica propia: la pantalla se oscurece y las linternas
amplían la visión. El radio visible escala con la velocidad para que siempre
tengas al menos un segundo de reacción — si fuera un valor fijo, a velocidad
máxima los obstáculos aparecerían ya encima.

**Carondelet** es deliberadamente árido: máximo 3 papeles por tramo. La
carestía es el mensaje.

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

Cada push a `main` compila y publica automáticamente
(`.github/workflows/deploy.yml`).

**Configuración necesaria una sola vez:**
Settings → Pages → Source: **GitHub Actions**

Sin ese paso el workflow corre pero no publica nada.

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
bifurcación → ruleta → game over → cuaderno), recolección, colisiones, salto y
agachada, persistencia en localStorage, y ocho cambios de escenario seguidos
sin fuga de memoria (geometrías estables).

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
