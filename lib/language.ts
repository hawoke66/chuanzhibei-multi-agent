/* 页面语言 → 模型输出语言。
   输出语言只跟页面语言走，与用户输入用什么语言提问无关。 */

export type OutputLang = 'zh' | 'en';

export function normalizeLang(value: unknown): OutputLang {
  return value === 'en' ? 'en' : 'zh';
}

export function outputLanguageRule(lang: OutputLang): string {
  return lang === 'en'
    ? 'Output language: English. Write every heading, sentence and code comment in English. Never answer in Chinese, even if the task is written in Chinese.'
    : '输出语言：中文。所有标题、正文与代码注释都用中文，不要切换成英文，即使用户用英文提问。';
}

/** 服务端推给前端的状态文案，跟随页面语言。 */
export function serverText(lang: OutputLang, zh: string, en: string): string {
  return lang === 'en' ? en : zh;
}
