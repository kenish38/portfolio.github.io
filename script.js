// ===== Vidro embaçado com chuva na abertura =====
// Atrás do vidro ficam as imagens dos projetos (data-scene de cada .work).
// Pelo vidro embaçado a cena aparece em preto e branco; onde o vidro está
// limpo, aparece em cor. O cursor é uma lanterna que desembaça o vidro, a
// névoa volta aos poucos, gotas escorrem e cada clique chama um relâmpago
// que troca para o próximo projeto.
(function () {
  var hero = document.querySelector('.hero');
  var canvas = document.querySelector('.hero__glass');
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ----- Ajustes -----
  var DROPS = 240;          // gotinhas paradas no vidro
  var RUNNERS = 14;         // gotas grandes que escorrem
  var RAIN = 80;            // fios de chuva lá fora
  var WIPE_RADIUS = 84;     // tamanho da área desembaçada pelo cursor
  var FOG_RETURN = 0.3;     // velocidade com que a névoa volta
  var LIGHT_RADIUS = 300;   // alcance da luz da lanterna

  var scenes = Array.prototype.map.call(document.querySelectorAll('.work[data-scene]'), function (el) {
    return { src: el.dataset.scene, id: el.id, img: null };
  });
  var reel = document.querySelectorAll('.reel__item');
  if (!scenes.length) return;

  var W = 0, H = 0, dpr = 1;
  var sharp = document.createElement('canvas');   // cena nítida, em cor
  var blurred = document.createElement('canvas'); // cena vista pelo vidro embaçado
  var mask = document.createElement('canvas');    // onde o vidro está limpo
  var clear = document.createElement('canvas');   // cena nítida recortada pela máscara
  var brush = document.createElement('canvas');   // pincel macio para limpar
  var sctx = sharp.getContext('2d'), bctx = blurred.getContext('2d');
  var mctx = mask.getContext('2d'), cctx = clear.getContext('2d');

  var current = 0, ready = false;
  var drops = [], runners = [], rain = [], bolt = [];
  var pointer = { x: 0, y: 0, px: 0, py: 0, inside: false, down: false, moved: false };
  var light = { x: 0, y: 0, power: 0 };
  var auto = -1;            // passada automática do "limpador" ao carregar
  var flash = -1, switched = true, fogDebt = 0, last = 0;
  var running = false, visible = true, dirty = true;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function loadScene(i, done) {
    var s = scenes[i];
    if (s.img && s.img.complete && s.img.naturalWidth) { done(); return; }
    if (!s.img) { s.img = new Image(); s.img.src = s.src; }
    s.img.addEventListener('load', done, { once: true });
  }

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
    var img = scenes[current].img;
    var c = sctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    if (img && img.naturalWidth) {
      var s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      var iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      c.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
    }
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.fillRect(0, 0, W, H);

    // Versão embaçada: preto e branco, reduzida e ampliada (funciona em todos os navegadores)
    var mid = document.createElement('canvas');
    mid.width = Math.max(16, Math.round(W / 4));
    mid.height = Math.max(16, Math.round(H / 4));
    var md = mid.getContext('2d');
    md.imageSmoothingQuality = 'high';
    md.drawImage(sharp, 0, 0, mid.width, mid.height);
    md.globalCompositeOperation = 'saturation';
    md.fillStyle = '#808080';
    md.fillRect(0, 0, mid.width, mid.height);
    md.globalCompositeOperation = 'source-over';
    var small = document.createElement('canvas');
    small.width = Math.max(8, Math.round(W / 16));
    small.height = Math.max(8, Math.round(H / 16));
    var sm = small.getContext('2d');
    sm.imageSmoothingQuality = 'high';
    sm.drawImage(mid, 0, 0, small.width, small.height);
    md.clearRect(0, 0, mid.width, mid.height);
    md.drawImage(small, 0, 0, mid.width, mid.height);

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(mid, 0, 0, blurred.width, blurred.height);
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    bctx.fillRect(0, 0, W, H);
    // Névoa do vidro: mais densa embaixo, onde a condensação acumula
    var fog = bctx.createLinearGradient(0, 0, 0, H);
    fog.addColorStop(0, 'rgba(235, 235, 235, 0.05)');
    fog.addColorStop(1, 'rgba(235, 235, 235, 0.13)');
    bctx.fillStyle = fog;
    bctx.fillRect(0, 0, W, H);
    dirty = true;
  }

  function showScene(i) {
    current = (i + scenes.length) % scenes.length;
    reel.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + scenes[current].id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    loadScene(current, function () { paintScene(); ready = true; });
    // Já deixa a próxima carregando
    loadScene((current + 1) % scenes.length, function () {});
  }

  function newDrop() {
    return { x: rand(0, W), y: rand(0, H), r: Math.pow(Math.random(), 2.2) * 3.6 + 0.8, glint: Math.random() };
  }
  function newRunner(top) {
    return {
      x: rand(0, W), y: top ? rand(-H * 0.3, -10) : rand(0, H), glint: Math.random(),
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
    [canvas, sharp, blurred, mask, clear].forEach(function (c) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    });
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ready) paintScene();
    drops = []; runners = []; rain = [];
    for (var i = 0; i < DROPS; i++) drops.push(newDrop());
    for (i = 0; i < RUNNERS; i++) runners.push(newRunner(false));
    for (i = 0; i < RAIN; i++) rain.push(newStreak());
    light.x = W * 0.75; light.y = H * 0.35;
    dirty = true;
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
    var r2 = radius * radius * 0.6;
    drops = drops.filter(function (d) {
      var dx = d.x - x1, dy = d.y - y1;
      return dx * dx + dy * dy >= r2;
    });
  }

  function makeBolt(x) {
    var pts = [[x, -10]], y = -10, px = x;
    while (y < H * rand(0.45, 0.7)) {
      y += rand(18, 46);
      px += rand(-38, 38);
      pts.push([px, y]);
    }
    return pts;
  }

  function lightning(x) {
    if (reduceMotion.matches) { showScene(current + 1); return; }
    flash = 0;
    switched = false;
    bolt = makeBolt(x == null ? rand(W * 0.5, W * 0.9) : x);
  }

  function flashLevel(t) {
    if (t < 0) return 0;
    if (t < 0.07) return 1;
    if (t < 0.14) return 0.15;
    if (t < 0.22) return 0.85;
    return Math.max(0, 0.85 * (1 - (t - 0.22) / 0.8));
  }

  // Caminho da passada automática (em frações da tela)
  function autoPoint(t) {
    var e = t * t * (3 - 2 * t);
    return { x: W * (0.48 + 0.5 * e), y: H * (0.3 + 0.22 * Math.sin(e * Math.PI * 1.4)) };
  }

  function drawDrops(list, lp, f) {
    var i, d;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    for (i = 0; i < list.length; i++) { d = list[i]; ctx.moveTo(d.x + d.r, d.y + d.r * 0.3); ctx.arc(d.x, d.y + d.r * 0.3, d.r, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    for (i = 0; i < list.length; i++) { d = list[i]; ctx.moveTo(d.x + d.r * 0.92, d.y); ctx.arc(d.x, d.y, d.r * 0.92, 0, Math.PI * 2); }
    ctx.fill();
    // Brilho de cada gota, agrupado em 4 faixas de intensidade (mais leve que uma por uma)
    var lr2 = LIGHT_RADIUS * LIGHT_RADIUS;
    var buckets = [[], [], [], []];
    for (i = 0; i < list.length; i++) {
      d = list[i];
      var dx = d.x - light.x, dy = d.y - light.y;
      var near = Math.min(Math.max(0, 1 - (dx * dx + dy * dy) / lr2) * lp + f, 1);
      buckets[Math.min(3, Math.floor(near * 4))].push(d);
    }
    for (var b = 0; b < 4; b++) {
      if (!buckets[b].length) continue;
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.22 + 0.24 * b).toFixed(2) + ')';
      ctx.beginPath();
      buckets[b].forEach(function (d) {
        var r = Math.max(d.r * 0.3, 0.6);
        ctx.moveTo(d.x - d.r * 0.3 + r, d.y - d.r * 0.35);
        ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.35, r, 0, Math.PI * 2);
      });
      ctx.fill();
    }
  }

  function frame(now) {
    var dt = Math.min(Math.max((now - last) / 1000 || 0, 0), 0.05);
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

    // Passada automática ao carregar, para mostrar que o vidro é interativo
    if (auto >= 0 && auto < 1 && ready && !still) {
      var a0 = autoPoint(auto);
      auto = Math.min(auto + dt / 1.6, 1);
      var a1 = autoPoint(auto);
      wipeLine(a0.x, a0.y, a1.x, a1.y, WIPE_RADIUS);
      if (!pointer.inside) { light.x = a1.x; light.y = a1.y; light.power = Math.max(light.power, 0.8); }
    }

    // Cursor (ou dedo arrastando) desembaça
    if (pointer.moved) {
      wipeLine(pointer.px, pointer.py, pointer.x, pointer.y, WIPE_RADIUS);
      pointer.px = pointer.x; pointer.py = pointer.y;
      pointer.moved = false;
    }

    // Lanterna acompanha o cursor; sem cursor, fica fraca no canto direito
    var tx = pointer.inside ? pointer.x : light.x;
    var ty = pointer.inside ? pointer.y : light.y;
    var k = still ? 1 : 1 - Math.pow(0.0001, dt);
    light.x += (tx - light.x) * k;
    light.y += (ty - light.y) * k;
    light.power += ((pointer.inside ? 1 : 0.3) - light.power) * (still ? 1 : 1 - Math.pow(0.1, dt));

    // Gotas que escorrem, chuva lá fora e relâmpago
    if (!still) {
      runners.forEach(function (d, i) {
        if (d.wait > 0) { d.wait -= dt; return; }
        d.y += d.v * dt;
        d.x += d.drift;
        if (Math.random() < dt * 0.6) d.wait = rand(0.2, 1.4);
        wipe(d.x, d.y, d.r * 1.3, 0.35);
        if (Math.random() < dt * 3) drops.push({ x: d.x + rand(-1, 1), y: d.y - d.r * 2, r: rand(0.8, 1.8), glint: 0 });
        if (d.y > H + 20) runners[i] = newRunner(true);
      });
      rain.forEach(function (s, i) {
        s.y += s.v * dt; s.x -= s.v * dt * 0.08;
        if (s.y > H + 40) { rain[i] = newStreak(); rain[i].y = rand(-80, -20); }
      });
      if (drops.length < DROPS && Math.random() < dt * 40) drops.push(newDrop());
      if (drops.length > DROPS * 1.4) drops.splice(0, drops.length - DROPS * 1.4);
      if (flash >= 0) {
        flash += dt;
        // No auge do clarão a cena troca para o próximo projeto
        if (!switched && flash > 0.04) { switched = true; showScene(current + 1); }
        if (flash > 1.2) flash = -1;
      }
    }

    // ----- Desenho -----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(blurred, 0, 0);

    // Partes limpas mostram a cena nítida e em cor
    cctx.globalCompositeOperation = 'source-over';
    cctx.clearRect(0, 0, clear.width, clear.height);
    cctx.drawImage(sharp, 0, 0);
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(mask, 0, 0);
    ctx.drawImage(clear, 0, 0);

    var f = flashLevel(flash);
    if (f > 0) {
      // Relâmpago: a cena aparece inteira, nítida e clara por um instante
      ctx.globalAlpha = Math.min(f * 1.1, 1);
      ctx.drawImage(sharp, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(225, 232, 255, ' + (f * 0.55).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (f > 0.5 && bolt.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + f.toFixed(3) + ')';
      ctx.shadowColor = 'rgba(200, 215, 255, 0.9)';
      ctx.shadowBlur = 24;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(bolt[0][0], bolt[0][1]);
      for (var p = 1; p < bolt.length; p++) ctx.lineTo(bolt[p][0], bolt[p][1]);
      ctx.stroke();
      ctx.restore();
    }

    // Chuva lá fora
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    rain.forEach(function (s) {
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len * 0.08, s.y + s.len);
    });
    ctx.stroke();

    // Luz da lanterna: branca no centro, com um halo vermelho fraco
    var lp = light.power;
    var g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, LIGHT_RADIUS);
    g.addColorStop(0, 'rgba(255, 250, 240, ' + (0.32 * lp).toFixed(3) + ')');
    g.addColorStop(0.3, 'rgba(255, 245, 235, ' + (0.12 * lp).toFixed(3) + ')');
    g.addColorStop(0.65, 'rgba(220, 43, 38, ' + (0.06 * lp).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(220, 43, 38, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(light.x - LIGHT_RADIUS, light.y - LIGHT_RADIUS, LIGHT_RADIUS * 2, LIGHT_RADIUS * 2);
    ctx.globalCompositeOperation = 'source-over';

    drawDrops(drops, lp, f);
    drawDrops(runners, lp, f);

    // Tremidinha no relâmpago
    canvas.style.transform = f > 0.8 && flash < 0.25 ? 'translate(' + rand(-3, 3).toFixed(1) + 'px,' + rand(-2, 2).toFixed(1) + 'px)' : '';
    dirty = false;
  }

  function loop(now) {
    if (!running) return;
    // Com movimento reduzido, só redesenha quando algo muda
    if (!reduceMotion.matches || dirty) frame(now);
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
    var touch = e.pointerType === 'touch';
    if (touch && !pointer.down) return;
    var p = local(e);
    if (!pointer.inside && !touch) { pointer.px = p.x; pointer.py = p.y; }
    pointer.x = p.x; pointer.y = p.y;
    if (!touch) pointer.inside = true;
    pointer.moved = true;
    dirty = true;
  });
  hero.addEventListener('pointerleave', function () { pointer.inside = false; });
  hero.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button')) return;
    var p = local(e);
    pointer.x = pointer.px = p.x; pointer.y = pointer.py = p.y;
    pointer.down = true;
    pointer.inside = e.pointerType !== 'touch';
    wipe(p.x, p.y, WIPE_RADIUS * 1.2, 1);
    pointer.moved = true;
    dirty = true;
    lightning(p.x);
  });
  window.addEventListener('pointerup', function () { pointer.down = false; });
  window.addEventListener('pointercancel', function () { pointer.down = false; });

  window.addEventListener('resize', function () {
    var rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - W) < 1 && Math.abs(rect.height - H) < 60) return; // barra do celular
    resize();
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
  showScene(0);
  setTimeout(function () { auto = 0; }, 700);
  start();
})();

