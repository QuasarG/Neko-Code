# 11 · 指令与记忆

`AGENTS.md` 是用户或项目提供的指令，Neko Memory 是运行过程中存取的长期记忆。二者都可能影响模型输入，但控制方式不同。

## AGENTS.md

当前指令装配会合并用户目录中的 `~/.nekode/AGENTS.md` 与工作区查找得到的项目 `AGENTS.md`，先用户、后项目。工作区范围与当前有效目录影响查找结果；不要默认每个父目录中的指令文件都会叠加，也不要默认其他产品的指令文件名会自动导入。

验证指令是否进入上下文时，使用受控的无敏感标记或检查实际请求，避免依靠模型声称“已阅读”。并发评测应使用隔离用户目录和固定工作区，记录这两处指令文件的内容哈希。

## Neko Memory

主会话的长期记忆只有 Neko Memory，**始终开启，不提供关闭开关**。它按四个书架保存 Markdown 记录：

- `persona/`：主人与关系
- `toolbox/`：跨项目可复用的工程经验
- `projects/<project>/records/`：当前项目知识
- `scratch/`：本会话暂存，晋升后归档

模型通过 `memory_write` / `memory_read` / `memory_promote` / `memory_delete` / `continuity_update` 读写；运行时会按每轮投递基线、diff、墓碑和省略提示。数据位于 `<NEKODE_HOME|~/.nekode>/memory/`，回执与快照位于 `runtime/memory.sqlite`。

旧版 Workspace Memory / Project Memory（`MEMORY.md` + 事实文件、Extraction、Dream、Semantic Recall）和 custom-agent memory 已删除；`features.memory` / `memory.use` 不再被解析。旧会话里的 `memoryEnabled` 字段只作兼容保留，不影响运行时。

## 记忆实验

Neko Memory 目前没有独立的实验开关。需要隔离时，使用全新的 `NEKODE_HOME` / 数据根和独立会话；不要直接编辑活跃会话数据库来清理记忆。

旧版 `--memory-bench` 与 Project Memory Extraction 已随旧版记忆删除，不再提供。
