// ===== Painel do dono =====
// O site é estático (GitHub Pages) e não tem servidor. Para o dono publicar sozinho, esta página conversa direto com o
// GitHub usando uma chave de acesso que ele cria uma vez (token "fine-grained", só deste repositório, permissão Contents).
// A chave fica guardada apenas no navegador dele (localStorage); nunca vai para o repositório.
//
// O que o painel faz ao publicar, num commit só na branch principal:
//   - grava os arquivos novos em media/ (imagens já reduzidas, com miniatura; vídeos com um quadro de capa);
//   - reescreve portfolio.json com a lista na ordem e com os títulos do painel;
//   - apaga de media/ os arquivos dos trabalhos removidos.
// O site lê portfolio.json (ver "Portfólio" em js/page.js). O GitHub Pages republica em 1 a 2 minutos.
//
// IMPORTANTE para quem mexer no repositório: media/ e portfolio.json pertencem ao dono do site. Nenhuma atualização
// do código deve apagar ou sobrescrever esses arquivos, e todo push precisa partir da branch principal atualizada.
(function () {
  'use strict';
  // O painel nunca roda dentro de outro site (um <iframe> escondido poderia induzir cliques em Publicar ou Apagar).
  // O GitHub Pages não deixa mandar o cabeçalho que proíbe isso, então a própria página se recusa a abrir num quadro.
  if (window.top !== window.self) { document.documentElement.textContent = ''; return; }
  var REPO = 'kenish38/portfolio.github.io', BRANCH = 'main';          // repositório e branch que o GitHub Pages publica
  var API = 'https://api.github.com/repos/' + REPO, RAW = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/';
  var KEY = 'hr-admin-token';                                           // onde a chave fica no navegador (js/page.js usa o mesmo nome)
  var DIR = 'media/', FULL = 3200, THUMB = 1000, POSTER = 1280;         // pasta dos arquivos e lado maior, em px, de cada versão
  var MAX_VIDEO = 50 * 1024 * 1024;                                     // vídeos maiores que isso pesam demais para o visitante

  function $(sel, el) { return (el || document).querySelector(sel); }
  var loginEl = $('#login'), panelEl = $('#panel'), barEl = $('.bar'), outBtn = $('.top__out');
  var form = $('.login__form'), tokenIn = $('#token'), loginMsg = $('.login__form .msg');
  var dropEl = $('.drop'), filesIn = $('#files'), filesMsg = $('.msg--files'), listEl = $('.list'), noneEl = $('.none');
  var stateEl = $('.bar__state'), meterEl = $('.bar__meter'), meterFill = $('.bar__meter i'), publishBtn = $('.bar__publish'), discardBtn = $('.bar__discard');
  var tubeForm = $('.tube'), tubeIn = $('#tube'), tubeMsg = $('.msg--tube'), rowTpl = $('#row');
  $('.repo-name').textContent = REPO.split('/')[1];

  var token = null, items = [], removed = [], remoteJson = '', busy = false, note = null, serial = 0;

  // ---------- GitHub ----------
  function gh(method, path, body) {
    return fetch(API + path, {
      method: method,
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
        if (!res.ok) { var err = new Error(data && data.message || ('erro ' + res.status)); err.status = res.status; throw err; }
        return data;
      });
    });
  }
  // Mensagem para o dono, em português, a partir de um erro do GitHub ou da rede
  function explain(err) {
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
  function clean(it) {         // só os campos públicos de um item, na ordem em que aparecem no arquivo
    var o = { type: it.type === 'video' || it.type === 'youtube' ? it.type : 'image', src: it.src };
    ['thumb', 'poster', 'title', 'title_pt', 'alt', 'alt_pt'].forEach(function (k) { if (it[k]) o[k] = String(it[k]).trim(); });
    return o;
  }
  function json() { return JSON.stringify({ items: items.map(clean) }, null, 2) + '\n'; }
  function dirty() { return json() !== remoteJson; }
  function mine(path) { return typeof path === 'string' && path.indexOf(DIR) === 0 && path.indexOf('..') < 0; }   // o painel só apaga o que está em media/

  function load() {
    return gh('GET', '/contents/portfolio.json?ref=' + BRANCH).then(function (file) {
      var data = {}; try { data = JSON.parse(b64text(file.content)); } catch (e) {}
      return Array.isArray(data.items) ? data.items : [];
    }, function (err) { if (err.status === 404) return []; throw err; }).then(function (list) {
      items.forEach(function (it) { if (it._url) URL.revokeObjectURL(it._url); });
      items = list.filter(function (it) { return it && it.src; }).map(clean);
      removed = []; remoteJson = json(); note = null;
      render();
    });
  }

  // ---------- Entrada ----------
  function show(logged) { loginEl.hidden = logged; panelEl.hidden = !logged; barEl.hidden = !logged; outBtn.hidden = !logged; }
  function enter(tok) {
    token = tok;
    // a chave vale? e deixa escrever? (o teste de escrita cria um conteúdo solto de 2 letras, que não aparece em lugar nenhum)
    return gh('GET', '').then(function () { return gh('POST', '/git/blobs', { content: 'ok', encoding: 'utf-8' }); }).then(function () {
      try { localStorage.setItem(KEY, tok); } catch (e) {}
      show(true);
      return load();
    });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var tok = tokenIn.value.trim();
    if (!tok) { loginMsg.textContent = 'Cole a chave no campo acima.'; return; }
    loginMsg.className = 'msg is-ok'; loginMsg.textContent = 'Conferindo a chave...';
    enter(tok).then(function () { tokenIn.value = ''; loginMsg.textContent = ''; }, function (err) {
      token = null; show(false);
      loginMsg.className = 'msg';
      loginMsg.textContent = err.status === 401 ? 'O GitHub não reconheceu esta chave. Confira se copiou inteira.' : explain(err);
    });
  });
  outBtn.addEventListener('click', function () {
    if (dirty() && !window.confirm('Há mudanças que ainda não foram publicadas. Sair mesmo assim?')) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
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
  // De um arquivo escolhido para um item novo da lista, com os arquivos que vão para media/
  function prepare(file) {
    var base = DIR + slug(file.name) + '-' + Date.now().toString(36) + (serial++).toString(36);
    var it = { src: '', title: words(file.name), title_pt: '', _new: true, _files: [], _url: '' };
    if (/^video\//.test(file.type)) {
      if (!/^video\/(mp4|webm)$/.test(file.type)) return Promise.reject(new Error('use vídeo em MP4 ou WebM (este é ' + (file.type || 'de um formato desconhecido') + ').'));
      if (file.size > MAX_VIDEO) return Promise.reject(new Error('o vídeo tem ' + mb(file.size) + ' e o limite é 50 MB. Exporte em 1080p ou menos, ou corte um trecho mais curto.'));
      it.type = 'video'; it.src = base + (file.type === 'video/webm' ? '.webm' : '.mp4'); it._files.push({ path: it.src, blob: file });
      return frame(file).then(function (shot) {
        if (shot) { it.poster = base + '-capa' + ext(shot); it._files.push({ path: it.poster, blob: shot }); it._url = URL.createObjectURL(shot); }
        else it._url = URL.createObjectURL(file);
        return it;
      });
    }
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('só imagens e vídeos entram no portfólio.'));
    // SVG não entra: ele pode levar código escondido, que rodaria no endereço do site se alguém abrisse o arquivo direto
    // (e de lá conseguiria ler a chave deste painel). Para desenhos vetoriais, exporte em PNG.
    if (/^image\/svg/.test(file.type) || /\.svg$/i.test(file.name)) return Promise.reject(new Error('arquivos SVG não são aceitos, por segurança. Exporte o desenho em PNG e envie de novo.'));
    it.type = 'image';
    if (file.type === 'image/gif') {      // animações vão como estão
      it.src = base + '.gif'; it._files.push({ path: it.src, blob: file }); it._url = URL.createObjectURL(file);
      return Promise.resolve(it);
    }
    return openImage(file).then(function (img) {
      return shrink(img, FULL, 0.88).then(function (full) {
        return shrink(img, THUMB, 0.8).then(function (small) {
          it.src = base + ext(full); it.thumb = base + '-mini' + ext(small);
          it._files.push({ path: it.src, blob: full }, { path: it.thumb, blob: small });
          it._url = URL.createObjectURL(small);
          if (img.close) img.close();
          return it;
        });
      });
    });
  }
  function addFiles(fileList) {
    var files = [].slice.call(fileList), problems = [], chain = Promise.resolve();
    if (!files.length || busy) return;
    filesMsg.className = 'msg msg--files is-ok'; filesMsg.textContent = 'Preparando ' + files.length + (files.length > 1 ? ' arquivos...' : ' arquivo...');
    files.forEach(function (file) {
      chain = chain.then(function () {
        return prepare(file).then(function (it) { items.push(it); note = null; render(); }, function (err) { problems.push(file.name + ': ' + err.message); });
      });
    });
    chain.then(function () { filesMsg.className = 'msg msg--files'; filesMsg.textContent = problems.join('\n'); filesIn.value = ''; });
  }
  filesIn.addEventListener('change', function () { addFiles(filesIn.files); });
  ['dragenter', 'dragover'].forEach(function (name) { dropEl.addEventListener(name, function (e) { e.preventDefault(); dropEl.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (name) { dropEl.addEventListener(name, function (e) { e.preventDefault(); dropEl.classList.remove('is-over'); }); });
  dropEl.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  ['dragover', 'drop'].forEach(function (name) { window.addEventListener(name, function (e) { e.preventDefault(); }); });   // soltar fora da área não abre o arquivo no navegador

  // ---------- Vídeo do YouTube: o item guarda só o link ----------
  function ytId(url) { var m = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/.exec(String(url || '')); return m ? m[1] : ''; }
  tubeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var id = ytId(tubeIn.value.trim()), src = 'https://youtu.be/' + id;
    if (busy) return;
    if (!id) { tubeMsg.textContent = 'Não reconheci este link. Abra o vídeo no YouTube, clique em Compartilhar e cole o link aqui.'; return; }
    if (items.some(function (it) { return it.type === 'youtube' && ytId(it.src) === id; })) { tubeMsg.textContent = 'Este vídeo já está na lista.'; return; }
    items.push({ type: 'youtube', src: src, title: '', title_pt: '', _new: true, _files: [], _url: '' });
    tubeIn.value = ''; tubeMsg.textContent = ''; note = null; render();
  });

  // ---------- Desenhar a lista ----------
  function picture(it) {
    var el, shown = it._url || (it.thumb || it.poster || (it.type === 'image' ? it.src : ''));
    if (it.type === 'youtube' && !shown) { el = document.createElement('img'); el.alt = ''; el.loading = 'lazy'; el.src = 'https://i.ytimg.com/vi/' + ytId(it.src) + '/hqdefault.jpg'; return el; }
    if (shown) { el = document.createElement('img'); el.alt = ''; el.loading = 'lazy'; el.src = it._url ? shown : RAW + shown; }
    else { el = document.createElement('video'); el.muted = true; el.playsInline = true; el.preload = 'metadata'; el.src = RAW + it.src; }
    return el;
  }
  function render() {
    listEl.textContent = '';
    items.forEach(function (it, i) {
      var row = rowTpl.content.firstElementChild.cloneNode(true), meta = $('.row__meta', row), size = 0;
      row.classList.toggle('is-new', !!it._new);
      $('.row__pic', row).appendChild(picture(it));
      meta.appendChild(document.createTextNode(it.type === 'youtube' ? 'YouTube' : it.type === 'video' ? 'Vídeo' : 'Imagem'));
      function tag(text) { var b = document.createElement('b'); b.textContent = text; meta.appendChild(b); }
      if (i === 0) tag('Destaque');
      if (it._new) { tag('Novo'); it._files.forEach(function (f) { size += f.blob.size; }); if (size) meta.appendChild(document.createTextNode(mb(size))); }
      var en = $('.row__title', row), pt = $('.row__title-pt', row);
      en.value = it.title || ''; pt.value = it.title_pt || '';
      en.addEventListener('input', function () { it.title = en.value; note = null; refresh(); });
      pt.addEventListener('input', function () { it.title_pt = pt.value; note = null; refresh(); });
      var up = $('.row__up', row), down = $('.row__down', row);
      up.disabled = i === 0; down.disabled = i === items.length - 1;
      up.addEventListener('click', function () { move(i, -1); });
      down.addEventListener('click', function () { move(i, 1); });
      $('.row__del', row).addEventListener('click', function () { drop(i); });
      listEl.appendChild(row);
    });
    noneEl.hidden = items.length > 0;
    refresh();
  }
  function move(i, d) { if (busy) return; var it = items.splice(i, 1)[0]; items.splice(i + d, 0, it); note = null; render(); }
  function drop(i) {
    if (busy) return;
    var it = items[i];
    if (!it._new && !window.confirm('Apagar este trabalho do portfólio? Ele sai do site quando você publicar.')) return;
    items.splice(i, 1);
    if (it._url) URL.revokeObjectURL(it._url);
    if (!it._new) [it.src, it.thumb, it.poster].forEach(function (p) { if (mine(p)) removed.push(p); });
    note = null; render();
  }

  // ---------- Barra: o que falta publicar ----------
  function summary() {
    var fresh = items.filter(function (it) { return it._new; }).length, parts = [];
    var before = {}; try { JSON.parse(remoteJson).items.forEach(function (it) { before[it.src] = 1; }); } catch (e) {}
    var gone = Object.keys(before).filter(function (src) { return !items.some(function (it) { return it.src === src; }); }).length;
    if (fresh) parts.push(fresh + (fresh > 1 ? ' novos' : ' novo'));
    if (gone) parts.push(gone + (gone > 1 ? ' apagados' : ' apagado'));
    if (!parts.length) parts.push('títulos ou ordem alterados');
    return parts.join(', ');
  }
  function refresh() {
    var changed = dirty();
    publishBtn.disabled = busy || !changed; discardBtn.disabled = busy || !changed;
    if (busy) return;
    meterEl.hidden = true;
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
  function commit(files, attempt) {
    var head;
    return gh('GET', '/git/ref/heads/' + BRANCH).then(function (ref) {
      head = ref.object.sha;
      return gh('GET', '/git/commits/' + head);
    }).then(function (c) {
      var tree = [{ path: 'portfolio.json', mode: '100644', type: 'blob', content: json() }];
      files.forEach(function (f) { tree.push({ path: f.path, mode: '100644', type: 'blob', sha: f.sha }); });
      removed.forEach(function (p) { tree.push({ path: p, mode: '100644', type: 'blob', sha: null }); });   // sha nulo = apagar o arquivo
      return gh('POST', '/git/trees', { base_tree: c.tree.sha, tree: tree });
    }).then(function (t) {
      return gh('POST', '/git/commits', { message: message(), tree: t.sha, parents: [head] });
    }).then(function (c) {
      return gh('PATCH', '/git/refs/heads/' + BRANCH, { sha: c.sha, force: false });
    }).catch(function (err) {
      // a branch andou enquanto publicávamos (outro commit entrou): refaz o commit em cima da versão nova
      if (err.status === 422 && attempt < 3 && /fast.forward/i.test(err.message)) return commit(files, attempt + 1);
      throw err;
    });
  }
  function publish() {
    if (busy || !dirty()) return;
    var files = [], sent = 0, chain;
    items.forEach(function (it) { (it._files || []).forEach(function (f) { files.push(f); }); });
    busy = true; note = null; refresh();
    progress('Conferindo a versão que está no site...', 0.03);
    // 1. alguém mudou o portfólio por outro aparelho depois que este painel abriu? Então não publica por cima.
    chain = gh('GET', '/contents/portfolio.json?ref=' + BRANCH).then(function (file) {
      var now = ''; try { now = JSON.stringify({ items: (JSON.parse(b64text(file.content)).items || []).filter(function (it) { return it && it.src; }).map(clean) }, null, 2) + '\n'; } catch (e) {}
      if (now !== remoteJson) { var err = new Error('mudou'); err.changed = true; throw err; }
    }, function (err) { if (err.status !== 404) throw err; });
    // 2. envia cada arquivo novo (o que já subiu numa tentativa anterior não sobe de novo)
    files.forEach(function (f, i) {
      chain = chain.then(function () {
        progress('Enviando arquivo ' + (i + 1) + ' de ' + files.length + ' (' + mb(f.blob.size) + ')...', 0.05 + 0.8 * sent / Math.max(1, files.length));
        if (f.sha) { sent++; return; }
        return base64(f.blob).then(function (data) { return gh('POST', '/git/blobs', { content: data, encoding: 'base64' }); }).then(function (res) { f.sha = res.sha; sent++; });
      });
    });
    // 3. grava tudo de uma vez
    chain.then(function () {
      progress('Gravando no site...', 0.9);
      return commit(files, 0);
    }).then(function () {
      items.forEach(function (it) { it._new = false; it._files = null; });
      removed = []; remoteJson = json(); busy = false;
      note = { kind: 'is-ok', text: 'Publicado. O site mostra as mudanças em 1 a 2 minutos.' };
      render();
    }, function (err) {
      busy = false;
      note = { kind: 'is-bad', text: err.changed ? 'O portfólio foi alterado por outro aparelho depois que você abriu o painel. Recarregue a página para ver a versão atual antes de publicar.' : explain(err) + ' Nada foi perdido: é só tentar de novo.' };
      refresh();
    });
  }
  publishBtn.addEventListener('click', publish);
  discardBtn.addEventListener('click', function () {
    if (busy || !window.confirm('Descartar tudo o que ainda não foi publicado?')) return;
    load().catch(function (err) { note = { kind: 'is-bad', text: explain(err) }; refresh(); });
  });
  window.addEventListener('beforeunload', function (e) { if (token && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Começo ----------
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (!saved) show(false);
  else enter(saved).catch(function (err) {
    token = null; show(false);
    if (err.status === 401) { try { localStorage.removeItem(KEY); } catch (e) {} }
    loginMsg.className = 'msg'; loginMsg.textContent = err.status === 401 ? 'A chave guardada neste navegador venceu ou foi apagada. Entre com uma chave nova.' : explain(err);
  });
})();
