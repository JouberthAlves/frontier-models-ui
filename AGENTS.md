# AGENTS.md

Instruções para qualquer agente (Claude Code, Codex, Cursor…) que mexa neste repo. Leia inteiro antes da primeira edição.

## O que é

Interface para comparar as execuções do arquivo de benchmarks **Frontier Models** (fork `JouberthAlves/Frontiers-Models`, original `bielxdh3/Frontiers-Models`). Dois benchmarks: **Racing-bench** (jogo de corrida 3D, 12 prints de cena por execução) e **Orbitarium-bench** (Sistema Solar interativo). Direção visual: "Pista e Céu" (F1 noturna × planetário); spec completo em `_spec/spec.md`, protótipo da pista em `design/prototipo-pista.html`.

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

Não é preciso mexer no código dos carros: **a quantidade de carros e o destino de cada um vêm dos dados** (ver abaixo).

## Os carros da pista

- São **mocks neutros**: todos com a mesma pintura (cinza quente + faixa laranja da UI), **sem cor de modelo**. Durante a corrida eles não representam ninguém, então a fila nunca vira ordem de chegada.
- **Quantidade = número de execuções atuais do Orbitarium** (`current_arena` do Orbitarium em `archive.json`). Entrou um modelo no Orbitarium, entra um carro; saiu, sai um carro. Nunca escrever o número 5 no código.
- Depois da linha de chegada, cada carro flutua até o planeta de **um** modelo do Orbitarium (na ordem da arena) e só aí ganha a cor dele.
- **Modelo só no Racing:** aparece nos cards, no palco e no visor do Racing, nunca vira carro nem estrela. **Modelo só no Orbitarium:** vira estrela/planeta, sem precisar estar no Racing. Nenhum caso exige exceção no código.

## Escolher a cor de um modelo novo

O carro chega sem cor; quem adiciona o modelo decide a cor dele. Para não estragar o visual:

1. **Se o original já tem cor**, use a dela: o gerador da imagem do README (`scripts/render-benchmark-assets.mjs` no repo de benchmarks) tem um array de cores por posição da arena. A cor é por benchmark (a chave em `models.ts` é `benchmark:id`).
2. **Se não tem**, escolha uma que cumpra todas as regras:
   - tom pastel luminoso, como as outras: em OKLCH, luminosidade entre 0,78 e 0,88 e croma entre 0,08 e 0,16;
   - matiz a pelo menos 25° de qualquer outra cor de modelo atual **do mesmo benchmark**;
   - contraste de pelo menos 7:1 sobre `#080f1d` (texto do nome usa a cor);
   - **reservadas, não usar:** vermelho da zebra `#e8423a`, laranja da UI `#fdaf6d`/`#ffb76b`, ciano da UI `#85e4eb`/`#80e9f2`, branco puro;
   - conferir em print o chip, o ponto, a barra do card e o planeta lado a lado com as outras cores.
3. Cor de modelo é **só identidade** (ponto, barra de 3 px, contorno, planeta). Nunca vira fundo grande nem botão.
4. Fora da arena atual, todo modelo usa o cinza `#8fa5bf` (já é automático em `colorOf`).

## Onde estão as coisas

| O quê | Onde |
|---|---|
| Spec e regras de design | `_spec/spec.md` |
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
