# 🎮 Editor & Sandbox Guide — Estado de Excepción

**Diseño de un sistema integrado de edición para assets 3D, niveles y gameplay**

Basado en patrones probados de **fanesca** (exportador de modelos + previsualizador) y **modo-incognito** (builder interactivo + data-first architecture).

---

## 🎯 Visión: 3 capas de edición

Estado de Excepción necesita herramientas para cada aspecto del desarrollo:

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3: SANDBOXES DE TESTING                                   │
│  (Playwright scripts, animaciones en vivo, validación mecánica) │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2: BUILDERS VISUALES (creador/)                           │
│  • Exportador GLB de modelos 3D (como fanesca)                  │
│  • Colocador visual de assets en escenas (como modo-incognito)  │
│  • Editor de configuración de niveles                           │
│  • Visor 3D de personajes y obstáculos                          │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1: JSON CONFIGURATION (public/data/)                      │
│  • Definiciones de niveles (level-*.json)                       │
│  • Placement de assets (escenas, obstáculos, items)             │
│  • Configuración de personajes (velocidades, colores)           │
│  • Diálogos y story (si aplica)                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ CAPA 1: Data-First Architecture

### Por qué JSON, no código

**Estado actual:** Los niveles se construyen en `src/scenes/levelBuilder.js` como código imperativo.

**Problema:** Cambiar un nivel requiere:
1. Editar JavaScript
2. Recompilar (npm run build)
3. Testear en navegador
4. Volver a compilar si hay error

**Solución:** Mover configuración a JSON bajo `public/data/`

### Estructura de carpetas propuesta

```
public/data/
├── levels/
│   ├── level-1-introducion.json      ← diseño del nivel 1
│   ├── level-2-persecucion.json
│   ├── level-3-escape.json
│   └── ...
├── scenes/
│   ├── calle-principal.json          ← plano y zonas
│   ├── redaccion.json                ← interiores con layout
│   └── ...
├── characters.json                   ← atributos de personajes (velocidad, tamaño, etc)
├── dialogue.json                     ← diálogos y encounters
├── manifest.json                     ← índice global de qué niveles están activos
└── balance.json                      ← multiplicadores de dificultad, constantes de juego
```

### Ejemplo: level-1-introducion.json

```json
{
  "id": "level-1",
  "name": "Introducción",
  "scene": "calle-principal",
  "duration": 120,
  "objectives": [
    { "type": "reach-point", "position": [10, 0, 5], "message": "Llegaste a la estación" }
  ],
  "hazards": [
    { "type": "patrol", "enemy": "perseguidor-1", "position": [5, 0, 0], "speed": 3 }
  ],
  "collectibles": [
    { "type": "evidencia", "position": [7, 0, 3] },
    { "type": "papel", "position": [8, 0, 2] }
  ],
  "dialogue": {
    "start": "dialogue-intro-1",
    "objectives": { "first": "dialogue-objective-1" }
  },
  "music": { "theme": "persecucion", "intensity": 0.5 }
}
```

### Ventajas de este approach

✅ Los editores de contenido pueden cambiar niveles sin tocar código  
✅ Diff claro en Git (solo el JSON cambió)  
✅ Fácil de versionear y mergear  
✅ Herramientas pueden editar/validar sin compilar  
✅ Export/import trivial (cambiar juego de nivel es paste en nivel nuevo)

### Motor lee JSON automáticamente

```javascript
// En src/scenes/levelBuilder.js (NUEVO)
export async function loadLevel(levelId) {
  const response = await fetch(`/data/levels/${levelId}.json`)
  const config = await response.json()
  return buildLevelFromConfig(config)
}

// En src/game/Player.js (NUEVO)
onLevelStart(levelId) {
  loadLevel(levelId).then(level => {
    this.scene.add(level.root)
    this.setupHazards(level.config.hazards)
    this.setupObjectives(level.config.objectives)
    // ...
  })
}
```

---

## 2️⃣ CAPA 2: Builders Visuales (`creador/`)

### 2.1 Exportador de Modelos GLB (como fanesca)

**Ubicación:** `public/creador/exportar.html`

**Responsabilidad:** Descargar todos los modelos procedurales como GLB, listos para Blender.

