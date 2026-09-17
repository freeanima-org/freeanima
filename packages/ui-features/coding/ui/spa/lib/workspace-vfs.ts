/** WorkspaceSandbox → ProjectVfs（相对路径） */

import type {
  ProjectVfs,
  ProjectVfsDirEntry,
} from "@freeanima/shared/coding/project-agent-context";
import type { WorkspaceSandbox } from "./workspace-fs.ts";

export function projectVfsFromSandbox(sandbox: WorkspaceSandbox): ProjectVfs {
  return {
    async exists(path) {
      return sandbox.existsRel(path);
    },
    async isDir(path) {
      return sandbox.isDirRel(path);
    },
    async readText(path) {
      const out = await sandbox.readTextRel(path);
      if (!out.ok) throw new Error(out.error);
      return out.text;
    },
    async listDir(path) {
      const out = await sandbox.listDirRel(path);
      if (!out.ok) throw new Error(out.error);
      const entries: ProjectVfsDirEntry[] = out.entries.map((k) => ({
        name: k.name,
        kind: k.kind === "dir" ? "dir" : "file",
      }));
      return entries;
    },
    async writeText(path, content) {
      const out = await sandbox.writeTextRel(path, content);
      if (!out.ok) throw new Error(out.error);
    },
  };
}
