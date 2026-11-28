// ===== A página: portfólio, visualizador, loja, contato e o botão do dono =====
// Cada bloco só age se o elemento dele existir na página.
(function () {
  'use strict';
  var root = document.documentElement;

  // ---------- Portfólio: imagens e vídeos de portfolio.json ----------
  // Os trabalhos ficam agrupados por área: um cartão por área (Environments, 3D...), cada um com o nome na cor dela e até
  // quatro fotos daquela área à vista. Um trabalho pode ter até quatro imagens: no visualizador, uma tira com as miniaturas leva
  // direto a cada uma, e as setas andam pelos trabalhos da área. Cada trabalho tem um link próprio, que abre a página
  // direto nele.
  var list = document.querySelector('.media'), box = document.querySelector('.lightbox');
  if (list && box) portfolio();
  function portfolio() {
    var boxStage = box.querySelector('.lightbox__stage'), boxDesc = box.querySelector('.lightbox__desc'), strip = box.querySelector('.lightbox__strip');
    var boxName = box.querySelector('.lightbox__name'), boxDate = box.querySelector('.lightbox__date'), boxCount = box.querySelector('.lightbox__count'), shown = -1;
    var gone = document.querySelector('.work__gone');
    var share = box.querySelector('.lightbox__share'), shareText = share && share.querySelector('span'), boxSaid = box.querySelector('.lightbox__said');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // as categorias de quando portfolio.json ainda não tem as dele (as mesmas chaves que os trabalhos antigos usam)
    var DEFAULT_CATS = [
      { id: 'map', en: 'Environments', pt: 'Environments' }, { id: 'model', en: '3D', pt: '3D' }, { id: 'texture', en: 'Textures', pt: 'Textures' }, { id: 'lighting', en: 'VFX', pt: 'VFX' },
      { id: 'script', en: 'Systems', pt: 'Systems' }, { id: 'ui', en: 'UI/UX', pt: 'UI/UX' }, { id: 'design', en: 'Design', pt: 'Design' }, { id: 'gfx', en: 'GFX', pt: 'GFX' },
      { id: 'game', en: 'Experiences', pt: 'Experiences' }, { id: 'ai', en: 'AI Engineering', pt: 'AI Engineering' }
    ];
    var items = null, cats = DEFAULT_CATS, shownItems = [], slides = [];
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
    // "media/x.webp" vira "/media/x.webp" (um endereço completo ou que já começa na raiz fica como está)
    function rooted(p) { return typeof p === 'string' && p && !/^([a-z][a-z0-9+.-]*:|\/)/i.test(p) ? '/' + p : p; }
    function fromRoot(it) {
      ['src', 'thumb', 'poster'].forEach(function (k) { if (typeof it[k] === 'string') it[k] = rooted(it[k]); });
      if (Array.isArray(it.more)) it.more.forEach(function (m) { if (m && typeof m === 'object') { m.src = rooted(m.src); if (m.thumb) m.thumb = rooted(m.thumb); } });
      return it;
    }
    function keyOf(item) {
      if (typeof item.id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(item.id)) return item.id;     // o painel grava (trocar as imagens não muda)
      if (item.type === 'youtube' && ytId(item.src)) return ytId(item.src);
      var name = item.src.split(/[?#]/)[0].split('/').pop().replace(/\.[^.]+$/, ''), m = /-([0-9a-z]{6,})$/.exec(name);
      if (m) return m[1];
      var path = item.src.replace(/^\//, '');
      for (var h = 0, i = 0; i < path.length; i++) h = (Math.imul(h, 31) + path.charCodeAt(i)) | 0;   // arquivo com outro nome: um código tirado do caminho (como está em portfolio.json)
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
    // o: o registro do original (orig), para a conta de preferFull; onFull: avisa quando a imagem inteira entrou
    function sharp(im, full, o, onFull) {
      if (!full || full === im.getAttribute('src') && !im.dataset.src) return;
      var item = { im: im, full: full, o: o, onFull: onFull, done: false };
      sharpList.push(item);
      im.addEventListener('load', function () { check(item); });
      if (im.complete && im.naturalWidth) check(item);
    }
    function check(it) {
      var im = it.im;
      if (it.done || !im.naturalWidth || !im.isConnected) return;
      var r = im.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // o recorte (cover), em pixels da tela; ampliada com pinça, a página precisa de mais pixels (ver js/pixels.js)
      var k = Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight) * (window.devicePixelRatio || 1) * (window.HRPixels ? HRPixels.pinch() : 1);
      // No computador (monitor 4K a 150 ou 200% inclusive), a miniatura só fica com folga; senão entra a imagem inteira. No
      // celular, os pixels são miúdos e a internet pode ser fraca: basta a miniatura não ser esticada demais.
      if (k <= (coarse ? 1.5 : 0.75)) return;
      it.done = true;
      var hi = new Image();
      hi.decoding = 'async'; hi.src = it.full;
      (hi.decode ? hi.decode() : new Promise(function (ok, no) { hi.onload = ok; hi.onerror = no; })).then(function () { if (im.isConnected) im.src = it.full; if (it.onFull) it.onFull(); }, function () {});
    }
    var sharpTimer = 0;
    function recheck() {      // girar o celular, mudar o zoom (também o de pinça) ou a tela: confere de novo
      clearTimeout(sharpTimer);
      sharpTimer = setTimeout(function () { sharpList = sharpList.filter(function (it) { return it.im.isConnected; }); sharpList.forEach(check); }, 250);
    }
    window.addEventListener('resize', recheck);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', recheck);

    // ---------- A imagem inteira de cara, quando a miniatura não bastaria ----------
    // A conta de check() pode ser feita antes de baixar a miniatura: o tamanho dela sai do registro do original (orig), do
    // jeito que o painel faz (THUMB_SHORT e THUMB_LONG, em admin/admin.js: 900 px no lado menor, até 2000 no maior). Numa
    // tela de alta densidade (notebook retina, monitor a 150 ou 200%), quando a conta já diz que a miniatura ficaria
    // esticada, a capa começa pela imagem inteira: no fim, a mesma imagem de sempre, sem baixar e abrir as duas (na capa
    // do barco e na da taverna, 1,1 e 1,4 MB a menos). O reflexo no verso da dobra é a mesma imagem. A foto de baixo
    // continua a miniatura (é só o canto, e a virada troca a capa por ela na hora); nas viradas, a foto cuja imagem
    // inteira já entrou volta inteira (ready, em turn), sem baixar a miniatura dela. Roda logo depois de os cartões
    // entrarem na página (render), antes de o navegador começar a baixar as miniaturas.
    function thumbSize(o) {
      if (!o || !(o.w > 0) || !(o.h > 0)) return null;
      var f = Math.min(1, 900 / Math.min(o.w, o.h), 2000 / Math.max(o.w, o.h));
      return [o.w * f, o.h * f];
    }
    function preferFull() {
      var px = (window.devicePixelRatio || 1) * (window.HRPixels ? HRPixels.pinch() : 1), most = coarse ? 1.5 : 0.75;
      sharpList.filter(function (it) {                  // primeiro todas as medidas, depois as trocas
        var d = thumbSize(it.o), im = it.im, r;
        if (it.done || !d || im.naturalWidth || !im.isConnected) return false;
        r = im.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && Math.max(r.width / d[0], r.height / d[1]) * px > most;
      }).forEach(function (it) {
        it.done = true; it.im.src = it.full;
        if (it.im.hrMirror) it.im.hrMirror.src = it.full;
        if (it.onFull) it.im.addEventListener('load', function () { it.onFull(); }, { once: true });
      });
    }

    function hashNow() { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; } }
    function isSection(h) { return /^[\w-]+$/.test(h) && !!document.getElementById(h); }
    // Com um trabalho aberto, o endereço da barra é o link de prévia dele (/w/<id>, o mesmo do Compartilhar): quem copia
    // de lá e cola no Discord ou no WhatsApp vê o cartão com a foto do trabalho. Um link com "#" não daria: o que vem depois
    // do "#" não chega ao servidor, e a prévia sairia a da página inicial. Ao fechar, volta o endereço de antes (com o ?lang
    // e o #seção, se havia). Por isso os caminhos dos arquivos começam na raiz do site (ver rooted).
    var before = null;
    function onWork() { return /^\/w\/[\w-]+\/?$/.test(location.pathname); }
    function mark(item) {
      try {
        if (!onWork()) { var h = hashNow(); before = location.pathname + location.search + (h && isSection(h) ? '#' + h : ''); }
        history.replaceState(history.state, '', '/w/' + keyOf(item));
      } catch (e) {}
    }
    function unmark() {
      try {
        if (onWork()) history.replaceState(history.state, '', before || '/');
        else { var h = hashNow(); if (h && !isSection(h)) history.replaceState(history.state, '', location.pathname + location.search); }
      } catch (e) {}
    }
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
        else {
          el.alt = alt(item) + (sl.of > 1 ? ' (' + (sl.k + 1) + '/' + sl.of + ')' : '');
          // No computador, a imagem nunca é esticada além do tamanho real dela: cada pixel da imagem num pixel da tela (numa
          // tela 4K a 150%, uma imagem de 2560 px ocupa 2560 pixels da tela, e não 3840, esticada e mole). Maior que a
          // tela, ela encolhe para caber, como antes. Para ver maior, o zoom (js/zoom.js). No celular fica como era: os
          // pixels são miúdos, e uma imagem pequena ficaria minúscula.
          if (!coarse) (function (im) {
            function natural() {
              var d = window.devicePixelRatio || 1;
              if (im.naturalWidth) { im.style.setProperty('--nat-w', (im.naturalWidth / d) + 'px'); im.style.setProperty('--nat-h', (im.naturalHeight / d) + 'px'); }
            }
            im.addEventListener('load', natural); if (im.complete) natural();
          })(el);
        }
      }
      boxStage.appendChild(el);
      if (!reduced && box.open) el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      boxName.textContent = title(item); stamp(boxDate, item);
      boxDesc.textContent = desc(item);
      // o número do trabalho dentro da área (só quando ela tem mais de um) e o da foto dentro do trabalho
      var where = [];
      if (shownItems.length > 1) where.push(two(sl.n + 1) + ' / ' + two(shownItems.length));
      if (sl.of > 1) where.push((pt() ? 'foto ' : 'photo ') + (sl.k + 1) + '/' + sl.of);
      boxCount.textContent = where.join('  ·  ');
      box.classList.toggle('is-single', slides.length < 2);
      fillStrip(sl);
      resetShare(); mark(item);
      if (gone) gone.hidden = true;
      if (!box.open && box.showModal) { box.showModal(); root.classList.add('is-viewing'); }     // trava a página de trás (site.css)
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
    box.addEventListener('close', function () { root.classList.remove('is-viewing'); boxStage.textContent = ''; strip.textContent = ''; shown = -1; resetShare(); unmark(); });

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

    // ---------- As áreas ----------
    // Os trabalhos ficam agrupados por área (Environments, 3D, VFX...): um cartão por área, no tom do fundo, com o nome na
    // cor dela, a contagem e até quatro fotos daquela área à vista (a capa do trabalho mais novo, grande, e as outras menores). A
    // área entra na ordem do trabalho mais novo dela (portfolio.json já vem do mais novo para o mais velho). Um trabalho
    // de uma categoria que não está na lista fica numa área "Outros trabalhos".
    // A cor de cada área: a do nome dela, do brilho em volta, do fogo e do pó (o cartão é escuro, como o resto do site).
    // Cada área tem um tom com sentido (Environments verde-jade, 3D ciano, Textures violeta, VFX magenta, Systems lima,
    // UI/UX azul, Design rosa, GFX laranja, Experiences coral e AI Engineering dourado), e a paleta foi calculada para
    // nenhuma ser parecida com outra: qualquer par fica a pelo menos 15 de distância (no espaço OKLab, x100; abaixo disso
    // duas cores vizinhas começam a se confundir), com claridade entre 0,70 e 0,89 e força parecida (nenhuma grita mais),
    // e todas com contraste de 6:1 a 13:1 no cartão. Para quem não distingue vermelho e verde, o par mais próximo ainda fica
    // a 7, e o nome escrito em cada cartão resolve o resto. Uma área nova, criada pelo painel, pega uma das de reserva (as
    // mais longe das dez). Antes, todas tinham a mesma claridade e quase a mesma força, e os pares vizinhos ficavam a 6 ou 7
    // (GFX e 3D, Design e Experiences quase iguais).
    var HUES = {
      map: '#74c99b', model: '#2bf8fd', texture: '#9c8afe', lighting: '#e861d2', script: '#b1e203',
      ui: '#48c0ff', design: '#ffaacb', gfx: '#f9950a', game: '#ff616e', ai: '#ffd486'
    };
    var SPARE = ['#e196ff', '#2ff39d', '#c1b938'];
    var OTHER = { id: '_other', pt: 'Outros trabalhos', en: 'Other work' };
    function hueOf(id) {
      if (id === OTHER.id) return '#f3f2ef';
      if (HUES[id]) return HUES[id];
      for (var h = 0, i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
      return SPARE[(h >>> 0) % SPARE.length];
    }
    function rgbOf(hex) { var n = parseInt(hex.slice(1), 16); return (n >> 16) + ' ' + ((n >> 8) & 255) + ' ' + (n & 255); }
    function groups() {
      var by = {}, order = [];
      (items || []).forEach(function (it) {
        var c = catOf(it) || OTHER;
        if (!by[c.id]) { by[c.id] = { cat: c, works: [] }; order.push(by[c.id]); }
        by[c.id].works.push(it);
      });
      return order;
    }
    function groupOf(item) { var c = catOf(item) || OTHER; return groups().filter(function (g) { return g.cat.id === c.id; })[0]; }
    // o visualizador anda dentro da área aberta: os trabalhos dela, cada um com as fotos dele
    function setGroup(g) { shownItems = g ? g.works.slice() : []; build(); }
    // o que o cartão mostra: a capa de cada trabalho da área, do mais novo para o mais velho (as fotos extras de cada
    // trabalho ficam para o visualizador); e quantas fotos a área tem ao todo, para a contagem
    function coversOf(g) { return g.works.map(function (it) { return { item: it, k: 0 }; }); }
    function photoCount(g) { return g.works.reduce(function (n, it) { return n + 1 + extras(it).length; }, 0); }

    // ---------- Os cartões: as áreas e os trabalhos de uma área ----------
    // Duas vistas na mesma grade. Nas áreas, um cartão por área, com as capas dos 4 trabalhos mais novos dela; o cartão
    // inteiro é um botão que abre a área. Aberta uma área, um cartão por trabalho dela, e em cima a barra com o Voltar e o
    // nome da área; um toque no cartão abre o visualizador, e as setas andam pelos trabalhos da área. Abrir uma área ou
    // voltar põe fogo em todos os cartões, na cor da área, e eles viram pó; os novos se formam do pó (js/fx.js e
    // js/ash.js). Quem pediu menos movimento vê só a troca.
    var SHOW = 4;                     // trabalhos à vista por cartão de área: os 4 mais novos (o maior em cima)
    var view = null;                  // a área aberta (a chave dela), ou null nas áreas
    var bar = null, barBack = null, barName = null, barSaid = null, swapping = false;
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
    function countText(g) {
      var total = photoCount(g);
      return pt() ? plural(g.works.length, 'trabalho', 'trabalhos') + ' · ' + plural(total, 'foto', 'fotos')
        : plural(g.works.length, 'piece', 'pieces') + ' · ' + plural(total, 'photo', 'photos');
    }
    function tintOf(hex) { var n = parseInt(hex.slice(1), 16); return (n >> 16) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255); }

    // ---------- A dobra que vira sozinha ----------
    // A cada 6,5 segundos, todas as capas de trabalho com mais fotos viram juntas, num relógio só: a dobra atravessa a capa
    // até o outro canto, a foto de baixo se ajeita no lugar e vira a nova capa, e uma dobra nova se forma mostrando a
    // seguinte; depois da última, volta para a primeira. O relógio recomeça a cada vista nova (os cartões que acabaram de
    // se formar esperam 6,5 s, e depois viram com os outros). Uma capa fora da tela, com o mouse por cima ou ainda se
    // abrindo pula a vez e vira na próxima, junto com as outras; com a aba escondida, nenhuma vira. Quem pediu menos
    // movimento não vê (e sem @property, que é o que deixa a dobra deslizar, também não).
    var TURN = 6500;                  // ms entre uma virada e a seguinte
    var canTurn = !reduced && Element.prototype.animate && window.CSS && 'registerProperty' in CSS;
    var turners = [], turnClock = 0, turnSeen = canTurn && window.IntersectionObserver ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.hrSeen = e.isIntersecting; });
    }, { threshold: 0.35 }) : null;
    function startTurns() {
      clearTimeout(turnClock);
      if (!canTurn) return;
      var t0 = performance.now();
      (function next() {                // a próxima marca de 6,5 s a partir do começo (uma aba que ficou escondida não acumula viradas)
        var now = performance.now(), k = Math.floor((now - t0) / TURN) + 1;
        turnClock = setTimeout(function () { if (!document.hidden) turners.slice().forEach(turn); next(); }, t0 + k * TURN - now);
      })();
    }
    function turn(t) {
      var li = t.el.closest('li');
      if (t.busy || !t.el.isConnected || (turnSeen && !t.el.hrSeen) || t.el.matches(':hover') || (li && li.matches(':hover'))) return;
      // a capa ainda chegando, ou a dobra ainda se abrindo (ao chegar na tela, ou com o mouse que acabou de sair)
      if (t.el.getAnimations && (t.el.getAnimations().length || t.sheet.getAnimations().length)) return;
      var r = t.el.getBoundingClientRect(), rest = parseFloat(getComputedStyle(t.sheet).getPropertyValue('--fold')) || 30;
      if (!r.width) return;
      t.busy = true;
      // primeiro a ponta é puxada um pouco (como os dedos pegando a foto), depois a folha vira de uma vez, devagar no
      // começo e no fim; a foto de baixo já está no lugar, e aparece inteira
      var a = t.sheet.animate([
        { '--fold': rest + 'px', easing: 'cubic-bezier(.4, 0, .5, 1)' },
        { '--fold': rest * 1.6 + 'px', offset: 0.2, easing: 'cubic-bezier(.55, 0, .25, 1)' },
        { '--fold': (r.width + r.height + 8) + 'px' }
      ], { duration: 1150, fill: 'forwards' });
      a.finished.then(function () {
        if (!t.el.isConnected) return;
        var n = t.pics.length; t.i = (t.i + 1) % n;
        var now = t.pics[t.i], nxt = t.pics[(t.i + 1) % n];
        var pick = function (p) { return p.ready && p.f ? p.f : p.t; };   // a imagem inteira, se ela já entrou (sharp, preferFull)
        t.cover.src = pick(now); t.el.dataset.k = String(t.i);
        (t.cover.decode ? t.cover.decode().catch(function () {}) : Promise.resolve()).then(function () {
          t.busy = false;
          if (!t.el.isConnected) return;
          t.under.src = pick(nxt); if (t.mirror) t.mirror.src = pick(now);
          a.cancel();                                                     // a folha nova (a foto de baixo) volta inteira...
          t.sheet.animate([                                               // ...e dobra de novo, passando um pouco e assentando
            { '--fold': '0px', easing: 'cubic-bezier(.25, .7, .35, 1)' },
            { '--fold': rest * 1.2 + 'px', offset: 0.62, easing: 'cubic-bezier(.45, 0, .55, 1)' },
            { '--fold': rest + 'px' }
          ], { duration: 820 });
          if (t.cap) t.cap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
          if (now.f && !now.ready) sharp(t.cover, now.f, null, function () { now.ready = true; });
        });
      }, function () { t.busy = false; });
    }

    // uma capa (a "folha"): a foto do trabalho, o nome e a data na grande, a dobra quando ele tem mais fotos; live: é um
    // botão que abre o visualizador (nos cartões de trabalho); nos de área, quem recebe o toque é o cartão inteiro
    function tile(g, p, main, more, live) {
      var item = p.item, b = document.createElement(live ? 'button' : 'span'), m;
      var film = !p.k && (item.type === 'video' || item.type === 'youtube');
      b.className = 'acard__tile' + (main ? ' acard__tile--main' : '') + (film ? ' acard__tile--video' : '');
      if (film && item.type === 'video' && !item.poster) { m = document.createElement('video'); m.src = item.src; m.muted = true; m.playsInline = true; m.preload = 'metadata'; }
      else if (film && item.type === 'youtube' && !item.poster) {      // capa do próprio YouTube: a maior; se o vídeo não tiver essa, a média
        m = document.createElement('img'); m.loading = 'lazy'; m.alt = '';
        m.onerror = function () { m.onerror = null; m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/hqdefault.jpg'; };
        m.src = 'https://i.ytimg.com/vi/' + ytId(item.src) + '/maxresdefault.jpg';
      } else {        // a miniatura (leve); numa foto, a imagem inteira entra no lugar quando a tela pede (sharp)
        m = document.createElement('img'); m.loading = 'lazy'; m.alt = '';
        if (item.type === 'image' && item.thumb) sharp(m, item.src, item.orig, function () { if (m.hrTurn) m.hrTurn.pics[0].ready = true; });
        m.src = cover(item);
      }
      // A capa fica numa "folha" (.acard__page). Num trabalho com mais fotos, a folha tem o canto de baixo dobrado: o verso
      // (.acard__flap) por cima e, no lugar do canto, o mesmo canto da próxima foto do trabalho (.acard__under), por baixo.
      var page = document.createElement('span'), more1 = extras(item), next = !film ? more1[0] : null, under = null, cap = null, mirror = null, sheet = b;
      page.className = 'acard__page';
      if (next) {
        // Tudo da dobra fica numa camada por dentro da capa (.acard__sheet), que leva o tamanho dela (--fold): medido na
        // própria capa, o 13cqi do CSS media a janela, e não a capa (ver .acard__sheet no CSS)
        sheet = document.createElement('span'); sheet.className = 'acard__sheet';
        // a foto de baixo fica numa moldura recortada só no canto da dobra (sem ela, na borda de baixo da capa, onde a
        // folha não fecha o pixel inteiro, aparecia um fio de 1 pixel da foto de baixo)
        var below = document.createElement('span');
        b.classList.add('has-more'); below.className = 'acard__below';
        under = document.createElement('img');
        under.className = 'acard__under'; under.alt = ''; under.loading = 'lazy'; under.src = next.thumb || next.src;
        below.appendChild(under); sheet.appendChild(below);
      }
      page.appendChild(m); sheet.appendChild(page);
      if (next) {      // o verso: o papel, a capa refletida aparecendo de leve e o arredondado da dobra (ver .acard__flap no CSS)
        var flap = document.createElement('span'), crease = document.createElement('span');
        flap.className = 'acard__flap'; flap.setAttribute('aria-hidden', 'true');
        mirror = document.createElement('img'); mirror.className = 'acard__mirror'; mirror.alt = ''; mirror.loading = 'lazy'; mirror.src = cover(item);
        m.hrMirror = mirror;
        crease.className = 'acard__crease';
        flap.appendChild(mirror); flap.appendChild(crease); sheet.appendChild(flap);
        b.appendChild(sheet);
      }
      // na foto grande, o nome do trabalho e a data
      if (main) {
        var t = title(item), day = document.createElement('time');
        cap = document.createElement('span'); cap.className = 'acard__cap';
        if (t) { var tt = document.createElement('span'); tt.className = 'acard__title'; tt.textContent = t; cap.appendChild(tt); }
        day.className = 'acard__date'; stamp(day, item); if (!day.hidden) cap.appendChild(day);
        if (cap.childNodes.length) { page.appendChild(cap); b.classList.add('is-veiled'); } else cap = null;     // is-veiled: ver site.css
      }
      // na última capa à vista de um cartão de área, quantos trabalhos a mais a área tem
      if (more) { b.classList.add('is-veiled'); var mo = document.createElement('span'); mo.className = 'acard__more'; mo.setAttribute('aria-hidden', 'true'); mo.textContent = '+' + more; page.appendChild(mo); }
      if (live) {
        var of = more1.length + 1, label = film ? (pt() ? 'Abrir vídeo' : 'Open video') : (pt() ? 'Abrir imagem' : 'Open image');
        b.type = 'button';
        b.setAttribute('aria-label', label + ': ' + (alt(item) || title(item)) + (of > 1 ? (pt() ? ' (' + of + ' fotos)' : ' (' + of + ' photos)') : ''));
        b.addEventListener('click', function () {               // abre na foto que está na capa agora
          var k = +(b.dataset.k || 0);
          setGroup(g);
          for (var s = 0; s < slides.length; s++) if (slides[s].item === item && slides[s].k === k) { open(s); return; }
        });
      }
      if (next && canTurn) {
        var pics = [{ t: cover(item), f: item.type === 'image' && item.thumb ? item.src : null }].concat(more1.map(function (x) { return { t: x.thumb || x.src, f: x.thumb ? x.src : null }; }));
        var turner = { el: b, sheet: sheet, cover: m, under: under, mirror: mirror, cap: cap, pics: pics, i: 0, busy: false };
        turners.push(turner); m.hrTurn = turner;      // vira no relógio comum (startTurns)
        if (turnSeen) turnSeen.observe(b);
      }
      return b;
    }
    function acard(g) {
      var li = document.createElement('li'), head = document.createElement('div'), name = document.createElement('h3'), count = document.createElement('p');
      var grid = document.createElement('div'), hue = hueOf(g.cat.id), covers = coversOf(g), shown = covers.slice(0, SHOW), go = document.createElement('button');
      li.className = 'acard'; li.dataset.area = g.cat.id;
      li.style.setProperty('--c', hue); li.style.setProperty('--c-rgb', rgbOf(hue));
      head.className = 'acard__head';
      name.className = 'acard__name'; name.textContent = catName(g.cat);
      count.className = 'acard__count'; count.textContent = countText(g);
      head.appendChild(name); head.appendChild(count); li.appendChild(head);
      grid.className = 'acard__grid'; grid.dataset.n = String(shown.length);
      shown.forEach(function (p, j) { grid.appendChild(tile(g, p, j === 0, j === shown.length - 1 ? covers.length - shown.length : 0, false)); });
      li.appendChild(grid);
      // o cartão inteiro é o botão que abre a área
      go.type = 'button'; go.className = 'acard__go';
      go.setAttribute('aria-label', (pt() ? 'Ver os trabalhos de ' : 'See the work in ') + catName(g.cat) + ' (' + countText(g) + ')');
      go.addEventListener('click', function () { swapTo(g.cat.id, g); });
      li.appendChild(go);
      return li;
    }
    // o cartão de um trabalho, na área aberta: a capa (com a dobra, se ele tem mais fotos), o nome e a data
    function wcard(g, item) {
      var li = document.createElement('li'), hue = hueOf(g.cat.id);
      li.className = 'wcard';
      li.style.setProperty('--c', hue); li.style.setProperty('--c-rgb', rgbOf(hue));
      li.appendChild(tile(g, { item: item, k: 0 }, true, 0, true));
      return li;
    }
    // a barra da área aberta: o Voltar e o nome da área, na cor dela (e um aviso escondido para quem usa leitor de tela)
    function drawBar(g) {
      if (!bar) {
        bar = document.createElement('div'); bar.className = 'work__bar'; bar.hidden = true;
        barBack = document.createElement('button'); barBack.type = 'button'; barBack.className = 'work__back';
        barName = document.createElement('p'); barName.className = 'work__area';
        barSaid = document.createElement('p'); barSaid.className = 'visually-hidden'; barSaid.setAttribute('aria-live', 'polite');
        bar.appendChild(barBack); bar.appendChild(barName);
        list.parentNode.insertBefore(bar, list); list.parentNode.insertBefore(barSaid, list);
        barBack.addEventListener('click', function () { var g0 = groups().filter(function (x) { return x.cat.id === view; })[0]; if (g0) swapTo(null, g0); });
      }
      bar.hidden = !g;
      if (!g) return;
      var hue = hueOf(g.cat.id), nm = document.createElement('span');
      bar.style.setProperty('--c', hue); bar.style.setProperty('--c-rgb', rgbOf(hue));
      barBack.textContent = pt() ? 'Voltar' : 'Back';
      barName.textContent = ''; nm.className = 'work__area-name'; nm.textContent = catName(g.cat);
      barName.appendChild(nm); barName.appendChild(document.createTextNode(' ' + countText(g)));
    }
    // Troca de vista: os cartões de agora pegam fogo inteiros, cada um na própria cor, viram pó (cinza na mesma cor), e os
    // novos se formam do pó, também cada um na sua cor
    function ownTint(el) { var c = el.style.getPropertyValue('--c'); return c ? tintOf(c.trim()) : '240, 238, 232'; }
    function swapTo(next, g) {
      if (swapping) return;
      var old = Array.prototype.slice.call(list.children), ash = window.HRAsh;
      var done = function () {
        swapping = false;
        if (barSaid) barSaid.textContent = next ? (pt() ? 'Mostrando os trabalhos de ' : 'Showing the work in ') + catName(g.cat) : (pt() ? 'Mostrando as áreas' : 'Showing the areas');
        // o foco vai para o Voltar (ao abrir) ou para o cartão da área de onde se voltou
        var f = next ? barBack : list.querySelector('.acard[data-area="' + g.cat.id + '"] .acard__go');
        if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
        // a barra e o começo da grade à vista (quem abriu uma área lá embaixo não fica olhando o meio da lista)
        var top = (next ? bar : list).getBoundingClientRect().top;
        if (top < 70 || top > window.innerHeight * 0.7) window.scrollTo({ top: window.scrollY + top - 110, behavior: reduced ? 'auto' : 'smooth' });
      };
      if (reduced || !ash || ash.reduced || !old.length) { view = next; render(); done(); return; }
      swapping = true;
      if (window.HRFire) window.HRFire.burn(old, null, 360 + 850 + 120, true);    // até o cartão virar pó inteiro
      setTimeout(function () {
        // a barra da área aberta vira pó junto com os cartões (e volta inteira, escondida, para a próxima vez)
        var gone = bar && !bar.hidden ? old.concat([bar]) : old;
        ash.run(gone, { duration: 850, dust: 1.5, tint: ownTint }).then(function () {
          if (bar) bar.style.opacity = '';
          view = next;
          render(true);
          done();
        });
      }, 360);
    }
    // as fotos de cada cartão de área chegam uma depois da outra quando ele aparece na tela (uma vez; sem prender nada)
    var arrive = !reduced && window.IntersectionObserver && Element.prototype.animate ? new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        arrive.unobserve(e.target);
        e.target.classList.add('is-in');         // e a dobra do canto das capas se abre (ver .acard__tile.has-more no CSS)
        [].forEach.call(e.target.querySelectorAll('.acard__head, .acard__tile'), function (el, j) {
          el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: j * 70, easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'backwards' });
        });
      });
    }, { threshold: 0.2 }) : null;
    var arrived = {};                 // um cartão que já chegou não chega de novo (trocar de idioma refaz os cartões)
    // tint: os cartões novos se formam do pó, cada um na sua cor (depois de uma troca de vista)
    function render(tint) {
      root.classList.toggle('no-work', !items || !items.length);
      list.textContent = ''; sharpList = [];
      turners.forEach(function (t) { if (turnSeen) turnSeen.unobserve(t.el); }); turners = [];
      startTurns();                             // o relógio das viradas recomeça com a vista nova
      if (!items || !items.length) { shownItems = []; build(); drawBar(null); return; }      // sem itens, fica o estado vazio (.empty)
      var gs = groups(), open = view ? gs.filter(function (g) { return g.cat.id === view; })[0] : null, made = [];
      if (view && !open) view = null;           // a área aberta ficou sem trabalhos (o dono apagou): de volta às áreas
      drawBar(open);
      list.classList.toggle('is-works', !!open);
      if (open) open.works.forEach(function (it) { var li = wcard(open, it); list.appendChild(li); made.push(li); });
      else gs.forEach(function (g) {
        var li = acard(g);
        list.appendChild(li); made.push(li);
        if (tint) arrived[g.cat.id] = 1;
        else if (arrive && !arrived[g.cat.id]) { arrived[g.cat.id] = 1; arrive.observe(li); }
      });
      preferFull();                             // os cartões já estão na página: dá para medir antes de as fotos baixarem
      if (tint && window.HRAsh) {
        // enquanto se formam do pó, o mouse por cima não põe fogo neles (js/fx.js); formados, o de baixo do mouse acende
        // (e a barra da área, quando é ela que se abre, se forma junto)
        var forming = open && bar ? made.concat([bar]) : made;
        forming.forEach(function (el) { el.style.opacity = '0'; });
        made.forEach(function (li) { li.classList.add('is-forming'); });
        window.HRAsh.run(forming, { appear: true, duration: 750, dust: 0.9, tint: ownTint }).then(function () {
          forming.forEach(function (el) { el.style.opacity = ''; });
          made.forEach(function (li) { li.classList.remove('is-forming'); li.classList.add('is-in'); if (window.HRFire) window.HRFire.wake(li); });
        });
      } else if (open) made.forEach(function (li) { li.classList.add('is-in'); });
    }
    render();
    // Quem chegou pelo link de um trabalho cai direto nele, aberto no visualizador, com a grade de trabalhos atrás (ao
    // fechar, está nela). O "#" no link também pula a apresentação de abertura (ver o script no <head> do index.html).
    // Se o trabalho saiu do portfólio, a página vai para a grade com um aviso.
    function fromLink() {
      var h = hashNow(), sec = document.getElementById('work');
      if (!h || isSection(h) || !items || !items.length) return false;      // sem link, ou link de seção (#about...): como antes
      var item = findLink(h);
      if (sec) sec.scrollIntoView();
      if (!item) { if (box.open) box.close(); if (gone) gone.hidden = false; unmark(); return true; }
      // o visualizador anda pela área do trabalho; com ele já aberto (outro link colado), só troca o que ele mostra:
      // fechar e reabrir apagaria o novo
      var g0 = groupOf(item);
      if (g0 && view !== g0.cat.id) { view = g0.cat.id; render(); }      // atrás do visualizador, a área do trabalho aberta
      setGroup(g0);
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
    if (window.fetch) fetch('/portfolio.json', { cache: 'no-cache' }).then(function (res) { return res.ok ? res.json() : null; }).then(function (d) {
      items = d && Array.isArray(d.items) ? d.items.filter(function (it) { return it && typeof it.src === 'string'; }).map(fromRoot) : null;
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
    dev.className = 'dev'; dev.href = '/admin/';
    dev.setAttribute('aria-label', 'Editar o site'); dev.title = 'Editar o site';
    document.body.appendChild(dev);
  }

  // ---------- Loja: o convite do Discord vem do arquivo que o bot do Notorious publica ----------
  var join = document.querySelector('.store__join');
  if (join && window.fetch) fetch('/notorious/store.json').then(function (res) { return res.ok ? res.json() : null; }).then(function (d) {
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
