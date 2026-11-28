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
  var DIR = 'media/', FULL = 3840;         // pasta dos arquivos e lado maior, em px, da imagem inteira (3840: um print em 4K fica do tamanho original, bom para o zoom do site)
  // A miniatura (a imagem do cartão na grade, e a capa parada dos vídeos): o cartão é em pé e recorta a imagem, então quem
  // conta é o lado MENOR dela. Ela sai com 900 px no lado menor (até 2000 no maior): nítida em telas comuns e a 150%; o
  // site troca pela imagem inteira quando a tela pede mais (celular, telas de alta densidade). Antes era 1000 px no lado
  // maior: numa foto larga, a miniatura ficava com uns 500 px de altura e borrava no cartão.
  var THUMB_SHORT = 900, THUMB_LONG = 2000;
  function thumbSide(src) {
    var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    return Math.round(Math.max(w, h) * Math.min(1, THUMB_SHORT / Math.min(w, h), THUMB_LONG / Math.max(w, h)));
  }
  // A data do envio (AAAA-MM-DD, no dia de quem envia). Nos trabalhos de antes dela existir, vale a do código no nome do
  // arquivo da capa (é a hora do envio em base 36, os 8 primeiros caracteres; ver prepare). O site mostra essa data.
  function day(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function today() { return day(new Date()); }
  function fileDay(src) {
    var name = String(src || '').split(/[?#]/)[0].split('/').pop().replace(/\.[^.]+$/, ''), m = /-([0-9a-z]{9,})$/.exec(name), t = m ? parseInt(m[1].slice(0, 8), 36) : NaN;
    return t > Date.UTC(2024, 0, 1) && t < Date.now() + 864e5 ? day(new Date(t)) : '';
  }
  function dateOf(it) { return /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : it.type === 'youtube' ? '' : fileDay(it.src); }
  var MAX_VIDEO = 50 * 1024 * 1024;                                     // vídeos maiores que isso pesam demais para o visitante
  var MAX_TITLE = 90, MAX_DESC = 240;                                   // tamanho máximo dos títulos e das descrições
  // As categorias: o dono cria, renomeia (em português e em inglês), ordena e apaga. Vão para portfolio.json em
  // "categories"; cada trabalho guarda a chave (id) da sua em "kind". Enquanto o arquivo não tem a lista, valem estas
  // (as mesmas chaves dos tipos antigos; o site, em js/page.js, tem a mesma lista)
  var DEFAULT_CATS = [
    { id: 'map', pt: 'Environments', en: 'Environments' }, { id: 'model', pt: '3D', en: '3D' }, { id: 'texture', pt: 'Textures', en: 'Textures' }, { id: 'lighting', pt: 'VFX', en: 'VFX' },
    { id: 'script', pt: 'Systems', en: 'Systems' }, { id: 'ui', pt: 'UI/UX', en: 'UI/UX' }, { id: 'design', pt: 'Design', en: 'Design' }, { id: 'game', pt: 'Experiences', en: 'Experiences' },
    { id: 'ai', pt: 'AI Engineering', en: 'AI Engineering' }
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
    var d = dateOf(it); if (d) o.date = d;
    o.id = HRShare.idOf(it);     // o link do trabalho e a prévia dele (ver admin/share.js); trocar as imagens não muda
    var or = origOf(it.orig); if (or) o.orig = or;     // o registro do original (ver "O original")
    // fotos extras do trabalho: só imagens que estão em media/
    var more = (Array.isArray(it.more) ? it.more : []).filter(function (m) { return m && mine(m.src); }).map(function (m) {
      var x = { src: m.src }; if (mine(m.thumb)) x.thumb = m.thumb;
      var mo = origOf(m.orig); if (mo) x.orig = mo;
      return x;
    });
    if (more.length) o.more = more;
    return o;
  }
  // o registro do original de uma imagem, só se estiver certo: largura, altura, a impressão dos pixels (px) e, quando há, a do
  // arquivo publicado (file: o SHA-256 dos bytes dele, ver "O original")
  function origOf(o) {
    if (!o || typeof o !== 'object') return null;
    var w = Math.round(o.w), h = Math.round(o.h);
    if (!(w > 0 && h > 0 && w <= 30000 && h <= 30000) || !/^[0-9a-f]{64}$/.test(o.px || '')) return null;
    var out = { w: w, h: h, px: o.px };
    if (/^[0-9a-f]{64}$/.test(o.file || '')) out.file = o.file;
    return out;
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
  function dirty() { return json() !== remoteJson || !!icon; }      // icon: o ícone do site novo (ver "O ícone do site")
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
      verdict = {};
      dropIcon();
      render();
      checkAll();
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
  // Reduz uma imagem (ou um quadro de vídeo) para caber em "max" px no lado maior e grava SEM PERDA: WebP sem perda (o que o
  // Chrome e o Edge gravam com qualidade 1) ou, no navegador que não grava WebP, PNG. Com perda (o WebP 0,88 de antes), o
  // fundo liso de um render virava blocos e degraus, na miniatura e ao abrir: a compressão apagava a granulação fina que o
  // render põe para o degradê não fazer faixas. Só um arquivo sem perda acima de LOSSLESS_MAX (25 MB: foto enorme e muito
  // detalhada) vai em JPEG 0,95, e a conferência avisa que ele não é mais o original.
  var LOSSLESS_MAX = 25 * 1048576;
  function shrink(src, max) {
    var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    var k = Math.min(1, max / Math.max(w, h)), cv = document.createElement('canvas'), ctx;
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, cv.width, cv.height);
    function jpeg() {
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);   // JPEG não tem transparência
      return toBlob(cv, 'image/jpeg', 0.95);
    }
    return toBlob(cv, 'image/webp', 1).then(function (b) {
      if (b && (b.type === 'image/webp' || b.type === 'image/png') && b.size <= LOSSLESS_MAX) return b;     // sem WebP, vem PNG
      return jpeg();
    }).then(function (b) { if (!b) throw new Error('não consegui converter a imagem'); return b; });
  }
  function ext(blob) { return blob.type === 'image/webp' ? '.webp' : blob.type === 'image/png' ? '.png' : blob.type === 'image/gif' ? '.gif' : '.jpg'; }

  // ---------- O original: os pixels do arquivo, guardados sem mudar nada ----------
  // A impressão digital de uma imagem: o resumo (SHA-256) dos pixels dela do jeito que o navegador mostra (RGBA de 8 bits,
  // já na orientação certa). O painel tira a do arquivo escolhido e guarda em "orig" no portfolio.json, com a largura e a
  // altura; a conferência (mais abaixo) tira a do arquivo publicado: iguais, o site mostra exatamente os pixels do original.
  // Junto vai a impressão do arquivo que foi para o site ("file", o SHA-256 dos bytes dele), tirada quando o envio confere que
  // os pixels dele são os do original. Ela é a mais firme: não depende de como cada navegador abre a imagem (o perfil de cor
  // embutido, por exemplo, pode fazer um navegador arredondar uma cor de outro jeito e acusar diferença onde não há), e dá
  // para conferir até sem navegador (a conferência diária do GitHub, em tools/conferir-imagens.js). O registro fica no
  // portfolio.json, e o histórico do Git guarda todas as versões dele: não se perde nem é esquecido.
  function pixelsOf(src) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, cv = document.createElement('canvas'), ctx;
    cv.width = w; cv.height = h;
    ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    return { w: w, h: h, data: ctx.getImageData(0, 0, w, h).data };
  }
  function digest(data) {
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  function semiTransparent(data) { for (var i = 3; i < data.length; i += 4) if (data[i] !== 255 && data[i] !== 0) return true; return false; }
  // a impressão de um arquivo (o escolhido ou o publicado), aberta do mesmo jeito que no envio
  function printOf(blob) {
    return openImage(blob).then(function (img) {
      var p = pixelsOf(img); if (img.close) img.close();
      return digest(p.data).then(function (px) { return { w: p.w, h: p.h, px: px, data: p.data }; });
    });
  }
  // O arquivo do jeito que veio, só sem os metadados (onde ficam o lugar da foto, o aparelho, a data, o programa): PNG, WebP e
  // JPEG. Os pixels não são tocados, então ficam idênticos aos do original. JPEG girado pela informação de orientação não
  // entra assim (sem ela, apareceria deitado): vai pelo canvas, sem perda. Devolve null quando não dá.
  function u8(blob) { return bytes(blob).then(function (b) { return new Uint8Array(b); }); }
  function be32(u, at) { return ((u[at] << 24) | (u[at + 1] << 16) | (u[at + 2] << 8) | u[at + 3]) >>> 0; }
  function le32(u, at) { return (u[at] | (u[at + 1] << 8) | (u[at + 2] << 16) | (u[at + 3] << 24)) >>> 0; }
  function strip(file) {
    return u8(file).then(function (u) {
      var parts = [], at, n, t, type = '';
      if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) {                     // PNG: os pedaços de texto, EXIF e data saem
        type = 'image/png'; parts.push(u.subarray(0, 8)); at = 8;
        while (at + 12 <= u.length) {
          n = be32(u, at); t = String.fromCharCode(u[at + 4], u[at + 5], u[at + 6], u[at + 7]);
          if (at + 12 + n > u.length) return null;
          if (['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'].indexOf(t) < 0) parts.push(u.subarray(at, at + 12 + n));
          at += 12 + n;
          if (t === 'IEND') break;
        }
      } else if (u.length > 12 && String.fromCharCode(u[0], u[1], u[2], u[3]) === 'RIFF' && String.fromCharCode(u[8], u[9], u[10], u[11]) === 'WEBP') {   // WebP: saem EXIF e XMP
        type = 'image/webp'; at = 12;
        var body = [], size = 4;
        while (at + 8 <= u.length) {
          t = String.fromCharCode(u[at], u[at + 1], u[at + 2], u[at + 3]); n = le32(u, at + 4);
          var end = at + 8 + n + (n & 1);
          if (at + 8 + n > u.length) return null;
          if (t !== 'EXIF' && t !== 'XMP ') {
            var c = u.slice(at, Math.min(end, u.length));
            if (t === 'VP8X') c[8] &= ~0x0c;             // a marca de que há EXIF e XMP
            body.push(c); size += c.length;
          }
          at = end;
        }
        var head = new Uint8Array(12); head.set(u.subarray(0, 12)); head[4] = size & 255; head[5] = (size >> 8) & 255; head[6] = (size >> 16) & 255; head[7] = (size >>> 24) & 255;
        parts = [head].concat(body);
      } else if (u[0] === 0xff && u[1] === 0xd8) {                                                  // JPEG: saem o EXIF, o XMP, o IPTC e os comentários
        type = 'image/jpeg'; parts.push(u.subarray(0, 2)); at = 2;
        while (at + 4 <= u.length) {
          if (u[at] !== 0xff) return null;
          var m = u[at + 1];
          if (m === 0xd9 || m === 0xda) { parts.push(u.subarray(at)); break; }                     // o começo da imagem: daqui em diante, tudo igual
          if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { parts.push(u.subarray(at, at + 2)); at += 2; continue; }
          n = (u[at + 2] << 8) | u[at + 3];
          if (m === 0xe1 && orientation(u, at + 4, n - 2) > 1) return null;                         // foto girada pela orientação
          if (m !== 0xe1 && m !== 0xed && m !== 0xfe) parts.push(u.subarray(at, at + 2 + n));
          at += 2 + n;
        }
      } else return null;
      return new Blob(parts, { type: type });
    }).catch(function () { return null; });
  }
  // a orientação guardada no EXIF de um JPEG (1 = em pé, como está; sem a informação, 1)
  function orientation(u, at, len) {
    if (String.fromCharCode(u[at], u[at + 1], u[at + 2], u[at + 3]) !== 'Exif') return 1;
    var t = at + 6, le = u[t] === 0x49, r16 = function (p) { return le ? u[p] | (u[p + 1] << 8) : (u[p] << 8) | u[p + 1]; };
    var r32 = function (p) { return le ? le32(u, p) : be32(u, p); }, ifd = t + r32(t + 4), count;
    if (ifd + 2 > at + len) return 1;
    count = r16(ifd);
    for (var k = 0; k < count; k++) { var e = ifd + 2 + k * 12; if (e + 12 > at + len) break; if (r16(e) === 0x0112) return r16(e + 8); }
    return 1;
  }
  // A imagem inteira de um envio. Cabendo no FULL, o que vai para o site é o original, pixel por pixel:
  //   PNG sem partes semitransparentes: WebP sem perda (os mesmos pixels, uns 30% menor);
  //   PNG com partes semitransparentes (ícones, logos), WebP e JPEG: o próprio arquivo, sem os metadados (o canvas mexeria de
  //     leve na cor das partes semitransparentes, e regravar um JPEG em outro formato só o deixaria maior);
  //   o resto (AVIF, BMP...): WebP sem perda.
  // Depois, confere: o arquivo pronto, aberto de novo, tem de dar a mesma impressão do original. Passando do FULL, a imagem é
  // reduzida (e a conferência avisa que não é mais a original).
  function fullOf(file, img, orig) {
    var reduce = Math.max(orig.w, orig.h) > FULL, keep = !reduce && (/^image\/(webp|jpeg)$/.test(file.type) || (file.type === 'image/png' && orig.semi));
    function same(blob) { return printOf(blob).then(function (p) { return p.px === orig.px && p.w === orig.w && p.h === orig.h; }, function () { return false; }); }
    function canvas() {
      return shrink(img, FULL).then(function (b) {
        if (reduce) return { blob: b, check: 'reduced' };
        return same(b).then(function (ok) {
          if (ok) return { blob: b, check: 'ok' };
          return strip(file).then(function (s) {               // o canvas não guardou igual: vai o próprio arquivo, se der
            return s ? same(s).then(function (ok2) { return ok2 ? { blob: s, check: 'ok' } : { blob: b, check: 'different' }; }) : { blob: b, check: 'different' };
          });
        });
      });
    }
    if (!keep) return canvas();
    return strip(file).then(function (s) {
      if (!s || s.size > LOSSLESS_MAX) return canvas();
      return same(s).then(function (ok) { return ok ? { blob: s, check: 'ok' } : canvas(); });
    });
  }
  // A imagem da prévia do link (w/<id>.jpg, ver admin/share.js): 1200 x 630, recortada no meio, como o cartão grande do
  // Discord, do WhatsApp e do X. JPEG, que todos eles mostram.
  function ogShot(src) {
    var w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
    var cv = document.createElement('canvas'), ctx, s = Math.max(1200 / w, 630 / h);
    cv.width = 1200; cv.height = 630; ctx = cv.getContext('2d');
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, 1200, 630); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (1200 - w * s) / 2, (630 - h * s) / 2, w * s, h * s);
    return toBlob(cv, 'image/jpeg', 0.9);
  }
  // a prévia de um trabalho que já estava no site (de antes das prévias): a partir da imagem dele no GitHub
  function ogFrom(url) {
    return new Promise(function (ok, no) {
      var im = new Image();
      im.crossOrigin = 'anonymous';           // o GitHub libera; sem isso o navegador não deixaria gravar o recorte
      im.onload = function () { ogShot(im).then(ok, no); };
      im.onerror = no;
      im.src = url;
    });
  }
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
      v.onseeked = function () {
        if (!v.videoWidth) return end(null);
        Promise.all([shrink(v, thumbSide(v)), ogShot(v)]).then(function (r) { end({ poster: r[0], og: r[1] }); }, function () { end(null); });
      };
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
  // opts.cover: é a capa de um trabalho (e não uma foto extra): ganha o id (opts.id, ao trocar as imagens; senão, o código
  // do nome do arquivo) e a imagem da prévia do link, w/<id>.jpg
  function prepare(file, opts) {
    opts = opts || {};
    var key = Date.now().toString(36) + (serial++).toString(36), base = DIR + slug(file.name) + '-' + key;
    // imagem colada (Ctrl+V) chega com um nome genérico: aí o título fica para o dono escrever
    var it = { src: '', title: /^image\.(png|jpe?g|gif|webp)$/i.test(file.name) ? '' : words(file.name), title_pt: '', date: today(), _new: true, _files: [], _url: '' };
    if (opts.cover) it.id = opts.id || key;
    function og(blob) { if (opts.cover && blob) it._files.push({ path: 'w/' + it.id + '.jpg', blob: blob }); }
    if (/^video\//.test(file.type)) {
      if (!/^video\/(mp4|webm)$/.test(file.type)) return Promise.reject(new Error('use vídeo em MP4 ou WebM (este é ' + (file.type || 'de um formato desconhecido') + ').'));
      if (file.size > MAX_VIDEO) return Promise.reject(new Error('o vídeo tem ' + mb(file.size) + ' e o limite é 50 MB. Exporte em 1080p ou menos, ou corte um trecho mais curto.'));
      it.type = 'video'; it.src = base + (file.type === 'video/webm' ? '.webm' : '.mp4');
      return scrub(file).then(function (video) {
        it._files.push({ path: it.src, blob: video });
        return frame(video).then(function (shot) {
          if (shot) { it.poster = base + '-capa' + ext(shot.poster); it._files.push({ path: it.poster, blob: shot.poster }); it._url = URL.createObjectURL(shot.poster); og(shot.og); }
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
      // a impressão do original (ver "O original"): os pixels do arquivo escolhido, antes de qualquer conversão
      var p = pixelsOf(img), semi = semiTransparent(p.data);
      return digest(p.data).then(function (px) {
        p = null;                                   // os pixels já viraram a impressão: libera a memória antes de preparar
        var orig = { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height, px: px, semi: semi };
        return (gif ? Promise.resolve({ blob: file, check: 'ok' }) : fullOf(file, img, orig)).then(function (got) {
          var full = got.blob;
          // a impressão do arquivo que vai para o site, só quando ele tem os pixels do original
          return Promise.all([shrink(img, thumbSide(img)), opts.cover ? ogShot(img) : null, got.check === 'ok' ? bytes(full).then(digest) : null]).then(function (r) {
            var small = r[0];
            it.src = base + ext(full); it.thumb = base + '-mini' + ext(small);
            it._files.push({ path: it.src, blob: full }, { path: it.thumb, blob: small });
            og(r[1]);
            it._url = URL.createObjectURL(small);
            it.orig = { w: orig.w, h: orig.h, px: orig.px }; if (r[2]) it.orig.file = r[2]; it._check = got.check;
            if (img.close) img.close();
            return it;
          });
        });
      });
    });
  }
  // Prepara uma leva de arquivos, um por vez: check(arquivo) diz por que recusar (ou ''), each(item pronto) põe na lista.
  // Enquanto houver leva em preparo (pending), o Publicar fica desligado: senão a lista iria ao ar sem os arquivos que faltam.
  function batch(files, check, each, prep) {
    var problems = [], chain = Promise.resolve(), run = prep || function (file) { return prepare(file); };
    pending++; refresh();
    filesMsg.className = 'msg msg--files is-ok'; filesMsg.textContent = 'Preparando ' + files.length + (files.length > 1 ? ' arquivos...' : ' arquivo...');
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        var bad = check(file);
        if (bad) { problems.push(file.name + ': ' + bad); return; }
        return run(file, i).then(function (x) { each(x); note = null; render(); }, function (err) { problems.push(file.name + ': ' + err.message); });
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
    // os trabalhos novos entram no topo, na ordem em que foram escolhidos: no site, os mais recentes aparecem primeiro
    var at = 0;
    batch(files, function () { return ''; }, function (it) { items.splice(at++, 0, it); }, function (file) { return prepare(file, { cover: true }); }).then(function () { filesIn.value = ''; });
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
      it.more.push({ src: x.src, thumb: x.thumb, orig: x.orig, _check: x._check, _files: x._files, _url: x._url, _new: true });
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
    items.unshift({ type: 'youtube', src: src, id: id, title: '', title_pt: '', date: today(), _new: true, _files: [], _url: '' });      // no topo, como os outros novos
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
  var FIELDS = ['row__edit', 'row__title', 'row__title-pt', 'row__desc', 'row__desc-pt', 'row__kind', 'row__files', 'row__up', 'row__down', 'row__del'];
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
    listEl.textContent = ''; chips = [];
    items.forEach(function (it, i) {
      var row = rowTpl.content.firstElementChild.cloneNode(true), meta = $('.row__meta', row), size = 0;
      row.classList.toggle('is-new', !!it._new);
      $('.row__pic', row).appendChild(picture(it));
      // cada pedaço da linha num elemento: texto solto numa linha flexível vira um bloco só ("ImagemMapas3 fotos")
      function bit(text) { var x = document.createElement('span'); x.textContent = text; meta.appendChild(x); }
      bit(it.type === 'youtube' ? 'YouTube' : it.type === 'video' ? 'Vídeo' : 'Imagem');
      var cat = cats.filter(function (c) { return c.id === it.kind; })[0];
      if (cat) bit(cat.pt || cat.en);
      if ((it.more || []).length) bit((it.more.length + 1) + ' fotos');
      function tag(text) { var b = document.createElement('b'); b.textContent = text; meta.appendChild(b); }
      if (i === 0) tag('Destaque');
      var sent = dateOf(it); if (sent) bit('enviado em ' + sent.split('-').reverse().join('/'));
      if (it._new) { tag('Novo'); it._files.forEach(function (f) { size += f.blob.size; }); if (size) bit(mb(size)); }
      // a conferência das imagens (ver "A conferência das imagens publicadas"): o selo na linha, e cada imagem no trabalho aberto
      var chip = document.createElement('span'); chip.className = 'chk'; meta.appendChild(chip);
      chips.push({ it: it, chip: chip, list: $('.row__check', row) });
      var cmpIn = $('.row__compare-files', row), cmpOut = $('.row__compare-msg', row);
      $('.row__compare', row).hidden = it.type !== 'image';
      if (it._cmp) { cmpOut.textContent = it._cmp.text; cmpOut.classList.toggle('is-ok', it._cmp.ok); }
      cmpIn.addEventListener('change', function () { compare(it, cmpIn.files, cmpOut); cmpIn.value = ''; });
      var en = $('.row__title', row), pt = $('.row__title-pt', row), cap = $('.row__cap', row);
      var den = $('.row__desc', row), dpt = $('.row__desc-pt', row), kind = $('.row__kind', row);
      // Os trabalhos já publicados começam fechados (só a linha-resumo); os novos, abertos. O Editar abre e fecha (fica
      // lembrado enquanto o painel está aberto, mesmo quando a lista é redesenhada; não vai para o arquivo).
      var opened = it._open === undefined ? !!it._new : it._open, edit = $('.row__edit', row), sum = $('.row__sum', row);
      row.classList.toggle('is-closed', !opened);
      edit.textContent = opened ? 'Fechar' : 'Editar'; edit.setAttribute('aria-expanded', String(opened));
      edit.addEventListener('click', function () { it._open = !opened; render(); });
      function preview() {
        cap.textContent = it.title_pt || it.title || '';
        sum.textContent = it.title_pt || it.title || 'Sem título';
        edit.setAttribute('aria-label', (opened ? 'Fechar a edição de ' : 'Editar ') + (it.title_pt || it.title || 'este trabalho'));
      }
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
      var redoIn = $('.row__redo-files', row);
      $('.row__redo', row).hidden = it.type !== 'image';
      redoIn.addEventListener('change', function () { replaceImages(it, redoIn.files); redoIn.value = ''; });
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
    entries().forEach(function (x) { if (x.e._new && !verdict[x.e.src]) checkOne(x); });     // as novas: o que a preparação conferiu
    paintChips(); drawCheck();
    back(s);
  }
  // ---------- A conferência das imagens publicadas ----------
  // Para cada imagem inteira do site (a capa e as fotos extras de cada trabalho), o painel lê o arquivo publicado no próprio
  // site: o começo dele (64 KB) diz o formato (com ou sem perda) e o tamanho; com o registro do original ("orig", ver "O
  // original"), o arquivo inteiro é aberto e a impressão dos pixels dele tem de ser a do original. Imagem conferida fica
  // lembrada neste navegador (o arquivo de um endereço não muda: trocar as imagens cria outro), então só as novas são
  // baixadas. As de antes do registro (sem "orig") ficam com o formato e o tamanho; a prova pixel a pixel delas vem do
  // "Comparar com os originais" do trabalho, com os arquivos do computador (e aí o registro passa a existir).
  // As miniaturas dos cartões não entram: são menores de propósito (o site troca pela imagem inteira quando precisa).
  // A lembrança deste navegador vale só por um dia: depois disso, cada imagem é baixada e conferida de novo (antes, uma
  // imagem conferida uma vez nunca mais era baixada aqui, e uma troca do arquivo no mesmo endereço passaria sem aviso).
  // Com o painel aberto, a conferência inteira roda de novo a cada 24 horas. E todo dia o GitHub confere sozinho, sem
  // depender do painel (ver tools/conferir-imagens.js).
  var SEEN_KEY = 'hr-admin-originals', CHECKED_KEY = 'hr-admin-originals-at', DAY = 864e5, seen = {}, stamped = 0;
  try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { seen = {}; }
  function fresh(src, key) { var v = seen[src]; return !!v && typeof v === 'object' && v.k === key && Date.now() - v.at < DAY; }
  var verdict = {}, checking = false, checkAgain = false, chips = [], checkBox = $('.checker'), checkState = $('.checker__state'), checkBtn = $('.checker__again');
  function site(path) { return new URL('../' + path, location.href).href; }
  function remember(src, key) {
    seen[src] = { k: key, at: Date.now() };
    var keep = {}; entries().forEach(function (x) { if (seen[x.e.src]) keep[x.e.src] = seen[x.e.src]; });
    seen = keep; try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
  }
  // o formato e o tamanho de uma imagem, pelo começo do arquivo
  function formatOf(u) {
    var t = String.fromCharCode(u[0], u[1], u[2], u[3]), at, n, c, d, w = 0, h = 0, lossy = false, lossless = false;
    if (t === 'RIFF' && String.fromCharCode(u[8], u[9], u[10], u[11]) === 'WEBP') {
      at = 12;
      while (at + 8 <= u.length) {
        c = String.fromCharCode(u[at], u[at + 1], u[at + 2], u[at + 3]); n = le32(u, at + 4); d = at + 8;
        if (c === 'VP8X' && d + 10 <= u.length) { w = 1 + (u[d + 4] | (u[d + 5] << 8) | (u[d + 6] << 16)); h = 1 + (u[d + 7] | (u[d + 8] << 8) | (u[d + 9] << 16)); }
        else if (c === 'VP8L' && d + 5 <= u.length) { lossless = true; if (!w) { var b = le32(u, d + 1); w = (b & 0x3fff) + 1; h = ((b >>> 14) & 0x3fff) + 1; } }
        else if (c === 'VP8 ' && d + 10 <= u.length) { lossy = true; if (!w) { w = (u[d + 6] | (u[d + 7] << 8)) & 0x3fff; h = (u[d + 8] | (u[d + 9] << 8)) & 0x3fff; } }
        else if (c === 'ANMF' && d + 24 <= u.length) { var f = String.fromCharCode(u[d + 16], u[d + 17], u[d + 18], u[d + 19]); if (f === 'VP8 ') lossy = true; else if (f === 'VP8L') lossless = true; }
        at = d + n + (n & 1);
      }
      return { fmt: lossy ? 'WebP com perda' : 'WebP sem perda', lossless: lossless && !lossy, w: w, h: h };
    }
    if (u[0] === 0x89 && t.slice(1) === 'PNG') return { fmt: 'PNG', lossless: true, w: be32(u, 16), h: be32(u, 20) };
    if (t.slice(0, 3) === 'GIF') return { fmt: 'GIF', lossless: true, w: u[6] | (u[7] << 8), h: u[8] | (u[9] << 8) };
    if (u[0] === 0xff && u[1] === 0xd8) {
      for (at = 2; at + 9 < u.length;) {
        if (u[at] !== 0xff) { at++; continue; }
        var m = u[at + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { fmt: 'JPEG', lossless: false, jpeg: true, w: (u[at + 7] << 8) | u[at + 8], h: (u[at + 5] << 8) | u[at + 6] };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { at += m === 0xff ? 1 : 2; continue; }
        at += 2 + ((u[at + 2] << 8) | u[at + 3]);
      }
      return { fmt: 'JPEG', lossless: false, jpeg: true, w: 0, h: 0 };
    }
    return { fmt: 'formato desconhecido', lossless: false, w: 0, h: 0 };
  }
  function fileHead(path) {
    return fetch(site(path), { headers: { Range: 'bytes=0-65535' }, cache: 'no-store' }).then(function (res) {
      if (res.status === 404) { var e = new Error('ainda não está no site'); e.missing = true; throw e; }
      if (!res.ok) throw new Error('o site respondeu ' + res.status);
      return res.arrayBuffer();
    }).then(function (buf) { return formatOf(new Uint8Array(buf)); });
  }
  function fileWhole(e) {        // o arquivo inteiro: o publicado, ou o preparado no painel (ainda não publicado)
    if (e._new && e._files && e._files[0]) return Promise.resolve(e._files[0].blob);
    return fetch(site(e.src), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status === 404 ? 'ainda não está no site' : 'o site respondeu ' + r.status); return r.blob(); });
  }
  function dims(o) { return o.w + ' × ' + o.h; }
  // as imagens inteiras de cada trabalho (a capa e as fotos extras), na ordem
  function entries() {
    var out = [];
    items.forEach(function (it) {
      if (it.type === 'youtube') return;
      out.push({ it: it, e: it, label: 'Capa' });
      (it.more || []).forEach(function (m, k) { out.push({ it: it, e: m, label: 'Foto ' + (k + 2) }); });
    });
    return out;
  }
  function checkOne(x) {
    var e = x.e, src = e.src, o = origOf(e.orig);
    if (x.it.type === 'video' && e === x.it) { verdict[src] = { s: 'ok', t: 'vídeo: vai para o site como foi enviado' }; return Promise.resolve(); }
    if (e._new) {
      verdict[src] = e._check === 'ok' ? { s: 'ok', t: 'original: os mesmos pixels do arquivo escolhido (conferido ao preparar)' }
        : e._check === 'reduced' ? { s: 'bad', t: 'reduzida: o original tem ' + (o ? dims(o) : '?') + ' e passa do limite de ' + FULL + ' px do painel' }
        : { s: 'bad', t: 'não ficou igual ao original ao preparar: envie de novo em PNG' };
      return Promise.resolve();
    }
    verdict[src] = { s: 'wait', t: 'conferindo…' }; paintChips();
    return fileHead(src).then(function (head) {
      if (!o) {
        if (!head.lossless && !head.jpeg) { verdict[src] = { s: 'bad', t: 'com perda (' + head.fmt + '): envie o original de novo em “Trocar as imagens”' }; return; }
        if (head.jpeg) { verdict[src] = { s: 'warn', t: 'JPEG, ' + dims(head) + ': pode ser o original ou uma cópia com perda. Compare com o arquivo para saber' }; return; }
        if (Math.max(head.w, head.h) >= 3200) { verdict[src] = { s: 'warn', t: head.fmt + ', ' + dims(head) + ': está no tamanho-limite antigo do painel, pode ter sido reduzida. Compare com o arquivo para saber' }; return; }
        verdict[src] = { s: 'lossless', t: head.fmt + ', ' + dims(head) + ': sem perda e no tamanho em que foi enviada (enviada antes do registro: a prova pixel a pixel vem do “Comparar com os originais”)' };
        return;
      }
      if (head.w !== o.w || head.h !== o.h) { verdict[src] = { s: 'bad', t: 'reduzida: o original tem ' + dims(o) + ' e o site, ' + dims(head) }; return; }
      var okFile = 'original: ' + head.fmt + ', ' + dims(head) + ', o mesmo arquivo conferido pixel a pixel no envio';
      if (o.file) {                 // os bytes do site têm de ser os do arquivo conferido no envio (não depende do navegador)
        if (fresh(src, 'f:' + o.file)) { verdict[src] = { s: 'ok', t: okFile }; return; }
        return fileWhole(e).then(bytes).then(digest).then(function (f) {
          if (f === o.file) { verdict[src] = { s: 'ok', t: okFile }; remember(src, 'f:' + o.file); }
          else verdict[src] = { s: 'bad', t: 'o arquivo do site não é mais o que foi conferido no envio. Envie o original de novo em “Trocar as imagens”' };
        });
      }
      if (fresh(src, o.px)) { verdict[src] = { s: 'ok', t: 'original: ' + head.fmt + ', ' + dims(head) + ', os mesmos pixels do arquivo enviado' }; return; }
      return fileWhole(e).then(function (blob) { return Promise.all([printOf(blob), bytes(blob).then(digest)]); }).then(function (r) {
        if (r[0].px === o.px) {
          verdict[src] = { s: 'ok', t: 'original: ' + head.fmt + ', ' + dims(head) + ', os mesmos pixels do arquivo enviado' }; remember(src, o.px);
          e.orig = { w: o.w, h: o.h, px: o.px, file: r[1] }; stamped++;       // ganha a impressão do arquivo (vai no próximo Publicar)
        }
        else verdict[src] = { s: 'bad', t: 'diferente do original: os pixels do site não são os do arquivo enviado. Envie de novo em “Trocar as imagens”' };
      });
    }).catch(function (err) {
      verdict[src] = err.missing ? { s: 'wait', t: 'ainda não está no site (o site leva 1 a 2 minutos depois de publicar): confira de novo daqui a pouco' } : { s: 'error', t: 'não deu para conferir agora (' + err.message + ')' };
    });
  }
  function checkAll(force) {
    if (checking) { checkAgain = true; return; }
    if (force) { entries().forEach(function (x) { delete seen[x.e.src]; }); try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {} }
    checking = true; stamped = 0;
    var list = entries(), done = 0;
    drawCheck(0, list.length);
    list.reduce(function (c, x) {
      return c.then(function () {
        if (items.indexOf(x.it) < 0) return;          // o trabalho saiu da lista enquanto isso
        return checkOne(x).then(function () { done++; paintChips(); drawCheck(done, list.length); });
      });
    }, Promise.resolve()).then(finish, finish);
    function finish() {
      checking = false;
      try { localStorage.setItem(CHECKED_KEY, String(Date.now())); } catch (e) {}
      if (stamped) refresh();          // o registro mais firme vai para o site no próximo Publicar
      paintChips(); drawCheck();
      if (checkAgain) { checkAgain = false; checkAll(); }
    }
  }
  // o resumo em cima da lista
  function drawCheck(done, total) {
    if (!checkBox) return;
    var list = entries(), n = { ok: 0, lossless: 0, warn: 0, bad: 0, wait: 0, error: 0 };
    checkBox.hidden = !list.length;
    if (checking && total) { checkState.className = 'checker__state'; checkState.textContent = 'Conferindo as imagens do site: ' + done + ' de ' + total + '...'; checkBtn.disabled = true; return; }
    checkBtn.disabled = false;
    list.forEach(function (x) { var v = verdict[x.e.src]; n[v ? v.s : 'wait']++; });
    var all = list.length, parts = [];
    if (n.bad) parts.push('Atenção: ' + n.bad + (n.bad > 1 ? ' imagens não estão originais' : ' imagem não está original') + '. O aviso está no trabalho.');
    if (n.warn) parts.push(n.warn + (n.warn > 1 ? ' imagens precisam' : ' imagem precisa') + ' ser comparadas com o arquivo para ter certeza.');
    if (n.ok === all) parts.push((all > 1 ? 'Todas as ' + all + ' imagens do site são as originais' : 'A imagem do site é a original') + ': sem perda, no tamanho em que foram enviadas e com os mesmos pixels dos arquivos.');
    else if (!n.bad && !n.warn && n.ok + n.lossless === all) parts.push((all > 1 ? 'As ' + all + ' imagens do site estão' : 'A imagem do site está') + ' sem perda e no tamanho em que foram enviadas. ' + (n.ok ? n.ok + ' com a prova pixel a pixel; ' : '') + n.lossless + (n.lossless > 1 ? ' foram enviadas' : ' foi enviada') + ' antes do registro: para a prova pixel a pixel delas, use “Comparar com os originais” no trabalho.');
    if (n.wait) parts.push(n.wait + (n.wait > 1 ? ' ainda não puderam' : ' ainda não pôde') + ' ser conferidas (veja no trabalho).');
    if (n.error) parts.push(n.error + ' não deram para conferir agora: tente “Conferir de novo”.');
    if (stamped) parts.push((stamped > 1 ? stamped + ' imagens ganharam' : '1 imagem ganhou') + ' também a impressão do arquivo no registro do original (a conferência mais firme, que não depende do navegador): ela vai para o site no próximo Publicar.');
    var at = 0; try { at = +localStorage.getItem(CHECKED_KEY) || 0; } catch (e) {}
    if (at) parts.push('Conferido em ' + new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '.');
    checkState.className = 'checker__state' + (n.bad ? ' is-bad' : n.ok === all ? ' is-ok' : '');
    checkState.textContent = parts.join(' ');
  }
  // o selo de cada trabalho e a lista de cada imagem dele (no trabalho aberto)
  function paintChips() {
    chips.forEach(function (c) {
      var mineList = entries().filter(function (x) { return x.it === c.it; }), st = mineList.map(function (x) { return verdict[x.e.src]; });
      var bad = st.filter(function (v) { return v && v.s === 'bad'; }).length, warn = st.filter(function (v) { return v && v.s === 'warn'; }).length;
      var wait = st.filter(function (v) { return !v || v.s === 'wait' || v.s === 'error'; }).length, ok = st.filter(function (v) { return v && v.s === 'ok'; }).length;
      c.chip.className = 'chk ' + (bad ? 'chk--bad' : warn ? 'chk--warn' : wait ? 'chk--wait' : 'chk--ok');
      c.chip.textContent = !mineList.length ? '' : bad ? '⚠ ' + (bad > 1 ? bad + ' imagens não originais' : '1 imagem não original') : warn ? 'Comparar com o original' : wait ? (checking ? 'Conferindo as imagens…' : 'Imagens não conferidas') : ok === st.length ? (st.length > 1 ? 'Imagens originais ✓' : 'Imagem original ✓') : 'Sem perda ✓';
      c.chip.hidden = !mineList.length;
      c.list.textContent = '';
      mineList.forEach(function (x) {
        var v = verdict[x.e.src], li = document.createElement('li');
        li.className = 'chk-' + (v ? v.s : 'wait'); li.textContent = x.label + ': ' + (v ? v.t : 'ainda não conferida');
        c.list.appendChild(li);
      });
    });
  }
  if (checkBtn) checkBtn.addEventListener('click', function () { checkAll(true); });
  // com o painel aberto, a conferência inteira roda de novo a cada 24 horas
  setInterval(function () {
    var at = 0; try { at = +localStorage.getItem(CHECKED_KEY) || 0; } catch (e) {}
    if (token && !busy && !checking && entries().length && Date.now() - at >= DAY) checkAll();
  }, 3600e3);
  // Comparar com os originais: os arquivos do computador contra as imagens do trabalho, pixel por pixel. Achando o mesmo
  // arquivo, a imagem ganha o registro do original (vai para o site no próximo Publicar), e daí em diante a conferência é
  // automática.
  function compare(it, fileList, out) {
    var files = [].slice.call(fileList).filter(function (f) { return /^image\//.test(f.type); }), list = entries().filter(function (x) { return x.it === it; }), lines = [], pub = [], picked = [], changed = 0;
    if (!files.length || !list.length) return;
    it._cmp = null; out.className = 'row__compare-msg'; out.textContent = 'Comparando ' + files.length + (files.length > 1 ? ' arquivos' : ' arquivo') + ' com as ' + list.length + ' imagens do trabalho...';
    var chain = list.reduce(function (c, x) { return c.then(function () { return fileWhole(x.e).then(function (blob) { return Promise.all([printOf(blob), bytes(blob).then(digest)]); }).then(function (r) { r[0].file = r[1]; pub.push({ x: x, p: r[0] }); }, function (err) { pub.push({ x: x, err: err }); }); }); }, Promise.resolve());
    chain = chain.then(function () { return files.reduce(function (c, f) { return c.then(function () { return printOf(f).then(function (p) { picked.push({ f: f, p: p }); }, function () {}); }); }, Promise.resolve()); });
    chain.then(function () {
      // 1. as idênticas, pixel por pixel (cada arquivo escolhido vale para uma imagem só)
      var used = [], res = pub.map(function (a) {
        if (a.err) return { a: a, text: a.x.label + ': não deu para abrir a do site (' + a.err.message + ')' };
        var same = picked.filter(function (b) { return used.indexOf(b) < 0 && b.p.px === a.p.px; })[0];
        if (!same) return { a: a };
        used.push(same);
        verdict[a.x.e.src] = { s: 'ok', t: 'original: idêntica ao arquivo “' + same.f.name + '”, pixel por pixel' };
        if (!origOf(a.x.e.orig) || a.x.e.orig.px !== a.p.px || a.x.e.orig.file !== a.p.file) { a.x.e.orig = { w: a.p.w, h: a.p.h, px: a.p.px, file: a.p.file }; changed++; }
        remember(a.x.e.src, a.p.px);
        return { a: a, text: a.x.label + ': idêntica a “' + same.f.name + '”, pixel por pixel ✓' };
      });
      // 2. as outras: entre os arquivos que sobraram, um que seja a mesma imagem com alguma mudança (do mesmo tamanho), ou a
      //    mesma imagem maior (então a do site foi reduzida). Arquivo de outra imagem, mesmo do mesmo tamanho, não conta.
      function near(A, B) {         // quanto B difere de A: os pixels que mudaram, a maior mudança e a média
        var diff = 0, top = 0, big = 0, sum = 0, n = A.length / 4;
        for (var i = 0; i < A.length; i += 4) {
          var d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]), Math.abs(A[i + 3] - B[i + 3]));
          if (d) { diff++; sum += d; if (d > top) top = d; if (d > 32) big++; }
        }
        return { pct: 100 * diff / n, top: top, mean: sum / n, big: 100 * big / n };
      }
      function pct(v) { return v < 0.1 ? 'menos de 0,1' : v.toFixed(1).replace('.', ','); }
      function same(st) { return st.mean < 6 && st.big < 10; }        // a mesma imagem, com poucas mudanças
      var fuzzy = res.reduce(function (c, r) {
        return c.then(function () {
          if (r.text) return;
          var a = r.a, x = a.x, best = null;
          picked.forEach(function (b) {
            if (used.indexOf(b) >= 0 || b.p.w !== a.p.w || b.p.h !== a.p.h) return;
            var st = near(a.p.data, b.p.data); if (same(st) && (!best || st.mean < best.st.mean)) best = { b: b, st: st };
          });
          if (best) {
            used.push(best.b);
            var o = origOf(x.e.orig), okRec = o && o.px === a.p.px, st = best.st;
            r.text = x.label + ': “' + best.b.f.name + '” é a mesma imagem com mudanças: ' + pct(st.pct) + '% dos pixels diferentes, até ' + st.top + (st.top > 1 ? ' tons' : ' tom') + (okRec ? ' (a do site confere com o original registrado: o arquivo escolhido é que mudou)' : '');
            if (!okRec) verdict[x.e.src] = { s: st.top <= 1 ? 'warn' : 'bad', t: 'diferente de “' + best.b.f.name + '”: ' + pct(st.pct) + '% dos pixels mudaram, até ' + st.top + (st.top > 1 ? ' tons' : ' tom') };
            return;
          }
          // um arquivo maior, na mesma proporção: reduzido ao tamanho da do site, é a mesma imagem?
          var bigger = picked.filter(function (b) { return used.indexOf(b) < 0 && b.p.w > a.p.w && Math.abs(b.p.w / b.p.h - a.p.w / a.p.h) < 0.01; });
          return bigger.reduce(function (c2, b) {
            return c2.then(function () {
              if (r.text) return;
              return createImageBitmap(b.f, { imageOrientation: 'from-image', resizeWidth: a.p.w, resizeHeight: a.p.h, resizeQuality: 'high' }).then(function (bm) {
                var q = pixelsOf(bm); if (bm.close) bm.close();
                if (!same(near(a.p.data, q.data))) return;
                used.push(b);
                r.text = x.label + ': o arquivo “' + b.f.name + '” é esta imagem, maior (' + dims(b.p) + ') que a do site (' + dims(a.p) + '): ela foi reduzida';
                verdict[x.e.src] = { s: 'bad', t: 'reduzida: o original “' + b.f.name + '” tem ' + dims(b.p) + ' e o site, ' + dims(a.p) };
              }, function () {});
            });
          }, Promise.resolve()).then(function () { if (!r.text) r.text = x.label + ' (' + dims(a.p) + '): nenhum dos arquivos escolhidos é esta imagem'; });
        });
      }, Promise.resolve());
      return fuzzy.then(function () { res.forEach(function (r) { lines.push(r.text); }); });
    }).then(function () {
      var good = lines.length > 0 && lines.every(function (l) { return / ✓$/.test(l); });
      it._cmp = { ok: good, text: lines.join('\n') + (changed ? '\nO registro do original vai para o site no próximo Publicar: daí em diante, a conferência dessas imagens é automática.' : '') };
      if (changed) note = null;
      render();
    });
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
    if (!it._new) { var w = 'w/' + HRShare.idOf(it); removed.push(w + '.html', w + '.jpg'); }
    note = null; render();
  }
  // Trocar as imagens de um trabalho: as escolhidas entram no lugar, na ordem (a primeira vira a capa; as outras, as fotos
  // extras). Ficam o título, a descrição, a categoria, a data e o id, então o link e a prévia do link continuam os mesmos.
  // As imagens antigas saem do site no Publicar.
  function replaceImages(it, fileList) {
    var files = [].slice.call(fileList).slice(0, MAX_PICS), made = [], id = HRShare.idOf(it);
    if (!files.length) return;
    if (busy) { filesMsg.className = 'msg msg--files'; filesMsg.textContent = WAIT; return; }
    if (files.some(function (f) { return !/^image\//.test(f.type) || /^image\/svg/.test(f.type); })) { filesMsg.className = 'msg msg--files'; filesMsg.textContent = 'Para trocar, escolha só imagens (PNG, JPEG, WebP ou GIF).'; return; }
    if (!window.confirm('Trocar as imagens deste trabalho pelas ' + files.length + ' escolhidas? A primeira vira a capa. O título, a descrição, a categoria, a data e o link continuam.')) return;
    batch(files, function () { return ''; }, function (x) { made.push(x); }, function (file, i) { return prepare(file, i ? {} : { cover: true, id: id }); }).then(function () {
      if (made.length !== files.length || items.indexOf(it) < 0) { made.forEach(revoke); return; }     // alguma não deu (o recado está na tela)
      var cover = made[0];
      if (!it._new && !it._redo) { [it.src, it.thumb, it.poster].forEach(gone); (it.more || []).forEach(function (m) { if (!m._new) [m.src, m.thumb].forEach(gone); }); }
      revoke(it);
      it.type = cover.type; it.src = cover.src; it.thumb = cover.thumb; it.poster = cover.poster; it.id = id;
      it.orig = cover.orig; it._check = cover._check;
      it._files = cover._files; it._url = cover._url;
      it.more = made.slice(1).map(function (x) { return { src: x.src, thumb: x.thumb, orig: x.orig, _check: x._check, _files: x._files, _url: x._url, _new: true }; });
      if (!it._new) it._redo = true;
      note = null; render();
    });
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

  // ---------- O ícone do site ----------
  // A imagem pequena da aba do navegador, dos favoritos e do atalho na tela inicial do celular. São três arquivos, sempre
  // nos mesmos caminhos (o index.html aponta para eles): img/favicon.svg (o que o Chrome, o Edge e o Firefox usam),
  // img/favicon-32.png (o Safari e quem não lê SVG) e img/apple-touch-icon.png (180 px, o atalho do iPhone e do iPad, que
  // não aceita transparência: o fundo vira o tom do site). A imagem escolhida é redesenhada num canvas e vai ao ar só como
  // pixels: um SVG enviado do jeito que veio poderia levar código para dentro do site (o SVG publicado só embrulha uma
  // versão de 128 px dela). Ao publicar, os endereços dos três no index.html ganham o carimbo dos arquivos novos (?v=, o
  // mesmo que tools/versao.py calcula): o navegador de quem já visitou busca o ícone novo em vez de mostrar o guardado.
  var ICON = { svg: 'img/favicon.svg', small: 'img/favicon-32.png', home: 'img/apple-touch-icon.png' };
  var iconEl = $('.siteicon'), iconFile = $('.siteicon__file'), iconFit = $('.siteicon__fit'), iconUndo = $('.siteicon__undo'), iconMsg = $('.msg--icon'), iconState = $('.siteicon__state');
  var icon = null, iconSrc = null, iconShown = null;   // o ícone novo (ainda não publicado), a imagem de onde ele veio e o último publicado por aqui
  // a imagem num quadrado de side px: cover usa o quadrado do meio dela; contain, a imagem inteira, no meio (o resto fica
  // transparente, ou na cor fill). Reduz em passos de metade: uma redução grande de uma vez só deixa o ícone serrilhado.
  function square(src, side, fit, fill) {
    var w = src.naturalWidth || src.width || 512, h = src.naturalHeight || src.height || 512, s = Math.min(w, h), S = Math.max(w, h);
    var sx = 0, sy = 0, sw = w, sh = h, dw = side, dh = side, cur = src, cv, g;
    if (fit === 'cover') { sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; }
    else { dw = side * w / S; dh = side * h / S; }
    while (sw > dw * 2 + 1 && sh > dh * 2 + 1) {
      var half = document.createElement('canvas'), hg;
      half.width = Math.max(1, Math.round(sw / 2)); half.height = Math.max(1, Math.round(sh / 2));
      hg = half.getContext('2d'); hg.imageSmoothingEnabled = true; hg.imageSmoothingQuality = 'high';
      hg.drawImage(cur, sx, sy, sw, sh, 0, 0, half.width, half.height);
      cur = half; sx = sy = 0; sw = half.width; sh = half.height;
    }
    cv = document.createElement('canvas'); cv.width = cv.height = side;
    g = cv.getContext('2d');
    if (fill) { g.fillStyle = fill; g.fillRect(0, 0, side, side); }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, sx, sy, sw, sh, (side - dw) / 2, (side - dh) / 2, dw, dh);
    return cv;
  }
  // o carimbo de um arquivo: os 8 primeiros dígitos do SHA-1 dele (o mesmo de tools/versao.py)
  function stampOf(bytes) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve(Date.now().toString(16).slice(-8));
    return crypto.subtle.digest('SHA-1', bytes).then(function (d) { return [].map.call(new Uint8Array(d), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 8); });
  }
  function makeIcon(src, fit) {
    var big = square(src, 128, fit), small = square(src, 32, fit), home = square(src, 180, fit, '#141414'), look = big.toDataURL('image/png');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><image width="128" height="128" href="' + look + '"/></svg>\n';
    return Promise.all([toBlob(small, 'image/png'), toBlob(home, 'image/png')]).then(function (b) {
      if (!b[0] || !b[1]) throw new Error('não consegui gerar o ícone');
      var made = { svg: svg, small: b[0], home: b[1], fit: fit, look: look, homeUrl: URL.createObjectURL(b[1]) };
      return Promise.all([stampOf(new TextEncoder().encode(svg)), b[0].arrayBuffer().then(stampOf), b[1].arrayBuffer().then(stampOf)]).then(function (st) {
        made.stamps = { svg: st[0], small: st[1], home: st[2] };
        return made;
      });
    });
  }
  // no index.html, os endereços do ícone com o carimbo novo
  function stampIcons(html, st) {
    return html.replace(/(href="(?:\.\.)?\/img\/(favicon\.svg|favicon-32\.png|apple-touch-icon\.png))(?:\?v=[0-9a-f]*)?"/g, function (m, a, name) {
      return a + '?v=' + (name === 'favicon.svg' ? st.svg : name === 'favicon-32.png' ? st.small : st.home) + '"';
    });
  }
  function drawIcon() {
    var show = icon || iconShown, look = show ? show.look : '../img/favicon.svg', home = show ? show.homeUrl : '../img/apple-touch-icon.png';
    [].forEach.call(iconEl.querySelectorAll('.siteicon__16, .siteicon__now'), function (im) { im.src = look; });
    $('.siteicon__180', iconEl).src = home;
    iconState.textContent = icon ? 'novo, ainda não publicado' : 'o da aba do navegador';
    iconFit.hidden = !icon; iconUndo.hidden = !icon;
    [].forEach.call(iconFit.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(!!icon && b.dataset.fit === icon.fit)); });
  }
  function dropIcon() {
    if (icon && icon !== iconShown) URL.revokeObjectURL(icon.homeUrl);
    icon = null; iconSrc = null; drawIcon();
  }
  function setIcon(made) {
    if (icon) URL.revokeObjectURL(icon.homeUrl);
    icon = made; note = null; drawIcon(); refresh();
  }
  function iconSay(text, ok) { iconMsg.className = 'msg msg--icon' + (ok ? ' is-ok' : ''); iconMsg.textContent = text; }
  iconFile.addEventListener('change', function () {
    var file = iconFile.files && iconFile.files[0];
    iconFile.value = '';
    if (!file) return;
    if (busy) { iconSay(WAIT); return; }
    if (!/^image\//.test(file.type)) { iconSay('Este arquivo não é uma imagem. Escolha um PNG, JPG, WebP, GIF ou SVG.'); return; }
    if (file.size > 20 * 1048576) { iconSay('Esta imagem tem ' + mb(file.size) + ': para um ícone, escolha uma de até 20 MB.'); return; }
    pending++; refresh();
    iconSay('Preparando o ícone...', true);
    openImage(file).then(function (src) {
      var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
      iconSrc = src;
      return makeIcon(src, 'cover').then(function (made) { setIcon(made); return { w: w, h: h }; });
    }).then(function (d) {
      var say = [];
      if (d.w && d.h && Math.min(d.w, d.h) < 180) say.push('A imagem tem só ' + Math.min(d.w, d.h) + ' px no lado menor: na aba fica boa, mas no atalho do celular (180 px) pode ficar borrada.');
      if (d.w && d.h && d.w !== d.h) say.push('Ela não é quadrada: o ícone usa o quadrado do meio dela; para caber inteira, escolha "Inteira".');
      say.push('Confira a prévia e clique em Publicar.');
      iconSay(say.join(' '), true);
    }, function (err) {
      iconSay('Não deu para usar esta imagem: ' + err.message + '.');
    }).then(function () { pending--; refresh(); });
  });
  iconFit.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-fit]');
    if (!b || !icon || !iconSrc || busy || b.dataset.fit === icon.fit) return;
    pending++; refresh();
    makeIcon(iconSrc, b.dataset.fit).then(function (made) {
      setIcon(made);
      iconSay(made.fit === 'contain' ? 'A imagem inteira, no meio do quadrado: o que sobra fica transparente na aba e no tom do site no atalho do celular. Confira a prévia e clique em Publicar.'
        : 'O quadrado do meio da imagem. Confira a prévia e clique em Publicar.', true);
    }, function (err) { iconSay('Não deu para refazer o ícone: ' + err.message + '.'); }).then(function () { pending--; refresh(); });
  });
  iconUndo.addEventListener('click', function () {
    if (busy) return;
    dropIcon(); iconSay(''); note = null; refresh();
  });
  // publicado: o ícone novo vira o atual (e já aparece na aba deste painel)
  function iconSent(sent) {
    iconShown = sent;
    if (icon === sent) { icon = null; iconSrc = null; }
    var tab = document.querySelector('link[rel="icon"]'); if (tab) tab.href = sent.look;
    drawIcon();
    iconSay('Ícone publicado. Em 1 a 2 minutos ele aparece na aba do site (no navegador que já tinha o antigo guardado, recarregue a página).', true);
  }
  drawIcon();

  // ---------- Barra: o que falta publicar ----------
  function summary() {
    var fresh = items.filter(function (it) { return it._new; }).length, redo = items.filter(function (it) { return it._redo; }).length, parts = [], pics = 0;
    items.forEach(function (it) { if (!it._redo) (it.more || []).forEach(function (m) { if (m._new) pics++; }); });
    var before = {}; try { JSON.parse(remoteJson).items.forEach(function (it) { before[HRShare.idOf(it)] = 1; }); } catch (e) {}
    var gone = Object.keys(before).filter(function (k) { return !items.some(function (it) { return HRShare.idOf(it) === k; }); }).length;
    if (fresh) parts.push(fresh + (fresh > 1 ? ' novos' : ' novo'));
    if (redo) parts.push('imagens trocadas em ' + redo + (redo > 1 ? ' trabalhos' : ' trabalho'));
    if (gone) parts.push(gone + (gone > 1 ? ' apagados' : ' apagado'));
    if (pics) parts.push(pics + (pics > 1 ? ' fotos extras novas' : ' foto extra nova'));
    if (goneExtras) parts.push(goneExtras + (goneExtras > 1 ? ' fotos extras apagadas' : ' foto extra apagada'));
    var catsBefore = ''; try { catsBefore = JSON.stringify(JSON.parse(remoteJson).categories); } catch (e) {}
    if (JSON.stringify(cleanCats(cats)) !== catsBefore) parts.push('categorias alteradas');
    var origBefore = {}; try { JSON.parse(remoteJson).items.forEach(function (it) { origBefore[it.src] = JSON.stringify(it.orig || null); (it.more || []).forEach(function (m) { origBefore[m.src] = JSON.stringify(m.orig || null); }); }); } catch (e) {}
    var reg = 0; entries().forEach(function (x) { if (!x.e._new && origBefore[x.e.src] !== undefined && origBefore[x.e.src] !== JSON.stringify(origOf(x.e.orig))) reg++; });
    if (reg) parts.push('registro do original em ' + reg + (reg > 1 ? ' imagens' : ' imagem'));
    if (icon) parts.push('ícone do site novo');
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
  function utf8(b64) {          // o conteúdo de um arquivo que a API do GitHub devolve (base64) em texto
    var bin = atob(String(b64).replace(/\s/g, '')), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(u);
  }
  // job: o que foi decidido no clique em Publicar (o texto de portfolio.json, os arquivos novos, os que saem e a mensagem)
  function commit(job, attempt) {
    var head;
    // a conferência vale para cada tentativa: o portfólio no commit em que este vai entrar tem de ser o que o painel conhece
    return current().then(function (sha) {
      head = sha;
      return gh('GET', '/git/commits/' + head);
    }).then(function (c) {
      // a lista dos trabalhos em texto dentro do index.html desta mesma versão (ver admin/share.js); se der errado, publica sem ela
      return gh('GET', '/contents/index.html?ref=' + head).then(function (f) {
        var html = f && f.encoding === 'base64' ? utf8(f.content) : null, page = html ? HRShare.inPage(html, job.data) : null;
        if (html && job.stamps) page = stampIcons(page || html, job.stamps);       // o ícone novo: os endereços dele com o carimbo novo
        return { c: c, page: page };
      }, function () { return { c: c, page: null }; });
    }).then(function (got) {
      var c = got.c, tree = [{ path: 'portfolio.json', mode: '100644', type: 'blob', content: job.body }];
      if (got.page) tree.push({ path: 'index.html', mode: '100644', type: 'blob', content: got.page });
      (job.pages || []).forEach(function (pg) { tree.push({ path: pg.path, mode: '100644', type: 'blob', content: pg.content }); });   // as páginas de prévia (w/), o llms.txt e o sitemap
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
    var job = { body: toJson(list, catList), files: [], gone: [], message: message() }, fresh = [], keep = {}, shared = {};
    // a página de prévia de cada trabalho (ver admin/share.js), refeita a cada Publicar com o nome e a descrição de agora
    job.pages = list.map(function (it) { return { path: 'w/' + HRShare.idOf(it) + '.html', content: HRShare.page(it) }; });
    // e o que os buscadores e as IAs leem sem JavaScript (ver admin/share.js): o llms.txt, o sitemap e, no commit, o index.html
    job.data = { categories: catList, items: list };
    job.pages.push({ path: 'llms.txt', content: HRShare.llms(job.data) }, { path: 'sitemap.xml', content: HRShare.sitemap(job.data, today()) });
    // o ícone do site novo (ver "O ícone do site"): os três arquivos, no mesmo commit
    var sentIcon = icon;
    if (sentIcon) {
      job.files.push({ path: ICON.small, blob: sentIcon.small }, { path: ICON.home, blob: sentIcon.home });
      job.pages.push({ path: ICON.svg, content: sentIcon.svg });
      job.stamps = sentIcon.stamps;
    }
    var was = removed.slice(), extras = goneExtras, sent = 0, chain;
    items.forEach(function (it) {
      if (it._new || it._redo) fresh.push(it);
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
    // 1b. as prévias dos links (w/): o que já existe lá; a imagem dos trabalhos que ainda não têm (os de antes das prévias);
    //     e, dos arquivos a apagar em w/, só os que existem
    chain = chain.then(function () {
      return gh('GET', '/contents/w?ref=' + BRANCH).then(function (list) { (Array.isArray(list) ? list : []).forEach(function (f) { shared[f.path] = 1; }); }, function (err) { if (err.status !== 404) throw err; });
    }).then(function () {
      var ready = {}; job.files.forEach(function (f) { ready[f.path] = 1; });
      job.gone = job.gone.filter(function (p) { return p.indexOf('w/') !== 0 || shared[p]; });
      var need = list.filter(function (it) { var p = 'w/' + HRShare.idOf(it) + '.jpg'; return !ready[p] && !shared[p] && (it.type === 'image' || (it.type === 'video' && it.poster)); });
      return need.reduce(function (c, it, n) {
        return c.then(function () {
          progress('Preparando a prévia do link ' + (n + 1) + ' de ' + need.length + '...', 0.04);
          return ogFrom(RAW + (it.type === 'video' ? it.poster : it.src)).then(function (blob) { if (blob) job.files.push({ path: 'w/' + HRShare.idOf(it) + '.jpg', blob: blob }); }, function () {});   // sem a imagem, a prévia sai só com o texto
        });
      }, Promise.resolve());
    });
    // 2. envia cada arquivo novo (o que já subiu numa tentativa anterior não sobe de novo)
    chain = chain.then(function () {
      return job.files.reduce(function (c, f, i) {
        return c.then(function () {
          progress('Enviando arquivo ' + (i + 1) + ' de ' + job.files.length + ' (' + mb(f.blob.size) + ')...', 0.05 + 0.8 * sent / Math.max(1, job.files.length));
          if (f.sha) { sent++; return; }
          return base64(f.blob).then(function (data) { return gh('POST', '/git/blobs', { content: data, encoding: 'base64' }); }).then(function (res) { f.sha = res.sha; sent++; });
        });
      }, Promise.resolve());
    });
    // 3. grava tudo de uma vez
    chain.then(function () {
      progress('Gravando no site...', 0.9);
      return commit(job, 0);
    }).then(function () {
      // publicado o que estava no clique: só isso deixa de ser novo
      fresh.forEach(function (x) { x._new = false; x._redo = false; x._files = null; });
      removed = removed.filter(function (p) { return was.indexOf(p) < 0; }); goneExtras -= extras;
      remoteJson = job.body; busy = false;
      if (sentIcon) iconSent(sentIcon);
      note = { kind: 'is-ok', text: 'Publicado. O site mostra as mudanças em 1 a 2 minutos.' + (dirty() ? ' O que você mudou durante o envio ainda falta publicar.' : '') };
      render();
      if (fresh.length) setTimeout(function () { checkAll(); }, 100000);     // as imagens novas, já no site

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
