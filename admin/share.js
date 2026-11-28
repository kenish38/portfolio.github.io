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

  // ===== O que os buscadores e as IAs leem sem JavaScript =====
  // A grade dos trabalhos é montada pelo JavaScript (js/page.js), e os robôs das IAs (e alguns buscadores) leem só o HTML,
  // sem rodar nada. Então o painel refaz a cada Publicar, a partir da lista nova:
  //   - index.html, entre as marcas "trabalhos: começo" e "trabalhos: fim": a lista dos trabalhos em texto (num <noscript>:
  //     quem tem JavaScript vê só a grade) ou, sem trabalhos, o aviso de que eles estão chegando;
  //   - llms.txt: quem é o Henrique, o que ele faz e os trabalhos, em texto simples (o resumo que as IAs procuram);
  //   - sitemap.xml: a página, a data da última mudança e as imagens dos trabalhos (para a busca de imagens).
  // O texto sobre o Henrique fica aqui embaixo (ABOUT): mudou o site, mude aqui também. tools/textos.js refaz os três
  // arquivos fora do painel, com a mesma conta.
  var ROBLOX = 'https://www.roblox.com/users/3749374809/profile', DISCORD = 'https://discord.com/users/992401997309415424';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function dateText(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : ''; }
  function catOf(data, it) {
    var c = (data.categories || []).filter(function (x) { return x.id === it.kind; })[0];
    return c ? { en: c.en || c.pt || '', pt: c.pt || c.en || '' } : null;
  }
  function abs(p) { return /^https?:\/\//.test(p || '') ? p : SITE + '/' + String(p || '').replace(/^\/+/, ''); }
  function fromRoot(p) { return /^([a-z][a-z0-9+.-]*:|\/)/i.test(p || '') ? p : '/' + p; }   // a partir da raiz do site (ver js/page.js)
  function imagesOf(it) {               // os arquivos das imagens de um trabalho, a capa primeiro
    if (it.type === 'youtube') return [];
    var out = [it.type === 'video' ? it.poster : it.src];
    (it.more || []).forEach(function (m) { out.push(m.src); });
    return out.filter(Boolean);
  }
  var EMPTY = [               // o aviso de quando não há trabalhos (a grade, com JavaScript, mostra o mesmo: ver .empty no CSS)
    '<div class="empty">',
    '  <div class="empty__slots" aria-hidden="true"><span></span><span></span><span></span></div>',
    '  <div class="empty__body">',
    '    <h3 class="empty__title" data-pt="Os trabalhos estão sendo adicionados.">Work samples are being added.</h3>',
    '    <p class="empty__text" data-pt="Enquanto isso, peça exemplos pelo Discord e eu envio direto: mapas, modelos, VFX, scripts e interfaces.">Until then, ask for examples on Discord and I will send them directly: maps, models, VFX, scripts and interfaces.</p>',
    '    <a class="btn btn--solid" href="' + DISCORD + '" target="_blank" rel="noopener" data-pt="Pedir exemplos no Discord">Ask for examples on Discord</a>',
    '  </div>',
    '</div>'
  ];
  function worksBlock(data) {
    var items = data.items || [];
    if (!items.length) return EMPTY;
    var L = ['<noscript>', '  <ul class="work__text">'];
    items.forEach(function (it) {
      var c = catOf(data, it), title = it.title || it.title_pt || 'Untitled', pt = it.title_pt && it.title_pt !== title ? it.title_pt : '';
      var meta = [c && c.en, dateText(it.date)].filter(Boolean).join(' · ');
      var cover = it.type === 'youtube' ? '' : fromRoot(it.thumb || it.poster || it.src), open = fromRoot(it.src);   // a miniatura leva ao arquivo cheio
      L.push('    <li>');
      if (cover) L.push('      <a href="' + esc(open) + '"><img src="' + esc(cover) + '" alt="' + esc(it.alt || title) + '" loading="lazy"></a>');
      L.push('      <h3><a href="' + esc(SITE + '/w/' + idOf(it)) + '">' + esc(title) + '</a></h3>');
      if (meta || pt) L.push('      <p>' + esc(meta) + (pt ? (meta ? ' · ' : '') + '<span lang="pt-BR">' + esc(pt) + '</span>' : '') + '</p>');
      if (it.desc) L.push('      <p>' + esc(it.desc) + '</p>');
      if (it.desc_pt && it.desc_pt !== it.desc) L.push('      <p lang="pt-BR">' + esc(it.desc_pt) + '</p>');
      if (it.type === 'youtube') L.push('      <p><a href="' + esc(it.src) + '">Watch on YouTube</a></p>');
      L.push('    </li>');
    });
    L.push('  </ul>', '</noscript>');
    return L;
  }
  // troca o que está entre as marcas no index.html; null se as marcas não estão lá ou se nada mudou
  var START = '<!-- trabalhos: começo -->', END = '<!-- trabalhos: fim -->';
  function inPage(html, data) {
    var a = html.indexOf(START), b = html.indexOf(END);
    if (a < 0 || b < a) return null;
    var lineStart = html.lastIndexOf('\n', a) + 1, pad = html.slice(lineStart, a).replace(/\S.*$/, '');
    var body = worksBlock(data).map(function (l) { return pad + l; }).join('\n');
    var out = html.slice(0, a) + START + '\n' + body + '\n' + pad + html.slice(b);
    return out === html ? null : out;
  }
  // o texto sobre o Henrique (o mesmo do site: ver o index.html)
  var ABOUT = [
    '# Henrique Rocha',
    '',
    '> Henrique Rocha (full name Henrique Rocha dos Santos, known as kenish38 on Roblox) is a full-stack Roblox developer and AI engineer from Minas Gerais, Brazil. He builds Roblox games end to end (maps, 3D models, lighting, VFX, Luau systems and interfaces) and the AI tools that speed the work up. He co-founded Notorious Workshop, a Roblox asset store, and takes commissions on Discord.',
    '',
    'Em português: Henrique Rocha (nome completo Henrique Rocha dos Santos, conhecido como kenish38 no Roblox) é desenvolvedor Roblox full-stack e engenheiro de IA, de Minas Gerais. Faz jogos no Roblox de ponta a ponta (mapas, modelos 3D, iluminação, VFX, sistemas em Luau e interfaces) e as ferramentas de IA que aceleram o trabalho. É cofundador da Notorious Workshop, uma loja de assets para Roblox, e aceita encomendas pelo Discord.',
    '',
    '## Links',
    '',
    '- [Portfolio](' + SITE + '/): work, services, Workstation X and contact, in English and Portuguese',
    '- [Roblox profile](' + ROBLOX + '): kenish38',
    '- [Discord](' + DISCORD + '): commissions and questions (the main way to reach him)',
    '',
    '## What he does',
    '',
    'Everything a Roblox game needs except sound, from the first block on the baseplate to the published game:',
    '',
    '- 3D & Environments: 3D models, maps, props and full environments with the right scale, clear readability and a clean finish, made to run well even on phones.',
    '- VFX & Lighting: light, atmosphere and effects that give every scene its mood and weight.',
    '- Systems: Luau scripting built to grow (weapons, combat, progression, economy and saved data), in organized code that holds up update after update.',
    '- UI/UX: HUDs, menus and shops that read at a glance on phone and desktop.',
    '- AI Engineering: systems architecture, and the tools and automations he builds with AI, trains and builds into his workflow.',
    '',
    '## Workstation X',
    '',
    'His most ambitious project: the AI studio he built for himself. It plans, builds, tests and judges maps, 3D models, materials and effects for Roblox, working directly inside Blender, Substance 3D Painter, Substance 3D Designer, Photoshop and Roblox Studio. A jury of 10 specialized AI jurors filters the results, a memory of over a thousand lessons learns from his scores and corrections, two AI analysts from different models give a second opinion before important decisions, and Henrique always gives the final approval. Every piece in his portfolio was made with it.',
    '',
    '## Notorious Workshop',
    '',
    'A Roblox asset store that Henrique co-founded and owns with one partner: ready-made packs and custom creations, sold directly through the store\'s Discord server.',
    '',
    '## Software',
    '',
    'Roblox Studio, Blender, ZBrush, Substance 3D Painter, Substance 3D Designer, Substance 3D Sampler, Photoshop, Illustrator, After Effects, Marmoset Toolbag and RizomUV.'
  ];
  function llms(data) {
    var L = ABOUT.slice(), items = data.items || [];
    L.push('', '## Work', '');
    if (!items.length) L.push('Work samples are being added to the portfolio. Ask for examples on Discord.');
    items.forEach(function (it) {
      var c = catOf(data, it), title = it.title || it.title_pt || 'Untitled', bits = [];
      if (c) bits.push(c.en + (c.pt && c.pt !== c.en ? ' (' + c.pt + ')' : ''));
      if (dateText(it.date)) bits.push(dateText(it.date));
      if (it.title_pt && it.title_pt !== title) bits.push('in Portuguese: ' + it.title_pt);
      var line = '- [' + title + '](' + SITE + '/w/' + idOf(it) + ')' + (bits.length ? ': ' + bits.join(', ') + '.' : '');
      if (it.desc) line += ' ' + it.desc;
      var imgs = imagesOf(it).map(abs);
      if (it.type === 'youtube') line += ' Video: ' + it.src;
      else if (imgs.length) line += ' Images: ' + imgs.join(' ');
      L.push(line);
    });
    return L.join('\n') + '\n';
  }
  function xml(s) { return esc(s).replace(/'/g, '&apos;'); }
  function sitemap(data, day) {
    var L = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!-- A lista de páginas para os buscadores, refeita pelo painel a cada Publicar (admin/share.js): o site tem uma página só',
      '     (o português abre pelo mesmo endereço), a data da última mudança e as imagens dos trabalhos (para a busca de imagens). -->',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      '  <url>',
      '    <loc>' + SITE + '/</loc>'
    ];
    if (/^\d{4}-\d{2}-\d{2}$/.test(day || '')) L.push('    <lastmod>' + day + '</lastmod>');
    (data.items || []).forEach(function (it) { imagesOf(it).forEach(function (p) { L.push('    <image:image><image:loc>' + xml(abs(p)) + '</image:loc></image:image>'); }); });
    L.push('  </url>', '</urlset>', '');
    return L.join('\n');
  }
  root.HRShare = { idOf: idOf, linkOf: linkOf, page: page, ytId: ytId, inPage: inPage, llms: llms, sitemap: sitemap };
})(typeof window !== 'undefined' ? window : this);
