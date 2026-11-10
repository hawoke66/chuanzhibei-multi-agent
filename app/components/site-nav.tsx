'use client';

import { useEffect, useState } from 'react';
import { List, Star, X } from '@phosphor-icons/react';
import { Glyph } from './ui';

/* 悬浮导航：这一版导航就是书的目录，点一下翻到对应章。 */

export default function SiteNav({
  t,
  langLabel,
  onToggleLang,
  page,
  onNavigate,
  labels,
}: {
  t: (key: string) => string;
  langLabel: string;
  onToggleLang: () => void;
  page: number;
  onNavigate: (next: number) => void;
  labels: string[];
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

      <header className="fixed inset-x-0 top-3 z-40 flex justify-center px-4">
        <nav className="flex w-full max-w-3xl items-center justify-between gap-2 rounded-full border border-white/10 bg-void/55 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors duration-300 ease-out-soft hover:bg-raised"
          >
            <Star size={14} weight="fill" className="text-accent" aria-hidden="true" />
            <span className="title-4 text-ink">{t('navHome')}</span>
          </button>

          <ul className="hidden items-center gap-0.5 md:flex">
            {labels.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onNavigate(index + 1)}
                  aria-current={page === index + 1 ? 'page' : undefined}
                  className={`caption-2 rounded-full px-2.5 py-1.5 transition-colors duration-300 ease-out-soft ${
                    page === index + 1 ? 'bg-raised text-ink' : 'text-ink-2 hover:bg-raised hover:text-ink'
                  }`}
                >
                  <span className="font-mono text-ink-3 tabular-nums">{index + 1}</span>
                  <span className="ml-1.5">{label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleLang}
              className="caption-2 rounded-full px-2.5 py-1.5 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
            <span className="caption-4 text-ink-3">{t('pageJump')}</span>
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
          <div className="mt-8 flex flex-col gap-1">
            {labels.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onNavigate(index + 1);
                  setOpen(false);
                }}
                tabIndex={open ? 0 : -1}
                className={`flex items-baseline gap-3 border-b border-line py-3 text-left transition-[transform,opacity] duration-500 ease-out-soft ${
                  open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                } ${page === index + 1 ? 'text-ink' : 'text-ink-2'}`}
                style={{ transitionDelay: open ? `${index * 60}ms` : '0ms' }}
              >
                <span className="caption-5 font-mono text-ink-3 tabular-nums">0{index + 1}</span>
                <span className="heading-6">{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onToggleLang();
                setOpen(false);
              }}
              tabIndex={open ? 0 : -1}
              className={`caption-1 mt-6 self-start rounded-lg border border-line-2 px-4 py-2 text-ink-2 transition-[transform,opacity] duration-500 ease-out-soft ${
                open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
              style={{ transitionDelay: open ? `${labels.length * 60}ms` : '0ms' }}
            >
              {langLabel}
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
