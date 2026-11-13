// ===== Cenas de abertura =====
//   wave   mar de luz visto pelo recorte do nome (e de novo na tela final)
//   plate  grade plana de studs: a baseplate de onde todo jogo começa
(window.HRFilm = window.HRFilm || []).push(function (E) {
  'use strict';
  var N = E.N, SIDE = Math.round(Math.sqrt(N)), WX = SIDE === 200 ? 320 : SIDE === 250 ? 500 : 512, WZ = N / WX;

  function wave() {
    var s = new E.Shape(), r = E.rng(3);
    for (var iz = 0; iz < WZ; iz++) for (var ix = 0; ix < WX; ix++) {
      var x = (ix / (WX - 1) - 0.5) * 32, z = (iz / (WZ - 1)) * 22 - 17;
      if (r() < 0.02) s.put(x, -1.1, z, -1);
      else s.put(x, -1.1, z, 0.2 + 0.5 * E.fbm(x * 0.16 + 9, z * 0.22 + 4) + (r() < 0.04 ? 0.5 : 0));
    }
    return s;
  }
  function plateAt(i) { var ix = i % SIDE, iz = (i - ix) / SIDE; return [(ix / (SIDE - 1) - 0.5) * 10, (iz / (SIDE - 1) - 0.5) * 10, ix, iz]; }
  function plate() {
    var s = new E.Shape(), cell = Math.round(SIDE / 20);
    for (var i = 0; i < N; i++) {
      var p = plateAt(i), line = (p[2] % cell === 0 || p[3] % cell === 0), edge = p[2] === 0 || p[3] === 0 || p[2] === SIDE - 1 || p[3] === SIDE - 1;
      // um único stud dourado, na casa onde o peão dourado vai estar: o primeiro ouro do filme
      var gold = Math.abs(p[0] + 0.5) < 0.09 && Math.abs(p[1] - 0.5) < 0.09;
      if (gold) s.put(p[0], 0.02, p[1], 2.9, 1.5);
      else s.put(p[0], 0, p[1], edge ? 1 : line ? 0.9 : 0.28, edge ? 1.3 : 1);
    }
    return s;
  }

  E.scene('wave', { make: wave, keep: true, wave: 1, size: 0.085, gain: 0.82, vary: 1, dof: 0.07 });
  E.scene('plate', { make: plate, keep: true, size: 0.05, gain: 1.0, vary: 0.15, dof: 0.05 });
  E.subject('sea', { at: function () { return [0, 0.2, 0]; } });   // o que a câmera olha na abertura (os planos ficam em main.js)

  // O mar assenta do centro para as bordas: a baseplate se forma como uma onda que se espalha
  E.fx('settle', function () {
    var a = new Float32Array(N * 4);
    for (var i = 0; i < N; i++) { var p = plateAt(i); a[i * 4] = E.clamp(Math.hypot(p[0], p[1]) / 7, 0, 1); a[i * 4 + 2] = 0.35; }
    return a;
  });
});
