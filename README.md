# Portfólio — Henrique Rocha

Site do Henrique Rocha, desenvolvedor Roblox full-stack. Site estático (HTML + CSS + JS, sem build), publicado pelo GitHub Pages.

Endereço: https://kenish38.github.io/portfolio.github.io/

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

## A página

O nome é um recorte numa parede preta. Do outro lado há um campo de partículas que a rolagem conduz como um filme, num plano só, sem cortes: a baseplate vira tabuleiro e as peças de xadrez surgem do chão; o cavalo é erguido, desce na casa do peão e o peão tomba; a queda dele racha o tabuleiro, que estilhaça como espelho; a câmera mergulha atrás do peão e o contorna em câmera lenta, entre cacos e raios de luz; um dos brilhos se condensa numa bala, o tempo volta e ela estilhaça o peão; a câmera vai contra os tiros até a arma, que para de atirar, é arremessada, gira no ar e se desmonta no alto; o script dela é escrito, o código vira a HUD de um jogo de tiro e um clique leva à tela final. Depois que o visitante começa a rolar, o filme toca sozinho; rolar para trás pausa, e há botões de pausar e de pular o filme.

## Como editar

| O que mudar | Onde |
| --- | --- |
| Textos (inglês no elemento, português em `data-pt`) | `index.html` |
| Cores, fontes e espaçamentos | `css/site.css` (variáveis no topo, em `:root`) |
| Ordem e duração de cada passagem do filme | lista `beats` em `js/main.js`; o fim é `TOTAL` ali e `--len` em `css/site.css` (os dois precisam bater) |
| Planos de câmera (ângulo, distância, lente, inclinação, foco, o que a câmera segue) | lista `shots` em `js/main.js`; os assuntos que ela pode seguir (cavalo, peão, bala, arma...) são registrados com `E.subject` nos `js/film-*.js` |
| Quando cada palavra de fundo e legenda aparece | lista `scenes` em `js/main.js` (um terceiro valor faz a legenda sair antes da palavra); `CAP_DIM` diz se e quando a legenda baixa de brilho. As legendas são curtas de propósito: cada uma precisa caber no tempo em que fica na tela (cerca de 17 a 20 caracteres por segundo) |
| Clarão e tremor dos impactos; ritmo do filme automático | listas `hits` e `PACE` em `js/main.js` (velocidade base em `auto.speed`) |
| Mar de luz e baseplate | `js/film-intro.js` |
| Tabuleiro, peças, captura e estilhaço | `js/film-chess.js` (a partida está em `SET`; as poses de cada momento, no bloco "Poses") |
| Queda, raios de luz, bala, arma, código e HUD | `js/film-gun.js` (cada peça da arma é um desenho em `PARTS`, com o deslocamento da vista explodida; os raios e tiros em `SHOTS`; o script mostrado em `CODE`; a frase final em `MSG`) |
| Etiquetas da arma desmontada | textos em `index.html` (`.parts`); posição em `LABELS`, em `js/film-gun.js`; quando aparecem, em `PARTS` de `js/main.js` |
| Motor: paletas, shader, trilha de câmera | `js/matter.js` |
| Paleta (hoje `perola`, branco e dourado) | `paletteName` em `js/main.js`; as paletas ficam em `PALETTES`, em `js/matter.js`. Para ver outra sem mexer no código, abra a página com `#gelo`, `#aurora`, `#ouro` ou `#brasa` no fim do endereço |
| Parede com o nome (espessura, cor das laterais) | `js/wall.js` e a chamada `HRWall.create` em `js/main.js` |
| O nome recortado | `js/name-data.js`, gerado por `tools/extract-name.py` |

A arma do filme é um desenho original, sem relação com modelos reais.

## Painel do dono (`admin/`)

O Henrique publica os trabalhos sozinho, pelo próprio site: https://kenish38.github.io/portfolio.github.io/admin/

- **Como entra:** na primeira vez em cada aparelho, o painel pede uma chave de acesso do GitHub (token *fine-grained*, só deste repositório, com **Contents: Read and write**; o passo a passo está na tela de entrada). A chave fica guardada só naquele navegador. Depois disso, um botão redondo com um lápis aparece no canto do site sempre que ele entrar por aquele aparelho; nenhum outro visitante vê o botão.
- **O que ele faz por lá:** envia imagens (reduzidas sozinhas para até 3200 px, em WebP, com miniatura), cola links de vídeos do YouTube, muda a ordem, escreve os títulos em inglês e português e apaga trabalhos. Nada vai ao ar até clicar em **Publicar**.
- **O que o Publicar grava:** um commit só na `main`, com os arquivos novos em `media/`, a lista em `portfolio.json` e a remoção dos arquivos dos trabalhos apagados. O site atualiza em 1 a 2 minutos.

