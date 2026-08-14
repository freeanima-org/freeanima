import { afterEach, describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  applyConfigSection,
  bindActiveRuntimeConfig,
  Config,
  getActiveRuntimeConfig,
  listTransferredSectionKeys,
  registerSection,
  unregisterSection,
  resetActiveConfigForTest,
  pickBootstrapRecord,
  pickRuntimeDocument,
  isBootstrapConfigKey,
  expandConfigEnv,
  maskConfigSecretsForLlm,
  sanitizeConfigForApi,
  buildRuntimeConfigSchemaFromRegistry,
} from "./index.ts";

const TEST_KEYS = ["__mech_a", "__mech_b", "__mech_x"] as const;

describe("config-mechanism Config", () => {
  afterEach(() => {
    resetActiveConfigForTest();
  });

  it("fromSnapshot / update / bind", () => {
    const cfg = new Config({ llm: { default_profile: "chat" } });
    expect(cfg.data.llm?.default_profile).toBe("chat");
    cfg.update({ llm: { default_profile: "other" } });
    expect(cfg.data.llm?.default_profile).toBe("other");
    bindActiveRuntimeConfig(cfg);
    expect(getActiveRuntimeConfig()).toBe(cfg);
  });
});

describe("bootstrap-keys", () => {
  it("pick / strip", () => {
    const raw = {
      database: { url: "postgresql://x" },
      llm: { default_profile: "chat" },
    };
    expect(pickBootstrapRecord(raw)).toEqual({ database: { url: "postgresql://x" } });
    expect(pickRuntimeDocument(raw)).toEqual({ llm: { default_profile: "chat" } });
    expect(isBootstrapConfigKey("database")).toBe(true);
  });
});

describe("section registry + apply", () => {
  afterEach(() => {
    for (const key of TEST_KEYS) unregisterSection(key);
  });

  it("registerSection 合并 schema 与 apply；transferred 列表与单 key 调度", async () => {
    const applied: string[] = [];
    registerSection({
      key: "__mech_a",
      schema: z.object({ n: z.number() }),
      apply: async () => {
        applied.push("a");
      },
      transferred: true,
    });
    registerSection({
      key: "__mech_b",
      schema: z.string().optional(),
      apply: async () => {
        applied.push("b");
      },
      transferred: false,
    });
    expect(listTransferredSectionKeys()).toContain("__mech_a");
    expect(listTransferredSectionKeys()).not.toContain("__mech_b");
    const cfg = new Config({ __mech_a: { n: 1 } });
    await applyConfigSection(cfg, "__mech_a");
    expect(applied).toEqual(["a"]);
    await applyConfigSection(cfg, "__mech_b");
    expect(applied).toEqual(["a", "b"]);
    // live / 未注册 apply 的 key 为 no-op
    await applyConfigSection(cfg, "compression");
    expect(applied).toEqual(["a", "b"]);
  });

  it("buildRuntimeConfigSchemaFromRegistry 可 parse", () => {
    registerSection({ key: "__mech_x", schema: z.object({ v: z.string() }) });
    const schema = buildRuntimeConfigSchemaFromRegistry();
    const parsed = schema.safeParse({ __mech_x: { v: "ok" }, unknown: 1 });
    expect(parsed.success).toBe(true);
  });
});

describe("env-expand + sanitize skeleton", () => {
  it("expandConfigEnv", () => {
    process.env.CFG_MECH_TEST = "hi";
    expect(expandConfigEnv("a:${CFG_MECH_TEST}")).toBe("a:hi");
    delete process.env.CFG_MECH_TEST;
  });

  it("sanitize / mask with extraMaskPaths", () => {
    const raw = {
      database: { url: "postgresql://secret" },
      api_key: "k",
    };
    expect(sanitizeConfigForApi(raw).api_key).toBe("k");
    const masked = maskConfigSecretsForLlm(raw, { extraMaskPaths: ["database.url"] });
    expect(masked.api_key).toBe("***");
    expect((masked.database as { url: string }).url).toBe("***");
  });
});
