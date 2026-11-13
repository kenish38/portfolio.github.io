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

## Nova landing page (pasta `v2/`), ainda não publicada

Versão nova do site, em aprovação. Fica em `v2/` e não substitui a página atual até ser promovida para a raiz. Para ver: `npx serve .` e abrir `/v2/`.

O nome é um recorte numa parede preta. Do outro lado há um campo de partículas que a rolagem conduz como um filme: a baseplate vira tabuleiro, as peças de xadrez sobem, o cavalo recua, salta e arremessa um peão, o peão bate e o tabuleiro racha e estilhaça como espelho, o peão cai em câmera lenta entre os cacos, os "raios de sol" disparam (eram tiros) e um deles estilhaça o peão, a câmera volta pela linha dos tiros até a arma, a arma é desmontada peça por peça, o script dela é escrito, o código vira a HUD de um jogo de tiro e um clique leva à tela final. Depois que o visitante começa a rolar, o filme toca sozinho; rolar para trás pausa, e há botões de pausar e de pular o filme.

| O que mudar | Onde |
| --- | --- |
| Textos (inglês no elemento, português em `data-pt`) | `v2/index.html` |
| Cores, fontes e espaçamentos | `v2/css/site.css` (variáveis no topo, em `:root`) |
| Ordem e duração de cada passagem do filme | lista `beats` em `v2/js/main.js`; o fim é `TOTAL` ali e `--len` em `v2/css/site.css` (os dois precisam bater) |
| Quando cada palavra de fundo e legenda aparece | lista `scenes` em `v2/js/main.js` |
| Clarão e tremor dos impactos; ritmo do filme automático | listas `hits` e `PACE` em `v2/js/main.js` (velocidade base em `auto.speed`) |
| Mar de luz e baseplate | `v2/js/film-intro.js` |
| Tabuleiro, peças, captura e estilhaço | `v2/js/film-chess.js` (a partida está em `SET`; as poses de cada momento, no bloco "Poses") |
| Queda, tiros, arma, código e HUD | `v2/js/film-gun.js` (peças da arma em `PARTS`; o script mostrado em `CODE`; a frase final em `MSG`) |
| Motor: paletas, shader, câmera | `v2/js/matter.js` |
| Paleta (hoje `perola`, branco e dourado) | `paletteName` em `v2/js/main.js`; as paletas ficam em `PALETTES`, em `v2/js/matter.js`. Para ver outra sem mexer no código, abra a página com `#gelo`, `#aurora`, `#ouro` ou `#brasa` no fim do endereço |
| Parede com o nome (espessura, cor das laterais) | `v2/js/wall.js` e a chamada `HRWall.create` em `v2/js/main.js` |
| O nome recortado | `v2/js/name-data.js`, gerado por `v2/tools/extract-name.py` |

A arma do filme é um desenho original, sem relação com modelos reais.

**Portfólio (imagem e vídeo):** a seção lê `v2/portfolio.json`. Com a lista vazia, aparecem os espaços em planta. Cada item:

```json
{ "items": [
  { "type": "image", "src": "media/mapa.webp", "title": "Forest map", "title_pt": "Mapa de floresta" },
  { "type": "video", "src": "media/jogo.mp4", "poster": "media/jogo.jpg", "title": "Gameplay" }
] }
```

O primeiro item é o destaque da grade. `v2/vendor/three.min.js` é a biblioteca three.js r160 (licença MIT em `v2/vendor/three.LICENSE`).

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Recriado em código a partir do projeto do Framer "HenriqueRocha" (outubro de 2026) e redesenhado depois. O Framer não sincroniza com o git: este repositório é a versão oficial do site.
