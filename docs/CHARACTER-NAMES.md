# 👥 Character Naming Convention — Estado de Excepción

**Privacy-first approach:** Todos los personajes basados en personas reales usan nombres inventados en el código y assets.

---

## 🔐 Por qué nombres inventados

El juego tiene contenido satírico sobre colegas reales. Para **proteger su privacidad**:
- ✅ Código y assets usan nombres ficticios
- ✅ El contenido (diálogos, crítica) está en JSON, separado
- ✅ Si alguien redistribuye, los nombres públicos no exponen a nadie
- ✅ Refactorizar personajes es trivial (cambiar JSON)

---

## 📋 Personajes Principales (Base Real)

| Rol en Juego | Nombre Inventado | Archivo/ID | Detalles | Nota |
|---|---|---|---|---|
| Periodista veterano | **Tostadologo** | `character-tostadologo` | Verde, sombrero, libreta | Periodista experimentado |
| Reportera joven | **Avecilla** | `character-avecilla` | Turquesa, cabello rizado, micrófono | Investigadora |
| Investigador | **Buencan** | `character-buencan` | Boina, grabadora, espía | Documentador |
| Entrenadora | **Monki** | `character-monki` | Casco, escudo, fuerte | Vigilante interna |
| Autoridad anónima | **Ministro** | `character-ministro` | Traje gris, maletín, poder | Jerarca corporativo |
| Perseguidores Dúo | **Oficial + Roy** | `characters-perseguidores` | Pareja de antagonistas | Seguridad corporativa |

---

## 👨👩👮 Personajes Genéricos (Roles)

Para que el juego sea reproducible sin basarse en personas específicas, también hay:

### Población General
- **Peatón_1, Peatón_2, ..._N** — Ciudadanos en la calle
  - Variantes: Hombre, Mujer, Adulto, Joven, Ancianos
  - Usado en: escenas de multitud, distracciones

- **Oficinista_M, Oficinista_F** — Empleados corporativos
  - Traje genérico, mundano, apresurado
  - Usado en: lobby, escaleras, pasillos

### Seguridad
- **Guardia_Civil** — Uniforme estándar, neutral
- **Seguridad_Privada** — Traje negro, auricular
- **Vigilante_Puerta** — Estático en entrada

### Personajes de Soporte
- **Vendedor_Ambulante** — Vendedor de café/comida
- **Taxista** — Conductor de taxi
- **Conductor_Bus** — Chofer de transporte público

---

## 🎮 Cómo está implementado hoy

### src/models/characters.js
```javascript
// Nombres en el código: ficticios
export function crearTostadologo() { /* ... */ }
export function crearAvecilla() { /* ... */ }

// Si necesita referencia a persona real, comentario interno
// NOTA: Basado en A.D. — Periodista, 30+ años de carrera
// Mantener nombres ficticios en git/público
```

### public/data/characters.json (próximos)
```json
{
  "tostadologo": {
    "name": "Tostadologo",
    "displayName": "Tostadologo",  // ← Lo que ve el jugador
    "type": "character",
    "speed": 5.2,
    "visionRange": 15,
    "color": "#22c55e"
  }
}
```

### public/data/dialogue.json (próximos)
```json
{
  "tostadologo": {
    "encounters": [
      {
        "id": "intro-1",
        "text": "Avecilla, tienes que documentar esto...",
        "speaker": "tostadologo"
      }
    ]
  }
}
```

**Importante:** Los diálogos y crítica en JSON. El **código solo tiene nombres ficticios**. Si alguien redistribuye el código/assets, no hay conexión directa con personas reales.

---

## 🔄 Refactorización Fácil

Si en el futuro necesitas cambiar un personaje:

1. **En `src/models/characters.js`:**
   ```javascript
   // Cambiar nombre función
   export function crearNombreNuevo() { /* la misma lógica */ }
   ```

2. **En `public/data/`:**
   ```bash
   # Renombrar JSON
   mv dialogue/tostadologo.json dialogue/nombreNuevo.json
   ```

3. **Git diff es limpio:** Solo cambió un nombre, la lógica igual.

---

## ✅ Checklist para nuevos personajes

Cuando agregues un personaje:

- [ ] ¿Tiene nombre inventado (no real)?
- [ ] ¿El código usa nombre ficticicio?
- [ ] ¿Comentario interno si está basado en alguien real?
- [ ] ¿Si hay diálogos, están en JSON, no hardcodeados?
- [ ] ¿Archivo en `src/models/<nombre-ficticio>.js` si es procedural?
- [ ] ¿GLB en `public/models/<nombre-ficticio>.glb` si está editado?

---

## 📖 Convenciones de Nombres Inventados

Para mantener coherencia:

**Basados en características físicas / roles:**
- Animales relacionados: Avecilla, Monki, Tostadologo (animal que come tostadas)
- Apodos por oficio: Ministro, Oficial, Vigilante
- Juego de palabras: Buencan (Buen + Boscan)

**Genéricos (población):**
- Peatón_1, Peatón_2, ...
- Oficinista_M, Oficinista_F
- Guardia_Civil, Seguridad_Privada

**Evitar:**
- ❌ Nombres reales identitarios (Santiago, Duran, Moncada, etc.)
- ❌ Apodos que clarifiquen identidad
- ❌ Referencias explícitas sin codificar

---

## 🎨 Assets (Sprites, GLB)

Mismo patrón:

```
public/models/
├── character-tostadologo.glb       ← Nombre ficticio
├── character-avecilla.glb
├── character-monki.glb
└── generic/
    ├── peatón-m-1.glb
    ├── peatón-f-2.glb
    └── guardia.glb
```

```
public/sprites/
├── tostadologo-walk.png            ← Nombre ficticio
├── tostadologo-idle.png
└── generic/
    ├── peatón-walk.png
    └── peatón-run.png
```

---

## 🔗 Referencias en el Código

Si necesitas referencia para desarrollo:

```javascript
/**
 * Tostadologo — Periodista veterano
 * 
 * Basado en: A.D., ~30 años reportaje, experto en temas políticos
 * 
 * Personaje: Mayor, lentes, sombrero de prensa, cuaderno.
 * Rol: Guía y mentor en el juego.
 * 
 * IMPORTANTE: Nombre ficticio en código/assets. No usar nombre real en público.
 */
export function crearTostadologo() {
  // ...
}
```

El comentario interno es para que el equipo sepa quién inspiró al personaje, pero **jamás** aparece en archivos públicos (git, distribuible, etc.).

---

## 🚀 Implementación Próximas Fases

### Fase 1 (Ahora)
- ✅ Cambiar nombres en `src/models/` a ficticios
- ✅ Actualizar documentación
- [ ] Revisar que no haya nombres reales en `public/data/`

### Fase 2 (Próximas semanas)
- [ ] Migrar diálogos a JSON (separar contenido de código)
- [ ] Generar `characters.json` con metadata
- [ ] Revisar sprites / GLB naming

### Fase 3 (Ongoing)
- [ ] Code review: ningún nombre real en diff público
- [ ] CI/CD check: buscar nombres reales en assets
- [ ] Documentación: mantener esta guía actualizada

---

**Resumen:** Nombres inventados en código, contenido satírico en JSON, privacidad preservada. ✨