**Características:**
- ✅ Preview en WebGL de cada modelo
- ✅ Descarga individual o batch
- ✅ Genera `models.json` con lista de IDs exportados
- ✅ Avisa de partes que NO pueden renombrarse
- ✅ Expone `window.Exportador` para tests headless

```html
<!DOCTYPE html>
<html>
<head>
  <title>Exportador de Modelos — Estado de Excepción</title>
  <link rel="stylesheet" href="../style.css">
</head>
<body>
  <h1>Exportar Modelos a GLB</h1>
  <p>Descarga cada modelo tal como está hoy en código. Ábrelo en Blender, edítalo, y devuélvelo a <code>public/models/</code></p>

  <button id="descarga-todas">Descargar todas</button>
  <button id="descarga-indice">Descargar indice.json</button>

  <div id="modelos-grid"></div>
  <pre id="log"></pre>

  <script type="module">
    import * as THREE from 'three'
    import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
    import { crearChochologo, crearAlondra, /* ... */ } from '../../src/models/characters.js'

    // Similar a fanesca/herramientas/exportar-glb.html
    // - Renderiza preview de cada modelo
    // - Exporta a GLB con GLTFExporter
    // - Batch download con delays
    // - window.Exportador para Playwright

    const PARTES_CRITICAS = {
      'character-tostadologo': 'BrazoDer, BrazoIzq, PiernaDer, PiernaIzq, Cabeza',
      'character-avecilla': 'BrazoDer, BrazoIzq, PiernaDer, PiernaIzq, Cabeza',
      'character-buencan': 'BrazoDer, BrazoIzq, PiernaDer, PiernaIzq, Cabeza',
      'character-monki': 'BrazoDer, BrazoIzq, PiernaDer, PiernaIzq, Cabeza',
      'character-ministro': 'BrazoDer, BrazoIzq, PiernaDer, PiernaIzq, Cabeza',
      // ...
    }
  </script>
</body>
</html>
```

### 2.2 Visor de Personajes 3D (como modo-incognito /creador/personajes/)

**Ubicación:** `public/creador/personajes/`

**Responsabilidad:** Ver todos los personajes en 3D, rotar, cambiar pose.

**Características:**
- ✅ Carga GLB desde `public/models/`
- ✅ Girar con mouse, zoom con rueda
- ✅ Dropdown: todas las poses del personaje
- ✅ Preview en vivo de lo que ve el juego

```html
<!DOCTYPE html>
<html>
<head>
  <title>Visor de Personajes — Estado de Excepción</title>
</head>
<body>
  <canvas id="canvas"></canvas>

  <div id="character-list">
    <!-- Se llena dinámicamente con personajes de src/models/characters.js -->
  </div>

  <div id="controls">
    <label>Pose: <select id="pose-select"></select></label>
    <button id="take-screenshot">📸 Captura</button>
  </div>

  <script type="module">
    import * as THREE from 'three'
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

    // Similar a modo-incognito/creador/personajes/
    // - Listar modelos de src/models/characters.js
    // - Intentar cargar GLB de public/models/<id>.glb
    // - Si no existe, usar procedural
    // - Renderizar con poses disponibles
    // - Screenshot para validación
  </script>
</body>
</html>
```

### 2.3 Colocador Visual de Escenas (como modo-incognito /creador/mapas/)

**Ubicación:** `public/creador/mapas/`

**Responsabilidad:** Editar visualmente dónde van enemigos, items, objetivos en una escena.

**Interfaz:**
- Canvas 2D con plano de escena
- Sidebar: paleta de objetos (enemigos, items, objetivos)
- Drag-drop: coloca objeto en coordenadas
- Click para seleccionar y editar propiedades
- Export JSON para `public/data/scenes/<id>.json`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Editor de Escenas — Estado de Excepción</title>
</head>
<body>
  <div class="editor-layout">
    <div id="canvas-container">
      <canvas id="scene-canvas"></canvas>
    </div>
    
    <div id="sidebar">
      <h3>Objetos</h3>
      <ul id="palette">
        <li draggable="true" data-type="perseguidor">👤 Perseguidor</li>
        <li draggable="true" data-type="obstáculo">🚧 Obstáculo</li>
        <li draggable="true" data-type="evidencia">💿 Evidencia</li>
        <li draggable="true" data-type="objetivo">🎯 Objetivo</li>
      </ul>

      <h3>Propiedades</h3>
      <div id="properties-panel"></div>

      <button id="export-json">💾 Exportar JSON</button>
    </div>
  </div>

  <script type="module">
    // Canvas painter + drag-drop handler
    // - Carga JSON de public/data/scenes/<id>.json
    // - Renderiza con canvas 2D
    // - Drag: objetos desde paleta
    // - Click: selecciona y muestra propiedades
    // - Export: genera JSON actualizado
  </script>
