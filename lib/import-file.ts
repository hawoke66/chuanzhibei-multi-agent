// 浏览器端单文件解析：TXT / Markdown / PDF（pdfjs-dist）/ Word（mammoth）。
// 文件只在本地浏览器内解析，不上传服务器、不存储。

export const FILE_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;
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

export function isImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  );
}

export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isPdf = name.endsWith('.pdf') || type === 'application/pdf';
  const isDocx = name.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isTxt = name.endsWith('.txt') || type === 'text/plain';
  const isMarkdown =
    name.endsWith('.md') ||
    name.endsWith('.markdown') ||
    type === 'text/markdown' ||
    type === 'text/x-markdown';
  if (!isPdf && !isDocx && !isTxt && !isMarkdown) {
    throw new FileImportError('unsupported');
  }
  if (file.size > FILE_SIZE_LIMIT_BYTES) {
    throw new FileImportError('too-large');
  }
  if (isTxt || isMarkdown) {
    const text = await file.text();
    if (!text.trim()) throw new FileImportError('no-text');
    return text;
  }
  if (isDocx) return extractDocxText(file);
  return extractPdfText(file);
}

async function extractDocxText(file: File): Promise<string> {
  try {
    const mammoth = (await import('mammoth')) as unknown as {
      extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = String(result.value ?? '').trim();
    if (!text) throw new FileImportError('no-text');
    return text;
  } catch (error) {
    if (error instanceof FileImportError) throw error;
    throw new FileImportError('parse-failed');
  }
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
