/* =============================================================================
   Veda project page — interactions (framework-free)
   - Manifest-driven before/after video sliders + gallery
   - Pointer/touch/keyboard draggable comparison
   - Lazy media via IntersectionObserver (pause offscreen)
   - Scrollspy nav, mobile menu, smooth anchor scroll, scroll progress
   - BibTeX copy, animated stat counters, reveal-on-scroll
   Reads window.__VEDA_MEDIA__ = { comparisons:[...], gallery:[...] }
   ============================================================================= */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const MEDIA = window.__VEDA_MEDIA__ || { comparisons: [], gallery: [] };

  /* ---------- Lazy media: load + autoplay in view, pause out of view ------- */
  const lazyIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const el = e.target;
      if (e.isIntersecting) {
        if (el.dataset.src && !el.src) el.src = el.dataset.src;
        if (el.tagName === 'VIDEO' && el.dataset.autoplay !== 'off') {
          const p = el.play(); if (p && p.catch) p.catch(() => {});
        }
      } else if (el.tagName === 'VIDEO') {
        el.pause();
      }
    });
  }, { rootMargin: '200px 0px', threshold: 0.1 });

  function observeLazy(el) { lazyIO.observe(el); }

  /* ---------- Build a before/after comparison slider ----------------------- */
  function buildComparison(item, idx) {
    const fig = document.createElement('figure');
    fig.className = 'cmp reveal';
    fig.setAttribute('role', 'group');
    fig.setAttribute('aria-label', 'Before and after comparison: Full Attention versus Veda');

    const stage = document.createElement('div');
    stage.className = 'cmp__stage';
    stage.style.setProperty('--pos', '50%');

    // base layer = Veda (after, right)
    const vVeda = document.createElement('video');
    vVeda.className = 'cmp__v cmp__veda';
    vVeda.muted = true; vVeda.loop = true; vVeda.playsInline = true;
    vVeda.preload = 'none'; vVeda.poster = item.poster || '';
    vVeda.dataset.src = item.veda;

    // overlay layer = Full Attention (before, left), clipped
    const vFull = document.createElement('video');
    vFull.className = 'cmp__v cmp__full';
    vFull.muted = true; vFull.loop = true; vFull.playsInline = true;
    vFull.preload = 'none'; vFull.poster = item.poster || '';
    vFull.dataset.src = item.full;
    vFull.dataset.autoplay = 'off'; // we sync it manually

    const clip = document.createElement('div');
    clip.className = 'cmp__clip';
    clip.appendChild(vFull);

    const labL = document.createElement('span');
    labL.className = 'cmp__tag cmp__tag--l'; labL.textContent = 'Full Attention · FA3';
    const labR = document.createElement('span');
    labR.className = 'cmp__tag cmp__tag--r'; labR.textContent = 'Veda · 95% sparse';

    const handle = document.createElement('button');
    handle.className = 'cmp__handle';
    handle.type = 'button';
    handle.setAttribute('aria-label', 'Drag to compare. Use left and right arrow keys to adjust.');
    handle.setAttribute('aria-valuemin', '0');
    handle.setAttribute('aria-valuemax', '100');
    handle.setAttribute('aria-valuenow', '50');
    handle.setAttribute('role', 'slider');
    handle.innerHTML = '<span class="cmp__grip"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6 4 12l5 6M15 6l5 6-5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

    stage.append(vVeda, clip, labL, labR, handle);
    fig.appendChild(stage);

    if (item.title || item.subtitle) {
      const cap = document.createElement('figcaption');
      cap.className = 'cmp__cap';
      cap.innerHTML = (item.title ? `<strong>${escapeHtml(item.title)}</strong>` : '') +
                      (item.subtitle ? ` <span>${escapeHtml(item.subtitle)}</span>` : '');
      fig.appendChild(cap);
    }

    // --- position logic ---
    let pos = 50;
    const setPos = (p) => {
      pos = Math.max(0, Math.min(100, p));
      stage.style.setProperty('--pos', pos + '%');
      handle.setAttribute('aria-valuenow', Math.round(pos));
    };
    const fromEvent = (clientX) => {
      const r = stage.getBoundingClientRect();
      setPos(((clientX - r.left) / r.width) * 100);
    };
    let dragging = false;
    const onMove = (ev) => {
      if (!dragging) return;
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      fromEvent(x); ev.preventDefault();
    };
    const stop = () => { dragging = false; document.body.classList.remove('cmp-dragging'); };
    const start = (ev) => {
      dragging = true; document.body.classList.add('cmp-dragging');
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      fromEvent(x); handle.focus();
    };
    stage.addEventListener('mousedown', start);
    stage.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { setPos(pos - 2); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setPos(pos + 2); e.preventDefault(); }
      else if (e.key === 'Home') { setPos(0); e.preventDefault(); }
      else if (e.key === 'End') { setPos(100); e.preventDefault(); }
    });

    // --- sync playback of the two layers ---
    let loaded = false;
    const ensureLoad = () => {
      if (loaded) return; loaded = true;
      vVeda.src = vVeda.dataset.src; vFull.src = vFull.dataset.src;
    };
    const syncIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          ensureLoad();
          const pv = vVeda.play(); if (pv && pv.catch) pv.catch(() => {});
          const pf = vFull.play(); if (pf && pf.catch) pf.catch(() => {});
        } else { vVeda.pause(); vFull.pause(); }
      });
    }, { threshold: 0.15 });
    syncIO.observe(stage);
    // keep the two videos roughly aligned
    vVeda.addEventListener('timeupdate', () => {
      if (Math.abs(vFull.currentTime - vVeda.currentTime) > 0.12) {
        try { vFull.currentTime = vVeda.currentTime; } catch (e) {}
      }
    });

    setPos(50);
    // subtle intro hint animation
    requestAnimationFrame(() => { fig.classList.add('cmp--ready'); });
    return fig;
  }

  /* ---------- Build gallery tile (animated webp, lazy) --------------------- */
  function buildGalleryTile(item) {
    const fig = document.createElement('figure');
    fig.className = 'gtile reveal';
    const media = document.createElement('img'); // animated webp
    media.className = 'gtile__media';
    media.loading = 'lazy';
    media.decoding = 'async';
    media.alt = item.caption || 'Video generated by Veda';
    media.dataset.src = item.webp;
    if (item.poster) media.src = item.poster; // static poster until webp lazy-loads
    media.addEventListener('error', () => {
      if (item.mp4 && media.tagName === 'IMG') {
        const v = document.createElement('video');
        v.className = 'gtile__media'; v.muted = true; v.loop = true; v.playsInline = true;
        v.autoplay = true; v.src = item.mp4; media.replaceWith(v);
      }
    });
    fig.appendChild(media);
    const badge = document.createElement('span');
    badge.className = 'gtile__badge';
    badge.textContent = 'Veda';
    fig.appendChild(badge);
    if (item.caption) {
      const cap = document.createElement('figcaption');
      cap.className = 'gtile__cap'; cap.textContent = item.caption;
      fig.appendChild(cap);
    }
    // lazy swap poster->animated webp on intersect
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (e.isIntersecting && media.dataset.src) {
          media.src = media.dataset.src; io.disconnect();
        }
      });
    }, { rootMargin: '300px 0px' });
    io.observe(media);
    return fig;
  }

  /* ---------- Mount everything -------------------------------------------- */
  function mount() {
    const cv = $('#cmp-viewer');
    if (cv && MEDIA.comparisons.length) buildComparisonViewer(cv, MEDIA.comparisons);
    const mq = $('#sample-marquee');
    if (mq && MEDIA.gallery.length) buildMarquee(mq, MEDIA.gallery);
    setupReveal();
  }

  /* ---------- comparison viewer: one slider + thumbnail selector --------- */
  function buildComparisonViewer(host, items) {
    const stage = document.createElement('div');
    stage.className = 'cmp__stage cviewer__stage'; stage.style.setProperty('--pos', '50%');
    const mkV = (cls) => { const v = document.createElement('video'); v.className = 'cmp__v ' + cls; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'metadata'; return v; };
    const vVeda = mkV('cmp__veda');
    const clip = document.createElement('div'); clip.className = 'cmp__clip';
    const vFull = mkV('cmp__full'); clip.appendChild(vFull);
    const labL = document.createElement('span'); labL.className = 'cmp__tag cmp__tag--l'; labL.textContent = 'Full Attention';
    const labR = document.createElement('span'); labR.className = 'cmp__tag cmp__tag--r'; labR.textContent = 'Veda · sparse';
    const handle = document.createElement('button'); handle.className = 'cmp__handle'; handle.type = 'button';
    handle.setAttribute('role', 'slider'); handle.setAttribute('aria-label', 'Drag to compare');
    handle.setAttribute('aria-valuemin', '0'); handle.setAttribute('aria-valuemax', '100'); handle.setAttribute('aria-valuenow', '50');
    handle.innerHTML = '<span class="cmp__grip"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6 4 12l5 6M15 6l5 6-5 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    const badge = document.createElement('span'); badge.className = 'cmp__model';
    stage.append(vVeda, clip, labL, labR, handle, badge);
    const cap = document.createElement('div'); cap.className = 'cviewer__cap';
    const strip = document.createElement('div'); strip.className = 'cviewer__strip';
    host.append(stage, cap, strip);

    let pos = 50;
    const setPos = (p) => { pos = Math.max(0, Math.min(100, p)); stage.style.setProperty('--pos', pos + '%'); handle.setAttribute('aria-valuenow', Math.round(pos)); };
    const fromX = (x) => { const r = stage.getBoundingClientRect(); setPos(((x - r.left) / r.width) * 100); };
    let drag = false;
    const start = (e) => { drag = true; document.body.classList.add('cmp-dragging'); fromX(e.touches ? e.touches[0].clientX : e.clientX); handle.focus(); };
    const move = (e) => { if (!drag) return; fromX(e.touches ? e.touches[0].clientX : e.clientX); e.preventDefault(); };
    const stop = () => { drag = false; document.body.classList.remove('cmp-dragging'); };
    stage.addEventListener('mousedown', start); stage.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('mousemove', move, { passive: false }); window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', stop); window.addEventListener('touchend', stop);
    handle.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { setPos(pos - 2); e.preventDefault(); } else if (e.key === 'ArrowRight') { setPos(pos + 2); e.preventDefault(); } });
    vVeda.addEventListener('timeupdate', () => { if (Math.abs(vFull.currentTime - vVeda.currentTime) > 0.12) { try { vFull.currentTime = vVeda.currentTime; } catch (e) {} } });

    function load(it) {
      vVeda.poster = it.poster || ''; vFull.poster = it.poster || '';
      vVeda.src = it.veda; vFull.src = it.full;
      [vVeda, vFull].forEach((v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); });
      const is12 = /12B/.test(it.subtitle || '');
      badge.textContent = is12 ? 'Waver-T2V-12B · 720P · 95% sparse' : 'Waver-T2V-1B · 480P · 90% sparse';
      badge.className = 'cmp__model ' + (is12 ? 'cmp__model--12b' : 'cmp__model--1b');
      cap.dataset.prompt = it.title || '';
      cap.innerHTML = it.title ? `<span class="cviewer__prompt">${escapeHtml(it.title)}</span>` : '';
      setPos(50);
    }
    const isHD = (it) => /12B/.test(it.subtitle || '');
    const ordered = [...items.filter(isHD), ...items.filter((it) => !isHD(it))]; // 720P (12B) first
    const defaultIdx = (ordered.length > 1 && isHD(ordered[1])) ? 1 : 0;          // default = 2nd 720P
    ordered.forEach((it, idx) => {
      const is12 = isHD(it);
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'cviewer__thumb ' + (is12 ? 'cviewer__thumb--12b' : 'cviewer__thumb--1b') + (idx === defaultIdx ? ' is-active' : '');
      if (it.title) b.dataset.prompt = it.title;
      b.innerHTML = `<img src="${it.poster}" alt="" loading="lazy"><span class="cviewer__thumbtag">${is12 ? '12B · 720P' : '1B · 480P'}</span>`;
      b.addEventListener('click', () => { $$('.cviewer__thumb', strip).forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); load(it); });
      strip.appendChild(b);
    });
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { [vVeda, vFull].forEach((v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); }); }
      else { vVeda.pause(); vFull.pause(); }
    }), { threshold: 0.2 });
    io.observe(stage);
    load(ordered[defaultIdx]);
  }

  /* ---------- sample marquee (auto desktop / swipe mobile) + lightbox ---- */
  function buildMarquee(host, items) {
    const reduceM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = matchMedia('(max-width:760px)').matches;
    const auto = !isMobile && !reduceM;
    const rowCount = isMobile ? 2 : 3;
    const makeItem = (it) => {
      const b = document.createElement('button'); b.className = 'marquee__item'; b.type = 'button';
      if (it.caption) b.dataset.prompt = it.caption;
      const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      v.poster = it.poster || ''; v.dataset.src = it.tile;
      const z = document.createElement('span'); z.className = 'marquee__zoom';
      z.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>';
      b.append(v, z);
      if (it.model) { const t = document.createElement('span'); t.className = 'marquee__tag ' + (/12B/.test(it.model) ? 'marquee__tag--12b' : 'marquee__tag--1b'); t.textContent = it.model; b.appendChild(t); }
      b.addEventListener('click', () => openVideoLightbox(it.mp4, it.caption));
      return b;
    };
    // distribute 1B samples round-robin; sprinkle the (rarer) 12B ones at
    // staggered offsets across rows so at least one 12B is on-screen at all times
    const isHD = (it) => /12B/.test(it.model || '');
    const hd = items.filter(isHD), sd = items.filter((it) => !isHD(it));
    const rows = Array.from({ length: rowCount }, () => []);
    sd.forEach((it, i) => rows[i % rowCount].push(it));
    hd.forEach((it, i) => {
      const r = i % rowCount, row = rows[r];
      const off = Math.max(0, Math.min(row.length, Math.round(row.length * ((r + 0.5) / rowCount))));
      row.splice(off, 0, it);
    });
    rows.forEach((rowItems, r) => {
      const row = document.createElement('div'); row.className = 'marquee__row' + (auto ? ' marquee__row--auto' : ' marquee__row--scroll');
      const track = document.createElement('div'); track.className = 'marquee__track';
      rowItems.forEach((it) => track.appendChild(makeItem(it)));
      if (auto) {
        rowItems.forEach((it) => track.appendChild(makeItem(it))); // duplicate for seamless loop
        const dur = Math.max(34, rowItems.length * 6.4) * (1 + r * 0.24); // staggered speed per row
        track.style.animationName = 'marquee';
        track.style.animationTimingFunction = 'linear';
        track.style.animationIterationCount = 'infinite';
        track.style.animationDuration = dur.toFixed(0) + 's';
        track.style.animationDirection = (r % 2 === 1) ? 'reverse' : 'normal';
      }
      row.appendChild(track);
      host.appendChild(row);
    });
    const vids = Array.from(host.querySelectorAll('.marquee__item video'));
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else v.pause();
    }), { rootMargin: '120px', threshold: 0.1 });
    vids.forEach((v) => io.observe(v));
  }

  /* ---------- floating prompt tooltip (full text on hover) --------------- */
  function setupPromptTip() {
    let tip = null;
    const ensure = () => { if (!tip) { tip = document.createElement('div'); tip.className = 'prompt-tip'; document.body.appendChild(tip); } return tip; };
    const show = (el, x, y) => {
      const t = ensure(); t.textContent = el.dataset.prompt; t.classList.add('is-on');
      const w = t.offsetWidth, h = t.offsetHeight;
      let left = x - w / 2; left = Math.max(10, Math.min(window.innerWidth - w - 10, left));
      let top = y - h - 16; if (top < 10) top = y + 22;
      t.style.left = left + 'px'; t.style.top = top + 'px';
    };
    const hide = () => { if (tip) tip.classList.remove('is-on'); };
    document.addEventListener('mouseover', (e) => { const el = e.target.closest && e.target.closest('[data-prompt]'); if (el && el.dataset.prompt) show(el, e.clientX, e.clientY); });
    document.addEventListener('mousemove', (e) => { const el = e.target.closest && e.target.closest('[data-prompt]'); if (el && el.dataset.prompt && tip && tip.classList.contains('is-on')) show(el, e.clientX, e.clientY); });
    document.addEventListener('mouseout', (e) => { const el = e.target.closest && e.target.closest('[data-prompt]'); if (el) hide(); });
  }

  function openVideoLightbox(src, caption) {
    let box = $('.vlightbox');
    if (!box) {
      box = document.createElement('div'); box.className = 'vlightbox'; box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '<button class="vlightbox__close" aria-label="Close">×</button><div class="vlightbox__inner"><video class="vlightbox__video" controls autoplay loop playsinline></video><div class="vlightbox__cap"></div></div>';
      document.body.appendChild(box);
      const close = () => { const v = $('.vlightbox__video', box); v.pause(); v.removeAttribute('src'); v.load(); box.classList.remove('is-open'); box.setAttribute('aria-hidden', 'true'); };
      box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('vlightbox__close')) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('is-open')) close(); });
    }
    const v = $('.vlightbox__video', box); v.src = src; const p = v.play(); if (p && p.catch) p.catch(() => {});
    $('.vlightbox__cap', box).textContent = caption || '';
    box.classList.add('is-open'); box.setAttribute('aria-hidden', 'false');
  }

  /* ---------- Reveal on scroll -------------------------------------------- */
  function setupReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((e) => e.classList.add('is-visible')); return;
    }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Animated stat counters -------------------------------------- */
  function setupCounters() {
    const nums = $$('[data-count]');
    if (!nums.length) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target; io.unobserve(el);
        const target = parseFloat(el.dataset.count);
        const dec = (el.dataset.dec | 0);
        const suffix = el.dataset.suffix || '';
        const prefix = el.dataset.prefix || '';
        const dur = 1100; const t0 = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const v = (target * ease(p)).toFixed(dec);
          el.textContent = prefix + v + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    nums.forEach((n) => io.observe(n));
  }

  /* ---------- Scrollspy + smooth scroll + progress + mobile nav ----------- */
  function setupNav() {
    const links = $$('[data-nav]');
    const sections = links.map((l) => $(l.getAttribute('href'))).filter(Boolean);
    const header = $('.nav');
    const progress = $('.scroll-progress__bar');

    const onScroll = () => {
      const y = window.scrollY;
      if (header) header.classList.toggle('nav--scrolled', y > 24);
      if (progress) {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      }
      // active section
      let active = sections[0];
      for (const s of sections) { if (s.getBoundingClientRect().top - 120 <= 0) active = s; }
      links.forEach((l) => l.classList.toggle('is-active', active && l.getAttribute('href') === '#' + active.id));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    links.forEach((l) => l.addEventListener('click', (e) => {
      const id = l.getAttribute('href');
      const tgt = id && id.startsWith('#') && $(id);
      if (tgt) {
        e.preventDefault();
        const top = tgt.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: 'smooth' });
        document.body.classList.remove('nav-open');
      }
    }));

    const burger = $('.nav__burger');
    if (burger) burger.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  }

  /* ---------- BibTeX copy -------------------------------------------------- */
  function setupBibtex() {
    $$('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sel = btn.getAttribute('data-copy');
        const node = $(sel);
        const text = node ? node.innerText : '';
        try {
          await navigator.clipboard.writeText(text);
        } catch (e) {
          const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
        }
        const old = btn.textContent; btn.textContent = 'Copied ✓'; btn.classList.add('is-copied');
        setTimeout(() => { btn.textContent = old; btn.classList.remove('is-copied'); }, 1600);
      });
    });
  }

  /* ---------- Lightbox for figures (click to zoom) ------------------------ */
  function setupLightbox() {
    const zoomables = $$('[data-zoom]');
    if (!zoomables.length) return;
    const box = document.createElement('div');
    box.className = 'lightbox'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<button class="lightbox__close" aria-label="Close">×</button><img class="lightbox__img" alt="">';
    document.body.appendChild(box);
    const img = $('.lightbox__img', box);
    const close = () => { box.classList.remove('is-open'); box.setAttribute('aria-hidden', 'true'); };
    zoomables.forEach((z) => z.addEventListener('click', () => {
      const src = z.getAttribute('src') || z.dataset.src;
      img.src = src; img.alt = z.alt || '';
      box.classList.add('is-open'); box.setAttribute('aria-hidden', 'false');
    }));
    box.addEventListener('click', (e) => { if (e.target !== img) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ---------- animated 5.1x diffusion "denoise" race ---------------------- */
  function setupSpeedRace() {
    const race = $('#speedRace');
    if (!race) return;
    const rows = $$('.race__row', race).map((r) => ({
      dur: parseFloat(r.dataset.dur) || 3,
      target: parseFloat(r.dataset.target) || 0,
      stage: $('.race__stage', r), img: $('.race__img', r), noise: $('.race__noise', r),
      bar: $('.race__bar', r), timeVal: $('.race__time .v', r),
      video: $('.race__video', r), dataVideo: r.dataset.video || '', playing: false,
    }));
    if (!rows.length) return;
    rows.forEach((r) => { if (r.video) r.video.loop = false; });   // play once, freeze on last frame
    const maxDur = Math.max(...rows.map((r) => r.dur));
    const HOLD = 11;   // let each finished clip play through fully before re-looping
    let raf = null, start = null, running = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function render(t) {
      rows.forEach((r) => {
        const p = Math.min(1, t / r.dur);
        r.bar.style.width = (p * 100) + '%';
        if (r.img) r.img.style.filter =
          `blur(${((1 - p) * 16).toFixed(2)}px) saturate(${(0.35 + 0.65 * p).toFixed(2)}) contrast(${(0.82 + 0.3 * p).toFixed(2)})`;
        if (r.noise) r.noise.style.opacity = Math.max(0, 1 - p * 1.18).toFixed(3);
        if (r.timeVal) r.timeVal.textContent = (r.target * p).toFixed(1);
        if (p >= 1 && !r.playing) {           // generation done → start the real video
          r.playing = true;
          r.stage && r.stage.classList.add('is-done', 'is-playing');
          if (r.video) {
            if (!r.video.getAttribute('src') && r.dataVideo) r.video.setAttribute('src', r.dataVideo);
            const pr = r.video.play(); if (pr && pr.catch) pr.catch(() => {});
          }
        } else if (p < 1 && r.playing) {       // loop restarted → back to denoise
          r.playing = false;
          r.stage && r.stage.classList.remove('is-done', 'is-playing');
          if (r.video) { r.video.pause(); try { r.video.currentTime = 0; } catch (e) {} }
        }
      });
    }
    function tick(now) {
      if (!running) return;
      if (start == null) start = now;
      const t = (now - start) / 1000;
      if (t > maxDur + HOLD) { render(maxDur + HOLD); running = false; return; }  // play through once, then stop
      render(t);
      raf = requestAnimationFrame(tick);
    }
    function play() { if (running) return; running = true; start = null; raf = requestAnimationFrame(tick); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); rows.forEach((r) => { if (r.video) r.video.pause(); }); }
    function replay() { start = null; if (!running) play(); }

    if (reduce) { render(maxDur); }      // show finished state, no animation
    else {
      const io = new IntersectionObserver((ents) => {
        ents.forEach((e) => { if (e.isIntersecting) play(); else stop(); });
      }, { threshold: 0.25 });
      io.observe(race);
    }
    const btn = $('.race__replay', race);
    if (btn) btn.addEventListener('click', () => { if (reduce) { render(maxDur); } else replay(); });
  }

  /* ---------- architecture diagram hover-highlight (by box kind) ---------- */
  function setupArchHover() {
    const arch = $('#archDiagram');
    if (!arch) return;
    const kinds = ['peach', 'blue', 'greenbox', 'gray', 'whitebox'];
    const nodes = $$('.node', arch);
    const kindOf = (n) => { const r = $('.box', n); return r ? kinds.find((k) => r.classList.contains(k)) : null; };
    const clear = () => { arch.classList.remove('is-focus'); nodes.forEach((n) => n.classList.remove('is-highlighted')); };
    nodes.forEach((node) => {
      const kind = kindOf(node);
      if (!kind) return;
      node.addEventListener('mouseenter', () => {
        arch.classList.add('is-focus');
        nodes.forEach((n) => { if (kindOf(n) === kind) n.classList.add('is-highlighted'); });
      });
      node.addEventListener('mouseleave', clear);
    });
  }

  /* ---------- lazy autoplay for plain video grids (e.g. 4-way compare) ---- */
  function setupLazyVideos() {
    const vids = $$('.quad video[data-src]');
    if (!vids.length) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { if (!v.src && v.dataset.src) v.src = v.dataset.src; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else v.pause();
    }), { rootMargin: '150px 0px', threshold: 0.2 });
    vids.forEach((v) => io.observe(v));
  }

  /* ---------- component card → highlight matching blocks in the SVG ------- */
  function setupComponentArch() {
    const arch = $('#archDiagram');
    if (!arch) return;
    $$('.component[data-arch]').forEach((card) => {
      const ids = (card.dataset.arch || '').split(/\s+/).filter(Boolean);
      const targets = ids.map((id) => { const el = arch.querySelector('#' + id); return el ? (el.closest('.node') || el) : null; }).filter(Boolean);
      if (!targets.length) return;
      card.classList.add('component--linked');
      const on = () => { arch.classList.add('is-focus'); targets.forEach((t) => t.classList.add('is-highlighted')); };
      const off = () => { arch.classList.remove('is-focus'); targets.forEach((t) => t.classList.remove('is-highlighted')); };
      card.addEventListener('mouseenter', on);
      card.addEventListener('mouseleave', off);
      card.addEventListener('focusin', on);
      card.addEventListener('focusout', off);
    });
  }

  /* ---------- click any analysis video tile to enlarge ------------------- */
  function setupQuadZoom() {
    $$('.quad__item').forEach((item) => {
      const v = $('video', item); if (!v) return;
      item.style.cursor = 'zoom-in';
      const z = document.createElement('span'); z.className = 'quad__zoom';
      z.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>';
      item.appendChild(z);
      item.addEventListener('click', () => { const src = v.dataset.src || v.src; const tag = $('.quad__tag', item); openVideoLightbox(src, tag ? tag.textContent : ''); });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function init() {
    mount();
    setupNav();
    setupCounters();
    setupBibtex();
    setupLightbox();
    setupSpeedRace();
    setupArchHover();
    setupComponentArch();
    setupLazyVideos();
    setupPromptTip();
    setupQuadZoom();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
