import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { bindActiveConfig } from "@freeanima/service-config";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { rebuildAllFtsSegments, resetJiebaForTest } from "@freeanima/connectors-db-pg";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getActivePgTestContext, getTestEngine } from "../../helpers/pg-test.ts";

function minimalConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

function applyTestConfig(patch: Record<string, unknown>): void {
  const ctx = getActivePgTestContext();
  if (!ctx) throw new Error("PG test context not initialized");
  ctx.config.update({ ...minimalConfig(), ...patch });
  bindActiveConfig(ctx.config);
}

describePg("FTS jieba PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-fts-jieba-");
  });

  afterEach(async () => {
    resetJiebaForTest();
    await restoreIntegrationHome(prev);
  });

  it("cjk.enabled: segmented search + rebuild refreshes existing rows", async () => {
    applyTestConfig({ cjk: { enabled: false } });

    const store = getTestEngine().repos.semanticMemory;

    const targetId = await store.create({
      content: "Office keeps premium coffee on hand",
      type: "preference",
    });

    applyTestConfig({ cjk: { enabled: true } });

    const rebuilt = await rebuildAllFtsSegments();
    expect(rebuilt.cjk_enabled).toBe(true);
    expect(rebuilt.tables.semantic_memory).toBeGreaterThanOrEqual(1);

    const jiebaHits = await store.searchFts("coffee", { limit: 5 });
    expect(jiebaHits.some((h) => h.id === targetId)).toBe(true);

    const newId = await store.create({
      content: "Recently hooked on Ethiopian light roast beans",
      type: "preference",
    });
    const freshHits = await store.searchFts("Ethiopian", { limit: 5 });
    expect(freshHits.some((h) => h.id === newId)).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
