# Neko-Code 迁移审计：Nekode fork ← neko-pi

基线事实（2026-11-01 勘察）：

- **Neko-Code**（Nekode 3.17.1 fork）：pnpm monorepo。Electron 壳 `packages/desktop`（main + 每窗 host utility process + renderer），共享 UI `packages/ui`，agent 核心 `apps/zcode-cli/packages/core`（Vercel AI SDK 适配层 + `ContextBuilder` 系统提示分段 + SQLite 会话库 `~/.nekode/cli/db/db.sqlite`），另有 CLI/TUI、HTTP/WS server、web 客户端。
- **neko-pi**：pi 内核（`packages/*`）+ vendored web（`apps/web`）。核心资产在 `packages/coding-agent/src/extensions/{memory,runtime-context,...}` 与 `~/.neko_pi` 数据。快照已提交推送（`d695c1f32`，origin/dev）。
- **总原则**：UI 与通用子系统全部用 Nekode 原生；只迁移 neko-pi 的**语义与数据**。pi 的扩展协议不搬——对应缝是 `ContextBuilder.addSection()`（`core/src/context/builder.ts:65`，`injectionTarget: "system" | "meta_user"`）与 core 内直接挂模块。

---

## 一、Nekode 里要砍掉的（前后端）

### 必砍（对外耦合，砍了才干净）

| 项 | 位置 | 说明 |
|---|---|---|
| ARMS RUM 前端遥测 | `packages/desktop/src/main/appARMSBootstrap.ts` | 端点构建期注入 `__NEKODE_ARMS_RUM_ENDPOINT__` |
| CLI OpenTelemetry | `apps/zcode-cli/packages/telemetry/`（otlp-exporter） | 由 `OTEL_*` 环境启用，直接禁用 |
| 会话遥测/用量上报 | `packages/services/src/conversation-telemetry/`；db 中 usage/telemetry 表可留（本地统计有用） | |
| 自动更新 | `packages/desktop/src/main/autoUpdater.ts`、`packages/shared/src/forceUpdate.ts`、`dev-app-update.yml`、远端 server update handoff | 自托管后无更新源 |
| 崩溃上报上传 | `packages/desktop/src/main/desktopCrashCapture.ts`（本地 dump 可留，上传砍） | |
| 云端分享 | `packages/services/src/conversation-share/`、`packages/web-share/`、`ConversationShareMenu`、`NEKODE_CONVERSATION_SHARE_WEB_URL` | |
| Web 远控中继 | `wss://zcode.z.ai/.../remote/ws2`（`packages/shared/src/zcodeEndpoint.ts`）+ `packages/web/src/web-remote-control/` | |
| 营销/激励 | `packages/services/src/marketing-touch/`、`packages/shared/src/rewardsEmbedded.ts` | |

端点集中收口在 `packages/shared/src/zcodeEndpoint.ts` 与 `.env.example`——砍的时候一处处理。

**遥测是什么（独立于账号与插件）**：三类，全是单向出站统计，不参与任何功能逻辑。
1. **ARMS RUM**（`appARMSBootstrap.ts`，`@arms/rum-electron`）：Electron 端性能与前端错误上报（页面加载、JS 异常等），端点在构建期注入，空值＝不上报但初始化仍会被 await。
2. **事件上报**（`packages/services/src/telemetry` + `conversation-telemetry`）：应用/会话级事件 POST 到 `zcode.z.ai/api/v1/event/report`，设备标识在 `~/.nekode/v2/telemetry-state.json`；空端点有硬 guard（`if (!REPORT_ENDPOINT) return`）。
3. **CLI OpenTelemetry**（`apps/zcode-cli/packages/telemetry`）：OTLP traces/metrics，仅在设置 `OTEL_EXPORTER_OTLP_*` 时启用。
砍法（主人裁定：**遥测全砍**）：ARMS RUM、事件上报、CLI OTel 三类全部删除/停用，入口与调用点一起摘——ARMS 初始化失败会被 rethrow，不能只置空端点；事件上报有 `if (!REPORT_ENDPOINT) return` 硬 guard，可安全断；OTel 默认关，删依赖即可。功能零损失，本地用量统计（`model_usage`/`tool_usage`/`turn_usage` 表与 AppUsagePanel）不受影响。

