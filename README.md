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

O nome é um recorte numa parede preta. Do outro lado há um campo de partículas que a rolagem conduz como um filme, num plano só, sem cortes: a baseplate vira tabuleiro e as peças de xadrez surgem do chão; o cavalo é erguido, desce na casa do peão e o peão tomba; a queda dele racha o tabuleiro, que estilhaça como espelho; a câmera mergulha atrás do peão e o contorna em câmera lenta, entre cacos e raios de luz; um dos brilhos se condensa numa bala, o tempo volta e ela estilhaça o peão; a câmera vai contra os tiros até a arma, que para de atirar, é arremessada, gira no ar e se desmonta no alto; o script dela é escrito, o código vira a HUD de um jogo de tiro e um clique leva à tela final. Depois que o visitante começa a rolar, o filme toca sozinho; rolar para trás pausa, e há botões de pausar e de pular o filme.

| O que mudar | Onde |
| --- | --- |
| Textos (inglês no elemento, português em `data-pt`) | `v2/index.html` |
| Cores, fontes e espaçamentos | `v2/css/site.css` (variáveis no topo, em `:root`) |
| Ordem e duração de cada passagem do filme | lista `beats` em `v2/js/main.js`; o fim é `TOTAL` ali e `--len` em `v2/css/site.css` (os dois precisam bater) |
| Planos de câmera (ângulo, distância, lente, inclinação, foco, o que a câmera segue) | lista `shots` em `v2/js/main.js`; os assuntos que ela pode seguir (cavalo, peão, bala, arma...) são registrados com `E.subject` nos `v2/js/film-*.js` |
| Quando cada palavra de fundo e legenda aparece | lista `scenes` em `v2/js/main.js` (um terceiro valor faz a legenda sair antes da palavra); `CAP_DIM` diz se e quando a legenda baixa de brilho. As legendas são curtas de propósito: cada uma precisa caber no tempo em que fica na tela (cerca de 17 a 20 caracteres por segundo) |
| Clarão e tremor dos impactos; ritmo do filme automático | listas `hits` e `PACE` em `v2/js/main.js` (velocidade base em `auto.speed`) |
| Mar de luz e baseplate | `v2/js/film-intro.js` |
| Tabuleiro, peças, captura e estilhaço | `v2/js/film-chess.js` (a partida está em `SET`; as poses de cada momento, no bloco "Poses") |
| Queda, raios de luz, bala, arma, código e HUD | `v2/js/film-gun.js` (cada peça da arma é um desenho em `PARTS`, com o deslocamento da vista explodida; os raios e tiros em `SHOTS`; o script mostrado em `CODE`; a frase final em `MSG`) |
| Etiquetas da arma desmontada | textos em `v2/index.html` (`.parts`); posição em `LABELS`, em `v2/js/film-gun.js`; quando aparecem, em `PARTS` de `v2/js/main.js` |
| Motor: paletas, shader, trilha de câmera | `v2/js/matter.js` |
| Paleta (hoje `perola`, branco e dourado) | `paletteName` em `v2/js/main.js`; as paletas ficam em `PALETTES`, em `v2/js/matter.js`. Para ver outra sem mexer no código, abra a página com `#gelo`, `#aurora`, `#ouro` ou `#brasa` no fim do endereço |
| Parede com o nome (espessura, cor das laterais) | `v2/js/wall.js` e a chamada `HRWall.create` em `v2/js/main.js` |
| O nome recortado | `v2/js/name-data.js`, gerado por `v2/tools/extract-name.py` |

A arma do filme é um desenho original, sem relação com modelos reais.

**Portfólio (imagem e vídeo):** a seção lê `v2/portfolio.json`. Com a lista vazia aparece o estado vazio (a baseplate com uma casa dourada e os botões para pedir exemplos no Discord), que some sozinho quando houver itens. Cada item:

```json
{ "items": [
  { "type": "image", "src": "media/mapa.webp", "thumb": "media/mapa-800.webp", "title": "Forest map: modeling and lighting", "title_pt": "Mapa de floresta: modelagem e iluminação" },
  { "type": "video", "src": "media/jogo.mp4", "poster": "media/jogo.jpg", "title": "Gameplay", "alt": "A round of the game from the player's view", "alt_pt": "Uma rodada do jogo vista pelo jogador" }
] }
```

- `thumb` (opcional): versão leve, com uns 800 px de largura, usada só na grade. `poster`: quadro de capa do vídeo (recomendado: sem ele o celular pode mostrar a miniatura em branco).
- `title` e `title_pt`: aparecem na grade e na barra do visualizador. Vale escrever "o que é: o que eu fiz". `alt` e `alt_pt` (opcionais): descrição para quem não vê a imagem.
- O primeiro item é o destaque da grade; ela fecha a última fileira com qualquer número de itens. No visualizador, as setas do teclado passam para o item anterior e o próximo.

**Prévia de link e busca:** as marcações ficam no `<head>` de `v2/index.html` (Open Graph, cartão do X, dados estruturados) e a imagem do cartão é `v2/img/share.jpg` (1200 x 630). Enquanto a página estiver em `/v2/` ela leva `noindex`. **Ao promover para a raiz:** tirar a linha do `noindex` e conferir os três endereços completos (`canonical`, `og:url`, `og:image`). Depois de publicar, colar o link num canal privado do Discord para ver o cartão (os aplicativos guardam a prévia por um tempo).

**Link direto em português:** `?lang=pt` no fim do endereço abre a página em português (`?lang=en` em inglês), independente do navegador.

**Fonte:** a Archivo é servida daqui (`v2/fonts/archivo-latin.woff2`, licença OFL; ver `v2/fonts/LEIAME.txt`), sem depender de outro site.

`v2/vendor/three.min.js` é a biblioteca three.js r160 (licença MIT em `v2/vendor/three.LICENSE`).

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Recriado em código a partir do projeto do Framer "HenriqueRocha" (outubro de 2026) e redesenhado depois. O Framer não sincroniza com o git: este repositório é a versão oficial do site.
