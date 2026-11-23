// ===== O título que se risca =====
// No primeiro movimento de rolagem para baixo, uma linha de luz risca cada linha do título (do jeito que ele quebrou
// na tela, em qualquer tamanho e idioma), as letras se desfazem em pó e a segunda frase se forma do pó no lugar delas.
// De volta ao topo, a troca se desfaz. A página rola normalmente o tempo todo: nada fica preso.
// Usa o pó de js/ash.js. Quem pediu menos movimento vê o risco e a troca só pelo brilho.
(function () {
  'use strict';
  var say = document.querySelector('.say');
  if (!say) return;
  var root = document.documentElement;
  var first = say.querySelector('.headline--first'), next = say.querySelector('.headline--next');
  var ash = window.HRAsh, soft = !ash || ash.reduced;      // soft: troca só pelo brilho, sem pó
  var STRIKE = 750;           // ms para riscar todas as linhas (cada linha leva o tempo proporcional ao comprimento)
  var OUT = 900, IN = 950;    // ms para as letras virarem pó / a frase nova se formar
  var DOWN = 24;              // px rolados para a troca acontecer; ela se desfaz quando a página volta ao topo
  var state = 'first', busy = false;

  // As linhas do texto como aparecem na tela: uma caixa por linha visual, em px relativos ao elemento.
  // A altura do risco vem do texto sem serifa da linha (o meio das minúsculas); numa linha só de itálico, dele.
  function lines(node) {
    var base = node.getBoundingClientRect(), out = [], walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), t;
    while ((t = walk.nextNode())) {
      if (!t.nodeValue.trim() || (t.parentNode.closest && t.parentNode.closest('.strike'))) continue;
      var serif = !!(t.parentNode.closest && t.parentNode.closest('em')), range = document.createRange();
      range.selectNodeContents(t);
      Array.prototype.forEach.call(range.getClientRects(), function (r) {
        if (r.width < 1) return;
        var mid = (r.top + r.bottom) / 2 - base.top, line = null;
        for (var i = 0; i < out.length; i++) if (Math.abs(out[i].mid - mid) < r.height * 0.45) { line = out[i]; break; }
        if (!line) { line = { mid: mid, left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, y: null, sans: false }; out.push(line); }
        line.left = Math.min(line.left, r.left - base.left); line.right = Math.max(line.right, r.right - base.left);
        line.top = Math.min(line.top, r.top - base.top); line.bottom = Math.max(line.bottom, r.bottom - base.top);
        if (!serif && !line.sans) { line.y = r.top - base.top + r.height * 0.57; line.sans = true; }
        else if (serif && line.y === null) line.y = r.top - base.top + r.height * 0.6;
      });
    }
    return out.sort(function (a, b) { return a.mid - b.mid; });
  }
  // retângulos na tela de onde sai o pó: as próprias linhas do texto
  function spots(node) {
    return function () {
      var b = node.getBoundingClientRect();
      return lines(node).map(function (l) { return { left: b.left + l.left, right: b.left + l.right, top: b.top + l.top, bottom: b.top + l.bottom }; });
    };
  }
  function clearStrikes() { first.querySelectorAll('.strike').forEach(function (s) { s.remove(); }); }
  // risca as linhas uma depois da outra; resolve quando a última termina
  function strike() {
    clearStrikes();
    var ls = lines(first), total = 0, delay = 0, pad = 0.06 * parseFloat(getComputedStyle(first).fontSize);
    ls.forEach(function (l) { total += l.right - l.left; });
    var anims = ls.map(function (l) {
      var s = document.createElement('span'), w = l.right - l.left, d = Math.max(160, STRIKE * w / (total || 1));
      s.className = 'strike'; s.setAttribute('aria-hidden', 'true');
      s.style.left = (l.left - pad) + 'px'; s.style.top = l.y + 'px'; s.style.width = (w + pad * 2) + 'px';
      first.appendChild(s);
      var a = s.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: d, delay: delay, easing: 'cubic-bezier(.55, 0, .35, 1)', fill: 'forwards' });
      delay += d * 0.85;
      return a;
    });
    return anims.length ? anims[anims.length - 1].finished : Promise.resolve();
  }
  function fade(node, to, ms) {
    node.style.opacity = String(to);
    var a = node.animate([{ opacity: 1 - to }, { opacity: to }], { duration: ms, easing: 'ease' });
    return a.finished;
  }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // primeira frase → segunda
  function forward() {
    return strike().then(function () { return wait(120); }).then(function () {
      if (soft) return Promise.all([fade(first, 0, 500), wait(200).then(function () { return fade(next, 1, 600); })]);
      return Promise.all([
        ash.run([first], { duration: OUT, spots: spots(first) }),
        wait(OUT * 0.45).then(function () { return ash.run([next], { appear: true, duration: IN, dust: 0.8, spots: spots(next) }); })
      ]);
    });
  }
  // segunda frase → primeira (sem o risco)
  function back() {
    function reset() { clearStrikes(); }
    if (soft) return Promise.all([fade(next, 0, 400), wait(150).then(function () { reset(); return fade(first, 1, 500); })]);
    return Promise.all([
      ash.run([next], { duration: 700, spots: spots(next) }),
      wait(300).then(function () { reset(); return ash.run([first], { appear: true, duration: 800, dust: 0.8, spots: spots(first) }); })
    ]);
  }
  function want() { return window.scrollY > DOWN ? 'next' : window.scrollY <= 2 ? 'first' : state; }
  function check() {
    if (busy || root.classList.contains('intro')) return;           // durante a apresentação de abertura, espera ela acabar
    var w = want();
    if (w === state) return;
    busy = true;
    (w === 'next' ? forward() : back()).then(function () { state = w; busy = false; check(); }, function () { state = w; busy = false; });
  }
  window.addEventListener('scroll', check, { passive: true });
  document.addEventListener('introdone', check);
  // quem chega com a página já rolada (recarregou no meio, link para uma seção) vê direto a segunda frase
  if (window.scrollY > DOWN) { first.style.opacity = '0'; next.style.opacity = '1'; state = 'next'; }
  window.HRTitle = { busy: function () { return busy; } };
})();
