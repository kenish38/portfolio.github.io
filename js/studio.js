// ===== O estúdio: uma baseplate em que o visitante monta uma fazenda =====
// Uma cena 3D desenhada num <canvas>, sem bibliotecas (projeção ortográfica feita aqui mesmo). Começa como a baseplate
// vazia do Roblox Studio, com o SpawnLocation no meio. A cena gira devagar sozinha, como numa vitrine; arrastar gira
// (e, com o mouse, também inclina). Cada ferramenta mostra uma área de trabalho:
//   Construir  cada clique ergue a próxima parte da fazenda, sempre na mesma ordem: casa do sítio, silo, curral das
//              vaquinhas, moinho de vento, plantação, lago dos patos e, por fim, pomar e caminhos
//   Iluminar   a noite cai e as luzes da fazenda acendem uma a uma; um clique apaga e acende de novo
//   Programar  um script em Luau é digitado e "roda": os blocos entram numa onda
//   Interface  aparece um HUD de jogo; pegar as moedas soma pontos e sobe de nível
//   IA         um pedido é digitado e a "IA" monta uma cena bloco por bloco
// Com a baseplate ainda vazia, Iluminar, Programar e Interface montam a fazenda inteira primeiro (senão não há o que ver).
// O sol faz sombra (no chão e nos outros blocos), os cantos escurecem e cada material tem a sua cor e o seu brilho.
// Teclado: com a cena em foco, Enter (ou espaço) age, as setas andam pelas casas (para pegar moedas) e Q/E giram.
// Toque: tocar age; deslizar para o lado gira; para cima e para baixo a página rola normalmente.
// Menos movimento: sem giro sozinho, sem quedas, sem onda e sem vaga-lumes. O desenho só roda com o estúdio na tela.
(function () {
  'use strict';
  var root = document.documentElement, box = document.querySelector('.studio');
  if (!box) return;
  var canvas = box.querySelector('.studio__canvas'), ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  root.classList.add('has-studio');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function all(sel) { return Array.prototype.slice.call(box.querySelectorAll(sel)); }
  var toolBtns = all('.tool'), infos = all('.studio__info');
  var infoBox = box.querySelector('.studio__infos'), hint = box.querySelector('.studio__hint');
  var codeEl = box.querySelector('.studio__code'), hud = box.querySelector('.studio__hud');
  var coinsEl = hud.querySelector('.studio__coins b'), levelEl = hud.querySelector('.studio__level b'), lifeEl = hud.querySelector('.studio__life i');
  var promptBox = box.querySelector('.studio__prompt'), askEl = promptBox.querySelector('.studio__ask'), againBtn = promptBox.querySelector('.studio__again');
  var resetBtn = box.querySelector('.studio__reset'), nextBtn = box.querySelector('.studio__next');
  var nextLabel = nextBtn.querySelector('.studio__next-label'), nextName = nextBtn.querySelector('.studio__next-name'), nextCount = nextBtn.querySelector('.studio__next-count');
  function pt() { return root.lang === 'pt-BR'; }
  function now() { return performance.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function hash(x, y, z) { var h = Math.imul(x + 11, 374761393) ^ Math.imul(y + 7, 668265263) ^ Math.imul(z + 3, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  var T = now();                        // a hora do quadro

  // ---------- Materiais: cada um é uma lista de caixas dentro da casa ----------
  // caixa: [x0, y0, z0, x1, y1, z1, cor, tipo], de 0 a 1 dentro da casa (pode passar um pouco, como o beiral).
  // tipo: 'g' vidro (à noite vira janela acesa), 'e' lâmpada, 's' brilho de metal, 'v' tom que varia de bloco a bloco,
  // 'f' flor (a cor muda de flor para flor)
  function B(x0, y0, z0, x1, y1, z1, c, k) { return [x0, y0, z0, x1, y1, z1, c, k || '']; }
  function cube(c, k) { return [B(0, 0, 0, 1, 1, 1, c, k)]; }
  function mid(w, h, c, k, lift) { var a = (1 - w) / 2, l = lift || 0; return [B(a, a, l, a + w, a + w, l + h, c, k)]; }
  function flipX(list) { return list.map(function (b) { return [1 - b[3], b[1], b[2], 1 - b[0], b[4], b[5], b[6], b[7]]; }); }
  var WOODC = [134, 94, 60], WHITE = [244, 242, 238], BLACK = [46, 44, 44], PINK = [236, 164, 160], GRASSY = [96, 150, 70];
  // cerca: um poste no meio e dois trilhos (ax: ao longo de x; ay: ao longo de y); na quina, os trilhos vão só para dentro
  function fence(ax, ay) {
    var out = [B(0.4, 0.4, 0, 0.6, 0.6, 0.86, WOODC)];
    if (ax) out.push(B(0, 0.46, 0.3, 1, 0.54, 0.38, WOODC), B(0, 0.46, 0.6, 1, 0.54, 0.68, WOODC));
    if (ay) out.push(B(0.46, 0, 0.3, 0.54, 1, 0.38, WOODC), B(0.46, 0, 0.6, 0.54, 1, 0.68, WOODC));
    return out;
  }
  function corner(dx, dy) {
    var x0 = dx > 0 ? 0.5 : 0, x1 = dx > 0 ? 1 : 0.5, y0 = dy > 0 ? 0.5 : 0, y1 = dy > 0 ? 1 : 0.5;
    return [B(0.38, 0.38, 0, 0.62, 0.62, 0.92, WOODC), B(x0, 0.46, 0.3, x1, 0.54, 0.38, WOODC), B(x0, 0.46, 0.6, x1, 0.54, 0.68, WOODC), B(0.46, y0, 0.3, 0.54, y1, 0.38, WOODC), B(0.46, y0, 0.6, 0.54, y1, 0.68, WOODC)];
  }
  // a vaquinha (olhando para +x): patas, corpo branco com a mancha preta no meio, cabeça, focinho rosa e orelhas
  function cow(dir) {
    var out = [];
    [[0.18, 0.3], [0.18, 0.62], [0.6, 0.3], [0.6, 0.62]].forEach(function (p) { out.push(B(p[0], p[1], 0, p[0] + 0.1, p[1] + 0.08, 0.3, WHITE)); });
    out.push(B(0.12, 0.26, 0.28, 0.34, 0.74, 0.66, WHITE), B(0.34, 0.26, 0.28, 0.54, 0.74, 0.66, BLACK), B(0.54, 0.26, 0.28, 0.76, 0.74, 0.66, WHITE));
    out.push(B(0.76, 0.34, 0.44, 0.92, 0.66, 0.76, WHITE), B(0.92, 0.38, 0.44, 1, 0.62, 0.58, PINK));
    out.push(B(0.8, 0.26, 0.68, 0.86, 0.34, 0.74, BLACK), B(0.8, 0.66, 0.68, 0.86, 0.74, 0.74, BLACK));
    out.push(B(0.05, 0.47, 0.34, 0.12, 0.53, 0.62, BLACK));            // o rabo (as caixas de 7 em diante mexem: cabeça, focinho, orelhas, rabo)
    return dir > 0 ? out : flipX(out);
  }
  // o pato (olhando para +x): corpo baixo e comprido, rabinho levantado, pescoço, cabeça em cima da frente e o bico para a frente
  function duck(dir) {
    var out = [B(0.2, 0.33, 0, 0.7, 0.67, 0.2, WHITE), B(0.12, 0.4, 0.12, 0.22, 0.6, 0.27, WHITE), B(0.56, 0.43, 0.16, 0.66, 0.57, 0.36, WHITE), B(0.53, 0.4, 0.34, 0.71, 0.6, 0.5, WHITE), B(0.71, 0.45, 0.38, 0.82, 0.55, 0.44, [242, 160, 52])];
    return dir > 0 ? out : flipX(out);
  }
  function wheat() {
    var out = [];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) { var x = 0.14 + i * 0.28, y = 0.2 + j * 0.42; out.push(B(x, y, 0, x + 0.08, y + 0.08, 0.4, [196, 158, 70]), B(x - 0.03, y - 0.03, 0.4, x + 0.11, y + 0.11, 0.62, [232, 194, 96], 'v')); }
    return out;
  }
  function corn() {
    var out = [];
    [[0.16, 0.22], [0.56, 0.5], [0.22, 0.7]].forEach(function (p) { out.push(B(p[0], p[1], 0, p[0] + 0.1, p[1] + 0.1, 0.96, GRASSY), B(p[0] + 0.1, p[1], 0.44, p[0] + 0.18, p[1] + 0.1, 0.64, [242, 204, 92])); });
    return out;
  }
  // o SpawnLocation do Roblox: uma placa de 2 x 2 com o quadrado claro no meio (cada casa leva um quarto dele)
  function spawn(qx, qy) {
    return [B(0, 0, 0, 1, 1, 0.12, [74, 76, 82]), B(qx ? 0.4 : 0, qy ? 0.4 : 0, 0.12, qx ? 1 : 0.6, qy ? 1 : 0.6, 0.14, [214, 214, 220])];
  }
  var MAT = {
    pearl:  cube([238, 234, 226]),
    stone:  cube([176, 171, 162]),
    stone2: cube([140, 136, 130]),
    timber: cube([126, 86, 54]),
    door:   cube([104, 70, 44]),
    glass:  cube([150, 192, 216], 'g'),
    roof:   cube([184, 72, 58], 'v'),
    roof2:  cube([156, 58, 48], 'v'),
    metal:  cube([180, 190, 198], 's'),
    metal2: cube([140, 150, 160], 's'),
    dome:   [B(0, 0, 0, 1, 1, 0.5, [180, 190, 198], 's')],
    cap:    mid(0.5, 0.4, [140, 150, 160], 's'),
    hay:    mid(0.84, 0.56, [222, 184, 94], 'v'),
    gold:   cube([234, 178, 80], 's'),
    wood:   cube([140, 97, 61]),
    slate:  cube([104, 109, 118]),
    leaf:   cube([96, 146, 82], 'v'),
    apple:  [B(0, 0, 0, 1, 1, 1, [96, 146, 82], 'v'), B(0.22, -0.05, 0.36, 0.38, 0, 0.52, [214, 54, 48]), B(1, 0.56, 0.5, 1.05, 0.72, 0.66, [214, 54, 48]), B(0.6, 1, 0.24, 0.76, 1.05, 0.4, [214, 54, 48]), B(-0.05, 0.3, 0.58, 0, 0.46, 0.74, [214, 54, 48])],
    autumn: cube([216, 124, 54], 'v'),
    trunk:  mid(0.36, 1, [118, 82, 52]),
    pole:   mid(0.18, 1, [72, 74, 80]),
    lamp:   mid(0.46, 0.46, [255, 230, 170], 'e'),
    lantern: mid(0.28, 0.3, [255, 226, 160], 'e', 0.62),
    postLamp: mid(0.34, 0.3, [255, 226, 160], 'e', -0.08),
    plank:  [B(0, 0, 0, 1, 1, 0.24, [152, 110, 72])],
    hub:    [B(0.82, 0, 0.35, 1.18, 0.3, 0.65, [96, 66, 42])],
    flower: mid(0.3, 0.3, [244, 196, 96], 'f'),
    rock:   mid(0.6, 0.42, [150, 146, 140]),
    fx: fence(1, 0), fy: fence(0, 1),
    cpp: corner(1, 1), cmp: corner(-1, 1), cpm: corner(1, -1), cmm: corner(-1, -1),
    cowE: cow(1), duckE: duck(1), duckW: duck(-1),
    trough: [B(0.08, 0.28, 0, 0.92, 0.72, 0.3, [120, 84, 54]), B(0.14, 0.34, 0.3, 0.86, 0.66, 0.31, [96, 150, 190])],
    wheat: wheat(), corn: corn(),
    scarecrow: [B(0.45, 0.45, 0, 0.55, 0.55, 0.74, WOODC), B(0.1, 0.46, 0.52, 0.9, 0.54, 0.6, WOODC), B(0.34, 0.36, 0.32, 0.66, 0.64, 0.64, [176, 72, 60]), B(0.38, 0.38, 0.64, 0.62, 0.62, 0.86, [232, 202, 140]), B(0.28, 0.28, 0.86, 0.72, 0.72, 0.9, [118, 88, 52]), B(0.38, 0.38, 0.9, 0.62, 0.62, 1.02, [118, 88, 52])],
    reed: [B(0.2, 0.3, 0, 0.26, 0.36, 0.6, GRASSY), B(0.19, 0.29, 0.6, 0.27, 0.37, 0.72, [120, 84, 50]), B(0.6, 0.55, 0, 0.66, 0.61, 0.5, GRASSY), B(0.59, 0.54, 0.5, 0.67, 0.62, 0.62, [120, 84, 50]), B(0.4, 0.75, 0, 0.46, 0.81, 0.42, GRASSY)],
    spA: spawn(1, 1), spB: spawn(0, 1), spC: spawn(1, 0), spD: spawn(0, 0)
  };
  // o que cada material tem: inteiro (esconde as faces encostadas), luz própria, vidro
  Object.keys(MAT).forEach(function (k) {
    var l = MAT[k], b = l[0];
    l.full = l.length === 1 && b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 1 && b[4] === 1 && b[5] === 1;
    l.emit = l.some(function (q) { return q[7] === 'e'; });
    l.glass = l.some(function (q) { return q[7] === 'g'; });
  });
  var FLOWERS = [[244, 196, 96], [240, 238, 232], [232, 128, 122], [196, 150, 232]];
  // o chão de cada casa
  var GROUND = { base: [104, 106, 112], grass: [108, 152, 84], path: [192, 172, 138], gravel: [170, 166, 158], dirt: [150, 112, 76], soil: [116, 82, 56], water: [62, 128, 166], sand: [214, 196, 154], plaza: [196, 192, 184] };
  var WATER_Z = -0.14;                  // a água fica um pouco abaixo do chão

  // ---------- O mundo ----------
  var G = 12, MAXH = 9, C = G / 2, DROP = 520;
  var cols = [], ground = [], gnext = [], gswitch = [], lights = [], dirty = true, baked = 0;
  function inside(x, y) { return x >= 0 && y >= 0 && x < G && y < G; }
  function col(x, y) { return cols[x * G + y]; }
  function at(x, y, z) { if (!inside(x, y)) return null; var c = col(x, y); for (var i = 0; i < c.length; i++) if (c[i].z === z) return c[i]; return null; }
  function landed(v) { return T >= v.t0 + (v.from && !reduced ? DROP * 0.72 : 0) && !v.gone; }
  // para esconder faces encostadas: só blocos inteiros que já pousaram
  function solidNow(x, y, z) { var v = at(x, y, z); return !!(v && MAT[v.m].full && landed(v)); }
  function solid(x, y, z) { var v = at(x, y, z); return !!(v && MAT[v.m].full && !v.gone); }
  function top(x, y) { var c = col(x, y), z = 0; for (var i = 0; i < c.length; i++) if (!c[i].gone) z = c[i].z + 1; return z; }
  function count() { var n = 0; cols.forEach(function (c) { n += c.length; }); return n; }
  function add(x, y, z, m, delay, from) {
    if (!inside(x, y) || z < 0 || z >= MAXH || at(x, y, z) || !MAT[m]) return null;
    var v = { x: x, y: y, z: z, m: m, t0: now() + (delay || 0), from: from || 0, k: hash(x, y, z), puffed: false, gone: 0, sh: null, ao: 0, li: -1 };
    var c = col(x, y);
    c.push(v); c.sort(function (a, b) { return a.z - b.z; });
    dirty = true; wake();
    return v;
  }
  function emptyWorld() { cols = []; for (var i = 0; i < G * G; i++) cols.push([]); dirty = true; }
  // o chão muda numa onda que sai de (cx, cy); fn devolve o tipo novo da casa (ou null para deixar como está)
  function setGround(fn, ripple, cx, cy) {
    var t = now();
    if (cx === undefined) { cx = C; cy = C; }
    for (var x = 0; x < G; x++) for (var y = 0; y < G; y++) {
      var i = x * G + y, g = fn(x, y);
      if (!g) continue;
      if (!ripple || reduced) { ground[i] = g; gnext[i] = g; gswitch[i] = 0; }
      else { gnext[i] = g; gswitch[i] = t + Math.hypot(x + 0.5 - cx, y + 0.5 - cy) * 55; }
    }
    dirty = true;
  }
  function rects(list) { return function (x, y) { for (var i = list.length - 1; i >= 0; i--) { var r = list[i]; if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return r[4]; } return null; }; }
  function baseplate() {
    emptyWorld();
    setGround(function () { return 'base'; }, false);
    add(5, 6, 0, 'spA'); add(6, 6, 0, 'spB'); add(5, 7, 0, 'spC'); add(6, 7, 0, 'spD');
  }
  // monta uma lista de blocos: de baixo para cima e do centro (cx, cy) para fora, um depois do outro
  function build(list, step, from, fly, cx, cy) {
    if (cx === undefined) { cx = C; cy = C; }
    list.sort(function (a, b) { return a[2] - b[2] || Math.hypot(a[0] + 0.5 - cx, a[1] + 0.5 - cy) - Math.hypot(b[0] + 0.5 - cx, b[1] + 0.5 - cy); });
    list.forEach(function (p, k) { var v = add(p[0], p[1], p[2], p[3], reduced ? 0 : k * step, reduced ? 0 : from); if (v) v.fly = fly; });
    return reduced ? 0 : list.length * step + DROP;
  }

  // ---------- A fazenda: as partes, na ordem em que o visitante constrói ----------
  // cada parte: o nome, o chão que ela muda, os blocos, o centro (de onde a obra começa) e a área (o contorno que aparece
  // embaixo do cursor antes do clique)
  var FARM = [
    { en: 'Farmhouse', pt: 'Casa do sítio', c: [3, 2.5], area: [0, 1, 6, 5], ground: [[0, 0, 5, 4, 'grass'], [3, 4, 3, 4, 'path']], make: function (b) {
      for (var z = 0; z < 2; z++) for (var x = 1; x <= 4; x++) for (var y = 1; y <= 3; y++) {
        var m = (x === 1 || x === 4) && (y === 1 || y === 3) ? 'timber' : 'pearl';
        if (z === 0 && x === 3 && y === 3) m = 'door';
        else if (z === 1 && ((y === 3 && x === 2) || (x === 4 && y === 2) || (y === 1 && x === 3))) m = 'glass';
        else if (z === 0 && x === 1 && y === 2) m = 'glass';
        b(x, y, z, m);
      }
      for (x = 0; x <= 5; x++) for (y = 1; y <= 3; y++) b(x, y, 2, 'roof');      // o telhado passa da parede nos lados (beiral)
      for (x = 0; x <= 5; x++) b(x, 2, 3, 'roof2');
      b(1, 1, 3, 'stone2'); b(1, 1, 4, 'stone2');                                  // a chaminé
      b(2, 4, 0, 'pole'); b(4, 4, 0, 'pole'); for (x = 2; x <= 4; x++) b(x, 4, 1, 'plank');   // a varanda
      b(3, 4, 0, 'lantern');
      b(1, 4, 0, 'flower'); b(0, 3, 0, 'flower'); b(5, 3, 0, 'flower');
    } },
    { en: 'Silo', pt: 'Silo', c: [10.5, 1.5], area: [9, 0, 12, 3], ground: [[8, 0, 11, 3, 'gravel']], make: function (b) {
      var plus = [[10, 0], [9, 1], [10, 1], [11, 1], [10, 2]];
      for (var z = 0; z < 6; z++) plus.forEach(function (p) { b(p[0], p[1], z, z === 2 || z === 4 ? 'metal2' : 'metal'); });
      [[10, 0], [9, 1], [11, 1], [10, 2]].forEach(function (p) { b(p[0], p[1], 6, 'dome'); });
      b(10, 1, 6, 'metal'); b(10, 1, 7, 'cap');
      b(8, 2, 0, 'hay'); b(8, 3, 0, 'hay'); b(9, 3, 0, 'hay');
    } },
    { en: 'Cow pen', pt: 'Curral das vaquinhas', c: [9, 7], area: [7, 5, 11, 9], ground: [[7, 5, 10, 8, 'dirt']], make: function (b) {
      b(7, 5, 0, 'cpp'); b(10, 5, 0, 'cmp'); b(7, 8, 0, 'cpm'); b(10, 8, 0, 'cmm');
      b(8, 5, 0, 'fx'); b(9, 5, 0, 'fx'); b(9, 8, 0, 'fx');                     // a porteira fica aberta em (8, 8)
      b(7, 6, 0, 'fy'); b(7, 7, 0, 'fy'); b(10, 6, 0, 'fy'); b(10, 7, 0, 'fy');
      b(8, 6, 0, 'trough'); b(9, 6, 0, 'hay');
      b(8, 7, 0, 'cowE');
      b(10, 8, 1, 'postLamp');
    } },
    { en: 'Windmill', pt: 'Moinho de vento', c: [7, 2], area: [5, 1, 9, 4], ground: [[5, 0, 7, 3, 'grass']], make: function (b) {
      for (var z = 0; z < 5; z++) for (var x = 6; x <= 7; x++) for (var y = 1; y <= 2; y++) {
        var m = z < 3 ? 'stone' : 'pearl';
        if (z === 0 && x === 7 && y === 2) m = 'door';
        else if (z === 3 && x === 6 && y === 2) m = 'glass';
        b(x, y, z, m);
      }
      for (x = 6; x <= 7; x++) for (y = 1; y <= 2; y++) b(x, y, 5, 'roof');
      b(6, 3, 4, 'hub');
    } },
    { en: 'Crop field', pt: 'Plantação', c: [2.5, 7], area: [0, 5, 5, 9], ground: [[1, 5, 4, 8, 'soil'], [0, 5, 0, 8, 'grass']], make: function (b) {
      for (var x = 1; x <= 4; x++) { b(x, 5, 0, 'wheat'); b(x, 6, 0, 'corn'); b(x, 7, 0, 'wheat'); b(x, 8, 0, 'corn'); }
      b(0, 6, 0, 'scarecrow'); b(0, 8, 0, 'hay');
    } },
    { en: 'Duck pond', pt: 'Lago dos patos', c: [9, 10.5], area: [7, 9, 12, 12], ground: [[7, 9, 10, 11, 'water'], [11, 9, 11, 11, 'grass']], make: function (b) {
      b(7, 9, 0, 'plank'); b(7, 10, 0, 'plank');
      b(9, 10, 0, 'duckE'); b(10, 9, 0, 'duckW'); b(8, 11, 0, 'duckE');
      b(10, 11, 0, 'reed'); b(7, 11, 0, 'reed');
      b(11, 10, 0, 'pole'); b(11, 10, 1, 'pole'); b(11, 10, 2, 'lamp');
      b(11, 9, 0, 'rock');
    } },
    { en: 'Orchard and paths', pt: 'Pomar e caminhos', c: [5.5, 6.5], area: [0, 4, 12, 12], ground: 'final', make: function (b) {
      [[1, 10], [3, 10]].forEach(function (p) {
        var x = p[0], y = p[1];
        b(x, y, 0, 'trunk'); b(x, y, 1, 'trunk');
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d, i) { b(x + d[0], y + d[1], 2, i % 2 ? 'apple' : 'leaf'); });
        b(x, y, 3, 'leaf');
      });
      b(4, 9, 0, 'pole'); b(4, 9, 1, 'pole'); b(4, 9, 2, 'lamp');
      b(7, 3, 0, 'pole'); b(7, 3, 1, 'pole'); b(7, 3, 2, 'lamp');
      b(0, 9, 0, 'flower'); b(11, 6, 0, 'flower'); b(11, 7, 0, 'flower'); b(2, 11, 0, 'flower');
      b(5, 0, 0, 'rock'); b(11, 11, 0, 'rock'); b(11, 3, 0, 'rock');
    } }
  ];
  // o chão do fim: caminhos de terra (uma rua de lado a lado e uma alameda até o lago) e grama no que ainda era baseplate
  function finalGround(x, y) {
    if (y === 4 || ((x === 5 || x === 6) && y >= 4)) return 'path';
    return ground[x * G + y] === 'base' ? 'grass' : null;
  }
  var world = 'farm', farmStep = 0, built = [], millAt = 0;
  function buildItem(i, step) {
    var it = FARM[i], list = [];
    setGround(it.ground === 'final' ? finalGround : rects(it.ground), true, it.c[0], it.c[1]);
    it.make(function (x, y, z, m) { list.push([x, y, z, m]); });
    var dur = build(list, step, step > 8 ? 3.6 : 2.6, false, it.c[0], it.c[1]);
    built.push(setTimeout(function () {
      if (i === 3) millAt = now();
      var hz = 0; list.forEach(function (p) { hz = Math.max(hz, p[2] + 1); });
      if (step > 8) {
        floats.push({ text: pt() ? it.pt : it.en, x: it.c[0], y: it.c[1], z: hz + 0.6, life: 0, end: 1.6, big: true });
        burst(it.c[0], it.c[1], hz, 26, [[255, 226, 160], [255, 255, 255], [240, 178, 74]], 1.8, 'spark', 0.8);
      }
      if (i === FARM.length - 1 && step > 8) celebrate();
      wake();
    }, dur));
  }
  function celebrate() {
    floats.push({ text: pt() ? 'Fazenda pronta!' : 'Farm complete!', x: C, y: C, z: 6, life: 0, end: 2, big: true });
    burst(C, C, 5, 70, [[240, 178, 74], [255, 255, 255], [120, 200, 255], [255, 120, 150], [140, 220, 140]], 3.2, 'confetti', 1.9);
  }
  // o próximo clique em Construir: a parte seguinte da fazenda (depois de uma cena da IA, a baseplate volta primeiro)
  function buildNext() {
    if (aiBusy) return;
    if (world === 'ai') {
      clearScene();
      world = 'farm'; farmStep = 0;
      built.push(setTimeout(function () { baseplate(); updateNext(); wake(); }, reduced ? 0 : 420));
      updateNext();
      return;
    }
    if (farmStep >= FARM.length) { celebrate(); wake(); return; }
    buildItem(farmStep++, 18);
    updateNext();
  }
  // a fazenda inteira de uma vez (quando outra ferramenta precisa de algo para mostrar)
  function buildAll() {
    if (world !== 'farm' || farmStep > 0) return;
    for (var i = 0; i < FARM.length; i++) (function (i) { built.push(setTimeout(function () { buildItem(i, 5); }, reduced ? 0 : i * 260)); })(i);
    farmStep = FARM.length;
    updateNext();
  }
  function clearScene() { cols.forEach(function (c) { c.forEach(function (v) { v.gone = now(); }); }); millAt = 0; }
  function updateNext() {
    var done = world === 'farm' && farmStep >= FARM.length, n = world === 'ai' ? 0 : farmStep;
    nextLabel.textContent = done ? '' : world === 'ai' ? (pt() ? 'De volta à fazenda:' : 'Back to the farm:') : (pt() ? 'Construir:' : 'Build:');
    nextName.textContent = done ? (pt() ? 'Fazenda pronta!' : 'Farm complete!') : (pt() ? FARM[n].pt : FARM[n].en);
    nextCount.textContent = n + '/' + FARM.length;
    nextBtn.style.setProperty('--p', (n / FARM.length).toFixed(3));
    nextBtn.classList.toggle('is-done', done);
  }
  nextBtn.addEventListener('click', function () { buildNext(); wake(); });

  // ---------- A câmera ----------
  var yaw = 0.68, pitch = 0.6, yawGoal = null, spin = reduced ? 0 : 0.07, idleAt = 0, camAnim = null;
  var PMIN = 0.42, PMAX = 0.98;
  var W = 1, H = 1, dpr = 1, S = 20, ox = 0, oy = 0, TOP = 56, BOT = 56;
  var cy = 1, sn = 0, cp = 1, sp = 0;
  function size() {
    var r = canvas.getBoundingClientRect();
    // em telas grandes de alta resolução, 1,5x já fica nítido e o desenho continua leve
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, W > 760 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    // em cima fica o que aparece por cima da cena (dica, pedido, HUD); embaixo, a próxima obra e o recomeçar
    TOP = W < 560 ? 54 : 58; BOT = W < 560 ? 62 : 30;
    // a cena cabe na tela em qualquer giro (com prédios de até umas cinco peças, na inclinação do meio)
    var d = G * Math.SQRT2, avail = H - TOP - BOT;
    S = Math.max(4, Math.min(W * 0.94 / d, avail / (d * Math.sin(0.72) + 5.2 * Math.cos(0.72))));
    wake();
  }
  function camera() {
    cy = Math.cos(yaw); sn = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch);
    ox = W / 2; oy = TOP + (H - TOP - BOT) / 2 + 2.1 * S * cp;
  }
  // (x, y) em casas e z em alturas de bloco → px no canvas
  function sx(x, y) { return ox + ((x - C) * cy - (y - C) * sn) * S; }
  function sy(x, y, z) { return oy + ((x - C) * sn + (y - C) * cy) * S * sp - z * S * cp; }
  function depth(x, y, z) { return (x - C) * sn * cp + (y - C) * cy * cp + z * sp; }

  // ---------- A luz ----------
  function norm(x, y, z) { var l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }
  var SUN = norm(-0.46, 0.5, 0.74);
  var night = 0, nightGoal = 0, wave = 0, waveGoal = 0, lightsOn = false, lightsT = -1e9;
  var points = [];
  // as luzes acendem uma depois da outra (da casa para fora), com um tremidinho de lâmpada pegando; apagam rápido
  function level(i) {
    var d = T - lightsT - (lightsOn ? 450 + i * 150 : i * 45), k = clamp(d / (lightsOn ? 240 : 160), 0, 1);
    if (lightsOn && k > 0 && k < 1 && !reduced) k *= 0.55 + 0.45 * Math.abs(Math.sin(d * 0.06));
    return lightsOn ? k : 1 - k;
  }
  function blocked(px, py, pz) {
    for (var s = 0.25; s < 26; s += 0.25) {
      var x = px + SUN[0] * s, y = py + SUN[1] * s, z = pz + SUN[2] * s;
      if (z >= MAXH || x < 0 || y < 0 || x >= G || y >= G) return false;
      if (z < 0) continue;
      var v = at(x | 0, y | 0, z | 0);
      if (v && !v.gone) {
        var m = MAT[v.m];
        if (m.full) return true;
        var fx = x - v.x, fy = y - v.y, fz = z - v.z;
        for (var i = 0; i < m.length; i++) { var q = m[i]; if (fx > q[0] && fx < q[3] && fy > q[1] && fy < q[4] && fz > q[2] && fz < q[5]) return true; }
      }
    }
    return false;
  }
  var gShadow = [], gAo = [];
  // recalcula sombras, cantos escuros e a lista de luzes; durante uma obra, no máximo umas sete vezes por segundo
  function bake() {
    dirty = false; baked = T; lights = [];
    cols.forEach(function (c) {
      c.forEach(function (v) {
        var m = MAT[v.m];
        v.sh = m.map(function (q) {
          var x0 = v.x + q[0], x1 = v.x + q[3], y0 = v.y + q[1], y1 = v.y + q[4], z0 = v.z + q[2], z1 = v.z + q[5], cx = (x0 + x1) / 2, cy2 = (y0 + y1) / 2, mz = (z0 + z1) / 2;
          return [blocked(cx, cy2, z1 + 0.01), blocked(x1 + 0.01, cy2, mz), blocked(x0 - 0.01, cy2, mz), blocked(cx, y1 + 0.01, mz), blocked(cx, y0 - 0.01, mz)];
        });
        var ao = 0;
        if (m.full) for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) if ((dx || dy) && solid(v.x + dx, v.y + dy, v.z + 1)) ao++;
        v.ao = Math.min(0.32, ao * 0.07);
        v.li = -1;
        if (!v.gone && (m.emit || m.glass)) {
          var b0 = m[0];
          lights.push({ v: v, x: v.x + (b0[0] + b0[3]) / 2, y: v.y + (b0[1] + b0[4]) / 2, z: v.z + (b0[2] + b0[5]) / 2, lamp: m.emit });
        }
      });
    });
    lights.sort(function (a, b) { return Math.hypot(a.x - 3, a.y - 2.5) - Math.hypot(b.x - 3, b.y - 2.5); });
    lights.forEach(function (L, i) { L.v.li = i; });
    for (var x = 0; x < G; x++) for (var y = 0; y < G; y++) {
      var i = x * G + y, n = 0;
      gShadow[i] = blocked(x + 0.5, y + 0.5, 0.02);
      for (var dx2 = -1; dx2 <= 1; dx2++) for (var dy2 = -1; dy2 <= 1; dy2++) if ((dx2 || dy2) && solid(x + dx2, y + dy2, 0)) n++;
      gAo[i] = Math.min(0.3, n * 0.06);
    }
  }
  // as luzes pontuais do quadro: postes e lanternas (fortes) e janelas (fracas), só à noite
  function gatherLights() {
    points.length = 0;
    if (night < 0.02) return;
    lights.forEach(function (L, i) {
      var k = level(i) * night;
      if (k < 0.02 || !landed(L.v)) return;
      points.push(L.lamp ? { x: L.x, y: L.y, z: L.z, i: 1.7 * k, f: 0.55, r: 1, g: 0.8, b: 0.52 } : { x: L.x, y: L.y, z: L.z, i: 0.75 * k, f: 1.1, r: 1, g: 0.78, b: 0.5 });
    });
  }
  var HX = 0, HY = 0, HZ = 1;            // a direção do brilho (meio caminho entre o sol e a câmera)
  // a cor de uma face: céu + sol (com sombra) + luzes pontuais + brilho de metal ou de água
  var RGB = [0, 0, 0];
  function css(v) { return 'rgb(' + clamp(v[0], 0, 255).toFixed(0) + ',' + clamp(v[1], 0, 255).toFixed(0) + ',' + clamp(v[2], 0, 255).toFixed(0) + ')'; }
  function light3(c, nx, ny, nz, shadow, ao, px, py, pz, spec) {
    var amb = lerp(0.6, 0.25, night) * (0.8 + 0.2 * nz) * (1 - ao);
    var lam = nx * SUN[0] + ny * SUN[1] + nz * SUN[2];
    lam = lam > 0 ? lam * (shadow ? 0.12 : 1) * lerp(0.74, 0.17, night) : 0;
    var r = amb * lerp(0.94, 0.5, night) + lam * lerp(1.04, 0.75, night);
    var g = amb * lerp(0.97, 0.62, night) + lam * lerp(0.98, 0.82, night);
    var b = amb * lerp(1.05, 1.22, night) + lam * lerp(0.86, 1.08, night);
    for (var i = 0; i < points.length; i++) {
      var L = points[i], dx = L.x - px, dy = L.y - py, dz = L.z - pz, d2 = dx * dx + dy * dy + dz * dz + 0.05;
      if (d2 > 40) continue;
      var nd = (nx * dx + ny * dy + nz * dz) / Math.sqrt(d2);
      if (nd <= 0) continue;
      var k = L.i * nd / (1 + d2 * L.f);
      r += k * L.r; g += k * L.g; b += k * L.b;
    }
    var hl = 0;
    if (spec && !shadow) { var h = nx * HX + ny * HY + nz * HZ; if (h > 0) hl = Math.pow(h, 22) * spec * 255 * (1 - night * 0.7); }
    RGB[0] = c[0] * r + hl; RGB[1] = c[1] * g + hl; RGB[2] = c[2] * b + hl;
    return RGB;
  }
  function shade(c, nx, ny, nz, shadow, ao, px, py, pz, spec) { return css(light3(c, nx, ny, nz, shadow, ao, px, py, pz, spec)); }
  function tint(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  // ---------- Desenho ----------
  function quad(p, fill, line) {
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (line) { ctx.strokeStyle = line; ctx.stroke(); }
  }
  function P4(ax, ay, az, bx, by, bz, cx, cy2, cz, dx, dy, dz) {
    return [sx(ax, ay), sy(ax, ay, az), sx(bx, by), sy(bx, by, bz), sx(cx, cy2), sy(cx, cy2, cz), sx(dx, dy), sy(dx, dy, dz)];
  }
  // o céu: um estúdio escuro de dia; à noite, azul fundo com estrelas
  var stars = [];
  for (var si = 0; si < 70; si++) stars.push([Math.random(), Math.random() * 0.8, Math.random() * 1.4 + 0.4, Math.random() * 6]);
  function sky() {
    var g = ctx.createRadialGradient(W / 2, H * 0.34, 0, W / 2, H * 0.34, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgb(' + (lerp(44, 22, night) | 0) + ',' + (lerp(44, 30, night) | 0) + ',' + (lerp(44, 52, night) | 0) + ')');
    g.addColorStop(1, 'rgb(' + (lerp(19, 6, night) | 0) + ',' + (lerp(19, 8, night) | 0) + ',' + (lerp(19, 16, night) | 0) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (night > 0.05) {
      ctx.fillStyle = '#fff';
      stars.forEach(function (s) { ctx.globalAlpha = night * (0.35 + 0.35 * Math.sin(T * 0.002 + s[3])); ctx.fillRect(s[0] * W, s[1] * H * 0.7, s[2], s[2]); });
      ctx.globalAlpha = 1;
    }
  }
  // a sombra macia embaixo da baseplate, que parece flutuar
  function floorShadow() {
    var x = sx(C, C), y = sy(C, C, -2.2), r = G * 0.76 * S;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, Math.max(0.2, sp * 0.55));
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function gType(i) { if (gswitch[i] && T >= gswitch[i]) { ground[i] = gnext[i]; gswitch[i] = 0; dirty = true; } return ground[i]; }
  // a espessura da baseplate: uma placa cinza, com um fio de luz na quina de cima
  var SLAB = [76, 78, 84];
  function plinth() {
    var sides = [];
    if (sn > 0.001) sides.push([1, 0]); if (sn < -0.001) sides.push([-1, 0]);
    if (cy > 0.001) sides.push([0, 1]); if (cy < -0.001) sides.push([0, -1]);
    sides.forEach(function (sd) {
      var nx = sd[0], ny = sd[1];
      for (var k = 0; k < G; k++) {
        var x0, y0, x1, y1, ex, ey;
        if (nx) { x0 = x1 = nx > 0 ? G : 0; y0 = k; y1 = k + 1; ex = nx > 0 ? G - 1 : 0; ey = k; }
        else { y0 = y1 = ny > 0 ? G : 0; x0 = k; x1 = k + 1; ex = k; ey = ny > 0 ? G - 1 : 0; }
        var wet = ground[ex * G + ey] === 'water', mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        if (wet) quad(P4(x0, y0, WATER_Z, x1, y1, WATER_Z, x1, y1, -0.1, x0, y0, -0.1), shade([44, 98, 130], nx, ny, 0, false, 0, mx, my, -0.1), null);
        quad(P4(x0, y0, wet ? -0.1 : 0, x1, y1, wet ? -0.1 : 0, x1, y1, -0.46, x0, y0, -0.46), shade(SLAB, nx, ny, 0, false, 0, mx, my, -0.2), null);
      }
      var a = nx ? [nx > 0 ? G : 0, 0] : [0, ny > 0 ? G : 0], b = nx ? [nx > 0 ? G : 0, G] : [G, ny > 0 ? G : 0];
      ctx.beginPath(); ctx.moveTo(sx(a[0], a[1]), sy(a[0], a[1], 0)); ctx.lineTo(sx(b[0], b[1]), sy(b[0], b[1], 0));
      ctx.strokeStyle = 'rgba(255,255,255,' + lerp(0.18, 0.06, night).toFixed(3) + ')'; ctx.stroke();
    });
  }
  // o chão de cada casa: baseplate com grade, grama, terra arada com sulcos, caminho, cascalho e água que brilha e mexe
  function drawGround() {
    for (var x = 0; x < G; x++) for (var y = 0; y < G; y++) {
      var i = x * G + y, gt = gType(i), z = gt === 'water' ? WATER_Z : 0, j = gt === 'base' ? 1 : 0.96 + hash(x, y, 9) * 0.08, c = tint(GROUND[gt], j), spec = 0;
      if (gt === 'water') { var wv = reduced ? 0 : Math.sin(T * 0.0013 + x * 1.3 + y * 0.8) * 0.06 + Math.sin(T * 0.0021 - x * 0.7 + y * 1.6) * 0.04; c = tint(c, 1 + wv); spec = 0.9; }
      quad(P4(x, y, z, x + 1, y, z, x + 1, y + 1, z, x, y + 1, z), shade(c, 0, 0, 1, gShadow[i], gAo[i], x + 0.5, y + 0.5, z, spec), gt === 'base' ? 'rgba(255,255,255,0.09)' : gt === 'water' ? null : 'rgba(0,0,0,0.07)');
      if (gt === 'soil') {             // os sulcos da terra arada
        ctx.beginPath(); ctx.moveTo(sx(x, y + 0.5), sy(x, y + 0.5, 0)); ctx.lineTo(sx(x + 1, y + 0.5), sy(x + 1, y + 0.5, 0));
        ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.stroke();
      }
    }
    // barrancos: onde um chão alto encosta na água, do lado que a câmera vê
    for (x = 0; x < G; x++) for (y = 0; y < G; y++) {
      if (ground[x * G + y] === 'water') continue;
      var gc = tint(GROUND[ground[x * G + y]], 0.72);
      if (sn > 0.001 && x + 1 < G && ground[(x + 1) * G + y] === 'water') quad(P4(x + 1, y, 0, x + 1, y + 1, 0, x + 1, y + 1, WATER_Z, x + 1, y, WATER_Z), shade(gc, 1, 0, 0, false, 0, x + 1, y + 0.5, 0), null);
      if (sn < -0.001 && x > 0 && ground[(x - 1) * G + y] === 'water') quad(P4(x, y, 0, x, y + 1, 0, x, y + 1, WATER_Z, x, y, WATER_Z), shade(gc, -1, 0, 0, false, 0, x, y + 0.5, 0), null);
      if (cy > 0.001 && y + 1 < G && ground[x * G + y + 1] === 'water') quad(P4(x, y + 1, 0, x + 1, y + 1, 0, x + 1, y + 1, WATER_Z, x, y + 1, WATER_Z), shade(gc, 0, 1, 0, false, 0, x + 0.5, y + 1, 0), null);
      if (cy < -0.001 && y > 0 && ground[x * G + y - 1] === 'water') quad(P4(x, y, 0, x + 1, y, 0, x + 1, y, WATER_Z, x, y, WATER_Z), shade(gc, 0, -1, 0, false, 0, x + 0.5, y, 0), null);
    }
  }
  // quanto um bloco ainda está no ar (caindo) e o quique ao pousar
  function dropZ(v) {
    var a = T - v.t0;
    if (a < 0) return null;
    if (!v.from || reduced || a >= DROP) return 0;
    var q = a / DROP;
    if (q < 0.72) { var u = q / 0.72; return v.from * (1 - u * u); }
    if (!v.puffed) { v.puffed = true; if (v.fly) sparkle(v); else if (MAT[v.m].full) puff(v.x + 0.5, v.y + 0.5, v.z, 3); }
    var b = (q - 0.72) / 0.28;
    return 0.14 * Math.sin(b * Math.PI) * (1 - b);
  }
  function waveZ(x) { return wave > 0.001 ? 0.3 * wave * Math.sin(T * 0.005 - x * 0.9) : 0; }
  // o que se mexe sozinho (fora do modo de menos movimento): para cada caixa, quanto o pé (b) e o topo (t) se deslocam.
  // folhas balançam juntas (a fase muda devagar de uma casa para a outra, para não abrir fresta entre elas); trigo, milho,
  // junco e flores dobram com o vento (o topo anda mais que o pé), numa onda que atravessa a plantação; a vaca anda um
  // pouco, abaixa a cabeça para pastar e mexe o rabo; os patos boiam e nadam devagar; a lanterna da varanda balança
  var OFF = [0, 0, 0, 0, 0, 0];
  function motion(v, bi, q) {
    OFF[0] = OFF[1] = OFF[2] = OFF[3] = OFF[4] = OFF[5] = 0;
    if (reduced) return;
    var m = v.m, a, k;
    if (m === 'leaf' || m === 'apple' || m === 'autumn') {
      k = clamp((v.z - 1) / 3, 0.3, 1);
      a = 0.035 * k * Math.sin(T * 0.0011 + (v.x + v.y) * 0.15); OFF[0] = OFF[3] = a;
      a = 0.025 * k * Math.cos(T * 0.0009 + (v.x - v.y) * 0.15); OFF[1] = OFF[4] = a;
    } else if (m === 'wheat' || m === 'corn' || m === 'reed' || m === 'flower') {
      a = (m === 'wheat' ? 0.1 : m === 'corn' ? 0.07 : 0.08) * Math.sin(T * 0.0019 - v.x * 0.7 - v.y * 0.45);
      OFF[0] = a * q[2]; OFF[3] = a * q[5]; OFF[1] = 0.4 * a * q[2]; OFF[4] = 0.4 * a * q[5];
    } else if (m === 'cowE') {
      a = 0.12 * Math.sin(T * 0.0005 + v.k * 6); OFF[0] = OFF[3] = a;
      if (bi >= 7 && bi <= 10) { k = Math.max(0, Math.sin(T * 0.0009 + v.k * 4)); OFF[2] = OFF[5] = -0.14 * k * k * k; }
      if (bi === 11) { k = 0.05 * Math.sin(T * 0.004); OFF[4] = k; OFF[1] = k * 0.2; }
    } else if (m === 'duckE' || m === 'duckW') {
      OFF[0] = OFF[3] = 0.09 * Math.sin(T * 0.00045 + v.k * 5);
      OFF[1] = OFF[4] = 0.07 * Math.cos(T * 0.0004 + v.k * 3);
      OFF[2] = OFF[5] = 0.025 * Math.sin(T * 0.0028 + v.k * 6);
    } else if (m === 'lantern') { OFF[0] = OFF[3] = 0.035 * Math.sin(T * 0.0017); }
    else if (m === 'scarecrow') { a = 0.02 * Math.sin(T * 0.0013); OFF[3] = a; }
  }
  var glows = [];                       // janelas e lâmpadas acesas, para o halo no fim do quadro
  var order = [];                       // a ordem das caixas de um bloco (de trás para a frente)
  var WARM = [255, 206, 140];
  function face(c, nx, ny, nz, sh, ao, px, py, pz, spec, glow) {
    var v = light3(c, nx, ny, nz, sh, ao, px, py, pz, spec);
    if (glow > 0) { var k = Math.min(1, glow); v[0] = lerp(v[0], WARM[0], k); v[1] = lerp(v[1], WARM[1], k); v[2] = lerp(v[2], WARM[2], k); }   // janela acesa, lâmpada
    return css(v);
  }
  function drawVoxel(v) {
    var dz = dropZ(v);
    if (dz === null) return;
    var m = MAT[v.m], full = m.full, gone = 0;
    if (v.gone) { gone = clamp((T - v.gone) / 380, 0, 1); if (gone >= 1) return; ctx.globalAlpha = 1 - gone; }
    var water = v.z === 0 && !dz && ground[v.x * G + v.y] === 'water';
    var oz = v.z + dz + waveZ(v.x) + gone * gone * 2.5;
    var lit = v.li >= 0 && night > 0.02 ? level(v.li) * night : 0;
    var waving = wave > 0.001;
    // as caixas do modelo, das mais longe para as mais perto
    order.length = 0;
    for (var i = 0; i < m.length; i++) order.push(i);
    if (m.length > 1) order.sort(function (a, b) { var p = m[a], q = m[b]; return depth(v.x + (p[0] + p[3]) / 2, v.y + (p[1] + p[4]) / 2, (p[2] + p[5]) / 2) - depth(v.x + (q[0] + q[3]) / 2, v.y + (q[1] + q[4]) / 2, (q[2] + q[5]) / 2); });
    for (var n = 0; n < order.length; n++) {
      var bi = order[n], q2 = m[bi], sh = v.sh ? v.sh[bi] : null;
      var X0 = v.x + q2[0], X1 = v.x + q2[3], Y0 = v.y + q2[1], Y1 = v.y + q2[4], Z0 = oz + q2[2], Z1 = oz + q2[5];
      if (water) { if (q2[2] === 0) Z0 += WATER_Z; else { Z0 += WATER_Z; Z1 += WATER_Z; } }   // na água, o pé fica dentro dela e o resto boia
      motion(v, bi, q2);
      var c = q2[6], kind = q2[7];
      if (kind === 'v') c = tint(c, 0.88 + v.k * 0.24);
      else if (kind === 'f') c = FLOWERS[(v.k * FLOWERS.length) | 0];
      else c = tint(c, 0.97 + v.k * 0.06);
      var glow = kind === 'e' ? 0.18 * (1 - night) + lit : kind === 'g' ? lit * 0.92 : 0;
      var spec = kind === 's' ? 1 : kind === 'g' ? 0.5 : 0;
      var line = glow > 0.4 ? null : 'rgba(0,0,0,0.18)';
      var mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2, mz = (Z0 + Z1) / 2;
      // os oito cantos: embaixo (z0) com o deslocamento do pé, em cima (z1) com o do topo
      var bx0 = X0 + OFF[0], bx1 = X1 + OFF[0], by0 = Y0 + OFF[1], by1 = Y1 + OFF[1], bz = Z0 + OFF[2];
      var tx0 = X0 + OFF[3], tx1 = X1 + OFF[3], ty0 = Y0 + OFF[4], ty1 = Y1 + OFF[4], tz = Z1 + OFF[5];
      var a0 = sx(bx0, by0), a1 = sy(bx0, by0, bz), b0 = sx(bx1, by0), b1 = sy(bx1, by0, bz), c0 = sx(bx1, by1), c1 = sy(bx1, by1, bz), d0 = sx(bx0, by1), d1 = sy(bx0, by1, bz);
      var e0 = sx(tx0, ty0), e1 = sy(tx0, ty0, tz), f0 = sx(tx1, ty0), f1 = sy(tx1, ty0, tz), g0 = sx(tx1, ty1), g1 = sy(tx1, ty1, tz), h0 = sx(tx0, ty1), h1 = sy(tx0, ty1, tz);
      // as laterais que a câmera vê (num bloco inteiro, a face encostada em outro bloco inteiro não aparece)
      if (sn > 0.001 && !(full && !waving && solidNow(v.x + 1, v.y, v.z))) quad([b0, b1, c0, c1, g0, g1, f0, f1], face(c, 1, 0, 0, sh && sh[1], 0, X1, my, mz, spec, glow), line);
      if (sn < -0.001 && !(full && !waving && solidNow(v.x - 1, v.y, v.z))) quad([a0, a1, d0, d1, h0, h1, e0, e1], face(c, -1, 0, 0, sh && sh[2], 0, X0, my, mz, spec, glow), line);
      if (cy > 0.001 && !(full && solidNow(v.x, v.y + 1, v.z))) quad([d0, d1, c0, c1, g0, g1, h0, h1], face(c, 0, 1, 0, sh && sh[3], 0, mx, Y1, mz, spec, glow), line);
      if (cy < -0.001 && !(full && solidNow(v.x, v.y - 1, v.z))) quad([a0, a1, b0, b1, f0, f1, e0, e1], face(c, 0, -1, 0, sh && sh[4], 0, mx, Y0, mz, spec, glow), line);
      if (!(full && solidNow(v.x, v.y, v.z + 1))) quad([e0, e1, f0, f1, g0, g1, h0, h1], face(c, 0, 0, 1, sh && sh[0], full ? v.ao : 0, mx, my, Z1, spec, glow), glow > 0.4 ? null : 'rgba(255,255,255,' + lerp(0.13, 0.05, night).toFixed(3) + ')');
      // o vidro de dia: um reflexo na diagonal da face da frente
      if (kind === 'g' && night < 0.6 && cy > 0.001) {
        ctx.globalAlpha = (1 - night) * 0.35 * (1 - gone);
        ctx.beginPath(); ctx.moveTo(sx(X0, Y1), sy(X0, Y1, Z0 + 0.2)); ctx.lineTo(sx(X0, Y1), sy(X0, Y1, Z0 + 0.45)); ctx.lineTo(sx(X1, Y1), sy(X1, Y1, Z1 - 0.05)); ctx.lineTo(sx(X1, Y1), sy(X1, Y1, Z1 - 0.3)); ctx.closePath();
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = gone ? 1 - gone : 1;
      }
      if (lit > 0.03 && (kind === 'e' || kind === 'g')) glows.push({ x: mx, y: my, z: mz, r: kind === 'e' ? 1.7 : 0.9, a: lit * (kind === 'e' ? 1 : 0.6) });
    }
    ctx.globalAlpha = 1;
  }
  // os blocos, de trás para a frente: em projeção paralela, percorrer cada eixo de longe para perto desenha certo
  function drawVoxels() {
    var xs = sn > 0 ? 1 : -1, ys = cy > 0 ? 1 : -1;
    for (var a = 0; a < G; a++) {
      var x = xs > 0 ? a : G - 1 - a;
      for (var b = 0; b < G; b++) {
        var y = ys > 0 ? b : G - 1 - b, c = col(x, y);
        for (var k = 0; k < c.length; k++) drawVoxel(c[k]);
      }
    }
  }
  // as pás do moinho: quatro velas de lona num eixo de madeira, girando devagar (aparecem crescendo quando o moinho fica pronto)
  var MILL = { x: 7, y: 3.32, z: 4.5, r: 1.85 };
  function millReady() { var v = at(6, 1, 4); return world === 'farm' && millAt && T > millAt && v && !v.gone; }
  function blades() {
    var q = clamp((T - millAt) / 700, 0, 1), qe = 1 - Math.pow(1 - q, 3);
    var a0 = reduced ? 0.5 : (T - millAt) * 0.0011, r = MILL.r * (0.25 + 0.75 * qe), w = 0.44 * (0.3 + 0.7 * qe);
    var hy = MILL.y, hz = MILL.z + waveZ(MILL.x), hx = MILL.x, side = cy > 0 ? 1 : -1;
    var sail = shade([238, 230, 214], 0, side, 0, false, 0, hx, hy, hz, 0), spar = shade([106, 74, 48], 0, side, 0, false, 0, hx, hy, hz, 0);
    for (var k = 0; k < 4; k++) {
      var a = a0 + k * Math.PI / 2, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
      var x0 = hx + dx * 0.32, z0 = hz + dz * 0.32, x1 = hx + dx * r, z1 = hz + dz * r;
      ctx.beginPath(); ctx.moveTo(sx(x0, hy), sy(x0, hy, z0)); ctx.lineTo(sx(x1, hy), sy(x1, hy, z1));
      ctx.lineTo(sx(x1 + px * w, hy), sy(x1 + px * w, hy, z1 + pz * w)); ctx.lineTo(sx(x0 + px * w * 0.7, hy), sy(x0 + px * w * 0.7, hy, z0 + pz * w * 0.7)); ctx.closePath();
      ctx.fillStyle = sail; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
      ctx.strokeStyle = 'rgba(90,64,40,0.4)';
      for (var g = 1; g <= 3; g++) { var t2 = 0.32 + (r - 0.32) * g / 4, gx = hx + dx * t2, gz = hz + dz * t2; ctx.beginPath(); ctx.moveTo(sx(gx, hy), sy(gx, hy, gz)); ctx.lineTo(sx(gx + px * w, hy), sy(gx + px * w, hy, gz + pz * w)); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(sx(hx, hy), sy(hx, hy, hz)); ctx.lineTo(sx(x1, hy), sy(x1, hy, z1)); ctx.strokeStyle = spar; ctx.lineWidth = Math.max(1.5, S * 0.07); ctx.stroke(); ctx.lineWidth = 1;
    }
    ctx.beginPath(); ctx.arc(sx(hx, hy), sy(hx, hy, hz), Math.max(2, S * 0.11), 0, Math.PI * 2); ctx.fillStyle = spar; ctx.fill();
  }
  function halos() {
    if (!glows.length) return;
    ctx.globalCompositeOperation = 'lighter';
    glows.forEach(function (g) {
      var x = sx(g.x, g.y), y = sy(g.x, g.y, g.z), r = S * g.r, gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,196,120,' + (0.42 * g.a).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    ctx.globalCompositeOperation = 'source-over';
    glows.length = 0;
  }
  // o contorno da próxima obra no chão, embaixo do cursor, antes do clique
  function footprint(a) {
    var p = P4(a[0], a[1], 0.02, a[2], a[1], 0.02, a[2], a[3], 0.02, a[0], a[3], 0.02);
    ctx.save();
    ctx.globalAlpha = 0.1; quad(p, '#fff', null);
    ctx.globalAlpha = 0.45 + 0.3 * Math.sin(T * 0.006); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]); ctx.closePath(); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }

  // ---------- Partículas: poeira, faíscas, confete e vaga-lumes ----------
  var parts = [], floats = [], flies = [];
  function puff(x, y, z, n) {
    if (reduced) return;
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 0.9; parts.push({ x: x, y: y, z: z + 0.05, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 0.4 + Math.random() * 0.6, life: 0, end: 0.5 + Math.random() * 0.3, k: 'dust', c: [220, 214, 204], g: -1.2 }); }
    wake();
  }
  function burst(x, y, z, n, colors, speed, kind, end) {
    if (reduced && kind !== 'confetti') return;
    for (var i = 0; i < n; i++) {
      var u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = speed * (0.55 + Math.random() * 0.6);
      parts.push({ x: x, y: y, z: z, vx: r * Math.cos(a) * s, vy: r * Math.sin(a) * s, vz: u * s + speed * 0.25, life: 0, end: (end || 1.1) * (0.7 + Math.random() * 0.6), k: kind || 'spark', c: colors[i % colors.length], g: kind === 'confetti' ? -3.2 : -2.4 });
    }
    wake();
  }
  // a fumacinha da chaminé (só na fazenda, com a chaminé no lugar)
  var smokeAt = 0;
  function smoke() {
    if (reduced || world !== 'farm' || T < smokeAt) return;
    var v = at(1, 1, 4);
    if (!v || v.gone || !landed(v)) return;
    smokeAt = T + 320 + Math.random() * 200;
    parts.push({ x: 1.5 + (Math.random() - 0.5) * 0.2, y: 1.5 + (Math.random() - 0.5) * 0.2, z: 5.05, vx: 0.18, vy: -0.05, vz: 0.5, life: 0, end: 2.6, k: 'smoke', c: [210, 210, 214], g: 0.04 });
  }
  function sparkle(v) { burst(v.x + 0.5, v.y + 0.5, v.z + 0.5, 7, [[255, 226, 160], [255, 255, 255]], 1.6, 'spark', 0.5); }
  function stepParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.life += dt;
      if (p.life >= p.end) { parts.splice(i, 1); continue; }
      var drag2 = p.k === 'spark' ? 0.985 : p.k === 'confetti' ? 0.97 : p.k === 'smoke' ? 1 : 0.93;
      p.vx *= drag2; p.vy *= drag2; p.vz = p.vz * drag2 + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z < 0 && p.k !== 'spark') { p.z = 0; p.vz *= -0.3; }
    }
    for (i = floats.length - 1; i >= 0; i--) { floats[i].life += dt; if (floats[i].life >= floats[i].end) floats.splice(i, 1); }
  }
  function drawParts() {
    if (!parts.length && !floats.length && !(flies.length && night > 0.05)) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    parts.forEach(function (p) {
      var q = p.life / p.end, x = sx(p.x, p.y), y = sy(p.x, p.y, p.z), a = 1 - q;
      if (p.k === 'smoke') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(' + p.c.join(',') + ',' + (0.32 * Math.sin(Math.PI * Math.min(1, q * 1.4)) * (1 - q)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y, S * (0.07 + q * 0.2), 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; return; }
      if (p.k === 'dust') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(' + p.c.join(',') + ',' + (0.45 * a).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y, S * 0.07 * (1 + q * 1.5), 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; return; }
      if (p.k === 'confetti') { ctx.fillStyle = 'rgba(' + p.c.join(',') + ',' + a.toFixed(3) + ')'; ctx.fillRect(x - 2, y - 1.5, 4, 3); return; }
      var x2 = sx(p.px, p.py), y2 = sy(p.px, p.py, p.pz);
      ctx.strokeStyle = 'rgba(' + p.c.join(',') + ',' + a.toFixed(3) + ')'; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(x2 + (x2 - x) * 2.2, y2 + (y2 - y) * 2.2); ctx.lineTo(x, y); ctx.stroke();
    });
    // vaga-lumes (Iluminar, à noite)
    if (night > 0.05) flies.forEach(function (f) {
      var x = sx(f.x, f.y), y = sy(f.x, f.y, f.z), a = night * (0.45 + 0.55 * Math.sin(T * 0.004 + f.ph)), g = ctx.createRadialGradient(x, y, 0, x, y, S * 0.32);
      g.addColorStop(0, 'rgba(255,236,150,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - S * 0.32, y - S * 0.32, S * 0.64, S * 0.64);
    });
    ctx.globalCompositeOperation = 'source-over';
    // os nomes das obras, os "+1" e o "Subiu de nível!"
    floats.forEach(function (f) {
      var q = f.life / f.end, x = sx(f.x, f.y), y = sy(f.x, f.y, f.z) - 18 - q * 34;
      ctx.font = '700 ' + (f.big ? 17 : 15) + 'px Archivo, "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,224,150,' + (1 - q * q).toFixed(3) + ')';
      ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.fillText(f.text, x, y); ctx.shadowBlur = 0;
    });
  }
  function moveFlies() {
    if (!flies.length) for (var i = 0; i < 14; i++) flies.push({ cx: 1 + Math.random() * (G - 2), cy: 1 + Math.random() * (G - 2), r: 0.4 + Math.random() * 0.9, ph: Math.random() * 6, sp: 0.3 + Math.random() * 0.5, x: 0, y: 0, z: 0 });
    flies.forEach(function (f) { var a = T * 0.001 * f.sp + f.ph; f.x = f.cx + Math.cos(a) * f.r; f.y = f.cy + Math.sin(a * 1.3) * f.r; f.z = 1.2 + 0.6 * Math.sin(a * 0.7); });
  }

  // ---------- Ferramenta: Programar (a onda) ----------
  // Luau de verdade: a cada quadro, cada bloco sobe e desce numa onda que anda ao longo do eixo X (como a da cena)
  var CODE = [
    [['k', 'local'], ['', ' RunService = game:GetService('], ['s', '"RunService"'], ['', ')']],
    [['k', 'local'], ['', ' parts = workspace.Fazenda:GetChildren()']],
    [],
    [['', 'RunService.Heartbeat:Connect('], ['k', 'function'], ['', '()']],
    [['  '], ['k', 'local'], ['', ' t = os.clock()']],
    [['  '], ['k', 'for'], ['', ' _, part '], ['k', 'in'], ['', ' parts '], ['k', 'do']],
    [['    '], ['k', 'local'], ['', ' base = part:GetAttribute('], ['s', '"Base"'], ['', ')']],
    [['    '], ['k', 'local'], ['', ' y = math.sin(t * '], ['n', '3'], ['', ' - part.Position.X)']],
    [['    '], ['', 'part.CFrame = base + Vector3.new('], ['n', '0'], ['', ', y, '], ['n', '0'], ['', ')']],
    [['  '], ['k', 'end']],
    [['k', 'end'], ['', ')']]
  ];
  var CODE_LEN = CODE.reduce(function (n, l) { return n + l.reduce(function (m, tk) { return m + (tk[1] !== undefined ? tk[1] : tk[0]).length; }, 0) + 1; }, 0);
  var typed = 0, runLine = 4, codeTimer = 0, lineTimer = 0;
  function renderCode(upTo) {
    codeEl.textContent = '';
    var left = upTo, cur = 0;
    CODE.forEach(function (line, n) {
      var ln = document.createElement('span');
      ln.className = 'ln' + (wave > 0.5 && n === runLine ? ' is-run' : '');
      line.forEach(function (tk) {
        if (left <= 0) return;
        var text = tk[1] !== undefined ? tk[1] : tk[0], cls = tk[1] !== undefined ? tk[0] : '';
        var part = text.slice(0, left); left -= part.length;
        if (cls) { var s = document.createElement('span'); s.className = cls; s.textContent = part; ln.appendChild(s); }
        else ln.appendChild(document.createTextNode(part));
      });
      if (left > 0) { left--; cur = n + 1; }
      ln.appendChild(document.createTextNode('\n'));
      codeEl.appendChild(ln);
    });
    // no celular o painel mostra poucas linhas: ele acompanha a linha da vez
    var focusLine = wave > 0.5 ? runLine : Math.min(cur, CODE.length - 1), el = codeEl.children[focusLine];
    if (el && codeEl.scrollHeight > codeEl.clientHeight + 2) codeEl.scrollTop = Math.max(0, el.offsetTop - codeEl.clientHeight / 2);
  }
  function startScript() {
    clearTimeout(codeTimer); clearInterval(lineTimer);
    typed = reduced ? CODE_LEN : 0; waveGoal = 0;
    (function type() {
      typed = Math.min(CODE_LEN, typed + 3);
      renderCode(typed);
      if (typed < CODE_LEN) codeTimer = setTimeout(type, 22);
      else {
        waveGoal = reduced ? 0 : 1;
        lineTimer = setInterval(function () { runLine = runLine >= 8 ? 4 : runLine + 1; renderCode(CODE_LEN); }, 520);
      }
    })();
  }
  function stopScript() { clearTimeout(codeTimer); clearInterval(lineTimer); waveGoal = 0; }

  // ---------- Ferramenta: Interface (as moedas) ----------
  var coins = [], score = 0, levelN = 1, coinTimers = [];
  function coinAt(x, y) { for (var i = 0; i < coins.length; i++) if (coins[i].x === x && coins[i].y === y) return i; return -1; }
  function spawnCoin() {
    for (var tries = 0; tries < 60; tries++) {
      var x = (Math.random() * G) | 0, y = (Math.random() * G) | 0;
      if (coinAt(x, y) < 0 && top(x, y) < MAXH - 1) { coins.push({ x: x, y: y, t0: now() }); return true; }
    }
    return false;
  }
  function fillCoins() { for (var n = 0; n < 3 && coins.length < 3; n++) if (!spawnCoin()) break; wake(); }
  function updateHud() { coinsEl.textContent = String(score); levelEl.textContent = String(levelN); lifeEl.style.width = (20 + (score % 5) * 20) + '%'; }
  function coinPos(c) { var z = top(c.x, c.y) + 0.8 + (reduced ? 0 : 0.12 * Math.sin(T * 0.004 + c.x * 1.7)); return [sx(c.x + 0.5, c.y + 0.5), sy(c.x + 0.5, c.y + 0.5, z), z]; }
  // a moeda sob o ponto da tela (a moeda flutua: procurar pela casa do chão erraria a mira)
  function coinHit(px, py) {
    var best = -1, bd = Math.max(16, S * 0.5);
    coins.forEach(function (c, i) { var p = coinPos(c), d = Math.hypot(px - p[0], py - p[1]); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function collect(i) {
    var c = coins.splice(i, 1)[0], z = top(c.x, c.y) + 0.8;
    score++;
    burst(c.x + 0.5, c.y + 0.5, z, 18, [[255, 204, 96], [255, 240, 190]], 2, 'spark', 0.7);
    floats.push({ text: '+1', x: c.x + 0.5, y: c.y + 0.5, z: z, life: 0, end: 0.9 });
    if (score % 5 === 0) {
      levelN++;
      floats.push({ text: pt() ? 'Subiu de nível!' : 'Level up!', x: c.x + 0.5, y: c.y + 0.5, z: z + 1.3, life: 0, end: 1.4, big: true });
      burst(c.x + 0.5, c.y + 0.5, z + 0.5, 46, [[240, 178, 74], [255, 255, 255], [120, 200, 255], [255, 120, 150], [140, 220, 140]], 3, 'confetti', 1.6);
    }
    updateHud();
    coinTimers.push(setTimeout(function () { if (tool === 'ui' && coins.length < 3) { spawnCoin(); wake(); } }, 450));
    wake();
  }
  function drawCoins() {
    coins.forEach(function (c) {
      var p = coinPos(c), r = S * 0.32, w = Math.max(0.14, Math.abs(Math.cos(T * 0.004 + c.y))), a = clamp((T - c.t0) / 300, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(240,178,74,0.9)'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(p[0], p[1], r * w, r, 0, 0, Math.PI * 2); ctx.fillStyle = '#f0b24a'; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.ellipse(p[0], p[1], r * w * 0.62, r * 0.62, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,240,200,0.85)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(sx(c.x + 0.5, c.y + 0.5), sy(c.x + 0.5, c.y + 0.5, top(c.x, c.y)), r * 0.8, r * 0.8 * sp, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }
  function clearCoinTimers() { coinTimers.forEach(clearTimeout); coinTimers = []; }

  // ---------- Ferramenta: IA (as cenas) ----------
  // as cenas foram desenhadas numa área de 10 x 10: elas ficam no meio da baseplate (o resto continua baseplate)
  function centered(fn) { return function (x, y) { return x >= 1 && y >= 1 && x <= 10 && y <= 10 ? fn(x - 1, y - 1) : 'base'; }; }
  var SCENES = [
    { en: 'Build a tower with a spiral staircase.', pt: 'Construa uma torre com escada em espiral.', ground: function (x, y) { return x >= 2 && x <= 7 && y >= 2 && y <= 7 ? 'plaza' : 'grass'; }, make: function () {
      var out = [], ring = [[3, 3], [4, 3], [5, 3], [6, 3], [6, 4], [6, 5], [6, 6], [5, 6], [4, 6], [3, 6], [3, 5], [3, 4]];
      for (var z = 0; z < 7; z++) {
        [[4, 4], [5, 4], [4, 5], [5, 5]].forEach(function (p, i) { out.push([p[0], p[1], z, z === 6 ? 'gold' : z % 2 && i === 3 ? 'glass' : 'pearl']); });
        ring.forEach(function (p, i) { if (Math.floor(i / 2) === z) out.push([p[0], p[1], z, 'stone']); else if (Math.floor(i / 2) > z && z === 0) out.push([p[0], p[1], 0, 'slate']); });
      }
      out.push([4, 4, 7, 'gold']);
      [[2, 2], [7, 2], [2, 7], [7, 7]].forEach(function (p) { out.push([p[0], p[1], 0, 'pole'], [p[0], p[1], 1, 'lamp']); });
      [[1, 3], [8, 6], [1, 6], [8, 3]].forEach(function (p) { out.push([p[0], p[1], 0, 'flower']); });
      return out;
    } },
    { en: 'Build a castle with a moat and four towers.', pt: 'Construa um castelo com fosso e quatro torres.', ground: function (x, y) { return x === 0 || y === 0 || x === 9 || y === 9 ? 'water' : 'grass'; }, make: function () {
      var out = [];
      for (var z = 0; z < 5; z++) for (var x = 1; x <= 8; x++) for (var y = 1; y <= 8; y++) {
        var edge = x === 1 || x === 8 || y === 1 || y === 8, corner2 = (x === 1 || x === 8) && (y === 1 || y === 8), gate = y === 8 && (x === 4 || x === 5);
        if (corner2 && z <= 3) out.push([x, y, z, z === 3 ? 'gold' : 'stone']);
        else if (edge && !corner2 && z <= 1 && !(gate && z === 0)) out.push([x, y, z, z === 1 && (x + y) % 2 ? 'slate' : 'stone']);
        else if (x >= 4 && x <= 5 && y >= 4 && y <= 5 && z <= 3) out.push([x, y, z, z === 3 ? 'gold' : z === 2 && x === 5 ? 'glass' : 'pearl']);
      }
      out.push([4, 9, 0, 'plank'], [5, 9, 0, 'plank']);
      [[1, 1], [8, 1], [1, 8], [8, 8]].forEach(function (p) { out.push([p[0], p[1], 4, 'pole']); });
      return out;
    } },
    { en: 'Build a bridge over a river, with lamps.', pt: 'Construa uma ponte sobre um rio, com postes de luz.', ground: function (x, y) { return y >= 4 && y <= 5 ? 'water' : (y === 3 || y === 6) ? 'sand' : x === 4 || x === 5 ? 'path' : 'grass'; }, make: function () {
      var out = [];
      [[4, 4], [5, 4], [4, 5], [5, 5]].forEach(function (p) { out.push([p[0], p[1], 0, 'stone']); });
      for (var y = 2; y <= 7; y++) [4, 5].forEach(function (x) { out.push([x, y, y >= 3 && y <= 6 ? 1 : 0, y >= 3 && y <= 6 ? 'plank' : 'stone']); });
      [[3, 3], [6, 3], [3, 6], [6, 6]].forEach(function (p) { out.push([p[0], p[1], 0, 'stone'], [p[0], p[1], 1, 'pole'], [p[0], p[1], 2, 'lamp']); });
      [[1, 1], [8, 8], [8, 1]].forEach(function (p) { out.push([p[0], p[1], 0, 'trunk'], [p[0], p[1], 1, 'leaf'], [p[0], p[1], 2, 'leaf']); });
      [[2, 8], [7, 1], [1, 7]].forEach(function (p) { out.push([p[0], p[1], 0, 'flower']); });
      return out;
    } },
    { en: 'Build a stepped pyramid in the desert.', pt: 'Construa uma pirâmide em degraus no deserto.', ground: function (x, y) { return (x === 9 && y >= 6) || (y === 9 && x >= 7) ? 'water' : 'sand'; }, make: function () {
      var out = [];
      for (var z = 0; z < 4; z++) for (var x = 1 + z; x <= 7 - z; x++) for (var y = 1 + z; y <= 7 - z; y++) out.push([x, y, z, z === 3 ? 'gold' : z % 2 ? 'stone' : 'pearl']);
      out.push([4, 4, 4, 'gold']);
      [[8, 8], [8, 2]].forEach(function (p) { out.push([p[0], p[1], 0, 'trunk'], [p[0], p[1], 1, 'trunk'], [p[0], p[1], 2, 'leaf']); });
      out.push([1, 9, 0, 'rock'], [9, 2, 0, 'rock']);
      return out;
    } },
    { en: 'Plant a big autumn tree with a bench.', pt: 'Plante uma árvore de outono com um banco.', ground: function (x, y) { return (x + y) % 7 === 0 && x > 6 ? 'path' : 'grass'; }, make: function () {
      var out = [];
      for (var z = 0; z < 3; z++) out.push([4, 4, z, 'wood']);
      out.push([5, 4, 2, 'wood'], [3, 5, 2, 'wood']);
      for (var x = 1; x <= 7; x++) for (var y = 1; y <= 7; y++) for (z = 3; z <= 6; z++) {
        var d = Math.hypot(x - 4, y - 4.3) + Math.abs(z - 4.4) * 1.25;
        if (d <= 3.1 && hash(x, y, z) > 0.12) out.push([x, y, z, 'autumn']);
      }
      out.push([6, 7, 0, 'plank'], [7, 7, 0, 'plank']);
      [[2, 7], [7, 2], [1, 2], [8, 5], [3, 8]].forEach(function (p) { out.push([p[0], p[1], 0, 'flower']); });
      return out;
    } }
  ];
  var scene = -1, aiTimers = [], aiBusy = false;
  function askText() { var sc = SCENES[Math.max(0, scene)]; return pt() ? sc.pt : sc.en; }
  function stopAi() { aiTimers.forEach(clearTimeout); aiTimers = []; aiBusy = false; }
  function ask() {
    stopAi();
    aiBusy = true;
    scene = (scene + 1) % SCENES.length;
    var i = 0, sc = SCENES[scene];
    againBtn.hidden = true;
    askEl.className = 'studio__ask is-typing'; askEl.textContent = '';
    (function type() {
      var text = askText();
      i = Math.min(text.length, i + 1);
      askEl.textContent = text.slice(0, i);
      if (i < text.length) aiTimers.push(setTimeout(type, reduced ? 0 : 24));
      else { askEl.className = 'studio__ask is-working'; aiTimers.push(setTimeout(go, 220)); }
    })();
    function go() {
      // o que estava na cena sobe e some; o chão muda numa onda que sai do meio; os blocos novos descem do céu
      built.forEach(clearTimeout); built = [];
      clearScene();
      world = 'ai'; updateNext();
      aiTimers.push(setTimeout(function () { emptyWorld(); wake(); }, reduced ? 0 : 400));
      setGround(centered(sc.ground), true);
      aiTimers.push(setTimeout(function () {
        var list = sc.make().map(function (p) { return [p[0] + 1, p[1] + 1, p[2], p[3]]; });
        var dur = build(list, 34, 5, true);
        aiTimers.push(setTimeout(function () { askEl.className = 'studio__ask is-done'; againBtn.hidden = false; aiBusy = false; }, dur));
      }, reduced ? 0 : 520));
    }
  }
  // o feixe de luz da "IA" até os blocos que estão descendo
  function beams() {
    var any = false;
    cols.forEach(function (c) { c.forEach(function (v) {
      if (!v.fly || reduced) return;
      var a = T - v.t0;
      if (a < 0 || a > DROP * 0.72) return;
      if (!any) { any = true; ctx.globalCompositeOperation = 'lighter'; }
      var dz = dropZ(v), x = sx(v.x + 0.5, v.y + 0.5), y = sy(v.x + 0.5, v.y + 0.5, v.z + 0.5 + (dz || 0)), q = a / (DROP * 0.72);
      var g = ctx.createLinearGradient(x, 0, x, y);
      g.addColorStop(0, 'rgba(240,178,74,0)'); g.addColorStop(1, 'rgba(255,214,140,' + (0.45 * (1 - q)).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(x - 1, 0, 2, y);
    }); });
    if (any) ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Ferramentas ----------
  var tool = 'build';
  function setTool(name, announce) {
    if (name === tool && !announce) return;
    var was = tool;
    tool = name;
    box.setAttribute('data-tool', name);
    toolBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === name)); });
    // o texto da área: o leitor de tela só anuncia quando a ferramenta foi escolhida (não ao trocar o idioma)
    if (announce) { infoBox.setAttribute('aria-live', 'polite'); setTimeout(function () { infoBox.setAttribute('aria-live', 'off'); }, 1200); }
    infos.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('data-tool') === name); });
    promptBox.inert = name !== 'ai';
    if (was === 'script' && name !== 'script') stopScript();
    if (was === 'ui' && name !== 'ui') clearCoinTimers();
    if (was === 'ai' && name !== 'ai') { stopAi(); againBtn.hidden = true; if (askEl.className.indexOf('is-done') < 0) { askEl.className = 'studio__ask is-done'; askEl.textContent = askText(); } }
    if (was === 'light' && name !== 'light') { lightsOn = false; lightsT = now(); }
    nightGoal = name === 'light' ? 1 : 0;
    // as ferramentas que mostram algo em cima da fazenda: com a baseplate vazia, a fazenda inteira sobe antes
    if (name === 'light' || name === 'script' || name === 'ui') buildAll();
    if (name === 'light' && (was !== 'light' || !lightsOn)) { lightsOn = true; lightsT = now() + (reduced ? 0 : 300); }
    if (name === 'script') startScript();
    if (name === 'ui') { fillCoins(); updateHud(); }
    if (name === 'ai') ask();
    wake();
  }
  toolBtns.forEach(function (b) { b.addEventListener('click', function () { setTool(b.getAttribute('data-tool'), true); }); });
  againBtn.addEventListener('click', function () { if (tool === 'ai') ask(); });
  resetBtn.addEventListener('click', function () {
    stopAi(); clearCoinTimers(); built.forEach(clearTimeout); built = [];
    coins = []; parts = []; floats = [];
    world = 'farm'; farmStep = 0; millAt = 0;
    baseplate();
    if (tool === 'light' || tool === 'script' || tool === 'ui') buildAll();
    if (tool === 'light') { lightsOn = true; lightsT = now() + 300; }
    if (tool === 'ui') fillCoins();
    if (tool === 'ai') { askEl.className = 'studio__ask is-done'; askEl.textContent = askText(); againBtn.hidden = false; }
    updateNext();
    wake();
  });

  // ---------- Mouse, toque e teclado ----------
  var hover = null, drag = null, kb = null;
  function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function nudge() { idleAt = T + 3500; }       // o giro sozinho espera um pouco depois de o visitante mexer
  function act(px, py) {
    if (tool === 'build') { buildNext(); return; }
    if (tool === 'light') { lightsOn = !lightsOn; lightsT = now(); wake(); return; }     // o interruptor
    if (tool === 'ui') { var k = coinHit(px, py); if (k >= 0) collect(k); }
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, yaw0: yaw, pitch0: pitch, moved: false, touch: e.pointerType !== 'mouse' };
    if (e.pointerType === 'mouse') { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { hover = local(e); kb = null; }
    if (drag && drag.id === e.pointerId) {
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; if (hint) hint.classList.add('is-gone'); }
      if (drag.moved) {
        yawGoal = null; camAnim = null;
        yaw = drag.yaw0 - dx * 0.0085;
        if (!drag.touch) pitch = clamp(drag.pitch0 + dy * 0.004, PMIN, PMAX);
        nudge();
      }
    }
    wake();
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (d.moved) return;
    var p = local(e);
    act(p.x, p.y);
    nudge();
  });
  // no toque, quando o navegador assume o gesto para rolar a página, nada acontece na cena
  canvas.addEventListener('pointercancel', function () { drag = null; });
  canvas.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = null; wake(); } });
  // o marcador do teclado só aparece quando o foco veio do teclado (e só onde ele serve: pegar moedas)
  canvas.addEventListener('focus', function () { if (!kb && canvas.matches(':focus-visible')) kb = { x: 6, y: 6 }; wake(); });
  canvas.addEventListener('blur', function () { kb = null; wake(); });
  canvas.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'q' || k === 'Q' || k === 'e' || k === 'E') { yawGoal = (yawGoal === null ? yaw : yawGoal) + (k.toLowerCase() === 'q' ? -1 : 1) * Math.PI / 4; camAnim = null; nudge(); e.preventDefault(); wake(); return; }
    var dirs = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (dirs[k]) {
      e.preventDefault();
      if (!kb) kb = { x: 6, y: 6 };
      // as setas andam como a tela mostra: "direita" é a direita da tela, seja qual for o giro
      var d = dirs[k], wx = d[0] * cy + d[1] * sn, wy = -d[0] * sn + d[1] * cy;
      if (Math.abs(wx) >= Math.abs(wy)) kb.x = clamp(kb.x + (wx > 0 ? 1 : -1), 0, G - 1); else kb.y = clamp(kb.y + (wy > 0 ? 1 : -1), 0, G - 1);
      wake(); return;
    }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (tool === 'ui') { if (kb) { var ci = coinAt(kb.x, kb.y); if (ci >= 0) collect(ci); } }
      else if (tool === 'build' || tool === 'light') act(0, 0);
      wake();
    }
  });
  // o quadradinho do teclado (Interface): a casa marcada, no topo da pilha
  function marker(t) {
    var z = top(t.x, t.y);
    ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(T * 0.006);
    quad(P4(t.x, t.y, z + 0.02, t.x + 1, t.y, z + 0.02, t.x + 1, t.y + 1, z + 0.02, t.x, t.y + 1, z + 0.02), 'rgba(255,255,255,0.12)', '#fff');
    ctx.restore();
  }

  // ---------- O laço ----------
  var visible = false, raf = 0, last = 0, started = false;
  function wake() { if (visible && !raf) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0;
    var dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t; T = now();
    // a câmera: a entrada de cinema, Q/E até o ângulo pedido, ou o giro sozinho quando ninguém mexe
    if (camAnim) {
      var cq = clamp((T - camAnim.t0) / camAnim.dur, 0, 1), ce = 1 - Math.pow(1 - cq, 3);
      yaw = lerp(camAnim.y0, camAnim.y1, ce); pitch = lerp(camAnim.p0, camAnim.p1, ce);
      if (cq >= 1) camAnim = null;
    } else if (yawGoal !== null) { yaw += (yawGoal - yaw) * (1 - Math.exp(-dt * 8)); if (Math.abs(yawGoal - yaw) < 0.002) { yaw = yawGoal; yawGoal = null; } }
    else if (spin && !drag && T > idleAt) yaw += spin * dt;
    night += (nightGoal - night) * (1 - Math.exp(-dt * 3.2)); if (Math.abs(nightGoal - night) < 0.002) night = nightGoal;
    wave += (waveGoal - wave) * (1 - Math.exp(-dt * 2.5)); if (Math.abs(waveGoal - wave) < 0.002) wave = waveGoal;
    if (dirty && T - baked > 140) bake();
    camera();
    var hx = SUN[0] + sn * cp, hy = SUN[1] + cy * cp, hz = SUN[2] + sp, hl = Math.hypot(hx, hy, hz); HX = hx / hl; HY = hy / hl; HZ = hz / hl;
    gatherLights();
    smoke();
    stepParts(dt);
    if (tool === 'light' && !reduced) moveFlies();
    // desenha
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1; ctx.lineJoin = 'round';
    sky();
    floorShadow();
    plinth();
    drawGround();
    if (tool === 'build' && hover && !drag && world === 'farm' && farmStep < FARM.length) footprint(FARM[farmStep].area);
    // as pás do moinho vão antes ou depois dos blocos, conforme estejam na frente ou atrás da torre
    var mill = millReady(), millFront = mill && depth(MILL.x, MILL.y, MILL.z) > depth(7, 2, 2.5);
    if (mill && !millFront) blades();
    drawVoxels();
    if (mill && millFront) blades();
    halos();
    beams();
    drawParts();
    if (tool === 'ui') { drawCoins(); if (kb) marker(kb); }
    // continua enquanto a cena gira ou algo se mexe
    var busy = (spin && !drag) || camAnim || (!reduced && count() > 4) || parts.length || floats.length || night !== nightGoal || wave !== waveGoal || wave > 0 || tool === 'light' || tool === 'ui' || hover || yawGoal !== null || mill || dirty;
    if (!busy) cols.forEach(function (c) { c.forEach(function (v) { if (T < v.t0 + DROP + 50 || v.gone) busy = true; }); });
    if (!busy) for (var i = 0; i < G * G; i++) if (gswitch[i]) { busy = true; break; }
    if (busy) wake(); else last = 0;
  }
  // só desenha com o estúdio na tela e a aba aberta
  function setVisible(v) {
    visible = v && !document.hidden;
    if (visible && !started) {
      started = true;
      if (!reduced) camAnim = { t0: now(), dur: 2600, y0: yaw - 1.1, y1: yaw, p0: 0.95, p1: pitch };
      showHint();
    }
    if (visible) wake();
  }
  function showHint() { if (!hint) return; hint.classList.remove('is-gone'); setTimeout(function () { hint.classList.add('is-gone'); }, 6000); }
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { setVisible(es[es.length - 1].isIntersecting); }, { rootMargin: '120px 0px' }).observe(box);
  else setVisible(true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) visible = false; else { var r = box.getBoundingClientRect(); if (r.top < window.innerHeight && r.bottom > 0) setVisible(true); } });
  if (window.ResizeObserver) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);
  document.addEventListener('langchange', function () {
    if (tool === 'ai' && scene >= 0 && askEl.className.indexOf('is-typing') < 0) askEl.textContent = askText();
    updateNext();
    wake();
  });
  // para os testes automáticos (só com ?studio-debug no endereço): onde fica cada ponto da cena na tela
  if (/[?&]studio-debug\b/.test(location.search)) window.HRStudio = {
    project: function (x, y, z) { camera(); return [sx(x, y), sy(x, y, z)]; }, count: count, top: top,
    coins: function () { return coins.map(function (c) { var p = coinPos(c); return [p[0], p[1]]; }); },
    state: function () { return { yaw: yaw, pitch: pitch, night: night, wave: wave, tool: tool, score: score, level: levelN, kb: kb, scene: scene, aiBusy: aiBusy, coins: coins.length, farmStep: farmStep, world: world, lights: lights.length, lightsOn: lightsOn, lit: lights.map(function (L, i) { return +level(i).toFixed(2); }) }; },
    freeze: function () { spin = 0; camAnim = null; }
  };
  size();
  baseplate();
  updateHud();
  updateNext();
  promptBox.inert = true;
  box.setAttribute('data-tool', tool);
})();
