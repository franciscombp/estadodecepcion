# 📦 Guía de Exportación y Edición de Assets 3D

**Estado de Excepción** — Guía para editar y texturizar los modelos procedurales exportados a GLB.

---

## 🎯 Qué se exportó

Se generaron **13 modelos GLB** desde procedurales Three.js, listos para editar en cualquier software 3D profesional:

### Personajes (6)
- `character-chochologo.glb` — El periodista veterano (sombrero, mochila, libreta)
- `character-alondra.glb` — La reportera joven (cabello rizado, ukulele, credencial)
- `character-buscan.glb` — El investigador (boina, grabadora)
- `character-blanki.glb` — La espartana (casco, escudo, corporalencia)
- `character-ministro.glb` — El cargo anónimo (traje, maletín, insignia)
- `characters-perseguidores.glb` — El dúo: Reimberg + Noboa (montado)

### Obstáculos (4)
- `obstacle-saltar.glb` — Barrera baja (saltar por encima)
- `obstacle-agachar.glb` — Pórtico elevado (pasar agachado)
- `obstacle-esquivar.glb` — Caja con X roja (esquivar lateralmente)
- `obstacle-doble-bus.glb` — Bus de dos carriles (mayor dificultad)

### Recolectables (2)
- `collectible-papel.glb` — Hoja de papel (moneda del juego)
- `collectible-evidencia.glb` — USB naranja (joya de alto valor)

### Decoración (1)
- `decor-palmera.glb` — Palmera tropical low-poly

**Total:** 216 KB de assets listos para texturizar.

---

## 🔧 Cómo editar: Software recomendado

### Blender (Gratuito, recomendado)
1. **Descargar:** https://www.blender.org/download/
2. **Abrir modelo:** `File > Open > (seleccionar .glb)`
3. **Editar:**
   - Geometría en `Modeling` workspace
   - Materiales en `Shading` workspace
   - Texturas: UV Mapping → Texture Paint o exportar para Substance Painter

### Substance Painter
- **Ideal para:** Texturizado profesional, mapas PBR
- **Flujo:** Importar GLB → Pintar texturas → Exportar GLB+textures

### Maya / 3DS Max
- Abrir con `File > Import` o drag-and-drop
- Editar geometría y materiales normalmente

### Cinema 4D
- Importar `.glb` directamente
- Los nombres de partes se preservan como objetos

---

## 📋 Estructura de partes (para mantener compatibilidad)

Cada modelo tiene **nombres específicos** que el código del juego espera. **Mantenlos al editar:**

### Personajes humanoides
```
[Personaje]
├── BrazoDer (grupo - pivote del hombro)
│   ├── BrazoDer_Brazo (geometría)
│   ├── BrazoDer_Mano (esfera)
│   └── [accesorio si lo hay]
├── BrazoIzq
├── PiernaDer (grupo)
│   ├── PiernaDer_Pierna
│   └── PiernaDer_Pie
├── PiernaIzq
├── Torso (geometría principal - con accesorios anclados)
├── Cadera (geometría)
├── Cabeza (geometría - con sombrero/casco anclado)
└── Cuello
```

**Importante:** Los nombres son usados por `animarCarrera()` en `src/models/characters.js`. Si los cambias, actualiza también ese código.

### Obstáculos
Los obstáculos son más flexibles. Mantén al menos:
- Un grupo raíz con el tipo (`Obstacle_Saltar`, etc.)
- Las geometrías con nombres claros

### Recolectables
Pueden ser un solo mesh o un grupo. Mantén el nombre principal:
- `collectible-papel` → `Papel`
- `collectible-evidencia` → `Evidencia_USB`

---

## 🎨 Guía de texturizado

### Colores base (referencia, NO están texturizados en GLB)
Cada material tiene un color aproximado. Estos son para reference:

**Chochologo:**
- Torso: Verde `#22c55e` (camisa natural)
- Pantalón: Azul grisáceo `#2a3550`
- Piel: Marrón `#d9a06b`
- Sombrero: Paja `#e8cd8f`, banda tricolor

**Alondra:**
- Torso: Verde azulado `#14b8a6` (para distinguir)
- Cabello: Negro marrón `#2b1a12` (rizos)
- Ukulele: Madera clara `#d9a441`

**Obstáculos:**
- Chevrones: Amarillo/negro (patrón de advertencia)
- Franja roja: `#ff1030` (peligro)
- Metal: Gris `#8a94a6`

### Workflow recomendado para Substance Painter

