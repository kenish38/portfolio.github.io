// ===== A parede com o nome recortado =====
// A abertura é uma parede preta e o nome é um buraco nela. A parede tem
// espessura: dá para ver as laterais do recorte, que mudam com o cursor.
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
  var ORDER = ['tall', 'mid', 'wide']; // da versão mais alta para a mais larga

  function lerp(a, b, t) { return a + (b - a) * t; }

  // opts: { thickness, steps, sideNear, sideFar, wall, maxHeight, centerY }
  function create(root, opts) {
    opts = opts || {};
    var T = opts.thickness || 0.04;            // espessura da parede
    var STEPS = opts.steps || 9;               // degraus de sombra na lateral
    var near = opts.sideNear || [7, 7, 9];      // cor da lateral perto da frente
    var far = opts.sideFar || [78, 60, 58];     // cor da lateral perto do fundo (pega a luz de trás)
    var wallColor = opts.wall || '#000';

    function mk(cls) {
      var c = document.createElement('canvas');
      c.className = cls; c.setAttribute('aria-hidden', 'true');
      root.appendChild(c); return c;
    }
    var sides = mk('wall__sides'), front = mk('wall__front');
    var cs = sides.getContext('2d'), cf = front.getContext('2d');
    var W = 0, H = 0, dpr = 1, lines = [], block = null;

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
      // a versão mais alta do nome que cabe na largura sem passar da altura máxima
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
        return { path: l.path, sx: bw / l.w, sy: sc, x: block.x, y: block.y + n * DATA.cap * (1 + GAP) * sc };
      });
    }

    // Desenha o nome inteiro num plano da parede: z é o tamanho do plano (1 = a face da frente, menor = mais fundo),
    // em volta do centro da tela, deslocado de (ox, oy)
    function fillPlane(ctx, z, ox, oy) {
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        ctx.setTransform(l.sx * z * dpr, 0, 0, l.sy * z * dpr,
          (W / 2 + (l.x - W / 2) * z + ox) * dpr, (H / 2 + (l.y - H / 2) * z + oy) * dpr);
        ctx.fill(l.path);
      }
    }
    function sideColor(u) {
      var t = Math.pow(u, 1.7);
      return 'rgb(' + Math.round(lerp(near[0], far[0], t)) + ',' + Math.round(lerp(near[1], far[1], t)) + ',' + Math.round(lerp(near[2], far[2], t)) + ')';
    }
    // tamanho do plano a uma fração u da espessura (0 = frente, 1 = fundo)
    function zAt(u) { return 1 / (1 + u * T); }

    // px, py: posição do cursor de -1 a 1. Ele só desloca os planos de trás: a face da frente fica parada.
    function render(px, py) {
      var par = Math.min(W, 1400) * 0.16, mx = px * par, my = py * par, zb = zAt(1);

      // Laterais
      cs.globalCompositeOperation = 'source-over';
      cs.setTransform(1, 0, 0, 1, 0, 0);
      cs.fillStyle = sideColor(0);
      cs.fillRect(0, 0, sides.width, sides.height);
      for (var i = 1; i < STEPS; i++) {
        var z = zAt(i / STEPS);
        cs.fillStyle = sideColor(i / STEPS);
        fillPlane(cs, z, mx * (1 - z), my * (1 - z));
      }
      cs.globalCompositeOperation = 'destination-out';
      cs.fillStyle = '#000';
      fillPlane(cs, zb, mx * (1 - zb), my * (1 - zb));

      // Face da frente
      cf.globalCompositeOperation = 'source-over';
      cf.setTransform(1, 0, 0, 1, 0, 0);
      cf.fillStyle = wallColor;
      cf.fillRect(0, 0, front.width, front.height);
      cf.globalCompositeOperation = 'destination-out';
      cf.fillStyle = '#000';
      fillPlane(cf, 1, 0, 0);
    }

    layout();
    return {
      layout: layout,
      render: render,
      get block() { return block; }     // onde o nome ficou na tela: { x, y, w, h, cap }
    };
  }

  window.HRWall = { create: create };
})();
