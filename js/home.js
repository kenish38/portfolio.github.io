// ===== Abertura, barra e abas =====
// Na abertura, enquanto a janela fica parada, a rolagem risca o título linha por linha e acende a segunda frase no
// lugar dele. A barra ganha fundo quando a página sai do topo. Nas abas, uma luz pequena marca a seção que está na
// tela; ela desliza de uma aba para a outra conforme a página rola (sem deslizar para quem pediu menos movimento: ver css).
(function () {
  'use strict';
  var root = document.documentElement;
  var tabs = document.querySelector('.tabs'), glow = tabs.querySelector('.tabs__glow');
  var links = Array.prototype.slice.call(tabs.querySelectorAll('a'));
  var parts = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var current = null, queued = false;
  var hero = document.querySelector('.hero'), stage = hero.querySelector('.hero__stage');

  // ---------- Título riscado ----------
  // p: quanto do trecho preso da abertura já foi rolado (0 a 1). Cada etapa ocupa uma parte dele:
  //   risco da linha 1 (0,02 a 0,30), risco da linha 2 (0,22 a 0,50), a primeira frase apaga (0,55 a 0,72),
  //   a segunda acende (0,64 a 0,86). A seta some logo no começo. O css lê os valores em --s1, --s2, --old, --new e --arrow.
  function seg(p, a, b) { var t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); }
  function title() {
    var run = hero.offsetHeight - stage.offsetHeight;
    var p = run > 0 ? Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / run)) : 0;
    var st = hero.style;
    st.setProperty('--s1', seg(p, 0.02, 0.3).toFixed(4));
    st.setProperty('--s2', seg(p, 0.22, 0.5).toFixed(4));
    st.setProperty('--old', (1 - seg(p, 0.55, 0.72)).toFixed(4));
    st.setProperty('--new', seg(p, 0.64, 0.86).toFixed(4));
    st.setProperty('--arrow', (1 - seg(p, 0, 0.12)).toFixed(4));
  }

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
    title();
    root.classList.toggle('scrolled', window.scrollY > 12);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(check); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', function () { current = null; queue(); });
  document.addEventListener('langchange', function () { current = null; queue(); });   // os nomes das abas mudam de largura
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { current = null; queue(); });
  check();
})();
