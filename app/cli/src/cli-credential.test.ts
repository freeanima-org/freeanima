import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { Command } from "commander";
import type { CredentialMeta } from "@freeanima/platform/config";
import {
  parseKeyValues,
  registerCredentialCommand,
  type CredentialCommandDeps,
} from "./commands/credential.ts";
import { renderTable } from "./output/table.ts";

const sampleMeta: CredentialMeta = {
  path: "services/discord",
  category: "services",
  name: "discord",
  label: "discord",
  yaml: true,
  fields: ["token", "desc"],
  tags: ["bot"],
  desc: "Discord bot",
};

function mockDeps(overrides: Partial<CredentialCommandDeps> = {}): CredentialCommandDeps {
  return {
    listCredentials: () => [],
    credential: () => "secret-value",
    insertCredential: () => "ok",
    updateCredential: () => "ok",
    ...overrides,
  };
}

async function runCredential(args: string[], deps: CredentialCommandDeps): Promise<void> {
  const program = new Command();
  program.exitOverride();
  registerCredentialCommand(program, deps);
  await program.parseAsync(["credential", ...args], { from: "user" });
}

describe("parseKeyValues", () => {
  it("parse key=value pairs", () => {
    expect(parseKeyValues(["token=abc", "desc=hello"])).toEqual({
      token: "abc",
      desc: "hello",
    });
  });

  it("throws on invalid format", () => {
    expect(() => parseKeyValues(["notvalid"])).toThrow(/key=value/);
    expect(() => parseKeyValues([])).toThrow(/At least one key=value argument required/);
  });
});

describe("credential CLI", () => {
  const logs: string[] = [];
  let logSpy: ReturnType<typeof spyOn<typeof console, "log">>;

  beforeEach(() => {
    logs.length = 0;
    logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("list outputs placeholder when no credentials", async () => {
    await runCredential(["list"], mockDeps());
    expect(logs).toEqual(["(no credentials)"]);
  });

  it("list outputs table when credentials exist", async () => {
    await runCredential(["list"], mockDeps({ listCredentials: () => [sampleMeta] }));
    const out = logs.join("\n");
    expect(out).toContain("services/discord");
    expect(out).toContain("Path");
    expect(out).toContain("token");
  });

  it("get outputs field value", async () => {
    await runCredential(
      ["get", "services/discord", "token"],
      mockDeps({
        credential: (path, field) => {
          expect(path).toBe("services/discord");
          expect(field).toBe("token");
          return "my-token";
        },
      }),
    );
    expect(logs).toEqual(["my-token"]);
  });

  it("get exits 1 on failure", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as typeof process.exit);
    await expect(
      runCredential(
        ["get", "missing", "token"],
        mockDeps({
          credential: () => {
            throw new Error("not found");
          },
        }),
      ),
    ).rejects.toThrow("exit:1");
    exitSpy.mockRestore();
  });

  it("add calls insertCredential and outputs success", async () => {
    const inserted: Array<{ path: string; data: Record<string, string> }> = [];
    await runCredential(
      ["add", "services/new", "token=xyz", "desc=test"],
      mockDeps({
        insertCredential: (path, data) => {
          inserted.push({ path, data });
          return "written";
        },
      }),
    );
    expect(inserted[0]).toEqual({
      path: "services/new",
      data: { token: "xyz", desc: "test" },
    });
    expect(logs.some((l) => l.includes("Written services/new"))).toBe(true);
  });
});

describe("renderTable", () => {
  it("truncates long cells", () => {
    const table = renderTable([["x".repeat(60)]], ["Path"]);
    expect(table).toContain("…");
  });
});
