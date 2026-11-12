// ===== A parede com o nome recortado =====
// O site inteiro é uma parede preta e o nome é um buraco nela. A parede tem
// espessura: dá para ver as laterais do recorte, que mudam com o cursor.
// Ao rolar, a câmera anda para a frente e atravessa a parede pela letra "I".
//
// Dois <canvas> empilhados: o de trás desenha as laterais do recorte e o de
// frente desenha a face da parede. O que estiver atrás deles no HTML aparece
// pelo buraco.
//
// Os contornos do nome vêm de name-data.js (gerado por tools/extract-name.py).
(function () {
  'use strict';

  var DATA = window.HR_NAME;
  var GAP = 0.13;      // espaço entre as duas linhas, em alturas de maiúscula
  var EPS = 0.004;     // distância mínima da câmera até um plano antes de ele sumir
  var ORDER = ['tall', 'mid', 'wide']; // da versão mais alta para a mais larga

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  function create(root, opts) {
    opts = opts || {};
    var T = opts.thickness || 0.04;            // espessura da parede
    var STEPS = opts.steps || 9;               // degraus de sombra na lateral
    var near = opts.sideNear || [7, 7, 9];      // cor da lateral perto da frente
    var far = opts.sideFar || [78, 60, 58];     // cor da lateral perto do fundo (pega a luz de trás)
    var wallColor = opts.wall || '#000';
    var doorChar = opts.door || 'I';

    function mk(cls) {
      var c = document.createElement('canvas');
      c.className = cls; c.setAttribute('aria-hidden', 'true');
      root.appendChild(c); return c;
    }
    var sides = mk('wall__sides'), front = mk('wall__front');
    var cs = sides.getContext('2d'), cf = front.getContext('2d');
    var W = 0, H = 0, dpr = 1, lines = [], block = null, door = null, cleared = false;

    // Cache dos caminhos por variante
    var paths = {};
    function variant(id) {
      if (!paths[id]) paths[id] = DATA.variants[id].map(function (l) { return { w: l.w, boxes: l.boxes, path: new Path2D(l.d) }; });
      return paths[id];
    }

    function layout() {
      W = root.clientWidth; H = root.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      [sides, front].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      var maxW = Math.min(W * (W < 700 ? 0.92 : 0.88), 1700);
      var maxH = H * (opts.maxHeight || 0.52);
      var unitsH = DATA.cap * (2 + GAP);
      var id = null, sc = 0;
      for (var i = 0; i < ORDER.length; i++) {
        var w = DATA.variants[ORDER[i]][0].w;
        if (unitsH * (maxW / w) <= maxH) { id = ORDER[i]; sc = maxW / w; break; }
      }
      if (!id) { id = 'wide'; sc = Math.min(maxW / DATA.variants.wide[0].w, maxH / unitsH); }
      var v = variant(id);
      var bw = v[0].w * sc, bh = unitsH * sc;
      block = { x: (W - bw) / 2, y: H * (opts.centerY || 0.46) - bh / 2, w: bw, h: bh, cap: DATA.cap * sc };
      lines = v.map(function (l, n) {
        return { path: l.path, sx: bw / l.w, sy: sc, x: block.x, y: block.y + n * DATA.cap * (1 + GAP) * sc, boxes: l.boxes };
      });
      // A porta: a haste da letra escolhida na primeira linha
      var b = lines[0].boxes.filter(function (q) { return q.ch === doorChar; })[0] || lines[0].boxes[0];
      door = {
        x: lines[0].x + b.x * lines[0].sx, y: lines[0].y, w: b.w * lines[0].sx, h: DATA.cap * sc
      };
      door.cx = door.x + door.w / 2; door.cy = door.y + door.h / 2;
      cleared = false;
    }

    // Desenha o nome inteiro num plano da parede, com zoom z ao redor do ponto de mira
    function fillPlane(ctx, z, ax, ay, ox, oy) {
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        ctx.setTransform(l.sx * z * dpr, 0, 0, l.sy * z * dpr,
          (W / 2 + (l.x - ax) * z + ox) * dpr, (H / 2 + (l.y - ay) * z + oy) * dpr);
        ctx.fill(l.path);
      }
    }
    function sideColor(u) {
      var t = Math.pow(u, 1.7);
      return 'rgb(' + Math.round(lerp(near[0], far[0], t)) + ',' + Math.round(lerp(near[1], far[1], t)) + ',' + Math.round(lerp(near[2], far[2], t)) + ')';
    }

    // s: quanto a câmera andou (0 = parada, 1 = encostou na parede, 1 + T = saiu do outro lado)
    // px, py: posição do cursor de -1 a 1
    // Devolve true quando a câmera já atravessou (nada a desenhar).
    function render(state) {
      var s = state.s || 0;
      function zAt(u) { var d = 1 + u * T - s; return d > EPS ? 1 / d : 0; }
      var zf = zAt(0), zb = zAt(1);
      if (!zb) {
        if (!cleared) {
          cs.setTransform(1, 0, 0, 1, 0, 0); cs.clearRect(0, 0, sides.width, sides.height);
          cf.setTransform(1, 0, 0, 1, 0, 0); cf.clearRect(0, 0, front.width, front.height);
          cleared = true;
        }
        return true;
      }
      cleared = false;
      // A mira vai do centro da tela até o centro da porta enquanto a câmera avança
      var aim = smooth(0, 0.72, s);
      var ax = lerp(W / 2, door.cx, aim), ay = lerp(H / 2, door.cy, aim);
      // O cursor só desloca os planos de trás: a face da frente fica parada
      var fade = 1 - smooth(0, 0.3, s);
      var par = Math.min(W, 1400) * 0.16;
      var mx = (state.px || 0) * par * fade, my = (state.py || 0) * par * fade;
      var zref = zf || 1 / EPS;

      // Laterais
      var first = 0;
      while (first < STEPS && !zAt(first / STEPS)) first++;
      cs.globalCompositeOperation = 'source-over';
      cs.setTransform(1, 0, 0, 1, 0, 0);
      cs.fillStyle = sideColor(Math.max(0, first - 1) / STEPS);
      cs.fillRect(0, 0, sides.width, sides.height);
      for (var i = Math.max(1, first); i < STEPS; i++) {
        var z = zAt(i / STEPS);
        cs.fillStyle = sideColor(i / STEPS);
        fillPlane(cs, z, ax, ay, mx * (zref - z), my * (zref - z));
      }
      cs.globalCompositeOperation = 'destination-out';
      cs.fillStyle = '#000';
      fillPlane(cs, zb, ax, ay, mx * (zref - zb), my * (zref - zb));

      // Face da frente
      cf.globalCompositeOperation = 'source-over';
      cf.setTransform(1, 0, 0, 1, 0, 0);
      if (zf) {
        cf.fillStyle = wallColor;
        cf.fillRect(0, 0, front.width, front.height);
        cf.globalCompositeOperation = 'destination-out';
        cf.fillStyle = '#000';
        fillPlane(cf, zf, ax, ay, 0, 0);
      } else {
        cf.clearRect(0, 0, front.width, front.height);
      }
      return false;
    }

    layout();
    return {
      layout: layout,
      render: render,
      get block() { return block; },
      get door() { return door; },
      thickness: T,
      // troca as cores das laterais do recorte: [r, g, b] de 0 a 255
      setColors: function (n, f) { near = n; far = f; },
      end: 1 + T + 0.01 // valor de s em que a câmera já saiu do outro lado
    };
  }

  // Converte o progresso da rolagem (0 a 1) em avanço da câmera.
  // O zoom cresce de forma exponencial (velocidade constante para o olho) até
  // a câmera chegar perto da parede; o trecho final atravessa a espessura.
  function travel(p, wall) {
    var Z1 = 26, p1 = 0.8;
    if (p <= 0) return 0;
    if (p < p1) return 1 - Math.exp(-Math.log(Z1) * (p / p1));
    var s1 = 1 - 1 / Z1;
    return lerp(s1, wall.end, (p - p1) / (1 - p1));
  }

  window.HRWall = { create: create, travel: travel };
})();
