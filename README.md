# Portfólio — Henrique Rocha

Portfólio de mapas e modelagem 3D para Roblox. Site estático (HTML + CSS, sem build), publicado pelo GitHub Pages.

Endereço: https://kenish38.github.io/portfolio.github.io/

## Como editar

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

| O que mudar | Onde |
| --- | --- |
| Textos de todas as seções | `index.html` (cada seção tem um comentário `<!-- ==== NOME ==== -->`) |
| Cores, fontes, tamanhos e espaçamentos | `styles.css` (as cores principais ficam no topo, em `:root`) |
| Imagens dos projetos | `assets/img/projeto-1.jpg`, `projeto-2.jpg`, `projeto-3.jpg` |
| Fundo da abertura | `assets/img/floresta-fundo.png` |
| Emblema (rosa) e ícone da aba | `assets/img/rosa.png` |
| Logos dos softwares | `assets/logos/` |

**Trocar a imagem de um projeto:** substitua o arquivo em `assets/img/` mantendo o mesmo nome, ou aponte o `src` da `<img>` do projeto para o arquivo novo.

**Adicionar um projeto:** em `index.html`, copie um bloco `<article class="project">…</article>` inteiro, cole depois do último e troque número, textos e imagem.

**Adicionar um software:** copie uma linha `<div class="tool">…</div>`, troque o nome e o logo. O `--glow` (em R G B) é a cor do brilho do cartão.

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Recriado em código a partir do projeto do Framer "HenriqueRocha" (outubro de 2026). O Framer não sincroniza com o git: a partir daqui, este repositório é a versão oficial do site.
