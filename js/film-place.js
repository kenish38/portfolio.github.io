// ===== O lugar que o filme constrói: o saguão =====
// Um saguão grandioso, de pedra e ferro, com uma estátua no centro da escadaria. O filme o mostra na ordem de um
// trabalho de verdade num jogo:
//   base    a baseplate vazia
//   plan    a planta riscada no chão
//   ruin    o saguão sobe do chão, já modelado como ruína: colunas caídas, arcos e abóbada quebrados, entulho
//   rays    a luz: fachos de sol entram pelo teto aberto, poeira no ar, névoa rente ao chão, a luz da estátua acende
//   swarm   os sistemas: drones de reparo descem e apontam os feixes para o que está quebrado
//   mendA   ... e as peças voam de volta para o lugar (coluna, arcos e abóbada do lado esquerdo)
//   mendB   ... depois a escada, as balaustradas, a coluna do fundo e a grade da janela
//   clean   os drones vão embora: o saguão está inteiro
//   deco    a decoração: estandartes, tapete, plantas, lanternas e flores (o capítulo de engenharia de IA)
// Cada ponto tem um lugar fixo no "modelo": onde fica com o saguão inteiro (p), onde fica na ruína (q) e de onde nasce
// (s). As cenas só dizem qual dos três vale e com que luz: de uma cena para outra cada ponto vai direto para o lugar dele.
// Os volumes escondem o que está atrás por causa dos sólidos invisíveis do motor (ver "Sólidos" em js/matter.js).
// Tudo aqui é desenho original, gerado por código; o rosto da estátua é esculpido com formas somadas (ver faceSDF).
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  var N = E.N, clamp = E.clamp, PI = Math.PI, KQ = Math.sqrt(E.K);
  function frac(v) { return v - Math.floor(v); }
  function hash2(a, b) { return frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453); }
  function unit(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function mixv(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // ---------- O projeto ----------
  // x cresce para a direita de quem entra e z para a entrada (a câmera olha de +z para -z). O piso fica em y = 0.
  var FX = 5.5, FZ0 = -8.5, FZ1 = 5.5;                       // piso: de -FX a FX, de FZ0 (fundo) a FZ1 (entrada)
  var NAVE = 3.6, COLZ = [3.4, 1.1, -1.2, -3.5, -5.8], COLR = 0.36, CAP = 4.8, CORN = 6.3, SPRING = 6.5, VR = 3.25;   // colunas, arcos, abóbada
  var ST_X = 2.1, ST_Z = 1.2, STEPS = 8, RUN = 0.35, RISE = 0.15, LAND = 1.2, LAND_Z0 = -4.4, LAND_Z1 = -1.6, LAND_X = 3.25;   // escadaria e patamar
  var GAL = 2.4, GAL_Z = -5.6;                               // galeria do fundo
  var EMB = [0, 3.35], EMB_R = 1.7;                          // o brasão do piso
  var SO = [0, LAND + 1.07, -2.75];                          // pés da estátua (em cima do pedestal)
  var HEAD = [SO[0], SO[1] + 2.26, SO[2] + 0.03], HS = 0.135;        // centro e meia altura da cabeça
  var CUBE = [SO[0] + 0.46, SO[1] + 2.9, SO[2] + 0.1];               // o cubo de luz que a estátua ergue
  var SUN = unit([0.26, 0.88, -0.4]);                        // de onde vem o sol (entra pelo teto, por trás da estátua)
  var KEY = unit([-0.35, 0.7, 0.62]);                        // luz suave de modelagem (cena sem sol)
  // fachos de sol: [x, y, z do ponto em que o eixo toca, raio, força]
  var SHAFTS = [[SO[0], SO[1] + 1.4, SO[2], 1.55, 1], [-1.3, 0.4, 1.4, 1.05, 0.85], [1.7, 0, 3.7, 0.8, 0.7], [-2.7, GAL, -6.6, 0.9, 0.6]];
  // drones: onde trabalham e o que consertam (o feixe vai do drone ao alvo)
  var DRONES = [
    { at: [-2.5, 3.5, 1.7], to: [-NAVE, 2.1, COLZ[1]] }, { at: [-0.9, 7.2, 1.9], to: [-2.4, 8.3, COLZ[1]] },
    { at: [2.9, 2.1, 1.5], to: [1.7, 0.4, 0.7] }, { at: [2.3, 5.0, -2.9], to: [NAVE, 3.9, COLZ[3]] }
  ];

  // ---------- O modelo: um lugar para cada ponto ----------
  // kind: G piso | F superfície (recebe luz pela normal) | L traço (aresta, moldura) | M quem emite luz | X feixe dos drones | V efeito no ar | Z sobra
  var G = 0, F = 1, L = 2, M = 3, X = 4, V = 5, Z = 6;
  // mat: do que é feito (tom e brilho de base)
  var STONE = 0, MARBLE = 1, IRON = 2, CLOTH = 3, LEAF = 4, GOLD = 5, GLASS = 6, RUG = 7, SHELL = 8;
  // cat: a que conjunto pertence (decide quando aparece e onde fica)
  var HALL = 0, DECO = 1, DRONE = 2, AIR = 3;
  var px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);      // com o saguão inteiro
  var qx = new Float32Array(N), qy = new Float32Array(N), qz = new Float32Array(N);      // na ruína
  var sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N);      // de onde nasce
  var nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);      // para onde a superfície olha
  var fvx = new Float32Array(N), fvy = new Float32Array(N), fvz = new Float32Array(N), fph = new Float32Array(N);   // trajeto e fase de quem corre (fase < 0: parado)
  var kind = new Uint8Array(N), mat = new Uint8Array(N), cat = new Uint8Array(N), tag = new Uint8Array(N), grp = new Uint8Array(N);
  var tex = new Float32Array(N), psz = new Float32Array(N), dly = new Float32Array(N), fxd = new Float32Array(N), rnd = new Float32Array(N);
  var cnt = 0, sp = 0.04, jr = E.rng(7), OCC = [], BALL = [], SOL = [], GLOW = [], DRY = false, ABS = false;
  var PT = 0.064 / Math.sqrt(E.K);                           // tamanho, no cenário, de um ponto de tamanho 1
  // estado de quem está sendo gerado: material, conjunto, textura, tamanho do ponto, atraso ao subir, grupo e atraso do conserto,
  // semente (de onde nasce; sem ela, do pé da própria peça) e a queda (função que leva o ponto ao lugar dele na ruína)
  var MAT = STONE, CAT = HALL, TEX = 1, FINE = 1, DLY = 0, GRP = 0, FIX = 0, SEED = null, RUIN = null;
  function add(k, x, y, z, ax, ay, az, t) {
    var i = cnt++; if (i >= N) return -1;
    px[i] = x; py[i] = y; pz[i] = z; nx[i] = ax; ny[i] = ay; nz[i] = az; kind[i] = k; mat[i] = MAT; cat[i] = CAT; tag[i] = t || 0; grp[i] = GRP;
    tex[i] = TEX; psz[i] = FINE; dly[i] = DLY; fxd[i] = FIX; fph[i] = -1;
    if (SEED) { sx[i] = SEED[0]; sy[i] = SEED[1]; sz[i] = SEED[2]; } else { sx[i] = x; sy[i] = 0; sz[i] = z; }
    if (RUIN) { var q = RUIN(x, y, z); qx[i] = q[0]; qy[i] = q[1]; qz[i] = q[2]; } else { qx[i] = x; qy[i] = y; qz[i] = z; }
    return i;
  }
  function flow(i, vx, vy, vz, ph) { if (i >= 0) { fvx[i] = vx; fvy[i] = vy; fvz[i] = vz; fph[i] = ph; } }
  function solid(id, box, shape, kindOf) { SOL.push({ id: id, box: box, shape: shape, kind: kindOf || 0, dl: DLY, grp: GRP, fix: FIX }); }
  // atraso com que cada peça sobe do chão: da entrada para o fundo
  function rise(z) { DLY = clamp((FZ1 - z) / (FZ1 - FZ0), 0, 1) * 0.85; }

  // ---------- Ruína: para onde cada peça quebrada vai ----------
  // peça inteira que tomba: gira "ang" em torno do eixo ax (0 = x, 1 = y, 2 = z) pelo pivô e se desloca
  function fall(pv, ax, ang, off) {
    var c = Math.cos(ang), s = Math.sin(ang);
    return function (x, y, z) {
      var dx = x - pv[0], dy = y - pv[1], dz = z - pv[2], X = dx, Y = dy, Zc = dz;
      if (ax === 0) { Y = dy * c - dz * s; Zc = dy * s + dz * c; } else if (ax === 2) { X = dx * c - dy * s; Y = dx * s + dy * c; } else { X = dx * c + dz * s; Zc = -dx * s + dz * c; }
      return [pv[0] + X + off[0], Math.max(0.03, pv[1] + Y + off[1]), pv[2] + Zc + off[2]];
    };
  }
  // peça que virou entulho: um monte no chão
  function heap(cx, cy, cz, rad, hgt, sd) {
    var rr = E.rng(sd);
    return function () { var a = rr() * 2 * PI, d = Math.sqrt(rr()) * rad; return [cx + Math.cos(a) * d, cy + 0.03 + rr() * hgt * (1 - d / rad), cz + Math.sin(a) * d]; };
  }
  function broken(g, fix, fn) { GRP = g; FIX = fix; RUIN = fn; }
  function whole() { GRP = 0; FIX = 0; RUIN = null; }

  // ---------- Peças básicas ----------
  // juntas de pedra: blocos de bw por bh em fiadas alternadas (devolve quanto o ponto brilha)
  function stone(u, v, bw, bh) {
    var r = Math.floor(v / bh), fu = frac(u / bw + (r % 2) * 0.5), fv = frac(v / bh);
    return (fu < 0.05 || fv < 0.1 ? 0.5 : 1) * (0.84 + 0.3 * hash2(r * 7 + 1, Math.floor(u / bw + (r % 2) * 0.5)));
  }
  // malha num retângulo: origem o, lados U e V, levemente embaralhada (como uma digitalização).
  // each(u, v) diz se o ponto entra (0 = não) e quanto brilha
  function quad(k, o, U, V, st, n, each, t) {
    var lu = Math.hypot(U[0], U[1], U[2]), lv = Math.hypot(V[0], V[1], V[2]), nu = Math.max(1, Math.round(lu / st)), nv = Math.max(1, Math.round(lv / st)), f0 = FINE;
    if (!ABS) FINE = f0 * clamp(st / sp, 0.3, 2.4);                            // malha mais aberta, ponto maior: a superfície continua cheia
    for (var j = 0; j < nv; j++) for (var i = 0; i < nu; i++) {
      var a = (i + 0.5 + (jr() - 0.5) * 0.7) / nu, c = (j + 0.5 + (jr() - 0.5) * 0.7) / nv, m = each ? each(a * lu, c * lv) : 1;
      if (!m) continue;
      var q = add(k, o[0] + U[0] * a + V[0] * c, o[1] + U[1] * a + V[1] * c, o[2] + U[2] * a + V[2] * c, n[0], n[1], n[2], t);
      if (q >= 0) tex[q] *= m;
    }
    FINE = f0;
  }
  function line(a, b, st, t, n, k) {
    n = n || [0, 1, 0];
    for (var i = 0, m = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / st)); i < m; i++) { var f = (i + 0.5) / m; add(k === undefined ? L : k, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, n[0], n[1], n[2], t); }
  }
  // arco de círculo num plano de pé: plane 'x' = plano x constante (o arco corre em z); 'z' = plano z constante (corre em x)
  function arc(plane, c, r, a0, a1, st, n, k) {
    for (var i = 0, m = Math.max(3, Math.round(Math.abs(a1 - a0) * r / st)); i < m; i++) {
      var a = a0 + (a1 - a0) * (i + 0.5) / m, u = Math.cos(a) * r, v = Math.sin(a) * r;
      if (plane === 'x') add(k === undefined ? L : k, c[0], c[1] + v, c[2] + u, n[0], n[1], n[2]); else add(k === undefined ? L : k, c[0] + u, c[1] + v, c[2], n[0], n[1], n[2]);
    }
  }
  function ring(cx, y, cz, r, st, k) {
    for (var i = 0, m = Math.max(6, Math.round(2 * PI * r / st)); i < m; i++) { var a = i / m * 2 * PI; add(k === undefined ? L : k, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, Math.cos(a), 0.2, Math.sin(a)); }
  }
  function loop(x0, x1, z0, z1, y, st) { line([x0, y, z0], [x1, y, z0], st); line([x0, y, z1], [x1, y, z1], st); line([x0, y, z0], [x0, y, z1], st); line([x1, y, z0], [x1, y, z1], st); }
  // bloco de pedra: as faces pedidas (S frente, N fundo, E direita, W esquerda, T topo) com juntas, e as arestas
  function block(b, faces, bw, bh, st) {
    var w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0, i, j;
    function tx(u, v) { return stone(u, v, bw || 0.5, bh || 0.25) * (0.72 + 0.28 * clamp(v / 0.3, 0, 1)); }
    st = st || sp;
    if (faces.indexOf('S') >= 0) quad(F, [b.x0, b.y0, b.z1], [w, 0, 0], [0, h, 0], st, [0, 0, 1], tx);
    if (faces.indexOf('N') >= 0) quad(F, [b.x1, b.y0, b.z0], [-w, 0, 0], [0, h, 0], st, [0, 0, -1], tx);
    if (faces.indexOf('E') >= 0) quad(F, [b.x1, b.y0, b.z1], [0, 0, -d], [0, h, 0], st, [1, 0, 0], tx);
    if (faces.indexOf('W') >= 0) quad(F, [b.x0, b.y0, b.z0], [0, 0, d], [0, h, 0], st, [-1, 0, 0], tx);
    if (faces.indexOf('T') >= 0) quad(F, [b.x0, b.y1, b.z0], [w, 0, 0], [0, 0, d], st, [0, 1, 0]);
    var f = FINE; FINE = f * 0.8;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) line([i ? b.x1 : b.x0, b.y0, j ? b.z1 : b.z0], [i ? b.x1 : b.x0, b.y1, j ? b.z1 : b.z0], st * 0.6);
    loop(b.x0, b.x1, b.z0, b.z1, b.y1, st * 0.6);
    FINE = f;
  }
  // tubo entre a e b (raios ra e rb): braços, hastes, urnas
  function tube(a, b, ra, rb, st, a0, a1, each) {
    var ax = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    var u = unit(Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [ax[2], 0, -ax[0]]), v = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]];
    var nl = Math.max(1, Math.round(len / st)), f0 = FINE;
    if (!ABS) FINE = f0 * clamp(st / sp, 0.3, 2.4);
    a0 = a0 === undefined ? 0 : a0; a1 = a1 === undefined ? 2 * PI : a1;
    for (var j = 0; j < nl; j++) {
      var f = (j + 0.5) / nl, r = ra + (rb - ra) * f, na = Math.max(3, Math.round((a1 - a0) * r / st));
      for (var i = 0; i < na; i++) {
        var an = a0 + (a1 - a0) * (i + jr()) / na, c = Math.cos(an), s = Math.sin(an), dx = u[0] * c + v[0] * s, dy = u[1] * c + v[1] * s, dz = u[2] * c + v[2] * s;
        var q = add(F, a[0] + (b[0] - a[0]) * f + dx * r, a[1] + (b[1] - a[1]) * f + dy * r, a[2] + (b[2] - a[2]) * f + dz * r, dx, dy, dz);
        if (q >= 0 && each) tex[q] *= each(an, f);
      }
    }
    FINE = f0;
  }
  // elipsoide (casca): centro c, raios r; keep(x, y, z) em unidades da própria esfera diz quem entra
  function ellip(c, r, st, keep) {
    var n = Math.round(4 * PI * Math.pow((Math.pow(r[0] * r[1], 1.6) + Math.pow(r[0] * r[2], 1.6) + Math.pow(r[1] * r[2], 1.6)) / 3, 1 / 1.6) / (st * st)), f0 = FINE;
    if (!ABS) FINE = f0 * clamp(st / sp, 0.3, 2.4);
    for (var i = 0; i < n; i++) {
      var y = 1 - (i + 0.5) / n * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996, x = Math.cos(th) * rr, z = Math.sin(th) * rr;
      if (keep && !keep(x, y, z)) continue;
      var nn = unit([x / r[0], y / r[1], z / r[2]]);
      add(F, c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2], nn[0], nn[1], nn[2]);
    }
    FINE = f0;
  }
  // balaustrada de a até b (no chão de altura y): balaústres, corrimão e base; dy = quanto sobe de a até b (escadas)
  function rail(a, b, y, dy) {
    var len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(len / 0.17)), f = FINE, i;
    dy = dy || 0;
    FINE = f * 0.75;
    for (i = 0; i <= n; i++) {
      var t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, yy = y + dy * t;
      line([x, yy + 0.08, z], [x, yy + 0.66, z], sp * 0.5);
      ring(x, yy + 0.3, z, 0.035, sp * 0.5); ring(x, yy + 0.2, z, 0.022, sp * 0.6);
    }
    FINE = f * 0.9;
    for (i = 0; i < 2; i++) { var o = i ? 0.04 : -0.04, ox = (b[1] - a[1]) / len * o, oz = -(b[0] - a[0]) / len * o; line([a[0] + ox, y + 0.7, a[1] + oz], [b[0] + ox, y + dy + 0.7, b[1] + oz], sp * 0.5); line([a[0] + ox, y + 0.06, a[1] + oz], [b[0] + ox, y + dy + 0.06, b[1] + oz], sp * 0.6); }
    line([a[0], y + 0.74, a[1]], [b[0], y + dy + 0.74, b[1]], sp * 0.45);
    FINE = f;
  }
  // pilar da balaustrada, com a bola em cima
  function newel(x, y, z) {
    block({ x0: x - 0.1, x1: x + 0.1, y0: y, y1: y + 0.86, z0: z - 0.1, z1: z + 0.1 }, 'SEWT', 0.2, 0.3, sp * 0.8);
    ellip([x, y + 0.98, z], [0.1, 0.1, 0.1], sp * 0.6);
  }

  // ---------- A estátua ----------
  // O rosto é esculpido com formas somadas e subtraídas de leve (união suave); a superfície é achada por raios que saem
  // do centro da cabeça. Unidades do rosto: meia altura da cabeça = 1, olhando para +z.
  function sU(a, b, k) { var h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }
  function sS(a, b, k) { return -sU(-a, b, k); }
  function el(x, y, z, cx, cy, cz, rx, ry, rz) { var dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz; return (Math.sqrt(dx * dx + dy * dy + dz * dz) - 1) * Math.min(rx, ry, rz); }
  function faceSDF(x, y, z) {
    var ax = Math.abs(x), d = el(x, y, z, 0, 0.05, -0.05, 0.8, 1.0, 0.92);                // crânio
    d = sU(d, el(x, y, z, 0, -0.45, 0.14, 0.58, 0.62, 0.66), 0.22);                       // maxilar
    d = sU(d, el(x, y, z, 0, -0.93, 0.5, 0.19, 0.16, 0.19), 0.14);                        // queixo
    d = sU(d, el(ax, y, z, 0.4, -0.14, 0.5, 0.22, 0.2, 0.22), 0.18);                      // maçãs do rosto
    d = sU(d, el(x, y, z, 0, 0.27, 0.74, 0.52, 0.085, 0.13), 0.1);                        // arco das sobrancelhas
    d = sS(d, el(ax, y, z, 0.3, 0.1, 0.92, 0.17, 0.1, 0.14), 0.07);                       // órbitas
    d = sU(d, el(ax, y, z, 0.3, 0.085, 0.8, 0.125, 0.062, 0.085), 0.035);                 // pálpebras fechadas
    d = sU(d, el(x, y, z, 0, 0.02, 0.9, 0.065, 0.26, 0.1), 0.07);                         // dorso do nariz
    d = sU(d, el(x, y, z, 0, -0.25, 1.01, 0.095, 0.085, 0.11), 0.06);                     // ponta do nariz
    d = sU(d, el(ax, y, z, 0.1, -0.3, 0.92, 0.06, 0.05, 0.07), 0.04);                     // asas do nariz
    d = sU(d, el(x, y, z, 0, -0.52, 0.9, 0.2, 0.05, 0.09), 0.05);                         // lábio de cima
    d = sU(d, el(x, y, z, 0, -0.63, 0.87, 0.17, 0.06, 0.09), 0.05);                       // lábio de baixo
    return sS(d, el(x, y, z, 0, -0.575, 0.99, 0.21, 0.013, 0.07), 0.012);                 // a linha da boca
  }
  function statue() {
    var o = SO, st = sp * 0.2, sd = sp * 0.12, i, j, q, f = FINE;
    function pt(m, r) { FINE = (r || 1.25) * m / PT; }                           // tamanho do ponto para uma malha de abertura m
    MAT = MARBLE; CAT = HALL; rise(o[2]); SEED = [o[0], 0, o[2]]; ABS = true; TEX = 0.78;
    pt(st);
    // manto: superfície de revolução com dobras que torcem de leve; só a frente e os lados (as costas ninguém vê)
    function robe(th, y) {
      var r = (0.27 + 0.19 * Math.pow(Math.max(0, 1 - y / 1.72), 1.6)) * (1 + 0.075 * (1 - 0.55 * y / 1.72) * Math.sin(11 * th + 1.3 * Math.sin(1.9 * y + 0.7 * th)));
      return [o[0] + r * Math.cos(th) + 0.025 * Math.sin(y * 1.5), o[1] + y, o[2] + r * Math.sin(th)];
    }
    var ny_ = Math.round(1.72 / st), nt = Math.round((PI + 1.3) * 0.36 / st);
    for (j = 0; j < ny_; j++) for (i = 0; i < nt; i++) {
      var th = -0.65 + (PI + 1.3) * (i + jr()) / nt, y = 1.72 * (j + jr()) / ny_, p = robe(th, y), pa = robe(th + 0.02, y), pb = robe(th, y + 0.02);
      var n = unit([(pa[1] - p[1]) * (pb[2] - p[2]) - (pa[2] - p[2]) * (pb[1] - p[1]), (pa[2] - p[2]) * (pb[0] - p[0]) - (pa[0] - p[0]) * (pb[2] - p[2]), (pa[0] - p[0]) * (pb[1] - p[1]) - (pa[1] - p[1]) * (pb[0] - p[0])]);
      q = add(F, p[0], p[1], p[2], -n[0], -n[1], -n[2]);
      if (q >= 0) tex[q] = 0.8 + 0.2 * clamp(y / 0.3, 0, 1);
    }
    // tronco e ombros, faixa na cintura
    pt(sd); ellip([o[0], o[1] + 1.82, o[2]], [0.33, 0.27, 0.2], sd, function (x, y, z) { return z > -0.5; });
    pt(st * 0.8, 1.5); ring(o[0], o[1] + 1.2, o[2], 0.325, st * 0.8); ring(o[0], o[1] + 1.24, o[2], 0.32, st * 0.8); pt(st);
    // braço que ergue o cubo (manga larga, antebraço, mão) e o braço que segura o rolo do projeto
    var sh = [o[0] + 0.28, o[1] + 1.9, o[2]], elb = [o[0] + 0.5, o[1] + 2.2, o[2] + 0.06], wr = [o[0] + 0.46, o[1] + 2.64, o[2] + 0.1];
    tube(sh, elb, 0.11, 0.14, st); tube(elb, wr, 0.06, 0.05, st); ellip([wr[0], wr[1] + 0.08, wr[2]], [0.05, 0.075, 0.045], st);
    tube([elb[0] - 0.02, elb[1] - 0.02, elb[2]], [elb[0] + 0.02, elb[1] - 0.5, elb[2] - 0.02], 0.13, 0.03, st, 0, 2 * PI, function (a, t) { return 0.85 + 0.15 * Math.sin(a * 5 + t * 3); });   // a ponta da manga, que pende
    var sh2 = [o[0] - 0.28, o[1] + 1.9, o[2]], elb2 = [o[0] - 0.37, o[1] + 1.5, o[2] + 0.1], wr2 = [o[0] - 0.13, o[1] + 1.42, o[2] + 0.27];
    tube(sh2, elb2, 0.11, 0.12, st); tube(elb2, wr2, 0.1, 0.055, st); ellip([wr2[0] + 0.04, wr2[1], wr2[2] + 0.02], [0.06, 0.05, 0.05], st);
    tube([o[0] - 0.24, o[1] + 1.43, o[2] + 0.31], [o[0] + 0.08, o[1] + 1.4, o[2] + 0.31], 0.036, 0.036, st * 0.8);
    // capuz: casca em volta da cabeça, aberta no rosto, que desce até os ombros
    var hc = [HEAD[0], HEAD[1] + 0.06 * HS, HEAD[2] - 0.14 * HS], hr = [1.06 * HS, 1.2 * HS, 1.15 * HS];
    function open(x, y, z) { var lx = x * 1.06, ly = y * 1.2 + 0.06, lz = z * 1.15 - 0.14; return lz > 0.36 && Math.abs(lx) < 0.68 && ly > -1.12 && ly < 0.74; }   // a abertura, em unidades do rosto
    pt(sp * 0.085); ellip(hc, hr, sp * 0.085, function (x, y, z) { return !open(x, y, z) && y > -0.8 && z > -0.55; });
    pt(sd); tube([o[0], o[1] + 2.14, o[2] - 0.02], [o[0], o[1] + 1.88, o[2] - 0.02], 0.15, 0.31, sd, 0, 2 * PI, function (a, t) { return 0.82 + 0.18 * Math.sin(a * 7 + t * 2); });
    pt(sp * 0.085); tube([o[0], o[1] + 2.02, o[2] + 0.03], [o[0], o[1] + 2.14, o[2] + 0.03], 0.055, 0.058, sp * 0.085, 0.2, PI - 0.2);   // pescoço
    pt(sp * 0.04, 1.6); TEX = 0.9;                                            // a borda do capuz em volta do rosto
    for (i = 0, j = Math.round(2 * PI * 0.8 * HS / (sp * 0.04)); i < j; i++) {
      var a = i / j * 2 * PI, lx = 0.68 * Math.cos(a), ly = -0.19 + 0.93 * Math.sin(a), ez = 1 - Math.pow(lx / 1.06, 2) - Math.pow((ly - 0.06) / 1.2, 2);
      if (ez > 0) add(L, HEAD[0] + lx * HS, HEAD[1] + ly * HS, HEAD[2] + (-0.14 + 1.15 * Math.sqrt(ez)) * HS + 0.004, 0, 0.3, 1);
    }
    // rosto: raios do centro da cabeça até a superfície esculpida (na medição do passo, só a conta de quantos serão)
    var sf = sp * 0.045; pt(sf, 1.35); TEX = 0.8;
    var nf = Math.round(2 * PI * HS * HS * 1.25 / (sf * sf) / 0.5);
    if (DRY) cnt += Math.round(nf * 0.215);
    else for (i = 0; i < nf; i++) {
      var dy = 1 - (i + 0.5) / nf * 2, rr = Math.sqrt(1 - dy * dy), tf = i * 2.39996, dx = Math.cos(tf) * rr, dz = Math.sin(tf) * rr, lo = 0.35, hi = 1.6, m, k;
      if (dz < 0.2) continue;
      for (k = 0; k < 12; k++) { m = (lo + hi) / 2; if (faceSDF(dx * m, dy * m, dz * m) < 0) lo = m; else hi = m; }
      m = (lo + hi) / 2;
      var X0 = dx * m, Y0 = dy * m, Z0 = dz * m, e = 0.014, f0 = faceSDF(X0, Y0, Z0);
      if (!(Z0 > 0.3 && Math.abs(X0) < 0.7 && Y0 > -1.14 && Y0 < 0.76)) continue;
      var g = unit([faceSDF(X0 + e, Y0, Z0) - f0, faceSDF(X0, Y0 + e, Z0) - f0, faceSDF(X0, Y0, Z0 + e) - f0]);
      add(F, HEAD[0] + X0 * HS, HEAD[1] + Y0 * HS, HEAD[2] + Z0 * HS, g[0], g[1], g[2], 1);
    }
    FINE = f; ABS = false; TEX = 1;
    // cubo de luz
    CAT = HALL; MAT = GOLD; FINE = 1.2;
    var c = CUBE, hcu = 0.1, cb = { x0: c[0] - hcu, x1: c[0] + hcu, y0: c[1] - hcu, y1: c[1] + hcu, z0: c[2] - hcu, z1: c[2] + hcu };
    [[cb.x0, cb.y0, cb.z1, 2 * hcu, 0, 0, 0, 2 * hcu, 0, 0, 0, 1], [cb.x1, cb.y0, cb.z1, 0, 0, -2 * hcu, 0, 2 * hcu, 0, 1, 0, 0], [cb.x0, cb.y0, cb.z0, 0, 0, 2 * hcu, 0, 2 * hcu, 0, -1, 0, 0], [cb.x0, cb.y1, cb.z0, 2 * hcu, 0, 0, 0, 0, 2 * hcu, 0, 1, 0]].forEach(function (d) {
      quad(M, [d[0], d[1], d[2]], [d[3], d[4], d[5]], [d[6], d[7], d[8]], st * 0.9, [d[9], d[10], d[11]], null, 1);
    });
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) { line([i ? cb.x1 : cb.x0, cb.y0, j ? cb.z1 : cb.z0], [i ? cb.x1 : cb.x0, cb.y1, j ? cb.z1 : cb.z0], st * 0.5, 1, null, M); line([cb.x0, i ? cb.y1 : cb.y0, j ? cb.z1 : cb.z0], [cb.x1, i ? cb.y1 : cb.y0, j ? cb.z1 : cb.z0], st * 0.5, 1, null, M); line([i ? cb.x1 : cb.x0, j ? cb.y1 : cb.y0, cb.z0], [i ? cb.x1 : cb.x0, j ? cb.y1 : cb.y0, cb.z1], st * 0.5, 1, null, M); }
    FINE = f; MAT = MARBLE;
    // pedestal: três degraus de pedra com moldura e uma placa na frente
    SEED = null;
    var pb0 = LAND, bx = o[0], bz = o[2];
    block({ x0: bx - 0.78, x1: bx + 0.78, y0: pb0, y1: pb0 + 0.2, z0: bz - 0.78, z1: bz + 0.78 }, 'SEWT', 0.4, 0.2, sp * 0.8);
    block({ x0: bx - 0.6, x1: bx + 0.6, y0: pb0 + 0.2, y1: pb0 + 0.95, z0: bz - 0.6, z1: bz + 0.6 }, 'SEW', 0.6, 0.75, sp * 0.8);
    block({ x0: bx - 0.68, x1: bx + 0.68, y0: pb0 + 0.95, y1: pb0 + 1.07, z0: bz - 0.68, z1: bz + 0.68 }, 'SEWT', 0.7, 0.12, sp * 0.8);
    MAT = GOLD; FINE = 0.6;
    line([bx - 0.36, pb0 + 0.36, bz + 0.607], [bx + 0.36, pb0 + 0.36, bz + 0.607], sp * 0.4); line([bx - 0.36, pb0 + 0.78, bz + 0.607], [bx + 0.36, pb0 + 0.78, bz + 0.607], sp * 0.4);
    line([bx - 0.36, pb0 + 0.36, bz + 0.607], [bx - 0.36, pb0 + 0.78, bz + 0.607], sp * 0.4); line([bx + 0.36, pb0 + 0.36, bz + 0.607], [bx + 0.36, pb0 + 0.78, bz + 0.607], sp * 0.4);
    for (i = 0; i < 4; i++) line([bx - 0.24 + (i % 2) * 0.05, pb0 + 0.7 - i * 0.075, bz + 0.607], [bx + 0.24 - (i % 2) * 0.09, pb0 + 0.7 - i * 0.075, bz + 0.607], sp * 0.5);
    FINE = f; MAT = STONE;
    // o que esconde o que está atrás da estátua, e o que faz sombra
    solid('stA', [bx - 0.78, bx + 0.78, pb0, pb0 + 0.2, bz - 0.78, bz + 0.78]); solid('stB', [bx - 0.6, bx + 0.6, pb0 + 0.2, pb0 + 0.95, bz - 0.6, bz + 0.6]); solid('stC', [bx - 0.68, bx + 0.68, pb0 + 0.95, pb0 + 1.07, bz - 0.68, bz + 0.68]);
    solid('stR', [o[0] - 0.33, o[0] + 0.33, o[1], o[1] + 0.7, o[2] - 0.33, o[2] + 0.33], 'cyl'); solid('stS', [o[0] - 0.27, o[0] + 0.27, o[1] + 0.7, o[1] + 1.7, o[2] - 0.27, o[2] + 0.27], 'cyl'); solid('stT', [o[0] - 0.36, o[0] + 0.36, o[1] + 1.0, o[1] + 2.14, o[2] - 0.3, o[2] + 0.2], 'sphere');
    solid('stH', [hc[0] - hr[0] * 0.9, hc[0] + hr[0] * 0.9, hc[1] - hr[1] * 0.9, hc[1] + hr[1], hc[2] - hr[2], hc[2] + hr[2] * 0.12], 'sphere');
    OCC.push([bx - 0.7, bx + 0.7, pb0, pb0 + 1.07, bz - 0.7, bz + 0.7]); BALL.push([o[0], o[1] + 0.6, o[2], 0.42], [o[0], o[1] + 1.3, o[2], 0.36], [o[0], o[1] + 1.85, o[2], 0.33], [HEAD[0], HEAD[1], HEAD[2], 0.17]);
  }

  // ---------- A arquitetura ----------
  // coluna: plinto, base, fuste canelado e capitel. cut > 0: quebrada naquela altura (o que fica acima cai, ver "ruin")
  function column(s, zi, ruin) {
    var x = s * NAVE, z = COLZ[zi], st = sp * (1.25 + 0.1 * zi), y0 = 0.36, y1 = 4.5, i, f = FINE, id = 'col' + (s > 0 ? 'R' : 'L') + zi;
    rise(z);
    block({ x0: x - 0.48, x1: x + 0.48, y0: 0, y1: 0.22, z0: z - 0.48, z1: z + 0.48 }, s > 0 ? 'SWT' : 'SET', 0.48, 0.22, st);
    FINE = 0.8; ring(x, 0.25, z, 0.46, st * 0.5); ring(x, 0.31, z, 0.42, st * 0.5); ring(x, 0.36, z, 0.39, st * 0.5); FINE = f;
    solid(id + 'a', [x - 0.48, x + 0.48, 0, 0.22, z - 0.48, z + 0.48]);
    // fuste: só o lado que se vê da nave; as caneluras são faixas de luz e sombra
    var a0 = s > 0 ? PI * 0.5 - 0.5 : -PI * 0.5 - 0.5, cut = ruin ? ruin.cut : 99;
    function flute(a, t) { return (0.62 + 0.46 * Math.abs(Math.cos(a * 10))) * (0.8 + 0.2 * clamp(t * 12, 0, 1)); }
    tube([x, y0, z], [x, Math.min(cut, y1), z], COLR, COLR * (1 - 0.1 * (Math.min(cut, y1) - y0) / (y1 - y0)), st, a0, a0 + PI + 1.0, flute);
    solid(id + 'b', [x - COLR, x + COLR, 0.2, Math.min(cut, y1), z - COLR, z + COLR], 'cyl'); OCC.push([x - COLR * 0.8, x + COLR * 0.8, 0, Math.min(cut, y1), z - COLR * 0.8, z + COLR * 0.8]);
    if (ruin) {                                                              // os tambores de cima e o capitel: no chão, na ruína
      for (i = 0; i < ruin.drums.length; i++) {
        var d = ruin.drums[i], ya = i ? ruin.cuts[i - 1] : cut, yb = ruin.cuts[i];
        broken(ruin.grp, ruin.fix + i * 0.1, fall([x, (ya + yb) / 2, z], d[0], d[1], [d[2], d[3] - (ya + yb) / 2, d[4]]));
        tube([x, ya, z], [x, yb, z], COLR * 0.96, COLR * 0.92, st, 0, 2 * PI, flute);
        solid(id + 'd' + i, [x - COLR, x + COLR, ya, yb, z - COLR, z + COLR], 'cyl');
      }
      broken(ruin.grp, ruin.fix + 0.32, heap(x - s * 0.9, 0, z + 0.5, 0.75, 0.4, 31 + zi));
    }
    FINE = 0.8; ring(x, y1 + 0.02, z, 0.37, st * 0.5); ring(x, y1 + 0.08, z, 0.41, st * 0.5); ring(x, y1 + 0.14, z, 0.46, st * 0.5); FINE = f;
    block({ x0: x - 0.5, x1: x + 0.5, y0: y1 + 0.16, y1: CAP, z0: z - 0.5, z1: z + 0.5 }, s > 0 ? 'SW' : 'SE', 0.5, 0.14, st);
    solid(id + 'c', [x - 0.5, x + 0.5, y1 + 0.16, CAP, z - 0.5, z + 0.5]);
    whole();
  }
  // um vão da arcada: o arco entre duas colunas, com as aduelas, e a parede até a cornija
  function bay(s, za, zb, ruin) {
    var xi = s * (NAVE - 0.36), zc = (za + zb) / 2, hw = Math.abs(za - zb) / 2, R = hw - 0.36, n = [-s, 0, 0], st = sp * 1.35, f = FINE, a;
    rise(zc);
    if (ruin) broken(ruin.grp, ruin.fix, heap(xi - s * 0.7, 0, zc, 1.1, 0.55, 57 + Math.round(zc * 3)));
    quad(F, [xi, CAP, zc - hw], [0, 0, 2 * hw], [0, CORN - CAP, 0], st, n, function (u, v) { return Math.hypot(u - hw, v) < R ? 0 : stone(u, v, 0.5, 0.25); });
    FINE = 0.75;
    arc('x', [xi - s * 0.01, CAP, zc], R, 0, PI, st * 0.4, n); arc('x', [xi - s * 0.012, CAP, zc], R + 0.2, 0, PI, st * 0.5, n);
    for (a = 0; a <= 12; a++) line([xi - s * 0.012, CAP + Math.sin(a * PI / 12) * R, zc + Math.cos(a * PI / 12) * R], [xi - s * 0.012, CAP + Math.sin(a * PI / 12) * (R + 0.2), zc + Math.cos(a * PI / 12) * (R + 0.2)], st * 0.6, 0, n);
    FINE = f;
    solid('bay' + (s > 0 ? 'R' : 'L') + Math.round(zc * 10), [xi - (s > 0 ? 0 : 0.72), xi + (s > 0 ? 0.72 : 0), CAP + R + 0.05, CORN, zc - hw, zc + hw]);
    whole();
  }
  // um arco de ferro da abóbada (duas abas, alma e rebites), em pedaços que podem cair, e as terças até o arco seguinte
  function rib(z, zNext, ruins) {
    var c = [0, SPRING, z], st = sp * 0.55, segs = 6, i, k, f = FINE;
    rise(z); MAT = IRON;
    for (i = 0; i < segs; i++) {
      var a0 = PI * i / segs, a1 = PI * (i + 1) / segs, ru = ruins && ruins[i];
      if (ru) broken(ru[0], ru[1], ru[2]);
      FINE = 0.7; arc('z', c, VR, a0, a1, st, [0, -1, 0]); arc('z', c, VR - 0.2, a0, a1, st, [0, -1, 0]);
      FINE = 0.55;
      for (k = 0; k < 5; k++) { var a = a0 + (a1 - a0) * (k + 0.5) / 5; line([Math.cos(a) * VR, SPRING + Math.sin(a) * VR, z], [Math.cos(a + 0.05) * (VR - 0.2), SPRING + Math.sin(a + 0.05) * (VR - 0.2), z], st, 0, [0, -1, 0]); }
      if (zNext !== undefined) {                                              // terça e o vidro entre este arco e o seguinte
        var am = (a0 + a1) / 2, pxm = Math.cos(am) * (VR - 0.1), pym = SPRING + Math.sin(am) * (VR - 0.1);
        FINE = 0.6; line([pxm, pym, z], [pxm, pym, zNext], st * 1.2, 0, [0, -1, 0]);
        MAT = GLASS; FINE = 1;
        for (k = 0, a = Math.round(Math.abs(zNext - z) * (a1 - a0) * VR / (sp * sp * 16)); k < a; k++) { var ag = a0 + (a1 - a0) * jr(); add(F, Math.cos(ag) * (VR - 0.1), SPRING + Math.sin(ag) * (VR - 0.1), z + (zNext - z) * jr(), -Math.cos(ag), -Math.sin(ag), 0); }
        MAT = IRON;
      }
      whole();
    }
    FINE = f; MAT = STONE;
  }

  // Zonas do piso (tag dos pontos G) e as rachaduras da ruína
  var P_TILE = 0, P_JOINT = 1, P_BAND = 2, P_AISLE = 3, P_EMB = 4, P_STAR = 5, P_TOP = 6;
  var CRACKS = [[-0.4, 4.9, 0.9, 3.9, 0.5, 2.6, 1.6, 1.5], [1.9, 4.6, 2.6, 3.3, 2.3, 2.2], [-2.6, 2.8, -1.7, 2.2, -1.9, 1.0], [0.3, 0.9, -0.5, 0.2, -0.3, -0.9]];
  function cracked(x, z) {
    for (var c = 0; c < CRACKS.length; c++) for (var i = 0, k = CRACKS[c]; i + 3 < k.length; i += 2) {
      var ax = k[i], az = k[i + 1], bx = k[i + 2], bz = k[i + 3], t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) * (bx - ax) + (bz - az) * (bz - az)), 0, 1);
      if (Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < 0.035 + 0.03 * hash2(Math.floor(x * 9), Math.floor(z * 9))) return true;
    }
    return false;
  }
  function floorTag(x, z) {
    var ax = Math.abs(x), d = Math.hypot(x - EMB[0], z - EMB[1]), jx = frac(x / 0.5 + 0.5), jz = frac(z / 0.5);
    if (d < EMB_R) {
      var lx = Math.abs(x - EMB[0]), lz = Math.abs(z - EMB[1]);
      return Math.max(lx, lz) < 0.72 || (lx + lz) < 0.72 * Math.SQRT2 ? P_STAR : P_EMB;       // a estrela de oito pontas (dois quadrados cruzados)
    }
    if (ax > NAVE - 0.5 && ax < NAVE + 0.5) return P_BAND;
    if (ax > NAVE) return (Math.floor(x / 0.5) + Math.floor(z / 0.5)) % 2 ? P_AISLE : P_TILE;
    return jx < 0.07 || jz < 0.07 ? P_JOINT : P_TILE;
  }

  function hall() {
    var i, j, k, s, x, z, a, q, f, gs = sp * 1.45;
    MAT = STONE; CAT = HALL;
    // --- piso: ladrilhos, faixas, o brasão; o que fica debaixo da escadaria e do patamar não é gerado ---
    for (z = FZ0 + gs / 2; z < FZ1; z += gs) for (x = -FX + gs / 2; x < FX; x += gs) {
      var X0 = x + (jr() - 0.5) * gs * 0.5, Z0 = z + (jr() - 0.5) * gs * 0.5, ax = Math.abs(X0);
      if (Z0 < GAL_Z || (Z0 < LAND_Z1 && ax < LAND_X) || (Z0 < ST_Z && Z0 > LAND_Z1 && ax < ST_X)) continue;
      rise(Z0);
      q = add(G, X0, 0, Z0, 0, 1, 0, floorTag(X0, Z0));
      if (q >= 0 && cracked(X0, Z0)) grp[q] = 3;                             // rachadura: some com o conserto
    }
    // o desenho do brasão: anéis, a estrela de oito pontas, os raios e as contas (metal embutido no piso)
    MAT = GOLD; f = FINE; FINE = 0.7; rise(EMB[1]);
    [EMB_R, EMB_R - 0.12, 1.02, 0.94, 0.3].forEach(function (r) { ring(EMB[0], 0.012, EMB[1], r, sp * 0.45); });
    for (i = 0; i < 4; i++) {
      a = i * PI / 2; var a2 = a + PI / 2, h1 = 0.72, h2 = 0.72 * Math.SQRT2;
      line([EMB[0] + Math.cos(a) * h1 - Math.sin(a) * h1, 0.012, EMB[1] + Math.sin(a) * h1 + Math.cos(a) * h1], [EMB[0] + Math.cos(a) * h1 + Math.sin(a) * h1, 0.012, EMB[1] + Math.sin(a) * h1 - Math.cos(a) * h1], sp * 0.45);
      line([EMB[0] + Math.cos(a) * h2, 0.012, EMB[1] + Math.sin(a) * h2], [EMB[0] + Math.cos(a2) * h2, 0.012, EMB[1] + Math.sin(a2) * h2], sp * 0.45);
    }
    for (i = 0; i < 32; i++) { a = i * PI / 16; line([EMB[0] + Math.cos(a) * (i % 2 ? 1.2 : 1.1), 0.012, EMB[1] + Math.sin(a) * (i % 2 ? 1.2 : 1.1)], [EMB[0] + Math.cos(a) * 1.5, 0.012, EMB[1] + Math.sin(a) * 1.5], sp * 0.5); }
    for (i = 0; i < 8; i++) { a = i * PI / 4 + PI / 8; ring(EMB[0] + Math.cos(a) * 1.3, 0.012, EMB[1] + Math.sin(a) * 1.3, 0.07, sp * 0.4); }
    for (s = -1; s <= 1; s += 2) { line([s * (NAVE - 0.5), 0.012, FZ1], [s * (NAVE - 0.5), 0.012, ST_Z + 0.2], sp * 0.6); line([s * (NAVE - 0.62), 0.012, FZ1], [s * (NAVE - 0.62), 0.012, ST_Z + 0.2], sp * 0.8); }
    FINE = f; MAT = STONE; SEED = null;

    // --- escadaria central: espelhos, pisos e o friso de cada degrau; o canto direito quebrado vira entulho ---
    for (k = 0; k < STEPS; k++) {
      var zr = ST_Z - k * RUN, y0 = k * RISE, hurt = k < 3;
      rise(zr);
      for (j = 0; j < (hurt ? 2 : 1); j++) {
        var xa = j ? 1.15 : -ST_X, xb = hurt && !j ? 1.15 : ST_X;
        if (j) broken(2, 0.08 + k * 0.03, heap(2.75, 0, 1.75, 0.8, 0.5, 71 + k));
        quad(F, [xa, y0, zr], [xb - xa, 0, 0], [0, RISE, 0], sp, [0, 0, 1], function (u) { return 0.62 + 0.2 * hash2(Math.floor(u / 0.7), k); });
        quad(F, [xa, y0 + RISE, zr - RUN], [xb - xa, 0, 0], [0, 0, RUN], sp, [0, 1, 0], function (u, v) { return frac((u + xa + 9) / 0.7) < 0.04 ? 0.6 : 0.85 + 0.15 * v / RUN; });
        f = FINE; FINE = 0.8; line([xa, y0 + RISE + 0.004, zr + 0.012], [xb, y0 + RISE + 0.004, zr + 0.012], sp * 0.42); FINE = f;
        whole();
      }
      solid('step' + k, [-ST_X, hurt ? 1.15 : ST_X, 0, y0 + RISE, LAND_Z1, zr]);
      if (hurt) { GRP = 2; FIX = 0.08 + k * 0.03; solid('stepfix' + k, [1.15, ST_X, 0, y0 + RISE, LAND_Z1, zr]); whole(); }
      OCC.push([-ST_X, ST_X, 0, y0 + RISE, zr - RUN, zr]);
    }
    // laterais da escada: o muro em triângulo, o pilar com a bola e a balaustrada que sobe (a da direita caiu)
    for (s = -1; s <= 1; s += 2) {
      rise(0);
      if (s > 0) broken(2, 0.3, fall([ST_X + 0.12, 0, ST_Z], 2, -1.35, [0.35, 0.1, 0.25]));
      quad(F, [s * ST_X, 0, ST_Z], [0, 0, -(ST_Z - LAND_Z1)], [0, LAND + 0.1, 0], sp, [s, 0, 0], function (u, v) { return v < u / RUN * RISE + 0.12 ? stone(u, v, 0.6, 0.3) : 0; });
      line([s * ST_X, 0.12, ST_Z], [s * ST_X, LAND + 0.12, LAND_Z1], sp * 0.45);
      newel(s * (ST_X + 0.12), 0, ST_Z + 0.12);
      rail([s * (ST_X + 0.12), ST_Z - 0.05], [s * (ST_X + 0.12), LAND_Z1 + 0.1], 0.12, LAND);
      whole();
    }
    // --- patamar: o piso, as frentes ao lado da escada e as balaustradas (um trecho da esquerda caiu) ---
    rise(-3);
    quad(F, [-LAND_X, LAND, LAND_Z0], [2 * LAND_X, 0, 0], [0, 0, LAND_Z1 - LAND_Z0], sp * 1.3, [0, 1, 0], function (u, v) { return frac(u / 0.65) < 0.05 || frac(v / 0.65) < 0.05 ? 0.55 : 0.9; });
    for (s = -1; s <= 1; s += 2) {
      quad(F, [s > 0 ? ST_X : -LAND_X, 0, LAND_Z1], [LAND_X - ST_X, 0, 0], [0, LAND, 0], sp, [0, 0, 1], function (u, v) { return stone(u, v, 0.55, 0.3) * (u > 0.2 && u < LAND_X - ST_X - 0.2 && v > 0.25 && v < 0.95 ? 0.72 : 1); });
      f = FINE; FINE = 0.8; line([s > 0 ? ST_X : -LAND_X, LAND, LAND_Z1 + 0.01], [s > 0 ? LAND_X : -ST_X, LAND, LAND_Z1 + 0.01], sp * 0.45); FINE = f;
      newel(s * (ST_X + 0.12), LAND, LAND_Z1 + 0.02); newel(s * (LAND_X - 0.1), LAND, LAND_Z1 + 0.02);
      if (s < 0) broken(2, 0.5, fall([-2.7, LAND, LAND_Z1], 0, 1.4, [0.2, -LAND + 0.25, 0.9]));
      rail([s * (ST_X + 0.24), LAND_Z1 + 0.02], [s * (LAND_X - 0.22), LAND_Z1 + 0.02], LAND);
      whole();
      rail([s * (LAND_X - 0.1), LAND_Z1 - 0.1], [s * (LAND_X - 0.1), LAND_Z0 + 0.1], LAND);
    }
    solid('land', [-LAND_X, LAND_X, 0, LAND, LAND_Z0, LAND_Z1]); OCC.push([-LAND_X, LAND_X, 0, LAND, LAND_Z0, LAND_Z1]);
    // --- os dois lances do fundo, que sobem para os lados até a galeria, com o muro e a balaustrada em diagonal ---
    for (s = -1; s <= 1; s += 2) {
      rise(-5);
      quad(F, [s * 0.95, LAND, LAND_Z0], [s * (LAND_X - 0.95), 0, 0], [0, GAL - LAND + 0.1, 0], sp, [0, 0, 1], function (u, v) { return v < u / (LAND_X - 0.95) * (GAL - LAND) + 0.1 ? stone(u, v, 0.5, 0.25) : 0; });
      line([s * 0.95, LAND + 0.1, LAND_Z0 + 0.01], [s * LAND_X, GAL + 0.1, LAND_Z0 + 0.01], sp * 0.45);
      for (k = 0; k < 8; k++) quad(F, [s * (0.95 + k * 0.2875), LAND + (k + 1) * 0.15, GAL_Z], [s * 0.2875, 0, 0], [0, 0, LAND_Z0 - GAL_Z], sp * 1.4, [0, 1, 0]);
      newel(s * 0.95, LAND, LAND_Z0 + 0.02);
      rail([s * 1.1, LAND_Z0 + 0.02], [s * (LAND_X - 0.05), LAND_Z0 + 0.02], LAND + 0.1, GAL - LAND);
      solid('fl' + s, [Math.min(s * 0.95, s * LAND_X), Math.max(s * 0.95, s * LAND_X), LAND, LAND + (GAL - LAND) * 0.5, GAL_Z, LAND_Z0]);
    }
    // o nicho atrás da estátua (frente da galeria, no centro) e a galeria
    rise(GAL_Z);
    quad(F, [-0.95, LAND, GAL_Z], [1.9, 0, 0], [0, GAL - LAND, 0], sp, [0, 0, 1], function (u, v) { return Math.hypot(u - 0.95, v - 0.2) < 0.7 && v > 0.2 ? 0.55 : stone(u, v, 0.5, 0.25); });
    f = FINE; FINE = 0.8; arc('z', [0, LAND + 0.2, GAL_Z + 0.012], 0.7, 0, PI, sp * 0.45, [0, 0, 1]); FINE = f;
    quad(F, [-FX, GAL, FZ0], [2 * FX, 0, 0], [0, 0, GAL_Z - FZ0], sp * 2, [0, 1, 0]);
    for (s = -1; s <= 1; s += 2) quad(F, [s > 0 ? LAND_X : -FX, 0, GAL_Z], [FX - LAND_X, 0, 0], [0, GAL, 0], sp * 1.4, [0, 0, 1], function (u, v) { return stone(u, v, 0.55, 0.3); });
    f = FINE; FINE = 0.8; line([-FX, GAL, GAL_Z + 0.01], [FX, GAL, GAL_Z + 0.01], sp * 0.5); FINE = f;
    broken(2, 0.62, heap(2.2, LAND, -4.9, 0.7, 0.35, 88));
    rail([0.4, GAL_Z + 0.05], [LAND_X - 0.3, GAL_Z + 0.05], GAL); whole();
    rail([-LAND_X + 0.3, GAL_Z + 0.05], [0.4, GAL_Z + 0.05], GAL);
    solid('gal', [-FX, FX, 0, GAL, FZ0, GAL_Z]); OCC.push([-FX, FX, 0, GAL, FZ0, GAL_Z]);

    // --- parede do fundo, com a grande janela em arco e a grade de ferro ---
    rise(FZ0);
    quad(F, [-FX, GAL, FZ0], [2 * FX, 0, 0], [0, SPRING + VR - GAL, 0], sp * 1.35, [0, 0, 1], function (u, v) {
      var X1 = u - FX, Y1 = v + GAL;
      if (Y1 > SPRING + Math.sqrt(Math.max(0, VR * VR - X1 * X1)) && Math.abs(X1) < VR) return 0;        // acima da abóbada
      if (Y1 > SPRING && Math.abs(X1) >= VR) return 0;
      if (Math.abs(X1) < 2.2 && Y1 > 3.4 && (Y1 < 6.2 || Math.hypot(X1, Y1 - 6.2) < 2.2)) return 0;      // o vão da janela
      return stone(u, v, 0.6, 0.3);
    });
    f = FINE; FINE = 0.8;
    [0.0, 0.14].forEach(function (o2) { line([-2.2 - o2, 3.4 - o2, FZ0 + 0.012], [-2.2 - o2, 6.2, FZ0 + 0.012], sp * 0.5); line([2.2 + o2, 3.4 - o2, FZ0 + 0.012], [2.2 + o2, 6.2, FZ0 + 0.012], sp * 0.5); arc('z', [0, 6.2, FZ0 + 0.012], 2.2 + o2, 0, PI, sp * 0.5, [0, 0, 1]); line([-2.2 - o2, 3.4 - o2, FZ0 + 0.012], [2.2 + o2, 3.4 - o2, FZ0 + 0.012], sp * 0.5); });
    MAT = IRON; FINE = 0.6;
    for (i = -7; i <= 7; i++) {                                              // barras de pé (as da direita entortaram)
      x = i * 0.275; var top = 6.2 + Math.sqrt(Math.max(0, 2.2 * 2.2 - x * x)) * (Math.abs(x) < 2.2 ? 1 : 0);
      if (i > 2) broken(2, 0.8 + (i - 3) * 0.03, fall([x, 3.4, FZ0], 0, 0.35 + 0.1 * (i % 3), [0.1 * (i - 4), 0, 0.02]));
      line([x, 3.4, FZ0 + 0.03], [x, top, FZ0 + 0.03], sp * 0.5, 0, [0, 0, 1]);
      whole();
    }
    [4.3, 5.25, 6.2].forEach(function (y) { line([-2.2, y, FZ0 + 0.03], [2.2, y, FZ0 + 0.03], sp * 0.5, 0, [0, 0, 1]); });
    for (i = 1; i < 8; i++) { a = i * PI / 8; line([Math.cos(a) * 0.4, 6.2 + Math.sin(a) * 0.4, FZ0 + 0.03], [Math.cos(a) * 2.2, 6.2 + Math.sin(a) * 2.2, FZ0 + 0.03], sp * 0.55, 0, [0, 0, 1]); }
    arc('z', [0, 6.2, FZ0 + 0.03], 0.4, 0, PI, sp * 0.45, [0, 0, 1]); arc('z', [0, 6.2, FZ0 + 0.03], 1.3, 0, PI, sp * 0.5, [0, 0, 1]);
    FINE = f; MAT = STONE;
    solid('backL', [-FX, -2.2, GAL, SPRING, FZ0 - 0.3, FZ0]); solid('backR', [2.2, FX, GAL, SPRING, FZ0 - 0.3, FZ0]); solid('backB', [-2.2, 2.2, GAL, 3.4, FZ0 - 0.3, FZ0]);

    // --- colunas, arcada, cornija e paredes de fora (a segunda coluna da esquerda e a quarta da direita estão quebradas) ---
    for (s = -1; s <= 1; s += 2) {
      for (i = 0; i < COLZ.length; i++) {
        var ru = s < 0 && i === 1 ? { cut: 2.05, cuts: [2.9, 3.75, 4.5], drums: [[2, 1.5708, 1.5, 0.37, 1.3], [0, 1.5708, 0.9, 0.37, -0.9], [2, 1.2, 2.3, 0.5, 0.2]], grp: 1, fix: 0 }
          : s > 0 && i === 3 ? { cut: 3.3, cuts: [3.9, 4.5], drums: [[2, -1.5708, -1.2, LAND + 0.37 - 0, -0.2], [0, -1.4, -0.7, LAND + 0.4, 0.9]], grp: 2, fix: 0.55 } : null;
        column(s, i, ru);
        if (i < COLZ.length - 1) bay(s, COLZ[i], COLZ[i + 1], s < 0 && i < 2 ? { grp: 1, fix: 0.3 + i * 0.12 } : s > 0 && (i === 2 || i === 3) ? { grp: 2, fix: 0.68 + (i - 2) * 0.1 } : null);
      }
      bay(s, 5.0, COLZ[0], null); bay(s, COLZ[4], FZ0, null);
      // cornija com dentículos
      rise(0); f = FINE; FINE = 0.8; x = s * (NAVE - 0.36);
      line([x - s * 0.03, CORN, FZ0], [x - s * 0.03, CORN, 5.6], sp * 0.5); line([x - s * 0.08, CORN + 0.08, FZ0], [x - s * 0.08, CORN + 0.08, 5.6], sp * 0.5); line([x - s * 0.13, CORN + 0.16, FZ0], [x - s * 0.13, CORN + 0.16, 5.6], sp * 0.45);
      for (z = FZ0 + 0.1; z < 5.6; z += 0.16) add(L, x - s * 0.05, CORN + 0.035, z, -s, 0, 0);
      FINE = f;
      quad(F, [x, CORN + 0.16, FZ0], [0, 0, 5.6 - FZ0], [0, SPRING - CORN - 0.16, 0], sp * 1.5, [-s, 0, 0]);
      // parede de fora, vista pelos arcos: nichos em arco
      quad(F, [s * FX, 0, FZ0], [0, 0, FZ1 - FZ0], [0, CORN, 0], sp * 2.2, [-s, 0, 0], function (u, v) { var c = frac((u + 0.2) / 2.3) * 2.3 - 1.15; return (Math.abs(c) < 0.7 && v > 0.5 && (v < 2.6 || Math.hypot(c, v - 2.6) < 0.7) ? 0.45 : 1) * stone(u, v, 0.7, 0.35); });
      solid('wall' + s, s > 0 ? [FX, FX + 0.3, 0, CORN, FZ0, FZ1] : [-FX - 0.3, -FX, 0, CORN, FZ0, FZ1]);
      // pilar da entrada: base, faces com almofada, capitel (o canto de cima do da direita lascou)
      rise(5.0); x = s * NAVE;
      block({ x0: x - 0.68, x1: x + 0.68, y0: 0, y1: 0.5, z0: 4.32, z1: 5.68 }, s > 0 ? 'SWT' : 'SET', 0.68, 0.25);
      block({ x0: x - 0.6, x1: x + 0.6, y0: 0.5, y1: 5.9, z0: 4.4, z1: 5.6 }, s > 0 ? 'SW' : 'SE', 0.6, 0.3);
      f = FINE; FINE = 0.75;
      line([x - 0.4, 0.9, 5.607], [x + 0.4, 0.9, 5.607], sp * 0.5); line([x - 0.4, 5.5, 5.607], [x + 0.4, 5.5, 5.607], sp * 0.5); line([x - 0.4, 0.9, 5.607], [x - 0.4, 5.5, 5.607], sp * 0.5); line([x + 0.4, 0.9, 5.607], [x + 0.4, 5.5, 5.607], sp * 0.5);
      line([x - s * 0.607, 0.9, 4.6], [x - s * 0.607, 5.5, 4.6], sp * 0.5); line([x - s * 0.607, 0.9, 5.4], [x - s * 0.607, 5.5, 5.4], sp * 0.5); line([x - s * 0.607, 0.9, 4.6], [x - s * 0.607, 0.9, 5.4], sp * 0.5); line([x - s * 0.607, 5.5, 4.6], [x - s * 0.607, 5.5, 5.4], sp * 0.5);
      FINE = f;
      if (s > 0) broken(2, 0.9, heap(x - 0.9, 0, 5.3, 0.6, 0.35, 93));
      block({ x0: x - 0.7, x1: x + 0.7, y0: 5.9, y1: SPRING, z0: 4.3, z1: 5.7 }, s > 0 ? 'SWT' : 'SET', 0.7, 0.2);
      whole();
      solid('pier' + s, [x - 0.6, x + 0.6, 0, 5.9, 4.4, 5.6]); OCC.push([x - 0.6, x + 0.6, 0, SPRING, 4.4, 5.6]);
    }

    // --- abóbada de ferro e vidro: os dois arcos do meio perderam pedaços, que estão no chão ou pendurados ---
    var RZ = [5.0, COLZ[0], COLZ[1], COLZ[2], COLZ[3], COLZ[4], -8.3];
    for (i = 0; i < RZ.length; i++) {
      var rs = null;
      if (i === 2) rs = { 3: [1, 0.5, fall([-VR, SPRING, RZ[2]], 2, 1.25, [0.5, -SPRING + 0.2, 0.3])], 4: [1, 0.58, fall([-VR, SPRING, RZ[2]], 2, 1.25, [0.5, -SPRING + 0.2, 0.3])], 5: [1, 0.66, fall([-VR, SPRING, RZ[2]], 2, -0.5, [0, 0, 0])] };
      if (i === 1) rs = { 4: [1, 0.72, fall([-2.3, SPRING + 2.3, RZ[1]], 2, -0.9, [0, 0, 0])], 5: [1, 0.78, heap(-3.0, 0, 2.4, 0.9, 0.3, 101)] };
      if (i === 3) rs = { 0: [2, 0.92, fall([VR, SPRING, RZ[3]], 2, 0.45, [0, 0, 0])] };
      rib(RZ[i], RZ[i + 1], rs);
    }
    MAT = STONE;
  }

  // ---------- Decoração (o que a IA acrescenta) ----------
  // ordem: 0 estandartes, 1 tapete, 2 plantas, 3 lanternas, 4 flores (o atraso de cada grupo fica em dly)
  var DEC = [0, 0.2, 0.42, 0.62, 0.8];
  function banner(o, U, n, w, h, d) {       // pano que desce de uma haste: o = meio da haste, U = direção da haste, n = para onde olha
    var st = sp * 0.75, f = FINE, i;
    MAT = IRON; FINE = 0.7; SEED = [o[0], o[1], o[2]]; DLY = d;
    line([o[0] - U[0] * (w / 2 + 0.1), o[1], o[2] - U[2] * (w / 2 + 0.1)], [o[0] + U[0] * (w / 2 + 0.1), o[1], o[2] + U[2] * (w / 2 + 0.1)], st * 0.5, 0, n);
    MAT = CLOTH; FINE = 0.85;
    var first = cnt;
    quad(F, [o[0] - U[0] * w / 2 + n[0] * 0.02, o[1] - h, o[2] - U[2] * w / 2 + n[2] * 0.02], [U[0] * w, 0, U[2] * w], [0, h, 0], st, n, function (u, v) {
      if (v < 0.4 - Math.abs(u / w - 0.5) * 0.8) return 0;                    // a ponta em rabo de andorinha
      return 0.78 + 0.26 * Math.sin(u / w * 15 + v * 1.3);
    });
    for (i = first; i < cnt && i < N; i++) { sx[i] = px[i]; sz[i] = pz[i]; }   // cada ponto desce da própria haste
    MAT = GOLD; FINE = 0.7;                                                   // debrum e o emblema: anel e estrela
    line([o[0] - U[0] * w * 0.44 + n[0] * 0.03, o[1] - 0.06, o[2] - U[2] * w * 0.44 + n[2] * 0.03], [o[0] - U[0] * w * 0.44 + n[0] * 0.03, o[1] - h + 0.4, o[2] - U[2] * w * 0.44 + n[2] * 0.03], st * 0.6, 0, n);
    line([o[0] + U[0] * w * 0.44 + n[0] * 0.03, o[1] - 0.06, o[2] + U[2] * w * 0.44 + n[2] * 0.03], [o[0] + U[0] * w * 0.44 + n[0] * 0.03, o[1] - h + 0.4, o[2] + U[2] * w * 0.44 + n[2] * 0.03], st * 0.6, 0, n);
    var cy = o[1] - h * 0.42, r = w * 0.27;
    for (i = 0, st = Math.round(2 * PI * r / (sp * 0.4)); i < st; i++) { var a = i / st * 2 * PI; add(L, o[0] + U[0] * Math.cos(a) * r + n[0] * 0.03, cy + Math.sin(a) * r, o[2] + U[2] * Math.cos(a) * r + n[2] * 0.03, n[0], 0, n[2]); }
    for (i = 0; i < 4; i++) { var b = i * PI / 4; line([o[0] + U[0] * Math.cos(b) * r * 0.8 + n[0] * 0.03, cy + Math.sin(b) * r * 0.8, o[2] + U[2] * Math.cos(b) * r * 0.8 + n[2] * 0.03], [o[0] - U[0] * Math.cos(b) * r * 0.8 + n[0] * 0.03, cy - Math.sin(b) * r * 0.8, o[2] - U[2] * Math.cos(b) * r * 0.8 + n[2] * 0.03], sp * 0.5, 0, n); }
    FINE = f;
  }
  function plant(x, y, z, d) {               // vaso de pedra com uma planta de folhas em arco
    var f = FINE, i, k;
    MAT = MARBLE; SEED = [x, y, z]; DLY = d; FINE = 0.7;
    tube([x, y, z], [x, y + 0.12, z], 0.16, 0.12, sp * 0.7); tube([x, y + 0.12, z], [x, y + 0.5, z], 0.14, 0.26, sp * 0.7); tube([x, y + 0.5, z], [x, y + 0.58, z], 0.27, 0.22, sp * 0.7);
    ring(x, y + 0.58, z, 0.23, sp * 0.4);
    MAT = LEAF; FINE = 0.6;
    for (i = 0; i < 11; i++) {
      var a = i * 2.39996, len = 0.75 + 0.35 * hash2(i, 3), up = 0.75 + 0.5 * hash2(i, 7), prev = [x, y + 0.58, z];
      for (k = 1; k <= 12; k++) {
        var t = k / 12, pos = [x + Math.cos(a) * len * t, y + 0.58 + up * Math.sin(t * PI * 0.85) - 0.25 * t * t, z + Math.sin(a) * len * t];
        line(prev, pos, sp * 0.5, 0, [0, 1, 0], F);
        var lw = 0.13 * Math.sin(t * PI) + 0.02;                               // os folíolos, dos dois lados da haste
        line([pos[0] - Math.sin(a) * lw, pos[1] - 0.03, pos[2] + Math.cos(a) * lw], [pos[0] + Math.sin(a) * lw, pos[1] - 0.03, pos[2] - Math.cos(a) * lw], sp * 0.45, 0, [0, 1, 0], F);
        prev = pos;
      }
    }
    FINE = f;
    SOL.push({ id: 'pot' + SOL.length, box: [x - 0.24, x + 0.24, y, y + 0.58, z - 0.24, z + 0.24], shape: 'cyl', kind: 1, dl: d });
  }
  function lantern(x, y, z, n, d) {          // lanterna de parede: suporte, caixa de vidro com tampa e a chama
    var f = FINE, i, c = [x + n[0] * 0.2, y, z + n[2] * 0.2];
    MAT = IRON; SEED = [x, y, z]; DLY = d; FINE = 0.6;
    line([x, y + 0.16, z], [c[0], y + 0.2, c[2]], sp * 0.4); line([x, y - 0.1, z], [c[0], y + 0.2, c[2]], sp * 0.5);
    for (i = 0; i < 4; i++) { var a = i * PI / 2 + PI / 4, ox = Math.cos(a) * 0.07, oz = Math.sin(a) * 0.07; line([c[0] + ox, y - 0.1, c[2] + oz], [c[0] + ox, y + 0.13, c[2] + oz], sp * 0.4); line([c[0] + ox, y + 0.13, c[2] + oz], [c[0], y + 0.22, c[2]], sp * 0.4); }
    ring(c[0], y - 0.1, c[2], 0.1, sp * 0.35); ring(c[0], y + 0.13, c[2], 0.1, sp * 0.35);
    MAT = GOLD; FINE = 0.9;
    for (i = 0; i < Math.round(26 * KQ); i++) add(M, c[0] + (jr() - 0.5) * 0.07, y + (jr() - 0.5) * 0.14, c[2] + (jr() - 0.5) * 0.07, 0, 1, 0, 2);
    FINE = f;
    GLOW.push([c[0], y, c[2], 2.3, 0.9]);
  }
  function decor() {
    var s, i, k, f = FINE, x, z, a, q;
    CAT = DECO; whole();
    // 0: estandartes nos dois pilares da entrada e entre as colunas
    for (s = -1; s <= 1; s += 2) {
      banner([s * NAVE, 5.75, 5.625], [1, 0, 0], [0, 0, 1], 0.82, 3.3, DEC[0] + 0.02 * (s + 1));
      for (i = 0; i < 3; i++) banner([s * (NAVE - 0.42), 6.2, (COLZ[i] + COLZ[i + 1]) / 2], [0, 0, 1], [-s, 0, 0], 0.9, 2.9, DEC[0] + 0.04 + i * 0.035);
    }
    // 1: tapete, da entrada até o pedestal, subindo a escadaria; desenrola a partir da entrada
    MAT = RUG;
    function rug(o, U, V, n, d0, d1) {
      SEED = [0, 0.01, 5.3];
      quad(F, o, U, V, sp * 0.9, n, function (u, v) { var e = Math.min(u, 1.3 - u); return e < 0.03 ? 0 : e < 0.1 ? 1.5 : 0.62 + 0.3 * (Math.abs(frac(u / 0.325) - 0.5) + Math.abs(frac(v / 0.325 + d0) - 0.5) < 0.42 ? 1 : 0); }, 0);
    }
    DLY = DEC[1]; rug([-0.65, 0.014, ST_Z + 0.02], [1.3, 0, 0], [0, 0, 5.3 - ST_Z], [0, 1, 0], 0, 0);
    for (k = 0; k < STEPS; k++) { DLY = DEC[1] + 0.07 + k * 0.008; rug([-0.65, k * RISE, ST_Z - k * RUN + 0.014], [1.3, 0, 0], [0, RISE, 0], [0, 0, 1], k, 0); rug([-0.65, (k + 1) * RISE + 0.014, ST_Z - (k + 1) * RUN], [1.3, 0, 0], [0, 0, RUN], [0, 1, 0], k, 0); }
    DLY = DEC[1] + 0.14; rug([-0.65, LAND + 0.014, SO[2] + 0.8], [1.3, 0, 0], [0, 0, LAND_Z1 - SO[2] - 0.8], [0, 1, 0], 3, 0);
    // 2: plantas ao pé das colunas e ao lado do pedestal
    [[-2.85, 0, COLZ[0]], [2.85, 0, COLZ[0]], [-2.85, 0, COLZ[2] + 2.0], [2.85, 0, COLZ[2] + 2.0], [-1.45, LAND, SO[2] + 0.3], [1.45, LAND, SO[2] + 0.3]].forEach(function (p, pi) { plant(p[0], p[1], p[2], DEC[2] + pi * 0.02); });
    // 3: lanternas nas colunas e nos pilares
    for (s = -1; s <= 1; s += 2) {
      for (i = 0; i < COLZ.length; i++) lantern(s * (NAVE - COLR), 2.7, COLZ[i], [-s, 0, 0], DEC[3] + i * 0.02);
      lantern(s * (NAVE - 0.6), 3.0, 5.0, [-s, 0, 0], DEC[3]);
    }
    // 4: flores em volta do pedestal e uma guirlanda entre as colunas
    MAT = GOLD; FINE = 0.55; SEED = [SO[0], LAND, SO[2]]; DLY = DEC[4];
    for (i = 0; i < Math.round(700 * E.K); i++) { a = jr() * 2 * PI; k = 0.84 + jr() * 0.34; var sq = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))); MAT = jr() < 0.35 ? GOLD : LEAF; add(F, SO[0] + Math.cos(a) * k / sq, LAND + 0.03 + jr() * 0.16, SO[2] + Math.sin(a) * k / sq, 0, 1, 0, 3); }
    for (s = -1; s <= 1; s += 2) for (i = 0; i < COLZ.length - 1; i++) {
      x = s * (NAVE - 0.4); DLY = DEC[4] + 0.03 + i * 0.03; SEED = [x, CAP - 0.3, (COLZ[i] + COLZ[i + 1]) / 2];
      for (k = 0; k < Math.round(90 * E.K); k++) { var t = jr(), zz = COLZ[i] + (COLZ[i + 1] - COLZ[i]) * t, yy = CAP - 0.25 - 0.55 * Math.sin(t * PI); MAT = jr() < 0.25 ? GOLD : LEAF; add(F, x - s * jr() * 0.06, yy + (jr() - 0.5) * 0.12, zz + (jr() - 0.5) * 0.05, -s, 0.3, 0, 3); }
    }
    FINE = f; MAT = STONE; SEED = null; CAT = HALL; DLY = 0;
    GLOW.push([CUBE[0], CUBE[1], CUBE[2], 3.2, 1]);
  }

  // ---------- Drones de reparo e os feixes ----------
  function drones() {
    var f = FINE, r = E.rng(13);
    DRONES.forEach(function (d, di) {
      var c = d.at, i, k, a;
      var first = cnt;
      CAT = DRONE; MAT = SHELL; FINE = 1.2; DLY = di * 0.2; SEED = null;
      ellip(c, [0.2, 0.085, 0.14], sp * 0.45);
      for (i = 0; i < 4; i++) {
        a = PI / 4 + i * PI / 2; var rx = c[0] + Math.cos(a) * 0.33, rz = c[2] + Math.sin(a) * 0.33;
        line([c[0] + Math.cos(a) * 0.12, c[1], c[2] + Math.sin(a) * 0.1], [rx, c[1] + 0.03, rz], sp * 0.4);
        ring(rx, c[1] + 0.05, rz, 0.13, sp * 0.3); ring(rx, c[1] + 0.05, rz, 0.06, sp * 0.35);
        MAT = GLASS; for (k = 0; k < Math.round(30 * KQ); k++) { var ra = r() * 2 * PI, rr = Math.sqrt(r()) * 0.125; add(F, rx + Math.cos(ra) * rr, c[1] + 0.05, rz + Math.sin(ra) * rr, 0, 1, 0); } MAT = SHELL;
      }
      var t = unit([d.to[0] - c[0], d.to[1] - c[1], d.to[2] - c[2]]), e = [c[0] + t[0] * 0.2, c[1] - 0.1, c[2] + t[2] * 0.2];
      line([c[0], c[1] - 0.06, c[2]], e, sp * 0.4);
      MAT = GOLD; FINE = 0.8;
      for (i = 0; i < Math.round(20 * KQ); i++) add(M, e[0] + (r() - 0.5) * 0.05, e[1] + (r() - 0.5) * 0.05, e[2] + (r() - 0.5) * 0.05, 0, 1, 0, 3);                 // o emissor
      for (i = 0; i < Math.round(8 * KQ); i++) add(M, c[0] + t[0] * 0.19 + (r() - 0.5) * 0.03, c[1] + 0.02 + (r() - 0.5) * 0.03, c[2] + t[2] * 0.13 + (r() - 0.5) * 0.03, 0, 1, 0, 3);   // o olho
      for (i = first; i < cnt && i < N; i++) { sx[i] = px[i] - c[0] * 0.7; sy[i] = py[i] + 8.5 + di * 0.5; sz[i] = pz[i] - c[2] * 0.4 + 1; }   // descem inteiros, pelo vão do teto
      // feixe até a peça em conserto: um fio e pacotes de luz que correm, e as faíscas no alvo
      SEED = [e[0], e[1], e[2]]; FINE = 0.7;
      line(e, d.to, sp * 0.7, 0, null, X);
      for (k = 0; k < 4; k++) for (i = 0, a = Math.round(12 * KQ); i < a; i++) { var q = add(X, (e[0] + d.to[0]) / 2, (e[1] + d.to[1]) / 2, (e[2] + d.to[2]) / 2, 0, 1, 0, 1); if (q >= 0) { flow(q, d.to[0] - e[0], d.to[1] - e[1], d.to[2] - e[2], frac(k / 4 + di * 0.31 - i / a * 0.12)); tex[q] = 1 - i / a; } }
      SEED = [d.to[0], d.to[1], d.to[2]];
      for (i = 0; i < Math.round(60 * E.K); i++) { q = add(X, d.to[0] + (r() - 0.5) * 0.5, d.to[1] + (r() - 0.5) * 0.5, d.to[2] + (r() - 0.5) * 0.5, 0, 1, 0, 2); if (q >= 0) { flow(q, (r() - 0.5) * 0.3, 0.25 + r() * 0.3, (r() - 0.5) * 0.3, r()); tex[q] = 0.4 + r() * 0.6; } }
    });
    FINE = f; MAT = STONE; CAT = HALL; SEED = null; DLY = 0;
  }

  // ---------- O que fica no ar: fachos de sol, poeira, névoa, o clarão da janela ----------
  function air() {
    var r = E.rng(29), i, q, f = FINE;
    CAT = AIR; MAT = GOLD; SEED = null; DLY = 0;
    SHAFTS.forEach(function (s, si) {
      var len = (10.4 - s[1]) / SUN[1], u = unit([SUN[2], 0, -SUN[0]]), v = [SUN[1] * u[2] - SUN[2] * u[1], SUN[2] * u[0] - SUN[0] * u[2], SUN[0] * u[1] - SUN[1] * u[0]], k, n = Math.round(900 * E.K * s[3] * s[3] * s[4]);
      var subs = []; for (k = 0; k < 7; k++) { var a = r() * 2 * PI, d = Math.sqrt(r()) * s[3] * 0.75; subs.push([Math.cos(a) * d, Math.sin(a) * d, s[3] * (0.16 + r() * 0.3)]); }
      for (i = 0; i < n; i++) {                                              // cada facho é um feixe de raios finos
        var sb = subs[i % 7], a2 = r() * 2 * PI, d2 = Math.sqrt(r()) * sb[2], t = Math.pow(r(), 0.8) * len, ox = sb[0] + Math.cos(a2) * d2, oy = sb[1] + Math.sin(a2) * d2;
        FINE = 1.5 + r() * 1.6;
        q = add(V, s[0] + SUN[0] * t + u[0] * ox + v[0] * oy, s[1] + SUN[1] * t + u[1] * ox + v[1] * oy, s[2] + SUN[2] * t + u[2] * ox + v[2] * oy, 0, 1, 0, 1);
        if (q >= 0) { tex[q] = s[4] * (0.5 + r() * 0.5) * (0.55 + 0.45 * t / len); flow(q, -SUN[0] * 0.5, -SUN[1] * 0.5, -SUN[2] * 0.5, r()); dly[q] = si * 0.18 + (1 - t / len) * 0.3; }
      }
      for (i = 0; i < Math.round(n * 0.12); i++) {                           // grãos de poeira que brilham dentro do facho
        var a3 = r() * 2 * PI, d3 = Math.sqrt(r()) * s[3] * 0.9, t3 = r() * len * 0.8;
        FINE = 0.5 + r() * 0.5;
        q = add(V, s[0] + SUN[0] * t3 + u[0] * Math.cos(a3) * d3 + v[0] * Math.sin(a3) * d3, s[1] + SUN[1] * t3 + u[1] * Math.cos(a3) * d3 + v[1] * Math.sin(a3) * d3, s[2] + SUN[2] * t3 + u[2] * Math.cos(a3) * d3 + v[2] * Math.sin(a3) * d3, 0, 1, 0, 3);
        if (q >= 0) { tex[q] = 0.5 + r() * 0.7; flow(q, (r() - 0.5) * 0.3, -0.25 - r() * 0.2, (r() - 0.5) * 0.3, r()); dly[q] = si * 0.18 + 0.3; }
      }
    });
    for (i = 0; i < Math.round(420 * E.K); i++) {                            // névoa rente ao chão
      FINE = 5 + r() * 5;
      q = add(V, (r() - 0.5) * 9.5, 0.1 + r() * r() * 1.1, FZ0 + 2 + r() * 12.5, 0, 1, 0, 2);
      if (q >= 0) { tex[q] = 0.3 + r() * 0.7; flow(q, 0.5 + r() * 0.5, 0, 0.1, r()); dly[q] = r(); }
    }
    for (i = 0; i < Math.round(500 * E.K); i++) {                            // o clarão na janela do fundo
      var wx = (r() - 0.5) * 4.2, wy = 3.5 + r() * 4.8;
      if (wy > 6.2 && Math.hypot(wx, wy - 6.2) > 2.15) continue;
      FINE = 2 + r() * 3;
      q = add(V, wx, wy, FZ0 - 0.1, 0, 0, 1, 4); if (q >= 0) { tex[q] = 0.4 + r() * 0.6; dly[q] = 0.05; }
    }
    FINE = f; CAT = HALL; MAT = STONE;
  }

  // ---------- Montagem ----------
  function build(step) {
    cnt = 0; OCC = []; BALL = []; SOL = []; GLOW = []; sp = step; jr = E.rng(7);
    MAT = STONE; CAT = HALL; TEX = 1; FINE = 1; DLY = 0; SEED = null; whole();
    hall(); statue(); decor(); drones(); air();
    return cnt;
  }
  // Ajusta o passo da malha até tudo caber nos pontos disponíveis (quase tudo é malha: a quantidade cai com o quadrado
  // do passo, então uma medida grosseira já deixa o passo perto do certo); o que sobra fica guardado, invisível
  var STEP = 0.062 / Math.sqrt(E.K), s1 = STEP * 1.7, s2 = STEP * 2.4, goal = N * 0.972, tries = 0;
  DRY = true;
  var n1 = build(s1), n2 = build(s2), Bq = (n1 * s1 * s1 - n2 * s2 * s2) / (s1 - s2), Aq = n1 * s1 * s1 - Bq * s1;     // quantidade ~ Aq / passo² + Bq / passo
  DRY = false;
  STEP = (Bq + Math.sqrt(Bq * Bq + 4 * Aq * goal)) / (2 * goal);
  while (tries++ < 4) { var got = build(STEP); if (got > N * 0.995) STEP *= Math.pow(got / goal, 0.55); else if (got < N * 0.9) STEP *= Math.pow(got / goal, 0.5); else break; }
  var r0 = E.rng(23), i0;
  CAT = AIR; MAT = STONE; SEED = null;
  for (i0 = cnt; i0 < N; i0++) add(Z, 0, 0, 0, 0, 1, 0);
  for (i0 = 0; i0 < N; i0++) rnd[i0] = r0();
  SOL.forEach(function (s) { if (s.shape) E.solidShape(s.id, s.shape); });

  // ---------- Luz ----------
  // O raio que sai do ponto na direção do sol bate em alguma coisa?
  function shaded(x, y, z) {
    var q, o, t1, t2, lo, hi, S = SUN;
    for (q = 0; q < OCC.length; q++) {
      o = OCC[q];
      t1 = (o[0] - x) / S[0]; t2 = (o[1] - x) / S[0]; lo = Math.min(t1, t2); hi = Math.max(t1, t2);
      t1 = (o[2] - y) / S[1]; t2 = (o[3] - y) / S[1]; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      if (hi <= lo) continue;
      t1 = (o[4] - z) / S[2]; t2 = (o[5] - z) / S[2]; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
      if (hi > Math.max(lo, 0.03)) return true;
    }
    for (q = 0; q < BALL.length; q++) {
      o = BALL[q];
      var ox = o[0] - x, oy = o[1] - y, oz = o[2] - z, tc = ox * S[0] + oy * S[1] + oz * S[2];
      if (tc > 0.06 && ox * ox + oy * oy + oz * oz - tc * tc < o[3] * o[3]) return true;
    }
    return false;
  }
  // Quanto de sol chega ao ponto: dentro de algum facho (0 a 1, mais forte no eixo)
  function sunAt(x, y, z) {
    var best = 0;
    for (var q = 0; q < SHAFTS.length; q++) {
      var s = SHAFTS[q], vx = x - s[0], vy = y - s[1], vz = z - s[2], t = vx * SUN[0] + vy * SUN[1] + vz * SUN[2], d = Math.hypot(vx - SUN[0] * t, vy - SUN[1] * t, vz - SUN[2] * t) / s[3];
      if (d < 1) best = Math.max(best, s[4] * Math.min(1, (1 - d) * 2.4));
    }
    return best;
  }
  // Luz quente das lanternas e do cubo sobre um ponto (0 a 1)
  function glow(x, y, z) {
    var g = 0;
    for (var q = 0; q < GLOW.length; q++) { var o = GLOW[q], d = Math.hypot(x - o[0], y - o[1], z - o[2]) / o[3]; if (d < 1) g += (1 - d) * (1 - d) * o[4]; }
    return Math.min(1, g);
  }

  // ---------- Cores ----------
  var cp = [0, 0, 0], cg = [0, 0, 0], col = [0, 0, 0];
  // cor de um ponto: tom h e brilho k na rampa principal, puxada para o dourado na medida g (0 a 1)
  function tint(h, k, g) {
    E.tone(clamp(h, 0, 1), k, cp);
    if (g > 0) { E.tone(2 + clamp(h, 0, 0.999), k, cg); col[0] = cp[0] + (cg[0] - cp[0]) * g; col[1] = cp[1] + (cg[1] - cp[1]) * g; col[2] = cp[2] + (cg[2] - cp[2]) * g; }
    else { col[0] = cp[0]; col[1] = cp[1]; col[2] = cp[2]; }
  }
  // tom e brilho de base de cada material (na ordem de STONE a SHELL)
  var MH = [0.56, 0.8, 0.44, 0.74, 0.5, 0.62, 0.72, 0.5, 0.86], MK = [1.3, 1.45, 1.2, 1.3, 1.2, 1.4, 0.4, 1.0, 1.3];
  var PH = [0.34, 0.14, 0.5, 0.26, 0.42, 0.6, 0.6], PK = [1.15, 0.7, 1.3, 1.0, 1.2, 1.35, 1.3];      // zonas do piso (P_TILE a P_TOP)

  // Cada cena: até onde a obra chegou e com que luz
  //   stage 0 baseplate | 1 planta | 2 de pé     mend: 0 ruína | 1 primeiro conserto | 2 tudo inteiro
  //   sun: força dos fachos | amb: luz de fundo | air: névoa e poeira | drones, beams, deco, warm (lanternas e cubo acesos)
  var LOOKS = {
    base: { stage: 0 }, plan: { stage: 1 },
    ruin: { stage: 2, mend: 0, flat: true },
    rays: { stage: 2, mend: 0, sun: 1, amb: 0.2, air: 1, cube: 1 },
    swarm: { stage: 2, mend: 0, sun: 1, amb: 0.22, air: 1, cube: 1, drones: true, beams: true },
    mendA: { stage: 2, mend: 1, sun: 1, amb: 0.24, air: 1, cube: 1, drones: true, beams: true },
    mendB: { stage: 2, mend: 2, sun: 1, amb: 0.27, air: 0.9, cube: 1, drones: true, beams: true },
    clean: { stage: 2, mend: 2, sun: 0.95, amb: 0.3, air: 0.75, cube: 1 },
    deco: { stage: 2, mend: 2, sun: 0.85, amb: 0.3, air: 0.6, cube: 1.25, deco: true, warm: 1 }
  };

  // Preenche a cena "name" nos pontos de a até b (a cena é montada em fatias, para não segurar o filme)
  function fill(name, s, a, b) {
    var Lk = LOOKS[name], st = Lk.stage, pos = s.pos, cl = s.col, fl = s.flow, i, k, x, y, z, h, kk, g, m, lam, sun, lit, c, n0, n1, n2, o;
    for (i = a; i < b; i++) {
      k = kind[i]; c = cat[i]; m = mat[i]; h = 0; kk = 0; g = 0;
      if (c === HALL) {
        var up = st >= 2, hurt = grp[i] && grp[i] < 3 && Lk.mend < grp[i];
        x = up ? (hurt ? qx[i] : px[i]) : sx[i]; y = up ? (hurt ? qy[i] : py[i]) : sy[i]; z = up ? (hurt ? qz[i] : pz[i]) : sz[i];
        n0 = nx[i]; n1 = ny[i]; n2 = nz[i];
        if (st === 0) { if (k === G) { o = frac(px[i] / 0.5 + 0.5) < 0.09 || frac(pz[i] / 0.5) < 0.09; h = o ? 0.9 : 0.28; kk = 1; } }
        else if (st === 1) {                                                   // planta: o piso apagado e as peças riscadas no chão
          if (k === G) { h = 0.2 + PH[tag[i]] * 0.4; kk = 0.42 * PK[tag[i]]; }
          else if (m === GOLD) { h = 0.9; kk = 0.7; }
          else if (sx[i] === px[i] && sz[i] === pz[i]) { h = 0.9; kk = 0.1 * (k === L ? 1.5 : 1); }
        } else {
          var base = k === G ? PK[tag[i]] : MK[m], tone = k === G ? PH[tag[i]] : MH[m], txv = tex[i];
          if (k === G && grp[i] === 3 && Lk.mend < 2) { txv *= 0.18; y -= 0.02; }                 // rachadura aberta
          if (k === M) {                                                       // quem emite: o cubo da estátua
            lit = Lk.cube || 0;
            h = 0.6; kk = lit ? 1.5 * lit : 0.5; g = lit ? 1 : 0;
          } else if (Lk.flat) {
            lam = k === L ? 0.95 : 0.38 + 0.62 * Math.max(0, n0 * KEY[0] + n1 * KEY[1] + n2 * KEY[2]);
            h = tone; kk = base * txv * lam; g = m === GOLD ? 0.35 : 0;
          } else {
            sun = sunAt(x, y, z) * Lk.sun; lam = 0;
            if (sun > 0.02) { lam = k === L ? 0.5 : n0 * SUN[0] + n1 * SUN[1] + n2 * SUN[2]; if (lam > 0.03 && !shaded(x + n0 * 0.04, y + n1 * 0.04, z + n2 * 0.04)) lam *= sun; else lam = 0; }
            var amb = Lk.amb * (k === L ? 1.25 : 0.7 + 0.3 * n1), warm = Lk.warm ? glow(x, y, z) : 0, cube = 0;
            if (Lk.cube && (m === MARBLE || tag[i] === 1)) {                     // a luz do cubo na estátua
              var cx = CUBE[0] - x, cy = CUBE[1] - y, cz = CUBE[2] - z, cd = Math.hypot(cx, cy, cz);
              if (cd < 3.2) cube = Math.max(0, (n0 * cx + n1 * cy + n2 * cz) / cd) * Lk.cube * 0.8 / (0.6 + cd * cd * 1.3) + 0.06 * Lk.cube;
            }
            kk = base * txv * (amb + lam * 1.7 + warm * 0.9 + cube * 1.5);
            g = clamp((lam * 1.2 + warm * 0.9 + cube * 1.3) / (amb + lam * 1.7 + warm * 0.9 + cube * 1.5 + 0.001), 0, 1) * 0.75;
            h = tone * (0.72 + 0.4 * Math.min(1, lam + warm + cube)) + (m === GOLD ? 0.1 : 0);
            if (m === GOLD) g = Math.max(g, 0.7);
          }
        }
      } else if (c === DECO) {
        var on = !!Lk.deco;
        x = on ? px[i] : sx[i]; y = on ? py[i] : sy[i]; z = on ? pz[i] : sz[i];
        if (on) {
          if (k === M) { h = 0.62; kk = 1.9; g = 1; }
          else {
            sun = sunAt(x, y, z) * Lk.sun; lam = k === L ? 0.6 : Math.abs(nx[i] * SUN[0] + ny[i] * SUN[1] + nz[i] * SUN[2]);
            if (sun > 0.02 && shaded(x, y + 0.03, z)) sun = 0;
            o = glow(x, y, z);
            kk = MK[m] * tex[i] * (Lk.amb * 1.15 + sun * lam * 1.4 + o * 0.9); h = MH[m] * (0.8 + 0.3 * Math.min(1, sun + o));
            g = m === GOLD ? 0.95 : m === RUG || m === CLOTH ? 0.55 + 0.3 * o : clamp((sun * lam + o) * 0.8, 0, 0.7);
            if (tag[i] === 3 && m === GOLD) kk *= 1.6;
          }
        }
      } else if (c === DRONE) {
        on = !!Lk.drones;
        x = on ? px[i] : sx[i]; y = on ? py[i] : sy[i]; z = on ? pz[i] : sz[i];
        if (k === X) { if (Lk.beams) { g = 1; h = 0.62; kk = tag[i] === 1 ? 1.9 * tex[i] : tag[i] === 2 ? 1.2 * tex[i] : 0.45; } }
        else if (on) { if (k === M) { h = 0.62; kk = 2; g = 1; } else { h = MH[m]; kk = MK[m] * (m === GLASS ? 0.5 : 0.55 + 0.45 * Math.max(0, ny[i])); g = 0.12; } }
      } else {
        x = px[i]; y = py[i]; z = pz[i];
        if (k === V && Lk.air) {
          o = tag[i];
          if (o === 1) { h = 0.66; kk = 0.11 * tex[i] * Lk.sun * Lk.air; g = 0.78; }
          else if (o === 3) { h = 0.7; kk = 0.9 * tex[i] * Lk.sun; g = 0.8; }
          else if (o === 2) { h = 0.5; kk = 0.035 * tex[i] * Lk.air; g = 0.25; }
          else { h = 0.72; kk = 0.16 * tex[i] * Lk.sun; g = 0.55; }
        }
      }
      tint(h, kk, g);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; cl[i * 3] = col[0]; cl[i * 3 + 1] = col[1]; cl[i * 3 + 2] = col[2];
      if (fph[i] >= 0) { fl[i * 4] = fvx[i]; fl[i * 4 + 1] = fvy[i]; fl[i * 4 + 2] = fvz[i]; fl[i * 4 + 3] = fph[i]; }
    }
  }

  // ---------- Sólidos de cada cena ----------
  // kind 0: peça do saguão (na planta fica achatada no chão; quebrada, só existe depois do conserto) | 1: vaso (só com a decoração)
  function solidsOf(name) {
    var Lk = LOOKS[name], out = {};
    SOL.forEach(function (s) {
      var b = s.box;
      if (s.kind === 1) { if (Lk.deco) out[s.id] = b; else if (name === 'clean') out[s.id] = [b[0], b[1], b[2], b[2], b[4], b[5]]; return; }
      if (Lk.stage < 1) return;
      if (Lk.stage < 2) { out[s.id] = [b[0], b[1], 0, 0, b[4], b[5]]; return; }
      if (!s.grp || Lk.mend >= s.grp) out[s.id] = b;
      else if (Lk.mend === s.grp - 1) out[s.id] = [b[0], b[1], b[2], b[2], b[4], b[5]];
    });
    return out;
  }
  var SL = Math.max(4, Math.ceil(N / 14000)), WIP = {};
  function begin() { var s = new E.Shape(); s.flow = new Float32Array(N * 4); s.n = N; return s; }
  Object.keys(LOOKS).forEach(function (name) {
    var steps = [], c;
    function part(c) { return function () { if (c === 0) WIP[name] = begin(); fill(name, WIP[name], Math.floor(N * c / SL), Math.floor(N * (c + 1) / SL)); return 1; }; }
    for (c = 0; c < SL; c++) steps.push(part(c));
    E.scene(name, {
      steps: steps, size: 0.064, gain: name === 'base' || name === 'plan' ? 1 : 1.05, vary: 0.1, dof: name === 'base' || name === 'plan' ? 0.05 : 0.075, rate: 0.3, solids: solidsOf(name),
      make: function (ready) { var s; if (ready && WIP[name]) s = WIP[name]; else { s = begin(); fill(name, s, 0, N); } WIP[name] = null; return s; }
    });
  });

  // ---------- Papéis dos pontos em cada passagem ----------
  // [atraso, arco, turbulência, tamanho] de cada ponto; o tamanho vale em todas (traços finos, rosto, névoa)
  function role(delay, turb, arcOf) {
    return function () { var a = new Float32Array(N * 4); for (var i = 0; i < N; i++) { a[i * 4] = delay(i); a[i * 4 + 1] = arcOf ? arcOf(i) : 0; a[i * 4 + 2] = turb || 0; a[i * 4 + 3] = psz[i]; } return a; };
  }
  E.fx('settle', role(function (i) { return clamp(Math.hypot(sx[i], sz[i] + 1.5) / 9, 0, 1); }, 0));                // o mar assenta do centro para as bordas
  E.fx('draw', role(function (i) { return clamp((FZ1 - sz[i]) / (FZ1 - FZ0), 0, 1); }));                           // a planta é riscada da entrada para o fundo
  E.fx('raise', role(function (i) { return cat[i] === HALL ? dly[i] + (kind[i] === G ? 0 : 0.12 * clamp(py[i] / 9, 0, 1)) : 0; }));   // o saguão sobe do chão
  E.fx('light', role(function (i) { return cat[i] === AIR ? clamp(dly[i], 0, 1) : clamp(0.5 - (px[i] * SUN[0] + pz[i] * SUN[2]) / 12, 0, 1); }));
  E.fx('arrive', role(function (i) { return cat[i] === DRONE ? dly[i] : rnd[i] * 0.3; }));
  E.fx('mend', role(function (i) { return grp[i] ? fxd[i] + rnd[i] * 0.04 : 0; }, 0, function (i) { return grp[i] && grp[i] < 3 ? 0.5 + rnd[i] : 0; }));   // as peças voltam, em arco
  E.fx('dress', role(function (i) { return cat[i] === DECO ? dly[i] + rnd[i] * 0.03 : 0; }));
  E.fx('hold', role(function () { return 0; }));
  var SOLBY = {}; SOL.forEach(function (s) { SOLBY[s.id] = s; });
  E.solidFx('raise', function (id) { var s = SOLBY[id]; return s ? s.dl : 0; });
  E.solidFx('mend', function (id) { var s = SOLBY[id]; return s && s.grp ? s.fix + 0.05 : 0; });
  E.solidFx('dress', function (id) { var s = SOLBY[id]; return s && s.kind === 1 ? s.dl : 0; });

  // ---------- O que a câmera olha e onde as etiquetas ficam presas ----------
  E.subject('hall', { at: function () { return [0, 2.2, -1.5]; } });
  E.subject('statue', { at: function () { return [SO[0], SO[1] + 1.5, SO[2]]; } });
  E.subject('face', { at: function () { return [HEAD[0], HEAD[1] - 0.01, HEAD[2] + 0.06]; } });
  E.anchor('drone0', function () { return [DRONES[0].at[0], DRONES[0].at[1] + 0.22, DRONES[0].at[2]]; });
  E.anchor('drone2', function () { return [DRONES[2].at[0], DRONES[2].at[1] + 0.22, DRONES[2].at[2]]; });
  E.anchor('piece', function () { return [-2.6, 2.6, COLZ[1] + 0.3]; });
  E.anchor('rib', function () { return [-1.9, 8.75, COLZ[1]]; });
  E.anchor('plaque', function () { return [SO[0], LAND + 1.0, SO[2] + 0.62]; });
});
