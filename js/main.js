/* =========================================================
   FT TRAINING — interações
   ========================================================= */
const FT = window.FT;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const SLOTS = [6, 7, 8, 9, 16, 17, 18, 19];
const DAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const TRAINING = { 1: 'FT Hyrox', 2: 'FT Power · Inferiores', 3: 'FT Hyrox', 4: 'FT Power · Superiores', 5: 'FT Hyrox' };

/* ---------- Vídeos sob demanda ----------
   Só baixa quando a seção está chegando perto, só toca quando está na tela
   e respeita o modo "economia de dados" do celular (mostra só a capa). */
const conn = navigator.connection || {};
const saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
function lazyVideo(video, section) {
  if (!video || saveData) return;
  let near = false, visible = false;
  const start = () => {
    if (!video.src) { video.src = video.dataset.src; video.preload = 'auto'; }
    if (visible && !document.hidden) video.play().catch(() => {});
  };
  new IntersectionObserver(([en]) => { near = en.isIntersecting; if (near) start(); }, { rootMargin: '100% 0px' }).observe(section);
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && near) start(); else video.pause();
  }, { threshold: 0.05 }).observe(section);
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else if (visible) start(); });
}

/* ---------- WhatsApp ---------- */
const wpp = (msg) => `https://wa.me/${FT.whatsapp}?text=${encodeURIComponent(msg)}`;
$$('.js-wpp').forEach((a) => { a.href = wpp(a.dataset.msg || 'Olá! Vim pelo site da FT Training.'); });
$$('.js-slot').forEach((a) => {
  const h = String(a.dataset.h).padStart(2, '0');
  a.href = wpp(`Olá! Quero agendar uma aula experimental na FT Training no horário das ${h}h.`);
});
$$('.js-year').forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- Horário de Brasília ---------- */
function nowBR() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')), h: +get('hour'), m: +get('minute') };
}

