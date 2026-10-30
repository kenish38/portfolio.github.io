// ===== Troca de idioma (EN / PT-BR) =====
// O HTML já vem em inglês. Cada elemento traduzível guarda o português em
// data-pt (e data-pt-alt / data-pt-aria-label para atributos).
(function () {
  var buttons = document.querySelectorAll('.lang button');
  if (!buttons.length) return;
  var KEY = 'site-lang';

  function apply(lang) {
    var pt = lang === 'pt';
    document.documentElement.lang = pt ? 'pt-BR' : 'en';
    document.querySelectorAll('[data-pt]').forEach(function (el) {
      if (el.dataset.en === undefined) el.dataset.en = el.textContent;
      el.textContent = pt ? el.dataset.pt : el.dataset.en;
    });
    [['alt', 'ptAlt', 'enAlt'], ['aria-label', 'ptAriaLabel', 'enAriaLabel']].forEach(function (a) {
      document.querySelectorAll('[data-pt-' + a[0] + ']').forEach(function (el) {
        if (el.dataset[a[2]] === undefined) el.dataset[a[2]] = el.getAttribute(a[0]);
        el.setAttribute(a[0], pt ? el.dataset[a[1]] : el.dataset[a[2]]);
      });
    });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      apply(b.dataset.lang);
      try { localStorage.setItem(KEY, b.dataset.lang); } catch (e) {}
    });
  });

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'pt') apply('pt');
})();

