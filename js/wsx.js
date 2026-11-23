// ===== Workstation X: o mapa vivo do sistema =====
// Num <canvas> atrás dos botões do mapa ficam as ligações entre as partes e os pulsos de luz que percorrem o ciclo:
//   Planeja   a orquestradora consulta os dois analistas de IA
//   Constrói  a orquestradora manda o trabalho para um dos programas
//   Testa     o resultado volta para a orquestradora
//   Julga     o júri filtra e o Henrique aprova (ele é sempre o juiz final)
//   Aprende   a nota vira lição na memória, que volta para o trabalho
// Os dez jurados giram em volta do júri e as lições formam uma nuvem em volta da memória. Passar o mouse numa parte (ou
// tocar nela, ou chegar nela pelo teclado) acende as ligações dela e mostra embaixo o que ela faz. As posições vêm do
// CSS (o mapa se rearruma no celular); aqui só se mede onde cada parte ficou. Os números contam quando aparecem na tela.
// Quem pediu menos movimento vê o mapa parado, sem pulsos, e os números já prontos. O desenho só roda com o mapa na tela.
(function () {
  'use strict';
  var root = document.documentElement, map = document.querySelector('.wsx__map');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function pt() { return root.lang === 'pt-BR'; }

  // ---------- Os números que contam ----------
  var stats = document.querySelectorAll('.wsx__stats b[data-count]');
  function fmt(b, n) { b.textContent = (b.getAttribute('data-pre') || '') + Math.round(n).toLocaleString(pt() ? 'pt-BR' : 'en-US') + (b.getAttribute('data-post') || ''); }
  function finals() { Array.prototype.forEach.call(stats, function (b) { fmt(b, +b.getAttribute('data-count')); }); }
  finals();
  document.addEventListener('langchange', finals);
  if (stats.length && !reduced && window.IntersectionObserver) {
    var counted = false, list = document.querySelector('.wsx__stats');
    new IntersectionObserver(function (es, io) {
      if (counted || !es[0].isIntersecting) return;
      counted = true; io.disconnect();
      var t0 = performance.now();
      (function tick(t) {
        var q = Math.min(1, (t - t0) / 1500), e = 1 - Math.pow(1 - q, 3);
        Array.prototype.forEach.call(stats, function (b) { fmt(b, +b.getAttribute('data-count') * e); });
        if (q < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.5 }).observe(list);
  }

  if (!map) return;
  var board = map.querySelector('.wsx__board'), canvas = map.querySelector('.wsx__links'), ctx = canvas.getContext && canvas.getContext('2d');
  var caption = map.querySelector('.wsx__caption'), steps = Array.prototype.slice.call(map.querySelectorAll('.wsx__steps li'));
  if (!ctx) return;
  var nodes = {};
  Array.prototype.forEach.call(map.querySelectorAll('.wsx__node'), function (n) { nodes[n.getAttribute('data-key')] = n; });
  var APPS = ['bl', 'pt', 'ds', 'ps', 'rs'];
  var LINKS = [['core', 'analysts'], ['core', 'jury'], ['jury', 'owner'], ['owner', 'memory'], ['memory', 'core']].concat(APPS.map(function (a) { return ['core', a]; }));
  var DEFAULT = { en: 'Hover over (or tap) any part of the map to see what it does.', pt: 'Passe o mouse (ou toque) em uma parte do mapa para ver o que ela faz.' };

  // ---------- Onde cada parte ficou (o CSS decide; aqui só se mede) ----------
  var pos = {}, W = 1, H = 1, dpr = 1;
  function measure() {
    var r = board.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    Object.keys(nodes).forEach(function (k) {
      var b = nodes[k].querySelector('.wsx__core, .wsx__avatar, .wsx__glyph, .wsx__icon').getBoundingClientRect();
      pos[k] = { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2, r: b.width / 2 };
    });
    wake();
  }

  // ---------- O ciclo ----------
  // cada etapa solta pulsos pelas suas pernas, uma depois da outra; 'app' é o programa da vez (muda a cada volta)
  var STAGES = [
    { legs: [['core', 'analysts'], ['analysts', 'core']], c: [156, 198, 255] },
    { legs: [['core', 'app']], c: [255, 214, 140] },
    { legs: [['app', 'core']], c: [240, 238, 232] },
    { legs: [['core', 'jury'], ['jury', 'owner']], c: [255, 200, 110] },
    { legs: [['owner', 'memory'], ['memory', 'core']], c: [150, 230, 160] }
  ];
  var LEG = 620, stage = -1, stageT = 0, app = -1, pulses = [], sparks = [], focus = null, T = 0;
  function nextStage() {
    stage = (stage + 1) % STAGES.length;
    if (stage === 1) app = (app + 1) % APPS.length;
    stageT = T;
    steps.forEach(function (s, i) { s.classList.toggle('is-on', i === stage); });
    STAGES[stage].legs.forEach(function (l, i) {
      pulses.push({ a: l[0] === 'app' ? APPS[app] : l[0], b: l[1] === 'app' ? APPS[app] : l[1], t0: T + i * LEG, c: STAGES[stage].c });
    });
    Object.keys(nodes).forEach(function (k) { nodes[k].classList.toggle('is-on', k === focus || (stage === 1 || stage === 2) && k === APPS[app]); });
  }
  function ease(q) { return q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2; }
  // o ponto da ligação a..b na fração q, saindo da borda do círculo de cada parte (não do centro)
  function along(a, b, q) {
    var A = pos[a], Bp = pos[b], dx = Bp.x - A.x, dy = Bp.y - A.y, d = Math.hypot(dx, dy) || 1, s = A.r + 4, e = d - Bp.r - 4, t = s + (e - s) * q;
    return { x: A.x + dx / d * t, y: A.y + dy / d * t };
  }
  // quando um pulso chega: o Henrique aprova (o avatar acende), a memória ganha uma lição (faíscas)
  function arrive(p) {
    var B = pos[p.b];
    if (p.b === 'owner') { nodes.owner.classList.add('is-approve'); setTimeout(function () { nodes.owner.classList.remove('is-approve'); }, 700); }
    for (var i = 0; i < (p.b === 'memory' ? 14 : 6); i++) { var a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 60; sparks.push({ x: B.x, y: B.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, end: 0.5 + Math.random() * 0.4, c: p.c }); }
  }

  // ---------- Desenho ----------
  var lessons = [];
  for (var i = 0; i < 46; i++) lessons.push({ a: Math.random() * Math.PI * 2, r: 0.9 + Math.random() * 1.1, s: (0.15 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1), z: Math.random() });
  function lit(a, b) { return focus && (a === focus || b === focus); }
  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    // as ligações: finas e apagadas; as da parte em foco e as da etapa da vez ficam mais fortes
    LINKS.forEach(function (l) {
      var a = l[0], b = l[1];
      if (!pos[a] || !pos[b]) return;
      var p0 = along(a, b, 0), p1 = along(a, b, 1), on = lit(a, b), app2 = APPS.indexOf(b) >= 0;
      ctx.strokeStyle = on ? 'rgba(240,178,74,0.75)' : app2 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = on ? 2 : 1.2;
      ctx.setLineDash(app2 && !on ? [3, 5] : []);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    });
    ctx.setLineDash([]);
    // os dez jurados em volta do júri (os três de papel especial, cego, cético e advogado, em dourado)
    if (pos.jury) {
      var J = pos.jury;
      for (var k = 0; k < 10; k++) {
        var a = (reduced ? 0 : T * 0.00035) + k * Math.PI * 2 / 10, R = J.r + 13;
        ctx.beginPath(); ctx.arc(J.x + Math.cos(a) * R, J.y + Math.sin(a) * R, k < 3 ? 3.4 : 2.4, 0, Math.PI * 2);
        ctx.fillStyle = k < 3 ? 'rgba(240,178,74,0.95)' : 'rgba(236,234,228,0.7)'; ctx.fill();
      }
    }
    // a nuvem de lições em volta da memória
    if (pos.memory) {
      var M = pos.memory;
      lessons.forEach(function (l) {
        var a = l.a + (reduced ? 0 : T * 0.00025 * l.s), R = M.r + 6 + l.r * 18;
        ctx.fillStyle = 'rgba(160,230,170,' + (0.25 + 0.45 * l.z).toFixed(3) + ')';
        ctx.fillRect(M.x + Math.cos(a) * R, M.y + Math.sin(a) * R * 0.6, 1.6, 1.6);
      });
    }
    // os pulsos: uma luz com rastro correndo pela ligação
    ctx.globalCompositeOperation = 'lighter';
    for (var n = pulses.length - 1; n >= 0; n--) {
      var p = pulses[n], q = (T - p.t0) / LEG;
      if (q < 0) continue;
      if (q >= 1) { arrive(p); pulses.splice(n, 1); continue; }
      if (!pos[p.a] || !pos[p.b]) continue;
      var e = ease(q), h = along(p.a, p.b, e), tl = along(p.a, p.b, Math.max(0, e - 0.16));
      var g = ctx.createLinearGradient(tl.x, tl.y, h.x, h.y);
      g.addColorStop(0, 'rgba(' + p.c.join(',') + ',0)'); g.addColorStop(1, 'rgba(' + p.c.join(',') + ',0.9)');
      ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(h.x, h.y); ctx.stroke();
      var gr = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 14);
      gr.addColorStop(0, 'rgba(' + p.c.join(',') + ',0.95)'); gr.addColorStop(1, 'rgba(' + p.c.join(',') + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(h.x - 14, h.y - 14, 28, 28);
    }
    for (n = sparks.length - 1; n >= 0; n--) {
      var s = sparks[n];
      s.life += dt;
      if (s.life >= s.end) { sparks.splice(n, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.94; s.vy *= 0.94;
      ctx.fillStyle = 'rgba(' + s.c.join(',') + ',' + (1 - s.life / s.end).toFixed(3) + ')';
      ctx.fillRect(s.x - 1, s.y - 1, 2.2, 2.2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Foco: a parte sob o cursor, o dedo ou o teclado ----------
  function show(key) {
    focus = key;
    var n = key && nodes[key];
    caption.textContent = '';
    if (n) {
      var b = document.createElement('b');
      b.textContent = n.querySelector('.wsx__name').textContent + ': ';
      caption.appendChild(b);
      caption.appendChild(document.createTextNode(n.querySelector('.wsx__info').textContent));
    } else caption.textContent = pt() ? DEFAULT.pt : DEFAULT.en;
    Object.keys(nodes).forEach(function (k) { nodes[k].classList.toggle('is-on', k === key); });
    wake();
  }
  Object.keys(nodes).forEach(function (k) {
    var n = nodes[k];
    n.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(k); });
    n.addEventListener('focus', function () { show(k); });
    n.addEventListener('click', function () { show(k); });
  });
  board.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !board.contains(document.activeElement)) show(null); });
  map.addEventListener('focusout', function (e) { if (!map.contains(e.relatedTarget)) show(null); });
  document.addEventListener('langchange', function () { show(focus); });
  show(null);

  // ---------- O laço ----------
  var visible = false, raf = 0, last = 0;
  function wake() { if (!raf && (visible || reduced)) raf = requestAnimationFrame(frame); }
  function frame(t) {
    raf = 0;
    var dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t; T = t;
    if (!reduced && (stage < 0 || T - stageT > STAGES[Math.max(0, stage)].legs.length * LEG + 260)) nextStage();
    draw(dt);
    if (visible && !reduced) wake(); else last = 0;
  }
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting && !document.hidden; wake(); }, { rootMargin: '80px 0px' }).observe(board);
  else visible = true;
  document.addEventListener('visibilitychange', function () { if (document.hidden) visible = false; });
  if (window.ResizeObserver) new ResizeObserver(measure).observe(board); else window.addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
})();
