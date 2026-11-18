import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export default function ExternalLink({ href, children, className = 'link' }: ExternalLinkProps) {
  const { t } = useI18n();
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="link__arrow" aria-hidden="true">
        ↗
      </span>
      <span className="sr-only">{t.newTab}</span>
    </a>
  );
}
