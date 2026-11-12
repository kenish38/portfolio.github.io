// ===== Roteiro da página =====
// A rolagem do palco é medida em "telas" (u). O filme tem esta ordem:
//   0 .. 1.5       a câmera atravessa a parede pelo nome
//   1.7 .. 2.6     o mar de brasa assenta e vira a baseplate
//   3.0 .. 5.0     VELOCIDADE: a baseplate vira tabuleiro e as peças sobem
//   5.05 .. 7.75   QUALIDADE: close no cavalo, a captura e o peão caindo
//   8.0 .. 9.2     DIREÇÃO DE ARTE: o peão cai por um poço de raios de sol
//   9.3 .. 12.4    PROGRAMAÇÃO: os raios viram tiros que estilhaçam o peão, o caça
//                  chega voando e o código se monta enquanto ele segue em frente
//   12.1 .. 14.4   INTERFACE: a câmera alcança o caça, entra na cabine e clica no painel
//   14.5 em diante tela final
// "beats" são as passagens entre cenas (as cenas ficam em js/matter.js).
// Ao mudar o fim do filme, ajuste TOTAL aqui e --len em css/site.css.
(function () {
  'use strict';
  var S = window.HRScroll, clamp = S.clamp;
  var WALL = 1.5, TOTAL = 15.8;
  function seg(u, a, b) { return S.smooth(u, a, b); }

  // a, b: início e fim em telas; fx: papel de cada ponto (ver FX em matter.js)
  var beats = [
    { a: 1.7, b: 2.6, from: 'wave', to: 'plate', turb: 0.7 },
    { a: 3.0, b: 3.6, from: 'plate', to: 'boardFlat', fx: 'calm', turb: 0.6 },
    { a: 3.7, b: 4.75, from: 'boardFlat', to: 'boardUp', fx: 'rise', turb: 0.5, stagger: 1.4 },
    { a: 5.05, b: 5.85, from: 'boardUp', to: 'boardClose', fx: 'still', turb: 0 },
    { a: 6.05, b: 6.85, from: 'boardClose', to: 'boardCap', fx: 'capture', turb: 0.8, stagger: 1, arc: 1.15 },
    { a: 7.05, b: 7.75, from: 'boardCap', to: 'boardFall', fx: 'fall', turb: 0.8, stagger: 0.6 },
    { a: 7.75, b: 8.0, from: 'boardFall', to: 'shaftTop', cut: true },
    { a: 8.0, b: 9.15, from: 'shaftTop', to: 'shaftLow', fx: 'still', turb: 0 },
    { a: 9.3, b: 10.0, from: 'shaftLow', to: 'blast', fx: 'shots', turb: 1.2, stagger: 1 },
    { a: 10.05, b: 10.8, from: 'blast', to: 'ship', fx: 'still', turb: 0 },
    { a: 11.1, b: 11.8, from: 'ship', to: 'code', fx: 'toCode', turb: 1.3 },
    { a: 12.1, b: 12.65, from: 'code', to: 'approach', fx: 'still', turb: 0 },
    { a: 12.65, b: 13.25, from: 'approach', to: 'cockpit', turb: 1.2 },
    { a: 13.6, b: 14.2, from: 'cockpit', to: 'cockpitOn', fx: 'click', turb: 0.6, stagger: 1 },
    { a: 14.5, b: 15.3, from: 'cockpitOn', to: 'wave', turb: 1.2 }
  ];
  // Janela de cada cena: quando a palavra de fundo e a legenda aparecem e somem
  var scenes = [[3.0, 5.0], [5.05, 7.72], [7.98, 9.25], [9.35, 12.4], [12.75, 14.42]];
  var INTRO = [1.55, 2.95], END = 14.5, FINAL = 14.85;

  var root = document.documentElement;
  var stage = document.querySelector('.stage'), pin = stage.querySelector('.stage__pin');
  var wallEl = pin.querySelector('.wall'), openEl = pin.querySelector('.open'), cueEl = pin.querySelector('.cue');
  var introEl = pin.querySelector('.intro'), scrimEl = pin.querySelector('.scrim'), finalEl = pin.querySelector('.final');
  var wordsEl = pin.querySelector('.words'), words = [].slice.call(wordsEl.querySelectorAll('.word'));
  var sceneEls = [].slice.call(pin.querySelectorAll('.scene')), progressEl = pin.querySelector('.progress');
  var track = S.track(stage);

  // ---------- Parede e partículas ----------
  var wall = window.HRWall.create(wallEl, { sideNear: [10, 5, 4], sideFar: [118, 52, 22] });
  var canvas = pin.querySelector('.world'), still = pin.querySelector('.world-still');
  var matter = window.THREE ? window.HRMatter.create(canvas, { frozen: S.reduced }) : null;
  if (matter) matter.setBeats(beats); else { canvas.hidden = true; still.hidden = false; }

  function placeOpen() {
    var b = wall.block;
    openEl.style.top = Math.round(b.y + b.h + Math.max(18, b.cap * 0.16)) + 'px';
  }
  // Palavras de fundo: ocupam a largura da tela (ou a altura, em telas em pé)
  var tall = false;
  function fitWords() {
    var W = pin.clientWidth, H = window.innerHeight;
    tall = W / H < 0.8;
    wordsEl.classList.toggle('is-tall', tall);
    words.forEach(function (w) {
      w.style.fontSize = '100px';
      var len = tall ? w.offsetHeight : w.offsetWidth;
      var size = 100 * (tall ? H * 0.74 : W * 0.93) / Math.max(1, len);
      w.style.fontSize = Math.min(size, tall ? W * 0.4 / 0.8 : H * 0.42 / 0.8).toFixed(1) + 'px';
    });
  }
  placeOpen(); fitWords();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWords);
  document.addEventListener('langchange', fitWords);
  var lastWall = '';
  S.onResize(function () { wall.layout(); placeOpen(); fitWords(); if (matter) matter.resize(); lastWall = ''; });

  // ---------- Quadro a quadro ----------
  var through = false, seen = false;
  function set(el, opacity, transform) {
    el.style.opacity = opacity < 0.004 ? 0 : opacity;
    el.style.visibility = opacity < 0.004 ? 'hidden' : 'visible';
    if (transform !== undefined) el.style.transform = transform;
  }
  function up(px) { return 'translate3d(0,' + px.toFixed(1) + 'px,0)'; }

  S.loop(function (t, dt) {
    var r = stage.getBoundingClientRect();
    var visible = r.bottom > 0 && r.top < window.innerHeight;
    var u = track.p * TOTAL;
    root.style.setProperty('--brand', seg(u, WALL * 0.86, WALL).toFixed(3));
    if (!visible && seen) return;
    seen = true;

    // Parede: atravessa pelo nome (ou só esmaece, se o visitante pediu menos movimento)
    var pw = clamp(u / WALL, 0, 1), s = S.reduced ? 0 : window.HRWall.travel(pw, wall);
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

    // Partículas
    if (matter) {
      var settle = seg(u, 1.7, 2.6) * (1 - seg(u, END, END + 0.8));
      matter.view.settle = settle;
      matter.view.dolly = seg(u, 0, WALL) * 2.2 * (1 - seg(u, 1.7, 2.6));
      matter.frame(dt, u, { x: px, y: py, k: S.pointer.touch ? 0 : 0.8 * S.pointer.active });
    }

    // Frase de transição
    set(introEl, S.window(u, INTRO[0], INTRO[0] + 0.3, INTRO[1] - 0.28, INTRO[1]), up((1 - seg(u, INTRO[0], INTRO[0] + 0.3)) * 26 - seg(u, INTRO[1] - 0.28, INTRO[1]) * 26));

    // Palavra de fundo e legenda de cada cena
    for (var i = 0; i < scenes.length; i++) {
      var a = scenes[i][0], b = scenes[i][1], o = S.window(u, a, a + 0.28, b - 0.24, b), k = clamp((u - a) / (b - a), 0, 1) - 0.5;
      var drift = -k * (tall ? window.innerHeight : pin.clientWidth) * 0.07;
      set(words[i], o, tall ? 'translate(-50%, -50%) translate3d(0,' + drift.toFixed(1) + 'px,0)' : 'translate(-50%, -50%) translate3d(' + drift.toFixed(1) + 'px,0,0)');
      set(sceneEls[i], o, up((1 - seg(u, a, a + 0.28)) * 26 - seg(u, b - 0.24, b) * 26));
    }

    // Tela final, faixas de cinema, véu de leitura e progresso
    var fin = seg(u, FINAL, FINAL + 0.3);
    set(finalEl, fin, up((1 - fin) * 30));
    root.style.setProperty('--bars', (seg(u, 2.9, 3.3) * (1 - seg(u, END, END + 0.4))).toFixed(3));
    set(scrimEl, seg(u, WALL - 0.1, WALL + 0.3));
    set(progressEl, seg(u, 2.9, 3.3) * (1 - seg(u, END, END + 0.4)));
    root.style.setProperty('--film', clamp((u - 3) / (END - 3), 0, 1).toFixed(4));
  });

  // ---------- Portfólio: imagens e vídeos de portfolio.json ----------
  var list = document.querySelector('.media'), box = document.querySelector('.lightbox'), boxStage = box.querySelector('.lightbox__stage');
  function open(item) {
    boxStage.textContent = '';
    var el = document.createElement(item.type === 'video' ? 'video' : 'img');
    el.src = item.src;
    if (item.type === 'video') { el.controls = true; el.autoplay = true; el.playsInline = true; }
    else el.alt = item.title || '';
    boxStage.appendChild(el);
    if (box.showModal) box.showModal();
  }
  function close() { boxStage.textContent = ''; if (box.open) box.close(); }
  box.querySelector('.lightbox__close').addEventListener('click', close);
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  box.addEventListener('close', function () { boxStage.textContent = ''; });
  function title(item) { return document.documentElement.lang === 'pt-BR' && item.title_pt ? item.title_pt : (item.title || ''); }
  function render(items) {
    if (!items || !items.length) return;      // sem itens, ficam os espaços em planta
    list.textContent = '';
    items.forEach(function (item) {
      var li = document.createElement('li'), btn = document.createElement('button'), cap = document.createElement('span'), m;
      li.className = 'item' + (item.type === 'video' ? ' item--video' : '');
      btn.type = 'button'; btn.className = 'item__open';
      if (item.type === 'video' && !item.poster) { m = document.createElement('video'); m.src = item.src; m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
      else { m = document.createElement('img'); m.src = item.poster || item.src; m.loading = 'lazy'; m.alt = title(item); }
      btn.appendChild(m); btn.addEventListener('click', function () { open(item); });
      cap.className = 'item__title'; cap.textContent = title(item);
      li.appendChild(btn); if (cap.textContent) li.appendChild(cap);
      list.appendChild(li);
    });
  }
  var items = null;
  if (window.fetch) fetch('portfolio.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (d) { items = d && d.items; render(items); }).catch(function () {});
  document.addEventListener('langchange', function () { render(items); });

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
