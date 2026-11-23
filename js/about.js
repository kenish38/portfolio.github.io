// ===== Sobre mim: a dock de programas =====
// Funciona como a dock de um computador:
// - ao aparecer na tela, os ícones entram um depois do outro e um brilho corre pela prateleira;
// - no computador, os ícones crescem sob o cursor e os vizinhos abrem espaço (nada se encosta); embaixo, a legenda com
//   o nome e o uso do programa desliza até o ícone da vez;
// - clicar "abre" o programa: o ícone quica, solta um anel de luz na cor dele e acende a bolinha embaixo;
// - tirar o mouse da dock apaga a legenda e as bolinhas, mesmo depois do clique. No toque, a legenda some sozinha depois
//   de alguns segundos ou ao tocar fora. Pelo teclado, a legenda segue o foco.
// Quem pediu menos movimento não vê a ampliação nem os pulos: só a luz muda.
(function () {
  'use strict';
  var dock = document.querySelector('.dock'), caption = document.querySelector('.dock__caption');
  if (!dock || !caption) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var apps = Array.prototype.slice.call(dock.querySelectorAll('.app'));
  var bodies = apps.map(function (a) { return a.querySelector('.app__body'); });
  var line = document.createElement('span');
  line.className = 'dock__line';
  caption.appendChild(line);

  var AMP = 0.55;          // quanto o ícone sob o cursor cresce (55%)
  var REACH = 2.6;         // até quantos ícones de distância o cursor ainda faz crescer
  var n = apps.length, cx = [], row = [], s = [], tx = [], base = 56, pitch = 66, oneRow = true;
  var mx = null, cur = -1, shown = false, capX = 0, lineW = 0, raf = 0, last = 0, hideTimer = 0;
  var dockW = 0, dockLeft = 0, capW = 0, glide = false;     // medidas guardadas (ler o layout a cada quadro deixaria tudo lento)
  for (var i = 0; i < n; i++) { s.push(1); tx.push(0); }

  // posições de repouso de cada ícone (as do layout, sem as transformações)
  function measure() {
    apps.forEach(function (a, i) { var li = a.parentNode; cx[i] = li.offsetLeft + li.offsetWidth / 2; row[i] = li.offsetTop; });
    base = apps[0].offsetWidth || 56;
    pitch = n > 1 ? cx[1] - cx[0] : base;
    oneRow = row.every(function (r) { return Math.abs(r - row[0]) < 2; });
    dockW = dock.offsetWidth; dockLeft = dock.getBoundingClientRect().left; capW = caption.offsetWidth;
    // a legenda só desliza quando a dock é uma fileira só (no celular ela fica centrada, embaixo das duas fileiras)
    glide = oneRow && !reduced && window.getComputedStyle(line).position === 'absolute';
    if (shown) lineW = line.offsetWidth;
    kick();
  }

  // ---------- O quadro: ampliação, espaço entre vizinhos, prateleira e legenda ----------
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0;
    var dt = last ? Math.min(64, t - last) : 16; last = t;
    var k = 1 - Math.exp(-dt / 60), busy = false, R = REACH * pitch, i;
    for (i = 0; i < n; i++) {
      var goal = 1;
      if (mx !== null && oneRow && !reduced) {
        var d = Math.abs(mx - cx[i]);
        if (d < R) goal = 1 + AMP * (Math.cos(Math.PI * d / R) + 1) / 2;
      }
      s[i] += (goal - s[i]) * k;
      if (Math.abs(goal - s[i]) < 0.0015) s[i] = goal; else busy = true;
    }
    // cada ícone empurra os vizinhos pela metade do que cresceu, e a fileira toda continua centrada
    var grow = 0, acc = 0;
    for (i = 0; i < n; i++) grow += base * (s[i] - 1);
    for (i = 0; i < n; i++) {
      var e = base * (s[i] - 1);
      tx[i] = acc + e / 2 - grow / 2;
      acc += e;
      apps[i].style.transform = s[i] === 1 && Math.abs(tx[i]) < 0.01 ? '' : 'translateX(' + tx[i].toFixed(2) + 'px) scale(' + s[i].toFixed(4) + ')';
      apps[i].style.setProperty('--k', ((s[i] - 1) / AMP).toFixed(3));
      apps[i].style.setProperty('--s', s[i].toFixed(4));
    }
    dock.style.setProperty('--grow', grow.toFixed(2) + 'px');
    // a legenda desliza até o ícone da vez, sem sair da largura da seção
    if (cur >= 0 && glide) {
      var goalX = cx[cur] + tx[cur] - dockW / 2;
      var room = Math.max(0, (capW - lineW) / 2);
      goalX = Math.max(-room, Math.min(room, goalX));
      capX += (goalX - capX) * (1 - Math.exp(-dt / 90));
      if (Math.abs(goalX - capX) < 0.3) capX = goalX; else busy = true;
      line.style.transform = 'translateX(calc(-50% + ' + capX.toFixed(1) + 'px))';
    } else line.style.transform = '';
    if (busy) kick(); else last = 0;
  }
  // ---------- A legenda ----------
  function text(i) {
    var tip = apps[i].querySelector('.app__tip');
    line.textContent = '';
    var b = document.createElement('b');
    b.textContent = tip.querySelector('b').textContent;
    line.appendChild(b);
    line.appendChild(document.createTextNode(' — ' + tip.querySelector('span').textContent));
    lineW = line.offsetWidth;
  }
  function show(i) {
    clearTimeout(hideTimer);
    if (i === cur && shown) return;
    var fresh = !shown;
    cur = i; shown = true;
    text(i);
    caption.classList.add('is-on');
    if (fresh && glide) {           // a primeira vez aparece direto embaixo do ícone; daí em diante, desliza
      var room = Math.max(0, (capW - lineW) / 2);
      capX = Math.max(-room, Math.min(room, cx[i] + tx[i] - dockW / 2));
    }
    if (!fresh && !reduced) line.animate([{ opacity: 0.25, translate: '0 5px' }, { opacity: 1, translate: '0 0' }], { duration: 220, easing: 'ease-out' });
    kick();
  }
  function hide() {
    clearTimeout(hideTimer);
    shown = false;
    caption.classList.remove('is-on');
    apps.forEach(function (a) { a.classList.remove('is-open'); });
  }

  // ---------- Abrir um programa: o pulo, o anel de luz e a bolinha ----------
  function launch(i) {
    var a = apps[i], body = bodies[i];
    a.classList.add('is-open');
    if (reduced) { body.animate([{ filter: 'brightness(1.5)' }, { filter: 'none' }], { duration: 600, easing: 'ease-out' }); return; }
    body.getAnimations().forEach(function (an) { an.cancel(); });
    body.animate([
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(0) scale(1.14, .84)', offset: 0.1, easing: 'cubic-bezier(.3, 0, .6, 1)' },
      { transform: 'translateY(-48%) scale(.92, 1.1)', offset: 0.36, easing: 'cubic-bezier(.4, 0, .9, .6)' },
      { transform: 'translateY(0) scale(1.1, .88)', offset: 0.54, easing: 'cubic-bezier(.2, .6, .4, 1)' },
      { transform: 'translateY(-17%) scale(.97, 1.04)', offset: 0.72, easing: 'cubic-bezier(.4, 0, .9, .6)' },
      { transform: 'translateY(0) scale(1.04, .96)', offset: 0.87, easing: 'ease-out' },
      { transform: 'translateY(0) scale(1, 1)' }
    ], { duration: 980 });
    var ring = document.createElement('span');
    ring.className = 'app__ring';
    a.appendChild(ring);
    ring.animate([{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.9)' }], { duration: 750, easing: 'cubic-bezier(.2, .7, .3, 1)' })
      .finished.then(function () { ring.remove(); }, function () { ring.remove(); });
  }

  // ---------- Mouse, toque e teclado ----------
  dock.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX - dockLeft;
    var a = e.target.closest && e.target.closest('.app');
    if (a) show(apps.indexOf(a));
    kick();
  });
  dock.addEventListener('pointerenter', function () { dockLeft = dock.getBoundingClientRect().left; });
  dock.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'mouse') return;          // no toque, o dedo "sai" ao levantar: aí quem apaga é o tempo
    mx = null;
    if (!dock.contains(document.activeElement) || !document.activeElement.matches(':focus-visible')) hide();
    kick();
  });
  apps.forEach(function (a, i) {
    a.addEventListener('click', function () {
      launch(i);
      show(i);
      if (mx === null && !a.matches(':focus-visible')) hideTimer = setTimeout(hide, 2800);   // toque: some sozinha
    });
    a.addEventListener('focus', function () { if (a.matches(':focus-visible')) show(i); });
  });
  dock.addEventListener('focusout', function (e) {
    if (mx === null && !dock.contains(e.relatedTarget)) hide();
  });
  // tocar fora da dock apaga a legenda
  document.addEventListener('pointerdown', function (e) { if (shown && mx === null && !dock.contains(e.target)) hide(); }, { passive: true });
  document.addEventListener('langchange', function () { if (shown) text(cur); measure(); });
  if (window.ResizeObserver) new ResizeObserver(measure).observe(dock);
  window.addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();

  // ---------- A entrada: na primeira vez que a dock aparece, os ícones chegam um depois do outro ----------
  if (!reduced && window.IntersectionObserver) {
    dock.classList.add('is-waiting');
    var seen = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      seen.disconnect();
      dock.classList.remove('is-waiting');
      bodies.forEach(function (b, i) {
        b.animate([
          { opacity: 0, transform: 'translateY(36px) scale(.45)' },
          { opacity: 1, transform: 'translateY(-9px) scale(1.08)', offset: 0.62 },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], { duration: 680, delay: 140 + i * 60, easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'backwards' });
      });
      setTimeout(function () { dock.classList.add('is-shine'); }, 140 + n * 60 + 300);
    }, { threshold: 0.4 });
    seen.observe(dock);
  }
})();
