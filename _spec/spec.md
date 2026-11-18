# Spec — Frontier Models UI · direção B "Pista e Céu"

Fonte da verdade para o código. Quem coda lê só este arquivo, os mockups em `design/` e os arquivos citados. Tudo em português na conversa; o site é bilíngue (PT/EN).

## 0. O que é

Interface para navegar pelas execuções do arquivo de benchmarks **Frontier Models** (repo local `C:/Users/jouberth.macedo/Documents/jouberth/www/Frontiers-Models`, fork `JouberthAlves/Frontiers-Models`, commit fixado `a71127c12508e4b7b35e62a711d3ef98986e0f4c`). Dois benchmarks:

- **Racing-bench V3.4**: cada modelo recebeu o mesmo prompt (25.790 bytes) e 14 imagens de referência e entregou um jogo de corrida 3D completo num circuito costeiro, com 5 oponentes de IA. 6 execuções atuais, cada uma com 12 prints de cena (S1–S12).
- **Orbitarium-bench**: cada modelo construiu um produto interativo de Sistema Solar a partir de uma especificação densa de produto. 5 execuções atuais. Sem prints.

A página tem um trabalho: **despertar a curiosidade de comparar** os projetos lado a lado e levar a pessoa a abrir o jogo/site ao vivo ou o código arquivado.

Direção escolhida pelo usuário: **B · Pista e Céu** — metade pista de F1 noturna, metade céu de planetário, costuradas por uma diagonal laranja→ciano; o título atravessa as duas e troca de cor no cruzamento. Mockup de referência: `design/mockup-b-pista-ceu.png` (a fonte itálica do mockup está errada: usar Anybody; a galáxia do mockup é foto: no site é o shader Galaxy).

## 1. Regras que não se quebram

1. **Nada de ranking, nota, vencedor, medalha, pódio, posição, "melhor".** Ordem de exibição = ordem de `current_arena` do RUNS.json. Proibido no código, nos dados gerados e na copy (PT e EN): `score`, `rank`, `ranking`, `rating`, `winner`, `best`, `weighted`, `evaluation`, `pontuação`, `avaliação`, `vencedor`, `melhor`, `nota`. Nada de FPS, "33/34 testes", contagem de linhas ou de arquivos como métrica de qualidade. Não mostrar `reported_verification`, `site_status` nem números de FPS (os nomes de arquivo dos prints têm FPS: nunca exibir o nome do arquivo).
2. Não escrever nada dentro do repo `Frontiers-Models` (só leitura via `git show`).
3. Site apagado (`live_url` null) aparece como texto "Excluído"/"Deleted", sem link.
4. Links de código apontam para a cópia arquivada no Frontiers Models: `https://github.com/JouberthAlves/Frontiers-Models/tree/<commit>/benchmarks/<pasta-do-benchmark>/<archive_path|target_path>`. Nunca linkar `source_repository` nem `legacy_source_repository`.
5. Nome "GPT-5.6 Sol" (nunca "Sun"); os ids `gpt-5.6-sun-max-*` ficam como estão nos dados.
6. `prefers-reduced-motion: reduce` → todo efeito vai direto ao estado final parado. Sem rolagem lateral da página em nenhuma largura (375, 390, 768, 1024, 1440, 1920).
7. Animação só com `transform` e `opacity` (exceções listadas em §6: o desenho do traço SVG via `stroke-dashoffset` e o `clip-path` do preenchimento, que são o efeito de assinatura).
8. Revelar ao rolar: `IntersectionObserver` com `threshold: 0` e `rootMargin: "0px 0px -12% 0px"`; estado final `clip-path: inset(0 0 0 0)` (nunca `none`); rede de segurança: tudo que espera revelação aparece sozinho após 2,5 s se o observer não disparar (janela oculta). rAF sempre com fallback de `setTimeout`.
9. Grade com um card maior que os outros: `align-items: start`.
10. Texto que pode crescer (nome de modelo, caminho) quebra com `overflow-wrap: anywhere` dentro do próprio container.

## 2. Stack e estrutura

- **Vite 6 + React 19 + TypeScript** (strict). CSS puro com tokens (`src/styles/tokens.css`, `global.css` e CSS por componente, sem Tailwind). **gsap** (core + ScrollTrigger) só para StrokeText. Sem outras libs de UI.
- `npm` (há `package-lock.json`). Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `sync`, `lint` (eslint flat config, react-hooks).
- Pastas:
  ```
  scripts/sync.mjs             # gera src/data/archive.json + public/scenes/**
  src/data/archive.json        # gerado, versionado
  src/data/models.ts           # cores por modelo (abaixo)
  src/data/scenes.ts           # nomes das 12 cenas PT/EN
  src/i18n/{pt,en}.ts, i18n.tsx
  src/components/bits/         # adaptações do React Bits (cabeçalho de licença em cada arquivo)
  src/components/…             # seções
  public/scenes/<runId>/sN-640.webp e sN-1600.webp
  public/favicon.svg, public/robots.txt, public/sitemap.xml
  ```