</body>
</html>
```

### 2.4 Editor de Niveles (configuración de flujo)

**Ubicación:** `public/creador/niveles/`

**Responsabilidad:** Configurar qué pasa en cada nivel (tiempo, objetivos, enemigos, diálogos).

**Interfaz:**
- Dropdown: selecciona nivel
- Inputs: duración, nombre, escena asociada
- Checkboxes: objetivos activos
- Tabla: enemigos que aparecen (tipo, posición, comportamiento)
- Textarea: JSON preview
- Export JSON

```html
<!DOCTYPE html>
<html>
<head>
  <title>Editor de Niveles — Estado de Excepción</title>
</head>
<body>
  <form id="level-form">
    <label>Nivel: <select id="level-select"></select></label>
    <label>Nombre: <input type="text" id="level-name"></label>
    <label>Escena: <select id="scene-select"></select></label>
    <label>Duración (s): <input type="number" id="duration"></label>

    <h3>Objetivos</h3>
    <div id="objectives-list"></div>

    <h3>Peligros/Enemigos</h3>
    <table id="hazards-table">
      <thead>
        <tr><th>Tipo</th><th>Enemigo</th><th>X</th><th>Y</th><th>Z</th><th>Velocidad</th></tr>
      </thead>
      <tbody></tbody>
    </table>

    <h3>Preview JSON</h3>
    <textarea id="json-preview" readonly></textarea>

    <button type="button" id="export-level">💾 Exportar</button>
  </form>

  <script type="module">
    // Carga public/data/levels/*.json
    // Genera form fields basado en JSON schema
    // Live preview del JSON
    // Export button descarga JSON actualizado
  </script>
</body>
</html>
```

---

## 3️⃣ CAPA 3: Sandboxes de Testing

### 3.1 Scripts de Validación (tools/)

Similar a modo-incognito, crear scripts que verifiquen integridad sin compilar:

```bash
# tools/check-levels.mjs
node tools/check-levels.mjs
# → Valida que todos los JSON de niveles tengan campos requeridos
# → Verifica que escenas referenciadas existan
# → Checkea que personajes referenciados estén en src/models/

# tools/check-animations.mjs
node tools/check-animations.mjs
# → Carga procedurales, verifica que brazos/piernas se animen

# tools/check-balance.mjs
node tools/check-balance.mjs
# → Chequea que multiplicadores de dificultad sean razonables

# npm run check:all
# → Ejecuta todos los checks
```

### 3.2 Screenshots Automáticos (Playwright)

```bash
# Captura cada personaje en pose "walk"
npm run capture:characters

# Captura cada nivel en segundo 5 de juego
npm run capture:levels

# Validar que todos los modelos renderean sin error
npm run validate:rendering
```

### 3.3 Sandbox de Prueba Rápida

**Ubicación:** `public/sandbox/test.html`

Permite probar un nivel SIN ejecutar npm run dev:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Sandbox — Estado de Excepción</title>
  <script src="../src/main.js" type="module"></script>
</head>
<body>
  <div id="game"></div>

  <div id="controls">
    <label>Nivel: <select id="level-select"></select></label>
    <button id="play">▶ Jugar</button>
    <button id="pause">⏸ Pausar</button>
    <label><input type="checkbox" id="debug"> Debug</label>
  </div>

  <pre id="log"></pre>

  <script type="module">
    // Carga public/data/levels/*.json
    // Dropdown: selecciona nivel
    // Click play: inicia juego con ese nivel
    // Debug checkbox: muestra hitboxes, logs, etc
  </script>
</body>
</html>
```

