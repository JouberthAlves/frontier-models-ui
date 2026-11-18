# Spec v2 — "Corrida até o céu": pista em S, cenário cartoon pastel, carros pela rolagem

Complementa `_spec/spec.md` (v1). Tudo que a v1 diz continua valendo, **menos** o que esta v2 troca. Em conflito, vale a v2. Leia também `AGENTS.md` (regras do repo, carros neutros, cores de modelo) antes de codar.

Referências visuais aprovadas pelo usuário:
- `design/mockup-pista-cartoon.png` — **o visual alvo** (aprovado: "exatamente desse jeito"). Erros do gerador que NÃO devem ser copiados: os nomes inventados nos cards ("Costa Azul", "Cânion Dourado"…) e as miniaturas inventadas (no site entram os dados e prints reais); a vila em perspectiva 3/4 (no site tudo é visto de cima).
- `design/prototipo-pista.html` — a mecânica aprovada (carros pela rolagem, chegada, pista que se desfaz, gravidade zero, carro vira planeta). O traçado dele é reto demais: o traçado real é o S em volta do conteúdo (§2).
- `design/opcoes-corrida.html` — o loading escolhido é o **C1 (luzes de largada)** e o hover escolhido é o **D3 (decifrar)**.

## 0. A história da página

De cima para baixo: o site abre com as 5 luzes de largada acendendo enquanto carrega; as luzes apagam e a página aparece. A página inteira, do hero até o fim do Racing, é **um mapa de um circuito costeiro visto de cima, em cartoon pastel**, com a pista em S contornando os blocos de conteúdo. **Carros neutros** começam alinhados no grid de largada dentro do hero e andam pela pista **conforme a rolagem**, em fila, sem ultrapassar. O dia cai ao descer: luz dourada no topo, entardecer no meio, anoitecer no fim do Racing. Os carros cruzam a **linha de chegada**; logo depois a pista e o cenário **se desfazem** em pedaços que viram estrelas, o fundo vira o céu (Galaxy), e cada carro flutua em **gravidade zero** até virar o planeta de um modelo no mapa do Orbitarium. Do Orbitarium para baixo, a página é o espaço escuro da v1. Rolando para cima, tudo volta.

## 1. O que sai da v1

- Hero dividido "Pista e Céu": saem o polígono da pista, a costura diagonal com halo e o `TrackTrails` (rastros). Apagar `TrackTrails.tsx` e o CSS morto.
- Véu quente do Racing (`Background`): sai. O véu frio do Orbitarium fica.
- `EchoText` (hover dos nomes): sai; entra o D3 (§7). Apagar o componente se não for mais usado.
- O Galaxy não aparece mais no topo: só a partir da transição (§5).

## 2. Layout e traçado da pista

### 2.1 Zona da corrida
"Zona da corrida" = do topo da página até a linha de chegada, que fica logo depois do último bloco do Racing (a nota "Os sites e números…"). Tudo nela fica sobre o mapa. Nav e barra de comparação continuam como na v1 (vidro escuro: é o HUD).

### 2.2 Blocos que alternam de lado (≥ 1100 px)
Os blocos de conteúdo da zona da corrida deixam de ocupar a coluna central e passam a alternar de lado, deixando a outra metade para a pista e o cenário, como no mockup:

| Bloco | Lado | Largura |
|---|---|---|
| Hero (título, texto, números, botões) | esquerda | ~52% do conteúdo |
| Racing: título, texto e seletor das 12 cenas | direita | ~58% |
| Palco de comparação | **largura total** (as imagens precisam de espaço); a pista passa pelas margens laterais ao lado dele | 100% do container |
| Os 6 jogos + nota | esquerda | ~62% |

Container máximo 1240 px. Entre blocos, vão vertical de 180–260 px para a pista atravessar. Cada bloco declara o lado num `data-track-side="left|right|full"`, e o traçado é calculado dos retângulos reais (não de números fixos).

