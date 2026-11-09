# OCR / MCP 实现与 skill 对照（第 6 轮审核）

参照：`deepseek-ocr-SKILL.pdf`、`mcp-setup-SKILL.pdf`（2026-11-09 版）
范围：`lib/ocr.ts`、`lib/ocr-client.ts`、`app/api/ocr/route.ts`、`lib/mcp-client.ts`、`mcp/server.mjs`
结论：**OCR 12 条里 7 条原本不符/缺失，已全部补齐；MCP 12 条里 5 条不符/缺失，已补齐 4 条、1 条（Sampling）明确不做。**

---

## 一、DeepSeek-OCR：逐条对照

| # | skill 要求 | 原实现 | 判定 | 现状 |
| --- | --- | --- | --- | --- |
| 1 | DeepSeek-OCR 走 OpenAI 兼容 API（chat/completions + image_url） | 符合 | ✅ 符合 | 不变 |
| 2 | Key 优先 `DEEPSEEK_OCR_API_KEY`，回退 `SILICONFLOW_API_KEY` | 只读 `SILICONFLOW_API_KEY` | ❌ 不符 | 已改：两段式解析 |
| 3 | `DEEPSEEK_OCR_BASE_URL`（默认 `https://api.siliconflow.cn/v1`，可指向本地 vLLM） | 硬编码完整 URL | ❌ 不符 | 已改：`${base}/chat/completions`，末尾斜杠归一 |
| 4 | `DEEPSEEK_OCR_MODEL`（默认 `deepseek-ai/DeepSeek-OCR`） | 硬编码模型名 | ❌ 不符 | 已改：可配置 |
| 5 | `DEEPSEEK_OCR_MAX_TOKENS`（默认 4096，须低于 8192） | 硬编码 2048 | ❌ 不符 | 已改：默认 4096，上限夹到 8191 |
| 6 | 密钥文件回退：`DEEPSEEK_OCR_KEY_FILE` 或 `~/.config/deepseek-ocr/key` | 没有 | ❌ 缺失 | 已补：环境变量 → 密钥文件 |
| 7 | 五种模式 document / table / figure / describe / ocr（默认 document，Markdown 含表格） | 只有一句通用提示词 | ❌ 缺失 | 已补：五套提示词；figure / describe 跟随页面语言；未知模式回落 document |
| 8 | 不声称“看过图”，一律以 OCR 文本为准 | 符合（OCR 文本并入参考资料） | ✅ 符合 | 不变 |
| 9 | 失败时把真实错误显示出来（缺 Key / 网络 / API 错） | 只回 “HTTP xxx”，缺 Key 文案笼统 | ⚠️ 部分 | 已改：HTTP 状态 + 原因 + 响应体前 200 字；缺 Key 时点名三种配置来源 |
| 10 | 检查 Node ≥ 18 / Python 3 环境 | — | N/A | 那是 CLI skill 跑脚本的要求；本项目在 Next 内直接调 API，无脚本 |
| 11 | 脚本零依赖、可 `--output` 存文件 | — | N/A | 同上，由路由返回 JSON 给前端 |
| 12 | 绝不向用户索要 Key（贴聊天里） | 符合（没有 Key 就降级） | ✅ 符合 | 不变 |

**本轮 OCR 改动**：`lib/ocr.ts` 重写（Key 三级解析、base/model/max 可配、五种模式、错误透传）；`app/api/ocr/route.ts`（mode 入参 + 校验 + 415/413 明确报错 + 未配置时给出配置指引）；`lib/ocr-client.ts`（透传 mode，标注 `via: tesseract | deepseek-ocr`）。

---

## 二、MCP：逐条对照

