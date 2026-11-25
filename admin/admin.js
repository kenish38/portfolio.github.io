// ===== Painel do dono =====
// O site é estático (GitHub Pages) e não tem servidor. Para o dono publicar sozinho, esta página conversa direto com o
// GitHub usando uma chave de acesso que ele cria uma vez (token "fine-grained", só deste repositório, permissão Contents).
// A chave fica só no navegador dele (na aba, ou no aparelho se ele marcar "Lembrar"); nunca vai para o repositório.
//
// O que o painel faz ao publicar, num commit só na branch principal:
//   - grava os arquivos novos em media/ (imagens já reduzidas, com miniatura; GIFs como estão, com uma miniatura parada;
//     vídeos sem o lugar da gravação, com um quadro de capa);
//   - reescreve portfolio.json com a lista na ordem e com os títulos do painel;
//   - apaga de media/ os arquivos dos trabalhos removidos (menos os que outro trabalho ainda usa).
// O site lê portfolio.json (ver "Portfólio" em js/page.js). O GitHub Pages republica em 1 a 2 minutos.
//
// IMPORTANTE para quem mexer no repositório: media/ e portfolio.json pertencem ao dono do site. Nenhuma atualização
// do código deve apagar ou sobrescrever esses arquivos, e todo push precisa partir da branch principal atualizada.
(function () {
  'use strict';
  var REPO = 'kenish38/portfolio.github.io', BRANCH = 'main';          // repositório e branch que o GitHub Pages publica
  var SITE = 'https://henriquerocha.dev.br/admin/';                     // endereço do painel, no domínio do site
  var API = 'https://api.github.com/repos/' + REPO, RAW = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/';
  var KEY = 'hr-admin-token';                                           // onde a chave fica no navegador (só este painel lê)
  var OWNER = 'hr-owner';                                               // marca sem segredo: o site (js/page.js) mostra o botão do dono por ela
  var DIR = 'media/', FULL = 3200, THUMB = 1000, POSTER = 1280;         // pasta dos arquivos e lado maior, em px, de cada versão
  var MAX_VIDEO = 50 * 1024 * 1024;                                     // vídeos maiores que isso pesam demais para o visitante
  var MAX_TITLE = 90, MAX_DESC = 240;                                   // tamanho máximo dos títulos e das descrições
  // As categorias: o dono cria, renomeia (em português e em inglês), ordena e apaga. Vão para portfolio.json em
  // "categories"; cada trabalho guarda a chave (id) da sua em "kind". Enquanto o arquivo não tem a lista, valem estas
  // (as mesmas chaves dos tipos antigos; o site, em js/page.js, tem a mesma lista)
  var DEFAULT_CATS = [
    { id: 'map', pt: 'Mapas', en: 'Maps' }, { id: 'model', pt: 'Modelos 3D', en: '3D models' }, { id: 'lighting', pt: 'Iluminação e VFX', en: 'Lighting & VFX' },
    { id: 'script', pt: 'Sistemas e scripts', en: 'Systems & scripts' }, { id: 'ui', pt: 'Interfaces', en: 'Interfaces' }, { id: 'game', pt: 'Jogos completos', en: 'Full games' },
    { id: 'ai', pt: 'Ferramentas de IA', en: 'AI tools' }
  ];
  var MAX_CATS = 16, MAX_CAT = 30;                                      // quantas categorias no máximo e o tamanho do nome de uma
  var MAX_PICS = 4;                                                     // imagens por trabalho: a principal e até 3 extras

  // Troca a página por um aviso com um link, e o painel não começa
  function stop(title, text, href) {
    var warn = document.createElement('main'), h = document.createElement('h1'), p = document.createElement('p'), a = document.createElement('a');
    h.textContent = title;
    p.className = 'lead'; p.textContent = text;
    a.href = href; a.textContent = href; p.appendChild(a);
    document.body.textContent = ''; warn.appendChild(h); warn.appendChild(p); document.body.appendChild(warn);
  }
  // O painel nunca roda dentro de outro site (um <iframe> escondido poderia induzir cliques em Publicar ou Apagar).
  // O GitHub Pages não deixa mandar o cabeçalho que proíbe isso, então a própria página se recusa a abrir num quadro.
  if (window.top !== window.self) { document.documentElement.textContent = ''; return; }
  // Nunca pelo endereço *.github.io: ele é dividido com todos os outros sites do GitHub Pages da conta, e qualquer um deles
  // conseguiria ler o que o painel guarda no navegador. Uma chave que tenha ficado guardada lá de antes é apagada.
  if (/\.github\.io$/i.test(location.hostname)) {
    try { [KEY, OWNER].forEach(function (k) { localStorage.removeItem(k); sessionStorage.removeItem(k); }); } catch (e) {}
    stop('Abra o painel pelo endereço do site', 'Este endereço (github.io) é dividido com outros sites do GitHub, então o painel não pede nem guarda a chave aqui. Abra pelo endereço do site: ', SITE);
    return;
  }
  // Só pelo endereço seguro (https://, com o cadeado). Sem ele, alguém na mesma rede (um Wi-Fi público, por exemplo)
  // poderia mexer na página no caminho e pegar a chave. No computador do desenvolvedor (localhost) pode abrir sem.
  if (location.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    stop('Abra o painel com o cadeado', 'Este endereço está sem o cadeado (https). Por segurança, o painel só funciona pelo endereço seguro: ', 'https://' + location.host + location.pathname);
    return;
  }

  function $(sel, el) { return (el || document).querySelector(sel); }
  var loginEl = $('#login'), panelEl = $('#panel'), barEl = $('.bar'), outBtn = $('.top__out'), waitEl = $('.wait'), howEl = $('.how');
  var form = $('.login__form'), tokenIn = $('#token'), loginMsg = $('.login__form .msg');
  var rememberIn = $('#remember'), dropEl = $('.drop'), filesIn = $('#files'), filesMsg = $('.msg--files'), listEl = $('.list'), noneEl = $('.none');
  var stateEl = $('.bar__state'), meterEl = $('.bar__meter'), meterFill = $('.bar__meter i'), publishBtn = $('.bar__publish'), discardBtn = $('.bar__discard');
  var tubeForm = $('.tube'), tubeIn = $('#tube'), tubeMsg = $('.msg--tube'), rowTpl = $('#row');
  $('.repo-name').textContent = REPO.split('/')[1];

  var token = null, items = [], cats = [], removed = [], remoteJson = '', busy = false, note = null, serial = 0, goneExtras = 0;
  var kindsEl = $('.kinds'), kindsList = $('.kinds__list'), kindsSum = $('.kinds__sum'), kindsForm = $('.kinds__add'), kindsPt = $('.kinds__pt'), kindsEn = $('.kinds__en'), kindsMsg = $('.msg--kinds');
  var pending = 0;     // levas de arquivos ainda sendo preparadas: o Publicar espera todas
  var WAIT = 'Aguarde: o painel está publicando ou carregando a lista. Depois, adicione de novo.';

  // ---------- GitHub ----------
  // seen (opcional) recebe os cabeçalhos da resposta
  function gh(method, path, body, seen) {
    return fetch(API + path, {
      method: method,
      // sempre a resposta de agora: o GitHub deixa o navegador reaproveitar uma leitura por até 60 s, e aí o painel veria
      // uma lista ou um commit antigos (aviso falso de "alterado por outro aparelho", lista velha ao recarregar, publicação por cima)
      cache: 'no-store',
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (seen) seen(res.headers);
      return res.text().then(function (text) {
        var data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
        if (!res.ok) { var err = new Error(data && data.message || ('erro ' + res.status)); err.status = res.status; throw err; }
        return data;
      });
    });
  }
  // Só a chave fine-grained (github_pat_...), que mexe só neste repositório. As clássicas (ghp_...) e as de aplicativos (gho_...)
  // abrem todos os repositórios da conta: se uma delas vazasse deste navegador, o estrago iria muito além do site.
  // (tok: a chave recusada antes de ir ao GitHub; sem ela, foi o GitHub quem avisou que a chave tem permissões amplas)
  function wide(tok) {
    var err = new Error(tok && !/^gh[a-z]_/.test(tok)
      ? 'Isto não parece uma chave do GitHub do tipo fine-grained (ela começa com github_pat_). Confira se copiou a chave inteira, ou crie uma pelos passos de “Como criar a chave”, logo abaixo.'
      : 'Esta chave abre todos os seus repositórios no GitHub (é do tipo clássico ou de um aplicativo). Por segurança, o painel só aceita a do tipo fine-grained, que começa com github_pat_ e só mexe neste site. Crie uma pelos passos de “Como criar a chave”, logo abaixo, e cole aqui.');
    err.wide = true; return err;
  }
  // Mensagem para o dono, em português, a partir de um erro do GitHub ou da rede
  function explain(err) {
    if (err.wide) return err.message;
    if (!err.status) return 'Sem conexão com o GitHub. Confira a internet e tente de novo.';
    if (err.status === 401) return 'O GitHub não aceita mais esta chave (ela venceu ou foi apagada). Clique em Sair e entre com uma chave nova.';
    if (err.status === 403 || err.status === 404) return 'A chave não tem permissão para escrever neste site. Confira se ela foi criada para o repositório ' + REPO.split('/')[1] + ' com Contents em "Read and write".';
    return 'O GitHub recusou o pedido: ' + err.message;
  }
  function b64text(b64) {      // texto em UTF-8 a partir do base64 que o GitHub devolve
    var bin = atob(b64.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function base64(blob) {      // conteúdo de um arquivo em base64, para enviar
    return new Promise(function (ok, no) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { no(new Error('não consegui ler o arquivo')); };
      fr.readAsDataURL(blob);
    });
  }

  // ---------- Lista: o que vai para portfolio.json ----------
  function text(v, max) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max); }
  function clean(it, ids) {    // só os campos públicos de um item, na ordem em que aparecem no arquivo (ids: as categorias que existem)
    var o = { type: it.type === 'video' || it.type === 'youtube' ? it.type : 'image', src: it.src };
    ['thumb', 'poster'].forEach(function (k) { if (mine(it[k])) o[k] = it[k]; });
    [['title', MAX_TITLE], ['title_pt', MAX_TITLE], ['desc', MAX_DESC], ['desc_pt', MAX_DESC], ['alt', MAX_DESC], ['alt_pt', MAX_DESC]].forEach(function (f) {
      var v = text(it[f[0]], f[1]); if (v) o[f[0]] = v;
    });
    if ((ids || []).indexOf(it.kind) >= 0) o.kind = it.kind;
    // fotos extras do trabalho: só imagens que estão em media/
    var more = (Array.isArray(it.more) ? it.more : []).filter(function (m) { return m && mine(m.src); }).map(function (m) {
      var x = { src: m.src }; if (mine(m.thumb)) x.thumb = m.thumb; return x;
    });
    if (more.length) o.more = more;
    return o;
  }
  // as categorias limpas: chave válida e única, os dois nomes (um vale pelo outro), no máximo MAX_CATS
  function cleanCats(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).filter(function (c) {
      if (!c || typeof c.id !== 'string' || !/^[a-z0-9-]{1,32}$/.test(c.id) || seen[c.id]) return false;
      seen[c.id] = 1; return true;
    }).slice(0, MAX_CATS).map(function (c) {
      var p = text(c.pt, MAX_CAT), e = text(c.en, MAX_CAT);
      return { id: c.id, pt: p || e || 'Categoria', en: e || p || 'Category' };
    });
  }
  function ids(list) { return list.map(function (c) { return c.id; }); }
  // o texto de portfolio.json para uma versão já limpa
  function toJson(list, catList) { return JSON.stringify({ categories: catList, items: list }, null, 2) + '\n'; }
  function json() { var c = cleanCats(cats); return toJson(items.map(function (it) { return clean(it, ids(c)); }), c); }
  function dirty() { return json() !== remoteJson; }
  function mine(path) { return typeof path === 'string' && path.indexOf(DIR) === 0 && path.indexOf('..') < 0; }   // o painel só apaga o que está em media/
  function revoke(it) {        // solta as prévias guardadas na memória do navegador
    if (it._url) URL.revokeObjectURL(it._url);
    (it.more || []).forEach(function (m) { if (m._url) URL.revokeObjectURL(m._url); });
  }

  // A lista de portfolio.json numa versão do site (a branch ou um commit), limpa do jeito que o painel a escreveria
  function fetchList(ref) {
    function read(data) {
      var c = cleanCats(data && Array.isArray(data.categories) && data.categories.length ? data.categories : DEFAULT_CATS);
      return { cats: c, items: (data && Array.isArray(data.items) ? data.items : []).filter(function (it) { return it && it.src; }).map(function (it) { return clean(it, ids(c)); }) };
    }
    return gh('GET', '/contents/portfolio.json?ref=' + ref).then(function (file) {
      var data = null; try { data = JSON.parse(b64text(file.content)); } catch (e) {}
      return read(data);
    }, function (err) { if (err.status === 404) return read(null); throw err; });
  }
  function load() {
    return fetchList(BRANCH).then(function (got) {
      items.forEach(revoke);
      items = got.items; cats = got.cats;
      removed = []; goneExtras = 0; remoteJson = json(); note = null;
      render();
    });
  }
  // O commit de agora na branch, depois de conferir que o portfólio nele é o mesmo que este painel abriu (ou publicou por último).
  // Se outro aparelho publicou nesse meio-tempo, para tudo em vez de escrever por cima do que ele fez.
  function current() {
    var head;
    return gh('GET', '/git/ref/heads/' + BRANCH).then(function (ref) {
      head = ref.object.sha;
      return fetchList(head);        // a lista exatamente nesse commit (não na branch, que pode andar enquanto isso)
    }).then(function (got) {
      if (toJson(got.items, got.cats) !== remoteJson) { var err = new Error('mudou'); err.changed = true; throw err; }
      return head;
    });
  }

  // ---------- Entrada ----------
  function show(logged) { waitEl.hidden = true; loginEl.hidden = logged; panelEl.hidden = !logged; barEl.hidden = !logged; outBtn.hidden = !logged; }
  // keep: true guarda a chave neste aparelho (localStorage), false só nesta aba (sessionStorage, some ao fechar o navegador);
  // sem keep (ao abrir o painel com a chave já guardada), ela fica onde estava
  function enter(tok, keep) {
    var scopes = '';
    if (!/^github_pat_/.test(tok)) return Promise.reject(wide(tok));
    token = tok;
    // a chave vale? e deixa escrever? (o teste de escrita cria um conteúdo solto de 2 letras, que não aparece em lugar nenhum)
    return gh('GET', '', null, function (h) { scopes = h.get('X-OAuth-Scopes') || ''; }).then(function () {
      if (/\S/.test(scopes)) throw wide();      // o GitHub só manda a lista de permissões amplas para as chaves clássicas e de aplicativos
      return gh('POST', '/git/blobs', { content: 'ok', encoding: 'utf-8' });
    }).then(function () {
      try {
        if (keep !== undefined) { (keep ? localStorage : sessionStorage).setItem(KEY, tok); (keep ? sessionStorage : localStorage).removeItem(KEY); }
        localStorage.setItem(OWNER, '1');     // vale mesmo sem "Lembrar": o site não precisa ler a chave para saber que é o dono
      } catch (e) {}
      // o painel só aparece com a lista já carregada: o que o dono adicionasse antes de ela chegar seria jogado fora
      return load();
    }).then(function () { show(true); });
  }
  function forget() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); localStorage.removeItem(OWNER); } catch (e) {} }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var tok = tokenIn.value.trim();
    if (!tok) { loginMsg.className = 'msg'; loginMsg.textContent = 'Cole a chave no campo acima.'; return; }
    loginMsg.className = 'msg is-ok'; loginMsg.textContent = 'Conferindo a chave...';
    enter(tok, rememberIn.checked).then(function () { tokenIn.value = ''; loginMsg.textContent = ''; }, function (err) {
      token = null; show(false);
      loginMsg.className = 'msg';
      loginMsg.textContent = err.status === 401 ? 'O GitHub não reconheceu esta chave. Confira se copiou inteira.' : explain(err);
      if (err.wide) howEl.open = true;      // deixa à vista os passos da chave certa
    });
  });
  outBtn.addEventListener('click', function () {
    if (dirty() && !window.confirm('Há mudanças que ainda não foram publicadas. Sair mesmo assim?')) return;
    forget();
    remoteJson = json();            // nada a avisar ao recarregar
    location.reload();
  });

  // ---------- Preparar os arquivos escolhidos ----------
  function slug(name) {
    return name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'trabalho';
  }
  function words(name) { var t = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); }
  function mb(bytes) { return (bytes / 1048576).toFixed(bytes < 1048576 ? 2 : 1).replace('.', ',') + ' MB'; }
  function toBlob(cv, type, q) { return new Promise(function (ok) { cv.toBlob(ok, type, q); }); }
  // Reduz uma imagem (ou um quadro de vídeo) para caber em "max" px no lado maior. WebP quando o navegador sabe gravar; senão, JPEG.
  function shrink(src, max, q) {
    var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    var k = Math.min(1, max / Math.max(w, h)), cv = document.createElement('canvas'), ctx;
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, cv.width, cv.height);
    return toBlob(cv, 'image/webp', q).then(function (b) {
      if (b && b.type === 'image/webp') return b;
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);   // JPEG não tem transparência
      return toBlob(cv, 'image/jpeg', q);
    }).then(function (b) { if (!b) throw new Error('não consegui converter a imagem'); return b; });
  }
  function ext(blob) { return blob.type === 'image/webp' ? '.webp' : '.jpg'; }
  // Abre a imagem (de um GIF animado, o primeiro quadro)
  function openImage(file) {
    function viaTag() {
      return new Promise(function (ok, no) {
        var im = new Image(), url = URL.createObjectURL(file);
        im.onload = function () { ok(im); }; im.onerror = function () { URL.revokeObjectURL(url); no(new Error('não consegui abrir esta imagem')); };
        im.src = url;
      });
    }
    if (!window.createImageBitmap) return viaTag();
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return createImageBitmap(file); }).catch(viaTag);
  }
  // Um quadro do começo do vídeo, para servir de capa (se o navegador não conseguir abrir o vídeo, fica sem capa)
  function frame(file) {
    return new Promise(function (ok) {
      var v = document.createElement('video'), url = URL.createObjectURL(file), over = false;
      function end(blob) { if (over) return; over = true; URL.revokeObjectURL(url); ok(blob || null); }
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadeddata = function () { try { v.currentTime = Math.min(1, (v.duration || 2) * 0.15); } catch (e) { end(null); } };
      v.onseeked = function () { if (!v.videoWidth) return end(null); shrink(v, POSTER, 0.82).then(end, function () { end(null); }); };
      v.onerror = function () { end(null); };
      setTimeout(function () { end(null); }, 9000);
      v.src = url;
    });
  }

  // ---------- Vídeo: tirar o lugar da gravação ----------
  // Vídeo de celular costuma levar o lugar onde foi gravado (GPS) nas caixas ©xyz e loci do MP4, ou nas chaves "location"
  // do jeito da Apple. As fotos perdem isso ao serem reduzidas, mas o vídeo vai como está. Então, antes de enviar, cada uma
  // dessas caixas vira uma caixa "free" (espaço vazio, que todo programa pula) do mesmo tamanho, cheia de zeros: nada muda
  // de lugar no arquivo e ele toca igual. Só os metadados (a caixa moov, pequena) são lidos; as imagens do vídeo não.
  var TOP = ['moov', 'meta', 'udta'], NESTED = ['moov', 'trak', 'udta', 'meta', 'ilst'];   // caixas que guardam outras caixas
  function bytes(blob) { return blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer(); }
  function fourcc(u, at) { return String.fromCharCode(u[at], u[at + 1], u[at + 2], u[at + 3]); }
  // Apaga as caixas de lugar entre start e end (u: os bytes); devolve quantas apagou.
  // gps: os números das chaves de lugar da caixa meta da vez (o valor delas fica no ilst ao lado, numa caixa com esse número)
  function wipe(u, start, end, parent, gps) {
    var v = new DataView(u.buffer, u.byteOffset, u.byteLength), at = start, n = 0, size, type, head, inner, p, k, len;
    while (at + 8 <= end) {
      size = v.getUint32(at); type = fourcc(u, at + 4); head = 8;
      if (size === 1 && at + 16 <= end) { size = v.getUint32(at + 8) * 4294967296 + v.getUint32(at + 12); head = 16; }
      else if (size === 0) size = end - at;
      if (size < head || at + size > end) break;          // caixa quebrada: para por aqui
      if (type === '\u00a9xyz' || type === 'loci' || (parent === 'ilst' && gps[v.getUint32(at + 4)])) {
        u.set([102, 114, 101, 101], at + 4); u.fill(0, at + head, at + size); n++;         // vira "free"
      } else if (type === 'keys' && parent === 'meta') {
        for (p = at + head + 8, k = 1; p + 8 <= at + size; k++, p += len) {
          len = v.getUint32(p); if (len < 8) break;
          if (/location/i.test(String.fromCharCode.apply(null, u.subarray(p + 8, Math.min(p + len, at + size))))) gps[k] = 1;
        }
      } else if (NESTED.indexOf(type) >= 0) {
        inner = at + head;
        if (type === 'meta' && fourcc(u, inner + 4) !== 'hdlr') inner += 4;     // a meta do padrão ISO tem 4 bytes de versão antes das caixas; a da Apple não
        n += wipe(u, inner, at + size, type, type === 'meta' ? {} : gps);
      }
      at += size;
    }
    return n;
  }
  function scrub(file) {
    if (file.type !== 'video/mp4') return Promise.resolve(file);
    var parts = [], last = 0;
    function next(at) {                 // caixa por caixa do arquivo, lendo só o cabeçalho de cada uma
      if (at + 8 > file.size) return Promise.resolve();
      return bytes(file.slice(at, at + 16)).then(function (buf) {
        var u = new Uint8Array(buf), v = new DataView(buf), size = v.getUint32(0), head = 8;
        if (size === 1 && buf.byteLength >= 16) { size = v.getUint32(8) * 4294967296 + v.getUint32(12); head = 16; }
        else if (size === 0) size = file.size - at;
        if (size < head || at + size > file.size) return;
        if (TOP.indexOf(fourcc(u, 4)) < 0) return next(at + size);
        return bytes(file.slice(at, at + size)).then(function (box) {
          var b = new Uint8Array(box);
          if (wipe(b, 0, size, '', {})) { parts.push(file.slice(last, at), b); last = at + size; }
          return next(at + size);
        });
      });
    }
    return next(0).then(function () {
      if (!parts.length) return file;
      parts.push(file.slice(last));
      return new Blob(parts, { type: file.type });
    }, function () { return file; });
  }

  // De um arquivo escolhido para um item novo da lista, com os arquivos que vão para media/
  function prepare(file) {
    var base = DIR + slug(file.name) + '-' + Date.now().toString(36) + (serial++).toString(36);
    // imagem colada (Ctrl+V) chega com um nome genérico: aí o título fica para o dono escrever
    var it = { src: '', title: /^image\.(png|jpe?g|gif|webp)$/i.test(file.name) ? '' : words(file.name), title_pt: '', _new: true, _files: [], _url: '' };
    if (/^video\//.test(file.type)) {
      if (!/^video\/(mp4|webm)$/.test(file.type)) return Promise.reject(new Error('use vídeo em MP4 ou WebM (este é ' + (file.type || 'de um formato desconhecido') + ').'));
      if (file.size > MAX_VIDEO) return Promise.reject(new Error('o vídeo tem ' + mb(file.size) + ' e o limite é 50 MB. Exporte em 1080p ou menos, ou corte um trecho mais curto.'));
      it.type = 'video'; it.src = base + (file.type === 'video/webm' ? '.webm' : '.mp4');
      return scrub(file).then(function (video) {
        it._files.push({ path: it.src, blob: video });
        return frame(video).then(function (shot) {
          if (shot) { it.poster = base + '-capa' + ext(shot); it._files.push({ path: it.poster, blob: shot }); it._url = URL.createObjectURL(shot); }
          else it._url = URL.createObjectURL(video);     // sem capa: o cartão mostra o próprio vídeo (ver picture)
          return it;
        });
      });
    }
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('só imagens e vídeos entram no portfólio.'));
    // SVG não entra: ele pode levar código escondido, que rodaria no endereço do site se alguém abrisse o arquivo direto
    // (e de lá conseguiria ler a chave deste painel). Para desenhos vetoriais, exporte em PNG.
    if (/^image\/svg/.test(file.type) || /\.svg$/i.test(file.name)) return Promise.reject(new Error('arquivos SVG não são aceitos, por segurança. Exporte o desenho em PNG e envie de novo.'));
    it.type = 'image';
    // GIF: a animação vai como está, e a miniatura é o primeiro quadro, parado. A grade do site mostra a miniatura, então o GIF
    // só se mexe quando o visitante abre o trabalho (e quem pediu menos movimento não fica com uma animação sem fim na grade).
    var gif = file.type === 'image/gif';
    return openImage(file).then(function (img) {
      return (gif ? Promise.resolve(file) : shrink(img, FULL, 0.88)).then(function (full) {
        return shrink(img, THUMB, 0.8).then(function (small) {
          it.src = base + (gif ? '.gif' : ext(full)); it.thumb = base + '-mini' + ext(small);
          it._files.push({ path: it.src, blob: full }, { path: it.thumb, blob: small });
          it._url = URL.createObjectURL(small);
          if (img.close) img.close();
          return it;
        });
      });
    });
  }
  // Prepara uma leva de arquivos, um por vez: check(arquivo) diz por que recusar (ou ''), each(item pronto) põe na lista.
  // Enquanto houver leva em preparo (pending), o Publicar fica desligado: senão a lista iria ao ar sem os arquivos que faltam.
  function batch(files, check, each) {
    var problems = [], chain = Promise.resolve();
    pending++; refresh();
    filesMsg.className = 'msg msg--files is-ok'; filesMsg.textContent = 'Preparando ' + files.length + (files.length > 1 ? ' arquivos...' : ' arquivo...');
    files.forEach(function (file) {
      chain = chain.then(function () {
        var bad = check(file);
        if (bad) { problems.push(file.name + ': ' + bad); return; }
        return prepare(file).then(function (x) { each(x); note = null; render(); }, function (err) { problems.push(file.name + ': ' + err.message); });
      });
    });
    function end() {
      pending--;
      if (problems.length || !pending) { filesMsg.className = 'msg msg--files'; filesMsg.textContent = problems.join('\n'); }
      refresh();
    }
    return chain.then(end, end);
  }
  function addFiles(fileList) {
    var files = [].slice.call(fileList);
    if (!files.length) return;
    if (busy) { filesMsg.className = 'msg msg--files'; filesMsg.textContent = WAIT; filesIn.value = ''; return; }
    batch(files, function () { return ''; }, function (it) { items.push(it); }).then(function () { filesIn.value = ''; });
  }
  filesIn.addEventListener('change', function () { addFiles(filesIn.files); });
  // Colar uma imagem (Ctrl+V) em qualquer lugar do painel cria um trabalho novo com ela
  document.addEventListener('paste', function (e) {
    if (panelEl.hidden) return;
    var t = e.target, cd = e.clipboardData;
    // colando num campo de texto algo que também tem texto (o Word e o Excel mandam o texto junto com uma imagem dele): vale o texto
    if (t && t.closest && t.closest('textarea, input[type="text"]') && cd && [].indexOf.call(cd.types || [], 'text/plain') >= 0) return;
    var pics = [].slice.call((cd && cd.files) || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!pics.length) return;
    e.preventDefault();
    addFiles(pics);
  });
  // Fotos extras de um trabalho: só imagens, reduzidas como as outras, com miniatura
  function addExtras(it, fileList) {
    var files = [].slice.call(fileList), room = MAX_PICS - 1 - (it.more || []).length, cut = 0;
    if (!files.length) return;
    if (busy) { filesMsg.className = 'msg msg--files'; filesMsg.textContent = WAIT; return; }
    if (room <= 0) { filesMsg.className = 'msg msg--files'; filesMsg.textContent = 'Este trabalho já tem ' + MAX_PICS + ' imagens, o máximo. Tire uma foto extra para colocar outra.'; return; }
    if (files.length > room) { cut = files.length - room; files = files.slice(0, room); }
    batch(files, function (file) {
      return !/^image\//.test(file.type) || /^image\/svg/.test(file.type) ? 'como foto extra, só imagens (PNG, JPEG, WebP ou GIF).' : '';
    }, function (x) {
      it.more = it.more || [];
      if (it.more.length >= MAX_PICS - 1) { if (x._url) URL.revokeObjectURL(x._url); cut++; return; }   // outra leva já encheu o trabalho
      it.more.push({ src: x.src, thumb: x.thumb, _files: x._files, _url: x._url, _new: true });
    }).then(function () {
      if (cut) { filesMsg.className = 'msg msg--files'; filesMsg.textContent = (filesMsg.textContent ? filesMsg.textContent + '\n' : '') + 'Cada trabalho tem até ' + MAX_PICS + ' imagens: ' + (cut > 1 ? cut + ' fotos ficaram de fora.' : '1 foto ficou de fora.'); }
    });
  }
  // Arquivo que sai do site ao publicar (se nenhum trabalho da lista ainda o usar; ver publish)
  function gone(path) { if (mine(path) && removed.indexOf(path) < 0) removed.push(path); }
  function dropExtra(it, k) {
    if (busy) return;
    var m = it.more[k];
    if (!m._new && !window.confirm('Tirar esta foto extra? Ela sai do site quando você publicar.')) return;
    it.more.splice(k, 1);
    if (m._url) URL.revokeObjectURL(m._url);
    if (!m._new) { goneExtras++; [m.src, m.thumb].forEach(gone); }
    note = null; render();
  }
  ['dragenter', 'dragover'].forEach(function (name) { dropEl.addEventListener(name, function (e) { e.preventDefault(); dropEl.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (name) { dropEl.addEventListener(name, function (e) { e.preventDefault(); dropEl.classList.remove('is-over'); }); });
  dropEl.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  ['dragover', 'drop'].forEach(function (name) { window.addEventListener(name, function (e) { e.preventDefault(); }); });   // soltar fora da área não abre o arquivo no navegador

  // ---------- Vídeo do YouTube: o item guarda só o link ----------
  function ytId(url) { var m = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/.exec(String(url || '')); return m ? m[1] : ''; }
  tubeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = ytId(tubeIn.value.trim()), src = 'https://youtu.be/' + id;
    if (busy) { tubeMsg.textContent = WAIT; return; }
    if (!id) { tubeMsg.textContent = 'Não reconheci este link. Abra o vídeo no YouTube, clique em Compartilhar e cole o link aqui.'; return; }
    if (items.some(function (it) { return it.type === 'youtube' && ytId(it.src) === id; })) { tubeMsg.textContent = 'Este vídeo já está na lista.'; return; }
    items.push({ type: 'youtube', src: src, title: '', title_pt: '', _new: true, _files: [], _url: '' });
    tubeIn.value = ''; tubeMsg.textContent = ''; note = null; render();
  });

  // ---------- Desenhar a lista ----------
  function picture(it) {
    var el, shown = it._url || (it.thumb || it.poster || (it.type === 'image' ? it.src : ''));
    // vídeo sem quadro de capa (o navegador não conseguiu ler um): o próprio vídeo, parado no começo, como no site
    if (it.type === 'video' && !it.poster) { el = document.createElement('video'); el.muted = true; el.playsInline = true; el.preload = 'metadata'; el.src = it._url || RAW + it.src; return el; }
    if (it.type === 'youtube' && !shown) { el = document.createElement('img'); el.alt = ''; el.loading = 'lazy'; el.src = 'https://i.ytimg.com/vi/' + ytId(it.src) + '/hqdefault.jpg'; return el; }
    el = document.createElement('img'); el.alt = ''; el.loading = 'lazy'; el.src = it._url ? shown : RAW + shown;
    return el;
  }
  // Redesenhar a lista recria todos os campos. Para quem está digitando ou usando o teclado não se perder, o foco volta
  // ao mesmo campo do mesmo trabalho, com o cursor no mesmo ponto (ou ao lugar mais perto, se aquilo saiu da lista).
  var drawn = [];      // o trabalho de cada cartão desenhado, na ordem
  var FIELDS = ['row__title', 'row__title-pt', 'row__desc', 'row__desc-pt', 'row__kind', 'row__files', 'row__up', 'row__down', 'row__del'];
  function spot() {    // onde está o foco dentro da lista
    var a = document.activeElement, row = a && a.closest && listEl.contains(a) ? a.closest('.row') : null, s, box;
    if (!row) return null;
    box = a.getBoundingClientRect();
    s = { at: [].indexOf.call(listEl.children, row), field: '', x: -1 };
    s.it = drawn[s.at];
    s.seen = box.bottom > 0 && box.top < innerHeight;            // estava à vista? (se o dono rolou para longe, a página não pula de volta)
    FIELDS.forEach(function (c) { if (a.classList.contains(c)) s.field = c; });
    if (a.parentNode.classList.contains('row__x')) s.x = [].indexOf.call(a.parentNode.parentNode.children, a.parentNode);   // o × de uma foto extra
    try { if (typeof a.selectionStart === 'number') { s.from = a.selectionStart; s.to = a.selectionEnd; s.dir = a.selectionDirection; s.top = a.scrollTop; } } catch (e) {}
    return s;
  }
  function back(s) {
    if (!s) return;
    var i = items.indexOf(s.it), row, el, xs;
    if (i < 0) i = Math.min(s.at, items.length - 1);      // o trabalho saiu da lista: o cartão que ficou no lugar dele
    row = listEl.children[i];
    if (!row) { filesIn.focus(); return; }                // a lista ficou vazia: o "Escolher imagens"
    if (s.x >= 0) { xs = row.querySelectorAll('.row__x button'); el = xs[Math.min(s.x, xs.length - 1)] || $('.row__files', row); }   // a foto extra ao lado, ou o "+ Fotos extras"
    else if (s.field) el = $('.' + s.field, row);
    if (el && el.disabled) el = $(s.field === 'row__up' ? '.row__down' : '.row__up', row);     // chegou ao topo ou ao fim: a outra seta
    if (!el || el.disabled) el = $('.row__del', row);
    el.focus({ preventScroll: !s.seen });         // à vista, continua à vista (a seta de um trabalho que desceu, por exemplo)
    if (s.from !== undefined && el.setSelectionRange) { try { el.setSelectionRange(s.from, s.to, s.dir); el.scrollTop = s.top; } catch (e) {} }
  }
  function render() {
    var s = spot();
    listEl.textContent = '';
    items.forEach(function (it, i) {
      var row = rowTpl.content.firstElementChild.cloneNode(true), meta = $('.row__meta', row), size = 0;
      row.classList.toggle('is-new', !!it._new);
      $('.row__pic', row).appendChild(picture(it));
      meta.appendChild(document.createTextNode(it.type === 'youtube' ? 'YouTube' : it.type === 'video' ? 'Vídeo' : 'Imagem'));
      function tag(text) { var b = document.createElement('b'); b.textContent = text; meta.appendChild(b); }
      if (i === 0) tag('Destaque');
      if (it._new) { tag('Novo'); it._files.forEach(function (f) { size += f.blob.size; }); if (size) meta.appendChild(document.createTextNode(mb(size))); }
      var en = $('.row__title', row), pt = $('.row__title-pt', row), cap = $('.row__cap', row);
      var den = $('.row__desc', row), dpt = $('.row__desc-pt', row), kind = $('.row__kind', row);
      function preview() { cap.textContent = it.title_pt || it.title || ''; }
      en.value = it.title || ''; pt.value = it.title_pt || ''; den.value = it.desc || ''; dpt.value = it.desc_pt || '';
      [{ id: '', pt: 'Sem categoria' }].concat(cats).forEach(function (c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.pt || c.en; kind.appendChild(o); });
      kind.value = ids(cats).indexOf(it.kind) >= 0 ? it.kind : '';
      preview();
      en.addEventListener('input', function () { it.title = en.value; note = null; preview(); refresh(); });
      pt.addEventListener('input', function () { it.title_pt = pt.value; note = null; preview(); refresh(); });
      den.addEventListener('input', function () { it.desc = den.value; note = null; refresh(); });
      dpt.addEventListener('input', function () { it.desc_pt = dpt.value; note = null; refresh(); });
      kind.addEventListener('change', function () { it.kind = kind.value; note = null; drawKinds(); refresh(); });
      // fotos extras: miniaturas com um botão de tirar, e o botão de adicionar mais
      var moreEl = $('.row__more', row), addIn = $('.row__files', row);
      (it.more || []).forEach(function (m, k) {
        var w = document.createElement('div'), img = document.createElement('img'), x = document.createElement('button');
        w.className = 'row__x' + (m._new ? ' is-new' : '');
        img.alt = ''; img.loading = 'lazy'; img.src = m._url || RAW + (m.thumb || m.src);
        // a foto também "atende" ao toque, sem fazer nada: sem isso, o celular puxa para o × ao lado um toque que caiu na foto
        img.addEventListener('click', function () {});
        x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Tirar a foto extra ' + (k + 1));
        x.addEventListener('click', function () { dropExtra(it, k); });
        w.appendChild(img); w.appendChild(x); moreEl.appendChild(w);
      });
      var pics = 1 + (it.more || []).length, full = pics >= MAX_PICS, addLabel = $('.row__add', row);
      addLabel.classList.toggle('is-full', full); addIn.disabled = full;
      $('.row__add-text', row).textContent = full ? MAX_PICS + ' de ' + MAX_PICS + ' imagens (o máximo)' : '+ Fotos extras (' + pics + ' de ' + MAX_PICS + ')';
      addIn.addEventListener('change', function () { addExtras(it, addIn.files); addIn.value = ''; });
      // arrastar pelo ⠿ para mudar a ordem (no celular, ficam as setas)
      // (o cartão inteiro é arrastado, mas só quando o arrasto começa no ⠿: assim dá para selecionar texto nos campos)
      var grip = $('.row__grip', row);
      // o navegador decide se dá para arrastar no instante do clique: o cartão vira arrastável já com o cursor sobre o ⠿
      grip.addEventListener('pointerenter', function () { if (!busy) row.setAttribute('draggable', 'true'); });
      grip.addEventListener('pointerleave', function (e) { if (!(e.buttons & 1) && !row.classList.contains('is-dragging')) row.removeAttribute('draggable'); });
      row.addEventListener('dragstart', function (e) {
        if (!row.hasAttribute('draggable')) return;
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-row', String(i)); row.classList.add('is-dragging');
      });
      row.addEventListener('dragend', function () { row.classList.remove('is-dragging'); row.removeAttribute('draggable'); });
      row.addEventListener('dragover', function (e) { if (e.dataTransfer.types.indexOf('text/x-row') < 0) return; e.preventDefault(); row.classList.add('is-target'); });
      row.addEventListener('dragleave', function () { row.classList.remove('is-target'); });
      row.addEventListener('drop', function (e) {
        var from = parseInt(e.dataTransfer.getData('text/x-row'), 10);
        row.classList.remove('is-target');
        if (isNaN(from)) return;
        e.preventDefault(); e.stopPropagation();
        if (from === i || busy) return;
        var moved = items.splice(from, 1)[0]; items.splice(i, 0, moved); note = null; render();
      });
      var up = $('.row__up', row), down = $('.row__down', row);
      up.disabled = i === 0; down.disabled = i === items.length - 1;
      up.addEventListener('click', function () { move(i, -1); });
      down.addEventListener('click', function () { move(i, 1); });
      $('.row__del', row).addEventListener('click', function () { drop(i); });
      listEl.appendChild(row);
    });
    drawn = items.slice();
    noneEl.hidden = items.length > 0;
    drawKinds();
    refresh();
    back(s);
  }
  function move(i, d) { if (busy) return; var it = items.splice(i, 1)[0]; items.splice(i + d, 0, it); note = null; render(); }
  function drop(i) {
    if (busy) return;
    var it = items[i];
    if (!it._new && !window.confirm('Apagar este trabalho do portfólio? Ele sai do site quando você publicar.')) return;
    items.splice(i, 1);
    revoke(it);
    if (!it._new) [it.src, it.thumb, it.poster].forEach(gone);
    (it.more || []).forEach(function (m) { if (!m._new) [m.src, m.thumb].forEach(gone); });
    note = null; render();
  }

  // ---------- Categorias ----------
  // uma chave nova a partir do nome (sem acento, minúsculas e hífens), diferente das que já existem
  function catSlug(name) {
    var base = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'categoria';
    var id = base, n = 2;
    while (ids(cats).indexOf(id) >= 0) id = base + '-' + n++;
    return id;
  }
  function uses(c) { return items.filter(function (it) { return it.kind === c.id; }).length; }
  function catsLine() { return cats.length ? cats.length + (cats.length > 1 ? ' categorias: ' : ' categoria: ') + cats.map(function (c) { return c.pt || c.en; }).filter(Boolean).join(', ') : 'nenhuma'; }
  function kindsChanged() { note = null; kindsSum.textContent = catsLine(); refresh(); }
  // o nome novo aparece na hora nos seletores dos trabalhos (sem redesenhar a lista, para não tirar o foco do campo)
  function syncOptions(c) { [].forEach.call(listEl.querySelectorAll('.row__kind option'), function (o) { if (o.value === c.id) o.textContent = c.pt || c.en || '…'; }); }
  function drawKinds(focus) {
    // quem está digitando no nome de uma categoria continua no mesmo campo, com o cursor no mesmo ponto
    var a = document.activeElement, keep = null;
    if (!focus && a && kindsList.contains(a)) {
      keep = { i: [].indexOf.call(kindsList.children, a.closest('.kind')), sel: '.' + a.className.split(' ')[0] };
      try { if (typeof a.selectionStart === 'number') { keep.from = a.selectionStart; keep.to = a.selectionEnd; } } catch (e) {}
    }
    kindsList.textContent = '';
    cats.forEach(function (c, i) {
      var li = document.createElement('li'), ptIn = document.createElement('input'), enIn = document.createElement('input'), n = document.createElement('span');
      var up = document.createElement('button'), down = document.createElement('button'), del = document.createElement('button'), k = uses(c);
      li.className = 'kind';
      [[ptIn, 'kind__pt', c.pt, 'em português'], [enIn, 'kind__en', c.en, 'em inglês']].forEach(function (f) {
        f[0].type = 'text'; f[0].className = f[1]; f[0].value = f[2] || ''; f[0].maxLength = MAX_CAT; f[0].autocomplete = 'off';
        f[0].setAttribute('aria-label', 'Nome da categoria ' + (i + 1) + ' ' + f[3]); f[0].placeholder = 'Nome ' + f[3];
      });
      n.className = 'kind__n'; n.textContent = k ? k + (k > 1 ? ' trabalhos' : ' trabalho') : 'sem trabalhos';
      [[up, 'kind__up', '↑', 'Subir a categoria'], [down, 'kind__down', '↓', 'Descer a categoria'], [del, 'kind__del', 'Apagar', 'Apagar a categoria']].forEach(function (b) {
        b[0].type = 'button'; b[0].className = b[1]; b[0].textContent = b[2]; b[0].setAttribute('aria-label', b[3] + ' ' + (c.pt || c.en));
      });
      up.disabled = busy || i === 0; down.disabled = busy || i === cats.length - 1; del.disabled = busy;
      ptIn.addEventListener('input', function () { c.pt = ptIn.value; syncOptions(c); kindsChanged(); });
      enIn.addEventListener('input', function () { c.en = enIn.value; kindsChanged(); });
      up.addEventListener('click', function () { moveKind(i, -1); });
      down.addEventListener('click', function () { moveKind(i, 1); });
      del.addEventListener('click', function () { dropKind(i); });
      [ptIn, enIn, n, up, down, del].forEach(function (el) { li.appendChild(el); });
      kindsList.appendChild(li);
    });
    kindsSum.textContent = catsLine();
    kindsForm.querySelector('button').disabled = cats.length >= MAX_CATS;
    var f = focus || keep, row = f && kindsList.children[Math.max(0, Math.min(f.i, cats.length - 1))], el = row && row.querySelector(f.sel);
    if (row && (!el || el.disabled)) el = row.querySelector('.kind__del');
    if (el) { el.focus({ preventScroll: true }); if (keep && keep.from !== undefined && el.setSelectionRange) { try { el.setSelectionRange(keep.from, keep.to); } catch (e) {} } }
    else if (f) kindsPt.focus();
  }
  function moveKind(i, d) { if (busy) return; var c = cats.splice(i, 1)[0]; cats.splice(i + d, 0, c); note = null; render(); drawKinds({ i: i + d, sel: d < 0 ? '.kind__up' : '.kind__down' }); }
  function dropKind(i) {
    if (busy) return;
    var c = cats[i], k = uses(c), name = c.pt || c.en;
    if (!window.confirm(k ? 'A categoria "' + name + '" tem ' + k + (k > 1 ? ' trabalhos. Eles ficam sem categoria. Apagar mesmo?' : ' trabalho. Ele fica sem categoria. Apagar mesmo?') : 'Apagar a categoria "' + name + '"?')) return;
    cats.splice(i, 1);
    items.forEach(function (it) { if (it.kind === c.id) it.kind = ''; });
    note = null; render(); drawKinds({ i: i, sel: '.kind__del' });
  }
  kindsForm.addEventListener('submit', function (e) {
    e.preventDefault();
    kindsMsg.className = 'msg msg--kinds';
    if (busy) { kindsMsg.textContent = WAIT; return; }
    var p = text(kindsPt.value, MAX_CAT), en = text(kindsEn.value, MAX_CAT), name = (p || en).toLowerCase();
    if (!name) { kindsMsg.textContent = 'Escreva o nome da categoria.'; kindsPt.focus(); return; }
    if (cats.length >= MAX_CATS) { kindsMsg.textContent = 'O limite é de ' + MAX_CATS + ' categorias. Apague uma para criar outra.'; return; }
    if (cats.some(function (c) { return String(c.pt || '').toLowerCase() === name || String(c.en || '').toLowerCase() === name; })) { kindsMsg.textContent = 'Já existe uma categoria com esse nome.'; return; }
    cats.push({ id: catSlug(p || en), pt: p || en, en: en || p });
    kindsPt.value = ''; kindsEn.value = '';
    kindsMsg.className = 'msg msg--kinds is-ok'; kindsMsg.textContent = 'Categoria criada. Escolha ela nos trabalhos abaixo e clique em Publicar.';
    note = null; render(); kindsPt.focus();
  });

  // ---------- Barra: o que falta publicar ----------
  function summary() {
    var fresh = items.filter(function (it) { return it._new; }).length, parts = [], pics = 0;
    items.forEach(function (it) { (it.more || []).forEach(function (m) { if (m._new) pics++; }); });
    var before = {}; try { JSON.parse(remoteJson).items.forEach(function (it) { before[it.src] = 1; }); } catch (e) {}
    var gone = Object.keys(before).filter(function (src) { return !items.some(function (it) { return it.src === src; }); }).length;
    if (fresh) parts.push(fresh + (fresh > 1 ? ' novos' : ' novo'));
    if (gone) parts.push(gone + (gone > 1 ? ' apagados' : ' apagado'));
    if (pics) parts.push(pics + (pics > 1 ? ' fotos extras novas' : ' foto extra nova'));
    if (goneExtras) parts.push(goneExtras + (goneExtras > 1 ? ' fotos extras apagadas' : ' foto extra apagada'));
    var catsBefore = ''; try { catsBefore = JSON.stringify(JSON.parse(remoteJson).categories); } catch (e) {}
    if (JSON.stringify(cleanCats(cats)) !== catsBefore) parts.push('categorias alteradas');
    if (!parts.length) parts.push('textos, categorias, fotos ou ordem alterados');
    return parts.join(', ');
  }
  function refresh() {
    var changed = dirty();
    publishBtn.disabled = busy || pending > 0 || !changed; discardBtn.disabled = busy || pending > 0 || !changed;
    if (busy) return;
    meterEl.hidden = true;
    if (pending) { stateEl.className = 'bar__state'; stateEl.textContent = 'Preparando os arquivos... O Publicar fica liberado quando terminar.'; return; }
    if (note) { stateEl.className = 'bar__state ' + note.kind; stateEl.textContent = note.text; return; }
    stateEl.className = 'bar__state';
    stateEl.textContent = changed ? 'Ainda não publicado: ' + summary() + '.' : (items.length ? 'Tudo publicado.' : 'Portfólio vazio.');
  }
  function progress(text, part) { stateEl.className = 'bar__state'; stateEl.textContent = text; meterEl.hidden = false; meterFill.style.width = Math.round(part * 100) + '%'; }

  // ---------- Publicar: um commit só ----------
  function message() {
    var s = summary();
    return 'Portfólio: ' + s + ' (pelo painel)';
  }
  // job: o que foi decidido no clique em Publicar (o texto de portfolio.json, os arquivos novos, os que saem e a mensagem)
  function commit(job, attempt) {
    var head;
    // a conferência vale para cada tentativa: o portfólio no commit em que este vai entrar tem de ser o que o painel conhece
    return current().then(function (sha) {
      head = sha;
      return gh('GET', '/git/commits/' + head);
    }).then(function (c) {
      var tree = [{ path: 'portfolio.json', mode: '100644', type: 'blob', content: job.body }];
      job.files.forEach(function (f) { tree.push({ path: f.path, mode: '100644', type: 'blob', sha: f.sha }); });
      job.gone.forEach(function (p) { tree.push({ path: p, mode: '100644', type: 'blob', sha: null }); });   // sha nulo = apagar o arquivo
      return gh('POST', '/git/trees', { base_tree: c.tree.sha, tree: tree });
    }).then(function (t) {
      return gh('POST', '/git/commits', { message: job.message, tree: t.sha, parents: [head] });
    }).then(function (c) {
      return gh('PATCH', '/git/refs/heads/' + BRANCH, { sha: c.sha, force: false });
    }).catch(function (err) {
      // a branch andou enquanto publicávamos (outro commit entrou): refaz o commit em cima da versão nova (se o portfólio nela não mudou)
      if (err.status === 422 && attempt < 3 && /fast.forward/i.test(err.message)) return commit(job, attempt + 1);
      throw err;
    });
  }
  function publish() {
    if (busy || pending || !dirty()) return;
    // Vai ao ar exatamente o que está na tela no instante do clique. O que for digitado durante o envio fica para a próxima vez.
    var catList = cleanCats(cats), list = items.map(function (it) { return clean(it, ids(catList)); });
    var job = { body: toJson(list, catList), files: [], gone: [], message: message() }, fresh = [], keep = {};
    var was = removed.slice(), extras = goneExtras, sent = 0, chain;
    items.forEach(function (it) {
      if (it._new) fresh.push(it);
      (it._files || []).forEach(function (f) { job.files.push(f); });
      (it.more || []).forEach(function (m) { if (m._new) fresh.push(m); (m._files || []).forEach(function (f) { job.files.push(f); }); });
    });
    // só apaga o arquivo que nenhum trabalho da lista nova usa (o mesmo arquivo pode estar em dois trabalhos, se a lista foi editada à mão)
    list.forEach(function (it) { [it.src, it.thumb, it.poster].forEach(function (p) { keep[p] = 1; }); (it.more || []).forEach(function (m) { keep[m.src] = keep[m.thumb] = 1; }); });
    job.gone = removed.filter(function (p) { return !keep[p]; });
    busy = true; note = null; refresh();
    progress('Conferindo a versão que está no site...', 0.03);
    // 1. alguém mudou o portfólio por outro aparelho depois que este painel abriu? Então nem envia os arquivos (o commit confere de novo)
    chain = current();
    // 2. envia cada arquivo novo (o que já subiu numa tentativa anterior não sobe de novo)
    job.files.forEach(function (f, i) {
      chain = chain.then(function () {
        progress('Enviando arquivo ' + (i + 1) + ' de ' + job.files.length + ' (' + mb(f.blob.size) + ')...', 0.05 + 0.8 * sent / Math.max(1, job.files.length));
        if (f.sha) { sent++; return; }
        return base64(f.blob).then(function (data) { return gh('POST', '/git/blobs', { content: data, encoding: 'base64' }); }).then(function (res) { f.sha = res.sha; sent++; });
      });
    });
    // 3. grava tudo de uma vez
    chain.then(function () {
      progress('Gravando no site...', 0.9);
      return commit(job, 0);
    }).then(function () {
      // publicado o que estava no clique: só isso deixa de ser novo
      fresh.forEach(function (x) { x._new = false; x._files = null; });
      removed = removed.filter(function (p) { return was.indexOf(p) < 0; }); goneExtras -= extras;
      remoteJson = job.body; busy = false;
      note = { kind: 'is-ok', text: 'Publicado. O site mostra as mudanças em 1 a 2 minutos.' + (dirty() ? ' O que você mudou durante o envio ainda falta publicar.' : '') };
      render();
    }, function (err) {
      busy = false;
      note = { kind: 'is-bad', text: err.changed ? 'O portfólio foi alterado por outro aparelho depois que você abriu o painel. Recarregue a página para ver a versão atual antes de publicar.' : explain(err) + ' Nada foi perdido: é só tentar de novo.' };
      refresh();
    });
  }
  publishBtn.addEventListener('click', publish);
  discardBtn.addEventListener('click', function () {
    if (busy || pending || !window.confirm('Descartar tudo o que ainda não foi publicado?')) return;
    busy = true; refresh();              // enquanto a lista publicada não chega, nada entra (seria jogado fora)
    stateEl.className = 'bar__state'; stateEl.textContent = 'Buscando a versão publicada...';
    load().then(function () { busy = false; refresh(); }, function (err) { busy = false; note = { kind: 'is-bad', text: explain(err) }; refresh(); });
  });
  window.addEventListener('beforeunload', function (e) { if (token && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Começo ----------
  var saved = null; try { saved = localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch (e) {}
  if (!saved) show(false);
  else {
    waitEl.hidden = false;
    enter(saved).catch(function (err) {
      token = null; show(false);
      if (err.status === 401 || err.wide) forget();     // chave vencida, apagada ou de um tipo que o painel não aceita: não fica guardada
      loginMsg.className = 'msg'; loginMsg.textContent = err.status === 401 ? 'A chave guardada neste navegador venceu ou foi apagada. Entre com uma chave nova.' : explain(err);
      if (err.wide) howEl.open = true;
    });
  }
})();
