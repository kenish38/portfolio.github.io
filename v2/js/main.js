// ===== Coreografia da página =====
// A rolagem do palco é medida em "telas" (u). Cada trecho liga uma parte:
//   0 .. WALL            a câmera atravessa a parede pelo nome
//   WALL .. +INTRO       o mar de brasa assenta e vira a baseplate vazia
//   depois, 6 capítulos  em cada um as partículas tomam a forma de uma camada
// Para mudar a duração de um trecho, altere SEG aqui e --len em css/site.css
// (--len = WALL + INTRO + 6 × CH + TAIL).
(function () {
  'use strict';
  var S = window.HRScroll, clamp = S.clamp, lerp = S.lerp;
  var SEG = { wall: 1.5, intro: 1.4, ch: 1.15, n: 6, tail: 0.4 };
  var TOTAL = SEG.wall + SEG.intro + SEG.ch * SEG.n + SEG.tail;
  var I0 = SEG.wall, C0 = SEG.wall + SEG.intro;
  function c(i) { return C0 + i * SEG.ch; }
  function seg(u, a, b) { return S.smooth(u, a, b); }

  var root = document.documentElement;
  var stage = document.querySelector('.stage'), pin = stage.querySelector('.stage__pin');
  var wallEl = pin.querySelector('.wall'), openEl = pin.querySelector('.open'), cueEl = pin.querySelector('.cue');
  var introEl = pin.querySelector('.intro'), scrimEl = pin.querySelector('.scrim');
  var chapters = [].slice.call(pin.querySelectorAll('.chapter'));
  var rail = pin.querySelector('.rail'), railBtns = [].slice.call(rail.querySelectorAll('button'));
  var track = S.track(stage);

  // ---------- Parede e partículas ----------
  var wall = window.HRWall.create(wallEl, { sideNear: [10, 5, 4], sideFar: [118, 52, 22] });
  var canvas = pin.querySelector('.world'), still = pin.querySelector('.world-still');
  var matter = window.THREE ? window.HRMatter.create(canvas, { frozen: S.reduced }) : null;
  if (!matter) { canvas.hidden = true; still.hidden = false; }

  function placeOpen() {
    var b = wall.block;
    openEl.style.top = Math.round(b.y + b.h + Math.max(18, b.cap * 0.16)) + 'px';
  }
  placeOpen();
  var lastWall = '';
  S.onResize(function () { wall.layout(); placeOpen(); if (matter) matter.resize(); lastWall = ''; });

  // Passagens entre formas: [início, fim] em telas. A passagem j leva da forma j para a j + 1.
  var moves = [[I0 + 0.2, I0 + 1.1]];
  for (var i = 0; i < SEG.n; i++) moves.push([c(i) + 0.04, c(i) + 0.74]);

  // ---------- Trilho ----------
  railBtns.forEach(function (b, n) {
    b.addEventListener('click', function () { track.go((c(n) + SEG.ch * 0.66) / TOTAL); });
  });

  // ---------- Quadro a quadro ----------
  var through = false, lastActive = -2, seen = false;
  function set(el, opacity, y) {
    el.style.opacity = opacity < 0.004 ? 0 : opacity;
    el.style.visibility = opacity < 0.004 ? 'hidden' : 'visible';
    if (y !== undefined) el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
  }

  S.loop(function (t, dt) {
    var r = stage.getBoundingClientRect();
    var visible = r.bottom > 0 && r.top < window.innerHeight;
    var u = track.p * TOTAL;
    root.style.setProperty('--brand', seg(u, SEG.wall * 0.86, SEG.wall).toFixed(3));
    if (!visible && seen) return;
    seen = true;

    // Parede: atravessa pelo nome (ou só esmaece, se o visitante pediu menos movimento)
    var pw = clamp(u / SEG.wall, 0, 1), s = S.reduced ? 0 : window.HRWall.travel(pw, wall);
    var px = S.pointer.x, py = S.pointer.y;
    var key = (S.reduced ? pw.toFixed(4) : s.toFixed(5)) + '|' + (s < 0.35 ? px.toFixed(3) + '|' + py.toFixed(3) : '');
    if (key !== lastWall) {
      through = wall.render({ s: s, px: px, py: py });
      if (S.reduced) { through = pw > 0.8; wallEl.style.opacity = 1 - seg(pw, 0.25, 0.8); }
      wallEl.style.visibility = through ? 'hidden' : 'visible';
      lastWall = key;
    }
    set(openEl, 1 - seg(u, 0.03, 0.3));
    set(cueEl, 1 - seg(u, 0.02, 0.2));

    // Partículas: qual passagem está valendo e o quanto dela já andou
    if (matter) {
      var j = 0;
      while (j < moves.length - 1 && u >= moves[j + 1][0]) j++;
      var mix = seg(u, moves[j][0], moves[j][1]);
      var tall = window.innerWidth / window.innerHeight < 1;
      var settle = seg(u, I0 + 0.2, I0 + 1.1);
      matter.view.ox = tall ? 0 : 0.15 * settle;
      matter.view.oy = tall ? -0.13 * settle : 0;
      matter.view.dolly = seg(u, 0, SEG.wall) * 2.2 * (1 - settle);
      matter.frame(dt, j, mix, { x: px, y: py, k: S.pointer.touch ? 0 : 0.8 * S.pointer.active });
    }

    // Texto: frase de transição e capítulos
    set(introEl, S.window(u, I0 + 0.05, I0 + 0.35, I0 + 1.08, I0 + 1.34), (1 - seg(u, I0 + 0.05, I0 + 0.35)) * 26 - seg(u, I0 + 1.08, I0 + 1.34) * 26);
    var active = -1;
    chapters.forEach(function (ch, n) {
      var a = c(n), b = a + SEG.ch, last = n === chapters.length - 1;
      var o = last ? seg(u, a + 0.02, a + 0.24) : S.window(u, a + 0.02, a + 0.24, b - 0.2, b + 0.02);
      var y = (1 - seg(u, a + 0.02, a + 0.24)) * 30 - (last ? 0 : seg(u, b - 0.2, b + 0.02) * 30);
      set(ch, o, y);
      ch.classList.toggle('is-live', o > 0.6);
      if (u >= a - 0.05) active = n;
    });
    set(scrimEl, seg(u, I0 - 0.1, I0 + 0.3));
    set(rail, seg(u, C0 - 0.35, C0 - 0.05));
    if (active !== lastActive) {
      railBtns.forEach(function (b, n) {
        b.classList.toggle('is-on', n === active); b.classList.toggle('is-done', n < active);
        if (n === active) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      lastActive = active;
    }
  });

  // ---------- Copiar e-mail ----------
  var copyBtn = document.querySelector('.way__copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var pt = document.documentElement.lang === 'pt-BR';
    var label = copyBtn.textContent, done = pt ? copyBtn.dataset.ptDone : copyBtn.dataset.done;
    function ok() {
      copyBtn.textContent = done; copyBtn.classList.add('is-done');
      setTimeout(function () { copyBtn.textContent = label; copyBtn.classList.remove('is-done'); }, 1600);
    }
    function fallback() {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(document.querySelector('.way--mail .way__desc')); sel.removeAllRanges(); sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyBtn.dataset.copy).then(ok, fallback);
    else fallback();
  });
})();
