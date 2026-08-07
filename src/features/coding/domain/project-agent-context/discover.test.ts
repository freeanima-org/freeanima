import { describe, expect, it } from "bun:test";

import {
  createMemoryProjectVfs,
  discoverProjectAgentContext,
  formatAlwaysRulesSection,
  parseMcpJsonDocument,
} from "./index.ts";

describe("discoverProjectAgentContext", () => {
  it("prefers .agents skills over vendor paths with same name", async () => {
    const vfs = createMemoryProjectVfs({
      ".agents/skills/foo/SKILL.md": "---\nname: foo\ndescription: from agents\n---\nbody agents",
      ".claude/skills/foo/SKILL.md": "---\nname: foo\ndescription: from claude\n---\nbody claude",
      ".claude/skills/bar/SKILL.md": "---\nname: bar\ndescription: only claude\n---\nbody",
    });
    const ctx = await discoverProjectAgentContext(vfs);
    expect(ctx.skills.map((s) => s.name).toSorted()).toEqual(["bar", "foo"]);
    expect(ctx.skills.find((s) => s.name === "foo")?.source).toBe("agents");
    expect(ctx.skills.find((s) => s.name === "bar")?.source).toBe("claude");
  });

  it("loads AGENTS.md and CLAUDE.md as always rules", async () => {
    const vfs = createMemoryProjectVfs({
      "AGENTS.md": "# Agents\nUse bun test",
      "CLAUDE.md": "# Claude\nPrefer typed APIs",
    });
    const ctx = await discoverProjectAgentContext(vfs);
    expect(ctx.rules.some((r) => r.path === "AGENTS.md" && r.kind === "always")).toBe(true);
    expect(ctx.rules.some((r) => r.path === "CLAUDE.md" && r.kind === "always")).toBe(true);
    const section = formatAlwaysRulesSection(ctx.rules);
    expect(section).toContain("Use bun test");
    expect(section).toContain("Prefer typed APIs");
  });

  it("does not scan .anima for skills/rules/mcp", async () => {
    const vfs = createMemoryProjectVfs({
      ".anima/skills/secret/SKILL.md": "---\nname: secret\ndescription: should ignore\n---\nx",
      ".anima/rules/nope.md": "ignore me",
      ".anima/mcp.json": JSON.stringify({
        mcpServers: { bad: { command: "echo" } },
      }),
      ".anima/project.json": '{"version":1,"stable_key":"git:x"}',
    });
    const ctx = await discoverProjectAgentContext(vfs);
    expect(ctx.skills).toEqual([]);
    expect(ctx.rules).toEqual([]);
    expect(ctx.mcpServers).toEqual([]);
    expect(ctx.agentsMdPath).toBe("AGENTS.md");
  });

  it("merges mcp with .agents winning on name", async () => {
    const vfs = createMemoryProjectVfs({
      ".agents/mcp.json": JSON.stringify({
        mcpServers: { shared: { url: "http://agents.example/mcp", transport: "http" } },
      }),
      ".vscode/mcp.json": JSON.stringify({
        servers: {
          shared: { url: "http://vscode.example/mcp", type: "http" },
          onlyVs: { command: "npx", args: ["-y", "x"] },
        },
      }),
    });
    const ctx = await discoverProjectAgentContext(vfs);
    expect(ctx.mcpServers.find((m) => m.name === "shared")?.source).toBe("agents");
    expect(ctx.mcpServers.find((m) => m.name === "shared")?.config.url).toContain("agents.example");
    expect(ctx.mcpServers.find((m) => m.name === "onlyVs")?.config.command).toBe("npx");
  });

  it("marks cursor glob rules as requestable", async () => {
    const vfs = createMemoryProjectVfs({
      ".cursor/rules/ts.mdc": "---\nglobs: *.ts,*.tsx\nalwaysApply: false\n---\nUse strict TS",
    });
    const ctx = await discoverProjectAgentContext(vfs);
    const r = ctx.rules.find((x) => x.path.includes("ts.mdc"));
    expect(r?.kind).toBe("requestable");
    expect(r?.globs).toContain("*.ts");
  });
});

describe("parseMcpJsonDocument", () => {
  it("accepts mcpServers and servers shapes", () => {
    expect(
      parseMcpJsonDocument(JSON.stringify({ mcpServers: { a: { command: "x", args: ["1"] } } })).a
        ?.command,
    ).toBe("x");
    expect(
      parseMcpJsonDocument(JSON.stringify({ servers: { b: { url: "https://x", type: "http" } } })).b
        ?.url,
    ).toBe("https://x");
  });
});
