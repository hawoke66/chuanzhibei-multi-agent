/* 图片 OCR（浏览器端优先）：Tesseract.js 本地识别，不传图、不需要 Key。
   失败时回退到服务端 /api/ocr（DeepSeek-OCR，需 Key），再失败就返回错误。
   服务端模式与 deepseek-ocr skill 对齐：document / table / figure / describe / ocr。 */

export interface ClientOcrResult {
  text: string;
  error?: string;
  via?: 'tesseract' | 'deepseek-ocr';
}

export type ClientOcrMode = 'document' | 'table' | 'figure' | 'describe' | 'ocr';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('ocr timeout')), ms)),
  ]);
}

async function tesseractOcr(file: File, lang: 'zh' | 'en'): Promise<string> {
  const tesseract = await import('tesseract.js');
  const recognize = tesseract.recognize ?? tesseract.default?.recognize;
  if (!recognize) return '';
  const result = await withTimeout(recognize(file, lang === 'en' ? 'eng' : 'chi_sim+eng'), 60000);
  return String(result?.data?.text ?? '').trim();
}

async function serverOcr(file: File, lang: 'zh' | 'en', mode: ClientOcrMode): Promise<ClientOcrResult> {
  const image = await fileToDataUrl(file);
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, lang, mode }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    configured?: boolean;
    text?: string;
    error?: string;
  };
  const text = String(data.text ?? '').trim();
  if (text) return { text, via: 'deepseek-ocr' };
  return { text: '', error: data.error ?? 'ocr unavailable' };
}

export async function ocrImage(
  file: File,
  lang: 'zh' | 'en' = 'zh',
  mode: ClientOcrMode = 'document',
): Promise<ClientOcrResult> {
  try {
    const text = await tesseractOcr(file, lang);
    if (text) return { text, via: 'tesseract' };
  } catch {
    // 浏览器端不可用（语言包拉不到 / worker 被拦），继续走服务端
  }

  try {
    return await serverOcr(file, lang, mode);
  } catch (error) {
    return { text: '', error: error instanceof Error ? error.message : 'ocr failed' };
  }
}
