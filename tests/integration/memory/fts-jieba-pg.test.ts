import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { clearConfigCache, resetConfigForTest, setConfigForTest } from "@freeanima/service-config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { rebuildAllFtsSegments, resetJiebaForTest } from "@freeanima/connectors-db-pg";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";
import { getTestEngine } from "../../helpers/pg-test.ts";

function minimalConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describePg("FTS jieba PG", () => {
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    await beginIntegrationCase("freeanima-fts-jieba-");
  });

  afterEach(async () => {
    resetJiebaForTest();
    resetConfigForTest();
    clearConfigCache();
    await restoreIntegrationHome(prev);
  });

  it("cjk.enabled 时分词检索 + rebuild 刷新存量", async () => {
    setConfigForTest({ ...minimalConfig(), cjk: { enabled: false } });

    const store = getTestEngine().repos.semanticMemory;

    const targetId = await store.create({
      content: "办公室常备精品咖啡",
      type: "preference",
    });

    setConfigForTest({ ...minimalConfig(), cjk: { enabled: true } });

    const rebuilt = await rebuildAllFtsSegments();
    expect(rebuilt.cjk_enabled).toBe(true);
    expect(rebuilt.tables.semantic_memory).toBeGreaterThanOrEqual(1);

    const jiebaHits = await store.searchFts("咖啡", { limit: 5 });
    expect(jiebaHits.some((h) => h.id === targetId)).toBe(true);

    const newId = await store.create({
      content: "最近迷上了埃塞俄比亚浅烘豆",
      type: "preference",
    });
    const freshHits = await store.searchFts("埃塞俄比亚", { limit: 5 });
    expect(freshHits.some((h) => h.id === newId)).toBe(true);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