### 已裁定的取舍

- **插件系统：全保留，一个字不删**。运行时、官方内置插件、本地/网络市场、插件同步、UI sandbox、`restore-legacy-sessions` 全部保留；「砍」只发生在对外遥测/更新/账号这些横切面，不碰插件。若只想离线，把市场源指向本地目录即可（配置项，不改代码）。
- **账号系统：砍**。范围＝登录/欢迎页 OAuth 入口、`login-command`、OAuth 服务调用点、share 发布 token、官方 MCP 的 OAuth 认证、web 远控鉴权、feedback 归因。**coding plan 能力保留**：直接用 provider API key（zai/deepseek/opencode-go 均已在内置目录）。
  - 砍法注意：`packages/services/src/oauth/` 被 `usage-stats/bigmodelUsageQuotaProvider`、`model-provider/codingPlanProviderAvailability` 等 **provider 代码引用**——不能整包删除，改为「接口保留、实现退化为无账号」，即额度查询返回不可用而不是报错。
  - `desktopOAuthDeepLink.ts` 同时承载 workspace 深链：只摘 OAuth 分支，保留深链。
- **账号额度面板：砍；本地 token 统计面板：全部保留**。
  - 砍：`CodingPlanUsageRemainingPanel`、`settings/CodingPlan{EntryButton,UpgradeDialogProvider,UpgradeDialog,EmbeddedWebviewDialog,BillingDiscount}`、`components/coding-plan-quota-reset/*`、`WorkspaceSidebarFooterUsageSummary`（套餐百分比）、`chat-input-toolbar/CodingPlan*`（ContextUsage/McpUsageMeter/UsageHeaderAction/UsageNotice + quota reset reminder）、`settings/usage-stats/CodingPlanUsage{Panel,BarChart,LineChart}` + `codingPlanUsageChartSeries`、`hooks/useCodingPlanQuotaResetUi|usePlanIdentitySnapshot|useStartPlanEntitlement|useUsageEntitlement` + 对应 lib 协调器。
  - 留：`settings/usage-stats/AppUsagePanel` 及其图表/热力图（读本地 `model_usage`/`tool_usage`/`turn_usage` 表）、`hooks/useUsageStats`、`ModelTrajectoryPane(+Details)`（按任务 tokens/模型）、`DeveloperToolsPane`（cache read/write、TPS）、`chat-input-toolbar/contextUsage.tsx`（上下文窗口占用表）、会话级统计。
  - 判据：组件读 **OAuth/coding-plan 订阅** → 砍；读**本地 SQLite 用量表** → 留。`UsageStatsSection` 里两者并存，只摘 `CodingPlanUsagePanel` 那一半。
- **模型与提供方配置：一根毛都不动**。`config/provider/*.json`（37 个内置模板）、`packages/provider*`、`ModelProviderSection` 设置页、API key 存储（`config.json` provider 条目）、自定义 provider、模型列表/选择、baseURL/代理全部保留。账号与 provider 是两条线：账号只用于 OAuth 令牌与订阅额度，provider 配置走 key 直连。
- **远程 SSH/WSL workspace：保留**（`source-server`），端点点位随砍单一起收口。

### 改名/品牌

`electron-builder.config.js` 的 `desktopProductIdentity`、图标 `public/logo/`、`about.ts`、`cli-prefix.ts`（"You are Nekode..."——由下方 persona section 接管）、README。

---

## 二、从现 web 移植过来的（Nekode UI 缺口）

前提：**不搬 web 的任何布局/样式代码**，只补 Nekode 没有的信息与行为。全部落在 `packages/ui`，单件工作量小。

