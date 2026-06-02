import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildProgram } from "../../src/program.js";
import { renderTable } from "../../src/output/table.js";

vi.mock("@freeanima/legacy-kernel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@freeanima/legacy-kernel")>();
  return {
    ...actual,
    listCredentials: vi.fn(() => [
      {
        path: "services/discord",
        category: "services",
        name: "discord",
        label: "discord",
        yaml: true,
        fields: ["token", "desc"],
        tags: ["bot"],
        desc: "Discord bot",
      },
    ]),
    credential: vi.fn(() => "secret-token"),
    insertCredential: vi.fn(() => "services/test"),
  };
});

import * as core from "@freeanima/legacy-kernel";

function runCredential(argv: string[]): Promise<void> {
  const program = buildProgram();
  program.exitOverride();
  return program.parseAsync(["credential", ...argv], { from: "user" });
}

describe("credential CLI", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("list renders table headers", async () => {
    await runCredential(["list"]);
    const out = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join("\n");
    expect(out).toContain("Path");
    expect(out).toContain("services/discord");
    expect(out).toContain("Discord bot");
  });

  it("get prints credential value", async () => {
    await runCredential(["get", "services/discord", "token"]);
    expect(core.credential).toHaveBeenCalledWith("services/discord", "token");
    expect(console.log).toHaveBeenCalledWith("secret-token");
  });

  it("add parses key=value and inserts", async () => {
    await runCredential(["add", "services/test", "token=abc", "desc=hi"]);
    expect(core.insertCredential).toHaveBeenCalledWith("services/test", {
      token: "abc",
      desc: "hi",
    });
  });

  it("add rejects invalid kv", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as (code?: number) => never);
    await expect(runCredential(["add", "services/test", "badkv"])).rejects.toThrow("exit");
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("renderTable", () => {
  it("truncates long cells", () => {
    const table = renderTable([["x".repeat(60)]], ["Path"]);
    expect(table).toContain("…");
  });
});
