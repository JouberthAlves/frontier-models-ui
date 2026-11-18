# AGENTS.md

Instruções para qualquer agente (Claude Code, Codex, Cursor…) que mexa neste repo. Leia inteiro antes da primeira edição.

## O que é

Interface para comparar as execuções do arquivo de benchmarks **Frontier Models** (fork `JouberthAlves/Frontiers-Models`, original `bielxdh3/Frontiers-Models`). Dois benchmarks: **Racing-bench** (jogo de corrida 3D, 12 prints de cena por execução) e **Orbitarium-bench** (Sistema Solar interativo). Direção visual (v2): "Corrida até o céu": do hero ao fim do Racing a página é um mapa cartoon pastel visto de cima (construções em 3/4, como no mockup aprovado), com a pista em S contornando os blocos; depois da linha de chegada a pista se desfaz em estrelas e cada carro vira um planeta do Orbitarium. Spec: `_spec/spec-v2.md` (vale sobre `_spec/spec.md`, a v1, onde houver conflito). Visual alvo em `design/mockup-pista-cartoon.png`, mecânica em `design/prototipo-pista.html`.

## Regras que não se quebram

1. **Nada de ranking.** Nenhuma nota, posição, pódio, vencedor ou "melhor" na copy, no código ou nos dados (lista de palavras proibidas em `_spec/spec.md` §1). Ordem de exibição = `current_arena` do `RUNS.json`. Não mostrar FPS, contagem de testes nem `reported_verification`.
2. **Nunca escrever no repo de benchmarks.** Ele só é lido por `git show` no `npm run sync`.
3. **Link de código** sempre para a cópia arquivada no Frontiers Models, nunca para o repositório de origem do modelo.
4. **Movimento:** só `transform`/`opacity` (exceções no spec), `prefers-reduced-motion` mostra o estado final parado, WebGL só com GPU real.
5. Sem rolagem lateral em nenhuma largura (375 → 1920).
6. Componentes adaptados do React Bits/Vue Bits mantêm o aviso de licença no topo do arquivo (MIT + Commons Clause) e o crédito no rodapé.

## Como rodar

```
npm install
npm run sync -- --fork ../Frontiers-Models --commit <sha>   # regenera src/data/archive.json e public/scenes/
npm run dev
npm run build && npm run lint
```

O fork precisa estar clonado ao lado (`../Frontiers-Models`). Os arquivos gerados (`archive.json` e as webp) são versionados: o deploy não tem o fork.

## Como adicionar um modelo novo

Quando o repo de benchmarks ganhar uma execução nova (ex.: um modelo novo no Racing ou no Orbitarium):

1. **Atualizar o fork:** no GitHub, "Sync fork" em `JouberthAlves/Frontiers-Models` (ou `git pull` se não houver commits próprios). Depois `git pull` no clone local.
2. **Rodar o sync apontando para o commit novo** e trocar o `DEFAULT_COMMIT` em `scripts/sync.mjs` para ele. O sync:
   - lê os `RUNS.json`, classifica por `current_arena` / legado / não-frontier;
   - no Racing, gera as 12 cenas (S1–S12) da execução nova. Se faltar alguma, ele para com a lista. Se os prints tiverem contador de FPS ou outro número de desempenho gravado na imagem, acrescente a caixa em `OVERLAYS` (`scripts/sync.mjs`) e confira o recorte.
3. **Cor do modelo** (`src/data/models.ts`): veja a seção abaixo.
4. **Nome curto** para os chips do celular: `SHORT` em `src/data/models.ts`.
5. **Copy:** se a execução usou outra versão de prompt, ajuste o texto de abertura do Racing/Orbitarium em `src/i18n/pt.ts` e `en.ts` (os dois idiomas).
6. `npm run build`, `npm run lint`, prints em 375 e 1440 da seção mexida, commit em inglês com prefixo (`added:`, `updated:`, `fixed:`, `deleted:`).

