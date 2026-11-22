// ===== Cenas de abertura =====
//   wave   mar de luz visto pelo recorte do nome
// (a página inicial usa só esta cena; o resto do filme fica em js/film-place.js)
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  // malha do mar: WX x WZ pontos (nos três tamanhos normais a conta fecha; com mais pontos, o resto fica guardado, apagado)
  var N = E.N, SIDE = Math.round(Math.sqrt(N)), WX = SIDE === 200 ? 320 : SIDE === 250 ? 500 : SIDE === 320 ? 512 : Math.round(Math.sqrt(N * 1.6)), WZ = Math.floor(N / WX);

  function wave() {
    var s = new E.Shape(), r = E.rng(3);
    for (var iz = 0; iz < WZ; iz++) for (var ix = 0; ix < WX; ix++) {
      var x = (ix / (WX - 1) - 0.5) * 32, z = (iz / (WZ - 1)) * 22 - 17;
      if (r() < 0.02) s.put(x, -1.1, z, -1);
      else s.put(x, -1.1, z, 0.2 + 0.5 * E.fbm(x * 0.16 + 9, z * 0.22 + 4) + (r() < 0.04 ? 0.5 : 0));
    }
    while (s.n < N) s.put(0, -1.1, 0, 0, 0);
    return s;
  }
  E.scene('wave', { make: wave, keep: true, wave: 1, size: 0.085, gain: 0.82, vary: 1, dof: 0.07 });
  E.subject('sea', { at: function () { return [0, 0.2, 0]; } });   // o que a câmera olha na abertura (os planos ficam em film.js)
});
