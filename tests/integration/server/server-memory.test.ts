import { it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate.ts";
import {
  beginIntegrationCase,
  endIntegrationCase,
  restoreIntegrationHome,
} from "../../helpers/integration-case.ts";

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getServiceContext } from "@freeanima/service";
import { getTestEngine, seedSession } from "../../helpers/pg-test.ts";

describePg("server memory API", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-memapi-");
    home = ctx.home;
    writeFileSync(join(home, "MEMORY.md"), "# 记忆笔记\n", "utf-8");
  });

  afterEach(async () => {
    await restoreIntegrationHome(prev);
  });

  it("listMemoryFiles returns objects with name and content", async () => {
    await getTestEngine().repos.semanticMemory.create({
      id: "f-000001-abcd",
      content: "测试语义记忆",
    });
    const { files } = await getServiceContext().service.listMemoryFiles();
    expect(files.length).toBeGreaterThan(0);
    const memory = files.find((f: { name: string }) => f.name === "MEMORY.md");
    expect(memory).toBeDefined();
    expect(memory!.content).toContain("记忆笔记");
    expect(typeof memory!.size).toBe("number");
    expect(files.some((f: { name: string }) => f.name.startsWith("f-"))).toBe(true);
  });

  it("memorySearch returns structured semantic memory and PG dialogue hits", async () => {
    await getTestEngine().repos.semanticMemory.create({
      content: "逸灵风记忆管道使用 compression 压缩",
      type: "world",
    });

    const sid = "20260526_120000_abcd";
    await seedSession(
      getTestEngine(),
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: "2026-05-26T12:00:00+08:00",
        platform: "parlor",
        title: "t",
      },
      [
        {
          role: "user",
          timestamp: "2026-05-26T12:00:00+08:00",
          content: "讨论 compression 算法",
          pos: 1,
        },
      ],
    );

    const out = await getServiceContext().service.memorySearch({ query: "compression" });
    expect(out.semantic_memory.length).toBeGreaterThan(0);
    expect(out.dialogue.length).toBeGreaterThan(0);
    expect(out.semantic_memory[0]!.score).toBeGreaterThan(0);
    expect(out.dialogue[0]!.session_id).toBe(sid);
  });

  it("countSemanticMemory returns semantic memory count", async () => {
    await getTestEngine().repos.semanticMemory.create({
      content: "语义记忆计数探针 gamma",
      type: "world",
    });

    const { index_rows } = await getServiceContext().service.countSemanticMemory();
    expect(index_rows).toBeGreaterThan(0);
    const hits = await getServiceContext().service.memorySearch({ query: "gamma" });
    expect(hits.semantic_memory.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
