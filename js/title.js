// ===== O título que se risca =====
// No primeiro movimento de rolagem para baixo, uma linha de luz risca cada linha do título (do jeito que ele quebrou
// na tela, em qualquer tamanho e idioma), as letras se desfazem em pó e a segunda frase se forma do pó no lugar delas.
// A virada fica: de volta ao topo, a segunda frase continua lá (a primeira é o clichê que ela desmente).
// Para ninguém passar direto sem ver a troca: o primeiro movimento de rolagem no topo (roda do mouse, dedo ou teclado)
// segura a página por um instante, só até o risco passar e a frase nova se formar (uns 1,5 s); depois tudo rola
// normalmente, e quem desce pela barra de rolagem, pelas abas ou por um link nunca é segurado.
// Usa o pó de js/ash.js. Quem pediu menos movimento vê o risco e a troca só pelo brilho, e a página não segura.
(function () {
  'use strict';
  var say = document.querySelector('.say');
  if (!say) return;
  var root = document.documentElement;
  var first = say.querySelector('.headline--first'), next = say.querySelector('.headline--next');
  var ash = window.HRAsh, soft = !ash || ash.reduced;      // soft: troca só pelo brilho, sem pó
  var STRIKE = 620;           // ms para riscar todas as linhas (cada linha leva o tempo proporcional ao comprimento)
  var OUT = 780, IN = 820;    // ms para as letras virarem pó / a frase nova se formar
  var DOWN = 24;              // px rolados para a troca acontecer (ela não se desfaz)
  var HOLD = 2600;            // ms: o máximo que a página fica segura (a trava solta antes, quando a frase nova se forma)
  var state = 'first', busy = false, go = false, held = false, holdTimer = 0;

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
    return strike().then(function () { return wait(100); }).then(function () {
      if (soft) return Promise.all([fade(first, 0, 500), wait(200).then(function () { return fade(next, 1, 600); })]);
      return Promise.all([
        ash.run([first], { duration: OUT, spots: spots(first) }),
        wait(OUT * 0.45).then(function () {
          setTimeout(release, IN * 0.65);           // a frase nova já dá para ler: a página pode rolar
          return ash.run([next], { appear: true, duration: IN, dust: 0.8, spots: spots(next) });
        })
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
  function want() { return state === 'next' || go || window.scrollY > DOWN ? 'next' : 'first'; }
  function check() {
    if (busy || root.classList.contains('intro')) return;           // durante a apresentação de abertura, espera ela acabar
    var w = want();
    if (w === state) return;
    busy = true;
    (w === 'next' ? forward() : back()).then(function () { state = w; busy = false; release(); check(); }, function () { state = w; busy = false; release(); });
  }

  // ---------- A trava curta do primeiro movimento ----------
  // Só no topo, com a primeira frase na tela e o pó disponível. A roda do mouse para baixo, o dedo subindo a página e as
  // teclas que rolam (seta, Page Down, espaço fora de botões e campos) começam a troca na hora e ficam sem efeito até a
  // frase nova se formar. A barra de rolagem, as abas e os links não passam por aqui.
  function hold() { return held || (!soft && state === 'first' && !busy && window.scrollY <= DOWN); }
  function engage(e) {
    if (e.cancelable) e.preventDefault();
    if (held) return;
    held = true; go = true;
    clearTimeout(holdTimer); holdTimer = setTimeout(release, HOLD);
    check();                                           // durante a apresentação de abertura, a troca começa quando ela acaba
  }
  function release() { held = false; clearTimeout(holdTimer); }
  window.addEventListener('wheel', function (e) { if (e.deltaY > 0 && !e.ctrlKey && hold()) engage(e); }, { capture: true, passive: false });
  var touchY = null;
  window.addEventListener('touchstart', function (e) { touchY = e.touches.length === 1 ? e.touches[0].clientY : null; }, { capture: true, passive: true });
  window.addEventListener('touchmove', function (e) {
    if (touchY === null || e.touches.length !== 1) return;
    if (touchY - e.touches[0].clientY > 4 && hold()) engage(e);          // o dedo subindo = a página descendo
  }, { capture: true, passive: false });
  var KEYS = { ArrowDown: 1, PageDown: 1, ' ': 1, Spacebar: 1 };
  window.addEventListener('keydown', function (e) {
    if (!KEYS[e.key] || e.altKey || e.ctrlKey || e.metaKey || (e.key === ' ' && e.shiftKey)) return;
    var t = e.target && e.target.closest ? e.target : null;
    if (t && t.closest('input, textarea, select, [contenteditable], canvas, dialog')) return;      // campos, o estúdio e o visualizador usam as teclas
    if (t && e.key !== 'ArrowDown' && e.key !== 'PageDown' && t.closest('button, a, summary, [tabindex]')) return;   // o espaço aperta botões
    if (hold()) engage(e);
  }, true);
  window.addEventListener('scroll', check, { passive: true });
  document.addEventListener('introdone', check);
  // quem chega com a página já rolada (recarregou no meio, link para uma seção) vê direto a segunda frase
  if (window.scrollY > DOWN) { first.style.opacity = '0'; next.style.opacity = '1'; state = 'next'; }
  // trocar o idioma ou o tamanho da janela durante o risco deixaria as linhas de luz no lugar antigo: elas saem
  function restrike() { first.querySelectorAll('.strike').forEach(function (s) { s.style.opacity = '0'; }); }
  document.addEventListener('langchange', restrike);
  window.addEventListener('resize', restrike);
  window.HRTitle = { busy: function () { return busy; }, moved: function () { return state !== 'first'; }, held: function () { return held; } };
})();
