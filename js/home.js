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
  // A seção da vez é a última cujo topo já passou de 40% da altura da tela. No fim da página vale a última aba.
  function check() {
    queued = false;
    var y = window.innerHeight * 0.4, i = 0;
    for (var n = 0; n < parts.length; n++) if (parts[n] && parts[n].getBoundingClientRect().top <= y) i = n;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = parts.length - 1;
    mark(i);
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