### 2.3 Traçado
- A pista começa no **grid de largada** dentro do hero, no lado livre (direita, no alto, como o mockup), e termina na linha de chegada, centralizada, ~120 px abaixo do último bloco.
- Entre o grid e a chegada ela **contorna cada bloco pelo lado livre** e atravessa a página **nos vãos** entre blocos, com curvas largas (raio mínimo 90 px no desktop). Ao lado do bloco de largura total, desce pela margem livre mais larga (mínimo 72 px de margem; se a janela não deixar, passa por trás do bloco nesse trecho).
- **y sempre crescente** ao longo do caminho (os carros são posicionados por "y alvo → comprimento"). Curvas em S, nunca laço.
- Geração: pontos de passagem calculados dos retângulos (com folga de 28 px + metade da largura da pista) → curva suave (Catmull-Rom convertida em Béziers cúbicas) → `path`. Recalcular em `resize` (debounce 150 ms), quando as fontes carregam e quando a altura de um bloco muda (ResizeObserver no `main`), sem refazer o cenário se só a altura mudou pouco (< 2 px).
- Desenho (SVG): asfalto `#6d7486` (cinza-azulado pastel) largura 54 px desktop / 30 px celular; zebras dos dois lados com `stroke-dasharray` vermelho `#e8786f` e branco `#fbf7ef` (largura da pista + 10); faixa central branca tracejada `rgba(255,255,255,.7)`; sombra suave por baixo (`#000` 12%, blur pequeno, deslocada 3 px). Grid de largada: 5 retângulos brancos em zigue-zague e a linha de largada xadrez. Linha de chegada: faixa xadrez preto/branco de 14 px atravessando a pista + duas bandeirinhas nas bordas.

### 2.4 Larguras menores
- **768–1099 px:** blocos em largura total (como hoje); a pista atravessa nos vãos e desce pelas margens (que crescem para 64 px nesta faixa). Cenário só nas margens e nos vãos.
- **< 768 px:** blocos em largura total, opacos; a pista (30 px) serpenteia **por trás** dos blocos e aparece nos vãos (vãos de 120 px) e nas margens de 16 px. Cenário reduzido (~40% da densidade). Carros a 0,62 da escala.
- Nunca rolagem lateral: o SVG fica num invólucro `overflow: clip` de largura 100%.

## 3. Cenário cartoon pastel (visto de cima)

### 3.1 Paleta (tokens novos em `tokens.css`)
```
--map-grass:#b9dca0; --map-grass-2:#a9d18e; --map-grass-dark:#8fc07a;
--map-sand:#f3dfb8;  --map-sand-2:#ead09f;
--map-sea:#8fd3df;   --map-sea-deep:#6fc2d3; --map-foam:#ffffff;
--map-roof:#e9a27f;  --map-roof-2:#d98a68;  --map-wall:#fbf3e6;
--map-tree:#7fbf7a;  --map-tree-2:#6aae68;  --map-trunk:#b58a63;
--map-rock:#c9c1b4;  --map-water:#9fd6e3;   --map-wood:#c79a6b;
--map-asphalt:#6d7486; --map-kerb-red:#e8786f; --map-kerb-white:#fbf7ef;
--map-shadow:rgba(40,52,40,.16);
--card-cream:#fff8ef; --card-line:#ecdcc6; --ink-navy:#0f1a2b; --ink-navy-2:#465670; --link-warm:#b4581b;
```
Estilo: formas arredondadas e chapadas, sombra suave deslocada (3–6 px para baixo e direita, `--map-shadow`), sem contorno preto, sem textura fotográfica. Tudo visto de cima.

### 3.2 Peças (um `<symbol>` cada, num `<defs>` só)
Palmeira (copa em estrela de 6–7 folhas + sombra), árvore redonda (2 tons + sombra), pinheiro/árvore densa, arbusto, casa (planta retangular com telhado de duas águas: duas metades em `--map-roof`/`--map-roof-2` e cumeeira), igreja (telhado em cruz + torre quadrada com sino), cerca (tracejado de madeira), pedras (2–3 formas), guarda-sol de praia, barquinho, ponte de madeira (tábuas), canteiro de flores. 2 a 3 variações por peça (escala, rotação, tom), escolhidas pela semente.

