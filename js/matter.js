// ===== O motor de partículas =====
// Um único campo de pontos de luz que o filme molda, cena por cena. Este arquivo é só o motor:
// paletas, a "forma" (posição, cor e fluxo de cada ponto), o shader, a câmera e o laço de desenho.
// As cenas ficam em arquivos separados, que se registram em window.HRFilm:
//   film-intro.js   mar de luz e baseplate
//   film-chess.js   tabuleiro, peças, captura e o tabuleiro estilhaçando
//   film-gun.js     queda em câmera lenta, tiros, a arma, o código e a HUD
// As passagens entre cenas (lista "beats") e os planos de câmera (lista "shots") ficam em js/main.js.
// Nada aqui é imagem ou modelo externo: tudo é gerado por código.
(function () {
  'use strict';
  var T = window.THREE, PI = Math.PI;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Paletas ----------
  // Cada paleta tem duas rampas de cinco cores, do escuro ao claro:
  //   main  a cor principal (mar, tabuleiro, peças brancas, arma, HUD)
  //   rival o contraponto (peças douradas, raios e tiros, destaques)
  var ICE = [[0.03, 0.08, 0.30], [0.07, 0.33, 0.95], [0.20, 0.72, 1.0], [0.72, 0.93, 1.0], [1, 1, 1]];
  var FIRE = [[0.36, 0.05, 0.10], [0.92, 0.22, 0.16], [1.0, 0.50, 0.14], [1.0, 0.78, 0.36], [1.0, 0.96, 0.86]];
  var PEARL = [[0.10, 0.11, 0.15], [0.34, 0.38, 0.46], [0.62, 0.67, 0.76], [0.86, 0.89, 0.94], [1, 1, 1]];
  var GOLD = [[0.30, 0.17, 0.04], [0.72, 0.45, 0.10], [1.0, 0.72, 0.26], [1.0, 0.88, 0.58], [1.0, 0.97, 0.88]];
  var TEAL = [[0.02, 0.16, 0.20], [0.04, 0.46, 0.52], [0.18, 0.80, 0.78], [0.70, 0.97, 0.93], [1, 1, 1]];
  var VIOLET = [[0.10, 0.05, 0.34], [0.42, 0.22, 0.98], [0.36, 0.62, 1.0], [0.62, 0.95, 0.98], [1, 1, 1]];
  var ROSE = [[0.35, 0.03, 0.20], [0.95, 0.15, 0.50], [1.0, 0.45, 0.55], [1.0, 0.78, 0.70], [1.0, 0.96, 0.92]];
  var PALETTES = {
    perola: { main: PEARL, rival: GOLD },   // branco e dourado: a paleta do site
    gelo: { main: ICE, rival: FIRE },       // azul gelo com fogo
    aurora: { main: VIOLET, rival: ROSE },  // violeta e ciano com rosa
    ouro: { main: GOLD, rival: TEAL },      // ouro com verde-água
    brasa: { main: FIRE, rival: ICE }       // a primeira versão: brasa com azul
  };
  function ramp(list, t, k) {
    t = clamp(t, 0, 1) * (list.length - 1);
    var j = Math.min(list.length - 2, Math.floor(t)), f = t - j, a = list[j], b = list[j + 1]; k = k === undefined ? 1 : k;
    return [lerp(a[0], b[0], f) * k, lerp(a[1], b[1], f) * k, lerp(a[2], b[2], f) * k];
  }
  // a mesma rampa, escrita direto no vetor de cores (sem criar um array por ponto)
  function rampTo(list, t, k, out, o) {
    t = clamp(t, 0, 1) * (list.length - 1);
    var j = Math.min(list.length - 2, Math.floor(t)), f = t - j, a = list[j], b = list[j + 1]; k = k === undefined ? 1 : k;
    out[o] = lerp(a[0], b[0], f) * k; out[o + 1] = lerp(a[1], b[1], f) * k; out[o + 2] = lerp(a[2], b[2], f) * k;
  }
  function css(c, alpha) { return 'rgba(' + Math.round(clamp(c[0], 0, 1) * 255) + ',' + Math.round(clamp(c[1], 0, 1) * 255) + ',' + Math.round(clamp(c[2], 0, 1) * 255) + ',' + (alpha === undefined ? 1 : alpha) + ')'; }

  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  // Ruído de valor. Pontos vizinhos caem quase sempre na mesma célula da grade, então cada oitava guarda os quatro
  // cantos da última célula que usou (c = [ix, iy, h00, h10, h01, h11]): o resultado é o mesmo, com muito menos senos.
  function vnoise(x, y, c) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    if (c[0] !== ix || c[1] !== iy) { c[0] = ix; c[1] = iy; c[2] = hash(ix, iy); c[3] = hash(ix + 1, iy); c[4] = hash(ix, iy + 1); c[5] = hash(ix + 1, iy + 1); }
    return lerp(lerp(c[2], c[3], fx), lerp(c[4], c[5], fx), fy);
  }
  var CELL = [[NaN, 0, 0, 0, 0, 0], [NaN, 0, 0, 0, 0, 0], [NaN, 0, 0, 0, 0, 0], [NaN, 0, 0, 0, 0, 0]];
  function fbm(x, y) { return vnoise(x, y, CELL[0]) * 0.5 + vnoise(x * 2.1, y * 2.1, CELL[1]) * 0.27 + vnoise(x * 4.3, y * 4.3, CELL[2]) * 0.15 + vnoise(x * 8.7, y * 8.7, CELL[3]) * 0.08; }

  // ---------- Rotações (quatérnios [x, y, z, w]) ----------
  var Q = {
    id: [0, 0, 0, 1],
    axis: function (x, y, z, a) { var l = Math.hypot(x, y, z) || 1, s = Math.sin(a / 2) / l; return [x * s, y * s, z * s, Math.cos(a / 2)]; },
    mul: function (a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; },
    // matriz 3x3 (em linhas) para girar muitos pontos de uma vez
    mat: function (q) {
      var x = q[0], y = q[1], z = q[2], w = q[3];
      return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
    },
    rot: function (q, v) { var m = Q.mat(q); return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
  };

  var FILM = window.HRFilm = window.HRFilm || [];   // cada film-*.js põe aqui uma função que registra suas cenas
  var GROUPS = 128;                                 // máximo de grupos rígidos numa passagem

  function create(canvas, opts) {
    opts = opts || {};
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance' }); }   // sem buffer de profundidade: os pontos só se somam
    catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);
    var small = Math.min(window.innerWidth, window.innerHeight) < 700;
    var modest = !small && (navigator.hardwareConcurrency || 8) <= 4;
    // total de pontos: 102 mil no computador, 62 mil em máquinas modestas, 40 mil no celular
    var SIDE = small ? 200 : modest ? 250 : 320, N = SIDE * SIDE;
    var K = N / 40000, SZ = 1 / Math.sqrt(K);                   // escala das quantidades e do tamanho dos pontos
    function cnt(n) { return Math.max(1, Math.round(n * K)); }

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(35, 1, 0.1, 400);
    var pal = PALETTES[opts.palette] || PALETTES.perola;

    // ---------- Uma forma: posição, cor e (opcional) fluxo de cada ponto ----------
    function Shape() { this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.flow = null; this.n = 0; }
    // h de 0 a 1: rampa principal. h de 2 a 3: rampa do contraponto. h negativo: destaque do contraponto. k: brilho.
    Shape.prototype.put = function (x, y, z, h, k) {
      if (this.n >= N) return -1;
      var i = this.n * 3;
      if (h < 0) rampTo(pal.rival, 0.72, k, this.col, i); else if (h >= 2) rampTo(pal.rival, h - 2, k, this.col, i); else rampTo(pal.main, h, k, this.col, i);
      this.pos[i] = x; this.pos[i + 1] = y; this.pos[i + 2] = z;
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

    // Amostra "count" pontos [x, y em px a partir do centro, r, g, b] de um desenho 2D, sorteados pela
    // opacidade. O sorteio é estratificado, para os traços saírem nítidos e sem falhas.
    function sample(cw, ch, count, seed, draw) {
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      draw(ctx, cw, ch);
      var d = ctx.getImageData(0, 0, cw, ch).data, cum = new Float32Array(cw * ch), acc = 0, r = rng(seed);
      for (var p = 0; p < cw * ch; p++) { var al = d[p * 4 + 3]; acc += al > 20 ? al : 0; cum[p] = acc; }
      var out = new Float32Array(count * 5), lo = 0, end = cw * ch - 1;
      for (var i = 0; i < count; i++) {
        // os sorteios saem em ordem crescente: basta seguir em frente na soma acumulada (o mesmo pixel que a busca binária daria)
        var t = (i + r()) / count * acc;
        while (lo < end && cum[lo] < t) lo++;
        var px = lo % cw, py = (lo - px) / cw;
        out[i * 5] = px + r() - cw / 2; out[i * 5 + 1] = -(py + r() - ch / 2);
        out[i * 5 + 2] = d[lo * 4] / 255; out[i * 5 + 3] = d[lo * 4 + 1] / 255; out[i * 5 + 4] = d[lo * 4 + 2] / 255;
      }
      cv.width = cv.height = 0;                                   // devolve a memória do desenho já (não espera o coletor de lixo)
      return out;
    }
    function rrect(ctx, x, y, w, h, rad) {
      ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    }

    // ---------- Registros: cenas, papéis dos pontos e movimentos rígidos ----------
    // cena: { make, steps, wave, size, gain, vary, dof, rate | clock, strobe }  (a câmera não é da cena: ver "Câmera" abaixo)
    //   steps (opcional): partes pesadas da cena (por exemplo, cada desenho 2D amostrado) como funções separadas; o preparo em
    //   segundo plano roda uma por vez e entrega os resultados a make(prontos). Sem preparo, make() chama os passos ela mesma.
    // fx (papel de cada ponto numa passagem): Float32Array(N * 4) com [atraso 0..1 (negativo: sem escalonamento), arco, turbulência, grupo]
    // rig (movimento rígido de cada grupo): ver rigRow
    var shapes = {}, FXMAKE = {}, FX = {}, RIGMAKE = {}, RIG = {}, anchors = {}, loaded = '', ORIGIN = [0, 0, 0];
    var subjects = { origin: { at: function () { return ORIGIN; } } };
    function need(name) {
      if (!shapes[name]) registerAll();
      var sh = shapes[name];
      if (!sh.data) { sh.data = sh.make(sh.held && sh.steps && sh.held.length === sh.steps.length ? sh.held : null); sh.held = null; }
      return sh.data;
    }
    function forget(name) { shapes[name].data = null; shapes[name].held = null; }
    function fxDefault(turb) { var a = new Float32Array(N * 4), r = rng(5); for (var i = 0; i < N; i++) { a[i * 4] = r(); a[i * 4 + 2] = turb === undefined ? 1 : turb; } return a; }
    FXMAKE.swarm = function () { return fxDefault(1); };       // revoada: cada ponto no seu tempo
    FXMAKE.calm = function () { return fxDefault(0.5); };      // revoada calma
    FXMAKE.still = function () { return new Float32Array(N * 4); };   // tudo junto, em linha reta
    function fx(name) { if (!FXMAKE[name]) registerAll(); return FX[name] || (FX[name] = FXMAKE[name]()); }
    function rig(name) { if (!RIGMAKE[name]) registerAll(); return RIG[name] || (RIG[name] = RIGMAKE[name]()); }

    // ---------- Preparo em segundo plano ----------
    // Trabalhos pesados (registrar as cenas do xadrez e da arma, gerar as próximas cenas) entram numa fila e rodam um
    // de cada vez, com quadros entre eles, para nenhum segurar o filme por muito tempo.
    var jobs = [], jobTimer = 0, started = false;                 // a fila só começa a andar depois do primeiro quadro
    function later(fn) { jobs.push(fn); if (started && !jobTimer) jobTimer = setTimeout(runJob, 60); }
    function runJob() { jobTimer = 0; var fn = jobs.shift(); if (fn) fn(); if (jobs.length) jobTimer = setTimeout(runJob, 30); }
    // Gera uma cena em segundo plano: um passo por vez e, no fim, a montagem
    function warm(name) {
      later(function () {
        if (!shapes[name]) registerAll();
        var sh = shapes[name]; if (sh.data) return;
        var held = sh.steps ? (sh.held = []) : null, list = [];
        if (held) sh.steps.forEach(function (step) { list.push(function () { if (sh.held === held && !sh.data) held.push(step()); }); });
        list.push(function () { need(name); });
        jobs = list.concat(jobs);                                 // os passos desta cena passam na frente do resto da fila
      });
    }
    // Um grupo gira "ang" em torno de "axis" enquanto o pivô vai de pa a pb; lift é a altura do salto no meio do caminho
    function rigRow(arr, id, pa, pb, axis, ang, lift) {
      var o = id * 4, w = GROUPS * 4;
      arr[o] = pa[0]; arr[o + 1] = pa[1]; arr[o + 2] = pa[2];
      arr[w + o] = pb[0]; arr[w + o + 1] = pb[1]; arr[w + o + 2] = pb[2];
      arr[2 * w + o] = axis[0]; arr[2 * w + o + 1] = axis[1]; arr[2 * w + o + 2] = axis[2]; arr[2 * w + o + 3] = ang;
      arr[3 * w + o] = lift || 0;
    }
    var rigData = new Float32Array(GROUPS * 4 * 4);
    var rigTex = new T.DataTexture(rigData, GROUPS, 4, T.RGBAFormat, T.FloatType);
    rigTex.magFilter = rigTex.minFilter = T.NearestFilter; rigTex.needsUpdate = true;

    var E = {
      N: N, K: K, small: small, cnt: cnt, rng: rng, lerp: lerp, clamp: clamp, fbm: fbm, Q: Q, Shape: Shape, sample: sample, rrect: rrect,
      GROUPS: GROUPS, rigRow: rigRow, need: need, fxDefault: fxDefault,
      MONO: 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace',
      SANS: '"Archivo", "Helvetica Neue", Arial, sans-serif',
      pc: function (t, alpha) { return css(ramp(pal.main, t), alpha); },      // cor principal, para desenhos 2D
      rc: function (t, alpha) { return css(ramp(pal.rival, t), alpha); },     // cor do contraponto
      scene: function (name, def) { shapes[name] = def; },
      fx: function (name, make) { FXMAKE[name] = make; },
      rig: function (name, make) { RIGMAKE[name] = make; },
      anchor: function (name, at) { anchors[name] = at; },                    // ponto da cena que o HTML pode seguir (etiquetas)
      subject: function (name, def) { subjects[name] = def; },                // ponto do cenário que a câmera pode seguir (ver "Câmera")
      drop: function (name) { if (shapes[name]) forget(name); loaded = ''; },
      lang: document.documentElement.lang === 'pt-BR' ? 'pt' : 'en',
      portrait: window.innerWidth / window.innerHeight < 0.9,
      time: { shaft: 0, snap: 1e9 }                                           // marcas do filme que as cenas precisam (ver setBeats)
    };
    // As cenas de abertura (o primeiro film-*.js da página) são registradas já. As outras só são preparadas depois do
    // primeiro quadro, em segundo plano (ou na hora, se o filme precisar delas antes): o nome aparece mais cedo.
    var pending = FILM.slice(1);
    function registerAll() { while (pending.length) pending.shift()(E); }
    FILM[0](E);
    pending.forEach(function () { later(function () { if (pending.length) pending.shift()(E); }); });   // um arquivo de cenas por vez
    document.addEventListener('langchange', function (e) { E.lang = e.detail === 'pt' ? 'pt' : 'en'; Object.keys(shapes).forEach(function (k) { if (shapes[k].text) forget(k); }); loaded = ''; });

    // ---------- Geometria e material ----------
    var geom = new T.BufferGeometry(), r0 = rng(77), seeds = new Float32Array(N * 4);
    for (var i = 0; i < N * 4; i++) seeds[i] = r0();
    function dyn(size) { var a = new T.BufferAttribute(new Float32Array(N * size), size); a.setUsage(T.DynamicDrawUsage); return a; }
    var aFrom = dyn(3), aTo = dyn(3), aCF = dyn(3), aCT = dyn(3), aFF = dyn(4), aFT = dyn(4), aFx = dyn(4);
    geom.setAttribute('position', aFrom); geom.setAttribute('aTo', aTo);
    geom.setAttribute('aColFrom', aCF); geom.setAttribute('aColTo', aCT);
    geom.setAttribute('aFlowFrom', aFF); geom.setAttribute('aFlowTo', aFT); geom.setAttribute('aFx', aFx);
    geom.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));

    var U = {
      uMix: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1000 }, uTurb: { value: 1 }, uStagger: { value: 0.7 }, uArc: { value: 0 }, uEase: { value: 0 }, uFloor: { value: -1e6 },
      uFocus: { value: 16 }, uDof: { value: 0.07 }, uClock: { value: new T.Vector2(0, 0) }, uRig: { value: rigTex },
      uA: { value: new T.Vector4() }, uB: { value: new T.Vector4() }, uGain: { value: 0.6 }, uVary: { value: 1 },
      uMaxPt: { value: renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1] }   // maior ponto que esta GPU desenha
    };
    var CUT = '0.00176';                                        // 0.45 / 255: abaixo disso um fragmento não muda a cor de um pixel de 8 bits
    var VERT = [
      'attribute vec3 aTo; attribute vec3 aColFrom; attribute vec3 aColTo; attribute vec4 aFlowFrom; attribute vec4 aFlowTo; attribute vec4 aFx; attribute vec4 aSeed;',
      'uniform float uMix, uTime, uPx, uTurb, uStagger, uArc, uEase, uFocus, uDof, uVary, uHalo, uFloor, uGain, uMaxPt; uniform vec2 uClock; uniform vec4 uA, uB; uniform sampler2D uRig;',
      'varying vec3 vCol; varying float vA; varying float vK;',
      // k.x = altura da onda; flow = trajeto em laço do ponto, percorrido conforme o relógio da cena.
      // flow.w >= 2 marca um ponto de clarão: nasce onde está, salta ao longo do vetor e some, k.y vezes por volta do relógio.
      'vec3 form(vec3 p, vec4 k, vec4 flow, float clock, out float crest, out float vis) {',
      '  float w = sin(p.x * 0.42 + uTime * 0.55) * 0.5 + sin(p.z * 0.8 + p.x * 0.27 - uTime * 0.8) * 0.36 + sin((p.x - p.z) * 0.21 + uTime * 0.33) * 0.62;',
      '  crest = w * k.x; p.y += w * k.x;',
      '  if (flow.w > 1.5) { float g = fract(clock * k.y + flow.w) * 3.0; vis = max(0.0, 1.0 - g); vis *= vis; return p + flow.xyz * min(g, 1.0); }',
      '  float f = fract(clock + flow.w);',
      '  float moving = step(0.0001, dot(flow.xyz, flow.xyz));',
      '  p += flow.xyz * (f - 0.5);',
      '  vis = mix(1.0, min(1.0, sin(f * 3.14159265) * 2.5), moving);',   // some só perto das pontas do trajeto
      '  return p;',
      '}',
      'vec3 spin(vec3 v, vec3 ax, float ang) { float c = cos(ang), s = sin(ang); return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c); }',
      'void main() {',
      // o halo usa só um quinto dos pontos, bem maiores e fracos: dá o brilho suave em volta das formas
      '  if (uHalo > 0.5 && aSeed.x > 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; return; }',
      // atraso negativo: o ponto ignora o escalonamento e acompanha a passagem inteira (o peão que a câmera segue)
      '  float t = aFx.x < 0.0 ? uMix : clamp(uMix * (1.0 + uStagger) - aFx.x * uStagger, 0.0, 1.0);',
      // curva da passagem: 0 suave nas duas pontas, 1 acelera (chega com velocidade), 2 freia (sai com velocidade), 3 constante
      '  if (uEase < 0.5) t = t * t * (3.0 - 2.0 * t); else if (uEase < 1.5) t = t * t; else if (uEase < 2.5) t = 1.0 - (1.0 - t) * (1.0 - t);',
      '  float ca; float cb; float va; float vb;',
      '  vec3 a = form(position, uA, aFlowFrom, uClock.x, ca, va); vec3 b = form(aTo, uB, aFlowTo, uClock.y, cb, vb);',
      '  float k = sin(t * 3.14159265);',
      '  vec3 p;',
      '  if (aFx.w > 0.5) {',                                    // ponto de um grupo rígido: gira em torno do pivô, que viaja de pa a pb
      '    float gx = (aFx.w + 0.5) / ' + GROUPS + '.0;',
      '    vec3 pa = texture2D(uRig, vec2(gx, 0.125)).xyz; vec3 pb = texture2D(uRig, vec2(gx, 0.375)).xyz;',
      '    vec4 ro = texture2D(uRig, vec2(gx, 0.625)); float lift = texture2D(uRig, vec2(gx, 0.875)).x;',
      '    p = mix(pa, pb, t) + spin(a - pa, ro.xyz, ro.w * t); p.y += k * lift;',
      '  } else p = mix(a, b, t);',
      '  p.y += k * aFx.y * uArc;',
      '  vec3 n = vec3(sin(aSeed.w * 41.0 + uTime * 0.9 + p.y * 0.7), cos(aSeed.x * 37.0 + uTime * 0.8 + p.x * 0.6), sin(aSeed.z * 53.0 + uTime * 0.7 + p.z * 0.8));',
      '  p += n * k * uTurb * aFx.z;',
      '  p += 0.008 * vec3(sin(uTime * 1.3 + aSeed.w * 50.0), cos(uTime * 1.1 + aSeed.x * 50.0), sin(uTime * 0.9 + aSeed.z * 50.0));',
      '  float above = smoothstep(uFloor - 0.03, uFloor + 0.03, p.y);',   // o que está abaixo do chão fica invisível (peças surgindo do tabuleiro)
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  float depth = -mv.z;',
      '  float coc = clamp(abs(depth - uFocus) * uDof, 0.0, 2.4);',
      '  float size = mix(uA.w, uB.w, t) * mix(1.0, 0.6 + aSeed.z * 0.9, uVary) * (1.0 + k * 0.5 * aFx.z) * (1.0 + coc) * mix(1.0, 5.0, uHalo);',
      '  float ps = size * uPx / max(depth, 0.1);',
      '  gl_PointSize = max(1.5, ps);',
      '  float twinkle = 0.82 + 0.18 * sin(uTime * (1.5 + aSeed.y * 2.5) + aSeed.w * 60.0);',
      '  vCol = mix(aColFrom, aColTo, t) * (1.0 + mix(ca, cb, t) * 0.6);',
      '  vA = above * twinkle * mix(va, vb, t) * smoothstep(0.25, 1.6, depth) * (1.0 - smoothstep(60.0, 150.0, depth)) / (1.0 + coc * coc * 1.5) * mix(1.0, 0.07, uHalo);',
      // pontos que ficam enormes na tela (muito perto da câmera) perdem brilho, para não virarem borrão branco
      '  if (uHalo < 0.5) vA *= min(1.0, pow(0.014 * uPx / gl_PointSize, 1.6)) * min(1.0, ps * ps / 2.25);',   // ... e os que ficariam menores que 1.5 px (muito longe) também
      // Corte de trabalho perdido (a imagem não muda). O buffer da tela tem 8 bits por canal: o que um fragmento soma abaixo de
      // meio nível (0.5 / 255) é arredondado para zero. "peak" é o máximo que este ponto soma, no centro dele.
      '  float peak = vA * uGain * max(0.85, max(vCol.r, max(vCol.g, vCol.b)));',
      '  vK = 1.0;',
      '  if (peak < ' + CUT + ') { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; return; }',   // ponto que não acende pixel nenhum: não é desenhado
      // ... e o quadrado de cada ponto encolhe até o raio em que o brilho dele cai abaixo desse meio nível
      // (halo: a = soft^3; ponto: a = 0.55 * soft^2 de 0.55 do raio para fora; soft = x * x * (3 - 2 * x), com x = 1 - r).
      '  float soft = uHalo > 0.5 ? pow(' + CUT + ' / peak, 1.0 / 3.0) : sqrt(' + CUT + ' / (0.55 * peak));',
      '  float rc = 0.5 + sin(asin(1.0 - 2.0 * min(soft, 1.0)) / 3.0);',
      '  if (uHalo < 0.5) rc = max(rc, 0.55);',
      '  float full = min(gl_PointSize, uMaxPt);',                                // o tamanho que a GPU desenharia de fato
      '  if (full * rc >= 2.0) { vK = rc; gl_PointSize = full * rc; }',
      '}'
    ].join('\n');
    var FRAG = [
      'varying vec3 vCol; varying float vA; varying float vK; uniform float uGain, uHalo;',
      'void main() {',
      '  float r = length(gl_PointCoord - 0.5) * 2.0 * vK;',                     // vK: quanto o quadrado do ponto foi encolhido (ver o vertex shader)
      '  float soft = 1.0 - smoothstep(0.0, 1.0, r);',
      // ponto: miolo nítido com borda macia; halo: só a mancha suave
      '  float a = mix(soft * soft * (0.55 + 0.45 * (1.0 - smoothstep(0.0, 0.55, r))), soft * soft * soft, uHalo);',
      '  float g = a * vA * uGain;',
      '  gl_FragColor = vec4(vCol * g, g * 0.85);',
      '}'
    ].join('\n');
    function material(halo) {
      var u = {}; Object.keys(U).forEach(function (k) { u[k] = U[k]; }); u.uHalo = { value: halo ? 1 : 0 };
      return new T.ShaderMaterial({
        uniforms: u, transparent: true, depthTest: false, depthWrite: false, vertexShader: VERT, fragmentShader: FRAG,
        blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor
      });
    }
    if (!small) { var halo = new T.Points(geom, material(true)); halo.frustumCulled = false; scene.add(halo); }
    var points = new T.Points(geom, material(false)); points.frustumCulled = false; scene.add(points);

    // O quadro parado de quem pediu menos movimento (ver frame) é refeito quando a aba volta a aparecer ou o navegador devolve o contexto WebGL
    document.addEventListener('visibilitychange', function () { lastKey = ''; });
    canvas.addEventListener('webglcontextrestored', function () { lastKey = ''; });

    // ---------- Estado ----------
    var W = 1, H = 1, time = 0, fireTime = 0, beats = [], view = { dolly: 0, settle: 0 }, lastBeat = -1, lastKey = '', heldPtr = { x: 0, y: 0 };
    var EASE = { io: 0, 'in': 1, out: 2, lin: 3 };
    function eased(f, mode) { return mode === 1 ? f * f : mode === 2 ? 1 - (1 - f) * (1 - f) : mode === 3 ? f : f * f * (3 - 2 * f); }
    function beatKey(b) { return b.from + '>' + b.to + '>' + (b.fx || 'swarm') + '>' + (b.rig || ''); }

    function load(beat, j) {
      var a = need(beat.from), b = need(beat.to);
      aFrom.array.set(a.pos); aTo.array.set(b.pos); aCF.array.set(a.col); aCT.array.set(b.col);
      if (a.flow) aFF.array.set(a.flow); else aFF.array.fill(0);
      if (b.flow) aFT.array.set(b.flow); else aFT.array.fill(0);
      aFx.array.set(fx(beat.fx || 'swarm'));
      [aFrom, aTo, aCF, aCT, aFF, aFT, aFx].forEach(function (x) { x.needsUpdate = true; });
      if (beat.rig) { rigData.set(rig(beat.rig)); rigTex.needsUpdate = true; }
      loaded = beatKey(beat); lastKey = '';
      // Guarda na memória só as cenas (e os papéis dos pontos) vizinhas; as outras são geradas de novo quando o filme chegar nelas
      var keep = { wave: 1, plate: 1 }, keepFx = {};
      for (var q = Math.max(0, j - 1); q <= Math.min(beats.length - 1, j + 2); q++) { keep[beats[q].from] = 1; keep[beats[q].to] = 1; keepFx[beats[q].fx || 'swarm'] = 1; }
      Object.keys(shapes).forEach(function (k) { if (!keep[k] && !shapes[k].keep) forget(k); });
      Object.keys(FX).forEach(function (k) { if (!keepFx[k]) delete FX[k]; });
      // ... e prepara as próximas em segundo plano, para a passagem seguinte não engasgar
      if (j !== lastBeat) {
        lastBeat = j;
        var nx = beats[Math.min(beats.length - 1, j + 1)], n2 = beats[Math.min(beats.length - 1, j + 2)];
        warm(nx.to); later(function () { fx(nx.fx || 'swarm'); }); warm(n2.to);
      }
    }

    // ---------- Câmera ----------
    // A câmera não pertence às cenas: é uma trilha de chaves ao longo do filme (lista "shots" em main.js).
    // Chave: { u, at, off, az, el, r, roll, fov, fd, ex, ox, oy, tall, stop }
    //   at   assunto que a câmera olha (registrado com E.subject pelos film-*.js); off desloca o alvo [x, y, z]
    //   az, el, r  giro em volta do alvo, altura (negativa = de baixo para cima) e distância
    //   roll inclinação do horizonte | fov abertura da lente (35 = normal; menor aproxima, maior abre)
    //   fd   quanto o foco fica além (+) ou aquém (-) do alvo | ex exposição (1 = normal; menos escurece o plano)
    //   ox, oy descentram o quadro (para a legenda caber)
    //   tall multiplica a distância em telas em pé | stop: a câmera para nesta chave
    // Entre as chaves a câmera segue uma curva suave, sem parar (a não ser em "stop" ou onde um valor muda de sentido).
    // Assunto: { at: function (cena) -> [x, y, z], group: grupo rígido com que ele viaja, delay: { fx: atraso } (-1 = a passagem inteira) }
    var track = [], NP = 13, camNow = new Float32Array(NP), camAt = [0, 0, 0], lensBase = 0, DPR = 1;
    function spinV(v, ax, ang) {
      var c = Math.cos(ang), sn = Math.sin(ang), d = (ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2]) * (1 - c);
      return [v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * sn + ax[0] * d, v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * sn + ax[1] * d, v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * sn + ax[2] * d];
    }
    // Onde está um assunto no instante u: parado numa cena ou, durante uma passagem, no mesmo movimento dos pontos dele
    function subjectAt(name, u) {
      if (!subjects[name]) registerAll();
      var def = subjects[name] || subjects.origin;
      if (!beats.length) return def.at('');
      var j = 0; while (j < beats.length - 1 && u >= beats[j + 1].a) j++;
      var beat = beats[j], f = clamp((u - beat.a) / (beat.b - beat.a), 0, 1);
      if (f <= 0) return def.at(beat.from);
      if (f >= 1) return def.at(beat.to);
      var st = beat.stagger === undefined ? 0.7 : beat.stagger, dl = def.delay && def.delay[beat.fx] !== undefined ? def.delay[beat.fx] : 0;
      var t = eased(dl < 0 ? f : clamp(f * (1 + st) - dl * st, 0, 1), EASE[beat.ease] || 0), a = def.at(beat.from);
      if (beat.rig && def.group) {
        var g = rig(beat.rig), o = def.group * 4, w = GROUPS * 4;
        var v = spinV([a[0] - g[o], a[1] - g[o + 1], a[2] - g[o + 2]], [g[2 * w + o], g[2 * w + o + 1], g[2 * w + o + 2]], g[2 * w + o + 3] * t);
        return [lerp(g[o], g[w + o], t) + v[0], lerp(g[o + 1], g[w + o + 1], t) + v[1] + Math.sin(t * PI) * g[3 * w + o], lerp(g[o + 2], g[w + o + 2], t) + v[2]];
      }
      var b = def.at(beat.to);
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    }
    function setShots(list) {
      track = list.map(function (k) {
        var off = k.off || ORIGIN;
        return { u: k.u, at: k.at || 'origin', stop: !!k.stop, m: new Float32Array(NP),
          v: [k.az || 0, k.el || 0, k.r === undefined ? 10 : k.r, k.roll || 0, k.fov || 35, k.ox || 0, k.oy || 0, k.tall === undefined ? 0.84 : k.tall, k.fd || 0, off[0], off[1], off[2], k.ex === undefined ? 1 : k.ex] };
      });
      for (var i = 1; i < track.length - 1; i++) {
        var a = track[i - 1], k = track[i], b = track[i + 1];
        if (k.stop) continue;
        for (var p = 0; p < NP; p++) {
          var d0 = (k.v[p] - a.v[p]) / (k.u - a.u), d1 = (b.v[p] - k.v[p]) / (b.u - k.u);
          if (d0 * d1 <= 0) continue;                                 // o valor muda de sentido aqui: a câmera para nesta chave
          var m = (b.v[p] - a.v[p]) / (b.u - a.u), lim = 3 * Math.min(Math.abs(d0), Math.abs(d1));
          k.m[p] = Math.abs(m) > lim ? (m < 0 ? -lim : lim) : m;      // velocidade ao passar pela chave, sem passar do ponto
        }
      }
    }
    function shotAt(u) {
      var n = track.length, i = 0; while (i < n - 2 && u >= track[i + 1].u) i++;
      var a = track[i], b = track[i + 1], h = b.u - a.u, q = clamp((u - a.u) / h, 0, 1), q2 = q * q, q3 = q2 * q;
      var h00 = 2 * q3 - 3 * q2 + 1, h10 = q3 - 2 * q2 + q, h01 = 3 * q2 - 2 * q3, h11 = q3 - q2;
      for (var p = 0; p < NP; p++) camNow[p] = h00 * a.v[p] + h10 * h * a.m[p] + h01 * b.v[p] + h11 * h * b.m[p];
      var at = subjectAt(a.at, u);
      if (a.at !== b.at) { var to = subjectAt(b.at, u), e = q2 * (3 - 2 * q); at = [lerp(at[0], to[0], e), lerp(at[1], to[1], e), lerp(at[2], to[2], e)]; }   // troca de assunto
      camAt[0] = at[0] + camNow[9]; camAt[1] = at[1] + camNow[10]; camAt[2] = at[2] + camNow[11];
    }
    // Lente: "base" é a abertura vertical em telas largas; em telas estreitas a abertura horizontal é mantida
    function lens(base) {
      if (Math.abs(base - lensBase) < 0.005) return;
      lensBase = base;
      var aspect = camera.aspect, hfov = 2 * Math.atan(Math.tan(base * PI / 360) * 1.3);
      camera.fov = aspect >= 1.3 ? base : Math.min(84, 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / PI);
      camera.updateProjectionMatrix();
      U.uPx.value = H * DPR / (2 * Math.tan(camera.fov * PI / 360));
    }

    function resize() {
      W = canvas.clientWidth || 1; H = canvas.clientHeight || 1;
      DPR = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);
      renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
      camera.aspect = W / H; lensBase = 0; lens(35); lastKey = '';
      var portrait = camera.aspect < 0.9;
      if (portrait !== E.portrait) { E.portrait = portrait; Object.keys(shapes).forEach(function (k) { if (shapes[k].layout) forget(k); }); loaded = ''; }
    }

    // Relógio do fluxo de uma cena. A queda corre em câmera lenta, presa à rolagem ("slow");
    // depois do estalo o tempo volta ao normal e passa a correr sozinho ("fire").
    function clockOf(sh, u) {
      var slow = clamp(u - E.time.shaft, 0, E.time.snap - E.time.shaft) * 0.05;
      if (sh.clock === 'slow') return slow;
      if (sh.clock === 'fire') return slow + fireTime * 1.5;
      return time * (sh.rate || 0.3);
    }

    // u: posição do filme em telas; ptr: cursor { x, y de -1 a 1 }, que só inclina a câmera de leve;
    // env: { flash, shake, ts } = clarão e tremor dos impactos e a escala de tempo (câmera lenta do filme automático)
    function frame(dt, u, ptr, env) {
      env = env || { flash: 0, shake: 0, ts: 1 };
      var j = 0; while (j < beats.length - 1 && u >= beats[j + 1].a) j++;
      var beat = beats[j], f = clamp((u - beat.a) / (beat.b - beat.a), 0, 1), mode = EASE[beat.ease] || 0;
      if (beatKey(beat) !== loaded) load(beat, j);
      // Com "menos movimento", ou com o filme pausado pelo visitante (hold: ver hold() em js/main.js), o tempo das
      // partículas fica parado: se nada mudou desde o último quadro, não há o que redesenhar
      var still = opts.frozen || env.hold;
      if (still) {
        var key = [u.toFixed(5), ptr.x.toFixed(4), ptr.y.toFixed(4), view.dolly.toFixed(4), view.settle.toFixed(4)].join('|');
        if (key === lastKey) return;
        lastKey = key;
      } else lastKey = '';
      if (!still) time += dt;
      if (u >= E.time.snap) { if (!still) fireTime += dt * env.ts; } else fireTime = 0;   // parado, os tiros ficam no ar
      var A = shapes[beat.from], B = shapes[beat.to], m = eased(f, mode);
      U.uMix.value = f; U.uTime.value = time; U.uEase.value = mode;
      U.uTurb.value = beat.turb === undefined ? 1 : beat.turb; U.uStagger.value = beat.stagger === undefined ? 0.7 : beat.stagger; U.uArc.value = beat.arc || 0;
      U.uFloor.value = beat.floor === undefined ? -1e6 : beat.floor;
      U.uA.value.set(A.wave || 0, A.strobe || 0, 0, A.size * SZ); U.uB.value.set(B.wave || 0, B.strobe || 0, 0, B.size * SZ);
      U.uClock.value.set(clockOf(A, u), clockOf(B, u));
      U.uGain.value = lerp(A.gain, B.gain, m) * (1 + env.flash); U.uVary.value = lerp(A.vary, B.vary, m); U.uDof.value = lerp(A.dof, B.dof, m);

      if (track.length > 1) { shotAt(u); U.uGain.value *= camNow[12]; }
      if (env.hold) ptr = heldPtr; else { heldPtr.x = ptr.x; heldPtr.y = ptr.y; }
      var tall = E.portrait, az = (camNow[0] + ptr.x * 1.0) * PI / 180, el = (camNow[1] - ptr.y * 0.7) * PI / 180;
      var r = Math.max(0.3, camNow[2] * (tall ? camNow[7] : 1) - view.dolly);
      lens(camNow[4] || 35);
      // tremor: o deslocamento já vem pronto de main.js (env.sx, env.sy); sem ele, vale a vibração antiga
      var sx = env.sx !== undefined ? env.sx : env.shake * Math.sin(u * 231), sy = env.sy !== undefined ? env.sy : env.shake * 0.7 * Math.sin(u * 197 + 1.3), tx = camAt[0] + sx, ty = camAt[1] + sy, tz = camAt[2];
      camera.position.set(tx + r * Math.cos(el) * Math.sin(az), ty + r * Math.sin(el), tz + r * Math.cos(el) * Math.cos(az));
      camera.lookAt(tx, ty, tz);
      if (camNow[3]) camera.rotateZ(camNow[3] * PI / 180);
      camera.setViewOffset(W, H, -(tall ? 0 : camNow[5]) * W, -(tall ? -0.11 * view.settle : camNow[6]) * H, W, H);
      camera.updateMatrixWorld();
      U.uFocus.value = Math.max(0.2, r + camNow[8]);
      renderer.render(scene, camera);
      if (!started) { started = true; if (jobs.length && !jobTimer) jobTimer = setTimeout(runJob, 60); }
    }

    // Posição na tela (px) de um ponto registrado com E.anchor, para etiquetas em HTML
    var v3 = new T.Vector3();
    function project(name) {
      if (!anchors[name]) registerAll();
      var p = anchors[name] && anchors[name](); if (!p) return null;
      v3.set(p[0], p[1], p[2]).project(camera);
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
    }

    resize();
    return {
      frame: frame, resize: resize, view: view, count: N, project: project, setShots: setShots,
      // recebe a lista de passagens; guarda os instantes em que a queda começa e em que o tempo volta ao normal
      setBeats: function (list) {
        beats = list; loaded = ''; lastBeat = -1;
        list.forEach(function (b) { if (b.mark === 'shaft') E.time.shaft = b.a; if (b.mark === 'snap') E.time.snap = b.a; });
      },
      // Troca a paleta: as cenas são geradas de novo, com as cores novas
      setPalette: function (name) {
        if (!PALETTES[name]) return;
        pal = PALETTES[name]; Object.keys(shapes).forEach(forget); loaded = '';
      },
      renderer: renderer
    };
  }

  window.HRMatter = { create: create, palettes: PALETTES };
})();