- Lembrete do PC: `core.autocrlf=true`; o `.gitattributes` do repo da UI já força LF. Ler dados do fork sempre por `git -C <fork> show <sha>:<path>` (vem com LF e é o conteúdo exato do commit).

## 3. Dados — `scripts/sync.mjs`

Node ESM, roda com `npm run sync -- --fork ../Frontiers-Models --commit a71127c` (padrões: `../Frontiers-Models` e o commit acima; resolver o sha completo com `git rev-parse`). Usa `sharp` (devDependency; já testado neste PC, funciona).

1. Ler `benchmarks/racing/RUNS.json` e `benchmarks/solar-system/RUNS.json` via `git show`.
2. Normalizar para `src/data/archive.json`:
   ```ts
   type Category = "current" | "legacy" | "historical" | "outdated" | "non-frontier";
   interface Run {
     key: string;            // `${benchmark}:${id}` (ids se repetem entre benchmarks)
     benchmark: "racing" | "orbitarium";
     id: string; model: string;
     category: Category;
     order: number | null;   // índice em current_arena; null fora da arena
     liveUrl: string | null; // racing: live_url ?? site_url; orbitarium: live_url
     sourceUrl: string | null; // github tree da cópia arquivada; null se não houver caminho
     recordUrl: string | null; // para quem não tem código (GPT-5.6 Luna): blob de RUN-PROVENANCE.md
     prompt: string | null;  // chave do prompt (ex. "racing-v3.4", "frontier-v2"); null = prompt não verificado no arquivo
     scenes?: { n: number; w: number; h: number }[]; // só racing atual
   }
   ```
   Categoria:
   - racing: `current_arena` → current; `legacy_runs` → legacy; `non_frontier_runs` → non-frontier.
   - orbitarium: `current_arena` → current; `role === "historical-baseline"` → historical; `role` começando com `outdated` → outdated; `role === "non-frontier-run"` → non-frontier.
   - Prompt racing: derivar a chave pelo caminho (`prompts/racing-v3.4/racing-v3.4.md` → `racing-v3.4`). Orbitarium: `prompts/frontier-v2.md` → `frontier-v2`; null fica null.
   - Pasta do benchmark no repo: racing → `benchmarks/racing/`, orbitarium → `benchmarks/solar-system/`.
   Também exportar `prompts` de cada benchmark: `{ key, path, status, bytes, lines, attachment?: string }` e `commit` (sha completo e curto), `repo: "JouberthAlves/Frontiers-Models"`.
3. **Cenas** (só as 6 racing atuais): para cada run e cada N de 1 a 12, listar com `git ls-tree -r --name-only <sha> benchmarks/racing/runs/<id>/source/verification` os PNGs cujo nome começa com `s<N>-` (em `verification/` ou `verification/screenshots/`; ignorar `compare/`). Regra de escolha: preferir o arquivo **sem** sufixo de fps (`-\d+fps` ou `-fps\d+`); se todos tiverem, pegar o primeiro em ordem alfabética. Observação: na Hydrogen o S7 se chama `s7-ponte-60fps.png`. Ler com `git show` como buffer (encoding `buffer`, `maxBuffer` 64 MB), converter com sharp para `public/scenes/<id>/s<N>-640.webp` (largura 640, q 72) e `s<N>-1600.webp` (largura 1600, q 80); gravar w/h do 1600. Se faltar alguma cena: erro com a lista.
4. Validar: 6 racing atuais, 5 orbitarium atuais, 72 cenas; imprimir um resumo (tamanho total das webp).
5. Os arquivos gerados são versionados (o deploy não tem o fork).

## 4. Tokens

```css
/* cor */
--bg-0:#080f1d; --bg-1:#0b1726; --bg-2:#101e35;          /* fundo base (gradiente diagonal da imagem do README) */
--track-0:#302337; --track-1:#222235;                      /* lado da pista */
--sky-0:#17283b; --sky-1:#14243a;                          /* lado do céu */
--card:#0e2034; --line:#25415d; --line-warm:#7d5565; --line-cool:#3e617f;
--ink:#f1f6fd; --ink-2:#b7cbe1; --ink-3:#8fa5bf;          /* --ink-3 só sobre --bg-0/--card; conferir AA 4.5:1 */
--warm:#fdaf6d; --warm-2:#ffb76b; --warm-soft:#ffc99d;
--cool:#83caff; --cyan:#85e4eb; --cyan-2:#80e9f2;
--seam: linear-gradient(180deg,#ffb76b,#80e9f2);
/* tipo */
--f-display:"Anybody", "Arial Narrow", sans-serif;          /* variável: wdth 50–150, wght 400–900 */
--f-body:"Atkinson Hyperlegible Next", system-ui, sans-serif;
--f-data:"Red Hat Mono", ui-monospace, monospace;          /* SÓ dado real: commit, SHA, caminho, tamanho de arquivo, rótulo S1–S12 */
/* movimento */
--ease-out:cubic-bezier(.16,1,.3,1); --ease-rise:cubic-bezier(.2,.7,.2,1); --ease-draw:cubic-bezier(.33,1,.68,1);
--t-micro:120ms; --t-short:220ms; --t-long:420ms; --t-section:700ms;
```
- Fontes do Google Fonts: Anybody (`wdth,wght@50..150,400..900`), Atkinson Hyperlegible Next (400, 600), Red Hat Mono (500). `display=swap`, `preconnect`. Animações de texto só começam após `document.fonts.ready`.
- Escala: título hero `clamp(56px, 12.5vw, 220px)` wdth 125 wght 900, line-height .86, letter-spacing -0.02em; h2 `clamp(36px, 6vw, 88px)` wdth 112 wght 850; h3 24px wght 700 (body font); corpo 17px/1.6; legenda 14px. Corpo com no máximo ~65 caracteres por linha.
- Raio: cards 14px, chips 999px, imagens 10px. Borda 1px `--line`. Sem sombra dura; sombra só onde há luz (cards do lado quente podem ter um leve brilho laranja embaixo? não — sem glow; brilho só na costura).
- Uma função por cor: laranja = Racing e ação primária; ciano/azul = Orbitarium e ação secundária; cores de modelo = só identidade (ponto, barra de 3px, contorno de chip). Acento abaixo de 5% da tela.
- Exceções declaradas (pedidas pelo usuário, vêm da imagem do README): fundo navy com degradê, paleta laranja/ciano. Não usar fundo quadriculado.

