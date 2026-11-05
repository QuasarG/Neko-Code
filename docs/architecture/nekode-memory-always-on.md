# Neko Memory 唯一长期记忆

## 1. 决策

Nekode 的长期记忆只有一套：**Neko Memory**（persona / toolbox / project / scratch），主会话始终开启，不提供关闭开关。

旧版 **Workspace Memory / Project Memory**（`MEMORY.md` + 事实文件、Extraction、Dream、Semantic Recall）与 **custom-agent memory**（`AgentProfile.memory` 三 scope）已从前端和后端删除。

## 2. 行为边界

- 主会话（`interactive` / `fork` / `selection_side_chat` / `workflow_parent`）只要 Neko channel 打开，就保留 `memory_write` / `memory_read` / `memory_promote` / `memory_delete` / `continuity_update` 与每轮投递。
- 子代理、`workflow_child`、`subagent_child`、`nested_workflow_child` 不获得 Neko Memory，与现状一致。
- `features.memory` / `memory.use` 已从配置 schema 删除；旧配置文件中的同名键被忽略。
- `memoryEnabled` 仅作为旧会话/旧客户端的协议与 telemetry 兼容字段保留，不再控制任何运行时记忆；新代码不得据此启用或禁用 Neko Memory。
- 设置页只保留 Neko 书架 viewie；旧版 Workspace Memory 开关、catalog 与 onboarding 勾选已删除。

## 3. 数据位置

- Neko 书架：`<NEKODE_HOME|~/.nekode>/memory/`
- runtime 回执与快照：`<NEKODE_HOME|~/.nekode>/runtime/memory.sqlite`
- `~/.nekode/cli/memories` 不再读写；`~/.zcode` 始终不碰。

## 4. 验收

1. 主会话出现 Neko 工具与 `runtime_memory` 投递，不受旧 `memoryEnabled` 字段影响。
2. `features.memory` / `memory.use` 不再被解析，旧配置不报错。
3. 旧版 Workspace Memory / custom-agent memory 的 UI、服务、文件写入与 provider 请求全部消失。
4. `pnpm typecheck`、`pnpm lint`、目标回归测试通过。

## 5. 非目标

- 不迁移旧 `~/.nekode/cli/memories` 数据（当前为空）。
- 不为 Neko Memory 新增开关。
- 不恢复任何旧版记忆代码路径。
