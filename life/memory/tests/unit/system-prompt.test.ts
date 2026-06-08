import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SemanticMemoryStorePort } from "@freeanima/engine-repos";
import {
  composeSystemPrompt,
  decomposeSystemPromptParts,
  RESIDENT_MEMORY_SYSTEM_FRAME,
} from "../../src/system-prompt.ts";
import {
  registerSemanticMemoryStore,
  resetSemanticMemoryStoreForTests,
} from "../../src/semantic-port.ts";

function createMockSemanticStore(
  resident: Array<{ content: string; pinned?: boolean }> = [],
): SemanticMemoryStorePort {
  return {
    async listResident() {
      return resident.map((row, i) => ({
        id: `fact-${i}`,
        content: row.content,
        type: "fact",
        pinned: row.pinned ?? false,
        created: "",
        updated: "",
      }));
    },
  } as SemanticMemoryStorePort;
}

describe("system-prompt", () => {
  beforeEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  afterEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  it("composeSystemPrompt 顺序为 self → resident → agents", () => {
    const composed = composeSystemPrompt({
      self: "SELF_MARKER",
      resident: "RESIDENT_MARKER",
      agents: "AGENTS_MARKER",
    });
    const selfIdx = composed.indexOf("SELF_MARKER");
    const residentIdx = composed.indexOf("RESIDENT_MARKER");
    const agentsIdx = composed.indexOf("AGENTS_MARKER");
    expect(selfIdx).toBeLessThan(residentIdx);
    expect(residentIdx).toBeLessThan(agentsIdx);
  });

  it("常驻记忆段含第二人称骨架与代码块", async () => {
    registerSemanticMemoryStore(createMockSemanticStore([{ content: "我喜欢测试", pinned: true }]));
    const parts = await decomposeSystemPromptParts("自我层内容");
    expect(parts.resident).toContain(RESIDENT_MEMORY_SYSTEM_FRAME);
    expect(parts.resident).toContain("## 常驻记忆");
    expect(parts.resident).toContain("```md");
    expect(parts.resident).toContain("- 📌 我喜欢测试");
  });

  it("项目上下文段含代码块且无第二人称骨架", async () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-agents-"));
    writeFileSync(join(dir, "AGENTS.md"), "# 项目规约\n遵守类型注解。", "utf-8");
    registerSemanticMemoryStore(createMockSemanticStore());

    const parts = await decomposeSystemPromptParts("自我层", dir);
    expect(parts.agents).toContain("## 项目上下文");
    expect(parts.agents).toContain("```md");
    expect(parts.agents).toContain("遵守类型注解");
    expect(parts.agents).not.toContain(RESIDENT_MEMORY_SYSTEM_FRAME);
  });

  it("空常驻记忆与无 AGENTS.md 时段被省略", async () => {
    registerSemanticMemoryStore(createMockSemanticStore());
    const parts = await decomposeSystemPromptParts("自我层", null);
    expect(parts.resident).toBe("");
    expect(parts.agents).toBe("");
  });
});