| # | skill 要求 | 原实现 | 判定 | 现状 |
| --- | --- | --- | --- | --- |
| 1 | Client–Server 模型，JSON-RPC 2.0，传输 stdio 或 HTTP/SSE | stdio + JSON-RPC 2.0 | ✅ 符合 | 不变 |
| 2 | 四个原语：Tools / Resources / Prompts / Sampling | 只有 Tools | ❌ 缺失 | 已补 Resources（`swarm://clock`、`swarm://tools`）+ Prompts（`research_brief`）；**Sampling 不做**（见第四节） |
| 3 | `initialize` 按原语声明 capabilities | 只声明 `tools` | ❌ 不符 | 已改：tools + resources + prompts |
| 4 | 工具须有 name / description / inputSchema，描述写给模型看 | 有 schema，描述偏短 | ⚠️ 部分 | 已改：按 “Args / Returns” 补全两条工具描述 |
| 5 | 工具发现：连接时 `tools/list`，动态发现而非写死 | 直接 `tools/call`，不 list | ❌ 不符 | 已改：握手后先 `tools/list`，校验工具存在，返回 `tools` 列表 |
| 6 | `tools/call` 的 `isError` 必须当失败处理 | 当成成功返回（靠下游“无结果”兜底） | ❌ 不符 | 已改：`isError:true` → 抛错 → `ok:false`，带服务器原始错误文本 |
| 7 | 连接失败 / 超时 / 工具错误要优雅处理 | 有超时与退出处理，stderr 未收集 | ⚠️ 部分 | 已改：spawn 失败、非零退出带 stderr 摘要、7s 超时，统一 `ok:false` 交给降级 |
| 8 | 生命周期：启动、连接处理、关停 | `child.kill()` | ⚠️ 部分 | 已改：先 `stdin.end()` → 150ms 后 SIGTERM → 400ms 后 SIGKILL，并清空 pending |
| 9 | 远程 MCP 需要认证 | — | N/A | 本地 stdio，不出网、不监听端口 |
| 10 | 反模式：单一巨型服务器，应按关注点拆分 | 一个服务器两个工具 | ⚠️ 判断项 | 两个工具同属“外部事实查询”，规模小；skill 同时警告“别为简单工具过度工程”，故不拆 |
| 11 | 反模式：跳过工具描述 | 描述偏短 | ⚠️ 部分 | 同第 4 条，已补 |
| 12 | 用 MCP Inspector / 端到端测试工具发现与调用 | 手工 JSON-RPC 脚本 | ⚠️ 部分 | 保留脚本方式（Inspector 是交互工具），覆盖 initialize / tools / resources / prompts / 错误码 |

**本轮 MCP 改动**：`mcp/server.mjs` 升到 0.2.0（capabilities、resources、prompts、工具描述、stdin 关闭退出）；`lib/mcp-client.ts` 重写（工具发现、isError 映射、stderr、分级关停、`listMcpTools()`）。

---

## 三、验证记录（全部实测）

### 3.1 OCR 模块（`lib/ocr.ts`，编译后直测 + 假 OpenAI 端点）

| 用例 | 结果 |
| --- | --- |
| 无环境变量、无密钥文件 | `configured=false`，错误点名 `DEEPSEEK_OCR_API_KEY / SILICONFLOW_API_KEY / 密钥文件` |
| 非法 mode | 回落 `document` |
| `DEEPSEEK_OCR_BASE_URL=https://example.test/v1///` | 归一为 `https://example.test/v1` |
| `DEEPSEEK_OCR_MAX_TOKENS=99999` / `abc` | 夹到 `8191` / 回落 `4096` |
| 环境变量 Key + 自定义 model/max + `mode=table` | 请求打到 `/v1/chat/completions`，`model=mock-model`、`max_tokens=8191`、提示词含 “Markdown tables”，返回 `configured=true` |
| 仅密钥文件（`DEEPSEEK_OCR_KEY_FILE`） | 请求头 `Bearer file-key`，`mode=ocr` 生效 |
| 上游 503 | 返回 `configured=true`，错误 `HTTP 503 Service Unavailable · upstream unavailable` |

