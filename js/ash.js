// ===== Pó: desfazer e formar =====
// HRAsh.run(elementos, opções) desfaz cada elemento em pó, da esquerda para a direita (ou, com appear: true, forma o
// elemento a partir do pó, também da esquerda para a direita). Duas camadas fazem o efeito:
//   1. um filtro SVG em cada elemento: um ruído misturado com uma rampa da esquerda para a direita vira uma máscara
//      que vai comendo (ou revelando) o elemento, com a borda granulada como cinza. A rampa é feita de faixas de cinza
//      dentro do próprio filtro: uma imagem (feImage) ainda carregando faria o navegador esconder o elemento inteiro;
//   2. um <canvas> por cima da página, com os grãos de pó que se soltam na borda e voam com o vento.
// Quem usa: as abas da barra (aqui embaixo) e o título da abertura (js/title.js).
// Quem pediu menos movimento não vê o pó: as abas só pulam para a seção e o título troca pelo brilho.
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var SHARP = 30;             // quão fina é a borda da máscara (maior = borda mais dura)
  var BANDS = 32;             // faixas da rampa (o ruído é bem maior que o degrau entre elas: não aparecem)
  var MARGIN = 64;            // px além da caixa do elemento: o brilho, as sombras e as letras que passam da caixa (o "g", o "j")
                              // também viram pó; sem essa margem o efeito cortava tudo num retângulo
  var svg = null, serial = 0;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // Um filtro para cada elemento, do tamanho dele mais a margem em volta (a rampa cobre essa largura toda)
  function filterFor(w, h) {
    if (!svg) svg = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', 'class': 'ash-defs' }, document.body);
    var id = 'ash-' + (++serial), m = MARGIN, fw = w + 2 * m, fh = h + 2 * m;
    var f = el('filter', { id: id, x: -m, y: -m, width: fw, height: fh, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, svg);
    var opaque = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1';
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.018 0.04', numOctaves: 3, seed: 11 + serial, result: 'n1' }, f);
    el('feColorMatrix', { 'in': 'n1', type: 'matrix', values: opaque, result: 'big' }, f);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.75', numOctaves: 1, seed: 3 + serial, result: 'n2' }, f);
    el('feColorMatrix', { 'in': 'n2', type: 'matrix', values: opaque, result: 'grain' }, f);
    el('feComposite', { 'in': 'big', in2: 'grain', operator: 'arithmetic', k2: 0.6, k3: 0.4, result: 'noise' }, f);
    // a rampa: BANDS faixas verticais, do preto (esquerda) ao branco (direita), juntas numa imagem só
    var bw = fw / BANDS, merge, b;
    for (b = 0; b < BANDS; b++) {
      var v = Math.round(255 * b / (BANDS - 1));
      el('feFlood', { x: (b * bw - m).toFixed(1), y: -m, width: (bw + 1).toFixed(1), height: fh, 'flood-color': 'rgb(' + v + ',' + v + ',' + v + ')', result: 'r' + b }, f);
    }
    merge = el('feMerge', { result: 'ramp' }, f);
    for (b = 0; b < BANDS; b++) el('feMergeNode', { 'in': 'r' + b }, merge);
    el('feComposite', { 'in': 'noise', in2: 'ramp', operator: 'arithmetic', k2: 0.45, k3: 0.55, result: 'mix' }, f);
    var cut = el('feColorMatrix', { 'in': 'mix', type: 'matrix', values: maskOut(0), result: 'mask' }, f);
    el('feComposite', { 'in': 'SourceGraphic', in2: 'mask', operator: 'in', result: 'kept' }, f);
    var shake = el('feDisplacementMap', { 'in': 'kept', in2: 'big', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    return { id: id, node: f, cut: cut, shake: shake };
  }
  // máscaras: desfazer = fica o que tem ruído + rampa acima do limite t; formar = aparece o que está abaixo dele
  function maskOut(t) { return '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ' + SHARP + ' 0 0 0 ' + (-SHARP * t + 1).toFixed(3); }
  function maskIn(t) { return '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ' + (-SHARP) + ' 0 0 0 ' + (SHARP * t + 1).toFixed(3); }

  // ---------- O pó ----------
  // O canvas fica preso na tela (position: fixed), mas o pó é da página: a cada quadro, os grãos andam o quanto a página
  // rolou desde o quadro anterior (sem isso, ao rolar no meio do efeito, o pó ficava parado na tela e "descia junto").
  var canvas = null, ctx = null, grains = [], jobs = [], W = 0, H = 0, dpr = 1, looping = false, last = 0, sx = 0, sy = 0;
  function scrolled() {                 // quanto a página andou na tela desde a última vez (e guarda a posição de agora)
    var x = window.scrollX || window.pageXOffset || 0, y = window.scrollY || window.pageYOffset || 0, d = [sx - x, sy - y];
    sx = x; sy = y;
    return d;
  }
  function board() {
    if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'ash-dust'; canvas.setAttribute('aria-hidden', 'true'); document.body.appendChild(canvas); ctx = canvas.getContext('2d'); }
    if (W !== window.innerWidth || H !== window.innerHeight || !looping) {
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    canvas.hidden = false;
  }
  function inside(x, y, list) { for (var i = 0; i < list.length; i++) { var r = list[i]; if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true; } return false; }
  // n grãos na faixa logo atrás da borda (front, em px na tela), só onde há algo desenhado (list: retângulos na tela)
  function spawn(front, box, list, n, appear, tint) {
    var band = Math.max(24, box.width * 0.12);
    for (var k = 0, tries = 0; k < n && tries < n * 6; tries++) {
      var x = appear ? front + Math.random() * band * 0.5 : front - Math.random() * band, y = box.top + Math.random() * box.height;
      if (!inside(x, y, list)) continue;
      k++;
      var light = Math.random() < 0.7;
      grains.push({
        x: x, y: y, vx: appear ? 20 + Math.random() * 60 : 60 + Math.random() * 200, vy: appear ? -5 - Math.random() * 30 : -20 - Math.random() * 100,
        life: 0, end: appear ? 0.35 + Math.random() * 0.4 : 0.8 + Math.random() * 0.8, wind: appear ? 0.3 : 1,
        s: 1 + Math.random() * 2.2, ph: Math.random() * 6.3, c: tint && Math.random() < 0.6 ? tint : light ? '240, 238, 232' : '150, 149, 144', a: 0.6 + Math.random() * 0.4
      });
    }
  }
  function drift(dt) {
    ctx.clearRect(0, 0, W, H);
    for (var i = grains.length - 1; i >= 0; i--) {
      var g = grains[i];
      g.life += dt;
      if (g.life >= g.end) { grains.splice(i, 1); continue; }
      if (g.to) {                                                         // sugado: espirala até o ponto e some nele
        var dx = g.to[0] - g.x, dy = g.to[1] - g.y, d = Math.hypot(dx, dy) || 1;
        if (d < 5) { grains.splice(i, 1); continue; }
        var pull = 2600 + 90000 / (d + 30);
        g.vx += (dx / d * pull - dy / d * 520) * dt; g.vy += (dy / d * pull + dx / d * 520) * dt;
        var fr = Math.pow(0.9, dt * 60); g.vx *= fr; g.vy *= fr;
      } else if (g.boom) {                                                // explosão: sai voando e freia no ar
        var fb = Math.pow(0.93, dt * 60); g.vx *= fb; g.vy *= fb;
      } else {
        g.vx += (150 + Math.sin(g.ph + g.life * 5) * 90) * g.wind * dt;   // vento para a direita, com redemoinho
        g.vy += (-26 + Math.cos(g.ph + g.life * 4) * 40) * g.wind * dt;   // ... e um pouco para cima
      }
      g.x += g.vx * dt; g.y += g.vy * dt;
      var k = g.to ? 1 : 1 - g.life / g.end;
      ctx.fillStyle = 'rgba(' + g.c + ',' + (g.a * k).toFixed(3) + ')';
      var s = g.s * (0.5 + 0.5 * k);
      ctx.fillRect(g.x, g.y, s, s);
    }
  }
  // um laço só para todos os efeitos em andamento e para o pó; ele para quando não sobra nada
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    // primeiro, os grãos que já estavam no ar andam junto com a página; depois os efeitos soltam os novos (já no lugar certo)
    var m = scrolled(), mx = m[0], my = m[1];
    if (mx || my) for (var i = 0; i < grains.length; i++) { var g = grains[i]; g.x += mx; g.y += my; if (g.to) { g.to[0] += mx; g.to[1] += my; } }
    jobs.slice().forEach(function (j) { j(now); });
    drift(dt);
    if (jobs.length || grains.length) requestAnimationFrame(tick);
    else { looping = false; canvas.hidden = true; }
  }
  function loop() { if (!looping) { looping = true; last = performance.now(); scrolled(); requestAnimationFrame(tick); } }

  // ---------- O efeito ----------
  // opts: { appear: formar em vez de desfazer, duration: ms, dust: quantidade de pó (1 = normal, 0 = nenhum),
  //         spots: função que devolve os retângulos na tela de onde o pó pode sair (sem ela, os próprios elementos),
  //         tint: uma cor ('r, g, b') para 6 em 10 grãos, como o pó colorido do fogo dos cartões das áreas }
  // Ao desfazer, o elemento termina com opacity 0 (quem chamou decide quando mostrar de novo); ao formar, com opacity 1.
  function run(els, opts) {
    opts = opts || {};
    var appear = !!opts.appear, dur = opts.duration || 900, dust = opts.dust === undefined ? 1 : opts.dust;
    return new Promise(function (done) {
      board();
      var parts = els.map(function (n) {
        var f = filterFor(n.offsetWidth, n.offsetHeight);
        f.cut.setAttribute('values', appear ? maskIn(0) : maskOut(0));
        n.style.filter = 'url(#' + f.id + ')';
        n.dataset.ash = f.id;                                     // de quem é o elemento agora
        if (appear) n.style.opacity = '1';                        // já com a máscara fechada: nada pisca
        return { n: n, f: f };
      });
      var start = 0, warm = 2;                                    // dois quadros de espera: o filtro fica pronto antes de começar
      function job(now) {
        if (warm) { warm--; start = now; return; }
        var t = Math.min(1, (now - start) / dur), e = t * (0.6 + 0.4 * t);   // começa rápido e acelera um pouco
        // o limite vai de logo antes do pixel mais escuro da mistura (borda esquerda, ~0,12) a logo depois do mais claro
        // (borda direita, ~0,88): a borda atravessa o elemento durante o tempo todo, sem trecho parado
        var limit = 0.1 + e * 0.82, list = dust ? (opts.spots ? opts.spots() : parts.map(function (p) { return p.n.getBoundingClientRect(); })) : null;
        parts.forEach(function (p) {
          p.f.cut.setAttribute('values', appear ? maskIn(limit) : maskOut(limit));
          p.f.shake.setAttribute('scale', ((appear ? 1 - e : e) * 16).toFixed(2));
          if (!dust) return;
          var r = p.n.getBoundingClientRect(), front = r.left - MARGIN + (r.width + 2 * MARGIN) * (limit - 0.225) / 0.55;   // onde está a borda, em px
          var n = Math.round(Math.min(r.width, W) * Math.min(r.height, H) / 18000 * dust) + 6;
          if (front > r.left - 40 && front < r.right + 40 && r.bottom > 0 && r.top < H) spawn(front, r, list, appear ? Math.ceil(n / 3) : n, appear, opts.tint);
        });
        if (t < 1) return;
        jobs.splice(jobs.indexOf(job), 1);
        parts.forEach(function (p) {
          if (p.n.dataset.ash === p.f.id) { if (!appear) p.n.style.opacity = '0'; p.n.style.filter = ''; delete p.n.dataset.ash; }
          p.f.node.remove();
        });
        done();
      }
      jobs.push(job);
      loop();
    });
  }
  // ---------- Redemoinho: o pó corre para um ponto ou sai dele ----------
  // vortex(x, y, raio, ms, dentro, área, cor): durante ms, solta grãos na borda de um círculo em volta de (x, y) que encolhe
  // (dentro: os grãos são sugados para o ponto, girando) ou cresce (fora: os grãos saem voando). área: retângulos da tela
  // onde o pó pode nascer (o desenho da janela); cor: 'r, g, b' de uma parte dos grãos (o resto é cinza claro)
  function vortex(cx, cy, R, ms, inward, list, tint) {
    if (reduced) return Promise.resolve();
    return new Promise(function (done) {
      board();
      var start = 0, warm = 1, x0 = window.scrollX || 0, y0 = window.scrollY || 0;
      function job(now) {
        if (warm) { warm--; start = now; return; }
        var t = Math.min(1, (now - start) / ms), e = inward ? t * t : 1 - (1 - t) * (1 - t), r = Math.max(4, inward ? R * (1 - e) : R * e);
        var n = Math.round(inward ? 34 * (1 - t) + 10 : 46 * (1 - t) + 6);
        var ox = x0 - (window.scrollX || 0), oy = y0 - (window.scrollY || 0), px = cx + ox, py = cy + oy;   // o quanto a página andou desde o começo
        for (var k = 0, tries = 0; k < n && tries < n * 4; tries++) {
          var a = Math.random() * Math.PI * 2, x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
          if (list && !inside(x - ox, y - oy, list)) continue;
          k++;
          var c = tint && Math.random() < 0.55 ? tint : Math.random() < 0.7 ? '240, 238, 232' : '150, 149, 144', sp = inward ? 90 : 260 + Math.random() * 380;
          grains.push({
            x: x, y: y, vx: inward ? -Math.sin(a) * sp : Math.cos(a) * sp, vy: inward ? Math.cos(a) * sp : Math.sin(a) * sp,
            life: 0, end: inward ? 1.6 : 0.5 + Math.random() * 0.6, wind: 0, to: inward ? [px, py] : null, boom: !inward,
            s: 1 + Math.random() * 2.2, ph: Math.random() * 6.3, c: c, a: 0.6 + Math.random() * 0.4
          });
        }
        if (t < 1) return;
        jobs.splice(jobs.indexOf(job), 1);
        done();
      }
      jobs.push(job);
      loop();
    });
  }
  window.HRAsh = { run: run, vortex: vortex, reduced: reduced };

  // ---------- Abas: a tela vira pó e a página reaparece na seção ----------
  var tabs = document.querySelectorAll('.tabs a'), busy = false;
  var DUR = 900;              // ms até a tela sumir inteira
  // de onde o pó pode sair: os pedaços da tela que têm algo desenhado (texto, botões, imagens, a janela)
  function spots() {
    var out = [];
    document.querySelectorAll('main h1, main h2, main h3, main p, main .btn, main img, main .media > li, main .empty__slots span, .window__bar, .contact h2, .contact p, .contact .btn, .mail, .foot').forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.width > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) out.push(r);
    });
    return out;
  }
  function go(link, e) {
    var target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (busy) return;
    busy = true;
    var vh = window.innerHeight, blocks = [], list;
    document.querySelectorAll('.hero__stage, main > .section, .contact').forEach(function (b) {
      var r = b.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) blocks.push(b);
    });
    W = window.innerWidth; H = vh; list = spots();
    var y0 = window.scrollY || 0;
    run(blocks, { duration: DUR, spots: function () {
      var d = y0 - (window.scrollY || 0);
      return d ? list.map(function (r) { return { left: r.left, right: r.right, top: r.top + d, bottom: r.bottom + d }; }) : list;
    }, dust: 1.6 }).then(function () {
      var top = target.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
      document.documentElement.classList.add('arriving');
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      blocks.forEach(function (b) { b.style.opacity = ''; });
      if (history.pushState) history.pushState(null, '', link.getAttribute('href'));
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      setTimeout(function () { document.documentElement.classList.remove('arriving'); busy = false; }, 700);
    });
  }
  Array.prototype.forEach.call(tabs, function (a) {
    a.addEventListener('click', function (e) {
      if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // menos movimento ou abrir em outra aba: o link de sempre
      go(a, e);
    });
  });
})();
