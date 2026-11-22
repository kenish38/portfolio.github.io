// ===== Abertura da página inicial =====
// A primeira tela mostra de cara quem é, o que faz e para onde ir. O visual é o mesmo da assinatura do site:
// o nome recortado numa parede preta (js/wall.js) e, atrás dele, o mar de partículas de luz (js/matter.js com a
// cena "wave" de js/film-intro.js). Aqui não há filme nem rolagem especial: a página rola normalmente.
// O filme completo ficou numa página própria (film/), aberta pelo botão "Assistir ao filme".
(function () {
  'use strict';
  var S = window.HRScroll, root = document.documentElement;
  var hero = document.querySelector('.hero'), wallEl = hero.querySelector('.wall'), openEl = hero.querySelector('.open');
  var canvas = hero.querySelector('.world'), still = hero.querySelector('.world-still'), brandEl = document.querySelector('.nav__brand');

  // As laterais do recorte do nome pegam a cor da luz que vem de trás (paleta "perola": branco e dourado)
  var pearl = window.HRMatter.palettes.perola.main;
  var look = {
    sideNear: [pearl[0][0] * 40, pearl[0][1] * 40, pearl[0][2] * 40],
    sideFar: [(pearl[1][0] + pearl[2][0]) * 44, (pearl[1][1] + pearl[2][1]) * 44, (pearl[1][2] + pearl[2][2]) * 44]
  };
  // O nome fica mais alto que no filme: embaixo dele vêm a função e os botões. Em telas baixas (celular deitado)
  // ele encolhe mais um pouco, para os botões caberem na primeira tela.
  function fit() { var low = hero.clientHeight < 520; look.maxHeight = low ? 0.34 : 0.4; look.centerY = low ? 0.34 : 0.37; }
  fit();
  var wall = window.HRWall.create(wallEl, look);
  var matter = window.THREE ? window.HRMatter.create(canvas, { frozen: S.reduced, palette: 'perola' }) : null;
  if (matter) {
    // uma cena só, parada: o mar visto pelo recorte do nome
    matter.setBeats([{ a: 0, b: 1, from: 'wave', to: 'wave', fx: 'still', turb: 0 }]);
    matter.setShots([{ u: 0, at: 'sea', az: 0, el: 25, r: 10.5, tall: 1, stop: true }, { u: 1, at: 'sea', az: 0, el: 25, r: 10.5, tall: 1, stop: true }]);
  } else { canvas.hidden = true; still.src = still.getAttribute('data-src'); still.hidden = false; }   // sem WebGL: a imagem parada

  // o texto e os botões ficam logo abaixo do nome
  function place() { var b = wall.block; openEl.style.top = Math.round(b.y + b.h + Math.max(16, b.cap * 0.14)) + 'px'; }
  place();
  var last = '';
  S.onResize(function () { fit(); wall.layout(); place(); if (matter) matter.resize(); last = ''; });

  var env = { flash: 0, shake: 0, sx: 0, sy: 0, ts: 1, hold: false }, ptr = { x: 0, y: 0 }, solid = null;
  S.loop(function (t, dt) {
    var r = hero.getBoundingClientRect(), visible = r.bottom > 0;
    // fora da abertura a barra ganha fundo e o nome aparece nela (na abertura ele já está gigante na parede)
    var past = r.bottom < 90;
    if (past !== solid) { solid = past; root.classList.toggle('past-film', past); brandEl.style.setProperty('--brand', past ? 1 : 0); }
    if (!visible) { S.rest(); return; }     // a abertura saiu da tela: nada a desenhar até a próxima rolagem
    var px = S.pointer.x, py = S.pointer.y, key = px.toFixed(3) + '|' + py.toFixed(3);
    if (key !== last) { wall.render({ s: 0, px: px, py: py }); last = key; }   // a parede só se mexe com o cursor
    if (matter) { ptr.x = px; ptr.y = py; matter.frame(dt, 0, ptr, env); }
  });
})();
