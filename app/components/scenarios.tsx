'use client';

import { SCENARIOS } from '../copy';
import { Reveal } from './ui';
import { MagicCard } from './magicui/magic-card';

/* 适用场景：三张卡不做三等分并排。
   书页模式（compact）用一条紧凑的三列放在序章任务框下面；独立区块仍用错落布局。 */

const CONTAINERS = [
  'lift tint-blue card p-6 lg:p-8',
  'lift tint-violet card p-6 lg:p-7',
  'lift tint-teal card p-6 lg:p-7',
];

const POSITIONS = [
  'lg:col-span-5',
  'lg:col-span-5 lg:col-start-8 lg:mt-16',
  'lg:col-span-5 lg:col-start-3 lg:-mt-8',
];

export default function Scenarios({
  t,
  compact = false,
}: {
  t: (key: string) => string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="caption-5 text-ink-3">{t('scenarioKicker')}</p>
          <p className="caption-5 text-ink-3">
            {t('scenarioTitleLine1')}
            {t('scenarioTitleLine2')}
          </p>
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-12">
          {SCENARIOS.map((scenario, index) => (
            <MagicCard
              key={scenario.key}
              glowColor={index === 0 ? '169, 155, 245' : index === 1 ? '198, 160, 255' : '110, 205, 190'}
              className={`lift sm:col-span-4 ${
                index === 1 ? 'sm:mt-4' : index === 2 ? 'sm:-mt-1 sm:col-start-9' : ''
              } p-3`}
            >
              <p className="caption-5 font-mono text-ink-3 tabular-nums">{scenario.index}</p>
              <h3 className="title-4 mt-0.5 text-ink">{t(scenario.title)}</h3>
              <p className="caption-5 mt-1 line-clamp-2 text-pretty text-ink-2">{t(scenario.scene)}</p>
            </MagicCard>
          ))}
        </div>
      </div>
    );
  }

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
