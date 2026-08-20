import type { EnvHealthBaselineStore } from "./baseline.ts";
import { getBaselineStore } from "./baseline.ts";
import { buildEnvHealthSourceRef, diffMarkers, fingerprintMarkers } from "./diff.ts";
import { formatChangeNotificationBody, formatChangeNotificationTitle } from "./format.ts";
import { stableMarkersJson, type EnvHealthMarkers } from "./types.ts";
import type { FullRuntimeDeps } from "../runtime-deps.ts";

export type EnvHealthTickResult = {
  ok: boolean;
  action: "quiet" | "baseline_init" | "notified" | "deduped" | "skipped";
  changed_keys?: string[];
  source_ref?: string;
  error?: string;
};

export type EnvHealthNotificationCreateInput = {
  recipient_kind: "user" | "agent";
  recipient_id: number;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  source_kind?: "system" | "cron" | "acp" | "tool" | null;
  source_ref?: string | null;
};

/** 最小通知端口（避免 tick 测试拉 capabilities / zod 全图） */
export type EnvHealthNotificationPort = {
  create(input: EnvHealthNotificationCreateInput): Promise<unknown>;
  existsBySourceRef(
    sourceRef: string,
    recipient: { kind: "user" | "agent"; id: number },
  ): Promise<boolean>;
  getAgentRecipient(): { kind: "user" | "agent"; id: number };
  getUserRecipient(): { kind: "user" | "agent"; id: number };
};

export type EnvHealthTickDeps = {
  startTimeSec: number;
  /** 缺省 collect 时必填 */
  runtimeDeps?: FullRuntimeDeps;
  notification: EnvHealthNotificationPort | null;
  store?: EnvHealthBaselineStore;
  collect?: () => Promise<EnvHealthMarkers>;
  /**
   * 开发 Habitat：忽略 `boot_started_at` 变更通知（仍写回基线）。
   * 由 boot 层传入 `isDevHabitatProcess()`；单测可显式开关。
   */
  suppressBootStartedNotify?: boolean;
};

/** 通知侧变更键：开发环境剔除重启噪声 `boot_started_at` */
export function notifyChangedKeys(
  changedKeys: (keyof EnvHealthMarkers)[],
  suppressBootStartedNotify: boolean,
): (keyof EnvHealthMarkers)[] {
  if (!suppressBootStartedNotify) return changedKeys;
  return changedKeys.filter((k) => k !== "boot_started_at");
}

/**
 * 采集 → 对比基线 → 有变更则双写 Inbox（source_ref 去重）→ 写回基线。
 * 无基线时仅建档，不通知。
 */
export async function runEnvHealthTick(deps: EnvHealthTickDeps): Promise<EnvHealthTickResult> {
  const store = deps.store ?? getBaselineStore();
  let current: EnvHealthMarkers;
  if (deps.collect != null) {
    current = await deps.collect();
  } else {
    if (!deps.runtimeDeps) {
      return { ok: false, action: "skipped", error: "runtimeDeps required without collect" };
    }
    const { collectMarkers } = await import("./markers.ts");
    current = await collectMarkers({
      startTimeSec: deps.startTimeSec,
      deps: deps.runtimeDeps,
    });
  }

  const baseline = await store.load();
  const diff = diffMarkers(current, baseline);

  if (baseline == null) {
    await store.save(current);
    return { ok: true, action: "baseline_init" };
  }

  if (!diff.changed) {
    return { ok: true, action: "quiet" };
  }

  const notifyKeys = notifyChangedKeys(diff.changedKeys, deps.suppressBootStartedNotify === true);
  if (notifyKeys.length === 0) {
    await store.save(current);
    return {
      ok: true,
      action: "quiet",
      changed_keys: diff.changedKeys,
    };
  }

  const notifyDiff = { changed: true as const, changedKeys: notifyKeys };
  const fp = fingerprintMarkers(stableMarkersJson(current));
  const sourceRef = buildEnvHealthSourceRef(notifyKeys, fp);
  const port = deps.notification;

  if (!port) {
    await store.save(current);
    return {
      ok: false,
      action: "skipped",
      changed_keys: notifyKeys,
      source_ref: sourceRef,
      error: "notification port unavailable",
    };
  }

  const user = port.getUserRecipient();
  const agent = port.getAgentRecipient();
  const [userExists, agentExists] = await Promise.all([
    port.existsBySourceRef(sourceRef, user),
    port.existsBySourceRef(sourceRef, agent),
  ]);

  if (userExists && agentExists) {
    await store.save(current);
    return {
      ok: true,
      action: "deduped",
      changed_keys: notifyKeys,
      source_ref: sourceRef,
    };
  }

  const title = formatChangeNotificationTitle(notifyKeys);
  const body = formatChangeNotificationBody(current, baseline, notifyDiff);
  const payload = {
    changed_keys: notifyKeys,
    markers: current,
  };

  if (!userExists) {
    await port.create({
      recipient_kind: user.kind,
      recipient_id: user.id,
      title,
      body,
      source_kind: "system",
      source_ref: sourceRef,
      payload,
    });
  }
  if (!agentExists) {
    await port.create({
      recipient_kind: agent.kind,
      recipient_id: agent.id,
      title,
      body,
      source_kind: "system",
      source_ref: sourceRef,
      payload,
    });
  }

  await store.save(current);
  return {
    ok: true,
    action: "notified",
    changed_keys: notifyKeys,
    source_ref: sourceRef,
  };
}
