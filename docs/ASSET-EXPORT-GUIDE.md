# Guía de assets 3D — bajar, editar y devolver

Cómo sacar cualquier pieza del juego a `.glb`, retocarla en Blender y devolverla
sin tocar código.

> **Esta guía se reescribió entera.** La versión anterior describía un mundo que
> ya no existe: tres exportadores de Node en `scripts/`, una carpeta
> `public/assets/models/export/` con doce `.glb` de 1,3 KB, y un reparto con
> nombres —«chochologo», «alondra», «buscan», «blanki»— que no son los de nadie.
> Un documento que apunta a archivos borrados es peor que no tener documento:
> alguien corre el script, se lleva unos cubos, y cree que ése es el juego. Los
> scripts y la carpeta se borraron; lo que aquí queda es lo que hay.

---

## El viaje entero

```
/creador/exportador/  ──►  personaje.glb  ──►  Blender  ──►  personaje.glb
                                                                    │
   public/modelos/piezas/  ◄──  npm run modelos -- personaje.glb  ◄──┘
```

### 1 · Bajarla

Abre **`/creador/exportador/`**. Están las 58 piezas del juego agrupadas:
personajes jugables, **el reparto entero del modelo**, cuadras de decorado,
obstáculos (genéricos y vestidos por escenario), recolectables, los edificios
del `.glb` de Quito, potenciadores y elementos de escena. Cada una se
previsualiza con sus medidas reales en metros; el visor se orbita arrastrando y
se acerca con la rueda.

**Los botones tardan un momento en habilitarse, y es a propósito.** Los
edificios vienen del `.glb` de Quito y los personajes de los suyos. Exportar
antes de que estén descargados baja un archivo vacío, o el muñeco de cajas de
reserva en vez del modelo — y eso se nota tarde y mal: el archivo se abre en
Blender, tiene el nombre correcto, y dentro hay otra cosa.

El exportador **exporta lo que corre**: vive dentro del build de Vite, así que
importa los mismos generadores y la misma versión de Three que la partida.

### 2 · Editarla

Blender: *File ▸ Import ▸ glTF 2.0*, retocas, y *File ▸ Export ▸ glTF 2.0
(.glb)*. Cualquier programa que lea glTF 2.0 vale; Blender es gratis y su
importador es el que mejor se lleva con lo que sale de aquí.

### 3 · Si es un personaje, adelgazarlo

```bash
npm run modelos -- ruta/al/personaje.glb
```

`GLTFExporter` no sabe escribir webp, así que al bajar el personaje vuelca su
atlas en PNG: de 42 KB pasa a 400 y pico. Bien para editar, mal para servir.
Medido con el policía de punta a punta:

| | |
|---|---|
| el creador lo baja | 508 KB (atlas PNG 512²) |
| el adelgazador lo devuelve | **301 KB** (atlas webp 512², 21,2 KB) |

Sin argumentos, `npm run modelos` repasa los seis del juego. Por qué 512² y por
qué webp está medido triángulo a triángulo en `scripts/adelgazar-personajes.py`
y en el §6.22 de `PRUEBA-DE-ESCRITORIO.md`.

### 4 · Devolverla

Déjala en **`public/modelos/piezas/`** con el mismo nombre con el que bajó. A
partir de ahí el juego usa el archivo; si no está, usa el procedural. No hay que
registrar nada: la comprobación se hace al arrancar.

Qué piezas admiten sustitución está en `PIEZAS_SUSTITUIBLES`
(`src/models/hitos.js`).

---

## Mixamo, y por qué no hay botón de `.fbx`

**No se puede exportar a FBX desde aquí.** Three trae exportadores a glTF, OBJ,
PLY, STL, USDZ, DRACO, EXR y KTX2, y ni uno a FBX. FBX es un formato binario
propietario de Autodesk; el subidor de Mixamo quiere binario, no el ASCII que sí
se podría escribir a mano, así que fabricarlo para que falle justo en el único
sitio donde importa no sale a cuenta.

**Pero el esqueleto de estos personajes YA ES el de Mixamo**, hueso por hueso.
Se abrió el archivo y se miró:

```
Hips
  LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase
  RightUpLeg → …
  Spine02 → Spine01 → Spine
                        LeftShoulder → LeftArm → LeftForeArm → LeftHand
                        RightShoulder → …
                        neck → Head
```

