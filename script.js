// Terreno interativo da abertura.
// Desenha um relevo em linhas, visto em perspectiva, que o cursor "esculpe"
// como o pincel de Terrain do Roblox Studio. Sem bibliotecas: só canvas 2D.
(function () {
  var hero = document.querySelector('.hero');
  var canvas = document.querySelector('.hero__terrain');
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ----- Ajustes visuais -----
  var ROWS = 58;            // linhas de relevo
  var COLS = 112;           // pontos por linha
  var CAM_HEIGHT = 3;       // altura da câmera sobre o "nível do mar"
  var DEPTH = 9;            // distância até o horizonte, em múltiplos da linha mais próxima
  var SPEED = 0.55;         // velocidade do sobrevoo (unidades por segundo)
  var BRUSH_RADIUS = 2.4;   // raio do pincel, em unidades do mundo
  var BRUSH_LIFT = 1.9;     // quanto o pincel levanta o terreno
  var NIGHT = '#0f1a1e';
  var LINE_RGB = '108, 140, 146';
  var LIGHT_RGB = '242, 166, 90';

  // ----- Ruído suave (value noise) para gerar montanhas -----
  var perm = new Uint8Array(512);
  (function () {
    var p = [], i, j, t, seed = 7;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      seed = (seed * 16807) % 2147483647;
      j = seed % (i + 1);
      t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  function hash(x, y) { return perm[(x & 255) + perm[y & 255]] / 255; }
  function noise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function relief(x, z) {
    var n = noise(x * 0.16, z * 0.16) * 0.62 +
            noise(x * 0.34, z * 0.34) * 0.26 +
            noise(x * 0.8, z * 0.8) * 0.12;
    return Math.max(n - 0.4, 0);
  }

  // ----- Estado -----
  var width = 0, height = 0, dpr = 1;
  var focal, horizon, zNear, zFar, spread;
  var lift = new Float32Array(ROWS * COLS); // quanto o pincel já levantou cada ponto
  var px = new Float32Array(COLS), py = new Float32Array(COLS);
  var travel = 0, intro = 0, last = 0;
  var pointer = { x: 0, y: 0, active: false, pressed: false, lastMove: -1e9 };
  var brush = { x: 0, z: 0, strength: 0 };
  var running = false, visible = true;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    focal = Math.max(height, width * 0.55) * 0.95;
    horizon = height * (width < 700 ? 0.58 : 0.5);
    zNear = focal * CAM_HEIGHT / (height - horizon) * 0.92;
    zFar = zNear * DEPTH;
    spread = (width / 2) / focal * 1.08; // largura visível por unidade de profundidade
  }

  // Converte um ponto da tela para o chão (altura 0) do mundo.
  function screenToGround(sx, sy) {
    var dy = Math.max(sy - horizon, 4);
    var z = focal * CAM_HEIGHT / dy;
    return { x: (sx - width / 2) * z / focal, z: z };
  }

  function frame(now) {
    var dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    var still = reduceMotion.matches;

    if (!still) travel += SPEED * dt;
    intro = still ? 1 : Math.min(intro + dt / 1.8, 1);
    var rise = 1 - Math.pow(1 - intro, 3);

    // Onde está o pincel: no cursor ou, sem cursor, passeando sozinho.
    var idle = !pointer.active || now - pointer.lastMove > 2600;
    var target;
    if (idle && still) {
      target = brush; // sem animação automática para quem pediu menos movimento
    } else if (idle) {
      var t = now / 1000;
      target = screenToGround(width * (0.62 + 0.2 * Math.sin(t * 0.23)),
                              horizon + (height - horizon) * (0.42 + 0.14 * Math.sin(t * 0.31)));
    } else {
      target = screenToGround(pointer.x, pointer.y);
    }
    var follow = still ? 1 : 1 - Math.pow(0.002, dt);
    brush.x += (target.x - brush.x) * follow;
    brush.z += (target.z - brush.z) * follow;
    var wanted = idle ? 0.55 : (pointer.pressed ? 1.6 : 1);
    brush.strength += (wanted - brush.strength) * (still ? 1 : 1 - Math.pow(0.05, dt));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Luz quente que acompanha o pincel.
    var light = screenOf(brush.x, 0, brush.z);
    var glow = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, Math.max(width, height) * 0.28);
    glow.addColorStop(0, 'rgba(' + LIGHT_RGB + ', ' + Math.min(0.45 + 0.55 * brush.strength, 1).toFixed(3) + ')');
    glow.addColorStop(0.4, 'rgba(' + LIGHT_RGB + ', 0.22)');
    glow.addColorStop(1, 'rgba(' + LIGHT_RGB + ', 0)');

    var step = (zFar - zNear) / (ROWS - 1);
    var offset = travel % step;
    var ease = 1 - Math.pow(0.0005, dt);
    var r2 = 2 * BRUSH_RADIUS * BRUSH_RADIUS;

    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;

    // Desenha do fundo para a frente: cada linha cobre o que está atrás dela.
    for (var r = ROWS - 1; r >= 0; r--) {
      var z = zNear + r * step - offset;
      var worldZ = z + travel;
      var halfW = z * spread;
      var amp = (0.5 + z * 0.1) * 3.4 * rise;
      var depthFade = Math.min((zFar - z) / (step * 6), 1) * Math.min((z - zNear + step) / (step * 2), 1);

      for (var c = 0; c < COLS; c++) {
        var u = c / (COLS - 1) * 2 - 1;
        var x = u * halfW;
        var i = r * COLS + c;
        var dx = x - brush.x, dz = z - brush.z;
        var want = Math.exp(-(dx * dx + dz * dz) / r2) * BRUSH_LIFT * brush.strength;
        lift[i] += (want - lift[i]) * (still ? 1 : ease);
        var h = relief(x, worldZ) * amp + lift[i];
        px[c] = width / 2 + x * focal / z;
        py[c] = horizon + (CAM_HEIGHT - h) * focal / z;
      }

      ctx.beginPath();
      ctx.moveTo(px[0], py[0]);
      for (c = 1; c < COLS; c++) ctx.lineTo(px[c], py[c]);
      var ridge = new Path2D();
      ridge.moveTo(px[0], py[0]);
      for (c = 1; c < COLS; c++) ridge.lineTo(px[c], py[c]);

      ctx.lineTo(px[COLS - 1], height + 2);
      ctx.lineTo(px[0], height + 2);
      ctx.closePath();
      ctx.fillStyle = NIGHT;
      ctx.fill();

      if (depthFade <= 0) continue;
      ctx.globalAlpha = depthFade;
      ctx.strokeStyle = 'rgba(' + LINE_RGB + ', ' + (0.2 + 0.4 * (1 - r / ROWS)).toFixed(3) + ')';
      ctx.stroke(ridge);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.6;
      ctx.stroke(ridge);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
    }
  }

  function screenOf(x, h, z) {
    return { x: width / 2 + x * focal / z, y: horizon + (CAM_HEIGHT - h) * focal / z };
  }

  function loop(now) {
    if (!running) return;
    frame(now);
    requestAnimationFrame(loop);
  }
  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
  function stop() { running = false; }

  // ----- Eventos -----
  function onMove(e) {
    var rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = true;
    pointer.lastMove = performance.now();
  }
  hero.addEventListener('pointermove', onMove);
  hero.addEventListener('pointerdown', function (e) { onMove(e); pointer.pressed = true; });
  window.addEventListener('pointerup', function () { pointer.pressed = false; });
  hero.addEventListener('pointerleave', function () { pointer.active = false; pointer.pressed = false; });

  window.addEventListener('resize', function () { resize(); if (!running) frame(performance.now()); });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
  }

  resize();
  var b = screenToGround(width * 0.62, horizon + (height - horizon) * 0.42);
  brush.x = b.x; brush.z = b.z;
  start();
})();
