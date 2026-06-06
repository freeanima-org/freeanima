import { describe, it, expect } from "bun:test";
import { parseLegacyFact } from "../../src/legacy-fact.ts";

describe("legacy fact parser", () => {
  it("parses f-*.md frontmatter and body", () => {
    const text = `---
id: f-000001-abcd
type: fact
confidence: 0.9
importance: 0.8
recall: 0.7
domains: [project]
entities: [逸灵风]
created: 2026-01-15T10:00:00+08:00
updated: 2026-01-15T12:00:00+08:00
---
逸灵风是数字生命的容器
`;
    const parsed = parseLegacyFact(text);
    expect(parsed?.id).toBe("f-000001-abcd");
    expect(parsed?.type).toBe("fact");
    expect(parsed?.content).toBe("逸灵风是数字生命的容器");
    expect(parsed?.domains).toEqual(["project"]);
  });
});
