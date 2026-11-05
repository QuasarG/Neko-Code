import type { NekodeSessionStateSnapshot } from "@zcode/shared";
import type {
  NekodeSessionWorkspaceTarget,
  NekodeTaskTarget,
} from "#src/zcode-session/zcodeSession.js";

function getWorkspaceKey(target: NekodeSessionWorkspaceTarget): string {
  return target.workspaceIdentity?.trim() || target.workspacePath;
}

function getSessionScopedKey(target: NekodeTaskTarget): string {
  return `${getWorkspaceKey(target)}\0${target.sessionId}`;
}

export function createNekodeDeferredDraftRegistry() {
  const sessionKeys = new Set<string>();

  return {
    remember(params: NekodeSessionWorkspaceTarget, snapshot: NekodeSessionStateSnapshot): void {
      sessionKeys.add(
        getSessionScopedKey({
          workspacePath: snapshot.session.workspace.workspacePath,
          workspaceIdentity:
            snapshot.session.workspace.workspaceIdentity ?? params.workspaceIdentity,
          sessionId: snapshot.session.sessionId,
        }),
      );
    },

    has(target: NekodeTaskTarget): boolean {
      return sessionKeys.has(getSessionScopedKey(target));
    },

    forget(target: NekodeTaskTarget): void {
      sessionKeys.delete(getSessionScopedKey(target));
    },
  };
}
