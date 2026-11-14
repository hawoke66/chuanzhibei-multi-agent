# 多智能体协作台

传智杯 AI WEB 网页开发挑战赛参赛作品 · **最终版（2026-11-09，HEAD `57d6bde`）**

一个把「一句话任务」跑成「一份可交付成果」的 Web 应用。用户说清要什么，后面交给一支固定的 AI 团队：
调度官先拆任务，调研员、文案官、代码手按需并行，汇总官合成一稿，质检官按四项标准打分，
不通过就退回修订，最多两轮。

不是聊天框，也不是单次 API 调用。核心是一条**带质量门的协作流水线**：任务在多个角色之间流转，
每个角色只做自己那一件事，质检分数与意见真实决定这一稿是交付还是打回。

面向三五个人的学生小组、接私活的个人工作室、要做活动材料的老师和社团。

- 仓库：https://github.com/hawoke66/chuanzhibei-multi-agent
- 在线演示：https://chuanzhibei-multi-agent.netlify.app
- 技术文档：`docs/技术文档.pdf`（10 页，Markdown 源文件 `docs/技术文档.md`）
- 演示视频：≤ 5 分钟（按官网提交要求）

## AI 辅助编程说明

本项目开发过程中使用了 AI 辅助编程：代码框架与核心逻辑由 DeepSeek、Kimi 等 AI 辅助生成，人工负责架构设计、需求定义、代码审查与验收；AI 生成内容均经过人工验证与修改。项目运行时的 AI 能力（多智能体调度、专家协作、质检评分）由 DeepSeek API（`deepseek-chat`）提供，API Key 仅从环境变量读取，不进入代码仓库。

## 功能

**基础链路**

- 任务输入：输入一段文字任务，提交后全链自动执行；支持示例任务与任务模板
- 调度拆分：调度官只拆分、不写正文，输出 JSON 计划（交给谁、目标、交付物）
- 专家并行：调研员、文案官、代码手按需激活；调研先行，文案与代码可读调研结果
- 检索式 RAG：参考资料按子任务目标检索 top-5，调研员引用时标注【参考n】；无参考或检索无结果时退回全文
- 汇总质检：汇总官去重、不扩写；质检官四项分（30/30/20/20），80 分通过
- 修订回环：只改质检意见指出的问题，最多两轮
- 流式进度：`/api/run` 以 NDJSON 返回事件，页面边跑边更新七个角色的状态
- 成果处理：Markdown 渲染、复制全文、导出 `.md`；任务历史（本地最近 10 条）可回看、删除、召回
- 中英双语：界面文案与 AI 输出内容都跟随页面语言

**本轮新增（8 项）**

1. 联网搜索：博查 Web Search，结果带来源链接进入 RAG；失败自动退回模型知识
2. 上传参考资料：PDF（pdfjs-dist）与 Word（mammoth）在浏览器本地解析，10MB 上限
3. 图片 OCR：浏览器端 Tesseract.js 识别文字并入参考资料；DeepSeek-OCR 服务端为备选
4. MCP 真实调用：自写 stdio 客户端 + `mcp/server.mjs`，两个工具（`web_search`、`get_current_time`）
5. 单专家失败单独重试：只重跑失败的那个专家，成功后继续汇总质检，上限两次
6. 修订前后对比：词级 diff，新增/删除分色并给统计
7. 语音输入：Web Speech API，浏览器不支持时按钮不出现
8. 历史搜索与分数筛选：按任务文字搜、按 80+ 通过 / 未通过筛

**本轮新增（书页版）**

- 六章全屏区块 + Magic UI 组件（Blur Fade / Magic Card / Number Ticker / Animated Gradient Text / 光束流动），翻页系统与 GSAP、Lenis 已移除
- 实时协作图：七个角色节点，连线随进度亮起并流动，未激活节点灰色虚线标注「未激活（按需）」
- 两次运行对比：同一任务跑两次后左右并排，给出总分与四项分差值
- 分享复现链接：只把任务文本编码进 URL，打开后回填输入框、不自动提交
- 多模态输入：上传区明确标注「多模态输入」，图片 OCR 后提示「已提取 N 字」

**界面与插件**

- 星空主题、协作链路可视化、滚动翻页与数字滚动；`prefers-reduced-motion` 下降级为淡入
- 插件中心：两个内置插件（任务模板、成果导出）真实启停，状态存本机；
  第三方 manifest 只做导入展示，不执行代码，边界见 `plugins/README.md`

## 界面结构（书页式分章）

整站按任务流程分六章，正常滚动，每章占一屏；章节标题用渐变文字，卡片用鼠标跟随辉光的
Magic Card，数字用滚动的 Number Ticker，协作图用流动光束，进入视口时用 Blur Fade 依次浮现。

1. **序章**：封面、任务输入、多模态参考资料、适用场景三卡
2. **第一章 · 调度拆分**：调度计划、子任务、阶段状态、工具轨迹
3. **第二章 · 专家协作**：流动光束协作图（七个节点）+ 七张状态卡
4. **第三章 · 质检与修订**：四项分、每轮质检意见、修订轮数、修订前后对比
5. **终章 · 最终成果**：Markdown 全文、复制 / 导出 / 分享 / 两次运行对比
6. **尾声 · 指标与历史**：Token 消耗、来源、历史任务、插件中心

