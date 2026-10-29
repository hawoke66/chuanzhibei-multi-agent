// 参考资料检索：切块 + 关键词打分，纯 TypeScript、零依赖。
// 检索不到相关内容时返回空数组，由调用方回退到全文。

export interface RetrievedChunk {
  /** 按原文顺序从 1 开始的编号，调研员引用时用这个号 */
  index: number;
  text: string;
}

const CHUNK_MAX_CHARS = 500;
const TOP_K = 5;

/** 先按空行分段，超长段再按句子切，仍超长则硬切，保证每块不超过 CHUNK_MAX_CHARS */
function splitChunks(reference: string): string[] {
  const chunks: string[] = [];
  const paragraphs = reference
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const paragraph of paragraphs) {
    if (paragraph.length <= CHUNK_MAX_CHARS) {
      chunks.push(paragraph);
      continue;
    }
    const sentences = paragraph.match(/[^。！？!?；;\n]+[。！？!?；;\n]*/g) ?? [paragraph];
    let current = '';
    const flush = () => {
      if (current.trim()) chunks.push(current.trim());
      current = '';
    };
    for (const sentence of sentences) {
      if (sentence.length > CHUNK_MAX_CHARS) {
        flush();
        for (let i = 0; i < sentence.length; i += CHUNK_MAX_CHARS) {
          chunks.push(sentence.slice(i, i + CHUNK_MAX_CHARS).trim());
        }
        continue;
      }
      if (current && (current + sentence).length > CHUNK_MAX_CHARS) flush();
      current += sentence;
    }
    flush();
  }
  return chunks;
}

/** 中文取字符二元组、英文取单词，全部小写 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  for (const match of lower.matchAll(/[a-z0-9_]+/g)) tokens.push(match[0]);
  const cjk = lower.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i + 1 < cjk.length; i++) tokens.push(cjk.slice(i, i + 2));
  return tokens;
}

/**
 * 按子任务目标从参考资料中取相关度最高的 topK 块。
 * 返回的块按原文顺序排列；任何一块都无关（最高分为 0）时返回空数组。
 */
export function retrieveTopK(goal: string, reference: string, topK = TOP_K): RetrievedChunk[] {
  const chunks = splitChunks(reference);
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) {
    return chunks.map((text, i) => ({ index: i + 1, text }));
  }
  const terms = tokenize(goal);
  const scored = chunks.map((text, index) => {
    const lower = text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (lower.includes(term)) score += term.length > 2 ? 2 : 1;
    }
    return { index, score, text };
  });
  const best = Math.max(...scored.map((s) => s.score));
  if (best === 0) return [];
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, topK)
    .sort((a, b) => a.index - b.index)
    .map((s) => ({ index: s.index + 1, text: s.text }));
}