### 3.2 OCR 路由（`/api/ocr`，Next 起在 3100，指向本地假端点）

| 用例 | 结果 |
| --- | --- |
| `{mode:'table'}` | `200`，`ROUTE_OK|mode=table|model=mock-ocr-model|max=6000|image=true|auth=route-key` |
| `{mode:'bogus'}` | `200`，回落 `document`（假端点收到 document 提示词） |
| `{image:'data:text/plain;...'}` | `415`，`image must be a PNG / JPEG / WebP data URL` |
| 未配置 Key（另一实例 3101） | `200`，`configured:false`，错误文案给出三种配置来源 |

### 3.3 MCP 服务器（JSON-RPC 直测）

`initialize` → capabilities 含 `tools/resources/prompts`；`tools/list` → `web_search`（`required:["query"]`）、`get_current_time`；`resources/list` → `swarm://clock`、`swarm://tools`；`resources/read swarm://clock` → 有 `iso`；读未知资源 → `-32602 unknown resource`；`prompts/list` → `research_brief`；`prompts/get` → 生成简报提示词；`tools/call get_current_time` → `structuredContent.iso`；`tools/call web_search`（无 Key 时）→ `isError:true` + 文本；`ping` → `{}`；未知方法 → `-32601`。

### 3.4 MCP 客户端（编译后直测）

| 用例 | 结果 |
| --- | --- |
| `listMcpTools()` | `ok=true`，`["web_search","get_current_time"]` |
| `callMcpTool('get_current_time')` | `ok=true, via='mcp'`，`iso` 正确，返回工具清单 |
| `callMcpTool('web_search')`（无 Key） | `ok=false`，错误 `BOCHA_API_KEY is not configured`（isError 已映射） |
| `callMcpTool('does_not_exist')` | `ok=false`，`tool not found: does_not_exist (available: web_search, get_current_time)` |

### 3.5 全链路

- `GET /api/search`：`configured=true`，返回真实结果（中文标题/摘要/URL 正常）。
- `POST /api/run`（真实任务）：事件序列含 `tool` 两条 —— **`get_current_time/mcp/ok=true`**、**`web_search/mcp/ok=true/count=3`**（`.env.local` 现在已有 `BOCHA_API_KEY`，MCP 真实出结果），随后 `sources`、质检 82 分、`revised=true`。
- `npm run build` 通过、`npm run lint` 0 告警。

---

## 四、明确不做的与判断项

1. **Sampling 原语**：由服务器反向请求模型补全。本项目的模型调用集中在 `/api/run`，让工具服务器反向打分/生成会把调用链拆成两段、还要处理并发与取消，收益为零，风险不小。故不实现，capabilities 里也不声明。
2. **Resources 只读、只做两个**：`swarm://clock`（当前时间）、`swarm://tools`（工具目录）。没有把参考资料做进 Resources——参考资料属于单次任务上下文，放进 MCP 会让服务器持有用户数据。
3. **不拆服务器**：两个工具同属“外部事实”。skill 同时列了“别过度工程”，保持一个聚焦服务器。
4. **未用 MCP Inspector**：它是交互式调试器，CI 里不可脚本化；用等价 JSON-RPC 脚本覆盖了同样范围。

---

## 五、环境现状（与前几轮报告不同，注意）

- `.env.local` 现在有 **`DEEPSEEK_API_KEY` + `BOCHA_API_KEY`**（`BOCHA_API_KEY` 是这轮之前新加的），所以：
  - 联网搜索、MCP `web_search` **已能真实出结果**（本轮实测 3 条来源）。
  - 之前 `docs/audit` 里“无搜索 Key、只验证降级”的说法已过期。
- **`SILICONFLOW_API_KEY` 仍然没有**，DeepSeek-OCR 服务端路径依旧走“配置后可用”的状态；本轮用本地假端点验证了请求构造、模式、错误透传，**没有**用真 Key 打过 SiliconFlow。浏览器端 Tesseract 不受影响。
