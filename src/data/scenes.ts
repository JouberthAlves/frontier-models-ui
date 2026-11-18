import type { Lang } from '../i18n/i18n';

export const SCENE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const NAMES: Record<Lang, string[]> = {
  pt: [
    'Reta da orla',
    'Carro no grid',
    'Praia e espuma',
    'Falésia e mirante',
    'Rua da vila',
    'Bosque com sol rasante',
    'Ponte ou túnel',
    'Disputa lado a lado',
    'Close da pista',
    'Vila na qualidade baixa',
    'Escala do carro',
    'Mapa da volta'
  ],
  en: [
    'Seafront straight',
    'Car on the grid',
    'Beach and surf',
    'Cliff lookout',
    'Village street',
    'Woods in low sun',
    'Bridge or tunnel',
    'Side-by-side battle',
    'Track close-up',
    'Village on Low',
    'Car to scale',
    'Lap map'
  ]
};

export const sceneName = (lang: Lang, n: number): string => NAMES[lang][n - 1] ?? `S${n}`;
