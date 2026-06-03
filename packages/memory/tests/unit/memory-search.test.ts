import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resetStoreForTests,
  registerMemoryTools,
  MemoryStore,
  indexL3Fact,
  searchL3,
  searchL3Fts,
  indexL3Facts,
  indexL2Session,
} from "@freeanima/legacy-memory";
import { getTool } from "@freeanima/legacy-kernel";
import { runWithToolContext } from "@freeanima/legacy-engine";

describe("memory search", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-search-"));
    process.env.FREEANIMA_HOME = home;
    resetStoreForTests();
    registerMemoryTools();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("FTS finds indexed L3 fact", async () => {
    const store = new MemoryStore(join(home, "memory"));
    const id = store.create({
      content: "逸灵风使用 TypeScript 实现记忆管道",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    const fact = store.get(id);
    expect(fact).toBeTruthy();
    indexL3Fact(fact!);

    const results = searchL3("TypeScript", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.content.includes("TypeScript"))).toBe(true);
    expect(results[0]!.source).toBe("l3");
  });

  it("remember indexes only the new fact", async () => {
    const store = new MemoryStore(join(home, "memory"));
    store.create({
      content: "占位事实 alpha",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    const sid = "20260527_160000_test";
    await runWithToolContext(sid, async () => {
      await getTool("remember")!.handler({
        content: "增量索引探针 beta",
        confidence: 0.9,
        importance: 0.9,
        recall: 0.5,
      });
    });
    expect(searchL3Fts("beta", 5).length).toBe(1);
    expect(searchL3Fts("alpha", 5).length).toBe(0);
  });

  it("indexL3Facts indexes batch by id", async () => {
    const store = new MemoryStore(join(home, "memory"));
    const id = store.create({
      content: "批量索引 gamma",
      confidence: 0.9,
      importance: 0.9,
      recall: 0.5,
    });
    expect(indexL3Facts([id])).toBe(1);
    expect(searchL3Fts("gamma", 5).length).toBe(1);
  });

  it("recall returns L3 facts and L2 dialogue", async () => {
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
    expect(indexL2Session(sid)).toBeGreaterThan(0);

    const out = await getTool("recall")!.handler({ query: "compression" });
    expect(out).toContain("## L3 事实");
    expect(out).toContain("## 历史对话");
    expect(out).toContain("compression");
  });
});
