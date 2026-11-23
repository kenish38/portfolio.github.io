// ===== O show: a apresentação de abertura e os botões da janela =====
// Apresentação (só na primeira visita da sessão; quem pediu menos movimento não vê): a janela liga, o endereço do site
// é digitado na barra, a linha de carregamento corre, o título se forma do pó e a nota e a barra do topo aparecem.
// Qualquer clique, tecla ou rolagem (ou o botão "Pular") leva direto ao fim. Quem decide se ela roda é o script de
// uma linha do <head>, que marca a página com a classe "intro" antes da primeira pintura (assim nada pisca).
// Botões da janela, de brincadeira: vermelho "fecha" (a janela vira pó e se reconstrói), amarelo minimiza e volta,
// verde amplia para a largura toda da tela (e volta no segundo clique). O "+" abre o Discord para um projeto novo.
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

  // vermelho: a janela vira pó, avisa que não dá para fechar um mundo e se reconstrói
  win.querySelector('.window__dot--close').addEventListener('click', function () {
    if (!free()) return;
    toyBusy = true;
    var gone = soft ? win.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished : ash.run([win], { duration: 850, dust: 1.5 });
    gone.then(function () {
      say("You can't close a world. Rebuilding…", 'Não dá pra fechar um mundo. Reconstruindo…');
      return wait(1100);
    }).then(function () {
      if (soft) { win.getAnimations().forEach(function (a) { a.cancel(); }); return win.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 }).finished; }
      return ash.run([win], { appear: true, duration: 1000, dust: 0.9 });
    }).then(function () { toyBusy = false; }, function () { toyBusy = false; win.style.opacity = '1'; });
  });

  // amarelo: a janela desce até o pé da tela, some e volta com um pulinho
  win.querySelector('.window__dot--min').addEventListener('click', function () {
    if (!free()) return;
    toyBusy = true;
    say('Be right back!', 'Já volto!');
    var dy = Math.round(window.innerHeight - win.getBoundingClientRect().top), a;
    win.style.transformOrigin = '50% 100%';
    if (soft) a = win.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0, offset: 0.7 }, { opacity: 1 }], { duration: 1600 });
    else a = win.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translateY(' + dy + 'px) scale(.12, .05)', opacity: 0.3, offset: 0.32, easing: 'cubic-bezier(.6, 0, .9, .5)' },
      { transform: 'translateY(' + dy + 'px) scale(.12, .05)', opacity: 0, offset: 0.55 },
      { transform: 'translateY(-16px) scale(1.01)', opacity: 1, offset: 0.84, easing: 'cubic-bezier(.2, .9, .3, 1.2)' },
      { transform: 'none', opacity: 1 }
    ], { duration: 1900 });
    a.finished.then(function () { toyBusy = false; }, function () { toyBusy = false; });
  });

  // verde: a janela ocupa a largura toda da tela; no segundo clique, volta
  var maxBtn = win.querySelector('.window__dot--max');
  maxBtn.setAttribute('aria-pressed', 'false');
  maxBtn.addEventListener('click', function () {
    if (root.classList.contains('intro')) return;
    var wide = win.classList.toggle('window--wide');
    maxBtn.setAttribute('aria-pressed', String(wide));
  });
})();
