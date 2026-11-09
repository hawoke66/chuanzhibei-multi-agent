# 插件

插件给协作台加能力，但不改产品本身：任务照旧派给四个专家，插件只是在派发前后多一个动作。

当前版本是**最小可用版**，只有两个内置插件。第三方插件只做到 manifest 导入展示。

## 目录

```
plugins/
  README.md                       ← 本文件
  task-templates/manifest.json    ← 内置：任务模板
  markdown-export/manifest.json   ← 内置：成果导出
```

## manifest 格式

一个插件一个 JSON 文件，放在 `plugins/<插件名>/manifest.json`。

| 字段 | 必填 | 类型 | 限制 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | 否 | string | ≤ 64 字符 | 唯一标识，缺省时由 name 生成 |
| `name` | 是 | string | 1 到 80 字符 | 展示名 |
| `version` | 是 | string | 1 到 32 字符 | 语义化版本，例如 `1.2.0` |
| `author` | 是 | string | 1 到 80 字符 | 作者或团队 |
| `description` | 是 | string | 1 到 400 字符 | 一句话说清插件做什么 |
| `capabilities` | 是 | string[] | 1 到 12 项，每项 ≤ 200 字符 | 能力清单，写具体动作，不写形容词 |
| `permissions` | 是 | string[] | 1 到 12 项，每项 ≤ 200 字符 | 需要碰到的数据或工具 |
| `locales` | 否 | object | 键为语言代码 | 本地化文案，可覆盖 name、description、capabilities、permissions |

示例：

```json
{
  "id": "markdown-export",
  "name": "成果导出",
  "version": "1.0.3",
  "author": "蜂群小队",
  "description": "任务完成后把成果导出成 Markdown 文件，也可以只复制全文。",
  "capabilities": ["按任务、质检记录、修订轮数拼装 Markdown", "生成本地文件下载"],
  "permissions": ["读取当前成果与质检记录", "创建本地文件下载"]
}
```

## 校验规则

导入第三方 manifest 时，`lib/plugins.ts` 的 `validateManifest` 会逐项检查：字段齐全、类型正确、长度在上表范围内、`capabilities` 与 `permissions` 都是非空字符串数组。任何一项不通过就整份拒绝，不做「部分导入」。最多同时保存 10 个第三方 manifest。

## 生命周期与状态

- 启用与停用：状态存在 `localStorage` 的 `cz-plugin-state`，按插件 id 记布尔值，刷新页面后保持。
- 内置插件在 `lib/plugins.ts` 的 `BUILTIN_PLUGINS` 注册，manifest 文件即唯一文案来源。
- 第三方 manifest 存在 `localStorage` 的 `cz-plugin-imports`，只用于列表展示。
- 停用后插件能力立刻不可用：任务模板入口消失，导出与复制按钮变为禁用状态并说明原因。

## 接入方式

- 界面：`app/components/plugin-center.tsx` 负责列表、开关与导入。
- 能力：插件只能调用页面已注册的两个动作，`executeTask()`（派发任务）与 `handleExport()`（导出 Markdown）。没有其它入口。
- 新增内置插件：在 `plugins/<name>/manifest.json` 写 manifest，在 `BUILTIN_PLUGINS` 加一条，再在插件中心补上对应的动作按钮。

## 边界（本版明确不做）

- 不执行外部代码，第三方 manifest 里的任何字段都不会被求值或注入 DOM。
- 不提供沙箱执行环境，也不做插件间权限隔离；`permissions` 目前是声明，供审计阅读。
- 不做插件市场、不做远程拉取、不做签名校验。
- 插件不能读取 `.env.local`、API Key 或任何密钥；服务端 Key 只在 `app/api/run` 里从环境变量读取。

以上四项留作后续工作，技术文档引用本文件即可。
