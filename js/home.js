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
  // O clima do fundo (css: "O fundo de cada seção"): o tom da seção que já chegou ao meio da tela; na abertura, o neutro.
  // A cor da barra do navegador no celular (theme-color) acompanha.
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function tone(name) {
    if (root.dataset.tone === name) return;
    root.dataset.tone = name;
    if (themeMeta) themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--tone').trim() || '#141414');
  }
  // A seção da vez é a última cujo topo já passou de 40% da altura da tela. No fim da página vale a última aba.
  function check() {
    queued = false;
    var y = window.innerHeight * 0.4, mid = window.innerHeight * 0.5, i = 0, t = 'top', end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    for (var n = 0; n < parts.length; n++) {
      if (!parts[n]) continue;
      var top = parts[n].getBoundingClientRect().top;
      if (top <= y) i = n;
      if (top <= mid) t = parts[n].id;
    }
    if (end) { i = parts.length - 1; t = parts[i] ? parts[i].id : t; }
    mark(i);
    tone(t);
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
