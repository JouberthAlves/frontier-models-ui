# frontier-models-ui

Interface para navegar pelas execuções do [Frontier Models](https://github.com/JouberthAlves/Frontiers-Models).

Os dados vêm dos `RUNS.json` do fork, fixados num commit, por um script de sync. Este repo não guarda os snapshots dos benchmarks.

## Como rodar

Requer Node 20+ e npm.

```sh
npm install
npm run sync      # lê o fork (somente leitura) e gera src/data/archive.json + public/scenes/**
npm run dev       # servidor de desenvolvimento
npm run build     # tsc -b && vite build → dist/
npm run lint      # eslint (flat config, react-hooks)
```

### Sync

`npm run sync -- --fork ../Frontiers-Models --commit a71127c`

- Padrões: `--fork ../Frontiers-Models` e o commit fixado `a71127c12508e4b7b35e62a711d3ef98986e0f4c` (resolvido com `git rev-parse`).
- Lê `benchmarks/racing/RUNS.json` e `benchmarks/solar-system/RUNS.json` com `git show <sha>:<caminho>`; nada é escrito no fork.
- Converte os 12 prints de cena de cada uma das 6 corridas atuais para `public/scenes/<runId>/s<N>-640.webp` e `s<N>-1600.webp` (sharp).
- Os arquivos gerados são versionados: o deploy não tem acesso ao fork.

Os componentes em `src/components/bits/` são adaptações do [React Bits](https://reactbits.dev) / Vue Bits, de David Haz (MIT + Commons Clause); cada arquivo mantém o aviso de licença no topo.