1. **Importar GLB**
   - Asegura que los nombres de partes se importan correctamente
   - Verifica UVs (si no hay, genera automáticas)

2. **Crear materiales por parte**
   - Camiseta del Chochologo: tela con arrugas leves
   - Pantalón: tela más tosca
   - Piel: suave, ligeramente porotexturizada
   - Sombreros: paja con variación

3. **Mapas principales (PBR)**
   - **Basecolor** (color)
   - **Normal** (relieve)
   - **Roughness** (mate/brillante)
   - **Metallic** (0 para tela, 0.3+ para metal)

4. **Exportar**
   - Formato: **glTF 2.0 (.glb)**
   - Incluir texturas embebidas
   - Preservar estructura de nodos

---

## 📤 Cómo reemplazar los modelos en el proyecto

### Opción 1: Reemplazar procedurales (Recomendado)

1. **Guarda editados en:** `public/assets/models/`
   ```
   public/assets/models/
   ├── character-chochologo.glb  ← Reemplaza con el tuyo
   ├── character-alondra.glb
   ├── obstacle-saltar.glb
   └── ...
   ```

2. **Actualiza el loader en `src/game/Player.js`:**
   ```javascript
   // Antes (procedural):
   const modelo = crearChochologo()

   // Después (GLB):
   const gltf = await new GLTFLoader().loadAsync('assets/models/character-chochologo.glb')
   const modelo = gltf.scene
   ```

3. **Para animaciones:** Los brazos y piernas esperan el pivote de hombro/cadera.
   - Si cambias la estructura, adapta `animarCarrera()` al nuevo rig.

### Opción 2: Versiones paralelas

Mantén ambas:
```javascript
// En config/balance.js
export const USAR_MODELOS_GLB = true  // Toggle

// En Player.js
const modelo = USAR_MODELOS_GLB 
  ? await cargarDesdeGLB('chochologo')
  : crearChochologo()
```

---

## 🔄 Workflow completo (ejemplo)

### Para mejorar Alondra:

1. **Exportar procedural:**
   ```bash
   npm run export-assets  # ← futuro script
   # Genera character-alondra.glb
   ```

2. **Editar en Blender:**
   - Abrir `character-alondra.glb`
   - Mejorar geometría del cabello (más definido)
   - Añadir detalles al ukulele
   - Pintar credencial (añadir texto)
   - Exportar > glTF Binary (.glb)

3. **Texturizar en Substance Painter:**
   - Importar GLB modificado
   - Pintar camiseta con detalles de tela
   - Añadir pátina a ukulele
   - Crear variación en credencial
   - Exportar GLB embebido

4. **Integrar:**
   - Copiar a `public/assets/models/character-alondra-textured.glb`
   - Actualizar Player.js para cargar versión texturizada
   - Commit + push

---

## ⚠️ Notas técnicas

### UVs (coordenadas de textura)
- Los modelos procedurales **NO tienen UVs de verdad**
- Al abrir en Blender, genera UVs automáticas:
  ```
  [Objeto] > Tab (Edit) > U > Unwrap (Smart UV)
  ```
- Esto es necesario antes de pintar texturas

### Nombre de archivos
Usa convención clara:
```
character-[nombre].glb
obstacle-[tipo].glb
collectible-[tipo].glb
decor-[tipo].glb
```

### Tamaño en metros
El proyecto usa escala real:
- Personaje: ~1.8 metros de alto
- Obstáculos: Altura visual `ALTURA_SALTAR` ~0.68m
- Mantén esta escala al editar

### Materiales PBR
El juego usa `MeshStandardMaterial` (Three.js) que es compatible con glTF 2.0 PBR:
- Roughness: 0 (espejo) → 1 (mate)
- Metalness: 0 (no metal) → 1 (metal puro)
- Emissive: Luz que emite (para neón)

---

## 📚 Recursos

