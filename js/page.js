// ===== A página: portfólio, visualizador, loja, contato e o botão do dono =====
// Cada bloco só age se o elemento dele existir na página.
(function () {
  'use strict';
  var root = document.documentElement;

  // ---------- Portfólio: imagens e vídeos de portfolio.json ----------
  var list = document.querySelector('.media'), box = document.querySelector('.lightbox');
  if (list && box) portfolio();
  // tipos de trabalho (o painel usa as mesmas chaves): [inglês, português]
  var KINDS = { map: ['Map', 'Mapa'], model: ['3D model', 'Modelo 3D'], lighting: ['Lighting & VFX', 'Iluminação e VFX'], script: ['Systems & scripts', 'Sistemas e scripts'], ui: ['Interface', 'Interface'], game: ['Full game', 'Jogo completo'], ai: ['AI tool', 'Ferramenta de IA'] };
  function portfolio() {
    var boxStage = box.querySelector('.lightbox__stage'), boxDesc = box.querySelector('.lightbox__desc');
    var boxTitle = box.querySelector('.lightbox__title'), boxCount = box.querySelector('.lightbox__count'), shown = -1;
    var items = null, slides = [];
    function pt() { return document.documentElement.lang === 'pt-BR'; }
    function two(n) { return (n < 10 ? '0' : '') + n; }
    // Vídeo do YouTube: o item guarda o link; daqui sai o código de 11 letras que identifica o vídeo
    function ytId(url) { var m = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/.exec(String(url || '')); return m ? m[1] : ''; }
    function title(item) { return pt() && item.title_pt ? item.title_pt : (item.title || ''); }
    function desc(item) { return pt() && item.desc_pt ? item.desc_pt : (item.desc || ''); }
    function kind(item) { var k = KINDS[item.kind]; return k ? k[pt() ? 1 : 0] : ''; }
    // descrição da imagem para quem não a vê: "alt" e "alt_pt" em portfolio.json; sem eles, a descrição ou o título
    function alt(item) { return (pt() && item.alt_pt ? item.alt_pt : item.alt) || desc(item) || title(item); }
    function extras(item) { return Array.isArray(item.more) ? item.more.filter(function (m) { return m && typeof m.src === 'string'; }) : []; }
    // Cada foto vira um quadro do visualizador, na ordem: a principal de cada trabalho e logo depois as fotos extras dele
    function build() {
      slides = [];
      (items || []).forEach(function (item, n) {
        var more = extras(item);
        slides.push({ item: item, n: n, k: 0, of: more.length + 1, media: item });
        more.forEach(function (m, k) { slides.push({ item: item, n: n, k: k + 1, of: more.length + 1, media: { type: 'image', src: m.src } }); });
      });
    }
    // Abre o quadro s no visualizador, com o número, o título e a descrição na barra de baixo
    function open(s) {
      var sl = slides[s], item = sl.item, media = sl.media; shown = s;
      boxStage.textContent = '';
      var el = document.createElement(media.type === 'youtube' ? 'iframe' : media.type === 'video' ? 'video' : 'img');
      if (media.type === 'youtube') {      // o player do YouTube só é carregado aqui, quando o visitante abre o vídeo
        el.src = 'https://www.youtube-nocookie.com/embed/' + ytId(media.src) + '?autoplay=1&rel=0&playsinline=1';
        el.title = title(item) || 'YouTube'; el.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; el.allowFullscreen = true;
      } else {
        el.src = media.src;
        if (media.type === 'video') { el.controls = true; el.autoplay = true; el.playsInline = true; }
        else el.alt = alt(item) + (sl.of > 1 ? ' (' + (sl.k + 1) + '/' + sl.of + ')' : '');
      }
      boxStage.appendChild(el);
      boxTitle.textContent = title(item);
      boxDesc.textContent = desc(item);
      boxCount.textContent = two(sl.n + 1) + ' / ' + two(items.length) + (sl.of > 1 ? '  ·  ' + (pt() ? 'foto ' : 'photo ') + (sl.k + 1) + '/' + sl.of : '');
      box.classList.toggle('is-single', slides.length < 2);
      if (!box.open && box.showModal) box.showModal();
    }
    // Anterior e próximo (botões e setas do teclado), dando a volta no fim da lista
    function step(d) { if (shown >= 0 && slides.length > 1) open((shown + d + slides.length) % slides.length); }
    box.querySelector('.lightbox__prev').addEventListener('click', function () { step(-1); });
    box.querySelector('.lightbox__next').addEventListener('click', function () { step(1); });
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); });
    function close() { boxStage.textContent = ''; if (box.open) box.close(); }
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.addEventListener('close', function () { boxStage.textContent = ''; shown = -1; });
    function render() {
      root.classList.toggle('no-work', !items || !items.length);
      list.textContent = '';
      build();
      if (!items || !items.length) return;      // sem itens, fica o estado vazio (.empty)
      items.forEach(function (item, i) {
        var li = document.createElement('li'), btn = document.createElement('button'), cap = document.createElement('span'), m;
        var film = item.type === 'video' || item.type === 'youtube', more = extras(item).length;
        var label = film ? (pt() ? 'Abrir vídeo' : 'Open video') : (pt() ? 'Abrir imagem' : 'Open image');
        li.className = 'item' + (film ? ' item--video' : '');
        btn.type = 'button'; btn.className = 'item__open';
        if (item.type === 'video' && !item.poster) { m = document.createElement('video'); m.src = item.src; m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
        else if (item.type === 'youtube' && !item.poster) {      // capa do próprio YouTube: a maior; se o vídeo não tiver essa, a média
          m = document.createElement('img'); m.loading = 'lazy'; m.alt = '';
          m.onerror = function () { m.onerror = null; m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/hqdefault.jpg'; };
          m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/maxresdefault.jpg';
        }
        else { m = document.createElement('img'); m.src = item.thumb || item.poster || item.src; m.loading = 'lazy'; m.alt = ''; }   // thumb: versão leve para a grade (opcional)
        btn.setAttribute('aria-label', label + ': ' + (alt(item) || (i + 1)) + (more ? (pt() ? ' (' + (more + 1) + ' fotos)' : ' (' + (more + 1) + ' photos)') : ''));     // o botão sempre tem nome
        btn.appendChild(m);
        var first = slides.findIndex(function (sl) { return sl.n === i; });
        btn.addEventListener('click', function () { open(first); });
        li.appendChild(btn);
        // no pé do cartão: o nome do trabalho e, embaixo, o tipo
        cap.className = 'item__cap';
        var t = title(item), k = kind(item);
        if (t) { var tt = document.createElement('span'); tt.className = 'item__title'; tt.textContent = t; cap.appendChild(tt); }
        if (k) { var kk = document.createElement('span'); kk.className = 'item__kind'; kk.textContent = k; cap.appendChild(kk); }
        if (cap.childNodes.length) li.appendChild(cap);
        // quantas fotos o trabalho tem, no canto de cima
        if (more) { var c = document.createElement('span'); c.className = 'item__count'; c.setAttribute('aria-hidden', 'true'); c.textContent = (more + 1) + (pt() ? ' fotos' : ' photos'); li.appendChild(c); }
        list.appendChild(li);
      });
    }
    render();
    // no-cache: o navegador confere com o servidor antes de usar a cópia guardada (o dono publica pelo painel e quer ver na hora)
    if (window.fetch) fetch('portfolio.json', { cache: 'no-cache' }).then(function (res) { return res.ok ? res.json() : null; }).then(function (d) { items = d && Array.isArray(d.items) ? d.items : null; render(); }).catch(function () {});
    document.addEventListener('langchange', function () { render(); });
  }

  // ---------- Botão do dono ----------
  // Só aparece no navegador em que o dono já entrou no painel (admin/): lá fica guardada a chave de acesso dele.
  // Para qualquer outro visitante este trecho não faz nada.
  var owner = false; try { owner = !!(localStorage.getItem('hr-admin-token') || sessionStorage.getItem('hr-admin-token')); } catch (e) {}
  if (owner) {
    var dev = document.createElement('a');
    dev.className = 'dev'; dev.href = 'admin/';
    dev.setAttribute('aria-label', 'Editar o site'); dev.title = 'Editar o site';
    document.body.appendChild(dev);
  }

  // ---------- Loja: o convite do Discord vem do arquivo que o bot do Notorious publica ----------
  var join = document.querySelector('.store__join');
  if (join && window.fetch) fetch('notorious/store.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (d) {
    var inv = d && d.invite, url = inv && inv.url;
    if (typeof url !== 'string' || !/^https:\/\/(discord\.gg|discord\.com\/invite)\/[\w-]+$/.test(url)) return;
    if (inv.expiresAt && Date.parse(inv.expiresAt) < Date.now()) return;
    join.href = url; join.hidden = false;
  }).catch(function () {});

  // ---------- Copiar e-mail ----------
  var copyBtn = document.querySelector('.mail__copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var pt = document.documentElement.lang === 'pt-BR';
    var text = copyBtn.textContent, done = pt ? copyBtn.dataset.ptDone : copyBtn.dataset.done;
    function ok() {
      copyBtn.textContent = done; copyBtn.classList.add('is-done');
      setTimeout(function () { copyBtn.textContent = text; copyBtn.classList.remove('is-done'); }, 1600);
    }
    function fallback() {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(document.querySelector('.mail__link')); sel.removeAllRanges(); sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyBtn.dataset.copy).then(ok, fallback);
    else fallback();
  });
})();
