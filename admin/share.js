// ===== A página de prévia de cada trabalho (w/<id>.html) =====
// Quem cola o link de um trabalho no Discord, no WhatsApp ou no X vê o cartão com a foto, o nome e a descrição dele. O "#"
// de um link nunca chega ao servidor, então cada trabalho tem esta página leve, só com as etiquetas da prévia (Open Graph):
// https://henriquerocha.dev.br/w/<id>, com a imagem w/<id>.jpg (1200 x 630, feita pelo painel). Quem abre a página vai na
// hora para o trabalho aberto no site (js/go.js). O painel refaz todas a cada Publicar e apaga as de um trabalho apagado.
// O mesmo código serve ao painel (admin/admin.js) e a quem gerar as páginas fora dele (sem nada do navegador aqui).
(function (root) {
  'use strict';
  var SITE = 'https://henriquerocha.dev.br';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ytId(url) { var m = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/.exec(String(url || '')); return m ? m[1] : ''; }
  // as mesmas regras do link no site (js/page.js): o título só deixa o link legível; quem decide é o id
  function slugOf(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, ''); }
  // O id de um trabalho: o campo "id" (o painel grava); nos de antes, o código único do nome do arquivo da capa (ou o do vídeo
  // do YouTube). Trocar as imagens de um trabalho não muda o id, então os links já enviados continuam valendo.
  function idOf(it) {
    if (typeof it.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(it.id)) return it.id;
    if (it.type === 'youtube' && ytId(it.src)) return ytId(it.src);
    var name = String(it.src || '').split(/[?#]/)[0].split('/').pop().replace(/\.[^.]+$/, ''), m = /-([0-9a-z]{6,})$/.exec(name);
    if (m) return m[1];
    for (var h = 0, i = 0; i < String(it.src || '').length; i++) h = (Math.imul(h, 31) + it.src.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function linkOf(it) { var s = slugOf(it.title_pt || it.title), k = idOf(it); return s ? s + '-' + k : k; }
  function page(it) {
    var id = idOf(it), url = SITE + '/w/' + id, go = '/#' + linkOf(it), tube = it.type === 'youtube';
    var title = it.title || it.title_pt || 'Henrique Rocha';
    var desc = it.desc || it.desc_pt || 'A piece by Henrique Rocha, full-stack Roblox developer and AI engineer.';
    var img = tube ? 'https://i.ytimg.com/vi/' + ytId(it.src) + '/hqdefault.jpg' : SITE + '/w/' + id + '.jpg';
    var L = [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; base-uri \'none\'; form-action \'none\'">',
      '<meta name="color-scheme" content="dark">',
      '<meta name="robots" content="noindex">',
      '<title>' + esc(title) + ' · Henrique Rocha</title>',
      '<meta name="description" content="' + esc(desc) + '">',
      '<link rel="canonical" href="' + url + '">',
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Henrique Rocha">',
      '<meta property="og:url" content="' + url + '">',
      '<meta property="og:title" content="' + esc(title) + '">',
      '<meta property="og:description" content="' + esc(desc) + '">',
      '<meta property="og:image" content="' + img + '">'
    ];
    if (!tube) L.push('<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">');
    L.push(
      '<meta property="og:image:alt" content="' + esc(it.alt || title) + '">',
      '<meta property="og:locale" content="en_US">',
      '<meta property="og:locale:alternate" content="pt_BR">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="theme-color" content="#f0b24a">',
      '<meta name="hr-go" content="' + esc(go) + '">',
      '<script src="/js/go.js"></script>',
      '</head>',
      '<body>',
      '<p><a href="' + esc(go) + '">' + esc(title) + '</a> · Henrique Rocha</p>',
      '</body>',
      '</html>',
      ''
    );
    return L.join('\n');
  }
  root.HRShare = { idOf: idOf, linkOf: linkOf, page: page, ytId: ytId };
})(typeof window !== 'undefined' ? window : this);
