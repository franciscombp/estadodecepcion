# 🛠️ Creador — Hub de Desarrollo

**Centro de herramientas integradas para editar y desarrollar Estado de Excepción sin tocar código.**

Accesible en: `/creador/` (en producción en GitHub Pages, en dev con `npm run dev`)

---

## 📁 Estructura

```
creador/
├── index.html              ← Hub principal (esta página)
├── README.md               ← Documentación
├── exportador/             ← Tool 1: Descarga modelos .glb
│   └── index.html
├── personajes/             ← Tool 2: Visor 3D de personajes (WIP)
│   └── index.html
├── mapas/                  ← Tool 3: Editor visual de escenas (WIP)
│   └── index.html
├── niveles/                ← Tool 4: Configurador de niveles (WIP)
│   └── index.html
├── ui/                     ← Tool 5: Design system viewer (WIP)
│   └── index.html
└── pruebas/                ← Tool 6: Sandbox de testing (WIP)
    └── index.html
```

---

## 🎯 Herramientas Disponibles

### ✅ 1. Exportador de Modelos (`/exportador/`)

**Estado:** Funcional (demo)

**Qué hace:**
- Renderiza preview WebGL de cada modelo
- Descarga individual de .glb
- Batch download de todos
- Muestra qué partes NO renombrar
- Genera índice.json

