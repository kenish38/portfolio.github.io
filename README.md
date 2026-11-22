# Portfólio — Henrique Rocha

Site do Henrique Rocha, desenvolvedor Roblox full-stack e engenheiro de IA. Site estático (HTML + CSS + JS, sem build), publicado pelo GitHub Pages.

Endereço: https://kenish38.github.io/portfolio.github.io/

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

## As páginas

O site tem duas páginas:

- **Página inicial** (`index.html`): os trabalhos vêm logo depois da abertura. A abertura mostra o nome como um objeto selecionado num editor 3D, com a função e os botões. Depois vêm o portfólio, as áreas de atuação, a loja e o contato.
- **Painel do dono** (`admin/index.html`): onde o Henrique publica os trabalhos (ver abaixo).

**O desenho (novembro de 2026):** a página é como a janela de um editor 3D, clara e limpa. O nome é o objeto selecionado: uma caixa de seleção azul com alças, sobre a grade da baseplate. A alça vermelha à direita estica e estreita o nome pelo eixo de largura da fonte, com o mouse, o dedo ou as setas do teclado. O nome começa na maior largura que cabe na tela (125% no computador, 100% no celular), e a alça nunca passa disso.

**Regras do desenho** (para ele continuar coerente ao ser editado):
- O azul só aparece no que está selecionado ou pode ser clicado: a caixa do nome, o foco do teclado, o hover, o idioma ativo. Passar o mouse num trabalho o deixa "selecionado", com a mesma caixa.
- O vermelho é só a alça do eixo X. Fora isso, nada leva cor: quem tem cor são os trabalhos.
- Uma família só (Archivo): larga no nome e nos títulos, normal no texto.
- Tudo alinhado à esquerda e em frases normais (sem títulos em caixa alta). As áreas de atuação não têm números, porque não são uma sequência.
- Um movimento só, na chegada: a seleção se fecha em volta do nome. Quem pede "menos movimento" no sistema não vê nem esse.

O filme de partículas e o motor dele (three.js, `js/matter.js`, a parede com o nome) saíram do site em novembro de 2026. Continuam no histórico do git, se for preciso consultar.

## Como editar

| O que mudar | Onde |
| --- | --- |
| Textos da página inicial (inglês no elemento, português em `data-pt`) | `index.html`: abertura (`.hero`), portfólio, áreas (`#skills`, uma `<li class="area">` por área), loja e contato |
| Cores, fontes e espaçamentos | `css/site.css` (variáveis no topo, em `:root`) |
| Tamanho do nome, folgas da caixa e tamanho da alça | `--name`, `--stretch`, `--hw` em `:root` e `--bt`/`--br`/`--bb`/`--bl` em `.hero`, em `css/site.css` |
| A alça que estica o nome; a linha da barra ao rolar | `js/hero.js` |
| Portfólio, visualizador, botão da loja, copiar e-mail, botão do dono | `js/page.js` |
| Ícone da aba e imagem da prévia de link | `img/favicon.svg` (`favicon-32.png` e `apple-touch-icon.png` são cópias dele em PNG) e `img/share.jpg` |

Se o nome mudar, o desenho da abertura precisa de outra medida: `--name-em` em `css/site.css` é a largura medida da linha mais larga do nome, e `SLOPE` em `js/hero.js` é quanto ela cresce a cada 1% de largura.

## Painel do dono (`admin/`)

O Henrique publica os trabalhos sozinho, pelo próprio site: https://kenish38.github.io/portfolio.github.io/admin/

- **Como entra:** na primeira vez em cada aparelho, o painel pede uma chave de acesso do GitHub (token *fine-grained*, só deste repositório, com **Contents: Read and write**; o passo a passo está na tela de entrada). A chave fica guardada só naquele navegador. Depois disso, um botão redondo com um lápis aparece no canto do site sempre que ele entrar por aquele aparelho; nenhum outro visitante vê o botão.
- **O que ele faz por lá:** envia imagens (reduzidas sozinhas para até 3200 px, em WebP, com miniatura), cola links de vídeos do YouTube, muda a ordem, escreve os títulos em inglês e português e apaga trabalhos. Nada vai ao ar até clicar em **Publicar**.
- **O que o Publicar grava:** um commit só na `main`, com os arquivos novos em `media/`, a lista em `portfolio.json` e a remoção dos arquivos dos trabalhos apagados. O site atualiza em 1 a 2 minutos.

> **Regra para qualquer atualização do código:** `media/` e `portfolio.json` são do dono do site. Nunca apague, mova ou sobrescreva esses arquivos, e sempre faça `git pull` da `main` antes de qualquer `git push` (o painel e o bot do Notorious também fazem commits nela). Assim os trabalhos enviados continuam no ar a cada atualização.

Onde mexer: `admin/index.html` (textos), `admin/admin.css`, `admin/admin.js` (o repositório e a branch estão no topo, em `REPO` e `BRANCH`; os tamanhos das imagens, em `FULL`, `THUMB` e `POSTER`). O botão do dono é criado em `js/page.js` e desenhado em `.dev`, em `css/site.css`.

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

**Prévia de link e busca:** as marcações ficam no `<head>` de `index.html` (Open Graph, cartão do X, dados estruturados) e a imagem do cartão é `img/share.jpg` (1200 x 630, o nome selecionado e a função, no desenho da abertura: se a função mudar, a imagem precisa ser refeita). Os endereços ali são completos (`https://...`): se o endereço do site mudar, troque os cinco. Depois de publicar uma mudança no cartão, cole o link num canal privado do Discord para conferir (os aplicativos guardam a prévia por um tempo).

**Link direto em português:** `?lang=pt` no fim do endereço abre a página em português (`?lang=en` em inglês), independente do navegador.

**Fonte:** a Archivo é servida daqui (`fonts/archivo-latin.woff2`, licença OFL; ver `fonts/LEIAME.txt`), sem depender de outro site.

**Contatos:** o link do Discord aparece em 4 lugares de `index.html` (abertura, estado vazio do portfólio, cartão de contato e dados estruturados do `<head>`). Procure por `discord.com/users` e troque o final pelo ID do Discord. O e-mail fica no cartão de contato (`mailto:` e `data-copy`).

**Loja Notorious Workshop:** a faixa da loja mostra a marca (`assets/notorious-brand/`) e, quando existe `notorious/store.json` com um convite válido, o botão para entrar no Discord da loja. A pasta `notorious/` é publicada sozinha pelo bot do Notorious (repositório `notorious-workshop-bot`), direto na branch `main`. **Não edite nem apague a pasta `notorious/`**, e sempre faça `git pull` antes de `git push`, porque o bot também faz commits aqui.

**Endereço antigo:** `v2/index.html` só leva para a raiz quem ainda tem o link de quando a página nova ficava em `/v2/`.

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Começou como uma recriação em código do projeto do Framer "HenriqueRocha" (outubro de 2026) e foi refeito do zero como filme de partículas (novembro de 2026). Depois o filme saiu e a página foi redesenhada do zero, clara e limpa, com o nome como objeto selecionado. O Framer não sincroniza com o git: este repositório é a versão oficial do site.
