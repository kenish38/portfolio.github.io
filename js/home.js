// ===== Barra e abas =====
// A barra ganha fundo quando a página sai do topo. Nas abas, uma luz pequena marca a seção que está na tela;
// ela desliza de uma aba para a outra conforme a página rola (sem deslizar para quem pediu menos movimento: ver css).
// O título da abertura fica em js/title.js; a apresentação e os botões da janela, em js/show.js.
(function () {
  'use strict';
  var root = document.documentElement;
  var tabs = document.querySelector('.tabs'), glow = tabs.querySelector('.tabs__glow');
  var links = Array.prototype.slice.call(tabs.querySelectorAll('a'));
  var parts = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var current = null, queued = false;

  function mark(i) {
    if (i === current) { place(); return; }
    current = i;
    links.forEach(function (a, n) { if (n === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    place();
  }
  function place() {
    var a = links[current];
    glow.style.transform = 'translateX(' + (a.offsetLeft + a.offsetWidth / 2) + 'px)';
  }
  // ---------- O fundo de cada seção (css: "O fundo de cada seção") ----------
  // Um degradê no fundo da página: o tom de cada seção vale no meio dela e passa para o da próxima em volta da borda
  // entre as duas (ZONE px para cada lado). A cor segue a rolagem sem nada animar: só o degradê é refeito quando a página
  // muda de altura (trabalhos que carregam, abas da Workstation X). A barra do topo pega a cor do que está embaixo dela, e
  // a barra do navegador no celular (theme-color), a da seção da vez.
  var bar = document.querySelector('.bar'), themeMeta = document.querySelector('meta[name="theme-color"]'), stops = [], themeNow = '';
  function rgb(name) {
    var m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(getComputedStyle(root).getPropertyValue('--tone-' + name)) || [0, '14', '14', '14'];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function css(c) { return 'rgb(' + c.map(Math.round).join(',') + ')'; }
  function paint() {
    var secs = [{ y: 0, c: rgb('top') }].concat(parts.filter(Boolean).map(function (el) { return { y: el.getBoundingClientRect().top + window.scrollY, c: rgb(el.id) }; }));
    var ZONE = Math.max(240, Math.min(420, window.innerHeight * 0.4)), end = document.documentElement.scrollHeight;
    stops = [{ y: 0, c: secs[0].c }];
    for (var k = 1; k < secs.length; k++) {
      var z = Math.min(ZONE, (secs[k].y - secs[k - 1].y) / 2, ((secs[k + 1] ? secs[k + 1].y : end) - secs[k].y) / 2);
      stops.push({ y: secs[k].y - z, c: secs[k - 1].c }, { y: secs[k].y + z, c: secs[k].c });
    }
    stops.push({ y: end, c: secs[secs.length - 1].c });
    // As camadas do fundo, de cima para baixo: a granulação (--grain), a luz de cada seção e o degradê dos tons.
    // A luz (css: "A luz de cada seção") vai somada ao degradê ("screen") e é um degradê opaco da cor dela até o preto:
    // assim o navegador pontilha a luz inteira e ela sai lisa, onde a luz translúcida de antes saía em faixas.
    // O "screen" soma s·(1 − fundo); para dar a cor da luz translúcida (a·luz + (1 − a)·tom), s = a·(luz − tom)/(1 − tom).
    var grain = getComputedStyle(root).getPropertyValue('--grain').trim(), layers = [];
    if (grain) layers.push({ img: grain, size: 'auto', at: '0 0', rep: 'repeat', mode: 'normal' });
    parts.forEach(function (el) {
      var cs = el && getComputedStyle(el), shape = cs ? cs.getPropertyValue('--light').trim() : '';
      if (!shape) return;
      var c = cs.getPropertyValue('--light-rgb').trim().split(/\s+/).map(Number), a = parseFloat(cs.getPropertyValue('--light-a')) || 0;
      var t = rgb(el.id), r = el.getBoundingClientRect();
      var s = [0, 1, 2].map(function (j) { return Math.max(0, a * (c[j] - t[j]) / (255 - t[j]) * 255); });
      // do centro (a cor cheia) até 70% do raio (preto): apaga em curva (um cosseno, em 8 passos), sem a linha que uma
      // queda reta deixava onde a luz acaba
      var ramp = [];
      for (var i = 0; i <= 8; i++) {
        var f = 0.5 + 0.5 * Math.cos(Math.PI * i / 8);
        ramp.push('rgb(' + s.map(function (v) { return (v * f).toFixed(2); }).join(' ') + ') ' + (70 * i / 8) + '%');
      }
      layers.push({ img: 'radial-gradient(' + shape + ', ' + ramp.join(', ') + ')', size: Math.round(r.width) + 'px ' + Math.round(r.height) + 'px',
        at: Math.round(r.left + window.scrollX) + 'px ' + Math.round(r.top + window.scrollY) + 'px', rep: 'no-repeat', mode: 'screen' });
    });
    layers.push({ img: 'linear-gradient(to bottom, ' + stops.map(function (s) { return css(s.c) + ' ' + Math.round(s.y) + 'px'; }).join(', ') + ')', size: '100% ' + end + 'px', at: '0 0', rep: 'no-repeat', mode: 'normal' });
    var bs = document.body.style, list = function (k) { return layers.map(function (l) { return l[k]; }).join(', '); };
    bs.backgroundImage = list('img'); bs.backgroundSize = list('size'); bs.backgroundPosition = list('at');
    bs.backgroundRepeat = list('rep'); bs.backgroundBlendMode = list('mode');
    root.classList.add('lit');         // as seções largam a luz delas (que agora está no fundo da página)
    follow();
  }
  function colorAt(y) {
    for (var i = 1; i < stops.length; i++) {
      if (y <= stops[i].y) {
        var a = stops[i - 1], b = stops[i], t = b.y > a.y ? Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y))) : 1;
        return [0, 1, 2].map(function (j) { return a.c[j] + (b.c[j] - a.c[j]) * t; });
      }
    }
    return stops.length ? stops[stops.length - 1].c : [20, 20, 20];
  }
  function follow() {          // a barra (só o fundo dela, quando a página saiu do topo) e o theme-color
    if (!stops.length) return;
    var c = colorAt(window.scrollY + (bar ? bar.offsetHeight : 0));
    if (bar) bar.style.setProperty('--bg', css(c));
    var mid = css(colorAt(window.scrollY + window.innerHeight / 2).map(function (v) { return Math.round(v / 4) * 4; }));
    if (themeMeta && mid !== themeNow) { themeNow = mid; themeMeta.setAttribute('content', mid); }
  }
  var paintQueued = false;
  function repaint() { if (!paintQueued) { paintQueued = true; requestAnimationFrame(function () { paintQueued = false; paint(); }); } }
  if (window.ResizeObserver) new ResizeObserver(repaint).observe(document.body);
  window.addEventListener('load', repaint);
  // A seção da vez é a última cujo topo já passou de 40% da altura da tela. No fim da página vale a última aba.
  function check() {
    queued = false;
    var y = window.innerHeight * 0.4, i = 0;
    for (var n = 0; n < parts.length; n++) if (parts[n] && parts[n].getBoundingClientRect().top <= y) i = n;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = parts.length - 1;
    mark(i);
    follow();
    root.classList.toggle('scrolled', window.scrollY > 12);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(check); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', function () { current = null; queue(); });
  document.addEventListener('langchange', function () { current = null; queue(); });   // os nomes das abas mudam de largura
  document.addEventListener('introdone', function () { current = null; queue(); });    // a barra aparece no fim da apresentação
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { current = null; queue(); });
  check();
})();