### 3.3 Zonas, de cima para baixo (frações da altura da zona da corrida)
| Fração | Zona | O que tem | Cena correspondente |
|---|---|---|---|
| 0–0,22 | Orla | mar turquesa entrando pela borda esquerda e pelo topo (forma orgânica com espuma branca em onda), faixa de areia, palmeiras, guarda-sóis, barquinho | S1, S3 |
| 0,22–0,42 | Falésia e campo | grama, borda de falésia (degrau `--map-sand-2` com sombra), árvores redondas, pedras | S4 |
| 0,42–0,66 | Vila | casas com telhado terracota, igreja com torre, cercas, canteiros, praça de areia | S5 |
| 0,66–0,90 | Bosque | árvores densas e pinheiros, um riacho (`--map-water`) que cruza a página na horizontal e passa **sob a pista com uma ponte de madeira** no ponto em que se cruzam | S6, S7 |
| 0,90–1 | Chegada | grama mais escura, arquibancada simples (faixas coloridas) junto da linha de chegada | — |

### 3.4 Distribuição
- Fundo da zona: grama em `--map-grass` com manchas `--map-grass-2` grandes e suaves; areia e mar só na orla.
- Peças distribuídas por **amostragem de disco de Poisson com semente fixa** (gerador `mulberry32`), excluindo: retângulos dos blocos de conteúdo (+24 px), o corredor da pista (largura da pista / 2 + 14 px), e uma área calma atrás do texto do hero (para ler o título). Densidade alvo no desktop: ~1 peça a cada 9.000 px² de área livre, teto de 650 elementos no SVG inteiro (medir e ficar abaixo).
- Mesmo layout de cenário para a mesma largura (semente + largura arredondada a 50 px), para não "pular" no resize.
- Árvores e casas nunca sobre a pista nem sobre o riacho; a ponte é colocada no cruzamento riacho × pista.

### 3.5 Hora do dia
Camada de tinta por cima do mapa (abaixo dos blocos), um único `linearGradient` vertical na altura da zona: topo `rgba(255,196,120,.16)` (dourado) → 50% transparente → 85% `rgba(60,70,120,.18)` → fim `rgba(16,30,53,.55)` (entardecer, já puxando para o navy). Nas últimas 400 px antes da chegada, aparecem as primeiras 20–30 estrelas pequenas (pontos brancos, opacidade crescente).

## 4. Carros

- **Mocks neutros**, todos iguais (`AGENTS.md`): vistos de cima, corpo `#fff3e3`, faixa central `#fdaf6d`, para-brisa `#2a3140`, 4 pneus `#1d1f25`, faróis `#fff6d8`, sombra suave. Tamanho 20×38 px (desktop) / ×0,62 (celular). Nunca cor de modelo na pista.
- **Quantidade = número de execuções atuais do Orbitarium** (`archive.json`). Nada de "5" no código.
- Espaçamento de 58 px ao longo da pista, em fila; o líder vai na frente, os outros seguem. Sem ultrapassagem.
- **Pela rolagem:** com a página no topo, os carros estão parados no grid do hero. Ao rolar, o líder vai para a posição do caminho cujo y está a ~58% da altura da janela (com a transição suave do grid descrita no protótipo: `blend` nos primeiros 60% de uma tela). O resto segue a 58 px. Rotação pela tangente do caminho. Sem inércia própria: posição é função da rolagem (rolar para cima desfaz).
- Implementação: amostrar o `path` a cada 4 px uma vez por layout (tabela comprimento → x, y, ângulo) e fazer busca binária por y; por quadro só `transform` nos `<g>` dos carros. rAF com flag (uma atualização por quadro), listener `passive`.
- Rodinhas: um leve balanço de 1° no corpo ligado à velocidade da rolagem (opcional, só com movimento ligado).

## 5. Chegada, pista que se desfaz, gravidade zero

