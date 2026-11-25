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
  // O tom de cada seção vale no meio dela e passa para o da próxima em volta da borda entre as duas (ZONE px para cada
  // lado). A passagem não é um degradê do navegador: num fundo escuro, o degradê sai em faixas, e o pontilhado que o
  // navegador põe para disfarçar aparece como granulado numa tela nítida. Aqui a página ganha uma tira (uma imagem de 1 px
  // de largura, uma linha a cada STEP px de página, esticada até a largura da tela) com a cor exata de cada trecho. Na
  // passagem, cada canal de cor muda um tom de cada vez e em pontos diferentes (ver quant): como os tons das seções só
  // diferem no vermelho e no azul, cada troca muda a luz em 1 a 2%, o que o olho não vê. Fica liso: sem faixa e sem grão.
  // A tira só é refeita quando a página muda de altura (trabalhos que carregam, abas da Workstation X). A barra do topo
  // pega a cor do que está embaixo dela, e a barra do navegador no celular (theme-color), a da seção da vez.
  var bar = document.querySelector('.bar'), themeMeta = document.querySelector('meta[name="theme-color"]'), stops = [], themeNow = '';
  var STEP = 8, PHASE = [0.17, 0.5, 0.83];     // os canais arredondam em pontos diferentes: nunca dois de uma vez
  function rgb(name) {
    var m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(getComputedStyle(root).getPropertyValue('--tone-' + name)) || [0, '14', '14', '14'];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function quant(c) { return [Math.floor(c[0] + PHASE[0]), Math.floor(c[1] + PHASE[1]), Math.floor(c[2] + PHASE[2])]; }
  function css(c) { return 'rgb(' + quant(c).join(',') + ')'; }
  var painted = '';
  function paint() {
    var secs = [{ y: 0, c: rgb('top') }].concat(parts.filter(Boolean).map(function (el) { return { y: el.getBoundingClientRect().top + window.scrollY, c: rgb(el.id) }; }));
    var ZONE = Math.max(240, Math.min(420, window.innerHeight * 0.4)), end = document.documentElement.scrollHeight;
    stops = [{ y: 0, c: secs[0].c }];
    for (var k = 1; k < secs.length; k++) {
      var z = Math.min(ZONE, (secs[k].y - secs[k - 1].y) / 2, ((secs[k + 1] ? secs[k + 1].y : end) - secs[k].y) / 2);
      stops.push({ y: secs[k].y - z, c: secs[k - 1].c }, { y: secs[k].y + z, c: secs[k].c });
    }
    stops.push({ y: end, c: secs[secs.length - 1].c });
    var rows = Math.max(1, Math.ceil(end / STEP)), cv = document.createElement('canvas'), ctx, img, i, c;
    cv.width = 1; cv.height = rows;
    ctx = cv.getContext('2d'); img = ctx.createImageData(1, rows);
    for (i = 0; i < rows; i++) { c = quant(colorAt((i + 0.5) * STEP)); img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    var url = cv.toDataURL('image/png'), size = '100% ' + rows * STEP + 'px';
    // só mexe no fundo quando algo mudou: trocar o fundo redesenha a página inteira
    if (url + size !== painted) {
      painted = url + size;
      var bs = document.body.style;
      bs.backgroundImage = 'url("' + url + '")'; bs.backgroundSize = size; bs.backgroundPosition = '0 0'; bs.backgroundRepeat = 'no-repeat';
    }
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
  function follow() {          // a barra (só o fundo dela) e o theme-color
    if (!stops.length) return;
    // a cor da linha da tira que está embaixo da barra: a mesma conta da tira, para emendar sem diferença
    var y = window.scrollY + (bar ? bar.offsetHeight : 0), c = colorAt((Math.floor(y / STEP) + 0.5) * STEP);
    if (bar) bar.style.setProperty('--bg', css(c));
    var mid = 'rgb(' + colorAt(window.scrollY + window.innerHeight / 2).map(function (v) { return Math.round(v / 4) * 4; }).join(',') + ')';
    if (themeMeta && mid !== themeNow) { themeNow = mid; themeMeta.setAttribute('content', mid); }
  }
  // a página mudando de altura sem parar (uma aba abrindo, por exemplo): a tira é refeita no máximo a cada 150 ms e uma
  // vez no fim. Cada troca do fundo redesenha a página inteira, e os tons são tão próximos que o atraso não aparece.
  var paintTimer = 0, paintLast = 0;
  function repaint() {
    var wait = Math.max(0, 150 - (performance.now() - paintLast));
    clearTimeout(paintTimer);
    paintTimer = setTimeout(function () { paintLast = performance.now(); paint(); }, wait);
  }
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
