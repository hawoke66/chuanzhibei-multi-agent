'use client';

import { SCENARIOS } from '../copy';
import { Reveal } from './ui';

/* 适用场景：三张卡不做三等分并排。
   第一张是唯一的表面块，第二张只有一条 hairline 起头并下沉，第三张抬升并前移，形成错落。 */

const CONTAINERS = [
  'rounded-2xl bg-surface p-6 lg:p-8',
  'border-t border-line pt-6',
  'rounded-xl bg-raised p-6 lg:p-7',
];

const POSITIONS = [
  'lg:col-span-5',
  'lg:col-span-5 lg:col-start-8 lg:mt-16',
  'lg:col-span-5 lg:col-start-3 lg:-mt-8',
];

export default function Scenarios({ t }: { t: (key: string) => string }) {
  return (
    <section id="scenarios" className="relative mx-auto w-full max-w-7xl px-6 py-24 lg:px-8 lg:py-32">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="caption-4 text-ink-3">{t('scenarioKicker')}</p>
            <h2 className="mt-4 text-ink heading-4 sm:heading-3">
              {t('scenarioTitleLine1')}
              <br />
              {t('scenarioTitleLine2')}
            </h2>
          </div>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-8">
        {SCENARIOS.map((scenario, index) => (
          <Reveal key={scenario.key} className={POSITIONS[index]} delay={index * 60}>
            <article className={CONTAINERS[index]}>
              <p className="caption-5 font-mono text-ink-3 tabular-nums">{scenario.index}</p>
              <h3 className="title-1 mt-2 text-ink">{t(scenario.title)}</h3>
              <p className="body-6 mt-3 text-pretty text-ink-2">{t(scenario.scene)}</p>
              <p className="caption-5 mt-5 text-ink-3">{t('scenarioHelpLabel')}</p>
              <p className="body-6 mt-1 text-pretty text-ink-2">{t(scenario.help)}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
