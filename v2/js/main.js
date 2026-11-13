// ===== Roteiro da página =====
// A rolagem do palco é medida em "telas" (u). O filme tem esta ordem:
//   0 .. 1.5       a câmera atravessa a parede pelo nome
//   1.7 .. 2.6     o mar de luz assenta e vira a baseplate
//   2.95 .. 4.7    VELOCIDADE: a baseplate vira tabuleiro e as peças sobem
//   4.75 .. 6.62   QUALIDADE: close no cavalo; ele recua, salta, acerta o peão e o arremessa
//   6.64 .. 9.5    DIREÇÃO DE ARTE: o peão bate, o tabuleiro racha e estilhaça como espelho; a queda em
//                  câmera lenta entre os cacos; os "raios de sol" disparam: eram tiros, e um estilhaça o peão
//   9.6 .. 11.0    a câmera volta pela linha dos tiros até a arma, que para e fica de perfil
//   11.2 .. 13.1   PROGRAMAÇÃO: a arma é desmontada peça por peça e o script dela é escrito
//   13.15 .. 14.9  INTERFACE: o código vira a HUD de um jogo de tiro; o clique e a mensagem
//   14.95 em diante tela final; depois a página sobe por cima do filme
// "beats" são as passagens entre cenas (as cenas ficam em js/film-*.js).
// Depois que o visitante começa a rolar, o filme toca sozinho (ver "Reprodução automática").
// Ao mudar o fim do filme, ajuste TOTAL aqui e --len em css/site.css (os dois precisam bater).
(function () {
  'use strict';
  var S = window.HRScroll, clamp = S.clamp;
  var WALL = 1.5, TOTAL = 17.3;
  function seg(u, a, b) { return S.smooth(u, a, b); }

  // a, b: início e fim em telas | fx: papel de cada ponto | rig: movimento rígido dos grupos
  // ease: 'in' chega com velocidade, 'out' sai com velocidade, 'lin' constante (padrão: suave nas duas pontas)
  var beats = [
    { a: 1.7, b: 2.6, from: 'wave', to: 'plate', fx: 'settle', stagger: 1.2 },
    { a: 2.95, b: 3.5, from: 'plate', to: 'boardFlat', fx: 'sweep', stagger: 2 },
    { a: 3.6, b: 4.6, from: 'boardFlat', to: 'boardUp', fx: 'rise', turb: 0.5, stagger: 1.4 },
    { a: 4.75, b: 5.5, from: 'boardUp', to: 'boardClose', fx: 'still', turb: 0 },
    { a: 5.6, b: 5.85, from: 'boardClose', to: 'boardCoil', fx: 'rigid', rig: 'coil', stagger: 0, turb: 0 },
    { a: 5.87, b: 6.07, from: 'boardCoil', to: 'boardHit', fx: 'rigid', rig: 'hit', ease: 'in', stagger: 0, turb: 0 },
    { a: 6.09, b: 6.38, from: 'boardHit', to: 'boardThrow', fx: 'burst', rig: 'throw', ease: 'out', stagger: 0.3 },
    { a: 6.38, b: 6.62, from: 'boardThrow', to: 'boardSlam', fx: 'rigid', rig: 'slam', ease: 'in', stagger: 0, turb: 0.6 },
    { a: 6.64, b: 6.95, from: 'boardSlam', to: 'boardCrack', fx: 'cracks', rig: 'crack', ease: 'out', stagger: 1.5, turb: 0.5 },
    { a: 7.1, b: 7.8, from: 'boardCrack', to: 'boardShatter', fx: 'shatter', rig: 'shatter', ease: 'in', stagger: 1.1, turb: 0.8 },
    { a: 7.8, b: 7.95, from: 'boardShatter', to: 'shaftTop', cut: true },
    { a: 7.95, b: 9.0, from: 'shaftTop', to: 'shaftLow', fx: 'drift', rig: 'drift', ease: 'lin', stagger: 0, turb: 0, mark: 'shaft' },
    { a: 9.0, b: 9.1, from: 'shaftLow', to: 'shaftFire', fx: 'drift', rig: 'snap', ease: 'in', stagger: 0, turb: 0, mark: 'snap' },
    { a: 9.12, b: 9.5, from: 'shaftFire', to: 'shaftHit', fx: 'pawnHit', rig: 'pawnHit', ease: 'out', stagger: 0, turb: 0 },
    { a: 9.6, b: 10.3, from: 'shaftHit', to: 'gunFiring', fx: 'still', turb: 0 },
    { a: 10.5, b: 10.95, from: 'gunFiring', to: 'gunRest', fx: 'level', rig: 'level', stagger: 0.6 },
    { a: 11.2, b: 11.9, from: 'gunRest', to: 'gunExploded', fx: 'strip', ease: 'out', stagger: 2.5, turb: 0 },
    { a: 12.15, b: 12.85, from: 'gunExploded', to: 'code', fx: 'write', stagger: 1.6 },
    { a: 13.15, b: 13.85, from: 'code', to: 'hud', fx: 'toHud' },
    { a: 14.1, b: 14.6, from: 'hud', to: 'hudOn', fx: 'click', stagger: 1, turb: 0.6 },
    { a: 14.95, b: 15.75, from: 'hudOn', to: 'wave', turb: 1.2 }
  ];
  // Janela de cada cena: quando a palavra de fundo e a legenda aparecem e somem
  var scenes = [[3.0, 4.72], [4.78, 6.6], [6.68, 9.72], [11.2, 13.1], [13.25, 14.3]];
  var INTRO = [1.55, 2.9], END = 14.95, FINAL = 15.3, FILM_END = 16.3;
  // Impactos: clarão e tremor que nascem num instante e somem em "len" telas
  var hits = [{ u: 6.07, flash: 1.2, shake: 0.07, len: 0.1 }, { u: 6.62, flash: 0.8, shake: 0.05, len: 0.1 }, { u: 7.1, flash: 0.3, shake: 0.06, len: 0.3 }, { u: 9.1, flash: 1.4, shake: 0.08, len: 0.12 }];
  // Ritmo do filme automático: [de, até, velocidade]. Abaixo de 0.3 é uma parada no impacto.
  var PACE = [[5.6, 5.87, 0.7], [5.87, 6.07, 1.4], [6.07, 6.09, 0.15], [6.09, 6.17, 0.5], [6.38, 6.62, 1.2], [6.62, 6.64, 0.2], [6.95, 7.1, 0.6], [7.1, 7.8, 0.9],
    [7.95, 9.0, 0.6], [9.0, 9.1, 1.4], [9.1, 9.12, 0.15], [9.12, 9.35, 0.45], [9.6, 10.3, 1.2], [10.3, 10.5, 0.5], [11.0, 11.2, 0.6], [11.2, 11.9, 0.6],
    [11.9, 12.15, 0.5], [12.85, 13.15, 0.4], [13.85, 14.1, 0.6], [14.6, 14.95, 0.5]];
  function pace(u) { for (var i = 0; i < PACE.length; i++) if (u >= PACE[i][0] && u < PACE[i][1]) return PACE[i][2]; return 1; }

  var root = document.documentElement;
  var stage = document.querySelector('.stage'), pin = stage.querySelector('.stage__pin'), mainEl = document.querySelector('main');
  var wallEl = pin.querySelector('.wall'), openEl = pin.querySelector('.open'), cueEl = pin.querySelector('.cue');
  var introEl = pin.querySelector('.intro'), scrimEl = pin.querySelector('.scrim'), finalEl = pin.querySelector('.final');
  var wordsEl = pin.querySelector('.words'), words = [].slice.call(wordsEl.querySelectorAll('.word'));
  var sceneEls = [].slice.call(pin.querySelectorAll('.scene')), progressEl = pin.querySelector('.progress');
  var partsEl = pin.querySelector('.parts'), partEls = [].slice.call(partsEl.querySelectorAll('span'));
  var track = S.track(stage);

  // ---------- Parede e partículas ----------
  // Paleta: "perola" (branco e dourado). Para testar outra, abra a página com o nome no fim do endereço,
  // por exemplo #gelo, #aurora, #ouro ou #brasa (as paletas ficam em js/matter.js).
  var palettes = window.HRMatter.palettes, paletteName = 'perola';
  if (palettes[location.hash.slice(1)]) paletteName = location.hash.slice(1);
  // As laterais do recorte do nome pegam a cor da luz que vem de trás
  function wallColors(name) {
    var m = palettes[name].main;
    return {
      sideNear: [m[0][0] * 40, m[0][1] * 40, m[0][2] * 40],
      sideFar: [(m[1][0] + m[2][0]) * 44, (m[1][1] + m[2][1]) * 44, (m[1][2] + m[2][2]) * 44]
    };
  }
  var wall = window.HRWall.create(wallEl, wallColors(paletteName));
  var canvas = pin.querySelector('.world'), still = pin.querySelector('.world-still');
  var matter = window.THREE ? window.HRMatter.create(canvas, { frozen: S.reduced, palette: paletteName }) : null;
  if (matter) matter.setBeats(beats); else { canvas.hidden = true; still.hidden = false; }

  function placeOpen() {
    var b = wall.block;
    openEl.style.top = Math.round(b.y + b.h + Math.max(18, b.cap * 0.16)) + 'px';
  }
  // Palavras de fundo: ocupam a largura da tela; em telas em pé correm na vertical, junto à borda direita
  var tall = false;
  function fitWords() {
    var W = pin.clientWidth, H = window.innerHeight;
    tall = W / H < 0.8;
    wordsEl.classList.toggle('is-tall', tall);
    words.forEach(function (w) {
      w.style.fontSize = '100px';
      var byLen = 100 * (tall ? H * 0.58 / Math.max(1, w.offsetHeight) : W * 0.93 / Math.max(1, w.offsetWidth));
      var byBlock = tall ? W * 0.2 : 100 * H * 0.5 / Math.max(1, w.offsetHeight);
      w.style.fontSize = Math.min(byLen, byBlock).toFixed(1) + 'px';
    });
  }
  placeOpen(); fitWords();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWords);
  document.addEventListener('langchange', fitWords);
  var lastWall = '';
  S.onResize(function () { wall.layout(); placeOpen(); fitWords(); if (matter) matter.resize(); lastWall = ''; });

  // ---------- Reprodução automática ----------
  // Depois que o visitante começa a rolar, o filme segue sozinho. Rolar para trás (ou tocar em
  // Pausar) devolve o controle; rolar para a frente retoma. Quem pediu menos movimento rola à mão.
  var playBtn = pin.querySelector('.play'), skipEl = pin.querySelector('.skip-film');
  var auto = { on: false, y: 0, speed: 0.42 };       // velocidade em telas por segundo
  var AUTO_END = FINAL + 0.6;                        // o filme para sozinho na tela final
  function endY() { return track.top + (AUTO_END / TOTAL) * track.span; }
  function label() {
    var pt = document.documentElement.lang === 'pt-BR';
    playBtn.textContent = auto.on ? (pt ? 'Pausar' : 'Pause') : (pt ? 'Continuar' : 'Play');
    playBtn.setAttribute('aria-pressed', String(auto.on));
  }
  function play() {
    if (S.reduced || auto.on || window.scrollY >= endY() - 2) return;
    auto.on = true; auto.y = window.scrollY; root.style.scrollBehavior = 'auto'; label();
  }
  function pause() { if (!auto.on) return; auto.on = false; root.style.scrollBehavior = ''; label(); }
  window.addEventListener('wheel', function (e) { if (e.deltaY > 0) play(); else if (e.deltaY < 0) pause(); }, { passive: true });
  var touchY = null;
  window.addEventListener('touchstart', function (e) { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (touchY === null) return;
    var d = touchY - e.touches[0].clientY;
    if (d > 12) { play(); touchY = e.touches[0].clientY; } else if (d < -12) { pause(); touchY = e.touches[0].clientY; }
  }, { passive: true });
  window.addEventListener('keydown', function (e) {
    var tag = document.activeElement ? document.activeElement.tagName : '';
    if (/^(ArrowDown|PageDown| )$/.test(e.key) && !/^(INPUT|TEXTAREA|BUTTON|A)$/.test(tag)) play();
    else if (/^(ArrowUp|PageUp|Home|Escape)$/.test(e.key)) pause();
  });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a[href^="#"]')) pause(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  playBtn.addEventListener('click', function () { if (auto.on) pause(); else play(); });
  document.addEventListener('langchange', label);
  label();

  // ---------- Quadro a quadro ----------
  var through = false, seen = false;
  function set(el, opacity, transform) {
    el.style.opacity = opacity < 0.004 ? 0 : opacity;
    el.style.visibility = opacity < 0.004 ? 'hidden' : 'visible';
    if (transform !== undefined) el.style.transform = transform;
  }
  function up(px) { return 'translate3d(0,' + px.toFixed(1) + 'px,0)'; }

  S.loop(function (t, dt) {
    // Reprodução automática: avança a rolagem sozinha, no ritmo de cada trecho
    if (auto.on) {
      if (Math.abs(window.scrollY - auto.y) > 3) auto.y = window.scrollY;      // o visitante rolou junto: segue de onde ele está
      var here = (auto.y - track.top) / track.span * TOTAL;
      auto.y = Math.min(endY(), auto.y + auto.speed * pace(here) * window.innerHeight * dt);
      window.scrollTo(0, auto.y);
      if (auto.y >= endY() - 0.5) pause();
    }
    var r = stage.getBoundingClientRect();
    var visible = r.bottom > 0 && r.top < window.innerHeight;
    var u = track.p * TOTAL;
    root.style.setProperty('--brand', seg(u, WALL * 0.86, WALL).toFixed(3));
    // depois do filme a barra de navegação ganha fundo, para não imprimir por cima das seções
    root.classList.toggle('past-film', mainEl.getBoundingClientRect().top < 80);
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

    // Partículas, com o clarão e o tremor dos impactos
    if (matter) {
      var env = { flash: 0, shake: 0, ts: 1 };
      if (!S.reduced) for (var h = 0; h < hits.length; h++) {
        var k = (u - hits[h].u) / hits[h].len;
        if (k >= 0 && k < 1) { env.flash += hits[h].flash * (1 - k) * (1 - k); env.shake += hits[h].shake * (1 - k); }
      }
      if (auto.on && pace(u) < 0.3) env.ts = pace(u);     // na parada do impacto os tiros também param
      matter.view.settle = seg(u, 1.7, 2.6) * (1 - seg(u, END, END + 0.8));
      matter.view.dolly = seg(u, 0, WALL) * 2.2 * (1 - seg(u, 1.7, 2.6));
      matter.frame(dt, u, { x: px, y: py }, env);
    }

    // Frase de transição
    set(introEl, S.window(u, INTRO[0], INTRO[0] + 0.3, INTRO[1] - 0.28, INTRO[1]), up((1 - seg(u, INTRO[0], INTRO[0] + 0.3)) * 26 - seg(u, INTRO[1] - 0.28, INTRO[1]) * 26));

    // Palavra de fundo e legenda de cada cena. A palavra entra forte, como um letreiro, e recua para o
    // fundo enquanto a ação acontece; a legenda também baixa depois de lida.
    for (var i = 0; i < scenes.length; i++) {
      var a = scenes[i][0], b = scenes[i][1], o = S.window(u, a, a + 0.28, b - 0.24, b), kk = clamp((u - a) / (b - a), 0, 1) - 0.5;
      var drift = -kk * (tall ? window.innerHeight : pin.clientWidth) * 0.06;
      set(words[i], o * (0.17 + 0.83 * (1 - seg(u, a + 0.3, a + 0.8))), tall ? 'translate(-50%, -50%) translate3d(0,' + drift.toFixed(1) + 'px,0)' : 'translate(-50%, -50%) translate3d(' + drift.toFixed(1) + 'px,0,0)');
      set(sceneEls[i], o * (1 - 0.42 * seg(u, a + 0.9, a + 1.4)), up((1 - seg(u, a, a + 0.28)) * 26 - seg(u, b - 0.24, b) * 26));
    }

    // Etiquetas da vista explodida
    var lab = matter ? S.window(u, 11.75, 11.95, 12.1, 12.25) : 0;
    set(partsEl, lab);
    if (lab > 0.004) partEls.forEach(function (el) {
      var p = matter.project(el.dataset.part);
      if (p) el.style.transform = 'translate3d(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px,0) translate(-50%, -50%)';
    });

    // Tela final, faixas de cinema, véu de leitura, progresso e botões do filme
    var fin = seg(u, FINAL, FINAL + 0.3);
    set(finalEl, fin, up((1 - fin) * 30));
    var film = seg(u, 2.9, 3.3) * (1 - seg(u, END, END + 0.4));
    root.style.setProperty('--bars', film.toFixed(3));
    set(scrimEl, seg(u, WALL - 0.1, WALL + 0.3));
    set(progressEl, film);
    root.style.setProperty('--film', clamp((u - 3) / (END - 3), 0, 1).toFixed(4));
    var controls = S.reduced ? 0 : seg(u, 0.12, 0.4) * (1 - seg(u, AUTO_END - 0.5, AUTO_END - 0.1));
    set(playBtn, controls); set(skipEl, seg(u, 0.12, 0.4) * (1 - seg(u, AUTO_END - 0.5, AUTO_END - 0.1)));
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
    root.classList.toggle('no-work', !items || !items.length);
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
  render(null);
  if (window.fetch) fetch('portfolio.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (d) { items = d && d.items; render(items); }).catch(function () {});
  document.addEventListener('langchange', function () { render(items); });

  // ---------- Loja: o convite do Discord vem do arquivo que o bot do Notorious publica ----------
  var join = document.querySelector('.store__join');
  if (join && window.fetch) fetch('../notorious/store.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (d) {
    var inv = d && d.invite, url = inv && inv.url;
    if (typeof url !== 'string' || !/^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/.test(url)) return;
    if (inv.expiresAt && Date.parse(inv.expiresAt) < Date.now()) return;
    join.href = url; join.hidden = false;
  }).catch(function () {});

  // ---------- Copiar e-mail ----------
  var copyBtn = document.querySelector('.way__copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var pt = document.documentElement.lang === 'pt-BR';
    var text = copyBtn.textContent, done = pt ? copyBtn.dataset.ptDone : copyBtn.dataset.done;
    function ok() {
      copyBtn.textContent = done; copyBtn.classList.add('is-done');
      setTimeout(function () { copyBtn.textContent = text; copyBtn.classList.remove('is-done'); }, 1600);
    }
    function fallback() {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(document.querySelector('.way--mail .way__desc')); sel.removeAllRanges(); sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyBtn.dataset.copy).then(ok, fallback);
    else fallback();
  });
})();