| # | 移植项 | web 出处（语义） | Nekode 落点 | 量 |
|---|---|---|---|---|
| 1 | 每条消息用量条（tokens/费用/时长，hover 行） | MessageView stats（`formatUsage`+turnDuration） | `ConversationRowView`/TurnGroup 尾部 | S |
| 2 | 流式速率 tps（空闲 `--`） | R61：估算器+300ms 采样入状态条 | `ConversationStatusPanel` 或 composer 工具条加槽位 | S |
| 3 | **注入上下文可见性**：chips + 详情（message_time/runtime_activity/runtime_memory…） | R27 注入面板 | Nekode 故意隐藏 meta XML（`zcodeSessionProjection.ts:575`）；仿 `ConversationUserInputEpilogue` 做可折叠 epilogue + 侧栏详情 | M |
| 4 | 缓存未命中警告（挂在 query 后，不进对话流） | cache-miss notices | user bubble 附属 | S |
| 5 | 首条 query 自动命名规则 + 开关 | R49 | `title_source` 已有 `first_input/generated`（`schema.baseline.sql:162-184`），补触发规则 | S |
| 6 | 休眠层技能的设置/面板展示（「休眠」标签、无开关） | R59 | `SkillsSection.tsx` + `$` 面板（见三.4） | S |
| 7 | 记忆投递 diff 视图 | r100 memory-diff | 与三.2 一并做 | M |

不移植：web 的全部布局/动效/设置外壳/文件树/会话树/编辑重发交互（Nekode 原生已有，且更强）。

### 2.5 信息透明与全轨迹（一等需求，参考 deepseek-harness web）

目标：像 pi/harness 一样，**模型看到什么就能看到什么**，且历史会话可回看。

参考实现（harness 实测快照 `snapshots/web/steering/trajectory.expected.md`）：
- 会话视图双 tab：**Chat | Trajectory**（右侧另有 "More conversation views"）
- 工具条：`Duration`（Use actual duration）、`Turns`/`Calls`/`Subcalls` 折叠、`Search trajectory`
- 时间线是表格，行级 producer 标签：`SYSTEM`（Initial System Prompt）、`USER`（Turn N）、**`CONTEXT`**（每次注入的运行时上下文，逐条：cwd 策略、time sampled…）、`ASSISTANT`（Request #N，按 step 分组）、`TOOL`（调用参数 `→` 结果内联）
- 输入框底栏：`N turns M steps · X tok/s`、`X tok · Cache hit %`、`context %`

落到 Nekode：
1. **数据面**：现有 message/part 已覆盖 USER/ASSISTANT/TOOL；缺 (a) 系统提示快照、(b) `meta_user` 注入段快照（含 section 名与正文）、(c) 每 step 的 usage/duration。需要新增持久化（新 part 类型或独立 trajectory 表），否则历史会话没有轨迹。
2. **UI**：在会话区加 Trajectory 视图（可复用 `DeveloperToolsPane` 的 usage 数据与 `ModelTrajectoryPane` 的 records 骨架），行标签直接对标 SYSTEM/USER/CONTEXT/ASSISTANT/TOOL。
3. **与 neko 注入联动**：`ContextSection` 的 `injectionTarget:"system"|"meta_user"` 天然对应 SYSTEM/CONTEXT 行；neko 的 `message_time`/`runtime_activity`/`runtime_memory` 逐条可展开——即原 web 的注入面板并入轨迹视图，不再单独做。
4. **底栏统计**：tps/缓存命中/上下文占用（web R61 + cache-miss 提示一并落这里）。

---

## 三、neko-pi 核心必迁（前后端实现）

### 3.1 Persona 人格包 — 量：后端 S / 前端 XS

数据 `~/.neko_pi/persona/{persona.md, manifest.json, theme, voice, wardrobe.json}`。
后端：新 `ContextSection`（`injectionTarget:"system"`，替换/压过 `cli-prefix`+`identity` 的身份段）。persona-lint 一并搬。
前端：设置 › Personalization 挂编辑入口。

### 3.2 记忆运行时（六本书/决策树 v2.1/收据/差分投递/预算/promote）— 量：L（最大件）

