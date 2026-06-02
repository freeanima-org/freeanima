import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resetStoreForTests, MemoryStore, parseFact, factToFileText } from "@freeanima/legacy-memory";

describe("memory store", () => {
  let home: string;
  const prev = process.env.FREEANIMA_HOME;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "freeanima-store-"));
    process.env.FREEANIMA_HOME = home;
    resetStoreForTests();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prev;
  });

  it("creates fact with id and round-trips frontmatter", () => {
    const store = new MemoryStore(join(home, "memory"));
    const id = store.create({
      content: "逸灵风是数字生命的容器",
      confidence: 0.9,
      importance: 0.85,
      recall: 0.8,
      domains: ["project"],
      entities: ["逸灵风"],
    });
    expect(id).toMatch(/^f-\d{6}-[0-9a-f]{4}$/);

    const loaded = store.get(id);
    expect(loaded).not.toBeNull();
    expect(loaded!.content).toBe("逸灵风是数字生命的容器");
    expect(loaded!.domains).toEqual(["project"]);

    const text = factToFileText(loaded!);
    const reparsed = parseFact(text);
    expect(reparsed?.id).toBe(id);
    expect(reparsed?.content).toBe(loaded!.content);
  });
});
