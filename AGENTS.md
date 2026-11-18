# AGENTS.md

Instruções para qualquer agente (Claude Code, Codex, Cursor…) que mexa neste repo. Leia inteiro antes da primeira edição.

## O que é

Interface para comparar as execuções do arquivo de benchmarks **Frontier Models** (fork `JouberthAlves/Frontiers-Models`, original `bielxdh3/Frontiers-Models`). Dois benchmarks: **Racing-bench** (jogo de corrida 3D, 12 prints de cena por execução) e **Orbitarium-bench** (Sistema Solar interativo). Direção visual (v2): "Corrida até o céu": do hero ao fim do Racing a página é um mapa cartoon pastel visto de cima, com a pista em S contornando os blocos; depois da linha de chegada a pista se desfaz em estrelas e cada carro vira um planeta do Orbitarium. Spec: `_spec/spec-v2.md` (vale sobre `_spec/spec.md`, a v1, onde houver conflito). Visual alvo em `design/mockup-pista-cartoon.png`, mecânica em `design/prototipo-pista.html`.

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
- **Cenário:** as peças (palmeira, casa, igreja…) e os conjuntos (bosque, mata, grupo de palmeiras, fileira de casas) estão descritos como dados em `src/lib/sceneryKit.ts` (`SceneryDefs.tsx` só desenha); onde cada um aparece está em `ZONES` de `src/lib/scenery.ts`. Um conjunto é **um** elemento no mapa que desenha de 3 a 7 peças: é assim que o mapa fica cheio sem estourar o orçamento. A vila (praça, igreja, ruas, fileiras de casas, cerca) é montada no maior retângulo livre da zona da vila. Para um mapa diferente, troque `SCENERY_SEED` no mesmo arquivo (mesma semente + mesma largura = mesmo mapa). Cores: tokens `--map-*` em `src/styles/tokens.css`.
- **Orçamento:** o SVG do mapa fica abaixo de 650 elementos; `MAX_PIECES` em `scenery.ts` é o teto das peças. Peça nova com muitas formas: reduza o teto na mesma medida (`SCENERY_DEF_ELEMENTS` em `sceneryKit.ts` se conta sozinho). Prefira um conjunto novo a muitas peças soltas.
- **Motor da rolagem:** `src/components/race/RaceMap.tsx` (carros, chegada, pedaços, céu, planetas). Por quadro só `transform`/`opacity`. Depois da chegada o último trecho da pista some em fatias (`buildSlices`) atrás do último carro, e os pedaços (`buildChunks`) são o próprio asfalto e zebra em ladrilhos que se soltam.
- **Loading:** `src/lib/boot.ts` (5 etapas reais, teto de 12 s) e `src/components/Loader.tsx`. Etapa nova = item novo em `BOOT_STEPS` e uma chamada de `markStep`.
- **Cards creme:** dentro de `.race-card` os tokens escuros são reapontados (`--ink`, `--ink-2`, `--line`, `--warm`…), então componente novo ali já sai em navy sobre creme. Cor de modelo nunca vira cor de texto sobre creme (só tile, ponto e barra).

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
| Mapa, pista, carros, chegada | `src/components/race/`, `src/lib/track.ts`, `src/lib/scenery.ts` |
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
