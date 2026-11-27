// A conferência diária das imagens originais do site (roda sozinha todo dia pelo GitHub Actions: ver
// .github/workflows/conferir-imagens.yml; dá para rodar à mão também). Só lê: não muda nenhum arquivo.
//
// Para cada imagem inteira do site (a capa e as fotos extras de cada trabalho, e os vídeos), confere:
//   1. o arquivo do site no ar é exatamente o do repositório (o resumo SHA-256 dos bytes, baixado de novo todo dia);
//   2. o arquivo nunca mudou desde que entrou no repositório (o histórico do Git: um endereço tem um arquivo só; trocar as
//      imagens pelo painel cria outro endereço);
//   3. o registro do original dele ("orig" no portfolio.json: largura, altura, a impressão dos pixels e a do arquivo) nunca
//      mudou desde que foi gravado (o histórico do Git guarda todas as versões do portfolio.json, então o registro não se
//      perde nem é esquecido);
//   4. com a impressão do arquivo gravada no registro ("orig.file"), os bytes de agora têm de ser os mesmos; sem ela, o
//      tamanho tem de ser o do registro e o formato, sem perda;
//   5. sem registro nenhum (imagens enviadas antes do registro existir), fica o aviso: a prova pixel a pixel vem do
//      "Comparar com os originais" do painel, com os arquivos do computador.
// Algum problema: o comando termina com erro e, no GitHub, abre (ou comenta) a issue "Conferência das imagens: problema"
// (o dono do repositório recebe o aviso por e-mail). Tudo certo de novo: a issue é fechada com um comentário.
//
// Uso, na raiz do repositório:   node tools/conferir-imagens.js
//   SITE=https://outro.endereco  confere outro endereço;   SEM_SITE=1  não baixa do site (só o repositório e o histórico);
//   ESPERA=5000  espera entre as tentativas de baixar do site, em ms (normal: 60000)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = (process.env.SITE || 'https://henriquerocha.dev.br').replace(/\/+$/, '');
const TITLE = 'Conferência das imagens: problema';
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 * 1048576 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// o registro do original, só se estiver certo (o mesmo filtro do painel)
function origOf(o) {
  if (!o || typeof o !== 'object') return null;
  const w = Math.round(o.w), h = Math.round(o.h);
  if (!(w > 0 && h > 0 && w <= 30000 && h <= 30000) || !/^[0-9a-f]{64}$/.test(o.px || '')) return null;
  const out = { w, h, px: o.px };
  if (/^[0-9a-f]{64}$/.test(o.file || '')) out.file = o.file;
  return out;
}
// as imagens inteiras e os vídeos de cada trabalho, como o painel confere (as miniaturas são menores de propósito)
function entries(data) {
  const out = [];
  (data.items || []).forEach((it) => {
    const name = it.title_pt || it.title || it.id || it.src;
    if (it.type === 'youtube') return;
    if (it.type === 'video') { out.push({ name, label: 'Vídeo', src: it.src, video: true }); if (it.poster) out.push({ name, label: 'Capa do vídeo', src: it.poster }); return; }
    out.push({ name, label: 'Capa', src: it.src, orig: origOf(it.orig) });
    (it.more || []).forEach((m, k) => out.push({ name, label: 'Foto ' + (k + 2), src: m.src, orig: origOf(m.orig) }));
  });
  return out.filter((e) => typeof e.src === 'string' && /^media\/[\w.-]+$/.test(e.src));
}
// o formato e o tamanho de uma imagem, pelo começo do arquivo (o mesmo que o painel lê)
function formatOf(u) {
  const le32 = (at) => (u[at] | (u[at + 1] << 8) | (u[at + 2] << 16) | (u[at + 3] << 24)) >>> 0, be32 = (at) => ((u[at] << 24) | (u[at + 1] << 16) | (u[at + 2] << 8) | u[at + 3]) >>> 0;
  const t = u.subarray(0, 4).toString('latin1');
  if (t === 'RIFF' && u.subarray(8, 12).toString('latin1') === 'WEBP') {
    let at = 12, w = 0, h = 0, lossy = false, lossless = false;
    while (at + 8 <= u.length) {
      const c = u.subarray(at, at + 4).toString('latin1'), n = le32(at + 4), d = at + 8;
      if (c === 'VP8X' && d + 10 <= u.length) { w = 1 + (u[d + 4] | (u[d + 5] << 8) | (u[d + 6] << 16)); h = 1 + (u[d + 7] | (u[d + 8] << 8) | (u[d + 9] << 16)); }
      else if (c === 'VP8L' && d + 5 <= u.length) { lossless = true; if (!w) { const b = le32(d + 1); w = (b & 0x3fff) + 1; h = ((b >>> 14) & 0x3fff) + 1; } }
      else if (c === 'VP8 ' && d + 10 <= u.length) { lossy = true; if (!w) { w = (u[d + 6] | (u[d + 7] << 8)) & 0x3fff; h = (u[d + 8] | (u[d + 9] << 8)) & 0x3fff; } }
      else if (c === 'ANMF' && d + 24 <= u.length) { const f = u.subarray(d + 16, d + 20).toString('latin1'); if (f === 'VP8 ') lossy = true; else if (f === 'VP8L') lossless = true; }
      at = d + n + (n & 1);
    }
    return { fmt: lossy ? 'WebP com perda' : 'WebP sem perda', lossless: lossless && !lossy, w, h };
  }
  if (u[0] === 0x89 && t.slice(1) === 'PNG') return { fmt: 'PNG', lossless: true, w: be32(16), h: be32(20) };
  if (t.slice(0, 3) === 'GIF') return { fmt: 'GIF', lossless: true, w: u[6] | (u[7] << 8), h: u[8] | (u[9] << 8) };
  if (u[0] === 0xff && u[1] === 0xd8) {
    for (let at = 2; at + 9 < u.length;) {
      if (u[at] !== 0xff) { at++; continue; }
      const m = u[at + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { fmt: 'JPEG', lossless: false, jpeg: true, w: (u[at + 7] << 8) | u[at + 8], h: (u[at + 5] << 8) | u[at + 6] };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { at += m === 0xff ? 1 : 2; continue; }
      at += 2 + ((u[at + 2] << 8) | u[at + 3]);
    }
    return { fmt: 'JPEG', lossless: false, jpeg: true, w: 0, h: 0 };
  }
  return { fmt: 'formato desconhecido', lossless: false, w: 0, h: 0 };
}
// os conteúdos que um endereço já teve no histórico (um para cada versão diferente do arquivo)
function versionsOf(src) {
  const commits = git('log', '--format=%H', '--', src).split('\n').filter(Boolean), blobs = new Set();
  commits.forEach((c) => { try { blobs.add(git('rev-parse', c + ':' + src)); } catch (e) { /* apagado nesse commit */ } });
  return { commits: commits.length, blobs: blobs.size };
}
// os registros do original que cada endereço já teve, em todas as versões do portfolio.json
function recordsInHistory() {
  const seen = {};
  git('log', '--format=%H', '--', 'portfolio.json').split('\n').filter(Boolean).forEach((c) => {
    let data; try { data = JSON.parse(git('show', c + ':portfolio.json')); } catch (e) { return; }
    entries(data).forEach((e) => {
      if (!e.orig) return;
      const r = seen[e.src] || (seen[e.src] = { px: new Set(), file: new Set() });
      r.px.add(e.orig.w + 'x' + e.orig.h + ':' + e.orig.px);
      if (e.orig.file) r.file.add(e.orig.file);
    });
  });
  return seen;
}
async function live(src) {        // o arquivo do site no ar, baixado de novo (sem cache); até 3 tentativas (o site leva 1 a 2 minutos depois de publicar)
  let last = '';
  for (let k = 0; k < 3; k++) {
    try {
      const res = await fetch(SITE + '/' + src + '?conferencia=' + Date.now(), { cache: 'no-store', headers: { 'User-Agent': 'conferencia-das-imagens' } });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      last = 'o site respondeu ' + res.status;
    } catch (e) { last = 'sem conexão com o site (' + e.message + ')'; }
    if (k < 2) await sleep(+process.env.ESPERA || 60000);
  }
  throw new Error(last);
}

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio.json'), 'utf8'));
  const list = entries(data), history = recordsInHistory(), rows = [];
  let bad = 0, warn = 0;
  for (const e of list) {
    const problems = [], notes = [];
    const file = path.join(ROOT, e.src);
    if (!fs.existsSync(file)) { rows.push({ e, s: 'bad', t: 'o arquivo não está no repositório' }); bad++; continue; }
    const bytes = fs.readFileSync(file), hash = sha(bytes);
    // 1. o site no ar
    if (!process.env.SEM_SITE) {
      try { const got = await live(e.src); if (sha(got) !== hash) problems.push('o site no ar mostra outro arquivo, diferente do repositório'); }
      catch (err) { problems.push('não deu para baixar do site: ' + err.message); }
    }
    // 2. o arquivo nunca mudou
    const v = versionsOf(e.src);
    if (v.blobs > 1) problems.push('o arquivo foi trocado depois de entrar no site (' + v.blobs + ' versões diferentes no histórico)');
    // 3. o registro nunca mudou
    const h = history[e.src];
    if (h && h.px.size > 1) problems.push('o registro do original foi alterado (' + h.px.size + ' registros diferentes no histórico)');
    if (h && h.file.size > 1) problems.push('a impressão do arquivo no registro foi alterada');
    // 4. o registro de agora
    if (!e.video) {
      const head = formatOf(bytes);
      if (e.orig) {
        if (head.w !== e.orig.w || head.h !== e.orig.h) problems.push('o tamanho (' + head.w + ' × ' + head.h + ') não é o do original (' + e.orig.w + ' × ' + e.orig.h + ')');
        if (e.orig.file) { if (e.orig.file !== hash) problems.push('os bytes não são os do arquivo conferido no envio'); else notes.push('o mesmo arquivo conferido pixel a pixel no envio'); }
        else if (!head.lossless && !head.jpeg) problems.push('com perda (' + head.fmt + ')');
        else notes.push(head.fmt + ', ' + head.w + ' × ' + head.h + ', no tamanho do original (a impressão do arquivo entra no registro no próximo Publicar do painel)');
      } else {
        if (!head.lossless && !head.jpeg) problems.push('com perda (' + head.fmt + ')');
        else { notes.push(head.fmt + ', ' + head.w + ' × ' + head.h + ', sem registro do original: enviada antes do registro existir; use o “Comparar com os originais” do painel com o arquivo do computador'); warn++; }
      }
    } else notes.push('vídeo: o mesmo arquivo de quando foi enviado');
    if (problems.length) { bad++; rows.push({ e, s: 'bad', t: problems.join('; ') }); }
    else rows.push({ e, s: e.orig || e.video ? 'ok' : 'warn', t: notes.join('; ') + (process.env.SEM_SITE ? '' : '; igual no site no ar') + (v.blobs === 1 ? '; nunca mudou desde que entrou' : '') });
  }
  const day = new Date().toISOString().slice(0, 10);
  const icon = { ok: '✅', warn: '⚠️', bad: '❌' };
  const lines = ['## Conferência das imagens originais (' + day + ')', '',
    bad ? '**' + bad + (bad > 1 ? ' imagens com problema.' : ' imagem com problema.') + '**' : '**Nenhum problema:** todas as imagens do site são os mesmos arquivos de quando foram enviadas.' + (warn ? ' ' + warn + (warn > 1 ? ' ainda não têm' : ' ainda não tem') + ' o registro do original.' : ''),
    '', '| | Trabalho | Imagem | Resultado |', '|---|---|---|---|'];
  rows.forEach((r) => lines.push('| ' + icon[r.s] + ' | ' + String(r.e.name).replace(/\|/g, '/') + ' | ' + r.e.label + ' (`' + r.e.src + '`) | ' + r.t.replace(/\|/g, '/') + ' |'));
  const report = lines.join('\n') + '\n';
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  // o aviso no GitHub: uma issue aberta enquanto houver problema (o dono recebe por e-mail); fechada quando tudo volta ao normal
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
  if (token && repo) {
    const api = (method, p, body) => fetch('https://api.github.com/repos/' + repo + p, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'conferencia-das-imagens' }, body: body ? JSON.stringify(body) : undefined })
      .then((r) => r.ok ? r.json() : r.text().then((t) => { throw new Error(method + ' ' + p + ': ' + r.status + ' ' + t.slice(0, 200)); }));
    const open = (await api('GET', '/issues?state=open&per_page=100')).filter((i) => !i.pull_request && i.title === TITLE);
    if (bad) {
      if (open.length) await api('POST', '/issues/' + open[0].number + '/comments', { body: report });
      else await api('POST', '/issues', { title: TITLE, body: report + '\nEsta issue fecha sozinha quando a conferência diária voltar a dar tudo certo.' });
    } else {
      for (const i of open) { await api('POST', '/issues/' + i.number + '/comments', { body: 'Tudo certo de novo na conferência de ' + day + '.\n\n' + report }); await api('PATCH', '/issues/' + i.number, { state: 'closed', state_reason: 'completed' }); }
    }
  }
  process.exit(bad ? 1 : 0);
})().catch((err) => { console.error('A conferência não conseguiu rodar: ' + err.message); process.exit(2); });