// ===== Filtro de projetos =====
(function () {
  var buttons = document.querySelectorAll('.filters button');
  var works = document.querySelectorAll('.work');
  if (!buttons.length || !works.length) return;

  function feature() {
    var first = true;
    works.forEach(function (w) {
      w.classList.toggle('is-featured', !w.hidden && first);
      if (!w.hidden) first = false;
    });
  }

  buttons.forEach(function (b) {
    var type = b.dataset.filter;
    // Esconde tipos que ainda não têm projeto
    if (type !== 'all' && !document.querySelector('.work[data-type="' + type + '"]')) { b.hidden = true; return; }
    b.addEventListener('click', function () {
      buttons.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      works.forEach(function (w) { w.hidden = type !== 'all' && w.dataset.type !== type; });
      feature();
    });
  });
  // Com só um tipo de projeto, os filtros não ajudam
  if (document.querySelectorAll('.filters button:not([hidden])').length <= 2) {
    document.querySelector('.filters').hidden = true;
  }
  feature();
})();

// ===== Imagens em tamanho cheio =====
(function () {
  var box = document.querySelector('.lightbox');
  if (!box || typeof box.showModal !== 'function') return;
  var img = box.querySelector('img');
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-full]');
    if (!trigger) return;
    var thumb = trigger.querySelector('img');
    img.src = trigger.dataset.full;
    img.alt = thumb ? thumb.alt : '';
    box.showModal();
  });
  box.querySelector('.lightbox__close').addEventListener('click', function () { box.close(); });
  box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
})();

// ===== Copiar e-mail =====
(function () {
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.dataset.copy;
      var label = function () { return document.documentElement.lang === 'pt-BR' ? b.dataset.ptDone : b.dataset.done; };
      function done() {
        var before = b.textContent;
        b.textContent = label();
        b.classList.add('is-done');
        setTimeout(function () { b.textContent = before; b.classList.remove('is-done'); }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { select(); });
      } else { select(); }
      // Sem acesso à área de transferência: seleciona o endereço para copiar à mão
      function select() {
        var target = b.parentNode.querySelector('.option__desc');
        var range = document.createRange();
        range.selectNodeContents(target);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  });
})();

// ===== Barra de contato no celular: aparece depois da abertura =====
(function () {
  var bar = document.querySelector('.quickbar');
  var hero = document.querySelector('.hero');
  var contact = document.querySelector('#contact');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  var heroVisible = true, contactVisible = false;
  function update() {
    var show = !heroVisible && !contactVisible;
    bar.classList.toggle('is-visible', show);
    bar.inert = !show;
  }
  new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; update(); }).observe(hero);
  if (contact) new IntersectionObserver(function (e) { contactVisible = e[0].isIntersecting; update(); }).observe(contact);
})();
