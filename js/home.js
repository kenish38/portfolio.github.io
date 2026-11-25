// ===== Barra e abas =====
// A barra ganha fundo quando a página sai do topo. Nas abas, uma luz pequena marca a seção que está na tela;
// ela desliza de uma aba para a outra conforme a página rola (sem deslizar para quem pediu menos movimento: ver css).
// O título da abertura fica em js/title.js; a apresentação e os botões da janela, em js/show.js.
(function () {
  'use strict';
  var root = document.documentElement;
  var tabs = document.querySelector('.tabs'), glow = tabs.querySelector('.tabs__glow');
  var links = Array.prototype.slice.call(tabs.querySelectorAll('a'));
  var parts = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var current = null, queued = false;

  function mark(i) {
    if (i === current) { place(); return; }
    current = i;
    links.forEach(function (a, n) { if (n === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    place();
  }
  function place() {
    var a = links[current];
    glow.style.transform = 'translateX(' + (a.offsetLeft + a.offsetWidth / 2) + 'px)';
  }
  // ---------- O fundo de cada seção (css: "O fundo de cada seção") ----------
  // Um degradê no fundo da página: o tom de cada seção vale no meio dela e passa para o da próxima em volta da borda
  // entre as duas (ZONE px para cada lado). A cor segue a rolagem sem nada animar: só o degradê é refeito quando a página
  // muda de altura (trabalhos que carregam, abas da Workstation X). A barra do topo pega a cor do que está embaixo dela, e
  // a barra do navegador no celular (theme-color), a da seção da vez.
  var bar = document.querySelector('.bar'), themeMeta = document.querySelector('meta[name="theme-color"]'), stops = [], themeNow = '';
  function rgb(name) {
    var m = /#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(getComputedStyle(root).getPropertyValue('--tone-' + name)) || [0, '14', '14', '14'];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }
  function css(c) { return 'rgb(' + c.map(Math.round).join(',') + ')'; }
  function fix(v) { return (Math.round(v * 100) / 100).toString(); }
  function rgbF(c) { return 'rgb(' + c.map(fix).join(' ') + ')'; }
  // a curva da sombra de um desfoque gaussiano (a função de distribuição normal, com erro < 1,5e-7)
  function phi(x) {
    var s = x < 0 ? -1 : 1, a = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * a);
    var e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return 0.5 * (1 + s * e);
  }
  // ---------- As sombras grandes (css: "A sombra no fundo da página") ----------
  // Os quadros grandes (os que têm data-shade: o estúdio, o mapa da Workstation X e a foto do Sobre mim) não usam a
  // box-shadow quando há JavaScript: a sombra deles é desenhada aqui, no fundo da página, em 9 pedaços de degradê (os 4
  // cantos, os 4 lados e o meio) subtraídos do fundo ("difference"). Um degradê opaco o navegador pontilha sozinho e a
  // sombra sai lisa; o desfoque da box-shadow não é pontilhado (sai em faixas) e, sem a placa de vídeo, sai em blocos.
  // A forma é a da box-shadow de antes (--shade: o deslocamento para baixo, o desfoque, a expansão e a força): uma caixa
  // desfocada, com a mesma curva gaussiana. A sombra escurece cada cor na mesma proporção, a partir do tom da seção; para
  // isso, o degradê dos tons fica parado (sem passagem de uma seção para a outra) em volta de cada sombra (ver avoid).
  function shades() {
    return Array.prototype.map.call(document.querySelectorAll('[data-shade]'), function (el) {
      var p = getComputedStyle(el).getPropertyValue('--shade').trim().split(/\s+/).map(Number), r = el.getBoundingClientRect();
      if (p.length < 4 || p.some(isNaN) || !r.width) return null;
      var sec = el.closest('section[id]'), sig = p[1] / 2, s = p[2], dy = p[0];
      var x0 = r.left + window.scrollX - s, x1 = r.right + window.scrollX + s, y0 = r.top + window.scrollY - s + dy, y1 = r.bottom + window.scrollY + s + dy;
      var m = Math.max(0, Math.min(2 * sig, (x1 - x0) / 2 - 1, (y1 - y0) / 2 - 1)), E = 3 * sig;
      return { a: p[3], sig: sig, m: m, R: Math.round(m + E), x: Math.round(x0 - E), y: Math.round(y0 - E), w: Math.round(x1 - x0 + 2 * E), h: Math.round(y1 - y0 + 2 * E), tone: sec ? rgb(sec.id) : rgb('top') };
    }).filter(Boolean);
  }
  // a passagem de tom [c − z, c + z] sai de cima de qualquer sombra, para cima ou para baixo (a que andar menos), sem
  // passar de lo nem de hi; sem espaço, ela encolhe
  function avoid(c, z, lo, hi, bans) {
    for (var n = 0; n < 6; n++) {
      var hit = null;
      bans.forEach(function (b) { if (!hit && c + z > b[0] && c - z < b[1]) hit = b; });
      if (!hit) break;
      var up = hit[0] - z, down = hit[1] + z, okUp = up - z >= lo, okDown = down + z <= hi;
      if (okUp && (!okDown || c - up <= down - c)) c = up; else if (okDown) c = down; else z = Math.max(30, z * 0.6);
    }
    return [c, z];
  }
  // os 9 pedaços de uma sombra: o escuro (força · tom · curva) de cada distância até a borda do meio
  function shadeLayers(S, tone) {
    var R = Math.max(1, Math.min(S.R, Math.floor(S.w / 2), Math.floor(S.h / 2))), ramp = [], N = 12;
    for (var i = 0; i <= N; i++) {
      var t = R * i / N, f = phi((S.m - t) / S.sig);
      ramp.push(rgbF(tone.map(function (v) { return S.a * v * f; })) + ' ' + fix(t) + 'px');
    }
    var st = ramp.join(', '), core = rgbF(tone.map(function (v) { return S.a * v * phi(S.m / S.sig); }));
    var X = S.x, Y = S.y, X2 = S.x + S.w - R, Y2 = S.y + S.h - R, mw = S.w - 2 * R, mh = S.h - 2 * R, out = [];
    function L(img, x, y, w, h) { if (w > 0 && h > 0) out.push({ img: img, at: x + 'px ' + y + 'px', size: w + 'px ' + h + 'px', rep: 'no-repeat', mode: 'difference' }); }
    L('radial-gradient(circle ' + R + 'px at 100% 100%, ' + st + ')', X, Y, R, R);
    L('radial-gradient(circle ' + R + 'px at 0 100%, ' + st + ')', X2, Y, R, R);
    L('radial-gradient(circle ' + R + 'px at 100% 0, ' + st + ')', X, Y2, R, R);
    L('radial-gradient(circle ' + R + 'px at 0 0, ' + st + ')', X2, Y2, R, R);
    L('linear-gradient(to top, ' + st + ')', X + R, Y, mw, R);
    L('linear-gradient(to bottom, ' + st + ')', X + R, Y2, mw, R);
    L('linear-gradient(to left, ' + st + ')', X, Y + R, R, mh);
    L('linear-gradient(to right, ' + st + ')', X2, Y + R, R, mh);
    L('linear-gradient(' + core + ', ' + core + ')', X + R, Y + R, mw, mh);
    return out;
  }
  var painted = '';
  function paint() {
    var secs = [{ y: 0, c: rgb('top') }].concat(parts.filter(Boolean).map(function (el) { return { y: el.getBoundingClientRect().top + window.scrollY, c: rgb(el.id) }; }));
    var ZONE = Math.max(240, Math.min(420, window.innerHeight * 0.4)), end = document.documentElement.scrollHeight;
    var sh = shades(), bans = sh.map(function (S) { return [S.y, S.y + S.h]; }), last = 0;
    stops = [{ y: 0, c: secs[0].c }];
    for (var k = 1; k < secs.length; k++) {
      var next = secs[k + 1] ? secs[k + 1].y : end;
      var z = Math.min(ZONE, (secs[k].y - secs[k - 1].y) / 2, (next - secs[k].y) / 2), c = secs[k].y;
      if (secs[k].c.join() !== secs[k - 1].c.join()) { var cz = avoid(c, z, Math.max(last, secs[k - 1].y), next, bans); c = cz[0]; z = cz[1]; }
      stops.push({ y: c - z, c: secs[k - 1].c }, { y: c + z, c: secs[k].c });
      last = c + z;
    }
    stops.push({ y: end, c: secs[secs.length - 1].c });
    // As camadas do fundo, de cima para baixo: as sombras grandes, a luz de cada seção e o degradê dos tons.
    // A luz (css: "A luz de cada seção") vai somada ao degradê ("screen") e é um degradê opaco da cor dela até o preto:
    // assim o navegador pontilha a luz inteira e ela sai lisa, onde a luz translúcida de antes saía em faixas.
    // O "screen" soma s·(1 − fundo); para dar a cor da luz translúcida (a·luz + (1 − a)·tom), s = a·(luz − tom)/(1 − tom).
    var layers = [];
    sh.forEach(function (S) {
      // o tom embaixo da sombra: o da seção; se uma passagem não coube longe dela, o menor de cada cor ali (assim a
      // subtração nunca passa do fundo, o que clarearia em vez de escurecer)
      var t = S.tone.slice();
      for (var y = S.y; y <= S.y + S.h; y += 24) { var q = colorAt(y); for (var j = 0; j < 3; j++) t[j] = Math.min(t[j], q[j]); }
      layers = layers.concat(shadeLayers(S, t));
    });
    parts.forEach(function (el) {
      var cs = el && getComputedStyle(el), shape = cs ? cs.getPropertyValue('--light').trim() : '';
      if (!shape) return;
      var c = cs.getPropertyValue('--light-rgb').trim().split(/\s+/).map(Number), a = parseFloat(cs.getPropertyValue('--light-a')) || 0;
      var t = rgb(el.id), r = el.getBoundingClientRect();
      var s = [0, 1, 2].map(function (j) { return Math.max(0, a * (c[j] - t[j]) / (255 - t[j]) * 255); });
      // do centro (a cor cheia) até 70% do raio (preto): apaga em curva (um cosseno, em 8 passos), sem a linha que uma
      // queda reta deixava onde a luz acaba
      var ramp = [];
      for (var i = 0; i <= 8; i++) {
        var f = 0.5 + 0.5 * Math.cos(Math.PI * i / 8);
        ramp.push('rgb(' + s.map(function (v) { return (v * f).toFixed(2); }).join(' ') + ') ' + (70 * i / 8) + '%');
      }
      layers.push({ img: 'radial-gradient(' + shape + ', ' + ramp.join(', ') + ')', size: Math.round(r.width) + 'px ' + Math.round(r.height) + 'px',
        at: Math.round(r.left + window.scrollX) + 'px ' + Math.round(r.top + window.scrollY) + 'px', rep: 'no-repeat', mode: 'screen' });
    });
    layers.push({ img: 'linear-gradient(to bottom, ' + stops.map(function (s) { return css(s.c) + ' ' + Math.round(s.y) + 'px'; }).join(', ') + ')', size: '100% ' + end + 'px', at: '0 0', rep: 'no-repeat', mode: 'normal' });
    var list = function (k) { return layers.map(function (l) { return l[k]; }).join(', '); }, img = list('img'), at = list('at');
    // só mexe no fundo quando algo mudou: refazer o fundo redesenha a página inteira
    if (img + at !== painted) {
      painted = img + at;
      var bs = document.body.style;
      bs.backgroundImage = img; bs.backgroundSize = list('size'); bs.backgroundPosition = at;
      bs.backgroundRepeat = list('rep'); bs.backgroundBlendMode = list('mode');
    }
    root.classList.add('lit');         // as seções largam a luz delas e os quadros, a sombra (agora no fundo da página)
    follow();
  }
  function colorAt(y) {
    for (var i = 1; i < stops.length; i++) {
      if (y <= stops[i].y) {
        var a = stops[i - 1], b = stops[i], t = b.y > a.y ? Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y))) : 1;
        return [0, 1, 2].map(function (j) { return a.c[j] + (b.c[j] - a.c[j]) * t; });
      }
    }
    return stops.length ? stops[stops.length - 1].c : [20, 20, 20];
  }
  function follow() {          // a barra (só o fundo dela, quando a página saiu do topo) e o theme-color
    if (!stops.length) return;
    var c = colorAt(window.scrollY + (bar ? bar.offsetHeight : 0));
    if (bar) bar.style.setProperty('--bg', css(c));
    var mid = css(colorAt(window.scrollY + window.innerHeight / 2).map(function (v) { return Math.round(v / 4) * 4; }));
    if (themeMeta && mid !== themeNow) { themeNow = mid; themeMeta.setAttribute('content', mid); }
  }
  var paintQueued = false;
  function repaint() { if (!paintQueued) { paintQueued = true; requestAnimationFrame(function () { paintQueued = false; paint(); }); } }
  if (window.ResizeObserver) new ResizeObserver(repaint).observe(document.body);
  window.addEventListener('load', repaint);
  // A seção da vez é a última cujo topo já passou de 40% da altura da tela. No fim da página vale a última aba.
  function check() {
    queued = false;
    var y = window.innerHeight * 0.4, i = 0;
    for (var n = 0; n < parts.length; n++) if (parts[n] && parts[n].getBoundingClientRect().top <= y) i = n;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) i = parts.length - 1;
    mark(i);
    follow();
    root.classList.toggle('scrolled', window.scrollY > 12);
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(check); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', function () { current = null; queue(); });
  document.addEventListener('langchange', function () { current = null; queue(); });   // os nomes das abas mudam de largura
  document.addEventListener('introdone', function () { current = null; queue(); });    // a barra aparece no fim da apresentação
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { current = null; queue(); });
  check();
})();
