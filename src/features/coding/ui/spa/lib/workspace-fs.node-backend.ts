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

/** 与 Habitat `splitCommandLine` / Rust coding_fs 同语义（测试 backend shell=false）。 */
function splitCommandLine(command: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let escape = false;

  for (const ch of command) {
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (quote === null && ch === "\\") {
      escape = true;
      continue;
    }
    if (quote !== null) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur.length > 0) {
        out.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) out.push(cur);
  return out;
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
      const useShell = opts.shell ?? false;
      return await new Promise((resolvePromise, reject) => {
        let child;
        try {
          child = useShell
            ? spawn(opts.command, { cwd, shell: true, env: process.env })
            : (() => {
                const parts = splitCommandLine(opts.command.trim());
                const bin = parts[0];
                if (!bin) {
                  throw new Error("command is empty");
                }
                return spawn(bin, parts.slice(1), { cwd, shell: false, env: process.env });
              })();
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
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
