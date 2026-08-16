// Interfaz del exportador. La lógica y el catálogo viven en exportador.js, que
// es lo que importa el juego; aquí solo se pinta y se conectan los botones.
import { CATALOGO, exportar, crearVisor } from './exportador.js';
import { cargarHitos } from '../models/hitos.js';

// Los edificios vienen de un archivo, así que hay que esperarlos ANTES de
// montar el catálogo: sin esto salían en la lista pero se clonaban vacíos —el
// visor decía «0 × 0 × 0 m»— porque nadie había descargado el modelo en esta
// página. El juego lo hace en su pantalla de carga; aquí no había ninguna.


const lienzo = document.getElementById('visor');
const medidas = document.getElementById('medidas');
const catalogo = document.getElementById('catalogo');
const visor = crearVisor(lienzo);

let elegida = CATALOGO[0].piezas[0].id;

function bajar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function seleccionar(id) {
  elegida = id;
  const tam = visor.poner(id);
  medidas.textContent = tam
    ? `${tam.ancho} × ${tam.alto} × ${tam.fondo} m (ancho × alto × fondo)`
    : '—';
  for (const b of catalogo.querySelectorAll('.pieza')) {
    b.setAttribute('aria-current', String(b.dataset.id === id));
  }
}

for (const grupo of CATALOGO) {
  const caja = document.createElement('div');
  caja.className = 'grupo';
  const h = document.createElement('h3');
  h.textContent = grupo.grupo;
  caja.appendChild(h);
  for (const pieza of grupo.piezas) {
    const b = document.createElement('button');
    b.className = 'pieza';
    b.dataset.id = pieza.id;
    b.textContent = pieza.nombre;
    b.addEventListener('click', () => seleccionar(pieza.id));
    caja.appendChild(b);
  }
  catalogo.appendChild(caja);
}

document.getElementById('reencuadrar').addEventListener('click', () => visor.reencuadrar());

document.getElementById('bajar').addEventListener('click', async () => {
  bajar(await exportar(elegida), `${elegida}.glb`);
});

document.getElementById('bajarTodo').addEventListener('click', async (e) => {
  const boton = e.currentTarget;
  boton.disabled = true;
  const todas = CATALOGO.flatMap((g) => g.piezas);
  for (let i = 0; i < todas.length; i++) {
    boton.textContent = `Descargando ${i + 1}/${todas.length}…`;
    bajar(await exportar(todas[i].id), `${todas[i].id}.glb`);
    // Un respiro entre descargas: el navegador bloquea las ráfagas.
    await new Promise((r) => setTimeout(r, 350));
  }
  boton.textContent = 'Descargar todo';
  boton.disabled = false;
});

// Los edificios vienen de un archivo, así que hay que esperarlos: sin esto
// salían en la lista pero se clonaban vacíos —el visor decía «0 × 0 × 0 m»—
// porque nadie había descargado el modelo en esta página. El juego lo hace en
// su pantalla de carga; aquí no había ninguna.
//
// Va en un then y no con await de nivel superior porque el build apunta a
// es2020, que no lo admite.
cargarHitos(import.meta.env.BASE_URL ?? '/').then(() => seleccionar(elegida));

seleccionar(elegida);

let previo = performance.now();
(function bucle(ahora) {
  visor.pintar(Math.min(0.05, (ahora - previo) / 1000));
  previo = ahora;
  requestAnimationFrame(bucle);
})(previo);

addEventListener('resize', () => visor.ajustar());
