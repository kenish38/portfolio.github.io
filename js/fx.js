// ===== Toques de interação pela página =====
// (a luz que seguia o cursor saiu: era uma camada por cima da página inteira, com mistura de cores, e o Chrome no
// Windows passava a desenhar todos os textos com o serrilhado borrado)
//   os cartões de trabalho com um reflexo de luz que segue o cursor (eles não inclinam mais em 3D: inclinado, o cartão
//   vira uma imagem girada pelo navegador, e o título e a foto saíam moles e serrilhados)
//   os títulos das seções que se formam do pó quando aparecem na tela (o pó de js/ash.js), uma vez por visita
// Quem pediu menos movimento não vê o reflexo nem o pó (os títulos aparecem normalmente).
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- O reflexo dos cartões ----------
  var list = document.querySelector('.media');
  if (list && fine && !reduced) {
    list.addEventListener('pointermove', function (e) {
      var li = e.target.closest && e.target.closest('.media > li');
      if (!li) return;
      var r = li.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      li.classList.add('is-tilting');
      li.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); li.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    list.addEventListener('pointerout', function (e) {
      var li = e.target.closest && e.target.closest('.media > li');
      if (!li || (e.relatedTarget && li.contains(e.relatedTarget))) return;
      li.classList.remove('is-tilting');
    });
  }

  // ---------- Os títulos que se formam do pó ----------
  var ash = window.HRAsh;
  if (ash && !ash.reduced && window.IntersectionObserver) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        ash.run([e.target], { appear: true, duration: 1000, dust: 0.8, spots: function () {
          var r = document.createRange(); r.selectNodeContents(e.target);
          return Array.prototype.slice.call(r.getClientRects());
        } });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.section__head h2, .about__hello, .contact__title').forEach(function (h) { h.classList.add('dust-in'); io.observe(h); });
  }
})();