- **Chegada:** quando o líder cruza a linha, as bandeirinhas fazem um aceno curto (rotate ±8°, 600 ms, uma vez). A pista segue ~260 px depois da chegada e acaba.
- **Pista e cenário se desfazem** (progresso `T` = quanto o líder passou da chegada, sobre ~1,1 tela): os últimos ~900 px da pista e do cenário em volta se quebram em pedaços (asfalto, zebra vermelha e branca, folhas verdes, telhas) — pré-gerados no layout, 150–260 pedaços — que se soltam com deslocamento e rotação aleatórios (semente), encolhem e clareiam até virar pontos brancos/azulados (estrelas). Só `transform`/`opacity` (os atributos de posição do SVG podem ser usados no `<g>` de cada pedaço via `transform`). A grama do fim da zona some por opacidade.
- **Céu:** o Galaxy (fixo, da v1) liga quando `T > 0` (montar com antecedência quando a chegada estiver a uma tela de distância, se houver GPU) e sua opacidade vai de 0 a 1 com `T`. Sem GPU: o campo de estrelas em CSS da v1, com a mesma opacidade. O fundo da página abaixo da chegada é o navy da v1.
- **Gravidade zero:** cada carro, ao passar do fim da pista, entra num trajeto Bézier cúbico do fim da pista até **o planeta do seu modelo** no `OrbitMap` (na ordem de `current_arena` do Orbitarium; o planeta é lido ao vivo com `getBoundingClientRect`, porque ele gira). No trajeto: gira devagar (220–400° no total, sentido alternado), escala de 1 → 0,55, a pintura vai do creme para a **cor do modelo** (`colorOf`), e no fim (t > 0,75) o carro some e o planeta aparece (opacidade) com um anel que se abre uma vez (r 11 → 28, opacidade 0,6 → 0, 500 ms). Os planetas e rótulos do `OrbitMap` começam invisíveis e só aparecem quando o carro chega; voltando para cima, somem de novo.
- O progresso de cada carro é função da rolagem (nada de timers), então rolar rápido ou devagar dá o mesmo resultado.

## 6. Hero e cards da zona da corrida

- **Hero:** o título "FRONTIER / MODELS" fica em navy `--ink-navy` (wdth 125, peso 900), na ignição por StrokeText: traço `--ink-navy` desenha e preenche em navy (o mesmo tempo da v1). Abaixo do título, um sublinhado de 6 px em degradê `#ffb76b → #80e9f2` que se desenha da esquerda (700 ms, depois do preenchimento): é a "costura" da v1 virando detalhe. Texto de apoio `--ink-navy-2`, números navy com fios `--card-line`, botão primário laranja (texto `#1a0f08`), secundário com borda e texto navy. O hero não é card: fica direto sobre a areia/grama, com a área calma do cenário (§3.4) atrás.
- **Cards da zona da corrida** (Racing intro+seletor, palco, 6 jogos): fundo `--card-cream`, borda 1 px `--card-line`, raio 20 px, sombra `0 14px 36px rgba(60,40,20,.14)`, padding 28 px. Texto `--ink-navy`, secundário `--ink-navy-2`, links `--link-warm` (AA sobre creme). Títulos h2 por StrokeText com traço `--ink-navy`.
- Seletor de cenas, palco e cards dos jogos: mesmas funções da v1, recoloridos para o creme. Nome do modelo no palco (SplitFlap): tiles na cor do modelo, texto `--ink-navy`. Contorno da cena ativa `#e07b3c`.
- Contraste AA em tudo (conferir `--ink-navy-2` e `--link-warm` sobre `--card-cream`; cor de modelo só como fundo de tile/ponto/barra, nunca como cor de texto sobre creme).
- A barra de comparação, a nav e o visor seguem escuros (HUD). A nav sobre o mapa: vidro escuro já na primeira tela (sem o estado transparente da v1).
- Do Orbitarium para baixo, nada muda em relação à v1 (cards escuros sobre o espaço).

