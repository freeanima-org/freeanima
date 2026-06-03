import { describe, it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { describePg } from "../../helpers/pg-test-gate";
import { beginIntegrationCase } from "../../helpers/integration-case";
import { endIntegrationCase } from "../../helpers/integration-case";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryStore, indexL3Fact, indexL2Session } from "@freeanima/legacy-memory";
import { NestService } from "@freeanima/legacy-runtime";
import { seedSession } from "@freeanima/legacy-db/test-helpers";

describePg("server memory API", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(async () => {
    const ctx = await beginIntegrationCase("freeanima-memapi-");
    home = ctx.home;
    writeFileSync(join(home, "SOUL.md"), "# Agent\n", "utf-8");
    mkdirSync(join(home, "memory"), { recursive: true });
    writeFileSync(join(home, "memory", "f-000001-abcd.md"), "---\nid: f-000001-abcd\n---\nbody\n", "utf-8");
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("listMemoryFiles returns objects with name and content", () => {
    const { files } = new NestService().listMemoryFiles();
    expect(files.length).toBeGreaterThan(0);
    const soul = files.find((f) => f.name === "SOUL.md");
    expect(soul).toBeDefined();
    expect(soul!.content).toContain("Agent");
    expect(typeof soul!.size).toBe("number");
    expect(files.some((f) => f.name.startsWith("f-"))).toBe(true);
  });

  it.skipIf(typeof Bun !== "undefined")("memorySearch returns structured L3 and L2 hits", () => {
    const store = new MemoryStore(join(home, "memory"));
    const id = store.create({
      content: "逸灵风记忆管道使用 compression 压缩",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    indexL3Fact(store.get(id)!);

    const sid = "20260526_120000_abcd";
    const processedDir = join(home, "processed");
    mkdirSync(processedDir, { recursive: true });
    const l2Lines = [
      JSON.stringify({ type: "meta", session_id: sid, title: "t" }),
      JSON.stringify({
        t: "2026-05-26T12:00:00+08:00",
        role: "user",
        content: "讨论 compression 算法",
      }),
    ];
    writeFileSync(join(processedDir, `${sid}.jsonl`), `${l2Lines.join("\n")}\n`, "utf-8");
    indexL2Session(sid);

    const out = new NestService().memorySearch({ query: "compression" });
    expect(out.l3.length).toBeGreaterThan(0);
    expect(out.l2.length).toBeGreaterThan(0);
    expect(out.l3[0]!.score).toBeGreaterThan(0);
    expect(out.l2[0]!.session_id).toBe(sid);
  });

  it.skipIf(typeof Bun !== "undefined")("rebuildL2All distills L1 and reindexes FTS", async () => {
    const sid = "20260526_130000_efgh";
    await seedSession(
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: "2026-05-26T13:00:00+08:00",
        platform: "parlor",
        title: "测试",
      },
      [
        {
          role: "user",
          timestamp: "2026-05-26T13:00:00+08:00",
          content: "L2 重建关键词 alpha",
          pos: 1,
        },
        {
          role: "assistant",
          timestamp: "2026-05-26T13:00:01+08:00",
          content: "收到",
          pos: 2,
        },
      ],
    );

    const out = await new NestService().rebuildL2All();
    expect(out.sessions).toBeGreaterThan(0);
    expect(out.index_rows).toBeGreaterThan(0);

    const hits = new NestService().memorySearch({ query: "alpha" });
    expect(hits.l2.some((h) => h.session_id === sid)).toBe(true);
  });

  it.skipIf(typeof Bun !== "undefined")("distillL2All and reindexL2All are separate", async () => {
    const sid = "20260526_140000_split";
    await seedSession(
      sid,
      {
        role: "session_meta",
        model: "test-model",
        tools: [],
        functions: [],
        timestamp: "2026-05-26T14:00:00+08:00",
        platform: "parlor",
        title: "t",
      },
      [
        {
          role: "user",
          timestamp: "2026-05-26T14:00:00+08:00",
          content: "split distill keyword",
          pos: 1,
        },
      ],
    );

    const svc = new NestService();
    const { sessions } = await svc.distillL2All();
    expect(sessions).toBeGreaterThan(0);

    const before = svc.memorySearch({ query: "split distill" });
    expect(before.l2.length).toBe(0);

    const { index_rows } = svc.reindexL2All();
    expect(index_rows).toBeGreaterThan(0);
    const after = svc.memorySearch({ query: "split distill" });
    expect(after.l2.some((h) => h.session_id === sid)).toBe(true);
  });

  it.skipIf(typeof Bun !== "undefined")("reindexL3All rebuilds FTS from memory files", () => {
    const store = new MemoryStore(join(home, "memory"));
    store.create({
      content: "L3 全量重建探针 gamma",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });

    const { index_rows } = new NestService().reindexL3All();
    expect(index_rows).toBeGreaterThan(0);
    const hits = new NestService().memorySearch({ query: "gamma" });
    expect(hits.l3.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await endIntegrationCase();
  });
});