function initSchedule() {
  const { dow, h, m } = nowBR();
  const weekday = dow >= 1 && dow <= 5;

  // destaque do dia na semana
  const today = $(`.day[data-dow="${dow}"]`);
  if (today) {
    today.classList.add('is-today');
    const week = $('.week');
    if (week.scrollWidth > week.clientWidth) week.scrollLeft = today.offsetLeft - week.offsetLeft - 16;
  }

  // status ao vivo
  const box = $('.status');
  const title = $('.status__title', box);
  const sub = $('.status__sub', box);
  $$('.slot').forEach((s) => s.classList.remove('is-now', 'is-next'));

  const setState = (k) => { box.classList.remove('is-open', 'is-soon', 'is-closed'); box.classList.add(k); };
  const next = weekday ? SLOTS.find((s) => s > h) : undefined;
  const slotEl = (hr) => $(`.slot[data-h="${hr}"]`);

  if (weekday && SLOTS.includes(h)) {
    setState('is-open');
    title.textContent = `Aula das ${String(h).padStart(2, '0')}h rolando agora`;
    sub.textContent = `Hoje: ${TRAINING[dow]}` + (next ? ` · Próxima às ${String(next).padStart(2, '0')}h` : ' · Última aula do dia');
    slotEl(h)?.classList.add('is-now');
    if (next) slotEl(next)?.classList.add('is-next');
  } else if (weekday && next) {
    const mins = (next - h) * 60 - m;
    setState('is-soon');
    title.textContent = `Próxima aula às ${String(next).padStart(2, '0')}h`;
    sub.textContent = `Hoje: ${TRAINING[dow]} · ${mins < 60 ? `em ${mins} min` : `em ${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`}`;
    slotEl(next)?.classList.add('is-next');
  } else {
    let nd = dow;
    do { nd = (nd + 1) % 7; } while (nd === 0 || nd === 6);
    const label = (dow + 1) % 7 === nd ? 'amanhã' : DAYS[nd];
    setState('is-closed');
    title.textContent = 'Box fechado agora';
    sub.textContent = `Próxima aula: ${label}, 06h · ${TRAINING[nd]}`;
  }
}
initSchedule();
setInterval(initSchedule, 60 * 1000);

/* ---------- Feed do Instagram ---------- */
async function loadFeed() {
  let posts = FT.feedSnapshot;
  if (FT.beholdFeedUrl) {
    try {
      const j = await fetch(FT.beholdFeedUrl).then((r) => r.json());
      const arr = Array.isArray(j) ? j : j.posts;
      if (arr && arr.length) {
        posts = arr.slice(0, 12).map((p) => ({
          url: p.permalink,
          img: (p.sizes && p.sizes.medium && p.sizes.medium.mediaUrl) || p.thumbnailUrl || p.mediaUrl,
          video: p.mediaType === 'VIDEO',
          alt: (p.prunedCaption || p.caption || 'Post da FT Training').slice(0, 140)
        }));
      }
    } catch (e) { /* mantém o retrato salvo */ }
  }
  const grid = $('.js-ig-grid');
  grid.innerHTML = posts.map((p) => `
    <a class="ig" href="${p.url}" target="_blank" rel="noopener">
      <img src="${p.img}" alt="${p.alt.replace(/"/g, '&quot;')}" loading="lazy">
      ${p.video ? '<span class="ig__type"><svg class="ico" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m10 8.5 5 3.5-5 3.5z" fill="currentColor"/></svg></span>' : ''}
      <span class="ig__hover"><span><svg class="ico" viewBox="0 0 24 24"><use href="#i-ig"/></svg>Ver post</span></span>
    </a>`).join('');

  if (gsap && !reduced) {
    gsap.from($$('.ig', grid), {
      opacity: 0, y: 50, scale: 0.94, duration: 0.9, ease: 'power3.out',
      stagger: { each: 0.05, grid: 'auto', from: 'start' },
      scrollTrigger: { trigger: grid, start: 'top 85%', once: true }
    });
    ScrollTrigger.refresh();
  }
}

/* ---------- Baralho de reels ---------- */
function initDeck() {
  const deck = $('.deck');
  const reels = FT.reels;
  const n = reels.length;
  let muted = true;
  let busy = false;

  const cards = reels.map((r, idx) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <img src="${r.poster}" alt="" draggable="false" loading="lazy" decoding="async">
      ${r.video ? '<video muted playsinline loop preload="none"></video>' : ''}
      <div class="card__shade"></div>
      <div class="card__progress"><span></span></div>
      <div class="card__top">
        <span class="card__user"><img src="assets/brand/ft-profile.jpg" alt="" draggable="false" loading="lazy">ft.training_</span>
        <span class="card__num">${String(idx + 1).padStart(2, '0')}</span>
      </div>
      <div class="card__play"><svg class="ico" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg></div>
      <div class="card__bottom">
        <p class="card__tag">${r.tag}</p>
        <p class="card__credit">${r.video ? 'Endurance Vision' : 'Toque para assistir no Instagram'}</p>
      </div>`;
    deck.appendChild(el);
    const c = { el, data: r, video: el.querySelector('video'), bar: el.querySelector('.card__progress span'), loaded: false };
    if (!c.video) el.classList.add('is-static');
    else {
      c.video.addEventListener('error', () => toStatic(c));
      c.video.addEventListener('timeupdate', () => {
        if (c.video.duration) c.bar.style.transform = `scaleX(${c.video.currentTime / c.video.duration})`;
      });
    }
    return c;
  });

  function toStatic(c) {
    if (c.video) { c.video.remove(); c.video = null; }
    c.el.classList.add('is-static');
    $('.card__credit', c.el).textContent = 'Toque para assistir no Instagram';
  }

  let order = cards.map((_, i) => i);
  const top = () => cards[order[0]];
  const igUrl = (c) => `https://www.instagram.com/reel/${c.data.code}/`;

  const step = () => (window.innerWidth < 760 ? 18 : 38);
  function layout(instant = false) {
    const st = step();
    order.forEach((ci, pos) => {
      const c = cards[ci];
      const props = {
        x: pos * st, y: pos * -10, rotation: pos * (st > 20 ? 5 : 3), scale: 1 - pos * 0.06,
        opacity: pos > 3 ? 0 : 1, zIndex: n - pos
      };
      const shade = $('.card__shade', c.el);
      const dim = Math.min(pos, 4) * 0.2;
      if (instant) { gsap.set(c.el, props); gsap.set(shade, { opacity: dim }); }
      else {
        gsap.to(c.el, { ...props, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
        gsap.to(shade, { opacity: dim, duration: 0.7, overwrite: 'auto' });
      }
    });
    const t = top();
    $('.js-deck-i').textContent = String(order[0] + 1).padStart(2, '0');
    $('.js-deck-link').href = igUrl(t);
  }

  let deckVisible = false;
  function sync() {
    cards.forEach((c, i) => {
      if (!c.video) return;
      if (i === order[0] && deckVisible) {
        if (!c.loaded) { c.video.src = c.data.video; c.loaded = true; }
        c.video.muted = muted;
        const p = c.video.play();
        if (p) p.then(() => c.el.classList.remove('is-paused')).catch(() => c.el.classList.add('is-paused'));
      } else if (c.loaded) {
        c.video.pause();
      }
    });
  }

  const buzz = () => { try { if (navigator.userActivation?.hasBeenActive && navigator.vibrate) navigator.vibrate(12); } catch (err) {} };
  function go(dir) {
    if (busy) return;
    busy = true;
    buzz();
    if (dir > 0) {
      const c = top();
      gsap.to(c.el, {
        x: -520, rotation: -24, opacity: 0, duration: 0.45, ease: 'power2.in',
        onComplete() {
          order.push(order.shift());
          gsap.set(c.el, { zIndex: 0, x: (n - 1) * step(), rotation: (n - 1) * 5 });
          layout(); sync(); busy = false;
        }
      });
    } else {
      order.unshift(order.pop());
      const c = top();
      gsap.set(c.el, { x: -520, rotation: -24, opacity: 0, zIndex: n + 1 });
      layout(); sync();
      setTimeout(() => { busy = false; }, 350);
    }
  }

  // arrastar
  let drag = null;
  deck.addEventListener('pointerdown', (e) => {
    const c = top();
    if (!c.el.contains(e.target) || busy) return;
    drag = { c, x0: e.clientX, y0: e.clientY, dx: 0, id: e.pointerId, axis: null, t0: performance.now() };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.axis && (Math.abs(drag.dx) > 6 || Math.abs(dy) > 6)) {
      drag.axis = Math.abs(drag.dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.axis === 'x') { try { drag.c.el.setPointerCapture(e.pointerId); } catch (err) { /* sem captura, segue normal */ } }
    }
    if (drag.axis === 'x') gsap.set(drag.c.el, { x: drag.dx, rotation: drag.dx * 0.05 });
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { c, dx, axis, t0 } = drag;
    drag = null;
    // passa a carta se arrastou o suficiente ou deu um "peteleco" rápido
    const flick = Math.abs(dx) / Math.max(1, performance.now() - t0) > 0.5;
    const limit = window.innerWidth < 760 ? 60 : 90;
    if (axis === 'x' && (Math.abs(dx) > limit || (flick && Math.abs(dx) > 24))) {
      busy = true;
      buzz();
      gsap.to(c.el, {
        x: Math.sign(dx) * 560, rotation: Math.sign(dx) * 26, opacity: 0, duration: 0.4, ease: 'power2.out',
        onComplete() {
          order.push(order.shift());
          gsap.set(c.el, { zIndex: 0, x: (n - 1) * step(), rotation: (n - 1) * 5 });
          layout(); sync(); busy = false;
        }
      });
    } else if (!axis) {
      // toque simples
      if (c.video) {
        if (c.video.paused) { c.video.play(); c.el.classList.remove('is-paused'); }
        else { c.video.pause(); c.el.classList.add('is-paused'); }
      } else {
        window.open(igUrl(c), '_blank', 'noopener');
      }
    } else {
      layout();
    }
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  $('.js-deck-next').addEventListener('click', () => go(1));
  $('.js-deck-prev').addEventListener('click', () => go(-1));
  deck.tabIndex = 0;
  deck.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });

  const soundBtn = $('.js-deck-sound');
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    soundBtn.setAttribute('aria-pressed', String(!muted));
    $('.js-deck-sound-label').textContent = muted ? 'Som off' : 'Som on';
    const c = top();
    if (c.video) { c.video.muted = muted; c.video.play().catch(() => {}); }
  });

  $('.js-deck-n').textContent = String(n).padStart(2, '0');

  // as cartas já nascem visíveis; a entrada animada é só um bônus
  layout(true);
  if (!reduced) {
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      gsap.from(cards.map((c) => c.el), { y: 90, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07 });
    }, { threshold: 0.15 });
    io.observe(deck);
  }

  new IntersectionObserver(([en]) => { deckVisible = en.isIntersecting; sync(); }, { threshold: 0.35 }).observe(deck);
}

