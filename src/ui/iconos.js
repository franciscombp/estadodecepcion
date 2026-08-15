// ============================================================================
// ICONOS — SVG inline, ilustrados y a color
// ============================================================================
// Ilustrados en vez de lineales monocromos: un cuenco de encebollado con su
// caldo comunica "esto te recupera" más rápido que cualquier símbolo
// abstracto, y de paso mete la broma local.
//
// Van inline por tres razones: cero peticiones de red (el juego arranca sin
// conexión), escalan sin pixelarse, y se pueden teñir desde CSS.
//
// Todos dibujados sobre una caja de 24×24 y con silueta legible al 50%.
// Ver docs/ESTILO.md.
// ============================================================================

/** Envuelve el contenido en un <svg> con la caja estándar. */
function svg(contenido, { tamano = 24, viewBox = '0 0 24 24' } = {}) {
  return `<svg width="${tamano}" height="${tamano}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${contenido}</svg>`;
}

// ---------------------------------------------------------------------------
// EMBLEMAS DE TEMPORADA — uno por escenario
// ---------------------------------------------------------------------------

/** ENCEBOLLADO — Bahía. Cuenco con caldo, cebolla y yuca. */
export const encebollado = (t) => svg(`
  <ellipse cx="12" cy="17.5" rx="9" ry="1.6" fill="#000" opacity=".25"/>
  <path d="M3.2 11h17.6c0 4.4-3.9 7.4-8.8 7.4S3.2 15.4 3.2 11z" fill="#e8eef5"/>
  <path d="M4.6 11h14.8c-.3 3.3-3.4 5.6-7.4 5.6S4.9 14.3 4.6 11z" fill="#ff8c42"/>
  <ellipse cx="9.4" cy="12.4" rx="1.7" ry="1" fill="#fff3d6"/>
  <ellipse cx="14" cy="13.4" rx="1.5" ry=".9" fill="#fff3d6"/>
  <ellipse cx="11.8" cy="11.6" rx="1.2" ry=".7" fill="#ffd98a"/>
  <path d="M8.6 8.2c.9-1 .2-2.2-.3-2.9M12 7.6c1-1.1.3-2.4-.3-3.1M15.4 8.2c.9-1 .2-2.2-.3-2.9"
        stroke="#cfe0ef" stroke-width="1.2" stroke-linecap="round" opacity=".75"/>
  <path d="M2.2 11h19.6" stroke="#b9c6d4" stroke-width="1.4" stroke-linecap="round"/>
`, { tamano: t });

/** LINTERNA — Apagón. Con su haz de luz. */
export const linterna = (t) => svg(`
  <path d="M15.5 7.5 22.5 3v18l-7-4.5z" fill="#ffe066" opacity=".38"/>
  <rect x="3" y="8" width="9.5" height="8" rx="2" fill="#3a4256"/>
  <rect x="3" y="8" width="9.5" height="3" rx="1.5" fill="#4d566e"/>
  <path d="M12.5 7.2h2.2a1 1 0 0 1 1 1v7.6a1 1 0 0 1-1 1h-2.2z" fill="#ffd93d"/>
  <circle cx="14.2" cy="12" r="1.9" fill="#fff8dc"/>
  <rect x="5" y="10.4" width="2" height="3.2" rx=".5" fill="#ff3355"/>
`, { tamano: t });

/** MICRÓFONO — Elecciones. El canal de YouTube. */
export const microfono = (t) => svg(`
  <rect x="8.6" y="2.6" width="6.8" height="11.4" rx="3.4" fill="#3dff9a"/>
  <rect x="8.6" y="2.6" width="6.8" height="11.4" rx="3.4" fill="#000" opacity=".18"/>
  <rect x="9.8" y="3.8" width="4.4" height="9" rx="2.2" fill="#7dffc0"/>
  <path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0" stroke="#3dff9a" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M12 17.8v3.4" stroke="#3dff9a" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M8.4 21.2h7.2" stroke="#3dff9a" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="12" cy="6" r=".8" fill="#0a0e17" opacity=".35"/>
  <circle cx="12" cy="8.4" r=".8" fill="#0a0e17" opacity=".35"/>
`, { tamano: t });

