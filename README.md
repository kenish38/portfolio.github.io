# Portfólio — Henrique Rocha

Site do Henrique Rocha, desenvolvedor Roblox full-stack e engenheiro de IA. Site estático (HTML + CSS + JS, sem build), publicado pelo GitHub Pages.

Endereço: https://henriquerocha.dev.br/

O domínio é registrado no Registro.br. O arquivo `CNAME` na raiz diz ao GitHub Pages qual domínio usar, e a zona DNS no Registro.br (modo avançado) tem quatro registros `A` no nome em branco (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) e um `CNAME` de `www` para `kenish38.github.io`. O endereço antigo (`kenish38.github.io/portfolio.github.io/`) redireciona sozinho para o domínio.

Qualquer commit na branch `main` atualiza o site sozinho em 1 ou 2 minutos.

## As páginas

O site tem duas páginas:

- **Página inicial** (`index.html`): fundo grafite e, na abertura, uma janela com barra metálica (o endereço do site no lugar da barra de endereço) e o título com brilho. Depois vêm os trabalhos, o estúdio interativo (O que eu faço), a Workstation X, o Sobre mim, a loja e o contato.
  - **O show de abertura** (só na primeira visita da sessão): a janela liga, o endereço é digitado na barra, a linha de carregamento corre, o título se forma do pó e a nota e a barra do topo aparecem. Qualquer clique, tecla ou rolagem leva direto ao fim.
  - **O título riscado:** no primeiro movimento de rolagem, uma linha de luz risca cada linha de "Sou só mais um dev de Roblox." ("I'm just another Roblox dev."), as letras viram pó e "Eu construí meu próprio estúdio de IA." ("I built my own AI studio.") se forma no lugar. A troca é de mão única: voltando ao topo, a frase nova continua. Para ninguém passar direto sem ver a troca, o primeiro movimento de rolagem no topo (roda do mouse, dedo ou teclado) segura a página por um instante, só até o risco passar e a frase nova se formar (menos de 2 s); depois tudo rola normalmente. Pela barra de rolagem, pelas abas ou por um link nada segura, e quem pediu menos movimento também não é segurado.
  - **Os botões da janela, de brincadeira** (nenhum tira a janela do lugar): o vermelho "fecha" (a janela vira pó, aparece "Pode destruir. Eu reconstruo." e ela se reconstrói), o amarelo "minimiza" (a janela é sugada para dentro da bolinha num redemoinho de pó, aparece "Nada aqui fica pequeno." e ela volta explodindo da bolinha) e o verde "amplia" (uma onda de energia verde varre a janela com faíscas e um clarão: "Potência máxima."). O "+" abre o Discord.
  - **As abas da barra** (Trabalhos, Áreas, WSX, Sobre, Loja, Contato): a tela se desfaz em pó, da esquerda para a direita, e a página reaparece já na seção escolhida.
  - **O estúdio** (O que eu faço): uma cena 3D desenhada no próprio navegador, sem bibliotecas, que começa como a baseplate vazia do Roblox Studio (com o SpawnLocation no meio). A câmera tem perspectiva de verdade (o que está perto fica maior, então a base não parece torta em nenhum giro) e os blocos não têm contorno nas quinas. Ela gira devagar sozinha; arrastar gira (e, com o mouse, inclina); no celular, deslizar de lado gira e para cima rola a página. O sol faz sombra e cada material tem cor e brilho próprios. As ferramentas: Construir (cada clique ergue a próxima parte de uma fazenda, sempre na mesma ordem: casa do sítio, silo, curral com a vaquinha, moinho de vento, plantação, lago dos patos e pomar com caminhos; é uma obra por vez: enquanto uma sobe, o botão do canto mostra "Construindo…" e os cliques esperam; depois ele mostra a próxima obra), Iluminar (a noite cai e as luzes acendem uma a uma; o clique apaga e acende), Programar (um script em Luau é digitado e os blocos entram numa onda), Interface (um HUD de jogo com moedas para pegar) e IA (um pedido é digitado e a cena é montada bloco por bloco: torre, castelo, ponte, pirâmide, árvore). A fazenda tem vida: a vaca anda e pasta, os patos boiam e nadam, as árvores e a plantação balançam com o vento, as pás do moinho giram e sai fumaça da chaminé. Teclado: Enter age, as setas andam pelas casas (para as moedas) e Q/E giram. "Recomeçar" volta para a baseplate vazia.
  - **A Workstation X** (WSX): a seção do projeto mais ambicioso do Henrique, o estúdio de IA dele. Um mapa vivo mostra as partes (a orquestradora no meio, os cinco programas que ela opera, os dois analistas, o júri de dez jurados, a memória de lições e o Henrique como juiz final) com pulsos de luz percorrendo o ciclo Planeja, Constrói, Testa, Julga e Aprende; passar o mouse ou tocar numa parte explica o que ela faz. Embaixo vêm os números, os seis cartões de como ela funciona, um caso real em linha do tempo, os detalhes técnicos, o que ela faz sozinha e o que é sempre dele e, fechando, uma frase do Henrique ("Fazer a Workstation, sinceramente, é uma evolução constante."). O texto veio da própria orquestradora e não mostra nada interno: nada de pastas, contas, cota, clientes, nomes internos de regras ou projetos específicos.
  - **O Sobre mim:** o Henrique se apresenta em primeira pessoa ("Meu nome é Henrique Rocha."), com a foto, os selos (@kenish38, Minas Gerais, Notorious Workshop) e a dock com os programas que ele usa: os ícones entram um depois do outro, crescem sob o cursor com os vizinhos abrindo espaço, quicam ao clicar e a legenda (nome e para que serve) acompanha o ícone e some quando o mouse sai. No celular, a legenda some sozinha depois de alguns segundos.
  - **Toques pela página:** uma luz suave segue o cursor pelo fundo, os cartões de trabalho inclinam com um reflexo e os títulos das seções se formam do pó quando aparecem.
