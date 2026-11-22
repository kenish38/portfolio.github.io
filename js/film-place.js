// ===== O lugar que o filme constrói =====
// Um lugar pequeno, do tamanho de uma baseplate (10 x 10), montado na mesma ordem de um trabalho de verdade:
//   base    a baseplate vazia
//   plan    a planta: a rua, a praça e o contorno de cada construção riscados no chão
//   grey    os volumes sobem dos contornos (o "greybox")
//   built   o detalhe: janelas, portas, toldos, árvores, postes, bancos
//   dusk    a luz: um sol baixo, sombras longas, janelas e postes acesos
//   night   os sistemas: o lugar à noite, com os pulsos de dados correndo dos objetos até o servidor
//   calm    a mesma noite, sem os pulsos (a cena da interface, que é desenhada em HTML por cima)
//   tower   a torre do relógio montada peça por peça no terreno vazio (a cena das ferramentas de IA)
//   dawn    o lugar pronto, com o sol nascendo do outro lado
// Cada ponto tem um lugar fixo no "modelo" (chão, paredes, arestas, objetos, torre, pulsos). As cenas só dizem onde
// cada um está e de que cor: de uma cena para outra, cada ponto vai direto para o lugar dele, sem revoada.
// Os volumes escondem o que está atrás por causa dos sólidos invisíveis do motor (ver "Sólidos" em js/matter.js).
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  var N = E.N, clamp = E.clamp, PI = Math.PI;
  function frac(v) { return v - Math.floor(v); }
  function hash3(a, b, c) { return frac(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453); }
  function unit(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

  // ---------- O projeto ----------
  // x cresce para o leste e z para o sul. A câmera fica sempre do lado sul, por isso as faces norte da fileira
  // de trás nem são geradas (faces: 0 sul, 1 leste, 2 oeste, 3 norte).
  var BUILD = [
    { name: 'shop', x0: -4.4, x1: -2.4, z0: -4.0, z1: -1.9, h: 1.5 },
    { name: 'flats', x0: -2.1, x1: -0.5, z0: -4.3, z1: -2.0, h: 2.7 },
    { name: 'hall', x0: -0.2, x1: 1.5, z0: -4.5, z1: -2.2, h: 3.9, top: { x0: 0.1, x1: 1.2, z0: -4.2, z1: -2.5, h: 4.5 } },
    { name: 'depot', x0: 1.9, x1: 4.4, z0: -4.2, z1: -2.0, h: 2.0 },
    { name: 'cafe', x0: -4.4, x1: -2.8, z0: 1.9, z1: 4.0, h: 1.4, north: true },
    { name: 'kiosk', x0: 1.6, x1: 2.3, z0: 3.25, z1: 3.95, h: 0.8, north: true }
  ];
  var STREET = [-1.4, 0], CROSS = [0.3, 1.1], PLAZA = [-2.3, 4.7, 0.4, 4.7], LOT = [2.6, 4.2, 2.4, 4.0], PAD = [0.25, 1.15, 1.95, 2.85];
  var TREES = [[2.1, 1.25], [3.3, 1.0], [4.35, 1.9], [-1.7, 4.5], [-4.0, 0.75]], TREE_R = 0.42, TREE_Y = 1.0;
  var LAMPS = [[-2.3, 0.24], [-0.6, 0.24], [1.6, 0.24], [3.7, 0.24]];
  var TX = 3.4, TZ = 3.2;                                    // centro da torre (no meio do terreno vazio)
  var PARTS = [                                              // peças da torre, na ordem em que são montadas
    { id: 'tBase', half: 0.75, y0: 0, y1: 0.45 },
    { id: 'tShaft', half: 0.5, y0: 0.45, y1: 3.0 },
    { id: 'tBelfry', half: 0.64, y0: 3.0, y1: 3.7 },
    { id: 'tClock', half: 0.5, y0: 2.1, y1: 2.8 },
    { id: 'tRoof', half: 0.72, y0: 3.7, y1: 4.75 }
  ];
  var CLOCK_Y = 2.45;
  // De onde vem o sol (vetor do lugar para o sol): no fim da tarde, do oeste; ao amanhecer, do leste
  var SUN_W = unit([-0.55, 0.33, 0.77]), SUN_E = unit([0.46, 0.36, 0.81]);
  // Os sistemas: caminhos dos pulsos de dados, dos objetos até o "hub", e dali para cima até o servidor
  var HUB = [0.7, 0.05, 0.75], STORE = [0.7, 5.1, 0.75], DOOR = [-3.4, 0.05, -1.72], COUNTER = [1.5, 0.05, 3.6];
  var ROUTES = [
    [[0.7, 0.1, 1.95], HUB],                                                   // do spawn
    [DOOR, [-3.4, 0.05, -1.58], [0.7, 0.05, -1.58], HUB],                      // da porta da loja, pela calçada e pela faixa
    [COUNTER, [1.5, 0.05, 0.75], HUB],                                        // do quiosque
    [HUB, STORE]                                                               // a subida até o servidor
  ];

  // ---------- O modelo: um lugar para cada ponto ----------
  // kind: tipo do ponto | own: dono (construção 0..5, peça da torre 10..14) | tag: detalhe (janela, porta, zona do chão...)
  var G = 0, R = 1, W = 2, D = 3, P = 4, X = 5, M = 6, Z = 7, F = 8;                      // F: o campo em volta da baseplate
  var px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);      // onde o ponto fica no lugar pronto
  var sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N);      // de onde ele nasce
  var nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);      // para onde a face dele olha
  var kind = new Uint8Array(N), own = new Uint8Array(N), tag = new Uint8Array(N), grid = new Uint8Array(N);
  var ua = new Float32Array(N), ub = new Float32Array(N), rnd = new Float32Array(N);     // ua: janela ou fase; ub: brilho próprio
  var cnt = 0, owner = 0, seed = null, gs = 0.08, OCC = [], BALL = [];
  var BOXES = [], SEGS = [];                                  // caixas das construções; trechos dos caminhos dos pulsos
  function add(k, x, y, z, ax, ay, az, t) {
    var i = cnt++; if (i >= N) return -1;
    px[i] = x; py[i] = y; pz[i] = z; nx[i] = ax; ny[i] = ay; nz[i] = az; kind[i] = k; own[i] = owner; tag[i] = t || 0; ua[i] = 0; ub[i] = 1; grid[i] = 0;
    if (seed) { sx[i] = seed[0]; sy[i] = seed[1]; sz[i] = seed[2]; } else { sx[i] = x; sy[i] = 0; sz[i] = z; }
    return i;
  }

  // Zonas do chão
  var Z_PLAIN = 0, Z_EDGE = 1, Z_STREET = 2, Z_DASH = 3, Z_CROSS = 4, Z_CURB = 5, Z_PLAZA = 6, Z_TILE = 7, Z_PEDGE = 8, Z_LOT = 9, Z_LOTEDGE = 10, Z_PAD = 11;
  function zone(x, z, line) {
    var e = gs * 0.5;
    if (Math.abs(x) > 5 - gs || Math.abs(z) > 5 - gs) return Z_EDGE;
    if (Math.abs(z - STREET[0]) < e || Math.abs(z - STREET[1]) < e) return Z_CURB;
    if (z > STREET[0] && z < STREET[1]) {
      if (x > CROSS[0] && x < CROSS[1]) return frac((z - STREET[0]) / 0.28) < 0.5 ? Z_CROSS : Z_STREET;
      return Math.abs(z - (STREET[0] + STREET[1]) / 2) < e && frac((x + 5) / 0.6) < 0.5 ? Z_DASH : Z_STREET;
    }
    if (x > PLAZA[0] && x < PLAZA[1] && z > PLAZA[2] && z < PLAZA[3]) {
      if (x > PAD[0] && x < PAD[1] && z > PAD[2] && z < PAD[3]) return Z_PAD;
      if (x > LOT[0] && x < LOT[1] && z > LOT[2] && z < LOT[3]) {
        var dx = Math.min(x - LOT[0], LOT[1] - x), dz = Math.min(z - LOT[2], LOT[3] - z);
        return Math.min(dx, dz) < gs && frac((dx < dz ? z : x) / 0.32) < 0.55 ? Z_LOTEDGE : Z_LOT;
      }
      if (Math.min(x - PLAZA[0], PLAZA[1] - x, z - PLAZA[2], PLAZA[3] - z) < gs) return Z_PEDGE;
      return line ? Z_TILE : Z_PLAZA;
    }
    return Z_PLAIN;
  }

  // Fachadas: o que cada ponto de parede é (0 parede, 1 janela, 2 porta, 3 friso, 4 ripa clara de portão)
  var winId = 0;
  function cols(u, w, pitch, lo, hi) {                        // coluna de janelas em que u cai (-1: entre duas colunas)
    var n = Math.max(1, Math.round(w / pitch)), c = Math.min(n - 1, Math.floor(u / w * n)), f = u / w * n - c;
    return f > lo && f < hi ? c : -1;
  }
  function facade(b, face, u, y, w) {
    var c, fl, f;
    winId = 1;
    switch (b.name) {
      case 'shop':
        if (face === 0) {
          if (y < 0.8 && u > 0.8 && u < 1.2) return 2;
          if (y > 0.26 && y < 0.8 && ((u > 0.14 && u < 0.66) || (u > 1.34 && u < 1.86))) { winId = 0.05; return 1; }   // vitrines: sempre acesas
          return 0;
        }
        c = cols(u, w, 0.52, 0.24, 0.76);
        if (c >= 0 && y > 0.5 && y < 0.92) { winId = hash3(1, face * 7 + c, 3); return 1; }
        return 0;
      case 'flats':
        if (face === 0 && y < 0.72 && u > 0.6 && u < 1.0) return 2;
        c = cols(u, w, face === 0 ? 0.4 : 0.46, 0.24, 0.76); fl = Math.floor((y - 0.22) / 0.6); f = (y - 0.22) / 0.6 - fl;
        if (c >= 0 && fl >= 0 && fl < 4 && f > 0.22 && f < 0.72) { winId = hash3(2, face * 7 + c, fl); return 1; }
        return 0;
      case 'hall':
        if (b.isTop) { if (y > b.y0 + 0.16 && y < b.y1 - 0.14) { winId = 0.2; return 1; } return 0; }
        if (face === 0 && y < 0.72 && Math.abs(u - w / 2) < 0.42) return 2;
        if (y > 0.74 && y < 0.88) return 3;
        c = cols(u, w, 0.34, 0.28, 0.72);
        if (c >= 0 && y > 1.0 && y < b.y1 - 0.3) { winId = hash3(3, face * 7 + c, Math.floor(y / 0.58)); return 1; }
        return 0;
      case 'depot':
        if (face === 0 && y < 1.12 && ((u > 0.28 && u < 1.02) || (u > 1.48 && u < 2.22))) return frac(y / 0.2) < 0.5 ? 4 : 2;
        c = cols(u, w, 0.5, 0.18, 0.82);
        if (c >= 0 && y > 1.42 && y < 1.76) { winId = hash3(4, face * 7 + c, 1); return 1; }
        return 0;
      case 'cafe':
        if (face === 1) {
          if (y < 0.8 && u > 0.85 && u < 1.25) return 2;
          if (y > 0.3 && y < 0.82 && ((u > 0.14 && u < 0.7) || (u > 1.4 && u < 1.96))) { winId = 0.1; return 1; }
          return 0;
        }
        c = cols(u, w, 0.56, 0.26, 0.74);
        if (c >= 0 && y > 0.36 && y < 0.82) { winId = hash3(5, face * 7 + c, 1); return 1; }
        return 0;
      case 'kiosk':
        if ((face === 0 || face === 1) && y > 0.36 && y < 0.64 && u > 0.1 && u < w - 0.1) { winId = 0.02; return 1; }
        return 0;
      case 'tShaft':
        if (Math.abs(u - w / 2) < 0.09 && y > 0.85 && y < 1.75) { winId = hash3(6, face, 1); return 1; }
        return 0;
      case 'tBelfry':
        if (Math.abs(u - w / 2) < 0.32 && y > b.y0 + 0.14 && y < b.y1 - 0.14) { winId = 0.15; return 1; }
        return 0;
    }
    return 0;
  }

  // Uma parede: malha regular de pontos numa face da caixa
  function wall(b, face, step) {
    var w = face === 0 || face === 3 ? b.x1 - b.x0 : b.z1 - b.z0, h = b.y1 - b.y0;
    var nu = Math.max(2, Math.round(w / step)), nv = Math.max(2, Math.round(h / step));
    for (var j = 0; j < nv; j++) for (var i = 0; i < nu; i++) {
      var u = (i + 0.5) / nu * w, y = b.y0 + (j + 0.5) / nv * h, x, z, ax = 0, az = 0;
      if (face === 0) { x = b.x0 + u; z = b.z1; az = 1; } else if (face === 3) { x = b.x1 - u; z = b.z0; az = -1; }
      else if (face === 1) { x = b.x1; z = b.z1 - u; ax = 1; } else { x = b.x0; z = b.z0 + u; ax = -1; }
      var k = add(W, x, y, z, ax, 0, az, facade(b, face, u, y, w));
      if (k >= 0) { ua[k] = winId; ub[k] = 1 / nv; }
    }
  }
  // Uma linha de pontos de a até b
  function line(k, a, b, step, t, n) {
    var len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), m = Math.max(2, Math.round(len / step)), up = a[0] === b[0] && a[2] === b[2];
    n = n || [0, 1, 0];
    // ub: numa linha de pé, que na planta fica empilhada num ponto só, o brilho é dividido entre os pontos
    for (var i = 0; i < m; i++) { var f = (i + 0.5) / m, q = add(k, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, n[0], n[1], n[2], t); if (q >= 0) ub[q] = up ? 1 / m : 1; }
  }
  // As arestas de cima e de pé de uma caixa (as de baixo ficam por conta do pé das paredes)
  function edges(b, step, k, t) {
    var xs = [b.x0, b.x1], zs = [b.z0, b.z1], i, j;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) line(k, [xs[i], b.y0, zs[j]], [xs[i], b.y1, zs[j]], step, t);
    for (i = 0; i < 2; i++) { line(k, [b.x0, b.y1, zs[i]], [b.x1, b.y1, zs[i]], step, t); line(k, [xs[i], b.y1, b.z0], [xs[i], b.y1, b.z1], step, t); }
  }
  // Malha num retângulo qualquer: origem o, lados U e V
  function quad(k, o, U, V, step, n, t, each) {
    var nu = Math.max(2, Math.round(Math.hypot(U[0], U[1], U[2]) / step)), nv = Math.max(2, Math.round(Math.hypot(V[0], V[1], V[2]) / step));
    for (var j = 0; j < nv; j++) for (var i = 0; i < nu; i++) {
      var a = (i + 0.5) / nu, c = (j + 0.5) / nv;
      var q = add(k, o[0] + U[0] * a + V[0] * c, o[1] + U[1] * a + V[1] * c, o[2] + U[2] * a + V[2] * c, n[0], n[1], n[2], t);
      if (q >= 0 && each) each(q, a, c, i, j);
    }
  }
  // Uma caixa pequena de objeto (caixa d'água, banco...): faces visíveis e arestas
  function crate(b, step, t) {
    quad(P, [b.x0, b.y1, b.z0], [b.x1 - b.x0, 0, 0], [0, 0, b.z1 - b.z0], step, [0, 1, 0], t);
    quad(P, [b.x0, b.y0, b.z1], [b.x1 - b.x0, 0, 0], [0, b.y1 - b.y0, 0], step, [0, 0, 1], t);
    quad(P, [b.x1, b.y0, b.z1], [0, 0, b.z0 - b.z1], [0, b.y1 - b.y0, 0], step, [1, 0, 0], t);
    quad(P, [b.x0, b.y0, b.z0], [0, 0, b.z1 - b.z0], [0, b.y1 - b.y0, 0], step, [-1, 0, 0], t);
    edges(b, step * 0.6, P, T_TRIM);
  }

  // Detalhes dos objetos (tag dos pontos do tipo P)
  var T_CROWN = 10, T_TRUNK = 11, T_POST = 12, T_HEAD = 13, T_AWN = 14, T_AWN2 = 15, T_SIGN = 16, T_BODY = 17, T_TRIM = 18, T_PAD = 19, T_RING = 20, T_TIP = 21, T_CLOCK = 22;
  // Pulsos: fio parado, pacote que corre, anel de um nó, cubo do servidor
  var T_WIRE = 30, T_PACK = 31, T_NODE = 32;

  function build(step) {
    var r = E.rng(11), i, j, b, q, a;
    cnt = 0; OCC = []; BALL = []; BOXES = []; SEGS = []; seed = null;
    var m = Math.max(3, Math.round(0.5 / step)), ng = 20 * m; gs = 10 / ng;

    // caixas das construções (o salão tem um segundo volume, recuado, no topo)
    BUILD.forEach(function (d, bi) {
      BOXES.push({ name: d.name, own: bi, x0: d.x0, x1: d.x1, y0: 0, y1: d.h, z0: d.z0, z1: d.z1, north: d.north });
      if (d.top) BOXES.push({ name: d.name, own: bi, isTop: true, x0: d.top.x0, x1: d.top.x1, y0: d.h, y1: d.top.h, z0: d.top.z0, z1: d.top.z1 });
    });
    BOXES.forEach(function (o) { OCC.push([o.x0, o.x1, o.y0, o.y1, o.z0, o.z1, 0]); });

    // chão: a malha da baseplate; o que cai dentro de uma construção sobe com ela e vira o teto
    for (j = 0; j < ng; j++) for (i = 0; i < ng; i++) {
      var x = -5 + (i + 0.5) * gs, z = -5 + (j + 0.5) * gs, top = -1, onLine = i % m === 0 || j % m === 0;
      owner = 0;
      for (q = 0; q < BOXES.length; q++) { b = BOXES[q]; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) { top = b.y1; owner = b.own; } }
      a = top < 0 ? add(G, x, 0, z, 0, 1, 0, zone(x, z, onLine)) : add(R, x, top, z, 0, 1, 0, 0);
      if (a >= 0) grid[a] = (i === 0 || j === 0 || i === ng - 1 || j === ng - 1) ? 2 : onLine ? 1 : 0;
    }

    // em volta da baseplate, a mesma malha continua mais rala e some no escuro: o lugar não flutua no vazio
    owner = 0;
    for (j = -Math.ceil(9.4 / (gs * 3)); j * gs * 3 < 9.4; j++) for (i = -Math.ceil(9.4 / (gs * 3)); i * gs * 3 < 9.4; i++) {
      var fx0 = (i + 0.5) * gs * 3, fz0 = (j + 0.5) * gs * 3, fd = Math.hypot(Math.max(Math.abs(fx0) - 5, 0), Math.max(Math.abs(fz0) - 5, 0));
      if ((Math.abs(fx0) < 5 + gs && Math.abs(fz0) < 5 + gs) || fd > 4.3) continue;
      a = add(F, fx0, 0, fz0, 0, 1, 0, 0); if (a >= 0) ub[a] = (1 - fd / 4.3) * (1 - fd / 4.3);
    }

    // paredes e arestas
    BOXES.forEach(function (o) {
      owner = o.own;
      wall(o, 0, step); wall(o, 1, step); wall(o, 2, step); if (o.north) wall(o, 3, step);
      edges(o, step * 0.55, D, 0);
    });

    // --- objetos (nascem do chão, ou da parede onde ficam presos, na cena do detalhe) ---
    owner = 20;
    TREES.forEach(function (t) {
      seed = [t[0], 0, t[1]];
      line(P, [t[0], 0, t[1]], [t[0], TREE_Y - TREE_R * 0.8, t[1]], step * 0.5, T_TRUNK);
      var n = Math.round(4 * PI * TREE_R * TREE_R / (step * step) * 1.15);
      for (var k = 0; k < n; k++) {                                   // copa: esfera de Fibonacci
        var yy = 1 - (k + 0.5) / n * 2, rr = Math.sqrt(1 - yy * yy), th = k * 2.39996;
        add(P, t[0] + Math.cos(th) * rr * TREE_R, TREE_Y + yy * TREE_R * 0.92, t[1] + Math.sin(th) * rr * TREE_R, Math.cos(th) * rr, yy, Math.sin(th) * rr, T_CROWN);
      }
      BALL.push([t[0], TREE_Y, t[1], TREE_R * 0.9]);
    });
    LAMPS.forEach(function (l) {
      seed = [l[0], 0, l[1]];
      line(P, [l[0], 0, l[1]], [l[0], 1.05, l[1]], step * 0.45, T_POST);
      line(P, [l[0], 1.05, l[1]], [l[0], 1.05, l[1] - 0.22], step * 0.45, T_POST);
      for (var k = 0, n = Math.round(14 * Math.sqrt(E.K)); k < n; k++) add(P, l[0] + (r() - 0.5) * 0.07, 1.0 + (r() - 0.5) * 0.05, l[1] - 0.22 + (r() - 0.5) * 0.07, 0, -1, 0, T_HEAD);
      OCC.push([l[0] - 0.035, l[0] + 0.035, 0, 1.05, l[1] - 0.035, l[1] + 0.035, 0]);
    });
    // spawn: uma placa baixa com um anel
    seed = [(PAD[0] + PAD[1]) / 2, 0, (PAD[2] + PAD[3]) / 2];
    quad(P, [PAD[0], 0.07, PAD[2]], [PAD[1] - PAD[0], 0, 0], [0, 0, PAD[3] - PAD[2]], step, [0, 1, 0], T_PAD);
    edges({ x0: PAD[0], x1: PAD[1], y0: 0, y1: 0.07, z0: PAD[2], z1: PAD[3] }, step * 0.6, P, T_TRIM);
    for (i = 0, j = Math.round(2 * PI * 0.3 / (step * 0.5)); i < j; i++) add(P, seed[0] + Math.cos(i / j * 2 * PI) * 0.3, 0.08, seed[2] + Math.sin(i / j * 2 * PI) * 0.3, 0, 1, 0, T_RING);
    // bancos
    [[0.38, 3.45, 0.64, 0.2], [1.75, 2.1, 0.2, 0.64]].forEach(function (d) {
      seed = [d[0] + d[2] / 2, 0, d[1] + d[3] / 2];
      crate({ x0: d[0], x1: d[0] + d[2], y0: 0.16, y1: 0.24, z0: d[1], z1: d[1] + d[3] }, step * 0.8, T_BODY);
      line(P, [d[0] + 0.04, 0, d[1] + 0.04], [d[0] + 0.04, 0.16, d[1] + 0.04], step * 0.5, T_TRIM); line(P, [d[0] + d[2] - 0.04, 0, d[1] + d[3] - 0.04], [d[0] + d[2] - 0.04, 0.16, d[1] + d[3] - 0.04], step * 0.5, T_TRIM);
    });
    // toldo e letreiro da loja (face sul); toldo do café (face leste); beiral do quiosque
    b = BUILD[0];
    quad(P, [b.x0 + 0.12, 1.02, b.z1], [b.x1 - b.x0 - 0.24, 0, 0], [0, -0.2, 0.44], step * 0.9, unit([0, 0.9, 0.42]), T_AWN, function (q2, a2, c2, i2) { sx[q2] = px[q2]; sy[q2] = 1.02; sz[q2] = b.z1; if (i2 % 4 > 1) tag[q2] = T_AWN2; });
    quad(P, [b.x0 + 0.5, 1.13, b.z1 + 0.03], [b.x1 - b.x0 - 1.0, 0, 0], [0, 0.26, 0], step * 0.75, [0, 0, 1], T_SIGN, function (q2) { sx[q2] = px[q2]; sy[q2] = py[q2]; sz[q2] = b.z1; });
    var cf = BUILD[4];
    quad(P, [cf.x1, 1.04, cf.z1 - 0.2], [0, 0, -(cf.z1 - cf.z0 - 0.4)], [0.44, -0.2, 0], step * 0.9, unit([0.42, 0.9, 0]), T_AWN, function (q2, a2, c2, i2) { sx[q2] = cf.x1; sy[q2] = 1.04; sz[q2] = pz[q2]; if (i2 % 4 > 1) tag[q2] = T_AWN2; });
    var ks = BUILD[5];
    seed = [(ks.x0 + ks.x1) / 2, ks.h, (ks.z0 + ks.z1) / 2];
    quad(P, [ks.x0 - 0.16, ks.h + 0.04, ks.z0 - 0.16], [ks.x1 - ks.x0 + 0.32, 0, 0], [0, 0, ks.z1 - ks.z0 + 0.32], step, [0, 1, 0], T_BODY);
    edges({ x0: ks.x0 - 0.16, x1: ks.x1 + 0.16, y0: ks.h + 0.04, y1: ks.h + 0.05, z0: ks.z0 - 0.16, z1: ks.z1 + 0.16 }, step * 0.6, P, T_TRIM);
    // no alto: caixa d'água nos apartamentos, dois aparelhos no galpão, chaminé no café, antena no salão
    [[-1.8, -1.2, 2.7, 3.2, -3.75, -3.15], [2.4, 2.95, 2.0, 2.24, -3.7, -3.2], [3.35, 3.9, 2.0, 2.24, -3.1, -2.6], [-4.1, -3.75, 1.4, 1.85, 2.3, 2.65]].forEach(function (d) {
      seed = [(d[0] + d[1]) / 2, d[2], (d[4] + d[5]) / 2];
      crate({ x0: d[0], x1: d[1], y0: d[2], y1: d[3], z0: d[4], z1: d[5] }, step, T_BODY);
    });
    seed = [0.65, 4.5, -3.35];
    line(P, [0.65, 4.5, -3.35], [0.65, 5.3, -3.35], step * 0.5, T_POST);
    for (i = 0; i < Math.round(8 * Math.sqrt(E.K)); i++) add(P, 0.65 + (r() - 0.5) * 0.05, 5.32 + (r() - 0.5) * 0.05, -3.35 + (r() - 0.5) * 0.05, 0, 1, 0, T_TIP);

    // --- torre do relógio: cada peça nasce do centro da própria base ---
    PARTS.forEach(function (p, pi) {
      owner = 10 + pi; seed = [TX, p.y0, TZ];
      var o = { name: p.id, x0: TX - p.half, x1: TX + p.half, y0: p.y0, y1: p.y1, z0: TZ - p.half, z1: TZ + p.half }, f;
      if (p.id === 'tClock') {                                         // um mostrador em cada face do fuste
        seed = [TX, CLOCK_Y, TZ];
        for (f = 0; f < 4; f++) {
          var ux = f === 0 ? 1 : f === 3 ? -1 : 0, uz = f === 1 ? -1 : f === 2 ? 1 : 0, ox = f === 1 ? 1 : f === 2 ? -1 : 0, oz = f === 0 ? 1 : f === 3 ? -1 : 0;
          var cx = TX + ox * 0.53, cz = TZ + oz * 0.53, n = Math.round(2 * PI * 0.3 / (step * 0.42));
          for (i = 0; i < n; i++) { a = i / n * 2 * PI; add(P, cx + ux * Math.cos(a) * 0.3, CLOCK_Y + Math.sin(a) * 0.3, cz + uz * Math.cos(a) * 0.3, ox, 0, oz, T_CLOCK); }
          line(P, [cx, CLOCK_Y, cz], [cx + ux * 0.13, CLOCK_Y + 0.13, cz + uz * 0.13], step * 0.4, T_CLOCK, [ox, 0, oz]);   // os ponteiros marcam 10h10
          line(P, [cx, CLOCK_Y, cz], [cx - ux * 0.21, CLOCK_Y + 0.12, cz - uz * 0.21], step * 0.4, T_CLOCK, [ox, 0, oz]);
        }
        return;
      }
      if (p.id === 'tRoof') {                                          // telhado em pirâmide: quatro faces e as quinas
        var hgt = p.y1 - p.y0, slant = Math.hypot(hgt, p.half), nv = Math.max(3, Math.round(slant / step)), nrm = unit([0, p.half, hgt]);
        for (f = 0; f < 4; f++) {
          var dx = f === 1 ? 1 : f === 2 ? -1 : 0, dz = f === 0 ? 1 : f === 3 ? -1 : 0;        // para fora
          for (j = 0; j < nv; j++) {
            var v = (j + 0.5) / nv, half = p.half * (1 - v), nu = Math.max(1, Math.round(2 * half / step));
            for (i = 0; i < nu; i++) { var s = ((i + 0.5) / nu * 2 - 1) * half; add(W, TX + dx * half + dz * s, p.y0 + v * hgt, TZ + dz * half + dx * s, dx * nrm[2], nrm[1], dz * nrm[2], 0); }
          }
          line(D, [TX + (f < 2 ? 1 : -1) * p.half, p.y0, TZ + (f % 2 ? 1 : -1) * p.half], [TX, p.y1, TZ], step * 0.5, 0);
        }
        for (j = 0; j < 3; j++) OCC.push([TX - p.half * (1 - j / 3), TX + p.half * (1 - j / 3), p.y0 + hgt * j / 3, p.y0 + hgt * (j + 1) / 3 * 0.9, TZ - p.half * (1 - j / 3), TZ + p.half * (1 - j / 3), 1]);
        return;
      }
      for (f = 0; f < 4; f++) wall(o, f, step);
      edges(o, step * 0.55, D, 0);
      if (p.id === 'tBase') quad(W, [o.x0, o.y1, o.z0], [o.x1 - o.x0, 0, 0], [0, 0, o.z1 - o.z0], step, [0, 1, 0], 0);
      OCC.push([o.x0, o.x1, o.y0, o.y1, o.z0, o.z1, 1]);
    });

    // --- pulsos dos sistemas ---
    owner = 30; seed = null;
    var KQ = Math.sqrt(E.K);
    ROUTES.forEach(function (route) {
      for (var s = 0; s < route.length - 1; s++) {
        var A = route[s], B = route[s + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), parts = Math.max(1, Math.round(len / 2.2));
        for (var c = 0; c < parts; c++) {
          var a0 = [A[0] + (B[0] - A[0]) * c / parts, A[1] + (B[1] - A[1]) * c / parts, A[2] + (B[2] - A[2]) * c / parts];
          var b0 = [A[0] + (B[0] - A[0]) * (c + 1) / parts, A[1] + (B[1] - A[1]) * (c + 1) / parts, A[2] + (B[2] - A[2]) * (c + 1) / parts];
          var L = len / parts, mid = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2, (a0[2] + b0[2]) / 2];
          line(X, a0, b0, step * 0.9, T_WIRE);
          for (var k = 0; k < 3; k++) for (var e = 0, ne = Math.round(12 * KQ); e < ne; e++) {     // três pacotes por trecho, cada um com cauda
            q = add(X, mid[0], mid[1], mid[2], b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2], T_PACK);
            if (q >= 0) { ua[q] = frac(k / 3 + SEGS.length * 0.37 - e / ne * 0.3 / L); ub[q] = 1 - e / ne; }
          }
          SEGS.push(L);
        }
      }
    });
    [[0.7, 0.09, 2.4, 0.3], [DOOR[0], 0.05, DOOR[2], 0.17], [COUNTER[0], 0.05, COUNTER[2], 0.17], [HUB[0], 0.05, HUB[2], 0.2]].forEach(function (d, di) {
      if (di === 0) return;                                            // o spawn já tem o próprio anel
      for (var k = 0, n = Math.round(2 * PI * d[3] / (step * 0.5)); k < n; k++) add(X, d[0] + Math.cos(k / n * 2 * PI) * d[3], d[1], d[2] + Math.sin(k / n * 2 * PI) * d[3], 0, 1, 0, T_NODE);
    });
    // o servidor: um cubo de arame no alto
    b = { x0: STORE[0] - 0.17, x1: STORE[0] + 0.17, y0: STORE[1], y1: STORE[1] + 0.34, z0: STORE[2] - 0.17, z1: STORE[2] + 0.17 };
    edges(b, step * 0.45, X, T_NODE);
    line(X, [b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], step * 0.45, T_NODE); line(X, [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], step * 0.45, T_NODE);
    line(X, [b.x0, b.y0, b.z0], [b.x0, b.y0, b.z1], step * 0.45, T_NODE); line(X, [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], step * 0.45, T_NODE);

    // --- efeitos: brilhos que sobem do spawn e a poeira no cone de luz de cada poste ---
    owner = 40;
    for (i = 0, j = Math.round(110 * E.K); i < j; i++) { a = r() * 2 * PI; q = Math.sqrt(r()) * 0.36; a = add(M, 0.7 + Math.cos(a) * q, 0.85, 2.4 + Math.sin(a) * q, 0, 1.5, 0, 0); if (a >= 0) { ua[a] = r(); ub[a] = 0.4 + r() * 0.8; } }
    LAMPS.forEach(function (l) {
      for (var k = 0, n = Math.round(46 * E.K); k < n; k++) {
        var yy = r() * 0.92, rr = Math.sqrt(r()) * (0.06 + (1 - yy / 0.95) * 0.42), th = r() * 2 * PI;
        a = add(M, l[0] + Math.cos(th) * rr, yy, l[1] - 0.22 + Math.sin(th) * rr, 0, -0.16, 0, 1);
        if (a >= 0) { ua[a] = r(); ub[a] = (0.25 + r() * 0.5) * (0.35 + yy); }
      }
    });
    return cnt;
  }

  // Ajusta o passo da malha até o lugar inteiro caber nos pontos disponíveis; o que sobra fica guardado, invisível
  var STEP = 0.079 / Math.sqrt(E.K);
  while (build(STEP) > N * 0.985) STEP *= 1.02;
  var USED = cnt, r0 = E.rng(23), i0;
  owner = 50; seed = null;
  for (i0 = USED; i0 < N; i0++) add(Z, (r0() - 0.5) * 9.6, 0, (r0() - 0.5) * 9.6, 0, 1, 0, 0);
  for (i0 = 0; i0 < N; i0++) rnd[i0] = r0();

  // ---------- Luz ----------
  // O raio que sai do ponto na direção do sol bate em alguma coisa? (caixas e copas; a torre só conta depois de montada)
  function shaded(x, y, z, S, withTower) {
    var q, o, t1, t2, lo, hi;
    for (q = 0; q < OCC.length; q++) {
      o = OCC[q]; if (o[6] && !withTower) continue;
      t1 = (o[0] - x) / S[0]; t2 = (o[1] - x) / S[0]; lo = Math.min(t1, t2); hi = Math.max(t1, t2);
      t1 = (o[2] - y) / S[1]; t2 = (o[3] - y) / S[1]; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      if (hi <= lo) continue;
      t1 = (o[4] - z) / S[2]; t2 = (o[5] - z) / S[2]; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      if (hi > Math.max(lo, 0.02)) return true;
    }
    for (q = 0; q < BALL.length; q++) {
      o = BALL[q];
      var ox = o[0] - x, oy = o[1] - y, oz = o[2] - z, tc = ox * S[0] + oy * S[1] + oz * S[2];
      if (tc > 0.05 && ox * ox + oy * oy + oz * oz - tc * tc < o[3] * o[3]) return true;
    }
    return false;
  }
  // Luz quente dos postes, da vitrine e do spawn sobre um ponto, à noite (0 a 1)
  var GLOW = LAMPS.map(function (l) { return [l[0], 1.0, l[1] - 0.22, 1.5, 1]; }).concat([[-3.4, 0.5, -1.7, 1.25, 0.85], [-2.55, 0.6, 2.95, 1.2, 0.7], [0.7, 0.3, 2.4, 0.95, 0.8]]);
  function glow(x, y, z) {
    var g = 0;
    for (var q = 0; q < GLOW.length; q++) { var o = GLOW[q], d = Math.hypot(x - o[0], (y - o[1]) * 0.6, z - o[2]) / o[3]; if (d < 1) g += (1 - d) * (1 - d) * o[4]; }
    return Math.min(1, g);
  }

  // Um ponto recebe sol? É a parte cara de uma cena de sol (um raio por ponto), por isso é calculada em fatias:
  // o preparo em segundo plano faz uma fatia por vez, sem segurar o filme (ver "steps" em js/matter.js).
  var SLICES = 6;
  function sunlit(i, S, tower) {
    var k = kind[i], t = tag[i], lam;
    if (own[i] >= 10 && own[i] < 20 && !tower) return 0;
    if (k === G || k === R || k === F) return shaded(px[i], py[i] + 0.03, pz[i], S, tower) ? 0 : 1;
    if (k === W) { lam = nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2]; return lam > 0.02 && !shaded(px[i] + nx[i] * 0.03, py[i] + ny[i] * 0.03, pz[i] + nz[i] * 0.03, S, tower) ? 1 : 0; }
    if (k === P) {
      if (t === T_CROWN && 0.5 + 0.5 * (nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2]) <= 0.35) return 0;
      return shaded(px[i] + nx[i] * 0.04, py[i] + ny[i] * 0.04, pz[i] + nz[i] * 0.04, S, tower) ? 0 : 1;
    }
    return 0;
  }
  function slice(name, c) {
    return function () {
      var L = LOOKS[name], a = Math.floor(N * c / SLICES), b = Math.floor(N * (c + 1) / SLICES), out = new Uint8Array(b - a);
      for (var i = a; i < b; i++) out[i - a] = sunlit(i, L.sun, !!L.tower);
      return out;
    };
  }

  // ---------- Cores ----------
  var cp = [0, 0, 0], cg = [0, 0, 0], col = [0, 0, 0];
  // cor de um ponto: tom h e brilho k na rampa principal, puxada para o dourado na medida g (0 a 1)
  function tint(h, k, g) {
    E.tone(clamp(h, 0, 1), k, cp);
    if (g > 0) { E.tone(2 + clamp(h, 0, 0.999), k, cg); col[0] = cp[0] + (cg[0] - cp[0]) * g; col[1] = cp[1] + (cg[1] - cp[1]) * g; col[2] = cp[2] + (cg[2] - cp[2]) * g; }
    else { col[0] = cp[0]; col[1] = cp[1]; col[2] = cp[2]; }
  }
  var GH = [0.2, 0.8, 0.1, 0.8, 0.85, 0.6, 0.3, 0.46, 0.75, 0.2, 0.7, 0.3], GK = [0.8, 1, 0.62, 1, 1, 0.9, 0.85, 0.9, 1, 0.8, 0.9, 0];   // tom e brilho de cada zona do chão, de dia
  var FACE_K = { s: 1, e: 0.7, w: 0.82, n: 0.6 };
  function faceK(i) { return ny[i] > 0.5 ? 1 : nz[i] > 0.5 ? FACE_K.s : nx[i] > 0.5 ? FACE_K.e : nx[i] < -0.5 ? FACE_K.w : nz[i] < -0.5 ? FACE_K.n : 0.8; }

  // Cada cena: até onde a obra chegou (stage) e com que luz
  //   stage 0 baseplate | 1 planta | 2 volumes | 3 detalhe
  var LOOKS = {
    base: { stage: 0 }, plan: { stage: 1 }, grey: { stage: 2 }, built: { stage: 3 },
    dusk: { stage: 3, sun: SUN_W, fx: true },
    night: { stage: 3, night: true, pulses: true, fx: true },
    calm: { stage: 3, night: true, fx: true, mark: true },
    tower: { stage: 3, night: true, fx: true, tower: true },
    dawn: { stage: 3, sun: SUN_E, fx: true, tower: true }
  };

  function make(name, ready) {
    var L = LOOKS[name], s = new E.Shape(), S = L.sun, st = L.stage, i, k, t, h, kk, g, lam, lit, x, y, z, LIT = null;
    if (S) {                                                           // sombras: prontas (em fatias) ou calculadas agora
      LIT = new Uint8Array(N);
      for (i = 0; i < SLICES; i++) LIT.set(ready ? ready[i] : slice(name, i)(), Math.floor(N * i / SLICES));
    }
    for (i = 0; i < N; i++) {
      k = kind[i]; t = tag[i];
      var tw = own[i] >= 10 && own[i] < 20, up = k === G || k === Z || k === F ? true : tw ? !!L.tower : k === P ? st >= 3 : k === X || k === M ? true : st >= 2;
      x = up ? px[i] : sx[i]; y = up ? py[i] : sy[i]; z = up ? pz[i] : sz[i];
      h = 0; kk = 0; g = 0;

      if (k === G || k === R || k === F) {
        // ----- chão, tetos e o campo em volta -----
        if (k === F) { h = 0.3; kk = 0.6; }
        else if (st === 0) { h = grid[i] === 2 ? 1 : grid[i] === 1 ? 0.9 : 0.28; kk = grid[i] === 2 ? 1.3 : 1; }
        else if (k === R) { h = st === 1 ? 0.62 : 0.7; kk = st === 1 ? 1.15 : 0.95; }
        else {
          var zt = t;
          if (zt === Z_PAD && st < 3) zt = Z_PLAZA;
          if ((zt === Z_LOT || zt === Z_LOTEDGE) && L.tower) zt = grid[i] ? Z_TILE : Z_PLAZA;
          h = GH[zt]; kk = GK[zt];
          if (st === 1) {                                              // na planta, a grade da baseplate ainda aparece e os riscos são mais fortes
            if (grid[i] === 1 && (zt === Z_PLAIN || zt === Z_STREET)) { h += 0.16; kk = 0.85; }
            if (zt === Z_CURB || zt === Z_PEDGE || zt === Z_CROSS || zt === Z_DASH || zt === Z_LOTEDGE) kk *= 1.3;
          }
        }
        if (S) {
          if (LIT[i]) { h = 0.45 + h * 0.4; kk *= 0.82; g = 0.66; } else { h = 0.2 + h * 0.2; kk *= 0.5; }
        } else if (L.night) {
          lam = k === F ? 0 : glow(x, y, z);
          kk *= 0.62 + lam; h = h * 0.85 + lam * 0.3; g = lam * 0.85;
          if (L.mark && k === G && t === Z_LOTEDGE) { h = 0.56; kk = 1.1; g = 1; }   // o terreno da torre, marcado em dourado
        }
        if (k === F) kk *= ub[i];
      } else if (k === W || k === D) {
        // ----- paredes e arestas -----
        if (!up && tw) kk = 0;
        else if (st < 1) kk = 0;
        else if (st === 1 && !tw) { h = 0.95; kk = ub[i] * (k === D ? 0.6 : 1.6); }   // na planta: só o contorno, riscado no chão
        else if (k === D) {
          if (S) { h = 0.9; kk = 0.72; g = 0.45; } else if (L.night) { h = 0.8; kk = 0.8; } else { h = 1; kk = 1.1; }
        } else {
          var fk = faceK(i), det = st >= 3 ? t : 0, trim = det === 3 || det === 4;
          if (S) {
            lam = nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2]; lit = LIT[i] === 1;
            if (det === 1) {
              if (lit) { var gl = frac(ua[i] * 7.3); if (gl < 0.26) { h = 0.92; kk = 1.25; g = 0.75; } else if (gl < 0.52) { h = 0.56; kk = 1.15; g = 1; } else { h = 0.36; kk = 0.46; g = 0.4; } }   // vidro: uns refletem o sol, outros têm luz acesa
              else if (ua[i] < 0.45) { h = 0.56; kk = 1.2; g = 1; } else { h = 0.12; kk = 0.3; }                                // na sombra: luz acesa lá dentro
            } else if (det === 2) { h = 0.12; kk = lit ? 0.45 : 0.28; g = lit ? 0.4 : 0; }
            else if (lit) { h = 0.62 + 0.2 * lam; kk = (0.36 + 0.58 * lam) * (trim ? 1.25 : 1); g = 0.7; }
            else { h = 0.3; kk = trim ? 0.5 : 0.4; }
          } else if (L.night) {
            lam = glow(x, y, z);
            if (det === 1 && ua[i] < 0.45) { h = 0.56; kk = 1.15; g = 1; }
            else if (det === 1 || det === 2) { h = 0.1; kk = 0.22 + lam * 0.3; g = lam; }
            else { h = 0.36 + lam * 0.3; kk = (trim ? 0.56 : 0.44) * (0.6 + fk * 0.5) + lam * 0.6; g = lam * 0.85; }
          } else {
            if (det === 1) { h = 0.16; kk = 0.3; } else if (det === 2) { h = 0.1; kk = 0.26; } else if (trim) { h = 0.9; kk = fk; }
            else { h = 0.58 + (rnd[i] - 0.5) * 0.05; kk = fk; }
          }
        }
      } else if (k === P) {
        // ----- objetos -----
        if (!up) kk = 0;
        else {
          switch (t) {
            case T_CROWN: h = 0.5; kk = 0.46 + 0.42 * (ny[i] * 0.5 + 0.5); break;
            case T_TRUNK: h = 0.35; kk = 0.7; break;
            case T_POST: h = 0.55; kk = 0.8; break;
            case T_HEAD: h = 0.95; kk = 1.1; break;
            case T_AWN: h = 0.85; kk = 0.95; break;
            case T_AWN2: h = 0.42; kk = 0.8; break;
            case T_SIGN: h = 0.92; kk = 1; break;
            case T_BODY: h = 0.62; kk = 0.85 * faceK(i); break;
            case T_TRIM: h = 0.95; kk = 1; break;
            case T_PAD: h = 0.78; kk = 0.9; break;
            case T_RING: h = 1; kk = 1.2; break;
            case T_TIP: h = 1; kk = 1.2; break;
            case T_CLOCK: h = 1; kk = 1.1; break;
          }
          if (S) {
            if (t === T_HEAD || t === T_TIP) { h = 0.66; kk = 1.7; g = 1; }
            else if (t === T_CLOCK) { h = 0.95; kk = 1.1; g = 0.55; }
            else {
              lam = t === T_CROWN ? 0.5 + 0.5 * (nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2]) : 0.6;
              if (LIT[i]) { h = 0.5 + h * 0.35; kk *= 0.5 + 0.8 * lam; g = 0.62; } else { h = 0.1 + h * 0.4; kk *= 0.42; }
            }
          } else if (L.night) {
            if (t === T_HEAD) { h = 0.66; kk = 2; g = 1; }
            else if (t === T_SIGN) { h = 0.6; kk = 1.2; g = 1; }
            else if (t === T_RING || t === T_TIP || t === T_CLOCK) { h = 0.6; kk = 1.2; g = 1; }
            else { lam = glow(x, y, z); h = h * 0.8 + lam * 0.2; kk *= 0.58 + lam; g = lam * 0.85; }
          }
        }
      } else if (k === X) {
        // ----- pulsos -----
        if (L.pulses) { g = 1; if (t === T_WIRE) { h = 0.5; kk = 0.8; } else if (t === T_NODE) { h = 0.6; kk = 1.25; } else { h = 0.68; kk = 1.9 * ub[i]; } }
      } else if (k === M) {
        // ----- efeitos -----
        if (L.fx) { g = 1; h = 0.6; kk = (t === 1 ? (L.night ? 0.6 : 0.4) : 0.95) * ub[i]; }
      }

      tint(h, kk, g);
      s.rgb(x, y, z, col[0], col[1], col[2]);
      if (k === X && t === T_PACK) s.flowLast(nx[i], ny[i], nz[i], ua[i]);
      else if (k === M) s.flowLast(0, ny[i], 0, ua[i]);
    }
    return s;
  }

  // ---------- Sólidos de cada cena ----------
  function solidsOf(name) {
    var L = LOOKS[name], out = {};
    if (L.stage < 1) return out;
    BOXES.forEach(function (b, q) { out['b' + q] = [b.x0, b.x1, L.stage >= 2 ? b.y0 : 0, L.stage >= 2 ? b.y1 : 0, b.z0, b.z1]; });
    if (L.stage >= 2) TREES.forEach(function (t, q) { var c = L.stage >= 3 ? TREE_R * 0.95 : 0, y = L.stage >= 3 ? TREE_Y : 0; out['t' + q] = [t[0] - c, t[0] + c, y - c * 0.92, y + c * 0.92, t[1] - c, t[1] + c]; });
    if (L.mark || L.tower) PARTS.forEach(function (p) {
      if (p.id === 'tClock') return;
      var c = L.tower ? p.half : 0;
      out[p.id] = [TX - c, TX + c, p.y0, L.tower ? p.y1 : p.y0, TZ - c, TZ + c];
    });
    return out;
  }
  E.solidShape('tRoof', 'pyramid');
  TREES.forEach(function (t, q) { E.solidShape('t' + q, 'sphere'); });

  var VIEW = {
    base: { size: 0.062, gain: 1.0, dof: 0.05 }, plan: { size: 0.062, gain: 1.0, dof: 0.05 }, grey: { size: 0.062, gain: 0.95, dof: 0.07 },
    built: { size: 0.062, gain: 0.95, dof: 0.075 }, dusk: { size: 0.064, gain: 1.0, dof: 0.08 }, night: { size: 0.064, gain: 1.05, dof: 0.06 },
    calm: { size: 0.064, gain: 1.05, dof: 0.08 }, tower: { size: 0.064, gain: 1.05, dof: 0.08 }, dawn: { size: 0.064, gain: 1.0, dof: 0.075 }
  };
  Object.keys(LOOKS).forEach(function (name) {
    var v = VIEW[name];
    var def = { make: function (ready) { return make(name, ready); }, size: v.size, gain: v.gain, vary: 0.12, dof: v.dof, rate: 0.36, solids: solidsOf(name) };
    if (LOOKS[name].sun) { def.steps = []; for (var c = 0; c < SLICES; c++) def.steps.push(slice(name, c)); }
    E.scene(name, def);
  });

  // ---------- Papéis dos pontos em cada passagem ----------
  // (atraso de cada ponto dentro da passagem; turbulência só quando o mar assenta)
  function role(delay, turb) {
    return function () { var a = new Float32Array(N * 4); for (var i = 0; i < N; i++) { a[i * 4] = delay(i); a[i * 4 + 2] = turb || 0; } return a; };
  }
  var RISE = [0, 0.2, 0.42, 0.62, 0.8, 0.94];                          // a ordem em que os volumes sobem
  var PLACE = [0, 0.24, 0.5, 0.7, 0.84];                               // a ordem em que as peças da torre são postas
  function sweep(S) { return function (i) { return clamp(0.5 - (px[i] * S[0] + pz[i] * S[2]) / Math.hypot(S[0], S[2]) / 13, 0, 1); }; }
  E.fx('settle', role(function (i) { return clamp(Math.hypot(sx[i], sz[i]) / 7, 0, 1); }, 0.35));       // o mar assenta do centro para as bordas
  E.fx('draw', role(function (i) { return clamp((sx[i] + 5) / 10, 0, 1); }));                           // a planta é riscada de oeste a leste
  E.fx('extrude', role(function (i) { return own[i] < 10 && (kind[i] === W || kind[i] === D || kind[i] === R) ? RISE[own[i]] : 0; }));
  E.fx('detail', role(function (i) { return clamp((px[i] - pz[i] + 10) / 20, 0, 1); }));                // o detalhe corre na diagonal
  E.fx('sunset', role(sweep(SUN_W)));                                                                   // a luz chega do lado do sol
  E.fx('sunrise', role(sweep(SUN_E)));
  E.fx('fade', role(function (i) { return rnd[i]; }));
  E.fx('place', role(function (i) { return own[i] >= 10 && own[i] < 20 ? PLACE[own[i] - 10] : 0; }));
  E.solidFx('extrude', function (id) { return id.charAt(0) === 'b' ? RISE[BOXES[+id.slice(1)].own] : 0; });
  E.solidFx('detail', function (id) { if (id.charAt(0) !== 't' || id.length > 2) return 0; var t = TREES[+id.slice(1)]; return clamp((t[0] - t[1] + 10) / 20, 0, 1); });
  E.solidFx('place', function (id) { for (var q = 0; q < PARTS.length; q++) if (PARTS[q].id === id) return PLACE[q]; return 0; });

  // ---------- O que a câmera olha e onde as etiquetas ficam presas ----------
  E.subject('town', { at: function () { return [0, 0.6, 0]; } });
  E.subject('shop', { at: function () { return [-3.4, 0.7, -1.9]; } });
  E.subject('lot', { at: function () { return [TX, 1.9, TZ]; } });
  E.anchor('spawn', function () { return [0.7, 0.12, 2.4]; });
  E.anchor('door', function () { return [DOOR[0], 0.1, DOOR[2]]; });
  E.anchor('wire', function () { return [HUB[0], 2.7, HUB[2]]; });
  E.anchor('store', function () { return [STORE[0], STORE[1] + 0.36, STORE[2]]; });
  E.anchor('shopdoor', function () { return [-3.4, 0.86, -1.88]; });
  E.anchor('lot', function () { return [TX, 0.05, LOT[3]]; });
});
