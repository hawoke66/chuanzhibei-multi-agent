'use client';

import { useEffect, useState } from 'react';
import { List, Star, X } from '@phosphor-icons/react';
import { Glyph } from './ui';
import { NAV_LINKS } from '../copy';

/* 悬浮导航：离顶边留空隙、按内容定宽、半透明 + 背景模糊。
   小屏收进一个按钮，展开是全高面板，链接按阅读顺序依次到位。 */

export default function SiteNav({
  t,
  langLabel,
  onToggleLang,
}: {
  t: (key: string) => string;
  langLabel: string;
  onToggleLang: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <a
        href="#main"
        className="caption-1 sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-void"
      >
        {t('skipToContent')}
      </a>

      <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
        <nav className="flex w-full max-w-3xl items-center justify-between gap-2 rounded-full border border-line bg-void/70 px-2 py-2 backdrop-blur-md">
          <a
            href="#main"
            className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors duration-300 ease-out-soft hover:bg-raised"
          >
            <Star size={16} weight="fill" className="text-accent" aria-hidden="true" />
            <span className="title-4 text-ink">{t('navHome')}</span>
          </a>

          <ul className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="caption-2 rounded-full px-3 py-1.5 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink"
                >
                  {t(link.key)}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleLang}
              className="caption-2 rounded-full px-3 py-1.5 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {langLabel}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t('navMenu')}
              aria-expanded={open}
              className="rounded-full p-1.5 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
            >
              <Glyph as={List} size={18} />
            </button>
          </div>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-30 md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 bg-void/95 backdrop-blur-xl transition-opacity duration-300 ease-out-soft ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <nav
          className={`relative flex h-full flex-col justify-center px-8 transition-opacity duration-300 ease-out-soft ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="caption-4 text-ink-3">{t('navHome')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('navClose')}
              tabIndex={open ? 0 : -1}
              className="rounded-full p-2 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink"
            >
              <Glyph as={X} size={18} />
            </button>
          </div>
          <div className="mt-10 flex flex-col gap-2">
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                className={`heading-5 border-b border-line py-4 text-ink transition-[transform,opacity] duration-500 ease-out-soft ${
                  open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                }`}
                style={{ transitionDelay: open ? `${index * 60}ms` : '0ms' }}
              >
                {t(link.key)}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                onToggleLang();
                setOpen(false);
              }}
              tabIndex={open ? 0 : -1}
              className={`caption-1 mt-8 self-start rounded-lg border border-line-2 px-4 py-2 text-ink-2 transition-[transform,opacity] duration-500 ease-out-soft ${
                open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
              style={{ transitionDelay: open ? `${NAV_LINKS.length * 60}ms` : '0ms' }}
            >
              {langLabel}
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
