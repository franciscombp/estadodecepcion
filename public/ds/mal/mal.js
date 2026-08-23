/* ══════════════════════════════════════════════════════════════
   MAL DS · comportamientos
   https://una.red/ds/mal/mal.js

   El JavaScript de los componentes que no se resuelven solo con CSS.
   Tres reglas:
     · Todo es OPCIONAL y AUTOMÁTICO: cada pieza busca su marcado y, si
       no está, se calla. Una página de solo botones no lo necesita.
     · Nada de contenido dentro del código: los datos van en el HTML.
     · Respeta `prefers-reduced-motion`: lo que se mueve solo, se para.

   Uso:
       <script src="https://una.red/ds/mal/mal.js" defer></script>

   Arranque manual:
       <script src="…/mal.js" data-mal-auto="no" defer></script>
       malDS.init(document.querySelector('#zona'));

   API pública (window.malDS):
       init(raiz)            arranca los componentes dentro de `raiz`
       aviso(texto, tipo)    muestra un toast · tipo: '' | 'ok' | 'error'
       abrir(idModal)        abre un <dialog class="modal">
       iconos()              promesa: el sprite de iconos ya está en la página
       quieto                true si el sistema pide menos movimiento
   ══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
  const guion = document.currentScript;
  const fuente = guion && guion.src ? guion.src : '/ds/mal/mal.js';
  const base = fuente.replace(/mal\.js(\?.*)?$/, '');
  /* Si el <script> viene sellado (`mal.js?v=1.0.14`), el sprite se pide con
     el MISMO sello. Sin esto, una página que estrena versión seguiría
     comiéndose el `iconos.svg` viejo del borde: son dos URL distintas y
     solo una llevaba número. */
  const sello = (fuente.match(/\?.*$/) || [''])[0];

  /* ─── iconos: el sprite entra en la página una sola vez ───────
     Así `<use href="#i-casa">` funciona en cualquier sitio, también
     desde otro origen (el servidor de /ds/ manda CORS). */
  let spritePromesa = null;
  function iconos() {
    if (spritePromesa) return spritePromesa;
    if (document.getElementById('i-casa')) return (spritePromesa = Promise.resolve(true));
    spritePromesa = fetch(base + 'iconos.svg' + sello, { mode: 'cors' })
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((svg) => {
        const caja = document.createElement('div');
        caja.innerHTML = svg;
        const el = caja.querySelector('svg');
        if (!el) return false;
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
        document.body.prepend(el);
        return true;
      })
      .catch(() => false);
    return spritePromesa;
  }

  /* ─── pestañas ────────────────────────────────────────────────── */
  function pestanas(raiz) {
    $$('.tabs-control', raiz).forEach((grupo) => {
      const disparadores = $$('.tab-trigger', grupo);
      disparadores.forEach((b) => {
        b.setAttribute('role', 'tab');
        b.addEventListener('click', () => {
          disparadores.forEach((o) => { o.classList.remove('active'); o.setAttribute('aria-selected', 'false'); });
          b.classList.add('active');
          b.setAttribute('aria-selected', 'true');
          const id = b.dataset.target;
          if (!id) return;
          const panel = document.getElementById(id);
          if (!panel) return;
          $$('.tab-panel', panel.parentElement).forEach((p) => { p.hidden = true; });
          panel.hidden = false;
        });
      });
    });
  }

  /* ─── menú desplegable (<details class="menu">) ───────────────
     Se abre solo; esto lo cierra al pulsar fuera o Escape y deja
     un solo menú abierto a la vez. */
  function menus(raiz) {
    const lista = $$('details.menu', raiz);
    if (!lista.length) return;
    lista.forEach((m) => {
      m.addEventListener('toggle', () => {
        if (m.open) lista.forEach((o) => { if (o !== m) o.open = false; });
      });
      $$('.menu__item', m).forEach((it) => it.addEventListener('click', () => { m.open = false; }));
    });
    document.addEventListener('click', (e) => {
      lista.forEach((m) => { if (m.open && !m.contains(e.target)) m.open = false; });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') lista.forEach((m) => { m.open = false; });
    });
  }

  /* ─── modal (<dialog class="modal">) ──────────────────────────
     `data-abre="#id"` abre · `data-cierra` cierra el más cercano.
     Pulsar el fondo también cierra. */
  function abrir(id) {
    const d = typeof id === 'string' ? document.querySelector(id) : id;
    if (d && typeof d.showModal === 'function' && !d.open) d.showModal();
    return d;
  }
  function modales(raiz) {
    $$('[data-abre]', raiz).forEach((b) => {
      b.addEventListener('click', (e) => { e.preventDefault(); abrir(b.dataset.abre); });
    });
    $$('[data-cierra]', raiz).forEach((b) => {
      b.addEventListener('click', () => { const d = b.closest('dialog'); if (d) d.close(); });
    });
    $$('dialog.modal', raiz).forEach((d) => {
      d.addEventListener('click', (e) => {
        const r = d.getBoundingClientRect();
        const fuera = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (fuera) d.close();
      });
    });
  }

  /* ─── toast ───────────────────────────────────────────────────── */
  let toastReloj = null;
  function aviso(texto, tipo) {
    let t = document.getElementById('mal-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mal-toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    const icono = tipo === 'ok' ? 'i-check' : tipo === 'error' ? 'i-alerta' : 'i-info';
    t.className = 'toast' + (tipo ? ' toast--' + tipo : '');
    t.innerHTML = `<svg class="icono" aria-hidden="true"><use href="#${icono}"/></svg><span></span>`;
    t.querySelector('span').textContent = texto;
    t.hidden = false;
    clearTimeout(toastReloj);
    toastReloj = setTimeout(() => { t.hidden = true; }, 3200);
    iconos();
    return t;
  }

  /* ─── copiar: [data-copiar] o .btn-copy con data-copy ─────────── */
  function copiar(raiz) {
    $$('[data-copiar]', raiz).forEach((b) => {
      b.addEventListener('click', () => {
        const sel = b.dataset.copiar;
        let fuente = sel ? document.querySelector(sel)
          : b.closest('.codigo-bloque, .sb-code, .grupo-entrada, pre, .campo');
        // en .codigo-bloque el botón es HERMANO del <pre>, no está dentro:
        // sin esto, closest() sube al contenedor y se copia una cadena vacía
        if (fuente && fuente.matches('.codigo-bloque')) fuente = fuente.querySelector('pre') || fuente;
        const txt = fuente ? (fuente.value !== undefined ? fuente.value : fuente.textContent) : (b.dataset.texto || '');
        const listo = () => aviso('Copiado', 'ok');
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(txt.trim()).then(listo).catch(() => aviso('No se pudo copiar', 'error'));
        } else {
          const ta = document.createElement('textarea');
          ta.value = txt.trim(); ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
          document.body.appendChild(ta); ta.select();
          let ok = false;
          try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
          ta.remove();
          ok ? listo() : aviso('Selecciona y copia', '');
        }
      });
    });
  }

  /* ─── paso: − valor + ──────────────────────────────────────────── */
  function pasos(raiz) {
    $$('.paso', raiz).forEach((p) => {
      const out = p.querySelector('output');
      const [menos, mas] = $$('button', p);
      if (!out || !menos || !mas) return;
      const min = Number(p.dataset.min ?? -Infinity), max = Number(p.dataset.max ?? Infinity);
      const salto = Number(p.dataset.salto || 1);
      const pon = (v) => {
        v = Math.min(max, Math.max(min, v));
        out.value = out.textContent = String(v);
        p.dispatchEvent(new CustomEvent('mal:cambio', { detail: v, bubbles: true }));
      };
      menos.addEventListener('click', () => pon(Number(out.textContent) - salto));
      mas.addEventListener('click', () => pon(Number(out.textContent) + salto));
    });
  }

  /* ─── ver/ocultar contraseña: [data-ver-clave="#id"] ──────────── */
  function claves(raiz) {
    $$('[data-ver-clave]', raiz).forEach((b) => {
      b.addEventListener('click', () => {
        const inp = document.querySelector(b.dataset.verClave);
        if (!inp) return;
        const ver = inp.type === 'password';
        inp.type = ver ? 'text' : 'password';
        b.setAttribute('aria-pressed', String(ver));
        const use = b.querySelector('use');
        if (use) use.setAttribute('href', ver ? '#i-ojo-cerrado' : '#i-ojo');
      });
    });
  }

  /* ─── progreso de lectura ──────────────────────────────────────── */
  function lectura(raiz) {
    const barra = raiz.querySelector ? raiz.querySelector('.progreso--lectura > span') : null;
    if (!barra) return;
    const pinta = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      barra.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + '%';
    };
    addEventListener('scroll', pinta, { passive: true });
    pinta();
  }

  /* ─── índice: marca la sección visible ─────────────────────────── */
  function indice(raiz) {
    const enlaces = $$('.indice a[href^="#"]', raiz);
    if (!enlaces.length || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        enlaces.forEach((a) => {
          if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    enlaces.forEach((a) => { const s = document.getElementById(a.getAttribute('href').slice(1)); if (s) obs.observe(s); });
  }

  /* ─── carné con paralaje ───────────────────────────────────────── */
  function carne(raiz) {
    if (quieto || !window.matchMedia('(hover:hover)').matches) return;
    $$('.ticket', raiz).forEach((t) => {
      t.addEventListener('mousemove', (e) => {
        const r = t.getBoundingClientRect();
        const rx = (r.height / 2 - (e.clientY - r.top)) / 12;
        const ry = ((e.clientX - r.left) - r.width / 2) / 12;
        t.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
      t.addEventListener('mouseleave', () => { t.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)'; });
    });
  }

  /* ─── consola que se escribe sola ──────────────────────────────── */
  function consola(raiz) {
    $$('.terminal-body[data-auto]', raiz).forEach((cuerpo) => {
      const lineas = $$('.t-line', cuerpo);
      if (!lineas.length) return;
      if (quieto) { lineas.forEach((l) => { l.hidden = false; }); return; }
      lineas.forEach((l) => { l.hidden = true; });
      let i = 0;
      const arranca = () => {
        const siguiente = () => {
          if (i >= lineas.length) return;
          const l = lineas[i]; l.hidden = false;
          const destino = l.querySelector('[data-escribir]');
          if (!destino) { i++; setTimeout(siguiente, 600); return; }
          const texto = destino.dataset.escribir; destino.textContent = '';
          let c = 0;
          const reloj = setInterval(() => {
            destino.textContent += texto[c++];
            if (c >= texto.length) { clearInterval(reloj); i++; setTimeout(siguiente, 500); }
          }, 45);
        };
        siguiente();
      };
      if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver((es) => { if (es[0].isIntersecting) { arranca(); obs.disconnect(); } });
        obs.observe(cuerpo);
      } else arranca();
    });
  }

  /* ─── acordeón del marcado viejo ───────────────────────────────── */
  function acordeon(raiz) {
    $$('.accordion-header', raiz).forEach((cab) => {
      const cuerpo = cab.nextElementSibling;
      if (!cuerpo || !cuerpo.classList.contains('accordion-content')) return;
      cab.setAttribute('aria-expanded', 'false');
      cab.addEventListener('click', () => {
        const abierto = cab.classList.toggle('active');
        cuerpo.classList.toggle('active', abierto);
        cab.setAttribute('aria-expanded', String(abierto));
      });
    });
  }

  /* ─── pasos de proceso ─────────────────────────────────────────── */
  function stepper(raiz) {
    $$('.feature-stepper', raiz).forEach((grupo) => {
      const items = $$('.feature-step', grupo);
      items.forEach((p) => p.addEventListener('click', () => {
        items.forEach((o) => o.classList.remove('active')); p.classList.add('active');
      }));
    });
  }

  /* ─── arrastre con inercia, compartido ─────────────────────────── */
  function arrastrable(caja, pistas, opts) {
    let x = 0, v = 0, arrastrando = false, xUltimo = 0, pausa = false;
    const vel = opts.velocidad, ancho = opts.ancho;
    const paso = () => {
      if (!arrastrando && !pausa) {
        if (Math.abs(v) > 0.1) { x += v; v *= 0.95; } else { x -= vel; }
      }
      const a = ancho();
      if (a > 0) { if (x <= -a) x += a; if (x > 0) x -= a; }
      pistas().forEach((el) => { el.style.transform = `translateX(${x}px)`; });
      requestAnimationFrame(paso);
    };
    const px = (e) => (e.pageX !== undefined ? e.pageX : e.touches[0].pageX);
    caja.addEventListener('mousedown', (e) => { arrastrando = true; xUltimo = px(e); });
    caja.addEventListener('touchstart', (e) => { arrastrando = true; xUltimo = px(e); }, { passive: true });
    const mueve = (e) => { if (!arrastrando) return; const p = px(e); x += p - xUltimo; v = p - xUltimo; xUltimo = p; };
    window.addEventListener('mousemove', mueve);
    caja.addEventListener('touchmove', mueve, { passive: true });
    const fin = () => { arrastrando = false; };
    window.addEventListener('mouseup', fin);
    caja.addEventListener('touchend', fin);
    if (opts.pausaHover) {
      caja.addEventListener('mouseenter', () => { pausa = true; });
      caja.addEventListener('mouseleave', () => { pausa = false; arrastrando = false; });
    }
    requestAnimationFrame(paso);
  }

  /* ─── marquesina ───────────────────────────────────────────────── */
  function marquesina(raiz) {
    if (quieto) return;
    $$('.marquee-container', raiz).forEach((caja) => {
      const cinta = caja.querySelector('.marquee-content');
      if (!cinta || caja.dataset.malListo) return;
      caja.dataset.malListo = '1';
      cinta.style.animation = 'none';
      for (let i = 0; i < 2; i++) { const c = cinta.cloneNode(true); c.setAttribute('aria-hidden', 'true'); caja.appendChild(c); }
      arrastrable(caja, () => $$('.marquee-content', caja), { velocidad: 1.1, ancho: () => cinta.offsetWidth + 40 });
    });
  }

  /* ─── carrusel (el de los testimonios) ─────────────────────────── */
  function carrusel(raiz) {
    if (quieto) return;
    $$('.carousel-container', raiz).forEach((caja) => {
      const pista = caja.querySelector('.carousel-track');
      if (!pista || caja.dataset.malListo || pista.children.length < 2) return;
      caja.dataset.malListo = '1';
      Array.from(pista.children).forEach((c) => { const d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); pista.appendChild(d); });
      arrastrable(caja, () => [pista], { velocidad: 0.5, ancho: () => pista.scrollWidth / 2, pausaHover: true });
    });
  }

  /* ─── pila de tarjetas ─────────────────────────────────────────── */
  function pila(raiz) {
    $$('.stacked-cards-container, .portfolio-stack', raiz).forEach((caja) => {
      const clase = caja.classList.contains('portfolio-stack') ? '.portfolio-card' : '.stacked-card';
      let cartas = $$(clase, caja);
      if (cartas.length < 2) return;
      const zona = caja.closest('.portfolio-case') || caja.parentElement;
      const puntos = $$('.dot-indicator', zona), flechas = $$('.nav-arrow', zona);
      let i = 0;
      const pintar = () => {
        cartas.forEach((c, n) => {
          c.style.zIndex = String(cartas.length - n);
          c.style.transform = `translate(${n * 12}px, ${n * 12}px) scale(${1 - n * 0.05})`;
          c.style.pointerEvents = n === 0 ? 'auto' : 'none';
          c.style.transition = quieto ? 'none' : 'transform .6s cubic-bezier(.23,1,.32,1)';
        });
        puntos.forEach((p, n) => p.classList.toggle('active', n === i % (puntos.length || 1)));
      };
      const gira = (dir) => { dir > 0 ? cartas.push(cartas.shift()) : cartas.unshift(cartas.pop()); i = (i + dir + cartas.length) % cartas.length; pintar(); };
      caja.addEventListener('click', () => gira(1));
      if (flechas[0]) flechas[0].addEventListener('click', (e) => { e.stopPropagation(); gira(-1); });
      if (flechas[1]) flechas[1].addEventListener('click', (e) => { e.stopPropagation(); gira(1); });
      pintar();
    });
  }

  /* ─── mapa mental ──────────────────────────────────────────────── */
  function mapaMental(raiz) {
    $$('.mind-map-container', raiz).forEach((caja) => {
      const nodos = $$('.mind-map-node', caja), centro = caja.querySelector('.mind-map-center'), svg = caja.querySelector('svg');
      if (!svg || !centro || !nodos.length) return;
      const A = 600, H = 400, cx = 300, cy = 200;
      const sitios = [{ x: 300, y: 50 }, { x: 470, y: 125 }, { x: 480, y: 285 }, { x: 130, y: 125 }, { x: 120, y: 285 }, { x: 300, y: 355 }];
      svg.setAttribute('viewBox', `0 0 ${A} ${H}`); svg.innerHTML = '';
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('stroke', 'currentColor'); g.setAttribute('stroke-width', '1.5'); g.setAttribute('stroke-dasharray', '4 4'); g.setAttribute('opacity', '.35');
      svg.appendChild(g);
      nodos.forEach((n, i) => {
        const s = sitios[i % sitios.length];
        n.style.position = 'absolute'; n.style.left = (s.x / A * 100) + '%'; n.style.top = (s.y / H * 100) + '%'; n.style.transform = 'translate(-50%, -50%)';
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', cx); l.setAttribute('y1', cy); l.setAttribute('x2', s.x); l.setAttribute('y2', s.y); g.appendChild(l);
      });
    });
  }

  /* ─── cabecera del periódico: sombra al desplazarse ────────────
     El CSS ya declaraba el contrato («mal.js pone .is-scrolled») pero la
     función no existía: init() la llamaba y reventaba con ReferenceError
     en TODAS las páginas que cargan el sistema. */
  function cabeceraPrensa(raiz) {
    const cabs = $$('.em-header', raiz);
    if (!cabs.length) return;
    const pinta = () => cabs.forEach((c) => c.classList.toggle('is-scrolled', scrollY > 4));
    addEventListener('scroll', pinta, { passive: true });
    pinta();
  }

  /* ─── [data-alterna="#id"]: abre y cierra un panel ──────────────
     Lo usa el menú plegado del periódico (.em-menu-toggle → .em-nav).
     El panel abierto es un overlay a pantalla completa DENTRO de la
     cabecera, así que hay que poder cerrarlo con Escape, pulsando el
     fondo o siguiendo un enlace: el botón se queda debajo. */
  function alternar(raiz) {
    $$('[data-alterna]', raiz).forEach((b) => {
      const panel = document.querySelector(b.dataset.alterna);
      if (!panel) return;
      const pon = (abierto) => {
        panel.classList.toggle('es-abierto', abierto);
        b.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      };
      pon(panel.classList.contains('es-abierto'));
      b.addEventListener('click', () => pon(!panel.classList.contains('es-abierto')));
      panel.addEventListener('click', (ev) => {
        if (ev.target === panel || ev.target.closest('a')) pon(false);
      });
      addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && panel.classList.contains('es-abierto')) pon(false);
      });
    });
  }

  /* ─── arranque ────────────────────────────────────────────────── */
  const init = (raiz) => {
    raiz = raiz || document;
    if (raiz.querySelector && raiz.querySelector('.icono, use[href^="#i-"]')) iconos();
    pestanas(raiz); menus(raiz); modales(raiz); copiar(raiz); pasos(raiz); claves(raiz);
    lectura(raiz); indice(raiz); carne(raiz); consola(raiz); acordeon(raiz); stepper(raiz);
    marquesina(raiz); carrusel(raiz); pila(raiz); mapaMental(raiz); cabeceraPrensa(raiz); alternar(raiz);
  };
  window.malDS = Object.assign(window.malDS || {}, { init, aviso, abrir, iconos, quieto });

  if (!guion || guion.dataset.malAuto !== 'no') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(document));
    else init(document);
  }
})();
