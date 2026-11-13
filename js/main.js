// ===== Roteiro da página =====
// A rolagem do palco é medida em "telas" (u). O filme é um plano só, sem cortes, nesta ordem:
//   0 .. 1.5       a câmera atravessa a parede pelo nome
//   1.7 .. 2.6     o mar de luz assenta e vira a baseplate
//   2.95 .. 4.7    VELOCIDADE: a baseplate vira tabuleiro e as peças surgem do chão (travelling rente ao tabuleiro)
//   4.75 .. 6.5    QUALIDADE: aproximação até o duelo; o cavalo é erguido, desce na casa do peão e o peão tomba
//   6.52 .. 9.8    DIREÇÃO DE ARTE: a queda do peão racha o tabuleiro (plano de cima), que estilhaça como espelho;
//                  a câmera mergulha atrás dele, faz um arco em câmera lenta entre cacos e raios de luz;
//                  um brilho se condensa numa bala, o tempo volta e ela estilhaça o peão
//   9.9 .. 11.15   a câmera vai contra os tiros até a boca do cano e contorna a arma, que para de atirar
//   11.2 .. 13.75  PROGRAMAÇÃO: a arma é arremessada, gira no ar e se desmonta no alto; o script dela é escrito
//   13.85 .. 15.6  INTERFACE: o código vira a HUD de um jogo de tiro; o clique e a mensagem
//   15.65 em diante tela final; depois a página sobe por cima do filme
// "beats" são as passagens entre cenas (as cenas ficam em js/film-*.js); "shots" são os planos de câmera.
// Depois que o visitante começa a rolar, o filme toca sozinho (ver "Reprodução automática").
// Ao mudar o fim do filme, ajuste TOTAL aqui e --len em css/site.css (os dois precisam bater).
(function () {
  'use strict';
  var S = window.HRScroll, clamp = S.clamp;
  var WALL = 1.5, TOTAL = 18;
  function seg(u, a, b) { return S.smooth(u, a, b); }

  // a, b: início e fim em telas | fx: papel de cada ponto | rig: movimento rígido dos grupos
  // ease: 'in' chega com velocidade, 'out' sai com velocidade, 'lin' constante (padrão: suave nas duas pontas)
  // floor: altura abaixo da qual os pontos ficam invisíveis (as peças surgindo do tabuleiro)
  // mark: 'shaft' = começa a câmera lenta | 'snap' = o tempo volta ao normal
  var beats = [
    { a: 1.7, b: 2.6, from: 'wave', to: 'plate', fx: 'settle', stagger: 1.2 },
    { a: 2.95, b: 3.5, from: 'plate', to: 'boardFlat', fx: 'sweep', stagger: 2, floor: -0.02 },
    { a: 3.6, b: 4.6, from: 'boardFlat', to: 'boardUp', fx: 'rise', turb: 0.5, stagger: 1.6, floor: -0.02 },
    { a: 4.75, b: 5.5, from: 'boardUp', to: 'boardClose', fx: 'still', turb: 0 },
    { a: 5.6, b: 5.82, from: 'boardClose', to: 'boardLift', fx: 'rigid', rig: 'lift', ease: 'out', stagger: 0, turb: 0 },
    { a: 5.82, b: 6.04, from: 'boardLift', to: 'boardStrike', fx: 'rigid', rig: 'strike', ease: 'in', stagger: 0, turb: 0.4 },
    { a: 6.06, b: 6.5, from: 'boardStrike', to: 'boardTopple', fx: 'burst', rig: 'topple', ease: 'in', stagger: 0, turb: 0.3 },
    { a: 6.52, b: 6.85, from: 'boardTopple', to: 'boardCrack', fx: 'cracks', rig: 'crack', ease: 'out', stagger: 1.5, turb: 0.5 },
    { a: 7.0, b: 7.7, from: 'boardCrack', to: 'boardShatter', fx: 'shatter', rig: 'shatter', ease: 'in', stagger: 1.1, turb: 0.8 },
    { a: 7.7, b: 8.4, from: 'boardShatter', to: 'fallA', fx: 'fallIn', rig: 'fallA', ease: 'out', stagger: 0, turb: 1 },
    { a: 8.4, b: 9.2, from: 'fallA', to: 'fallB', fx: 'fallDrift', rig: 'fallB', ease: 'lin', stagger: 0, turb: 0, mark: 'shaft' },
    { a: 9.2, b: 9.4, from: 'fallB', to: 'fallSnap', fx: 'condense', rig: 'fallSnap', stagger: 0.8, turb: 1 },
    { a: 9.42, b: 9.8, from: 'fallSnap', to: 'fallHit', fx: 'pawnHit', rig: 'fallHit', ease: 'out', stagger: 0, turb: 0, mark: 'snap' },
    { a: 9.9, b: 10.6, from: 'fallHit', to: 'gunFiring', fx: 'still', turb: 0 },
    { a: 10.8, b: 11.15, from: 'gunFiring', to: 'gunRest', fx: 'level', rig: 'level', stagger: 0.6 },
    { a: 11.2, b: 11.8, from: 'gunRest', to: 'gunTurn', fx: 'turn', rig: 'turn', ease: 'out', stagger: 0, turb: 0 },
    { a: 11.8, b: 12.4, from: 'gunTurn', to: 'gunExploded', fx: 'strip', ease: 'out', stagger: 0.7, turb: 0 },
    { a: 12.85, b: 13.55, from: 'gunExploded', to: 'code', fx: 'write', stagger: 2.4 },
    { a: 13.85, b: 14.55, from: 'code', to: 'hud', fx: 'toHud', stagger: 1.6 },
    { a: 14.8, b: 15.3, from: 'hud', to: 'hudOn', fx: 'click', stagger: 1, turb: 0.6 },
    { a: 15.65, b: 16.45, from: 'hudOn', to: 'waveEnd', turb: 1.2 }
  ];
  // Planos de câmera: chaves ao longo do filme; entre elas a câmera segue uma curva suave (ver "Câmera" em js/matter.js).
  //   at: o que a câmera olha (os assuntos vêm dos film-*.js e são seguidos de verdade: cavalo, peão, bala, arma...)
  //   off: desloca o alvo | az: giro em volta dele | el: altura (negativa = de baixo para cima) | r: distância
  //   roll: horizonte inclinado | fov: lente (35 normal, menos aproxima, mais abre) | fd: foco além (+) ou aquém (-) do alvo
  //   ox: descentra o quadro para a legenda caber | tall: distância em telas em pé | stop: a câmera para nesta chave
  var shots = [
    // Abertura: o mar pelo recorte do nome; a grua sobe e gira enquanto ele assenta em baseplate
    { u: 0, at: 'sea', az: 0, el: 25, r: 10.5, tall: 1, stop: true },
    { u: 1.7, at: 'sea', az: 0, el: 25, r: 10.5, tall: 1, stop: true },
    { u: 2.6, at: 'origin', az: 34, el: 34, r: 19.5, ox: 0.2 },
    { u: 2.95, at: 'origin', az: 40, el: 33, r: 18.8, ox: 0.18 },
    // VELOCIDADE: a grua desce até rente ao tabuleiro; travelling baixo enquanto as peças surgem; sobe para mostrar a partida
    { u: 3.5, at: 'board', az: 60, el: 22, r: 15, ox: 0.1 },
    { u: 3.9, at: 'board', az: 82, el: 7, r: 10.5, off: [0, 0.5, 0], ox: 0.1, tall: 1.1 },
    { u: 4.3, at: 'board', az: 104, el: 5, r: 9.6, off: [0, 0.7, 0], ox: 0.08, tall: 1.1 },
    { u: 4.72, at: 'board', az: 126, el: 17, r: 12.5, off: [0, 0.6, 0], ox: 0.08 },
    // QUALIDADE: aproximação com troca de foco até o duelo; plano baixo acompanhando o cavalo no ar;
    // ele desce e a câmera vai ao chão, à frente do peão, que tomba na direção da lente (horizonte inclinado)
    { u: 5.15, at: 'duel', az: 140, el: 10, r: 7.6, fov: 34, fd: 2.4, ox: 0.12 },
    { u: 5.55, at: 'duel', az: 151, el: 4.5, r: 4.9, fov: 32, ox: 0.13 },
    { u: 5.82, at: 'hero', az: 158, el: -6, r: 5.0, off: [-0.9, -0.3, -0.4], roll: -4, fov: 32, ox: 0.13, tall: 1.05 },
    { u: 6.04, at: 'hero', az: 166, el: 3, r: 3.5, off: [-0.55, -0.15, -0.25], roll: 3, fov: 34, ox: 0.1, stop: true },
    { u: 6.06, at: 'hero', az: 166, el: 3, r: 3.5, off: [-0.55, -0.15, -0.25], roll: 3, fov: 34, ox: 0.1, stop: true },
    { u: 6.3, at: 'prey', az: 178, el: 3, r: 3.0, off: [-0.3, 0.1, 0], roll: -6, fov: 36, ox: 0.08, tall: 1.1 },
    { u: 6.5, at: 'prey', az: 190, el: 4, r: 2.7, off: [-0.3, 0.1, -0.1], roll: -9, fov: 36, ox: 0.05, tall: 1.2, stop: true },
    { u: 6.52, at: 'prey', az: 190, el: 4, r: 2.7, off: [-0.3, 0.1, -0.1], roll: -9, fov: 36, ox: 0.05, tall: 1.2, stop: true },
    // DIREÇÃO DE ARTE: a grua sobe girando até o plano de cima enquanto o tabuleiro racha; quando ele cede, a câmera
    // mergulha atrás do peão, passa por ele e termina embaixo, olhando para cima; em câmera lenta, um arco em volta dele
    { u: 6.85, at: 'impact', az: 252, el: 78, r: 14.5, off: [1.2, 0, 0.2], ox: 0.07 },
    { u: 7.0, at: 'impact', az: 264, el: 81, r: 13.6, off: [1.2, 0, 0.2], ox: 0.07 },
    { u: 7.35, at: 'prey', az: 246, el: 62, r: 7.6, ox: 0.06 },
    { u: 7.7, at: 'prey', az: 208, el: 30, r: 6.2, ox: 0.05 },
    { u: 8.05, at: 'prey', az: 190, el: 5, r: 6.6, roll: 5, ox: 0.05 },
    { u: 8.4, at: 'prey', az: 182, el: -14, r: 6.4, off: [0.5, 0.2, 0], ox: 0.05 },
    { u: 8.8, at: 'prey', az: 202, el: -8, r: 5.6, off: [0.9, 0.2, 0], fov: 33, ox: 0.04 },
    // o brilho em primeiro plano, de três quartos, com o peão desfocado na frente; ele vira bala
    { u: 9.2, at: 'bullet', az: 224, el: -3, r: 3.9, off: [-1.1, -0.41, -0.02], fov: 34, fd: 0.7, ox: -0.03 },
    { u: 9.4, at: 'bullet', az: 230, el: -2, r: 3.1, off: [-0.64, -0.24, -0.01], fov: 31, fd: 0.4, ox: -0.03, stop: true },
    { u: 9.42, at: 'bullet', az: 230, el: -2, r: 3.1, off: [-0.64, -0.24, -0.01], fov: 31, fd: 0.4, ox: -0.03, stop: true },
    // o tiro: a câmera gira com a bala, os estilhaços passam pela lente, e ela se vira para a linha dos tiros
    { u: 9.55, at: 'hit', az: 250, el: -6, r: 3.4, off: [0.2, 0, 0], roll: -7, fov: 40 },
    { u: 9.8, at: 'hit', az: 256, el: -13, r: 4.6, off: [1.5, 0.5, 0], roll: -3, fov: 30, ex: 0.8 },
    // contra os tiros até a boca do cano; arco em volta da arma enquanto ela para de atirar
    { u: 10.35, at: 'muzzle', az: 238, el: -8, r: 4.5, off: [1.5, 0.55, 0], roll: 4, fov: 42, ex: 0.7, tall: 1.35 },
    { u: 10.6, at: 'muzzle', az: 230, el: -7, r: 4.0, off: [1.5, 0.55, 0], roll: 5, fov: 42, ex: 0.7, tall: 1.15 },
    { u: 10.8, at: 'gun', az: 224, el: -2, r: 7.2, off: [-1.3, -0.5, 0], fov: 38, ex: 0.8, tall: 1 },
    { u: 11.15, at: 'gun', az: 212, el: 10, r: 8.4, ox: 0.03, tall: 1.1 },
    // PROGRAMAÇÃO: plano baixo com lente aberta sob a arma arremessada; recuo em arco enquanto ela se desmonta
    { u: 11.5, at: 'gun', az: 186, el: -10, r: 6.6, roll: 8, fov: 44, tall: 1.15 },
    { u: 11.8, at: 'gun', az: 160, el: 6, r: 8.2, fov: 36, ox: 0.05, tall: 1.1 },
    { u: 12.4, at: 'gun', az: 196, el: 12, r: 13.8, ox: 0.09, tall: 1.05 },
    { u: 12.85, at: 'gun', az: 205, el: 9, r: 13.2, ox: 0.09, tall: 1.05 },
    // travelling de lado sobre as primeiras linhas do script; a câmera abre até o painel inteiro, quase de frente
    { u: 13.25, at: 'codeTop', az: 150, el: 6, r: 6.5 },
    { u: 13.55, at: 'code', az: 172, el: 2, r: 17.5, off: [0, 0.85, 0], ox: 0.13, tall: 0.78 },
    { u: 13.85, at: 'code', az: 177, el: 1, r: 17, off: [0, 0.85, 0], ox: 0.13, tall: 0.78 },
    // INTERFACE: recuo brusco enquanto o código vira HUD; a câmera segue o cursor até o botão e abre para a mensagem
    // hud: em telas em pé a distância ainda é ajustada à altura livre entre a faixa de cima e a legenda (ver fitShots)
    { u: 14.2, at: 'screen', az: 188, el: -3, r: 21, fov: 38, tall: 0.7, hud: true },
    { u: 14.55, at: 'screen', az: 181, el: 0, r: 18, tall: 0.66, hud: true },
    { u: 14.8, at: 'screen', az: 179, el: 0.5, r: 17.7, tall: 0.66, hud: true },
    { u: 15.02, at: 'button', az: 175, el: -2, r: 11, off: [0, 0.6, 0], tall: 0.66 },
    { u: 15.3, at: 'screen', az: 180, el: 0, r: 17, tall: 0.66, hud: true },
    { u: 15.65, at: 'screen', az: 182, el: 1, r: 16.7, tall: 0.66, hud: true },
    // tela final: a grua sobe sobre o mar e segue girando devagar
    { u: 16.45, at: 'sea2', az: 196, el: 25, r: 10.5, tall: 1 },
    { u: 18, at: 'sea2', az: 214, el: 22, r: 10.8, tall: 1 }
  ];
  // Janela de cada cena: quando a palavra de fundo e a legenda aparecem e somem.
  // Um terceiro valor faz a legenda sair antes da palavra, quando a ação passa a ocupar o canto dela
  // (o cavalo descendo sobre o peão; o código sendo escrito).
  var scenes = [[3.0, 4.72], [4.78, 6.48, 6.06], [6.56, 10.3], [11.8, 13.75, 13.1], [13.8, 15.0]];
  // Depois de quantas telas a legenda baixa para 72% (0 = não baixa). Só a cena longa baixa, e só depois do tempo de leitura;
  // não menos que 72%, para o parágrafo manter contraste 4.5:1.
  var CAP_DIM = [0, 0, 2.2, 0, 0];
  var INTRO = [1.5, 2.96], END = 15.65, FINAL = 16.0;
  var PARTS = [12.25, 12.45, 12.7, 12.85];             // quando as etiquetas da arma desmontada aparecem e somem
  // Impactos: clarão e tremor que nascem num instante e somem em "len" telas
  var hits = [{ u: 6.04, flash: 0.6, shake: 0.04, len: 0.1 }, { u: 6.5, flash: 0.9, shake: 0.08, len: 0.12 }, { u: 7.0, flash: 0.3, shake: 0.06, len: 0.3 }, { u: 9.42, flash: 1.4, shake: 0.08, len: 0.12 }];
  // Ritmo do filme automático: [de, até, velocidade]. Abaixo de 0.3 é uma parada no impacto.
  var PACE = [[4.78, 5.5, 0.85], [5.6, 5.82, 0.7], [6.09, 6.11, 0.15], [6.11, 6.53, 0.55], [6.53, 6.55, 0.15], [6.55, 6.85, 0.8], [6.85, 7.0, 0.5], [7.0, 8.4, 0.9],
    [8.4, 9.2, 0.5], [9.2, 9.4, 0.45], [9.4, 9.42, 0.15], [9.42, 9.6, 0.5], [9.6, 10.35, 1.3], [10.35, 10.8, 0.8], [11.2, 11.8, 0.7], [11.8, 12.4, 0.7],
    [12.4, 12.85, 0.45], [13.55, 13.85, 0.4], [14.55, 14.8, 0.35], [15.3, 15.65, 0.45]];
  function pace(u) { for (var i = 0; i < PACE.length; i++) if (u >= PACE[i][0] && u < PACE[i][1]) return PACE[i][2]; return 1; }

  var root = document.documentElement;
  var stage = document.querySelector('.stage'), pin = stage.querySelector('.stage__pin'), mainEl = document.querySelector('main');
  var wallEl = pin.querySelector('.wall'), openEl = pin.querySelector('.open'), cueEl = pin.querySelector('.cue');
  var introEl = pin.querySelector('.intro'), scrimEl = pin.querySelector('.scrim'), finalEl = pin.querySelector('.final');
  var wordsEl = pin.querySelector('.words'), words = [].slice.call(wordsEl.querySelectorAll('.word'));
  var sceneEls = [].slice.call(pin.querySelectorAll('.scene')), progressEl = pin.querySelector('.progress');
  var partsEl = pin.querySelector('.parts'), partEls = [].slice.call(partsEl.querySelectorAll('span'));
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
  // Palavras de fundo: ocupam a largura da tela; em telas em pé correm na vertical, junto à borda direita
  var tall = false;
  function fitWords() {
    var W = pin.clientWidth, H = window.innerHeight;
    tall = W / H < 0.8;
    wordsEl.classList.toggle('is-tall', tall);
    // escreve tudo, mede tudo, escreve tudo: um cálculo de layout só, em vez de um por palavra
    words.forEach(function (w) { w.style.fontSize = '100px'; });
    var sizes = words.map(function (w) { return [w.offsetWidth, w.offsetHeight]; });
    words.forEach(function (w, i) {
      var byLen = 100 * (tall ? H * 0.58 / Math.max(1, sizes[i][1]) : W * 0.93 / Math.max(1, sizes[i][0]));
      var byBlock = tall ? W * 0.2 : 100 * H * 0.5 / Math.max(1, sizes[i][1]);
      w.style.fontSize = Math.min(byLen, byBlock).toFixed(1) + 'px';
    });
  }
  // A HUD em pé foi composta para telas bem altas (390 x 844). Em telas mais baixas (360 x 640, ou o iPhone com as
  // barras do navegador à mostra) ela passava por baixo da legenda e da faixa de cima: a câmera recua até ela
  // caber na altura livre. 1.63 = altura da HUD em larguras de tela; 245 px = faixa de cima + legenda + faixa de baixo.
  function fitShots() {
    var W = pin.clientWidth, H = window.innerHeight, k = W / H < 0.9 ? Math.max(1, 1.63 * W / Math.max(200, H - 245)) : 1;
    shots.forEach(function (sh) { if (sh.hud) { if (sh.tall0 === undefined) sh.tall0 = sh.tall; sh.tall = sh.tall0 * k; } });
    if (matter) matter.setShots(shots);
  }
  placeOpen(); fitWords(); fitShots();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWords);
  document.addEventListener('langchange', fitWords);
  var lastWall = '';
  S.onResize(function () { wall.layout(); placeOpen(); fitWords(); if (matter) matter.resize(); fitShots(); lastWall = ''; });

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
  var brandEl = document.querySelector('.nav__brand'), barsEl = pin.querySelector('.bars'), filmEl = progressEl.querySelector('i');
  var env = { flash: 0, shake: 0, ts: 1 }, ptr = { x: 0, y: 0 };
  function up(px) { return 'translate3d(0,' + px.toFixed(1) + 'px,0)'; }

  S.loop(function (t, dt) {
    // Reprodução automática: avança a rolagem sozinha, no ritmo de cada trecho
    if (auto.on) {
      if (Math.abs(window.scrollY - auto.y) > 3) auto.y = window.scrollY;      // o visitante rolou junto: segue de onde ele está
      var here = (auto.y - track.top) / track.span * TOTAL;
      auto.y = Math.min(endY(), auto.y + auto.speed * pace(here) * window.innerHeight * dt);
      window.scrollTo(0, auto.y);
      if (auto.y >= endY() - 0.5) pause();
    }
    var r = stage.getBoundingClientRect(), mainTop = mainEl.getBoundingClientRect().top;
    // o palco conta como visível só enquanto a página de baixo (que sobe por cima dele) não o cobriu inteiro
    var visible = r.bottom > 0 && r.top < window.innerHeight && mainTop > 0;
    var u = track.p * TOTAL;
    setVar(brandEl, '--brand', seg(u, WALL * 0.86, WALL).toFixed(3));
    // depois do filme a barra de navegação ganha fundo, para não imprimir por cima das seções
    root.classList.toggle('past-film', mainTop < 80);
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

    // Partículas, com o clarão e o tremor dos impactos
    if (matter) {
      env.flash = 0; env.shake = 0; env.sx = 0; env.sy = 0; env.ts = 1; env.hold = auto.held;
      if (!S.reduced) for (var h = 0; h < hits.length; h++) {
        var k = (u - hits[h].u) / hits[h].len;
        if (k >= 0 && k < 1) {
          env.flash += hits[h].flash * (1 - k) * (1 - k); env.shake += hits[h].shake * (1 - k);
          // O tremor é um solavanco amortecido (uma ida e volta e pouco), não uma vibração. Preso a "u * 231", ele
          // vibrava de 8 a 14 vezes por segundo no filme automático e fazia as peças claras em close piscarem
          // mais de 3 vezes por segundo (limite da WCAG 2.3.1 para clarões).
          env.sx += hits[h].shake * (1 - k) * Math.sin(k * 7.85); env.sy += hits[h].shake * 0.7 * (1 - k) * Math.sin(k * 6.6 + 1.3);
        }
      }
      if (auto.on && pace(u) < 0.3) env.ts = pace(u);     // na parada do impacto os tiros também param
      if (auto.held) env.ts = 0;
      matter.view.settle = seg(u, 1.7, 2.6) * (1 - seg(u, END, END + 0.8));
      matter.view.dolly = seg(u, 0, WALL) * 2.2 * (1 - seg(u, 1.7, 2.6));
      ptr.x = px; ptr.y = py;
      matter.frame(dt, u, ptr, env);
    }

    // Frase de transição
    set(introEl, S.window(u, INTRO[0], INTRO[0] + 0.3, INTRO[1] - 0.28, INTRO[1]), up((1 - seg(u, INTRO[0], INTRO[0] + 0.3)) * 26 - seg(u, INTRO[1] - 0.28, INTRO[1]) * 26), true);

    // Palavra de fundo e legenda de cada cena. A palavra entra forte, como um letreiro, e recua para o
    // fundo enquanto a ação acontece; a legenda também baixa depois de lida.
    for (var i = 0; i < scenes.length; i++) {
      var a = scenes[i][0], b = scenes[i][1], cb = scenes[i][2] || b, o = S.window(u, a, a + 0.28, b - 0.24, b), kk = clamp((u - a) / (b - a), 0, 1) - 0.5;
      var oc = cb === b ? o : S.window(u, a, a + 0.28, cb - 0.24, cb);      // a legenda pode sair antes da palavra
      var drift = -kk * (tall ? window.innerHeight : pin.clientWidth) * 0.06;
      set(words[i], o * (0.17 + 0.83 * (1 - seg(u, a + 0.3, a + 0.8))), tall ? 'translate(-50%, -50%) translate3d(0,' + drift.toFixed(1) + 'px,0)' : 'translate(-50%, -50%) translate3d(' + drift.toFixed(1) + 'px,0,0)');
      var dim = CAP_DIM[i] ? 0.28 * seg(u, a + CAP_DIM[i], a + CAP_DIM[i] + 0.5) : 0;
      set(sceneEls[i], oc * (1 - dim), up((1 - seg(u, a, a + 0.28)) * 26 - seg(u, cb - 0.24, cb) * 26), true);
    }

    // Etiquetas da vista explodida
    var lab = matter ? S.window(u, PARTS[0], PARTS[1], PARTS[2], PARTS[3]) : 0;
    set(partsEl, lab);
    if (lab > 0.004) partEls.forEach(function (el) {
      var p = matter.project(el.dataset.part);
      if (p) el.style.transform = 'translate3d(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px,0) translate(-50%, -50%)';
    });

    // Tela final, faixas de cinema, véu de leitura, progresso e botões do filme
    var fin = seg(u, FINAL, FINAL + 0.3);
    set(finalEl, fin, up((1 - fin) * 30));
    var film = seg(u, 2.9, 3.3) * (1 - seg(u, END, END + 0.4));
    setVar(barsEl, '--bars', film.toFixed(3));
    set(scrimEl, seg(u, WALL - 0.1, WALL + 0.3));
    set(progressEl, film);
    setVar(filmEl, '--film', clamp((u - 3) / (END - 3), 0, 1).toFixed(4));
    var controls = S.reduced ? 0 : seg(u, 0.12, 0.4) * (1 - seg(u, AUTO_END - 0.5, AUTO_END - 0.1));
    set(playBtn, controls); set(skipEl, (S.reduced ? 1 : seg(u, 0.12, 0.4)) * (1 - seg(u, AUTO_END - 0.5, AUTO_END - 0.1)));   // com "menos movimento", desde a primeira tela
  });

  // ---------- Portfólio: imagens e vídeos de portfolio.json ----------
  var list = document.querySelector('.media'), box = document.querySelector('.lightbox'), boxStage = box.querySelector('.lightbox__stage');
  var boxTitle = box.querySelector('.lightbox__title'), boxCount = box.querySelector('.lightbox__count'), shown = -1;
  function two(n) { return (n < 10 ? '0' : '') + n; }
  // Abre o item i no visualizador, com o número e o título na barra de baixo
  function open(i) {
    var item = items[i]; shown = i;
    boxStage.textContent = '';
    var el = document.createElement(item.type === 'video' ? 'video' : 'img');
    el.src = item.src;
    if (item.type === 'video') { el.controls = true; el.autoplay = true; el.playsInline = true; }
    else el.alt = alt(item);
    boxStage.appendChild(el);
    boxTitle.textContent = title(item);
    boxCount.textContent = two(i + 1) + ' / ' + two(items.length);
    box.classList.toggle('is-single', items.length < 2);
    if (!box.open && box.showModal) box.showModal();
  }
  // Anterior e próximo (botões e setas do teclado), dando a volta no fim da lista
  function step(d) { if (shown >= 0 && items && items.length > 1) open((shown + d + items.length) % items.length); }
  box.querySelector('.lightbox__prev').addEventListener('click', function () { step(-1); });
  box.querySelector('.lightbox__next').addEventListener('click', function () { step(1); });
  box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); });
  function close() { boxStage.textContent = ''; if (box.open) box.close(); }
  box.querySelector('.lightbox__close').addEventListener('click', close);
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  box.addEventListener('close', function () { boxStage.textContent = ''; shown = -1; });
  function title(item) { return document.documentElement.lang === 'pt-BR' && item.title_pt ? item.title_pt : (item.title || ''); }
  // descrição da imagem para quem não a vê: "alt" e "alt_pt" em portfolio.json; sem eles, vale o título
  function alt(item) { return (document.documentElement.lang === 'pt-BR' && item.alt_pt ? item.alt_pt : item.alt) || title(item); }
  function render(items) {
    root.classList.toggle('no-work', !items || !items.length);
    list.textContent = '';
    if (!items || !items.length) return;      // sem itens, fica o estado vazio (.empty)
    items.forEach(function (item, i) {
      var li = document.createElement('li'), btn = document.createElement('button'), cap = document.createElement('span'), m;
      var pt = document.documentElement.lang === 'pt-BR', kind = item.type === 'video' ? (pt ? 'Abrir vídeo' : 'Open video') : (pt ? 'Abrir imagem' : 'Open image');
      li.className = 'item' + (item.type === 'video' ? ' item--video' : '');
      btn.type = 'button'; btn.className = 'item__open';
      if (item.type === 'video' && !item.poster) { m = document.createElement('video'); m.src = item.src; m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
      else { m = document.createElement('img'); m.src = item.thumb || item.poster || item.src; m.loading = 'lazy'; m.alt = ''; }   // thumb: versão leve para a grade (opcional)
      btn.setAttribute('aria-label', kind + ': ' + (alt(item) || (i + 1)));     // o botão sempre tem nome, mesmo sem título
      btn.appendChild(m); btn.addEventListener('click', function () { open(i); });
      cap.className = 'item__title'; cap.textContent = title(item);
      li.appendChild(btn); if (cap.textContent) li.appendChild(cap);
      list.appendChild(li);
    });
  }
  var items = null;
  render(null);
  if (window.fetch) fetch('portfolio.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (d) { items = d && d.items; render(items); }).catch(function () {});
  document.addEventListener('langchange', function () { render(items); });

  // ---------- Loja: o convite do Discord vem do arquivo que o bot do Notorious publica ----------
  var join = document.querySelector('.store__join');
  if (join && window.fetch) fetch('notorious/store.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (d) {
    var inv = d && d.invite, url = inv && inv.url;
    if (typeof url !== 'string' || !/^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/.test(url)) return;
    if (inv.expiresAt && Date.parse(inv.expiresAt) < Date.now()) return;
    join.href = url; join.hidden = false;
  }).catch(function () {});

  // ---------- Copiar e-mail ----------
  var copyBtn = document.querySelector('.way__copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var pt = document.documentElement.lang === 'pt-BR';
    var text = copyBtn.textContent, done = pt ? copyBtn.dataset.ptDone : copyBtn.dataset.done;
    function ok() {
      copyBtn.textContent = done; copyBtn.classList.add('is-done');
      setTimeout(function () { copyBtn.textContent = text; copyBtn.classList.remove('is-done'); }, 1600);
    }
    function fallback() {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(document.querySelector('.way--mail .way__desc')); sel.removeAllRanges(); sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyBtn.dataset.copy).then(ok, fallback);
    else fallback();
  });
})();
