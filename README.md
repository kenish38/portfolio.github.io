# Portfólio — Henrique Rocha

Site do Henrique Rocha, desenvolvedor Roblox full-stack e engenheiro de IA. Site estático (HTML + CSS + JS, sem build), publicado pelo GitHub Pages.

Endereço: https://henriquerocha.dev.br/

O domínio é registrado no Registro.br. O arquivo `CNAME` na raiz diz ao GitHub Pages qual domínio usar, e a zona DNS no Registro.br (modo avançado) tem quatro registros `A` no nome em branco (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) e um `CNAME` de `www` para `kenish38.github.io`. O endereço antigo (`kenish38.github.io/portfolio.github.io/`) redireciona sozinho para o domínio.

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

## As páginas

O site tem duas páginas:

- **Página inicial** (`index.html`): fundo grafite e, na abertura, uma janela com barra metálica (o endereço do site no lugar da barra de endereço) e o título com brilho. Depois vêm os trabalhos, as áreas de atuação (cada uma numa mini janela), a loja e o contato.
  - **O show de abertura** (só na primeira visita da sessão): a janela liga, o endereço é digitado na barra, a linha de carregamento corre, o título se forma do pó e a nota e a barra do topo aparecem. Qualquer clique, tecla ou rolagem leva direto ao fim.
  - **O título riscado:** no primeiro movimento de rolagem, uma linha de luz risca cada linha de "I build worlds, systems & whole games.", as letras viram pó e "I bring imagination into reality." se forma no lugar. De volta ao topo, a troca se desfaz. A página rola normalmente o tempo todo.
  - **Os botões da janela, de brincadeira:** vermelho "fecha" (a janela vira pó, avisa que não dá para fechar um mundo e se reconstrói), amarelo minimiza e volta, verde amplia para a largura toda. O "+" abre o Discord.
  - **As abas da barra** (Trabalhos, Áreas, Loja, Contato): a tela se desfaz em pó, da esquerda para a direita, e a página reaparece já na seção escolhida.
- **Painel do dono** (`admin/index.html`): onde o Henrique publica os trabalhos (ver abaixo).

O visual anterior (o nome recortado numa parede preta, com um mar de partículas 3D atrás) e o filme de partículas saíram do site em novembro de 2026. Tudo continua no histórico do git, se for preciso consultar.

## Como editar

| O que mudar | Onde |
| --- | --- |
| Textos da página inicial (inglês no elemento, português em `data-pt`) | `index.html`: abertura (`.hero`: as duas frases do título e a nota), áreas (`#skills`, um `<article class="area">` por área, com a mini janela de cada uma), loja e contato |
| O título riscado (tempos do risco e da troca, quanto rolar para trocar) | `js/title.js` (`STRIKE`, `OUT`, `IN` e `DOWN`) |
| O show de abertura e os botões da janela (tempos, recados) | `js/show.js` |
| O pó: desfazer e formar (força da borda, vento, quantidade de grãos) | `js/ash.js` (`HRAsh.run`, `SHARP`, a função `drift`); a duração do efeito das abas é `DUR` |
| Abas da barra e a luz que marca a seção da vez | `js/home.js` |
| Portfólio, visualizador, botão da loja, copiar e-mail, botão do dono | `js/page.js` |
| Cores, fontes, brilho e espaçamentos | `css/site.css` (variáveis no topo, em `:root`) |

Quem pediu menos movimento no sistema não vê o show nem o pó: a aba só pula para a seção, e o risco e a troca de frase acontecem só pelo brilho.

**Segurança da página:** o `<head>` de `index.html` tem uma regra (Content-Security-Policy) que só deixa a página carregar arquivos do próprio site, as capas e o player do YouTube. Nenhum script de fora roda ali, e por isso nada consegue ler a chave do painel, que o navegador do dono guarda no mesmo endereço. Ao incluir algo de outro site (uma fonte, um vídeo de outro serviço), o endereço dele precisa entrar nessa regra. O script de uma linha do `<head>` (que marca a página com `js` e, na primeira visita da sessão, com `intro`, para o show começar sem nada piscar) é liberado pelo hash `sha256-...`: se ele mudar, o hash precisa ser refeito. Os estilos ficam todos em `css/site.css`: a regra não deixa usar `style="..."` no HTML (o JavaScript pode mudar estilos pelo `element.style`, que é permitido).

## Painel do dono (`admin/`)

O Henrique publica os trabalhos sozinho, pelo próprio site: https://henriquerocha.dev.br/admin/

