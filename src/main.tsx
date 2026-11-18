import './styles/tokens.css';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n/i18n';
import { CompareProvider } from './context/CompareContext';
import { IgnitionProvider } from './context/IgnitionContext';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

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
