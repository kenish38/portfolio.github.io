// ===== A matéria do outro lado da parede =====
// Um único campo de partículas luminosas (brasa de forja) que a rolagem molda,
// cena por cena, como um filme:
//   wave        mar de brasa visto pelo recorte do nome
//   plate       grade plana de studs: de onde todo jogo começa
//   boardFlat   a grade vira tabuleiro, com as peças ainda deitadas nas casas
//   boardUp     as peças sobem do tabuleiro (partida em andamento)
//   boardClose  a mesma cena, com a câmera colada no cavalo
//   boardCap    o cavalo captura o peão
//   boardFall   o peão cai pelo buraco que abriu no tabuleiro
//   shaftTop/shaftLow   o peão caindo por um poço cortado por raios de sol
//   blast/ship  os raios viram tiros, o peão se estilhaça e o caça chega voando
//   approach    a câmera alcança o caça por trás, para entrar na cabine
//   code        o script Luau que dispara os tiros, escrito com pontos
//   cockpit/cockpitOn   por dentro da cabine: painel, clique e a mensagem final
// As passagens entre cenas e os tempos ficam em js/main.js (lista "beats").
// Nada aqui é imagem ou modelo externo: tudo é gerado por código.
(function () {
  'use strict';
  var T = window.THREE, PI = Math.PI;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Paleta: do branco quente ao vermelho escuro, com um azul frio raro ----------
  var HOT = [1.0, 0.95, 0.84], AMBER = [1.0, 0.70, 0.29], ORANGE = [1.0, 0.48, 0.17], RED = [0.89, 0.23, 0.18], DEEP = [0.42, 0.08, 0.10], BLUE = [0.30, 0.50, 1.0];
  var RAMP = [DEEP, RED, ORANGE, AMBER, HOT];
  function css(c) { return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')'; }

  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
  }
  function fbm(x, y) { return vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.27 + vnoise(x * 4.3, y * 4.3) * 0.15 + vnoise(x * 8.7, y * 8.7) * 0.08; }

  var MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
  var SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

  // O script mostrado na cena de programação: o disparo do caça
  var CODE = [
    'local UserInput = game:GetService("UserInputService")',
    'local ship = workspace.Starfighter',
    '',
    'local function fire()',
    '    for _, cannon in ship.Cannons:GetChildren() do',
    '        local bolt = Bolt.new(cannon.CFrame)',
    '        bolt.Velocity = cannon.CFrame.LookVector * 400',
    '    end',
    'end',
    '',
    'UserInput.InputBegan:Connect(function(input)',
    '    if input.KeyCode == Enum.KeyCode.Space then',
    '        fire()',
    '    end',
    'end)'
  ];
  var KEY = /^(local|function|end|if|then|return|for|in|do|not|and|or|else|true|false|nil)$/;

  function create(canvas, opts) {
    opts = opts || {};
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' }); }
    catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);
    var small = Math.min(window.innerWidth, window.innerHeight) < 700;
    var SIDE = small ? 150 : 200, N = SIDE * SIDE;          // total de pontos
    var WX = small ? 250 : 320, WZ = N / WX;                // a mesma quantidade, numa grade larga
    var K = N / 40000;                                      // escala das quantidades de cada parte
    function cnt(n) { return Math.max(1, Math.round(n * K)); }

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(35, 1, 0.1, 400);

    // ---------- Uma forma: posição, cor e (opcional) fluxo de cada ponto ----------
    function Shape() { this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.flow = null; this.n = 0; }
    // h: calor de 0 a 1 (ou -1 para o azul frio); k: brilho
    Shape.prototype.put = function (x, y, z, h, k) {
      if (this.n >= N) return -1;
      var i = this.n * 3, p = this.pos, c = this.col; k = k === undefined ? 1 : k;
      p[i] = x; p[i + 1] = y; p[i + 2] = z;
      if (h < 0) { c[i] = BLUE[0] * k; c[i + 1] = BLUE[1] * k; c[i + 2] = BLUE[2] * k; }
      else {
        var t = clamp(h, 0, 1) * (RAMP.length - 1), j = Math.min(RAMP.length - 2, Math.floor(t)), f = t - j, a = RAMP[j], b = RAMP[j + 1];
        c[i] = lerp(a[0], b[0], f) * k; c[i + 1] = lerp(a[1], b[1], f) * k; c[i + 2] = lerp(a[2], b[2], f) * k;
      }
      return this.n++;
    };
    Shape.prototype.rgb = function (x, y, z, r, g, b) {
      if (this.n >= N) return -1;
      var i = this.n * 3; this.pos[i] = x; this.pos[i + 1] = y; this.pos[i + 2] = z; this.col[i] = r; this.col[i + 1] = g; this.col[i + 2] = b;
      return this.n++;
    };
    // fluxo do último ponto: ele percorre o vetor (fx, fy, fz) em laço; ph é a fase
    Shape.prototype.flowLast = function (fx, fy, fz, ph) {
      if (!this.flow) this.flow = new Float32Array(N * 4);
      var i = (this.n - 1) * 4; if (i < 0) return;
      this.flow[i] = fx; this.flow[i + 1] = fy; this.flow[i + 2] = fz; this.flow[i + 3] = ph;
    };

    // ---------- Onda e baseplate ----------
    function wave() {
      var s = new Shape(), r = rng(3);
      for (var iz = 0; iz < WZ; iz++) for (var ix = 0; ix < WX; ix++) {
        var x = (ix / (WX - 1) - 0.5) * 32, z = (iz / (WZ - 1)) * 22 - 17;
        if (r() < 0.02) s.put(x, -1.1, z, -1);
        else s.put(x, -1.1, z, 0.22 + 0.5 * fbm(x * 0.16 + 9, z * 0.22 + 4) + (r() < 0.04 ? 0.5 : 0));
      }
      return s;
    }
    function plate() {
      var s = new Shape();
      for (var iz = 0; iz < SIDE; iz++) for (var ix = 0; ix < SIDE; ix++) {
        var line = (ix % 10 === 0 || iz % 10 === 0), edge = ix === 0 || iz === 0 || ix === SIDE - 1 || iz === SIDE - 1;
        s.put((ix / (SIDE - 1) - 0.5) * 10, 0, (iz / (SIDE - 1) - 0.5) * 10, edge ? 1 : line ? 0.7 : 0.16);
      }
      return s;
    }

    // ---------- Peças de xadrez ----------
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

    // A partida em andamento (Abertura Escocesa, logo antes de Cxd4): casa = [coluna, fileira], de 0 a 7
    var HERO = [5, 2], PREY = [3, 3], LAND = [3, 3], HOLE = [3, 4];
    var SET = [];
    function pc(type, f, rk, side, role) { SET.push({ type: type, f: f, r: rk, side: side, role: role || '' }); }
    [['rook', 0], ['knight', 1], ['bishop', 2], ['queen', 3], ['king', 4], ['bishop', 5], ['rook', 7]].forEach(function (p) { pc(p[0], p[1], 0, 1); });
    [0, 1, 2, 5, 6, 7].forEach(function (f) { pc('pawn', f, 1, 1); }); pc('pawn', 4, 3, 1);
    pc('knight', HERO[0], HERO[1], 1, 'hero');
    [['rook', 0], ['bishop', 2], ['queen', 3], ['king', 4], ['bishop', 5], ['knight', 6], ['rook', 7]].forEach(function (p) { pc(p[0], p[1], 7, -1); });
    pc('knight', 2, 5, -1);
    [0, 1, 2, 3, 5, 6, 7].forEach(function (f) { pc('pawn', f, 6, -1); });
    pc('pawn', PREY[0], PREY[1], -1, 'prey');
    var COUNT = { pawn: 480, rook: 680, knight: 900, bishop: 740, queen: 900, king: 950 };
    SET.forEach(function (p, i) { p.cloud = cloud(p.type, cnt(p.role === 'hero' ? 4600 : p.role === 'prey' ? 2300 : COUNT[p.type]), 100 + i); });
    function sq(f, rk) { return [f - 3.5, 3.5 - rk]; }
    var GL = Math.max(6, Math.round(14 * Math.sqrt(K))), GD = Math.max(4, Math.round(8 * Math.sqrt(K)));
    var marks = {};   // faixas de pontos com papel próprio nas passagens (ver FX)

    // st: lift (peças de pé ou deitadas), cap (cavalo já capturou), prey 'stand' | 'hit' | 'fall', sparks 0 | 1 | 2, dust
    function chess(st) {
      var s = new Shape(), r = rng(9), L = [0.45, 0.8, 0.4], ln = Math.hypot(L[0], L[1], L[2]), k, kn;
      for (var rk = 0; rk < 8; rk++) for (var f = 0; f < 8; f++) {
        var c = sq(f, rk), light = (f + rk) % 2 === 1, g = light ? GL : GD, hole = f === HOLE[0] && rk === HOLE[1], start = s.n;
        for (var a = 0; a < g; a++) for (var b = 0; b < g; b++) {
          var x = c[0] + ((a + 0.5) / g - 0.5) * 0.94, z = c[1] + ((b + 0.5) / g - 0.5) * 0.94;
          if (hole && st.prey === 'fall') {
            if ((a + b) % 2) { var side = Math.floor(r() * 4), w = (r() - 0.5) * 0.98; s.put(c[0] + (side < 2 ? w : (side === 2 ? -0.49 : 0.49)), -r() * 0.5, c[1] + (side < 2 ? (side === 0 ? -0.49 : 0.49) : w), 1, 1.1); }
            else s.put(x + (r() - 0.5) * 0.7, -0.8 - r() * 4.5, z + (r() - 0.5) * 0.7, 0.3, 0.6);
          }
          else s.put(x, 0, z, light ? 0.34 : 0.1, light ? 0.62 : 0.7);
        }
        if (hole) marks.hole = [start, s.n];
      }
      for (var e = 0; e < 4; e++) for (k = 0, kn = cnt(120); k < kn; k++) {
        var u = (k / kn - 0.5) * 8.3;
        s.put(e < 2 ? u : (e === 2 ? -4.15 : 4.15), 0, e < 2 ? (e === 0 ? -4.15 : 4.15) : u, 0.85);
      }

      SET.forEach(function (p) {
        var cl = p.cloud, at = sq(p.f, p.r), py = 0, tilt = 0, face = p.side > 0 ? PI / 2 : -PI / 2, start = s.n;
        if (p.role === 'hero' && st.cap) at = sq(LAND[0], LAND[1]);
        if (p.role === 'prey') {
          if (st.prey === 'hit') { at = sq(HOLE[0], HOLE[1]); py = 0.12; tilt = -0.9; }
          else if (st.prey === 'fall') { at = sq(HOLE[0], HOLE[1]); at = [at[0], at[1] - 0.1]; py = -3.3; tilt = -1.95; }
        }
        var cf = Math.cos(face), sf = Math.sin(face), ct = Math.cos(tilt), stt = Math.sin(tilt), up = st.lift ? 1 : 0.012;
        for (var i = 0; i < cl.n; i++) {
          var x = cl.p[i * 3], y = cl.p[i * 3 + 1] * up, z = cl.p[i * 3 + 2], nx = cl.q[i * 3], ny = cl.q[i * 3 + 1], nz = cl.q[i * 3 + 2];
          var x1 = x * cf + z * sf, z1 = -x * sf + z * cf, nx1 = nx * cf + nz * sf, nz1 = -nx * sf + nz * cf;       // encara o adversário
          var y2 = y * ct - z1 * stt, z2 = y * stt + z1 * ct, ny2 = ny * ct - nz1 * stt, nz2 = ny * stt + nz1 * ct;  // tomba
          var lam = Math.max(0, (nx1 * L[0] + ny2 * L[1] + nz2 * L[2]) / ln);
          var heat = p.side > 0 ? 0.52 + 0.48 * lam : 0.04 + 0.34 * lam;
          s.put(at[0] + x1, py + y2, at[1] + z2, st.lift ? heat : heat * 0.6, p.side > 0 ? 0.8 : 1);
        }
        if (p.role) marks[p.role] = [start, s.n];
        p.range = [start, s.n];
      });

      // faíscas do impacto
      var land = sq(LAND[0], LAND[1]), d; marks.sparks = [s.n, 0];
      for (k = 0, kn = cnt(1500); k < kn; k++) {
        var th = r() * 2 * PI, cz = r() * 2 - 1, q = Math.sqrt(1 - cz * cz);
        if (st.sparks === 1) { d = 0.45 + r() * 1.25; s.put(land[0] + Math.cos(th) * q * d, 0.12 + Math.abs(cz) * d * 0.75, land[1] + Math.sin(th) * q * d, 0.75 + r() * 0.25); }
        else if (st.sparks === 2) { d = 2 + r() * 3.2; s.put(land[0] + Math.cos(th) * q * d, -0.4 + Math.abs(cz) * d * 0.5, land[1] + Math.sin(th) * q * d, 0.1, 0.25); }
        else s.put(land[0], 0.02, land[1], 0, 0);
      }
      marks.sparks[1] = s.n;
      // brasas soltas no ar
      marks.dust = [s.n, N];
      while (s.n < N) {
        if (st.dust) { s.put((r() - 0.5) * 13, 0.3 + r() * 5, (r() - 0.5) * 13, r() < 0.08 ? -1 : 0.15 + r() * 0.4, 0.55); s.flowLast(0, 1.6, 0, r()); }
        else s.put((r() - 0.5) * 8, 0, (r() - 0.5) * 8, 0.1, 0.5);
      }
      return s;
    }

    // ---------- Poço com raios de sol ----------
    var pawnBig = cloud('pawn', cnt(7000), 501), HITY = -2.5;
    function shaft(k) {
      var s = new Shape(), r = rng(15), d = [0.5, -1, -0.12], dl = Math.hypot(d[0], d[1], d[2]), i, n;
      d = [d[0] / dl, d[1] / dl, d[2] / dl];
      // raios: feixes paralelos que entram pela abertura lá em cima
      var beams = [[-6.2, 0.9], [-4.6, 0.35], [-3.5, 1.2], [-1.9, 0.5], [-0.6, 0.9], [0.9, 0.3], [2.0, 0.7]], bt = 0;
      beams.forEach(function (b) { bt += b[1]; });
      beams.forEach(function (b, bi) {
        for (var q = 0, m = Math.round(cnt(16000) * b[1] / bt); q < m; q++) {
          var t = Math.pow(r(), 1.25) * 15, w = b[1] * (0.6 + t * 0.035), ox = (r() + r() - 1) * w * 0.5, oz = (r() + r() - 1) * w * 0.9 - bi * 0.25 + 0.6;
          s.put(b[0] + ox + d[0] * t, 6.6 + d[1] * t, oz + d[2] * t, 0.98 - t * 0.05, 0.9);
          s.flowLast(d[0] * 2.2, d[1] * 2.2, d[2] * 2.2, r());
        }
      });
      // o peão, grande, iluminado pelo lado de onde vem a luz
      var c = pawnBig, sc = 2.7, tilt = lerp(-0.45, 0.6, k), py = lerp(4.4, HITY, k), pxx = lerp(-0.9, 0.7, k), ct = Math.cos(tilt), stt = Math.sin(tilt);
      for (i = 0; i < c.n; i++) {
        var x = c.p[i * 3] * sc, y = (c.p[i * 3 + 1] - 0.5) * sc, z = c.p[i * 3 + 2] * sc, nx = c.q[i * 3], ny = c.q[i * 3 + 1], nz = c.q[i * 3 + 2];
        var x2 = x * ct - y * stt, y2 = x * stt + y * ct, nx2 = nx * ct - ny * stt, ny2 = nx * stt + ny * ct;
        var lam = Math.max(0, -(nx2 * d[0] + ny2 * d[1] + nz * d[2]));
        s.put(pxx + x2, py + y2, z, 0.03 + Math.pow(lam, 1.4) * 0.97, 0.9);
      }
      // a abertura no alto e as paredes do poço
      for (i = 0, n = cnt(2500); i < n; i++) {
        var e = Math.floor(r() * 4), u = (r() - 0.5) * 3.4, hx = e < 2 ? u : (e === 2 ? -1.7 : 1.7), hz = e < 2 ? (e === 0 ? -1.7 : 1.7) : u;
        s.put(-4.2 + hx, 7.4 + r() * 0.5, hz, 1, 0.9);
      }
      for (i = 0, n = cnt(3000); i < n; i++) { var side = r() < 0.5 ? -1 : 1; s.put(side * (7.6 + r() * 0.5), (r() - 0.5) * 22, -3 + Math.floor(r() * 5) * 1.5, 0.12, 0.6); }
      while (s.n < N) { s.put((r() - 0.5) * 15, (r() - 0.5) * 17, (r() - 0.5) * 7, r() < 0.1 ? -1 : 0.25 + r() * 0.5, 0.5); s.flowLast(0.4, -1.4, 0, r()); }
      return s;
    }

    // ---------- Caça (desenho próprio, no espírito dos caças de ópera espacial) ----------
    // Nariz longo, canhões compridos nas pontas das asas e quatro motores.
    // Escreve o caça com "n" pontos; xf leva as coordenadas locais (nariz em +x) para a cena.
    function fighter(s, n, r, xf) {
      function at(x, y, z, h, k) { var p = xf(x, y, z); return s.put(p[0], p[1], p[2], h, k); }
      var hull = [[4.7, 0], [4.1, 0.1], [2.7, 0.24], [1.1, 0.42], [-0.6, 0.52], [-2.0, 0.48], [-2.7, 0.36], [-2.7, 0]];
      var i, m, t, a, x, sd, v, up, end = s.n + n;
      for (i = 0, m = Math.round(n * 0.33); i < m; i++) {       // fuselagem
        var j = Math.floor(r() * (hull.length - 1)); t = r(); a = r() * 2 * PI;
        x = lerp(hull[j][0], hull[j + 1][0], t); var rad = lerp(hull[j][1], hull[j + 1][1], t), ring = Math.abs((x * 1.8) % 1) < 0.07;
        at(x, Math.sin(a) * rad * 0.72, Math.cos(a) * rad, ring ? 0.95 : 0.42 + 0.3 * Math.max(0, Math.sin(a)), 0.85);
      }
      for (i = 0, m = Math.round(n * 0.06); i < m; i++) {       // cabine
        a = r() * PI; t = r() * 2 - 1; var q = Math.sqrt(1 - t * t);
        at(0.5 + t * 0.8, 0.32 + Math.sin(a) * q * 0.36, Math.cos(a) * q * 0.3, -1, 0.9);
      }
      for (i = 0, m = Math.round(n * 0.2); i < m; i++) {        // asas finas e retas
        sd = i % 2 ? 1 : -1; v = r(); var edge = r() < 0.25;
        var xa = lerp(-0.5, -1.3, v), xb = lerp(-2.4, -2.2, v); t = edge ? (r() < 0.5 ? 0 : 1) : r();
        at(lerp(xa, xb, t), 0.02 - v * 0.1 + (r() - 0.5) * 0.04, sd * lerp(0.45, 3.4, v), edge ? 0.95 : 0.36 + 0.2 * r(), 0.85);
      }
      for (i = 0, m = Math.round(n * 0.09); i < m; i++) {       // canhões compridos nas pontas das asas
        sd = i % 2 ? 1 : -1; a = r() * 2 * PI; t = r(); var cr = t > 0.9 ? 0.1 : 0.055;
        at(lerp(-2.3, 2.0, t), -0.1 + Math.sin(a) * cr, sd * 3.45 + Math.cos(a) * cr, 0.9);
      }
      for (i = 0, m = Math.round(n * 0.18); i < m; i++) {       // quatro motores
        sd = i % 2 ? 1 : -1; up = i % 4 < 2 ? 1 : -1; a = r() * 2 * PI;
        at(lerp(-3.3, -1.5, r()), 0.1 + up * 0.3 + Math.sin(a) * 0.25, sd * 0.66 + Math.cos(a) * 0.25, 0.5 + 0.3 * Math.sin(a));
      }
      for (i = 0, m = Math.round(n * 0.05); i < m; i++) {       // bocais acesos
        sd = i % 2 ? 1 : -1; up = i % 4 < 2 ? 1 : -1; a = r() * 2 * PI; var rr = Math.sqrt(r()) * 0.22;
        at(-3.32, 0.1 + up * 0.3 + Math.sin(a) * rr, sd * 0.66 + Math.cos(a) * rr, -1, 1.2);
      }
      for (i = 0, m = Math.round(n * 0.04); i < m; i++) {       // derivas
        sd = i % 2 ? 1 : -1; t = r(); v = r() * (1 - t); at(lerp(-1.6, -2.7, t) - v * 0.2, 0.5 + v * 0.8, sd * (0.5 + v * 0.36), 0.6);
      }
      while (s.n < end) { t = r(); at(lerp(-2.6, 4.4, t), 0.5 * (1 - Math.abs(t - 0.35) * 1.3) * 0.72 + 0.02, (r() - 0.5) * 0.03, 0.95); }   // friso no dorso
    }
    function exhaust(s, r, xf) {                                // rastro dos quatro motores (preenche até o fim)
      while (s.n < N) {
        var sd = r() < 0.5 ? 1 : -1, up = r() < 0.5 ? 1 : -1, a = r() * 2 * PI, rr = r() * 0.2;
        var p = xf(-3.35, 0.1 + up * 0.3 + Math.sin(a) * rr, sd * 0.66 + Math.cos(a) * rr), e = xf(-9.5, 0.1 + up * 0.3, sd * 0.66);
        s.put(p[0], p[1], p[2], -1, 0.8); s.flowLast(e[0] - p[0], e[1] - p[1], e[2] - p[2], r());
      }
    }
    // As cenas do espaço usam as mesmas faixas de pontos, para o caça voar inteiro de uma para a outra:
    //   [0, nSky) tiros e estrelas (eram os raios de sol) | [nSky, nSky + nPawn) estilhaços do peão | o resto: caça e rastro
    var nSky = cnt(16000), nPawn = pawnBig.n, nBolt = cnt(5000), HIT = [0.7, -2.5, 0];
    function shipXf(far) { return function (x, y, z) { return [x * 1.3 + 0.2 - far, y * 1.3 + 0.2, z * 1.3]; }; }
    var smallXf = function (x, y, z) { var c = Math.cos(0.5), sn = Math.sin(0.5); return [(x * c + z * sn) * 0.5 + 3.4, y * 0.5 + 3.6 + x * 0.05, (-x * sn + z * c) * 0.5 - 1.5]; };
    // arrived false: os tiros acertam o peão e o caça ainda vem longe; true: o caça chegou
    function space(arrived) {
      var s = new Shape(), r = rng(71), xf = shipXf(arrived ? 0 : 90), i, a, cz, q, d;
      for (i = 0; i < nBolt; i++) {
        var b = Math.floor(r() * 14), sd = b % 2 ? 1 : -1, ph = (b * 0.618) % 1, o = r(), p, e;
        if (arrived) { p = xf(2.0 + o * 1.4, -0.1, sd * 3.45); e = xf(26, -0.1, sd * 3.45); e = [e[0] - p[0], e[1] - p[1], e[2] - p[2]]; }
        else {
          var st = [-34, 0.07, sd * 4.48], dx = HIT[0] - st[0], dy = HIT[1] - st[1], dz = HIT[2] - st[2], dl = Math.hypot(dx, dy, dz);
          p = [st[0] + dx / dl * o * 2.4, st[1] + dy / dl * o * 2.4, st[2] + dz / dl * o * 2.4]; e = [dx * 1.9, dy * 1.9, dz * 1.9];
        }
        s.put(p[0] + (r() - 0.5) * 0.05, p[1] + (r() - 0.5) * 0.05, p[2] + (r() - 0.5) * 0.05, 0.45, 1.8);
        s.flowLast(e[0], e[1], e[2], ph);
      }
      while (s.n < nSky) { s.put((r() - 0.5) * 70, (r() - 0.5) * 34, -6 - r() * 34, r() < 0.2 ? -1 : 0.3 + r() * 0.7, 0.6); s.flowLast(-26, 0, 0, r()); }
      for (i = 0; i < nPawn; i++) {                             // estilhaços
        a = r() * 2 * PI; cz = r() * 2 - 1; q = Math.sqrt(1 - cz * cz); d = r(); var h = r();
        d = arrived ? 7 + d * 11 : 0.7 + d * 2.6;
        s.put(HIT[0] + Math.cos(a) * q * d + (arrived ? 4 : 0), HIT[1] + cz * d * 0.8, HIT[2] + Math.sin(a) * q * d * 0.7, arrived ? 0.2 : 0.65 + h * 0.35, arrived ? 0.3 : 1.1);
      }
      fighter(s, N - s.n - cnt(2200), rng(72), xf);
      exhaust(s, rng(73), xf);
      return s;
    }

    // ---------- Formas amostradas de desenhos 2D ----------
    // Devolve "count" pontos [x, y em px a partir do centro, r, g, b] sorteados pela opacidade do desenho
    function sample(cw, ch, count, seed, draw) {
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      draw(ctx, cw, ch);
      var d = ctx.getImageData(0, 0, cw, ch).data, cum = new Float32Array(cw * ch), acc = 0, r = rng(seed);
      for (var p = 0; p < cw * ch; p++) { var al = d[p * 4 + 3]; acc += al > 20 ? al : 0; cum[p] = acc; }
      var out = new Float32Array(count * 5);
      for (var i = 0; i < count; i++) {
        var t = r() * acc, lo = 0, hi = cw * ch - 1;
        while (lo < hi) { var m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; }
        var px = lo % cw, py = (lo - px) / cw;
        out[i * 5] = px + r() - cw / 2; out[i * 5 + 1] = -(py + r() - ch / 2);
        out[i * 5 + 2] = d[lo * 4] / 255; out[i * 5 + 3] = d[lo * 4 + 1] / 255; out[i * 5 + 4] = d[lo * 4 + 2] / 255;
      }
      return out;
    }
    function rrect(ctx, x, y, w, h, rad) {
      ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    }

    function code() {
      var s = new Shape(), r = rng(41), k = 9.6 / 1120;
      var pts = sample(1120, 700, nSky + nPawn, 42, function (ctx, w, h) {
        ctx.lineWidth = 3; ctx.strokeStyle = css(DEEP); rrect(ctx, 6, 6, w - 12, h - 12, 22); ctx.stroke();
        [RED, AMBER, HOT].forEach(function (c, i) { ctx.fillStyle = css(c); ctx.beginPath(); ctx.arc(40 + i * 30, 40, 8, 0, 2 * PI); ctx.fill(); });
        ctx.font = 'bold 26px ' + MONO; ctx.textBaseline = 'middle';
        var cw = ctx.measureText('M').width, x0 = (w - cw * 57) / 2 + cw * 3, y0 = 108, lh = 38.5;
        CODE.forEach(function (line, n) {
          ctx.fillStyle = css(DEEP); ctx.fillText(String(n + 1).padStart(2, ' '), x0 - cw * 3.4, y0 + n * lh);
          var re = /("[^"]*")|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^A-Za-z_\s"]+)/g, m, x = x0;
          while ((m = re.exec(line))) {
            var tok = m[0], next = line.charAt(re.lastIndex);
            if (m[1]) ctx.fillStyle = css(BLUE);
            else if (m[2]) ctx.fillStyle = KEY.test(tok) ? css(HOT) : (next === '(' ? css(AMBER) : css(ORANGE));
            else ctx.fillStyle = css(RED);
            if (!m[3]) ctx.fillText(tok, x, y0 + n * lh);
            x += cw * tok.length;
          }
        });
      });
      for (var i = 0; i < pts.length / 5; i++) s.rgb(pts[i * 5] * k - 0.4, pts[i * 5 + 1] * k - 0.9, (r() - 0.5) * 0.1, pts[i * 5 + 2], pts[i * 5 + 3], pts[i * 5 + 4]);
      // o caça segue voando, menor, acima do código (os mesmos pontos da cena anterior)
      fighter(s, N - s.n - cnt(2200), rng(72), smallXf);
      exhaust(s, rng(73), smallXf);
      return s;
    }

    // Painel da cabine: parte fixa, tela central (muda no clique) e botão
    var PW = 1500, PH = 560, PK = 11.5 / PW;
    function panelStatic(ctx) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = css(ORANGE); ctx.lineWidth = 6; rrect(ctx, 10, 10, PW - 20, PH - 20, 46); ctx.stroke();
      ctx.strokeStyle = css(AMBER); ctx.lineWidth = 5;                                   // radar
      [150, 100, 50].forEach(function (rad) { ctx.beginPath(); ctx.arc(230, 280, rad, 0, 2 * PI); ctx.stroke(); });
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(80, 280); ctx.lineTo(380, 280); ctx.moveTo(230, 130); ctx.lineTo(230, 430); ctx.stroke();
      ctx.fillStyle = css(HOT); [[282, 222, 9], [176, 330, 7], [300, 340, 6]].forEach(function (b) { ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, 2 * PI); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,179,74,0.55)'; ctx.beginPath(); ctx.moveTo(230, 280); ctx.arc(230, 280, 150, -1.2, -0.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = css(HOT); ctx.lineWidth = 7; rrect(ctx, 450, 70, 600, 330, 30); ctx.stroke();   // moldura da tela central
      for (var i = 0; i < 6; i++) {                                                       // medidores
        var h = [150, 230, 110, 260, 190, 90][i];
        ctx.strokeStyle = css(AMBER); ctx.lineWidth = 4; rrect(ctx, 1110 + i * 54, 110, 36, 280, 10); ctx.stroke();
        ctx.fillStyle = css(i === 3 ? HOT : ORANGE); rrect(ctx, 1116 + i * 54, 384 - h, 24, h, 6); ctx.fill();
      }
      for (i = 0; i < 9; i++) {                                                           // fileira de botões
        if (i === 4) continue;
        ctx.strokeStyle = css(i % 3 === 0 ? RED : AMBER); ctx.lineWidth = 5; rrect(ctx, 150 + i * 136, 450, 108, 62, 18); ctx.stroke();
        ctx.fillStyle = css(i % 3 === 0 ? RED : ORANGE); ctx.beginPath(); ctx.arc(204 + i * 136, 481, 9, 0, 2 * PI); ctx.fill();
      }
    }
    function panelScreen(ctx, on, lines) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineCap = 'round';
      if (!on) {
        ctx.strokeStyle = css(AMBER); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(750, 235, 92, 0, 2 * PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(750, 235, 34, 0, 2 * PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(610, 235); ctx.lineTo(700, 235); ctx.moveTo(800, 235); ctx.lineTo(890, 235); ctx.moveTo(750, 110); ctx.lineTo(750, 190); ctx.moveTo(750, 280); ctx.lineTo(750, 360); ctx.stroke();
        ctx.fillStyle = css(HOT); ctx.beginPath(); ctx.arc(750, 235, 8, 0, 2 * PI); ctx.fill();
      } else {
        ctx.fillStyle = css(HOT);
        var size = 62; ctx.font = '900 ' + size + 'px ' + SANS;
        while (size > 30 && Math.max(ctx.measureText(lines[0]).width, ctx.measureText(lines[1]).width) > 540) { size -= 2; ctx.font = '900 ' + size + 'px ' + SANS; }
        ctx.fillText(lines[0], 750, 235 - size * 0.62); ctx.fillText(lines[1], 750, 235 + size * 0.62);
      }
    }
    function panelButton(ctx, on) {
      ctx.lineJoin = 'round';
      if (on) { ctx.fillStyle = css(HOT); rrect(ctx, 694, 440, 112, 82, 22); ctx.fill(); ctx.globalCompositeOperation = 'destination-out'; }
      else { ctx.strokeStyle = css(HOT); ctx.lineWidth = 7; rrect(ctx, 694, 440, 112, 82, 22); ctx.stroke(); }
      ctx.fillStyle = css(HOT); ctx.beginPath(); ctx.moveTo(736, 460); ctx.lineTo(736, 502); ctx.lineTo(772, 481); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    // do desenho do painel (px) para a cena: o painel fica deitado, inclinado para o piloto
    var TILT = 1.0, cT = Math.cos(TILT), sT = Math.sin(TILT);
    function onPanel(px, py, lift) { var y = py * PK; lift = lift || 0; return [px * PK, -2.0 + y * cT + lift * sT, -y * sT + lift * cT]; }
    var panelPts = sample(PW, PH, cnt(14500), 81, panelStatic);
    function cockpit(on, lines) {
      var s = new Shape(), r = rng(91), i, p, a;
      for (i = 0; i < panelPts.length / 5; i++) { p = onPanel(panelPts[i * 5], panelPts[i * 5 + 1]); s.rgb(p[0], p[1], p[2], panelPts[i * 5 + 2], panelPts[i * 5 + 3], panelPts[i * 5 + 4]); }
      var scr = sample(PW, PH, cnt(5200), 82, function (ctx) { panelScreen(ctx, on, lines); });
      marks.screen = [s.n, 0];
      for (i = 0; i < scr.length / 5; i++) { p = onPanel(scr[i * 5], scr[i * 5 + 1]); s.rgb(p[0], p[1], p[2], scr[i * 5 + 2], scr[i * 5 + 3], scr[i * 5 + 4]); }
      marks.screen[1] = s.n;
      var btn = sample(PW, PH, cnt(900), 83, function (ctx) { panelButton(ctx, on); }), g = on ? 1.5 : 1;
      marks.button = [s.n, 0];
      for (i = 0; i < btn.length / 5; i++) { p = onPanel(btn[i * 5], btn[i * 5 + 1]); s.rgb(p[0], p[1], p[2], btn[i * 5 + 2] * g, btn[i * 5 + 3] * g, btn[i * 5 + 4] * g); }
      marks.button[1] = s.n;
      // cursor: uma seta que vai até o botão
      var tip = on ? onPanel(8, -205, 0.25) : [4.6, 0.9, 1.4];
      marks.cursor = [s.n, 0];
      for (i = 0, p = cnt(500); i < p; i++) {
        var u = r(), v = r() * (1 - u) * 0.62;
        if (r() < 0.35) v = r() < 0.5 ? 0 : (1 - u) * 0.62;
        s.put(tip[0] + v * 0.5, tip[1] - u * 0.62 - v * 0.12, tip[2] + 0.02, 1, 1.25);
      }
      marks.cursor[1] = s.n;
      // estrutura da cabine: quatro longarinas que se encontram à frente e um arco
      for (i = 0, p = cnt(5200); i < p; i++) {
        var t = r(), e = Math.floor(r() * 5);
        if (e < 4) { var sx = e % 2 ? 1 : -1, low = e < 2; s.put(sx * lerp(low ? 6.4 : 4.2, 0.5, t), lerp(low ? -1.6 : 4.6, 3.1, t), lerp(low ? 1.0 : 3.6, -12, t), 0.3, 0.6); }
        else { a = r() * PI; s.put(Math.cos(a) * 5.6, -1.4 + Math.sin(a) * 5.6, -0.6, 0.22, 0.6); }
      }
      // mira no para-brisa
      for (i = 0, p = cnt(1300); i < p; i++) {
        a = r() * 2 * PI; var pick = r(), rad = pick < 0.55 ? 0.9 : pick < 0.75 ? 0.26 : 1.0 + r() * 0.45;
        if (rad > 0.95) a = Math.round(a / (PI / 2)) * (PI / 2);
        s.put(Math.cos(a) * rad, 2.1 + Math.sin(a) * rad, -5, -1, 0.9);
      }
      // estrelas vindo de frente, em riscos
      while (s.n < N) {
        var sxp = (r() - 0.5) * 56, syp = 1.5 + (r() - 0.35) * 30, sz = -10 - r() * 70, ph = r(), h = r() < 0.25 ? -1 : 0.4 + r() * 0.6;
        for (var q = 0; q < 10 && s.n < N; q++) { s.put(sxp, syp, sz - q * 0.5, h, 1.1); s.flowLast(0, 0, 70, ph + q * 0.004); }
      }
      return s;
    }

    // ---------- As cenas ----------
    var lang = document.documentElement.lang === 'pt-BR' ? 'pt' : 'en';
    var MSG = { en: ["LET'S BUILD", 'YOUR EXPERIENCE'], pt: ['VAMOS CRIAR', 'A SUA EXPERIÊNCIA'] };
    var upData = chess({ lift: true, prey: 'stand', sparks: 0, dust: true }), codeData = code();
    var hero = sq(HERO[0], HERO[1]), land = sq(LAND[0], LAND[1]), pit = sq(HOLE[0], HOLE[1]);
    // Cada cena: dados, onda, pulso, tamanho do ponto, brilho, variação de tamanho, desfoque e câmera
    var shapes = {
      wave: { data: wave(), wave: 1, pulse: 0, size: 0.085, gain: 0.86, vary: 1, dof: 0.07, cam: { az: 0, el: 25, r: 10.5, t: [0, 0.2, 0], ox: 0 } },
      plate: { data: plate(), wave: 0, pulse: 0, size: 0.05, gain: 1.0, vary: 0.15, dof: 0.05, cam: { az: 32, el: 31, r: 20, t: [0, 0, 0], ox: 0.1 } },
      boardFlat: { data: chess({ lift: false, prey: 'stand', sparks: 0, dust: false }), wave: 0, pulse: 0, size: 0.05, gain: 0.95, vary: 0.2, dof: 0.05, cam: { az: 36, el: 33, r: 17, t: [0, 0, 0], ox: 0.08 } },
      boardUp: { data: upData, wave: 0, pulse: 0, size: 0.046, gain: 0.72, vary: 0.6, dof: 0.06, cam: { az: 48, el: 25, r: 14, t: [0, 0.4, 0], ox: 0.08 } },
      boardClose: { data: upData, wave: 0, pulse: 0, size: 0.034, gain: 0.62, vary: 0.6, dof: 0.3, cam: { az: 78, el: 9, r: 4.7, t: [hero[0], 0.78, hero[1]], ox: 0.05 } },
      boardCap: { data: chess({ lift: true, cap: true, prey: 'hit', sparks: 1, dust: true }), wave: 0, pulse: 0, size: 0.034, gain: 0.62, vary: 0.6, dof: 0.3, cam: { az: 70, el: 11, r: 5.2, t: [land[0], 0.8, land[1]], ox: 0.04 } },
      boardFall: { data: chess({ lift: true, cap: true, prey: 'fall', sparks: 2, dust: true }), wave: 0, pulse: 0, size: 0.04, gain: 0.66, vary: 0.6, dof: 0.2, cam: { az: 60, el: 66, r: 4.4, t: [pit[0], -0.9, pit[1]], ox: 0 } },
      shaftTop: { data: shaft(0), wave: 0, pulse: 0, size: 0.075, gain: 0.7, vary: 1, dof: 0.07, rate: 0.12, cam: { az: 0, el: 3, r: 17, t: [0, 0.6, 0], ox: 0.1 } },
      shaftLow: { data: shaft(1), wave: 0, pulse: 0, size: 0.075, gain: 0.7, vary: 1, dof: 0.07, rate: 0.12, cam: { az: 6, el: 0, r: 16.5, t: [0, -0.4, 0], ox: 0.1 } },
      blast: { data: space(false), wave: 0, pulse: 0, size: 0.055, gain: 0.66, vary: 1, dof: 0.04, rate: 0.6, cam: { az: 22, el: 8, r: 16, t: [0.4, -1.2, 0], ox: 0.1 } },
      ship: { data: space(true), wave: 0, pulse: 0, size: 0.052, gain: 0.64, vary: 1, dof: 0.05, rate: 0.5, cam: { az: 38, el: 14, r: 14.5, t: [0.9, 0.2, 0], ox: 0.1 } },
      code: { data: codeData, wave: 0, pulse: 0, size: 0.046, gain: 0.6, vary: 0.5, dof: 0.04, rate: 0.5, cam: { az: 0, el: 0, r: 18.5, t: [0, 0.3, 0], ox: 0.13 } },
      approach: { data: codeData, wave: 0, pulse: 0, size: 0.022, gain: 0.5, vary: 0.6, dof: 0.2, rate: 0.5, cam: { az: -61, el: 15, r: 3.0, t: [3.5, 3.75, -1.55], ox: 0 } },
      cockpit: { data: cockpit(false, MSG[lang]), wave: 0, pulse: 0, size: 0.05, gain: 0.56, vary: 0.5, dof: 0.03, rate: 0.55, cam: { az: 0, el: 24, r: 13, t: [0, -0.7, -0.3], ox: 0.04, oy: -0.05 } },
      cockpitOn: { data: cockpit(true, MSG[lang]), wave: 0, pulse: 0, size: 0.046, gain: 0.6, vary: 0.5, dof: 0.03, rate: 0.55, cam: { az: 0, el: 31, r: 8.2, t: [0, -1.45, -0.5], ox: 0, oy: -0.03 } }
    };
    var loaded = '';
    document.addEventListener('langchange', function (e) {
      lang = e.detail === 'pt' ? 'pt' : 'en';
      shapes.cockpitOn.data = cockpit(true, MSG[lang]);
      loaded = '';
    });

    // Papel de cada ponto numa passagem: [atraso 0..1, arco do salto, turbulência]
    function fxDefault() { var a = new Float32Array(N * 3), r = rng(5); for (var i = 0; i < N; i++) { a[i * 3] = r(); a[i * 3 + 2] = 1; } return a; }
    function fill(a, range, d, arc, turb, r, spread) { for (var i = range[0]; i < range[1]; i++) { a[i * 3] = d + (r ? r() * (spread || 0) : 0); a[i * 3 + 1] = arc; a[i * 3 + 2] = turb; } }
    var FX = { swarm: fxDefault() };
    (function () {
      var r = rng(8), a, i;
      a = FX.calm = fxDefault(); for (i = 0; i < N; i++) a[i * 3 + 2] = 0.5;        // tabuleiro se forma: revoada calma
      a = FX.rise = new Float32Array(N * 3);                                         // peças sobem em onda, das brancas para as pretas
      SET.forEach(function (p) { fill(a, p.range, clamp(p.r / 7 * 0.7 + (p.f / 7) * 0.12 + r() * 0.08, 0, 1), 0, 0); });
      fill(a, marks.dust, 0.5, 0, 0.3, r, 0.5);
      FX.still = new Float32Array(N * 3);                                            // só a câmera se move
      a = FX.capture = new Float32Array(N * 3);                                      // o cavalo salta; o peão e as faíscas reagem no impacto
      fill(a, marks.hero, 0, 1, 0); fill(a, marks.prey, 0.92, 0, 0); fill(a, marks.sparks, 0.9, 0, 0.25, r, 0.1);
      a = FX.fall = new Float32Array(N * 3);                                         // a casa se desfaz e o peão despenca
      fill(a, marks.hole, 0, 0, 0.5, r, 0.45); fill(a, marks.prey, 0.1, 0, 0); fill(a, marks.sparks, 0, 0, 0.3, r, 0.3);
      a = FX.shots = new Float32Array(N * 3);                                        // raios viram tiros, que estilhaçam o peão
      fill(a, [0, nSky], 0, 0, 0.3, r, 0.35); fill(a, [nSky, nSky + nPawn], 0.55, 0, 0.5, r, 0.15); fill(a, [nSky + nPawn, N], 0, 0, 0.7, r, 0.6);
      a = FX.toCode = fxDefault(); fill(a, [nSky + nPawn, N], 0, 0, 0);              // o caça segue inteiro; o resto vira código
      a = FX.click = new Float32Array(N * 3);                                        // o cursor chega, o botão acende, a tela muda
      fill(a, marks.cursor, 0, 0, 0); fill(a, marks.button, 0.55, 0, 0.1); fill(a, marks.screen, 0.6, 0, 0.5, r, 0.4);
    })();

    // ---------- Geometria e material ----------
    var geom = new T.BufferGeometry(), r0 = rng(77), seeds = new Float32Array(N * 4), ZERO4 = new Float32Array(N * 4);
    for (var i = 0; i < N * 4; i++) seeds[i] = r0();
    function dyn(size) { var a = new T.BufferAttribute(new Float32Array(N * size), size); a.setUsage(T.DynamicDrawUsage); return a; }
    var aFrom = dyn(3), aTo = dyn(3), aCF = dyn(3), aCT = dyn(3), aFF = dyn(4), aFT = dyn(4), aFx = dyn(3);
    geom.setAttribute('position', aFrom); geom.setAttribute('aTo', aTo);
    geom.setAttribute('aColFrom', aCF); geom.setAttribute('aColTo', aCT);
    geom.setAttribute('aFlowFrom', aFF); geom.setAttribute('aFlowTo', aFT); geom.setAttribute('aFx', aFx);
    geom.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));

    var U = {
      uMix: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1000 }, uTurb: { value: 1 }, uStagger: { value: 0.7 }, uArc: { value: 0 },
      uFocus: { value: 16 }, uDof: { value: 0.07 }, uRate: { value: new T.Vector2(0.3, 0.3) },
      uA: { value: new T.Vector4() }, uB: { value: new T.Vector4() }, uGain: { value: 0.6 }, uVary: { value: 1 },
      uPointer: { value: new T.Vector3(99, 99, 99) }, uPointerK: { value: 0 }
    };
    var mat = new T.ShaderMaterial({
      uniforms: U, transparent: true, depthTest: false, depthWrite: false,
      blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor,
      vertexShader: [
        'attribute vec3 aTo; attribute vec3 aColFrom; attribute vec3 aColTo; attribute vec4 aFlowFrom; attribute vec4 aFlowTo; attribute vec3 aFx; attribute vec4 aSeed;',
        'uniform float uMix, uTime, uPx, uTurb, uStagger, uArc, uFocus, uDof, uPointerK, uVary; uniform vec2 uRate; uniform vec4 uA, uB; uniform vec3 uPointer;',
        'varying vec3 vCol; varying float vA;',
        // k.x = altura da onda, k.y = pulso radial; flow = trajeto em laço do ponto
        'vec3 form(vec3 p, vec4 k, vec4 flow, float rate, out float crest, out float vis) {',
        '  float w = sin(p.x * 0.42 + uTime * 0.55) * 0.5 + sin(p.z * 0.8 + p.x * 0.27 - uTime * 0.8) * 0.36 + sin((p.x - p.z) * 0.21 + uTime * 0.33) * 0.62;',
        '  crest = w * k.x; p.y += w * k.x;',
        '  float r = length(p);',
        '  p += (p / max(r, 0.001)) * k.y * (0.5 + 0.5 * sin(uTime * 1.7 - r * 1.5 + aSeed.w * 6.283)) * 0.24;',
        '  float f = fract(uTime * rate + flow.w);',
        '  float moving = step(0.0001, dot(flow.xyz, flow.xyz));',
        '  p += flow.xyz * (f - 0.5);',
        '  vis = mix(1.0, sin(f * 3.14159265), moving);',
        '  return p;',
        '}',
        'void main() {',
        '  float t = clamp(uMix * (1.0 + uStagger) - aFx.x * uStagger, 0.0, 1.0);',
        '  t = t * t * (3.0 - 2.0 * t);',
        '  float ca; float cb; float va; float vb;',
        '  vec3 a = form(position, uA, aFlowFrom, uRate.x, ca, va); vec3 b = form(aTo, uB, aFlowTo, uRate.y, cb, vb);',
        '  vec3 p = mix(a, b, t);',
        '  float k = sin(t * 3.14159265);',
        '  p.y += k * aFx.y * uArc;',
        '  vec3 n = vec3(sin(aSeed.w * 41.0 + uTime * 0.9 + p.y * 0.7), cos(aSeed.x * 37.0 + uTime * 0.8 + p.x * 0.6), sin(aSeed.z * 53.0 + uTime * 0.7 + p.z * 0.8));',
        '  p += n * k * uTurb * aFx.z;',
        '  p += 0.012 * vec3(sin(uTime * 1.3 + aSeed.w * 50.0), cos(uTime * 1.1 + aSeed.x * 50.0), sin(uTime * 0.9 + aSeed.z * 50.0));',
        '  vec3 dp = p - uPointer; float d = length(dp);',
        '  p += (dp / max(d, 0.001)) * uPointerK * smoothstep(2.3, 0.0, d);',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  float depth = -mv.z;',
        '  float coc = clamp(abs(depth - uFocus) * uDof, 0.0, 2.4);',
        '  float size = mix(uA.w, uB.w, t) * mix(1.0, 0.65 + aSeed.z * 0.8, uVary) * (1.0 + k * 0.5 * aFx.z) * (1.0 + coc);',
        '  gl_PointSize = max(1.5, size * uPx / max(depth, 0.1));',
        '  vCol = mix(aColFrom, aColTo, t) * (1.0 + mix(ca, cb, t) * 0.6);',
        '  vA = mix(va, vb, t) * smoothstep(0.25, 1.6, depth) * smoothstep(150.0, 60.0, depth) / (1.0 + coc * coc * 1.5);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vCol; varying float vA; uniform float uGain;',
        'void main() {',
        '  float r = length(gl_PointCoord - 0.5) * 2.0;',
        '  float a = smoothstep(1.0, 0.0, r); a *= a;',
        '  float g = a * vA * uGain;',
        '  gl_FragColor = vec4(vCol * g, g * 0.85);',
        '}'
      ].join('\n')
    });
    var points = new T.Points(geom, mat); points.frustumCulled = false; scene.add(points);

    // ---------- Estado ----------
    var W = 1, H = 1, time = 0, beats = [], view = { dolly: 0, settle: 0 };
    var ray = new T.Vector3(), fwd = new T.Vector3(), hit = new T.Vector3();

    function load(beat) {
      var a = shapes[beat.from].data, b = shapes[beat.to].data;
      aFrom.array.set(a.pos); aTo.array.set(b.pos); aCF.array.set(a.col); aCT.array.set(b.col);
      aFF.array.set(a.flow || ZERO4); aFT.array.set(b.flow || ZERO4); aFx.array.set(FX[beat.fx || 'swarm']);
      [aFrom, aTo, aCF, aCT, aFF, aFT, aFx].forEach(function (x) { x.needsUpdate = true; });
      loaded = beat.from + '>' + beat.to + '>' + (beat.fx || 'swarm');
    }

    function resize() {
      W = canvas.clientWidth || 1; H = canvas.clientHeight || 1;
      var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
      var aspect = W / H, base = 35, hfov = 2 * Math.atan(Math.tan(base * PI / 360) * 1.3);
      camera.aspect = aspect;
      camera.fov = aspect >= 1.3 ? base : Math.min(78, 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / PI);
      camera.updateProjectionMatrix();
      U.uPx.value = H * dpr / (2 * Math.tan(camera.fov * PI / 360));
    }

    // u: posição da rolagem em telas; ptr: cursor { x, y de -1 a 1, k força }
    function frame(dt, u, ptr) {
      var j = 0; while (j < beats.length - 1 && u >= beats[j + 1].a) j++;
      var beat = beats[j], f = clamp((u - beat.a) / (beat.b - beat.a), 0, 1), mix, fade = 1;
      if (beat.cut) { mix = f < 0.5 ? 0 : 1; fade = Math.abs(f - 0.5) * 2; fade *= fade; }
      else mix = f * f * (3 - 2 * f);
      if (beat.from + '>' + beat.to + '>' + (beat.fx || 'swarm') !== loaded) load(beat);
      if (!opts.frozen) time += dt;
      var A = shapes[beat.from], B = shapes[beat.to], m = mix * mix * (3 - 2 * mix);
      U.uMix.value = mix; U.uTime.value = time;
      U.uTurb.value = beat.turb === undefined ? 1 : beat.turb; U.uStagger.value = beat.stagger === undefined ? 0.7 : beat.stagger; U.uArc.value = beat.arc || 0;
      U.uA.value.set(A.wave, A.pulse, 0, A.size); U.uB.value.set(B.wave, B.pulse, 0, B.size);
      U.uRate.value.set(A.rate || 0.3, B.rate || 0.3);
      U.uGain.value = lerp(A.gain, B.gain, m) * fade; U.uVary.value = lerp(A.vary, B.vary, m); U.uDof.value = lerp(A.dof, B.dof, m);

      var ca = A.cam, cb = B.cam, tall = camera.aspect < 1;
      var near = tall ? lerp(beat.from === 'wave' ? 1 : 0.84, beat.to === 'wave' ? 1 : 0.84, m) : 1;
      var az = (lerp(ca.az, cb.az, m) + ptr.x * 2.4) * PI / 180, el = (lerp(ca.el, cb.el, m) - ptr.y * 1.5) * PI / 180;
      var r = lerp(ca.r, cb.r, m) * near - view.dolly;
      var tx = lerp(ca.t[0], cb.t[0], m), ty = lerp(ca.t[1], cb.t[1], m), tz = lerp(ca.t[2], cb.t[2], m);
      camera.position.set(tx + r * Math.cos(el) * Math.sin(az), ty + r * Math.sin(el), tz + r * Math.cos(el) * Math.cos(az));
      camera.lookAt(tx, ty, tz);
      var ox = tall ? 0 : lerp(ca.ox, cb.ox, m), oy = tall ? -0.11 * view.settle : lerp(ca.oy || 0, cb.oy || 0, m);
      camera.setViewOffset(W, H, -ox * W, -oy * H, W, H);
      camera.updateMatrixWorld();
      U.uFocus.value = r;

      // O cursor empurra os pontos: acha onde ele toca o plano que passa pelo alvo da câmera
      camera.getWorldDirection(fwd);
      ray.set(ptr.x, -ptr.y, 0.5).unproject(camera).sub(camera.position).normalize();
      var den = ray.dot(fwd);
      if (den > 0.0001 && ptr.k > 0) {
        var dist = (hit.set(tx, ty, tz).sub(camera.position).dot(fwd)) / den;
        U.uPointer.value.copy(camera.position).addScaledVector(ray, dist);
        U.uPointerK.value = ptr.k * Math.min(1, r / 12);
      } else U.uPointerK.value = 0;

      renderer.render(scene, camera);
    }

    resize();
    return {
      frame: frame, resize: resize, view: view, count: N,
      setBeats: function (list) { beats = list; loaded = ''; },
      renderer: renderer
    };
  }

  window.HRMatter = { create: create };
})();
