// ===== A página: portfólio, visualizador, loja, contato e o botão do dono =====
// Cada bloco só age se o elemento dele existir na página.
(function () {
  'use strict';
  var root = document.documentElement;

  // ---------- Portfólio: imagens e vídeos de portfolio.json ----------
  // Os trabalhos ficam numa grade; em cima dela, as categorias (as que têm trabalho) filtram o que aparece, e a troca de
  // uma para outra abre a grade na tela. Um trabalho pode ter até quatro imagens: no cartão, pontinhos mostram quantas são
  // e, com o mouse por cima, elas passam uma depois da outra; no visualizador, uma tira com as miniaturas leva direto a
  // cada uma, e as setas andam dentro da categoria. Cada trabalho tem um link próprio, que abre a página direto nele.
  var list = document.querySelector('.media'), box = document.querySelector('.lightbox');
  if (list && box) portfolio();
  function portfolio() {
    var boxStage = box.querySelector('.lightbox__stage'), boxDesc = box.querySelector('.lightbox__desc'), strip = box.querySelector('.lightbox__strip');
    var boxName = box.querySelector('.lightbox__name'), boxDate = box.querySelector('.lightbox__date'), boxCount = box.querySelector('.lightbox__count'), shown = -1;
    var bar = document.querySelector('.cats'), said = document.querySelector('.cats__said'), gone = document.querySelector('.work__gone');
    var share = box.querySelector('.lightbox__share'), shareText = share && share.querySelector('span'), boxSaid = box.querySelector('.lightbox__said');
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

    // ---------- O link de cada trabalho ----------
    // henriquerocha.dev.br/#<título>-<chave>. A chave é o código único que o painel põe no nome de cada arquivo enviado
    // (o "mwwf0k8c0" de media/1-taverna-capa-mwwf0k8c0.webp) ou o código do vídeo do YouTube; o título vem antes só para o
    // link ser legível. Se o título mudar, o link antigo continua valendo pela chave; se a capa for trocada, pelo título.
    function slugOf(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, ''); }
    function keyOf(item) {
      if (typeof item.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(item.id)) return item.id;     // o painel grava (trocar as imagens não muda)
      if (item.type === 'youtube' && ytId(item.src)) return ytId(item.src);
      var name = item.src.split(/[?#]/)[0].split('/').pop().replace(/\.[^.]+$/, ''), m = /-([0-9a-z]{6,})$/.exec(name);
      if (m) return m[1];
      for (var h = 0, i = 0; i < item.src.length; i++) h = (Math.imul(h, 31) + item.src.charCodeAt(i)) | 0;   // arquivo com outro nome: um código tirado do caminho
      return (h >>> 0).toString(36);
    }
    function linkOf(item) { var s = slugOf(item.title_pt || item.title), k = keyOf(item); return s ? s + '-' + k : k; }
    function findLink(h) {
      if (!items) return null;
      var i, k, a, b;
      for (i = 0; i < items.length; i++) if (linkOf(items[i]) === h) return items[i];
      for (i = 0; i < items.length; i++) { k = keyOf(items[i]); if (h === k || h.slice(-k.length - 1) === '-' + k) return items[i]; }
      for (i = 0; i < items.length; i++) { a = slugOf(items[i].title_pt); b = slugOf(items[i].title); if ((a && h.indexOf(a + '-') === 0) || (b && h.indexOf(b + '-') === 0)) return items[i]; }
      return null;
    }
    // ---------- A data de cada trabalho ----------
    // "date" (AAAA-MM-DD), que o painel grava no envio. Nos trabalhos de antes disso, a data sai do código do arquivo da
    // capa: ele é a hora do envio escrita em base 36 (os 8 primeiros caracteres; ver prepare() em admin/admin.js).
    var MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    var MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function dateOf(item) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.date || '');
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
      if (item.type === 'youtube') return null;
      var k = keyOf(item), t = k.length >= 9 ? parseInt(k.slice(0, 8), 36) : NaN;
      return t > Date.UTC(2024, 0, 1) && t < Date.now() + 864e5 ? new Date(t) : null;
    }
    function iso(d) { return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); }
    function when(item) {
      var d = dateOf(item);
      if (!d) return '';
      return pt() ? d.getDate() + ' ' + MONTHS_PT[d.getMonth()] + ' ' + d.getFullYear() : MONTHS_EN[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    function stamp(el, item) {        // a data num <time>: o texto do idioma da vez e a data certa para o navegador e o Google
      var d = dateOf(item);
      el.textContent = d ? when(item) : ''; el.hidden = !d;
      if (d) el.dateTime = iso(d); else el.removeAttribute('datetime');
    }

    // ---------- Imagem nítida no cartão ----------
    // A grade usa a miniatura (leve), mas o cartão é em pé e recorta a imagem: numa foto larga, a miniatura tem pouca
    // altura, e numa tela de alta densidade (celular, notebook a 125 ou 150%) cada pixel dela vira dois ou três. Reduzir
    // só um pouco também borra (a miniatura antiga da Taverna, 505 px para um cartão de 472, saía uns 20% mais mole que a
    // imagem inteira num PC a 100%). Então a miniatura só fica quando tem folga: pelo menos 1,33 pixel dela para cada
    // pixel da tela. Senão, a imagem inteira é baixada por trás e entra no lugar só depois de pronta (sem piscar).
    var sharpList = [];
    function sharp(im, full) {
      if (!full || full === im.getAttribute('src') && !im.dataset.src) return;
      var item = { im: im, full: full, done: false };
      sharpList.push(item);
      im.addEventListener('load', function () { check(item); });
      if (im.complete && im.naturalWidth) check(item);
    }
    function check(it) {
      var im = it.im;
      if (it.done || !im.naturalWidth || !im.isConnected) return;
      var r = im.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var k = Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight) * (window.devicePixelRatio || 1);   // o recorte (cover)
      // No computador (monitor 4K a 150 ou 200% inclusive), a miniatura só fica com folga; senão entra a imagem inteira. No
      // celular, os pixels são miúdos e a internet pode ser fraca: basta a miniatura não ser esticada demais.
      if (k <= (coarse ? 1.5 : 0.75)) return;
      it.done = true;
      var hi = new Image();
      hi.decoding = 'async'; hi.src = it.full;
      (hi.decode ? hi.decode() : new Promise(function (ok, no) { hi.onload = ok; hi.onerror = no; })).then(function () { if (im.isConnected) im.src = it.full; }, function () {});
    }
    var sharpTimer = 0;
    window.addEventListener('resize', function () {      // girar o celular, mudar o zoom ou a tela: confere de novo
      clearTimeout(sharpTimer);
      sharpTimer = setTimeout(function () { sharpList = sharpList.filter(function (it) { return it.im.isConnected; }); sharpList.forEach(check); }, 250);
    });

    function hashNow() { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; } }
    function isSection(h) { return /^[\w-]+$/.test(h) && !!document.getElementById(h); }
    // com um trabalho aberto, o endereço da barra é o link dele (dá para copiar de lá também); ao fechar, volta ao normal
    function mark(item) { try { history.replaceState(history.state, '', location.pathname + location.search + '#' + linkOf(item)); } catch (e) {} }
    function unmark() { var h = hashNow(); if (h && !isSection(h)) try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {} }
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
      boxName.textContent = title(item); stamp(boxDate, item);
      boxDesc.textContent = desc(item);
      boxCount.textContent = two(sl.n + 1) + ' / ' + two(shownItems.length) + (sl.of > 1 ? '  ·  ' + (pt() ? 'foto ' : 'photo ') + (sl.k + 1) + '/' + sl.of : '');
      box.classList.toggle('is-single', slides.length < 2);
      fillStrip(sl);
      resetShare(); mark(item);
      if (gone) gone.hidden = true;
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
    box.addEventListener('close', function () { boxStage.textContent = ''; strip.textContent = ''; shown = -1; resetShare(); unmark(); });

    // Compartilhar: no celular (e tablet), a folha de compartilhar do sistema (WhatsApp, Discord...); no computador, copia
    // o link e o botão mostra "Link copiado". O link vai sem o ?lang: quem recebe abre em inglês, como todo mundo, e troca para PT se quiser.
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches, shareTimer = 0, shareEn = shareText && (shareText.dataset.en || shareText.textContent);
    function resetShare() {
      if (!share) return;
      clearTimeout(shareTimer); share.classList.remove('is-done');
      shareText.textContent = pt() ? shareText.dataset.pt : shareEn;
    }
    if (share) share.addEventListener('click', function () {
      if (shown < 0) return;
      // o link da página de prévia do trabalho (w/<id>, ver admin/share.js): no Discord e no WhatsApp ele vira o cartão com a
      // foto e o nome; quem abre vai para o trabalho aberto no site
      var item = slides[shown].item, url = location.origin + '/w/' + keyOf(item), name = title(item);
      function done() {
        clearTimeout(shareTimer);
        share.classList.add('is-done'); shareText.textContent = pt() ? share.dataset.ptDone : share.dataset.done;
        boxSaid.textContent = shareText.textContent;
        shareTimer = setTimeout(resetShare, 1800);
      }
      function legacy() {         // navegador sem a área de transferência moderna: copia por um campo escondido
        var t = document.createElement('textarea'), ok = false;
        t.value = url; t.readOnly = true; t.className = 'visually-hidden'; box.appendChild(t); t.select();
        try { ok = document.execCommand('copy'); } catch (e) {}
        t.remove(); share.focus();
        if (ok) done(); else boxSaid.textContent = url;
      }
      function copy() { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, legacy); else legacy(); }
      if (coarse && navigator.share) navigator.share({ title: (name ? name + ' · ' : '') + 'Henrique Rocha', url: url }).catch(function (e) { if (!e || e.name !== 'AbortError') copy(); });
      else copy();
    });

    // ---------- As categorias em cima da grade ----------
    function used() { return cats.filter(function (c) { return items.some(function (it) { return it.kind === c.id; }); }); }
    var barSig = '';
    function drawBar() {
      var u = items && items.length ? used() : [];
      bar.hidden = u.length < 2;                    // com uma categoria só (ou nenhuma), não há o que filtrar
      if (bar.hidden) { bar.textContent = ''; barSig = ''; return; }
      var all = [{ id: 'all', pt: 'Todos', en: 'All', n: items.length }].concat(u.map(function (c) { return { id: c.id, pt: c.pt, en: c.en, n: items.filter(function (it) { return it.kind === c.id; }).length }; }));
      // as categorias só são refeitas quando mudam (outra lista, outro idioma); trocar de categoria só acende outra, então
      // o foco do teclado fica onde estava e a luz passa de uma pílula para a outra
      var sig = all.map(function (c) { return c.id + ':' + c.n + ':' + catName(c); }).join('|');
      if (sig !== barSig) {
        barSig = sig; bar.textContent = '';
        all.forEach(function (c) {
          var b = document.createElement('button'), n = document.createElement('span');
          b.type = 'button'; b.className = 'cats__btn'; b.dataset.id = c.id;
          b.textContent = catName(c);
          n.className = 'cats__n'; n.textContent = String(c.n); b.appendChild(n);
          b.addEventListener('click', function () { choose(c, b); });
          bar.appendChild(b);
        });
      }
      [].forEach.call(bar.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.id === filter)); });
      var on = bar.querySelector('[aria-pressed="true"]');           // no celular a barra rola de lado: a categoria da vez fica à vista
      if (on && bar.scrollWidth > bar.clientWidth) {
        var x = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
        if (bar.scrollTo && !reduced) bar.scrollTo({ left: x, behavior: 'smooth' }); else bar.scrollLeft = x;
      }
    }
    function choose(c, b) {
      if (filter === c.id) return;
      filter = c.id;
      if (gone) gone.hidden = true;
      drawBar();                                    // a categoria acende na hora; a grade troca em seguida
      function tell() { said.textContent = (pt() ? 'Mostrando ' : 'Showing ') + shownItems.length + (pt() ? (shownItems.length > 1 ? ' trabalhos' : ' trabalho') : (shownItems.length > 1 ? ' pieces' : ' piece')) + (c.id === 'all' ? '' : ': ' + catName(c)); }
      if (reduced || !list.animate || !seam || !list.children.length) { stopSwap(); render(); tell(); return; }
      openUp(b, tell);
    }

    // ---------- A troca de categoria: a grade se abre na tela ----------
    // A grade de agora some e uma linha de luz se desenha a partir da categoria clicada, na altura do meio do que está na
    // tela. Ela se abre em duas, uma subindo e outra descendo, e o que fica entre elas já é a categoria nova: os cartões
    // chegam de perto da linha para o lugar deles, primeiro os mais próximos. A altura da grade desliza da antiga para a
    // nova (o que vem embaixo não pula), e o recorte acompanha as duas linhas certinho porque tudo usa a mesma curva.
    // Nada fica preso no fim: cada animação termina sem segurar o valor final. Quem pediu menos movimento só vê a troca.
    var seam = document.querySelector('.seam'), swap = null, OUT_MS = 170, OPEN_MS = 760;
    function stopSwap() {
      if (!swap) return;
      clearTimeout(swap.timer); clearTimeout(swap.end);
      swap.anims.forEach(function (a) { a.cancel(); });
      seam.hidden = true; swap = null;
    }
    function openUp(from, after) {
      stopSwap();
      var r = list.getBoundingClientRect(), oldH = list.offsetHeight;
      var top = Math.max(0, -r.top), bot = Math.min(oldH, window.innerHeight - r.top);
      var cy = Math.round(Math.max(0, Math.min(oldH, bot > top ? (top + bot) / 2 : oldH / 2)));
      var fr = from.getBoundingClientRect(), ox = Math.max(0, Math.min(1, (fr.left + fr.width / 2 - r.left) / (r.width || 1)));
      var lines = [seam.children[0], seam.children[1]], s = swap = { anims: [], timer: 0, end: 0 };
      seam.style.left = list.offsetLeft + 'px'; seam.style.top = list.offsetTop + 'px'; seam.style.width = list.offsetWidth + 'px';
      seam.hidden = false;
      // 1. a grade de agora some; a linha nasce no x da categoria clicada e se estica para os lados
      s.anims.push(list.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT_MS, easing: 'ease-in', fill: 'forwards' }));
      lines.forEach(function (l) {
        l.style.transformOrigin = (ox * 100).toFixed(1) + '% 50%';
        s.anims.push(l.animate([{ transform: 'translateY(' + cy + 'px) scaleX(0)', opacity: 0 }, { transform: 'translateY(' + cy + 'px) scaleX(1)', opacity: 1 }], { duration: OUT_MS + 60, easing: 'cubic-bezier(.3, .7, .2, 1)', fill: 'forwards' }));
      });
      s.timer = setTimeout(function () {
        if (swap !== s) return;
        // 2. a categoria nova entra fechada na linha e se abre
        render(); after();
        var newH = list.offsetHeight, E = 'cubic-bezier(.7, 0, .2, 1)', base = list.offsetTop;
        s.anims.forEach(function (a) { a.cancel(); }); s.anims = [];
        s.anims.push(list.animate([
          { height: oldH + 'px', clipPath: 'inset(' + cy + 'px -80px ' + (oldH - cy) + 'px -80px)' },
          { height: newH + 'px', clipPath: 'inset(0px -80px 0px -80px)' }
        ], { duration: OPEN_MS, easing: E }));
        [[lines[0], 0], [lines[1], newH]].forEach(function (p) {
          s.anims.push(p[0].animate([
            { transform: 'translateY(' + cy + 'px)', opacity: 1 },
            { opacity: 1, offset: 0.62 },
            { transform: 'translateY(' + p[1] + 'px)', opacity: 0 }
          ], { duration: OPEN_MS, easing: E }));
        });
        [].forEach.call(list.children, function (li) {
          var d = li.offsetTop - base + li.offsetHeight / 2 - cy;
          s.anims.push(li.animate([{ transform: 'translateY(' + (d < 0 ? 16 : -16) + 'px) scale(.965)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 640, delay: Math.min(240, Math.abs(d) * 0.3), easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'backwards' }));
        });
        s.end = setTimeout(function () { if (swap === s) { seam.hidden = true; swap = null; } }, OPEN_MS + 300);
      }, OUT_MS);
    }

    // ---------- Os cartões ----------
    // um trabalho com várias imagens: elas ficam empilhadas no cartão; com o mouse por cima, passam uma depois da outra
    function gallery(li, btn, item, more) {
      var pics = [btn.querySelector('img')], dots = document.createElement('span'), at = 0, timer = 0;
      pics[0].classList.add('item__pic', 'is-on');
      more.forEach(function (m) { var im = document.createElement('img'); im.className = 'item__pic'; im.alt = ''; im.dataset.src = m.thumb || m.src; if (m.thumb) sharp(im, m.src); btn.appendChild(im); pics.push(im); });
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
      else {        // thumb: versão leve para a grade (opcional); numa foto, a imagem inteira entra no lugar quando a tela pede (sharp)
        m = document.createElement('img'); m.loading = 'lazy'; m.alt = '';
        if (item.type === 'image' && item.thumb) sharp(m, item.src);
        m.src = item.thumb || item.poster || item.src;
      }
      btn.setAttribute('aria-label', label + ': ' + (alt(item) || (i + 1)) + (more.length ? (pt() ? ' (' + (more.length + 1) + ' fotos)' : ' (' + (more.length + 1) + ' photos)') : ''));     // o botão sempre tem nome
      btn.appendChild(m);
      var first = slides.findIndex(function (sl) { return sl.n === i; });
      btn.addEventListener('click', function () { open(first); });
      li.appendChild(btn);
      // no pé do cartão: o nome do trabalho e, embaixo, a categoria e a data do envio
      cap.className = 'item__cap';
      var t = title(item), k = catName(catOf(item));
      if (t) { var tt = document.createElement('span'); tt.className = 'item__title'; tt.textContent = t; cap.appendChild(tt); }
      var meta = document.createElement('span'), day = document.createElement('time');
      meta.className = 'item__meta';
      if (k) { var kk = document.createElement('span'); kk.className = 'item__kind'; kk.textContent = k; meta.appendChild(kk); }
      day.className = 'item__date'; stamp(day, item); if (!day.hidden) meta.appendChild(day);
      if (meta.childNodes.length) cap.appendChild(meta);
      if (cap.childNodes.length) li.appendChild(cap);
      // quantas fotos o trabalho tem, no canto de cima, e os pontinhos que acompanham a foto da vez
      if (more.length) {
        var c = document.createElement('span'); c.className = 'item__count'; c.setAttribute('aria-hidden', 'true'); c.textContent = (more.length + 1) + (pt() ? ' fotos' : ' photos'); li.appendChild(c);
        if (m.tagName === 'IMG') gallery(li, btn, item, more);
      }
      return li;
    }
    function render() {
      root.classList.toggle('no-work', !items || !items.length);
      if (items && filter !== 'all' && !items.some(function (it) { return it.kind === filter; })) filter = 'all';   // a categoria ficou vazia
      shownItems = !items ? [] : filter === 'all' ? items.slice() : items.filter(function (it) { return it.kind === filter; });
      drawBar();
      list.textContent = ''; sharpList = [];
      build();
      if (!items || !items.length) return;      // sem itens, fica o estado vazio (.empty)
      shownItems.forEach(function (item, i) { list.appendChild(card(item, i)); });
    }
    render();
    // Quem chegou pelo link de um trabalho cai direto nele, aberto no visualizador, com a grade de trabalhos atrás (ao
    // fechar, está nela). O "#" no link também pula a apresentação de abertura (ver o script no <head> do index.html).
    // Se o trabalho saiu do portfólio, a página vai para a grade com um aviso.
    function fromLink() {
      var h = hashNow(), sec = document.getElementById('work');
      if (!h || isSection(h) || !items || !items.length) return false;      // sem link, ou link de seção (#about...): como antes
      var item = findLink(h);
      stopSwap();
      if (filter !== 'all') { filter = 'all'; render(); }
      if (sec) sec.scrollIntoView();
      if (!item) { if (box.open) box.close(); if (gone) gone.hidden = false; unmark(); return true; }
      // com o visualizador já aberto (outro link colado), só troca o que ele mostra: fechar e reabrir apagaria o novo
      for (var s = 0; s < slides.length; s++) if (slides[s].item === item && !slides[s].k) { open(s); break; }
      return true;
    }
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
      render();
      if (!fromLink()) land();
    }).catch(function () {});
    // um link de trabalho colado na barra com a página já aberta também abre o trabalho
    window.addEventListener('hashchange', function () { fromLink(); });
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