> **Regra para qualquer atualização do código:** `media/` e `portfolio.json` são do dono do site. Nunca apague, mova ou sobrescreva esses arquivos, e sempre faça `git pull` da `main` antes de qualquer `git push` (o painel e o bot do Notorious também fazem commits nela). Assim os trabalhos enviados continuam no ar a cada atualização.

Onde mexer: `admin/index.html` (textos), `admin/admin.css`, `admin/admin.js` (o repositório e a branch estão no topo, em `REPO` e `BRANCH`; os tamanhos das imagens, em `FULL`, `THUMB` e `POSTER`). O botão do dono é criado no fim de `js/main.js` e desenhado em `.dev`, em `css/site.css`.

**Formato de `portfolio.json`** (é o painel que escreve; só edite à mão se precisar). Com a lista vazia aparece o estado vazio (a baseplate com uma casa dourada e os botões para pedir exemplos no Discord), que some sozinho quando houver itens. Cada item:

```json
{ "items": [
  { "type": "image", "src": "media/mapa.webp", "thumb": "media/mapa-mini.webp", "title": "Forest map: modeling and lighting", "title_pt": "Mapa de floresta: modelagem e iluminação" },
  { "type": "youtube", "src": "https://youtu.be/XXXXXXXXXXX", "title": "Gameplay trailer", "title_pt": "Trailer do jogo" },
  { "type": "video", "src": "media/jogo.mp4", "poster": "media/jogo-capa.webp", "title": "Gameplay" }
] }
```

- `type`: `image`, `youtube` (o site mostra a capa do vídeo e só carrega o player do YouTube quando o visitante abre) ou `video` (arquivo MP4/WebM curto, até 50 MB).
- `thumb` (opcional): versão leve usada só na grade. `poster`: quadro de capa de um vídeo em arquivo.
- `title` e `title_pt`: aparecem na grade e na barra do visualizador. Vale escrever "o que é: o que eu fiz". `alt` e `alt_pt` (opcionais): descrição para quem não vê a imagem.
- O primeiro item é o destaque da grade; ela fecha a última fileira com qualquer número de itens. No visualizador, as setas do teclado passam para o item anterior e o próximo.

**Prévia de link e busca:** as marcações ficam no `<head>` de `index.html` (Open Graph, cartão do X, dados estruturados) e a imagem do cartão é `img/share.jpg` (1200 x 630). Os endereços ali são completos (`https://...`): se o endereço do site mudar, troque os cinco. Depois de publicar uma mudança no cartão, cole o link num canal privado do Discord para conferir (os aplicativos guardam a prévia por um tempo).

**Link direto em português:** `?lang=pt` no fim do endereço abre a página em português (`?lang=en` em inglês), independente do navegador.

**Fonte:** a Archivo é servida daqui (`fonts/archivo-latin.woff2`, licença OFL; ver `fonts/LEIAME.txt`), sem depender de outro site.

`vendor/three.min.js` é a biblioteca three.js r160 (licença MIT em `vendor/three.LICENSE`).

**Contatos:** o link do Discord aparece em 4 lugares de `index.html` (tela final do filme, estado vazio do portfólio, cartão de contato e dados estruturados do `<head>`). Procure por `discord.com/users` e troque o final pelo ID do Discord. O e-mail fica no cartão de contato (`mailto:` e `data-copy`).

**Loja Notorious Workshop:** a faixa da loja mostra a marca (`assets/notorious-brand/`) e, quando existe `notorious/store.json` com um convite válido, o botão para entrar no Discord da loja. A pasta `notorious/` é publicada sozinha pelo bot do Notorious (repositório `notorious-workshop-bot`), direto na branch `main`. **Não edite nem apague a pasta `notorious/`**, e sempre faça `git pull` antes de `git push`, porque o bot também faz commits aqui.

**Endereço antigo:** `v2/index.html` só leva para a raiz quem ainda tem o link de quando a página nova ficava em `/v2/`.

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Começou como uma recriação em código do projeto do Framer "HenriqueRocha" (outubro de 2026) e foi refeito do zero como filme de partículas (novembro de 2026). O Framer não sincroniza com o git: este repositório é a versão oficial do site.
