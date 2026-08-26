import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { scpToRemote, sshRun } from "./ssh-exec.ts";
import type { SshProcessRunner, SshRemoteTarget } from "./types.ts";

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** 本机可用于 scp 的 anima-probe 路径 */
export function resolveLocalProbeBinary(explicit?: string | null): string | null {
  if (explicit?.trim()) {
    const p = explicit.trim();
    return existsSync(p) ? p : null;
  }
  const fromEnv = process.env.FREEANIMA_PROBE_BIN?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  try {
    const which = (globalThis as { Bun?: { which?: (cmd: string) => string | null } }).Bun?.which?.(
      "anima-probe",
    );
    if (which) return which;
  } catch {
    /* ignore */
  }
  const candidates = [
    join(homedir(), ".anima", "bin", "anima-probe"),
    join(homedir(), ".local", "bin", "anima-probe"),
    join(process.cwd(), "dist", "outpost-clis", "anima-probe"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * 确保远端有 anima-probe：已在 PATH / ~/.anima/bin 则复用；否则 scp 本机 bin。
 */
export async function ensureRemoteAnimaProbe(
  runner: SshProcessRunner,
  target: SshRemoteTarget,
  opts?: { localProbePath?: string | null },
): Promise<{ remoteProbeCommand: string }> {
  const check = await sshRun(
    runner,
    target,
    `(command -v anima-probe) || (test -x "$HOME/.anima/bin/anima-probe" && echo "$HOME/.anima/bin/anima-probe")`,
    { timeoutMs: 30_000 },
  );
  const found = check.stdout.trim().split("\n").filter(Boolean).at(-1);
  if (check.exitCode === 0 && found) {
    return { remoteProbeCommand: found };
  }

  const local = resolveLocalProbeBinary(opts?.localProbePath);
  if (!local) {
    throw new Error(
      "远端无 anima-probe，且本机也找不到可 scp 的二进制。请先 `just pack client-probe`（装到 ~/.anima/bin），或设置 FREEANIMA_PROBE_BIN，或手动在远端安装。",
    );
  }

  const mkdir = await sshRun(runner, target, 'mkdir -p "$HOME/.anima/bin"', {
    timeoutMs: 15_000,
  });
  if (mkdir.exitCode !== 0) {
    throw new Error(`远端创建目录失败：${mkdir.stderr || mkdir.stdout}`);
  }

  const destRes = await sshRun(runner, target, 'echo "$HOME/.anima/bin/anima-probe"', {
    timeoutMs: 10_000,
  });
  const dest = destRes.stdout.trim();
  if (!dest) throw new Error("无法解析远端 probe 安装路径");

  const copied = await scpToRemote(runner, target, local, dest, { timeoutMs: 120_000 });
  if (copied.exitCode !== 0) {
    throw new Error(`scp anima-probe 失败：${copied.stderr || copied.stdout}`);
  }
  const chmod = await sshRun(runner, target, `chmod +x ${shellQuote(dest)}`, {
    timeoutMs: 10_000,
  });
  if (chmod.exitCode !== 0) {
    throw new Error(`chmod 失败：${chmod.stderr || chmod.stdout}`);
  }
  return { remoteProbeCommand: dest };
}
