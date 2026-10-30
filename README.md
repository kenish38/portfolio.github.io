# Portfólio — Henrique Rocha

Portfólio de mapas e modelagem 3D para Roblox. Site estático (HTML + CSS, sem build), publicado pelo GitHub Pages.

Endereço: https://kenish38.github.io/portfolio.github.io/

## Como editar

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

| O que mudar | Onde |
| --- | --- |
| Textos de todas as seções | `index.html` (cada seção tem um comentário `<!-- ==== NOME ==== -->`). O texto visível é o inglês; o português fica no atributo `data-pt` do mesmo elemento |
| Cores, fontes, tamanhos e espaçamentos | `styles.css` (as cores principais ficam no topo, em `:root`) |
| Imagens dos projetos | `assets/img/projeto-1.jpg`, `projeto-2.jpg`, `projeto-3.jpg` |
| Vidro com chuva da abertura | `script.js` (ajustes de gotas, névoa e luz no topo da parte do vidro); a imagem atrás do vidro é o `data-scene` do `<canvas>` em `index.html` |
| Ícone da aba | `assets/img/favicon.svg` |
| Logos dos softwares | `assets/logos/` |

**Trocar a imagem de um projeto:** substitua o arquivo em `assets/img/` mantendo o mesmo nome, ou aponte o `src` da `<img>` do projeto para o arquivo novo.

**Adicionar uma comprovação:** em `index.html`, copie um bloco `<li class="credit">…</li>` da seção Comprovações e troque nome do jogo, estúdio, o que você fez e o link.

**Adicionar um projeto:** em `index.html`, copie um bloco `<article class="work">…</article>` inteiro, cole depois do último e troque textos e imagem.

**Adicionar um software:** copie uma linha `<li class="tool">…</li>`, troque o nome e o logo.

**Adicionar um contato:** dentro de `<div class="contact__links">`, no rodapé, adicione um link `<a class="contact__link" href="…">Nome</a>`.

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Recriado em código a partir do projeto do Framer "HenriqueRocha" (outubro de 2026). O Framer não sincroniza com o git: a partir daqui, este repositório é a versão oficial do site.
