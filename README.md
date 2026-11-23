# Portfólio — Henrique Rocha

Site do Henrique Rocha, desenvolvedor Roblox full-stack e engenheiro de IA. Site estático (HTML + CSS + JS, sem build), publicado pelo GitHub Pages.

Endereço: https://henriquerocha.dev.br/

O domínio é registrado no Registro.br. O arquivo `CNAME` na raiz diz ao GitHub Pages qual domínio usar, e a zona DNS no Registro.br (modo avançado) tem quatro registros `A` no nome em branco (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) e um `CNAME` de `www` para `kenish38.github.io`. O endereço antigo (`kenish38.github.io/portfolio.github.io/`) redireciona sozinho para o domínio.

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

## As páginas

O site tem duas páginas:

- **Página inicial** (`index.html`): fundo grafite e, na abertura, uma janela com barra metálica (o endereço do site no lugar da barra de endereço) e o título com brilho. Enquanto a pessoa rola, a janela fica parada: o título "I build worlds, systems & whole games." é riscado linha por linha e "I bring imagination into reality." acende no lugar dele. Depois vêm os trabalhos, as áreas de atuação, a loja e o contato. Ao clicar numa aba da barra (Trabalhos, Áreas, Loja, Contato), a tela se desfaz em pó, da esquerda para a direita, e a página reaparece já na seção escolhida.
- **Painel do dono** (`admin/index.html`): onde o Henrique publica os trabalhos (ver abaixo).

O visual anterior (o nome recortado numa parede preta, com um mar de partículas 3D atrás) e o filme de partículas saíram do site em novembro de 2026. Tudo continua no histórico do git, se for preciso consultar.

## Como editar

| O que mudar | Onde |
| --- | --- |
| Textos da página inicial (inglês no elemento, português em `data-pt`) | `index.html`: abertura (`.hero`: as duas frases do título e a nota), áreas (`#skills`, um `<article class="area">` por área), loja e contato |
| Quando o risco e a troca de frase acontecem na rolagem | `title()` em `js/home.js` (as etapas, de 0 a 1); o comprimento do trecho preso é `--run` em `.hero`, em `css/site.css` |
| Abas da barra e a luz que marca a seção da vez | `js/home.js` |
| Efeito de virar pó ao clicar numa aba (duração, quantidade de pó, vento) | `js/ash.js` (`DUR`, `perFrame` e a função `drift`) |
| Portfólio, visualizador, botão da loja, copiar e-mail, botão do dono | `js/page.js` |
| Cores, fontes, brilho e espaçamentos | `css/site.css` (variáveis no topo, em `:root`) |

Quem pediu menos movimento no sistema não vê o efeito de pó (a aba só pula para a seção), e a troca de frase acontece só pelo brilho.

**Segurança da página:** o `<head>` de `index.html` tem uma regra (Content-Security-Policy) que só deixa a página carregar arquivos do próprio site, as capas e o player do YouTube. Nenhum script de fora roda ali, e por isso nada consegue ler a chave do painel, que o navegador do dono guarda no mesmo endereço. Ao incluir algo de outro site (uma fonte, um vídeo de outro serviço), o endereço dele precisa entrar nessa regra. O script de uma linha do `<head>` é liberado pelo hash `sha256-...`: se ele mudar, o hash precisa ser refeito.

## Painel do dono (`admin/`)

O Henrique publica os trabalhos sozinho, pelo próprio site: https://henriquerocha.dev.br/admin/

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

**Prévia de link e busca:** as marcações ficam no `<head>` de `index.html` (Open Graph, cartão do X, dados estruturados) e a imagem do cartão é `img/share.jpg` (1200 x 630: um print da abertura, com o título e a nota; se eles mudarem, a imagem precisa ser refeita). Os endereços ali são completos (`https://...`): se o endereço do site mudar, troque os cinco. Depois de publicar uma mudança no cartão, cole o link num canal privado do Discord para conferir (os aplicativos guardam a prévia por um tempo).

**Link direto em português:** `?lang=pt` no fim do endereço abre a página em português (`?lang=en` em inglês), independente do navegador.

**Fontes:** a Archivo (`fonts/archivo-latin.woff2`) e a Bodoni Moda Italic (`fonts/bodoni-moda-italic-latin.woff2`) são servidas daqui, sem depender de outro site (as duas com licença OFL; ver `fonts/LEIAME.txt`).

**Contatos:** o link do Discord aparece em 5 lugares de `index.html` (barra do topo, nota da abertura, estado vazio dos trabalhos, contato e dados estruturados do `<head>`). Procure por `discord.com/users` e troque o final pelo ID do Discord. O e-mail fica no contato (`mailto:` e `data-copy`).

**Loja Notorious Workshop:** a faixa da loja mostra a marca (`assets/notorious-brand/`) e, quando existe `notorious/store.json` com um convite válido, o botão para entrar no Discord da loja. A pasta `notorious/` é publicada sozinha pelo bot do Notorious (repositório `notorious-workshop-bot`), direto na branch `main`. **Não edite nem apague a pasta `notorious/`**, e sempre faça `git pull` antes de `git push`, porque o bot também faz commits aqui.

## Ver no computador antes de publicar

Abra o `index.html` direto no navegador, ou sirva a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Origem

Começou como uma recriação em código do projeto do Framer "HenriqueRocha" (outubro de 2026), foi refeito do zero como filme de partículas e depois virou a página com o nome recortado na parede (novembro de 2026). No fim de novembro de 2026 ganhou o visual atual, com a janela e o título riscado. O Framer não sincroniza com o git: este repositório é a versão oficial do site.