- **Painel do dono** (`admin/index.html`): onde o Henrique publica os trabalhos (ver abaixo).

O visual anterior (o nome recortado numa parede preta, com um mar de partículas 3D atrás) e o filme de partículas saíram do site em novembro de 2026. Tudo continua no histórico do git, se for preciso consultar.

## Como editar

| O que mudar | Onde |
| --- | --- |
| Textos da página inicial (inglês no elemento, português em `data-pt`) | `index.html`: abertura (`.hero`: as duas frases do título e a nota), o estúdio (`#skills`), a Workstation X (`#wsx`), o Sobre mim, a loja e o contato |
| O título riscado (tempos do risco e da troca, quanto rolar para trocar, quanto a página fica segura no primeiro movimento) | `js/title.js` (`STRIKE`, `OUT`, `IN`, `DOWN` e `HOLD`) |
| O show de abertura e os botões da janela (tempos, recados) | `js/show.js` |
| O pó: desfazer e formar (força da borda, vento, quantidade de grãos) | `js/ash.js` (`HRAsh.run`, `SHARP`, a função `drift`); a duração do efeito das abas é `DUR` |
| Abas da barra e a luz que marca a seção da vez | `js/home.js` |
| O estúdio (as partes da fazenda e a ordem delas em `FARM`, as cenas da IA em `SCENES`, o script em `CODE`, os materiais e modelos em `MAT`, o que se mexe em `motion()`, as cores do chão em `GROUND`, o tamanho `G` e a altura `MAXH`) | `js/studio.js`; os textos de cada ferramenta ficam no `index.html` (`<article class="studio__info">`) |
| A Workstation X (textos, números, cartões, caso real) e o mapa vivo (onde fica cada parte, os pulsos, a legenda) | `index.html` (`#wsx`); as posições das partes ficam no CSS (`.wsx__node--*`, uma para o computador e outra para o celular), em `css/site.css`; as ligações, os pulsos e os números que contam, em `js/wsx.js` |
| O texto do Sobre mim e a dock de programas (ícones, cores, para que servem) | `index.html` (`.about__text` e `.dock`); as cores ficam em `.app--*`, em `css/site.css`; a ampliação e os pulos da dock, em `js/about.js`. Os ícones são os oficiais, desenhados direto na página (SVG limpo, só caminhos e cores): Photoshop, Illustrator e After Effects vêm do site da Adobe (versão 2025); os três Substance 3D (Painter, Designer e Sampler) usam o desenho de 2021 a 2025, o que aparece no Google e nos programas instalados (a Adobe engrossou as letras em outubro de 2025; o Henrique preferiu o desenho conhecido); o ZBrush vem do kit de marca da Maxon; o Roblox Studio é o ícone atual do programa (desde 2025: o logo branco no quadrado quase preto) e o Blender é o ícone oficial do macOS (Blender 5.2: o logo grande no fundo escuro quente). O Marmoset Toolbag usa a marca do próprio site deles, em branco (`img/apps/marmoset.png`). O RizomUV usa o ícone que o Henrique mandou, limpo nas três cores dele (`img/apps/rizomuv.png`) |
| A luz que segue o cursor, os cartões que inclinam e os títulos que se formam do pó | `js/fx.js` |
| Portfólio, visualizador, botão da loja, copiar e-mail, botão do dono | `js/page.js` |
| Cores, fontes, brilho e espaçamentos | `css/site.css` (variáveis no topo, em `:root`) |

