'use client';

import { WordReveal } from './ui';

/* 大字标语：页面中段唯一的「大字」时刻，逐词从 30% 淡色过渡到全色。
   只有这三行放行高（1.28），其他标题仍用各自 token 的行高。 */

export default function Tagline({ t }: { t: (key: string) => string }) {
  const words = t('taglineWords').split('|').filter(Boolean);

  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
      <div className="lg:max-w-[900px]">
        <p className="caption-4 flex items-center gap-3 text-ink-3">
          <span className="h-px w-8 bg-line-2" aria-hidden="true" />
          {t('taglineKicker')}
        </p>
        <WordReveal words={words} className="tagline-lines heading-3 mt-8 text-pretty text-ink lg:heading-2" />
      </div>
    </section>
  );
}
