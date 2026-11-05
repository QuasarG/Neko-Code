import type { AgentRuntimeConfig } from "../types.js";

/** Neko Memory 只服务 Main-equivalent 会话；旧版 Project Memory 已删除。 */
export function isMainMemoryTaskType(taskType: AgentRuntimeConfig["taskType"]): boolean {
  return (
    taskType === undefined ||
    taskType === "interactive" ||
    taskType === "fork" ||
    taskType === "selection_side_chat" ||
    taskType === "workflow_parent"
  );
}