Quem pediu menos movimento no sistema não vê o show nem o pó: a aba só pula para a seção, o risco e a troca de frase acontecem só pelo brilho, e a maquete do estúdio não gira sozinha, os blocos aparecem sem cair e não há onda.

**A foto do Sobre mim:** são `img/henrique-800.webp` e `img/henrique-1200.webp` (800 x 920 e 1200 x 1380 px, já recortadas no formato da moldura, 4 de largura por 4,6 de altura); o navegador baixa a que basta para a tela (celular e computador comum ficam com a de 800; telas de alta resolução, com a de 1200). Para trocar, salve a foto nova com os mesmos nomes e tamanhos, em WebP de boa qualidade e sem os dados da câmera (data, aparelho e localização). A foto atual foi desespelhada (o ROBLOX do fundo estava ao contrário) e recortada da cintura para cima, com o crachá do Roblox. Ao trocar a foto, aumente o número do `?v=` nos endereços dela em `index.html`, para quem já visitou o site ver a nova na hora.

**Segurança da página:** o `<head>` de `index.html` tem uma regra (Content-Security-Policy) que só deixa a página carregar arquivos do próprio site, as capas e o player do YouTube. Nenhum script de fora roda ali, e o endereço henriquerocha.dev.br serve só este site: nenhum outro site consegue ler a chave do painel, que o navegador do dono guarda nesse endereço. Ao incluir algo de outro site (uma fonte, um vídeo de outro serviço), o endereço dele precisa entrar nessa regra. O script de uma linha do `<head>` (que marca a página com `js` e, na primeira visita da sessão, com `intro`, para o show começar sem nada piscar) é liberado pelo hash `sha256-...`: se ele mudar, o hash precisa ser refeito. Os estilos ficam todos em `css/site.css`: a regra não deixa usar `style="..."` no HTML (o JavaScript pode mudar estilos pelo `element.style`, que é permitido).

## Painel do dono (`admin/`)

O Henrique publica os trabalhos sozinho, pelo próprio site: https://henriquerocha.dev.br/admin/

- **Como entra:** na primeira vez em cada aparelho, o painel pede uma chave de acesso do GitHub (token *fine-grained*, só deste repositório, com **Contents: Read and write** e prazo de 90 dias; o passo a passo está na tela de entrada). Só chaves *fine-grained* (as que começam com `github_pat_`) são aceitas; uma chave clássica é recusada. "Lembrar a chave neste aparelho" começa desmarcado: sem ele, a chave fica só na aba e some ao fechar o navegador; marque nos seus aparelhos. O painel só funciona em https://henriquerocha.dev.br/admin/ (no endereço antigo do github.io ele não pede nem guarda nada; se você já colou uma chave lá, revogue no GitHub). Depois de entrar uma vez num navegador, um botão redondo com um lápis aparece no canto do site até você clicar em Sair; nenhum outro visitante vê o botão.
- **O que ele faz por lá:** envia imagens (reduzidas sozinhas para até 3200 px, em WebP, com miniatura), cola imagens com Ctrl+V, cola links de vídeos do YouTube, dá a cada trabalho título, descrição e categoria (em inglês e português), adiciona fotos extras a um trabalho (até 4 imagens por trabalho: a principal e mais 3), cria e organiza as categorias (em **Categorias**: nome em português e em inglês, ordem pelas setas, apagar; um trabalho de uma categoria apagada fica sem categoria), muda a ordem (arrastando pelo ⠿ ou pelas setas) e apaga trabalhos. Cada cartão do painel mostra a prévia do jeito que aparece no site. Nada vai ao ar até clicar em **Publicar**.
- **Segurança do painel:** ele só aceita imagens comuns, GIF e vídeos MP4/WebM (SVG não: pode levar código escondido), não abre dentro de outro site e só conversa com o GitHub. Fotos perdem os dados de localização ao serem reduzidas; nos vídeos MP4, a localização é apagada antes do envio (WebM vai como está). GIFs ganham uma miniatura parada: a animação só roda quando o trabalho é aberto.
- **O que o Publicar grava:** um commit só na `main`, com os arquivos novos em `media/`, a lista em `portfolio.json` e a remoção dos arquivos dos trabalhos apagados (um arquivo que outro trabalho ainda usa fica). O Publicar espera as fotos terminarem de ser preparadas, envia exatamente o que estava na tela no clique e, se outro aparelho publicou no meio do caminho, para e pede para recarregar. Tirar uma foto extra que já está no site pede confirmação. O site atualiza em 1 a 2 minutos.