### Cores dos modelos (`src/data/models.ts`)
Da imagem do README (gerador `scripts/render-benchmark-assets.mjs` do fork). Chave = `${benchmark}:${id}`; fora da arena atual usar `#8fa5bf`.
| Run | Cor |
|---|---|
| racing gpt-6.1-sol-v3.4 / orbitarium gpt-6.1-sol-source | #facc6b |
| racing gpt-6-astra-v3.4 / orbitarium gpt-6-astra-max-frontier-v2 | #aaa7ff |
| racing opus-5.5-v3.4 | #ff99cc |
| racing gemini-4-argon-v3.4 | #8df0a4 |
| orbitarium gemini-4-argon-source | #83caff |
| racing sonnet-5.5-v3.4 | #f4a1ed |
| racing gemini-4-hydrogen-v3.4 | #78dad1 |
| orbitarium grok-4.7-solar-source | #d2a2ff |
| orbitarium fable-5.1-frontier-v2 | #72dfbd |

### Nomes das cenas (`src/data/scenes.ts`)
| N | PT | EN |
|---|---|---|
| 1 | Reta da orla | Seafront straight |
| 2 | Carro no grid | Car on the grid |
| 3 | Praia e espuma | Beach and surf |
| 4 | Falésia e mirante | Cliff lookout |
| 5 | Rua da vila | Village street |
| 6 | Bosque com sol rasante | Woods in low sun |
| 7 | Ponte ou túnel | Bridge or tunnel |
| 8 | Disputa lado a lado | Side-by-side battle |
| 9 | Close da pista | Track close-up |
| 10 | Vila na qualidade baixa | Village on Low |
| 11 | Escala do carro | Car to scale |
| 12 | Mapa da volta | Lap map |

## 5. Página (uma só, seções em ordem)

Idioma: PT se `navigator.language` começa com `pt`, senão EN; seletor "PT / EN" no topo; escolha guardada em `localStorage` (try/catch). Atualiza `<html lang>`, `<title>` e a meta description. Toda string vem de `src/i18n/{pt,en}.ts`.

