// Refaz, a partir de portfolio.json, o que os buscadores e as IAs leem sem JavaScript: a lista dos trabalhos em texto no
// index.html (entre as marcas "trabalhos: começo" e "trabalhos: fim"), o llms.txt e o sitemap.xml. O painel faz o mesmo a
// cada Publicar (a conta é a mesma: admin/share.js); este script serve para quando o texto sobre o Henrique mudar no
// share.js, ou para conferir. Só lê portfolio.json (ele é do dono: nunca é escrito aqui).
//   node tools/textos.js              (a data do sitemap é a de hoje)
//   node tools/textos.js 2026-11-26   (ou a data dada)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { HRShare } = require(path.join(ROOT, 'admin', 'share.js'));

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'portfolio.json'), 'utf8'));
const now = new Date();
const day = process.argv[2] || [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');

const indexPath = path.join(ROOT, 'index.html');
const page = HRShare.inPage(fs.readFileSync(indexPath, 'utf8'), data);
if (page) fs.writeFileSync(indexPath, page);
fs.writeFileSync(path.join(ROOT, 'llms.txt'), HRShare.llms(data));
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), HRShare.sitemap(data, day));
console.log('index.html: ' + (page ? 'lista dos trabalhos refeita' : 'nada mudou (ou faltam as marcas)') + '; llms.txt e sitemap.xml refeitos (' + day + ')');
