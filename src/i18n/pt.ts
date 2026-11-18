export const pt = {
  meta: {
    title: 'Frontier Models · Racing e Orbitarium',
    description:
      'Compare lado a lado os jogos de corrida e os sistemas solares que modelos de IA de fronteira construíram a partir dos mesmos prompts.'
  },
  nav: {
    skip: 'Pular para o conteúdo',
    home: 'Frontier Models, início',
    sections: 'Seções',
    racing: 'Corrida',
    orbitarium: 'Orbitarium',
    prompts: 'Prompts',
    archive: 'Arquivo',
    language: 'Idioma'
  },
  hero: {
    lede: (projects: number) => `Os mesmos prompts. ${projects} projetos completos. Compare cena por cena.`,
    stats: ['benchmarks', 'projetos atuais', 'cenas por corrida'],
    primary: 'Comparar corridas',
    secondary: 'Explorar o Orbitarium'
  },
  compare: {
    region: 'Barra de comparação',
    label: 'Comparar:',
    remove: (model: string) => `Remover ${model}`,
    add: '+ modelo',
    addLabel: 'Adicionar modelo à comparação',
    listLabel: 'Modelos do Racing',
    chosen: 'na comparação',
    view: 'Ver lado a lado',
    viewShort: 'Comparar'
  },
  racing: {
    eyebrow: 'Benchmark 002',
    title: 'Racing-bench V3.4',
    intro:
      'Cada modelo recebeu o mesmo prompt de corrida, com imagens de referência (V3.4; no Fable 5.2, a revisão V3.4.1), e entregou um jogo de corrida 3D completo: um circuito costeiro com 5 oponentes de IA.',
    scenes: 'Cenas',
    stage: (scene: string) => `Comparação da cena ${scene}`,
    play: 'Jogar',
    code: 'Código',
    deleted: 'Excluído',
    enlarge: (alt: string) => `Ampliar: ${alt}`,
    games: (count: number) => `Os ${count} jogos`,
    prompt: 'Prompt V3.4',
    compareAdd: 'Comparar',
    compareIn: 'Na comparação',
    compareFull: 'Limite de 3',
    compareAddLabel: (model: string) => `Adicionar ${model} à comparação`,
    note: 'Os sites e números de verificação são informados por quem executou. Estar na lista atual não significa aceite no benchmark.'
  },
  viewer: {
    label: 'Visor de cena',
    close: 'Fechar',
    prev: 'Cena anterior',
    next: 'Próxima cena',
    slider: 'Régua de comparação',
    pair: 'Par comparado',
    sliderValue: (left: string, right: string, percent: number) =>
      `${left} à esquerda, ${right} à direita, ${percent}%`
  },
  orbitarium: {
    eyebrow: 'Benchmark 001',
    title: 'Orbitarium-bench',
    intro:
      'Cada modelo construiu um Sistema Solar interativo a partir de uma especificação densa de produto: navegação, tempo, órbitas, acessibilidade e honestidade científica.',
    map: 'Mapa orbital dos projetos atuais',
    select: (model: string) => `Selecionar ${model}`,
    promptV2: 'Prompt Frontier V2',
    promptUnverified: 'Prompt não verificado no arquivo',
    open: 'Abrir projeto',
    code: 'Código',
    deleted: 'Excluído',
    selected: 'selecionado'
  },
  prompts: {
    title: 'As versões do prompt',
    racingTabs: 'Versões do prompt do Racing',
    orbitTabs: 'Versões do prompt do Orbitarium',
    current: 'atual',
    candidate: 'candidato',
    file: 'Arquivo',
    status: 'Estado',
    size: 'Tamanho',
    lines: (n: string) => `${n} linhas`,
    attachment: 'Anexo obrigatório',
    usedBy: 'Execuções com este prompt',
    none: 'Nenhuma execução do arquivo usa este prompt.',
    read: 'Ler o prompt',
    states: {
      legacy: 'Legado, arquivado na íntegra',
      historical: 'Histórico, congelado',
      current: 'Atual',
      candidate: 'Candidato para as próximas execuções',
      original: 'Original',
      archived: 'Arquivado'
    }
  },
  archive: {
    title: 'Todo o arquivo',
    filters: 'Filtrar por categoria',
    benchFilter: 'Filtrar por benchmark',
    all: 'Todos',
    categories: {
      current: 'Atual',
      legacy: 'Legado',
      historical: 'Histórico',
      outdated: 'Desatualizado',
      'non-frontier': 'Não frontier'
    },
    cols: {
      model: 'Modelo',
      benchmark: 'Benchmark',
      category: 'Categoria',
      site: 'Site',
      code: 'Código',
      prompt: 'Prompt'
    },
    open: 'Abrir',
    deleted: 'Excluído',
    code: 'Código',
    record: 'Registro',
    unverified: 'não verificado',
    empty: 'Nenhuma execução com esses filtros.',
    commitBefore: 'Dados do commit ',
    commitAfter: ' do Frontiers Models.',
    count: (n: number) => (n === 1 ? '1 execução' : `${n} execuções`)
  },
  footer: {
    about:
      'Frontier Models é um arquivo independente de benchmarks. Os nomes dos modelos identificam os sistemas usados em cada execução.',
    repo: 'Repositório do arquivo',
    methodology: 'Metodologia',
    credit: 'Fundo e efeitos de texto adaptados do React Bits, de David Haz (MIT + Commons Clause).',
    links: 'Links do arquivo'
  },
  loader: {
    text: 'Carregando o grid',
    progress: (done: number, total: number) => `Carregando ${done} de ${total}`
  },
  notice: {
    text: 'Animações simplificadas neste aparelho: os carros ficam no grid e o fundo fica parado.',
    close: 'Fechar aviso'
  },
  newTab: '(abre em nova aba)'
};

export type Dict = typeof pt;
