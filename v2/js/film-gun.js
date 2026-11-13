// ===== Cenas da queda, da arma, do código e da interface =====
//   shaftTop/shaftLow  o peão cai em câmera lenta entre cacos de espelho e "raios de sol"
//   shaftFire          o tempo volta ao normal: os raios eram tiros
//   shaftHit           um tiro estilhaça o peão | gunFiring: a mesma cena, com a câmera na arma que atirava
//   gunRest            a arma para de atirar e fica de perfil sobre a bancada
//   gunExploded        a arma desmontada, peça por peça
//   code               o script Luau da arma, escrito linha a linha
//   hud/hudOn          a HUD de um jogo de tiro em volta da mesma arma; o clique e a mensagem final
// As faixas de pontos são as mesmas em todas estas cenas, para cada coisa virar a seguinte sem sumir:
//   [0, nSky) tiros -> grade da bancada -> código/HUD | [nSky, nSky + nPawn) peão -> estilhaços -> código/HUD
//   [.., + nGun) a arma, sempre a mesma | o resto: cacos de espelho -> poeira -> chão do jogo
// A arma é um desenho original, sem relação com modelos reais.
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  var N = E.N, cnt = E.cnt, rng = E.rng, lerp = E.lerp, clamp = E.clamp, Q = E.Q, PI = Math.PI;
  var nSky = cnt(9000), nHero = cnt(700), nFlash = cnt(350), nPawn = cnt(7000), nGun = cnt(16000), gun0 = nSky + nPawn, rest0 = gun0 + nGun;
  function unit(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function spinV(v, ax, ang) {   // gira v em torno do eixo ax (a mesma fórmula do shader)
    var c = Math.cos(ang), s = Math.sin(ang), d = (ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2]) * (1 - c);
    return [v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * d, v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * s + ax[1] * d, v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * s + ax[2] * d];
  }

  // ---------- Geometria do tiroteio ----------
  var DB = unit([0.86, -0.5, -0.08]);                 // direção dos tiros
  var HIT = [0.7, -2.4, 0];                           // onde o peão é atingido
  var REACH = 44, MUZ = [HIT[0] - DB[0] * REACH, HIT[1] - DB[1] * REACH, HIT[2] - DB[2] * REACH];   // boca do cano, fora de quadro
  var LOOP = 90;                                      // cada tiro percorre este comprimento e recomeça
  var streaks = (function () {
    var r = rng(61), list = [];
    for (var i = 0; i < 11; i++) list.push({ dir: unit([DB[0] + (r() - 0.5) * 0.05, DB[1] + (r() - 0.5) * 0.2, DB[2] + (r() - 0.5) * 0.26]), head: 28 + r() * 26 });
    return list;
  })();
  function perp(d) { var a = unit([-d[1], d[0], 0]); return [a, unit([d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]])]; }

  // len: comprimento do risco; wide: largura da cauda; k: brilho; hero: distância da cabeça do tiro principal; flash: clarão na boca
  function tracers(s, o) {
    var r = rng(62), i, u, v, w, sb, pp, lat;
    var hp = perp(DB);
    for (i = 0; i < nHero; i++) {                     // o tiro que acerta o peão: segue a rolagem, não o relógio
      u = r(); v = r(); w = r(); sb = o.len * Math.pow(u, 1.3); lat = o.wide * (0.25 + sb / o.len) * (v - 0.5);
      var d = o.hero - sb;
      s.put(MUZ[0] + DB[0] * d + hp[0][0] * lat + hp[1][0] * (w - 0.5) * o.wide * 0.5, MUZ[1] + DB[1] * d + hp[0][1] * lat + hp[1][1] * (w - 0.5) * o.wide * 0.5, MUZ[2] + DB[2] * d + hp[0][2] * lat + hp[1][2] * (w - 0.5) * o.wide * 0.5,
        3.0 - (sb / o.len) * 0.5, o.heroK * (1 - 0.65 * sb / o.len));
    }
    for (i = 0; i < nFlash; i++) {                    // clarão da boca do cano
      u = r(); v = r() * 2 * PI; w = Math.sqrt(r()) * 0.35 * (0.3 + u);
      s.put(MUZ[0] + DB[0] * u * 1.3 + hp[0][0] * Math.cos(v) * w + hp[1][0] * Math.sin(v) * w, MUZ[1] + DB[1] * u * 1.3 + hp[0][1] * Math.cos(v) * w + hp[1][1] * Math.sin(v) * w, MUZ[2] + DB[2] * u * 1.3 + hp[0][2] * Math.cos(v) * w + hp[1][2] * Math.sin(v) * w, 3.0 - u * 0.4, o.flash);
      s.flowLast(DB[0] * 1.6, DB[1] * 1.6, DB[2] * 1.6, r());
    }
    var per = Math.floor((nSky - nHero - nFlash) / streaks.length);
    for (i = 0; s.n < nSky; i++) {
      var st = streaks[Math.min(streaks.length - 1, Math.floor(i / per))]; pp = perp(st.dir);
      u = r(); v = r(); w = r(); sb = o.len * Math.pow(u, 1.3); lat = o.wide * (0.25 + sb / o.len) * (v - 0.5);
      var mid = LOOP / 2 - sb, lz = (w - 0.5) * o.wide * 0.5;
      // cabeça branca e quente, cauda dourada: em câmera lenta a cauda longa parece um raio de sol
      s.put(MUZ[0] + st.dir[0] * mid + pp[0][0] * lat + pp[1][0] * lz, MUZ[1] + st.dir[1] * mid + pp[0][1] * lat + pp[1][1] * lz, MUZ[2] + st.dir[2] * mid + pp[0][2] * lat + pp[1][2] * lz,
        3.0 - (sb / o.len) * 0.55, o.k * (1 - 0.7 * sb / o.len));
      s.flowLast(st.dir[0] * LOOP, st.dir[1] * LOOP, st.dir[2] * LOOP, st.head / LOOP);
    }
  }

  // ---------- O peão que cai e seus estilhaços ----------
  var pawn = E.pieceCloud('pawn', nPawn, 501), PSC = 2.7, NCH = 14;
  var chunkOf = new Uint8Array(nPawn), centroid = [];
  (function () {
    var r = rng(63), sd = [], i, c, cn = [];
    for (c = 0; c < NCH; c++) { sd.push([(r() - 0.5) * 0.6 * PSC, (r() - 0.5) * 0.95 * PSC, (r() - 0.5) * 0.6 * PSC]); centroid.push([0, 0, 0]); cn.push(0); }
    for (i = 0; i < nPawn; i++) {
      var x = pawn.p[i * 3] * PSC, y = (pawn.p[i * 3 + 1] - 0.5) * PSC, z = pawn.p[i * 3 + 2] * PSC, best = 0, bd = 1e9;
      for (c = 0; c < NCH; c++) { var d = (sd[c][0] - x) * (sd[c][0] - x) + (sd[c][1] - y) * (sd[c][1] - y) + (sd[c][2] - z) * (sd[c][2] - z); if (d < bd) { bd = d; best = c; } }
      chunkOf[i] = best; centroid[best][0] += x; centroid[best][1] += y; centroid[best][2] += z; cn[best]++;
    }
    for (c = 0; c < NCH; c++) if (cn[c]) { centroid[c][0] /= cn[c]; centroid[c][1] /= cn[c]; centroid[c][2] /= cn[c]; }
  })();
  var P_TOP = [-0.9, 4.4, 0], P_FIRE = [HIT[0] + 0.05, HIT[1] - 0.12, HIT[2]];
  var Q_TOP = Q.mul(Q.axis(0, 1, 0, 0.4), Q.axis(0, 0, 1, -0.45)), AX_DRIFT = unit([0.2, 0.3, 1]), AX_SNAP = unit([0.1, 0.2, 1]);
  var Q_LOW = Q.mul(Q.axis(AX_DRIFT[0], AX_DRIFT[1], AX_DRIFT[2], 1.25), Q_TOP), Q_FIRE = Q.mul(Q.axis(AX_SNAP[0], AX_SNAP[1], AX_SNAP[2], 0.07), Q_LOW);
  var fly = (function () {   // para onde vai e quanto gira cada estilhaço
    var r = rng(64), list = [];
    for (var c = 0; c < NCH; c++) {
      var out = unit(Q.rot(Q_FIRE, centroid[c])), d = 3.5 + r() * 7;
      list.push({ move: [DB[0] * d + out[0] * (0.8 + r() * 2.2), DB[1] * d + out[1] * (0.8 + r() * 2.2) + 0.6, DB[2] * d + out[2] * (0.8 + r() * 2.2)], axis: unit([r() - 0.5, r() - 0.5, r() - 0.5]), ang: (r() < 0.5 ? 1 : -1) * (2 + r() * 3.5) });
    }
    return list;
  })();
  // stage: 'top' | 'low' | 'fire' (inteiro) | 'hit' (estilhaçado) | 'far' (estilhaços já longe e apagados)
  function pawnPoints(s, stage) {
    var pc = stage === 'top' ? P_TOP : stage === 'low' ? HIT : P_FIRE, q = stage === 'top' ? Q_TOP : stage === 'low' ? Q_LOW : Q_FIRE, m = Q.mat(q), i;
    for (i = 0; i < nPawn; i++) {
      var lx = pawn.p[i * 3] * PSC, ly = (pawn.p[i * 3 + 1] - 0.5) * PSC, lz = pawn.p[i * 3 + 2] * PSC, n = [pawn.q[i * 3], pawn.q[i * 3 + 1], pawn.q[i * 3 + 2]];
      var w = [pc[0] + m[0] * lx + m[1] * ly + m[2] * lz, pc[1] + m[3] * lx + m[4] * ly + m[5] * lz, pc[2] + m[6] * lx + m[7] * ly + m[8] * lz];
      var nw = [m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[3] * n[0] + m[4] * n[1] + m[5] * n[2], m[6] * n[0] + m[7] * n[1] + m[8] * n[2]], k = 0.95;
      if (stage === 'hit' || stage === 'far') {
        var c = chunkOf[i], f = fly[c], cw = Q.rot(q, centroid[c]), pa = [pc[0] + cw[0], pc[1] + cw[1], pc[2] + cw[2]];
        var rel = spinV([w[0] - pa[0], w[1] - pa[1], w[2] - pa[2]], f.axis, f.ang), far = stage === 'far' ? 2.4 : 1;
        w = [pa[0] + f.move[0] * far + rel[0], pa[1] + f.move[1] * far + rel[1], pa[2] + f.move[2] * far + rel[2]]; nw = spinV(nw, f.axis, f.ang);
        k = stage === 'far' ? 0.22 : 1.15;
      }
      // dourado, iluminado pelo lado de onde vêm os tiros
      var lam = Math.max(0, -(nw[0] * DB[0] + nw[1] * DB[1] + nw[2] * DB[2]));
      s.put(w[0], w[1], w[2], 2.06 + Math.pow(lam, 1.3) * 0.94, k);
    }
  }

  // ---------- A arma: peças, cada uma com seu deslocamento na vista explodida ----------
  // Coordenadas locais: cano em +x, origem no meio do corpo. [nome, fração dos pontos, deslocamento, ordem de saída]
  var PARTS = [
    ['receiver', 0.19, [0, 0, 0], 11], ['rail', 0.06, [0, 0.55, 0], 1], ['barrel', 0.07, [1.15, 0, 0], 6], ['muzzle', 0.05, [2.1, 0, 0], 5],
    ['handguard', 0.13, [0.55, -0.28, 0], 7], ['stock', 0.13, [-1.35, 0, 0], 4], ['grip', 0.06, [-0.4, -0.8, 0], 9], ['magazine', 0.09, [0.1, -1.25, 0], 2],
    ['trigger', 0.03, [-0.1, -0.5, 0], 10], ['scope', 0.13, [0, 1.15, 0], 0], ['bolt', 0.02, [-0.95, 0.5, 0], 3], ['foregrip', 0.04, [0.8, -0.9, 0], 8]
  ];
  var gunPts = new Float32Array(nGun * 5), gunPart = new Uint8Array(nGun);   // x, y, z, calor, brilho
  (function () {
    var r = rng(65), o = 0, part = 0, end = 0, LG = unit([0.3, 0.75, 0.6]);
    function lit(nx, ny, nz) { return Math.max(0, nx * LG[0] + ny * LG[1] + nz * LG[2]); }
    function put(x, y, z, h, k) { if (o >= end) return; gunPts[o * 5] = x; gunPts[o * 5 + 1] = y; gunPts[o * 5 + 2] = z; gunPts[o * 5 + 3] = h; gunPts[o * 5 + 4] = k === undefined ? 0.9 : k; gunPart[o] = part; o++; }
    // caixa: faces discretas e arestas acesas; tilt gira em torno de z, shear inclina para a frente
    function box(n, cx, cy, cz, sx, sy, sz, tilt, shear) {
      var c = Math.cos(tilt || 0), s = Math.sin(tilt || 0);
      for (var i = 0; i < n; i++) {
        var a = r() * 2 - 1, b = r() * 2 - 1, f = Math.floor(r() * 6), edge = r() < 0.34, x, y, z, nx = 0, ny = 0, nz = 0;
        if (edge) { if (r() < 0.5) a = a < 0 ? -1 : 1; else b = b < 0 ? -1 : 1; }
        if (f < 2) { x = (f ? 1 : -1); y = a; z = b; nx = x; } else if (f < 4) { y = (f === 2 ? 1 : -1); x = a; z = b; ny = y; } else { z = (f === 4 ? 1 : -1); x = a; y = b; nz = z; }
        x *= sx / 2; y *= sy / 2; z *= sz / 2; x += -y * (shear || 0);
        put(cx + x * c - y * s, cy + x * s + y * c, cz + z, edge ? 0.95 : 0.2 + 0.62 * lit(nx * c - ny * s, nx * s + ny * c, nz));
      }
    }
    // cilindro ao longo de x, com anéis acesos
    function tube(n, x0, x1, cy, cz, rad, rings) {
      for (var i = 0; i < n; i++) {
        var a = r() * 2 * PI, ring = rings && r() < 0.3, x = ring ? rings[Math.floor(r() * rings.length)] : lerp(x0, x1, r());
        put(x, cy + Math.sin(a) * rad, cz + Math.cos(a) * rad, ring ? 0.95 : 0.22 + 0.62 * lit(0, Math.sin(a), Math.cos(a)));
      }
    }
    function start(frac) { part = partIndex++; end = partIndex === PARTS.length ? nGun : Math.min(nGun, o + Math.round(nGun * frac)); }
    var partIndex = 0, i, t, a, n;
    // corpo: caixa com a janela de ejeção e o seletor dourado
    start(PARTS[0][1]); n = end - o;
    for (i = 0; i < n * 0.08; i++) { t = r(); a = Math.floor(r() * 4); put(-0.15 + (a < 2 ? t * 0.55 : (a === 2 ? 0 : 0.55)), 0.16 + (a < 2 ? (a ? 0.16 : 0) : t * 0.16), 0.185, 0.9); }
    for (i = 0; i < n * 0.03; i++) { a = r() * 2 * PI; t = Math.sqrt(r()) * 0.06; put(-0.95 + Math.cos(a) * t, 0, 0.19 + 0.001, 2.9, 1.4); }
    box(end - o, -0.35, 0.05, 0, 2.7, 0.62, 0.36);
    // trilho: uma régua com dentes
    start(PARTS[1][1]); n = end - o;
    for (i = 0; i < n * 0.5; i++) { t = Math.floor(r() * 17); put(-1.25 + t * 0.2 + r() * 0.1, 0.5, (r() - 0.5) * 0.2, 0.9); }
    box(end - o, 0.35, 0.42, 0, 3.4, 0.09, 0.2);
    start(PARTS[2][1]); tube(end - o, 1.0, 3.25, 0.05, 0, 0.085, [1.0, 1.9, 2.6]);                          // cano
    start(PARTS[3][1]); n = end - o;                                                                         // boca: freio com fendas e um anel dourado na ponta
    for (i = 0; i < n * 0.16; i++) { a = r() * 2 * PI; put(3.9, 0.05 + Math.sin(a) * 0.15, Math.cos(a) * 0.15, 2.85, 1.4); }
    tube(end - o, 3.25, 3.9, 0.05, 0, 0.15, [3.25, 3.42, 3.58, 3.74]);
    start(PARTS[4][1]); n = end - o;                                                                         // guarda-mão: tubo com oito frisos
    for (i = 0; i < n * 0.3; i++) { a = Math.floor(r() * 8) * PI / 4 + PI / 8; put(lerp(1.0, 2.55, r()), 0.05 + Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.85); }
    tube(end - o, 1.0, 2.55, 0.05, 0, 0.26, [1.0, 1.5, 2.05, 2.55]);
    start(PARTS[5][1]); n = end - o;                                                                         // coronha vazada: só o contorno, com uma travessa
    var poly = [[-1.7, 0.36], [-3.6, 0.3], [-3.78, -0.56], [-3.3, -0.64], [-2.6, -0.12], [-1.7, -0.2], [-1.7, 0.36]], inner = [[-3.3, 0.24], [-2.75, -0.18]];
    for (i = 0; o < end; i++) {
      var seg = Math.floor(r() * (poly.length + 0.6)), pa = seg < poly.length - 1 ? poly[seg] : inner[0], pb = seg < poly.length - 1 ? poly[seg + 1] : inner[1]; t = r();
      var zz = (r() - 0.5) * 0.26, rim = Math.abs(zz) > 0.105;
      put(lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), zz, rim ? 0.95 : 0.4 + 0.3 * r());
    }
    start(PARTS[6][1]); box(end - o, -1.05, -0.62, 0, 0.36, 0.9, 0.28, -0.3);                                // punho
    start(PARTS[7][1]); n = end - o;                                                                         // carregador, com a janela dourada de munição
    for (i = 0; i < n * 0.1; i++) { t = r(); put(0.15 - (t - 0.5) * 0.9 * 0.12, -0.78 + (t - 0.5) * 0.9, 0.135, 2.8, 1.3); }
    box(end - o, 0.15, -0.78, 0, 0.44, 1.15, 0.26, 0, 0.12);
    start(PARTS[8][1]);                                                                                      // guarda-mato e gatilho
    for (i = 0; o < end; i++) { if (r() < 0.75) { a = PI + r() * PI; put(-0.55 + Math.cos(a) * 0.32, -0.26 + Math.sin(a) * 0.3, (r() - 0.5) * 0.14, 0.85); } else { t = r(); put(-0.52 - t * 0.06, -0.27 - t * 0.2, (r() - 0.5) * 0.06, 0.95); } }
    start(PARTS[9][1]); n = end - o;                                                                         // luneta: tubo, duas bocas largas, lente dourada e dois suportes
    for (i = 0; i < n * 0.1; i++) { a = r() * 2 * PI; t = Math.sqrt(r()) * 0.19; put(0.76, 0.82 + Math.sin(a) * t, Math.cos(a) * t, 2.75, 1.25); }
    tube(Math.round(n * 0.18), -0.92, -0.66, 0.82, 0, 0.21, [-0.92, -0.66]);
    tube(Math.round(n * 0.18), 0.5, 0.76, 0.82, 0, 0.21, [0.5, 0.76]);
    box(Math.round(n * 0.07), -0.45, 0.57, 0, 0.16, 0.22, 0.16); box(Math.round(n * 0.07), 0.3, 0.57, 0, 0.16, 0.22, 0.16);
    tube(end - o, -0.66, 0.5, 0.82, 0, 0.15, [-0.3, 0.1]);
    start(PARTS[10][1]); n = end - o;                                                                        // ferrolho e alavanca
    for (i = 0; i < n * 0.4; i++) { a = r() * 2 * PI; t = Math.sqrt(r()) * 0.07; put(-0.72 + Math.cos(a) * t, 0.22 + Math.sin(a) * t, 0.2 + r() * 0.16, 0.95); }
    tube(end - o, -1.25, -0.7, 0.22, 0.19, 0.05, [-1.25, -0.7]);
    start(PARTS[11][1]); box(end - o, 1.75, -0.55, 0, 0.24, 0.62, 0.24, 0.12);                               // empunhadura dianteira
  })();
  var AIM_ANG = Math.acos(DB[0]), AIM_AX = unit([0, -DB[2], DB[1]]), Q_AIM = Q.axis(AIM_AX[0], AIM_AX[1], AIM_AX[2], AIM_ANG);
  var mz = Q.rot(Q_AIM, [3.9, 0.05, 0]), O_AIM = [MUZ[0] - mz[0], MUZ[1] - mz[1], MUZ[2] - mz[2]];
  var O_REST = [1.0, 0.25, 0], O_OPEN = [0.6, 0.3, 0], SMALL = 0.4, HUD_K = 0.36;
  function smallAt() { return E.portrait ? [0.3, 4.7, 0] : [4.3, 3.3, 0]; }   // a arma pequena fica ao lado do código (acima dele em telas em pé)
  function hudGunAt() { return E.portrait ? [-1.6, -5.4, 0.3] : [5.65, -1.8, 0.3]; }
  // pose: 'aim' (atirando, inclinada), 'rest' (de perfil), 'open' (explodida), 'small' (explodida, pequena, ao lado do código), 'hud' (montada, na HUD)
  function gunPoints(s, pose) {
    var m = Q.mat(Q_AIM), hg = hudGunAt(), O_SMALL = smallAt();
    for (var i = 0; i < nGun; i++) {
      var x = gunPts[i * 5], y = gunPts[i * 5 + 1], z = gunPts[i * 5 + 2], off = PARTS[gunPart[i]][2];
      if (pose === 'aim') s.put(O_AIM[0] + m[0] * x + m[1] * y + m[2] * z, O_AIM[1] + m[3] * x + m[4] * y + m[5] * z, O_AIM[2] + m[6] * x + m[7] * y + m[8] * z, gunPts[i * 5 + 3], gunPts[i * 5 + 4]);
      else if (pose === 'rest') s.put(O_REST[0] + x, O_REST[1] + y, O_REST[2] + z, gunPts[i * 5 + 3], gunPts[i * 5 + 4]);
      else if (pose === 'open') s.put(O_OPEN[0] + x + off[0], O_OPEN[1] + y + off[1], O_OPEN[2] + z + off[2], gunPts[i * 5 + 3], gunPts[i * 5 + 4]);
      else if (pose === 'small') s.put(O_SMALL[0] + (x + off[0]) * SMALL, O_SMALL[1] + (y + off[1]) * SMALL, O_SMALL[2] + z * SMALL, gunPts[i * 5 + 3], gunPts[i * 5 + 4] * 0.9);
      else s.put(hg[0] + x * HUD_K, hg[1] + y * HUD_K, hg[2] + z * HUD_K, gunPts[i * 5 + 3], gunPts[i * 5 + 4]);
    }
  }
  // etiquetas da vista explodida: [x, y] locais de cada peça nomeada, já com o deslocamento
  var LABELS = { scope: [-0.1, 1.05 + 1.15], barrel: [2.3 + 1.15, 0.2], receiver: [-0.4, 0.42], magazine: [0.4, -1.3 - 1.25], stock: [-2.9 - 1.35, 0.45] };
  Object.keys(LABELS).forEach(function (k) { E.anchor(k, function () { return [O_OPEN[0] + LABELS[k][0], O_OPEN[1] + LABELS[k][1], 0]; }); });

  // ---------- O resto: cacos de espelho na queda, poeira e bancada depois ----------
  function shardsFalling(s) {
    var r = rng(66);
    while (s.n < N) {
      var c = [(r() - 0.5) * 22, (r() - 0.5) * 22, -7 + r() * 11], ph = r(), sz = 0.28 + r() * 0.6, nv = 3 + Math.floor(r() * 2), vs = [], j;
      var u = unit([r() - 0.5, r() - 0.5, r() - 0.5]), w = perp(u)[0], a0 = r() * 6.28, cntp = Math.round(cnt(60) * (0.5 + sz));
      for (j = 0; j < nv; j++) { var an = a0 + j * 2 * PI / nv + (r() - 0.5) * 0.7, rad = sz * (0.6 + r() * 0.6); vs.push([Math.cos(an) * rad, Math.sin(an) * rad]); }
      var bright = 0.5 + r() * 0.7;
      for (j = 0; j < cntp && s.n < N; j++) {
        var e = Math.floor(r() * nv), t = r(), a = vs[e], b = vs[(e + 1) % nv], px = lerp(a[0], b[0], t), py = lerp(a[1], b[1], t), fill = r() < 0.4;
        if (fill) { var q = r(); px *= q; py *= q; }
        s.put(c[0] + u[0] * px + w[0] * py, c[1] + u[1] * px + w[1] * py, c[2] + u[2] * px + w[2] * py, fill ? 0.5 : 0.95, (fill ? 0.4 : 0.85) * bright);
        s.flowLast(0.6, -40, 0, ph);
      }
    }
  }
  function motes(s, dim) {
    var r = rng(67);
    while (s.n < N) { s.put(1 + (r() - 0.5) * 24, -2 + r() * 9, (r() - 0.5) * 14, r() < 0.12 ? -1 : 0.2 + r() * 0.4, dim); s.flowLast(0, 2.4, 0, r()); }
  }
  function bench(s) {   // grade da bancada: os tiros param e viram o chão onde a arma repousa
    var nx = Math.round(Math.sqrt(nSky * 2.3)), nz = Math.floor(nSky / nx), i = 0;
    for (var iz = 0; iz < nz; iz++) for (var ix = 0; ix < nx; ix++, i++) {
      var x = -8 + ix / (nx - 1) * 19, z = -4.2 + iz / (nz - 1) * 8.4, line = Math.abs(x - Math.round(x)) < 0.04 || Math.abs(z - Math.round(z)) < 0.05;
      s.put(x, -2.3, z, line ? 0.55 : 0.14, 0.6);
    }
    while (s.n < nSky) s.put(1, -2.3, 0, 0.14, 0.5);
  }

  // ---------- Cenas da queda ----------
  function shaft(o) {
    return function () {
      var s = new E.Shape();
      tracers(s, o.tr); pawnPoints(s, o.pawn); gunPoints(s, 'aim'); shardsFalling(s);
      return s;
    };
  }
  var SLOW = { len: 15, wide: 0.55, k: 0.62, heroK: 0.7, flash: 0 }, FAST = { len: 2.4, wide: 0.09, k: 1.7, heroK: 1.9, flash: 1.6 };
  function tr(base, hero) { return { len: base.len, wide: base.wide, k: base.k, heroK: base.heroK, flash: base.flash, hero: hero }; }
  var gunLook = unit(Q.rot(Q_AIM, [1, 0, 0])), G_MID = [O_AIM[0] + gunLook[0] * 0.4, O_AIM[1] + gunLook[1] * 0.4, O_AIM[2] + gunLook[2] * 0.4];
  E.scene('shaftTop', { make: shaft({ tr: tr(SLOW, 22), pawn: 'top' }), clock: 'slow', size: 0.07, gain: 0.78, vary: 1, dof: 0.1, cam: { az: 0, el: 4, r: 17, t: [0, 0.6, 0], ox: 0.1 } });
  E.scene('shaftLow', { make: shaft({ tr: tr(SLOW, 27), pawn: 'low' }), clock: 'slow', size: 0.07, gain: 0.78, vary: 1, dof: 0.1, cam: { az: 16, el: 1, r: 15, t: [0.2, -0.7, 0], ox: 0.1 } });
  E.scene('shaftFire', { make: shaft({ tr: tr(FAST, REACH - 0.9), pawn: 'fire' }), clock: 'fire', size: 0.06, gain: 0.9, vary: 1, dof: 0.08, cam: { az: 18, el: 0, r: 14.5, t: [0.4, -1.2, 0], ox: 0.1 } });
  E.scene('shaftHit', { make: shaft({ tr: tr(FAST, REACH + 26), pawn: 'hit' }), clock: 'fire', size: 0.06, gain: 0.85, vary: 1, dof: 0.07, cam: { az: 24, el: 2, r: 16, t: [1.8, -1.5, 0], ox: 0.1 } });
  E.scene('gunFiring', { make: function () { return E.need('shaftHit'); }, clock: 'fire', size: 0.05, gain: 0.85, vary: 0.8, dof: 0.05, cam: { az: 4, el: 3, r: 12.5, t: G_MID, ox: 0.1, tall: 1.2 } });

  // ---------- Cenas da arma ----------
  E.scene('gunRest', {
    make: function () { var s = new E.Shape(); bench(s); pawnPoints(s, 'far'); gunPoints(s, 'rest'); motes(s, 0.4); return s; },
    rate: 0.1, size: 0.046, gain: 0.82, vary: 0.5, dof: 0.05, cam: { az: 0, el: 6, r: 13.2, t: [1.3, 0.1, 0], ox: 0.14, tall: 1.05 }
  });
  E.scene('gunExploded', {
    make: function () { var s = new E.Shape(); bench(s); pawnPoints(s, 'far'); gunPoints(s, 'open'); motes(s, 0.4); return s; },
    rate: 0.1, size: 0.044, gain: 0.82, vary: 0.5, dof: 0.04, cam: { az: 0, el: 7, r: 17, t: [1.0, 0.1, 0], ox: 0.13, tall: 1.12 }
  });

  // ---------- O código: o script da própria arma ----------
  var CODE = [
    'local tool = script.Parent',
    'local RATE, DAMAGE = 0.09, 34',
    '',
    'local function fire(origin, direction)',
    '    local hit = workspace:Raycast(origin, direction * 900)',
    '    Tracer.new(origin, hit and hit.Position)',
    '    local target = hit and hit.Instance.Parent',
    '    if target and target:FindFirstChild("Humanoid") then',
    '        target.Humanoid:TakeDamage(DAMAGE)',
    '    end',
    'end',
    '',
    'tool.Activated:Connect(function()',
    '    fire(muzzle.WorldPosition, mouse.Hit.LookVector)',
    'end)'
  ];
  var KEY = /^(local|function|end|if|then|return|for|in|do|not|and|or|else|true|false|nil)$/;
  var nText = nSky + nPawn, codeLine = new Float32Array(nText);
  function code() {
    var s = new E.Shape(), r = rng(41), k = 9.6 / 1120, y0 = 108, lh = 38.5;
    var pts = E.sample(1120, 700, nText, 42, function (ctx, w, h) {
      ctx.lineWidth = 3; ctx.strokeStyle = E.pc(0.2); E.rrect(ctx, 6, 6, w - 12, h - 12, 22); ctx.stroke();
      [E.rc(0.3), E.rc(0.7), E.pc(1)].forEach(function (c, i) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(40 + i * 30, 40, 8, 0, 2 * PI); ctx.fill(); });
      ctx.font = 'bold 26px ' + E.MONO; ctx.textBaseline = 'middle';
      var cw = ctx.measureText('M').width, x0 = (w - cw * 59) / 2 + cw * 3;
      CODE.forEach(function (line, n) {
        ctx.fillStyle = E.pc(0.22); ctx.fillText(String(n + 1).padStart(2, ' '), x0 - cw * 3.4, y0 + n * lh);
        var re = /("[^"]*")|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^A-Za-z_\s"]+)/g, m, x = x0;
        while ((m = re.exec(line))) {
          var tok = m[0], next = line.charAt(re.lastIndex);
          if (m[1]) ctx.fillStyle = E.rc(0.74);                                                          // textos entre aspas
          else if (m[2]) ctx.fillStyle = KEY.test(tok) ? E.pc(1) : (next === '(' ? E.rc(0.5) : E.pc(0.62)); // palavras-chave, chamadas, nomes
          else ctx.fillStyle = /[0-9]/.test(tok) ? E.rc(0.74) : E.pc(0.4);                                // números e pontuação
          if (!m[3]) ctx.fillText(tok, x, y0 + n * lh);
          x += cw * tok.length;
        }
      });
    });
    for (var i = 0; i < nText; i++) {
      s.rgb(pts[i * 5] * k - 0.6, pts[i * 5 + 1] * k - 0.7, (r() - 0.5) * 0.1, pts[i * 5 + 2], pts[i * 5 + 3], pts[i * 5 + 4]);
      codeLine[i] = clamp((350 - pts[i * 5 + 1] - y0 + lh / 2) / lh / CODE.length, 0, 1);   // em que linha o ponto caiu (0 = primeira)
    }
    gunPoints(s, 'small'); motes(s, 0.3);
    return s;
  }
  E.scene('code', { make: code, layout: true, rate: 0.1, size: 0.044, gain: 0.62, vary: 0.3, dof: 0.04, cam: { az: 0, el: 0, r: 18.5, t: [0, 0.3, 0], ox: 0.13 } });

  // ---------- A HUD: um jogo de tiro em volta da mesma arma ----------
  var nScreen = cnt(6200), nButton = cnt(900), nCursor = cnt(450), nHudBase = nText - nScreen - nButton - nCursor;
  var MSG = { en: ["LET'S BUILD", 'YOUR EXPERIENCE'], pt: ['VAMOS CRIAR', 'A SUA EXPERIÊNCIA'] }, PLAY = { en: 'PLAY', pt: 'JOGAR' };
  function hudLayout() {   // posições dos elementos, em px do desenho (paisagem 1600 x 900, retrato 900 x 1500)
    return E.portrait
      ? { w: 900, h: 1500, card: [50, 190], map: [770, 262, 88], compass: [450, 425, 250], cross: [450, 690], button: [450, 940], banner: [450, 690, 800, 250], slots: [450, 1120], ammo: [850, 1345] }
      : { w: 1600, h: 900, card: [70, 70], map: [1440, 170, 105], compass: [800, 84, 240], cross: [800, 415], button: [800, 650], banner: [800, 415, 880, 230], slots: [800, 800], ammo: [1510, 800] };
  }
  function hudBase(ctx, L) {
    var i, x, y;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.textBaseline = 'middle';
    // jogador: avatar, nome, vida e escudo
    x = L.card[0]; y = L.card[1];
    ctx.strokeStyle = E.pc(0.8); ctx.lineWidth = 5; E.rrect(ctx, x, y, 78, 78, 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 22, y + 52); ctx.lineTo(x + 39, y + 24); ctx.lineTo(x + 56, y + 52); ctx.stroke();
    ctx.fillStyle = E.pc(1); ctx.font = '800 26px ' + E.SANS; ctx.textAlign = 'left'; ctx.fillText('PLAYER 01', x + 96, y + 20);
    ctx.lineWidth = 4; E.rrect(ctx, x + 96, y + 40, 300, 20, 10); ctx.stroke(); ctx.fillStyle = E.pc(1); E.rrect(ctx, x + 101, y + 45, 216, 10, 5); ctx.fill();
    ctx.strokeStyle = E.rc(0.6); E.rrect(ctx, x + 96, y + 68, 220, 14, 7); ctx.stroke(); ctx.fillStyle = E.rc(0.72); E.rrect(ctx, x + 100, y + 72, 128, 6, 3); ctx.fill();
    // bússola e relógio da partida
    x = L.compass[0]; y = L.compass[1]; var half = L.compass[2];
    ctx.strokeStyle = E.pc(0.7); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); ctx.stroke();
    for (i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(x + i * half / 6, y - (i % 3 === 0 ? 14 : 7)); ctx.lineTo(x + i * half / 6, y); ctx.stroke(); }
    ctx.fillStyle = E.pc(0.9); ctx.font = '800 20px ' + E.SANS; ctx.textAlign = 'center';
    ctx.fillText('NW', x - half / 2, y - 28); ctx.fillText('N', x, y - 28); ctx.fillText('NE', x + half / 2, y - 28);
    ctx.fillStyle = E.rc(0.75); ctx.beginPath(); ctx.moveTo(x - 9, y + 10); ctx.lineTo(x + 9, y + 10); ctx.lineTo(x, y + 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = E.pc(1); ctx.font = '800 30px ' + E.SANS; ctx.fillText('02:47', x, y + 52);
    // minimapa
    x = L.map[0]; y = L.map[1]; var rad = L.map[2];
    ctx.strokeStyle = E.pc(0.8); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * PI); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = E.pc(0.45); ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, 2 * PI); ctx.moveTo(x - rad, y); ctx.lineTo(x + rad, y); ctx.moveTo(x, y - rad); ctx.lineTo(x, y + rad); ctx.stroke();
    ctx.fillStyle = E.rc(0.78); [[-0.4, -0.3], [0.5, 0.15], [0.1, -0.62]].forEach(function (b) { ctx.beginPath(); ctx.arc(x + b[0] * rad, y + b[1] * rad, 7, 0, 2 * PI); ctx.fill(); });
    ctx.fillStyle = E.pc(1); ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x + 9, y + 10); ctx.lineTo(x - 9, y + 10); ctx.closePath(); ctx.fill();
    // munição
    x = L.ammo[0]; y = L.ammo[1];
    ctx.fillStyle = E.pc(1); ctx.textAlign = 'right'; ctx.font = '900 92px ' + E.SANS; ctx.fillText('30', x - 96, y);
    ctx.fillStyle = E.pc(0.65); ctx.font = '800 34px ' + E.SANS; ctx.fillText('/ 120', x, y + 18);
    ctx.fillStyle = E.rc(0.75); for (i = 0; i < 3; i++) { E.rrect(ctx, x - 84 + i * 30, y - 44, 20, 8, 4); ctx.fill(); }
    // espaços de arma
    x = L.slots[0]; y = L.slots[1];
    for (i = 0; i < 4; i++) {
      var sx = x - 2 * 78 + i * 78 + 6;
      if (i === 0) { ctx.fillStyle = E.pc(0.9, 0.5); E.rrect(ctx, sx, y - 33, 66, 66, 12); ctx.fill(); }
      ctx.strokeStyle = i === 0 ? E.pc(1) : E.pc(0.6); ctx.lineWidth = 4; E.rrect(ctx, sx, y - 33, 66, 66, 12); ctx.stroke();
    }
  }
  function hudScreen(ctx, L, on) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var x = L.cross[0], y = L.cross[1];
    if (!on) {   // mira
      ctx.strokeStyle = E.rc(0.78); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 40, 0, 2 * PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 86, y); ctx.lineTo(x - 54, y); ctx.moveTo(x + 54, y); ctx.lineTo(x + 86, y); ctx.moveTo(x, y - 86); ctx.lineTo(x, y - 54); ctx.moveTo(x, y + 54); ctx.lineTo(x, y + 86); ctx.stroke();
      ctx.fillStyle = E.pc(1); ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * PI); ctx.fill();
    } else {     // faixa com a mensagem
      var b = L.banner, lines = MSG[E.lang], size = 74;
      ctx.strokeStyle = E.pc(1); ctx.lineWidth = 6; E.rrect(ctx, b[0] - b[2] / 2, b[1] - b[3] / 2, b[2], b[3], 26); ctx.stroke();
      ctx.fillStyle = E.pc(1); ctx.font = '900 ' + size + 'px ' + E.SANS;
      while (size > 28 && Math.max(ctx.measureText(lines[0]).width, ctx.measureText(lines[1]).width) > b[2] - 90) { size -= 2; ctx.font = '900 ' + size + 'px ' + E.SANS; }
      ctx.fillText(lines[0], b[0], b[1] - size * 0.6); ctx.fillText(lines[1], b[0], b[1] + size * 0.6);
    }
  }
  function hudButton(ctx, L, on) {
    var x = L.button[0], y = L.button[1];
    ctx.lineJoin = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 34px ' + E.SANS;
    if (on) { ctx.fillStyle = E.pc(1); E.rrect(ctx, x - 130, y - 36, 260, 72, 20); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillText(PLAY[E.lang], x, y + 2); ctx.globalCompositeOperation = 'source-over'; }
    else { ctx.strokeStyle = E.pc(1); ctx.lineWidth = 6; E.rrect(ctx, x - 130, y - 36, 260, 72, 20); ctx.stroke(); ctx.fillStyle = E.pc(1); ctx.fillText(PLAY[E.lang], x, y + 2); }
  }
  function hud(on) {
    return function () {
      var s = new E.Shape(), r = rng(91), L = hudLayout(), k = 0.01, i, p;
      function lay(pts, gain) { for (var j = 0; j < pts.length / 5; j++) s.rgb(pts[j * 5] * k, pts[j * 5 + 1] * k, (r() - 0.5) * 0.06, pts[j * 5 + 2] * gain, pts[j * 5 + 3] * gain, pts[j * 5 + 4] * gain); }
      lay(E.sample(L.w, L.h, nHudBase, 81, function (ctx) { hudBase(ctx, L); }), 1);
      lay(E.sample(L.w, L.h, nScreen, 82, function (ctx) { hudScreen(ctx, L, on); }), 1);
      lay(E.sample(L.w, L.h, nButton, 83, function (ctx) { hudButton(ctx, L, on); }), on ? 1.4 : 1);
      // cursor: uma seta que vai até o botão
      var tip = on ? [(L.button[0] - L.w / 2 + 70) * k, -(L.button[1] - L.h / 2 + 4) * k, 0.3] : [(L.button[0] - L.w / 2 + 420) * k, -(L.button[1] - L.h / 2 - 260) * k, 0.6];
      for (i = 0; i < nCursor; i++) {
        var u = r(), v = r() * (1 - u) * 0.62;
        if (r() < 0.35) v = r() < 0.5 ? 0 : (1 - u) * 0.62;
        s.put(tip[0] + v * 0.5, tip[1] - u * 0.62 - v * 0.12, tip[2], 1, 1.3);
      }
      gunPoints(s, 'hud');
      // o chão do jogo: uma baseplate que some no horizonte
      var rows = Math.max(8, Math.round(Math.sqrt((N - s.n) / 5))), cols = Math.floor((N - s.n) / rows);
      for (var iz = 0; iz < rows; iz++) for (var ix = 0; ix < cols && s.n < N; ix++) s.put(-34 + ix / (cols - 1) * 68, E.portrait ? -9.5 : -5.6, -3 - Math.pow(iz / (rows - 1), 1.6) * 80, 0.3, 0.5);
      while (s.n < N) s.put(0, -5.6, -40, 0.2, 0.3);
      p = E.portrait;
      this.cam.r = p ? (on ? 11.3 : 11.9) : (on ? 17 : 18);   // a HUD inteira cabe entre as faixas de cinema
      return s;
    };
  }
  E.scene('hud', { make: hud(false), text: true, layout: true, rate: 0.1, size: 0.04, gain: 0.66, vary: 0.2, dof: 0.02, cam: { az: 0, el: 0, r: 15.3, t: [0, 0, 0], ox: 0, tall: 1 } });
  E.scene('hudOn', { make: hud(true), text: true, layout: true, rate: 0.1, size: 0.04, gain: 0.9, vary: 0.2, dof: 0.02, cam: { az: 0, el: 0, r: 14.4, t: [0, 0, 0], ox: 0, tall: 1 } });

  // ---------- Papéis dos pontos e movimentos rígidos ----------
  var G_PAWN = 1, G_CHUNK = 2, G_GUN = 20;
  function roles(fn) { return function () { var a = new Float32Array(N * 4), r = rng(48); for (var i = 0; i < N; i++) fn(a, i * 4, i, r); return a; }; }
  // o peão inteiro deriva e gira; todo o resto só desliza
  E.fx('drift', roles(function (a, o, i) { if (i >= nSky && i < gun0) a[o + 3] = G_PAWN; }));
  // cada estilhaço sai girando
  E.fx('pawnHit', roles(function (a, o, i) { if (i >= nSky && i < gun0) a[o + 3] = G_CHUNK + chunkOf[i - nSky]; }));
  // a arma gira inteira até ficar de perfil; os tiros assentam na grade; a poeira se rearruma
  E.fx('level', roles(function (a, o, i, r) { if (i >= gun0 && i < rest0) a[o + 3] = G_GUN; else if (i < nSky || i >= rest0) { a[o] = r(); a[o + 2] = 0.5; } }));
  // desmontagem: uma peça de cada vez
  E.fx('strip', roles(function (a, o, i) { if (i >= gun0 && i < rest0) a[o] = PARTS[gunPart[i - gun0]][3] / 11; }));
  // o código é escrito linha a linha; a arma só encolhe para o canto
  E.fx('write', roles(function (a, o, i, r) { if (i < nText) { E.need('code'); a[o] = codeLine[i] * 0.85 + r() * 0.08; a[o + 2] = 0.3; } else if (i >= rest0) { a[o] = r(); a[o + 2] = 0.4; } }));
  // o código vira HUD; a arma se remonta e vai para o canto da tela
  E.fx('toHud', roles(function (a, o, i, r) { if (i < nText || i >= rest0) { a[o] = r(); a[o + 2] = 0.45; } }));
  // o cursor chega, o botão acende e só então a mira dá lugar à mensagem
  E.fx('click', roles(function (a, o, i, r) {
    if (i >= nHudBase && i < nHudBase + nScreen) { a[o] = 0.6 + r() * 0.4; a[o + 2] = 0.5; }
    else if (i >= nHudBase + nScreen && i < nHudBase + nScreen + nButton) { a[o] = 0.55; a[o + 2] = 0.1; }
  }));
  E.rig('drift', function () { var g = new Float32Array(E.GROUPS * 16); E.rigRow(g, G_PAWN, P_TOP, HIT, AX_DRIFT, 1.25, 0); return g; });
  E.rig('snap', function () { var g = new Float32Array(E.GROUPS * 16); E.rigRow(g, G_PAWN, HIT, P_FIRE, AX_SNAP, 0.07, 0); return g; });
  E.rig('pawnHit', function () {
    var g = new Float32Array(E.GROUPS * 16);
    for (var c = 0; c < NCH; c++) { var cw = Q.rot(Q_FIRE, centroid[c]), pa = [P_FIRE[0] + cw[0], P_FIRE[1] + cw[1], P_FIRE[2] + cw[2]], f = fly[c]; E.rigRow(g, G_CHUNK + c, pa, [pa[0] + f.move[0], pa[1] + f.move[1], pa[2] + f.move[2]], f.axis, f.ang, 0); }
    return g;
  });
  E.rig('level', function () { var g = new Float32Array(E.GROUPS * 16); E.rigRow(g, G_GUN, O_AIM, O_REST, AIM_AX, -AIM_ANG, 0); return g; });
});
