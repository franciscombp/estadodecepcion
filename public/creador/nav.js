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
    { id: 'pantallas',   icono: '📝', nombre: 'Pantallas',    corto: 'Pantallas' },
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

  // La barra se estila desde creador.css, con los tokens del diario. Tenía
  // aquí dentro su propia hoja —azul marino, rosa de neón y un degradado a
  // cian en el botón de jugar—, que era el octavo sistema visual del proyecto.
  // Lo único que sigue siendo cosa suya es CARGAR la hoja: las herramientas
  // son siete archivos sueltos y así ninguna se olvida de enlazarla.
  const raizHoja = actual === '' ? './creador.css' : '../creador.css';
  if (!document.querySelector('link[data-creador]')) {
    const hoja = document.createElement('link');
    hoja.rel = 'stylesheet';
    hoja.href = raizHoja;
    hoja.dataset.creador = '1';
    document.head.appendChild(hoja);
  }

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