### Tutoriales
- [Blender + glTF Export](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Substance Painter glTF](https://help.allegorithmic.com/documentation/substance-painter/2023/user-guide/pages/export/gltf2.html)
- [Three.js glTF Loader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)

### Librerías útiles
- **glTF Transform CLI** — Valida y optimiza GLB
  ```bash
  npx gltf-transform info character-alondra.glb
  ```
- **Babylon Sandbox** — Visor online de GLB
  - https://www.babylonjs-playground.com

---

## ✅ Checklist de edición

- [ ] Descargué Blender / Substance Painter
- [ ] Abrí un modelo GLB sin errores
- [ ] Edité geometría (agregué detalles)
- [ ] Generé UVs correctamente
- [ ] Pintéé texturas (o creé nuevos materiales)
- [ ] Exporté como GLB con estructura de nombres intacta
- [ ] Copié a `public/assets/models/`
- [ ] Actualicé Player.js para cargar GLB en vez de procedural
- [ ] Testeé en navegador: `npm run dev`
- [ ] Commitié cambios: `git add ., git commit -m "Improve character textures"`

---

## 🆘 Solución de problemas

**GLB se ve negro / sin materiales:**
- Verifica que GLTFExporter embebió texturas
- En Three.js, carga con: `new GLTFLoader().load(...)`

**Animación quebrada (brazos/piernas no se mueven):**
- Revisa que los nombres de pivotes siguen siendo `BrazoDer`, `PiernaDer`, etc.
- O adapta `animarCarrera()` a los nuevos nombres

**Texturas pixeladas / baja resolución:**
- Genera UVs con "Angle-Based" o "Smart UV Project"
- Pinta en resolución 4K (en Painter) y exporta a 2K

**Archivo GLB muy grande:**
```bash
npx gltf-transform draco character-alondra.glb char-compressed.glb
# Reduce ~70% con compresión Draco (requiere loader especial)
```

---

## 🎮 Sistema de Edición Integrado (Próximas Fases)

Este documento te muestra cómo **exportar los modelos**. Pero hay más: Estado de Excepción necesita herramientas de edición para que cambiar niveles, personajes y gameplay sea **rápido, sin recompilar**.

### Por qué editores visuales

Hoy, cambiar un nivel:
1. Editas `src/scenes/level3.js` (JavaScript)
2. `npm run dev` (recompila)
3. Juegas hasta el nivel
4. Ves error → vuelves al paso 1

Con editores:
1. Abres `/creador/mapas/level-3.json` (navegador)
2. Drag-drop objetos visualmente
3. Refrescas (`npm run dev` ya está abierto)
4. Ves cambio al instante ✅

### Las 3 capas

**1. JSON Configuration** (`public/data/`)
- Niveles, escenas, personajes, balance
- Editable directamente en GitHub o en editor JSON
- Motor solo lee JSON, no toca código

**2. Visual Builders** (`public/creador/`)
- Exportador de modelos GLB (como fanesca)
- Visor 3D de personajes (como modo-incognito)
- Colocador de objetos en escenas (como modo-incognito)
- Editor de configuración de niveles

**3. Sandboxes de Testing** (`tools/`)
- Scripts de validación (check-*.mjs)
- Screenshots automáticos (Playwright)
- Sandbox de prueba rápida

### Fase 1: Exportador de Modelos

Ya existe `scripts/export-models-simple.js`. Siguiente paso: crear `/public/creador/exportar.html` que:

```html
<!-- Interfaz visual para descargar modelos -->
<!-- Previsualizaciones en WebGL -->
<!-- Batch download de todos los .glb -->
<!-- Genera models-index.json automático -->
```

Copia el patrón de `/workspace/fanesca/herramientas/exportar-glb.html`.

### Fase 2: Editors de Contenido

Crear bajo `public/creador/`:
- `mapas/` — editor 2D de escenas (drag-drop zonas, enemigos, items)
- `niveles/` — editor de configuración (duración, objetivos, flujo)
- `personajes/` — visor 3D (rotar, poses, screenshot)

Copia el patrón de `/workspace/modo-incognito/creador/`.

### Fase 3: Validación Automática

En `tools/`:
- `check-levels.mjs` — valida JSON de niveles
- `check-animations.mjs` — chequea que animaciones funcionen
- `check-balance.mjs` — verifica multiplicadores

Patrón: `/workspace/modo-incognito/tools/check-*.mjs`

### Empezar hoy

```bash
# Ver patrón de exportador en fanesca
cat /workspace/fanesca/herramientas/exportar-glb.html

# Ver patrón de builder en modo-incognito
cat /workspace/modo-incognito/README.md | grep "creador/"

# Cuando esté listo, crear:
# /home/user/estadodecepcion/public/creador/exportar.html
# /home/user/estadodecepcion/public/creador/personajes/index.html
# /home/user/estadodecepcion/public/creador/mapas/editor.html
```

### Referencia completa

Ver documento detallado en: `docs/EDITOR-SANDBOX-GUIDE.md` (generado en próxima sesión)

---

**Listo para editar. Diviértete mejorando los assets del Mercio.** 🎨✨