/** CANELAZO — Carondelet. Taza humeante con canela. */
export const canelazo = (t) => svg(`
  <ellipse cx="11" cy="18.6" rx="7.5" ry="1.4" fill="#000" opacity=".25"/>
  <path d="M4 9h14v5.6c0 2.5-3.1 4.4-7 4.4s-7-1.9-7-4.4z" fill="#e8eef5"/>
  <path d="M5.4 10.4h11.2v4c0 1.7-2.5 3-5.6 3s-5.6-1.3-5.6-3z" fill="#ffa94d"/>
  <path d="M18.4 10.6h1.4a2.6 2.6 0 0 1 0 5.2h-1.4" stroke="#e8eef5" stroke-width="1.6" fill="none"/>
  <path d="M8.2 12.6c1.4-.7 2.6.5 4 0" stroke="#8a4b1f" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M8 6.4c.9-1 .2-2.2-.3-2.9M11.4 5.8c1-1.1.3-2.4-.3-3.1M14.8 6.4c.9-1 .2-2.2-.3-2.9"
        stroke="#cfe0ef" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
`, { tamano: t });

/**
 * Icono con el que se rotula cada temporada.
 *
 * Nació como el icono del ítem de aguante de cada escena. Esos ítems ya no
 * existen —la comida se fue con la barra— pero los dibujos siguen siendo el
 * emblema más reconocible de cada tramo: un encebollado dice «la Bahía» mejor
 * que cualquier símbolo abstracto. Así que se quedan como rótulo.
 */
export function iconoTemporada(idEscenario, tamano = 24) {
  switch (idEscenario) {
    case 'apagon': return linterna(tamano);
    case 'elecciones': return microfono(tamano);
    case 'carondelet': return canelazo(tamano);
    case 'bahia':
    default: return encebollado(tamano);
  }
}

// ---------------------------------------------------------------------------
// EL TRIBUNAL
// ---------------------------------------------------------------------------

/**
 * JUEZ. El mismo dibujo para los seis, con una sola diferencia: la camiseta
 * que asoma bajo la toga. Cinco la llevan morada; uno no.
 *
 * Que solo cambie un detalle es deliberado. Si el juez honesto tuviera otra
 * silueta se distinguiría de un vistazo y el sorteo dejaría de pedir
 * atención; así hay que mirar el pecho de cada uno.
 *
 * @param {boolean} limpio ¿Es el que no está comprado?
 */
export const juez = (t, limpio = false) => svg(`
  <circle cx="12" cy="6.4" r="3.1" fill="#e0b088"/>
  <path d="M6.2 22v-6.6c0-3 2.6-5.4 5.8-5.4s5.8 2.4 5.8 5.4V22z" fill="#1a1f2b"/>
  <path d="M12 10c1.5 0 2.9.4 4 1.1L12 16l-4-4.9c1.1-.7 2.5-1.1 4-1.1z"
        fill="${limpio ? '#eef2fa' : '#7b3fb5'}"/>
  <path d="M9.6 3.4h4.8v1.5H9.6z" fill="#1a1f2b"/>
  <path d="M6.2 22v-6.6c0-1.2.4-2.3 1.1-3.2M17.8 22v-6.6c0-1.2-.4-2.3-1.1-3.2"
        stroke="#2c3446" stroke-width="1" fill="none"/>
  ${limpio
    ? '<path d="M9.9 13.6l1.5 1.6 2.8-3.2" stroke="#3dff9a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    : '<circle cx="12" cy="13.4" r="1.1" fill="#c9a0ee"/>'}
`, { tamano: t });

// ---------------------------------------------------------------------------
// POTENCIADORES
// ---------------------------------------------------------------------------
// Uno por potenciador, con la misma silueta que la insignia 3D. Si el icono
// del HUD y la cápsula de la pista no se parecen, el jugador no relaciona lo
// que recogió con lo que se le encendió arriba.