- **Como entra:** na primeira vez em cada aparelho, o painel pede uma chave de acesso do GitHub (token *fine-grained*, só deste repositório, com **Contents: Read and write** e prazo de 90 dias; o passo a passo está na tela de entrada). Com "Lembrar a chave neste aparelho" marcado, ela fica guardada naquele navegador; desmarcado, fica só na aba e some ao fechar o navegador. Enquanto a chave está guardada, um botão redondo com um lápis aparece no canto do site; nenhum outro visitante vê o botão.
- **O que ele faz por lá:** envia imagens (reduzidas sozinhas para até 3200 px, em WebP, com miniatura), cola imagens com Ctrl+V, cola links de vídeos do YouTube, dá a cada trabalho título, descrição e tipo (em inglês e português), adiciona fotos extras a um trabalho, muda a ordem (arrastando pelo ⠿ ou pelas setas) e apaga trabalhos. Cada cartão do painel mostra a prévia do jeito que aparece no site. Nada vai ao ar até clicar em **Publicar**.
- **Segurança do painel:** ele só aceita imagens comuns, GIF e vídeos MP4/WebM (SVG não: pode levar código escondido), não abre dentro de outro site e só conversa com o GitHub.
- **O que o Publicar grava:** um commit só na `main`, com os arquivos novos em `media/`, a lista em `portfolio.json` e a remoção dos arquivos dos trabalhos apagados. O site atualiza em 1 a 2 minutos.

> **Regra para qualquer atualização do código:** `media/` e `portfolio.json` são do dono do site. Nunca apague, mova ou sobrescreva esses arquivos, e sempre faça `git pull` da `main` antes de qualquer `git push` (o painel e o bot do Notorious também fazem commits nela). Assim os trabalhos enviados continuam no ar a cada atualização.

Onde mexer: `admin/index.html` (textos), `admin/admin.css`, `admin/admin.js` (o repositório e a branch estão no topo, em `REPO` e `BRANCH`; os tamanhos das imagens, em `FULL`, `THUMB` e `POSTER`). O botão do dono é criado em `js/page.js` e desenhado em `.dev`, em `css/site.css`.

**Formato de `portfolio.json`** (é o painel que escreve; só edite à mão se precisar). Com a lista vazia aparece o estado vazio (três espaços vazios e o convite para pedir exemplos no Discord), que some sozinho quando houver itens. Cada item:

```json
{ "items": [
  { "type": "image", "src": "media/mapa.webp", "thumb": "media/mapa-mini.webp", "title": "Forest map: modeling and lighting", "title_pt": "Mapa de floresta: modelagem e iluminação",
    "kind": "map", "desc": "Hand-placed trees, late afternoon light.", "desc_pt": "Árvores colocadas à mão, luz de fim de tarde.",
    "more": [ { "src": "media/mapa-2.webp", "thumb": "media/mapa-2-mini.webp" } ] },
  { "type": "youtube", "src": "https://youtu.be/XXXXXXXXXXX", "title": "Gameplay trailer", "title_pt": "Trailer do jogo" },
  { "type": "video", "src": "media/jogo.mp4", "poster": "media/jogo-capa.webp", "title": "Gameplay" }
] }
```

- `type`: `image`, `youtube` (o site mostra a capa do vídeo e só carrega o player do YouTube quando o visitante abre) ou `video` (arquivo MP4/WebM curto, até 50 MB).
- `thumb` (opcional): versão leve usada só na grade. `poster`: quadro de capa de um vídeo em arquivo.
- `title` e `title_pt`: aparecem no cartão e na barra do visualizador. Vale escrever "o que é: o que eu fiz". `desc` e `desc_pt` (opcionais, até 240 letras): aparecem no visualizador. `alt` e `alt_pt` (opcionais): descrição para quem não vê a imagem (sem eles, vale a descrição ou o título).
- `kind` (opcional): o tipo de trabalho, que aparece no cartão: `map` (Mapa), `model` (Modelo 3D), `lighting` (Iluminação e VFX), `script` (Sistemas e scripts), `ui` (Interface), `game` (Jogo completo) ou `ai` (Ferramenta de IA). Os nomes ficam em `KINDS`, em `js/page.js` e `admin/admin.js`.
- `more` (opcional): fotos extras do trabalho. O cartão mostra quantas fotos ele tem, e no visualizador as setas passam por elas antes de ir para o próximo trabalho.
- Os cartões ficam em fileiras de três (dois no tablet, um no celular), e a última fileira fica centralizada.

**Prévia de link e busca:** as marcações ficam no `<head>` de `index.html` (Open Graph, cartão do X, dados estruturados) e a imagem do cartão é `img/share.jpg` (1200 x 630: um print da abertura, com o título e a nota; se eles mudarem, a imagem precisa ser refeita). Os endereços ali são completos (`https://...`): se o endereço do site mudar, troque os cinco. Depois de publicar uma mudança no cartão, cole o link num canal privado do Discord para conferir (os aplicativos guardam a prévia por um tempo).

**Buscadores:** `robots.txt` deixa todos os buscadores lerem o site e aponta para `sitemap.xml`, a lista de páginas (uma só). Os dois só funcionam na raiz do domínio próprio. Para acompanhar como o site aparece no Google, vale cadastrar o domínio no Google Search Console (ele pede um registro TXT no Registro.br, como o da verificação do GitHub).

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
