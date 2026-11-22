// ===== A página: portfólio, visualizador, loja, contato e o botão do dono =====
// Cada bloco só age se o elemento dele existir na página.
(function () {
  'use strict';
  var root = document.documentElement;

  // ---------- Portfólio: imagens e vídeos de portfolio.json ----------
  var list = document.querySelector('.media'), box = document.querySelector('.lightbox');
  if (list && box) portfolio();
  function portfolio() {
    var boxStage = box.querySelector('.lightbox__stage');
    var boxTitle = box.querySelector('.lightbox__title'), boxCount = box.querySelector('.lightbox__count'), shown = -1;
    function two(n) { return (n < 10 ? '0' : '') + n; }
    // Vídeo do YouTube: o item guarda o link; daqui sai o código de 11 letras que identifica o vídeo
    function ytId(url) { var m = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/.exec(String(url || '')); return m ? m[1] : ''; }
    // Abre o item i no visualizador, com o número e o título na barra de baixo
    function open(i) {
      var item = items[i]; shown = i;
      boxStage.textContent = '';
      var el = document.createElement(item.type === 'youtube' ? 'iframe' : item.type === 'video' ? 'video' : 'img');
      if (item.type === 'youtube') {      // o player do YouTube só é carregado aqui, quando o visitante abre o vídeo
        el.src = 'https://www.youtube-nocookie.com/embed/' + ytId(item.src) + '?autoplay=1&rel=0&playsinline=1';
        el.title = title(item) || 'YouTube'; el.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; el.allowFullscreen = true;
      } else {
        el.src = item.src;
        if (item.type === 'video') { el.controls = true; el.autoplay = true; el.playsInline = true; }
        else el.alt = alt(item);
      }
      boxStage.appendChild(el);
      boxTitle.textContent = title(item);
      boxCount.textContent = two(i + 1) + ' / ' + two(items.length);
      box.classList.toggle('is-single', items.length < 2);
      if (!box.open && box.showModal) box.showModal();
    }
    // Anterior e próximo (botões e setas do teclado), dando a volta no fim da lista
    function step(d) { if (shown >= 0 && items && items.length > 1) open((shown + d + items.length) % items.length); }
    box.querySelector('.lightbox__prev').addEventListener('click', function () { step(-1); });
    box.querySelector('.lightbox__next').addEventListener('click', function () { step(1); });
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); });
    function close() { boxStage.textContent = ''; if (box.open) box.close(); }
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.addEventListener('close', function () { boxStage.textContent = ''; shown = -1; });
    function title(item) { return document.documentElement.lang === 'pt-BR' && item.title_pt ? item.title_pt : (item.title || ''); }
    // descrição da imagem para quem não a vê: "alt" e "alt_pt" em portfolio.json; sem eles, vale o título
    function alt(item) { return (document.documentElement.lang === 'pt-BR' && item.alt_pt ? item.alt_pt : item.alt) || title(item); }
    function render(items) {
      root.classList.toggle('no-work', !items || !items.length);
      list.textContent = '';
      if (!items || !items.length) return;      // sem itens, fica o estado vazio (.empty)
      items.forEach(function (item, i) {
        var li = document.createElement('li'), btn = document.createElement('button'), cap = document.createElement('span'), m;
        var pt = document.documentElement.lang === 'pt-BR', film = item.type === 'video' || item.type === 'youtube', kind = film ? (pt ? 'Abrir vídeo' : 'Open video') : (pt ? 'Abrir imagem' : 'Open image');
        li.className = 'item' + (film ? ' item--video' : '');
        btn.type = 'button'; btn.className = 'item__open';
        if (item.type === 'video' && !item.poster) { m = document.createElement('video'); m.src = item.src; m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
        else if (item.type === 'youtube' && !item.poster) {      // capa do próprio YouTube: a maior; se o vídeo não tiver essa, a média
          m = document.createElement('img'); m.loading = 'lazy'; m.alt = '';
          m.onerror = function () { m.onerror = null; m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/hqdefault.jpg'; };
          m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/maxresdefault.jpg';
        }
        else { m = document.createElement('img'); m.src = item.thumb || item.poster || item.src; m.loading = 'lazy'; m.alt = ''; }   // thumb: versão leve para a grade (opcional)
        btn.setAttribute('aria-label', kind + ': ' + (alt(item) || (i + 1)));     // o botão sempre tem nome, mesmo sem título
        btn.appendChild(m); btn.addEventListener('click', function () { open(i); });
        cap.className = 'item__title'; cap.textContent = title(item);
        li.appendChild(btn); if (cap.textContent) li.appendChild(cap);
        list.appendChild(li);
      });
    }
    var items = null;
    render(null);
    // no-cache: o navegador confere com o servidor antes de usar a cópia guardada (o dono publica pelo painel e quer ver na hora)
    if (window.fetch) fetch('portfolio.json', { cache: 'no-cache' }).then(function (res) { return res.ok ? res.json() : null; }).then(function (d) { items = d && d.items; render(items); }).catch(function () {});
    document.addEventListener('langchange', function () { render(items); });
  }

  // ---------- Botão do dono ----------
  // Só aparece no navegador em que o dono já entrou no painel (admin/): lá fica guardada a chave de acesso dele.
  // Para qualquer outro visitante este trecho não faz nada.
  var owner = false; try { owner = !!localStorage.getItem('hr-admin-token'); } catch (e) {}
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
  var copyBtn = document.querySelector('.way__copy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var pt = document.documentElement.lang === 'pt-BR';
    var text = copyBtn.textContent, done = pt ? copyBtn.dataset.ptDone : copyBtn.dataset.done;
    function ok() {
      copyBtn.textContent = done; copyBtn.classList.add('is-done');
      setTimeout(function () { copyBtn.textContent = text; copyBtn.classList.remove('is-done'); }, 1600);
    }
    function fallback() {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(document.querySelector('.way--mail .way__desc')); sel.removeAllRanges(); sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyBtn.dataset.copy).then(ok, fallback);
    else fallback();
  });
})();
