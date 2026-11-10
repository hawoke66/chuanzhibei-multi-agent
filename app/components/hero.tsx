'use client';

import { RiseText } from './ui';

/* 序章的封面：书名、书名下的定位句，以及一句页脚注。
   协作图挪到了第二章（实时 DAG），这里只留字。 */

export default function Hero({ t }: { t: (key: string) => string }) {
  return (
    <header className="pt-6">
      <p className="caption-4 flex items-center gap-2 text-ink-3">
        <span className="h-px w-8 bg-line-2" aria-hidden="true" />
        {t('heroKicker')}
      </p>
      <h1 className="rise-run mt-2 max-w-[680px] text-pretty text-ink heading-5 sm:heading-4 lg:heading-4">
        <RiseText text={t('heroTitleLine1')} start={60} step={36} />
        <br />
        <RiseText text={t('heroTitleLine2')} start={180} step={26} />
      </h1>
      <p className="body-6 mt-2 max-w-[620px] text-pretty text-ink-2">{t('heroSub')}</p>
      <p className="caption-5 mt-3 font-mono text-ink-3">{t('heroCaption')}</p>
    </header>
  );
}
