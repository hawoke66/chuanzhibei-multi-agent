import { diffWordsWithSpace } from 'diff';

/* 修订前后对比：用 diff 包做词级 diff，输出给结果区渲染。
   三种状态：same（未改）、added（修订稿新增）、removed（修订稿删掉）。 */

export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffPart {
  kind: DiffKind;
  value: string;
}

export interface DiffStats {
  added: number;
  removed: number;
}

export function buildDiff(before: string, after: string): DiffPart[] {
  if (!before && !after) return [];
  const changes = diffWordsWithSpace(before, after);
  return changes.map((change) => ({
    kind: change.added ? 'added' : change.removed ? 'removed' : 'same',
    value: change.value,
  }));
}

export function diffStats(parts: DiffPart[]): DiffStats {
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    if (part.kind === 'added') added += Array.from(part.value.replace(/\s+/g, '')).length;
    if (part.kind === 'removed') removed += Array.from(part.value.replace(/\s+/g, '')).length;
  }
  return { added, removed };
}
