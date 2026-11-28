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
  var rows = [], rowOf = [], activeRow = 0, touchId = null;      // as fileiras (no celular são duas) e a do dedo ou do cursor
  var mx = null, cur = -1, shown = false, capX = 0, lineW = 0, raf = 0, last = 0, hideTimer = 0;
  var dockW = 0, dockLeft = 0, capW = 0, glide = false;     // medidas guardadas (ler o layout a cada quadro deixaria tudo lento)
  var spare = 0, amp = AMP;      // quanto a dock ainda pode alargar dentro da seção, e a ampliação de agora
  for (var i = 0; i < n; i++) { s.push(1); tx.push(0); }

  // posições de repouso de cada ícone (as do layout, sem as transformações)
  function measure() {
    apps.forEach(function (a, i) { var li = a.parentNode; cx[i] = li.offsetLeft + li.offsetWidth / 2; row[i] = li.offsetTop; });
    base = apps[0].offsetWidth || 56;
    pitch = n > 1 ? cx[1] - cx[0] : base;
    oneRow = row.every(function (r) { return Math.abs(r - row[0]) < 2; });
    rows = [];
    row.forEach(function (r, i) {
      var k = 0;
      while (k < rows.length && Math.abs(rows[k].y - r) >= 2) k++;
      if (k === rows.length) rows.push({ y: r, idx: [] });
      rows[k].idx.push(i); rowOf[i] = k;
    });
    dockW = dock.offsetWidth; dockLeft = dock.getBoundingClientRect().left; capW = caption.offsetWidth;
    // No celular e no tablet a dock já ocupa quase a largura toda: sem espaço dos lados, os vizinhos não são empurrados
    // (eles sairiam da tela) e os ícones crescem no lugar, um pouco menos, por cima uns dos outros, como uma lupa.
    spare = Math.max(0, dock.parentNode.clientWidth - dockW - 8);
    amp = spare < base * 1.5 ? 0.4 : AMP;
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
      // só a fileira do cursor (ou do dedo) cresce; com uma fileira só, é sempre ela
      if (mx !== null && !reduced && rowOf[i] === activeRow) {
        var d = Math.abs(mx - cx[i]);
        if (d < R) goal = 1 + amp * (Math.cos(Math.PI * d / R) + 1) / 2;
      }
      s[i] += (goal - s[i]) * k;
      if (Math.abs(goal - s[i]) < 0.0015) s[i] = goal; else busy = true;
    }
    // cada ícone empurra os vizinhos da fileira dele pela metade do que cresceu, e a fileira continua centrada; o que não
    // cabe dos lados (spare) fica sem empurrar, e o ícone maior passa por cima dos vizinhos
    var most = 0;
    rows.forEach(function (rw) {
      var grow = 0, acc = 0;
      rw.idx.forEach(function (j) { grow += base * (s[j] - 1); });
      var fit = grow > spare ? spare / grow : 1;
      rw.idx.forEach(function (j) {
        var e = base * (s[j] - 1) * fit;
        tx[j] = acc + e / 2 - grow * fit / 2;
        acc += e;
        apps[j].style.transform = s[j] === 1 && Math.abs(tx[j]) < 0.01 ? '' : 'translateX(' + tx[j].toFixed(2) + 'px) scale(' + s[j].toFixed(4) + ')';
        apps[j].style.zIndex = s[j] > 1.005 ? String(100 + Math.round((s[j] - 1) * 100)) : '';
        apps[j].style.setProperty('--k', ((s[j] - 1) / amp).toFixed(3));
        apps[j].style.setProperty('--s', s[j].toFixed(4));
      });
      most = Math.max(most, grow * fit);
    });
    dock.style.setProperty('--grow', most.toFixed(2) + 'px');
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
  // a fileira mais perto da altura do ponteiro (no celular, a dock tem duas)
  function rowAt(clientY) {
    var y = clientY - dock.getBoundingClientRect().top, best = 0, bd = Infinity;
    rows.forEach(function (rw, k) { var d = Math.abs(rw.y + base / 2 - y); if (d < bd) { bd = d; best = k; } });
    return best;
  }
  dock.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX - dockLeft; activeRow = rowAt(e.clientY);
    var a = e.target.closest && e.target.closest('.app');
    if (a) show(apps.indexOf(a));
    kick();
  });
  // No toque: o dedo que desliza de lado faz os ícones crescerem como o mouse, e a legenda acompanha o ícone embaixo do
  // dedo. Ao soltar, os ícones voltam e a legenda some sozinha depois de alguns segundos. De cima para baixo, o dedo rola
  // a página (touch-action: pan-y, no CSS) e a ampliação desfaz.
  function follow(e) {
    var r = dock.getBoundingClientRect();
    dockLeft = r.left; mx = e.clientX - r.left; activeRow = rowAt(e.clientY);
    var el = document.elementFromPoint(e.clientX, e.clientY), a = el && el.closest && el.closest('.app');
    if (a && dock.contains(a)) show(apps.indexOf(a));
    kick();
  }
  function letGo(e) {
    if (touchId === null || e.pointerId !== touchId) return;
    touchId = null; mx = null; kick();
    clearTimeout(hideTimer); hideTimer = setTimeout(hide, 2800);
  }
  dock.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' || reduced) return;
    touchId = e.pointerId; follow(e);
  });
  dock.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse' && e.pointerId === touchId) follow(e); });
  dock.addEventListener('pointerup', letGo);
  dock.addEventListener('pointercancel', letGo);
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