Não é preciso mexer no código dos carros, do mapa orbital nem do loading: **a quantidade de carros, de órbitas e o destino de cada carro vêm dos dados** (ver abaixo). O título "Os N jogos" também conta sozinho. O loading pré-carrega as cenas do primeiro modelo da arena do Racing, sem lista escrita à mão.

## Os carros da pista

- São **mocks neutros**: todos com a mesma pintura (creme `#fff3e3` + faixa laranja da UI), **sem cor de modelo**. Durante a corrida eles não representam ninguém, então a fila nunca vira ordem de chegada.
- **Quantidade = número de execuções atuais do Orbitarium** (`current_arena` do Orbitarium em `archive.json`). Entrou um modelo no Orbitarium, entra um carro; saiu, sai um carro. Nunca escrever o número 5 no código.
- Andam **pela rolagem** (posição = função da rolagem, sem timer): parados no grid do hero com a página no topo, em fila a 58 px um do outro, sem ultrapassagem.
- Depois da linha de chegada, cada carro flutua até o planeta de **um** modelo do Orbitarium (na ordem da arena) e só aí ganha a cor dele. O planeta fica escondido até o carro chegar.
- Com `prefers-reduced-motion`: carros parados no grid, nada se desfaz, planetas visíveis desde o início.
- **Modelo só no Racing:** aparece nos cards, no palco e no visor do Racing, nunca vira carro nem estrela. **Modelo só no Orbitarium:** vira estrela/planeta, sem precisar estar no Racing. Nenhum caso exige exceção no código.

## O mapa e a pista (v2)

- **Traçado:** nada de número fixo. Cada bloco da zona da corrida declara o lado em `data-track-side="left|right|full"` (hero, abertura do Racing, palco, jogos) e a linha de chegada é o elemento `data-track-finish`. `src/lib/track.ts` lê os retângulos reais e monta a pista (y sempre crescente). Bloco novo na zona da corrida: ponha o `data-track-side` e a classe `race-card`; a pista se ajusta sozinha.
- **Cenário:** as peças são **sprites ilustrados** (árvores, palmeiras, pinheiros, arbustos, cerca-viva, flores, pedras, casas, igreja, guarda-sóis, barcos, cerca) e o chão é **textura** (grama, areia, mar): veja "Sprites e texturas do mapa" abaixo. Cada peça e cada conjunto (bosque, mata, grupo de palmeiras, lance de cerca) está descrito como dado em `src/lib/sceneryKit.ts` (`SceneryDefs.tsx` só desenha: um `<symbol>` com um `<image>` por peça, vários `<use>` por conjunto); onde cada um aparece está em `ZONES` de `src/lib/scenery.ts`. Um conjunto é **um** elemento no mapa que desenha de 3 a 7 sprites: é assim que o mapa fica cheio sem estourar o orçamento. A vila (praça de areia, igreja, ruas curvas, casas de 4 modelos e tamanhos variados, canteiros, cerca na frente e atrás) é montada no maior retângulo livre da zona da vila, e algumas casas ficam fora, no terreno livre ao lado (mais longe em telas ≥ 1440 px); casa só existe ali, nunca solta pelo mapa. O mesmo arquivo gera a falésia (um degrau de um lado só da pista, que afina antes da zebra), o riacho sinuoso com a ponte no cruzamento, as cercas-vivas ao longo da pista, as clareiras e a lua e as estrelas da chegada. Para um mapa diferente, troque `SCENERY_SEED` no mesmo arquivo (mesma semente + mesma largura = mesmo mapa). Cores do que ainda é desenhado (pista, falésia, espuma, tintas): tokens `--map-*` em `src/styles/tokens.css`.
- **Giro das peças:** casas e igreja são vistas em 3/4, com a parede da frente embaixo, e **nunca giram** (no máximo ±3°). Palmeiras, pinheiros, arbustos, pedras, flores e guarda-sóis giram livremente; as copas redondas têm um lado iluminado e só inclinam ±22° (`FREE_TURN` em `scenery.ts`). Barcos giram.
- **Sombras:** nenhuma peça tem sombra própria nem filtro. `scenery.ts` junta a elipse de sombra de todos os sprites em **dois paths** (um largo e fraco, um justo: a borda fica suave) desenhados embaixo das peças; a posição vem de `KIT_PARTS` (`sceneryKit.ts`). Sprite novo já ganha sombra pelo tipo (`crown`, `building`, `low`).
- **Chão:** `<pattern>` com as texturas (`rm-grass`, `rm-sand`, `rm-sea` em `RaceMap.tsx`), e por cima as tintas: manchas de grama, tom mais escuro da mata, chão do entardecer no último trecho e a camada da hora do dia. Atrás do texto do hero há uma área calma (elipse clara, `rm-calm`) para o título e o texto manterem contraste AA sobre a textura.
- **Orçamento:** o SVG do mapa fica abaixo de 650 elementos (hoje ~600 no pior caso em 1440/1920); `MAX_PIECES` em `scenery.ts` é o teto das peças. Sprite novo custa 2 elementos no `<defs>` (`SCENERY_DEF_ELEMENTS` em `sceneryKit.ts` se conta sozinho). Prefira um conjunto novo a muitas peças soltas.
- **Motor da rolagem:** `src/components/race/RaceMap.tsx` (carros, chegada, pedaços, céu, planetas). Por quadro só `transform`/`opacity`. Depois da chegada o último trecho da pista some em fatias (`buildSlices`) atrás do último carro, e os pedaços (`buildChunks`) são o próprio asfalto e zebra em ladrilhos que se soltam.
- **Loading:** `src/lib/boot.ts` (5 etapas reais, teto de 12 s) e `src/components/Loader.tsx`. Etapa nova = item novo em `BOOT_STEPS` e uma chamada de `markStep`. A etapa 2 (`map`) só termina quando o mapa foi calculado **e** todos os sprites e texturas de `public/map` carregaram (`MAP_ASSET_URLS`), para nada aparecer depois que as luzes apagam.
- **Cards creme:** dentro de `.race-card` os tokens escuros são reapontados (`--ink`, `--ink-2`, `--line`, `--warm`…), então componente novo ali já sai em navy sobre creme. Cor de modelo nunca vira cor de texto sobre creme (só tile, ponto e barra).