任务跑起来会平滑滚动到对应章节；导航可直接跳到任一章。手机上协作图换成一条可读的流程链。

## 多模态说明

上传区叫「多模态输入」，支持图片（OCR 提取文字）、PDF、Word 与纯文本，全部在浏览器本地解析，文件不上传服务器。

- 图片：Tesseract.js 本地 OCR（中英双语包），识别出的文字带上「已提取 N 字」的提示，并入参考资料；
  服务端 DeepSeek-OCR 是备选，没配 Key 时不启用。
- 图片转成文字之后，走的是和 PDF / Word / 粘贴文本完全相同的检索与写作链路（top-5 检索、【参考n】标注）。
- 局限：**只提文字，不做图像理解**——不描述画面、不识别图表结构、不做版面还原；扫描件倾斜、手写体、
  复杂表格的准确率有限。

## 技术架构

- 前端：Next.js 16.4.3（App Router）+ React 19.3 + TypeScript + Tailwind CSS 4
- AI：DeepSeek API（`deepseek-chat`）直连，不经过第三方中转
- 通信：浏览器 `fetch` 读取 `/api/run` 的 NDJSON 流，逐行解析进度事件
- 工具：MCP（stdio + JSON-RPC 2.0）、博查搜索、DeepSeek-OCR（备选）
- 存储：无数据库、无账号登录；任务只在当次请求内处理，历史与插件状态只存浏览器本地

工作流：

```
用户任务
  → 调度官（拆分，JSON 计划）
  → 工具前置：get_current_time（MCP）→ web_search（MCP，失败退本地直调）
  → 调研员（先行，function calling 自主检索）
  → 文案官 / 代码手（并行，可用调研结果）
  → 汇总官（合成一稿，不扩写）
  → 质检官（四项分，80 分通过）
  → 不通过 → 修订官 → 再质检（最多 2 轮）
  → 最终聚合（修订稿 + 落款）
```

目录结构：

```
app/
  page.tsx                页面编排与前端状态（任务、事件、历史、插件、语言）
  copy.ts                 全站中英文案与状态标签
  components/             各区块与基础件（首屏、任务输入、专家区、任务流、结果区、历史、场景、插件中心）
  dynamic-background.tsx 动态星空（分层星、银河带、星座连线、小行星、流星）
  api/run/route.ts        全链编排 + 流式事件 + 搜索/MCP 前置 + 单专家重试
  api/search/route.ts     博查搜索（本地直调降级用）
  api/ocr/route.ts        DeepSeek-OCR 服务端备选
lib/
  deepseek.ts             模型调用封装（超时、退避重试、JSON 模式、token 统计）
  dispatcher.ts           调度官
  experts.ts              调研员 / 文案官 / 代码手 + 检索工具调用
  quality.ts              汇总官 / 质检官 / 修订官 / 质量回环
  retrieve.ts             参考资料切分与关键词检索
  search.ts               博查搜索与结果格式化
  ocr.ts                  DeepSeek-OCR（Base URL / 模型 / 最大 token / 五种模式可配）
  ocr-client.ts           浏览器端 Tesseract 优先，服务端备选
  mcp-client.ts           MCP 客户端（握手、工具发现、调用、错误处理、进程关停）
  diff.ts                 修订前后词级 diff
  plugins.ts              插件注册表与 manifest 校验
  language.ts             输出语言规则与服务端文案
plugins/
  task-templates/manifest.json   内置插件：任务模板
  markdown-export/manifest.json  内置插件：成果导出
  README.md                      manifest 格式与接入说明
mcp/
  server.mjs              MCP 服务器（两个工具 + 两个资源 + 一个提示模板）
docs/
  技术文档.pdf / 技术文档.md     提交用技术文档
  审核汇报.md、skill-audit-ocr-mcp.md、redesign-v3.md 等   过程记录
```

## AI 辅助编程标注

本项目开发中使用 AI 辅助编程（DeepSeek 等）：**需求分析、架构设计、验收标准由团队成员主导并逐项确认**；
AI 参与代码编写、样式调整与文档起草，全部改动经本地 `npm run build`、`npm run lint` 与真实任务实测后才提交。

具体边界：

- 由团队人工决定：产品定位与页面结构、七个 Agent 的职责与约束、质检 rubric（30/30/20/20、80 分通过）、
  修订上限、MCP 工具范围、多模态做与不做的取舍、每轮验收清单。
- 由 AI 辅助生成或改写：页面组件与样式、提示词初稿、技术文档与 README 草稿、部分脚本。
- 由团队逐项验收：构建与 lint、真实任务全流程、联网搜索、上传解析、OCR、MCP 调用、单专家重试、
  修订对比、语言切换、移动端与无障碍降级。

## 代码复用说明

**自研**（本仓库内实现，未从其他项目拷贝）：

