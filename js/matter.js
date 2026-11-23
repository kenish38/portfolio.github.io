// ===== O mar de luz =====
// Um campo de pontos de luz que forma um mar visto de cima, atrás do nome recortado na parede (js/wall.js).
// Este arquivo tem tudo: as paletas, o mar, o shader, a câmera e o desenho de cada quadro. Quem liga o mar à
// página é js/home.js. Nada aqui é imagem ou modelo externo: tudo é gerado por código.
(function () {
  'use strict';
  var T = window.THREE, PI = Math.PI;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Paletas ----------
  // Cada paleta tem duas rampas de cinco cores, do escuro ao claro:
  //   main  a cor do mar
  //   rival o contraponto: os pontos de destaque espalhados pelo mar
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
  // cor na rampa (t de 0 a 1), escrita direto no vetor de cores (sem criar um array por ponto)
  function rampTo(list, t, out, o) {
    t = clamp(t, 0, 1) * (list.length - 1);
    var j = Math.min(list.length - 2, Math.floor(t)), f = t - j, a = list[j], b = list[j + 1];
    out[o] = lerp(a[0], b[0], f); out[o + 1] = lerp(a[1], b[1], f); out[o + 2] = lerp(a[2], b[2], f);
  }
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

  // opts: { palette: nome em PALETTES, frozen: true para quem pediu menos movimento (o mar fica parado) }
  function create(canvas, opts) {
    opts = opts || {};
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance' }); }
    catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);
    var small = Math.min(window.innerWidth, window.innerHeight) < 700;
    var modest = !small && (navigator.hardwareConcurrency || 8) <= 4;
    // total de pontos: 102 mil no computador, 62 mil em máquinas modestas, 40 mil no celular
    var SIDE = small ? 200 : modest ? 250 : 320, N = SIDE * SIDE;
    var SZ = 1 / Math.sqrt(N / 40000);                          // quanto mais pontos, menor cada um
    var pal = PALETTES[opts.palette] || PALETTES.perola;

    // ---------- O mar ----------
    // Uma grade de WX x WZ pontos (WX * WZ = N). A cor vem de um ruído suave; alguns pontos são destaques do contraponto.
    // ONDA: altura das ondas | TAMANHO e VARIA: tamanho dos pontos e quanto ele varia | BRILHO | DESFOQUE fora do foco
    var ONDA = 1, TAMANHO = 0.085, BRILHO = 0.82, VARIA = 1, DESFOQUE = 0.07;
    var WX = SIDE === 200 ? 320 : SIDE === 250 ? 500 : 512, WZ = N / WX;
    var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), r = rng(3), n = 0;
    for (var iz = 0; iz < WZ; iz++) for (var ix = 0; ix < WX; ix++, n += 3) {
      var x = (ix / (WX - 1) - 0.5) * 32, z = (iz / (WZ - 1)) * 22 - 17;
      pos[n] = x; pos[n + 1] = -1.1; pos[n + 2] = z;
      if (r() < 0.02) rampTo(pal.rival, 0.72, col, n);
      else rampTo(pal.main, 0.2 + 0.5 * fbm(x * 0.16 + 9, z * 0.22 + 4) + (r() < 0.04 ? 0.5 : 0), col, n);
    }

    // ---------- Geometria e material ----------
    var geom = new T.BufferGeometry(), r0 = rng(77), seeds = new Float32Array(N * 4);
    for (var i = 0; i < N * 4; i++) seeds[i] = r0();
    geom.setAttribute('position', new T.BufferAttribute(pos, 3));
    geom.setAttribute('aCol', new T.BufferAttribute(col, 3));
    geom.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));

    var U = {
      uTime: { value: 0 }, uPx: { value: 1000 }, uWave: { value: ONDA }, uSize: { value: TAMANHO * SZ },
      uFocus: { value: 16 }, uDof: { value: DESFOQUE }, uGain: { value: BRILHO }, uVary: { value: VARIA },
      uMaxPt: { value: renderer.getContext().getParameter(renderer.getContext().ALIASED_POINT_SIZE_RANGE)[1] }   // maior ponto que esta GPU desenha
    };
    var CUT = '0.00176';                                        // 0.45 / 255: abaixo disso um fragmento não muda a cor de um pixel de 8 bits
    var VERT = [
      'attribute vec3 aCol; attribute vec4 aSeed;',
      'uniform float uTime, uPx, uWave, uSize, uFocus, uDof, uVary, uHalo, uGain, uMaxPt;',
      'varying vec3 vCol; varying float vA; varying float vK;',
      'void main() {',
      // o halo usa só um quinto dos pontos, bem maiores e fracos: dá o brilho suave em volta das formas
      '  if (uHalo > 0.5 && aSeed.x > 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 1.0; return; }',
      '  vec3 p = position;',
      // a onda: três senos cruzados que andam com o tempo; a crista (crest) também clareia o ponto
      '  float w = sin(p.x * 0.42 + uTime * 0.55) * 0.5 + sin(p.z * 0.8 + p.x * 0.27 - uTime * 0.8) * 0.36 + sin((p.x - p.z) * 0.21 + uTime * 0.33) * 0.62;',
      '  float crest = w * uWave; p.y += w * uWave;',
      '  p += 0.008 * vec3(sin(uTime * 1.3 + aSeed.w * 50.0), cos(uTime * 1.1 + aSeed.x * 50.0), sin(uTime * 0.9 + aSeed.z * 50.0));',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  float depth = -mv.z;',
      '  float coc = clamp(abs(depth - uFocus) * uDof, 0.0, 2.4);',
      '  float size = uSize * mix(1.0, 0.6 + aSeed.z * 0.9, uVary) * (1.0 + coc) * mix(1.0, 5.0, uHalo);',
      '  float ps = size * uPx / max(depth, 0.1);',
      '  gl_PointSize = max(1.5, ps);',
      '  float twinkle = 0.82 + 0.18 * sin(uTime * (1.5 + aSeed.y * 2.5) + aSeed.w * 60.0);',
      '  vCol = aCol * (1.0 + crest * 0.6);',
      '  vA = twinkle * smoothstep(0.25, 1.6, depth) * (1.0 - smoothstep(60.0, 150.0, depth)) / (1.0 + coc * coc * 1.5) * mix(1.0, 0.07, uHalo);',
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
    // os pontos se somam (blending aditivo), então a ordem de desenho não importa e não há teste de profundidade
    function material(halo) {
      var u = {}; Object.keys(U).forEach(function (k) { u[k] = U[k]; }); u.uHalo = { value: halo ? 1 : 0 };
      return new T.ShaderMaterial({
        uniforms: u, transparent: true, depthTest: false, depthWrite: false, vertexShader: VERT, fragmentShader: FRAG,
        blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor
      });
    }
    var scene = new T.Scene();
    if (!small) { var halo = new T.Points(geom, material(true)); halo.frustumCulled = false; scene.add(halo); }
    var points = new T.Points(geom, material(false)); points.frustumCulled = false; scene.add(points);

    // ---------- Câmera ----------
    // Olha o mar de cima (EL graus acima do horizonte, a R de distância do ALVO); o cursor só a inclina de leve.
    var camera = new T.PerspectiveCamera(35, 1, 0.2, 400), EL = 25, R = 10.5, ALVO = 0.2;
    var W = 1, H = 1, DPR = 1, lensBase = 0, time = 0, lastKey = '';
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
    }

    // O quadro parado de quem pediu menos movimento (ver frame) é refeito quando a aba volta a aparecer ou o navegador devolve o contexto WebGL
    document.addEventListener('visibilitychange', function () { lastKey = ''; });
    canvas.addEventListener('webglcontextrestored', function () { lastKey = ''; });

    // dt: segundos desde o último quadro; ptr: cursor { x, y de -1 a 1 }
    function frame(dt, ptr) {
      // Com "menos movimento" o tempo do mar fica parado: se o cursor não mudou desde o último quadro, não há o que redesenhar
      if (opts.frozen) {
        var key = ptr.x.toFixed(4) + '|' + ptr.y.toFixed(4);
        if (key === lastKey) return;
        lastKey = key;
      } else time += dt;
      U.uTime.value = time;
      var az = ptr.x * PI / 180, el = (EL - ptr.y * 0.7) * PI / 180;
      camera.position.set(R * Math.cos(el) * Math.sin(az), ALVO + R * Math.sin(el), R * Math.cos(el) * Math.cos(az));
      camera.lookAt(0, ALVO, 0);
      camera.updateMatrixWorld();
      U.uFocus.value = R;
      renderer.render(scene, camera);
    }

    resize();
    return { frame: frame, resize: resize };
  }

  window.HRMatter = { create: create, palettes: PALETTES };
})();
