// ===== Cenas da queda, da bala, da arma, do código e da interface =====
// Continuam a partir do tabuleiro estilhaçado, com os MESMOS pontos e a mesma câmera (não há corte):
//   fallA/fallB   a câmera desce com o peão; a queda entra em câmera lenta entre os cacos e os raios de luz
//   fallSnap      um dos brilhos se condensa numa bala, em close
//   fallHit       o tempo volta ao normal: a bala atravessa e estilhaça o peão
//   gunFiring     a mesma cena, com a câmera já na arma que atirava
//   gunRest       a arma para de atirar e fica de perfil sobre a bancada | gunTurn: a mesma cena; a arma dá um giro completo
//   gunExploded   a arma desmontada, peça por peça
//   code          o script Luau da arma, escrito linha a linha
//   hud/hudOn     a HUD de um jogo de tiro em volta da mesma arma; o clique e a mensagem final
//   waveEnd       o mar de luz, de volta, para a tela final
// Faixas de pontos (as mesmas de film-chess.js):
//   A  cacos do tabuleiro -> poeira -> código/HUD
//   BC peças que caíram (apagadas) -> a arma, sempre a mesma; os pontos que sobram viram raios, tiros, bancada e chão
//   D  o peão -> estilhaços -> código/HUD
//   EF poeira -> brilhos de luz -> balas -> código/HUD
// A arma é um desenho original, sem relação com modelos reais.
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  var N = E.N, cnt = E.cnt, rng = E.rng, lerp = E.lerp, clamp = E.clamp, Q = E.Q, PI = Math.PI, C = E.chess;
  var nA = C.nA, nBC = C.nBC, nD = C.nD, nEF = C.nEF, d0 = nA + nBC, ef0 = d0 + nD, PREY = C.PREY, SHARD0 = C.SHARD0, NS = C.NS, st = C.states;
  var nText = nA + nD + nEF;                                 // pontos que viram código e HUD
  function unit(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function add(a, b, k) { k = k === undefined ? 1 : k; return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  function spinV(v, ax, ang) {   // gira v em torno do eixo ax (a mesma fórmula do shader)
    var c = Math.cos(ang), s = Math.sin(ang), d = (ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2]) * (1 - c);
    return [v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * s + ax[0] * d, v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * s + ax[1] * d, v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * s + ax[2] * d];
  }
  function perp(d) { var a = unit([-d[1], d[0], 0]); return [a, unit([d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]])]; }
  function center(pose) { return add(pose.p, Q.rot(pose.q, [0, 0.5, 0])); }   // meio do peão

  // ---------- A queda continua: poses do peão e dos cacos depois do estilhaço ----------
  var rigHit;
  (function () {
    var r = rng(71), ch, g, pa, fell = st.shatter[PREY.id].p, TIP = C.TIP;
    function around(depth, spread, turns) {   // cacos em volta do peão, girando devagar
      for (g = 0; g < NS; g++) {
        var an = r() * 2 * PI, d = 1.4 + r() * spread, ax = unit([r() - 0.5, r() - 0.5, r() - 0.5]);
        ch[SHARD0 + g] = { p: [pa[0] + Math.cos(an) * d, pa[1] + depth[0] + r() * depth[1], pa[2] + Math.sin(an) * d * 0.8 + 0.6], spin: [ax, (r() < 0.5 ? 1 : -1) * (turns[0] + r() * turns[1])] };
      }
    }
    function drift(from, dy, turns) {         // cacos que só descem um pouco, na mesma lenta
      for (g = 0; g < NS; g++) { var q = st[from][SHARD0 + g].p, ax = unit([r() - 0.5, r() - 0.5, r() - 0.5]); ch[SHARD0 + g] = { p: [q[0], q[1] + dy[0] + r() * dy[1], q[2]], spin: [ax, (r() - 0.5) * turns] }; }
    }
    // a câmera alcança o peão e o tempo vai desacelerando
    ch = {}; pa = [fell[0], fell[1] - 6.0, fell[2]]; ch[PREY.id] = { p: pa, spin: [TIP, 2.1] }; around([-6.5, 14], 6.5, [1.4, 2.2]);
    // as outras peças continuam caindo e se apagam (os pontos delas vão virar a arma)
    C.SET.forEach(function (p) { if (p !== PREY) { var q = st.shatter[p.id].p; ch[p.id] = { p: [q[0], q[1] - 10, q[2]], spin: [unit([r() - 0.5, r() - 0.5, r() - 0.5]), (r() - 0.5) * 3] }; } });
    C.step('shatter', 'fallA', ch);
    // câmera lenta: tudo quase parado
    ch = {}; ch[PREY.id] = { p: [pa[0], pa[1] - 1.5, pa[2]], spin: [unit([TIP[0], 0.35, TIP[2]]), 0.55] }; drift('fallA', [-1.6, 1.0], 0.9);
    C.step('fallA', 'fallB', ch);
    ch = {}; ch[PREY.id] = { p: [pa[0], pa[1] - 1.7, pa[2]], spin: [TIP, 0.07] }; drift('fallB', [-0.2, 0.1], 0.12);
    C.step('fallB', 'fallSnap', ch);
    // o tempo volta: os cacos somem para baixo
    ch = {}; drift('fallSnap', [-30, 14], 9);
    rigHit = C.step('fallSnap', 'fallHit', ch);
  })();

  // ---------- Geometria do tiro ----------
  var HIT = center(st.fallSnap[PREY.id]);                    // onde o peão é atingido
  var DB = unit([-0.92, -0.34, -0.02]);                      // direção dos tiros (da esquerda para a direita na tela)
  // A arma fica perto o bastante para a câmera ir do peão até ela sem nunca ficar sem nada em quadro.
  var REACH = 16, MUZ = add(HIT, DB, -REACH), LOOP = 60;     // boca do cano, fora de quadro durante a queda; cada tiro percorre LOOP e recomeça
  var Qb = Q.axis(0, -DB[2], DB[1], Math.acos(DB[0])), Mb = Q.mat(Qb);   // leva o eixo +x local para a direção do tiro
  // Os outros tiros saem da mesma boca de cano e passam perto do peão, cada um num ponto escolhido:
  // [ao longo da linha de tiro, para cima, para o fundo], medidos a partir do peão, no meio da câmera lenta.
  var SLOW = 4.5;                                            // quanto cada brilho anda, por tela de rolagem, em câmera lenta
  function lines(pass) {
    return pass.map(function (o) {
      var v = [HIT[0] + DB[0] * o[0] - MUZ[0], HIT[1] + DB[1] * o[0] + o[1] - MUZ[1], HIT[2] + DB[2] * o[0] + o[2] - MUZ[2]];
      return { dir: unit(v), head: Math.hypot(v[0], v[1], v[2]) - SLOW * 0.5 };
    });
  }
  var SHOTS = [lines([[-3.0, 1.9, 1.5], [1.0, -1.6, 2.5], [-5.5, -1.2, 0.8], [3.2, 2.4, 3.5], [-1.5, -2.6, -0.6], [4.5, -0.4, 5.0], [-7.0, 0.9, 2.8]]),
    lines([[2.2, 1.0, 1.4], [-4.2, 2.9, 3.0], [-0.5, -3.4, 2.0], [5.8, -2.2, 3.8], [-8.5, -0.5, 1.6], [0.3, 3.4, 4.5], [-2.6, -1.0, 6.0]])];
  // n pontos repartidos entre os tiros do grupo "set". form 0: raio de luz (cabeça difusa e feixe longo) | 1: bala com rastro curto.
  // Cada ponto percorre a linha de tiro em laço, no relógio da cena (lento durante a queda, normal depois).
  function shots(s, n, form, seed, set) {
    var r = rng(seed), others = SHOTS[set], per = Math.ceil(n / others.length);
    for (var i = 0; i < n; i++) {
      var sh = others[Math.min(others.length - 1, Math.floor(i / per))], pp = perp(sh.dir), u = r(), v = r() * 2 * PI, w = Math.sqrt(r()), ax, rad, h, k;
      if (r() > 0.24) { ax = -(0.2 + u * (form ? 3 : 14)); rad = (form ? 0.02 : 0.02 + 0.13 * u) * w; h = 2.8 - u * 0.5; k = (form ? 0.7 : 1.5) * (1 - 0.85 * u); }   // feixe
      else if (form) { ax = (u - 0.5) * 0.55; rad = 0.05 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, ax / 0.28), 2))) * w; h = 2.9; k = 1.5; }                 // bala
      else { ax = (r() + r() + r() - 1.5) * 0.4; rad = 0.2 * w * w; h = 2.95; k = 1.8; }                                                                          // cabeça difusa
      var mid = LOOP / 2 + ax, cs = Math.cos(v) * rad, sn = Math.sin(v) * rad;
      s.put(MUZ[0] + sh.dir[0] * mid + pp[0][0] * cs + pp[1][0] * sn, MUZ[1] + sh.dir[1] * mid + pp[0][1] * cs + pp[1][1] * sn, MUZ[2] + sh.dir[2] * mid + pp[0][2] * cs + pp[1][2] * sn, h, k);
      s.flowLast(sh.dir[0] * LOOP, sh.dir[1] * LOOP, sh.dir[2] * LOOP, sh.head / LOOP);
    }
  }

  // Rajada contínua: tiros espaçados por igual ao longo da linha, para nunca faltar um em quadro depois que o
  // tempo volta (os brilhos da queda passam todos juntos). k 0 = ainda invisível (durante a câmera lenta).
  var BURST = 10;
  function stream(s, n, k) {
    var r = rng(64), per = Math.ceil(n / BURST), dirs = [];
    for (var j = 0; j < BURST; j++) dirs.push(unit([DB[0], DB[1] + (r() - 0.5) * 0.07, DB[2] + (r() - 0.5) * 0.08]));
    for (var i = 0; i < n; i++) {
      var b = Math.min(BURST - 1, Math.floor(i / per)), d = dirs[b], pp = perp(d), u = r(), v = r() * 2 * PI, w = Math.sqrt(r()), body = r() < 0.22;
      var ax = body ? (u - 0.5) * 0.5 : -(0.2 + u * 6), rad = (body ? 0.05 : 0.028) * w, mid = LOOP / 2 + ax, cs = Math.cos(v) * rad, sn = Math.sin(v) * rad;
      s.put(MUZ[0] + d[0] * mid + pp[0][0] * cs + pp[1][0] * sn, MUZ[1] + d[1] * mid + pp[0][1] * cs + pp[1][1] * sn, MUZ[2] + d[2] * mid + pp[0][2] * cs + pp[1][2] * sn, body ? 2.9 : 2.75 - u * 0.4, k * (body ? 2.2 : 1.6 * (1 - 0.8 * u)));
      s.flowLast(d[0] * LOOP, d[1] * LOOP, d[2] * LOOP, (b + 0.5) / BURST);
    }
  }

  // ---------- Brilhos de luz que viram balas (faixa EF) ----------
  var nHB = cnt(1400), nHT = cnt(350), nFl = cnt(300);
  // A bala principal, modelada: ponta ogival, corpo com raias, anéis e base. Local: ponta em +x.
  var bullet = (function () {
    var r = rng(72), b = new Float32Array(nHB * 8), i;   // x, y, z, calor, brilho, e o deslocamento do brilho difuso (3)
    for (i = 0; i < nHB; i++) {
      var pick = r(), a = r() * 2 * PI, x, rad, h = 2.4, k = 1, nx = 0;
      if (pick < 0.3) { var t = Math.pow(r(), 0.8); x = 0.08 + t * 0.42; rad = 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.7))); h = 2.5 + t * 0.5; nx = 0.5; }   // ogiva
      else if (pick < 0.68) { x = -0.34 + r() * 0.42; rad = 0.11; }                                                                                              // corpo
      else if (pick < 0.76) { x = -0.34 - r() * 0.04; rad = 0.1 * Math.sqrt(r()); h = 2.2; nx = -1; }                                                              // base
      else if (pick < 0.84) { x = r() < 0.5 ? -0.1 : -0.17; rad = 0.114; h = 2.98; k = 1.25; }                                                                     // anéis
      else { x = -0.32 + r() * 0.38; rad = 0.112; a = Math.floor(r() * 6) * PI / 3 + x * 3.2; h = 2.85; k = 1.1; }                                                 // raias
      var lam = Math.max(0, Math.sin(a) * 0.75 + Math.cos(a) * 0.6 + nx * 0.2);
      b[i * 8] = x; b[i * 8 + 1] = Math.sin(a) * rad; b[i * 8 + 2] = Math.cos(a) * rad; b[i * 8 + 3] = pick < 0.76 ? h - 0.35 + 0.55 * lam : h; b[i * 8 + 4] = k;
      b[i * 8 + 5] = (r() + r() + r() - 1.5) * 1.1; b[i * 8 + 6] = (r() + r() + r() - 1.5) * 0.36; b[i * 8 + 7] = (r() + r() + r() - 1.5) * 0.36;
    }
    return b;
  })();
  // o: { hero: centro da bala principal, form: 0 brilho difuso | 1 bala, flash: clarão na boca do cano }
  function lights(s, o) {
    var r = rng(62), i, u, v, w, hp = perp(DB), l, p;
    for (i = 0; i < nHB; i++) {
      var x = bullet[i * 8], y = bullet[i * 8 + 1], z = bullet[i * 8 + 2];
      var core = i % 9 < 5;                                  // em brilho: um miolo denso e um halo em volta
      if (!o.form) { x = x * 0.4 + bullet[i * 8 + 5] * (core ? 0.45 : 1.3); y = y * 0.5 + bullet[i * 8 + 6] * (core ? 0.5 : 1.5); z = z * 0.5 + bullet[i * 8 + 7] * (core ? 0.5 : 1.5); }
      s.put(o.hero[0] + Mb[0] * x + Mb[1] * y + Mb[2] * z, o.hero[1] + Mb[3] * x + Mb[4] * y + Mb[5] * z, o.hero[2] + Mb[6] * x + Mb[7] * y + Mb[8] * z, o.form ? bullet[i * 8 + 3] : 2.85, o.form ? bullet[i * 8 + 4] : core ? 1.3 : 0.45);
    }
    for (i = 0; i < nHT; i++) {                              // rastro da bala principal
      u = r(); v = r() * 2 * PI; w = Math.sqrt(r()); l = 0.4 + u * (o.form ? 3.4 : 14); p = (o.form ? 0.02 : 0.16) * w * (0.2 + u);
      s.put(o.hero[0] - DB[0] * l + (hp[0][0] * Math.cos(v) + hp[1][0] * Math.sin(v)) * p, o.hero[1] - DB[1] * l + (hp[0][1] * Math.cos(v) + hp[1][1] * Math.sin(v)) * p, o.hero[2] - DB[2] * l + (hp[0][2] * Math.cos(v) + hp[1][2] * Math.sin(v)) * p, 2.9 - u * 0.5, (o.form ? 0.85 : 0.95) * (1 - 0.85 * u));
    }
    for (i = 0; i < nFl; i++) {                              // clarão da boca do cano
      u = r(); v = r() * 2 * PI; w = Math.sqrt(r()) * 0.3 * (0.25 + u);
      s.put(MUZ[0] + DB[0] * u * 1.3 + (hp[0][0] * Math.cos(v) + hp[1][0] * Math.sin(v)) * w, MUZ[1] + DB[1] * u * 1.3 + (hp[0][1] * Math.cos(v) + hp[1][1] * Math.sin(v)) * w, MUZ[2] + DB[2] * u * 1.3 + (hp[0][2] * Math.cos(v) + hp[1][2] * Math.sin(v)) * w, 3.0 - u * 0.4, o.flash);
      s.flowLast(DB[0] * 1.6, DB[1] * 1.6, DB[2] * 1.6, r());
    }
    shots(s, N - s.n, o.form, 62, 0);                           // os outros brilhos
  }

  // ---------- O peão estilhaçado (faixa D) ----------
  var NCH = 14, chunkOf = new Uint8Array(nD), centroid = [], G_CHUNK = 100, fly = [];
  (function () {
    var r = rng(63), sd = [], i, c, cn = [], cl = PREY.cloud;
    for (c = 0; c < NCH; c++) { sd.push([(r() - 0.5) * 0.6, r() * 0.95, (r() - 0.5) * 0.6]); centroid.push([0, 0, 0]); cn.push(0); }
    for (i = 0; i < nD; i++) {
      var x = cl.p[i * 3], y = cl.p[i * 3 + 1], z = cl.p[i * 3 + 2], best = 0, bd = 1e9;
      for (c = 0; c < NCH; c++) { var d = (sd[c][0] - x) * (sd[c][0] - x) + (sd[c][1] - y) * (sd[c][1] - y) + (sd[c][2] - z) * (sd[c][2] - z); if (d < bd) { bd = d; best = c; } }
      chunkOf[i] = best; centroid[best][0] += x; centroid[best][1] += y; centroid[best][2] += z; cn[best]++;
    }
    var pose = st.fallSnap[PREY.id];
    for (c = 0; c < NCH; c++) {
      if (cn[c]) { centroid[c][0] /= cn[c]; centroid[c][1] /= cn[c]; centroid[c][2] /= cn[c]; }
      var pa = add(pose.p, Q.rot(pose.q, centroid[c])), out = unit([pa[0] - HIT[0], pa[1] - HIT[1], pa[2] - HIT[2]]), d2 = 2.5 + r() * 6;
      fly.push({ pa: pa, move: [DB[0] * d2 + out[0] * (0.6 + r() * 1.8), DB[1] * d2 + out[1] * (0.6 + r() * 1.8) + 0.4, DB[2] * d2 + out[2] * (0.6 + r() * 1.8)], axis: unit([r() - 0.5, r() - 0.5, r() - 0.5]), ang: (r() < 0.5 ? 1 : -1) * (2 + r() * 3.5) });
      E.rigRow(rigHit, G_CHUNK + c, pa, add(pa, fly[c].move), fly[c].axis, fly[c].ang, 0);
    }
  })();
  // far: quanto os estilhaços já se afastaram (1 = logo depois do tiro)
  function chunks(s, far, k) {
    var cl = PREY.cloud, pose = st.fallSnap[PREY.id], m = Q.mat(pose.q);
    for (var i = 0; i < nD; i++) {
      var lx = cl.p[i * 3], ly = cl.p[i * 3 + 1], lz = cl.p[i * 3 + 2], n = [cl.q[i * 3], cl.q[i * 3 + 1], cl.q[i * 3 + 2]], f = fly[chunkOf[i]];
      var w = [pose.p[0] + m[0] * lx + m[1] * ly + m[2] * lz, pose.p[1] + m[3] * lx + m[4] * ly + m[5] * lz, pose.p[2] + m[6] * lx + m[7] * ly + m[8] * lz];
      var rel = spinV([w[0] - f.pa[0], w[1] - f.pa[1], w[2] - f.pa[2]], f.axis, f.ang), nw = spinV([m[0] * n[0] + m[1] * n[1] + m[2] * n[2], m[3] * n[0] + m[4] * n[1] + m[5] * n[2], m[6] * n[0] + m[7] * n[1] + m[8] * n[2]], f.axis, f.ang);
      var lam = Math.max(0, -(nw[0] * DB[0] + nw[1] * DB[1] + nw[2] * DB[2]));
      s.put(f.pa[0] + f.move[0] * far + rel[0], f.pa[1] + f.move[1] * far + rel[1], f.pa[2] + f.move[2] * far + rel[2], 2.1 + Math.pow(lam, 1.2) * 0.9, k);
    }
  }

  // ---------- A arma ----------
  // Cada peça é desenhada de perfil num canvas (cano para a direita), amostrada em pontos e ganha espessura:
  // "slab" é uma chapa com faces e bordas; "round" é um cilindro, com o raio tirado da altura do desenho em cada coluna.
  // Base cinza = superfície discreta; traços brancos = detalhes acesos; dourado = destaque.
  var GW = 2000, GH = 760, SCL = 7.9 / GW, GX0 = 1000, GY0 = 300, BASE = '#5c5c5c', LINE = '#ffffff', GOLD = 'rgb(255,190,40)';
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function fillP(c, pts) { c.fillStyle = BASE; poly(c, pts); c.fill(); }
  function rr(c, x, y, w, h, rad) { E.rrect(c, x, y, w, h, rad); }
  function dot(c, x, y, rad, col) { c.fillStyle = col || LINE; c.beginPath(); c.arc(x, y, rad, 0, 2 * PI); c.fill(); }
  function seg(c, x0, y0, x1, y1, w, col) { c.strokeStyle = col || LINE; c.lineWidth = w || 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  function hole(c, fn) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; fn(); c.globalCompositeOperation = 'source-over'; }
  // [nome, tipo, espessura, caixa [x0, y0, x1, y1], deslocamento na vista explodida, ordem de saída, desenho]
  var PARTS = [
    ['upper', 'slab', 0.17, [630, 240, 1020, 345], [0, 0, 0], 15, function (c) {
      fillP(c, [640, 252, 1010, 252, 1010, 332, 700, 332, 640, 318]);
      seg(c, 650, 268, 1005, 268, 2); c.strokeStyle = LINE; c.lineWidth = 3; rr(c, 770, 284, 100, 32, 5); c.stroke();          // friso e janela de ejeção
      c.beginPath(); c.arc(700, 300, 13, 0, 2 * PI); c.stroke(); poly(c, [872, 286, 894, 310, 872, 318]); c.stroke();        // botão e defletor
      dot(c, 668, 322, 5); dot(c, 990, 322, 5); seg(c, 910, 252, 910, 332, 2);
    }],
    ['lower', 'slab', 0.15, [650, 325, 1010, 445], [0, -0.55, 0], 9, function (c) {
      fillP(c, [660, 332, 1000, 332, 1000, 360, 962, 360, 962, 434, 862, 434, 862, 386, 790, 386, 770, 400, 700, 400, 660, 372]);
      dot(c, 742, 356, 10, GOLD); seg(c, 742, 356, 760, 344, 4, GOLD); dot(c, 882, 372, 7); dot(c, 690, 346, 5); dot(c, 962, 346, 5);
      c.strokeStyle = LINE; c.lineWidth = 2; c.strokeRect(906, 340, 14, 22); seg(c, 862, 400, 962, 400, 2);
    }],
    ['handguard', 'slab', 0.19, [1000, 250, 1490, 350], [0.6, 0, 0], 7, function (c) {
      fillP(c, [1010, 262, 1470, 262, 1480, 274, 1480, 326, 1470, 338, 1010, 338]);
      hole(c, function () { for (var i = 0; i < 6; i++) { rr(c, 1040 + i * 72, 275, 50, 16, 7); c.fill(); rr(c, 1040 + i * 72, 309, 50, 16, 7); c.fill(); } });   // rasgos de ventilação
      seg(c, 1012, 300, 1478, 300, 2); dot(c, 1024, 268, 4); dot(c, 1466, 268, 4); dot(c, 1024, 332, 4); dot(c, 1466, 332, 4);
    }],
    ['barrel', 'round', 0, [1000, 262, 1845, 332], [1.25, 0, 0], 6, function (c) {
      c.fillStyle = BASE; c.fillRect(1010, 290, 826, 20); c.fillRect(1010, 271, 500, 8); rr(c, 1500, 274, 58, 52, 6); c.fill();   // cano, tubo de gás e bloco de gás
      seg(c, 1700, 290, 1700, 310, 3); seg(c, 1760, 290, 1760, 310, 2); seg(c, 1514, 274, 1514, 326, 2); seg(c, 1544, 274, 1544, 326, 2);
    }],
    ['muzzle', 'round', 0, [1830, 270, 1970, 330], [2.05, 0, 0], 5, function (c) {
      fillP(c, [1836, 284, 1950, 280, 1962, 288, 1962, 312, 1950, 320, 1836, 316]);
      hole(c, function () { for (var i = 0; i < 3; i++) { rr(c, 1858 + i * 30, 291, 15, 18, 4); c.fill(); } });
      seg(c, 1958, 284, 1958, 316, 5, GOLD); seg(c, 1846, 284, 1846, 316, 2);
    }],
    ['rail', 'slab', 0.08, [640, 190, 1480, 256], [0, 0.5, 0], 2, function (c) {
      c.fillStyle = BASE; c.fillRect(650, 240, 820, 12); for (var i = 0; i < 38; i++) c.fillRect(650 + i * 21.6, 230, 12, 10);           // trilho com dentes
      fillP(c, [662, 206, 700, 206, 700, 230, 662, 230]); fillP(c, [1410, 198, 1440, 198, 1436, 230, 1414, 230]);                       // alça e massa de mira
      hole(c, function () { c.beginPath(); c.arc(1425, 212, 6, 0, 2 * PI); c.fill(); c.beginPath(); c.arc(681, 216, 5, 0, 2 * PI); c.fill(); });
      seg(c, 650, 246, 1470, 246, 2);
    }],
    ['optic', 'round', 0, [680, 100, 1090, 230], [0, 1.2, 0], 0, function (c) {
      c.fillStyle = BASE; rr(c, 730, 152, 300, 48, 10); c.fill(); fillP(c, [1010, 142, 1078, 134, 1078, 218, 1010, 210]); fillP(c, [690, 140, 742, 148, 742, 204, 690, 212]);
      c.fillStyle = BASE; rr(c, 852, 112, 56, 42, 6); c.fill();                                                                         // torre de regulagem
      for (var i = 0; i < 6; i++) seg(c, 860 + i * 8, 114, 860 + i * 8, 136, 2);
      c.strokeStyle = LINE; c.lineWidth = 4; c.beginPath(); c.arc(880, 178, 19, 0, 2 * PI); c.stroke(); dot(c, 880, 178, 5);              // torre lateral
      seg(c, 762, 152, 762, 200, 2); seg(c, 772, 152, 772, 200, 2); seg(c, 1000, 150, 1000, 202, 2);
      c.fillStyle = GOLD; c.beginPath(); c.ellipse(1075, 176, 5, 40, 0, 0, 2 * PI); c.fill(); seg(c, 693, 144, 693, 208, 3);            // lente dourada
    }],
    ['mount', 'slab', 0.1, [765, 196, 990, 246], [0, 0.82, 0], 1, function (c) {
      fillP(c, [778, 200, 806, 200, 812, 240, 772, 240]); fillP(c, [948, 200, 976, 200, 982, 240, 942, 240]); c.fillStyle = BASE; c.fillRect(772, 232, 210, 10);
      dot(c, 792, 220, 4); dot(c, 962, 220, 4);
    }],
    ['buffer', 'round', 0, [420, 272, 660, 328], [-0.75, 0, 0], 10, function (c) {
      c.fillStyle = BASE; c.fillRect(430, 286, 214, 28); rr(c, 626, 278, 24, 44, 4); c.fill();
      for (var i = 0; i < 5; i++) seg(c, 470 + i * 28, 286, 470 + i * 28, 314, 2);
    }],
    ['stock', 'slab', 0.16, [240, 230, 530, 420], [-1.55, 0, 0], 4, function (c) {
      fillP(c, [250, 246, 300, 238, 470, 262, 520, 270, 520, 330, 455, 338, 400, 372, 300, 412, 250, 412]);
      hole(c, function () { poly(c, [312, 300, 425, 320, 312, 386]); c.fill(); });                                                        // vazado
      seg(c, 272, 246, 272, 412, 3); seg(c, 300, 252, 500, 280, 2); dot(c, 472, 302, 8); seg(c, 440, 338, 470, 352, 4);
    }],
    ['grip', 'slab', 0.14, [640, 390, 780, 575], [-0.45, -1.15, 0], 11, function (c) {
      fillP(c, [690, 398, 772, 398, 742, 470, 728, 566, 650, 566, 646, 548, 676, 470]);
      for (var i = 0; i < 6; i++) seg(c, 668 + i * 3, 480 + i * 13, 726 - i * 1, 472 + i * 13, 2); seg(c, 650, 556, 728, 556, 3);        // ranhuras
    }],
    ['magazine', 'slab', 0.12, [840, 424, 965, 650], [0.15, -1.5, 0], 3, function (c) {
      fillP(c, [868, 430, 956, 430, 948, 540, 930, 642, 850, 642, 858, 540]);
      for (var i = 0; i < 4; i++) seg(c, 862 - i * 2, 470 + i * 40, 952 - i * 5, 470 + i * 40, 2);                                       // nervuras
      c.fillStyle = LINE; c.fillRect(846, 628, 90, 14); c.fillStyle = GOLD; rr(c, 890, 446, 13, 150, 6); c.fill();                       // janela de munição
    }],
    ['trigger', 'slab', 0.05, [770, 392, 870, 460], [-0.1, -1.0, 0], 12, function (c) {
      c.strokeStyle = BASE; c.lineWidth = 8; c.beginPath(); c.moveTo(782, 398); c.quadraticCurveTo(790, 452, 830, 452); c.quadraticCurveTo(860, 452, 862, 430); c.stroke();
      c.strokeStyle = LINE; c.lineWidth = 6; c.beginPath(); c.moveTo(816, 398); c.quadraticCurveTo(806, 418, 812, 436); c.stroke();
    }],
    ['bolt', 'round', 0, [710, 260, 960, 312], [-1.25, 0.6, 0], 8, function (c) {
      c.fillStyle = BASE; rr(c, 720, 280, 214, 28, 8); c.fill(); c.fillRect(800, 268, 62, 12); c.fillRect(934, 286, 18, 16);
      dot(c, 882, 294, 6); seg(c, 760, 280, 760, 308, 2); seg(c, 780, 280, 780, 308, 2); seg(c, 944, 286, 944, 302, 2);
    }],
    ['charging', 'slab', 0.06, [598, 248, 666, 274], [-1.65, 0.95, 0], 13, function (c) { fillP(c, [604, 254, 660, 254, 660, 268, 622, 268, 604, 262]); seg(c, 612, 258, 640, 258, 2); }],
    ['foregrip', 'slab', 0.12, [1170, 332, 1270, 446], [0.95, -1.05, 0], 14, function (c) {
      fillP(c, [1180, 338, 1262, 338, 1250, 360, 1232, 440, 1188, 440, 1196, 360]);
      for (var i = 0; i < 4; i++) seg(c, 1200, 376 + i * 15, 1238 - i * 2, 376 + i * 15, 2);
    }]
  ];
  var TONE = [0.38, 0.33, 0.27, 0.38, 0.42, 0.38, 0.32, 0.38, 0.33, 0.26, 0.26, 0.3, 0.48, 0.46, 0.42, 0.26];   // tom de base de cada peça
  var nModel = Math.min(nBC - cnt(2400), cnt(19000)), nExtra = nBC - nModel;
  var gunPts = new Float32Array(nModel * 5), gunPart = new Uint8Array(nModel);   // x, y, z, calor, brilho
  // Três famílias de pontos por peça: a superfície (malha regular, com relevo nas bordas), o contorno e os traços de detalhe.
  (function () {
    var cv = document.createElement('canvas'); cv.width = GW; cv.height = GH;
    var ctx = cv.getContext('2d', { willReadFrequently: true }), r = rng(65), rast = [], area = 0, nEdge = 0, nDet = 0, o = 0;
    PARTS.forEach(function (P) {
      ctx.clearRect(0, 0, GW, GH); P[6](ctx);
      var bx = P[3], w = bx[2] - bx[0], h = bx[3] - bx[1], d = ctx.getImageData(bx[0], bx[1], w, h).data, dist = new Float32Array(w * h), edge = [], det = [], x, y, q;
      for (q = 0; q < w * h; q++) dist[q] = d[q * 4 + 3] > 90 ? 999 : 0;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { q = y * w + x; if (dist[q]) dist[q] = Math.min(dist[q], (x ? dist[q - 1] : 0) + 1, (y ? dist[q - w] : 0) + 1); }
      for (y = h - 1; y >= 0; y--) for (x = w - 1; x >= 0; x--) { q = y * w + x; if (dist[q]) dist[q] = Math.min(dist[q], (x < w - 1 ? dist[q + 1] : 0) + 1, (y < h - 1 ? dist[q + w] : 0) + 1); }
      for (q = 0; q < w * h; q++) if (dist[q]) { area++; if (dist[q] <= 1.5) edge.push(q); if (d[q * 4] > 158) det.push(q); }
      rast.push({ w: w, h: h, d: d, dist: dist, edge: edge, det: det }); nEdge += edge.length; nDet += det.length;
    });
    function put(pi, x, y, z, h, k) { if (o >= nModel) return; gunPts[o * 5] = x; gunPts[o * 5 + 1] = y; gunPts[o * 5 + 2] = z; gunPts[o * 5 + 3] = h; gunPts[o * 5 + 4] = k; gunPart[o] = pi; o++; }
    // de um ponto do desenho (px, py dentro da caixa da peça) para a posição e a luz na peça. kind: 0 frente | 1 verso | 2 contorno | 3 traço
    function place(pi, px, py, kind) {
      var P = PARTS[pi], R = rast[pi], bx = P[3], ix = Math.min(R.w - 1, Math.floor(px)), iy = Math.min(R.h - 1, Math.floor(py)), q = iy * R.w + ix, dd = R.dist[q];
      var x = (bx[0] + px - GX0) * SCL, y = -(bx[1] + py - GY0) * SCL, tone = TONE[pi], z, h, k = 0.9;
      var gold = R.d[q * 4] > 200 && R.d[q * 4 + 2] < 120;
      // inclinação da borda (da distância até o contorno): bordas viradas para a luz, que vem de cima e da esquerda, acendem
      var gx = R.dist[Math.min(R.w * R.h - 1, q + 1)] - R.dist[Math.max(0, q - 1)], gy = R.dist[Math.min(R.w * R.h - 1, q + R.w)] - R.dist[Math.max(0, q - R.w)], gl = Math.hypot(gx, gy) || 1;
      var lit = (gx * 0.45 + gy * 0.89) / gl, bevel = clamp(1 - dd / 5, 0, 1);
      if (P[1] === 'round') {   // cilindro: o raio é metade do trecho contínuo desta coluna do desenho
        var top = iy, bot = iy; while (top > 0 && R.dist[(top - 1) * R.w + ix]) top--; while (bot < R.h - 1 && R.dist[(bot + 1) * R.w + ix]) bot++;
        var rad = (bot - top + 1) / 2 * SCL, dy = clamp((py - (top + bot + 1) / 2) * SCL, -rad, rad), zm = Math.sqrt(Math.max(0, rad * rad - dy * dy));
        z = kind === 1 ? -zm : kind === 2 ? (r() * 2 - 1) * zm : zm;
        h = tone * 0.6 + 0.62 * Math.pow(Math.max(0, (-dy / rad) * 0.8 + (z / rad) * 0.6), 1.5);
        if (kind === 1) { h = tone * 0.4; k = 0.6; } else if (kind === 2) h = 0.6 + 0.3 * Math.max(0, -dy / rad);
      } else {
        var T = P[2], rise = Math.min(1, Math.sqrt(dd / 5));
        if (kind === 2) { z = (r() * 2 - 1) * T; h = 0.72 + 0.26 * lit; }
        else if (kind === 1) { z = -T * rise; h = tone * 0.45; k = 0.6; }
        else { z = T * rise; h = tone + bevel * (lit > 0 ? 0.55 * lit : 0.14 * lit) + 0.07 * (1 - py / R.h); }
      }
      if (kind === 3) { h = 0.98; k = 1.1; if (gold) { h = 2.85; k = 1.4; } }
      else if (gold) { h = 2.6; k = 1.1; }
      put(pi, x, y, z, clamp(h, 0.03, gold ? 3 : 1), k);
    }
    // superfície: malha em colmeia, mais fechada na frente que no verso; o passo sai do total de pontos disponível
    var nSurf = Math.round(nModel * 0.55), step = Math.sqrt(area * (1 + 1 / 2.9) / (0.866 * nSurf)) * 1.01, list;
    function lattice(st, kind) {
      PARTS.forEach(function (P, pi) {
        var R = rast[pi], row = 0;
        for (var y = st * 0.5; y < R.h; y += st * 0.866, row++) for (var x = st * (row % 2 ? 0.75 : 0.25); x < R.w; x += st) if (R.dist[Math.floor(y) * R.w + Math.floor(x)] > 0) list.push(pi, x, y, kind);
      });
    }
    for (var tries = 0; tries < 6; tries++) { list = []; lattice(step, 0); lattice(step * 1.7, 1); if (list.length / 4 <= nSurf) break; step *= 1.02; }
    for (var i = 0; i < list.length; i += 4) place(list[i], list[i + 1], list[i + 2], list[i + 3]);
    // contorno e traços: sorteados sobre os pixels de cada um, em fila, para saírem contínuos
    var left = nModel - o, forEdge = Math.round(left * 0.56);
    function strokes(key, total, n, kind) {
      PARTS.forEach(function (P, pi) {
        var R = rast[pi], px = R[key], m = Math.round(n * px.length / Math.max(1, total));
        for (var j = 0; j < m; j++) { var q = px[Math.min(px.length - 1, Math.floor((j + r()) / m * px.length))], x = q % R.w; place(pi, x + r(), (q - x) / R.w + r(), kind); }
      });
    }
    strokes('edge', nEdge, forEdge, 2); strokes('det', nDet, left - forEdge, 3);
    while (o < nModel) { var pi = Math.floor(r() * PARTS.length), E2 = rast[pi].edge, q2 = E2[Math.floor(r() * E2.length)], x2 = q2 % rast[pi].w; place(pi, x2 + r(), (q2 - x2) / rast[pi].w + r(), 2); }   // arredondamento
  })();
  // Todas as cenas a partir da arma são vistas do mesmo lado da queda. scn() leva coordenadas "de tela"
  // (x para a direita, y para cima, z para a câmera) para o mundo, em volta do ponto onde a arma repousa.
  var MZL = [(1962 - GX0) * SCL, 0, 0], Q_REST = Q.axis(0, 1, 0, PI);
  var TILT_AX = unit([0, DB[2], -DB[1]]), TILT = Math.acos(clamp(-DB[0], -1, 1)), Q_AIM = Q.mul(Q.axis(TILT_AX[0], TILT_AX[1], TILT_AX[2], TILT), Q_REST);
  var O_AIM = add(MUZ, Q.rot(Q_AIM, MZL), -1), G0 = [O_AIM[0] + 1.0, O_AIM[1] - 0.25, O_AIM[2]];
  function scn(x, y, z) { return [G0[0] - x, G0[1] + y, G0[2] - z]; }
  var SMALL = 0.4, HUD_K = 0.36, BENCH_Y = -3.15;
  var nStream = Math.round(nExtra * 0.35), nRays = nExtra - nStream;
  function spare(s, form, k) { shots(s, nRays, form, 66, 1); stream(s, nStream, k); }   // os pontos que sobram da arma, durante a queda e os tiros
  function smallAt() { return E.portrait ? [0.3, 4.7, 0] : [4.3, 3.3, 0]; }     // a arma pequena fica ao lado do código (acima dele em telas em pé)
  function hudGunAt() { return E.portrait ? [-1.6, -5.4, 0.3] : [5.65, -1.8, 0.3]; }
  // pose: 'aim' (atirando), 'rest' (de perfil), 'open' (explodida), 'small' (explodida, pequena, ao lado do código), 'hud' (montada, na HUD)
  // extra: o que fazem os pontos que sobram da arma: 'rays' raios de luz | 'shots' tiros | 'fire' tiros e a rajada contínua |
  //        'bench' grade da bancada | 'benchOff' a mesma grade, apagada | 'floor' chão do jogo
  function gunPoints(s, pose, extra, k) {
    var m = Q.mat(Q_AIM), hg = hudGunAt(), sm = smallAt(), i, p; k = k === undefined ? 1 : k;
    if (pose === 'small') k *= E.small ? 0.6 : 0.34; else if (pose === 'hud') k *= E.small ? 0.5 : 0.22;   // pequena, os pontos se juntam: menos brilho em cada um
    for (i = 0; i < nModel; i++) {
      var x = gunPts[i * 5], y = gunPts[i * 5 + 1], z = gunPts[i * 5 + 2], off = PARTS[gunPart[i]][4];
      if (pose === 'aim') p = [O_AIM[0] + m[0] * x + m[1] * y + m[2] * z, O_AIM[1] + m[3] * x + m[4] * y + m[5] * z, O_AIM[2] + m[6] * x + m[7] * y + m[8] * z];
      else if (pose === 'rest') p = scn(1.0 + x, 0.25 + y, z);
      else if (pose === 'open') p = scn(0.3 + x + off[0], 0.3 + y + off[1], z + off[2]);
      else if (pose === 'small') p = scn(sm[0] + (x + off[0]) * SMALL, sm[1] + (y + off[1]) * SMALL, sm[2] + z * SMALL);
      else p = scn(hg[0] + x * HUD_K, hg[1] + y * HUD_K, hg[2] + z * HUD_K);
      s.put(p[0], p[1], p[2], gunPts[i * 5 + 3], gunPts[i * 5 + 4] * k);
    }
    if (extra === 'bench' || extra === 'benchOff') {   // grade da bancada onde a arma repousa
      var kb = extra === 'bench' ? 1 : 0, nx = Math.round(Math.sqrt(nExtra * 2.3)), nz = Math.floor(nExtra / nx), c = 0;
      for (var iz = 0; iz < nz; iz++) for (var ix = 0; ix < nx; ix++, c++) {
        var gx = -8 + ix / (nx - 1) * 19, gz = -4.2 + iz / (nz - 1) * 8.4, line = Math.abs(gx - Math.round(gx)) < 0.04 || Math.abs(gz - Math.round(gz)) < 0.05;
        p = scn(gx, BENCH_Y, gz); s.put(p[0], p[1], p[2], line ? 0.55 : 0.14, 0.6 * kb);
      }
      for (; c < nExtra; c++) { p = scn(1, BENCH_Y, 0); s.put(p[0], p[1], p[2], 0.14, 0.4 * kb); }
    } else if (extra === 'floor') {      // o chão do jogo: uma baseplate que some no horizonte
      var rows = Math.max(8, Math.round(Math.sqrt(nExtra / 5))), cols = Math.floor(nExtra / rows), q = 0;
      for (var jz = 0; jz < rows; jz++) for (var jx = 0; jx < cols; jx++, q++) { p = scn(-34 + jx / (cols - 1) * 68, E.portrait ? -9.5 : -5.6, -3 - Math.pow(jz / (rows - 1), 1.6) * 80); s.put(p[0], p[1], p[2], 0.3, 0.5); }
      for (; q < nExtra; q++) { p = scn(0, -5.6, -40); s.put(p[0], p[1], p[2], 0.2, 0.3); }
    } else spare(s, extra === 'rays' ? 0 : 1, extra === 'fire' ? 1 : 0);
  }
  // etiquetas da vista explodida: ficam logo acima (ou abaixo) de cada peça nomeada
  var LABELS = { scope: [6, 880, 96], barrel: [3, 1650, 268], receiver: [0, 830, 232], magazine: [11, 905, 672], stock: [9, 380, 222] };   // [peça, x, y no desenho]
  Object.keys(LABELS).forEach(function (k) {
    var L = LABELS[k], off = PARTS[L[0]][4];
    E.anchor(k, function () { return scn(0.3 + (L[1] - GX0) * SCL + off[0], 0.3 - (L[2] - GY0) * SCL + off[1], 0); });
  });
  function motes(s, n, seed, k) {        // poeira de luz em volta da arma
    var r = rng(seed);
    for (var i = 0; i < n; i++) { var p = scn(1 + (r() - 0.5) * 24, -2 + r() * 9, (r() - 0.5) * 14); s.put(p[0], p[1], p[2], r() < 0.12 ? -1 : 0.2 + r() * 0.4, k); s.flowLast(0, 2.4, 0, r()); }
  }

  // ---------- Cenas da queda (a mesma ordem de pontos do xadrez: A, BC, D, EF) ----------
  // onde está a bala principal em cada cena: ela anda no mesmo passo dos outros brilhos até o estalo
  var GLOW = [add(HIT, DB, -1.55 - SLOW), add(HIT, DB, -1.55 - SLOW * 0.2), add(HIT, DB, -1.55), add(HIT, DB, 34)];
  // o: state, pieces (as peças ainda caem, apagadas) ou gunK (brilho da arma, que espera fora de quadro), hit (peão estilhaçado), light: { hero, form, flash }
  function fall(o) {
    return function () {
      var s = new E.Shape(), poses = st[o.state];
      C.writeBoard(s, poses, { crack: true, k: o.shards });
      // as peças caem apagadas; os pontos das últimas (douradas) se soltam e viram raios de luz
      if (o.pieces) { C.SET.forEach(function (p) { if (p !== PREY) C.writePiece(s, p, poses[p.id], 0); }); s.n = nA + nModel; spare(s, 0, 0); }
      else gunPoints(s, 'aim', o.hit ? 'fire' : o.light.form ? 'shots' : 'rays', o.gunK);
      if (o.hit) chunks(s, 1, 1.15); else C.writePiece(s, PREY, poses[PREY.id], 1);
      lights(s, o.light);
      return s;
    };
  }
  var pA = center(st.fallA[PREY.id]), pB = center(st.fallB[PREY.id]), slow = { size: 0.04, gain: 0.8, vary: 0.7, dof: 0.14 };
  function fscene(name, o, clock, cam, look) { look = look || slow; E.scene(name, { make: fall(o), clock: clock, size: look.size, gain: look.gain, vary: look.vary, dof: look.dof, cam: cam }); }
  fscene('fallA', { state: 'fallA', shards: 0.8, pieces: true, light: { hero: GLOW[0], form: 0, flash: 0 } }, 'slow', { az: 176, el: 8, r: 7.4, t: pA, ox: 0.07 });
  fscene('fallB', { state: 'fallB', shards: 0.8, gunK: 0, light: { hero: GLOW[1], form: 0, flash: 0 } }, 'slow', { az: 178, el: 3, r: 6.4, t: add(pB, DB, -1.1), ox: 0.07 });
  fscene('fallSnap', { state: 'fallSnap', shards: 0.8, gunK: 1, light: { hero: GLOW[2], form: 1, flash: 2.4 } }, 'fire', { az: 178, el: 2, r: 4.3, t: add(HIT, DB, -0.9), ox: 0.06, tall: 1.25 }, { size: 0.034, gain: 0.8, vary: 0.5, dof: 0.22 });
  fscene('fallHit', { state: 'fallHit', shards: 0.5, gunK: 1, hit: true, light: { hero: GLOW[3], form: 1, flash: 2.4 } }, 'fire', { az: 176, el: 3, r: 8.2, t: add(HIT, DB, 1.4), ox: 0.07, tall: 1 }, { size: 0.042, gain: 0.82, vary: 0.7, dof: 0.1 });
  var G_MID = add(O_AIM, Q.rot(Q_AIM, [0.4, 0, 0]));
  E.scene('gunFiring', { make: function () { return E.need('fallHit'); }, clock: 'fire', size: 0.04, gain: 0.85, vary: 0.5, dof: 0.05, cam: { az: 180, el: 4, r: 12.5, t: add(G_MID, DB, 2.2), ox: 0, tall: 1.5 } });

  // ---------- Cenas da arma ----------
  function bench(pose, cam, size) {
    return {
      make: function () { var s = new E.Shape(); motes(s, nA, 67, 0.34); gunPoints(s, pose, 'bench'); motes(s, nD, 68, 0.3); motes(s, nEF, 69, 0.4); return s; },
      rate: 0.1, size: size, gain: 0.8, vary: 0.15, dof: 0.04, cam: cam
    };
  }
  E.scene('gunRest', bench('rest', { az: 180, el: 6, r: 9.6, t: scn(1.4, 0.0, 0), ox: 0.04, tall: 1.4 }, 0.036));
  E.scene('gunTurn', { make: function () { return E.need('gunRest'); }, rate: 0.1, size: 0.036, gain: 0.8, vary: 0.15, dof: 0.04, cam: { az: 180, el: 9, r: 9.2, t: scn(1.4, 0.0, 0), ox: 0.04, tall: 1.45 } });
  E.scene('gunExploded', bench('open', { az: 180, el: 7, r: 14.2, t: scn(1.0, 0.0, 0), ox: 0.09, tall: 1.14 }, 0.036));

  // ---------- Texto: código e HUD usam as faixas A, D e EF, nesta ordem ----------
  // pts: [x, y em px a partir do centro, r, g, b] de cada ponto; put(j) escreve o ponto j
  function withText(s, put, gun) {
    var j = 0, i;
    for (i = 0; i < nA; i++) put(j++);
    gun(s);
    for (i = 0; i < nD + nEF; i++) put(j++);
  }
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
  var KEY = /^(local|function|end|if|then|return|for|in|do|not|and|or|else|true|false|nil)$/, codeLine = new Float32Array(nText);
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
    withText(s, function (j) {
      var p = scn(pts[j * 5] * k - (E.portrait ? 0 : 0.6), pts[j * 5 + 1] * k - 0.7, (r() - 0.5) * 0.1);   // em telas em pé o painel fica centrado
      s.rgb(p[0], p[1], p[2], pts[j * 5 + 2], pts[j * 5 + 3], pts[j * 5 + 4]);
      codeLine[j] = clamp((350 - pts[j * 5 + 1] - y0 + lh / 2) / lh / CODE.length, 0, 1);   // em que linha o ponto caiu (0 = primeira)
    }, function () { gunPoints(s, 'small', 'benchOff'); });
    return s;
  }
  E.scene('code', { make: code, layout: true, rate: 0.1, size: 0.044, gain: 0.74, vary: 0.3, dof: 0.04, cam: { az: 180, el: 0, r: 18.5, t: scn(0, 0.3, 0), ox: 0.13, tall: 0.74 } });

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
      var s = new E.Shape(), r = rng(91), L = hudLayout(), k = 0.01;
      var base = E.sample(L.w, L.h, nHudBase, 81, function (ctx) { hudBase(ctx, L); });
      var scr = E.sample(L.w, L.h, nScreen, 82, function (ctx) { hudScreen(ctx, L, on); });
      var btn = E.sample(L.w, L.h, nButton, 83, function (ctx) { hudButton(ctx, L, on); });
      // cursor: uma seta que vai até o botão
      var tip = on ? [(L.button[0] - L.w / 2 + 70) * k, -(L.button[1] - L.h / 2 + 4) * k, 0.3] : [(L.button[0] - L.w / 2 + 420) * k, -(L.button[1] - L.h / 2 - 260) * k, 0.6];
      withText(s, function (j) {
        var src = base, q = j, gain = 1, p;
        if (j >= nHudBase + nScreen + nButton) {
          var u = r(), v = r() * (1 - u) * 0.62; if (r() < 0.35) v = r() < 0.5 ? 0 : (1 - u) * 0.62;
          p = scn(tip[0] + v * 0.5, tip[1] - u * 0.62 - v * 0.12, tip[2]); s.put(p[0], p[1], p[2], 1, 1.3); return;
        }
        if (j >= nHudBase + nScreen) { src = btn; q = j - nHudBase - nScreen; gain = on ? 1.4 : 1; }
        else if (j >= nHudBase) { src = scr; q = j - nHudBase; gain = on ? 1.7 : 1; }
        p = scn(src[q * 5] * k, src[q * 5 + 1] * k, (r() - 0.5) * 0.06);
        s.rgb(p[0], p[1], p[2], src[q * 5 + 2] * gain, src[q * 5 + 3] * gain, src[q * 5 + 4] * gain);
      }, function () { gunPoints(s, 'hud', 'floor'); });
      this.cam.r = E.portrait ? (on ? 11.3 : 11.9) : (on ? 17 : 18);   // a HUD inteira cabe entre as faixas de cinema
      return s;
    };
  }
  E.scene('hud', { make: hud(false), text: true, layout: true, rate: 0.1, size: 0.04, gain: 0.66, vary: 0.2, dof: 0.02, cam: { az: 180, el: 0, r: 18, t: scn(0, 0, 0), ox: 0, tall: 1 } });
  E.scene('hudOn', { make: hud(true), text: true, layout: true, rate: 0.1, size: 0.04, gain: 0.9, vary: 0.2, dof: 0.02, cam: { az: 180, el: 0, r: 17, t: scn(0, 0, 0), ox: 0, tall: 1 } });

  // ---------- O mar de luz, de volta, no lugar onde o filme terminou ----------
  E.scene('waveEnd', {
    make: function () {
      var w = E.need('wave'), s = new E.Shape();
      for (var i = 0; i < N; i++) { var p = scn(w.pos[i * 3], w.pos[i * 3 + 1], w.pos[i * 3 + 2]); s.rgb(p[0], p[1], p[2], w.col[i * 3], w.col[i * 3 + 1], w.col[i * 3 + 2]); }
      return s;
    },
    wave: 1, size: 0.085, gain: 0.82, vary: 1, dof: 0.07, cam: { az: 180, el: 25, r: 10.5, t: scn(0, 0.2, 0), ox: 0, tall: 1 }
  });

  // ---------- Papéis dos pontos e movimentos rígidos ----------
  var G_GUN = 120;
  function textOrd(i) { return i < nA ? i : i >= ef0 ? nA + nD + i - ef0 : i >= d0 ? nA + i - d0 : -1; }   // posição do ponto na fila do texto (-1: é da arma)
  function roles(fn) { return function () { C.layout(); var a = new Float32Array(N * 4), r = rng(48); for (var i = 0; i < N; i++) fn(a, i * 4, i, r); return a; }; }
  function riding(a, o, i) { if (i < nA) a[o + 3] = C.gid[i]; else if (i >= d0 && i < ef0) a[o + 3] = PREY.id; }   // cacos e peão giram inteiros
  // a queda continua: cacos, peão e as outras peças (que se apagam) giram inteiros; a poeira se junta em brilhos de luz
  E.fx('fallIn', roles(function (a, o, i) { if (i < nA + nModel || (i >= d0 && i < ef0)) a[o + 3] = C.gid[i]; else a[o + 2] = 0.4; }));
  // câmera lenta: só os cacos e o peão giram; os pontos das peças viajam, apagados, até onde a arma espera
  E.fx('fallDrift', roles(riding));
  // o brilho se condensa na bala
  E.fx('condense', roles(function (a, o, i, r) { riding(a, o, i); if (i >= ef0 && i < ef0 + nHB + nHT) { a[o] = r() * 0.35; a[o + 2] = 0.12; } }));
  // a bala atravessa; cada estilhaço do peão sai girando; os cacos somem para baixo
  E.fx('pawnHit', roles(function (a, o, i) { if (i < nA) a[o + 3] = C.gid[i]; else if (i >= d0 && i < ef0) a[o + 3] = G_CHUNK + chunkOf[i - d0]; }));
  // a arma gira inteira; a bancada aparece e a poeira chega
  function gunRig(loose) { return roles(function (a, o, i, r) { if (i >= nA && i < nA + nModel) a[o + 3] = G_GUN; else if (loose) { a[o] = r(); a[o + 2] = 0.5; } }); }
  E.fx('level', gunRig(true));
  E.fx('turn', gunRig(false));
  // desmontagem: uma peça de cada vez
  E.fx('strip', roles(function (a, o, i) { if (i >= nA && i < nA + nModel) a[o] = PARTS[gunPart[i - nA]][5] / 15; }));
  // o código é escrito linha a linha; a arma só encolhe para o canto
  E.fx('write', roles(function (a, o, i, r) { var t = textOrd(i); if (t >= 0) { E.need('code'); a[o] = codeLine[t] * 0.85 + r() * 0.08; a[o + 2] = 0.3; } else if (i >= nA + nModel) { a[o] = r(); a[o + 2] = 0.3; } }));
  // o código vira HUD; a arma se remonta e vai para o canto da tela
  E.fx('toHud', roles(function (a, o, i, r) { if (textOrd(i) >= 0 || i >= nA + nModel) { a[o] = r(); a[o + 2] = 0.45; } }));
  // o cursor chega, o botão acende e só então a mira dá lugar à mensagem
  E.fx('click', roles(function (a, o, i, r) {
    var t = textOrd(i);
    if (t >= nHudBase && t < nHudBase + nScreen) { a[o] = 0.6 + r() * 0.4; a[o + 2] = 0.5; }
    else if (t >= nHudBase + nScreen && t < nHudBase + nScreen + nButton) { a[o] = 0.55; a[o + 2] = 0.1; }
  }));
  E.rig('level', function () { var g = new Float32Array(E.GROUPS * 16); E.rigRow(g, G_GUN, O_AIM, O_AIM, TILT_AX, -TILT, 0); return g; });
  // o giro completo: uma volta inteira em torno do eixo vertical, no meio da arma
  E.rig('turn', function () { var g = new Float32Array(E.GROUPS * 16), c = scn(1.4, 0.25, 0); E.rigRow(g, G_GUN, c, c, [0, 1, 0], 2 * PI, 0); return g; });
});
