import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { pt, type Dict } from './pt';
import { en } from './en';

export type Lang = 'pt' | 'en';

const STORAGE_KEY = 'fm-lang';
const DICTS: Record<Lang, Dict> = { pt, en };

interface I18nValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
  /** Number formatter for the active language. */
  nf: Intl.NumberFormat;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt' || stored === 'en') return stored;
  } catch {
    /* storage blocked */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function setMeta(selector: string, value: string) {
  document.querySelectorAll<HTMLMetaElement>(selector).forEach(meta => meta.setAttribute('content', value));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const t = DICTS[lang];

  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = t.meta.title;
    setMeta('meta[name="description"]', t.meta.description);
    setMeta('meta[property="og:title"], meta[name="twitter:title"]', t.meta.title);
    setMeta('meta[property="og:description"], meta[name="twitter:description"]', t.meta.description);
    setMeta('meta[property="og:locale"]', lang === 'pt' ? 'pt_BR' : 'en_US');
  }, [lang, t]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked */
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, t, setLang, nf: new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US') }),
    [lang, t, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
