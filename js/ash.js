// ===== Virar cinza ao clicar numa aba =====
// Em vez de rolar até a seção, o que está na tela se desfaz em pó, da esquerda para a direita, e a página
// reaparece já na seção escolhida. Duas camadas fazem o efeito:
//   1. um filtro SVG em cada bloco visível: um ruído misturado com uma rampa da esquerda para a direita vira uma
//      máscara que vai comendo o bloco, com a borda granulada como cinza (o limite sobe de 0 a 1 em DUR).
//      A rampa é feita de faixas de cinza dentro do próprio filtro: uma imagem (feImage) ainda carregando faria o
//      navegador esconder o bloco inteiro;
//   2. um <canvas> por cima, com os grãos de pó que se soltam na frente da borda e voam com o vento.
// Quem pediu menos movimento (ou um navegador sem filtro SVG) só pula direto para a seção.
(function () {
  'use strict';
  var tabs = document.querySelectorAll('.tabs a');
  if (!tabs.length || !window.requestAnimationFrame) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var DUR = 900;              // ms até a tela sumir inteira
  var SHARP = 30;             // quão fina é a borda da máscara (maior = borda mais dura)
  var BANDS = 32;             // faixas da rampa (o ruído é bem maior que o degrau entre elas: não aparecem)
  var busy = false, svg = null;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // Um filtro para cada bloco, do tamanho dele (a rampa precisa cobrir a largura exata do bloco)
  function filterFor(i, w, h) {
    if (!svg) svg = el('svg', { width: 0, height: 0, 'aria-hidden': 'true', 'class': 'ash-defs' }, document.body);
    var f = el('filter', { id: 'ash-' + i, x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, svg);
    var opaque = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1';
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.018 0.04', numOctaves: 3, seed: 11 + i, result: 'n1' }, f);
    el('feColorMatrix', { 'in': 'n1', type: 'matrix', values: opaque, result: 'big' }, f);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.75', numOctaves: 1, seed: 3 + i, result: 'n2' }, f);
    el('feColorMatrix', { 'in': 'n2', type: 'matrix', values: opaque, result: 'grain' }, f);
    el('feComposite', { 'in': 'big', in2: 'grain', operator: 'arithmetic', k2: 0.6, k3: 0.4, result: 'noise' }, f);
    // a rampa: BANDS faixas verticais, do preto (esquerda) ao branco (direita), juntas numa imagem só
    var bw = w / BANDS, merge;
    for (var b = 0; b < BANDS; b++) {
      var v = Math.round(255 * b / (BANDS - 1));
      el('feFlood', { x: (b * bw).toFixed(1), y: 0, width: (bw + 1).toFixed(1), height: h, 'flood-color': 'rgb(' + v + ',' + v + ',' + v + ')', result: 'r' + b }, f);
    }
    merge = el('feMerge', { result: 'ramp' }, f);
    for (b = 0; b < BANDS; b++) el('feMergeNode', { 'in': 'r' + b }, merge);
    el('feComposite', { 'in': 'noise', in2: 'ramp', operator: 'arithmetic', k2: 0.45, k3: 0.55, result: 'mix' }, f);
    var cut = el('feColorMatrix', { 'in': 'mix', type: 'matrix', values: mask(0), result: 'mask' }, f);
    el('feComposite', { 'in': 'SourceGraphic', in2: 'mask', operator: 'in', result: 'kept' }, f);
    var shake = el('feDisplacementMap', { 'in': 'kept', in2: 'big', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    return { cut: cut, shake: shake };
  }
  // máscara: fica o que tem ruído + rampa acima do limite t; some o resto
  function mask(t) { return '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ' + SHARP + ' 0 0 0 ' + (-SHARP * t + 1).toFixed(3); }

  // ---------- O pó ----------
  var canvas = null, ctx = null, grains = [], W = 0, H = 0, dpr = 1;
  function board() {
    if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'ash-dust'; canvas.setAttribute('aria-hidden', 'true'); document.body.appendChild(canvas); ctx = canvas.getContext('2d'); }
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.hidden = false;
  }
  // de onde o pó pode sair: os pedaços da tela que têm algo desenhado (texto, botões, imagens, a janela)
  function spots() {
    var out = [];
    document.querySelectorAll('main h1, main h2, main h3, main p, main .btn, main img, main .media > li, main .empty__slots span, .window__bar, .contact h2, .contact p, .contact .btn, .mail, .foot').forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.width > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) out.push(r);
    });
    return out;
  }
  function inside(x, y, list) { for (var i = 0; i < list.length; i++) { var r = list[i]; if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true; } return false; }
  function spawn(front, list, n) {
    for (var k = 0, tries = 0; k < n && tries < n * 6; tries++) {
      var x = front - Math.random() * W * 0.12, y = Math.random() * H;
      if (!inside(x, y, list)) continue;
      k++;
      var light = Math.random() < 0.7;
      grains.push({
        x: x, y: y, vx: 60 + Math.random() * 200, vy: -20 - Math.random() * 100, life: 0, end: 0.8 + Math.random() * 0.8,
        s: 1 + Math.random() * 2.2, ph: Math.random() * 6.3, c: light ? '240, 238, 232' : '150, 149, 144', a: 0.6 + Math.random() * 0.4
      });
    }
  }
  function drift(dt) {
    ctx.clearRect(0, 0, W, H);
    for (var i = grains.length - 1; i >= 0; i--) {
      var g = grains[i];
      g.life += dt;
      if (g.life >= g.end) { grains.splice(i, 1); continue; }
      g.vx += (150 + Math.sin(g.ph + g.life * 5) * 90) * dt;     // vento para a direita, com redemoinho
      g.vy += (-26 + Math.cos(g.ph + g.life * 4) * 40) * dt;     // ... e um pouco para cima
      g.x += g.vx * dt; g.y += g.vy * dt;
      var k = 1 - g.life / g.end;
      ctx.fillStyle = 'rgba(' + g.c + ',' + (g.a * k).toFixed(3) + ')';
      var s = g.s * (0.5 + 0.5 * k);
      ctx.fillRect(g.x, g.y, s, s);
    }
  }

  // ---------- A passagem ----------
  function go(link, e) {
    var target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (busy) return;
    busy = true;
    H = window.innerHeight; W = window.innerWidth;
    // os blocos que estão na tela agora
    var blocks = [];
    document.querySelectorAll('.hero__stage, main > .section, .contact').forEach(function (b) {
      var r = b.getBoundingClientRect();
      if (r.bottom > 0 && r.top < H) blocks.push(b);
    });
    var fx = blocks.map(function (b, i) { var f = filterFor(i, b.offsetWidth, b.offsetHeight); b.style.filter = 'url(#ash-' + i + ')'; return f; });
    var list = spots();
    board();
    var start = 0, last = 0, jumped = false, warm = 2;          // dois quadros de espera: o filtro fica pronto antes de começar
    var perFrame = Math.round((W * H) / 300 / 60) + 40;           // quantos grãos soltar por quadro (menos em tela pequena)
    function frame(now) {
      if (warm) { warm--; start = last = now; requestAnimationFrame(frame); return; }
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var t = Math.min(1, (now - start) / DUR), e2 = t * (0.6 + 0.4 * t);   // começa rápido e acelera um pouco
      // o limite da máscara vai de logo antes do pixel mais escuro da mistura (borda esquerda, ~0,12) a logo depois
      // do mais claro (borda direita, ~0,88): a borda atravessa a tela durante o tempo todo, sem trecho parado
      var limit = 0.1 + e2 * 0.82;
      if (!jumped) {
        fx.forEach(function (f) { f.cut.setAttribute('values', mask(limit)); f.shake.setAttribute('scale', (e2 * 16).toFixed(2)); });
        // a borda da máscara, em px: onde ruído médio (0,5) + rampa passa do limite
        var front = W * (limit - 0.225) / 0.55;
        if (front > -W * 0.05 && front < W * 1.08) spawn(front, list, perFrame);
      }
      if (t >= 1 && !jumped) {
        jumped = true;
        var top = target.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
        document.documentElement.classList.add('arriving');
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
        blocks.forEach(function (b) { b.style.filter = ''; });
        if (svg) { svg.remove(); svg = null; }
        if (history.pushState) history.pushState(null, '', link.getAttribute('href'));
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        setTimeout(function () { document.documentElement.classList.remove('arriving'); }, 700);
      }
      drift(dt);
      if (grains.length || !jumped) requestAnimationFrame(frame);
      else { canvas.hidden = true; busy = false; }
    }
    requestAnimationFrame(frame);
  }

  Array.prototype.forEach.call(tabs, function (a) {
    a.addEventListener('click', function (e) {
      if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // menos movimento ou abrir em outra aba: o link de sempre
      go(a, e);
    });
  });
})();
