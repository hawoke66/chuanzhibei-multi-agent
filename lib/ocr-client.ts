/* 图片 OCR（浏览器端优先）：Tesseract.js 本地识别，不传图、不需要 Key。
   失败时回退到服务端 /api/ocr（配置了 SILICONFLOW_API_KEY 才有用），再失败就返回错误。
   整个过程不阻塞任务，调用方把错误显示在资料区即可。 */

export interface ClientOcrResult {
  text: string;
  error?: string;
}

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

export async function ocrImage(file: File, lang: 'zh' | 'en' = 'zh'): Promise<ClientOcrResult> {
  try {
    const tesseract = await import('tesseract.js');
    const recognize = tesseract.recognize ?? tesseract.default?.recognize;
    if (recognize) {
      const result = await withTimeout(
        recognize(file, lang === 'en' ? 'eng' : 'chi_sim+eng'),
        60000,
      );
      const text = String(result?.data?.text ?? '').trim();
      if (text) return { text };
    }
  } catch {
    // 浏览器端识别不可用（无网络拉取语言包 / worker 被拦），继续走服务端
  }

  try {
    const image = await fileToDataUrl(file);
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, lang }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      configured?: boolean;
      text?: string;
      error?: string;
    };
    const text = String(data.text ?? '').trim();
    if (text) return { text };
    return { text: '', error: data.error ?? 'ocr unavailable' };
  } catch (error) {
    return { text: '', error: error instanceof Error ? error.message : 'ocr failed' };
  }
}