/** IMÁN — Fuente anónima. */
export const iman = (t) => svg(`
  <path d="M6 14a6 6 0 0 1 12 0v5h-4v-5a2 2 0 0 0-4 0v5H6z" fill="#2affd5"/>
  <rect x="6" y="17.4" width="4" height="3.4" rx=".5" fill="#ff3355"/>
  <rect x="14" y="17.4" width="4" height="3.4" rx=".5" fill="#eef2fa"/>
  <path d="M12 3.4v2.8M6.6 5.6l1.8 2.2M17.4 5.6l-1.8 2.2"
        stroke="#2affd5" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>
`, { tamano: t });

/** PORTADA — el multiplicador. */
export const portada = (t) => svg(`
  <rect x="3" y="3.4" width="18" height="17.2" rx="2.2" fill="#0d1220" stroke="#ffcf3f" stroke-width="1.6"/>
  <path d="M7.2 9.2 11 15M11 9.2 7.2 15" stroke="#ffcf3f" stroke-width="2" stroke-linecap="round"/>
  <path d="M13.6 9.6c.6-.7 3-.9 3 .9 0 1.5-3 2.6-3 4.5h3.4"
        stroke="#ffcf3f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
`, { tamano: t });

/** BOTAS — Botas de campo. */
export const botas = (t) => svg(`
  <path d="M8 3.4h4.6v8.2c0 1.8 1 2.6 2.8 3.4 1.6.7 2.6 1.4 2.6 2.8v1.4H8z" fill="#6b4a2f"/>
  <rect x="6.6" y="18" width="12.8" height="2.8" rx="1.2" fill="#3dff9a"/>
  <path d="M8.4 6h4M8.4 8.2h4M8.4 10.4h4" stroke="#e8e0cc" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M4 15.6 6.4 13M3.6 19l2.2-1.6" stroke="#3dff9a" stroke-width="1.4"
        stroke-linecap="round" opacity=".75"/>
`, { tamano: t });

/** SALVOCONDUCTO — el sello que aguanta un golpe. */
export const salvoconducto = (t) => svg(`
  <rect x="4.6" y="2.6" width="14.8" height="18.8" rx="1.6" fill="#f0ead8"/>
  <path d="M7.4 6.4h9M7.4 9h9M7.4 11.6h5.4" stroke="#8a8270" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="14.6" cy="16" r="4" fill="none" stroke="#ff6b35" stroke-width="1.8"/>
  <path d="M12.7 16.1l1.4 1.5 2.6-3" stroke="#ff6b35" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
`, { tamano: t });

/** COBERTURA AÉREA — el dron de prensa. */
export const cobertura = (t) => svg(`
  <rect x="8.6" y="9.6" width="6.8" height="5" rx="1.4" fill="#2a3242"/>
  <circle cx="12" cy="16.4" r="2" fill="#ff5fa2"/>
  <path d="M9.4 9.6 6 6.6M14.6 9.6 18 6.6" stroke="#5a6274" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="2.6" y="5.4" width="6.8" height="1.8" rx=".9" fill="#ff5fa2" opacity=".85"/>
  <rect x="14.6" y="5.4" width="6.8" height="1.8" rx=".9" fill="#ff5fa2" opacity=".85"/>
`, { tamano: t });

/** Icono del potenciador por su id. */
export function iconoPotenciador(id, tamano = 24) {
  switch (id) {
    case 'portada': return portada(tamano);
    case 'botas': return botas(tamano);
    case 'salvoconducto': return salvoconducto(tamano);
    case 'cobertura': return cobertura(tamano);
    case 'iman':
    default: return iman(tamano);
  }
}

// ---------------------------------------------------------------------------
// RECOLECTABLES
// ---------------------------------------------------------------------------

/** EVIDENCIA — la moneda. Pila de hojas con renglones. */
export const papeles = (t) => svg(`
  <rect x="3.4" y="6.4" width="12" height="14.4" rx="1.4" fill="#c9a227" transform="rotate(-7 9.4 13.6)"/>
  <rect x="5.4" y="5" width="12" height="14.4" rx="1.4" fill="#e6bf3d" transform="rotate(-2 11.4 12.2)"/>
  <rect x="7.4" y="3.4" width="12" height="14.4" rx="1.4" fill="#ffd94f"/>
  <path d="M9.6 6.8h7.6M9.6 9.4h7.6M9.6 12h5.4M9.6 14.6h6.4"
        stroke="#8a6d1f" stroke-width="1.15" stroke-linecap="round"/>
`, { tamano: t });

