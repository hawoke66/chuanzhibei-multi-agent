import exportManifestJson from '../plugins/markdown-export/manifest.json';
import templateManifestJson from '../plugins/task-templates/manifest.json';
import type { Lang } from '../app/copy';

/* ============================================================
   插件注册表（最小可用版）
   内置插件：manifest 放仓库 plugins/<name>/manifest.json，这里只做注册与状态读写。
   第三方插件：只解析 manifest 并展示，不执行任何外部代码。
   ============================================================ */

export interface PluginLocaleText {
  name?: string;
  description?: string;
  capabilities?: string[];
  permissions?: string[];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  capabilities: string[];
  permissions: string[];
  locales?: Record<string, PluginLocaleText>;
}

export type BuiltinPluginId = 'task-templates' | 'markdown-export';

export const PLUGIN_STATE_KEY = 'cz-plugin-state';
export const PLUGIN_IMPORT_KEY = 'cz-plugin-imports';
export const MAX_IMPORTED_PLUGINS = 10;

const MAX_NAME = 80;
const MAX_DESCRIPTION = 400;
const MAX_ITEM = 200;
const MAX_ITEMS = 12;

export const BUILTIN_PLUGINS: { id: BuiltinPluginId; manifest: PluginManifest }[] = [
  { id: 'task-templates', manifest: templateManifestJson as PluginManifest },
  { id: 'markdown-export', manifest: exportManifestJson as PluginManifest },
];

export type PluginState = Record<BuiltinPluginId, boolean>;

export const DEFAULT_PLUGIN_STATE: PluginState = {
  'task-templates': true,
  'markdown-export': true,
};

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_ITEMS &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= MAX_ITEM)
  );
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

function cleanLocales(value: unknown): Record<string, PluginLocaleText> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const out: Record<string, PluginLocaleText> = {};
  for (const [locale, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const text: PluginLocaleText = {};
    const name = cleanText(entry.name, MAX_NAME);
    const description = cleanText(entry.description, MAX_DESCRIPTION);
    if (name) text.name = name;
    if (description) text.description = description;
    if (isStringList(entry.capabilities)) text.capabilities = entry.capabilities;
    if (isStringList(entry.permissions)) text.permissions = entry.permissions;
    if (Object.keys(text).length > 0) out[locale] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** 校验外部 manifest：字段齐全、类型正确、长度受限，任何一项不过就整份拒绝。 */
export function validateManifest(value: unknown): PluginManifest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const name = cleanText(raw.name, MAX_NAME);
  const version = cleanText(raw.version, 32);
  const author = cleanText(raw.author, MAX_NAME);
  const description = cleanText(raw.description, MAX_DESCRIPTION);
  const capabilities = isStringList(raw.capabilities) ? raw.capabilities : null;
  const permissions = isStringList(raw.permissions) ? raw.permissions : null;
  if (!name || !version || !author || !description || !capabilities || !permissions) return null;
  const id = cleanText(raw.id, 64) ?? slugify(name);
  return {
    id,
    name,
    version,
    author,
    description,
    capabilities,
    permissions,
    locales: cleanLocales(raw.locales),
  };
}

export function slugify(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii.length > 0 ? ascii : `plugin-${Date.now().toString(36)}`;
}

export function loadPluginState(): PluginState {
  const state: PluginState = { ...DEFAULT_PLUGIN_STATE };
  try {
    const raw = window.localStorage.getItem(PLUGIN_STATE_KEY);
    if (!raw) return state;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return state;
    for (const { id } of BUILTIN_PLUGINS) {
      const value = (parsed as Record<string, unknown>)[id];
      if (typeof value === 'boolean') state[id] = value;
    }
  } catch {
    // 存储不可用时用默认值，页面照常工作
  }
  return state;
}

export function savePluginState(state: PluginState): void {
  try {
    window.localStorage.setItem(PLUGIN_STATE_KEY, JSON.stringify(state));
  } catch {
    // 忽略配额或隐私模式错误
  }
}

export function loadImportedManifests(): PluginManifest[] {
  try {
    const raw = window.localStorage.getItem(PLUGIN_IMPORT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => validateManifest(item))
      .filter((item): item is PluginManifest => item !== null)
      .slice(0, MAX_IMPORTED_PLUGINS);
  } catch {
    return [];
  }
}

export function saveImportedManifests(manifests: PluginManifest[]): void {
  try {
    window.localStorage.setItem(PLUGIN_IMPORT_KEY, JSON.stringify(manifests.slice(0, MAX_IMPORTED_PLUGINS)));
  } catch {
    // 同上
  }
}

export function localizedName(manifest: PluginManifest, lang: Lang): string {
  return manifest.locales?.[lang]?.name ?? manifest.name;
}

export function localizedDescription(manifest: PluginManifest, lang: Lang): string {
  return manifest.locales?.[lang]?.description ?? manifest.description;
}

export function localizedCapabilities(manifest: PluginManifest, lang: Lang): string[] {
  return manifest.locales?.[lang]?.capabilities ?? manifest.capabilities;
}

export function localizedPermissions(manifest: PluginManifest, lang: Lang): string[] {
  return manifest.locales?.[lang]?.permissions ?? manifest.permissions;
}
