/**
 * Bun/Node 测试用 backend（WebView 不引用本文件）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

import type { WorkspaceFsBackend } from "./workspace-fs.ts";
import { asPosixPath } from "./workspace-fs.ts";

function toAbs(p: string): string {
  return resolve(p.replace(/\//g, process.platform === "win32" ? "\\" : "/"));
}

export function createNodeWorkspaceBackend(): WorkspaceFsBackend {
  return {
    async listDir(absPath) {
      const dir = toAbs(absPath);
      const names = readdirSync(dir);
      return names.map((name) => {
        const st = statSync(join(dir, name));
        return {
          name,
          kind: st.isDirectory() ? ("dir" as const) : ("file" as const),
          ...(st.isFile() ? { size: st.size } : {}),
        };
      });
    },
    async readText(absPath) {
      return readFileSync(toAbs(absPath), "utf-8");
    },
    async writeText(absPath, content) {
      const p = toAbs(absPath);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, content, "utf-8");
    },
    async exists(absPath) {
      return existsSync(toAbs(absPath));
    },
    async isDir(absPath) {
      const p = toAbs(absPath);
      return existsSync(p) && statSync(p).isDirectory();
    },
    async walkFiles(absRoot, opts) {
      const root = toAbs(absRoot);
      const max = opts?.maxFiles ?? 5000;
      const out: string[] = [];
      const walk = (dir: string): void => {
        if (out.length >= max) return;
        for (const name of readdirSync(dir)) {
          if (name === "node_modules" || name === ".git") continue;
          const full = join(dir, name);
          const st = statSync(full);
          if (st.isDirectory()) {
            walk(full);
          } else if (st.isFile()) {
            out.push(asPosixPath(full));
            if (out.length >= max) return;
          }
        }
      };
      walk(root);
      return out;
    },
    async runCommand(opts) {
      const cwd = opts.cwd ? toAbs(opts.cwd) : process.cwd();
      return await new Promise((resolvePromise, reject) => {
        const child = spawn(opts.command, {
          cwd,
          shell: opts.shell ?? true,
          env: process.env,
        });
        let stdout = "";
        let stderr = "";
        const timer =
          opts.timeoutMs != null
            ? setTimeout(() => {
                child.kill("SIGTERM");
              }, opts.timeoutMs)
            : null;
        child.stdout?.on("data", (d: Buffer) => {
          stdout += d.toString("utf-8");
        });
        child.stderr?.on("data", (d: Buffer) => {
          stderr += d.toString("utf-8");
        });
        child.on("error", (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        });
        child.on("close", (code) => {
          if (timer) clearTimeout(timer);
          resolvePromise({ stdout, stderr, exitCode: code ?? 1 });
        });
      });
    },
  };
}
