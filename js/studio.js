// ===== O estúdio: um cruzamento visto de cima e um apocalipse zumbi, uma etapa por ferramenta =====
// Um jogo 2D desenhado num <canvas>, sem bibliotecas, visto de cima e de perto: um cruzamento de quatro ruas. Cada
// ferramenta é uma etapa de fazer o jogo:
//   Construir   cada clique ergue a próxima parte da cena: ruas e calçadas, prédios, lojas, carros abandonados, barricadas
//               e, por fim, árvores e detalhes (começa como a baseplate vazia do Roblox Studio, com o SpawnLocation no meio)
//   Iluminar    a noite cai; cada clique na beira de uma calçada põe um poste de luz (clicar num poste tira)
//   Interface   cada clique monta uma peça do HUD do jogo: vida, dinheiro, wave, a arma e o botão de upgrade
//   Programar   o script roda e os zumbis começam a andar: 10 waves, cada uma com zumbis mais rápidos e mais fortes
// Pular uma etapa faz as de antes sozinhas (a cena inteira sobe, os postes acendem, o HUD se monta).
// O jogador é a bolinha dourada no meio do cruzamento; os zumbis são as bolinhas verdes e chegam pelas quatro ruas. Cada
// zumbi segue o caminho mais curto até o meio (um mapa de distâncias feito uma vez por cena), contornando os carros, o
// ônibus e as barricadas; os tiros param nessas coisas, então é preciso mirar pelas brechas. Mira com o mouse (ou o dedo)
// e segura para atirar. Cada zumbi morto dá dinheiro; o upgrade troca a arma (pistola, rifle, metralhadora, minigun) e,
// depois da minigun, aumenta o dano.
// Leve de propósito: a cena é desenhada uma vez numa imagem (a de dia e a de noite, com a luz dos postes calculada pixel a
// pixel e arredondada com o ruído azul de js/backdrop.js, sem faixas). A cada quadro só entram por cima os zumbis, os tiros
// e os efeitos, desenhados em lotes (um caminho por cor), em listas de tamanho fixo (nada de lixo para o coletor de memória).
// Teclado: com a cena em foco, Enter age; no jogo, as setas giram a mira, o espaço atira e U faz o upgrade.
// Toque: na etapa do jogo, tocar e segurar mira e atira (por cima da cena a página não rola; rola fora dela).
// Menos movimento: a tela não treme e as obras aparecem sem pulinho; o jogo é o mesmo. Fora da tela, tudo pausa.
(function () {
  'use strict';
  var root = document.documentElement, box = document.querySelector('.studio');
  if (!box) return;
  var canvas = box.querySelector('.studio__canvas'), ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  root.classList.add('has-studio');
  function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
  var reduced = mq('(prefers-reduced-motion: reduce)'), coarse = mq('(pointer: coarse)');
  function one(s) { return box.querySelector(s); }
  function all(s) { return Array.prototype.slice.call(box.querySelectorAll(s)); }
  var toolBtns = all('.tool'), infos = all('.studio__info'), infoBox = one('.studio__infos'), hint = one('.studio__hint');
  var codeEl = one('.studio__code'), said = one('.studio__said'), hurtEl = one('.studio__hurt');
  var banner = one('.studio__banner'), bannerTitle = one('.studio__banner-title'), bannerText = one('.studio__banner-text'), bannerBtn = one('.studio__banner-btn');
  var resetBtn = one('.studio__reset'), nextBtn = one('.studio__next');
  var nextLabel = one('.studio__next-label'), nextName = one('.studio__next-name'), nextCount = one('.studio__next-count');
  var hud = {
    hp: one('.hud__hp'), hpBar: one('.hud__hp-bar i'), hpN: one('.hud__hp-n'),
    money: one('.hud__money'), moneyN: one('.hud__money-n'),
    wave: one('.hud__wave'), waveN: one('.hud__wave-n'),
    gun: one('.hud__gun'), gunName: one('.hud__gun-name'), ammo: one('.hud__ammo'), reload: one('.hud__reload i'),
    up: one('.hud__up'), upWhat: one('.hud__up-what'), upPrice: one('.hud__up-price'), pause: one('.hud__pause')
  };
  function pt() { return root.lang === 'pt-BR'; }
  function tr(pair) { return pair[pt() ? 1 : 0]; }
  function now() { return performance.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(i, j, k) { var h = Math.imul(i + 1013, 374761393) ^ Math.imul(j + 7919, 668265263) ^ Math.imul(k + 31, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  var CSS = {};
  function rgb(c, k) {                  // a cor [r, g, b] (vezes k), em texto para o canvas; guardada para não refazer a conta
    k = k === undefined ? 1 : k;
    var r = Math.round(clamp(c[0] * k, 0, 255)), g = Math.round(clamp(c[1] * k, 0, 255)), b = Math.round(clamp(c[2] * k, 0, 255)), key = (r << 16) | (g << 8) | b;
    return CSS[key] || (CSS[key] = 'rgb(' + r + ',' + g + ',' + b + ')');
  }
  function easeBack(t) { var c = 1.6; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; }
  var TAU = Math.PI * 2, T = now();

  // ---------- As cores ----------
  var C = {
    base: [104, 106, 112], grid: [116, 118, 124], asph: [62, 66, 73], walk: [164, 167, 170],
    dash: [222, 190, 96], zebra: [226, 226, 220], pad: [86, 90, 98], padL: [178, 182, 190], lot: [104, 106, 110], curb: [196, 198, 200], joint: [146, 149, 152]
  };
  var TOWERS = [[152, 166, 184], [184, 172, 142], [130, 146, 130], [198, 188, 174], [142, 134, 152]];
  var TREES = [[86, 150, 72], [98, 162, 84], [74, 138, 78]];
  var CARS = [[214, 72, 64], [240, 200, 82], [70, 128, 210], [236, 236, 232], [72, 74, 80], [96, 178, 120]];
  var SHOPS = [[196, 182, 160], [170, 186, 196], [204, 168, 150], [176, 196, 170], [190, 176, 204]];
  var AWNS = [[[214, 72, 64], [240, 236, 226]], [[52, 120, 92], [236, 232, 220]], [[64, 98, 176], [236, 236, 236]], [[236, 170, 60], [252, 244, 224]], [[150, 76, 140], [240, 228, 236]]];

  // ---------- O tamanho: a escala e o que aparece ----------
  // S: pontos da página por casa. A cena mostra 12 casas no lado menor (bem perto do cruzamento); o jogador fica no meio (0, 0).
  var W = 1, H = 1, dpr = 1, S = 20, PX = 0.05, view = { x0: -10, x1: 10, y0: -10, y1: 10 }, real = null, sized = false, sizeTimer = 0;
  function size(entries) {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    real = (window.HRPixels && HRPixels.read(entries)) || real;
    var px = window.HRPixels ? HRPixels.size(W, H, real, 2) : [Math.round(W * Math.min(window.devicePixelRatio || 1, 2)), Math.round(H * Math.min(window.devicePixelRatio || 1, 2))];
    if (canvas.width !== px[0] || canvas.height !== px[1]) { canvas.width = px[0]; canvas.height = px[1]; }
    dpr = px[0] / W;
    S = clamp(Math.min(W, H) / 12, 18, 60);
    PX = 1 / (S * dpr);
    view = { x0: -W / 2 / S, x1: W / 2 / S, y0: -H / 2 / S, y1: H / 2 / S };
    // a cidade de novo (o que aparece depende do tamanho): na primeira vez na hora; depois, quando o tamanho parar de mudar
    clearTimeout(sizeTimer);
    if (!sized) { sized = true; remake(); } else sizeTimer = setTimeout(remake, 140);
    wake();
  }
  function remake() { genCity(); makeSlots(); previewSlot = null; paintDay(); pathOk = false; makeSprites(); wake(); }
  function world(c, ox, oy) { c.setTransform(S * dpr, 0, 0, S * dpr, W * dpr / 2 + (ox || 0), H * dpr / 2 + (oy || 0)); }

  // ---------- O cruzamento ----------
  // A cena é um cruzamento visto de perto: duas ruas de mão dupla que se cruzam no meio, onde o jogador fica (em cima do
  // SpawnLocation), calçadas dos dois lados e, nas quatro esquinas, um prédio alto e lojas ao longo das calçadas. Na rua
  // ficam carros abandonados, um ônibus, barreiras de concreto, sacos de areia e caixotes: os zumbis contornam, e os tiros
  // param neles (é preciso mirar pelas brechas). Os zumbis só chegam pelas quatro ruas: as esquinas são sólidas.
  // Cada coisa: k (o tipo), cx, cy (o meio) e hw, hh, a (meia largura, meia altura e o giro) ou r (o raio, das redondas).
  // Num braço da rua (0 direita, 1 esquerda, 2 embaixo, 3 em cima), t é a distância do meio e s o lado (-RW a RW); a pista
  // que chega ao cruzamento é a de s < 0 (quem chega anda pela direita).
  // A regra das barricadas: numa mesma altura do braço só uma pista fica fechada, e entre coisas de pistas diferentes há
  // pelo menos 1,6 de rua livre. Assim até o chefão sempre tem por onde passar (em zigue-zague).
  var RW = 1.9, SWK = 0.8, EDGE = RW + SWK, CURB = RW + 0.36, FAR = 40;
  var STEPS = [['Streets', 'Ruas'], ['Buildings', 'Prédios'], ['Shops', 'Lojas'], ['Abandoned cars', 'Carros'], ['Barricades', 'Barricadas'], ['Trees and details', 'Árvores']];   // curtos: cabem no botão do canto até num celular de 320 px
  var ORDER = { mass: 0, cone: 1, bags: 2, crate: 2, dumpster: 2, barrier: 3, sand: 3, car: 4, bus: 4, shop: 5, tower: 6, tree: 7, hydrant: 7 };
  var HZ = { car: 0.45, bus: 0.8, barrier: 0.32, sand: 0.3, crate: 0.36, dumpster: 0.5, bags: 0.3, shop: 1.3, tree: 1.5, hydrant: 0.35, cone: 0.28 };   // a altura (para a sombra)
  var items = [], lamps = [];
  var built = 0, stepT = [], stepEnd = [], fin = [];
  var ARMS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function onArm(arm, t, s) { var u = ARMS[arm]; return [u[0] * t - u[1] * s, u[1] * t + u[0] * s]; }
  function armAngle(arm) { var u = ARMS[arm]; return Math.atan2(u[1], u[0]) + Math.PI / 2; }      // o giro de algo comprido deitado ao longo do braço
  function box2(x0, y0, x1, y1) { return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: Math.abs(x1 - x0) / 2, hh: Math.abs(y1 - y0) / 2, a: 0 }; }   // de canto a canto
  function place(o, k, step, extra) {
    o.k = k; o.step = step; o.d = Math.hypot(o.cx, o.cy);
    if (extra) for (var key in extra) o[key] = extra[key];
    if (o.hw !== undefined) { o.a = o.a || 0; o.ca = Math.cos(o.a); o.sa = Math.sin(o.a); }
    items.push(o); return o;
  }
  // no braço: um retângulo (meia largura w de lado, meia altura h ao longo do braço), girado de mais "tilt"; ou um redondo
  function onArmBox(arm, t, s, w, h, tilt, k, step, extra) { var p = onArm(arm, t, s); return place({ cx: p[0], cy: p[1], hw: w, hh: h, a: armAngle(arm) + (tilt || 0) }, k, step, extra); }
  function onArmDot(arm, t, s, r, k, step, extra) { var p = onArm(arm, t, s); return place({ cx: p[0], cy: p[1], r: r }, k, step, extra); }
  // o que fica em cada braço, de dentro para fora: [t, pista (-1 a que chega, 1 a que sai), tipo, giro, cor, queimado]
  var ARM_STUFF = [
    [[3.85, -1, 'barrier'], [4.5, -1, 'crate', 0.25], [7.5, 1, 'car', -0.28, 0], [10.85, 1, 'bus', 0.04]],
    [[3.95, -1, 'sand', -0.16], [4.75, -1, 'crate', -0.3], [7.8, 1, 'car', 0.42, 2], [10.0, 1, 'car', 1.45, 4, true]],
    [[3.85, -1, 'barrier'], [6.7, 1, 'car', 0.3, 5], [8.6, 1, 'crate', 0.4]],
    [[3.95, -1, 'sand', 0.16], [7.0, 1, 'car', -0.35, 1], [9.7, 1, 'car', 1.4, 3, true]]
  ];
  function genCity() {
    items = [];
    var XM = Math.max(view.x1, -view.x0) + 4, YM = Math.max(view.y1, -view.y0) + 4, q, x, y, w, n, E = EDGE + 0.04;
    for (q = 0; q < 4; q++) {
      var sx = q & 1 ? 1 : -1, sy = q & 2 ? 1 : -1;
      // a esquina inteira é sólida; os prédios e as lojas são desenhados em cima dela
      place(box2(sx * EDGE, sy * EDGE, sx * FAR, sy * FAR), 'mass', 1, { solid: true, hidden: true });
      // o prédio da esquina, alto (a sombra comprida cai na rua)
      var tw = 3.3 + 0.8 * hash(q, 1, 1), th = 3.3 + 0.8 * hash(q, 2, 1);
      place(box2(sx * E, sy * E, sx * (E + tw), sy * (E + th)), 'tower', 1, { c: TOWERS[q % TOWERS.length], z: 3.4 + 2.2 * hash(q, 3, 1), heli: q === 1, tank: q === 2, ac: 2 + (q % 2), seed: q * 97 + 5 });
      // as lojas ao longo da rua de cima ou de baixo e da rua do lado, com o toldo virado para a calçada; atrás delas,
      // prédios mais altos (só um pedaço aparece, na beira da cena)
      for (x = E + tw + 0.16, n = 0; x < XM; n++) {
        w = 2.3 + 0.9 * hash(q, n, 2);
        place(box2(sx * x, sy * E, sx * (x + w), sy * (E + 2.3)), 'shop', 2, { c: SHOPS[(q + n) % SHOPS.length], aw: AWNS[(q * 3 + n) % AWNS.length], fx: 0, fy: -sy, seed: q * 31 + n });
        place(box2(sx * x, sy * (E + 2.5), sx * (x + w), sy * (E + 6.2)), 'tower', 1, { c: TOWERS[(q + n + 2) % TOWERS.length], z: 2.6 + 1.6 * hash(q, n, 4), ac: 1 + (n % 2), seed: q * 53 + n * 7 });
        x += w + 0.12;
      }
      for (y = E + th + 0.16, n = 0; y < YM; n++) {
        w = 2.3 + 0.9 * hash(q, n, 3);
        place(box2(sx * E, sy * y, sx * (E + 2.3), sy * (y + w)), 'shop', 2, { c: SHOPS[(q + n + 1) % SHOPS.length], aw: AWNS[(q * 3 + n + 1) % AWNS.length], fx: -sx, fy: 0, seed: q * 37 + n });
        if (y > E + 6.3) place(box2(sx * (E + 2.5), sy * y, sx * (E + 6.2), sy * (y + w)), 'tower', 1, { c: TOWERS[(q + n + 3) % TOWERS.length], z: 2.6 + 1.6 * hash(q, n, 5), ac: 1 + (n % 2), seed: q * 59 + n * 5 });
        y += w + 0.12;
      }
    }
    for (var arm = 0; arm < 4; arm++) {
      ARM_STUFF[arm].forEach(function (o) {
        var t = o[0], ln = o[1], k = o[2], tilt = o[3] || 0;
        if (k === 'barrier') { onArmBox(arm, t, ln * 0.56, 0.21, 0.43, Math.PI / 2, k, 4, { solid: true }); onArmBox(arm, t, ln * 1.44, 0.21, 0.43, Math.PI / 2, k, 4, { solid: true }); }
        else if (k === 'sand') onArmBox(arm, t, ln * 1.0, 0.95, 0.27, tilt, k, 4, { solid: true });
        else if (k === 'crate') onArmBox(arm, t, ln * 1.3, 0.31, 0.31, tilt, k, 4, { solid: true });
        else if (k === 'car') onArmBox(arm, t, ln * 0.95, 0.47, 0.94, tilt, k, 3, { solid: true, c: CARS[o[4]], wreck: !!o[5] });
        else if (k === 'bus') onArmBox(arm, t, ln * 0.98, 0.58, 2.1, tilt, k, 3, { solid: true });
      });
      // os cones na pista aberta, logo depois da faixa (como num posto de controle)
      onArmDot(arm, 3.4, 0.45, 0.13, 'cone', 4); onArmDot(arm, 3.45, 1.55, 0.13, 'cone', 4);
      // na calçada: o hidrante perto da esquina, uma caçamba (com os sacos de lixo do lado do cruzamento) e as árvores
      onArmDot(arm, 3.55, -(RW + 0.34), 0.15, 'hydrant', 5, { solid: true });
      if (arm !== 3) { onArmBox(arm, 4.25, RW + 0.42, 0.36, 0.62, 0, 'dumpster', 5, { solid: true }); onArmDot(arm, 3.3, RW + 0.4, 0.27, 'bags', 5, { seed: arm }); }
      [[5.7, 1], [6.3, -1], [10.4, 1], [11.0, -1]].forEach(function (tp, m) { onArmDot(arm, tp[0], tp[1] * (RW + 0.46), 0.2, 'tree', 5, { solid: true, cr: 0.52, c: TREES[(arm + m) % 3] }); });
    }
    items.sort(function (a, b) { return ORDER[a.k] - ORDER[b.k] || a.d - b.d; });
  }
  // a distância de um ponto até a coisa mais perto da cena (com a copa das árvores, o toldo das lojas e os postes): os
  // detalhes do chão, as manchas e os postes só vão onde não encostam em nada
  function clearance(x, y, skipLamps) {
    var best = 99, i, it, d;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      var dx = x - it.cx, dy = y - it.cy;
      if (it.r !== undefined) d = Math.hypot(dx, dy) - (it.cr || it.r) - (it.k === 'cone' ? 0.06 : 0);
      else { var lx = dx * it.ca + dy * it.sa, ly = -dx * it.sa + dy * it.ca; d = Math.hypot(Math.max(Math.abs(lx) - it.hw, 0), Math.max(Math.abs(ly) - it.hh, 0)) - (it.k === 'shop' ? 0.34 : 0); }
      if (d < best) best = d;
    }
    if (!skipLamps) for (i = 0; i < lamps.length; i++) { d = Math.hypot(x - lamps[i].x, y - lamps[i].y) - 0.18; if (d < best) best = d; }
    return best;
  }
  function onRoad(x, y, m) { return (Math.abs(y) < RW - m || Math.abs(x) < RW - m) && !(Math.abs(x) < 0.8 + m && Math.abs(y) < 0.8 + m); }
  // a obra: as peças de uma etapa entram do meio para fora (DELAY por casa de distância), cada uma num pulinho
  var DELAY = 40, POP = 420, RIPPLE = 1000;
  function seen(it) { var b = bounds(it); return b[2] > view.x0 && b[0] < view.x1 && b[3] > view.y0 && b[1] < view.y1; }
  function maxD(s) { var m = 0; items.forEach(function (it) { if (it.step === s && !it.hidden && seen(it)) m = Math.max(m, it.d); }); return m; }
  function startStep(s, instant) {
    stepT[s] = now();
    stepEnd[s] = stepT[s] + (instant || reduced ? 0 : s === 0 ? RIPPLE : maxD(s) * DELAY + POP);
    fin[s] = stepEnd[s] <= stepT[s];
    if (s === 0 && !instant && !reduced) { fin[0] = true; paintTo(rippleX, rippleC); fin[0] = false; }      // a cena com as ruas, revelada numa onda
    if (fin[s]) { paintDay(); pathOk = false; }
  }
  function buildNext() {
    if (built >= STEPS.length || T < (stepEnd[built - 1] || 0)) return;
    startStep(built++);
    updateNext();
    wake();
  }
  function ensureCity() {               // as outras etapas precisam da cidade: o que falta sobe de uma vez
    if (built >= STEPS.length && fin[STEPS.length - 1]) return;
    for (var s = 0; s < STEPS.length; s++) { if (s >= built) stepT[s] = now(); stepEnd[s] = now(); fin[s] = true; }
    built = STEPS.length;
    paintDay(); pathOk = false; updateNext();
  }
  function checkSteps() {               // uma etapa terminou de entrar: vai para a imagem da cidade
    for (var s = 0; s < built; s++) if (!fin[s] && T >= stepEnd[s]) {
      fin[s] = true; paintDay(); pathOk = false;
      if (s === STEPS.length - 1) celebrate(tr(['City ready!', 'Cidade pronta!']));
      updateNext();
    }
  }
  function building() { for (var s = 0; s < built; s++) if (!fin[s]) return true; return false; }

  // ---------- Os postes ----------
  var LAMP_R = 4.2, MAXLAMPS = 4;       // só 4 postes: a luz alcança um pouco mais longe
  function inView(x, y, m) { return x > view.x0 + m && x < view.x1 - m && y > view.y0 + m && y < view.y1 - m; }
  // As vagas dos postes: pontos fixos na beira das calçadas (as quatro esquinas e, de 0,25 em 0,25 casa, ao longo das guias),
  // só os que não encostam em nada (árvore, hidrante, caçamba, sacos de lixo). O clique e a prévia vão para a vaga livre mais
  // perto do mouse; a prévia só troca de vaga quando a nova fica claramente mais perto (folga de 0,15 casa). Antes, o poste
  // escorregava pela guia em passos até achar lugar, e em cima de uma árvore a prévia ia e voltava a cada movimento.
  var SLOTS = [], SLIP = 0.15;
  function makeSlots() {
    SLOTS = [];
    var ex = Math.max(view.x1, -view.x0) + 0.5, ey = Math.max(view.y1, -view.y0) + 0.5, t;
    function add(x, y) { if (inView(x, y, 0.3) && clearance(x, y, true) > 0.14) SLOTS.push([x, y]); }
    add(CURB, CURB); add(-CURB, CURB); add(CURB, -CURB); add(-CURB, -CURB);
    for (t = CURB + 0.25; t < ex; t += 0.25) { add(t, CURB); add(t, -CURB); add(-t, CURB); add(-t, -CURB); }
    for (t = CURB + 0.25; t < ey; t += 0.25) { add(CURB, t); add(-CURB, t); add(CURB, -t); add(-CURB, -t); }
  }
  // a vaga livre mais perto de (x, y), até 3 casas; keep: a vaga de antes, que fica enquanto não houver uma bem mais perto
  function snapLamp(x, y, keep) {
    var best = null, bd = Infinity;
    for (var i = 0; i < SLOTS.length; i++) { var q = SLOTS[i], d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = q; } }
    if (keep) { var dk = Math.hypot(keep[0] - x, keep[1] - y); if (dk < 3 && dk <= bd + SLIP) return keep; }
    return bd < 3 ? best : null;
  }
  // o que um clique em (x, y) faz: tira o poste que está ali (ou perto da vaga) ou põe um na vaga; a prévia mostra o mesmo
  var previewSlot = null;
  function lampTarget(x, y, sticky) {
    var i = lampNear(x, y, 0.7);
    if (i >= 0) return { remove: i, p: [lamps[i].x, lamps[i].y] };
    var q = snapLamp(x, y, sticky ? previewSlot : null);
    if (sticky) previewSlot = q;
    if (!q) return null;
    i = lampNear(q[0], q[1], 0.8);
    return i >= 0 ? { remove: i, p: [lamps[i].x, lamps[i].y] } : { p: q };
  }
  // os postes do Iluminar automático: as quatro esquinas, depois um longe em cada rua (alternando o lado) e, por fim, os do
  // meio das calçadas; sempre na vaga livre mais perto do ponto pedido
  function autoSpots() {
    var out = [], ex = Math.min(view.x1, -view.x0), ey = Math.min(view.y1, -view.y0);
    function take(x, y) {
      var q = snapLamp(x, y);
      if (!q || Math.hypot(q[0] - x, q[1] - y) > 1.2 || !inView(q[0], q[1], 0.5)) return;
      for (var i = 0; i < out.length; i++) if (Math.hypot(out[i][0] - q[0], out[i][1] - q[1]) < 1.6) return;
      out.push(q);
    }
    take(CURB, CURB); take(-CURB, CURB); take(CURB, -CURB); take(-CURB, -CURB);
    var arm, t, s1, sg;
    for (arm = 0; arm < 4; arm++) { t = Math.min(7.2, (arm < 2 ? ex : ey) - 0.8); s1 = arm % 2 ? CURB : -CURB; sg = arm % 2 ? -1 : 1; if (arm < 2) take(sg * t, s1); else take(s1, sg * t); }
    for (arm = 0; arm < 4; arm++) { s1 = arm % 2 ? -CURB : CURB; sg = arm % 2 ? -1 : 1; if (arm < 2) take(sg * 4.9, s1); else take(s1, sg * 4.9); }
    return out.slice(0, MAXLAMPS);
  }
  function lampNear(x, y, d) { for (var i = 0; i < lamps.length; i++) if (Math.hypot(lamps[i].x - x, lamps[i].y - y) < d) return i; return -1; }
  function toggleLamp(x, y) {            // põe ou tira um poste (o mesmo que a prévia mostra); devolve false quando o clique não mudou nada
    var t = lampTarget(x, y, !!hover);
    if (!t) return false;
    if (t.remove !== undefined) { lamps.splice(t.remove, 1); lampsChanged(); return true; }
    if (lamps.length >= MAXLAMPS) return false;
    addLamp(t.p[0], t.p[1]);
    return true;
  }
  function addLamp(x, y) { lamps.push({ x: x, y: y, t: now() }); lampsChanged(); burst(x, y, 10, 1, 1.4, 0.45); }
  function autoLamp() {
    var spots = autoSpots();
    for (var i = 0; i < spots.length; i++) if (lampNear(spots[i][0], spots[i][1], 0.8) < 0) { addLamp(spots[i][0], spots[i][1]); return; }
  }
  function ensureLamps() { if (lamps.length) return; autoSpots().slice(0, MAXLAMPS).forEach(function (p) { lamps.push({ x: p[0], y: p[1], t: now() }); }); lampsChanged(); }
  function lampsChanged() { paintDay(true); updateNext(); wake(); }

  // ---------- A imagem da cidade (de dia) ----------
  var dayC = document.createElement('canvas'), dayX = dayC.getContext('2d');
  var nightC = document.createElement('canvas'), nightX = nightC.getContext('2d');
  var oldC = document.createElement('canvas'), oldX = oldC.getContext('2d');           // a noite de antes de mudar um poste (a luz acende devagar)
  var shadeC = document.createElement('canvas'), shadeX = shadeC.getContext('2d');
  var rippleC = document.createElement('canvas'), rippleX = rippleC.getContext('2d');
  var nightOk = false, lampFade = 1, lampFadeT = 0;
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fit(c) { if (c.width !== canvas.width || c.height !== canvas.height) { c.width = canvas.width; c.height = canvas.height; } }
  function paintDay(lampChange) {
    if (lampChange && nightOk) { fit(oldC); oldX.setTransform(1, 0, 0, 1, 0, 0); oldX.clearRect(0, 0, oldC.width, oldC.height); oldX.drawImage(nightC, 0, 0); lampFade = 0; lampFadeT = now(); }
    paintTo(dayX, dayC);
    nightOk = false;
    if (nightGoal > 0 || night > 0) relight();
  }
  function paintTo(c, cv) {
    fit(cv);
    c.setTransform(1, 0, 0, 1, 0, 0);
    world(c);
    if (fin[0]) ground(c); else baseplate(c);
    var i, it;
    // as sombras: todas numa camada só (preta) que entra de uma vez, meio transparente (sombra sobre sombra não escurece mais)
    fit(shadeC); shadeX.setTransform(1, 0, 0, 1, 0, 0); shadeX.clearRect(0, 0, shadeC.width, shadeC.height); world(shadeX);
    shadeX.fillStyle = '#000'; shadeX.strokeStyle = '#000';
    for (i = 0; i < items.length; i++) { it = items[i]; if (fin[it.step]) shadow(shadeX, it); }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.3; c.drawImage(shadeC, 0, 0); c.globalAlpha = 1; world(c);
    // as coisas baixas (na rua e na calçada), as lojas, a sombra dos prédios altos no telhado das lojas, os prédios e, por
    // cima, as árvores e os postes
    drawPass(c, 1, 4); drawPass(c, 5, 5); roofShade(c); drawPass(c, 6, 6); drawPass(c, 7, 7);
    for (i = 0; i < lamps.length; i++) drawLamp(c, lamps[i]);
  }
  function drawPass(c, a, b) { for (var i = 0; i < items.length; i++) { var it = items[i], o = ORDER[it.k]; if (o >= a && o <= b && fin[it.step] && !it.hidden) drawItem(c, it); } }
  function roofShade(c) {               // a sombra dos prédios altos que cai no telhado das lojas
    var i, it, any = false;
    c.save(); c.beginPath();
    for (i = 0; i < items.length; i++) { it = items[i]; if (it.k === 'shop' && fin[it.step]) { c.rect(it.cx - it.hw, it.cy - it.hh, it.hw * 2, it.hh * 2); any = true; } }
    if (!any) { c.restore(); return; }
    c.clip(); c.beginPath(); any = false;
    for (i = 0; i < items.length; i++) { it = items[i]; if (it.k === 'tower' && fin[it.step]) { hullPath(c, it, it.z - HZ.shop); any = true; } }
    if (any) { c.globalAlpha = 0.3; c.fillStyle = '#000'; c.fill(); c.globalAlpha = 1; }
    c.restore();
  }
  function viewRect(c, color, m) { c.fillStyle = rgb(color); c.fillRect(view.x0 - m, view.y0 - m, view.x1 - view.x0 + 2 * m, view.y1 - view.y0 + 2 * m); }
  function baseplate(c) {               // a baseplate do Roblox Studio: cinza, com a grade, e o SpawnLocation no meio
    viewRect(c, C.base, 1);
    c.beginPath();
    for (var x = Math.floor(view.x0) - 1; x <= view.x1 + 1; x++) { c.moveTo(x, view.y0 - 1); c.lineTo(x, view.y1 + 1); }
    for (var y = Math.floor(view.y0) - 1; y <= view.y1 + 1; y++) { c.moveTo(view.x0 - 1, y); c.lineTo(view.x1 + 1, y); }
    c.lineWidth = PX * 1.2; c.strokeStyle = rgb(C.grid); c.stroke();
    spawnPad(c);
  }
  function spawnPad(c) {
    c.beginPath(); rr(c, -0.8, -0.8, 1.6, 1.6, 0.14); c.fillStyle = rgb(C.pad); c.fill();
    c.beginPath(); rr(c, -0.42, -0.42, 0.84, 0.84, 0.08); c.fillStyle = rgb(C.padL); c.fill();
  }
  // um retângulo ou um polígono dado em coordenadas do braço (t ao longo, s de lado)
  function armRect(c, arm, t0, t1, s0, s1) { var p = onArm(arm, t0, s0), q = onArm(arm, t1, s1); c.rect(Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])); }
  function armPoly(c, arm, pts) { for (var i = 0; i < pts.length; i++) { var p = onArm(arm, pts[i][0], pts[i][1]); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.closePath(); }
  function ground(c) {                  // o asfalto, as calçadas com a guia, as faixas e o SpawnLocation no meio
    viewRect(c, C.asph, 1);
    var XM = Math.max(view.x1, -view.x0) + 1, YM = Math.max(view.y1, -view.y0) + 1, q, t, arm, s, i, k, p;
    // rachaduras finas no asfalto (sempre nos mesmos lugares, e só onde não ficam por baixo de nada)
    c.beginPath();
    for (i = 0; i < 14; i++) {
      arm = i % 4; p = onArm(arm, 2.4 + 12 * hash(i, 8, 11), -1.6 + 3.2 * hash(i, 9, 11));
      var pts = [[p[0], p[1]]], ang = hash(i, 10, 11) * TAU, ok = true;
      for (var k = 0; k < 4; k++) { ang += (hash(i, k, 12) - 0.5) * 1.6; pts.push([pts[k][0] + Math.cos(ang) * 0.32, pts[k][1] + Math.sin(ang) * 0.32]); }
      for (k = 0; k < pts.length && ok; k++) ok = onRoad(pts[k][0], pts[k][1], 0.1) && clearance(pts[k][0], pts[k][1], true) > 0.12;
      if (!ok) continue;
      c.moveTo(pts[0][0], pts[0][1]); for (k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]);
    }
    c.lineWidth = 0.035; c.strokeStyle = rgb(C.asph, 0.74); c.stroke();
    // as calçadas (um L em cada esquina, com a guia arredondada) e, atrás, os terrenos
    for (q = 0; q < 4; q++) {
      c.save(); c.scale(q & 1 ? 1 : -1, q & 2 ? 1 : -1);
      c.beginPath(); rr(c, RW, RW, FAR, FAR, 0.62); c.fillStyle = rgb(C.walk); c.fill();
      c.lineWidth = 0.1; c.strokeStyle = rgb(C.curb); c.stroke();
      c.fillStyle = rgb(C.lot); c.fillRect(EDGE, EDGE, FAR, FAR);
      c.beginPath();                    // as juntas das placas da calçada
      for (t = RW + 0.95; t < XM; t += 0.8) c.rect(t, RW + 0.07, 0.025, SWK - 0.07);
      for (t = RW + 0.95; t < YM; t += 0.8) c.rect(RW + 0.07, t, SWK - 0.07, 0.025);
      c.fillStyle = rgb(C.joint); c.fill();
      c.restore();
    }
    // a faixa dupla amarela no meio das ruas
    var L0 = 3.3;
    c.beginPath();
    c.rect(L0, -0.11, XM - L0, 0.07); c.rect(L0, 0.04, XM - L0, 0.07); c.rect(-XM, -0.11, XM - L0, 0.07); c.rect(-XM, 0.04, XM - L0, 0.07);
    c.rect(-0.11, L0, 0.07, YM - L0); c.rect(0.04, L0, 0.07, YM - L0); c.rect(-0.11, -YM, 0.07, YM - L0); c.rect(0.04, -YM, 0.07, YM - L0);
    c.fillStyle = rgb(C.dash); c.fill();
    // a faixa de pedestres, a linha de parar e a seta, na pista que chega
    c.beginPath();
    for (arm = 0; arm < 4; arm++) {
      for (i = 0; i < 8; i++) { s = -1.66 + i * 0.44; armRect(c, arm, 2.1, 2.86, s, s + 0.24); }
      armRect(c, arm, 3.08, 3.22, -RW + 0.14, -0.2);
      var ar = [[6.9, -1.0], [6.9, -0.9], [6.1, -0.9], [6.1, -0.74], [5.62, -0.95], [6.1, -1.16], [6.1, -1.0]], free = true;
      for (k = 0; k < ar.length && free; k++) { p = onArm(arm, ar[k][0], ar[k][1]); free = clearance(p[0], p[1], true) > 0.1; }
      if (free) armPoly(c, arm, ar);
    }
    c.fillStyle = rgb(C.zebra); c.fill();
    // os bueiros
    [[-1.15, 1.1], [6.2, 1.15], [-1.05, -5.2], [-6.0, -1.1], [1.1, 5.0], [-1.1, 7.6], [9.4, -1.05], [-9.0, 1.1]].forEach(function (m) {
      if (!onRoad(m[0], m[1], 0.35) || clearance(m[0], m[1], true) < 0.4) return;
      c.beginPath(); c.arc(m[0], m[1], 0.3, 0, TAU); c.fillStyle = rgb(C.asph, 0.72); c.fill();
      c.beginPath(); c.arc(m[0], m[1], 0.24, 0, TAU); c.fillStyle = rgb(C.asph, 1.14); c.fill();
      c.fillStyle = rgb(C.asph, 0.8); for (var g = -1; g <= 1; g++) c.fillRect(m[0] - 0.17, m[1] + g * 0.09 - 0.014, 0.34, 0.028);
    });
    spawnPad(c);
  }
  var SX = 0.26, SY = 0.32;              // o sol vem do alto à esquerda: a sombra vai para baixo e para a direita
  // o contorno da sombra de uma caixa girada de altura z: a caixa e a caixa deslocada, juntas (o fecho convexo dos 8 cantos)
  var HULL = [];
  for (var hk = 0; hk < 8; hk++) HULL.push([0, 0]);
  function hullPath(c, it, z) {
    var dx = SX * z, dy = SY * z, i, k, n = 0, P = HULL;
    for (k = 0; k < 8; k++) {
      var lx = (k & 1) ? it.hw : -it.hw, ly = (k & 2) ? it.hh : -it.hh, o = k >= 4 ? 1 : 0;
      P[k][0] = it.cx + lx * it.ca - ly * it.sa + dx * o; P[k][1] = it.cy + lx * it.sa + ly * it.ca + dy * o;
    }
    P.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var H2 = [];
    function cross(o2, a, b) { return (a[0] - o2[0]) * (b[1] - o2[1]) - (a[1] - o2[1]) * (b[0] - o2[0]); }
    for (i = 0; i < 8; i++) { while (n >= 2 && cross(H2[n - 2], H2[n - 1], P[i]) <= 0) { H2.pop(); n--; } H2.push(P[i]); n++; }
    for (i = 6, k = n + 1; i >= 0; i--) { while (n >= k && cross(H2[n - 2], H2[n - 1], P[i]) <= 0) { H2.pop(); n--; } H2.push(P[i]); n++; }
    c.moveTo(H2[0][0], H2[0][1]); for (i = 1; i < n - 1; i++) c.lineTo(H2[i][0], H2[i][1]); c.closePath();
  }
  var AWN = { cx: 0, cy: 0, hw: 0, hh: 0, ca: 1, sa: 0 };
  function shadow(c, it) {
    var k = it.k;
    if (it.hidden) return;
    var z = it.z || HZ[k] || 0.3;
    if (it.r !== undefined) { c.beginPath(); c.arc(it.cx + SX * z, it.cy + SY * z, (it.cr || it.r) * 0.96, 0, TAU); c.fill(); return; }
    c.beginPath(); hullPath(c, it, z);
    if (k === 'shop') {                 // o toldo também faz sombra na calçada
      AWN.cx = it.cx + it.fx * (it.hw + 0.13); AWN.cy = it.cy + it.fy * (it.hh + 0.13);
      AWN.hw = it.fx ? 0.17 : it.hw - 0.06; AWN.hh = it.fy ? 0.17 : it.hh - 0.06;
      hullPath(c, AWN, 0.95);
    }
    c.fill();
  }
  function drawItem(c, it) {
    switch (it.k) {
      case 'tower': drawTower(c, it); break;
      case 'shop': drawShop(c, it); break;
      case 'car': drawCar(c, it); break;
      case 'bus': drawBus(c, it); break;
      case 'barrier': drawBarrier(c, it); break;
      case 'sand': drawSand(c, it); break;
      case 'crate': drawCrate(c, it); break;
      case 'dumpster': drawDumpster(c, it); break;
      case 'bags': drawBags(c, it); break;
      case 'cone': drawCone(c, it); break;
      case 'tree': drawTree(c, it); break;
      case 'hydrant': drawHydrant(c, it); break;
    }
  }
  function enter(c, it, a) { c.save(); c.translate(it.cx, it.cy); c.rotate(a === undefined ? it.a : a); }
  function drawTower(c, it) {
    var x = it.cx - it.hw, y = it.cy - it.hh, w = it.hw * 2, h = it.hh * 2, col = it.c, a;
    c.fillStyle = rgb(col, 0.74); c.fillRect(x, y, w, h);         // a mureta em volta do terraço
    c.fillStyle = rgb(col, 1.08); c.fillRect(x, y, w, 0.045); c.fillRect(x, y, 0.045, h);
    c.fillStyle = rgb(col); c.fillRect(x + 0.12, y + 0.12, w - 0.24, h - 0.24);
    c.fillStyle = rgb(col, 0.86); c.fillRect(x + 0.12, y + 0.12, w - 0.24, 0.08); c.fillRect(x + 0.12, y + 0.12, 0.08, h - 0.24);
    // a casinha da escada
    var bx = x + w - 1.05, by = y + 0.32;
    c.fillStyle = rgb(col, 0.66); c.fillRect(bx + 0.1, by + 0.12, 0.7, 0.55);
    c.fillStyle = rgb(col, 0.92); c.fillRect(bx, by, 0.7, 0.55);
    c.fillStyle = rgb(col, 1.06); c.fillRect(bx, by, 0.7, 0.05);
    for (a = 0; a < it.ac; a++) {   // as máquinas do ar-condicionado
      var ax = x + 0.3 + (w - 1.0) * hash(it.seed, a, 3), ay = y + 1.0 + (h - 1.5) * hash(it.seed, a, 5);
      if ((it.heli || it.tank) && Math.hypot(ax + 0.17 - (x + w / 2), ay + 0.13 - (y + h / 2)) < Math.min(w, h) * 0.38) continue;
      c.fillStyle = rgb(col, 0.78); c.fillRect(ax + 0.06, ay + 0.08, 0.36, 0.28);
      c.fillStyle = rgb([214, 216, 218]); c.fillRect(ax, ay, 0.36, 0.28);
      c.fillStyle = rgb([150, 154, 160]); c.fillRect(ax + 0.06, ay + 0.07, 0.24, 0.05); c.fillRect(ax + 0.06, ay + 0.16, 0.24, 0.05);
    }
    var mx = x + w / 2, my = y + h / 2, hr = Math.min(w, h) * 0.28;
    if (it.heli) {                  // o heliponto
      c.beginPath(); c.arc(mx, my, hr, 0, TAU); c.fillStyle = rgb([72, 74, 80]); c.fill();
      c.lineWidth = 0.07; c.strokeStyle = rgb([236, 206, 90]); c.beginPath(); c.arc(mx, my, hr - 0.09, 0, TAU); c.stroke();
      c.fillStyle = rgb([236, 236, 230]); c.fillRect(mx - hr * 0.42, my - hr * 0.48, hr * 0.16, hr * 0.96); c.fillRect(mx + hr * 0.26, my - hr * 0.48, hr * 0.16, hr * 0.96); c.fillRect(mx - hr * 0.3, my - hr * 0.08, hr * 0.6, hr * 0.16);
    }
    if (it.tank) {                  // a caixa d'água
      c.beginPath(); c.arc(mx + 0.12, my + 0.15, hr * 0.8, 0, TAU); c.fillStyle = rgb(col, 0.7); c.fill();
      c.beginPath(); c.arc(mx, my, hr * 0.8, 0, TAU); c.fillStyle = rgb([156, 162, 170]); c.fill();
      c.beginPath(); c.arc(mx, my, hr * 0.62, 0, TAU); c.fillStyle = rgb([190, 196, 204]); c.fill();
      c.beginPath(); c.arc(mx - hr * 0.08, my - hr * 0.08, hr * 0.2, 0, TAU); c.fillStyle = rgb([214, 218, 224]); c.fill();
    }
  }
  function drawShop(c, it) {            // a loja: o telhado, uma máquina de ar e o toldo listrado por cima da calçada
    var lw = it.fx ? it.hh : it.hw, lh = it.fx ? it.hw : it.hh, col = it.c, aw = it.aw, i;
    enter(c, it, Math.atan2(it.fx, -it.fy));
    c.fillStyle = rgb(col, 0.7); c.fillRect(-lw, -lh, lw * 2, lh * 2);
    c.fillStyle = rgb(col); c.fillRect(-lw + 0.08, -lh + 0.08, lw * 2 - 0.16, lh * 2 - 0.16);
    c.fillStyle = rgb(col, 0.88); c.fillRect(-lw + 0.08, -lh + 0.08, lw * 2 - 0.16, 0.06);
    var ux = -lw + 0.3 + (lw * 2 - 0.95) * hash(it.seed, 1, 7), uy = lh - 0.72;
    c.fillStyle = rgb(col, 0.76); c.fillRect(ux + 0.06, uy + 0.08, 0.36, 0.28);
    c.fillStyle = rgb([214, 216, 218]); c.fillRect(ux, uy, 0.36, 0.28);
    c.fillStyle = rgb([150, 154, 160]); c.fillRect(ux + 0.06, uy + 0.07, 0.24, 0.05); c.fillRect(ux + 0.06, uy + 0.16, 0.24, 0.05);
    var vx = -lw + 0.45 + (lw * 2 - 0.9) * hash(it.seed, 2, 7), vy = lh * 0.15;
    c.beginPath(); c.arc(vx, vy, 0.12, 0, TAU); c.fillStyle = rgb(col, 0.72); c.fill();
    c.beginPath(); c.arc(vx - 0.02, vy - 0.02, 0.08, 0, TAU); c.fillStyle = rgb([190, 192, 196]); c.fill();
    var y0 = -lh - 0.3, y1 = -lh + 0.34, x0 = -lw + 0.06, ww = lw * 2 - 0.12, n = Math.max(4, Math.round(ww / 0.26)), sw = ww / n;
    for (i = 0; i < n; i++) { c.fillStyle = rgb(aw[i % 2]); c.fillRect(x0 + i * sw, y0, sw + 0.004, y1 - y0); }
    c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(x0, y0, ww, 0.2);           // a beira do toldo desce: mais escura
    c.fillStyle = rgb(aw[0], 0.6); c.fillRect(x0, y0 - 0.035, ww, 0.05);
    c.restore();
  }
  function drawCar(c, it) {
    var hw = it.hw, hh = it.hh, col = it.wreck ? [78, 72, 68] : it.c, glass = it.wreck ? [26, 26, 28] : [50, 62, 80];
    enter(c, it);
    c.beginPath(); rr(c, -hw, -hh, hw * 2, hh * 2, 0.18); c.fillStyle = rgb(col, 0.6); c.fill();
    c.beginPath(); rr(c, -hw + 0.045, -hh + 0.045, hw * 2 - 0.09, hh * 2 - 0.09, 0.15); c.fillStyle = rgb(col); c.fill();
    c.beginPath(); rr(c, -hw + 0.1, -hh + 0.1, hw * 2 - 0.2, 0.34, 0.08); c.fillStyle = rgb(col, 1.12); c.fill();      // o capô
    c.fillStyle = rgb(glass);
    c.beginPath(); c.moveTo(-hw + 0.08, -hh + 0.8); c.lineTo(hw - 0.08, -hh + 0.8); c.lineTo(hw - 0.15, -hh + 0.5); c.lineTo(-hw + 0.15, -hh + 0.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-hw + 0.1, hh - 0.54); c.lineTo(hw - 0.1, hh - 0.54); c.lineTo(hw - 0.15, hh - 0.32); c.lineTo(-hw + 0.15, hh - 0.32); c.closePath(); c.fill();
    c.beginPath(); rr(c, -hw + 0.1, -hh + 0.82, hw * 2 - 0.2, hh * 2 - 1.38, 0.08); c.fillStyle = rgb(col, 1.06); c.fill();   // o teto
    c.fillStyle = rgb(col, 1.2); c.fillRect(-hw + 0.16, -hh + 0.9, hw * 2 - 0.32, 0.05);
    c.fillStyle = it.wreck ? '#5a5652' : '#f8f0d2'; c.fillRect(-hw + 0.07, -hh + 0.025, 0.15, 0.06); c.fillRect(hw - 0.22, -hh + 0.025, 0.15, 0.06);
    c.fillStyle = it.wreck ? '#4a2c28' : '#cf3a3a'; c.fillRect(-hw + 0.07, hh - 0.085, 0.15, 0.06); c.fillRect(hw - 0.22, hh - 0.085, 0.15, 0.06);
    c.fillStyle = rgb(col, 0.66); c.fillRect(-hw - 0.07, -hh + 0.64, 0.09, 0.11); c.fillRect(hw - 0.02, -hh + 0.64, 0.09, 0.11);
    c.restore();
  }
  function drawBus(c, it) {             // o ônibus visto de cima: o teto branco, a faixa azul, o para-brisa e as máquinas de ar
    var hw = it.hw, hh = it.hh, i, g;
    enter(c, it);
    c.beginPath(); rr(c, -hw, -hh, hw * 2, hh * 2, 0.15); c.fillStyle = rgb([56, 64, 78]); c.fill();
    c.beginPath(); rr(c, -hw + 0.05, -hh + 0.05, hw * 2 - 0.1, hh * 2 - 0.1, 0.12); c.fillStyle = rgb([226, 230, 234]); c.fill();
    c.fillStyle = rgb([56, 116, 196]); c.fillRect(-hw + 0.05, -hh + 0.34, 0.09, hh * 2 - 0.56); c.fillRect(hw - 0.14, -hh + 0.34, 0.09, hh * 2 - 0.56);
    c.beginPath(); rr(c, -hw + 0.09, -hh + 0.07, hw * 2 - 0.18, 0.24, 0.07); c.fillStyle = rgb([44, 54, 70]); c.fill();
    for (i = 0; i < 2; i++) {
      var y = -1.05 + i * 1.35;
      c.fillStyle = rgb([196, 200, 206]); c.fillRect(-0.29, y + 0.07, 0.62, 0.58);
      c.fillStyle = rgb([176, 182, 192]); c.fillRect(-0.31, y, 0.62, 0.58);
      c.fillStyle = rgb([148, 154, 164]); for (g = 0; g < 4; g++) c.fillRect(-0.25, y + 0.08 + g * 0.12, 0.5, 0.045);
    }
    c.fillStyle = rgb([204, 208, 214]); c.fillRect(-0.2, 1.36, 0.4, 0.4);
    c.fillStyle = rgb([186, 190, 196]); c.fillRect(-0.2, 1.36, 0.4, 0.05);
    c.restore();
  }
  function drawBarrier(c, it) {         // a barreira de concreto (new jersey), com as pontas pintadas
    var hw = it.hw, hh = it.hh;
    enter(c, it);
    c.beginPath(); rr(c, -hw, -hh, hw * 2, hh * 2, 0.05); c.fillStyle = rgb([148, 148, 144]); c.fill();
    c.beginPath(); rr(c, -hw + 0.05, -hh + 0.03, hw * 2 - 0.1, hh * 2 - 0.06, 0.04); c.fillStyle = rgb([204, 204, 198]); c.fill();
    c.fillStyle = rgb([226, 226, 220]); c.fillRect(-0.035, -hh + 0.05, 0.07, hh * 2 - 0.1);
    c.fillStyle = rgb([214, 70, 56]); c.fillRect(-hw + 0.05, -hh + 0.03, hw * 2 - 0.1, 0.1); c.fillRect(-hw + 0.05, hh - 0.13, hw * 2 - 0.1, 0.1);
    c.restore();
  }
  function drawSand(c, it) {            // a trincheira de sacos de areia: duas fileiras e, por cima, uma terceira
    var hw = it.hw, n = Math.max(3, Math.round(hw * 2 / 0.34)), bw = hw * 2 / n, i, row;
    enter(c, it);
    for (row = 0; row < 3; row++) {
      var y = row === 0 ? -0.12 : row === 1 ? 0.12 : 0, off = row === 2 ? bw / 2 : 0, m = row === 2 ? n - 1 : n, k = row === 2 ? 1.08 : 0.92;
      for (i = 0; i < m; i++) {
        var x = -hw + off + bw * (i + 0.5);
        c.beginPath(); c.ellipse(x, y, bw * 0.56, 0.145, 0, 0, TAU); c.fillStyle = rgb([132, 114, 80], k); c.fill();
        c.beginPath(); c.ellipse(x - 0.02, y - 0.025, bw * 0.45, 0.1, 0, 0, TAU); c.fillStyle = rgb([186, 166, 122], k); c.fill();
      }
    }
    c.restore();
  }
  function drawCrate(c, it) {           // o caixote de madeira
    var h = it.hw, i;
    enter(c, it);
    c.fillStyle = rgb([116, 80, 48]); c.fillRect(-h, -h, h * 2, h * 2);
    c.fillStyle = rgb([178, 132, 82]); c.fillRect(-h + 0.05, -h + 0.05, h * 2 - 0.1, h * 2 - 0.1);
    c.fillStyle = rgb([148, 106, 64]); for (i = 1; i < 3; i++) c.fillRect(-h + 0.05, -h + i * h * 2 / 3 - 0.016, h * 2 - 0.1, 0.032);
    c.beginPath(); c.rect(-h + 0.05, -h + 0.05, h * 2 - 0.1, h * 2 - 0.1); c.clip();
    c.strokeStyle = rgb([130, 92, 54]); c.lineWidth = 0.08; c.beginPath(); c.moveTo(-h, -h); c.lineTo(h, h); c.stroke();
    c.restore();
  }
  function drawDumpster(c, it) {        // a caçamba de lixo, com dois sacos do lado
    var hw = it.hw, hh = it.hh;
    enter(c, it);
    c.fillStyle = rgb([38, 80, 56]); c.fillRect(-hw, -hh, hw * 2, hh * 2);
    c.fillStyle = rgb([62, 124, 86]); c.fillRect(-hw + 0.05, -hh + 0.05, hw * 2 - 0.1, hh - 0.08); c.fillRect(-hw + 0.05, 0.03, hw * 2 - 0.1, hh - 0.08);
    c.fillStyle = rgb([86, 152, 108]); c.fillRect(-hw + 0.05, -hh + 0.05, hw * 2 - 0.1, 0.06); c.fillRect(-hw + 0.05, 0.03, hw * 2 - 0.1, 0.06);
    c.restore();
  }
  function drawBags(c, it) {            // dois sacos de lixo pretos, amarrados
    var x = it.cx, y = it.cy, g = it.seed % 2 ? 1 : -1;
    c.beginPath(); c.arc(x + 0.08 * g, y - 0.09, 0.16, 0, TAU); c.fillStyle = rgb([34, 36, 40]); c.fill();
    c.beginPath(); c.arc(x - 0.09 * g, y + 0.11, 0.13, 0, TAU); c.fill();
    c.beginPath(); c.arc(x + 0.03 * g, y - 0.14, 0.055, 0, TAU); c.arc(x - 0.13 * g, y + 0.07, 0.045, 0, TAU); c.fillStyle = rgb([86, 90, 98]); c.fill();
  }
  function drawCone(c, it) {
    var x = it.cx, y = it.cy;
    c.beginPath(); rr(c, x - 0.17, y - 0.17, 0.34, 0.34, 0.06); c.fillStyle = rgb([66, 66, 70]); c.fill();
    c.beginPath(); c.arc(x, y, 0.14, 0, TAU); c.fillStyle = rgb([238, 112, 40]); c.fill();
    c.beginPath(); c.arc(x, y, 0.09, 0, TAU); c.fillStyle = rgb([246, 242, 234]); c.fill();
    c.beginPath(); c.arc(x, y, 0.045, 0, TAU); c.fillStyle = rgb([252, 142, 62]); c.fill();
  }
  function drawTree(c, it) {
    var x = it.cx, y = it.cy, r = it.cr, col = it.c;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = rgb(col, 0.72); c.fill();
    c.beginPath(); c.arc(x - r * 0.07, y - r * 0.07, r * 0.86, 0, TAU); c.fillStyle = rgb(col); c.fill();
    c.beginPath(); c.arc(x - r * 0.3, y - r * 0.32, r * 0.42, 0, TAU); c.fillStyle = rgb(col, 1.2); c.fill();
  }
  function drawHydrant(c, it) {
    var x = it.cx, y = it.cy;
    c.fillStyle = rgb([146, 34, 30]); c.fillRect(x - 0.21, y - 0.05, 0.42, 0.1);
    c.beginPath(); c.arc(x, y, 0.15, 0, TAU); c.fill();
    c.beginPath(); c.arc(x, y, 0.115, 0, TAU); c.fillStyle = rgb([214, 58, 48]); c.fill();
    c.beginPath(); c.arc(x - 0.025, y - 0.025, 0.05, 0, TAU); c.fillStyle = rgb([242, 126, 106]); c.fill();
  }
  function drawLamp(c, L) {             // o poste visto de cima: a base escura e a luminária (que à noite acende)
    c.beginPath(); c.arc(L.x, L.y, 0.17, 0, TAU); c.fillStyle = rgb([58, 60, 66]); c.fill();
    c.beginPath(); c.arc(L.x, L.y, 0.12, 0, TAU); c.fillStyle = rgb([226, 224, 214]); c.fill();
  }
  // uma peça que ainda está entrando, desenhada por cima da imagem da cidade: o pulinho (k) a partir do meio dela
  function drawPop(c, it, k) {
    if (it.hidden) return;
    c.save(); c.translate(it.cx, it.cy); c.scale(k, k); c.translate(-it.cx, -it.cy);
    c.globalAlpha = 0.3 * clamp(k, 0, 1); c.fillStyle = '#000'; c.strokeStyle = '#000'; shadow(c, it); c.globalAlpha = 1;
    drawItem(c, it);
    c.restore();
  }

  // ---------- A noite: a luz dos postes, pixel a pixel ----------
  // Cada pixel da cidade de dia vezes a luz que chega nele: um azul fraco de lua em tudo (AMB) e, perto de cada poste, uma
  // poça quente que cai em curva até LAMP_R; em volta da luminária, um brilho somado. A conta é feita em precisão total e
  // arredondada uma vez só, com a máscara de ruído azul (sem faixas nos degradês).
  var AMB = [0.3, 0.33, 0.48], WARM = [0.98, 0.8, 0.56], HALO = [255, 198, 124];
  var NOISE = null;
  function noise() {
    if (NOISE) return NOISE;
    if (window.HRBackdrop && HRBackdrop.noise) NOISE = HRBackdrop.noise();
    if (!NOISE || NOISE.length !== 4096) { NOISE = new Float32Array(4096); for (var i = 0; i < 4096; i++) NOISE[i] = hash(i, 5, 9); }
    return NOISE;
  }
  function relight() {
    var w = dayC.width, h = dayC.height;
    if (!w || !h) return;
    fit(nightC);
    var src = dayX.getImageData(0, 0, w, h).data, img = nightX.createImageData(w, h), out = img.data, n = w * h;
    var I = new Float32Array(n), G2 = new Float32Array(n), k = S * dpr, cx = w / 2, cy = h / 2, th = noise();
    lamps.forEach(function (L) {
      var lx = cx + L.x * k, ly = cy + L.y * k, R = LAMP_R * k, R2 = R * R, hR = 0.8 * k, hR2 = hR * hR;
      var xa = Math.max(0, Math.floor(lx - R)), xb = Math.min(w - 1, Math.ceil(lx + R)), ya = Math.max(0, Math.floor(ly - R)), yb = Math.min(h - 1, Math.ceil(ly + R));
      for (var y = ya; y <= yb; y++) {
        var dy = y + 0.5 - ly, dy2 = dy * dy, row = y * w;
        if (dy2 >= R2) continue;
        for (var x = xa; x <= xb; x++) {
          var dx = x + 0.5 - lx, d2 = dx * dx + dy2;
          if (d2 >= R2) continue;
          var f = 1 - d2 / R2; I[row + x] += f * f;
          if (d2 < hR2) { var g = 1 - Math.sqrt(d2 / hR2); G2[row + x] += g * g * g; }
        }
      }
    });
    for (var y = 0, i = 0; y < h; y++) {
      var my = (y & 63) << 6;
      for (var x = 0; x < w; x++, i++) {
        var t = th[my | (x & 63)], li = I[i], gl = G2[i] * 0.9, j = i << 2;
        var r = src[j] * (AMB[0] + WARM[0] * li) + HALO[0] * gl + t, g2 = src[j + 1] * (AMB[1] + WARM[1] * li) + HALO[1] * gl + t, b = src[j + 2] * (AMB[2] + WARM[2] * li) + HALO[2] * gl + t;
        out[j] = r > 255 ? 255 : r; out[j + 1] = g2 > 255 ? 255 : g2; out[j + 2] = b > 255 ? 255 : b; out[j + 3] = 255;
      }
    }
    nightX.putImageData(img, 0, 0);
    nightOk = true;
  }
  // a luz que chega num ponto (para os zumbis e o jogador): a da lua, a dos postes e a do clarão do tiro
  function lightAt(x, y) {
    var l = 0.62;
    for (var i = 0; i < lamps.length; i++) { var dx = lamps[i].x - x, dy = lamps[i].y - y, q = (dx * dx + dy * dy) / (LAMP_R * LAMP_R); if (q < 1) { var f = 1 - q; l += f * f * 0.5; } }
    if (flash > 0) { var d = Math.hypot(x, y) / 3.4; if (d < 1) l += (1 - d) * (1 - d) * flash * 0.8; }
    return l > 1.15 ? 1.15 : l;
  }
  // os brilhos que somam luz (o clarão do tiro no chão): um degradê redondo pintado pixel a pixel, com o ruído azul
  var flashC = document.createElement('canvas'), flashR = 0;
  function makeSprites() {
    var R = Math.max(8, Math.round(3.2 * S * dpr)), d = R * 2, th = noise();
    flashC.width = d; flashC.height = d; flashR = R;
    var fx = flashC.getContext('2d'), img = fx.createImageData(d, d), o = img.data;
    for (var y = 0, i = 0; y < d; y++) for (var x = 0; x < d; x++, i += 4) {
      var q = (Math.pow(x + 0.5 - R, 2) + Math.pow(y + 0.5 - R, 2)) / (R * R), f = q < 1 ? (1 - q) * (1 - q) : 0, t = th[((y & 63) << 6) | (x & 63)];
      o[i] = 255 * 0.5 * f + t; o[i + 1] = 178 * 0.5 * f + t; o[i + 2] = 96 * 0.5 * f + t; o[i + 3] = 255;
    }
    fx.putImageData(img, 0, 0);
  }

  // ---------- O caminho dos zumbis ----------
  // A cena vira uma grade de meia casa: livre ou ocupada (as esquinas, os carros, o ônibus, as barricadas, as árvores, com
  // uma folga). Um mapa de distâncias até o meio (Dijkstra, uma vez por cena) diz para que lado cada casa da grade anda.
  // São dois mapas: o dos zumbis normais e o dos grandes (com mais folga, para não entalarem nas brechas estreitas). Perto do
  // meio o zumbi vai reto. Os choques com as coisas da cena são feitos com a forma de verdade de cada uma (girada).
  var RES = 0.5, gx0 = 0, gy0 = 0, GW = 0, GH = 0, SPAWNS = [], SPAWNB = [], pathOk = false;
  var F1 = null, F2 = null;             // os dois mapas: { blk, dist, fx, fy }
  var OB = [], OBG = null, OBW = 0, OBH = 0, obx0 = 0, oby0 = 0;       // as coisas sólidas e a grade delas (de 2 em 2 casas)
  function inShape(o, x, y, e) {
    var dx = x - o.cx, dy = y - o.cy;
    if (o.r !== undefined) { var q = o.r + e; return dx * dx + dy * dy <= q * q; }
    var lx = dx * o.ca + dy * o.sa, ly = -dx * o.sa + dy * o.ca;
    return lx >= -o.hw - e && lx <= o.hw + e && ly >= -o.hh - e && ly <= o.hh + e;
  }
  function bounds(o) {
    if (o.r !== undefined) return [o.cx - o.r, o.cy - o.r, o.cx + o.r, o.cy + o.r];
    var ex = Math.abs(o.hw * o.ca) + Math.abs(o.hh * o.sa), ey = Math.abs(o.hw * o.sa) + Math.abs(o.hh * o.ca);
    return [o.cx - ex, o.cy - ey, o.cx + ex, o.cy + ey];
  }
  var NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  function field(e) {                   // um mapa: as casas ocupadas (com a folga e), a distância até o meio e a direção
    var n = GW * GH, blk = new Uint8Array(n), dist = new Float64Array(n), fx = new Float32Array(n), fy = new Float32Array(n), i, j, x, y;   // a distância em Float64: em Float32 o valor guardado arredonda e o Dijkstra pula casas
    OB.forEach(function (o) {
      var b = bounds(o), g0 = clamp(Math.floor((b[0] - e - gx0) / RES), 0, GW - 1), g1 = clamp(Math.ceil((b[2] + e - gx0) / RES), 0, GW - 1), h0 = clamp(Math.floor((b[1] - e - gy0) / RES), 0, GH - 1), h1 = clamp(Math.ceil((b[3] + e - gy0) / RES), 0, GH - 1);
      for (var gi = g0; gi <= g1; gi++) for (var gj = h0; gj <= h1; gj++) if (inShape(o, gx0 + (gi + 0.5) * RES, gy0 + (gj + 0.5) * RES, e)) blk[gj * GW + gi] = 1;
    });
    dist.fill(Infinity);
    var start = cellAt(0, 0);
    if (start < 0) return { blk: blk, dist: dist, fx: fx, fy: fy };
    blk[start] = 0; dist[start] = 0;
    var heap = [start], hd = [0];
    function swap(a, b) { var t = heap[a]; heap[a] = heap[b]; heap[b] = t; t = hd[a]; hd[a] = hd[b]; hd[b] = t; }
    function push(c, d) { heap.push(c); hd.push(d); var k = heap.length - 1; while (k > 0) { var p = (k - 1) >> 1; if (hd[p] <= hd[k]) break; swap(p, k); k = p; } }
    function pop() { var top = heap[0], last = heap.length - 1; swap(0, last); heap.pop(); hd.pop(); var k = 0, L = heap.length; for (;;) { var l = 2 * k + 1, r = l + 1, s = k; if (l < L && hd[l] < hd[s]) s = l; if (r < L && hd[r] < hd[s]) s = r; if (s === k) break; swap(s, k); k = s; } return top; }
    while (heap.length) {
      var d0 = hd[0], c = pop();
      if (d0 > dist[c]) continue;
      var cx = c % GW, cy = (c / GW) | 0;
      for (j = 0; j < 8; j++) {
        var nx = cx + NB[j][0], ny = cy + NB[j][1];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        var nc = ny * GW + nx;
        if (blk[nc]) continue;
        if (NB[j][2] > 1 && (blk[cy * GW + nx] || blk[ny * GW + cx])) continue;    // sem cortar quina
        var nd = d0 + NB[j][2];
        if (nd < dist[nc]) { dist[nc] = nd; push(nc, nd); }
      }
    }
    // para que lado cada casa anda: para a vizinha mais perto do meio
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      i = y * GW + x;
      var best = dist[i], bx = 0, by = 0;
      for (j = 0; j < 8; j++) {
        var ax = x + NB[j][0], ay = y + NB[j][1];
        if (ax < 0 || ay < 0 || ax >= GW || ay >= GH) continue;
        if (NB[j][2] > 1 && (blk[y * GW + ax] || blk[ay * GW + x])) continue;
        var ac = ay * GW + ax;
        if (dist[ac] < best) { best = dist[ac]; bx = NB[j][0]; by = NB[j][1]; }
      }
      if (bx || by) { var l = Math.hypot(bx, by); fx[i] = bx / l; fy[i] = by / l; }
      else { var wx = gx0 + (x + 0.5) * RES, wy = gy0 + (y + 0.5) * RES, wl = Math.hypot(wx, wy) || 1; fx[i] = -wx / wl; fy[i] = -wy / wl; }
    }
    return { blk: blk, dist: dist, fx: fx, fy: fy };
  }
  function raster() {
    var m = 4.5, i, x, y;
    gx0 = Math.floor((view.x0 - m) / RES) * RES; gy0 = Math.floor((view.y0 - m) / RES) * RES;
    GW = Math.ceil((view.x1 + m - gx0) / RES); GH = Math.ceil((view.y1 + m - gy0) / RES);
    OB = items.filter(function (it) { return it.solid && fin[it.step]; });
    obx0 = gx0; oby0 = gy0; OBW = Math.ceil(GW * RES / 2) + 1; OBH = Math.ceil(GH * RES / 2) + 1;
    OBG = []; for (i = 0; i < OBW * OBH; i++) OBG.push([]);
    OB.forEach(function (o) {
      var b = bounds(o), a0 = clamp(Math.floor((b[0] - 1.3 - obx0) / 2), 0, OBW - 1), a1 = clamp(Math.floor((b[2] + 1.3 - obx0) / 2), 0, OBW - 1), c0 = clamp(Math.floor((b[1] - 1.3 - oby0) / 2), 0, OBH - 1), c1 = clamp(Math.floor((b[3] + 1.3 - oby0) / 2), 0, OBH - 1);
      for (var p = a0; p <= a1; p++) for (var q = c0; q <= c1; q++) OBG[q * OBW + p].push(o);
    });
    F1 = field(0.32); F2 = field(0.52);
    // onde os zumbis nascem: casas livres, com caminho, logo fora do que aparece
    SPAWNS = []; SPAWNB = [];
    for (y = 0; y < GH; y++) for (x = 0; x < GW; x++) {
      i = y * GW + x;
      var px = gx0 + (x + 0.5) * RES, py = gy0 + (y + 0.5) * RES, out = Math.max(view.x0 - px, px - view.x1, view.y0 - py, py - view.y1);
      if (out < 0.7 || out > 3.6) continue;
      if (!F1.blk[i] && isFinite(F1.dist[i])) SPAWNS.push(i);
      if (!F2.blk[i] && isFinite(F2.dist[i])) SPAWNB.push(i);
    }
    if (!SPAWNB.length) SPAWNB = SPAWNS;
    pathOk = true;
  }
  function cellAt(x, y) { var i = Math.floor((x - gx0) / RES), j = Math.floor((y - gy0) / RES); return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; }
  var FLX = 0, FLY = 0;
  function flow(x, y, big) {            // a direção do caminho num ponto: a média das quatro casas da grade em volta
    var F = big && F2 ? F2 : F1, FX = F.fx, FY = F.fy;
    var fx = (x - gx0) / RES - 0.5, fy = (y - gy0) / RES - 0.5, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    if (i < 0 || j < 0 || i >= GW - 1 || j >= GH - 1) { var l = Math.hypot(x, y) || 1; FLX = -x / l; FLY = -y / l; return; }
    var a = j * GW + i, b = a + 1, c = a + GW, d = c + 1;
    var vx = FX[a] * (1 - u) * (1 - v) + FX[b] * u * (1 - v) + FX[c] * (1 - u) * v + FX[d] * u * v;
    var vy = FY[a] * (1 - u) * (1 - v) + FY[b] * u * (1 - v) + FY[c] * (1 - u) * v + FY[d] * u * v;
    var m = Math.hypot(vx, vy);
    if (m < 1e-4) { var l2 = Math.hypot(x, y) || 1; FLX = -x / l2; FLY = -y / l2; } else { FLX = vx / m; FLY = vy / m; }
  }
  function obsNear(x, y) { var p = Math.floor((x - obx0) / 2), q = Math.floor((y - oby0) / 2); return p < 0 || q < 0 || p >= OBW || q >= OBH ? null : OBG[q * OBW + p]; }
  function solidAt(x, y) { var list = obsNear(x, y); if (!list) return false; for (var i = 0; i < list.length; i++) if (inShape(list[i], x, y, 0)) return true; return false; }
  // tira o círculo (x, y, r) de dentro das coisas sólidas; devolve a nova posição em PUSHX, PUSHY
  var PUSHX = 0, PUSHY = 0;
  function pushOut(x, y, r) {
    var list = obsNear(x, y);
    PUSHX = x; PUSHY = y;
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var o = list[i], dx = x - o.cx, dy = y - o.cy, d, ov;
      if (o.r !== undefined) { d = Math.hypot(dx, dy); ov = o.r + r - d; if (ov > 0 && d > 1e-6) { x += dx / d * ov; y += dy / d * ov; } continue; }
      var lx = dx * o.ca + dy * o.sa, ly = -dx * o.sa + dy * o.ca;
      if (lx < -o.hw - r || lx > o.hw + r || ly < -o.hh - r || ly > o.hh + r) continue;
      var nx = clamp(lx, -o.hw, o.hw), ny = clamp(ly, -o.hh, o.hh), ex = lx - nx, ey = ly - ny;
      d = Math.hypot(ex, ey);
      if (d >= r) continue;
      if (d > 1e-6) { lx = nx + ex / d * r; ly = ny + ey / d * r; }
      else {                            // o centro entrou: sai pelo lado mais perto
        var L = lx + o.hw, R = o.hw - lx, Tt = ly + o.hh, B = o.hh - ly, mn = Math.min(L, R, Tt, B);
        if (mn === L) lx = -o.hw - r; else if (mn === R) lx = o.hw + r; else if (mn === Tt) ly = -o.hh - r; else ly = o.hh + r;
      }
      x = o.cx + lx * o.ca - ly * o.sa; y = o.cy + lx * o.sa + ly * o.ca;
    }
    PUSHX = x; PUSHY = y;
  }

  // ---------- O jogo ----------
  var PR = 0.28;                        // o raio do jogador (gente: bem menor que um carro)
  var GUNS = [
    { en: 'Pistol', pt: 'Pistola', dmg: 1.5, rate: 3.6, spread: 0.035, speed: 27, mag: 12, reload: 0.85, pierce: 0, len: 0.55, kick: 0.07, shake: 0, price: 0, barrel: [0.42, 0.09], flash: 0.55 },
    { en: 'Rifle', pt: 'Rifle', dmg: 3.4, rate: 4.6, spread: 0.02, speed: 38, mag: 24, reload: 1.1, pierce: 1, len: 1.05, kick: 0.12, shake: 1.2, price: 110, barrel: [0.58, 0.09], flash: 0.75 },
    { en: 'Machine gun', pt: 'Metralhadora', dmg: 2.1, rate: 11, spread: 0.07, speed: 32, mag: 60, reload: 1.45, pierce: 0, len: 0.82, kick: 0.06, shake: 0.7, price: 320, barrel: [0.54, 0.12], flash: 0.7 },
    { en: 'Minigun', pt: 'Minigun', dmg: 2.2, rate: 24, spread: 0.1, speed: 35, mag: 240, reload: 2.0, pierce: 0, len: 1.15, kick: 0.035, shake: 0.9, price: 850, barrel: [0.6, 0.17], flash: 0.85, spin: 0.45 }
  ];
  // os zumbis: o raio, a vida, a velocidade, a mordida (o estrago e o intervalo até a próxima) e quanto pagam. Depois de
  // morder, o zumbi recua um pouco: um bando em volta tira vida aos poucos, e dá tempo de reagir.
  var ZK = {
    walker: { r: 0.27, heavy: 1, hp: 2.6, sp: 1.15, bite: 7, every: 0.9, pay: 4, c: [104, 186, 92] },
    runner: { r: 0.22, heavy: 0.78, hp: 1.7, sp: 2.0, bite: 5, every: 0.7, pay: 6, c: [160, 222, 106] },
    brute: { r: 0.4, heavy: 1.5, hp: 12, sp: 0.82, bite: 14, every: 1.0, pay: 14, c: [62, 134, 70] },
    boss: { r: 0.62, heavy: 2.4, hp: 300, sp: 0.64, bite: 16, every: 1.1, pay: 250, c: [86, 160, 78] }
  };
  var KINDS = ['walker', 'runner', 'brute', 'boss'];
  var MAXZ = 140, ZS = [], zAlive = 0;
  for (var zi = 0; zi < MAXZ; zi++) ZS.push({ on: false, id: zi, kind: 'walker', heavy: 1, x: 0, y: 0, r: 0.27, hp: 1, max: 1, sp: 1, bite: 1, every: 1, cd: 0, pay: 0, hit: 0, kx: 0, ky: 0, seed: 0, b: 0, atk: false });
  // os tiros, as partículas e as manchas: listas de tamanho fixo
  var MAXB = 640, BX = new Float32Array(MAXB), BY = new Float32Array(MAXB), BVX = new Float32Array(MAXB), BVY = new Float32Array(MAXB), BL = new Float32Array(MAXB), BD = new Float32Array(MAXB), BP = new Int8Array(MAXB), BG = new Int8Array(MAXB), BH = new Int16Array(MAXB), BT = new Float32Array(MAXB), bTop = 0;
  var MAXP = 900, QX = new Float32Array(MAXP), QY = new Float32Array(MAXP), QVX = new Float32Array(MAXP), QVY = new Float32Array(MAXP), QL = new Float32Array(MAXP), QM = new Float32Array(MAXP), QS = new Float32Array(MAXP), QC = new Int8Array(MAXP), qTop = 0, qLive = 0;
  // as cores das partículas (as de índice >= ADD somam luz, como faísca)
  var PCOL = [[96, 176, 84], [70, 140, 64], [150, 214, 110], [240, 178, 74], [255, 255, 255], [120, 200, 255], [255, 120, 150], [255, 214, 140], [255, 176, 96]], ADD = 7;
  var MAXD = 90, DX = new Float32Array(MAXD), DY = new Float32Array(MAXD), DR = new Float32Array(MAXD), DT = new Float32Array(MAXD), dTop = 0;
  var floats = [];                      // os textos que sobem ("+$7", "Wave 3 concluída")
  var gunI = 0, dmgLvl = 0, mag = 12, reloadT = 0, cool = 0, spin = 0, recoil = 0, flash = 0, shake = 0, barrelSpin = 0;
  var aim = -Math.PI / 2, firing = false, keyFire = false, keyTurn = 0, aimPt = null;
  var money = 0, hp = 100, wave = 0, kills = 0, queue = [], qi = 0, waveT = 0, phaseT = 0, state = 'idle', gameT = 0, hudN = 0, timeScale = 1;
  var best = (function () { try { return JSON.parse(localStorage.getItem('hr-zumbis') || '{}') || {}; } catch (e) { return {}; } })();
  function saveBest() { try { localStorage.setItem('hr-zumbis', JSON.stringify(best)); } catch (e) {} }
  function gunName(i) { return pt() ? GUNS[i].pt : GUNS[i].en; }
  function nextUp() {
    if (gunI < GUNS.length - 1) return { gun: gunI + 1, name: gunName(gunI + 1), price: GUNS[gunI + 1].price };
    return { gun: -1, name: (pt() ? 'Dano +25%' : 'Damage +25%'), price: Math.round(500 * Math.pow(1.45, dmgLvl) / 50) * 50 };
  }
  function buy() {
    if (state === 'idle' || state === 'code' || state === 'over' || state === 'won') return;
    var u = nextUp();
    if (money < u.price) { hud.up.classList.remove('is-no'); void hud.up.offsetWidth; hud.up.classList.add('is-no'); return; }
    money -= u.price;
    if (u.gun >= 0) { gunI = u.gun; mag = GUNS[gunI].mag; reloadT = 0; spin = 0; } else dmgLvl++;
    floats.push({ text: u.name + '!', x: 0, y: -PR - 0.9, t: T, life: 1300, big: true, gold: true });
    for (var i = 0; i < 26; i++) { var a = Math.random() * TAU, s = 2 + Math.random() * 3; part(Math.cos(a) * PR, Math.sin(a) * PR, Math.cos(a) * s, Math.sin(a) * s, 0.7, 0.07, 3 + (i % 4)); }
    say((pt() ? 'Upgrade: ' : 'Upgrade: ') + u.name);
    hud.gun.classList.remove('is-new'); void hud.gun.offsetWidth; hud.gun.classList.add('is-new');
    updateHud(); wake();
  }
  // as waves: zumbis andando, depois os rápidos (wave 3) e os grandões (wave 5); na wave 10, o chefão
  function makeWave(w) {
    var q = [], n = Math.round(6 + 2.6 * w), fast = w >= 3 ? 2 * (w - 2) : 0, brute = w >= 5 ? w - 4 : 0, dur = 10 + 2 * w, i;
    for (i = 0; i < n; i++) q.push({ k: 'walker', t: dur * (i / n) * (0.85 + 0.3 * Math.random()) });
    for (i = 0; i < fast; i++) q.push({ k: 'runner', t: dur * (0.25 + 0.75 * (i + 1) / (fast + 1)) });
    for (i = 0; i < brute; i++) q.push({ k: 'brute', t: dur * (0.45 + 0.55 * (i + 1) / (brute + 1)) });
    if (w === 10) q.push({ k: 'boss', t: dur * 0.72 });
    q.sort(function (a, b) { return a.t - b.t; });
    return q;
  }
  function spawn(kind) {
    if (!pathOk) raster();
    if (!SPAWNS.length) return false;
    for (var i = 0; i < MAXZ; i++) if (!ZS[i].on) break;
    if (i >= MAXZ) return false;
    var z = ZS[i], K = ZK[kind], SP = K.r > 0.3 ? SPAWNB : SPAWNS, c = SP[(Math.random() * SP.length) | 0], hpMul = kind === 'boss' ? 1 : Math.pow(1.16, wave - 1), spMul = 1 + 0.07 * (wave - 1);
    z.on = true; z.kind = kind; z.r = K.r; z.heavy = K.heavy; z.max = z.hp = K.hp * hpMul; z.sp = K.sp * spMul * (0.9 + 0.2 * Math.random()); z.bite = K.bite * (kind === 'boss' ? 1 : 1 + 0.05 * (wave - 1)); z.every = K.every; z.cd = 0; z.pay = K.pay + (kind === 'boss' ? 0 : wave * (kind === 'brute' ? 2 : 1));
    z.x = gx0 + ((c % GW) + 0.5) * RES + (Math.random() - 0.5) * 0.3; z.y = gy0 + (((c / GW) | 0) + 0.5) * RES + (Math.random() - 0.5) * 0.3;
    z.hit = 0; z.kx = z.ky = 0; z.seed = Math.random(); z.atk = false;
    zAlive++;
    return true;
  }
  function newGame() {
    paused = false;
    for (var i = 0; i < MAXZ; i++) ZS[i].on = false;
    zAlive = 0; bTop = 0; BL.fill(0); dTop = 0; DT.fill(0); floats = [];
    gunI = 0; dmgLvl = 0; mag = GUNS[0].mag; reloadT = 0; cool = 0; spin = 0; money = 0; hp = 100; wave = 0; kills = 0; gameT = 0;
    hideBanner();
    nextWave();
  }
  function nextWave() {
    wave++; queue = makeWave(wave); qi = 0; waveT = 0; phaseT = 0; state = 'intro';
    var sub = wave === 1 ? (coarse ? tr(['Touch and hold towards the zombies to shoot', 'Toque e segure na direção dos zumbis para atirar']) : tr(['Aim with the mouse and hold the click to shoot', 'Mire com o mouse e segure o clique para atirar']))
      : wave === 10 ? tr(['Last wave: here comes the boss', 'Última wave: o chefão vem aí']) : tr(['Faster and stronger zombies', 'Zumbis mais rápidos e mais fortes']);
    showBanner('Wave ' + wave, sub, null, null, wave === 1 ? 2400 : 1500, 'is-wave');
    say('Wave ' + wave + '. ' + sub);
    updateHud();
  }
  function waveClear() {
    var bonus = 15 * wave;
    money += bonus; hp = Math.min(100, hp + 35); mag = GUNS[gunI].mag; reloadT = 0;
    if (wave >= 10) { win(); return; }
    state = 'clear'; phaseT = 0;
    showBanner(pt() ? 'Wave ' + wave + ' concluída' : 'Wave ' + wave + ' cleared', '+$' + bonus + ' · ' + tr(['+35 health', '+35 de vida']) + (money >= nextUp().price ? ' · ' + tr(['upgrade ready!', 'dá para fazer upgrade!']) : ''), null, null, 2600, 'is-clear');
    say(bannerTitle.textContent + '. ' + bannerText.textContent);
    updateHud();
  }
  function record() { if (!best.wave || wave > best.wave) best.wave = wave; saveBest(); }
  function over() {
    state = 'over'; firing = keyFire = false; hp = 0;
    var was = best.wave || 0; record();
    showBanner(tr(['The zombies got you', 'Os zumbis te pegaram']), (pt() ? 'Você chegou à wave ' : 'You reached wave ') + wave + ' · ' + kills + (pt() ? ' zumbis' : ' zombies') + (wave > was ? (pt() ? ' · recorde!' : ' · new record!') : (pt() ? ' · recorde: wave ' : ' · record: wave ') + best.wave), tr(['Try again', 'Tentar de novo']), newGame, 0, 'is-over');
    say(bannerTitle.textContent + '. ' + bannerText.textContent);
    updateHud();
  }
  function win() {
    state = 'won'; firing = keyFire = false;
    best.won = (best.won || 0) + 1; record();
    showBanner(tr(['You survived all 10 waves!', 'Você sobreviveu às 10 waves!']), kills + (pt() ? ' zumbis · ' : ' zombies · ') + Math.round(gameT / 60 * 10) / 10 + ' min', tr(['Play again', 'Jogar de novo']), newGame, 0, 'is-won');
    celebrate('');
    say(bannerTitle.textContent + '. ' + bannerText.textContent);
    updateHud();
  }
  function shoot(G) {
    var a = aim + (Math.random() - 0.5) * 2 * G.spread, ca = Math.cos(a), sa = Math.sin(a), tip = PR + G.barrel[0] * 0.6;
    for (var tries = 0; tries < MAXB; tries++) { bTop = (bTop + 1) % MAXB; if (BL[bTop] <= 0) break; }
    var i = bTop;
    BX[i] = ca * tip; BY[i] = sa * tip; BVX[i] = ca * G.speed; BVY[i] = sa * G.speed; BL[i] = 1.4; BD[i] = G.dmg * (1 + 0.25 * dmgLvl); BP[i] = G.pierce; BG[i] = gunI; BH[i] = -1; BT[i] = 0;
    flash = Math.min(1, flash + G.flash); recoil = G.kick; if (!reduced) shake = Math.min(3, shake + G.shake);
  }
  function part(x, y, vx, vy, life, s, col) {
    qTop = (qTop + 1) % MAXP;
    var i = qTop;
    if (QL[i] <= 0) qLive++;
    QX[i] = x; QY[i] = y; QVX[i] = vx; QVY[i] = vy; QL[i] = life; QM[i] = life; QS[i] = s; QC[i] = col;
  }
  function burst(x, y, n, col, speed, life) { for (var i = 0; i < n; i++) { var a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8); part(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), 0.07 + Math.random() * 0.05, col); } wake(); }
  function celebrate(text) {
    if (text) floats.push({ text: text, x: 0, y: -1.6, t: T, life: 1500, big: true, gold: true });
    for (var i = 0; i < 60; i++) { var a = Math.random() * TAU, s = 3 + Math.random() * 5; part(Math.cos(a) * 0.4, Math.sin(a) * 0.4, Math.cos(a) * s, Math.sin(a) * s, 1.1 + Math.random() * 0.6, 0.09 + Math.random() * 0.06, 3 + (i % 4)); }
    wake();
  }
  function hitZombie(z, dmg, vx, vy, hx, hy) {
    z.hp -= dmg; z.hit = T + 70;
    var v = Math.hypot(vx, vy) || 1, kb = (gunI === 1 ? 1.6 : 0.8) / z.heavy;
    z.kx += vx / v * kb; z.ky += vy / v * kb;
    for (var i = 0; i < 3; i++) part(hx, hy, -vx / v * (1 + Math.random() * 2) + (Math.random() - 0.5) * 3, -vy / v * (1 + Math.random() * 2) + (Math.random() - 0.5) * 3, 0.16 + Math.random() * 0.12, 0.05, 7);
    if (z.hp <= 0) kill(z);
  }
  function kill(z) {
    z.on = false; zAlive--; kills++;
    money += z.pay;
    floats.push({ text: '+$' + z.pay, x: z.x, y: z.y - z.r - 0.15, t: T, life: 800, gold: true });
    var n = Math.round(8 + z.heavy * 6);
    for (var i = 0; i < n; i++) { var a = Math.random() * TAU, s = (1.2 + Math.random() * 2.6) * (0.6 + 0.4 * z.heavy); part(z.x, z.y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.35, 0.04 + Math.random() * 0.05 * z.heavy, i % 3); }
    var dr = Math.min(z.r * (1.1 + Math.random() * 0.4), clearance(z.x, z.y) / 1.2);
    if (dr > 0.06) { dTop = (dTop + 1) % MAXD; DX[dTop] = z.x; DY[dTop] = z.y; DR[dTop] = dr; DT[dTop] = gameT || 0.001; }
    if (z.kind === 'boss' && !reduced) shake = 3;
    updateHud();
  }
  // um passo do jogo (dt em segundos)
  var HASH = null, HNEXT = new Int16Array(MAXZ), HW = 0, HH = 0, hx0 = 0, hy0 = 0;
  function step(dt) {
    if (!pathOk) raster();
    gameT += dt;
    var G = GUNS[gunI], i, z;
    aim += keyTurn * 3.4 * dt;
    // a fase: o aviso da wave, a wave e o intervalo
    phaseT += dt;
    if (state === 'intro' && phaseT > (wave === 1 ? 1.6 : 1.2)) { state = 'play'; phaseT = 0; if (wave === 1) codeEl.classList.add('is-folded'); }
    if (state === 'clear' && phaseT > 3.4) nextWave();
    if (state === 'play') {
      waveT += dt;
      while (qi < queue.length && queue[qi].t <= waveT && zAlive < MAXZ - 4) { spawn(queue[qi].k); qi++; }
      if (qi >= queue.length && zAlive === 0) waveClear();
    }
    // a arma
    if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { reloadT = 0; mag = G.mag; } }
    var want = (firing || keyFire) && (state === 'play' || state === 'intro' || state === 'clear');
    if (G.spin) spin = clamp(spin + (want ? dt / G.spin : -dt / 0.7), 0, 1);
    barrelSpin += dt * (G.spin ? 30 * spin : 0);
    if (want && reloadT <= 0) {
      var rate = G.rate * (G.spin ? 0.25 + 0.75 * spin : 1);
      cool -= dt;
      for (var guard = 0; cool <= 0 && mag > 0 && guard < 8; guard++) { shoot(G); mag--; cool += 1 / rate; }
      if (mag <= 0) reloadT = G.reload;
    } else cool = Math.max(0, cool - dt);
    recoil = Math.max(0, recoil - dt * 0.9);
    flash = Math.max(0, flash - dt * 9);
    shake = Math.max(0, shake - dt * 14);
    // os zumbis: andam pelo caminho, balançando um pouco, e mordem quando chegam
    var bite = 0;
    for (i = 0; i < MAXZ; i++) {
      z = ZS[i]; if (!z.on) continue;
      var dx = -z.x, dy = -z.y, dd = Math.hypot(dx, dy) || 1e-6, reach = PR + z.r;
      z.atk = dd <= reach + 0.05;
      z.cd -= dt;
      if (z.atk && z.cd <= 0) {         // a mordida, e o tranco para trás
        bite += z.bite; z.cd = z.every;
        var kb = 3.2 / (0.6 + 0.4 * z.heavy); z.kx -= dx / dd * kb; z.ky -= dy / dd * kb;
      }
      var mx = 0, my = 0;
      if (!z.atk) {
        var vx, vy;
        if (dd < 3.3) { vx = dx / dd; vy = dy / dd; } else { flow(z.x, z.y, z.r > 0.3); vx = FLX; vy = FLY; }
        var sw = Math.sin(gameT * 2.3 + z.seed * TAU) * 0.24, cs = Math.cos(sw), sn = Math.sin(sw);
        mx = (vx * cs - vy * sn) * z.sp; my = (vx * sn + vy * cs) * z.sp;
      }
      z.x += (mx + z.kx) * dt; z.y += (my + z.ky) * dt;
      var dk = Math.exp(-dt * 9); z.kx *= dk; z.ky *= dk;
      dd = Math.hypot(z.x, z.y) || 1e-6;
      if (dd < reach) { z.x *= reach / dd; z.y *= reach / dd; }
    }
    // um não entra no outro (uma grade de 1 casa para achar os vizinhos)
    hashZombies();
    for (i = 0; i < MAXZ; i++) {
      z = ZS[i]; if (!z.on) continue;
      var cxi = Math.floor(z.x - hx0), cyi = Math.floor(z.y - hy0);
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var cxn = cxi + ox, cyn = cyi + oy;
        if (cxn < 0 || cyn < 0 || cxn >= HW || cyn >= HH) continue;
        for (var j = HASH[cyn * HW + cxn]; j >= 0; j = HNEXT[j]) {
          if (j <= i) continue;
          var o = ZS[j], ex = o.x - z.x, ey = o.y - z.y, ed = Math.hypot(ex, ey), min = o.r + z.r;
          if (ed < min && ed > 1e-6) { var push = (min - ed) * 0.5, wa = o.r * o.r / (o.r * o.r + z.r * z.r), wb = 1 - wa; ex /= ed; ey /= ed; z.x -= ex * push * 2 * wa; z.y -= ey * push * 2 * wa; o.x += ex * push * 2 * wb; o.y += ey * push * 2 * wb; }
        }
      }
    }
    for (i = 0; i < MAXZ; i++) { z = ZS[i]; if (!z.on) continue; pushOut(z.x, z.y, z.r * 0.92); z.x = PUSHX; z.y = PUSHY; }
    if (bite > 0 && (state === 'play' || state === 'intro' || state === 'clear')) {
      hp -= bite;
      hurt();
      if (!reduced) shake = Math.min(3, shake + 1.6);
      if (hp <= 0) over();
    }
    // os tiros: andam, acertam o primeiro zumbi no caminho (o rifle atravessa um) e param nas paredes
    hashZombies();
    for (i = 0; i < MAXB; i++) {
      if (BL[i] <= 0) continue;
      var x0 = BX[i], y0 = BY[i], x1 = x0 + BVX[i] * dt, y1 = y0 + BVY[i] * dt;
      BL[i] -= dt; BT[i] += dt;
      // a parede: anda no caminho de 0,25 em 0,25
      var segL = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(segL / 0.25)), wallT = 2;
      for (var s2 = 1; s2 <= steps; s2++) { var f = s2 / steps; if (solidAt(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f)) { wallT = (s2 - 0.5) / steps; break; } }
      // o zumbi mais perto no caminho
      var bestT = 2, bestZ = null, minx = Math.min(x0, x1) - 1.3, maxx = Math.max(x0, x1) + 1.3, miny = Math.min(y0, y1) - 1.3, maxy = Math.max(y0, y1) + 1.3;
      var ca = clamp(Math.floor(minx - hx0), 0, HW - 1), cb = clamp(Math.floor(maxx - hx0), 0, HW - 1), cc = clamp(Math.floor(miny - hy0), 0, HH - 1), cd = clamp(Math.floor(maxy - hy0), 0, HH - 1);
      var sx = x1 - x0, sy = y1 - y0, s2l = sx * sx + sy * sy || 1e-9;
      for (var gy2 = cc; gy2 <= cd; gy2++) for (var gx2 = ca; gx2 <= cb; gx2++) for (var k = HASH[gy2 * HW + gx2]; k >= 0; k = HNEXT[k]) {
        z = ZS[k];
        if (!z.on || BH[i] === z.id) continue;
        var t = ((z.x - x0) * sx + (z.y - y0) * sy) / s2l; t = clamp(t, 0, 1);
        var px = x0 + sx * t - z.x, py = y0 + sy * t - z.y;
        var hr2 = z.r + 0.07; if (px * px + py * py < hr2 * hr2 && t < bestT) { bestT = t; bestZ = z; }
      }
      if (bestZ && bestT < wallT) {
        var hxp = x0 + sx * bestT, hyp = y0 + sy * bestT;
        hitZombie(bestZ, BD[i], BVX[i], BVY[i], hxp, hyp);
        if (BP[i] > 0) { BP[i]--; BH[i] = bestZ.id; BX[i] = x1; BY[i] = y1; }
        else BL[i] = 0;
        continue;
      }
      if (wallT <= 1) {
        var wx = x0 + sx * wallT, wy = y0 + sy * wallT;
        for (var q2 = 0; q2 < 3; q2++) part(wx, wy, -sx / dt * 0.06 + (Math.random() - 0.5) * 3, -sy / dt * 0.06 + (Math.random() - 0.5) * 3, 0.14 + Math.random() * 0.1, 0.045, 8);
        BL[i] = 0; continue;
      }
      BX[i] = x1; BY[i] = y1;
      if (x1 < view.x0 - 3 || x1 > view.x1 + 3 || y1 < view.y0 - 3 || y1 > view.y1 + 3) BL[i] = 0;
    }
  }
  function hashZombies() {
    hx0 = Math.floor(view.x0 - 5); hy0 = Math.floor(view.y0 - 5); HW = Math.ceil(view.x1 + 5 - hx0) + 1; HH = Math.ceil(view.y1 + 5 - hy0) + 1;
    if (!HASH || HASH.length < HW * HH) HASH = new Int16Array(HW * HH);
    HASH.fill(-1, 0, HW * HH);
    for (var i = 0; i < MAXZ; i++) {
      var z = ZS[i]; if (!z.on) continue;
      var cx = clamp(Math.floor(z.x - hx0), 0, HW - 1), cy = clamp(Math.floor(z.y - hy0), 0, HH - 1), c = cy * HW + cx;
      HNEXT[i] = HASH[c]; HASH[c] = i;
    }
  }
  function stepFx(dt) {                 // as partículas, as manchas e os textos (andam até fora do jogo)
    qLive = 0;
    for (var i = 0; i < MAXP; i++) {
      if (QL[i] <= 0) continue;
      QL[i] -= dt;
      if (QL[i] <= 0) continue;
      qLive++;
      var dk = Math.exp(-dt * (QC[i] >= 3 && QC[i] <= 6 ? 1.6 : 5));
      QX[i] += QVX[i] * dt; QY[i] += QVY[i] * dt; QVX[i] *= dk; QVY[i] *= dk;
    }
    for (var f = floats.length - 1; f >= 0; f--) if (T - floats[f].t > floats[f].life) floats.splice(f, 1);
  }
  var hurtT = 0;
  function hurt() { if (T - hurtT < 260) return; hurtT = T; hurtEl.classList.remove('is-on'); void hurtEl.offsetWidth; hurtEl.classList.add('is-on'); }

  // ---------- Desenho ----------
  var night = 0, nightGoal = 0, hover = null;
  function render() {
    var w = canvas.width, h = canvas.height, sx = 0, sy = 0;
    if (shake > 0 && !reduced) { sx = (Math.random() - 0.5) * shake * dpr; sy = (Math.random() - 0.5) * shake * dpr; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (sx || sy) { ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0, 0, w, h); }
    var full = night >= 1 && nightOk && lampFade >= 1;
    if (!full) ctx.drawImage(dayC, sx, sy);
    if (night > 0 && nightOk) {
      if (lampFade < 1) { ctx.globalAlpha = night; ctx.drawImage(oldC, sx, sy); ctx.globalAlpha = night * lampFade; }
      else ctx.globalAlpha = night;
      ctx.drawImage(nightC, sx, sy);
      ctx.globalAlpha = 1;
    }
    // a etapa que está entrando: a onda das ruas ou o pulinho de cada peça
    world(ctx, sx, sy);
    for (var s = 0; s < built; s++) if (!fin[s]) {
      if (s === 0) {
        var rr0 = (T - stepT[0]) / RIPPLE * (Math.hypot(view.x1, view.y1) + 2);
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, Math.max(0.01, rr0), 0, TAU); ctx.clip();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(rippleC, sx, sy); ctx.restore(); world(ctx, sx, sy);
      } else {
        for (var i = 0; i < items.length; i++) {
          var it = items[i]; if (it.step !== s || it.hidden) continue;
          var t0 = stepT[s] + it.d * DELAY, k = (T - t0) / POP;
          if (k <= 0) continue;
          drawPop(ctx, it, k >= 1 ? 1 : easeBack(k));
        }
      }
    }
    if (tool === 'light' && hover) lampPreview();
    if (tool === 'ui' || tool === 'script') drawGame();
    drawParts();
    drawFloats(sx, sy);
  }
  function lampPreview() {
    var p = local2world(hover), t = lampTarget(p[0], p[1], true);
    if (!t) return;
    var q = t.p, off = t.remove !== undefined;
    if (!off && lamps.length >= MAXLAMPS) return;          // com os 4 postes, só a prévia de tirar
    ctx.lineWidth = PX * 1.5; ctx.setLineDash([PX * 5, PX * 4]); ctx.strokeStyle = off ? 'rgba(255,140,120,0.9)' : 'rgba(255,240,210,0.9)';
    ctx.beginPath(); ctx.arc(q[0], q[1], 0.42, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (!off) { ctx.globalAlpha = 0.16; ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(q[0], q[1], LAMP_R * 0.62, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }
  function drawGame() {
    var i, z, k, b;
    var playing = tool === 'script' && state !== 'idle' && state !== 'code';
    if (playing) {
      // as manchas verdes dos zumbis derrubados (somem devagar)
      for (i = 0; i < MAXD; i++) {
        if (DT[i] <= 0) continue;
        var age = gameT - DT[i], a = age < 0 ? 0 : 1 - age / 14;
        if (a <= 0) { DT[i] = 0; continue; }
        ctx.globalAlpha = 0.34 * a; ctx.fillStyle = '#2f5a2c';
        ctx.beginPath(); ctx.ellipse(DX[i], DY[i], DR[i] * 1.15, DR[i] * 0.9, (i % 5) * 0.6, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // as sombras dos zumbis, num caminho só
      ctx.beginPath();
      for (i = 0; i < MAXZ; i++) { z = ZS[i]; if (!z.on) continue; ctx.moveTo(z.x + 0.045 + z.r, z.y + 0.06); ctx.arc(z.x + 0.045, z.y + 0.06, z.r, 0, TAU); }
      ctx.globalAlpha = 0.32; ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;
      // os zumbis: a cor de cada tipo vezes a luz que chega nele (em 9 tons), um lote por tipo e tom
      for (i = 0; i < MAXZ; i++) { z = ZS[i]; if (z.on) z.b = Math.round(lightAt(z.x, z.y) * 8); }
      for (k = 0; k < KINDS.length; k++) {
        var K = ZK[KINDS[k]];
        for (b = 2; b <= 10; b++) {
          var any = false, lb = b / 8;
          ctx.beginPath();
          for (i = 0; i < MAXZ; i++) { z = ZS[i]; if (!z.on || z.kind !== KINDS[k] || z.b !== b) continue; any = true; ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU); }
          if (!any) continue;
          ctx.fillStyle = rgb(K.c, lb); ctx.fill();
          ctx.lineWidth = Math.max(PX * 1.2, 0.035); ctx.strokeStyle = rgb(K.c, lb * 0.55); ctx.stroke();
          ctx.beginPath();
          for (i = 0; i < MAXZ; i++) { z = ZS[i]; if (!z.on || z.kind !== KINDS[k] || z.b !== b) continue; var hr = z.r * 0.36; ctx.moveTo(z.x - z.r * 0.3 + hr, z.y - z.r * 0.32); ctx.arc(z.x - z.r * 0.3, z.y - z.r * 0.32, hr, 0, TAU); }
          ctx.fillStyle = rgb(K.c, Math.min(1.3, lb * 1.28)); ctx.fill();
        }
      }
      // o clarão branco de quem levou tiro
      ctx.beginPath(); var anyHit = false;
      for (i = 0; i < MAXZ; i++) { z = ZS[i]; if (!z.on || z.hit < T) continue; anyHit = true; ctx.moveTo(z.x + z.r, z.y); ctx.arc(z.x, z.y, z.r, 0, TAU); }
      if (anyHit) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
      // a vida dos grandões e do chefão
      for (i = 0; i < MAXZ; i++) {
        z = ZS[i]; if (!z.on || (z.kind !== 'brute' && z.kind !== 'boss') || z.hp >= z.max) continue;
        var bw = z.r * 1.6, by = z.y - z.r - 0.22;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(z.x - bw / 2 - 0.03, by - 0.03, bw + 0.06, 0.15);
        ctx.fillStyle = '#e2564f'; ctx.fillRect(z.x - bw / 2, by, bw * clamp(z.hp / z.max, 0, 1), 0.09);
      }
    }
    // o jogador: a bolinha dourada, a arma apontando para a mira
    var G = GUNS[gunI], ca = Math.cos(aim), sa = Math.sin(aim), back = recoil * 1.2, bl = G.barrel[0], bwid = G.barrel[1];
    ctx.save(); ctx.translate(0, 0); ctx.rotate(aim);
    ctx.fillStyle = '#26282c'; ctx.fillRect(PR * 0.2 - back, -bwid / 2, bl + PR * 0.3, bwid);
    if (G.spin) {                       // os canos da minigun girando
      ctx.fillStyle = '#4a4e56';
      for (i = 0; i < 3; i++) { var off = Math.sin(barrelSpin + i * 2.1) * bwid * 0.32; ctx.fillRect(PR * 0.5 - back, off - 0.016, bl, 0.032); }
    } else { ctx.fillStyle = '#4a4e56'; ctx.fillRect(PR * 0.2 - back, -bwid / 2, bl + PR * 0.3, bwid * 0.32); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0.04, 0.05, PR, 0, TAU); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, PR, 0, TAU); ctx.fillStyle = '#f0b24a'; ctx.fill(); ctx.lineWidth = Math.max(PX * 1.2, 0.035); ctx.strokeStyle = '#9a6a22'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-PR * 0.3, -PR * 0.32, PR * 0.36, 0, TAU); ctx.fillStyle = '#ffe1a6'; ctx.fill();
    if (!playing) return;
    // a luz e o clarão do tiro, os rastros de luz dos tiros (somam luz)
    ctx.globalCompositeOperation = 'lighter';
    if (flash > 0.02 && flashR) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(1, flash) * 0.9;
      ctx.drawImage(flashC, W * dpr / 2 - flashR, H * dpr / 2 - flashR);
      ctx.globalAlpha = 1; world(ctx);
      var tx = ca * (PR + bl * 0.95), ty = sa * (PR + bl * 0.95), fs = 0.14 + 0.13 * G.flash;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(aim); ctx.globalAlpha = Math.min(1, flash * 1.2);
      ctx.fillStyle = '#ffd590'; ctx.beginPath(); ctx.ellipse(fs * 0.6, 0, fs * 1.1, fs * 0.42, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.ellipse(fs * 0.3, 0, fs * 0.5, fs * 0.22, 0, 0, TAU); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
    for (var pass = 0; pass < 2; pass++) {
      for (var gi = 0; gi < GUNS.length; gi++) {
        var any2 = false, L = GUNS[gi].len;
        ctx.beginPath();
        for (i = 0; i < MAXB; i++) {
          if (BL[i] <= 0 || BG[i] !== gi) continue;
          var v = Math.hypot(BVX[i], BVY[i]) || 1, len = Math.min(L, BT[i] * v + 0.2), ex = BX[i] - BVX[i] / v * len, ey = BY[i] - BVY[i] / v * len;
          ctx.moveTo(ex, ey); ctx.lineTo(BX[i], BY[i]); any2 = true;
        }
        if (!any2) continue;
        ctx.lineCap = 'round';
        if (pass === 0) { ctx.lineWidth = PX * (gi === 3 ? 4.2 : 3.6); ctx.strokeStyle = TRAIL[gi][0]; }
        else { ctx.lineWidth = PX * (gi === 1 ? 1.8 : 1.4); ctx.strokeStyle = TRAIL[gi][1]; }
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  var TRAIL = [['rgba(255,206,128,0.34)', 'rgba(255,248,226,0.95)'], ['rgba(255,170,84,0.4)', 'rgba(255,240,212,1)'], ['rgba(255,190,110,0.3)', 'rgba(255,236,204,0.92)'], ['rgba(255,132,64,0.32)', 'rgba(255,222,170,0.95)']];
  var PSTR = PCOL.map(function (c) { return rgb(c); });
  function drawParts() {
    if (!qLive) return;
    for (var c = 0; c < PCOL.length; c++) {
      if (c === ADD) ctx.globalCompositeOperation = 'lighter';
      var any = false;
      ctx.beginPath();
      for (var i = 0; i < MAXP; i++) {
        if (QL[i] <= 0 || QC[i] !== c) continue;
        var s = QS[i] * (c >= ADD || (c >= 3 && c <= 6) ? 1 : clamp(QL[i] / QM[i] * 1.6, 0, 1));
        ctx.rect(QX[i] - s, QY[i] - s, s * 2, s * 2); any = true;
      }
      if (any) { ctx.fillStyle = PSTR[c]; ctx.fill(); }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawFloats(sx, sy) {
    if (!floats.length) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < floats.length; i++) {
      var f = floats[i], q = (T - f.t) / f.life, px = (W / 2 + f.x * S) * dpr + sx, py = (H / 2 + (f.y - q * (f.big ? 0.9 : 0.7)) * S) * dpr + sy;
      ctx.globalAlpha = q < 0.7 ? 1 : (1 - q) / 0.3;
      ctx.font = '700 ' + Math.round((f.big ? 17 : 12) * dpr) + 'px Archivo, system-ui, sans-serif';
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(f.text, px, py);
      ctx.fillStyle = f.gold ? '#f6c56b' : '#fff'; ctx.fillText(f.text, px, py);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- A pausa ----------
  // O botão de pausa (no HUD, embaixo da vida), a tecla P ou o Esc param o jogo inteiro: zumbis, tiros, recarga, waves e os
  // efeitos ficam congelados, e um aviso no meio oferece Continuar. Sair da cena (rolar a página, trocar de aba ou de
  // ferramenta) no meio da partida também pausa: ao voltar, o jogo espera o Continuar.
  var paused = false, pausedAt = 0;
  function live() { return state === 'play' || state === 'intro' || state === 'clear'; }
  function canPause() { return tool === 'script' && live(); }
  function pauseBanner() {
    showBanner(tr(['Paused', 'Pausado']), coarse ? tr(['Tap Resume to keep playing', 'Toque em Continuar para voltar ao jogo']) : tr(['Press P or click Resume to keep playing', 'Aperte P ou clique em Continuar para voltar ao jogo']),
      tr(['Resume', 'Continuar']), function () { setPause(false); }, 0, 'is-pause');
  }
  function setPause(on, quiet) {
    on = !!on;
    if (on === paused || (on && !live())) return;
    paused = on;
    firing = keyFire = false; keyTurn = 0;
    if (on) { pausedAt = now(); shake = 0; pauseBanner(); if (!quiet) say(tr(['Game paused', 'Jogo pausado'])); }
    else {
      var d = now() - pausedAt;
      floats.forEach(function (f) { f.t += d; });            // os textos que sobem continuam de onde pararam
      if (banner.classList.contains('is-pause')) hideBanner();
      say(tr(['Game resumed', 'Jogo continuando']));
    }
    updateHud(); wake();
  }

  // ---------- O HUD (Interface) ----------
  var PIECES = ['hp', 'money', 'wave', 'gun', 'up', 'pause'], PIECE_NAMES = [['Health', 'Vida'], ['Money', 'Dinheiro'], ['Wave', 'Wave'], ['Weapon', 'Arma'], ['Upgrade', 'Upgrade'], ['Pause', 'Pausa']];
  var last = {};
  function put(el, key, v) { if (last[key] !== v) { last[key] = v; el.textContent = v; } }
  function updateHud() {
    PIECES.forEach(function (p, i) { hud[p].classList.toggle('is-on', i < hudN); });
    var h = Math.max(0, Math.ceil(hp));
    put(hud.hpN, 'hp', String(h));
    if (last.hpw !== h) { last.hpw = h; hud.hpBar.style.width = h + '%'; hud.hp.classList.toggle('is-low', h <= 30); }
    put(hud.moneyN, 'm', '$' + money);
    put(hud.waveN, 'w', String(Math.max(1, wave)));
    put(hud.gunName, 'g', gunName(gunI));
    if (last.gi !== gunI) { last.gi = gunI; hud.gun.setAttribute('data-gun', String(gunI)); }
    put(hud.ammo, 'a', reloadT > 0 ? (pt() ? 'recarregando' : 'reloading') : mag + '/' + GUNS[gunI].mag);
    var rl = reloadT > 0 ? Math.round((1 - reloadT / GUNS[gunI].reload) * 100) : 100;
    if (last.rl !== rl) { last.rl = rl; hud.reload.style.width = rl + '%'; }
    var u = nextUp(), ready = money >= u.price;
    put(hud.upWhat, 'uw', u.name); put(hud.upPrice, 'up', '$' + u.price);
    if (last.ur !== ready) { last.ur = ready; hud.up.classList.toggle('is-ready', ready); }
    var lab = 'Upgrade: ' + u.name + ', $' + u.price;
    if (last.ul !== lab) { last.ul = lab; hud.up.setAttribute('aria-label', lab); }
    var pl = paused ? tr(['Resume the game (P)', 'Continuar o jogo (P)']) : tr(['Pause the game (P)', 'Pausar o jogo (P)']);
    if (last.pl !== pl) { last.pl = pl; hud.pause.setAttribute('aria-label', pl); hud.pause.title = pl; }
    if (last.pp !== paused) { last.pp = paused; hud.pause.classList.toggle('is-paused', paused); }
    var off = tool === 'script' && !live();
    if (last.po !== off) { last.po = off; hud.pause.disabled = off; }
  }
  function addPiece() {
    if (hudN >= PIECES.length) return;
    hudN++;
    updateHud(); updateNext();
    var r = hud[PIECES[hudN - 1]].getBoundingClientRect(), b = canvas.getBoundingClientRect();
    burst(((r.left + r.width / 2 - b.left) - W / 2) / S, ((r.top + r.height / 2 - b.top) - H / 2) / S, 14, 3 + (hudN % 3), 2.2, 0.5);
    if (hudN === PIECES.length) celebrate(tr(['HUD ready!', 'HUD pronto!']));
    wake();
  }
  function ensureHud() { if (hudN < PIECES.length) { hudN = PIECES.length; updateHud(); updateNext(); } }

  // ---------- Avisos ----------
  var bannerTimer = 0, bannerCb = null;
  function showBanner(title, text, btn, cb, ms, cls) {
    clearTimeout(bannerTimer);
    bannerTitle.textContent = title; bannerText.textContent = text || '';
    bannerBtn.hidden = !btn; if (btn) bannerBtn.textContent = btn;
    bannerCb = cb || null;
    banner.className = 'studio__banner is-on ' + (cls || '');
    if (ms) bannerTimer = setTimeout(hideBanner, ms);
  }
  function hideBanner() { clearTimeout(bannerTimer); banner.classList.remove('is-on'); bannerCb = null; }
  bannerBtn.addEventListener('click', function () { var cb = bannerCb; hideBanner(); if (cb) cb(); wake(); canvas.focus({ preventScroll: true }); });
  function say(text) { said.textContent = ''; setTimeout(function () { said.textContent = text; }, 30); }

  // ---------- Programar: o script dos zumbis ----------
  var CODE = [
    [['k', 'local'], ['', ' zumbis = workspace.Zumbis']],
    [['k', 'local'], ['', ' alvo = workspace.Jogador.PrimaryPart']],
    [],
    [['k', 'for'], ['', ' wave = '], ['n', '1'], ['', ', '], ['n', '10'], ['k', ' do']],
    [['  '], ['k', 'for'], ['', ' i = '], ['n', '1'], ['', ', '], ['n', '6'], ['', ' + wave * '], ['n', '2.6'], ['k', ' do']],
    [['    '], ['k', 'local'], ['', ' z = zumbis.Modelo:Clone()']],
    [['    '], ['', 'z.Humanoid.WalkSpeed = '], ['n', '8'], ['', ' + wave']],
    [['    '], ['', 'z.Humanoid.MaxHealth = '], ['n', '20'], ['', ' * '], ['n', '1.16'], ['', ' ^ wave']],
    [['    '], ['', 'z.Parent = workspace']],
    [['    '], ['', 'z.Humanoid:MoveTo(alvo.Position)']],
    [['    '], ['', 'task.wait('], ['n', '1'], ['', ')']],
    [['  '], ['k', 'end']],
    [['k', 'end']]
  ];
  var CODE_LEN = CODE.reduce(function (n, l) { return n + l.reduce(function (m, tk) { return m + (tk[1] !== undefined ? tk[1] : tk[0]).length; }, 0) + 1; }, 0);
  var typed = 0, codeTimer = 0;
  function renderCode(upTo) {
    codeEl.textContent = '';
    var left = upTo, cur = 0;
    CODE.forEach(function (line, n) {
      var ln = document.createElement('span');
      ln.className = 'ln';
      line.forEach(function (tk) {
        if (left <= 0) return;
        var text = tk[1] !== undefined ? tk[1] : tk[0], cls = tk[1] !== undefined ? tk[0] : '', part2 = text.slice(0, left);
        left -= part2.length;
        if (cls) { var s = document.createElement('span'); s.className = cls; s.textContent = part2; ln.appendChild(s); } else ln.appendChild(document.createTextNode(part2));
      });
      if (left > 0) { left--; cur = n + 1; }
      ln.appendChild(document.createTextNode('\n'));
      codeEl.appendChild(ln);
    });
    var el = codeEl.children[Math.min(cur, CODE.length - 1)];
    if (el && codeEl.scrollHeight > codeEl.clientHeight + 2) codeEl.scrollTop = Math.max(0, el.offsetTop - codeEl.clientHeight / 2);
  }
  function startCode() {
    clearTimeout(codeTimer);
    state = 'code'; codeEl.classList.remove('is-folded');
    typed = reduced ? CODE_LEN : 0;
    (function type() {
      typed = Math.min(CODE_LEN, typed + 4);
      renderCode(typed);
      if (typed < CODE_LEN) codeTimer = setTimeout(type, 18);
      else codeTimer = setTimeout(function () { if (tool === 'script' && state === 'code') { newGame(); wake(); } }, 500);
    })();
  }
  function play() {                     // entrar na etapa do jogo: o script, se o jogo ainda não começou; senão, continua
    if (state === 'idle') startCode();
    else if (state === 'code' && typed >= CODE_LEN) { newGame(); }
  }

  // ---------- As ferramentas ----------
  var tool = 'build';
  function setTool(name, announce) {
    if (name === tool && !announce) return;
    if (tool === 'script' && name !== 'script' && live()) setPause(true, true);
    var was = tool;
    tool = name;
    box.setAttribute('data-tool', name);
    toolBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === name)); });
    if (announce) { infoBox.setAttribute('aria-live', 'polite'); setTimeout(function () { infoBox.setAttribute('aria-live', 'off'); }, 1200); }
    infos.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('data-tool') === name); });
    if (was === 'script' && name !== 'script') { firing = keyFire = false; keyTurn = 0; if (state === 'code') { clearTimeout(codeTimer); state = 'idle'; } }
    nightGoal = name === 'build' ? 0 : 1;
    if (name !== 'build') ensureCity();
    if (name === 'ui' || name === 'script') ensureLamps();
    if (name === 'script') { ensureHud(); play(); }
    if (nightGoal > 0 && !nightOk) relight();
    updateNext(); updateHud();
    wake();
  }
  toolBtns.forEach(function (b) { b.addEventListener('click', function () { setTool(b.getAttribute('data-tool'), true); }); });
  function updateNext() {
    var label, name, count, p, done = false, nxt = stepDone();
    if (nxt) {
      label = tr(['Next:', 'Próxima:']); name = tr(TOOL_NAMES[NEXT_TOOL[tool]]); count = ''; p = 1; done = true;
    } else if (tool === 'light') {
      label = tr(['Light:', 'Iluminar:']); name = tr(['Next lamp', 'Próximo poste']); count = lamps.length + '/' + MAXLAMPS; p = lamps.length / MAXLAMPS;
    } else if (tool === 'ui') {
      label = 'Interface:'; done = hudN >= PIECES.length; name = done ? tr(['HUD ready', 'HUD pronto']) : tr(PIECE_NAMES[hudN]); count = hudN + '/' + PIECES.length; p = hudN / PIECES.length;
    } else {
      label = tr(['Build:', 'Construir:']); done = built >= STEPS.length; name = done ? tr(['City ready', 'Cidade pronta']) : tr(STEPS[built]); count = built + '/' + STEPS.length; p = built / STEPS.length;
    }
    nextLabel.textContent = label; nextName.textContent = name; nextCount.textContent = count;
    nextBtn.style.setProperty('--p', p);
    nextBtn.classList.toggle('is-done', done);
    nextBtn.classList.toggle('is-next', nxt);
    nextBtn.classList.toggle('is-busy', tool === 'build' && building());
  }
  // Com a etapa da vez pronta (a cidade inteira de pé, os 4 postes, o HUD montado), o próximo clique vai para a etapa
  // seguinte: dá para fazer o jogo inteiro só clicando. O botão do canto mostra qual é.
  var NEXT_TOOL = { build: 'light', light: 'ui', ui: 'script' }, TOOL_NAMES = { light: ['Light', 'Iluminar'], ui: ['Interface', 'Interface'], script: ['Script', 'Programar'] };
  function stepDone() {
    if (tool === 'build') return built >= STEPS.length && !building();
    if (tool === 'light') return lamps.length >= MAXLAMPS;
    if (tool === 'ui') return hudN >= PIECES.length;
    return false;
  }
  function advance() { var n = NEXT_TOOL[tool]; if (n) setTool(n, true); }
  function act() {
    if (stepDone()) advance();
    else if (tool === 'build') buildNext();
    else if (tool === 'light') autoLamp();
    else if (tool === 'ui') addPiece();
  }
  nextBtn.addEventListener('click', act);
  resetBtn.addEventListener('click', function () {
    clearTimeout(codeTimer);
    built = 0; stepT = []; stepEnd = []; fin = []; lamps = []; hudN = 0; state = 'idle'; paused = false;
    for (var i = 0; i < MAXZ; i++) ZS[i].on = false;
    zAlive = 0; BL.fill(0); QL.fill(0); qLive = 0; DT.fill(0); floats = [];
    gunI = 0; dmgLvl = 0; mag = GUNS[0].mag; money = 0; hp = 100; wave = 0; kills = 0;
    hideBanner(); codeEl.classList.remove('is-folded'); codeEl.textContent = '';
    if (tool !== 'build') { ensureCity(); if (tool !== 'light') ensureLamps(); if (tool === 'script') { ensureHud(); play(); } }
    paintDay(); pathOk = false;
    updateNext(); updateHud(); wake();
  });
  hud.up.addEventListener('click', function () { buy(); canvas.focus({ preventScroll: true }); });
  hud.pause.addEventListener('click', function () { if (paused) setPause(false); else if (canPause()) setPause(true); if (!paused) canvas.focus({ preventScroll: true }); });

  // ---------- Mouse, toque e teclado ----------
  var press = null, kbAim = false;
  function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function local2world(p) { return [(p.x - W / 2) / S, (p.y - H / 2) / S]; }
  function aimTo(p) { var q = local2world(p); if (q[0] * q[0] + q[1] * q[1] > 0.04) aim = assist(Math.atan2(q[1], q[0])); }
  // no toque, a mira gruda de leve no zumbi mais perto da direção do dedo (o dedo cobre o alvo), se nada estiver na frente dele
  function inSight(x, y) { var d = Math.hypot(x, y), n = Math.ceil(d / 0.25); for (var k = 2; k < n; k++) if (solidAt(x * k / n, y * k / n)) return false; return true; }
  function assist(a) {
    if (!coarse || press === null) return a;
    var bestD = 0.2, out = a;
    for (var i = 0; i < MAXZ; i++) {
      var z = ZS[i]; if (!z.on) continue;
      var za = Math.atan2(z.y, z.x), d = Math.abs(Math.atan2(Math.sin(za - a), Math.cos(za - a)));
      if (d < bestD && inSight(z.x, z.y)) { bestD = d; out = za; }
    }
    return out;
  }
  function gameOn() { return tool === 'script' && !paused && live(); }
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var p = local(e);
    press = { id: e.pointerId, x: p.x, y: p.y, moved: false, touch: e.pointerType !== 'mouse' };
    if (gameOn()) { firing = true; aimTo(p); try { canvas.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault(); wake(); }
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = local(e);
    if (e.pointerType === 'mouse') { hover = p; kbAim = false; }
    if (tool === 'script' && (e.pointerType === 'mouse' || (press && press.id === e.pointerId))) aimTo(p);
    if (press && press.id === e.pointerId && Math.hypot(p.x - press.x, p.y - press.y) > 8) press.moved = true;
    wake();
  });
  function release(e) {
    if (!press || press.id !== e.pointerId) return;
    var pr = press; press = null;
    if (tool === 'script') { firing = false; return; }
    if (pr.moved) return;
    var p = local(e), q = local2world(p);
    if (tool === 'light') { if (!toggleLamp(q[0], q[1]) && stepDone()) advance(); }      // com os 4 postes, clicar num poste ainda tira
    else act();
    hideHint();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', function (e) { if (press && press.id === e.pointerId) { press = null; firing = false; } });
  canvas.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = null; previewSlot = null; wake(); } });
  canvas.addEventListener('contextmenu', function (e) { if (tool === 'script') e.preventDefault(); });
  canvas.addEventListener('keydown', function (e) {
    var k = e.key;
    if (tool === 'script') {
      if (k === 'p' || k === 'P' || (k === 'Escape' && paused)) { if (paused) setPause(false); else if (canPause()) setPause(true); e.preventDefault(); return; }
      if (k === 'Escape' && canPause()) { setPause(true); e.preventDefault(); return; }
      if (paused) return;
      if (k === 'ArrowLeft' || k === 'ArrowUp') { keyTurn = -1; kbAim = true; e.preventDefault(); wake(); return; }
      if (k === 'ArrowRight' || k === 'ArrowDown') { keyTurn = 1; kbAim = true; e.preventDefault(); wake(); return; }
      if (k === ' ' || k === 'Enter') { if (gameOn()) { keyFire = true; e.preventDefault(); wake(); } return; }
      if (k === 'u' || k === 'U') { buy(); e.preventDefault(); return; }
      return;
    }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); act(); }
  });
  canvas.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowRight' || k === 'ArrowDown') keyTurn = 0;
    if (k === ' ' || k === 'Enter') keyFire = false;
  });
  canvas.addEventListener('blur', function () { keyFire = false; keyTurn = 0; });
  window.addEventListener('blur', function () { firing = keyFire = false; keyTurn = 0; });

  // ---------- A dica do começo ----------
  var hintTimer = 0;
  function showHint() { if (!hint) return; hint.classList.remove('is-gone'); clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 6000); }
  function hideHint() { if (hint) hint.classList.add('is-gone'); }

  // ---------- O laço ----------
  var visible = false, raf = 0, lastT = 0, started = false, fps = 60;
  function wake() { if (visible && !raf) raf = requestAnimationFrame(frame); }
  var cost = 0;
  function frame(t) {
    raf = 0;
    var c0 = performance.now();
    var dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    if (lastT) fps = fps * 0.95 + (1 / Math.max(0.001, (t - lastT) / 1000)) * 0.05;
    lastT = t; T = now();
    checkSteps();
    if (night !== nightGoal) { night += (nightGoal - night) * (1 - Math.exp(-dt * 3.4)); if (Math.abs(nightGoal - night) < 0.003) night = nightGoal; if (night > 0 && !nightOk) relight(); }
    if (lampFade < 1) lampFade = clamp((T - lampFadeT) / 320, 0, 1);
    var run = tool === 'script' && !paused && live(), frozen = paused && tool === 'script';
    if (run) { var left = dt * timeScale; while (left > 1e-6) { var h = Math.min(left, 1 / 60); step(h); left -= h; if (state === 'over' || state === 'won') break; } }
    if (!frozen) stepFx(dt);
    render();
    if (run || tool === 'script') updateHud();
    cost = cost * 0.95 + (performance.now() - c0) * 0.05;
    var busy = run || night !== nightGoal || building() || (!frozen && (qLive > 0 || floats.length || shake > 0)) || lampFade < 1 || (tool === 'light' && hover);
    if (busy) wake(); else lastT = 0;
  }
  function setVisible(v) {
    visible = v && !document.hidden;
    box.classList.toggle('is-away', !visible);          // fora da tela, a bolinha do texto para de piscar (site.css)
    if (!visible) { firing = keyFire = false; if (canPause()) setPause(true, true); }
    if (visible && !started) { started = true; showHint(); }
    if (visible) wake();
  }
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { setVisible(es[es.length - 1].isIntersecting); }, { rootMargin: '60px 0px' }).observe(box);
  else setVisible(true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) setVisible(false); else { var r = box.getBoundingClientRect(); if (r.top < window.innerHeight && r.bottom > 0) setVisible(true); } });
  if (window.HRPixels) HRPixels.watch(canvas, size); else window.addEventListener('resize', size);
  document.addEventListener('langchange', function () { updateNext(); last = {}; updateHud(); if (paused && banner.classList.contains('is-pause')) pauseBanner(); wake(); });
  // para os testes automáticos (só com ?studio-debug no endereço)
  if (/[?&]studio-debug\b/.test(location.search)) window.HRStudio = {
    state: function () { var b = 0; for (var i = 0; i < MAXB; i++) if (BL[i] > 0) b++; return { tool: tool, built: built, fin: fin.slice(), lamps: lamps.length, hud: hudN, night: night, state: state, wave: wave, hp: hp, money: money, gun: gunI, dmg: dmgLvl, mag: mag, zombies: zAlive, bullets: b, parts: qLive, kills: kills, price: nextUp().price, fps: Math.round(fps), cost: Math.round(cost * 100) / 100, path: pathOk, spawns: SPAWNS.length, S: S, best: best }; },
    zombies: function () { var out = []; for (var i = 0; i < MAXZ; i++) if (ZS[i].on) out.push({ x: ZS[i].x, y: ZS[i].y, r: ZS[i].r, kind: ZS[i].kind, hp: ZS[i].hp }); return out; },
    lamps: function () { return lamps.map(function (l) { return [l.x, l.y]; }); },
    toScreen: function (x, y) { return [W / 2 + x * S, H / 2 + y * S]; },
    aim: function (a) { aim = a; }, fire: function (on) { keyFire = !!on; wake(); },
    cheat: function (o) { if (o.money !== undefined) money = o.money; if (o.hp !== undefined) hp = o.hp; if (o.speed) timeScale = o.speed; updateHud(); wake(); },
    pause: function (on) { setPause(on); }, paused: function () { return paused; },
    preview: function (x, y) { var t = lampTarget(x, y, true); return t ? [t.p[0], t.p[1], t.remove !== undefined] : null; },
    buy: buy, solidAt: solidAt, raster: function () { raster(); return { GW: GW, GH: GH, spawns: SPAWNS.length, spawnb: SPAWNB.length }; },
    field: function (big) { if (!pathOk) raster(); var F = big ? F2 : F1; return { GW: GW, GH: GH, gx0: gx0, gy0: gy0, RES: RES, blk: Array.prototype.slice.call(F.blk), dist: Array.prototype.slice.call(F.dist).map(function (d) { return isFinite(d) ? d : -1; }) }; }
  };
  updateNext(); updateHud();
  box.setAttribute('data-tool', tool);
})();
