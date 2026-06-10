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
import { SELF_BLOCK_KEYS } from "@freeanima/engine-repos";
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
    expect(out.results.length).toBeGreaterThan(0);
    const semantic = out.results.find((r: { memory_type: string }) => r.memory_type === "semantic");
    const session = out.results.find((r: { memory_type: string }) => r.memory_type === "session");
    expect(semantic).toBeDefined();
    expect(session).toBeDefined();
    expect(semantic!.score).toBeGreaterThan(0);
    if (session?.memory_type === "session") {
      expect(session.session_id).toBe(sid);
      expect(session.snippet.length).toBeGreaterThan(0);
    }
  });

  it("countSemanticMemory returns semantic memory count", async () => {
    await getTestEngine().repos.semanticMemory.create({
      content: "语义记忆计数探针 gamma",
      type: "world",
    });

    const { index_rows } = await getServiceContext().service.countSemanticMemory();
    expect(index_rows).toBeGreaterThan(0);
    const hits = await getServiceContext().service.memorySearch({ query: "gamma" });
    expect(hits.results.some((r: { memory_type: string }) => r.memory_type === "semantic")).toBe(
      true,
    );
  });

  it("listSemanticMemories supports filter offset and total", async () => {
    await getTestEngine().repos.semanticMemory.create({
      content: "列表探针 alpha unique-token",
      type: "preference",
    });
    await getTestEngine().repos.semanticMemory.create({
      content: "列表探针 beta unique-token",
      type: "world",
    });

    const filtered = await getServiceContext().service.listSemanticMemories({
      query: "unique-token",
      types: ["preference"],
      limit: 10,
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items.length).toBe(1);
    expect(filtered.items[0]?.type).toBe("preference");

    const page = await getServiceContext().service.listSemanticMemories({
      limit: 1,
      offset: 0,
    });
    expect(page.total).toBeGreaterThanOrEqual(2);
    expect(page.items.length).toBe(1);
    expect(page.offset).toBe(0);
    expect(page.limit).toBe(1);
  });

  it("listLimbicMemories supports session and kind filter", async () => {
    const sid = "20260526_130000_limbic";
    await getTestEngine().repos.limbicMemory.create({
      session_id: sid,
      kind: "spike",
      content: "情感探针 spike 内容",
    });
    await getTestEngine().repos.limbicMemory.create({
      session_id: sid,
      kind: "session_mood",
      content: "情感探针 mood 内容",
    });

    const spikes = await getServiceContext().service.listLimbicMemories({
      session_id: sid,
      kind: "spike",
    });
    expect(spikes.total).toBe(1);
    expect(spikes.items[0]?.kind).toBe("spike");

    const searched = await getServiceContext().service.listLimbicMemories({
      query: "spike",
      session_id: sid,
    });
    expect(searched.total).toBe(1);
    expect(searched.items[0]?.content).toContain("spike");
  });

  it("listAutobiographicalMemories supports significance filter", async () => {
    await getTestEngine().repos.autobiographicalMemory.create({
      title: "里程碑事件",
      content: "自传列表探针 milestone",
      significance: "milestone",
    });
    await getTestEngine().repos.autobiographicalMemory.create({
      title: "日常记录",
      content: "自传列表探针 normal",
      significance: "normal",
    });

    const milestones = await getServiceContext().service.listAutobiographicalMemories({
      significance: "milestone",
    });
    expect(milestones.total).toBeGreaterThanOrEqual(1);
    expect(
      milestones.items.every((r: { significance: string }) => r.significance === "milestone"),
    ).toBe(true);

    const searched = await getServiceContext().service.listAutobiographicalMemories({
      query: "milestone",
    });
    expect(searched.total).toBeGreaterThanOrEqual(1);
    expect(searched.items.some((r: { title: string }) => r.title.includes("里程碑"))).toBe(true);
  });

  it("listSelfBlocks returns six blocks in order", async () => {
    await getTestEngine().repos.selfLayer.upsertBlock({
      block_key: "direction",
      content: "自我层列表探针",
      updated_by: "test",
    });

    const { blocks } = await getServiceContext().service.listSelfBlocks();
    expect(blocks.length).toBe(SELF_BLOCK_KEYS.length);
    expect(blocks.map((b: { block_key: string }) => b.block_key)).toEqual([...SELF_BLOCK_KEYS]);
    const direction = blocks.find((b: { block_key: string }) => b.block_key === "direction");
    expect(direction?.content).toBe("自我层列表探针");
    expect(direction?.heading).toBe("方向意图");
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
