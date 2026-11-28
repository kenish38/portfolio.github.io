// ===== Barra e abas =====
// A barra ganha fundo quando a página sai do topo. Nas abas, uma luz pequena marca a seção que está na tela;
// ela desliza de uma aba para a outra conforme a página rola (sem deslizar para quem pediu menos movimento: ver css).
// O título da abertura fica em js/title.js; a apresentação e os botões da janela, em js/show.js; o fundo da página (os
// tons das seções, as luzes e as sombras) e a cor da barra, em js/backdrop.js.
(function () {
  'use strict';
  var root = document.documentElement;
  var tabs = document.querySelector('.tabs'), glow = tabs.querySelector('.tabs__glow');
  var links = Array.prototype.slice.call(tabs.querySelectorAll('a'));
  var parts = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var current = null, queued = false, seen = null, glowX = null;

  // As medidas (onde está cada seção, a rolagem, o lugar da aba) são lidas no evento de rolagem, que vem antes dos
  // quadros, com o layout pronto; as escritas ficam para o quadro. Antes, o quadro media a aba depois de a cor da barra
  // mudar (js/backdrop.js) e lia a rolagem depois de mover a luz: a cada leitura, o navegador refazia o estilo na hora.
  // A seção da vez é a última cujo topo já passou de 40% da altura da tela. No fim da página vale a última aba.
  function measure() {
    var vh = window.innerHeight, sy = window.scrollY, line = vh * 0.4, i = 0;
    for (var n = 0; n < parts.length; n++) if (parts[n] && parts[n].getBoundingClientRect().top <= line) i = n;
    if (vh + sy >= document.documentElement.scrollHeight - 4) i = parts.length - 1;
    var a = links[i];      // o lugar da luz só é medido de novo quando a aba muda (ou o tamanho, o idioma, as fontes: again)
    return { i: i, x: i === current && glowX !== null ? glowX : a.offsetLeft + a.offsetWidth / 2, scrolled: sy > 12 };
  }
  function check() {
    queued = false;
    var m = seen || measure(); seen = null;
    if (m.i !== current) {
      current = m.i;
      links.forEach(function (a, n) { if (n === m.i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
    if (m.x !== glowX) { glowX = m.x; glow.style.transform = 'translateX(' + m.x + 'px)'; }
    root.classList.toggle('scrolled', m.scrolled);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(check); } }
  function again() { current = null; glowX = null; seen = null; queue(); }      // no próximo quadro, mede tudo de novo
  window.addEventListener('scroll', function () { seen = measure(); queue(); }, { passive: true });
  window.addEventListener('resize', again);
  document.addEventListener('langchange', again);   // os nomes das abas mudam de largura
  document.addEventListener('introdone', again);    // a barra aparece no fim da apresentação
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
  check();
})();
