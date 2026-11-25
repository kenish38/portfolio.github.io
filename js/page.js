// ===== A página: portfólio, visualizador, loja, contato e o botão do dono =====
// Cada bloco só age se o elemento dele existir na página.
(function () {
  'use strict';
  var root = document.documentElement;

  // ---------- Portfólio: imagens e vídeos de portfolio.json ----------
  // Os trabalhos ficam numa grade; em cima dela, as categorias (as que têm trabalho) filtram o que aparece. Um trabalho pode
  // ter até quatro imagens: no cartão, pontinhos mostram quantas são e, com o mouse por cima, elas passam uma depois da
  // outra; no visualizador, uma tira com as miniaturas leva direto a cada uma, e as setas andam dentro da categoria.
  var list = document.querySelector('.media'), box = document.querySelector('.lightbox');
  if (list && box) portfolio();
  function portfolio() {
    var boxStage = box.querySelector('.lightbox__stage'), boxDesc = box.querySelector('.lightbox__desc'), strip = box.querySelector('.lightbox__strip');
    var boxTitle = box.querySelector('.lightbox__title'), boxCount = box.querySelector('.lightbox__count'), shown = -1;
    var bar = document.querySelector('.cats'), said = document.querySelector('.cats__said');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // as categorias de quando portfolio.json ainda não tem as dele (as mesmas chaves que os trabalhos antigos usam)
    var DEFAULT_CATS = [
      { id: 'map', en: 'Maps', pt: 'Mapas' }, { id: 'model', en: '3D models', pt: 'Modelos 3D' }, { id: 'lighting', en: 'Lighting & VFX', pt: 'Iluminação e VFX' },
      { id: 'script', en: 'Systems & scripts', pt: 'Sistemas e scripts' }, { id: 'ui', en: 'Interfaces', pt: 'Interfaces' }, { id: 'game', en: 'Full games', pt: 'Jogos completos' },
      { id: 'ai', en: 'AI tools', pt: 'Ferramentas de IA' }
    ];
    var items = null, cats = DEFAULT_CATS, filter = 'all', shownItems = [], slides = [];
    function pt() { return document.documentElement.lang === 'pt-BR'; }
    function two(n) { return (n < 10 ? '0' : '') + n; }
    // Vídeo do YouTube: o item guarda o link; daqui sai o código de 11 letras que identifica o vídeo
    function ytId(url) { var m = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/.exec(String(url || '')); return m ? m[1] : ''; }
    function title(item) { return pt() && item.title_pt ? item.title_pt : (item.title || ''); }
    function desc(item) { return pt() && item.desc_pt ? item.desc_pt : (item.desc || ''); }
    function catOf(item) { for (var i = 0; i < cats.length; i++) if (cats[i].id === item.kind) return cats[i]; return null; }
    function catName(c) { return c ? (pt() ? c.pt : c.en) || c.pt || c.en : ''; }
    // descrição da imagem para quem não a vê: "alt" e "alt_pt" em portfolio.json; sem eles, a descrição ou o título
    function alt(item) { return (pt() && item.alt_pt ? item.alt_pt : item.alt) || desc(item) || title(item); }
    // as fotos extras (o painel deixa até três, então são até quatro imagens por trabalho)
    function extras(item) { return Array.isArray(item.more) ? item.more.filter(function (m) { return m && typeof m.src === 'string'; }).slice(0, 3) : []; }
    // a lista de categorias de portfolio.json, só com o que é válido
    function readCats(d) {
      var ok = d && Array.isArray(d.categories) ? d.categories.filter(function (c) { return c && typeof c.id === 'string' && /^[a-z0-9-]{1,32}$/.test(c.id) && (typeof c.pt === 'string' || typeof c.en === 'string'); }) : null;
      return ok && ok.length ? ok.map(function (c) { return { id: c.id, pt: String(c.pt || c.en).slice(0, 40), en: String(c.en || c.pt).slice(0, 40) }; }) : DEFAULT_CATS;
    }
    // Cada foto vira um quadro do visualizador, na ordem: a principal de cada trabalho (dos que estão na grade) e logo
    // depois as fotos extras dele
    function build() {
      slides = [];
      shownItems.forEach(function (item, n) {
        var more = extras(item);
        slides.push({ item: item, n: n, k: 0, of: more.length + 1, media: item });
        more.forEach(function (m, k) { slides.push({ item: item, n: n, k: k + 1, of: more.length + 1, media: { type: 'image', src: m.src } }); });
      });
    }
    function cover(item) { return item.type === 'youtube' && !item.poster ? 'https://i.ytimg.com/vi/' + ytId(item.src) + '/hqdefault.jpg' : item.thumb || item.poster || item.src; }
    // a tira de miniaturas do visualizador: as imagens do trabalho da vez, com a atual marcada
    function fillStrip(sl) {
      strip.textContent = '';
      var many = sl.of > 1;
      strip.hidden = !many; box.classList.toggle('has-strip', many);
      if (!many) return;
      var first = slides.indexOf(sl) - sl.k;
      for (var k = 0; k < sl.of; k++) (function (k) {
        var b = document.createElement('button'), im = document.createElement('img'), src = k ? (extras(sl.item)[k - 1].thumb || extras(sl.item)[k - 1].src) : cover(sl.item);
        b.type = 'button'; b.className = 'lightbox__thumb' + (k === sl.k ? ' is-on' : '');
        b.setAttribute('aria-label', (pt() ? 'Foto ' : 'Photo ') + (k + 1) + (pt() ? ' de ' : ' of ') + sl.of);
        if (k === sl.k) b.setAttribute('aria-current', 'true');
        im.src = src; im.alt = ''; b.appendChild(im);
        b.addEventListener('click', function () { open(first + k); });
        strip.appendChild(b);
      })(k);
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
      if (!reduced && box.open) el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      boxTitle.textContent = title(item);
      boxDesc.textContent = desc(item);
      boxCount.textContent = two(sl.n + 1) + ' / ' + two(shownItems.length) + (sl.of > 1 ? '  ·  ' + (pt() ? 'foto ' : 'photo ') + (sl.k + 1) + '/' + sl.of : '');
      box.classList.toggle('is-single', slides.length < 2);
      fillStrip(sl);
      if (!box.open && box.showModal) box.showModal();
    }
    // Anterior e próximo (botões e setas do teclado), dando a volta no fim da lista
    function step(d) { if (shown >= 0 && slides.length > 1) open((shown + d + slides.length) % slides.length); }
    box.querySelector('.lightbox__prev').addEventListener('click', function () { step(-1); });
    box.querySelector('.lightbox__next').addEventListener('click', function () { step(1); });
    // as setas trocam de quadro, menos quando o foco está no vídeo (lá elas avançam e voltam o próprio vídeo)
    box.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || (e.target.closest && e.target.closest('video, iframe'))) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      step(e.key === 'ArrowLeft' ? -1 : 1);
      if (!box.contains(document.activeElement) || (document.activeElement.closest && document.activeElement.closest('.lightbox__strip'))) box.querySelector(e.key === 'ArrowLeft' ? '.lightbox__prev' : '.lightbox__next').focus();
    });
    function close() { boxStage.textContent = ''; if (box.open) box.close(); }
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.addEventListener('close', function () { boxStage.textContent = ''; strip.textContent = ''; shown = -1; });

    // ---------- As categorias em cima da grade ----------
    function used() { return cats.filter(function (c) { return items.some(function (it) { return it.kind === c.id; }); }); }
    function drawBar() {
      var u = items && items.length ? used() : [];
      bar.textContent = '';
      bar.hidden = u.length < 2;                    // com uma categoria só (ou nenhuma), não há o que filtrar
      if (bar.hidden) return;
      [{ id: 'all', pt: 'Todos', en: 'All', n: items.length }].concat(u.map(function (c) { return { id: c.id, pt: c.pt, en: c.en, n: items.filter(function (it) { return it.kind === c.id; }).length }; })).forEach(function (c) {
        var b = document.createElement('button'), n = document.createElement('span');
        b.type = 'button'; b.className = 'cats__btn'; b.setAttribute('aria-pressed', String(filter === c.id));
        b.textContent = catName(c);
        n.className = 'cats__n'; n.textContent = String(c.n); b.appendChild(n);
        b.addEventListener('click', function () {
          if (filter === c.id) return;
          filter = c.id;
          render(true);
          said.textContent = (pt() ? 'Mostrando ' : 'Showing ') + shownItems.length + (pt() ? (shownItems.length > 1 ? ' trabalhos' : ' trabalho') : (shownItems.length > 1 ? ' pieces' : ' piece')) + (c.id === 'all' ? '' : ': ' + catName(c));
        });
        bar.appendChild(b);
      });
      var on = bar.querySelector('[aria-pressed="true"]');           // no celular a barra rola de lado: a categoria da vez fica à vista
      if (on && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
    }

    // ---------- Os cartões ----------
    // um trabalho com várias imagens: elas ficam empilhadas no cartão; com o mouse por cima, passam uma depois da outra
    function gallery(li, btn, item, more) {
      var pics = [btn.querySelector('img')], dots = document.createElement('span'), at = 0, timer = 0;
      pics[0].classList.add('item__pic', 'is-on');
      more.forEach(function (m) { var im = document.createElement('img'); im.className = 'item__pic'; im.alt = ''; im.dataset.src = m.thumb || m.src; btn.appendChild(im); pics.push(im); });
      dots.className = 'item__dots'; dots.setAttribute('aria-hidden', 'true');
      pics.forEach(function (p, k) { var d = document.createElement('i'); if (!k) d.className = 'is-on'; dots.appendChild(d); });
      li.appendChild(dots);
      function show(k) {
        at = k;
        pics.forEach(function (p, j) { if (j === k && p.dataset.src) { p.src = p.dataset.src; delete p.dataset.src; } p.classList.toggle('is-on', j === k); });
        [].forEach.call(dots.children, function (d, j) { d.className = j === k ? 'is-on' : ''; });
      }
      if (reduced) return;
      li.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        pics.forEach(function (p) { if (p.dataset.src) { p.src = p.dataset.src; delete p.dataset.src; } });   // carrega as outras já no começo
        clearInterval(timer); timer = setInterval(function () { show((at + 1) % pics.length); }, 1100);
      });
      li.addEventListener('pointerleave', function () { clearInterval(timer); show(0); });
    }
    function card(item, i) {
      var li = document.createElement('li'), btn = document.createElement('button'), cap = document.createElement('span'), m;
      var film = item.type === 'video' || item.type === 'youtube', more = extras(item);
      var label = film ? (pt() ? 'Abrir vídeo' : 'Open video') : (pt() ? 'Abrir imagem' : 'Open image');
      li.className = 'item' + (film ? ' item--video' : '') + (more.length ? ' item--multi' : '');
      btn.type = 'button'; btn.className = 'item__open';
      if (item.type === 'video' && !item.poster) { m = document.createElement('video'); m.src = item.src; m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
      else if (item.type === 'youtube' && !item.poster) {      // capa do próprio YouTube: a maior; se o vídeo não tiver essa, a média
        m = document.createElement('img'); m.loading = 'lazy'; m.alt = '';
        m.onerror = function () { m.onerror = null; m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/hqdefault.jpg'; };
        m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/maxresdefault.jpg';
      }
      else { m = document.createElement('img'); m.src = item.thumb || item.poster || item.src; m.loading = 'lazy'; m.alt = ''; }   // thumb: versão leve para a grade (opcional)
      btn.setAttribute('aria-label', label + ': ' + (alt(item) || (i + 1)) + (more.length ? (pt() ? ' (' + (more.length + 1) + ' fotos)' : ' (' + (more.length + 1) + ' photos)') : ''));     // o botão sempre tem nome
      btn.appendChild(m);
      var first = slides.findIndex(function (sl) { return sl.n === i; });
      btn.addEventListener('click', function () { open(first); });
      li.appendChild(btn);
      // no pé do cartão: o nome do trabalho e, embaixo, a categoria
      cap.className = 'item__cap';
      var t = title(item), k = catName(catOf(item));
      if (t) { var tt = document.createElement('span'); tt.className = 'item__title'; tt.textContent = t; cap.appendChild(tt); }
      if (k) { var kk = document.createElement('span'); kk.className = 'item__kind'; kk.textContent = k; cap.appendChild(kk); }
      if (cap.childNodes.length) li.appendChild(cap);
      // quantas fotos o trabalho tem, no canto de cima, e os pontinhos que acompanham a foto da vez
      if (more.length) {
        var c = document.createElement('span'); c.className = 'item__count'; c.setAttribute('aria-hidden', 'true'); c.textContent = (more.length + 1) + (pt() ? ' fotos' : ' photos'); li.appendChild(c);
        if (m.tagName === 'IMG') gallery(li, btn, item, more);
      }
      return li;
    }
    function render(animate) {
      root.classList.toggle('no-work', !items || !items.length);
      if (items && filter !== 'all' && !items.some(function (it) { return it.kind === filter; })) filter = 'all';   // a categoria ficou vazia
      shownItems = !items ? [] : filter === 'all' ? items.slice() : items.filter(function (it) { return it.kind === filter; });
      drawBar();
      list.textContent = '';
      build();
      if (!items || !items.length) return;      // sem itens, fica o estado vazio (.empty)
      shownItems.forEach(function (item, i) {
        var li = card(item, i);
        list.appendChild(li);
        // ao trocar de categoria, os cartões entram um depois do outro
        if (animate && !reduced) li.animate([{ opacity: 0, transform: 'translateY(18px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: Math.min(i, 8) * 45, easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'backwards' });
      });
    }
    render();
    // quem chegou por um link de seção (#about, #contact...) e ainda não mexeu na página volta para a seção depois que os
    // trabalhos aparecem (eles empurram tudo o que vem embaixo)
    var moved = false;
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (n) { window.addEventListener(n, function () { moved = true; }, { once: true, passive: true }); });
    function land() {
      var id = location.hash.slice(1), t = id && /^[\w-]+$/.test(id) && document.getElementById(id);
      if (t && !moved && items && items.length) t.scrollIntoView();
    }
    // no-cache: o navegador confere com o servidor antes de usar a cópia guardada (o dono publica pelo painel e quer ver na hora)
    if (window.fetch) fetch('portfolio.json', { cache: 'no-cache' }).then(function (res) { return res.ok ? res.json() : null; }).then(function (d) {
      items = d && Array.isArray(d.items) ? d.items.filter(function (it) { return it && typeof it.src === 'string'; }) : null;
      cats = readCats(d);
      render(); land();
    }).catch(function () {});
    document.addEventListener('langchange', function () { render(); });
  }

  // ---------- Botão do dono ----------
  // Só aparece no navegador em que o dono já entrou no painel (admin/): o painel deixa ali um sinal ("hr-owner"), que não
  // é a chave e não dá acesso a nada. Para qualquer outro visitante este trecho não faz nada.
  var owner = false; try { owner = localStorage.getItem('hr-owner') === '1' || !!localStorage.getItem('hr-admin-token'); } catch (e) {}
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
  // o rótulo volta sempre ao "Copiar" do idioma da vez (antes, dois cliques seguidos deixavam "Copiado" preso)
  var copyBtn = document.querySelector('.mail__copy'), copyTimer = 0, copyEn = copyBtn && (copyBtn.dataset.en || copyBtn.textContent);
  function copyLabel() { return document.documentElement.lang === 'pt-BR' ? copyBtn.dataset.pt : (copyBtn.dataset.en || copyEn); }
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var pt = document.documentElement.lang === 'pt-BR', done = pt ? copyBtn.dataset.ptDone : copyBtn.dataset.done;
    function ok() {
      clearTimeout(copyTimer);
      copyBtn.textContent = done; copyBtn.classList.add('is-done');
      copyTimer = setTimeout(function () { copyBtn.textContent = copyLabel(); copyBtn.classList.remove('is-done'); }, 1600);
    }
    function fallback() {
      var sel = window.getSelection(), range = document.createRange();
      range.selectNodeContents(document.querySelector('.mail__link')); sel.removeAllRanges(); sel.addRange(range);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(copyBtn.dataset.copy).then(ok, fallback);
    else fallback();
  });
})();
