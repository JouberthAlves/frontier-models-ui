import './styles/tokens.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/i18n';
import { CompareProvider, DEFAULT_COMPARE } from './context/CompareContext';
import { IgnitionProvider } from './context/IgnitionContext';
import { racingArena, sceneSrc } from './data/archive';
import { SCENE_NUMBERS } from './data/scenes';
import { isOpen, onBoot, preloadImages, startBoot } from './lib/boot';
import { whenIdle } from './lib/motion';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

// Loading steps 3 and 4 (spec-v2 §8): the scene thumbnails of the first compared model and the
// large S1 of the chosen models. Steps 1, 2 and 5 are reported by the fonts, RaceMap and the sky.
const lead = DEFAULT_COMPARE[0] ?? racingArena[0];
startBoot({
  thumbs: () => preloadImages(lead ? SCENE_NUMBERS.map(n => sceneSrc(lead.id, n, 640)) : []),
  stage: () => preloadImages(DEFAULT_COMPARE.map(run => sceneSrc(run.id, SCENE_NUMBERS[0], 1600)))
});

// Once the page is open, the rest of the first-row pictures load when the browser is idle.
const stop = onBoot(state => {
  if (!isOpen(state.phase)) return;
  stop();
  whenIdle(() => {
    void preloadImages(racingArena.map(run => sceneSrc(run.id, SCENE_NUMBERS[0], 640)));
  });
});

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <CompareProvider>
        <IgnitionProvider>
          <App />
        </IgnitionProvider>
      </CompareProvider>
    </I18nProvider>
  </StrictMode>
);