数据：`~/.neko_pi/memory/{persona,projects,toolbox}/…` 书文件 + `runtime/state.sqlite`（memory_records/memory_changes/scope_versions/delivery snapshots/continuity）。
后端：把 `packages/coding-agent/src/core/memory/*` + `extensions/memory` 的运行时移植进 `apps/zcode-cli/packages/core/src/memory/` 旁，工具**直接注册进 core**（已确认 core 可以改，不走 MCP 绕行）。投递经 `meta_user` section。
前端：`MemorySettingsSection` 扩展成书目录 + 聊天内 `<runtime_memory>` 折叠渲染 + diff 视图（二.7）。
Nekode 自带的 per-workspace 文件记忆（`~/.nekode/cli/memories/projects/<slug>-<hash>/memory`）保留为通用层，neko 记忆是其上的人格层。

### 3.3 runtime-context：跨会话活动摘要 + 时间注入 + 换装 + 编辑复用 — 量：M

语义清单（照搬规格，代码重写到 Nekode core）：
- `activities` 流水（user_query/memory_updated/continuity_updated/outfit_changed；payload 180/240B 有界；21 天保留）
- projectId = cwd realpath 的 sha256；查询固定 `scope='persona' OR project_id=当前`
- 游标 receipts（每 prompt 推进到 MAX(seq)，自己这条不进自己摘要）
- 8KB 预算、每会话保留 2 条最新 query 预览、`omitted`/`historyExpired`
- `summarizeActivityEvents`（most-recent-first、≤5 memory 标签、计数不重复正文）
- 投递条件：有 sessions/换装块/omitted/historyExpired 才发 `<runtime_activity>`；`<message_time>` 每条必发
- wardrobe：6h idle 重选、内容指纹去重、A→B→A 重发、仅 wear 动作生效
- **编辑重发复用**（R61）：resend 重贴原注入块、只刷新时间、游标从新位置

数据：`runtime/state.sqlite` 的 activities/receipts 表随 3.2 一起迁（同一库）。
后端落点：`meta_user` ContextSection + core 内 ActivityStore。
前端：注入面板（二.3）即其 UI。

### 3.4 技能分层（常驻 + 休眠 vault）— 量：后端 S / 前端 S

现状：常驻 `~/.agents/skills`（11）+ `~/.neko_pi/skills`（6：dress-sense/intimacy/legacy-memory-migration/memory-hygiene/neko-pi-dev/session-workflow）+ 休眠 `~/.agents/skill-vault/**`（74，skill-nav 索引）。
Nekode 事实：skills roots 已兼容 `~/.agents/skills` 与 extra roots（`adapters/src/skills/roots.ts`）；`SkillConfig.enabled` 可逐技能开关；无休眠概念；UI 触发字符是 `$`（`#` 已被 sessions 占用）——**沿用 `$`，不搬 `#`**。
方案：vault 注册为 extra root + 默认全 disabled（= 休眠层），prompt 只列 enabled；`$` 面板与 SkillsSection 显示休眠分组（二.6）。skill-nav/skill-keeper 文件原样有效。
迁移动作：`~/.neko_pi/skills/*` → `~/.nekode/skills/`（或留原处加 root）；vault 原地。

### 3.5 数据与 dotfiles 迁移表

