// 浏览器端单文件解析：TXT / Markdown 直接读文本，PDF 用 pdfjs-dist（动态 import，不进主包）。
// 文件只在本地浏览器内解析，不上传服务器、不存储。

export const FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
export const REFERENCE_CHAR_LIMIT = 10000;

export type ImportErrorKind = 'unsupported' | 'too-large' | 'no-text' | 'parse-failed';

export class FileImportError extends Error {
  kind: ImportErrorKind;
  constructor(kind: ImportErrorKind) {
    super(kind);
    this.name = 'FileImportError';
    this.kind = kind;
  }
}

export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isPdf = name.endsWith('.pdf') || type === 'application/pdf';
  const isTxt = name.endsWith('.txt') || type === 'text/plain';
  const isMarkdown =
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    type === 'text/markdown' ||
    type === 'text/x-markdown';
  if (!isPdf && !isTxt && !isMarkdown) {
    throw new FileImportError('unsupported');
  }
  if (file.size > FILE_SIZE_LIMIT_BYTES) {
    throw new FileImportError('too-large');
  }
  if (isTxt || isMarkdown) {
    return file.text();
  }
  return extractPdfText(file);
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const parts: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim();
      if (line) parts.push(line);
    }
    const text = parts.join('\n\n').trim();
    if (!text) {
      throw new FileImportError('no-text');
    }
    return text;
  } catch (e) {
    if (e instanceof FileImportError) throw e;
    throw new FileImportError('parse-failed');
  }
}
