// ===== Roteiro do filme (página film/) =====
// O filme mostra um lugar sendo construído no Roblox, na ordem de um trabalho de verdade. É um plano só, sem cortes.
// A rolagem do palco é medida em "telas" (u):
//   0 .. 1.5        a câmera atravessa a parede pelo nome
//   1.7 .. 2.6      o mar de luz assenta e vira a baseplate vazia
//   3.0 .. 5.95     01 MAPAS E MODELOS: a planta é riscada, os volumes sobem, o detalhe entra
//   6.1 .. 8.3      02 ILUMINAÇÃO E VFX: o sol baixa, as sombras se alongam, janelas e postes acendem
//   8.4 .. 10.4     03 SISTEMAS: de noite e do alto, os pulsos de dados correm dos objetos até o servidor
//   10.5 .. 12.4    04 INTERFACE: em frente à loja, a missão, as moedas e o cartão da loja (em HTML, por cima)
//   12.5 .. 15.0    05 ENGENHARIA DE IA: o projeto da torre do relógio aparece em arame e ela é preenchida peça por peça,
//                   enquanto as etapas do sistema (ferramentas, agente, verificações, revisão) se revezam no alto
//   15.2 em diante  amanhece sobre o lugar pronto; tela final
// "beats" são as passagens entre cenas (as cenas ficam em js/film-place.js); "shots" são os planos de câmera.
// Depois que o visitante começa a rolar, o filme toca sozinho (ver "Reprodução automática").
// Ao mudar o fim do filme, ajuste TOTAL aqui e --len em css/site.css (os dois precisam bater).
(function () {
  'use strict';
  var S = window.HRScroll, clamp = S.clamp;
  var WALL = 1.5, TOTAL = 18;
  function seg(u, a, b) { return S.smooth(u, a, b); }

  // a, b: início e fim em telas | fx: papel de cada ponto (o atraso dele dentro da passagem) | stagger: quanto esse atraso pesa
  var beats = [
    { a: 1.7, b: 2.6, from: 'wave', to: 'base', fx: 'settle', stagger: 1.2 },
    { a: 2.9, b: 3.4, from: 'base', to: 'plan', fx: 'draw', stagger: 1.6, turb: 0 },
    { a: 3.5, b: 4.5, from: 'plan', to: 'grey', fx: 'extrude', stagger: 2.2, turb: 0 },
    { a: 4.7, b: 5.6, from: 'grey', to: 'built', fx: 'detail', stagger: 1.8, turb: 0 },
    { a: 6.1, b: 7.2, from: 'built', to: 'dusk', fx: 'sunset', stagger: 1.4, turb: 0 },
    { a: 8.4, b: 9.0, from: 'dusk', to: 'night', fx: 'fade', stagger: 0.6, turb: 0 },
    { a: 10.5, b: 11.0, from: 'night', to: 'calm', fx: 'fade', stagger: 0.6, turb: 0 },
    { a: 12.8, b: 13.4, from: 'calm', to: 'frame', fx: 'still', turb: 0 },
    { a: 13.5, b: 14.7, from: 'frame', to: 'tower', fx: 'place', stagger: 3, turb: 0, ease: 'out' },
    { a: 15.2, b: 16.2, from: 'tower', to: 'dawn', fx: 'sunrise', stagger: 1.4, turb: 0 }
  ];
  // Planos de câmera: chaves ao longo do filme; entre elas a câmera segue uma curva suave (ver "Câmera" em js/matter.js).
  //   at: o que a câmera olha (os assuntos vêm de js/film-place.js) | off: desloca o alvo
  //   az: giro em volta dele (0 = do sul, positivo = pelo leste) | el: altura | r: distância
  //   ox: descentra o quadro para a legenda caber | tall: distância em telas em pé | stop: a câmera para nesta chave
  var shots = [
    // Abertura: o mar pelo recorte do nome; a grua sobe e gira enquanto ele assenta em baseplate
    { u: 0, at: 'sea', az: 0, el: 25, r: 10.5, tall: 1, stop: true },
    { u: 1.7, at: 'sea', az: 0, el: 25, r: 10.5, tall: 1, stop: true },
    { u: 2.6, at: 'town', az: 30, el: 36, r: 19.5, ox: 0.16 },
    // 01: a planta vista do alto; a grua desce enquanto os volumes sobem e chega perto para o detalhe
    { u: 3.4, at: 'town', az: 36, el: 33, r: 18.5, ox: 0.14 },
    { u: 4.5, at: 'town', az: 47, el: 18, r: 15.4, off: [0, 0.7, 0], ox: 0.14 },
    { u: 5.6, at: 'town', az: 36, el: 15, r: 13.6, off: [0, 0.9, 0], ox: 0.15 },
    { u: 6.1, at: 'town', az: 30, el: 15.5, r: 13.8, off: [0, 0.9, 0], ox: 0.15 },
    // 02: um giro lento em volta da praça enquanto o sol baixa
    { u: 7.2, at: 'town', az: 16, el: 17, r: 14.2, off: [0, 0.8, 0], ox: 0.15 },
    { u: 8.3, at: 'town', az: 2, el: 20, r: 14.8, off: [0, 0.8, 0], ox: 0.15 },
    // 03: a grua sobe: o lugar visto quase como um mapa
    { u: 9.0, at: 'town', az: -4, el: 42, r: 16, off: [0, 1.3, 0], ox: 0.1 },
    { u: 10.4, at: 'town', az: 6, el: 45, r: 16.2, off: [0, 1.3, 0], ox: 0.1 },
    // 04: a grua desce até a calçada, em frente à loja
    { u: 11.1, at: 'shop', az: 21, el: 10, r: 8.6, fov: 28, off: [0.5, 0.3, 0], ox: -0.08 },
    { u: 12.4, at: 'shop', az: 26, el: 9, r: 8.3, fov: 28, off: [0.5, 0.3, 0], ox: -0.08 },
    // 05: travelling pela praça até o terreno vazio; arco lento em volta da torre que sobe
    { u: 13.2, at: 'lot', az: 30, el: 15, r: 10.6, off: [0, 0.5, 0], ox: 0.03 },
    { u: 14.7, at: 'lot', az: 50, el: 12, r: 11.2, off: [0, 0.5, 0], ox: 0.03 },
    { u: 15.2, at: 'lot', az: 56, el: 13, r: 11.8, off: [0, 0.5, 0], ox: 0.05 },
    // tela final: a câmera recua e o lugar inteiro aparece ao amanhecer, no alto e à direita do quadro
    { u: 16.3, at: 'town', az: 68, el: 23, r: 20, off: [0, 0.9, 0], ox: 0.2, oy: -0.1 },
    { u: 18, at: 'town', az: 80, el: 22, r: 20.5, off: [0, 0.9, 0], ox: 0.2, oy: -0.1 }
  ];
  // Capítulos: quando o título e a frase de cada um aparecem e somem
  var scenes = [[3.0, 5.95], [6.1, 8.3], [8.4, 10.4], [10.5, 12.4], [12.5, 15.0]];
  var INTRO = [1.5, 2.96], END = 15.2, FINAL = 15.9;
  var TAGS = [9.0, 9.25, 10.2, 10.4];                  // etiquetas dos sistemas
  var HUD = [[10.9, 12.4], [11.0, 12.4], [11.15, 12.4], [11.45, 12.4]];   // missão, moedas, aviso da porta, cartão da loja
  // Engenharia de IA: a faixa das etapas, o projeto em arame e cada peça da torre [começa, termina]
  // (as peças seguem a passagem "place" e os atrasos PLACE de js/film-place.js)
  var FLOW = [12.7, 15.0], BLUE = [12.85, 13.4];
  var PART = [[13.5, 13.93], [13.68, 14.11], [13.95, 14.38], [14.08, 14.5], [14.2, 14.63]];
  // Ritmo do filme automático: [de, até, velocidade]. Os trechos de leitura andam mais devagar.
  var PACE = [[7.2, 8.3, 0.8], [9.25, 10.2, 0.75], [11.5, 12.2, 0.6], [13.5, 14.7, 0.85]];
  function pace(u) { for (var i = 0; i < PACE.length; i++) if (u >= PACE[i][0] && u < PACE[i][1]) return PACE[i][2]; return 1; }

  var root = document.documentElement;
  var stage = document.querySelector('.stage'), pin = stage.querySelector('.stage__pin');
  var wallEl = pin.querySelector('.wall'), openEl = pin.querySelector('.open'), cueEl = pin.querySelector('.cue');
  var introEl = pin.querySelector('.intro'), scrimEl = pin.querySelector('.scrim'), finalEl = pin.querySelector('.final');
  var sceneEls = [].slice.call(pin.querySelectorAll('.scene'));
  var ticksEl = pin.querySelector('.ticks'), tickEls = [].slice.call(ticksEl.querySelectorAll('i'));
  var tagsEl = pin.querySelector('.tags'), tagEls = [].slice.call(tagsEl.querySelectorAll('span'));
  var hudEls = [].slice.call(pin.querySelectorAll('.hud > *')), promptEl = pin.querySelector('.hud__prompt'), keyEl = promptEl.querySelector('kbd');
  var flowEl = pin.querySelector('.ai__flow'), stepEls = [].slice.call(flowEl.querySelectorAll('li'));
  var treeEl = pin.querySelector('.ai__tree'), rowEls = [].slice.call(treeEl.querySelectorAll('li'));
  var track = S.track(stage);

  // ---------- Parede e partículas ----------
  // Paleta: "perola" (branco e dourado). Para testar outra, abra a página com o nome no fim do endereço,
  // por exemplo #gelo, #aurora, #ouro ou #brasa (as paletas ficam em js/matter.js).
  var palettes = window.HRMatter.palettes, paletteName = 'perola';
  if (palettes[location.hash.slice(1)]) paletteName = location.hash.slice(1);
  // As laterais do recorte do nome pegam a cor da luz que vem de trás
  function wallColors(name) {
    var m = palettes[name].main;
    return {
      sideNear: [m[0][0] * 40, m[0][1] * 40, m[0][2] * 40],
      sideFar: [(m[1][0] + m[2][0]) * 44, (m[1][1] + m[2][1]) * 44, (m[1][2] + m[2][2]) * 44]
    };
  }
  var wall = window.HRWall.create(wallEl, wallColors(paletteName));
  var canvas = pin.querySelector('.world'), still = pin.querySelector('.world-still');
  var matter = window.THREE ? window.HRMatter.create(canvas, { frozen: S.reduced, palette: paletteName }) : null;
  if (matter) { matter.setBeats(beats); matter.setShots(shots); }
  else { canvas.hidden = true; still.src = still.getAttribute('data-src'); still.hidden = false; }   // a imagem reserva só é baixada aqui, quando não há WebGL

  function placeOpen() {
    var b = wall.block;
    openEl.style.top = Math.round(b.y + b.h + Math.max(18, b.cap * 0.16)) + 'px';
  }
  placeOpen();
  var lastWall = '';
  S.onResize(function () { wall.layout(); placeOpen(); if (matter) matter.resize(); lastWall = ''; });

  // ---------- Reprodução automática ----------
  // Depois que o visitante começa a rolar, o filme segue sozinho. Rolar para trás (ou tocar em
  // Pausar) devolve o controle; rolar para a frente retoma. Quem pediu menos movimento rola à mão.
  var playBtn = pin.querySelector('.play'), skipEl = pin.querySelector('.skip-film');
  var auto = { on: false, y: 0, speed: 0.42, held: false };   // velocidade em telas por segundo | held: pausa pedida pelo visitante (botão ou Esc)
  var AUTO_END = FINAL + 0.6;                        // o filme para sozinho na tela final
  function endY() { return track.top + (AUTO_END / TOTAL) * track.span; }
  function label() {
    var pt = document.documentElement.lang === 'pt-BR';
    playBtn.textContent = auto.on ? (pt ? 'Pausar' : 'Pause') : (pt ? 'Continuar' : 'Play');   // o próprio rótulo diz o estado (sem aria-pressed)
    playBtn.classList.toggle('is-playing', auto.on);                                          // troca o ícone (ver .play em css/site.css)
  }
  function play() {
    if (S.reduced || auto.on || window.scrollY >= endY() - 2) return;
    auto.on = true; auto.held = false; auto.y = window.scrollY; root.style.scrollBehavior = 'auto'; label();
  }
  function pause() { if (!auto.on) return; auto.on = false; auto.y = window.scrollY; root.style.scrollBehavior = ''; label(); }
  // Pausa pedida no botão ou com Esc: além da rolagem, param as partículas, os tiros e o vaivém da câmera
  // (WCAG 2.2.2: o que se move sozinho precisa poder ser parado). Rolar ou tocar em Continuar solta.
  function hold() { pause(); auto.held = true; }
  window.addEventListener('wheel', function (e) { if (e.deltaY > 0) play(); else if (e.deltaY < 0) pause(); }, { passive: true });
  var touchY = null;
  window.addEventListener('touchstart', function (e) { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (touchY === null) return;
    var d = touchY - e.touches[0].clientY;
    if (d > 12) { play(); touchY = e.touches[0].clientY; } else if (d < -12) { pause(); touchY = e.touches[0].clientY; }
  }, { passive: true });
  window.addEventListener('keydown', function (e) {
    var tag = document.activeElement ? document.activeElement.tagName : '';
    if (/^(ArrowDown|PageDown| )$/.test(e.key) && !/^(INPUT|TEXTAREA|BUTTON|A)$/.test(tag)) play();
    else if (e.key === 'Escape') hold();
    else if (/^(ArrowUp|PageUp|Home)$/.test(e.key)) pause();
  });
  // Saltos (Pular o filme, links da navegação, Voltar ao topo). Um salto que cruzaria o filme vira um corte:
  // a tela escurece por um instante, a página pula direto e volta. Sem isso a rolagem suave varre o filme
  // inteiro em menos de um segundo: os clarões dos impactos disparam em sequência e todas as cenas são geradas de uma vez.
  var veil = document.createElement('div'); veil.className = 'veil'; veil.setAttribute('aria-hidden', 'true'); document.body.appendChild(veil);
  function jump(target, href, smooth) {
    function land() {
      target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });   // respeita scroll-padding-top (a barra de navegação)
      if (!smooth) { track.measure(); track.raw = track.p = clamp((window.scrollY - track.top) / track.span, 0, 1); }   // o filme pula junto
      try { history.replaceState(null, '', href); } catch (err) {}   // o endereço ganha a âncora; dentro de um quadro isolado isso pode ser negado, e tudo bem
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });                          // o teclado e o leitor de tela continuam a partir do destino
    }
    if (smooth || S.reduced) { land(); return; }
    veil.classList.add('is-on');
    setTimeout(function () { land(); setTimeout(function () { veil.classList.remove('is-on'); }, 60); }, 170);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    pause();
    var target = document.getElementById(a.getAttribute('href').slice(1)); if (!target) return;
    var from = window.scrollY, to = target.getBoundingClientRect().top + from, calm = track.top + (END / TOTAL) * track.span;
    e.preventDefault();
    // da tela final para baixo não há filme no caminho: rolagem suave; senão, corte
    jump(target, a.getAttribute('href'), !S.reduced && Math.min(from, to) >= calm - 2);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  playBtn.addEventListener('click', function () { if (auto.on) hold(); else { auto.held = false; play(); } });
  window.addEventListener('scroll', function () { if (!auto.on && auto.held && Math.abs(window.scrollY - auto.y) > 24) auto.held = false; }, { passive: true });
  // No celular, um toque no filme pausa e retoma, como em qualquer player de vídeo
  pin.addEventListener('click', function (e) {
    if (!S.pointer.touch || (e.target.closest && e.target.closest('a, button'))) return;
    if (auto.on) hold(); else if (auto.held) { auto.held = false; play(); }
  });
  document.addEventListener('langchange', label);
  label();

  // ---------- Quadro a quadro ----------
  var through = false, seen = false;
  // Só escreve no DOM o que mudou desde o último quadro (a maior parte dos elementos fica parada quase o filme todo).
  // keep: o bloco só tem texto e continua "visível" para leitores de tela mesmo com opacidade zero
  // (título, frase de transição e legendas: quem não vê o filme lê a mensagem inteira, na ordem)
  function set(el, opacity, transform, keep) {
    var o = opacity < 0.004 ? 0 : opacity;
    if (o !== el._o) { el._o = o; el.style.opacity = o; if (!keep) el.style.visibility = o === 0 ? 'hidden' : 'visible'; }
    if (transform !== undefined && transform !== el._t) { el._t = transform; el.style.transform = transform; }
  }
  // Variável de CSS escrita no próprio elemento que a usa (na raiz, cada mudança faria o navegador recalcular o estilo da página inteira)
  function setVar(el, name, value) { if (el['_' + name] !== value) { el['_' + name] = value; el.style.setProperty(name, value); } }
  function flag(el, name, on) { if (el['_c' + name] !== on) { el['_c' + name] = on; el.classList.toggle(name, on); } }
  var brandEl = document.querySelector('.nav__brand');
  var env = { flash: 0, shake: 0, hold: false }, ptr = { x: 0, y: 0 };
  function up(px) { return 'translate3d(0,' + px.toFixed(1) + 'px,0)'; }
  function at(p, extra) { return 'translate3d(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px,0)' + (extra || ''); }

  S.loop(function (t, dt) {
    // Reprodução automática: avança a rolagem sozinha, no ritmo de cada trecho
    if (auto.on) {
      if (Math.abs(window.scrollY - auto.y) > 3) auto.y = window.scrollY;      // o visitante rolou junto: segue de onde ele está
      var here = (auto.y - track.top) / track.span * TOTAL;
      auto.y = Math.min(endY(), auto.y + auto.speed * pace(here) * window.innerHeight * dt);
      window.scrollTo(0, auto.y);
      if (auto.y >= endY() - 0.5) pause();
    }
    var r = stage.getBoundingClientRect(), visible = r.bottom > 0 && r.top < window.innerHeight;
    var u = track.p * TOTAL;
    setVar(brandEl, '--brand', seg(u, WALL * 0.86, WALL).toFixed(3));
    if (!visible && seen) { if (!auto.on) S.rest(); return; }   // nada do palco aparece: o laço descansa até a próxima rolagem
    seen = true;

    // Parede: atravessa pelo nome (ou só esmaece, se o visitante pediu menos movimento)
    var pw = clamp(u / WALL, 0, 1), s = S.reduced ? 0 : window.HRWall.travel(pw, wall);
    var px = S.pointer.x, py = S.pointer.y;
    var key = (S.reduced ? pw.toFixed(4) : s.toFixed(5)) + '|' + (s < 0.35 ? px.toFixed(3) + '|' + py.toFixed(3) : '');
    if (key !== lastWall) {
      through = wall.render({ s: s, px: px, py: py });
      if (S.reduced) { through = pw > 0.8; wallEl.style.opacity = 1 - seg(pw, 0.25, 0.8); }
      wallEl.style.visibility = through ? 'hidden' : 'visible';
      lastWall = key;
    }
    if (through && u > WALL + 0.5) wall.sleep();   // a parede ficou para trás: devolve a memória dos canvases dela (render() os recria na volta)
    set(openEl, 1 - seg(u, 0.03, 0.3), undefined, true);
    set(cueEl, 1 - seg(u, 0.02, 0.2));

    // Partículas
    if (matter) {
      env.hold = auto.held;
      matter.view.settle = seg(u, 1.7, 2.6);
      matter.view.dolly = seg(u, 0, WALL) * 2.2 * (1 - seg(u, 1.7, 2.6));
      ptr.x = px; ptr.y = py;
      matter.frame(dt, u, ptr, env);
    }

    // Frase de transição
    set(introEl, S.window(u, INTRO[0], INTRO[0] + 0.3, INTRO[1] - 0.28, INTRO[1]), up((1 - seg(u, INTRO[0], INTRO[0] + 0.3)) * 20 - seg(u, INTRO[1] - 0.28, INTRO[1]) * 20), true);

    // Capítulos: número, título e uma frase, sempre no mesmo lugar; embaixo, um traço para cada capítulo
    for (var i = 0; i < scenes.length; i++) {
      var a = scenes[i][0], b = scenes[i][1];
      set(sceneEls[i], S.window(u, a, a + 0.26, b - 0.2, b), up((1 - seg(u, a, a + 0.26)) * 16 - seg(u, b - 0.2, b) * 16), true);
      setVar(tickEls[i], '--fill', clamp((u - a) / (b - a), 0, 1).toFixed(3));
    }
    set(ticksEl, seg(u, 2.9, 3.2) * (1 - seg(u, END, END + 0.4)));

    // Etiquetas dos sistemas: seguem os pontos do lugar
    var lab = matter ? S.window(u, TAGS[0], TAGS[1], TAGS[2], TAGS[3]) : 0;
    set(tagsEl, lab);
    if (lab > 0.004) tagEls.forEach(function (el) { var p = matter.project(el.dataset.at); if (p) el.style.transform = at(p, ' translate(-50%, -100%)'); });

    // Interface: os painéis entram um a um; o aviso fica preso à porta da loja e a tecla "aperta" antes de o cartão abrir
    for (var h = 0; h < hudEls.length; h++) {
      var w = HUD[h], oh = matter ? S.window(u, w[0], w[0] + 0.14, w[1] - 0.2, w[1]) : 0;
      set(hudEls[h], oh, hudEls[h] === promptEl ? undefined : up((1 - seg(u, w[0], w[0] + 0.14)) * 10));
    }
    if (promptEl._o > 0) { var pd = matter.project('shopdoor'); if (pd) promptEl.style.transform = at(pd, ' translate(-50%, -100%)'); }
    flag(keyEl, 'is-down', u > HUD[3][0] - 0.1 && u < HUD[3][0] + 0.12);

    // Engenharia de IA: a etapa em obra fica acesa na faixa (as ferramentas preparam o projeto; depois, para cada peça,
    // o agente monta, as verificações conferem e a revisão aprova) e a peça ganha a marca de conferida na lista
    var oa = matter ? S.window(u, FLOW[0], FLOW[0] + 0.16, FLOW[1] - 0.2, FLOW[1]) : 0;
    set(flowEl, oa, up((1 - seg(u, FLOW[0], FLOW[0] + 0.16)) * 10));
    set(treeEl, matter ? S.window(u, BLUE[0] - 0.05, BLUE[0] + 0.05, FLOW[1] - 0.2, FLOW[1]) : 0);
    if (oa > 0.004) {
      var cur = -1, q, now = -1;
      for (q = 0; q < PART.length; q++) if (u >= PART[q][0]) cur = q;
      if (cur >= 0) { var ph = (u - PART[cur][0]) / (PART[cur][1] - PART[cur][0]); now = ph < 0.5 ? 1 : ph < 0.8 ? 2 : ph < 1 ? 3 : 4; }
      else if (u >= BLUE[0]) now = u < BLUE[1] ? 0 : 1;
      for (q = 0; q < stepEls.length; q++) { flag(stepEls[q], 'is-on', now === q); flag(stepEls[q], 'is-done', now > q); }
      for (q = 0; q < rowEls.length; q++) {
        var w0 = q ? PART[q - 1] : BLUE;
        flag(rowEls[q], 'is-in', u >= w0[0]); flag(rowEls[q], 'is-new', u >= w0[0] && u < w0[1]); flag(rowEls[q], 'is-done', u >= w0[1]);
      }
    }

    // Tela final, véu de leitura e controles do filme
    var fin = seg(u, FINAL, FINAL + 0.3);
    set(finalEl, fin, up((1 - fin) * 24));
    set(scrimEl, seg(u, WALL - 0.1, WALL + 0.3));
    var controls = (S.reduced ? 1 : seg(u, 0.12, 0.4)) * (1 - seg(u, AUTO_END - 0.5, AUTO_END - 0.1));
    set(playBtn, S.reduced ? 0 : controls); set(skipEl, controls);   // com "menos movimento", o "Pular" aparece desde a primeira tela
  });
})();
