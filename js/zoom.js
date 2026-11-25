// ===== Zoom no visualizador =====
// A imagem aberta no visualizador (js/page.js) aproxima como no Discord e nos visualizadores de foto:
//   mouse    um clique aproxima no ponto clicado (2,5 vezes) e outro clique volta; com ela aproximada, arrastar move e a
//            roda do mouse aproxima ou afasta em volta do cursor (de 1 a 8 vezes)
//   toque    dois dedos aproximam e afastam (a pinça); um dedo move a imagem aproximada; dois toques rápidos aproximam
//            ou voltam
//   teclado  + e − aproximam e afastam, 0 volta ao tamanho normal (as setas continuam trocando de imagem)
// Trocar de imagem, fechar ou mudar o tamanho da janela volta ao normal. A imagem nunca sai da área dela (nada passa por
// cima da barra de baixo) e, aproximada, não deixa sobrar vão nas bordas. Vídeos não aproximam.
(function () {
  'use strict';
  var box = document.querySelector('.lightbox'), stage = box && box.querySelector('.lightbox__stage');
  if (!stage) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CLICK = 2.5, MAX = 8, MOVE = 6;      // o clique aproxima 2,5 vezes; no máximo 8; até 6 px de tremida ainda é clique
  var img = null, s = 1, x = 0, y = 0;     // a escala e o deslocamento da imagem (em px, a partir de onde ela fica normalmente)
  var pts = {}, n = 0, drag = null, pinch = null, tap = null;

  // a caixa da imagem sem o zoom, na área do visualizador
  function base() { return { x: img.offsetLeft, y: img.offsetTop, w: img.offsetWidth, h: img.offsetHeight }; }
  function fit() {          // aproximada, a imagem cobre a área até a borda; menor que a área num sentido, fica no meio
    var W = stage.clientWidth, H = stage.clientHeight, b = base(), w = b.w * s, h = b.h * s;
    x = w <= W ? (W - w) / 2 - b.x : Math.min(-b.x, Math.max(W - w - b.x, x));
    y = h <= H ? (H - h) / 2 - b.y : Math.min(-b.y, Math.max(H - h - b.y, y));
  }
  function paint(anim) {
    img.style.transition = anim && !reduced ? 'transform .26s cubic-bezier(.2, .7, .2, 1)' : 'none';
    img.style.transform = s > 1 ? 'translate(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px) scale(' + s.toFixed(4) + ')' : '';
    box.classList.toggle('is-zoomed', s > 1);
  }
  // muda a escala mantendo parado o ponto (cx, cy) da área (o que está embaixo do cursor ou entre os dedos)
  function zoomAt(ns, cx, cy, anim) {
    if (!img) return;
    ns = Math.max(1, Math.min(MAX, ns));
    var b = base(), u = (cx - b.x - x) / s, v = (cy - b.y - y) / s;
    s = ns; x = cx - b.x - u * s; y = cy - b.y - v * s;
    if (s < 1.01) { s = 1; x = y = 0; }
    fit(); paint(anim);
  }
  function reset(anim) { s = 1; x = y = 0; drag = pinch = null; pts = {}; n = 0; box.classList.remove('is-panning'); if (img) paint(anim); }
  function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function toggle(p) { if (s > 1) reset(true); else zoomAt(CLICK, p.x, p.y, true); }

  // a imagem da vez: o visualizador troca o conteúdo da área a cada imagem (e esvazia ao fechar)
  function attach() {
    var el = stage.querySelector('img');
    if (el === img) return;
    img = el; s = 1; x = y = 0; drag = pinch = null; pts = {}; n = 0;
    box.classList.remove('is-zoomed', 'is-panning');
    if (!img) return;
    img.draggable = false;
    img.addEventListener('pointerdown', down);
    img.addEventListener('pointermove', move);
    img.addEventListener('pointerup', up);
    img.addEventListener('pointercancel', cancel);
    img.addEventListener('lostpointercapture', cancel);
  }
  new MutationObserver(attach).observe(stage, { childList: true });

  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { img.setPointerCapture(e.pointerId); } catch (err) {}
    pts[e.pointerId] = local(e); n = Object.keys(pts).length;
    if (n === 2) {                         // a pinça: a distância entre os dedos manda na escala
      var k = Object.keys(pts), a = pts[k[0]], c = pts[k[1]];
      pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) || 1, s: s, mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2 };
      drag = null; tap = null;
    } else if (n === 1) {
      var p = pts[e.pointerId];
      drag = { id: e.pointerId, x0: p.x, y0: p.y, x: x, y: y, moved: false, mouse: e.pointerType === 'mouse' };
    }
  }
  function move(e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = local(e);
    if (pinch && n === 2) {
      var k = Object.keys(pts), a = pts[k[0]], c = pts[k[1]], mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
      x += mx - pinch.mx; y += my - pinch.my; pinch.mx = mx; pinch.my = my;      // os dois dedos andando juntos movem
      zoomAt(pinch.s * Math.hypot(a.x - c.x, a.y - c.y) / pinch.d, mx, my, false);
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    var p = pts[e.pointerId], dx = p.x - drag.x0, dy = p.y - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > MOVE) { drag.moved = true; if (s > 1) box.classList.add('is-panning'); }
    if (drag.moved && s > 1) { x = drag.x + dx; y = drag.y + dy; fit(); paint(false); }
  }
  function up(e) {
    if (!pts[e.pointerId]) return;
    var p = pts[e.pointerId];
    delete pts[e.pointerId]; n = Object.keys(pts).length;
    box.classList.remove('is-panning');
    if (pinch) { if (n < 2) pinch = null; drag = null; return; }      // depois da pinça, o dedo que sobra não vira toque
    var d = drag; drag = null;
    if (!d || d.id !== e.pointerId || d.moved) return;
    if (d.mouse) { toggle(p); return; }                                   // mouse: um clique
    var t = performance.now();                                            // toque: dois toques rápidos no mesmo lugar
    if (tap && t - tap.t < 320 && Math.hypot(p.x - tap.x, p.y - tap.y) < 36) { tap = null; toggle(p); }
    else tap = { t: t, x: p.x, y: p.y };
  }
  function cancel(e) { if (pts[e.pointerId]) { delete pts[e.pointerId]; n = Object.keys(pts).length; } if (n < 2) pinch = null; if (drag && drag.id === e.pointerId) drag = null; box.classList.remove('is-panning'); }

  // a roda do mouse (e a pinça do touchpad, que chega como roda com Ctrl) aproxima e afasta em volta do cursor
  stage.addEventListener('wheel', function (e) {
    if (!img || !img.contains(e.target) && !(s > 1)) return;
    e.preventDefault();
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY, p = local(e);
    zoomAt(s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y, false);
  }, { passive: false });
  box.addEventListener('keydown', function (e) {
    if (!img || e.altKey || e.ctrlKey || e.metaKey) return;
    var c = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(s * 1.6, c.x, c.y, true); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(s / 1.6, c.x, c.y, true); }
    else if (e.key === '0') { e.preventDefault(); reset(true); }
  });
  window.addEventListener('resize', function () { if (s > 1) reset(false); });
  box.addEventListener('close', function () { reset(false); });
})();
