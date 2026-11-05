import { useCallback, useEffect, useRef, useState } from "react";
import type { INekoMemoryService, NekoMemorySnapshot } from "@zcode/services";

export interface NekoMemoryBooksState {
  snapshot: NekoMemorySnapshot | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: NekoMemoryBooksState = {
  snapshot: null,
  loading: false,
  error: null,
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Neko 记忆六本书目录。只在 settings 视图挂载时读取一次，不轮询；
 * workspace 变化或手动刷新时按请求序号丢弃过期结果。
 */
export function useNekoMemoryBooks(options: {
  service: INekoMemoryService | undefined;
  workspacePath: string | null;
  workspaceIdentity?: string | null;
  enabled: boolean;
}): NekoMemoryBooksState & { refresh: () => Promise<void> } {
  const { service, workspacePath, workspaceIdentity, enabled } = options;
  const requestSeqRef = useRef(0);
  const [state, setState] = useState<NekoMemoryBooksState>(INITIAL_STATE);

  const refresh = useCallback(async () => {
    if (!service) return;
    const seq = ++requestSeqRef.current;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const snapshot = await service.listBooks({
        workspacePath,
        workspaceIdentity: workspaceIdentity ?? undefined,
      });
      if (seq !== requestSeqRef.current) return;
      setState({ snapshot, loading: false, error: null });
    } catch (error) {
      if (seq !== requestSeqRef.current) return;
      setState({ snapshot: null, loading: false, error: getErrorMessage(error) });
    }
  }, [service, workspacePath, workspaceIdentity]);

  useEffect(() => {
    if (!enabled || !service) {
      requestSeqRef.current += 1;
      setState(INITIAL_STATE);
      return;
    }
    void refresh();
    return () => {
      // 卸载或作用域切换后，晚到的请求不能回填旧书架。
      requestSeqRef.current += 1;
    };
  }, [enabled, service, refresh]);

  return { ...state, refresh };
}
