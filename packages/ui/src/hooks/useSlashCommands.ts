/**
 * Nekode Agent Slash Commands 便捷 hook
 *
 * 返回当前 workspace 下 Agent 广播的可用 slash commands 列表。
 */
import { useNekodeSessionStore, selectWorkspaceNekodeState } from "../store/zcodeSessionStore.js";

export function useSlashCommands(workspacePath: string, workspaceIdentity?: string) {
  return useNekodeSessionStore(
    (state) => selectWorkspaceNekodeState(state, workspacePath, workspaceIdentity).slashCommands,
  );
}