## Sprites e texturas do mapa

- **Origem:** as folhas geradas no Magnific ficam em `design/magnific-map/` (`sheet-vegetation.png` e `sheet-village.png`: grade 4×3 sobre magenta chapado; `tex-grass.png`, `tex-sand.png`, `tex-sea.png`: texturas contínuas). `scripts/cut-map-sprites.cjs` recorta cada célula, tira o magenta, apara e grava WebP transparente de até 256 px em `public/map/`, mais as três texturas em 512 px e o `manifest.json` (nome, largura, altura, bytes). Os arquivos de `public/map` são gerados e versionados: não edite à mão.
- **Rodar o recorte:** `node scripts/cut-map-sprites.cjs design/magnific-map public/map`.
- **Sprite novo:**
  1. Gere no mesmo estilo (cartoon, visto de cima; construções em 3/4 com a frente para baixo; fundo magenta `#ff00ff` chapado, sem sombra no chão) e ponha numa célula de uma folha (ou numa folha nova 4×3).
  2. Em `scripts/cut-map-sprites.cjs`, acrescente o nome na lista da folha em `SHEETS`, na posição da célula (se o desenho passar da célula, uma caixa em `OVERRIDE`). Rode o recorte e confira o PNG/WebP gerado.
  3. Em `src/lib/sceneryKit.ts`: tamanho em pixels em `SPRITES` (copie do `manifest.json`), um id em `PieceId` e uma linha em `SINGLES` (sprite, largura no mapa em px na escala 1, tipo de chão para a sombra). Para usar em conjunto, acrescente em `GROUPS`.
  4. Em `src/lib/scenery.ts`: liste a peça numa zona de `ZONES` (ou coloque à mão, como a igreja); se pode girar livremente, ponha em `FREE_TURN`.
  5. O loading já passa a esperar o arquivo novo (a lista sai de `SPRITES`). `npm run build && npm run lint` e confira o orçamento de elementos.