| neko-pi | 去处 | 备注 |
|---|---|---|
| `~/.neko_pi/persona/` | `~/.nekode/neko/persona/`（建议独立子目录，避免与 Nekode 自身数据混淆） | 3.1 |
| `~/.neko_pi/memory/` | `~/.nekode/neko/memory/` 原样 | 3.2 |
| `~/.neko_pi/runtime/state.sqlite` | `~/.nekode/neko/runtime/` | 先 `wal_checkpoint(TRUNCATE)` 再拷（WAL 4MB 未合并）；代码移植后 schema 兼容 |
| `~/.agents/skills`、`~/.agents/skill-vault` | 原地 | Nekode 已读前者；后者加 extra root |
| `~/.neko_pi/skills/` | 并入 `~/.nekode/skills/` | 6 个 |
| `~/.neko_pi/mcp.json` | 转成 Nekode MCP 配置（设置 › MCP） | 格式转换脚本 |
| `~/.neko_pi/auth.json` / `models.json` / `settings.json` | `~/.nekode/cli/config.json` provider keys / `~/.nekode/v2/credentials.json` | provider 名对齐 `config/provider/zcode-builtin.json`（deepseek/opencode-go 均在内置目录） |
| `~/.neko_pi/sessions/*.jsonl`（26 个 / 156MB） | 见 3.6 | |
| `~/.neko_mem/` | 不动 | 助手侧日记，非 app 数据 |

### 3.6 会话记录转置 — 量：M（有现成先例，风险中等）

Nekode **官方就有 legacy 会话恢复插件**：`apps/zcode-cli/packages/restore-legacy-sessions-plugin/` + `docs/migration/legacy-session-restore-skill.md`（源 `~/.nekode/v2/sessions/<hash>/<taskId>.json` → 写 `db.sqlite` 的 `message`+`part` 双表 + `tasks-index.sqlite`）。我们的转换器照它的骨架换源格式：

pi JSONL → Nekode 映射：
- 头 `{type:"session",version:3,id,cwd}` → `session` 行（`directory`=cwd → workspace/project key；`title` 取 `session_info.name` 或首条 user 文本；`title_source='custom'|'first_input'`）
- `{type:"message",role:"user"|"assistant"}` → `message.data` = MessageInfo（assistant 带 `parentID` 链）
- content blocks：`text`→Part(text)；`thinking`→Part(reasoning)；`toolCall`+对应 `toolResult` message → Part(tool)（`callID`、`state:{status:"completed",input,output,time}`）
- 注入块（`<message_time>` 等）保留在 user text 内——配合二.3 的面板解析展示；不单独建 part
- `{type:"custom", customType:"pi-web:subagent"}` 会话 → 整体跳过（子代理会话本就是运行时态，boot 即清）
- 顺序：按 JSONL 行序写 `sequence`；必须同时写 `message` 和 `part` 两表（官方文档强调），并写 `tasks-index.sqlite`（桌面任务列表才显示）
- 156MB 主要是工具输出，转换时注意 `output` 尺寸截断策略（Nekode 有 per-session `exec/` 大文件旁路的先例，可借）

### 3.7 测试豁免面（原生即所得，不迁不测）

子代理、后台 bash 任务、goal/target（含 budget_limited）、todo、plan mode、workflows、cron/off-peak、分享、文件树、设置外壳、主题、composer、编辑重发交互、fork。
**必测**只有四件：persona 注入、记忆投递（收据/差分/预算）、活动摘要（游标/预算/编辑复用）、会话转换保真。

---

## 建议顺序

P0 去 Nekode 痕迹 + 砍账号/遥测（干净底座，可构建）
P1 persona section + skills 分层（立刻有 Neko 味，风险低）
P2 会话转换器（历史可用，官方插件为模板）
P3 runtime-context（活动摘要/时间/换装/编辑复用）
P4 记忆运行时（最大件，最后做，做完全量验一轮）
P5 web 缺口小件（用量条/tps/注入面板/cache 提示/自动命名/休眠分组）

每阶段结束在 Neko-Code 提交一次；neko-pi 仓库冻结为存档（已推送 origin/dev@d695c1f32）。


---

## 附录 A：插件 / Skill / MCP 的关系与砍插件的代价

### 三者是什么

