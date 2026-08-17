# contenido/ — Lo que se edita sin tocar código

Esta carpeta la sirve el juego tal cual, sin pasar por el compilador. Lo que se
deja aquí manda sobre lo que está escrito en `src/config/`.

## guion.json

Todos los textos de las pantallas: titulares, bajadas, botones, remates.

**Cómo se hace uno:**

1. Abre `/creador/pantallas/` (en local, `npm run dev` y luego
   http://localhost:5173/creador/pantallas/).
2. Escribe encima de los textos que quieras cambiar. El teléfono de la derecha
   los enseña en el juego de verdad al pulsar «Probar en el juego».
3. Pulsa «Bajar guion.json».
4. Deja el archivo aquí, como `public/contenido/guion.json`, y haz commit.

**Qué forma tiene:** un objeto plano con la ruta del texto y su valor.

```json
{
  "portada.titular": "Otro titular",
  "portada.jugar": "Empezar"
}
```

Solo lleva lo que cambió. Lo que no aparezca se queda con lo escrito en
`src/config/guion.js`, así que añadir un texto nuevo al juego no obliga a
regenerar este archivo. También se acepta anidado
(`{"portada": {"titular": "..."}}`), por si se edita a mano.

**Qué NO se puede meter:** HTML. El único formato es `*entre asteriscos*` para
negrita, y los huecos entre llaves (`{lugar}`, `{caso}`) que rellena el juego.
Si borras un hueco, ese dato deja de salir; no se rompe nada.

Si el archivo no está —que es el caso por defecto— el juego usa el guion del
código. Si está roto, también: se ignora sin avisar en pantalla.
