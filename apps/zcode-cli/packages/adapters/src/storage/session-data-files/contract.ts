// cli-session-data-files 对外契约：CLI 存储根下按会话与目录定位的数据文件。
/** 旧版 Project Memory 已删除；目录只保留为协议兼容形状。 */
export interface SessionDataDirectory {
  workspacePath: string;
  workspaceIdentity?: string;
}

/**
 * 会话与目录在 CLI 存储根下的文件。大小只统计真实文件（lstat，不跟随符号链接），
 * remove 返回删除前测得的字节数；路径不存在按 0 处理，因此重复删除幂等。
 * `measureMemory` / `removeMemory` 是旧版记忆清理的兼容空实现，始终返回 0。
 */
export interface SessionDataFilesPort {
  measureSession(sessionId: string): Promise<number>;
  removeSession(sessionId: string): Promise<number>;
  measureMemory(directory: SessionDataDirectory): Promise<number>;
  removeMemory(directory: SessionDataDirectory): Promise<number>;
}
