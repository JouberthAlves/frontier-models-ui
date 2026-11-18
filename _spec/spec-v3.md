# Spec v3 — espaço no estilo "lançamento de modelo" + galáxia espiral + quebra da pista como evento

Complementa `_spec/spec.md` (v1) e `_spec/spec-v2.md` (v2). Em conflito, vale a v3. Leia `AGENTS.md` antes.

Referências aprovadas pelo usuário:
- `design/espaco/d-estilo-astra.png` — **o visual alvo do espaço** (o layout atual, reestilizado). Comparar com `design/espaco/espaco-atual.png` (como está hoje).
- A página de lançamento do GPT-6 Astra da OpenAI (openai.com/pt-BR/index/gpt-6-astra/), que o usuário mandou como referência: fundo quase preto, campo de estrelas fino e realista, uma **galáxia espiral de partículas** no hero, título dividido ("GPT" à esquerda, "Astra" à direita) com as letras embaralhando até formar a palavra, tipografia sans limpa em peso médio com espaçamento negativo, pílulas brancas (ação principal) e translúcidas, nada de card com borda e brilho. **Só a linguagem visual**: nenhum logo, nome, texto, fonte proprietária ou marca da OpenAI no site.
- `design/mockup-pista-cartoon.png` continua valendo para a parte da corrida (não muda nada nela).

## 1. Escopo
Muda só o **espaço** (do Orbitarium para baixo: Orbitarium, Prompts, Arquivo, Rodapé) e **como a pista se quebra**. A parte da corrida (hero, mapa, cards creme, carros na pista) fica como está.

## 2. A quebra da pista vira um evento (não mais presa à rolagem)
Pedido do usuário: "a rua é quebrada no final, não com o scroll".
- Enquanto houver **qualquer carro sobre a pista**, a pista inteira fica **intacta** (sem fatias apagando, sem pedaços soltos).
- Os carros continuam pela rolagem como hoje: correm, cruzam a chegada, saem do fim da pista e entram na gravidade zero (isso continua preso à rolagem).
- No momento em que **o último carro deixa o fim da pista**, dispara **uma animação com duração fixa** (~1,6 s, não depende da rolagem): o trecho final (o mesmo trecho que hoje se quebra) racha e os pedaços se soltam, giram, afastam e viram estrelas; o chão e o cenário do fim somem junto. Curva: rachar 250 ms, soltar e afastar 1,1 s com `cubic-bezier(.16,1,.3,1)`, virar estrela nos últimos 300 ms.
- Se a pessoa rolar de volta para cima até um carro voltar para a pista, a pista **se refaz** com a mesma animação ao contrário (ou um fade de 400 ms dos pedaços de volta ao lugar), uma vez.
- Implementação: Web Animations API ou rAF com relógio próprio, só `transform`/`opacity`, pausa com a aba oculta. Estado guardado (`broken: boolean`) para não disparar duas vezes.
- Movimento reduzido: sem animação; a pista fica inteira (como hoje).

## 3. Espaço: estilo novo (layout igual ao atual)
### 3.1 Tokens do espaço (escopo `.space` ou seções `#orbitarium`, `#prompts`, `#archive`, rodapé)
```
--sp-bg:#030406;  --sp-bg-2:#06080d;            /* fundo quase preto, leve navy nas bordas */
--sp-ink:#fafafa; --sp-ink-2:rgba(250,250,250,.62); --sp-ink-3:rgba(250,250,250,.42);
--sp-line:rgba(255,255,255,.12);                /* divisórias finas */
--sp-pill:rgba(255,255,255,.12); --sp-pill-hover:rgba(255,255,255,.18);
--sp-pill-solid:#fafafa; --sp-pill-solid-ink:#0a0a0a;
```
- Conferir AA: `--sp-ink-2` e `--sp-ink-3` sobre `--sp-bg` (texto pequeno precisa ≥ 4,5:1; se `.42` não passar, subir).
- **Fonte do espaço:** uma sans neo-grotesca limpa em peso 500 (Google Fonts: **Geist** ou **Inter Tight**; escolher uma e justificar no relatório). Títulos com `letter-spacing` negativo (~ -0.03em), tamanhos como o mockup. A Anybody larga sai do espaço (fica só na corrida). Carregar a fonte nova no mesmo link do Google Fonts e no loader (etapa 1).
- **Sem cards com caixa e brilho:** a lista do Orbitarium vira linhas com divisória `--sp-line` (sem fundo, sem borda arredondada), ponto na cor do modelo, nome 20 px branco, linha do prompt em `--sp-ink-2`, e dois botões em pílula: **"Abrir projeto"** sólido branco com texto preto e **"Código"** translúcido (`--sp-pill`) com texto branco. A linha selecionada (sincronizada com o planeta) ganha só um leve fundo `rgba(255,255,255,.04)` e o ponto maior — tira o StarBorder.
- **Mapa orbital:** órbitas em linha fina branca a ~18% de opacidade, sol como um brilho branco suave (não laranja cartoon), planetas como esferas pequenas com leve sombreado na cor do modelo, rótulos pequenos em `--sp-ink-2`.
- **Prompts:** abas em pílula translúcida (`--sp-pill`), a ativa sólida branca com texto preto; painel sem caixa pesada (divisória fina em cima e embaixo), texto em `--sp-ink`/`--sp-ink-2`, link "Ler o prompt" como pílula translúcida.
- **Arquivo:** tabela com divisórias finas, cabeçalho em `--sp-ink-3` caixa normal (sem caixa alta espaçada), chips de categoria como pílulas translúcidas (o "Atual" sólido branco com texto preto), filtros como pílulas translúcidas (o ativo sólido branco).
- **Rodapé:** mesmo estilo; a costura laranja→ciano pode ficar como fio fino.
- Barra de comparação e nav: no espaço podem ficar no vidro escuro de hoje (já combinam); conferir.

