import { useI18n, type Lang } from '../i18n/i18n';
import './Nav.css';

const LANGS: Lang[] = ['pt', 'en'];

export default function Nav() {
  const { t, lang, setLang } = useI18n();

  // Dark glass from the first screen: over the pastel map the nav is always the HUD.
  return (
    <header className="nav">
      <div className="nav__inner">
        <a className="nav__brand" href="#top" aria-label={t.nav.home}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={22} height={22} alt="" />
          <span aria-hidden="true">FRONTIER MODELS</span>
        </a>
        <nav className="nav__links" aria-label={t.nav.sections}>
          <a className="link nav__link" href="#racing">
            {t.nav.racing}
          </a>
          <a className="link nav__link" href="#orbitarium">
            {t.nav.orbitarium}
          </a>
          <a className="link nav__link" href="#prompts">
            {t.nav.prompts}
          </a>
          <a className="link nav__link" href="#archive">
            {t.nav.archive}
          </a>
        </nav>
        <div className="nav__lang" role="group" aria-label={t.nav.language}>
          {LANGS.map((code, index) => (
            <span key={code} className="nav__lang-item">
              {index > 0 && (
                <span className="nav__lang-sep" aria-hidden="true">
                  /
                </span>
              )}
              <button
                type="button"
                className="nav__lang-btn"
                aria-pressed={lang === code}
                lang={code === 'pt' ? 'pt-BR' : 'en'}
                onClick={() => setLang(code)}
              >
                {code.toUpperCase()}
              </button>
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
