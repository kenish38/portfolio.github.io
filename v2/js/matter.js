// ===== O motor de partículas =====
// Um único campo de pontos de luz que o filme molda, cena por cena. Este arquivo é só o motor:
// paletas, a "forma" (posição, cor e fluxo de cada ponto), o shader, a câmera e o laço de desenho.
// As cenas ficam em arquivos separados, que se registram em window.HRFilm:
//   film-intro.js   mar de luz e baseplate
//   film-chess.js   tabuleiro, peças, captura e o tabuleiro estilhaçando
//   film-gun.js     queda em câmera lenta, tiros, a arma, o código e a HUD
// As passagens entre cenas e os tempos ficam em js/main.js (lista "beats").
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
  function css(c, alpha) { return 'rgba(' + Math.round(clamp(c[0], 0, 1) * 255) + ',' + Math.round(clamp(c[1], 0, 1) * 255) + ',' + Math.round(clamp(c[2], 0, 1) * 255) + ',' + (alpha === undefined ? 1 : alpha) + ')'; }

  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
  }
  function fbm(x, y) { return vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.27 + vnoise(x * 4.3, y * 4.3) * 0.15 + vnoise(x * 8.7, y * 8.7) * 0.08; }

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
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' }); }
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
      var i = this.n * 3, c = h < 0 ? ramp(pal.rival, 0.72, k) : h >= 2 ? ramp(pal.rival, h - 2, k) : ramp(pal.main, h, k);
      this.pos[i] = x; this.pos[i + 1] = y; this.pos[i + 2] = z; this.col[i] = c[0]; this.col[i + 1] = c[1]; this.col[i + 2] = c[2];
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
      var out = new Float32Array(count * 5);
      for (var i = 0; i < count; i++) {
        var t = (i + r()) / count * acc, lo = 0, hi = cw * ch - 1;
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

    // ---------- Registros: cenas, papéis dos pontos e movimentos rígidos ----------
    // cena: { make, wave, size, gain, vary, dof, rate | clock, cam: { az, el, r, t: [x, y, z], ox, oy } }
    // fx (papel de cada ponto numa passagem): Float32Array(N * 4) com [atraso 0..1, arco, turbulência, grupo]
    // rig (movimento rígido de cada grupo): ver rigRow
    var shapes = {}, FXMAKE = {}, FX = {}, RIGMAKE = {}, RIG = {}, anchors = {}, loaded = '';
    function need(name) { var sh = shapes[name]; return sh.data || (sh.data = sh.make()); }
    function fxDefault(turb) { var a = new Float32Array(N * 4), r = rng(5); for (var i = 0; i < N; i++) { a[i * 4] = r(); a[i * 4 + 2] = turb === undefined ? 1 : turb; } return a; }
    FXMAKE.swarm = function () { return fxDefault(1); };       // revoada: cada ponto no seu tempo
    FXMAKE.calm = function () { return fxDefault(0.5); };      // revoada calma
    FXMAKE.still = function () { return new Float32Array(N * 4); };   // tudo junto, em linha reta
    function fx(name) { return FX[name] || (FX[name] = FXMAKE[name]()); }
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
      drop: function (name) { if (shapes[name]) shapes[name].data = null; loaded = ''; },
      lang: document.documentElement.lang === 'pt-BR' ? 'pt' : 'en',
      portrait: window.innerWidth / window.innerHeight < 0.9,
      time: { shaft: 0, snap: 1e9 }                                           // marcas do filme que as cenas precisam (ver setBeats)
    };
    FILM.forEach(function (register) { register(E); });
    document.addEventListener('langchange', function (e) { E.lang = e.detail === 'pt' ? 'pt' : 'en'; Object.keys(shapes).forEach(function (k) { if (shapes[k].text) shapes[k].data = null; }); loaded = ''; });

    // ---------- Geometria e material ----------
    var geom = new T.BufferGeometry(), r0 = rng(77), seeds = new Float32Array(N * 4), ZERO4 = new Float32Array(N * 4);
    for (var i = 0; i < N * 4; i++) seeds[i] = r0();
    function dyn(size) { var a = new T.BufferAttribute(new Float32Array(N * size), size); a.setUsage(T.DynamicDrawUsage); return a; }
    var aFrom = dyn(3), aTo = dyn(3), aCF = dyn(3), aCT = dyn(3), aFF = dyn(4), aFT = dyn(4), aFx = dyn(4);
    geom.setAttribute('position', aFrom); geom.setAttribute('aTo', aTo);
    geom.setAttribute('aColFrom', aCF); geom.setAttribute('aColTo', aCT);
    geom.setAttribute('aFlowFrom', aFF); geom.setAttribute('aFlowTo', aFT); geom.setAttribute('aFx', aFx);
    geom.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));

    var U = {
      uMix: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1000 }, uTurb: { value: 1 }, uStagger: { value: 0.7 }, uArc: { value: 0 }, uEase: { value: 0 },
      uFocus: { value: 16 }, uDof: { value: 0.07 }, uClock: { value: new T.Vector2(0, 0) }, uRig: { value: rigTex },
      uA: { value: new T.Vector4() }, uB: { value: new T.Vector4() }, uGain: { value: 0.6 }, uVary: { value: 1 }
    };
    var VERT = [
      'attribute vec3 aTo; attribute vec3 aColFrom; attribute vec3 aColTo; attribute vec4 aFlowFrom; attribute vec4 aFlowTo; attribute vec4 aFx; attribute vec4 aSeed;',
      'uniform float uMix, uTime, uPx, uTurb, uStagger, uArc, uEase, uFocus, uDof, uVary, uHalo; uniform vec2 uClock; uniform vec4 uA, uB; uniform sampler2D uRig;',
      'varying vec3 vCol; varying float vA;',
      // k.x = altura da onda; flow = trajeto em laço do ponto, percorrido conforme o relógio da cena
      'vec3 form(vec3 p, vec4 k, vec4 flow, float clock, out float crest, out float vis) {',
      '  float w = sin(p.x * 0.42 + uTime * 0.55) * 0.5 + sin(p.z * 0.8 + p.x * 0.27 - uTime * 0.8) * 0.36 + sin((p.x - p.z) * 0.21 + uTime * 0.33) * 0.62;',
      '  crest = w * k.x; p.y += w * k.x;',
      '  float f = fract(clock + flow.w);',
      '  float moving = step(0.0001, dot(flow.xyz, flow.xyz));',
      '  p += flow.xyz * (f - 0.5);',
      '  vis = mix(1.0, sin(f * 3.14159265), moving);',
      '  return p;',
      '}',
      'vec3 spin(vec3 v, vec3 ax, float ang) { float c = cos(ang), s = sin(ang); return v * c + cross(ax, v) * s + ax * dot(ax, v) * (1.0 - c); }',
      'void main() {',
      // o halo usa só um quinto dos pontos, bem maiores e fracos: dá o brilho suave em volta das formas
      '  if (uHalo > 0.5 && aSeed.x > 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; return; }',
      '  float t = clamp(uMix * (1.0 + uStagger) - aFx.x * uStagger, 0.0, 1.0);',
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
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  float depth = -mv.z;',
      '  float coc = clamp(abs(depth - uFocus) * uDof, 0.0, 2.4);',
      '  float size = mix(uA.w, uB.w, t) * mix(1.0, 0.6 + aSeed.z * 0.9, uVary) * (1.0 + k * 0.5 * aFx.z) * (1.0 + coc) * mix(1.0, 5.0, uHalo);',
      '  gl_PointSize = max(1.5, size * uPx / max(depth, 0.1));',
      '  float twinkle = 0.82 + 0.18 * sin(uTime * (1.5 + aSeed.y * 2.5) + aSeed.w * 60.0);',
      '  vCol = mix(aColFrom, aColTo, t) * (1.0 + mix(ca, cb, t) * 0.6);',
      '  vA = twinkle * mix(va, vb, t) * smoothstep(0.25, 1.6, depth) * smoothstep(150.0, 60.0, depth) / (1.0 + coc * coc * 1.5) * mix(1.0, 0.07, uHalo);',
      // pontos que ficam enormes na tela (muito perto da câmera) perdem brilho, para não virarem borrão branco
      '  if (uHalo < 0.5) vA *= min(1.0, pow(0.014 * uPx / gl_PointSize, 1.6));',
      '}'
    ].join('\n');
    var FRAG = [
      'varying vec3 vCol; varying float vA; uniform float uGain, uHalo;',
      'void main() {',
      '  float r = length(gl_PointCoord - 0.5) * 2.0;',
      '  float soft = smoothstep(1.0, 0.0, r);',
      // ponto: miolo nítido com borda macia; halo: só a mancha suave
      '  float a = mix(soft * soft * (0.55 + 0.45 * smoothstep(0.55, 0.0, r)), soft * soft * soft, uHalo);',
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

    // ---------- Estado ----------
    var W = 1, H = 1, time = 0, fireTime = 0, beats = [], view = { dolly: 0, settle: 0 }, lastBeat = -1;
    var EASE = { io: 0, 'in': 1, out: 2, lin: 3 };
    function eased(f, mode) { return mode === 1 ? f * f : mode === 2 ? 1 - (1 - f) * (1 - f) : mode === 3 ? f : f * f * (3 - 2 * f); }
    function beatKey(b) { return b.from + '>' + b.to + '>' + (b.fx || 'swarm') + '>' + (b.rig || ''); }

    function load(beat, j) {
      var a = need(beat.from), b = need(beat.to);
      aFrom.array.set(a.pos); aTo.array.set(b.pos); aCF.array.set(a.col); aCT.array.set(b.col);
      aFF.array.set(a.flow || ZERO4); aFT.array.set(b.flow || ZERO4); aFx.array.set(fx(beat.fx || 'swarm'));
      [aFrom, aTo, aCF, aCT, aFF, aFT, aFx].forEach(function (x) { x.needsUpdate = true; });
      if (beat.rig) { rigData.set(RIG[beat.rig] || (RIG[beat.rig] = RIGMAKE[beat.rig]())); rigTex.needsUpdate = true; }
      loaded = beatKey(beat);
      // Guarda na memória só as cenas vizinhas; as outras são geradas de novo quando o filme chegar nelas
      var keep = { wave: 1, plate: 1 };
      for (var q = Math.max(0, j - 1); q <= Math.min(beats.length - 1, j + 2); q++) { keep[beats[q].from] = 1; keep[beats[q].to] = 1; }
      Object.keys(shapes).forEach(function (k) { if (!keep[k] && !shapes[k].keep) shapes[k].data = null; });
      // ... e prepara as próximas em segundo plano, para a passagem seguinte não engasgar
      if (j !== lastBeat) { lastBeat = j; setTimeout(function () { var nx = beats[Math.min(beats.length - 1, j + 1)], n2 = beats[Math.min(beats.length - 1, j + 2)]; need(nx.to); fx(nx.fx || 'swarm'); need(n2.to); }, 120); }
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
      var portrait = aspect < 0.9;
      if (portrait !== E.portrait) { E.portrait = portrait; Object.keys(shapes).forEach(function (k) { if (shapes[k].layout) shapes[k].data = null; }); loaded = ''; }
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
      var beat = beats[j], f = clamp((u - beat.a) / (beat.b - beat.a), 0, 1), mode = EASE[beat.ease] || 0, mix = f, fade = 1;
      if (beat.cut) { mix = f < 0.5 ? 0 : 1; fade = Math.abs(f - 0.5) * 2; fade *= fade; }
      if (beatKey(beat) !== loaded) load(beat, j);
      if (!opts.frozen) time += dt;
      if (u >= E.time.snap) fireTime += dt * env.ts; else fireTime = 0;
      var A = shapes[beat.from], B = shapes[beat.to], m = beat.cut ? mix : eased(f, mode);
      U.uMix.value = mix; U.uTime.value = time; U.uEase.value = beat.cut ? 3 : mode;
      U.uTurb.value = beat.turb === undefined ? 1 : beat.turb; U.uStagger.value = beat.stagger === undefined ? 0.7 : beat.stagger; U.uArc.value = beat.arc || 0;
      U.uA.value.set(A.wave || 0, 0, 0, A.size * SZ); U.uB.value.set(B.wave || 0, 0, 0, B.size * SZ);
      U.uClock.value.set(clockOf(A, u), clockOf(B, u));
      U.uGain.value = lerp(A.gain, B.gain, m) * fade * (1 + env.flash); U.uVary.value = lerp(A.vary, B.vary, m); U.uDof.value = lerp(A.dof, B.dof, m);

      var ca = A.cam, cb = B.cam, tall = camera.aspect < 1;
      var near = tall ? lerp(ca.tall || 0.84, cb.tall || 0.84, m) : 1;
      var az = (lerp(ca.az, cb.az, m) + ptr.x * 1.0) * PI / 180, el = (lerp(ca.el, cb.el, m) - ptr.y * 0.7) * PI / 180;
      var r = lerp(ca.r, cb.r, m) * near - view.dolly;
      var sx = env.shake * Math.sin(u * 231), sy = env.shake * 0.7 * Math.sin(u * 197 + 1.3);
      var tx = lerp(ca.t[0], cb.t[0], m) + sx, ty = lerp(ca.t[1], cb.t[1], m) + sy, tz = lerp(ca.t[2], cb.t[2], m);
      camera.position.set(tx + r * Math.cos(el) * Math.sin(az), ty + r * Math.sin(el), tz + r * Math.cos(el) * Math.cos(az));
      camera.lookAt(tx, ty, tz);
      var ox = tall ? 0 : lerp(ca.ox || 0, cb.ox || 0, m), oy = tall ? -0.11 * view.settle : lerp(ca.oy || 0, cb.oy || 0, m);
      camera.setViewOffset(W, H, -ox * W, -oy * H, W, H);
      camera.updateMatrixWorld();
      U.uFocus.value = r;
      renderer.render(scene, camera);
    }

    // Posição na tela (px) de um ponto registrado com E.anchor, para etiquetas em HTML
    var v3 = new T.Vector3();
    function project(name) {
      var p = anchors[name] && anchors[name](); if (!p) return null;
      v3.set(p[0], p[1], p[2]).project(camera);
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
    }

    resize();
    return {
      frame: frame, resize: resize, view: view, count: N, project: project,
      // recebe a lista de passagens; guarda os instantes em que a queda começa e em que o tempo volta ao normal
      setBeats: function (list) {
        beats = list; loaded = ''; lastBeat = -1;
        list.forEach(function (b) { if (b.mark === 'shaft') E.time.shaft = b.a; if (b.mark === 'snap') E.time.snap = b.a; });
      },
      // Troca a paleta: as cenas são geradas de novo, com as cores novas
      setPalette: function (name) {
        if (!PALETTES[name]) return;
        pal = PALETTES[name]; Object.keys(shapes).forEach(function (k) { shapes[k].data = null; }); loaded = '';
      },
      renderer: renderer
    };
  }

  window.HRMatter = { create: create, palettes: PALETTES };
})();