---

## 📋 Plan de Implementación (Fase 1 → Fase 3)

### **Fase 1 — Cimientos (Semana 1)**
- [ ] Crear `public/data/` structure
- [ ] Mover definición de niveles a JSON
- [ ] Adaptar `src/scenes/levelBuilder.js` para leer JSON
- [ ] Crear simple `public/creador/exportar.html`
- [ ] Commit y merge a main

### **Fase 2 — Builders (Semana 2-3)**
- [ ] `public/creador/personajes/` con visor 3D
- [ ] `public/creador/mapas/` con colocador de escenas
- [ ] `public/creador/niveles/` con editor de configuración
- [ ] Scripts básicos de validación en `tools/`
- [ ] Documentar cómo usar cada herramienta
- [ ] Commit y merge a main

### **Fase 3 — Polish (Semana 3+)**
- [ ] Integrar Figma design-system (tokens, componentes)
- [ ] Screenshots automáticos con Playwright
- [ ] Sandbox de prueba rápida
- [ ] "Hot reload" de JSON en dev
- [ ] Optimizar loaders (caché, compresión)
- [ ] Commit y merge a main

---

## 🔄 Flujo de Trabajo Ejemplo

**Escenario:** Necesito añadir un nuevo perseguidor al nivel 3.

### Antes (sin editores)
1. Editar `src/scenes/level3.js`
2. npm run dev
3. Jugar hasta nivel 3
4. Notar error de posición
5. Parar dev, cambiar código
6. npm run dev nuevamente
7. Jugar nuevamente
8. ✅ Listo (3-5 iteraciones)

### Después (con editors)
1. Abrir `public/creador/mapas/`
2. Seleccionar `level-3-escape.json`
3. Drag perseguidor desde paleta
4. Click y ajustar propiedades (velocidad, ruta)
5. Click "Exportar JSON"
6. Paste en `public/data/scenes/level-3-escape.json`
7. Refrescar navegador con juego ya abierto (hot reload)
8. ✅ Listo (1-2 iteraciones)

---

## 🎨 Design System Integration

### Compartir tokens con fanesca/modo-incognito

```css
/* src/style.css — import de design-system */
@import url('../design-system.css');

:root {
  /* Colores específicos de Estado de Excepción */
  --color-primary: var(--rosa-mexicano);
  --color-danger: var(--rojo-alerta);
  --font-display: var(--font-blackletter);
}
```

### Componentes reutilizables

```html
<!-- Botón -->
<button class="btn btn--primary">Exportar</button>

<!-- Panel -->
<div class="panel panel--shadowed">
  <h3>Propiedades del Objeto</h3>
  <div class="panel-body">...</div>
</div>

<!-- Input campos -->
<label class="field">
  <span class="field-label">Nombre</span>
  <input type="text" class="field-input">
</label>
```

---

## 🚀 Próximos Pasos

1. **Leer CLAUDE.md** de modo-incognito para ver patrón real
2. **Crear `public/data/` y `public/creador/`** directorios
3. **Escribir schema validation** para JSON (ajv o zod)
4. **Implementar primero:** Exportador de modelos (copia de fanesca)
5. **Luego:** Visor de personajes (copia de modo-incognito /creador/personajes/)
6. **Iterar:** Colocador y editor de niveles

---

## 📚 Referencias

- **Fanesca:** `/workspace/fanesca/herramientas/exportar-glb.html`
- **Fanesca README:** `/workspace/fanesca/README.md` (arquitectura + modelo de exportación)
- **Modo-incognito:** `/workspace/modo-incognito/creador/README.md`
- **Modo-incognito:** `/workspace/modo-incognito/README.md` (tabla "Quiero cambiar X → edito Y")
- **Modo-incognito tools:** `/workspace/modo-incognito/tools/` (check-*.mjs examples)
- **Design System:** `/workspace/modo-incognito/src/style/design-system.css`

---

**Conclusión:** Con estas 3 capas, los cambios en contenido serán iterativos y rápidos, sin necesidad de recompilar. El motor enfocado en **leer JSON**, los builders visuales en **editar JSON**, y los sandboxes en **validar JSON**. Arquitectura clara = development feliz.
