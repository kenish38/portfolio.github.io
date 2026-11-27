// ===== O show: a apresentação de abertura e os botões da janela =====
// Apresentação (só na primeira visita da sessão; quem pediu menos movimento não vê): a janela liga, o endereço do site
// é digitado na barra, a linha de carregamento corre, o título se forma do pó e a nota e a barra do topo aparecem.
// Qualquer clique, tecla ou rolagem (ou o botão "Pular") leva direto ao fim. Quem decide se ela roda é o script de
// uma linha do <head>, que marca a página com a classe "intro" antes da primeira pintura (assim nada pisca).
// Botões da janela, de brincadeira, cada um com o seu efeito, sem tirar a janela do lugar: o vermelho "fecha" (ela vira pó
// e se reconstrói), o amarelo "minimiza" (ela é sugada para dentro da bolinha e volta explodindo dela) e o verde "amplia"
// (uma onda de energia varre a janela). O "+" abre o Discord para um projeto novo.
(function () {
  'use strict';
  var root = document.documentElement, ash = window.HRAsh, soft = !ash || ash.reduced;
  var stage = document.querySelector('.hero__stage'), win = stage && stage.querySelector('.window');
  if (!win) return;
  var addr = win.querySelector('.window__address'), load = win.querySelector('.window__load'), first = win.querySelector('.headline--first');
  var note = win.querySelector('.note'), down = win.querySelector('.window__down'), bar = document.querySelector('.bar');
  var toast = stage.querySelector('.window-toast'), skipBtn = stage.querySelector('.skip'), dots = win.querySelectorAll('.window__dot');
  var ADDRESS = addr.textContent;
  function pt() { return root.lang === 'pt-BR'; }
  function wait(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  // ---------- A apresentação ----------
  var timers = [], anims = [], over = false, dusted = false, SKIPS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function anim(node, frames, opts) { opts.fill = 'both'; var a = node.animate(frames, opts); anims.push(a); return a; }
  function finish(e) {
    if (over) return;
    over = true;
    timers.forEach(clearTimeout);
    SKIPS.forEach(function (n) { window.removeEventListener(n, finish, true); });
    window.removeEventListener('scroll', scrolled);
    document.removeEventListener('visibilitychange', hidden);
    // o toque que encerra o show só encerra o show: o clique que vem logo depois dele não abre o que estiver embaixo
    if (e && (e.type === 'pointerdown' || e.type === 'touchstart')) {
      var eat = function (ev) { ev.preventDefault(); ev.stopPropagation(); window.removeEventListener('click', eat, true); };
      window.addEventListener('click', eat, true);
      setTimeout(function () { window.removeEventListener('click', eat, true); }, 600);   // um toque que vira rolagem não gera clique
    }
    root.classList.remove('typing');
    addr.textContent = ADDRESS;
    if (dusted || !window.HRTitle || !window.HRTitle.moved()) { first.style.opacity = '1'; first.style.filter = ''; }   // só desfaz o que o show fez
    root.classList.add('intro-done');        // as animações de entrada normais não rodam depois do show
    root.classList.remove('intro', 'intro-run');
    anims.forEach(function (a) { a.cancel(); });
    skipBtn.hidden = true;
    try { sessionStorage.setItem('hr-intro', '1'); } catch (e) {}
    document.dispatchEvent(new CustomEvent('introdone'));
    later(900, invite);
  }
  // um pulinho nas três bolinhas da janela, uma vez, para convidar a clicar nelas
  function invite() {
    if (soft) return;
    Array.prototype.forEach.call(dots, function (d, i) {
      d.animate([{ transform: 'none' }, { transform: 'translateY(-4px) scale(1.25)', offset: 0.4 }, { transform: 'none' }], { duration: 420, delay: i * 110, easing: 'ease-out' });
    });
  }
  function type(i) {
    addr.textContent = ADDRESS.slice(0, i);
    if (i < ADDRESS.length) later(26 + Math.random() * 34, function () { type(i + 1); });
    else later(260, enter);
  }
  function enter() {
    root.classList.remove('typing');
    anim(load, [{ opacity: 1, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)', offset: 0.75 }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 800, easing: 'ease-out' });
    later(260, function () { dusted = true; ash.run([first], { appear: true, duration: 1000, dust: 1.2 }); });
    later(1000, function () {
      anim(note, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      anim(down, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 250 });
      anim(bar, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 120, easing: 'ease-out' });
    });
    later(1750, finish);
  }
  // rolar a página (até pela barra de rolagem ou por um link da busca) e trocar de aba também encerram o show
  function scrolled() { if (window.scrollY > 10) finish(); }
  function hidden() { if (document.hidden) finish(); }
  function play() {
    root.classList.add('intro-run');
    skipBtn.hidden = false;
    addr.textContent = '';
    win.style.transformOrigin = '50% 30%';
    anim(win, [{ opacity: 0, transform: 'translateY(40px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 750, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    later(380, function () { root.classList.add('typing'); type(1); });
    SKIPS.forEach(function (n) { window.addEventListener(n, finish, { capture: true, passive: true }); });
    window.addEventListener('scroll', scrolled, { passive: true });
    document.addEventListener('visibilitychange', hidden);
  }
  skipBtn.addEventListener('click', function () { finish(); });
  if (root.classList.contains('intro')) {
    // sem o pó, já rolada, aberta numa aba de fundo ou já mostrada pela rede de segurança de 5 s: vai direto ao fim
    if (soft || window.scrollY > 10 || document.hidden || getComputedStyle(win).opacity !== '0') finish();
    else play();
  }

  // ---------- Os botões da janela ----------
  var toyBusy = false, toastTimer = 0;
  function say(en, ptText) {
    clearTimeout(toastTimer);
    toast.textContent = pt() ? ptText : en;
    toast.animate(soft ? [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }] : [
      { opacity: 0, transform: 'translate(-50%, -40%)' }, { opacity: 1, transform: 'translate(-50%, -50%)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%, -50%)', offset: 0.8 }, { opacity: 0, transform: 'translate(-50%, -58%)' }
    ], { duration: 2200, easing: 'ease' });
    toastTimer = setTimeout(function () { toast.textContent = ''; }, 2400);
  }
  function free() { return !toyBusy && !root.classList.contains('intro') && !(window.HRTitle && window.HRTitle.busy()); }

  function center(n) { var r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
  // de onde até onde vai o efeito: o centro da bolinha, dentro da janela, e o raio que cobre a janela inteira
  function reach(dot) {
    var wr = win.getBoundingClientRect(), c = center(dot), lx = c[0] - wr.left, ly = c[1] - wr.top;
    return { c: c, lx: lx, ly: ly, R: Math.hypot(Math.max(lx, wr.width - lx), Math.max(ly, wr.height - ly)) + 24, area: [{ left: wr.left, top: wr.top, right: wr.right, bottom: wr.bottom }] };
  }

  // vermelho: a janela vira pó e se reconstrói
  win.querySelector('.window__dot--close').addEventListener('click', function () {
    if (!free()) return;
    toyBusy = true;
    var gone = soft ? win.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished : ash.run([win], { duration: 850, dust: 1.5 });
    gone.then(function () {
      say("Tear it down. I'll build it back.", 'Pode destruir. Eu reconstruo.');
      return wait(1100);
    }).then(function () {
      if (soft) { win.getAnimations().forEach(function (a) { a.cancel(); }); return win.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 }).finished; }
      return ash.run([win], { appear: true, duration: 1000, dust: 0.9 });
    }).then(function () { toyBusy = false; }, function () { toyBusy = false; win.style.opacity = '1'; });
  });

  // amarelo: a janela é sugada para dentro da bolinha, como por um buraco negro, e volta explodindo dela (sem sair do lugar)
  var minBtn = win.querySelector('.window__dot--min');
  minBtn.addEventListener('click', function () {
    if (!free()) return;
    toyBusy = true;
    var r = reach(minBtn), at = 'px at ' + r.lx.toFixed(1) + 'px ' + r.ly.toFixed(1) + 'px)';
    function done() { toyBusy = false; minBtn.classList.remove('is-charged'); }
    if (soft) {
      win.animate([{ opacity: 1 }, { opacity: 0, offset: 0.25 }, { opacity: 0, offset: 0.75 }, { opacity: 1 }], { duration: 2200 }).finished.then(done, done);
      setTimeout(function () { say('Nothing here stays small.', 'Nada aqui fica pequeno.'); }, 500);
      return;
    }
    minBtn.classList.add('is-charged');
    var gone = win.animate([{ clipPath: 'circle(' + r.R.toFixed(0) + at }, { clipPath: 'circle(0' + at }], { duration: 950, easing: 'cubic-bezier(.55, 0, .9, .45)', fill: 'forwards' });
    ash.vortex(r.c[0], r.c[1], r.R, 900, true, r.area, '254, 188, 46');
    gone.finished.then(function () {
      minBtn.classList.remove('is-charged');
      say('Nothing here stays small.', 'Nada aqui fica pequeno.');
      return wait(1000);
    }).then(function () {
      var r2 = reach(minBtn);       // medido de novo: a página pode ter rolado enquanto a janela estava sumida
      ash.vortex(r2.c[0], r2.c[1], r2.R, 650, false, r2.area, '254, 188, 46');
      var back = win.animate([{ clipPath: 'circle(0' + at }, { clipPath: 'circle(' + r.R.toFixed(0) + at }], { duration: 800, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' });
      gone.cancel();
      return back.finished.then(function () { back.cancel(); });
    }).then(done, function () { done(); win.getAnimations().forEach(function (a) { a.cancel(); }); });
  });

  // verde: uma onda de energia sai da bolinha e varre a janela, com faíscas verdes e um clarão (nada muda de tamanho)
  var maxBtn = win.querySelector('.window__dot--max');
  maxBtn.addEventListener('click', function () {
    if (!free()) return;
    toyBusy = true;
    var r = reach(maxBtn);
    say('Full power.', 'Potência máxima.');
    win.animate([{ filter: 'none' }, { filter: 'brightness(1.6) saturate(1.15)', offset: 0.16 }, { filter: 'none' }], { duration: soft ? 600 : 1100, easing: 'ease-out' });
    if (soft) { setTimeout(function () { toyBusy = false; }, 700); return; }
    maxBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.8)', offset: 0.2 }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' });
    [0, 170].forEach(function (delay) {
      var ring = document.createElement('span'), d = (r.R * 2).toFixed(0) + 'px';
      ring.className = 'window__surge'; ring.setAttribute('aria-hidden', 'true');
      ring.style.left = r.lx.toFixed(1) + 'px'; ring.style.top = r.ly.toFixed(1) + 'px'; ring.style.width = d; ring.style.height = d;
      win.appendChild(ring);
      ring.animate([{ transform: 'translate(-50%, -50%) scale(0.02)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }], { duration: 1350, delay: delay, easing: 'cubic-bezier(.25, .55, .35, 1)', fill: 'both' })
        .finished.then(function () { ring.remove(); }, function () { ring.remove(); });
    });
    ash.vortex(r.c[0], r.c[1], r.R * 0.85, 700, false, r.area, '40, 200, 64');
    setTimeout(function () { toyBusy = false; }, 1500);
  });
})();
