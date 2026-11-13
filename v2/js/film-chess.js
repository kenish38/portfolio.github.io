// ===== Cenas do xadrez =====
//   boardFlat    a baseplate vira tabuleiro; as peças ainda estão debaixo dele
//   boardUp      as peças surgiram do chão (partida em andamento) | boardClose: a mesma cena, com o acabamento do close
//   boardLift    o cavalo é erguido da casa
//   boardStrike  o cavalo desce e bate na casa do peão
//   boardTopple  o peão tomba e cai de lado no tabuleiro
//   boardCrack   o tabuleiro racha como um espelho a partir do ponto da queda
//   boardShatter os cacos e as peças despencam
// Cada peça e cada caco do tabuleiro é um "grupo rígido": gira e se desloca inteiro (ver rigRow em matter.js).
// A ordem dos pontos é a mesma em todas as cenas, daqui até a HUD (film-gun.js continua a partir dela):
//   A tabuleiro e rachaduras | BC as peças, menos o peão capturado | D o peão capturado | EF faíscas e poeira
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
  var TALL = { pawn: 1.0, rook: 1.17, knight: 1.45, bishop: 1.5, queen: 1.76, king: 2.08 };
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

  // ---------- A partida ----------
  // Abertura Escocesa, logo antes de Cxd4. Casa = [coluna, fileira], de 0 a 7.
  // O cavalo (f3) captura o peão (d4): bate na casa, o peão tomba para a frente e é a queda dele que racha o tabuleiro.
  function sq(f, rk) { return [f - 3.5, 3.5 - rk]; }
  var F3 = sq(5, 2), D4 = sq(3, 3);
  var dl = Math.hypot(D4[0] - F3[0], D4[1] - F3[1]), DIR = [(D4[0] - F3[0]) / dl, (D4[1] - F3[1]) / dl];   // direção do golpe, no plano
  var TIP = [DIR[1], 0, -DIR[0]];        // girar em torno deste eixo tomba a peça para a frente, na direção do golpe
  var IMP = [D4[0] + DIR[0] * 1.75, D4[1] + DIR[1] * 1.75];   // onde o peão bate no tabuleiro
  var LAND = 0.7;                        // o cavalo pousa encostado no peão, a esta distância do centro da casa
  var SET = [];
  function piece(type, f, rk, side, role) { SET.push({ type: type, f: f, r: rk, side: side, role: role || '', id: SET.length + 1 }); }
  [['rook', 0], ['knight', 1], ['bishop', 2], ['queen', 3], ['king', 4], ['bishop', 5], ['rook', 7]].forEach(function (p) { piece(p[0], p[1], 0, 1); });
  [0, 1, 2, 5, 6, 7].forEach(function (f) { piece('pawn', f, 1, 1); }); piece('pawn', 4, 3, 1);
  piece('knight', 5, 2, 1, 'hero');
  [['rook', 0], ['bishop', 2], ['queen', 3], ['king', 4], ['bishop', 5], ['knight', 6], ['rook', 7]].forEach(function (p) { piece(p[0], p[1], 7, -1); });
  piece('knight', 2, 5, -1);
  [0, 1, 2, 3, 5, 6, 7].forEach(function (f) { piece('pawn', f, 6, -1); });
  piece('pawn', 3, 3, -1, 'prey');       // o peão capturado é sempre a última peça (film-gun.js conta com isso)
  var COUNT = { pawn: 380, rook: 520, knight: 700, bishop: 580, queen: 700, king: 740 }, HERO, PREY, nBC = 0;
  SET.forEach(function (p, i) {
    p.cloud = cloud(p.type, cnt(p.role === 'hero' ? 7000 : p.role === 'prey' ? 4200 : COUNT[p.type]), 100 + i);
    // o cavalo herói encara o peão que vai capturar; as outras peças encaram o adversário
    p.face = p.role === 'hero' ? Q.axis(0, 1, 0, Math.atan2(-DIR[1], DIR[0])) : Q.axis(0, 1, 0, p.side > 0 ? PI / 2 : -PI / 2);
    if (p.role === 'hero') HERO = p;
    if (p.role === 'prey') PREY = p; else nBC += p.cloud.n;
  });

  // ---------- Cacos: o tabuleiro dividido em células de Voronoi, mais miúdas perto da queda ----------
  var NS = 48, SHARD0 = SET.length + 1, seeds = [];
  (function () {
    var r = rng(31), i = 0, guard = 0;
    while (seeds.length < 16 && guard++ < 999) { var a = r() * 2 * PI, d = 0.25 + r() * 2.3, x = IMP[0] + Math.cos(a) * d, z = IMP[1] + Math.sin(a) * d; if (Math.abs(x) < 4 && Math.abs(z) < 4) seeds.push([x, z]); }
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
  var nBoard = board.length, nSparks = cnt(1500), nD = PREY.cloud.n, nEF = N - nBoard - nBC - nD;

  // ---------- Poses: onde está e como está girado cada grupo em cada momento ----------
  // Um estado é uma lista de poses { p: [x, y, z], q: quatérnio } indexada pelo número do grupo.
  var states = {}, rigs = {};
  // changes: { idDoGrupo: { p, spin: [eixo, ângulo], lift, pivot, move } }; quem não aparece fica parado.
  // Com "pivot", o grupo gira em torno desse ponto (e não da própria base), que ainda se desloca de "move".
  function step(from, to, changes) {
    var prev = states[from], next = [], rig = new Float32Array(E.GROUPS * 16);
    for (var id = 1; id < prev.length; id++) {
      var c = changes[id], a = prev[id];
      if (!c) { next[id] = a; E.rigRow(rig, id, a.p, a.p, [0, 1, 0], 0, 0); continue; }
      var sp = c.spin || [[0, 1, 0], 0], qs = Q.axis(sp[0][0], sp[0][1], sp[0][2], sp[1]), pa = a.p, pb = c.p || a.p, np = pb;
      if (c.pivot) {
        pa = c.pivot; pb = [pa[0] + (c.move ? c.move[0] : 0), pa[1] + (c.move ? c.move[1] : 0), pa[2] + (c.move ? c.move[2] : 0)];
        var rel = Q.rot(qs, [a.p[0] - pa[0], a.p[1] - pa[1], a.p[2] - pa[2]]); np = [pb[0] + rel[0], pb[1] + rel[1], pb[2] + rel[2]];
      }
      next[id] = { p: np, q: Q.mul(qs, a.q) };
      E.rigRow(rig, id, pa, pb, sp[0], sp[1], c.lift || 0);
    }
    states[to] = next; rigs[to] = rig;
    E.rig(to, function () { return rig; });
    return rig;
  }
  (function () {
    var base = [], under = [], g;
    SET.forEach(function (p) { var at = sq(p.f, p.r); base[p.id] = { p: [at[0], 0, at[1]], q: p.face }; under[p.id] = { p: [at[0], -(TALL[p.type] + 0.12), at[1]], q: p.face }; });
    for (g = 0; g < NS; g++) under[SHARD0 + g] = base[SHARD0 + g] = { p: [seeds[g][0], 0, seeds[g][1]], q: Q.id };
    states.up = base; states.under = under;
    var ch = {}, r = rng(57);
    // o cavalo é erguido da casa, com uma leve inclinação para a frente
    ch = {}; ch[HERO.id] = { p: [F3[0], 0.6, F3[1]], spin: [TIP, 0.14] };
    step('up', 'lift', ch);
    // desce em arco e bate ao lado do peão, de pé
    ch = {}; ch[HERO.id] = { p: [D4[0] - DIR[0] * LAND, 0, D4[1] - DIR[1] * LAND], spin: [TIP, -0.14], lift: 0.45 };
    step('lift', 'strike', ch);
    // o cavalo toma a casa; o peão tomba para a frente, girando sobre a borda da própria base, e cai de lado
    ch = {}; ch[HERO.id] = { p: [D4[0], 0, D4[1]] };
    ch[PREY.id] = { pivot: [D4[0] + DIR[0] * 0.33, 0, D4[1] + DIR[1] * 0.33], move: [DIR[0] * 0.75, 0, DIR[1] * 0.75], spin: [TIP, 1.72] };
    step('strike', 'topple', ch);
    // rachadura: cada caco inclina um nada, como um espelho trincado
    ch = {};
    for (g = 0; g < NS; g++) { var an = r() * 2 * PI; ch[SHARD0 + g] = { p: [seeds[g][0], (r() - 0.5) * 0.05, seeds[g][1]], spin: [[Math.cos(an), 0, Math.sin(an)], (r() - 0.5) * 0.09] }; }
    step('topple', 'crack', ch);
    // estilhaço: cacos e peças despencam girando; quem está mais longe da queda demora mais (ver fx "shatter")
    ch = {};
    function fall(id, x, z, depth, turns) {
      var ax = r() * 2 * PI, out = Math.hypot(x - IMP[0], z - IMP[1]) || 1, v = [Math.cos(ax), (r() - 0.5) * 0.6, Math.sin(ax)], vl = Math.hypot(v[0], v[1], v[2]);
      ch[id] = { p: [x + (x - IMP[0]) / out * (0.3 + r() * 1.1), -depth, z + (z - IMP[1]) / out * (0.3 + r() * 1.1)], spin: [[v[0] / vl, v[1] / vl, v[2] / vl], turns] };
    }
    for (g = 0; g < NS; g++) fall(SHARD0 + g, seeds[g][0], seeds[g][1], 5 + r() * 9, (r() < 0.5 ? 1 : -1) * (2 + r() * 4));
    SET.forEach(function (p) { var a = states.crack[p.id].p; fall(p.id, a[0], a[2], 9 + r() * 8, (r() < 0.5 ? 1 : -1) * (1.5 + r() * 2.5)); });
    var lying = states.crack[PREY.id].p;
    ch[PREY.id] = { p: [lying[0] + DIR[0] * 0.3, -3.2, lying[2] + DIR[1] * 0.3], spin: [TIP, 1.3] };
    step('crack', 'shatter', ch);
  })();

  // ---------- Escrita dos pontos ----------
  var L1 = [0.34, 0.585, -0.737], L2 = [0.3, 0.7, 0.648];   // luz do close e luz do plano aberto
  var gid = new Uint8Array(N), ready = false;               // grupo de cada ponto do tabuleiro e das peças
  var facet = [], fr = rng(77); for (var fi = 0; fi < NS; fi++) facet.push(0.65 + fr() * 0.8);
  // tabuleiro: cada ponto acompanha o seu caco. look: { crack: rachaduras acesas, k: brilho }
  function writeBoard(s, poses, look) {
    var mats = [], i, m, k = look.k === undefined ? 1 : look.k;
    for (i = 0; i < NS; i++) mats.push(Q.mat(poses[SHARD0 + i].q));
    for (i = 0; i < nBoard; i++) {
      var b = board[i], sd = seeds[b[2]], ps = poses[SHARD0 + b[2]]; m = mats[b[2]];
      var lx = b[0] - sd[0], lz = b[1] - sd[1], x = ps.p[0] + m[0] * lx + m[2] * lz, y = ps.p[1] + m[3] * lx + m[5] * lz, z = ps.p[2] + m[6] * lx + m[8] * lz;
      var fk = look.crack ? facet[b[2]] : 1;
      gid[s.n] = SHARD0 + b[2];
      if (b[3] === 3) s.put(x, y, z, 1, look.crack ? 1.5 * k : 0);
      else if (b[3] === 2) s.put(x, y, z, 0.9, k);
      else if (b[3] === 1) s.put(x, y, z, 0.5, 0.7 * fk * k);
      else s.put(x, y, z, 0.07, 0.6 * fk * k);
    }
  }
  // uma peça na pose dada, com luz e sombra. k: brilho
  function writePiece(s, p, ps, k) {
    var cl = p.cloud, mm = Q.mat(ps.q); k = k === undefined ? 1 : k;
    for (var j = 0; j < cl.n; j++) {
      var lx = cl.p[j * 3], ly = cl.p[j * 3 + 1], lz = cl.p[j * 3 + 2], nx = cl.q[j * 3], ny = cl.q[j * 3 + 1], nz = cl.q[j * 3 + 2];
      var wx = mm[0] * nx + mm[1] * ny + mm[2] * nz, wy = mm[3] * nx + mm[4] * ny + mm[5] * nz, wz = mm[6] * nx + mm[7] * ny + mm[8] * nz;
      var lit = Math.min(1, 0.8 * Math.max(0, wx * L1[0] + wy * L1[1] + wz * L1[2]) + 0.42 * Math.max(0, wx * L2[0] + wy * L2[1] + wz * L2[2]));
      lit = Math.pow(lit, 1.3);
      gid[s.n] = p.id;
      // brancas na cor principal, douradas na cor do contraponto, com sombra de verdade no lado oposto à luz
      s.put(ps.p[0] + mm[0] * lx + mm[1] * ly + mm[2] * lz, ps.p[1] + mm[3] * lx + mm[4] * ly + mm[5] * lz, ps.p[2] + mm[6] * lx + mm[7] * ly + mm[8] * lz, p.side > 0 ? 0.12 + 0.88 * lit : 2.05 + 0.95 * lit, k);
    }
  }
  // opts: sparks 0 escondidas | 1 anel da batida do cavalo | 4 recolhidas, apagadas, onde o peão vai cair | 2 jorro da queda do peão | 3 apagando; crack; fallen; dust
  function build(stateName, opts) {
    var s = new E.Shape(), poses = states[stateName], r = rng(9), k;
    writeBoard(s, poses, { crack: opts.crack, k: opts.fallen ? 0.7 : 1 });
    SET.forEach(function (p) { writePiece(s, p, poses[p.id], opts.fallen && p !== PREY ? 0.35 : 1); });
    for (k = 0; k < nSparks; k++) {
      var u = r(), v = r(), w = r(), a = v * 2 * PI;
      if (opts.sparks === 1) { var r1 = 0.3 + Math.pow(u, 0.6) * 1.3; s.put(D4[0] - DIR[0] * LAND + Math.cos(a) * r1, 0.03 + w * w * 0.35, D4[1] - DIR[1] * LAND + Math.sin(a) * r1, 0.8 + w * 0.2, 1.1); }
      else if (opts.sparks === 2) {   // metade num anel rasteiro, metade num jorro para cima
        if (k % 2) { var r2 = 0.3 + Math.pow(u, 0.6) * 2.4; s.put(IMP[0] + Math.cos(a) * r2, 0.03 + w * w * 0.4, IMP[1] + Math.sin(a) * r2, 0.85 + w * 0.15, 1.15); }
        else { var up = Math.pow(u, 0.8) * 2.2, sp = 0.15 + up * 0.45 * Math.sqrt(w); s.put(IMP[0] + Math.cos(a) * sp, 0.1 + up, IMP[1] + Math.sin(a) * sp, 2.6 + w * 0.4, 1.25); }
      } else if (opts.sparks === 3) { var rd = 1.2 + u * 3.4; s.put(IMP[0] + Math.cos(a) * rd, opts.fallen ? -3 - w * 6 : 0.05 + w * 0.3, IMP[1] + Math.sin(a) * rd, 0.4, opts.fallen ? 0.12 : 0.35); }
      else if (opts.sparks === 4) s.put(IMP[0] + Math.cos(a) * u * 0.2, 0.03, IMP[1] + Math.sin(a) * u * 0.2, 0, 0);
      else s.put(D4[0], 0.02, D4[1], 0, 0);
    }
    while (s.n < N) {   // poeira de luz no ar
      if (opts.dust) { s.put((r() - 0.5) * 13, 0.3 + r() * 5, (r() - 0.5) * 13, r() < 0.08 ? -1 : 0.2 + r() * 0.45, 0.5); s.flowLast(0, 1.6, 0, r()); }
      else s.put((r() - 0.5) * 8, 0.02, (r() - 0.5) * 8, 0.1, 0.5);
    }
    ready = true;
    return s;
  }
  function layout() { if (!ready) E.need('boardUp'); }
  // O que as cenas seguintes (film-gun.js) precisam para continuar com os mesmos pontos
  E.chess = {
    SET: SET, HERO: HERO, PREY: PREY, SHARD0: SHARD0, NS: NS, seeds: seeds, states: states, step: step, gid: gid, layout: layout,
    DIR: DIR, TIP: TIP, D4: D4, IMP: IMP, nA: nBoard, nBC: nBC, nD: nD, nEF: nEF, writeBoard: writeBoard, writePiece: writePiece, cloud: cloud
  };

  // ---------- Cenas ----------
  // stateOf diz em que pose estão as peças em cada cena (film-gun.js acrescenta as dele)
  var close = { size: 0.034, gain: 0.66, vary: 0.6, dof: 0.3 }, stateOf = { wave: 'up', plate: 'up', boardClose: 'up' };
  function scene(name, state, opts, look) { stateOf[name] = state; E.scene(name, { make: function () { return build(state, opts); }, size: look.size, gain: look.gain, vary: look.vary, dof: look.dof }); }
  scene('boardFlat', 'under', { sparks: 0 }, { size: 0.05, gain: 0.95, vary: 0.2, dof: 0.05 });
  scene('boardUp', 'up', { sparks: 0, dust: true }, { size: 0.046, gain: 0.74, vary: 0.6, dof: 0.06 });
  E.scene('boardClose', { make: function () { return E.need('boardUp'); }, size: close.size, gain: close.gain, vary: close.vary, dof: close.dof });
  scene('boardLift', 'lift', { sparks: 0, dust: true }, close);
  scene('boardStrike', 'strike', { sparks: 1, dust: true }, close);
  scene('boardTopple', 'topple', { sparks: 4, dust: true }, close);
  scene('boardCrack', 'crack', { sparks: 2, crack: true, dust: true }, { size: 0.044, gain: 0.8, vary: 0.4, dof: 0.05 });
  scene('boardShatter', 'shatter', { sparks: 3, crack: true, fallen: true, dust: true }, { size: 0.046, gain: 0.72, vary: 0.6, dof: 0.12 });

  // ---------- Assuntos da câmera (os planos ficam na lista "shots" de main.js) ----------
  // O meio de uma peça na cena dada; a câmera acompanha a peça inteira, no mesmo movimento rígido dos pontos dela.
  function centre(sc, p, h) {
    var ps = (states[stateOf[sc]] || states.fallHit || states.shatter)[p.id], v = Q.rot(ps.q, [0, h, 0]);
    return [ps.p[0] + v[0], ps.p[1] + v[1], ps.p[2] + v[2]];
  }
  var DUEL = [(F3[0] + D4[0]) / 2, 0.7, (F3[1] + D4[1]) / 2], HITS = [IMP[0], 0, IMP[1]];
  E.subject('board', { at: function () { return [0, 0, 0]; } });
  E.subject('duel', { at: function () { return DUEL; } });                 // entre o cavalo e o peão
  E.subject('impact', { at: function () { return HITS; } });               // onde o peão bate no tabuleiro
  E.subject('hero', { group: HERO.id, at: function (sc) { return centre(sc, HERO, 0.8); } });
  E.subject('prey', { group: PREY.id, delay: { shatter: -1 }, at: function (sc) { return centre(sc, PREY, 0.5); } });
  E.chess.stateOf = stateOf;

  // ---------- Papéis dos pontos em cada passagem ----------
  // a baseplate é redesenhada em tabuleiro por uma frente que cruza da esquerda para a direita
  E.fx('sweep', function () {
    var a = new Float32Array(N * 4), to = E.need('boardFlat').pos;
    for (var i = 0; i < N; i++) { a[i * 4] = clamp((to[i * 3] + 4.2) / 8.4, 0, 1); a[i * 4 + 2] = 0.15; }
    return a;
  });
  // as peças surgem do chão em onda, das brancas para as douradas
  E.fx('rise', function () {
    layout(); var a = new Float32Array(N * 4), r = rng(8), delay = [];
    SET.forEach(function (p) { delay[p.id] = clamp(p.r / 7 * 0.7 + (p.f / 7) * 0.12 + r() * 0.08, 0, 1); });
    for (var i = 0; i < N; i++) { var g = gid[i]; if (g && g < SHARD0) a[i * 4] = delay[g]; else if (i >= nBoard + nBC + nD) { a[i * 4] = 0.5 + r() * 0.5; a[i * 4 + 2] = 0.3; } }
    return a;
  });
  // movimento rígido: cada peça e cada caco gira e viaja inteiro; delay(g) dá o atraso de cada grupo
  function rigid(delay, loose) {
    return function () {
      layout(); var a = new Float32Array(N * 4), r = rng(18), d = [];
      for (var g = 1; g < SHARD0 + NS; g++) d[g] = delay ? delay(g, r) : 0;
      for (var i = 0; i < N; i++) { if (i < nBoard + nBC + nD) { var q = gid[i]; a[i * 4] = d[q]; a[i * 4 + 3] = q; } else { a[i * 4] = r() * (loose || 0); a[i * 4 + 2] = 0.25; } }
      return a;
    };
  }
  function far(g) { var p = states.crack[g].p; return clamp(Math.hypot(p[0] - IMP[0], p[2] - IMP[1]) / 8.5, 0, 1); }
  E.fx('rigid', rigid());
  E.fx('burst', rigid(null, 0.25));                                   // faíscas saem logo, cada uma no seu tempo
  E.fx('cracks', rigid(function (g) { return far(g); }, 0.4));        // a rachadura corre a partir da queda
  // o peão cai durante a passagem inteira (atraso negativo), para a câmera descer junto com ele
  E.fx('shatter', rigid(function (g) { return g === PREY.id ? -1 : 0.08 + far(g) * 0.7; }, 0.5));
});
