// ===== Abertura da página inicial =====
// A primeira tela mostra de cara quem é, o que faz e para onde ir: o nome recortado numa parede preta
// (js/wall.js) e, atrás dele, o mar de partículas de luz (js/matter.js). Este arquivo liga os dois ao
// cursor e desenha um quadro por vez. A página rola normalmente.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = document.querySelector('.hero'), wallEl = hero.querySelector('.wall'), openEl = hero.querySelector('.open');
  var canvas = hero.querySelector('.world'), still = hero.querySelector('.world-still'), brandEl = document.querySelector('.nav__brand');

  // ---------- Cursor ----------
  // De -1 a 1, suavizado. Em telas de toque, um vaivém lento faz o papel do cursor.
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 }, touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  function follow(t, dt) {
    if (touch && !reduced) { pointer.tx = Math.sin(t * 0.45) * 0.6; pointer.ty = Math.cos(t * 0.31) * 0.35; }
    var k = 1 - Math.exp(-dt * 6);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
  }

  // ---------- Parede e mar ----------
  // As laterais do recorte do nome pegam a cor da luz que vem de trás (paleta "perola": branco e dourado)
  var pearl = window.HRMatter.palettes.perola.main;
  var look = {
    sideNear: [pearl[0][0] * 40, pearl[0][1] * 40, pearl[0][2] * 40],
    sideFar: [(pearl[1][0] + pearl[2][0]) * 44, (pearl[1][1] + pearl[2][1]) * 44, (pearl[1][2] + pearl[2][2]) * 44]
  };
  // O nome fica acima do centro: embaixo dele vêm a função e os botões. Em telas baixas (celular deitado)
  // ele encolhe mais um pouco, para os botões caberem na primeira tela.
  function fit() { var low = hero.clientHeight < 520; look.maxHeight = low ? 0.34 : 0.4; look.centerY = low ? 0.34 : 0.37; }
  fit();
  var wall = window.HRWall.create(wallEl, look);
  var matter = window.THREE ? window.HRMatter.create(canvas, { frozen: reduced, palette: 'perola' }) : null;
  if (!matter) { canvas.hidden = true; still.src = still.getAttribute('data-src'); still.hidden = false; }   // sem WebGL: a imagem parada

  // o texto e os botões ficam logo abaixo do nome
  function place() { var b = wall.block; openEl.style.top = Math.round(b.y + b.h + Math.max(16, b.cap * 0.14)) + 'px'; }
  place();
  var last = '';

  // ---------- Desenho, um quadro por vez ----------
  var solid = null;
  function draw(dt) {
    var r = hero.getBoundingClientRect();
    // fora da abertura a barra ganha fundo e o nome aparece nela (na abertura ele já está gigante na parede)
    var past = r.bottom < 90;
    if (past !== solid) { solid = past; root.classList.toggle('past-hero', past); brandEl.style.setProperty('--brand', past ? 1 : 0); }
    if (r.bottom <= 0) return false;      // a abertura saiu da tela: nada a desenhar até a próxima rolagem
    var px = pointer.x, py = pointer.y, key = px.toFixed(3) + '|' + py.toFixed(3);
    if (key !== last) { wall.render(px, py); last = key; }   // a parede só se mexe com o cursor
    if (matter) matter.frame(dt, pointer);
    return true;
  }
  // O laço descansa quando a abertura sai da tela; qualquer rolagem ou mudança de tamanho o acorda de novo.
  var lastT = 0, running = true;
  function frame(now) {
    var dt = Math.min(0.05, (now - lastT) / 1000 || 0.016); lastT = now;
    follow(now / 1000, dt);
    running = draw(dt);
    if (running) requestAnimationFrame(frame);
  }
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }
  requestAnimationFrame(frame);
  window.addEventListener('scroll', wake, { passive: true });

  var rt = 0;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(rt);
    rt = requestAnimationFrame(function () { fit(); wall.layout(); place(); if (matter) matter.resize(); last = ''; wake(); });
  });
})();
