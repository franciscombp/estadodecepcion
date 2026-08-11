# Sistema de estilo — Estado de Excepción

Guía visual del juego. Codifica el lenguaje extraído de las referencias de
arte del proyecto para que cualquiera pueda añadir pantallas, iconos o props
sin que desentonen.

Los valores viven en [`src/config/estilo.js`](../src/config/estilo.js). Este
documento explica **por qué** son esos y **cuándo** usar cada uno.

---

## La referencia en una frase

> Noche tropical ecuatoriana vista a través de neón, con la solidez de
> interfaz de un juego premium de tienda.

Dos mitades que tienen que convivir:

- **El mundo** es sucio, cálido y caótico: asfalto mojado, palmeras,
  vallas publicitarias, luces de patrulla, polvo en el aire.
- **La interfaz** es limpia, oscura y geométrica: paneles casi negros,
  bordes de color nítidos, tipografía pesada, nada decorativo.

El contraste entre ambas es deliberado. La interfaz no compite con la escena;
se posa encima como el visor de una cámara.

---

## Color

### La regla que manda sobre todas

**El color es semántico, nunca decorativo.** Cinco significados, cinco colores:

| Color | Hex | Significa | Se usa en |
|---|---|---|---|
| 🟢 Verde | `#3dff9a` | **Tú.** Tu progreso, tu vida, lo que va bien | Jugador, estamina, distancia, éxito, ruta activa |
| 🟡 Dorado | `#ffcf3f` | **Lo que recolectas** | Papeles, contador, líneas de carril, marca El Mercio |
| 🔴 Rojo | `#ff3355` | **Peligro y ellos** | Perseguidor, obstáculos, alertas, fracaso, pausa |
| 🔵 Cian | `#2affd5` | **Información neutra** | Etiquetas de datos, bordes informativos |
| 🟠 Naranja | `#ff6b35` | **Evidencia** | USB, chats, fotos, lo valioso y escaso |

Si un elemento nuevo no encaja en uno de esos cinco significados,
**no lleva color**: va en gris (`#8b95ad`). La disciplina aquí es lo que hace
que el jugador entienda el HUD sin leerlo — ve un destello rojo y sabe que
algo va mal antes de procesar qué dice.

### Fondos

Casi negros, con matiz azulado. Nunca gris neutro: el azul hace que los
neones se lean como luz y no como pintura.

```
#05070c  abismo      pantallas completas
#0a0e17  noche       fondo base
#0d1220  panel       paneles del HUD
#141b2d  panelAlto   hover, elevación
```

---

## Anatomía de un panel del HUD

Todos los bloques del HUD son la misma receta:

```
┌─────────────────────────────┐
│  ETIQUETA          (10px)   │  ← gris, mayúsculas, tracking amplio
│  VALOR             (28px)   │  ← color semántico, peso 900, glow
└─────────────────────────────┘
   relleno #0d1220 al 92%
   borde 2px del color semántico al 35%
   radio 14px
   resplandor de tres capas
```

**La jerarquía es siempre la misma**: etiqueta pequeña y apagada arriba,
valor grande y encendido abajo. El jugador aprende a saltarse las etiquetas
después de la primera partida y solo escanea los números.

### El resplandor va en tres capas

Una sola `box-shadow` grande se ve sucia. Tres capas se leen como luz:

```css
box-shadow:
  0 0 8px  rgba(COLOR, 0.35),   /* halo cercano, define el borde */
  0 0 22px rgba(COLOR, 0.18),   /* halo lejano, tiñe el entorno */
  inset 0 0 12px rgba(COLOR, 0.06);  /* brillo interior, da volumen */
```

Está resuelto en `resplandor(rgb, intensidad)`.

---

## Tipografía

**No cargamos fuentes externas.** El juego tiene que arrancar sin red, y una
fuente que no llega deja el HUD descuadrado. La pila de sistema con peso 900
y tracking apretado da el mismo carácter que las condensadas de referencia.

| Uso | Tamaño | Peso | Tracking |
|---|---|---|---|
| Cifra grande (papeles, distancia) | `clamp(1.6rem, 7vw, 2.4rem)` | 900 | `-0.02em` |
| Título de pantalla | `clamp(2rem, 10vw, 3.6rem)` | 900 | `-0.03em` |
| Etiqueta de dato | `clamp(0.55rem, 2.2vw, 0.68rem)` | 800 | `0.16em` |
| Cuerpo | `clamp(0.8rem, 3.2vw, 0.95rem)` | 600 | normal |

**Las cifras del HUD llevan `font-variant-numeric: tabular-nums`.** Sin eso
el marcador "baila" cada vez que un `1` sustituye a un `8`, y ese temblor se
nota muchísimo a 60 fps.

Etiquetas siempre en **mayúsculas con tracking amplio**. Valores en tamaño
grande sin tracking extra.

---

## Iconos

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

```
┌──────────────────────────────────────────┐
│ [⏸]   [🍲 ESTAMINA ▓▓▓▓░ 72%]   [📄 248] │  ← estado permanente
│                                          │
│ RUTA                        ┌──────────┐ │
│ BAHÍA                       │ ⚠ AVISO  │ │  ← eventos temporales
│  ●                          └──────────┘ │
│  ○                                       │
│  ○         (la escena respira aquí)      │
│  ○                                       │
│                                          │
│ ┌────────┐    ┌──────────┐   ┌─────────┐ │
│ │EVIDENCIA│   │ DISTANCIA│   │ DESLIZA │ │  ← resumen y ayuda
│ └────────┘    └──────────┘   └─────────┘ │
└──────────────────────────────────────────┘
```

**El centro se deja libre.** Es donde ocurre el juego y donde el jugador tiene
la mirada. Cualquier cosa que se ponga ahí compite con la pista — los avisos
flotantes entran por el tercio superior y se van solos en 2 segundos.

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

Antes de dar por buena una pantalla o un prop:

- [ ] ¿Su color significa algo de los cinco, o debería ser gris?
- [ ] ¿La etiqueta va en mayúsculas con tracking, y el valor en peso 900?
- [ ] Las cifras, ¿llevan `tabular-nums`?
- [ ] ¿Responde al toque en menos de 200 ms?
- [ ] ¿Lo pulsable mide 48×48 px como mínimo?
- [ ] ¿Se ve bien con el notch y la barra de gestos encima?
- [ ] ¿Sigue siendo legible con `prefers-reduced-motion`?
- [ ] Si es un prop: ¿su silueta dice cómo se supera?
- [ ] ¿Subieron los draw calls?