/* ---------- Fitas (marquee) ---------- */
function initTapes() {
  const tweens = [];
  $$('.tape').forEach((tape) => {
    const track = $('.tape__track', tape);
    const group = $('.tape__group', track);
    const w = group.getBoundingClientRect().width;
    const copies = Math.ceil((window.innerWidth * 1.3) / w) + 1;
    for (let i = 0; i < copies; i++) {
      const cl = group.cloneNode(true);
      cl.setAttribute('aria-hidden', 'true');
      $$('a', cl).forEach((a) => a.setAttribute('tabindex', '-1'));
      track.appendChild(cl);
    }
    const dir = +tape.dataset.dir; // -1 = direita para esquerda
    const tw = gsap.fromTo(track, { x: dir < 0 ? 0 : -w }, { x: dir < 0 ? -w : 0, duration: w / 80, ease: 'none', repeat: -1 });
    tweens.push(tw);
    tape.addEventListener('pointerenter', () => { tape._hover = true; });
    tape.addEventListener('pointerleave', () => { tape._hover = false; });
    tw._tape = tape;
  });

  // fora da tela as fitas param de animar
  new IntersectionObserver(([en]) => tweens.forEach((t) => t.paused(!en.isIntersecting))).observe($('.tapes'));

  let boost = 0;
  ScrollTrigger.create({
    trigger: '.tapes', start: 'top bottom', end: 'bottom top',
    onUpdate(self) { boost = Math.min(Math.abs(self.getVelocity()) / 250, 6); }
  });
  gsap.ticker.add(() => {
    boost *= 0.93;
    tweens.forEach((t) => {
      const target = t._tape._hover ? 0.25 : 1 + boost;
      t.timeScale(t.timeScale() + (target - t.timeScale()) * 0.1);
    });
  });
}