## 7. Hover dos nomes (D3 · decifrar)
Nos nomes dos modelos — cards "Os 6 jogos" (h3), palco (depois que o SplitFlap terminou), lista do Orbitarium e tabela do Arquivo — ao passar o mouse ou focar: as letras embaralham e resolvem da esquerda para a direita (35 ms por passo, 2 passos por letra, charset `A–Z 0–9 < > /`), com a cor do modelo durante o embaralhar (escurecida para AA sobre creme: `color-mix(in oklab, <cor> 55%, #0f1a2b)`; no escuro, a cor pura) e a cor normal no fim. Largura travada (sem pular layout: cada letra num slot com a largura da letra final, ou fonte com `font-variant-numeric: tabular-nums` + `ch` fixo). Texto real sempre acessível (o efeito é `aria-hidden`). Só com `(hover: hover)` e movimento ligado; com teclado, no `:focus-visible`. Reaproveitar `bits/DecryptedText` (modo `animateOn: hover`).

## 8. Loading C1 · luzes de largada
- Tela cheia por cima de tudo ao abrir: fundo `#080f1d`, o painel das luzes no centro (5 colunas × 2 luzes, cada luz 28–34 px, apagada `#2b1515`, acesa `#e8423a` com brilho), embaixo o texto "Carregando o grid" / "Loading the grid" e o progresso real (`3 / 5`).
- **Progresso real**, 5 etapas, cada uma acende uma coluna quando termina: (1) `document.fonts.ready`; (2) `archive.json` e o mapa/pista calculados; (3) as 12 miniaturas `-640` do primeiro modelo da comparação; (4) as `-1600` da cena S1 dos modelos escolhidos; (5) o shader do Galaxy compilado (sem GPU: etapa conta como feita). Imagens pré-carregadas com `new Image()` guardadas num array (Aprendizados de LP, Pré-carregamento).
- Quando as 5 colunas acendem: espera 400 ms, **todas apagam juntas** ("luzes apagadas" = largada), a tela some em 450 ms (opacity) e a ignição do hero começa (§6). O resto das imagens carrega em `requestIdleCallback`.
- **Teto de 12 s:** se passar, acende o que faltar, apaga e abre assim mesmo. Não travar a rolagem depois de aberto.
- Movimento reduzido: as luzes acendem sem brilho animado e a tela some sem transição.
- Acessível: `role="status"`, `aria-live="polite"` com "Carregando 3 de 5"; foco não fica preso; o conteúdo existe por baixo (para leitores e SEO).

## 9. Movimento reduzido, sem GPU, desempenho
- Movimento reduzido: mapa e pista estáticos; carros **parados no grid**; nada se desfaz; planetas do Orbitarium visíveis desde o início; Galaxy desligado (campo de estrelas CSS); faixa de aviso da v1.
- Sem GPU real: mapa e carros funcionam (SVG + transform); Galaxy desligado; planetas giram só com GPU (v1).
- Orçamento: ≤ 650 elementos no SVG do mapa; por quadro só `transform`/`opacity` de carros e pedaços visíveis (pedaços fora do trecho da transição ficam `display:none`); nenhuma leitura de layout por quadro, exceto o retângulo dos planetas durante a gravidade zero (5 leituras).
- Lighthouse mobile ≥ 85 de desempenho (o loading conta).

## 10. Dados e manutenção
- Quantidade de carros e destino: `archive.json` (Orbitarium `current_arena`). Cor: `colorOf` em `models.ts`. Nada escrito à mão.
- Atualizar o `AGENTS.md` se algo do fluxo "adicionar modelo" mudar com esta versão (ex.: onde ficam as peças do cenário e como mudar a semente).
- Textos novos (loading, aria-labels) em `pt.ts` e `en.ts`.

## 11. O que quem coda pode e não pode fazer
- Pode: `npm install`, `npm run sync` (não deve ser preciso), `npx tsc -b`, `npm run lint`, `npm run build`, ler `design/` e `_spec/`, consultar documentação.
- **Não pode:** subir servidor, abrir navegador, tirar print, fazer commit ou push, escrever no repo `Frontiers-Models`, mexer em `design/`, `_spec/` ou nos dados gerados.
- Ao terminar: build e lint limpos, e um relatório curto: arquivos criados/alterados/apagados, desvios do spec e por quê, o que não fez, contagem de elementos do SVG do mapa em 1440 px (estimativa pelo código).
