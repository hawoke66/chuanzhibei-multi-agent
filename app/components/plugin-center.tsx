'use client';

import { useRef } from 'react';
import { ArrowUpRight, PuzzlePiece, X } from '@phosphor-icons/react';
import type { Lang } from '../copy';
import {
  BUILTIN_PLUGINS,
  localizedCapabilities,
  localizedDescription,
  localizedName,
  localizedPermissions,
  type BuiltinPluginId,
  type PluginManifest,
  type PluginState,
} from '../../lib/plugins';
import { Glyph, Reveal, Switch } from './ui';

/* 插件中心：内置插件真实启停，第三方 manifest 只展示。
   列表用 hairline 分行，不做卡片；开关是唯一的有状态控件。 */

export default function PluginCenter({
  t,
  lang,
  state,
  onToggle,
  imported,
  importError,
  onImport,
  onRemoveImported,
}: {
  t: (key: string) => string;
  lang: Lang;
  state: PluginState;
  onToggle: (id: BuiltinPluginId, next: boolean) => void;
  imported: PluginManifest[];
  importError: string;
  onImport: (file: File) => void;
  onRemoveImported: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <section id="plugins" className="relative mx-auto w-full max-w-7xl px-6 py-24 lg:px-8">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="caption-4 text-ink-3">{t('pluginsKicker')}</p>
            <h2 className="mt-4 text-ink heading-4 sm:heading-3">
              {t('pluginsTitleLine1')}
              <br />
              {t('pluginsTitleLine2')}
            </h2>
          </div>
          <p className="body-3 lg:col-span-6 lg:col-start-7 lg:self-end text-pretty text-ink-2">{t('pluginsLead')}</p>
        </div>
      </Reveal>

      <div className="mt-12 border-t border-line">
        {BUILTIN_PLUGINS.map(({ id, manifest }) => {
          const enabled = state[id];
          return (
            <div key={id} className="grid gap-4 border-b border-line py-6 lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Glyph as={PuzzlePiece} size={16} className="text-ink-3" />
                  <h3 className="title-2 text-ink">{localizedName(manifest, lang)}</h3>
                  <span className="caption-5 rounded border border-line-2 px-1.5 py-0.5 text-ink-3">
                    {t('pluginBuiltin')}
                  </span>
                </div>
                <p className="caption-5 mt-2 font-mono text-ink-3 tabular-nums">
                  v{manifest.version} · {manifest.author}
                </p>
              </div>

              <div className="lg:col-span-5">
                <p className="body-6 text-pretty text-ink-2">{localizedDescription(manifest, lang)}</p>
                <p className="caption-5 mt-4 text-ink-3">{t('pluginCapabilities')}</p>
                <p className="caption-2 mt-1 text-pretty text-ink-2">
                  {localizedCapabilities(manifest, lang).join(' · ')}
                </p>
                <p className="caption-5 mt-3 text-ink-3">{t('pluginPermissions')}</p>
                <p className="caption-2 mt-1 text-pretty text-ink-2">
                  {localizedPermissions(manifest, lang).join(' · ')}
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 lg:col-span-3 lg:flex-col lg:items-end">
                <span className={`caption-5 ${enabled ? 'text-ink-2' : 'text-ink-3'}`}>
                  {enabled ? t('pluginEnabled') : t('pluginDisabled')}
                </span>
                <Switch
                  checked={enabled}
                  onChange={(next) => onToggle(id, next)}
                  label={`${enabled ? t('pluginDisable') : t('pluginEnable')} ${localizedName(manifest, lang)}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Reveal delay={60}>
        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h3 className="caption-4 text-ink-3">{t('pluginImportedTitle')}</h3>
            <p className="caption-5 mt-1 text-ink-3">{t('pluginImportHint')}</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="caption-4 mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-2 text-ink-2 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('pluginImport')}
              <Glyph as={ArrowUpRight} size={16} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = '';
              }}
            />
            {importError && <p className="caption-2 mt-3 max-w-[360px] text-danger">{importError}</p>}
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            {imported.length === 0 ? (
              <p className="caption-2 border-t border-line py-4 text-ink-3">{t('pluginImportedEmpty')}</p>
            ) : (
              <ul>
                {imported.map((manifest) => (
                  <li key={manifest.id} className="flex items-start justify-between gap-4 border-t border-line py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="title-4 text-ink">{localizedName(manifest, lang)}</p>
                        <span className="caption-5 rounded border border-line-2 px-1.5 py-0.5 text-ink-3">
                          {t('pluginThirdParty')}
                        </span>
                        <span className="caption-5 font-mono text-ink-3 tabular-nums">v{manifest.version}</span>
                      </div>
                      <p className="caption-5 mt-1 text-ink-3">{manifest.author}</p>
                      <p className="caption-2 mt-2 text-pretty text-ink-2">{localizedDescription(manifest, lang)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveImported(manifest.id)}
                      aria-label={`${t('pluginRemove')} ${localizedName(manifest, lang)}`}
                      className="rounded-lg p-1.5 text-ink-3 transition-colors duration-300 ease-out-soft hover:bg-raised hover:text-danger"
                    >
                      <Glyph as={X} size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="mt-12 border-t border-line pt-5">
          <p className="caption-5 max-w-[760px] text-pretty text-ink-3">{t('pluginBoundary')}</p>
          <a
            href="https://github.com/hawoke66/chuanzhibei-multi-agent/blob/main/plugins/README.md"
            target="_blank"
            rel="noreferrer"
            className="caption-4 mt-3 inline-flex items-center gap-1.5 text-ink-2 underline-offset-4 transition-colors duration-300 ease-out-soft hover:text-ink hover:underline"
          >
            {t('pluginDocs')}
            <Glyph as={ArrowUpRight} size={16} />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
