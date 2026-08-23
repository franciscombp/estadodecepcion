# Sistema de estilo — Estado de Excepción

> **El juego no tiene sistema de diseño propio.** Usa
> [`mal-ds`](https://github.com/franciscombp/mal/tree/main/ds), el de la casa,
> con el tema del periódico. Lo que hay en este documento es lo que el juego
> añade ENCIMA de ese sistema, y —al final— la lista de lo que hay que
> devolverle.

## Cómo se enchufa

```html
<html lang="es-EC" data-marca="mercio" data-tema="claro">
```

| | |
|---|---|
| Dónde vive | `public/ds/` — copia literal, versionada, de `ds/` del repo `mal` |
| Cómo se actualiza | `npm run ds -- /ruta/al/clon/de/mal` |
| Qué versión hay | `public/ds/version.json` (hoy **1.0.15**) |
| Cómo se carga | `public/ds-capa.css` → `@import url("./ds/mal/mal.css") layer(ds)` |

**Va dentro de `@layer ds`, y eso es lo que hace que la migración se pueda
hacer por partes.** Una regla sin capa le gana SIEMPRE a una regla en capa,
tenga la especificidad que tenga: con el sistema en su capa y `src/style.css`
fuera, el sistema se ve únicamente donde el juego no ha dicho nada. Adoptar un
componente del sistema es, literalmente, **borrar** la regla del juego que lo
estaba tapando.

**Claro fijo, de momento.** `data-tema="claro"` desactiva el modo oscuro del
sistema. No es que no funcione: es que el mundo 3D es una calle a mediodía y
toda la hoja del juego está escrita dando por hecho papel claro —el velo de
las pantallas, la tinta blanca del HUD sobre la foto—. El oscuro del periódico
está ahí y es un proyecto aparte.

## Los colores no se escriben, se piden

`src/style.css` declara quince alias y ni un hexadecimal:

```css
--papel:       var(--mal-bg-2);        /* la página */
--papel-blanco:var(--mal-surface);     /* la tarjeta */
--papel-sombra:var(--mal-outline);     /* el filete */
--tinta:       var(--mal-on-surface);
--tinta-media: var(--mal-on-surface-2);
--tinta-tenue: var(--mal-on-surface-3);
--rojo-diario: var(--mal-primary);
--azul-diario: var(--mal-secondary);
--serif:       var(--mal-display);     /* PT Serif */
--sans:        var(--mal-mono);        /* Montserrat */
```

Los alias se quedan porque hablan el idioma del juego —aquí lo de abajo es
papel y lo de encima es tinta— y porque 414 reglas los usan. Lo que se fue es
el valor. Si el periódico ajusta su rojo en su `theme.json`, el juego se entera
al actualizar el sistema.

## Choques de nombre resueltos

El sistema usa diez clases que el juego ya usaba. Ocho no molestan; dos sí, y
se renombraron **en el juego**, porque el nombre es del sistema:

| Clase | En el sistema | En el juego | Qué se hizo |
|---|---|---|---|
| `.hud` | la cabecera pegajosa del sitio | el marcador de la partida, a `inset: 0` | → `.hud-juego`. Sin esto, el `background` de la cabecera tapaba el juego entero con una sábana blanca |
| `.marcador` | UNA cifra grande con su rótulo | la COLUMNA de cifras de la esquina | → `.marcador-corrida` |
| `.progreso` | carril + `<span>` de relleno | lo mismo, con dos clases más | **adoptado**: se borró el del juego |

## Lo que pone el sistema y lo que pone el juego

El sistema viste **todo lo que no es correr**: las once pantallas, sus tokens,
su tipografía y sus componentes. El juego pone **lo que un sistema de diseño
no puede tener**: el mundo 3D, el HUD encima del lienzo y la coreografía de
las partidas.

| | Quién manda |
|---|---|
| Color, tipografía, espaciado, radios, sombras | el sistema |
| Botones, tarjetas, listas, barras, insignias | el sistema (adopción en curso) |
| El HUD sobre el lienzo | el juego · `.hud-juego` |
| Iluminación, props, materiales del mundo | el juego · `src/config/estilo.js` |
| La pantalla del sobre, los emblemas, los iconos de partida | el juego, **de momento** — ver abajo |

### Del mundo 3D no opina el sistema

`src/config/estilo.js` sigue teniendo su paleta y no es una duplicación: son
colores de MATERIAL, no de interfaz. Un `MeshStandardMaterial` no entiende
`var(--mal-primary)`, y la luz de una calle a mediodía no es un token de
producto. Lo que sí comparten es el criterio: **el color es semántico, nunca
decorativo.**

---

## Lo que hay que devolverle al sistema

La regla de la casa, tal como la puso quien encargó esto: *si el juego tiene
algo que el sistema no tiene, se le añade al sistema sin romper lo que ya hay.*
Esto es el inventario, y está ordenado por lo que más falta hace.

### 1 · Un contenedor de HUD · `.hud-juego`

El sistema tiene la sección `juego` con sus piezas —`.marcador`, `.medidor`,
`.vidas`, `.chip`, `.boton-juego`— pero **el ejemplo «Sobre el lienzo» monta el
contenedor con estilos en línea**: `position:absolute;top:16px;left:16px` seis
veces. No hay componente para lo único que todo HUD necesita, que es la rejilla
que reparte las esquinas sobre un lienzo. El juego tiene uno hecho y probado.

### 2 · La pantalla de premio · el sobre

Un desbloqueo a pantalla completa —fondo de rayos, la pieza en el centro con su
rebote, un toque para abrir— le sirve a los siete juegos del hub, no solo a
éste. Va con su variante de tema: aquí es un sobre de redacción porque el juego
es un periódico; en otro será otra cosa. Lo que se comparte es la maqueta y el
tiempo, no el dibujo.

### 3 · El rojo de marca en RGB · `--ref-marca-rgb`

El sistema publica `--ref-borde-rgb` para poder graduar el filete, pero no el
color de marca. Sin él no se puede escribir `rgba(rojo, .12)` sin volver a
escribir el hexadecimal, que es justo lo que los tokens vienen a evitar. El
juego lo tiene escrito a mano en `src/style.css` y es el único que queda.

### 4 · Tres colores de fondo de caja que el tema no declara

El tema del periódico no tiene pasteles de fondo. El juego usa tres:

| | | Dónde |
|---|---|---|
| `--lila-diario` | `#ddbeff` | las tarjetas del sorteo de jueces |
| `--verde-diario` | `#cdeac4` | la del juez que no es del gobierno |
| `--verde-senal` | `#67b857` | los letreros verdes de la bifurcación |

Y `--rojo-en-tinta` (`#ffb3a6`): el rojo de marca aclarado para leerse sobre el
bloque negro. `#c53b2b` sobre `#141414` no llega ni a 3 : 1, así que hace falta
una pareja del acento para fondo oscuro — que es un hueco del tema, no un
capricho del juego.

### 5 · Los iconos del juego

`iconos.svg` trae 81 símbolos de trazo. El juego tiene **veintiséis dibujos a
color** que no son iconos de interfaz —son objetos: un cuenco de encebollado,
una linterna, un micrófono, cuatro emblemas de periodista— y que por eso no
encajan en un sprite de trazo de 24. La pregunta para el sistema no es si estos
entran, es si hace falta un segundo sprite ilustrado al lado del de trazo.

---

## Iconos

> El sistema dice **«nada de emojis en la interfaz»** y trae un sprite de 81
> símbolos de trazo (`ds/mal/iconos.svg`). Esa regla vale aquí igual. Lo que
> sigue es para lo OTRO: los dibujos de objeto, que no son iconos de interfaz
> y no caben en un sprite de trazo. Ver «lo que hay que devolverle al sistema».

Ilustrados y a color, no lineales monocromos. Un cuenco de encebollado con su
caldo naranja comunica "esto te recupera" más rápido que cualquier símbolo
abstracto, y de paso mete la broma local.

Reglas:

- **SVG inline**, nunca archivos ni fuentes de iconos. Cero peticiones, se
  tiñen con `currentColor` donde hace falta y escalan sin pixelarse.
- **Caja de 24×24**, dibujados sobre rejilla para que no salgan borrosos.
- **Silueta reconocible al 50%** de su tamaño: en el HUD se ven pequeños.
- **Máximo 4 colores** por icono. Más se convierte en ruido.

Están en [`src/ui/iconos.js`](../src/ui/iconos.js).

---

## Movimiento

Duraciones cortas y curvas con rebote. **Un HUD de juego responde, no se
desliza con elegancia.**

| Token | Duración | Para |
|---|---|---|
| `instantaneo` | 90 ms | Cambios de estado inmediatos |
| `rapido` | 160 ms | Confirmación de toque, aparición de píldoras |
| `medio` | 280 ms | Entrada de paneles, avisos |
| `lento` | 450 ms | Transiciones de pantalla completa |

La curva por defecto es `cubic-bezier(0.34, 1.56, 0.64, 1)` — pasa de largo y
vuelve. Ese rebote es la diferencia entre "software" y "juego".

**Todo lo que el jugador provoca se confirma en menos de 200 ms.** Recoger un
papel, cambiar de carril, pulsar un botón: si la respuesta visual tarda más,
se siente roto aunque la lógica sea correcta.

### Excepción obligatoria

Todo se desactiva bajo `@media (prefers-reduced-motion: reduce)`. Quien pidió
menos movimiento en su sistema lo pidió por una razón.

---

## El mundo 3D

### Iluminación

Tres luces, siempre en el mismo papel:

1. **Ambiente** teñida del color del escenario, intensidad baja. Define el
   suelo tonal.
2. **Direccional** cálida desde arriba y un lado. Da volumen a las cajas
   low-poly.
3. **Relleno de color** siguiendo al jugador. Garantiza que el personaje
   nunca se pierda contra el fondo y tiñe el entorno cercano con el acento
   del escenario.

### Bloom

Es lo que convierte materiales emisivos planos en neón de verdad. Umbral alto
(`0.62`) para que **solo brille lo que debe brillar**: si se baja, el asfalto
se lava y se pierde el contraste que hace legibles los obstáculos.

Es también el efecto más caro del pipeline. Se apaga entero en calidad baja.

### Props

Estilo de la referencia: **low-poly de formas redondeadas y sombreado suave**.
Volúmenes simples, aristas marcadas con `flatShading`, sin detalle fino.

Las tres reglas que no se rompen:

1. **La silueta comunica la mecánica.** Bajo y ancho = saltar. Pórtico
   elevado = agacharse. Bloque macizo = cambiar de carril. El jugador tiene
   que leerlo en medio segundo, a distancia y en movimiento.
2. **Franja roja donde está el peligro.** En el borde superior de lo que se
   salta, en el borde inferior de lo que se esquiva por debajo. Marca la
   línea que el cuerpo no puede cruzar.
3. **El decorado nunca compite con la pista.** Los laterales van más
   apagados y más fríos que los obstáculos. Si un elemento de fondo llama
   más la atención que un obstáculo, está mal.

---

## Composición del HUD

Cuatro cosas encima del lienzo y ni una más, que es lo que pone la referencia
del género: la pausa arriba a la izquierda, la columna de cifras arriba a la
derecha, las píldoras de lo que esté activo abajo, y **nada en el centro**.

```
┌──────────────────────────────────────────┐
│ [⏸]                                 1.345│
│                                     984 m│  ← permanente, en las esquinas
│                                  MEJOR  0│
│                                     ● ● ●│
│                                          │
│                                          │
│            (por aquí se corre)           │
│                                          │
│                                          │
│ ┌──────────────┐                         │
│ │ ⚡ 7 s        │                         │  ← lo que está activo ahora
│ └──────────────┘                         │
└──────────────────────────────────────────┘
```

**El centro se deja libre.** Es donde ocurre el juego y donde el jugador tiene
la mirada; cualquier cosa que se ponga ahí compite con la pista. Aquí llegó a
haber un rótulo de «Evidencia recolectada», la ficha de racha, los «+N»
flotantes, el titular del barrio en dos líneas, la línea de progreso de
escenario, tres avisos apilados y un pie de foto. Todo eso se lee en la
pantalla de resultados, que es donde hay tiempo para leer.

**Las esquinas cargan la información permanente**, que se consulta con la
visión periférica sin apartar la vista del carril.

### Zonas seguras

Todo respeta `env(safe-area-inset-*)`. El notch y la barra de gestos se comen
el HUD en cuanto sales del simulador.

**Área táctil mínima de 48×48 px** en todo lo pulsable, incluida la pausa.
Un botón de pausa que falla en un endless runner cuesta una partida.

---

## Rendimiento

El HUD se actualiza 60 veces por segundo. Dos reglas:

1. **No tocar el DOM si el valor no cambió.** Cada escritura en `textContent`
   o `style` dispara recálculo de layout. Cada campo cachea su último valor.
2. **Redondear antes de comparar.** La estamina baja de forma continua; si se
   escribiera cada fracción, sería una escritura por fotograma para un cambio
   invisible. Se compara al 1%.

Presupuesto del mundo 3D: **~225 draw calls**. Las decisiones que más pesaron:

- Líneas de carril **pintadas en la textura del asfalto**, no como mallas
  sueltas (costaban más de cien draw calls).
- Cada papel es **una malla con textura**, no un grupo de cuatro.
- Geometrías y materiales **compartidos** entre instancias.

Si añades elementos, vigila `renderizador.info.render.calls` en consola.

---

## Añadir algo nuevo

Antes de escribir una regla de CSS, **la primera pregunta es si el sistema ya
la tiene**. `ds/componentes.json` lleva los 83 componentes con su HTML, y el
escaparate está en [una.red/ds](https://una.red/ds/).

- [ ] ¿Existe ya en `mal-ds`? Si existe, se usa su clase y no se escribe nada.
- [ ] Si NO existe: ¿es del juego (mundo, HUD, partida) o le serviría a
      cualquier otro producto? Si es lo segundo, va al sistema.
- [ ] ¿El color sale de un token, o hay un hexadecimal escrito?
- [ ] Si hay que cambiar cómo se ve un componente del sistema:
      **por token, nunca por selector.** Un override con más especificidad le
      gana a sus modificadores y rompe el sistema para todos.
- [ ] ¿La clase nueva choca con alguna de las 472 del sistema?

Y lo de siempre:

- [ ] ¿La etiqueta va en versales con tracking, y el valor en su cuerpo?
- [ ] Las cifras, ¿llevan `tabular-nums`?
- [ ] ¿Responde al toque en menos de 200 ms?
- [ ] ¿Lo pulsable mide 48×48 px como mínimo?
- [ ] ¿Se ve bien con el notch y la barra de gestos encima?
- [ ] ¿Sigue siendo legible con `prefers-reduced-motion`?
- [ ] Si es un prop: ¿su silueta dice cómo se supera?
- [ ] ¿Subieron los draw calls?
