import type { Lang } from '../app/copy';

/* ============================================================
   任务模板插件的内置内容
   只做「填进输入框 + 派发」，不新增任何后端能力。
   ============================================================ */

export interface TaskTemplate {
  id: string;
  label: Record<Lang, string>;
  task: Record<Lang, string>;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'xiaohongshu',
    label: { zh: '小红书营销方案', en: 'Xiaohongshu plan' },
    task: {
      zh: '为校园咖啡快闪店写一份小红书营销方案：目标人群、三条内容选题、发布节奏和五条标题',
      en: 'Write a Xiaohongshu marketing plan for a campus coffee pop up: audience, three content ideas, posting rhythm and five headlines',
    },
  },
  {
    id: 'social-copy',
    label: { zh: '社媒文案', en: 'Social copy' },
    task: {
      zh: '为一场面向大学生的编程入门公开课写三条社媒文案，分别用于班级群、朋友圈和小红书',
      en: 'Write three social posts for an introductory programming lecture aimed at university students, one each for a class group, a personal feed and Xiaohongshu',
    },
  },
  {
    id: 'code-scaffold',
    label: { zh: '代码脚手架', en: 'Code scaffold' },
    task: {
      zh: '用 Python 写一个命令行待办工具的项目脚手架：目录结构、依赖、入口文件和两个核心函数',
      en: 'Write the project scaffold for a command line to do tool in Python: directory layout, dependencies, entry point and two core functions',
    },
  },
];
