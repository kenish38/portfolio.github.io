// ===== A matéria do outro lado da parede =====
// Um único campo de partículas luminosas (brasa de forja) que a rolagem molda
// em formas, uma por camada do jogo:
//   0 onda      mar de brasa visto pelo recorte do nome
//   1 baseplate grade plana de studs: de onde todo jogo começa
//   2 terreno   a grade sobe e vira relevo (mapas)
//   3 espada    um asset em 3D (modelagem)
//   4 clarão    explosão de luz (iluminação e VFX)
//   5 código    um script Luau de verdade, escrito com pontos (programação)
//   6 interface uma HUD com loja (interface)
//   7 play      o botão de jogar (jogo completo)
// O mesmo conjunto de pontos passa de uma forma para a outra; nada é imagem.
(function () {
  'use strict';
  var T = window.THREE;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- Paleta: do branco quente ao vermelho escuro, com um azul frio raro ----------
  var HOT = [1.0, 0.95, 0.84], AMBER = [1.0, 0.70, 0.29], ORANGE = [1.0, 0.48, 0.17], RED = [0.89, 0.23, 0.18], DEEP = [0.42, 0.08, 0.10], BLUE = [0.30, 0.50, 1.0];
  var RAMP = [DEEP, RED, ORANGE, AMBER, HOT];
  function heat(t, out, o) {
    t = clamp(t, 0, 1) * (RAMP.length - 1);
    var i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i, a = RAMP[i], b = RAMP[i + 1];
    out[o] = lerp(a[0], b[0], f); out[o + 1] = lerp(a[1], b[1], f); out[o + 2] = lerp(a[2], b[2], f);
  }
  function css(c) { return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')'; }

  // Ruído de valor, sempre igual a cada visita
  function hash(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
  }
  function fbm(x, y) { return vnoise(x, y) * 0.5 + vnoise(x * 2.1, y * 2.1) * 0.27 + vnoise(x * 4.3, y * 4.3) * 0.15 + vnoise(x * 8.7, y * 8.7) * 0.08; }

  function create(canvas, opts) {
    opts = opts || {};
    var renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' }); }
    catch (e) { return null; }
    renderer.setClearColor(0x000000, 1);
    var small = Math.min(window.innerWidth, window.innerHeight) < 700;
    var SIDE = small ? 150 : 200, N = SIDE * SIDE;          // pontos (grade quadrada)
    var WX = small ? 250 : 320, WZ = N / WX;                // a mesma quantidade, numa grade larga

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(35, 1, 0.1, 200);

    // ---------- Formas ----------
    function blank() { return { pos: new Float32Array(N * 3), col: new Float32Array(N * 3) }; }
    function shuffle(s, seed) {
      var r = rng(seed), p = s.pos, c = s.col;
      for (var i = N - 1; i > 0; i--) {
        var j = Math.floor(r() * (i + 1)), a = i * 3, b = j * 3, t;
        t = p[a]; p[a] = p[b]; p[b] = t; t = p[a + 1]; p[a + 1] = p[b + 1]; p[b + 1] = t; t = p[a + 2]; p[a + 2] = p[b + 2]; p[b + 2] = t;
        t = c[a]; c[a] = c[b]; c[b] = t; t = c[a + 1]; c[a + 1] = c[b + 1]; c[b + 1] = t; t = c[a + 2]; c[a + 2] = c[b + 2]; c[b + 2] = t;
      }
      return s;
    }

    function wave() {
      var s = blank(), r = rng(3), i = 0;
      for (var iz = 0; iz < WZ; iz++) for (var ix = 0; ix < WX; ix++, i += 3) {
        var x = (ix / (WX - 1) - 0.5) * 32, z = (iz / (WZ - 1)) * 22 - 17;
        s.pos[i] = x; s.pos[i + 1] = -1.1; s.pos[i + 2] = z;
        var h = 0.22 + 0.5 * fbm(x * 0.16 + 9, z * 0.22 + 4) + (r() < 0.04 ? 0.5 : 0);
        heat(h, s.col, i);
        if (r() < 0.02) { s.col[i] = BLUE[0]; s.col[i + 1] = BLUE[1]; s.col[i + 2] = BLUE[2]; }
      }
      return s;
    }

    function height(x, z) {
      var n = fbm(x * 0.36 + 3.1, z * 0.36 + 1.7);
      var ridge = Math.pow(1 - Math.abs(2 * fbm(x * 0.5 + 7.3, z * 0.5 + 2.9) - 1), 2);
      var peak = Math.exp(-((x + 1.5) * (x + 1.5) + (z + 1.0) * (z + 1.0)) / 5.0);
      var h = 0.18 + n * 0.85 + peak * (1.5 + ridge * 1.3);
      var river = Math.abs(x - (1.9 + Math.sin(z * 0.75) * 0.8));
      h *= sstep(0.12, 1.25, river);
      h *= sstep(5.0, 3.5, Math.max(Math.abs(x), Math.abs(z)));
      return { h: h, river: river };
    }
    function plate(terrain) {
      var s = blank(), i = 0;
      for (var iz = 0; iz < SIDE; iz++) for (var ix = 0; ix < SIDE; ix++, i += 3) {
        var x = (ix / (SIDE - 1) - 0.5) * 10, z = (iz / (SIDE - 1) - 0.5) * 10;
        s.pos[i] = x; s.pos[i + 2] = z;
        var line = (ix % 10 === 0 || iz % 10 === 0), edge = ix === 0 || iz === 0 || ix === SIDE - 1 || iz === SIDE - 1;
        if (!terrain) {
          s.pos[i + 1] = -1.2;
          heat(edge ? 1 : line ? 0.7 : 0.16, s.col, i);
        } else {
          var t = height(x, z);
          s.pos[i + 1] = -1.2 + t.h;
          if (t.river < 0.3 && Math.max(Math.abs(x), Math.abs(z)) < 4.6) { s.col[i] = BLUE[0] * 0.8; s.col[i + 1] = BLUE[1] * 0.8; s.col[i + 2] = BLUE[2] * 0.8; }
          else heat(0.08 + t.h / 3.0 + ((t.h > 0.12 && t.h % 0.32 < 0.045) ? 0.34 : 0), s.col, i);
        }
      }
      return s;
    }

    // Monta uma forma 3D a partir de partes com peso; cada parte devolve um ponto
    function build(parts, seed, xf) {
      var s = blank(), r = rng(seed), total = 0, out = [0, 0, 0, 0];
      parts.forEach(function (p) { total += p.w; });
      var i = 0;
      parts.forEach(function (p, pi) {
        var n = pi === parts.length - 1 ? N - i : Math.round(N * p.w / total);
        for (var k = 0; k < n && i < N; k++, i++) {
          p.fn(r, out);
          var x = out[0], y = out[1], z = out[2];
          if (xf) { var q = xf(x, y, z); x = q[0]; y = q[1]; z = q[2]; }
          s.pos[i * 3] = x; s.pos[i * 3 + 1] = y; s.pos[i * 3 + 2] = z;
          if (out[3] < 0) { s.col[i * 3] = BLUE[0]; s.col[i * 3 + 1] = BLUE[1]; s.col[i * 3 + 2] = BLUE[2]; }
          else heat(out[3], s.col, i * 3);
        }
      });
      return shuffle(s, seed + 1);
    }

    function sword() {
      function hw(u) { return 0.36 * (u < 0.82 ? 1 - 0.1 * u : 0.918 * (1 - (u - 0.82) / 0.18)); }
      var L = 5.0, y0 = -0.5;
      var parts = [
        { w: 0.46, fn: function (r, o) { var u = r(), v = r() * 2 - 1; o[0] = v * hw(u); o[1] = y0 + u * L; o[2] = (r() < 0.5 ? 1 : -1) * 0.09 * (1 - Math.abs(v)); o[3] = 0.45 + 0.3 * (1 - Math.abs(v)); } },
        { w: 0.16, fn: function (r, o) { var u = r(), v = r() < 0.34 ? 0 : (r() < 0.5 ? 1 : -1); o[0] = v * hw(u); o[1] = y0 + u * L; o[2] = v === 0 ? (r() < 0.5 ? 0.09 : -0.09) : 0; o[3] = 1; } },
        { w: 0.12, fn: function (r, o) { var f = Math.floor(r() * 3), a = r() * 2 - 1, b = r() * 2 - 1, sx = 1.1, sy = 0.15, sz = 0.17; if (f === 0) { o[0] = a * sx; o[1] = b * sy; o[2] = (r() < 0.5 ? 1 : -1) * sz; } else if (f === 1) { o[0] = a * sx; o[1] = (r() < 0.5 ? 1 : -1) * sy; o[2] = b * sz; } else { o[0] = (r() < 0.5 ? 1 : -1) * sx; o[1] = a * sy; o[2] = b * sz; } o[1] += y0 - 0.16; o[3] = 0.72; } },
        { w: 0.11, fn: function (r, o) { var y = r(), a = r() < 0.6 ? y * 16 + Math.floor(r() * 2) * Math.PI : r() * 6.283; o[0] = Math.cos(a) * 0.14; o[2] = Math.sin(a) * 0.14; o[1] = y0 - 0.32 - y * 1.2; o[3] = 0.3; } },
        { w: 0.06, fn: function (r, o) { var a = r() * 6.283, c = r() * 2 - 1, q = Math.sqrt(1 - c * c); o[0] = Math.cos(a) * q * 0.28; o[2] = Math.sin(a) * q * 0.28; o[1] = y0 - 1.76 + c * 0.28; o[3] = 0.8; } },
        { w: 0.09, fn: function (r, o) { var a = r() * 6.283, d = 0.5 + r() * 1.3; o[0] = Math.cos(a) * d * 0.8; o[2] = Math.sin(a) * d * 0.5; o[1] = y0 - 1.8 + r() * 6.6; o[3] = r() < 0.12 ? -1 : 0.08 + r() * 0.2; } }
      ];
      var ca = Math.cos(0.36), sa = Math.sin(0.36);
      return build(parts, 21, function (x, y, z) { y -= 1.25; x *= 1.12; y *= 1.12; z *= 1.12; return [x * ca + y * sa, -x * sa + y * ca, z]; });
    }

    function burst() {
      var rr = rng(5), rays = [];
      for (var i = 0; i < 120; i++) { var a = rr() * 6.283, c = rr() * 2 - 1, q = Math.sqrt(1 - c * c); rays.push([Math.cos(a) * q, c * 0.82, Math.sin(a) * q * 0.7, 0.5 + rr()]); }
      function dir(r, o, len) { var a = r() * 6.283, c = r() * 2 - 1, q = Math.sqrt(1 - c * c); o[0] = Math.cos(a) * q * len; o[1] = c * len; o[2] = Math.sin(a) * q * len; }
      var parts = [
        { w: 0.2, fn: function (r, o) { dir(r, o, Math.pow(r(), 0.5) * 0.7); o[3] = 1; } },
        { w: 0.14, fn: function (r, o) { dir(r, o, 1.0 + r() * 0.12); o[3] = 0.78; } },
        { w: 0.52, fn: function (r, o) { var ray = rays[Math.floor(r() * rays.length)], d = 1.25 + Math.pow(r(), 1.8) * 3.6 * ray[3], j = 0.035 * d; o[0] = ray[0] * d + (r() - 0.5) * j; o[1] = ray[1] * d + (r() - 0.5) * j; o[2] = ray[2] * d + (r() - 0.5) * j; o[3] = clamp(0.95 - (d - 1.2) / 4.4, 0.08, 1); } },
        { w: 0.14, fn: function (r, o) { dir(r, o, 1.4 + r() * 4.2); o[2] *= 0.6; o[3] = r() < 0.14 ? -1 : 0.1 + r() * 0.25; } }
      ];
      return build(parts, 31);
    }

    // Amostra pontos de um desenho 2D (a cor do pixel vira a cor do ponto, a opacidade vira densidade)
    function fromCanvas(cw, ch, worldW, depth, draw, seed) {
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      draw(ctx, cw, ch);
      var d = ctx.getImageData(0, 0, cw, ch).data, cum = new Float32Array(cw * ch), acc = 0;
      for (var p = 0; p < cw * ch; p++) { var al = d[p * 4 + 3]; acc += al > 20 ? al : 0; cum[p] = acc; }
      var s = blank(), r = rng(seed), k = worldW / cw;
      for (var i = 0; i < N; i++) {
        var t = r() * acc, lo = 0, hi = cw * ch - 1;
        while (lo < hi) { var m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; }
        var px = lo % cw, py = (lo - px) / cw;
        s.pos[i * 3] = (px + r() - cw / 2) * k; s.pos[i * 3 + 1] = -(py + r() - ch / 2) * k; s.pos[i * 3 + 2] = (r() - 0.5) * depth;
        s.col[i * 3] = d[lo * 4] / 255; s.col[i * 3 + 1] = d[lo * 4 + 1] / 255; s.col[i * 3 + 2] = d[lo * 4 + 2] / 255;
      }
      return s;
    }
    function rr(ctx, x, y, w, h, rad) {
      ctx.beginPath(); ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
    }
    var MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
    var SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

    // Um script Luau de verdade: moeda que soma no placar do jogador
    var CODE = [
      'local Players = game:GetService("Players")',
      '',
      'local function collect(player, coin)',
      '    local stats = player.leaderstats',
      '    stats.Coins.Value += coin.Value',
      '    coin:Destroy()',
      'end',
      '',
      'coin.Touched:Connect(function(hit)',
      '    local player =',
      '        Players:GetPlayerFromCharacter(hit.Parent)',
      '    if player then',
      '        collect(player, coin)',
      '    end',
      'end)'
    ];
    var KEY = /^(local|function|end|if|then|return|for|in|do|not|and|or|else|true|false|nil)$/;
    function code() {
      return fromCanvas(1040, 700, 9.4, 0.12, function (ctx, w, h) {
        ctx.lineWidth = 3; ctx.strokeStyle = css(DEEP); rr(ctx, 6, 6, w - 12, h - 12, 22); ctx.stroke();
        [RED, AMBER, HOT].forEach(function (c, i) { ctx.fillStyle = css(c); ctx.beginPath(); ctx.arc(40 + i * 30, 40, 8, 0, 6.283); ctx.fill(); });
        ctx.font = 'bold 27px ' + MONO; ctx.textBaseline = 'middle';
        var cwid = ctx.measureText('M').width, x0 = (w - cwid * 50) / 2 + 14, y0 = 108, lh = 38.5;
        CODE.forEach(function (line, n) {
          ctx.fillStyle = css(DEEP); ctx.fillText(String(n + 1).padStart(2, ' '), x0 - cwid * 3.4, y0 + n * lh);
          var re = /("[^"]*")|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([^A-Za-z_\s"]+)/g, m, x = x0;
          while ((m = re.exec(line))) {
            var tok = m[0], next = line.charAt(re.lastIndex);
            if (m[1]) ctx.fillStyle = css(BLUE);
            else if (m[2]) ctx.fillStyle = KEY.test(tok) ? css(HOT) : (next === '(' ? css(AMBER) : css(ORANGE));
            else ctx.fillStyle = css(RED);
            if (!m[3]) ctx.fillText(tok, x, y0 + n * lh);
            x += cwid * tok.length;
          }
        });
      }, 41);
    }

    function ui() {
      return fromCanvas(1100, 740, 9.6, 0.12, function (ctx, w, h) {
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // jogador
        ctx.strokeStyle = css(AMBER); ctx.lineWidth = 6; rr(ctx, 40, 40, 92, 92, 20); ctx.stroke();
        ctx.fillStyle = css(HOT); ctx.beginPath(); ctx.arc(72, 78, 6, 0, 6.283); ctx.arc(100, 78, 6, 0, 6.283); ctx.fill();
        ctx.strokeStyle = css(HOT); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(86, 92, 16, 0.25, Math.PI - 0.25); ctx.stroke();
        ctx.font = 'bold 30px ' + SANS; ctx.textBaseline = 'middle'; ctx.fillText('Player', 152, 62);
        ctx.strokeStyle = css(AMBER); ctx.lineWidth = 5; rr(ctx, 152, 88, 236, 30, 15); ctx.stroke();
        ctx.fillStyle = css(ORANGE); rr(ctx, 159, 95, 164, 16, 8); ctx.fill();
        // moedas
        ctx.strokeStyle = css(AMBER); ctx.lineWidth = 6; rr(ctx, 824, 44, 236, 72, 36); ctx.stroke();
        ctx.fillStyle = css(HOT); ctx.beginPath(); ctx.arc(866, 80, 22, 0, 6.283); ctx.fill();
        ctx.font = 'bold 36px ' + SANS; ctx.fillText('1,280', 902, 82);
        // janela da loja
        ctx.strokeStyle = css(ORANGE); ctx.lineWidth = 6; rr(ctx, 250, 168, 600, 402, 28); ctx.stroke();
        ctx.fillStyle = css(HOT); ctx.font = 'bold 40px ' + SANS; ctx.fillText('SHOP', 288, 216);
        ctx.strokeStyle = css(RED); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(796, 202); ctx.lineTo(820, 226); ctx.moveTo(820, 202); ctx.lineTo(796, 226); ctx.stroke();
        ctx.strokeStyle = css(RED); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(278, 250); ctx.lineTo(822, 250); ctx.stroke();
        for (var i = 0; i < 3; i++) {
          var x = 284 + i * 184, y = 274;
          ctx.strokeStyle = css(AMBER); ctx.lineWidth = 5; rr(ctx, x, y, 164, 196, 18); ctx.stroke();
          ctx.save(); ctx.translate(x + 82, y + 72);
          if (i === 0) { ctx.rotate(0.6); ctx.fillStyle = css(HOT); ctx.fillRect(-7, -52, 14, 74); ctx.fillRect(-26, 20, 52, 10); ctx.fillRect(-5, 30, 10, 26); }
          else if (i === 1) { ctx.fillStyle = css(BLUE); ctx.beginPath(); ctx.arc(0, 14, 34, 0, 6.283); ctx.fill(); ctx.fillRect(-12, -46, 24, 34); ctx.fillStyle = css(HOT); ctx.fillRect(-17, -54, 34, 10); }
          else { ctx.fillStyle = css(HOT); ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(42, -8); ctx.lineTo(0, 50); ctx.lineTo(-42, -8); ctx.closePath(); ctx.fill(); }
          ctx.restore();
          ctx.fillStyle = css(i === 1 ? AMBER : RED); rr(ctx, x + 30, y + 146, 104, 30, 15); ctx.fill();
        }
        ctx.fillStyle = css(AMBER); rr(ctx, 430, 492, 240, 56, 28); ctx.fill();
        ctx.globalCompositeOperation = 'destination-out'; ctx.font = 'bold 32px ' + SANS; ctx.textAlign = 'center'; ctx.fillText('BUY', 550, 522);
        ctx.globalCompositeOperation = 'source-over'; ctx.textAlign = 'left';
        // barra de itens
        for (var s = 0; s < 5; s++) {
          var sx = 550 - 2.5 * 86 + s * 86 + 6;
          if (s === 1) { ctx.fillStyle = css(ORANGE); rr(ctx, sx, 622, 74, 74, 16); ctx.fill(); }
          ctx.strokeStyle = css(s === 1 ? HOT : AMBER); ctx.lineWidth = 5; rr(ctx, sx, 622, 74, 74, 16); ctx.stroke();
        }
      }, 51);
    }

    function play() {
      return fromCanvas(800, 800, 6.6, 0.8, function (ctx) {
        var g = ctx.createLinearGradient(100, 100, 700, 700); g.addColorStop(0, css(AMBER)); g.addColorStop(1, css(RED));
        ctx.strokeStyle = g; ctx.lineWidth = 44; ctx.beginPath(); ctx.arc(400, 400, 340, 0, 6.283); ctx.stroke();
        ctx.fillStyle = css(HOT); ctx.lineJoin = 'round'; ctx.lineWidth = 36; ctx.strokeStyle = css(HOT);
        ctx.beginPath(); ctx.moveTo(326, 262); ctx.lineTo(326, 538); ctx.lineTo(560, 400); ctx.closePath(); ctx.fill(); ctx.stroke();
      }, 61);
    }

    // Parâmetros de cada forma: onda, pulso, giro, tamanho do ponto, brilho, câmera
    var shapes = [
      { data: wave(), wave: 1, pulse: 0, size: 0.085, gain: 0.86, vary: 1, rot: function () { return 0; }, cam: { el: 25, r: 10.5, ty: 0.2 } },
      { data: plate(false), wave: 0, pulse: 0, size: 0.05, gain: 1.0, vary: 0.15, rot: function (t) { return 0.62 + Math.sin(t * 0.22) * 0.12; }, cam: { el: 30, r: 22, ty: -1.0 } },
      { data: plate(true), wave: 0, pulse: 0, size: 0.05, gain: 0.9, vary: 0.3, rot: function (t) { return 0.62 + Math.sin(t * 0.22) * 0.12; }, cam: { el: 27, r: 21, ty: -0.2 } },
      { data: sword(), wave: 0, pulse: 0, size: 0.05, gain: 0.5, vary: 1, rot: function (t) { return Math.sin(t * 0.45) * 1.15; }, cam: { el: 3, r: 14.5, ty: 0 } },
      { data: burst(), wave: 0, pulse: 1, size: 0.06, gain: 0.5, vary: 1, rot: function (t) { return t * 0.06; }, cam: { el: 0, r: 16, ty: 0 } },
      { data: code(), wave: 0, pulse: 0, size: 0.046, gain: 0.62, vary: 0.5, rot: function (t) { return Math.sin(t * 0.4) * 0.14; }, cam: { el: 0, r: 18.5, ty: 0.3 } },
      { data: ui(), wave: 0, pulse: 0, size: 0.048, gain: 0.6, vary: 0.5, rot: function (t) { return Math.sin(t * 0.4) * 0.14; }, cam: { el: 0, r: 17.5, ty: 0.3 } },
      { data: play(), wave: 0, pulse: 0.5, size: 0.06, gain: 0.42, vary: 1, rot: function (t) { return Math.sin(t * 0.5) * 0.4; }, cam: { el: 0, r: 16, ty: 0 } }
    ];
    // Turbulência e escalonamento de cada passagem (de i para i + 1)
    var moves = [{ turb: 0.7, stagger: 0.7 }, { turb: 0, stagger: 0.5 }, { turb: 1.5, stagger: 0.7 }, { turb: 1.3, stagger: 0.7 }, { turb: 1.5, stagger: 0.7 }, { turb: 1.0, stagger: 0.7 }, { turb: 1.2, stagger: 0.7 }];

    // ---------- Geometria e material ----------
    var geom = new T.BufferGeometry(), r0 = rng(77), seeds = new Float32Array(N * 4);
    for (var i = 0; i < N * 4; i++) seeds[i] = r0();
    var aFrom = new T.BufferAttribute(new Float32Array(N * 3), 3), aTo = new T.BufferAttribute(new Float32Array(N * 3), 3);
    var aCF = new T.BufferAttribute(new Float32Array(N * 3), 3), aCT = new T.BufferAttribute(new Float32Array(N * 3), 3);
    [aFrom, aTo, aCF, aCT].forEach(function (a) { a.setUsage(T.DynamicDrawUsage); });
    geom.setAttribute('position', aFrom); geom.setAttribute('aTo', aTo);
    geom.setAttribute('aColFrom', aCF); geom.setAttribute('aColTo', aCT);
    geom.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));

    var U = {
      uMix: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1000 }, uTurb: { value: 1 }, uStagger: { value: 0.7 }, uFocus: { value: 16 },
      uA: { value: new T.Vector4() }, uB: { value: new T.Vector4() }, uGain: { value: 0.6 }, uVary: { value: 1 },
      uPointer: { value: new T.Vector3(99, 99, 99) }, uPointerK: { value: 0 }
    };
    var mat = new T.ShaderMaterial({
      uniforms: U, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: [
        'attribute vec3 aTo; attribute vec3 aColFrom; attribute vec3 aColTo; attribute vec4 aSeed;',
        'uniform float uMix, uTime, uPx, uTurb, uStagger, uFocus, uPointerK, uVary; uniform vec4 uA, uB; uniform vec3 uPointer;',
        'varying vec3 vCol; varying float vA;',
        'vec3 form(vec3 p, vec4 k, out float crest) {',
        '  float w = sin(p.x * 0.42 + uTime * 0.55) * 0.5 + sin(p.z * 0.8 + p.x * 0.27 - uTime * 0.8) * 0.36 + sin((p.x - p.z) * 0.21 + uTime * 0.33) * 0.62;',
        '  crest = w * k.x; p.y += w * k.x;',
        '  float r = length(p);',
        '  p += (p / max(r, 0.001)) * k.y * (0.5 + 0.5 * sin(uTime * 1.7 - r * 1.5 + aSeed.w * 6.283)) * 0.24;',
        '  float c = cos(k.z), s = sin(k.z);',
        '  p.xz = vec2(c * p.x + s * p.z, -s * p.x + c * p.z);',
        '  return p;',
        '}',
        'void main() {',
        '  float t = clamp(uMix * (1.0 + uStagger) - aSeed.y * uStagger, 0.0, 1.0);',
        '  t = t * t * (3.0 - 2.0 * t);',
        '  float ca; float cb;',
        '  vec3 a = form(position, uA, ca); vec3 b = form(aTo, uB, cb);',
        '  vec3 p = mix(a, b, t);',
        '  float k = sin(t * 3.14159265);',
        '  vec3 n = vec3(sin(aSeed.w * 41.0 + uTime * 0.9 + p.y * 0.7), cos(aSeed.x * 37.0 + uTime * 0.8 + p.x * 0.6), sin(aSeed.z * 53.0 + uTime * 0.7 + p.z * 0.8));',
        '  p += n * k * uTurb;',
        '  p += 0.018 * vec3(sin(uTime * 1.3 + aSeed.w * 50.0), cos(uTime * 1.1 + aSeed.x * 50.0), sin(uTime * 0.9 + aSeed.z * 50.0));',
        '  vec3 dp = p - uPointer; float d = length(dp);',
        '  p += (dp / max(d, 0.001)) * uPointerK * smoothstep(2.3, 0.0, d);',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  float depth = -mv.z;',
        '  float coc = clamp(abs(depth - uFocus) * 0.07, 0.0, 2.2);',
        '  float size = mix(uA.w, uB.w, t) * mix(1.0, 0.65 + aSeed.z * 0.8, uVary) * (1.0 + k * 0.5) * (1.0 + coc);',
        '  gl_PointSize = max(1.5, size * uPx / max(depth, 0.1));',
        '  vCol = mix(aColFrom, aColTo, t) * (1.0 + mix(ca, cb, t) * 0.6);',
        '  vA = smoothstep(0.4, 2.2, depth) * smoothstep(70.0, 24.0, depth) / (1.0 + coc * coc * 1.5);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vCol; varying float vA; uniform float uGain;',
        'void main() {',
        '  float r = length(gl_PointCoord - 0.5) * 2.0;',
        '  float a = smoothstep(1.0, 0.0, r); a *= a;',
        '  gl_FragColor = vec4(vCol * a * vA * uGain, 1.0);',
        '}'
      ].join('\n')
    });
    var points = new T.Points(geom, mat); points.frustumCulled = false; scene.add(points);

    // ---------- Estado ----------
    var W = 1, H = 1, time = 0, pair = -1, view = { ox: 0, oy: 0, dolly: 0 };
    var ray = new T.Vector3(), fwd = new T.Vector3(), hit = new T.Vector3();

    function load(j) {
      var a = shapes[j].data, b = shapes[j + 1].data;
      aFrom.array.set(a.pos); aTo.array.set(b.pos); aCF.array.set(a.col); aCT.array.set(b.col);
      aFrom.needsUpdate = aTo.needsUpdate = aCF.needsUpdate = aCT.needsUpdate = true;
      U.uTurb.value = moves[j].turb; U.uStagger.value = moves[j].stagger;
      pair = j;
    }

    function resize() {
      W = canvas.clientWidth || 1; H = canvas.clientHeight || 1;
      var dpr = Math.min(window.devicePixelRatio || 1, small ? 1.75 : 2);
      renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
      var aspect = W / H, base = 35, hfov = 2 * Math.atan(Math.tan(base * Math.PI / 360) * 1.3);
      camera.aspect = aspect;
      camera.fov = aspect >= 1.3 ? base : Math.min(78, 2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180 / Math.PI);
      camera.updateProjectionMatrix();
      U.uPx.value = H * dpr / (2 * Math.tan(camera.fov * Math.PI / 360));
    }

    // j: passagem atual (da forma j para a j + 1); mix: 0 a 1; ptr: cursor de -1 a 1
    function frame(dt, j, mix, ptr) {
      if (j !== pair) load(j);
      if (!opts.frozen) time += dt;
      var A = shapes[j], B = shapes[j + 1], m = mix * mix * (3 - 2 * mix);
      U.uMix.value = mix; U.uTime.value = time;
      U.uA.value.set(A.wave, A.pulse, A.rot(time), A.size);
      U.uB.value.set(B.wave, B.pulse, B.rot(time), B.size);
      U.uGain.value = lerp(A.gain, B.gain, m); U.uVary.value = lerp(A.vary, B.vary, m);

      var el = (lerp(A.cam.el, B.cam.el, m) - ptr.y * 1.6) * Math.PI / 180, az = ptr.x * 2.6 * Math.PI / 180;
      // em telas em pé as formas chegam mais perto (a onda da abertura não)
      var near = camera.aspect < 1 ? lerp(j === 0 ? 1 : 0.8, 0.8, m) : 1;
      var r = lerp(A.cam.r, B.cam.r, m) * near - view.dolly, ty = lerp(A.cam.ty, B.cam.ty, m);
      camera.position.set(r * Math.cos(el) * Math.sin(az), ty + r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
      camera.lookAt(0, ty, 0);
      camera.setViewOffset(W, H, -view.ox * W, -view.oy * H, W, H);
      camera.updateMatrixWorld();
      U.uFocus.value = r;

      // O cursor empurra os pontos: acha onde ele toca o plano que passa pelo centro
      camera.getWorldDirection(fwd);
      ray.set(ptr.x, -ptr.y, 0.5).unproject(camera).sub(camera.position).normalize();
      var den = ray.dot(fwd);
      if (den > 0.0001 && ptr.k > 0) {
        var dist = (hit.set(0, ty, 0).sub(camera.position).dot(fwd)) / den;
        U.uPointer.value.copy(camera.position).addScaledVector(ray, dist);
        U.uPointerK.value = ptr.k;
      } else U.uPointerK.value = 0;

      renderer.render(scene, camera);
    }

    resize(); load(0);
    return { frame: frame, resize: resize, view: view, count: N, renderer: renderer };
  }

  window.HRMatter = { create: create };
})();
