import { describe, expect, it } from "bun:test";

import { mergeSection, replaceSection } from "./habitat-runtime-config-repo.ts";

describe("habitat-runtime-config section merge vs replace", () => {
  it("mergeSection 浅合并 record，无法删除已有条目", () => {
    const doc = {
      acp_agents: {
        cursor: { command: "cursor-agent" },
        claude: { command: "claude" },
      },
    };
    const next = mergeSection(doc, "acp_agents", { claude: { command: "claude-code" } });
    expect(next.acp_agents).toEqual({
      cursor: { command: "cursor-agent" },
      claude: { command: "claude-code" },
    });
  });

  it("replaceSection 整段替换 record，可删除条目", () => {
    const doc = {
      acp_agents: {
        cursor: { command: "cursor-agent" },
        claude: { command: "claude" },
      },
    };
    const next = replaceSection(doc, "acp_agents", { claude: { command: "claude-code" } });
    expect(next.acp_agents).toEqual({ claude: { command: "claude-code" } });
  });
});
