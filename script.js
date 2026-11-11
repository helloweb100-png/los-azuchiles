/* ==========================================================================
   LOS AZUCHILES · Jardín de Eventos — script.js
   JavaScript puro, sin librerías: la página se ve completa aunque nada cargue.
   Motor de scroll con suavizado, escenario fijo (tarde → noche), imagen que se
   abre, scroll horizontal, partículas, luces, visor de fotos y formulario.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     ÚNICO lugar para el número de WhatsApp.
     Escríbelo con 10 dígitos, sin +52 ni espacios. Ej.: '7211234567'
     Mientras esté vacío, el botón flotante de WhatsApp y el envío por
     WhatsApp se ocultan, y el formulario arma una solicitud que se puede copiar.
     ------------------------------------------------------------------------ */
  const WHATSAPP_NUMERO = '';

  const WA_TEXTO_BASE = 'Hola, me gustaría información sobre el jardín Los Azuchiles para mi evento.';
  const CODIGO_UBICACION = 'R8H3+6P';

  /* ------------------------------------------------------------------------ */
  const root = document.documentElement;
  const body = document.body;
  root.classList.add('js-live'); // el JS está vivo: se cancelan los respaldos CSS

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let vw = window.innerWidth;
  let vh = window.innerHeight;

  const HAS_WA = /^\d{10}$/.test(WHATSAPP_NUMERO);
  const waUrl = (text) => `https://wa.me/52${WHATSAPP_NUMERO}?text=${encodeURIComponent(text)}`;

  /* ======================= Motor de scroll ======================= */
  const hooks = [];
  let ticking = false;
  function frame() {
    ticking = false;
    vw = window.innerWidth;
    vh = window.innerHeight;
    for (const h of hooks) {
      try { h(); } catch (e) { /* un efecto roto no debe tumbar a los demás */ }
    }
  }
  const requestFrame = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  };

  /* Valores suavizados (da la sensación de "cámara lenta" al hacer scroll) */
  const smoothers = [];
  let smoothRunning = false;
  function makeSmooth(apply, init = 0, k = 0.1) {
    const o = { t: init, c: init, apply, k };
    smoothers.push(o);
    return o;
  }
  function runSmooth() {
    let busy = false;
    for (const o of smoothers) {
      try {
        const d = o.t - o.c;
        if (Math.abs(d) > 0.0004) { o.c += d * o.k; o.apply(o.c); busy = true; }
        else if (o.c !== o.t) { o.c = o.t; o.apply(o.c); }
      } catch (e) { /* ignorar */ }
    }
    if (busy) requestAnimationFrame(runSmooth); else smoothRunning = false;
  }
  function setTarget(o, v) {
    o.t = v;
    if (REDUCE) { o.c = v; try { o.apply(v); } catch (e) { /* ignorar */ } return; }
    if (!smoothRunning) { smoothRunning = true; requestAnimationFrame(runSmooth); }
  }

  /* ======================= Utilidades ======================= */
  let toastTimer = 0;
  function showToast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2400);
  }
  async function copyText(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* ignorar */ }
      ta.remove();
    }
    showToast(msg || 'Copiado');
  }

  /* ======================= Cargador ======================= */
  function initLoader() {
    const loader = $('#loader');
    if (!loader) { root.classList.add('is-ready'); body.classList.remove('is-loading'); return; }
    loader.style.animation = 'none'; // JS toma el control; el respaldo CSS queda para cuando JS falla
    const pctEl = $('#loader-pct');
    const t0 = performance.now();
    const DUR = 1300;
    let done = false;

    (function tick(now) {
      const t = clamp((now - t0) / DUR);
      if (pctEl) pctEl.textContent = String(Math.round(easeOut(t) * 100));
      if (t < 1 && !done) requestAnimationFrame(tick);
    })(t0);

    const finish = () => {
      if (done) return;
      done = true;
      if (pctEl) pctEl.textContent = '100';
      loader.classList.add('is-done');
      root.classList.add('is-ready');
      body.classList.remove('is-loading');
      setTimeout(() => { loader.hidden = true; }, 800);
    };
    const minWait = new Promise((r) => setTimeout(r, 1300));
    const loaded = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((r) => window.addEventListener('load', r, { once: true }));
    Promise.all([minWait, loaded]).then(finish);
    setTimeout(finish, 1550); // tope: el cargador nunca se queda más de ~2 s
  }

  /* ======================= WhatsApp ======================= */
  function initWhatsApp() {
    $$('[data-wa]').forEach((a) => {
      if (!HAS_WA) return; // sin número: el enlace queda apuntando al formulario (#contacto)
      a.href = waUrl(a.getAttribute('data-wa') || WA_TEXTO_BASE);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
    const fab = $('#fab');
    if (!fab) return;
    if (HAS_WA) {
      fab.href = waUrl(WA_TEXTO_BASE);
      fab.target = '_blank';
      fab.rel = 'noopener noreferrer';
      fab.classList.add('fab--wa');
      fab.hidden = false;
    } else {
      // Sin número: el botón flotante pasa a ser un atajo para agendar la visita
      const use = $('use', fab);
      if (use) use.setAttribute('href', '#i-cal');
      const lbl = $('#fab-label');
      if (lbl) lbl.textContent = 'Agenda tu visita';
      fab.setAttribute('aria-label', 'Agenda tu visita al jardín');
      fab.classList.add('is-away');
      fab.hidden = false;
    }

    // El botón se aparta donde estorba: en móvil, sobre los escenarios fijos (ya traen su propio CTA);
    // sin WhatsApp, además, en el primer pantallazo y sobre el formulario.
    const pins = ['#momentos', '#palapa'].map((s) => $(s)).filter(Boolean);
    const contact = $('#contacto');
    hooks.push(() => {
      const inPin = vw < 700 && pins.some((p) => {
        const r = p.getBoundingClientRect();
        return r.top < vh * 0.5 && r.bottom > vh * 0.5;
      });
      let away = inPin;
      if (!HAS_WA) {
        const cr = contact ? contact.getBoundingClientRect() : null;
        const inContact = !!cr && cr.top < vh * 0.75 && cr.bottom > 0;
        away = away || (window.scrollY || 0) < vh * 0.7 || inContact;
      }
      fab.classList.toggle('is-away', away);
    });
  }

  /* ======================= Encabezado y menú ======================= */
  function initHeader() {
    const header = $('#site-header');
    const bar = $('#progress-bar');
    const burger = $('#burger');
    const nav = $('#nav');

    hooks.push(() => {
      const y = window.scrollY || window.pageYOffset || 0;
      const max = root.scrollHeight - vh;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(y / max).toFixed(4) : 0})`;
      if (header) header.classList.toggle('is-scrolled', y > 40);
    });

    const links = $$('[data-nav]');
    const secs = links.map((a) => $(a.getAttribute('href')));
    hooks.push(() => {
      const line = vh * 0.4;
      let cur = -1;
      secs.forEach((s, i) => {
        if (!s) return;
        const r = s.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) cur = i;
      });
      links.forEach((a, i) => a.classList.toggle('is-active', i === cur));
    });

    if (burger && nav) {
      const setNav = (open) => {
        root.classList.toggle('nav-open', open);
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      };
      burger.addEventListener('click', () => setNav(!root.classList.contains('nav-open')));
      nav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });
      window.addEventListener('resize', () => { if (window.innerWidth >= 1180) setNav(false); });
    }
  }

  /* ======================= Revelados al hacer scroll ======================= */
  function initReveal() {
    const els = $$('.rv');
    const pending = new Set(els);
    let io = null;
    const show = (el) => {
      if (!pending.has(el)) return;
      pending.delete(el);
      el.classList.add('is-in');
      if (io) io.unobserve(el);
    };
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) show(en.target); });
      }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
      els.forEach((el) => io.observe(el));
    } else {
      els.forEach(show);
    }
    // Respaldo por geometría: si el observador falla, igual se revela todo lo que ya se ve
    const sweep = () => {
      pending.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.94 && r.bottom > 0) show(el);
      });
    };
    hooks.push(sweep);
    setTimeout(sweep, 2000);
    window.addEventListener('load', () => setTimeout(sweep, 2000));
  }

  /* ======================= Hero ======================= */
  function initHero() {
    const hero = $('#inicio');
    const bg = $('#hero-bg');
    const inner = $('#hero-inner');
    if (!hero) return;

    hooks.push(() => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y > vh * 1.3) return;
      if (bg) bg.style.transform = `translate3d(0, ${(y * 0.28).toFixed(1)}px, 0)`;
      if (inner) {
        inner.style.opacity = clamp(1 - y / (vh * 0.85)).toFixed(3);
        inner.style.transform = `translate3d(0, ${(y * -0.08).toFixed(1)}px, 0)`;
      }
    });

    if (FINE && !REDUCE) {
      let pending = false; let px = 0; let py = 0;
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        px = ((e.clientX - r.left) / r.width - 0.5) * 2;
        py = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          hero.style.setProperty('--mx', px.toFixed(3));
          hero.style.setProperty('--my', py.toFixed(3));
        });
      });
    }

    // Interruptor "Encender las luces"
    const tg = $('#lights-toggle');
    const lbl = $('#lights-label');
    if (tg) {
      tg.addEventListener('click', () => {
        const on = tg.getAttribute('aria-pressed') !== 'true';
        tg.setAttribute('aria-pressed', String(on));
        hero.classList.toggle('is-night', on);
        if (lbl) lbl.textContent = on ? 'Apagar las luces' : 'Encender las luces';
        if (fx) fx.setNight(on);
      });
    }
  }

  /* Cadenas de focos del hero (se calculan con el ancho real de la pantalla) */
  function buildLights() {
    const svg = $('#lights');
    if (!svg) return;
    const w = Math.max(320, svg.clientWidth || vw);
    svg.setAttribute('viewBox', `0 0 ${w} 210`);
    const segW = w < 700 ? w / 2 : w / 4;
    const strings = [
      { y: 18, sag: 44, off: 0, op: 1 },
      { y: 56, sag: 62, off: segW / 2, op: 0.7 }
    ];
    let html = '';
    strings.forEach((s) => {
      let x = -s.off - 10;
      while (x < w + 10) {
        const x1 = x + segW;
        const cx = x + segW / 2;
        const cy = s.y + s.sag * 2;
        html += `<path d="M${x.toFixed(1)} ${s.y} Q${cx.toFixed(1)} ${cy} ${x1.toFixed(1)} ${s.y}" opacity="${s.op}"/>`;
        const n = Math.max(3, Math.round(segW / 54));
        for (let k = 1; k < n; k++) {
          const t = k / n; const u = 1 - t;
          const bx = u * u * x + 2 * u * t * cx + t * t * x1;
          const by = u * u * s.y + 2 * u * t * cy + t * t * s.y + 5;
          const d = (Math.random() * 3).toFixed(2);
          const dur = (2.4 + Math.random() * 2).toFixed(2);
          html += `<g opacity="${s.op}" style="--dl:-${d}s;--t:${dur}s"><circle class="halo" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="11"/><circle class="bulb" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3.2"/></g>`;
        }
        x = x1;
      }
    });
    svg.innerHTML = html;
  }

  /* Pétalos, hojas y luciérnagas (animación constante, solo corre si el hero se ve) */
  let fx = null;
  function initFX() {
    const cv = $('#fx');
    const hero = $('#inicio');
    if (!cv || !hero || REDUCE) return null;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;

    let W = 0; let H = 0; let parts = []; let raf = 0;
    let running = false; let last = 0; let night = false;
    const PET = ['#F4B5A6', '#FBE3DC', '#F7C6BA', '#E99A8C', '#FFD7CC'];
    const rnd = (a, b) => a + Math.random() * (b - a);

    const make = (init, forceSpark) => {
      const r = Math.random();
      const k = forceSpark ? 's' : (r < 0.52 ? 'p' : r < 0.7 ? 'l' : 's');
      const p = {
        k,
        x: rnd(0, W),
        y: init ? rnd(0, H) : rnd(-60, -10),
        s: k === 's' ? rnd(1.4, 3.2) : rnd(5, 11),
        vy: k === 's' ? rnd(-7, 7) : rnd(14, 34),
        vx: rnd(-8, 8),
        r: rnd(0, 6.28),
        vr: rnd(-1.2, 1.2),
        ph: rnd(0, 6.28),
        sw: rnd(0.6, 1.6),
        c: PET[(Math.random() * PET.length) | 0],
        a: rnd(0.55, 0.95),
        extra: !!forceSpark
      };
      if (k === 'l') { p.c = Math.random() < 0.5 ? '#6DAA6F' : '#3E8E54'; p.s = rnd(6, 11); }
      return p;
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      if (!W || !H) return;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = clamp(Math.round(W / 20), 22, 64);
      parts = Array.from({ length: n }, () => make(true));
      if (night) for (let i = 0; i < 16; i++) parts.push(make(true, true));
    }

    function step(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.ph += dt * p.sw;
        p.x += (p.vx + Math.sin(p.ph) * (p.k === 's' ? 6 : 22)) * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        if (p.x < -30) p.x = W + 20; else if (p.x > W + 30) p.x = -20;
        if (p.k === 's') {
          if (p.y < -20) p.y = H + 10; else if (p.y > H + 20) p.y = -10;
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + p.ph * 3);
          const rad = p.s * (night ? 8 : 5.5);
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
          g.addColorStop(0, `rgba(255,232,170,${((0.3 + 0.7 * pulse) * (night ? 1 : 0.8)).toFixed(3)})`);
          g.addColorStop(1, 'rgba(244,201,107,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.2832); ctx.fill();
          continue;
        }
        if (p.y > H + 20) { p.x = rnd(0, W); p.y = rnd(-60, -10); }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = night ? p.a * 0.7 : p.a;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        if (p.k === 'p') {
          ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.ph)));
          ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, 6.2832);
        } else {
          ctx.moveTo(-p.s, 0);
          ctx.quadraticCurveTo(0, -p.s * 0.6, p.s, 0);
          ctx.quadraticCurveTo(0, p.s * 0.6, -p.s, 0);
        }
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(step);
    }

    const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(step); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    let wasW = W;
    window.addEventListener('resize', () => {
      if (cv.clientWidth !== wasW) { wasW = cv.clientWidth; resize(); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { es[0].isIntersecting ? start() : stop(); }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

    return {
      setNight(on) {
        night = on;
        if (on) { for (let i = 0; i < 16; i++) parts.push(make(true, true)); }
        else { parts = parts.filter((p) => !p.extra); }
      }
    };
  }

  /* ======================= Manifiesto: palabras que se encienden ======================= */
  function initWords() {
    const h = $('[data-words]');
    if (!h || REDUCE) return;
    const text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
    const spans = $$('.w', h);
    const n = spans.length;
    const o = makeSmooth((p) => {
      for (let i = 0; i < n; i++) {
        const t = clamp(p * (n + 8) - i);
        spans[i].style.opacity = (0.16 + 0.84 * t).toFixed(3);
      }
    }, 0, 0.14);
    o.apply(0);
    hooks.push(() => {
      const r = h.getBoundingClientRect();
      setTarget(o, clamp((vh * 0.86 - r.top) / (vh * 0.4 + r.height * 0.6)));
    });
  }

  /* ======================= Línea de tiempo (proceso) ======================= */
  function initTimeline() {
    const tl = $('#tl');
    if (!tl) return;
    const items = $$('.tl__item', tl);
    if (REDUCE) { items.forEach((i) => i.classList.add('is-on')); return; }
    const o = makeSmooth((p) => tl.style.setProperty('--tl', p.toFixed(3)), 0, 0.12);
    o.apply(0);
    hooks.push(() => {
      const r = tl.getBoundingClientRect();
      setTarget(o, clamp((vh * 0.62 - r.top) / r.height));
      items.forEach((it) => {
        const ir = it.getBoundingClientRect();
        it.classList.toggle('is-on', ir.top < vh * 0.68);
      });
    });
  }

  /* ======================= Parallax suave ======================= */
  function initParallax() {
    if (REDUCE) return;
    const pars = $$('[data-par]').map((el) => ({
      el, k: parseFloat(el.dataset.par) || 0.1, host: el.closest('.bento__item') || el
    }));
    hooks.push(() => {
      pars.forEach((p) => {
        const r = p.host.getBoundingClientRect();
        if (r.bottom < -120 || r.top > vh + 120) return;
        const c = (r.top + r.height / 2 - vh / 2) / vh;
        p.el.style.setProperty('--py', `${(c * -p.k * 120).toFixed(1)}px`);
      });
    });
  }

  /* ======================= Escenario fijo, imagen que se abre y scroll horizontal ======================= */
  function initPinned() {
    if (REDUCE) return;
    try {
      const on = () => root.classList.contains('scenes-on');

      /* --- Un jardín, tres momentos --- */
      const scenes = $('#momentos');
      if (scenes) {
        const items = $$('.scene', scenes);
        const labels = $$('.scenes__labels li', scenes);
        const sun = $('#sun');
        let cur = 0;
        const sunS = makeSmooth((p) => {
          if (!sun) return;
          // Parábola del arco: x lineal, y = 66 - 200·t·(1-t) (coincide con el path del SVG)
          sun.setAttribute('cx', (20 + 360 * p).toFixed(1));
          sun.setAttribute('cy', (66 - 200 * p * (1 - p)).toFixed(1));
        }, 0, 0.12);
        hooks.push(() => {
          if (!on()) return;
          const r = scenes.getBoundingClientRect();
          const total = r.height - vh;
          if (total <= 0) return;
          const p = clamp(-r.top / total);
          const idx = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
          if (idx !== cur) {
            cur = idx;
            scenes.dataset.scene = String(idx);
            items.forEach((s, i) => s.classList.toggle('is-active', i === idx));
            labels.forEach((l, i) => l.classList.toggle('is-on', i === idx));
          }
          setTarget(sunS, p);
        });
      }

      /* --- La palapa: la imagen se abre hasta ocupar toda la pantalla --- */
      const expand = $('#palapa');
      if (expand) {
        const exS = makeSmooth((p) => {
          const small = vw < 720;
          const e = easeInOut(clamp(p / 0.62));
          const ix0 = small ? 13 : 30;
          const iy0 = small ? 20 : 15;
          const w0 = vw * (1 - (2 * ix0) / 100);
          expand.style.setProperty('--ix', `${lerp(ix0, 0, e).toFixed(2)}%`);
          expand.style.setProperty('--iy', `${lerp(iy0, 0, e).toFixed(2)}%`);
          expand.style.setProperty('--irt', `${lerp(w0 / 2, 0, e).toFixed(1)}px`);
          expand.style.setProperty('--irb', `${lerp(30, 0, e).toFixed(1)}px`);
          expand.style.setProperty('--is', lerp(1.28, 1, e).toFixed(3));
          expand.style.setProperty('--e', e.toFixed(3));
          const tp = clamp((p - 0.6) / 0.25);
          expand.style.setProperty('--tp', tp.toFixed(3));
          expand.classList.toggle('is-copy', tp > 0.3);
        }, 0, 0.1);
        exS.apply(0);
        hooks.push(() => {
          if (!on()) return;
          const r = expand.getBoundingClientRect();
          const total = r.height - vh;
          if (total <= 0) return;
          setTarget(exS, clamp(-r.top / total));
        });
        window.addEventListener('resize', () => { try { exS.apply(exS.c); } catch (e) { /* ignorar */ } });
      }

      /* --- Estilos de montaje: el scroll vertical mueve las tarjetas en horizontal --- */
      const hsEl = $('#montajes');
      const track = $('#hs-track');
      if (hsEl && track) {
        const hs = { dist: 0 };
        const size = () => {
          hs.dist = Math.max(0, track.scrollWidth - root.clientWidth);
          hsEl.style.setProperty('--hs-h', `${Math.round(hs.dist + window.innerHeight)}px`);
        };
        const hsS = makeSmooth((p) => {
          track.style.setProperty('--hs-x', `${(-hs.dist * p).toFixed(1)}px`);
          hsEl.style.setProperty('--hs-p', p.toFixed(4));
        }, 0, 0.12);
        // Se calcula con el modo fijo ya activo, para medir el ancho real del carril
        root.classList.add('scenes-on');
        size();
        hooks.push(() => {
          if (!on()) return;
          const r = hsEl.getBoundingClientRect();
          const total = r.height - vh;
          if (total <= 0) return;
          setTarget(hsS, clamp(-r.top / total));
        });
        window.addEventListener('resize', size);
        window.addEventListener('load', size);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
      }

      root.classList.add('scenes-on');
    } catch (e) {
      root.classList.remove('scenes-on');
    }
  }

  /* ======================= Galería y visor ======================= */
  function initGallery() {
    const rows = $$('.gal__row');
    const list = $$('.gal__item').map((b) => ({
      src: b.dataset.full,
      cap: b.dataset.cap || '',
      alt: (b.querySelector('img') || {}).alt || ''
    }));

    // Carriles que nunca dejan de moverse (se duplican para que el bucle sea continuo)
    if (!REDUCE) {
      rows.forEach((row) => {
        Array.from(row.children).forEach((li) => {
          const c = li.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          const b = c.querySelector('button');
          if (b) b.tabIndex = -1;
          row.appendChild(c);
        });
        row.scrollLeft = 0;
        row.classList.add('is-run');
      });
    }

    const lb = $('#lb');
    if (!lb || !list.length) return;
    const img = $('#lb-img');
    const cap = $('#lb-cap');
    const btnClose = $('#lb-close');
    const btnPrev = $('#lb-prev');
    const btnNext = $('#lb-next');
    let idx = 0; let opener = null; let closeTimer = 0;

    const show = (i) => {
      idx = (i + list.length) % list.length;
      const it = list[idx];
      img.src = it.src; img.alt = it.alt; cap.textContent = it.cap;
    };
    const open = (i, from) => {
      clearTimeout(closeTimer);
      opener = from; show(i);
      lb.hidden = false;
      requestAnimationFrame(() => lb.classList.add('is-open'));
      body.style.overflow = 'hidden';
      btnClose.focus();
    };
    const close = () => {
      lb.classList.remove('is-open');
      body.style.overflow = '';
      closeTimer = setTimeout(() => { lb.hidden = true; }, 420);
      if (opener && opener.focus) opener.focus();
    };

    // La galería y el bloque de loza abren el mismo visor
    $$('#gal, #loza').forEach((zona) => {
      zona.addEventListener('click', (e) => {
        const b = e.target.closest('.gal__item');
        if (!b) return;
        const i = list.findIndex((it) => it.src === b.dataset.full);
        open(i < 0 ? 0 : i, b);
      });
    });
    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', () => show(idx - 1));
    btnNext.addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {
        const f = [btnClose, btnPrev, btnNext];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
  }

  /* ======================= Efectos de puntero (solo escritorio) ======================= */
  function initPointerFX() {
    if (!FINE || REDUCE) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', `${((x - 0.5) * 8).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
    $$('[data-mag]').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.16;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.26;
        b.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ======================= Formulario ======================= */
  function initForm() {
    const form = $('#form');
    if (!form) return;
    const label = $('#form-label');
    const icon = $('#form-ic use');
    const err = $('#form-err');
    const result = $('#form-result');
    const pre = $('#form-text');
    const title = $('.form__result-title', form);
    const copyBtn = $('#form-copy');
    const note = $('#wa-note');
    const fNombre = $('#f-nombre');
    const fTipo = $('#f-tipo');

    if (HAS_WA) {
      if (note) note.hidden = false;
    } else {
      // Sin número de WhatsApp: el formulario arma la solicitud para copiarla
      if (label) label.textContent = 'Quiero armar mi solicitud';
      if (icon) icon.setAttribute('href', '#i-check');
    }

    const TIPOS = {
      'Boda': 'mi boda',
      'XV años': 'mis XV años',
      'Evento de empresa': 'un evento de empresa',
      'Cumpleaños': 'un cumpleaños',
      'Otra celebración': 'una celebración'
    };

    const build = () => {
      const fd = new FormData(form);
      const nombre = String(fd.get('nombre') || '').trim();
      const tipo = String(fd.get('tipo') || '');
      const fecha = String(fd.get('fecha') || '');
      const inv = String(fd.get('invitados') || '').trim();
      const extra = String(fd.get('mensaje') || '').trim();
      const interes = fd.getAll('interes').map(String);
      const lines = [
        `Hola, soy ${nombre}.`,
        `Quiero información para ${TIPOS[tipo] || 'mi evento'} en el jardín Los Azuchiles.`
      ];
      if (fecha) {
        const d = new Date(`${fecha}T12:00:00`);
        const f = isNaN(d) ? fecha : d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        lines.push(`Fecha tentativa: ${f}.`);
      }
      if (inv) lines.push(`Invitados aproximados: ${inv}.`);
      if (interes.length) lines.push(`Me interesa: ${interes.join(', ')}.`);
      if (extra) lines.push(`Comentarios: ${extra}`);
      lines.push('Me gustaría agendar una visita al jardín. ¡Gracias!');
      return lines.join('\n');
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      err.hidden = true;
      [fNombre, fTipo].forEach((f) => f.classList.remove('is-bad'));
      const bad = [];
      if (!fNombre.value.trim()) bad.push(fNombre);
      if (!fTipo.value) bad.push(fTipo);
      if (bad.length) {
        bad.forEach((f) => f.classList.add('is-bad'));
        err.textContent = 'Cuéntanos tu nombre y qué tipo de evento tienes para armar tu solicitud.';
        err.hidden = false;
        bad[0].focus();
        return;
      }
      const msg = build();
      pre.textContent = msg;
      result.hidden = false;
      if (HAS_WA) {
        title.lastChild.textContent = ' Abrimos WhatsApp con tu mensaje';
        const a = document.createElement('a');
        a.href = waUrl(msg); a.target = '_blank'; a.rel = 'noopener noreferrer';
        document.body.appendChild(a); a.click(); a.remove();
        showToast('Abriendo WhatsApp…');
      } else {
        title.lastChild.textContent = ' Tu solicitud está lista';
        showToast('Solicitud lista para copiar');
      }
      result.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'nearest' });
    });
    [fNombre, fTipo].forEach((f) => f.addEventListener('input', () => f.classList.remove('is-bad')));
    if (copyBtn) copyBtn.addEventListener('click', () => copyText(pre.textContent, 'Solicitud copiada'));
  }

  function initMisc() {
    const code = $('#copy-code');
    if (code) code.addEventListener('click', () => copyText(CODIGO_UBICACION, 'Código de ubicación copiado'));
  }

  /* ======================= Arranque ======================= */
  initLoader();
  initWhatsApp();
  initHeader();
  initReveal();
  initHero();
  buildLights();
  fx = initFX();
  initWords();
  initTimeline();
  initParallax();
  initGallery();
  initPointerFX();
  initForm();
  initMisc();
  initPinned();

  // Reconstruye las luces solo si cambia el ancho (no en cada scroll móvil)
  let lastW = vw;
  window.addEventListener('resize', () => {
    requestFrame();
    if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; buildLights(); }
  });
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('load', requestFrame);
  frame();
})();
