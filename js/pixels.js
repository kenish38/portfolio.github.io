// ===== Pixels de verdade para os desenhos em <canvas> (o estúdio 3D e o mapa da Workstation X) =====
// Um canvas tem dois tamanhos: o da página (em pontos do CSS) e o do desenho (em pixels). Para sair nítido, o desenho precisa
// de um pixel para cada pixel da tela. O jeito padrão de medir isso é o ResizeObserver com 'device-pixel-content-box': ele diz
// quantos pixels da tela o canvas ocupa e avisa quando isso muda, também no Ctrl+zoom. O aviso comum (o tamanho em pontos)
// não vinha no zoom, porque o quadro tem largura máxima e não muda de tamanho: o desenho ficava o de antes, esticado e mole.
// Sem essa medida (Safari): pontos x devicePixelRatio, com um aviso do matchMedia quando a resolução muda (o jeito do MDN).
// No zoom de pinça (touchpad ou dedos) a resolução da tela não muda, a página é que é ampliada (visualViewport.scale): o
// desenho ganha pixels na mesma proporção, até 3 por ponto. Ver web.dev/articles/device-pixel-content-box.
(function () {
  'use strict';
  var vv = window.visualViewport;
  function pinch() { return vv && vv.scale > 1.01 ? vv.scale : 1; }
  // avisa quando a resolução muda (zoom, outra tela); o aviso vale para uma resolução só, então é refeito a cada troca
  function onRatio(cb) {
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
    function on() { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); cb(); onRatio(cb); }
    if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on);
  }
  window.HRPixels = {
    // o tamanho em pixels da tela que veio no aviso do ResizeObserver (ou null, se o navegador não mede assim)
    read: function (entries) {
      var e = entries && entries.length && entries[entries.length - 1], s = e && e.devicePixelContentBoxSize && e.devicePixelContentBoxSize[0];
      return s ? [s.inlineSize, s.blockSize] : null;
    },
    // os pixels do desenho para um quadro de w x h pontos: o tamanho medido, se houver e couber no limite (cap pixels por
    // ponto); senão, a conta. Ampliado com pinça, o limite sobe para 3.
    size: function (w, h, real, cap) {
      var d = window.devicePixelRatio || 1, p = pinch(), k = Math.min(d * p, p > 1 ? Math.max(cap, 3) : cap);
      if (real && p === 1 && d <= cap) return [Math.max(1, real[0]), Math.max(1, real[1])];
      return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
    },
    // chama cb quando o desenho precisa de outro tamanho: o quadro mudou, a resolução mudou ou a pinça parou
    watch: function (el, cb) {
      var exact = false, t = 0;
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(cb);
        try { ro.observe(el, { box: 'device-pixel-content-box' }); exact = true; } catch (e) { ro.observe(el); }
      } else window.addEventListener('resize', function () { cb(); });
      if (!exact) onRatio(function () { cb(); });
      if (vv) vv.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { cb(); }, 200); });
    },
    pinch: pinch
  };
})();
