// ===== Sobre mim: a dock de programas =====
// Os ícones dos programas dão um pulinho ao aparecer, crescem sob o cursor (como uma dock de apps) e, ao clicar,
// pulam de novo e mostram embaixo o nome do programa e para que ele serve. Quem pediu menos movimento não vê os pulos.
(function () {
  'use strict';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- A dock ----------
  var dock = document.querySelector('.dock'), caption = document.querySelector('.dock__caption');
  if (!dock) return;
  var apps = Array.prototype.slice.call(dock.querySelectorAll('.app'));
  function hop(a) {
    if (reduced) return;
    a.classList.remove('is-hop'); void a.offsetWidth; a.classList.add('is-hop');      // reinicia o pulinho
  }
  apps.forEach(function (a) {
    a.addEventListener('click', function () {
      hop(a);
      if (!caption) return;
      var b = document.createElement('b');
      b.textContent = a.querySelector('.app__tip b').textContent;
      caption.textContent = '';
      caption.appendChild(b);
      caption.appendChild(document.createTextNode(': ' + a.querySelector('.app__tip span').textContent));
    });
    a.addEventListener('animationend', function () { a.classList.remove('is-hop'); });
  });
  // os ícones crescem conforme o cursor chega perto deles
  if (fine && !reduced) {
    dock.addEventListener('pointermove', function (e) {
      apps.forEach(function (a) {
        var r = a.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)), k = Math.max(0, 1 - d / 150);
        a.style.setProperty('--mag', (1 + 0.5 * k * k).toFixed(3));
      });
    });
    dock.addEventListener('pointerleave', function () { apps.forEach(function (a) { a.style.setProperty('--mag', '1'); }); });
  }
  // na primeira vez que a dock aparece, os ícones pulam um depois do outro, como apps abrindo
  if (!reduced && window.IntersectionObserver) {
    var seen = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      seen.disconnect();
      apps.forEach(function (a, i) { setTimeout(function () { hop(a); }, 150 + i * 90); });
    }, { threshold: 0.7 });
    seen.observe(dock);
  }
})();
