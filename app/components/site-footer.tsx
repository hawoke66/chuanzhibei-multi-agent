'use client';

import { Star } from '@phosphor-icons/react';
import { NAV_LINKS } from '../copy';

/* 页脚：产品名 + 一条标语 + 真实链接 + 设计规范署名。
   底部留白略多于顶部。 */

export default function SiteFooter({ t }: { t: (key: string) => string }) {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-24 pt-20 lg:px-8 lg:pb-28">
      <div className="grid gap-10 border-t border-line pt-10 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="flex items-center gap-2">
            <Star size={16} weight="fill" className="text-accent" aria-hidden="true" />
            <span className="title-4 text-ink">{t('navHome')}</span>
          </div>
          <p className="body-6 mt-3 max-w-[360px] text-pretty text-ink-2">{t('footerTagline')}</p>
        </div>

        <div className="lg:col-span-3">
          <p className="caption-5 text-ink-3">{t('footerProduct')}</p>
          <ul className="mt-2 space-y-1.5">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="caption-2 text-ink-2 transition-colors duration-300 ease-out-soft hover:text-ink"
                >
                  {t(link.key)}
                </a>
              </li>
            ))}
            <li>
              <a
                href="https://github.com/hawoke66/chuanzhibei-multi-agent"
                target="_blank"
                rel="noreferrer"
                className="caption-2 text-ink-2 transition-colors duration-300 ease-out-soft hover:text-ink"
              >
                {t('footerRepo')}
              </a>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-3">
          <p className="caption-5 text-ink-3">{t('footerCreditTitle')}</p>
          <p className="caption-5 mt-2 max-w-[280px] text-pretty text-ink-3">{t('footerCredit')}</p>
        </div>
      </div>

      <p className="caption-5 mt-10 font-mono text-ink-3">{t('footerRights')}</p>
    </footer>
  );
}
