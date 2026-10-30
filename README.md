# Portfólio — Henrique Rocha

Portfólio de mapas, assets e modelos 3D para Roblox. Site estático (HTML + CSS + JS, sem build), publicado pelo GitHub Pages.

Endereço: https://kenish38.github.io/portfolio.github.io/

## Como editar

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

| O que mudar | Onde |
| --- | --- |
| Textos de todas as seções | `index.html` (cada seção tem um comentário `<!-- ==== NOME ==== -->`). O texto visível é o inglês; o português fica no atributo `data-pt` do mesmo elemento |
| Cores, fontes, tamanhos e espaçamentos | `styles.css` (as cores principais ficam no topo, em `:root`) |
| Vidro com chuva da abertura | `script.js` (ajustes de gotas, névoa e luz no topo do arquivo) |
| Troca de idioma | `i18n.js` |
| Imagens dos projetos | `assets/img/` (cada projeto tem a versão `.jpg` original e versões leves `-800.webp` e `-1600.webp`) |
| Ícone da aba | `assets/img/favicon.svg` |

**Loja Notorious Workshop:** a seção da loja lê `notorious/store.json` e as imagens de `notorious/products/`. Esses arquivos são publicados sozinhos pelo bot do Notorious (repositório `notorious-workshop-bot`), direto na branch `main`. **Não edite nem apague a pasta `notorious/`**, e sempre faça `git pull` antes de `git push`, porque o bot também faz commits aqui. A marca oficial da loja fica em `assets/notorious-brand/`.

**Contatos:** o link do Discord aparece em 3 lugares de `index.html` (abertura, seção de contato e barra do celular). Procure por `discord.com/users` e troque o final pelo seu ID do Discord. O e-mail aparece nos mesmos lugares (`mailto:`).

**Adicionar um projeto:** em `index.html`, copie um bloco `<article class="work">…</article>` inteiro, cole depois do último e troque:
- `id` (`project-4`, `project-5`…);
- `data-type`: `map` (mapa), `asset` (assets/kit) ou `model` (modelo avulso). Os filtros aparecem sozinhos conforme os tipos que existem;
- `data-scene`: a imagem que aparece atrás do vidro da abertura (cada relâmpago troca de projeto);
- imagens, textos em inglês e os `data-pt` em português.

Para a miniatura do projeto aparecer na abertura, adicione também um `<li>` na lista `.reel` com `href="#project-N"`.

**Mais imagens no mesmo projeto:** dentro de `.work__thumbs`, adicione `<button type="button" class="work__thumb" data-full="IMAGEM-GRANDE"><img src="IMAGEM" alt="..."></button>`. Clicar abre em tamanho cheio.

**Gerar as versões leves de uma imagem nova** (opcional, deixa o site mais rápido):

```bash
python3 -c "from PIL import Image; im=Image.open('assets/img/projeto-4.jpg').convert('RGB'); [im.resize((w, round(im.height*w/im.width)), Image.LANCZOS).save(f'assets/img/projeto-4-{w}.webp', quality=80) for w in (800, 1600)]"
```

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Recriado em código a partir do projeto do Framer "HenriqueRocha" (outubro de 2026) e redesenhado depois. O Framer não sincroniza com o git: este repositório é a versão oficial do site.
