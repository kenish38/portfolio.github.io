// ===== O estúdio: um mundo de brinquedo em que o visitante constrói =====
// Um tabuleiro isométrico desenhado num <canvas> (sem bibliotecas). Cada ferramenta da barra mostra uma área de trabalho:
//   Construir  clicar no chão derruba uma peça (dá para empilhar)
//   Iluminar   a cena vira noite, a luz segue o cursor e o clique solta faíscas (VFX)
//   Programar  um script em Luau é digitado e "roda": as peças entram numa onda
//   Interface  aparece um HUD de jogo; pegar as moedas soma pontos e sobe de nível
//   IA         um pedido é digitado e a "IA" monta uma cena peça por peça
// Quando o estúdio aparece na tela pela primeira vez, uma casinha e uma árvore caem no tabuleiro para chamar a atenção.
// Teclado: com o tabuleiro em foco, as setas andam pelas casas e o Enter (ou o espaço) age na casa marcada.
// Menos movimento: as peças aparecem sem cair, sem a onda e sem as brasas que flutuam sozinhas.
// O desenho só roda enquanto o estúdio está na tela.
(function () {
  'use strict';
  var root = document.documentElement, box = document.querySelector('.studio');
  if (!box) return;
  var canvas = box.querySelector('.studio__canvas'), ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  root.classList.add('has-studio');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var toolBtns = Array.prototype.slice.call(box.querySelectorAll('.tool')), infos = box.querySelectorAll('.studio__info');
  var codeEl = box.querySelector('.studio__code'), hud = box.querySelector('.studio__hud');
  var coinsEl = hud.querySelector('.studio__coins b'), levelEl = hud.querySelector('.studio__level b'), lifeEl = hud.querySelector('.studio__life i');
  var promptBox = box.querySelector('.studio__prompt'), askEl = promptBox.querySelector('.studio__ask'), againBtn = promptBox.querySelector('.studio__again');
  function pt() { return root.lang === 'pt-BR'; }
  function now() { return performance.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------- O mundo ----------
  var G = 8, MAXH = 6;                 // casas por lado e altura máxima de uma pilha
  var PEARL = [236, 234, 229], STONE = [205, 202, 195], ASH = [160, 158, 153], GOLD = [240, 178, 74], WOOD = [128, 112, 98];
  var cells = [];                      // cells[x][y]: as peças da casa, de baixo para cima: { x, y, z, c, t0, landed }
  var parts = [], coins = [], floats = [];   // faíscas e poeira; moedas do HUD; textos que sobem ("+1")
  function pick() { var r = Math.random(); return r < 0.12 ? GOLD : r < 0.48 ? PEARL : r < 0.82 ? STONE : ASH; }
  function clearWorld() { cells = []; for (var x = 0; x < G; x++) { cells.push([]); for (var y = 0; y < G; y++) cells[x].push([]); } }
  function height(x, y) { var s = cells[x][y]; return s.length ? s[s.length - 1].z + 1 : 0; }
  function count() { var n = 0; for (var x = 0; x < G; x++) for (var y = 0; y < G; y++) n += cells[x][y].length; return n; }
  // põe uma peça na casa (x, y): no topo da pilha, ou na altura z (as cenas da IA têm vãos, como numa ponte)
  function put(x, y, c, delay, z) {
    if (x < 0 || y < 0 || x >= G || y >= G) return false;
    var s = cells[x][y], zz = z === undefined ? height(x, y) : z;
    if (zz >= MAXH) return false;
    for (var i = 0; i < s.length; i++) if (s[i].z === zz) return false;
    s.push({ x: x, y: y, z: zz, c: c || pick(), t0: now() + (delay || 0), landed: false });
    s.sort(function (a, b) { return a.z - b.z; });
    wake();
    return true;
  }
  clearWorld();

  // ---------- Projeção isométrica ----------
  var W = 1, H = 1, dpr = 1, TW = 40, TH = 20, BH = 22, ox = 0, oy = 0, SLAB = 0.35;
  function size() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // o tabuleiro cabe na tela com pilhas de quase cinco peças em qualquer casa (só uma pilha bem alta lá no fundo passa do topo)
    TW = Math.min(W * 0.9 / G, (H - 44) / (G * 0.5 + (4.8 + SLAB) * 0.55));
    TH = TW / 2; BH = TW * 0.55;
    ox = W / 2; oy = H - 22 - G * TH - SLAB * BH;
  }
  // (x, y) em casas do tabuleiro (podem ser frações) e z em alturas de peça → px no canvas
  function sx(x, y) { return ox + (x - y) * TW / 2; }
  function sy(x, y, z) { return oy + (x + y) * TH / 2 - z * BH; }

  // ---------- Luz ----------
  var night = 0, light = { x: 0, y: 0, auto: true };
  // brilho de um ponto: de dia 1; de noite, só o que está perto da luz do cursor
  function lit(px, py) {
    if (night < 0.002) return 1;
    var dx = px - light.x, dy = py - light.y, r = TW * 3.1;
    return 1 + (0.14 + 1.45 * Math.exp(-(dx * dx + dy * dy) / (2 * r * r)) - 1) * night;
  }
  function rgb(c, k) { return 'rgb(' + Math.min(255, c[0] * k | 0) + ',' + Math.min(255, c[1] * k | 0) + ',' + Math.min(255, c[2] * k | 0) + ')'; }
  function poly(p, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  // ---------- Desenho ----------
  function background() {
    var g = ctx.createLinearGradient(0, 0, 0, H), d = 1 - night * 0.72;
    g.addColorStop(0, rgb([31, 31, 31], d)); g.addColorStop(1, rgb([21, 21, 21], d));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, H * 0.9);
    r.addColorStop(0, 'rgba(255,255,255,' + (0.06 * d).toFixed(3) + ')'); r.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  }
  function plate() {
    var top = [sx(0, 0), sy(0, 0, 0)], rt = [sx(G, 0), sy(G, 0, 0)], bt = [sx(G, G), sy(G, G, 0)], lf = [sx(0, G), sy(0, G, 0)], dz = SLAB * BH;
    var k = 1 - night * 0.7;
    poly([lf[0], lf[1], bt[0], bt[1], bt[0], bt[1] + dz, lf[0], lf[1] + dz], rgb([52, 52, 52], 0.9 * k));
    poly([rt[0], rt[1], bt[0], bt[1], bt[0], bt[1] + dz, rt[0], rt[1] + dz], rgb([52, 52, 52], 0.66 * k));
    poly([top[0], top[1], rt[0], rt[1], bt[0], bt[1], lf[0], lf[1]], rgb([46, 46, 46], k));
    // a poça de luz no chão, de noite
    if (night > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(rt[0], rt[1]); ctx.lineTo(bt[0], bt[1]); ctx.lineTo(lf[0], lf[1]); ctx.closePath(); ctx.clip();
      var g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, TW * 3.6);
      g.addColorStop(0, 'rgba(255,236,200,' + (0.34 * night).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // a grade da baseplate
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,' + (0.1 * (1 - night * 0.5)).toFixed(3) + ')';
    ctx.beginPath();
    for (var i = 0; i <= G; i++) { ctx.moveTo(sx(i, 0), sy(i, 0, 0)); ctx.lineTo(sx(i, G), sy(i, G, 0)); ctx.moveTo(sx(0, i), sy(0, i, 0)); ctx.lineTo(sx(G, i), sy(G, i, 0)); }
    ctx.stroke();
  }
  // uma peça: o topo, a lateral esquerda e a direita, com o brilho k
  function cube(x, y, z, c, boost) {
    var cx = sx(x, y), tp = sy(x, y, z + 1), bt = sy(x, y, z), h2 = TH / 2, w2 = TW / 2;
    var k = lit(cx, tp + TH) * (boost || 1);
    poly([cx, tp, cx + w2, tp + h2, cx, tp + TH, cx - w2, tp + h2], rgb(c, k), 'rgba(255,255,255,' + (0.22 * Math.min(1, k)).toFixed(3) + ')');
    poly([cx - w2, tp + h2, cx, tp + TH, cx, bt + TH, cx - w2, bt + h2], rgb(c, 0.74 * k), 'rgba(0,0,0,0.2)');
    poly([cx + w2, tp + h2, cx, tp + TH, cx, bt + TH, cx + w2, bt + h2], rgb(c, 0.55 * k), 'rgba(0,0,0,0.2)');
  }
  // onde a próxima peça vai cair (o cursor sobre o tabuleiro)
  function ghost(x, y) {
    var z = height(x, y);
    if (z >= MAXH) return;
    var cx = sx(x, y), tp = sy(x, y, z + 1), bt = sy(x, y, z), h2 = TH / 2, w2 = TW / 2;
    ctx.save(); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(now() * 0.006);
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    poly([cx, tp, cx + w2, tp + h2, cx, tp + TH, cx - w2, tp + h2], 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.85)');
    ctx.beginPath(); ctx.moveTo(cx - w2, tp + h2); ctx.lineTo(cx - w2, bt + h2); ctx.lineTo(cx, bt + TH); ctx.lineTo(cx + w2, bt + h2); ctx.lineTo(cx + w2, tp + h2); ctx.moveTo(cx, tp + TH); ctx.lineTo(cx, bt + TH); ctx.stroke();
    ctx.restore();
  }

  // ---------- Queda das peças ----------
  var DROP = reduced ? 0 : 560;
  function bounce(p) {
    var n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) { p -= 1.5 / d; return n * p * p + 0.75; }
    if (p < 2.5 / d) { p -= 2.25 / d; return n * p * p + 0.9375; }
    p -= 2.625 / d; return n * p * p + 0.984375;
  }
  // altura em que a peça aparece agora (null: ainda não entrou)
  function zNow(b, t) {
    if (t < b.t0) return null;
    var p = DROP ? (t - b.t0) / DROP : 1;
    if (p >= 1) { if (!b.landed) { b.landed = true; puff(b.x, b.y, b.z); } return b.z; }
    return b.z + 4.5 * (1 - bounce(p));
  }

  // ---------- Faíscas, poeira e textos ----------
  function puff(x, y, z) {
    if (reduced) return;
    for (var i = 0; i < 7; i++) {
      var a = Math.random() * Math.PI * 2;
      parts.push({ x: sx(x + 0.5, y + 0.5) + Math.cos(a) * TW * 0.35, y: sy(x + 0.5, y + 0.5, z) + Math.sin(a) * TH * 0.35, vx: Math.cos(a) * 30, vy: -10 - Math.random() * 25, g: 30, life: 0, end: 0.45 + Math.random() * 0.3, s: 1.5 + Math.random() * 1.5, c: '210,208,202', add: false });
    }
  }
  function sparks(px, py, n, gold) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * (reduced ? 60 : 220);
      parts.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 260, life: 0, end: 0.5 + Math.random() * 0.6, s: 1.5 + Math.random() * 2, c: gold || (Math.random() < 0.55 ? '255,196,92' : '255,248,232'), add: true });
    }
    wake();
  }
  function ember() {
    var a = Math.random() * Math.PI * 2, r = Math.random() * TW * 1.8;
    parts.push({ x: light.x + Math.cos(a) * r, y: light.y + Math.sin(a) * r * 0.5, vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 28, g: -4, life: 0, end: 1.2 + Math.random() * 1.2, s: 1 + Math.random() * 1.6, c: '255,210,140', add: true });
  }
  function float(text, x, y, z, big) { floats.push({ text: text, x: sx(x + 0.5, y + 0.5), y: sy(x + 0.5, y + 0.5, z), life: 0, end: big ? 1.4 : 0.9, big: !!big }); }
  function stepParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life += dt;
      if (p.life >= p.end) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      var k = 1 - p.life / p.end;
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      ctx.fillStyle = 'rgba(' + p.c + ',' + (0.9 * k).toFixed(3) + ')';
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      f.life += dt;
      if (f.life >= f.end) { floats.splice(i, 1); continue; }
      var q = f.life / f.end;
      ctx.font = '700 ' + (f.big ? 17 : 14) + 'px Archivo, "Helvetica Neue", Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,214,128,' + (1 - q * q).toFixed(3) + ')';
      ctx.shadowColor = 'rgba(240,178,74,0.8)'; ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, f.y - 24 - q * 34);
      ctx.shadowBlur = 0;
    }
  }

  // ---------- Ferramenta: Programar (a onda) ----------
  // Luau de verdade: a cada quadro, cada peça sobe e desce numa onda que anda ao longo do eixo X (como a do tabuleiro)
  var CODE = [
    [['k', 'local'], ['', ' RunService = game:GetService('], ['s', '"RunService"'], ['', ')']],
    [['k', 'local'], ['', ' parts = workspace.Mundo:GetChildren()']],
    [],
    [['', 'RunService.Heartbeat:Connect('], ['k', 'function'], ['', '()']],
    [['  '], ['k', 'local'], ['', ' t = os.clock()']],
    [['  '], ['k', 'for'], ['', ' _, part '], ['k', 'in'], ['', ' parts '], ['k', 'do']],
    [['    '], ['k', 'local'], ['', ' base = part:GetAttribute('], ['s', '"Base"'], ['', ')']],
    [['    '], ['k', 'local'], ['', ' y = math.sin(t * '], ['n', '3'], ['', ' - part.Position.X)']],
    [['    '], ['', 'part.CFrame = base + Vector3.new('], ['n', '0'], ['', ', y, '], ['n', '0'], ['', ')']],
    [['  '], ['k', 'end']],
    [['k', 'end'], ['', ')']]
  ];
  var CODE_LEN = CODE.reduce(function (n, l) { return n + l.reduce(function (m, tk) { return m + (tk[1] !== undefined ? tk[1] : tk[0]).length; }, 0) + 1; }, 0);
  var typed = 0, wave = 0, runLine = 4, runTimer = 0;
  // desenha o código até o caractere "upTo" (o resto ainda não foi digitado)
  function renderCode(upTo) {
    codeEl.textContent = '';
    var left = upTo;
    CODE.forEach(function (line, n) {
      var ln = document.createElement('span'); ln.className = 'ln' + (wave > 0.5 && n === runLine ? ' is-run' : '');
      line.forEach(function (tk) {
        if (left <= 0) return;
        var text = tk[1] !== undefined ? tk[1] : tk[0], cls = tk[1] !== undefined ? tk[0] : '';
        var part = text.slice(0, left); left -= part.length;
        if (cls) { var sp = document.createElement('span'); sp.className = cls; sp.textContent = part; ln.appendChild(sp); }
        else ln.appendChild(document.createTextNode(part));
      });
      if (left > 0) left--;            // a quebra de linha
      ln.appendChild(document.createTextNode('\n'));
      codeEl.appendChild(ln);
    });
  }
  function waveAt(x, y, t) { return wave ? 0.3 * wave * Math.sin(t * 0.005 - x * 0.9) : 0; }
  function waveGlow(x, y, t) { if (!wave) return 1; var s = Math.sin(t * 0.005 - x * 0.9 + 0.6); return 1 + 0.32 * wave * Math.pow(Math.max(0, s), 10); }

  // ---------- Ferramenta: Interface (as moedas) ----------
  var score = 0, level = 1;
  function coinAt(x, y) { for (var i = 0; i < coins.length; i++) if (coins[i].x === x && coins[i].y === y) return i; return -1; }
  function spawnCoin() {
    for (var tries = 0; tries < 40; tries++) {
      var x = Math.floor(Math.random() * G), y = Math.floor(Math.random() * G);
      if (coinAt(x, y) < 0 && height(x, y) < MAXH - 1) { coins.push({ x: x, y: y, t0: now() }); return; }
    }
  }
  function fillCoins() { while (coins.length < 3) spawnCoin(); }
  function updateHud() {
    coinsEl.textContent = String(score); levelEl.textContent = String(level);
    lifeEl.style.width = (20 + (score % 5) * 20) + '%';
  }
  function collect(i) {
    var c = coins.splice(i, 1)[0], z = height(c.x, c.y) + 0.8;
    score++;
    sparks(sx(c.x + 0.5, c.y + 0.5), sy(c.x + 0.5, c.y + 0.5, z), 18, '255,196,92');
    float('+1', c.x, c.y, z);
    if (score % 5 === 0) { level++; float(pt() ? 'Subiu de nível!' : 'Level up!', c.x, c.y, z + 1.2, true); sparks(sx(c.x + 0.5, c.y + 0.5), sy(c.x + 0.5, c.y + 0.5, z), 40); }
    updateHud();
    setTimeout(function () { if (tool === 'ui') { spawnCoin(); wake(); } }, 450);
  }
  function drawCoin(c, t) {
    var z = height(c.x, c.y) + 0.75 + 0.12 * Math.sin(t * 0.004 + c.x), cx = sx(c.x + 0.5, c.y + 0.5), cy = sy(c.x + 0.5, c.y + 0.5, z);
    var r = TW * 0.2, w = Math.max(0.12, Math.abs(Math.cos(t * 0.004 + c.y))), a = clamp((t - c.t0) / 300, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(240,178,74,0.9)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * w, r, 0, 0, Math.PI * 2); ctx.fillStyle = '#f0b24a'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * w * 0.62, r * 0.62, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,240,200,0.85)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  }

  // ---------- Ferramenta: IA (as cenas) ----------
  var SCENES = [
    { en: 'Build a tower with a spiral staircase.', pt: 'Construa uma torre com escada em espiral.', make: function () {
      var out = [], ring = [[2, 2], [3, 2], [4, 2], [5, 2], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [2, 5], [2, 4], [2, 3]];
      for (var z = 0; z < 6; z++) {
        [[3, 3], [4, 3], [3, 4], [4, 4]].forEach(function (p) { out.push([p[0], p[1], z, z === 5 ? GOLD : PEARL]); });
        ring.forEach(function (p, i) { if (z <= Math.floor(i / 2)) out.push([p[0], p[1], z, z === Math.floor(i / 2) ? STONE : ASH]); });
      }
      return out;
    } },
    { en: 'Build a small castle with four towers and a gate.', pt: 'Construa um castelo pequeno com quatro torres e um portão.', make: function () {
      var out = [];
      for (var z = 0; z < 5; z++) for (var x = 1; x <= 6; x++) for (var y = 1; y <= 6; y++) {
        var edge = x === 1 || x === 6 || y === 1 || y === 6, corner = (x === 1 || x === 6) && (y === 1 || y === 6), gate = y === 6 && (x === 3 || x === 4);
        if (corner && z <= 3) out.push([x, y, z, z === 3 ? GOLD : STONE]);
        else if (edge && !corner && z <= 1 && !(gate && z === 0)) out.push([x, y, z, PEARL]);
        else if (x >= 3 && x <= 4 && y >= 3 && y <= 4 && z <= 2) out.push([x, y, z, z === 2 ? GOLD : ASH]);
      }
      return out;
    } },
    { en: 'Build a bridge with lamp posts at the ends.', pt: 'Construa uma ponte com postes de luz nas pontas.', make: function () {
      var out = [];
      for (var z = 0; z < 3; z++) [[1, 3], [1, 4], [6, 3], [6, 4]].forEach(function (p) { out.push([p[0], p[1], z, ASH]); });
      for (var x = 0; x <= 7; x++) [3, 4].forEach(function (y) { out.push([x, y, 3, PEARL]); });
      [[0, 3], [7, 4]].forEach(function (p) { out.push([p[0], p[1], 4, STONE]); out.push([p[0], p[1], 5, GOLD]); });
      return out;
    } },
    { en: 'Build a stepped pyramid with a golden top.', pt: 'Construa uma pirâmide em degraus com o topo dourado.', make: function () {
      var out = [];
      for (var z = 0; z < 4; z++) for (var x = z; x <= 6 - z; x++) for (var y = z; y <= 6 - z; y++) out.push([x, y, z, z === 3 ? GOLD : z % 2 ? STONE : PEARL]);
      return out;
    } },
    { en: 'Plant a big autumn tree.', pt: 'Plante uma árvore grande de outono.', make: function () {
      var out = [];
      for (var z = 0; z < 3; z++) out.push([3, 3, z, WOOD]);
      for (var x = 1; x <= 5; x++) for (var y = 1; y <= 5; y++) for (z = 3; z <= 5; z++) {
        var d = Math.abs(x - 3) + Math.abs(y - 3) + Math.abs(z - 4) * 1.4;
        if (d <= 2.6) out.push([x, y, z, (x * 7 + y * 3 + z) % 4 === 0 ? PEARL : GOLD]);
      }
      return out;
    } }
  ];
  var scene = -1, aiTimers = [];
  function stopAi() { aiTimers.forEach(clearTimeout); aiTimers = []; }
  function ask() {
    stopAi();
    scene = (scene + 1) % SCENES.length;
    var sc = SCENES[scene], text = pt() ? sc.pt : sc.en, i = 0;
    againBtn.hidden = true; askEl.className = 'studio__ask is-typing'; askEl.textContent = '';
    wipe();
    (function type() {
      askEl.textContent = text.slice(0, ++i);
      if (i < text.length) aiTimers.push(setTimeout(type, reduced ? 0 : 26));
      else { askEl.className = 'studio__ask is-working'; aiTimers.push(setTimeout(build, 250)); }
    })();
    function build() {
      var list = sc.make(), step = reduced ? 0 : Math.max(22, Math.min(60, 2600 / list.length));
      list.sort(function (a, b) { return a[2] - b[2] || (a[0] + a[1]) - (b[0] + b[1]); });
      list.forEach(function (b, k) { put(b[0], b[1], b[3], k * step, b[2]); });
      aiTimers.push(setTimeout(function () { askEl.className = 'studio__ask is-done'; againBtn.hidden = false; }, list.length * step + DROP));
    }
  }
  // tira todas as peças, com um sopro de poeira em cada uma
  function wipe() {
    for (var x = 0; x < G; x++) for (var y = 0; y < G; y++) cells[x][y].forEach(function (b) { if (b.landed) puff(b.x, b.y, b.z); });
    clearWorld();
  }

  // ---------- Trocar de ferramenta ----------
  var tool = 'build';
  function setTool(name) {
    if (name === tool && name !== 'ai') return;
    var was = tool; tool = name;
    box.setAttribute('data-tool', name);
    toolBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tool') === name)); });
    Array.prototype.forEach.call(infos, function (a) { a.classList.toggle('is-on', a.getAttribute('data-tool') === name); });
    if (was === 'ai' && name !== 'ai') { stopAi(); askEl.className = 'studio__ask'; }
    if (name === 'script') { typed = 0; renderCode(0); }
    if (name === 'ui') { fillCoins(); updateHud(); } else coins = [];
    if (name === 'ai') ask();
    wake();
  }
  toolBtns.forEach(function (b) { b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); }); });
  againBtn.addEventListener('click', ask);
  box.querySelector('.studio__reset').addEventListener('click', function () {
    stopAi(); wipe(); coins = []; score = 0; level = 1; updateHud();
    if (tool === 'ui') fillCoins();
    if (tool === 'ai') { askEl.className = 'studio__ask is-done'; againBtn.hidden = false; }
    wake();
  });

  // ---------- Cursor, toque e teclado ----------
  var hover = null, kb = null, pointerIn = false;
  // a casa sob o ponto (px, py): a pilha mais à frente que cobre o ponto ou, se nenhuma, a casa do chão
  function cellAt(px, py) {
    for (var sum = 2 * (G - 1); sum >= 0; sum--) for (var x = Math.min(sum, G - 1); x >= Math.max(0, sum - G + 1); x--) {
      var y = sum - x, h = height(x, y);
      if (!h) continue;
      var cx = sx(x + 0.5, y + 0.5), dx = Math.abs(px - cx) / (TW / 2);
      if (dx > 1) continue;
      var edge = (TH / 2) * (1 - dx), top = sy(x + 0.5, y + 0.5, h) - edge, bot = sy(x + 0.5, y + 0.5, 0) + edge;
      if (py >= top && py <= bot) return { x: x, y: y };
    }
    var a = (px - ox) / (TW / 2), b = (py - oy) / (TH / 2), gx = Math.floor((a + b) / 2), gy = Math.floor((b - a) / 2);
    return gx >= 0 && gy >= 0 && gx < G && gy < G ? { x: gx, y: gy } : null;
  }
  function act(cell, px, py) {
    if (tool === 'light') { sparks(px, py, 30); return; }
    if (!cell) return;
    if (tool === 'ui') { var k = coinAt(cell.x, cell.y); if (k >= 0) { collect(k); return; } }
    if (!put(cell.x, cell.y)) sparks(sx(cell.x + 0.5, cell.y + 0.5), sy(cell.x + 0.5, cell.y + 0.5, MAXH), 8, '210,208,202');   // pilha cheia
  }
  function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointermove', function (e) {
    var p = local(e); pointerIn = true; light.x = p.x; light.y = p.y; light.auto = false;
    hover = cellAt(p.x, p.y); kb = null; wake();
  });
  canvas.addEventListener('pointerleave', function () { pointerIn = false; hover = null; light.auto = true; });
  canvas.addEventListener('pointerdown', function (e) {
    var p = local(e); light.x = p.x; light.y = p.y; light.auto = false;
    act(cellAt(p.x, p.y), p.x, p.y);
  });
  canvas.addEventListener('focus', function () { if (!kb) kb = { x: 3, y: 4 }; wake(); });
  canvas.addEventListener('blur', function () { kb = null; });
  canvas.addEventListener('keydown', function (e) {
    var k = e.key, moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (!kb) kb = { x: 3, y: 4 };
    if (moves[k]) { kb.x = clamp(kb.x + moves[k][0], 0, G - 1); kb.y = clamp(kb.y + moves[k][1], 0, G - 1); e.preventDefault(); }
    else if (k === 'Enter' || k === ' ') {
      var px = sx(kb.x + 0.5, kb.y + 0.5), py = sy(kb.x + 0.5, kb.y + 0.5, height(kb.x, kb.y));
      light.x = px; light.y = py; light.auto = false;
      act(kb, px, py); e.preventDefault();
    }
    else return;
    hover = null; wake();
  });

  // ---------- O laço ----------
  var visible = false, running = false, last = 0, emberClock = 0, firstShow = true;
  function wake() { if (visible && !running) { running = true; last = now(); requestAnimationFrame(frame); } }
  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000); last = t;
    // a noite chega e vai embora aos poucos; a onda do script também
    var nightTo = tool === 'light' ? 1 : 0, waveTo = tool === 'script' && typed >= CODE_LEN && !reduced ? 1 : 0;
    night += (nightTo - night) * (1 - Math.exp(-dt * 5)); if (Math.abs(nightTo - night) < 0.002) night = nightTo;
    wave += (waveTo - wave) * (1 - Math.exp(-dt * 3)); if (Math.abs(waveTo - wave) < 0.002) wave = waveTo;
    if (tool === 'script' && typed < CODE_LEN) { typed = Math.min(CODE_LEN, typed + (reduced ? CODE_LEN : Math.max(1, Math.round(dt * 160)))); renderCode(typed); }
    if (wave > 0.5 && t - runTimer > 260) { runTimer = t; runLine = runLine >= 8 ? 4 : runLine + 1; renderCode(typed); }
    // sem cursor, a luz passeia sozinha pelo tabuleiro
    if (light.auto) { light.x = ox + Math.sin(t * 0.0007) * TW * 2.6; light.y = sy(G / 2, G / 2, 0) + Math.cos(t * 0.0009) * TH * 2.2; }
    if (night > 0.3 && !reduced && (emberClock += dt) > 0.09) { emberClock = 0; ember(); }

    background();
    plate();
    var mark = kb || hover;
    for (var sum = 0; sum <= 2 * (G - 1); sum++) for (var x = Math.max(0, sum - G + 1); x <= Math.min(sum, G - 1); x++) {
      var y = sum - x, s = cells[x][y];
      for (var i = 0; i < s.length; i++) {
        var b = s[i], z = zNow(b, t);
        if (z === null) continue;
        cube(x, y, z + waveAt(x, y, t), b.c, waveGlow(x, y, t));
      }
      if (mark && mark.x === x && mark.y === y && tool !== 'light') ghost(x, y);
      if (tool === 'ui') coins.forEach(function (c) { if (c.x === x && c.y === y) drawCoin(c, t); });
    }
    // a lâmpada que segue o cursor, de noite
    if (night > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, TW * 0.9);
      g.addColorStop(0, 'rgba(255,236,200,' + (0.55 * night).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = g; ctx.fillRect(light.x - TW, light.y - TW, TW * 2, TW * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    stepParts(dt);
    if (visible) requestAnimationFrame(frame); else running = false;
  }

  // a cena de boas-vindas: uma casinha e uma árvore caem no tabuleiro
  function welcome() {
    var list = [[4, 2, 0, PEARL], [5, 2, 0, PEARL], [4, 3, 0, PEARL], [5, 3, 0, PEARL], [4, 2, 1, PEARL], [5, 2, 1, STONE], [4, 3, 1, STONE], [5, 3, 1, PEARL],
      [4, 2, 2, GOLD], [5, 2, 2, GOLD], [4, 3, 2, GOLD], [5, 3, 2, GOLD], [2, 4, 0, WOOD], [2, 4, 1, WOOD], [2, 4, 2, STONE], [1, 4, 2, STONE], [3, 4, 2, STONE],
      [2, 3, 2, STONE], [2, 5, 2, STONE], [2, 4, 3, PEARL], [4, 5, 0, ASH], [5, 6, 0, ASH], [6, 6, 0, GOLD]];
    list.forEach(function (b, k) { put(b[0], b[1], b[3], reduced ? 0 : 200 + k * 85, b[2]); });
  }
  size();
  if (window.ResizeObserver) new ResizeObserver(function () { size(); wake(); }).observe(canvas);
  else window.addEventListener('resize', function () { size(); wake(); });
  document.addEventListener('langchange', function () { if (tool === 'ai' && askEl.className === 'studio__ask is-done') askEl.textContent = pt() ? SCENES[scene].pt : SCENES[scene].en; });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && firstShow && es[0].intersectionRatio > 0.3) { firstShow = false; size(); welcome(); }
      wake();
    }, { threshold: [0, 0.35] }).observe(canvas);
  } else { visible = true; welcome(); wake(); }
})();
