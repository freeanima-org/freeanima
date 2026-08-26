import { ensureRemoteAnimaProbe } from "./ensure-probe.ts";
import { sshRun } from "./ssh-exec.ts";
import { parseSshRemoteTarget, type ParseSshTargetInput } from "./parse-target.ts";
import { maybeStartReverseTunnel, startRemoteCodingProbe } from "./start-probe.ts";
import type {
  ListCodingOutpostFn,
  SshProcessRunner,
  SshRemoteSession,
  SshRemoteTarget,
} from "./types.ts";

export type ConnectSshCodingRemoteOpts = {
  runner: SshProcessRunner;
  habitatUrl: string;
  token: string;
  target: SshRemoteTarget;
  listCodingOutposts: ListCodingOutpostFn;
  /** 轮询 attach 超时；默认 45s */
  attachTimeoutMs?: number;
  /** 已知 instance（重启后复用探测） */
  preferInstanceId?: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForCodingInstance(
  list: ListCodingOutpostFn,
  opts: { timeoutMs: number; beforeIds: Set<string>; preferInstanceId?: string | null },
): Promise<string> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    const rows = await list();
    if (opts.preferInstanceId) {
      const hit = rows.find((r) => r.instance_id === opts.preferInstanceId);
      if (hit) return hit.instance_id;
    }
    const fresh = rows.find((r) => !opts.beforeIds.has(r.instance_id));
    if (fresh) return fresh.instance_id;
    // 若无「新」实例但已有任意 coding instance，也接受（probe 复用持久 instance_id）
    const first = rows[0];
    if (first && opts.beforeIds.size === 0) {
      return first.instance_id;
    }
    if (rows.length > 0) {
      // 持久 instance 已在 beforeIds 中：心跳恢复后 tool_count>0 即可
      const revived = rows.find((r) => r.tool_count > 0);
      if (revived) return revived.instance_id;
    }
    await sleep(1000);
  }
  throw new Error("等待远端 anima-probe attach 超时");
}

/** 编排：连通 → 隧道? → ensure probe → start → 轮询 outposts */
export async function connectSshCodingRemote(
  opts: ConnectSshCodingRemoteOpts,
): Promise<SshRemoteSession> {
  const { runner, target } = opts;
  const habitatUrl = opts.habitatUrl.replace(/\/$/, "");
  const token = opts.token.trim();
  if (!token) throw new Error("缺少 Habitat token");

  const ping = await sshRun(runner, target, "echo ok", { timeoutMs: 20_000 });
  if (ping.exitCode !== 0 || !ping.stdout.includes("ok")) {
    throw new Error(`SSH 连通失败（需密钥/ssh-agent，BatchMode）：${ping.stderr || ping.stdout}`);
  }

  const before = await opts.listCodingOutposts();
  const beforeIds = new Set(before.map((r) => r.instance_id));

  const tunnel = await maybeStartReverseTunnel(runner, target, habitatUrl);
  const probeHabitatUrl = tunnel?.habitatUrlForProbe ?? habitatUrl;

  const { remoteProbeCommand } = await ensureRemoteAnimaProbe(runner, target);
  await startRemoteCodingProbe(runner, target, {
    habitatUrl: probeHabitatUrl,
    token,
    remoteProbeCommand,
  });

  const instanceId = await waitForCodingInstance(opts.listCodingOutposts, {
    timeoutMs: opts.attachTimeoutMs ?? 45_000,
    beforeIds,
    ...(opts.preferInstanceId != null ? { preferInstanceId: opts.preferInstanceId } : {}),
  });

  return {
    instanceId,
    target,
    ...(tunnel ? { tunnel } : {}),
  };
}

export function targetFromCliFlags(input: ParseSshTargetInput): SshRemoteTarget {
  return parseSshRemoteTarget(input);
}
