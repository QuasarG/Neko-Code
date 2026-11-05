import type { WorkspacePurpose, NekodeTaskMeta } from "@zcode/shared";

export type NekodeTaskListKind = "pinned" | "archived" | "timeline" | "active";
export type NekodeTaskListSortBy = "created" | "updated";

export interface NekodeTaskListWorkspaceScope {
  workspacePath: string;
  workspaceIdentity?: string;
  workspacePurpose?: WorkspacePurpose;
}

export interface NekodeTaskListQuery {
  kind: NekodeTaskListKind | "all";
  /** host 由存储 owner 确定全部范围，不接受 UI 已打开工作区作为历史目录。 */
  workspaceScopes: NekodeTaskListWorkspaceScope[] | "host";
  sortBy: NekodeTaskListSortBy;
  search?: string;
  limit?: number;
}

export type NekodeTaskListItem = NekodeTaskMeta & {
  searchSnippet?: string;
  searchSnippets?: string[];
};

export interface NekodeTaskListResult {
  items: NekodeTaskListItem[];
  total: number;
  hasMore: boolean;
}

export interface NekodeWorkspaceEventSubscriptionParams {
  workspacePath: string;
  workspaceIdentity?: string;
}
