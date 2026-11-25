// A página de "não existe" (404.html, que o GitHub Pages mostra para qualquer endereço sem arquivo). O link da prévia de um
// trabalho (/w/<id>) que ainda não tem a página dele cai aqui e vai para o trabalho aberto no site (o site acha pelo id).
(function () {
  var m = /^\/w\/([A-Za-z0-9_-]{4,40})\/?$/.exec(location.pathname);
  if (m) location.replace('/#' + m[1]);
})();
