// ===== Rolagem =====
// Cada trecho "preso" da página é uma seção alta com um palco fixo dentro.
// track() devolve o quanto dessa seção já foi rolado (0 a 1), suavizado para
// o movimento não dar trancos. loop() chama a função de desenho a cada quadro.
(function () {
  'use strict';

  var trackers = [], loops = [];
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function track(el) {
    var t = { el: el, raw: 0, p: 0, vh: window.innerHeight, top: 0, span: 1 };
    t.measure = function () {
      var r = el.getBoundingClientRect();
      t.vh = window.innerHeight;
      t.top = r.top + window.scrollY;
      t.span = Math.max(1, r.height - t.vh);
    };
    // Rola a página até um ponto (0 a 1) deste trecho
    t.go = function (p) {
      window.scrollTo({ top: t.top + p * t.span, behavior: reduced ? 'auto' : 'smooth' });
    };
    t.measure();
    t.raw = t.p = clamp((window.scrollY - t.top) / t.span, 0, 1);
    trackers.push(t);
    return t;
  }

  function loop(fn) { loops.push(fn); }

  var last = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    var k = reduced ? 1 : 1 - Math.exp(-dt * 9);
    for (var i = 0; i < trackers.length; i++) {
      var t = trackers[i];
      t.raw = clamp((window.scrollY - t.top) / t.span, 0, 1);
      t.p += (t.raw - t.p) * k;
      if (Math.abs(t.raw - t.p) < 0.00002) t.p = t.raw;
    }
    for (var j = 0; j < loops.length; j++) loops[j](now / 1000, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  var resizers = [];
  function onResize(fn) { resizers.push(fn); }
  var rt = 0;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(rt);
    rt = requestAnimationFrame(function () {
      trackers.forEach(function (t) { t.measure(); });
      resizers.forEach(function (fn) { fn(); });
    });
  });
  window.addEventListener('load', function () { trackers.forEach(function (t) { t.measure(); }); });

  // Cursor de -1 a 1; em telas de toque, um vaivém lento faz o papel do cursor
  // active: 0 a 1, sobe quando o mouse está sobre a página e some quando ele sai
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, touch: window.matchMedia && window.matchMedia('(hover: none)').matches, active: 0, over: false };
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.over = true;
  }, { passive: true });
  document.addEventListener('pointerleave', function () { pointer.over = false; });
  window.addEventListener('blur', function () { pointer.over = false; });
  loop(function (t, dt) {
    if (pointer.touch && !reduced) { pointer.tx = Math.sin(t * 0.45) * 0.6; pointer.ty = Math.cos(t * 0.31) * 0.35; }
    var k = 1 - Math.exp(-dt * 6);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    pointer.active += ((pointer.over ? 1 : 0) - pointer.active) * (1 - Math.exp(-dt * 4));
  });

  window.HRScroll = {
    track: track, loop: loop, onResize: onResize, pointer: pointer, reduced: reduced,
    clamp: clamp,
    lerp: function (a, b, t) { return a + (b - a) * t; },
    // 0 antes de a, 1 depois de b
    range: function (v, a, b) { return clamp((v - a) / (b - a), 0, 1); },
    smooth: function (v, a, b) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
    // sobe de 0 a 1 em [a, b], fica em 1 e desce de 1 a 0 em [c, d]
    window: function (v, a, b, c, d) {
      var up = clamp((v - a) / (b - a), 0, 1), down = 1 - clamp((v - c) / (d - c), 0, 1);
      up = up * up * (3 - 2 * up); down = down * down * (3 - 2 * down);
      return Math.min(up, down);
    }
  };
})();