Son los mismos veinticuatro huesos con los mismos nombres, sin el prefijo
`mixamorig:` y con la columna numerada al revés (nuestro `Spine02` cuelga de la
cadera; el de Mixamo se llama `Spine`, y el de arriba `Spine2`). Meshy usa esa
convención porque se ha vuelto el estándar de facto.

### Cómo subir un personaje a Mixamo

Baja la pieza en `.glb` desde el creador y dale una vuelta por Blender:

1. *File ▸ Import ▸ glTF 2.0* — el `.glb` del creador.
2. *File ▸ Export ▸ FBX (.fbx)*, con **Path Mode: Copy** y el icono de
   empaquetar activado, para que la textura viaje dentro.
3. Súbelo a Mixamo, elige la animación, y descárgala en **FBX**.
4. De vuelta a Blender, y de ahí a `.glb`.
5. `npm run modelos -- ruta/al/personaje.glb` antes de dejarlo en su sitio.

### Y al revés: traer una animación de Mixamo sin subir nada

**No hace falta subir el personaje.** Si lo único que se quiere es una
animación, se baja de Mixamo puesta sobre SU muñeco —«without skin», que son
cuatrocientos kilobytes de huesos y nada más— y se pasa a nuestro esqueleto
aquí mismo:

```bash
cp lo-que-bajaste.fbx scripts/animaciones/comosellame.fbx
# añadir la línea en la RECETA de scripts/hornear-animaciones.mjs
npm run dev            # en otra terminal
npm run animaciones
```

Eso reescribe `public/modelos/animaciones.glb`, que es lo que el juego carga:
diez clips en 496 KB, sin malla ni textura, y un solo archivo para los seis
personajes —comparten esqueleto y nombres de hueso—.

> **`SkeletonUtils.retargetClip` no sirve para esto**, y se comprobó con un
> `.fbx` de Mixamo de verdad: en las cinco combinaciones de sus opciones, y
> también renombrando las pistas a pelo, la pose sale aplastada —la cabeza
> acaba a 0,40 m y el pie a 0,51 m, o sea la cabeza por debajo del pie, cuando
> en reposo la cabeza está a 1,31 m—. Los nombres coinciden pero los ejes de
> los huesos no. `src/creador/mixamo.js` hace el retargeteo pasando por la
> orientación EN EL MUNDO y corrigiendo por la diferencia entre las dos poses
> de reposo, que es lo que sí funciona; está explicado ahí y medido en el
> §6.26 de `PRUEBA-DE-ESCRITORIO.md`.

---

## Los dos tipos de personaje, que no se editan igual

### Los del modelo (siete de nueve)

Salen de seis `.glb` con esqueleto de 24 huesos y un ciclo horneado. Bajan con
**su esqueleto, su clip y su textura**, y en la **pose de reposo** — la cruz en
la que vinieron, no a media zancada: exportar el primer fotograma del ciclo deja
al muñeco con una pierna adelantada y no hay forma de saber si es la pose de
reposo o un error del rig.

El **dúo montado** también se baja entero, pero **sin animaciones**: son dos
esqueletos con los mismos nombres de hueso, y un clip no sabría a cuál de los
dos apunta.

Al editarlos, **conserva los nombres de los huesos**. Las poses escritas a mano
—salto, rol, entrevista, montado— buscan `Hips`, `Spine02`, `Spine01`, `Spine`,
`neck`, `Head`, `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`,
`LeftUpLeg`, `LeftLeg`, `LeftFoot`, `LeftToeBase` y sus gemelos de la derecha.

> **Los tres `Spine` están numerados al revés de lo que parece:** `Spine02`
> cuelga de la cadera, `Spine01` va encima y `Spine` es el de arriba, del que
> salen el cuello y los hombros.

### Los de cajas (Buencán y Monki, y todos los de reserva)

Se construyen con código y sus miembros son **articulados**: cada brazo lleva
codo y cada pierna rodilla y tobillo, encadenados, y todo cuelga de un grupo
intermedio llamado `cuerpo`.

