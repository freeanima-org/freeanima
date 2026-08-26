/**
 * Bun/Node 本机 SSH 进程 runner（anima-client）。
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import type { SshProcessRunner, SshRunResult } from "./types.ts";

const detached = new Map<string, { kill: () => void }>();

export function createNodeSshProcessRunner(): SshProcessRunner {
  return {
    async run(command, args, opts) {
      return await new Promise<SshRunResult>((resolve, reject) => {
        const child = spawn(command, [...args], {
          env: { ...process.env, ...opts?.env },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        const timer =
          opts?.timeoutMs != null
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
          resolve({ stdout, stderr, exitCode: code ?? 1 });
        });
      });
    },
    async spawnDetached(command, args, opts) {
      const child = spawn(command, [...args], {
        env: { ...process.env, ...opts?.env },
        stdio: "ignore",
        detached: true,
      });
      child.unref();
      const handleId = randomUUID();
      detached.set(handleId, {
        kill: () => {
          try {
            if (child.pid) process.kill(-child.pid, "SIGTERM");
          } catch {
            try {
              child.kill("SIGTERM");
            } catch {
              /* ignore */
            }
          }
        },
      });
      return { handleId };
    },
    async stopDetached(handleId) {
      const h = detached.get(handleId);
      if (!h) return;
      h.kill();
      detached.delete(handleId);
    },
  };
}