- **Textura nova ou trocada:** mesmo nome de arquivo em `design/magnific-map`, rode o recorte (o tom é ajustado ali, em `tex`) e acerte os tokens `--map-grass`/`--map-sand`/`--map-sea` para a cor média dela (é o que aparece antes de o mapa medir a página).
- **Tamanhos na tela (1440 px):** árvores ~48–90 px, palmeiras ~50–90, casas ~42–65, igreja ~90 de altura; tudo escala com `unit` em `buildScenery` (menor em tablet e celular; casas param de crescer em telas muito largas).
- A ponte (`bridge`) e a arquibancada (`stand`) são desenhadas direto em `RaceMap.tsx`: a ponte é esticada para a largura da pista + zebras no cruzamento com o riacho.

## Escolher a cor de um modelo novo

O carro chega sem cor; quem adiciona o modelo decide a cor dele. Para não estragar o visual:

1. **Se o original já tem cor**, use a dela: o gerador da imagem do README (`scripts/render-benchmark-assets.mjs` no repo de benchmarks) tem um array de cores por posição da arena. A cor é por benchmark (a chave em `models.ts` é `benchmark:id`).
2. **Se não tem**, escolha uma que cumpra todas as regras:
   - tom pastel luminoso, como as outras: em OKLCH, luminosidade entre 0,78 e 0,88 e croma entre 0,08 e 0,16;
   - matiz a pelo menos 25° de qualquer outra cor de modelo atual **do mesmo benchmark**;
   - contraste de pelo menos 7:1 sobre `#080f1d`, e o texto navy `#0f1a2b` tem de ler bem em cima dela (no palco o nome vai em navy sobre tiles na cor do modelo);
   - **reservadas, não usar:** vermelho da zebra `#e8423a`, laranja da UI `#fdaf6d`/`#ffb76b`, ciano da UI `#85e4eb`/`#80e9f2`, branco puro;
   - conferir em print o chip, o ponto, a barra do card e o planeta lado a lado com as outras cores.
3. Cor de modelo é **só identidade** (ponto, barra de 3 px, contorno, planeta). Nunca vira fundo grande nem botão.
4. Fora da arena atual, todo modelo usa o cinza `#8fa5bf` (já é automático em `colorOf`).

## Onde estão as coisas

| O quê | Onde |
|---|---|
| Spec e regras de design | `_spec/spec-v2.md` (v2) e `_spec/spec.md` (v1) |
| Mapa, pista, carros, chegada | `src/components/race/`, `src/lib/track.ts`, `src/lib/scenery.ts`, `src/lib/sceneryKit.ts` |
| Sprites e texturas do mapa | `public/map/` (gerado), folhas em `design/magnific-map/`, recorte em `scripts/cut-map-sprites.cjs` |
| Loading (luzes de largada) | `src/lib/boot.ts`, `src/components/Loader.tsx` |
| Hover "decifrar" dos nomes | `src/lib/scramble.ts`, `src/components/bits/DecryptedText.tsx` |
| Esqueletos, mockups e protótipos | `design/` |
| Script de dados | `scripts/sync.mjs` |
| Dados gerados | `src/data/archive.json`, `public/scenes/` |
| Cores e nomes curtos | `src/data/models.ts` |
| Nomes das cenas | `src/data/scenes.ts` |
| Textos PT/EN | `src/i18n/pt.ts`, `src/i18n/en.ts` |
| Componentes adaptados do React Bits | `src/components/bits/` |

## Git e deploy

- Identidade dos commits: `JouberthAlves <250047397+JouberthAlves@users.noreply.github.com>`.
- Mensagem em inglês com `added:` / `updated:` / `fixed:` / `deleted:`.
- A Vercel está ligada a este repo: cada push na `main` publica em produção. Não fazer push de coisa não testada.
