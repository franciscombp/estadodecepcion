// ============================================================================
// NAVEGACIÓN COMPARTIDA DE LAS HERRAMIENTAS
// ============================================================================
// Una sola barra para las seis herramientas y el portal. Antes cada una era una
// isla: se entraba desde el portal y desde dentro no había manera de volver ni
// de saltar a la de al lado, así que para cambiar de herramienta había que
// editar la barra de direcciones a mano.
//
// Es la misma idea que en modo-incognito: la plataforma comparte el menú, y así
// da igual en qué herramienta entres, siempre ves todas las demás.
//
// POR QUÉ ES UN SCRIPT Y NO HTML COPIADO EN CADA PÁGINA
// Porque copiado hay que mantenerlo siete veces, y a la tercera herramienta
// nueva ya hay tres barras distintas. Aquí la lista vive en un sitio.
//
// POR QUÉ LOS ENLACES SON RELATIVOS
// El juego se publica en GitHub Pages bajo /estadodecepcion/, pero en local
// corre en la raíz. Una ruta absoluta funcionaría solo en uno de los dos sitios.
// Todas las herramientas cuelgan de /creador/<nombre>/, así que desde cualquiera
// de ellas la vecina siempre está en «../<nombre>/».
// ============================================================================

(() => {
  const HERRAMIENTAS = [
    { id: '',            icono: '🛠️', nombre: 'Portal',       corto: 'Portal' },
    { id: 'mapas',       icono: '🗺️', nombre: 'Escenas',      corto: 'Escenas' },
    { id: 'niveles',     icono: '⚙️',  nombre: 'Niveles',      corto: 'Niveles' },
    { id: 'personajes',  icono: '👥', nombre: 'Personajes',   corto: 'Personajes' },
    { id: 'exportador',  icono: '📥', nombre: 'Exportador',   corto: 'Exportar' },
    { id: 'ui',          icono: '🎨', nombre: 'Design System', corto: 'Diseño' },
    { id: 'pruebas',     icono: '🧩', nombre: 'Sandbox',      corto: 'Sandbox' },
  ];

  // En qué herramienta estamos.
  //
  // La misma página se abre de dos formas —/creador/ui/ y /creador/ui/index.html—
  // y las dos tienen que dar el mismo resultado: GitHub Pages sirve el índice
  // del directorio, pero el servidor de desarrollo de Vite no lo hace y ahí hay
  // que escribir el archivo. Mirando solo el último tramo, la segunda forma
  // devolvía «index.html», no encontraba herramienta y marcaba el portal como
  // activo estando dentro de otra.
  const tramos = location.pathname.split('/').filter(Boolean);
  if (tramos[tramos.length - 1] === 'index.html') tramos.pop();
  const ultimo = tramos[tramos.length - 1] ?? '';
  const actual = HERRAMIENTAS.some((h) => h.id === ultimo && h.id !== '') ? ultimo : '';

  // Desde el portal las vecinas cuelgan de «./»; desde dentro de una
  // herramienta hay que subir un escalón primero.
  const raiz = actual === '' ? './' : '../';

  const estilos = document.createElement('style');
  estilos.textContent = `
    .nav-creador {
      position: sticky; top: 0; z-index: 9999;
      display: flex; align-items: center; gap: 4px;
      padding: 8px 12px; overflow-x: auto; scrollbar-width: none;
      background: rgba(10, 14, 39, 0.94);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid #2a3f5f;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .nav-creador::-webkit-scrollbar { display: none; }
    .nav-creador__marca {
      flex: 0 0 auto; display: flex; align-items: center; gap: 7px;
      padding-right: 12px; margin-right: 6px;
      border-right: 1px solid #2a3f5f;
      font-size: 0.74rem; font-weight: 800; letter-spacing: 0.06em;
      color: #8892b0; text-transform: uppercase; text-decoration: none;
      white-space: nowrap;
    }
    .nav-creador__marca:hover { color: #e4e6eb; }
    .nav-creador__enlace {
      flex: 0 0 auto; display: flex; align-items: center; gap: 6px;
      padding: 7px 12px; border-radius: 8px;
      border: 1px solid transparent;
      color: #8892b0; text-decoration: none;
      font-size: 0.8rem; font-weight: 600; white-space: nowrap;
      transition: background 140ms, color 140ms, border-color 140ms;
    }
    .nav-creador__enlace:hover { background: #1a1f3a; color: #e4e6eb; }
    /* La actual se marca de verdad, no solo con un tono distinto: si no, en una
       barra que se desplaza no se sabe dónde estás sin leerlas todas. */
    .nav-creador__enlace[aria-current='page'] {
      background: rgba(255, 0, 110, 0.14);
      border-color: rgba(255, 0, 110, 0.5);
      color: #ff4d94;
    }
    .nav-creador__juego {
      flex: 0 0 auto; margin-left: auto; padding: 7px 14px;
      border-radius: 8px; background: linear-gradient(135deg, #ff006e, #00d9ff);
      color: #06080f; text-decoration: none;
      font-size: 0.78rem; font-weight: 800; white-space: nowrap;
    }
    /* En pantallas estrechas se cae el nombre largo y queda el icono con el
       nombre corto: siete pestañas con su título entero no caben en un móvil y
       la barra acababa desplazándose hasta para ver la segunda. */
    @media (max-width: 780px) {
      .nav-creador__enlace .nav-creador__largo { display: none; }
      .nav-creador__juego { margin-left: 6px; }
    }
    @media (min-width: 781px) {
      .nav-creador__enlace .nav-creador__corto { display: none; }
    }
  `;
  document.head.appendChild(estilos);

  const barra = document.createElement('nav');
  barra.className = 'nav-creador';
  barra.setAttribute('aria-label', 'Herramientas del creador');

  const marca = document.createElement('a');
  marca.className = 'nav-creador__marca';
  marca.href = raiz;
  marca.textContent = '🛠️ Creador';
  barra.appendChild(marca);

  for (const h of HERRAMIENTAS) {
    if (h.id === '') continue;  // El portal ya es la marca de la izquierda.
    const a = document.createElement('a');
    a.className = 'nav-creador__enlace';
    a.href = `${raiz}${h.id}/`;
    if (h.id === actual) a.setAttribute('aria-current', 'page');
    a.innerHTML = `<span>${h.icono}</span>`
      + `<span class="nav-creador__largo"></span>`
      + `<span class="nav-creador__corto"></span>`;
    // textContent y no interpolación: los nombres son nuestros, pero mantener
    // la costumbre sale más barato que auditar cada vez que se añade uno.
    a.querySelector('.nav-creador__largo').textContent = h.nombre;
    a.querySelector('.nav-creador__corto').textContent = h.corto;
    barra.appendChild(a);
  }

  const juego = document.createElement('a');
  juego.className = 'nav-creador__juego';
  juego.href = `${raiz}../`;
  juego.textContent = '▶ Jugar';
  barra.appendChild(juego);

  document.body.insertBefore(barra, document.body.firstChild);
})();
