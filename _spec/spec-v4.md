# Spec v4 — fim da pista realista, carros caem no vórtex, 2º hero, barra de comparação por zona

Complementa as specs v1–v3. Em conflito, vale a v4. Leia `AGENTS.md` antes. Pedido do dono (2026-11-18), com prints:
- o fim da pista atual parece confete (quadradinhos soltos);
- a barra de comparação ainda está no estilo antigo (vidro escuro azulado) e não muda entre a corrida e o espaço.

## 1. Fim da pista partido, realista
O fim da pista continua **sempre partido** (não é animação de quebra; spec-v3 §2 já foi trocado por isso no código atual: `applyEdge` em `RaceMap.tsx`). Melhorar o desenho:
- **Borda partida irregular**: a pista inteira termina numa linha de fratura em zigue-zague (não reta), com a camada de asfalto mostrando "espessura": uma faixa 3–5 px mais escura (`#3b404c`) na borda partida, como um corte de placa vista de cima levemente inclinada.
- **Placas grandes e irregulares**: o trecho final (~240 px) se parte em 10–16 **placas poligonais** (5–8 vértices, 28–70 px), geradas por semente (tipo Voronoi simples sobre a faixa da pista), cada placa carregando **o pedaço de asfalto, de faixa central e de zebra que estava ali** (recortar com `clipPath` do próprio desenho da pista, ou desenhar o polígono com as mesmas cores e um trecho de zebra quando tocar a borda). Nada de quadradinhos genéricos.
- **Caindo no vazio**: quanto mais perto da ponta, mais a placa se afastou do lugar, girou um pouco e "caiu": menor (escala 1 → 0,55), mais escura (brilho 1 → 0,45) e com uma sombra suave deslocada embaixo que vai se separando dela (sensação de altura). Entre as placas, cascalho fino (8–20 pontinhos de 1–3 px) e 2–4 lascas de zebra.
- Tudo estático (posição função da distância ao fim), sem animação contínua; com movimento ligado pode ter uma oscilação lentíssima (±1,5 px, 6 s) nas placas soltas, só com GPU.
- Movimento reduzido: o mesmo desenho, parado.

## 2. Carros caem no vórtex; os planetas não dependem mais dos carros
- Os carros continuam pela rolagem até a ponta partida e **saltam** (como hoje: o leve crescimento na saída).
- Depois do salto, cada carro é **puxado para o centro da galáxia** do 2º hero (§3) numa espiral: trajetória que gira em volta do núcleo (1–1,5 voltas, sentido da rotação da galáxia), raio diminuindo, escala 1 → 0,08, opacidade some nos últimos 20%, um pequeno lampejo branco no núcleo quando cada um some. Posição função da rolagem (rolar para cima desfaz), como hoje.
- **Quantidade de carros fixa e decorativa: 5** (constante no código, com comentário). Eles **não representam modelos** e não precisam mudar quando entra modelo novo. Remover a ligação carro → planeta: os planetas do mapa orbital aparecem por conta própria (fade-in ao entrar na tela; no movimento reduzido, visíveis), sem esperar carro. Remover o anel de chegada e o `data-arrival` se não forem mais usados.
- Atualizar `AGENTS.md`: os carros agora são 5 fixos, decorativos; adicionar modelo novo não mexe neles.

## 3. "Orbitarium … bench" vira um 2º hero de tela inteira
- O título dividido e a galáxia passam a ocupar **uma tela inteira** (`min-height: 100svh`, no mínimo 640 px), como a referência: "Orbitarium" à esquerda, "bench" à direita, na mesma linha, centralizados na vertical; a galáxia grande no meio, entre as palavras (o núcleo no `data-galaxy-core`, o raio pelo vão — `spiralRadius` já faz isso). **Nada mais nessa tela** (o texto de apoio desce para o início da seção seguinte).
- Logo abaixo, a seção normal do Orbitarium: o texto de apoio, o mapa orbital e a lista (layout atual).
- A galáxia fica presa ao 2º hero (sai junto quando ele sai da tela, com o parallax atual); atrás do conteúdo da seção seguinte ela não aparece mais (resolve a galáxia passando atrás do texto e da lista).
- Celular: as duas palavras empilhadas, grandes, galáxia atrás, ocupando a tela.
- O letreiro decifra ao entrar (como hoje).

## 4. Barra de comparação que muda com a zona
A barra é a mesma (mesmas funções), mas troca de pele conforme a zona em que o meio da janela está:
- **Corrida** (do topo até a linha de chegada): pele clara, como os cards creme: fundo `rgba(255,248,239,.92)` + `backdrop-filter: blur(14px)`, borda 1 px `--card-line`, sombra `0 14px 36px rgba(60,40,20,.18)`, texto `--ink-navy`, chips com fundo branco e borda `--card-line` (ponto na cor do modelo), "+ modelo" com borda tracejada `--ink-navy-2`, botão principal "Ver lado a lado" sólido **navy** `--ink-navy` com texto creme. Raio 18 px.
- **Espaço** (da linha de chegada para baixo): pele do espaço (spec-v3): fundo `rgba(10,10,12,.72)` + blur 16 px, borda `rgba(255,255,255,.10)`, sem sombra colorida, texto `--sp-ink`, chips translúcidos `--sp-pill` (ponto na cor do modelo), "+ modelo" translúcido, botão principal **pílula branca sólida** com texto preto. Raio 999 px nos controles, 22 px na barra.
- A troca é um cross-fade de 300 ms (opacidade de duas camadas de fundo, ou variáveis CSS com `transition` nas cores) disparado por um atributo `data-zone="race|space"` no `<html>` ou na barra, decidido pela mesma linha de chegada do mapa (expor a posição da chegada no `raceState`). O popover "+ modelo" segue a pele da zona.
- Movimento reduzido: troca sem transição. Contraste AA nas duas peles. Celular: mesmo comportamento (barra compacta atual).
- A faixa de aviso de movimento (`MotionNotice`) segue a mesma pele da zona.

## 5. Regras
Sem ranking, sem FPS, só `transform`/`opacity` por quadro (exceções documentadas), sem rolagem lateral 375–1920, movimento reduzido estático, AA, mapa ≤ 650 elementos (as placas ficam na camada de efeitos, não contam). Pode: `npm install`, `tsc`, `lint`, `build`, ler arquivos e imagens. Não pode: servidor, navegador, print, git, mexer em `design/`, `_spec/`, dados gerados. Ao terminar: build e lint limpos, `AGENTS.md` atualizado, relatório (arquivos, desvios e por quê, o que não fez).