/* ---------- Animações de scroll ---------- */
function initScroll() {
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('js');

  // rolagem suave
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // showreel: o vídeo cresce até ocupar a tela inteira
  const mm = gsap.matchMedia();
  const showreel = $('.showreel');
  const srVideo = $('.showreel__video');
  if (!reduced) {
    const full = 'inset(0% 0% 0% 0% round 0px)';
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: showreel, start: 'top top', end: '+=160%', pin: true, scrub: 0.8, refreshPriority: 2,
        onUpdate: (s) => showreel.classList.toggle('is-full', s.progress > 0.62)
      }
    });
    tl.to('.showreel__media', { clipPath: full, ease: 'power2.inOut', duration: 1 })
      .fromTo('.showreel__video', { scale: 1.3 }, { scale: 1, ease: 'none', duration: 1 }, 0)
      .to('.showreel__w--l', { xPercent: -70, opacity: 0, ease: 'power2.in', duration: 0.7 }, 0)
      .to('.showreel__w--r', { xPercent: 70, opacity: 0, ease: 'power2.in', duration: 0.7 }, 0)
      .fromTo('.showreel__overlay', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.35 }, 0.7)
      .to({}, { duration: 0.25 });
  }
  lazyVideo(srVideo, showreel);

  // modalidades: scroll horizontal no desktop
  if (!reduced) mm.add('(min-width: 761px)', () => {
    const track = $('.mods__track');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.mods', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, refreshPriority: 1,
        onUpdate: (s) => gsap.set('.mods__progress span', { scaleX: s.progress })
      }
    });
    $$('.mod__img img').forEach((img) => {
      gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: '.mods', start: 'top top', end: () => '+=' + dist(), scrub: true } });
    });
  });
  // celular: modalidades em carrossel deslizável
  mm.add('(max-width: 760px)', () => {
    const rail = $('.mods__cards');
    const cards = $$('.mod', rail);
    const label = $('.js-mod-i');
    const update = () => {
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      cards.forEach((c, i) => c.classList.toggle('is-active', i === best));
      label.textContent = String(best + 1).padStart(2, '0');
    };
    rail.addEventListener('scroll', update, { passive: true });
    update();
    if (!reduced) {
      gsap.from(cards.slice(0, 2), { x: 120, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: rail, start: 'top 85%', once: true } });
    }
    return () => rail.removeEventListener('scroll', update);
  });


  // âncoras
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#topo' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      document.body.classList.remove('menu-open');
      $('.nav__burger').setAttribute('aria-expanded', 'false');
      if (lenis) { lenis.start(); lenis.scrollTo(target, { offset: 0, duration: 1.4 }); }
      else if (target === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // menu mobile
  $('.nav__burger').addEventListener('click', (e) => {
    const open = document.body.classList.toggle('menu-open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
    $('.menu').setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open) gsap.from('.menu nav a', { y: 60, opacity: 0, stagger: 0.06, duration: 0.7, ease: 'power3.out', delay: 0.15 });
  });

  // nav sólida + link ativo
  ScrollTrigger.create({ start: 60, end: 'max', onToggle: (s) => $('#nav').classList.toggle('is-solid', s.isActive) });
  $$('.nav__links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });

  // barra de progresso da página
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => gsap.set('.progress span', { scaleX: s.progress }) });

  if (reduced) { gsap.set('.reveal', { opacity: 1, y: 0 }); return lenis; }

  // títulos de seção: letras sobem uma a uma
  $$('.sec-title').forEach((t) => {
    t.classList.remove('reveal');
    splitChars(t);
    gsap.from($$('.c', t), {
      yPercent: 115, rotate: 6, duration: 1, ease: 'expo.out', stagger: 0.022,
      scrollTrigger: { trigger: t, start: 'top 88%', once: true }
    });
  });

  // reveals
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%', once: true,
    onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.1 })
  });
  gsap.from('.day', {
    y: 70, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'transform,opacity',
    scrollTrigger: { trigger: '.week', start: 'top 85%', once: true }
  });

  // títulos de seção: leve skew de entrada
  $$('.sec-title').forEach((t) => {
    gsap.fromTo(t, { skewX: 8 }, { skewX: 0, ease: 'none', scrollTrigger: { trigger: t, start: 'top 95%', end: 'top 50%', scrub: true } });
  });

  // palavras fantasmas
  $$('.ghost-word').forEach((g) => {
    const right = g.classList.contains('ghost-word--right');
    gsap.fromTo(g, { xPercent: right ? -10 : 10 }, { xPercent: right ? 8 : -18, ease: 'none', scrollTrigger: { trigger: g.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // hero sai de cena
  gsap.to('.hero__copy', { yPercent: -14, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  mm.add('(min-width: 761px)', () => {
    gsap.to('.hero__media', { yPercent: -24, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });
  mm.add('(max-width: 760px)', () => {
    gsap.to('.hero__video', { scale: 1.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });

  // CTA final
  gsap.from('.final__title', { scale: 0.86, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.final', start: 'top 70%', once: true } });

  return lenis;
}

/* ---------- Divide um título em palavras/letras (mantém <br> e spans) ---------- */
function splitChars(el) {
  [...el.childNodes].forEach((node) => {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w';
        [...part].forEach((ch) => {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          w.appendChild(c);
        });
        frag.appendChild(w);
      });
      node.replaceWith(frag);
    } else if (node.nodeType === 1 && node.tagName !== 'BR') {
      splitChars(node);
    }
  });
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
}

/* ---------- Cursor customizado (desktop) ---------- */
function initCursor() {
  if (!finePointer || reduced) return;
  const cur = $('.cursor');
  const label = $('.cursor__label');
  document.documentElement.classList.add('has-cursor');
  const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const tagged = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button, .slot');
    cur.classList.toggle('is-label', !!tagged);
    cur.classList.toggle('is-link', !tagged && !!link);
    if (tagged) label.textContent = tagged.dataset.cursor;
  });
  document.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
  document.addEventListener('pointerenter', () => cur.classList.remove('is-hidden'));
}

/* ---------- Inclinação 3D do vídeo do hero (desktop) ---------- */
function initTilt() {
  if (!finePointer || reduced) return;
  const frame = $('.hero__frame');
  const hero = $('.hero');
  gsap.set(frame, { transformPerspective: 900 });
  hero.addEventListener('pointermove', (e) => {
    if (window.innerWidth <= 760) return;
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    gsap.to(frame, { rotationY: nx * 14, rotationX: -ny * 10, duration: 0.8, ease: 'power3.out' });
  });
  hero.addEventListener('pointerleave', () => gsap.to(frame, { rotationY: 0, rotationX: 0, duration: 1, ease: 'power3.out' }));
}

/* ---------- Botões magnéticos ---------- */
function initMagnetic() {
  if (!finePointer || reduced) return;
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, .4)' }));
  });
}

/* ---------- Intro ---------- */
function intro() {
  document.body.classList.add('is-loading');
  const tl = gsap.timeline({ onComplete: () => document.body.classList.remove('is-loading') });
  tl.from('.loader__logo', { scale: 0.5, rotate: -14, opacity: 0, duration: 0.7, ease: 'back.out(1.8)' })
    .to('.loader__bar span', { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, '-=.2')
    .to('.loader__logo', { scale: 1.08, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 })
    .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut' })
    .set('.loader', { display: 'none' });
  if (reduced) return tl;
  tl.from('.hero__title .line > span', { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: 0.09, onComplete: () => $('.hero__title').classList.add('is-in') }, '-=.35')
    .from('.nav', { y: -30, opacity: 0, duration: 0.7, ease: 'power3.out' }, '<')
    .from('.hero__kicker, .hero__lead, .hero__ctas', { y: 30, opacity: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out' }, '-=.8')
    .from('.hero__frame', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut' }, '-=1.2')
    .from('.hero__vertical', { opacity: 0, duration: 0.6 }, '-=.4')
    .from('.hero__sticker', { scale: 2.2, rotate: -40, opacity: 0, duration: 0.6, ease: 'back.out(1.6)' }, '-=.5')
    .from('.hero__stats > *', { y: 24, opacity: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out' }, '-=.7');
  $$('.hero__stats strong').forEach((s) => {
    const o = { v: 0 };
    tl.to(o, { v: +s.dataset.count, duration: 1.2, ease: 'power2.out', onUpdate: () => { s.textContent = Math.round(o.v); } }, '-=.6');
  });
  return tl;
}

/* ---------- Boot ---------- */
async function boot() {
  if (!gsap || !ScrollTrigger) {
    // sem GSAP: site funciona estático
    $('.loader').remove();
    initDeckFallback();
    loadFeed();
    startHeroVideo();
    return;
  }
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) {}

  initScroll();
  intro();
  initTapes();
  initDeck();
  initMagnetic();
  initCursor();
  initTilt();
  loadFeed();

  // 3D do hero
  const canvas = $('.hero__gl');
  try {
    const { initHero3D } = await import('./hero3d.js');
    const hero = initHero3D(canvas, { reduced });
    if (hero) ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onUpdate: (s) => hero.setScroll(s.progress) });
  } catch (e) { canvas.remove(); }

  if (document.readyState === 'complete') ScrollTrigger.refresh();
  else window.addEventListener('load', () => ScrollTrigger.refresh());
  startHeroVideo();
}

// o vídeo do hero só começa depois que o resto da página carregou
function startHeroVideo() {
  const go = () => setTimeout(() => lazyVideo($('.hero__video'), $('.hero')), 300);
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

function initDeckFallback() {
  const deck = $('.deck');
  deck.style.display = 'flex'; deck.style.gap = '12px'; deck.style.overflowX = 'auto'; deck.style.height = 'auto';
  FT.reels.forEach((r) => {
    const a = document.createElement('a');
    a.href = `https://www.instagram.com/reel/${r.code}/`; a.target = '_blank'; a.rel = 'noopener';
    a.className = 'card'; a.style.cssText = 'position:relative;left:auto;top:auto;margin:0;translate:none;flex:none;';
    a.innerHTML = `<img src="${r.poster}" alt=""><div class="card__bottom"><p class="card__tag">${r.tag}</p></div>`;
    deck.appendChild(a);
  });
}

boot();
