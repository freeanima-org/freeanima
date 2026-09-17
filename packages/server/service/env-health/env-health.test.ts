import { describe, expect, it } from "bun:test";
import { bandDiskFreeBytes, bandRssKb } from "./bands.ts";
import type { EnvHealthMarkers } from "./types.ts";
import { buildEnvHealthSourceRef, diffMarkers, fingerprintMarkers } from "./diff.ts";
import { formatChangeNotificationBody, formatEnvHealthPromptSection } from "./format.ts";
import type { EnvHealthBaselineStore } from "./baseline.ts";
import {
  runEnvHealthTick,
  shouldSkipInboxForPostgresError,
  type EnvHealthNotificationCreateInput,
  type EnvHealthNotificationPort,
} from "./tick.ts";

function sampleMarkers(overrides: Partial<EnvHealthMarkers> = {}): EnvHealthMarkers {
  return {
    hostname: "host-a",
    os: "linux 6.1",
    timezone: "Asia/Shanghai (local UTC+08:00)",
    hub_version: "0.9.2",
    boot_started_at: "2026-07-18T10:00:00+08:00",
    postgres: "connected",
    redis: "connected",
    rss_band: "0-512MiB",
    mcp_connected: 1,
    mcp_servers: 2,
    acp_connected: 0,
    acp_agents: 0,
    disk_free_band: "4-8GiB",
    ...overrides,
  };
}

function memoryStore(initial: EnvHealthMarkers | null = null): EnvHealthBaselineStore {
  let value = initial;
  return {
    load: async () => value,
    save: async (m) => {
      value = m;
    },
  };
}

function mockNotificationPort(opts?: {
  existingRefs?: Set<string>;
}): EnvHealthNotificationPort & { created: EnvHealthNotificationCreateInput[] } {
  const existing = opts?.existingRefs ?? new Set<string>();
  const created: EnvHealthNotificationCreateInput[] = [];
  const user = { kind: "user" as const, id: 1 };
  const agent = { kind: "agent" as const, id: 2 };
  return {
    created,
    getUserRecipient: () => user,
    getAgentRecipient: () => agent,
    async create(input) {
      created.push(input);
      if (input.source_ref) existing.add(`${input.recipient_kind}:${input.source_ref}`);
      return { id: `n-${created.length}` };
    },
    async existsBySourceRef(sourceRef, recipient) {
      return existing.has(`${recipient.kind}:${sourceRef}`);
    },
  };
}

describe("env-health band", () => {
  it("bands RSS into 512MiB buckets", () => {
    expect(bandRssKb(0)).toBe("0-512MiB");
    expect(bandRssKb(511 * 1024)).toBe("0-512MiB");
    expect(bandRssKb(512 * 1024)).toBe("512-1024MiB");
    expect(bandRssKb(1024 * 1024)).toBe("1024-1536MiB");
  });

  it("bands disk free into GiB buckets", () => {
    const GiB = 1024 ** 3;
    expect(bandDiskFreeBytes(null)).toBe("unknown");
    expect(bandDiskFreeBytes(0.5 * GiB)).toBe("<1GiB");
    expect(bandDiskFreeBytes(1.5 * GiB)).toBe("1-2GiB");
    expect(bandDiskFreeBytes(3 * GiB)).toBe("2-4GiB");
    expect(bandDiskFreeBytes(6 * GiB)).toBe("4-8GiB");
    expect(bandDiskFreeBytes(10 * GiB)).toBe("≥8GiB");
  });
});

describe("env-health diff", () => {
  it("treats missing baseline as quiet init", () => {
    expect(diffMarkers(sampleMarkers(), null)).toEqual({ changed: false, changedKeys: [] });
  });

  it("is quiet when markers match", () => {
    const m = sampleMarkers();
    expect(diffMarkers(m, { ...m })).toEqual({ changed: false, changedKeys: [] });
  });

  it("lists sorted changed keys", () => {
    const base = sampleMarkers();
    const cur = sampleMarkers({ redis: "error", hostname: "host-b" });
    const d = diffMarkers(cur, base);
    expect(d.changed).toBe(true);
    expect(d.changedKeys).toEqual(["hostname", "redis"]);
  });

  it("builds stable source_ref", () => {
    const fp = fingerprintMarkers('{"a":1}');
    expect(buildEnvHealthSourceRef(["redis", "hostname"], fp)).toBe(
      `env-health:hostname,redis:${fp}`,
    );
  });
});

describe("env-health format", () => {
  it("includes baseline frame and marker lines", () => {
    const text = formatEnvHealthPromptSection(sampleMarkers());
    expect(text).toContain("<env_health>");
    expect(text).toContain("Hostname: host-a");
    expect(text).toContain("Disk free (FREEANIMA_HOME): 4-8GiB");
    expect(text).not.toContain("```md");
  });

  it("formats change body with before/after", () => {
    const base = sampleMarkers();
    const cur = sampleMarkers({ disk_free_band: "<1GiB" });
    const diff = diffMarkers(cur, base);
    const body = formatChangeNotificationBody(cur, base, diff);
    expect(body).toContain("4-8GiB → <1GiB");
  });
});