- 全链编排与流式事件协议（`app/api/run/route.ts`）、七个角色的提示词与质量回环（`lib/dispatcher.ts`、`lib/experts.ts`、`lib/quality.ts`）
- 参考资料切分与检索（`lib/retrieve.ts`）、MCP 客户端与服务器（`lib/mcp-client.ts`、`mcp/server.mjs`）
- 页面与全部组件、动态星空、滚动翻页与数字滚动、修订 diff 展示、插件中心

**开源依赖与出处**：

| 依赖 | 用途 | 许可 |
| --- | --- | --- |
| Next.js / React | 应用框架 | MIT |
| Tailwind CSS | 样式 | MIT |
| react-markdown | 成果 Markdown 渲染 | MIT |
| pdfjs-dist | PDF 文本提取（浏览器端） | Apache-2.0 |
| mammoth | Word（.docx）文本提取 | BSD-2-Clause |
| tesseract.js | 浏览器端图片 OCR | Apache-2.0 |
| diff | 修订前后词级 diff | BSD-3-Clause |
| @phosphor-icons/react | 图标 | MIT |

设计与文案规范参考了三个公开 skill 文档（unslop · CC BY 4.0，作者 Damir Sokolovsky；
landing-page-design、redesign-existing-projects · MIT），仅在 `docs/redesign-v3.md` 中作为方法记录，
未拷贝其代码。MCP 与 DeepSeek-OCR 按公开协议与接口文档实现，未引入对应 SDK。

## 本地运行

环境要求：Node.js 18 以上（开发机实测 v24.21.0）、npm、Git。

```bash
npm install
cp .env.example .env.local
# 在 .env.local 里填入 DEEPSEEK_API_KEY（其余两个变量可选）
npm run dev
```

打开 http://localhost:3000 ，输入任务并提交。

生产构建：

```bash
npm run build
npm start
```

部署提示：MCP 客户端通过子进程拉起 `mcp/server.mjs`，需要能执行 Node 子进程的常驻环境（本机、VPS、容器均可）；
应用不依赖数据库与对象存储。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API Key，只放在本地 `.env.local` |
| `BOCHA_API_KEY` | 否 | 博查搜索 Key；不配则联网搜索自动降级为模型知识 |
| `SILICONFLOW_API_KEY` | 否 | DeepSeek-OCR 服务端备选；不配则只用浏览器端 Tesseract |

`.env.local` 已被 `.gitignore` 忽略，任何 Key 都不进仓库、不写进前端代码；`.env.example` 只是空模板。
DeepSeek-OCR 还支持 `DEEPSEEK_OCR_API_KEY` / `DEEPSEEK_OCR_BASE_URL` / `DEEPSEEK_OCR_MODEL` / `DEEPSEEK_OCR_MAX_TOKENS`，
以及密钥文件 `~/.config/deepseek-ocr/key`（详见 `docs/skill-audit-ocr-mcp.md`）。

## 实测数据

以下数字均来自本机真实运行：

| 场景 | 结果 |
| --- | --- |
| 全流程（第一次） | 质检 94 分，耗时 15.1 秒 |
| 全流程（第二次） | 质检 88 分，耗时 13.4 秒 |
| 真实联网搜索 | 4 条来源，质检 92/100，耗时 45.9 秒，字数 8,515，Token 16,250 + 10,554 |
| MCP 全链路 | `web_search` 真出 3 条来源，质检 82 分，修订后通过 |
| 修订对比 | 35 分 → 91 分通过，183 处新增、222 处删除 |
| 英文模式 | 正文 CJK 字符 0、拉丁字符 961 |
| 链路标签验收 | 60 点 × 12 条线采样，1440 与 390 下文字与线命中 0 |
| 工程检查 | `npm run build` 通过、`npm run lint` 0 告警、控制台 0 异常 |

## 团队信息

- 团队：蜂群小队（胡琮琳、李天泽、黄学博），北华航天工业学院
- 指导老师：陈亭宇
- 赛道：AI WEB 网页开发挑战赛，B 组（普通本科）

## 提交材料

- 演示视频：≤ 5 分钟、≤ 500MB
- 技术文档 PDF：`docs/技术文档.pdf`（10 页）
- 源码：本仓库（`main` 分支）

## 开发进度（截至 2026-11-09，最终版）

- [x] 任务输入 + DeepSeek 直连
- [x] 调度官拆分
- [x] 专家并行执行
- [x] 汇总 + 质检 + 修订回环
- [x] Agent 状态卡 + 流式进度
- [x] 页面结构大换血与动效专项
- [x] 联网搜索、上传 PDF/Word、图片 OCR、MCP 真实调用
- [x] 单专家重试、修订 diff、语音输入、历史搜索与筛选
- [x] 中英双语（含输出内容）
- [x] 插件中心与 manifest 文档
- [x] 技术文档 PDF + README

## 注意事项

- 联网搜索默认开启；没配 `BOCHA_API_KEY` 时自动退回模型知识，不中断任务。
- 长任务全链可能需要一两分钟，页面状态卡会实时显示当前进行到哪一步。
- 本项目为原创 Web 应用，AI 为核心流程；MCP 与搜索是可选增强，缺失时均有降级路径。