// ===== Vidro embaçado com chuva na abertura =====
// Atrás do vidro fica uma imagem (data-scene no <canvas>). O cursor é uma
// lanterna que desembaça o vidro por onde passa; a névoa volta aos poucos.
// Gotas escorrem e abrem trilhas, e um clique chama um relâmpago.
(function () {
  var hero = document.querySelector('.hero');
  var canvas = document.querySelector('.hero__glass');
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ----- Ajustes -----
  var DROPS = 260;          // gotinhas paradas no vidro
  var RUNNERS = 16;         // gotas grandes que escorrem
  var RAIN = 90;            // fios de chuva lá fora
  var WIPE_RADIUS = 66;     // tamanho da área desembaçada pelo cursor
  var FOG_RETURN = 0.32;    // velocidade com que a névoa volta
  var LIGHT_RADIUS = 260;   // alcance da luz da lanterna
  var RED = '220, 43, 38';

  var W = 0, H = 0, dpr = 1;
  var scene = document.createElement('canvas');   // cena nítida
  var blurred = document.createElement('canvas'); // cena vista pelo vidro embaçado
  var mask = document.createElement('canvas');    // onde o vidro está limpo
  var clear = document.createElement('canvas');   // cena nítida recortada pela máscara
  var brush = document.createElement('canvas');   // pincel macio para limpar
  var sctx = scene.getContext('2d'), bctx = blurred.getContext('2d');
  var mctx = mask.getContext('2d'), cctx = clear.getContext('2d');

  var img = new Image();
  var drops = [], runners = [], rain = [];
  var pointer = { x: 0, y: 0, px: 0, py: 0, inside: false, moved: false };
  var light = { x: 0, y: 0, power: 0 };
  var flash = -1, fogDebt = 0, last = 0, running = false, visible = true;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeBrush() {
    var s = 128;
    brush.width = brush.height = s;
    var b = brush.getContext('2d');
    var g = b.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = g;
    b.fillRect(0, 0, s, s);
  }

  function paintScene() {
    var c = sctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    if (img.naturalWidth) {
      var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      var iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      c.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
      c.globalCompositeOperation = 'saturation'; // preto e branco
      c.fillStyle = '#808080';
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
    }
    c.fillStyle = 'rgba(0, 0, 0, 0.5)'; // noite
    c.fillRect(0, 0, W, H);

    // Lua
    var mx = W * 0.8, my = H * 0.24, mr = Math.min(W, H) * 0.045;
    var halo = c.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, W, H);
    var face = c.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
    face.addColorStop(0, '#f6f5f1');
    face.addColorStop(1, '#cfcdc6');
    c.fillStyle = face;
    c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.fill();

    // Luzes vermelhas ao longe
    var lights = [[0.6, 0.74, 1], [0.71, 0.7, 0.7], [0.84, 0.78, 1.2], [0.93, 0.68, 0.6], [0.46, 0.82, 0.8]];
    lights.forEach(function (l) {
      var x = W * l[0], y = H * l[1], r = Math.min(W, H) * 0.014 * l[2];
      var g = c.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, 'rgba(255, 210, 200, 1)');
      g.addColorStop(0.12, 'rgba(' + RED + ', 1)');
      g.addColorStop(0.35, 'rgba(' + RED + ', 0.35)');
      g.addColorStop(1, 'rgba(' + RED + ', 0)');
      c.fillStyle = g;
      c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    });

    // Versão embaçada: reduz e amplia a cena (funciona em todos os navegadores)
    var small = document.createElement('canvas');
    small.width = Math.max(8, Math.round(W / 16));
    small.height = Math.max(8, Math.round(H / 16));
    var sm = small.getContext('2d');
    sm.imageSmoothingQuality = 'high';
    var mid = document.createElement('canvas');
    mid.width = Math.max(16, Math.round(W / 4));
    mid.height = Math.max(16, Math.round(H / 4));
    var md = mid.getContext('2d');
    md.imageSmoothingQuality = 'high';
    md.drawImage(scene, 0, 0, mid.width, mid.height);
    sm.drawImage(mid, 0, 0, small.width, small.height);
    md.clearRect(0, 0, mid.width, mid.height);
    md.drawImage(small, 0, 0, mid.width, mid.height);

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(mid, 0, 0, blurred.width, blurred.height);
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Névoa do vidro: mais densa embaixo, onde a condensação acumula
    var fog = bctx.createLinearGradient(0, 0, 0, H);
    fog.addColorStop(0, 'rgba(235, 235, 235, 0.06)');
    fog.addColorStop(1, 'rgba(235, 235, 235, 0.14)');
    bctx.fillStyle = fog;
    bctx.fillRect(0, 0, W, H);
  }

  function newDrop() {
    return { x: rand(0, W), y: rand(0, H), r: Math.pow(Math.random(), 2.2) * 3.6 + 0.8 };
  }
  function newRunner(top) {
    return {
      x: rand(0, W), y: top ? rand(-H * 0.3, -10) : rand(0, H),
      r: rand(3, 6.5), v: rand(40, 140), wait: rand(0, 2), drift: rand(-0.3, 0.3)
    };
  }
  function newStreak() {
    return { x: rand(-W * 0.1, W * 1.1), y: rand(-H, H), len: rand(12, 34), v: rand(700, 1100) };
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    [canvas, scene, blurred, mask, clear].forEach(function (c) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScene();
    drops = []; runners = []; rain = [];
    for (var i = 0; i < DROPS; i++) drops.push(newDrop());
    for (i = 0; i < RUNNERS; i++) runners.push(newRunner(false));
    for (i = 0; i < RAIN; i++) rain.push(newStreak());
    light.x = W * 0.8; light.y = H * 0.24;
  }

  function wipe(x, y, radius, strength) {
    mctx.globalAlpha = strength;
    mctx.drawImage(brush, x - radius, y - radius, radius * 2, radius * 2);
    mctx.globalAlpha = 1;
  }

  function wipeLine(x0, y0, x1, y1, radius) {
    var dist = Math.hypot(x1 - x0, y1 - y0);
    var steps = Math.max(1, Math.ceil(dist / (radius * 0.3)));
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      wipe(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, 0.5);
    }
    // Limpar o vidro também remove as gotinhas daquele trecho
    for (var d = drops.length - 1; d >= 0; d--) {
      var dx = drops[d].x - x1, dy = drops[d].y - y1;
      if (dx * dx + dy * dy < radius * radius * 0.6) drops.splice(d, 1);
    }
  }

  function flashLevel(t) {
    if (t < 0) return 0;
    if (t < 0.06) return 1;
    if (t < 0.13) return 0.12;
    if (t < 0.2) return 0.75;
    return Math.max(0, 0.75 * (1 - (t - 0.2) / 0.7));
  }

  function frame(now) {
    var dt = Math.min((now - last) / 1000 || 0, 0.05);
    last = now;
    var still = reduceMotion.matches;

    // A névoa volta aos poucos
    fogDebt += FOG_RETURN * dt;
    if (fogDebt > 0.03) {
      mctx.globalCompositeOperation = 'destination-out';
      mctx.fillStyle = 'rgba(0,0,0,' + Math.min(fogDebt, 1).toFixed(3) + ')';
      mctx.fillRect(0, 0, W, H);
      mctx.globalCompositeOperation = 'source-over';
      fogDebt = 0;
    }

    // Cursor desembaça
    if (pointer.moved) {
      wipeLine(pointer.px, pointer.py, pointer.x, pointer.y, WIPE_RADIUS);
      pointer.px = pointer.x; pointer.py = pointer.y;
      pointer.moved = false;
    }

    // Lanterna acompanha o cursor; sem cursor, descansa perto da lua
    var tx = pointer.inside ? pointer.x : W * 0.8;
    var ty = pointer.inside ? pointer.y : H * 0.24;
    var k = still ? 1 : 1 - Math.pow(0.0001, dt);
    light.x += (tx - light.x) * k;
    light.y += (ty - light.y) * k;
    light.power += ((pointer.inside ? 1 : 0.35) - light.power) * (still ? 1 : 1 - Math.pow(0.02, dt));

    // Gotas que escorrem: param, aceleram e deixam trilha limpa
    if (!still) {
      runners.forEach(function (d, i) {
        if (d.wait > 0) { d.wait -= dt; return; }
        d.y += d.v * dt;
        d.x += d.drift;
        if (Math.random() < dt * 0.6) d.wait = rand(0.2, 1.4);
        wipe(d.x, d.y, d.r * 1.3, 0.35);
        if (Math.random() < dt * 3) drops.push({ x: d.x + rand(-1, 1), y: d.y - d.r * 2, r: rand(0.8, 1.8) });
        if (d.y > H + 20) runners[i] = newRunner(true);
      });
      rain.forEach(function (s, i) {
        s.y += s.v * dt; s.x -= s.v * dt * 0.08;
        if (s.y > H + 40) { rain[i] = newStreak(); rain[i].y = rand(-80, -20); }
      });
      // Gotinhas novas caem no vidro
      if (drops.length < DROPS && Math.random() < dt * 40) drops.push(newDrop());
      if (drops.length > DROPS * 1.4) drops.splice(0, drops.length - DROPS * 1.4);
      if (flash >= 0) flash += dt;
    }

    // ----- Desenho -----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(blurred, 0, 0);

    // Partes limpas mostram a cena nítida
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.globalCompositeOperation = 'source-over';
    cctx.clearRect(0, 0, clear.width, clear.height);
    cctx.drawImage(scene, 0, 0);
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(mask, 0, 0);
    ctx.drawImage(clear, 0, 0);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Relâmpago: a cena aparece inteira por um instante
    var f = flashLevel(flash);
    if (f > 0) {
      ctx.globalAlpha = f * 0.9;
      ctx.drawImage(scene, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(210, 220, 255, ' + (f * 0.28).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Chuva lá fora
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    rain.forEach(function (s) {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len * 0.08, s.y + s.len);
    });
    ctx.stroke();

    // Luz da lanterna
    var lp = light.power;
    var g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, LIGHT_RADIUS);
    g.addColorStop(0, 'rgba(255, 252, 240, ' + (0.2 * lp).toFixed(3) + ')');
    g.addColorStop(0.35, 'rgba(255, 252, 240, ' + (0.07 * lp).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255, 252, 240, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(light.x - LIGHT_RADIUS, light.y - LIGHT_RADIUS, LIGHT_RADIUS * 2, LIGHT_RADIUS * 2);
    ctx.globalCompositeOperation = 'source-over';

    // Gotas no vidro: sombra embaixo, corpo claro, brilho que reage à luz
    var all = drops.concat(runners);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    all.forEach(function (d) { ctx.moveTo(d.x + d.r, d.y + d.r * 0.3); ctx.arc(d.x, d.y + d.r * 0.3, d.r, 0, Math.PI * 2); });
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    all.forEach(function (d) { ctx.moveTo(d.x + d.r * 0.92, d.y); ctx.arc(d.x, d.y, d.r * 0.92, 0, Math.PI * 2); });
    ctx.fill();
    var lr2 = LIGHT_RADIUS * LIGHT_RADIUS;
    all.forEach(function (d) {
      var dx = d.x - light.x, dy = d.y - light.y;
      var near = Math.max(0, 1 - (dx * dx + dy * dy) / lr2) * lp + f;
      var a = 0.22 + 0.7 * Math.min(near, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, ' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, Math.max(d.r * 0.3, 0.6), 0, Math.PI * 2);
      ctx.fill();
    });
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
  function local(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return; // no celular, só o toque desembaça
    var p = local(e);
    if (!pointer.inside) { pointer.px = p.x; pointer.py = p.y; }
    pointer.x = p.x; pointer.y = p.y;
    pointer.inside = true;
    pointer.moved = true;
  });
  hero.addEventListener('pointerleave', function () { pointer.inside = false; });
  hero.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button')) return;
    var p = local(e);
    pointer.x = pointer.px = p.x; pointer.y = pointer.py = p.y;
    pointer.inside = e.pointerType !== 'touch';
    wipe(p.x, p.y, WIPE_RADIUS * 1.2, 1);
    pointer.moved = true;
    if (!reduceMotion.matches) flash = 0;
  });

  window.addEventListener('resize', function () {
    var rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - W) < 1 && Math.abs(rect.height - H) < 60) return; // barra do celular
    resize();
    if (!running) frame(performance.now());
  });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
  }

  makeBrush();
  resize();
  img.onload = function () { paintScene(); };
  img.src = canvas.dataset.scene;
  start();
})();