### 3.2 Título dividido (assinatura do espaço)
O h2 do Orbitarium vira duas palavras nas bordas do container, na mesma linha, grandes (clamp 48–88 px), peso 500: **"Orbitarium"** à esquerda e **"bench"** à direita, com a galáxia entre elas (≥ 1024 px). Abaixo de 1024, uma palavra sobre a outra, alinhadas à esquerda. Ao entrar na tela, as letras embaralham e resolvem (reaproveitar `bits/DecryptedText`, ~35 ms por passo, uma vez). O texto real fica acessível (o h2 continua "Orbitarium-bench" para leitores de tela).

### 3.3 Galáxia espiral de partículas (fundo do espaço)
- Substitui o fundo `Galaxy` do React Bits no espaço. **WebGL próprio** (sem biblioteca), `gl.POINTS` com tamanho por partícula e brilho por textura radial gerada em código, mistura aditiva.
- **Forma:** espiral de 2 braços logarítmicos saindo de um núcleo muito brilhante; ~7.000 partículas no desktop (3.000 no celular), densidade maior perto do núcleo, espalhamento ao longo dos braços, poeira fina entre os braços; mais ~600 estrelas de fundo soltas em todo o céu.
- **Cores:** maioria branco `#ffffff` e azul-gelo `#cfe3ff`/`#9cc4ff`, ~12% pêssego/laranja `#ffc79a`/`#ff9e6b`, núcleo branco quente. Tamanhos 1–4 px (DPR 1), algumas estrelas maiores com brilho.
- **Movimento:** rotação muito lenta (uma volta a cada ~6 min), leve inclinação 3D (a espiral levemente achatada, ~60°), parallax suave com a rolagem (a galáxia sobe mais devagar que a página). Pausa fora da tela e com a aba oculta.
- **Posição:** centralizada atrás do título dividido do Orbitarium (o núcleo entre "Orbitarium" e "bench"), ocupando ~70% da altura da janela; fixa enquanto a seção Orbitarium estiver na tela e saindo com ela; as estrelas de fundo cobrem o espaço inteiro.
- **Entrada:** quando a transição da corrida termina (o céu aparece), a galáxia "acende" em 1,2 s (partículas do núcleo para fora, opacidade 0→1). Os carros em gravidade zero continuam indo cada um para o seu planeta no mapa orbital (como hoje).
- **Regras do vault para WebGL:** só com GPU real (`hasGpu()`), DPR 1, começar no idle, teto de 30 fps no toque, vigia de 5 quadros > 120 ms que congela e dispara a faixa de aviso, `webglcontextlost` tratado. Compilar o shader durante o loader (etapa 5).
- **Sem GPU / movimento reduzido:** uma imagem parada da mesma espiral (renderizada em canvas 2D uma vez, ou pré-gerada como webp em `public/`), sem animação.

## 4. O que quem coda pode e não pode
- Pode: `npm install`, `tsc`, `lint`, `build`, ler arquivos e imagens.
- Não pode: servidor, navegador, print, git, mexer em `design/`, `_spec/`, dados gerados (`src/data/archive.json`, `public/scenes`, `public/map`). Pode **criar** um arquivo novo em `public/` para a imagem parada da galáxia, se escolher pré-gerar.
- Regras de sempre: sem palavras de ranking, sem FPS, só `transform`/`opacity` por quadro (exceções documentadas), sem rolagem lateral 375–1920, nada de contagem fixa, movimento reduzido estático, contraste AA.
- Atualizar `AGENTS.md` (o estilo do espaço e onde fica a galáxia).
- Ao terminar: build e lint limpos e relatório (arquivos, desvios e por quê, o que não fez, fonte escolhida, número de partículas).