**Patrones de:**
- [`fanesca/herramientas/exportar-glb.html`](https://github.com/franciscombp/fanesca/blob/main/herramientas/exportar-glb.html)

**Uso:**
1. Abre `/creador/exportador/`
2. Click "Descargar Todos"
3. Guarda archivos .glb en carpeta
4. Abre en Blender o Substance Painter
5. Edita (geometría, texturas, detalles)
6. Exporta como .glb
7. Copia a `public/models/<id>.glb`

---

### 🔄 2. Visor de Personajes (`/personajes/`)

**Estado:** Por implementar

**Qué hará:**
- Carga GLB desde `public/models/`
- Girar con mouse, zoom con rueda
- Selector de poses disponibles
- Screenshot para validación
- Muestra stats (altura, rig, materiales)

**Patrones de:**
- [`modo-incognito/creador/personajes/`](https://github.com/franciscombp/modo-incognito/tree/main/creador/personajes)

**Implementación:**
```html
<!-- Cargar modelos de src/models/characters.js -->
<!-- Intentar load GLB de public/models/<id>.glb -->
<!-- Si no existe, usar procedural -->
<!-- Render con rotación, zoom, pose selector -->
```

---

### 🗺️ 3. Editor de Escenas (`/mapas/`)

**Estado:** Por implementar

**Qué hará:**
- Canvas 2D con plano de escena
- Paleta de objetos (enemigos, items, objetivos)
- Drag-drop en coordenadas
- Click para seleccionar y editar propiedades
- Export JSON → `public/data/scenes/<id>.json`

**Patrones de:**
- [`modo-incognito/creador/mapas/`](https://github.com/franciscombp/modo-incognito/tree/main/creador/mapas)

**Interfaz:**
```
┌─────────────────────────────────────┐
│ Canvas (plano 2D)                   │
│                                     │
│                                     │
├─────────────────────────────────────┤
│ Sidebar: Paleta de objetos         │
│          Propiedades seleccionado   │
│          Export/Import JSON         │
└─────────────────────────────────────┘
```

---

### ⚙️ 4. Configurador de Niveles (`/niveles/`)

**Estado:** Por implementar

**Qué hará:**
- Dropdown: selecciona nivel
- Inputs: id, nombre, escena, duración
- Tabla: objetivos, peligros
- JSON preview en vivo
- Export button

**Patrones de:**
- [`modo-incognito/README.md`](https://github.com/franciscombp/modo-incognito#quiero-cambiar-x--edito-y) (tabla de edición)

**Forma:**
```
Nivel: [dropdown]
Nombre: [input]
Escena: [dropdown]
Duración: [input]

Objetivos:
 ☐ Llegar a punto
 ☐ Evadir enemigos
 etc.

Peligros/Enemigos:
| Tipo | Enemigo | X | Y | Z | Vel |
|------|---------|---|---|---|-----|
| mob  | Oficial | 5 | 0 | 2 | 3   |

[Preview JSON]
[Export]
```

---

### 🎨 5. Design System (`/ui/`)

**Estado:** Por implementar

**Qué hará:**
- Visor de paleta de colores
- Tipografía (font families, sizes)
- Espaciado (tokens --sp-*)
- Componentes (botones, cards, inputs)
- Live preview

**Patrones de:**
- [`modo-incognito/src/style/design-system.css`](https://github.com/franciscombp/modo-incognito/blob/main/src/style/design-system.css)
- [`fanesca/design-system.css`](https://github.com/franciscombp/fanesca/blob/main/design-system.css)

**Contenido:**
```
Colores:
  Primary: #ff006e
  Secondary: #00d9ff
  Success: #16c784
  Warning: #fca311
  etc.

Tipografía:
  Display: Blackletter / Serif
  Text: System Sans
  Mono: Courier New

Espaciado:
  --sp-1: 0.25rem
  --sp-2: 0.5rem
  --sp-3: 1rem
  etc.

Componentes:
  [Button]  [Card]  [Input]
```

---

### 🧪 6. Sandbox de Testing (`/pruebas/`)

**Estado:** Por implementar

**Qué hará:**
- Juega cualquier nivel sin `npm run dev`
- Selector de niveles (dropdown)
- Play/Pause buttons
- Debug checkbox (muestra hitboxes)
- Logs en vivo
- Screenshot button

**Uso:**
```
Nivel: [level-1]
[▶ Play] [⏸ Pause] [Debug ☐]

[Canvas del juego aquí]

[Logs y debug output]
```

---

## 🔄 Flujo de Desarrollo

### Workflow Típico: Añadir un nuevo enemigo al nivel 3

**Antes (sin creador):**
```
1. Editar src/scenes/level3.js
2. npm run dev
3. Jugar hasta nivel 3
4. Ver error de posición
5. Parar dev, editar código
6. npm run dev
7. Jugar nuevamente
8. ✅ (3-5 iteraciones)
```

**Con Creador (después):**
```
1. Abrir /creador/mapas/
2. Cargar level-3-escape.json
3. Drag enemigo desde paleta
4. Ajustar velocidad/ruta en propiedades
5. Export JSON
6. Paste en public/data/scenes/level-3.json
7. Refrescar navegador (hot reload)
8. ✅ (1-2 iteraciones)
```

---

## 🚀 Implementación (Roadmap)

### ✅ FASE 0 (HECHO)
- [x] Hub index.html
- [x] Exportador funcional
- [x] Estructura de directorios

### 🔄 FASE 1 (Próximas 2 semanas)
- [ ] Exportador: conectar a src/models/characters.js real
- [ ] Personajes: básico viewer (carga GLB, rotación)
- [ ] public/data/ structure
- [ ] Motor lee JSON

### 📅 FASE 2 (Semana 2-3)
- [ ] Mapas: canvas + drag-drop
- [ ] Niveles: formulario + JSON export
- [ ] Validación de JSON en import

### 🎯 FASE 3 (Semana 3+)
- [ ] UI: design system viewer
- [ ] Pruebas: sandbox
- [ ] Hot reload en dev
- [ ] Screenshots automáticos

---

## 🔧 Desarrollo Local

### Correr Creador en dev

```bash
npm run dev
# → http://localhost:5173/creador/
```

El servidor Vite sirve static files, así que puedes editar HTML/CSS/JS y refrescar.

### Importar librerías

Las herramientas usan CDN para Three.js:

```html
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@r128/examples/jsm/"
    }
  }
</script>
```

Alternativa: importar desde `node_modules` si lo prefieres.

### Agregar nueva herramienta

1. Crear carpeta en `public/creador/<nombre>/`
2. Crear `public/creador/<nombre>/index.html`
3. Agregar card en `public/creador/index.html`
4. Implementar funcionalidad

---

## 📚 Referencia: Otros Proyectos

### fanesca (`/workspace/fanesca/`)

**Exportador modelo:**
- Archivo: `/herramientas/exportar-glb.html` (225 líneas)
- Usa: Three.js GLTFExporter
- Renderiza: WebGL previews
- Batch download con delays
- Expone `window.Exportador` para tests

**Patrones útiles:**
- Un solo renderer compartido para todos los previews
- Clone + reset de posición antes de exportar
- Feedback en vivo en log
- Status badges (ready, wip, soon)

### modo-incognito (`/workspace/modo-incognito/`)

**Builders:**
- Ubicación: `/creador/` (mapas, personajes, música, pantallas, pruebas)
- Importan código REAL del motor, no copias
- Guardan en vivo en JSON
- Validan con schema
- Auto-index de assets

**Patrones útiles:**
- Separación clara: Código (src/) vs Data (public/data/)
- README con tabla "Quiero cambiar X → edito Y"
- Creador está dentro de `public/`, se publica junto al juego
- Design tokens compartidos
- CI/CD validation

---

## 💾 Guarda tu Trabajo

### Para editores que escriben JSON:
```bash
# Copiar escena exportada
cp clipboard data/scenes/calle-principal.json

# Commit
git add public/data/
git commit -m "Update scene: added enemy patrol"
git push
```

### Para modelos .glb:
```bash
# Guardar en public/models/
cp ~/Downloads/character-tostadologo.glb public/models/

# Commit
git add public/models/
git commit -m "Improve character model: added details"
git push
```

---

## 🐛 Troubleshooting

**P: El exportador no muestra previews**
R: Verifica que WebGL esté habilitado. Chrome/Firefox deberían funcionar.

**P: Arrastré un objeto en mapas pero no guardó**
R: Click "Export JSON" → copy → paste en archivo. No hay auto-save.

**P: El personaje se ve diferente en el visor vs el juego**
R: Visor carga GLB de `public/models/`. Si usa procedural, puede diferir. Exporta para sincronizar.

**P: ¿Puedo editar directamente en el navegador?**
R: No, editores exportan JSON que pasted en archivos. GitHub Pages es solo lectura.

---

## 📞 Contacto & Soporte

- **GitHub:** [`franciscombp/estadodecepcion`](https://github.com/franciscombp/estadodecepcion)
- **Branch:** `claude/export-assets-gbl-wxt6rl`
- **Docs:** Ver `/docs/EDITOR-SANDBOX-GUIDE.md`

---

## 🎨 Créditos & Inspiración

Patrones copiados de:
- **fanesca:** Exportador de modelos, WebGL previews
- **modo-incognito:** Builders visuales, data-first architecture, design system

Implementado con:
- Three.js (3D rendering)
- Vanilla JavaScript (sin frameworks)
- CSS Grid + Flexbox (responsive)

---

**Status:** 🟢 Hub funcional. Herramientas en progreso. Arquitectura lista para desarrollo.
