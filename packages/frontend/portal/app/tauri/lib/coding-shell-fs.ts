/**
 * Coding Outpost：portalShell.workspaceFs / runCommand / pickDirectory 桥接。
 * Rust：`coding_fs.rs`（pick_directory / workspace_fs_* / run_command）。
 * Dev 远程 Vite（:4186）须在 capabilities `remote.urls` 放行，否则 invoke 不可用。
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  ShellRunCommandOpts,
  ShellRunCommandResult,
  WorkspaceFsApi,
  WorkspaceFsDirEntry,
} from "@freeanima/client/portal-sdk/shell-api.ts";

export function createCodingWorkspaceFsBridge(): WorkspaceFsApi {
  return {
    listDir: (absPath) => invoke<WorkspaceFsDirEntry[]>("workspace_fs_list_dir", { path: absPath }),
    readText: (absPath) => invoke<string>("workspace_fs_read_text", { path: absPath }),
    writeText: (absPath, content) => invoke("workspace_fs_write_text", { path: absPath, content }),
    exists: (absPath) => invoke<boolean>("workspace_fs_exists", { path: absPath }),
    isDir: (absPath) => invoke<boolean>("workspace_fs_is_dir", { path: absPath }),
    walkFiles: (absRoot, opts) =>
      invoke<string[]>("workspace_fs_walk_files", {
        path: absRoot,
        maxFiles: opts?.maxFiles ?? null,
      }),
  };
}

export async function codingRunCommandBridge(
  opts: ShellRunCommandOpts,
): Promise<ShellRunCommandResult> {
  return invoke<ShellRunCommandResult>("run_command", {
    command: opts.command,
    cwd: opts.cwd ?? null,
    timeoutMs: opts.timeoutMs ?? null,
    shell: opts.shell ?? false,
  });
}

export async function codingPickDirectoryBridge(): Promise<string | null> {
  return invoke<string | null>("pick_directory");
}