| 概念 | 本质 | 数据/配置在哪 | 能否独立存在 |
|---|---|---|---|
| **Skill** | 提示词文档（SKILL.md + 附带文件），经 Skill 工具/`$` 唤醒 | `~/.nekode/skills`、`~/.agents/skills`、项目 `.nekode/skills`、bundled | 能。零插件也可用 |
| **MCP** | 外部工具服务器协议（stdio/http/sse） | 配置 `mcp.servers`（用户 `~/.nekode/cli/config.json`、项目 `zcode.json`/`.nekode/config.json`） | 能。零插件也可用 |
| **Plugin** | **分发容器**：manifest 可携带 skills / commands / hooks / mcpServers / agents / ui surfaces / userConfig（outputStyles/settings/lspServers 仅诊断） | `~/.nekode/cli/plugins/`、marketplace 缓存 | 是以上能力的打包层 |

关系：插件能**打包** skill 与 MCP；插件 UI 面板必须绑定一个 MCP server；hooks 也能不靠插件、直接在 config 里配。

### 官方插件里装的是什么（砍之前必须知道）

`OFFICIAL_PLUGIN_DEFINITIONS` 里默认启用：`visualize`、`browser-use`、`documents`、`pdf`、`presentations`、`spreadsheets`、`image-search`、`plugin-creator`、`skill-creator`、`zcode-guide`、`zcode-site`、`node-repl-host`；另有 `restore-legacy-sessions`（默认关，会话转换模板就住这里）、`android-emulator`/`ios-simulator`/`computer-use`（默认关）。
**文档/PDF/PPT/XLSX 查看器 = 插件（skills + agents + MCP + UI surfaces）**，砍插件等于砍掉这一整块能力。

### 砍插件的爆炸半径（实测）

- `grep plugin`：apps/zcode-cli 327 文件（174 非测试源）、packages/ui 259 源、services 50、desktop 42 源+97 测试、server 8。
- 硬 import 依赖约 70 个非测试源文件；`create-app.ts:245-335` 启动即无条件装配插件；skills/commands 的 bootstrap 调用 `resolveNekodePlugins`；core 有 `plugin-reference` 注入；`node_repl` 二进制由官方插件条目派生。

### 结论（主人裁定）

**插件全保留，不删任何插件代码**：
1. 运行时、官方内置插件、市场（CDN 与本地源）、`plugin-sync`、UI sandbox、`restore-legacy-sessions` 全部保留。
2. 遥测/自动更新/账号是**独立横切面**，从各自入口处理，不与插件牵扯。
3. 唯一可选优化：把市场源默认指向本地目录（纯配置），代码不动。
4. `restore-legacy-sessions` 继续作为会话转换的模板与兜底工具。


---

## 最终裁定（2026-11-01，主人拍板）

1. **独立产品，不与官方 Nekode 混用**：Neko-Code 使用自己的数据根（`~/.neko/`），不读写 `~/.nekode/`；本机已装的官方 Nekode 保持原样、互不干扰。fork 内所有 Nekode 痕迹清理：显示名/包名/appId/图标/关于框/README；默认路径常量（`~/.nekode*` → `~/.neko*`，含 config/db/sessions/skills/plugins/commands/memories/logs/exec/artifacts/workflows）；对 z.ai 的默认回落（遥测/更新/分享/账号/市场 CDN）随砍单一起消失；市场默认源改为本地 bundled/目录源（插件机制不删）；Apache-2.0 LICENSE 与 NOTICE 按法律要求保留。内部代码标识符（如 `NEKODE_*` 环境变量名、包内符号）本轮不做全面重命名，避免无谓的数百处 diff；用户可见配置只暴露 `NEKO_*`，旧 `NEKODE_*` 保留兼容读取。
2. **neko-pi 数据整体迁入 Neko-Code**：persona、记忆书、runtime、技能、会话一次性迁移；`~/.neko_pi` 作为历史存档保留只读，迁完不双写。
3. **会话完整保真，不截断**：26 个 JSONL（156MB）全量写入 SQLite，大工具输出不落旁路、不截断。
4. **P0 顺序：先跑基线测试记录红项，再动刀**；砍完复跑，新增红项归因到具体砍单。
5. 其余既定：插件系统全保留；账号砍、provider/模型配置不动；额度面板砍、本地 token 统计全留；遥测全砍；远程 workspace 保留；信息透明/全轨迹为一级需求（见 2.5）。
