/* 全站共用的格式化与剪贴板工具：数字一种格式，字数一种算法。 */

export function countCharacters(text: string): number {
  return Array.from(text.replace(/\s+/g, '')).length;
}

/** 数字统一格式：千分位、无小数。 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

/** 秒数统一保留一位小数。 */
export function formatSeconds(value: number): string {
  return value.toFixed(1);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 退回选中 textarea 复制
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
