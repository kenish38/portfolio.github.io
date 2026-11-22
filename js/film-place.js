// ===== O lugar que o filme constrói =====
// Uma cidade pequena, do tamanho de uma baseplate (10 x 10), montada na mesma ordem de um trabalho de verdade:
//   base    a baseplate vazia
//   plan    a planta: ruas, calçadas, praça e o contorno de cada construção riscados no chão
//   grey    os volumes sobem dos contornos, já com os telhados (o "greybox")
//   built   o detalhe: janelas, vitrines, toldos, sacadas, colunas, árvores, postes, fonte, carros
//   dusk    a luz: um sol baixo, sombras longas, vitrines, janelas e postes acesos
//   night   os sistemas: a cidade à noite, com os pulsos de dados correndo dos objetos até o servidor
//   calm    a mesma noite, sem os pulsos (a cena da interface, que é desenhada em HTML por cima)
//   frame   o projeto da torre do relógio aparece em arame dourado no terreno vazio
//   tower   a torre é preenchida peça por peça, de baixo para cima (a cena da engenharia de IA)
//   dawn    a cidade pronta, com o sol nascendo do outro lado
// Cada ponto tem um lugar fixo no "modelo" (chão, paredes, arestas, objetos, torre, pulsos). As cenas só dizem onde
// cada um está e de que cor: de uma cena para outra, cada ponto vai direto para o lugar dele, sem revoada.
// Os volumes escondem o que está atrás por causa dos sólidos invisíveis do motor (ver "Sólidos" em js/matter.js).
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  var N = E.N, clamp = E.clamp, PI = Math.PI, KQ = Math.sqrt(E.K);
  function frac(v) { return v - Math.floor(v); }
  function hash3(a, b, c) { return frac(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453); }
  function unit(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

  // ---------- O projeto ----------
  // x cresce para o leste e z para o sul. A câmera fica sempre do lado sul: as faces norte quase nunca são geradas.
  // Rua principal (leste-oeste) entre ST0 e ST1; avenida (norte-sul) de meia largura AVW, só do lado norte.
  var ST0 = -0.95, ST1 = 0.25, AVW = 0.55, WALK = 0.3;
  // Um volume de construção: caixa, estilo da fachada, faces geradas (S, E, W, N) e telhado
  //   telhado: { type: 'gable', axis: 'x' | 'z', rise } duas águas | { type: 'pyr', rise } quatro águas
  function tier(x0, x1, z0, z1, y0, y1, style, faces, roof) { return { x0: x0, x1: x1, z0: z0, z1: z1, y0: y0, y1: y1, style: style, faces: faces, roof: roof || null }; }
  var BUILD = [
    // quadra noroeste, fileira da frente: padaria, sobrado e a loja da esquina
    [tier(-4.5, -3.45, -2.55, -1.3, 0, 1.15, 'shop', 'SW', { type: 'gable', axis: 'x', rise: 0.5 })],
    [tier(-3.35, -2.45, -2.7, -1.3, 0, 2.0, 'town', 'SWE')],
    [tier(-2.35, -1.0, -2.75, -1.3, 0, 1.7, 'corner', 'SE', { type: 'gable', axis: 'z', rise: 0.5 })],
    // ... e atrás: prédio de apartamentos com cobertura, e o edifício de escritórios
    [tier(-4.45, -3.05, -4.55, -3.05, 0, 3.0, 'apts', 'SW'), tier(-4.2, -3.3, -4.3, -3.3, 3.0, 3.45, 'pent', 'SWE')],
    [tier(-2.8, -1.05, -4.6, -3.15, 0, 3.9, 'office', 'SWE'), tier(-2.35, -1.5, -4.3, -3.5, 3.9, 4.2, 'plain', 'SWE')],
    // quadra nordeste: prefeitura com colunas e cúpula, lojas com sobreloja
    [tier(1.0, 2.75, -2.9, -1.5, 0, 1.5, 'hall', 'SWE'), tier(1.52, 2.23, -2.55, -1.85, 1.5, 1.74, 'drum', 'SWE')],
    [tier(2.95, 4.5, -2.5, -1.3, 0, 1.25, 'shops', 'SE'), tier(3.1, 4.35, -2.4, -1.65, 1.25, 1.85, 'loft', 'SWE', { type: 'gable', axis: 'x', rise: 0.4 })],
    // ... e atrás: a torre escalonada (o ponto mais alto) e o hotel
    [tier(1.15, 2.65, -4.55, -3.2, 0, 3.1, 'deco', 'SWE'), tier(1.35, 2.45, -4.35, -3.4, 3.1, 4.2, 'deco', 'SWE'), tier(1.6, 2.2, -4.15, -3.6, 4.2, 4.9, 'deco', 'SWE', { type: 'pyr', rise: 0.45 })],
    [tier(3.0, 4.5, -4.5, -3.05, 0, 2.6, 'hotel', 'SE')],
    // praça: o café e a banca
    [tier(-4.5, -3.3, 2.75, 4.35, 0, 0.95, 'cafe', 'SEN', { type: 'pyr', rise: 0.5 })],
    [tier(-2.6, -2.05, 4.0, 4.5, 0, 0.72, 'kiosk', 'SEN', { type: 'pyr', rise: 0.32 })]
  ];
  var DOME = { x: 1.875, z: -2.2, y: 1.74, r: 0.36 };          // cúpula da prefeitura
  var FOUNT = [-1.7, 2.75], PAD = [-0.4, 0.4, 1.3, 2.1], LOT = [2.3, 3.9, 2.1, 3.7];
  var LAWNS = [[-4.45, -2.8, 0.85, 2.2], [2.0, 4.45, 0.85, 1.75], [-1.9, 1.7, 4.05, 4.5]];
  var CONIFERS = [[-4.1, 1.25, 1.9, 0.46], [-3.4, 1.85, 1.45, 0.38], [4.05, 1.3, 1.65, 0.42], [-1.45, 4.28, 1.25, 0.34]];   // x, z, altura, raio
  var BROADS = [[-3.25, 1.1, 1.35, 5], [3.0, 1.3, 1.3, 8], [-0.9, 4.3, 1.1, 21]];                                           // x, z, tamanho, semente
  var BUSHES = [[-2.95, 0.98, 0.2], [-4.3, 2.02, 0.17], [2.2, 1.55, 0.18], [4.3, 0.98, 0.19], [-1.85, 4.36, 0.15], [-0.3, 4.36, 0.17], [0.9, 4.3, 0.15]];
  var LAMPS = [[-3.7, 0.4, -1], [-2.2, 0.4, -1], [2.2, 0.4, -1], [3.7, 0.4, -1], [-3.0, 2.5, 1], [-0.45, 3.9, -1], [1.95, 2.0, 1]];   // x, z, lado do braço
  var MOVING = [[-0.62, -1, 0.05], [-0.62, -1, 0.56], [-0.08, 1, 0.3], [-0.08, 1, 0.81]];    // carros que passam: z da faixa, sentido, fase
  var PARKED = [[0.33, -2.3, 1], [0.33, -3.6, 1], [-0.33, -4.1, -1]];                        // carros parados na avenida: x, z, sentido
  var TX = 3.1, TZ = 2.9;                                    // centro da torre (no meio do terreno vazio)
  var PARTS = [                                              // peças da torre, na ordem em que são montadas
    { id: 'tBase', half: 0.75, y0: 0, y1: 0.45 },
    { id: 'tShaft', half: 0.5, y0: 0.45, y1: 3.0 },
    { id: 'tBelfry', half: 0.64, y0: 3.0, y1: 3.7 },
    { id: 'tClock', half: 0.5, y0: 2.1, y1: 2.8 },
    { id: 'tRoof', half: 0.72, y0: 3.7, y1: 4.75 }
  ];
  var CLOCK_Y = 2.45;
  // De onde vem o sol (vetor do lugar para o sol): no fim da tarde, do sudoeste; ao amanhecer, do sudeste
  var SUN_W = unit([-0.55, 0.33, 0.77]), SUN_E = unit([0.46, 0.36, 0.81]), KEY = unit([-0.4, 0.8, 0.45]);
  // Os sistemas: caminhos dos pulsos de dados, dos objetos até o "hub", e dali para cima até o servidor
  var HUB = [0, 0.05, 0.8], STORE = [0, 5.5, 0.8], DOOR = [-1.68, 0.05, -1.1], NEWS = [-2.3, 0.05, 3.9];
  var ROUTES = [
    [[0, 0.1, 1.3], HUB],                                                      // do spawn
    [DOOR, [-1.2, 0.05, -1.1], [-1.2, 0.05, 0.8], HUB],                        // da porta da loja, pela faixa de pedestres
    [NEWS, [-0.6, 0.05, 3.9], [-0.6, 0.05, 0.8], HUB],                         // da banca
    [HUB, STORE]                                                               // a subida até o servidor
  ];

  // ---------- O modelo: um lugar para cada ponto ----------
  // kind: tipo do ponto | own: dono (construção 0..10, peça da torre 20..24) | tag: detalhe (janela, porta, zona do chão...)
  var G = 0, R = 1, W = 2, D = 3, P = 4, X = 5, M = 6, Z = 7, F = 8;                      // F: o campo em volta da baseplate
  var TOWER = 20;
  var px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);      // onde o ponto fica no lugar pronto
  var sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N);      // de onde ele nasce
  var nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);      // para onde a face dele olha
  var fvx = new Float32Array(N), fvy = new Float32Array(N), fvz = new Float32Array(N), fph = new Float32Array(N);   // trajeto e fase de quem corre (fase < 0: parado)
  var kind = new Uint8Array(N), own = new Uint8Array(N), tag = new Uint8Array(N), grid = new Uint8Array(N);
  var ua = new Float32Array(N), ub = new Float32Array(N), rnd = new Float32Array(N);     // ua: janela (abaixo de 0.5 = acesa à noite); ub: brilho próprio
  var cnt = 0, owner = 0, seed = null, gs = 0.09, sp = 0.07, OCC = [], BALL = [], SOL = [], TIERS = [];
  function add(k, x, y, z, ax, ay, az, t) {
    var i = cnt++; if (i >= N) return -1;
    px[i] = x; py[i] = y; pz[i] = z; nx[i] = ax; ny[i] = ay; nz[i] = az; kind[i] = k; own[i] = owner; tag[i] = t || 0; ua[i] = 0; ub[i] = 1; grid[i] = 0; fph[i] = -1;
    if (seed) { sx[i] = seed[0]; sy[i] = seed[1]; sz[i] = seed[2]; } else { sx[i] = x; sy[i] = 0; sz[i] = z; }
    return i;
  }
  function flow(i, vx, vy, vz, ph) { if (i >= 0) { fvx[i] = vx; fvy[i] = vy; fvz[i] = vz; fph[i] = ph; } }

  // Zonas do chão
  var Z_PLAIN = 0, Z_EDGE = 1, Z_STREET = 2, Z_MARK = 3, Z_CURB = 4, Z_WALK = 5, Z_WALKLINE = 6, Z_PLAZA = 7, Z_TILE = 8,
    Z_LOT = 10, Z_LOTEDGE = 11, Z_PAD = 12, Z_LAWN = 13, Z_LAWNEDGE = 14, Z_WATER = 15, Z_RING = 16, Z_YARD = 17;
  function zone(x, z, line) {
    var e = gs * 0.5, ax = Math.abs(x), d, q;
    if (ax > 5 - gs || Math.abs(z) > 5 - gs) return Z_EDGE;
    if (z > ST0 && z < ST1) {                                                    // rua principal, com duas faixas de pedestres
      if (ax > 0.9 && ax < 1.5) return frac((z - ST0) / 0.24) < 0.5 ? Z_MARK : Z_STREET;
      return Math.abs(z - (ST0 + ST1) / 2) < e && ax > 1.75 && frac((x + 5) / 0.6) < 0.5 ? Z_MARK : Z_STREET;
    }
    if (Math.abs(z - ST1) < e || (Math.abs(z - ST0) < e && ax > AVW)) return Z_CURB;
    if (z < ST0) {
      if (ax < AVW) {                                                            // avenida, com a faixa de pedestres na esquina
        if (z > -1.62 && z < -1.24) return frac((x + AVW) / 0.22) < 0.5 ? Z_MARK : Z_STREET;
        return ax < e && z < -1.9 && frac((z + 5) / 0.6) < 0.5 ? Z_MARK : Z_STREET;
      }
      if (Math.abs(ax - AVW) < e) return Z_CURB;
      if (z > ST0 - WALK || ax < AVW + WALK) return line ? Z_WALKLINE : Z_WALK;  // calçadas
      return Z_YARD;
    }
    if (z < ST1 + WALK) return line ? Z_WALKLINE : Z_WALK;
    // a praça
    if (x > PAD[0] && x < PAD[1] && z > PAD[2] && z < PAD[3]) return Z_PAD;
    if (x > LOT[0] && x < LOT[1] && z > LOT[2] && z < LOT[3]) {
      var dx = Math.min(x - LOT[0], LOT[1] - x), dz = Math.min(z - LOT[2], LOT[3] - z);
      return Math.min(dx, dz) < gs && frac((dx < dz ? z : x) / 0.32) < 0.55 ? Z_LOTEDGE : Z_LOT;
    }
    d = Math.hypot(x - FOUNT[0], z - FOUNT[1]);
    if (d < 0.64) return Z_WATER;
    if (Math.abs(d - 1.02) < e || Math.abs(d - 1.46) < e) return Z_RING;
    for (q = 0; q < LAWNS.length; q++) {
      var l = LAWNS[q];
      if (x > l[0] && x < l[1] && z > l[2] && z < l[3]) return Math.min(x - l[0], l[1] - x, z - l[2], l[3] - z) < gs ? Z_LAWNEDGE : Z_LAWN;
    }
    return d < 1.46 || line ? Z_TILE : Z_PLAZA;
  }

  // ---------- Fachadas ----------
  // O que cada ponto de parede é: 0 parede, 1 janela, 2 porta, 3 friso claro, 5 vitrine (acesa desde o pôr do sol)
  var winId = 0;
  function cols(u, w, pitch, lo, hi) {                        // coluna de janelas em que u cai (-1: entre duas colunas)
    var n = Math.max(1, Math.round(w / pitch)), c = Math.min(n - 1, Math.floor(u / w * n)), f = u / w * n - c;
    return f > lo && f < hi ? c : -1;
  }
  // janela de uma grade de andares; p = fração das janelas acesas à noite
  function gridWin(sd, face, u, w, y, pitch, y0, fh, n, p, a0, a1, b0, b1) {
    var c = cols(u, w, pitch, a0 === undefined ? 0.24 : a0, a1 === undefined ? 0.76 : a1), fl = Math.floor((y - y0) / fh), f = (y - y0) / fh - fl;
    if (c < 0 || fl < 0 || fl >= n || f < (b0 === undefined ? 0.24 : b0) || f > (b1 === undefined ? 0.76 : b1)) return 0;
    winId = clamp(hash3(sd, face * 7 + c, fl) * 0.5 / p, 0, 1);
    return 1;
  }
  function facade(t, face, u, y, w) {
    var S = face === 0, c, fl, f;
    winId = 1;
    switch (t.style) {
      case 'shop':                                              // padaria: vitrine, porta e friso
        if (S) {
          if (y < 0.8 && u > w - 0.4 && u < w - 0.1) return 2;
          if (y > 0.22 && y < 0.8 && u > 0.1 && u < w - 0.5) return 5;
          return y > 0.9 && y < 1.0 ? 3 : 0;
        }
        return gridWin(11, face, u, w, y, 0.42, 0.3, 0.6, 1, 0.6);
      case 'town':                                              // sobrado: porta, janela do térreo, dois andares
        if (S && y < 0.72 && u > 0.08 && u < 0.34) return 2;
        if (S && y > 0.28 && y < 0.7 && u > 0.5 && u < 0.82) { winId = 0.2; return 1; }
        if (y > 0.8 && y < 0.88) return 3;
        return gridWin(12, face, u, w, y, 0.45, 0.9, 0.55, 2, 0.55);
      case 'corner':                                            // loja da esquina: vitrines nas duas ruas, um andar em cima
        if (y < 0.78) {
          if (S && u > 0.5 && u < 0.85) return 2;
          return y > 0.2 && u > 0.1 && u < w - 0.1 ? 5 : 0;
        }
        if (y > 0.84 && y < 0.93) return 3;
        return gridWin(13, face, u, w, y, 0.45, 0.98, 0.62, 1, 0.6);
      case 'apts':                                              // apartamentos: cinco andares com a laje da sacada marcada
        fl = (y - 0.2) / 0.56; f = fl - Math.floor(fl);
        if (fl > 0 && fl < 5 && f < 0.1) return 3;
        return gridWin(14, face, u, w, y, 0.46, 0.2, 0.56, 5, 0.5, 0.2, 0.8, 0.3, 0.82);
      case 'pent':
        if (y > t.y0 + 0.1 && y < t.y1 - 0.1) { winId = 0.2; return 1; }
        return 0;
      case 'office':                                            // escritórios: faixas de vidro de alto a baixo, acesas por andar
        if (S && y < 0.6 && Math.abs(u - w / 2) < 0.3) return 2;
        if (y > 0.62 && y < 0.72) return 3;
        if (y < 0.8 || y > t.y1 - 0.2) return 0;
        c = cols(u, w, 0.29, 0.2, 0.8); fl = Math.floor((y - 0.8) / 0.44); f = (y - 0.8) / 0.44 - fl;
        if (c < 0 || f < 0.2) return 0;
        winId = clamp(hash3(15, face * 7 + Math.floor(c / 2), fl) * 0.5 / 0.55, 0, 1);
        return 1;
      case 'hall':                                              // prefeitura: porta e janelas altas atrás das colunas
        if (y > 1.3) return 3;
        if (S && y < 0.85 && Math.abs(u - w / 2) < 0.2) return 2;
        c = cols(u, w, 0.44, 0.3, 0.7);
        if (c >= 0 && y > 0.3 && y < 1.08 && !(S && Math.abs(u - w / 2) < 0.3)) { winId = clamp(hash3(16, face * 7 + c, 1) * 0.5 / 0.7, 0, 1); return 1; }
        return 0;
      case 'drum':
        if (cols(u, w, 0.18, 0.25, 0.75) >= 0 && y > t.y0 + 0.06 && y < t.y1 - 0.05) { winId = 0.2; return 1; }
        return 0;
      case 'shops':                                             // três lojas: vitrine e porta em cada vão
        if (y > 0.84 && y < 0.93) return 3;
        if (y > 0.78) return 0;
        if (!S) return y > 0.2 && u > 0.12 && u < w - 0.12 ? 5 : 0;
        f = frac(u / w * 3);
        if (f > 0.68 && f < 0.92) return 2;
        return y > 0.2 && f > 0.08 && f < 0.6 ? 5 : 0;
      case 'loft':
        return gridWin(17, face, u, w, y, 0.42, t.y0 + 0.04, 0.56, 1, 0.6);
      case 'deco':                                              // torre escalonada: pilastras claras e faixas de janelas
        if (y > t.y1 - 0.12) return 3;
        if (t.y0 === 0 && S && y < 0.62 && Math.abs(u - w / 2) < 0.24) return 2;
        if (y < t.y0 + (t.y0 === 0 ? 0.7 : 0.14)) return 0;
        c = Math.max(1, Math.round(w / 0.3)); f = frac(u / w * c);
        if (f < 0.13 || f > 0.87) return 3;
        if (f < 0.26 || f > 0.74) return 0;
        winId = clamp(hash3(18, face * 7 + Math.floor(u / w * c), Math.floor(y / 0.46)) * 0.5 / 0.5, 0, 1);
        return frac(y / 0.46) < 0.16 ? 0 : 1;
      case 'hotel':                                             // hotel: térreo envidraçado e quatro andares
        if (y < 0.5) return S && u > 0.15 && u < w - 0.15 && y > 0.14 ? 5 : 0;
        if (y < 0.58) return 3;
        return gridWin(19, face, u, w, y, 0.38, 0.56, 0.5, 4, 0.6);
      case 'cafe':                                              // café: vidro em volta
        if (S && y < 0.72 && Math.abs(u - w / 2) < 0.17) return 2;
        return y > 0.18 && y < 0.7 && u > 0.1 && u < w - 0.1 ? 5 : 0;
      case 'kiosk':
        return face < 2 && y > 0.32 && y < 0.56 && u > 0.08 && u < w - 0.08 ? 5 : 0;
      case 'tShaft':
        if (Math.abs(u - w / 2) < 0.09 && y > 0.85 && y < 1.75) { winId = clamp(hash3(6, face, 1), 0, 1); return 1; }
        return 0;
      case 'tBelfry':
        if (Math.abs(u - w / 2) < 0.32 && y > t.y0 + 0.14 && y < t.y1 - 0.14) { winId = 0.15; return 1; }
        return 0;
    }
    return 0;
  }

  // ---------- Peças do modelo ----------
  // Uma parede: malha regular de pontos numa face do volume (0 sul, 1 leste, 2 oeste, 3 norte)
  function wall(b, face) {
    var w = face === 0 || face === 3 ? b.x1 - b.x0 : b.z1 - b.z0, h = b.y1 - b.y0;
    var nu = Math.max(2, Math.round(w / sp)), nv = Math.max(2, Math.round(h / sp));
    for (var j = 0; j < nv; j++) for (var i = 0; i < nu; i++) {
      var u = (i + 0.5) / nu * w, y = b.y0 + (j + 0.5) / nv * h, x, z, ax = 0, az = 0;
      if (face === 0) { x = b.x0 + u; z = b.z1; az = 1; } else if (face === 3) { x = b.x1 - u; z = b.z0; az = -1; }
      else if (face === 1) { x = b.x1; z = b.z1 - u; ax = 1; } else { x = b.x0; z = b.z0 + u; ax = -1; }
      var k = add(W, x, y, z, ax, 0, az, facade(b, face, u, y, w));
      if (k >= 0) { ua[k] = winId; ub[k] = 1 / nv; }
    }
  }
  // Uma linha de pontos de a até b (ub: numa linha de pé, que na planta fica empilhada num ponto só, o brilho é dividido)
  function line(k, a, b, st, t, n) {
    var len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), m = Math.max(2, Math.round(len / st)), up = a[0] === b[0] && a[2] === b[2];
    n = n || [0, 1, 0];
    for (var i = 0; i < m; i++) { var f = (i + 0.5) / m, q = add(k, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, n[0], n[1], n[2], t); if (q >= 0) ub[q] = up ? 1 / m : 1; }
  }
  // As arestas de cima e de pé de uma caixa (as de baixo ficam por conta do pé das paredes)
  function edges(b, st, k, t) {
    var xs = [b.x0, b.x1], zs = [b.z0, b.z1], i, j;
    for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) line(k, [xs[i], b.y0, zs[j]], [xs[i], b.y1, zs[j]], st, t);
    for (i = 0; i < 2; i++) { line(k, [b.x0, b.y1, zs[i]], [b.x1, b.y1, zs[i]], st, t); line(k, [xs[i], b.y1, b.z0], [xs[i], b.y1, b.z1], st, t); }
  }
  // Um retângulo de linhas na altura y (guarda-corpo, beiral)
  function loop(k, x0, x1, z0, z1, y, st, t) {
    line(k, [x0, y, z0], [x1, y, z0], st, t); line(k, [x0, y, z1], [x1, y, z1], st, t); line(k, [x0, y, z0], [x0, y, z1], st, t); line(k, [x1, y, z0], [x1, y, z1], st, t);
  }
  // Um círculo de pontos
  function ring(k, cx, y, cz, r, st, t) {
    for (var i = 0, m = Math.max(6, Math.round(2 * PI * r / st)); i < m; i++) { var a = i / m * 2 * PI; add(k, cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, Math.cos(a), 0.3, Math.sin(a), t); }
  }
  // Malha num retângulo qualquer: origem o, lados U e V
  function quad(k, o, U, V, st, n, t, each) {
    var nu = Math.max(2, Math.round(Math.hypot(U[0], U[1], U[2]) / st)), nv = Math.max(2, Math.round(Math.hypot(V[0], V[1], V[2]) / st));
    for (var j = 0; j < nv; j++) for (var i = 0; i < nu; i++) {
      var a = (i + 0.5) / nu, c = (j + 0.5) / nv;
      var q = add(k, o[0] + U[0] * a + V[0] * c, o[1] + U[1] * a + V[1] * c, o[2] + U[2] * a + V[2] * c, n[0], n[1], n[2], t);
      if (q >= 0 && each) each(q, a, c, i, j);
    }
  }

  // Detalhes dos objetos (tag dos pontos do tipo P)
  var T_CROWN = 10, T_TRUNK = 11, T_POST = 12, T_HEAD = 13, T_AWN = 14, T_AWN2 = 15, T_SIGN = 16, T_BODY = 17, T_TRIM = 18, T_PAD = 19, T_RING = 20, T_TIP = 21,
    T_CLOCK = 22, T_NEEDLE = 23, T_CAR = 24, T_CARF = 25, T_CARR = 26, T_SIGNAL = 27;
  // Pulsos: fio parado, pacote que corre, anel de um nó ou o cubo do servidor
  var T_WIRE = 30, T_PACK = 31, T_NODE = 32;
  // Efeitos (tipo M): 0 brilhos do spawn, 1 poeira no cone dos postes, 2 fumaça de chaminé, 3 água da fonte

  // Uma caixa pequena de objeto (caixa da escada, chaminé, banco...): faces visíveis e arestas
  function crate(b, st, t) {
    quad(P, [b.x0, b.y1, b.z0], [b.x1 - b.x0, 0, 0], [0, 0, b.z1 - b.z0], st, [0, 1, 0], t);
    quad(P, [b.x0, b.y0, b.z1], [b.x1 - b.x0, 0, 0], [0, b.y1 - b.y0, 0], st, [0, 0, 1], t);
    quad(P, [b.x1, b.y0, b.z1], [0, 0, b.z0 - b.z1], [0, b.y1 - b.y0, 0], st, [1, 0, 0], t);
    quad(P, [b.x0, b.y0, b.z0], [0, 0, b.z1 - b.z0], [0, b.y1 - b.y0, 0], st, [-1, 0, 0], t);
    edges(b, st * 0.6, P, T_TRIM);
  }
  // Toldo listrado: sai da parede (o = canto de cima, U ao longo da parede, V para fora e para baixo) e nasce dobrado nela
  function awning(o, U, V) {
    quad(P, o, U, V, sp * 0.9, unit([V[0], 0.9, V[2]]), T_AWN, function (q, a, c, i) { sx[q] = px[q] - V[0] * c; sy[q] = o[1]; sz[q] = pz[q] - V[2] * c; if (i % 4 > 1) tag[q] = T_AWN2; });
  }
  // Letreiro: uma placa de pontos rente à parede
  function sign(o, U, V, n) {
    quad(P, o, U, V, sp * 0.75, n, T_SIGN, function (q) { sx[q] = px[q] - n[0] * 0.03; sy[q] = py[q]; sz[q] = pz[q] - n[2] * 0.03; });
  }
  // Sacada: a laje e o guarda-corpo ao longo de uma parede, de a = [x, z] até b, saindo para o lado n = [nx, nz]
  function balcony(a, b, n, y) {
    var o = 0.11;
    seed = [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2];
    line(P, [a[0] + n[0] * o, y, a[1] + n[1] * o], [b[0] + n[0] * o, y, b[1] + n[1] * o], sp * 0.6, T_TRIM);
    line(P, [a[0] + n[0] * o, y + 0.13, a[1] + n[1] * o], [b[0] + n[0] * o, y + 0.13, b[1] + n[1] * o], sp * 0.75, T_BODY);
  }
  // Altura do telhado de um volume no ponto (x, z); deixa em rn para onde aquela água olha
  var rn = [0, 1, 0];
  function roofAt(t, x, z) {
    var r = t.roof, xc = (t.x0 + t.x1) / 2, zc = (t.z0 + t.z1) / 2, hw = (t.x1 - t.x0) / 2, hd = (t.z1 - t.z0) / 2, dx = (x - xc) / hw, dz = (z - zc) / hd, s;
    rn[0] = 0; rn[1] = 1; rn[2] = 0;
    if (!r) return t.y1;
    if ((r.type === 'gable' && r.axis === 'x') || (r.type === 'pyr' && Math.abs(dz) >= Math.abs(dx))) {
      s = Math.hypot(hd, r.rise); rn[1] = hd / s; rn[2] = (dz < 0 ? -1 : 1) * r.rise / s;
      return t.y1 + r.rise * (1 - Math.abs(dz));
    }
    s = Math.hypot(hw, r.rise); rn[1] = hw / s; rn[0] = (dx < 0 ? -1 : 1) * r.rise / s;
    return t.y1 + r.rise * (1 - Math.abs(dx));
  }
  // Empenas (os triângulos das pontas), cumeeira e quinas de um telhado
  function roofTrim(t) {
    var r = t.roof, xc = (t.x0 + t.x1) / 2, zc = (t.z0 + t.z1) / 2, top = t.y1 + r.rise, st = sp * 0.65, i, j;
    if (r.type === 'pyr') {
      for (i = 0; i < 4; i++) line(D, [i < 2 ? t.x0 : t.x1, t.y1, i % 2 ? t.z1 : t.z0], [xc, top, zc], st, 0);
      return;
    }
    var axX = r.axis === 'x', half = axX ? (t.z1 - t.z0) / 2 : (t.x1 - t.x0) / 2, nv = Math.max(2, Math.round(r.rise / sp));
    var ends = axX ? [[t.x0, -1, 'W'], [t.x1, 1, 'E']] : [[t.z1, 1, 'S'], [t.z0, -1, 'N']];
    ends.forEach(function (e) {
      var a = axX ? [e[0], top, zc] : [xc, top, e[0]];
      line(D, axX ? [e[0], t.y1, t.z0] : [t.x0, t.y1, e[0]], a, st, 0); line(D, axX ? [e[0], t.y1, t.z1] : [t.x1, t.y1, e[0]], a, st, 0);
      if (t.faces.indexOf(e[2]) < 0) return;
      for (j = 0; j < nv; j++) {
        var v = (j + 0.5) / nv, hw = half * (1 - v), nu = Math.max(1, Math.round(2 * hw / sp));
        for (i = 0; i < nu; i++) {
          var s = ((i + 0.5) / nu * 2 - 1) * hw, q = axX ? add(W, e[0], t.y1 + v * r.rise, zc + s, e[1], 0, 0, 0) : add(W, xc + s, t.y1 + v * r.rise, e[0], 0, 0, e[1], 0);
          if (q >= 0) ub[q] = 0;
        }
      }
    });
    line(D, axX ? [t.x0, top, zc] : [xc, top, t.z0], axX ? [t.x1, top, zc] : [xc, top, t.z1], st, 0);
  }

  // Pinheiro: três saias em cone, cada uma saindo de dentro da de cima
  function conifer(x, z, H, R) {
    seed = [x, 0, z];
    line(P, [x, 0, z], [x, H * 0.2, z], sp * 0.5, T_TRUNK);
    for (var c = 0; c < 3; c++) {
      var r0 = R * (1 - c * 0.25), yb = H * (0.15 + c * 0.25), ya = c === 2 ? H : yb + H * 0.42, sl = Math.hypot(r0, ya - yb), v0 = c === 2 ? 0 : 0.42;
      for (var k = 0, n = Math.round(PI * r0 * sl * (1 - v0 * v0) / (sp * sp) * 1.6); k < n; k++) {
        var v = Math.sqrt(v0 * v0 + (1 - v0 * v0) * (k + 0.5) / n), th = k * 2.39996 + c, rr = r0 * v;      // v: 0 no bico, 1 na barra da saia
        var q = add(P, x + Math.cos(th) * rr, ya - (ya - yb) * v, z + Math.sin(th) * rr, Math.cos(th) * (ya - yb) / sl, r0 / sl, Math.sin(th) * (ya - yb) / sl, T_NEEDLE);
        if (q >= 0) ub[q] = 0.55 + 0.45 * v;                                                               // a barra de cada saia é mais clara
      }
    }
    SOL.push({ id: 'c' + SOL.length, shape: 'pyramid', kind: 1, box: [x - R * 0.6, x + R * 0.6, H * 0.15, H * 0.98, z - R * 0.6, z + R * 0.6], at: [x, z] });
    BALL.push([x, H * 0.45, z, R * 0.62]); BALL.push([x, H * 0.72, z, R * 0.36]);
  }
  // Árvore de copa: tronco, dois galhos e uma copa irregular, feita de vários tufos que se fundem
  function broadleaf(x, z, s, sd) {
    var rr = E.rng(sd), blobs = [[x, s * 0.8, z, s * 0.3]], k;
    for (k = 0; k < 4; k++) { var a = k * PI / 2 + rr() * 1.1, d = s * (0.2 + rr() * 0.1); blobs.push([x + Math.cos(a) * d, s * (0.58 + rr() * 0.2), z + Math.sin(a) * d, s * (0.19 + rr() * 0.08)]); }
    seed = [x, 0, z];
    line(P, [x, 0, z], [x, s * 0.52, z], sp * 0.5, T_TRUNK);
    line(P, [x, s * 0.36, z], [blobs[1][0], blobs[1][1] - blobs[1][3] * 0.5, blobs[1][2]], sp * 0.6, T_TRUNK);
    line(P, [x, s * 0.42, z], [blobs[3][0], blobs[3][1] - blobs[3][3] * 0.5, blobs[3][2]], sp * 0.6, T_TRUNK);
    blobs.forEach(function (b, bi) {
      for (var q = 0, m = Math.round(4 * PI * b[3] * b[3] / (sp * sp) * 1.7); q < m; q++) {
        var yy = 1 - (q + 0.5) / m * 2, r1 = Math.sqrt(1 - yy * yy), th = q * 2.39996, ax = Math.cos(th) * r1, az = Math.sin(th) * r1, inside = false;
        var X0 = b[0] + ax * b[3], Y0 = b[1] + yy * b[3], Z0 = b[2] + az * b[3];
        for (var o = 0; o < blobs.length; o++) if (o !== bi && Math.hypot(X0 - blobs[o][0], Y0 - blobs[o][1], Z0 - blobs[o][2]) < blobs[o][3] * 0.97) inside = true;
        if (!inside) add(P, X0, Y0, Z0, ax, yy, az, T_CROWN);                                              // só o lado de fora de cada tufo
      }
      var c = b[3] * 0.94;
      SOL.push({ id: 'l' + SOL.length, shape: 'sphere', kind: 1, box: [b[0] - c, b[0] + c, b[1] - c, b[1] + c, b[2] - c, b[2] + c], at: [x, z] });
      BALL.push([b[0], b[1], b[2], b[3] * 0.9]);
    });
  }
  // Arbusto: meia esfera baixa
  function bush(x, z, r) {
    seed = [x, 0, z];
    for (var q = 0, m = Math.round(2 * PI * r * r / (sp * sp) * 1.3); q < m; q++) {
      var yy = (q + 0.5) / m, r1 = Math.sqrt(1 - yy * yy), th = q * 2.39996;
      add(P, x + Math.cos(th) * r1 * r, yy * r * 0.85, z + Math.sin(th) * r1 * r, Math.cos(th) * r1, yy, Math.sin(th) * r1, T_CROWN);
    }
  }
  // Poste de luz: haste, braço e a lâmpada (o braço aponta para o lado side, em z)
  function lamp(x, z, side, r) {
    seed = [x, 0, z];
    line(P, [x, 0, z], [x, 1.05, z], sp * 0.45, T_POST);
    line(P, [x, 1.05, z], [x, 1.05, z + side * 0.22], sp * 0.45, T_POST);
    for (var k = 0, n = Math.round(14 * KQ); k < n; k++) add(P, x + (r() - 0.5) * 0.07, 1.0 + (r() - 0.5) * 0.05, z + side * 0.22 + (r() - 0.5) * 0.07, 0, -1, 0, T_HEAD);
    OCC.push([x - 0.03, x + 0.03, 0, 1.05, z - 0.03, z + 0.03, 0]);
  }
  // Carro: carroceria, cabine, rodas, faróis e lanternas. along = 0: anda em x; 1: em z. ph >= 0: passa pela rua, em laço
  function car(x, z, along, dir, ph) {
    var first = cnt, L = 0.5, Wd = 0.22, st = sp * 0.62, i, j, w;
    function at(a, y, b, t) { return along ? add(P, x + b, y, z + a * dir, 0, 1, 0, t) : add(P, x + a * dir, y, z + b, 0, 1, 0, t); }
    function bar(a0, y0, b0, a1, y1, b1, t) { for (var q = 0, m = Math.max(2, Math.round(Math.hypot(a1 - a0, y1 - y0, b1 - b0) / st)); q < m; q++) { var f = (q + 0.5) / m; at(a0 + (a1 - a0) * f, y0 + (y1 - y0) * f, b0 + (b1 - b0) * f, t); } }
    seed = [x, 0, z];
    for (j = -1; j <= 1; j += 2) {                                               // os dois lados
      bar(-L / 2, 0.09, j * Wd / 2, L / 2, 0.09, j * Wd / 2, T_CAR); bar(-L / 2, 0.19, j * Wd / 2, L / 2, 0.19, j * Wd / 2, T_CAR);
      bar(-0.14, 0.3, j * Wd * 0.42, 0.08, 0.3, j * Wd * 0.42, T_CAR); bar(-0.19, 0.19, j * Wd / 2, -0.14, 0.3, j * Wd * 0.42, T_CAR); bar(0.16, 0.19, j * Wd / 2, 0.08, 0.3, j * Wd * 0.42, T_CAR);
      for (i = -1; i <= 1; i += 2) for (w = 0; w < 3; w++) at(i * 0.16 + (w - 1) * 0.03, 0.05 + (w === 1 ? 0.025 : 0), j * Wd / 2, T_TRUNK);   // rodas
      for (i = 0; i < Math.round(3 * KQ); i++) { at(L / 2, 0.15, j * Wd * 0.34 + (i - 1) * 0.012, T_CARF); at(-L / 2, 0.15, j * Wd * 0.34 + (i - 1) * 0.012, T_CARR); }
    }
    bar(-L / 2, 0.19, -Wd / 2, -L / 2, 0.19, Wd / 2, T_CAR); bar(L / 2, 0.19, -Wd / 2, L / 2, 0.19, Wd / 2, T_CAR);
    bar(-0.14, 0.3, -Wd * 0.42, -0.14, 0.3, Wd * 0.42, T_CAR); bar(0.08, 0.3, -Wd * 0.42, 0.08, 0.3, Wd * 0.42, T_CAR);
    for (i = -2; i <= 2; i++) for (j = -1; j <= 1; j++) at(i * L / 5.2, 0.195, j * Wd * 0.3, T_BODY);       // capô, teto e porta-malas
    if (ph >= 0) for (i = first; i < cnt && i < N; i++) flow(i, along ? 0 : dir * 9.6, 0, along ? dir * 9.6 : 0, 1 + ph);
  }

  // ---------- Montagem ----------
  function build(step) {
    var r = E.rng(11), i, j, b, q, a, x, z;
    cnt = 0; OCC = []; BALL = []; SOL = []; TIERS = []; seed = null; sp = step;
    var ng = Math.round(10 / (step * 1.3)); gs = 10 / ng;

    BUILD.forEach(function (tiers, bi) { tiers.forEach(function (t) { t.own = bi; TIERS.push(t); }); });
    TIERS.forEach(function (t, ti) {
      OCC.push([t.x0, t.x1, t.y0, t.y1, t.z0, t.z1, 0]);
      SOL.push({ id: 'b' + ti, kind: 0, own: t.own, box: [t.x0, t.x1, t.y0, t.y1, t.z0, t.z1] });
      if (t.roof) {
        var g = t.roof.type === 'gable', hx = (t.x1 - t.x0) / 4, hz = (t.z1 - t.z0) / 4;
        SOL.push({ id: 'r' + ti, kind: 0, own: t.own, shape: g ? (t.roof.axis === 'x' ? 'gableX' : 'gableZ') : 'pyramid', box: [t.x0, t.x1, t.y1, t.y1 + t.roof.rise, t.z0, t.z1] });
        OCC.push(g && t.roof.axis === 'x' ? [t.x0, t.x1, t.y1, t.y1 + t.roof.rise * 0.55, t.z0 + hz, t.z1 - hz, 0] : g ? [t.x0 + hx, t.x1 - hx, t.y1, t.y1 + t.roof.rise * 0.55, t.z0, t.z1, 0] : [t.x0 + hx, t.x1 - hx, t.y1, t.y1 + t.roof.rise * 0.55, t.z0 + hz, t.z1 - hz, 0]);
      }
    });

    // chão: a malha da baseplate; o que cai dentro de uma construção sobe com ela e vira o teto (ou o telhado)
    for (j = 0; j < ng; j++) for (i = 0; i < ng; i++) {
      x = -5 + (i + 0.5) * gs; z = -5 + (j + 0.5) * gs;
      var top = null, onLine = frac((x + 5) / 0.5) < gs / 0.5 || frac((z + 5) / 0.5) < gs / 0.5;
      owner = 0;
      for (q = 0; q < TIERS.length; q++) { b = TIERS[q]; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) { top = b; owner = b.own; } }
      if (top) a = add(R, x, roofAt(top, x, z), z, rn[0], rn[1], rn[2], 0);
      else a = add(G, x, 0, z, 0, 1, 0, zone(x, z, onLine));
      if (a >= 0) grid[a] = (i === 0 || j === 0 || i === ng - 1 || j === ng - 1) ? 2 : onLine ? 1 : 0;
    }
    // em volta da baseplate, a mesma malha continua mais rala e some no escuro: o lugar não flutua no vazio
    owner = 0;
    for (j = -Math.ceil(8.6 / (gs * 3)); j * gs * 3 < 8.6; j++) for (i = -Math.ceil(8.6 / (gs * 3)); i * gs * 3 < 8.6; i++) {
      var fx0 = (i + 0.5) * gs * 3, fz0 = (j + 0.5) * gs * 3, fd = Math.hypot(Math.max(Math.abs(fx0) - 5, 0), Math.max(Math.abs(fz0) - 5, 0));
      if ((Math.abs(fx0) < 5 + gs && Math.abs(fz0) < 5 + gs) || fd > 3.5) continue;
      a = add(F, fx0, 0, fz0, 0, 1, 0, 0); if (a >= 0) ub[a] = (1 - fd / 3.5) * (1 - fd / 3.5);
    }

    // paredes, arestas e telhados
    TIERS.forEach(function (t) {
      owner = t.own;
      if (t.faces.indexOf('S') >= 0) wall(t, 0);
      if (t.faces.indexOf('E') >= 0) wall(t, 1);
      if (t.faces.indexOf('W') >= 0) wall(t, 2);
      if (t.faces.indexOf('N') >= 0) wall(t, 3);
      edges(t, step * 0.7, D, 0);
      if (t.roof) roofTrim(t);
    });
    // a cúpula da prefeitura sobe junto com ela
    owner = 5;
    for (q = 0, j = Math.round(2 * PI * DOME.r * DOME.r / (step * step) * 1.2); q < j; q++) {
      var dy = (q + 0.5) / j, dr = Math.sqrt(1 - dy * dy), dth = q * 2.39996;
      a = add(W, DOME.x + Math.cos(dth) * dr * DOME.r, DOME.y + dy * DOME.r, DOME.z + Math.sin(dth) * dr * DOME.r, Math.cos(dth) * dr, dy, Math.sin(dth) * dr, 0);
      if (a >= 0) ub[a] = 0;
    }
    ring(D, DOME.x, DOME.y + 0.01, DOME.z, DOME.r, step * 0.6, 0);
    SOL.push({ id: 'dome', kind: 0, own: 5, shape: 'sphere', box: [DOME.x - DOME.r, DOME.x + DOME.r, DOME.y - DOME.r, DOME.y + DOME.r, DOME.z - DOME.r, DOME.z + DOME.r] });
    BALL.push([DOME.x, DOME.y, DOME.z, DOME.r]);

    // --- detalhe das construções (nasce da parede ou do teto onde fica preso) ---
    owner = 40;
    var bk = BUILD[0][0], hs = BUILD[1][0], cn = BUILD[2][0], ap = BUILD[3][0], pe = BUILD[3][1], of = BUILD[4][0], hl = BUILD[5][0], sh = BUILD[6][0], lf = BUILD[6][1], dc = BUILD[7], ht = BUILD[8][0], ks = BUILD[10][0];
    // padaria: toldo, letreiro e chaminé
    awning([bk.x0 + 0.06, 0.86, bk.z1], [bk.x1 - bk.x0 - 0.5, 0, 0], [0, -0.16, 0.36]);
    sign([bk.x0 + 0.2, 0.93, bk.z1 + 0.03], [0.5, 0, 0], [0, 0.17, 0], [0, 0, 1]);
    seed = [-4.2, 1.3, -2.1]; crate({ x0: -4.3, x1: -4.1, y0: 1.3, y1: 1.78, z0: -2.2, z1: -2.0 }, step, T_BODY);
    // sobrado: sacada, guarda-corpo no terraço e a caixa da escada
    balcony([hs.x0 + 0.12, hs.z1], [hs.x1 - 0.12, hs.z1], [0, 1], 1.42);
    seed = [(hs.x0 + hs.x1) / 2, hs.y1, (hs.z0 + hs.z1) / 2];
    loop(P, hs.x0 + 0.03, hs.x1 - 0.03, hs.z0 + 0.03, hs.z1 - 0.03, hs.y1 + 0.12, step * 0.75, T_BODY);
    crate({ x0: -3.25, x1: -2.9, y0: 2.0, y1: 2.32, z0: -2.6, z1: -2.2 }, step, T_BODY);
    // loja da esquina: toldos nas duas ruas e a placa no alto da empena
    awning([cn.x0 + 0.06, 0.82, cn.z1], [0.4, 0, 0], [0, -0.16, 0.36]); awning([cn.x0 + 0.92, 0.82, cn.z1], [cn.x1 - cn.x0 - 0.98, 0, 0], [0, -0.16, 0.36]);
    awning([cn.x1, 0.82, cn.z1 - 0.08], [0, 0, -(cn.z1 - cn.z0 - 0.3)], [0.36, -0.16, 0]);
    sign([cn.x0 + 0.42, 1.76, cn.z1 + 0.03], [cn.x1 - cn.x0 - 0.84, 0, 0], [0, 0.14, 0], [0, 0, 1]);
    // apartamentos: sacadas em quatro andares (sul e oeste), caixa d'água na cobertura, aparelho no teto
    for (i = 1; i < 5; i++) {
      balcony([ap.x0 + 0.1, ap.z1], [ap.x1 - 0.1, ap.z1], [0, 1], 0.2 + i * 0.56);
      balcony([ap.x0, ap.z0 + 0.1], [ap.x0, ap.z1 - 0.1], [-1, 0], 0.2 + i * 0.56);
    }
    seed = [-3.75, pe.y1, -3.8];
    ring(P, -3.75, pe.y1 + 0.14, -3.8, 0.19, step * 0.5, T_BODY); ring(P, -3.75, pe.y1 + 0.42, -3.8, 0.19, step * 0.5, T_TRIM);
    for (i = 0; i < 6; i++) {
      x = -3.75 + Math.cos(i * PI / 3) * 0.19; z = -3.8 + Math.sin(i * PI / 3) * 0.19;
      line(P, [x, pe.y1 + 0.02, z], [x, pe.y1 + 0.42, z], step * 0.6, T_BODY); line(P, [x, pe.y1 + 0.42, z], [-3.75, pe.y1 + 0.56, -3.8], step * 0.7, T_BODY);
    }
    seed = [-4.3, ap.y1, -3.3]; crate({ x0: -4.38, x1: -4.26, y0: ap.y1, y1: ap.y1 + 0.16, z0: -3.5, z1: -3.2 }, step, T_BODY);
    // escritórios: guarda-corpo e antena com luz
    seed = [(of.x0 + of.x1) / 2, of.y1, (of.z0 + of.z1) / 2];
    loop(P, of.x0 + 0.03, of.x1 - 0.03, of.z0 + 0.03, of.z1 - 0.03, of.y1 + 0.1, step * 0.8, T_BODY);
    seed = [-1.95, 4.2, -3.9];
    line(P, [-1.95, 4.2, -3.9], [-1.95, 5.1, -3.9], step * 0.5, T_POST); line(P, [-2.07, 4.75, -3.9], [-1.83, 4.75, -3.9], step * 0.6, T_POST);
    for (i = 0; i < Math.round(8 * KQ); i++) add(P, -1.95 + (r() - 0.5) * 0.05, 5.12 + (r() - 0.5) * 0.05, -3.9 + (r() - 0.5) * 0.05, 0, 1, 0, T_TIP);
    // prefeitura: degraus, cinco colunas, a viga e o frontão; lanterna, mastro e bandeira na cúpula
    var pz0 = hl.z1 + 0.2, pyT = 1.3, pxc = (hl.x0 + hl.x1) / 2, phw = (hl.x1 - hl.x0) / 2, prise = 0.42;
    seed = [pxc, 0, pz0];
    for (i = 0; i < 3; i++) line(P, [hl.x0 + 0.02, 0.04 + i * 0.04, pz0 + 0.14 - i * 0.05], [hl.x1 - 0.02, 0.04 + i * 0.04, pz0 + 0.14 - i * 0.05], step * 0.7, T_TRIM);
    for (i = 0; i < 5; i++) {
      x = hl.x0 + 0.1 + i * (hl.x1 - hl.x0 - 0.2) / 4; seed = [x, 0, pz0];
      line(P, [x, 0.13, pz0], [x, pyT, pz0], step * 0.34, T_TRIM, [0, 0, 1]); line(P, [x - 0.05, pyT, pz0], [x + 0.05, pyT, pz0], step * 0.4, T_TRIM); line(P, [x - 0.05, 0.14, pz0], [x + 0.05, 0.14, pz0], step * 0.4, T_TRIM);
      OCC.push([x - 0.03, x + 0.03, 0.1, pyT, pz0 - 0.03, pz0 + 0.03, 0]);
    }
    seed = [pxc, pyT, hl.z1];
    line(P, [hl.x0, pyT + 0.05, pz0], [hl.x1, pyT + 0.05, pz0], step * 0.5, T_TRIM); line(P, [hl.x0, pyT + 0.14, pz0], [hl.x1, pyT + 0.14, pz0], step * 0.5, T_TRIM);
    quad(P, [hl.x0, pyT + 0.14, hl.z1], [hl.x1 - hl.x0, 0, 0], [0, 0, pz0 - hl.z1], step, [0, 1, 0], T_BODY);
    for (j = 0, a = Math.max(2, Math.round(prise / step)); j < a; j++) {
      var pv = (j + 0.5) / a, pw = phw * (1 - pv);
      for (i = 0, q = Math.max(1, Math.round(2 * pw / step)); i < q; i++) add(P, pxc + ((i + 0.5) / q * 2 - 1) * pw, pyT + 0.14 + pv * prise, pz0, 0, 0, 1, T_BODY);
    }
    line(P, [hl.x0, pyT + 0.14, pz0], [pxc, pyT + 0.14 + prise, pz0], step * 0.5, T_TRIM); line(P, [hl.x1, pyT + 0.14, pz0], [pxc, pyT + 0.14 + prise, pz0], step * 0.5, T_TRIM);
    seed = [DOME.x, DOME.y + DOME.r, DOME.z];
    ring(P, DOME.x, DOME.y + DOME.r + 0.03, DOME.z, 0.07, step * 0.4, T_TRIM); line(P, [DOME.x, DOME.y + DOME.r, DOME.z], [DOME.x, DOME.y + DOME.r + 0.5, DOME.z], step * 0.45, T_POST);
    quad(P, [DOME.x, DOME.y + DOME.r + 0.34, DOME.z], [0.24, 0, 0], [0, 0.14, 0], step * 0.7, [0, 0, 1], T_AWN);
    // lojas: um toldo e um letreiro em cada vão, um aparelho no teto, chaminé na sobreloja
    for (i = 0; i < 3; i++) {
      x = sh.x0 + (i + 0.06) * (sh.x1 - sh.x0) / 3;
      awning([x, 0.82, sh.z1], [(sh.x1 - sh.x0) / 3 * 0.6, 0, 0], [0, -0.15, 0.34]);
      sign([x + 0.04, 0.96, sh.z1 + 0.03], [(sh.x1 - sh.x0) / 3 * 0.5, 0, 0], [0, 0.15, 0], [0, 0, 1]);
    }
    seed = [3.02, sh.y1, -1.5]; crate({ x0: 2.99, x1: 3.07, y0: sh.y1, y1: sh.y1 + 0.14, z0: -1.6, z1: -1.38 }, step, T_BODY);
    seed = [4.1, lf.y1 + 0.3, -2.12]; crate({ x0: 4.02, x1: 4.18, y0: lf.y1 + 0.2, y1: lf.y1 + 0.65, z0: -2.2, z1: -2.04 }, step, T_BODY);
    // torre escalonada: guarda-corpos nos recuos e o pináculo com luz
    for (i = 0; i < 2; i++) { seed = [(dc[i].x0 + dc[i].x1) / 2, dc[i].y1, (dc[i].z0 + dc[i].z1) / 2]; loop(P, dc[i].x0 + 0.03, dc[i].x1 - 0.03, dc[i].z0 + 0.03, dc[i].z1 - 0.03, dc[i].y1 + 0.1, step * 0.8, T_BODY); }
    seed = [1.9, dc[2].y1 + 0.45, -3.875];
    line(P, [1.9, dc[2].y1 + 0.45, -3.875], [1.9, dc[2].y1 + 1.1, -3.875], step * 0.45, T_POST);
    for (i = 0; i < Math.round(8 * KQ); i++) add(P, 1.9 + (r() - 0.5) * 0.05, dc[2].y1 + 1.12 + (r() - 0.5) * 0.05, -3.875 + (r() - 0.5) * 0.05, 0, 1, 0, T_TIP);
    // hotel: marquise na entrada, o letreiro no alto sobre dois pés e a casa de máquinas
    awning([ht.x0 + 0.3, 0.56, ht.z1], [ht.x1 - ht.x0 - 0.6, 0, 0], [0, -0.04, 0.3]);
    seed = [3.75, ht.y1, ht.z1 - 0.12];
    line(P, [3.3, ht.y1, ht.z1 - 0.12], [3.3, ht.y1 + 0.2, ht.z1 - 0.12], step * 0.5, T_POST); line(P, [4.2, ht.y1, ht.z1 - 0.12], [4.2, ht.y1 + 0.2, ht.z1 - 0.12], step * 0.5, T_POST);
    quad(P, [3.2, ht.y1 + 0.2, ht.z1 - 0.12], [1.1, 0, 0], [0, 0.3, 0], step * 0.7, [0, 0, 1], T_SIGN);
    seed = [3.3, ht.y1, -4.0]; crate({ x0: 3.15, x1: 3.5, y0: ht.y1, y1: ht.y1 + 0.26, z0: -4.2, z1: -3.8 }, step, T_BODY);
    // banca: o beiral
    seed = [(ks.x0 + ks.x1) / 2, ks.y1, (ks.z0 + ks.z1) / 2];
    loop(P, ks.x0 - 0.1, ks.x1 + 0.1, ks.z0 - 0.1, ks.z1 + 0.1, ks.y1 + 0.01, step * 0.6, T_TRIM);

    // --- a rua e a praça ---
    owner = 41;
    LAMPS.forEach(function (l) { lamp(l[0], l[1], l[2], r); });
    [[-0.72, -1.1], [0.72, 0.42]].forEach(function (d) {                         // semáforos
      seed = [d[0], 0, d[1]];
      line(P, [d[0], 0, d[1]], [d[0], 0.78, d[1]], step * 0.45, T_POST);
      for (i = 0; i < 3; i++) for (j = 0; j < Math.round(3 * KQ); j++) add(P, d[0] + (r() - 0.5) * 0.03, 0.84 + i * 0.07 + (r() - 0.5) * 0.02, d[1] + (r() - 0.5) * 0.03, 0, 0, 1, i === 1 ? T_SIGNAL : T_TRIM);
    });
    MOVING.forEach(function (c) { car(0, c[0], 0, c[1], c[2]); });
    PARKED.forEach(function (c) { car(c[0], c[1], 1, c[2], -1); });
    // spawn: uma placa baixa com um anel
    seed = [(PAD[0] + PAD[1]) / 2, 0, (PAD[2] + PAD[3]) / 2];
    quad(P, [PAD[0], 0.07, PAD[2]], [PAD[1] - PAD[0], 0, 0], [0, 0, PAD[3] - PAD[2]], step, [0, 1, 0], T_PAD);
    edges({ x0: PAD[0], x1: PAD[1], y0: 0, y1: 0.07, z0: PAD[2], z1: PAD[3] }, step * 0.6, P, T_TRIM);
    ring(P, seed[0], 0.08, seed[2], 0.28, step * 0.5, T_RING);
    // fonte: a borda do tanque, a taça do meio (a água entra nos efeitos, mais abaixo)
    seed = [FOUNT[0], 0, FOUNT[1]];
    ring(P, FOUNT[0], 0.03, FOUNT[1], 0.7, step * 0.45, T_TRIM); ring(P, FOUNT[0], 0.17, FOUNT[1], 0.7, step * 0.4, T_TRIM); ring(P, FOUNT[0], 0.17, FOUNT[1], 0.62, step * 0.5, T_BODY); ring(P, FOUNT[0], 0.1, FOUNT[1], 0.7, step * 0.6, T_BODY);
    ring(P, FOUNT[0], 0.12, FOUNT[1], 0.13, step * 0.5, T_BODY); line(P, [FOUNT[0], 0.1, FOUNT[1]], [FOUNT[0], 0.5, FOUNT[1]], step * 0.4, T_BODY);
    ring(P, FOUNT[0], 0.5, FOUNT[1], 0.3, step * 0.4, T_TRIM); ring(P, FOUNT[0], 0.44, FOUNT[1], 0.2, step * 0.5, T_BODY); ring(P, FOUNT[0], 0.7, FOUNT[1], 0.08, step * 0.4, T_TRIM);
    // bancos em volta da fonte
    [[-0.88, 1.93, 0], [-0.88, 3.57, 1], [-2.52, 1.93, 1]].forEach(function (d) {
      var bw = d[2] ? 0.56 : 0.18, bd = d[2] ? 0.18 : 0.56;
      seed = [d[0], 0, d[1]];
      crate({ x0: d[0] - bw / 2, x1: d[0] + bw / 2, y0: 0.16, y1: 0.23, z0: d[1] - bd / 2, z1: d[1] + bd / 2 }, step * 0.8, T_BODY);
      line(P, [d[0] - bw / 2 + 0.03, 0, d[1] - bd / 2 + 0.03], [d[0] - bw / 2 + 0.03, 0.16, d[1] - bd / 2 + 0.03], step * 0.5, T_TRIM); line(P, [d[0] + bw / 2 - 0.03, 0, d[1] + bd / 2 - 0.03], [d[0] + bw / 2 - 0.03, 0.16, d[1] + bd / 2 - 0.03], step * 0.5, T_TRIM);
    });
    // guarda-sóis e mesas no terraço do café
    [[-2.95, 3.1], [-2.95, 3.78]].forEach(function (d) {
      seed = [d[0], 0, d[1]];
      line(P, [d[0], 0, d[1]], [d[0], 0.66, d[1]], step * 0.5, T_POST); ring(P, d[0], 0.3, d[1], 0.13, step * 0.5, T_BODY); ring(P, d[0], 0.5, d[1], 0.27, step * 0.45, T_TRIM);
      for (q = 0, j = Math.round(46 * E.K); q < j; q++) { var uv = Math.sqrt((q + 0.5) / j), uth = q * 2.39996; add(P, d[0] + Math.cos(uth) * uv * 0.27, 0.66 - uv * 0.16, d[1] + Math.sin(uth) * uv * 0.27, Math.cos(uth) * 0.5, 0.86, Math.sin(uth) * 0.5, Math.floor(frac(uth / (2 * PI)) * 8) % 2 ? T_AWN : T_AWN2); }
    });
    // árvores e arbustos
    CONIFERS.forEach(function (c) { conifer(c[0], c[1], c[2], c[3]); });
    BROADS.forEach(function (c) { broadleaf(c[0], c[1], c[2], c[3]); });
    BUSHES.forEach(function (c) { bush(c[0], c[1], c[2]); });

    // --- torre do relógio: o projeto em arame e as paredes ---
    PARTS.forEach(function (p, pi) {
      owner = TOWER + pi; seed = [TX, p.y0, TZ];
      var o = { style: p.id, x0: TX - p.half, x1: TX + p.half, y0: p.y0, y1: p.y1, z0: TZ - p.half, z1: TZ + p.half }, f;
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
        loop(D, o.x0, o.x1, o.z0, o.z1, p.y0, step * 0.55, 0);
        for (j = 0; j < 3; j++) OCC.push([TX - p.half * (1 - j / 3), TX + p.half * (1 - j / 3), p.y0 + hgt * j / 3, p.y0 + hgt * (j + 1) / 3 * 0.9, TZ - p.half * (1 - j / 3), TZ + p.half * (1 - j / 3), 1]);
        SOL.push({ id: p.id, kind: 2, shape: 'pyramid', box: [o.x0, o.x1, p.y0, p.y1, o.z0, o.z1] });
        return;
      }
      for (f = 0; f < 4; f++) wall(o, f);
      edges(o, step * 0.55, D, 0);
      loop(D, o.x0, o.x1, o.z0, o.z1, o.y0 + 0.005, step * 0.55, 0);
      if (p.id === 'tBase') quad(W, [o.x0, o.y1, o.z0], [o.x1 - o.x0, 0, 0], [0, 0, o.z1 - o.z0], step, [0, 1, 0], 0);
      OCC.push([o.x0, o.x1, o.y0, o.y1, o.z0, o.z1, 1]);
      SOL.push({ id: p.id, kind: 2, box: [o.x0, o.x1, o.y0, o.y1, o.z0, o.z1] });
    });

    // --- pulsos dos sistemas ---
    owner = 50; seed = null;
    var hop = 0;
    ROUTES.forEach(function (route) {
      for (var s = 0; s < route.length - 1; s++) {
        var A = route[s], B = route[s + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), parts = Math.max(1, Math.round(len / 2.2));
        for (var c = 0; c < parts; c++) {
          var a0 = [A[0] + (B[0] - A[0]) * c / parts, A[1] + (B[1] - A[1]) * c / parts, A[2] + (B[2] - A[2]) * c / parts];
          var b0 = [A[0] + (B[0] - A[0]) * (c + 1) / parts, A[1] + (B[1] - A[1]) * (c + 1) / parts, A[2] + (B[2] - A[2]) * (c + 1) / parts], L = len / parts;
          line(X, a0, b0, step * 0.9, T_WIRE);
          for (var k = 0; k < 3; k++) for (var e = 0, ne = Math.round(12 * KQ); e < ne; e++) {     // três pacotes por trecho, cada um com cauda
            q = add(X, (a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2, (a0[2] + b0[2]) / 2, 0, 1, 0, T_PACK);
            if (q >= 0) { flow(q, b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2], frac(k / 3 + hop * 0.37 - e / ne * 0.3 / L)); ub[q] = 1 - e / ne; }
          }
          hop++;
        }
      }
    });
    [[DOOR[0], DOOR[2], 0.17], [NEWS[0], NEWS[2], 0.17], [HUB[0], HUB[2], 0.2]].forEach(function (d) { ring(X, d[0], 0.05, d[1], d[2], step * 0.5, T_NODE); });
    // o servidor: um cubo de arame no alto
    b = { x0: STORE[0] - 0.17, x1: STORE[0] + 0.17, y0: STORE[1], y1: STORE[1] + 0.34, z0: STORE[2] - 0.17, z1: STORE[2] + 0.17 };
    edges(b, step * 0.45, X, T_NODE); loop(X, b.x0, b.x1, b.z0, b.z1, b.y0, step * 0.45, T_NODE);

    // --- efeitos ---
    owner = 60;
    for (i = 0, j = Math.round(110 * E.K); i < j; i++) {                                           // brilhos que sobem do spawn
      a = r() * 2 * PI; q = Math.sqrt(r()) * 0.34; a = add(M, Math.cos(a) * q, 0.85, 1.7 + Math.sin(a) * q, 0, 1, 0, 0);
      if (a >= 0) { flow(a, 0, 1.5, 0, r()); ub[a] = 0.4 + r() * 0.8; }
    }
    LAMPS.forEach(function (l) {                                                                   // poeira no cone de luz de cada poste
      for (var k = 0, n = Math.round(34 * E.K); k < n; k++) {
        var ly = r() * 0.92, lr = Math.sqrt(r()) * (0.06 + (1 - ly / 0.95) * 0.42), lt = r() * 2 * PI;
        a = add(M, l[0] + Math.cos(lt) * lr, ly, l[1] + l[2] * 0.22 + Math.sin(lt) * lr, 0, 1, 0, 1);
        if (a >= 0) { flow(a, 0, -0.16, 0, r()); ub[a] = (0.25 + r() * 0.5) * (0.35 + ly); }
      }
    });
    [[-4.2, 1.8, -2.1], [4.1, lf.y1 + 0.67, -2.12]].forEach(function (c) {                         // fumaça das chaminés
      for (var k = 0, n = Math.round(26 * E.K); k < n; k++) { a = add(M, c[0] + 0.15 + (r() - 0.5) * 0.14, c[1] + 0.34, c[2] + (r() - 0.5) * 0.14, 0, 1, 0, 2); if (a >= 0) { flow(a, 0.3 + r() * 0.2, 0.7, 0.05, r()); ub[a] = 0.3 + r() * 0.5; } }
    });
    for (i = 0, j = Math.round(60 * E.K); i < j; i++) {                                            // água da fonte: o jato do meio...
      a = add(M, FOUNT[0] + (r() - 0.5) * 0.05, 0.98, FOUNT[1] + (r() - 0.5) * 0.05, 0, 1, 0, 3); if (a >= 0) { flow(a, (r() - 0.5) * 0.1, 0.5, (r() - 0.5) * 0.1, r()); ub[a] = 0.5 + r() * 0.5; }
    }
    for (i = 0, j = Math.round(90 * E.K); i < j; i++) {                                            // ... e o véu que cai da taça
      var wa = r() * 2 * PI; a = add(M, FOUNT[0] + Math.cos(wa) * 0.34, 0.34, FOUNT[1] + Math.sin(wa) * 0.34, 0, 1, 0, 3);
      if (a >= 0) { flow(a, Math.cos(wa) * 0.12, -0.34, Math.sin(wa) * 0.12, r()); ub[a] = 0.35 + r() * 0.5; }
    }
    return cnt;
  }

  // Ajusta o passo da malha até a cidade inteira caber nos pontos disponíveis; o que sobra fica guardado, invisível
  // (quase tudo é malha, então a quantidade cai com o quadrado do passo: uma medida já deixa o passo perto do certo)
  var STEP = 0.07 / Math.sqrt(E.K);
  STEP *= Math.sqrt(build(STEP) / (N * 0.975));
  while (build(STEP) > N * 0.985) STEP *= 1.012;
  var USED = cnt, r0 = E.rng(23), i0;
  owner = 70; seed = null;
  for (i0 = USED; i0 < N; i0++) add(Z, (r0() - 0.5) * 9.6, 0, (r0() - 0.5) * 9.6, 0, 1, 0, 0);
  for (i0 = 0; i0 < N; i0++) rnd[i0] = r0();
  SOL.forEach(function (s) { if (s.shape) E.solidShape(s.id, s.shape); });

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
  // Luz quente dos postes, das vitrines, da fonte e do spawn sobre um ponto, à noite (0 a 1): [x, y, z, alcance, força]
  var GLOW = LAMPS.map(function (l) { return [l[0], 1.0, l[1] + l[2] * 0.22, 1.45, 1]; }).concat([
    [-4.05, 0.45, -1.1, 1.0, 0.8], [-1.7, 0.45, -1.1, 1.15, 0.85], [-0.82, 0.45, -2.0, 1.0, 0.75], [1.875, 0.5, -1.15, 1.1, 0.7], [3.25, 0.45, -1.1, 1.0, 0.8], [4.05, 0.45, -1.1, 1.0, 0.8],
    [-3.1, 0.45, 3.55, 1.1, 0.75], [-2.3, 0.4, 4.6, 0.7, 0.6], [FOUNT[0], 0.3, FOUNT[1], 1.25, 0.75], [0, 0.3, 1.7, 0.9, 0.8]
  ]);
  function glow(x, y, z) {
    var g = 0;
    for (var q = 0; q < GLOW.length; q++) { var o = GLOW[q], d = Math.hypot(x - o[0], (y - o[1]) * 0.6, z - o[2]) / o[3]; if (d < 1) g += (1 - d) * (1 - d) * o[4]; }
    return Math.min(1, g);
  }
  // Um ponto recebe sol? É a parte cara de uma cena de sol (um raio por ponto), por isso é calculada em fatias:
  // o preparo em segundo plano faz uma fatia por vez, sem segurar o filme (ver "steps" em js/matter.js).
  var SLICES = 8;
  function sunlit(i, S, tower) {
    var k = kind[i], t = tag[i];
    if (own[i] >= TOWER && own[i] < TOWER + 5 && !tower) return 0;
    if (k === G || k === F) return shaded(px[i], py[i] + 0.03, pz[i], S, tower) ? 0 : 1;
    if (k === R || k === W) return nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2] > 0.02 && !shaded(px[i] + nx[i] * 0.03, py[i] + ny[i] * 0.03, pz[i] + nz[i] * 0.03, S, tower) ? 1 : 0;
    if (k === P) {
      if ((t === T_CROWN || t === T_NEEDLE) && 0.5 + 0.5 * (nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2]) <= 0.35) return 0;
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
  // tom e brilho de cada zona do chão, de dia (na ordem das zonas, de Z_PLAIN a Z_YARD)
  var GH = [0.2, 0.8, 0.1, 0.82, 0.6, 0.3, 0.44, 0.3, 0.46, 0.75, 0.2, 0.7, 0.3, 0.3, 0.62, 0.55, 0.7, 0.16];
  var GK = [0.8, 1, 0.6, 1, 0.9, 0.8, 0.85, 0.85, 0.9, 1, 0.8, 0.9, 0, 0.6, 0.85, 0.55, 0.95, 0.7];
  var FACE_K = { s: 1, e: 0.7, w: 0.82, n: 0.6 };
  function faceK(i) { return ny[i] > 0.5 ? 1 : nz[i] > 0.5 ? FACE_K.s : nx[i] > 0.5 ? FACE_K.e : nx[i] < -0.5 ? FACE_K.w : nz[i] < -0.5 ? FACE_K.n : 0.8; }

  // Cada cena: até onde a obra chegou (stage) e com que luz
  //   stage 0 baseplate | 1 planta | 2 volumes | 3 detalhe
  var LOOKS = {
    base: { stage: 0 }, plan: { stage: 1 }, grey: { stage: 2 }, built: { stage: 3 },
    dusk: { stage: 3, sun: SUN_W, fx: true },
    night: { stage: 3, night: true, pulses: true, fx: true },
    calm: { stage: 3, night: true, fx: true, mark: true },
    frame: { stage: 3, night: true, fx: true, mark: true, frame: true },
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
      var tw = own[i] >= TOWER && own[i] < TOWER + 5, up = k === G || k === Z || k === F || k === X || k === M ? true : tw ? !!(L.tower || L.frame) : k === P ? st >= 3 : st >= 2;
      x = up ? px[i] : sx[i]; y = up ? py[i] : sy[i]; z = up ? pz[i] : sz[i];
      h = 0; kk = 0; g = 0;

      if (tw && L.frame) {
        // ----- o projeto da torre: só o arame, em dourado -----
        if (k === D || t === T_CLOCK) { h = 0.6; kk = k === D ? 1.0 : 0.8; g = 1; }
      } else if (k === G || k === F || (k === R && !up)) {
        // ----- chão, o campo em volta e a planta das construções -----
        if (k === F) { h = 0.3; kk = 0.6; }
        else if (st === 0) { h = grid[i] === 2 ? 1 : grid[i] === 1 ? 0.9 : 0.28; kk = grid[i] === 2 ? 1.3 : 1; }
        else if (k === R) { h = 0.62; kk = 1.15; }
        else {
          var zt = t;
          if (st < 3 && (zt === Z_PAD || zt === Z_WATER || zt === Z_RING)) zt = Z_PLAZA;   // o spawn e a fonte só chegam com o detalhe
          if ((zt === Z_LOT || zt === Z_LOTEDGE) && L.tower) zt = grid[i] ? Z_TILE : Z_PLAZA;
          h = GH[zt]; kk = GK[zt];
          if (zt === Z_LAWN) kk *= 0.5 + rnd[i];                         // grama: pontilhado irregular
          if (st === 1) {                                              // na planta, a grade da baseplate ainda aparece e os riscos são mais fortes
            if (grid[i] === 1 && (zt === Z_PLAIN || zt === Z_STREET || zt === Z_YARD)) { h += 0.16; kk = 0.85; }
            if (zt === Z_CURB || zt === Z_MARK || zt === Z_LOTEDGE || zt === Z_LAWNEDGE) kk *= 1.3;
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
      } else if (k === R) {
        // ----- tetos e telhados -----
        h = 0.7; kk = 0.5 + 0.5 * Math.max(0, nx[i] * KEY[0] + ny[i] * KEY[1] + nz[i] * KEY[2]) / KEY[1];
        if (S) {
          lam = nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2];
          if (LIT[i]) { h = 0.72; kk = 0.5 + 0.9 * lam; g = 0.66; } else { h = 0.3; kk = 0.36; }
        } else if (L.night) { lam = glow(x, y, z); kk *= 0.52 + lam * 0.6; h = 0.6; g = lam * 0.8; }
      } else if (k === W || k === D) {
        // ----- paredes e arestas -----
        if (!up) { if (st === 1 && !tw) { h = 0.95; kk = ub[i] * (k === D ? 0.6 : 1.6); } }   // na planta: só o contorno, riscado no chão
        else if (k === D) {
          if (S) { h = 0.9; kk = 0.72; g = 0.45; } else if (L.night) { h = 0.8; kk = 0.8; } else { h = 1; kk = 1.1; }
        } else {
          var fk = faceK(i), det = st >= 3 ? t : 0, trim = det === 3;
          if (S) {
            lam = nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2]; lit = LIT[i] === 1;
            if (det === 5) { h = 0.56; kk = 1.1; g = 1; }                                  // vitrines: já acesas ao pôr do sol
            else if (det === 1) {
              if (lit) { var gl = frac(ua[i] * 7.3); if (gl < 0.26) { h = 0.92; kk = 1.25; g = 0.75; } else if (gl < 0.52) { h = 0.56; kk = 1.15; g = 1; } else { h = 0.36; kk = 0.46; g = 0.4; } }   // vidro: uns refletem o sol, outros têm luz acesa
              else if (ua[i] < 0.5) { h = 0.56; kk = 1.2; g = 1; } else { h = 0.12; kk = 0.3; }                                // na sombra: luz acesa lá dentro
            } else if (det === 2) { h = 0.12; kk = lit ? 0.45 : 0.28; g = lit ? 0.4 : 0; }
            else if (lit) { h = 0.62 + 0.2 * lam; kk = (0.36 + 0.58 * lam) * (trim ? 1.3 : 1); g = 0.7; }
            else { h = 0.3; kk = trim ? 0.54 : 0.4; }
          } else if (L.night) {
            lam = glow(x, y, z);
            if (det === 5 || (det === 1 && ua[i] < 0.5)) { h = 0.56; kk = det === 5 ? 1.2 : 1.15; g = 1; }
            else if (det === 1 || det === 2) { h = 0.1; kk = 0.22 + lam * 0.3; g = lam; }
            else { h = 0.36 + lam * 0.3; kk = (trim ? 0.6 : 0.44) * (0.6 + fk * 0.5) + lam * 0.6; g = lam * 0.85; }
          } else {
            if (det === 1) { h = 0.16; kk = 0.3; } else if (det === 5) { h = 0.3; kk = 0.42; } else if (det === 2) { h = 0.1; kk = 0.26; } else if (trim) { h = 0.95; kk = fk * 1.05; }
            else { h = 0.58 + (rnd[i] - 0.5) * 0.05; kk = fk; }
          }
        }
      } else if (k === P) {
        // ----- objetos -----
        if (up) {
          switch (t) {
            case T_CROWN: h = 0.5; kk = 0.58 + 0.44 * (ny[i] * 0.5 + 0.5); break;
            case T_NEEDLE: h = 0.46; kk = 0.48 + 0.5 * ub[i]; break;
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
            case T_CAR: h = 0.8; kk = 0.95; break;
            case T_CARF: h = 1; kk = 1.3; break;
            case T_CARR: h = 0.5; kk = 0.7; break;
            case T_SIGNAL: h = 0.56; kk = 1.4; g = 1; break;
          }
          if (S) {
            if (t === T_HEAD || t === T_TIP || t === T_CARF) { h = 0.66; kk = 1.7; g = 1; }
            else if (t === T_CARR) { h = 0.4; kk = 1.1; g = 1; }
            else if (t === T_SIGN) { h = 0.6; kk = 1.1; g = 0.9; }
            else if (t === T_CLOCK) { h = 0.95; kk = 1.1; g = 0.55; }
            else if (t !== T_SIGNAL) {
              lam = t === T_CROWN || t === T_NEEDLE ? 0.5 + 0.5 * (nx[i] * S[0] + ny[i] * S[1] + nz[i] * S[2]) : 0.6;
              if (LIT[i]) { h = 0.5 + h * 0.35; kk *= 0.5 + 0.8 * lam; g = 0.62; } else { h = 0.1 + h * 0.4; kk *= 0.42; }
            }
          } else if (L.night) {
            if (t === T_HEAD || t === T_CARF) { h = 0.66; kk = 2; g = 1; }
            else if (t === T_CARR) { h = 0.4; kk = 1.2; g = 1; }
            else if (t === T_SIGN) { h = 0.6; kk = 1.2; g = 1; }
            else if (t === T_RING || t === T_TIP || t === T_CLOCK) { h = 0.6; kk = 1.2; g = 1; }
            else if (t !== T_SIGNAL) { lam = t === T_CAR ? 0.3 : glow(x, y, z); h = h * 0.8 + lam * 0.2; kk *= 0.58 + lam; g = lam * 0.85; }
          }
        }
      } else if (k === X) {
        // ----- pulsos -----
        if (L.pulses) { g = 1; if (t === T_WIRE) { h = 0.5; kk = 0.8; } else if (t === T_NODE) { h = 0.6; kk = 1.25; } else { h = 0.68; kk = 1.9 * ub[i]; } }
      } else if (k === M) {
        // ----- efeitos -----
        if (t < 2) { if (L.fx) { g = 1; h = 0.6; kk = (t === 1 ? (L.night ? 0.6 : 0.4) : 0.95) * ub[i]; } }
        else if (st >= 3) { h = t === 2 ? 0.5 : 0.9; kk = (t === 2 ? 0.34 : 0.8) * ub[i]; if (S) g = 0.5; else if (L.night) { g = t === 3 ? 0.6 : 0; kk *= t === 3 ? 1 : 0.6; } }
      }

      tint(h, kk, g);
      s.rgb(x, y, z, col[0], col[1], col[2]);
      if (fph[i] >= 0) s.flowLast(fvx[i], fvy[i], fvz[i], fph[i]);
    }
    return s;
  }

  // ---------- Sólidos de cada cena ----------
  // kind 0: volume de construção (nasce achatado na planta e sobe) | 1: copa de árvore (nasce no chão, no detalhe)
  // kind 2: peça da torre (no projeto, achatada na própria base; cheia depois de montada)
  function solidsOf(name) {
    var L = LOOKS[name], out = {};
    SOL.forEach(function (s) {
      var b = s.box;
      if (s.kind === 0) { if (L.stage >= 1) out[s.id] = L.stage >= 2 ? b : [b[0], b[1], 0, 0, b[4], b[5]]; }
      else if (s.kind === 1) { if (L.stage >= 2) out[s.id] = L.stage >= 3 ? b : [s.at[0], s.at[0], 0, 0, s.at[1], s.at[1]]; }
      else if (L.tower) out[s.id] = b;
      else if (L.frame) out[s.id] = [b[0], b[1], b[2], b[2], b[4], b[5]];
    });
    return out;
  }
  var VIEW = {
    base: { size: 0.062, gain: 1.0, dof: 0.05 }, plan: { size: 0.062, gain: 1.0, dof: 0.05 }, grey: { size: 0.062, gain: 0.95, dof: 0.07 },
    built: { size: 0.062, gain: 0.95, dof: 0.075 }, dusk: { size: 0.064, gain: 1.0, dof: 0.08 }, night: { size: 0.064, gain: 1.05, dof: 0.06 },
    calm: { size: 0.064, gain: 1.05, dof: 0.08 }, frame: { size: 0.064, gain: 1.05, dof: 0.08 }, tower: { size: 0.064, gain: 1.05, dof: 0.08 }, dawn: { size: 0.064, gain: 1.0, dof: 0.075 }
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
  var RISE = BUILD.map(function (b, i) { return i / (BUILD.length - 1) * 0.94; });   // a ordem em que os volumes sobem
  var PLACE = [0, 0.2, 0.5, 0.64, 0.78];                                           // a ordem em que as peças da torre são preenchidas
  function sweep(S) { return function (i) { return clamp(0.5 - (px[i] * S[0] + pz[i] * S[2]) / Math.hypot(S[0], S[2]) / 13, 0, 1); }; }
  function diag(x, z) { return clamp((x - z + 10) / 20, 0, 1); }
  E.fx('settle', role(function (i) { return clamp(Math.hypot(sx[i], sz[i]) / 7, 0, 1); }, 0.35));       // o mar assenta do centro para as bordas
  E.fx('draw', role(function (i) { return clamp((sx[i] + 5) / 10, 0, 1); }));                           // a planta é riscada de oeste a leste
  E.fx('extrude', role(function (i) { return own[i] < TOWER && (kind[i] === W || kind[i] === D || kind[i] === R) ? RISE[own[i]] : 0; }));
  E.fx('detail', role(function (i) { return diag(sx[i], sz[i]); }));                                    // o detalhe corre na diagonal
  E.fx('sunset', role(sweep(SUN_W)));                                                                   // a luz chega do lado do sol
  E.fx('sunrise', role(sweep(SUN_E)));
  E.fx('fade', role(function (i) { return rnd[i]; }));
  // a torre é preenchida peça por peça e, dentro de cada peça, de baixo para cima
  E.fx('place', role(function (i) {
    var p = own[i] - TOWER; if (p < 0 || p > 4) return 0;
    return PLACE[p] + (kind[i] === W ? 0.14 * clamp((py[i] - PARTS[p].y0) / (PARTS[p].y1 - PARTS[p].y0), 0, 1) : 0);
  }));
  var SOLBY = {}; SOL.forEach(function (s) { SOLBY[s.id] = s; });
  E.solidFx('extrude', function (id) { var s = SOLBY[id]; return s && s.kind === 0 ? RISE[s.own] : 0; });
  E.solidFx('detail', function (id) { var s = SOLBY[id]; return s && s.kind === 1 ? diag(s.at[0], s.at[1]) : 0; });
  E.solidFx('place', function (id) { for (var q = 0; q < PARTS.length; q++) if (PARTS[q].id === id) return PLACE[q] + 0.05; return 0; });

  // ---------- O que a câmera olha e onde as etiquetas ficam presas ----------
  E.subject('town', { at: function () { return [0, 0.6, -0.2]; } });
  E.subject('shop', { at: function () { return [-1.68, 0.7, -1.3]; } });
  E.subject('lot', { at: function () { return [TX, 1.9, TZ]; } });
  E.anchor('spawn', function () { return [0, 0.12, 1.7]; });
  E.anchor('door', function () { return [DOOR[0], 0.1, DOOR[2]]; });
  E.anchor('wire', function () { return [HUB[0], 2.9, HUB[2]]; });
  E.anchor('store', function () { return [STORE[0], STORE[1] + 0.36, STORE[2]]; });
  E.anchor('shopdoor', function () { return [-1.68, 0.84, -1.28]; });
});
