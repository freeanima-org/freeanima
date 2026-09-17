/**
 * 桌面 SSH Remote 编排入口。
 */

import {
  connectSshCodingRemote,
  type SshProcessRunner,
  type SshRemoteSession,
  type SshRemoteTarget,
} from "@freeanima/shared/coding/ssh-remote";
import { CODING_APP_ID } from "@freeanima/shared/coding/constants.ts";
import { asRecord } from "@freeanima/shared/util";

export type CodingOutpostRow = { instance_id: string; tool_count: number };

export async function listCodingOutpostsFromShell(): Promise<CodingOutpostRow[]> {
  const shell = window.portalShell;
  const habitatUrl = (shell?.habitatUrl ?? "").replace(/\/$/, "");
  const token = shell?.remoteAuth?.token?.trim() ?? "";
  if (!habitatUrl || !token || !shell) throw new Error("缺少 Habitat URL / Token");
  const fetchFn = shell.habitatFetch ?? fetch;
  const res = await fetchFn(`${habitatUrl}/rpc/v1/outposts/status`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`outposts/status HTTP ${res.status}`);
  const raw = (await res.json()) as unknown;
  const record = asRecord(raw);
  const instances = Array.isArray(record?.instances) ? record.instances : [];
  const out: CodingOutpostRow[] = [];
  for (const row of instances) {
    const r = asRecord(row);
    if (!r || r.app_id !== CODING_APP_ID) continue;
    const instance_id = typeof r.instance_id === "string" ? r.instance_id.trim() : "";
    if (!instance_id) continue;
    out.push({
      instance_id,
      tool_count: typeof r.tool_count === "number" ? r.tool_count : 0,
    });
  }
  return out;
}

/** 指定 instance 是否在线且已注册工具 */
export function isCodingOutpostAlive(
  rows: readonly CodingOutpostRow[],
  instanceId: string | null | undefined,
): boolean {
  const id = instanceId?.trim();
  if (!id) return false;
  const hit = rows.find((r) => r.instance_id === id);
  return Boolean(hit && hit.tool_count > 0);
}

function createTauriSshProcessRunner(): SshProcessRunner {
  const api = window.portalShell?.sshProcess;
  if (!api) throw new Error("portalShell.sshProcess 不可用（需桌面壳）");
  return {
    run: (command, args, opts) => api.run(command, args, opts),
    spawnDetached: (command, args) => api.spawnDetached(command, args),
    stopDetached: (handleId) => api.stopDetached(handleId),
  };
}

export async function connectDesktopSshRemote(
  target: SshRemoteTarget,
  opts?: { preferInstanceId?: string | null },
): Promise<SshRemoteSession> {
  const shell = window.portalShell;
  const habitatUrl = (shell?.habitatUrl ?? "").replace(/\/$/, "");
  const token = shell?.remoteAuth?.token?.trim() ?? "";
  if (!habitatUrl || !token) {
    throw new Error("请先在主窗配置 Habitat URL 与 Token");
  }
  return connectSshCodingRemote({
    runner: createTauriSshProcessRunner(),
    habitatUrl,
    token,
    target,
    listCodingOutposts: listCodingOutpostsFromShell,
    ...(opts?.preferInstanceId != null ? { preferInstanceId: opts.preferInstanceId } : {}),
  });
}

/**
 * 探活已存 outpost；离线则再编排。返回最新 instanceId / 可选隧道。
 */
export async function ensureDesktopSshOutpost(
  target: SshRemoteTarget,
  preferInstanceId?: string | null,
): Promise<SshRemoteSession> {
  const rows = await listCodingOutpostsFromShell();
  if (isCodingOutpostAlive(rows, preferInstanceId)) {
    const id = preferInstanceId?.trim();
    if (!id) throw new Error("coding outpost instance_id 为空");
    return {
      instanceId: id,
      target,
    };
  }
  return connectDesktopSshRemote(
    target,
    preferInstanceId != null ? { preferInstanceId } : undefined,
  );
}
