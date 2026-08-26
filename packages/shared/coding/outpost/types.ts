/**
 * Coding Outpost 工作区 FS 后端契约（与 portal-sdk WorkspaceFsApi 形状对齐，但不依赖 client）。
 */

export type WorkspaceFsDirEntry = {
  name: string;
  kind: "file" | "dir";
  size?: number;
};

export type WorkspaceRunCommandOpts = {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  shell?: boolean;
};

export type WorkspaceRunCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type WorkspaceFsBackend = {
  listDir: (absPath: string) => Promise<WorkspaceFsDirEntry[]>;
  readText: (absPath: string) => Promise<string>;
  writeText: (absPath: string, content: string) => Promise<void>;
  exists: (absPath: string) => Promise<boolean>;
  isDir: (absPath: string) => Promise<boolean>;
  walkFiles: (absRoot: string, opts?: { maxFiles?: number }) => Promise<string[]>;
  searchFiles?: (opts: {
    path: string;
    workspaceRoot: string;
    pattern: string;
    maxFiles?: number;
    limit?: number;
    outputMode?: "content" | "files_only" | "count";
  }) => Promise<string>;
  runCommand?: (opts: WorkspaceRunCommandOpts) => Promise<WorkspaceRunCommandResult>;
};

export type WorkspacePathOk = { ok: true; abs: string; rel: string };
export type WorkspacePathErr = { ok: false; error: string };
export type WorkspacePathResult = WorkspacePathOk | WorkspacePathErr;

export type WorkspaceTreeEntry = {
  path: string;
  kind: "file" | "dir";
  size?: number;
};
