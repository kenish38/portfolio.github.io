// A página de prévia de um trabalho (w/<id>.html, feita pelo painel; ver admin/share.js) serve para o Discord, o WhatsApp e
// o X montarem o cartão do link. Quem abre a página de verdade vem para cá: na hora, o trabalho aberto no site.
(function () {
  var m = document.querySelector('meta[name="hr-go"]'), go = m && m.getAttribute('content');
  if (go && /^\/#[\w-]+$/.test(go)) location.replace(go);
})();
