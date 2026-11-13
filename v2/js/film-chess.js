// ===== Cenas do xadrez =====
//   boardFlat    a baseplate vira tabuleiro, com as peças ainda deitadas nas casas
//   boardUp      as peças de pé (partida em andamento) | boardClose: a mesma cena, com a câmera no cavalo
//   boardCoil    o cavalo recua para tomar impulso
//   boardHit     o cavalo no instante do contato com o peão
//   boardThrow   o cavalo pousou; o peão foi arremessado e gira no ar
//   boardSlam    o peão bate de lado no tabuleiro
//   boardCrack   o tabuleiro racha como um espelho a partir do ponto da batida
//   boardShatter os cacos e as peças despencam
// Cada peça e cada caco do tabuleiro é um "grupo rígido": gira e se desloca inteiro (ver rigRow em matter.js).
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  var N = E.N, cnt = E.cnt, rng = E.rng, lerp = E.lerp, clamp = E.clamp, Q = E.Q, PI = Math.PI;

  // ---------- Peças ----------
  // Perfis de torno: pares [altura, raio], de baixo para cima
  var PROFILE = {
    pawn: [[0, 0.33], [0.06, 0.35], [0.12, 0.29], [0.18, 0.2], [0.44, 0.11], [0.5, 0.21], [0.54, 0.21], [0.58, 0.12], [0.64, 0.15], [0.72, 0.2], [0.8, 0.215], [0.88, 0.19], [0.96, 0.11], [1.0, 0]],
    rook: [[0, 0.37], [0.07, 0.39], [0.15, 0.31], [0.23, 0.24], [0.82, 0.21], [0.88, 0.3], [1.02, 0.3]],
    bishop: [[0, 0.36], [0.07, 0.38], [0.14, 0.3], [0.2, 0.2], [0.78, 0.1], [0.83, 0.21], [0.87, 0.21], [0.91, 0.12], [1.02, 0.19], [1.16, 0.21], [1.3, 0.14], [1.4, 0.05], [1.43, 0.08], [1.47, 0.06], [1.5, 0]],
    queen: [[0, 0.38], [0.08, 0.4], [0.16, 0.32], [0.24, 0.22], [1.0, 0.11], [1.06, 0.23], [1.1, 0.23], [1.14, 0.14], [1.3, 0.17], [1.5, 0.27], [1.52, 0.2], [1.6, 0.12], [1.68, 0.07], [1.72, 0.09], [1.76, 0]],
    king: [[0, 0.4], [0.08, 0.42], [0.16, 0.34], [0.24, 0.23], [1.1, 0.12], [1.16, 0.25], [1.2, 0.25], [1.24, 0.15], [1.4, 0.18], [1.6, 0.27], [1.62, 0.19], [1.7, 0.1], [1.72, 0]],
    knight: [[0, 0.37], [0.07, 0.39], [0.15, 0.31], [0.23, 0.25], [0.3, 0.24], [0.32, 0]]
  };
  function lathe(profile, n, r, c, o) {
    var segs = [], total = 0;
    for (var i = 0; i < profile.length - 1; i++) {
      var a = profile[i], b = profile[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.001, w = len * (a[1] + b[1]) * 0.5 + 0.002;
      segs.push([a, b, len, w]); total += w;
    }
    for (var k = 0; k < n; k++) {
      var t = r() * total, j = 0; while (j < segs.length - 1 && t > segs[j][3]) { t -= segs[j][3]; j++; }
      var s = segs[j], u = r(), y = lerp(s[0][0], s[1][0], u), rad = lerp(s[0][1], s[1][1], u), th = r() * 2 * PI;
      var nr = (s[1][0] - s[0][0]) / s[2], ny = -(s[1][1] - s[0][1]) / s[2];
      c.p[o * 3] = rad * Math.cos(th); c.p[o * 3 + 1] = y; c.p[o * 3 + 2] = rad * Math.sin(th);
      c.q[o * 3] = nr * Math.cos(th); c.q[o * 3 + 1] = ny; c.q[o * 3 + 2] = nr * Math.sin(th); o++;
    }
    return o;
  }
  // Cabeça do cavalo: silhueta desenhada em 2D e "inflada" em 3D
  var knightMask = (function () {
    var w = 100, h = 130, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(24, 130);
    ctx.bezierCurveTo(15, 108, 9, 84, 19, 58); ctx.bezierCurveTo(25, 40, 33, 27, 43, 19);
    ctx.lineTo(45, 2); ctx.lineTo(57, 16);
    ctx.bezierCurveTo(71, 22, 85, 38, 93, 58); ctx.bezierCurveTo(97, 67, 93, 77, 85, 77);
    ctx.bezierCurveTo(77, 77, 70, 71, 62, 69); ctx.bezierCurveTo(56, 75, 58, 89, 68, 104);
    ctx.bezierCurveTo(74, 114, 77, 122, 77, 130); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(63, 39, 3.6, 0, 2 * PI); ctx.fill();
    var d = ctx.getImageData(0, 0, w, h).data, dist = new Float32Array(w * h), inside = [], x, y, q;
    for (var i = 0; i < w * h; i++) dist[i] = d[i * 4 + 3] > 128 ? 999 : 0;
    for (y = 1; y < h; y++) for (x = 1; x < w; x++) { q = y * w + x; if (dist[q]) dist[q] = Math.min(dist[q], dist[q - 1] + 1, dist[q - w] + 1); }
    for (y = h - 2; y >= 0; y--) for (x = w - 2; x >= 0; x--) { q = y * w + x; if (dist[q]) dist[q] = Math.min(dist[q], dist[q + 1] + 1, dist[q + w] + 1); }
    for (i = 0; i < w * h; i++) if (dist[i] > 0) inside.push(i);
    return { w: w, h: h, dist: dist, inside: inside };
  })();
  // Nuvem local de uma peça: p = posições (base no chão, eixo em y), q = normais
  function cloud(type, n, seed) {
    var r = rng(seed), c = { p: new Float32Array(n * 3), q: new Float32Array(n * 3), n: n }, o = 0, k, a;
    function raw(x, yy, z, nx, ny, nz) { c.p[o * 3] = x; c.p[o * 3 + 1] = yy; c.p[o * 3 + 2] = z; c.q[o * 3] = nx; c.q[o * 3 + 1] = ny; c.q[o * 3 + 2] = nz; o++; }
    if (type === 'rook') {
      o = lathe(PROFILE.rook, Math.round(n * 0.78), r, c, o);
      while (o < n) { a = r() * 2 * PI; if (Math.floor(a / (PI / 5)) % 2) continue; var rr = r() < 0.5 ? 0.3 : 0.23; raw(rr * Math.cos(a), 1.02 + r() * 0.13, rr * Math.sin(a), Math.cos(a), 0.2, Math.sin(a)); }
    } else if (type === 'queen') {
      o = lathe(PROFILE.queen, Math.round(n * 0.84), r, c, o);
      while (o < n) { k = Math.floor(r() * 8); a = k * PI / 4; var b = r() * 2 * PI, e = r() * 2 - 1, f = Math.sqrt(1 - e * e) * 0.055; raw(0.26 * Math.cos(a) + f * Math.cos(b), 1.54 + e * 0.055, 0.26 * Math.sin(a) + f * Math.sin(b), Math.cos(a), 0.6, Math.sin(a)); }
    } else if (type === 'king') {
      o = lathe(PROFILE.king, Math.round(n * 0.84), r, c, o);
      while (o < n) { if (r() < 0.6) raw((r() - 0.5) * 0.07, 1.72 + r() * 0.34, (r() < 0.5 ? 1 : -1) * 0.035, 0, 0.3, r() < 0.5 ? 1 : -1); else raw((r() - 0.5) * 0.24, 1.9 + r() * 0.07, (r() < 0.5 ? 1 : -1) * 0.035, 0, 0.3, r() < 0.5 ? 1 : -1); }
    } else if (type === 'knight') {
      o = lathe(PROFILE.knight, Math.round(n * 0.26), r, c, o);
      var m = knightMask, sc = 1.12 / m.h, D = 15, TH = 0.17;
      while (o < n) {
        var px = m.inside[Math.floor(r() * m.inside.length)], x = px % m.w, yy = (px - x) / m.w, d = Math.min(m.dist[px], D) / D;
        var th = TH * Math.sqrt(1 - (1 - d) * (1 - d)), sg = r() < 0.5 ? 1 : -1;
        raw((x + r() - 48) * sc, 0.3 + (m.h - yy - r()) * sc, sg * th, 0.25, 0.35 + 0.4 * (1 - d), sg * (0.35 + 0.6 * d));
      }
    } else o = lathe(PROFILE[type], n, r, c, o);
    return c;
  }
  E.pieceCloud = cloud;   // o peão grande da queda (film-gun.js) usa a mesma nuvem

  // ---------- A partida ----------
  // Abertura Escocesa, logo antes de Cxd4. Casa = [coluna, fileira], de 0 a 7.
  // O cavalo (f3) captura o peão (d4) e o arremessa na mesma linha, até a casa vazia b5, onde ele bate e racha o tabuleiro.
  function sq(f, rk) { return [f - 3.5, 3.5 - rk]; }
  var F3 = sq(5, 2), D4 = sq(3, 3), B5 = sq(1, 4);
  var dl = Math.hypot(D4[0] - F3[0], D4[1] - F3[1]), DIR = [(D4[0] - F3[0]) / dl, (D4[1] - F3[1]) / dl];   // direção do golpe, no plano
  var TIP = [DIR[1], 0, -DIR[0]];        // girar em torno deste eixo tomba a peça para a frente, na direção do golpe
  var SET = [];
  function piece(type, f, rk, side, role) { SET.push({ type: type, f: f, r: rk, side: side, role: role || '', id: SET.length + 1 }); }
  [['rook', 0], ['knight', 1], ['bishop', 2], ['queen', 3], ['king', 4], ['bishop', 5], ['rook', 7]].forEach(function (p) { piece(p[0], p[1], 0, 1); });
  [0, 1, 2, 5, 6, 7].forEach(function (f) { piece('pawn', f, 1, 1); }); piece('pawn', 4, 3, 1);
  piece('knight', 5, 2, 1, 'hero');
  [['rook', 0], ['bishop', 2], ['queen', 3], ['king', 4], ['bishop', 5], ['knight', 6], ['rook', 7]].forEach(function (p) { piece(p[0], p[1], 7, -1); });
  piece('knight', 2, 5, -1);
  [0, 1, 2, 3, 5, 6, 7].forEach(function (f) { piece('pawn', f, 6, -1); });
  piece('pawn', 3, 3, -1, 'prey');
  var COUNT = { pawn: 380, rook: 520, knight: 700, bishop: 580, queen: 700, king: 740 }, HERO, PREY;
  SET.forEach(function (p, i) {
    p.cloud = cloud(p.type, cnt(p.role === 'hero' ? 7000 : p.role === 'prey' ? 4200 : COUNT[p.type]), 100 + i);
    // o cavalo herói encara o peão que vai capturar; as outras peças encaram o adversário
    p.face = p.role === 'hero' ? Q.axis(0, 1, 0, Math.atan2(-DIR[1], DIR[0])) : Q.axis(0, 1, 0, p.side > 0 ? PI / 2 : -PI / 2);
    if (p.role === 'hero') HERO = p; if (p.role === 'prey') PREY = p;
  });

  // ---------- Cacos: o tabuleiro dividido em células de Voronoi, mais miúdas perto da batida ----------
  var NS = 48, SHARD0 = SET.length + 1, seeds = [];
  (function () {
    var r = rng(31), i = 0, guard = 0;
    while (seeds.length < 16 && guard++ < 999) { var a = r() * 2 * PI, d = 0.25 + r() * 2.3, x = B5[0] + Math.cos(a) * d, z = B5[1] + Math.sin(a) * d; if (Math.abs(x) < 4 && Math.abs(z) < 4) seeds.push([x, z]); }
    while (seeds.length < NS && guard++ < 9999) {
      var c = [(r() - 0.5) * 8.2, (r() - 0.5) * 8.2], ok = true;
      for (i = 0; i < seeds.length; i++) if (Math.hypot(seeds[i][0] - c[0], seeds[i][1] - c[1]) < 0.95) { ok = false; break; }
      if (ok) seeds.push(c);
    }
    while (seeds.length < NS) seeds.push([(r() - 0.5) * 8, (r() - 0.5) * 8]);
  })();
  function nearest(x, z) {   // [caco mais perto, segundo mais perto]
    var b1 = 0, d1 = 1e9, b2 = 0, d2 = 1e9;
    for (var i = 0; i < NS; i++) { var d = (seeds[i][0] - x) * (seeds[i][0] - x) + (seeds[i][1] - z) * (seeds[i][1] - z); if (d < d1) { b2 = b1; d2 = d1; b1 = i; d1 = d; } else if (d < d2) { b2 = i; d2 = d; } }
    return [b1, b2];
  }
  // Pontos fixos do tabuleiro: [x, z, caco, tipo] onde tipo é 0 casa escura, 1 casa clara, 2 moldura, 3 linha de rachadura
  var GL = Math.max(6, Math.round(14 * Math.sqrt(E.K))), GD = Math.max(3, Math.round(6 * Math.sqrt(E.K))), board = [];
  (function () {
    var r = rng(9), rk, f, a, b, k, kn;
    for (rk = 0; rk < 8; rk++) for (f = 0; f < 8; f++) {
      var c = sq(f, rk), light = (f + rk) % 2 === 1, g = light ? GL : GD;
      for (a = 0; a < g; a++) for (b = 0; b < g; b++) { var x = c[0] + ((a + 0.5) / g - 0.5) * 0.94, z = c[1] + ((b + 0.5) / g - 0.5) * 0.94; board.push([x, z, nearest(x, z)[0], light ? 1 : 0]); }
    }
    for (var e = 0; e < 4; e++) for (k = 0, kn = cnt(120); k < kn; k++) {
      var u = (k / kn - 0.5) * 8.3, fx = e < 2 ? u : (e === 2 ? -4.15 : 4.15), fz = e < 2 ? (e === 0 ? -4.15 : 4.15) : u;
      board.push([fx, fz, nearest(fx, fz)[0], 2]);
    }
    for (k = 0, kn = cnt(2600); k < kn; k++) {   // linhas de rachadura: pontos levados para a fronteira entre dois cacos
      var px = (r() - 0.5) * 8.3, pz = (r() - 0.5) * 8.3, nn = nearest(px, pz), s1 = seeds[nn[0]], s2 = seeds[nn[1]];
      var nx = s2[0] - s1[0], nz = s2[1] - s1[1], nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      var off = (px - (s1[0] + s2[0]) / 2) * nx + (pz - (s1[1] + s2[1]) / 2) * nz;
      px -= nx * off * 1.02; pz -= nz * off * 1.02;
      if (Math.abs(px) > 4.15 || Math.abs(pz) > 4.15) { k--; continue; }
      board.push([px, pz, nn[0], 3]);
    }
  })();
  var nBoard = board.length, nSparks = cnt(1500);

  // ---------- Poses: onde está e como está girado cada grupo em cada momento ----------
  // Um estado é uma lista de poses { p: [x, y, z], q: quatérnio } indexada pelo número do grupo.
  var states = {}, rigs = {};
  (function () {
    var base = [], g;
    SET.forEach(function (p) { var at = sq(p.f, p.r); base[p.id] = { p: [at[0], 0, at[1]], q: p.face }; });
    for (g = 0; g < NS; g++) base[SHARD0 + g] = { p: [seeds[g][0], 0, seeds[g][1]], q: Q.id };
    states.up = base;
    // changes: { idDoGrupo: { p, spin: [eixo, ângulo], lift } }; quem não aparece fica parado
    function step(from, to, changes) {
      var prev = states[from], next = [], rig = new Float32Array(E.GROUPS * 16);
      for (var id = 1; id < prev.length; id++) {
        var c = changes[id], a = prev[id];
        if (!c) { next[id] = a; E.rigRow(rig, id, a.p, a.p, [0, 1, 0], 0, 0); continue; }
        var sp = c.spin || [[0, 1, 0], 0], pb = c.p || a.p;
        next[id] = { p: pb, q: Q.mul(Q.axis(sp[0][0], sp[0][1], sp[0][2], sp[1]), a.q) };
        E.rigRow(rig, id, a.p, pb, sp[0], sp[1], c.lift || 0);
      }
      states[to] = next; rigs[to] = rig;
    }
    var ch = {}, r = rng(57);
    // recua: o cavalo inclina para trás e toma impulso
    ch = {}; ch[HERO.id] = { p: [F3[0] - DIR[0] * 0.16, 0, F3[1] - DIR[1] * 0.16], spin: [TIP, -0.3] };
    step('up', 'coil', ch);
    // mergulho: salta e chega inclinado para a frente, no instante do contato
    ch = {}; ch[HERO.id] = { p: [D4[0] - DIR[0] * 0.6, 0.26, D4[1] - DIR[1] * 0.6], spin: [TIP, 0.72], lift: 0.85 };
    step('coil', 'hit', ch);
    // arremesso: o cavalo pousa na casa; o peão sai girando pelo ar, na mesma linha
    ch = {}; ch[HERO.id] = { p: [D4[0], 0, D4[1]], spin: [TIP, -0.42] };
    ch[PREY.id] = { p: [(D4[0] + B5[0]) / 2, 1.75, (D4[1] + B5[1]) / 2], spin: [TIP, 3.4] };
    step('hit', 'throw', ch);
    // batida: o peão desce e bate de lado na casa b5
    ch = {}; ch[PREY.id] = { p: [B5[0], 0.32, B5[1]], spin: [TIP, 4.45] };
    step('throw', 'slam', ch);
    // rachadura: cada caco inclina um nada, como um espelho trincado
    ch = {};
    for (g = 0; g < NS; g++) { var an = r() * 2 * PI; ch[SHARD0 + g] = { p: [seeds[g][0], (r() - 0.5) * 0.05, seeds[g][1]], spin: [[Math.cos(an), 0, Math.sin(an)], (r() - 0.5) * 0.09] }; }
    step('slam', 'crack', ch);
    // estilhaço: cacos e peças despencam girando; quem está mais longe da batida demora mais (ver fx "shatter")
    ch = {};
    function fall(id, x, z, depth, turns) {
      var ax = r() * 2 * PI, out = Math.hypot(x - B5[0], z - B5[1]) || 1;
      ch[id] = { p: [x + (x - B5[0]) / out * (0.3 + r() * 1.1), -depth, z + (z - B5[1]) / out * (0.3 + r() * 1.1)], spin: [[Math.cos(ax), (r() - 0.5) * 0.6, Math.sin(ax)].map(function (v, i, arr) { return v / Math.hypot(arr[0], arr[1], arr[2]); }), turns] };
    }
    for (g = 0; g < NS; g++) fall(SHARD0 + g, seeds[g][0], seeds[g][1], 7 + r() * 9, (r() < 0.5 ? 1 : -1) * (2 + r() * 4));
    SET.forEach(function (p) { var a = states.crack[p.id].p; fall(p.id, a[0], a[2], 8 + r() * 7, (r() < 0.5 ? 1 : -1) * (1.5 + r() * 2.5)); });
    ch[PREY.id] = { p: [B5[0] + DIR[0] * 0.5, -6.5, B5[1] + DIR[1] * 0.5], spin: [TIP, 3.2] };
    step('crack', 'shatter', ch);
  })();
  E.chess = { F3: F3, D4: D4, B5: B5, DIR: DIR };

  // ---------- Montagem de uma cena a partir de um estado ----------
  var L1 = [0.34, 0.585, -0.737], L2 = [0.3, 0.7, 0.648];   // luz do close e luz do plano aberto
  var gid = new Uint8Array(N), ready = false;               // grupo de cada ponto (o mesmo em todas as cenas do xadrez)
  // opts: flat (peças deitadas), sparks 0 escondidas | 1 jato dourado do golpe | 2 anel da batida | 3 apagando, crack, fallen, dust
  function build(stateName, opts) {
    var s = new E.Shape(), poses = states[stateName], r = rng(9), i, k, m, x, y, z;
    var facet = [], fr = rng(77); for (i = 0; i < NS; i++) facet.push(0.65 + fr() * 0.8);
    // tabuleiro (cada ponto acompanha o seu caco)
    var mats = [], last = -1;
    for (i = 0; i < NS; i++) mats.push(Q.mat(poses[SHARD0 + i].q));
    for (i = 0; i < nBoard; i++) {
      var b = board[i], sd = seeds[b[2]], ps = poses[SHARD0 + b[2]]; m = mats[b[2]];
      var lx = b[0] - sd[0], lz = b[1] - sd[1];
      x = ps.p[0] + m[0] * lx + m[2] * lz; y = ps.p[1] + m[3] * lx + m[5] * lz; z = ps.p[2] + m[6] * lx + m[8] * lz;
      var fk = opts.crack ? facet[b[2]] : 1, dimk = opts.fallen ? 0.7 : 1;
      if (b[3] === 3) s.put(x, y, z, 1, opts.crack ? 1.5 * dimk : 0);
      else if (b[3] === 2) s.put(x, y, z, 0.9, dimk);
      else if (b[3] === 1) s.put(x, y, z, 0.5, 0.7 * fk * dimk);
      else s.put(x, y, z, 0.07, 0.6 * fk * dimk);
      gid[i] = SHARD0 + b[2];
    }
    // peças
    SET.forEach(function (p) {
      var cl = p.cloud, ps = poses[p.id], mm = Q.mat(ps.q), up = opts.flat ? 0.012 : 1;
      for (var j = 0; j < cl.n; j++) {
        var lx = cl.p[j * 3], ly = cl.p[j * 3 + 1] * up, lz = cl.p[j * 3 + 2], nx = cl.q[j * 3], ny = cl.q[j * 3 + 1], nz = cl.q[j * 3 + 2];
        var wx = mm[0] * nx + mm[1] * ny + mm[2] * nz, wy = mm[3] * nx + mm[4] * ny + mm[5] * nz, wz = mm[6] * nx + mm[7] * ny + mm[8] * nz;
        var lit = Math.min(1, 0.8 * Math.max(0, wx * L1[0] + wy * L1[1] + wz * L1[2]) + 0.42 * Math.max(0, wx * L2[0] + wy * L2[1] + wz * L2[2]));
        lit = Math.pow(lit, 1.3);
        // brancas na cor principal, douradas na cor do contraponto, com sombra de verdade no lado oposto à luz
        gid[s.n] = p.id;
        s.put(ps.p[0] + mm[0] * lx + mm[1] * ly + mm[2] * lz, ps.p[1] + mm[3] * lx + mm[4] * ly + mm[5] * lz, ps.p[2] + mm[6] * lx + mm[7] * ly + mm[8] * lz,
          p.side > 0 ? 0.12 + 0.88 * lit : 2.05 + 0.95 * lit, (opts.flat ? 0.55 : 1) * (opts.fallen ? 0.75 : 1));
      }
    });
    // faíscas
    var hit = [D4[0] - DIR[0] * 0.3, 0.75, D4[1] - DIR[1] * 0.3];
    for (k = 0; k < nSparks; k++) {
      var u = r(), v = r(), w = r(), a = v * 2 * PI;
      if (opts.sparks === 1) {            // jato na direção do golpe
        var d = 0.4 + Math.pow(u, 0.7) * 2.8, sp = d * 0.42 * Math.sqrt(w);
        s.put(hit[0] + DIR[0] * d + Math.cos(a) * sp * -DIR[1], hit[1] + Math.abs(Math.sin(a)) * sp * 0.9 + d * 0.12, hit[2] + DIR[1] * d + Math.cos(a) * sp * DIR[0], 2.55 + w * 0.45, 1.25);
      } else if (opts.sparks === 2) {     // anel rasteiro em volta da batida
        var rad = 0.35 + Math.pow(u, 0.6) * 1.9;
        s.put(B5[0] + Math.cos(a) * rad, 0.04 + w * w * 0.55, B5[1] + Math.sin(a) * rad, k % 3 ? 0.85 + w * 0.15 : 2.8, 1.15);
      } else if (opts.sparks === 3) {
        var rd = 1.2 + u * 3.4; s.put(B5[0] + Math.cos(a) * rd, (opts.fallen ? -3 - w * 6 : 0.05 + w * 0.3), B5[1] + Math.sin(a) * rd, 0.4, opts.fallen ? 0.12 : 0.35);
      } else s.put(hit[0], hit[1], hit[2], 0, 0);
    }
    // poeira de luz no ar
    while (s.n < N) {
      if (opts.dust) { s.put((r() - 0.5) * 13, 0.3 + r() * 5, (r() - 0.5) * 13, r() < 0.08 ? -1 : 0.2 + r() * 0.45, 0.5); s.flowLast(0, 1.6, 0, r()); }
      else s.put((r() - 0.5) * 8, 0, (r() - 0.5) * 8, 0.1, 0.5);
    }
    ready = true;
    return s;
  }
  function layout() { if (!ready) E.need('boardUp'); }

  // ---------- Cenas ----------
  var close = { size: 0.034, gain: 0.66, vary: 0.6, dof: 0.3 };
  function scene(name, state, opts, look, cam) { E.scene(name, { make: function () { return build(state, opts); }, size: look.size, gain: look.gain, vary: look.vary, dof: look.dof, cam: cam }); }
  scene('boardFlat', 'up', { flat: true, sparks: 0 }, { size: 0.05, gain: 0.95, vary: 0.2, dof: 0.05 }, { az: 36, el: 33, r: 17, t: [0, 0, 0], ox: 0.1 });
  scene('boardUp', 'up', { sparks: 0, dust: true }, { size: 0.046, gain: 0.74, vary: 0.6, dof: 0.06 }, { az: 108, el: 23, r: 14.5, t: [0, 0.5, 0], ox: 0.08 });
  E.scene('boardClose', { make: function () { return E.need('boardUp'); }, size: close.size, gain: close.gain, vary: close.vary, dof: close.dof, cam: { az: 148, el: 9, r: 5.6, t: [0.5, 0.8, 1.0], ox: 0.06 } });
  scene('boardCoil', 'coil', { sparks: 0, dust: true }, close, { az: 148, el: 9, r: 5.2, t: [0.6, 0.8, 1.05], ox: 0.06 });
  scene('boardHit', 'hit', { sparks: 0, dust: true }, close, { az: 146, el: 10, r: 5.0, t: [-0.1, 0.85, 0.7], ox: 0.06 });
  scene('boardThrow', 'throw', { sparks: 1, dust: true }, close, { az: 142, el: 12, r: 6.4, t: [-1.3, 1.0, 0.1], ox: 0.05 });
  scene('boardSlam', 'slam', { sparks: 2, dust: true }, close, { az: 140, el: 16, r: 6.2, t: [B5[0] + 0.7, 0.5, B5[1] + 0.35], ox: 0.05 });
  scene('boardCrack', 'crack', { sparks: 3, crack: true, dust: true }, { size: 0.044, gain: 0.8, vary: 0.4, dof: 0.05 }, { az: 160, el: 54, r: 13.5, t: [-0.6, 0, -0.2], ox: 0.07 });
  scene('boardShatter', 'shatter', { sparks: 3, crack: true, fallen: true, dust: true }, { size: 0.05, gain: 0.7, vary: 0.6, dof: 0.1 }, { az: 172, el: 76, r: 5.5, t: [B5[0], -5.2, B5[1]], ox: 0 });

  // ---------- Papéis dos pontos em cada passagem ----------
  // a baseplate é redesenhada em tabuleiro por uma frente que cruza da esquerda para a direita
  E.fx('sweep', function () {
    var a = new Float32Array(N * 4), to = E.need('boardFlat').pos;
    for (var i = 0; i < N; i++) { a[i * 4] = clamp((to[i * 3] + 4.2) / 8.4, 0, 1); a[i * 4 + 2] = 0.15; }
    return a;
  });
  // as peças sobem em onda, das brancas para as douradas
  E.fx('rise', function () {
    layout(); var a = new Float32Array(N * 4), r = rng(8), delay = [];
    SET.forEach(function (p) { delay[p.id] = clamp(p.r / 7 * 0.7 + (p.f / 7) * 0.12 + r() * 0.08, 0, 1); });
    for (var i = 0; i < N; i++) { var g = gid[i]; if (g && g < SHARD0) a[i * 4] = delay[g]; else if (!g) { a[i * 4] = 0.5 + r() * 0.5; a[i * 4 + 2] = 0.3; } }
    return a;
  });
  // movimento rígido: cada peça e cada caco gira e viaja inteiro; delay(g) dá o atraso de cada grupo
  function rigid(delay, loose) {
    return function () {
      layout(); var a = new Float32Array(N * 4), r = rng(18), d = [];
      for (var g = 1; g < SHARD0 + NS; g++) d[g] = delay ? delay(g, r) : 0;
      for (var i = 0; i < N; i++) { var q = gid[i]; if (q) { a[i * 4] = d[q]; a[i * 4 + 3] = q; } else { a[i * 4] = r() * (loose || 0); a[i * 4 + 2] = 0.25; } }
      return a;
    };
  }
  function far(g) { var p = states.crack[g].p; return clamp(Math.hypot(p[0] - B5[0], p[2] - B5[1]) / 8.5, 0, 1); }
  E.fx('rigid', rigid());
  E.fx('burst', rigid(null, 0.25));                                   // faíscas saem logo, cada uma no seu tempo
  E.fx('cracks', rigid(function (g) { return far(g); }, 0.4));        // a rachadura corre a partir da batida
  E.fx('shatter', rigid(function (g) { return g === PREY.id ? 0 : 0.08 + far(g) * 0.7; }, 0.5));
  ['coil', 'hit', 'throw', 'slam', 'crack', 'shatter'].forEach(function (k) { E.rig(k, function () { return rigs[k]; }); });
});