describe("env-health tick helpers", () => {
  it("shouldSkipInboxForPostgresError when postgres changed to error", () => {
    expect(
      shouldSkipInboxForPostgresError(sampleMarkers({ postgres: "error" }), ["postgres"]),
    ).toBe(true);
    expect(shouldSkipInboxForPostgresError(sampleMarkers({ postgres: "error" }), ["redis"])).toBe(
      false,
    );
    expect(
      shouldSkipInboxForPostgresError(sampleMarkers({ postgres: "connected" }), ["postgres"]),
    ).toBe(false);
  });
});

describe("env-health tick", () => {
  it("initializes baseline without notifying", async () => {
    const store = memoryStore(null);
    const port = mockNotificationPort();
    const current = sampleMarkers();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => current,
    });
    expect(result.action).toBe("baseline_init");
    expect(port.created).toHaveLength(0);
    expect(await store.load()).toEqual(current);
  });

  it("stays quiet when unchanged", async () => {
    const current = sampleMarkers();
    const store = memoryStore(current);
    const port = mockNotificationPort();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => current,
    });
    expect(result.action).toBe("quiet");
    expect(port.created).toHaveLength(0);
  });

  it("skips inbox when postgres becomes error but still saves baseline", async () => {
    const base = sampleMarkers();
    const next = sampleMarkers({ postgres: "error", rss_band: "512-1024MiB" });
    const store = memoryStore(base);
    const port = mockNotificationPort();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => next,
    });
    expect(result.ok).toBe(true);
    expect(result.action).toBe("skipped");
    expect(result.changed_keys).toEqual(["postgres", "rss_band"]);
    expect(result.error).toContain("postgres unavailable");
    expect(port.created).toHaveLength(0);
    expect(await store.load()).toEqual(next);
  });

  it("notifies when postgres recovers from error to connected", async () => {
    const base = sampleMarkers({ postgres: "error" });
    const next = sampleMarkers({ postgres: "connected" });
    const store = memoryStore(base);
    const port = mockNotificationPort();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => next,
    });
    expect(result.action).toBe("notified");
    expect(result.changed_keys).toEqual(["postgres"]);
    expect(port.created).toHaveLength(2);
    expect(port.created[0]?.title).toBe("环境/健康变更：PostgreSQL");
    expect(await store.load()).toEqual(next);
  });

  it("notifies user and agent on non-postgres change then saves baseline", async () => {
    const base = sampleMarkers();
    const next = sampleMarkers({ rss_band: "512-1024MiB" });
    const store = memoryStore(base);
    const port = mockNotificationPort();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => next,
    });
    expect(result.action).toBe("notified");
    expect(result.changed_keys).toEqual(["rss_band"]);
    expect(port.created).toHaveLength(2);
    expect(port.created.map((c) => c.recipient_kind).toSorted()).toEqual(["agent", "user"]);
    expect(port.created[0]?.source_kind).toBe("system");
    expect(port.created[0]?.source_ref).toBe(result.source_ref);
    expect(await store.load()).toEqual(next);
  });

  it("dedupes when both recipients already have source_ref", async () => {
    const base = sampleMarkers();
    const next = sampleMarkers({ hostname: "host-b" });
    const first = await runEnvHealthTick({
      startTimeSec: 1,
      notification: mockNotificationPort(),
      store: memoryStore(base),
      collect: async () => next,
    });
    expect(first.source_ref).toBeTruthy();
    const existing = new Set([`user:${first.source_ref}`, `agent:${first.source_ref}`]);
    const store = memoryStore(base);
    const port = mockNotificationPort({ existingRefs: existing });
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => next,
    });
    expect(result.action).toBe("deduped");
    expect(port.created).toHaveLength(0);
    expect(await store.load()).toEqual(next);
  });

  it("dev: boot_started_at alone refreshes baseline without notify", async () => {
    const base = sampleMarkers();
    const next = sampleMarkers({ boot_started_at: "2026-07-30T17:00:00+08:00" });
    const store = memoryStore(base);
    const port = mockNotificationPort();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => next,
      suppressBootStartedNotify: true,
    });
    expect(result.action).toBe("quiet");
    expect(result.changed_keys).toEqual(["boot_started_at"]);
    expect(port.created).toHaveLength(0);
    expect(await store.load()).toEqual(next);
  });

  it("dev: boot change with postgres error skips inbox", async () => {
    const base = sampleMarkers();
    const next = sampleMarkers({
      boot_started_at: "2026-07-30T17:00:00+08:00",
      postgres: "error",
    });
    const store = memoryStore(base);
    const port = mockNotificationPort();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => next,
      suppressBootStartedNotify: true,
    });
    expect(result.ok).toBe(true);
    expect(result.action).toBe("skipped");
    expect(result.changed_keys).toEqual(["postgres"]);
    expect(port.created).toHaveLength(0);
    expect(await store.load()).toEqual(next);
  });

  it("production: boot_started_at alone still notifies", async () => {
    const base = sampleMarkers();
    const next = sampleMarkers({ boot_started_at: "2026-07-30T17:00:00+08:00" });
    const store = memoryStore(base);
    const port = mockNotificationPort();
    const result = await runEnvHealthTick({
      startTimeSec: 1,
      notification: port,
      store,
      collect: async () => next,
      suppressBootStartedNotify: false,
    });
    expect(result.action).toBe("notified");
    expect(result.changed_keys).toEqual(["boot_started_at"]);
    expect(port.created).toHaveLength(2);
    expect(port.created[0]?.title).toBe("环境/健康变更：Boot started at");
  });
});
