// ===== Abertura: o nome selecionado =====
// O nome é um objeto selecionado no editor. A alça vermelha à direita da caixa estica e estreita o nome pelo eixo
// de largura da fonte (font-stretch, de 62% a 125%). Funciona com o mouse, com o dedo e com as setas do teclado
// (a alça é um controle deslizante). O valor aparece acima da caixa ("Largura 125%").
// Também liga a linha de baixo da barra de navegação quando a página sai do topo.
(function () {
  'use strict';
  var root = document.documentElement;

  // ---------- Barra: a linha de baixo aparece quando a página rola ----------
  var scrolled = null;
  function onScroll() { var s = window.scrollY > 8; if (s !== scrolled) { scrolled = s; root.classList.toggle('is-scrolled', s); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- A alça que estica o nome ----------
  var part = document.querySelector('.part');
  if (!part) return;
  var name = part.querySelector('.part__name'), handle = part.querySelector('.part__scale'), out = part.querySelector('.part__size b');
  // MIN: o limite estreito do eixo de largura da Archivo. O máximo é a largura com que o nome começa, que o CSS escolhe
  // para caber na tela (--stretch: 125% no computador, 100% no celular): a alça estreita o nome e o devolve até ali,
  // nunca além, para ele não sair da tela. SLOPE: quanto "Henrique" (a linha mais larga) cresce, em em, a cada 1% de
  // largura (medido: 2,72 em a 62% e 5,26 em a 125%). Assim a alça acompanha o ponteiro.
  var MIN = 62, SLOPE = 0.0403, max = 125, value = 125, touched = false, drag = null;
  var WORDS = { 'ultra-condensed': 50, 'extra-condensed': 62.5, condensed: 75, 'semi-condensed': 87.5, normal: 100, 'semi-expanded': 112.5, expanded: 125 };

  // a largura que o CSS dá ao nome, sem o ajuste do visitante
  function widest() {
    var keep = name.style.fontStretch; name.style.fontStretch = '';
    var css = getComputedStyle(name).fontStretch, v = parseFloat(css);
    name.style.fontStretch = keep;
    return Math.round(isNaN(v) ? WORDS[css] || 100 : v);
  }
  function show() {
    handle.setAttribute('aria-valuemax', max);
    handle.setAttribute('aria-valuenow', value);
    handle.setAttribute('aria-valuetext', value + '%');
    out.textContent = value + '%';
  }
  function set(v) {
    value = Math.round(Math.min(max, Math.max(MIN, v))); touched = true;
    name.style.fontStretch = value + '%';
    show();
  }
  // a tela mudou de tamanho (o celular girou): o máximo pode mudar; sem ajuste do visitante, o nome segue o CSS
  function fit() {
    max = widest();
    if (!touched) value = max;
    else if (value > max) { value = max; name.style.fontStretch = value + '%'; }
    show();
  }
  fit();
  window.addEventListener('resize', fit);

  handle.addEventListener('pointerdown', function (e) {
    if (e.button) return;                       // só o botão principal (ou o dedo)
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, v: value, size: parseFloat(getComputedStyle(name).fontSize) };
    part.classList.add('is-dragging');
  });
  handle.addEventListener('pointermove', function (e) {
    if (drag) set(drag.v + (e.clientX - drag.x) / drag.size / SLOPE);
  });
  function end() { if (drag) { drag = null; part.classList.remove('is-dragging'); } }
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  handle.addEventListener('lostpointercapture', end);

  // teclado: setas de 3 em 3, Page Up/Down de 10 em 10, Home e End vão aos limites
  handle.addEventListener('keydown', function (e) {
    var k = e.key, step = { ArrowRight: 3, ArrowUp: 3, ArrowLeft: -3, ArrowDown: -3, PageUp: 10, PageDown: -10 }[k];
    if (k === 'Home') set(MIN);
    else if (k === 'End') set(max);
    else if (step) set(value + step);
    else return;
    e.preventDefault();
  });
})();
