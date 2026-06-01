/* =============================================================================
   Veda — interactive SVG charts (framework-free), redrawn from paper data.
   Renders into [data-chart] containers. Theme-aware via CSS variables.
   Charts: scaling (line), speedup (stacked bars), humaneval (diverging bars),
           radar (head-aware tiling ablation).
   ============================================================================= */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cssVar = (n, f) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f);

  function COL() {
    return {
      ink: cssVar('--ink', '#14171d'),
      soft: cssVar('--ink-soft', '#4b515d'),
      mute: cssVar('--ink-mute', '#838a98'),
      line: cssVar('--line-2', 'rgba(16,21,38,.16)'),
      grid: cssVar('--line', 'rgba(16,21,38,.10)'),
      panel: cssVar('--panel', '#fff'),
      accent: cssVar('--accent', '#0bb0c4'),
      accent2: cssVar('--accent-2', '#10a08f'),
      accent3: cssVar('--accent-3', '#6b5cff'),
      // categorical
      veda: cssVar('--accent', '#0bb0c4'),
      full: '#e08a4a',     // amber — full attention / baseline-ish
      mlp: '#8aa3cf',      // slate-blue — MLP
      prep: '#7cc58a',     // green — prepare mask
      tie: cssVar('--bg-3', '#e9edf3'),
      base: '#94a0c2',     // muted indigo — baseline better
    };
  }
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : '' + n);

  function tip(wrap) {
    let t = $('.chart__tip', wrap);
    if (!t) { t = document.createElement('div'); t.className = 'chart__tip'; wrap.appendChild(t); }
    return t;
  }
  function showTip(wrap, html, x, y) {
    const t = tip(wrap); t.innerHTML = html; t.style.opacity = '1';
    const r = wrap.getBoundingClientRect();
    t.style.left = Math.max(8, Math.min(r.width - t.offsetWidth - 8, x - t.offsetWidth / 2)) + 'px';
    t.style.top = (y - t.offsetHeight - 12) + 'px';
  }
  function hideTip(wrap) { const t = $('.chart__tip', wrap); if (t) t.style.opacity = '0'; }

  function onVisible(node, cb) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { cb(); io.disconnect(); } }), { threshold: 0.25 });
    io.observe(node);
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- SCALING */
  const SCALING = [
    { label: '480P · 121F', seq: 50220, fa3: 65.6, veda: 25.5 },
    { label: '720P · 121F', seq: 122880, fa3: 315.3, veda: 78.3 },
    { label: '720P · 241F', seq: 245760, fa3: 1576.5, veda: 309.1 },
  ];
  function renderScaling(wrap) {
    const c = COL();
    const W = 720, H = 440, m = { l: 64, r: 24, t: 28, b: 58 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: 'img', 'aria-label': 'Per-layer latency vs sequence length: full attention scales quadratically, Veda near-linearly.' }, wrap);
    const xs = SCALING.map((d) => d.seq);
    const xmin = xs[0] * 0.86, xmax = xs[xs.length - 1] * 1.04;
    const ymax = 1700;
    const X = (v) => m.l + (v - xmin) / (xmax - xmin) * iw;
    const Y = (v) => m.t + ih - (v / ymax) * ih;
    // grid + y ticks
    [0, 400, 800, 1200, 1600].forEach((v) => {
      el('line', { x1: m.l, y1: Y(v), x2: m.l + iw, y2: Y(v), stroke: c.grid, 'stroke-width': 1 }, svg);
      el('text', { x: m.l - 10, y: Y(v) + 4, 'text-anchor': 'end', class: 'chart__tk' }, svg).textContent = v;
    });
    el('text', { x: 16, y: m.t + ih / 2, transform: `rotate(-90 16 ${m.t + ih / 2})`, 'text-anchor': 'middle', class: 'chart__ax' }, svg).textContent = 'Per-layer latency (ms)';
    el('text', { x: m.l + iw / 2, y: H - 12, 'text-anchor': 'middle', class: 'chart__ax' }, svg).textContent = 'Sequence length (tokens)';
    SCALING.forEach((d) => el('text', { x: X(d.seq), y: m.t + ih + 20, 'text-anchor': 'middle', class: 'chart__tk' }, svg).textContent = fmtK(d.seq));
    // quadratic reference (faint) for FA3
    const qd = [];
    for (let i = 0; i <= 40; i++) { const n = xs[0] + (xs[2] - xs[0]) * i / 40; qd.push([X(n), Y(SCALING[0].fa3 * Math.pow(n / xs[0], 2))]); }
    el('path', { d: 'M' + qd.map((p) => p.join(' ')).join(' L'), fill: 'none', stroke: c.full, 'stroke-width': 1.4, 'stroke-dasharray': '2 5', opacity: .5 }, svg);
    el('text', { x: X(xs[2]) - 6, y: Y(1500), 'text-anchor': 'end', class: 'chart__tk', fill: c.full, opacity: .8 }, svg).textContent = 'O(n²) reference';
    // lines
    const mk = (key, color, dash) => {
      const pts = SCALING.map((d) => [X(d.seq), Y(d[key])]);
      const path = el('path', { d: 'M' + pts.map((p) => p.join(' ')).join(' L'), fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      if (!reduce) { const L = path.getTotalLength(); path.style.strokeDasharray = L; path.style.strokeDashoffset = L; path.style.transition = 'stroke-dashoffset 1.1s ease'; onVisible(wrap, () => { path.style.strokeDashoffset = '0'; }); }
      return pts;
    };
    mk('fa3', c.full); mk('veda', c.veda);
    // markers + interactions
    SCALING.forEach((d) => {
      [['fa3', c.full, 'Full Attention'], ['veda', c.veda, 'Veda (95% sparse)']].forEach(([k, color, name]) => {
        const cx = X(d.seq), cy = Y(d[k]);
        const dot = el('circle', { cx, cy, r: 5.5, fill: '#fff', stroke: color, 'stroke-width': 3, class: 'chart__dot' }, svg);
        const hit = el('circle', { cx, cy, r: 16, fill: 'transparent', style: 'cursor:pointer' }, svg);
        const sp = (d.fa3 / d.veda).toFixed(2);
        hit.addEventListener('mouseenter', () => { dot.setAttribute('r', 7.5); showTip(wrap, `<b>${name}</b><span>${d.label} · ${fmtK(d.seq)} tok</span><span>${d[k].toFixed(1)} ms<em>· ${sp}× faster</em></span>`, cx, cy); });
        hit.addEventListener('mouseleave', () => { dot.setAttribute('r', 5.5); hideTip(wrap); });
      });
      // speedup chip at veda point
      el('text', { x: X(d.seq), y: Y(d.veda) + 26, 'text-anchor': 'middle', class: 'chart__chip', fill: c.accent2 }, svg).textContent = (d.fa3 / d.veda).toFixed(1) + '×';
    });
    legend(wrap, [['Full Attention (FA3)', c.full], ['Veda — Ours (95%)', c.veda]]);
  }

  /* --------------------------------------------------------------- SPEEDUP */
  const SPEEDUP = {
    'Waver-T2V': [
      { res: '720P', info: '12B · 121F', full: { mlp: 41.2, attn: 274.1 }, veda: { mlp: 39.47, prep: 1.92, kern: 36.91 } },
      { res: '480P', info: '1B · 121F', full: { mlp: 17.0, attn: 48.6 }, veda: { mlp: 11.43, prep: 5.5, kern: 8.57 } },
    ],
    'Wan2.1-T2V': [
      { res: '720P', info: '14B · 81F', full: { mlp: 178.7, attn: 405.0 }, veda: { mlp: 163.57, prep: 20.4, kern: 36.75 } },
      { res: '480P', info: '1.3B · 81F', full: { mlp: 14.58, attn: 22.62 }, veda: { mlp: 13.94, prep: 3.23, kern: 3.93 } },
    ],
  };
  function renderSpeedup(wrap) {
    const c = COL();
    const single = wrap.dataset.model;
    const data = single ? SPEEDUP[single].map((d) => ({ ...d, mk: single }))
      : Object.entries(SPEEDUP).flatMap(([mk, arr]) => arr.map((d) => ({ ...d, mk })));
    const W = 472, rowH = 80, padT = 14, padB = 10, L = 46, BW = 240, bh = 17;
    const H = padT + padB + rowH * data.length;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: 'img', 'aria-label': 'Per-layer latency speedup vs FlashAttention-3' }, wrap);
    const rects = [], fades = [];
    data.forEach((d, gi) => {
      const fullTot = d.full.mlp + d.full.attn;
      const vedaTot = d.veda.mlp + d.veda.prep + d.veda.kern;
      const sp = fullTot / vedaTot;
      const y = padT + gi * rowH;
      el('text', { x: 2, y: y + 11, class: 'chart__grp' }, svg).textContent = d.mk + ' · ' + d.res + ' · ' + d.info;
      el('text', { x: L - 7, y: y + 31, 'text-anchor': 'end', class: 'chart__tk' }, svg).textContent = 'Full';
      el('text', { x: L - 7, y: y + 56, 'text-anchor': 'end', class: 'chart__tk' }, svg).textContent = 'Veda';
      const drawSeg = (x0, y0, totW, segs) => {
        let acc = 0;
        segs.forEach((s) => {
          const w = s.v / s.tot * totW;
          const r = el('rect', { x: x0 + acc, y: y0, width: 0, height: bh, fill: s.c, rx: 3, style: 'cursor:pointer' }, svg);
          r._w = w; const cx = x0 + acc + w / 2, cy = y0;
          r.addEventListener('mouseenter', () => { r.style.filter = 'brightness(1.08)'; showTip(wrap, `<b>${s.n}</b><span>${s.v.toFixed(1)} ms</span>`, cx, cy); });
          r.addEventListener('mouseleave', () => { r.style.filter = ''; hideTip(wrap); });
          rects.push(r); acc += w;
        });
      };
      drawSeg(L, y + 18, BW, [{ v: d.full.mlp, tot: fullTot, c: c.mlp, n: 'MLP' }, { v: d.full.attn, tot: fullTot, c: c.full, n: 'Full Attn Kernel' }]);
      const vW = BW * (vedaTot / fullTot);
      drawSeg(L, y + 43, vW, [{ v: d.veda.mlp, tot: vedaTot, c: c.mlp, n: 'MLP' }, { v: d.veda.prep, tot: vedaTot, c: c.prep, n: 'Prepare Mask' }, { v: d.veda.kern, tot: vedaTot, c: c.veda, n: 'Sparse Kernel' }]);
      el('text', { x: L + BW + 5, y: y + 31, class: 'chart__msval' }, svg).textContent = fullTot.toFixed(0) + ' ms';
      const vms = el('text', { x: L + vW + 5, y: y + 56, class: 'chart__msval', fill: c.accent2, opacity: 0 }, svg); vms.textContent = vedaTot.toFixed(0) + ' ms'; fades.push(vms);
      // refined animated speedup badge (far right)
      const bx = W - 36, by = y + 33;
      const br = el('rect', { x: bx - 32, y: by - 14, width: 64, height: 28, rx: 9, fill: 'none', stroke: c.accent2, 'stroke-width': 1.5, opacity: 0 }, svg); fades.push(br);
      const bt = el('text', { x: bx, y: by + 5, 'text-anchor': 'middle', class: 'spd__badge2', fill: c.accent2, opacity: 0 }, svg); bt.textContent = sp.toFixed(2) + '×'; fades.push(bt);
    });
    if (reduce) { rects.forEach((r) => r.setAttribute('width', r._w)); fades.forEach((e) => e.setAttribute('opacity', '1')); }
    else onVisible(wrap, () => {
      rects.forEach((r, i) => { r.style.transition = `width .85s ${0.04 * i}s cubic-bezier(.2,.7,.2,1)`; r.setAttribute('width', r._w); });
      fades.forEach((e) => { e.style.transition = 'opacity .5s .6s'; e.setAttribute('opacity', '1'); });
    });
    legend(wrap, [['MLP', c.mlp], ['Prepare Mask', c.prep], ['Sparse Kernel', c.veda], ['Full Attn Kernel', c.full]]);
  }

  /* ------------------------------------------------------------- ABLATION */
  function renderAblation(wrap) {
    const c = COL();
    const axes = RADAR.axes, series = RADAR.series; series[2].c = c.accent2;
    const W = 560, rowH = 70, padT = 14, padB = 38, m = { l: 88, r: 56 };
    const H = padT + padB + rowH * axes.length, iw = W - m.l - m.r, lo = -11, hi = 11;
    const X = (v) => m.l + (v - lo) / (hi - lo) * iw;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: 'img', 'aria-label': 'Net win-rate of each tiling vs best static [4,4,8]' }, wrap);
    [-10, -5, 0, 5, 10].forEach((v) => {
      el('line', { x1: X(v), y1: padT, x2: X(v), y2: H - padB, stroke: v === 0 ? c.soft : c.grid, 'stroke-width': v === 0 ? 1.4 : 1, 'stroke-dasharray': v === 0 ? 'none' : '2 4' }, svg);
      el('text', { x: X(v), y: H - padB + 18, 'text-anchor': 'middle', class: 'chart__tk' }, svg).textContent = (v > 0 ? '+' : '') + v + '%';
    });
    const rects = [];
    axes.forEach((ax, ai) => {
      const y0 = padT + ai * rowH;
      el('text', { x: m.l - 12, y: y0 + rowH / 2, 'text-anchor': 'end', class: 'chart__lbl' }, svg).textContent = ax;
      const bh = 13, gap = 4, blockH = series.length * (bh + gap);
      series.forEach((s, si) => {
        const v = s.v[ai], xz = X(0), xv = X(v);
        const y = y0 + (rowH - blockH) / 2 + si * (bh + gap);
        const r = el('rect', { x: xz, y, width: 0, height: bh, rx: 3, fill: s.c, opacity: si === 2 ? 1 : .8, style: 'cursor:pointer' }, svg);
        r._x = Math.min(xz, xv); r._w = Math.abs(xv - xz);
        r.addEventListener('mouseenter', () => { r.style.filter = 'brightness(1.08)'; showTip(wrap, `<b>${s.n}</b><span>${ax}<em>${v > 0 ? '+' : ''}${v}%</em></span>`, (xz + xv) / 2, y); });
        r.addEventListener('mouseleave', () => { r.style.filter = ''; hideTip(wrap); });
        el('text', { x: xv + (v >= 0 ? 5 : -5), y: y + bh - 2, 'text-anchor': v >= 0 ? 'start' : 'end', class: 'chart__tk', fill: si === 2 ? c.accent2 : c.mute, 'font-size': '10' }, svg).textContent = (v > 0 ? '+' : '') + v;
        rects.push(r);
      });
    });
    if (reduce) rects.forEach((r) => { r.setAttribute('x', r._x); r.setAttribute('width', r._w); });
    else onVisible(wrap, () => rects.forEach((r, i) => { r.style.transition = `width .7s ${0.03 * i}s cubic-bezier(.2,.7,.2,1), x .7s ${0.03 * i}s cubic-bezier(.2,.7,.2,1)`; r.setAttribute('x', r._x); r.setAttribute('width', r._w); }));
    legend(wrap, series.map((s) => [s.n, s.c]));
  }

  /* ------------------------------------------------------------- HUMAN EVAL */
  const HE_GROUPS = [
    { title: 'Veda 90% vs. Full Attention', short: 'Full Attn', m: [[35, 35, 31], [19, 63, 18], [50, 1, 49], [32, 38, 30]] },
    { title: 'Veda 95% vs. VSA 87.5%', short: 'VSA 87.5%', m: [[25, 52, 24], [21, 59, 20], [54, 0, 46], [38, 31, 31]] },
    { title: 'Veda 95% vs. VSA 95%', short: 'VSA 95%', m: [[39, 45, 16], [35, 50, 15], [76, 0, 24], [40, 30, 30]] },
  ];
  const HE_METRICS = ['Overall Quality', 'Motion Quality', 'Visual Quality', 'Prompt Following'];
  function renderHumanEval(wrap) {
    const c = COL();
    const tabs = document.createElement('div'); tabs.className = 'chart__tabs';
    const lbl = document.createElement('span'); lbl.className = 'chart__tabs-label'; lbl.textContent = 'Veda vs.'; tabs.appendChild(lbl);
    HE_GROUPS.forEach((g, i) => {
      const b = document.createElement('button'); b.className = 'chart__tab' + (i === 0 ? ' is-active' : ''); b.type = 'button'; b.textContent = g.short; b.title = g.title;
      b.addEventListener('click', () => { $$('.chart__tab', tabs).forEach((x) => x.classList.remove('is-active')); b.classList.add('is-active'); draw(i); });
      tabs.appendChild(b);
    });
    wrap.appendChild(tabs);
    const host = document.createElement('div'); host.className = 'chart__he'; wrap.appendChild(host);
    const W = 720, rowH = 52, padT = 8, padB = 30, m = { l: 132, r: 16 };
    function draw(gi) {
      host.innerHTML = '';
      const g = HE_GROUPS[gi];
      const H = padT + padB + rowH * HE_METRICS.length;
      const iw = W - m.l - m.r;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: 'img', 'aria-label': g.title }, host);
      const X = (v) => m.l + v / 100 * iw;
      [0, 25, 50, 75, 100].forEach((v) => {
        el('line', { x1: X(v), y1: padT, x2: X(v), y2: H - padB, stroke: c.grid, 'stroke-width': 1 }, svg);
        el('text', { x: X(v), y: H - padB + 18, 'text-anchor': 'middle', class: 'chart__tk' }, svg).textContent = v + '%';
      });
      g.m.forEach((row, ri) => {
        const y = padT + ri * rowH + 8, bh = 26;
        el('text', { x: m.l - 12, y: y + bh / 2 + 4, 'text-anchor': 'end', class: 'chart__lbl' }, svg).textContent = HE_METRICS[ri];
        const segs = [{ v: row[0], c: c.veda, n: 'Veda better' }, { v: row[1], c: c.tie, n: 'Tie' }, { v: row[2], c: c.base, n: 'Baseline better' }];
        let acc = 0;
        segs.forEach((s) => {
          const x0 = X(acc), w = s.v / 100 * iw;
          const rect = el('rect', { x: x0, y, width: 0, height: bh, fill: s.c, rx: 3, style: 'cursor:pointer' }, svg);
          rect.addEventListener('mouseenter', () => { rect.style.filter = 'brightness(1.06)'; showTip(host, `<b>${s.n}</b><span>${HE_METRICS[ri]} · ${s.v}%</span>`, x0 + w / 2, y); });
          rect.addEventListener('mouseleave', () => { rect.style.filter = ''; hideTip(host); });
          if (reduce) rect.setAttribute('width', w);
          else { rect.style.transition = `width .7s ${0.04 * ri}s cubic-bezier(.2,.7,.2,1)`; requestAnimationFrame(() => requestAnimationFrame(() => rect.setAttribute('width', w))); }
          if (s.v >= 9) el('text', { x: x0 + w / 2, y: y + bh / 2 + 4, 'text-anchor': 'middle', class: 'chart__seglbl', fill: s.c === c.tie ? c.soft : '#fff' }, svg).textContent = s.v + '%';
          acc += s.v;
        });
      });
    }
    onVisible(wrap, () => draw(0));
    legend(wrap, [['Veda better', c.veda], ['Tie', c.tie], ['Baseline better', c.base]]);
  }

  /* ------------------------------------------------------------------ RADAR */
  const RADAR = {
    axes: ['Overall', 'Motion', 'Visual', 'Prompt'],
    series: [
      { n: 'Static [4,8,4]', c: '#8aa3cf', v: [-1.6, -5.3, -1.3, -7.6] },
      { n: 'Static [8,8,2]', c: '#e08a4a', v: [-1.6, -2.0, -4.3, -6.3] },
      { n: 'Head-aware (Ours)', c: null, v: [9.5, 7.2, 1.6, 4.9] },
    ],
  };
  function renderRadar(wrap) {
    const c = COL();
    RADAR.series[2].c = c.accent2;
    const W = 380, H = 380, cx = W / 2, cy = H / 2 + 6, R = 128;
    const lo = -12, hi = 12;
    const rr = (v) => (v - lo) / (hi - lo) * R;
    const ang = (i) => -Math.PI / 2 + i * 2 * Math.PI / RADAR.axes.length;
    const pt = (i, v) => [cx + rr(v) * Math.cos(ang(i)), cy + rr(v) * Math.sin(ang(i))];
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: 'img', 'aria-label': 'Head-aware tiling net win-rate vs static tilings' }, wrap);
    [-10, 0, 10].forEach((v) => {
      const pts = RADAR.axes.map((_, i) => pt(i, v).join(',')).join(' ');
      el('polygon', { points: pts, fill: 'none', stroke: v === 0 ? c.soft : c.grid, 'stroke-width': v === 0 ? 1.4 : 1, 'stroke-dasharray': v === 0 ? '4 4' : 'none' }, svg);
      el('text', { x: cx + 4, y: cy - rr(v) - 3, class: 'chart__tk' }, svg).textContent = v + '%';
    });
    RADAR.axes.forEach((a, i) => {
      const [x, y] = pt(i, hi);
      el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: c.grid, 'stroke-width': 1 }, svg);
      const [lx, ly] = pt(i, hi + 2.4);
      el('text', { x: lx, y: ly + 4, 'text-anchor': Math.abs(lx - cx) < 8 ? 'middle' : (lx > cx ? 'start' : 'end'), class: 'chart__lbl' }, svg).textContent = a;
    });
    RADAR.series.forEach((s, si) => {
      const pts = s.v.map((v, i) => pt(i, v));
      const poly = el('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill: s.c, 'fill-opacity': si === 2 ? .18 : .08, stroke: s.c, 'stroke-width': si === 2 ? 2.6 : 1.8, class: 'radar__poly' }, svg);
      poly.dataset.si = si;
      pts.forEach((p, i) => {
        const dot = el('circle', { cx: p[0], cy: p[1], r: si === 2 ? 4 : 3, fill: s.c, style: 'cursor:pointer' }, svg);
        dot.addEventListener('mouseenter', () => showTip(wrap, `<b>${s.n}</b><span>${RADAR.axes[i]} Quality<em>· ${s.v[i] > 0 ? '+' : ''}${s.v[i]}%</em></span>`, p[0], p[1]));
        dot.addEventListener('mouseleave', () => hideTip(wrap));
      });
    });
    legend(wrap, RADAR.series.map((s) => [s.n, s.c]));
  }

  /* ------------------------------------------------------------------ LEGEND */
  function legend(wrap, items) {
    const lg = document.createElement('div'); lg.className = 'chart__legend';
    items.forEach(([name, color]) => {
      const i = document.createElement('span'); i.className = 'chart__lg';
      i.innerHTML = `<i style="background:${color}"></i>${name}`;
      lg.appendChild(i);
    });
    wrap.appendChild(lg);
  }

  /* -------------------------------------------------------------------- INIT */
  function init() {
    const R = { scaling: renderScaling, speedup: renderSpeedup, humaneval: renderHumanEval, radar: renderRadar, ablation: renderAblation };
    $$('[data-chart]').forEach((wrap) => { const fn = R[wrap.dataset.chart]; if (fn) { wrap.classList.add('chart'); fn(wrap); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
