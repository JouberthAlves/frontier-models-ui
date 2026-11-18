import ExternalLink from './ExternalLink';
import { useI18n } from '../i18n/i18n';
import { methodologyUrl, repoUrl } from '../data/archive';
import { useReveal } from '../lib/reveal';
import './Footer.css';

export default function Footer() {
  const { t } = useI18n();
  const reveal = useReveal<HTMLElement>();

  return (
    <footer ref={reveal} className="footer space">
      <span className="footer__seam" aria-hidden="true" />
      <div className="shell footer__inner">
        <p className="footer__about">{t.footer.about}</p>
        <nav aria-label={t.footer.links}>
          <ul className="footer__links">
            <li>
              <ExternalLink href={repoUrl}>{t.footer.repo}</ExternalLink>
            </li>
            <li>
              <ExternalLink href={methodologyUrl}>{t.footer.methodology}</ExternalLink>
            </li>
          </ul>
        </nav>
        <p className="caption footer__credit">
          <a className="footer__credit-link" href="https://reactbits.dev" target="_blank" rel="noopener noreferrer">
            {t.footer.credit}
            <span className="sr-only"> {t.newTab}</span>
          </a>
        </p>
      </div>
    </footer>
  );
}