> **Regra para qualquer atualização do código:** `media/` e `portfolio.json` são do dono do site. Nunca apague, mova ou sobrescreva esses arquivos, e sempre faça `git pull` da `main` antes de qualquer `git push` (o painel e o bot do Notorious também fazem commits nela). Assim os trabalhos enviados continuam no ar a cada atualização.

Onde mexer: `admin/index.html` (textos), `admin/admin.css`, `admin/admin.js` (o repositório, a branch e o endereço do site estão no topo, em `REPO`, `BRANCH` e `SITE`; os tamanhos das imagens, em `FULL`, `THUMB` e `POSTER`). O botão do dono é criado em `js/page.js` e desenhado em `.dev`, em `css/site.css`.

**Formato de `portfolio.json`** (é o painel que escreve; só edite à mão se precisar). Com a lista vazia aparece o estado vazio (três espaços vazios e o convite para pedir exemplos no Discord), que some sozinho quando houver itens. Em cima, as categorias; depois, cada item:

```json
{ "categories": [
  { "id": "map", "pt": "Mapas", "en": "Maps" },
  { "id": "pets", "pt": "Pets", "en": "Pets" }
], "items": [
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
- `categories`: as categorias, na ordem em que aparecem no site; `id` é a chave (letras minúsculas, números e hífen) e `pt`/`en`, os nomes. Sem essa lista, valem as de sempre (`map` Mapas, `model` Modelos 3D, `lighting` Iluminação e VFX, `script` Sistemas e scripts, `ui` Interfaces, `game` Jogos completos, `ai` Ferramentas de IA), que ficam em `DEFAULT_CATS`, em `js/page.js` e `admin/admin.js`.
- `kind` (opcional): a chave da categoria do trabalho. O nome dela aparece no cartão.
- `more` (opcional): fotos extras do trabalho, até 3 (4 imagens no total). No cartão, um selo diz quantas fotos são e pontinhos embaixo acompanham a da vez; com o mouse por cima, elas passam sozinhas. No visualizador, uma tira com as miniaturas leva direto a cada uma, e as setas passam por elas antes de ir para o próximo trabalho.
- Em cima da grade, as categorias que têm algum trabalho viram botões (Todos e cada categoria, com a contagem); um toque filtra a grade, e os cartões entram um depois do outro. Com uma categoria só, a barra não aparece. No visualizador, as setas andam dentro da categoria escolhida.
- Os cartões ficam em fileiras de três (dois no tablet, um no celular), e a última fileira fica centralizada.

**Prévia de link e busca:** as marcações ficam no `<head>` de `index.html` (Open Graph, cartão do X, dados estruturados) e a imagem do cartão é `img/share.jpg` (1200 x 630: um print da abertura em inglês, já com a frase nova do título, e a nota; se eles mudarem, a imagem precisa ser refeita). Os endereços ali são completos (`https://...`): se o endereço do site mudar, troque os cinco. Depois de publicar uma mudança no cartão, cole o link num canal privado do Discord para conferir (os aplicativos guardam a prévia por um tempo).

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