/** USB — evidencia. Con etiqueta y conector metálico. */
export const usb = (t) => svg(`
  <rect x="7" y="8.6" width="10" height="13" rx="1.8" fill="#1c2230"/>
  <rect x="8.4" y="10.4" width="7.2" height="5" rx="1" fill="#ff6b35"/>
  <path d="M9.8 12.2h4.4M9.8 13.8h3" stroke="#2a1206" stroke-width="1" stroke-linecap="round"/>
  <rect x="9.2" y="2.6" width="5.6" height="6.4" rx=".8" fill="#b9c6d4"/>
  <rect x="9.2" y="2.6" width="5.6" height="2.2" rx=".8" fill="#d8e2ec"/>
  <rect x="10.4" y="5.4" width="1.4" height="2.4" fill="#8b95ad"/>
  <rect x="12.6" y="5.4" width="1.4" height="2.4" fill="#8b95ad"/>
  <circle cx="12" cy="18.6" r="1.1" fill="#ff6b35" opacity=".7"/>
`, { tamano: t });

/** CHAT — evidencia. Teléfono con burbuja de mensaje. */
export const chat = (t) => svg(`
  <rect x="5.4" y="2" width="13.2" height="20" rx="2.6" fill="#1c2230"/>
  <rect x="6.8" y="4.4" width="10.4" height="14.4" rx="1.2" fill="#0d1a14"/>
  <circle cx="12" cy="11.2" r="4.4" fill="#25d366"/>
  <path d="M10.1 9.3c-.3.9 0 2 .9 2.9s2 1.2 2.9.9l-.6-1.3-1 .3-1.2-1.2.3-1z" fill="#0d1a14"/>
  <rect x="10.4" y="20" width="3.2" height=".9" rx=".45" fill="#3a4256"/>
  <path d="M15.4 6.6h.9M8 6.6h4" stroke="#3a4256" stroke-width=".9" stroke-linecap="round"/>
`, { tamano: t });

/** FOTO — evidencia. Polaroid con imagen nocturna. */
export const foto = (t) => svg(`
  <rect x="3" y="4" width="18" height="16" rx="1.8" fill="#e8eef5"/>
  <rect x="4.4" y="5.4" width="15.2" height="10.6" rx=".8" fill="#132038"/>
  <circle cx="8" cy="8.6" r="1.5" fill="#ffd94f" opacity=".85"/>
  <path d="M4.4 16 9 10.6l3.4 3.6 2.6-2.4 4.6 4.2z" fill="#1f3557"/>
  <rect x="13.6" y="11.4" width="3.4" height="2" rx=".4" fill="#ff3355" opacity=".8"/>
  <path d="M5.6 17.8h6" stroke="#8b95ad" stroke-width="1" stroke-linecap="round"/>
`, { tamano: t });

/** Icono de evidencia según su nombre. Reparte por palabras clave. */
export function iconoPrueba(nombre, tamano = 24) {
  const n = (nombre ?? '').toLowerCase();
  if (n.includes('usb') || n.includes('contrato') || n.includes('factura') || n.includes('nómina')) {
    return usb(tamano);
  }
  if (n.includes('chat') || n.includes('audio') || n.includes('grupo')) {
    return chat(tamano);
  }
  if (n.includes('video') || n.includes('vigilancia') || n.includes('foto')) {
    return foto(tamano);
  }
  return papeles(tamano);
}

// ---------------------------------------------------------------------------
// CONTROLES E INTERFAZ
// ---------------------------------------------------------------------------

/** PAUSA */
export const pausa = (t) => svg(`
  <rect x="6.5" y="4" width="4" height="16" rx="1.6" fill="currentColor"/>
  <rect x="13.5" y="4" width="4" height="16" rx="1.6" fill="currentColor"/>
`, { tamano: t });

