/* 服务端图片 OCR：DeepSeek-OCR，走 OpenAI 兼容的 chat/completions。
   对齐 deepseek-ocr skill 的约定：
   - Key 解析顺序：DEEPSEEK_OCR_API_KEY → SILICONFLOW_API_KEY → 密钥文件
     （DEEPSEEK_OCR_KEY_FILE，默认 ~/.config/deepseek-ocr/key）
   - 可配置 DEEPSEEK_OCR_BASE_URL / DEEPSEEK_OCR_MODEL / DEEPSEEK_OCR_MAX_TOKENS
   - 五种模式：document（默认，Markdown）/ table / figure / describe / ocr
   浏览器端优先用 Tesseract.js；这里是浏览器识别失败后的备选，没有 Key 时返回
   configured=false，不报错、不中断任务。 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export type OcrMode = 'document' | 'table' | 'figure' | 'describe' | 'ocr';

export interface OcrOutcome {
  configured: boolean;
  text: string;
  mode: OcrMode;
  error?: string;
}

export const OCR_MODES: OcrMode[] = ['document', 'table', 'figure', 'describe', 'ocr'];
export const DEFAULT_OCR_MODE: OcrMode = 'document';

const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1';
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-OCR';
const DEFAULT_MAX_TOKENS = 4096;
// SiliconFlow 总序列长度上限 8192，这里留出余量
const MAX_TOKENS_CEILING = 8191;
const TIMEOUT_MS = 45000;

const MODE_INSTRUCTIONS: Record<OcrMode, string> = {
  document:
    'Convert this page/screenshot into Markdown. Keep headings, lists, tables and the original reading order. Output Markdown only, no commentary.',
  table:
    'Extract every table in this image as GitHub-flavored Markdown tables. Keep all rows and columns, do not drop cells. Output tables only.',
  figure:
    'Describe this chart or figure in detail: title, axes, units, legend, series, key values and the trend it shows. Output text only.',
  describe:
    'Describe this image in detail: what it is, the layout, any visible text and notable interface elements. Output text only.',
  ocr: 'Transcribe every readable character in this image verbatim. Preserve line breaks. No layout, no commentary.',
};

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/** Key 解析：环境变量优先，其次密钥文件（桌面应用常拿不到 shell 里的变量）。 */
export function resolveApiKey(): string {
  const fromEnv = process.env.DEEPSEEK_OCR_API_KEY || process.env.SILICONFLOW_API_KEY;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const keyFile = process.env.DEEPSEEK_OCR_KEY_FILE || path.join(homedir(), '.config', 'deepseek-ocr', 'key');
  try {
    const fromFile = readFileSync(keyFile, 'utf8').trim();
    if (fromFile) return fromFile;
  } catch {
    // 没有密钥文件就按未配置处理
  }
  return '';
}

export function ocrBaseUrl(): string {
  return normalizeBaseUrl(process.env.DEEPSEEK_OCR_BASE_URL || DEFAULT_BASE_URL);
}

export function ocrModel(): string {
  return process.env.DEEPSEEK_OCR_MODEL?.trim() || DEFAULT_MODEL;
}

export function ocrMaxTokens(): number {
  const parsed = Number(process.env.DEEPSEEK_OCR_MAX_TOKENS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_TOKENS;
  return Math.min(Math.floor(parsed), MAX_TOKENS_CEILING);
}

export function normalizeOcrMode(value: unknown): OcrMode {
  return typeof value === 'string' && OCR_MODES.includes(value as OcrMode)
    ? (value as OcrMode)
    : DEFAULT_OCR_MODE;
}

export function isOcrConfigured(): boolean {
  return resolveApiKey().length > 0;
}

function instructionFor(mode: OcrMode, lang: 'zh' | 'en'): string {
  const base = MODE_INSTRUCTIONS[mode];
  const languageHint =
    mode === 'figure' || mode === 'describe'
      ? lang === 'en'
        ? '\nWrite the description in English.'
        : '\n用中文写这段描述。'
      : '';
  return base + languageHint;
}

export async function recognizeImage(
  imageDataUrl: string,
  lang: 'zh' | 'en' = 'zh',
  mode: OcrMode = DEFAULT_OCR_MODE,
): Promise<OcrOutcome> {
  const key = resolveApiKey();
  if (!key) {
    return { configured: false, text: '', mode, error: 'DEEPSEEK_OCR_API_KEY / SILICONFLOW_API_KEY 均未配置，且没有密钥文件' };
  }

  const endpoint = `${ocrBaseUrl()}/chat/completions`;
  const model = ocrModel();
  const maxTokens = ocrMaxTokens();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageDataUrl } },
              { type: 'text', text: instructionFor(mode, lang) },
            ],
          },
        ],
        max_tokens: maxTokens,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        configured: true,
        text: '',
        mode,
        error: `HTTP ${response.status} ${response.statusText}${body ? ` · ${body.slice(0, 200)}` : ''}`.trim(),
      };
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (data.choices?.[0]?.message?.content ?? '').trim();
    return { configured: true, text, mode };
  } catch (error) {
    return {
      configured: true,
      text: '',
      mode,
      error: error instanceof Error ? error.message : 'ocr failed',
    };
  }
}