### 5.0 Topo (nav)
Fixo no topo (`top: env(safe-area-inset-top)`), transparente sobre o hero; ganha fundo `rgba(8,15,29,.72)` + `backdrop-filter: blur(14px)` depois de 40px de rolagem (transição 220ms). Esquerda: marca (o `favicon.svg` em 22px + "FRONTIER MODELS" em Anybody wdth 125 wght 800 15px). Direita: links âncora "Corrida" (#racing), "Orbitarium" (#orbitarium), "Prompts" (#prompts), "Arquivo" (#archive) — escondidos abaixo de 768px — e o seletor de idioma (dois botões `aria-pressed`). Link "Pular para o conteúdo" visível no foco.

Favicon `public/favicon.svg`: quadrado arredondado 32×32 `#080f1d`, cortado por uma diagonal; metade esquerda `#302337` com traço `#ffb76b`, direita `#17283b` com ponto `#80e9f2`; a diagonal em degradê laranja→ciano.

### 5.1 Hero "Pista e Céu" (`#top`)
Altura: `min-height: min(100svh, 980px)`, mínimo 640px; conteúdo no fluxo (não depender de 100vh para ler).

Camadas (de trás para frente):
1. **Fundo global** (fixo, atrás da página toda): gradiente `--bg-0 → --bg-1 (52%) → --bg-2`, diagonal, e por cima o canvas **Galaxy** (§7.1).
2. **Lado da pista**: elemento absoluto com `clip-path: polygon(0 0, 58% 0, 42% 100%, 0 100%)` (desktop ≥ 900px) / `polygon(0 0, 100% 0, 100% 34%, 0 62%)` (abaixo de 900px, a costura atravessa a parte de cima). Fundo `linear-gradient(115deg, var(--track-0), var(--track-1) 70%, transparent)` com opacidade .92, cobrindo a galáxia nesse lado. Dentro, o canvas **Rastros** (§7.2).
3. **Costura**: linha que segue a borda do polígono: núcleo de 2px em `--seam` + um halo de 18px desfocado (blur 12px) com opacidade .55 — é o único brilho da página. Ela "se desenha" na ignição (§6.1).
4. **Título** "FRONTIER" / "MODELS" (`h1`, duas linhas), alinhado à esquerda com padding-left ~6vw, começando a ~22% da altura. É renderizado pelo **StrokeText** (§7.3) em **duas cópias empilhadas**, cada uma recortada por `clip-path` com o mesmo polígono da costura (cópia "pista" dentro do polígono, cópia "céu" fora): pista = traço `--warm`, preenchimento degradê `#ffb76b → #fff5ed`; céu = traço `--cyan`, preenchimento `#f0f8ff → #85e4eb`. O texto acessível existe uma vez (a segunda cópia `aria-hidden`). As duas cópias desenham em sincronia.
   - Ao rolar o hero (de 0 até o fim dele), o título ganha `transform: translateX(-3vw) scaleX(1.12)` (origin left) e as duas linhas se afastam 2vw na horizontal (linha 1 para a esquerda, 2 para a direita) — sensação de velocidade. rAF com throttle; parado no movimento reduzido.
5. **Texto de apoio** abaixo do título, coluna de no máx. 30ch, cor `--ink-2`, 19px:
   - PT: "Os mesmos prompts. 11 projetos completos. Compare cena por cena."
   - EN: "Same prompts. 11 complete projects. Compare them scene by scene."
   Na troca de idioma, esse texto é refeito pelo **DecryptedText** (§7.5).
6. **Números** entre fios verticais (1px `--line`), em linha (quebram em 2 linhas no celular sem rolar de lado): `2` benchmarks · `11` projetos atuais · `12` cenas por corrida → render como três blocos `número grande (Anybody 56px wdth 112) + rótulo (14px --ink-2)`; nada de ponto do meio. CountUp (§7.6) na ignição.
   - PT rótulos: "benchmarks", "projetos atuais", "cenas por corrida". EN: "benchmarks", "current projects", "scenes per race".
7. **Ações**: botão primário "Comparar corridas" / "Compare races" (fundo `--warm`, texto `#1a0f08`, raio 999px, 48px de altura) → rola até #racing. Botão secundário "Explorar o Orbitarium" / "Explore Orbitarium" (borda 1.5px `--cool`, texto `--cool`) → #orbitarium.

### 5.2 Barra de comparação (fixa embaixo, a página toda)
Fixa no rodapé da janela (`bottom: 0`, padding inferior `env(safe-area-inset-bottom)`), largura até 1100px centralizada com margem 16px dos lados, raio 18px, fundo `rgba(14,32,52,.82)` + blur 16px, borda 1px `--line`. Aparece subindo (§6.1). O `body` ganha `padding-bottom` igual à altura dela.
- Rótulo "Comparar:" / "Compare:".
- Chips dos modelos escolhidos (1 a 3; padrão = os 2 primeiros de `current_arena` racing: GPT-6.1 Sol e GPT-6 Astra): ponto na cor do modelo + nome + botão × (`aria-label` "Remover <modelo>"). Com 1 só, o × some.
- Botão "+ modelo" / "+ model" (só se < 3) abre um popover acima da barra com os 6 modelos do Racing (lista com ponto de cor; os escolhidos marcados e desabilitados). Fecha com Esc, clique fora, ou escolha. Foco volta ao botão.
- Botão "Ver lado a lado" / "View side by side" (fundo `--ink`, texto `--bg-0`) → rola até #racing.
- Abaixo de 600px: rótulo some; chips mostram só ponto + nome curto (`Sol`, `Astra`, `Opus`, `Argon`, `Sonnet`, `Hydrogen`); "Ver lado a lado" vira "Comparar". Nada pode estourar a largura: os chips quebram linha se precisar.
- Estado da escolha num contexto React (`CompareContext`), lido pelo Racing.

### 5.3 Racing-bench (`#racing`) — tom quente
Ao chegar, o véu quente do fundo acende (§6.2).
- Cabeçalho: rótulo pequeno "Benchmark 002" (14px `--warm-soft`), `h2` "Racing-bench V3.4" com StrokeText em modo scroll (§7.3, traço `--warm`). Texto: PT "Cada modelo recebeu o mesmo prompt de 25 KB e 14 imagens de referência, e entregou um jogo de corrida 3D completo: um circuito costeiro com 5 oponentes de IA." EN "Every model got the same 25 KB prompt and 14 reference images, and shipped a complete 3D racing game: a coastal circuit with 5 AI opponents."
- **Seletor de cena**: grade de 12 botões (6 colunas ≥ 1024px, 4 em 768, 3 abaixo). Cada botão: miniatura `-640.webp` da cena **do primeiro modelo escolhido** (proporção 16:9, `object-fit: cover`), rótulo `S<N>` em `--f-data` e o nome da cena. O ativo tem contorno 2px `--warm`. `role="tablist"`/`tab`, setas mudam.
- **Palco de comparação**: para a cena ativa, uma coluna por modelo escolhido (1, 2 ou 3 colunas; no celular, empilhadas). Cada coluna: barra de 3px na cor do modelo, nome do modelo pelo **SplitFlapText** (§7.4, refaz ao trocar a escolha), a imagem `-1600.webp` (`srcset` com a 640, `sizes` correto, `loading="lazy"`, `decoding="async"`, `alt` "<Modelo> — S<N> <nome da cena>"), e dois links: "Jogar" / "Play" (`liveUrl`, `target=_blank rel=noopener`) e "Código" / "Code" (`sourceUrl`). Clicar na imagem abre o **Visor** (§5.3.1). Troca de cena: a imagem nova entra com fade 220ms (opacity), sem pular layout (reservar proporção pelo w/h).
- **Os 6 jogos** (abaixo do palco): grade de cards (3 col ≥ 1024, 2 em 768, 1 abaixo; `align-items: start`), ordem de `current_arena`. Card: fundo `--card`, borda `--line`, topo com faixa 3px na cor do modelo, miniatura S1, nome (h3), "Prompt V3.4", links "Jogar" e "Código", e um botão "Comparar" que adiciona o modelo à barra (desabilitado se já está ou se já há 3). Hover: o card sobe 4px (transform 220ms) e o nome ganha o rastro do **EchoText** (§7.7).
- Nota abaixo, 14px `--ink-2`: PT "Os sites e números de verificação são informados por quem executou. Estar na lista atual não significa aceite no benchmark." EN "Sites and verification notes are provided by the run owner. Being in the current list does not imply benchmark acceptance."

#### 5.3.1 Visor (lightbox)
`<dialog>` modal em tela cheia, fundo `rgba(4,8,16,.94)`. Abre com escala .96→1 + opacity 220ms. Mostra a cena ativa:
- Com 2+ modelos: **régua arrastável** entre os dois primeiros (imagem A por baixo, B por cima recortada com `clip-path: inset(0 0 0 X%)`, alça vertical de 2px `--ink` com puxador redondo de 44px; arrastar com pointer events, teclado ← → move 2%, Home/End). Seletor dentro do visor para trocar qual par compara (se 3).
- Com 1 modelo: a imagem sozinha.
- Rodapé: nomes com ponto de cor, `S<N> nome`, botões ← → para trocar de cena (também pelas setas quando o foco não está na régua), "Fechar" / "Close" (Esc). Foco preso dentro; ao fechar, volta ao elemento que abriu. `body` sem rolagem enquanto aberto.

### 5.4 Orbitarium-bench (`#orbitarium`) — tom frio
Ao chegar, o véu frio acende e o quente apaga (§6.2).
- Rótulo "Benchmark 001" (`--cyan`), `h2` "Orbitarium-bench" (StrokeText scroll, traço `--cyan`). Texto: PT "Cada modelo construiu um Sistema Solar interativo a partir de uma especificação densa de produto: navegação, tempo, órbitas, acessibilidade e honestidade científica." EN "Every model built an interactive Solar System from a dense product spec: navigation, time, orbits, accessibility and scientific honesty."
- Layout ≥ 1024px: **mapa orbital** à esquerda (60%), lista à direita (40%). Abaixo: mapa em cima (largura total, quadrado até 520px), lista embaixo.
- **Mapa orbital** (SVG, `viewBox="0 0 600 600"`): estrela central (círculo r 26 com degradê radial `#fff5ed → #ffb76b → transparente` — é a "lâmpada" do planetário, sem halo extra), 5 elipses de órbita (raios x 110/160/210/255/290, y = 0.42·x, traço 1px `--line-cool`, e uma leve inclinação de -12° no grupo), um planeta por execução atual na ordem de `current_arena` (de dentro para fora), círculo r 11 na cor do modelo com contorno 2px `--bg-0`, e rótulo com o nome do modelo (14px `--ink`, `paint-order: stroke` com traço `--bg-0` 4px para ler). Os planetas giram (§6.4). Cada planeta é um botão (`role="button"`, `tabindex=0`, `aria-label`) que seleciona o projeto; o selecionado ganha um anel 1.5px `--ink` em volta.
- **Lista**: 5 cards (fundo `--card`, borda `--line`), cada um com ponto de cor, nome (h3), estado do prompt (PT "Prompt Frontier V2" ou "Prompt não verificado no arquivo"; EN "Frontier V2 prompt" / "Prompt not verified in the archive"), links "Abrir projeto" / "Open project" (`liveUrl`) e "Código" / "Code". O card selecionado (sincronizado com o planeta) tem borda animada **StarBorder** (§7.8) na cor do modelo. Selecionar pelo card ou pelo planeta. Padrão: o primeiro.

### 5.5 Prompts (`#prompts`)
- `h2` "As versões do prompt" / "Prompt versions" (StrokeText scroll, traço `--ink-2`).
- Duas linhas de abas (padrão "abas de versão"): Racing (V2.6, V3.1, V3.2, V3.3, **V3.4 · atual**, V3.4.1 · candidato) e Orbitarium (Original, Frontier V2). `role="tablist"`, teclado com setas, troca de painel com fade 220ms (`steps(1)` não; aqui é fade).
- Painel: nome do arquivo (`--f-data`), estado traduzido (mapa abaixo), tamanho em KB e linhas, anexo obrigatório quando houver, quais execuções usaram aquele prompt (chips com ponto de cor; fora da arena em cinza), link "Ler o prompt" / "Read the prompt" → `https://github.com/<repo>/blob/<commit>/benchmarks/<pasta>/<path>`.
- Estados → texto: `legacy-archived-verbatim-and-verified` = "Legado, arquivado na íntegra" / "Legacy, archived verbatim"; `historical-frozen-archived*` = "Histórico, congelado" / "Historical, frozen"; `current-*` = "Atual" / "Current"; `candidate-*` = "Candidato para as próximas execuções" / "Candidate for future runs"; Orbitarium `sun-original` = "Original" e `frontier-v2` = "Atual"/"Current" (se o status do JSON não bater com essas regras, mostrar "Arquivado" / "Archived").

### 5.6 Arquivo (`#archive`)
- `h2` "Todo o arquivo" / "The whole archive" (StrokeText scroll).
- Filtros (chips toggle): Todos, Atual, Legado, Histórico, Desatualizado, Não frontier (EN: All, Current, Legacy, Historical, Outdated, Non-frontier). E um seletor de benchmark (Todos / Racing / Orbitarium).
- Tabela (≥ 768px) dentro de `overflow-x:auto`: Modelo (ponto + nome) | Benchmark | Categoria (chip: atual = borda `--warm` no Racing / `--cool` no Orbitarium; demais = borda `--line`, texto `--ink-2`) | Site ("Abrir" link, ou "Excluído") | Código ("Código" link, ou "Registro" com `recordUrl`, ou "—") | Prompt (V3.4 / Frontier V2 / "não verificado"). Abaixo de 768px: lista de cartões com os mesmos campos (sem tabela).
- Ordem: Racing atual (arena), Orbitarium atual (arena), depois os demais na ordem do RUNS.json.
- Linha do commit: "Dados do commit `a71127c` do Frontiers Models." com link para o commit.

### 5.7 Rodapé
- A costura laranja→ciano atravessa o rodapé na horizontal (1px, desenha da esquerda para a direita 700ms ao entrar).
- PT: "Frontier Models é um arquivo independente de benchmarks. Os nomes dos modelos identificam os sistemas usados em cada execução." EN: "Frontier Models is an independent benchmark archive. Model names identify the systems used for individual runs."
- Links: "Repositório do arquivo" (repo), "Metodologia" (`docs/METHODOLOGY.md` no commit).
- Crédito: "Fundo e efeitos de texto adaptados do React Bits, de David Haz (MIT + Commons Clause)." com link para reactbits.dev.

### 5.8 Faixa de aviso (obrigatória: o fundo animado é parte central)
Quando `prefers-reduced-motion: reduce` **ou** o Galaxy não liga (sem WebGL2, GPU de software, ou o vigia congelou): faixa discreta acima da barra de comparação, 14px, fundo `--card`, borda `--line`: PT "Animações simplificadas neste aparelho: o fundo fica parado." EN "Simplified motion on this device: the background stays still." Botão × fecha e guarda em `sessionStorage`. Não trava a rolagem.

## 6. Movimento

Referência de movimento escolhida pelo usuário: Off-Template, hallmark, React Bits, Vue Bits. Um efeito de assinatura (a ignição do hero); o resto é menor e com função.

### 6.1 Ignição do hero (assinatura, toca uma vez por carregamento)
Começa após `document.fonts.ready` (com teto de 1,2 s de espera).
| t (ms) | O quê | Duração / curva |
|---|---|---|
| 0 | fundo (galáxia + lado da pista) opacity 0→1 | 600, linear |
| 150 | costura se desenha de cima para baixo (`scaleY` 0→1, origin top, no núcleo e no halo) | 900, `--ease-rise` |
| 400 | título: traço desenha letra a letra (StrokeText, stagger 50ms) nas duas cópias | 1600, `--ease-draw` |
| 1900 | título: preenchimento entra em cortina da esquerda para a direita | 800, power2.inOut |
| 1900 | texto de apoio sobe (translateY 24px→0 + opacity) | 700, `--ease-rise` |
| 2050 | números contam (CountUp) e sobem | 1200 |
| 2200 | ações sobem (+80ms entre elas) | 700, `--ease-rise` |
| 2400 | barra de comparação sobe de baixo (translateY 120%→0) | 500, `--ease-out` |
Movimento reduzido: tudo no estado final, imediatamente.

### 6.2 Véus de tom por seção
Duas camadas fixas em tela cheia atrás do conteúdo (acima da galáxia): véu quente `radial-gradient(120% 80% at 20% 30%, rgba(48,35,55,.75), transparent 70%)` e véu frio `radial-gradient(120% 80% at 80% 40%, rgba(23,40,59,.7), transparent 70%)`. Só a **opacity** delas muda (700ms `--ease-rise`): #racing ativo → quente 1, frio 0; #orbitarium → frio 1; demais seções → as duas 0. Seção "ativa" = a que cruza a linha do meio da tela (`rootMargin: "-45% 0px -45% 0px"`).

### 6.3 Entradas
- Títulos de seção: StrokeText em modo scroll (traço 1200ms stagger 30ms, depois preenchimento em fade 500ms).
- Cards, miniaturas e linhas de tabela: sobem 24px + opacity, 700ms `--ease-out`, stagger 60ms dentro do grupo; rede de segurança de 2,5 s.
- Rodapé: costura horizontal `scaleX` 0→1, 700ms após 200ms.

### 6.4 Contínuo (só com GPU confirmada — §7.1 `hasGpu()`; sem GPU fica parado)
- Planetas: cada um num `<g>` que gira em torno do centro (`transform: rotate()` via CSS animation com `transform-box: view-box; transform-origin: 300px 300px` no grupo já inclinado, e o planeta "contra-gira" para o rótulo ficar de pé). Períodos 48, 64, 82, 104, 130 s, linear, infinito; fases iniciais diferentes (atraso negativo). Pausa fora da tela (`animation-play-state` por IntersectionObserver) e com a aba oculta. Como a órbita é elipse, girar dentro de um grupo com `scale(1, 0.42)` e contra-escalar o planeta.
- Rastros do hero e Galaxy: ver §7.

### 6.5 Micro
- Botões: hover clareia 220ms; ativo `scale(.98)` 120ms. Links: sublinhado que desenha (`::after scaleX 0→1`, origem esquerda, 420ms `--ease-out`).
- Chip adicionado: `scale(.9)→1` + opacity 180ms; removido: opacity 0 em 150ms e sai.
- Miniaturas: hover `scale(1.03)` 220ms dentro de `overflow:hidden`.
- Foco visível em tudo: 2px `--cyan`, offset 2px.

## 7. Componentes do React Bits (adaptar, não copiar às cegas)

Fonte: `https://github.com/DavidHDev/react-bits`, pasta `src/ts-default/` (TS) — ler o arquivo cru em `https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/ts-default/<Categoria>/<Nome>/<Nome>.tsx` (se o caminho não existir, listar a pasta pela API `https://api.github.com/repos/DavidHDev/react-bits/contents/src/ts-default/<Categoria>`). Licença MIT + Commons Clause: pode usar e modificar dentro do site; **manter o aviso de copyright e licença como comentário no topo de cada arquivo adaptado** e o crédito no rodapé. Não publicar os componentes como pacote. Se um componente não existir no React Bits mas existir no Vue Bits (`DavidHDev/vue-bits`, `src/content/TextAnimations/<Nome>/<Nome>.vue`), portar para React com o mesmo comportamento.

### 7.1 Galaxy (`Backgrounds/Galaxy`) — fundo global
- Canvas fixo `position: fixed; inset: 0; z-index: -2`, `pointer-events: none` (sem repulsão do cursor e sem clickWarp: o site tem cliques próprios).
- Props: `starColors` / matiz para tons `#83caff`, `#85e4eb`, `#f1f6fd` e poucos `#ffc99d`; `saturation` ~0.35; `density` 1 (celular 0.6); `layers` 4 (celular 2); velocidade baixa (deriva lenta, sem warp); `transparent`.
- **Liga só com GPU real** (`hasGpu()` em `src/lib/gpu.ts`, resultado em cache): WebGL2 disponível; `WEBGL_debug_renderer_info` não pode conter `SwiftShader`, `llvmpipe`, `Software`, `Microsoft Basic Render`; teste `failIfMajorPerformanceCaveat: true`.
- Começa no `requestIdleCallback` (fallback setTimeout 300ms), DPR 1 (máx 1.25 em desktop com GPU), teto de 30 fps em tela de toque, pausa com `visibilitychange`. Vigia: se 5 quadros seguidos passarem de 120 ms, para e congela no último quadro completo e dispara a faixa (§5.8). `webglcontextlost` → mesmo caminho.
- Sem GPU ou movimento reduzido: não monta; fica o gradiente base + um campo de estrelas estático em CSS (3 camadas de `radial-gradient` 1px repetidas em tamanhos 211px, 347px, 503px, opacidades .5/.35/.25).

### 7.2 Rastros (do hero, lado da pista) — canvas 2D próprio, inspirado no Hyperspeed
- Canvas dentro do polígono da pista, DPR 1. ~36 rastros horizontais: cada um é uma linha com degradê `rgba(253,175,109,0)` → `#fdaf6d` → `#fff5ed` na ponta, comprimento 80–320px, espessura 1–3px, y entre 30% e 95% da altura com perspectiva (mais grossos e rápidos embaixo), velocidade 600–1800 px/s da direita para a esquerda, alguns em `#ffb76b` e 15% em `#ff99cc`/`#facc6b` bem fracos. Composição `lighter`.
- Só anima com o hero visível (IntersectionObserver) e a aba ativa; teto de 30 fps no toque; sem GPU confirmada roda a 24 fps. Movimento reduzido: um quadro parado desenhado uma vez.

### 7.3 StrokeText (`TextAnimations/StrokeText`, React; se faltar, o do Vue)
- SVG com duas camadas `<text>` (traço e preenchimento), um `<tspan>` por letra; traço com `stroke-dasharray`/`stroke-dashoffset` animado por GSAP, preenchimento por cortina (`clip-path` no retângulo) ou fade. Medir com `getBBox()` após `document.fonts.ready`.
- Adaptar para: (a) `fontFamily` Anybody + `font-stretch`/`font-variation-settings: "wdth" 125`; (b) **duas linhas** (FRONTIER / MODELS) no mesmo SVG ou dois SVGs alinhados; (c) preenchimento por **degradê** (`<linearGradient>`); (d) modo controlado (`play` disparado pela ignição) e modo scroll (ScrollTrigger `start: "top 82%"`, `once`); (e) as duas cópias do hero (pista/céu) com timeline sincronizada.
- `role="img"`/`aria-label` no invólucro **não** no h1 do hero: o `h1` contém o texto real visualmente escondido (`.sr-only`) e o SVG é `aria-hidden`.
- Movimento reduzido: estado final.

### 7.4 SplitFlapText (`TextAnimations/SplitFlapText`)
Nomes dos modelos no palco de comparação. Tiles na cor `--track-0`, texto na cor do modelo, `flipDuration` 0.12 s, `stagger` 0.06 s, 6 trocas por letra, sem loop. Refaz quando o modelo daquela coluna muda. Fonte: `--f-display` wdth 100 wght 800 (não mono). Leitor de tela lê o nome final (texto real escondido + tiles `aria-hidden`).

### 7.5 DecryptedText (`TextAnimations/DecryptedText`)
Só no texto de apoio do hero, ao trocar o idioma: `speed` 35ms, `maxIterations` 8, `sequential`, `revealDirection: "start"`, charset `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>`. Mantém o texto final para leitor de tela.

### 7.6 CountUp
Números do hero. Duração 1.2 s, formatação `Intl.NumberFormat` do idioma ativo.

### 7.7 EchoText (Vue Bits `EchoText`, portar)
Rastro de cópias atrás do nome do modelo no card "Os 6 jogos" ao passar o mouse (modo pointer/entrance de curta duração): 8 ecos, `lag` .24, deslocamento 28px para a direita, `fade` .72, `blur` 2px, tinta `--warm`. Só em dispositivos com hover (`@media (hover:hover)`). Reduzido: nada.

### 7.8 StarBorder (`Animations/StarBorder`)
Borda do card selecionado no Orbitarium: cor do modelo, `speed` 6s. Sem GPU ou reduzido: borda estática 1.5px na cor do modelo.

## 8. SEO, meta e acessibilidade

- `index.html`: `<title>` PT "Frontier Models · Racing e Orbitarium"; description PT "Compare lado a lado os jogos de corrida e os sistemas solares que modelos de IA de fronteira construíram a partir dos mesmos prompts." (EN trocadas em runtime: "Frontier Models · Racing and Orbitarium" / "Compare side by side the racing games and solar systems that frontier AI models built from the same prompts."). `canonical` e `og:url` `https://frontier-models-ui.vercel.app/`; `og:title`, `og:description`, `og:image` `/og.jpg` (1200×630; a revisão gera o arquivo — deixar a tag), `twitter:card summary_large_image`, `theme-color #080f1d`, favicon SVG. `public/robots.txt` (allow + sitemap) e `public/sitemap.xml` (uma URL).
- Contraste AA em todo texto (incluindo `--ink-3` e texto sobre `--warm`). Alvos de toque ≥ 44px. Ordem de foco lógica. `h1` único; h2 por seção.
- Sem rolagem lateral: conferir que nenhum elemento absoluto (costura, halo, rastros) passa da largura — o hero tem `overflow: clip`.

## 9. O que quem coda pode e não pode fazer

- Pode: `npm install`, `npm run sync`, `npx tsc -b`, `npm run lint`, `npm run build`, ler arquivos/URLs do React Bits e Vue Bits, consultar documentação (Context7) de Vite, React, GSAP e sharp.
- **Não pode**: subir servidor (`dev`/`preview`), abrir navegador, tirar print. A revisão é de outro agente.
- Não mexer em `design/` nem em `_spec/`. Não criar commit.
- Ao terminar: `npm run build` sem erro e sem aviso de tipo, `npm run lint` limpo, e um relatório curto: arquivos criados, decisões que divergiram do spec (e por quê), o que não conseguiu fazer, tamanho do `dist/` e das webp.