/** ALERTA — signo de exclamación en círculo. */
export const alerta = (t) => svg(`
  <circle cx="12" cy="12" r="9.4" stroke="currentColor" stroke-width="2" fill="none"/>
  <path d="M12 6.8v6.4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="12" cy="16.9" r="1.3" fill="currentColor"/>
`, { tamano: t });

/** PERSEGUIDOR — dos siluetas, una sobre otra. */
export const perseguidor = (t) => svg(`
  <circle cx="12" cy="4.4" r="2.4" fill="currentColor"/>
  <path d="M8.6 11.4c0-1.9 1.5-3.4 3.4-3.4s3.4 1.5 3.4 3.4v1.2H8.6z" fill="currentColor"/>
  <circle cx="12" cy="15.4" r="2.6" fill="currentColor" opacity=".62"/>
  <path d="M7.6 23c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4z" fill="currentColor" opacity=".62"/>
`, { tamano: t });

/** RUTA — pin de mapa. */
export const ruta = (t) => svg(`
  <path d="M12 22s7-6.3 7-11.2a7 7 0 1 0-14 0C5 15.7 12 22 12 22z" fill="currentColor"/>
  <circle cx="12" cy="10.6" r="2.8" fill="#0a0e17"/>
`, { tamano: t });

/** Flechas de swipe. dir: 'arriba' | 'abajo' | 'izquierda' | 'derecha' */
export const flecha = (dir, t = 24) => {
  const giros = { arriba: 0, derecha: 90, abajo: 180, izquierda: 270 };
  return svg(`
    <g transform="rotate(${giros[dir] ?? 0} 12 12)">
      <path d="M12 4.4v15.2M12 4.4 6.2 10.2M12 4.4l5.8 5.8"
            stroke="currentColor" stroke-width="2.4"
            stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  `, { tamano: t });
};

/** MANO — el gesto de deslizar. */
export const mano = (t) => svg(`
  <path d="M9 11V5.4a1.7 1.7 0 0 1 3.4 0V11" fill="currentColor" opacity=".9"/>
  <path d="M12.4 11V7.4a1.6 1.6 0 0 1 3.2 0V11" fill="currentColor" opacity=".75"/>
  <path d="M15.6 11.4V9.2a1.5 1.5 0 0 1 3 0v5.4c0 3.4-2.4 6.4-6 6.4-3.2 0-5.2-1.8-6.2-4.2l-1.6-3.8a1.5 1.5 0 0 1 2.6-1.4L9 13.4V11z"
        fill="currentColor"/>
`, { tamano: t });

// ---------------------------------------------------------------------------
// MARCA
// ---------------------------------------------------------------------------

/** Sello de El Mercio: el corredor sobre la fuga de la calle. */
export const sello = (t) => svg(`
  <rect width="48" height="48" rx="11" fill="#0a0e17"/>
  <path d="M17 48 22 22h4l5 26z" fill="#12172a"/>
  <path d="M20.4 48 23 22h1.2l-1 26z" fill="#ffcf3f" opacity=".85"/>
  <path d="M27.6 48 25 22h-1.2l1 26z" fill="#ffcf3f" opacity=".85"/>
  <rect x="11" y="21" width="26" height="1.6" fill="#ffcf3f" opacity=".5"/>
  <g fill="#3dff9a">
    <ellipse cx="24" cy="27" rx="6" ry="1.5"/>
    <rect x="21" y="23.4" width="6" height="3.8" rx="1"/>
    <rect x="21.4" y="27.8" width="5.2" height="4.6" rx="1.2"/>
    <rect x="19.6" y="32.8" width="8.8" height="8.4" rx="2"/>
    <rect x="21" y="41" width="2.8" height="6.4" rx="1.4" transform="rotate(-16 22.4 44.2)"/>
    <rect x="25" y="41" width="2.8" height="6.4" rx="1.4" transform="rotate(20 26.4 44.2)"/>
  </g>
  <rect x="9" y="30" width="4" height="5" rx="1" fill="#ffcf3f" transform="rotate(-18 11 32.5)"/>
`, { tamano: t, viewBox: '0 0 48 48' });
