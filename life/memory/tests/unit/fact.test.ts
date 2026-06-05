import { describe, expect, it } from "bun:test";

import { createFact, factToFileText, parseFact } from "../../src/fact.ts";

describe("fact", () => {
  it("round-trips frontmatter", () => {
    const fact = createFact({ content: "测试事实", confidence: 0.9 });
    fact.id = "f-000001-abcd";
    const text = factToFileText(fact);
    const parsed = parseFact(text);
    expect(parsed?.id).toBe("f-000001-abcd");
    expect(parsed?.content).toBe("测试事实");
    expect(parsed?.confidence).toBe(0.9);
  });
});