```
[Personaje]                        ← posición y giro en la pista
└── cuerpo                         ← lo que rueda en la voltereta
    ├── cabeza (con sombrero/casco anclado)
    ├── cuello
    ├── torso (con mochila y accesorios anclados)
    ├── cadera (con la cámara de fotos)
    ├── brazoDer (pivote del HOMBRO)
    │   └── antebrazoDer (pivote del CODO)
    │       └── manoDer (pivote de la MUÑECA — aquí van libreta, micrófono…)
    ├── brazoIzq → antebrazoIzq → manoIzq
    ├── piernaDer (pivote de la INGLE)
    │   └── pantorrillaDer (pivote de la RODILLA)
    │       └── pieDer (pivote del TOBILLO)
    └── piernaIzq → pantorrillaIzq → pieIzq
```

Estos nombres los usan `animarCarrera()`, `animarSalto()` y
`aplicarPoseAgachado()` en `src/models/characters.js`. **Si un `.glb` importado
no los trae, el personaje corre quieto** — y sin `cuerpo` tampoco da la
voltereta. O mantienes los nombres, o adaptas ese código.

Y las **posiciones de reposo**: al construirse, cada pieza que la voltereta
recoge guarda su sitio en `userData.reposo`. Un `.glb` importado no lo trae.

Las medidas de cada tramo están en `PROPORCION` (`src/models/characters.js`).

---

## Escala

El proyecto usa metros de verdad, y desde que los personajes vienen de archivo
**cada uno tiene su estatura**. No las iguales:

| | alto |
|---|---|
| Roy (el de arriba del dúo) | 1,45 |
| Avecilla | 1,57 |
| el entrevistado (genérico) | 1,60 |
| el tostadólogo | 1,70 |
| el antidisturbias | 1,70 |
| el mando policial | 1,85 |

Los obstáculos: `ALTURA_SALTAR` 1,15 · `ALTURA_ESQUIVAR` 2,6 ·
`ALTURA_AGACHAR_DESDE` 1,25 (borde inferior del pórtico), en
`src/config/balance.js`.

---

## Texturas y materiales

- **Las piezas procedurales no traen UVs de verdad.** Antes de pintar nada, en
  Blender: *Tab (Edit) ▸ U ▸ Smart UV Project*.
- **Los personajes del modelo sí las traen**, y su atlas está pintado sobre la
  malla EN REPOSO. Cualquier hueso que cambie de grueso arrastra el dibujo con
  él: si vas a reproporcionar, retoca también el atlas.
- El juego usa `MeshStandardMaterial`, compatible con glTF 2.0 PBR. Rugosidad
  0 (espejo) → 1 (mate); metalness 0 → 1; emissive para el neón. Hay un **techo
  de rugosidad** común en `src/utils/materiales.js` y ahí está explicado por
  qué.
- **El material que traen los archivos de Meshy es emisivo al 100 %**
  (`emissiveFactor [1,1,1]` con el mismo atlas de mapa). El cargador lo
  sustituye por uno del juego; si lo dejas, el personaje se ilumina solo y va
  igual de brillante de noche en el Apagón que a mediodía en la Bahía.

---

## Cuidado con el número de piezas

El coste en móvil no son los triángulos, son las **llamadas de dibujo**. Una
cuadra colonial son cuarenta y cinco piezas y en pantalla hay más de treinta
casas: sin fundir eran 597 llamadas y 125 ms por fotograma; fundidas por
material, 451 llamadas y 110 ms — con MÁS triángulos. Si traes una pieza muy
despiezada de Blender, júntala por material antes de exportar (*Join* por
color).

---

## Cuando algo sale mal

**El `.glb` baja vacío o con el muñeco de cajas.** Exportaste antes de que
terminaran de descargarse los archivos. Espera a que los botones se habiliten.

**El personaje corre quieto.** Es de cajas y perdió los nombres de los miembros
al pasar por Blender, o perdió el grupo `cuerpo`.

**El personaje se ve negro o plano.** El material perdió su mapa, o quedó el
emisivo de fábrica. Revisa que `baseColorTexture` sigue ahí.

**El archivo pesa medio mega.** Es el atlas en PNG. Pásalo por
`npm run modelos -- archivo.glb`.

**La pose se ve rara sólo en el juego.** Las poses escritas a mano se aplican
sobre la de reposo. Si moviste el reposo en Blender, se mueven todas con él.
